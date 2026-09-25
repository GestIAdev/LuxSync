/**
 * ShaderAssembler.ts — Euclid Oracle · Fase E3 (Shader Contract & Assembler)
 *
 * Ensamblador runtime de fragment shaders de artistas (blueprint §4.1):
 *
 *   ┌ PREÁMBULO (generado) ─ #version 300 es · precision · uniforms
 *   │   estándar · u_tel[60] + macros schema · flags · derivados ·
 *   │   aliases Shadertoy · librería Euclid · MAX_STEPS
 *   ├ CUERPO (artista) ─ void mainImage(out vec4 c, in vec2 fragCoord)
 *   └ EPÍLOGO (generado) ─ main(): mainImage → masters → crossfade →
 *       limitador fotosensible → clamp+sRGB
 *
 * Módulo PURO (sin GL): el worker lo consume para compilar y los tests lo
 * certifican en Node. La numeración de macros NUNCA se escribe a mano —
 * se deriva de TELEMETRY_SCHEMA (índice = slot − 4), igual que §3.5.
 */

import {
  SLOT_PAYLOAD_BASE,
  TELEMETRY_PAYLOAD_SLOTS,
  TELEMETRY_SCHEMA,
  TEL_FLAG,
  SCHEMA_VERSION,
} from '../telemetry/TheiaTelemetryRing'

// ─────────────────────────── Constantes §4 ───────────────────────────

export const EUCLID_GLSL_VERSION = '#version 300 es'
export const DEFAULT_MAX_STEPS = 96
/** Delta máximo de luminancia media por frame (limitador fotosensible §4.6)
 *  — slew-rate instantáneo del presupuesto de flash. */
export const DEFAULT_FLASH_MAX_DELTA = 0.06
/** Presupuesto leaky-bucket de luminancia ascendente (unidades de luma).
 *  Un "flash" WCAG exige una excursión ≥0.1: con 0.30 de presupuesto una
 *  señal estroboscópica solo puede entregar ~3 subidas grandes antes de
 *  agotarlo — cumple "nunca más de 3 flashes/s" (§4.6, test §7). */
export const FLASH_BUDGET = 0.3
/** Recarga del presupuesto (luma/segundo): tasa sostenida ≤ ~2.5 subidas
 *  grandes por segundo — por debajo del límite de 3 flashes/s. */
export const FLASH_BUDGET_RATE = 0.25

// ─────────────────────────── Vertex (compartido) ───────────────────────────

/** VS ES 3.00 para programas generativos — fullscreen triangle, sin varyings
 *  (el epílogo usa gl_FragCoord directamente). */
export const GEN_VERTEX_SRC = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/** VS ES 3.00 para el blit FBO→canvas (passthrough con uv). */
export const BLIT_VERTEX_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

export const BLIT_FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}
`

/**
 * Pass de estadística fotosensible — dibuja 1×1: calcula la media de
 * luminancia del frame renderizado (grid 8×8 sobre la textura de escena,
 * sin mipmaps) y actualiza el presupuesto leaky-bucket del limitador.
 *
 *   entrada: r = luminancia media del frame anterior (output clampado)
 *            g = presupuesto restante normalizado (0..1 × u_flashBudget)
 *   salida:  { r=mean, g=budgetNorm } — se ping-ponga entre dos texturas.
 */
export const FLASH_STATS_FRAG_SRC = `#version 300 es
precision highp float;
uniform sampler2D u_scene;      // frame actual (post-epílogo, FBO escalado)
uniform sampler2D u_statsPrev;  // texel previo {mean, budgetNorm}
uniform float u_dt;             // segundos desde el frame anterior
uniform float u_flashBudget;    // presupuesto total (luma)
uniform float u_budgetRate;     // recarga (luma/s)
out vec4 fragColor;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
void main() {
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 8; x++) {
      acc += texture(u_scene, (vec2(float(x), float(y)) + 0.5) / 8.0).rgb;
    }
  }
  float mean = dot(acc * (1.0 / 64.0), LUMA);
  vec4 prev = texture(u_statsPrev, vec2(0.5));
  float budget = min(u_flashBudget, prev.g * u_flashBudget + u_dt * u_budgetRate);
  budget = max(0.0, budget - max(0.0, mean - prev.r));
  fragColor = vec4(mean, budget / u_flashBudget, 0.0, 1.0);
}
`

// ─────────────────────────── Preámbulo ───────────────────────────

/**
 * Genera el preámbulo completo. Las macros de telemetría se derivan de
 * `TELEMETRY_SCHEMA` (descriptor único — §3.5: si el layout cambia, el
 * preámbulo se regenera con él, y `schemaVersion` lo anuncia en u_enums).
 */
export function buildPreamble(maxSteps = DEFAULT_MAX_STEPS): string {
  const lines: string[] = [
    EUCLID_GLSL_VERSION,
    'precision highp float;',
    'precision highp int;',
    '',
    `// ── Euclid Oracle · preámbulo generado (schema v${SCHEMA_VERSION}) ──`,
    '// u_tel[i] = slot i+4 del anillo — una sola subida uniform1fv.',
    `uniform float u_tel[${TELEMETRY_PAYLOAD_SLOTS}];`,
    'uniform int   u_flags;',
    'uniform ivec4 u_enums; // x=schema y=predictionType z=huntState w=energyZone',
    '',
    '// Reloj de render + derivados del oráculo (§3.4)',
    'uniform float u_time;',
    'uniform float u_dt;',
    'uniform vec3  u_resolution;',
    'uniform float u_beatTime;',
    'uniform float u_kickPulse;',
    'uniform float u_snarePulse;',
    'uniform float u_predictiveETA;',
    'uniform float u_approach;',
    'uniform float u_impact;',
    '// Masters UI + seguridad (epílogo)',
    'uniform float u_brightness;',
    'uniform float u_contrast;',
    'uniform float u_blackout;',
    'uniform float u_renderScale;',
    '// Frame previo (crossfade) + estado fotosensible {mean,budget}',
    'uniform sampler2D u_prevFrame;',
    'uniform sampler2D u_flashState;',
    'uniform float u_hasPrev;',
    'uniform float u_blend;',
    'uniform float u_flashGuard;',
    'uniform float u_flashMaxDelta;',
    'uniform float u_flashBudget;',
    '',
    '// Aliases Shadertoy — compat estructural con el ecosistema (§4.1)',
    '#define iTime       u_time',
    '#define iResolution u_resolution',
    '#define iFrameRate  (1.0 / max(u_dt, 1e-4))',
    '',
    'out vec4 fragColor;',
    '',
    '// ── Macros de telemetría (generadas desde TELEMETRY_SCHEMA) ──',
  ]

  for (const d of TELEMETRY_SCHEMA) {
    if (d.uniform.length === 0) continue // reservados/wire — sin macro
    lines.push(`#define ${d.uniform.padEnd(20)} u_tel[${d.slot - SLOT_PAYLOAD_BASE}]`)
  }
  // Macro función del chromagrama (§3.5): 12 bins contiguos C→B.
  const chromaBase =
    (TELEMETRY_SCHEMA.find((d) => d.name === 'CHROMA_0')?.slot ?? 44) -
    SLOT_PAYLOAD_BASE
  lines.push(`#define u_chroma(i)          u_tel[${chromaBase} + int(i)]`)
  lines.push('')

  lines.push('// ── Flags (bitfield u_flags) ──')
  lines.push('bool telFlag(int bit) { return ((u_flags >> bit) & 1) == 1; }')
  for (const [name, bit] of Object.entries(TEL_FLAG)) {
    lines.push(`#define ${name.padEnd(18)} telFlag(${bit})`)
  }
  lines.push('')

  lines.push('// ── Librería Euclid (§4.1 — cero coste si no se usa) ──')
  lines.push(
    'mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }',
    'vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {',
    '  return a + b * cos(6.28318 * (c * t + d)); // IQ cosine palette',
    '}',
    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(234.34, 435.345));',
    '  p += dot(p, p + 34.23);',
    '  return fract(p.x * p.y);',
    '}',
    'float hash31(vec3 p) {',
    '  // Hoskins — hash 3D→1D sin senos (estable en highp)',
    '  p = fract(p * vec3(0.1031, 0.1030, 0.0973));',
    '  p += dot(p, p.yzx + 33.33);',
    '  return fract((p.x + p.y) * p.z);',
    '}',
    'float noise3(vec3 p) {',
    '  // WAVE 8232 · G0 (H2) — value noise TRILINEAL C1 en [-1,1]: las 8',
    '  // esquinas hasheadas sobre la retícula entera + smoothstep. El truco',
    '  // IQ original interpolaba vía textura bilineal; con hash sobre',
    '  // coords continuas era ruido blanco en xy (fBm → flicker).',
    '  vec3 i = floor(p);',
    '  vec3 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float n000 = hash31(i);',
    '  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));',
    '  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));',
    '  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));',
    '  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));',
    '  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));',
    '  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));',
    '  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));',
    '  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),',
    '             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z) * 2.0 - 1.0;',
    '}',
    'float sdSphere(vec3 p, float r) { return length(p) - r; }',
    'float sdBox(vec3 p, vec3 b) {',
    '  vec3 q = abs(p) - b;',
    '  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);',
    '}',
    'float sdTorus(vec3 p, vec2 t) {',
    '  vec2 q = vec2(length(p.xz) - t.x, p.y);',
    '  return length(q) - t.y;',
    '}',
    'float smin(float a, float b, float k) {',
    '  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);',
    '  return mix(b, a, h) - k * h * (1.0 - h);',
    '}',
    'vec3 opRep(vec3 p, vec3 c) { return mod(p + 0.5 * c, c) - 0.5 * c; }',
    '',
    `// Governor — techo de iteraciones para raymarching (§4.5, hint @euclid)`,
    `#define MAX_STEPS ${Math.max(8, Math.floor(maxSteps))}`,
    '',
  )
  return lines.join('\n')
}

// ─────────────────────────── Epílogo (§4.6 — no negociable) ───────────────────────────

/**
 * Epílogo de seguridad: masters → crossfade → limitador fotosensible →
 * clamp + sRGB. El artista NO puede desactivarlo — solo un flag de
 * operador (u_flashGuard, theia:set-uniform) apaga el limitador.
 */
export function buildEpilogue(): string {
  const lines: string[] = [
    '',
    '// ── EPÍLOGO DE SEGURIDAD (generado — §4.6, no negociable) ──',
    'const vec3 EU_LUMA = vec3(0.2126, 0.7152, 0.0722);',
    'void main() {',
    '  vec4 col;',
    '  mainImage(col, gl_FragCoord.xy);',
    '  vec3 c = col.rgb;',
    '',
    '  // Masters de UI (aplican a todo, siempre) — §4.6',
    '  c = (c - 0.5) * u_contrast + 0.5;',
    '  c *= u_brightness;',
    '  c *= 1.0 - u_blackout;',
    '',
    '  // Crossfade con el frame previo (u_blend 0→1, mecanismo 8207)',
    '  vec2 st = gl_FragCoord.xy / u_resolution.xy;',
    '  if (u_hasPrev > 0.5) {',
    '    vec3 prev = texture(u_prevFrame, st).rgb;',
    '    c = mix(prev, c, clamp(u_blend, 0.0, 1.0));',
    '  }',
    '',
    '  // Limitador fotosensible (WCAG 2.3.1 — ≤3 flashes/s campo amplio):',
    '  // u_flashState.r = luminancia media del frame previo; g = presupuesto',
    '  // restante (leaky-bucket). El cap dinámico min(maxDelta, presupuesto)',
    '  // agota las subidas grandes: una estrobo sostenida solo puede emitir',
    '  // ~3 excursiones ≥0.1 antes de que el presupuesto mande.',
    '  if (u_flashGuard > 0.5 && u_hasPrev > 0.5) {',
    '    vec4 fs = texture(u_flashState, vec2(0.5));',
    '    float prevMean = fs.r;',
    '    float remaining = fs.g * u_flashBudget;',
    '    float cap = prevMean + min(u_flashMaxDelta, remaining);',
    '    float cur = dot(c, EU_LUMA);',
    '    if (cur > cap) c *= cap / max(cur, 1e-4);',
    '  }',
    '',
    '  // Clamp final + conversión sRGB',
    '  fragColor = vec4(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);',
    '}',
  ]
  return lines.join('\n')
}

// ─────────────────────────── Ensamblado ───────────────────────────

export interface AssembledShader {
  /** Fuente final compilable (preámbulo + genoma + cuerpo + epílogo). */
  fragSource: string
  /** Líneas generadas ANTES del cuerpo (preámbulo + bloque G_* inyectado)
   *  — resta para mapear errores al código artista. */
  preambleLines: number
  /** Líneas del cuerpo del artista. */
  bodyLines: number
}

/** Nombre de gen inyectable — contrato `G_*` del Infinite Genome §4.2. */
const GENE_NAME_RE = /^G_[A-Za-z0-9_]+$/

/**
 * Literal float GLSL — los genes se inyectan SIEMPRE como float (§4.2:
 * un `struct int` va redondeado pero como literal `7.0`). La notación
 * exponencial de JS (`1e-7`) ya es un literal float GLSL válido.
 */
export function glslFloatLiteral(v: number): string {
  if (!Number.isFinite(v)) return '0.0'
  const s = `${v}`
  if (/[eE]/.test(s)) return s
  return s.includes('.') ? s : `${s}.0`
}

/**
 * 🧬 WAVE 8233 · G1 — bloque `#define G_*` inyectado tras el preámbulo
 * (Infinite Genome §4.2). Orden de claves estable → hash estable.
 */
export function buildGeneDefines(genes?: Record<string, number>): string {
  if (!genes) return ''
  const keys = Object.keys(genes)
    .filter((k) => GENE_NAME_RE.test(k))
    .sort()
  if (keys.length === 0) return ''
  const lines = [
    '',
    '// ── GENOMA inyectado · @euclid gene → #define (Infinite Genome §4.2) ──',
  ]
  for (const k of keys) lines.push(`#define ${k} ${glslFloatLiteral(genes[k])}`)
  return lines.join('\n')
}

/**
 * Firma canónica del fenotipo (`G_A=1.0;G_B=2.5`) — dedupe de variantes
 * y parte del `programKey`: dos genomas idénticos → misma firma.
 */
export function geneSignature(genes?: Record<string, number>): string {
  if (!genes) return ''
  return Object.keys(genes)
    .filter((k) => GENE_NAME_RE.test(k))
    .sort()
    .map((k) => `${k}=${glslFloatLiteral(genes[k])}`)
    .join(';')
}

export function assembleFragmentShader(
  artistBody: string,
  maxSteps = DEFAULT_MAX_STEPS,
  genes?: Record<string, number>,
): AssembledShader {
  const preamble = buildPreamble(maxSteps)
  // 🧬 WAVE 8233 · G1 — el genoma se inyecta ENTRE preámbulo y cuerpo:
  // forma parte del fragSource compilado (hashSource lo incluye → cada
  // variante es un programa distinto en la LRU) y cuenta como líneas
  // generadas para el remap de errores.
  const geneBlock = buildGeneDefines(genes)
  const pre = geneBlock ? `${preamble}\n${geneBlock}` : preamble
  const epilogue = buildEpilogue()
  return {
    fragSource: `${pre}\n${artistBody}\n${epilogue}\n`,
    preambleLines: pre.split('\n').length,
    bodyLines: artistBody.split('\n').length,
  }
}

// ─────────────────────────── Error-line remap ───────────────────────────

export interface RemappedLog {
  /** Log con números de línea re-mapeados al código del artista. */
  log: string
  /** Primera línea de error dentro del cuerpo del artista (1-based), si hay. */
  line: number | null
}

/**
 * Mapea `ERROR: 0:N:` del driver a líneas del source del artista.
 * El preámbulo ocupa las líneas 1..preambleLines; el epílogo va tras el
 * cuerpo — un error en zona generada se reporta con línea cruda + nota.
 */
export function remapShaderLog(
  rawLog: string,
  preambleLines: number,
  bodyLines: number,
): RemappedLog {
  let firstLine: number | null = null
  const log = rawLog.replace(
    /ERROR:\s*(\d+)\s*:\s*(\d+)\s*:/g,
    (m, col: string, ln: string) => {
      const abs = parseInt(ln, 10)
      const rel = abs - preambleLines
      if (rel >= 1 && rel <= bodyLines) {
        if (firstLine === null) firstLine = rel
        return `ERROR: ${col}:${rel}:`
      }
      // Fuera del cuerpo: error en zona generada (preámbulo/epílogo).
      return `ERROR: ${col}:${abs}[generated]:`
    },
  )
  return { log, line: firstLine }
}

// ─────────────────────────── @euclid hints & hash ───────────────────────────

/** Parámetro de artista declarado vía `@euclid param` (§4.2) — la UI
 *  genera un slider por cada uno con `data-midi-bind="theia.shader.<id>.<p>"`. */
export interface EuclidParam {
  /** Nombre del uniform GLSL (p.ej. `u_twist`). */
  name: string
  type: 'float' | 'int'
  min: number
  max: number
  defaultValue: number
  /** Label legible (entrecomillado en la cabecera). */
  label: string
}

/**
 * 🧬 WAVE 8233 · G1 — gen declarado vía `@euclid gene` (Infinite Genome
 * §4.2): fenotipo físico del core. La cabecera declara el RANGO y el
 * default; el Genome Expander (G2) elige el valor por semilla.
 *
 *   // @euclid gene G_SYM  struct int   3   9    5    a:+0.3 c:+0.2 o:-0.4
 *   // @euclid gene G_WARP expr   float 0.4 2.2  1.25 a:+0.2 c:+0.8 o:+0.3 curve=exp
 */
export interface EuclidGene {
  /** Identificador GLSL — contrato `G_*`. */
  name: string
  /** `struct` = cambio topológico (variante = otro programa) ·
   *  `expr` = modulación continua (en G3 irá a `u_gene[]` sin recompilar). */
  cls: 'struct' | 'expr'
  type: 'int' | 'float'
  min: number
  max: number
  defaultValue: number
  /** Afinidades con el ADN {a: aggression, c: chaos, o: organicity} ∈ [-1,1]. */
  affinities: { a?: number; c?: number; o?: number }
  /** Curva de expresión del Expander (§4.3) — `exp` para escalas/frecuencias. */
  curve: 'lin' | 'exp'
  label?: string
}

/** Metadatos de cabecera `@euclid` parseados (§4.2 — estilo ISF). */
export interface EuclidMeta {
  name?: string
  author?: string
  /** Composición de familias `ether | crystal | swarm | conformal` — el
   *  Espacio va primero (`swarm+conformal`). Forward-compatible con ids
   *  desconocidos (parser laxo — la validación es del Expander). */
  family?: string[]
  /** Semilla del fenotipo: uint32 o `auto` (0 = fenotipo canónico). */
  seed?: number | 'auto'
  /** ADN del átomo: `aggression=0.6 chaos=0.7 organicity=0.3`. */
  genome: Record<string, number>
  /** Rango de zona energética `gentle..peak`. */
  zone?: { from: string; to: string }
  params: EuclidParam[]
  /** Genes estructurales/expresivos declarados (Infinite Genome §4.2). */
  genes: EuclidGene[]
  /** Hint de raymarching para el governor (§4.5). */
  steps?: number
}

/**
 * Parser `@euclid` completo (§4.2). Lee las cabeceras comentadas:
 *
 *   // @euclid name    "Oracle KIFS"
 *   // @euclid author  "LuxSync"
 *   // @euclid genome  aggression=0.6 chaos=0.7 organicity=0.3
 *   // @euclid zone    gentle..peak
 *   // @euclid param   u_twist float 0.0 2.0 0.6 "Twist"
 *   // @euclid steps   96
 *   // @euclid family  swarm+conformal
 *   // @euclid seed    auto
 *   // @euclid gene    G_FOLD struct int 5 12 8 a:+0.4 c:+0.3
 *
 * Robusto: ignora líneas `@euclid` malformadas (nunca lanza), acepta
 * espacios variables y `param`/`gene` sin label.
 */
export function parseEuclidMeta(source: string): EuclidMeta {
  const meta: EuclidMeta = { genome: {}, params: [], genes: [] }
  const re = /^\s*\/\/\s*@euclid\s+(\w+)\s+(.*)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const key = m[1].toLowerCase()
    const rest = m[2].trim()
    switch (key) {
      case 'name':
      case 'author': {
        const q = /^"([^"]*)"/.exec(rest)
        meta[key] = q ? q[1] : rest || undefined
        break
      }
      case 'genome': {
        const kv = /(\w+)\s*=\s*(-?\d+(?:\.\d+)?)/g
        let g: RegExpExecArray | null
        while ((g = kv.exec(rest)) !== null) {
          const v = parseFloat(g[2])
          if (Number.isFinite(v)) meta.genome[g[1]] = v
        }
        break
      }
      case 'zone': {
        const z = /^(\w+)\s*\.\.\s*(\w+)/.exec(rest)
        if (z) meta.zone = { from: z[1], to: z[2] }
        break
      }
      case 'param': {
        // `param <uniform> <type> <min> <max> <default> ["label"]`
        const pm =
          /^(\w+)\s+(float|int)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:"([^"]*)")?/.exec(
            rest,
          )
        if (pm) {
          meta.params.push({
            name: pm[1],
            type: pm[2] as 'float' | 'int',
            min: parseFloat(pm[3]),
            max: parseFloat(pm[4]),
            defaultValue: parseFloat(pm[5]),
            label: pm[6] ?? pm[1],
          })
        }
        break
      }
      case 'steps': {
        const n = parseInt(rest, 10)
        if (Number.isFinite(n) && n > 0) meta.steps = n
        break
      }
      // ── 🧬 WAVE 8233 · G1 — gramática Infinite Genome (§4.2) ──
      case 'family': {
        const fams = rest
          .split('+')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^\w+$/.test(s))
        if (fams.length > 0) meta.family = fams
        break
      }
      case 'seed': {
        if (/^auto\b/i.test(rest)) {
          meta.seed = 'auto'
        } else {
          const sn = /^(\d+)/.exec(rest)
          if (sn) {
            const v = parseInt(sn[1], 10)
            if (v >= 0 && v <= 0xffffffff) meta.seed = v // uint32
          }
        }
        break
      }
      case 'gene': {
        // gene <IDENT> <struct|expr> <int|float> <min> <max> <default>
        //       [a:±n c:±n o:±n]… [curve=lin|exp] ["label"]
        const gm =
          /^(\w+)\s+(struct|expr)\s+(int|float)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(
            rest,
          )
        if (gm) {
          const tail = gm[7] ?? ''
          const affinities: { a?: number; c?: number; o?: number } = {}
          const affRe = /\b([aco])\s*:\s*([+-]?\d+(?:\.\d+)?)/g
          let am: RegExpExecArray | null
          while ((am = affRe.exec(tail)) !== null) {
            const v = parseFloat(am[2])
            if (Number.isFinite(v)) {
              affinities[am[1] as 'a' | 'c' | 'o'] = Math.min(1, Math.max(-1, v))
            }
          }
          const curveM = /\bcurve\s*=\s*(lin|exp)\b/.exec(tail)
          const labelM = /"([^"]*)"/.exec(tail)
          meta.genes.push({
            name: gm[1],
            cls: gm[2] as 'struct' | 'expr',
            type: gm[3] as 'int' | 'float',
            min: parseFloat(gm[4]),
            max: parseFloat(gm[5]),
            defaultValue: parseFloat(gm[6]),
            affinities,
            curve: (curveM?.[1] as 'lin' | 'exp' | undefined) ?? 'lin',
            label: labelM?.[1],
          })
        }
        break
      }
      default:
        break // claves desconocidas — forward-compatible
    }
  }
  return meta
}

/**
 * 🧬 WAVE 8233 · G1 — fenotipo efectivo de un core: defaults declarados
 * ∪ overrides del Genome Expander (§4.3). Genes `int` van redondeados;
 * valores fuera de rango se claman. `undefined` si el core no declara
 * genes y no hay overrides — el cuerpo compila por sus `#ifndef`.
 */
export function resolveGeneValues(
  meta: EuclidMeta,
  overrides?: Record<string, number>,
): Record<string, number> | undefined {
  const out: Record<string, number> = {}
  for (const g of meta.genes) {
    if (!GENE_NAME_RE.test(g.name)) continue
    let v = overrides?.[g.name] ?? g.defaultValue
    if (!Number.isFinite(v)) v = g.defaultValue
    v = Math.min(g.max, Math.max(g.min, v))
    if (g.type === 'int') v = Math.round(v)
    out[g.name] = v
  }
  if (overrides) {
    // Overrides de genes no declarados — forward-compat (#ifdef G_*).
    for (const [k, v] of Object.entries(overrides)) {
      if (GENE_NAME_RE.test(k) && Number.isFinite(v) && !(k in out)) {
        out[k] = v
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Hint `@euclid steps N` embebido en comentarios del shader (§4.2). E3 solo
 * extrae `steps` (techo de raymarching); el parser completo llega en E4.
 */
export function parseStepsHint(source: string): number | null {
  const m = /@euclid\s+steps\s+(\d+)/.exec(source)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Pre-check: el cuerpo debe exponer la firma Shadertoy (§4.1). */
export function hasMainImage(source: string): boolean {
  return /void\s+mainImage\s*\(\s*out\s+vec4/.test(source)
}

/** Hash FNV-1a 32-bit — clave de caché estable por contenido del shader. */
export function hashSource(source: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}
