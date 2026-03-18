/**
 * FFTAnalyzer.ts
 * Análisis FFT en tiempo real para extraer bandas de frecuencia
 * Bass (20-250Hz), Mid (250-4kHz), Treble (4-20kHz)
 */
/**
 * Analizador FFT para extracción de bandas de frecuencia
 */
export class FFTAnalyzer {
    config;
    analyserNode = null;
    frequencyData;
    timeData;
    // Índices de bins para cada banda de frecuencia
    bassRange;
    midRange;
    trebleRange;
    constructor(analyserNode, config = {}) {
        this.analyserNode = analyserNode;
        this.config = {
            fftSize: config.fftSize || 2048,
            smoothingTimeConstant: config.smoothingTimeConstant || 0.8,
            minDecibels: config.minDecibels || -90,
            maxDecibels: config.maxDecibels || -10,
        };
        // Inicializar buffers (forzar ArrayBuffer explícito)
        const bufferLength = this.config.fftSize / 2;
        this.frequencyData = new Uint8Array(new ArrayBuffer(bufferLength));
        this.timeData = new Uint8Array(new ArrayBuffer(bufferLength));
        // Calcular rangos de frecuencia (asumiendo 44100Hz)
        const sampleRate = 44100;
        const nyquist = sampleRate / 2;
        const binWidth = nyquist / bufferLength;
        // Bass: 20-250Hz
        this.bassRange = {
            start: Math.floor(20 / binWidth),
            end: Math.floor(250 / binWidth),
        };
        // Mid: 250Hz-4kHz
        this.midRange = {
            start: Math.floor(250 / binWidth),
            end: Math.floor(4000 / binWidth),
        };
        // Treble: 4kHz-20kHz
        this.trebleRange = {
            start: Math.floor(4000 / binWidth),
            end: Math.floor(20000 / binWidth),
        };
        // Configurar analyser si está disponible
        if (this.analyserNode) {
            this.analyserNode.fftSize = this.config.fftSize;
            this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
            this.analyserNode.minDecibels = this.config.minDecibels;
            this.analyserNode.maxDecibels = this.config.maxDecibels;
        }
        console.log(`🎛️  FFTAnalyzer: Inicializado (FFT=${this.config.fftSize})`);
        console.log(`   Bass: ${this.bassRange.start}-${this.bassRange.end} bins (20-250Hz)`);
        console.log(`   Mid: ${this.midRange.start}-${this.midRange.end} bins (250Hz-4kHz)`);
        console.log(`   Treble: ${this.trebleRange.start}-${this.trebleRange.end} bins (4-20kHz)`);
    }
    /**
     * Analiza el audio actual y retorna bandas de frecuencia
     */
    analyze() {
        if (!this.analyserNode) {
            return null;
        }
        // Obtener datos de frecuencia (0-255)
        // @ts-ignore - Incompatibilidad de tipos entre DOM y Node.js
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        // Obtener datos de tiempo para RMS
        // @ts-ignore - Incompatibilidad de tipos entre DOM y Node.js
        this.analyserNode.getByteTimeDomainData(this.timeData);
        // Calcular energía en cada banda
        const bass = this.calculateBandEnergy(this.bassRange.start, this.bassRange.end);
        const mid = this.calculateBandEnergy(this.midRange.start, this.midRange.end);
        const treble = this.calculateBandEnergy(this.trebleRange.start, this.trebleRange.end);
        // Calcular RMS global
        const rms = this.calculateRMS();
        // Copiar espectro completo para análisis avanzado
        const spectrum = new Float32Array(this.frequencyData.length);
        for (let i = 0; i < this.frequencyData.length; i++) {
            spectrum[i] = this.frequencyData[i] / 255.0; // Normalizar a 0-1
        }
        return {
            bass,
            mid,
            treble,
            rms,
            spectrum,
        };
    }
    /**
     * Calcula la energía promedio en un rango de bins
     */
    calculateBandEnergy(startBin, endBin) {
        let sum = 0;
        let count = 0;
        for (let i = startBin; i < endBin && i < this.frequencyData.length; i++) {
            sum += this.frequencyData[i];
            count++;
        }
        if (count === 0)
            return 0;
        // Normalizar a 0-1 (asumiendo valores 0-255)
        return (sum / count) / 255.0;
    }
    /**
     * Calcula el RMS (Root Mean Square) global
     */
    calculateRMS() {
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            // Convertir de byte (0-255) a amplitud (-1 a 1)
            const normalized = (this.timeData[i] - 128) / 128.0;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        return Math.min(1.0, rms); // Limitar a 0-1
    }
    /**
     * Actualiza el analyser node (útil si se recrea el contexto de audio)
     */
    setAnalyserNode(analyserNode) {
        this.analyserNode = analyserNode;
        this.analyserNode.fftSize = this.config.fftSize;
        this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
        this.analyserNode.minDecibels = this.config.minDecibels;
        this.analyserNode.maxDecibels = this.config.maxDecibels;
    }
    /**
     * Ajusta el suavizado temporal
     * @param value 0 (sin suavizado) a 1 (mucho suavizado)
     */
    setSmoothing(value) {
        this.config.smoothingTimeConstant = Math.max(0, Math.min(1, value));
        if (this.analyserNode) {
            this.analyserNode.smoothingTimeConstant = this.config.smoothingTimeConstant;
        }
    }
    /**
     * Encuentra la frecuencia dominante en el espectro
     */
    findDominantFrequency() {
        let maxMagnitude = 0;
        let maxIndex = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            if (this.frequencyData[i] > maxMagnitude) {
                maxMagnitude = this.frequencyData[i];
                maxIndex = i;
            }
        }
        // Calcular frecuencia del bin
        const sampleRate = 44100; // TODO: obtener del contexto de audio
        const nyquist = sampleRate / 2;
        const binWidth = nyquist / this.frequencyData.length;
        const frequency = maxIndex * binWidth;
        return {
            frequency,
            magnitude: maxMagnitude / 255.0,
        };
    }
    /**
     * Obtiene el espectro completo (para visualización o análisis)
     */
    getSpectrum() {
        if (this.analyserNode) {
            // @ts-ignore - Incompatibilidad de tipos entre DOM y Node.js
            this.analyserNode.getByteFrequencyData(this.frequencyData);
        }
        return this.frequencyData;
    }
    /**
     * Obtiene la forma de onda temporal (para visualización)
     */
    getWaveform() {
        if (this.analyserNode) {
            // @ts-ignore - Incompatibilidad de tipos entre DOM y Node.js
            this.analyserNode.getByteTimeDomainData(this.timeData);
        }
        return this.timeData;
    }
}
//# sourceMappingURL=FFTAnalyzer.js.map