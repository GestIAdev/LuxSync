/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 GODEAR BPM TRACKER — AUTOCORRELATION ENGINE v3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2122.3: TEMPORAL UPSAMPLING — THE NYQUIST FIX
 *
 * WAVE 2122.2 POSTMORTEM:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  AGC decompensation eliminated the ~95 BPM AGC pumping artifact.   │
 * │  But production now reads ~180 BPM on 126 BPM music.              │
 * │                                                                      │
 * │  AUTOCORR RAW telemetry showed:                                     │
 * │    L7(185bpm)=0.623  ← DOMINANT (10 of 13 scans)                  │
 * │    L10(129bpm)=0.142 ← REAL BEAT (barely visible)                 │
 * │    L14(92bpm)=0.369  ← sub-harmonic                               │
 * │                                                                      │
 * │  ROOT CAUSE: At 46.4ms/frame, lagRange=[6,19] = only 14 lags.    │
 * │  126 BPM → lag 10.26. Each lag covers ~15 BPM. L7 sees the        │
 * │  half-period modulation more clearly than L10 sees the beat.       │
 * │  Parabolic interpolation helps WITHIN a peak but can't rescue     │
 * │  a peak that's INVISIBLE because the lag grid is too coarse.      │
 * │                                                                      │
 * │  MATH: 14 lags for 70-190 BPM = ~8.6 BPM/lag resolution.        │
 * │  That's like measuring temperature with a 9°C thermometer.        │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * THE FIX: TEMPORAL UPSAMPLING 4×
 *
 * Instead of computing autocorrelation on 1 energy sample per frame,
 * we linearly interpolate the energy buffer 4× before correlating.
 *
 * Before: 130 samples, 46.4ms/sample, lags [6,19] = 14 points
 * After:  520 samples, 11.6ms/virtual-sample, lags [24,76] = 53 points
 *
 * Resolution improvement:
 *   126 BPM: lag 10.26 (±7 BPM per bin) → lag 41.04 (±1.7 BPM per bin)
 *
 * Linear interpolation is mathematically valid because the energy signal
 * is already band-limited (one sample per 46.4ms FFT frame). The
 * Nyquist frequency of the original signal is ~10.8 Hz, well above
 * the ~2 Hz beat frequency we're detecting.
 *
 * @author PunkOpus
 * @wave 2122.3
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GodEarBPMResult {
  /** Stable BPM (smoothed) */
  bpm: number
  /** 0-1: Autocorrelation peak strength */
  confidence: number
  /** Number of energy samples accumulated in the analysis window */
  kickCount: number
  /** Was a beat detected THIS frame? (phase crossing) */
  kickDetected: boolean
  /** Beat phase 0-1 (position within current beat cycle) */
  beatPhase: number
}

/** Internal: a detected peak in the autocorrelation function */
interface AutocorrPeak {
  /** Integer lag of the peak */
  lag: number
  /** Interpolated lag (sub-sample precision via parabolic fit) */
  interpolatedLag: number
  /** Normalized correlation strength at this peak */
  correlation: number
  /** BPM corresponding to the interpolated lag */
  bpm: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Duration of the analysis window in seconds.
 *  6 seconds captures ~7-8 beats at 126 BPM — enough for solid correlation. */
const WINDOW_SECONDS = 6

/** Minimum BPM to scan. Below this is not dance music. */
const MIN_BPM = 70

/** Maximum BPM to scan. Psytrance tops ~185. */
const MAX_BPM = 190

/** Smoothing factor for BPM output (exponential moving average).
 *  0.15 = reaches target in ~15 scans (~2.8s). */
const BPM_SMOOTH_FACTOR = 0.15

/** Minimum correlation strength to accept a BPM reading.
 *  Below this, we keep the previous BPM (freewheel). */
const MIN_CORRELATION = 0.05

/** Frames between full autocorrelation scans.
 *  Every 4 frames at ~46.4ms/frame ≈ every 186ms. */
const SCAN_INTERVAL_FRAMES = 4

/** Minimum amplitude multiplier to confirm a kick this frame.
 *  Used ONLY for kickDetected flag (light physics).
 *  BPM calculation does NOT use this. */
const KICK_ENERGY_RATIO = 1.4

/** Minimum absolute energy to even consider a kick.
 *  Prevents false positives during silence. */
const KICK_MIN_ABSOLUTE_ENERGY = 0.15

/** Harmonic sieve: a peak is "strong enough" to be the fundamental
 *  if its correlation is at least this fraction of the global max. */
const HARMONIC_SIEVE_RATIO = 0.75

/** A peak at lag L has "harmonic support" if there's a peak near 2L
 *  whose correlation is at least this fraction of the peak at L. */
const HARMONIC_SUPPORT_RATIO = 0.3

/** When looking for a harmonic at ~2×lag, allow this tolerance in frames.
 *  WAVE 2122.3: Increased from 2→3 because upsampled lags are 4× finer. */
const HARMONIC_LAG_TOLERANCE = 3

/** Upsampling factor for temporal resolution.
 *  4× turns 14 lags into 53 lags across 70-190 BPM. */
const UPSAMPLE_FACTOR = 4

// ═══════════════════════════════════════════════════════════════════════════
// THE TRACKER
// ═══════════════════════════════════════════════════════════════════════════

export class GodEarBPMTracker {
  /** Rolling window of raw bass energy values */
  private energyWindow: Float32Array
  /** Write position in the circular buffer */
  private writePos = 0
  /** Number of samples written (capped at window size) */
  private sampleCount = 0
  /** Duration of one FFT frame in milliseconds */
  private readonly frameDurationMs: number
  /** Virtual frame duration after upsampling (frameDurationMs / UPSAMPLE_FACTOR) */
  private readonly virtualFrameDurationMs: number
  /** Maximum samples in the window */
  private readonly windowSize: number

  /** Min/max lag corresponding to BPM range (pre-computed) */
  private readonly minLag: number
  private readonly maxLag: number

  /** Current smoothed BPM output */
  private stableBpm = 0
  /** Raw BPM from last autocorrelation scan */
  private rawBpm = 0
  /** Correlation strength of current BPM */
  private currentConfidence = 0

  /** Frame counter for scan interval */
  private frameCount = 0
  /** Total kicks detected (for interface compat) */
  private totalKicks = 0

  /** Phase tracking */
  private lastBeatPhaseTimestamp = 0
  private prevPhase = 0

  /** Kick hysteresis */
  private inKickState = false

  /** Energy average for kick detection */
  private rollingEnergySum = 0
  private rollingEnergyCount = 0
  private readonly rollingEnergySize = 32
  private rollingEnergyBuffer: Float32Array
  private rollingEnergyPos = 0

  constructor(sampleRate: number = 44100, bufferSize: number = 2048, overrideFrameDurationMs?: number) {
    this.frameDurationMs = overrideFrameDurationMs ?? (bufferSize / sampleRate) * 1000
    this.virtualFrameDurationMs = this.frameDurationMs / UPSAMPLE_FACTOR
    this.windowSize = Math.ceil((WINDOW_SECONDS * 1000) / this.frameDurationMs)
    this.energyWindow = new Float32Array(this.windowSize)
    this.rollingEnergyBuffer = new Float32Array(this.rollingEnergySize)

    // Pre-compute lag range from BPM range
    // WAVE 2122.3: Lags are computed in UPSAMPLED space (virtual frame duration)
    // Higher BPM → shorter period → smaller lag
    this.minLag = Math.floor((60000 / MAX_BPM) / this.virtualFrameDurationMs)
    this.maxLag = Math.ceil((60000 / MIN_BPM) / this.virtualFrameDurationMs)
  }

  /**
   * Process one frame of audio data.
   */
  process(
    rawBassEnergy: number,
    _externalKickDetected: boolean,
    timestamp: number = Date.now()
  ): GodEarBPMResult {
    this.frameCount++

    // ─── 1. Write energy into circular buffer ────────────────────
    this.energyWindow[this.writePos] = rawBassEnergy
    this.writePos = (this.writePos + 1) % this.windowSize
    this.sampleCount = Math.min(this.sampleCount + 1, this.windowSize)

    // ─── 1b. Update rolling energy average (for kickDetected) ────
    if (this.rollingEnergyCount >= this.rollingEnergySize) {
      this.rollingEnergySum -= this.rollingEnergyBuffer[this.rollingEnergyPos]
    } else {
      this.rollingEnergyCount++
    }
    this.rollingEnergyBuffer[this.rollingEnergyPos] = rawBassEnergy
    this.rollingEnergySum += rawBassEnergy
    this.rollingEnergyPos = (this.rollingEnergyPos + 1) % this.rollingEnergySize

    // ─── 2. Need enough data for correlation ─────────────────────
    const minSamples = Math.ceil(3000 / this.frameDurationMs)
    if (this.sampleCount < minSamples) {
      return {
        bpm: this.stableBpm,
        confidence: 0,
        kickCount: this.sampleCount,
        kickDetected: false,
        beatPhase: 0,
      }
    }

    // ─── 3. Run autocorrelation scan every N frames ──────────────
    if (this.frameCount % SCAN_INTERVAL_FRAMES === 0) {
      this.runAutocorrelationScan()
    }

    // ─── 4. Calculate beat phase + kick detection ────────────────
    let beatPhase = 0
    let kickDetected = false

    if (this.stableBpm > 0) {
      const beatIntervalMs = 60000 / this.stableBpm

      if (this.lastBeatPhaseTimestamp === 0) {
        this.lastBeatPhaseTimestamp = timestamp
      }

      const elapsed = timestamp - this.lastBeatPhaseTimestamp
      beatPhase = (elapsed % beatIntervalMs) / beatIntervalMs

      // Phase wrap detection → re-sync
      if (this.prevPhase > 0.85 && beatPhase < 0.15) {
        this.lastBeatPhaseTimestamp = timestamp
      }

      // Kick detection (energy-based, phase-independent)
      const avgEnergy = this.rollingEnergyCount > 0
        ? this.rollingEnergySum / this.rollingEnergyCount
        : 0.05
      if (rawBassEnergy > avgEnergy * KICK_ENERGY_RATIO
          && rawBassEnergy > KICK_MIN_ABSOLUTE_ENERGY
          && !this.inKickState) {
        kickDetected = true
        this.totalKicks++
        this.inKickState = true
      }
      if (this.inKickState && rawBassEnergy < avgEnergy * 0.9) {
        this.inKickState = false
      }
      this.prevPhase = beatPhase
    }

    // ─── 5. Diagnostic log ───────────────────────────────────────
    if (this.frameCount % 120 === 0) {
      console.log(
        `[🥁 GODEAR BPM] ${this.stableBpm}bpm (raw=${this.rawBpm}) ` +
        `conf=${this.currentConfidence.toFixed(3)} samples=${this.sampleCount} ` +
        `frameDur=${this.frameDurationMs.toFixed(1)}ms virtualDur=${this.virtualFrameDurationMs.toFixed(2)}ms ` +
        `lagRange=[${this.minLag},${this.maxLag}] energy=${rawBassEnergy.toFixed(4)}`
      )
    }

    return {
      bpm: this.stableBpm,
      confidence: this.currentConfidence,
      kickCount: this.sampleCount,
      kickDetected,
      beatPhase,
    }
  }

  /**
   * CORE: Autocorrelation scan with 4× upsampling + parabolic interpolation
   *       + harmonic sieve.
   *
   * WAVE 2122.3: The energy buffer is linearly upsampled 4× before
   * autocorrelation. This turns 130 samples → 520 samples and the
   * lag range from [6,19] → [24,76], giving 53 lags instead of 14.
   *
   * Step 1: Linearize and upsample energy buffer 4×
   * Step 2: Compute normalized autocorrelation R(lag) in upsampled space.
   * Step 3: Find all local maxima in R(lag).
   * Step 4: Parabolic interpolation for sub-sample lag resolution.
   * Step 5: Harmonic sieve — prefer shortest-lag peak with harmonic support.
   * Step 6: Smooth output BPM via EMA.
   */
  private runAutocorrelationScan(): void {
    const n = this.sampleCount

    // Linearize the circular buffer
    const linear = this.getLinearWindow()

    // ─── Step 1: Upsample 4× via linear interpolation ───────────────────
    const upsampled = this.upsample(linear, n, UPSAMPLE_FACTOR)
    const uN = n * UPSAMPLE_FACTOR

    // Remove DC offset (mean)
    const mean = this.computeMean(upsampled, uN)
    for (let i = 0; i < uN; i++) {
      upsampled[i] -= mean
    }

    // Normalization: autocorrelation at lag 0
    const energy = this.computeEnergy(upsampled, uN)
    if (energy < 1e-10) return // Silence

    // ─── Step 2: Compute normalized autocorrelation (upsampled space) ───
    const effectiveMaxLag = Math.min(this.maxLag, uN - 1)
    const effectiveMinLag = Math.max(this.minLag, 2)

    if (effectiveMinLag >= effectiveMaxLag) return

    const corrLen = effectiveMaxLag - effectiveMinLag + 1
    const corrArray = new Float32Array(corrLen)
    for (let lag = effectiveMinLag; lag <= effectiveMaxLag; lag++) {
      corrArray[lag - effectiveMinLag] = this.correlationAtLag(upsampled, uN, lag) / energy
    }

    // ─── Step 3 + 4: Find local maxima with parabolic interpolation ─────
    const peaks: AutocorrPeak[] = []

    for (let i = 1; i < corrLen - 1; i++) {
      const prev = corrArray[i - 1]
      const curr = corrArray[i]
      const next = corrArray[i + 1]

      if (curr > prev && curr > next && curr > MIN_CORRELATION) {
        const lag = i + effectiveMinLag

        // Parabolic interpolation: vertex of parabola through 3 points
        const denom = prev - 2 * curr + next
        let interpolatedLag = lag
        let interpolatedCorr = curr

        if (Math.abs(denom) > 1e-10) {
          const delta = 0.5 * (prev - next) / denom
          const clampedDelta = Math.max(-0.5, Math.min(0.5, delta))
          interpolatedLag = lag + clampedDelta
          interpolatedCorr = curr - 0.25 * (prev - next) * clampedDelta
        }

        // WAVE 2122.3: BPM uses virtualFrameDurationMs (upsampled time base)
        const bpm = 60000 / (interpolatedLag * this.virtualFrameDurationMs)

        if (bpm >= MIN_BPM - 5 && bpm <= MAX_BPM + 5) {
          peaks.push({ lag, interpolatedLag, correlation: interpolatedCorr, bpm })
        }
      }
    }

    if (peaks.length === 0) return

    // ─── DIAGNOSTIC: Log full autocorrelation landscape ──────────────────
    if (this.frameCount % 120 === 0) {
      // Log raw correlation at every 4th lag (to keep logs readable)
      const corrDump: string[] = []
      for (let i = 0; i < corrLen; i += UPSAMPLE_FACTOR) {
        const lag = i + effectiveMinLag
        const bpm = 60000 / (lag * this.virtualFrameDurationMs)
        corrDump.push(`L${lag}(${Math.round(bpm)}bpm)=${corrArray[i].toFixed(3)}`)
      }
      console.log(`[🥁 AUTOCORR RAW 4×] virtualDur=${this.virtualFrameDurationMs.toFixed(2)}ms ${corrDump.join(' | ')}`)

      // Log detected peaks
      const peakDump = peaks.map(p =>
        `L${p.lag}→${p.interpolatedLag.toFixed(2)}(${Math.round(p.bpm)}bpm)r=${p.correlation.toFixed(3)}`
      ).join(' | ')
      console.log(`[🥁 PEAKS] ${peaks.length} found: ${peakDump}`)
    }

    // ─── Step 4: Harmonic sieve ──────────────────────────────────────────
    peaks.sort((a, b) => a.lag - b.lag) // Shortest lag first (highest BPM)

    let globalMaxCorr = 0
    for (const p of peaks) {
      if (p.correlation > globalMaxCorr) globalMaxCorr = p.correlation
    }

    let bestPeak: AutocorrPeak | null = null

    // Pass 1: find shortest-lag peak with harmonic support
    for (const peak of peaks) {
      if (peak.correlation < globalMaxCorr * HARMONIC_SIEVE_RATIO) continue
      if (peak.bpm < MIN_BPM || peak.bpm > MAX_BPM) continue

      // Check for harmonic at ~2× lag
      const target2x = peak.lag * 2
      let hasSupport = false

      for (const other of peaks) {
        if (Math.abs(other.lag - target2x) <= HARMONIC_LAG_TOLERANCE) {
          if (other.correlation >= peak.correlation * HARMONIC_SUPPORT_RATIO) {
            hasSupport = true
            break
          }
        }
      }

      // Check ~3× lag as fallback
      if (!hasSupport) {
        const target3x = peak.lag * 3
        for (const other of peaks) {
          if (Math.abs(other.lag - target3x) <= HARMONIC_LAG_TOLERANCE + 1) {
            if (other.correlation >= peak.correlation * HARMONIC_SUPPORT_RATIO) {
              hasSupport = true
              break
            }
          }
        }
      }

      if (hasSupport) {
        bestPeak = peak
        break
      }
    }

    // Fallback: global max peak
    if (!bestPeak) {
      for (const peak of peaks) {
        if (peak.bpm >= MIN_BPM && peak.bpm <= MAX_BPM) {
          if (peak.correlation >= globalMaxCorr * 0.99) {
            bestPeak = peak
            break
          }
        }
      }
    }

    // Last resort: any peak in range
    if (!bestPeak) {
      for (const peak of peaks) {
        if (peak.bpm >= MIN_BPM && peak.bpm <= MAX_BPM) {
          bestPeak = peak
          break
        }
      }
    }

    if (!bestPeak) return

    // ─── Safety: pull above-range BPM down to sub-harmonic ──────────────
    if (bestPeak.bpm > MAX_BPM) {
      const halfLag = bestPeak.lag * 2
      for (const p of peaks) {
        if (Math.abs(p.lag - halfLag) <= HARMONIC_LAG_TOLERANCE && p.bpm >= MIN_BPM && p.bpm <= MAX_BPM) {
          bestPeak = p
          break
        }
      }
    }

    // ─── Safety: push below-range BPM up to harmonic ────────────────────
    if (bestPeak.bpm < MIN_BPM) {
      const halfLag = Math.round(bestPeak.lag / 2)
      for (const p of peaks) {
        if (Math.abs(p.lag - halfLag) <= HARMONIC_LAG_TOLERANCE && p.bpm >= MIN_BPM && p.bpm <= MAX_BPM) {
          bestPeak = p
          break
        }
      }
    }

    const finalBpm = bestPeak.bpm
    const finalCorr = bestPeak.correlation

    // ─── DIAGNOSTIC: Log sieve decision ──────────────────────────────────
    if (this.frameCount % 120 === 0) {
      console.log(
        `[🥁 SIEVE] chose L${bestPeak.lag}→${bestPeak.interpolatedLag.toFixed(2)} ` +
        `(${Math.round(bestPeak.bpm)}bpm) corr=${bestPeak.correlation.toFixed(3)} ` +
        `globalMax=${globalMaxCorr.toFixed(3)} threshold=${(globalMaxCorr * HARMONIC_SIEVE_RATIO).toFixed(3)}`
      )
    }

    this.rawBpm = Math.round(finalBpm)
    this.currentConfidence = Math.max(0, Math.min(1, finalCorr))

    // ─── Step 5: Smooth BPM output ───────────────────────────────────────
    if (finalCorr > MIN_CORRELATION) {
      if (this.stableBpm === 0) {
        this.stableBpm = Math.round(finalBpm)
      } else {
        const diff = Math.abs(finalBpm - this.stableBpm)

        if (diff > 30) {
          // Large jump — snap
          this.stableBpm = Math.round(finalBpm)
          this.lastBeatPhaseTimestamp = 0
          this.prevPhase = 0
        } else {
          // EMA smoothing
          this.stableBpm = Math.round(
            this.stableBpm + BPM_SMOOTH_FACTOR * (finalBpm - this.stableBpm)
          )
        }
      }
    }
  }

  /**
   * Upsample a signal by integer factor via linear interpolation.
   *
   * Given N input samples, produces N × factor output samples.
   * This is mathematically equivalent to inserting (factor - 1) linearly
   * interpolated points between each pair of original samples.
   *
   * Valid for band-limited signals where the original sampling rate is
   * already above the Nyquist frequency of the signal of interest.
   * (Energy at ~2 Hz << original sampling at ~21.5 Hz = ✓)
   */
  private upsample(input: Float32Array, inputLength: number, factor: number): Float32Array {
    const outputLength = inputLength * factor
    const output = new Float32Array(outputLength)

    for (let i = 0; i < inputLength - 1; i++) {
      const base = i * factor
      const v0 = input[i]
      const v1 = input[i + 1]
      const step = (v1 - v0) / factor

      for (let j = 0; j < factor; j++) {
        output[base + j] = v0 + step * j
      }
    }

    // Fill the last segment (hold last value)
    const lastBase = (inputLength - 1) * factor
    const lastVal = input[inputLength - 1]
    for (let j = 0; j < factor; j++) {
      if (lastBase + j < outputLength) {
        output[lastBase + j] = lastVal
      }
    }

    return output
  }

  /**
   * Linearize the circular buffer. Oldest sample first, newest last.
   */
  private getLinearWindow(): Float32Array {
    const n = this.sampleCount
    const linear = new Float32Array(n)

    if (this.sampleCount < this.windowSize) {
      for (let i = 0; i < n; i++) {
        linear[i] = this.energyWindow[i]
      }
    } else {
      for (let i = 0; i < n; i++) {
        linear[i] = this.energyWindow[(this.writePos + i) % this.windowSize]
      }
    }
    return linear
  }

  /** Compute mean of first n elements */
  private computeMean(data: Float32Array, n: number): number {
    let sum = 0
    for (let i = 0; i < n; i++) sum += data[i]
    return sum / n
  }

  /** Compute energy (sum of squares) of first n elements */
  private computeEnergy(data: Float32Array, n: number): number {
    let sum = 0
    for (let i = 0; i < n; i++) sum += data[i] * data[i]
    return sum
  }

  /** Compute unnormalized autocorrelation at a specific lag */
  private correlationAtLag(data: Float32Array, n: number, lag: number): number {
    let sum = 0
    const end = n - lag
    for (let i = 0; i < end; i++) {
      sum += data[i] * data[i + lag]
    }
    return sum
  }

  /** Get current stable BPM */
  getBpm(): number {
    return this.stableBpm
  }

  /** Reset tracker state */
  reset(): void {
    this.energyWindow.fill(0)
    this.writePos = 0
    this.sampleCount = 0
    this.stableBpm = 0
    this.rawBpm = 0
    this.currentConfidence = 0
    this.lastBeatPhaseTimestamp = 0
    this.prevPhase = 0
    this.inKickState = false
    this.totalKicks = 0
    this.frameCount = 0
    this.rollingEnergyBuffer.fill(0)
    this.rollingEnergySum = 0
    this.rollingEnergyCount = 0
    this.rollingEnergyPos = 0
  }
}
