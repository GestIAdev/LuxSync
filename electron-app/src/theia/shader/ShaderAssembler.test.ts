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
  buildEpilogue,
  buildPreamble,
  hasMainImage,
  hashSource,
  parseStepsHint,
  remapShaderLog,
  BLIT_FRAG_SRC,
  FLASH_STATS_FRAG_SRC,
  DEFAULT_MAX_STEPS,
  DEFAULT_FLASH_MAX_DELTA,
  FLASH_BUDGET,
  FLASH_BUDGET_RATE,
  EUCLID_GLSL_VERSION,
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
      'uniform float u_tel[60];',
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
