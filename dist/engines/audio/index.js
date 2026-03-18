/**
 * 🎵 AUDIO ENGINE - INDEX
 *
 * Análisis de audio en tiempo real para LuxSync
 * Integra: AudioCapture + BeatDetector + FFTAnalyzer
 */
import { AudioCapture } from './AudioCapture.js';
import { BeatDetector } from './BeatDetector.js';
import { FFTAnalyzer } from './FFTAnalyzer.js';
export class AudioEngine {
    audioCapture;
    beatDetector;
    fftAnalyzer = null;
    currentFrame;
    isRunning = false;
    constructor() {
        this.audioCapture = new AudioCapture({
            sampleRate: 44100,
            bufferSize: 2048,
            channels: 1,
        });
        this.beatDetector = new BeatDetector({
            threshold: 0.3,
            minBeatInterval: 250,
            adaptiveThreshold: true,
        });
        // Frame inicial
        this.currentFrame = {
            timestamp: Date.now(),
            bass: 0,
            mid: 0,
            treble: 0,
            beat: false,
            beatStrength: 0,
            bpm: 0,
            bpmConfidence: 0,
            rms: 0,
        };
    }
    async initialize() {
        console.log('🎵 [AudioEngine] Inicializando...');
        try {
            // Inicializar captura de audio
            await this.audioCapture.initialize();
            // Obtener analyser node para FFT
            const analyserNode = this.audioCapture.getAnalyserNode();
            if (!analyserNode) {
                throw new Error('No se pudo obtener AnalyserNode');
            }
            // Inicializar FFT analyzer
            this.fftAnalyzer = new FFTAnalyzer(analyserNode, {
                fftSize: 2048,
                smoothingTimeConstant: 0.8,
            });
            // Escuchar eventos de audio
            this.audioCapture.on('audio', (buffer) => {
                this.processAudioBuffer(buffer);
            });
            this.isRunning = true;
            console.log('✅ [AudioEngine] Listo - Capturando audio');
        }
        catch (error) {
            console.error('❌ [AudioEngine] Error en inicialización:', error);
            throw error;
        }
    }
    /**
     * Procesa cada buffer de audio entrante
     */
    processAudioBuffer(buffer) {
        if (!this.fftAnalyzer || !this.isRunning)
            return;
        // 1. Análisis FFT (bandas de frecuencia)
        const bands = this.fftAnalyzer.analyze();
        if (!bands)
            return;
        // 2. Detección de beats
        const beatEvent = this.beatDetector.detect(buffer.samples, buffer.timestamp);
        // 3. Actualizar frame actual
        this.currentFrame = {
            timestamp: buffer.timestamp,
            bass: bands.bass,
            mid: bands.mid,
            treble: bands.treble,
            beat: beatEvent !== null,
            beatStrength: beatEvent?.strength || 0,
            bpm: beatEvent?.bpm || this.beatDetector.getBPM(),
            bpmConfidence: beatEvent?.confidence || 0,
            rms: bands.rms,
        };
        // Log de beats (solo para debug en desarrollo)
        if (beatEvent && process.env.DEBUG_BEATS === 'true') {
            console.log(`🥁 BEAT! Strength: ${beatEvent.strength.toFixed(2)} | BPM: ${beatEvent.bpm || 0}`);
        }
    }
    /**
     * Obtiene el frame de audio más reciente
     */
    async getFrame() {
        return { ...this.currentFrame }; // Copiar para evitar mutación
    }
    /**
     * Ajusta la sensibilidad del detector de beats
     */
    setBeatSensitivity(threshold) {
        this.beatDetector.setThreshold(threshold);
        console.log(`🎛️  [AudioEngine] Sensibilidad de beat ajustada a ${threshold}`);
    }
    /**
     * Obtiene estadísticas del motor de audio
     */
    getStats() {
        return {
            ...this.beatDetector.getStats(),
            currentFrame: this.currentFrame,
        };
    }
    /**
     * Pausa el procesamiento de audio
     */
    pause() {
        this.audioCapture.pause();
        this.isRunning = false;
        console.log('⏸️  [AudioEngine] Pausado');
    }
    /**
     * Reanuda el procesamiento de audio
     */
    resume() {
        this.audioCapture.resume();
        this.isRunning = true;
        console.log('▶️  [AudioEngine] Reanudado');
    }
    async close() {
        this.isRunning = false;
        await this.audioCapture.close();
        this.beatDetector.reset();
        console.log('🛑 [AudioEngine] Cerrado');
    }
}
//# sourceMappingURL=index.js.map