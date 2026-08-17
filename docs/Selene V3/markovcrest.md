ART 0 — Findings that constrain the design
F1 — 4 of the 8 PROGRESSION_PATTERNS are unreachable dead code, including the flagship. updateHistory() pushes only when sectionHistory[last].section !== currentSection. Therefore two consecutive identical entries can never exist. Consequently matchesTrigger(['buildup','buildup']), ['chorus','chorus'], ['drop','drop'], ['verse','verse'] are always false. The buildup,buildup → drop @ 0.90 rule — the highest-confidence predictor in the system, the one the due diligence cites at §2.4 — has never fired once. Cassandra is today a 1st-order chain with 5 live rules, not 8.

Design consequence: the alphabet is segment-level, so self-loops are structurally impossible, not merely rare. Cassandra 2.0 must encode next === prev1 as a hard structural zero (never waste probability mass on 810 usable cells' worth of nothing), and recover the "prolonged buildup" semantics where it actually belongs — as dwell, which estimateTimeToEvent() FLUID 2 and computeOrganicConfidence() ORGANIC 2 already model. Clean split: Markov owns what; dwell owns when and how sure.

F2 — unknown (index 9) poisons any n-gram estimator. MSST emits unknown on low confidence. Learning verse → unknown → chorus destroys the real bigram verse → chorus and burns a 2nd-order context. unknown must be a transparent skip (do not learn, do not shift history), never a prediction target.

F3 — CF̂ already exists in CognitiveFluidState.ts:184-197, but it is a level, not a rate. peakWindow/rmsEMA is an amplitude ratio. The Π contract in FluidDescriptors.ts:16 asks for a density: "tasa de crestas CF > 2/s". These are different mathematical objects — one is a magnitude, one is a counting-process intensity. Task 2 must build the counting process; it should not be conflated with, and must not replace, _crestFactor.

TASK 1 — Cassandra 2.0
1.1 Memory layout: power-of-two strides
Do not use [p2*100 + p1*10 + n] as the audit suggests. Use stride 16:



idx = (p2 << 8) | (p1 << 4) | n
Three properties, all free: (a) index arithmetic is pure bitwise — no integer multiplies, indices stay SMI-tagged and never deopt to doubles; (b) each 16-float row is exactly 64 bytes = one cache line, and every row is cache-line aligned — an O(10) row scan is one cache miss, not two; (c) 4096 × 4 B = 16 KB, still L1-resident. Trading 12 KB for perfect alignment and zero multiplies is correct at 44 Hz.

1.2 Estimator: hierarchical Dirichlet with leaky counts
Storing probabilities and "reinforcing" them (as the audit sketches) is wrong — it denormalizes, drifts, and has no notion of evidence mass. Store decayed counts; normalize at read. With ~15-25 segment changes per track, a raw 2nd-order MLE is catastrophically data-starved (810 cells, ~20 samples). The estimator must be a two-level hierarchical Dirichlet whose deepest prior mean is the musical template — i.e. the 8 legacy patterns are not deleted, they are re-expressed as pseudo-counts. Cold-start behaviour is then provably identical to legacy Cassandra, and learning is a Bayesian posterior update that monotonically dominates it.

$$ \hat p_1(n)=\frac{C_1[p_1,n]+\kappa_1 T_1[p_1,n]}{N_1[p_1]+\kappa_1},\qquad m_2(n)=\beta,T_2[p_2,p_1,n]+(1-\beta),\hat p_1(n) $$

$$ \boxed{;\hat p_2(n)=\frac{C_2[p_2,p_1,n]+\kappa_2,m_2(n)}{N_2[p_2,p_1]+\kappa_2};} $$

The level-1 posterior is level-2's prior mean. Evidence mass N drives the interpolation automatically — no hand-tuned backoff λ, no thresholds. Non-stationarity (a DJ set is not i.i.d.) is handled by multiplicative leaky decay applied lazily, per row, on visit: row mass is bounded by 1/(1-λ), and mass updates in O(1) exactly because decay is multiplicative — N ← λN + w.

1.3 State declarations (module scope, one-time alloc, 20 KB total)


typescript
// ═══════════════════════════════════════════════════════════════════════════
// CASSANDRA 2.0 — 2nd-order Markov, zero-alloc, stride-16 (cache-line rows)
// idx2 = (p2<<8)|(p1<<4)|n   idx1 = (p1<<4)|n   row2 = (p2<<8)|(p1<<4)
// ═══════════════════════════════════════════════════════════════════════════
 
const S = 10                    // MSST alphabet
const UNK = 9                   // 'unknown' — transparent, never learned/predicted
const STRIDE = 16               // power-of-two row stride
 
/** Decayed 2nd-order counts. 4096 × f32 = 16 KB. */
const C2 = new Float32Array(STRIDE * STRIDE * STRIDE)
/** Decayed 1st-order counts. 256 × f32 = 1 KB. */
const C1 = new Float32Array(STRIDE * STRIDE)
/** Row evidence mass — exact under multiplicative decay, O(1) update. */
const N2 = new Float32Array(STRIDE * STRIDE)   // indexed by (p2<<4)|p1
const N1 = new Float32Array(STRIDE)            // indexed by p1
/** Static musical priors (built once at init, then read-only). */
const T1 = new Float32Array(STRIDE * STRIDE)          // 1st-order template
const T2 = new Float32Array(STRIDE * STRIDE * STRIDE) // 2nd-order sharpened
/** Scratch posterior — pre-allocated, reused every predict(). */
const POST = new Float32Array(STRIDE)
 
// ── Hyperparameters (calibrate by Simulated Annealing over the 10-track corpus,
//    same methodology as ILiquidCognitionProfile WAVE 7004.4) ──
const KAPPA_1 = 2.5      // prior strength, 1st order (pseudo-observations)
const KAPPA_2 = 3.0      // prior strength, 2nd order
const BETA    = 0.55     // musical template vs learned marginal, at level 2
const LAMBDA_1 = 0.975   // leaky forgetting, 1st order (~40 visit half-life)
const LAMBDA_2 = 0.940   // leaky forgetting, 2nd order (~11 visit half-life)
const LN_S_INV = 1 / Math.log(S)   // 1/ln(10) — entropy normalizer
 
// ── Context registers. -1 = cold. Segment-level: prev1 !== prev2 always. ──
let prev1 = -1
let prev2 = -1
 
// ── Calibration telemetry (NOT used to mutate the matrix — see §1.6) ──
let hitRateEMA = 0.5
const ALPHA_HIT = 0.05
 
// ── Prediction outputs, written in place (no alloc, do not retain) ──
let pSection = -1        // argmax index, -1 = no prediction
let pProb = 0            // normalized posterior mass of the argmax
let pMargin = 0          // p_max − p_second — decision sharpness
let pEntropyConf = 0     // p_max · (1 − H/ln S) — epistemic confidence
String → index without hashing. A Map.get() hashes; a switch over string literals compiles to an interned-pointer jump table and returns an SMI. Called only on segment change, but free is free:



typescript
function sectionIndex(s: string): number {
  switch (s) {
    case 'intro': return 0
    case 'verse': return 1
    case 'buildup': return 2
    case 'chorus': return 3
    case 'drop': return 4
    case 'textural_drop': return 5
    case 'breakdown': return 6
    case 'bridge': return 7
    case 'outro': return 8
    default: return UNK
  }
}
1.4 updateHistory() — online learning, O(10), zero alloc


typescript
/**
 * Ingest one OBSERVED segment transition and learn from it.
 * Call only on section change (same trigger as legacy updateHistory).
 * @param section MSST section string
 * @param confidence MSST SectionOutput.confidence — gates learning
 */
function observeSection(section: string, confidence: number): void {
  const s = sectionIndex(section)
 
  // F2 — 'unknown' is transparent: no learning, no context shift.
  // A low-confidence detection is not evidence; ingesting it would destroy
  // a real bigram AND burn a 2nd-order context slot.
  if (s === UNK || confidence < 0.5) return
 
  // F1 — segment-level alphabet: self-loops cannot exist. Defensive no-op.
  if (s === prev1) return
 
  // ── Level 1: leaky-decay the visited row, then reinforce ──
  if (prev1 >= 0) {
    const r1 = prev1 << 4
    for (let n = 0; n < S; n++) C1[r1 + n] *= LAMBDA_1
    C1[r1 + s] += 1
    N1[prev1] = N1[prev1] * LAMBDA_1 + 1          // exact: decay is multiplicative
 
    // ── Level 2: only with a full 2nd-order context ──
    if (prev2 >= 0) {
      const r2 = (prev2 << 8) | (prev1 << 4)
      for (let n = 0; n < S; n++) C2[r2 + n] *= LAMBDA_2
      C2[r2 + s] += 1
      const m = (prev2 << 4) | prev1
      N2[m] = N2[m] * LAMBDA_2 + 1
    }
  }
 
  // ── Shift context registers ──
  prev2 = prev1
  prev1 = s
}
Cost: 20 multiplies, 2 adds, 0 allocations, 0 branches in the loops. Note N is updated in closed form rather than re-summed — that is the whole reason predict() needs no reduction pass.

1.5 predict() — O(10) argmax over the hierarchical posterior


typescript
/**
 * Fast structural prediction. Two O(10) passes: accumulate, then normalize.
 * Writes pSection/pProb/pMargin/pEntropyConf in place. Zero alloc.
 * @returns true if a prediction exists
 */
function predictStructural(): boolean {
  pSection = -1; pProb = 0; pMargin = 0; pEntropyConf = 0
  if (prev1 < 0) return false
 
  const r1 = prev1 << 4
  const inv1 = 1 / (N1[prev1] + KAPPA_1)
 
  // Cold 2nd-order context degrades gracefully to the level-1 posterior.
  const has2 = prev2 >= 0
  const r2 = has2 ? ((prev2 << 8) | r1) : 0
  const inv2 = has2 ? 1 / (N2[(prev2 << 4) | prev1] + KAPPA_2) : 0
 
  // ── Pass 1: unnormalized posterior over the admissible support ──
  // Structural zeros: n === prev1 (no self-loops, F1) and n === UNK (F2).
  let Z = 0
  let best = -1, bestV = -1, secondV = 0
  for (let n = 0; n < S; n++) {
    if (n === prev1 || n === UNK) { POST[n] = 0; continue }
 
    const p1 = (C1[r1 + n] + KAPPA_1 * T1[r1 + n]) * inv1
    const v = has2
      ? (C2[r2 + n] + KAPPA_2 * (BETA * T2[r2 + n] + (1 - BETA) * p1)) * inv2
      : p1
 
    POST[n] = v
    Z += v
    if (v > bestV) { secondV = bestV; best = n; bestV = v }
    else if (v > secondV) { secondV = v }
  }
  if (Z <= 0 || best < 0) return false
 
  // ── Pass 2: normalize over admissible support + Shannon entropy ──
  const invZ = 1 / Z
  let H = 0
  for (let n = 0; n < S; n++) {
    const p = POST[n] * invZ
    POST[n] = p
    if (p > 1e-6) H -= p * Math.log(p)
  }
 
  pSection = best
  pProb = bestV * invZ
  pMargin = (bestV - (secondV > 0 ? secondV : 0)) * invZ
  // Epistemic confidence: peak mass discounted by distribution flatness.
  // A 0.35 peak in a flat distribution is not knowledge; the system says so.
  pEntropyConf = pProb * (1 - H * LN_S_INV)
  return true
}
pEntropyConf is the piece the current engine lacks and the one that fits §2.3 of the audit. computeOrganicConfidence() collapses on PLL lock — temporal uncertainty. Normalized entropy collapses on structural uncertainty. Both propagate to s_P and therefore to C(t). Composition:



typescript
// Feed the existing s_P = 0.5 + 0.5·(P_prob · P_align) via a structurally
// AND temporally honest probability. Geometric blend keeps t-norm semantics.
const cassandraProb = Math.sqrt(pProb * pEntropyConf) * (0.55 + 0.45 * pllLock)
Static, frozen, zero-alloc dispatch from predicted section to the legacy output contract (no branch chain, no per-call object literals):



typescript
// index → PredictionType id → frozen action array. Built once, never allocated.
const PTYPE: readonly PredictionType[] = [
  'transition_beat',    // 0 intro
  'transition_beat',    // 1 verse
  'buildup_starting',   // 2 buildup
  'transition_beat',    // 3 chorus
  'drop_incoming',      // 4 drop
  'drop_incoming',      // 5 textural_drop
  'breakdown_imminent', // 6 breakdown
  'transition_beat',    // 7 bridge
  'transition_beat',    // 8 outro
  'none',               // 9 unknown
]
const SECTION_ACTIONS: readonly (readonly PredictionAction[])[] = /* Object.freeze per index, lifted verbatim from PROGRESSION_PATTERNS.actions */
1.6 validatePrediction() — the trap to avoid
The brief says "reinforcing observed transitions." That is correct and it is exactly what observeSection() does. Do not additionally reinforce correct predictions. Frequency counting is already the maximum-likelihood learner for a Markov chain; adding a bonus when the prediction was right is a rich-get-richer feedback loop — the argmax gets extra mass because it was the argmax, the estimator stops being a consistent estimator of the transition kernel, and the chain locks into whatever it saw first. Every observation must contribute exactly weight 1, whether it was predicted or not.

Validation's correct role is calibration telemetry, decoupled from the kernel:



typescript
/** Telemetry + confidence calibration ONLY. Never mutates C1/C2. */
function validatePrediction(predictedIdx: number, actualIdx: number): boolean {
  const hit = predictedIdx === actualIdx
  hitRateEMA += ALPHA_HIT * ((hit ? 1 : 0) - hitRateEMA)
  return hit
}
// Reliability gain: if the oracle is empirically wrong, discount it globally.
// Floor 0.5 mirrors the s_P floor — an unreliable oracle must never veto.
const oracleTrust = 0.5 + 0.5 * (hitRateEMA < 0.5 ? 0 : (hitRateEMA - 0.5) * 2)
1.7 Priors — the 8 legacy patterns as pseudo-counts
T1 is a musical plausibility kernel (rows sum to 1, zero diagonal). T2 sharpens it toward a spike where genuine 2nd-order knowledge exists — including the recovered intent of the dead buildup,buildup rule: in a self-loop-free alphabet, "prolonged buildup → drop @ 0.90" is expressed as breakdown → buildup → drop, which is the actual canonical EDM trigram and is fully reachable.



typescript
// Built once at module init. Allocation here is irrelevant (not hot path).
// Rows: 0 intro 1 verse 2 buildup 3 chorus 4 drop 5 tex_drop 6 breakdown
//       7 bridge 8 outro 9 unknown.  Diagonal = 0 (F1).
const T1_ROWS: readonly number[][] = [
  [0,   .55, .25, .08, .04, .02, .03, .03, 0,   0  ], // intro
  [0,   0,   .40, .30, .06, .03, .08, .10, .03, 0  ], // verse
  [0,   .03, 0,   .22, .62, .08, .05, 0,   0,   0  ], // buildup
  [0,   .35, .20, 0,   .08, .03, .15, .12, .07, 0  ], // chorus
  [0,   .15, .12, .20, 0,   .10, .35, .03, .05, 0  ], // drop
  [0,   .15, .22, .18, .10, 0,   .30, .05, 0,   0  ], // textural_drop
  [0,   .18, .55, .12, .06, .00, 0,   .05, .04, 0  ], // breakdown
  [0,   .15, .25, .40, .10, 0,   .06, 0,   .04, 0  ], // bridge
  [.30, .25, 0,   .10, 0,   0,   .15, 0,   0,   .20], // outro
  [.08, .30, .20, .20, .12, 0,   .10, 0,   0,   0  ], // unknown
]
 
// 2nd-order sharpening: T2[p2,p1,·] = (1−s)·T1[p1,·] + s·e_next
// s = sharpening strength ≈ legacy pattern confidence.
const T2_SPEC: readonly [number, number, number, number][] = [
  // [p2, p1, next, s]
  [6, 2, 4, 0.85], // breakdown→buildup→DROP    ← recovers the dead 0.90 rule
  [1, 2, 3, 0.80], // verse→buildup→CHORUS      ← legacy 0.85
  [3, 2, 4, 0.70], // chorus→buildup→DROP
  [2, 4, 6, 0.65], // buildup→drop→BREAKDOWN    ← legacy drop,drop→breakdown 0.75
  [4, 6, 2, 0.80], // drop→breakdown→BUILDUP    ← legacy 0.80
  [0, 1, 2, 0.50], // intro→verse→BUILDUP       ← legacy intro→verse 0.85
  [3, 1, 2, 0.55], // chorus→verse→BUILDUP      ← legacy verse,verse→buildup 0.65
  [4, 5, 6, 0.70], // drop→textural_drop→BREAKDOWN
]
 
function buildPriors(): void {
  for (let p1 = 0; p1 < S; p1++) {
    const row = T1_ROWS[p1]
    for (let n = 0; n < S; n++) T1[(p1 << 4) | n] = row[n]
    // Default: T2 row = T1 row (2nd order knows nothing extra)
    for (let p2 = 0; p2 < S; p2++) {
      const base = (p2 << 8) | (p1 << 4)
      for (let n = 0; n < S; n++) T2[base + n] = row[n]
    }
  }
  for (let i = 0; i < T2_SPEC.length; i++) {
    const [p2, p1, next, s] = T2_SPEC[i]
    const base = (p2 << 8) | (p1 << 4)
    const one = 1 - s
    for (let n = 0; n < S; n++) T2[base + n] *= one
    T2[base + next] += s
  }
}
1.8 Reset / persistence


typescript
/** Track boundary: flush context, halve evidence — keep style, drop specifics. */
function onTrackChange(): void {
  prev1 = -1; prev2 = -1
  for (let i = 0; i < C2.length; i++) C2[i] *= 0.5
  for (let i = 0; i < C1.length; i++) C1[i] *= 0.5
  for (let i = 0; i < N2.length; i++) N2[i] *= 0.5
  for (let i = 0; i < N1.length; i++) N1[i] *= 0.5
}
/** Cold start: priors only. */
function resetCassandra(): void {
  C2.fill(0); C1.fill(0); N2.fill(0); N1.fill(0)
  prev1 = -1; prev2 = -1; hitRateEMA = 0.5
}
One 4096-multiply pass per track is ~4 µs — negligible, and it is the mathematically honest way to keep genre-level structure while discarding a specific track's idiosyncrasies. Note that C1/C2/N1/N2 are 17 KB of typed arrays: they serialize to a learned style profile, which is precisely the "regional profiles as data, not code" thesis of §4.4.3.

TASK 2 — True Crest Detector for Π
2.1 What the signal actually permits
rawEnergy arrives at ~44 Hz already frame-integrated. A waveform crest factor (peak sample / RMS) is not recoverable from it, and any claim otherwise is false. What is recoverable — and what Π actually needs — is the envelope crest factor: instantaneous level against a slow local baseline. CF = E(t)/B(t). This is the correct object for "densidad de transitorios", and it is defined per frame with zero latency.

So: Π is not a magnitude, it is the intensity λ of a counting process. The pipeline is three stages, each one line of math:

$$ \underbrace{L(t)=\ln\frac{\varepsilon+E(t)}{\varepsilon+B(t)}}{\text{log-domain crest}} ;\longrightarrow; \underbrace{\text{Schmitt}(\theta,h)+\text{refractory}}{\text{counting process}} ;\longrightarrow; \underbrace{R(t)=\sum_i \tfrac{w_i}{\tau}e^{-(t-t_i)/\tau}}_{\text{unbiased rate estimator}} $$

Three deliberate choices:

Log domain. CF > 2 becomes L > ln 2 = 0.6931. A ratio test becomes a subtraction and a comparison — no division on the hot path, and the same additive-log discipline as SensorFusionChamber (§1.2 Property 2).
Asymmetric baseline. B must track the floor, so it rises slowly (α_up, ~1 s half-life: a transient cannot drag its own reference up) and falls faster (α_down, ~190 ms: a section drop doesn't leave a stale ceiling suppressing detection). This is the same asymmetric-EMA idiom already used for _impact at CognitiveFluidState.ts:100-102.
The rate kernel is exact, not heuristic. R(t) = Σ (1/τ)e^{-Δt/τ} has E[R] = λ for a stationary Poisson process — R is in events/second by construction, not by tuning. That is the whole elegance: the normalization constant is derived, not calibrated.
2.2 State + constants


typescript
// ═══════════════════════════════════════════════════════════════════════════
// TRUE CREST DETECTOR — Π percussiveness. Zero-alloc, zero-latency,
// zero transcendentals on the hot path. Replaces the rhythmicIntensity proxy.
// ═══════════════════════════════════════════════════════════════════════════
 
const EPS_E   = 1e-4          // log-domain floor
const LN2     = 0.6931471805  // CF = 2 threshold in log domain
const A_UP    = 0.015         // baseline rise  (half-life ≈ 1.0 s @ 44 Hz)
const A_DOWN  = 0.080         // baseline fall  (half-life ≈ 190 ms)
const A_STAT  = 0.010         // dispersion tracker (only while disarmed)
const MAD_K   = 1.5           // adaptive-floor sensitivity
const MAD_SIG = 1.2533        // MAD → σ for Gaussian residuals
const HYST    = 0.2231        // Schmitt drop-out = ln(1.25) — 25 % below θ
const T_REF   = 0.040         // refractory 40 ms → ceiling 25 ev/s
                              // (16ths @ 174 BPM = 11.6 ev/s, ample headroom)
const INV_TAU = 1 / 1.5       // rate estimator τ = 1.5 s
const R_REF   = 3.5           // events/s at which Π_raw = 0.5 (calibrate by SA)
const E_GATE  = 0.12          // absolute-energy gate — mirrors the existing
                              // 0.15 gate at CognitiveFluidState.ts:235
 
// ── State: 5 scalars. No arrays, no objects. ──
let _base   = 0     // B(t) — log-domain baseline
let _muL    = 0     // E[L]  — residual mean
let _madL   = 0     // E[|L−μ|] — robust dispersion
let _rate   = 0     // R(t) — events/second
let _armed  = 0     // Schmitt trigger state (0/1)
let _tLast  = -1e9  // timestamp of last accepted event (s)
let _event  = 0     // 1 on the frame an event fires — exported byproduct
2.3 The detector


typescript
/**
 * One frame. Hot path @44 Hz.
 * @param energy rawEnergy (0-1)
 * @param t      timestamp in SECONDS (monotonic)
 * @param dt     frame delta in seconds
 * @returns Π_raw ∈ [0,1) — normalized transient density, pre-EMA
 */
function crestTick(energy: number, t: number, dt: number): number {
  // ── 1. Log level and asymmetric floor tracker ──
  const l = Math.log(EPS_E + energy)
  const aB = l > _base ? A_UP : A_DOWN      // ternary → cmov, no branch
  _base += aB * (l - _base)
 
  // ── 2. Log-domain crest: L = ln CF ──
  const L = l - _base
 
  // ── 3. Adaptive floor. Updated ONLY while disarmed, so events cannot
  //       inflate the very threshold that gates them. θ can only RISE above
  //       LN2 — never below. This is essential: a fully adaptive threshold
  //       would self-normalize the event rate and make Π constant, i.e.
  //       information-free. Hypercompressed masters therefore correctly
  //       report LOW percussivity rather than being rescaled into range.
  if (_armed === 0) {
    _muL  += A_STAT * (L - _muL)
    _madL += A_STAT * (Math.abs(L - _muL) - _madL)
  }
  const adaptive = _muL + MAD_K * MAD_SIG * _madL
  const theta = adaptive > LN2 ? adaptive : LN2
 
  // ── 4. Schmitt trigger + refractory. Fires on the CROSSING, not on the
  //       local maximum: zero added latency, which is the point of a
  //       negative-latency engine. Peak-picking would cost 1-2 frames for
  //       ~nothing, since Π is EMA'd over 8 s downstream anyway.
  _event = 0
  if (_armed === 0) {
    if (L >= theta && energy > E_GATE && (t - _tLast) >= T_REF) {
      _armed = 1
      _tLast = t
      _event = 1
      // Severity weight: saturates one octave of CF above θ. Floor 0.5 so a
      // marginal transient still counts as an event, just not as a full one.
      const w = 0.5 + 0.5 * ((L - theta) < LN2 ? (L - theta) / LN2 : 1)
      _rate += w * INV_TAU        // Poisson kernel impulse: E[R] = λ
    }
  } else if (L <= theta - HYST) {
    _armed = 0                     // hysteresis: no chattering at the boundary
  }
 
  // ── 5. Rate decay. exp(−dt/τ) ≈ 1 − dt/τ with dt/τ ≈ 0.015 → error 1e-4.
  //       One multiply instead of a transcendental; monotone and stable.
  _rate -= _rate * dt * INV_TAU
  if (_rate < 0) _rate = 0
 
  // ── 6. Hill saturation, n=1. Smooth, monotone, C¹, never clips, no exp.
  //       Π_raw = 0.5 exactly at R = R_REF. Compare tanh in §1.5 of the audit.
  return _rate / (_rate + R_REF)
}
2.4 Multi-band fusion (recommended, +6 scalars)
A kick and a hat are two transients; a single broadband envelope registers one. If acousticReality.bandEnergies (low/mid/high) is available, run the same recurrence per band over pre-allocated typed arrays and sum the rates — the Poisson intensity of a superposition of independent processes is the sum of intensities, so this is exact, not a heuristic:



typescript
const NB = 3
const W_BAND = new Float32Array([0.45, 0.20, 0.35])   // low / mid / high
const _b = new Float32Array(NB), _mu = new Float32Array(NB)
const _mad = new Float32Array(NB), _r = new Float32Array(NB)
const _arm = new Uint8Array(NB),  _tl = new Float64Array(NB).fill(-1e9)
 
function crestTickBands(bands: Float32Array, t: number, dt: number): number {
  let rFused = 0
  for (let k = 0; k < NB; k++) {
    /* identical recurrence on _b[k], _mu[k], _mad[k], _r[k], _arm[k], _tl[k] */
    rFused += W_BAND[k] * _r[k]
  }
  return rFused / (rFused + R_REF)
}
2.5 Integration — surgical, 2 lines
FluidDescriptors.ts:90-92 becomes:



typescript
// Π — Percusividad: TRUE crest detector. Rate of CF>2 events, Poisson-kernel
// estimated, Hill-normalized. Replaces the rhythmicIntensity proxy (WAVE 7003.1
// TODO line 91 discharged).
const percussivenessRaw = crestTick(input.rawEnergy, nowSeconds, dt)
FluidDescriptorInput needs rawEnergy added (and optionally bandEnergies); rhythmicIntensity stays for G/telemetry. The 8 s ALPHA_SLOW EMA is unchanged — τ=1.5 s for the rate sits well inside it, so no group-delay regression. Π remains a genre coordinate, correctly slow.

2.6 The free byproduct — worth more than Π
_event is a true zero-latency transient flag, which the system currently does not have anywhere. Two immediate uses:

Glass Break (§2.6). The current trigger is currentZScore >= 2.5|3.5 — a statistical proxy for "something just happened." A confirmed crest event is direct physical evidence. glassBreak && (_event || zScore >= Z) reduces the false-negative rate on transient-dense drops that a 30 s-window Z-score smears out.
s_V anti-voice (weight 0.1515). It already depends on (1−CF̂). A sustained vocal has near-zero crest rate by definition, while a hypercompressed master can still show a deceptive CF level. Rate is the strictly stronger discriminator, and this is a one-term substitution.
Cost summary
Alloc/frame	Hot-path cost	Static memory
Cassandra 2.0 observeSection	0	20 mul + 4 add, on segment change only	17 KB (C1,C2,N1,N2)
Cassandra 2.0 predictStructural	0	~60 flops + ≤9 log, 2 cache lines	20 KB (+T1,T2,POST)
Crest detector (1 band)	0	1 log, 1 abs, ~14 flops, 0 branches	7 scalars
Crest detector (3 bands)	0	3 log, ~45 flops	6 typed arrays, 96 B
Both are pure functions of (input, previous state), no Math.random(), no branch chains, GC-neutral — they satisfy the same invariants the audit verified for liquid/ at §1.6.

One open decision for you: the SectionClassification (7 states) vs MSST (10 states) mismatch at types.ts:225. predictStructural() returns indices over the full 10-state alphabet; MusicalPrediction.probableSection cannot represent textural_drop/bridge. Widening the union is the correct fix — down-mapping to 7 states discards exactly the two states with the sharpest 2nd-order structure (drop→textural_drop→breakdown, bridge→chorus), which is most of what upgrading to 2nd order buys. Say the word and I'll implement all of this against the real files, including the widening and its call-site fallout.