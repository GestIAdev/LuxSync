/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES — THE RUNTIME DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 7100 FASE 2: V2 project types demolished. Only shared runtime types remain.
 *
 * This file defines SHARED types used by the Chronos editor UI, ChronosEngine,
 * and automation system. The V3 project schema lives in LuxFileV3.ts.
 *
 * Shared types: Primitives, PlaybackConfig, Automation, Analysis, Context.
 * V3 types: See LuxFileV3.ts (LuxFileV3, ChronosProjectV3, LuxTrackV3, etc.)
 *
 * This is NOT the serialized .lux format. For the file format, see
 * LuxFileV3 in ./LuxFileV3.ts.
 * For the architectural map and barrel imports, see ./ProjectTypes.ts.
 *
 * @module chronos/core/types
 */

import type { EffectZone } from '../../core/effects/types'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CORE PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Timestamp en milisegundos (precisión de Chronos)
 */
export type TimeMs = number

/**
 * Valor normalizado (0-1)
 */
export type NormalizedValue = number

/**
 * ID único (UUID v4 o nanoid)
 */
export type ChronosId = string

/**
 * Color en formato hexadecimal
 */
export type HexColor = string

/**
 * Configuración de playback
 */
export interface PlaybackConfig {
  /** ¿Loop del proyecto? */
  loop: boolean
  
  /** Región de loop (si loop=true) */
  loopRegion: { startMs: TimeMs; endMs: TimeMs } | null
  
  /** ¿Snap a beat grid? */
  snapToBeat: boolean
  
  /** Granularidad del snap */
  snapResolution: SnapResolution
  
  /** Modo de override de Selene */
  overrideMode: ChronosOverrideMode
  
  /** Compensación de latencia para DMX (ms) */
  latencyCompensationMs: number
}

export type SnapResolution = 'bar' | 'beat' | 'half-beat' | 'quarter-beat' | 'off'

/**
 * Modo de override de Selene
 * 
 * - 'whisper': Chronos sugiere, Selene tiene última palabra en detalles
 * - 'full': Chronos dicta, Selene obedece completamente
 */
export type ChronosOverrideMode = 'whisper' | 'full'

// ═══════════════════════════════════════════════════════════════════════════
// ️ AUTOMATION LANES (CURVAS BÉZIER)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Targets de automation disponibles
 */
export type AutomationTarget = 
  | 'master.intensity'
  | 'master.speed'
  | 'master.hue_offset'
  | 'master.saturation'
  | 'effect.progress'
  | 'selene.energy'
  | `zone.${string}.intensity`
  | `param.${string}`

/**
 * 🎚️ AUTOMATION LANE
 * 
 * Una curva de automation para un parámetro específico.
 * Soporta interpolación Bézier cúbica.
 */
export interface AutomationLane {
  /** ID único */
  readonly id: ChronosId
  
  /** Nombre visible */
  name: string
  
  /** Parámetro target */
  target: AutomationTarget
  
  /** Rango de valores (para normalización y UI) */
  range: ValueRange
  
  /** Keyframes (puntos de control) */
  points: AutomationPoint[]
  
  /** ¿Lane activa? */
  enabled: boolean
  
  /** Valor default cuando no hay puntos */
  defaultValue: number
  
  /** Color de la curva */
  color: HexColor
}

/**
 * Rango de valores para normalización
 */
export interface ValueRange {
  min: number
  max: number
}

/**
 * 📍 AUTOMATION POINT
 * 
 * Un punto en la curva de automation.
 * Puede tener handles de control para interpolación Bézier.
 */
export interface AutomationPoint {
  /** ID único del punto */
  readonly id: ChronosId
  
  /** Timestamp (ms) */
  timeMs: TimeMs
  
  /** Valor normalizado (0-1, se mapea al range de la lane) */
  value: NormalizedValue
  
  /** Tipo de interpolación HACIA el siguiente punto */
  interpolation: InterpolationType
  
  /** Handle de control izquierdo (entrada, para Bézier) */
  handleIn?: BezierHandle
  
  /** Handle de control derecho (salida, para Bézier) */
  handleOut?: BezierHandle
}

/**
 * Tipos de interpolación
 */
export type InterpolationType = 
  | 'linear'
  | 'step'
  | 'bezier'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'smooth'

/**
 * Handle de control Bézier
 * 
 * Offset relativo al punto de anclaje.
 */
export interface BezierHandle {
  /** Offset temporal (ms, relativo al punto) */
  timeOffset: TimeMs
  
  /** Offset de valor (normalizado, relativo al punto) */
  valueOffset: number
}

/**
 * 🔑 KEYFRAME (Cambio discreto)
 * 
 * Para cambios que no son curvas suaves (ej: cambio de vibe).
 * Similar a AutomationPoint pero sin interpolación suave.
 */
export interface Keyframe<T = unknown> {
  /** ID único */
  readonly id: ChronosId
  
  /** Timestamp (ms) */
  timeMs: TimeMs
  
  /** Valor del keyframe */
  value: T
  
  /** ¿Transición instantánea o fade? */
  transition: 'instant' | 'fade'
  
  /** Duración del fade (ms, si transition='fade') */
  fadeDurationMs?: TimeMs
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏁 MARKERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de marker
 */
export type MarkerType = 
  | 'drop'
  | 'breakdown'
  | 'buildup'
  | 'section'
  | 'cue'
  | 'note'

/**
 * 🏁 CHRONOS MARKER
 * 
 * Punto de referencia en el timeline.
 */
export interface ChronosMarker {
  /** ID único */
  readonly id: ChronosId
  
  /** Timestamp (ms) */
  timeMs: TimeMs
  
  /** Tipo de marker */
  type: MarkerType
  
  /** Etiqueta visible */
  label: string
  
  /** Color */
  color: HexColor
  
  /** ¿Generado automáticamente por análisis? */
  autoGenerated: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 ANALYSIS DATA (GODEAR OFFLINE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔬 ANALYSIS DATA
 * 
 * Datos pre-computados del audio por GodEar Offline.
 * Usado para visualización y snap.
 */
export interface AnalysisData {
  /** Duration of audio in milliseconds */
  durationMs: TimeMs

  /** Waveform overview (para visualización) */
  waveform: WaveformData

  /** Energy heatmap */
  energyHeatmap: HeatmapData

  /** Grid de beats */
  beatGrid: BeatGridData

  /** Secciones detectadas */
  sections: DetectedSection[]

  /** Transients (para snap a hits) — legacy: timestamps only */
  transients: TimeMs[]

  // ═══════════════════════════════════════════════════════════════════════
  // 🩻 GODEAR UNLEASHED Phase 2: 3-Band Instrument-Classified Transients
  // Optional for backwards compatibility — populated when GodEar V3
  // transient detection is available (kick/snare/hihat isolation).
  // ═══════════════════════════════════════════════════════════════════════
  /** Instrument-classified transient events from GodEar V3's 3-band
   *  onset detector. Each event has a timestamp, instrument type, and
   *  strength [0-1]. Supersedes the legacy `transients` array. */
  transientEvents?: TransientEvent[]
}

/**
 * 🩻 GODEAR UNLEASHED Phase 2: Instrument-classified transient event.
 * Produced by GodEar V3's SlopeBasedOnsetDetector with 3-band isolation
 * (kick = subBass+bass, snare = mid+lowMid, hihat = treble+highMid).
 */
export interface TransientEvent {
  /** Timestamp in milliseconds */
  timeMs: TimeMs
  /** Instrument classification: 'kick' | 'snare' | 'hihat' */
  type: 'kick' | 'snare' | 'hihat'
  /** Strength [0-1] — max band energy at onset */
  strength: number
}

/**
 * Datos de waveform para visualización
 */
export interface WaveformData {
  /** Samples por segundo (típico: 100-200) */
  samplesPerSecond: number
  
  /** Array de picos normalizados (0-1) */
  peaks: number[]
  
  /** Array de RMS (para área bajo curva) */
  rms: number[]
}

/**
 * Datos de heatmap energético
 */
export interface HeatmapData {
  /** Resolución temporal (ms por sample) */
  resolutionMs: TimeMs
  
  /** Energy por sample (0-1) */
  energy: number[]
  
  /** Bass energy (0-1) — legacy: subBass + bass combined */
  bass: number[]
  
  /** High frequency energy (0-1) — legacy: treble + ultraAir combined */
  high: number[]
  
  /** Spectral flux (cambio espectral) */
  flux: number[]
  
  // ═══════════════════════════════════════════════════════════════════
  // 🩻 WAVE 2077: GOD EAR TACTICAL BANDS (7-band real FFT)
  // Optional for backwards compatibility — populated when GodEarFFT available
  // ═══════════════════════════════════════════════════════════════════
  
  /** 20-60Hz — Presión de aire pura (kicks sísmicos, 808 rumble) */
  subBass?: number[]
  
  /** 60-250Hz — Cuerpo rítmico (bajos, kick body, toms) */
  bassReal?: number[]
  
  /** 250-500Hz — Calor/Mud zone */
  lowMid?: number[]
  
  /** 500-2000Hz — Voces/Snare/Lead (corazón musical) */
  mid?: number[]
  
  /** 2000-6000Hz — Crunch/Ataque/Presencia */
  highMid?: number[]
  
  /** 6000-16000Hz — Brillo/Hi-Hats/Aire */
  treble?: number[]
  
  /** 16000-22000Hz — Armónicos superiores */
  ultraAir?: number[]
  
  /** Hz — Centro de masa espectral per frame (brillo tonal) */
  spectralCentroid?: number[]

  /** 0-1 — Spectral flatness per frame (tonal vs noise) */
  spectralFlatness?: number[]

  // ═══════════════════════════════════════════════════════════════════════
  // 🩻 GODEAR UNLEASHED Phase 3: Semantic Enrichment Telemetry
  // Optional for backwards compatibility — populated when GodEar V3
  // photon block + rhythmic tracker are available.
  // ═══════════════════════════════════════════════════════════════════════

  /** 0-1 — Saturation Index per frame (0=dynamic, 1=brickwalled).
   *  From GodEar V3's SaturationMeter — detects loud war compression. */
  saturation?: number[]

  /** 0-1 — White noise score per frame (high flatness in high freq bands).
   *  From GodEar V3's photon block — quantifies broadband noise content. */
  whiteNoise?: number[]

  /** 0-1 — Rhythmic void per frame (0=dense percussion, 1=total absence).
   *  From GodEar V3's RhythmicPercussionTracker — detects silence/breaks. */
  rhythmicVoid?: number[]

  /** Hz — Spectral rolloff per frame (frequency below which 85% of
   *  energy is contained). From GodEar V3's spectral metrics. */
  rolloff?: number[]
}

/**
 * Grid de beats para snap
 */
export interface BeatGridData {
  /** BPM detectado */
  bpm: number
  
  /** Offset del primer beat (ms) */
  firstBeatMs: TimeMs
  
  /** Time signature (4 = 4/4, 3 = 3/4) */
  timeSignature: number
  
  /** Array de beat timestamps (ms) */
  beats: TimeMs[]
  
  /** Array de downbeats (primer beat del compás) */
  downbeats: TimeMs[]
  
  /** Confidence del beat tracking (0-1) */
  confidence: NormalizedValue

  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 7563: VARIABLE-TEMPO PAYLOAD
  // ═══════════════════════════════════════════════════════════════════════
  // All optional — a legacy .lux deserialized through an older path simply
  // omits them, and every existing consumer (which only ever read `bpm`)
  // keeps working untouched.

  /**
   * Per-frame BPM from the TempoOracle, gap-filled and median-smoothed.
   * Index `i` ↔ `i * tempoCurveResolutionMs`, co-indexable with HeatmapData.
   * Lets Hephaestus phase-lock curve durations to LOCAL tempo instead of a
   * global average.
   */
  tempoCurve?: number[]

  /** Frame duration of `tempoCurve` in ms (mirrors heatmap resolutionMs). */
  tempoCurveResolutionMs?: TimeMs

  /** Index within `beats` of the first detected downbeat (0 … timeSignature−1). */
  downbeatPhase?: number

  /** 0-1 — decisiveness of the downbeat phase estimate. 0 = no evidence. */
  downbeatConfidence?: NormalizedValue

  /**
   * True when `beats` came from the Ellis DP tracker (genuinely variable
   * tempo). False when the DP could not track and the legacy uniform grid
   * was synthesised from the scalar BPM instead — worth surfacing, because
   * the two carry very different trust levels.
   */
  variableTempo?: boolean
}

/**
 * Sección detectada automáticamente
 */
export interface DetectedSection {
  /** Tipo de sección */
  type: SectionType
  
  /** Timestamp de inicio (ms) */
  startMs: TimeMs
  
  /** Timestamp de fin (ms) */
  endMs: TimeMs
  
  /** Confidence (0-1) */
  confidence: NormalizedValue
  
  /** Energía promedio de la sección */
  avgEnergy: NormalizedValue
}

export type SectionType = 
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'buildup'
  | 'drop'
  | 'outro'
  | 'unknown'

// ═══════════════════════════════════════════════════════════════════════════
// 🕰️ CHRONOS ENGINE STATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estados de reproducción del engine
 */
export type PlaybackState = 
  | 'stopped'
  | 'playing'
  | 'paused'
  | 'scrubbing'
  | 'recording'

/**
 * Estado del ChronosEngine
 */
export interface ChronosEngineState {
  /** Estado de reproducción */
  playbackState: PlaybackState
  
  /** Tiempo actual (ms) - incluye compensación de latencia */
  currentTimeMs: TimeMs
  
  /** Tiempo real del audio (ms) - sin compensación */
  audioTimeMs: TimeMs
  
  /** Velocidad de reproducción (1.0 = normal) */
  playbackRate: number
  
  /** ¿Loop activo? */
  looping: boolean
  
  /** Región de loop */
  loopRegion: { startMs: TimeMs; endMs: TimeMs } | null
  
  /** ¿Audio cargado? */
  hasAudio: boolean
  
  /** Duración total (ms) */
  durationMs: TimeMs
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧬 CHRONOS CONTEXT (OUTPUT PARA TITAN)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧬 CHRONOS CONTEXT
 * 
 * Payload que Chronos genera cada frame.
 * Se inyecta en TitanEngine como "susurro" o "dictador".
 */
export interface ChronosContext {
  /** Timestamp actual (ms) */
  timestamp: TimeMs
  
  /** ¿Chronos activo? */
  active: boolean
  
  /** Modo de override */
  overrideMode: ChronosOverrideMode
  
  /** Override de Vibe */
  vibeOverride: ChronosVibeOverride | null
  
  /** Override de intensidad global (0-1) */
  intensityOverride: NormalizedValue | null
  
  /** Override de zonas */
  zoneOverrides: ChronosZoneOverride | null
  
  /** Override de paleta */
  colorOverride: ChronosColorOverride | null
  
  /** Efectos activos (con progress calculado) */
  activeEffects: ChronosActiveEffect[]
  
  /** Valores de automation evaluados */
  automationValues: Map<AutomationTarget, number>
}

export interface ChronosVibeOverride {
  vibeId: string
  transition: 'cut' | 'fade'
  progress: NormalizedValue
}

export interface ChronosZoneOverride {
  enabledZones: EffectZone[]
  blackoutDisabled: boolean
}

export interface ChronosColorOverride {
  palette: {
    primary: HexColor
    secondary: HexColor
    accent: HexColor
  }
  keyLock: string | null
}

/**
 * Efecto activo controlado por Chronos
 */
export interface ChronosActiveEffect {
  /** ID del efecto */
  effectId: string
  
  /** Progress (0-1) - Controlado por posición en timeline */
  progress: NormalizedValue
  
  /** Intensidad (0-1) */
  intensity: NormalizedValue
  
  /** Velocidad (multiplier) */
  speed: number
  
  /** Zonas target */
  zones: EffectZone[]
  
  /** Parámetros custom */
  params: Record<string, number | string | boolean>
  
  /** ID del clip fuente */
  sourceClipId: ChronosId
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera un ID único para Chronos
 */
export function generateChronosId(): ChronosId {
  // Prefer stable, cryptographic UUID when available (no Math.random())
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return `chr_${(crypto as any).randomUUID()}`
    }
  } catch (e) {
    // Fallthrough to deterministic fallback
  }

  // Fallback deterministic ID (time + monotonic counter) for older environments
  // This avoids Math.random() and remains unique within a single process.
  const now = Date.now().toString(36)
  generateChronosIdCounter = (generateChronosIdCounter + 1) % 0xFFFFFF
  return `chr_${now}_${generateChronosIdCounter.toString(36)}`
}

// Monotonic counter used by fallback path
let generateChronosIdCounter = 0

// ═══════════════════════════════════════════════════════════════════════════
// � WAVE 7100 FASE 2: V2 PROJECT TYPES DEMOLISHED
// ═══════════════════════════════════════════════════════════════════════════
//
// ChronosProjectV2, TimelineTrackV2, TrackUpdateV2, ChronosProjectMeta,
// createDefaultProjectV2, createTrackV2, generateTrackV2Label — ALL REMOVED.
//
// V3 replacements live in LuxFileV3.ts:
//   ChronosProjectV3  ←  ChronosProjectV2
//   LuxTrackV3        ←  TimelineTrackV2
//   LuxMetaV3         ←  ChronosProjectMeta
//   LuxTrackUpdateV3  ←  TrackUpdateV2
//   createEmptyChronosProjectV3  ←  createDefaultProjectV2
//   createTrackV3               ←  createTrackV2
//   generateTrackLabelV3        ←  generateTrackV2Label
// ═══════════════════════════════════════════════════════════════════════════
