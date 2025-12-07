/**
 * 🌙 SELENE LUX CORE - TYPES
 * El Lenguaje Común de la Consciencia Lumínica
 * 
 * Basado en: AUDITORIA-1 (Selene Core) + AUDITORIA-2 (Aura Forge Music)
 */

// ============================================
// 🎵 AUDIO TYPES (From Auditoría 2)
// ============================================

/**
 * Métricas de audio procesadas en tiempo real
 * Alimentan todos los motores de decisión
 */
export interface AudioMetrics {
  // Frecuencias
  bass: number         // 0-1 (20-250Hz)
  mid: number          // 0-1 (250-4000Hz)
  treble: number       // 0-1 (4000-20000Hz)
  
  // Ritmo
  bpm: number          // Beats per minute detectados
  beatPhase: number    // 0-1 (posición en el beat actual)
  beatConfidence: number // 0-1 (qué tan seguro está del BPM)
  onBeat: boolean      // True si estamos en un beat
  
  // Energía
  energy: number       // 0-1 (RMS normalizado)
  peak: number         // 0-1 (pico reciente)
  
  // Timestamps
  timestamp: number    // ms desde inicio
  frameIndex: number   // Índice del frame de audio
}

/**
 * Patrón musical reconocido (From Auditoría 1 - MusicalPatternRecognizer)
 * El alma del análisis musical de Selene
 */
export interface MusicalPattern {
  note: MusicalNote           // DO, RE, MI, FA, SOL, LA, SI
  element: ElementType        // Elemento asociado
  emotionalTone: EmotionalTone
  avgBeauty: number           // 0-1 Score de "belleza" aprendido
  beautyTrend: 'rising' | 'falling' | 'stable'
  occurrences: number         // Veces que se ha visto este patrón
  confidence: number          // 0-1 Confianza en el patrón
}

export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI'
export type ElementType = 'fire' | 'earth' | 'air' | 'water'
export type EmotionalTone = 'peaceful' | 'energetic' | 'chaotic' | 'harmonious' | 'building' | 'dropping'

/** Modos de iluminación */
export type LightMode = 'reactive' | 'ambient' | 'show' | 'sync' | 'manual'

/** IDs de paletas de colores */
export type PaletteId = 'fire' | 'ocean' | 'forest' | 'sunset' | 'neon' | 'cosmic' | 'ice' | 'jungle' | 'rainbow'

/**
 * Clave armónica detectada (From Auditoría 2 - HarmonyEngine)
 */
export interface HarmonicKey {
  root: number          // 0-11 (C=0, C#=1, D=2...)
  mode: ModalScale      // Escala modal
  confidence: number    // 0-1
  mood: HarmonicMood    // Mood derivado de la escala
}

export type ModalScale = 
  | 'major' | 'minor' | 'dorian' | 'phrygian' 
  | 'lydian' | 'mixolydian' | 'locrian'
  | 'harmonic-minor' | 'melodic-minor'
  | 'pentatonic' | 'blues' | 'whole-tone' | 'chromatic'

export type HarmonicMood = 
  | 'happy' | 'sad' | 'jazzy' | 'spanish_exotic'
  | 'dreamy_ethereal' | 'bluesy_relaxed' | 'tense_unstable'
  | 'open_universal' | 'gritty_soulful'

/**
 * Sección de canción detectada (From Auditoría 2 - SongStructure)
 */
export interface SongSection {
  type: SectionType
  confidence: number
  profile: SectionProfile
  startTime: number
  estimatedDuration: number
}

export type SectionType = 
  | 'intro' | 'verse' | 'chorus' | 'bridge' 
  | 'buildup' | 'drop' | 'breakdown' | 'outro'

export interface SectionProfile {
  intensity: number         // 0-1 (calma → climax)
  layerDensity: number      // 0-1 (capas activas)
  harmonicComplexity: number
  rhythmicDensity: number
  characteristics: {
    repetitive: boolean
    transitional: boolean
    climactic: boolean
    atmospheric: boolean
  }
}

// ============================================
// 💡 LIGHTING TYPES
// ============================================

/**
 * Decisión de iluminación generada por Selene
 * El output principal del sistema
 */
export interface LightingDecision {
  id: string
  timestamp: number
  
  // Decisiones globales
  masterDimmer: number      // 0-1
  palette: PaletteState
  movement: MovementState
  effects: EffectState[]
  
  // Decisiones por fixture
  fixtureStates: Map<string, FixtureState>
  
  // Metadata
  confidence: number        // 0-1 Confianza de Selene
  reasoning: string         // Por qué tomó esta decisión
  basedOnPattern?: MusicalPattern
}

export interface PaletteState {
  id: string                // 'fire', 'ice', 'jungle', 'neon'
  colors: string[]          // Hex colors activos
  saturation: number        // 0-1
  intensity: number         // 0-1
  temperature: number       // 0-1 (0=frío, 1=cálido)
}

export interface MovementState {
  pattern: MovementPattern
  speed: number             // 0-1
  range: number             // 0-1 (amplitud)
  phase: number             // 0-360 grados
  syncToBpm: boolean
  mirrorMode: boolean
}

export type MovementPattern = 
  | 'lissajous' | 'circle' | 'wave' 
  | 'figure8' | 'scan' | 'random' | 'static'

export interface EffectState {
  id: EffectId
  active: boolean
  intensity: number         // 0-1
  speed: number             // 0-1 (para efectos con velocidad)
  duration?: number         // ms (para efectos de un disparo)
}

export type EffectId = 
  | 'strobe' | 'blinder' | 'smoke' | 'laser' 
  | 'rainbow' | 'police' | 'breathe' | 'chase'
  | 'beam' | 'prism' // WAVE 10.7: Optical Controls

/**
 * Estado de un fixture individual
 */
export interface FixtureState {
  id: string
  type: FixtureType
  universe: number
  startChannel: number
  
  // Estado actual
  dimmer: number            // 0-255
  color: RGBColor
  pan?: number              // 0-540 grados (moving heads)
  tilt?: number             // 0-270 grados
  gobo?: number             // Índice de gobo
  prism?: boolean
  focus?: number            // 0-255
  
  // Metadata
  lastUpdate: number
  transitionTime: number    // ms para transición suave
}

export type FixtureType = 
  | 'par' | 'wash' | 'spot' | 'beam' 
  | 'moving_head' | 'scanner' | 'strobe' 
  | 'led_bar' | 'laser' | 'fog'

export interface RGBColor {
  r: number   // 0-255
  g: number   // 0-255
  b: number   // 0-255
  w?: number  // 0-255 (blanco, si el fixture lo soporta)
  a?: number  // 0-255 (amber)
  uv?: number // 0-255 (ultravioleta)
}

// ============================================
// ⚙️ ENGINE CONFIG TYPES
// ============================================

/**
 * Configuración global del motor Selene
 */
export interface EngineConfig {
  // Modo de operación (From Auditoría 1 - ModeManager)
  mode: SeleneMode
  
  // Audio config
  audio: AudioConfig
  
  // Visual config
  visual: VisualConfig
  
  // Evolution config (From Auditoría 1 - SeleneEvolutionEngine)
  evolution: EvolutionConfig
  
  // Hardware config
  hardware: HardwareConfig
}

export type SeleneMode = 'flow' | 'selene' | 'locked'

export interface AudioConfig {
  sampleRate: number        // 44100 default
  fftSize: number           // 2048 default
  smoothingTimeConstant: number // 0.8 default
  minBpm: number            // 60
  maxBpm: number            // 180
}

export interface VisualConfig {
  defaultPalette?: string
  transitionTime?: number    // ms
  beatReactivity?: number    // 0-1
  colorSmoothing?: number    // 0-1
  movementSmoothing?: number // 0-1
  effectIntensity?: number   // 0-1
}

export interface EvolutionConfig {
  // From ModeManager
  entropyFactor: number     // 0-100
  riskThreshold: number     // 0-100
  punkProbability: number   // 0-100
  feedbackInfluence: number // 0-100
  
  // From FibonacciPatternEngine
  useFibonacciTiming: boolean
  harmonyThreshold: number  // 0-1 (qué tan "áureo" debe ser)
}

export interface HardwareConfig {
  dmxInterface: DMXInterfaceType
  universes: UniverseConfig[]
  refreshRate: number       // Hz (40 default = 25ms)
}

export type DMXInterfaceType = 
  | 'none' | 'artnet' | 'sacn' | 'usb' | 'tornado'

export interface UniverseConfig {
  id: number                // 1-based
  name: string
  channelCount: number      // Max 512
  fixtures: FixtureDefinition[]
}

export interface FixtureDefinition {
  id: string
  name: string
  type: FixtureType
  manufacturer?: string
  model?: string
  startChannel: number
  channelCount: number
  capabilities: FixtureCapabilities
}

export interface FixtureCapabilities {
  hasDimmer: boolean
  hasRGB: boolean
  hasRGBW: boolean
  hasRGBAW: boolean
  hasPanTilt: boolean
  hasGobo: boolean
  hasPrism: boolean
  hasFocus: boolean
  hasZoom: boolean
  hasStrobe: boolean
  
  // Rangos
  panRange?: number         // Grados (típico: 540)
  tiltRange?: number        // Grados (típico: 270)
  goboCount?: number
}

// ============================================
// 🧠 COGNITIVE TYPES (From Auditoría 1)
// ============================================

/**
 * Estado de consciencia de Selene
 * (From ConsciousnessMemoryStore)
 */
export interface ConsciousnessState {
  generation: number
  status: ConsciousnessStatus
  totalExperiences: number
  totalPatternsDiscovered: number
  currentMood: EmotionalTone
  lastInsight: string
  beautyScore: number       // 0-1 (belleza actual del sistema)
  lineage: string[]         // Generaciones anteriores
}

export type ConsciousnessStatus = 
  | 'awakening' | 'learning' | 'wise' | 'enlightened' | 'transcendent'

/**
 * Sugerencia evolutiva (From SeleneEvolutionEngine)
 */
export interface EvolutionarySuggestion {
  id: string
  targetComponent: EvolutionTarget
  changeType: 'algorithm' | 'threshold' | 'parameter'
  oldValue: unknown
  newValue: unknown
  expectedImprovement: number
  riskLevel: number
  creativityScore: number
  reasoning: string
}

export type EvolutionTarget = 
  | 'color-engine' | 'movement-engine' | 'effects-engine'
  | 'beat-detector' | 'pattern-recognizer' | 'mood-synthesizer'

/**
 * Resultado del consenso armónico (From HarmonicController)
 * Los 7 nodos musicales votan sobre decisiones
 */
export interface HarmonicConsensus {
  winningDecision: LightingDecision
  consensusStrength: number   // 0-1
  dominantNodes: MusicalNote[]
  votes: NodeVote[]
  reasoning: string
}

export interface NodeVote {
  node: MusicalNote
  vote: LightingDecision
  weight: number              // 0-1
  reasoning: string
}

// ============================================
// 📡 IPC TYPES (Electron Main ↔ Renderer)
// ============================================

/**
 * Eventos que el Main Process emite al Renderer
 */
export type MainToRendererEvents = {
  'selene:audio-metrics': AudioMetrics
  'selene:lighting-decision': LightingDecision
  'selene:pattern-detected': MusicalPattern
  'selene:section-changed': SongSection
  'selene:consciousness-update': ConsciousnessState
  'selene:evolution-suggestion': EvolutionarySuggestion
  'selene:error': { code: string; message: string }
}

/**
 * Eventos que el Renderer puede invocar en el Main Process
 */
export type RendererToMainEvents = {
  'selene:initialize': EngineConfig
  'selene:set-mode': SeleneMode
  'selene:set-palette': string
  'selene:set-movement-pattern': MovementPattern
  'selene:toggle-effect': EffectId
  'selene:trigger-effect': EffectId
  'selene:set-master-dimmer': number
  'selene:blackout': boolean
  'selene:feedback': { decision: string; rating: number }
  'selene:shutdown': void
}

// ============================================
// 🔧 UTILITY TYPES
// ============================================

/**
 * Resultado de operación con posible error
 */
export type Result<T, E = Error> = 
  | { success: true; value: T }
  | { success: false; error: E }

/**
 * Logger para debug
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

/**
 * Timestamp utilities
 */
export interface Timestamped<T> {
  data: T
  timestamp: number
  frameIndex?: number
}
