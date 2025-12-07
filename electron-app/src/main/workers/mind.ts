/**
 * 🧠 GAMMA WORKER - MIND (Selene Brain)
 * 
 * Worker Thread dedicado a la inteligencia de Selene.
 * 
 * TRINITY PHASE 1: Integrado con motores Wave 8 vía TrinityBridge
 * 
 * Procesa análisis de audio y genera decisiones de iluminación:
 * - REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * - REGLA 3: Syncopation > BPM para selección de patrones
 * - Memory Management (patrones aprendidos)
 * - Predictive Engine
 * - Aesthetic Decision Making
 * - Personality System
 * 
 * Recibe AudioAnalysis+Wave8Data de ALPHA (via BETA).
 * Envía LightingDecisions a ALPHA para DMX.
 */

import { parentPort, workerData } from 'worker_threads';
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  AudioAnalysis,
  LightingDecision,
  WorkerHealth,
  HeartbeatPayload,
  HeartbeatAckPayload,
  RGBColor,
  MovementPattern,
  createMessage,
  TrinityConfig,
  DEFAULT_CONFIG,
  isAudioAnalysis
} from './WorkerProtocol';

// Wave 8 Bridge imports
import {
  SimplePaletteGenerator,
  hslToTrinityRgb,
  sectionToMovement,
  createReactiveDecision,
  RhythmOutput,
  HarmonyOutput,
  SectionOutput,
  GenreOutput,
  SelenePalette,
} from './TrinityBridge';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'gamma' as const;

// ============================================
// WAVE 8 PALETTE GENERATOR (must be before state)
// ============================================

const paletteGenerator = new SimplePaletteGenerator();

// ============================================
// 🌊 WAVE 12.5: SELENE LIBRE - Sin Etiquetas
// ============================================
// FILOSOFÍA: El arte no necesita etiquetas de género.
// Los colores emergen PURAMENTE de la matemática musical:
//   - Energy → Saturación
//   - Syncopation → Contraste  
//   - Key → Tono (Hue)
//   - Density → Complejidad
// 
// El mismo Cyberpunk y la misma Cumbia producirán colores
// DIFERENTES porque su DNA musical es matemáticamente diferente.
// ============================================

// ============================================
// PERSONALITY & AESTHETIC SYSTEM
// ============================================

interface SelenePersonality {
  // Core traits (0-1)
  boldness: number;        // Preference for dramatic changes
  fluidity: number;        // Smooth vs sharp transitions
  colorfulness: number;    // Preference for saturated colors
  symmetry: number;        // Preference for symmetric patterns
  responsiveness: number;  // How quickly to react to music
  
  // Mood (influenced by music)
  currentMood: 'energetic' | 'calm' | 'dark' | 'playful';
}

const personality: SelenePersonality = {
  boldness: 0.6,
  fluidity: 0.7,
  colorfulness: 0.8,
  symmetry: 0.5,
  responsiveness: 0.75,
  currentMood: 'calm'
};

// ============================================
// NOTE: PALETTES eliminado en PHASE 1.5 (OPERATION PURGE)
// Ahora usamos ÚNICAMENTE SimplePaletteGenerator de Wave 8
// que genera colores proceduralmente basados en mood + energy + syncopation
// ============================================

// ============================================
// STATE
// ============================================

/**
 * Extended AudioAnalysis with Wave 8 data (from BETA)
 */
interface ExtendedAudioAnalysis extends AudioAnalysis {
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
  };
}

interface GammaState {
  isRunning: boolean;
  frameCount: number;
  decisionCount: number;
  startTime: number;
  lastHeartbeat: number;
  
  // Audio history for pattern detection
  audioHistory: ExtendedAudioAnalysis[];
  maxAudioHistory: number;
  
  // Current state (Pure Wave 8 - GENERATED, not hardcoded)
  currentPalette: SelenePalette;   // Generated procedurally
  currentMoodHint: string;         // From Wave 8 harmony
  currentMovement: MovementPattern;
  lastDecisionTime: number;
  
  // Wave 8 Operation Mode (REGLA 2)
  operationMode: 'intelligent' | 'reactive';
  combinedConfidence: number;
  
  // 🧠 WAVE 10: Brain forced mode (from main process Big Switch)
  brainForced: boolean;
  
  // Memory (learned patterns)
  learnedPatterns: Map<string, LearnedPattern>;
  
  // Performance
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
}

interface LearnedPattern {
  id: string;
  audioSignature: {
    bpmRange: [number, number];
    energyRange: [number, number];
    mood: string;
  };
  lightingResponse: {
    palette: string;
    movement: MovementPattern;
    intensity: number;
  };
  successScore: number;  // How well this pattern worked
  useCount: number;
}

const state: GammaState = {
  isRunning: false,
  frameCount: 0,
  decisionCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  
  audioHistory: [],
  maxAudioHistory: 60, // ~1 second at 60fps
  
  // Wave 8 Pure - GENERATED procedurally, NOT hardcoded
  currentPalette: paletteGenerator.generate('universal', 0.5, 0, null),  // Neutral procedural palette
  currentMoodHint: 'neutral',
  currentMovement: 'sweep',
  lastDecisionTime: Date.now(),
  
  // Wave 8 defaults
  operationMode: 'reactive',
  combinedConfidence: 0,
  
  // 🧠 WAVE 10: Brain activation flag (from main process)
  brainForced: false,  // When true, ALWAYS use intelligent mode
  
  learnedPatterns: new Map(),
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: []
};

// ============================================
// COLOR UTILITIES (Pure functions - no legacy dependencies)
// ============================================

function adjustColorIntensity(color: RGBColor, intensity: number): RGBColor {
  return {
    r: Math.round(color.r * intensity),
    g: Math.round(color.g * intensity),
    b: Math.round(color.b * intensity)
  };
}

// ============================================
// DECISION GENERATION - WAVE 8 INTEGRATED
// ============================================

/**
 * Generate lighting decision using Wave 8 intelligence
 * 
 * REGLA 2: confidence < 0.5 → Modo Reactivo (V17 style)
 * REGLA 3: Syncopation > BPM para patrones
 */
function generateDecision(analysis: ExtendedAudioAnalysis): LightingDecision {
  const startTime = performance.now();
  state.frameCount++;
  state.decisionCount++;
  
  // Add to history
  state.audioHistory.push(analysis);
  if (state.audioHistory.length > state.maxAudioHistory) {
    state.audioHistory.shift();
  }
  
  // === REGLA 2: Check confidence for mode selection ===
  // 🧠 WAVE 10: brainForced overrides REGLA 2 - si el usuario puso SELENE, ¡USAMOS EL BRAIN!
  const wave8 = analysis.wave8;
  if (wave8) {
    // Calculate combined confidence (REGLA 2)
    state.combinedConfidence = 
      wave8.rhythm.confidence * 0.35 +
      wave8.harmony.confidence * 0.20 +
      wave8.section.confidence * 0.20 +
      wave8.genre.confidence * 0.25;
    
    // 🧠 WAVE 10: brainForced ignora la confidence - SI EL USUARIO DIJO SELENE, SELENE ES
    if (state.brainForced) {
      state.operationMode = 'intelligent';
    } else {
      state.operationMode = state.combinedConfidence >= 0.5 ? 'intelligent' : 'reactive';
    }
  } else {
    // Sin wave8 data, pero si brainForced, intentamos intelligent anyway
    state.operationMode = state.brainForced ? 'intelligent' : 'reactive';
    state.combinedConfidence = state.brainForced ? 0.6 : 0.3;
  }
  
  // === REACTIVE MODE (V17 Style) ===
  // 🧠 WAVE 10: Solo si NO está forzado el brain
  if (state.operationMode === 'reactive' && !state.brainForced) {
    // Direct audio → light mapping (fast fallback)
    const reactiveDecision = createReactiveDecision(analysis, state.frameCount);
    state.totalProcessingTime += performance.now() - startTime;
    state.messagesProcessed++;
    state.lastDecisionTime = Date.now();
    return reactiveDecision;
  }
  
  // === INTELLIGENT MODE (Wave 8 Full Analysis) ===
  const { rhythm, harmony, section, genre } = wave8!;
  
  // 🌊 WAVE 12.5: SELENE LIBRE - Sin etiquetas de género
  // Los colores emergen de la MATEMÁTICA PURA:
  //   - Energy (energía) → Saturación
  //   - Syncopation (ritmo) → Contraste entre colores
  //   - Key (armonía) → Tono base (hue)
  // El género se mantiene solo para logging informativo
  
  // Log informativo cada segundo (solo para observar, no para decidir)
  if (state.frameCount % 60 === 0) {
    console.log(`[GAMMA] � SELENE LIBRE: E=${analysis.energy.toFixed(2)} S=${rhythm.syncopation.toFixed(2)} K=${harmony.key ?? '?'} (genre=${genre.primary} - ignored)`);
  }
  
  // Generate procedural palette from Wave 8 data - PURE MATH, NO GENRE
  const selenePalette = paletteGenerator.generate(
    harmony.mood,
    analysis.energy,
    rhythm.syncopation,  // REGLA 3: Syncopation shapes the palette
    harmony.key
    // 🌊 WAVE 12.5: Ya NO pasamos genrePalette - la matemática decide TODO
  );
  
  // Convert HSL palette to RGB
  const primaryRgb = hslToTrinityRgb(selenePalette.primary);
  const secondaryRgb = hslToTrinityRgb(selenePalette.secondary);
  const accentRgb = hslToTrinityRgb(selenePalette.accent);
  
  // Calculate intensity
  const baseIntensity = section.energy;
  const beatBoost = analysis.onBeat ? 0.2 * analysis.beatStrength : 0;
  const intensity = Math.min(1, baseIntensity + beatBoost);
  
  // Select movement based on section (from Wave 8)
  const movementPattern = sectionToMovement(section, analysis.energy, rhythm.syncopation);
  state.currentMovement = movementPattern;
  
  // Build palette with intensity
  const palette = {
    primary: adjustColorIntensity(primaryRgb, intensity),
    secondary: adjustColorIntensity(secondaryRgb, intensity * 0.8),
    accent: adjustColorIntensity(accentRgb, intensity * 0.6),
    intensity
  };
  
  // Movement parameters (influenced by genre)
  const genreSpeedMultiplier = genre.primary === 'techno' ? 1.2 : 
                               genre.primary === 'reggaeton' ? 0.9 :
                               genre.primary === 'cumbia' ? 0.85 : 1.0;
  
  const movement = {
    pattern: movementPattern,
    speed: (0.3 + analysis.bpm / 300) * genreSpeedMultiplier,
    range: 0.5 + section.energy * 0.5,
    sync: (analysis.bpmConfidence > 0.7 ? 'beat' : 
           section.type === 'chorus' || section.type === 'drop' ? 'phrase' : 'free') as 'beat' | 'phrase' | 'free'
  };
  
  // Effects (section-aware)
  const effects = {
    strobe: (section.type === 'drop' || section.type === 'chorus') && 
            analysis.onBeat && 
            analysis.energy > 0.85 && 
            personality.boldness > 0.6,
    strobeRate: analysis.bpm > 140 ? analysis.bpm / 60 : undefined,
    fog: section.type === 'buildup' ? section.energy * 0.8 :
         section.type === 'breakdown' ? 0.3 : 0,
    laser: harmony.mood === 'tense' || (analysis.treble > 0.8 && personality.boldness > 0.6)
  };
  
  // Calculate beauty score with Wave 8 data
  const beautyScore = calculateBeautyScore(analysis, palette, movement, wave8);
  
  // Update personality mood based on harmony
  if (harmony.mood === 'happy' || harmony.mood === 'bluesy') {
    personality.currentMood = 'energetic';
  } else if (harmony.mood === 'sad' || harmony.mood === 'tense') {
    personality.currentMood = 'dark';
  } else if (harmony.mood === 'dreamy' || harmony.mood === 'jazzy') {
    personality.currentMood = 'calm';
  } else if (harmony.mood === 'spanish_exotic') {
    personality.currentMood = 'playful';
  }
  
  // Track processing time
  state.totalProcessingTime += performance.now() - startTime;
  state.messagesProcessed++;
  state.lastDecisionTime = Date.now();
  
  return {
    timestamp: Date.now(),
    frameId: state.frameCount,
    decisionId: `decision-${state.decisionCount}-${Date.now()}`,
    
    confidence: state.combinedConfidence,
    beautyScore,
    source: 'procedural', // Could be 'memory' when using learned patterns
    
    palette,
    movement,
    effects
  };
}

function calculateBeautyScore(
  analysis: ExtendedAudioAnalysis,
  _palette: LightingDecision['palette'],
  movement: LightingDecision['movement'],
  wave8?: ExtendedAudioAnalysis['wave8']
): number {
  // Aesthetic heuristics
  let score = 0.5; // Base
  
  // Sync bonus
  if (movement.sync === 'beat' && analysis.bpmConfidence > 0.7) {
    score += 0.15;
  }
  
  // Energy matching
  const energyMatch = 1 - Math.abs(analysis.energy - movement.range);
  score += energyMatch * 0.1;
  
  // Groove bonus (REGLA 3: good groove = good vibes)
  score += analysis.groove * 0.15;
  
  // Wave 8 bonuses
  if (wave8) {
    // Genre confidence bonus
    if (wave8.genre.confidence > 0.7) score += 0.1;
    
    // Section-appropriate bonus
    if ((wave8.section.type === 'drop' || wave8.section.type === 'chorus') && analysis.energy > 0.7) {
      score += 0.1;
    }
    
    // Harmony coherence
    if (wave8.harmony.confidence > 0.6) score += 0.05;
  }
  
  return Math.min(1, score);
}

// ============================================
// HEALTH REPORTING
// ============================================

function generateHealthReport(): WorkerHealth {
  const uptime = Date.now() - state.startTime;
  const memUsage = process.memoryUsage();
  
  let status: WorkerHealth['status'] = 'healthy';
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    status = 'critical';
  } else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
    status = 'degraded';
  }
  
  return {
    nodeId: NODE_ID,
    timestamp: Date.now(),
    cpuUsage: 0,
    memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    messagesProcessed: state.messagesProcessed,
    messagesPerSecond: state.messagesProcessed / (uptime / 1000),
    avgProcessingTime: state.messagesProcessed > 0 
      ? state.totalProcessingTime / state.messagesProcessed 
      : 0,
    status,
    lastError: state.errors[state.errors.length - 1],
    uptime,
    decisionsGenerated: state.decisionCount
  };
}

// ============================================
// STATE SNAPSHOT (For Phoenix Protocol)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createStateSnapshot(): unknown {
  return {
    frameCount: state.frameCount,
    decisionCount: state.decisionCount,
    // Wave 8 Pure - save generated palette (can be regenerated on restore)
    currentPalette: state.currentPalette,
    currentMoodHint: state.currentMoodHint,
    currentMovement: state.currentMovement,
    operationMode: state.operationMode,
    combinedConfidence: state.combinedConfidence,
    personality: { ...personality },
    learnedPatterns: Array.from(state.learnedPatterns.entries())
  };
}

function restoreStateSnapshot(snapshot: unknown): void {
  if (typeof snapshot === 'object' && snapshot !== null) {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.frameCount === 'number') state.frameCount = s.frameCount;
    if (typeof s.decisionCount === 'number') state.decisionCount = s.decisionCount;
    if (typeof s.currentMoodHint === 'string') {
      state.currentMoodHint = s.currentMoodHint;
      // Regenerate palette from mood hint (procedural, not stored)
      state.currentPalette = paletteGenerator.generate(
        s.currentMoodHint as 'happy' | 'sad' | 'tense' | 'dreamy' | 'bluesy' | 'jazzy' | 'spanish_exotic' | 'universal',
        0.5, 0, null
      );
    }
    if (s.personality && typeof s.personality === 'object') {
      Object.assign(personality, s.personality);
    }
    if (Array.isArray(s.learnedPatterns)) {
      state.learnedPatterns = new Map(s.learnedPatterns);
    }
  }
  console.log(`[GAMMA] State restored: ${state.decisionCount} decisions, mood: ${personality.currentMood}`);
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(message: WorkerMessage): void {
  try {
    switch (message.type) {
      case MessageType.INIT:
        state.isRunning = true;
        state.startTime = Date.now();
        console.log('[GAMMA] 🧠 Mind initialized');
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;
        
      case MessageType.SHUTDOWN:
        console.log('[GAMMA] Shutting down...');
        state.isRunning = false;
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        process.exit(0);
        break;
        
      case MessageType.HEARTBEAT:
        const hbPayload = message.payload as HeartbeatPayload;
        const ackPayload: HeartbeatAckPayload = {
          originalTimestamp: hbPayload.timestamp,
          ackTimestamp: Date.now(),
          sequence: hbPayload.sequence,
          latency: Date.now() - hbPayload.timestamp
        };
        sendMessage(MessageType.HEARTBEAT_ACK, 'alpha', ackPayload, MessagePriority.HIGH);
        state.lastHeartbeat = Date.now();
        break;
        
      case MessageType.HEALTH_REQUEST:
        sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
        break;
        
      case MessageType.AUDIO_ANALYSIS:
        if (!state.isRunning) break;
        const analysis = message.payload;
        if (isAudioAnalysis(analysis)) {
          const decision = generateDecision(analysis);
          sendMessage(
            MessageType.LIGHTING_DECISION,
            'alpha',
            decision,
            analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL
          );
        }
        break;
        
      case MessageType.STATE_RESTORE:
        const snapshot = message.payload as { state: unknown };
        restoreStateSnapshot(snapshot.state);
        break;
        
      case MessageType.CONFIG_UPDATE:
        Object.assign(config, message.payload);
        console.log('[GAMMA] Config updated');
        break;
      
      // 🧠 WAVE 10: Brain Control Messages
      case MessageType.SET_MODE: {
        const modePayload = message.payload as { mode: 'reactive' | 'intelligent' | 'forced' };
        if (modePayload.mode === 'intelligent' || modePayload.mode === 'forced') {
          state.brainForced = true;
          state.operationMode = 'intelligent';
          console.log('[GAMMA] 🧠 BRAIN MODE ACTIVATED - Full AI control');
        } else {
          state.brainForced = false;
          state.operationMode = 'reactive';
          console.log('[GAMMA] 🔄 REACTIVE MODE - Simple audio response');
        }
        break;
      }
      
      case MessageType.ENABLE_BRAIN:
        state.brainForced = true;
        state.operationMode = 'intelligent';
        console.log('[GAMMA] ⚡ ENABLE_BRAIN received!');
        console.log('[GAMMA] 🎵 GenreClassifier: HUNTING for Cumbia/Reggaeton...');
        console.log('[GAMMA] 🧬 EvolutionEngine: MUTATING palettes...');
        console.log('[GAMMA] 👁️ StalkingEngine: WATCHING the music...');
        break;
      
      case MessageType.DISABLE_BRAIN:
        state.brainForced = false;
        state.operationMode = 'reactive';
        console.log('[GAMMA] 💤 Brain disabled - Reactive mode active');
        break;
        
      default:
        console.warn(`[GAMMA] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push(errorMsg);
    console.error(`[GAMMA] Error handling ${message.type}:`, errorMsg);
    
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: errorMsg,
      messageType: message.type
    }, MessagePriority.CRITICAL);
  }
}

// ============================================
// SEND MESSAGE
// ============================================

function sendMessage<T>(
  type: MessageType,
  target: 'alpha' | 'beta' | 'broadcast',
  payload: T,
  priority: MessagePriority = MessagePriority.NORMAL
): void {
  const message = createMessage(type, NODE_ID, target, payload, priority);
  parentPort?.postMessage(message);
}

// ============================================
// MAIN LISTENER
// ============================================

if (parentPort) {
  parentPort.on('message', handleMessage);
  
  console.log('[GAMMA] 🧠 Worker thread started, waiting for INIT...');
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[GAMMA] Uncaught exception:', error);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: error.message,
      fatal: true
    }, MessagePriority.CRITICAL);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('[GAMMA] Unhandled rejection:', reason);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: String(reason),
      fatal: false
    }, MessagePriority.CRITICAL);
  });
} else {
  console.error('[GAMMA] No parentPort - not running as worker thread!');
  process.exit(1);
}

// ============================================
// PERIODIC HEALTH REPORT
// ============================================

setInterval(() => {
  if (state.isRunning) {
    sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
  }
}, 5000);
