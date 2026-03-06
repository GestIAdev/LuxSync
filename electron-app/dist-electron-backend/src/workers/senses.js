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
import { MessageType, MessagePriority, createMessage, DEFAULT_CONFIG } from './WorkerProtocol';
// ═══════════════════════════════════════════════════════════════════════════════
// � WAVE 1017: THE TRANSPLANT - GOD EAR FFT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
// El viejo FFT.ts ha sido reemplazado por el espectroscopio quirúrgico GOD EAR.
// Blackman-Harris windowing, Linkwitz-Riley 4th order, 7 bandas tácticas.
// ═══════════════════════════════════════════════════════════════════════════════
import { GodEarAnalyzer, toLegacyFormat } from './GodEarFFT';
// 💓 WAVE 2130: THE PHOENIX PROTOCOL — PacemakerV2 IOI Engine
// Resurrected Inter-Onset Interval detection using GodEar's SlopeBasedOnsetDetector.
// Proven 74-190 BPM ±2 across genres. Immune to continuous basslines.
import { PacemakerV2 } from './PacemakerV2';
// Wave 8 Bridge - Analizadores simplificados para Worker
import { SimpleRhythmDetector, SimpleHarmonyDetector, SimpleSectionTracker, } from './TrinityBridge';
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
import { getAGC } from './utils/AutomaticGainControl';
// 🌈 WAVE 47.1: MoodSynthesizer - VAD Emotional Analysis
// WAVE 254: Migrado desde selene-lux-core a engine/consciousness
// WAVE 2026: Migrado a engine/musical/classification
import { MoodSynthesizer } from '../engine/musical/classification/MoodSynthesizer';
// ============================================
// CONFIGURATION
// ============================================
const config = workerData?.config ?? DEFAULT_CONFIG;
const NODE_ID = 'beta';
const state = {
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
    // 🥁 WAVE 2133: THE GROOVE CLARIFIER — estado inicial del flux
    prevLows: 0,
    prevMids: 0,
};
// ============================================
// BEAT DETECTION
// ============================================
// ═══════════════════════════════════════════════════════════════════════════════
// 💓 WAVE 2130: THE PHOENIX PROTOCOL — PacemakerV2 replaces GodEarBPMTracker
// ═══════════════════════════════════════════════════════════════════════════════
// The autocorrelation engine (GodEarBPMTracker) was proven architecturally unfit
// for production audio: 97% failure rate on 128 BPM Minimal Techno (291 frames).
// 
// PacemakerV2 uses GodEar's SlopeBasedOnsetDetector (transients.kick) as input
// and calculates BPM via Inter-Onset Interval clustering. Simple. Brutal. Works.
//
// The GodEarBPMTracker is preserved as a WASM candidate — its autocorrelation
// math is beautiful and will shine with higher-resolution buffers in the future.
// ═══════════════════════════════════════════════════════════════════════════════
const pacemakerV2 = new PacemakerV2();
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
    constructor(sampleRate = 44100) {
        this.lastSpectralFlux = 0;
        this.prevEnergy = 0;
        this.frameCount = 0;
        this.lastGodEarResult = null;
        // 🩻 GOD EAR con 4096 muestras para resolución máxima
        this.godEar = new GodEarAnalyzer(sampleRate, 4096);
        // WAVE 2098: Boot silence
    }
    analyze(buffer, sampleRate) {
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
        };
    }
    /**
     * Acceso directo al resultado GOD EAR para métricas avanzadas
     */
    getLastGodEarResult() {
        return this.lastGodEarResult;
    }
    reset() {
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
function processAudioBuffer(incomingBuffer) {
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
            bpm: 0, // 🔪 WAVE 2090.2: Worker no longer computes BPM
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
    // ═══════════════════════════════════════════════════════════════════════════
    // 💓 WAVE 2130: THE PHOENIX PROTOCOL — PacemakerV2 IOI BPM Detection
    // ═══════════════════════════════════════════════════════════════════════════
    // The autocorrelation engine (GodEarBPMTracker) died in production:
    //   291 frames → 97% garbage (92, 94, 167, 178, 186 BPM on 128 BPM music)
    //
    // PacemakerV2 uses the GodEar's OWN transient detector (SlopeBasedOnsetDetector)
    // which already computes kick onset booleans from rawBands.subBass + rawBands.bass.
    // No flux, no autocorrelation, no upsampling. Just: "Was there a kick? When?"
    //
    // The IOI clustering then groups intervals by similarity (±15ms tolerance)
    // and the largest cluster's BPM wins. A single offbeat is statistically
    // irrelevant against 20+ correct kick intervals.
    // ═══════════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    // 💓 WAVE 2133: THE GROOVE CLARIFIER — Multiband Spectral Flux
    // ═══════════════════════════════════════════════════════════════════════════
    // PROBLEMA: rawSubBassEnergy es AMPLITUD CRUDA. El bajo eléctrico de géneros
    // latinos (cumbia, reggaeton) vive en subBass/bass con energía SOSTENIDA
    // (~0.030 constante). El P99 ceiling se fija en ese bajo eléctrico → el
    // threshold mide offbeats del bajo, no golpes de bombo.
    //
    // SOLUCIÓN: Spectral Flux = derivada positiva de la energía por banda.
    //   - Bajo eléctrico sostenido: frame N=0.035, frame N+1=0.034 → delta=0
    //   - Kick real:                frame N=0.005, frame N+1=0.045 → delta=0.040 (EXPLOSIÓN)
    //
    // El flux es 0 la mayor parte del tiempo → el P99 aterriza en el pico de
    // ataque real, no en el relleno tonal. Válido para todos los géneros.
    // ═══════════════════════════════════════════════════════════════════════════
    // 1. Agrupar bandas (Graves para el peso sísmico, Medios para el clic del parche)
    const currentLows = spectrum.rawSubBassEnergy + spectrum.rawBassOnlyEnergy;
    const currentMids = spectrum.mid + spectrum.highMid;
    // 2. Flux Espectral Positivo: solo importa cuando la energía SUBE de golpe
    const deltaLows = Math.max(0, currentLows - state.prevLows);
    const deltaMids = Math.max(0, currentMids - state.prevMids);
    // 3. Guardar estado para el siguiente frame
    state.prevLows = currentLows;
    state.prevMids = currentMids;
    // 4. "Rhythmic Punch" — WAVE 2142: SNARE KILLER (Bass Gate v3 + Low Dominance)
    //
    //    WAVE 2141 bajó el gate a 0.012 → demasiado permisivo. Brejcha "Gravity"
    //    tiene snares y claps con dL=0.035-0.052 y dM=0.043-0.050. Con la fórmula
    //    anterior (deltaLows + deltaMids×0.5), un snare con dL=0.040/dM=0.047 generaba
    //    punch=0.064 — más alto que un kick suave. Eso inundaba el Pacemaker con
    //    intervalos falsos (~238ms = off-beat) → clusters espurios → 161 BPM.
    //
    //    DOS CORRECCIONES:
    //    A) Gate: 0.012 → 0.015. Kills voz (dL<0.010) y snares leves (dL<0.015).
    //       Los kicks de transición de Brejcha con dL=0.015-0.017 ahora pasan.
    //       Los snares fuertes con dL>0.015 aún pasan, PERO...
    //    B) Factor mids: 0.5 → 0.20. El bajo domina 5:1 sobre los medios.
    //       Kick real:     dL=0.055 dM=0.035 → punch = 0.055 + 0.007 = 0.062 ✅
    //       Snare fuerte:  dL=0.040 dM=0.047 → punch = 0.040 + 0.009 = 0.049 (menor)
    //       El kick sigue ganando sobre el snare por su mayor energía de bajos.
    //
    //    No es un hack — es calibración basada en física: los bombos viven en lows,
    //    los snares en mids. El peso 5:1 refleja esa realidad espectral.
    let rhythmicPunch = 0;
    if (deltaLows >= 0.015) {
        // Lows dominan 5:1 sobre mids — snares y claps son ciudadanos de segunda clase
        rhythmicPunch = deltaLows + (deltaMids * 0.20);
    }
    const godEarBpmResult = pacemakerV2.process(spectrum.kickDetected, // Boolean onset del SlopeBasedOnsetDetector de GodEar
    rhythmicPunch, // 💓 WAVE 2142: Bass Gate — 0 si deltaLows < 0.015 | mids×0.20
    deterministicTimestampMs);
    // 🔬 WAVE 2133: TELEMETRY — Cada 100 frames (~6.5s) y en cada onset
    if (state.frameCount % 100 === 0 || godEarBpmResult.kickDetected) {
        console.log(`[PM2 🩺] F${state.frameCount}` +
            ` adaptive=${godEarBpmResult.kickDetected}` +
            ` punch=${rhythmicPunch.toFixed(4)}` +
            ` (dL=${deltaLows.toFixed(4)} dM=${deltaMids.toFixed(4)})` +
            ` bpm=${godEarBpmResult.bpm}` +
            ` conf=${godEarBpmResult.confidence.toFixed(3)}` +
            ` kicks=${godEarBpmResult.kickCount}`);
    }
    // Update Worker BPM state from PacemakerV2
    if (godEarBpmResult.confidence > 0.25) {
        state.currentBpm = godEarBpmResult.bpm;
        state.bpmConfidence = godEarBpmResult.confidence;
        state.beatPhase = godEarBpmResult.beatPhase;
    }
    if (godEarBpmResult.kickDetected) {
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
    const audioMetrics = {
        bass: spectrum.bass,
        mid: spectrum.mid,
        treble: spectrum.treble,
        volume: energy,
        bpm: state.currentBpm,
        bpmConfidence: state.bpmConfidence,
        onBeat: godEarBpmResult.kickDetected || spectrum.kickDetected,
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
    // 🥁 WAVE 2112: Beat state from GodEarBPMTracker (fresh, in-worker)
    const beatState = {
        bpm: state.currentBpm,
        confidence: state.bpmConfidence,
        onBeat: godEarBpmResult.kickDetected || spectrum.kickDetected,
        phase: state.beatPhase,
        beatCount: godEarBpmResult.kickCount
    };
    const metricsForMood = {
        ...audioMetrics,
        energy: energy,
        beatConfidence: state.bpmConfidence,
        peak: energy,
        frameIndex: state.frameCount
    };
    const moodOutput = moodSynthesizer.process(metricsForMood, beatState);
    // 🗑️ WAVE 61: GenreClassifier ELIMINADO
    // El contexto musical ahora es determinado por VibeManager en GAMMA (selección manual del DJ)
    // Generamos un GenreOutput neutro para compatibilidad con el protocolo
    const genreOutput = {
        primary: 'ELECTRONIC_4X4', // Default neutral
        secondary: null,
        confidence: 0, // Zero confidence = "no genre detection"
        scores: { ELECTRONIC_4X4: 0.5, LATINO_TRADICIONAL: 0.5 },
        genre: 'ELECTRONIC_4X4',
        subgenre: 'none',
        features: {
            bpm: state.currentBpm, // 🥁 WAVE 2112: Worker knows BPM again
            syncopation: rhythmOutput.syncopation ?? 0,
            hasFourOnFloor: rhythmOutput.pattern === 'four_on_floor',
            hasDembow: false,
            trebleDensity: 0,
            has808Bass: false,
            avgEnergy: energy,
        },
        mood: 'neutral', // Neutral mood = let VibeManager decide
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
    state.lastGenreOutput = genreOutput; // GenreAnalysis casted to GenreOutput for compatibility
    // === PHASE 4: Build Response ===
    // 🎵 WAVE 1228: Temperature field neutered - mood is computed in mind.ts instead
    // harmonyOutput.temperature was decoration-only (never consumed by TitanEngine)
    let mood = 'neutral'; // Default neutral
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
        }
        else {
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
        // 🥁 WAVE 2112: BPM fields REAL again — from GodEarBPMTracker in Worker
        bpm: state.currentBpm,
        bpmConfidence: state.bpmConfidence,
        onBeat: godEarBpmResult.kickDetected || spectrum.kickDetected,
        beatPhase: state.beatPhase,
        beatStrength: godEarBpmResult.kickDetected ? 1 : 0,
        // Wave 8 Rhythm (REGLA 3: Syncopation is king)
        syncopation: rhythmOutput.syncopation,
        groove: rhythmOutput.groove,
        // 🎵 WAVE 1228: Phantom Field - subdivision never used, return static value
        subdivision: 4,
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
            genre: genreOutput, // GenreAnalysis casted to GenreOutput
            // 🌈 WAVE 1228: MoodSynthesizer pruning - keep only primary (others are UI decoration)
            // CONSUMED: primary (affects EffectDNA organicity)
            // NOT CONSUMED: valence, arousal, dominance, intensity, stability (phantom fields)
            mood: {
                primary: moodOutput.primary,
                secondary: null, // 🎵 WAVE 1228: Phantom field - rarely used, return null
                valence: 0, // 🎵 WAVE 1228: Phantom field - decoration, static 0
                arousal: 0, // 🎵 WAVE 1228: Phantom field - decoration, static 0
                dominance: 0, // 🎵 WAVE 1228: Phantom field - decoration, static 0
                intensity: 0.5, // 🎵 WAVE 1228: Phantom field - decoration, static neutral
                stability: 1, // 🎵 WAVE 1228: Phantom field - decoration, static 1
            }
        }
    };
}
function calculateZeroCrossingRate(buffer) {
    let crossings = 0;
    for (let i = 1; i < buffer.length; i++) {
        if ((buffer[i] >= 0) !== (buffer[i - 1] >= 0)) {
            crossings++;
        }
    }
    return crossings / buffer.length;
}
// ============================================
// HEALTH REPORTING
// ============================================
function generateHealthReport() {
    const uptime = Date.now() - state.startTime;
    const memUsage = process.memoryUsage();
    // Determine status
    let status = 'healthy';
    if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        status = 'critical';
    }
    else if (memUsage.heapUsed / memUsage.heapTotal > 0.7) {
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
function createStateSnapshot() {
    return {
        frameCount: state.frameCount,
        // 🔪 WAVE 2090.2: BPM state purged from snapshot
        messagesProcessed: state.messagesProcessed
    };
}
function restoreStateSnapshot(snapshot) {
    if (typeof snapshot === 'object' && snapshot !== null) {
        const s = snapshot;
        if (typeof s.frameCount === 'number')
            state.frameCount = s.frameCount;
        // 🔪 WAVE 2090.2: BPM state purged from restore
    }
    console.log(`[BETA] State restored: frame ${state.frameCount}`);
}
// ============================================
// MESSAGE HANDLER
// ============================================
function handleMessage(message) {
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
                const hbPayload = message.payload;
                const ackPayload = {
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
                const buffer = message.payload;
                // 🔍 WAVE 263: Log cada ~5 segundos
                if (state.frameCount % 300 === 0) {
                    console.log(`[BETA 📡] AUDIO_BUFFER #${state.frameCount} | size=${buffer?.length || 0}`);
                }
                const analysis = processAudioBuffer(buffer);
                // ══════════════════════════════════════════════════════════════
                sendMessage(MessageType.AUDIO_ANALYSIS, 'alpha', analysis, analysis.onBeat ? MessagePriority.HIGH : MessagePriority.NORMAL);
                break;
            case MessageType.STATE_RESTORE:
                const snapshot = message.payload;
                restoreStateSnapshot(snapshot.state);
                break;
            case MessageType.CONFIG_UPDATE:
                const newConfig = message.payload;
                Object.assign(config, newConfig);
                // 🔧 WAVE 15.1: Log detallado del inputGain
                if (newConfig.inputGain !== undefined) {
                    console.log(`[BETA] 🎚️ Gain updated to: ${(newConfig.inputGain * 100).toFixed(0)}%`);
                }
                else {
                    console.log('[BETA] Config updated');
                }
                break;
            // 🎯 WAVE 289.5: SET_VIBE - Propagate vibe to SectionTracker
            case MessageType.SET_VIBE:
                const vibePayload = message.payload;
                sectionTracker.setVibe(vibePayload.vibeId);
                console.log(`[BETA] 🎯 WAVE 289.5: Vibe set to "${vibePayload.vibeId}" for SectionTracker`);
                break;
            // 🥁 WAVE 2112: SET_BPM now a no-op — Worker computes its own BPM via GodEarBPMTracker
            // Pacemaker BPM is no longer needed here. Worker is the source of truth.
            case MessageType.SET_BPM:
                // Acknowledged but ignored — Worker has fresh BPM from GodEarBPMTracker
                break;
            // 🧨 WAVE 2140: AMNESIA PROTOCOL — Hard reset on Vibe change
            // A vibe change = near-certain song change. Wipe Pacemaker memory
            // so the engine listens to the new track with a clean slate.
            case MessageType.RESET_PACEMAKER:
                pacemakerV2.reset();
                console.log('[BETA] 🧨 WAVE 2140: PacemakerV2 HARD RESET — Amnesia Protocol executed');
                break;
            default:
                console.warn(`[BETA] Unknown message type: ${message.type}`);
        }
    }
    catch (error) {
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
function sendMessage(type, target, payload, priority = MessagePriority.NORMAL) {
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
    process.on('uncaughtException', (error) => {
        console.error('[BETA] Uncaught exception:', error);
        sendMessage(MessageType.WORKER_ERROR, 'alpha', {
            nodeId: NODE_ID,
            error: error.message,
            fatal: true
        }, MessagePriority.CRITICAL);
    });
    process.on('unhandledRejection', (reason) => {
        console.error('[BETA] Unhandled rejection:', reason);
        sendMessage(MessageType.WORKER_ERROR, 'alpha', {
            nodeId: NODE_ID,
            error: String(reason),
            fatal: false
        }, MessagePriority.CRITICAL);
    });
}
else {
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
