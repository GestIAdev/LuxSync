/**
 * 🧠 GAMMA WORKER - MIND (Pure Musical Analyst)
 * 
 * 🔪 WAVE 230.5: OPERATION CLEAN SWEEP
 * 
 * Worker Thread dedicado al ANÁLISIS MUSICAL PURO.
 * Este Worker ya NO genera colores ni LightingDecisions.
 * Solo analiza audio y emite MusicalContext para TITAN 2.0.
 * 
 * V2 O NADA - La lógica de color vive ahora en TitanEngine/ColorLogic.
 * 
 * Recibe AudioAnalysis+Wave8Data de ALPHA (via BETA).
 * Envía MusicalContext a ALPHA para TitanEngine.
 */

// 🔇 WAVE 37.0: Silencio Táctico - Solo logs de alto nivel
const DEBUG_VERBOSE = false;

import { parentPort, workerData } from 'worker_threads';
import {
  WorkerMessage,
  MessageType,
  MessagePriority,
  AudioAnalysis,
  WorkerHealth,
  HeartbeatPayload,
  HeartbeatAckPayload,
  createMessage,
  TrinityConfig,
  DEFAULT_CONFIG,
  isAudioAnalysis
} from './WorkerProtocol';

// 🧠 WAVE 230: THE LOBOTOMY - MusicalContext para TITAN 2.0
import { 
  MusicalContext, 
  createDefaultMusicalContext,
  // 🔬 WAVE 1026: Nuevos contextos
  createDefaultSpectralContext,
  createDefaultNarrativeContext,
  deriveSpectralTexture,
  type SpectralContext,
  type NarrativeContext,
} from '../core/protocol/MusicalContext';

// Wave 8 Bridge imports - Solo tipos, no funciones de color
import {
  RhythmOutput,
  HarmonyOutput,
  SectionOutput,
  GenreOutput,
} from './TrinityBridge';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'gamma' as const;

// ============================================
// 🔪 WAVE 230.5: OPERATION CLEAN SWEEP
// All color-related code has been REMOVED:
// - SeleneColorEngine, SeleneColorInterpolator - GONE
// - KeyStabilizer, MoodArbiter, StrategyArbiter - GONE  
// - VibeManager, ColorConstitution - GONE
// - generateDecision(), calculateBeautyScore() - GONE
// - All palette, movement, effects logic - GONE
//
// This Worker is now a PURE MUSICAL ANALYST.
// ============================================

// ============================================
// STATE (Minimal - No Color Logic)
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
  isPaused: boolean;
  frameCount: number;
  startTime: number;
  lastHeartbeat: number;
  
  // Performance
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
  
  // 🎯 WAVE 289: Vibe-Aware Section Tracking
  activeVibeId: string;
}

const state: GammaState = {
  isRunning: false,
  isPaused: false,
  frameCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: [],
  
  // 🎯 WAVE 289: Default vibe
  activeVibeId: 'techno'
};

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 230.5: THE REAL LOBOTOMY - Extract Pure Musical Context
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Extrae MusicalContext PURO desde el análisis de audio.
 *
 * Esta función NO decide colores ni efectos. Solo describe:
 * - QUÉ tonalidad se detecta (key, mode)
 * - QUÉ ritmo hay (bpm, syncopation, beatPhase)
 * - QUÉ sección es (verse, drop, chorus, etc.)
 * - QUÉ género parece (electronic, latin, rock)
 * - QUÉ mood emocional tiene (euphoric, melancholic, etc.)
 *
 * TITAN 2.0 usará esto para que ColorLogic decida los colores.
 */
function extractMusicalContext(analysis: ExtendedAudioAnalysis): MusicalContext {
  const wave8 = analysis.wave8;
  
  // Sin wave8 data → contexto por defecto
  if (!wave8) {
    return createDefaultMusicalContext();
  }
  
  const { rhythm, harmony, section, genre } = wave8;
  
  // ═══════════════════════════════════════════════════════════════════════
  // MAPEO: wave8 → MusicalContext
  // ═══════════════════════════════════════════════════════════════════════
  
  // Key: harmony.key ya es string ('A', 'D#', etc.) o null
  const key = harmony.key as MusicalContext['key'];
  
  // Mode: harmony.mode puede ser 'major', 'minor', o algo más
  const mode: MusicalContext['mode'] = 
    harmony.mode === 'major' ? 'major' :
    harmony.mode === 'minor' ? 'minor' : 'unknown';
  
  // Section: section.type → SectionType
  const sectionType = section.type as MusicalContext['section']['type'];
  
  // Mood: Mapear harmony.mood y genre mood a los moods de MusicalContext
  const genreMood = (genre as any).mood ?? null;
  const harmonyMood = harmony.mood ?? null;
  
  // 🌉 WAVE 260.5: Mapear TODOS los moods posibles de HarmonyOutput
  // HarmonyOutput moods: happy, sad, tense, dreamy, bluesy, jazzy, spanish_exotic, universal
  // MusicalContext moods: euphoric, melancholic, aggressive, dreamy, neutral, mysterious, triumphant
  let mood: MusicalContext['mood'] = 'neutral';
  const rawMood = genreMood || harmonyMood || 'neutral';
  const sectionEnergy = section.energy ?? 0;
  
  if (rawMood === 'happy' || rawMood === 'energetic' || rawMood === 'euphoric') {
    mood = 'euphoric';
  } else if (rawMood === 'sad' || rawMood === 'melancholic' || rawMood === 'bluesy') {
    // 🎵 bluesy = melancolía con groove
    mood = 'melancholic';
  } else if (rawMood === 'tense' || rawMood === 'aggressive' || rawMood === 'dark') {
    mood = 'aggressive';
  } else if (rawMood === 'dreamy' || rawMood === 'chill' || rawMood === 'calm') {
    mood = 'dreamy';
  } else if (rawMood === 'mysterious' || rawMood === 'jazzy') {
    mood = 'mysterious';
  } else if (rawMood === 'triumphant' || rawMood === 'heroic' || rawMood === 'spanish_exotic') {
    // 🎵 spanish_exotic = pasión/triunfo
    mood = 'triumphant';
  } else if (rawMood === 'universal' || rawMood === 'neutral') {
    // 🌉 WAVE 260.5: 'universal' = el detector no está seguro
    // Usar energía de sección para decidir
    if (sectionEnergy > 0.7) {
      mood = 'euphoric';
    } else if (sectionEnergy > 0.4) {
      mood = 'neutral';
    } else {
      mood = 'dreamy';
    }
  }
  
  // Genre: Mapear a MacroGenre
  const genreName = ((genre as any).genre ?? (genre as any).primary ?? 'unknown').toUpperCase();
  let macro: MusicalContext['genre']['macro'] = 'UNKNOWN';
  
  if (genreName.includes('ELECTRONIC') || genreName.includes('TECHNO') || 
      genreName.includes('HOUSE') || genreName.includes('EDM')) {
    macro = 'ELECTRONIC';
  } else if (genreName.includes('LATIN') || genreName.includes('REGGAETON') || 
             genreName.includes('CUMBIA') || genreName.includes('SALSA')) {
    macro = 'LATIN';
  } else if (genreName.includes('ROCK') || genreName.includes('METAL')) {
    macro = 'ROCK';
  } else if (genreName.includes('POP')) {
    macro = 'POP';
  } else if (genreName.includes('CHILL') || genreName.includes('AMBIENT') || 
             genreName.includes('LOUNGE')) {
    macro = 'CHILL';
  }
  
  // Calcular confianza combinada
  const combinedConfidence = 
    rhythm.confidence * 0.45 +
    harmony.confidence * 0.30 +
    section.confidence * 0.25;
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 1026: THE ROSETTA STONE - Poblar SpectralContext
  // ═══════════════════════════════════════════════════════════════════════
  const spectral: SpectralContext = buildSpectralContext(analysis);
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 1026: Poblar NarrativeContext (desde SectionTracker si disponible)
  // ═══════════════════════════════════════════════════════════════════════
  const narrative: NarrativeContext = buildNarrativeContext(section, analysis.energy);
  
  return {
    key,
    mode,
    bpm: analysis.bpm,
    beatPhase: analysis.beatPhase,
    syncopation: rhythm.syncopation,
    section: {
      type: sectionType,
      current: sectionType,
      confidence: section.confidence,
      duration: 0,
      isTransition: section.type === 'buildup' || section.type === 'breakdown',
    },
    energy: analysis.energy,
    mood,
    genre: {
      macro,
      subGenre: genreName !== macro ? genreName.toLowerCase() : null,
      confidence: genre.confidence,
    },
    // 🔬 WAVE 1026: Nuevos contextos
    spectral,
    narrative,
    confidence: combinedConfidence,
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 WAVE 1026: SPECTRAL CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye SpectralContext desde el AudioAnalysis con datos del God Ear FFT
 */
function buildSpectralContext(analysis: ExtendedAudioAnalysis): SpectralContext {
  // Obtener métricas espectrales del analysis (vienen de senses.ts / GodEarFFT)
  // Usamos 'as any' porque estas propiedades existen en runtime pero
  // el tipo AudioAnalysis del WorkerProtocol aún no las incluye todas
  const extendedAnalysis = analysis as any;
  
  const clarity = extendedAnalysis.clarity ?? 0.5;
  const flatness = extendedAnalysis.spectralFlatness ?? 0;
  const centroid = extendedAnalysis.spectralCentroid ?? 440;
  const harshness = extendedAnalysis.harshness ?? 0;
  
  // Derivar textura usando la lógica de WAVE 1026
  const texture = deriveSpectralTexture(harshness, clarity, centroid);
  
  // Obtener las 7 bandas tácticas
  const bands = {
    subBass: extendedAnalysis.subBass ?? 0,
    bass: analysis.bass ?? 0,
    lowMid: extendedAnalysis.lowMid ?? 0,
    mid: analysis.mid ?? 0,
    highMid: extendedAnalysis.highMid ?? 0,
    treble: analysis.treble ?? 0,
    // 🆕 WAVE 1026: ultraAir - fallback a treble * 0.3 si no disponible
    ultraAir: extendedAnalysis.ultraAir ?? (analysis.treble * 0.3),
  };
  
  return {
    clarity,
    texture,
    flatness,
    centroid,
    harshness,
    bands,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎬 WAVE 1026: NARRATIVE CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye NarrativeContext desde SectionOutput
 * 
 * Nota: Los valores avanzados (buildupScore, relativeEnergy, consensus)
 * vendrán del SectionTracker WAVE 1024 cuando se integre completamente.
 * Por ahora usamos estimaciones basadas en section.type.
 */
function buildNarrativeContext(section: any, energy: number): NarrativeContext {
  // Estimar buildupScore basado en tipo de sección
  let buildupScore = 0;
  if (section.type === 'buildup') {
    buildupScore = 0.8;  // Alta probabilidad de drop inminente
  } else if (section.type === 'verse' && energy > 0.5) {
    buildupScore = 0.3;  // Posible transición
  }
  
  // Por ahora relativeEnergy = energy (sin normalización de ventana)
  // TODO: Integrar SectionTracker.calculateRelativeEnergy() cuando Trinity Bridge lo soporte
  const relativeEnergy = energy;
  
  // Consenso: null por ahora hasta que SectionTracker lo proporcione
  // TODO: Integrar SectionTracker.calculateConsensusVote()
  const consensus = null;
  
  return {
    buildupScore,
    relativeEnergy,
    consensus,
    slidingWindow: {
      localMin: 0,
      localMax: 1,
      sampleCount: 0,
    },
  };
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
    uptime
  };
}

// ============================================
// MESSAGE HANDLER
// ============================================

function handleMessage(message: WorkerMessage): void {
  const startTime = performance.now();
  
  try {
    switch (message.type) {
      case MessageType.INIT:
        state.isRunning = true;
        state.startTime = Date.now();
        console.log('[GAMMA] 🧠 WAVE 230.5: Pure Musical Analyst INITIALIZED');
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;
        
      case MessageType.SHUTDOWN:
        state.isRunning = false;
        console.log('[GAMMA] 🧠 Shutting down...');
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
        if (state.isPaused) break;
        
        const analysis = message.payload as ExtendedAudioAnalysis;
        state.frameCount++;
        
        // 🔍 Log cada 60 frames (~1 segundo)
        if (state.frameCount % 60 === 0) {
          console.log(`[GAMMA 🎵] Frame ${state.frameCount}: bpm=${analysis.bpm?.toFixed(0)}, energy=${analysis.energy?.toFixed(2)}`);
        }
        
        if (isAudioAnalysis(analysis)) {
          // 🧠 WAVE 230.5: SOLO EMITIR MUSICAL_CONTEXT
          // NO hay LightingDecision, NO hay generateDecision()
          const musicalContext = extractMusicalContext(analysis);
          
          sendMessage(
            MessageType.MUSICAL_CONTEXT,
            'alpha',
            musicalContext,
            MessagePriority.NORMAL
          );
          
          state.messagesProcessed++;
        }
        break;
        
      case MessageType.CONFIG_UPDATE:
        Object.assign(config, message.payload);
        if (DEBUG_VERBOSE) console.log('[GAMMA] Config updated');
        break;
      
      // 🔌 WAVE 63.95: System Power Control
      case MessageType.SYSTEM_SLEEP:
        console.log('[GAMMA] 💤 SYSTEM SLEEP - Pausing analysis');
        state.isPaused = true;
        break;
        
      case MessageType.SYSTEM_WAKE:
        console.log('[GAMMA] ☀️ SYSTEM WAKE - Resuming analysis');
        state.isPaused = false;
        break;
      
      // 🎯 WAVE 289: Vibe-Aware Section Tracking
      case MessageType.SET_VIBE:
        const vibePayload = message.payload as { vibeId: string };
        state.activeVibeId = vibePayload.vibeId;
        console.log(`[GAMMA] 🎯 WAVE 289: Vibe set to ${vibePayload.vibeId}`);
        // El vibeId se usará cuando los Workers tengan SectionTracker vibe-aware
        // Por ahora solo almacenamos el estado
        break;
        
      default:
        // Ignorar mensajes legacy no manejados
        if (DEBUG_VERBOSE) {
          console.log(`[GAMMA] Ignoring legacy message: ${message.type}`);
        }
    }
    
    state.totalProcessingTime += performance.now() - startTime;
    
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
  
  console.log('[GAMMA] 🧠 WAVE 230.5: Pure Musical Analyst ready');
  
  // Handle uncaught errors
  (process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
    console.error('[GAMMA] Uncaught exception:', error);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: error.message,
      fatal: true
    }, MessagePriority.CRITICAL);
  });
  
  (process as NodeJS.EventEmitter).on('unhandledRejection', (reason: unknown) => {
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
