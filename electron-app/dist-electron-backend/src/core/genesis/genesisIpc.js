// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA V: Genesis IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════
//  Secure IPC bridge between the renderer (Genesis Lab UI) and the
//  main process (ColiseumService, GenesisVaultService, LifecycleManager).
//
//  Channels:
//    genesis:getOrganisms       — List organisms with optional filter
//    genesis:getHallOfFame      — Legendary candidates from v_hall_of_fame
//    genesis:getLineageTree     — Genealogical path from lineage_tree
//    genesis:cullOrganism       — Manual cull (alive → culled)
//    genesis:canonizeOrganism   — Canonize organism as immutable blueprint
//    genesis:runMaintenance     — Trigger runEcologicalMaintenance()
// ═══════════════════════════════════════════════════════════════════════════
import { ipcMain } from 'electron';
import { getGenesisVault } from './GenesisVaultService';
import { getColiseumService } from './ColiseumService';
import { generateOrganismName } from './naming/ProceduralNamer';
// ─── SETUP ──────────────────────────────────────────────────────────────────
export function setupGenesisIPCHandlers() {
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:getOrganisms — List organisms with optional filter
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:getOrganisms', async (_event, filter) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized', organisms: [] };
            }
            let query = 'SELECT * FROM lfx_organisms';
            const conditions = [];
            const params = {};
            if (filter?.rarityTier) {
                conditions.push('rarity_tier = @rarityTier');
                params.rarityTier = filter.rarityTier;
            }
            if (filter?.status) {
                conditions.push('status = @status');
                params.status = filter.status;
            }
            if (filter?.speciesId) {
                conditions.push('species_id = @speciesId');
                params.speciesId = filter.speciesId;
            }
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            query += ' ORDER BY fitness_score DESC';
            if (filter?.limit) {
                query += ' LIMIT @limit';
                params.limit = filter.limit;
            }
            const rows = db.prepare(query).all(params);
            return { success: true, organisms: rows };
        }
        catch (error) {
            console.error('[GenesisIPC] getOrganisms failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                organisms: [],
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:getHallOfFame — Legendary candidates from v_hall_of_fame
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:getHallOfFame', async () => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized', candidates: [] };
            }
            const rows = db.prepare(`SELECT * FROM v_hall_of_fame`).all();
            return { success: true, candidates: rows };
        }
        catch (error) {
            console.error('[GenesisIPC] getHallOfFame failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                candidates: [],
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:getLineageTree — Genealogical path from lineage_tree
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:getLineageTree', async (_event, organismId) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized', lineage: [] };
            }
            // Get the node for this organism
            const node = db.prepare('SELECT * FROM lineage_tree WHERE organism_id = ?').get(organismId);
            if (!node) {
                return { success: true, lineage: [] };
            }
            // Get all ancestors by parsing the materialized path
            const ancestorIds = node.ancestor_path.split('/').filter(Boolean);
            const placeholders = ancestorIds.map(() => '?').join(',');
            const ancestors = db.prepare(`SELECT lt.*, o.rarity_tier, o.fitness_score, o.status, o.custom_name,
                o.generation, o.trials_count, o.passes_count
         FROM lineage_tree lt
         LEFT JOIN lfx_organisms o ON o.organism_id = lt.organism_id
         WHERE lt.organism_id IN (${placeholders})
         ORDER BY lt.depth ASC`).all(...ancestorIds);
            return { success: true, lineage: ancestors };
        }
        catch (error) {
            console.error('[GenesisIPC] getLineageTree failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                lineage: [],
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:cullOrganism — Manual cull (alive → culled)
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:cullOrganism', async (_event, organismId) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized' };
            }
            const result = db.prepare(`UPDATE lfx_organisms
         SET status = 'culled'
         WHERE organism_id = ? AND status IN ('alive', 'champion')`).run(organismId);
            if (result.changes === 0) {
                return { success: false, error: 'Organism not found or not cullable' };
            }
            console.log(`[GenesisIPC] 🗑️ Culled organism: ${organismId}`);
            return { success: true };
        }
        catch (error) {
            console.error('[GenesisIPC] cullOrganism failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:canonizeOrganism — Canonize as immutable blueprint + name
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:canonizeOrganism', async (_event, organismId, customName) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized' };
            }
            // 1. Fetch the organism
            const org = db.prepare(`SELECT * FROM lfx_organisms WHERE organism_id = ?`).get(organismId);
            if (!org) {
                return { success: false, error: 'Organism not found' };
            }
            // 2. Fetch the parent blueprint to clone its metadata
            const bp = db.prepare('SELECT * FROM lfx_blueprints WHERE blueprint_id = ?').get(org.blueprint_id);
            if (!bp) {
                return { success: false, error: 'Parent blueprint not found' };
            }
            // 3. Create the new blueprint ID from the organism ID
            const newBlueprintId = `canonized:${organismId}`;
            // 3a. Determine the name — use custom name or auto-generate procedurally
            const trimmedName = customName.trim();
            let finalName;
            if (trimmedName.length > 0) {
                finalName = trimmedName;
            }
            else {
                // Auto-generate a punchy procedural name from organism metrics
                finalName = generateOrganismName({
                    organismId: org.organism_id,
                    blueprintId: org.blueprint_id,
                    parentOrganismId: null,
                    generation: org.generation,
                    customName: null,
                    deltaJson: org.delta_json,
                    bezierSignature: new Float32Array(0),
                    rarityScore: org.rarity_score,
                    rarityTier: org.rarity_tier,
                    l2DistanceParent: org.l2_distance_parent,
                    operatorUsed: org.operator_used,
                    neonatalShieldUntil: 0,
                    birthVector: {
                        zScoreAvg3s: 0, lowBandAvg3s: 0, energyPhaseEncoded: 0,
                        vibeHash: 0, sectionEncoded: 0, textureEncoded: 0,
                    },
                    fitnessScore: org.fitness_score,
                    trialsCount: 0, winsCount: 0, vetoesCount: 0, passesCount: 0,
                    status: 'canonized',
                    speciesId: null,
                    bornAt: 0, lastEvaluatedAt: null, lastFiredAt: null,
                    swarmOriginConsole: null,
                }, {
                    dnaAggression: bp.dna_aggression,
                    dnaChaos: bp.dna_chaos,
                    dnaOrganicity: bp.dna_organicity,
                    textureAffinity: bp.texture_affinity,
                });
                console.log(`[GenesisIPC] 🎲 Auto-generated name: "${finalName}" for ${organismId}`);
            }
            // 4. Insert as a new immutable blueprint with source_origin = 'canonized'
            db.prepare(`INSERT OR IGNORE INTO lfx_blueprints (
            blueprint_id, name, author, category, source_origin,
            dna_aggression, dna_chaos, dna_organicity, texture_affinity,
            compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
            aggression_range_min, aggression_range_max, spatial_behavior,
            clip_v3_json, execution_domain,
            is_strobe, is_divine_candidate, is_heavy_candidate,
            checksum_sha256, schema_version, imported_at
          ) VALUES (
            @blueprint_id, @name, @author, @category, 'canonized',
            @dna_aggression, @dna_chaos, @dna_organicity, @texture_affinity,
            @compatible_vibes, @valid_sections, @energy_zone_min, @energy_zone_max,
            @aggression_range_min, @aggression_range_max, @spatial_behavior,
            @clip_v3_json, @execution_domain,
            @is_strobe, @is_divine_candidate, @is_heavy_candidate,
            @checksum_sha256, @schema_version, @imported_at
          )`).run({
                blueprint_id: newBlueprintId,
                name: finalName,
                author: bp.author,
                category: bp.category,
                dna_aggression: bp.dna_aggression,
                dna_chaos: bp.dna_chaos,
                dna_organicity: bp.dna_organicity,
                texture_affinity: bp.texture_affinity,
                compatible_vibes: bp.compatible_vibes,
                valid_sections: bp.valid_sections,
                energy_zone_min: bp.energy_zone_min,
                energy_zone_max: bp.energy_zone_max,
                aggression_range_min: bp.aggression_range_min,
                aggression_range_max: bp.aggression_range_max,
                spatial_behavior: bp.spatial_behavior,
                clip_v3_json: bp.clip_v3_json, // The clip is the same; the delta is preserved in the organism
                execution_domain: bp.execution_domain,
                is_strobe: bp.is_strobe,
                is_divine_candidate: bp.is_divine_candidate,
                is_heavy_candidate: bp.is_heavy_candidate,
                checksum_sha256: bp.checksum_sha256,
                schema_version: bp.schema_version,
                imported_at: Date.now(),
            });
            // 5. Update organism status to 'canonized' + set custom_name
            db.prepare(`UPDATE lfx_organisms
           SET status = 'canonized', custom_name = @name
           WHERE organism_id = @id`).run({ name: finalName, id: organismId });
            console.log(`[GenesisIPC] 👑 Canonized organism ${organismId} as "${finalName}" ` +
                `(blueprint: ${newBlueprintId})`);
            return {
                success: true,
                blueprintId: newBlueprintId,
                customName: finalName,
            };
        }
        catch (error) {
            console.error('[GenesisIPC] canonizeOrganism failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:runMaintenance — Trigger runEcologicalMaintenance()
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:runMaintenance', async () => {
        try {
            const coliseum = getColiseumService();
            const result = await coliseum.runEcologicalMaintenance();
            return { success: true, result };
        }
        catch (error) {
            console.error('[GenesisIPC] runMaintenance failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:getSpecies — List all species with counts
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:getSpecies', async () => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized', species: [] };
            }
            const rows = db.prepare(`SELECT species_id, COUNT(*) as count,
                AVG(fitness_score) as avg_fitness,
                MAX(fitness_score) as max_fitness
         FROM lfx_organisms
         WHERE species_id IS NOT NULL AND status IN ('alive', 'champion')
         GROUP BY species_id
         ORDER BY count DESC`).all();
            return { success: true, species: rows };
        }
        catch (error) {
            console.error('[GenesisIPC] getSpecies failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                species: [],
            };
        }
    });
    console.log('[GenesisIPC 🧬] All genesis channels registered');
}
export default setupGenesisIPCHandlers;
