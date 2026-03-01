/**
 * 🏛️ WAVE 248: SELENE PROTOCOL - THE FUSION
 * 
 * ARCHIVO ÍNDICE DEL PROTOCOLO TITAN 2.0 ENRIQUECIDO.
 * 
 * Este archivo define TODOS los tipos que cruzan límites de módulo.
 * Si un tipo no está aquí, NO PUEDE usarse para comunicación inter-módulo.
 * 
 * WAVE 248: Incorpora toda la riqueza cognitiva y sensorial del V1.
 * - SensoryData (audio crudo, FFT, beat)
 * - CognitiveData (mood, evolution, dream, zodiac, beauty)
 * - Estructura enriquecida de SeleneTruth
 * 
 * "SELENEPROTOCOL ES LA BIBLIA" - Mandamiento #4
 * 
 * @version TITAN 2.0 ENRICHED
 * @wave 248
 */

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTAR PROTOCOLOS DE CAPAS
// ═══════════════════════════════════════════════════════════════════════════

// CEREBRO → MOTOR
export * from './MusicalContext'

// MOTOR → HAL
export * from './LightingIntent'

// HAL → HARDWARE
export * from './DMXPacket'

// ═══════════════════════════════════════════════════════════════════════════
// 1. TIPOS COMUNES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modos de operación de Selene
 */
export type SeleneMode = 
  | 'off'             // Sistema apagado
  | 'manual'          // Control manual completo
  | 'flow'            // Reactivo a audio (Flow) - WAVE 248: renamed from 'reactive'
  | 'selene'          // Modo Selene completo (Brain activo)
  | 'locked'          // Control bloqueado

/**
 * IDs de Vibes predefinidos
 */
export type VibeId = 
  | 'techno-club'
  | 'fiesta-latina'   // WAVE 248: renamed from 'latin-party'
  | 'pop-rock'        // WAVE 248: renamed from 'rock-concert'
  | 'chill-lounge'
  | 'idle'            // WAVE 248: No vibe selected
  | 'custom'

/**
 * Niveles de audio en tiempo real
 */
export interface AudioLevels {
  /** Nivel general (0-1) */
  overall: number
  /** Nivel de bajos (0-1) */
  bass: number
  /** Nivel de medios (0-1) */
  mid: number
  /** Nivel de agudos (0-1) */
  treble: number
  /** ¿Hay beat activo? */
  isBeat: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SENSORY LAYER - Raw Audio Input (from V1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw audio metrics from capture device
 * @source src/hooks/useAudioCapture.ts
 */
export interface SensoryData {
  /** Raw audio metrics */
  audio: {
    /** Current energy level (0-1), normalized */
    energy: number
    /** Peak energy in current window */
    peak: number
    /** Running average energy */
    average: number
    /** Low frequency energy (bass, 20-250Hz) */
    bass: number
    /** Mid frequency energy (250Hz-4kHz) */
    mid: number
    /** High frequency energy (4kHz-20kHz) */
    high: number
    /** Spectral centroid (brightness indicator) */
    spectralCentroid: number
    /** Spectral flux (change detection) */
    spectralFlux: number
    /** Zero crossing rate (texture) */
    zeroCrossingRate: number
  }
  
  /** FFT frequency bins (256 values, 0-1 normalized) */
  fft: number[]
  
  /** Beat detection state */
  beat: {
    /** True on exact beat moment */
    onBeat: boolean
    /** Confidence of beat detection (0-1) */
    confidence: number
    /** Current BPM estimate */
    bpm: number
    /** Phase within current beat (0-1) */
    beatPhase: number
    /** Phase within current bar (0-1) */
    barPhase: number
    /** Time since last beat (ms) */
    timeSinceLastBeat: number
  }
  
  /** Input configuration */
  input: {
    /** User-set input gain multiplier */
    gain: number
    /** Active audio device name */
    device: string
    /** True if audio is being received */
    active: boolean
    /** Clipping detection */
    isClipping: boolean
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 1195: GOD EAR SPECTRUM BANDS (7 tactical bands)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 7 tactical frequency bands from GodEar FFT */
  spectrumBands: {
    /** 20-60Hz - Presión de aire pura (kicks sísmicos, 808 rumble) */
    subBass: number
    /** 60-250Hz - Cuerpo rítmico (bajos, kick body, toms) */
    bass: number
    /** 250-500Hz - Calor/Mud zone (limpieza crítica) */
    lowMid: number
    /** 500-2000Hz - Voces/Snare/Lead (corazón musical) */
    mid: number
    /** 2000-6000Hz - Crunch/Ataque/Presencia (edge definition) */
    highMid: number
    /** 6000-16000Hz - Brillo/Hi-Hats/Aire (sparkle zone) */
    treble: number
    /** 16000-22000Hz - Armónicos superiores (sizzle digital) */
    ultraAir: number
    /** Dominant band name */
    dominant: 'subBass' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'treble' | 'ultraAir'
    /** Spectral flux (change rate) */
    flux: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. COGNITIVE LAYER - Consciousness & Personality (from V1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mood types for Selene's emotional state
 */
export type SeleneMood = 'peaceful' | 'energetic' | 'dark' | 'playful' | 'calm' | 'dramatic' | 'euphoric'

/**
 * Evolution stage of Selene's consciousness
 */
export type EvolutionStage = 'awakening' | 'learning' | 'wise'

/**
 * Dream simulation types
 */
export type DreamType = 
  | 'palette_change' 
  | 'intensity_shift' 
  | 'movement_change'
  | 'effect_activation' 
  | 'mood_transition' 
  | 'strike_execution'
  | 'full_scene_change'
  | null

/**
 * Dream recommendation actions
 */
export type DreamRecommendation = 'execute' | 'modify' | 'abort' | null

/**
 * Zodiac elements
 */
export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water'

/**
 * Zodiac quality
 */
export type ZodiacQuality = 'cardinal' | 'fixed' | 'mutable'

/**
 * Drop state machine status
 */
export type DropStateType = 'IDLE' | 'ATTACK' | 'SUSTAIN' | 'RELEASE' | 'COOLDOWN'

/**
 * Stable emotion from MoodArbiter
 */
export type StableEmotion = 'BRIGHT' | 'DARK' | 'NEUTRAL'

/**
 * Evolution state
 */
export interface EvolutionData {
  /** Current stage: awakening → learning → wise */
  stage: EvolutionStage
  /** Total experiences processed */
  totalExperiences: number
  /** Patterns discovered */
  patternsDiscovered: number
  /** Current generation number */
  generation: number
  /** Lineage history */
  lineage: string[]
}

/**
 * Dream Forge - What Selene is "imagining"
 */
export interface DreamData {
  /** True if currently simulating a scenario */
  isActive: boolean
  /** Current dream type being simulated */
  currentType: DreamType
  /** Human-readable description of current thought */
  currentThought: string
  /** Projected beauty score of current simulation (0-1) */
  projectedBeauty: number
  /** Last dream recommendation */
  lastRecommendation: DreamRecommendation
}

/**
 * Zodiac affinity calculated from audio frequencies
 */
export interface ZodiacData {
  /** Current dominant element */
  element: ZodiacElement
  /** Current zodiac sign resonance */
  sign: string
  /** Affinity score (0-1) */
  affinity: number
  /** Quality resonance */
  quality: ZodiacQuality
  /** Poetic description */
  description: string
}

/**
 * Beauty evaluation metrics
 */
export interface BeautyData {
  /** Current frame beauty score (0-1) */
  current: number
  /** Session average */
  average: number
  /** Session maximum */
  max: number
  /** Components breakdown */
  components: {
    fibonacciAlignment: number
    zodiacResonance: number
    musicalHarmony: number
    patternResonance: number
    historicalBonus: number
  }
}

/**
 * Vibe state
 */
export interface VibeState {
  /** Current active vibe ID or 'idle' */
  active: VibeId
  /** Is transitioning between vibes */
  transitioning: boolean
}

/**
 * Drop state machine
 */
export interface DropState {
  /** Current state: IDLE, ATTACK, SUSTAIN, RELEASE, COOLDOWN */
  state: DropStateType
  /** Is drop currently active (only SUSTAIN = true drop) */
  isActive: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 550: AI TELEMETRY - SeleneTitanConscious Brain Feed
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de caza de la gata
 */
export type AIHuntState = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

/**
 * 🎯 AI TELEMETRY - Tactical HUD Data
 * 
 * WAVE 550: Datos del cerebro de Selene para el HUD táctico.
 * Esto es lo que piensa la IA en tiempo real.
 */
export interface AITelemetry {
  /** ¿Está la consciencia activa? */
  enabled: boolean
  
  // ═══════════════════════════════════════════════════════════════════════
  // HUNT STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Estado de caza actual */
  huntState: AIHuntState
  
  /** Confianza general (0-1) - Para la barra de carga */
  confidence: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // PREDICTION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Predicción activa (ej: "DROP INCOMING - 71%") */
  prediction: string | null
  
  /** Probabilidad de la predicción (0-1) */
  predictionProbability: number
  
  /** Tiempo hasta el evento predicho (ms) */
  predictionTimeMs: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // BEAUTY METRICS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Puntuación de belleza actual (0-1) */
  beautyScore: number
  
  /** Tendencia de belleza */
  beautyTrend: 'rising' | 'falling' | 'stable'
  
  /** Consonancia con estado anterior (0-1) */
  consonance: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // DECISION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Última decisión tomada (ej: "Palette Change") */
  lastDecision: string | null
  
  /** Fuente de la decisión */
  decisionSource: string | null
  
  /** Razonamiento de la decisión (human-readable) */
  reasoning: string | null
  
  // ═══════════════════════════════════════════════════════════════════════
  // DIAGNOSTICS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Sesgos detectados */
  biasesDetected: string[]
  
  /** ¿Energy Override activo? (physics veto) */
  energyOverrideActive: boolean
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔮 WAVE 1168: DREAM SIMULATOR OUTPUT
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Último resultado del Dream Simulator */
  lastDreamResult: {
    /** Efecto que se intentó (puede ser null si no hubo candidato) */
    effectName: string | null
    /** Estado final: ACCEPTED, REJECTED, IDLE */
    status: 'ACCEPTED' | 'REJECTED' | 'IDLE'
    /** Razón del resultado (ej: "TEXTURE REJECT - context too warm") */
    reason: string
    /** Nivel de riesgo del efecto (0-1) */
    riskLevel: number
  }
  
  /** Flags éticos activos (los que están en warning/limiting) */
  ethicsFlags: string[]
  
  /** Zona de energía actual */
  energyZone: 'calm' | 'rising' | 'peak' | 'falling'
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎲 WAVE 1168: FUZZY DECISION DEBUG
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Acción del sistema fuzzy */
  fuzzyAction: 'force_strike' | 'strike' | 'prepare' | 'hold' | null
  
  /** Z-Score de energía (desviación estándar) */
  zScore: number
  
  /** Alerta del Drop Bridge */
  dropBridgeAlert: 'none' | 'watching' | 'imminent' | 'activated'
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 1176: OPERATION SNIPER - Raw velocity for UI debugging
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Velocidad de energía cruda (slope) para debug en UI */
  energyVelocity: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 1195: BACKEND TELEMETRY EXPANSION
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Hunt session statistics */
  huntStats: {
    /** Seconds in current hunt state */
    duration: number
    /** Total targets processed this session */
    targetsAcquired: number
    /** Success rate (0-1) */
    successRate: number
  }
  
  /** Individual council votes (for EthicsCouncilExpanded) */
  councilVotes: {
    beauty: {
      vote: 'for' | 'against' | 'abstain'
      confidence: number
      reason: string
    }
    energy: {
      vote: 'for' | 'against' | 'abstain'
      confidence: number
      reason: string
    }
    calm: {
      vote: 'for' | 'against' | 'abstain'
      confidence: number
      reason: string
    }
  }
  
  /** Consensus score of the council (0-1) */
  consensusScore: number
  
  /** Dream history queue (last 5) */
  dreamHistory: Array<{
    name: string
    score: number
    timestamp: number
    reason: string
  }>
  
  /** Prediction history for sparkline (last 60 values) */
  predictionHistory: number[]
}

/**
 * 🧠 COGNITIVE DATA - Selene's Consciousness
 * 
 * Full personality and consciousness state.
 * This is what makes Selene "alive".
 */
export interface CognitiveData {
  /** Current emotional mood */
  mood: SeleneMood
  
  /** Consciousness level (0-1, evolves over time) */
  consciousnessLevel: number
  
  /** Evolution state */
  evolution: EvolutionData
  
  /** Dream Forge - What Selene is "imagining" */
  dream: DreamData
  
  /** Zodiac affinity calculated from audio frequencies */
  zodiac: ZodiacData
  
  /** Beauty evaluation metrics */
  beauty: BeautyData
  
  /** Last insight or thought as string */
  lastInsight: string

  /** Active data sources influencing current mood/behavior */
  activeSources: string[]
  
  /** Active Vibe Context */
  vibe: VibeState
  
  /** Stabilized Emotion from MoodArbiter */
  stableEmotion: StableEmotion
  
  /** Thermal Temperature in Kelvin (2000K-10000K) */
  thermalTemperature: number
  
  /** Drop State Machine Status */
  dropState: DropState
  
  /** 🧠 WAVE 550: AI Telemetry from SeleneTitanConscious */
  ai?: AITelemetry
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. VISUAL LAYER - Colors & Movement (from V1, simplified)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified color with all representations
 * NO MORE HSL/RGB CONFUSION - Both are always available
 */
export interface UnifiedColor {
  /** Hue (0-360) */
  h: number
  /** Saturation (0-100) */
  s: number
  /** Lightness (0-100) */
  l: number
  /** Red (0-255) */
  r: number
  /** Green (0-255) */
  g: number
  /** Blue (0-255) */
  b: number
  /** Hex string (#RRGGBB) */
  hex: string
}

/**
 * Visual effects state
 */
export interface EffectsState {
  /** Strobe effect */
  strobe: {
    active: boolean
    rate: number
    intensity: number
  }
  /** Fog/haze machine */
  fog: {
    active: boolean
    density: number
  }
  /** Blackout state */
  blackout: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. UI ↔ BACKEND (IPC)
// ═══════════════════════════════════════════════════════════════════════════

import type { MusicalContext } from './MusicalContext'
import type { LightingIntent } from './LightingIntent'

/**
 * Estado de un fixture para el frontend
 * 
 * WAVE 339: Extended with optics (zoom/focus) and physics (interpolated positions)
 */
export interface FixtureState {
  /** ID único del fixture */
  id: string
  /** Nombre del fixture */
  name: string
  /** Tipo de fixture */
  type: string
  /** Zona asignada */
  zone: string
  /** Dirección DMX */
  dmxAddress: number
  /** Universo DMX */
  universe: number
  /** Intensidad actual (0-255) */
  dimmer: number
  /** Intensity alias (for legacy compatibility) */
  intensity: number
  /** RGB actual */
  color: { r: number; g: number; b: number }
  /** Pan actual (0-255) - TARGET position */
  pan: number
  /** Tilt actual (0-255) - TARGET position */
  tilt: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔍 WAVE 339: OPTICS (Zoom/Focus)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Zoom DMX value (0-255): 0=Beam (tight), 255=Wash (wide) */
  zoom?: number
  /** Focus DMX value (0-255): 0=Sharp, 255=Soft/Nebula */
  focus?: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎛️ WAVE 339: PHYSICS (Interpolated positions from FixturePhysicsDriver)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Physical Pan (0-255) - INTERPOLATED by physics engine (shows actual position) */
  physicalPan?: number
  /** Physical Tilt (0-255) - INTERPOLATED by physics engine (shows actual position) */
  physicalTilt?: number
  /** Current velocity for pan axis (DMX/s) */
  panVelocity?: number
  /** Current velocity for tilt axis (DMX/s) */
  tiltVelocity?: number
  
  /** ¿Está online/conectado? */
  online: boolean
  /** ¿Está activo? */
  active: boolean
  
  // 🔥 WAVE 2084.2: PHANTOM UI — Profile ID for fixture definition lookup
  /** Reference to fixture profile in library (for channel definition queries) */
  profileId?: string
}

/**
 * Hardware and DMX state
 */
export interface HardwareState {
  /** Estado DMX */
  dmx: {
    /** ¿Hay conexión DMX activa? */
    connected: boolean
    /** Driver DMX activo */
    driver: 'usb' | 'artnet' | 'none'
    /** Universo DMX */
    universe: number
    /** Frame rate DMX */
    frameRate: number
    /** Puerto/IP del dispositivo DMX */
    port: string | null
  }
  /** Raw DMX output (512 channels) */
  dmxOutput: number[]
  /** Number of active fixtures */
  fixturesActive: number
  /** Total patched fixtures */
  fixturesTotal: number
  /** Estado de los fixtures */
  fixtures: FixtureState[]
}

/**
 * System performance and status
 */
export interface SystemState {
  /** Frame number since start */
  frameNumber: number
  /** Timestamp of this truth (ms since epoch) */
  timestamp: number
  /** Delta time since last frame (ms) */
  deltaTime: number
  /** Target frames per second */
  targetFPS: number
  /** Actual frames per second */
  actualFPS: number
  /** Current operation mode */
  mode: SeleneMode
  /** Current vibe */
  vibe: VibeId
  /** Brain status (current mood) */
  brainStatus: SeleneMood
  /** Session uptime (seconds) */
  uptime: number
  /** TITAN enabled */
  titanEnabled: boolean
  /** Session ID */
  sessionId: string
  /** Version info */
  version: string
  /** Performance metrics */
  performance: {
    /** Processing time for audio analysis (ms) */
    audioProcessingMs: number
    /** Processing time for brain (ms) */
    brainProcessingMs: number
    /** Processing time for color engine (ms) */
    colorEngineMs: number
    /** DMX output time (ms) */
    dmxOutputMs: number
    /** Total frame time (ms) */
    totalFrameMs: number
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SELENE TRUTH - THE UNIVERSAL TRUTH (WAVE 248 ENRICHED)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📡 SELENE TRUTH - THE FUSION
 * 
 * La "Verdad Única" del sistema que se envía al Frontend @ 30fps.
 * Contiene todo el estado necesario para renderizar la UI.
 * 
 * WAVE 248: Ahora incluye toda la riqueza cognitiva y sensorial.
 * 
 * Canal IPC: 'selene:truth'
 * 
 * @example
 * ```typescript
 * // Backend (main process)
 * const truth: SeleneTruth = orchestrator.getTruth();
 * mainWindow.webContents.send('selene:truth', truth);
 * 
 * // Frontend (renderer)
 * useEffect(() => {
 *   const unsubscribe = window.lux.onTruthUpdate((data: SeleneTruth) => {
 *     setTruth(data); // That's it. Render this.
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export interface SeleneTruth {
  // ═══════════════════════════════════════════════════════════════════════
  // SISTEMA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Estado del sistema (mode, fps, uptime, performance) */
  system: SystemState

  // ═══════════════════════════════════════════════════════════════════════
  // SENSORIAL (Audio Crudo)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Raw sensory input from audio capture */
  sensory: SensoryData

  // ═══════════════════════════════════════════════════════════════════════
  // CONSCIENCIA (Personalidad de Selene)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Consciousness, personality, dreams, evolution */
  consciousness: CognitiveData

  // ═══════════════════════════════════════════════════════════════════════
  // CONTEXTO MUSICAL (del Brain)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Musical context (genre, section, rhythm) */
  context: MusicalContext

  // ═══════════════════════════════════════════════════════════════════════
  // INTENT DE ILUMINACIÓN (del Engine)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Lighting intent (palette, zones, movement, effects) */
  intent: LightingIntent

  // ═══════════════════════════════════════════════════════════════════════
  // HARDWARE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Hardware state (DMX, fixtures) */
  hardware: HardwareState

  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Timestamp de esta verdad */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// COMANDOS (Frontend → Backend)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipos de comandos que el Frontend puede enviar
 */
export type SeleneCommandType = 
  | 'setMode'
  | 'setVibe'
  | 'setManualColor'
  | 'setManualIntensity'
  | 'triggerEffect'
  | 'blackout'
  | 'panic'

/**
 * 🎮 SELENE COMMAND
 * 
 * Comandos que el Frontend envía al Backend.
 * 
 * Canal IPC: 'selene:command'
 */
export interface SeleneCommand {
  /** Tipo de comando */
  type: SeleneCommandType
  /** Payload del comando (varía según el tipo) */
  payload: unknown
  /** Timestamp del comando */
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CANALES IPC DEFINIDOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Definición de canales IPC oficiales de TITAN
 */
export const TITAN_IPC_CHANNELS = {
  /** Backend → Frontend: Estado completo @ 30fps */
  TRUTH: 'selene:truth',
  
  /** Frontend → Backend: Comandos de usuario */
  COMMAND: 'selene:command',
  
  /** Bidireccional: Configuración */
  CONFIG: 'selene:config',
  
  /** Backend → Frontend: Estado de fixtures */
  FIXTURES: 'selene:fixtures',
  
  /** Backend → Frontend: Logs del sistema */
  LOGS: 'selene:logs',
} as const

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica si un objeto es un MusicalContext válido
 */
export function isMusicalContext(obj: unknown): obj is MusicalContext {
  if (!obj || typeof obj !== 'object') return false
  const ctx = obj as MusicalContext
  return (
    typeof ctx.bpm === 'number' &&
    typeof ctx.energy === 'number' &&
    typeof ctx.confidence === 'number' &&
    typeof ctx.timestamp === 'number'
  )
}

/**
 * Verifica si un objeto es un LightingIntent válido
 */
export function isLightingIntent(obj: unknown): obj is LightingIntent {
  if (!obj || typeof obj !== 'object') return false
  const intent = obj as LightingIntent
  return (
    intent.palette !== undefined &&
    typeof intent.masterIntensity === 'number' &&
    typeof intent.timestamp === 'number'
  )
}

/**
 * Verifica si un objeto es un SeleneTruth válido
 */
export function isSeleneTruth(obj: unknown): obj is SeleneTruth {
  if (!obj || typeof obj !== 'object') return false
  const truth = obj as Record<string, unknown>
  return (
    'system' in truth &&
    'sensory' in truth &&
    'consciousness' in truth &&
    'context' in truth &&
    'intent' in truth &&
    'hardware' in truth &&
    'timestamp' in truth
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. DEFAULT FACTORIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create default UnifiedColor
 */
export function createDefaultColor(): UnifiedColor {
  return { h: 0, s: 0, l: 50, r: 128, g: 128, b: 128, hex: '#808080' }
}

/**
 * Create default SensoryData
 */
export function createDefaultSensory(): SensoryData {
  return {
    audio: {
      energy: 0, peak: 0, average: 0, bass: 0, mid: 0, high: 0,
      spectralCentroid: 0, spectralFlux: 0, zeroCrossingRate: 0
    },
    fft: new Array(256).fill(0),
    beat: { onBeat: false, confidence: 0, bpm: 120, beatPhase: 0, barPhase: 0, timeSinceLastBeat: 0 },
    input: { gain: 1, device: 'None', active: false, isClipping: false },
    // 🧠 WAVE 1195: GOD EAR SPECTRUM BANDS
    spectrumBands: {
      subBass: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
      ultraAir: 0,
      dominant: 'mid',
      flux: 0
    }
  }
}

/**
 * Create default CognitiveData
 */
export function createDefaultCognitive(): CognitiveData {
  return {
    mood: 'peaceful',
    consciousnessLevel: 0,
    evolution: { stage: 'awakening', totalExperiences: 0, patternsDiscovered: 0, generation: 1, lineage: ['Genesis'] },
    dream: { isActive: false, currentType: null, currentThought: 'Selene awakening...', projectedBeauty: 0, lastRecommendation: null },
    zodiac: { element: 'water', sign: 'Pisces', affinity: 0.5, quality: 'mutable', description: 'The dreaming mystic' },
    beauty: { current: 0.5, average: 0.5, max: 0.5, components: { fibonacciAlignment: 0, zodiacResonance: 0, musicalHarmony: 0, patternResonance: 0, historicalBonus: 0 } },
    lastInsight: 'Selene Lux awakening...',
    activeSources: [],
    vibe: { active: 'idle', transitioning: false },
    stableEmotion: 'NEUTRAL',
    thermalTemperature: 4500,
    dropState: { state: 'IDLE', isActive: false },
    // 🧠 WAVE 550: AI Telemetry defaults
    // 🔮 WAVE 1168: Expanded with Dream Simulator output
    // 🧠 WAVE 1195: Expanded with hunt stats, council votes, dream history
    ai: {
      enabled: false,
      huntState: 'sleeping',
      confidence: 0,
      prediction: null,
      predictionProbability: 0,
      predictionTimeMs: 0,
      beautyScore: 0.5,
      beautyTrend: 'stable',
      consonance: 1,
      lastDecision: null,
      decisionSource: null,
      reasoning: null,
      biasesDetected: [],
      energyOverrideActive: false,
      // 🔮 WAVE 1168: Dream Simulator output
      lastDreamResult: {
        effectName: null,
        status: 'IDLE',
        reason: 'No simulation yet',
        riskLevel: 0
      },
      ethicsFlags: [],
      energyZone: 'calm',
      // 🎲 WAVE 1168: Fuzzy Decision debug
      fuzzyAction: null,
      zScore: 0,
      dropBridgeAlert: 'none',
      // 🔥 WAVE 1176: OPERATION SNIPER
      energyVelocity: 0,
      // 🧠 WAVE 1195: BACKEND TELEMETRY EXPANSION
      huntStats: {
        duration: 0,
        targetsAcquired: 0,
        successRate: 0
      },
      councilVotes: {
        beauty: { vote: 'abstain', confidence: 0, reason: 'Waiting for beauty signal' },
        energy: { vote: 'abstain', confidence: 0, reason: 'Analyzing energy levels' },
        calm: { vote: 'abstain', confidence: 0, reason: 'Assessing stability' }
      },
      consensusScore: 0.33,
      dreamHistory: [],
      predictionHistory: []
    }
  }
}

/**
 * Create default SystemState
 */
export function createDefaultSystem(): SystemState {
  return {
    frameNumber: 0,
    timestamp: Date.now(),
    deltaTime: 0,
    targetFPS: 30,
    actualFPS: 0,
    mode: 'selene',
    vibe: 'idle',
    brainStatus: 'peaceful',
    uptime: 0,
    titanEnabled: true,
    sessionId: '',
    version: '2.0.0',
    performance: {
      audioProcessingMs: 0,
      brainProcessingMs: 0,
      colorEngineMs: 0,
      dmxOutputMs: 0,
      totalFrameMs: 0
    }
  }
}

/**
 * Create default HardwareState
 */
export function createDefaultHardware(): HardwareState {
  return {
    dmx: {
      connected: false,
      driver: 'none',
      universe: 0,  // 🔥 WAVE 1219: ArtNet 0-indexed
      frameRate: 40,
      port: null
    },
    dmxOutput: new Array(512).fill(0),
    fixturesActive: 0,
    fixturesTotal: 0,
    fixtures: []
  }
}

/**
 * 🌙 Create default SeleneTruth
 * 
 * Creates a fully initialized SeleneTruth object with safe defaults.
 * Use this for initialization before receiving real data from backend.
 */
export function createDefaultTruth(): SeleneTruth {
  // Import default palette from LightingIntent if available, otherwise create inline
  const defaultPalette = {
    primary: { h: 0, s: 0, l: 0.5 },
    secondary: { h: 0.5, s: 0, l: 0.5 },
    accent: { h: 0.25, s: 0, l: 0.5 },
    ambient: { h: 0.75, s: 0, l: 0.3 }
  }

  const defaultIntent = {
    palette: defaultPalette,
    masterIntensity: 1,
    zones: {},
    movement: {
      pattern: 'static' as const,
      speed: 0,
      amplitude: 0,
      centerX: 0.5,
      centerY: 0.5,
      beatSync: false
    },
    effects: [],
    source: 'procedural' as const,
    timestamp: Date.now()
  }

  const defaultContext = {
    key: null,
    mode: 'unknown' as const,
    bpm: 120,
    beatPhase: 0,
    syncopation: 0,
    section: { type: 'unknown' as const, current: 'unknown' as const, confidence: 0, duration: 0, isTransition: false },
    energy: 0,
    mood: 'neutral' as const,
    genre: { macro: 'UNKNOWN' as const, subGenre: null, confidence: 0 },
    confidence: 0,
    timestamp: Date.now()
  }

  return {
    system: createDefaultSystem(),
    sensory: createDefaultSensory(),
    consciousness: createDefaultCognitive(),
    context: defaultContext,
    intent: defaultIntent,
    hardware: createDefaultHardware(),
    timestamp: Date.now()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY (WAVE 248)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use SeleneTruth instead
 * Alias for backward compatibility during migration
 */
export type SeleneBroadcast = SeleneTruth

/**
 * @deprecated Use createDefaultTruth instead
 */
export const createDefaultBroadcast = createDefaultTruth

/**
 * @deprecated Use isSeleneTruth instead
 */
export const isSeleneBroadcast = isSeleneTruth
