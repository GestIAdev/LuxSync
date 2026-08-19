// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Organism Materializer
// ═══════════════════════════════════════════════════════════════════════════
//  Lazy materialization of organisms from the Genesis Vault.
//  Reconstructs the full HephAutomationClipV3 by applying the chain of
//  delta_json operations from ancestor → parent → child.
//
//  LRU cache (Map-based, capacity 256) avoids re-computation in the hot path.
//
//  FALBACK SAGRADO:
//    If any delta application or parse error occurs, the materializer
//    catches the exception and returns the granite ancestor's clipV3 intact.
//    The operator never sees a lost frame.
// ═══════════════════════════════════════════════════════════════════════════
import { getGenesisVault } from './GenesisVaultService';
import { applyDelta } from './operators/GeneticOperators';
import { getOrganismTag } from './naming/OrganismTag';
// ─── LRU CACHE (Map-based, bounded) ─────────────────────────────────────────
const LRU_MAX_SIZE = 256;
class LruCache {
    constructor(max) {
        this._map = new Map();
        this._max = max;
    }
    get(key) {
        const val = this._map.get(key);
        if (val !== undefined) {
            // Move to end (most recently used)
            this._map.delete(key);
            this._map.set(key, val);
        }
        return val;
    }
    set(key, val) {
        if (this._map.has(key)) {
            this._map.delete(key);
        }
        else if (this._map.size >= this._max) {
            // Evict oldest (first entry)
            const oldest = this._map.keys().next().value;
            if (oldest !== undefined)
                this._map.delete(oldest);
        }
        this._map.set(key, val);
    }
    has(key) {
        return this._map.has(key);
    }
    clear() {
        this._map.clear();
    }
    get size() {
        return this._map.size;
    }
}
// ─── MATERIALIZER ───────────────────────────────────────────────────────────
export class OrganismMaterializer {
    constructor(vault) {
        this._cache = new LruCache(LRU_MAX_SIZE);
        this._vault = vault ?? getGenesisVault();
    }
    /**
     * Materializes an organism into a full HephAutomationClipV3.
     *
     * - Cache hit → O(1) return.
     * - Cache miss → reads organism from DB, recursively materializes parent
     *   (or falls back to granite ancestor), applies delta chain.
     *
     * Fallback defensivo: on ANY error, returns the granite ancestor's clipV3.
     */
    materialize(organismId) {
        // Cache hit
        const hit = this._cache.get(organismId);
        if (hit)
            return hit;
        try {
            const org = this._fetchOrganism(organismId);
            if (!org) {
                throw new Error(`Organism not found: ${organismId}`);
            }
            // Resolve parent clip
            let parentClip;
            if (org.parent_organism_id) {
                // Recursively materialize parent (bounded by generation ≤ 16)
                const parentMat = this.materialize(org.parent_organism_id);
                parentClip = parentMat.clip;
            }
            else {
                // Direct descendant of granite ancestor
                const blueprint = this._vault.getBlueprint(org.blueprint_id);
                if (!blueprint) {
                    throw new Error(`Blueprint not found: ${org.blueprint_id}`);
                }
                parentClip = blueprint.clipV3;
            }
            // Apply delta
            const delta = JSON.parse(org.delta_json);
            const childClip = applyDelta(parentClip, delta);
            // 🧬 WAVE 5000.V3 FIX: Assign unique identity to the materialized clip.
            // Without this, the child's clip.id collides with the blueprint ancestor's
            // id in DynamicEffectRegistry, causing the child to overwrite the parent
            // instead of coexisting as a competing candidate.
            childClip.id = organismId;
            // 🧬 WAVE 5000.V3 FIX: Ensure cognitiveDNA is preserved from the ancestor.
            // applyDelta deep-clones the parent, so cognitiveDNA should survive — but
            // if a delta op removed it, we restore it from the parent to guarantee
            // the clip passes registerEffectV3()'s DNA gate.
            if (!childClip.cognitiveDNA && parentClip.cognitiveDNA) {
                childClip.cognitiveDNA = JSON.parse(JSON.stringify(parentClip.cognitiveDNA));
            }
            // 🧬 WAVE 7546: VIBE INHERITANCE — Ensure compatibleVibes is explicitly
            // preserved from the parent. Genetic operators use { ...dna, genome: X }
            // which SHOULD preserve compatibleVibes, but delta_json only records
            // genome field replacements — not compatibleVibes. If a delta op somehow
            // clobbers the full cognitiveDNA object (e.g. a malformed crossover delta),
            // compatibleVibes would be lost, causing VIB=0.400 in the Dream Simulator.
            // This defensive copy guarantees the child inherits the parent's vibes.
            if (childClip.cognitiveDNA && parentClip.cognitiveDNA) {
                const childVibes = childClip.cognitiveDNA.compatibleVibes;
                const parentVibes = parentClip.cognitiveDNA.compatibleVibes;
                if (!childVibes || childVibes.length === 0) {
                    childClip.cognitiveDNA = {
                        ...childClip.cognitiveDNA,
                        compatibleVibes: [...parentVibes],
                    };
                }
            }
            // 🧬 WAVE 6000.V5: Earned names only. No baptism at birth.
            // If the organism has a custom_name (champion baptized), use it.
            // Otherwise, use a short military tag (COMMON-e8de) — no procedural name.
            if (org.custom_name) {
                childClip.name = org.custom_name;
            }
            else {
                childClip.name = getOrganismTag({
                    organism_id: org.organism_id,
                    custom_name: org.custom_name,
                    rarity_tier: org.rarity_tier,
                });
            }
            const result = {
                organismId,
                clip: childClip,
                materializedAt: Date.now(),
                parentOrganismIdSecondary: org.parent_organism_id_secondary ?? null,
            };
            this._cache.set(organismId, result);
            return result;
        }
        catch (err) {
            // FALLBACK SAGRADO — return granite ancestor
            console.warn(`[OrganismMaterializer ⚠️] Fallback to ancestor for ${organismId}:`, err);
            try {
                const org = this._fetchOrganism(organismId);
                if (org) {
                    const blueprint = this._vault.getBlueprint(org.blueprint_id);
                    if (blueprint) {
                        const fallbackClip = JSON.parse(JSON.stringify(blueprint.clipV3));
                        fallbackClip.id = organismId;
                        if (org.custom_name) {
                            fallbackClip.name = org.custom_name;
                        }
                        const fallback = {
                            organismId,
                            clip: fallbackClip,
                            materializedAt: Date.now(),
                        };
                        this._cache.set(organismId, fallback);
                        return fallback;
                    }
                }
            }
            catch {
                // Double failure — rethrow original
            }
            throw err;
        }
    }
    /**
     * Clears the materialization cache.
     */
    clearCache() {
        this._cache.clear();
    }
    /**
     * Returns current cache size (for telemetry).
     */
    get cacheSize() {
        return this._cache.size;
    }
    // ─── INTERNALS ───────────────────────────────────────────────────────────
    _fetchOrganism(organismId) {
        const db = this._vault.getDb();
        const row = db.prepare(`SELECT organism_id, blueprint_id, parent_organism_id,
              parent_organism_id_secondary, generation,
              delta_json, status, custom_name, rarity_score, rarity_tier,
              l2_distance_parent, operator_used, fitness_score, trials_count,
              passes_count, neonatal_shield_until, species_id
       FROM lfx_organisms WHERE organism_id = ?`).get(organismId);
        return row ?? null;
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getOrganismMaterializer() {
    if (_instance == null)
        _instance = new OrganismMaterializer();
    return _instance;
}
export function __resetOrganismMaterializerForTests() {
    _instance = null;
}
