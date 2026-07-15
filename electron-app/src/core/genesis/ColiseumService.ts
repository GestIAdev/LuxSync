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
  crossover,
  makeRng,
  stringToSeed,
  type JsonPatchOp,
  type OperatorResult,
  type CrossoverResult,
} from './operators/GeneticOperators'
import { prenatalScreening, type ScreeningResult } from './screening/PrenatalScreening'
import { computeRaritySimple, type RarityOutput } from './loot/RarityEngine'
import { getHeatmapLogger } from './fitness/HeatmapLogger'
import { getSpeciationEngine, type SpeciationResult } from './ecology/SpeciationEngine'
import { getLifecycleManager, type LifecycleResult } from './ecology/LifecycleManager'
import { getOrganismMaterializer } from './OrganismMaterializer'

// ─── OPERATOR ROULETTE (Structural Bias) ───────────────────────────────────
// WAVE 6000.V4: Weighted selection favors structural innovation.
// Without this, focal_mutation dominates and structural operators
// (macro_splice, adaptive_pruning) are never selected.
const OPERATOR_WEIGHTS_ROULETTE: ReadonlyArray<[MutationOperator, number]> = Object.freeze([
  ['focal_mutation',        0.20],
  ['macro_splice',          0.15],
  ['proportional_stretch',  0.15],
  ['gene_augmentation',     0.18],
  ['spatial_resonance',     0.15],
  ['curve_adaptation',      0.12],
  ['adaptive_pruning',      0.05],
])

function pickWeightedOperator(rng: () => number): MutationOperator {
  const r = rng()
  let acc = 0
  for (const [op, weight] of OPERATOR_WEIGHTS_ROULETTE) {
    acc += weight
    if (r < acc) return op
  }
  return OPERATOR_WEIGHTS_ROULETTE[0][0]
}

// ─── METABOLIC CONSTANTS (Lamarckian Medium) ───────────────────────────────
// No arbitrary population caps. Regulation emerges from thermodynamics:
//   • Entropy: existence costs energy (periodic decay)
//   • Apoptosis: starvation below threshold → dissolution
//   • Mitosis: abundance above threshold → cellular division
//   • Vital Space: carrying capacity regulates spawn rates (Stellaris POP model)
const ENTROPY_DECAY = 0.02          // fitness decay per maintenance cycle (~60s)
const APOPTOSIS_THRESHOLD = 0.10    // below this vitality → culled (starved)
const MITOSIS_THRESHOLD = 0.85      // above this + trials≥5 → may reproduce
const MITOSIS_MIN_TRIALS = 5        // stability proof before reproduction
const MITOSIS_ENERGY_TRANSFER = 0.35  // parent gives 35% of vitality to child

// 🧬 SEMELPARITY: Sexual reproduction thresholds (The Mantis Rule)
const SEXUAL_FITNESS_THRESHOLD = 0.80  // elite fitness required for breeding
const SEXUAL_MIN_TRIALS = 10           // stability proof before breeding

// 🧬 WAVE 6000.V9: VITAL SPACE — Carrying capacity (Stellaris POP model)
// Maximum allowed alive organisms. Spawn probability scales inversely:
//   0 pop = 100% spawn chance, MAX pop = 0% spawn chance.
// Overcrowding (>80% capacity) also accelerates entropy decay (starvation).
const MAX_VITAL_SPACE = 60

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

export interface SpawnHybridResult {
  success: boolean
  organismId: string | null
  blueprintId: string
  parentOrganismIdA: string
  parentOrganismIdB: string
  dominantParent: 'A' | 'B'
  rarityTier: RarityTier
  rarityScore: number
  l2Distance: number
  screening: ScreeningResult
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
   * Spawns a new organism from a granite ancestor OR a living parent (Lamarckian mitosis).
   *
   * Pipeline:
   *   1. Fetch ancestor blueprint (or materialize parent organism)
   *   2. Apply genetic operator (pure function)
   *   3. Run prenatal screening (G1-G7)
   *   4. If viable → estimate rarity, insert to lfx_organisms
   *   5. If non-viable → abort (zero DB writes)
   *
   * @param parentBlueprintId The granite ancestor's blueprint_id
   * @param operatorType Which genetic operator to apply
   * @param seed Optional deterministic seed for reproducibility
   * @param parentOrganismId If set, spawn from a living organism (mitosis) instead of granite ancestor
   * @param birthFitness Optional inherited fitness (from mitosis energy transfer)
   * @returns SpawnResult with viability + organism details
   */
  spawnOrganism(
    parentBlueprintId: string,
    operatorType: MutationOperator,
    seed?: number,
    parentOrganismId?: string,
    birthFitness?: number,
  ): SpawnResult {
    // 1. Fetch ancestor
    const blueprint = this._vault.getBlueprint(parentBlueprintId)
    if (!blueprint) {
      throw new Error(`[Coliseum] Blueprint not found: ${parentBlueprintId}`)
    }

    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('[Coliseum] GenesisVault not initialized')
    }

    // 1b. If mitosis: materialize the parent organism's clip instead of granite ancestor
    let parentClip: HephAutomationClipV3
    let parentGeneration = 1
    if (parentOrganismId) {
      const materialized = getOrganismMaterializer().materialize(parentOrganismId)
      parentClip = materialized.clip
      const parentRow = db.prepare(
        'SELECT generation FROM lfx_organisms WHERE organism_id = ?',
      ).get(parentOrganismId) as { generation: number } | undefined
      parentGeneration = (parentRow?.generation ?? 1) + 1
    } else {
      parentClip = blueprint.clipV3
      parentGeneration = 1
    }

    // 2. Apply genetic operator
    const opResult: OperatorResult = applyOperator(parentClip, operatorType, seed)
    const mutatedClip = opResult.clip
    const delta = opResult.delta

    // 3. Prenatal screening (G7 redundancy gate uses L2 distance)
    const screening = prenatalScreening(mutatedClip, opResult.l2Distance)

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
        parent_organism_id: parentOrganismId ?? null, // null = G1 from granite ancestor
        generation: parentGeneration,
        custom_name: null,
        delta_json: JSON.stringify(delta),
        bezier_signature: Buffer.from(bezierSig.buffer),
        rarity_score: rarity.score,
        rarity_tier: rarity.tier,
        l2_distance_parent: opResult.l2Distance,
        operator_used: operatorType,
        neonatal_shield_until: rarity.neonatalShield,
        birth_vector_json: JSON.stringify(birthVector),
        fitness_score: birthFitness ?? 0.0,
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
      generation: parentGeneration,
    }
  }

  /**
   * WAVE 6000.V3 — Sexual reproduction via domain crossover.
   *
   * Both parents must be living organisms (not granite ancestors).
   * The hybrid inherits temporal tracks from one parent and spatial tracks
   * from the other, with blended cognitiveDNA. Dual lineage is recorded:
   *   parent_organism_id = dominant parent
   *   parent_organism_id_secondary = other parent
   *
   * @param parentOrganismIdA  First parent organism ID
   * @param parentOrganismIdB  Second parent organism ID (must differ from A)
   * @param seed               Optional deterministic seed
   * @returns SpawnHybridResult with viability + organism details
   */
  spawnHybrid(
    parentOrganismIdA: string,
    parentOrganismIdB: string,
    seed?: number,
  ): SpawnHybridResult {
    if (parentOrganismIdA === parentOrganismIdB) {
      throw new Error('[Coliseum] Sexual reproduction requires two distinct parents')
    }

    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('[Coliseum] GenesisVault not initialized')
    }

    // 1. Materialize both parents
    const matA = getOrganismMaterializer().materialize(parentOrganismIdA)
    const matB = getOrganismMaterializer().materialize(parentOrganismIdB)
    const clipA = matA.clip
    const clipB = matB.clip

    // 1b. Fetch fitness scores for dominance determination
    const rowA = db.prepare(
      'SELECT fitness_score, generation, blueprint_id FROM lfx_organisms WHERE organism_id = ?',
    ).get(parentOrganismIdA) as { fitness_score: number; generation: number; blueprint_id: string } | undefined
    const rowB = db.prepare(
      'SELECT fitness_score, generation, blueprint_id FROM lfx_organisms WHERE organism_id = ?',
    ).get(parentOrganismIdB) as { fitness_score: number; generation: number; blueprint_id: string } | undefined

    if (!rowA || !rowB) {
      throw new Error('[Coliseum] One or both parent organisms not found')
    }

    const fitnessA = rowA.fitness_score
    const fitnessB = rowB.fitness_score
    const maxGen = Math.max(rowA.generation, rowB.generation)
    const childGeneration = maxGen + 1

    // 2. Apply crossover operator
    const xResult: CrossoverResult = crossover(clipA, clipB, fitnessA, fitnessB, seed)
    const hybridClip = xResult.clip
    const delta = xResult.delta

    // 3. Prenatal screening (G7 redundancy gate uses L2 distance)
    const screening = prenatalScreening(hybridClip, xResult.l2Distance)

    // 4. Rarity estimation
    const rarity = estimateRarity(xResult.l2Distance, 'crossover')

    const dominantId = xResult.dominantParent === 'A' ? parentOrganismIdA : parentOrganismIdB
    const secondaryId = xResult.dominantParent === 'A' ? parentOrganismIdB : parentOrganismIdA
    const blueprintId = xResult.dominantParent === 'A' ? rowA.blueprint_id : rowB.blueprint_id

    const baseResult: SpawnHybridResult = {
      success: false,
      organismId: null,
      blueprintId,
      parentOrganismIdA,
      parentOrganismIdB,
      dominantParent: xResult.dominantParent,
      rarityTier: rarity.tier,
      rarityScore: rarity.score,
      l2Distance: xResult.l2Distance,
      screening,
      generation: childGeneration,
    }

    // 5. Non-viable → abort
    if (!screening.viable) {
      console.warn(
        `[Coliseum 🧬] Hybrid prenatal abort: ${screening.abortReason}`,
      )
      return baseResult
    }

    // 6. Viable → insert with dual lineage
    const organismId = generateOrganismId()
    const bezierSig = computeBezierSignature(hybridClip)
    const now = Date.now()

    const birthVector: ContextVector6D = {
      zScoreAvg3s: 0,
      lowBandAvg3s: 0,
      energyPhaseEncoded: 0,
      vibeHash: 0,
      sectionEncoded: 0,
      textureEncoded: 0,
    }

    const insertOrg = db.prepare(
      `INSERT INTO lfx_organisms (
        organism_id, blueprint_id, parent_organism_id, parent_organism_id_secondary, generation,
        custom_name, delta_json, bezier_signature,
        rarity_score, rarity_tier, l2_distance_parent, operator_used,
        neonatal_shield_until, birth_vector_json,
        fitness_score, trials_count, wins_count, vetoes_count, passes_count,
        status, species_id, born_at, last_evaluated_at, last_fired_at,
        swarm_origin_console
      ) VALUES (
        @organism_id, @blueprint_id, @parent_organism_id, @parent_organism_id_secondary, @generation,
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
        blueprint_id: blueprintId,
        parent_organism_id: dominantId,
        parent_organism_id_secondary: secondaryId,
        generation: childGeneration,
        custom_name: null,
        delta_json: JSON.stringify(delta),
        bezier_signature: Buffer.from(bezierSig.buffer),
        rarity_score: rarity.score,
        rarity_tier: rarity.tier,
        l2_distance_parent: xResult.l2Distance,
        operator_used: 'crossover',
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
      `[Coliseum 🧬] Hybrid ${organismId} from ${parentOrganismIdA} × ${parentOrganismIdB} ` +
      `— ${rarity.tier} (ρ=${rarity.score.toFixed(3)}, L2=${xResult.l2Distance.toFixed(4)})`,
    )

    return {
      ...baseResult,
      success: true,
      organismId,
    }
  }

  /**
   * Spawns the initial G1 cohort for a blueprint (cold start).
   * WAVE 6000.V9: Dynamic spawn probability based on Vital Space (carrying capacity).
   * Spawn chance = 1.0 - (currentPop / MAX_VITAL_SPACE).
   * Empty ecosystem → 100% spawn. Full ecosystem → 0% spawn.
   */
  spawnInitialCohort(parentBlueprintId: string): readonly SpawnResult[] {
    // WAVE 6000.V5: Deterministic PRNG — no Math.random()
    const rng = makeRng(stringToSeed(`${parentBlueprintId}-${Date.now()}`))

    // 🧬 WAVE 6000.V9: Dynamic spawn gate based on carrying capacity
    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('[Coliseum] GenesisVault not initialized')
    }
    const popRow = db.prepare(
      'SELECT count(*) as pop FROM lfx_organisms WHERE status = \'alive\'',
    ).get() as { pop: number }
    const currentPop = popRow.pop
    const popRatio = Math.min(1.0, currentPop / MAX_VITAL_SPACE)
    const spawnChance = 1.0 - popRatio

    if (rng() > spawnChance) {
      console.log(
        `[Coliseum 🧬] Initial cohort for ${parentBlueprintId}: skipped ` +
        `(vital space: ${currentPop}/${MAX_VITAL_SPACE}, spawn chance: ${(spawnChance * 100).toFixed(0)}%)`,
      )
      return []
    }

    const operator = pickWeightedOperator(rng)
    const r1 = this.spawnOrganism(parentBlueprintId, operator, Date.now())

    const viable = r1.success ? 1 : 0
    console.log(
      `[Coliseum 🧬] Initial cohort for ${parentBlueprintId}: ` +
      `${viable}/1 viable via ${operator}`,
    )

    return [r1]
  }

  /**
   * Runs ecological maintenance in geological time (background task).
   *
   * METABOLIC PIPELINE (Lamarckian Medium):
   *   1. Flush pending HeatmapLogger events → batch insert to context_heatmaps
   *   2. Entropy Decay → all alive organisms lose vitality (existence costs energy)
   *   3. Apoptosis → organisms below starvation threshold dissolve (status='culled')
   *   4. Speciation → K-means clustering on bezier signatures → species_id assignment
   *   5. Lifecycle transitions → promotions/demotions/champion culling + HoF scan
   *   6. Mitosis → high-vitality organisms reproduce (cellular division)
   *
   * Designed to be invoked by a background timer every 60s or on demand.
   * NEVER call from the 44Hz hot path.
   */
  async runEcologicalMaintenance(): Promise<{
    heatmapFlush: boolean
    entropyDecayed: number
    apoptosisCulls: number
    speciation: SpeciationResult
    lifecycle: LifecycleResult
    mitosisSpawns: number
    sexualSpawns: number
  }> {
    // 1. Flush heatmap logger
    const logger = getHeatmapLogger()
    await logger.flush()

    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('[Coliseum] GenesisVault not initialized')
    }

    // 2. Entropy Decay — existence consumes energy
    const entropyDecayed = this._applyEntropyDecay(db)

    // 3. Apoptosis — starvation dissolution
    const apoptosisCulls = this._apoptosis(db)

    // 4. Run speciation
    const speciation = getSpeciationEngine().runSpeciation()

    // 5. Run lifecycle transitions
    const lifecycle = getLifecycleManager().runTransitions()

    // 6. Mitosis — cellular division for thriving organisms
    const mitosisSpawns = this._mitosis(db)

    // 7. Sexual reproduction — elite breeding with semelparity (parents die)
    const sexualSpawns = this._sexualReproduction(db)

    console.log(
      `[Coliseum 🧬] Ecological maintenance complete: ` +
      `entropy:${entropyDecayed} ↓, apoptosis:${apoptosisCulls} ✖, ` +
      `${speciation.speciesCount} species, ` +
      `${lifecycle.promotions}↑ ${lifecycle.demotions}↓ ${lifecycle.culls}✂️, ` +
      `${lifecycle.hallOfFameCandidates} HoF, mitosis:${mitosisSpawns} ⊕, sexual:${sexualSpawns} ♀`,
    )

    return {
      heatmapFlush: true,
      entropyDecayed,
      apoptosisCulls,
      speciation,
      lifecycle,
      mitosisSpawns,
      sexualSpawns,
    }
  }

  // ─── METABOLIC LAWS ───────────────────────────────────────────────────────

  /**
   * Entropy: Periodic vitality decay for all alive organisms.
   * The simple act of existing consumes energy. This is the thermodynamic
   * cost of life — without being chosen by Selene, organisms slowly starve.
   *
   * 🧬 WAVE 6000.V9: Overcrowding accelerates starvation.
   * When population exceeds 80% of MAX_VITAL_SPACE, an additional
   * crowding penalty is applied to cull weak organisms faster.
   */
  private _applyEntropyDecay(db: any): number {
    // Query current population for crowding calculation
    const popRow = db.prepare(
      'SELECT count(*) as pop FROM lfx_organisms WHERE status = \'alive\'',
    ).get() as { pop: number }
    const currentPop = popRow.pop
    const popRatio = Math.min(1.0, currentPop / MAX_VITAL_SPACE)

    const baseDecay = ENTROPY_DECAY
    const crowdingPenalty = popRatio > 0.8 ? 0.06 : 0
    const finalDecay = baseDecay + crowdingPenalty

    const result = db.prepare(
      `UPDATE lfx_organisms
       SET fitness_score = MAX(fitness_score - ${finalDecay}, 0.0)
       WHERE status = 'alive'`,
    ).run()

    if (crowdingPenalty > 0) {
      console.log(
        `[Coliseum 🧬] OVERCROWDING: ${currentPop}/${MAX_VITAL_SPACE} POPs ` +
        `→ entropy decay ${baseDecay} + ${crowdingPenalty} = ${finalDecay}`,
      )
    }

    return result.changes
  }

  /**
   * Apoptosis: Organisms whose vitality has decayed below the starvation
   * threshold are dissolved. The medium eliminated them — not a quota.
   * They simply couldn't sustain their structure without nourishment.
   */
  private _apoptosis(db: any): number {
    // Only cull those past their neonatal shield (protect the young)
    const result = db.prepare(
      `UPDATE lfx_organisms
       SET status = 'culled'
       WHERE status = 'alive'
         AND fitness_score < ${APOPTOSIS_THRESHOLD}
         AND trials_count > neonatal_shield_until`,
    ).run()
    return result.changes
  }

  /**
   * Mitosis (Lamarckian Desove): Organisms with surplus vitality reproduce.
   * Conditions: fitness ≥ MITOSIS_THRESHOLD AND trials ≥ MITOSIS_MIN_TRIALS.
   * The parent transfers MITOSIS_ENERGY_TRANSFER of its vitality to the child.
   * No arbitrary cap — only abundance begets abundance.
   */
  private _mitosis(db: any): number {
    const candidates = db.prepare(
      `SELECT organism_id, blueprint_id, fitness_score, generation
       FROM lfx_organisms
       WHERE status = 'alive'
         AND fitness_score >= ${MITOSIS_THRESHOLD}
         AND trials_count >= ${MITOSIS_MIN_TRIALS}
         AND generation < 16`,
    ).all() as {
      organism_id: string
      blueprint_id: string
      fitness_score: number
      generation: number
    }[]

    let spawns = 0

    for (const parent of candidates) {
      const rng = makeRng(stringToSeed(`${parent.organism_id}-${Date.now()}`))
      const operator = pickWeightedOperator(rng)
      const childFitness = parent.fitness_score * MITOSIS_ENERGY_TRANSFER

      try {
        const result = this.spawnOrganism(
          parent.blueprint_id,
          operator,
          Date.now(),
          parent.organism_id,   // parent organism → Lamarckian mitosis
          childFitness,          // inherited vitality
        )

        if (result.success) {
          spawns++
          // Parent transfers energy to child
          db.prepare(
            `UPDATE lfx_organisms
             SET fitness_score = fitness_score * (1 - ${MITOSIS_ENERGY_TRANSFER})
             WHERE organism_id = ?`,
          ).run(parent.organism_id)

          console.log(
            `[Coliseum 🧬] MITOSIS: ${parent.organism_id} → ${result.organismId} ` +
            `(gen ${parent.generation + 1}, F=${childFitness.toFixed(3)})`,
          )
        }
      } catch (err) {
        // Spawn failure (screening abort, etc.) — non-fatal
      }
    }

    return spawns
  }

  /**
   * Sexual Reproduction (Semelparity — The Mantis Rule):
   * Elite organisms (fitness ≥ 0.80, trials ≥ 10) are paired for crossover.
   * After breeding, BOTH parents are culled (sacrificed) to free carrying capacity.
   * This prevents elite stagnation and ensures generational turnover.
   */
  private _sexualReproduction(db: any): number {
    // Query elite candidates
    const candidates = db.prepare(
      `SELECT organism_id, blueprint_id, fitness_score, generation, species_id
       FROM lfx_organisms
       WHERE status IN ('alive', 'champion')
         AND fitness_score >= ${SEXUAL_FITNESS_THRESHOLD}
         AND trials_count >= ${SEXUAL_MIN_TRIALS}
       ORDER BY fitness_score DESC`,
    ).all() as {
      organism_id: string
      blueprint_id: string
      fitness_score: number
      generation: number
      species_id: string | null
    }[]

    if (candidates.length < 2) {
      return 0
    }

    // Pair by species_id when possible, otherwise pair top 2 overall
    const paired = new Set<string>()
    let spawns = 0

    // First pass: pair within same species
    const bySpecies = new Map<string, typeof candidates>()
    for (const c of candidates) {
      const sid = c.species_id ?? '__none__'
      if (!bySpecies.has(sid)) bySpecies.set(sid, [])
      bySpecies.get(sid)!.push(c)
    }

    for (const [, group] of bySpecies) {
      for (let i = 0; i + 1 < group.length; i += 2) {
        const a = group[i]
        const b = group[i + 1]
        if (paired.has(a.organism_id) || paired.has(b.organism_id)) continue
        paired.add(a.organism_id)
        paired.add(b.organism_id)

        const result = this._breedAndSacrifice(db, a.organism_id, b.organism_id)
        if (result) spawns++
      }
    }

    // Second pass: pair remaining unpaired elites across species
    const remaining = candidates.filter((c) => !paired.has(c.organism_id))
    for (let i = 0; i + 1 < remaining.length; i += 2) {
      const a = remaining[i]
      const b = remaining[i + 1]
      const result = this._breedAndSacrifice(db, a.organism_id, b.organism_id)
      if (result) spawns++
    }

    return spawns
  }

  /**
   * Breeds two parents via spawnHybrid and sacrifices both (The Mantis Rule).
   * Returns true if the hybrid was successfully spawned.
   */
  private _breedAndSacrifice(db: any, parentAId: string, parentBId: string): boolean {
    try {
      const result = this.spawnHybrid(parentAId, parentBId)

      if (result.success) {
        // THE MANTIS RULE: sacrifice both parents to free carrying capacity
        db.prepare(
          `UPDATE lfx_organisms SET status = 'culled' WHERE organism_id IN (?, ?)`,
        ).run(parentAId, parentBId)

        console.log(
          `[Coliseum 🧬] SEMELPARITY: ${parentAId} × ${parentBId} → ${result.organismId} ` +
          `— parents sacrificed (${result.rarityTier}, ρ=${result.rarityScore.toFixed(3)})`,
        )
        return true
      } else {
        console.warn(
          `[Coliseum 🧬] Sexual reproduction aborted (prenatal screening): ` +
          `${parentAId} × ${parentBId} — parents survive`,
        )
      }
    } catch (err) {
      console.warn(
        `[Coliseum 🧬] Sexual reproduction failed: ${parentAId} × ${parentBId}`,
        err,
      )
    }
    return false
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
