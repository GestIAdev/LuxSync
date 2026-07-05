// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA IV: Species Quota Selector
// ═══════════════════════════════════════════════════════════════════════════
//  High-speed candidate selection that enforces species diversity.
//
//  Instead of taking the top-N absolute fitness organisms (mode collapse risk),
//  selects the best from EACH species_id equitably.
//
//  ε-greedy exploration: 5% probability to include neonatal-shielded organisms
//  (young, protected) to give them a chance to prove themselves.
//
//  Designed for the DreamSimulator's selection pool. Runs in microseconds.
// ═══════════════════════════════════════════════════════════════════════════
import { getGenesisVault } from '../GenesisVaultService';
// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const EPSILON_EXPLORATION = 0.05; // 5% chance to include neonatal organisms
// ─── SPECIES QUOTA SELECTOR ─────────────────────────────────────────────────
export class SpeciesQuotaSelector {
    constructor(vault) {
        this._vault = vault ?? getGenesisVault();
    }
    /**
     * Selects candidates for the DreamSimulator pool.
     *
     * @param poolSize Total number of candidates to return (default: 12)
     * @param rng Optional random number generator (0..1) for ε-greedy. Defaults to Math.random.
     * @returns SelectionResult with diverse candidates across species
     */
    selectCandidates(poolSize = 12, rng = Math.random) {
        const db = this._vault._db;
        if (!db) {
            throw new Error('[QuotaSelector] GenesisVault not initialized');
        }
        // 1. Fetch all alive + champion organisms
        const rows = db.prepare(`SELECT organism_id, blueprint_id, species_id, fitness_score,
              rarity_tier, trials_count, neonatal_shield_until
       FROM lfx_organisms
       WHERE status IN ('alive', 'champion')
       ORDER BY fitness_score DESC`).all();
        if (rows.length === 0) {
            return { candidates: [], totalPool: 0, speciesRepresented: 0, explorers: 0 };
        }
        // 2. Build candidate list with neonatal flag
        const allCandidates = rows.map((r) => ({
            organismId: r.organism_id,
            blueprintId: r.blueprint_id,
            speciesId: r.species_id,
            fitnessScore: r.fitness_score,
            rarityTier: r.rarity_tier,
            trialsCount: r.trials_count,
            neonatalShieldUntil: r.neonatal_shield_until,
            isNeonatal: r.trials_count <= r.neonatal_shield_until,
        }));
        // 3. Group by species
        const bySpecies = new Map();
        for (const c of allCandidates) {
            const sid = c.speciesId ?? '__unassigned';
            const arr = bySpecies.get(sid) ?? [];
            arr.push(c);
            bySpecies.set(sid, arr);
        }
        // 4. Quota allocation: round-robin pick from each species
        const speciesIds = [...bySpecies.keys()].sort();
        const selected = [];
        const selectedIds = new Set();
        let explorers = 0;
        // First pass: pick the best from each species (1 per species)
        for (const sid of speciesIds) {
            if (selected.length >= poolSize)
                break;
            const members = bySpecies.get(sid);
            // ε-greedy: 5% chance to pick a neonatal organism from this species
            if (rng() < EPSILON_EXPLORATION) {
                const neonatals = members.filter((m) => m.isNeonatal);
                if (neonatals.length > 0) {
                    const pick = neonatals[Math.floor(rng() * neonatals.length)];
                    selected.push(pick);
                    selectedIds.add(pick.organismId);
                    explorers++;
                    continue;
                }
            }
            const pick = members[0]; // best fitness (already sorted DESC)
            selected.push(pick);
            selectedIds.add(pick.organismId);
        }
        // Second pass: continue round-robin to fill the pool
        let speciesIdx = 0;
        const consumed = new Map(); // track index per species
        for (const sid of speciesIds)
            consumed.set(sid, 1); // already picked index 0
        while (selected.length < poolSize) {
            const sid = speciesIds[speciesIdx % speciesIds.length];
            const members = bySpecies.get(sid);
            const idx = consumed.get(sid) ?? 0;
            if (idx >= members.length) {
                // This species is exhausted, skip
                speciesIdx++;
                // Safety: if all species exhausted, break
                if (speciesIdx > speciesIds.length * 3)
                    break;
                continue;
            }
            const pick = members[idx];
            if (!selectedIds.has(pick.organismId)) {
                // ε-greedy check for neonatal inclusion
                if (pick.isNeonatal && rng() < EPSILON_EXPLORATION) {
                    explorers++;
                }
                selected.push(pick);
                selectedIds.add(pick.organismId);
            }
            consumed.set(sid, idx + 1);
            speciesIdx++;
        }
        const speciesRepresented = new Set(selected.map((c) => c.speciesId)).size;
        return {
            candidates: selected,
            totalPool: allCandidates.length,
            speciesRepresented,
            explorers,
        };
    }
    /**
     * Fast variant: returns just the organism IDs for the DreamSimulator.
     */
    selectCandidateIds(poolSize, rng) {
        return this.selectCandidates(poolSize, rng).candidates.map((c) => c.organismId);
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getSpeciesQuotaSelector() {
    if (_instance == null)
        _instance = new SpeciesQuotaSelector();
    return _instance;
}
export function __resetSpeciesQuotaSelectorForTests() {
    _instance = null;
}
