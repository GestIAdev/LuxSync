/**
 * TheiaTelemetryRing.ts — Euclid Oracle · Fase E0 (Telemetry Ring Core)
 *
 * Anillo de telemetría CPU→GPU de 256 bytes exactos (64 slots × 4 B).
 * Un único productor (TickEngine en main) escribe a 44 Hz; N lectores
 * (theta.worker, ventana de salida) pollean libremente.
 *
 * Sincronización: SEQLOCK sobre el slot 0.
 *   Escritor: SEQ→impar, escribe, SEQ→par.  Nunca espera.
 *   Lector:   copia si SEQ es par y no cambió durante la copia.
 *             Máx. 3 reintentos → fallback al último scratch válido.
 *
 * Zero-alloc en hot-path por contrato: el writer escribe directo sobre la
 * vista Float32 del SAB (fill callback, sin staging); el reader copia a un
 * scratch Float32Array(64) pre-asignado que `read()` devuelve SIEMPRE por
 * referencia — ningún objeto nace en ningún path.
 *
 * Fuente de verdad: EUCLID_ORACLE_BLUEPRINT §2.3 (layout) + §3.3 (schema).
 */

// ─────────────────────────── Dimensiones ───────────────────────────

export const TELEMETRY_RING_BYTES = 256
export const TELEMETRY_RING_SLOTS = 64
export const TELEMETRY_PAYLOAD_SLOTS = 60 // slots 4..63
export const SCHEMA_VERSION = 1

// ───────────────────────── Header (Int32) ──────────────────────────

export const SLOT_SEQ = 0      // seqlock — impar = escritura en curso
export const SLOT_TICK_ID = 1  // frameCount del TickEngine (correlación FrameContextRing)
export const SLOT_FLAGS = 2    // bitfield booleano
export const SLOT_ENUMS = 3    // schemaVersion | predictionType<<8 | huntState<<16 | energyZone<<24
export const SLOT_PAYLOAD_BASE = 4

/** FLAGS — bitfield booleano (blueprint §2.3). */
export const TEL_FLAG = {
  AUDIO_LIVE: 0,
  PLL_LOCKED: 1,
  ON_BEAT: 2,
  KICK: 3,
  KICK_EDGE: 4,
  SNARE: 5,
  HIHAT: 6,
  PREDICTION_ACTIVE: 7,
  BREAKDOWN: 8,
  APOCALYPSE: 9,
  ACID: 10,
  COLOR_SNAP: 11,
  RHYTHMIC_VOID: 12,
} as const

export type TelFlagBit = (typeof TEL_FLAG)[keyof typeof TEL_FLAG]

export function telFlag(flags: number, bit: TelFlagBit): boolean {
  return ((flags >>> bit) & 1) === 1
}

/** ENUMS — 4 bytes empaquetados en el slot Int32 (blueprint §2.3). */
export interface TelemetryEnums {
  schemaVersion: number
  predictionType: number // 0 none · 1 drop_incoming · 2 buildup_starting · 3 breakdown_imminent · 4 transition_beat
  huntState: number      // 0 sleeping · 1 stalking · 2 evaluating · 3 striking · 4 learning
  energyZone: number     // Selene: 0 calm · 1 rising · 2 peak · 3 falling
}

export function packEnums(e: TelemetryEnums): number {
  return (
    (e.schemaVersion & 0xff) |
    ((e.predictionType & 0xff) << 8) |
    ((e.huntState & 0xff) << 16) |
    ((e.energyZone & 0xff) << 24)
  )
}

export function unpackEnums(packed: number, out: TelemetryEnums): TelemetryEnums {
  out.schemaVersion = packed & 0xff
  out.predictionType = (packed >>> 8) & 0xff
  out.huntState = (packed >>> 16) & 0xff
  out.energyZone = (packed >>> 24) & 0xff
  return out
}

// ───────────────────── Schema declarativo (payload) ─────────────────────

/** Tipo de suavizado que el Smoother (fase E1) aplicará a cada slot. */
export type TelSmoothKind = 'linear' | 'circular' | 'extrapolate' | 'none'

export interface TelemetrySlotDescriptor {
  /** Índice absoluto en la vista Float32 (4..63). */
  readonly slot: number
  /** Nombre semántico canónico del campo (§2.3). */
  readonly name: string
  /** Macro/uniform GLSL que el preámbulo generará (§3.5). Vacío en reservados. */
  readonly uniform: string
  /** Estrategia de suavizado. */
  readonly kind: TelSmoothKind
  /** Coeficiente one-pole de ataque @60 Hz (solo 'linear'). */
  readonly attack?: number
  /** Coeficiente one-pole de release @60 Hz (solo 'linear'). */
  readonly release?: number
}

/**
 * TELEMETRY_SCHEMA — descriptor único que alimenta al writer, al reader,
 * al generador del preámbulo GLSL y a los tests. Los índices JAMÁS se
 * escriben a mano en otro sitio.
 */
export const TELEMETRY_SCHEMA: readonly TelemetrySlotDescriptor[] = [
  // CLOCK
  { slot: 4,  name: 'T_SEC',             uniform: 'u_tSec',             kind: 'none' },
  { slot: 5,  name: 'BPM',               uniform: 'u_bpm',              kind: 'linear' },
  { slot: 6,  name: 'BEAT_PHASE',        uniform: 'u_beatPhase',        kind: 'extrapolate' },
  { slot: 7,  name: 'BAR_PHASE',         uniform: 'u_barPhase',         kind: 'circular' },
  { slot: 8,  name: 'BEAT_CONFIDENCE',   uniform: 'u_beatConfidence',   kind: 'linear' },
  { slot: 9,  name: 'ENERGY',            uniform: 'u_energy',           kind: 'linear' },
  // GODEAR — 7 bandas tácticas (post-AGC)
  { slot: 10, name: 'SUB_BASS',          uniform: 'u_subBass',          kind: 'linear', attack: 0.6, release: 0.1 },
  { slot: 11, name: 'BASS',              uniform: 'u_bass',             kind: 'linear' },
  { slot: 12, name: 'LOW_MID',           uniform: 'u_lowMid',           kind: 'linear' },
  { slot: 13, name: 'MID',               uniform: 'u_mid',              kind: 'linear' },
  { slot: 14, name: 'HIGH_MID',          uniform: 'u_highMid',          kind: 'linear' },
  { slot: 15, name: 'TREBLE',            uniform: 'u_treble',           kind: 'linear' },
  { slot: 16, name: 'ULTRA_AIR',         uniform: 'u_ultraAir',         kind: 'linear' },
  // GODEAR — métricas perceptuales
  { slot: 17, name: 'CENTROID_N',        uniform: 'u_brightnessSpec',   kind: 'linear' },
  { slot: 18, name: 'FLATNESS',          uniform: 'u_flatness',         kind: 'linear' },
  { slot: 19, name: 'CREST_N',           uniform: 'u_crestN',           kind: 'linear' },
  { slot: 20, name: 'HARSHNESS',         uniform: 'u_harshness',        kind: 'linear' },
  { slot: 21, name: 'SPECTRAL_FLUX',     uniform: 'u_spectralFlux',     kind: 'linear', attack: 0.8, release: 0.3 },
  { slot: 22, name: 'TRANSIENT_DENSITY', uniform: 'u_transientDensity', kind: 'linear' },
  { slot: 23, name: 'SATURATION',        uniform: 'u_saturation',       kind: 'linear' },
  { slot: 24, name: 'CHROMA_HUE',        uniform: 'u_chromaHue',        kind: 'circular' },
  { slot: 25, name: 'CHROMA_FLUX',       uniform: 'u_chromaFlux',       kind: 'linear' },
  // RITMO
  { slot: 26, name: 'KICK_ENERGY',       uniform: 'u_kickEnergy',       kind: 'linear', attack: 1.0, release: 0.25 },
  { slot: 27, name: 'SNARE_ENERGY',      uniform: 'u_snareEnergy',      kind: 'linear' },
  { slot: 28, name: 'HIHAT_ENERGY',      uniform: 'u_hihatEnergy',      kind: 'linear' },
  { slot: 29, name: 'SYNCOPATION',       uniform: 'u_syncopation',      kind: 'linear' },
  // SELENE / CASSANDRA
  { slot: 30, name: 'SEL_CONFIDENCE',    uniform: 'u_seleneConfidence', kind: 'linear' },
  { slot: 31, name: 'SEL_PRED_PROB',     uniform: 'u_predictionProb',   kind: 'linear' },
  { slot: 32, name: 'SEL_ETA_MS',        uniform: 'u_selEtaMs',         kind: 'extrapolate' },
  { slot: 33, name: 'SEL_ETA_BEATS',     uniform: 'u_selEtaBeats',      kind: 'extrapolate' },
  { slot: 34, name: 'SEL_TENSION',       uniform: 'u_tension',          kind: 'linear' },
  { slot: 35, name: 'SEL_BEAUTY',        uniform: 'u_beauty',           kind: 'linear' },
  { slot: 36, name: 'SEL_ZSCORE_N',      uniform: 'u_zScoreN',          kind: 'linear' },
  { slot: 37, name: 'SPECTRAL_BUILDUP',  uniform: 'u_spectralBuildup',  kind: 'linear' },
  // OMNILIQUID
  { slot: 38, name: 'MORPH_FACTOR',      uniform: 'u_morphFactor',      kind: 'linear', attack: 0.05, release: 0.02 },
  { slot: 39, name: 'RECOVERY_FACTOR',   uniform: 'u_recoveryFactor',   kind: 'linear' },
  { slot: 40, name: 'LQ_FLOOR',          uniform: 'u_lqFloor',          kind: 'linear' },
  { slot: 41, name: 'LQ_AMBIENT',        uniform: 'u_lqAmbient',        kind: 'linear' },
  { slot: 42, name: 'LQ_AIR',            uniform: 'u_lqAir',            kind: 'linear' },
  { slot: 43, name: 'RESERVED_43',       uniform: '',                   kind: 'none' },
  // CHROMAGRAMA — 12 bins C→B
  { slot: 44, name: 'CHROMA_0',          uniform: 'u_chroma0',          kind: 'linear' },
  { slot: 45, name: 'CHROMA_1',          uniform: 'u_chroma1',          kind: 'linear' },
  { slot: 46, name: 'CHROMA_2',          uniform: 'u_chroma2',          kind: 'linear' },
  { slot: 47, name: 'CHROMA_3',          uniform: 'u_chroma3',          kind: 'linear' },
  { slot: 48, name: 'CHROMA_4',          uniform: 'u_chroma4',          kind: 'linear' },
  { slot: 49, name: 'CHROMA_5',          uniform: 'u_chroma5',          kind: 'linear' },
  { slot: 50, name: 'CHROMA_6',          uniform: 'u_chroma6',          kind: 'linear' },
  { slot: 51, name: 'CHROMA_7',          uniform: 'u_chroma7',          kind: 'linear' },
  { slot: 52, name: 'CHROMA_8',          uniform: 'u_chroma8',          kind: 'linear' },
  { slot: 53, name: 'CHROMA_9',          uniform: 'u_chroma9',          kind: 'linear' },
  { slot: 54, name: 'CHROMA_10',         uniform: 'u_chroma10',         kind: 'linear' },
  { slot: 55, name: 'CHROMA_11',         uniform: 'u_chroma11',         kind: 'linear' },
  // WIRE — los slots 56/57 transportan FLAGS/ENUMS como BITS Int32 en el
  // wire buffer del pump (ver snapshotTelemetryPayload). En el anillo
  // local de main quedan a 0 — el header Int32 es su casa real.
  { slot: 56, name: 'WIRE_FLAGS',        uniform: '',                   kind: 'none' },
  { slot: 57, name: 'WIRE_ENUMS',        uniform: '',                   kind: 'none' },
  // RESERVA — stereo width/balance, futuros motores
  { slot: 58, name: 'RESERVED_58',       uniform: '',                   kind: 'none' },
  { slot: 59, name: 'RESERVED_59',       uniform: '',                   kind: 'none' },
  { slot: 60, name: 'RESERVED_60',       uniform: '',                   kind: 'none' },
  { slot: 61, name: 'RESERVED_61',       uniform: '',                   kind: 'none' },
  { slot: 62, name: 'RESERVED_62',       uniform: '',                   kind: 'none' },
  { slot: 63, name: 'RESERVED_63',       uniform: '',                   kind: 'none' },
]

/** Lookup nombre → slot (para el writer del TickEngine sin literales). */
export const TELEMETRY_SLOT: Readonly<Record<string, number>> = (() => {
  const m: Record<string, number> = {}
  for (const d of TELEMETRY_SCHEMA) m[d.name] = d.slot
  return Object.freeze(m)
})()

// ─────────────────────────── Construcción ───────────────────────────

export function createTelemetryRing(): SharedArrayBuffer {
  return new SharedArrayBuffer(TELEMETRY_RING_BYTES)
}

function ringViews(sab: SharedArrayBuffer | ArrayBuffer): {
  i32: Int32Array
  f32: Float32Array
} {
  if (sab.byteLength !== TELEMETRY_RING_BYTES) {
    throw new Error(
      `[TheiaTelemetryRing] expected ${TELEMETRY_RING_BYTES}B, got ${sab.byteLength}B`,
    )
  }
  return {
    i32: new Int32Array(sab, 0, SLOT_PAYLOAD_BASE),
    f32: new Float32Array(sab),
  }
}

// ─────────────────────────── TelemetryWriter ───────────────────────────

/**
 * Escritor seqlock — proceso MAIN (TickEngine), una invocación por tick.
 * Presupuesto < 1 µs: 3 Atomics.store de header + fill directo sobre el f32.
 */
export class TelemetryWriter {
  private readonly i32: Int32Array
  private readonly f32: Float32Array

  constructor(sab: SharedArrayBuffer | ArrayBuffer) {
    const v = ringViews(sab)
    this.i32 = v.i32
    this.f32 = v.f32
  }

  /**
   * Publica un frame de telemetría. `fill` recibe la vista Float32 DEL
   * PROPIO ANILLO: el llamador escribe `p[TELEMETRY_SLOT.BPM] = 126.4`
   * directamente — cero staging, cero objetos. El seqlock (SEQ impar→par)
   * garantiza que un lector concurrente descarte cualquier lectura que
   * pise esta ventana.
   */
  publish(
    tickId: number,
    flags: number,
    enumsPacked: number,
    fill: (payload: Float32Array) => void,
  ): void {
    const s = Atomics.load(this.i32, SLOT_SEQ)
    Atomics.store(this.i32, SLOT_SEQ, s + 1) // impar — escritura en curso
    Atomics.store(this.i32, SLOT_TICK_ID, tickId | 0)
    Atomics.store(this.i32, SLOT_FLAGS, flags | 0)
    Atomics.store(this.i32, SLOT_ENUMS, enumsPacked | 0)
    fill(this.f32)
    Atomics.store(this.i32, SLOT_SEQ, s + 2) // par — commit
  }
}

// ─────────────────────────── TelemetryReader ───────────────────────────

const MAX_READ_ATTEMPTS = 3

/**
 * Lector seqlock — worker / ventana de salida.
 * `read()` devuelve SIEMPRE el mismo `scratch` pre-asignado (o null):
 * nunca asigna. Novedad por SEQ: si no cambió, retorna null sin copiar
 * (idéntico a FrameContextReader.readIfChanged).
 */
export class TelemetryReader {
  /** Buffer de lectura pre-asignado — identidad estable entre llamadas. */
  readonly scratch: Float32Array

  private readonly i32: Int32Array
  private readonly f32: Float32Array
  private lastSeq = -1
  private hasValid = false

  constructor(sab: SharedArrayBuffer | ArrayBuffer) {
    const v = ringViews(sab)
    this.i32 = v.i32
    this.f32 = v.f32
    this.scratch = new Float32Array(TELEMETRY_RING_SLOTS)
  }

  /**
   * Lee el anillo si hay datos nuevos.
   * @returns `scratch` con una copia consistente (fresca o, si los 3
   *          intentos colisionaron con una escritura, el último scratch
   *          válido), o `null` si SEQ no cambió desde la última lectura
   *          válida / nunca hubo lectura válida.
   */
  read(): Float32Array | null {
    if (this.hasValid) {
      if (Atomics.load(this.i32, SLOT_SEQ) === this.lastSeq) return null
    }
    for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
      const s1 = Atomics.load(this.i32, SLOT_SEQ)
      if ((s1 & 1) !== 0) continue // escritura en curso
      this.copyPayload()
      const s2 = Atomics.load(this.i32, SLOT_SEQ)
      if (s1 === s2) {
        this.lastSeq = s2
        this.hasValid = true
        return this.scratch
      }
      // s1 !== s2: el writer interrumpió la copia — descartar y reintentar.
    }
    // Fallback: último scratch válido (o null si jamás hubo uno).
    return this.hasValid ? this.scratch : null
  }

  /** Reinicia la detección de novedad (p.ej. tras recolgar el SAB). */
  resync(): void {
    this.lastSeq = Atomics.load(this.i32, SLOT_SEQ)
    this.hasValid = false
  }

  /**
   * Copia los 64 slots al scratch. Seam `protected`: los tests la
   * sobreescriben para simular un writer que interrumpe a mitad de copia.
   */
  protected copyPayload(): void {
    this.scratch.set(this.f32)
  }
}

// ─────────────────── Wire snapshot (pump → 256B buffer) ───────────────────

/**
 * Layout del wire buffer de 256B (`TheiaTelemetryPump` → consumidores):
 *   slots 0..3  → FrameContextRing verbatim (tickId, tsLo, tsHi, generation)
 *                 — el reloj maestro viaja en la cabecera (amendment 8215).
 *   slots 4..63 → payload Float32 del anillo Euclid, verbatim.
 *   slot  56    → FLAGS empaquetados como bits Int32 (WIRE_FLAGS).
 *   slot  57    → ENUMS empaquetados como bits Int32 (WIRE_ENUMS).
 * El SEQ/TICK_ID del header Euclid no cruza: tickId ya vive en el FC, y el
 * seqlock es una preocupación intra-proceso del lado del productor.
 * Los consumidores leen FLAGS/ENUMS con una vista Int32 sobre el espejo
 * local (los bits caben en cualquier slot — solo se interpretan distinto).
 */
export const WIRE_FLAGS_SLOT = 56
export const WIRE_ENUMS_SLOT = 57

/**
 * Copia seqlock-verificada del anillo al wire buffer. Escribe el payload
 * (slots 4..63) y FLAGS/ENUMS como bits en 56/57. NO toca los slots 0..3
 * (la cabecera FrameContext la escribe el pump).
 *
 * @returns `true` si la copia fue consistente; `false` si los 3 intentos
 *          colisionaron con una escritura — el caller debe descartar el
 *          destino para este tick (contenido potencialmente rasgado).
 */
export function snapshotTelemetryPayload(
  src: SharedArrayBuffer | ArrayBuffer,
  dst: ArrayBuffer | SharedArrayBuffer,
): boolean {
  if (src.byteLength !== TELEMETRY_RING_BYTES || dst.byteLength !== TELEMETRY_RING_BYTES) {
    return false
  }
  const srcI32 = new Int32Array(src, 0, SLOT_PAYLOAD_BASE)
  const srcF32 = new Float32Array(src)
  const dstI32 = new Int32Array(dst)
  const dstF32 = new Float32Array(dst)

  for (let attempt = 0; attempt < MAX_READ_ATTEMPTS; attempt++) {
    const s1 = Atomics.load(srcI32, SLOT_SEQ)
    if ((s1 & 1) !== 0) continue
    const flags = Atomics.load(srcI32, SLOT_FLAGS)
    const enums = Atomics.load(srcI32, SLOT_ENUMS)
    for (let i = SLOT_PAYLOAD_BASE; i < TELEMETRY_RING_SLOTS; i++) {
      dstF32[i] = srcF32[i]
    }
    dstI32[WIRE_FLAGS_SLOT] = flags
    dstI32[WIRE_ENUMS_SLOT] = enums
    const s2 = Atomics.load(srcI32, SLOT_SEQ)
    if (s1 === s2) return true
    // s1 !== s2: escritura concurrente — el destino puede estar rasgado; reintentar.
  }
  return false
}
