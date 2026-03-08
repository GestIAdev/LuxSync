import type { ClusterSnapshot } from './PacemakerV2'

// --- HARMONIC DIVISORS ---
// Musical polyrhythm ratios, sorted ASCENDING (smallest divisor first).
// PRINCIPLE OF MINIMUM CORRECTION: if multiple harmonics are confirmed
// by cluster evidence, prefer the smallest divisor (gentlest correction).
//
//   1.25  -> 5:4 quintuplet swing (Minimal Techno, Brejcha)
//   1.333 -> 4:3 shuffle/swing (Jazz, Techno)
//   1.50  -> 3:2 tresillo (Cumbia, Latin, Afrobeat)
//   2.00  -> 2:1 octave (universal fallback)
const HARMONIC_DIVISORS = [1.25, 1.333, 1.5, 2.0] as const

// --- BPM MATCH TOLERANCE ---
// Allow +/-2 BPM when matching cluster BPMs to expected harmonics.
// PM2's CLUSTER_TOLERANCE_MS=15ms produces ~1-2 BPM drift at typical tempos.
// 2 BPM is tight enough to reject noise (harmonic candidates are 6+ BPM apart)
// yet loose enough to absorb real PM2 clustering variance.
const BPM_MATCH_TOLERANCE = 2

// --- MINIMUM EVIDENCE VOTES ---
// A secondary cluster must have at least this many votes to be considered
// valid harmonic evidence. Clusters with 1 vote are statistically noise —
// a single interval coincidence. 2+ votes means the pattern repeated.
const MIN_EVIDENCE_VOTES = 2

export interface GearboxResult {
  fundamentalBpm: number
  rawBpm: number
  appliedDivisor: number
  shifted: boolean
  evidenceClusterBpm: number
  evidenceClusterVotes: number
}

/**
 * CLUSTER-AWARE HARMONIC RESOLVER (WAVE 2158)
 *
 * Pure function. No state. Evidence-based resolution.
 *
 * Takes PM2's dominant BPM and full cluster array, searches for
 * physical evidence of a harmonic fundamental in secondary clusters.
 *
 * STRATEGY: BEST EVIDENCE WINS
 * Evaluates ALL divisors. Collects every valid match. Picks the match
 * with the highest cluster votes. On tie, the smallest divisor wins
 * (principle of minimum correction). This prevents noise clusters
 * (1 vote) from stealing resolution from real fundamentals (2+ votes).
 *
 * CONSTRAINTS:
 *   - Evidence cluster must have >= MIN_EVIDENCE_VOTES (2)
 *   - BPM match tolerance: +/- BPM_MATCH_TOLERANCE (2)
 *   - Fundamental must be >= 40 BPM (no sub-bass ghost artifacts)
 *   - Evidence cluster must not be the dominant cluster itself
 *
 * Examples:
 *   Brejcha 161 + cluster at 129@2v -> 161/1.25=128.8~129 -> RESOLVED to 129
 *   Cumbiaton 129 + cluster at 86@2v + noise at 99@1v -> 99@1v rejected (1 vote),
 *       129/1.5=86.0~86@2v -> RESOLVED to 86
 *   DnB 174 + no matching cluster -> PASSTHROUGH 174
 *   House 128 + no matching cluster -> PASSTHROUGH 128
 */
export function clusterAwareResolve(
  dominantBpm: number,
  clusters: ClusterSnapshot[],
): GearboxResult {
  if (dominantBpm <= 0 || clusters.length === 0) {
    return passthrough(dominantBpm)
  }

  // Collect ALL valid harmonic matches across all divisors
  interface HarmonicCandidate {
    divisor: number
    clusterBpm: number
    clusterVotes: number
    distance: number // BPM distance from expected fundamental
  }

  const candidates: HarmonicCandidate[] = []

  for (const divisor of HARMONIC_DIVISORS) {
    const expectedFundamental = dominantBpm / divisor

    // Skip if fundamental would be unreasonably low
    if (expectedFundamental < 40) continue
    // Skip if divisor barely changes the BPM (no real harmonic shift)
    if (Math.abs(expectedFundamental - dominantBpm) < BPM_MATCH_TOLERANCE) continue

    for (const cluster of clusters) {
      // Skip the dominant cluster itself
      if (Math.abs(cluster.bpm - dominantBpm) <= BPM_MATCH_TOLERANCE) continue
      // Reject noise: evidence must be statistically significant
      if (cluster.votes < MIN_EVIDENCE_VOTES) continue

      const distance = Math.abs(cluster.bpm - expectedFundamental)
      if (distance <= BPM_MATCH_TOLERANCE) {
        candidates.push({
          divisor,
          clusterBpm: cluster.bpm,
          clusterVotes: cluster.votes,
          distance,
        })
      }
    }
  }

  // No evidence found anywhere — passthrough
  if (candidates.length === 0) {
    return passthrough(dominantBpm)
  }

  // BEST EVIDENCE WINS:
  // 1. Highest votes (most confirmed pattern)
  // 2. Smallest distance (closest BPM match)
  // 3. Smallest divisor (minimum correction)
  candidates.sort((a, b) => {
    if (b.clusterVotes !== a.clusterVotes) return b.clusterVotes - a.clusterVotes
    if (a.distance !== b.distance) return a.distance - b.distance
    return a.divisor - b.divisor
  })

  const winner = candidates[0]

  console.log(
    `[GEARBOX] HARMONIC RESOLVED: ` +
    `${dominantBpm}bpm /${winner.divisor} ~ ${Math.round(dominantBpm / winner.divisor)}bpm ` +
    `-> cluster evidence at ${winner.clusterBpm}bpm (${winner.clusterVotes}v) ` +
    `RESOLVED TO ${winner.clusterBpm}bpm` +
    (candidates.length > 1 ? ` (${candidates.length} candidates, best-evidence selected)` : '')
  )

  return {
    fundamentalBpm: winner.clusterBpm,
    rawBpm: dominantBpm,
    appliedDivisor: winner.divisor,
    shifted: true,
    evidenceClusterBpm: winner.clusterBpm,
    evidenceClusterVotes: winner.clusterVotes,
  }
}

function passthrough(bpm: number): GearboxResult {
  return {
    fundamentalBpm: Math.round(bpm),
    rawBpm: bpm,
    appliedDivisor: 1.0,
    shifted: false,
    evidenceClusterBpm: 0,
    evidenceClusterVotes: 0,
  }
}

/**
 * STATEFUL GEARBOX - Prevents gear hunting via hysteresis.
 * Once a resolution is locked, holds for LOCK_FRAMES unless
 * the raw BPM changes by more than STABILITY_BPM.
 */
export class GearboxStabilizer {
  private static readonly STABILITY_BPM = 8
  private static readonly LOCK_FRAMES = 30

  private lockedResult: GearboxResult | null = null
  private framesSinceLock = 0

  process(rawBpm: number, confidence: number, clusters: ClusterSnapshot[]): GearboxResult {
    this.framesSinceLock++

    if (rawBpm <= 0 || confidence <= 0) {
      return passthrough(0)
    }

    const fresh = clusterAwareResolve(rawBpm, clusters)

    if (this.lockedResult === null) {
      this.lockedResult = fresh
      this.framesSinceLock = 0
      return fresh
    }

    const rawShift = Math.abs(rawBpm - this.lockedResult.rawBpm)
    const fundamentalShift = Math.abs(fresh.fundamentalBpm - this.lockedResult.fundamentalBpm)

    if (rawShift > GearboxStabilizer.STABILITY_BPM ||
        (fundamentalShift > GearboxStabilizer.STABILITY_BPM &&
         this.framesSinceLock > GearboxStabilizer.LOCK_FRAMES)) {
      console.log(
        `[GEARBOX] SHIFT: ` +
        `${this.lockedResult.rawBpm}/${this.lockedResult.appliedDivisor}=${this.lockedResult.fundamentalBpm} ` +
        `-> ${fresh.rawBpm}/${fresh.appliedDivisor}=${fresh.fundamentalBpm} ` +
        `(after ${this.framesSinceLock} frames)`
      )
      this.lockedResult = fresh
      this.framesSinceLock = 0
      return fresh
    }

    return {
      ...this.lockedResult,
      rawBpm,
    }
  }

  reset(): void {
    this.lockedResult = null
    this.framesSinceLock = 0
  }
}
