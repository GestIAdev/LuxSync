/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 GODEAR BPM TRACKER — AUTOCORRELATION ENGINE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2122: VOLVER A LOS ORÍGENES — AUTOCORRELACIÓN
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  WAVEs 1163→2121: THE INTERVAL GRAVEYARD                           │
 * │                                                                      │
 * │  Approach: Count kicks → measure intervals → median → BPM.          │
 * │                                                                      │
 * │  Fatal flaw: In Tech House (Brejcha), kicks and offbeats have       │
 * │  IDENTICAL energy in subBass+bass. No threshold, weight, IQR, or    │
 * │  debounce can distinguish them. The tracker detected BOTH, poisoning│
 * │  intervals with 325ms offbeats → erratic BPM 108-161.              │
 * │                                                                      │
 * │  Waves that fell:                                                    │
 * │    2118: subBass×1.5 + bass×0.4 → 161 BPM lock                     │
 * │    2119: beaterClick (mid+highMid) coincidence → 185 spikes         │
 * │    2119.1: Disable external kick bypass → still 161/185             │
 * │    2121: Pure rawBassEnergy + MIN_INTERVAL=310ms → erratic 108-161  │
 * │                                                                      │
 * │  ROOT CAUSE: Architectural. Interval-based detection CANNOT work     │
 * │  when kick and offbeat are energetically indistinguishable.          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * THE SOLUTION: AUTOCORRELATION
 *
 * Instead of counting individual kicks, we ask:
 *   "At what lag does the energy signal repeat itself?"
 *
 * This finds the DOMINANT PERIODICITY — the beat period — regardless of
 * whether offbeats also fire. Because kick+offbeat TOGETHER create a
 * pattern that repeats at the TRUE beat interval (e.g., 476ms for 126 BPM).
 *
 * HOW IT WORKS:
 *   1. Store a rolling window of bass energy values (one per FFT frame)
 *   2. For each candidate BPM (70-190), calculate the corresponding lag
 *      in frames: lag = (60000/BPM) / frameDurationMs
 *   3. Compute normalized autocorrelation at that lag
 *   4. The lag with highest correlation = dominant beat period = BPM
 *
 * WHY THIS IS ARCHITECTURALLY CORRECT:
 *   - Immune to offbeats: they're part of the repeating pattern
 *   - Immune to missed kicks: correlation degrades gracefully
 *   - No threshold tuning for kick detection
 *   - No IQR, no debounce, no ratio — pure signal processing
 *   - This is how Ableton, Rekordbox, and every serious BPM analyzer works
 *
 * ARCHITECTURE:
 *
 *   Worker Thread (senses.ts)
 *   ┌─────────────────────────────────────────┐
 *   │ GodEarFFT.analyze(buffer)               │
 *   │   ↓ rawBassEnergy (subBass + bass)      │
 *   │ GodEarBPMTracker.process(energy, ts)    │
 *   │   ↓ accumulate energy in circular buffer│
 *   │   ↓ autocorrelation over BPM range      │
 *   │   ↓ peak detection + harmonic disambig  │
 *   │   ↓ exponential smoothing               │
 *   │ → bpm, confidence, kickDetected, phase  │
 *   └────────────┬────────────────────────────┘
 *                │ IPC (every frame)
 *                ▼
 *   Main Thread (TitanOrchestrator)
 *
 * @author PunkOpus
 * @wave 2122
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

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Duration of the analysis window in seconds.
 *  6 seconds captures ~7-8 beats at 126 BPM — enough for solid correlation.
 *  Longer = more stable but slower to react to tempo changes. */
const WINDOW_SECONDS = 6

/** Minimum BPM to scan. Below this is not dance music. */
const MIN_BPM = 70

/** Maximum BPM to scan. Psytrance tops ~185. */
const MAX_BPM = 190

/** BPM scan resolution. 1.0 = test every integer BPM. */
const BPM_STEP = 1.0

/** Smoothing factor for BPM output (exponential moving average).
 *  0.12 = relatively smooth, reaches target in ~20 scans. */
const BPM_SMOOTH_FACTOR = 0.12

/** Minimum correlation strength to accept a BPM reading.
 *  Below this, we keep the previous BPM (freewheel). */
const MIN_CORRELATION = 0.05

/** Frames between full autocorrelation scans.
 *  Autocorrelation is O(N×M) — we don't need it every frame.
 *  Every 4 frames at ~46.4ms/frame ≈ every 186ms. */
const SCAN_INTERVAL_FRAMES = 4

/** Beat phase threshold for kick detection.
 *  When phase wraps from >threshold back to <(1-threshold), that's a beat. */
const BEAT_PHASE_WRAP_THRESHOLD = 0.15

/** Harmonic preference: if sub-harmonic (half BPM) has correlation
 *  within this ratio of the best, prefer the sub-harmonic.
 *  Prevents 126→252 BPM octave errors. */
const HARMONIC_PREFERENCE_RATIO = 0.85

/** Minimum amplitude multiplier to confirm a kick this frame.
 *  Used ONLY for kickDetected flag (light physics needs it).
 *  BPM calculation does NOT use this — it uses autocorrelation. */
const KICK_ENERGY_RATIO = 1.4

/** Minimum absolute energy to even consider a kick.
 *  Prevents false positives during breakdowns/silence where
 *  noise floor modulation can trigger phase-based detection. */
const KICK_MIN_ABSOLUTE_ENERGY = 0.15

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
  /** Maximum samples in the window */
  private readonly windowSize: number

  /** Current smoothed BPM output */
  private stableBpm = 0
  /** Raw BPM from last autocorrelation scan */
  private rawBpm = 0
  /** Correlation strength of current BPM */
  private currentConfidence = 0

  /** Frame counter for scan interval */
  private frameCount = 0
  /** Total beat phase wraps detected (for diagnostics / interface compat) */
  private totalKicks = 0

  /** Phase tracking */
  private lastBeatPhaseTimestamp = 0
  private prevPhase = 0

  /** Kick hysteresis: prevents double-trigger on multi-frame peaks */
  private inKickState = false

  /** Energy average for simple kick detection (for kickDetected flag) */
  private rollingEnergySum = 0
  private rollingEnergyCount = 0
  private readonly rollingEnergySize = 32
  private rollingEnergyBuffer: Float32Array
  private rollingEnergyPos = 0

  /** Pre-computed lag table: bpm → lag in frames */
  private lagTable: Array<{ bpm: number; lag: number }> = []

  constructor(sampleRate: number = 44100, bufferSize: number = 2048, overrideFrameDurationMs?: number) {
    this.frameDurationMs = overrideFrameDurationMs ?? (bufferSize / sampleRate) * 1000 // ~46.4ms in production
    this.windowSize = Math.ceil((WINDOW_SECONDS * 1000) / this.frameDurationMs)
    this.energyWindow = new Float32Array(this.windowSize)
    this.rollingEnergyBuffer = new Float32Array(this.rollingEnergySize)

    // Pre-compute lag table for all candidate BPMs
    for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += BPM_STEP) {
      const periodMs = 60000 / bpm
      const lagFrames = Math.round(periodMs / this.frameDurationMs)
      this.lagTable.push({ bpm, lag: lagFrames })
    }
  }

  /**
   * Process one frame of audio data.
   *
   * @param rawBassEnergy - Raw bass energy (subBass + bass, pre-AGC)
   * @param _externalKickDetected - Unused, kept for interface compatibility
   * @param timestamp - Deterministic musical timestamp (WAVE 2115)
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
    // At least 3 seconds of data before first scan
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

    // ─── 4. Calculate beat phase ─────────────────────────────────
    let beatPhase = 0
    let kickDetected = false

    if (this.stableBpm > 0) {
      const beatIntervalMs = 60000 / this.stableBpm

      if (this.lastBeatPhaseTimestamp === 0) {
        this.lastBeatPhaseTimestamp = timestamp
      }

      const elapsed = timestamp - this.lastBeatPhaseTimestamp
      beatPhase = (elapsed % beatIntervalMs) / beatIntervalMs

      // ─── 5. Detect beat crossing (phase wrap) ────────────────────
      // Phase goes 0→1 continuously. When it wraps back from ~1 to ~0,
      // that's a new beat.
      if (this.prevPhase > (1 - BEAT_PHASE_WRAP_THRESHOLD) && beatPhase < BEAT_PHASE_WRAP_THRESHOLD) {
        this.lastBeatPhaseTimestamp = timestamp // Re-sync phase on each wrap
      }

      // ─── 5b. Kick detection (energy-based, phase-independent) ──
      // kickDetected fires when energy spikes above rolling average.
      // This is for light physics / beat flash — NOT for BPM calculation.
      // Separate from phase to avoid timing mismatch between phase wrap and energy peak.
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
      // Exit kick state when energy drops below average
      if (this.inKickState && rawBassEnergy < avgEnergy * 0.9) {
        this.inKickState = false
      }
      this.prevPhase = beatPhase
    }

    // ─── 6. Diagnostic log ───────────────────────────────────────
    if (this.frameCount % 120 === 0) {
      console.log(
        `[🥁 GODEAR BPM] ${this.stableBpm}bpm (raw=${this.rawBpm}) ` +
        `conf=${this.currentConfidence.toFixed(3)} samples=${this.sampleCount}`
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
   * Core autocorrelation scan.
   * Tests every candidate BPM and picks the one with highest correlation.
   *
   * Autocorrelation R(lag) = Σ x[n] * x[n+lag]
   * Normalized by R(0) = Σ x[n]²
   *
   * The BPM whose lag yields the highest normalized R is the dominant periodicity.
   */
  private runAutocorrelationScan(): void {
    const n = this.sampleCount

    // Linearize the circular buffer for correlation
    const linear = this.getLinearWindow()

    // Remove DC offset (mean) — essential for clean correlation.
    // Without this, a constant signal would have R(lag)=1 for all lags.
    const mean = this.computeMean(linear, n)
    for (let i = 0; i < n; i++) {
      linear[i] -= mean
    }

    // Normalization: autocorrelation at lag 0 (total energy of signal)
    const energy = this.computeEnergy(linear, n)
    if (energy < 1e-10) return // Silence — skip

    // Scan all candidate BPMs
    let bestBpm = this.rawBpm
    let bestCorr = -1

    for (let i = 0; i < this.lagTable.length; i++) {
      const { bpm, lag } = this.lagTable[i]
      if (lag >= n) continue // Lag exceeds window — skip

      // Compute normalized autocorrelation at this lag
      const corr = this.correlationAtLag(linear, n, lag) / energy

      if (corr > bestCorr) {
        bestCorr = corr
        bestBpm = bpm
      }
    }

    // ─── Harmonic disambiguation ─────────────────────────────────
    // Problem: Autocorrelation has peaks at every harmonic (lag, 2×lag, 3×lag...)
    // If the tracker picks 252 BPM (lag=5) when the real tempo is 126 BPM (lag=10),
    // we need to check if the sub-harmonic is nearly as strong.
    //
    // Strategy: Check half-BPM. Prefer it ONLY if it's nearly as strong AND the
    // current BPM is above the dance music ceiling (>MAX_BPM). This prevents
    // 252→126 (correct) without causing 175→87 (wrong).
    //
    // For BPMs within the valid range, also check if half-BPM has a STRONGER
    // correlation — this catches cases where 250→125 genuinely sounds better.

    const halfBpm = Math.round(bestBpm / 2)
    if (halfBpm >= MIN_BPM) {
      const halfLag = Math.round((60000 / halfBpm) / this.frameDurationMs)
      if (halfLag < n) {
        const halfCorr = this.correlationAtLag(linear, n, halfLag) / energy
        if (bestBpm > MAX_BPM) {
          // BPM is above valid range — sub-harmonic is almost certainly correct
          if (halfCorr > bestCorr * HARMONIC_PREFERENCE_RATIO) {
            bestBpm = halfBpm
            bestCorr = halfCorr
          }
        } else {
          // BPM is within valid range — only prefer half if it's ACTUALLY stronger
          if (halfCorr > bestCorr * 1.05) {
            bestBpm = halfBpm
            bestCorr = halfCorr
          }
        }
      }
    }

    // Also check double BPM — prevent 63 being read instead of 126.
    // Only prefer double if it's SIGNIFICANTLY stronger (1.3x).
    const dblBpm = bestBpm * 2
    if (dblBpm <= MAX_BPM) {
      const dblLag = Math.round((60000 / dblBpm) / this.frameDurationMs)
      if (dblLag < n && dblLag > 0) {
        const dblCorr = this.correlationAtLag(linear, n, dblLag) / energy
        if (dblCorr > bestCorr * 1.3) {
          bestBpm = dblBpm
          bestCorr = dblCorr
        }
      }
    }

    this.rawBpm = bestBpm
    this.currentConfidence = Math.max(0, Math.min(1, bestCorr))

    // ─── Smooth BPM output ───────────────────────────────────────
    if (bestCorr > MIN_CORRELATION) {
      if (this.stableBpm === 0) {
        // First valid reading — snap immediately
        this.stableBpm = Math.round(bestBpm)
      } else {
        const diff = Math.abs(bestBpm - this.stableBpm)

        if (diff > 30) {
          // Large jump — likely song change, snap quickly
          this.stableBpm = Math.round(bestBpm)
          // Reset phase tracking on big jump
          this.lastBeatPhaseTimestamp = 0
          this.prevPhase = 0
        } else {
          // Normal tracking — exponential moving average
          this.stableBpm = Math.round(
            this.stableBpm + BPM_SMOOTH_FACTOR * (bestBpm - this.stableBpm)
          )
        }
      }
    }
  }

  /**
   * Get a linearized (non-circular) copy of the energy window.
   * Oldest sample first, newest last.
   */
  private getLinearWindow(): Float32Array {
    const n = this.sampleCount
    const linear = new Float32Array(n)

    if (this.sampleCount < this.windowSize) {
      // Buffer not yet full — data starts at 0
      for (let i = 0; i < n; i++) {
        linear[i] = this.energyWindow[i]
      }
    } else {
      // Circular buffer is full — unwrap from writePos
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

  /** Reset tracker state (e.g., on song change) */
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
