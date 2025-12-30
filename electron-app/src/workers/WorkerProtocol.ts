/**
 * 🔗 WORKER PROTOCOL - Protocolo de Comunicación Trinity
 * 
 * Define los tipos de mensajes entre:
 * - ALPHA (Main Process): Orquestador + DMX
 * - BETA (Worker): Sentidos (Audio Analysis)
 * - GAMMA (Worker): Mente (Selene Brain)
 */

// ============================================
// NODE IDENTIFIERS
// ============================================

export type NodeId = 'alpha' | 'beta' | 'gamma';

export const NODE_NAMES: Record<NodeId, string> = {
  alpha: '🛡️ ALPHA (Orchestrator)',
  beta: '👂 BETA (Senses)',
  gamma: '🧠 GAMMA (Mind)'
};

// ============================================
// MESSAGE TYPES
// ============================================

export enum MessageType {
  // Lifecycle
  INIT = 'init',
  READY = 'ready',
  SHUTDOWN = 'shutdown',
  
  // Heartbeat
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_ACK = 'heartbeat_ack',
  
  // Health
  HEALTH_REPORT = 'health_report',
  HEALTH_REQUEST = 'health_request',
  
  // Audio Pipeline (Alpha → Beta)
  AUDIO_BUFFER = 'audio_buffer',
  
  // Analysis Pipeline (Beta → Alpha → Gamma)
  AUDIO_ANALYSIS = 'audio_analysis',
  
  // Lighting Pipeline (Gamma → Alpha → DMX)
  LIGHTING_DECISION = 'lighting_decision',
  
  // State Management
  STATE_SNAPSHOT = 'state_snapshot',
  STATE_RESTORE = 'state_restore',
  
  // Phoenix Protocol
  WORKER_ERROR = 'worker_error',
  WORKER_RESURRECTING = 'worker_resurrecting',
  
  // Config
  CONFIG_UPDATE = 'config_update',
  
  // 🧠 WAVE 10: Brain Control
  SET_MODE = 'set_mode',          // Enable/disable brain
  ENABLE_BRAIN = 'enable_brain',  // Full brain activation
  DISABLE_BRAIN = 'disable_brain', // Fallback to reactive
  
  // 🎛️ WAVE 60: Vibe Control
  SET_VIBE = 'set_vibe',          // Change active Vibe profile
  
  // 🔌 WAVE 63.95: System Power Control
  SYSTEM_SLEEP = 'system_sleep',  // Pause processing, reset state
  SYSTEM_WAKE = 'system_wake',    // Resume processing
  
  // 🧠 WAVE 230: Musical Context (Brain Lobotomy)
  // El Worker ahora emite contexto puro, sin decidir colores
  MUSICAL_CONTEXT = 'musical_context'
}

export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

// ============================================
// BASE MESSAGE STRUCTURE
// ============================================

export interface WorkerMessage<T = unknown> {
  id: string;
  type: MessageType;
  source: NodeId;
  target: NodeId | 'broadcast';
  timestamp: number;
  priority: MessagePriority;
  payload: T;
}

// ============================================
// AUDIO ANALYSIS (Beta Output)
// ============================================

export interface AudioAnalysis {
  // Timing
  timestamp: number;
  frameId: number;
  
  // Beat Detection
  bpm: number;
  bpmConfidence: number;      // 0-1
  onBeat: boolean;
  beatPhase: number;          // 0-1 (position in beat cycle)
  beatStrength: number;       // 0-1
  
  // Rhythm
  syncopation: number;        // 0-1 (off-beat emphasis)
  groove: number;             // 0-1 (rhythmic feel)
  subdivision: 4 | 8 | 16;    // Detected subdivision
  
  // Spectrum
  bass: number;               // 0-1
  mid: number;                // 0-1
  treble: number;             // 0-1
  
  // Harmony (optional, more CPU intensive)
  key?: string;               // e.g., "C minor"
  mood?: 'dark' | 'bright' | 'neutral';
  energy: number;             // 0-1 overall energy level
  
  // Raw metrics for Gamma
  spectralCentroid: number;
  spectralFlux: number;
  zeroCrossingRate: number;
}

// ============================================
// LIGHTING DECISION (Gamma Output)
// ============================================

export interface LightingDecision {
  // Timing
  timestamp: number;
  frameId: number;
  decisionId: string;
  
  // Source info
  confidence: number;         // 0-1 how confident Selene is
  beautyScore: number;        // 0-1 estimated aesthetic value
  source: 'memory' | 'procedural' | 'fallback';
  
  // Palette
  palette: {
    primary: RGBColor;
    secondary: RGBColor;
    accent: RGBColor;
    intensity: number;        // 0-1 global brightness multiplier
  };
  
  // Movement
  movement: {
    pattern: MovementPattern;
    speed: number;            // 0-1
    range: number;            // 0-1
    sync: 'beat' | 'phrase' | 'free';
  };
  
  // Effects
  effects: {
    strobe: boolean;
    strobeRate?: number;      // Hz
    fog: number;              // 0-1
    laser: boolean;
  };
  
  // 🎨 WAVE 17.2: Debug info from SeleneColorEngine
  // 🔥 WAVE 23.1: Exponer source real (sin histéresis)
  // 🌊 WAVE 23.4: Syncopation suavizado para DNA
  // 💫 WAVE 47.1: MOOD & SECTION - Conectar MoodSynthesizer y SectionTracker
  // 🎢 WAVE 57.5: DROP STATE MACHINE
  // 🎚️ WAVE 94.2: AGC normalized audio para Relative Gates
  debugInfo?: {
    macroGenre?: string;       // e.g., "ELECTRONIC_4X4"
    strategy?: string;         // e.g., "analogous", "complementary"
    temperature?: string;      // e.g., "warm", "cool", "neutral"
    description?: string;      // e.g., "Azul profundo hipnótico (Techno A minor)"
    key?: string | null;       // e.g., "A", "D#"
    mode?: string;             // e.g., "major", "minor"
    source?: 'memory' | 'procedural' | 'fallback';  // 🔥 LA VERDAD CRUDA
    syncopation?: number;      // 🌊 WAVE 23.4: Syncopation suavizado (EMA filter)
    mood?: any;                // 💫 WAVE 47.1: MoodSynthesizer output (VAD: valence, arousal, dominance)
    sectionDetail?: any;       // 💫 WAVE 47.1: SectionTracker output completo (type, energy, confidence)
    drop?: {                   // 🎢 WAVE 57.5: DROP STATE MACHINE output
      isDropActive?: boolean;
      dropState?: any;
    };
    // 🎛️ WAVE 60: Vibe Engine output
    activeVibe?: string;
    vibeTransitioning?: boolean;
    // 🎚️ WAVE 94.2: AGC normalized audio para Relative Gates en fixtures
    agc?: {
      normalizedBass: number;
      normalizedMid: number;
      normalizedTreble: number;
      normalizedEnergy: number;
      avgNormEnergy: number;
      gainFactor: number;
    };
  };
  
  // Per-fixture overrides (optional)
  fixtureOverrides?: Map<number, FixtureOverride>;
}

export interface RGBColor {
  r: number;  // 0-255
  g: number;
  b: number;
}

export type MovementPattern = 
  | 'static'
  | 'sweep'
  | 'circle'
  | 'figure8'
  | 'random'
  | 'mirror'
  | 'chase';

export interface FixtureOverride {
  fixtureId: number;
  color?: RGBColor;
  intensity?: number;
  pan?: number;
  tilt?: number;
}

// ============================================
// HEALTH METRICS
// ============================================

export interface WorkerHealth {
  nodeId: NodeId;
  timestamp: number;
  
  // Performance
  cpuUsage: number;           // 0-1
  memoryUsage: number;        // 0-1
  heapUsed: number;           // bytes
  heapTotal: number;          // bytes
  
  // Throughput
  messagesProcessed: number;
  messagesPerSecond: number;
  avgProcessingTime: number;  // ms
  
  // Status
  status: 'healthy' | 'degraded' | 'critical' | 'dead';
  lastError?: string;
  uptime: number;             // ms
  
  // Specific metrics
  framesProcessed?: number;   // For Beta
  decisionsGenerated?: number; // For Gamma
}

// ============================================
// HEARTBEAT
// ============================================

export interface HeartbeatPayload {
  timestamp: number;
  sequence: number;
}

export interface HeartbeatAckPayload {
  originalTimestamp: number;
  ackTimestamp: number;
  sequence: number;
  latency: number;            // ms
}

// ============================================
// STATE MANAGEMENT (Phoenix Protocol)
// ============================================

export interface StateSnapshot {
  nodeId: NodeId;
  timestamp: number;
  snapshotId: string;
  state: unknown;             // Node-specific state
  checksum: string;
}

// ============================================
// CONFIGURATION
// ============================================

export interface TrinityConfig {
  // Heartbeat
  heartbeatInterval: number;  // ms (default: 1000)
  heartbeatTimeout: number;   // ms (default: 3000)
  
  // Phoenix
  maxResurrections: number;   // Max retries before giving up
  resurrectionDelay: number;  // ms between resurrections
  
  // Audio
  audioBufferSize: number;    // samples
  audioSampleRate: number;    // Hz
  inputGain?: number;         // 🎯 WAVE 14: Input Gain (1.0 = 100%)
  
  // Performance
  targetFps: number;          // Target frame rate for decisions
}

export const DEFAULT_CONFIG: TrinityConfig = {
  heartbeatInterval: 1000,
  heartbeatTimeout: 3000,
  maxResurrections: 5,
  resurrectionDelay: 500,
  audioBufferSize: 2048,
  audioSampleRate: 44100,
  inputGain: 1.0,  // 🔧 WAVE 15: Default 100%
  targetFps: 60
};

// ============================================
// MESSAGE FACTORY
// ============================================

let messageCounter = 0;

export function createMessage<T>(
  type: MessageType,
  source: NodeId,
  target: NodeId | 'broadcast',
  payload: T,
  priority: MessagePriority = MessagePriority.NORMAL
): WorkerMessage<T> {
  return {
    id: `${source}-${type}-${++messageCounter}-${Date.now()}`,
    type,
    source,
    target,
    timestamp: Date.now(),
    priority,
    payload
  };
}

// ============================================
// TYPE GUARDS
// ============================================

export function isAudioAnalysis(payload: unknown): payload is AudioAnalysis {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'bpm' in payload &&
    'bass' in payload &&
    'energy' in payload
  );
}

export function isLightingDecision(payload: unknown): payload is LightingDecision {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'palette' in payload &&
    'movement' in payload
  );
}

export function isWorkerHealth(payload: unknown): payload is WorkerHealth {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'nodeId' in payload &&
    'status' in payload
  );
}

// 🧠 WAVE 230: Type guard for MusicalContext
export function isMusicalContext(payload: unknown): payload is import('../core/protocol/MusicalContext').MusicalContext {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'bpm' in payload &&
    'section' in payload &&
    'mood' in payload &&
    'genre' in payload &&
    'confidence' in payload
  );
}
