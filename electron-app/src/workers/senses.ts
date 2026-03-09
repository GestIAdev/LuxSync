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

// 🥁 WAVE 2112: THE RESURRECTION — GodEar BPM back in the Worker
// 🎯 WAVE 2161: THE SHARK FIN PROTOCOL — GodEarBPMTracker RESURRECTED
//     WAVEs 2155-2160 proved PacemakerV2 (IOI + debounce) cannot survive
//     Brejcha's syncopation: the debounce gate masks real kicks after eating
//     a single offbeat, fragmenting the 126 BPM interval into 325/372/650ms
//     garbage. The Frequency Sniper (WAVE 2159) kills high-centroid offbeats
//     perfectly, but it can't un-mask the debounce gate.
//
//     Autocorrelation has NO debounce gate. It correlates the ENTIRE energy
//     buffer and finds periodicity mathematically. The old failure (WAVE 2151)
//     was caused by needle spikes too thin to overlap — fixed by the Shark Fin
//     envelope follower (decay 0.85/frame) which fattens each spike into a
//     broad hump that survives ±2 frame jitter in autocorrelation multiplication.
//
// 🪦 PacemakerV2 + HarmonicGearbox archived. They did their best.
//     Kept in codebase as historical reference.
// import { PacemakerV2 } from './PacemakerV2';
// import { GearboxStabilizer } from './HarmonicGearbox';
import { GodEarBPMTracker } from './GodEarBPMTracker';

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
// � WAVE 2151: THE LAZARUS PROTOCOL — GodEarBPMTracker resurrected
// ═══════════════════════════════════════════════════════════════════════════════
// PacemakerV2 (IOI) died in production: Boris Brejcha 126 BPM → 185→161→92→99
// across 20 WAVEs of surgery. The onset classification problem is GENETIC:
//   - SlopeBasedOnsetDetector fires on kicks, syncopations, AND ghost notes
//   - Energy range of real kicks (0.05-0.22) overlaps with syncopation energy
//   - Every heuristic (Dynamic Armor, Muscle Memory, P99 Ceiling) killed real kicks
//
// GodEarBPMTracker (autocorrelation) was abandoned at WAVE 2130 because of
// octave bounce — but that was caused by BROKEN FFT (SplitX Radix was kaputt).
// Since WAVE 2096.1, GodEarFFT Radix-2 DIT sends CLEAN spectral data.
// 🎯 WAVE 2161: THE SHARK FIN PROTOCOL — GodEarBPMTracker resurrected.
// Autocorrelation receives FAT NEEDLES (envelope-followed low flux),
// NOT thin spikes. The Shark Fin decay (0.85/frame) widens each onset
// so the autocorrelation overlap produces clean periodicity mountains.
// ═══════════════════════════════════════════════════════════════════════════════

const bpmTracker = new GodEarBPMTracker();

// 🦈 WAVE 2161: Shark Fin envelope state — persists across frames.
// Each onset explodes to its raw value, then decays ×0.85 per frame.
// This fattens the 1-frame spike into a ~10-frame hump that the
// autocorrelation can overlap even with ±2 frame jitter.
let fatNeedle = 0;

// 🔬 WAVE 2160: Persistent state for raw low flux computation.
// Previous frame's sub-bass energy — needed to compute delta (rising edge).
// Module-scope to survive across processAudioFrame() calls.
let prevSubEnergy = 0;

// 🔬 WAVE 2164: Persistent state for mid flux (Needle Protocol).
// The multiplicative needle requires both sub AND mid to rise simultaneously.
// A pure rolling bass has zero mid content → needle = 0. Impostor slain.
let prevMidEnergy = 0;

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
  // 🪦 WAVE 2162: EL FRANCOTIRADOR HA SIDO DESPEDIDO.
  //
  // AUTOPSIA 1 (logboris.md):
  // El Sniper mataba por centroide alto, asumiendo "centroide alto = contratiempo".
  // ¡EN MINIMAL TECHNO ES AL REVÉS!
  //   - El bombo real lleva un "click" de ataque a 5000Hz+ para sonar fuerte en club
  //   - El bajo a contratiempo es una senoidal pura y SORDA (~200Hz centroide)
  //
  // Evidencia del log de Brejcha:
  //   F700  🎯SNIPED(5458Hz)  ← ¡ERA UN BOMBO REAL!
  //   F1300 🎯SNIPED(5260Hz)  ← ¡ERA UN BOMBO REAL!
  //
  // Al matar los bombos, lo único que sobrevivía era el bajo sincopado.
  // El Autocorrelador leía la velocidad del bajo (188 BPM) perfectamente.
  //
  // La Autocorrelación es un motor de PATRONES GLOBALES. No necesita
  // pre-filtrado. Las aletas de tiburón del bombo (energía masiva) siempre
  // dominan el patrón por encima de los contratiempos (energía menor).
  // La fuerza bruta de la periodicidad matemática es suficiente.
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧩 WAVE 2164: EXODIA — El Motor Definitivo (5 Piezas Ensambladas)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Historia completa de por qué cada pieza existe:
  //
  // PIEZA 2 — Aguja Multiplicativa (restaurada de WAVE 2155):
  //   El Bajo Rodante (sub-bass sincopado de Minimal Techno) tiene centroide
  //   bajísimo (~80-200Hz), igual que el bombo. El Sniper no puede distinguirlos.
  //   SOLUCIÓN: Exigir que haya una explosión simultánea en Graves Y en Medios.
  //   Los bombos reales tienen un "click" de ataque en los medios (800-3000Hz).
  //   El bajo puro es una senoidal → rawMidFlux ≈ 0 → needle = √(X × 0) = 0.
  //   Bajo rodante a contratiempo: ANIQUILADO matemáticamente.
  //
  // PIEZA 3 — Francotirador (WAVE 2163, rehabilitado con AGC fix de WAVE 2162):
  //   Para el caso Bajo + Platillo simultáneo: rawMidFlux > 0 (el platillo tiene
  //   medios) → pasa la aguja multiplicativa. Pero el centroide global se dispara
  //   a >3000Hz por el platillo. El Sniper lo intercepta aquí.
  //   Con el AGC ANTES del FFT (WAVE 2162), el centroide es real y no bombeado.
  //
  // TABLA DE DECISIONES:
  //   | Evento                  | rawLowFlux | rawMidFlux | centroid | needle |
  //   |-------------------------|------------|------------|----------|--------|
  //   | Bombo puro (sub-kick)   | +0.120     | +0.030     | 90Hz     | ✅ OK  |
  //   | Bombo + click (transnt) | +0.095     | +0.060     | 400Hz    | ✅ OK  |
  //   | Bajo rodante puro       | +0.080     | ~0.000     | 120Hz    | 🔇 0   |
  //   | Bajo + platillo         | +0.070     | +0.040     | 5500Hz   | 🎯 0   |
  //   | Hi-hat solo             | ~0.002     | +0.015     | 7000Hz   | ~0 (min flux) |
  // ═══════════════════════════════════════════════════════════════════════════

  // PIEZA 1: Deltas puros (FFT ya corre sobre audio crudo — WAVE 2162)
  const subEnergy = spectrum.rawSubBassEnergy + spectrum.rawBassOnlyEnergy;  // 0-200Hz
  const midEnergy = spectrum.rawMidEnergy;  // 800-3000Hz — el "click" del bombo

  const rawLowFlux = Math.max(0, subEnergy - prevSubEnergy);
  const rawMidFlux = Math.max(0, midEnergy - prevMidEnergy);

  prevSubEnergy = subEnergy;
  prevMidEnergy = midEnergy;

  // PIEZA 2: Aguja Multiplicativa — mata el bajo puro (rawMidFlux ≈ 0 → needle = 0)
  let needle = Math.sqrt(rawLowFlux * rawMidFlux);

  // PIEZA 3: Francotirador — mata el bajo + platillo (centroide brillante)
  const centroidHz = spectrum.spectralCentroid;
  const CENTROID_CEILING_HZ = 1500;
  const SNIPER_MIN_FLUX = 0.015;

  if (needle > SNIPER_MIN_FLUX && centroidHz > CENTROID_CEILING_HZ) {
    needle = 0; // 🎯 SNIPED
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🦈 WAVE 2161: THE SHARK FIN — Envelope Follower for Autocorrelation
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // WHY: Autocorrelation works by sliding the signal over itself and
  // multiplying. A 1-frame spike (the old "needle") produces a nonzero
  // product ONLY when two spikes align EXACTLY at the same lag. If the
  // DJ has any swing, groove, or pitch nudge, the spikes miss by 1 frame
  // and multiply to zero → energy=0.0000 → autocorrelation collapses.
  //
  // THE FIX: Instead of a 1-frame spike, create a "Shark Fin" — an
  // exponential decay envelope. The onset explodes to its raw value,
  // then decays ×0.85 per frame (~46ms). After 10 frames (~460ms) it's
  // at 0.85^10 ≈ 0.20 — still significant. After 20 frames it's 0.04.
  //
  // When autocorrelation slides two Shark Fins against each other, even
  // with ±2 frame jitter, the humps OVERLAP and produce a strong positive
  // product at the correct lag. The periodicity mountain at 126 BPM
  // becomes unmistakable.
  //
  //   Frame:  |  1    2    3    4    5    6    7    8    9   10
  //   Spike:  |  1.0  0    0    0    0    0    0    0    0    0
  //   Fin:    |  1.0  0.85 0.72 0.61 0.52 0.44 0.37 0.32 0.27 0.23
  //
  // DECAY = 0.85: At ~46ms/frame, half-life ≈ 4.3 frames ≈ 200ms.
  // A 126 BPM beat (476ms interval) has ~10 frames between kicks.
  // The tail of kick N (~0.20) still overlaps with the rise of kick N+1.
  // ═══════════════════════════════════════════════════════════════════════════
  const SHARK_FIN_DECAY = 0.85;
  fatNeedle = Math.max(needle, fatNeedle * SHARK_FIN_DECAY);

  // Feed the Shark Fin to GodEarBPMTracker (autocorrelation engine):
  //   energy = fatNeedle   → 🦈 WAVE 2161: envelope-followed, snipered low flux
  //   kickDetected = false → tracker uses its own internal kick detection
  //   timestamp = deterministic musical clock
  const acResult = bpmTracker.process(
    fatNeedle,
    false,
    deterministicTimestampMs
  );

  // WAVE 2164: DIAGNOSTIC TELEMETRY — Every 20 frames (~0.9s)
  if (state.frameCount % 20 === 0) {
    const sniperTag = (needle === 0 && Math.sqrt(rawLowFlux * rawMidFlux) > SNIPER_MIN_FLUX)
      ? ` 🎯SNIPED(${Math.round(centroidHz)}Hz)`
      : '';
    const needleRaw = Math.sqrt(rawLowFlux * rawMidFlux).toFixed(4);
    console.log(
      `[SHARK] F${state.frameCount}` +
      ` bpm=${acResult.bpm}` +
      ` conf=${acResult.confidence.toFixed(3)}` +
      ` kick=${acResult.kickDetected}` +
      ` phase=${acResult.beatPhase.toFixed(2)}` +
      ` lowFlux=${rawLowFlux.toFixed(4)}` +
      ` midFlux=${rawMidFlux.toFixed(4)}` +
      ` needle=${needleRaw}` +
      ` fin=${fatNeedle.toFixed(4)}` +
      ` centroid=${Math.round(centroidHz)}Hz` +
      ` samples=${acResult.kickCount}` +
      sniperTag
    );
  }

  // Update Worker BPM state — direct from autocorrelation (no Gearbox needed)
  if (acResult.confidence > 0.05) {
    state.currentBpm = acResult.bpm;
    state.bpmConfidence = acResult.confidence;
    state.beatPhase = acResult.beatPhase;
  }
  if (acResult.kickDetected) {
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
    onBeat: acResult.kickDetected || spectrum.kickDetected,
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
    onBeat: acResult.kickDetected || spectrum.kickDetected,
    phase: state.beatPhase,
    beatCount: acResult.kickCount
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
    onBeat: acResult.kickDetected || spectrum.kickDetected,
    beatPhase: state.beatPhase,
    beatStrength: acResult.kickDetected ? 1 : 0,
    
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
        console.log(`[BETA] 🎯 WAVE 289.5: Vibe set to "${vibePayload.vibeId}" for SectionTracker`);
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
        fatNeedle = 0;
        prevSubEnergy = 0;
        prevMidEnergy = 0;
        console.log('[BETA] 🧨 WAVE 2164: GodEarBPMTracker + SharkFin + Needle HARD RESET — Amnesia Protocol executed');
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
