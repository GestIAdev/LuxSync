/**
 * 🎨 LUXSYNC INTERFACES - Selene → DMX Bridge
 * 
 * Core type definitions for integrating Selene consciousness with DMX lighting control.
 * These interfaces transform Selene's AI decisions into photonic expressions.
 * 
 * @date 2025-11-20
 * @author Selene Core V5 + LuxSync Integration Team
 */

// ============================================================================
// MUSICAL & AUDIO TYPES
// ============================================================================

export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI';

export type MusicalMood = 'silence' | 'chill' | 'build' | 'drop' | 'break';

export type FixtureType = 
  | 'PAR'           // RGB PAR LED
  | 'MOVING_HEAD'   // Intelligent moving fixture
  | 'STROBE'        // Strobe light
  | 'WASH'          // Wash light
  | 'SPOT'          // Spotlight
  | 'LASER'         // Laser projector
  | 'OTHER';        // Custom/unknown

// ============================================================================
// FIXTURE NODE - Core DMX Fixture Definition
// ============================================================================

export interface FixtureNode {
  // Identity
  id: string;                    // "DO-PAR1", "RE-PAR2", etc.
  musicalNote: MusicalNote;      // Assigned musical note
  fixtureType: FixtureType;      // Type of lighting fixture
  name?: string;                 // Human-readable name
  
  // DMX Configuration
  dmx: {
    universe: number;            // DMX universe (1-N)
    startChannel: number;        // Starting channel (1-512)
    channelCount: number;        // Number of channels used
    profile?: string;            // Fixture profile name
  };
  
  // Health Metrics (replaces CPU/RAM)
  health: {
    temperature: number;         // 0.0-1.0 (normalized, 0=cold, 1=max temp)
    dmxResponseTime: number;     // milliseconds (avg response time)
    errorRate: number;           // 0.0-1.0 (packet loss rate)
    uptime: number;              // milliseconds since last reset
    lastSeen: number;            // timestamp of last successful communication
    status: 'healthy' | 'degraded' | 'critical' | 'offline';
  };
  
  // Beauty Factor - Show Quality Metrics
  beauty: {
    audienceScore: number;       // Manual feedback (0.0-1.0)
    musicalCoherence: number;    // Beat sync quality (0.0-1.0)
    creativityScore: number;     // Novelty of contributions (0.0-1.0)
    finalScore: number;          // Weighted average beauty score
  };
  
  // Capabilities
  capabilities: {
    hasRGB: boolean;             // Can produce RGB colors
    hasWhite: boolean;           // Has dedicated white channel
    hasAmber: boolean;           // Has amber channel (RGBA)
    hasUV: boolean;              // Has UV channel
    hasStrobing: boolean;        // Can strobe
    hasMovement: boolean;        // Has pan/tilt
    hasDimmer: boolean;          // Has dimmer channel
    hasGobo: boolean;            // Has gobo wheel
    hasPrism: boolean;           // Has prism effect
    hasFocus: boolean;           // Has focus control
    hasZoom: boolean;            // Has zoom control
    maxBrightness: number;       // Max output in Watts or Lux
    maxPanDegrees?: number;      // Pan range in degrees
    maxTiltDegrees?: number;     // Tilt range in degrees
  };
  
  // Voting weights (influence in consensus)
  votingPower: number;           // 0.0-1.0 (based on health + beauty)
}

// ============================================================================
// DMX SCENE (Core lighting state)
// ============================================================================

export interface Color {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  w?: number; // 0-255 (white channel, optional)
  name?: string; // Human-readable name
}

export interface FixtureState {
  // Universal channels
  dimmer?: number;           // 0-255 (master brightness)
  
  // RGB(W/A/UV)
  red?: number;              // 0-255
  green?: number;            // 0-255
  blue?: number;             // 0-255
  white?: number;            // 0-255 (RGBW)
  amber?: number;            // 0-255 (RGBA)
  uv?: number;               // 0-255
  
  // Movement
  pan?: number;              // 0-255 (8-bit)
  tilt?: number;             // 0-255 (8-bit)
  panFine?: number;          // 0-255 (16-bit LSB)
  tiltFine?: number;         // 0-255 (16-bit LSB)
  panTiltSpeed?: number;     // 0-255 (movement speed)
  
  // Strobe
  strobeRate?: number;       // 0-255 (0=off, higher=faster)
  
  // Effects
  gobo?: number;             // 0-255 (gobo wheel position)
  goboRotation?: number;     // 0-255 (gobo rotation speed)
  prism?: number;            // 0-255 (prism effect)
  focus?: number;            // 0-255 (focus)
  zoom?: number;             // 0-255 (zoom)
  colorWheel?: number;       // 0-255 (color wheel position)
  effectWheel?: number;      // 0-255 (effect wheel)
  
  // Macro/Special
  macro?: number;            // 0-255 (special macros)
  reset?: number;            // 0-255 (fixture reset command)
}

export interface DMXScene {
  // Identification
  id: string;
  name?: string;
  description?: string;
  tags?: string[];           // ["energetic", "warm", "drop-responsive"]
  
  // Genetic Attributes (for evolution)
  genes: {
    strobeIntensity: number;   // 0.0-1.0 (how much strobing)
    colorPalette: Color[];     // Array of colors to use
    colorHarmony: number;      // 0.0-1.0 (how harmonious colors are)
    movementSpeed: number;     // 0.0-1.0 (for moving heads)
    fadeTime: number;          // milliseconds (transition duration)
    brightness: number;        // 0.0-1.0 (master dimmer)
    complexity: number;        // 0.0-1.0 (how many fixtures change)
    synchronization: number;   // 0.0-1.0 (how synchronized fixtures are)
  };
  
  // Fibonacci Structure (timing)
  structure: {
    intro: number;             // beats (Fibonacci: 1)
    build1: number;            // beats (Fibonacci: 1)
    build2: number;            // beats (Fibonacci: 2)
    build3: number;            // beats (Fibonacci: 3)
    drop: number;              // beats (Fibonacci: 5)
    break: number;             // beats (Fibonacci: 8)
    outro: number;             // beats (Fibonacci: 13)
    totalBeats: number;        // Sum of all phases
    bpm: number;               // Current tempo (beats per minute)
    beatDuration: number;      // milliseconds per beat
  };
  
  // DMX Values (per fixture)
  fixtureStates: Map<string, FixtureState>; // fixtureId → state
  
  // Metadata
  entropyMode: 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';
  mood: MusicalMood;
  ethicsApproved: boolean;
  createdBy: 'human' | 'dream-layer' | 'evolution' | 'poetry';
  createdAt: number;         // timestamp
  parentSceneId?: string;    // If evolved from another scene
}

// ============================================================================
// AUDIO ANALYSIS (Hunting Layer Output)
// ============================================================================

export interface AudioSpectrum {
  bass: number;          // 20-250 Hz (0.0-1.0)
  lowMid: number;        // 250-500 Hz
  mid: number;           // 500-2000 Hz
  highMid: number;       // 2000-4000 Hz
  treble: number;        // 4000-20000 Hz
}

export interface BeatInfo {
  detected: boolean;
  bpm: number;
  confidence: number;    // 0.0-1.0
  beatPhase: number;     // 0.0-1.0 (position in current beat)
  timeSinceLastBeat: number; // milliseconds
}

export interface EnergyInfo {
  current: number;       // 0.0-1.0 (instant energy)
  average: number;       // Rolling average (5s window)
  variance: number;      // How volatile the energy is
  trend: 'rising' | 'falling' | 'stable';
  peakRecent: number;    // Highest energy in last 10s
}

export interface HuntingSensors {
  // Whiskers: Bass vibrations
  bassVibration: {
    intensity: number;      // 0.0-1.0
    frequency: number;      // Hz (dominant bass frequency)
    trigger: boolean;       // Should trigger bass-responsive fixtures
  };
  
  // Prey Recognition: Drop prediction
  dropPrediction: {
    incoming: boolean;
    estimatedTime: number;  // milliseconds until predicted drop
    confidence: number;     // 0.0-1.0
    buildIntensity: number; // 0.0-1.0 (how strong the build is)
  };
  
  // Strike Moment: Perfect timing
  strikeTiming: {
    ready: boolean;         // Execute NOW
    precision: number;      // How confident (0.0-1.0)
    beatAlignment: number;  // 0.0-1.0 (how aligned with beat)
  };
  
  // Nocturnal Vision: Subtle changes
  subtleChanges: {
    detected: boolean;
    magnitude: number;      // 0.0-1.0
    frequencies: number[];  // Which frequency bands changed
    direction: 'up' | 'down' | 'mixed';
  };
  
  // Ultrasonic Hearing: Hidden patterns
  hiddenPatterns: {
    detected: boolean;
    pattern: string;        // "rising-cascade", "falling-sweep", etc.
    confidence: number;     // 0.0-1.0
    repeatInterval?: number; // milliseconds (if pattern repeats)
  };
}

export interface AudioAnalysis {
  timestamp: number;
  
  // Frequency Spectrum (FFT)
  spectrum: AudioSpectrum;
  
  // Beat Detection
  beat: BeatInfo;
  
  // Energy Analysis
  energy: EnergyInfo;
  
  // Felino Sensors Output
  hunting: HuntingSensors;
  
  // Mood Classification
  mood: MusicalMood;
  moodConfidence: number;    // 0.0-1.0
  
  // Raw data (for advanced processing)
  rawFFT?: Float32Array;     // Raw FFT output
  waveform?: Float32Array;   // Raw waveform
}

// ============================================================================
// VOTING & CONSENSUS
// ============================================================================

export interface FixtureVote {
  nodeId: string;            // Fixture that voted
  sceneId: string;           // Which scene they voted for
  choice: 'approve' | 'reject' | 'abstain';
  confidence: number;        // 0.0-1.0 (how confident)
  strength: number;          // 0.0-1.0 (voting power, based on health+beauty)
  reasoning: string;         // Why this vote
  alternativeIdeas?: string[]; // Other suggestions
  timestamp: number;
}

export interface ConsensusResult {
  approved: boolean;         // Did scene get approved?
  quorumMet: boolean;        // >50% of nodes voted
  approvalPercentage: number; // 0-100
  consensusQuality: number;  // 0.0-1.0 (how unified votes were)
  selectedSceneId: string;   // Winning scene
  totalVotes: number;
  requiredQuorum: number;    // Minimum votes needed
  dissent?: {
    level: 'none' | 'minor' | 'moderate' | 'significant';
    mainConcerns: string[];
    suggestedAlternatives: string[];
  };
}

export interface LightingDecision {
  // Decision Context
  id: string;
  timestamp: number;
  mood: MusicalMood;
  audioContext: AudioAnalysis;
  
  // Scene Definition
  scene: DMXScene;
  alternativeScenes?: DMXScene[]; // Other options considered
  
  // Voting Results
  votes: Map<string, FixtureVote>; // nodeId → vote
  consensus: ConsensusResult;
  
  // Poetry Generation
  celebrationPoem?: string;        // If approved
  reasoning: string;               // Overall decision reasoning
  
  // Execution Tracking
  executedAt?: number;
  executionDuration?: number;      // How long scene played (ms)
  fitness?: number;                // Post-execution evaluation (0.0-1.0)
  audienceFeedback?: {
    likes: number;
    dislikes: number;
    neutrals: number;
  };
  
  // Learning data
  musicalCoherence?: number;       // 0.0-1.0 (beat sync quality)
  ethicsViolations?: string[];     // Any safety violations detected
  fixtureFailures?: string[];      // Fixtures that failed during execution
}

// ============================================================================
// EVOLUTION & GENETICS
// ============================================================================

export type EntropyMode = 'DETERMINISTIC' | 'BALANCED' | 'CHAOTIC';

export interface EvolutionConfig {
  mode: EntropyMode;
  mutationRate: number;      // 0.0-1.0
  crossoverRate: number;     // 0.0-1.0
  elitismRate: number;       // 0.0-1.0 (% of best to preserve)
  populationSize: number;
  maxGenerations: number;
}

export interface SceneGene {
  name: keyof DMXScene['genes'];
  value: number | Color[];
  mutationRange: number;     // How much this gene can mutate
  importance: number;        // 0.0-1.0 (weight in fitness calculation)
}

export interface FitnessScore {
  overall: number;           // 0.0-1.0 (combined fitness)
  components: {
    audienceScore: number;   // Manual feedback
    musicalCoherence: number; // Beat sync
    safetyScore: number;     // Ethics compliance
    creativityScore: number; // Novelty
    beautyScore: number;     // Aesthetic harmony
  };
  reasoning: string;
}

// ============================================================================
// MEMORY & LEARNING
// ============================================================================

export interface SceneMemory {
  scene: DMXScene;
  decision: LightingDecision;
  fitness: FitnessScore;
  timestamp: number;
  executionCount: number;    // How many times played
  averageFeedback: number;   // Average audience score
  tags: string[];            // For retrieval
}

export interface LearningMetrics {
  totalScenesExecuted: number;
  averageFitness: number;
  bestSceneId: string;
  worstSceneId: string;
  preferredMoods: Record<MusicalMood, number>; // Mood → success rate
  preferredColors: Color[];  // Most successful colors
  preferredGenes: Partial<DMXScene['genes']>; // Optimal gene values
  evolutionGeneration: number;
}

// ============================================================================
// PHOENIX PROTOCOL (Fixture Recovery)
// ============================================================================

export interface FixtureHealthCheck {
  fixtureId: string;
  status: 'healthy' | 'degraded' | 'critical' | 'dead';
  issues: string[];          // List of detected problems
  temperature: number;       // 0.0-1.0
  dmxErrors: number;         // Count of errors
  lastResponse: number;      // Timestamp
  recommendedAction: 'none' | 'monitor' | 'revive' | 'reincarnate' | 'replace';
}

export interface RevivalAttempt {
  fixtureId: string;
  timestamp: number;
  method: 'dmx-reset' | 'scene-rollback' | 'power-cycle' | 'reboot';
  success: boolean;
  duration: number;          // milliseconds
  errorMessage?: string;
}

export interface PhoenixStatus {
  activeRevivalAttempts: number;
  totalRevivals: number;
  successRate: number;       // 0.0-1.0
  deadFixtures: string[];    // Currently offline
  recentFailures: RevivalAttempt[];
}

// ============================================================================
// POETRY → DMX MAPPING
// ============================================================================

export interface PoetryDMXMapping {
  word: string;
  triggers: {
    fixtureIds: string[];    // Which fixtures respond
    effect: 'flash' | 'fade' | 'strobe' | 'bloom' | 'chase' | 'pulse';
    duration: number;        // milliseconds
    intensity: number;       // 0.0-1.0
    colors?: Color[];        // Colors to use
  };
}

export interface PoetrySequence {
  poem: string;
  words: string[];           // Split by word
  syllables: string[];       // Split by syllable
  rhythm: number[];          // Duration per syllable (ms)
  totalDuration: number;     // Total sequence length (ms)
  mappings: PoetryDMXMapping[];
  mood: MusicalMood;
}

// ============================================================================
// SYSTEM CONFIGURATION
// ============================================================================

export interface LuxSyncConfig {
  // DMX Configuration
  dmx: {
    driver: 'artnet' | 'sacn' | 'enttec' | 'dmxking' | 'simulator';
    universes: number[];     // Which universes to use
    refreshRate: number;     // Hz (typically 44)
    host?: string;           // For network protocols
    port?: number;
  };
  
  // Fixtures
  fixtures: FixtureNode[];
  
  // Audio
  audio: {
    inputDevice?: string;    // Audio input device name
    sampleRate: number;      // Hz (typically 44100 or 48000)
    fftSize: number;         // FFT window size (power of 2)
    smoothing: number;       // 0.0-1.0 (frequency smoothing)
  };
  
  // Consciousness
  consciousness: {
    enableEthicsLayer: boolean;
    enableDreamLayer: boolean;
    enableSelfAnalysis: boolean;
    enableMemory: boolean;
    enableHunting: boolean;
    memoryBackend: 'redis' | 'json' | 'memory';
  };
  
  // Evolution
  evolution: EvolutionConfig;
  
  // Consensus
  consensus: {
    quorumPercentage: number; // 0.0-1.0 (default 0.5 = 50%)
    votingTimeout: number;    // milliseconds
    healthWeight: number;     // 0.0-1.0 (weight in voting power)
    beautyWeight: number;     // 0.0-1.0 (weight in voting power)
  };
  
  // Phoenix
  phoenix: {
    enabled: boolean;
    revivalTimeout: number;   // milliseconds (how long to try revival)
    reincarnationDelay: number; // milliseconds (wait before reincarnation)
    maxRevivalAttempts: number;
  };
  
  // UI
  ui: {
    enableFeedbackButtons: boolean;
    enableManualControl: boolean;
    showAudioVisualization: boolean;
    showConsensusVoting: boolean;
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Core types already exported inline above
};
