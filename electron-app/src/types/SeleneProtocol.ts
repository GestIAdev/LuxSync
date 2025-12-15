/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 SELENE PROTOCOL - UNIVERSAL TRUTH PROTOCOL
 * "The Single Source of Truth for the Frontend"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 25: PROTOCOL DECOUPLING
 * 
 * This interface represents the ENTIRE state of Selene at any given frame.
 * The Frontend becomes a "Dumb Renderer" that simply displays this object.
 * 
 * PHILOSOPHY:
 * - Backend calculates EVERYTHING
 * - Frontend renders EVERYTHING
 * - No translation layers, no stores, no adapters
 * - One object. One truth. 30fps.
 * 
 * @module types/SeleneProtocol
 * @version 25.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. SENSORY LAYER - Raw Audio Input
// Source: AudioMetrics → FFT.ts → senses.ts worker
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw audio metrics from capture device
 * @source src/hooks/useAudioCapture.ts
 * @source src/main/workers/senses.ts
 */
export interface SensoryData {
  /** Raw audio metrics */
  audio: {
    /** Current energy level (0-1), normalized */
    energy: number;
    /** Peak energy in current window */
    peak: number;
    /** Running average energy */
    average: number;
    /** Low frequency energy (bass, 20-250Hz) */
    bass: number;
    /** Mid frequency energy (250Hz-4kHz) */
    mid: number;
    /** High frequency energy (4kHz-20kHz) */
    high: number;
    /** Spectral centroid (brightness indicator) */
    spectralCentroid: number;
    /** Spectral flux (change detection) */
    spectralFlux: number;
    /** Zero crossing rate (texture) */
    zeroCrossingRate: number;
  };
  
  /** FFT frequency bins (256 values, 0-1 normalized) */
  fft: number[];
  
  /** Beat detection state */
  beat: {
    /** True on exact beat moment */
    onBeat: boolean;
    /** Confidence of beat detection (0-1) */
    confidence: number;
    /** Current BPM estimate */
    bpm: number;
    /** Phase within current beat (0-1) */
    beatPhase: number;
    /** Phase within current bar (0-1) */
    barPhase: number;
    /** Time since last beat (ms) */
    timeSinceLastBeat: number;
  };
  
  /** Input configuration */
  input: {
    /** User-set input gain multiplier */
    gain: number;
    /** Active audio device name */
    device: string;
    /** True if audio is being received */
    active: boolean;
    /** Clipping detection */
    isClipping: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. COGNITIVE LAYER - Consciousness & Personality
// Source: engines/consciousness/*
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Consciousness and personality state
 * @source src/main/selene-lux-core/engines/consciousness/SeleneLuxConscious.ts
 * @source src/main/selene-lux-core/engines/consciousness/DreamForgeEngine.ts
 * @source src/main/selene-lux-core/engines/consciousness/SeleneEvolutionEngine.ts
 * @source src/main/selene-lux-core/engines/consciousness/ZodiacAffinityCalculator.ts
 */
export interface CognitiveData {
  /** Current emotional mood */
  mood: 'peaceful' | 'energetic' | 'dark' | 'playful' | 'calm' | 'dramatic' | 'euphoric';
  
  /** Consciousness level (0-1, evolves over time) */
  consciousnessLevel: number;
  
  /** Evolution state */
  evolution: {
    /** Current stage: awakening → learning → wise */
    stage: 'awakening' | 'learning' | 'wise';
    /** Total experiences processed */
    totalExperiences: number;
    /** Patterns discovered */
    patternsDiscovered: number;
    /** Current generation number */
    generation: number;
    /** Lineage history */
    lineage: string[];
  };
  
  /** Dream Forge - What Selene is "imagining" 
   * @source DreamForgeEngine.ts
   */
  dream: {
    /** True if currently simulating a scenario */
    isActive: boolean;
    /** Current dream type being simulated */
    currentType: 'palette_change' | 'intensity_shift' | 'movement_change' | 
                 'effect_activation' | 'mood_transition' | 'strike_execution' | 
                 'full_scene_change' | null;
    /** Human-readable description of current thought */
    currentThought: string;
    /** Projected beauty score of current simulation (0-1) */
    projectedBeauty: number;
    /** Last dream recommendation */
    lastRecommendation: 'execute' | 'modify' | 'abort' | null;
  };
  
  /** Zodiac affinity calculated from audio frequencies 
   * @source ZodiacAffinityCalculator.ts
   */
  zodiac: {
    /** Current dominant element */
    element: 'fire' | 'earth' | 'air' | 'water';
    /** Current zodiac sign resonance */
    sign: string;
    /** Affinity score (0-1) */
    affinity: number;
    /** Quality resonance */
    quality: 'cardinal' | 'fixed' | 'mutable';
    /** Poetic description */
    description: string;
  };
  
  /** Beauty evaluation metrics 
   * @source SeleneEvolutionEngine.ts
   */
  beauty: {
    /** Current frame beauty score (0-1) */
    current: number;
    /** Session average */
    average: number;
    /** Session maximum */
    max: number;
    /** Components breakdown */
    components: {
      fibonacciAlignment: number;
      zodiacResonance: number;
      musicalHarmony: number;
      patternResonance: number;
      historicalBonus: number;
    };
  };
  
  /** Last insight or thought as string */
  lastInsight: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. MUSICAL DNA LAYER - Deep Music Analysis
// Source: engines/musical/*
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Musical intelligence analysis
 * @source src/main/selene-lux-core/engines/musical/SeleneMusicalBrain.ts
 * @source src/main/selene-lux-core/engines/musical/analysis/HarmonyDetector.ts
 * @source src/main/selene-lux-core/engines/musical/analysis/RhythmAnalyzer.ts
 * @source src/main/selene-lux-core/engines/musical/classification/GenreClassifier.ts
 * @source src/main/selene-lux-core/engines/musical/context/MusicalContextEngine.ts
 * @source src/main/selene-lux-core/engines/musical/context/PredictionMatrix.ts
 */
export interface MusicalDNAData {
  /** Detected musical key (C, D#, F, etc.) */
  key: string | null;
  
  /** Detected mode/scale */
  mode: {
    scale: 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 
           'locrian' | 'harmonic_minor' | 'melodic_minor' | 'pentatonic_major' | 
           'pentatonic_minor' | 'blues' | 'chromatic';
    mood: 'happy' | 'sad' | 'jazzy' | 'spanish_exotic' | 'dreamy' | 'bluesy' | 
          'tense' | 'universal';
    confidence: number;
  };
  
  /** Genre classification */
  genre: {
    /** Macro-genre category */
    primary: 'ELECTRONIC_4X4' | 'ELECTRONIC_BREAK' | 'LATINO_TRADICIONAL' | 
             'LATINO_URBANO' | 'ROCK_POP' | 'JAZZ_SOUL' | 'AMBIENT_CHILL' | 'UNKNOWN';
    /** Sub-genre if detected */
    subGenre: string | null;
    /** Classification confidence (0-1) */
    confidence: number;
    /** All genre probabilities */
    distribution: Record<string, number>;
  };
  
  /** Rhythm analysis */
  rhythm: {
    /** Detected BPM */
    bpm: number;
    /** BPM detection confidence (0-1) */
    confidence: number;
    /** Syncopation level (0-1) - CRITICAL for classification 
     * < 0.15: Straight (Techno, House)
     * 0.15-0.4: Moderate (Pop, Rock)
     * > 0.4: High (Reggaeton, Funk)
     */
    syncopation: number;
    /** Smoothed syncopation (EMA filtered, anti-flicker) */
    syncopationSmoothed: number;
    /** Swing amount (0-1) */
    swing: number;
    /** Pattern complexity */
    complexity: 'low' | 'medium' | 'high';
    /** Detected drum pattern */
    pattern: 'four_on_floor' | 'breakbeat' | 'half_time' | 'reggaeton' | 
             'cumbia' | 'rock_standard' | 'jazz_swing' | 'latin' | 'minimal' | 'unknown';
  };
  
  /** Section tracking and prediction 
   * @source SectionTracker.ts, PredictionMatrix.ts
   */
  section: {
    /** Current section type */
    current: 'intro' | 'verse' | 'chorus' | 'bridge' | 'breakdown' | 'drop' | 
             'buildup' | 'outro' | 'transition' | 'unknown';
    /** Section energy level (0-1) */
    energy: number;
    /** Bars in current section */
    barsInSection: number;
    /** Confidence in section detection (0-1) */
    confidence: number;
  };
  
  /** Predictive analysis 
   * @source PredictionMatrix.ts, HuntOrchestrator.ts, StrikeMomentEngine.ts
   */
  prediction: {
    /** Predicted next section */
    nextSection: {
      type: string;
      probability: number;
      barsUntil: number;
    };
    /** Drop detection */
    dropPrediction: {
      /** True if drop is imminent */
      isImminent: boolean;
      /** Bars until predicted drop */
      barsUntil: number;
      /** Probability of drop (0-1) */
      probability: number;
    };
    /** Hunt/Strike readiness (from HuntOrchestrator) */
    huntStatus: {
      /** Current phase: stalking, tracking, locked, striking */
      phase: 'idle' | 'stalking' | 'tracking' | 'locked' | 'striking';
      /** Lock percentage (0-100) */
      lockPercentage: number;
      /** Target type */
      targetType: string | null;
    };
  };
  
  /** Harmony detection */
  harmony: {
    /** Current chord root */
    chordRoot: string | null;
    /** Chord quality */
    chordQuality: 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | null;
    /** Chord detection confidence (0-1) */
    confidence: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. VISUAL DECISION LAYER - Colors & Movement
// Source: engines/visual/*
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified color with all representations
 * NO MORE HSL/RGB CONFUSION - Both are always available
 */
export interface UnifiedColor {
  /** Hue (0-360) */
  h: number;
  /** Saturation (0-100) */
  s: number;
  /** Lightness (0-100) */
  l: number;
  /** Red (0-255) */
  r: number;
  /** Green (0-255) */
  g: number;
  /** Blue (0-255) */
  b: number;
  /** Hex string (#RRGGBB) */
  hex: string;
}

/**
 * Visual decisions: colors, movement, effects
 * @source src/main/selene-lux-core/engines/visual/SeleneColorEngine.ts
 * @source src/main/selene-lux-core/engines/visual/MovementEngine.ts
 * @source src/main/selene-lux-core/engines/visual/EffectsEngine.ts
 */
export interface VisualDecisionData {
  /** Color palette - UNIFIED (HSL + RGB + HEX) */
  palette: {
    primary: UnifiedColor;
    secondary: UnifiedColor;
    accent: UnifiedColor;
    ambient: UnifiedColor;
    contrast: UnifiedColor;
    
    /** Palette generation strategy */
    strategy: 'analogous' | 'triadic' | 'complementary';
    /** Temperature bias */
    temperature: 'warm' | 'cool' | 'neutral';
    /** Human-readable description */
    description: string;
    /** Source of palette */
    source: 'procedural' | 'memory' | 'fallback';
  };
  
  /** Global intensity (0-1), user-controlled */
  intensity: number;
  
  /** Global saturation (0-1), user-controlled */
  saturation: number;
  
  /** Movement commands 
   * @source MovementEngine.ts, FixturePhysicsDriver.ts
   */
  movement: {
    /** Pan position (0-255) */
    pan: number;
    /** Tilt position (0-255) */
    tilt: number;
    /** Movement speed (0-1) */
    speed: number;
    /** Current pattern name */
    patternName: string;
    /** Physics simulation active 
     * @source FixturePhysicsDriver.ts
     */
    physicsActive: boolean;
    /** Physics details (when active) */
    physics: {
      /** Inertia factor */
      inertia: number;
      /** Gravity influence */
      gravity: number;
      /** Acceleration curve */
      acceleration: number;
    } | null;
  };
  
  /** Special effects state */
  effects: {
    /** Strobe effect */
    strobe: {
      active: boolean;
      rate: number; // Hz
      intensity: number; // 0-1
    };
    /** Fog/haze machine */
    fog: {
      active: boolean;
      density: number; // 0-1
    };
    /** Laser effect */
    laser: {
      active: boolean;
      pattern: string;
      color: UnifiedColor | null;
    };
    /** Beam effect (moving heads) */
    beam: {
      active: boolean;
      width: number; // degrees
    };
    /** Prism effect */
    prism: {
      active: boolean;
      facets: number;
    };
    /** Blackout state */
    blackout: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. HARDWARE STATE LAYER - DMX & Fixtures
// Source: hardware/*
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fixture state for UI display
 */
export interface FixtureState {
  id: string;
  name: string;
  type: string;
  dmxAddress: number;
  zone: string;
  color: UnifiedColor;
  intensity: number;
  pan?: number;
  tilt?: number;
  active: boolean;
}

/**
 * Hardware and DMX state
 * @source src/main/selene-lux-core/hardware/DMXDriver.ts
 * @source src/main/selene-lux-core/hardware/FixtureManager.ts
 */
export interface HardwareStateData {
  /** Raw DMX universe output (512 channels) */
  dmxOutput: number[];
  
  /** Number of active fixtures */
  fixturesActive: number;
  
  /** Total patched fixtures */
  fixturesTotal: number;
  
  /** Individual fixture states */
  fixtures: FixtureState[];
  
  /** DMX connection status */
  dmx: {
    connected: boolean;
    driver: string;
    universe: number;
    frameRate: number;
    lastUpdate: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SYSTEM METADATA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * System performance and status
 */
export interface SystemMetadata {
  /** Frame number since start */
  frameNumber: number;
  
  /** Timestamp of this broadcast (ms since epoch) */
  timestamp: number;
  
  /** Delta time since last frame (ms) */
  deltaTime: number;
  
  /** Target frames per second */
  targetFPS: number;
  
  /** Actual frames per second */
  actualFPS: number;
  
  /** Current operation mode */
  mode: 'selene' | 'flow' | 'manual';
  
  /** Brain status */
  brainStatus: 'reactive' | 'intelligent';
  
  /** Session uptime (seconds) */
  uptime: number;
  
  /** Performance metrics */
  performance: {
    /** Processing time for audio analysis (ms) */
    audioProcessingMs: number;
    /** Processing time for brain (ms) */
    brainProcessingMs: number;
    /** Processing time for color engine (ms) */
    colorEngineMs: number;
    /** DMX output time (ms) */
    dmxOutputMs: number;
    /** Total frame time (ms) */
    totalFrameMs: number;
  };
  
  /** Worker thread health */
  workers: {
    alpha: { healthy: boolean; lastHeartbeat: number };
    beta: { healthy: boolean; lastHeartbeat: number };
    gamma: { healthy: boolean; lastHeartbeat: number };
  };
  
  /** Session ID */
  sessionId: string;
  
  /** Version info */
  version: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. SELENE BROADCAST - THE UNIVERSAL TRUTH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌙 SELENE BROADCAST - The Single Source of Truth
 * 
 * This interface represents the ENTIRE state of Selene at any given frame.
 * Broadcast at 30fps from Backend → Frontend via IPC.
 * 
 * The Frontend is a "Dumb Renderer" that simply displays this object.
 * No stores. No adapters. No translation. Just render.
 * 
 * @example
 * ```typescript
 * // Backend (main process)
 * const broadcast: SeleneBroadcast = selene.getBroadcast();
 * mainWindow.webContents.send('selene:broadcast', broadcast);
 * 
 * // Frontend (renderer)
 * useEffect(() => {
 *   const unsubscribe = window.api.onBroadcast((data: SeleneBroadcast) => {
 *     setState(data); // That's it. Render this.
 *   });
 *   return unsubscribe;
 * }, []);
 * ```
 */
export interface SeleneBroadcast {
  /**
   * Raw sensory input from audio capture
   * @see SensoryData
   */
  sensory: SensoryData;
  
  /**
   * Consciousness, personality, dreams, evolution
   * @see CognitiveData
   */
  cognitive: CognitiveData;
  
  /**
   * Deep musical analysis (key, genre, rhythm, sections)
   * @see MusicalDNAData
   */
  musicalDNA: MusicalDNAData;
  
  /**
   * Visual output decisions (colors, movement, effects)
   * @see VisualDecisionData
   */
  visualDecision: VisualDecisionData;
  
  /**
   * Hardware state (DMX values, fixtures)
   * @see HardwareStateData
   */
  hardwareState: HardwareStateData;
  
  /**
   * System metadata (performance, timing, health)
   * @see SystemMetadata
   */
  system: SystemMetadata;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a default/empty broadcast (for initialization)
 */
export function createDefaultBroadcast(): SeleneBroadcast {
  const defaultColor: UnifiedColor = { h: 0, s: 0, l: 50, r: 128, g: 128, b: 128, hex: '#808080' };
  
  return {
    sensory: {
      audio: {
        energy: 0, peak: 0, average: 0, bass: 0, mid: 0, high: 0,
        spectralCentroid: 0, spectralFlux: 0, zeroCrossingRate: 0
      },
      fft: new Array(256).fill(0),
      beat: { onBeat: false, confidence: 0, bpm: 120, beatPhase: 0, barPhase: 0, timeSinceLastBeat: 0 },
      input: { gain: 1, device: 'None', active: false, isClipping: false }
    },
    cognitive: {
      mood: 'peaceful',
      consciousnessLevel: 0,
      evolution: { stage: 'awakening', totalExperiences: 0, patternsDiscovered: 0, generation: 1, lineage: ['Genesis'] },
      dream: { isActive: false, currentType: null, currentThought: 'Selene awakening...', projectedBeauty: 0, lastRecommendation: null },
      zodiac: { element: 'water', sign: 'Pisces', affinity: 0.5, quality: 'mutable', description: 'The dreaming mystic' },
      beauty: { current: 0.5, average: 0.5, max: 0.5, components: { fibonacciAlignment: 0, zodiacResonance: 0, musicalHarmony: 0, patternResonance: 0, historicalBonus: 0 } },
      lastInsight: 'Selene Lux awakening...'
    },
    musicalDNA: {
      key: null,
      mode: { scale: 'major', mood: 'universal', confidence: 0 },
      genre: { primary: 'UNKNOWN', subGenre: null, confidence: 0, distribution: {} },
      rhythm: { bpm: 120, confidence: 0, syncopation: 0, syncopationSmoothed: 0, swing: 0, complexity: 'low', pattern: 'unknown' },
      section: { current: 'unknown', energy: 0, barsInSection: 0, confidence: 0 },
      prediction: {
        nextSection: { type: 'unknown', probability: 0, barsUntil: 0 },
        dropPrediction: { isImminent: false, barsUntil: 0, probability: 0 },
        huntStatus: { phase: 'idle', lockPercentage: 0, targetType: null }
      },
      harmony: { chordRoot: null, chordQuality: null, confidence: 0 }
    },
    visualDecision: {
      palette: {
        primary: defaultColor, secondary: defaultColor, accent: defaultColor,
        ambient: defaultColor, contrast: defaultColor,
        strategy: 'analogous', temperature: 'neutral', description: 'Default', source: 'fallback'
      },
      intensity: 1,
      saturation: 1,
      movement: { pan: 127, tilt: 127, speed: 0.5, patternName: 'static', physicsActive: false, physics: null },
      effects: {
        strobe: { active: false, rate: 0, intensity: 0 },
        fog: { active: false, density: 0 },
        laser: { active: false, pattern: '', color: null },
        beam: { active: false, width: 0 },
        prism: { active: false, facets: 0 },
        blackout: false
      }
    },
    hardwareState: {
      dmxOutput: new Array(512).fill(0),
      fixturesActive: 0,
      fixturesTotal: 0,
      fixtures: [],
      dmx: { connected: false, driver: 'none', universe: 1, frameRate: 40, lastUpdate: 0 }
    },
    system: {
      frameNumber: 0,
      timestamp: Date.now(),
      deltaTime: 0,
      targetFPS: 30,
      actualFPS: 0,
      mode: 'selene',
      brainStatus: 'reactive',
      uptime: 0,
      performance: { audioProcessingMs: 0, brainProcessingMs: 0, colorEngineMs: 0, dmxOutputMs: 0, totalFrameMs: 0 },
      workers: {
        alpha: { healthy: false, lastHeartbeat: 0 },
        beta: { healthy: false, lastHeartbeat: 0 },
        gamma: { healthy: false, lastHeartbeat: 0 }
      },
      sessionId: '',
      version: '25.0.0'
    }
  };
}

/**
 * Type guard for SeleneBroadcast
 */
export function isSeleneBroadcast(obj: unknown): obj is SeleneBroadcast {
  if (!obj || typeof obj !== 'object') return false;
  const broadcast = obj as Record<string, unknown>;
  return (
    'sensory' in broadcast &&
    'cognitive' in broadcast &&
    'musicalDNA' in broadcast &&
    'visualDecision' in broadcast &&
    'hardwareState' in broadcast &&
    'system' in broadcast
  );
}
