/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔮 TEMPO ORACLE — Zero-Allocation NSDF Autocorrelation Tempo Estimator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implementation of `docs/technical_audits/AUTOCORRELATION_BLUEPRINT.md`.
 *
 * Replaces the interval-median BPM estimation stage of IntervalBPMTracker.
 * The Oracle does NOT detect kicks and does NOT produce beat phase — it is a
 * pure FREQUENCY estimator. Phase is owned by KickPhaseGate (blueprint §7:
 * "Oracle owns frequency, gate owns phase").
 *
 * ───── WHY (blueprint §1) ──────────────────────────────────────────────────
 * The interval tracker DIFFERENTIATES: it subtracts two frame-quantized kick
 * timestamps. Quantization noise σ_t = ½ frame propagates as
 *
 *     σ_bpm ≈ (BPM² / 60000) × √2 × (T_f / 2)
 *
 * which is ±4.5 BPM @128 BPM at a 21.5 Hz ODF rate. That IS the observed
 * jitter. Median-of-8 cannot fix it — the median of 8 samples is itself
 * quantized, which is why the output snaps in discrete steps.
 *
 * The Oracle INTEGRATES: it correlates the whole ODF history against a
 * delayed copy of itself. Every onset pair at the true period contributes
 * coherently; timing noise contributes incoherently and averages away.
 *
 * ───── THE MATH (blueprint §2) ─────────────────────────────────────────────
 * 1. Conditioning:  x[n] = √needle − μ_slow      (√ tames 10:1 peak variance;
 *                                                  DC removal kills the ACF ramp)
 * 2. NSDF (McLeod & Wyvill), bounded lag band:
 *
 *        r(τ) = Σ x[n]·x[n+τ]
 *        m(τ) = Σ (x[n]² + x[n+τ]²)
 *        NSDF(τ) = 2r(τ)/m(τ)  ∈ [-1, +1]
 *
 *    NSDF over raw ACF because it is (a) self-normalizing — peak height IS a
 *    calibrated confidence, (b) bias-free — the biased ACF's linear taper drags
 *    peaks toward short lags (sharp-BPM bias); NSDF's denominator cancels it
 *    exactly, (c) bounded — every downstream threshold becomes universal.
 * 3. Harmonic ladder (sparse comb filter in lag domain — the octave killer):
 *
 *        S(τ) = NSDF(τ) + 0.50·NSDF(2τ) + 0.33·NSDF(3τ) + 0.25·NSDF(4τ)
 *
 *    The true period scores from ALL its multiples; the half-time impostor
 *    only scores from its own. This resolves dembow/DnB in-estimator instead
 *    of via post-hoc ratio heuristics.
 * 4. Parabolic interpolation of the NSDF vertex → sub-frame precision.
 *    THIS is what defeats the ±4 BPM quantization: integer lags at 43 Hz give
 *    a 122.0 / 128.1 / 134.5 BPM grid (±3.2 BPM); recovering the vertex to
 *    ~0.05 frame gives ±0.3 BPM. The grid disappears.
 * 5. Gaussian tempo prior around the previous lag + a persistent-challenger
 *    escape hatch — a SOFT likelihood replacing the legacy hard 15-BPM gate.
 *
 * ───── ZERO ALLOCATION (blueprint §3) ──────────────────────────────────────
 * Every buffer is allocated once in the constructor. The hot path performs
 * only indexed Float64Array reads/writes and scalar arithmetic:
 *   - no `new`, no `[]`, no push/shift/sort/slice/map/spread
 *   - no closures, no object literals, no destructuring
 *   - circular indexing via `& RING_MASK` (power-of-two), never `%`
 *   - integer indices kept int32 via `| 0`
 *   - `Math.exp` hoisted into a 64-entry LUT built at construction
 * Total footprint ≈ 10 KB — fits in L1 alongside the GodEar buffers.
 *
 * ───── COST (blueprint §5) ─────────────────────────────────────────────────
 * Bounded lag band (60–200 BPM; octave placement is the pocket folder's job)
 * → ~160 lags × ~420 taps ≈ 270 kflops per evaluation ≈ 70 µs, decimated to
 * every 4th frame → ~18 µs/frame amortized. FFT-ACF was rejected: at N=512 it
 * computes 512 lags we do not need, needs a separate normalization pass for
 * NSDF, and its bit-reversal access pattern is prefetch-hostile. A resonating
 * comb bank was rejected: IIR state cannot be erased, so it re-converges
 * slowly after a tempo cut and its Q trades precision against agility.
 *
 * @see docs/technical_audits/AUTOCORRELATION_BLUEPRINT.md
 * @see docs/technical_audits/BPM_SYSTEM_AUDIT.md
 */

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE-TIME CONSTANTS — module-level `const` so V8 folds them into the code
// ═══════════════════════════════════════════════════════════════════════════

/** ODF history length. MUST be a power of two — enables `& RING_MASK`.
 *  512 frames ≈ 11.9 s @43 Hz, ≈ 23.8 s @21.5 Hz. */
const RING_SIZE = 512;
const RING_MASK = RING_SIZE - 1;

/** Upper bound on any lag we ever index, including the 4× harmonic ladder
 *  headroom. @43 Hz: τ_max = 43 → 4τ = 172. 200 leaves margin for slower
 *  ODF rates being mis-measured during calibration. */
const MAX_LAG = 200;

/** Working-surface length. +2 so `nsdf[bestT + 1]` is always in range. */
const SURFACE_LEN = MAX_LAG + 2;

/** Musical tempo search band. Anything outside is an octave image of
 *  something inside; the dance-pocket folder owns octave placement. */
const BPM_MIN = 60;
const BPM_MAX = 200;

/** Full NSDF evaluation cadence, in frames. 4 → ~11 Hz update @43 Hz ODF,
 *  still 5× faster than a tempo can meaningfully change. Amortizes the
 *  evaluation cost to ¼. */
const EVAL_INTERVAL = 4;

/** Frames of timestamp observation before the ODF rate is frozen.
 *  The lag band is integer-valued and must not drift mid-stream. */
const CALIBRATION_FRAMES = 48;

/** Fallback ODF rate (Hz) used when the caller supplies no timestamps.
 *  4096-sample FFT hop @44.1 kHz ≈ 21.5 Hz. */
const DEFAULT_ODF_RATE = 21.53;

/** Harmonic ladder weights, mirroring the natural 1/k ACF harmonic decay
 *  (Scheirer 1998 comb-filter energy profile). */
const H2 = 0.50;
const H3 = 0.33;
const H4 = 0.25;
const LADDER_SUM = 1.0 + H2 + H3 + H4;

/** ── ODF PRE-SMOOTHING — 5-tap Gaussian, THE ENABLING STEP ────────────────
 *  The needle is a 1-frame-wide impulse. At a 21.5 Hz ODF a 150 BPM beat has
 *  a period of 8.61 frames, so consecutive onsets land alternately on frames
 *  8 and 9. Against a raw impulse train the NSDF is a bare spike comb: the
 *  neighbours of the peak are NEGATIVE, so the parabola has no support and
 *  sub-frame interpolation is meaningless — and worse, the exact-repeat lag
 *  at 2τ (17, an integer) correlates BETTER than the split τ, so the raw
 *  argmax collapses to half-time.
 *
 *  Measured on the synthetic sweep (90–174 BPM, blueprint §9.1):
 *      no smoothing → worst error 87.6 BPM (octave collapse at 124/150/174)
 *      3-tap        → worst error  0.97 BPM
 *      5-tap Gauss  → worst error  0.72 BPM   ← chosen
 *
 *  Smearing each onset over ~3 frames lets a beat at true lag 8.61 deposit
 *  correlation energy at BOTH lag 8 and lag 9, which is precisely the
 *  information the parabolic vertex needs to recover the 0.61.
 *
 *  Cost: a 2-frame group delay on the ODF. Irrelevant — the Oracle estimates
 *  PERIOD, not phase, and phase is KickPhaseGate's job. */
const K0 = 0.06;
const K1 = 0.24;
const K2 = 0.40;
const K3 = 0.24;
const K4 = 0.06;

/** ── MPM OCTAVE RULE ──────────────────────────────────────────────────────
 *  McLeod & Wyvill's octave resolver: take the SHORTEST local maximum that
 *  clears a fraction of the global best, not the global best itself.
 *
 *  This is necessary because the harmonic ladder alone CANNOT break an octave
 *  tie on a clean periodic signal — a train of period P is genuinely periodic
 *  at 2P, so both score alike (measured: 1.80 vs 1.84 at 150 BPM, the impostor
 *  winning). The shortest-peak rule is the standard, principled tie-breaker:
 *  of two equally valid explanations, the faster pulse is the true one; the
 *  slower is an artefact of the beat also repeating every two beats.
 *
 *  The ladder still earns its keep — it suppresses SPURIOUS short peaks that
 *  would otherwise win the shortest-peak race. Ladder + MPM together took the
 *  sweep from 87.6 BPM worst-case error to 0.78.
 *
 *  Threshold chosen by measurement, not taste. Under 30 % onset dropout the
 *  fundamental peak is degraded relative to its 2× image, so a strict
 *  threshold locks half-time:
 *      0.85 / 0.80 → half-time lock at 128 and 150 BPM under dropout
 *      0.75        → half-time lock at 128 and 150 BPM
 *      0.70        → all dropout cases correct, clean sweep unchanged
 *      0.65        → IDENTICAL results to 0.70
 *  0.70 therefore sits inside a stable plateau rather than on a cliff edge,
 *  which is what makes it a constant rather than a fitted parameter. */
const MPM_THRESHOLD = 0.70;

/** Leaky-window segment weights ≈ e^(−i/τ_mem) sampled at segment centres,
 *  τ_mem ≈ 8 s. Four constant-trip-count inner loops instead of a per-sample
 *  multiplier: no branches inside the loop, and TurboFan vectorizes
 *  constant-bound float loops aggressively. The staircase shifts the NSDF
 *  peak by < 0.01 frame — irrelevant next to the 0.05-frame interpolation
 *  floor, because the weighting is symmetric in the product structure. */
const SEG_SHIFT = 7;              // 128 frames per segment
const SEG_LEN = 1 << SEG_SHIFT;
const SEG_COUNT = RING_SIZE / SEG_LEN;  // 4
const SEG_W0 = 1.0;
const SEG_W1 = 0.62;
const SEG_W2 = 0.38;
const SEG_W3 = 0.24;

/** Tempo-prior LUT: exp(−u²/2) for u ∈ [0, 4) in 1/16 steps.
 *  Beyond 4σ the prior is ~0 and the candidate is effectively vetoed. */
const PRIOR_LUT_N = 64;
const PRIOR_LUT_STEP = 16;        // entries per unit of u

/** Prior width as a fraction of the previous lag. 6 % ≈ ±7.7 BPM @128 BPM —
 *  wide enough for any DJ tempo ramp, narrow enough to reject octave images. */
const PRIOR_SIGMA_FRAC = 0.06;

/** Escape hatch: an unshaded challenger must beat the prior-shaded winner by
 *  this factor, for this many consecutive evaluations, to force a jump.
 *  3 evaluations ≈ 12 frames ≈ 0.3–0.6 s — fast enough for a DJ transition,
 *  slow enough that a single noisy surface cannot derail the lock. */
const CHALLENGER_RATIO = 1.25;
const CHALLENGER_CONFIRM = 3;

/** Slow-mean EMA time constant for DC removal, in seconds. */
const DC_TAU_SECONDS = 4.0;

/** ── CONFIDENCE CALIBRATION ────────────────────────────────────────────────
 *  A sparse, half-wave-rectified ODF never reaches NSDF ≈ 1.0 even on a
 *  perfect metronome (the signal is mostly zeros), so the raw peak height is
 *  remapped onto [0,1] against these empirical anchors before being published.
 *
 *  ⚠️ THESE TWO NUMBERS ARE THE ONLY EMPIRICAL KNOBS IN THIS FILE.
 *  They must be re-fitted against ShadowLogger dumps per blueprint §9 before
 *  production sign-off: CONF_FLOOR should sit just above the NSDF peak height
 *  observed on non-rhythmic material, CONF_CEIL at the height observed on a
 *  clean four-on-the-floor. Downstream gates already calibrated for [0,1]
 *  (RhythmTracker > 0.05, PLL > 0.5, TickEngine > 0.7) then need no re-tuning. */
export const CONF_FLOOR = 0.10;
const CONF_CEIL = 0.70;

/** Ring fill fraction required before confidence is published un-attenuated.
 *  Below this the NSDF denominator is diluted by the zero-filled tail, so we
 *  report honestly reduced confidence rather than a confident guess. */
const WARMUP_FILL = 0.5;

// ═══════════════════════════════════════════════════════════════════════════
// THE ORACLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zero-allocation autocorrelation tempo estimator.
 *
 * Usage (one instance per audio stream, constructed once):
 * ```ts
 * const oracle = new TempoOracle();
 * // per ODF frame:
 * oracle.process(needle, deterministicTimestampMs);
 * const bpm = oracle.bpm;            // continuous, sub-frame interpolated
 * const conf = oracle.confidence;    // [0,1], NSDF-derived
 * ```
 */
export class TempoOracle {
  // ─── ODF history ────────────────────────────────────────────────────────
  /** Conditioned ODF ring, x[n]. Zero-initialized; the unwritten tail
   *  contributes nothing to r(τ), so warmup needs no special-case branch. */
  private readonly ring: Float64Array;
  /** Monotonically increasing write counter. Physical index = `& RING_MASK`.
   *  Smi-safe for centuries at any realistic frame rate. */
  private writeIdx: number;

  // ─── NSDF working surfaces (recomputed in place, never reallocated) ─────
  private readonly nsdf: Float64Array;
  private readonly score: Float64Array;
  /** Parabolically refined (fractional) lag per integer candidate. */
  private readonly tauRef: Float64Array;

  // ─── Tempo prior LUT ────────────────────────────────────────────────────
  private readonly priorLut: Float64Array;

  // ─── Conditioning state ─────────────────────────────────────────────────
  private emaMean: number;
  private emaAlpha: number;
  /** 5-tap smoothing delay line (s1 = newest previous sample). */
  private s1: number;
  private s2: number;
  private s3: number;
  private s4: number;

  // ─── Oracle state ───────────────────────────────────────────────────────
  private prevLag: number;
  private lastBpm: number;
  private lastConfidence: number;
  private lastPeak: number;
  private framesSinceEval: number;
  private challengerLag: number;
  private challengerFrames: number;

  // ─── Clock calibration (frozen after CALIBRATION_FRAMES) ────────────────
  private odfRate: number;
  private tauMin: number;
  private tauMax: number;
  private tauHi: number;          // 4 × tauMax, clamped — ladder headroom
  private calibrated: boolean;
  private calibFrames: number;
  private calibDtSum: number;
  private lastTimestampMs: number;

  /**
   * @param odfRateHz Optional known ODF frame rate. When omitted (the normal
   *                  case), the Oracle self-calibrates from the deterministic
   *                  timestamps passed to `process()` over the first
   *                  CALIBRATION_FRAMES frames, then freezes the lag band.
   */
  constructor(odfRateHz?: number) {
    // Allocate every buffer exactly once, in fixed declaration order, so the
    // instance gets a single hidden class that never transitions.
    this.ring = new Float64Array(RING_SIZE);
    this.nsdf = new Float64Array(SURFACE_LEN);
    this.score = new Float64Array(SURFACE_LEN);
    this.tauRef = new Float64Array(SURFACE_LEN);
    this.priorLut = new Float64Array(PRIOR_LUT_N);

    // exp() evaluated once here so the hot path never touches a transcendental.
    for (let i = 0; i < PRIOR_LUT_N; i++) {
      const u = i / PRIOR_LUT_STEP;
      this.priorLut[i] = Math.exp(-(u * u) * 0.5);
    }

    // Every numeric field is seeded with a real double (never null/undefined)
    // so V8 keeps the field representation as Double from frame 1 — no
    // MutableHeapNumber boxing, no representation transition, no deopt.
    this.writeIdx = 0;
    this.emaMean = 0;
    this.emaAlpha = 0.01;
    this.s1 = 0;
    this.s2 = 0;
    this.s3 = 0;
    this.s4 = 0;
    this.prevLag = 0;
    this.lastBpm = 0;
    this.lastConfidence = 0;
    this.lastPeak = 0;
    this.framesSinceEval = 0;
    this.challengerLag = 0;
    this.challengerFrames = 0;

    this.odfRate = DEFAULT_ODF_RATE;
    this.tauMin = 0;
    this.tauMax = 0;
    this.tauHi = 0;
    this.calibrated = false;
    this.calibFrames = 0;
    this.calibDtSum = 0;
    this.lastTimestampMs = -1;

    if (odfRateHz !== undefined && odfRateHz > 0) {
      this.applyOdfRate(odfRateHz);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC SURFACE
  // ═════════════════════════════════════════════════════════════════════════

  /** Continuous, sub-frame-interpolated tempo estimate in BPM (0 = no lock). */
  get bpm(): number {
    return this.lastBpm;
  }

  /** Calibrated confidence in [0,1] derived from the NSDF peak height. */
  get confidence(): number {
    return this.lastConfidence;
  }

  /** Raw NSDF peak height at the winning lag — diagnostics / re-calibration. */
  get peakHeight(): number {
    return this.lastPeak;
  }

  /** Winning lag in frames (fractional, post-interpolation) — diagnostics. */
  get lagFrames(): number {
    return this.prevLag;
  }

  /** Measured ODF frame rate in Hz. */
  get frameRate(): number {
    return this.odfRate;
  }

  /** True once the lag band has been frozen and evaluation is running. */
  get isCalibrated(): boolean {
    return this.calibrated;
  }

  /**
   * Feed one ODF frame. O(1) on most frames; a full NSDF evaluation runs
   * every EVAL_INTERVAL frames.
   *
   * @param needle             Gated needle from GatedNeedlePipeline (≥ 0).
   * @param deterministicTsMs  Monotonic sample-derived timestamp. Required for
   *                           self-calibration; the lag domain is only valid
   *                           for a UNIFORMLY sampled ODF, so never pass a
   *                           wall-clock value here.
   */
  process(needle: number, deterministicTsMs?: number): void {
    // ─── 1. Calibrate the lag band from observed frame spacing ────────────
    if (!this.calibrated) {
      this.observeClock(deterministicTsMs);
    }

    // ─── 2. Condition and write — branchless, O(1) ────────────────────────
    // √ compression: raw needle magnitudes vary ~10:1 between soft and hard
    // kicks, and ACF weights products of magnitudes, so one huge kick would
    // otherwise dominate the whole window. √ compresses dynamic range while
    // preserving timing exactly. (log is flatter but needs an ε guard;
    // Math.sqrt lowers to a single machine instruction.)
    const raw = Math.sqrt(needle > 0 ? needle : 0);

    // 5-tap Gaussian smear. Without this the NSDF is a bare spike comb with
    // negative neighbours — the parabola has nothing to fit and the raw argmax
    // collapses to half-time whenever the true period is not an integer number
    // of frames. See the K0..K4 commentary for the measured sweep.
    const c = K0 * this.s4 + K1 * this.s3 + K2 * this.s2 + K3 * this.s1 + K4 * raw;
    this.s4 = this.s3;
    this.s3 = this.s2;
    this.s2 = this.s1;
    this.s1 = raw;

    // DC removal: a constant offset adds a triangular ramp to the ACF that
    // biases the peak toward lag 0. The slow EMA is an O(1) stand-in for the
    // exact window mean (which would cost O(W) and force renormalization).
    this.emaMean += this.emaAlpha * (c - this.emaMean);
    this.ring[this.writeIdx & RING_MASK] = c - this.emaMean;
    this.writeIdx = (this.writeIdx + 1) | 0;

    // ─── 3. Decimated evaluation ──────────────────────────────────────────
    if (!this.calibrated) return;
    this.framesSinceEval = (this.framesSinceEval + 1) | 0;
    if (this.framesSinceEval < EVAL_INTERVAL) return;
    this.framesSinceEval = 0;

    this.evaluate();
  }

  /** Full amnesia — call on RESET_PACEMAKER / audio source change. */
  reset(): void {
    this.ring.fill(0);
    this.nsdf.fill(0);
    this.score.fill(0);
    this.writeIdx = 0;
    this.emaMean = 0;
    this.prevLag = 0;
    this.lastBpm = 0;
    this.lastConfidence = 0;
    this.lastPeak = 0;
    this.framesSinceEval = 0;
    this.challengerLag = 0;
    this.challengerFrames = 0;
    // The clock does not change when the tempo does; keep the calibrated lag
    // band if we already have one, otherwise re-observe.
    this.lastTimestampMs = -1;
    if (!this.calibrated) {
      this.calibFrames = 0;
      this.calibDtSum = 0;
    }
  }

  /** Force a specific ODF rate and re-freeze the lag band.
   *  Call on CONFIG_UPDATE when the hop size changes — never mid-stream
   *  without a following reset(), or the lag domain becomes inconsistent. */
  setFrameRate(odfRateHz: number): void {
    if (odfRateHz > 0) this.applyOdfRate(odfRateHz);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CLOCK CALIBRATION
  // ═════════════════════════════════════════════════════════════════════════

  private observeClock(tsMs: number | undefined): void {
    if (tsMs === undefined || !(tsMs > 0)) {
      // No clock supplied — fall back to the nominal hop rate immediately.
      this.applyOdfRate(DEFAULT_ODF_RATE);
      return;
    }
    if (this.lastTimestampMs < 0) {
      this.lastTimestampMs = tsMs;
      return;
    }
    const dt = tsMs - this.lastTimestampMs;
    this.lastTimestampMs = tsMs;
    // Reject absurd spacing (worker stall, source switch) — it would poison
    // the frozen lag band for the rest of the session.
    if (dt <= 0 || dt > 500) return;

    this.calibDtSum += dt;
    this.calibFrames = (this.calibFrames + 1) | 0;
    if (this.calibFrames >= CALIBRATION_FRAMES) {
      this.applyOdfRate(1000 / (this.calibDtSum / this.calibFrames));
    }
  }

  private applyOdfRate(rateHz: number): void {
    this.odfRate = rateHz;

    // Lag band: τ = F_odf × 60 / BPM
    let tMin = Math.round((rateHz * 60) / BPM_MAX) | 0;
    let tMax = Math.round((rateHz * 60) / BPM_MIN) | 0;
    if (tMin < 2) tMin = 2;                       // need τ−1 ≥ 1 for parabola
    if (tMax > MAX_LAG >> 2) tMax = MAX_LAG >> 2; // 4τ must stay indexable
    if (tMax <= tMin + 1) tMax = tMin + 2;

    this.tauMin = tMin;
    this.tauMax = tMax;
    let hi = (tMax << 2) | 0;
    if (hi > MAX_LAG) hi = MAX_LAG;
    if (hi > RING_SIZE - 2) hi = RING_SIZE - 2;
    this.tauHi = hi;

    // DC-removal EMA coefficient from the now-known frame rate.
    this.emaAlpha = 1 / (DC_TAU_SECONDS * rateHz);

    this.calibrated = true;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // EVALUATION — runs every EVAL_INTERVAL frames
  // ═════════════════════════════════════════════════════════════════════════

  private evaluate(): void {
    // Hoist everything into locals: TurboFan then proves the receiver map once
    // and every element access becomes a bare `movsd` with no bounds check.
    const ring = this.ring;
    const nsdf = this.nsdf;
    const score = this.score;
    const n = this.writeIdx;
    const tMin = this.tauMin;
    const tMax = this.tauMax;
    const tHi = this.tauHi;

    // ─── PASS 1: NSDF over [tMin−1 .. tHi] ────────────────────────────────
    // tMin−1 so the parabola always has a left neighbour at the band edge.
    const tStart = tMin > 1 ? tMin - 1 : 1;

    for (let t = tStart; t <= tHi; t++) {
      const lim = RING_SIZE - t;
      let r = 0.0;
      let m = 0.0;
      let i = 0;

      // Four constant-weight segments = the leaky window. Weights multiply
      // BOTH numerator and denominator, so NSDF stays normalized in [-1,1].
      for (let s = 0; s < SEG_COUNT; s++) {
        const w = s === 0 ? SEG_W0 : s === 1 ? SEG_W1 : s === 2 ? SEG_W2 : SEG_W3;
        let end = (s + 1) << SEG_SHIFT;
        if (end > lim) end = lim;
        for (; i < end; i++) {
          // (n − 1 − i) walks newest-first. Negative operands are fine:
          // `&` coerces to int32 two's complement, so −1 & 511 === 511.
          const a = ring[(n - 1 - i) & RING_MASK];
          const b = ring[(n - 1 - i - t) & RING_MASK];
          r += w * a * b;
          m += w * (a * a + b * b);
        }
        if (i >= lim) break;
      }

      // Guarded division — a single NaN entering the ring would poison 512
      // frames of ACF and can flip V8's number-representation assumptions.
      nsdf[t] = m > 1e-12 ? (2.0 * r) / m : 0.0;
    }

    // ─── PASS 2: refine each candidate, then score its harmonic ladder ────
    // ORDER MATTERS. The blueprint's original sketch scored integer lags and
    // interpolated afterwards; that is wrong, and measurably so. For a true
    // period of 8.61 frames, candidate t=9 reads harmonics at the integers
    // 18/27/36 — which MISS the real harmonic peaks at 17.2/25.8/34.4 — while
    // the half-time impostor t=17 reads 34/51/68 and lands on them. The
    // impostor therefore wins a ladder scored on integers.
    //
    // Refining FIRST and evaluating the ladder at kτ* (interpolated) makes the
    // true period's ladder fully coherent, including its ODD harmonics.
    const tauRef = this.tauRef;
    for (let t = tMin; t <= tMax; t++) {
      const tt = this.parabolicRefine(t);
      tauRef[t] = tt;
      score[t] =
        this.lerpNsdf(tt) +
        H2 * this.lerpNsdf(2.0 * tt) +
        H3 * this.lerpNsdf(3.0 * tt) +
        H4 * this.lerpNsdf(4.0 * tt);
    }

    // ─── PASS 3: prior shading, MPM octave rule, challenger bookkeeping ───
    const pPrev = this.prevLag;
    const hasPrior = pPrev >= tMin && pPrev <= tMax;
    const sigInv = hasPrior ? 1.0 / (PRIOR_SIGMA_FRAC * pPrev) : 0.0;
    const priorLut = this.priorLut;

    // `score` stays RAW throughout; shading is applied on the fly so both the
    // shaded and unshaded surfaces remain available without a second buffer.
    let shadedMax = -Infinity;
    let rawMax = -Infinity;
    for (let t = tMin; t <= tMax; t++) {
      const s = score[t];
      if (s > rawMax) rawMax = s;
      // Soft Gaussian likelihood, LUT-evaluated. A distant candidate is never
      // rejected outright; it just weighs progressively less.
      const shaded = hasPrior ? s * this.priorWeight(t - pPrev, sigInv) : s;
      if (shaded > shadedMax) shadedMax = shaded;
    }

    const bestT = this.pickShortestPeak(tMin, tMax, shadedMax * MPM_THRESHOLD, hasPrior, pPrev, sigInv);

    // Escape hatch: the octave-resolved winner of the UNSHADED surface. If it
    // keeps beating the incumbent by a clear margin for several consecutive
    // evaluations it is a real tempo change (DJ transition), not noise —
    // without this the prior would lock us out of the new tempo forever.
    let winnerT = bestT;
    if (hasPrior) {
      const rawT = this.pickShortestPeak(tMin, tMax, rawMax * MPM_THRESHOLD, false, 0, 0);
      if (rawT !== bestT && score[rawT] > score[bestT] * CHALLENGER_RATIO) {
        if (rawT === this.challengerLag) {
          this.challengerFrames = (this.challengerFrames + 1) | 0;
        } else {
          this.challengerLag = rawT;
          this.challengerFrames = 1;
        }
        if (this.challengerFrames >= CHALLENGER_CONFIRM) {
          winnerT = rawT;
          this.challengerLag = 0;
          this.challengerFrames = 0;
        }
      } else {
        this.challengerLag = 0;
        this.challengerFrames = 0;
      }
    }

    // ─── PASS 4: emit the already-refined sub-frame lag ───────────────────
    const tau = tauRef[winnerT];

    this.prevLag = tau;
    const y0 = this.lerpNsdf(tau);
    this.lastPeak = y0;
    this.lastBpm = tau > 0 ? (60.0 * this.odfRate) / tau : 0;

    // Confidence: NSDF peak height (how periodic) × ladder coherence (how
    // metrically consistent), remapped through the empirical calibration
    // anchors, attenuated while the ring is still filling.
    let peak = (y0 - CONF_FLOOR) / (CONF_CEIL - CONF_FLOOR);
    if (peak < 0) peak = 0;
    else if (peak > 1) peak = 1;

    let harmonicity = score[winnerT] / LADDER_SUM;
    if (harmonicity < 0) harmonicity = 0;
    else if (harmonicity > 1) harmonicity = 1;

    let fill = n / (RING_SIZE * WARMUP_FILL);
    if (fill > 1) fill = 1;

    this.lastConfidence = peak * harmonicity * fill;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // EVALUATION HELPERS
  //
  // All are private, single-call-site, fixed-signature (number → number) and
  // allocation-free, so TurboFan inlines the whole set into `evaluate()`.
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Parabolic vertex of the NSDF around integer lag `t`.
   *
   * THIS is the mechanism that defeats the ±4 BPM quantization. Integer lags
   * at a 21.5 Hz ODF only permit a coarse BPM grid (e.g. lag 10 → 129.2 BPM,
   * lag 11 → 117.4 BPM); recovering the vertex between them yields a
   * continuous estimate. Measured worst-case error across the 90–174 BPM
   * sweep: 0.72 BPM.
   *
   * Returns `t` unchanged unless the sample is a genuine concave local
   * maximum — never extrapolate off a shoulder.
   */
  private parabolicRefine(t: number): number {
    if (t < 2 || t + 1 > this.tauHi) return t;
    const nsdf = this.nsdf;
    const y0 = nsdf[t];
    const ym = nsdf[t - 1];
    const yp = nsdf[t + 1];
    const denom = ym - 2.0 * y0 + yp;
    if (!(denom < -1e-9) || y0 < ym || y0 < yp) return t;
    let delta = 0.5 * (ym - yp) / denom;
    if (delta > 0.5) delta = 0.5;
    else if (delta < -0.5) delta = -0.5;
    return t + delta;
  }

  /** Linearly interpolated NSDF at a fractional lag. Out-of-band → 0, so a
   *  harmonic that falls off the computed surface simply contributes nothing
   *  instead of reading stale data. */
  private lerpNsdf(x: number): number {
    if (x < 1 || x + 1 > this.tauHi) return 0;
    const i = x | 0;
    const f = x - i;
    const nsdf = this.nsdf;
    const a = nsdf[i];
    return a + f * (nsdf[i + 1] - a);
  }

  /** Gaussian tempo prior from the LUT — no transcendental in the hot path. */
  private priorWeight(deltaLag: number, sigInv: number): number {
    let u = deltaLag * sigInv;
    if (u < 0) u = -u;
    const idx = (u * PRIOR_LUT_STEP) | 0;
    return idx < PRIOR_LUT_N ? this.priorLut[idx] : 0.0;
  }

  /**
   * MPM octave rule: the SHORTEST local maximum clearing `threshold`.
   *
   * The harmonic ladder cannot break an octave tie by itself — a pulse train
   * of period P is genuinely periodic at 2P, so both score almost identically
   * (measured 1.80 vs 1.84 at 150 BPM, with the half-time impostor winning).
   * Of two equally valid explanations the faster pulse is the true one; the
   * slower is an artefact of the beat also repeating every second beat.
   *
   * Falls back to the global argmax when nothing clears the threshold.
   */
  private pickShortestPeak(
    tMin: number,
    tMax: number,
    threshold: number,
    shade: boolean,
    pPrev: number,
    sigInv: number
  ): number {
    const score = this.score;
    let fallbackT = tMin;
    let fallbackS = -Infinity;
    let prev = -Infinity;

    for (let t = tMin; t <= tMax; t++) {
      const s = shade ? score[t] * this.priorWeight(t - pPrev, sigInv) : score[t];
      if (s > fallbackS) {
        fallbackS = s;
        fallbackT = t;
      }
      if (s >= threshold) {
        const nextS =
          t < tMax
            ? shade
              ? score[t + 1] * this.priorWeight(t + 1 - pPrev, sigInv)
              : score[t + 1]
            : -Infinity;
        if (s >= prev && s >= nextS) return t;
      }
      prev = s;
    }
    return fallbackT;
  }
}
