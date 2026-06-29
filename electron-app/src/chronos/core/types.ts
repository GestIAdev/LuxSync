/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES — THE RUNTIME DNA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FASE 7: V1 types demolished. Only V2 and shared types remain.
 *
 * This file defines shared types for the IN-MEMORY editing model used by
 * the Chronos editor UI, ChronosStoreV2, ChronosEngine, and automation system.
 *
 * V2 types: ChronosProjectV2, TimelineTrackV2 (with concrete TimelineClip).
 * Shared types: Primitives, PlaybackConfig, Automation, Analysis, Context.
 *
 * This is NOT the serialized .lux format. For the file format, see
 * LuxProject in ./ChronosProject.ts.
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

// ═══════════════════════════════════════════════════════════════════════════
// 📦 CHRONOS PROJECT META (SHARED V2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Metadata del proyecto
 */
export interface ChronosProjectMeta {
  /** Nombre visible del proyecto */
  name: string
  
  /** Descripción opcional */
  description?: string
  
  /** Ruta al archivo de audio (relativa o absoluta) */
  audioPath: string | null
  
  /** Duración total del proyecto en ms */
  durationMs: TimeMs
  
  /** BPM del proyecto (detectado o manual) */
  bpm: number
  
  /** Time signature (4 = 4/4, 3 = 3/4) */
  timeSignature: number
  
  /** Key musical (si detectada) */
  key: string | null
  
  /** Fecha de creación (ISO 8601) */
  createdAt: string
  
  /** Fecha de última modificación (ISO 8601) */
  modifiedAt: string
  
  /** Hash del audio para detectar cambios */
  audioHash: string | null
}

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
  
  /** Transients (para snap a hits) */
  transients: TimeMs[]
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
// 🔥 WAVE 2547: TIMELINE V2 — INFINITE EXPLICIT TRACKS
// FASE 7: V1 types demolished. Clips use concrete TimelineClip from TimelineClip.ts.
// ═══════════════════════════════════════════════════════════════════════════

import type { CanonicalZone } from '../../core/stage/ShowFileV2'
import type { TimelineClip as ConcreteTimelineClip } from './TimelineClip'

/**
 * 🔥 WAVE 2547: Track explícita e independiente.
 *
 * El usuario la crea, la nombra, la rutea. El motor la ejecuta.
 * NO se genera automáticamente desde fixtures.
 * Múltiples tracks pueden apuntar a la MISMA CanonicalZone.
 * El MasterArbiter aplica HTP/LTP entre ellas.
 */
export interface TimelineTrackV2 {
  /** UUID v4 — generado al crear la track, inmutable */
  readonly id: ChronosId

  /**
   * Zona canónica de ruteo DMX.
   * Determina qué fixtures reciben los efectos de esta track.
   * Valor especial 'global' → todas las fixtures (wildcard).
   * Inmutable: cambiar la zona implica borrar y recrear la track.
   */
  readonly targetZone: CanonicalZone | 'global'

  /**
   * Etiqueta personalizable (UI-only, no afecta ruteo).
   * Default: ZONE_LABELS[targetZone] sin emoji + " #n" si zona duplicada.
   * El usuario puede renombrar libremente.
   */
  visualLabel: string

  /** Color de la track en la UI. Default: ZONE_COLORS[targetZone]. */
  color: HexColor

  /**
   * Clips en esta track — propiedad exclusiva.
   * Un clip pertenece a exactamente una track.
   */
  clips: ConcreteTimelineClip[]

  /** Automation lanes locales a esta track */
  automation: AutomationLane[]

  /** ¿Track habilitada? (false = muted) */
  enabled: boolean

  /** ¿Track en solo? */
  solo: boolean

  /** ¿Track bloqueada? (no editable en UI) */
  locked: boolean

  /**
   * Orden visual en la UI (0 = arriba).
   * Determinista — NO afecta prioridad DMX.
   */
  order: number

  /** Altura en pixels para la UI. Default: 36 */
  height: number
}

/**
 * 🔥 WAVE 2547: Proyecto Chronos V2.
 *
 * Reemplaza ChronosProject V1. Las tracks son explícitas, creadas
 * por el usuario, persistidas tal cual. NO derivadas de fixtures.
 */
export interface ChronosProjectV2 {
  readonly version: '2.0.0'
  readonly id: ChronosId
  meta: ChronosProjectMeta
  playback: PlaybackConfig
  analysis: AnalysisData | null

  /**
   * Array plano de tracks del usuario.
   * Orden visual definido por track.order.
   * Crear = push. Eliminar = filter. Reordenar = reasignar `order`.
   * NO derivado de fixtures. NO filtrado por patch.
   */
  tracks: TimelineTrackV2[]

  /** Automation lanes globales (master intensity, etc.) */
  globalAutomation: AutomationLane[]

  /** Markers del usuario */
  markers: ChronosMarker[]
}

/**
 * Partial update de una track V2
 */
export type TrackUpdateV2 = Partial<Omit<TimelineTrackV2, 'id' | 'targetZone' | 'clips'>>

// ─────────────────────────────────────────────────────────────────────────────
// 🏭 WAVE 2547: V2 FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

/** Colores por zona para las tracks V2 */
const TRACK_V2_ZONE_COLORS: Partial<Record<CanonicalZone | 'global', HexColor>> = {
  'front':        '#ef4444',
  'back':         '#3b82f6',
  'floor':        '#22c55e',
  'movers-left':  '#f59e0b',
  'movers-right': '#f59e0b',
  'center':       '#a855f7',
  'air':          '#06b6d4',
  'ambient':      '#64748b',
  'unassigned':   '#475569',
  'global':       '#e2e8f0',
}

/**
 * Genera el label visual por defecto para una track V2.
 * Primera track de 'front' → "FRONT". Segunda → "FRONT #2".
 */
export function generateTrackV2Label(
  targetZone: CanonicalZone | 'global',
  existingTracks: readonly TimelineTrackV2[]
): string {
  const BASE_LABELS: Record<CanonicalZone | 'global', string> = {
    'front':        'FRONT',
    'back':         'BACK',
    'floor':        'FLOOR',
    'movers-left':  'MOVER LEFT',
    'movers-right': 'MOVER RIGHT',
    'center':       'CENTER',
    'air':          'AIR',
    'ambient':      'AMBIENT',
    'unassigned':   'UNASSIGNED',
    'global':       'GLOBAL',
  }
  const base = BASE_LABELS[targetZone] ?? targetZone.toUpperCase()
  const count = existingTracks.filter(t => t.targetZone === targetZone).length
  return count === 0 ? base : `${base} #${count + 1}`
}

/**
 * Crea una nueva TimelineTrackV2 vacía con valores por defecto.
 */
export function createTrackV2(
  targetZone: CanonicalZone | 'global',
  existingTracks: readonly TimelineTrackV2[],
  order?: number
): TimelineTrackV2 {
  const nextOrder = order ?? existingTracks.length
  return {
    id: generateChronosId(),
    targetZone,
    visualLabel: generateTrackV2Label(targetZone, existingTracks),
    color: TRACK_V2_ZONE_COLORS[targetZone] ?? '#64748b',
    clips: [],
    automation: [],
    enabled: true,
    solo: false,
    locked: false,
    order: nextOrder,
    height: 36,
  }
}

/**
 * Crea un ChronosProjectV2 vacío con valores por defecto.
 */
export function createDefaultProjectV2(name: string = 'Untitled'): ChronosProjectV2 {
  const now = new Date().toISOString()
  return {
    version: '2.0.0',
    id: generateChronosId(),
    meta: {
      name,
      description: '',
      audioPath: null,
      durationMs: 180000,
      bpm: 120,
      timeSignature: 4,
      key: null,
      createdAt: now,
      modifiedAt: now,
      audioHash: null,
    },
    playback: {
      loop: false,
      loopRegion: null,
      snapToBeat: true,
      snapResolution: 'beat',
      overrideMode: 'whisper',
      latencyCompensationMs: 10,
    },
    analysis: null,
    tracks: [],
    globalAutomation: [],
    markers: [],
  }
}
