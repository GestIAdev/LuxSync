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
import { randomUUID } from 'crypto';
import { getGenesisVault } from './GenesisVaultService';
import { applyOperator, crossover, makeRng, stringToSeed, } from './operators/GeneticOperators';
import { prenatalScreening } from './screening/PrenatalScreening';
import { computeRarity, computeRaritySimple } from './loot/RarityEngine';
import { getHeatmapLogger } from './fitness/HeatmapLogger';
import { getSpeciationEngine } from './ecology/SpeciationEngine';
import { getLifecycleManager } from './ecology/LifecycleManager';
import { getOrganismMaterializer } from './OrganismMaterializer';
// ─── OPERATOR ROULETTE (Structural Bias) ───────────────────────────────────
// WAVE 6000.V4: Weighted selection favors structural innovation.
// Without this, focal_mutation dominates and structural operators
// (macro_splice, adaptive_pruning) are never selected.
// 🔬 WAVE 7530: adaptive_pruning raised from 0.05 → 0.10 to improve garbage
// collection of dead tracks. Total still sums to 1.05 → normalized at runtime
// by pickWeightedOperator (which divides by the cumulative sum).
// 🎨 WAVE 7546: color_hue_shift added at 0.08 weight — enables color palette
// evolution across generations. Total now 1.13 → still normalized at runtime.
const OPERATOR_WEIGHTS_ROULETTE = Object.freeze([
    ['focal_mutation', 0.18],
    ['macro_splice', 0.15],
    ['proportional_stretch', 0.15],
    ['gene_augmentation', 0.17],
    ['spatial_resonance', 0.13],
    ['curve_adaptation', 0.12],
    ['adaptive_pruning', 0.10],
    ['color_hue_shift', 0.08],
]);
function pickWeightedOperator(rng) {
    const r = rng();
    let acc = 0;
    for (const [op, weight] of OPERATOR_WEIGHTS_ROULETTE) {
        acc += weight;
        if (r < acc)
            return op;
    }
    return OPERATOR_WEIGHTS_ROULETTE[0][0];
}
// ─── METABOLIC CONSTANTS (Lamarckian Medium) ───────────────────────────────
// No arbitrary population caps. Regulation emerges from thermodynamics:
//   • Entropy: existence costs energy (periodic decay)
//   • Apoptosis: starvation below threshold → dissolution
//   • Mitosis: abundance above threshold → cellular division
//   • Vital Space: carrying capacity regulates spawn rates (Stellaris POP model)
const ENTROPY_DECAY = 0.02; // fitness decay per maintenance cycle (~60s)
const APOPTOSIS_THRESHOLD = 0.10; // below this vitality → culled (starved)
const MITOSIS_THRESHOLD = 0.85; // above this + trials≥5 → may reproduce
const MITOSIS_MIN_TRIALS = 5; // stability proof before reproduction
const MITOSIS_ENERGY_TRANSFER = 0.35; // parent gives 35% of vitality to child
// 🧬 SEMELPARITY: Sexual reproduction thresholds (The Mantis Rule)
const SEXUAL_FITNESS_THRESHOLD = 0.80; // elite fitness required for breeding
const SEXUAL_MIN_TRIALS = 10; // stability proof before breeding
// 🧬 WAVE 6000.V9: VITAL SPACE — Carrying capacity (Stellaris POP model)
// Maximum allowed alive organisms. Spawn probability scales inversely:
//   0 pop = 100% spawn chance, MAX pop = 0% spawn chance.
// Overcrowding (>80% capacity) also accelerates entropy decay (starvation).
const MAX_VITAL_SPACE = 60;
// ─── RARITY (delegated to RarityEngine) ─────────────────────────────────────
/**
 * 🔬 WAVE 7528: FULL NOVELTY ACTIVATION.
 *
 * Computes rarity using the full RarityEngine.computeRarity() which includes
 * the 30% novelty weight via cosine similarity against the living population's
 * bezier signatures. This punishes clones — an organism structurally identical
 * to 40 living organisms receives low novelty (high cosine similarity) and thus
 * a lower rarity score, even if its L2 distance from the parent is large.
 *
 * Falls back to computeRaritySimple() only if the population query fails or
 * returns zero organisms (cold-start scenario).
 *
 * @param db        The GenesisVault DB handle (better-sqlite3)
 * @param l2Distance  L2 distance from parent
 * @param operator    Genetic operator used
 * @param newSignature  The newborn's bezier signature (for novelty comparison)
 */
function estimateRarity(db, l2Distance, operator, newSignature) {
    // Fetch living population signatures for novelty computation
    let populationSignatures = [];
    try {
        const rows = db.prepare(`SELECT bezier_signature FROM lfx_organisms
       WHERE status IN ('alive', 'champion') AND bezier_signature IS NOT NULL
       LIMIT 200`).all();
        populationSignatures = rows.map((row) => {
            const buf = row.bezier_signature;
            return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        });
    }
    catch (err) {
        console.warn('[Coliseum ⚠️] Population signature query failed, using simple rarity:', err);
    }
    // If no population (cold start) or query failed, use simple mode
    if (populationSignatures.length === 0) {
        return computeRaritySimple(l2Distance, operator);
    }
    return computeRarity({
        l2Distance,
        operator,
        bezierSignature: newSignature,
        populationSignatures,
    });
}
// ─── BEZIER SIGNATURE (compressed feature vector) ───────────────────────────
/**
 * Computes a compact Float32Array signature from the clip's keyframes
 * for similarity/speciation. Used as `bezier_signature` BLOB in DB.
 *
 * 🔬 WAVE 7528: NORMALIZED BY SPAN — Each kf.value and bezierHandle is
 * normalized to [0,1] via (value - range[0]) / span, consistent with
 * computeDCurve() in GeneticOperators.ts. Without this, pan ∈ [0,255]
 * dominates the euclidean distance over intensity ∈ [0,1] by ~255×,
 * making K-means cluster by "has pan/color track" instead of structural
 * similarity. Bezier handles are also normalized by the same span to
 * preserve their relative shape contribution.
 */
function computeBezierSignature(clip) {
    const values = [];
    for (const track of clip.tracks) {
        const range = track.curve.range;
        const span = range[1] - range[0];
        const safeSpan = span !== 0 ? span : 1;
        const offset = range[0];
        for (const kf of track.curve.keyframes) {
            if (typeof kf.value === 'number') {
                values.push((kf.value - offset) / safeSpan);
            }
            if (kf.bezierHandles) {
                // Normalize each handle by the same span — handles are offsets
                // in value-space, so dividing by span preserves their relative
                // magnitude in the normalized [0,1] domain.
                for (const h of kf.bezierHandles) {
                    values.push((h - offset) / safeSpan);
                }
            }
        }
    }
    // Pad/truncate to 128 floats for fixed-size BLOB
    const sig = new Float32Array(128);
    for (let i = 0; i < Math.min(values.length, 128); i++) {
        sig[i] = values[i];
    }
    return sig;
}
// ─── ORGANISM ID GENERATION ─────────────────────────────────────────────────
/**
 * Generates organism ID: <console_hash8>:<uuid>
 * For now uses a placeholder hash — in production this comes from the
 * console's identity service.
 */
function generateOrganismId() {
    const hash8 = '00000000'; // Placeholder — real console hash injected later
    return `${hash8}:${randomUUID()}`;
}
// ─── COLISEUM SERVICE ───────────────────────────────────────────────────────
export class ColiseumService {
    constructor(vault) {
        this._vault = vault ?? getGenesisVault();
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
     * @param birthVector Optional real context vector at birth (🔬 WAVE 7534). If omitted, zeros.
     * @returns SpawnResult with viability + organism details
     */
    spawnOrganism(parentBlueprintId, operatorType, seed, parentOrganismId, birthFitness, birthVector) {
        // 1. Fetch ancestor
        const blueprint = this._vault.getBlueprint(parentBlueprintId);
        if (!blueprint) {
            throw new Error(`[Coliseum] Blueprint not found: ${parentBlueprintId}`);
        }
        const db = this._vault.getDb();
        // 1b. If mitosis: materialize the parent organism's clip instead of granite ancestor
        let parentClip;
        let parentGeneration = 1;
        if (parentOrganismId) {
            const materialized = getOrganismMaterializer().materialize(parentOrganismId);
            parentClip = materialized.clip;
            const parentRow = db.prepare('SELECT generation FROM lfx_organisms WHERE organism_id = ?').get(parentOrganismId);
            parentGeneration = (parentRow?.generation ?? 1) + 1;
        }
        else {
            parentClip = blueprint.clipV3;
            parentGeneration = 1;
        }
        // 2. Apply genetic operator
        const opResult = applyOperator(parentClip, operatorType, seed);
        const mutatedClip = opResult.clip;
        const delta = opResult.delta;
        // 3. Prenatal screening (G7 redundancy gate uses L2 distance)
        const screening = prenatalScreening(mutatedClip, opResult.l2Distance);
        // 3b. Compute bezier signature early — needed for rarity novelty computation
        const bezierSig = computeBezierSignature(mutatedClip);
        // Base result — compute rarity via RarityEngine (full mode with population novelty)
        const rarity = estimateRarity(db, opResult.l2Distance, operatorType, bezierSig);
        const baseResult = {
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
        };
        // 4. Non-viable → abort (zero DB writes)
        if (!screening.viable) {
            console.warn(`[Coliseum 🧬] Prenatal abort for ${parentBlueprintId} via ${operatorType}: ` +
                `${screening.abortReason}`);
            return baseResult;
        }
        // 5. Viable → insert to lfx_organisms
        const organismId = generateOrganismId();
        // bezierSig already computed above (before rarity estimation)
        const now = Date.now();
        // 🔬 WAVE 7534: Capture the real birth context vector if provided by
        // the caller (EffectManager fire event). Falls back to zeros only when
        // the spawn is not triggered by a live fire (e.g. cold-start seeding).
        const birthVectorFinal = birthVector ?? {
            zScoreAvg3s: 0,
            lowBandAvg3s: 0,
            energyPhaseEncoded: 0,
            vibeHash: 0,
            sectionEncoded: 0,
            textureEncoded: 0,
        };
        const insertOrg = db.prepare(`INSERT INTO lfx_organisms (
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
      )`);
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
                birth_vector_json: JSON.stringify(birthVectorFinal),
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
            });
        });
        tx();
        console.log(`[Coliseum 🧬] Spawned ${organismId} from ${parentBlueprintId} ` +
            `via ${operatorType} — ${rarity.tier} (ρ=${rarity.score.toFixed(3)}, ` +
            `L2=${opResult.l2Distance.toFixed(4)})`);
        return {
            ...baseResult,
            success: true,
            organismId,
            generation: parentGeneration,
        };
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
     * @param birthVector        Optional real context vector at birth (🔬 WAVE 7534)
     * @returns SpawnHybridResult with viability + organism details
     */
    spawnHybrid(parentOrganismIdA, parentOrganismIdB, seed, birthVector) {
        if (parentOrganismIdA === parentOrganismIdB) {
            throw new Error('[Coliseum] Sexual reproduction requires two distinct parents');
        }
        const db = this._vault.getDb();
        // 1. Materialize both parents
        const matA = getOrganismMaterializer().materialize(parentOrganismIdA);
        const matB = getOrganismMaterializer().materialize(parentOrganismIdB);
        const clipA = matA.clip;
        const clipB = matB.clip;
        // 1b. Fetch fitness scores for dominance determination
        const rowA = db.prepare('SELECT fitness_score, generation, blueprint_id FROM lfx_organisms WHERE organism_id = ?').get(parentOrganismIdA);
        const rowB = db.prepare('SELECT fitness_score, generation, blueprint_id FROM lfx_organisms WHERE organism_id = ?').get(parentOrganismIdB);
        if (!rowA || !rowB) {
            throw new Error('[Coliseum] One or both parent organisms not found');
        }
        const fitnessA = rowA.fitness_score;
        const fitnessB = rowB.fitness_score;
        const maxGen = Math.max(rowA.generation, rowB.generation);
        const childGeneration = maxGen + 1;
        // 2. Apply crossover operator
        const xResult = crossover(clipA, clipB, fitnessA, fitnessB, seed);
        const hybridClip = xResult.clip;
        const delta = xResult.delta;
        // 3. Prenatal screening (G7 redundancy gate uses L2 distance)
        const screening = prenatalScreening(hybridClip, xResult.l2Distance);
        // 3b. Compute bezier signature early — needed for rarity novelty computation
        const bezierSig = computeBezierSignature(hybridClip);
        // 4. Rarity estimation (full mode with population novelty)
        const rarity = estimateRarity(db, xResult.l2Distance, 'crossover', bezierSig);
        const dominantId = xResult.dominantParent === 'A' ? parentOrganismIdA : parentOrganismIdB;
        const secondaryId = xResult.dominantParent === 'A' ? parentOrganismIdB : parentOrganismIdA;
        const blueprintId = xResult.dominantParent === 'A' ? rowA.blueprint_id : rowB.blueprint_id;
        const baseResult = {
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
        };
        // 5. Non-viable → abort
        if (!screening.viable) {
            console.warn(`[Coliseum 🧬] Hybrid prenatal abort: ${screening.abortReason}`);
            return baseResult;
        }
        // 6. Viable → insert with dual lineage
        const organismId = generateOrganismId();
        // bezierSig already computed above (before rarity estimation)
        const now = Date.now();
        // 🔬 WAVE 7534: Capture real birth context if provided.
        const birthVectorFinal = birthVector ?? {
            zScoreAvg3s: 0,
            lowBandAvg3s: 0,
            energyPhaseEncoded: 0,
            vibeHash: 0,
            sectionEncoded: 0,
            textureEncoded: 0,
        };
        const insertOrg = db.prepare(`INSERT INTO lfx_organisms (
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
      )`);
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
                birth_vector_json: JSON.stringify(birthVectorFinal),
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
            });
        });
        tx();
        console.log(`[Coliseum 🧬] Hybrid ${organismId} from ${parentOrganismIdA} × ${parentOrganismIdB} ` +
            `— ${rarity.tier} (ρ=${rarity.score.toFixed(3)}, L2=${xResult.l2Distance.toFixed(4)})`);
        return {
            ...baseResult,
            success: true,
            organismId,
        };
    }
    /**
     * Spawns the initial G1 cohort for a blueprint (cold start).
     * WAVE 6000.V9: Dynamic spawn probability based on Vital Space (carrying capacity).
     * Spawn chance = 1.0 - (currentPop / MAX_VITAL_SPACE).
     * Empty ecosystem → 100% spawn. Full ecosystem → 0% spawn.
     */
    spawnInitialCohort(parentBlueprintId, birthVector) {
        // WAVE 6000.V5: Deterministic PRNG — no Math.random()
        const rng = makeRng(stringToSeed(`${parentBlueprintId}-${Date.now()}`));
        // 🧬 WAVE 6000.V9: Dynamic spawn gate based on carrying capacity
        const db = this._vault.getDb();
        const popRow = db.prepare('SELECT count(*) as pop FROM lfx_organisms WHERE status = \'alive\'').get();
        const currentPop = popRow.pop;
        const popRatio = Math.min(1.0, currentPop / MAX_VITAL_SPACE);
        const spawnChance = 1.0 - popRatio;
        if (rng() > spawnChance) {
            console.log(`[Coliseum 🧬] Initial cohort for ${parentBlueprintId}: skipped ` +
                `(vital space: ${currentPop}/${MAX_VITAL_SPACE}, spawn chance: ${(spawnChance * 100).toFixed(0)}%)`);
            return [];
        }
        const operator = pickWeightedOperator(rng);
        const r1 = this.spawnOrganism(parentBlueprintId, operator, Date.now(), undefined, undefined, birthVector);
        const viable = r1.success ? 1 : 0;
        console.log(`[Coliseum 🧬] Initial cohort for ${parentBlueprintId}: ` +
            `${viable}/1 viable via ${operator}`);
        return [r1];
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
    async runEcologicalMaintenance() {
        // 1. Flush heatmap logger — OUTSIDE the transaction (async, additive)
        const logger = getHeatmapLogger();
        await logger.flush();
        // 🔬 WAVE 7533: Steps 2-7 wrapped in a single atomic transaction.
        // If any step throws, the entire metabolic cycle rolls back — the
        // ecosystem is never observed in a zombified intermediate state.
        // Step 1 (heatmap flush) is excluded: it is async and additive, so
        // a rollback of steps 2-7 must not undo already-persisted heatmap rows.
        return this._vault.executeTransaction(() => {
            const db = this._vault.getDb();
            // 2. Entropy Decay — existence consumes energy
            const entropyDecayed = this._applyEntropyDecay(db);
            // 3. Apoptosis — starvation dissolution
            const apoptosisCulls = this._apoptosis(db);
            // 4. Run speciation
            const speciation = getSpeciationEngine().runSpeciation();
            // 5. Run lifecycle transitions
            const lifecycle = getLifecycleManager().runTransitions();
            // 6. Mitosis — cellular division for thriving organisms
            const mitosisSpawns = this._mitosis(db);
            // 7. Sexual reproduction — elite breeding with semelparity (parents die)
            const sexualSpawns = this._sexualReproduction(db);
            console.log(`[Coliseum 🧬] Ecological maintenance complete: ` +
                `entropy:${entropyDecayed} ↓, apoptosis:${apoptosisCulls} ✖, ` +
                `${speciation.speciesCount} species, ` +
                `${lifecycle.promotions}↑ ${lifecycle.demotions}↓ ${lifecycle.culls}✂️, ` +
                `${lifecycle.hallOfFameCandidates} HoF, mitosis:${mitosisSpawns} ⊕, sexual:${sexualSpawns} ♀`);
            return {
                heatmapFlush: true,
                entropyDecayed,
                apoptosisCulls,
                speciation,
                lifecycle,
                mitosisSpawns,
                sexualSpawns,
            };
        });
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
    _applyEntropyDecay(db) {
        // Query current population for crowding calculation
        const popRow = db.prepare('SELECT count(*) as pop FROM lfx_organisms WHERE status = \'alive\'').get();
        const currentPop = popRow.pop;
        const popRatio = Math.min(1.0, currentPop / MAX_VITAL_SPACE);
        const baseDecay = ENTROPY_DECAY;
        const crowdingPenalty = popRatio > 0.8 ? 0.06 : 0;
        const finalDecay = baseDecay + crowdingPenalty;
        const result = db.prepare(`UPDATE lfx_organisms
       SET fitness_score = MAX(fitness_score - ${finalDecay}, 0.0)
       WHERE status = 'alive'`).run();
        if (crowdingPenalty > 0) {
            console.log(`[Coliseum 🧬] OVERCROWDING: ${currentPop}/${MAX_VITAL_SPACE} POPs ` +
                `→ entropy decay ${baseDecay} + ${crowdingPenalty} = ${finalDecay}`);
        }
        return result.changes;
    }
    /**
     * Apoptosis: Organisms whose vitality has decayed below the starvation
     * threshold are dissolved. The medium eliminated them — not a quota.
     * They simply couldn't sustain their structure without nourishment.
     */
    _apoptosis(db) {
        // Only cull those past their neonatal shield (protect the young)
        const result = db.prepare(`UPDATE lfx_organisms
       SET status = 'culled'
       WHERE status = 'alive'
         AND fitness_score < ${APOPTOSIS_THRESHOLD}
         AND trials_count > neonatal_shield_until`).run();
        return result.changes;
    }
    /**
     * Mitosis (Lamarckian Desove): Organisms with surplus vitality reproduce.
     * Conditions: fitness ≥ MITOSIS_THRESHOLD AND trials ≥ MITOSIS_MIN_TRIALS.
     * The parent transfers MITOSIS_ENERGY_TRANSFER of its vitality to the child.
     * No arbitrary cap — only abundance begets abundance.
     */
    _mitosis(db) {
        const candidates = db.prepare(`SELECT organism_id, blueprint_id, fitness_score, generation
       FROM lfx_organisms
       WHERE status = 'alive'
         AND fitness_score >= ${MITOSIS_THRESHOLD}
         AND trials_count >= ${MITOSIS_MIN_TRIALS}
         AND generation < 16`).all();
        let spawns = 0;
        for (const parent of candidates) {
            const rng = makeRng(stringToSeed(`${parent.organism_id}-${Date.now()}`));
            const operator = pickWeightedOperator(rng);
            const childFitness = parent.fitness_score * MITOSIS_ENERGY_TRANSFER;
            try {
                const result = this.spawnOrganism(parent.blueprint_id, operator, Date.now(), parent.organism_id, // parent organism → Lamarckian mitosis
                childFitness);
                if (result.success) {
                    spawns++;
                    // Parent transfers energy to child
                    db.prepare(`UPDATE lfx_organisms
             SET fitness_score = fitness_score * (1 - ${MITOSIS_ENERGY_TRANSFER})
             WHERE organism_id = ?`).run(parent.organism_id);
                    console.log(`[Coliseum 🧬] MITOSIS: ${parent.organism_id} → ${result.organismId} ` +
                        `(gen ${parent.generation + 1}, F=${childFitness.toFixed(3)})`);
                }
            }
            catch (err) {
                // Spawn failure (screening abort, etc.) — non-fatal
            }
        }
        return spawns;
    }
    /**
     * Sexual Reproduction (Semelparity — The Mantis Rule):
     * Elite organisms (fitness ≥ 0.80, trials ≥ 10) are paired for crossover.
     * After breeding, BOTH parents are culled (sacrificed) to free carrying capacity.
     * This prevents elite stagnation and ensures generational turnover.
     */
    _sexualReproduction(db) {
        // Query elite candidates
        const candidates = db.prepare(`SELECT organism_id, blueprint_id, fitness_score, generation, species_id
       FROM lfx_organisms
       WHERE status IN ('alive', 'champion')
         AND fitness_score >= ${SEXUAL_FITNESS_THRESHOLD}
         AND trials_count >= ${SEXUAL_MIN_TRIALS}
       ORDER BY fitness_score DESC`).all();
        if (candidates.length < 2) {
            return 0;
        }
        // Pair by species_id when possible, otherwise pair top 2 overall
        const paired = new Set();
        let spawns = 0;
        // First pass: pair within same species
        const bySpecies = new Map();
        for (const c of candidates) {
            const sid = c.species_id ?? '__none__';
            if (!bySpecies.has(sid))
                bySpecies.set(sid, []);
            bySpecies.get(sid).push(c);
        }
        for (const [, group] of bySpecies) {
            for (let i = 0; i + 1 < group.length; i += 2) {
                const a = group[i];
                const b = group[i + 1];
                if (paired.has(a.organism_id) || paired.has(b.organism_id))
                    continue;
                paired.add(a.organism_id);
                paired.add(b.organism_id);
                const result = this._breedAndSacrifice(db, a.organism_id, b.organism_id);
                if (result)
                    spawns++;
            }
        }
        // Second pass: pair remaining unpaired elites across species
        const remaining = candidates.filter((c) => !paired.has(c.organism_id));
        for (let i = 0; i + 1 < remaining.length; i += 2) {
            const a = remaining[i];
            const b = remaining[i + 1];
            const result = this._breedAndSacrifice(db, a.organism_id, b.organism_id);
            if (result)
                spawns++;
        }
        return spawns;
    }
    /**
     * Breeds two parents via spawnHybrid and sacrifices both (The Mantis Rule).
     * Returns true if the hybrid was successfully spawned.
     */
    _breedAndSacrifice(db, parentAId, parentBId) {
        try {
            const result = this.spawnHybrid(parentAId, parentBId);
            if (result.success) {
                // THE MANTIS RULE: sacrifice both parents to free carrying capacity
                db.prepare(`UPDATE lfx_organisms SET status = 'culled' WHERE organism_id IN (?, ?)`).run(parentAId, parentBId);
                console.log(`[Coliseum 🧬] SEMELPARITY: ${parentAId} × ${parentBId} → ${result.organismId} ` +
                    `— parents sacrificed (${result.rarityTier}, ρ=${result.rarityScore.toFixed(3)})`);
                return true;
            }
            else {
                console.warn(`[Coliseum 🧬] Sexual reproduction aborted (prenatal screening): ` +
                    `${parentAId} × ${parentBId} — parents survive`);
            }
        }
        catch (err) {
            console.warn(`[Coliseum 🧬] Sexual reproduction failed: ${parentAId} × ${parentBId}`, err);
        }
        return false;
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getColiseumService() {
    if (_instance == null)
        _instance = new ColiseumService();
    return _instance;
}
export function __resetColiseumServiceForTests() {
    _instance = null;
}
