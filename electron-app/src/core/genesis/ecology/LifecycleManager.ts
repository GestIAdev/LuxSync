// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA IV: Lifecycle Manager
// ═══════════════════════════════════════════════════════════════════════════
//  Manages status transitions evaluated in geological time (background tasks).
//
//  Transitions:
//    alive → champion:   fitness > speciesAvg * (1 + CHAMPION_MARGIN) AND trials >= 5
//    champion → alive:   fitness < speciesAvg * (1 - DEMOTION_MARGIN)
//    alive → culled:     trials > neonatalShieldUntil AND survivalRate < CULL_THRESHOLD
//    Hall of Fame:       LEGENDARY/MYTHIC with trials >= 25 AND survivalRate > 0.85
//                        (identified via v_hall_of_fame view, status left as-is
//                         for future UI canonization)
//
//  Runs in background. Never in the 44Hz hot path.
// ═══════════════════════════════════════════════════════════════════════════

import type { GenesisVaultService } from '../GenesisVaultService'
import { getGenesisVault } from '../GenesisVaultService'
import type { OrganismStatus, LfxOrganism, RarityTier, MutationOperator } from '../types'
import { generateOrganismName } from '../naming/ProceduralNamer'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CHAMPION_MARGIN = 0.30       // must be 30% above species average
const DEMOTION_MARGIN = 0.20       // falls 20% below species average
const CULL_THRESHOLD = 0.15        // survival rate below this = cull
const MIN_TRIALS_FOR_CHAMPION = 5  // need at least 5 trials to be eligible
const HALL_OF_FAME_TRIALS = 25
const HALL_OF_FAME_SURVIVAL = 0.85

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface OrganismRow {
  organism_id: string
  species_id: string | null
  status: string
  fitness_score: number
  trials_count: number
  passes_count: number
  neonatal_shield_until: number
  rarity_tier: string
  custom_name: string | null
  blueprint_id: string
  generation: number
  rarity_score: number
  l2_distance_parent: number
  operator_used: string
}

export interface TransitionRecord {
  organismId: string
  fromStatus: string
  toStatus: string
  reason: string
}

export interface LifecycleResult {
  promotions: number
  demotions: number
  culls: number
  hallOfFameCandidates: number
  transitions: TransitionRecord[]
}

// ─── LIFECYCLE MANAGER ──────────────────────────────────────────────────────

export class LifecycleManager {
  private readonly _vault: GenesisVaultService

  constructor(vault?: GenesisVaultService) {
    this._vault = vault ?? getGenesisVault()
  }

  /**
   * Runs all lifecycle transitions on alive + champion organisms.
   * Evaluates per-species fitness averages and applies promotions/demotions/culling.
   */
  runTransitions(): LifecycleResult {
    const db = this._vault.getDb()

    // 1. Fetch all alive + champion organisms
    const rows = db.prepare(
      `SELECT organism_id, species_id, status, fitness_score,
              trials_count, passes_count, neonatal_shield_until, rarity_tier,
              custom_name, blueprint_id, generation, rarity_score, l2_distance_parent, operator_used
       FROM lfx_organisms
       WHERE status IN ('alive', 'champion')`,
    ).all() as OrganismRow[]

    if (rows.length === 0) {
      return { promotions: 0, demotions: 0, culls: 0, hallOfFameCandidates: 0, transitions: [] }
    }

    // 2. Compute per-species fitness averages
    const speciesFitness = new Map<string, { sum: number; count: number }>()
    for (const row of rows) {
      const sid = row.species_id ?? '__unassigned'
      const entry = speciesFitness.get(sid) ?? { sum: 0, count: 0 }
      entry.sum += row.fitness_score
      entry.count++
      speciesFitness.set(sid, entry)
    }

    const speciesAvg = new Map<string, number>()
    for (const [sid, { sum, count }] of speciesFitness) {
      speciesAvg.set(sid, count > 0 ? sum / count : 0)
    }

    // 3. Evaluate transitions
    const transitions: TransitionRecord[] = []
    let promotions = 0
    let demotions = 0
    let culls = 0
    let hallOfFameCandidates = 0

    const updateStmt = db.prepare(
      'UPDATE lfx_organisms SET status = @status WHERE organism_id = @id',
    )

    const toProcess: { id: string; newStatus: OrganismStatus; reason: string; fromStatus: string }[] = []

    for (const row of rows) {
      const sid = row.species_id ?? '__unassigned'
      const avg = speciesAvg.get(sid) ?? 0
      const survivalRate = row.trials_count > 0
        ? row.passes_count / (row.trials_count + 1)  // Laplace smoothing
        : 0

      // Hall of Fame check (informational — does not change status)
      if (
        (row.rarity_tier === 'LEGENDARY' || row.rarity_tier === 'MYTHIC') &&
        row.trials_count >= HALL_OF_FAME_TRIALS &&
        survivalRate > HALL_OF_FAME_SURVIVAL
      ) {
        hallOfFameCandidates++
        // Don't change status — UI will handle canonization
      }

      // Culling: shield expired AND survival rate unacceptable
      if (
        row.status === 'alive' &&
        row.trials_count > row.neonatal_shield_until &&
        survivalRate < CULL_THRESHOLD
      ) {
        toProcess.push({
          id: row.organism_id,
          newStatus: 'culled',
          reason: `Shield expired (trials=${row.trials_count} > shield=${row.neonatal_shield_until}), survival=${survivalRate.toFixed(3)} < ${CULL_THRESHOLD}`,
          fromStatus: row.status,
        })
        continue
      }

      // Promotion: alive → champion
      if (
        row.status === 'alive' &&
        row.trials_count >= MIN_TRIALS_FOR_CHAMPION &&
        row.fitness_score > avg * (1 + CHAMPION_MARGIN) &&
        row.fitness_score > 0
      ) {
        toProcess.push({
          id: row.organism_id,
          newStatus: 'champion',
          reason: `Fitness ${row.fitness_score.toFixed(3)} > species avg ${avg.toFixed(3)} × ${(1 + CHAMPION_MARGIN).toFixed(3)} (trials=${row.trials_count})`,
          fromStatus: row.status,
        })
        continue
      }

      // Demotion: champion → alive
      if (
        row.status === 'champion' &&
        row.fitness_score < avg * (1 - DEMOTION_MARGIN)
      ) {
        toProcess.push({
          id: row.organism_id,
          newStatus: 'alive',
          reason: `Fitness ${row.fitness_score.toFixed(3)} < species avg ${avg.toFixed(3)} × ${(1 - DEMOTION_MARGIN).toFixed(3)}`,
          fromStatus: row.status,
        })
        continue
      }
    }

    // 4. Batch write transitions
    if (toProcess.length > 0) {
      const nameStmt = db.prepare(
        'UPDATE lfx_organisms SET custom_name = ? WHERE organism_id = ?',
      )
      const rowMap = new Map(rows.map(r => [r.organism_id, r]))
      const tx = db.transaction(() => {
        for (const item of toProcess) {
          updateStmt.run({ status: item.newStatus, id: item.id })
          transitions.push({
            organismId: item.id,
            fromStatus: item.fromStatus,
            toStatus: item.newStatus,
            reason: item.reason,
          })

          if (item.newStatus === 'champion') {
            promotions++
            // 🧬 WAVE 5000.V3 BAPTISM: Generate procedural name for new champions
            const row = rowMap.get(item.id)
            if (row && !row.custom_name) {
              const name = generateOrganismName({
                organismId: row.organism_id,
                blueprintId: row.blueprint_id,
                parentOrganismId: null,
                generation: row.generation,
                customName: null,
                deltaJson: '',
                bezierSignature: new Float32Array(0),
                rarityScore: row.rarity_score,
                rarityTier: row.rarity_tier as RarityTier,
                l2DistanceParent: row.l2_distance_parent,
                operatorUsed: row.operator_used as MutationOperator,
                neonatalShieldUntil: row.neonatal_shield_until,
                birthVector: { zScoreAvg3s: 0, lowBandAvg3s: 0, energyPhaseEncoded: 0, vibeHash: 0, sectionEncoded: 0, textureEncoded: 0 },
                fitnessScore: row.fitness_score,
                trialsCount: row.trials_count,
                winsCount: 0, vetoesCount: 0, passesCount: row.passes_count,
                status: 'champion' as OrganismStatus,
                speciesId: row.species_id,
                bornAt: 0, lastEvaluatedAt: null, lastFiredAt: null,
                swarmOriginConsole: null,
              })
              nameStmt.run(name, item.id)
              console.log(`[Lifecycle 🧬] ✨ Baptism: ${item.id} → "${name}"`)
            }
          } else if (item.newStatus === 'alive') demotions++
          else if (item.newStatus === 'culled') culls++
        }
      })
      tx()
    }

    console.log(
      `[Lifecycle 🧬] Transitions: ${promotions}↑ ${demotions}↓ ${culls}✂️ | ` +
      `Hall of Fame candidates: ${hallOfFameCandidates} | ` +
      `Total evaluated: ${rows.length}`,
    )

    return {
      promotions,
      demotions,
      culls,
      hallOfFameCandidates,
      transitions,
    }
  }

  /**
   * Queries the v_hall_of_fame view for organisms ready for canonization.
   * Returns organism IDs that are LEGENDARY/MYTHIC with high survival.
   */
  getHallOfFameCandidates(): string[] {
    const db = this._vault.getDb()

    const rows = db.prepare(
      `SELECT organism_id FROM v_hall_of_fame`,
    ).all() as { organism_id: string }[]

    return rows.map((r) => r.organism_id)
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: LifecycleManager | null = null

export function getLifecycleManager(): LifecycleManager {
  if (_instance == null) _instance = new LifecycleManager()
  return _instance
}

export function __resetLifecycleManagerForTests(): void {
  _instance = null
}
