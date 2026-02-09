/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🕰️ CHRONOS TYPES - THE DNA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2001: THE FOUNDATION
 * 
 * Define todas las interfaces del sistema Chronos.
 * Este archivo es el contrato de tipos para todo el módulo.
 * 
 * ARQUITECTURA:
 * - ChronosProject: Raíz del documento (como un .als de Ableton)
 * - TimelineTrack: Capas paralelas de contenido
 * - TimelineClip: Bloques semánticos posicionados en tiempo
 * - AutomationLane: Curvas de parámetros (Bézier)
 * - AnalysisData: Datos pre-computados del audio (waveform, beats, sections)
 * 
 * @module chronos/core/types
 * @version 2001.0.0
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
// 📦 CHRONOS PROJECT (ROOT DOCUMENT)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📦 CHRONOS PROJECT
 * 
 * Raíz del documento. Representa un proyecto de timeline completo.
 * Equivale a un archivo .chronos en disco.
 */
export interface ChronosProject {
  /** Versión del formato */
  readonly version: '1.0.0'
  
  /** ID único del proyecto */
  readonly id: ChronosId
  
  /** Metadata del proyecto */
  meta: ChronosProjectMeta
  
  /** Configuración de playback */
  playback: PlaybackConfig
  
  /** Datos de análisis del audio (si hay audio cargado) */
  analysis: AnalysisData | null
  
  /** Tracks del proyecto */
  tracks: TimelineTrack[]
  
  /** Automation lanes globales (master intensity, etc) */
  globalAutomation: AutomationLane[]
  
  /** Markers del usuario */
  markers: ChronosMarker[]
}

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
// 🎼 TIMELINE TRACKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de track disponibles
 */
export type TrackType = 
  | 'audio'       // Track de referencia de audio (solo visualización)
  | 'vibe'        // Cambios de Vibe (ej: "Techno Club" → "Chill Lounge")
  | 'effect'      // Disparos de efectos específicos
  | 'intensity'   // Curva de intensidad global
  | 'zone'        // Override de zonas
  | 'color'       // Override de paleta de colores
  | 'automation'  // Automation genérica de parámetros
  | 'marker'      // Track de markers (solo lectura)

/**
 * 🎼 TIMELINE TRACK
 * 
 * Una capa paralela de contenido en el timeline.
 * Contiene clips del mismo tipo.
 */
export interface TimelineTrack {
  /** ID único */
  readonly id: ChronosId
  
  /** Nombre visible */
  name: string
  
  /** Tipo de track */
  readonly type: TrackType
  
  /** ¿Track activa? (false = muted) */
  enabled: boolean
  
  /** ¿Track en solo? (solo esta track se reproduce) */
  solo: boolean
  
  /** ¿Track bloqueada? (no editable) */
  locked: boolean
  
  /** Altura de la track en UI (pixels) */
  height: number
  
  /** Color de la track (para UI) */
  color: HexColor
  
  /** Clips en esta track */
  clips: TimelineClip[]
  
  /** Automation lanes asociadas a esta track */
  automation: AutomationLane[]
  
  /** Orden de la track (para UI) */
  order: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧱 TIMELINE CLIPS (BLOQUES SEMÁNTICOS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de clip disponibles
 */
export type ClipType = 
  | 'vibe_change'
  | 'effect_trigger'
  | 'intensity_curve'
  | 'zone_override'
  | 'color_override'
  | 'parameter_lock'

/**
 * 🧱 TIMELINE CLIP (BASE)
 * 
 * Un bloque semántico posicionado en tiempo.
 * El campo `data` contiene el payload específico del tipo.
 */
export interface TimelineClip<T extends ClipData = ClipData> {
  /** ID único */
  readonly id: ChronosId
  
  /** ID de la track padre */
  readonly trackId: ChronosId
  
  /** Tipo de clip */
  readonly type: ClipType
  
  /** Timestamp de inicio (ms) */
  startMs: TimeMs
  
  /** Duración (ms) - 0 para eventos instantáneos */
  durationMs: TimeMs
  
  /** Datos específicos del tipo */
  data: T
  
  /** Easing de entrada */
  easeIn: EasingType
  
  /** Easing de salida */
  easeOut: EasingType
  
  /** ¿Es loop? (repite hasta el final del clip) */
  loop: boolean
  
  /** Prioridad (mayor = override) */
  priority: number
  
  /** ¿Clip habilitado? */
  enabled: boolean
  
  /** Metadata visual */
  meta: ClipMeta
}

/**
 * Metadata visual del clip
 */
export interface ClipMeta {
  /** Etiqueta visible */
  label: string
  
  /** Color del clip (override del color de track) */
  color?: HexColor
  
  /** Notas del usuario */
  notes?: string
}

/**
 * Tipos de easing para transiciones
 */
export type EasingType = 
  | 'linear'
  | 'step'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'bezier'

// ═══════════════════════════════════════════════════════════════════════════
// 📝 CLIP DATA PAYLOADS (POLIMÓRFICOS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unión de todos los tipos de datos de clip
 */
export type ClipData = 
  | VibeChangeData
  | EffectTriggerData
  | IntensityCurveData
  | ZoneOverrideData
  | ColorOverrideData
  | ParameterLockData

/**
 * Datos para cambio de Vibe
 */
export interface VibeChangeData {
  readonly type: 'vibe_change'
  
  /** ID del Vibe target */
  vibeId: string
  
  /** Tipo de transición */
  transition: 'cut' | 'fade'
  
  /** Duración de transición (ms) */
  transitionMs: TimeMs
}

/**
 * Datos para disparo de efecto
 * 
 * NOTA: `progress` es controlado por Chronos durante playback/scrubbing.
 * En modo live, progress lo calcula el EffectManager basado en elapsedMs.
 * En modo Chronos, progress = (currentTime - startMs) / durationMs.
 */
export interface EffectTriggerData {
  readonly type: 'effect_trigger'
  
  /** ID del efecto (effectType del EffectManager) */
  effectId: string
  
  /** Intensidad del disparo (0-1) */
  intensity: NormalizedValue
  
  /** Velocidad del efecto (multiplier, 1.0 = normal) */
  speed: number
  
  /** Zonas target (vacío = todas) */
  zones: EffectZone[]
  
  /** ¿BPM sync? */
  bpmSync: boolean
  
  /** Parámetros custom del efecto (override de defaults) */
  params: Record<string, number | string | boolean>
}

/**
 * Datos para curva de intensidad
 */
export interface IntensityCurveData {
  readonly type: 'intensity_curve'
  
  /** Valor de intensidad (0-1) */
  value: NormalizedValue
  
  /** Scope: master o zonas específicas */
  scope: 'master' | EffectZone[]
}

/**
 * Datos para override de zonas
 */
export interface ZoneOverrideData {
  readonly type: 'zone_override'
  
  /** Zonas habilitadas (el resto se apaga) */
  enabledZones: EffectZone[]
  
  /** ¿Blackout de zonas deshabilitadas? */
  blackoutDisabled: boolean
}

/**
 * Datos para override de color
 */
export interface ColorOverrideData {
  readonly type: 'color_override'
  
  /** Paleta override */
  palette: {
    primary: HexColor
    secondary: HexColor
    accent: HexColor
  }
  
  /** Lock de key musical */
  keyLock: string | null
}

/**
 * Datos para lock de parámetro específico
 */
export interface ParameterLockData {
  readonly type: 'parameter_lock'
  
  /** Ruta del parámetro (ej: "selene.strategy") */
  parameterPath: string
  
  /** Valor a lockear */
  value: unknown
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎚️ AUTOMATION LANES (CURVAS BÉZIER)
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
  
  /** Bass energy (0-1) */
  bass: number[]
  
  /** High frequency energy (0-1) */
  high: number[]
  
  /** Spectral flux (cambio espectral) */
  flux: number[]
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
// 🛠️ UTILITY TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un tipo de clip tipado con su data
 */
export type TypedClip<T extends ClipType> = TimelineClip<
  T extends 'vibe_change' ? VibeChangeData :
  T extends 'effect_trigger' ? EffectTriggerData :
  T extends 'intensity_curve' ? IntensityCurveData :
  T extends 'zone_override' ? ZoneOverrideData :
  T extends 'color_override' ? ColorOverrideData :
  T extends 'parameter_lock' ? ParameterLockData :
  never
>

/**
 * Partial update de un clip (para edición)
 */
export type ClipUpdate = Partial<Omit<TimelineClip, 'id' | 'trackId' | 'type'>>

/**
 * Partial update de una track
 */
export type TrackUpdate = Partial<Omit<TimelineTrack, 'id' | 'type' | 'clips'>>

/**
 * Partial update de un punto de automation
 */
export type AutomationPointUpdate = Partial<Omit<AutomationPoint, 'id'>>

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 FACTORY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera un ID único para Chronos
 */
export function generateChronosId(): ChronosId {
  return `chr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Crea un proyecto vacío por defecto
 */
export function createDefaultProject(name: string = 'Untitled'): ChronosProject {
  const now = new Date().toISOString()
  
  return {
    version: '1.0.0',
    id: generateChronosId(),
    meta: {
      name,
      description: '',
      audioPath: null,
      durationMs: 180000, // 3 minutos default
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

/**
 * Crea una track vacía
 */
export function createDefaultTrack(
  type: TrackType, 
  name?: string,
  order: number = 0
): TimelineTrack {
  const trackColors: Record<TrackType, HexColor> = {
    audio: '#64748b',
    vibe: '#8b5cf6',
    effect: '#22d3ee',
    intensity: '#f59e0b',
    zone: '#10b981',
    color: '#ec4899',
    automation: '#6366f1',
    marker: '#94a3b8',
  }
  
  return {
    id: generateChronosId(),
    name: name ?? `${type.charAt(0).toUpperCase() + type.slice(1)} Track`,
    type,
    enabled: true,
    solo: false,
    locked: false,
    height: type === 'automation' ? 80 : 60,
    color: trackColors[type],
    clips: [],
    automation: [],
    order,
  }
}

/**
 * Crea un clip de efecto
 */
export function createEffectClip(
  trackId: ChronosId,
  effectId: string,
  startMs: TimeMs,
  durationMs: TimeMs,
  intensity: NormalizedValue = 1.0
): TimelineClip<EffectTriggerData> {
  return {
    id: generateChronosId(),
    trackId,
    type: 'effect_trigger',
    startMs,
    durationMs,
    data: {
      type: 'effect_trigger',
      effectId,
      intensity,
      speed: 1.0,
      zones: [],
      bpmSync: true,
      params: {},
    },
    easeIn: 'linear',
    easeOut: 'linear',
    loop: false,
    priority: 0,
    enabled: true,
    meta: {
      label: effectId,
    },
  }
}

/**
 * Crea un punto de automation
 */
export function createAutomationPoint(
  timeMs: TimeMs,
  value: NormalizedValue,
  interpolation: InterpolationType = 'linear'
): AutomationPoint {
  return {
    id: generateChronosId(),
    timeMs,
    value,
    interpolation,
  }
}

/**
 * Crea una lane de automation
 */
export function createAutomationLane(
  target: AutomationTarget,
  name?: string
): AutomationLane {
  return {
    id: generateChronosId(),
    name: name ?? target,
    target,
    range: { min: 0, max: 1 },
    points: [],
    enabled: true,
    defaultValue: target.includes('intensity') ? 1.0 : 0.5,
    color: '#7c4dff',
  }
}
