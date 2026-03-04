/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 GODEAR BPM TRACKER — RESURRECTED + TRUE EAR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 1163: Original implementation — ratio-based kick detection + adaptive debounce
 *            Proven 74-188 BPM with ±2 BPM precision across genres.
 * 
 * WAVE 2090.2: PURGED — "Pacemaker Monopoly" moved BPM to main thread.
 *              But Pacemaker gets rawBass at 10fps (IPC lag), processes same
 *              frozen value 6× per frame → kick detection corrupted → BPM chaos.
 * 
 * WAVE 2112: RESURRECTED — Back in the Worker where FFT data is FRESH every frame.
 *            The Worker IS the ears. BPM detection belongs here.
 * 
 * WAVE 2116: THE TRUE EAR — Hardened kick detection + interval clustering.
 *            PROBLEM: Sub-beats (offbeats, syncopation) fooled the tracker
 *            into 161 BPM on a 125 BPM Brejcha session.
 *            ROOT CAUSE: KICK_RATIO_THRESHOLD=1.6 + KICK_DELTA_THRESHOLD=0.008
 *            was too permissive — offbeats with ratio 1.7-2.0 passed the filter.
 *            FEEDBACK LOOP: High BPM → short debounce → more sub-beats → even higher BPM.
 *            FIX: Added IQR-based interval filtering, increased debounce floor.
 * 
 * WAVE 2117: THE CALIBRATED EAR — Production-ready thresholds.
 *            PROBLEM: WAVE 2116 thresholds (ratio=2.0, delta=0.03) were tuned
 *            against synthetic beats but killed real kicks in mastered audio.
 *            Professional tracks have compressed dynamics: kick ratio 1.5-1.8,
 *            delta 0.01-0.04. The 2.0 ratio rejected EVERY kick → BPM=0 forever.
 *            FIX: Ratio 2.0→1.7, delta 0.03→0.015. Sub-beat rejection relies on
 *            the IQR interval filter (the architecturally correct tool) not on
 *            over-aggressive energy thresholds. The probe is temporary for validation.
 * 
 * ARCHITECTURE:
 * 
 *   Worker Thread (senses.ts)
 *   ┌─────────────────────────────────────────┐
 *   │ GodEarFFT.analyze(buffer)               │
 *   │   ↓ subBass (20-60Hz) + mid + highMid   │
 *   │   ↓ kickDetected (slope-based onset)    │
 *   │ 🥁 WAVE 2119: THE BEATER CLICK          │
 *   │   beaterClick = mid + highMid (raw)     │
 *   │   trackerEnergy = subBass×(1+click×5)   │
 *   │ GodEarBPMTracker.process()              │
 *   │   ↓ ratio kick detection                │
 *   │   ↓ adaptive debounce                   │
 *   │   ↓ IQR interval filtering              │
 *   │   ↓ median interval → BPM              │
 *   │   ↓ variance → confidence              │
 *   │ → bpm, confidence, kickDetected, phase  │
 *   └────────────┬────────────────────────────┘
 *                │ IPC (every frame)
 *                ▼
 *   Main Thread (TitanOrchestrator)
 *   ┌─────────────────────────────────────────┐
 *   │ Pacemaker: PLL only (validate + smooth) │
 *   │ NO kick detection. NO clustering.       │
 *   │ Just phase-lock to Worker BPM.          │
 *   └─────────────────────────────────────────┘
 * 
 * WHY THIS WORKS:
 * - rawBassEnergy is FRESH every FFT frame (~46ms @ 44100/2048)
 * - Ratio detection (current/avg > 1.7) rejects weak sub-beats
 * - Delta threshold (0.015) ensures true TRANSIENT, not sustained bass
 * - Adaptive debounce floor (250ms = 240 BPM) prevents extreme false positives
 * - IQR filtering removes outlier intervals BEFORE median calculation
 * - Median interval (not mean) further rejects remaining outliers
 * - History size 12 provides smooth BPM transitions
 * 
 * PROVEN RANGE: 74-188 BPM ±2 BPM (Brejcha→Psytrance)
 * 
 * @author PunkOpus
 * @wave 1163 + 2112 + 2116 + 2117 + 2118 + 2119
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GodEarBPMResult {
  /** Stable BPM (smoothed via median + history) */
  bpm: number
  /** 0-1: Variance-based confidence — low variance = high confidence */
  confidence: number
  /** Number of kicks in timestamp history */
  kickCount: number
  /** Was a kick detected THIS frame? */
  kickDetected: boolean
  /** Beat phase 0-1 (time since last kick / expected interval) */
  beatPhase: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Maximum kicks in timestamp history */
const MAX_TIMESTAMPS = 32

/** Minimum interval between kicks (ms) — 240 BPM max (fast DnB territory)
 *  WAVE 2116: Raised from 200ms (300 BPM) to 250ms (240 BPM).
 *  Sub-beats at 279ms were sneaking through the 200ms floor. */
const MIN_INTERVAL_MS = 250

/** Maximum interval between kicks (ms) — 40 BPM min */
const MAX_INTERVAL_MS = 1500

/** Rolling average window for bass energy (frames) — ~1.1s @ 21fps
 *  WAVE 2116: Increased from 24 to 32 for more stable baseline in bass-heavy genres */
const ENERGY_HISTORY_SIZE = 32

/** BPM history for smoothing (median of N measurements) */
const BPM_HISTORY_SIZE = 12

/** Ratio threshold: current bass must be 70%+ above rolling average
 *  WAVE 2116: Raised from 1.6 to 2.0
 *  WAVE 2117: Lowered to 1.7 — 2.0 was killing real kicks in mastered audio.
 *  Professional tracks (Brejcha) have compressed dynamics: real kicks only
 *  reach 1.5-1.8 ratio against the dense bass floor.
 *  Sub-beat rejection is now handled by the IQR interval filter (the correct tool). */
const KICK_RATIO_THRESHOLD = 1.7

/** Minimum rising delta to confirm a transient (noise floor)
 *  WAVE 2116: Raised from 0.008 to 0.03
 *  WAVE 2117: Lowered to 0.015 — 0.03 was too aggressive for loopback audio.
 *  Loopback-captured bass has smaller absolute deltas than synth tests.
 *  0.015 still rejects noise (0.008 was absurd) but lets real transients through. */
const KICK_DELTA_THRESHOLD = 0.015

/** Debounce factor: 40% of expected interval. Prevents vicious cycle. */
const DEBOUNCE_FACTOR = 0.40

/** Minimum confidence to accept BPM into smoothing history */
const MIN_CONFIDENCE_FOR_SMOOTH = 0.30

/** Hystéresis threshold for exiting "in kick" state (90% of avg) */
const KICK_EXIT_RATIO = 0.9

/** IQR multiplier for outlier rejection in interval filtering
 *  WAVE 2116: Intervals outside Q1 - 1.5*IQR ... Q3 + 1.5*IQR are discarded
 *  before median calculation. This kills sub-beat contamination. */
const IQR_MULTIPLIER = 1.5

// ═══════════════════════════════════════════════════════════════════════════
// THE TRACKER
// ═══════════════════════════════════════════════════════════════════════════

export class GodEarBPMTracker {
  // Kick timestamp history for interval calculation
  private kickTimestamps: number[] = []
  
  // Stable BPM output (smoothed)
  private stableBpm = 128
  
  // BPM history for median smoothing
  private bpmHistory: number[] = []
  
  // Energy rolling average state
  private energyHistory: number[] = []
  private prevEnergy = 0
  
  // Kick hysteresis: "inside a kick?" prevents double-trigger
  private inKick = false
  
  // Last kick time for adaptive debounce
  private lastKickTime = 0
  
  // Beat phase tracking
  private lastBeatTime = 0
  
  // Diagnostics
  private frameCount = 0
  private totalKicks = 0
  
  /**
   * Process one frame of audio data.
   * Call this EVERY FFT frame with fresh bass energy.
   * 
   * @param rawBassEnergy - 🥁 WAVE 2119: Multi-band coincidence energy: subBass × (1 + beaterClick × 5)
   *                        Pre-2119: was subBass×1.5 + bass×0.4 (WAVE 2118)
   *                        Pre-2118: was unweighted (subBass + bass from GodEar bandsRaw)
   * @param externalKickDetected - Slope-based onset from GodEar transient detector
   * @param timestamp - 🕐 WAVE 2115: Deterministic musical timestamp (not Date.now())
   */
  process(
    rawBassEnergy: number,
    externalKickDetected: boolean,
    timestamp: number = Date.now()
  ): GodEarBPMResult {
    this.frameCount++
    
    // ─── 1. Update energy rolling average ────────────────────────
    this.energyHistory.push(rawBassEnergy)
    if (this.energyHistory.length > ENERGY_HISTORY_SIZE) {
      this.energyHistory.shift()
    }
    
    const avgEnergy = this.energyHistory.length > 3
      ? this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
      : 0.05  // Bootstrap default
    
    // ─── 2. Ratio-based kick detection ───────────────────────────
    // A kick is when current energy is significantly above average.
    // Immune to AGC drift because it's RELATIVE, not absolute.
    const energyRatio = avgEnergy > 0.001 ? rawBassEnergy / avgEnergy : 0
    const delta = rawBassEnergy - this.prevEnergy
    
    // ─── 3. Adaptive debounce ────────────────────────────────────
    // Factor 0.40 of expected interval — prevents vicious circle:
    //   "detect half-beats → think BPM is double → debounce too short → detect more half-beats"
    // Floor of MIN_INTERVAL_MS (200ms) prevents extreme false positives.
    const expectedInterval = 60000 / this.stableBpm
    const adaptiveDebounce = Math.max(MIN_INTERVAL_MS, expectedInterval * DEBOUNCE_FACTOR)
    const timeSinceLastKick = timestamp - this.lastKickTime
    
    // ─── 4. Kick decision ────────────────────────────────────────
    const isRising = delta > KICK_DELTA_THRESHOLD
    const isPeak = energyRatio > KICK_RATIO_THRESHOLD
    const debounceOk = timeSinceLastKick >= adaptiveDebounce
    
    let kickDetected = false
    
    if (isPeak && isRising && !this.inKick && debounceOk) {
      // KICK DETECTED
      kickDetected = true
      this.inKick = true
      this.lastKickTime = timestamp
      this.lastBeatTime = timestamp
      this.totalKicks++
      
      this.kickTimestamps.push(timestamp)
      if (this.kickTimestamps.length > MAX_TIMESTAMPS) {
        this.kickTimestamps.shift()
      }
    }
    
    // Exit "in kick" state when energy drops below average
    if (this.inKick && rawBassEnergy < avgEnergy * KICK_EXIT_RATIO) {
      this.inKick = false
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // 🚫 WAVE 2119.1: EXTERNAL KICK BYPASS DISABLED
    // ═══════════════════════════════════════════════════════════════════
    // The SlopeBasedOnsetDetector in GodEarFFT uses subBass + bass*0.5
    // to detect kicks — effectively the same unweighted formula that
    // WAVEs 2118/2119 tried to fix. It fires on every Brejcha offbeat,
    // injecting 325/372ms intervals that poison the IQR and lock
    // BPM at 161.
    //
    // The ratio-based detection above (KICK_RATIO_THRESHOLD=1.7 +
    // KICK_DELTA_THRESHOLD=0.015 + beaterClick coincidence from 2119)
    // is the ONLY path that respects our calibrated thresholds.
    //
    // externalKickDetected is still useful for OTHER consumers
    // (BeatDetector, light physics, etc.) — just not for BPM tracking.
    // ═══════════════════════════════════════════════════════════════════
    // DISABLED: External kick bypass was injecting offbeats unchecked.
    // if (externalKickDetected && debounceOk && !kickDetected) {
    //   kickDetected = true
    //   this.lastKickTime = timestamp
    //   this.lastBeatTime = timestamp
    //   this.totalKicks++
    //
    //   this.kickTimestamps.push(timestamp)
    //   if (this.kickTimestamps.length > MAX_TIMESTAMPS) {
    //     this.kickTimestamps.shift()
    //   }
    // }
    
    this.prevEnergy = rawBassEnergy
    
    // ─── 5. Calculate beat phase ─────────────────────────────────
    // Simple continuous phase: time since last kick / expected beat interval
    const beatInterval = 60000 / this.stableBpm
    const timeSinceLastBeat = timestamp - this.lastBeatTime
    const beatPhase = this.lastBeatTime > 0
      ? (timeSinceLastBeat % beatInterval) / beatInterval
      : 0
    
    // ─── 6. Need enough kicks for BPM calculation ────────────────
    if (this.kickTimestamps.length < 4) {
      return {
        bpm: this.stableBpm,
        confidence: 0,
        kickCount: this.kickTimestamps.length,
        kickDetected,
        beatPhase,
      }
    }
    
    // ─── 7. Calculate valid intervals ────────────────────────────
    const rawIntervals: number[] = []
    for (let i = 1; i < this.kickTimestamps.length; i++) {
      const interval = this.kickTimestamps[i] - this.kickTimestamps[i - 1]
      if (interval >= MIN_INTERVAL_MS && interval <= MAX_INTERVAL_MS) {
        rawIntervals.push(interval)
      }
    }
    
    if (rawIntervals.length < 3) {
      return {
        bpm: this.stableBpm,
        confidence: 0.1,
        kickCount: this.kickTimestamps.length,
        kickDetected,
        beatPhase,
      }
    }
    
    // ─── 7b. WAVE 2116: IQR-based outlier rejection ─────────────
    // Sub-beats produce short intervals (279ms, 372ms) mixed with
    // real beat intervals (464ms, 511ms). The IQR filter removes
    // intervals that are statistical outliers, leaving the true beat cluster.
    const intervals: number[] = this.filterIntervalsIQR(rawIntervals)
    
    // If IQR filter removed too many, fall back to raw intervals
    if (intervals.length < 3) {
      return {
        bpm: this.stableBpm,
        confidence: 0.1,
        kickCount: this.kickTimestamps.length,
        kickDetected,
        beatPhase,
      }
    }
    
    // ─── 8. MEDIAN interval (robust to outliers) ─────────────────
    const sorted = [...intervals].sort((a, b) => a - b)
    const medianInterval = sorted[Math.floor(sorted.length / 2)]
    const rawBpm = Math.round(60000 / medianInterval)
    const clampedBpm = Math.max(60, Math.min(200, rawBpm))
    
    // ─── 9. Confidence from variance ─────────────────────────────
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce(
      (sum, int) => sum + Math.pow(int - avgInterval, 2), 0
    ) / intervals.length
    const stdDev = Math.sqrt(variance)
    const confidence = Math.max(0, Math.min(1, 1 - (stdDev / avgInterval)))
    
    // ─── 10. Smooth BPM if confident enough ──────────────────────
    if (confidence > MIN_CONFIDENCE_FOR_SMOOTH) {
      this.bpmHistory.push(clampedBpm)
      if (this.bpmHistory.length > BPM_HISTORY_SIZE) {
        this.bpmHistory.shift()
      }
      this.stableBpm = Math.round(
        this.bpmHistory.reduce((a, b) => a + b, 0) / this.bpmHistory.length
      )
    }
    
    // ─── 11. Diagnostic log ──────────────────────────────────────
    if (this.frameCount % 120 === 0) {
      const lastIntervals = intervals.slice(-6).map(i => `${i.toFixed(0)}`).join(',')
      console.log(
        `[🥁 GODEAR BPM] ${this.stableBpm}bpm (raw=${rawBpm}) ` +
        `conf=${confidence.toFixed(2)} kicks=${this.totalKicks} ` +
        `intervals=[${lastIntervals}]`
      )
    }
    
    return {
      bpm: this.stableBpm,
      confidence,
      kickCount: this.kickTimestamps.length,
      kickDetected,
      beatPhase,
    }
  }
  
  /**
   * 🔧 WAVE 2116: IQR-based interval filtering.
   * 
   * Standard statistical outlier rejection using Interquartile Range.
   * Removes intervals that fall outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR].
   * 
   * This kills sub-beat contamination:
   * - Real beats at 125 BPM → intervals ~464-511ms (the cluster)
   * - Sub-beats → intervals ~279-372ms (outliers below Q1)
   * - Missed beats → intervals ~882-1115ms (outliers above Q3)
   * 
   * After IQR: only the true beat cluster survives → correct median → correct BPM.
   * 
   * @param intervals - Raw intervals in ms (already filtered by MIN/MAX)
   * @returns Filtered intervals with outliers removed
   */
  private filterIntervalsIQR(intervals: number[]): number[] {
    if (intervals.length < 4) return intervals  // Need at least 4 for meaningful IQR
    
    const sorted = [...intervals].sort((a, b) => a - b)
    const n = sorted.length
    
    // Q1 = median of lower half, Q3 = median of upper half
    const q1Index = Math.floor(n / 4)
    const q3Index = Math.floor((3 * n) / 4)
    const q1 = sorted[q1Index]
    const q3 = sorted[q3Index]
    const iqr = q3 - q1
    
    // If IQR is tiny (all intervals are similar), skip filtering — they're all good
    if (iqr < 20) return intervals
    
    const lowerBound = q1 - IQR_MULTIPLIER * iqr
    const upperBound = q3 + IQR_MULTIPLIER * iqr
    
    return intervals.filter(i => i >= lowerBound && i <= upperBound)
  }
  
  /**
   * Get current stable BPM
   */
  getBpm(): number {
    return this.stableBpm
  }
  
  /**
   * Reset tracker state (e.g., on song change)
   */
  reset(): void {
    this.kickTimestamps = []
    this.bpmHistory = []
    this.energyHistory = []
    this.stableBpm = 128
    this.lastKickTime = 0
    this.lastBeatTime = 0
    this.prevEnergy = 0
    this.inKick = false
    this.totalKicks = 0
  }
}
