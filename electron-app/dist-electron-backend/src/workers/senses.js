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
// �️ WAVE 670: AGC - Normalización de buffer ANTES del FFT
// CRITICAL: Sin esto, los Z-Scores del WAVE 660 son ficción matemática
import { getAGC } from './utils/AutomaticGainControl';
// �🌈 WAVE 47.1: MoodSynthesizer - VAD Emotional Analysis
// WAVE 254: Migrado desde selene-lux-core a engine/consciousness
import { MoodSynthesizer } from '../engine/consciousness/MoodSynthesizer';
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
    currentBpm: 120,
    bpmHistory: [],
    beatPhase: 0,
    lastBeatTime: Date.now(),
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
class BeatDetector {
    constructor() {
        this.historySize = 43; // ~1 second at 44100Hz/1024 samples
        this.energyHistory = [];
        this.lastPeakTime = 0;
        this.beatIntervals = [];
        // 🚑 RESCUE DIRECTIVE: AGC (Auto-Gain Control)
        this.maxEnergyHistory = [];
        this.maxEnergyWindowSize = 1290; // ~30 seconds at 43 frames/sec
        this.currentMaxEnergy = 0.01; // Start with small value to avoid division by zero
    }
    analyze(buffer, _sampleRate) {
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
        // 🎯 WAVE 262: Reduced threshold from 1.5 to 1.2 for better beat detection
        // Music with consistent energy (like EDM kicks) needs a lower threshold
        const threshold = avgEnergy * 1.2;
        // Detect peak (beat) - use normalized energy
        const timeSinceLastBeat = now - this.lastPeakTime;
        const onBeat = normalizedEnergy > threshold && timeSinceLastBeat > 200; // Min 200ms between beats
        // 🔍 WAVE 262 DEBUG: Log beat detection status every ~2 seconds
        if (this.energyHistory.length % 86 === 0) {
            console.log(`[BEAT 🥁] nE=${normalizedEnergy.toFixed(2)} avg=${avgEnergy.toFixed(2)} thresh=${threshold.toFixed(2)} | intervals=${this.beatIntervals.length} | conf=${(this.beatIntervals.length >= 4 ? 'calculating' : '0.000')}`);
        }
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
    constructor(sampleRate = 44100) {
        this.lastSpectralFlux = 0;
        this.prevEnergy = 0;
        this.frameCount = 0;
        this.lastGodEarResult = null;
        // 🩻 GOD EAR con 4096 muestras para resolución máxima
        this.godEar = new GodEarAnalyzer(sampleRate, 4096);
        console.log('[BETA] � GOD EAR Analyzer initialized (WAVE 1017: THE TRANSPLANT)');
        console.log('[BETA] 💀 Blackman-Harris | LR4 24dB/oct | 7 Tactical Bands');
    }
    analyze(buffer, sampleRate) {
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
            bpm: state.currentBpm,
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
    // === PHASE 1: Basic Beat Detection ===
    const beatResult = beatDetector.analyze(buffer, config.audioSampleRate);
    // Update BPM smoothing
    // 🎯 WAVE 261.5: Bajamos umbral de 0.5 a 0.3 para que el BPM se actualice más fácilmente
    // La confianza alta es difícil de alcanzar con audio de sistema (loopback)
    if (beatResult.confidence > 0.3) {
        state.bpmHistory.push(beatResult.bpm);
        if (state.bpmHistory.length > 10) {
            state.bpmHistory.shift();
        }
        state.currentBpm = Math.round(state.bpmHistory.reduce((a, b) => a + b, 0) / state.bpmHistory.length);
        // 🎯 WAVE 261.5: Log BPM updates para debug
        if (state.frameCount % 120 === 0) {
            console.log(`[BETA 🥁] BPM UPDATED: ${state.currentBpm} (raw=${beatResult.bpm}, conf=${beatResult.confidence.toFixed(2)})`);
        }
    }
    else if (state.frameCount % 300 === 0) {
        // Log cada 5 segundos cuando NO se actualiza
        console.log(`[BETA 🥁] BPM NOT UPDATED - conf=${beatResult.confidence.toFixed(3)} < 0.3 (raw=${beatResult.bpm}, current=${state.currentBpm})`);
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
    const audioMetrics = {
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
        energy: energy, // MoodSynthesizer expects 'energy' not 'volume'
        beatConfidence: beatResult.confidence,
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
            bpm: state.currentBpm,
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
    // Mood from Wave 8 harmony (richer than simple bass/treble)
    let mood = 'neutral';
    if (harmonyOutput.temperature === 'cool')
        mood = 'dark';
    else if (harmonyOutput.temperature === 'warm')
        mood = 'bright';
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
        // === WAVE 8 RICH DATA FOR GAMMA ===
        wave8: {
            rhythm: rhythmOutput,
            harmony: harmonyOutput,
            section: sectionOutput,
            genre: genreOutput, // GenreAnalysis casted to GenreOutput
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
        currentBpm: state.currentBpm,
        bpmHistory: [...state.bpmHistory],
        beatPhase: state.beatPhase,
        messagesProcessed: state.messagesProcessed
    };
}
function restoreStateSnapshot(snapshot) {
    if (typeof snapshot === 'object' && snapshot !== null) {
        const s = snapshot;
        if (typeof s.frameCount === 'number')
            state.frameCount = s.frameCount;
        if (typeof s.currentBpm === 'number')
            state.currentBpm = s.currentBpm;
        if (Array.isArray(s.bpmHistory))
            state.bpmHistory = s.bpmHistory;
        if (typeof s.beatPhase === 'number')
            state.beatPhase = s.beatPhase;
    }
    console.log(`[BETA] State restored: frame ${state.frameCount}, BPM ${state.currentBpm}`);
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
    console.log('[BETA] 👂 Worker thread started, waiting for INIT...');
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
