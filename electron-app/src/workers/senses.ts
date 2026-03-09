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

// 🥁 WAVE 2168: THE RESURRECTION OF WAVE 1163
// ═══════════════════════════════════════════════════════════════════════════
// After 10 WAVEs (2159-2167) of trying to make autocorrelation find 126 BPM
// in Brejcha's sub-bass, the fundamental truth emerged:
//
//   Autocorrelation at 46.4ms/frame CANNOT produce a peak at 126 BPM.
//   It only sees ~164 BPM and ~82 BPM (harmonics, not the beat).
//   126 BPM NEVER appeared in a SINGLE SIEVE event across 1409 frames.
//
// The interval-based approach from WAVE 1163 detected Brejcha at 124-126 ±2.
// It uses ratio-based kick detection + adaptive debounce + median smoothing.
// Simple. Deterministic. Proven.
//
// 🪦 GodEarBPMTracker (autocorrelation v6) ARCHIVED — not deleted.
//    It's a mathematical jewel with potential future applications.
// 🪦 PacemakerV2 + HarmonicGearbox — also archived.
//
// import { GodEarBPMTracker } from './GodEarBPMTracker';
// import { PacemakerV2 } from './PacemakerV2';
// import { GearboxStabilizer } from './HarmonicGearbox';
import { IntervalBPMTracker } from './IntervalBPMTracker';

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
  
  // 🥁 WAVE 2112: BPM detection RESTORED in Worker — GodEar is the source of truth
  currentBpm: number;
  bpmConfidence: number;
  beatPhase: number;
  lastBeatTime: number;

  // 🏎️ WAVE 1013: NITRO BOOST - Ring Buffer for Overlap Strategy
  ringBuffer: Float32Array;        // 4096 samples circular buffer
  ringBufferWriteIndex: number;    // Current write position (0-4095)
  ringBufferFilled: boolean;       // Has buffer been filled at least once?
  
  // 🏎️ WAVE 2091: ZERO-ALLOC SNAPSHOT — Pre-allocated buffer for FFT linearization
  // Eliminates 16KB garbage per frame (new Float32Array(4096) every ~21ms)
  snapshotBuffer: Float32Array;
  
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
  
  // 🥁 WAVE 2112: BPM detection RESTORED in Worker
  currentBpm: 0,
  bpmConfidence: 0,
  beatPhase: 0,
  lastBeatTime: 0,

  // 🏎️ WAVE 1013: Ring Buffer (4096 samples for FFT, ~85ms @ 48kHz)
  ringBuffer: new Float32Array(4096),
  ringBufferWriteIndex: 0,
  ringBufferFilled: false,
  
  // 🏎️ WAVE 2091: ZERO-ALLOC SNAPSHOT — Reusable linearization buffer
  snapshotBuffer: new Float32Array(4096),
  
  // Wave 8 outputs
  lastRhythmOutput: null,
  lastHarmonyOutput: null,
  lastSectionOutput: null,
  lastGenreOutput: null,
  
  messagesProcessed: 0,
  totalProcessingTime: 0,
  errors: [],
};

// ============================================
// BEAT DETECTION
// ============================================

// ═══════════════════════════════════════════════════════════════════════════════
// 🥁 WAVE 2168: THE RESURRECTION OF WAVE 1163 — Interval-Based BPM Detection
// ═══════════════════════════════════════════════════════════════════════════════
// After 10 WAVEs of autocorrelation surgery (2159-2167), the fundamental
// truth: autocorrelation at 46.4ms/frame CANNOT find 126 BPM in Brejcha.
// The WAVE 1163 interval-based approach detected it at 124-126 ±2.
//
// IntervalBPMTracker receives RAW bass energy (20-250Hz, pre-AGC),
// detects kicks via ratio threshold (1.6×), measures intervals between
// kicks, and reports median BPM. No autocorrelation. No Shark Fin.
// No harmonic sieve. Just pure ratio detection and adaptive debounce.
// ═══════════════════════════════════════════════════════════════════════════════

const bpmTracker = new IntervalBPMTracker();
// 🔥 WAVE 2180: CONTEXT-AWARE POCKET BOUNDS
// Vibe is set by the DJ via VibeManager (GAMMA), propagated here via SET_VIBE.
// The Worker is FROZEN (no genre detection), but it CAN use the DJ's manual
// selection to tighten the dance pocket — ensuring BPM lock is genre-correct.
let currentVibeId: string = ''

/**
 * Returns [targetMin, targetMax] for getMusicalBpm() based on active Vibe.
 * Techno vibes need a strict [120, 135] pocket to reject 107 BPM folds.
 * Latin vibes need [85, 105] to capture reggaetón/dembow at 100 BPM.
 * Default [90, 135] for everything else (house, trance, DnB, generic).
 */
function getPocketBounds(): [number, number] {
  const v = currentVibeId.toLowerCase()
  if (v === 'techno-club' || v === 'techno' || v === 'minimal' || v === 'hard-techno') {
    return [120, 135]
  }
  if (v === 'fiesta-latina' || v === 'reggaeton' || v === 'latin') {
    return [85, 105]
  }
  // Generic default — covers house, trance, drum-n-bass fold targets
  return [90, 135]
}


// � WAVE 2168: Shark Fin ARCHIVED — not needed for interval-based detection.
// The Shark Fin was an envelope follower (decay 0.85/frame) that fattened
// thin onset spikes for autocorrelation overlap. Interval detection doesn't
// need it — it detects kicks directly from raw energy ratios.
// 🪦 WAVE 2168: fatNeedle REMOVED — Shark Fin envelope not needed for interval detection.

// 🔬 WAVE 2168: Flux state for TELEMETRY ONLY (not fed to BPM tracker).
// The IntervalBPMTracker computes its own deltas internally.
let prevSubEnergy = 0;
let prevBassOnlyEnergy = 0;
let prevMidEnergy = 0;

// ═══════════════════════════════════════════════════════════════════════════
// 👻 WAVE 2172: SHADOW LOGGER — Data-Driven MIR Testing
// ═══════════════════════════════════════════════════════════════════════════
// Captures ~46 seconds of real audio telemetry from the GodEar pipeline
// while YouTube/Spotify plays through the system. The dump is written to
// electron-app/test-data/live_audio_dump.json and used by the cold-lab
// unit test (IntervalBPMTracker.livedata.test.ts) to replay the exact
// same signal offline in 50ms. Zero live-tests for DSP tuning.
//
// WHAT WE CAPTURE (per frame):
//   timestampMs  — deterministic musical clock (frame-perfect)
//   rawLowFlux   — sub-bass onset (20-60Hz rising edge)
//   rawMidFlux   — mid-range onset (250-2kHz rising edge)
//   rawBassFlux  — full bass onset (rawLowFlux + bassOnlyFlux, 20-250Hz)
//   centroid     — spectral centroid in Hz (energy center of gravity)
//   needle       — the FINAL gated value fed to the tracker
//
// The test can replay `needle` directly to verify tracker behavior,
// or replay raw fluxes + centroid to simulate different gate tunings.
// ═══════════════════════════════════════════════════════════════════════════
interface ShadowFrame {
  timestampMs: number;
  rawLowFlux: number;
  rawMidFlux: number;
  rawBassFlux: number;
  centroid: number;
  needle: number;
}
const shadowLog: ShadowFrame[] = [];
const MAX_SHADOW_FRAMES = 1000; // ~46.4 seconds at 2048/44100Hz per frame
let shadowDumped = false;

// ============================================
// SPECTRUM ANALYZER - 🩻 WAVE 1017: GOD EAR TRANSPLANT
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
    // WAVE 2098: Boot silence
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
    // 🔪 WAVE 2118: THE FREQUENCY SCALPEL — Bandas raw individuales
    // Necesarias para que el tracker BPM pueda ponderar subBass vs bass
    rawSubBassEnergy: number;
    rawBassOnlyEnergy: number;
    // 📡 WAVE 2153: BROADBAND ANCHOR — Medios raw para detección de ataque del kick
    rawLowMidEnergy: number;
    rawMidEnergy: number;
  } {
    //  Ejecutar GOD EAR FFT
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

      // ═══════════════════════════════════════════════════════════════════
      // 🔪 WAVE 2118: THE FREQUENCY SCALPEL — Bandas raw individuales
      // ═══════════════════════════════════════════════════════════════════
      // El kick real golpea 40-50Hz → subBass.
      // El offbeat bass (Brejcha) golpea 80-150Hz → bass.
      // El tracker BPM necesita distinguirlos para no confundir
      // offbeats con kicks. Estos valores raw permiten la ponderación.
      // ═══════════════════════════════════════════════════════════════════
      rawSubBassEnergy: godEarResult.bandsRaw.subBass,
      rawBassOnlyEnergy: godEarResult.bandsRaw.bass,
      rawLowMidEnergy: godEarResult.bandsRaw.lowMid,
      rawMidEnergy: godEarResult.bandsRaw.mid,
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
    }
  }
  
  // 2. Si el ring buffer NO está lleno aún, retornar análisis con ceros
  if (!state.ringBufferFilled) {
    // 🏎️ WAVE 1013: Silenciado - solo log primera vez
    if (state.frameCount === 1) {
      // WAVE 2098: Boot silence
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
  // 🏎️ WAVE 2091: ZERO-ALLOC — Reuse pre-allocated buffer instead of new Float32Array(4096) per frame
  const buffer = state.snapshotBuffer;
  for (let i = 0; i < 4096; i++) {
    const readIndex = (state.ringBufferWriteIndex + i) % 4096;
    buffer[i] = state.ringBuffer[readIndex];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 2162: FFT ANTES DEL AGC — El Oído Escucha Música Cruda
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // AUTOPSIA 2 (logboris.md): El AGC es una bomba de tiempo para el BPM.
  // Cuando cae un bombo, el AGC aplasta la ganancia. Cuando el bombo pasa,
  // el AGC "suelta" la compresión y el volumen sube artificialmente.
  // Esa subida fantasma infla los graves 300ms después del bombo real →
  // el tracker lee un segundo golpe a ~185 BPM que NO EXISTE.
  //
  // SOLUCIÓN: El FFT analiza el buffer CRUDO (con toda la dinámica real).
  // El AGC se aplica DESPUÉS para normalizar los niveles que consumen
  // rhythmDetector, harmonyDetector, sectionTracker y la UI.
  // El BPM tracker nunca ve el buffer — solo ve spectrum.rawSubBassEnergy
  // que viene del FFT crudo. Cadena limpia.
  //
  //   ANTES: buffer → AGC(comprime) → FFT(ve fantasmas) → BPM(lee mentiras)
  //   AHORA: buffer → FFT(ve la verdad) → AGC(normaliza para UI) → visuales
  // ═══════════════════════════════════════════════════════════════════════════

  // === PHASE 1: Spectrum Analysis — FFT sobre audio CRUDO (sin AGC) ===
  const spectrum = spectrumAnalyzer.analyze(buffer, config.audioSampleRate);

  // === PHASE 1.5: AGC para el resto del sistema (UI, rhythmDetector, etc.) ===
  const agc = getAGC();
  const agcResult = agc.processBuffer(buffer);

  // 🎯 WAVE 14/15: Apply Input Gain DESPUÉS del AGC (si el usuario quiere boost extra)
  const gain = config.inputGain ?? 1.0;
  if (gain !== 1.0) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= gain;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🥁 WAVE 2115: THE RELATIVE CLOCK — GodEar BPM Detection (TIMESTAMP FIX)
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 2112 original usaba Date.now() — tiempo de CPU real.
  // PROBLEMA: El Worker procesa en bursts. Si el SO pausa el thread 200ms,
  // el tracker ve un "silencio" de 200ms entre kicks y calcula BPM=30.
  // Los intervalos del log lo confirman: [448,511,451,558,961,511] — ese 961ms
  // es un stall de CPU, no un beat de 62 BPM.
  //
  // SOLUCIÓN: Timestamp basado en la posición del sample en el flujo de audio.
  // Cada frame recibe exactamente `incomingLength` samples.
  // Tiempo musical acumulado = frameCount * incomingLength / sampleRate * 1000ms
  //
  // Con incomingLength=2048, sampleRate=44100:
  //   frameCount=1  → t=46.4ms
  //   frameCount=10 → t=464ms
  // El tracker siempre ve intervalos perfectamente proporcionales al tempo real,
  // sin importar cuánto tarde la CPU en procesar cada frame.
  //
  // INVARIANTE: deterministicTimestampMs es MONOTÓNICO (nunca retrocede).
  // ═══════════════════════════════════════════════════════════════════════════
  const sampleRate = config.audioSampleRate ?? 44100;
  const deterministicTimestampMs = (state.frameCount * incomingLength / sampleRate) * 1000;

  // 🎯 WAVE 2160: UNCHAIN THE NEEDLE — Raw Low Flux + Centroid-Only Gate
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // 🪦 WAVES 2159-2165: CEMENTERIO DE FILTROS
  //
  // 7 intentos en 1 semana. Todos fallaron por la misma razón:
  // Los kicks de Boris Brejcha son sub-bass puro (centroid 70-150Hz).
  // El bajo rodante TAMBIÉN es sub-bass puro (centroid 100-200Hz).
  // Son gemelos espectrales — imposible separarlos por banda de frecuencia.
  //
  // Intentos y causas de muerte:
  //   WAVE 2159: Centroid Sniper (>1500Hz = kill) → mataba kicks reales
  //   WAVE 2160: Raw low flux only → PM2 debounce comía offbeats
  //   WAVE 2161: GodEarBPMTracker + Shark Fin → thin spikes, BPM errático
  //   WAVE 2162: FFT pre-AGC + fire Sniper + Latin math → hi-hats inundaban
  //   WAVE 2163: Restore Sniper only → rolling bass pasaba ambos gates
  //   WAVE 2164: √(low×mid) multiplicativa → aplastaba energía real del kick
  //   WAVE 2165: Portero Lógico (midFlux>0.001) → midFlux=0 en kicks reales
  //
  // Prueba definitiva (debugBPM.md, F1960):
  //   lowFlux=0.2939 midFlux=0.0000 needle=0.0000 centroid=121Hz
  //   ← EL KICK MÁS FUERTE DEL LOG, BLOQUEADO POR midFlux=0
  //
  // F1680: Cuando el autocorrelador recibió energía real (el drop),
  // calculó 131 BPM con conf=0.474 — ¡la lectura más alta del log!
  // EL MOTOR FUNCIONA. Solo estábamos matando de hambre su entrada.
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪦 WAVE 2166: NAKED AUTOCORRELATOR (RIP — offbeat bass contamination)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Fed rawLowFlux = subBass + bass (0-250Hz) directly. No gates, no filters.
  // RESULT: Energy flowed (needle=0.2277!) but BPM read 95-97 instead of 126.
  // ROOT CAUSE: Kick+offbeat bass both at equal amplitude in 0-250Hz band.
  // Autocorrelation saw half-beat onsets at ~183 BPM, octave lock halved to ~97.
  // 126 BPM peak NEVER appeared in 78 SIEVE events across 1032-line log.
  //
  // INSIGHT RETROACTIVO sobre WAVE 2166:
  // "Si el kick está en el beat y el bajo en el offbeat, AMBOS repiten
  // cada 476ms" era INCORRECTO. Sí, repiten cada 476ms individualmente,
  // pero SUMADOS crean picos cada 238ms (half-beat), que el autocorrelador
  // lee como ~183-187 BPM — el doble del real.
  //
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 2167: SUB-BASS SCALPEL
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // WAVE 2166 POSTMORTEM (debugBPM.md, 1032 lines):
  // ┌──────────────────────────────────────────────────────────────────────┐
  // │  The naked autocorrelator received energy (needle=0.0576, 0.2277)  │
  // │  — a massive improvement over the starved zeros of WAVEs 2159-65. │
  // │  BUT it read ~95-97 BPM instead of ~126 BPM.                       │
  // │                                                                      │
  // │  78 SIEVE/OCTAVE events analyzed. NOT A SINGLE ONE shows a peak   │
  // │  between 120-135 BPM. The sieve ONLY sees:                         │
  // │    ~183-187 BPM (lag ~28)                                          │
  // │    ~85-97 BPM  (lag ~53-55)                                        │
  // │    ~81-84 BPM  (lag ~64)                                           │
  // │                                                                      │
  // │  ROOT CAUSE: subEnergy = rawSubBass + rawBassOnly (0-250Hz).      │
  // │  In Brejcha, the kick (20-60Hz) hits on the beat and the rolling  │
  // │  bass (60-250Hz) hits on the offbeat. Both have EQUAL amplitude   │
  // │  in sub+bass combined. The autocorrelation sees energy onsets at   │
  // │  EVERY half-beat (~238ms = ~252BPM), which aliases to ~183 BPM    │
  // │  in the lag grid. The full-beat period at ~476ms (126 BPM) is     │
  // │  INVISIBLE because the offbeat bass reinforces the half-period    │
  // │  more than the full period.                                        │
  // │                                                                      │
  // │  THE FIX: Feed ONLY rawSubBassEnergy (20-60Hz).                   │
  // │  The kick lives in 20-60Hz. The rolling bass lives in 60-250Hz.   │
  // │  By excluding the bass band, the offbeat contamination vanishes.  │
  // │  The autocorrelation sees ONE clean spike per beat at 476ms       │
  // │  interval = 126 BPM.                                               │
  // └──────────────────────────────────────────────────────────────────────┘
  //
  // GodEarFFT band definitions (from GodEarFFT.ts):
  //   subBass:  20-60Hz   ← KICK territory (pure sub-bass thump)
  //   bass:     60-250Hz  ← BASS LINE territory (rolling bass, offbeat)
  //
  // ═══════════════════════════════════════════════════════════════════════════
  // 🥁 WAVE 2168: THE RESURRECTION — Interval-Based BPM Detection
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // FEED: rawBassEnergy = rawSubBassEnergy (20-60Hz) + rawBassOnlyEnergy (60-250Hz)
  //
  // This is the SAME signal that WAVE 1163 used: the full bass range 20-250Hz,
  // pre-AGC. The original WAVE 1163 called it "rawBassEnergy 20-150Hz" but
  // GodEarFFT's bass band extends to 250Hz. The interval-based tracker doesn't
  // care about offbeat contamination because it detects kicks by RATIO (1.6×
  // above rolling average) + RISING EDGE (delta > 0.008). An offbeat bass that
  // is always present gets absorbed into the rolling average and can't trigger
  // the ratio threshold. Only sudden TRANSIENTS (kicks) exceed 1.6×.
  //
  // WHY NOT sub-bass only (20-60Hz)?
  // WAVE 2167 proved that sub-bass-only works fine for energy flow, but some
  // kicks have more energy in 60-150Hz than in 20-60Hz. The ratio detector
  // is immune to the offbeat contamination that killed autocorrelation because
  // it compares instantaneous vs average, not periodic structure.
  //
  // WAVE 2169 UPDATE: rawBassEnergy has natural 3-5 frame kick decay that
  // causes interval jitter (BPM bounces 161/173/185). Solution: feed FLUX
  // (onset spikes) instead of raw energy. The Gated Needle pipeline:
  //   1. Compute bass flux (rising edges only — 1 frame wide)
  //   2. Centroid-based gate (< 800Hz = kick, > 1500Hz = snipe, middle = threshold)
  //   3. Sniper redundant guard (bright centroid kills needle)
  //   4. Feed clean 1-frame needle to tracker
  //
  // REV1 FIX: Original Bozal (midFlux gate) killed Brejcha techno kicks
  // because minimal techno bombs are SUB-BASS PURE (centroid 60-200Hz,
  // nearly zero mid energy). Replaced with centroid-based arbiter.
  // ═══════════════════════════════════════════════════════════════════════════

  // Keep rawBassEnergy for downstream consumers (audioMetrics, etc.)
  const rawBassEnergy = spectrum.rawSubBassEnergy + spectrum.rawBassOnlyEnergy;

  // ── Step 1: BRUTE FORCE FLUX (onset energy — rising edges only) ────
  const subEnergy = spectrum.rawSubBassEnergy;
  const rawLowFlux = Math.max(0, subEnergy - prevSubEnergy);
  prevSubEnergy = subEnergy;

  const bassOnlyEnergy = spectrum.rawBassOnlyEnergy;
  const bassOnlyFlux = Math.max(0, bassOnlyEnergy - prevBassOnlyEnergy);
  prevBassOnlyEnergy = bassOnlyEnergy;

  const midEnergy = spectrum.rawMidEnergy;
  const rawMidFlux = Math.max(0, midEnergy - prevMidEnergy);
  prevMidEnergy = midEnergy;

  const centroidHz = spectrum.spectralCentroid;

  // Full bass flux = sub-bass flux + bass-only flux (20-250Hz onset)
  const rawBassFlux = rawLowFlux + bassOnlyFlux;

  // -- Step 2: CENTROID-BASED GATING (WAVE 2169 REV1) ---------------
  // WAVE 2169 original: Bozal gated bass with midFlux > 0.001.
  // PRODUCTION FAILURE: Brejcha minimal techno kicks are SUB-BASS PURE
  // (centroid 60-200Hz). They have almost no mid-range energy — the
  // "click" of the beater is mixed out. The Bozal was killing real kicks.
  //
  // NEW LOGIC: Use spectral centroid as the primary arbiter.
  //
  //   centroid < 800Hz  → pure sub/bass transient → PASS (it's a kick)
  //   centroid > 1500Hz → bright transient → SNIPER (it's a hi-hat/cymbal)
  //   800-1500Hz grey zone → pass only if bassFlux is significant (> 0.01)
  //
  // This is deterministic: centroid is a physical measurement of where
  // the energy is concentrated. No guessing.
  let needle = 0;
  // WAVE 2170: Floor raised from 0.005 → 0.030.
  // At 0.005, the gradual decay of bass energy after a kick produces
  // frame-to-frame flux of 0.006-0.020 that falsely triggered the tracker.
  // Real Brejcha kick onsets measured in production: 0.07-0.28.
  // Bass decay residue: 0.006-0.022. Hard separation at ~0.03.
  if (rawBassFlux > 0.030) { // floor: eliminates inter-beat bass decay tails
    if (centroidHz < 800) {
      // Pure bass/sub-bass transient — kick drum territory
      needle = rawBassFlux;
    } else if (centroidHz < 1500) {
      // Grey zone: could be kick+snare overlap or bass guitar
      // Pass only if there's a meaningful bass flux
      if (rawBassFlux > 0.040) {
        needle = rawBassFlux;
      }
    }
    // centroidHz >= 1500 → bright (hi-hat, cymbal, snare top) → needle stays 0
  }

  // -- Step 3: THE SNIPER (El Francotirador) — redundant guard ------
  // Belt-and-suspenders: if somehow a bright transient leaked through
  // (e.g. a snare hit with heavy low-end boosting centroid to border zone),
  // kill it if centroid is clearly bright.
  if (needle > 0.015 && centroidHz > 1500) {
    needle = 0; // SNIPED -- bright transient, not a kick
  }

  // -- Step 3b: SHADOW LOGGER (WAVE 2172) — capture real telemetry ---
  // Collects 1000 frames (~46s) of live audio data for offline replay.
  // Writes once to disk, then goes silent. Zero runtime cost after dump.
  if (!shadowDumped && shadowLog.length < MAX_SHADOW_FRAMES) {
    shadowLog.push({
      timestampMs: deterministicTimestampMs,
      rawLowFlux,
      rawMidFlux,
      rawBassFlux,
      centroid: centroidHz,
      needle,
    });

    if (shadowLog.length === MAX_SHADOW_FRAMES) {
      try {
        const dumpPath = require('path').join(process.cwd(), 'test-data', 'live_audio_dump.json');
        require('fs').mkdirSync(require('path').dirname(dumpPath), { recursive: true });
        require('fs').writeFileSync(dumpPath, JSON.stringify(shadowLog, null, 2));
        console.log(`[SHADOW LOGGER] 🎯 DUMP COMPLETE: ${MAX_SHADOW_FRAMES} frames → ${dumpPath}`);
        shadowDumped = true;
      } catch (e) {
        console.error('[SHADOW LOGGER] ❌ Dump failed:', e);
      }
    }
  }

  // -- Step 4: DIRECT INJECTION ---------------------------------------
  // Feed the clean 1-frame spike to the interval tracker.
  // The tracker's internal rolling average, ratio detection, and adaptive
  // debounce operate on these spikes -- each spike is one potential kick.
  const bpmResult = bpmTracker.process(
    needle,
    false,
    deterministicTimestampMs
  );

  // WAVE 2169: DIAGNOSTIC TELEMETRY -- Every 20 frames (~0.9s)
  if (state.frameCount % 20 === 0) {
    const [pocketMin, pocketMax] = getPocketBounds()
    const musicalBpm = bpmTracker.getMusicalBpm(pocketMin, pocketMax);
    console.log(
      `[INTERVAL] F${state.frameCount}` +
      ` bpm=${musicalBpm}` +
      ` raw=${bpmResult.bpm}` +
      ` conf=${bpmResult.confidence.toFixed(3)}` +
      ` kick=${bpmResult.kickDetected}` +
      ` phase=${bpmResult.beatPhase.toFixed(2)}` +
      ` needle=${needle.toFixed(4)}` +
      ` bassFlux=${rawBassFlux.toFixed(4)}` +
      ` midFlux=${rawMidFlux.toFixed(4)}` +
      ` centroid=${Math.round(centroidHz)}Hz` +
      ` kicks=${bpmResult.kickCount}`
    );
  }

  // Update Worker BPM state — direct from IntervalBPMTracker
  // WAVE 2175: use getMusicalBpm() — the Dance Pocket Folder output.
  // bpmResult.bpm is the RAW tracker output (may be 185 BPM for tresillo techno).
  // getMusicalBpm() folds it into the dance pocket [90-135]: 185/1.5 = 123 BPM.
  // The raw bpm is still visible in the [INTERVAL] diagnostic log above.
  if (bpmResult.confidence > 0.05) {
    state.currentBpm = bpmTracker.getMusicalBpm(pocketMin, pocketMax);
    state.bpmConfidence = bpmResult.confidence;
    state.beatPhase = bpmResult.beatPhase;
  }
  if (bpmResult.kickDetected) {
    // 🕐 WAVE 2115: lastBeatTime en musical clock — consistente con el tracker
    state.lastBeatTime = deterministicTimestampMs;
  }
  
  // Calculate overall energy (weighted by perceptual importance)
  const rawEnergy = (spectrum.bass * 0.5 + spectrum.mid * 0.3 + spectrum.treble * 0.2);
  
  // 🎯 WAVE 16: Normalizar energía con Rolling Peak 15s
  const energyNormalizer = getEnergyNormalizer();
  const normalizedEnergy = energyNormalizer.normalize(rawEnergy);
  const energy = normalizedEnergy;
  
  // === PHASE 3: Wave 8 Rich Analysis ===
  // 🥁 WAVE 2112: BPM fields are REAL again — from GodEarBPMTracker
  const audioMetrics: AudioMetrics = {
    bass: spectrum.bass,
    mid: spectrum.mid,
    treble: spectrum.treble,
    volume: energy,
    bpm: state.currentBpm,
    bpmConfidence: state.bpmConfidence,
    onBeat: bpmResult.kickDetected || spectrum.kickDetected,
    beatPhase: state.beatPhase,
    timestamp: Date.now(),
    dominantFrequency: spectrum.dominantFrequency,
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
  // � WAVE 2161: Beat state from GodEarBPMTracker (fresh, in-worker)
  const beatState = {
    bpm: state.currentBpm,
    confidence: state.bpmConfidence,
    onBeat: bpmResult.kickDetected || spectrum.kickDetected,
    phase: state.beatPhase,
    beatCount: bpmResult.kickCount
  };
  
  const metricsForMood = {
    ...audioMetrics,
    energy: energy,
    beatConfidence: state.bpmConfidence,
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
      bpm: state.currentBpm,  // 🥁 WAVE 2112: Worker knows BPM again
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
    
    // � WAVE 2161: BPM fields REAL — from GodEarBPMTracker in Worker
    bpm: state.currentBpm,
    bpmConfidence: state.bpmConfidence,
    onBeat: bpmResult.kickDetected || spectrum.kickDetected,
    beatPhase: state.beatPhase,
    beatStrength: bpmResult.kickDetected ? 1 : 0,
    
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
        // WAVE 2098: Boot silence
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

        // ══════════════════════════════════════════════════════════════
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
        // 🔥 WAVE 2180: also update pocket bounds for BPM folding
        currentVibeId = vibePayload.vibeId
        console.log(`[BETA] 🎯 WAVE 289.5: Vibe set to "${vibePayload.vibeId}" for SectionTracker | pocket=${getPocketBounds()}`);
        break;
      
      // 🥁 WAVE 2112: SET_BPM now a no-op — Worker computes its own BPM via GodEarBPMTracker
      // Pacemaker BPM is no longer needed here. Worker is the source of truth.
      case MessageType.SET_BPM:
        // Acknowledged but ignored — Worker has fresh BPM from GodEarBPMTracker
        break;
      
      // 🧨 WAVE 2161: AMNESIA PROTOCOL — Hard reset on Vibe change
      // A vibe change = near-certain song change. Wipe BPM tracker memory
      // so the engine listens to the new track with a clean slate.
      case MessageType.RESET_PACEMAKER:
        bpmTracker.reset();
        prevSubEnergy = 0;
        prevBassOnlyEnergy = 0;
        prevMidEnergy = 0;
        console.log('[BETA] 🧨 WAVE 2168: IntervalBPMTracker HARD RESET — Amnesia Protocol executed');
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
  // WAVE 2098: Boot silence
  
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
