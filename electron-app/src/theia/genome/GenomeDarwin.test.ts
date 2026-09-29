/**
 * 🧬 WAVE 8236 — INFINITE GENOME · Fase G4: Darwin Loop & Fitness (§4.6).
 *
 * Certifica el bucle de selección natural:
 *  - Fitness EMA: `F ← 0.9F + 0.1(w_b·ū_beauty + w_f·fav − w_s·skip)`.
 *  - Población viva máx 8 individuos por core (paridad con la LRU).
 *  - Torneo de 3 por frontera de frase: los mejores se reproducen por
 *    crossover, los peores se extinguen (población + registry + dedupe).
 *  - El individuo de alto `u_beauty` sobrevive generaciones; los de bajo
 *    fitness se purgan sistemáticamente.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  TheiaRegistry,
  getTheiaRegistry,
  __resetTheiaRegistryForTests,
} from '../../core/theia/TheiaRegistry'
import { useTheiaPackStore } from '../../stores/useTheiaPackStore'
import {
  atomIdForGenome,
  darwinTournament,
  favoriteAtom,
  getFitness,
  getPopulation,
  GENOME_POPULATION_MAX,
  releaseGenomeAtom,
  resetGenomePool,
  skipAtom,
  spawnCrossoverVariant,
  spawnGenomeVariant,
  stepFitness,
  stepFitnessAll,
  trackBeauty,
} from './GenomePool'
import type { ITheiaAtom } from '../../types/theiaTypes'

const CORE_GLSL = `// @euclid name    Darwin Core
// @euclid family  conformal
// @euclid genome  aggression=0.4 chaos=0.6 organicity=0.5
// @euclid gene    G_FOLD struct int   5   12   8    a:+0.4 c:+0.3
// @euclid gene    G_ZOOM expr   float 0.05 0.5  0.25 a:+0.6
// @euclid gene    G_WARP expr   float 0.0  4.0  1.0  c:+0.5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`

function makeCore(id = 'core_test'): ITheiaAtom {
  return {
    id,
    packId: 'pack_test',
    filePath: 'euclid://core_test.glsl',
    aggression: 0.4,
    chaos: 0.6,
    organicity: 0.5,
    energyZone: { min: 'gentle', max: 'peak' },
    validSections: ['verse', 'drop'],
    trim: { startMs: 0, endMs: 8000 },
    compatibleVibes: ['techno'],
    source: { kind: 'shader', glsl: CORE_GLSL },
  }
}

/** Alimenta la ventana de belleza y cierra con un paso EMA (una frase). */
function phraseWindow(atomId: string, beauty: number, samples = 4): void {
  for (let i = 0; i < samples; i++) trackBeauty(atomId, beauty)
  stepFitness(atomId)
}

describe('G4 — Fitness EMA (§4.6)', () => {
  beforeEach(() => {
    resetGenomePool()
  })

  it('EMA: F ← 0.9·F + 0.1·ū_beauty con la media de la ventana', () => {
    phraseWindow('ind_a', 0.8)
    // Primer paso: F = 0.1·(w_b·0.8) = 0.08
    expect(getFitness('ind_a')).toBeCloseTo(0.08, 9)
    // La EMA converge a la media observada tras varios pasos
    // (0.9^60 ≈ 0.002 → F ≈ 0.998·media).
    for (let i = 0; i < 60; i++) phraseWindow('ind_a', 0.8)
    expect(getFitness('ind_a')).toBeCloseTo(0.8, 2)
  })

  it('la ventana se consume: belleza distinta re-calibra la EMA', () => {
    for (let i = 0; i < 10; i++) phraseWindow('ind_a', 0.9)
    const hi = getFitness('ind_a')
    for (let i = 0; i < 60; i++) phraseWindow('ind_a', 0.2)
    expect(getFitness('ind_a')).toBeLessThan(hi)
    expect(getFitness('ind_a')).toBeCloseTo(0.2, 1)
  })

  it('favorito/skip del operador entran con sus pesos', () => {
    trackBeauty('ind_a', 0.5)
    favoriteAtom('ind_a')
    stepFitness('ind_a')
    // score = 1·0.5 + 1·1 − 0 = 1.5 → F = 0.15
    expect(getFitness('ind_a')).toBeCloseTo(0.15, 9)

    skipAtom('ind_a')
    skipAtom('ind_a')
    stepFitness('ind_a')
    // score = −2 → F = 0.9·0.15 + 0.1·(−2) = −0.065
    expect(getFitness('ind_a')).toBeCloseTo(-0.065, 9)
  })

  it('sin señal no hay paso: un individuo no observado no decae', () => {
    phraseWindow('ind_a', 0.9)
    const f = getFitness('ind_a')
    stepFitness('ind_a')
    stepFitness('ind_a')
    stepFitness('ind_a')
    expect(getFitness('ind_a')).toBe(f)
    expect(getFitness('fantasma')).toBe(0)
  })

  it('fav/skip sobre átomo desconocido lo auto-adscribe a su población', () => {
    favoriteAtom('core_test#77')
    expect(getPopulation('core_test')).toContain('core_test#77')
    expect(getPopulation('core_test')).toContain('core_test')
  })
})

describe('G4 — Población limitada (§4.6: máx 8 por core)', () => {
  let registry: TheiaRegistry

  beforeEach(() => {
    registry = new TheiaRegistry()
    resetGenomePool()
    expect(registry.register(makeCore())).not.toBeNull()
  })

  it('la población nunca supera 8 individuos vivos', () => {
    for (let s = 1; s <= 12; s++) {
      spawnGenomeVariant('core_test', s, registry)
    }
    const pop = getPopulation('core_test')
    expect(pop.length).toBe(GENOME_POPULATION_MAX)
    expect(pop).toContain('core_test') // la especie raíz es inmortal
  })

  it('la extinción purga al de menor fitness y limpia registry+dedupe', () => {
    // Dos individuos: uno querido, uno odiado.
    const loved = spawnGenomeVariant('core_test', 1, registry)!.atomId
    const hated = spawnGenomeVariant('core_test', 2, registry)!.atomId
    phraseWindow(loved, 0.95)
    skipAtom(hated)
    skipAtom(hated)
    stepFitnessAll('core_test')
    expect(getFitness(hated)).toBeLessThan(0)

    // Llena la población hasta el tope con neutros.
    for (let s = 10; s <= 16; s++) spawnGenomeVariant('core_test', s, registry)
    const pop = getPopulation('core_test')
    expect(pop.length).toBeLessThanOrEqual(GENOME_POPULATION_MAX)
    // El odiado fue el primero en caer.
    expect(pop).not.toContain(hated)
    expect(registry.getAtom(hated)).toBeUndefined()
    // El dedupe también lo olvida — la misma semilla renace limpia.
    // (su genomeId ya no apunta al átomo extinto)
    expect(getPopulation('core_test')).toContain(loved)
    expect(registry.getAtom(loved)).toBeDefined()
  })

  it('los G3-spawns quedan empadronados automáticamente', () => {
    spawnGenomeVariant('core_test', 5, registry)
    spawnGenomeVariant('core_test', 6, registry)
    const pop = getPopulation('core_test')
    expect(pop).toEqual(
      expect.arrayContaining(['core_test', 'core_test#5', 'core_test#6']),
    )
  })
})

describe('G4 — Torneo de Darwin (§4.6)', () => {
  let registry: TheiaRegistry

  beforeEach(() => {
    registry = new TheiaRegistry()
    resetGenomePool()
    expect(registry.register(makeCore())).not.toBeNull()
  })

  it('población < 2 → mutación directa (fallback G3)', () => {
    const r = darwinTournament('core_test', 12345, 'core_test', registry)
    expect(r).not.toBeNull()
    expect(r!.atomId).toBe('core_test#12345')
    expect(getPopulation('core_test')).toContain('core_test#12345')
  })

  it('población ≥ 2 → torneo produce un hijo crossover legal', () => {
    const a = spawnGenomeVariant('core_test', 11, registry)!.atomId
    const b = spawnGenomeVariant('core_test', 22, registry)!.atomId
    const child = darwinTournament('core_test', 777, a, registry)
    expect(child).not.toBeNull()
    expect(child!.atomId.startsWith('core_test#')).toBe(true)

    // El hijo es un individuo legal: todos los genes en rango declarado.
    const genes = child!.phenotype.genes
    expect(genes.G_FOLD).toBeGreaterThanOrEqual(5)
    expect(genes.G_FOLD).toBeLessThanOrEqual(12)
    expect(Number.isInteger(genes.G_FOLD)).toBe(true)
    expect(genes.G_ZOOM).toBeGreaterThanOrEqual(0.05)
    expect(genes.G_ZOOM).toBeLessThanOrEqual(0.5)
    expect(genes.G_WARP).toBeGreaterThanOrEqual(0)
    expect(genes.G_WARP).toBeLessThanOrEqual(4)
    // Y está registrado como individuo vivo de la población.
    expect(registry.getAtom(child!.atomId)).toBeDefined()
    expect(getPopulation('core_test')).toContain(child!.atomId)
    expect(a).not.toBe(b)
  })

  it('un individuo con alto u_beauty sobrevive a muchas generaciones', () => {
    // Campeón: belleza alta sostenida.
    const champ = spawnGenomeVariant('core_test', 7, registry)!.atomId
    for (let i = 0; i < 10; i++) phraseWindow(champ, 0.95)
    // Relleno con individuos mediocres (belleza baja).
    for (let s = 20; s <= 27; s++) {
      const r = spawnGenomeVariant('core_test', s, registry)
      if (r && r.atomId !== champ) phraseWindow(r.atomId, 0.05)
    }
    stepFitnessAll('core_test')
    expect(getFitness(champ)).toBeGreaterThan(0.5)

    // 12 generaciones de torneo — el campeón jamás se extingue.
    for (let g = 0; g < 12; g++) {
      const r = darwinTournament('core_test', 0xa5a5 + g, champ, registry)
      expect(r).not.toBeNull()
      const pop = getPopulation('core_test')
      expect(pop.length).toBeLessThanOrEqual(GENOME_POPULATION_MAX)
      expect(pop).toContain(champ)
      expect(registry.getAtom(champ)).toBeDefined()
    }
  })

  it('los peores son sistemáticamente purgados generación a generación', () => {
    const champ = spawnGenomeVariant('core_test', 7, registry)!.atomId
    for (let i = 0; i < 10; i++) phraseWindow(champ, 0.9)

    // Seis parias con muchos skips → fitness muy negativo tras evaluación.
    const pariahs: string[] = []
    for (let s = 30; s <= 35; s++) {
      const r = spawnGenomeVariant('core_test', s, registry)
      if (!r) continue
      pariahs.push(r.atomId)
      skipAtom(r.atomId)
      skipAtom(r.atomId)
      skipAtom(r.atomId)
    }

    let extinctCount = 0
    for (let g = 0; g < 10 && pariahs.length > 0; g++) {
      darwinTournament('core_test', 0xb00b + g, champ, registry)
      // Cada generación que crea un hijo fuerza una purga del más débil.
      for (let i = pariahs.length - 1; i >= 0; i--) {
        if (registry.getAtom(pariahs[i]) === undefined) {
          extinctCount++
          pariahs.splice(i, 1)
        }
      }
    }
    // Los odiados caen antes que el resto — purga sistemática.
    expect(extinctCount).toBeGreaterThanOrEqual(4)
    expect(getPopulation('core_test')).toContain(champ)
  })

  it('la extinción libera el genomeId: la misma línea puede renacer', () => {
    // Llena la población (8). Uno con fitness terrible.
    const bad = spawnGenomeVariant('core_test', 1, registry)!
    const badGenome = bad.genomeId
    for (let s = 2; s <= 7; s++) spawnGenomeVariant('core_test', s, registry)
    expect(getPopulation('core_test').length).toBe(GENOME_POPULATION_MAX)

    skipAtom(bad.atomId)
    stepFitness(bad.atomId) // consume el skip → F = −0.1 (el más bajo)
    // Siguiente nacimiento → la purga se lo lleva a él (F más bajo).
    const next = spawnGenomeVariant('core_test', 40, registry)
    expect(next).not.toBeNull()
    expect(registry.getAtom(bad.atomId)).toBeUndefined()
    expect(atomIdForGenome(badGenome)).toBeUndefined()
    // Y su fenotipo puede volver a registrarse sin colapso falso.
    const reborn = spawnGenomeVariant('core_test', 1, registry)
    expect(reborn!.created).toBe(true)
    expect(registry.getAtom(reborn!.atomId)).toBeDefined()
  })

  it('el individuo protegido (activo en pantalla) nunca se extingue', () => {
    const active = spawnGenomeVariant('core_test', 9, registry)!.atomId
    skipAtom(active)
    skipAtom(active)
    stepFitnessAll('core_test')
    expect(getFitness(active)).toBeLessThan(0)

    // Llena hasta 9 → la purga debería querer al activo, pero está protegido.
    for (let s = 50; s <= 58; s++) {
      spawnGenomeVariant('core_test', s, registry, active)
    }
    const pop = getPopulation('core_test')
    expect(pop.length).toBeLessThanOrEqual(GENOME_POPULATION_MAX)
    expect(pop).toContain(active)
    expect(registry.getAtom(active)).toBeDefined()
  })

  it('darwinTournament rechaza cores inexistentes o sin genes', () => {
    expect(darwinTournament('nope', 1, undefined, registry)).toBeNull()
    registry.register({
      ...makeCore('flat'),
      filePath: 'euclid://flat.glsl',
      source: {
        kind: 'shader',
        glsl: 'void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }',
      },
    })
    expect(darwinTournament('flat', 1, undefined, registry)).toBeNull()
  })

  it('crossover directo también respeta la cota de población', () => {
    const ids: string[] = []
    for (let s = 1; s <= 7; s++) {
      const r = spawnGenomeVariant('core_test', s, registry)
      if (r) ids.push(r.atomId)
    }
    // Población llena: core + 7 = 8. El crossover empuja a 9 y purga.
    const child = spawnCrossoverVariant(
      'core_test',
      ids[0],
      ids[1],
      999,
      registry,
    )
    expect(child).not.toBeNull()
    const pop = getPopulation('core_test')
    expect(pop.length).toBe(GENOME_POPULATION_MAX)
    expect(pop).toContain(child!.atomId)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 8302 · M3 — CRUD de mutaciones: baja manual vía removeAtom
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 8302 · M3 — removeAtom (baja manual de mutaciones)', () => {
  // removeAtom va al registry GLOBAL (getTheiaRegistry) — el path real de
  // la UI. Aquí se usa ese singleton, no una instancia inyectada. OJO: el
  // reset lo RECREA → hay que capturarlo después, dentro de beforeEach.
  let registry: TheiaRegistry

  const makePack = (core: ITheiaAtom) => ({
    id: core.packId,
    rootPath: 'euclid://pack_test',
    atoms: [core],
    manifest: null,
    scannedAt: Date.now(),
    pending: true,
  })

  beforeEach(() => {
    __resetTheiaRegistryForTests()
    registry = getTheiaRegistry()
    resetGenomePool()
    // El store es singleton: reseteo quirúrgico de los cubos que M3 toca.
    useTheiaPackStore.setState({
      packs: new Map(),
      atomGeneValues: new Map(),
      atomParamValues: new Map(),
      armedAtomId: null,
      activeAtomId: null,
    })
    const core = makeCore()
    expect(registry.register(core)).not.toBeNull()
    useTheiaPackStore.getState().upsertPack(makePack(core))
  })

  it('elimina la mutación del pack, del registry y libera la población', () => {
    const born = spawnGenomeVariant('core_test', 42, registry)!
    expect(born.created).toBe(true)
    const pack = useTheiaPackStore.getState().packs.get('pack_test')!
    expect(pack.atoms.some((a) => a.id === born.atomId)).toBe(true)
    expect(registry.getAtom(born.atomId)).toBeDefined()
    expect(getPopulation('core_test')).toContain(born.atomId)

    useTheiaPackStore.getState().removeAtom(born.atomId)

    const after = useTheiaPackStore.getState().packs.get('pack_test')!
    expect(after.atoms.some((a) => a.id === born.atomId)).toBe(false)
    expect(registry.getAtom(born.atomId)).toBeUndefined()
    expect(getPopulation('core_test')).not.toContain(born.atomId)
    // El core (especie raíz) sobrevive.
    expect(registry.getAtom('core_test')).toBeDefined()
    expect(after.atoms.some((a) => a.id === 'core_test')).toBe(true)
    // La misma semilla renace limpia — genomeIndex quedó libre.
    const reborn = spawnGenomeVariant('core_test', 42, registry)!
    expect(reborn.created).toBe(true)
    expect(registry.getAtom(reborn.atomId)).toBeDefined()
  })

  it('limpia overrides de genes/params y desarma el átomo si estaba armado', () => {
    const born = spawnGenomeVariant('core_test', 7, registry)!
    const st = useTheiaPackStore.getState()
    st.setAtomGeneValues(born.atomId, { G_FOLD: 9 })
    st.setAtomParamValues(born.atomId, { u_x: 0.5 })
    st.setArmedAtom(born.atomId)

    st.removeAtom(born.atomId)

    const after = useTheiaPackStore.getState()
    expect(after.atomGeneValues.has(born.atomId)).toBe(false)
    expect(after.atomParamValues.has(born.atomId)).toBe(false)
    expect(after.armedAtomId).toBeNull()
  })

  it('no-op sobre átomos inexistentes o ids que no están en ningún pack', () => {
    const before = useTheiaPackStore.getState().packs.get('pack_test')!
    useTheiaPackStore.getState().removeAtom('ghost#999')
    expect(useTheiaPackStore.getState().packs.get('pack_test')).toBe(before)
  })

  it('releaseGenomeAtom es idempotente para ids no-genómicos', () => {
    spawnGenomeVariant('core_test', 3, registry) // puebla la población
    expect(() => {
      releaseGenomeAtom('core_test')   // el core no sale de su población
      releaseGenomeAtom('ghost#999')   // id inexistente
      releaseGenomeAtom('glsl_x')      // átomo de disco, sin '#'
    }).not.toThrow()
    expect(getPopulation('core_test')).toContain('core_test')
    expect(getPopulation('core_test')).toContain('core_test#3')
  })
})
