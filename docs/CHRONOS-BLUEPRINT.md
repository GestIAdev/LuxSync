# 🕰️ PROJECT CHRONOS: THE BLUEPRINT
## Arquitectura del Timecoder Híbrido Semántico para LuxSync

> **WAVE 2000: THE CONDUCTOR'S BATON**  
> Una Línea de Tiempo que dirige a la IA, no que la sustituye.

---

## EXECUTIVE SUMMARY: THE SEMANTIC TIMELINE

CHRONOS no es un secuenciador DMX tradicional. Es un **Director de Orquesta**.

**Filosofía Central**:
- 🎼 **Semántico, no Literal**: Grabamos INTENCIONES ("Cambio a Vibe Techno"), no valores DMX (CH1=255)
- 🧠 **Híbrido**: Chronos susurra a Selene, no la desconecta
- 🎬 **Scrubbing Universal**: Progress de efectos mapeados a la posición del cursor
- ⚡ **Offline Analysis**: GodEar analiza toda la canción en segundos → Mapa de Calor

**Las 4 Columnas**:
1. **Ghost Recording**: Graba improvisaciones como bloques editables
2. **Parametric Effect Driving**: Scrubbing de efectos procedurales
3. **GodEar Offline Analysis**: BPM Grid + Energy Heatmap
4. **Brain Injection**: Override parcial de Selene (susurro, no dictador)

---

## 🏛️ ARCHITECTURE OVERVIEW

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                           CHRONOS ARCHITECTURE                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                        CHRONOS LAYER (NEW)                              │  ║
║  │                                                                         │  ║
║  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │  ║
║  │  │   EDITOR    │  │   ENGINE    │  │  ANALYZER   │  │   RECORDER   │   │  ║
║  │  │  (React UI) │  │ (Playback)  │  │ (Offline)   │  │   (Ghost)    │   │  ║
║  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘   │  ║
║  │         │                │                │                │           │  ║
║  │         └────────────────┴────────────────┴────────────────┘           │  ║
║  │                                   │                                     │  ║
║  │                    ┌──────────────┴──────────────┐                     │  ║
║  │                    │     CHRONOS CONTEXT         │                     │  ║
║  │                    │  (The Override Payload)     │                     │  ║
║  │                    └──────────────┬──────────────┘                     │  ║
║  └───────────────────────────────────┼─────────────────────────────────────┘  ║
║                                      │                                        ║
║  ════════════════════════════════════╪════════════════════════════════════════║
║                                      │ INJECTION POINT                        ║
║  ════════════════════════════════════╪════════════════════════════════════════║
║                                      ▼                                        ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                      EXISTING LUXSYNC STACK                             │  ║
║  │                                                                         │  ║
║  │  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐     │  ║
║  │  │   GodEar    │ ───► │  TitanEngine    │ ───► │       HAL       │     │  ║
║  │  │  (Senses)   │      │  (+ Chronos     │      │  (DMX Output)   │     │  ║
║  │  │             │      │   Injection)    │      │                 │     │  ║
║  │  └─────────────┘      └─────────────────┘      └─────────────────┘     │  ║
║  │        │                       │                                        │  ║
║  │        ▼                       ▼                                        │  ║
║  │  MusicalContext    ChronosContext (override)                           │  ║
║  │  (from audio)      (from timeline)                                     │  ║
║  │                                                                         │  ║
║  └─────────────────────────────────────────────────────────────────────────┘  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 📦 PUNTO 1: DATA SCHEMA - EL ARCHIVO `.chronos`

### 1.1 Estructura de Alto Nivel

```typescript
/**
 * 🕰️ CHRONOS FILE FORMAT - VERSION 1.0
 * 
 * Un archivo .chronos es un JSON que describe:
 * - Metadata del proyecto (audio source, BPM, key)
 * - Analysis (waveform, heatmap, markers)
 * - Tracks (capas semánticas)
 * - Blocks (intenciones posicionadas en tiempo)
 * - Automation (curvas Bézier para parámetros)
 * 
 * DISEÑO: Inspirado en Ableton Live .als pero semántico
 */

interface ChronosFile {
  /** Version del formato */
  version: '1.0.0'
  
  /** Metadata del proyecto */
  meta: ChronosMeta
  
  /** Análisis offline del audio */
  analysis: ChronosAnalysis
  
  /** Tracks (capas de contenido) */
  tracks: ChronosTrack[]
  
  /** Automation global (intensity master, etc) */
  globalAutomation: AutomationLane[]
  
  /** Markers del usuario (drop markers, section labels) */
  markers: ChronosMarker[]
  
  /** Settings de playback */
  playback: PlaybackSettings
}

interface ChronosMeta {
  /** Nombre del proyecto */
  name: string
  
  /** Ruta al archivo de audio (relativa o absoluta) */
  audioPath: string
  
  /** Duración total en ms */
  durationMs: number
  
  /** BPM detectado (o manual) */
  bpm: number
  
  /** Key musical detectada */
  key: string | null
  
  /** Fecha de creación */
  createdAt: string
  
  /** Fecha de última modificación */
  modifiedAt: string
  
  /** Hash del audio (para detectar cambios) */
  audioHash: string
}
```

### 1.2 Analysis Block (GodEar Offline)

```typescript
/**
 * 🔬 CHRONOS ANALYSIS
 * 
 * Datos pre-computados del audio para visualización y snap.
 * Generado por GodEar en modo offline (procesa todo el archivo).
 */

interface ChronosAnalysis {
  /** Waveform overview (para visualización) */
  waveform: WaveformData
  
  /** Energy heatmap (para visualización de intensidad) */
  energyHeatmap: HeatmapData
  
  /** Grid de beats (para snap) */
  beatGrid: BeatGridData
  
  /** Secciones detectadas automáticamente */
  sections: AutoSection[]
  
  /** Transients detectados (para snap a hits) */
  transients: number[] // timestamps en ms
}

interface WaveformData {
  /** Samples por segundo (típico: 100-200 para overview) */
  samplesPerSecond: number
  
  /** Array de picos normalizados (0-1) */
  peaks: Float32Array // Serializado como base64 en JSON
  
  /** Array de RMS (para área bajo curva) */
  rms: Float32Array
}

interface HeatmapData {
  /** Resolución temporal (ms por sample) */
  resolutionMs: number
  
  /** Energy por sample (0-1) */
  energy: Float32Array
  
  /** Bass energy (0-1) */
  bass: Float32Array
  
  /** High frequency energy (0-1) */
  high: Float32Array
  
  /** Spectral flux (cambio espectral) */
  flux: Float32Array
}

interface BeatGridData {
  /** BPM del grid */
  bpm: number
  
  /** Offset del primer beat (ms) */
  firstBeatMs: number
  
  /** Time signature (4 = 4/4, 3 = 3/4) */
  timeSignature: number
  
  /** Array de beat timestamps (ms) */
  beats: number[]
  
  /** Array de downbeats (primer beat del compás) */
  downbeats: number[]
  
  /** Confidence del beat tracking */
  confidence: number
}

interface AutoSection {
  /** Tipo de sección detectada */
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'breakdown' | 'buildup' | 'drop' | 'outro'
  
  /** Timestamp de inicio (ms) */
  startMs: number
  
  /** Timestamp de fin (ms) */
  endMs: number
  
  /** Confidence (0-1) */
  confidence: number
  
  /** Energía promedio de la sección */
  avgEnergy: number
}
```

### 1.3 Tracks y Blocks (Contenido Semántico)

```typescript
/**
 * 🎼 CHRONOS TRACKS
 * 
 * Las tracks son capas paralelas de contenido.
 * Cada track tiene un tipo que determina qué blocks puede contener.
 * 
 * TRACK TYPES:
 * - vibe: Bloques de cambio de Vibe (ej: "Techno Club" → "Chill Lounge")
 * - effect: Bloques de efectos específicos (ej: "SolarFlare" a 00:45)
 * - intensity: Curva de intensidad global (automation)
 * - zone: Override de zonas específicas (ej: "solo front movers")
 * - color: Override de paleta de colores
 */

interface ChronosTrack {
  /** ID único */
  id: string
  
  /** Nombre visible */
  name: string
  
  /** Tipo de track */
  type: TrackType
  
  /** ¿Track activa? (mute/solo) */
  enabled: boolean
  
  /** ¿Track bloqueada? (no editable) */
  locked: boolean
  
  /** Color de la track (para UI) */
  color: string
  
  /** Blocks en esta track */
  blocks: ChronosBlock[]
  
  /** Automation lanes asociadas a esta track */
  automation: AutomationLane[]
}

type TrackType = 
  | 'vibe'      // Cambios de Vibe
  | 'effect'    // Disparos de efectos
  | 'intensity' // Curva de intensidad
  | 'zone'      // Override de zonas
  | 'color'     // Override de paleta
  | 'marker'    // Track de markers (solo lectura)

/**
 * 🧱 CHRONOS BLOCK
 * 
 * Un block es una INTENCIÓN posicionada en tiempo.
 * No contiene valores DMX, sino instrucciones semánticas.
 */

interface ChronosBlock {
  /** ID único */
  id: string
  
  /** Timestamp de inicio (ms) */
  startMs: number
  
  /** Duración (ms) - 0 para eventos instantáneos */
  durationMs: number
  
  /** Tipo de block (determina payload) */
  type: BlockType
  
  /** Payload específico del tipo */
  payload: BlockPayload
  
  /** Easing de entrada (para transiciones) */
  easeIn: EasingType
  
  /** Easing de salida */
  easeOut: EasingType
  
  /** ¿Es loop? (repite hasta el final del block) */
  loop: boolean
  
  /** Prioridad (mayor = override) */
  priority: number
  
  /** Metadata del usuario (notas, color) */
  meta: BlockMeta
}

type BlockType = 
  | 'vibe_change'       // Cambio de Vibe
  | 'effect_trigger'    // Disparo de efecto
  | 'intensity_curve'   // Curva de intensidad
  | 'zone_override'     // Override de zona
  | 'color_override'    // Override de paleta
  | 'parameter_lock'    // Lock de parámetro específico

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK PAYLOADS (Polimórficos)
// ═══════════════════════════════════════════════════════════════════════════

type BlockPayload = 
  | VibeChangePayload
  | EffectTriggerPayload
  | IntensityCurvePayload
  | ZoneOverridePayload
  | ColorOverridePayload
  | ParameterLockPayload

interface VibeChangePayload {
  type: 'vibe_change'
  
  /** ID del Vibe target */
  vibeId: string
  
  /** ¿Transición suave o corte? */
  transition: 'cut' | 'fade'
  
  /** Duración de transición (ms) */
  transitionMs: number
}

interface EffectTriggerPayload {
  type: 'effect_trigger'
  
  /** ID del efecto a disparar */
  effectId: string
  
  /** Intensidad del disparo (0-1) */
  intensity: number
  
  /** Zonas target (vacío = todas) */
  zones: EffectZone[]
  
  /** ¿BPM sync? */
  bpmSync: boolean
  
  /** Override de duración (si null, usa default del efecto) */
  durationOverrideMs: number | null
  
  /** Parámetros custom del efecto */
  params: Record<string, number>
}

interface IntensityCurvePayload {
  type: 'intensity_curve'
  
  /** Valor de intensidad (0-1) o automation lane reference */
  value: number | { automationId: string }
  
  /** ¿Aplica a master o a zonas específicas? */
  scope: 'master' | EffectZone[]
}

interface ZoneOverridePayload {
  type: 'zone_override'
  
  /** Zonas habilitadas (el resto se apaga) */
  enabledZones: EffectZone[]
  
  /** ¿Blackout de zonas deshabilitadas? */
  blackoutDisabled: boolean
}

interface ColorOverridePayload {
  type: 'color_override'
  
  /** Paleta override */
  palette: {
    primary: string    // Hex color
    secondary: string
    accent: string
  }
  
  /** ¿Lock de key musical? */
  keyLock: string | null
}

interface ParameterLockPayload {
  type: 'parameter_lock'
  
  /** Ruta del parámetro (ej: "selene.strategy") */
  parameterPath: string
  
  /** Valor a lockear */
  value: any
}
```

### 1.4 Automation Lanes (Curvas Bézier)

```typescript
/**
 * 🎚️ AUTOMATION LANES
 * 
 * Curvas de automation al estilo Ableton Live.
 * Soportan interpolación Bézier cúbica para curvas suaves.
 * 
 * DESIGN: Keyframe-based con handles de control.
 */

interface AutomationLane {
  /** ID único */
  id: string
  
  /** Nombre (para UI) */
  name: string
  
  /** Ruta del parámetro target */
  targetPath: AutomationTarget
  
  /** Rango de valores (para UI y normalización) */
  range: { min: number; max: number }
  
  /** Keyframes de la automation */
  keyframes: AutomationKeyframe[]
  
  /** ¿Lane activa? */
  enabled: boolean
}

type AutomationTarget = 
  | 'master.intensity'      // Intensidad global
  | 'master.speed'          // Velocidad de efectos
  | 'master.color.hue'      // Offset de hue global
  | 'master.color.saturation'
  | 'effect.progress'       // Para scrubbing de efectos
  | 'selene.energy'         // Override de energía para Selene
  | `zone.${string}.intensity`  // Intensidad por zona

interface AutomationKeyframe {
  /** Timestamp (ms) */
  timeMs: number
  
  /** Valor normalizado (0-1, se mapea a range) */
  value: number
  
  /** Tipo de interpolación */
  interpolation: InterpolationType
  
  /** Handle izquierdo (para Bézier) */
  handleIn?: BezierHandle
  
  /** Handle derecho (para Bézier) */
  handleOut?: BezierHandle
}

type InterpolationType = 
  | 'linear'      // Línea recta
  | 'step'        // Escalón (sin transición)
  | 'bezier'      // Curva Bézier cúbica
  | 'ease-in'     // Predefinido: curva suave de entrada
  | 'ease-out'    // Predefinido: curva suave de salida
  | 'ease-in-out' // Predefinido: S-curve

interface BezierHandle {
  /** Offset temporal (ms, relativo al keyframe) */
  timeOffset: number
  
  /** Offset de valor (normalizado, relativo al keyframe) */
  valueOffset: number
}
```

### 1.5 Markers

```typescript
/**
 * 🏁 CHRONOS MARKERS
 * 
 * Markers son puntos de referencia que el usuario puede crear.
 * Pueden ser manuales o generados automáticamente del análisis.
 */

interface ChronosMarker {
  /** ID único */
  id: string
  
  /** Timestamp (ms) */
  timeMs: number
  
  /** Tipo de marker */
  type: MarkerType
  
  /** Etiqueta visible */
  label: string
  
  /** Color (para UI) */
  color: string
  
  /** ¿Generado automáticamente? */
  autoGenerated: boolean
}

type MarkerType = 
  | 'drop'      // 💥 Drop detectado
  | 'breakdown' // 🌫️ Breakdown detectado
  | 'buildup'   // 📈 Buildup detectado
  | 'section'   // 📍 Cambio de sección
  | 'cue'       // 🎯 Cue point del usuario
  | 'note'      // 📝 Nota del usuario
```

### 1.6 Playback Settings

```typescript
/**
 * ⚙️ PLAYBACK SETTINGS
 * 
 * Configuración de cómo se reproduce el proyecto.
 */

interface PlaybackSettings {
  /** ¿Loop del proyecto entero? */
  loop: boolean
  
  /** Región de loop (si loop=true) */
  loopRegion: { startMs: number; endMs: number } | null
  
  /** ¿Snap de cursor a beat grid? */
  snapToBeat: boolean
  
  /** Granularidad del snap */
  snapResolution: 'bar' | 'beat' | 'half-beat' | 'quarter-beat'
  
  /** ¿Chronos tiene control total o solo sugiere? */
  overrideMode: 'full' | 'whisper'
  
  /** Latencia de compensación (ms) */
  latencyCompensationMs: number
}
```

---

## ⚙️ PUNTO 2: CLASE `ChronosEngine`

### 2.1 Overview

```typescript
/**
 * 🕰️ CHRONOS ENGINE
 * 
 * El motor de reproducción de la línea de tiempo.
 * 
 * RESPONSABILIDADES:
 * 1. Sincronización con audio (HTMLAudioElement/WebAudio)
 * 2. Cálculo de estado actual en cada frame
 * 3. Generación de ChronosContext (el payload de override)
 * 4. Manejo de latencia (predictivo para DMX)
 * 5. Scrubbing de efectos procedurales
 * 
 * MODES:
 * - PLAY: Reproducción normal sincronizada a audio
 * - SCRUB: El usuario arrastra el cursor (sin audio o con audio scrub)
 * - RECORD: Graba intenciones en tiempo real (Ghost Recording)
 * - PAUSE: Parado, muestra estado en posición actual
 * 
 * SYNC STRATEGY:
 * - Usa AudioContext.currentTime como master clock
 * - Compensa latencia DMX (configurable, típico 5-20ms)
 * - Interpola para suavizar jitter de requestAnimationFrame
 */

import { EventEmitter } from 'events'
import { 
  ChronosFile, 
  ChronosBlock, 
  ChronosContext,
  AutomationLane,
  AutomationKeyframe,
  BlockPayload,
  EffectTriggerPayload,
  VibeChangePayload,
} from './ChronosTypes'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ChronosPlayState = 'stopped' | 'playing' | 'paused' | 'scrubbing' | 'recording'

interface ChronosEngineConfig {
  /** Latencia de compensación para DMX (ms) */
  latencyCompensationMs: number
  
  /** FPS target para el engine */
  targetFps: number
  
  /** ¿Debug logging? */
  debug: boolean
}

interface ChronosEngineState {
  /** Estado de reproducción */
  playState: ChronosPlayState
  
  /** Posición actual (ms) */
  currentTimeMs: number
  
  /** Posición de audio real (sin compensación) */
  audioTimeMs: number
  
  /** ¿En loop? */
  looping: boolean
  
  /** Región de loop activa */
  loopRegion: { startMs: number; endMs: number } | null
}

// ═══════════════════════════════════════════════════════════════════════════
// CHRONOS ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ChronosEngine extends EventEmitter {
  private config: ChronosEngineConfig
  private state: ChronosEngineState
  private project: ChronosFile | null = null
  
  // Audio sync
  private audioContext: AudioContext | null = null
  private audioElement: HTMLAudioElement | null = null
  private audioSource: MediaElementAudioSourceNode | null = null
  
  // Frame loop
  private animationFrameId: number | null = null
  private lastFrameTime: number = 0
  
  // Effect state tracking (for scrubbing)
  private activeEffectStates: Map<string, EffectPlaybackState> = new Map()
  
  // Recording buffer
  private recordingBuffer: RecordedEvent[] = []
  private recordingStartTime: number = 0
  
  constructor(config: Partial<ChronosEngineConfig> = {}) {
    super()
    
    this.config = {
      latencyCompensationMs: config.latencyCompensationMs ?? 10,
      targetFps: config.targetFps ?? 60,
      debug: config.debug ?? false,
    }
    
    this.state = {
      playState: 'stopped',
      currentTimeMs: 0,
      audioTimeMs: 0,
      looping: false,
      loopRegion: null,
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Carga un proyecto Chronos
   */
  async loadProject(project: ChronosFile, audioElement: HTMLAudioElement): Promise<void> {
    this.project = project
    this.audioElement = audioElement
    
    // Crear AudioContext para análisis y sync preciso
    this.audioContext = new AudioContext()
    this.audioSource = this.audioContext.createMediaElementSource(audioElement)
    this.audioSource.connect(this.audioContext.destination)
    
    // Sincronizar configuración de playback
    this.state.looping = project.playback.loop
    this.state.loopRegion = project.playback.loopRegion
    
    // Reset position
    this.seekTo(0)
    
    this.emit('project-loaded', project)
  }
  
  /**
   * Inicia reproducción
   */
  play(): void {
    if (!this.audioElement || this.state.playState === 'playing') return
    
    this.audioElement.play()
    this.state.playState = 'playing'
    this.startFrameLoop()
    
    this.emit('play')
  }
  
  /**
   * Pausa reproducción
   */
  pause(): void {
    if (!this.audioElement) return
    
    this.audioElement.pause()
    this.state.playState = 'paused'
    
    this.emit('pause')
  }
  
  /**
   * Detiene y vuelve al inicio
   */
  stop(): void {
    if (!this.audioElement) return
    
    this.audioElement.pause()
    this.audioElement.currentTime = 0
    this.state.playState = 'stopped'
    this.state.currentTimeMs = 0
    this.state.audioTimeMs = 0
    this.stopFrameLoop()
    
    this.emit('stop')
  }
  
  /**
   * Salta a posición específica
   */
  seekTo(timeMs: number): void {
    if (!this.audioElement) return
    
    const clampedTime = Math.max(0, Math.min(timeMs, this.getDuration()))
    this.audioElement.currentTime = clampedTime / 1000
    this.state.currentTimeMs = clampedTime
    this.state.audioTimeMs = clampedTime
    
    // Reset effect states para recalcular desde nueva posición
    this.recalculateEffectStates(clampedTime)
    
    this.emit('seek', clampedTime)
  }
  
  /**
   * Inicia modo scrubbing (arrastre de cursor)
   */
  startScrub(timeMs: number): void {
    this.state.playState = 'scrubbing'
    
    // Pausar audio real durante scrub
    if (this.audioElement) {
      this.audioElement.pause()
    }
    
    this.seekTo(timeMs)
    this.emit('scrub-start', timeMs)
  }
  
  /**
   * Actualiza posición durante scrub
   */
  updateScrub(timeMs: number): void {
    if (this.state.playState !== 'scrubbing') return
    
    this.state.currentTimeMs = timeMs
    this.state.audioTimeMs = timeMs
    this.recalculateEffectStates(timeMs)
    
    // Generar contexto para visualización en tiempo real
    const context = this.calculateContext(timeMs)
    this.emit('context-update', context)
    this.emit('scrub-update', timeMs)
  }
  
  /**
   * Termina modo scrubbing
   */
  endScrub(resumePlayback: boolean = false): void {
    if (resumePlayback) {
      this.state.playState = 'playing'
      this.audioElement?.play()
    } else {
      this.state.playState = 'paused'
    }
    
    this.emit('scrub-end')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API - RECORDING (GHOST RECORDING)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Inicia Ghost Recording
   */
  startRecording(): void {
    if (this.state.playState === 'recording') return
    
    this.state.playState = 'recording'
    this.recordingBuffer = []
    this.recordingStartTime = this.state.currentTimeMs
    
    // Iniciar reproducción de audio
    this.audioElement?.play()
    this.startFrameLoop()
    
    this.emit('recording-start')
  }
  
  /**
   * Graba un evento durante recording
   * Llamado desde la UI cuando el usuario hace una acción
   */
  recordEvent(event: RecordedEvent): void {
    if (this.state.playState !== 'recording') return
    
    // Añadir timestamp relativo
    event.timeMs = this.state.currentTimeMs
    this.recordingBuffer.push(event)
    
    this.emit('event-recorded', event)
  }
  
  /**
   * Detiene recording y devuelve los bloques generados
   */
  stopRecording(): ChronosBlock[] {
    if (this.state.playState !== 'recording') return []
    
    this.audioElement?.pause()
    this.state.playState = 'paused'
    
    // Convertir eventos grabados a bloques
    const blocks = this.convertEventsToBlocks(this.recordingBuffer)
    this.recordingBuffer = []
    
    this.emit('recording-stop', blocks)
    return blocks
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // CORE: CONTEXT CALCULATION
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🎯 CALCULA EL CONTEXTO CHRONOS PARA UN TIMESTAMP
   * 
   * Este es el método central. Dado un timestamp:
   * 1. Encuentra todos los blocks activos
   * 2. Evalúa automation lanes
   * 3. Calcula progress de efectos
   * 4. Genera ChronosContext para inyectar en TitanEngine
   */
  calculateContext(timeMs: number): ChronosContext {
    if (!this.project) {
      return this.createEmptyContext()
    }
    
    const context: ChronosContext = {
      timestamp: timeMs,
      active: true,
      overrideMode: this.project.playback.overrideMode,
      
      // Overrides (se rellenan según blocks activos)
      vibeOverride: null,
      intensityOverride: null,
      zoneOverrides: null,
      colorOverride: null,
      
      // Efectos activos (con progress calculado)
      activeEffects: [],
      
      // Automation values evaluados
      automationValues: new Map(),
    }
    
    // 1. PROCESAR BLOCKS ACTIVOS
    for (const track of this.project.tracks) {
      if (!track.enabled) continue
      
      for (const block of track.blocks) {
        if (this.isBlockActiveAt(block, timeMs)) {
          this.applyBlockToContext(block, timeMs, context)
        }
      }
    }
    
    // 2. EVALUAR AUTOMATION LANES GLOBALES
    for (const lane of this.project.globalAutomation) {
      if (!lane.enabled) continue
      
      const value = this.evaluateAutomation(lane, timeMs)
      context.automationValues.set(lane.targetPath, value)
    }
    
    // 3. EVALUAR AUTOMATION DE TRACKS
    for (const track of this.project.tracks) {
      if (!track.enabled) continue
      
      for (const lane of track.automation) {
        if (!lane.enabled) continue
        
        const value = this.evaluateAutomation(lane, timeMs)
        context.automationValues.set(lane.targetPath, value)
      }
    }
    
    return context
  }
  
  /**
   * Aplica un block al contexto según su tipo
   */
  private applyBlockToContext(
    block: ChronosBlock, 
    timeMs: number, 
    context: ChronosContext
  ): void {
    const progress = this.calculateBlockProgress(block, timeMs)
    
    switch (block.payload.type) {
      case 'vibe_change': {
        const payload = block.payload as VibeChangePayload
        context.vibeOverride = {
          vibeId: payload.vibeId,
          transition: payload.transition,
          progress: progress,
        }
        break
      }
      
      case 'effect_trigger': {
        const payload = block.payload as EffectTriggerPayload
        context.activeEffects.push({
          effectId: payload.effectId,
          progress: progress, // 🎯 KEY: Progress mapeado a timeline
          intensity: payload.intensity,
          zones: payload.zones,
          params: payload.params,
          sourceBlockId: block.id,
        })
        break
      }
      
      case 'intensity_curve': {
        if (typeof block.payload.value === 'number') {
          context.intensityOverride = block.payload.value
        } else {
          // Referencia a automation lane
          const automationValue = context.automationValues.get(
            block.payload.value.automationId
          )
          if (automationValue !== undefined) {
            context.intensityOverride = automationValue
          }
        }
        break
      }
      
      case 'zone_override': {
        context.zoneOverrides = {
          enabledZones: block.payload.enabledZones,
          blackoutDisabled: block.payload.blackoutDisabled,
        }
        break
      }
      
      case 'color_override': {
        context.colorOverride = {
          palette: block.payload.palette,
          keyLock: block.payload.keyLock,
        }
        break
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUTOMATION EVALUATION (BÉZIER INTERPOLATION)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Evalúa una automation lane en un timestamp dado
   * Soporta interpolación Bézier cúbica
   */
  private evaluateAutomation(lane: AutomationLane, timeMs: number): number {
    const keyframes = lane.keyframes
    
    if (keyframes.length === 0) {
      return lane.range.min
    }
    
    if (keyframes.length === 1) {
      return this.denormalizeValue(keyframes[0].value, lane.range)
    }
    
    // Encontrar keyframes que rodean al timestamp
    let prevKf: AutomationKeyframe | null = null
    let nextKf: AutomationKeyframe | null = null
    
    for (let i = 0; i < keyframes.length; i++) {
      if (keyframes[i].timeMs <= timeMs) {
        prevKf = keyframes[i]
      }
      if (keyframes[i].timeMs > timeMs && !nextKf) {
        nextKf = keyframes[i]
        break
      }
    }
    
    // Casos extremos
    if (!prevKf) {
      return this.denormalizeValue(keyframes[0].value, lane.range)
    }
    if (!nextKf) {
      return this.denormalizeValue(prevKf.value, lane.range)
    }
    
    // Interpolar entre keyframes
    const t = (timeMs - prevKf.timeMs) / (nextKf.timeMs - prevKf.timeMs)
    let interpolatedValue: number
    
    switch (prevKf.interpolation) {
      case 'step':
        interpolatedValue = prevKf.value
        break
        
      case 'linear':
        interpolatedValue = prevKf.value + (nextKf.value - prevKf.value) * t
        break
        
      case 'bezier':
        interpolatedValue = this.evaluateBezier(prevKf, nextKf, t)
        break
        
      case 'ease-in':
        interpolatedValue = prevKf.value + (nextKf.value - prevKf.value) * this.easeIn(t)
        break
        
      case 'ease-out':
        interpolatedValue = prevKf.value + (nextKf.value - prevKf.value) * this.easeOut(t)
        break
        
      case 'ease-in-out':
        interpolatedValue = prevKf.value + (nextKf.value - prevKf.value) * this.easeInOut(t)
        break
        
      default:
        interpolatedValue = prevKf.value
    }
    
    return this.denormalizeValue(interpolatedValue, lane.range)
  }
  
  /**
   * Evalúa interpolación Bézier cúbica
   */
  private evaluateBezier(
    prev: AutomationKeyframe,
    next: AutomationKeyframe,
    t: number
  ): number {
    // Puntos de control
    const p0 = prev.value
    const p3 = next.value
    
    // Handles (default a lineal si no hay)
    const h1 = prev.handleOut 
      ? prev.value + prev.handleOut.valueOffset 
      : prev.value + (next.value - prev.value) / 3
      
    const h2 = next.handleIn
      ? next.value + next.handleIn.valueOffset
      : next.value - (next.value - prev.value) / 3
    
    // Fórmula cúbica de Bézier
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt
    const t2 = t * t
    const t3 = t2 * t
    
    return mt3 * p0 + 3 * mt2 * t * h1 + 3 * mt * t2 * h2 + t3 * p3
  }
  
  // Easings predefinidos
  private easeIn(t: number): number { return t * t * t }
  private easeOut(t: number): number { return 1 - Math.pow(1 - t, 3) }
  private easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }
  
  private denormalizeValue(
    normalized: number, 
    range: { min: number; max: number }
  ): number {
    return range.min + normalized * (range.max - range.min)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FRAME LOOP
  // ═══════════════════════════════════════════════════════════════════════
  
  private startFrameLoop(): void {
    if (this.animationFrameId) return
    
    const frameInterval = 1000 / this.config.targetFps
    this.lastFrameTime = performance.now()
    
    const loop = (now: number) => {
      const elapsed = now - this.lastFrameTime
      
      if (elapsed >= frameInterval) {
        this.lastFrameTime = now - (elapsed % frameInterval)
        this.tick()
      }
      
      this.animationFrameId = requestAnimationFrame(loop)
    }
    
    this.animationFrameId = requestAnimationFrame(loop)
  }
  
  private stopFrameLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
  
  /**
   * Tick del frame loop
   */
  private tick(): void {
    if (!this.audioElement) return
    
    // Sincronizar con audio real
    this.state.audioTimeMs = this.audioElement.currentTime * 1000
    
    // Aplicar compensación de latencia (adelantamos la posición)
    this.state.currentTimeMs = this.state.audioTimeMs + this.config.latencyCompensationMs
    
    // Verificar loop
    if (this.state.looping && this.state.loopRegion) {
      if (this.state.currentTimeMs >= this.state.loopRegion.endMs) {
        this.seekTo(this.state.loopRegion.startMs)
      }
    }
    
    // Calcular contexto y emitir
    const context = this.calculateContext(this.state.currentTimeMs)
    this.emit('context-update', context)
    this.emit('tick', this.state.currentTimeMs)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  private isBlockActiveAt(block: ChronosBlock, timeMs: number): boolean {
    const endTime = block.startMs + block.durationMs
    return timeMs >= block.startMs && timeMs < endTime
  }
  
  private calculateBlockProgress(block: ChronosBlock, timeMs: number): number {
    if (block.durationMs === 0) return 1.0
    
    const elapsed = timeMs - block.startMs
    const rawProgress = elapsed / block.durationMs
    
    if (block.loop) {
      return rawProgress % 1.0
    }
    
    return Math.max(0, Math.min(1, rawProgress))
  }
  
  private getDuration(): number {
    return this.project?.meta.durationMs ?? 0
  }
  
  private recalculateEffectStates(timeMs: number): void {
    // Recalcular estados de efectos para scrubbing
    this.activeEffectStates.clear()
    
    if (!this.project) return
    
    for (const track of this.project.tracks) {
      if (!track.enabled || track.type !== 'effect') continue
      
      for (const block of track.blocks) {
        if (this.isBlockActiveAt(block, timeMs)) {
          const payload = block.payload as EffectTriggerPayload
          const progress = this.calculateBlockProgress(block, timeMs)
          
          this.activeEffectStates.set(block.id, {
            effectId: payload.effectId,
            progress: progress,
            intensity: payload.intensity,
          })
        }
      }
    }
  }
  
  private createEmptyContext(): ChronosContext {
    return {
      timestamp: 0,
      active: false,
      overrideMode: 'whisper',
      vibeOverride: null,
      intensityOverride: null,
      zoneOverrides: null,
      colorOverride: null,
      activeEffects: [],
      automationValues: new Map(),
    }
  }
  
  private convertEventsToBlocks(events: RecordedEvent[]): ChronosBlock[] {
    // Convertir eventos grabados a bloques editables
    // Agrupa eventos similares en bloques con duración
    
    const blocks: ChronosBlock[] = []
    
    for (const event of events) {
      const block: ChronosBlock = {
        id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        startMs: event.timeMs,
        durationMs: event.durationMs ?? 1000, // Default 1s
        type: event.type as any,
        payload: event.payload,
        easeIn: 'linear',
        easeOut: 'linear',
        loop: false,
        priority: 0,
        meta: {
          label: event.label ?? '',
          color: '#22d3ee',
          notes: 'Recorded via Ghost Recording',
        },
      }
      
      blocks.push(block)
    }
    
    return blocks
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════
  
  getState(): ChronosEngineState {
    return { ...this.state }
  }
  
  getProject(): ChronosFile | null {
    return this.project
  }
  
  getCurrentContext(): ChronosContext {
    return this.calculateContext(this.state.currentTimeMs)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORTING TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EffectPlaybackState {
  effectId: string
  progress: number
  intensity: number
}

interface RecordedEvent {
  timeMs: number
  type: string
  payload: any
  durationMs?: number
  label?: string
}

interface BlockMeta {
  label: string
  color: string
  notes?: string
}
```

---

## 🔌 PUNTO 3: INTEGRACIÓN ARQUITECTÓNICA

### 3.1 El Punto de Inyección

```typescript
/**
 * 🧬 CHRONOS CONTEXT
 * 
 * El payload que Chronos genera cada frame.
 * Se inyecta en TitanEngine como "susurro" o "dictador".
 * 
 * MODOS:
 * - 'whisper': Chronos SUGIERE, Selene decide
 * - 'full': Chronos DICTA, Selene obedece
 */

export interface ChronosContext {
  /** Timestamp actual (ms) */
  timestamp: number
  
  /** ¿Está Chronos activo? */
  active: boolean
  
  /** Modo de override */
  overrideMode: 'full' | 'whisper'
  
  /** Override de Vibe */
  vibeOverride: {
    vibeId: string
    transition: 'cut' | 'fade'
    progress: number
  } | null
  
  /** Override de intensidad global (0-1) */
  intensityOverride: number | null
  
  /** Override de zonas */
  zoneOverrides: {
    enabledZones: EffectZone[]
    blackoutDisabled: boolean
  } | null
  
  /** Override de paleta de colores */
  colorOverride: {
    palette: { primary: string; secondary: string; accent: string }
    keyLock: string | null
  } | null
  
  /** Efectos disparados por Chronos (con progress scrubbed) */
  activeEffects: ChronosActiveEffect[]
  
  /** Valores de automation evaluados */
  automationValues: Map<string, number>
}

interface ChronosActiveEffect {
  effectId: string
  progress: number      // 🎯 Progress mapeado a timeline (0-1)
  intensity: number
  zones: EffectZone[]
  params: Record<string, number>
  sourceBlockId: string
}
```

### 3.2 Modificación de TitanEngine

```typescript
/**
 * 🔧 MODIFICACIÓN: TitanEngine.update()
 * 
 * Añadir parámetro opcional chronosContext.
 * Si está presente y activo, aplicar overrides antes de Selene.
 */

// EN: electron-app/src/engine/TitanEngine.ts

export class TitanEngine extends EventEmitter {
  // ... existing code ...
  
  // 🆕 WAVE 2000: CHRONOS INJECTION POINT
  private chronosContext: ChronosContext | null = null
  
  /**
   * 🆕 Establece el contexto de Chronos (llamado desde ChronosEngine)
   */
  setChronosContext(context: ChronosContext | null): void {
    this.chronosContext = context
    
    if (context?.active && this.config.debug) {
      console.log(`[TitanEngine] 🕰️ Chronos context received @ ${context.timestamp}ms`)
    }
  }
  
  /**
   * 🎯 MÉTODO PRINCIPAL MODIFICADO
   */
  public async update(
    context: MusicalContext, 
    audio: EngineAudioMetrics
  ): Promise<LightingIntent> {
    // ... existing code before stabilizers ...
    
    // ═══════════════════════════════════════════════════════════════════
    // 🕰️ WAVE 2000: CHRONOS INJECTION (ANTES de stabilizers)
    // ═══════════════════════════════════════════════════════════════════
    
    let effectiveContext = context
    let chronosModifiers: ChronosModifiers | null = null
    
    if (this.chronosContext?.active) {
      const result = this.applyChronosOverrides(context, this.chronosContext)
      effectiveContext = result.context
      chronosModifiers = result.modifiers
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // 🧠 WAVE 271: STABILIZATION LAYER (usa effectiveContext modificado)
    // ─────────────────────────────────────────────────────────────────────
    
    const energyOutput = this.energyStabilizer.update(effectiveContext.energy)
    // ... rest of stabilizer code ...
    
    // ═══════════════════════════════════════════════════════════════════
    // 🕰️ CHRONOS EFFECT INJECTION (DESPUÉS de Selene decide)
    // ═══════════════════════════════════════════════════════════════════
    
    if (chronosModifiers?.effects) {
      for (const chronosEffect of chronosModifiers.effects) {
        // Disparar efecto con progress controlado por Chronos
        this.effectManager.triggerFromChronos({
          effectId: chronosEffect.effectId,
          progress: chronosEffect.progress,  // 🎯 Progress externo (scrubbing)
          intensity: chronosEffect.intensity,
          zones: chronosEffect.zones,
          params: chronosEffect.params,
        })
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🕰️ CHRONOS INTENSITY MODULATION (al final, modula output)
    // ═══════════════════════════════════════════════════════════════════
    
    if (chronosModifiers?.intensityMultiplier !== undefined) {
      intent.globalIntensity = (intent.globalIntensity ?? 1.0) * chronosModifiers.intensityMultiplier
    }
    
    return intent
  }
  
  /**
   * 🆕 Aplica overrides de Chronos al contexto musical
   */
  private applyChronosOverrides(
    original: MusicalContext,
    chronos: ChronosContext
  ): { context: MusicalContext; modifiers: ChronosModifiers } {
    
    const modifiers: ChronosModifiers = {}
    let modified = { ...original }
    
    // 1. VIBE OVERRIDE
    if (chronos.vibeOverride) {
      // Cambiar vibe en VibeManager
      this.vibeManager.setActiveVibe(chronos.vibeOverride.vibeId)
      
      // En modo 'full', forzar cambio instantáneo
      // En modo 'whisper', dejar que el vibe evolucione naturalmente
      if (chronos.overrideMode === 'full' && chronos.vibeOverride.transition === 'cut') {
        // Vibe lock inmediato
      }
    }
    
    // 2. COLOR OVERRIDE (Key Lock)
    if (chronos.colorOverride?.keyLock) {
      modified.key = chronos.colorOverride.keyLock
      modified.confidence = 1.0 // Forzar confianza máxima
    }
    
    // 3. INTENSITY OVERRIDE → Modulator
    if (chronos.intensityOverride !== null) {
      modifiers.intensityMultiplier = chronos.intensityOverride
    }
    
    // 4. AUTOMATION VALUES → Override específicos
    for (const [path, value] of chronos.automationValues) {
      if (path === 'selene.energy') {
        modified.energy = value
      }
      // Add more path handlers as needed
    }
    
    // 5. ZONE OVERRIDES
    if (chronos.zoneOverrides) {
      modifiers.zoneFilter = chronos.zoneOverrides.enabledZones
      modifiers.blackoutDisabledZones = chronos.zoneOverrides.blackoutDisabled
    }
    
    // 6. EFFECT TRIGGERS
    if (chronos.activeEffects.length > 0) {
      modifiers.effects = chronos.activeEffects
    }
    
    return { context: modified, modifiers }
  }
}

interface ChronosModifiers {
  intensityMultiplier?: number
  zoneFilter?: EffectZone[]
  blackoutDisabledZones?: boolean
  effects?: ChronosActiveEffect[]
}
```

### 3.3 Modificación de EffectManager para Scrubbing

```typescript
/**
 * 🔧 MODIFICACIÓN: EffectManager
 * 
 * Añadir método para disparar efectos con progress externo (Chronos scrubbing).
 * El efecto NO usa su reloj interno, usa el progress dado.
 */

// EN: electron-app/src/core/effects/EffectManager.ts

export class EffectManager {
  // ... existing code ...
  
  /**
   * 🆕 WAVE 2000: Dispara efecto con progress controlado externamente
   * 
   * Usado por Chronos para scrubbing de efectos procedurales.
   * El efecto se renderiza en el frame dado por `progress`, no por su reloj.
   */
  triggerFromChronos(config: ChronosTriggerConfig): void {
    const effectFactory = this.registry.get(config.effectId)
    if (!effectFactory) {
      console.warn(`[EffectManager] Unknown effect: ${config.effectId}`)
      return
    }
    
    // Buscar o crear instancia para este efecto
    let effect = this.findActiveChronosEffect(config.effectId, config.sourceBlockId)
    
    if (!effect) {
      // Crear nueva instancia
      effect = effectFactory()
      effect.trigger({
        intensity: config.intensity,
        zones: config.zones,
        source: 'chronos',
        ...config.params,
      })
      
      // Marcar como controlado por Chronos
      effect._chronosControlled = true
      effect._chronosBlockId = config.sourceBlockId
      
      this.activeEffects.push(effect)
    }
    
    // 🎯 KEY: Forzar progress externo (override del reloj interno)
    effect._forceProgress(config.progress)
    effect._forceIntensity(config.intensity)
  }
  
  private findActiveChronosEffect(effectId: string, blockId: string): ILightEffect | null {
    return this.activeEffects.find(e => 
      e.effectType === effectId && 
      e._chronosBlockId === blockId
    ) ?? null
  }
}

// EN: electron-app/src/core/effects/BaseEffect.ts

export abstract class BaseEffect implements ILightEffect {
  // ... existing code ...
  
  // 🆕 WAVE 2000: Chronos control
  _chronosControlled: boolean = false
  _chronosBlockId: string | null = null
  private _forcedProgress: number | null = null
  private _forcedIntensity: number | null = null
  
  /**
   * 🆕 Fuerza un progress específico (para scrubbing de Chronos)
   */
  _forceProgress(progress: number): void {
    this._forcedProgress = progress
  }
  
  /**
   * 🆕 Fuerza una intensidad específica
   */
  _forceIntensity(intensity: number): void {
    this._forcedIntensity = intensity
  }
  
  /**
   * MODIFICADO: getProgress() ahora considera progress forzado
   */
  protected getProgress(): number {
    if (this._forcedProgress !== null) {
      return this._forcedProgress
    }
    
    // Cálculo normal basado en elapsedMs y duración
    return this.calculateNormalProgress()
  }
  
  /**
   * MODIFICADO: getEffectiveIntensity() considera intensidad forzada
   */
  protected getEffectiveIntensity(): number {
    if (this._forcedIntensity !== null) {
      return this._forcedIntensity * this.triggerIntensity
    }
    
    return this.triggerIntensity
  }
}
```

### 3.4 Diagrama de Flujo de Datos

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         DATA FLOW: CHRONOS + LUXSYNC                          ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────────┐                                                      ║
║  │     AUDIO FILE      │ ←── MP3/WAV loaded                                   ║
║  └──────────┬──────────┘                                                      ║
║             │                                                                  ║
║             ▼                                                                  ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                      CHRONOS LAYER                                       │  ║
║  │                                                                          │  ║
║  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │  ║
║  │  │ GodEarOffline│───►│ ChronosEngine│◄───│ ChronosEditor│               │  ║
║  │  │  (Analysis)  │    │  (Playback)  │    │    (React)   │               │  ║
║  │  └──────────────┘    └──────┬───────┘    └──────────────┘               │  ║
║  │                             │                                            │  ║
║  │        ┌────────────────────┴────────────────────┐                       │  ║
║  │        │          ChronosContext                 │                       │  ║
║  │        │  - vibeOverride: 'techno-club'         │                       │  ║
║  │        │  - intensityOverride: 0.8              │                       │  ║
║  │        │  - activeEffects: [                    │                       │  ║
║  │        │      { effectId: 'acid_sweep',         │                       │  ║
║  │        │        progress: 0.45,  ← SCRUBBED     │                       │  ║
║  │        │        intensity: 0.9 }                │                       │  ║
║  │        │    ]                                   │                       │  ║
║  │        │  - automationValues: Map               │                       │  ║
║  │        └────────────────────┬────────────────────┘                       │  ║
║  │                             │                                            │  ║
║  └─────────────────────────────┼────────────────────────────────────────────┘  ║
║                                │                                               ║
║  ══════════════════════════════╪═══════════════════════════════════════════════║
║                INJECTION POINT │                                               ║
║  ══════════════════════════════╪═══════════════════════════════════════════════║
║                                ▼                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐  ║
║  │                        TITAN ENGINE                                      │  ║
║  │                                                                          │  ║
║  │  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │  ║
║  │  │ setChronosContext│───►│ applyChronos     │───►│ effectManager    │   │  ║
║  │  │ (ChronosContext) │    │ Overrides()      │    │ .triggerFrom     │   │  ║
║  │  │                  │    │                  │    │ Chronos()        │   │  ║
║  │  └──────────────────┘    └────────┬─────────┘    └──────────────────┘   │  ║
║  │                                   │                                      │  ║
║  │                    ┌──────────────┴──────────────┐                       │  ║
║  │                    │     MusicalContext          │                       │  ║
║  │                    │     (MODIFIED by Chronos)   │                       │  ║
║  │                    │  - key: 'Am' (locked)       │                       │  ║
║  │                    │  - energy: 0.8 (from curve) │                       │  ║
║  │                    └──────────────┬──────────────┘                       │  ║
║  │                                   │                                      │  ║
║  │                                   ▼                                      │  ║
║  │  ┌──────────────────────────────────────────────────────────────────┐   │  ║
║  │  │                    EXISTING PIPELINE                              │   │  ║
║  │  │  Stabilizers → Selene → EffectManager → LightingIntent           │   │  ║
║  │  │  (Works normally, but with modified input)                        │   │  ║
║  │  └──────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                          │  ║
║  └──────────────────────────────────┬───────────────────────────────────────┘  ║
║                                     │                                          ║
║                                     ▼                                          ║
║                          ┌──────────────────┐                                  ║
║                          │       HAL        │                                  ║
║                          │   (DMX Output)   │                                  ║
║                          └──────────────────┘                                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎨 PUNTO 4: UI COMPONENTS STACK

### 4.1 Arquitectura de Componentes React

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           CHRONOS EDITOR VIEW                                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        TRANSPORT BAR                                  │   │
│  │  [◀◀] [▶/⏸] [⏹] [●REC]    00:45.320 / 04:23.000    [🔁Loop]          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────────────────────────────────┬──────────────────┐   │
│  │                                                   │                   │   │
│  │  ┌────────────────────────────────────────────┐  │   INSPECTOR      │   │
│  │  │              WAVEFORM DISPLAY              │  │                   │   │
│  │  │  ~~~~~~~~~~~~~~∿∿∿∿∿~~~~~~~~~~~∿∿∿~~~     │  │  ┌─────────────┐ │   │
│  │  │  |         |         |         |          │  │  │ BLOCK PROPS │ │   │
│  │  │  ▼ cursor                                  │  │  │             │ │   │
│  │  └────────────────────────────────────────────┘  │  │ Effect:     │ │   │
│  │                                                   │  │ AcidSweep   │ │   │
│  │  ┌────────────────────────────────────────────┐  │  │             │ │   │
│  │  │              ENERGY HEATMAP                │  │  │ Start:      │ │   │
│  │  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█████▄▄▄▄▄▄████████▄    │  │  │ 00:45.320   │ │   │
│  │  └────────────────────────────────────────────┘  │  │             │ │   │
│  │                                                   │  │ Duration:   │ │   │
│  │  ┌────────────────────────────────────────────┐  │  │ 2000ms      │ │   │
│  │  │ TRACK: Vibes                          [M][S]│  │  │             │ │   │
│  │  │ ┌────────┐                    ┌───────────┐ │  │  │ Intensity:  │ │   │
│  │  │ │ Techno │                    │Chill      │ │  │  │ [=====----] │ │   │
│  │  │ │ Club   │                    │Lounge     │ │  │  │ 0.75        │ │   │
│  │  │ └────────┘                    └───────────┘ │  │  └─────────────┘ │   │
│  │  └────────────────────────────────────────────┘  │                   │   │
│  │                                                   │  ┌─────────────┐ │   │
│  │  ┌────────────────────────────────────────────┐  │  │ AUTOMATION  │ │   │
│  │  │ TRACK: Effects                        [M][S]│  │  │             │ │   │
│  │  │ ┌──────┐  ┌────┐      ┌─────────────────┐  │  │  │ Parameter:  │ │   │
│  │  │ │Solar │  │Acid│      │  Strobe Storm   │  │  │  │ Intensity   │ │   │
│  │  │ │Flare │  │Swp │      │                 │  │  │  │             │ │   │
│  │  │ └──────┘  └────┘      └─────────────────┘  │  │  │ Curve:      │ │   │
│  │  └────────────────────────────────────────────┘  │  │  ╱‾‾‾\       │ │   │
│  │                                                   │  │ /    \      │ │   │
│  │  ┌────────────────────────────────────────────┐  │  │/      ‾‾‾\  │ │   │
│  │  │ TRACK: Intensity (Automation)         [M][S]│  │  └─────────────┘ │   │
│  │  │     ╱‾‾‾‾‾‾\                 ╱‾‾‾‾‾‾‾‾\     │  │                   │   │
│  │  │    /        \               /          \    │  │  ┌─────────────┐ │   │
│  │  │___/          \_____________/            \___|  │  │ EFFECT LIB  │ │   │
│  │  └────────────────────────────────────────────┘  │  │             │ │   │
│  │                                                   │  │ ▢ SolarFlare│ │   │
│  │  ┌────────────────────────────────────────────┐  │  │ ▢ AcidSweep │ │   │
│  │  │ TRACK: Markers                             │  │  │ ▢ StrobeBst │ │   │
│  │  │  📍Drop    📍Breakdown   📍Buildup   📍Drop │  │  │ ▢ TidalWave │ │   │
│  │  └────────────────────────────────────────────┘  │  │ ▢ GhostBrth │ │   │
│  │                                                   │  └─────────────┘ │   │
│  └───────────────────────────────────────────────┴──────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  BEAT RULER:  |  1  |  2  |  3  |  4  |  1  |  2  |  3  |  4  |     │   │
│  │  TIME RULER:  0:45      0:46      0:47      0:48      0:49          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Tree

```typescript
/**
 * 🎨 CHRONOS UI COMPONENTS
 * 
 * Árbol de componentes React para el editor de Chronos.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TOP-LEVEL VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface ChronosEditorViewProps {
  projectPath?: string
  onSave?: (project: ChronosFile) => void
}

const ChronosEditorView: React.FC<ChronosEditorViewProps> = (props) => {
  const [project, setProject] = useState<ChronosFile | null>(null)
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set())
  const [playheadPosition, setPlayheadPosition] = useState<number>(0)
  
  const engineRef = useRef<ChronosEngine | null>(null)
  
  return (
    <ChronosProvider engine={engineRef.current} project={project}>
      <div className="chronos-editor">
        <TransportBar />
        
        <div className="chronos-main">
          <div className="chronos-timeline-area">
            <WaveformDisplay />
            <EnergyHeatmap />
            <TrackList />
            <BeatRuler />
            <TimeRuler />
            <Playhead />
          </div>
          
          <div className="chronos-inspector">
            <BlockPropertiesPanel />
            <AutomationEditor />
            <EffectLibraryPanel />
          </div>
        </div>
      </div>
    </ChronosProvider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSPORT BAR
// ═══════════════════════════════════════════════════════════════════════════

const TransportBar: React.FC = () => {
  const { engine, playState, currentTime, duration } = useChronos()
  
  return (
    <div className="transport-bar">
      <div className="transport-controls">
        <button onClick={() => engine.seekTo(0)}>⏮️</button>
        <button onClick={() => playState === 'playing' ? engine.pause() : engine.play()}>
          {playState === 'playing' ? '⏸️' : '▶️'}
        </button>
        <button onClick={() => engine.stop()}>⏹️</button>
        <button 
          className={playState === 'recording' ? 'recording' : ''}
          onClick={() => playState === 'recording' 
            ? engine.stopRecording() 
            : engine.startRecording()
          }
        >
          🔴 REC
        </button>
      </div>
      
      <div className="transport-time">
        <span className="time-current">{formatTime(currentTime)}</span>
        <span className="time-separator">/</span>
        <span className="time-duration">{formatTime(duration)}</span>
      </div>
      
      <div className="transport-bpm">
        <span className="bpm-value">{project?.meta.bpm ?? '--'}</span>
        <span className="bpm-label">BPM</span>
      </div>
      
      <div className="transport-options">
        <button className="loop-toggle">🔁 Loop</button>
        <button className="snap-toggle">🧲 Snap</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

interface WaveformDisplayProps {
  analysis: WaveformData
  zoom: number
  scrollOffset: number
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ analysis, zoom, scrollOffset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analysis) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Render waveform peaks
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#22d3ee'
    
    const samplesPerPixel = Math.ceil(analysis.peaks.length / (canvas.width * zoom))
    const centerY = canvas.height / 2
    
    for (let x = 0; x < canvas.width; x++) {
      const sampleIndex = Math.floor((x + scrollOffset) * samplesPerPixel)
      if (sampleIndex >= analysis.peaks.length) break
      
      const peak = analysis.peaks[sampleIndex]
      const height = peak * centerY * 0.9
      
      ctx.fillRect(x, centerY - height, 1, height * 2)
    }
  }, [analysis, zoom, scrollOffset])
  
  return (
    <div className="waveform-display">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TRACK LIST
// ═══════════════════════════════════════════════════════════════════════════

const TrackList: React.FC = () => {
  const { project, selectedBlockIds, setSelectedBlockIds } = useChronos()
  
  if (!project) return null
  
  return (
    <div className="track-list">
      {project.tracks.map(track => (
        <TrackRow 
          key={track.id} 
          track={track}
          selectedBlockIds={selectedBlockIds}
          onBlockSelect={setSelectedBlockIds}
        />
      ))}
    </div>
  )
}

interface TrackRowProps {
  track: ChronosTrack
  selectedBlockIds: Set<string>
  onBlockSelect: (ids: Set<string>) => void
}

const TrackRow: React.FC<TrackRowProps> = ({ track, selectedBlockIds, onBlockSelect }) => {
  return (
    <div className={`track-row track-type-${track.type}`}>
      <div className="track-header">
        <span className="track-name">{track.name}</span>
        <button className="track-mute">M</button>
        <button className="track-solo">S</button>
      </div>
      
      <div className="track-content">
        {track.blocks.map(block => (
          <BlockComponent
            key={block.id}
            block={block}
            trackType={track.type}
            selected={selectedBlockIds.has(block.id)}
            onSelect={() => onBlockSelect(new Set([block.id]))}
          />
        ))}
        
        {/* Automation lane visualization */}
        {track.automation.map(lane => (
          <AutomationLaneDisplay key={lane.id} lane={lane} />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK COMPONENT (Draggable/Resizable)
// ═══════════════════════════════════════════════════════════════════════════

interface BlockComponentProps {
  block: ChronosBlock
  trackType: TrackType
  selected: boolean
  onSelect: () => void
}

const BlockComponent: React.FC<BlockComponentProps> = ({ 
  block, 
  trackType, 
  selected, 
  onSelect 
}) => {
  const { msToPixels, snapToGrid } = useChronos()
  
  const left = msToPixels(block.startMs)
  const width = msToPixels(block.durationMs)
  
  const handleDrag = (e: React.DragEvent, deltaX: number) => {
    const newStartMs = snapToGrid(block.startMs + pixelsToMs(deltaX))
    // Update block position...
  }
  
  const handleResize = (e: React.DragEvent, edge: 'left' | 'right', deltaX: number) => {
    if (edge === 'right') {
      const newDuration = snapToGrid(block.durationMs + pixelsToMs(deltaX))
      // Update block duration...
    }
  }
  
  return (
    <div
      className={`block block-${trackType} ${selected ? 'selected' : ''}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: block.meta.color,
      }}
      onClick={onSelect}
      draggable
    >
      <div className="block-label">{getBlockLabel(block)}</div>
      
      {/* Resize handles */}
      <div className="block-handle block-handle-left" />
      <div className="block-handle block-handle-right" />
      
      {/* Fade handles (for easing visualization) */}
      {block.easeIn !== 'step' && (
        <div className="block-fade block-fade-in" />
      )}
      {block.easeOut !== 'step' && (
        <div className="block-fade block-fade-out" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION EDITOR (Bézier Curve Editor)
// ═══════════════════════════════════════════════════════════════════════════

interface AutomationEditorProps {
  lane: AutomationLane
  onUpdate: (lane: AutomationLane) => void
}

const AutomationEditor: React.FC<AutomationEditorProps> = ({ lane, onUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null)
  const [draggingHandle, setDraggingHandle] = useState<'in' | 'out' | null>(null)
  
  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Convert to time/value
    const timeMs = pixelsToMs(x)
    const value = 1 - (y / rect.height)
    
    // Add new keyframe
    const newKeyframe: AutomationKeyframe = {
      timeMs,
      value,
      interpolation: 'bezier',
    }
    
    onUpdate({
      ...lane,
      keyframes: [...lane.keyframes, newKeyframe].sort((a, b) => a.timeMs - b.timeMs)
    })
  }
  
  // Render automation curve...
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw curve
    ctx.strokeStyle = '#7C4DFF'
    ctx.lineWidth = 2
    ctx.beginPath()
    
    for (let x = 0; x < canvas.width; x++) {
      const timeMs = pixelsToMs(x)
      const value = evaluateAutomationAt(lane, timeMs)
      const y = (1 - value) * canvas.height
      
      if (x === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    ctx.stroke()
    
    // Draw keyframes
    for (const kf of lane.keyframes) {
      const x = msToPixels(kf.timeMs)
      const y = (1 - kf.value) * canvas.height
      
      ctx.fillStyle = '#22d3ee'
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // Draw handles for Bézier
      if (kf.interpolation === 'bezier') {
        if (kf.handleIn) {
          const hx = x + msToPixels(kf.handleIn.timeOffset)
          const hy = y - kf.handleIn.valueOffset * canvas.height
          
          ctx.strokeStyle = '#64748b'
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(hx, hy)
          ctx.stroke()
          
          ctx.fillStyle = '#64748b'
          ctx.beginPath()
          ctx.arc(hx, hy, 4, 0, Math.PI * 2)
          ctx.fill()
        }
        
        if (kf.handleOut) {
          // Similar for handleOut...
        }
      }
    }
  }, [lane])
  
  return (
    <div className="automation-editor">
      <div className="automation-header">
        <span className="automation-name">{lane.name}</span>
        <span className="automation-target">{lane.targetPath}</span>
      </div>
      
      <canvas
        ref={canvasRef}
        className="automation-canvas"
        onClick={handleCanvasClick}
      />
      
      <div className="automation-controls">
        <select 
          value={lane.keyframes[0]?.interpolation ?? 'linear'}
          onChange={(e) => {/* Update interpolation type */}}
        >
          <option value="linear">Linear</option>
          <option value="bezier">Bézier</option>
          <option value="step">Step</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
        </select>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT LIBRARY PANEL
// ═══════════════════════════════════════════════════════════════════════════

const EffectLibraryPanel: React.FC = () => {
  const [filter, setFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<EffectCategory | 'all'>('all')
  
  // Get effects from EffectManager registry
  const effects = useMemo(() => {
    return getEffectManager().getAvailableEffects()
      .filter(e => 
        (categoryFilter === 'all' || e.category === categoryFilter) &&
        e.name.toLowerCase().includes(filter.toLowerCase())
      )
  }, [filter, categoryFilter])
  
  return (
    <div className="effect-library-panel">
      <div className="library-header">
        <h3>Effect Library</h3>
        <input 
          type="text" 
          placeholder="Search..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      
      <div className="library-categories">
        {['all', 'physical', 'ambient', 'strobe', 'sweep'].map(cat => (
          <button
            key={cat}
            className={categoryFilter === cat ? 'active' : ''}
            onClick={() => setCategoryFilter(cat as any)}
          >
            {cat}
          </button>
        ))}
      </div>
      
      <div className="library-list">
        {effects.map(effect => (
          <div
            key={effect.effectType}
            className="library-effect"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('effect', effect.effectType)
            }}
          >
            <span className="effect-icon">{getEffectIcon(effect.category)}</span>
            <span className="effect-name">{effect.name}</span>
            <span className="effect-category">{effect.category}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 4.3 Hooks y Context

```typescript
/**
 * 🎣 CHRONOS HOOKS
 * 
 * Hooks de React para acceder al estado de Chronos.
 */

interface ChronosContextValue {
  engine: ChronosEngine | null
  project: ChronosFile | null
  
  // Playback state
  playState: ChronosPlayState
  currentTime: number
  duration: number
  
  // Selection
  selectedBlockIds: Set<string>
  setSelectedBlockIds: (ids: Set<string>) => void
  
  // Zoom/scroll
  zoom: number
  setZoom: (z: number) => void
  scrollOffset: number
  setScrollOffset: (o: number) => void
  
  // Helpers
  msToPixels: (ms: number) => number
  pixelsToMs: (px: number) => number
  snapToGrid: (ms: number) => number
}

const ChronosContext = createContext<ChronosContextValue | null>(null)

export const useChronos = (): ChronosContextValue => {
  const ctx = useContext(ChronosContext)
  if (!ctx) throw new Error('useChronos must be used within ChronosProvider')
  return ctx
}

export const ChronosProvider: React.FC<{
  engine: ChronosEngine | null
  project: ChronosFile | null
  children: React.ReactNode
}> = ({ engine, project, children }) => {
  const [playState, setPlayState] = useState<ChronosPlayState>('stopped')
  const [currentTime, setCurrentTime] = useState(0)
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [scrollOffset, setScrollOffset] = useState(0)
  
  // Subscribe to engine events
  useEffect(() => {
    if (!engine) return
    
    const handleTick = (timeMs: number) => setCurrentTime(timeMs)
    const handlePlay = () => setPlayState('playing')
    const handlePause = () => setPlayState('paused')
    const handleStop = () => {
      setPlayState('stopped')
      setCurrentTime(0)
    }
    
    engine.on('tick', handleTick)
    engine.on('play', handlePlay)
    engine.on('pause', handlePause)
    engine.on('stop', handleStop)
    
    return () => {
      engine.off('tick', handleTick)
      engine.off('play', handlePlay)
      engine.off('pause', handlePause)
      engine.off('stop', handleStop)
    }
  }, [engine])
  
  const msToPixels = useCallback((ms: number) => {
    const pixelsPerMs = 0.1 * zoom // 100px per second at zoom=1
    return ms * pixelsPerMs
  }, [zoom])
  
  const pixelsToMs = useCallback((px: number) => {
    const pixelsPerMs = 0.1 * zoom
    return px / pixelsPerMs
  }, [zoom])
  
  const snapToGrid = useCallback((ms: number) => {
    if (!project?.analysis.beatGrid) return ms
    
    const { beats } = project.analysis.beatGrid
    const closest = beats.reduce((prev, curr) => 
      Math.abs(curr - ms) < Math.abs(prev - ms) ? curr : prev
    )
    
    // Only snap if within threshold
    if (Math.abs(closest - ms) < 50) {
      return closest
    }
    return ms
  }, [project])
  
  const value: ChronosContextValue = {
    engine,
    project,
    playState,
    currentTime,
    duration: project?.meta.durationMs ?? 0,
    selectedBlockIds,
    setSelectedBlockIds,
    zoom,
    setZoom,
    scrollOffset,
    setScrollOffset,
    msToPixels,
    pixelsToMs,
    snapToGrid,
  }
  
  return (
    <ChronosContext.Provider value={value}>
      {children}
    </ChronosContext.Provider>
  )
}
```

---

## 🔬 PUNTO 5: GODEAR OFFLINE ANALYZER

```typescript
/**
 * 🔬 GODEAR OFFLINE ANALYZER
 * 
 * Versión offline del análisis GodEar.
 * Procesa el audio completo en segundos y genera:
 * - Waveform peaks (para visualización)
 * - Energy heatmap (para intensidad visual)
 * - Beat grid (para snap)
 * - Secciones automáticas (para markers)
 * 
 * PERFORMANCE TARGET: < 5 segundos para un track de 5 minutos
 * 
 * STRATEGY:
 * - Usa OfflineAudioContext para procesamiento en background
 * - Web Workers para FFT paralelo
 * - Downsampling agresivo para overview (100-200 samples/segundo)
 */

export class GodEarOfflineAnalyzer {
  private sampleRate: number = 44100
  
  /**
   * Analiza un archivo de audio completo
   */
  async analyze(audioBuffer: AudioBuffer): Promise<ChronosAnalysis> {
    console.log(`[GodEarOffline] Analyzing ${audioBuffer.duration.toFixed(1)}s of audio...`)
    const startTime = performance.now()
    
    // 1. Extract mono channel
    const monoData = this.mixToMono(audioBuffer)
    
    // 2. Generate waveform (parallelizable)
    const waveformPromise = this.generateWaveform(monoData)
    
    // 3. Generate energy heatmap
    const heatmapPromise = this.generateHeatmap(monoData)
    
    // 4. Beat detection
    const beatGridPromise = this.detectBeats(monoData)
    
    // 5. Section detection
    const sectionsPromise = this.detectSections(monoData)
    
    // 6. Transient detection
    const transientsPromise = this.detectTransients(monoData)
    
    // Await all in parallel
    const [waveform, energyHeatmap, beatGrid, sections, transients] = await Promise.all([
      waveformPromise,
      heatmapPromise,
      beatGridPromise,
      sectionsPromise,
      transientsPromise,
    ])
    
    const elapsed = performance.now() - startTime
    console.log(`[GodEarOffline] Analysis complete in ${elapsed.toFixed(0)}ms`)
    
    return {
      waveform,
      energyHeatmap,
      beatGrid,
      sections,
      transients,
    }
  }
  
  private mixToMono(buffer: AudioBuffer): Float32Array {
    const numChannels = buffer.numberOfChannels
    const length = buffer.length
    const mono = new Float32Array(length)
    
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels
      }
    }
    
    return mono
  }
  
  private async generateWaveform(data: Float32Array): Promise<WaveformData> {
    const targetSamplesPerSecond = 100 // 100 samples per second for overview
    const samplesPerSecondOriginal = this.sampleRate
    const ratio = Math.floor(samplesPerSecondOriginal / targetSamplesPerSecond)
    
    const numSamples = Math.ceil(data.length / ratio)
    const peaks = new Float32Array(numSamples)
    const rms = new Float32Array(numSamples)
    
    for (let i = 0; i < numSamples; i++) {
      const start = i * ratio
      const end = Math.min(start + ratio, data.length)
      
      let maxPeak = 0
      let sumSquares = 0
      
      for (let j = start; j < end; j++) {
        const sample = Math.abs(data[j])
        maxPeak = Math.max(maxPeak, sample)
        sumSquares += sample * sample
      }
      
      peaks[i] = maxPeak
      rms[i] = Math.sqrt(sumSquares / (end - start))
    }
    
    return {
      samplesPerSecond: targetSamplesPerSecond,
      peaks,
      rms,
    }
  }
  
  private async generateHeatmap(data: Float32Array): Promise<HeatmapData> {
    const resolutionMs = 50 // 50ms per sample (20 samples per second)
    const samplesPerWindow = Math.floor((resolutionMs / 1000) * this.sampleRate)
    const numWindows = Math.ceil(data.length / samplesPerWindow)
    
    const energy = new Float32Array(numWindows)
    const bass = new Float32Array(numWindows)
    const high = new Float32Array(numWindows)
    const flux = new Float32Array(numWindows)
    
    // FFT setup
    const fftSize = 2048
    let prevSpectrum: Float32Array | null = null
    
    for (let w = 0; w < numWindows; w++) {
      const start = w * samplesPerWindow
      const end = Math.min(start + fftSize, data.length)
      
      // Extract window
      const window = data.slice(start, end)
      
      // Apply Hann window and FFT (simplified - in real impl use proper FFT lib)
      const spectrum = this.simpleFFT(window)
      
      // Calculate energy (RMS of window)
      let sumSquares = 0
      for (let i = start; i < Math.min(start + samplesPerWindow, data.length); i++) {
        sumSquares += data[i] * data[i]
      }
      energy[w] = Math.sqrt(sumSquares / samplesPerWindow)
      
      // Bass (20-200 Hz bins)
      const bassEnd = Math.floor(200 * fftSize / this.sampleRate)
      bass[w] = this.sumBins(spectrum, 0, bassEnd)
      
      // High (4000-20000 Hz bins)
      const highStart = Math.floor(4000 * fftSize / this.sampleRate)
      const highEnd = Math.floor(20000 * fftSize / this.sampleRate)
      high[w] = this.sumBins(spectrum, highStart, highEnd)
      
      // Spectral flux (difference from previous frame)
      if (prevSpectrum) {
        let diff = 0
        for (let i = 0; i < spectrum.length; i++) {
          diff += Math.abs(spectrum[i] - prevSpectrum[i])
        }
        flux[w] = diff / spectrum.length
      }
      
      prevSpectrum = spectrum
    }
    
    // Normalize
    this.normalize(energy)
    this.normalize(bass)
    this.normalize(high)
    this.normalize(flux)
    
    return {
      resolutionMs,
      energy,
      bass,
      high,
      flux,
    }
  }
  
  private async detectBeats(data: Float32Array): Promise<BeatGridData> {
    // Simple onset detection + autocorrelation for BPM
    // In production, use a proper library like Essentia.js
    
    const onsets = this.detectOnsets(data)
    const bpm = this.estimateBPM(onsets)
    const beatPeriodMs = 60000 / bpm
    
    // Find first beat (strongest onset near beginning)
    const firstBeatMs = this.findFirstBeat(onsets, beatPeriodMs)
    
    // Generate beat grid
    const durationMs = (data.length / this.sampleRate) * 1000
    const beats: number[] = []
    const downbeats: number[] = []
    
    let beatTime = firstBeatMs
    let beatCount = 0
    
    while (beatTime < durationMs) {
      beats.push(beatTime)
      
      if (beatCount % 4 === 0) {
        downbeats.push(beatTime)
      }
      
      beatTime += beatPeriodMs
      beatCount++
    }
    
    return {
      bpm,
      firstBeatMs,
      timeSignature: 4,
      beats,
      downbeats,
      confidence: 0.85, // Placeholder
    }
  }
  
  private async detectSections(data: Float32Array): Promise<AutoSection[]> {
    // Simplified section detection based on energy changes
    // In production, use a proper music structure analysis library
    
    const sections: AutoSection[] = []
    const windowMs = 5000 // 5 second windows
    const samplesPerWindow = Math.floor((windowMs / 1000) * this.sampleRate)
    
    let prevEnergy = 0
    let sectionStart = 0
    let currentType: SectionType = 'intro'
    
    for (let i = 0; i < data.length; i += samplesPerWindow) {
      const end = Math.min(i + samplesPerWindow, data.length)
      
      // Calculate window energy
      let energy = 0
      for (let j = i; j < end; j++) {
        energy += data[j] * data[j]
      }
      energy = Math.sqrt(energy / (end - i))
      
      // Detect significant changes
      const energyChange = energy - prevEnergy
      const timeMs = (i / this.sampleRate) * 1000
      
      if (Math.abs(energyChange) > 0.2) {
        // Close previous section
        if (timeMs > sectionStart) {
          sections.push({
            type: currentType,
            startMs: sectionStart,
            endMs: timeMs,
            confidence: 0.7,
            avgEnergy: prevEnergy,
          })
        }
        
        // Start new section
        sectionStart = timeMs
        
        // Determine new section type
        if (energyChange > 0.3) {
          currentType = 'drop'
        } else if (energyChange < -0.3) {
          currentType = 'breakdown'
        } else if (energy > 0.7) {
          currentType = 'chorus'
        } else if (energy < 0.3) {
          currentType = 'verse'
        } else {
          currentType = 'bridge'
        }
      }
      
      prevEnergy = energy
    }
    
    // Close final section
    const durationMs = (data.length / this.sampleRate) * 1000
    sections.push({
      type: sections.length === 0 ? 'outro' : currentType,
      startMs: sectionStart,
      endMs: durationMs,
      confidence: 0.7,
      avgEnergy: prevEnergy,
    })
    
    return sections
  }
  
  private async detectTransients(data: Float32Array): Promise<number[]> {
    // Detect transients (sharp attacks) for snap points
    const transients: number[] = []
    const windowSize = 1024
    const hopSize = 512
    
    let prevEnergy = 0
    
    for (let i = 0; i < data.length - windowSize; i += hopSize) {
      let energy = 0
      for (let j = i; j < i + windowSize; j++) {
        energy += data[j] * data[j]
      }
      energy = Math.sqrt(energy / windowSize)
      
      // Detect sudden increase (transient)
      if (energy > prevEnergy * 1.5 && energy > 0.1) {
        const timeMs = (i / this.sampleRate) * 1000
        transients.push(timeMs)
      }
      
      prevEnergy = energy
    }
    
    return transients
  }
  
  // Helper methods...
  private simpleFFT(data: Float32Array): Float32Array {
    // Placeholder - use proper FFT library in production
    return new Float32Array(data.length / 2)
  }
  
  private sumBins(spectrum: Float32Array, start: number, end: number): number {
    let sum = 0
    for (let i = start; i < Math.min(end, spectrum.length); i++) {
      sum += spectrum[i]
    }
    return sum
  }
  
  private normalize(data: Float32Array): void {
    let max = 0
    for (let i = 0; i < data.length; i++) {
      max = Math.max(max, data[i])
    }
    if (max > 0) {
      for (let i = 0; i < data.length; i++) {
        data[i] /= max
      }
    }
  }
  
  private detectOnsets(data: Float32Array): number[] {
    // Simplified onset detection
    return []
  }
  
  private estimateBPM(onsets: number[]): number {
    // Placeholder - return default BPM
    return 120
  }
  
  private findFirstBeat(onsets: number[], periodMs: number): number {
    return 0
  }
}
```

---

## 🎯 RESUMEN EJECUTIVO

### Lo Que CHRONOS NO Es:
- ❌ Un secuenciador DMX tradicional
- ❌ Una lista de cues con valores de canal
- ❌ Un reemplazo de Selene
- ❌ Un sistema de timeline lineal rígido

### Lo Que CHRONOS SÍ Es:
- ✅ Un **Director de Orquesta** que susurra a la IA
- ✅ Un **Editor de Intenciones** (Vibes, Efectos, Curvas)
- ✅ Un **Scrubber Universal** para efectos procedurales
- ✅ Un **Grabador de Improvisaciones** (Ghost Recording)
- ✅ Un **Analizador Offline** que genera mapas de calor

### Puntos de Integración:
1. **ChronosEngine** genera `ChronosContext` cada frame
2. **TitanEngine.setChronosContext()** recibe el payload
3. **applyChronosOverrides()** modifica `MusicalContext` antes de stabilizers
4. **EffectManager.triggerFromChronos()** permite scrubbing de efectos
5. **BaseEffect._forceProgress()** permite control externo del ciclo de vida

### Performance Budget:
- Offline analysis: < 5 segundos para track de 5 minutos
- Context calculation: < 1ms por frame
- UI render: 60 FPS con 100 tracks/1000 blocks

### Filosofía de Diseño:
```
"Selene es el músico. Chronos es el director de orquesta.
 El director no toca los instrumentos, pero decide el tempo,
 la dinámica y el carácter de cada sección."
```

---

**BLUEPRINT COMPLETO**  
**Versión: 1.0.0**  
**Arquitecto: PunkOpus (Grand Architect Mode)**  
**Fecha: February 2026**  

---

## 📋 PRÓXIMOS PASOS SUGERIDOS

1. **WAVE 2001**: Implementar `ChronosEngine` core (sin UI)
2. **WAVE 2002**: Implementar `GodEarOfflineAnalyzer` (beat detection + waveform)
3. **WAVE 2003**: Integrar injection point en `TitanEngine`
4. **WAVE 2004**: UI básica (Transport + Waveform + Timeline)
5. **WAVE 2005**: Ghost Recording
6. **WAVE 2006**: Automation Editor (Bézier curves)
7. **WAVE 2007**: Effect scrubbing completo

**END BLUEPRINT**
