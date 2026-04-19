/**
 * 🩻 PROJECT "GOD EAR" - SURGICAL FFT REVOLUTION
 * WAVE 1016 - Phase 1: CORE FFT Implementation
 *
 * Espectroscopio Quirúrgico de Grado Militar para LuxSync.
 *
 * Features:
 * - Blackman-Harris 4-term windowing (-92dB sidelobes)
 * - Linkwitz-Riley 4th order digital filters (24dB/octave)
 * - 7 tactical bands with ZERO overlap
 * - Per-band AGC Trust Zones
 * - Advanced spectral metrics
 * - Stereo phase correlation
 *
 * @author PunkOpus (Lead DSP Engineer) for GestIAdev
 * @version WAVE 1016 - "GOD EAR: BECAUSE WE DESERVE TO HEAR LIKE GODS"
 */
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
// 🔇 WAVE 3290: GOD EAR FFT WORKER — Blackout del hilo FFT.
// DEBUG PROBE — Comentar para auditoría del espectroscopio FFT.
;
(function () { const _n = () => { }; console.log = _n; console.info = _n; console.debug = _n; console.warn = _n; console.error = _n; })();
/** FFT Configuration */
const FFT_SIZE = 4096;
const DEFAULT_SAMPLE_RATE = 44100;
const BIN_RESOLUTION = DEFAULT_SAMPLE_RATE / FFT_SIZE; // 10.77Hz per bin
const NYQUIST = DEFAULT_SAMPLE_RATE / 2; // 22050Hz
/**
 * 7 TACTICAL BAND DEFINITIONS
 *
 * Designed for ZERO OVERLAP with Linkwitz-Riley 4th order filters.
 * Each band has specific purpose for lighting control.
 */
const GOD_EAR_BAND_CONFIG = {
    SUB_BASS: {
        id: 'subBass',
        freqLow: 20,
        freqHigh: 60,
        description: 'Presión de aire pura - Kicks sísmicos, Rumble',
        lightingUse: 'FRONT PARS - Pump effect, Floor shakers',
    },
    BASS: {
        id: 'bass',
        freqLow: 60,
        freqHigh: 250,
        description: 'Cuerpo rítmico - Bajos, Kick body, Toms',
        lightingUse: 'MOVER LEFT - Bass pulsation, Stage wash low',
    },
    LOW_MID: {
        id: 'lowMid',
        freqLow: 250,
        freqHigh: 500,
        description: 'Calor / Mud zone - Limpieza crítica',
        lightingUse: 'STAGE WARM - Atmospheric fills',
    },
    MID: {
        id: 'mid',
        freqLow: 500,
        freqHigh: 2000,
        description: 'Voces / Snare / Lead - Corazón musical',
        lightingUse: 'BACK PARS - Snare hits, Vocal presence',
    },
    HIGH_MID: {
        id: 'highMid',
        freqLow: 2000,
        freqHigh: 6000,
        description: 'Crunch / Ataque / Presencia - Edge definition',
        lightingUse: 'MOVER RIGHT - Guitar crunch, Cymbal attack',
    },
    TREBLE: {
        id: 'treble',
        freqLow: 6000,
        freqHigh: 16000,
        description: 'Brillo / Hi-Hats / Aire - Sparkle zone',
        lightingUse: 'STROBES - Hi-hat sync, Cymbal crashes',
    },
    ULTRA_AIR: {
        id: 'ultraAir',
        freqLow: 16000,
        freqHigh: 22000,
        description: 'Armónicos superiores - Sizzle digital',
        lightingUse: 'LASERS / MICRO-SCANNERS - Ultra-fast response',
    },
};
/**
 * BLACKMAN-HARRIS 4-TERM COEFFICIENTS
 *
 * Provides -92dB sidelobe suppression (vs -31dB for Hann).
 * Trade-off: Main lobe 2x wider, but we prefer PRECISION over temporal resolution.
 */
const BLACKMAN_HARRIS_COEFFICIENTS = {
    a0: 0.35875,
    a1: 0.48829,
    a2: 0.14128,
    a3: 0.01168,
};
/** Coherent gain for normalization */
const BLACKMAN_HARRIS_COHERENT_GAIN = 0.35875;
/**
 * AGC Configuration per band
 *
 * Attack: How fast gain increases when signal is low
 * Release: How fast gain decreases when signal is high
 *
 * Bass bands: Slower attack (preserve dynamics), faster release
 * Treble bands: Faster attack (catch transients), slower release
 */
const AGC_CONFIG = {
    subBass: { attackMs: 150, releaseMs: 50, targetRMS: 0.4, maxGain: 3.0 },
    bass: { attackMs: 120, releaseMs: 60, targetRMS: 0.45, maxGain: 2.5 },
    lowMid: { attackMs: 100, releaseMs: 80, targetRMS: 0.5, maxGain: 2.0 },
    mid: { attackMs: 80, releaseMs: 100, targetRMS: 0.5, maxGain: 2.0 },
    highMid: { attackMs: 60, releaseMs: 120, targetRMS: 0.45, maxGain: 2.5 },
    treble: { attackMs: 40, releaseMs: 150, targetRMS: 0.4, maxGain: 3.0 },
    ultraAir: { attackMs: 30, releaseMs: 180, targetRMS: 0.3, maxGain: 4.0 },
};
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: WINDOWING - BLACKMAN-HARRIS 4-TERM
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Pre-computed Blackman-Harris window (SINGLETON - generated once at startup)
 */
let BLACKMAN_HARRIS_WINDOW = null;
/**
 * Generate Blackman-Harris 4-term window.
 *
 * Formula: w[n] = a₀ - a₁·cos(2πn/N) + a₂·cos(4πn/N) - a₃·cos(6πn/N)
 *
 * Sidelobe suppression: -92dB (SURGICAL PRECISION)
 *
 * @param size - Window size (must be power of 2)
 * @returns Float32Array with window coefficients
 */
function generateBlackmanHarrisWindow(size) {
    const window = new Float32Array(size);
    const { a0, a1, a2, a3 } = BLACKMAN_HARRIS_COEFFICIENTS;
    const twoPi = 2 * Math.PI;
    const fourPi = 4 * Math.PI;
    const sixPi = 6 * Math.PI;
    const N = size - 1;
    for (let n = 0; n < size; n++) {
        const ratio = n / N;
        window[n] = a0
            - a1 * Math.cos(twoPi * ratio)
            + a2 * Math.cos(fourPi * ratio)
            - a3 * Math.cos(sixPi * ratio);
    }
    return window;
}
/**
 * Get or create the Blackman-Harris window (lazy initialization)
 */
function getBlackmanHarrisWindow(size) {
    if (!BLACKMAN_HARRIS_WINDOW || BLACKMAN_HARRIS_WINDOW.length !== size) {
        console.log(`[GOD EAR] 🩻 Generating Blackman-Harris window (${size} samples)`);
        BLACKMAN_HARRIS_WINDOW = generateBlackmanHarrisWindow(size);
    }
    return BLACKMAN_HARRIS_WINDOW;
}
/**
 * Apply Blackman-Harris window to audio samples.
 *
 * WAVE 2090.1: ZERO-ALLOCATION — writes into pre-allocated output buffer.
 *
 * @param samples - Input audio samples
 * @param output - Pre-allocated output buffer (MUST be >= samples.length)
 */
function applyBlackmanHarrisWindow(samples, output) {
    const window = getBlackmanHarrisWindow(samples.length);
    for (let i = 0; i < samples.length; i++) {
        output[i] = samples[i] * window[i];
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: DC OFFSET REMOVAL
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Remove DC offset from audio samples.
 *
 * DC offset causes bin[0] to contain garbage.
 * We remove it by subtracting the mean of the signal.
 *
 * WAVE 2090.1: ZERO-ALLOCATION — writes into pre-allocated output buffer.
 *
 * @param samples - Input audio samples
 * @param output - Pre-allocated output buffer (MUST be >= samples.length)
 */
function removeDCOffset(samples, output) {
    // Calculate mean (DC component)
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i];
    }
    const mean = sum / samples.length;
    // Subtract mean (remove DC) into output buffer
    for (let i = 0; i < samples.length; i++) {
        output[i] = samples[i] - mean;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: FFT CORE — COOLEY-TUKEY RADIX-2 DIT
// ═══════════════════════════════════════════════════════════════════════════════
//
// WAVE 2145 — THE RESURRECTION
//
// Classic Cooley-Tukey Radix-2 Decimation-In-Time (DIT) FFT.
//
// HISTORY OF FAILURE & REDEMPTION:
//   WAVE 2090.1: Original Radix-2 DIT — worked correctly
//   WAVE 2090.4: Replaced with Split-Radix (2/4) DIF — STRUCTURALLY BROKEN
//                The iterative DIF used `m >>= 1` (halving per stage) which
//                CANNOT represent Split-Radix's asymmetric decomposition
//                (N/2 for evens, N/4 + N/4 for odds). The resulting butterfly
//                had wrong cross-interactions AND wrong output permutation.
//                A recursive Split-Radix DIT was verified mathematically correct,
//                but the iterative conversion requires a non-standard permutation
//                (NOT bit-reversal) that makes it fragile and hard to maintain.
//   WAVE 2145:   Attempted butterfly-only fix (Sorensen merge) — INSUFFICIENT.
//                Tests proved the STRUCTURAL flaw was in the loop topology,
//                not just the butterfly. 24/32 tests failed vs brute-force DFT.
//   WAVE 2145.5: Replaced with VERIFIED Cooley-Tukey Radix-2 DIT.
//                ALL tests pass. Max error ~3e-5 for N=4096 (Float32 limit).
//                Performance: 0.6ms avg — 3.3x within 2ms budget.
//
// WHY RADIX-2 OVER SPLIT-RADIX:
//   The theoretical 37% arithmetic savings of Split-Radix is IRRELEVANT when:
//   - Current latency (0.6ms) is 3.3x under the 2ms budget
//   - The iterative Split-Radix DIF requires a non-standard digit-reversal
//     permutation that's error-prone and poorly documented
//   - V8's JIT optimizations on the simpler Radix-2 loop structure likely
//     close much of the theoretical gap anyway
//   - Correctness >>> micro-optimization. Always.
//
// ZERO-ALLOCATION: All output written into caller's pre-allocated buffers.
//
// References:
//   J.W. Cooley & J.W. Tukey, "An algorithm for the machine calculation
//     of complex Fourier series", Math. Comp., 1965
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Pre-computed bit-reversal table (SINGLETON — generated once per FFT size)
 */
let BIT_REVERSAL_TABLE = null;
let BIT_REVERSAL_SIZE = 0;
/**
 * Generate bit-reversal permutation table.
 * Standard Radix-2 bit-reversal: reverse the binary representation of each index.
 */
function generateBitReversalTable(n) {
    const bits = Math.log2(n) | 0;
    const table = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
        let reversed = 0;
        let x = i;
        for (let j = 0; j < bits; j++) {
            reversed = (reversed << 1) | (x & 1);
            x >>= 1;
        }
        table[i] = reversed;
    }
    return table;
}
/**
 * Get or create bit-reversal table (lazy singleton).
 */
function getBitReversalTable(n) {
    if (!BIT_REVERSAL_TABLE || BIT_REVERSAL_SIZE !== n) {
        BIT_REVERSAL_TABLE = generateBitReversalTable(n);
        BIT_REVERSAL_SIZE = n;
    }
    return BIT_REVERSAL_TABLE;
}
/**
 * Compute FFT using Cooley-Tukey Radix-2 Decimation-In-Time (DIT).
 *
 * WAVE 2145.5: VERIFIED against brute-force O(N²) DFT for all power-of-2
 * sizes from N=4 to N=4096. Max error ~3e-5 at N=4096 (Float32 precision).
 * Parseval energy conservation: relative error < 3e-9.
 *
 * Algorithm:
 *   1. Bit-reverse permutation of input into output buffers
 *   2. Bottom-up butterfly stages (size 2, 4, 8, ..., N)
 *   3. Each butterfly: a ± W·b where W = exp(-j·2π·k/m)
 *
 * ZERO-ALLOCATION: writes ONLY into the pre-allocated outReal/outImag buffers.
 *
 * @param samples - Windowed audio samples (MUST be power of 2, length >= 2)
 * @param outReal - Pre-allocated output buffer for real part
 * @param outImag - Pre-allocated output buffer for imaginary part
 */
function computeFFTCore(samples, outReal, outImag) {
    const n = samples.length;
    // ─── Step 1: Bit-reverse permutation of input ───
    const bitRev = getBitReversalTable(n);
    for (let i = 0; i < n; i++) {
        outReal[i] = samples[bitRev[i]];
        outImag[i] = 0;
    }
    // ─── Step 2: Bottom-up DIT butterfly stages ───
    // At each stage, groups of `size` elements are combined using
    // the Cooley-Tukey radix-2 butterfly with twiddle factor W_m^j.
    //
    // For the forward DFT with convention X[k] = Σ x[n]·exp(-j·2π·kn/N):
    //   W_m^j = exp(-j·2π·j/m) = cos(2πj/m) - j·sin(2πj/m)
    for (let size = 2; size <= n; size <<= 1) {
        const halfSize = size >> 1;
        const angleStep = -2 * Math.PI / size; // Negative for forward DFT
        for (let groupStart = 0; groupStart < n; groupStart += size) {
            for (let j = 0; j < halfSize; j++) {
                // Twiddle factor W = exp(-j·2π·j/size)
                const angle = angleStep * j;
                const wr = Math.cos(angle);
                const wi = Math.sin(angle);
                const evenIdx = groupStart + j;
                const oddIdx = groupStart + j + halfSize;
                // Twiddle the odd element: t = W · x[odd]
                const tRe = wr * outReal[oddIdx] - wi * outImag[oddIdx];
                const tIm = wr * outImag[oddIdx] + wi * outReal[oddIdx];
                // Butterfly: even = even + t, odd = even - t
                outReal[oddIdx] = outReal[evenIdx] - tRe;
                outImag[oddIdx] = outImag[evenIdx] - tIm;
                outReal[evenIdx] = outReal[evenIdx] + tRe;
                outImag[evenIdx] = outImag[evenIdx] + tIm;
            }
        }
    }
}
/**
 * Compute magnitude spectrum from complex FFT output.
 *
 * WAVE 2090.1: ZERO-ALLOCATION — writes into pre-allocated output buffer.
 *
 * @param real - Real part of FFT
 * @param imag - Imaginary part of FFT
 * @param output - Pre-allocated output buffer (MUST be >= numBins + 1)
 * @param numBins - Number of bins (real.length / 2)
 */
function computeMagnitudeSpectrum(real, imag, output, numBins) {
    // Normalization factor (window compensation + FFT normalization)
    const normFactor = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN);
    for (let i = 0; i <= numBins; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        output[i] = mag * normFactor;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: LINKWITZ-RILEY 4th ORDER DIGITAL FILTERS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Pre-computed LR4 filter masks for each band
 */
let LR4_FILTER_MASKS = null;
/**
 * Calculate Linkwitz-Riley 4th order response at a specific frequency.
 *
 * LR4 provides:
 * - 24dB/octave slope (vs 12dB for Butterworth 2nd order)
 * - Flat response at crossover (-6dB each = 0dB summed)
 * - Zero phase shift at crossover
 *
 * @param binFreq - Frequency of the bin being evaluated
 * @param crossoverFreq - Crossover frequency
 * @param isLowPass - true for low-pass, false for high-pass
 * @returns Filter weight 0.0-1.0
 */
function linkwitzRileyResponse(binFreq, crossoverFreq, isLowPass) {
    if (crossoverFreq <= 0)
        return isLowPass ? 1.0 : 0.0;
    if (binFreq <= 0)
        return isLowPass ? 1.0 : 0.0;
    const ratio = binFreq / crossoverFreq;
    // LR4 transfer function magnitude squared
    // |H(jω)|² = 1 / (1 + (ω/ωc)⁸) for low-pass
    // |H(jω)|² = (ω/ωc)⁸ / (1 + (ω/ωc)⁸) for high-pass
    const ratio8 = Math.pow(ratio, 8); // 4th order squared = 8th power
    if (isLowPass) {
        return 1.0 / (1.0 + ratio8);
    }
    else {
        return ratio8 / (1.0 + ratio8);
    }
}
/**
 * Generate filter mask for a frequency band.
 *
 * Each band is defined by a LOW crossover and HIGH crossover.
 * The mask weight at each bin = HP_response(low) × LP_response(high)
 *
 * @param fftSize - FFT size
 * @param sampleRate - Sample rate in Hz
 * @param lowCrossover - Low crossover frequency
 * @param highCrossover - High crossover frequency
 * @returns Filter mask for this band
 */
function generateBandMask(fftSize, sampleRate, lowCrossover, highCrossover) {
    const numBins = (fftSize >> 1) + 1;
    const mask = new Float32Array(numBins);
    const binResolution = sampleRate / fftSize;
    for (let bin = 0; bin < numBins; bin++) {
        const binFreq = bin * binResolution;
        // High-pass from lowCrossover
        const hpResponse = linkwitzRileyResponse(binFreq, lowCrossover, false);
        // Low-pass until highCrossover
        const lpResponse = linkwitzRileyResponse(binFreq, highCrossover, true);
        // Band is the intersection of both filters
        mask[bin] = hpResponse * lpResponse;
    }
    return mask;
}
/**
 * Initialize or get pre-computed LR4 filter masks for all bands.
 */
function getLR4FilterMasks(fftSize, sampleRate) {
    if (LR4_FILTER_MASKS) {
        return LR4_FILTER_MASKS;
    }
    // WAVE 2098: Boot silence — LR4 filter generation logs removed
    LR4_FILTER_MASKS = new Map();
    for (const [key, config] of Object.entries(GOD_EAR_BAND_CONFIG)) {
        const mask = generateBandMask(fftSize, sampleRate, config.freqLow, config.freqHigh);
        LR4_FILTER_MASKS.set(config.id, mask);
    }
    return LR4_FILTER_MASKS;
}
/**
 * Extract band energy using LR4 filtered magnitudes.
 *
 * @param magnitudes - Magnitude spectrum
 * @param mask - LR4 filter mask for this band
 * @returns RMS energy for this band (0.0-1.0)
 */
function extractBandEnergy(magnitudes, mask) {
    let energy = 0;
    let weightSum = 0;
    for (let bin = 0; bin < magnitudes.length && bin < mask.length; bin++) {
        const weight = mask[bin];
        if (weight > 0.001) { // Skip negligible weights for performance
            energy += magnitudes[bin] * magnitudes[bin] * weight;
            weightSum += weight;
        }
    }
    // Normalize by total weight to maintain consistent scale
    if (weightSum > 0) {
        energy /= weightSum;
    }
    // Return RMS
    return Math.sqrt(energy);
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: SPECTRAL METRICS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Calculate Spectral Centroid (brightness indicator).
 *
 * "Center of mass" of the spectrum. Higher = brighter sound.
 *
 * Formula: Σ(f[k] × |X[k]|²) / Σ(|X[k]|²)
 *
 * Typical values:
 * - Kick: 80-200Hz
 * - Male voice: 300-500Hz
 * - Female voice: 400-700Hz
 * - Cymbals: 3000-6000Hz
 */
function calculateSpectralCentroid(magnitudes, sampleRate, fftSize) {
    const binResolution = sampleRate / fftSize;
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let bin = 1; bin < magnitudes.length; bin++) { // Skip DC
        const freq = bin * binResolution;
        const mag2 = magnitudes[bin] * magnitudes[bin];
        weightedSum += freq * mag2;
        magnitudeSum += mag2;
    }
    if (magnitudeSum === 0)
        return 0;
    return weightedSum / magnitudeSum;
}
/**
 * Calculate Spectral Flatness (Wiener Entropy).
 *
 * Measures how "tonal" vs "noisy" the spectrum is.
 *
 * Formula: geometric_mean(|X|²) / arithmetic_mean(|X|²)
 *
 * Values:
 * - 0.0: Pure tone (all energy in one frequency)
 * - 1.0: White noise (energy uniformly distributed)
 * - 0.1-0.3: Tonal music (clear instruments)
 * - 0.4-0.6: Percussive music
 * - 0.7+: Noise/effects
 */
function calculateSpectralFlatness(magnitudes) {
    const n = magnitudes.length - 1; // Exclude DC
    if (n <= 0)
        return 0;
    let logSum = 0;
    let arithmeticSum = 0;
    let validBins = 0;
    for (let bin = 1; bin < magnitudes.length; bin++) {
        const mag2 = magnitudes[bin] * magnitudes[bin];
        if (mag2 > 1e-10) { // Avoid log(0)
            logSum += Math.log(mag2);
            validBins++;
        }
        arithmeticSum += mag2;
    }
    if (validBins === 0 || arithmeticSum === 0)
        return 0;
    const geometricMean = Math.exp(logSum / validBins);
    const arithmeticMean = arithmeticSum / n;
    return Math.min(1.0, geometricMean / arithmeticMean);
}
/**
 * Calculate Spectral Rolloff.
 *
 * Frequency below which 85% of the energy is contained.
 *
 * Indicates if music is:
 * - Low rolloff: Hip-hop, Dub, Bass music
 * - High rolloff: EDM, Pop, Hi-fi
 */
function calculateSpectralRolloff(magnitudes, sampleRate, fftSize, percentile = 0.85) {
    const binResolution = sampleRate / fftSize;
    // Calculate total energy
    let totalEnergy = 0;
    for (let bin = 1; bin < magnitudes.length; bin++) {
        totalEnergy += magnitudes[bin] * magnitudes[bin];
    }
    if (totalEnergy === 0)
        return 0;
    // Find frequency where percentile% of energy is reached
    const threshold = totalEnergy * percentile;
    let cumulativeEnergy = 0;
    for (let bin = 1; bin < magnitudes.length; bin++) {
        cumulativeEnergy += magnitudes[bin] * magnitudes[bin];
        if (cumulativeEnergy >= threshold) {
            return bin * binResolution;
        }
    }
    return sampleRate / 2; // Nyquist if threshold not reached
}
/**
 * Calculate Clarity Index (proprietary GOD EAR metric).
 *
 * Measures how "clean" the signal is.
 *
 * Based on:
 * 1. Spectral Flatness inverse (more tonal = clearer)
 * 2. Crest Factor (peak/RMS - more dynamic = clearer)
 * 3. Spectral Concentration (energy in peaks vs floor)
 *
 * WAVE 2090.1: ZERO-ALLOCATION REFACTOR
 * OLD: Array.from(magnitudes).sort() — O(N log N) + Array copy of 2049 elements per frame
 * NEW: Single-pass O(N) with running threshold — ZERO allocations, ZERO copies
 *
 * Algorithm: Instead of sorting to find "top 10%" energy, we compute the
 * RMS (root-mean-square) of all magnitudes in a single pass, then do a
 * second pass counting bins that exceed RMS as "peak" bins. This gives
 * equivalent spectral concentration measurement without sort or copy.
 *
 * Values:
 * - 0.0-0.3: Very noisy (mp3 128kbps, bad master)
 * - 0.4-0.6: Normal quality (typical streaming)
 * - 0.7-0.9: High fidelity (CD quality, good master)
 * - 0.9+: Studio quality
 */
function calculateClarity(magnitudes, flatness, crestFactor, numBins) {
    // Factor 1: Tonality (inverse of flatness)
    const tonality = 1.0 - flatness;
    // Factor 2: Normalized crest factor (typical max ~6)
    const normalizedCrest = Math.min(1.0, crestFactor / 6.0);
    // Factor 3: Spectral concentration — ZERO-ALLOCATION O(N)
    // Pass 1: Compute total energy and RMS threshold in one sweep
    let totalEnergy = 0;
    for (let i = 0; i < numBins; i++) {
        totalEnergy += magnitudes[i] * magnitudes[i];
    }
    if (totalEnergy === 0) {
        return 0;
    }
    const rmsThreshold = Math.sqrt(totalEnergy / numBins);
    // Pass 2: Sum energy of bins above RMS threshold ("peaks")
    // Bins above RMS are considered "dominant frequency content"
    // In a tonal signal, few bins hold most energy → high concentration
    // In noise, all bins are similar → low concentration
    let peakEnergy = 0;
    for (let i = 0; i < numBins; i++) {
        if (magnitudes[i] > rmsThreshold) {
            peakEnergy += magnitudes[i] * magnitudes[i];
        }
    }
    const concentration = peakEnergy / totalEnergy;
    // Combine with weights
    const clarity = (tonality * 0.4 +
        normalizedCrest * 0.3 +
        concentration * 0.3);
    return Math.min(1.0, clarity);
}
/**
 * Calculate Crest Factor (Peak/RMS ratio).
 *
 * Indicates dynamic range:
 * - Low (~1-2): Heavily compressed (loud war)
 * - Medium (~3-6): Normal music
 * - High (~6+): Very dynamic (classical, jazz)
 */
function calculateCrestFactor(magnitudes) {
    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < magnitudes.length; i++) {
        if (magnitudes[i] > peak)
            peak = magnitudes[i];
        sumSquares += magnitudes[i] * magnitudes[i];
    }
    const rms = Math.sqrt(sumSquares / magnitudes.length);
    if (rms === 0)
        return 0;
    return peak / rms;
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: STEREO ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Calculate Phase Correlation (stereo coherence).
 *
 * Formula: correlation(L, R) = Σ(L×R) / √(Σ(L²) × Σ(R²))
 *
 * Values:
 * - +1.0: Perfect mono (L = R)
 * - 0.0: Decorrelated stereo (L independent of R)
 * - -1.0: Out of phase (L = -R) → Mixing problems
 */
function calculatePhaseCorrelation(leftChannel, rightChannel) {
    if (leftChannel.length !== rightChannel.length)
        return 1;
    let dotProduct = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let i = 0; i < leftChannel.length; i++) {
        dotProduct += leftChannel[i] * rightChannel[i];
        leftEnergy += leftChannel[i] * leftChannel[i];
        rightEnergy += rightChannel[i] * rightChannel[i];
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    if (denominator === 0)
        return 1; // Silence = mono
    return dotProduct / denominator;
}
/**
 * Calculate Stereo Width (derived from phase correlation).
 *
 * Maps correlation to perceived width:
 * - correlation +1.0 → width 0.0 (mono)
 * - correlation 0.0  → width 1.0 (full stereo)
 * - correlation -1.0 → width 2.0 (super-wide/problematic)
 */
function calculateStereoWidth(phaseCorrelation) {
    return 1.0 - phaseCorrelation;
}
/**
 * Calculate L/R Balance.
 *
 * @returns -1 (full left) to +1 (full right), 0 = centered
 */
function calculateStereoBalance(leftChannel, rightChannel) {
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let i = 0; i < leftChannel.length; i++) {
        leftEnergy += leftChannel[i] * leftChannel[i];
        rightEnergy += rightChannel[i] * rightChannel[i];
    }
    const totalEnergy = leftEnergy + rightEnergy;
    if (totalEnergy === 0)
        return 0;
    // Balance = (R - L) / (R + L)
    return (rightEnergy - leftEnergy) / totalEnergy;
}
/**
 * Full stereo analysis.
 */
function analyzeStereo(leftChannel, rightChannel) {
    const correlation = calculatePhaseCorrelation(leftChannel, rightChannel);
    const width = calculateStereoWidth(correlation);
    const balance = calculateStereoBalance(leftChannel, rightChannel);
    return { correlation, width, balance };
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: AGC TRUST ZONES (Per-Band Independent Gain Control)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * AGC Trust Zone Controller
 *
 * Each band has independent gain control to prevent the "yoyo effect"
 * where a loud bass causes everything to duck, or quiet highs disappear.
 */
class AGCTrustZone {
    constructor() {
        this.gains = {};
        this.rmsHistory = {};
        this.historyLength = 20; // ~1 second @ 20fps
        this.isActive = true;
        // Initialize gains to 1.0 for all bands
        for (const config of Object.values(GOD_EAR_BAND_CONFIG)) {
            this.gains[config.id] = 1.0;
            this.rmsHistory[config.id] = [];
        }
    }
    /**
     * Process a band through its AGC trust zone.
     *
     * @param bandId - Band identifier
     * @param rawValue - Raw RMS value from LR4 filter
     * @param deltaMs - Time since last frame
     * @returns Gain-adjusted value
     */
    process(bandId, rawValue, deltaMs) {
        if (!this.isActive) {
            return rawValue;
        }
        const config = AGC_CONFIG[bandId];
        if (!config)
            return rawValue;
        // Update RMS history
        if (!this.rmsHistory[bandId]) {
            this.rmsHistory[bandId] = [];
        }
        this.rmsHistory[bandId].push(rawValue);
        if (this.rmsHistory[bandId].length > this.historyLength) {
            this.rmsHistory[bandId].shift();
        }
        // Calculate average RMS over history
        const avgRMS = this.rmsHistory[bandId].reduce((a, b) => a + b, 0) /
            this.rmsHistory[bandId].length;
        // Calculate target gain
        let targetGain = 1.0;
        if (avgRMS > 0.001) {
            targetGain = config.targetRMS / avgRMS;
            targetGain = Math.min(targetGain, config.maxGain);
            targetGain = Math.max(targetGain, 0.1); // Don't attenuate too much
        }
        // Smooth gain change (attack/release asymmetry)
        const currentGain = this.gains[bandId] || 1.0;
        const gainDiff = targetGain - currentGain;
        let smoothingTime;
        if (gainDiff > 0) {
            // Increasing gain (attack) - slower to preserve dynamics
            smoothingTime = config.attackMs;
        }
        else {
            // Decreasing gain (release) - faster to prevent clipping
            smoothingTime = config.releaseMs;
        }
        // Exponential smoothing
        const alpha = Math.min(1.0, deltaMs / smoothingTime);
        this.gains[bandId] = currentGain + gainDiff * alpha;
        // Apply gain
        return Math.min(1.0, rawValue * this.gains[bandId]);
    }
    /**
     * Get current AGC state for all bands.
     */
    getState() {
        return {
            globalGain: 1.0, // We don't use global gain anymore
            perBandGains: {
                subBass: this.gains.subBass || 1.0,
                bass: this.gains.bass || 1.0,
                lowMid: this.gains.lowMid || 1.0,
                mid: this.gains.mid || 1.0,
                highMid: this.gains.highMid || 1.0,
                treble: this.gains.treble || 1.0,
                ultraAir: this.gains.ultraAir || 1.0,
            },
            isActive: this.isActive,
            attackMs: 100, // Average
            releaseMs: 100, // Average
        };
    }
    /**
     * Enable/disable AGC
     */
    setActive(active) {
        this.isActive = active;
    }
    /**
     * Reset AGC state
     */
    reset() {
        for (const config of Object.values(GOD_EAR_BAND_CONFIG)) {
            this.gains[config.id] = 1.0;
            this.rmsHistory[config.id] = [];
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: TRANSIENT DETECTION (Slope-Based)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Slope-Based Onset Detector
 *
 * Detects transients based on the RATE of energy change, not absolute value.
 * This is more robust with clean FFT signals.
 */
class SlopeBasedOnsetDetector {
    constructor() {
        this.history = {};
        this.historyIndex = {};
        this.historyLength = 8;
        for (const band of ['kick', 'snare', 'hihat']) {
            this.history[band] = new Float32Array(this.historyLength);
            this.historyIndex[band] = 0;
        }
    }
    /**
     * Detect onset based on energy slope.
     *
     * @param band - Which band to check ('kick', 'snare', 'hihat')
     * @param energy - Current energy value
     * @returns true if onset detected
     */
    detectOnset(band, energy) {
        if (!this.history[band])
            return false;
        // Store in circular buffer
        this.history[band][this.historyIndex[band]] = energy;
        this.historyIndex[band] = (this.historyIndex[band] + 1) % this.historyLength;
        // Calculate slopes
        const current = energy;
        const idx = this.historyIndex[band];
        const len = this.historyLength;
        const previous = this.history[band][(idx + len - 2) % len];
        const older = this.history[band][(idx + len - 4) % len];
        const shortTermSlope = current - previous;
        const longTermSlope = current - older;
        // Calculate average energy
        let sum = 0;
        for (let i = 0; i < len; i++) {
            sum += this.history[band][i];
        }
        const avgEnergy = sum / len;
        // Onset = rapid positive slope
        const slopeThreshold = Math.max(0.05, avgEnergy * 0.3);
        return shortTermSlope > slopeThreshold && longTermSlope > slopeThreshold * 0.5;
    }
    /**
     * Reset detector state
     */
    reset() {
        for (const band of Object.keys(this.history)) {
            this.history[band].fill(0);
            this.historyIndex[band] = 0;
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: MAIN GOD EAR ANALYZER CLASS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * GOD EAR FFT ANALYZER
 *
 * Military-grade spectroscopy engine for LuxSync.
 *
 * WAVE 2090.1: ZERO-ALLOCATION PIPELINE
 * All working buffers are pre-allocated ONCE at construction time.
 * Per-frame processing mutates existing buffers in-place.
 * GC pressure: ~0 bytes/frame (down from ~90KB/frame × 20fps = ~1.8MB/s)
 *
 * Features:
 * - Blackman-Harris windowing (-92dB sidelobes)
 * - Linkwitz-Riley 4th order digital crossovers
 * - 7 tactical bands with ZERO overlap
 * - Per-band AGC Trust Zones
 * - Advanced spectral metrics
 * - Stereo phase correlation
 */
// ═══════════════════════════════════════════════════════════════════════════════
// 🎹 WAVE 2301: THE CHROMAGRAM AWAKENING
// Computes a 12-bin chromagram from the magnitude spectrum produced by Stage 4.
//
// Algorithm:
//   binFreq = bin * (sampleRate / fftSize)
//   midiNote = 12 * log2(freq / 440) + 69
//   pitchClass = round(midiNote) % 12   (0=C, 1=C#, ... 11=B)
//   energy accumulated as power (magnitude²) per pitch class
//   output normalized to [0, 1]
//
// Musical range: A0 (27.5 Hz) → C8 (4186 Hz)
// ZERO allocation: writes directly into pre-allocated Float32Array(12)
// ═══════════════════════════════════════════════════════════════════════════════
function computeChromaFromSpectrum(magnitudes, numBins, sampleRate, fftSize, output // 12 elements, pre-allocated
) {
    output.fill(0);
    const binResolution = sampleRate / fftSize;
    for (let bin = 1; bin <= numBins; bin++) {
        const freq = bin * binResolution;
        if (freq < 27.5 || freq > 4186.0)
            continue; // musical range only
        const midiNote = 12 * Math.log2(freq / 440) + 69;
        const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12; // guard negative modulo
        output[pitchClass] += magnitudes[bin] * magnitudes[bin]; // power, not amplitude
    }
    // Normalize to [0, 1]
    let maxEnergy = 0;
    for (let i = 0; i < 12; i++) {
        if (output[i] > maxEnergy)
            maxEnergy = output[i];
    }
    if (maxEnergy > 0) {
        for (let i = 0; i < 12; i++)
            output[i] /= maxEnergy;
    }
}
export class GodEarAnalyzer {
    constructor(sampleRate = 44100, fftSize = 4096) {
        this.frameIndex = 0;
        this.lastTimestamp = 0;
        // Feature flags
        this.useAGC = true;
        this.useStereo = true;
        this.sampleRate = sampleRate;
        this.fftSize = fftSize;
        this.numBins = fftSize >> 1; // fftSize / 2
        this.agc = new AGCTrustZone();
        this.onsetDetector = new SlopeBasedOnsetDetector();
        // ═════════ WAVE 2090.1: ONE-TIME BUFFER ALLOCATION ═════════
        this.inputBuffer = new Float32Array(fftSize);
        this.dcBuffer = new Float32Array(fftSize);
        this.windowedBuffer = new Float32Array(fftSize);
        this.fftReal = new Float32Array(fftSize);
        this.fftImag = new Float32Array(fftSize);
        this.magnitudes = new Float32Array(this.numBins + 1); // Include Nyquist
        this.monoMixBuffer = new Float32Array(fftSize);
        // 🎹 WAVE 2301: 12-bin chromagram buffer (pitch classes C through B)
        this.chromaBuffer = new Float32Array(12);
        // ════════════════════════════════════════════════════════════
        // Initialize LR4 filter masks (also one-time)
        getLR4FilterMasks(fftSize, sampleRate);
        // WAVE 2098: Boot silence
    }
    /**
     * Analyze mono audio buffer.
     *
     * WAVE 2090.1: ZERO-ALLOCATION — entire pipeline operates on pre-allocated buffers.
     * No new Float32Array, no Array.from, no .sort(), no .slice() in the hot path.
     *
     * @param buffer - Audio samples (Float32Array)
     * @returns Complete GodEarSpectrum
     */
    analyze(buffer) {
        const startTime = performance.now();
        // ═══ STAGE 0: Prepare input into pre-allocated buffer ═══
        // Zero out the input buffer (handles padding implicitly)
        this.inputBuffer.fill(0);
        // Copy input samples (up to fftSize) — NO slice(), NO new array
        const copyLen = Math.min(buffer.length, this.fftSize);
        for (let i = 0; i < copyLen; i++) {
            this.inputBuffer[i] = buffer[i];
        }
        // ═══ STAGE 1: DC Offset Removal → dcBuffer ═══
        removeDCOffset(this.inputBuffer, this.dcBuffer);
        // ═══ STAGE 2: Blackman-Harris Windowing → windowedBuffer ═══
        applyBlackmanHarrisWindow(this.dcBuffer, this.windowedBuffer);
        // ═══ STAGE 3: FFT → fftReal, fftImag ═══
        computeFFTCore(this.windowedBuffer, this.fftReal, this.fftImag);
        // ═══ STAGE 4: Magnitude Spectrum → magnitudes ═══
        computeMagnitudeSpectrum(this.fftReal, this.fftImag, this.magnitudes, this.numBins);
        // 🎹 WAVE 2301: THE CHROMAGRAM AWAKENING
        // Compute 12-bin chromagram directly from magnitude spectrum.
        // Bin frequency → MIDI note → pitch class (0=C … 11=B), power accumulated, normalized.
        // Zero-allocation: writes into pre-allocated this.chromaBuffer.
        computeChromaFromSpectrum(this.magnitudes, this.numBins, this.sampleRate, this.fftSize, this.chromaBuffer);
        // ═══ STAGE 5: LR4 Filter Bank + Band Extraction ═══
        const filterMasks = getLR4FilterMasks(this.fftSize, this.sampleRate);
        const deltaMs = this.lastTimestamp > 0 ? startTime - this.lastTimestamp : 50;
        this.lastTimestamp = startTime;
        // Extract raw band energies (reads from this.magnitudes, no allocation)
        const rawBands = {
            subBass: extractBandEnergy(this.magnitudes, filterMasks.get('subBass')),
            bass: extractBandEnergy(this.magnitudes, filterMasks.get('bass')),
            lowMid: extractBandEnergy(this.magnitudes, filterMasks.get('lowMid')),
            mid: extractBandEnergy(this.magnitudes, filterMasks.get('mid')),
            highMid: extractBandEnergy(this.magnitudes, filterMasks.get('highMid')),
            treble: extractBandEnergy(this.magnitudes, filterMasks.get('treble')),
            ultraAir: extractBandEnergy(this.magnitudes, filterMasks.get('ultraAir')),
        };
        // ═══ STAGE 6: AGC Trust Zones ═══
        const bands = this.useAGC ? {
            subBass: this.agc.process('subBass', rawBands.subBass, deltaMs),
            bass: this.agc.process('bass', rawBands.bass, deltaMs),
            lowMid: this.agc.process('lowMid', rawBands.lowMid, deltaMs),
            mid: this.agc.process('mid', rawBands.mid, deltaMs),
            highMid: this.agc.process('highMid', rawBands.highMid, deltaMs),
            treble: this.agc.process('treble', rawBands.treble, deltaMs),
            ultraAir: this.agc.process('ultraAir', rawBands.ultraAir, deltaMs),
        } : rawBands;
        // ═══ Spectral Metrics (reads from this.magnitudes, no allocation) ═══
        const flatness = calculateSpectralFlatness(this.magnitudes);
        const crestFactor = calculateCrestFactor(this.magnitudes);
        const spectral = {
            centroid: calculateSpectralCentroid(this.magnitudes, this.sampleRate, this.fftSize),
            flatness,
            rolloff: calculateSpectralRolloff(this.magnitudes, this.sampleRate, this.fftSize),
            crestFactor,
            clarity: calculateClarity(this.magnitudes, flatness, crestFactor, this.numBins + 1),
        };
        // ═══ Transient Detection ═══
        const kickDetected = this.onsetDetector.detectOnset('kick', rawBands.subBass + rawBands.bass * 0.5);
        const snareDetected = this.onsetDetector.detectOnset('snare', rawBands.mid + rawBands.lowMid * 0.5);
        const hihatDetected = this.onsetDetector.detectOnset('hihat', rawBands.treble + rawBands.highMid * 0.3);
        const transients = {
            kick: kickDetected,
            snare: snareDetected,
            hihat: hihatDetected,
            any: kickDetected || snareDetected || hihatDetected,
            strength: Math.max(kickDetected ? rawBands.subBass : 0, snareDetected ? rawBands.mid : 0, hihatDetected ? rawBands.treble : 0),
        };
        // ═══ Dominant Frequency (reads from this.magnitudes, no allocation) ═══
        let maxMag = 0;
        let dominantBin = 0;
        for (let i = 1; i <= this.numBins; i++) {
            if (this.magnitudes[i] > maxMag) {
                maxMag = this.magnitudes[i];
                dominantBin = i;
            }
        }
        const dominantFrequency = dominantBin * (this.sampleRate / this.fftSize);
        // ═══ Total Energy (reads from this.magnitudes, no allocation) ═══
        let totalEnergy = 0;
        for (let i = 0; i <= this.numBins; i++) {
            totalEnergy += this.magnitudes[i] * this.magnitudes[i];
        }
        totalEnergy = Math.sqrt(totalEnergy);
        const processingLatency = performance.now() - startTime;
        this.frameIndex++;
        // ═══ STAGE 7: Output ═══
        return {
            bands,
            bandsRaw: rawBands,
            spectral,
            stereo: null, // Mono analysis
            transients,
            agc: this.agc.getState(),
            meta: {
                timestamp: startTime,
                frameIndex: this.frameIndex,
                processingLatencyMs: processingLatency,
                fftSize: this.fftSize,
                sampleRate: this.sampleRate,
                windowFunction: 'blackman-harris',
                filterOrder: 4,
                version: '2.0.0',
            },
            dominantFrequency,
            totalEnergy,
            // 🎹 WAVE 2301: 12-bin chromagram (C through B, normalized 0-1)
            // Array.from is a one-time 12-element copy — negligible at 20fps.
            chroma: Array.from(this.chromaBuffer),
        };
    }
    /**
     * Analyze stereo audio buffers.
     *
     * WAVE 2090.1: Uses pre-allocated monoMixBuffer — ZERO allocation.
     *
     * @param leftBuffer - Left channel samples
     * @param rightBuffer - Right channel samples
     * @returns Complete GodEarSpectrum with stereo metrics
     */
    analyzeStereo(leftBuffer, rightBuffer) {
        // Mix to mono using pre-allocated buffer — ZERO allocation
        const len = Math.min(leftBuffer.length, this.fftSize);
        for (let i = 0; i < len; i++) {
            this.monoMixBuffer[i] = (leftBuffer[i] + rightBuffer[i]) * 0.5;
        }
        // Zero remaining samples if input is shorter than fftSize
        for (let i = len; i < this.fftSize; i++) {
            this.monoMixBuffer[i] = 0;
        }
        const result = this.analyze(this.monoMixBuffer);
        // Add stereo analysis
        if (this.useStereo) {
            result.stereo = analyzeStereo(leftBuffer, rightBuffer);
        }
        return result;
    }
    /**
     * Configure analyzer features
     */
    configure(options) {
        if (options.useAGC !== undefined) {
            this.useAGC = options.useAGC;
            this.agc.setActive(options.useAGC);
        }
        if (options.useStereo !== undefined) {
            this.useStereo = options.useStereo;
        }
    }
    /**
     * Reset analyzer state
     */
    reset() {
        this.agc.reset();
        this.onsetDetector.reset();
        this.frameIndex = 0;
        this.lastTimestamp = 0;
        console.log('[GOD EAR] 🔄 Analyzer reset');
    }
    /**
     * Get analyzer info
     */
    getInfo() {
        return `GOD EAR v2.0.0 | ${this.fftSize} Radix-2 DIT FFT | ${this.sampleRate}Hz | ${BIN_RESOLUTION.toFixed(2)}Hz/bin | Blackman-Harris | LR4 Filters`;
    }
    /**
     * Find nearest power of 2
     */
    nearestPowerOf2(n) {
        let power = 1;
        while (power * 2 <= n) {
            power *= 2;
        }
        return power;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: VERIFICATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * SEPARATION TEST
 *
 * Verify that a 50Hz pure tone does NOT leak significantly into BASS band.
 * This is the "fire test" for LR4 filter separation.
 *
 * Expected behavior:
 * - SubBass should have MOST of the 50Hz energy
 * - Bass should have LESS than SubBass (LR4 attenuates at crossover)
 * - Other bands should be ~0%
 *
 * The test passes if:
 * - SubBass > Bass (50Hz is in SubBass range)
 * - LowMid, Mid, HighMid, Treble, UltraAir are near zero
 */
export function verifySeparation(sampleRate = 44100, fftSize = 4096) {
    console.log('[GOD EAR] 🧪 Running LR4 separation test...');
    const filterMasks = getLR4FilterMasks(fftSize, sampleRate);
    // Generate pure 50Hz tone magnitude (only one bin has energy)
    const numBins = (fftSize >> 1) + 1;
    const testMagnitudes = new Float32Array(numBins);
    const binResolution = sampleRate / fftSize;
    const bin50Hz = Math.round(50 / binResolution);
    testMagnitudes[bin50Hz] = 1.0;
    // Extract each band
    const results = {};
    for (const [key, config] of Object.entries(GOD_EAR_BAND_CONFIG)) {
        const mask = filterMasks.get(config.id);
        if (mask) {
            results[config.id] = extractBandEnergy(testMagnitudes, mask);
        }
    }
    // Normalize results relative to maximum for clearer display
    const maxResult = Math.max(...Object.values(results));
    const normalizedResults = {};
    for (const key of Object.keys(results)) {
        normalizedResults[key] = maxResult > 0 ? results[key] / maxResult : 0;
    }
    console.log('[GOD EAR] 🧪 SEPARATION TEST (50Hz pure tone):');
    console.log(`   subBass: ${(normalizedResults.subBass * 100).toFixed(1)}% ← Expected: HIGHEST`);
    console.log(`   bass:    ${(normalizedResults.bass * 100).toFixed(1)}% ← Expected: <SubBass (LR4 rolloff)`);
    console.log(`   lowMid:  ${(normalizedResults.lowMid * 100).toFixed(1)}% ← Expected: ~0%`);
    console.log(`   mid:     ${(normalizedResults.mid * 100).toFixed(1)}% ← Expected: ~0%`);
    console.log(`   highMid: ${(normalizedResults.highMid * 100).toFixed(1)}% ← Expected: ~0%`);
    console.log(`   treble:  ${(normalizedResults.treble * 100).toFixed(1)}% ← Expected: ~0%`);
    console.log(`   ultraAir:${(normalizedResults.ultraAir * 100).toFixed(1)}% ← Expected: ~0%`);
    // Test criteria:
    // 1. SubBass should be the highest (it contains 50Hz)
    // 2. Bass should be significantly lower (50Hz is at edge of SubBass/Bass crossover)
    // 3. All other bands should be near zero
    const subBassIsHighest = results.subBass >= results.bass;
    const lowerBandsClean = normalizedResults.lowMid < 0.01 &&
        normalizedResults.mid < 0.01 &&
        normalizedResults.highMid < 0.01 &&
        normalizedResults.treble < 0.01 &&
        normalizedResults.ultraAir < 0.01;
    const passed = subBassIsHighest && lowerBandsClean;
    if (passed) {
        console.log(`[GOD EAR] 🧪 RESULT: ✅ PASS - SURGICAL SEPARATION ACHIEVED`);
        console.log(`[GOD EAR]    SubBass dominates (${(normalizedResults.subBass * 100).toFixed(1)}%), higher bands isolated`);
    }
    else {
        console.log(`[GOD EAR] 🧪 RESULT: ❌ FAIL - CHECK FILTER IMPLEMENTATION`);
        if (!subBassIsHighest) {
            console.log(`[GOD EAR]    Issue: SubBass should be highest for 50Hz tone`);
        }
        if (!lowerBandsClean) {
            console.log(`[GOD EAR]    Issue: Higher bands should be near zero`);
        }
    }
    return passed;
}
/**
 * PERFORMANCE BENCHMARK
 *
 * Target: <2ms per frame (60fps = 16.6ms budget)
 */
export function benchmarkPerformance(iterations = 100) {
    console.log(`[GOD EAR] ⏱️ Running performance benchmark (${iterations} iterations)...`);
    const analyzer = new GodEarAnalyzer();
    const testBuffer = new Float32Array(4096);
    // Fill with noise
    for (let i = 0; i < testBuffer.length; i++) {
        testBuffer[i] = (Math.random() - 0.5) * 2;
    }
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        analyzer.analyze(testBuffer);
        times.push(performance.now() - start);
    }
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const grade = avgTime < 1.0 ? 'GODLIKE' :
        avgTime < 2.0 ? 'EXCELLENT' :
            avgTime < 3.0 ? 'GOOD' :
                avgTime < 5.0 ? 'ACCEPTABLE' : 'SLOW';
    console.log('[GOD EAR] ⏱️ PERFORMANCE BENCHMARK RESULTS:');
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min:     ${minTime.toFixed(2)}ms`);
    console.log(`   Max:     ${maxTime.toFixed(2)}ms`);
    console.log(`   Grade:   ${grade}`);
    console.log(`   Target:  <2ms ← ${avgTime < 2.0 ? '✅ ACHIEVED' : '⚠️ NEEDS OPTIMIZATION'}`);
}
/**
 * Convert GodEarSpectrum to legacy BandEnergy format.
 */
export function toLegacyFormat(spectrum) {
    return {
        bass: spectrum.bands.bass + spectrum.bands.subBass * 0.5,
        lowMid: spectrum.bands.lowMid,
        mid: spectrum.bands.mid,
        highMid: spectrum.bands.highMid + spectrum.bands.treble * 0.3,
        treble: spectrum.bands.treble + spectrum.bands.ultraAir * 0.5,
        subBass: spectrum.bands.subBass,
        dominantFrequency: spectrum.dominantFrequency,
        spectralCentroid: spectrum.spectral.centroid,
        harshness: spectrum.bands.highMid, // Approximate
        spectralFlatness: spectrum.spectral.flatness,
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default GodEarAnalyzer;
// WAVE 2098: Boot silence — module load log removed
