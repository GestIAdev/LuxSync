/**
 * 🧬 WAVE 8234 — INFINITE GENOME · Fase G2 certification (Vitest, no GPU).
 *
 * Certifica el Genome Expander del blueprint:
 *  - §4.3 expand: PCG determinista, sesgo por ADN (tanh), dispersión por
 *    caos, curvas lin/exp, redondeo int, semilla 0 = canónico.
 *  - §4.4 retroproyección: el individuo recalcula su ADN con κ=0.25.
 *  - §4.5 genomeId: FNV1a(coreHash ‖ genes cuantizados) — dedupe de
 *    fenotipos idénticos; GenomePool colapsa en el registry.
 */

import { describe, expect, it } from 'vitest'
import {
  CROSS_MUT_BASE,
  CROSS_MUT_CHAOS,
  CROSS_MUT_DISP,
  crossoverGenome,
  expandGenome,
  expressGene,
  geneUniform,
  genomeChildSeed,
  genomeIdU32,
  pcg32,
  retroprojectDna,
  tOfGeneValue,
  type GenomeDNA,
} from './GenomeExpander'
import { parseEuclidMeta, type EuclidMeta } from '../shader/ShaderAssembler'

// ─────────────────────────── Fixtures ───────────────────────────

const CORE_SRC = `// @euclid name    Test Core
// @euclid family  swarm
// @euclid genome  aggression=0.5 chaos=0.5 organicity=0.5
// @euclid gene    G_A   struct int   1   10   5   a:+1.0
// @euclid gene    G_B   expr   float 0.0 1.0  0.5 c:+1.0
// @euclid gene    G_C   expr   float 0.5 8.0  1.0 o:-1.0 curve=exp
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`

const meta: EuclidMeta = parseEuclidMeta(CORE_SRC)

const NEUTRAL: GenomeDNA = { aggression: 0.5, chaos: 0.5, organicity: 0.5 }

// ─────────────────────────── PCG (§4.3-1) ───────────────────────────

describe('G2 — PCG32 / geneUniform (§4.3-1)', () => {
  it('determinista: misma semilla → mismo uint32', () => {
    expect(pcg32(0xdeadbeef)).toBe(pcg32(0xdeadbeef))
    expect(geneUniform(77, 1234, 0)).toBe(geneUniform(77, 1234, 0))
  })

  it('salida ∈ [0, 2³²) y geneUniform ∈ [0,1)', () => {
    for (let s = 0; s < 500; s++) {
      const v = pcg32(s)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(0x100000000)
      const u = geneUniform(s, 999, 3)
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
    }
  })

  it('cambia con seed, coreHash y k (cada gen tiene su azar propio)', () => {
    const a = new Set<number>()
    for (let s = 0; s < 256; s++) a.add(geneUniform(s, 42, 0))
    expect(a.size).toBeGreaterThan(200) // sin colisiones burdas
    expect(geneUniform(1, 42, 0)).not.toBe(geneUniform(1, 42, 1))
    expect(geneUniform(1, 42, 0)).not.toBe(geneUniform(1, 43, 0))
  })
})

// ─────────────────────────── expand() (§4.3) ───────────────────────────

describe('G2 — expandGenome', () => {
  it('seed 0 = fenotipo canónico: defaults exactos y ADN intacto', () => {
    const p = expandGenome(meta, CORE_SRC, 0)
    expect(p.genes.G_A).toBe(5)
    expect(p.genes.G_B).toBeCloseTo(0.5, 9)
    expect(p.genes.G_C).toBeCloseTo(1.0, 9)
    expect(p.dna).toEqual(NEUTRAL)
  })

  it('determinista: mismo (core, seed) → mismo individuo', () => {
    const a = expandGenome(meta, CORE_SRC, 1337)
    const b = expandGenome(meta, CORE_SRC, 1337)
    expect(a.genes).toEqual(b.genes)
    expect(a.genomeId).toBe(b.genomeId)
    expect(a.dna).toEqual(b.dna)
  })

  it('semillas distintas producen fenotipos distintos', () => {
    const ids = new Set(
      Array.from({ length: 64 }, (_, s) => expandGenome(meta, CORE_SRC, s + 1).genomeId),
    )
    expect(ids.size).toBeGreaterThan(50)
  })

  it('sesgo por ADN (tanh): aggression=1 + afinidad a:+1 → t empujado a máx', () => {
    // μ = ½+½·tanh(2·(+1)·(+0.5)) = 0.5+0.5·tanh(1) ≈ 0.881
    // con σ=0.15 (chaos=0) → t ∈ [0.731, 1] → G_A ∈ [7.3, 10] (int).
    const biased = parseEuclidMeta(`// @euclid genome aggression=1.0 chaos=0.0 organicity=0.5
// @euclid gene G_A struct int 1 10 5 a:+1.0
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    for (let s = 1; s <= 32; s++) {
      const v = expandGenome(biased, CORE_SRC, s).genes.G_A
      expect(v).toBeGreaterThanOrEqual(7)
      expect(v).toBeLessThanOrEqual(10)
    }
    // Afinidad opuesta (a:-1) → μ ≈ 0.119 → G_A ∈ [1, 2.7]
    const neg = parseEuclidMeta(`// @euclid genome aggression=1.0 chaos=0.0 organicity=0.5
// @euclid gene G_A struct int 1 10 5 a:-1.0
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    for (let s = 1; s <= 32; s++) {
      const v = expandGenome(neg, CORE_SRC, s).genes.G_A
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(3)
    }
  })

  it('dispersión por caos: chaos=1 dispersa mucho más que chaos=0', () => {
    const mk = (chaos: number) =>
      parseEuclidMeta(`// @euclid genome aggression=0.5 chaos=${chaos} organicity=0.5
// @euclid gene G_B expr float 0.0 1.0 0.5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    // Ojo: a σ alta el clamp satura t en los rieles — la métrica fiel es
    // la DESVIACIÓN TÍPICA (la entropía real), no el nº de valores únicos.
    const stddev = (chaos: number) => {
      const m = mk(chaos)
      const vs: number[] = []
      for (let s = 1; s <= 256; s++) vs.push(expandGenome(m, CORE_SRC, s).genes.G_B)
      const mean = vs.reduce((a, b) => a + b, 0) / vs.length
      return Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length)
    }
    // σ(0.05)=0.18 → σ_t≈0.10 ; σ(1)=0.75 → σ_t≈0.42 (el clamp recorta).
    expect(stddev(1.0)).toBeGreaterThan(stddev(0.05) * 2.5)
  })

  it('curva exp: min·(max/min)^t (escala geométrica, no lineal)', () => {
    const g = { name: 'G_C', cls: 'expr', type: 'float', min: 0.5, max: 8, defaultValue: 1, affinities: {}, curve: 'exp' } as const
    expect(expressGene(g, 0)).toBeCloseTo(0.5, 9)
    expect(expressGene(g, 1)).toBeCloseTo(8, 9)
    // t=0.5 → media GEOMÉTRICA (2.0), no aritmética (4.25).
    expect(expressGene(g, 0.5)).toBeCloseTo(2.0, 6)
    // inversa
    expect(tOfGeneValue(g, 1)).toBeCloseTo(Math.log(2) / Math.log(16), 6)
  })

  it('exp con rango inválido (min≤0) degrada a lin sin lanzar', () => {
    const g = { name: 'G_X', cls: 'expr', type: 'float', min: -1, max: 1, defaultValue: 0, affinities: {}, curve: 'exp' } as const
    expect(expressGene(g, 0.5)).toBeCloseTo(0, 9)
  })

  it('int redondea; float no; todo dentro de [min,max]', () => {
    for (let s = 1; s <= 200; s++) {
      const p = expandGenome(meta, CORE_SRC, s)
      expect(Number.isInteger(p.genes.G_A)).toBe(true)
      expect(p.genes.G_A).toBeGreaterThanOrEqual(1)
      expect(p.genes.G_A).toBeLessThanOrEqual(10)
      expect(p.genes.G_B).toBeGreaterThanOrEqual(0)
      expect(p.genes.G_B).toBeLessThanOrEqual(1)
      expect(p.genes.G_C).toBeGreaterThanOrEqual(0.5)
      expect(p.genes.G_C).toBeLessThanOrEqual(8)
    }
  })

  it('genes con nombre no-G_* no se expanden ni entran al genoma', () => {
    const dirty = parseEuclidMeta(`// @euclid gene BAD struct int 1 9 5
// @euclid gene G_OK struct int 1 9 5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    const p = expandGenome(dirty, CORE_SRC, 7)
    expect(Object.keys(p.genes)).toEqual(['G_OK'])
  })
})

// ───────────────────── genomeId + dedupe (§4.5) ─────────────────────

describe('G2 — genomeId (§4.5)', () => {
  const floatGene = { name: 'G_F', cls: 'expr', type: 'float', min: 0, max: 1, defaultValue: 0.5, affinities: {}, curve: 'lin' } as const
  const intGene = { name: 'G_I', cls: 'struct', type: 'int', min: 1, max: 9, defaultValue: 5, affinities: {}, curve: 'lin' } as const

  it('determinista y sensible al fenotipo', () => {
    const a = genomeIdU32(1234, [floatGene], { G_F: 0.5 })
    expect(a).toBe(genomeIdU32(1234, [floatGene], { G_F: 0.5 }))
    expect(a).not.toBe(genomeIdU32(1234, [floatGene], { G_F: 0.9 }))
    expect(a).not.toBe(genomeIdU32(9999, [floatGene], { G_F: 0.5 }))
  })

  it('float se cuantiza a 8 bits: mismo bucket = mismo individuo', () => {
    // 0.500 → q=128 · 0.5019 → q=128 (mismo bucket) → MISMO genomeId.
    const a = genomeIdU32(7, [floatGene], { G_F: 0.5 })
    const b = genomeIdU32(7, [floatGene], { G_F: 0.5019 })
    expect(a).toBe(b)
    // bucket distinto → individuo distinto.
    expect(a).not.toBe(genomeIdU32(7, [floatGene], { G_F: 0.51 }))
  })

  it('int usa el valor exacto (ya es discreto)', () => {
    const a = genomeIdU32(7, [intGene], { G_I: 0.5 })   // valor expresado 5
    const b = genomeIdU32(7, [intGene], { G_I: 0.51 })  // sigue siendo 5
    expect(a).toBe(b)
    expect(a).not.toBe(genomeIdU32(7, [intGene], { G_I: 0.9 })) // valor 8
  })

  it('dos semillas con fenotipo idéntico colapsan (min=max → siempre mismo)', () => {
    const flat = parseEuclidMeta(`// @euclid gene G_F struct int 5 5 5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    const p1 = expandGenome(flat, CORE_SRC, 11)
    const p2 = expandGenome(flat, CORE_SRC, 98765)
    expect(p1.genomeId).toBe(p2.genomeId)
    expect(p1.genes.G_F).toBe(5)
  })
})

// ───────────────────── retroproyección (§4.4) ─────────────────────

describe('G2 — retroprojectDna (§4.4)', () => {
  it('κ=0.25: Δt positivo con afinidad a:+1 sube aggression', () => {
    // meta: G_A int 1..10 default 5 → t_def = (5−1)/9 = 4/9, affinity a:+1.
    const dna = retroprojectDna(meta, { G_A: 1.0 }, NEUTRAL)
    expect(dna.aggression).toBeCloseTo(0.5 + 0.25 * 1 * (1.0 - 4 / 9), 9)
    expect(dna.chaos).toBe(0.5) // G_A no tiene afinidad c/o
    expect(dna.organicity).toBe(0.5)
  })

  it('afinidad negativa con Δt>0 baja el eje', () => {
    // G_C: o:-1, exp 0.5..8 default 1 → t_def = log(2)/log(16) = 0.25
    const dna = retroprojectDna(meta, { G_C: 1.0 }, NEUTRAL)
    expect(dna.organicity).toBeCloseTo(0.5 + 0.25 * -1 * 0.75, 9)
  })

  it('suma sobre múltiples genes y clampa a [0,1]', () => {
    const hot = retroprojectDna(meta, { G_A: 1, G_B: 1, G_C: 0 }, NEUTRAL)
    // a: 0.5 + 0.25·(+1)·(1−4/9) ≈ 0.6389 (G_A t_def = 4/9)
    // c: 0.5 + 0.25·(+1)·(1−0.5) = 0.625  (G_B t_def = 0.5)
    // o: 0.5 + 0.25·(−1)·(0−0.25) = 0.5625 (G_C t_def = log2/log16 = 0.25)
    expect(hot.aggression).toBeCloseTo(0.5 + 0.25 * 5 / 9, 9)
    expect(hot.chaos).toBeCloseTo(0.625, 9)
    expect(hot.organicity).toBeCloseTo(0.5625, 9)
    // clamp: empuje extremo nunca sale de [0,1].
    const extreme = retroprojectDna(
      meta,
      { G_A: 1, G_B: 1, G_C: 1 },
      { aggression: 1, chaos: 1, organicity: 1 },
    )
    expect(extreme.aggression).toBe(1)
    expect(extreme.chaos).toBe(1)
  })

  it('fenotipo canónico (todos en default) → ADN idéntico al core', () => {
    const ts = Object.fromEntries(
      meta.genes.map((g) => [g.name, tOfGeneValue(g, g.defaultValue)]),
    )
    expect(retroprojectDna(meta, ts, NEUTRAL)).toEqual(NEUTRAL)
  })
})

// ───────────────────── G3 — reproducción §4.6 ─────────────────────

describe('G3 — genomeChildSeed (§4.6-1)', () => {
  it('determinista y decorrelacionado entre frases', () => {
    expect(genomeChildSeed(7, 3)).toBe(genomeChildSeed(7, 3))
    expect(genomeChildSeed(7, 3)).not.toBe(genomeChildSeed(7, 4))
    expect(genomeChildSeed(7, 3)).not.toBe(genomeChildSeed(8, 3))
    // Siempre u32.
    expect(genomeChildSeed(7, 3)).toBeGreaterThanOrEqual(0)
    expect(genomeChildSeed(7, 3)).toBeLessThan(0x100000000)
  })
})

describe('G3 — crossoverGenome (§4.6)', () => {
  const A = { G_A: 3, G_B: 0.2, G_C: 1.5 }
  const B = { G_A: 8, G_B: 0.9, G_C: 5.0 }

  it('determinista: mismos padres + semilla → mismo hijo', () => {
    const h1 = crossoverGenome(meta, CORE_SRC, A, B, 42)
    const h2 = crossoverGenome(meta, CORE_SRC, A, B, 42)
    expect(h1.genes).toEqual(h2.genes)
    expect(h1.genomeId).toBe(h2.genomeId)
    expect(h1.dna).toEqual(h2.dna)
  })

  it('valores del hijo siempre dentro de rango legal (min..max, int redondo)', () => {
    for (let s = 1; s <= 300; s++) {
      const h = crossoverGenome(meta, CORE_SRC, A, B, s)
      expect(Number.isInteger(h.genes.G_A)).toBe(true)
      expect(h.genes.G_A).toBeGreaterThanOrEqual(1)
      expect(h.genes.G_A).toBeLessThanOrEqual(10)
      expect(h.genes.G_B).toBeGreaterThanOrEqual(0)
      expect(h.genes.G_B).toBeLessThanOrEqual(1)
      expect(h.genes.G_C).toBeGreaterThanOrEqual(0.5)
      expect(h.genes.G_C).toBeLessThanOrEqual(8)
    }
  })

  it('sin mutación cada gen hereda de A o de B (herencia homóloga)', () => {
    // chaos_hijo pequeño → p_m ≈ 0.05: con suficientes semillas, al menos
    // un hijo no muta ningún gen → todos ∈ {A,B} exactamente.
    const lowChaos = parseEuclidMeta(`// @euclid genome chaos=0.0
// @euclid gene G_B expr float 0.0 1.0 0.5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    const a1 = { G_B: 0.1 }
    const b1 = { G_B: 0.8 }
    let pure = 0
    for (let s = 1; s <= 400; s++) {
      const h = crossoverGenome(lowChaos, CORE_SRC, a1, b1, s)
      if (h.genes.G_B === 0.1 || h.genes.G_B === 0.8) pure++
    }
    // p_m(0)≈0.05 → ≥90% de hijos heredan sin mutar.
    expect(pure).toBeGreaterThan(360)
  })

  it('la mutación se desplaza ≤ ±0.15·rango del padre heredado', () => {
    const range = 9 // G_A: 1..10
    for (let s = 1; s <= 300; s++) {
      const h = crossoverGenome(meta, CORE_SRC, A, B, s)
      const v = h.genes.G_A
      // v está a ≤0.15·rango + 0.5 (redondeo int) de A o de B (o riel).
      const nearA = Math.abs(v - A.G_A) <= CROSS_MUT_DISP * range + 0.5
      const nearB = Math.abs(v - B.G_A) <= CROSS_MUT_DISP * range + 0.5
      const rail = v === 1 || v === 10
      expect(nearA || nearB || rail).toBe(true)
    }
  })

  it('p_m crece con chaos_hijo: cores caóticos mutan más', () => {
    const mk = (chaos: number) =>
      parseEuclidMeta(`// @euclid genome chaos=${chaos}
// @euclid gene G_B expr float 0.0 1.0 0.5 c:+1.0
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    const a1 = { G_B: 0.2 }
    const b1 = { G_B: 0.7 }
    const mutated = (m: typeof meta) => {
      let n = 0
      for (let s = 1; s <= 400; s++) {
        const h = crossoverGenome(m, CORE_SRC, a1, b1, s)
        if (h.genes.G_B !== 0.2 && h.genes.G_B !== 0.7) n++
      }
      return n
    }
    // G_B c:+1 empuja chaos_hijo > 0.5 → p_m alto; chaos=0 → p_m ≈ 0.05.
    expect(mutated(mk(0.9))).toBeGreaterThan(mutated(mk(0.0)))
  })

  it('el hijo sale empadronado con ADN retroproyectado propio (§4.4)', () => {
    const h = crossoverGenome(meta, CORE_SRC, A, B, 7)
    for (const k of ['aggression', 'chaos', 'organicity'] as const) {
      expect(h.dna[k]).toBeGreaterThanOrEqual(0)
      expect(h.dna[k]).toBeLessThanOrEqual(1)
    }
    // El genomeId es el del fenotipo expresado — no el de los padres.
    const pa = expandGenome(meta, CORE_SRC, 5)
    expect(h.genomeId).not.toBe(pa.genomeId)
  })
})
