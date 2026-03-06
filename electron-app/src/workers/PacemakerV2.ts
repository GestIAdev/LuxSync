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

/** Debounce window after a valid onset (ms).
 *  The system goes DEAF for this duration to prevent:
 *  - Bass reverb tail counting as a second kick
 *  - Sub-bass rumble triggering multiple onsets per kick
 *  WAVE 2134: THE TRACTOR — 300 → 200ms.
 *  Con umbral fijo de 0.045 (la guadaña rústica), el muro de hierro
 *  ya filtra güiros y ruido. 200ms permite leer percusión rápida latina
 *  sin riesgo de doble-trigger (190 BPM = 315ms, 200ms < 315ms).
 *  Herencia de WAVE 1163: MIN_INTERVAL_MS = 200ms fue lo que rompió
 *  el círculo vicioso del debounce adaptativo. */
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

/** Floor for adaptive debounce — never blind for less than this.
 *  200ms = theoretical maximum 300 BPM (DnB/Hardcore). */
const ADAPTIVE_DEBOUNCE_FLOOR_MS = 200

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

    // ─── 1. ONSET GATE: Dynamic Debounce + Range Filter ──────────
    // WAVE 2148.1: THE OUTER GATE WAS STATIC (200ms). That let 232ms
    // intervals through — Brejcha's sincopated bass fires every ~230ms
    // and was registering as onsets BETWEEN kicks.
    //
    // Fix: outer gate mirrors the inner gate logic.
    // If stableBpm is known → use 75% of beat interval (same as inner ear)
    // If no stableBpm yet → use 250ms (slightly above 200ms to kill sub-250ms trash)
    //
    // 126 BPM: 476ms × 0.75 = 357ms  ← kills 232ms sincopated bass ✅
    // 160 BPM: 375ms × 0.75 = 281ms  ← tight but safe ✅
    // 185 BPM: 324ms × 0.75 = 243ms  ← still above 232ms ✅
    // no BPM:  250ms fallback          ← kills sub-250ms noise ✅
    const outerDebounce = this.stableBpm > 0
      ? Math.max(250, (60000 / this.stableBpm) * 0.75)
      : 250

    if (onsetDetected) {
      const timeSinceLast = timestamp - this.lastOnsetTimestamp

      // THE BLINDNESS: Ignore if within debounce window
      if (timeSinceLast >= outerDebounce) {
        // First onset ever? Just record it, no interval yet.
        if (this.lastOnsetTimestamp > 0) {
          // THE WALL: Range filter
          if (timeSinceLast >= MIN_INTERVAL_MS && timeSinceLast <= MAX_INTERVAL_MS) {
            // Valid interval — record it
            this.intervals.push({ ms: timeSinceLast, timestamp })

            // Trim to max history
            if (this.intervals.length > MAX_INTERVAL_HISTORY) {
              this.intervals.shift()
            }

            kickDetectedThisFrame = true
          }
          // Intervals outside range are silently discarded (noise)
        }

        // Update last onset timestamp (even if interval was out of range)
        this.lastOnsetTimestamp = timestamp
        this.onsetCount++
        kickDetectedThisFrame = true
      }
    }

    // ─── 2. PURGE STALE INTERVALS ────────────────────────────────
    const cutoff = timestamp - INTERVAL_MAX_AGE_MS
    this.intervals = this.intervals.filter(i => i.timestamp > cutoff)

    // ─── 3. CLUSTERING + BPM CALCULATION ─────────────────────────
    if (this.intervals.length >= MIN_INTERVALS_FOR_BPM) {
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

    // ─── 5. DIAGNOSTIC LOG ───────────────────────────────────────
    if (this.frameCount % DIAGNOSTIC_INTERVAL_FRAMES === 0 && this.stableBpm > 0) {
      console.log(
        `[💓 PACEMAKER v2] ${this.stableBpm}bpm (raw=${this.rawBpm}) ` +
        `conf=${this.currentConfidence.toFixed(3)} intervals=${this.intervals.length} ` +
        `onsets=${this.onsetCount} gate=${Math.round(outerDebounce)}ms`
      )
    }

    return {
      bpm: this.stableBpm,
      confidence: this.currentConfidence,
      kickCount: this.onsetCount,
      kickDetected: kickDetectedThisFrame,
      beatPhase,
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
   * WAVE 2148: ANTI-OCTAVE-DOUBLING
   * If the dominant cluster has ~2× the BPM of another cluster with ≥40%
   * of the votes, the engine is seeing subdivisions (kicks + offbeats) and
   * doubling the real tempo. Prefer the slower (correct) cluster.
   *
   * Real case: 92 BPM track → onsets every 324ms AND 648ms.
   * Cluster A: centerMs=324, count=14, bpm=185  ← dominant by votes
   * Cluster B: centerMs=648, count=8,  bpm=92   ← real tempo
   * ratio B/A = 648/324 = 2.0 → anti-doubling fires → return B.
   */
  private findDominantCluster(clusters: IntervalCluster[]): IntervalCluster | null {
    if (clusters.length === 0) return null
    if (clusters.length === 1) return clusters[0]

    // Sort by count descending
    const sorted = [...clusters].sort((a, b) => b.count - a.count)
    const largest = sorted[0]

    // ─── WAVE 2148: ANTI-OCTAVE-DOUBLING ─────────────────────────
    // Check if the dominant cluster is a 2× subdivision of a slower cluster.
    // If yes, the slower cluster is the real tempo — prefer it.
    for (const c of sorted.slice(1)) {
      if (c.count < largest.count * 0.40) continue  // Not enough votes to challenge
      const ratio = c.centerMs / largest.centerMs
      // Ratio ~2.0 means c is the whole note, largest is the half note (double BPM)
      if (ratio >= 1.85 && ratio <= 2.15) {
        console.log(
          `[💓 PACEMAKER v2 ANTI-DOUBLE] Rejecting ${Math.round(largest.bpm)}BPM ` +
          `(${largest.count} votes, ${Math.round(largest.centerMs)}ms) ` +
          `in favour of ${Math.round(c.bpm)}BPM ` +
          `(${c.count} votes, ${Math.round(c.centerMs)}ms) — octave doubling detected`
        )
        return c
      }
    }

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

    // ─── 3. DEBOUNCE DINÁMICO — WAVE 2147: DYNAMIC ARMOR ────────
    // WAVE 2141 usaba un escudo fijo del 80% — nos cegaba durante cambios de tempo.
    //
    // WAVE 2147: El escudo ahora escala con la confianza actual del motor:
    //   Confianza alta (1.0) → shieldMultiplier = 0.80 → escudo máximo (bloquea síncopas)
    //   Confianza nula (0.0) → shieldMultiplier = 0.40 → modo escucha activa (aprende nuevo tempo)
    //
    // Cuando el DJ sube el BPM (86→126), la confianza del 86 se desploma.
    // El escudo se encoge del 80% al 40%, dejando entrar el nuevo ritmo.
    // Una vez estabilizado el 126, la confianza sube y el escudo vuelve al 80%.
    //
    // Ejemplos con confianza = 1.0 (shield 80%):
    //   A 125 BPM: max(200, 480×0.80) = 384ms  ← síncopa a 360ms = BLOQUEADA ✅
    //   A 160 BPM: max(200, 375×0.80) = 300ms  ← head-room de 75ms ✅
    // Ejemplos con confianza = 0.0 (shield 40%):
    //   A 125 BPM: max(200, 480×0.40) = 200ms  ← escucha activa, aprende rápido ✅
    const expectedInterval = currentBpm > 0 ? (60000 / currentBpm) : 500
    const shieldMultiplier = 0.40 + (this.currentConfidence * 0.40)
    let adaptiveDebounce = Math.max(ADAPTIVE_DEBOUNCE_FLOOR_MS, expectedInterval * shieldMultiplier)

    // ─── 3b. AP-KICK: ARMOR-PIERCING PROTOCOL — WAVE 2147 ────────
    // Un bombo puro de Minimal Techno tras un breakdown puede llegar a 0.200.
    // Un impacto que supera en 50% a nuestra memoria muscular es INNEGABLE.
    // No someterlo a reglas de tempo — rompemos el escudo al límite físico (200ms).
    //
    // Ejemplo: kickLevel=0.090, bombo de Brejcha a 0.198
    //   punch (0.198) > kickLevel×1.5 (0.135) → adaptiveDebounce = 200ms ⚡
    // El elefante rompe la pared. El nuevo tempo entra limpio.
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

    // WAVE 2137: EL ESCUDO ANTI-SÍNCOPA (Muscle Memory)
    // El golpe debe tener al menos el 75% de la fuerza del último bombo aceptado.
    // Si un bombo pegó a 0.052 → kickLevel ≈ 0.052 → umbral = 0.039.
    // La síncopa de 0.028 se estrella contra 0.039 y muere. Siempre.
    const isAboveSyncopation = punch > (this.kickLevel * 0.75)

    this.prevEnergy = punch

    let isOnset = false
    if (isAboveAverage && isSharpAttack && isAboveSyncopation && !this.inKick) {
      const timeSinceLast = timestamp - this.lastOnsetTimestamp
      if (timeSinceLast >= adaptiveDebounce) {
        isOnset = true
        this.inKick = true
        // No actualizamos lastOnsetTimestamp aquí — lo hace el process() IOI engine
        // para mantener el timing compartido entre el path externo y este.

        // WAVE 2139: MEMORIA ASIMÉTRICA (Instant Attack, Slow Release)
        // Si el bombo nuevo supera la memoria, aprendemos al instante: guardia a tope.
        // Si el bombo es más suave, bajamos muy despacio (EMA 90/10).
        // Efecto: el primer kick del drop de Brejcha (0.060) aplasta la memoria
        // inmediatamente → umbral sube a 0.045 → síncopas mueren en el acto.
        if (punch > this.kickLevel) {
          this.kickLevel = punch                                // Instant Attack ⚡
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
  }
}
