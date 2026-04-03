/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 INTERVAL BPM TRACKER — THE RESURRECTION OF WAVE 1163
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2168: WAVE 1163 interval-based detection RESURRECTED within the
 * Worker framework. Autocorrelation (GodEarBPMTracker) archived as a
 * mathematical jewel — it works beautifully on clean signals but cannot
 * find 126 BPM in Brejcha's sub-bass at 46.4ms/frame resolution.
 *
 * This tracker uses the PROVEN architecture from WAVE 1163.5:
 *
 *   1. RATIO-BASED KICK DETECTION:
 *      rawBassEnergy > rollingAverage × 1.6 + rising edge (delta > 0.008)
 *      No debounce gates, no onset classification, no spectral filtering.
 *      Just raw energy ratios — the most robust kick detector known.
 *
 *   2. ADAPTIVE DEBOUNCE (THE MAGIC):
 *      debounce = max(200ms, (60000/stableBpm) × 0.40)
 *      The 0.40 factor is the CRITICAL parameter that prevents the
 *      circular vicious cycle at 160 BPM (see WAVE 1163 postmortem).
 *      Floor of 200ms = max theoretical 300 BPM (DnB).
 *
 *   3. HYSTERESIS (inKick flag):
 *      Once a kick is detected, inKick=true until energy drops below
 *      0.9× rolling average. Prevents double-triggering on the same
 *      kick transient.
 *
 *   4. MEDIAN SMOOTHING (12-sample window):
 *      BPM from raw intervals → buffer of 12 → take MEDIAN.
 *      Median is more robust than mean against outliers (offbeats,
 *      ghost notes, one missed kick). The trend emerges naturally.
 *
 *   5. CONFIDENCE:
 *      Based on consistency of intervals — how tightly clustered
 *      the last 12 BPM measurements are around the median.
 *
 * PRODUCTION RESULTS (WAVE 1163.5):
 *   - Boris Brejcha 126 BPM:  124-126 BPM detected (±2 BPM) ✅
 *   - Cumbia 158 BPM:         147-156 BPM detected (±8 BPM) ✅
 *   - Psytrance 185 BPM:      185-188 BPM detected (±2 BPM) ✅
 *   - Hardcore distorted:      138-162 BPM (±22, low confidence) ⚠️
 *
 * FEED: rawBassEnergy (20-150Hz, pre-AGC) from GodEarFFT.
 *       That's rawSubBassEnergy + rawBassOnlyEnergy.
 *       The original WAVE 1163 used exactly this range.
 *
 * IMPORTANT: The autocorrelation engine (GodEarBPMTracker.ts) is NOT
 * deleted — it's a mathematical jewel with potential future applications
 * (tempo mapping, polyrhythm analysis, long-form structure detection).
 *
 * @author PunkOpus
 * @wave 2168
 */

// ═══════════════════════════════════════════════════════════════════════════
// SHARED INTERFACE — identical to GodEarBPMTracker for zero downstream impact
// ═══════════════════════════════════════════════════════════════════════════

export interface GodEarBPMResult {
  /** Stable BPM (median-smoothed) */
  bpm: number
  /** 0-1: Confidence based on interval consistency */
  confidence: number
  /** Number of kicks detected since last reset */
  kickCount: number
  /** Was a beat detected THIS frame? */
  kickDetected: boolean
  /** Beat phase 0-1 (position within current beat cycle) */
  beatPhase: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — CALIBRATED IN WAVE 1163.5 PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum interval between kicks in milliseconds.
 *  WAVE 2171: raised from 200ms → 300ms.
 *  WAVE 2175: REVERTED back to 200ms.
 *
 *  WHY THE REVERT:
 *  300ms was set to block the 185 BPM "problem" in Brejcha's polyrhythmic bass.
 *  But 185 BPM is mathematically correct — the tracker SHOULD see it clearly.
 *  With 300ms floor: 185 BPM interval = 324ms, but frame-quantized (46.4ms/frame)
 *  many legitimate 185 BPM intervals land at 278ms (6 frames) → BLOCKED.
 *  This generates the chaotic bpmBuf=[65,99,144,92,86...] and conf=0.00 in production.
 *
 *  THE CORRECT ARCHITECTURE (WAVE 2174/2175):
 *    - Tracker sees raw rhythm at full resolution (up to 300 BPM)
 *    - getMusicalBpm() folds the stable raw output into the dance pocket
 *    - "Don't limit the input data; limit the musical output." — PunkArchytect
 *
 *  200ms = 300 BPM absolute ceiling. More than enough for any electronic music. */
const MIN_INTERVAL_MS = 200

/** Maximum interval between kicks in milliseconds.
 *  1500ms = 40 BPM minimum. Below this is not rhythmic music. */
const MAX_INTERVAL_MS = 1500

/** Rolling average window size for energy history.
 *  24 samples at ~46.4ms/frame ≈ 1.1 seconds of context.
 *  Large enough to smooth over 2-3 beat cycles at 126 BPM. */
const ENERGY_HISTORY_SIZE = 24

/** Kick detection ratio threshold.
 *  Current energy must exceed rolling average by this factor.
 *  1.6× = the sweet spot found in WAVE 1163.4.
 *  Lower → false positives (ghost notes). Higher → missed kicks. */
const ENERGY_RATIO_THRESHOLD = 1.6

/** Rising edge confirmation threshold.
 *  The delta between current and previous energy must exceed this.
 *  Prevents detection on plateaus where energy is high but static.
 *  0.008 calibrated in WAVE 1163.4 for pre-AGC rawBassEnergy range. */
const DELTA_THRESHOLD = 0.008

/** Adaptive debounce factor.
 *  Fraction of the expected beat interval used as minimum gap.
 *  0.40 = THE MAGIC NUMBER from WAVE 1163.3 that breaks the
 *  vicious cycle at 160 BPM. (0.65 caused half-BPM lock). */
const DEBOUNCE_FACTOR = 0.40

// HYSTERESIS_RELEASE removed in WAVE 2171.
// inKick/hysteresis was designed for raw energy (plateau shape: kick rises → stays high → decays).
// The tracker now receives needle (flux = frame-to-frame energy DELTA), which is spike-shaped:
//   - Kick frame: flux = high (energy jumped)
//   - Post-kick frames: flux ≈ noise floor (energy stable or decaying smoothly)
// With noise floor = 0.010 and rollingAvg ≈ 0.013, any HYSTERESIS_RELEASE value > ~0.77
// would release inKick correctly. But tuning this for flux is fragile and architecturally wrong.
// MIN_INTERVAL_MS=300ms is the correct mechanism: no legitimate kick fires twice in 300ms.
// inKick state and hysteresis release block are removed — see class state and process() method.

/** Peak discriminator ratio.
 *  When the tracker has a stable BPM, a new "kick" candidate must have
 *  energy ≥ lastKickPeakEnergy × this ratio. This prevents offbeats
 *  (bass synth, hi-hat bleed) from being counted as kicks — they're
 *  always weaker than the main kick. Only applied once BPM is stable
 *  (bpmHistoryCount ≥ 6) to not block initial lock-in.
 *
 *  WAVE 2170: lowered from 0.75 → 0.50.
 *  Boris Brejcha minimal techno kicks vary significantly in energy
 *  depending on mixing (verse vs drop vs breakdown). A strict 0.75 ratio
 *  was rejecting legitimate kicks that were 55-70% of the running peak.
 *
 *  0.50 means: if the running peak is 0.25, anything above 0.125 counts.
 *  This still filters out true offbeats and hi-hat bleed (typically < 30%
 *  of kick energy), while accepting softer kicks in verses/breakdowns. */
const PEAK_DISCRIMINATOR_RATIO = 0.65

/** Smoothing factor for running peak energy estimate.
 *  peakEstimate = max(currentEnergy, peakEstimate × decay).
 *  0.995 means the peak decays slowly — survives ~200 frames (~9s).
 *  This ensures gradual amplitude changes in the music are tracked. */
const PEAK_DECAY = 0.995

/** Minimum absolute bass energy to even consider a kick.
 *  Prevents the Silence Trap: when rollingAvg sinks to ~0.01 during
 *  breakdowns, any residual rumble (0.05) generates a ratio of 5.0×
 *  and fools the ratio detector. This floor ensures only real transients
 *  with muscular energy pass. Calibrated from WAVE 2439 front logs:
 *  all false positives during Brejcha silences had energy < 0.10.
 *  Real kicks never dip below 0.12 even in the softest verses. */
const MIN_KICK_ENERGY = 0.150

/** Minimum kicks before peak discriminator activates.
 *  Need enough history to have a reliable peak estimate.
 *  6 kicks = ~3 seconds at 126 BPM — enough to establish amplitude. */
const PEAK_DISCRIMINATOR_MIN_KICKS = 6

/** Number of BPM measurements to keep for median calculation.
 *  WAVE 2171: reduced from 12 → 8.
 *  At 126 BPM, 8 samples = ~3 seconds of history. Faster rotation means
 *  corrupt BPMs from the chaotic startup phase are evicted sooner.
 *  With 12 slots, a single session of 4 wild BPMs (48, 215, 62, 185)
 *  contaminates the spread for ~20+ kicks. With 8, they're gone in ~8. */
const BPM_HISTORY_SIZE = 8

/** Minimum kicks required before reporting a BPM.
 *  Need at least 4 intervals (5 kicks) for any meaningful median. */
const MIN_KICKS_FOR_BPM = 5

/** Confidence decay per frame when no kick is detected.
 *  If the music stops or changes drastically, confidence fades. */
const CONFIDENCE_DECAY_PER_FRAME = 0.001

/** Maximum silence (no kicks) in milliseconds before resetting BPM.
 *  5 seconds of no kicks = probably silence or a very long breakdown. */
const SILENCE_TIMEOUT_MS = 5000

// ═══════════════════════════════════════════════════════════════════════════
// THE TRACKER
// ═══════════════════════════════════════════════════════════════════════════

export class IntervalBPMTracker {

  // ─── Energy History (circular buffer for rolling average) ───────────
  private readonly energyHistory: Float32Array
  private energyHistoryPos = 0
  private energyHistoryCount = 0
  private energyHistorySum = 0

  // ─── Kick Detection State ──────────────────────────────────────────
  private prevEnergy = 0
  // inKick removed in WAVE 2171 — MIN_INTERVAL_MS=300ms handles double-trigger prevention
  private lastKickTimestamp = 0
  private totalKicks = 0

  // ─── BPM Measurement ──────────────────────────────────────────────
  private readonly bpmHistory: Float64Array
  private bpmHistoryPos = 0
  private bpmHistoryCount = 0
  private stableBpm = 0
  private currentConfidence = 0

  // ─── Peak Discriminator ─────────────────────────────────────────
  private peakEnergyEstimate = 0

  // ─── Phase Tracking ───────────────────────────────────────────────
  private lastBeatPhaseTimestamp = 0

  // ─── Frame Duration ───────────────────────────────────────────────
  private readonly frameDurationMs: number

  constructor(sampleRate: number = 44100, bufferSize: number = 2048, overrideFrameDurationMs?: number) {
    this.frameDurationMs = overrideFrameDurationMs ?? (bufferSize / sampleRate) * 1000
    this.energyHistory = new Float32Array(ENERGY_HISTORY_SIZE)
    this.bpmHistory = new Float64Array(BPM_HISTORY_SIZE)
  }

  /**
   * Process one frame of audio data.
   *
   * @param rawBassEnergy - Pre-AGC bass energy (20-150Hz recommended).
   *                        This should be the sum of rawSubBassEnergy (20-60Hz)
   *                        + rawBassOnlyEnergy (60-250Hz) from GodEarFFT.
   * @param _externalKickDetected - Ignored. Kept for interface compatibility.
   * @param timestamp - Deterministic musical clock timestamp in milliseconds.
   * @returns GodEarBPMResult with current BPM, confidence, kick state, and phase.
   */
  process(
    rawBassEnergy: number,
    _externalKickDetected: boolean,
    timestamp: number = Date.now()
  ): GodEarBPMResult {

    // ─── 1. Update Rolling Average ─────────────────────────────────
    if (this.energyHistoryCount >= ENERGY_HISTORY_SIZE) {
      this.energyHistorySum -= this.energyHistory[this.energyHistoryPos]
    } else {
      this.energyHistoryCount++
    }
    this.energyHistory[this.energyHistoryPos] = rawBassEnergy
    this.energyHistorySum += rawBassEnergy
    this.energyHistoryPos = (this.energyHistoryPos + 1) % ENERGY_HISTORY_SIZE

    const rollingAvg = this.energyHistoryCount > 0
      ? this.energyHistorySum / this.energyHistoryCount
      : 0

    // ─── 2. Compute Delta (Rising Edge) ────────────────────────────
    const delta = rawBassEnergy - this.prevEnergy
    this.prevEnergy = rawBassEnergy

    // ─── 3. Kick Detection — Ratio + Delta ─────────────────────────
    //
    // Two conditions must ALL be true:
    //   a) Energy exceeds rolling average by ENERGY_RATIO_THRESHOLD (1.6×)
    //   b) Energy is RISING (delta > DELTA_THRESHOLD = 0.008)
    //
    // inKick/hysteresis removed in WAVE 2171 — the tracker now receives
    // needle (flux = energy delta), not raw energy. Flux is spike-shaped:
    // it spikes on kick frames and returns to noise floor immediately after.
    // The old inKick mechanism was designed for plateau-shaped raw energy.
    // Double-trigger prevention is now handled by MIN_INTERVAL_MS=300ms.

    let kickDetected = false

    if (rollingAvg > 0
        && rawBassEnergy > rollingAvg * ENERGY_RATIO_THRESHOLD
        && delta > DELTA_THRESHOLD
        && rawBassEnergy > MIN_KICK_ENERGY) {

      // ─── 3b. Adaptive Debounce Check ───────────────────────────
      // The debounce is the MINIMUM time between kicks.
      // It adapts to the current BPM to prevent the vicious cycle.
      //
      // Formula: max(MIN_INTERVAL_MS, (60000/stableBpm) × DEBOUNCE_FACTOR)
      //
      // At 126 BPM: max(200, 476 × 0.40) = max(200, 190) = 200ms
      // At 160 BPM: max(200, 375 × 0.40) = max(200, 150) = 200ms
      // At 85 BPM:  max(200, 706 × 0.40) = max(200, 282) = 282ms
      //
      // The floor of 200ms prevents >300 BPM false detections.
      // The 0.40 factor ensures we NEVER block real kicks at any BPM.

      let debounceMs = MIN_INTERVAL_MS
      if (this.stableBpm > 0) {
        const expectedIntervalMs = 60000 / this.stableBpm
        debounceMs = Math.max(MIN_INTERVAL_MS, expectedIntervalMs * DEBOUNCE_FACTOR)
      }

      const timeSinceLastKick = timestamp - this.lastKickTimestamp

      if (timeSinceLastKick >= debounceMs) {

        // ─── 3c. Peak Discriminator Check ──────────────────────────
        // Once we have enough kicks to know the typical peak amplitude,
        // reject candidates that are significantly weaker than recent kicks.
        // This is the SURGICAL kill for offbeats: they pass ratio and delta
        // checks (they're above noise floor and rising), but they're always
        // weaker than the main kick. A real kick might vary ±25% in energy
        // but an offbeat is typically 50-70% of kick energy.
        //
        // Only active after PEAK_DISCRIMINATOR_MIN_KICKS — before that,
        // all kicks are accepted to allow initial lock-in.

        let passedPeakCheck = true
        if (this.totalKicks >= PEAK_DISCRIMINATOR_MIN_KICKS && this.peakEnergyEstimate > 0) {
          const peakThreshold = this.peakEnergyEstimate * PEAK_DISCRIMINATOR_RATIO
          if (rawBassEnergy < peakThreshold) {
            passedPeakCheck = false
          }
        }

        if (passedPeakCheck) {
        // ✅ KICK DETECTED
        kickDetected = true
        this.totalKicks++

        // Update peak energy estimate
        // The peak decays slowly, but immediately jumps to current if higher
        this.peakEnergyEstimate = Math.max(rawBassEnergy, this.peakEnergyEstimate)

        // ─── 4. Measure Interval → BPM ────────────────────────────
        if (this.lastKickTimestamp > 0) {
          const intervalMs = timestamp - this.lastKickTimestamp

          if (intervalMs >= MIN_INTERVAL_MS && intervalMs <= MAX_INTERVAL_MS) {
            const instantBpm = 60000 / intervalMs

            // ─── 4b. Outlier Rejection ────────────────────────────
            // WAVE 2171: If we already have a stable BPM reference, reject
            // any new measurement that is more than 35% off. This catches:
            //   - Missed kick (1 beat gap → instantBpm = stableBpm/2 → 50% off → REJECT)
            //   - Double-trigger (half-beat gap → instantBpm = stableBpm×2 → 100% off → REJECT)
            //   - Breakdown-end re-entry (wildly different tempo phase → REJECT)
            //
            // WAVE 2175: Outlier rejection only activates when the history buffer
            // is FULL (bpmHistoryCount == BPM_HISTORY_SIZE) AND confidence > 0.3.
            // During cold start (< 8 kicks), accept all intervals — the median
            // will self-correct. Activating rejection too early causes lock-in
            // to a wrong sub-harmonic (e.g., 99 BPM when true BPM is 185).
            //
            // WAVE 2177: BUFFER PURGE — breaks the egg-chicken deadlock.
            //
            // When the history buffer is full AND confidence is exactly 0.00
            // (spread ≥ 60 BPM — catastrophically chaotic), the `conf > 0.3`
            // guard means rejection NEVER fires and garbage accumulates forever.
            //
            // Symptoms: dump starts with a breakdown (long IOIs → 56/65 BPM),
            // then the drop hits with 185 BPM kicks. But bpmBuf=[185,215,258,
            // 258,161,56,92,65] spread=202 → conf=0.00 → rejection disabled
            // → new 185 BPM entries keep mixing with the garbage indefinitely.
            //
            // Fix: when buffer is full AND conf==0.00, perform a MEDIAN PURGE:
            // replace every entry that deviates ≥50% from the current median
            // with the median itself. This aggressively flushes garbage while
            // preserving legitimate entries near the median cluster.
            //
            // Safety: only fires when conf EXACTLY ==0.00 (spread ≥ 60 BPM).
            // conf=0.07 (spread=56 BPM, e.g. sub-beat contamination) does NOT
            // trigger the purge — those are handled by the normal rotation.
            if (this.bpmHistoryCount >= BPM_HISTORY_SIZE && this.currentConfidence < 0.001) {
              const medianRef = this.stableBpm
              if (medianRef > 0) {
                for (let j = 0; j < BPM_HISTORY_SIZE; j++) {
                  const ratio = this.bpmHistory[j] / medianRef
                  if (ratio < 0.50 || ratio > 2.00) {
                    // Replace extreme outlier with the median — neutral contribution
                    this.bpmHistory[j] = medianRef
                  }
                }
                // Recompute after purge — spread will decrease, conf will rise
                this.stableBpm = this.computeMedianBpm()
                this.currentConfidence = this.computeConfidence()
              }
            }

            let acceptBpm = true
            if (this.bpmHistoryCount >= BPM_HISTORY_SIZE && this.currentConfidence > 0.3) {
              const ratio = instantBpm / this.stableBpm
              if (ratio < 0.65 || ratio > 1.55) {
                acceptBpm = false  // outlier — skip this measurement
              }
            }

            if (acceptBpm) {
              // Push into BPM history ring buffer
              this.bpmHistory[this.bpmHistoryPos] = instantBpm
              this.bpmHistoryPos = (this.bpmHistoryPos + 1) % BPM_HISTORY_SIZE
              this.bpmHistoryCount = Math.min(this.bpmHistoryCount + 1, BPM_HISTORY_SIZE)

              // ─── 5. Compute Median BPM ───────────────────────────
              if (this.bpmHistoryCount >= 3) {
                this.stableBpm = this.computeMedianBpm()
                this.currentConfidence = this.computeConfidence()
              }
            } // end acceptBpm
          }
        }

        this.lastKickTimestamp = timestamp
        } // end passedPeakCheck
      }
    }

    // ─── Peak Energy Decay ─────────────────────────────────────────
    // The peak estimate decays slowly each frame so it adapts to
    // changing dynamics (verse → chorus → breakdown).
    this.peakEnergyEstimate *= PEAK_DECAY

    // ─── 6. Silence Timeout — Reset if no kicks for too long ───────
    if (this.lastKickTimestamp > 0
        && (timestamp - this.lastKickTimestamp) > SILENCE_TIMEOUT_MS) {
      // Music probably stopped or changed drastically
      this.currentConfidence = Math.max(0, this.currentConfidence - CONFIDENCE_DECAY_PER_FRAME * 10)
    } else {
      // Gentle confidence decay when not detecting kicks
      if (!kickDetected && this.currentConfidence > 0) {
        this.currentConfidence = Math.max(0, this.currentConfidence - CONFIDENCE_DECAY_PER_FRAME)
      }
    }

    // ─── 8. Beat Phase Calculation ─────────────────────────────────
    let beatPhase = 0
    if (this.stableBpm > 0) {
      const beatIntervalMs = 60000 / this.stableBpm

      if (kickDetected) {
        // Re-sync phase on every detected kick
        this.lastBeatPhaseTimestamp = timestamp
      }

      if (this.lastBeatPhaseTimestamp > 0) {
        const elapsed = timestamp - this.lastBeatPhaseTimestamp
        beatPhase = (elapsed % beatIntervalMs) / beatIntervalMs
      }
    }

    // ─── 9. Diagnostic Log (every ~1 second) ──────────────────────
    // Kept sparse to avoid IPC choking (lesson from WAVE 2125)
    if (this.totalKicks > 0 && kickDetected) {
      // WAVE 2170: dump bpmHistory snapshot for conf=0 diagnostics
      const histSnapshot = Array.from(this.bpmHistory.slice(0, this.bpmHistoryCount))
        .map(v => Math.round(v))
        .join(',')
      console.log(
        `[🥁 INTERVAL BPM] KICK #${this.totalKicks} ` +
        `bpm=${this.stableBpm} conf=${this.currentConfidence.toFixed(2)} ` +
        `energy=${rawBassEnergy.toFixed(4)} avg=${rollingAvg.toFixed(4)} ` +
        `ratio=${rollingAvg > 0 ? (rawBassEnergy / rollingAvg).toFixed(2) : 'N/A'} ` +
        `delta=${delta.toFixed(4)} ` +
        `history=${this.bpmHistoryCount}/${BPM_HISTORY_SIZE} ` +
        `bpmBuf=[${histSnapshot}]`
      )
    }

    return {
      bpm: this.stableBpm,
      confidence: this.totalKicks >= MIN_KICKS_FOR_BPM ? this.currentConfidence : 0,
      kickCount: this.totalKicks,
      kickDetected,
      beatPhase,
    }
  }

  /**
   * Compute the median of the BPM history buffer.
   *
   * The median is THE key to stability. Unlike the mean, it ignores
   * outliers (one missed kick → one wild BPM → ignored by median).
   * With 12 samples, even 3-4 bad measurements don't shift the result.
   *
   * Returns the median rounded to the nearest integer BPM.
   */
  private computeMedianBpm(): number {
    const n = this.bpmHistoryCount
    if (n === 0) return 0

    // Copy active portion and sort
    const sorted: number[] = []
    for (let i = 0; i < n; i++) {
      sorted.push(this.bpmHistory[i])
    }
    sorted.sort((a, b) => a - b)

    // Median: middle value (odd) or average of two middle values (even)
    if (n % 2 === 1) {
      return Math.round(sorted[Math.floor(n / 2)])
    } else {
      return Math.round((sorted[n / 2 - 1] + sorted[n / 2]) / 2)
    }
  }

  /**
   * Compute confidence based on how consistent the BPM measurements are.
   *
   * Confidence = 1 - (spread / NORMALIZATION_RANGE)
   * where spread = max(bpm) - min(bpm) across history.
   *
   * Perfect consistency (all same BPM) → confidence = 1.0
   * Huge variance (±60+ BPM) → confidence approaches 0.0
   * Moderate variance (±8 BPM, Boris Brejcha) → confidence ≈ 0.87
   *
   * WAVE 2170: normalization range 40 → 60 BPM.
   * Production logs showed valid stable BPM (92-104) but spread ~20-24
   * BPM across the 12-sample ring buffer, giving conf = 1 - 24/40 = 0.40.
   * With range=60: conf = 1 - 24/60 = 0.60 → crosses the 0.05 gate.
   */
  private computeConfidence(): number {
    const n = this.bpmHistoryCount
    if (n < 3) return 0

    let min = Infinity
    let max = -Infinity

    for (let i = 0; i < n; i++) {
      const bpm = this.bpmHistory[i]
      if (bpm < min) min = bpm
      if (bpm > max) max = bpm
    }

    const spread = max - min
    // Normalize: spread of 0 → conf 1.0, spread of 60+ → conf ~0.0
    // WAVE 2170: 60 BPM range (was 40) — more tolerant of natural BPM variation
    const normalizedSpread = spread / 60
    const confidence = Math.max(0, Math.min(1, 1 - normalizedSpread))

    return confidence
  }

  /** Get current stable BPM (raw, unfolded) */
  getBpm(): number {
    return this.stableBpm
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * 🎯 WAVE 2174 + WAVE 2180 + WAVE 2181: DANCE POCKET FOLDER — getMusicalBpm()
   * ═══════════════════════════════════════════════════════════════════════
   *
   * The tracker measures RAW rhythmic events per minute. That's mathematically
   * correct — but musically meaningless when the artist uses polyrhythmic
   * patterns. Boris Brejcha's "Gravity" fires bass events at 185/min (tresillo
   * 3:2 pattern), but any DJ will tell you it's a 123 BPM track.
   *
   * This method folds raw BPM into the "dance pocket" — the tempo range where
   * humans physically groove. No EDM track is danced at 185 BPM.
   *
   * 🔥 WAVE 2180: EXTENDED POLYRHYTHMIC ARSENAL
   *
   * FOLDING DOWN (raw > targetMax):
   *   ×0.75  (Dotted 4:3 / semicorchea con puntillo):
   *     161 BPM × 0.75 = 121 BPM ✅ (Hard Techno dotted-bass ilusión)
   *     164 BPM × 0.75 = 123 BPM ✅
   *   ÷1.5   (Tresillo 3:2):
   *     185 BPM ÷ 1.5 = 123 BPM ✅ (Brejcha, polyrhythmic techno)
   *     195 BPM ÷ 1.5 = 130 BPM ✅
   *   ÷2.0   (Double-time → half-note pulse):
   *     250 BPM ÷ 2.0 = 125 BPM ✅ (DnB, hardcore → half-time groove)
   *
   * 🛡️ WAVE 2181: THE EXTREME FOLDER & SAFETY NET
   *
   *   ÷3.0   (Triple-time → extreme DnB/Speedcore):
   *     275 BPM ÷ 3.0 = 92 BPM ✅ (DnB at 260-300 BPM range)
   *     360 BPM ÷ 3.0 = 120 BPM ✅ (Speedcore → techno groove)
   *   ÷4.0   (Quadruple-time → gabber/extratone):
   *     440 BPM ÷ 4.0 = 110 BPM ✅ (Gabber → dancefloor)
   *     520 BPM ÷ 4.0 = 130 BPM ✅ (Extratone → groove)
   *
   *   SAFETY CLAMP: If ALL fold ratios fail (mathematically near-impossible
   *   with ÷4.0 covering up to 540 BPM), clamp to pocket boundary instead
   *   of returning raw BPM. A 275 BPM signal hitting the physics engine
   *   would cause movers to oscillate at 4.6 Hz — mechanical suicide for
   *   budget gear. The clamp is the last line of defense.
   *
   * FOLDING UP (raw < targetMin):
   *   ×1.5   (Tresillo inverso):
   *     86 BPM × 1.5 = 129 BPM ✅ (Medio-tempo Techno dotted groove)
   *   ×2.0   (Half-time → double-time):
   *     65 BPM × 2.0 = 130 BPM ✅ (Trap half-time → groove)
   *   ×3.0   (WAVE 2181 — ultra-slow ambient recovery):
   *     35 BPM × 3.0 = 105 BPM ✅ (Ambient/drone → gentle pulse)
   *   ×4.0   (WAVE 2181 — sub-bass crawl recovery):
   *     25 BPM × 4.0 = 100 BPM ✅ (SubBass → dancefloor)
   *
   * PRIORITY ORDER (fold down): ×0.75 → ÷1.5 → ÷2.0 → ÷3.0 → ÷4.0
   *   0.75 first: covers the most common Hard Techno dotted-bass illusion.
   *   Tresillo second: fast tresillo patterns.
   *   Double-time third: DnB/hardcore standard fold.
   *   Triple/Quadruple last: extreme genres, maximum reduction.
   *
   * PRIORITY ORDER (fold up): ×1.5 → ×2.0 → ×3.0 → ×4.0
   *   Tresillo inverse first: more musically natural in club contexts.
   *
   * Context-aware: pass genre-specific boundaries for strict pocket locking.
   *   Techno/minimal:   targetMin=120, targetMax=135
   *   Latin/reggaetón:  targetMin=85,  targetMax=105
   *   Generic default:  targetMin=90,  targetMax=135
   *
   * @param targetMin - Lower bound of the dance pocket (default 90 BPM)
   * @param targetMax - Upper bound of the dance pocket (default 135 BPM)
   * @returns Musical BPM folded into the dance pocket, or clamped to boundary.
   *          Returns 0 if no signal.
   */
  getMusicalBpm(targetMin: number = 90, targetMax: number = 135): number {
    const raw = this.stableBpm
    if (raw === 0) return 0

    // Direct hit — already in the pocket
    if (raw >= targetMin && raw <= targetMax) return raw

    // ── FOLDING DOWN (raw too fast) ──────────────────────────────────────
    if (raw > targetMax) {
      const folds = [
        raw * 0.75,  // ×0.75 — Dotted 4:3 (semicorchea con puntillo). 161→121
        raw / 1.5,   // ÷1.5  — Tresillo 3:2. 185→123
        raw / 2.0,   // ÷2.0  — Double-time. 250→125
        raw / 3.0,   // ÷3.0  — Triple-time. 275→92 (WAVE 2181: DnB/Speedcore)
        raw / 4.0,   // ÷4.0  — Quadruple-time. 440→110 (WAVE 2181: Gabber)
      ]
      for (const f of folds) {
        const folded = Math.round(f)
        if (folded >= targetMin && folded <= targetMax) return folded
      }
    }

    // ── FOLDING UP (raw too slow) ────────────────────────────────────────
    if (raw < targetMin) {
      const folds = [
        raw * 1.5,   // ×1.5 — Tresillo inverso. 86→129
        raw * 2.0,   // ×2.0 — Half-time inversion. 65→130
        raw * 3.0,   // ×3.0 — Ultra-slow recovery. 35→105 (WAVE 2181)
        raw * 4.0,   // ×4.0 — Sub-bass crawl recovery. 25→100 (WAVE 2181)
      ]
      for (const f of folds) {
        const folded = Math.round(f)
        if (folded >= targetMin && folded <= targetMax) return folded
      }
    }

    // ── WAVE 2181: SAFETY CLAMP — The Last Line of Defense ───────────────
    // If no fold ratio lands in the pocket (near-impossible with ÷4.0),
    // clamp to the nearest pocket boundary. NEVER return raw BPM to physics.
    // A raw 275 BPM would drive movers at 4.6 Hz oscillation — mechanical death.
    const pocketCenter = (targetMin + targetMax) / 2
    return raw > pocketCenter ? targetMax : targetMin
  }

  /** Reset tracker state — AMNESIA PROTOCOL */
  reset(): void {
    this.energyHistory.fill(0)
    this.energyHistoryPos = 0
    this.energyHistoryCount = 0
    this.energyHistorySum = 0
    this.prevEnergy = 0
    this.lastKickTimestamp = 0
    this.totalKicks = 0
    this.peakEnergyEstimate = 0
    this.bpmHistory.fill(0)
    this.bpmHistoryPos = 0
    this.bpmHistoryCount = 0
    this.stableBpm = 0
    this.currentConfidence = 0
    this.lastBeatPhaseTimestamp = 0
  }
}
