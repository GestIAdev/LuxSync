/**
 * 🥁 WAVE 3504-EXT.5 — BPMService
 *
 * Coordinador de detección de BPM para el worker BETA.
 *
 * Compone RhythmTracker (EXT.3) + ShadowLogger (EXT.5) y expone la interfaz
 * IBPMService del blueprint: processFrame() / getBPM() / setVibe() / reset().
 *
 * Añade el diagnóstico INTERVAL cada 20 frames que vivía inline en
 * processAudioBuffer() de senses.ts.
 *
 * Worker-agnostic: cero dependencias de parentPort, IPC ni SharedRingBuffer.
 */
import { RhythmTracker } from '../tracking/RhythmTracker';
import { ShadowLogger } from './ShadowLogger';
// ============================================
// BPMService
// ============================================
/**
 * Wrapper de coordinación de BPM para SensesPipeline.
 *
 * Responsabilidades:
 *   1. Delegar el análisis frame a frame a RhythmTracker
 *   2. Registrar el frame en ShadowLogger (captura offline 46s)
 *   3. Emitir el diagnóstico [INTERVAL] cada 20 frames (WAVE 2169)
 *   4. Exponer el BPM actual vía getBPM() para el pipeline AGC
 */
export class BPMService {
    constructor() {
        this.rhythmTracker = new RhythmTracker();
        this.shadowLogger = new ShadowLogger();
        this.frameCount = 0;
        this.lastResult = {
            bpm: 0,
            confidence: 0,
            beatPhase: 0,
            kickDetected: false,
            kickCount: 0,
            lastBeatTime: 0,
            rawBpm: 0,
        };
    }
    /**
     * Procesa un frame de espectro y actualiza el estado de BPM.
     *
     * Llamar en el hot path del processAudioBuffer:
     *   const bpmOut = bpmService.processFrame(spectrum, deterministicTimestampMs);
     */
    processFrame(spectrum, deterministicTimestampMs) {
        this.frameCount++;
        const track = this.rhythmTracker.process(spectrum, deterministicTimestampMs);
        // WAVE 2172: Registro en ShadowLogger
        this.shadowLogger.record({
            timestampMs: deterministicTimestampMs,
            rawLowFlux: track.rawLowFlux,
            rawMidFlux: track.rawMidFlux,
            rawBassFlux: track.rawBassFlux,
            centroid: spectrum.spectralCentroid,
            needle: track.needle,
        });
        // WAVE 2169: Diagnóstico INTERVAL cada 20 frames (~0.9s a 20fps)
        if (this.frameCount % 20 === 0) {
            console.log(`[INTERVAL] F${this.frameCount}` +
                ` bpm=${track.musicalBpm}` +
                ` raw=${track.rawBpm}` +
                ` conf=${track.confidence.toFixed(3)}` +
                ` kick=${track.kickDetected}` +
                ` phase=${track.beatPhase.toFixed(2)}` +
                ` needle=${track.needle.toFixed(4)}` +
                ` bassFlux=${track.rawBassFlux.toFixed(4)}` +
                ` floor=${track.currentFloor.toFixed(4)}` +
                ` midFlux=${track.rawMidFlux.toFixed(4)}` +
                ` centroid=${Math.round(spectrum.spectralCentroid)}Hz` +
                ` kicks=${track.kickCount}`);
        }
        this.lastResult = {
            bpm: track.musicalBpm,
            confidence: track.confidence,
            beatPhase: track.beatPhase,
            kickDetected: track.kickDetected,
            kickCount: track.kickCount,
            lastBeatTime: track.lastBeatTime,
            rawBpm: track.rawBpm,
        };
        return this.lastResult;
    }
    /**
     * Devuelve el BPM del último frame procesado.
     * Útil cuando el pipeline necesita el BPM sin procesar un nuevo frame.
     */
    getBPM() {
        return this.lastResult;
    }
    /**
     * Propaga el vibe activo al RhythmTracker.
     * Afecta pocket bounds y Dembow Ceiling.
     * Llamar cuando el Worker recibe MessageType.SET_VIBE.
     */
    setVibe(vibeId) {
        this.rhythmTracker.setVibe(vibeId);
    }
    /**
     * Resetea el estado de BPM al completo.
     * Equivale al RESET_PACEMAKER de senses.ts (WAVE 2161 + WAVE 3414).
     */
    reset() {
        this.rhythmTracker.reset();
        this.shadowLogger.reset();
        this.frameCount = 0;
        this.lastResult = {
            bpm: 0,
            confidence: 0,
            beatPhase: 0,
            kickDetected: false,
            kickCount: 0,
            lastBeatTime: 0,
            rawBpm: 0,
        };
    }
}
