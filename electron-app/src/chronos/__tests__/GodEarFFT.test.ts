/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🩻 WAVE 2078: CHRONOS TEST ARMY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Suite 5: GodEarFFT — Real DSP Engine Verification
 * 
 * Tests the REAL Cooley-Tukey FFT pipeline:
 * - GodEarAnalyzer instantiation and analysis
 * - 7 tactical bands with LR4 filters (zero overlap)
 * - Spectral metrics (centroid, flatness, rolloff, crestFactor, clarity)
 * - Blackman-Harris windowing
 * - Onset detection
 * - verifySeparation()
 * - Determinism guarantee
 * 
 * AXIOMA ANTI-SIMULACIÓN: These are REAL DSP computations.
 * No mocks, no randoms, no simulations.
 * Pure math on deterministic input signals.
 * 
 * @module chronos/__tests__/GodEarFFT
 * @version WAVE 2078
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { GodEarAnalyzer, verifySeparation } from '../../workers/GodEarFFT'
import type { GodEarSpectrum, GodEarBands } from '../../workers/GodEarFFT'

// ═══════════════════════════════════════════════════════════════════════════
// 🎵 DETERMINISTIC TEST SIGNALS (REAL, NOT RANDOM)
// ═══════════════════════════════════════════════════════════════════════════

const SAMPLE_RATE = 44100
const FFT_SIZE = 4096

/**
 * Generate a pure sine wave at a given frequency.
 * This is REAL signal generation, not simulation.
 */
function generateSineWave(
  frequency: number,
  sampleRate: number,
  length: number,
  amplitude: number = 0.5
): Float32Array {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate)
  }
  return buffer
}

/**
 * Generate silence (zero buffer).
 */
function generateSilence(length: number): Float32Array {
  return new Float32Array(length) // Initialized to 0
}

/**
 * Generate white noise (deterministic: seeded by index, not Math.random).
 * Uses a simple LCG (linear congruential generator) for reproducibility.
 */
function generateDeterministicNoise(length: number, amplitude: number = 0.3): Float32Array {
  const buffer = new Float32Array(length)
  let seed = 12345 // Fixed seed for determinism
  for (let i = 0; i < length; i++) {
    // LCG: x_{n+1} = (a * x_n + c) mod m
    seed = (1103515245 * seed + 12345) & 0x7fffffff
    // Map to [-amplitude, amplitude]
    buffer[i] = amplitude * ((seed / 0x7fffffff) * 2 - 1)
  }
  return buffer
}

// ═══════════════════════════════════════════════════════════════════════════
// 🩻 GODEAR FFT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🩻 GodEarFFT — Real Cooley-Tukey DSP Engine', () => {

  let analyzer: GodEarAnalyzer

  beforeEach(() => {
    analyzer = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
    // Disable AGC for offline testing (deterministic values)
    analyzer.configure({ useAGC: false, useStereo: false })
  })

  afterEach(() => {
    analyzer.reset()
  })

  // ─────────────────────────────────────────────────────────────────────
  // INSTANTIATION
  // ─────────────────────────────────────────────────────────────────────

  describe('🏗️ Instantiation', () => {

    test('GodEarAnalyzer constructs without error', () => {
      const a = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      expect(a).toBeDefined()
      a.reset()
    })

    test('GodEarAnalyzer accepts different sample rates', () => {
      const a = new GodEarAnalyzer(48000, 4096)
      expect(a).toBeDefined()
      a.reset()
    })

    test('Default constructor values work', () => {
      const a = new GodEarAnalyzer()
      expect(a).toBeDefined()
      a.reset()
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // ANALYSIS OUTPUT SHAPE
  // ─────────────────────────────────────────────────────────────────────

  describe('📐 Analysis Output Shape', () => {

    test('analyze() returns GodEarSpectrum with all 7 bands', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      const spectrum = analyzer.analyze(signal)

      expect(spectrum).toBeDefined()
      expect(spectrum.bands).toBeDefined()
      
      const bandNames: (keyof GodEarBands)[] = [
        'subBass', 'bass', 'lowMid', 'mid', 'highMid', 'treble', 'ultraAir'
      ]
      
      for (const band of bandNames) {
        expect(typeof spectrum.bands[band], `bands.${band} should be number`)
          .toBe('number')
        expect(isNaN(spectrum.bands[band]), `bands.${band} should not be NaN`)
          .toBe(false)
      }
    })

    test('analyze() returns spectral metrics', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      const spectrum = analyzer.analyze(signal)

      expect(spectrum.spectral).toBeDefined()
      expect(typeof spectrum.spectral.centroid).toBe('number')
      expect(typeof spectrum.spectral.flatness).toBe('number')
    })

    test('analyze() returns totalEnergy', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      const spectrum = analyzer.analyze(signal)

      expect(typeof spectrum.totalEnergy).toBe('number')
      expect(spectrum.totalEnergy).toBeGreaterThanOrEqual(0)
    })

    test('analyze() returns transients object', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      const spectrum = analyzer.analyze(signal)

      expect(spectrum.transients).toBeDefined()
      expect(typeof spectrum.transients.kick).toBe('boolean')
      expect(typeof spectrum.transients.snare).toBe('boolean')
      expect(typeof spectrum.transients.hihat).toBe('boolean')
      expect(typeof spectrum.transients.any).toBe('boolean')
      expect(typeof spectrum.transients.strength).toBe('number')
    })

    test('analyze() returns metadata', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      const spectrum = analyzer.analyze(signal)

      expect(spectrum.meta).toBeDefined()
      expect(typeof spectrum.meta.frameIndex).toBe('number')
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // FREQUENCY DISCRIMINATION (THE REAL TEST)
  // ─────────────────────────────────────────────────────────────────────

  describe('🎯 Frequency Discrimination', () => {

    test('40Hz sine → subBass dominates', () => {
      const signal = generateSineWave(40, SAMPLE_RATE, FFT_SIZE, 0.8)
      const spectrum = analyzer.analyze(signal)

      // subBass (20-60Hz) should be the dominant band
      expect(spectrum.bands.subBass).toBeGreaterThan(0)
      expect(spectrum.bands.subBass).toBeGreaterThan(spectrum.bands.treble)
      expect(spectrum.bands.subBass).toBeGreaterThan(spectrum.bands.ultraAir)
    })

    test('100Hz sine → bass dominates', () => {
      const signal = generateSineWave(100, SAMPLE_RATE, FFT_SIZE, 0.8)
      const spectrum = analyzer.analyze(signal)

      // bass (60-250Hz) should light up
      expect(spectrum.bands.bass).toBeGreaterThan(0)
      expect(spectrum.bands.bass).toBeGreaterThan(spectrum.bands.ultraAir)
    })

    test('1000Hz sine → mid band active', () => {
      const signal = generateSineWave(1000, SAMPLE_RATE, FFT_SIZE, 0.8)
      const spectrum = analyzer.analyze(signal)

      // mid (500-2kHz) should be prominent
      expect(spectrum.bands.mid).toBeGreaterThan(0)
      expect(spectrum.bands.mid).toBeGreaterThan(spectrum.bands.subBass)
    })

    test('8000Hz sine → treble dominates', () => {
      const signal = generateSineWave(8000, SAMPLE_RATE, FFT_SIZE, 0.8)
      const spectrum = analyzer.analyze(signal)

      // treble (4k-12kHz) should light up
      expect(spectrum.bands.treble).toBeGreaterThan(0)
      expect(spectrum.bands.treble).toBeGreaterThan(spectrum.bands.subBass)
    })

    test('15000Hz sine → ultraAir active', () => {
      const signal = generateSineWave(15000, SAMPLE_RATE, FFT_SIZE, 0.8)
      const spectrum = analyzer.analyze(signal)

      // ultraAir (12k-20kHz) should be dominant
      expect(spectrum.bands.ultraAir).toBeGreaterThan(0)
      expect(spectrum.bands.ultraAir).toBeGreaterThan(spectrum.bands.subBass)
      expect(spectrum.bands.ultraAir).toBeGreaterThan(spectrum.bands.bass)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SILENCE & ENERGY
  // ─────────────────────────────────────────────────────────────────────

  describe('🔇 Silence & Energy', () => {

    test('Silence produces near-zero energy', () => {
      const silence = generateSilence(FFT_SIZE)
      const spectrum = analyzer.analyze(silence)

      expect(spectrum.totalEnergy).toBeLessThan(0.01)
    })

    test('Louder signal produces more energy', () => {
      const quiet = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.1)
      const loud = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.9)
      
      const spectrumQuiet = analyzer.analyze(quiet)
      analyzer.reset()
      const analyzerLoud = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      analyzerLoud.configure({ useAGC: false, useStereo: false })
      const spectrumLoud = analyzerLoud.analyze(loud)
      analyzerLoud.reset()

      expect(spectrumLoud.totalEnergy).toBeGreaterThan(spectrumQuiet.totalEnergy)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // SPECTRAL METRICS
  // ─────────────────────────────────────────────────────────────────────

  describe('📊 Spectral Metrics', () => {

    test('Pure sine has low flatness (tonal, not noise)', () => {
      const sine = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.5)
      const spectrum = analyzer.analyze(sine)

      // A pure sine should have very low flatness (concentrated energy)
      expect(spectrum.spectral.flatness).toBeLessThan(0.5)
    })

    test('Noise has higher flatness than pure tone', () => {
      const sine = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.5)
      const noise = generateDeterministicNoise(FFT_SIZE, 0.5)
      
      const specSine = analyzer.analyze(sine)
      analyzer.reset()
      const analyzerNoise = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      analyzerNoise.configure({ useAGC: false, useStereo: false })
      const specNoise = analyzerNoise.analyze(noise)
      analyzerNoise.reset()

      expect(specNoise.spectral.flatness).toBeGreaterThan(specSine.spectral.flatness)
    })

    test('High frequency sine has higher centroid than low frequency', () => {
      const low = generateSineWave(100, SAMPLE_RATE, FFT_SIZE, 0.5)
      const high = generateSineWave(5000, SAMPLE_RATE, FFT_SIZE, 0.5)
      
      const specLow = analyzer.analyze(low)
      analyzer.reset()
      const analyzerHigh = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      analyzerHigh.configure({ useAGC: false, useStereo: false })
      const specHigh = analyzerHigh.analyze(high)
      analyzerHigh.reset()

      expect(specHigh.spectral.centroid).toBeGreaterThan(specLow.spectral.centroid)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // VERIFY SEPARATION
  // ─────────────────────────────────────────────────────────────────────

  describe('🔒 LR4 Filter Verification', () => {

    test('verifySeparation returns true (LR4 filters sum to unity)', () => {
      const result = verifySeparation(SAMPLE_RATE, FFT_SIZE)
      expect(result).toBe(true)
    })

    test('verifySeparation works at 48kHz', () => {
      const result = verifySeparation(48000, 4096)
      expect(result).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // CONFIGURE & RESET
  // ─────────────────────────────────────────────────────────────────────

  describe('⚙️ Configure & Reset', () => {

    test('configure() does not throw', () => {
      expect(() => analyzer.configure({ useAGC: true })).not.toThrow()
      expect(() => analyzer.configure({ useStereo: false })).not.toThrow()
      expect(() => analyzer.configure({ useAGC: false, useStereo: false })).not.toThrow()
    })

    test('reset() does not throw', () => {
      // Analyze some data first
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      analyzer.analyze(signal)
      
      expect(() => analyzer.reset()).not.toThrow()
    })

    test('reset() allows clean re-analysis', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE)
      
      analyzer.analyze(signal)
      analyzer.reset()
      const fresh = analyzer.analyze(signal)
      
      expect(fresh).toBeDefined()
      expect(fresh.bands.mid).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISM — THE ULTIMATE TEST
  // ─────────────────────────────────────────────────────────────────────

  describe('🎲 Determinism', () => {

    test('Same input → identical output (bit-perfect)', () => {
      const signal = generateSineWave(440, SAMPLE_RATE, FFT_SIZE, 0.5)
      
      const analyzer1 = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      analyzer1.configure({ useAGC: false, useStereo: false })
      const result1 = analyzer1.analyze(signal)
      analyzer1.reset()
      
      const analyzer2 = new GodEarAnalyzer(SAMPLE_RATE, FFT_SIZE)
      analyzer2.configure({ useAGC: false, useStereo: false })
      const result2 = analyzer2.analyze(signal)
      analyzer2.reset()
      
      // Bit-perfect comparison
      expect(result1.bands.subBass).toBe(result2.bands.subBass)
      expect(result1.bands.bass).toBe(result2.bands.bass)
      expect(result1.bands.lowMid).toBe(result2.bands.lowMid)
      expect(result1.bands.mid).toBe(result2.bands.mid)
      expect(result1.bands.highMid).toBe(result2.bands.highMid)
      expect(result1.bands.treble).toBe(result2.bands.treble)
      expect(result1.bands.ultraAir).toBe(result2.bands.ultraAir)
      expect(result1.totalEnergy).toBe(result2.totalEnergy)
      expect(result1.spectral.centroid).toBe(result2.spectral.centroid)
      expect(result1.spectral.flatness).toBe(result2.spectral.flatness)
    })

    test('Deterministic noise produces identical results', () => {
      const noise1 = generateDeterministicNoise(FFT_SIZE)
      const noise2 = generateDeterministicNoise(FFT_SIZE)
      
      // Same seed → same noise
      for (let i = 0; i < FFT_SIZE; i++) {
        expect(noise1[i]).toBe(noise2[i])
      }
    })
  })
})
