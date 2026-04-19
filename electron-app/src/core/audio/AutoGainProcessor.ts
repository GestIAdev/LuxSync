// WAVE 3402: Auto-Gain Processor (Pre-FFT)
//
// Envolvente lenta para normalizar niveles antes del análisis FFT.
// Evita que GodEarFFT reciba señales demasiado bajas o saturadas.
//
// Specs del Blueprint:
//   - RMS Window: 500ms (22050 samples @ 44100Hz)
//   - Target: -18 dBFS (0.12589 linear)
//   - Attack: 200ms (ganancia sube lento — evita bombeo)
//   - Release: 2000ms (ganancia baja muy lento — respeta la música)
//   - Gain Range: -12 dB a +24 dB
//   - Hard Clamp: [-1.0, 1.0]
//
// Zero allocation en hot path. Determinista.

const TARGET_DBFS = -18
const TARGET_LINEAR = Math.pow(10, TARGET_DBFS / 20)  // 0.12589...

const MIN_GAIN_DB = -12
const MAX_GAIN_DB = 24
const MIN_GAIN_LINEAR = Math.pow(10, MIN_GAIN_DB / 20)  // 0.25119...
const MAX_GAIN_LINEAR = Math.pow(10, MAX_GAIN_DB / 20)  // 15.8489...

const ATTACK_TIME_S = 0.2      // 200ms
const RELEASE_TIME_S = 2.0     // 2000ms
const RMS_WINDOW_S = 0.5       // 500ms

// Minimum RMS to avoid division by near-zero (silence floor)
const RMS_FLOOR = 1e-8  // ~ -160 dBFS

export interface AutoGainDiagnostics {
  readonly currentGainDb: number
  readonly currentRmsDb: number
  readonly targetDb: number
  readonly isActive: boolean
}

export class AutoGainProcessor {
  private readonly sampleRate: number
  private readonly rmsWindowSize: number
  private readonly attackAlpha: number
  private readonly releaseAlpha: number

  // RMS accumulator — circular buffer of squared samples
  private readonly rmsBuffer: Float64Array
  private rmsWriteIndex: number = 0
  private rmsSumOfSquares: number = 0
  private rmsSamplesAccumulated: number = 0

  // Smoothed gain envelope
  private currentGain: number = 1.0

  // State tracking
  private isActive: boolean = false

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate

    // RMS window: 500ms worth of samples
    this.rmsWindowSize = Math.round(sampleRate * RMS_WINDOW_S)
    this.rmsBuffer = new Float64Array(this.rmsWindowSize)

    // Envelope smoothing coefficients (exponential one-pole filter)
    // alpha = 1 - exp(-1 / (sampleRate * timeConstant))
    this.attackAlpha = 1 - Math.exp(-1 / (sampleRate * ATTACK_TIME_S))
    this.releaseAlpha = 1 - Math.exp(-1 / (sampleRate * RELEASE_TIME_S))
  }

  /**
   * Process a buffer of audio samples in-place.
   * Applies gain normalization targeting -18 dBFS.
   *
   * @param samples Audio buffer to process (mutated in-place)
   */
  process(samples: Float32Array): void {
    const rmsWin = this.rmsWindowSize
    const rmsBuf = this.rmsBuffer
    const atkAlpha = this.attackAlpha
    const relAlpha = this.releaseAlpha

    for (let i = 0; i < samples.length; i++) {
      const raw = samples[i]
      const squared = raw * raw

      // Update circular RMS buffer
      if (this.rmsSamplesAccumulated >= rmsWin) {
        // Remove the oldest sample's contribution
        this.rmsSumOfSquares -= rmsBuf[this.rmsWriteIndex]
      } else {
        this.rmsSamplesAccumulated++
      }

      // Add new sample
      rmsBuf[this.rmsWriteIndex] = squared
      this.rmsSumOfSquares += squared
      this.rmsWriteIndex = (this.rmsWriteIndex + 1) % rmsWin

      // Protect against floating point drift going negative
      if (this.rmsSumOfSquares < 0) this.rmsSumOfSquares = 0

      // Calculate RMS
      const count = Math.min(this.rmsSamplesAccumulated, rmsWin)
      const rms = Math.sqrt(this.rmsSumOfSquares / count)

      // Calculate desired gain
      let desiredGain: number
      if (rms < RMS_FLOOR) {
        // Signal is silence — hold current gain, don't pump
        desiredGain = this.currentGain
      } else {
        desiredGain = TARGET_LINEAR / rms
      }

      // Clamp to gain range
      if (desiredGain < MIN_GAIN_LINEAR) desiredGain = MIN_GAIN_LINEAR
      if (desiredGain > MAX_GAIN_LINEAR) desiredGain = MAX_GAIN_LINEAR

      // Apply envelope smoothing (one-pole filter)
      // Attack when gain goes UP, release when gain goes DOWN
      const alpha = (desiredGain > this.currentGain) ? atkAlpha : relAlpha
      this.currentGain += alpha * (desiredGain - this.currentGain)

      // Apply gain and hard clamp
      let output = raw * this.currentGain
      if (output > 1.0) output = 1.0
      if (output < -1.0) output = -1.0

      samples[i] = output
    }

    this.isActive = true
  }

  /**
   * Reset the processor state (after source change or discontinuity)
   */
  reset(): void {
    this.rmsBuffer.fill(0)
    this.rmsWriteIndex = 0
    this.rmsSumOfSquares = 0
    this.rmsSamplesAccumulated = 0
    this.currentGain = 1.0
    this.isActive = false
  }

  /**
   * Get current diagnostics
   */
  getDiagnostics(): AutoGainDiagnostics {
    const count = Math.min(this.rmsSamplesAccumulated, this.rmsWindowSize)
    const rms = count > 0 ? Math.sqrt(this.rmsSumOfSquares / count) : 0

    return {
      currentGainDb: 20 * Math.log10(Math.max(this.currentGain, 1e-15)),
      currentRmsDb: rms > RMS_FLOOR ? 20 * Math.log10(rms) : -160,
      targetDb: TARGET_DBFS,
      isActive: this.isActive,
    }
  }

  /**
   * Current gain in linear scale
   */
  get gainLinear(): number {
    return this.currentGain
  }

  /**
   * Current gain in dB
   */
  get gainDb(): number {
    return 20 * Math.log10(Math.max(this.currentGain, 1e-15))
  }
}
