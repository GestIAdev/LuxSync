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
            const result = {
                organismId,
                clip: childClip,
                materializedAt: Date.now(),
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
                        const fallback = {
                            organismId,
                            clip: blueprint.clipV3,
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
        const db = this._vault._db;
        if (!db) {
            throw new Error('GenesisVault not initialized');
        }
        const row = db.prepare('SELECT organism_id, blueprint_id, parent_organism_id, generation, delta_json, status FROM lfx_organisms WHERE organism_id = ?').get(organismId);
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
