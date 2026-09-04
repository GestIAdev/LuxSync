/**
 * 🩻 PROJECT "GOD EAR" - SURGICAL FFT REVOLUTION
 * WAVE 1016 - Phase 1: CORE FFT Implementation
 *
 * Espectroscopio Quirúrgico de Grado Militar para LuxSync.
 *
 * Features:
 * - Blackman-Harris 4-term windowing (-92dB sidelobes)
 * - LR4-equivalent magnitude-response band masks (frequency-domain, 24dB/octave)
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
// WAVE 3290: Console blackout removed — logging now controlled by debugMode flag.
/** FFT Configuration */
const FFT_SIZE = 4096;
const DEFAULT_SAMPLE_RATE = 44100;
const BIN_RESOLUTION = DEFAULT_SAMPLE_RATE / FFT_SIZE; // 10.77Hz per bin
const NYQUIST = DEFAULT_SAMPLE_RATE / 2; // 22050Hz
/**
 * 7 TACTICAL BAND DEFINITIONS
 *
 * Designed for ZERO OVERLAP using LR4-equivalent magnitude-response band masks.
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
    mid: { attackMs: 80, releaseMs: 100, targetRMS: 0.55, maxGain: 3.0 },
    highMid: { attackMs: 60, releaseMs: 120, targetRMS: 0.55, maxGain: 3.5 },
    treble: { attackMs: 40, releaseMs: 150, targetRMS: 0.50, maxGain: 4.0 },
    ultraAir: { attackMs: 30, releaseMs: 180, targetRMS: 0.3, maxGain: 4.0 },
};
/**
 * WAVE 3424 - Post-FFT amplitude recovery (visual/control path only).
 *
 * For each band we first compute an RMS over the weighted bins:
 *   rms_avg = sqrt( Σ(|X[k]|^2 * w[k]) / Σ(w[k]) )
 *
 * That average is mathematically clean but visually tiny, because energy of a
 * strong transient is spread across many bins (windowing + finite FFT resolution).
 * To recover proportional band amplitude for DMX modulation we convert to an
 * integrated RMS estimate:
 *   rms_integrated ≈ rms_avg * sqrt(Σ(w[k]))
 *
 * Then we apply a deterministic legacy-equivalence gain so the post-FFT band
 * magnitude is comparable to the historical WebAudio visual scale.
 *
 * IMPORTANT:
 * - This scaling is applied to the pre-AGC band path used by UI/DMX and rBPM feed.
 * - AGC is applied after this stage on `bands` only.
 */
// WAVE 8005 R2: AGC headroom — absMax observed 1.2069 across 432 samples,
// zero samples above 1.25, so 1.50 was over-provisioned.
const AGC_HEADROOM = 1.25;
const AGC_TARGET_SCALE = 0.64; // Confirmed R2: p95 kicks 1.4133 → 0.9608
const POST_FFT_LEGACY_EQ_GAIN = 2.25 * AGC_TARGET_SCALE; // 1.44
const POST_FFT_BAND_OUTPUT_CLAMP = AGC_HEADROOM;
// WAVE 8005 R2: Spectral flatness → whiteNoiseScore mapping.
// OFFSET at kicks p75 (0.1021) keeps 75% of kicks at zero.
// SCALE saturates at flatness 0.20 — above cymbals median (0.1965).
const FLATNESS_OFFSET = 0.10;
const FLATNESS_SCALE = 0.10;
const RADIX2_RAW_TELEMETRY_INTERVAL_FRAMES = 60;
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
// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 8001: TWIDDLE FACTOR LUT — Pre-computed sin/cos for all FFT stages
// ═══════════════════════════════════════════════════════════════════════════════
//
// For N=4096, all twiddle factors W_m^j = W_N^(j·N/m) are subsets of
// W_N^k for k ∈ [0, N/2). Two Float32Array(2048) = 16KB total, singleton.
// Eliminates 4096 trig calls/frame (2048 cos + 2048 sin).
let TW_COS = null;
let TW_SIN = null;
let TW_LUT_SIZE = 0;
function initTwiddleLUT(n) {
    if (TW_COS && TW_SIN && TW_LUT_SIZE === n)
        return;
    const half = n >> 1;
    TW_COS = new Float32Array(half);
    TW_SIN = new Float32Array(half);
    const step = -2 * Math.PI / n;
    for (let k = 0; k < half; k++) {
        TW_COS[k] = Math.cos(step * k);
        TW_SIN[k] = Math.sin(step * k);
    }
    TW_LUT_SIZE = n;
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
        const stride = n / size; // W_m^j = W_N^(j·stride)
        for (let groupStart = 0; groupStart < n; groupStart += size) {
            for (let j = 0; j < halfSize; j++) {
                // WAVE 8001: Twiddle factor from LUT (zero trig calls in hot path)
                const wr = TW_COS[j * stride];
                const wi = TW_SIN[j * stride];
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
 * WAVE 8001: Compute POWER spectrum from complex FFT output.
 *
 * Replaces computeMagnitudeSpectrum. Operates in power domain (re² + im²)
 * to eliminate 2049 sqrt calls/frame. sqrt is deferred to extractBandPower
 * (7 calls total) and spectral metrics that need it.
 *
 * The normalization factor is squared (nf²) since we're in power domain:
 *   magnitude = sqrt(re² + im²) * nf
 *   power     = (re² + im²) * nf²
 *
 * @param real - Real part of FFT
 * @param imag - Imaginary part of FFT
 * @param output - Pre-allocated output buffer (MUST be >= numBins + 1)
 * @param numBins - Number of bins (real.length / 2)
 */
function computePowerSpectrum(real, imag, output, numBins) {
    const nf = 1 / (real.length * BLACKMAN_HARRIS_COHERENT_GAIN);
    const nf2 = nf * nf;
    for (let i = 0; i <= numBins; i++) {
        output[i] = (real[i] * real[i] + imag[i] * imag[i]) * nf2;
    }
}
const LR4_FILTER_CACHE = new Map();
/**
 * Calculate LR4-equivalent magnitude response at a specific frequency.
 *
 * NOTE: This is a FREQUENCY-DOMAIN magnitude mask applied to the power
 * spectrum, NOT a time-domain biquad cascade. It reproduces the LR4
 * (cascaded Butterworth) magnitude-squared response — which is the
 * correct and sufficient property for energy/band-power extraction —
 * but does NOT provide LR4's defining time-domain phase-coherent
 * summation. Bands are consumed as |X(f)|^2 only; no reconstruction
 * of a time-domain signal from filtered bands is performed.
 *
 * LR4-equivalent magnitude provides:
 * - 24dB/octave slope (vs 12dB for Butterworth 2nd order)
 * - Flat response at crossover (-6dB each = 0dB summed)
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
    const cacheKey = `${fftSize}-${sampleRate}`;
    const cached = LR4_FILTER_CACHE.get(cacheKey);
    if (cached) {
        return cached.masks;
    }
    // WAVE 2098: Boot silence — LR4 filter generation logs removed
    const masks = new Map();
    const weightSums = new Map();
    for (const [key, config] of Object.entries(GOD_EAR_BAND_CONFIG)) {
        const mask = generateBandMask(fftSize, sampleRate, config.freqLow, config.freqHigh);
        masks.set(config.id, mask);
        let weightSum = 0;
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0.001) {
                weightSum += mask[i];
            }
        }
        weightSums.set(config.id, weightSum);
    }
    LR4_FILTER_CACHE.set(cacheKey, { masks, weightSums });
    return masks;
}
function getLR4FilterWeightSums(fftSize, sampleRate) {
    const cacheKey = `${fftSize}-${sampleRate}`;
    const cached = LR4_FILTER_CACHE.get(cacheKey);
    if (cached) {
        return cached.weightSums;
    }
    getLR4FilterMasks(fftSize, sampleRate);
    return LR4_FILTER_CACHE.get(cacheKey).weightSums;
}
function scaleBandEnergyForVisual(rawRms, weightSum) {
    if (rawRms <= 0)
        return 0;
    // rms_avg -> rms_integrated conversion to compensate spectral spread across bins.
    const integratedRms = rawRms * Math.sqrt(Math.max(1, weightSum));
    const scaled = integratedRms * POST_FFT_LEGACY_EQ_GAIN;
    return Math.min(POST_FFT_BAND_OUTPUT_CLAMP, scaled);
}
/**
 * WAVE 8001: Extract band energy from POWER spectrum using LR4 filtered weights.
 *
 * Operates entirely in power domain. The input `power` array contains P_k = |X_k|²
 * (already normalized). The weighted average power is computed, then sqrt is applied
 * ONCE at the end to return RMS — identical result to V2's extractBandEnergy
 * but with 2049 fewer sqrt calls per frame.
 *
 * Mathematical equivalence:
 *   V2: sqrt( Σ (sqrt(P_k))² · w_k / Σw ) = sqrt( Σ P_k · w_k / Σw )
 *   V3: sqrt( Σ P_k · w_k / Σw )                         ← same thing
 *
 * @param power - Power spectrum (P_k = |X_k|², normalized)
 * @param mask - LR4 filter mask for this band
 * @returns RMS energy for this band (0.0-1.0) — same scale as V2
 */
function extractBandPower(power, mask) {
    let energy = 0;
    let weightSum = 0;
    for (let bin = 0; bin < power.length && bin < mask.length; bin++) {
        const weight = mask[bin];
        if (weight > 0.001) {
            energy += power[bin] * weight;
            weightSum += weight;
        }
    }
    if (weightSum > 0) {
        energy /= weightSum;
    }
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
 * Formula: Σ(f[k] × P[k]) / Σ(P[k])    where P[k] = |X[k]|² (power domain)
 *
 * WAVE 8001: Adapted to power domain — uses power[bin] directly instead of
 * magnitudes[bin]². Mathematically identical result.
 *
 * Typical values:
 * - Kick: 80-200Hz
 * - Male voice: 300-500Hz
 * - Female voice: 400-700Hz
 * - Cymbals: 3000-6000Hz
 */
function calculateSpectralCentroid(power, sampleRate, fftSize) {
    const binResolution = sampleRate / fftSize;
    let weightedSum = 0;
    let powerSum = 0;
    for (let bin = 1; bin < power.length; bin++) {
        const freq = bin * binResolution;
        const p = power[bin];
        weightedSum += freq * p;
        powerSum += p;
    }
    if (powerSum === 0)
        return 0;
    return weightedSum / powerSum;
}
/**
 * Calculate Spectral Flatness (Wiener Entropy).
 *
 * Measures how "tonal" vs "noisy" the spectrum is.
 *
 * Formula: geometric_mean(P) / arithmetic_mean(P)    where P = |X|² (power domain)
 *
 * WAVE 8001: Adapted to power domain. The input is now P_k directly.
 * The relative threshold is squared: 0.01² of maxPower (was 0.01 of maxMag,
 * then squared internally — same result since maxPower = maxMag²).
 *
 * Note: flatness_P = flatness_mag² approximately. Downstream consumers that
 * threshold on flatness should recalibrate: 0.8 → 0.64. The raw value returned
 * by this function is now in the power-domain scale.
 *
 * Values:
 * - 0.0: Pure tone (all energy in one frequency)
 * - 1.0: White noise (energy uniformly distributed)
 * - 0.01-0.09: Tonal music (clear instruments) [was 0.1-0.3 in mag domain]
 * - 0.16-0.36: Percussive music [was 0.4-0.6]
 * - 0.49+: Noise/effects [was 0.7+]
 */
function calculateSpectralFlatness(power) {
    const n = power.length - 1; // Exclude DC
    if (n <= 0)
        return 0;
    // Find max power (excluding DC) for relative threshold
    let maxPower = 0;
    for (let bin = 1; bin < power.length; bin++) {
        if (power[bin] > maxPower)
            maxPower = power[bin];
    }
    if (maxPower === 0)
        return 0;
    // Relative threshold: (1%)² of max power — filters YouTube compression noise floor
    const threshold = maxPower * 0.0001; // 0.01²
    let logSum = 0;
    let arithmeticSum = 0;
    let validBins = 0;
    for (let bin = 1; bin < power.length; bin++) {
        const p = power[bin];
        if (p > threshold) {
            logSum += Math.log(p);
            arithmeticSum += p;
            validBins++;
        }
    }
    if (validBins === 0 || arithmeticSum === 0)
        return 0;
    const geometricMean = Math.exp(logSum / validBins);
    const arithmeticMean = arithmeticSum / validBins;
    return Math.min(1.0, geometricMean / arithmeticMean);
}
/**
 * Calculate Spectral Rolloff.
 *
 * Frequency below which 85% of the energy is contained.
 *
 * WAVE 8001: Adapted to power domain. Energy is now Σ P_k directly
 * (was Σ mag_k² which is the same value).
 *
 * Indicates if music is:
 * - Low rolloff: Hip-hop, Dub, Bass music
 * - High rolloff: EDM, Pop, Hi-fi
 */
function calculateSpectralRolloff(power, sampleRate, fftSize, percentile = 0.85) {
    const binResolution = sampleRate / fftSize;
    let totalEnergy = 0;
    for (let bin = 1; bin < power.length; bin++) {
        totalEnergy += power[bin];
    }
    if (totalEnergy === 0)
        return 0;
    const threshold = totalEnergy * percentile;
    let cumulativeEnergy = 0;
    for (let bin = 1; bin < power.length; bin++) {
        cumulativeEnergy += power[bin];
        if (cumulativeEnergy >= threshold) {
            return bin * binResolution;
        }
    }
    return sampleRate / 2;
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
 * WAVE 8001: Adapted to power domain. totalEnergy = Σ P_k directly.
 * RMS threshold comparison: instead of mag[i] > sqrt(ΣP/n), we use
 * P[i] > ΣP/n (mean power) — algebraically equivalent, avoids per-bin sqrt.
 *
 * Values:
 * - 0.0-0.3: Very noisy (mp3 128kbps, bad master)
 * - 0.4-0.6: Normal quality (typical streaming)
 * - 0.7-0.9: High fidelity (CD quality, good master)
 * - 0.9+: Studio quality
 */
function calculateClarity(power, flatness, crestFactor, numBins) {
    const tonality = 1.0 - flatness;
    const normalizedCrest = Math.min(1.0, crestFactor / 6.0);
    let totalEnergy = 0;
    for (let i = 0; i < numBins; i++) {
        totalEnergy += power[i];
    }
    if (totalEnergy === 0)
        return 0;
    // Mean power = ΣP/n. In V2 this was (rmsThreshold)² = totalEnergy/n.
    // Comparing P[i] > meanPower is equivalent to mag[i] > rmsThreshold.
    const meanPower = totalEnergy / numBins;
    let peakEnergy = 0;
    for (let i = 0; i < numBins; i++) {
        if (power[i] > meanPower) {
            peakEnergy += power[i];
        }
    }
    const concentration = peakEnergy / totalEnergy;
    const clarity = (tonality * 0.4 +
        normalizedCrest * 0.3 +
        concentration * 0.3);
    return Math.min(1.0, clarity);
}
/**
 * Calculate Crest Factor (Peak/RMS ratio).
 *
 * WAVE 8001: Adapted to power domain. peak = sqrt(max(P)), rms = sqrt(mean(P)).
 * crest = peak / rms — same result as V2 with 1 sqrt for peak + 1 sqrt for rms.
 *
 * Indicates dynamic range:
 * - Low (~1-2): Heavily compressed (loud war)
 * - Medium (~3-6): Normal music
 * - High (~6+): Very dynamic (classical, jazz)
 */
function calculateCrestFactor(power) {
    let maxPower = 0;
    let sumPower = 0;
    for (let i = 0; i < power.length; i++) {
        if (power[i] > maxPower)
            maxPower = power[i];
        sumPower += power[i];
    }
    if (sumPower === 0)
        return 0;
    const peak = Math.sqrt(maxPower);
    const rms = Math.sqrt(sumPower / power.length);
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
// SECTION 8.5: WAVE 8002 — SPECTRAL FLUX V3 + SATURATION INDEX
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WAVE 8002: SaturationMeter — detects brickwall limiter compression.
 *
 * Combines three orthogonal indicators:
 *   1. Crest factor collapse (peak/RMS in power domain)
 *   2. Loudness dwell (fast + slow EMAs pegged to peak)
 *   3. Spectral flatness elevation
 *
 * Output: SI_smooth ∈ [0, 1] — 0 = dynamic music, 1 = fully brickwalled.
 *
 * ~12 ops/frame. State: 4 floats.
 */
class SaturationMeter {
    constructor() {
        this.lFast = 0;
        this.lSlow = 0;
        this.lPeak = 1e-6;
        this.siSmooth = 0;
    }
    update(totalPower, crestDb, flatnessP) {
        this.lFast += 0.4 * (totalPower - this.lFast);
        this.lSlow += 0.02 * (totalPower - this.lSlow);
        this.lPeak = totalPower > this.lPeak ? totalPower : this.lPeak * 0.999;
        const siCrest = Math.max(0, Math.min(1, (14 - crestDb) / 8));
        const siDwell = Math.max(0, Math.min(1, this.lFast / (0.75 * this.lPeak + 1e-12)))
            * Math.max(0, Math.min(1, this.lSlow / (0.60 * this.lPeak + 1e-12)));
        const siFlat = Math.max(0.3, Math.max(0, Math.min(1, (flatnessP - 0.15) / 0.35)));
        const si = Math.pow(siCrest, 0.4) * Math.pow(siDwell, 0.4) * Math.pow(siFlat, 0.2);
        const k = si > this.siSmooth ? 0.30 : 0.04;
        this.siSmooth += k * (si - this.siSmooth);
        return this.siSmooth;
    }
    reset() {
        this.lFast = 0;
        this.lSlow = 0;
        this.lPeak = 1e-6;
        this.siSmooth = 0;
    }
}
/**
 * WAVE 8002: Compute Spectral Flux V3 — half-wave rectified, whitened, normalized.
 *
 * F(t)      = Σ_k max(0, P_t[k] − P_{t−1}[k]) / max(ε, R_t[k])
 * R_t[k]    = max(P_t[k], λ·R_{t−1}[k])     λ = 0.995 (peak-hold with decay)
 * F_norm(t) = F(t) / (ε + Σ_k P_t[k])
 *
 * The whitening reference R_t is stored in `fluxWhitening` and updated in-place.
 * The previous frame's power is stored in `prevPower`.
 *
 * @param power       Current frame power spectrum (P_t)
 * @param prevPower   Previous frame power spectrum (P_{t-1}) — mutated to current
 * @param fluxWhitening Peak-hold whitening reference (R_t) — mutated in-place
 * @param numBins     Number of bins
 * @returns Normalized spectral flux ∈ [0, ~1] (adimensional by whitening)
 */
function computeSpectralFlux(power, prevPower, fluxWhitening, numBins) {
    let totalFlux = 0;
    let totalPower = 0;
    for (let k = 1; k <= numBins; k++) {
        const p = power[k];
        const r = fluxWhitening[k] * 0.995;
        fluxWhitening[k] = p > r ? p : r;
        const d = p - prevPower[k];
        if (d > 0)
            totalFlux += d / (fluxWhitening[k] + 1e-12);
        totalPower += p;
        prevPower[k] = p;
    }
    return totalPower > 1e-10 ? totalFlux / numBins : 0;
}
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: AGC TRUST ZONES (Per-Band Independent Gain Control)
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 8004: STROBE ENGINE — Maps acoustic chaos to photonic strobe
// Safety: hard-capped at 12Hz for photosensitive epilepsy protection.
// ═══════════════════════════════════════════════════════════════════════════════
class StrobeEngine {
    constructor() {
        this.driveSmooth = 0;
        this.rateSmooth = 0;
        this.cooldown = 0;
        this._lastDriveRaw = 0;
        this.holdTimer = 0;
    }
    /**
     * Process transient density + white noise score into a strobe state.
     * @param transientDensity  [0, 1] — onset rate proxy from photon block
     * @param whiteNoiseScore   [0, 1] — broadband noise indicator
     * @param spectralFlux      [0, ~1] — V3 flux for drive modulation
     * @param deltaMs           Frame delta in milliseconds
     * @param tonalRatio        kick/highs ratio — high = tonal/bass dominated
     * @returns Strobe state for GodEarPhoton
     */
    process(transientDensity, whiteNoiseScore, spectralFlux, deltaMs, tonalRatio) {
        // Drive = combined chaos signal from transients + noise + flux.
        // Flux is floored+expanded: raw normalized flux sits at 0.80-1.00 for all
        // real material, so without the floor it degenerates into a constant offset.
        const fluxNorm = Math.max(0, Math.min(1, (spectralFlux - StrobeEngine.FLUX_FLOOR) / StrobeEngine.FLUX_RANGE));
        // Tonal gate: scale down transientDensity when signal is overwhelmingly
        // tonal (sustained bass/synth). White noise and flux pass through untouched
        // so snares/hi-hats riding over a bassline still trigger the strobe.
        // tonalRatio ≤ KNEE → gate=1.0, ≥ RATIO → gate=0.0, linear between.
        const tonalGate = tonalRatio <= StrobeEngine.TONAL_GATE_KNEE
            ? 1.0
            : tonalRatio >= StrobeEngine.TONAL_GATE_RATIO
                ? 0.0
                : 1.0 - (tonalRatio - StrobeEngine.TONAL_GATE_KNEE) /
                    (StrobeEngine.TONAL_GATE_RATIO - StrobeEngine.TONAL_GATE_KNEE);
        const gatedTransientDensity = transientDensity * tonalGate;
        const driveRaw = gatedTransientDensity * StrobeEngine.WEIGHT_TRANSIENT +
            whiteNoiseScore * StrobeEngine.WEIGHT_NOISE +
            fluxNorm * StrobeEngine.WEIGHT_FLUX;
        this._lastDriveRaw = driveRaw;
        // R4: Faster attack (0.60 vs 0.35) — transient bursts of 2 frames now
        // reach threshold before the event ends. Release unchanged (0.06).
        const k = driveRaw > this.driveSmooth ? 0.60 : 0.06;
        this.driveSmooth += k * (driveRaw - this.driveSmooth);
        // Cooldown after active burst — prevents flicker on edge cases
        if (this.cooldown > 0) {
            this.cooldown -= deltaMs;
        }
        // Activate when drive exceeds threshold and cooldown expired
        let active = this.driveSmooth > StrobeEngine.ACTIVATION_THRESHOLD && this.cooldown <= 0;
        // HOLD LATCH: Keep strobe active for HOLD_DURATION_MS after activation
        // to prevent choppy flicker on brief single-frame input drops.
        // R5: On first activation (holdTimer was 0), snap rateSmooth to MIN_RATE_HZ
        // to eliminate the metronome ramp-up from 0Hz that took ~15 frames (340ms).
        if (active) {
            if (this.holdTimer <= 0) {
                this.rateSmooth = StrobeEngine.MIN_RATE_HZ;
            }
            this.holdTimer = StrobeEngine.HOLD_DURATION_MS;
        }
        if (this.holdTimer > 0) {
            this.holdTimer -= deltaMs;
            active = true;
        }
        // Rate: map drive [ACTIVATION_THRESHOLD, 1.0] → [MIN_RATE, MAX_RATE] Hz
        let targetRate = 0;
        if (active) {
            const driveNorm = Math.max(0, Math.min(1, (this.driveSmooth - StrobeEngine.ACTIVATION_THRESHOLD) /
                (1 - StrobeEngine.ACTIVATION_THRESHOLD)));
            targetRate = StrobeEngine.MIN_RATE_HZ + driveNorm * (StrobeEngine.MAX_RATE_HZ - StrobeEngine.MIN_RATE_HZ);
        }
        // Smooth rate changes
        this.rateSmooth += 0.15 * (targetRate - this.rateSmooth);
        // Duty: inverse to rate — faster strobes have shorter duty
        // High drive → narrow pulse (10-15%), low drive → wider (20-30%)
        const duty = active
            ? Math.max(0.08, Math.min(0.30, 0.30 - this.driveSmooth * 0.20))
            : 0;
        // If drive drops below deactivation threshold, enter cooldown
        if (!active && this.driveSmooth < StrobeEngine.DEACTIVATION_THRESH && this.cooldown <= 0) {
            this.cooldown = 150; // 150ms cooldown before reactivation
        }
        return {
            active,
            rateHz: active ? Math.min(StrobeEngine.MAX_RATE_HZ, this.rateSmooth) : 0,
            duty,
            drive: this.driveSmooth,
        };
    }
    // WAVE 8004: Telemetry getters
    get drive() { return this.driveSmooth; }
    get driveRaw() { return this._lastDriveRaw; }
    get rate() { return this.rateSmooth; }
    get cooldownMs() { return this.cooldown; }
    get activationThreshold() { return StrobeEngine.ACTIVATION_THRESHOLD; }
    get maxRateHz() { return StrobeEngine.MAX_RATE_HZ; }
    reset() {
        this.driveSmooth = 0;
        this.rateSmooth = 0;
        this.cooldown = 0;
        this._lastDriveRaw = 0;
        this.holdTimer = 0;
    }
}
StrobeEngine.MAX_RATE_HZ = 12; // Photosensitive safety cap
StrobeEngine.MIN_RATE_HZ = 2; // Below this, not a strobe
// R4: Recalibrated for real-world activation. R3 weights (0.50/0.15/0.35)
// made the strobe unreachable — driveSmooth peaked at 0.35 vs threshold 0.55.
// Noise weight raised so white noise alone can trigger. Flux reduced to
// supporting role. Transient slightly lowered to keep rolls primary but not
// dominant. Equal-weight transient+noise = both can independently fire.
StrobeEngine.WEIGHT_TRANSIENT = 0.40;
StrobeEngine.WEIGHT_NOISE = 0.40;
StrobeEngine.WEIGHT_FLUX = 0.20;
// computeSpectralFlux returns totalFlux / numBins — each per-bin term is ≤1.0
// and only a fraction of bins change per frame. Realistic range: 0.01-0.10.
// Previous FLUX_FLOOR=0.95 was calibrated for a different normalization and
// made fluxNorm always 0, killing 35% of the drive weight.
StrobeEngine.FLUX_FLOOR = 0.02;
StrobeEngine.FLUX_RANGE = 0.15;
// R5: Threshold raised from 0.32 to 0.38 — R4 threshold allowed normal
// percussion (snare hits without white noise) to trigger the strobe.
// Telemetry showed driveSmooth carrying over from previous hits + hold
// timer keeping it alive, causing false re-activation on weak transients.
//   Kick only:     driveRaw ≈ 0.10, driveSmooth ≈ 0.08 (well below)
//   White noise:   driveRaw ≈ 0.32-0.35 (below — needs sustained noise)
//   Roll (3+ onsets): driveRaw ≈ 0.37-0.47 (at threshold, fires on genuine rolls)
//   Roll + noise:  driveRaw ≈ 0.39-0.71 (well above, fires immediately)
//   Melodic:       driveRaw ≈ 0.04 (well below)
StrobeEngine.ACTIVATION_THRESHOLD = 0.38;
StrobeEngine.DEACTIVATION_THRESH = 0.12;
// Tonal gate: when tonalRatio is high (bass/synth dominates highs),
// sustained notes fool the onset detector into inflating transientDensity.
// Gate scales down the transientDensity contribution to prevent false strobe.
StrobeEngine.TONAL_GATE_KNEE = 3.0; // Below: no penalty
StrobeEngine.TONAL_GATE_RATIO = 5.0; // Above: full penalty
// R5: Reduced from 350 to 200ms — 350ms hold extended strobe into periods
// where audio content had changed (bass-heavy sections), causing front channel
// envelopes to decay with no new transients. When strobe finally released,
// all channels were dark = visible "dead zone" that looked like hardware desync.
StrobeEngine.HOLD_DURATION_MS = 200;
// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 8004: CHROMA COUPLER — Maps harmonic content to hue + colorSnap
// Consumes the 12-bin chromagram (pitch classes C→B, normalized 0-1).
// Hue is derived from the circle of fifths mapping: each pitch class
// gets a hue position, and the dominant class determines the color.
// ═══════════════════════════════════════════════════════════════════════════════
class ChromaCoupler {
    constructor() {
        this.currentHue = 0;
        this.prevHue = 0;
        this.hueSmooth = 0;
        this.chromaFluxSmooth = 0;
        this.snapThreshold = 0.0100;
        this.snapCooldown = 0;
    }
    /**
     * Process the 12-bin chromagram to extract hue, colorSnap, and chromaFlux.
     * @param chroma  Float32Array(12) — normalized [0,1] per pitch class
     * @param deltaMs Frame delta in milliseconds
     */
    process(chroma, deltaMs) {
        // Find dominant pitch class (highest energy)
        let maxIdx = 0;
        let maxVal = 0;
        for (let i = 0; i < 12; i++) {
            if (chroma[i] > maxVal) {
                maxVal = chroma[i];
                maxIdx = i;
            }
        }
        // Weighted average hue using circle of fifths mapping
        // This gives a continuous hue even when multiple classes are active
        let weightedSin = 0;
        let weightedCos = 0;
        let totalWeight = 0;
        for (let i = 0; i < 12; i++) {
            const w = chroma[i] * chroma[i]; // square for emphasis on dominant
            if (w > 1e-6) {
                const hueAngle = ChromaCoupler.FIFTHS_HUE[i] * Math.PI * 2;
                weightedSin += w * Math.sin(hueAngle);
                weightedCos += w * Math.cos(hueAngle);
                totalWeight += w;
            }
        }
        this.prevHue = this.hueSmooth;
        if (totalWeight > 1e-6) {
            const angle = Math.atan2(weightedSin, weightedCos);
            const rawHue = (angle / (Math.PI * 2) + 1) % 1; // [0, 1)
            // Smooth hue transition (short circular distance)
            let diff = rawHue - this.hueSmooth;
            if (diff > 0.5)
                diff -= 1;
            if (diff < -0.5)
                diff += 1;
            this.hueSmooth += 0.08 * diff;
            if (this.hueSmooth < 0)
                this.hueSmooth += 1;
            if (this.hueSmooth >= 1)
                this.hueSmooth -= 1;
            this.currentHue = this.hueSmooth;
        }
        // Chroma flux: rate of hue change
        let hueDelta = Math.abs(this.hueSmooth - this.prevHue);
        if (hueDelta > 0.5)
            hueDelta = 1 - hueDelta; // circular distance
        this.chromaFluxSmooth += 0.12 * (hueDelta - this.chromaFluxSmooth);
        // Color snap: detect abrupt harmonic shifts
        if (this.snapCooldown > 0) {
            this.snapCooldown -= deltaMs;
        }
    }
    /**
     * Returns true if a color snap was detected this frame.
     * Must be called after process().
     */
    isSnap(scaledKick, scaledHighs) {
        if (this.chromaFluxSmooth > this.snapThreshold && this.snapCooldown <= 0) {
            // WAVE 8005: Tonal gate — reject snaps from non-tonal sources (cymbals, hi-hats)
            if (scaledKick !== undefined && scaledHighs !== undefined) {
                const tonalRatio = scaledKick / (scaledHighs + 1e-6);
                if (tonalRatio < ChromaCoupler.TONAL_GATE_RATIO)
                    return false;
            }
            this.snapCooldown = 500; // 500ms between snaps
            return true;
        }
        return false;
    }
    get hue() { return this.currentHue; }
    get chromaFlux() { return this.chromaFluxSmooth; }
    get snapCooldownMs() { return this.snapCooldown; }
    get snapThresholdValue() { return this.snapThreshold; }
    reset() {
        this.currentHue = 0;
        this.prevHue = 0;
        this.hueSmooth = 0;
        this.chromaFluxSmooth = 0;
        this.snapCooldown = 0;
    }
}
// Circle of fifths hue mapping [0, 1] — C=0, G=0.083, D=0.167, A=0.25, ...
// Each fifth = 1/12 of the hue wheel (30°), arranged by acoustic proximity
ChromaCoupler.FIFTHS_HUE = [
    0.00, // C  (0)
    0.583, // C# (1) — tritone area
    0.167, // D  (2)
    0.667, // D# (3)
    0.333, // E  (4)
    0.083, // F  (5)
    0.667, // F# (6) — tritone
    0.250, // G  (7)
    0.750, // G# (8)
    0.417, // A  (9)
    0.833, // A# (10)
    0.500, // B  (11)
];
// WAVE 8005 R2: 0.0100 + tonal ratio 3.0 lifts melodic detection 54%→84%
// while cutting snare false positives 23%→13%. Cymbals/hi-hats stay at 0%.
ChromaCoupler.TONAL_GATE_RATIO = 3.0;
// ═══════════════════════════════════════════════════════════════════════════════
// AGC Trust Zone Controller
// 
// Each band has independent gain control to prevent the "yoyo effect"
// where a loud bass causes everything to duck, or quiet highs disappear.
// ═══════════════════════════════════════════════════════════════════════════════
class AGCTrustZone {
    constructor() {
        this.gains = {};
        // Zero-allocation: circular buffer + rolling sum instead of push/shift/reduce
        this.rmsHistory = {};
        this.rmsHistoryIndex = {};
        this.rmsHistorySum = {};
        this.rmsHistoryCount = {};
        this.historyLength = 20; // ~1 second @ 20fps
        this.isActive = true;
        // WAVE 8003: AGC Freeze — when SI > 0.6, prevent gain reduction (brickwall anti-compensate)
        this.freezeReduction = false;
        // Initialize gains to 1.0 for all bands
        for (const config of Object.values(GOD_EAR_BAND_CONFIG)) {
            this.gains[config.id] = 1.0;
            this.rmsHistory[config.id] = new Float32Array(this.historyLength);
            this.rmsHistoryIndex[config.id] = 0;
            this.rmsHistorySum[config.id] = 0;
            this.rmsHistoryCount[config.id] = 0;
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
        // Update RMS history — circular buffer with rolling sum (zero-allocation)
        const histBuf = this.rmsHistory[bandId];
        const histIdx = this.rmsHistoryIndex[bandId];
        const evicted = histBuf[histIdx];
        histBuf[histIdx] = rawValue;
        this.rmsHistoryIndex[bandId] = (histIdx + 1) % this.historyLength;
        this.rmsHistorySum[bandId] += rawValue - evicted;
        const count = this.rmsHistoryCount[bandId];
        if (count < this.historyLength) {
            this.rmsHistoryCount[bandId] = count + 1;
        }
        // Calculate average RMS over history
        const avgRMS = this.rmsHistorySum[bandId] / this.rmsHistoryCount[bandId];
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
        const newGain = currentGain + gainDiff * alpha;
        // WAVE 8003: AGC Freeze — when brickwall detected, prevent gain reduction.
        // gain(t) = SI > 0.6 ? max(gain_agc(t), gain(t-1)) : gain_agc(t)
        if (this.freezeReduction && newGain < currentGain) {
            this.gains[bandId] = currentGain; // hold previous gain
        }
        else {
            this.gains[bandId] = newGain;
        }
        // WAVE 3424: DMX protection clamp after post-FFT scaling + AGC gain.
        return Math.min(POST_FFT_BAND_OUTPUT_CLAMP, rawValue * this.gains[bandId]);
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
    // WAVE 8003: AGC Freeze — prevent gain reduction under brickwall saturation
    setFreezeReduction(freeze) {
        this.freezeReduction = freeze;
    }
    // WAVE 8004: Telemetry getter
    get isFreezeReduction() { return this.freezeReduction; }
    /**
     * Reset AGC state
     */
    reset() {
        for (const config of Object.values(GOD_EAR_BAND_CONFIG)) {
            this.gains[config.id] = 1.0;
            this.rmsHistory[config.id].fill(0);
            this.rmsHistoryIndex[config.id] = 0;
            this.rmsHistorySum[config.id] = 0;
            this.rmsHistoryCount[config.id] = 0;
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
        /** Monotonic timestamps (ms) of onsets inside the window — zero-alloc ring */
        this.onsetTimes = new Float64Array(SlopeBasedOnsetDetector.DENSITY_CAPACITY);
        this.onsetCount = 0;
        this.elapsedMs = 0;
        this.lastOnsetTime = { kick: 0, snare: 0, hihat: 0 };
        for (const band of ['kick', 'snare', 'hihat']) {
            this.history[band] = new Float32Array(this.historyLength);
            this.historyIndex[band] = 0;
        }
    }
    /**
     * Advance the internal clock, register an onset if one fired this frame,
     * evict onsets older than the window, and return the resulting density.
     *
     * Mapping: 0 hits → 0.0 | 1 hit → 0.15 | 12+ hits → 1.0 (linear in between).
     *
     * @param onsetDetected true when any band reported an onset this frame
     * @param deltaMs       frame delta in milliseconds
     * @returns transient density ∈ [0, 1]
     */
    updateTemporalDensity(onsetDetected, deltaMs) {
        const CAP = SlopeBasedOnsetDetector.DENSITY_CAPACITY;
        this.elapsedMs += deltaMs;
        if (onsetDetected) {
            if (this.onsetCount < CAP) {
                this.onsetTimes[this.onsetCount++] = this.elapsedMs;
            }
            else {
                // Ring is full (pathological onset storm) — drop the oldest entry.
                for (let i = 1; i < CAP; i++)
                    this.onsetTimes[i - 1] = this.onsetTimes[i];
                this.onsetTimes[CAP - 1] = this.elapsedMs;
            }
        }
        // Evict onsets that fell out of the sliding window (in-place compaction).
        const cutoff = this.elapsedMs - SlopeBasedOnsetDetector.DENSITY_WINDOW_MS;
        let kept = 0;
        for (let i = 0; i < this.onsetCount; i++) {
            if (this.onsetTimes[i] >= cutoff) {
                this.onsetTimes[kept++] = this.onsetTimes[i];
            }
        }
        this.onsetCount = kept;
        if (kept === 0)
            return 0;
        const base = SlopeBasedOnsetDetector.DENSITY_BASE;
        const step = (1 - base) / (SlopeBasedOnsetDetector.DENSITY_SATURATION_HITS - 1);
        return Math.min(1, base + (kept - 1) * step);
    }
    /** Number of onsets currently inside the sliding window (telemetry) */
    get onsetsInWindow() { return this.onsetCount; }
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
        const slopeThreshold = avgEnergy * 0.3;
        const isOnset = shortTermSlope > slopeThreshold && longTermSlope > slopeThreshold * 0.5;
        // Refractory period: suppress re-triggering within REFRACTORY_MS for the same band.
        // Without this, continuous energy fluctuations fire on consecutive frames,
        // saturating the density window and making td=1.0 permanently.
        if (isOnset) {
            if (this.elapsedMs - this.lastOnsetTime[band] < SlopeBasedOnsetDetector.REFRACTORY_MS) {
                return false;
            }
            this.lastOnsetTime[band] = this.elapsedMs;
        }
        return isOnset;
    }
    /**
     * Reset detector state
     */
    reset() {
        for (const band of Object.keys(this.history)) {
            this.history[band].fill(0);
            this.historyIndex[band] = 0;
        }
        this.onsetCount = 0;
        this.elapsedMs = 0;
    }
}
// ═══ WAVE 8005 R2: TEMPORAL ONSET DENSITY ═══
// Sliding 500ms window counting real onset events. Replaces the previous
// `strength * 2` formulation, which measured transient ENERGY (biased toward
// sub-bass) rather than event RATE, and therefore could never distinguish a
// snare roll from an isolated kick.
SlopeBasedOnsetDetector.DENSITY_WINDOW_MS = 500;
/** Onsets within the window that map to full density (1.0) */
SlopeBasedOnsetDetector.DENSITY_SATURATION_HITS = 12;
/** Density produced by a single isolated onset */
SlopeBasedOnsetDetector.DENSITY_BASE = 0.15;
/** Ring capacity — 500ms @ 60fps can hold at most 30 onsets */
SlopeBasedOnsetDetector.DENSITY_CAPACITY = 32;
// Per-band refractory period (ms) — prevents multiple fires for a single onset event
SlopeBasedOnsetDetector.REFRACTORY_MS = 80;
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
 * - LR4-equivalent magnitude-response band masks (frequency-domain)
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
function computeChromaFromSpectrum(power, numBins, sampleRate, fftSize, output // 12 elements, pre-allocated
) {
    output.fill(0);
    const binResolution = sampleRate / fftSize;
    for (let bin = 1; bin <= numBins; bin++) {
        const freq = bin * binResolution;
        if (freq < 27.5 || freq > 4186.0)
            continue; // musical range only
        const midiNote = 12 * Math.log2(freq / 440) + 69;
        const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12; // guard negative modulo
        output[pitchClass] += power[bin]; // WAVE 8001: already power domain
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
// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 8008: RHYTHMIC PERCUSSION TRACKER
// Sub-band isolation for snare (body + crack coincidence) and hi-hat detection.
// Adaptive thresholds + absence counters + rhythmic_void for Selene IA.
// ═══════════════════════════════════════════════════════════════════════════════
class RhythmicPercussionTracker {
    constructor(sampleRate, fftSize) {
        // Adaptive threshold EMAs — track the moving average of each sub-band
        this._snareBodyEMA = 0;
        this._snareCrackEMA = 0;
        this._hhEMA = 0;
        this._emaAlpha = 0.02; // ~1s time constant @ ~20fps
        // Absence tracking — monotonic clock + last-hit timestamps
        this._elapsedMs = 0;
        this._lastSnareHitMs = 0;
        this._lastHHHitMs = 0;
        // Snare/HH energy — attack-release envelope (peak follower)
        this._snareEnergyEMA = 0;
        this._hhEnergyEMA = 0;
        // WAVE 7749.7: Raw (pre-EMA) snare energy — for transient delta extraction
        this._prevSnareEnergyRaw = 0;
        // WAVE 7749.7b: Per-band raw tracking — crack and body deltas independently
        this._prevSnareCrackRaw = 0;
        this._prevSnareBodyRaw = 0;
        // ⚒️ WAVE 7749.80: Raw (pre-EMA) hi-hat band tracking — for treble-ghost delta
        this._prevHhRaw = 0;
        // ⚒️ WAVE 7749.76: Crack-band spectral flux — localized to 2-5kHz bins.
        // Same algorithm as computeSpectralFlux but only over crack bins, so hi-hats
        // at 10kHz and breakdown section changes don't inflate the flux.
        this._prevCrackPower = new Float32Array(0);
        this._crackFluxWhitening = new Float32Array(0);
        this._crackBinCount = 0;
        this._lastCrackFlux = 0;
        // Diagnostic counter for raw value logging
        this._diagCounter = 0;
        // Cooldown to prevent double-triggering on the same hit
        this._snareCooldownMs = 0;
        this._hhCooldownMs = 0;
        const binRes = sampleRate / fftSize;
        this.snareBodyLoBin = Math.floor(150 / binRes);
        this.snareBodyHiBin = Math.ceil(250 / binRes);
        this.snareCrackLoBin = Math.floor(2000 / binRes);
        this.snareCrackHiBin = Math.ceil(5000 / binRes);
        this.hhLoBin = Math.floor(5000 / binRes);
        this.hhHiBin = Math.ceil(15000 / binRes);
        // ⚒️ WAVE 7749.76: Allocate crack-band flux state once (zero-alloc per frame)
        this._crackBinCount = this.snareCrackHiBin - this.snareCrackLoBin + 1;
        this._prevCrackPower = new Float32Array(this._crackBinCount);
        this._crackFluxWhitening = new Float32Array(this._crackBinCount);
    }
    /**
     * Extract sub-band RMS energy from power spectrum (sqrt of mean power).
     * Zero-allocation: reads directly from the pre-allocated powerSpectrum.
     */
    extractSubBand(power, loBin, hiBin) {
        let sum = 0;
        let count = 0;
        const upper = Math.min(hiBin, power.length - 1);
        for (let bin = loBin; bin <= upper; bin++) {
            sum += power[bin];
            count++;
        }
        if (count === 0)
            return 0;
        // WAVE 8008 fix: integrated RMS + legacy gain + percussion boost.
        // sqrt(total_power) captures the full energy across all bins in the sub-band.
        // RHYTHMIC_GAIN compensates for the narrow bin range vs full-band extraction.
        const integratedRms = Math.sqrt(sum);
        return Math.min(POST_FFT_BAND_OUTPUT_CLAMP, integratedRms * POST_FFT_LEGACY_EQ_GAIN * RhythmicPercussionTracker.RHYTHMIC_GAIN);
    }
    /**
     * WAVE 7749.7: Extract UNCLAMPED sub-band energy for transient delta calculation.
     * The clamped version (extractSubBand) saturates at 1.25 in dense techno, making
     * the delta always 0. This version returns the raw integratedRms * gain WITHOUT
     * clamping, so frame-to-frame transients are preserved even at high energy.
     */
    extractSubBandRaw(power, loBin, hiBin) {
        let sum = 0;
        let count = 0;
        const upper = Math.min(hiBin, power.length - 1);
        for (let bin = loBin; bin <= upper; bin++) {
            sum += power[bin];
            count++;
        }
        if (count === 0)
            return 0;
        const integratedRms = Math.sqrt(sum);
        // No clamp — preserve full dynamic range for delta calculation
        return integratedRms * POST_FFT_LEGACY_EQ_GAIN * RhythmicPercussionTracker.RHYTHMIC_GAIN;
    }
    /**
     * Process one frame and produce rhythmic percussion telemetry.
     *
     * @param power    Pre-allocated power spectrum (Float32Array, numBins+1)
     * @param deltaMs  Frame delta in milliseconds
     * @returns GodEarRhythmicPercussion payload
     */
    process(power, deltaMs) {
        this._elapsedMs += deltaMs;
        this._snareCooldownMs -= deltaMs;
        this._hhCooldownMs -= deltaMs;
        // ── 1. Extract raw sub-band energies ──
        // WAVE 7749.7: Use UNCLAMPED extraction for body/crack — the clamped version
        // saturates at 1.25 in dense techno, making the transient delta always 0.
        const snareBody = this.extractSubBandRaw(power, this.snareBodyLoBin, this.snareBodyHiBin);
        const snareCrack = this.extractSubBandRaw(power, this.snareCrackLoBin, this.snareCrackHiBin);
        const hhRaw = this.extractSubBand(power, this.hhLoBin, this.hhHiBin);
        // ⚒️ WAVE 7749.80: UNCLAMPED hh for treble-ghost delta — same rationale as
        // body/crack: the clamped version saturates at high HF energy, zeroing the
        // delta. We need the raw transient to detect synthetic snare reverb tails.
        const hhRawUnclamped = this.extractSubBandRaw(power, this.hhLoBin, this.hhHiBin);
        // ⚒️ WAVE 7749.76: Crack-band spectral flux — half-wave rectified, whitened,
        // normalized. Same algorithm as the global computeSpectralFlux but restricted
        // to the 2-5kHz bins. This isolates the snare transient from hi-hats (10kHz+)
        // and breakdown section changes (broadband spectral shifts). A snare fires
        // broadband noise INTO 2-5kHz → crackFlux spikes. A hi-hat at 10kHz does NOT
        // move the 2-5kHz bins → crackFlux stays low. Zero per-frame allocation.
        {
            let totalFlux = 0;
            const upper = Math.min(this.snareCrackHiBin, power.length - 1);
            for (let bin = this.snareCrackLoBin, i = 0; bin <= upper; bin++, i++) {
                const p = power[bin];
                const r = this._crackFluxWhitening[i] * 0.995;
                this._crackFluxWhitening[i] = p > r ? p : r;
                const d = p - this._prevCrackPower[i];
                if (d > 0)
                    totalFlux += d / (this._crackFluxWhitening[i] + 1e-12);
                this._prevCrackPower[i] = p;
            }
            this._lastCrackFlux = totalFlux > 1e-10
                ? totalFlux / this._crackBinCount
                : 0;
        }
        // ── 2. Update adaptive threshold EMAs ──
        this._snareBodyEMA += this._emaAlpha * (snareBody - this._snareBodyEMA);
        this._snareCrackEMA += this._emaAlpha * (snareCrack - this._snareCrackEMA);
        this._hhEMA += this._emaAlpha * (hhRaw - this._hhEMA);
        // ⚒️ WAVE 7749.77: Body Factor — continuous algebraic gate [0.1, 2.0].
        // bodyRatio = snareBody / snareBodyEMA measures how much the body band
        // (150-250Hz) exceeds its moving average. A real snare vibrates the drum
        // membrane → body >> EMA → ratio > 1.5 → bodyFactor boosts the drive.
        // A clap/rimshot has crack energy but no body resonance → body ≈ EMA →
        // ratio ≈ 1.0 → bodyFactor = 0.5 (penalty). The -0.5 offset centers the
        // neutral point at ratio=1.0 (body = EMA) → factor=0.5. Clamped to [0.1, 2.0]
        // to prevent division-by-zero collapse and MACD overflow.
        const bodyRatio = snareBody / (this._snareBodyEMA + 1e-6);
        const bodyFactor = Math.max(0.1, Math.min(2.0, bodyRatio - 0.5));
        // ── 3. Snare detection: requires BOTH body AND crack above threshold ──
        const snareBodyThresh = Math.max(this._snareBodyEMA * RhythmicPercussionTracker.SNARE_BODY_MULT, RhythmicPercussionTracker.SNARE_FLOOR);
        const snareCrackThresh = Math.max(this._snareCrackEMA * RhythmicPercussionTracker.SNARE_CRACK_MULT, RhythmicPercussionTracker.SNARE_FLOOR);
        const snareAboveThresh = snareBody > snareBodyThresh &&
            snareCrack > snareCrackThresh;
        const snareHit = snareAboveThresh && this._snareCooldownMs <= 0;
        if (snareHit) {
            this._lastSnareHitMs = this._elapsedMs;
            this._snareCooldownMs = RhythmicPercussionTracker.SNARE_COOLDOWN;
        }
        // ── 4. Hi-hat detection: high band above adaptive threshold ──
        const hhThresh = Math.max(this._hhEMA * RhythmicPercussionTracker.HH_MULT, RhythmicPercussionTracker.HH_FLOOR);
        const hhAboveThresh = hhRaw > hhThresh;
        const hhHit = hhAboveThresh && this._hhCooldownMs <= 0;
        if (hhHit) {
            this._lastHHHitMs = this._elapsedMs;
            this._hhCooldownMs = RhythmicPercussionTracker.HH_COOLDOWN;
        }
        // ── 5. Energy outputs — threshold-gated asymmetric attack/release envelope ──
        // Gate by threshold crossing (not cooldown) so energy tracks the actual
        // percussion envelope duration. Sustained vocals/melodies stay below
        // adaptive threshold (×2.0/×1.8) so their energy contribution is zero.
        // WAVE 7749.7: UNGATED raw energy for transient delta calculation.
        // The threshold-gated version (snareEnergyGated) is used for the EMA output
        // to suppress sustained vocals. But for onset detection, we need the ACTUAL
        // energy delta — including frames where the snare doesn't pass the adaptive
        // threshold.
        //
        // CRITICAL FIX: In techno 4/4, the body band (150-250Hz) is SATURATED by the
        // kick drum (fires every beat). The geometric mean sqrt(body * crack) is
        // dominated by the constant body energy, making the delta ~0 even when a
        // snare crack fires. The snare's distinctive transient is in the CRACK band
        // (2-5kHz) — that's where the "snap" lives. We track the crack band delta
        // directly, which captures snare transients even when the body is saturated.
        // This mirrors isKick: bassDelta tracks the SPECIFIC band where the kick lives.
        const snareEnergyUngated = Math.sqrt(snareBody * snareCrack);
        const snareEnergyGated = snareAboveThresh ? snareEnergyUngated : 0;
        // WAVE 7749.7: Raw transient delta — track the CRACK band delta directly.
        // The crack band (2-5kHz) is where the snare "snap" lives. In techno, the
        // body band is saturated by the kick, so sqrt(body*crack) is nearly constant.
        // But the crack band itself has sharp transients when a snare/clap fires.
        // WAVE 7749.8: Use ONLY crackDelta — the body band (150-250Hz) is saturated
        // by the kick drum in techno, producing false deltas on every beat. The crack
        // band (2-5kHz) is where the snare "snap" lives and is immune to kick bleed.
        const crackDelta = snareCrack - this._prevSnareCrackRaw;
        const bodyDelta = snareBody - this._prevSnareBodyRaw;
        const rawSnareDelta = crackDelta;
        this._prevSnareCrackRaw = snareCrack;
        this._prevSnareBodyRaw = snareBody;
        // ⚒️ WAVE 7749.80: Treble-ghost delta — raw 5-15kHz transient for EDM snare
        // rescue. Half-wave rectified (only rising edges = onsets). When the crack
        // band is dead but this spikes, a synthetic snare reverb tail has fired.
        const rawHhDelta = Math.max(0, hhRawUnclamped - this._prevHhRaw);
        this._prevHhRaw = hhRawUnclamped;
        // Keep _prevSnareEnergyRaw for backward compat (unused now but reset() clears it)
        this._prevSnareEnergyRaw = snareEnergyUngated;
        if (snareEnergyGated > this._snareEnergyEMA) {
            this._snareEnergyEMA += RhythmicPercussionTracker.ENERGY_ATTACK * (snareEnergyGated - this._snareEnergyEMA);
        }
        else {
            this._snareEnergyEMA += RhythmicPercussionTracker.ENERGY_RELEASE * (snareEnergyGated - this._snareEnergyEMA);
        }
        const hhEnergyRaw = hhAboveThresh ? hhRaw : 0;
        if (hhEnergyRaw > this._hhEnergyEMA) {
            this._hhEnergyEMA += RhythmicPercussionTracker.ENERGY_ATTACK * (hhEnergyRaw - this._hhEnergyEMA);
        }
        else {
            this._hhEnergyEMA += RhythmicPercussionTracker.ENERGY_RELEASE * (hhEnergyRaw - this._hhEnergyEMA);
        }
        // WAVE 8008 diagnostic: log raw sub-band values every ~44 frames (1s)
        // [DISABLED WAVE 9001] — debug traces no longer needed after FFT cleanup
        // this._diagCounter++;
        // if (this._diagCounter % 44 === 0) {
        //   console.log(
        //     `[🥁 RAW] body=${snareBody.toFixed(5)} crack=${snareCrack.toFixed(5)} ` +
        //     `hh=${hhRaw.toFixed(5)} | sqrt(body*crack)=${snareEnergyRaw.toFixed(5)} ` +
        //     `EMA_snare=${this._snareEnergyEMA.toFixed(5)} EMA_hh=${this._hhEnergyEMA.toFixed(5)} ` +
        //     `| bodyEMA=${this._snareBodyEMA.toFixed(5)} bodyThresh=${(this._snareBodyEMA * RhythmicPercussionTracker.SNARE_BODY_MULT).toFixed(5)} ` +
        //     `crackEMA=${this._snareCrackEMA.toFixed(5)} crackThresh=${(this._snareCrackEMA * RhythmicPercussionTracker.SNARE_CRACK_MULT).toFixed(5)} ` +
        //     `hhEMA=${this._hhEMA.toFixed(5)} hhThresh=${(this._hhEMA * RhythmicPercussionTracker.HH_MULT).toFixed(5)} ` +
        //     `| snareHit=${snareHit ? 1 : 0} hhHit=${hhHit ? 1 : 0} snareAbove=${snareAboveThresh ? 1 : 0} hhAbove=${hhAboveThresh ? 1 : 0}`
        //   );
        // }
        // WAVE 7749.22: EXTERMINATED — RAWΔ diagnostic log removed. Snare 4D is
        // production-ready. This was spamming the console every 44 frames.
        // Re-enable from git history if future debugging is needed.
        // WAVE 7749.7: Diagnostic — log rawSnareDelta every ~44 frames (1s) to verify
        // the value is non-zero before IPC transport
        // this._diagCounter++;
        // if (this._diagCounter % 44 === 0) {
        //   console.log(
        //     `[🥁 RAWΔ] body=${snareBody.toFixed(4)} crack=${snareCrack.toFixed(4)} ` +
        //     `crackDelta=${crackDelta.toFixed(4)} bodyDelta=${bodyDelta.toFixed(4)} ` +
        //     `rawSnareDelta=${rawSnareDelta.toFixed(4)} EMA=${this._snareEnergyEMA.toFixed(4)}`
        //   );
        // }
        // ── 6. Absence counters ──
        const snareAbsenceMs = this._elapsedMs - this._lastSnareHitMs;
        const hhAbsenceMs = this._elapsedMs - this._lastHHHitMs;
        // ── 7. Rhythmic void — normalized [0,1] ──
        // Saturates at 3000ms absence for both. Geometric mean ensures that
        // if EITHER percussion is active, void stays low.
        const snareVoid = Math.min(1, snareAbsenceMs / 3000);
        const hhVoid = Math.min(1, hhAbsenceMs / 3000);
        const rhythmicVoid = Math.sqrt(snareVoid * hhVoid);
        return {
            snare_energy: this._snareEnergyEMA,
            hh_energy: this._hhEnergyEMA,
            snare_absence_ms: snareAbsenceMs,
            hh_absence_ms: hhAbsenceMs,
            rhythmic_void: rhythmicVoid,
            raw_snare_delta: rawSnareDelta,
            // ⚒️ WAVE 7749.69b: Use ONLY crack band (2-5kHz) — NOT sqrt(body*crack).
            // The body band (150-250Hz) is saturated by the kick in techno, giving
            // sqrt(body*crack) a baseline of ~0.25 that fires the EMA momentum on
            // every kick beat. The crack band alone is where the snare snap lives
            // and is immune to kick bleed.
            snare_energy_ungated: snareCrack,
            // ⚒️ WAVE 7749.76: Crack-band spectral flux for the domain-localized drive
            snare_crack_flux: this._lastCrackFlux,
            // ⚒️ WAVE 7749.77: Body Factor — continuous algebraic gate [0.1, 2.0]
            snare_body_factor: bodyFactor,
            // ⚒️ WAVE 7749.80: Treble-ghost delta — raw 5-15kHz transient for EDM rescue
            raw_hh_delta: rawHhDelta,
        };
    }
    reset() {
        this._snareBodyEMA = 0;
        this._snareCrackEMA = 0;
        this._hhEMA = 0;
        this._snareEnergyEMA = 0;
        this._hhEnergyEMA = 0;
        this._prevSnareEnergyRaw = 0;
        this._prevSnareCrackRaw = 0;
        this._prevSnareBodyRaw = 0;
        // ⚒️ WAVE 7749.80: reset treble-ghost delta state
        this._prevHhRaw = 0;
        this._elapsedMs = 0;
        this._lastSnareHitMs = 0;
        this._lastHHHitMs = 0;
        this._snareCooldownMs = 0;
        this._hhCooldownMs = 0;
        // ⚒️ WAVE 7749.76: reset crack-band flux state
        this._prevCrackPower.fill(0);
        this._crackFluxWhitening.fill(0);
        this._lastCrackFlux = 0;
    }
}
// WAVE 8008 fix: asymmetric attack/release — instant attack, ~200ms release
RhythmicPercussionTracker.ENERGY_ATTACK = 0.85; // near-instant rise
RhythmicPercussionTracker.ENERGY_RELEASE = 0.06; // ~330ms decay @ 44Hz
// WAVE 8008 fix: gain boost for sub-band energies to reach useful 0-1 range
RhythmicPercussionTracker.RHYTHMIC_GAIN = 8.0;
RhythmicPercussionTracker.SNARE_COOLDOWN = 80; // 80ms min between snare hits
RhythmicPercussionTracker.HH_COOLDOWN = 40; // 40ms min between HH hits
// Adaptive threshold multipliers — relative to moving average
RhythmicPercussionTracker.SNARE_BODY_MULT = 2.0;
RhythmicPercussionTracker.SNARE_CRACK_MULT = 1.8;
RhythmicPercussionTracker.HH_MULT = 2.2;
// Minimum absolute energy floor (below this = silence, never a hit)
RhythmicPercussionTracker.SNARE_FLOOR = 0.008;
RhythmicPercussionTracker.HH_FLOOR = 0.005;
export class GodEarAnalyzer {
    constructor(sampleRate = 44100, fftSize = 4096) {
        this.frameIndex = 0;
        this.lastTimestamp = 0;
        // WAVE 8002: EMA of rawBassEnergy for flux scale calibration
        this.rawBassEnergyRef = 0;
        // WAVE 8003: Last frame's SI for AGC freeze (set before AGC runs)
        this.lastSI = 0;
        // WAVE 8004: Debug mode — enables telemetry collection (zero-cost when false)
        this.debugMode = false;
        // WAVE 8004: Cached telemetry snapshot from last analyze() call
        this._telemetry = null;
        // Feature flags
        this.useAGC = true;
        this.useStereo = true;
        this.sampleRate = sampleRate;
        this.fftSize = fftSize;
        this.numBins = fftSize >> 1; // fftSize / 2
        this.agc = new AGCTrustZone();
        this.onsetDetector = new SlopeBasedOnsetDetector();
        this.saturationMeter = new SaturationMeter();
        this.strobeEngine = new StrobeEngine();
        this.chromaCoupler = new ChromaCoupler();
        this.rhythmicTracker = new RhythmicPercussionTracker(sampleRate, fftSize);
        // ═════════ WAVE 2090.1: ONE-TIME BUFFER ALLOCATION ═════════
        this.inputBuffer = new Float32Array(fftSize);
        this.dcBuffer = new Float32Array(fftSize);
        this.windowedBuffer = new Float32Array(fftSize);
        this.fftReal = new Float32Array(fftSize);
        this.fftImag = new Float32Array(fftSize);
        this.powerSpectrum = new Float32Array(this.numBins + 1); // Include Nyquist
        this.monoMixBuffer = new Float32Array(fftSize);
        // 🎹 WAVE 2301: 12-bin chromagram buffer (pitch classes C through B)
        this.chromaBuffer = new Float32Array(12);
        // WAVE 8002: Spectral Flux V3 buffers
        this.prevPower = new Float32Array(this.numBins + 1);
        this.fluxWhitening = new Float32Array(this.numBins + 1);
        // Zero-alloc output buffers (avoid Array.from + spread per frame)
        this.chromaOutput = new Array(12).fill(0);
        this.bandsRawOutput = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0 };
        // ════════════════════════════════════════════════════════════
        // Initialize LR4 filter masks (also one-time)
        getLR4FilterMasks(fftSize, sampleRate);
        // WAVE 8001: Initialize Twiddle Factor LUT for FFT core
        initTwiddleLUT(fftSize);
    }
    /**
     * Analyze mono audio buffer.
     *
     * WAVE 2090.1: ZERO-ALLOCATION — entire pipeline operates on pre-allocated buffers.
     * No new Float32Array, no Array.from, no .sort(), no .slice() in the hot path.
     *
     * @param buffer - Audio samples (Float32Array)
     * @param deltaMsOverride - Optional audio-domain frame time in ms. Real-time
     *   callers should omit this (wall-clock is correct). Offline/batch callers
     *   MUST supply it (e.g. fftSize / sampleRate * 1000), otherwise time-based
     *   metrics such as transientDensity are measured against CPU time.
     * @returns Complete GodEarSpectrum
     */
    analyze(buffer, deltaMsOverride) {
        const startTime = performance.now();
        // ═══ STAGE 0: Prepare input into pre-allocated buffer ═══
        // Zero out the input buffer (handles padding implicitly)
        this.inputBuffer.fill(0);
        // Copy input samples (up to fftSize) — NO slice(), NO new array.
        // WAVE 7742: CLIPPING DETECTOR — piggyback on the copy loop (zero extra
        // iteration, zero allocation). Counts samples pegged at the digital
        // ceiling (|s| ≥ 0.999). The resulting clipRatio gates whiteNoiseScore
        // downstream so Selene doesn't interpret clipping distortion products
        // as genuine broadband noise / chaos.
        const copyLen = Math.min(buffer.length, this.fftSize);
        let clippedSamples = 0;
        for (let i = 0; i < copyLen; i++) {
            const s = buffer[i];
            this.inputBuffer[i] = s;
            if (s >= 0.999 || s <= -0.999)
                clippedSamples++;
        }
        const clipRatio = copyLen > 0 ? clippedSamples / copyLen : 0;
        // ═══ STAGE 1: DC Offset Removal → dcBuffer ═══
        removeDCOffset(this.inputBuffer, this.dcBuffer);
        // ═══ STAGE 2: Blackman-Harris Windowing → windowedBuffer ═══
        applyBlackmanHarrisWindow(this.dcBuffer, this.windowedBuffer);
        // ═══ STAGE 3: FFT → fftReal, fftImag ═══
        computeFFTCore(this.windowedBuffer, this.fftReal, this.fftImag);
        // ═══ STAGE 4: Power Spectrum → powerSpectrum (WAVE 8001: sqrt deferred) ═══
        computePowerSpectrum(this.fftReal, this.fftImag, this.powerSpectrum, this.numBins);
        // 🎹 WAVE 2301: THE CHROMAGRAM AWAKENING (WAVE 8001: now reads from power spectrum)
        // Compute 12-bin chromagram directly from power spectrum.
        // Bin frequency → MIDI note → pitch class (0=C … 11=B), power accumulated, normalized.
        // Zero-allocation: writes into pre-allocated this.chromaBuffer.
        computeChromaFromSpectrum(this.powerSpectrum, this.numBins, this.sampleRate, this.fftSize, this.chromaBuffer);
        // ═══ STAGE 5: LR4 Filter Bank + Band Extraction ═══
        const filterMasks = getLR4FilterMasks(this.fftSize, this.sampleRate);
        const filterWeightSums = getLR4FilterWeightSums(this.fftSize, this.sampleRate);
        const deltaMs = deltaMsOverride ?? (this.lastTimestamp > 0 ? startTime - this.lastTimestamp : 50);
        this.lastTimestamp = startTime;
        // Extract raw band energies (reads from this.powerSpectrum, no allocation)
        // WAVE 8001: extractBandPower operates in power domain, sqrt only at output
        const rawBands = {
            subBass: extractBandPower(this.powerSpectrum, filterMasks.get('subBass')),
            bass: extractBandPower(this.powerSpectrum, filterMasks.get('bass')),
            lowMid: extractBandPower(this.powerSpectrum, filterMasks.get('lowMid')),
            mid: extractBandPower(this.powerSpectrum, filterMasks.get('mid')),
            highMid: extractBandPower(this.powerSpectrum, filterMasks.get('highMid')),
            treble: extractBandPower(this.powerSpectrum, filterMasks.get('treble')),
            ultraAir: extractBandPower(this.powerSpectrum, filterMasks.get('ultraAir')),
        };
        // WAVE 3425: scale pre-AGC bands so UI/DMX and BPM tracker share the same
        // deterministic post-FFT magnitude domain.
        const scaledBands = {
            subBass: scaleBandEnergyForVisual(rawBands.subBass, filterWeightSums.get('subBass') ?? 1),
            bass: scaleBandEnergyForVisual(rawBands.bass, filterWeightSums.get('bass') ?? 1),
            lowMid: scaleBandEnergyForVisual(rawBands.lowMid, filterWeightSums.get('lowMid') ?? 1),
            mid: scaleBandEnergyForVisual(rawBands.mid, filterWeightSums.get('mid') ?? 1),
            highMid: scaleBandEnergyForVisual(rawBands.highMid, filterWeightSums.get('highMid') ?? 1),
            treble: scaleBandEnergyForVisual(rawBands.treble, filterWeightSums.get('treble') ?? 1),
            ultraAir: scaleBandEnergyForVisual(rawBands.ultraAir, filterWeightSums.get('ultraAir') ?? 1),
        };
        const telemetryFrame = this.frameIndex + 1;
        // [DISABLED WAVE 9001] — debug traces no longer needed after FFT cleanup
        // if (telemetryFrame % RADIX2_RAW_TELEMETRY_INTERVAL_FRAMES === 0) {
        //   const rawPeak = Math.max(
        //     scaledBands.subBass,
        //     scaledBands.bass,
        //     scaledBands.lowMid,
        //     scaledBands.mid,
        //     scaledBands.highMid,
        //     scaledBands.treble,
        //     scaledBands.ultraAir
        //   );
        //   console.log(
        //     `[RADIX2 RAW] Peak: ${rawPeak.toFixed(6)} | Bands: ` +
        //     `sub=${scaledBands.subBass.toFixed(6)} ` +
        //     `bass=${scaledBands.bass.toFixed(6)} ` +
        //     `mid=${scaledBands.mid.toFixed(6)} ` +
        //     `highMid=${scaledBands.highMid.toFixed(6)}`
        //   );
        // }
        // ═══ STAGE 6: AGC Trust Zones ═══
        // WAVE 8003: AGC Freeze — use previous frame's SI to prevent gain reduction under brickwall
        this.agc.setFreezeReduction(this.lastSI > 0.6);
        const bands = this.useAGC ? {
            subBass: this.agc.process('subBass', scaledBands.subBass, deltaMs),
            bass: this.agc.process('bass', scaledBands.bass, deltaMs),
            lowMid: this.agc.process('lowMid', scaledBands.lowMid, deltaMs),
            mid: this.agc.process('mid', scaledBands.mid, deltaMs),
            highMid: this.agc.process('highMid', scaledBands.highMid, deltaMs),
            treble: this.agc.process('treble', scaledBands.treble, deltaMs),
            ultraAir: this.agc.process('ultraAir', scaledBands.ultraAir, deltaMs),
        } : scaledBands;
        // ═══ Spectral Metrics (reads from this.powerSpectrum, no allocation) ═══
        // WAVE 8001: All metrics adapted to power domain — same output values as V2
        const flatness = calculateSpectralFlatness(this.powerSpectrum);
        const crestFactor = calculateCrestFactor(this.powerSpectrum);
        const spectral = {
            centroid: calculateSpectralCentroid(this.powerSpectrum, this.sampleRate, this.fftSize),
            flatness,
            rolloff: calculateSpectralRolloff(this.powerSpectrum, this.sampleRate, this.fftSize),
            crestFactor,
            clarity: calculateClarity(this.powerSpectrum, flatness, crestFactor, this.numBins + 1),
        };
        // ═══ Dominant Frequency + Total Energy (needed by WAVE 8002 SI) ═══
        // WAVE 8001: Find max power bin — same index as max magnitude
        let maxPower = 0;
        let dominantBin = 0;
        let totalPowerSum = 0;
        for (let i = 0; i <= this.numBins; i++) {
            const p = this.powerSpectrum[i];
            totalPowerSum += p;
            if (i > 0 && p > maxPower) {
                maxPower = p;
                dominantBin = i;
            }
        }
        const dominantFrequency = dominantBin * (this.sampleRate / this.fftSize);
        const totalEnergy = Math.sqrt(totalPowerSum);
        // ═══ WAVE 8002: Spectral Flux V3 + Saturation Index ═══
        // Compute half-wave rectified whitened flux from power spectrum.
        // Uses prevPower and fluxWhitening buffers (mutated in-place).
        const spectralFluxV3 = computeSpectralFlux(this.powerSpectrum, this.prevPower, this.fluxWhitening, this.numBins);
        // Compute Saturation Index from crest, flatness, and total power.
        // crestFactor is in power domain: CF_dB = 10·log₁₀(maxP/meanP).
        const crestDb = 10 * Math.log10((maxPower > 0 && totalPowerSum > 0)
            ? (maxPower * (this.numBins + 1) / totalPowerSum)
            : 1);
        const si = this.saturationMeter.update(totalPowerSum, crestDb, flatness);
        this.lastSI = si;
        // WAVE 8002: Crossfade for BPM tracker — α = SI
        // When SI≈0 (dynamic): bandsRaw unchanged — identical to V2.
        // When SI≈1 (brickwall): flux signal stabilizes the kick feed.
        // Scale flux to match rawBassEnergy range via slow EMA reference.
        const rawBassEnergy = scaledBands.subBass + scaledBands.bass;
        // EMA with τ ≈ 1s (k=0.02 @ ~20fps)
        this.rawBassEnergyRef += 0.02 * (rawBassEnergy - this.rawBassEnergyRef);
        // Scale flux to energy domain: flux ∈ [0,~1], ref ∈ [0,~1]
        const fluxScaled = spectralFluxV3 * (this.rawBassEnergyRef + 1e-10);
        // Crossfade: α·fluxScaled + (1−α)·energy
        const kickSignal = si * fluxScaled + (1 - si) * rawBassEnergy;
        // Distribute back to subBass/bass preserving their original ratio
        const ratio = rawBassEnergy > 1e-10
            ? scaledBands.subBass / rawBassEnergy
            : 0.5;
        const crossfadeSubBass = kickSignal * ratio;
        const crossfadeBass = kickSignal * (1 - ratio);
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
        // ═══ WAVE 8003+8004: Photon Block ═══
        // wallIntensity = min(1, SI^0.7 * 0.85) — lower-bound anti-collapse for DMX
        const wallIntensity = Math.min(1, Math.pow(si, 0.7) * 0.85);
        // White noise score: high flatness indicates broadband noise.
        // WAVE 7742: CLIPPING GATE — when samples are pegged at the digital
        // ceiling (clipRatio > 0), the resulting intermodulation distortion
        // spreads energy across FFT bins, inflating flatness. This makes
        // Selene's cognitive core perceive "100% white noise / chaos" and
        // fire aggressive strobes on what is actually just a clipped signal.
        // We linearly suppress whiteNoiseScore as clipRatio rises from 1% to
        // 10% of the buffer, reaching full suppression at 10%+ clipped.
        // This protects the AI from its own input chain's clipping artifacts
        // without affecting the genuine noise measurement on clean signals.
        const rawWhiteNoiseScore = Math.max(0, Math.min(1, (flatness - FLATNESS_OFFSET) / FLATNESS_SCALE));
        const clipSuppression = clipRatio > 0.01
            ? Math.max(0, 1 - (clipRatio - 0.01) / 0.09)
            : 1;
        const whiteNoiseScore = rawWhiteNoiseScore * clipSuppression;
        // WAVE 8005 R2: True temporal onset density over a 500ms sliding window.
        // No longer derived from band strength — this measures event RATE.
        const transientDensity = this.onsetDetector.updateTemporalDensity(transients.any, deltaMs);
        // WAVE 8004: StrobeEngine — maps chaos to strobe state (12Hz safety cap)
        // Tonal gate: high kick/highs ratio means sustained tonal content (bass/synth),
        // which fools the onset detector into inflating transientDensity.
        const tonalRatio = kickSignal / (scaledBands.treble + 1e-6);
        // DESIGN DECISION: Strobe via FFT permanently disabled to avoid visual noise and
        // hardware desync on double-kicks/fast BPMs. Strobe responsibility is deferred to
        // Selene's cognitive layer pending future precise calibration.
        const strobeState = { active: false, rateHz: 0, duty: 0, drive: 0 };
        // const strobeState = this.strobeEngine.process(
        //   transientDensity, whiteNoiseScore, spectralFluxV3, deltaMs, tonalRatio
        // );
        // Diagnostic: log StrobeEngine inputs every 60 frames (same cadence as RADIX2)
        // [DISABLED WAVE 9001] — debug traces no longer needed after FFT cleanup
        // if (telemetryFrame % RADIX2_RAW_TELEMETRY_INTERVAL_FRAMES === 0) {
        //   const fluxNorm = Math.max(0, Math.min(1, (spectralFluxV3 - 0.02) / 0.15));
        //   console.log(
        //     `[STROBE] td=${transientDensity.toFixed(3)} wn=${whiteNoiseScore.toFixed(3)} ` +
        //     `flux=${spectralFluxV3.toFixed(4)} fluxN=${fluxNorm.toFixed(3)} ` +
        //     `tr=${tonalRatio.toFixed(2)} drive=${strobeState.drive.toFixed(3)} ` +
        //     `driveRaw=${this.strobeEngine.driveRaw.toFixed(3)} active=${strobeState.active}`
        //   );
        // }
        // WAVE 8004: ChromaCoupler — maps chromagram to hue + colorSnap + chromaFlux
        this.chromaCoupler.process(this.chromaBuffer, deltaMs);
        // WAVE 8008: Rhythmic Percussion Tracker — sub-band snare/HH isolation + void
        const rhythmic = this.rhythmicTracker.process(this.powerSpectrum, deltaMs);
        const photon = {
            saturation: si,
            wallIntensity,
            strobe: strobeState,
            hue: this.chromaCoupler.hue,
            colorSnap: this.chromaCoupler.isSnap(kickSignal, scaledBands.treble),
            chromaFlux: this.chromaCoupler.chromaFlux,
            spectralFlux: spectralFluxV3,
            transientDensity,
            whiteNoiseScore,
        };
        // WAVE 8004: Telemetry snapshot — only populated when debugMode is active
        if (this.debugMode) {
            const agcState = this.agc.getState();
            this._telemetry = {
                agc: {
                    gains: agcState.perBandGains,
                    freezeReduction: this.agc.isFreezeReduction,
                },
                strobe: {
                    drive: this.strobeEngine.drive,
                    driveRaw: this.strobeEngine.driveRaw,
                    rate: this.strobeEngine.rate,
                    cooldownMs: this.strobeEngine.cooldownMs,
                    activationThreshold: this.strobeEngine.activationThreshold,
                    maxRateHz: this.strobeEngine.maxRateHz,
                },
                chroma: {
                    hue: this.chromaCoupler.hue,
                    chromaFlux: this.chromaCoupler.chromaFlux,
                    snapCooldownMs: this.chromaCoupler.snapCooldownMs,
                    snapThreshold: this.chromaCoupler.snapThresholdValue,
                },
                levels: {
                    rawKick: rawBands.subBass + rawBands.bass * 0.5,
                    rawSubBass: rawBands.subBass,
                    rawHighs: rawBands.treble + rawBands.highMid * 0.3,
                    scaledKick: kickSignal,
                    scaledSubBass: scaledBands.subBass,
                    scaledHighs: scaledBands.treble,
                },
                metrics: {
                    saturationIndex: si,
                    transientDensity,
                    spectralFluxV3,
                    flatness,
                    whiteNoiseScore,
                },
            };
        }
        // Zero-allocation: copy chroma into pre-allocated output array (12 assignments)
        for (let i = 0; i < 12; i++)
            this.chromaOutput[i] = this.chromaBuffer[i];
        // Zero-allocation: populate pre-allocated bandsRaw output (no spread)
        this.bandsRawOutput.subBass = crossfadeSubBass;
        this.bandsRawOutput.bass = crossfadeBass;
        this.bandsRawOutput.lowMid = scaledBands.lowMid;
        this.bandsRawOutput.mid = scaledBands.mid;
        this.bandsRawOutput.highMid = scaledBands.highMid;
        this.bandsRawOutput.treble = scaledBands.treble;
        this.bandsRawOutput.ultraAir = scaledBands.ultraAir;
        const processingLatency = performance.now() - startTime;
        this.frameIndex++;
        // ═══ STAGE 7: Output ═══
        return {
            bands,
            bandsRaw: this.bandsRawOutput,
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
                version: '3.0.0',
            },
            dominantFrequency,
            totalEnergy,
            // 🎹 WAVE 2301: 12-bin chromagram (C through B, normalized 0-1)
            chroma: this.chromaOutput,
            // WAVE 8002: Spectral Flux V3 (normalized, whitened)
            spectralFluxV3,
            // WAVE 8003: Photon block
            photon,
            // WAVE 8008: Rhythmic percussion telemetry
            rhythmic,
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
        this.saturationMeter.reset();
        this.strobeEngine.reset();
        this.chromaCoupler.reset();
        this.rhythmicTracker.reset();
        this.rawBassEnergyRef = 0;
        this.lastSI = 0;
        this.prevPower.fill(0);
        this.fluxWhitening.fill(0);
        this.frameIndex = 0;
        this.lastTimestamp = 0;
        this._telemetry = null;
        console.log('[GOD EAR] 🔄 Analyzer reset');
    }
    /**
     * Get analyzer info
     */
    getInfo() {
        return `GOD EAR v3.0.0 | ${this.fftSize} Radix-2 DIT FFT + LUT | ${this.sampleRate}Hz | ${BIN_RESOLUTION.toFixed(2)}Hz/bin | Blackman-Harris | LR4 Filters | Power Spectrum`;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // WAVE 8004: TELEMETRY API — On-demand DSP state inspection
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Enable/disable debug mode for telemetry collection.
     * When false, getTelemetry() returns null and zero overhead is added to analyze().
     */
    setDebugMode(active) {
        this.debugMode = active;
        if (!active)
            this._telemetry = null;
    }
    /**
     * Get current telemetry snapshot. Returns null when debugMode is false.
     * The snapshot reflects the last analyze() call's internal state.
     */
    getTelemetry() {
        return this._telemetry;
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
            results[config.id] = extractBandPower(testMagnitudes, mask);
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
function softClip01(value) {
    if (!Number.isFinite(value) || value <= 0)
        return 0;
    return value / (1 + value);
}
/**
 * Convert GodEarSpectrum to legacy BandEnergy format.
 *
 * WAVE 3421 — Pilar 2: Crossover de bandas huérfanas.
 * Antes: lowMid (250-500Hz) y highMid (2-6kHz) existían como side fields
 * pero nunca contribuían a los canales bass/mid que controlan los fixtures.
 * Resultado: bass anémico con VW (picos 0.56 → bass 0.07), synth melódico invisible.
 *
 * Coeficientes derivados del Blueprint WAVE 3420:
 *   bass  += lowMid  * 0.4  → punch del kick/bass synth (250-500Hz entra al canal bass)
 *   mid   += highMid * 0.6  → melodía del synth (2-6kHz entra al canal mid)
 * Los side fields lowMid/highMid se preservan sin cambio para consumers upstream.
 */
export function toLegacyFormat(spectrum) {
    const bass = spectrum.bands.bass + spectrum.bands.subBass * 0.5 + spectrum.bands.lowMid * 0.4;
    const mid = spectrum.bands.mid + spectrum.bands.highMid * 0.6;
    const treble = spectrum.bands.treble + spectrum.bands.ultraAir * 0.5;
    return {
        // WAVE 3421: lowMid * 0.4 devuelve el punch de 250-500Hz al canal bass
        bass: softClip01(bass),
        lowMid: softClip01(spectrum.bands.lowMid), // side field preservado
        // WAVE 3421: highMid * 0.6 devuelve la melodía de 2-6kHz al canal mid
        mid: softClip01(mid),
        highMid: softClip01(spectrum.bands.highMid), // side field preservado (harshness proxy)
        treble: softClip01(treble),
        subBass: softClip01(spectrum.bands.subBass),
        dominantFrequency: spectrum.dominantFrequency,
        spectralCentroid: spectrum.spectral.centroid,
        harshness: softClip01(spectrum.bands.highMid), // Approximate
        spectralFlatness: spectrum.spectral.flatness,
        // WAVE 3516.1: El 7º Pasajero — bandas crudas que viajan sin mezcla legacy.
        // treble legacy (arriba) conserva su suma con ultraAir*0.5 para no romper consumers.
        rawTreble: softClip01(spectrum.bands.treble),
        ultraAir: softClip01(spectrum.bands.ultraAir),
    };
}
// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
export default GodEarAnalyzer;
// WAVE 2098: Boot silence — module load log removed
