/**
 * 🔮 WAVE 8229 — Euclid Oracle · Phase E3 certification (Vitest, no GPU).
 *
 * Certifica el Shader Contract §4.1–§4.6:
 *  - Preámbulo: versión GLSL ES 3.00, uniforms del contrato, macros
 *    generadas DESDE TELEMETRY_SCHEMA (índices del blueprint §3.5),
 *    aliases Shadertoy y librería Euclid completa.
 *  - Ensamblado: mainImage() del artista entre preámbulo y epílogo.
 *  - Epílogo: orden masters → crossfade → limitador → blackout → sRGB.
 *  - Remap de líneas de error al código del artista.
 *  - Limitador fotosensible (leaky-bucket): una estrobo a 10 Hz NUNCA
 *    supera 3 flashes/s en la salida (test §7 del blueprint).
 */

import { describe, expect, it } from 'vitest'
import {
  assembleFragmentShader,
  assembleSimFragmentShader,
  buildEpilogue,
  buildGeneDefines,
  buildPreamble,
  buildSimEpilogue,
  geneSignature,
  glslFloatLiteral,
  hasMainImage,
  hasMainState,
  hashSource,
  parseStepsHint,
  remapShaderLog,
  resolveGeneValues,
  layoutExprGenes,
  exprGeneValues,
  structGenesDiffer,
  BLIT_FRAG_SRC,
  FLASH_STATS_FRAG_SRC,
  DEFAULT_MAX_STEPS,
  DEFAULT_FLASH_MAX_DELTA,
  FLASH_BUDGET,
  FLASH_BUDGET_RATE,
  EUCLID_GLSL_VERSION,
  EUCLID_GENE_SLOTS,
} from './ShaderAssembler'
import { TELEMETRY_SCHEMA, SLOT_PAYLOAD_BASE } from '../telemetry/TheiaTelemetryRing'

const ARTIST_BODY = `void mainImage(out vec4 c, in vec2 fragCoord) {
  vec2 uv = fragCoord / u_resolution.xy;
  c = vec4(palette(uv.x + u_time, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0)), 1.0);
}`

// ─────────────────────────── Preámbulo (§4.1) ───────────────────────────

describe('E3 preamble — shader contract', () => {
  const pre = buildPreamble()

  it('empieza con #version 300 es y precision highp (WebGL2 §4.1)', () => {
    expect(pre.startsWith(`${EUCLID_GLSL_VERSION}\n`)).toBe(true)
    expect(pre).toContain('precision highp float;')
    expect(pre).toContain('precision highp int;')
  })

  it('declara los uniforms del contrato §3.5/§4', () => {
    for (const needle of [
      'uniform float u_tel[124];',
      'uniform int   u_flags;',
      'uniform ivec4 u_enums;',
      'uniform float u_time;',
      'uniform float u_dt;',
      'uniform vec3  u_resolution;',
      'uniform float u_beatTime;',
      'uniform float u_kickPulse;',
      'uniform float u_snarePulse;',
      'uniform float u_predictiveETA;',
      'uniform float u_approach;',
      'uniform float u_impact;',
      'uniform float u_brightness;',
      'uniform float u_contrast;',
      'uniform float u_blackout;',
      'uniform float u_renderScale;',
      'uniform sampler2D u_prevFrame;',
      'uniform sampler2D u_flashState;',
      'uniform float u_hasPrev;',
      'uniform float u_blend;',
      'uniform float u_flashGuard;',
      'uniform float u_flashMaxDelta;',
      'uniform float u_flashBudget;',
    ]) {
      expect(pre).toContain(needle)
    }
  })

  it('genera TODAS las macros de telemetría desde TELEMETRY_SCHEMA', () => {
    // Cero índices escritos a mano — cada descriptor con uniform produce
    // su `#define name u_tel[slot-4]`.
    for (const d of TELEMETRY_SCHEMA) {
      if (d.uniform.length === 0) continue
      expect(pre).toContain(`u_tel[${d.slot - SLOT_PAYLOAD_BASE}]`)
      expect(pre).toContain(`#define ${d.uniform}`)
    }
  })

  it('los índices ancla coinciden con el blueprint §3.5', () => {
    const anchors: Array<[string, number]> = [
      ['u_bpm', 1],
      ['u_beatPhase', 2],
      ['u_barPhase', 3],
      ['u_energy', 5],
      ['u_subBass', 6],
      ['u_mid', 9],
      ['u_treble', 11],
      ['u_harshness', 16],
      ['u_spectralFlux', 17],
      ['u_chromaHue', 20],
      ['u_kickEnergy', 22],
      ['u_seleneConfidence', 26],
      ['u_predictionProb', 27],
      ['u_tension', 30],
      ['u_spectralBuildup', 33],
      ['u_morphFactor', 34],
      ['u_lqAmbient', 37],
    ]
    for (const [name, idx] of anchors) {
      expect(pre).toContain(`#define ${name}`)
      expect(pre).toMatch(new RegExp(`#define ${name}\\s+u_tel\\[${idx}\\]`))
    }
    // Chromagrama — 12 bins contiguos a partir del índice 40.
    expect(pre).toContain('#define u_chroma(i)')
    expect(pre).toMatch(/u_chroma\(i\)\s+u_tel\[40 \+ int\(i\)\]/)
  })

  it('expone las macros de flags y el helper telFlag()', () => {
    expect(pre).toContain('bool telFlag(int bit)')
    for (const flag of [
      'AUDIO_LIVE', 'PLL_LOCKED', 'ON_BEAT', 'KICK', 'KICK_EDGE',
      'SNARE', 'HIHAT', 'PREDICTION_ACTIVE', 'BREAKDOWN', 'APOCALYPSE',
      'ACID', 'COLOR_SNAP', 'RHYTHMIC_VOID',
    ]) {
      expect(pre).toContain(`#define ${flag}`)
    }
    expect(pre).toMatch(/#define KICK_EDGE\s+telFlag\(4\)/)
  })

  it('inyecta aliases Shadertoy y la librería Euclid completa', () => {
    expect(pre).toContain('#define iTime')
    expect(pre).toContain('#define iResolution')
    for (const fn of [
      'rot2', 'palette', 'hash21', 'noise3',
      'sdSphere', 'sdBox', 'sdTorus', 'smin', 'opRep',
    ]) {
      expect(pre).toContain(fn)
    }
  })

  it('MAX_STEPS respeta el hint @euclid steps (§4.5)', () => {
    expect(buildPreamble(96)).toContain('#define MAX_STEPS 96')
    expect(buildPreamble(24)).toContain('#define MAX_STEPS 24')
    expect(buildPreamble(0)).toContain('#define MAX_STEPS 8') // piso
  })
})

// ─────────────────────────── Epílogo (§4.6) ───────────────────────────

describe('E3 epilogue — safety contract', () => {
  const epi = buildEpilogue()

  it('llama mainImage y escribe fragColor (salida ES 3.00)', () => {
    expect(epi).toContain('mainImage(col, gl_FragCoord.xy);')
    expect(epi).toContain('fragColor =')
  })

  it('aplica masters (incl. blackout) → crossfade → limitador → sRGB en orden §4.6', () => {
    const iContrast = epi.indexOf('u_contrast')
    const iBright = epi.indexOf('c *= u_brightness')
    const iBlack = epi.indexOf('1.0 - u_blackout')
    const iFade = epi.indexOf('mix(prev, c')
    const iFlash = epi.indexOf('u_flashState')
    const iGamma = epi.indexOf('pow(clamp(c, 0.0, 1.0)')
    expect(iContrast).toBeGreaterThan(0)
    expect(iContrast).toBeLessThan(iBright)
    // blackout es un master: ANTES del limitador — una liberación de
    // blackout también queda rate-limited (no puede bypassear el cap).
    expect(iBright).toBeLessThan(iBlack)
    expect(iBlack).toBeLessThan(iFade)
    expect(iFade).toBeLessThan(iFlash)
    expect(iFlash).toBeLessThan(iGamma)
  })

  it('el limitador usa presupuesto leaky-bucket (no solo delta)', () => {
    expect(epi).toContain('fs.g * u_flashBudget')
    expect(epi).toContain('min(u_flashMaxDelta, remaining)')
    // Solo un flag de operador (u_flashGuard) puede desactivarlo.
    expect(epi).toContain('u_flashGuard > 0.5')
  })
})

// ─────────────────────────── Ensamblado ───────────────────────────

describe('E3 assembleFragmentShader', () => {
  it('preámbulo + cuerpo + epílogo con conteo de líneas correcto', () => {
    const asm = assembleFragmentShader(ARTIST_BODY, 96)
    const lines = asm.fragSource.split('\n')
    // preambleLines es exacto: la línea siguiente es la primera del artista.
    expect(lines[asm.preambleLines]).toBe(ARTIST_BODY.split('\n')[0])
    // El epílogo empieza tras el cuerpo completo.
    const epiStart = asm.preambleLines + asm.bodyLines
    expect(lines.slice(epiStart).join('\n')).toContain('void main()')
    expect(asm.bodyLines).toBe(ARTIST_BODY.split('\n').length)
    // El shader final es ES 3.00 y declara la salida.
    expect(asm.fragSource.startsWith('#version 300 es')).toBe(true)
    expect(asm.fragSource).toContain('out vec4 fragColor;')
  })

  it('el cuerpo del artista permanece intacto entre inyecciones', () => {
    const asm = assembleFragmentShader(ARTIST_BODY)
    expect(asm.fragSource).toContain(ARTIST_BODY)
  })
})

// ─────────────────────────── Error-line remap (§4.4) ───────────────────────────

describe('E3 remapShaderLog — líneas del artista', () => {
  const preambleLines = 30
  const bodyLines = 10

  it('resta las líneas del preámbulo (error dentro del cuerpo)', () => {
    const raw = "ERROR: 0:35: 'und' : syntax error"
    const { log, line } = remapShaderLog(raw, preambleLines, bodyLines)
    expect(line).toBe(5)
    expect(log).toContain('ERROR: 0:5:')
    expect(log).not.toContain('[generated]')
  })

  it('marca errores fuera del cuerpo como [generated]', () => {
    const raw = "ERROR: 0:12: 'x' : foo\nERROR: 0:80: 'y' : bar"
    const { log, line } = remapShaderLog(raw, preambleLines, bodyLines)
    expect(line).toBeNull() // ninguno dentro del cuerpo artista
    expect(log).toContain('ERROR: 0:12[generated]:')
    expect(log).toContain('ERROR: 0:80[generated]:')
  })

  it('soporta múltiples errores en el mismo log', () => {
    const raw = "ERROR: 0:32: 'a' : x\nERROR: 0:38: 'b' : y"
    const { log, line } = remapShaderLog(raw, preambleLines, bodyLines)
    expect(line).toBe(2) // primer error del cuerpo
    expect(log).toContain('ERROR: 0:2:')
    expect(log).toContain('ERROR: 0:8:')
  })
})

// ─────────────────────────── Hints @euclid + helpers ───────────────────────────

describe('E3 hints y helpers', () => {
  it('parseStepsHint lee `@euclid steps N` (§4.2)', () => {
    expect(parseStepsHint('// @euclid steps   96\nvoid mainImage')).toBe(96)
    expect(parseStepsHint('// @euclid steps 24')).toBe(24)
    expect(parseStepsHint('// sin hint')).toBeNull()
    expect(parseStepsHint('// @euclid steps 0')).toBeNull()
  })

  it('hasMainImage exige la firma Shadertoy del contrato', () => {
    expect(hasMainImage(ARTIST_BODY)).toBe(true)
    expect(hasMainImage('void mainImage ( out vec4 c, in vec2 f ) {}')).toBe(true)
    expect(hasMainImage('void main() {}')).toBe(false)
    expect(hasMainImage('vec4 mainImage() {}')).toBe(false)
  })

  it('hashSource es estable y sensible al contenido (clave LRU §4.4)', () => {
    expect(hashSource(ARTIST_BODY)).toBe(hashSource(ARTIST_BODY))
    expect(hashSource(ARTIST_BODY)).not.toBe(hashSource(ARTIST_BODY + ' '))
  })

  it('el shader de stats existe y tiene su contrato de uniforms', () => {
    for (const u of ['u_scene', 'u_statsPrev', 'u_dt', 'u_flashBudget', 'u_budgetRate']) {
      expect(FLASH_STATS_FRAG_SRC).toContain(u)
    }
    expect(FLASH_STATS_FRAG_SRC).toContain(EUCLID_GLSL_VERSION)
    expect(BLIT_FRAG_SRC).toContain('texture(u_tex, v_uv)')
  })
})

// ─────────────────────────── Limitador fotosensible (§7) ───────────────────────────

describe('E3 limitador fotosensible — certificación WCAG', () => {
  /**
   * Espejo exacto del algoritmo GLSL (epílogo + pass de stats):
   *   epílogo: cap = prevMean + min(maxDelta, budget); out = min(in, cap)
   *   stats:   budget = min(B, budget + dt·rate) − max(0, out − prevMean)
   * Si el algoritmo cambia en el shader, este test debe reflejarlo.
   */
  function simulateFlashLimiter(
    inputLuma: number[],
    fps: number,
  ): { out: number[] } {
    let prevMean = 0.5 // init del texel {0.5, full}
    let budget = FLASH_BUDGET
    const out: number[] = []
    for (const inp of inputLuma) {
      const cap = prevMean + Math.min(DEFAULT_FLASH_MAX_DELTA, budget)
      const o = Math.min(Math.max(inp, 0), 1, cap)
      out.push(o)
      const dt = 1 / fps
      budget = Math.min(FLASH_BUDGET, budget + dt * FLASH_BUDGET_RATE)
      budget = Math.max(0, budget - Math.max(0, o - prevMean))
      prevMean = o
    }
    return { out }
  }

  /** Cuenta flashes: subida ≥0.1 desde el último valle + bajada ≥0.05. */
  function countFlashes(out: number[]): number {
    let flashes = 0
    let low = out[0] ?? 0
    let inFlash = false
    let peak = low
    for (const v of out) {
      if (!inFlash) {
        low = Math.min(low, v)
        if (v - low >= 0.1) {
          flashes++
          inFlash = true
          peak = v
        }
      } else {
        peak = Math.max(peak, v)
        if (v <= peak - 0.05) {
          inFlash = false
          low = v
        }
      }
    }
    return flashes
  }

  it('estrobo forzada a 10 Hz nunca supera 3 flashes/s (§7)', () => {
    const fps = 60
    const seconds = 8
    const frames = fps * seconds
    const input: number[] = []
    // Onda cuadrada 10 Hz 0↔1 — 6 frames por ciclo a 60 fps.
    for (let i = 0; i < frames; i++) {
      input.push(i % 6 < 3 ? 1 : 0)
    }
    const { out } = simulateFlashLimiter(input, fps)
    // Ventana sostenida (tras el primer segundo de transient).
    for (let s = 2; s < seconds; s++) {
      const windowOut = out.slice(s * fps, (s + 1) * fps)
      expect(countFlashes(windowOut)).toBeLessThanOrEqual(3)
    }
    // Y la amplitud residual es sub-threshold la mayoría del tiempo.
    const steady = out.slice(fps * 3)
    const maxSteady = Math.max(...steady)
    expect(maxSteady).toBeLessThan(0.45)
  })

  it('capa el slew por frame incluso con presupuesto disponible', () => {
    const input = new Array(120).fill(1)
    const { out } = simulateFlashLimiter(input, 60)
    for (let i = 1; i < out.length; i++) {
      expect(out[i] - out[i - 1]).toBeLessThanOrEqual(
        DEFAULT_FLASH_MAX_DELTA + 1e-6,
      )
    }
  })

  it('un fade legítimo completa sin destruirse (solo se frena)', () => {
    const fps = 60
    const input = new Array(fps * 6).fill(1)
    const { out } = simulateFlashLimiter(input, fps)
    expect(out[out.length - 1]).toBeGreaterThan(0.85)
  })

  it('constantes coherentes con el límite de 3 flashes/s', () => {
    // Sostenido: rate/budget·Δmínimo... rate 0.25 luma/s → 2.5 subidas de
    // 0.1 por segundo recargadas — margen bajo 3/s garantizado.
    expect(FLASH_BUDGET_RATE).toBeLessThan(0.3)
    expect(FLASH_BUDGET).toBeLessThanOrEqual(0.35)
    expect(DEFAULT_MAX_STEPS).toBe(96)
  })
})

// ─────────────────────────── @euclid meta (§4.2 · WAVE 8230 E4) ─────────

import { parseEuclidMeta } from './ShaderAssembler'
import { ORACLE_KIFS_SOURCE, buildOracleKifsAtom } from './atoms/oracleKifs'

describe('E4 — parser @euclid (§4.2)', () => {
  const meta = parseEuclidMeta(ORACLE_KIFS_SOURCE)

  it('extrae name/author/genome/zone/param/steps del Oracle KIFS', () => {
    expect(meta.name).toBe('Oracle KIFS — Hello World Generativo')
    expect(meta.author).toBe('LuxSync')
    expect(meta.genome.aggression).toBeCloseTo(0.55)
    expect(meta.genome.chaos).toBeCloseTo(0.6)
    expect(meta.genome.organicity).toBeCloseTo(0.45)
    expect(meta.zone).toEqual({ from: 'gentle', to: 'peak' })
    expect(meta.steps).toBe(96)
  })

  it('el param u_twist se parsea con tipo, rango, default y label', () => {
    const p = meta.params.find((x) => x.name === 'u_twist')
    expect(p).toBeDefined()
    expect(p!.type).toBe('float')
    expect(p!.min).toBe(0)
    expect(p!.max).toBe(2)
    expect(p!.defaultValue).toBeCloseTo(0.6)
    expect(p!.label).toBe('Twist')
  })

  it('robusto: líneas malformadas nunca lanzan y no rompen lo demás', () => {
    const src = `// @euclid name "X"
// @euclid param broken
// @euclid param u_ok float 0 1 0.5
// @euclid steps nope
// @euclid zone gentle..
void mainImage(out vec4 c, in vec2 fragCoord) { c = vec4(0.0); }`
    const m = parseEuclidMeta(src)
    expect(m.name).toBe('X')
    expect(m.params).toHaveLength(1)
    expect(m.params[0].name).toBe('u_ok')
    expect(m.params[0].label).toBe('u_ok') // sin label → nombre del uniform
    expect(m.steps).toBeUndefined()
    expect(m.zone).toBeUndefined()
  })
})

describe('E4 — Oracle KIFS como átomo generativo', () => {
  it('la fuente §5 ensambla completa (preámbulo + cuerpo + epílogo)', () => {
    // El caller (worker) resuelve steps = meta.steps ?? parseStepsHint(src)
    const steps = parseStepsHint(ORACLE_KIFS_SOURCE) ?? DEFAULT_MAX_STEPS
    const a = assembleFragmentShader(ORACLE_KIFS_SOURCE, steps)
    expect(a.fragSource).toContain(
      'void mainImage(out vec4 fragColor, in vec2 fragCoord)',
    )
    expect(a.fragSource).toContain('mapFractal')
    // u_twist la declara el artista — una sola vez en todo el programa
    const decls = a.fragSource.match(/uniform\s+float\s+u_twist\s*;/g)
    expect(decls).toHaveLength(1)
    // MAX_STEPS viene del header @euclid steps 96
    expect(steps).toBe(96)
    expect(a.fragSource).toContain('#define MAX_STEPS 96')
  })

  it('buildOracleKifsAtom produce un ITheiaAtom kind=shader válido', () => {
    const atom = buildOracleKifsAtom()
    expect(atom.id).toBe('oracle_kifs')
    expect(atom.packId).toBe('euclid-oracle')
    expect(atom.source?.kind).toBe('shader')
    expect(atom.source?.glsl).toBe(ORACLE_KIFS_SOURCE)
    // ADN derivado del propio header @euclid (genoma + zona)
    expect(atom.aggression).toBeCloseTo(0.55)
    expect(atom.energyZone.min).toBe('gentle')
    expect(atom.energyZone.max).toBe('peak')
    expect(atom.validSections.length).toBeGreaterThan(0)
    expect(atom.trim.endMs).toBeGreaterThan(atom.trim.startMs + 250)
  })
})

// ─────────────────── WAVE 8232 · G0 — motor de ruido (H2) ───────────────────

describe('G0 — noise3() del preámbulo es value noise continuo (H2)', () => {
  const pre = buildPreamble()

  it('la implementación es trilineal de 8 esquinas sobre la retícula', () => {
    expect(pre).toContain('float hash31(vec3 p)')
    // 8 esquinas de celda hasheadas (n000…n111).
    for (const c of ['n000', 'n100', 'n010', 'n110', 'n001', 'n101', 'n011', 'n111']) {
      expect(pre).toContain(`float ${c} = hash31(`)
    }
    // Guardia de regresión: el patrón roto hasheaba coords continuas.
    expect(pre).not.toContain('hash21(uv + vec2(37.0, 239.0))')
  })

  /**
   * Espejo exacto del GLSL del preámbulo (hash31 + noise3). Si el shader
   * cambia, este espejo debe reflejarlo — igual que el test del limitador.
   */
  const fract = (x: number) => x - Math.floor(x)
  function hash31(px: number, py: number, pz: number): number {
    let x = fract(px * 0.1031)
    let y = fract(py * 0.103)
    let z = fract(pz * 0.0973)
    const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33)
    x += d; y += d; z += d
    return fract((x + y) * z)
  }
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  function noise3(px: number, py: number, pz: number): number {
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz)
    let fx = px - ix, fy = py - iy, fz = pz - iz
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    fz = fz * fz * (3 - 2 * fz)
    const n000 = hash31(ix, iy, iz)
    const n100 = hash31(ix + 1, iy, iz)
    const n010 = hash31(ix, iy + 1, iz)
    const n110 = hash31(ix + 1, iy + 1, iz)
    const n001 = hash31(ix, iy, iz + 1)
    const n101 = hash31(ix + 1, iy, iz + 1)
    const n011 = hash31(ix, iy + 1, iz + 1)
    const n111 = hash31(ix + 1, iy + 1, iz + 1)
    return (
      mix(
        mix(mix(n000, n100, fx), mix(n010, n110, fx), fy),
        mix(mix(n001, n101, fx), mix(n011, n111, fx), fy),
        fz,
      ) * 2 - 1
    )
  }

  it('produce valores CONTINUOS: un paso de 1e-3 no puede saltar (xy incluido)', () => {
    // El bug H2: hash sobre coords continuas → ruido blanco en x,y —
    // |Δ| era O(0.3) para pasos de 1e-3. Con trilineal el peor slope es
    // ~3 por unidad → |Δ| ≤ ~0.005. Usamos 0.02 como cota holgada.
    const e = 1e-3
    const rng = (s: number) => fract(Math.sin(s * 127.1) * 43758.5453) * 8 - 4
    for (let k = 0; k < 64; k++) {
      const x = rng(k + 1), y = rng(k + 71), z = rng(k + 133)
      for (const [dx, dy, dz] of [[e, 0, 0], [0, e, 0], [0, 0, e]] as const) {
        expect(Math.abs(noise3(x + dx, y + dy, z + dz) - noise3(x, y, z))).toBeLessThan(0.02)
      }
    }
  })

  it('un barrido denso no tiene discontinuidades ni NaN', () => {
    let prev = noise3(-4, 1.3, -2.7)
    for (let i = 1; i <= 2000; i++) {
      const v = noise3(-4 + i * 0.004, 1.3, -2.7)
      expect(Number.isFinite(v)).toBe(true)
      expect(Math.abs(v - prev)).toBeLessThan(0.05)
      prev = v
    }
  })

  it('rango acotado [-1,1] y con varianza real (no constante)', () => {
    let min = Infinity, max = -Infinity, sum = 0, sum2 = 0, n = 0
    for (let i = 0; i < 4000; i++) {
      const v = noise3((i * 0.731) % 9 - 4.5, (i * 1.317) % 7 - 3.5, (i * 0.517) % 5 - 2.5)
      min = Math.min(min, v); max = Math.max(max, v)
      sum += v; sum2 += v * v; n++
    }
    expect(min).toBeGreaterThanOrEqual(-1 - 1e-6)
    expect(max).toBeLessThanOrEqual(1 + 1e-6)
    // Ruido real: usa el rango y tiene dispersión (no un valor plano).
    expect(max - min).toBeGreaterThan(0.5)
    expect(sum2 / n - (sum / n) ** 2).toBeGreaterThan(0.01)
  })

  it('en nodos de retícula el valor es exactamente el hash (determinista)', () => {
    expect(noise3(3, -2, 7)).toBeCloseTo(hash31(3, -2, 7) * 2 - 1, 10)
    expect(noise3(0, 0, 0)).toBeCloseTo(hash31(0, 0, 0) * 2 - 1, 10)
  })
})

// ───────────────── 🧬 WAVE 8233 · G1 — Gene Parser & Integral Time ─────────────────

describe('G1 — parser @euclid family / seed / gene (Infinite Genome §4.2)', () => {
  const GEN_SRC = `// @euclid name    Tribu Mental
// @euclid family  swarm+conformal
// @euclid seed    123456789
// @euclid genome  aggression=0.75 chaos=0.55
// @euclid gene    G_SYM    struct int   3    9     5    a:+0.3 c:+0.2 o:-0.4
// @euclid gene    G_WARP   expr   float 0.4  2.2   1.25 a:+0.2 c:+0.8 o:+0.3 curve=exp "Warp"
// @euclid gene    G_ZOOM   expr   float 0.05 0.5   0.25 a:+0.6
// @euclid steps   96
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`

  it('family: simple y compuesta (swarm+conformal → array)', () => {
    const meta = parseEuclidMeta(GEN_SRC)
    expect(meta.family).toEqual(['swarm', 'conformal'])
    const single = parseEuclidMeta(
      '// @euclid family ether\n' + 'void mainImage(out vec4 c, in vec2 f){c=vec4(0);}',
    )
    expect(single.family).toEqual(['ether'])
  })

  it('seed: uint32 explícito, auto y canónico 0', () => {
    expect(parseEuclidMeta(GEN_SRC).seed).toBe(123456789)
    expect(
      parseEuclidMeta('// @euclid seed auto\nvoid mainImage(out vec4 c,in vec2 f){c=vec4(0);}').seed,
    ).toBe('auto')
    expect(
      parseEuclidMeta('// @euclid seed 0\nvoid mainImage(out vec4 c,in vec2 f){c=vec4(0);}').seed,
    ).toBe(0)
    expect(
      parseEuclidMeta('// @euclid seed 4294967295\nvoid mainImage(out vec4 c,in vec2 f){c=vec4(0);}').seed,
    ).toBe(4294967295)
  })

  it('seed: rechaza malformados y fuera de uint32 sin lanzar', () => {
    const mk = (s: string) =>
      parseEuclidMeta(`// @euclid seed ${s}\nvoid mainImage(out vec4 c,in vec2 f){c=vec4(0);}`)
    expect(mk('banana').seed).toBeUndefined()
    expect(mk('-1').seed).toBeUndefined()
    expect(mk('4294967296').seed).toBeUndefined()
    expect(mk('').seed).toBeUndefined()
  })

  it('gene: sintaxis completa — clase, tipo, rango, default, afinidades, curve, label', () => {
    const meta = parseEuclidMeta(GEN_SRC)
    expect(meta.genes).toHaveLength(3)
    const g0 = meta.genes[0]
    expect(g0.name).toBe('G_SYM')
    expect(g0.cls).toBe('struct')
    expect(g0.type).toBe('int')
    expect(g0.min).toBe(3)
    expect(g0.max).toBe(9)
    expect(g0.defaultValue).toBe(5)
    expect(g0.affinities).toEqual({ a: 0.3, c: 0.2, o: -0.4 })
    expect(g0.curve).toBe('lin')
    const g1 = meta.genes[1]
    expect(g1.cls).toBe('expr')
    expect(g1.type).toBe('float')
    expect(g1.curve).toBe('exp')
    expect(g1.label).toBe('Warp')
    const g2 = meta.genes[2]
    expect(g2.affinities.o).toBeUndefined()
    expect(g2.label).toBeUndefined()
  })

  it('genes malformados se ignoran sin colgar el hilo y sin corromper el resto', () => {
    const meta = parseEuclidMeta(`// @euclid name   X
// @euclid gene   G_BROKEN struct int          // sin números
// @euclid gene                               // vacío
// @euclid gene   G_OK struct int 1 4 2
// @euclid gene   9BADBAD struct int 1 2 1     // nombre no-G_*: pasa al meta, se filtra al inyectar
// @euclid family ether
// @euclid param  u_x float 0 1 0.5
void mainImage(out vec4 c, in vec2 f) { c = vec4(0.0); }`)
    expect(meta.name).toBe('X')
    expect(meta.family).toEqual(['ether'])
    expect(meta.params).toHaveLength(1)
    expect(meta.genes.map((g) => g.name)).toEqual(['G_OK', '9BADBAD'])
    const resolved = resolveGeneValues(meta)
    expect(resolved).toEqual({ G_OK: 2 }) // el no-G_* no se inyecta
  })
})

describe('G1 — inyección de genes en el ensamblador', () => {
  const BODY = `// @euclid gene G_SYM struct int 3 9 5
#ifndef G_SYM
#define G_SYM 5.0
#endif
void mainImage(out vec4 c, in vec2 f) { c = vec4(G_SYM * 0.1); }`

  it('glslFloatLiteral: fuerza siempre literal float GLSL', () => {
    expect(glslFloatLiteral(5)).toBe('5.0')
    expect(glslFloatLiteral(0)).toBe('0.0')
    expect(glslFloatLiteral(1.25)).toBe('1.25')
    expect(glslFloatLiteral(-0.5)).toBe('-0.5')
    expect(glslFloatLiteral(1e-7)).toBe('1e-7')
    expect(glslFloatLiteral(Number.NaN)).toBe('0.0')
    expect(glslFloatLiteral(Infinity)).toBe('0.0')
  })

  it('resolveGeneValues: defaults ∪ overrides, clamp de rango y redondeo int', () => {
    const meta = parseEuclidMeta(BODY)
    // Sin overrides → defaults declarados.
    expect(resolveGeneValues(meta)).toEqual({ G_SYM: 5 })
    // Override dentro de rango.
    expect(resolveGeneValues(meta, { G_SYM: 7 })).toEqual({ G_SYM: 7 })
    // Clamp a min/max.
    expect(resolveGeneValues(meta, { G_SYM: 99 })).toEqual({ G_SYM: 9 })
    expect(resolveGeneValues(meta, { G_SYM: -3 })).toEqual({ G_SYM: 3 })
    // int redondea.
    expect(resolveGeneValues(meta, { G_SYM: 6.6 })).toEqual({ G_SYM: 7 })
    // Overrides no declarados G_* pasan (forward-compat #ifdef).
    expect(resolveGeneValues(meta, { G_SYM: 5, G_EXTRA: 0.5 })).toEqual({
      G_SYM: 5,
      G_EXTRA: 0.5,
    })
    // Core sin genes y sin overrides → undefined (compila por #ifndef).
    expect(resolveGeneValues(parseEuclidMeta(ARTIST_BODY))).toBeUndefined()
    // Idempotente: un fenotipo ya resuelto como overrides da lo mismo.
    const once = resolveGeneValues(meta, { G_SYM: 7 })
    expect(resolveGeneValues(meta, once)).toEqual(once)
  })

  it('buildGeneDefines: orden estable, float y sanitiza nombres', () => {
    const block = buildGeneDefines({ G_WARP: 1.25, G_SYM: 5 })
    const lines = block.split('\n')
    // Orden alfabético (independiente del insertion order del objeto).
    expect(lines.indexOf('#define G_SYM 5.0')).toBeLessThan(
      lines.indexOf('#define G_WARP 1.25'),
    )
    // Nombres que no son G_* nunca llegan al shader.
    const dirty = buildGeneDefines({ 'evil; uniform': 1, G_OK: 2 } as never)
    expect(dirty).not.toContain('evil')
    expect(dirty).toContain('#define G_OK 2.0')
    expect(buildGeneDefines(undefined)).toBe('')
    expect(buildGeneDefines({})).toBe('')
  })

  it('geneSignature: determinista y sensible a valores', () => {
    const a = geneSignature({ G_WARP: 1.25, G_SYM: 5 })
    const b = geneSignature({ G_SYM: 5, G_WARP: 1.25 }) // orden distinto
    expect(a).toBe(b)
    expect(a).toBe('G_SYM=5.0;G_WARP=1.25')
    expect(geneSignature({ G_SYM: 6 })).not.toBe(geneSignature({ G_SYM: 5 }))
    expect(geneSignature(undefined)).toBe('')
  })

  it('assemble inyecta #define entre preámbulo y cuerpo, y cuenta en preambleLines', () => {
    const asm = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS, { G_SYM: 7 })
    const defIdx = asm.fragSource.indexOf('#define G_SYM 7.0')
    const bodyIdx = asm.fragSource.indexOf('void mainImage')
    expect(defIdx).toBeGreaterThan(0)
    expect(defIdx).toBeLessThan(bodyIdx)
    // El #ifndef del cuerpo queda DOMINADO por el define inyectado:
    // el fallback del artista no compite (G_SYM ya existe).
    expect(asm.fragSource.indexOf('#ifndef G_SYM')).toBeGreaterThan(defIdx)
    // preambleLines = preámbulo + bloque gen → errores remapean al artista.
    const preLines = buildPreamble(DEFAULT_MAX_STEPS).split('\n').length
    expect(asm.preambleLines).toBeGreaterThan(preLines)
    const lines = asm.fragSource.split('\n')
    expect(lines[asm.preambleLines]).toContain('// @euclid gene') // 1ª línea del cuerpo
    // Sin genes: bloque vacío, preambleLines = preámbulo puro.
    const noGenes = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS)
    expect(noGenes.fragSource).not.toContain('GENOMA inyectado')
    expect(noGenes.preambleLines).toBe(preLines)
  })

  it('el hash del programa cambia con los genes (programKey = fuente ensamblada)', () => {
    const v5 = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS, { G_SYM: 5 })
    const v7 = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS, { G_SYM: 7 })
    const v7b = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS, { G_SYM: 7 })
    expect(hashSource(v5.fragSource)).not.toBe(hashSource(v7.fragSource))
    expect(hashSource(v7.fragSource)).toBe(hashSource(v7b.fragSource))
    // Un gen struct distinto = fenotipo distinto = otro programa LRU.
    const expr = assembleFragmentShader(BODY, DEFAULT_MAX_STEPS, {
      G_SYM: 7,
      G_EXTRA: 0.5,
    })
    expect(hashSource(expr.fragSource)).not.toBe(hashSource(v7.fragSource))
  })
})

describe('G1 — alias de relojes integrales en el preámbulo', () => {
  it('u_energyTime y u_barCount salen del schema como macros u_tel[]', () => {
    const pre = buildPreamble()
    expect(pre).toContain('#define u_energyTime')
    expect(pre).toContain('#define u_barCount')
    // Índice = slot − SLOT_PAYLOAD_BASE (58→54, 59→55), nunca a mano.
    const etSlot = TELEMETRY_SCHEMA.find((d) => d.name === 'ENERGY_TIME')!
    const bcSlot = TELEMETRY_SCHEMA.find((d) => d.name === 'BAR_COUNT')!
    expect(pre).toContain(`u_tel[${etSlot.slot - SLOT_PAYLOAD_BASE}]`)
    expect(pre).toContain(`u_tel[${bcSlot.slot - SLOT_PAYLOAD_BASE}]`)
  })
})

// ───────────── 🧬 WAVE 8235 · G3 — Uniform Genes & Crossover ─────────────

describe('G3 — genes `expr` → u_gene[8] (§4.2 v2)', () => {
  const BODY3 = `// @euclid gene G_SYM  struct int   3   9    5    a:+0.3
// @euclid gene G_WARP expr   float 0.4 2.2  1.25 curve=exp
// @euclid gene G_ZOOM expr   float 0.05 0.5  0.25 a:+0.6
#ifndef G_SYM
#define G_SYM 5.0
#endif
void mainImage(out vec4 c, in vec2 f) { c = vec4(G_SYM * G_WARP * G_ZOOM); }`

  it('el preámbulo declara siempre `uniform float u_gene[8]`', () => {
    expect(buildPreamble()).toContain('uniform float u_gene[8];')
  })

  it('layoutExprGenes: solo `expr`, orden de declaración, cap 8', () => {
    const meta = parseEuclidMeta(BODY3)
    expect(layoutExprGenes(meta)).toEqual(['G_WARP', 'G_ZOOM'])
    // G_SYM es `struct` → nunca entra al array.
    expect(layoutExprGenes(meta)).not.toContain('G_SYM')
  })

  it('buildGeneDefines: `expr` → u_gene[k] (texto constante), `struct` → literal', () => {
    const meta = parseEuclidMeta(BODY3)
    const exprGenes = layoutExprGenes(meta)
    const block = buildGeneDefines(
      { G_SYM: 7, G_WARP: 2.0, G_ZOOM: 0.4 },
      exprGenes,
    )
    expect(block).toContain('#define G_SYM 7.0')
    expect(block).toContain('#define G_WARP u_gene[0]')
    expect(block).toContain('#define G_ZOOM u_gene[1]')
    // El literal del expr NO aparece — el valor vive en el uniform.
    expect(block).not.toContain('#define G_WARP 2.0')
    expect(block).not.toContain('#define G_ZOOM 0.4')
  })

  it('programKey NO cambia al mutar un gen `expr` (§4.6 — sin recompilar)', () => {
    const meta = parseEuclidMeta(BODY3)
    const exprGenes = layoutExprGenes(meta)
    const a = assembleFragmentShader(
      BODY3,
      DEFAULT_MAX_STEPS,
      { G_SYM: 5, G_WARP: 1.25, G_ZOOM: 0.25 },
      exprGenes,
    )
    const b = assembleFragmentShader(
      BODY3,
      DEFAULT_MAX_STEPS,
      { G_SYM: 5, G_WARP: 2.1, G_ZOOM: 0.49 },
      exprGenes,
    )
    // Misma programKey — mismo binario, distinto u_gene (fast-path).
    expect(hashSource(a.fragSource)).toBe(hashSource(b.fragSource))
    // …pero un `struct` distinto SÍ produce otro programa (LRU).
    const c = assembleFragmentShader(
      BODY3,
      DEFAULT_MAX_STEPS,
      { G_SYM: 7, G_WARP: 1.25, G_ZOOM: 0.25 },
      exprGenes,
    )
    expect(hashSource(c.fragSource)).not.toBe(hashSource(a.fragSource))
  })

  it('exprGeneValues: orden = layout, valores resueltos, huecos a 0', () => {
    const meta = parseEuclidMeta(BODY3)
    const exprGenes = layoutExprGenes(meta)
    const arr = exprGeneValues(exprGenes, { G_WARP: 2.0, G_ZOOM: 0.5 })
    expect(arr.length).toBe(EUCLID_GENE_SLOTS)
    expect(arr[0]).toBeCloseTo(2.0)
    expect(arr[1]).toBeCloseTo(0.5)
    expect(arr[2]).toBe(0) // hueco libre
    // out reutilizable — zero-alloc.
    const reuse = new Float32Array(8)
    expect(exprGeneValues(exprGenes, { G_WARP: 1 }, reuse)).toBe(reuse)
    expect(reuse[0]).toBe(1)
    // Gen no resuelto → 0 (el host siempre empuja el fenotipo completo).
    const sparse = exprGeneValues(exprGenes, {})
    expect(sparse[0]).toBe(0)
  })

  it('structGenesDiffer: detecta cambio struct, ignora expr', () => {
    const meta = parseEuclidMeta(BODY3)
    const a = { G_SYM: 5, G_WARP: 1.0 }
    const b = { G_SYM: 5, G_WARP: 2.2 } // solo expr cambia
    const c = { G_SYM: 8, G_WARP: 1.0 } // struct cambia
    expect(structGenesDiffer(meta, a, b)).toBe(false)
    expect(structGenesDiffer(meta, a, c)).toBe(true)
  })
})

// ─────────────────── 🧬 WAVE 8237 · G5/G6 — Materia Viva & euChannels ──

describe('G5 — estado persistente float (§9·G5)', () => {
  const SIM_BODY = `void mainState(out vec4 s, in vec2 fragCoord) {
  vec2 px = fragCoord / u_resolution.xy;
  vec4 prev = texture(u_state, px);
  s = u_stateInit > 0.5 ? vec4(px, 0.0, 1.0) : prev * 0.999;
}
void mainImage(out vec4 c, in vec2 fragCoord) {
  c = texture(u_state, fragCoord / u_resolution.xy);
}`

  it('el preámbulo declara u_state + u_stateInit (contrato G5)', () => {
    const pre = buildPreamble()
    expect(pre).toContain('uniform sampler2D u_state;')
    expect(pre).toContain('uniform float     u_stateInit;')
  })

  it('hasMainState detecta el pase de simulación y rechaza mainImage-only', () => {
    expect(hasMainState(SIM_BODY)).toBe(true)
    expect(hasMainState('void mainState(out vec4 s,in vec2 f){}')).toBe(true)
    expect(hasMainState(ARTIST_BODY)).toBe(false)
    expect(hasMainState('float mainState(vec4 s) { return 0.0; }')).toBe(false)
  })

  it('assembleSimFragmentShader: epílogo crudo — sin masters ni sRGB', () => {
    const sim = assembleSimFragmentShader(SIM_BODY)
    const vis = assembleFragmentShader(SIM_BODY)
    // La sim llama a mainState; el visual a mainImage.
    expect(sim.fragSource).toContain('mainState(fragColor, gl_FragCoord.xy)')
    expect(vis.fragSource).toContain('mainImage(col, gl_FragCoord.xy)')
    // El epílogo de simulación NO mutila el estado: ni masters, ni
    // crossfade, ni limitador, ni conversión sRGB (linealidad §9·G5).
    const simEpilogue = sim.fragSource.slice(
      sim.fragSource.indexOf('void main()'),
    )
    expect(simEpilogue).not.toContain('u_brightness')
    expect(simEpilogue).not.toContain('u_blend')
    expect(simEpilogue).not.toContain('u_flashGuard')
    expect(simEpilogue).not.toContain('pow(')
    // …pero comparte preámbulo completo (telemetría + u_state + u_gene).
    expect(sim.fragSource).toContain('uniform float u_tel[124];')
    expect(sim.fragSource).toContain('uniform sampler2D u_state;')
    expect(sim.fragSource).toContain(`uniform float u_gene[${EUCLID_GENE_SLOTS}];`)
    // Programas DISTINTOS: la sim nunca colisiona con el visual en la LRU.
    expect(hashSource(sim.fragSource)).not.toBe(hashSource(vis.fragSource))
  })

  it('buildSimEpilogue es la única salida — escribe el estado tal cual', () => {
    const ep = buildSimEpilogue()
    expect(ep).toContain('void main() {')
    expect(ep).toContain('mainState(fragColor, gl_FragCoord.xy);')
    expect(ep).not.toContain('mainImage')
  })

  it('los genes se propagan al pase de simulación (mismo fenotipo)', () => {
    const sim = assembleSimFragmentShader(
      SIM_BODY,
      DEFAULT_MAX_STEPS,
      { G_SYM: 7, G_WARP: 2.0 },
      ['G_WARP'],
    )
    expect(sim.fragSource).toContain('#define G_SYM')
    expect(sim.fragSource).toContain('#define G_WARP u_gene[0]')
  })
})

describe('G6 — euChannels: biblioteca estándar de canales (§3.1)', () => {
  const pre = buildPreamble()

  it('el preámbulo inyecta euChannels() con la firma canónica', () => {
    expect(pre).toContain(
      'void euChannels(out float tc, out float td, out float glitch,\n' +
        '                out float live, out float groove) {',
    )
  })

  it('los canales se derivan de las fuentes estándar (idénticos en todos los cores)', () => {
    // tc/td: curva perceptual u_approach² + rama breakdown (u_enums.y == 3).
    expect(pre).toContain('u_enums.y == 3')
    expect(pre).toContain('u_approach * u_approach')
    // glitch: compuerta APOCALYPSE × harshness.
    expect(pre).toContain('APOCALYPSE ? u_harshness : 0.0')
    // live/groove: AUDIO_LIVE / PLL_LOCKED × beatConfidence.
    expect(pre).toContain('AUDIO_LIVE ? 1.0 : 0.3')
    expect(pre).toContain('PLL_LOCKED ? u_beatConfidence : 0.25')
  })

  it('el shader de referencia Oracle KIFS consume euChannels (§6, G6)', () => {
    expect(ORACLE_KIFS_SOURCE).toContain('euChannels(g_tc, g_td, g_glitch')
    expect(ORACLE_KIFS_SOURCE).not.toContain('telFlag(9)') // glitch a mano → canal
    const asm = assembleFragmentShader(ORACLE_KIFS_SOURCE)
    expect(asm.fragSource).toContain('void euChannels(')
    expect(asm.fragSource).toContain('euChannels(g_tc, g_td, g_glitch, g_live, g_groove)')
  })
})

// ─────────────────── 🧠 WAVE 8275 — Cognitive payload (Selene V3) ───────────────────

describe('WAVE 8275 — cognitive payload contract', () => {
  const pre = buildPreamble()

  it('los 5 escalares de Iliquidcore salen del schema como macros u_tel[]', () => {
    const S = (n: string) => TELEMETRY_SCHEMA.find((d) => d.name === n)!
    expect(pre).toContain(`#define u_epicness`)
    expect(pre).toContain(`u_tel[${S('EPICNESS').slot - SLOT_PAYLOAD_BASE}]`)
    expect(pre).toContain(`#define u_vaporPressure`)
    expect(pre).toContain(`u_tel[${S('VAPOR_PRESSURE').slot - SLOT_PAYLOAD_BASE}]`)
    expect(pre).toContain(`#define u_percussiveness`)
    expect(pre).toContain(`u_tel[${S('PERCUSSIVENESS').slot - SLOT_PAYLOAD_BASE}]`)
    expect(pre).toContain(`#define u_melodicity`)
    expect(pre).toContain(`u_tel[${S('MELODICITY').slot - SLOT_PAYLOAD_BASE}]`)
    expect(pre).toContain(`#define u_crestRate`)
    expect(pre).toContain(`u_tel[${S('CREST_RATE').slot - SLOT_PAYLOAD_BASE}]`)
    // Slots exactos del blueprint 8275 (índices absolutos del anillo).
    expect(S('EPICNESS').slot).toBe(43)
    expect(S('VAPOR_PRESSURE').slot).toBe(60)
    expect(S('PERCUSSIVENESS').slot).toBe(61)
    expect(S('MELODICITY').slot).toBe(62)
    expect(S('CREST_RATE').slot).toBe(63)
  })

  it('los derivados de eventos son uniforms reales (no macros u_tel)', () => {
    expect(pre).toContain('uniform float u_crestPulse;')
    expect(pre).toContain('uniform float u_strobeGate;')
    expect(pre).toContain('uniform float u_glassBreak;')
  })

  it('los flags soberanos generan macros telFlag(bit)', () => {
    expect(pre).toContain('CREST_EVENT')
    expect(pre).toContain('telFlag(13)')
    expect(pre).toContain('STROBE_ACTIVE')
    expect(pre).toContain('telFlag(14)')
    expect(pre).toContain('SOVEREIGN_COUNTDOWN')
    expect(pre).toContain('telFlag(15)')
    expect(pre).toContain('GLASS_BREAK')
    expect(pre).toContain('telFlag(16)')
  })

  it('el contrato queda disponible en un shader de artista ensamblado', () => {
    const asm = assembleFragmentShader(
      `void mainImage(out vec4 c, in vec2 fragCoord) {
        vec2 uv = fragCoord / u_resolution.xy;
        float fog = u_vaporPressure * 0.5 + u_epicness * 0.3;
        fog += u_crestPulse * 0.4 + u_glassBreak;
        c = vec4(vec3(fog * u_strobeGate + u_crestRate * 0.01), 1.0);
      }`,
    )
    expect(asm.fragSource).toContain('uniform float u_crestPulse;')
    expect(asm.fragSource).toContain('#define u_vaporPressure')
    // WAVE 8278 · F1 — el payload creció a 124 floats (página B); el
    // preámbulo lo deriva de TELEMETRY_PAYLOAD_SLOTS.
    expect(asm.fragSource).toContain('uniform float u_tel[124];')
  })
})
