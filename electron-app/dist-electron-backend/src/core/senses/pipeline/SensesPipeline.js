/**
 * 🔧 WAVE 3504-EXT.5 — SensesPipeline
 *
 * Coordinador del pipeline completo de análisis de audio del Worker BETA.
 *
 * Reemplaza la función `processAudioBuffer()` de senses.ts como único
 * orquestador de la cadena de procesamiento: Ring Buffer → FFT → AGC →
 * BPMService → EnergyNormalizer → Wave8 → buildPayload.
 *
 * ORDEN DE OPERACIONES (blueprint section 2.5):
 *   1. [WAVE 3418] Capturar peak/RMS del buffer crudo (telemetría de entrada)
 *   2. ringBuffer.writeAndSnapshot(incoming) → si no está lleno, early exit
 *   3. [WAVE 2162] SpectrumAnalyzer.analyze sobre snapshot crudo (SIN AGC)
 *   4. [WAVE 670]  AGC.processBuffer + applyInputGain (normalizar para UI/Wave8)
 *   5. [WAVE 2307] Calcular deterministicTimestampMs desde muestras acumuladas
 *   6. BPMService.processFrame(spectrum, deterministicTimestampMs) → BPMOutput
 *   7. [WAVE 16]   EnergyNormalizer.normalize(rawEnergy)
 *   8. Construir AudioMetrics para SectionTracker
 *   9. SectionTracker.analyze → Wave8Output
 *  10. buildPayload → ExtendedAudioAnalysis
 *
 * Worker-agnostic: cero dependencias de parentPort, IPC ni SharedRingBuffer.
 * El Worker shell (senses.ts) llama a processFrame() sobre cada buffer y
 * envía el resultado directamente a ALPHA.
 */
import { AudioRingBuffer } from '../io/AudioRingBuffer';
import { SpectrumAnalyzer } from '../spectrum/SpectrumAnalyzer';
import { BPMService } from '../services/BPMService';
import { SectionTracker } from '../tracking/SectionTracker';
import { buildPayload } from '../io/AnalysisResponseBuilder';
import { getAGC, resetAGC } from '../../../workers/utils/AutomaticGainControl';
import { getEnergyNormalizer } from '../../../workers/utils/AdaptiveEnergyNormalizer';
// ============================================
// SensesPipeline
// ============================================
/**
 * Pipeline de análisis de audio del Worker BETA.
 *
 * Instanciado UNA SOLA VEZ por el Worker shell (senses.ts) en la fase INIT.
 * Todos los submódulos son agregados internos — sin singletons externos
 * excepto los singletons de proceso getAGC() y getEnergyNormalizer()
 * que el Worker siempre compartió entre frames.
 */
export class SensesPipeline {
    constructor(config) {
        this.frameCount = 0;
        this.totalSamplesProcessed = 0;
        this.sampleRate = config.audioSampleRate ?? 44100;
        this.inputGain = config.inputGain ?? 1.0;
        this.ringBuffer = new AudioRingBuffer();
        this.spectrumAnalyzer = new SpectrumAnalyzer();
        this.bpmService = new BPMService();
        this.sectionTracker = new SectionTracker();
    }
    // ============================================
    // PIPELINE PRINCIPAL
    // ============================================
    /**
     * Procesa un buffer de audio entrante y devuelve el análisis completo.
     *
     * Llamar desde senses.ts en cada AUDIO_BUFFER o ciclo SAB.
     * Devuelve un ExtendedAudioAnalysis incluso antes de que el ring buffer
     * esté lleno (early exit con energías a cero).
     */
    processFrame(incoming) {
        this.frameCount++;
        this.totalSamplesProcessed += incoming.length;
        // ── Step 1: WAVE 3418 — Telemetría de entrada cruda ──────────────
        const inputTelemetry = this._measureInputTelemetry(incoming);
        // ── Step 2: Ring buffer → snapshot ───────────────────────────────
        const writeResult = this.ringBuffer.writeAndSnapshot(incoming);
        if (!writeResult.ready) {
            return this._buildEarlyExit(inputTelemetry.peakAbs, inputTelemetry.rms);
        }
        const snapshot = writeResult.snapshot;
        // ── Step 3: WAVE 2162 — FFT sobre audio CRUDO (sin AGC) ──────────
        // El BPM tracker nunca ve el buffer AGC-procesado.
        // La cadena BPM ve energía espectral con toda la dinámica real.
        const spectrum = this.spectrumAnalyzer.analyze(snapshot, this.sampleRate);
        // ── Step 4: WAVE 670 — AGC + InputGain (normalizar para UI/Wave8) ─
        const agc = getAGC();
        const agcResult = agc.processBuffer(snapshot);
        if (this.inputGain !== 1.0) {
            for (let i = 0; i < snapshot.length; i++) {
                snapshot[i] *= this.inputGain;
            }
        }
        // ── Step 5: WAVE 2307 — Clock determinista monótono ───────────────
        const deterministicTimestampMs = (this.totalSamplesProcessed / this.sampleRate) * 1000;
        // ── Step 6: BPM (RhythmTracker + ShadowLogger + INTERVAL log) ─────
        const bpmOutput = this.bpmService.processFrame(spectrum, deterministicTimestampMs);
        // ── Step 7: WAVE 16 — Energía normalizada ────────────────────────
        const rawEnergy = spectrum.bass * 0.5 + spectrum.mid * 0.3 + spectrum.treble * 0.2;
        const energyNormalizer = getEnergyNormalizer();
        const normalizedEnergy = energyNormalizer.normalize(rawEnergy);
        // ── Step 8: AudioMetrics para SectionTracker ──────────────────────
        const audioMetrics = {
            bass: spectrum.bass,
            mid: spectrum.mid,
            treble: spectrum.treble,
            volume: normalizedEnergy,
            bpm: bpmOutput.bpm,
            bpmConfidence: bpmOutput.confidence,
            onBeat: bpmOutput.kickDetected || spectrum.kickDetected,
            beatPhase: bpmOutput.beatPhase,
            timestamp: Date.now(),
            dominantFrequency: spectrum.dominantFrequency,
            subBass: spectrum.subBass,
            harshness: spectrum.harshness,
            spectralFlatness: spectrum.spectralFlatness,
            spectralCentroid: spectrum.spectralCentroid,
        };
        const beatState = {
            bpm: bpmOutput.bpm,
            confidence: bpmOutput.confidence,
            onBeat: bpmOutput.kickDetected || spectrum.kickDetected,
            phase: bpmOutput.beatPhase,
            beatCount: bpmOutput.kickCount,
        };
        // ── Step 9: Wave8 — SectionTracker ───────────────────────────────
        const wave8Output = this.sectionTracker.analyze(audioMetrics, normalizedEnergy, beatState, this.frameCount);
        // ── Step 10: buildPayload → ExtendedAudioAnalysis ─────────────────
        return buildPayload({
            frameId: this.frameCount,
            spectrum,
            agcResult,
            // AnalysisResponseBuilder espera GodEarBPMResult directamente desde
            // IntervalBPMTracker. BPMService abstrae ese nivel, por eso construimos
            // un objeto compatible con GodEarBPMResult a partir del BPMOutput.
            bpmResult: {
                bpm: bpmOutput.rawBpm,
                confidence: bpmOutput.confidence,
                beatPhase: bpmOutput.beatPhase,
                kickDetected: bpmOutput.kickDetected,
                kickCount: bpmOutput.kickCount,
            },
            musicalBpm: bpmOutput.bpm,
            bpmConfidence: bpmOutput.confidence,
            beatPhase: bpmOutput.beatPhase,
            lastBeatTime: bpmOutput.lastBeatTime,
            snapshotBuffer: snapshot,
            normalizedEnergy,
            rhythmOutput: wave8Output.rhythm,
            harmonyOutput: wave8Output.harmony,
            sectionOutput: wave8Output.section,
            genreOutput: wave8Output.genre,
            moodOutput: {
                primary: wave8Output.mood.primary,
                secondary: wave8Output.mood.secondary,
                valence: wave8Output.mood.valence,
                arousal: wave8Output.mood.arousal,
                dominance: wave8Output.mood.dominance,
                intensity: wave8Output.mood.intensity,
                stability: wave8Output.mood.stability,
            },
            inputPeakAbs: inputTelemetry.peakAbs,
            inputRMS: inputTelemetry.rms,
        });
    }
    // ============================================
    // CONTROL
    // ============================================
    /**
     * Resetea TODOS los submódulos al estado inicial.
     * Equivale al RESET_PACEMAKER + WAVE 3414 del Worker.
     */
    reset() {
        this.ringBuffer.flush();
        this.spectrumAnalyzer.reset();
        this.bpmService.reset();
        resetAGC();
        this.frameCount = 0;
        this.totalSamplesProcessed = 0;
    }
    /**
     * Propaga el vibe activo al BPMService y SectionTracker.
     * Llamar cuando el Worker recibe MessageType.SET_VIBE.
     */
    setVibe(vibeId) {
        this.bpmService.setVibe(vibeId);
        this.sectionTracker.setVibe(vibeId);
    }
    // ============================================
    // PRIVADO
    // ============================================
    /**
     * Mide el peak absoluto y RMS del buffer crudo ANTES de cualquier procesamiento.
     * WAVE 3418: Estos valores aparecen en los logs de TitanOrchestrator.
     */
    _measureInputTelemetry(buffer) {
        let peakAbs = 0;
        let rmsSum = 0;
        for (let i = 0; i < buffer.length; i++) {
            const abs = Math.abs(buffer[i]);
            if (abs > peakAbs)
                peakAbs = abs;
            rmsSum += buffer[i] * buffer[i];
        }
        const rms = buffer.length > 0 ? Math.sqrt(rmsSum / buffer.length) : 0;
        return { peakAbs, rms };
    }
    /**
     * Construye el análisis mínimo de "ring buffer no lleno aún".
     * WAVE 1013 / WAVE 2098: Boot silence — se emite hasta que el ring esté lleno.
     * Propaga la telemetría real de entrada incluso en este estado.
     */
    _buildEarlyExit(inputPeakAbs, inputRMS) {
        return {
            timestamp: Date.now(),
            frameId: this.frameCount,
            agcGainFactor: 1.0,
            bpm: 0,
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
            hihatDetected: false,
            inputPeakAbs,
            inputRMS,
        };
    }
}
