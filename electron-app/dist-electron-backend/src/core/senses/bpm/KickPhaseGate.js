/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 KICK PHASE GATE — Zero-Allocation Onset & Beat-Phase Source
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Companion to TempoOracle. Blueprint §7 splits the two classical PLL roles:
 *
 *     TempoOracle    → FREQUENCY (what the tempo is)
 *     KickPhaseGate  → PHASE     (where the downbeat is)
 *
 * This is the textbook architecture and it is why the transplant works: the
 * legacy IntervalBPMTracker conflated both, so every kick-timing error became
 * a BPM error. Here a mistimed kick only nudges the phase; the tempo is
 * unaffected because it comes from ~8 s of correlated ODF history.
 *
 * The gate reproduces exactly the three outputs the rest of the system still
 * depends on — and nothing else:
 *
 *   - `kickDetected`  → BeatDetector.feedKick() → PLL phase correction
 *   - `kickCount`     → MusicalContext.beatCount (monotonic beat counter)
 *   - `beatPhase`     → MusicalContext.beatPhase (crossfaded against the PLL)
 *
 * ───── DETECTION LOGIC ─────────────────────────────────────────────────────
 * The input needle has ALREADY passed two physical gates upstream
 * (GatedNeedlePipeline): the adaptive-floor gate and the spectral-centroid
 * gate that separates kick (<800 Hz) from hi-hat (>1500 Hz). A needle > 0 is
 * therefore already a strong onset candidate. The gate adds only what the
 * upstream cannot know:
 *
 *   1. FLOOR RATIO      — needle must clear the adaptive floor by a margin,
 *                         rejecting borderline flux riding the noise band.
 *   2. ADAPTIVE DEBOUNCE — max(200 ms, beatInterval × 0.40). The 0.40 factor
 *                         is preserved verbatim from WAVE 1163.3; it is the
 *                         value that breaks the vicious feedback cycle at
 *                         160 BPM (0.65 caused a half-BPM lock). Unlike the
 *                         legacy tracker, the beat interval now comes from
 *                         the Oracle, so the debounce is correct from the
 *                         first lock instead of bootstrapping off its own
 *                         possibly-wrong output.
 *   3. PEAK DISCRIMINATOR — after enough kicks, reject candidates far weaker
 *                         than the running peak. Offbeats and bass-synth
 *                         bleed pass the floor test but are consistently
 *                         weaker than the kick.
 *
 * Deliberately NOT ported from the legacy tracker: the absolute
 * MIN_KICK_ENERGY = 0.150 threshold. That constant was calibrated for raw
 * pre-AGC bass ENERGY, but the tracker was later fed the needle (a flux
 * DELTA whose adaptive floor lives in [0.005, 0.060]) — so it was gating a
 * signal three orders of magnitude smaller than its calibration domain. The
 * floor-relative ratio below is the dimensionally correct replacement.
 *
 * ───── ZERO ALLOCATION ─────────────────────────────────────────────────────
 * Pure scalar state. No buffers at all: the legacy 24-slot circular energy
 * average is gone — the adaptive floor already supplies the rolling reference,
 * and the amplitude reference is a single decaying scalar.
 *
 * @see docs/technical_audits/AUTOCORRELATION_BLUEPRINT.md §7
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
/** Absolute minimum gap between kicks. 200 ms = 300 BPM ceiling — more than
 *  enough for any electronic music, and the reason WAVE 2175 reverted the
 *  300 ms experiment (it frame-quantized legitimate 185 BPM intervals away). */
const MIN_INTERVAL_MS = 200;
/** Fraction of the expected beat interval used as the debounce floor.
 *  THE MAGIC NUMBER from WAVE 1163.3 — do not raise it. */
const DEBOUNCE_FACTOR = 0.40;
/** The needle must exceed the adaptive floor by this factor to count as a
 *  kick. The floor is already ~40 % of the recent flux median, so 1.5× puts
 *  the trigger at ~60 % of the median flux peak. */
const FLOOR_RATIO = 1.5;
/** Running-peak decay per frame. 0.995 ≈ 200-frame memory (~9 s), so the
 *  reference tracks verse→drop→breakdown dynamics without forgetting. */
const PEAK_DECAY = 0.995;
/** A candidate must reach this fraction of the running peak. 0.65 filters
 *  offbeats (typically <30 % of kick energy) while accepting softer kicks in
 *  verses and breakdowns. */
const PEAK_DISCRIMINATOR_RATIO = 0.65;
/** Kicks required before the peak discriminator arms. Before this, accept
 *  everything so the gate can lock in from cold. */
const PEAK_DISCRIMINATOR_MIN_KICKS = 6;
/** After this long with no kick, stop advancing the phase — a stale phase
 *  spinning through silence produces phantom downbeats. The PLL has its own
 *  4 s freewheel/silence veil; this is the worker-side equivalent. */
const PHASE_STALE_MS = 4000;
// ═══════════════════════════════════════════════════════════════════════════
// THE GATE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Onset gate and beat-phase accumulator.
 *
 * All state is scalar and seeded with real doubles in the constructor, so the
 * instance holds one hidden class for its whole life and every field access
 * is a monomorphic inline-cache hit.
 */
export class KickPhaseGate {
    constructor() {
        this.peakEstimate = 0;
        this.lastKickTs = 0;
        this.phaseAnchorTs = 0;
        this.totalKicks = 0;
        this.kickThisFrame = false;
        this.currentPhase = 0;
    }
    /** True if an onset was accepted on the most recent frame. */
    get kickDetected() {
        return this.kickThisFrame;
    }
    /** Monotonic count of accepted onsets since the last reset. */
    get kickCount() {
        return this.totalKicks;
    }
    /** Position within the current beat cycle, [0, 1). */
    get beatPhase() {
        return this.currentPhase;
    }
    /** Deterministic timestamp of the most recent accepted onset (ms). */
    get lastKickTimestampMs() {
        return this.lastKickTs;
    }
    /**
     * Process one ODF frame.
     *
     * @param needle        Gated needle from GatedNeedlePipeline (≥ 0).
     * @param currentFloor  Adaptive floor for this frame.
     * @param bpm           Current tempo estimate from TempoOracle. Drives the
     *                      adaptive debounce and the phase accumulator. Pass 0
     *                      before lock — the gate then uses the 200 ms floor and
     *                      reports phase 0.
     * @param timestampMs   Deterministic (sample-derived) timestamp.
     */
    process(needle, currentFloor, bpm, timestampMs) {
        this.kickThisFrame = false;
        // ─── Candidate test ───────────────────────────────────────────────────
        // needle > 0 already implies the upstream floor + centroid gates passed.
        if (needle > 0 && needle > currentFloor * FLOOR_RATIO) {
            // Adaptive debounce, driven by the Oracle's tempo rather than by our
            // own previous output — no self-referential feedback loop.
            let debounceMs = MIN_INTERVAL_MS;
            if (bpm > 0) {
                const expected = (60000 / bpm) * DEBOUNCE_FACTOR;
                if (expected > debounceMs)
                    debounceMs = expected;
            }
            if (this.lastKickTs === 0 || timestampMs - this.lastKickTs >= debounceMs) {
                let passedPeak = true;
                if (this.totalKicks >= PEAK_DISCRIMINATOR_MIN_KICKS && this.peakEstimate > 0) {
                    passedPeak = needle >= this.peakEstimate * PEAK_DISCRIMINATOR_RATIO;
                }
                if (passedPeak) {
                    this.kickThisFrame = true;
                    this.totalKicks = (this.totalKicks + 1) | 0;
                    this.lastKickTs = timestampMs;
                    this.phaseAnchorTs = timestampMs;
                    if (needle > this.peakEstimate)
                        this.peakEstimate = needle;
                }
            }
        }
        // Peak reference decays every frame so it follows the mix dynamics.
        this.peakEstimate *= PEAK_DECAY;
        // ─── Phase accumulator ────────────────────────────────────────────────
        // Free-runs at the Oracle's tempo between onsets and re-anchors on each
        // accepted kick. Silenced when the anchor goes stale so downstream never
        // sees a phantom grid spinning through a breakdown.
        if (bpm > 0 && this.phaseAnchorTs > 0 && timestampMs - this.phaseAnchorTs < PHASE_STALE_MS) {
            const beatMs = 60000 / bpm;
            const elapsed = timestampMs - this.phaseAnchorTs;
            let p = (elapsed % beatMs) / beatMs;
            if (p < 0)
                p += 1;
            this.currentPhase = p;
        }
        else {
            this.currentPhase = 0;
        }
    }
    /** Full amnesia — call on RESET_PACEMAKER / audio source change. */
    reset() {
        this.peakEstimate = 0;
        this.lastKickTs = 0;
        this.phaseAnchorTs = 0;
        this.totalKicks = 0;
        this.kickThisFrame = false;
        this.currentPhase = 0;
    }
}
