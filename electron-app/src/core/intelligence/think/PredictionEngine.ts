// ═══════════════════════════════════════════════════════════════════════════
//  🔮 PREDICTION ENGINE - El Oráculo Musical
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  "Predice el futuro analizando el pasado"
// ═══════════════════════════════════════════════════════════════════════════

import type { SeleneMusicalPattern, SectionClassification } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de predicción
 */
export type PredictionType =
  | 'drop_incoming'      // Drop inminente
  | 'buildup_starting'   // Buildup empezando
  | 'breakdown_imminent' // Breakdown cercano
  | 'transition_beat'    // Transición de sección
  | 'energy_spike'       // Pico de energía
  | 'energy_drop'        // Caída de energía
  | 'section_change'     // Cambio de sección genérico
  | 'none'               // Sin predicción

/**
 * Predicción musical
 */
export interface MusicalPrediction {
  /** Tipo de evento predicho */
  type: PredictionType
  
  /** Sección probable siguiente */
  probableSection: SectionClassification | null
  
  /** Probabilidad (0-1) */
  probability: number
  
  /** Tiempo estimado hasta el evento (ms) */
  estimatedTimeMs: number
  
  /** Tiempo en beats hasta el evento */
  estimatedBeats: number
  
  /** Razón de la predicción */
  reasoning: string
  
  /** Acciones de iluminación sugeridas */
  suggestedActions: PredictionAction[]
  
  /** Timestamp */
  timestamp: number
}

/**
 * Acción de iluminación sugerida
 */
export interface PredictionAction {
  /** Tipo de acción */
  type: 'prepare' | 'execute' | 'recover'
  
  /** Efecto sugerido */
  effect: 'flash' | 'strobe' | 'pulse' | 'blackout' | 'color_shift' | 'intensity_ramp' | 'breathe'
  
  /** Intensidad (0-1) */
  intensity: number
  
  /** Duración (ms) */
  durationMs: number
  
  /** Timing relativo al evento (negativo = antes) */
  timingOffsetMs: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 CASSANDRA 2.0 — CADENA DE MARKOV DE 2º ORDEN, ZERO-ALLOC
// ═══════════════════════════════════════════════════════════════════════════
// Reemplaza PROGRESSION_PATTERNS (8 reglas hardcodeadas) por un estimador
// bayesiano jerárquico con aprendizaje online.
//
// HALLAZGO FORENSE QUE MOTIVA EL REDISEÑO (F1):
//   El legacy `updateHistory()` solo empujaba al historial cuando la sección
//   CAMBIABA. Por tanto dos entradas idénticas consecutivas eran imposibles y
//   los triggers ['buildup','buildup'], ['chorus','chorus'], ['drop','drop'] y
//   ['verse','verse'] eran SIEMPRE falsos. 4 de 8 patrones eran código muerto,
//   incluido el de mayor confianza del sistema (buildup,buildup → drop @0.90).
//   Cassandra era de facto una cadena de 1er orden con 5 reglas vivas.
//
// CONSECUENCIA DE DISEÑO:
//   El alfabeto es a nivel de SEGMENTO ⇒ los self-loops son estructuralmente
//   imposibles, no meramente raros. `next === prev1` es un cero estructural.
//   La semántica de "buildup prolongado" pertenece al DWELL, que ya modelan
//   FLUID 2 (estimateTimeToEvent) y ORGANIC 2 (computeOrganicConfidence).
//   Separación limpia: Markov decide QUÉ; el dwell decide CUÁNDO y CON CUÁNTA
//   CERTEZA. El trigrama breakdown→buildup→drop recupera la intención del
//   patrón muerto y sí es alcanzable.
//
// LAYOUT: stride 16 (potencia de 2).
//   idx2 = (p2<<8)|(p1<<4)|n     idx1 = (p1<<4)|n     row2 = (p2<<8)|(p1<<4)
//   (a) aritmética puramente bitwise — sin multiplicaciones enteras, índices
//       SMI que nunca deoptimizan a double.
//   (b) cada fila de 16 float32 = 64 B = UNA línea de caché, y toda fila queda
//       alineada a línea de caché: un scan O(10) es un miss, no dos.
//   (c) 4096 × 4 B = 16 KB — residente en L1.
//
// ESTIMADOR: Dirichlet jerárquico de dos niveles con cuentas con fuga.
//   p̂₁(n) = (C₁[p₁,n] + κ₁·T₁[p₁,n]) / (N₁[p₁] + κ₁)
//   m₂(n) = β·T₂[p₂,p₁,n] + (1−β)·p̂₁(n)
//   p̂₂(n) = (C₂[p₂,p₁,n] + κ₂·m₂(n)) / (N₂[p₂,p₁] + κ₂)
//
//   El posterior de nivel 1 ES la media a priori del nivel 2. La masa de
//   evidencia N gobierna la interpolación sola: sin λ de backoff a mano, sin
//   umbrales. Los 8 patrones legacy no se borran: se reexpresan como
//   pseudo-cuentas en T₁/T₂, así que el arranque en frío es equivalente al
//   Cassandra legacy y el aprendizaje lo domina monótonamente.
//
//   La no estacionariedad (un set de DJ no es i.i.d.) se maneja con fuga
//   multiplicativa perezosa por fila en cada visita: la masa está acotada por
//   1/(1−λ) y se actualiza en O(1) precisamente porque la fuga es
//   multiplicativa — N ← λN + w.
// ═══════════════════════════════════════════════════════════════════════════

/** Tamaño del alfabeto MSST */
const S = 10
/** 'unknown' — transparente: nunca se aprende ni se predice */
const UNK = 9
/** Stride de fila (potencia de 2) */
const STRIDE = 16

/** Cuentas de 2º orden con fuga. 4096 × f32 = 16 KB */
const C2 = new Float32Array(STRIDE * STRIDE * STRIDE)
/** Cuentas de 1er orden con fuga. 256 × f32 = 1 KB */
const C1 = new Float32Array(STRIDE * STRIDE)
/** Masa de evidencia por fila — exacta bajo fuga multiplicativa, O(1) */
const N2 = new Float32Array(STRIDE * STRIDE)   // indexado por (p2<<4)|p1
const N1 = new Float32Array(STRIDE)            // indexado por p1
/** Priors musicales estáticos (construidos una vez, luego read-only) */
const T1 = new Float32Array(STRIDE * STRIDE)
const T2 = new Float32Array(STRIDE * STRIDE * STRIDE)
/** Posterior scratch — pre-asignado, reutilizado en cada predict() */
const POST = new Float32Array(STRIDE)

/** Fuerza del prior, 1er orden (pseudo-observaciones) */
const KAPPA_1 = 2.5
/** Fuerza del prior, 2º orden */
const KAPPA_2 = 3.0
/** Plantilla musical vs marginal aprendida, en el nivel 2 */
const BETA = 0.55
/** Olvido con fuga, 1er orden (~40 visitas de vida media) */
const LAMBDA_1 = 0.975
/** Olvido con fuga, 2º orden (~11 visitas de vida media) */
const LAMBDA_2 = 0.940
/** 1/ln(10) — normalizador de entropía */
const LN_S_INV = 1 / Math.log(S)

/** Registros de contexto. -1 = frío. Nivel segmento: prev1 !== prev2 siempre */
let prev1 = -1
let prev2 = -1

/** Telemetría de calibración — NO muta la matriz (ver validatePrediction) */
let hitRateEMA = 0.5
const ALPHA_HIT = 0.05

/** Salidas de predicción, escritas in-place (sin alloc) */
let pSection = -1        // índice argmax, -1 = sin predicción
let pProb = 0            // masa posterior normalizada del argmax
let pMargin = 0          // p_max − p_second — nitidez de la decisión
let pEntropyConf = 0     // p_max · (1 − H/ln S) — confianza epistémica

/** Índice → nombre (alfabeto MSST canónico, orden de MSST_SECTION_KEYS) */
const SECTION_NAMES: readonly SectionClassification[] = [
  'intro', 'verse', 'buildup', 'chorus', 'drop',
  'textural_drop', 'breakdown', 'bridge', 'outro', 'unknown',
]

/**
 * String → índice sin hashing. Un `Map.get()` hashea; un `switch` sobre
 * literales compila a tabla de salto por puntero interno y devuelve un SMI.
 */
function sectionIndex(s: string): number {
  switch (s) {
    case 'intro': return 0
    case 'verse': return 1
    case 'buildup': return 2
    case 'chorus': return 3
    case 'drop': return 4
    case 'textural_drop': return 5
    case 'breakdown': return 6
    case 'bridge': return 7
    case 'outro': return 8
    default: return UNK
  }
}

/** Índice de sección predicha → PredictionType (LUT, sin cadena de branches) */
const PTYPE: readonly PredictionType[] = [
  'transition_beat',    // 0 intro
  'transition_beat',    // 1 verse
  'buildup_starting',   // 2 buildup
  'transition_beat',    // 3 chorus
  'drop_incoming',      // 4 drop
  'drop_incoming',      // 5 textural_drop
  'breakdown_imminent', // 6 breakdown
  'transition_beat',    // 7 bridge
  'transition_beat',    // 8 outro
  'none',               // 9 unknown (nunca se predice)
]

/**
 * Acciones sugeridas por sección predicha. Arrays congelados y compartidos:
 * cero asignaciones por predicción. Contenido preservado literalmente de
 * PROGRESSION_PATTERNS.actions (el conocimiento de iluminación no se pierde,
 * solo deja de estar acoplado al matching de patrones).
 */
const SECTION_ACTIONS: readonly (readonly PredictionAction[])[] = [
  // 0 intro
  Object.freeze([
    { type: 'execute', effect: 'pulse', intensity: 0.6, durationMs: 300, timingOffsetMs: 0 },
  ] as PredictionAction[]),
  // 1 verse
  Object.freeze([
    { type: 'prepare', effect: 'breathe', intensity: 0.6, durationMs: 800, timingOffsetMs: -800 },
  ] as PredictionAction[]),
  // 2 buildup
  Object.freeze([
    { type: 'prepare', effect: 'color_shift', intensity: 0.4, durationMs: 500, timingOffsetMs: -500 },
    { type: 'execute', effect: 'intensity_ramp', intensity: 0.5, durationMs: 2000, timingOffsetMs: 0 },
  ] as PredictionAction[]),
  // 3 chorus
  Object.freeze([
    { type: 'prepare', effect: 'color_shift', intensity: 0.5, durationMs: 1000, timingOffsetMs: -1000 },
    { type: 'execute', effect: 'pulse', intensity: 0.8, durationMs: 500, timingOffsetMs: 0 },
  ] as PredictionAction[]),
  // 4 drop
  Object.freeze([
    { type: 'prepare', effect: 'intensity_ramp', intensity: 0.8, durationMs: 2000, timingOffsetMs: -2000 },
    { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 200, timingOffsetMs: 0 },
    { type: 'recover', effect: 'strobe', intensity: 0.9, durationMs: 4000, timingOffsetMs: 200 },
  ] as PredictionAction[]),
  // 5 textural_drop
  Object.freeze([
    { type: 'prepare', effect: 'intensity_ramp', intensity: 0.6, durationMs: 1500, timingOffsetMs: -1500 },
    { type: 'execute', effect: 'flash', intensity: 0.85, durationMs: 200, timingOffsetMs: 0 },
  ] as PredictionAction[]),
  // 6 breakdown
  Object.freeze([
    { type: 'execute', effect: 'intensity_ramp', intensity: 0.3, durationMs: 2000, timingOffsetMs: 0 },
    { type: 'recover', effect: 'breathe', intensity: 0.4, durationMs: 3000, timingOffsetMs: 2000 },
  ] as PredictionAction[]),
  // 7 bridge
  Object.freeze([
    { type: 'prepare', effect: 'color_shift', intensity: 0.45, durationMs: 900, timingOffsetMs: -900 },
  ] as PredictionAction[]),
  // 8 outro
  Object.freeze([
    { type: 'recover', effect: 'breathe', intensity: 0.35, durationMs: 3000, timingOffsetMs: 0 },
  ] as PredictionAction[]),
  // 9 unknown
  Object.freeze([] as PredictionAction[]),
]

// ── Plantilla de plausibilidad musical de 1er orden (filas suman 1, diagonal 0) ──
// Filas: 0 intro 1 verse 2 buildup 3 chorus 4 drop 5 textural_drop
//        6 breakdown 7 bridge 8 outro 9 unknown
const T1_ROWS: readonly number[][] = [
  [0,   .55, .25, .08, .04, .02, .03, .03, 0,   0  ], // intro
  [0,   0,   .40, .30, .06, .03, .08, .10, .03, 0  ], // verse
  [0,   .03, 0,   .22, .62, .08, .05, 0,   0,   0  ], // buildup
  [0,   .35, .20, 0,   .08, .03, .15, .12, .07, 0  ], // chorus
  [0,   .15, .12, .20, 0,   .10, .35, .03, .05, 0  ], // drop
  [0,   .15, .22, .18, .10, 0,   .30, .05, 0,   0  ], // textural_drop
  [0,   .18, .55, .12, .06, 0,   0,   .05, .04, 0  ], // breakdown
  [0,   .15, .25, .40, .10, 0,   .06, 0,   .04, 0  ], // bridge
  [.30, .25, 0,   .10, 0,   0,   .15, 0,   0,   .20], // outro
  [.08, .30, .20, .20, .12, 0,   .10, 0,   0,   0  ], // unknown
]

/**
 * Afilado de 2º orden: T₂[p2,p1,·] = (1−s)·T₁[p1,·] + s·e_next
 * `s` ≈ confianza del patrón legacy equivalente.
 */
const T2_SPEC: readonly [number, number, number, number][] = [
  // [p2, p1, next, s]
  [6, 2, 4, 0.85], // breakdown→buildup→DROP     ← recupera el 0.90 muerto
  [1, 2, 3, 0.80], // verse→buildup→CHORUS       ← legacy 0.85
  [3, 2, 4, 0.70], // chorus→buildup→DROP
  [2, 4, 6, 0.65], // buildup→drop→BREAKDOWN     ← legacy drop,drop→breakdown 0.75
  [4, 6, 2, 0.80], // drop→breakdown→BUILDUP     ← legacy 0.80
  [0, 1, 2, 0.50], // intro→verse→BUILDUP        ← legacy intro→verse 0.85
  [3, 1, 2, 0.55], // chorus→verse→BUILDUP       ← legacy verse,verse→buildup 0.65
  [4, 5, 6, 0.70], // drop→textural_drop→BREAKDOWN
]

/** Construye T₁/T₂ una sola vez al cargar el módulo (fuera del hot path) */
function buildPriors(): void {
  for (let p1 = 0; p1 < S; p1++) {
    const row = T1_ROWS[p1]
    for (let n = 0; n < S; n++) T1[(p1 << 4) | n] = row[n]
    // Por defecto: fila de T₂ = fila de T₁ (el 2º orden no sabe nada extra)
    for (let p2 = 0; p2 < S; p2++) {
      const base = (p2 << 8) | (p1 << 4)
      for (let n = 0; n < S; n++) T2[base + n] = row[n]
    }
  }
  for (let i = 0; i < T2_SPEC.length; i++) {
    const spec = T2_SPEC[i]
    const base = (spec[0] << 8) | (spec[1] << 4)
    const s = spec[3]
    const one = 1 - s
    for (let n = 0; n < S; n++) T2[base + n] *= one
    T2[base + spec[2]] += s
  }
}
buildPriors()

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO INTERNO — dwell y anillo de segmentos (zero-alloc)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_HISTORY = 8
/** Anillo de índices de sección observados (telemetría + dwell) */
const histSection = new Int8Array(MAX_HISTORY).fill(-1)
const histTimestamp = new Float64Array(MAX_HISTORY)
let histWrite = 0
let histCount = 0
/** Timestamp de entrada en la sección actual (dwell) */
let sectionStartedAt = 0
/** Última sección vista en crudo (incluye 'unknown', para detectar cambios) */
let lastRawSection = -1

let lastPrediction: MusicalPrediction | null = null

/** Entrada de historial expuesta para telemetría (no hot path) */
export interface HistoryEntry {
  section: SectionClassification
  timestamp: number
  durationMs: number
  energyLevel: number
}

// ═══════════════════════════════════════════════════════════════════════════
// APRENDIZAJE ONLINE — O(10), zero-alloc
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ingiere una transición de segmento OBSERVADA y aprende de ella.
 * Llamar solo en cambio de sección (mismo disparador que el legacy).
 *
 * @param section    Sección MSST
 * @param confidence Confianza del detector (SectionOutput.confidence) — filtra
 *                   el aprendizaje. Una detección de baja confianza NO es
 *                   evidencia.
 */
export function observeSection(section: string, confidence: number = 1): void {
  const s = sectionIndex(section)

  // F2 — 'unknown' es transparente: no aprende, no desplaza contexto.
  // Ingerirlo destruiría el bigrama real Y quemaría un contexto de 2º orden.
  if (s === UNK || confidence < 0.5) return

  // F1 — alfabeto de segmento: los self-loops no existen. No-op defensivo.
  if (s === prev1) return

  // ── Nivel 1: fuga de la fila visitada, luego refuerzo ──
  if (prev1 >= 0) {
    const r1 = prev1 << 4
    for (let n = 0; n < S; n++) C1[r1 + n] *= LAMBDA_1
    C1[r1 + s] += 1
    N1[prev1] = N1[prev1] * LAMBDA_1 + 1   // exacto: la fuga es multiplicativa

    // ── Nivel 2: solo con contexto de 2º orden completo ──
    if (prev2 >= 0) {
      const r2 = (prev2 << 8) | (prev1 << 4)
      for (let n = 0; n < S; n++) C2[r2 + n] *= LAMBDA_2
      C2[r2 + s] += 1
      const m = (prev2 << 4) | prev1
      N2[m] = N2[m] * LAMBDA_2 + 1
    }
  }

  // ── Desplazar registros de contexto ──
  prev2 = prev1
  prev1 = s
}

// ═══════════════════════════════════════════════════════════════════════════
// PREDICCIÓN — argmax O(10) sobre el posterior jerárquico
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Predicción estructural rápida. Dos pasadas O(10): acumular y normalizar.
 * Escribe pSection/pProb/pMargin/pEntropyConf in-place. Zero-alloc.
 *
 * @returns true si existe predicción
 */
function predictStructural(): boolean {
  pSection = -1; pProb = 0; pMargin = 0; pEntropyConf = 0
  if (prev1 < 0) return false

  const r1 = prev1 << 4
  const inv1 = 1 / (N1[prev1] + KAPPA_1)

  // Un contexto de 2º orden frío degrada con gracia al posterior de nivel 1.
  const has2 = prev2 >= 0
  const r2 = has2 ? ((prev2 << 8) | r1) : 0
  const inv2 = has2 ? 1 / (N2[(prev2 << 4) | prev1] + KAPPA_2) : 0

  // ── Pasada 1: posterior sin normalizar sobre el soporte admisible ──
  // Ceros estructurales: n === prev1 (sin self-loops, F1) y n === UNK (F2).
  let Z = 0
  let best = -1
  let bestV = -1
  let secondV = 0
  for (let n = 0; n < S; n++) {
    if (n === prev1 || n === UNK) { POST[n] = 0; continue }

    const q1 = (C1[r1 + n] + KAPPA_1 * T1[r1 + n]) * inv1
    const v = has2
      ? (C2[r2 + n] + KAPPA_2 * (BETA * T2[r2 + n] + (1 - BETA) * q1)) * inv2
      : q1

    POST[n] = v
    Z += v
    if (v > bestV) { secondV = bestV; best = n; bestV = v }
    else if (v > secondV) { secondV = v }
  }
  if (Z <= 0 || best < 0) return false

  // ── Pasada 2: normalizar sobre el soporte admisible + entropía de Shannon ──
  const invZ = 1 / Z
  let H = 0
  for (let n = 0; n < S; n++) {
    const p = POST[n] * invZ
    POST[n] = p
    if (p > 1e-6) H -= p * Math.log(p)
  }

  pSection = best
  pProb = bestV * invZ
  pMargin = (bestV - (secondV > 0 ? secondV : 0)) * invZ
  // Confianza epistémica: masa del pico descontada por la planitud de la
  // distribución. Un pico de 0.35 en una distribución plana no es conocimiento
  // — y el sistema lo declara. Complementa ORGANIC 1 (incertidumbre TEMPORAL
  // por lock del PLL) con incertidumbre ESTRUCTURAL.
  pEntropyConf = pProb * (1 - H * LN_S_INV)
  return true
}

/**
 * Ganancia de fiabilidad del oráculo derivada del hit-rate empírico.
 * Sin penalización en arranque en frío (hitRate = 0.5 → 1.0); un oráculo
 * demostrablemente equivocado se descuenta hasta 0.75. El descuento es
 * modesto porque s_P ya tiene suelo 0.5 en la cámara de fusión.
 */
function oracleTrust(): number {
  return hitRateEMA >= 0.5 ? 1 : 0.75 + 0.5 * hitRateEMA
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera predicción basada en el patrón actual y historial
 * 
 * @param pattern - Patrón musical actual
 * @returns Predicción musical
 */
export function predict(pattern: SeleneMusicalPattern): MusicalPrediction {
  const timestamp = pattern.timestamp
  
  // Actualizar dwell/anillo y aprender la transición si cambió de sección
  updateHistory(pattern)
  
  // 🔮 CASSANDRA 2.0: lookup O(10) sobre el posterior jerárquico
  if (predictStructural()) {
    const predictionType = PTYPE[pSection]
    
    // 🌊 WAVE 5016: FLUID TIMING ENGINE — el tiempo es orgánico, no un número mágico.
    // Deriva el ETA del evento desde la aceleración de energía, el tiempo en sección
    // y el anclaje de fase del PLL en vez de un lookup fijo de 4/8 beats.
    const { beats: beatsToEvent, ms: estimatedTimeMs } = estimateTimeToEvent(pattern, predictionType)
    
    // Base = media geométrica de la masa del argmax y la confianza epistémica.
    // Mantiene semántica de t-norma: si la distribución es plana, la base cae
    // aunque el pico sea alto. Escalada por la fiabilidad empírica del oráculo.
    const baseProbability = Math.sqrt(pProb * pEntropyConf) * oracleTrust()
    
    // 📈 WAVE 5016: ORGANIC CONFIDENCE — la confianza refleja el estado real del
    // motor sensorial (lock del PLL, histéresis de sección, alineación de energía).
    const adjustedProbability = computeOrganicConfidence(
      baseProbability,
      pattern,
      predictionType
    )
    
    const prediction: MusicalPrediction = {
      type: predictionType,
      probableSection: SECTION_NAMES[pSection],
      probability: adjustedProbability,
      estimatedTimeMs,
      estimatedBeats: beatsToEvent,
      reasoning: buildReasoning(pattern),
      suggestedActions: SECTION_ACTIONS[pSection] as PredictionAction[],
      timestamp,
    }
    
    lastPrediction = prediction
    return prediction
  }
  
  // Sin contexto suficiente (arranque en frío: ninguna sección válida observada)
  const noPrediction: MusicalPrediction = {
    type: 'none',
    probableSection: null,
    probability: 0,
    estimatedTimeMs: 0,
    estimatedBeats: 0,
    reasoning: 'Cassandra en frío: sin contexto de sección válido',
    suggestedActions: [],
    timestamp,
  }
  
  lastPrediction = noPrediction
  return noPrediction
}

/**
 * Obtiene la última predicción
 */
export function getLastPrediction(): MusicalPrediction | null {
  return lastPrediction
}

/**
 * Obtiene el historial de secciones.
 * Solo telemetría — asigna en la llamada, NO usar en el hot path.
 */
export function getSectionHistory(): readonly HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (let i = 0; i < histCount; i++) {
    const slot = (histWrite - histCount + i + MAX_HISTORY) % MAX_HISTORY
    const idx = histSection[slot]
    if (idx < 0) continue
    const ts = histTimestamp[slot]
    const nextSlot = (slot + 1) % MAX_HISTORY
    const hasNext = i < histCount - 1
    out.push({
      section: SECTION_NAMES[idx],
      timestamp: ts,
      durationMs: hasNext ? Math.max(0, histTimestamp[nextSlot] - ts) : 0,
      energyLevel: 0,
    })
  }
  return out
}

/**
 * Verifica si una predicción previa fue correcta.
 *
 * ⚠️ SOLO calibración/telemetría: NUNCA muta C1/C2.
 * El conteo de frecuencias en observeSection() ya ES el estimador de máxima
 * verosimilitud de la matriz de transición. Reforzar además las predicciones
 * ACERTADAS crearía un bucle rich-get-richer: el argmax recibiría masa extra
 * *por ser* el argmax, el estimador dejaría de ser consistente y la cadena se
 * bloquearía en lo primero que viese. Toda observación aporta peso 1 exacto,
 * haya sido predicha o no.
 */
export function validatePrediction(
  prediction: MusicalPrediction,
  actualSection: SectionClassification
): boolean {
  const hit = prediction.probableSection === actualSection
  hitRateEMA += ALPHA_HIT * ((hit ? 1 : 0) - hitRateEMA)
  return hit
}

/**
 * Estado interno de Cassandra 2.0 (telemetría / caja negra).
 */
export function getCassandraState(): {
  prev1: SectionClassification | null
  prev2: SectionClassification | null
  probableSection: SectionClassification | null
  probability: number
  margin: number
  epistemicConfidence: number
  evidenceMass1: number
  evidenceMass2: number
  hitRate: number
} {
  return {
    prev1: prev1 >= 0 ? SECTION_NAMES[prev1] : null,
    prev2: prev2 >= 0 ? SECTION_NAMES[prev2] : null,
    probableSection: pSection >= 0 ? SECTION_NAMES[pSection] : null,
    probability: pProb,
    margin: pMargin,
    epistemicConfidence: pEntropyConf,
    evidenceMass1: prev1 >= 0 ? N1[prev1] : 0,
    evidenceMass2: (prev1 >= 0 && prev2 >= 0) ? N2[(prev2 << 4) | prev1] : 0,
    hitRate: hitRateEMA,
  }
}

/**
 * Frontera de track: descarga el contexto y HALVA la evidencia.
 * Conserva la estructura a nivel de estilo/género y descarta las
 * idiosincrasias del track concreto. ~4 µs, una vez por track.
 */
export function onTrackChange(): void {
  prev1 = -1
  prev2 = -1
  lastRawSection = -1
  histWrite = 0
  histCount = 0
  histSection.fill(-1)
  for (let i = 0; i < C2.length; i++) C2[i] *= 0.5
  for (let i = 0; i < C1.length; i++) C1[i] *= 0.5
  for (let i = 0; i < N2.length; i++) N2[i] *= 0.5
  for (let i = 0; i < N1.length; i++) N1[i] *= 0.5
}

/**
 * Resetea el estado de predicción (arranque en frío: solo priors).
 */
export function resetPredictionEngine(): void {
  C2.fill(0)
  C1.fill(0)
  N2.fill(0)
  N1.fill(0)
  POST.fill(0)
  prev1 = -1
  prev2 = -1
  hitRateEMA = 0.5
  pSection = -1
  pProb = 0
  pMargin = 0
  pEntropyConf = 0
  histSection.fill(-1)
  histTimestamp.fill(0)
  histWrite = 0
  histCount = 0
  sectionStartedAt = 0
  lastRawSection = -1
  lastPrediction = null
  energyHistory = [] // 🔮 WAVE 1169: Reset energy history too
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ingiere el frame: detecta cambio de segmento, actualiza dwell y anillo, y
 * delega el aprendizaje en observeSection(). Zero-alloc.
 */
function updateHistory(pattern: SeleneMusicalPattern): void {
  const idx = sectionIndex(pattern.section)
  if (idx === lastRawSection) return
  lastRawSection = idx
  
  // El dwell se reinicia en CUALQUIER cambio observado (incluido 'unknown'):
  // es un hecho temporal, no una hipótesis estructural.
  sectionStartedAt = pattern.timestamp
  
  // Anillo de telemetría — solo secciones estructuralmente válidas
  if (idx !== UNK) {
    histSection[histWrite] = idx
    histTimestamp[histWrite] = pattern.timestamp
    histWrite = (histWrite + 1) % MAX_HISTORY
    if (histCount < MAX_HISTORY) histCount++
  }
  
  // Aprendizaje online de la transición de 2º orden
  observeSection(pattern.section, 1)
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 5016: FLUID TIMING ENGINE + 📈 ORGANIC CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════
// "Adiós a los números mágicos. El tiempo y la certeza son orgánicos."
//
// El legacy `estimateBeatsToEvent` devolvía enteros fijos (4/8 beats) y
// `adjustProbabilityByContext` multiplicaba constantes hardcodeadas. Si el DJ
// adelantaba un drop, el reloj interno seguía contando desde un número mágico.
//
// Ahora el ETA se DERIVA de:
//   1. Aceleración de energía (velocity)   → subida violenta = drop más cerca
//   2. Tiempo real en la sección actual     → buildup largo = resolución inminente
//   3. Tensión emocional                    → tensión alta = release inminente
//   4. Anclaje de fase del PLL (beatPhase)   → el ETA se cuantiza a la rejilla de beats
//
// Y la confianza se DERIVA de:
//   1. Lock del PLL (estabilidad de BPM)     → BPM inestable = la confianza colapsa
//   2. Histéresis de sección (dwell)         → sección persistente = transición más segura
//   3. Alineación de energía                 → velocity confirma el relato build/drop
//   4. Sincopación                           → ritmo impredecible baja la certeza
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 WAVE 7002 (F10): estimatePllLock() and bpmHistory REMOVED.
// Cassandra now uses pattern.pllLocked (real PLL state) directly.
// ═══════════════════════════════════════════════════════════════════════════

/** 🌊 WAVE 5016: ms transcurridos en la sección actual (dwell) */
function timeInCurrentSectionMs(now: number): number {
  if (sectionStartedAt <= 0) return 0
  return Math.max(0, now - sectionStartedAt)
}

/**
 * 🌊 WAVE 5016: FLUID TIMING — deriva el tiempo hasta el evento de forma orgánica.
 * Reemplaza el lookup fijo de 4/8 beats por una física de aceleración + dwell + fase.
 */
function estimateTimeToEvent(
  pattern: SeleneMusicalPattern,
  predictionType: PredictionType
): { beats: number; ms: number } {
  const safeBpm = (pattern.bpm > 0 && Number.isFinite(pattern.bpm)) ? pattern.bpm : 120
  const msPerBeat = 60000 / safeBpm
  
  const velocity = calculateEnergyVelocity()                       // delta de energía por frame
  const dwellBeats = timeInCurrentSectionMs(pattern.timestamp) / msPerBeat
  
  // Factor de velocidad: 0 = subida atmosférica/lenta, 1 = aceleración violenta
  // (velocity por frame típicamente 0..0.02)
  const velocityFactor = Math.max(0, Math.min(1, velocity / 0.02))
  
  // Baseline de beats por tipo de predicción (punto de partida, no destino fijo)
  let baseBeats: number
  switch (predictionType) {
    case 'drop_incoming':      baseBeats = 8; break
    case 'buildup_starting':   baseBeats = 6; break
    case 'breakdown_imminent': baseBeats = 8; break
    case 'transition_beat':    baseBeats = 4; break
    default:                   baseBeats = 8; break
  }
  
  // 🌊 FLUID 1: La aceleración violenta acerca el evento (hasta -75%)
  let beats = baseBeats * (1 - velocityFactor * 0.75)
  
  // 🌊 FLUID 2: Cuanto más tiempo llevamos en la sección, más cerca la resolución.
  // Un buildup que ya lleva 8+ beats está a punto de romper → comprimir hacia 1 beat.
  if (dwellBeats > 8) {
    const dwellPull = Math.min(1, (dwellBeats - 8) / 16) // 0 a 8 beats, 1 a 24 beats
    beats *= (1 - dwellPull * 0.6)
  }
  
  // 🌊 FLUID 3: Squeeze por tensión — tensión emocional alta = release inminente
  if (pattern.emotionalTension > 0.7) {
    beats *= 0.8
  }
  
  // Clamp a un rango musical sano [1, 16]
  beats = Math.max(1, Math.min(16, beats))
  
  // 🌊 FLUID 4: ANCLAJE DE FASE DEL PLL — cuantiza el ETA a la rejilla de beats.
  // Tiempo hasta el próximo límite de beat usando la fase actual + beats enteros.
  const beatPhase = Math.max(0, Math.min(1, pattern.beatPhase ?? 0))
  const msToNextBeat = (1 - beatPhase) * msPerBeat
  const wholeBeats = Math.max(0, Math.round(beats) - 1)
  const ms = msToNextBeat + wholeBeats * msPerBeat
  
  return { beats: Math.round(beats), ms }
}

/**
 * 📈 WAVE 5016: ORGANIC CONFIDENCE — la confianza es un reflejo del estado sensorial.
 * Reemplaza los multiplicadores hardcodeados por un cálculo verdaderamente reactivo.
 */
function computeOrganicConfidence(
  baseProbability: number,
  pattern: SeleneMusicalPattern,
  predictionType: PredictionType
): number {
  const safeBpm = (pattern.bpm > 0 && Number.isFinite(pattern.bpm)) ? pattern.bpm : 120
  const msPerBeat = 60000 / safeBpm
  
  // 🔧 WAVE 7002 (F10): Use REAL pllLocked from pattern instead of re-derived estimatePllLock()
  const pllLock = pattern.pllLocked ? 1.0 : (pattern.bpmConfidence > 0.5 ? 0.5 : 0.0)
  const dwellBeats = timeInCurrentSectionMs(pattern.timestamp) / msPerBeat
  const velocity = calculateEnergyVelocity()
  const velocityFactor = Math.max(0, Math.min(1, velocity / 0.02))
  
  let confidence = baseProbability
  
  // 📈 ORGANIC 1: COLAPSO POR PLL — si la rejilla de beats es inestable, CUALQUIER
  // predicción basada en tiempo es una conjetura. La confianza cae a un suelo del
  // 55% de la base cuando el PLL está suelto, y llega al 100% cuando está enganchado.
  // 🔧 WAVE 7002 (F10): pllLock ahora viene del estado REAL del PLL (pattern.pllLocked),
  // no de una re-derivación por CV que invertía la lógica (pacemaker = lock perfecto).
  confidence *= (0.55 + 0.45 * pllLock)
  
  // 📈 ORGANIC 2: HISTÉRESIS DE SECCIÓN — cuanto más persiste una sección, más
  // segura se vuelve su transición eventual. Suma hasta +0.15.
  const hysteresisBoost = Math.min(1, dwellBeats / 16) * 0.15
  confidence += hysteresisBoost
  
  // 📈 ORGANIC 3: ALINEACIÓN DE ENERGÍA — para predicciones de build/drop, una
  // velocity creciente confirma el relato. Suma hasta +0.12.
  const isEnergeticType = predictionType === 'drop_incoming'
    || predictionType === 'buildup_starting'
    || predictionType === 'energy_spike'
  if (isEnergeticType && pattern.isBuilding) {
    confidence += velocityFactor * 0.12
  }
  
  // 📉 ORGANIC 4: CAOS POR SINCOPACIÓN — un ritmo impredecible baja la certeza.
  if (pattern.syncopation > 0.7) {
    confidence *= 0.95
  }
  
  return Math.max(0, Math.min(1, confidence))
}

function buildReasoning(pattern: SeleneMusicalPattern): string {
  const ctx = prev2 >= 0
    ? `${SECTION_NAMES[prev2]} → ${SECTION_NAMES[prev1]}`
    : `${SECTION_NAMES[prev1]}`
  const prob = (pProb * 100).toFixed(0)
  const mass = prev2 >= 0 ? N2[(prev2 << 4) | prev1] : N1[prev1]
  
  let reason = `🔮 Markov²[${ctx}] → ${SECTION_NAMES[pSection]} (${prob}%` +
    `, margen ${(pMargin * 100).toFixed(0)}%, H⁻¹ ${(pEntropyConf * 100).toFixed(0)}%` +
    `, evidencia ${mass.toFixed(1)})`
  
  if (pattern.isBuilding) {
    reason += ', energía subiendo'
  }
  
  if (pattern.emotionalTension > 0.7) {
    reason += ', alta tensión'
  }
  
  return reason
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔮 WAVE 1169/1172: REACTIVE ENERGY PREDICTION
// "No dependas de etiquetas, lee la energía bruta"
// 
// WAVE 1172 TUNING: Oráculo más sensible
// - Spike threshold: 0.85 → 0.70
// - Drop detection: tension > 0.5 (was 0.6)
// - Rising energy feedback visible
// ═══════════════════════════════════════════════════════════════════════════

/** Historial de energía para detección de tendencias */
const MAX_ENERGY_HISTORY = 30 // ~0.5 segundos a 60fps
let energyHistory: number[] = []

/** 🔮 WAVE 1172: Umbrales calibrados para mayor sensibilidad */
/** 🎯 WAVE 1176: OPERATION SNIPER - Sensibilidad x10 */
/** 🧬 WAVE 2093 COG-5: BASE thresholds (techno/default). Vibes tranquilos escalan arriba. */
const ENERGY_THRESHOLDS = {
  SPIKE_DELTA: 0.08,           // 🎯 WAVE 1176: Era 0.12, ahora x10 sensibilidad
  RISING_DELTA: 0.015,         // 🎯 WAVE 1176: Era 0.04, detecta subidas sutiles
  FALLING_DELTA: -0.02,        // 🎯 WAVE 1176: Era -0.06, detecta caídas antes
  MIN_ENERGY_FOR_RISING: 0.25, // 🎯 WAVE 1176: Era 0.35, activa mucho antes
  MIN_ENERGY_FOR_SPIKE: 0.60,  // 🎯 WAVE 1176: Era 0.70, más sensible
  TENSION_FOR_DROP: 0.4,       // 🎯 WAVE 1176: Era 0.5, más sensible
} as const

/**
 * 🧬 WAVE 2093 COG-5: Perfil de thresholds por vibe.
 * Jazz/chill necesitan umbrales más altos (dinámica natural no es "spike").
 * Techno/industrial usan los BASE (ya calibrados para EDM).
 * 
 * Formato: multiplicador sobre BASE. >1 = menos sensible, <1 = más sensible.
 */
const VIBE_THRESHOLD_PROFILES: Record<string, number> = {
  'techno-club':        1.0,    // Base — calibrado para EDM
  'techno-industrial':  0.90,   // Ligeramente más sensible (dinámicas más extremas)
  'techno-atmospheric': 1.15,   // Más conservador (ambient tiene dinámicas suaves)
  'fiesta-latina':      1.0,    // Ritmos fuertes, mantener base
  'pop-rock':           1.20,   // Dinámicas naturales, necesita más delta para spike
  'chill-lounge':       1.50,   // MUY conservador: jazz/lounge tiene dinámicas sutiles
  'ambient-organic':    1.60,   // Máxima conservación: ambient puro no tiene "spikes"
}

/** Obtiene el multiplicador de threshold para el vibe actual */
function getVibeThresholdMultiplier(vibeId?: string): number {
  if (!vibeId) return 1.0
  return VIBE_THRESHOLD_PROFILES[vibeId] ?? 1.0
}

/**
 * Actualiza el historial de energía
 */
function updateEnergyHistory(energy: number): void {
  energyHistory.push(energy)
  if (energyHistory.length > MAX_ENERGY_HISTORY) {
    energyHistory.shift()
  }
}

/**
 * Calcula la tendencia de energía (derivada suavizada)
 * 🔮 WAVE 1172: Usa umbrales calibrados
 * 🧬 WAVE 2093 COG-5: Multiplicador por vibe — jazz/chill más conservadores
 * @returns 'rising' | 'falling' | 'stable' | 'spike'
 */
function calculateEnergyTrend(vibeMultiplier: number = 1.0): 'rising' | 'falling' | 'stable' | 'spike' {
  if (energyHistory.length < 10) return 'stable'
  
  const recent = energyHistory.slice(-10)
  const older = energyHistory.slice(-20, -10)
  
  if (older.length < 5) return 'stable'
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
  const delta = recentAvg - olderAvg
  
  // 🧬 WAVE 2093 COG-5: Umbrales escalados por vibe
  const spikeThreshold = ENERGY_THRESHOLDS.SPIKE_DELTA * vibeMultiplier
  const risingThreshold = ENERGY_THRESHOLDS.RISING_DELTA * vibeMultiplier
  const fallingThreshold = ENERGY_THRESHOLDS.FALLING_DELTA * vibeMultiplier
  
  if (delta > spikeThreshold) return 'spike'
  if (delta > risingThreshold) return 'rising'
  if (delta < fallingThreshold) return 'falling'
  return 'stable'
}

/**
 * Calcula la velocidad de subida de energía (para estimar tiempo hasta pico)
 * @returns Velocidad de energía por frame (0-1 scale)
 */
function calculateEnergyVelocity(): number {
  if (energyHistory.length < 5) return 0
  
  const recent = energyHistory.slice(-5)
  const velocities: number[] = []
  
  for (let i = 1; i < recent.length; i++) {
    velocities.push(recent[i] - recent[i - 1])
  }
  
  return velocities.reduce((a, b) => a + b, 0) / velocities.length
}

/**
 * 🔮 WAVE 1169/1172: REACTIVE PREDICTION
 * Predice basándose en TENDENCIA DE ENERGÍA BRUTA, no en etiquetas de sección.
 * 
 * WAVE 1172: Umbrales más bajos para feedback visual más activo
 * - Spike threshold: 0.70 (was 0.85)
 * - Tension for drop: 0.5 (was 0.6)
 * 
 * @param pattern - Patrón musical actual
 * @param currentEnergy - Energía actual (0-1)
 * @param bpm - BPM actual
 * @returns Predicción reactiva basada en energía
 */
export function predictFromEnergy(
  pattern: SeleneMusicalPattern,
  currentEnergy: number,
  bpm: number = 120
): MusicalPrediction {
  const timestamp = Date.now()
  
  // Actualizar historial
  updateEnergyHistory(currentEnergy)
  
  // 🧬 WAVE 2093 COG-5: Threshold scaling por vibe
  const vibeMultiplier = getVibeThresholdMultiplier(pattern.vibeId)
  const trend = calculateEnergyTrend(vibeMultiplier)
  const velocity = calculateEnergyVelocity()
  
  // ═══════════════════════════════════════════════════════════════════════
  // SPIKE DETECTION: Energía subiendo MUY rápido → Algo grande viene
  // WAVE 1172: Umbral bajado a 0.70
  // WAVE 2093 COG-5: Thresholds escalados por vibe profile
  // ═══════════════════════════════════════════════════════════════════════
  const spikeThreshold = ENERGY_THRESHOLDS.MIN_ENERGY_FOR_SPIKE * vibeMultiplier
  const risingThreshold = ENERGY_THRESHOLDS.MIN_ENERGY_FOR_RISING * vibeMultiplier
  const dropTensionThreshold = ENERGY_THRESHOLDS.TENSION_FOR_DROP * vibeMultiplier
  
  if (trend === 'spike' && currentEnergy >= spikeThreshold) {
    // Estimar tiempo hasta pico basado en velocidad y energía actual
    const remainingEnergy = 1 - currentEnergy
    const framesUntilPeak = velocity > 0 ? Math.ceil(remainingEnergy / velocity) : 60
    // 🛡️ WAVE 2093.1: Guard bpm=0 → Infinity. Default 120 BPM si no hay detección.
    const safeBpm = (bpm > 0 && Number.isFinite(bpm)) ? bpm : 120
    const msPerBeat = 60000 / safeBpm
    const beatsUntilPeak = Math.max(2, Math.round((framesUntilPeak / 60) * (safeBpm / 60)))
    
    return {
      type: 'energy_spike',
      probableSection: 'drop',
      probability: 0.75 + (velocity * 2), // Mayor velocidad = mayor certeza
      estimatedTimeMs: beatsUntilPeak * msPerBeat,
      estimatedBeats: beatsUntilPeak,
      reasoning: `⚡ ENERGY SPIKE: +${(velocity * 100).toFixed(1)}%/frame → Peak en ~${beatsUntilPeak} beats`,
      suggestedActions: [
        { type: 'prepare', effect: 'intensity_ramp', intensity: 0.8, durationMs: 1500, timingOffsetMs: -1500 },
        { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 200, timingOffsetMs: 0 },
      ],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🩸 WAVE 2095: TEXTURAL DROP — Detección para minimal techno / micro-house
  // 🔧 WAVE 2096.1: DEMOTED — Con Pacemaker Bridge activo, SimpleSectionTracker
  // detecta drops REALES (bassRatio + hasKick + weightedEnergy).
  // TEXTURAL DROP se mantiene como FALLBACK con umbrales ESTRICTOS:
  // Solo activa si la energía es realmente alta Y la tensión es significativa.
  // Antes: E>0.40, R>0.25, T>0.20 → fired EVERY FRAME (inútil)
  // Ahora: E>0.65, R>0.40, T>0.35 → solo activa en momentos reales
  // ═══════════════════════════════════════════════════════════════════════
  const texturalEnergyOk = currentEnergy > 0.65
  const texturalRhythmOk = pattern.rhythmicIntensity > 0.40
  const texturalTensionOk = pattern.emotionalTension > 0.35
  const texturalTrendOk = trend === 'rising'  // Only rising, NOT stable
  
  // 🔧 WAVE 2096.1: Throttled diagnostic — every ~10 seconds (600 frames) instead of 2s
  if (energyHistory.length % 600 === 0 && currentEnergy > 0.50) {
    console.log(
      `[PREDICTION 🔮] TEXTURAL DROP CHECK: ` +
      `E=${currentEnergy.toFixed(2)}${texturalEnergyOk ? '✅' : '❌>0.65'} | ` +
      `R=${pattern.rhythmicIntensity.toFixed(2)}${texturalRhythmOk ? '✅' : '❌>0.40'} | ` +
      `T=${pattern.emotionalTension.toFixed(2)}${texturalTensionOk ? '✅' : '❌>0.35'} | ` +
      `Trend=${trend}${texturalTrendOk ? '✅' : '❌'}`
    )
  }
  
  if (texturalEnergyOk && texturalRhythmOk && texturalTensionOk && texturalTrendOk) {
    const texturalProb = 0.55 + (currentEnergy * 0.12) + (pattern.emotionalTension * 0.08)
    // 🩸 WAVE 2101.5: Throttle TEXTURAL DROP — máximo 1 log cada 60 frames (~1s)
    // Antes: spammeaba CADA frame. 30 líneas de TEXTURAL DROP ACTIVATED en 2 segundos.
    if (energyHistory.length % 60 === 0) {
      console.log(
        `[PREDICTION 🔮] 🎭 TEXTURAL DROP ACTIVATED! ` +
        `E=${(currentEnergy * 100).toFixed(0)}% R=${(pattern.rhythmicIntensity * 100).toFixed(0)}% ` +
        `T=${(pattern.emotionalTension * 100).toFixed(0)}% Trend=${trend} → prob=${texturalProb.toFixed(2)}`
      )
    }
    // 🩸 WAVE 2101.5: TEXTURAL DROP ya NO es `drop_incoming`.
    // Es `buildup_starting` con energía alta — indica que algo se construye,
    // no que viene un drop. Un drop REAL viene del section pattern matching
    // ([buildup, buildup] → drop, probability 0.90). TEXTURAL DROP no tiene
    // la certeza para reclamar "drop_incoming" y bypasear gates.
    return {
      type: 'buildup_starting',
      probableSection: 'buildup',
      probability: Math.min(0.65, texturalProb),  // 🩸 Capped más bajo: no competir con drops reales
      estimatedTimeMs: 3000,  // 🩸 WAVE 2101.5: 3s, no 2s — no activar urgency gates
      estimatedBeats: 4,
      reasoning: `🎭 TEXTURAL DROP: Energy=${(currentEnergy * 100).toFixed(0)}% sustained | ` +
                 `Rhythm=${(pattern.rhythmicIntensity * 100).toFixed(0)}% | ` +
                 `Tension=${(pattern.emotionalTension * 100).toFixed(0)}%`,
      suggestedActions: [
        { type: 'execute', effect: 'flash', intensity: 0.85, durationMs: 200, timingOffsetMs: 0 },
      ],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // RISING ENERGY: Subida sostenida → Buildup probable
  // WAVE 1172: Umbral bajado a 0.35
  // ═══════════════════════════════════════════════════════════════════════
  if (trend === 'rising' && currentEnergy > risingThreshold) {
    // 🛡️ WAVE 2093.1: Guard bpm=0 → Infinity
    const safeBpmRising = (bpm > 0 && Number.isFinite(bpm)) ? bpm : 120
    const msPerBeat = 60000 / safeBpmRising
    const estimatedBeats = Math.round(8 - (currentEnergy * 4)) // Menos beats cuanto más alta la energía
    
    return {
      type: 'buildup_starting',
      probableSection: 'buildup',
      probability: 0.55 + (currentEnergy * 0.2), // 55-75% según energía
      estimatedTimeMs: estimatedBeats * msPerBeat,
      estimatedBeats,
      reasoning: `📈 RISING ENERGY: ${(currentEnergy * 100).toFixed(0)}% y subiendo → Buildup detectado`,
      suggestedActions: [
        { type: 'prepare', effect: 'intensity_ramp', intensity: 0.5, durationMs: 2000, timingOffsetMs: -2000 },
      ],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 WAVE 1172: RISING pero bajo umbral → Mostrar "ENERGY BUILDING"
  // UI Feedback activo aunque no haya predicción fuerte
  // ═══════════════════════════════════════════════════════════════════════
  if (trend === 'rising') {
    return {
      type: 'buildup_starting',
      probableSection: null,
      probability: 0.35 + (currentEnergy * 0.15), // 35-50% - bajo pero visible
      estimatedTimeMs: 8000,
      estimatedBeats: 8,
      reasoning: `⚠️ ENERGY BUILDING: ${(currentEnergy * 100).toFixed(0)}% | Trend: Rising`,
      suggestedActions: [],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DROP DETECTION: Tensión alta + energía cayendo → Drop incoming
  // WAVE 1172: Umbral de tensión bajado a 0.5
  // ═══════════════════════════════════════════════════════════════════════
  if (pattern.emotionalTension > dropTensionThreshold && trend === 'falling') {
    return {
      type: 'drop_incoming',
      probableSection: 'drop',
      probability: 0.60 + (pattern.emotionalTension * 0.2),
      estimatedTimeMs: 4000,
      estimatedBeats: 4,
      reasoning: `🎯 DROP INCOMING: Tension ${(pattern.emotionalTension * 100).toFixed(0)}% + Energy falling`,
      suggestedActions: [
        { type: 'prepare', effect: 'intensity_ramp', intensity: 0.7, durationMs: 2000, timingOffsetMs: -2000 },
        { type: 'execute', effect: 'flash', intensity: 1.0, durationMs: 150, timingOffsetMs: 0 },
      ],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FALLING ENERGY: Bajando → Recovery/Breakdown
  // 🌊 WAVE 7557: ORGANIC KINEMATIC CONFIDENCE — Exterminated the hardcoded
  //   probability: 0.50 magic number. The confidence now derives from the
  //   physical kinematics of the energy descent:
  //
  //   dropVelocity = max(0, -velocity)  (only counts when ACTUALLY falling)
  //   normalizedDrop = clamp(dropVelocity / 0.05, 0, 1)
  //     — 0.05/frame = steep drop (full range in ~20 frames ≈ 330ms @ 60fps)
  //     — Below 0.01/frame = gentle drift, barely a breakdown
  //
  //   organicProbability = 0.45 + (normalizedDrop * 0.45)
  //     — Gentle drift (v≈0): 0.45 — "maybe something is happening"
  //     — Steep cliff (v≥0.05): 0.90 — "the floor just fell out"
  //
  //   🩸 WAVE 7557.1: CRITICAL FIX — was using Math.abs(velocity) which gave
  //   moderate probability even when energy was RISING (flashbang). Now uses
  //   Math.max(0, -velocity): if velocity > 0 (rising), dropVelocity = 0,
  //   probability = 0.45 (below 0.55 threshold). This prevents false
  //   energy_drop predictions from winning the predictCombined arbitration
  //   during flashbangs where smoothedEnergy lags behind rawEnergy.
  // ═══════════════════════════════════════════════════════════════════════
  if (trend === 'falling' && currentEnergy < 0.5) {
    // 🌊 WAVE 7557.1: Only count NEGATIVE velocity (actually falling).
    // If velocity > 0 (energy rising, e.g. flashbang just happened),
    // dropVelocity = 0 → probability = 0.45 (below threshold, no relaxation).
    const dropVelocity = Math.max(0, -velocity)
    const DROP_VELOCITY_STEEP = 0.05  // frames-per-frame ≈ full range in ~20 frames
    const normalizedDrop = Math.max(0, Math.min(1, dropVelocity / DROP_VELOCITY_STEEP))
    const organicProbability = 0.45 + (normalizedDrop * 0.45)  // 0.45 → 0.90

    // ETA scales inversely with velocity: steep drops arrive sooner.
    // Gentle drift (v≈0) → 6s; steep cliff (v≥0.05) → 2s.
    const safeBpmFalling = (bpm > 0 && Number.isFinite(bpm)) ? bpm : 120
    const msPerBeatFalling = 60000 / safeBpmFalling
    const estimatedBeatsFalling = Math.max(2, Math.round(8 - (normalizedDrop * 6)))
    const estimatedMsFalling = estimatedBeatsFalling * msPerBeatFalling

    return {
      type: 'energy_drop',
      probableSection: 'breakdown',
      probability: organicProbability,
      estimatedTimeMs: estimatedMsFalling,
      estimatedBeats: estimatedBeatsFalling,
      reasoning: `📉 FALLING ENERGY: ${(currentEnergy * 100).toFixed(0)}% y bajando (v=${dropVelocity.toFixed(4)}/frame, prob=${organicProbability.toFixed(2)}) → Recovery mode`,
      suggestedActions: [
        { type: 'recover', effect: 'breathe', intensity: 0.4, durationMs: 3000, timingOffsetMs: 0 },
      ],
      timestamp,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STABLE: Sin cambio significativo → Analizar flow
  // ═══════════════════════════════════════════════════════════════════════
  return {
    type: 'none',
    probableSection: null,
    probability: 0,
    estimatedTimeMs: 0,
    estimatedBeats: 0,
    reasoning: `🌊 STABLE FLOW: ${(currentEnergy * 100).toFixed(0)}% | Analyzing...`,
    suggestedActions: [],
    timestamp,
  }
}

/**
 * 🔮 WAVE 1169: Combined Prediction
 * 🔮 WAVE 1190: PROJECT CASSANDRA - Integración de Spectral Buildup
 * 
 * Combina predicción por sección + predicción por energía + spectral buildup
 * El spectral buildup detecta FÍSICAMENTE el buildup en el audio:
 * - Rising rolloff (brillo sube)
 * - Rising flatness (ruido blanco sube)
 * - Falling subbass (el bajo desaparece antes del drop)
 * 
 * @param pattern - Patrón musical actual
 * @param currentEnergy - Energía actual (0-1)
 * @param spectralBuildupScore - Score de buildup espectral (0-1) desde SectionTracker
 */
export function predictCombined(
  pattern: SeleneMusicalPattern,
  currentEnergy: number,
  spectralBuildupScore?: number
): MusicalPrediction {
  // Predicción tradicional por sección
  const sectionPrediction = predict(pattern)
  
  // Predicción reactiva por energía
  const energyPrediction = predictFromEnergy(pattern, currentEnergy, pattern.bpm)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔮 WAVE 1190: PROJECT CASSANDRA - Spectral Buildup Boost
  // 
  // Si detectamos buildup espectral FÍSICO (>0.4), SABEMOS que viene algo.
  // Esto NO es heurística, es análisis real del espectro de frecuencias.
  // El sonido LITERALMENTE está cambiando hacia un buildup.
  // ═══════════════════════════════════════════════════════════════════════════
  
  const spectralScore = spectralBuildupScore ?? 0
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 WAVE 2096.1: ENERGY OVERRIDE REMOVED
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2096 added an override where energy drops ALWAYS won over section prediction.
  // This was a workaround for broken SimpleSectionTracker (bpm=0 → section='breakdown' always).
  // 
  // With PACEMAKER BRIDGE (WAVE 2096.1), SimpleSectionTracker receives real BPM again.
  // Section detection works correctly → predict() gives accurate results.
  // The override caused "always drop_incoming" (TEXTURAL DROP fired every frame).
  //
  // RESTORED: Standard probability-based arbitration.
  // The better prediction wins, regardless of type.
  // ═══════════════════════════════════════════════════════════════════════

  // 🌊 WAVE 7558: STRUCTURAL BREAKDOWN BONUS — Symmetric to the spectral
  // buildup boost below. The energy heuristic (predictFromEnergy) can detect
  // rising energy (buildup, drop, spike) by looking at velocity/trend. But
  // it CANNOT detect structural breakdowns — those require knowledge of the
  // song's section structure, which only the Markov chain has.
  //
  // Without this bonus, the energy heuristic's buildup_starting (prob 0.55+)
  // always beats the Markov chain's breakdown_imminent (prob ~0.40-0.50),
  // so breakdown_imminent NEVER surfaces in predictCombined. The YIN YANG
  // zone override in the Dream Simulator never triggers for low-energy
  // events, and ambient/transit effects are never simulated proactively.
  //
  // The bonus is +0.15 — enough to let breakdown_imminent (0.45) compete
  // with buildup_starting (0.55), but not enough to override a strong
  // buildup (0.70+). The bonus only applies when:
  //   1. The Markov chain predicts breakdown_imminent (structural knowledge)
  //   2. The energy heuristic predicts something ELSE (not energy_drop,
  //      which would be redundant — both agree on low energy)
  let bestPrediction: MusicalPrediction
  if (sectionPrediction.type === 'breakdown_imminent'
      && energyPrediction.type !== 'energy_drop'
      && energyPrediction.type !== 'breakdown_imminent') {
    const structuralBonus = 0.15
    const boostedSectionProb = Math.min(0.85, sectionPrediction.probability + structuralBonus)
    if (boostedSectionProb >= energyPrediction.probability) {
      bestPrediction = {
        ...sectionPrediction,
        probability: boostedSectionProb,
        reasoning: `${sectionPrediction.reasoning} | 🌊 STRUCTURAL BREAKDOWN BONUS: +${structuralBonus.toFixed(2)} (Markov chain overrides energy heuristic)`,
      }
    } else {
      bestPrediction = energyPrediction
    }
  } else {
    bestPrediction = energyPrediction.probability > sectionPrediction.probability
      ? energyPrediction
      : sectionPrediction
  }
  
  // Si spectral buildup > 0.4, BOOST a la predicción
  if (spectralScore > 0.4) {
    // Si ya estamos prediciendo buildup/drop, aumentar probabilidad
    if (bestPrediction.type === 'buildup_starting' || 
        bestPrediction.type === 'drop_incoming' ||
        bestPrediction.type === 'energy_spike') {
      // Boost proporcional al score espectral
      const spectralBoost = (spectralScore - 0.4) * 0.5 // Max +0.3 para score=1.0
      bestPrediction = {
        ...bestPrediction,
        probability: Math.min(0.95, bestPrediction.probability + spectralBoost),
        reasoning: `${bestPrediction.reasoning} | 🔊 SPECTRAL BUILDUP: ${(spectralScore * 100).toFixed(0)}%`,
      }
    } else if (spectralScore > 0.6) {
      // Spectral buildup fuerte pero no estamos prediciendo buildup/drop
      // CREAR una predicción de buildup desde cero
      const msPerBeat = 60000 / pattern.bpm
      const estimatedBeats = 4 + (1 - spectralScore) * 4 // 4-8 beats según score
      
      bestPrediction = {
        type: 'buildup_starting',
        probableSection: 'buildup',
        probability: spectralScore * 0.85, // El spectral score ES la probabilidad
        estimatedTimeMs: estimatedBeats * msPerBeat,
        estimatedBeats,
        reasoning: `🔊 SPECTRAL BUILDUP DETECTED: Rolloff↑ Flatness↑ SubBass↓ (${(spectralScore * 100).toFixed(0)}%)`,
        suggestedActions: [
          { type: 'prepare', effect: 'intensity_ramp', intensity: 0.6, durationMs: 2000, timingOffsetMs: -2000 },
          { type: 'execute', effect: 'strobe', intensity: 0.9, durationMs: 500, timingOffsetMs: 0 },
        ],
        timestamp: pattern.timestamp,
      }
    }
  }
  
  return bestPrediction
}

/**
 * Obtiene el estado del historial de energía (para debug)
 */
export function getEnergyPredictionState(): {
  historyLength: number
  trend: string
  velocity: number
} {
  return {
    historyLength: energyHistory.length,
    trend: calculateEnergyTrend(),
    velocity: calculateEnergyVelocity(),
  }
}

/**
 * Reset del historial de energía (para tests)
 */
export function resetEnergyHistory(): void {
  energyHistory = []
}
