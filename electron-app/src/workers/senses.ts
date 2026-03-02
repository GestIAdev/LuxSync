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

// ═══════════════════════════════════════════════════════════════════════════════
// � WAVE 1017: THE TRANSPLANT - GOD EAR FFT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
// El viejo FFT.ts ha sido reemplazado por el espectroscopio quirúrgico GOD EAR.
// Blackman-Harris windowing, Linkwitz-Riley 4th order, 7 bandas tácticas.
// ═══════════════════════════════════════════════════════════════════════════════
import { GodEarAnalyzer, toLegacyFormat, GodEarSpectrum } from './GodEarFFT';

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

//  WAVE 670: AGC - Normalización de buffer ANTES del FFT
// CRITICAL: Sin esto, los Z-Scores del WAVE 660 son ficción matemática
import { getAGC, type AGCOutput } from './utils/AutomaticGainControl';

// 🌈 WAVE 47.1: MoodSynthesizer - VAD Emotional Analysis
// WAVE 254: Migrado desde selene-lux-core a engine/consciousness
// WAVE 2026: Migrado a engine/musical/classification
import { MoodSynthesizer } from '../engine/musical/classification/MoodSynthesizer';

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
  
  // 🔪 WAVE 2090.2: BPM state PURGED — Pacemaker in main thread is the sole BPM authority
  
  // 🏎️ WAVE 1013: NITRO BOOST - Ring Buffer for Overlap Strategy
  ringBuffer: Float32Array;        // 4096 samples circular buffer
  ringBufferWriteIndex: number;    // Current write position (0-4095)
  ringBufferFilled: boolean;       // Has buffer been filled at least once?
  
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
  
  // 🔪 WAVE 2090.2: BPM state initialization PURGED
  
  // 🏎️ WAVE 1013: Ring Buffer (4096 samples for FFT, ~85ms @ 48kHz)
  ringBuffer: new Float32Array(4096),
  ringBufferWriteIndex: 0,
  ringBufferFilled: false,
  
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

// ═══════════════════════════════════════════════════════════════════════════════
// � WAVE 2090.2: THE PACEMAKER MONOPOLY — BPM DE-DUPLICATION
// ═══════════════════════════════════════════════════════════════════════════════
// PURGED: GodEarBPMTracker (was a full BPM calculator in the worker)
// PURGED: Legacy BeatDetector (was a second BPM calculator in the worker)
//
// The Worker is NO LONGER RESPONSIBLE for calculating BPM.
// Single Source of Truth: BeatDetector v2.0 "The Pacemaker" in TitanOrchestrator (main thread)
//
// What the Worker DOES export:
// - rawBassEnergy (pre-AGC bass for the Pacemaker's kick detection)
// - kickDetected / snareDetected / hihatDetected (GodEar slope-based onsets)
// - All spectral metrics (bands, clarity, flatness, centroid, etc.)
//
// What the Worker NO LONGER exports:
// - bpm (was computed by GodEarBPMTracker + legacy BeatDetector)
// - bpmConfidence (was an arbitrated value between two detectors)
// - onBeat (was from legacy BeatDetector)
// - beatPhase (was computed from worker-local state)
// - beatStrength (was from legacy BeatDetector)
// ═══════════════════════════════════════════════════════════════════════════════

// ============================================
// SPECTRUM ANALYZER - � WAVE 1017: GOD EAR TRANSPLANT
// ============================================

/**
 * 🩻 WAVE 1017: THE TRANSPLANT
 * 
 * Analizador espectral quirúrgico con GOD EAR FFT.
 * 
 * REEMPLAZA: El viejo Cooley-Tukey del WAVE 15
 * AHORA USA: Blackman-Harris 4-term windowing (-92dB sidelobes)
 *            Linkwitz-Riley 4th order filters (24dB/octave)
 *            7 bandas tácticas con ZERO overlap
 *            Per-band AGC Trust Zones
 * 
 * PERFORMANCE TARGET: <2ms (GODLIKE: <1ms)
 */
class SpectrumAnalyzer {
  private readonly godEar: GodEarAnalyzer;
  private lastSpectralFlux: number = 0;
  private prevEnergy: number = 0;
  private frameCount: number = 0;
  private lastGodEarResult: GodEarSpectrum | null = null;
  
  constructor(sampleRate: number = 44100) {
    // 🩻 GOD EAR con 4096 muestras para resolución máxima
    this.godEar = new GodEarAnalyzer(sampleRate, 4096);
    console.log('[BETA] � GOD EAR Analyzer initialized (WAVE 1017: THE TRANSPLANT)');
    console.log('[BETA] 💀 Blackman-Harris | LR4 24dB/oct | 7 Tactical Bands');
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
    // 🎭 WAVE 1018: Clarity for PROG ROCK detection
    clarity: number;
    // 🔥 WAVE 1162: THE BYPASS - RAW BASS FOR PACEMAKER
    rawBassEnergy: number;
  } {
    // � Ejecutar GOD EAR FFT
    const godEarResult = this.godEar.analyze(buffer);
    this.lastGodEarResult = godEarResult;
    this.frameCount++;
    
    // 🔮 SHADOW MODE TELEMETRY - Nuevas métricas GOD EAR (cada ~2 segundos)
    if (this.frameCount % 40 === 0) {
      console.log(`[GOD EAR 🩻] SHADOW MODE TELEMETRY:`);
      console.log(`   Clarity:     ${godEarResult.spectral.clarity.toFixed(3)} (Rock target: >0.7)`);
      console.log(`   Flatness:    ${godEarResult.spectral.flatness.toFixed(3)} (Tonal<0.3, Noise>0.7)`);
      console.log(`   Centroid:    ${godEarResult.spectral.centroid.toFixed(0)}Hz (Bright>2000, Dark<1200)`);
      console.log(`   CrestFactor: ${godEarResult.spectral.crestFactor.toFixed(2)} (Dynamics)`);
      console.log(`   Rolloff:     ${godEarResult.spectral.rolloff.toFixed(0)}Hz (85% energy)`);
      console.log(`   Latency:     ${godEarResult.meta.processingLatencyMs.toFixed(2)}ms`);
      console.log(`   UltraAir:    ${godEarResult.bands.ultraAir.toFixed(3)} (NEW: 16-22kHz sizzle)`);
    }
    
    // 📦 Legacy Adapter - Convertir a formato viejo para Vibes existentes
    const legacy = toLegacyFormat(godEarResult);
    
    // Calcular flujo espectral (cambio de energía total)
    const currentEnergy = legacy.bass + legacy.mid + legacy.treble;
    const spectralFlux = Math.min(1, Math.abs(currentEnergy - this.prevEnergy) * 2);
    this.prevEnergy = currentEnergy;
    
    return {
      // Bandas principales (normalizadas 0-1) - LEGACY FORMAT
      bass: legacy.bass,
      mid: legacy.mid,
      treble: legacy.treble,
      
      // 🎸 WAVE 1011.2: spectralCentroid EN HZ (no normalizado!)
      // RockStereoPhysics2 necesita Hz para detectar "bright" (>2000) vs "dark" (<1200)
      spectralCentroid: godEarResult.spectral.centroid, // Hz directo del GOD EAR
      spectralFlux,
      
      // 🧮 Bandas extendidas (LEGACY FORMAT con GOD EAR data)
      subBass: legacy.subBass,
      lowMid: legacy.lowMid,
      highMid: legacy.highMid,
      dominantFrequency: godEarResult.dominantFrequency,
      
      // 🥁 Transient detection - GOD EAR slope-based (más preciso)
      kickDetected: godEarResult.transients.kick,
      snareDetected: godEarResult.transients.snare,
      hihatDetected: godEarResult.transients.hihat,
      
      // 🤖 Texture metrics - GOD EAR native
      harshness: godEarResult.bands.highMid, // Proxy para harshness
      spectralFlatness: godEarResult.spectral.flatness,
      
      // 🎭 WAVE 1018: Clarity para PROG ROCK detection
      clarity: godEarResult.spectral.clarity,
      
      // 🔥 WAVE 1162: THE BYPASS - RAW BASS FOR PACEMAKER
      // El AGC comprime la dinámica y mata los transients.
      // rawBassEnergy es la suma de subBass + bass ANTES del AGC.
      // Esto permite al BeatDetector ver los PICOS REALES de los kicks.
      rawBassEnergy: godEarResult.bandsRaw.subBass + godEarResult.bandsRaw.bass,
    };
  }
  
  /**
   * Acceso directo al resultado GOD EAR para métricas avanzadas
   */
  getLastGodEarResult(): GodEarSpectrum | null {
    return this.lastGodEarResult;
  }
  
  reset(): void {
    this.prevEnergy = 0;
    this.lastGodEarResult = null;
  }
}

// ============================================
// MAIN ANALYZERS - WAVE 8 INTEGRATION
// ============================================

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
  // 🎚️ WAVE 670: AGC Gain Factor for debug visibility
  agcGainFactor?: number;
  
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

function processAudioBuffer(incomingBuffer: Float32Array): ExtendedAudioAnalysis {
  const startTime = performance.now();
  state.frameCount++;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🏎️ WAVE 1013: NITRO BOOST - RING BUFFER / OVERLAP STRATEGY
  // ═══════════════════════════════════════════════════════════════════════════
  // El frontend ahora envía buffers cada 50ms (~2400 samples @ 48kHz).
  // Para mantener FFT de 4096 samples, usamos un Ring Buffer con overlap de 50%.
  //
  // Estrategia:
  // 1. Copiar incoming samples al ring buffer circular
  // 2. Cuando el ring esté lleno, crear snapshot lineal de 4096 samples
  // 3. Ejecutar FFT sobre el snapshot
  //
  // Beneficio: 20fps de análisis espectral manteniendo resolución de 4096 samples
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 1. Copiar incoming buffer al ring buffer
  const incomingLength = incomingBuffer.length;
  const startIndex = state.ringBufferWriteIndex;
  
  for (let i = 0; i < incomingLength; i++) {
    state.ringBuffer[state.ringBufferWriteIndex] = incomingBuffer[i];
    state.ringBufferWriteIndex = (state.ringBufferWriteIndex + 1) % 4096;
  }
  
  // Marcar como lleno cuando el índice wraps around (volvemos al inicio)
  // Esto ocurre cuando el nuevo índice es MENOR que el índice inicial + incoming length
  // O más simple: después de acumular suficientes samples (al menos 4096)
  if (!state.ringBufferFilled) {
    // Si el writeIndex dio la vuelta (era mayor, ahora es menor que startIndex + length)
    // O si ya hemos procesado suficientes samples totales
    const totalSamplesWritten = state.frameCount * incomingLength;
    if (totalSamplesWritten >= 4096) {
      state.ringBufferFilled = true;
      console.log('[BETA 🏎️] Ring buffer READY - 4096 samples accumulated, FFT analysis active');
    }
  }
  
  // 2. Si el ring buffer NO está lleno aún, retornar análisis con ceros
  if (!state.ringBufferFilled) {
    // 🏎️ WAVE 1013: Silenciado - solo log primera vez
    if (state.frameCount === 1) {
      console.log('[BETA 🏎️] Ring buffer initializing (4096 samples)...');
    }
    // Retornar análisis mínimo mientras el buffer se llena
    return {
      timestamp: Date.now(),
      frameId: state.frameCount,
      agcGainFactor: 1.0,
      bpm: 0,  // 🔪 WAVE 2090.2: Worker no longer computes BPM
      bpmConfidence: 0,
      onBeat: false,
      beatPhase: 0,
      beatStrength: 0,
      syncopation: 0,
      groove: 0,
      subdivision: 4,
      bass: 0,
      mid: 0,
      treble: 0,
      subBass: 0,
      lowMid: 0,
      highMid: 0,
      harshness: 0,
      spectralFlatness: 0,
      spectralCentroid: 0,
      energy: 0,
      spectralFlux: 0,
      zeroCrossingRate: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false
    };
  }
  
  // 3. Crear snapshot lineal del ring buffer para FFT (4096 samples)
  const buffer = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) {
    const readIndex = (state.ringBufferWriteIndex + i) % 4096;
    buffer[i] = state.ringBuffer[readIndex];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // �️ WAVE 670: AUTOMATIC GAIN CONTROL - NORMALIZACIÓN DE ENTRADA
  // ═══════════════════════════════════════════════════════════════════════════
  // CRÍTICO: Sin esto, los Z-Scores del WAVE 660 son FICCIÓN MATEMÁTICA.
  // AGC normaliza el buffer ANTES de cualquier análisis para que:
  // - MP3 silencioso → señal normalizada (~0.25 RMS)
  // - WAV saturado → señal normalizada (~0.25 RMS)
  // - Resultado: El FFT y los analizadores ven niveles CONSISTENTES
  // ═══════════════════════════════════════════════════════════════════════════
  const agc = getAGC();
  const agcResult = agc.processBuffer(buffer);
  
  // 🎯 WAVE 14/15: Apply Input Gain DESPUÉS del AGC (si el usuario quiere boost extra)
  // Normalmente inputGain debería ser 1.0 ahora que tenemos AGC
  const gain = config.inputGain ?? 1.0;
  
  if (gain !== 1.0) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 1163: REORDER - Spectrum Analysis FIRST (we need kickDetected)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // === PHASE 1: Spectrum Analysis (🧮 FFT REAL with GOD EAR) ===
  const spectrum = spectrumAnalyzer.analyze(buffer, config.audioSampleRate);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // � WAVE 2090.2: PHASES 2 & 3 PURGED — BPM detection moved to Pacemaker
  // ═══════════════════════════════════════════════════════════════════════════
  // DELETED: GodEarBPMTracker.process() — was PHASE 2
  // DELETED: beatDetector.analyze() — was PHASE 3
  // DELETED: BPM arbitrage logic (confidence-based switching between two detectors)
  // DELETED: Beat phase calculation from worker-local state
  //
  // The Worker now only exports raw spectral metrics + transient onsets.
  // BPM is computed exclusively by Pacemaker (BeatDetector v2.0) in TitanOrchestrator.
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Calculate overall energy (weighted by perceptual importance)
  const rawEnergy = (spectrum.bass * 0.5 + spectrum.mid * 0.3 + spectrum.treble * 0.2);
  
  // 🎯 WAVE 16: Normalizar energía con Rolling Peak 15s
  // Esto auto-ajusta la sensibilidad según el nivel de la canción
  const energyNormalizer = getEnergyNormalizer();
  const normalizedEnergy = energyNormalizer.normalize(rawEnergy);
  const energy = normalizedEnergy; // Usar energía normalizada en todo el pipeline
  
  // === PHASE 4: Wave 8 Rich Analysis ===
  // Create AudioMetrics for Wave 8 analyzers
  // 🔪 WAVE 2090.2: BPM fields set to neutral — Pacemaker owns BPM in main thread
  const audioMetrics: AudioMetrics = {
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    volume: energy,
    bpm: 0,                // 🔪 WAVE 2090.2: Worker no longer computes BPM
    bpmConfidence: 0,      // 🔪 WAVE 2090.2: No BPM confidence from worker
    onBeat: spectrum.kickDetected,  // 🔪 WAVE 2090.2: Use GOD EAR transient onset only
    beatPhase: 0,          // 🔪 WAVE 2090.2: Phase computed by Pacemaker
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
  // 🔪 WAVE 2090.2: Beat state neutered — no BPM in worker
  const beatState = {
    bpm: 0,
    confidence: 0,
    onBeat: spectrum.kickDetected,
    phase: 0,
    beatCount: 0
  };
  
  // Adapt AudioMetrics for MoodSynthesizer (different type signature)
  const metricsForMood = {
    ...audioMetrics,
    energy: energy,  // MoodSynthesizer expects 'energy' not 'volume'
    beatConfidence: 0,  // 🔪 WAVE 2090.2: No beat confidence from worker
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
      bpm: 0,  // 🔪 WAVE 2090.2: Worker no longer knows BPM
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
  // 🎵 WAVE 1228: Temperature field neutered - mood is computed in mind.ts instead
  // harmonyOutput.temperature was decoration-only (never consumed by TitanEngine)
  let mood: 'dark' | 'bright' | 'neutral' = 'neutral'; // Default neutral
  // Removed: if (harmonyOutput.temperature === 'cool') mood = 'dark';
  // Removed: else if (harmonyOutput.temperature === 'warm') mood = 'bright';
  
  // Track processing time
  state.totalProcessingTime += performance.now() - startTime;
  state.messagesProcessed++;
  
  // 🔧 WAVE 272: Logs de diagnóstico de Key detection
  // Log cada 60 frames (~6 seg @ 10fps) para ver el estado del detector
  if (state.frameCount % 60 === 0) {
    if (harmonyOutput.key) {
      console.log(`[BETA 🎵] Key Detected: ${harmonyOutput.key} ${harmonyOutput.mode} (Confidence: ${harmonyOutput.confidence.toFixed(2)})`);
    } else {
      // 📝 WAVE 272: Log de DESCARTE - ¿por qué no hay Key?
      console.log(`[BETA ❌] Key NULL | DomFreq: ${spectrum.dominantFrequency?.toFixed(0) ?? 'N/A'}Hz | Energy: ${(energy * 100).toFixed(0)}% | Conf: ${harmonyOutput.confidence.toFixed(2)}`);
    }
  }
  
  return {
    timestamp: Date.now(),
    frameId: state.frameCount,
    
    // 🎚️ WAVE 670: AGC Gain Factor (para debug)
    // Valores típicos: 1.0 = sin cambio, >1 = amplificando (audio suave), <1 = atenuando (audio fuerte)
    agcGainFactor: agcResult.gainFactor,
    
    // 🔪 WAVE 2090.2: BPM fields neutered — Pacemaker is sole authority
    bpm: 0,
    bpmConfidence: 0,
    onBeat: spectrum.kickDetected,  // Transient onset only, not BPM-based beat
    beatPhase: 0,
    beatStrength: spectrum.kickDetected ? 1 : 0,
    
    // Wave 8 Rhythm (REGLA 3: Syncopation is king)
    syncopation: rhythmOutput.syncopation,
    groove: rhythmOutput.groove,
    // 🎵 WAVE 1228: Phantom Field - subdivision never used, return static value
    subdivision: 4 as const,
    
    // Spectrum
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    
    // 🎸 WAVE 1011: Extended spectrum for RockStereoPhysics2
    subBass: spectrum.subBass,
    lowMid: spectrum.lowMid,
    highMid: spectrum.highMid,
    
    // 🎸 WAVE 1011: Spectral texture metrics
    harshness: spectrum.harshness,
    spectralFlatness: spectrum.spectralFlatness,
    
    // 🎸 WAVE 1011: Transient detection
    kickDetected: spectrum.kickDetected,
    snareDetected: spectrum.snareDetected,
    hihatDetected: spectrum.hihatDetected,
    
    // Mood (from Wave 8 Harmony)
    mood,
    key: harmonyOutput.key ?? undefined,
    energy,
    
    // Technical metrics
    spectralCentroid: spectrum.spectralCentroid,
    spectralFlux: spectrum.spectralFlux,
    zeroCrossingRate: calculateZeroCrossingRate(buffer),
    
    // 🔥 WAVE 1162: THE BYPASS - RAW BASS FOR PACEMAKER
    // Energía de graves SIN normalizar por AGC - crítico para detección de kicks
    rawBassEnergy: spectrum.rawBassEnergy,
    
    // === WAVE 8 RICH DATA FOR GAMMA ===
    wave8: {
      rhythm: rhythmOutput,
      harmony: harmonyOutput,
      section: sectionOutput,
      genre: genreOutput as any,  // GenreAnalysis casted to GenreOutput
      // 🌈 WAVE 1228: MoodSynthesizer pruning - keep only primary (others are UI decoration)
      // CONSUMED: primary (affects EffectDNA organicity)
      // NOT CONSUMED: valence, arousal, dominance, intensity, stability (phantom fields)
      mood: {
        primary: moodOutput.primary,
        secondary: null,  // 🎵 WAVE 1228: Phantom field - rarely used, return null
        valence: 0,       // 🎵 WAVE 1228: Phantom field - decoration, static 0
        arousal: 0,       // 🎵 WAVE 1228: Phantom field - decoration, static 0
        dominance: 0,     // 🎵 WAVE 1228: Phantom field - decoration, static 0
        intensity: 0.5,   // 🎵 WAVE 1228: Phantom field - decoration, static neutral
        stability: 1,     // 🎵 WAVE 1228: Phantom field - decoration, static 1
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
    // 🔪 WAVE 2090.2: BPM state purged from snapshot
    messagesProcessed: state.messagesProcessed
  };
}

function restoreStateSnapshot(snapshot: unknown): void {
  if (typeof snapshot === 'object' && snapshot !== null) {
    const s = snapshot as Record<string, unknown>;
    if (typeof s.frameCount === 'number') state.frameCount = s.frameCount;
    // 🔪 WAVE 2090.2: BPM state purged from restore
  }
  console.log(`[BETA] State restored: frame ${state.frameCount}`);
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
        if (!state.isRunning) {
          // 🔍 WAVE 263: Log si no está corriendo
          if (state.frameCount % 300 === 0) {
            console.warn('[BETA] ⚠️ AUDIO_BUFFER received but isRunning=false');
          }
          break;
        }
        const buffer = message.payload as Float32Array;
        
        // 🔍 WAVE 263: Log cada ~5 segundos
        if (state.frameCount % 300 === 0) {
          console.log(`[BETA 📡] AUDIO_BUFFER #${state.frameCount} | size=${buffer?.length || 0}`);
        }
        
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
      
      // 🎯 WAVE 289.5: SET_VIBE - Propagate vibe to SectionTracker
      case MessageType.SET_VIBE:
        const vibePayload = message.payload as { vibeId: string };
        sectionTracker.setVibe(vibePayload.vibeId);
        console.log(`[BETA] 🎯 WAVE 289.5: Vibe set to "${vibePayload.vibeId}" for SectionTracker`);
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
