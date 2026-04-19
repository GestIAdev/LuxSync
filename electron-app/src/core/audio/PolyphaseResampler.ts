// WAVE 3402: Polyphase FIR Resampler
//
// Remuestreo matemático limpio desde cualquier sample rate a 44100 Hz.
// Ratio canónico 48000→44100: L/M = 147/160
//
// Arquitectura: Polyphase decomposition del filtro FIR anti-aliasing.
// - Sin interpolación lineal (causa aliasing inaceptable para GodEarFFT)
// - Coeficientes pre-calculados deterministas (Axioma Anti-Simulación)
// - Latencia < 0.2ms
// - Zero allocation en hot path

const FILTER_TAPS_PER_PHASE = 16   // Taps por subfiltro polyphase
const CUTOFF_RATIO = 0.95          // Frecuencia de corte: 95% de Nyquist inferior
const KAISER_BETA = 5.0            // Beta de ventana Kaiser para -60dB sidelobe

// ============================================
// Kaiser Window — Zero-order Bessel I₀(x)
// ============================================

function besselI0(x: number): number {
  // Polynomial approximation of modified Bessel function I₀
  // Abramowitz & Stegun 9.8.1 — converges for all x
  let sum = 1.0
  let term = 1.0
  const halfX = x * 0.5

  for (let k = 1; k <= 25; k++) {
    term *= (halfX / k) * (halfX / k)
    sum += term
    if (term < 1e-15 * sum) break // Convergence
  }

  return sum
}

function kaiserWindow(n: number, N: number, beta: number): number {
  const alpha = (N - 1) / 2
  const ratio = (n - alpha) / alpha
  const arg = beta * Math.sqrt(1.0 - ratio * ratio)
  return besselI0(arg) / besselI0(beta)
}

// ============================================
// Sinc function
// ============================================

function sinc(x: number): number {
  if (Math.abs(x) < 1e-12) return 1.0
  const px = Math.PI * x
  return Math.sin(px) / px
}

// ============================================
// Pre-calculate polyphase coefficient table
// ============================================

interface PolyphaseTable {
  readonly L: number                     // Upsampling factor
  readonly M: number                     // Downsampling factor
  readonly tapsPerPhase: number
  readonly coefficients: Float64Array[]   // L phases, each with tapsPerPhase coeffs
}

function computeGCD(a: number, b: number): number {
  while (b !== 0) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

function buildPolyphaseTable(inputRate: number, outputRate: number): PolyphaseTable {
  // Compute rational ratio: outputRate/inputRate = L/M
  const gcd = computeGCD(outputRate, inputRate)
  const L = outputRate / gcd  // Upsampling factor
  const M = inputRate / gcd   // Downsampling factor

  const totalTaps = L * FILTER_TAPS_PER_PHASE
  const cutoff = CUTOFF_RATIO * Math.min(1.0 / L, 1.0 / M)

  // Build the prototype lowpass FIR filter (length = totalTaps)
  // then decompose into polyphase components
  const coefficients: Float64Array[] = new Array(L)

  for (let phase = 0; phase < L; phase++) {
    coefficients[phase] = new Float64Array(FILTER_TAPS_PER_PHASE)

    let normSum = 0.0
    for (let tap = 0; tap < FILTER_TAPS_PER_PHASE; tap++) {
      // Index into the full prototype filter
      const n = tap * L + phase
      const center = (totalTaps - 1) / 2

      // Windowed sinc
      const s = sinc(2.0 * cutoff * (n - center))
      const w = kaiserWindow(n, totalTaps, KAISER_BETA)
      const coeff = 2.0 * cutoff * L * s * w

      coefficients[phase][tap] = coeff
      normSum += coeff
    }

    // Normalize each phase so DC gain = 1.0
    if (Math.abs(normSum) > 1e-15) {
      for (let tap = 0; tap < FILTER_TAPS_PER_PHASE; tap++) {
        coefficients[phase][tap] /= normSum
      }
    }
  }

  return { L, M, tapsPerPhase: FILTER_TAPS_PER_PHASE, coefficients }
}

// ============================================
// PolyphaseResampler — Stateful, zero-alloc hot path
// ============================================

export class PolyphaseResampler {
  private readonly table: PolyphaseTable
  private readonly history: Float64Array      // Circular delay line
  private readonly historyLength: number
  private historyIndex: number = 0
  private inputPhase: number = 0              // Current position in L/M ratio

  readonly inputRate: number
  readonly outputRate: number
  readonly latencySamples: number

  constructor(inputRate: number, outputRate: number) {
    if (inputRate <= 0 || outputRate <= 0) {
      throw new Error(`PolyphaseResampler: invalid rates ${inputRate} → ${outputRate}`)
    }

    this.inputRate = inputRate
    this.outputRate = outputRate
    this.table = buildPolyphaseTable(inputRate, outputRate)

    // History buffer for FIR convolution
    this.historyLength = FILTER_TAPS_PER_PHASE
    this.history = new Float64Array(this.historyLength)

    // Latency = half the filter length in output samples
    this.latencySamples = Math.floor(
      (this.table.tapsPerPhase * this.table.L) / (2 * this.table.M)
    )
  }

  /**
   * Get the exact output length for a given input length.
   * Deterministic — no rounding errors accumulate.
   */
  getOutputLength(inputLength: number): number {
    const { L, M } = this.table
    let count = 0
    let phase = this.inputPhase

    for (let i = 0; i < inputLength; i++) {
      phase += L
      while (phase >= M) {
        phase -= M
        count++
      }
    }

    return count
  }

  /**
   * Resample a block of Float32 audio samples.
   *
   * @param input  Source samples at inputRate
   * @param output Pre-allocated output buffer (use getOutputLength to size)
   * @returns Number of output samples written
   */
  process(input: Float32Array, output: Float32Array): number {
    const { L, M, coefficients, tapsPerPhase } = this.table
    const history = this.history
    const hLen = this.historyLength
    let hIdx = this.historyIndex
    let phase = this.inputPhase
    let outIdx = 0

    for (let i = 0; i < input.length; i++) {
      // Push input sample into circular history
      history[hIdx] = input[i]
      hIdx = (hIdx + 1) % hLen

      // Check how many output samples to produce for this input
      phase += L
      while (phase >= M) {
        phase -= M

        // Compute the output polyphase index
        const phaseIdx = phase % L
        const phaseCoeffs = coefficients[phaseIdx]

        // FIR convolution with polyphase coefficients
        let sample = 0.0
        let histPos = (hIdx - 1 + hLen) % hLen

        for (let t = 0; t < tapsPerPhase; t++) {
          sample += history[histPos] * phaseCoeffs[t]
          histPos = (histPos - 1 + hLen) % hLen
        }

        if (outIdx < output.length) {
          output[outIdx++] = sample
        }
      }
    }

    // Save state for next block (stateful for continuous streaming)
    this.historyIndex = hIdx
    this.inputPhase = phase

    return outIdx
  }

  /**
   * Reset internal state (after discontinuity or source change)
   */
  reset(): void {
    this.history.fill(0)
    this.historyIndex = 0
    this.inputPhase = 0
  }

  /**
   * True if input rate matches output rate (no resampling needed)
   */
  get isPassthrough(): boolean {
    return this.table.L === 1 && this.table.M === 1
  }

  /**
   * Latency in milliseconds
   */
  get latencyMs(): number {
    return (this.latencySamples / this.outputRate) * 1000
  }

  /**
   * Get the rational ratio representation
   */
  get ratio(): { L: number; M: number } {
    return { L: this.table.L, M: this.table.M }
  }
}

// ============================================
// Factory — Cached resampler instances per rate pair
// ============================================

const resamplerCache = new Map<string, PolyphaseResampler>()

/**
 * Get or create a PolyphaseResampler for a given rate conversion.
 * Returns null if no resampling is needed (rates match).
 */
export function getResampler(
  inputRate: number,
  outputRate: number
): PolyphaseResampler | null {
  if (inputRate === outputRate) return null

  const key = `${inputRate}:${outputRate}`
  let resampler = resamplerCache.get(key)
  if (!resampler) {
    resampler = new PolyphaseResampler(inputRate, outputRate)
    resamplerCache.set(key, resampler)
  }
  return resampler
}
