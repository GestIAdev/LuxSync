// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Coliseum Service
// ═══════════════════════════════════════════════════════════════════════════
//  Central orchestrator for the Genesis Engine's spawning pipeline.
//
//  spawnOrganism(parentBlueprintId, operatorType):
//    1. Fetch granite ancestor from Vault
//    2. Apply genetic operator → mutated clip + delta_json
//    3. Run PrenatalScreening (G1-G7)
//    4. If viable: estimate rarity, assign custom_name=null, insert to DB
//    5. If non-viable: abort (zero DB writes)
//
//  All work happens in idle time (worker thread). Never in the 44Hz hot path.
// ═══════════════════════════════════════════════════════════════════════════

import { randomUUID } from 'crypto'

import type { GenesisVaultService } from './GenesisVaultService'
import { getGenesisVault } from './GenesisVaultService'
import type { HephAutomationClipV3 } from '../hephaestus/types'
import type {
  MutationOperator,
  RarityTier,
  ContextVector6D,
} from './types'

import {
  applyOperator,
  type JsonPatchOp,
  type OperatorResult,
} from './operators/GeneticOperators'
import { prenatalScreening, type ScreeningResult } from './screening/PrenatalScreening'
import { computeRaritySimple, type RarityOutput } from './loot/RarityEngine'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface SpawnResult {
  success: boolean
  organismId: string | null
  blueprintId: string
  operator: MutationOperator
  rarityTier: RarityTier
  rarityScore: number
  l2Distance: number
  screening: ScreeningResult
  customName: null
  generation: number
}

// ─── RARITY (delegated to RarityEngine) ─────────────────────────────────────

/**
 * Computes rarity using the RarityEngine module.
 * Uses simplified mode (no population signatures for now —
 * full mode will be wired when speciation is implemented in Era IV).
 */
function estimateRarity(l2Distance: number, operator: MutationOperator): RarityOutput {
  return computeRaritySimple(l2Distance, operator)
}

// ─── BEZIER SIGNATURE (compressed feature vector) ───────────────────────────

/**
 * Computes a compact Float32Array signature from the clip's keyframes
 * for similarity/speciation. Used as `bezier_signature` BLOB in DB.
 */
function computeBezierSignature(clip: HephAutomationClipV3): Float32Array {
  const values: number[] = []
  for (const track of clip.tracks) {
    for (const kf of track.curve.keyframes) {
      if (typeof kf.value === 'number') {
        values.push(kf.value)
      }
      if (kf.bezierHandles) {
        values.push(...kf.bezierHandles)
      }
    }
  }
  // Pad/truncate to 128 floats for fixed-size BLOB
  const sig = new Float32Array(128)
  for (let i = 0; i < Math.min(values.length, 128); i++) {
    sig[i] = values[i]
  }
  return sig
}

// ─── ORGANISM ID GENERATION ─────────────────────────────────────────────────

/**
 * Generates organism ID: <console_hash8>:<uuid>
 * For now uses a placeholder hash — in production this comes from the
 * console's identity service.
 */
function generateOrganismId(): string {
  const hash8 = '00000000' // Placeholder — real console hash injected later
  return `${hash8}:${randomUUID()}`
}

// ─── COLISEUM SERVICE ───────────────────────────────────────────────────────

export class ColiseumService {
  private readonly _vault: GenesisVaultService

  constructor(vault?: GenesisVaultService) {
    this._vault = vault ?? getGenesisVault()
  }

  /**
   * Spawns a new organism from a granite ancestor using the specified operator.
   *
   * Pipeline:
   *   1. Fetch ancestor blueprint
   *   2. Apply genetic operator (pure function)
   *   3. Run prenatal screening (G1-G7)
   *   4. If viable → estimate rarity, insert to lfx_organisms
   *   5. If non-viable → abort (zero DB writes)
   *
   * @param parentBlueprintId The granite ancestor's blueprint_id
   * @param operatorType Which genetic operator to apply
   * @param seed Optional deterministic seed for reproducibility
   * @returns SpawnResult with viability + organism details
   */
  spawnOrganism(
    parentBlueprintId: string,
    operatorType: MutationOperator,
    seed?: number,
  ): SpawnResult {
    // 1. Fetch ancestor
    const blueprint = this._vault.getBlueprint(parentBlueprintId)
    if (!blueprint) {
      throw new Error(`[Coliseum] Blueprint not found: ${parentBlueprintId}`)
    }

    const parentClip = blueprint.clipV3

    // 2. Apply genetic operator
    const opResult: OperatorResult = applyOperator(parentClip, operatorType, seed)
    const mutatedClip = opResult.clip
    const delta = opResult.delta

    // 3. Prenatal screening
    const screening = prenatalScreening(mutatedClip)

    // Base result — compute rarity via RarityEngine
    const rarity = estimateRarity(opResult.l2Distance, operatorType)
    const baseResult: SpawnResult = {
      success: false,
      organismId: null,
      blueprintId: parentBlueprintId,
      operator: operatorType,
      rarityTier: rarity.tier,
      rarityScore: rarity.score,
      l2Distance: opResult.l2Distance,
      screening,
      customName: null,
      generation: 1,
    }

    // 4. Non-viable → abort (zero DB writes)
    if (!screening.viable) {
      console.warn(
        `[Coliseum 🧬] Prenatal abort for ${parentBlueprintId} via ${operatorType}: ` +
        `${screening.abortReason}`,
      )
      return baseResult
    }

    // 5. Viable → insert to lfx_organisms
    const organismId = generateOrganismId()
    const bezierSig = computeBezierSignature(mutatedClip)
    const now = Date.now()

    const birthVector: ContextVector6D = {
      zScoreAvg3s: 0,
      lowBandAvg3s: 0,
      energyPhaseEncoded: 0,
      vibeHash: 0,
      sectionEncoded: 0,
      textureEncoded: 0,
    }

    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('[Coliseum] GenesisVault not initialized')
    }

    const insertOrg = db.prepare(
      `INSERT INTO lfx_organisms (
        organism_id, blueprint_id, parent_organism_id, generation,
        custom_name, delta_json, bezier_signature,
        rarity_score, rarity_tier, l2_distance_parent, operator_used,
        neonatal_shield_until, birth_vector_json,
        fitness_score, trials_count, wins_count, vetoes_count, passes_count,
        status, species_id, born_at, last_evaluated_at, last_fired_at,
        swarm_origin_console
      ) VALUES (
        @organism_id, @blueprint_id, @parent_organism_id, @generation,
        @custom_name, @delta_json, @bezier_signature,
        @rarity_score, @rarity_tier, @l2_distance_parent, @operator_used,
        @neonatal_shield_until, @birth_vector_json,
        @fitness_score, @trials_count, @wins_count, @vetoes_count, @passes_count,
        @status, @species_id, @born_at, @last_evaluated_at, @last_fired_at,
        @swarm_origin_console
      )`,
    )

    const tx = db.transaction(() => {
      insertOrg.run({
        organism_id: organismId,
        blueprint_id: parentBlueprintId,
        parent_organism_id: null, // G1 = direct child of granite ancestor
        generation: 1,
        custom_name: null,
        delta_json: JSON.stringify(delta),
        bezier_signature: Buffer.from(bezierSig.buffer),
        rarity_score: rarity.score,
        rarity_tier: rarity.tier,
        l2_distance_parent: opResult.l2Distance,
        operator_used: operatorType,
        neonatal_shield_until: rarity.neonatalShield,
        birth_vector_json: JSON.stringify(birthVector),
        fitness_score: 0.0,
        trials_count: 0,
        wins_count: 0,
        vetoes_count: 0,
        passes_count: 0,
        status: 'alive',
        species_id: null,
        born_at: now,
        last_evaluated_at: null,
        last_fired_at: null,
        swarm_origin_console: null,
      })
    })

    tx()

    console.log(
      `[Coliseum 🧬] Spawned ${organismId} from ${parentBlueprintId} ` +
      `via ${operatorType} — ${rarity.tier} (ρ=${rarity.score.toFixed(3)}, ` +
      `L2=${opResult.l2Distance.toFixed(4)})`,
    )

    return {
      ...baseResult,
      success: true,
      organismId,
      generation: 1,
    }
  }

  /**
   * Spawns the initial G1 cohort for a blueprint (cold start).
   * Generates 3 organisms: 1 control clone, 1 point_mutation, 1 phase_epigenetics.
   */
  spawnInitialCohort(parentBlueprintId: string): readonly SpawnResult[] {
    const results: SpawnResult[] = []

    // 1. Control clone (point_mutation with seed=0, minimal)
    const r1 = this.spawnOrganism(parentBlueprintId, 'point_mutation', 1)
    results.push(r1)

    // 2. Point mutation
    const r2 = this.spawnOrganism(parentBlueprintId, 'point_mutation', Date.now())
    results.push(r2)

    // 3. Phase epigenetics or gene duplication
    const r3 = this.spawnOrganism(parentBlueprintId, 'phase_epigenetics', Date.now())
    results.push(r3)

    const viable = results.filter((r) => r.success).length
    console.log(
      `[Coliseum 🧬] Initial cohort for ${parentBlueprintId}: ` +
      `${viable}/${results.length} viable`,
    )

    return results
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: ColiseumService | null = null

export function getColiseumService(): ColiseumService {
  if (_instance == null) _instance = new ColiseumService()
  return _instance
}

export function __resetColiseumServiceForTests(): void {
  _instance = null
}
