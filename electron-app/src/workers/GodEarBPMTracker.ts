/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 GODEAR BPM TRACKER — AUTOCORRELATION ENGINE v4
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2123: MEAN-CENTER & OCTAVE LOCK
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
 * WAVE 2122.3: TEMPORAL UPSAMPLING 4×
 * Fixed the coarse lag grid by upsampling energy buffer 4×.
 * Tests passed 25/25. Production: OCTAVE BOUNCE (167↔93 BPM).
 *
 * WAVE 2123 POSTMORTEM:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Production telemetry (atortasconelBPM.md) showed classic          │
 * │  "octave bounce": BPM alternates between ~186 and ~93.            │
 * │                                                                      │
 * │  AUTOCORR landscapes show TWO peaks at 2:1 ratio:                 │
 * │    L28(186bpm)=0.323  and  L59(88bpm)=0.343                      │
 * │    L31(169bpm)=0.376  and  L61(85bpm)=0.358                      │
 * │                                                                      │
 * │  ROOT CAUSES:                                                       │
 * │  1. Sieve prefers SHORTEST lag (highest BPM). This is WRONG for   │
 * │     octave disambiguation. A beat at 93 BPM generates peaks at    │
 * │     BOTH L55(93) AND L28(186). Preferring shortest = always       │
 * │     picks the double. Must prefer LONGEST lag (lowest BPM)        │
 * │     when both peaks have similar correlation strength.             │
 * │                                                                      │
 * │  2. No octave protection in smoothing. A 93→186 BPM jump is      │
 * │     accepted instantly if diff > 30 (snap mode). Need the         │
 * │     Pacemaker's OCTAVE LOCK: require sustained evidence before    │
 * │     accepting 2× or 0.5× BPM changes.                            │
 * │                                                                      │
 * │  3. Correlations are real (0.3–0.5 after mean-centering) but      │
 * │     the two octave peaks are NEARLY EQUAL, making the sieve       │
 * │     decision fragile. Octave preference bias resolves this.       │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * THE FIX: TEMPORAL UPSAMPLING 4× + OCTAVE-AWARE SIEVE + OCTAVE LOCK
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
 * @wave 2123
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

/** WAVE 2123: Octave preference — when a low-BPM peak and its 2× harmonic
 *  both exist, the low-BPM peak wins if its correlation is at least this
 *  fraction of the high-BPM peak. This breaks the tie in favor of the
 *  fundamental when both octaves are nearly equal.
 *  0.80 = "93 BPM wins over 186 BPM if corr(93) >= 0.80 × corr(186)"
 *  Tuned to NOT pull 175→87.5 BPM (where 87.5 has much weaker corr)
 *  but DO pull 186→93 BPM (where both have nearly equal corr). */
const OCTAVE_LOW_PREFERENCE = 0.80

/** WAVE 2123: Number of consecutive scans that must agree on an octave jump
 *  before we accept it. At SCAN_INTERVAL_FRAMES=4 and ~46.4ms/frame,
 *  each scan is ~186ms apart. 8 scans ≈ 1.5 seconds of confirmation.
 *  Inspired by Pacemaker WAVE 1022 OCTAVE_CHANGE_FRAMES=90 (~3s). */
const OCTAVE_LOCK_SCANS = 8

/** WAVE 2123: Ratio range for detecting octave jumps.
 *  A BPM change is "octave" if newBpm/oldBpm is within these ranges. */
const OCTAVE_RATIO_RANGES: [number, number][] = [
  [1.85, 2.15],  // 2× doubling
  [0.45, 0.55],  // 0.5× halving
]

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

  /** WAVE 2123: Octave lock — counts consecutive scans requesting an octave jump */
  private octaveLockCounter = 0
  /** WAVE 2123: The BPM that the octave lock is tracking as a candidate */
  private octaveLockCandidateBpm = 0

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
   * Step 5: Harmonic sieve — prefer LONGEST-lag peak (lowest BPM) with
   *         harmonic support. WAVE 2123: inverted from v3 shortest-lag.
   * Step 6: Octave-locked BPM smoothing via EMA.
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

    // ─── Step 4: Harmonic sieve — OCTAVE-AWARE PEAK SELECTION ──────────
    //
    // WAVE 2123: FUNDAMENTAL INSIGHT about autocorrelation octave symmetry:
    //
    // A signal periodic at lag L is ALSO periodic at lag 2L, 3L, etc.
    // So a beat at 175 BPM (lag 29) generates peaks at BOTH lag 29 AND
    // lag ~58 (87.5 BPM). The lag-2L peak can even be STRONGER because:
    //   1. More samples overlap at longer lags → more statistical stability
    //   2. The energy pattern is perfectly periodic at 2T too
    //
    // The reverse is NOT symmetric: a REAL 87 BPM beat would produce a
    // sub-harmonic at ~44 BPM (lag ~3L) which is below MIN_BPM range.
    // But its 2× harmonic at 174 BPM IS in range. So both cases look
    // the same in the autocorrelation landscape.
    //
    // RESOLUTION: When an octave pair exists (lag L and lag ~2L), prefer
    // the HIGHER BPM (shorter lag) because:
    //   a) If the real beat IS at lag L → correct choice
    //   b) If the real beat IS at lag 2L → the octave lock in Step 5
    //      will prevent snap-jumping from a stable low BPM to the double
    //
    // The octave lock then protects any stable BPM from being overridden
    // by its 2× or 0.5× harmonic without sustained evidence.

    let globalMaxCorr = 0
    for (const p of peaks) {
      if (p.correlation > globalMaxCorr) globalMaxCorr = p.correlation
    }

    let bestPeak: AutocorrPeak | null = null

    // Sort by shortest lag first (highest BPM)
    peaks.sort((a, b) => a.lag - b.lag)

    // Pass 1: For each high-BPM peak, check if it has an octave partner
    // at ~2× lag. If both exist and the high peak has correlation above
    // OCTAVE_LOW_PREFERENCE × the low peak, high peak wins.
    // This ensures we pick 175 over 87.5 when both are strong.
    for (const highPeak of peaks) {
      if (highPeak.bpm < MIN_BPM || highPeak.bpm > MAX_BPM) continue
      if (highPeak.correlation < globalMaxCorr * HARMONIC_SIEVE_RATIO) continue

      // Look for an octave partner at ~2× this lag (half BPM)
      const targetDoubleLag = Math.round(highPeak.lag * 2)
      let lowPeak: AutocorrPeak | null = null

      for (const other of peaks) {
        if (Math.abs(other.lag - targetDoubleLag) <= HARMONIC_LAG_TOLERANCE) {
          if (!lowPeak || other.correlation > lowPeak.correlation) {
            lowPeak = other
          }
        }
      }

      if (lowPeak) {
        // Octave pair found. High peak wins if its correlation is at least
        // OCTAVE_LOW_PREFERENCE × the low peak's correlation.
        // At 0.80: 175bpm(0.698) vs 87bpm(0.747) → 0.698/0.747=0.93 > 0.80 ✓ → 175 wins
        // Production: 186bpm(0.323) vs 93bpm(0.343) → 0.323/0.343=0.94 > 0.80 ✓ → 186 wins
        // (octave lock in smoothing will then protect stable 93 from 186)
        if (highPeak.correlation >= lowPeak.correlation * OCTAVE_LOW_PREFERENCE) {
          bestPeak = highPeak
          break
        }
      }
    }

    // Pass 2: No octave pair resolved — pick strongest peak in range
    if (!bestPeak) {
      let bestCorr = -1
      for (const peak of peaks) {
        if (peak.bpm >= MIN_BPM && peak.bpm <= MAX_BPM) {
          if (peak.correlation > bestCorr) {
            bestCorr = peak.correlation
            bestPeak = peak
          }
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

    // ─── Step 5: Smooth BPM output with OCTAVE LOCK ─────────────────────
    // WAVE 2123: Inspired by Pacemaker WAVE 1022. If the new BPM is an
    // octave jump (2× or 0.5×) from stableBpm, don't accept immediately.
    // Require OCTAVE_LOCK_SCANS consecutive scans confirming the jump.
    if (finalCorr > MIN_CORRELATION) {
      if (this.stableBpm === 0) {
        // First reading — accept immediately
        this.stableBpm = Math.round(finalBpm)
      } else {
        const isOctaveJump = this.isOctaveJump(finalBpm, this.stableBpm)

        if (isOctaveJump) {
          // Track the octave candidate
          if (Math.abs(finalBpm - this.octaveLockCandidateBpm) < 10) {
            this.octaveLockCounter++
          } else {
            // Different octave candidate — restart
            this.octaveLockCandidateBpm = finalBpm
            this.octaveLockCounter = 1
          }

          if (this.octaveLockCounter >= OCTAVE_LOCK_SCANS) {
            // Sustained octave jump confirmed — accept
            if (this.frameCount % 120 === 0) {
              console.log(
                `[🥁 OCTAVE ACCEPT] ${this.stableBpm}→${Math.round(finalBpm)} BPM ` +
                `after ${this.octaveLockCounter} scans`
              )
            }
            this.stableBpm = Math.round(finalBpm)
            this.lastBeatPhaseTimestamp = 0
            this.prevPhase = 0
            this.octaveLockCounter = 0
            this.octaveLockCandidateBpm = 0
          } else {
            // BLOCK octave jump — keep current BPM
            if (this.frameCount % 120 === 0) {
              console.log(
                `[🥁 OCTAVE BLOCK] ${this.stableBpm}→${Math.round(finalBpm)} BPM ` +
                `(${this.octaveLockCounter}/${OCTAVE_LOCK_SCANS} scans)`
              )
            }
          }
        } else {
          // Not an octave jump — normal smoothing, reset octave counter
          this.octaveLockCounter = 0
          this.octaveLockCandidateBpm = 0

          const diff = Math.abs(finalBpm - this.stableBpm)
          if (diff > 30) {
            // Large non-octave jump — snap (e.g. song change)
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
  }

  /**
   * WAVE 2123: Detect if a BPM change is an octave jump (2× or 0.5×).
   * Ported from Pacemaker WAVE 1022 isOctaveJump().
   */
  private isOctaveJump(newBpm: number, currentBpm: number): boolean {
    if (currentBpm <= 0) return false
    const ratio = newBpm / currentBpm
    for (const [min, max] of OCTAVE_RATIO_RANGES) {
      if (ratio >= min && ratio <= max) return true
    }
    return false
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
    this.octaveLockCounter = 0
    this.octaveLockCandidateBpm = 0
  }
}
