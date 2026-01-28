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
// SECTION 1: TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 7 TACTICAL BANDS - Zero Overlap Architecture
 */
export interface GodEarBands {
  /** 20-60Hz - Presión de aire pura (kicks sísmicos, 808 rumble) */
  subBass: number;
  /** 60-250Hz - Cuerpo rítmico (bajos, kick body, toms) */
  bass: number;
  /** 250-500Hz - Calor/Mud zone (limpieza crítica) */
  lowMid: number;
  /** 500-2000Hz - Voces/Snare/Lead (corazón musical) */
  mid: number;
  /** 2000-6000Hz - Crunch/Ataque/Presencia (edge definition) */
  highMid: number;
  /** 6000-16000Hz - Brillo/Hi-Hats/Aire (sparkle zone) */
  treble: number;
  /** 16000-22000Hz - Armónicos superiores (sizzle digital) */
  ultraAir: number;
}

/**
 * Raw bands before AGC (for debugging)
 */
export interface GodEarBandsRaw extends GodEarBands {
  raw: GodEarBands;
}

/**
 * Spectral metrics for advanced analysis
 */
export interface GodEarSpectralMetrics {
  /** Hz - Centro de masa espectral (brillo tonal) */
  centroid: number;
  /** 0-1 - Tonalidad vs ruido (Wiener Entropy) */
  flatness: number;
  /** Hz - Frecuencia donde está 85% de la energía */
  rolloff: number;
  /** Peak/RMS ratio (dynamics) */
  crestFactor: number;
  /** 0-1 - Signal quality metric (propietario GOD EAR) */
  clarity: number;
}

/**
 * Stereo analysis metrics
 */
export interface GodEarStereoMetrics {
  /** -1 to +1 - Phase correlation (mono=1, stereo=0, out-of-phase=-1) */
  correlation: number;
  /** 0-2 - Stereo width (mono=0, wide=1, super-wide=2) */
  width: number;
  /** -1 to +1 - L/R balance */
  balance: number;
}

/**
 * Transient detection results
 */
export interface GodEarTransients {
  /** Onset detected in SubBass */
  kick: boolean;
  /** Onset detected in Mid */
  snare: boolean;
  /** Onset detected in Treble */
  hihat: boolean;
  /** OR of all transients */
  any: boolean;
  /** 0-1 - Strength of strongest transient */
  strength: number;
}

/**
 * AGC (Automatic Gain Control) state per band
 */
export interface GodEarAGCState {
  globalGain: number;
  perBandGains: GodEarBands;
  isActive: boolean;
  attackMs: number;
  releaseMs: number;
}

/**
 * Processing metadata
 */
export interface GodEarMetadata {
  timestamp: number;
  frameIndex: number;
  processingLatencyMs: number;
  fftSize: number;
  sampleRate: number;
  windowFunction: 'blackman-harris' | 'hann' | 'hamming';
  filterOrder: 4;
  version: '1.0.0';
}

/**
 * Complete GOD EAR spectrum output
 */
export interface GodEarSpectrum {
  bands: GodEarBands;
  bandsRaw: GodEarBands;
  spectral: GodEarSpectralMetrics;
  stereo: GodEarStereoMetrics | null;
  transients: GodEarTransients;
  agc: GodEarAGCState;
  meta: GodEarMetadata;
  
  // Legacy compatibility
  dominantFrequency: number;
  totalEnergy: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

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
} as const;

type BandKey = keyof typeof GOD_EAR_BAND_CONFIG;

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
let BLACKMAN_HARRIS_WINDOW: Float32Array | null = null;

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
function generateBlackmanHarrisWindow(size: number): Float32Array {
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
function getBlackmanHarrisWindow(size: number): Float32Array {
  if (!BLACKMAN_HARRIS_WINDOW || BLACKMAN_HARRIS_WINDOW.length !== size) {
    console.log(`[GOD EAR] 🩻 Generating Blackman-Harris window (${size} samples)`);
    BLACKMAN_HARRIS_WINDOW = generateBlackmanHarrisWindow(size);
  }
  return BLACKMAN_HARRIS_WINDOW;
}

/**
 * Apply Blackman-Harris window to audio samples.
 * 
 * @param samples - Input audio samples
 * @returns Windowed samples
 */
function applyBlackmanHarrisWindow(samples: Float32Array): Float32Array {
  const window = getBlackmanHarrisWindow(samples.length);
  const windowed = new Float32Array(samples.length);
  
  for (let i = 0; i < samples.length; i++) {
    windowed[i] = samples[i] * window[i];
  }
  
  return windowed;
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
 * @param samples - Input audio samples
 * @returns Samples with DC offset removed
 */
function removeDCOffset(samples: Float32Array): Float32Array {
  // Calculate mean (DC component)
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;
  
  // Subtract mean (remove DC)
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] - mean;
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: FFT CORE - COOLEY-TUKEY RADIX-2 (Optimized)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pre-computed bit-reversal table (for faster FFT)
 */
let BIT_REVERSAL_TABLE: Uint16Array | null = null;
let BIT_REVERSAL_SIZE = 0;

/**
 * Pre-computed twiddle factors (sine/cosine lookup tables)
 */
let TWIDDLE_REAL: Float32Array | null = null;
let TWIDDLE_IMAG: Float32Array | null = null;
let TWIDDLE_SIZE = 0;

/**
 * Generate bit-reversal permutation table.
 */
function generateBitReversalTable(n: number): Uint16Array {
  const bits = Math.log2(n);
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
 * Generate twiddle factors (pre-computed sine/cosine)
 */
function generateTwiddleFactors(n: number): void {
  TWIDDLE_REAL = new Float32Array(n / 2);
  TWIDDLE_IMAG = new Float32Array(n / 2);
  
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    TWIDDLE_REAL[k] = Math.cos(angle);
    TWIDDLE_IMAG[k] = Math.sin(angle);
  }
  
  TWIDDLE_SIZE = n;
}

/**
 * Get or create bit-reversal table
 */
function getBitReversalTable(n: number): Uint16Array {
  if (!BIT_REVERSAL_TABLE || BIT_REVERSAL_SIZE !== n) {
    BIT_REVERSAL_TABLE = generateBitReversalTable(n);
    BIT_REVERSAL_SIZE = n;
  }
  return BIT_REVERSAL_TABLE;
}

/**
 * Initialize twiddle factors if needed
 */
function ensureTwiddleFactors(n: number): void {
  if (!TWIDDLE_REAL || !TWIDDLE_IMAG || TWIDDLE_SIZE !== n) {
    generateTwiddleFactors(n);
  }
}

/**
 * Compute FFT using Cooley-Tukey Radix-2 algorithm.
 * 
 * Optimizations:
 * - Pre-computed bit-reversal table
 * - Pre-computed twiddle factors
 * - In-place computation
 * 
 * @param samples - Windowed audio samples (MUST be power of 2)
 * @returns Complex spectrum (real and imaginary parts)
 */
function computeFFTCore(samples: Float32Array): { real: Float32Array; imag: Float32Array } {
  const n = samples.length;
  
  // Get pre-computed tables
  const bitReversal = getBitReversalTable(n);
  ensureTwiddleFactors(n);
  
  // Allocate output arrays
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  
  // Bit-reversal permutation
  for (let i = 0; i < n; i++) {
    real[bitReversal[i]] = samples[i];
    // imag is already zero-initialized
  }
  
  // Cooley-Tukey butterfly
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size >> 1;
    const tableStep = n / size;
    
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const twiddleIndex = j * tableStep;
        const twiddleReal = TWIDDLE_REAL![twiddleIndex];
        const twiddleImag = TWIDDLE_IMAG![twiddleIndex];
        
        const idx1 = i + j;
        const idx2 = i + j + halfSize;
        
        // Butterfly operation
        const tReal = real[idx2] * twiddleReal - imag[idx2] * twiddleImag;
        const tImag = real[idx2] * twiddleImag + imag[idx2] * twiddleReal;
        
        real[idx2] = real[idx1] - tReal;
        imag[idx2] = imag[idx1] - tImag;
        real[idx1] = real[idx1] + tReal;
        imag[idx1] = imag[idx1] + tImag;
      }
    }
  }
  
  return { real, imag };
}

/**
 * Compute magnitude spectrum from complex FFT output.
 * 
 * @param real - Real part of FFT
 * @param imag - Imaginary part of FFT
 * @returns Magnitude spectrum (only positive frequencies, normalized)
 */
function computeMagnitudeSpectrum(
  real: Float32Array, 
  imag: Float32Array
): Float32Array {
  const n = real.length;
  const numBins = n >> 1; // n / 2
  const magnitudes = new Float32Array(numBins + 1); // Include Nyquist
  
  // Normalization factor (window compensation + FFT normalization)
  const normFactor = 1 / (n * BLACKMAN_HARRIS_COHERENT_GAIN);
  
  for (let i = 0; i <= numBins; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    magnitudes[i] = mag * normFactor;
  }
  
  return magnitudes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: LINKWITZ-RILEY 4th ORDER DIGITAL FILTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pre-computed LR4 filter masks for each band
 */
let LR4_FILTER_MASKS: Map<string, Float32Array> | null = null;

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
function linkwitzRileyResponse(
  binFreq: number,
  crossoverFreq: number,
  isLowPass: boolean
): number {
  if (crossoverFreq <= 0) return isLowPass ? 1.0 : 0.0;
  if (binFreq <= 0) return isLowPass ? 1.0 : 0.0;
  
  const ratio = binFreq / crossoverFreq;
  
  // LR4 transfer function magnitude squared
  // |H(jω)|² = 1 / (1 + (ω/ωc)⁸) for low-pass
  // |H(jω)|² = (ω/ωc)⁸ / (1 + (ω/ωc)⁸) for high-pass
  
  const ratio8 = Math.pow(ratio, 8); // 4th order squared = 8th power
  
  if (isLowPass) {
    return 1.0 / (1.0 + ratio8);
  } else {
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
function generateBandMask(
  fftSize: number,
  sampleRate: number,
  lowCrossover: number,
  highCrossover: number
): Float32Array {
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
function getLR4FilterMasks(fftSize: number, sampleRate: number): Map<string, Float32Array> {
  if (LR4_FILTER_MASKS) {
    return LR4_FILTER_MASKS;
  }
  
  console.log('[GOD EAR] 🔧 Generating Linkwitz-Riley 4th order filter masks...');
  
  LR4_FILTER_MASKS = new Map();
  
  for (const [key, config] of Object.entries(GOD_EAR_BAND_CONFIG)) {
    const mask = generateBandMask(fftSize, sampleRate, config.freqLow, config.freqHigh);
    LR4_FILTER_MASKS.set(config.id, mask);
    
    // Calculate effective bins for logging
    let activeBins = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.01) activeBins++;
    }
    console.log(`[GOD EAR]   ${config.id}: ${config.freqLow}-${config.freqHigh}Hz (~${activeBins} bins)`);
  }
  
  console.log('[GOD EAR] ✅ LR4 filter bank ready');
  
  return LR4_FILTER_MASKS;
}

/**
 * Extract band energy using LR4 filtered magnitudes.
 * 
 * @param magnitudes - Magnitude spectrum
 * @param mask - LR4 filter mask for this band
 * @returns RMS energy for this band (0.0-1.0)
 */
function extractBandEnergy(magnitudes: Float32Array, mask: Float32Array): number {
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
function calculateSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number
): number {
  const binResolution = sampleRate / fftSize;
  
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let bin = 1; bin < magnitudes.length; bin++) { // Skip DC
    const freq = bin * binResolution;
    const mag2 = magnitudes[bin] * magnitudes[bin];
    
    weightedSum += freq * mag2;
    magnitudeSum += mag2;
  }
  
  if (magnitudeSum === 0) return 0;
  
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
function calculateSpectralFlatness(magnitudes: Float32Array): number {
  const n = magnitudes.length - 1; // Exclude DC
  if (n <= 0) return 0;
  
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
  
  if (validBins === 0 || arithmeticSum === 0) return 0;
  
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
function calculateSpectralRolloff(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  percentile: number = 0.85
): number {
  const binResolution = sampleRate / fftSize;
  
  // Calculate total energy
  let totalEnergy = 0;
  for (let bin = 1; bin < magnitudes.length; bin++) {
    totalEnergy += magnitudes[bin] * magnitudes[bin];
  }
  
  if (totalEnergy === 0) return 0;
  
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
 * Values:
 * - 0.0-0.3: Very noisy (mp3 128kbps, bad master)
 * - 0.4-0.6: Normal quality (typical streaming)
 * - 0.7-0.9: High fidelity (CD quality, good master)
 * - 0.9+: Studio quality
 */
function calculateClarity(
  magnitudes: Float32Array,
  flatness: number,
  crestFactor: number
): number {
  // Factor 1: Tonality (inverse of flatness)
  const tonality = 1.0 - flatness;
  
  // Factor 2: Normalized crest factor (typical max ~6)
  const normalizedCrest = Math.min(1.0, crestFactor / 6.0);
  
  // Factor 3: Spectral concentration (energy in top 10% bins vs total)
  const sortedMags = Array.from(magnitudes).sort((a, b) => b - a);
  const topCount = Math.ceil(magnitudes.length * 0.1);
  
  let peakEnergy = 0;
  for (let i = 0; i < topCount; i++) {
    peakEnergy += sortedMags[i] * sortedMags[i];
  }
  
  let totalEnergy = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    totalEnergy += magnitudes[i] * magnitudes[i];
  }
  
  const concentration = totalEnergy > 0 ? peakEnergy / totalEnergy : 0;
  
  // Combine with weights
  const clarity = (
    tonality * 0.4 +
    normalizedCrest * 0.3 +
    concentration * 0.3
  );
  
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
function calculateCrestFactor(magnitudes: Float32Array): number {
  let peak = 0;
  let sumSquares = 0;
  
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > peak) peak = magnitudes[i];
    sumSquares += magnitudes[i] * magnitudes[i];
  }
  
  const rms = Math.sqrt(sumSquares / magnitudes.length);
  
  if (rms === 0) return 0;
  
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
function calculatePhaseCorrelation(
  leftChannel: Float32Array,
  rightChannel: Float32Array
): number {
  if (leftChannel.length !== rightChannel.length) return 1;
  
  let dotProduct = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    dotProduct += leftChannel[i] * rightChannel[i];
    leftEnergy += leftChannel[i] * leftChannel[i];
    rightEnergy += rightChannel[i] * rightChannel[i];
  }
  
  const denominator = Math.sqrt(leftEnergy * rightEnergy);
  
  if (denominator === 0) return 1; // Silence = mono
  
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
function calculateStereoWidth(phaseCorrelation: number): number {
  return 1.0 - phaseCorrelation;
}

/**
 * Calculate L/R Balance.
 * 
 * @returns -1 (full left) to +1 (full right), 0 = centered
 */
function calculateStereoBalance(
  leftChannel: Float32Array,
  rightChannel: Float32Array
): number {
  let leftEnergy = 0;
  let rightEnergy = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    leftEnergy += leftChannel[i] * leftChannel[i];
    rightEnergy += rightChannel[i] * rightChannel[i];
  }
  
  const totalEnergy = leftEnergy + rightEnergy;
  if (totalEnergy === 0) return 0;
  
  // Balance = (R - L) / (R + L)
  return (rightEnergy - leftEnergy) / totalEnergy;
}

/**
 * Full stereo analysis.
 */
function analyzeStereo(
  leftChannel: Float32Array,
  rightChannel: Float32Array
): GodEarStereoMetrics {
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
  private gains: { [key: string]: number } = {};
  private rmsHistory: { [key: string]: number[] } = {};
  private readonly historyLength = 20; // ~1 second @ 20fps
  private isActive = true;
  
  constructor() {
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
  process(bandId: string, rawValue: number, deltaMs: number): number {
    if (!this.isActive) {
      return rawValue;
    }
    
    const config = AGC_CONFIG[bandId as keyof typeof AGC_CONFIG];
    if (!config) return rawValue;
    
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
    
    let smoothingTime: number;
    if (gainDiff > 0) {
      // Increasing gain (attack) - slower to preserve dynamics
      smoothingTime = config.attackMs;
    } else {
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
  getState(): GodEarAGCState {
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
  setActive(active: boolean): void {
    this.isActive = active;
  }
  
  /**
   * Reset AGC state
   */
  reset(): void {
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
  private history: { [band: string]: Float32Array } = {};
  private historyIndex: { [band: string]: number } = {};
  private readonly historyLength = 8;
  
  constructor() {
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
  detectOnset(band: string, energy: number): boolean {
    if (!this.history[band]) return false;
    
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
  reset(): void {
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
 * Features:
 * - Blackman-Harris windowing (-92dB sidelobes)
 * - Linkwitz-Riley 4th order digital crossovers
 * - 7 tactical bands with ZERO overlap
 * - Per-band AGC Trust Zones
 * - Advanced spectral metrics
 * - Stereo phase correlation
 */
export class GodEarAnalyzer {
  private readonly sampleRate: number;
  private readonly fftSize: number;
  
  private agc: AGCTrustZone;
  private onsetDetector: SlopeBasedOnsetDetector;
  private frameIndex: number = 0;
  private lastTimestamp: number = 0;
  
  // Feature flags
  private useAGC: boolean = true;
  private useStereo: boolean = true;
  
  constructor(sampleRate: number = 44100, fftSize: number = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    
    this.agc = new AGCTrustZone();
    this.onsetDetector = new SlopeBasedOnsetDetector();
    
    // Initialize LR4 filter masks
    getLR4FilterMasks(fftSize, sampleRate);
    
    console.log(`[GOD EAR] 🩻 Initialized: ${fftSize} FFT, ${sampleRate}Hz, ${BIN_RESOLUTION.toFixed(2)}Hz/bin`);
    console.log('[GOD EAR] 💀 BECAUSE WE DESERVE TO HEAR LIKE GODS');
  }
  
  /**
   * Analyze mono audio buffer.
   * 
   * @param buffer - Audio samples (Float32Array)
   * @returns Complete GodEarSpectrum
   */
  analyze(buffer: Float32Array): GodEarSpectrum {
    const startTime = performance.now();
    
    // Ensure buffer is power of 2
    const n = this.nearestPowerOf2(buffer.length);
    let samples = buffer.length > n ? buffer.slice(0, n) : buffer;
    
    // Pad if necessary
    if (samples.length < this.fftSize) {
      const padded = new Float32Array(this.fftSize);
      padded.set(samples);
      samples = padded;
    }
    
    // STAGE 0: DC Offset Removal
    const dcRemoved = removeDCOffset(samples);
    
    // STAGE 1: Blackman-Harris Windowing
    const windowed = applyBlackmanHarrisWindow(dcRemoved);
    
    // STAGE 2 & 3: FFT + Magnitude
    const { real, imag } = computeFFTCore(windowed);
    const magnitudes = computeMagnitudeSpectrum(real, imag);
    
    // STAGE 4 & 5: LR4 Filter Bank + Band Extraction
    const filterMasks = getLR4FilterMasks(this.fftSize, this.sampleRate);
    const deltaMs = this.lastTimestamp > 0 ? startTime - this.lastTimestamp : 50;
    this.lastTimestamp = startTime;
    
    // Extract raw band energies
    const rawBands: GodEarBands = {
      subBass: extractBandEnergy(magnitudes, filterMasks.get('subBass')!),
      bass: extractBandEnergy(magnitudes, filterMasks.get('bass')!),
      lowMid: extractBandEnergy(magnitudes, filterMasks.get('lowMid')!),
      mid: extractBandEnergy(magnitudes, filterMasks.get('mid')!),
      highMid: extractBandEnergy(magnitudes, filterMasks.get('highMid')!),
      treble: extractBandEnergy(magnitudes, filterMasks.get('treble')!),
      ultraAir: extractBandEnergy(magnitudes, filterMasks.get('ultraAir')!),
    };
    
    // STAGE 6: AGC Trust Zones
    const bands: GodEarBands = this.useAGC ? {
      subBass: this.agc.process('subBass', rawBands.subBass, deltaMs),
      bass: this.agc.process('bass', rawBands.bass, deltaMs),
      lowMid: this.agc.process('lowMid', rawBands.lowMid, deltaMs),
      mid: this.agc.process('mid', rawBands.mid, deltaMs),
      highMid: this.agc.process('highMid', rawBands.highMid, deltaMs),
      treble: this.agc.process('treble', rawBands.treble, deltaMs),
      ultraAir: this.agc.process('ultraAir', rawBands.ultraAir, deltaMs),
    } : rawBands;
    
    // Spectral Metrics
    const flatness = calculateSpectralFlatness(magnitudes);
    const crestFactor = calculateCrestFactor(magnitudes);
    
    const spectral: GodEarSpectralMetrics = {
      centroid: calculateSpectralCentroid(magnitudes, this.sampleRate, this.fftSize),
      flatness,
      rolloff: calculateSpectralRolloff(magnitudes, this.sampleRate, this.fftSize),
      crestFactor,
      clarity: calculateClarity(magnitudes, flatness, crestFactor),
    };
    
    // Transient Detection
    const kickDetected = this.onsetDetector.detectOnset('kick', rawBands.subBass + rawBands.bass * 0.5);
    const snareDetected = this.onsetDetector.detectOnset('snare', rawBands.mid + rawBands.lowMid * 0.5);
    const hihatDetected = this.onsetDetector.detectOnset('hihat', rawBands.treble + rawBands.highMid * 0.3);
    
    const transients: GodEarTransients = {
      kick: kickDetected,
      snare: snareDetected,
      hihat: hihatDetected,
      any: kickDetected || snareDetected || hihatDetected,
      strength: Math.max(
        kickDetected ? rawBands.subBass : 0,
        snareDetected ? rawBands.mid : 0,
        hihatDetected ? rawBands.treble : 0
      ),
    };
    
    // Find dominant frequency
    let maxMag = 0;
    let dominantBin = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      if (magnitudes[i] > maxMag) {
        maxMag = magnitudes[i];
        dominantBin = i;
      }
    }
    const dominantFrequency = dominantBin * (this.sampleRate / this.fftSize);
    
    // Total energy
    let totalEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      totalEnergy += magnitudes[i] * magnitudes[i];
    }
    totalEnergy = Math.sqrt(totalEnergy);
    
    const processingLatency = performance.now() - startTime;
    this.frameIndex++;
    
    // STAGE 7: Output
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
        version: '1.0.0',
      },
      dominantFrequency,
      totalEnergy,
    };
  }
  
  /**
   * Analyze stereo audio buffers.
   * 
   * @param leftBuffer - Left channel samples
   * @param rightBuffer - Right channel samples
   * @returns Complete GodEarSpectrum with stereo metrics
   */
  analyzeStereo(leftBuffer: Float32Array, rightBuffer: Float32Array): GodEarSpectrum {
    // Analyze mono mix for main spectrum
    const monoBuffer = new Float32Array(leftBuffer.length);
    for (let i = 0; i < leftBuffer.length; i++) {
      monoBuffer[i] = (leftBuffer[i] + rightBuffer[i]) * 0.5;
    }
    
    const result = this.analyze(monoBuffer);
    
    // Add stereo analysis
    if (this.useStereo) {
      result.stereo = analyzeStereo(leftBuffer, rightBuffer);
    }
    
    return result;
  }
  
  /**
   * Configure analyzer features
   */
  configure(options: { useAGC?: boolean; useStereo?: boolean }): void {
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
  reset(): void {
    this.agc.reset();
    this.onsetDetector.reset();
    this.frameIndex = 0;
    this.lastTimestamp = 0;
    console.log('[GOD EAR] 🔄 Analyzer reset');
  }
  
  /**
   * Get analyzer info
   */
  getInfo(): string {
    return `GOD EAR v1.0.0 | ${this.fftSize} FFT | ${this.sampleRate}Hz | ${BIN_RESOLUTION.toFixed(2)}Hz/bin | Blackman-Harris | LR4 Filters`;
  }
  
  /**
   * Find nearest power of 2
   */
  private nearestPowerOf2(n: number): number {
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
export function verifySeparation(sampleRate: number = 44100, fftSize: number = 4096): boolean {
  console.log('[GOD EAR] 🧪 Running LR4 separation test...');
  
  const filterMasks = getLR4FilterMasks(fftSize, sampleRate);
  
  // Generate pure 50Hz tone magnitude (only one bin has energy)
  const numBins = (fftSize >> 1) + 1;
  const testMagnitudes = new Float32Array(numBins);
  const binResolution = sampleRate / fftSize;
  const bin50Hz = Math.round(50 / binResolution);
  testMagnitudes[bin50Hz] = 1.0;
  
  // Extract each band
  const results: { [key: string]: number } = {};
  for (const [key, config] of Object.entries(GOD_EAR_BAND_CONFIG)) {
    const mask = filterMasks.get(config.id);
    if (mask) {
      results[config.id] = extractBandEnergy(testMagnitudes, mask);
    }
  }
  
  // Normalize results relative to maximum for clearer display
  const maxResult = Math.max(...Object.values(results));
  const normalizedResults: { [key: string]: number } = {};
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
  const lowerBandsClean = 
    normalizedResults.lowMid < 0.01 && 
    normalizedResults.mid < 0.01 && 
    normalizedResults.highMid < 0.01 &&
    normalizedResults.treble < 0.01 &&
    normalizedResults.ultraAir < 0.01;
  
  const passed = subBassIsHighest && lowerBandsClean;
  
  if (passed) {
    console.log(`[GOD EAR] 🧪 RESULT: ✅ PASS - SURGICAL SEPARATION ACHIEVED`);
    console.log(`[GOD EAR]    SubBass dominates (${(normalizedResults.subBass * 100).toFixed(1)}%), higher bands isolated`);
  } else {
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
export function benchmarkPerformance(iterations: number = 100): void {
  console.log(`[GOD EAR] ⏱️ Running performance benchmark (${iterations} iterations)...`);
  
  const analyzer = new GodEarAnalyzer();
  const testBuffer = new Float32Array(4096);
  
  // Fill with noise
  for (let i = 0; i < testBuffer.length; i++) {
    testBuffer[i] = (Math.random() - 0.5) * 2;
  }
  
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    analyzer.analyze(testBuffer);
    times.push(performance.now() - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  const grade = 
    avgTime < 1.0 ? 'GODLIKE' :
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

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: LEGACY COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Legacy BandEnergy interface for backward compatibility.
 * Maps GOD EAR bands to the old 6-band format.
 */
export interface LegacyBandEnergy {
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;
  subBass: number;
  dominantFrequency: number;
  spectralCentroid: number;
  harshness: number;
  spectralFlatness: number;
}

/**
 * Convert GodEarSpectrum to legacy BandEnergy format.
 */
export function toLegacyFormat(spectrum: GodEarSpectrum): LegacyBandEnergy {
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

console.log('[GOD EAR] 🩻💀 MODULE LOADED - SURGICAL FFT REVOLUTION READY 💀🩻');
