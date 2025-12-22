/**
 * 👂 BETA WORKER - SENSES (Audio Analysis)
 * 
 * Worker Thread dedicado al análisis de audio en tiempo real.
 * 
 * TRINITY PHASE 1: Integrado con motores Wave 8 vía TrinityBridge
 * 
 * Procesa buffers de audio y extrae:
 * - Beat detection (BPM, on-beat)
 * - Rhythm analysis (subdivision, groove, SYNCOPATION)  ← REGLA 3
 * - Spectrum analysis (bass, mid, treble)
 * - Harmony detection (mood, temperature)
 * - Section tracking (intro, verse, chorus, drop)
 * - Genre hints (para GAMMA)
 * 
 * Comunica con ALPHA vía postMessage.
 * GAMMA (mind) nunca habla directamente con BETA.
 */

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
  DEFAULT_CONFIG
} from './WorkerProtocol';

// 🧮 WAVE 15: FFT REAL - Matemática pura, sin simulaciones
import { FFTAnalyzer, BandEnergy } from './FFT';

// Wave 8 Bridge - Analizadores simplificados para Worker
import {
  SimpleRhythmDetector,
  SimpleHarmonyDetector,
  SimpleSectionTracker,
  AudioMetrics,
  RhythmOutput,
  HarmonyOutput,
  SectionOutput,
  GenreOutput,  // 🗑️ WAVE 61: Type kept for protocol compatibility, classifier eliminated
} from './TrinityBridge';

// 🎛️ WAVE 61: LEGACY ELIMINATION
// ===================================
// La detección de género (SimpleBinaryBias/SimpleGenreClassifier) ha sido ELIMINADA.
// El Vibe es seleccionado MANUALMENTE por el DJ via VibeManager en GAMMA.
//
// FILOSOFÍA: "El DJ sabe qué está pinchando. Selene opera dentro del contexto."
// ===================================

// 🎯 WAVE 16: Normalización adaptativa de energía
import { getEnergyNormalizer } from './utils/AdaptiveEnergyNormalizer';

// 🌈 WAVE 47.1: MoodSynthesizer - VAD Emotional Analysis
import { MoodSynthesizer } from '../selene-lux-core/engines/consciousness/MoodSynthesizer';

// ============================================
// CONFIGURATION
// ============================================

const config: TrinityConfig = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'beta' as const;

// ============================================
// STATE
// ============================================

interface BetaState {
  isRunning: boolean;
  frameCount: number;
  startTime: number;
  lastHeartbeat: number;
  heartbeatSequence: number;
  
  // Audio state
  currentBpm: number;
  bpmHistory: number[];
  beatPhase: number;
  lastBeatTime: number;
  
  // Wave 8 Analysis Outputs (cached for GAMMA)
  lastRhythmOutput: RhythmOutput | null;
  lastHarmonyOutput: HarmonyOutput | null;
  lastSectionOutput: SectionOutput | null;
  lastGenreOutput: GenreOutput | null;
  
  // Performance metrics
  messagesProcessed: number;
  totalProcessingTime: number;
  errors: string[];
}

const state: BetaState = {
  isRunning: false,
  frameCount: 0,
  startTime: Date.now(),
  lastHeartbeat: Date.now(),
  heartbeatSequence: 0,
  
  currentBpm: 120,
  bpmHistory: [],
  beatPhase: 0,
  lastBeatTime: Date.now(),
  
  // Wave 8 outputs
  lastRhythmOutput: null,
  lastHarmonyOutput: null,
  lastSectionOutput: null,
  lastGenreOutput: null,
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: []
};

// ============================================
// BEAT DETECTION
// ============================================

class BeatDetector {
  private readonly historySize = 43; // ~1 second at 44100Hz/1024 samples
  private energyHistory: number[] = [];
  private lastPeakTime = 0;
  private beatIntervals: number[] = [];
  
  // 🚑 RESCUE DIRECTIVE: AGC (Auto-Gain Control)
  private maxEnergyHistory: number[] = [];
  private readonly maxEnergyWindowSize = 1290; // ~30 seconds at 43 frames/sec
  private currentMaxEnergy = 0.01; // Start with small value to avoid division by zero
  
  analyze(buffer: Float32Array, _sampleRate: number): {
    onBeat: boolean;
    beatStrength: number;
    bpm: number;
    confidence: number;
  } {
    const now = Date.now();
    
    // Calculate energy (RMS)
    let energy = 0;
    for (let i = 0; i < buffer.length; i++) {
      energy += buffer[i] * buffer[i];
    }
    energy = Math.sqrt(energy / buffer.length);
    
    // 🚑 RESCUE DIRECTIVE: AGC - Track max energy over 30 seconds
    this.maxEnergyHistory.push(energy);
    if (this.maxEnergyHistory.length > this.maxEnergyWindowSize) {
      this.maxEnergyHistory.shift();
    }
    
    // Update current max (use 95th percentile to avoid outlier spikes)
    if (this.maxEnergyHistory.length > 10) {
      const sorted = [...this.maxEnergyHistory].sort((a, b) => b - a);
      const percentile95Index = Math.floor(sorted.length * 0.05);
      this.currentMaxEnergy = Math.max(0.01, sorted[percentile95Index]);
    }
    
    // Normalize energy to 0-1 range based on dynamic max
    const normalizedEnergy = Math.min(1, energy / this.currentMaxEnergy);
    
    // Add to history (use normalized energy for beat detection)
    this.energyHistory.push(normalizedEnergy);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }
    
    // Calculate average and threshold
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const threshold = avgEnergy * 1.5;
    
    // Detect peak (beat) - use normalized energy
    const onBeat = normalizedEnergy > threshold && (now - this.lastPeakTime) > 200; // Min 200ms between beats
    
    if (onBeat) {
      // Calculate interval since last beat
      if (this.lastPeakTime > 0) {
        const interval = now - this.lastPeakTime;
        this.beatIntervals.push(interval);
        if (this.beatIntervals.length > 16) {
          this.beatIntervals.shift();
        }
      }
      this.lastPeakTime = now;
    }
    
    // Calculate BPM from intervals
    let bpm = 120; // default
    let confidence = 0;
    
    if (this.beatIntervals.length >= 4) {
      const avgInterval = this.beatIntervals.reduce((a, b) => a + b, 0) / this.beatIntervals.length;
      bpm = Math.round(60000 / avgInterval);
      
      // Clamp to reasonable range
      bpm = Math.max(60, Math.min(200, bpm));
      
      // Calculate confidence based on interval consistency
      const variance = this.beatIntervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / this.beatIntervals.length;
      const stdDev = Math.sqrt(variance);
      confidence = Math.max(0, 1 - (stdDev / avgInterval));
    }
    
    return {
      onBeat,
      beatStrength: Math.min(1, normalizedEnergy / (avgEnergy * 2)), // Use normalized energy
      bpm,
      confidence
    };
  }
}

// ============================================
// SPECTRUM ANALYZER - 🧮 WAVE 15: FFT REAL
// ============================================

/**
 * Analizador espectral usando FFT matemático puro (Cooley-Tukey).
 * 
 * WAVE 15: Reemplaza la versión anterior que solo dividía el buffer
 * por índice sin hacer análisis de frecuencia real.
 * 
 * Ahora usa transformada de Fourier para obtener:
 * - Energía real en bandas de frecuencia (20-250Hz = bass, etc.)
 * - Detección de kicks, snares, hi-hats
 * - Centroide espectral para "brillo" tonal
 */
class SpectrumAnalyzer {
  private readonly fftAnalyzer: FFTAnalyzer;
  private lastSpectralFlux: number = 0;
  private prevEnergy: number = 0;
  
  constructor(sampleRate: number = 44100) {
    // FFT con 2048 muestras para buena resolución en graves
    this.fftAnalyzer = new FFTAnalyzer(sampleRate, 2048);
    console.log('[BETA] 🧮 FFT Analyzer initialized (Cooley-Tukey Radix-2)');
  }
  
  analyze(buffer: Float32Array, sampleRate: number): {
    bass: number;
    mid: number;
    treble: number;
    spectralCentroid: number;
    spectralFlux: number;
    // 🧮 WAVE 15: Datos adicionales del FFT real
    subBass: number;
    lowMid: number;
    highMid: number;
    dominantFrequency: number;
    kickDetected: boolean;
    snareDetected: boolean;
    hihatDetected: boolean;
    // 🤖 WAVE 50.1: Texture-based detection
    harshness: number;
    spectralFlatness: number;
  } {
    // 🧮 Ejecutar FFT REAL
    const fftResult = this.fftAnalyzer.analyze(buffer);
    
    // Calcular flujo espectral (cambio de energía total)
    const currentEnergy = fftResult.bass + fftResult.mid + fftResult.treble;
    const spectralFlux = Math.min(1, Math.abs(currentEnergy - this.prevEnergy) * 2);
    this.prevEnergy = currentEnergy;
    
    return {
      // Bandas principales (normalizadas 0-1)
      bass: fftResult.bass,
      mid: fftResult.mid,
      treble: fftResult.treble,
      
      // Métricas espectrales
      spectralCentroid: Math.min(1, fftResult.spectralCentroid / 10000), // Normalizar
      spectralFlux,
      
      // 🧮 WAVE 15: Datos adicionales para análisis avanzado
      subBass: fftResult.subBass,
      lowMid: fftResult.lowMid,
      highMid: fftResult.highMid,
      dominantFrequency: fftResult.dominantFrequency,
      kickDetected: fftResult.kickDetected,
      snareDetected: fftResult.snareDetected,
      hihatDetected: fftResult.hihatDetected,
      
      // 🤖 WAVE 50.1: Texture-based detection (Skrillex/DnB)
      harshness: fftResult.harshness,
      spectralFlatness: fftResult.spectralFlatness,
    };
  }
  
  reset(): void {
    this.fftAnalyzer.reset();
    this.prevEnergy = 0;
  }
}

// ============================================
// MAIN ANALYZERS - WAVE 8 INTEGRATION
// ============================================

const beatDetector = new BeatDetector();
const spectrumAnalyzer = new SpectrumAnalyzer(config.audioSampleRate); // 🧮 WAVE 15: Con sample rate real

// Wave 8 Analyzers (from TrinityBridge)
const rhythmDetector = new SimpleRhythmDetector();
const harmonyDetector = new SimpleHarmonyDetector();
const sectionTracker = new SimpleSectionTracker();
// 🗑️ WAVE 61: genreClassifier ELIMINADO - VibeManager en GAMMA es el nuevo dueño del contexto

// 🌈 WAVE 47.1: MoodSynthesizer - Emotional tone analysis
const moodSynthesizer = new MoodSynthesizer();
console.log('[BETA] 🌈 MoodSynthesizer initialized (VAD Model)');

// ============================================
// AUDIO PROCESSING - WAVE 8 INTEGRATED
// ============================================

/**
 * Extended AudioAnalysis with Wave 8 data
 * This gets sent to GAMMA for intelligent decisions
 */
interface ExtendedAudioAnalysis extends AudioAnalysis {
  // Wave 8 Rich Analysis (attached as metadata)
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
    // 🌈 WAVE 47.1: MoodSynthesizer output
    mood?: {
      primary: string;
      secondary: string | null;
      valence: number;
      arousal: number;
      dominance: number;
      intensity: number;
      stability: number;
    };
  };
}

function processAudioBuffer(buffer: Float32Array): ExtendedAudioAnalysis {
  const startTime = performance.now();
  state.frameCount++;
  
  // 🎯 WAVE 14/15: Apply Input Gain (CRITICAL FIX)
  // Si la señal es débil, los analizadores (Spectrum, Rhythm) ven "silencio".
  // El BeatDetector tiene su propio AGC, pero el resto NO.
  // Aplicamos el gain AQUÍ para que afecte a TODO el pipeline.
  const gain = config.inputGain ?? 1.0;
  
  // � WAVE 39.5: DIAGNOSTIC logs silenciados (spam)
  // Solo activar para debugging con DEBUG_VERBOSE
  // if (state.frameCount % 60 === 0) {
  //   let rawRms = 0;
  //   for (let i = 0; i < buffer.length; i++) { rawRms += buffer[i] * buffer[i]; }
  //   rawRms = Math.sqrt(rawRms / buffer.length);
  //   console.log(`[BETA 🎚️] Frame ${state.frameCount}: RawRMS=${rawRms.toFixed(4)}`);
  // }
  
  if (gain !== 1.0) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
  
  // === PHASE 1: Basic Beat Detection ===
  const beatResult = beatDetector.analyze(buffer, config.audioSampleRate);
  
  // Update BPM smoothing
  if (beatResult.confidence > 0.5) {
    state.bpmHistory.push(beatResult.bpm);
    if (state.bpmHistory.length > 10) {
      state.bpmHistory.shift();
    }
    state.currentBpm = Math.round(
      state.bpmHistory.reduce((a, b) => a + b, 0) / state.bpmHistory.length
    );
  }
  
  // Update beat phase (0-1 within current beat)
  const beatInterval = 60000 / state.currentBpm;
  const timeSinceLastBeat = Date.now() - state.lastBeatTime;
  state.beatPhase = (timeSinceLastBeat % beatInterval) / beatInterval;
  
  if (beatResult.onBeat) {
    state.lastBeatTime = Date.now();
  }
  
  // === PHASE 2: Spectrum Analysis (🧮 FFT REAL) ===
  const spectrum = spectrumAnalyzer.analyze(buffer, config.audioSampleRate);
  
  // Calculate overall energy (weighted by perceptual importance)
  const rawEnergy = (spectrum.bass * 0.5 + spectrum.mid * 0.3 + spectrum.treble * 0.2);
  
  // 🎯 WAVE 16: Normalizar energía con Rolling Peak 15s
  // Esto auto-ajusta la sensibilidad según el nivel de la canción
  const energyNormalizer = getEnergyNormalizer();
  const normalizedEnergy = energyNormalizer.normalize(rawEnergy);
  const energy = normalizedEnergy; // Usar energía normalizada en todo el pipeline
  
  // � WAVE 39.5: DIAGNOSTIC silenciado (spam)
  // if (state.frameCount % 60 === 0) {
  //   const gain = config.inputGain || 1.0;
  //   const normStats = energyNormalizer.getStats();
  //   console.log(`[BETA 🧮] FFT: bass=... normE=...`);
  // }
  
  // === PHASE 3: Wave 8 Rich Analysis ===
  // Create AudioMetrics for Wave 8 analyzers
  const audioMetrics: AudioMetrics = {
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    volume: energy,
    bpm: state.currentBpm,
    bpmConfidence: beatResult.confidence,
    onBeat: beatResult.onBeat || spectrum.kickDetected, // 🧮 Use FFT kick detection too
    beatPhase: state.beatPhase,
    timestamp: Date.now(),
    // 🎵 WAVE 15.5: Para Key detection
    dominantFrequency: spectrum.dominantFrequency,
    // 🤖 WAVE 50.1: Texture-based detection para Skrillex/DnB
    subBass: spectrum.subBass,
    harshness: spectrum.harshness,
    spectralFlatness: spectrum.spectralFlatness,
    spectralCentroid: spectrum.spectralCentroid,
  };
  
  // Run Wave 8 analyzers
  const rhythmOutput = rhythmDetector.analyze(audioMetrics);
  const harmonyOutput = harmonyDetector.analyze(audioMetrics);
  const sectionOutput = sectionTracker.analyze(audioMetrics, rhythmOutput);
  
  // 🌈 WAVE 47.1: MoodSynthesizer - VAD emotional analysis
  const beatState = {
    bpm: state.currentBpm,
    confidence: beatResult.confidence,
    onBeat: beatResult.onBeat,
    phase: state.beatPhase,
    beatCount: Math.floor((Date.now() - state.startTime) / (60000 / state.currentBpm))
  };
  
  // Adapt AudioMetrics for MoodSynthesizer (different type signature)
  const metricsForMood = {
    ...audioMetrics,
    energy: energy,  // MoodSynthesizer expects 'energy' not 'volume'
    beatConfidence: beatResult.confidence,
    peak: energy,
    frameIndex: state.frameCount
  };
  const moodOutput = moodSynthesizer.process(metricsForMood as any, beatState as any);
  
  // 🗑️ WAVE 61: GenreClassifier ELIMINADO
  // El contexto musical ahora es determinado por VibeManager en GAMMA (selección manual del DJ)
  // Generamos un GenreOutput neutro para compatibilidad con el protocolo
  const genreOutput: GenreOutput = {
    primary: 'ELECTRONIC_4X4',  // Default neutral
    secondary: null,
    confidence: 0,  // Zero confidence = "no genre detection"
    scores: { ELECTRONIC_4X4: 0.5, LATINO_TRADICIONAL: 0.5 },
    genre: 'ELECTRONIC_4X4',
    subgenre: 'none' as const,
    features: {
      bpm: state.currentBpm,
      syncopation: rhythmOutput.syncopation ?? 0,
      hasFourOnFloor: rhythmOutput.pattern === 'four_on_floor',
      hasDembow: false,
      trebleDensity: 0,
      has808Bass: false,
      avgEnergy: energy,
    },
    mood: 'neutral' as any,  // Neutral mood = let VibeManager decide
  };
  
  // 🔇 WAVE 39.5: DEBUG silenciado - genera demasiado spam
  // if (state.frameCount % 120 === 0) {
  //   console.log('[SENSES DEBUG] genreOutput:', JSON.stringify({...}));
  // }
  
  // 🧹 WAVE 63: BETA HEARTBEAT eliminado - generaba spam de logs cada 5 segundos
  // Los datos de ritmo/armonía se transmiten vía broadcast, no necesitan log constante
  // Se mantienen solo logs de inicialización, errores y cambios de estado
  
  // Cache for state snapshots
  state.lastRhythmOutput = rhythmOutput;
  state.lastHarmonyOutput = harmonyOutput;
  state.lastSectionOutput = sectionOutput;
  state.lastGenreOutput = genreOutput as any;  // GenreAnalysis casted to GenreOutput for compatibility
  
  // === PHASE 4: Build Response ===
  // Mood from Wave 8 harmony (richer than simple bass/treble)
  let mood: 'dark' | 'bright' | 'neutral' = 'neutral';
  if (harmonyOutput.temperature === 'cool') mood = 'dark';
  else if (harmonyOutput.temperature === 'warm') mood = 'bright';
  
  // Track processing time
  state.totalProcessingTime += performance.now() - startTime;
  state.messagesProcessed++;
  
  return {
    timestamp: Date.now(),
    frameId: state.frameCount,
    
    // Core beat info
    bpm: state.currentBpm,
    bpmConfidence: beatResult.confidence,
    onBeat: beatResult.onBeat,
    beatPhase: state.beatPhase,
    beatStrength: beatResult.beatStrength,
    
    // Wave 8 Rhythm (REGLA 3: Syncopation is king)
    syncopation: rhythmOutput.syncopation,
    groove: rhythmOutput.groove,
    subdivision: rhythmOutput.subdivision,
    
    // Spectrum
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    
    // Mood (from Wave 8 Harmony)
    mood,
    key: harmonyOutput.key ?? undefined,
    energy,
    
    // Technical metrics
    spectralCentroid: spectrum.spectralCentroid,
    spectralFlux: spectrum.spectralFlux,
    zeroCrossingRate: calculateZeroCrossingRate(buffer),
    
    // === WAVE 8 RICH DATA FOR GAMMA ===
    wave8: {
      rhythm: rhythmOutput,
      harmony: harmonyOutput,
      section: sectionOutput,
      genre: genreOutput as any,  // GenreAnalysis casted to GenreOutput
      // 🌈 WAVE 47.1: MoodSynthesizer output (VAD emotional analysis)
      mood: {
        primary: moodOutput.primary,
        secondary: moodOutput.secondary,
        valence: moodOutput.valence,
        arousal: moodOutput.arousal,
        dominance: moodOutput.dominance,
        intensity: moodOutput.intensity,
        stability: moodOutput.stability,
      }
    }
  };
}

function calculateZeroCrossingRate(buffer: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < buffer.length; i++) {
    if ((buffer[i] >= 0) !== (buffer[i-1] >= 0)) {
      crossings++;
    }
  }
  return crossings / buffer.length;
}

// ============================================
// HEALTH REPORTING
// ============================================

function generateHealthReport(): WorkerHealth {
  const uptime = Date.now() - state.startTime;
  const memUsage = process.memoryUsage();
  
  // Determine status
  let status: WorkerHealth['status'] = 'healthy';
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    status = 'critical';
  } else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
    status = 'degraded';
  }
  
  return {
    nodeId: NODE_ID,
    timestamp: Date.now(),
    cpuUsage: 0, // Would need native module for accurate CPU
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
    framesProcessed: state.frameCount
  };
}

// ============================================
// STATE SNAPSHOT (For Phoenix Protocol)
// ============================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createStateSnapshot(): unknown {
  return {
    frameCount: state.frameCount,
    currentBpm: state.currentBpm,
    bpmHistory: [...state.bpmHistory],
    beatPhase: state.beatPhase,
    messagesProcessed: state.messagesProcessed
  };
}

function restoreStateSnapshot(snapshot: unknown): void {
  if (typeof snapshot === 'object' && snapshot !== null) {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.frameCount === 'number') state.frameCount = s.frameCount;
    if (typeof s.currentBpm === 'number') state.currentBpm = s.currentBpm;
    if (Array.isArray(s.bpmHistory)) state.bpmHistory = s.bpmHistory;
    if (typeof s.beatPhase === 'number') state.beatPhase = s.beatPhase;
  }
  console.log(`[BETA] State restored: frame ${state.frameCount}, BPM ${state.currentBpm}`);
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
        console.log('[BETA] 👂 Senses initialized');
        sendMessage(MessageType.READY, 'alpha', { nodeId: NODE_ID });
        break;
        
      case MessageType.SHUTDOWN:
        console.log('[BETA] Shutting down...');
        state.isRunning = false;
        // Send final health before shutdown
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
        
      case MessageType.AUDIO_BUFFER:
        if (!state.isRunning) break;
        const buffer = message.payload as Float32Array;
        const analysis = processAudioBuffer(buffer);
        sendMessage(
          MessageType.AUDIO_ANALYSIS, 
          'alpha', 
          analysis,
          analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL
        );
        break;
        
      case MessageType.STATE_RESTORE:
        const snapshot = message.payload as { state: unknown };
        restoreStateSnapshot(snapshot.state);
        break;
        
      case MessageType.CONFIG_UPDATE:
        const newConfig = message.payload as Partial<TrinityConfig>;
        Object.assign(config, newConfig);
        
        // 🔧 WAVE 15.1: Log detallado del inputGain
        if (newConfig.inputGain !== undefined) {
          console.log(`[BETA] 🎚️ Gain updated to: ${(newConfig.inputGain * 100).toFixed(0)}%`);
        } else {
          console.log('[BETA] Config updated');
        }
        break;
        
      default:
        console.warn(`[BETA] Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    state.errors.push(errorMsg);
    console.error(`[BETA] Error handling ${message.type}:`, errorMsg);
    
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
  target: 'alpha' | 'gamma' | 'broadcast',
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
  
  // Notify Alpha we're alive
  console.log('[BETA] 👂 Worker thread started, waiting for INIT...');
  
  // Handle uncaught errors
  (process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
    console.error('[BETA] Uncaught exception:', error);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: error.message,
      fatal: true
    }, MessagePriority.CRITICAL);
  });
  
  (process as NodeJS.EventEmitter).on('unhandledRejection', (reason: unknown) => {
    console.error('[BETA] Unhandled rejection:', reason);
    sendMessage(MessageType.WORKER_ERROR, 'alpha', {
      nodeId: NODE_ID,
      error: String(reason),
      fatal: false
    }, MessagePriority.CRITICAL);
  });
} else {
  console.error('[BETA] No parentPort - not running as worker thread!');
  process.exit(1);
}

// ============================================
// PERIODIC HEALTH REPORT
// ============================================

setInterval(() => {
  if (state.isRunning) {
    sendMessage(MessageType.HEALTH_REPORT, 'alpha', generateHealthReport());
  }
}, 5000); // Every 5 seconds
