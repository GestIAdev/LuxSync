/**
 * 🎵 AUDIO TO METRICS ADAPTER
 *
 * Converts audio FFT analysis to Selene-compatible system metrics.
 * Maps frequency bands to CPU/Memory/Latency that Selene already understands.
 *
 * Mapping:
 * - Bass (20-250 Hz) → CPU (0.0-1.0)
 * - Mid (250-4000 Hz) → Memory (0.0-1.0)
 * - Treble (4000-20000 Hz) → Latency (0-100, inverted)
 *
 * @date 2025-11-20
 * @author LuxSync Integration Team
 */
export class AudioToMetricsAdapter {
    audioContext = null;
    analyser = null;
    microphone = null;
    dataArray = null;
    fftSize = 2048;
    sampleRate = 44100;
    smoothingFactor = 0.8;
    /**
     * Initialize audio capture from microphone or line-in
     */
    async initialize(deviceId) {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                video: false
            });
            // Create audio context
            this.audioContext = new AudioContext();
            this.sampleRate = this.audioContext.sampleRate;
            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingFactor;
            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            // Allocate buffer for frequency data
            const buffer = new ArrayBuffer(this.analyser.frequencyBinCount * 4);
            this.dataArray = new Float32Array(buffer);
            console.log('✅ AudioToMetricsAdapter initialized');
            console.log(`   Sample rate: ${this.sampleRate} Hz`);
            console.log(`   FFT size: ${this.fftSize}`);
            console.log(`   Frequency bins: ${this.analyser.frequencyBinCount}`);
        }
        catch (error) {
            console.error('❌ Failed to initialize audio:', error);
            throw error;
        }
    }
    /**
     * Capture current audio frame and convert to Selene metrics
     */
    captureMetrics() {
        if (!this.analyser || !this.dataArray) {
            throw new Error('AudioAdapter not initialized. Call initialize() first.');
        }
        // Get frequency data from analyser
        this.analyser.getFloatFrequencyData(this.dataArray);
        // Extract frequency bands
        const bands = this.extractFrequencyBands();
        // Map to Selene metrics
        return {
            cpu: bands.bass, // Bass → CPU
            memory: bands.mid, // Mid → Memory
            latency: (1 - bands.treble) * 100, // Treble → Latency (inverted)
            timestamp: Date.now()
        };
    }
    /**
     * Extract energy in specific frequency bands
     */
    extractFrequencyBands() {
        if (!this.dataArray) {
            return { bass: 0, mid: 0, treble: 0 };
        }
        return {
            bass: this.getBandEnergy(20, 250),
            mid: this.getBandEnergy(250, 4000),
            treble: this.getBandEnergy(4000, 20000)
        };
    }
    /**
     * Calculate energy in a frequency band
     */
    getBandEnergy(minHz, maxHz) {
        if (!this.analyser || !this.dataArray)
            return 0;
        // Calculate FFT bin range
        const nyquist = this.sampleRate / 2;
        const binCount = this.analyser.frequencyBinCount;
        const minBin = Math.floor((minHz / nyquist) * binCount);
        const maxBin = Math.min(Math.ceil((maxHz / nyquist) * binCount), binCount);
        // Sum energy in band (FFT returns dB, typically -100 to 0)
        let sum = 0;
        let count = 0;
        for (let i = minBin; i < maxBin; i++) {
            const db = this.dataArray[i];
            // Convert dB to linear (0.0-1.0)
            // -100dB = silence, 0dB = max
            const linear = Math.max(0, (db + 100) / 100);
            sum += linear;
            count++;
        }
        // Average and clamp
        const average = count > 0 ? sum / count : 0;
        return Math.min(1.0, Math.max(0.0, average));
    }
    /**
     * Get detailed frequency analysis (for debugging/visualization)
     */
    getDetailedAnalysis() {
        if (!this.analyser || !this.dataArray) {
            return {
                bands: { bass: 0, mid: 0, treble: 0 },
                spectrum: [],
                peak: 0,
                average: 0
            };
        }
        this.analyser.getFloatFrequencyData(this.dataArray);
        const bands = this.extractFrequencyBands();
        // Find peak and average
        let peak = -Infinity;
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const value = this.dataArray[i];
            if (value > peak)
                peak = value;
            sum += value;
        }
        const average = sum / this.dataArray.length;
        return {
            bands,
            spectrum: Array.from(this.dataArray),
            peak: (peak + 100) / 100, // Normalize to 0-1
            average: (average + 100) / 100
        };
    }
    /**
     * List available audio input devices
     */
    static async listAudioDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'audioinput');
        }
        catch (error) {
            console.error('Failed to enumerate devices:', error);
            return [];
        }
    }
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.dataArray = null;
        console.log('✅ AudioToMetricsAdapter destroyed');
    }
    /**
     * Check if adapter is ready
     */
    isReady() {
        return !!(this.audioContext && this.analyser && this.dataArray);
    }
}
//# sourceMappingURL=AudioToMetricsAdapter.js.map