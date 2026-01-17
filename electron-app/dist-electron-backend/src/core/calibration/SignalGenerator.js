/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║           SIGNAL GENERATOR - THE SYNTHETIC TRUTH              ║
 * ║                                                               ║
 * ║  "No random numbers. No simulations. Pure mathematics."       ║
 * ║                                                               ║
 * ║  Generates mathematically perfect audio signals for           ║
 * ║  calibrating Selene's perception algorithms.                  ║
 * ╚═══════════════════════════════════════════════════════════════╝
 *
 * WAVE 670.5 - THE SELENE LAB
 *
 * Each signal is deterministic and reproducible.
 * Same input = Same output. Always.
 */
/**
 * SignalGenerator - Creates mathematically perfect test signals
 *
 * NO RANDOMNESS. Every signal is deterministic.
 * A sine wave is a sine wave. A kick is a kick.
 */
export class SignalGenerator {
    constructor(config = {}) {
        this.config = {
            sampleRate: config.sampleRate ?? 44100,
            duration: config.duration ?? 30,
            bufferSize: config.bufferSize ?? 2048
        };
    }
    /**
     * Generate complete silence
     * Expected: Energy ≈ 0, Everything ≈ 0
     */
    generateSilence() {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        for (let i = 0; i < numBuffers; i++) {
            buffers.push(new Float32Array(this.config.bufferSize)); // All zeros by default
        }
        return {
            name: 'SILENCE',
            description: 'Complete digital silence - all zeros',
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate white noise (flat spectrum)
     * Expected: High Harshness, High SpectralFlatness, Chaotic
     *
     * Uses deterministic PRNG seeded for reproducibility
     */
    generateWhiteNoise(amplitude = 0.8) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        // Deterministic pseudo-random using Linear Congruential Generator
        // Same seed = same sequence ALWAYS
        let seed = 12345;
        const lcg = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1; // Range [-1, 1]
        };
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                buffer[j] = lcg() * amplitude;
            }
            buffers.push(buffer);
        }
        return {
            name: 'WHITE_NOISE',
            description: `Deterministic white noise at ${amplitude * 100}% amplitude`,
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate pink noise (1/f spectrum - more natural)
     * Expected: Moderate Harshness, Natural sound profile
     *
     * Uses Voss-McCartney algorithm for pink noise
     */
    generatePinkNoise(amplitude = 0.7) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        // Voss-McCartney pink noise generator (deterministic)
        const NUM_ROWS = 16;
        const rows = new Float32Array(NUM_ROWS);
        let runningSum = 0;
        let index = 0;
        let seed = 54321;
        const lcg = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1;
        };
        // Initialize rows
        for (let i = 0; i < NUM_ROWS; i++) {
            rows[i] = lcg();
            runningSum += rows[i];
        }
        const generatePinkSample = () => {
            // Find which rows to update based on trailing zeros in index
            let n = index;
            let numZeros = 0;
            while ((n & 1) === 0 && numZeros < NUM_ROWS) {
                numZeros++;
                n >>= 1;
            }
            // Update the appropriate row
            if (numZeros < NUM_ROWS) {
                runningSum -= rows[numZeros];
                rows[numZeros] = lcg();
                runningSum += rows[numZeros];
            }
            index++;
            return (runningSum / NUM_ROWS) * amplitude;
        };
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                buffer[j] = generatePinkSample();
            }
            buffers.push(buffer);
        }
        return {
            name: 'PINK_NOISE',
            description: `Deterministic pink noise (1/f) at ${amplitude * 100}% amplitude`,
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate a pure sine wave at given frequency
     * Expected: Very low Harshness, Single spectral peak
     */
    generateSineWave(frequency, amplitude = 0.8) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        const angularFreq = 2 * Math.PI * frequency / this.config.sampleRate;
        let sampleIndex = 0;
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                buffer[j] = Math.sin(angularFreq * sampleIndex) * amplitude;
                sampleIndex++;
            }
            buffers.push(buffer);
        }
        return {
            name: `SINE_${frequency}Hz`,
            description: `Pure sine wave at ${frequency}Hz, ${amplitude * 100}% amplitude`,
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate a synthetic kick drum (4-on-the-floor pattern)
     * Kick = 50Hz sine with fast attack/decay envelope
     *
     * Expected: Strong bass, rhythmic energy pulses, detectable BPM
     */
    generateTechnoKick(bpm = 128, amplitude = 0.9) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        const samplesPerBeat = (60 / bpm) * this.config.sampleRate;
        const kickFreqStart = 150; // Start frequency (pitch bend down)
        const kickFreqEnd = 50; // End frequency
        const kickDuration = 0.15; // 150ms kick duration
        const kickSamples = kickDuration * this.config.sampleRate;
        let sampleIndex = 0;
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                const globalSample = sampleIndex + j;
                const positionInBeat = globalSample % samplesPerBeat;
                if (positionInBeat < kickSamples) {
                    // We're in a kick
                    const t = positionInBeat / kickSamples; // 0 to 1
                    // Exponential pitch bend: 150Hz -> 50Hz
                    const freq = kickFreqStart * Math.pow(kickFreqEnd / kickFreqStart, t);
                    // Fast attack, exponential decay envelope
                    const envelope = Math.exp(-t * 5) * (1 - Math.exp(-positionInBeat / 20));
                    // Phase accumulation for smooth frequency sweep
                    const phase = 2 * Math.PI * freq * (positionInBeat / this.config.sampleRate);
                    buffer[j] = Math.sin(phase) * envelope * amplitude;
                }
                else {
                    buffer[j] = 0;
                }
            }
            sampleIndex += this.config.bufferSize;
            buffers.push(buffer);
        }
        return {
            name: `TECHNO_KICK_${bpm}BPM`,
            description: `4-on-the-floor kick at ${bpm} BPM, synthetic 50Hz punch`,
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate podcast-like vocal simulation
     * Filtered noise in vocal range (100Hz - 4kHz) with speech-like rhythm
     *
     * Expected: Low-medium energy, very low harshness, speech-like patterns
     */
    generatePodcast(amplitude = 0.4) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        // Deterministic PRNG
        let seed = 98765;
        const lcg = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1;
        };
        // Simple bandpass filter state (vocal range ~200-3000Hz)
        const lowCutoff = 200 / this.config.sampleRate;
        const highCutoff = 3000 / this.config.sampleRate;
        let lowState = 0;
        let highState = 0;
        // Speech rhythm: words ~0.3s, pauses ~0.2s
        const wordSamples = 0.3 * this.config.sampleRate;
        const pauseSamples = 0.2 * this.config.sampleRate;
        const cycleSamples = wordSamples + pauseSamples;
        let sampleIndex = 0;
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                const globalSample = sampleIndex + j;
                const positionInCycle = globalSample % cycleSamples;
                // Are we in a "word" or a "pause"?
                const isSpeaking = positionInCycle < wordSamples;
                if (isSpeaking) {
                    // Generate filtered noise
                    const noise = lcg();
                    // Simple high-pass (remove sub-bass)
                    highState += (noise - highState) * (2 * Math.PI * lowCutoff);
                    const highPassed = noise - highState;
                    // Simple low-pass (remove harshness)
                    lowState += (highPassed - lowState) * (2 * Math.PI * highCutoff);
                    // Add slight amplitude variation for naturalness
                    const wordProgress = positionInCycle / wordSamples;
                    const speechEnvelope = Math.sin(wordProgress * Math.PI) * 0.3 + 0.7;
                    buffer[j] = lowState * amplitude * speechEnvelope;
                }
                else {
                    // Pause - decay to silence
                    lowState *= 0.99;
                    highState *= 0.99;
                    buffer[j] = lowState * amplitude * 0.1;
                }
            }
            sampleIndex += this.config.bufferSize;
            buffers.push(buffer);
        }
        return {
            name: 'PODCAST',
            description: 'Simulated vocal content with speech rhythm',
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate "The Drop" - the ultimate test
     * 2 seconds silence -> 1 second massive impact (kick + sub + noise burst)
     *
     * Expected: Z-Score should SPIKE here. This is the epic moment detector test.
     */
    generateTheDrop(amplitude = 1.0) {
        const totalSamples = this.config.sampleRate * this.config.duration;
        const numBuffers = Math.ceil(totalSamples / this.config.bufferSize);
        const buffers = [];
        const silenceDuration = 2.0; // 2 seconds of silence
        const dropDuration = 1.0; // 1 second of CHAOS
        const cycleDuration = silenceDuration + dropDuration;
        const silenceSamples = silenceDuration * this.config.sampleRate;
        const dropSamples = dropDuration * this.config.sampleRate;
        const cycleSamples = cycleDuration * this.config.sampleRate;
        // Sub-bass frequency
        const subFreq = 40;
        const kickFreqStart = 200;
        const kickFreqEnd = 50;
        // Deterministic noise
        let seed = 11111;
        const lcg = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1;
        };
        let sampleIndex = 0;
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(this.config.bufferSize);
            for (let j = 0; j < this.config.bufferSize; j++) {
                const globalSample = sampleIndex + j;
                const positionInCycle = globalSample % cycleSamples;
                if (positionInCycle < silenceSamples) {
                    // SILENCE - building tension
                    buffer[j] = 0;
                }
                else {
                    // THE DROP
                    const dropPosition = positionInCycle - silenceSamples;
                    const t = dropPosition / dropSamples; // 0 to 1
                    // Massive sub-bass
                    const sub = Math.sin(2 * Math.PI * subFreq * (dropPosition / this.config.sampleRate));
                    // Impact kick (first 200ms)
                    let kick = 0;
                    if (dropPosition < 0.2 * this.config.sampleRate) {
                        const kickT = dropPosition / (0.2 * this.config.sampleRate);
                        const kickFreq = kickFreqStart * Math.pow(kickFreqEnd / kickFreqStart, kickT);
                        const kickEnvelope = Math.exp(-kickT * 3);
                        kick = Math.sin(2 * Math.PI * kickFreq * (dropPosition / this.config.sampleRate)) * kickEnvelope;
                    }
                    // Noise burst (decays over the drop)
                    const noiseEnvelope = Math.exp(-t * 2);
                    const noise = lcg() * noiseEnvelope * 0.3;
                    // Combine all elements
                    const combined = (sub * 0.5 + kick * 0.4 + noise) * amplitude;
                    // Overall envelope - sustain then slight decay
                    const dropEnvelope = t < 0.1 ? t * 10 : 1 - (t - 0.1) * 0.2;
                    buffer[j] = combined * Math.min(dropEnvelope, 1);
                }
            }
            sampleIndex += this.config.bufferSize;
            buffers.push(buffer);
        }
        return {
            name: 'THE_DROP',
            description: '2s silence -> 1s massive drop (sub + kick + noise). Z-Score stress test.',
            buffers,
            totalSamples,
            config: this.config
        };
    }
    /**
     * Generate a buildup pattern (rising energy)
     * Starts quiet, builds tension, prepares for drop
     *
     * Expected: Gradual energy increase, rising harshness
     */
    generateBuildup(duration = 16, amplitude = 0.9) {
        // Override duration for this specific signal
        const localConfig = { ...this.config, duration };
        const totalSamples = localConfig.sampleRate * localConfig.duration;
        const numBuffers = Math.ceil(totalSamples / localConfig.bufferSize);
        const buffers = [];
        // Deterministic noise
        let seed = 77777;
        const lcg = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1;
        };
        // Rising hi-hat pattern (8th notes, then 16th notes, then 32nd)
        const bpm = 128;
        const samplesPerBeat = (60 / bpm) * localConfig.sampleRate;
        let sampleIndex = 0;
        for (let i = 0; i < numBuffers; i++) {
            const buffer = new Float32Array(localConfig.bufferSize);
            for (let j = 0; j < localConfig.bufferSize; j++) {
                const globalSample = sampleIndex + j;
                const progress = globalSample / totalSamples; // 0 to 1
                // Rising intensity
                const intensity = Math.pow(progress, 2); // Exponential rise
                // Hi-hat subdivision increases
                let subdivision;
                if (progress < 0.33) {
                    subdivision = 2; // 8th notes
                }
                else if (progress < 0.66) {
                    subdivision = 4; // 16th notes  
                }
                else {
                    subdivision = 8; // 32nd notes
                }
                const samplesPerHit = samplesPerBeat / subdivision;
                const positionInHit = globalSample % samplesPerHit;
                const hitDuration = 0.02 * localConfig.sampleRate; // 20ms hit
                let sample = 0;
                // Hi-hat hit
                if (positionInHit < hitDuration) {
                    const hitT = positionInHit / hitDuration;
                    const hitEnvelope = Math.exp(-hitT * 10);
                    // Hi-hat is filtered noise
                    sample += lcg() * hitEnvelope * 0.3 * intensity;
                }
                // Rising synth pad (filtered noise that increases in brightness)
                const padNoise = lcg();
                const padIntensity = intensity * 0.5;
                sample += padNoise * padIntensity * (0.2 + progress * 0.3);
                // Rising sub-bass rumble
                const subFreq = 30 + progress * 20; // 30Hz -> 50Hz
                const sub = Math.sin(2 * Math.PI * subFreq * (globalSample / localConfig.sampleRate));
                sample += sub * intensity * 0.3;
                buffer[j] = sample * amplitude;
            }
            sampleIndex += localConfig.bufferSize;
            buffers.push(buffer);
        }
        return {
            name: 'BUILDUP',
            description: `${duration}s buildup: rising intensity, subdivision acceleration`,
            buffers,
            totalSamples,
            config: localConfig
        };
    }
    /**
     * Get all standard test signals
     */
    generateAllStandardSignals() {
        return [
            this.generateSilence(),
            this.generateWhiteNoise(),
            this.generatePinkNoise(),
            this.generateSineWave(440), // A4 - reference tone
            this.generateSineWave(50), // Sub-bass
            this.generateTechnoKick(128), // Standard techno
            this.generateTechnoKick(174), // Drum & Bass tempo
            this.generatePodcast(),
            this.generateTheDrop(),
            this.generateBuildup(16)
        ];
    }
}
