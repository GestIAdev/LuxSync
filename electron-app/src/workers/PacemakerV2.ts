/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💓 PACEMAKER v2 — THE PHOENIX PROTOCOL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2130: RESURRECCIÓN DEL PACEMAKER
 *
 * AUTOPSY OF THE AUTOCORRELATION ENGINE (GodEarBPMTracker):
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  291 SIEVE frames analyzed on 128 BPM Minimal Techno:              │
 * │    - 282 frames (97%) produced GARBAGE: 92, 94, 167, 178, 186 BPM  │
 * │    - 9 frame    // ─── P99 CEILING BASELINE (WAVE 2131) ─────────────────────────
    // Sort copy, take element at 99th percentile = the loudest kicks.
    // For 128 elements = ~512 comparisons — still negligible at 15fps.
    const sorted = [...this.energyHistory].sort((a, b) => a - b)

    // P99 = the "ceiling" (los kicks más fuertes recientes)
    // At 70-185 BPM, kicks are 2-6% of frames. P90 lands on noise/tails.
    // P99 reliably lands ON the kick peak itself.
    const p99Index = Math.floor(sorted.length * 0.99)
    const p99 = sorted[p99Index]

    // Onset conditions — ALL must be true:
    // 1. Energy above absolute noise floor (not silence)
    // 2. Energy >= 70% of the recent ceiling (the kick zone)
    // 3. Positive slope (energy rising, not decay tail)
    const aboveFloor = energy > ENERGY_FLOOR

    // LA GUILLOTINA: If Kick = 0.050, P99 = 0.050, threshold = 0.035.
    // Tails (0.020) die here. Offbeats (0.027) die here.
    const isSpike = p99 > 0 && energy > (p99 * P99_KICK_RATIO)

    const risingSlope = energy > this.prevEnergy-135 BPM range                     │
 * │    - Average correlation: 0.24 (needs >0.5)                        │
 * │    - Most frequent "stable" BPM: 94 (61 times) — WRONG             │
 * │                                                                      │
 * │  VERDICT: Autocorrelation is architecturally unfit for production   │
 * │  audio with continuous basslines. Preserved as WASM candidate.      │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * THE PHOENIX: Inter-Onset Interval (IOI) BPM Detection
 *
 * Architecture (designed by PunkArchytect):
 *
 *   1. THE GODEAR TAP — Uses GodEar's SlopeBasedOnsetDetector
 *      (transients.kick) for clean boolean onset detection.
 *      No energy thresholds, no ratio heuristics. Pure slope.
 *
 *   1b. THE INNER EAR (WAVE 2130.2) — Adaptive energy spike detector.
 *      SlopeBasedOnsetDetector has hardcoded min threshold=0.05 but
 *      production rawBass is ~0.017. So PacemakerV2 runs its OWN
 *      onset detection: rolling average + spike ratio (1.8×) + slope.
 *      If EITHER detector fires, we have an onset.
 *
 *   2. THE IOI ENGINE — When a transient fires, record timestamp.
 *      interval = now - lastOnset. Pure brutalidad simple.
 *
 *   3. THE WALL — Range filter: discard intervals < 315ms (>190 BPM)
 *      or > 857ms (< 70 BPM). Everything outside is noise.
 *
 *   4. THE BLINDNESS — After a valid onset, deaf for 250ms.
 *      Prevents bass echo / reverb tail from double-counting.
 *
 *   5. THE CLUSTERING — Histogram voting, not averaging.
 *      Intervals grouped by ±15ms tolerance. Largest cluster wins.
 *      A single offbeat/contratiempo is statistically irrelevant.
 *
 *   6. THE FLYWHEEL — Once stable BPM is confirmed, report it
 *      continuously. If GodEar goes silent (breakdown), the last
 *      known BPM persists. The PLL in main thread handles phase.
 *
 * INTERFACE: Exports identical GodEarBPMResult for zero downstream impact.
 *
 * @author PunkOpus (Lead DSP Engineer)
 * @wave 2130 — THE PHOENIX PROTOCOL
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (re-exported for compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export interface PacemakerV2Result {
  /** Stable BPM (clustered + hysteresis) */
  bpm: number
  /** 0-1: Cluster dominance ratio (how clean is the winner?) */
  confidence: number
  /** Number of valid onsets recorded in history */
  kickCount: number
  /** Was a kick onset detected THIS frame? */
  kickDetected: boolean
  /** Beat phase 0-1 (position within current beat cycle) */
  beatPhase: number
  /** WAVE 2158: Active interval clusters, sorted by vote count descending.
   *  Exposed for the Cluster-Aware Gearbox to cross-reference harmonic ratios.
   *  Each entry: { bpm, votes } — the BPM and number of intervals in that cluster. */
  clusters: ClusterSnapshot[]
}

/** WAVE 2158: Lightweight cluster snapshot for external consumption.
 *  Deliberately minimal — only BPM and votes, no internal interval data. */
export interface ClusterSnapshot {
  /** BPM of this cluster center (60000 / centerMs) */
  bpm: number
  /** Number of intervals grouped in this cluster */
  votes: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — PACEMAKER v2 TUNING
// ═══════════════════════════════════════════════════════════════════════════

/** Minimum BPM to detect. Below this is not dance music. */
const MIN_BPM = 70

/** Maximum BPM to detect. Psytrance tops ~188. */
const MAX_BPM = 190

/** Minimum valid interval in ms (corresponds to MAX_BPM).
 *  60000 / 190 = 315ms. Anything shorter is a hi-hat or echo. */
const MIN_INTERVAL_MS = Math.floor(60000 / MAX_BPM)

/** Maximum valid interval in ms (corresponds to MIN_BPM).
 *  60000 / 70 = 857ms. Anything longer is not a beat interval. */
const MAX_INTERVAL_MS = Math.ceil(60000 / MIN_BPM)

/** @deprecated WAVE 2149: Replaced by adaptive outer gate using MIN_INTERVAL_MS as floor
 *  + Dynamic Armor (shieldMultiplier = 0.40 + confidence × 0.40).
 *  Was: 200ms static (WAVE 2134). Caused vicious circle at 161 BPM. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEBOUNCE_MS = 200

/** Tolerance for clustering intervals together (ms).
 *  Intervals within ±15ms of a cluster center are grouped.
 *  At 128 BPM (469ms), 15ms = 3.2% tolerance — tight enough
 *  to separate kicks from offbeats (which differ by ~60ms+). */
const CLUSTER_TOLERANCE_MS = 15

/** Maximum number of intervals to keep in history.
 *  ~20 intervals ≈ ~10 seconds of music at 128 BPM.
 *  Enough for solid statistics, fresh enough to track changes. */
const MAX_INTERVAL_HISTORY = 24

/** Minimum intervals needed before we output a BPM.
 *  Need at least 6 to form a meaningful cluster. */
const MIN_INTERVALS_FOR_BPM = 6

/** Hysteresis: minimum consecutive frames a new BPM candidate
 *  must hold before replacing the stable BPM.
 *  At ~46ms/frame, 30 frames ≈ 1.4 seconds. */
const HYSTERESIS_FRAMES = 30

/** BPM delta threshold for considering a candidate "same as current".
 *  If |newBpm - stableBpm| < 4, it's noise fluctuation. */
const BPM_STABILITY_DELTA = 4

/** Octave jump detection ranges.
 *  A change is "octave" if ratio is within these ranges.
 *  WAVE 2148: widened from [1.90,2.10]/[0.48,0.52] to [1.85,2.15]/[0.46,0.54]
 *  to catch borderline octave doublings (e.g. 92→185 when cluster scatter
 *  lands at 187 or 183). */
const OCTAVE_RANGES: [number, number][] = [
  [1.85, 2.15],  // 2× doubling — widened
  [0.46, 0.54],  // 0.5× halving — widened
]

/** Frames of sustained octave pressure needed to accept the jump.
 *  WAVE 2140: reducido de 60 → 30. A ~47fps, 30 frames = 0.64s.
 *  Con 60 frames (~1.3s) el motor tardaba demasiado en corregir un
 *  octave erróneo que había tomado al arranque. */
const OCTAVE_LOCK_FRAMES = 30

/** Maximum age of an interval before it's purged (ms).
 *  Intervals older than 12 seconds are stale. */
const INTERVAL_MAX_AGE_MS = 12000

/** Frames between diagnostic logs. */
const DIAGNOSTIC_INTERVAL_FRAMES = 60

// ═══════════════════════════════════════════════════════════════════════════
// INTERVAL CLUSTER (internal)
// ═══════════════════════════════════════════════════════════════════════════

interface IntervalEntry {
  ms: number
  timestamp: number
}

interface IntervalCluster {
  centerMs: number
  count: number
  bpm: number
}

// ═══════════════════════════════════════════════════════════════════════════
// THE PACEMAKER v2
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2136: THE TRUE 1163.5 REPLICA
// ═══════════════════════════════════════════════════════════════════════════
//
// WAVE 2135 (EMA del pico) falló porque el 65% del PICO es demasiado
// permisivo: las síncopas fuertes del techno elevan el peakEma y luego
// superan el 65% de ese pico calibrado. Error de referencia.
//
// WAVE 1163.5 usaba el PROMEDIO de 24 frames, no el pico. El promedio aplasta
// el nivel sostenido del bajo. Un bombo a 0.050 sobre un bajo medio de 0.015
// da ratio 3.3× — muy por encima del 1.6×. Una síncopa a 0.028 sobre ese
// mismo medio da ratio 1.87× — también por encima... pero el DELTA de 0.008
// la mata si no tiene un ataque lo suficientemente abrupto.
//
// La combinación de las tres condiciones es la clave:
//   mean × 1.6  →  filtra el nivel sostenido
//   delta 0.008  →  filtra reverb y ataques suaves (síncopas de techno)
//   inKick flag  →  histéresis, previene double-trigger dentro del mismo golpe
//   adaptiveDebounce  →  floor 200ms + 80% del BPM actual (WAVE 2141: 80% Shield)
// ═══════════════════════════════════════════════════════════════════════════

/** WAVE 1163.5 replica: rolling average window size (frames).
 *  24 frames × ~21ms/frame ≈ 0.5s rolling average. */
const ENERGY_HISTORY_SIZE = 24

/** WAVE 1163.5 replica: onset ratio threshold.
 *  Punch must be 60% above the rolling mean to count as a kick. */
const ENERGY_RATIO = 1.6

/** WAVE 1163.5 replica: minimum delta (rising edge strength).
 *  Punch must rise by at least 0.008 from the previous frame.
 *  Kills reverb tails, soft syncopations, and plateau transitions. */
const DELTA_THRESHOLD = 0.008

/** WAVE 2141: THE 80% SHIELD — adaptive debounce factor.
 *  adaptiveDebounce = max(200ms, expectedInterval × 0.80)
 *
 *  El 80% cubre el 75% del compás real — suficiente para que la síncopa
 *  de semicorchea con puntillo del Minimal Techno rebote y muera.
 *
 *  A 125 BPM (480ms): max(200, 480×0.80) = 384ms  ← síncopa a 360ms = BLOQUEADA ✅
 *  A 128 BPM (469ms): max(200, 469×0.80) = 375ms  ← escudo baja 94ms antes del kick ✅
 *  A 160 BPM (375ms): max(200, 375×0.80) = 300ms  ← head-room de 75ms para el kick ✅
 *  A 80  BPM (750ms): max(200, 750×0.80) = 600ms  ← mata qualquier doble ✅
 *
 *  ⚠️ NOTA: A >250 BPM el floor de 200ms toma el control. Psytrance/DnB safe.
 *
 *  WAVE 2147: Reemplazado por Dynamic Armor. El factor ya no es fijo (0.80)
 *  sino variable: shieldMultiplier = 0.40 + (confidence × 0.40).
 *  Referencia histórica mantenida abajo. */
/** @deprecated WAVE 2147: Static factor replaced by confidence-based shieldMultiplier.
 *  Kept for historical reference. Was: 0.80 (WAVE 2141). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ADAPTIVE_DEBOUNCE_FACTOR = 0.80

/** Floor for adaptive debounce (inner ear) — never blind for less than this.
 *  WAVE 2149: Aligned with outer gate. Both use MIN_INTERVAL_MS (315ms) as floor.
 *  Was: 200ms (WAVE 2134). The 200ms floor let 232-325ms syncopation through
 *  the inner ear, which then fired an onset that the outer gate also accepted
 *  (since both gates had the same 200-250ms floor). Result: 161 BPM vicious circle.
 *
 *  With 315ms: only intervals ≥315ms (≤190 BPM) pass. This kills syncopation
 *  at all tempos while still allowing DnB/Psytrance at 185-190 BPM.
 *  Exactly matches MAX_BPM = 190 → 60000/190 = 315ms. */
const ADAPTIVE_DEBOUNCE_FLOOR_MS = MIN_INTERVAL_MS

export class PacemakerV2 {
  // ─── Onset timing ──────────────────────────────────────────────────
  /** Timestamp of the last accepted onset */
  private lastOnsetTimestamp = 0
  /** Total onsets accepted (for kickCount) */
  private onsetCount = 0

  // ─── Interval history (ring buffer) ────────────────────────────────
  private intervals: IntervalEntry[] = []

  // ─── BPM state ─────────────────────────────────────────────────────
  /** Current stable BPM output */
  private stableBpm = 0
  /** Raw BPM from last clustering */
  private rawBpm = 0
  /** Confidence of current BPM */
  private currentConfidence = 0

  // ─── Hysteresis ────────────────────────────────────────────────────
  private candidateBpm = 0
  private candidateFrames = 0

  // ─── Octave lock ───────────────────────────────────────────────────
  private octaveLockCounter = 0
  private octaveLockCandidate = 0

  // ─── Phase tracking ────────────────────────────────────────────────
  private lastBeatAnchor = 0
  private prevPhase = 0

  // ─── Frame counter ─────────────────────────────────────────────────
  private frameCount = 0

  // ─── Warmup ────────────────────────────────────────────────────────
  private warmupComplete = false

  // ─── WAVE 2158: Cluster snapshots for external consumption ─────────
  /** Last computed cluster snapshot (sorted descending by votes).
   *  Updated on every recluster. Exposed via PacemakerV2Result.clusters
   *  for the Cluster-Aware Gearbox to cross-reference harmonic ratios. */
  private lastClusters: ClusterSnapshot[] = []

  // ─── WAVE 2136: TRUE 1163.5 REPLICA — onset detector state ──────
  /** Circular buffer for rolling average (24 frames ≈ 0.5s) */
  private energyHistory = new Float32Array(ENERGY_HISTORY_SIZE)
  /** Write cursor for the circular buffer */
  private historyIndex = 0
  /** Hysteresis flag: true while inside a kick event, false once energy drops below mean */
  private inKick = false
  /** Previous frame punch for delta (rising edge) check */
  private prevEnergy = 0

  // ─── WAVE 2137: ANTI-SYNCOPATION SHIELD — muscle memory ──────────
  /** Memoria muscular: fuerza del último bombo aceptado.
   *  WAVE 2146: valor inicial = 0.060 (recalibrado para señal Radix-2 limpia).
   *  Con el Radix-2, los kicks llegan masivos (0.100-0.200). El arranque con
   *  0.025 dejaba que cualquier transitorio de 0.019+ pasara como kick antes
   *  de que la memoria muscular se calibrara. Con 0.060 el motor arranca ya
   *  en la zona de kicks reales — las síncopas de 0.030-0.050 mueren al instante. */
  private kickLevel = 0.060

  // ─── WAVE 2150: P99 CEILING GATE — energy filter at IOI level ─────
  /** Circular buffer of onset energies (used for P99 ceiling calculation).
   *  Only ACCEPTED onsets contribute. 32 entries ≈ ~15s at 128 BPM. */
  private onsetEnergyHistory: number[] = []
  /** Maximum onset energy entries to track */
  private static readonly ONSET_ENERGY_SIZE = 32
  /** P99 kick ratio: onset must be at least 35% of the P99 peak to be
   *  accepted as a valid kick for IOI purposes. Kills weak transients
   *  (ghost notes, hi-hat bleed, soft syncopations) that produce garbage
   *  intervals and pollute the clustering.
   *
   *  At 35%: kick=0.150, P99=0.200 → threshold=0.070. Weak=0.040 DIES ✅
   *  At 35%: kick=0.080, P99=0.150 → threshold=0.053. Weak=0.040 DIES ✅
   *  At 35%: both kicks at 0.100, P99=0.100 → threshold=0.035. Both PASS ✅ */
  private static readonly P99_IOI_RATIO = 0.35

  /**
   * Process one frame of audio data.
   *
   * WAVE 2130.2: Dual-path onset detection.
   *   Path A: External boolean (GodEar SlopeBasedOnsetDetector)
   *   Path B: Internal adaptive energy spike detector
   * If EITHER fires, we have an onset. This makes PacemakerV2
   * self-sufficient — never again dependent on an external
   * detector's hardcoded thresholds.
   *
   * @param kickOnset - Boolean from GodEar transients.kick (SlopeBasedOnsetDetector)
   * @param energy    - Raw bass energy (subBass + bass) BEFORE AGC. Range: 0-1 typically 0.01-0.05
   * @param timestamp - Deterministic musical timestamp (ms) from sample counting
   * @returns PacemakerV2Result (compatible with downstream consumers)
   */
  process(kickOnset: boolean, energy: number, timestamp: number): PacemakerV2Result {
    this.frameCount++
    let kickDetectedThisFrame = false

    // ─── 0. ADAPTIVE ONSET DETECTION (THE INNER EAR) ──────────────
    // WAVE 2136: 1163.5 replica — rolling mean × 1.6 + delta + inKick hysteresis
    // + adaptive debounce. Returns true only when a NEW valid onset fires.
    const adaptiveOnset = this.detectAdaptiveOnset(energy, timestamp, this.stableBpm)

    // Merge: external OR internal onset
    const onsetDetected = kickOnset || adaptiveOnset

    // ─── 1. ONSET GATE: Adaptive Outer Debounce ──────────────────
    // ═══════════════════════════════════════════════════════════════
    // WAVE 2149: ADAPTIVE OUTER GATE — BREAKING THE VICIOUS CIRCLE
    // ═══════════════════════════════════════════════════════════════
    //
    // History of the vicious circle:
    //   WAVE 2148.1: gate=250ms → 325ms syncopation passes → lock 161 BPM
    //   → gate=280ms (×0.75 fixed) → 325ms STILL passes → 161 forever
    //
    // THE FIX: Two-phase adaptive gate with Dynamic Armor.
    //
    // PHASE 1 — STARTUP (no stableBpm):
    //   Conservative gate = MIN_INTERVAL_MS × 1.15 ≈ 362ms.
    //   This is the VICIOUS CIRCLE BREAKER. At startup we don't know the
    //   tempo, so we must be conservative:
    //     → 232ms bass syncopation: DEAD (232 < 362) ✅
    //     → 325ms offbeat syncopation: DEAD (325 < 362) ✅
    //     → 375ms kick (160 BPM): ALIVE (375 > 362) ✅
    //     → 476ms kick (126 BPM): ALIVE (476 > 362) ✅
    //   Cost: We lose 170+ BPM detection at startup (353ms < 362ms).
    //   Acceptable: 170+ BPM Psytrance has clean kicks with no syncopation,
    //   so the inner ear's energy checks catch it. Once locked → Phase 2.
    //
    // PHASE 2 — RUNNING (with stableBpm):
    //   Dynamic Armor: shield = 0.40 + (confidence × 0.40)
    //   gate = max(MIN_INTERVAL_MS, beatInterval × shield)
    //   Floor = MIN_INTERVAL_MS (315ms) — safe for all tempos.
    //   High confidence (0.80) → shield=0.72 → 126BPM: 476×0.72=343ms gate
    //     → 325ms syncopation: DEAD ✅
    //   Low confidence (0.20) → shield=0.48 → gate=floor=315ms
    //     → mode: learning new tempo, gate at minimum ✅
    //
    // Lección WAVE 1163: "Los Círculos Viciosos Son Reales.
    //   Cuando un sistema adaptativo detecta mal, puede auto-confirmarse
    //   en un bucle infinito. Solución: floor absoluto que rompa la
    //   retroalimentación."
    const STARTUP_GATE_MS = Math.floor(MIN_INTERVAL_MS * 1.15)  // ≈362ms
    const outerShield = 0.40 + (this.currentConfidence * 0.40)
    const outerDebounce = this.stableBpm > 0
      ? Math.max(MIN_INTERVAL_MS, (60000 / this.stableBpm) * outerShield)
      : STARTUP_GATE_MS

    if (onsetDetected) {
      const timeSinceLast = timestamp - this.lastOnsetTimestamp

      // THE BLINDNESS: Ignore if within debounce window
      if (timeSinceLast >= outerDebounce) {
        // First onset ever? Just record it, no interval yet.
        if (this.lastOnsetTimestamp > 0) {
          // THE WALL: Range filter
          if (timeSinceLast >= MIN_INTERVAL_MS && timeSinceLast <= MAX_INTERVAL_MS) {

            // ═══ WAVE 2150: P99 CEILING GATE ═══════════════════════
            // The inner ear and GodEar fire on weak transients (ghost notes,
            // hi-hat bleed, soft syncopations). These produce garbage intervals
            // that pollute clustering: 325ms, 372ms, 604ms, 650ms instead of
            // the real 476ms (126 BPM).
            //
            // The P99 gate: only accept an onset for IOI if its energy is at
            // least P99_IOI_RATIO (35%) of the P99 of recent onset energies.
            // This kills weak transients while allowing real kicks through.
            //
            // During warmup (<8 onsets), we skip this gate to allow calibration.
            let passesEnergyGate = true
            if (this.onsetEnergyHistory.length >= 8) {
              const sortedE = [...this.onsetEnergyHistory].sort((a, b) => a - b)
              const p99Idx = Math.min(sortedE.length - 1, Math.floor(sortedE.length * 0.99))
              const p99Energy = sortedE[p99Idx]
              const energyThreshold = p99Energy * PacemakerV2.P99_IOI_RATIO
              passesEnergyGate = energy >= energyThreshold

              if (!passesEnergyGate) {
                console.log(
                  `[PM2 🔇] F${this.frameCount} ENERGY-REJECT ` +
                  `IOI=${Math.round(timeSinceLast)}ms energy=${energy.toFixed(4)} ` +
                  `< threshold=${energyThreshold.toFixed(4)} (P99=${p99Energy.toFixed(4)}×${PacemakerV2.P99_IOI_RATIO})`
                )
              }
            }

            if (passesEnergyGate) {
              // Valid interval — record it
              this.intervals.push({ ms: timeSinceLast, timestamp })

              // Trim to max history
              if (this.intervals.length > MAX_INTERVAL_HISTORY) {
                this.intervals.shift()
              }

              // Track onset energy for P99 calculation
              this.onsetEnergyHistory.push(energy)
              if (this.onsetEnergyHistory.length > PacemakerV2.ONSET_ENERGY_SIZE) {
                this.onsetEnergyHistory.shift()
              }

              // WAVE 2149.2: Log every accepted interval
              console.log(
                `[PM2 ⚡] F${this.frameCount} IOI=${Math.round(timeSinceLast)}ms ` +
                `(${Math.round(60000 / timeSinceLast)}bpm) ` +
                `energy=${energy.toFixed(4)} gate=${Math.round(outerDebounce)}ms`
              )

              kickDetectedThisFrame = true
            }
            // ═══ END P99 CEILING GATE ══════════════════════════════

          } else {
            // WAVE 2149.2: Log out-of-range discards
            console.log(
              `[PM2 🚫] F${this.frameCount} RANGE-REJECT ` +
              `IOI=${Math.round(timeSinceLast)}ms (min=${MIN_INTERVAL_MS} max=${MAX_INTERVAL_MS})`
            )
          }
        }

        // Update last onset timestamp (even if interval was out of range or energy-rejected)
        this.lastOnsetTimestamp = timestamp
        this.onsetCount++

        // Track energy even for non-interval onsets (calibration during warmup)
        if (this.onsetEnergyHistory.length < 8) {
          this.onsetEnergyHistory.push(energy)
        }

        kickDetectedThisFrame = true
      }
    }

    // ─── 2. PURGE STALE INTERVALS ────────────────────────────────
    const prevLength = this.intervals.length
    const cutoff = timestamp - INTERVAL_MAX_AGE_MS
    this.intervals = this.intervals.filter(i => i.timestamp > cutoff)
    const purged = prevLength - this.intervals.length

    // ─── 3. CLUSTERING + BPM CALCULATION ─────────────────────────
    // WAVE 2150: Only recluster when data CHANGED (new onset or stale purge).
    // Before: updateBpmFromClusters ran EVERY FRAME (~46ms), even with identical
    // data → AMNESIA fired 10-15× between onsets with the SAME clusters.
    // After: only runs on actual data change → clean logs, honest confidence.
    const dataChanged = kickDetectedThisFrame || purged > 0
    if (this.intervals.length >= MIN_INTERVALS_FOR_BPM && dataChanged) {
      this.updateBpmFromClusters(timestamp)
    }

    // ─── 4. PHASE CALCULATION ────────────────────────────────────
    let beatPhase = 0
    if (this.stableBpm > 0) {
      const beatIntervalMs = 60000 / this.stableBpm

      if (this.lastBeatAnchor === 0) {
        this.lastBeatAnchor = timestamp
      }

      const elapsed = timestamp - this.lastBeatAnchor
      beatPhase = (elapsed % beatIntervalMs) / beatIntervalMs

      // Phase wrap detection → re-anchor
      if (this.prevPhase > 0.85 && beatPhase < 0.15) {
        this.lastBeatAnchor = timestamp
      }
      this.prevPhase = beatPhase
    }

    // ─── 5. DIAGNOSTIC LOG — WAVE 2149.2: EXHAUSTIVE TELEMETRY ───
    // Radwulf's Law: "Los logs son dios para el debug. Sin ellos no se puede."
    // Every DIAGNOSTIC_INTERVAL_FRAMES: full cluster dump + state snapshot.
    if (this.frameCount % DIAGNOSTIC_INTERVAL_FRAMES === 0 && this.stableBpm > 0) {
      // Build cluster snapshot for the log
      const values = this.intervals.map(i => i.ms)
      const clusters = this.buildClusters(values)
      const clusterStr = clusters
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)  // Top 5 clusters max
        .map(c => `${Math.round(c.bpm)}bpm:${c.count}v(${Math.round(c.centerMs)}ms)`)
        .join(' | ')

      // Last 6 interval gaps for pattern visibility
      const recentIntervals = this.intervals.slice(-6).map(i => Math.round(i.ms)).join(',')

      console.log(
        `[💓 PM2 DIAG] F${this.frameCount} ` +
        `stable=${this.stableBpm}bpm raw=${this.rawBpm} ` +
        `conf=${this.currentConfidence.toFixed(3)} ` +
        `gate=${Math.round(outerDebounce)}ms ` +
        `kickLvl=${this.kickLevel.toFixed(4)} ` +
        `intv=${this.intervals.length} onsets=${this.onsetCount}\n` +
        `  clusters: [${clusterStr}]\n` +
        `  recent: [${recentIntervals}]`
      )
    }

    return {
      bpm: this.stableBpm,
      confidence: this.currentConfidence,
      kickCount: this.onsetCount,
      kickDetected: kickDetectedThisFrame,
      beatPhase,
      clusters: this.lastClusters,
    }
  }

  /**
   * THE CLUSTERING: Histogram voting for dominant interval.
   *
   * 1. Sort intervals
   * 2. Group by ±CLUSTER_TOLERANCE_MS
   * 3. Largest cluster wins
   * 4. Apply hysteresis + octave protection
   */
  private updateBpmFromClusters(timestamp: number): void {
    // ─── Step 1: Extract raw ms values ───────────────────────────
    const values = this.intervals.map(i => i.ms)

    // ─── Step 2: Build clusters ──────────────────────────────────
    const clusters = this.buildClusters(values)
    if (clusters.length === 0) return

    // ─── WAVE 2158: Snapshot clusters for external consumption ───
    // Sorted descending by vote count. Lightweight: only bpm + votes.
    this.lastClusters = clusters
      .sort((a, b) => b.count - a.count)
      .map(c => ({ bpm: Math.round(c.bpm), votes: c.count }))

    // ─── Step 3: Find dominant cluster ───────────────────────────
    const dominant = this.findDominantCluster(clusters)
    if (!dominant) return

    this.rawBpm = Math.round(dominant.bpm)

    // ─── Step 4: Calculate confidence ────────────────────────────
    const totalIntervals = values.length
    const dominanceRatio = dominant.count / totalIntervals
    const rawConfidence = Math.max(0, Math.min(1, dominanceRatio))

    // ─── WAVE 2140: CONFIDENCE BLEED — Amnesia Protocol ──────────
    // Si el rawBpm diverge del stableBpm, el trono del dictador sangra.
    // Cada clustering call sin respaldo = -5% de confianza.
    // Cuando el candidato rawConfidence supera al stable, cambia el trono.
    if (this.stableBpm > 0 && Math.abs(this.rawBpm - this.stableBpm) > BPM_STABILITY_DELTA) {
      this.currentConfidence *= 0.95
      if (rawConfidence > this.currentConfidence) {
        // El nuevo candidato ha ganado la guerra de confianza
        console.log(
          `[💓 PACEMAKER v2 AMNESIA] Confidence bleed triggered. ` +
          `stable=${this.stableBpm} (conf=${this.currentConfidence.toFixed(3)}) ` +
          `→ raw=${this.rawBpm} (conf=${rawConfidence.toFixed(3)})`
        )
        this.currentConfidence = rawConfidence
      }
    } else {
      // Raw coincide con stable: recargar confianza normalmente
      this.currentConfidence = rawConfidence
    }

    // ─── Step 5: Hysteresis + Octave protection ──────────────────
    this.applyHysteresis(dominant.bpm)
  }

  /**
   * Build interval clusters using sequential grouping.
   * Intervals within ±CLUSTER_TOLERANCE_MS are grouped together.
   */
  private buildClusters(intervals: number[]): IntervalCluster[] {
    if (intervals.length === 0) return []

    const sorted = [...intervals].sort((a, b) => a - b)
    const clusters: IntervalCluster[] = []

    let clusterSum = sorted[0]
    let clusterCount = 1
    let clusterStart = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const center = clusterSum / clusterCount

      if (Math.abs(current - center) <= CLUSTER_TOLERANCE_MS) {
        // Add to current cluster
        clusterSum += current
        clusterCount++
      } else {
        // Finalize current cluster, start new one
        const finalCenter = clusterSum / clusterCount
        clusters.push({
          centerMs: finalCenter,
          count: clusterCount,
          bpm: 60000 / finalCenter,
        })
        clusterSum = current
        clusterCount = 1
        clusterStart = current
      }
    }

    // Don't forget the last cluster
    const finalCenter = clusterSum / clusterCount
    clusters.push({
      centerMs: finalCenter,
      count: clusterCount,
      bpm: 60000 / finalCenter,
    })

    return clusters
  }

  /**
   * Find the dominant cluster: largest count wins.
   * On ties, prefer the cluster closest to current stable BPM (stability).
   *
   * WAVE 2149.2: ANTI-OCTAVE-DOUBLING REMOVED.
   * WAVE 2148's anti-doubling was architecturally flawed:
   *   - It compared the dominant cluster (325ms=185BPM, 13 votes)
   *     against a minor cluster (604ms=99BPM, 6 votes).
   *   - Ratio 604/325=1.86 → fell in [1.85,2.15] → chose 99 BPM.
   *   - But NEITHER was correct. 126 BPM=476ms was the real tempo.
   *   - The anti-doubling masked the real bug (syncopation leaking)
   *     and created a WORSE outcome (99 BPM instead of 185 or 126).
   *
   * The correct architectural solution is to prevent syncopation
   * from entering the interval buffer (via gates and energy checks),
   * not to post-process bad data with heuristics.
   */
  private findDominantCluster(clusters: IntervalCluster[]): IntervalCluster | null {
    if (clusters.length === 0) return null
    if (clusters.length === 1) return clusters[0]

    // Sort by count descending
    const sorted = [...clusters].sort((a, b) => b.count - a.count)
    const largest = sorted[0]

    // Get all clusters within 60% of the largest count
    const significant = sorted.filter(c => c.count >= largest.count * 0.6)

    if (significant.length === 1) return largest

    // Multiple significant clusters — prefer closest to current BPM
    if (this.stableBpm > 0) {
      let best = largest
      let bestDist = Math.abs(largest.bpm - this.stableBpm)

      for (const c of significant) {
        const dist = Math.abs(c.bpm - this.stableBpm)
        if (dist < bestDist) {
          // Check it's not a subdivision of the largest
          const ratio = c.centerMs / largest.centerMs
          const isSubdivision = ratio < 0.55 || (ratio > 1.8 && ratio < 2.2)
          if (!isSubdivision) {
            best = c
            bestDist = dist
          }
        }
      }
      return best
    }

    return largest
  }

  /**
   * Apply hysteresis and octave protection to BPM changes.
   * Prevents jitter from frame-to-frame clustering noise.
   */
  private applyHysteresis(newBpm: number): void {
    // ─── Pre-lock: aún no tenemos stableBpm ─────────────────────
    // WAVE 2140: Ya no aceptamos la primera lectura directamente.
    // Acumulamos el candidato igual que en el flujo normal para evitar
    // que un octave error inicial (185 cuando es 92/126) se fije al instante.
    // WAVE 2141: 4 frames → 6 frames. Con el Bass Gate rebajado a 0.012,
    // llegan más onsets desde el principio. 6 frames consistentes = ~125ms
    // de confirmación → suficiente para distinguir 92 BPM de 126 BPM real
    // antes de grabar el primer stableBpm.
    if (this.stableBpm === 0) {
      if (Math.abs(newBpm - this.candidateBpm) <= BPM_STABILITY_DELTA) {
        this.candidateFrames++
        this.candidateBpm = this.candidateBpm * 0.90 + newBpm * 0.10
      } else {
        this.candidateBpm = newBpm
        this.candidateFrames = 1
      }
      // 6 clustering calls consistentes para el primer lock
      if (this.candidateFrames >= 6) {
        this.stableBpm = Math.round(this.candidateBpm)
        this.candidateFrames = 0
        this.warmupComplete = false
      }
      return
    }

    const diff = Math.abs(newBpm - this.stableBpm)

    // ─── Octave jump detection ─────────────────────────────────
    if (this.isOctaveJump(newBpm, this.stableBpm)) {
      if (Math.abs(newBpm - this.octaveLockCandidate) < 10) {
        this.octaveLockCounter++
      } else {
        this.octaveLockCandidate = newBpm
        this.octaveLockCounter = 1
      }

      if (this.octaveLockCounter >= OCTAVE_LOCK_FRAMES) {
        // Sustained octave jump confirmed
        console.log(
          `[💓 PACEMAKER v2 OCTAVE ACCEPT] ${this.stableBpm}→${Math.round(newBpm)} BPM ` +
          `after ${this.octaveLockCounter} frames`
        )
        this.stableBpm = Math.round(newBpm)
        this.lastBeatAnchor = 0
        this.prevPhase = 0
        this.octaveLockCounter = 0
        this.octaveLockCandidate = 0
      }
      // Block otherwise
      return
    }

    // ─── Not an octave jump → normal hysteresis ────────────────
    this.octaveLockCounter = 0
    this.octaveLockCandidate = 0

    if (Math.abs(newBpm - this.candidateBpm) <= BPM_STABILITY_DELTA) {
      // Same candidate persists — increment
      this.candidateFrames++
      // Refine candidate with EMA
      this.candidateBpm = this.candidateBpm * 0.90 + newBpm * 0.10
    } else {
      // New candidate
      this.candidateBpm = newBpm
      this.candidateFrames = 0
    }

    // During warmup (first 8 onsets), allow faster lock
    const requiredFrames = this.warmupComplete ? HYSTERESIS_FRAMES : 8
    if (this.onsetCount >= 8) this.warmupComplete = true

    if (this.candidateFrames >= requiredFrames) {
      const roundedCandidate = Math.round(this.candidateBpm)

      // Sanity check: reject absurd jumps (>55% change outside warmup)
      // WAVE 2141: 1.40 → 1.55 y 0.60 → 0.64.
      // Con stableBpm=92 (incorrecto) y raw clustering produciendo 144 BPM:
      //   144/92 = 1.565 → con 1.40 se bloqueaba. Con 1.55 también... pero 126/92=1.37 pasaba.
      // El problema real es que el ratio guard impedía que el motor convergiera
      // desde 92 hacia 126 cuando el clustering ya lo veía correctamente.
      // Con 0.64: 92×0.64 = 59 → el guard permite bajar hasta 59 BPM sin bloquear.
      // La protección real de octavas está en isOctaveJump con OCTAVE_RANGES [0.48, 0.52].
      if (this.warmupComplete && this.stableBpm > 0) {
        const ratio = roundedCandidate / this.stableBpm
        if (ratio < 0.64 || ratio > 1.55) {
          this.candidateFrames = 0
          return
        }
      }

      // Rate limit: max ±2 BPM per update (smooth convergence)
      if (this.warmupComplete) {
        const maxChange = 2
        const clamped = Math.max(
          this.stableBpm - maxChange,
          Math.min(this.stableBpm + maxChange, roundedCandidate)
        )
        this.stableBpm = clamped
      } else {
        this.stableBpm = roundedCandidate
      }
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * WAVE 2136: THE TRUE 1163.5 REPLICA
   * ═══════════════════════════════════════════════════════════════════════
   *
   * Copia exacta de la arquitectura GodEarBPMTracker que sobrevivió al
   * Techno hardcore, la Cumbia y el Psytrance en WAVE 1163.
   *
   * Por qué PROMEDIO y no PICO (lección aprendida de WAVE 2135):
   *   El pico (peakEma) se calibra CON las síncopas fuertes → el 65% del
   *   pico deja pasar esas mismas síncopas. Error de referencia circular.
   *
   *   El PROMEDIO aplasta el nivel sostenido del bajo. Un bombo a 0.050
   *   sobre un mean de 0.015 da ratio 3.3× → pasa 1.6× con holgura.
   *   Una síncopa a 0.028 sobre ese mean da ratio 1.87× → pasa el 1.6×
   *   PERO no pasa el DELTA de 0.008 si su ataque no es lo suficientemente
   *   abrupto (las síncopas del techno suben gradualmente).
   *
   * Cuatro condiciones, todas obligatorias:
   *   1. isAboveAverage: punch > mean × 1.6  (el bajo sostenido ≈ mean → no pasa)
   *   2. isSharpAttack:  (punch - prevPunch) >= 0.008  (no hay síncopa suave)
   *   3. !inKick:        no estamos dentro del mismo golpe (histéresis)
   *   4. adaptiveDebounce: max(200ms, 80% del intervalo del BPM actual)
   *      — WAVE 2141: 40% → 80%. El 80% cubre el 75% del compás real,
   *        bloqueando la síncopa de semicorchea con puntillo del Minimal Techno.
   *
   * @param punch     - Multiband Spectral Flux (rhythmicPunch de senses.ts)
   * @param timestamp - Deterministic musical timestamp (ms)
   * @param currentBpm - Current stable BPM for adaptive debounce calculation
   */
  private detectAdaptiveOnset(punch: number, timestamp: number, currentBpm: number): boolean {
    // ─── 1. ACTUALIZAR BUFFER CIRCULAR ───────────────────────────
    this.energyHistory[this.historyIndex] = punch
    this.historyIndex = (this.historyIndex + 1) % ENERGY_HISTORY_SIZE

    // ─── 2. CALCULAR MEDIA LOCAL (Promedio Móvil Simple) ─────────
    let sum = 0
    for (let i = 0; i < ENERGY_HISTORY_SIZE; i++) sum += this.energyHistory[i]
    const mean = sum / ENERGY_HISTORY_SIZE

    // ─── 3. DEBOUNCE DINÁMICO — WAVE 2147/2149: DYNAMIC ARMOR ─────
    // WAVE 2147: El escudo escala con la confianza actual del motor:
    //   Confianza alta (1.0) → shieldMultiplier = 0.80 → escudo máximo
    //   Confianza nula (0.0) → shieldMultiplier = 0.40 → escucha activa
    //
    // WAVE 2149: Floor unificado con outer gate = MIN_INTERVAL_MS (315ms).
    // Ambas puertas comparten el mismo piso físico para evitar inconsistencias.
    //
    // Ejemplos con confianza = 1.0 (shield 80%):
    //   A 125 BPM: max(315, 480×0.80) = 384ms  ← síncopa a 360ms = BLOQUEADA ✅
    //   A 160 BPM: max(315, 375×0.80) = 315ms  ← floor toma el control ✅
    // Ejemplos con confianza = 0.0 (shield 40%):
    //   A 125 BPM: max(315, 480×0.40) = 315ms  ← floor, escucha activa ✅
    const expectedInterval = currentBpm > 0 ? (60000 / currentBpm) : 500
    const shieldMultiplier = 0.40 + (this.currentConfidence * 0.40)
    let adaptiveDebounce = Math.max(ADAPTIVE_DEBOUNCE_FLOOR_MS, expectedInterval * shieldMultiplier)

    // ─── 3b. AP-KICK: ARMOR-PIERCING PROTOCOL — WAVE 2147 ────────
    // Un bombo puro tras un breakdown puede llegar a 0.200.
    // Un impacto que supera en 50% a nuestra memoria muscular es INNEGABLE.
    // Rompemos el escudo al floor (315ms = MIN_INTERVAL_MS).
    // WAVE 2149: el floor ya no es 200ms sino 315ms — consistente con MAX_BPM.
    //
    // Ejemplo: kickLevel=0.090, bombo de Brejcha a 0.198
    //   punch (0.198) > kickLevel×1.5 (0.135) → adaptiveDebounce = 315ms ⚡
    if (punch > this.kickLevel * 1.5) {
      adaptiveDebounce = ADAPTIVE_DEBOUNCE_FLOOR_MS
    }

    // ─── 4. RESET HISTÉRESIS — el golpe terminó cuando caemos bajo la media
    if (this.inKick && punch < mean) {
      this.inKick = false
    }

    // ─── 5. CONDICIONES DE ONSET ──────────────────────────────────
    // 60% por encima de la media local
    const isAboveAverage = punch > (mean * ENERGY_RATIO)

    // Borde de subida fuerte — mata reverb, síncopas suaves y plateaus
    const isSharpAttack = (punch - this.prevEnergy) >= DELTA_THRESHOLD

    // WAVE 2137/2149: EL ESCUDO ANTI-SÍNCOPA (Muscle Memory)
    // ═══════════════════════════════════════════════════════════════
    // WAVE 2149: Bajado de 0.75 → 0.50 (EL VEREDICTO DE BREJCHA).
    //
    // Con 0.75, los kicks de Brejcha que alternan fuerte/débil
    // (0.200 / 0.100) resultaban en:
    //   kickLevel=0.200 (Instant Attack) → threshold=0.150 → kick de 0.100 MUERE
    //   → motor solo detecta cada 2 kicks → 92 BPM (mitad exacta de 126)
    //
    // WAVE 1163 lo llamó "La Maldición del 85 BPM" — EXACTAMENTE EL MISMO BUG
    // pero causado por Muscle Memory en vez de debounce.
    //
    // Con 0.50:
    //   kickLevel=0.200 → threshold=0.100 → kick de 0.100 PASA ✅
    //   kickLevel=0.200 → síncopa de 0.040 = MUERE (0.040 < 0.100) ✅
    //   kickLevel=0.100 → síncopa de 0.040 = MUERE (0.040 < 0.050) ✅
    // ═══════════════════════════════════════════════════════════════
    const isAboveSyncopation = punch > (this.kickLevel * 0.50)

    this.prevEnergy = punch

    let isOnset = false
    if (isAboveAverage && isSharpAttack && isAboveSyncopation && !this.inKick) {
      const timeSinceLast = timestamp - this.lastOnsetTimestamp
      if (timeSinceLast >= adaptiveDebounce) {
        isOnset = true
        this.inKick = true
        // No actualizamos lastOnsetTimestamp aquí — lo hace el process() IOI engine
        // para mantener el timing compartido entre el path externo y este.

        // WAVE 2139/2149: MEMORIA ASIMÉTRICA (Fast Attack, Slow Release)
        // WAVE 2149: Instant Attack → Fast EMA (70/30).
        //
        // El Instant Attack original (kickLevel = punch) causaba half-BPM:
        //   Brejcha kick fuerte=0.200 → kickLevel=0.200 instantáneo
        //   Siguiente kick real=0.100 → 0.100 < 0.200×0.50=0.100 → BORDERLINE
        //   Con varianza natural → MUERTO → solo detecta cada 2 kicks = 92 BPM
        //
        // Fast EMA (70/30): kickLevel sube rápido pero no al extremo.
        //   Kick 0.200: kickLevel = 0.060×0.70 + 0.200×0.30 = 0.102
        //   Kick 0.200 otra vez: kickLevel = 0.102×0.70 + 0.200×0.30 = 0.131
        //   Converge a ~0.170 con kicks constantes a 0.200.
        //   Threshold (×0.50) = 0.085 → kick de 0.100 PASA siempre ✅
        //   Threshold (×0.50) = 0.085 → síncopa de 0.040 MUERE siempre ✅
        if (punch > this.kickLevel) {
          this.kickLevel = (this.kickLevel * 0.70) + (punch * 0.30)  // Fast Attack
        } else {
          this.kickLevel = (this.kickLevel * 0.90) + (punch * 0.10)  // Slow Release
        }
      }
    }

    // DECAIMIENTO EN SILENCIO: más lento (0.999) y piso más alto (0.045).
    // ~0.1%/frame × 47fps ≈ 4.7%/s → mitad en ~15s de breakdown.
    // WAVE 2146: El piso sube de 0.025 a 0.045 para aguantar breakdowns con
    // señal Radix-2 limpia. Evita que el motor se vuelva hiper-sensible durante
    // intros largas — el bajo sincopado (0.030) sigue bajo el umbral del 75%.
    this.kickLevel = Math.max(0.045, this.kickLevel * 0.999)

    return isOnset
  }

  /**
   * Detect if a BPM change is an octave jump (2× or 0.5×).
   */
  private isOctaveJump(newBpm: number, currentBpm: number): boolean {
    if (currentBpm <= 0) return false
    const ratio = newBpm / currentBpm
    for (const [min, max] of OCTAVE_RANGES) {
      if (ratio >= min && ratio <= max) return true
    }
    return false
  }

  /** Get current stable BPM */
  getBpm(): number {
    return this.stableBpm
  }

  /** Reset all state */
  reset(): void {
    this.lastOnsetTimestamp = 0
    this.onsetCount = 0
    this.intervals = []
    this.stableBpm = 0
    this.rawBpm = 0
    this.currentConfidence = 0
    this.candidateBpm = 0
    this.candidateFrames = 0
    this.octaveLockCounter = 0
    this.octaveLockCandidate = 0
    this.lastBeatAnchor = 0
    this.prevPhase = 0
    this.frameCount = 0
    this.warmupComplete = false
    // WAVE 2136: TRUE 1163.5 REPLICA — reset circular buffer and hysteresis
    this.energyHistory.fill(0)
    this.historyIndex = 0
    this.inKick = false
    this.prevEnergy = 0
    // WAVE 2137: ANTI-SYNCOPATION SHIELD — reset muscle memory to initial value
    this.kickLevel = 0.025
    // WAVE 2150: P99 CEILING GATE — reset onset energy history
    this.onsetEnergyHistory = []
    // WAVE 2158: Reset cluster snapshots
    this.lastClusters = []
  }
}
