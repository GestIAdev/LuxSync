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
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { getGenesisVault } from './GenesisVaultService';
import { getColiseumService } from './ColiseumService';
import { getOrganismMaterializer } from './OrganismMaterializer';
import { getDynamicEffectRegistry } from '../arsenal/DynamicEffectRegistry';
import { LfxFileLoader } from '../arsenal/LfxFileLoader';
import { getHephaestusClipIndex } from '../hephaestus/HephaestusClipIndex';
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
    // genesis:suggestName — Procedural baptism suggestion for an organism
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:suggestName', async (_event, organismId) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized' };
            }
            const org = db.prepare(`SELECT * FROM lfx_organisms WHERE organism_id = ?`).get(organismId);
            if (!org) {
                return { success: false, error: 'Organism not found' };
            }
            const bp = db.prepare('SELECT dna_aggression, dna_chaos, dna_organicity, texture_affinity FROM lfx_blueprints WHERE blueprint_id = ?').get(org.blueprint_id);
            const name = generateOrganismName({
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
                status: 'alive',
                speciesId: null,
                bornAt: 0, lastEvaluatedAt: null, lastFiredAt: null,
                swarmOriginConsole: null,
            }, bp ? {
                dnaAggression: bp.dna_aggression,
                dnaChaos: bp.dna_chaos,
                dnaOrganicity: bp.dna_organicity,
                textureAffinity: bp.texture_affinity,
            } : undefined);
            return { success: true, name };
        }
        catch (error) {
            console.error('[GenesisIPC] suggestName failed:', error);
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
            // 4. Materialize the organism's mutated clip (apply delta chain to parent)
            const materializer = getOrganismMaterializer();
            const mat = materializer.materialize(organismId);
            const canonizedClipJson = JSON.stringify(mat.clip);
            // 5. Insert as a new immutable blueprint with source_origin = 'canonized'
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
                clip_v3_json: canonizedClipJson,
                execution_domain: bp.execution_domain,
                is_strobe: bp.is_strobe,
                is_divine_candidate: bp.is_divine_candidate,
                is_heavy_candidate: bp.is_heavy_candidate,
                checksum_sha256: bp.checksum_sha256,
                schema_version: bp.schema_version,
                imported_at: Date.now(),
            });
            // 6. Update organism status to 'canonized' + set custom_name
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
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:materializeClip — Materialize organism → HephAutomationClipV3
    // Returns the full clip for loading into the Forge editor canvas.
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:materializeClip', async (_event, organismId) => {
        try {
            const materializer = getOrganismMaterializer();
            const mat = materializer.materialize(organismId);
            const clip = mat.clip;
            // Serialize for IPC — Electron structured clone handles plain objects
            const clipPOJO = JSON.parse(JSON.stringify(clip));
            console.log(`[GenesisIPC] 🎬 Materialized ${organismId} → "${clipPOJO.name}" (${clipPOJO.tracks.length} tracks)`);
            return { success: true, clip: clipPOJO };
        }
        catch (error) {
            console.error('[GenesisIPC] materializeClip failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    // ═══════════════════════════════════════════════════════════════════════
    // genesis:canonizeToBuiltins — Write clip as .lfx to builtins/ + update status
    // ═══════════════════════════════════════════════════════════════════════
    ipcMain.handle('genesis:canonizeToBuiltins', async (_event, clip, organismId) => {
        try {
            const vault = getGenesisVault();
            const db = vault._db;
            if (!db) {
                return { success: false, error: 'Vault not initialized' };
            }
            // 1. Determine builtins directory — runtime app data path
            const builtinsDir = path.join(app.getPath('userData'), 'builtins');
            if (!fs.existsSync(builtinsDir)) {
                fs.mkdirSync(builtinsDir, { recursive: true });
            }
            // 1a. 🧬 WAVE 6000.V7: Procedural baptism — override clip.name with
            //   a generated name from the organism's metrics + blueprint DNA.
            //   Also use the baptized name as the .lfx filename (sanitized).
            const org = db.prepare(`SELECT * FROM lfx_organisms WHERE organism_id = ?`).get(organismId);
            let baptismName = clip.name || organismId;
            if (org) {
                if (org.custom_name) {
                    baptismName = org.custom_name;
                }
                else {
                    const bp = db.prepare('SELECT dna_aggression, dna_chaos, dna_organicity, texture_affinity FROM lfx_blueprints WHERE blueprint_id = ?').get(org.blueprint_id);
                    baptismName = generateOrganismName({
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
                    }, bp ? {
                        dnaAggression: bp.dna_aggression,
                        dnaChaos: bp.dna_chaos,
                        dnaOrganicity: bp.dna_organicity,
                        textureAffinity: bp.texture_affinity,
                    } : undefined);
                    console.log(`[GenesisIPC] 🎲 Baptism name: "${baptismName}" for ${organismId}`);
                }
            }
            // Override clip name with the baptized name
            clip.name = baptismName;
            // 2. Serialize as .lfx (LFXFileV3 wrapper) with proper checksum
            const checksum = createHash('sha256').update(JSON.stringify(clip)).digest('hex');
            const lfxContent = JSON.stringify({
                $schema: 'luxsync.lfx/3.0',
                clip,
                checksum: `sha256:${checksum}`,
            }, null, 2);
            const safeName = baptismName.replace(/[:<>|"*?/\\]/g, '_');
            const fileName = `${safeName}.lfx`;
            const filePath = path.join(builtinsDir, fileName);
            fs.writeFileSync(filePath, lfxContent, 'utf-8');
            // 3. Update organism status to 'canonized'
            db.prepare(`UPDATE lfx_organisms SET status = 'canonized' WHERE organism_id = ?`).run(organismId);
            // 4. 🧬 WAVE 6000.V7: Hot-register in HephaestusClipIndex + DynamicEffectRegistry
            //   so the canonized clip appears immediately in the library and Selene's
            //   arsenal without requiring a restart.
            try {
                const index = getHephaestusClipIndex();
                await index.upsert(filePath, 'builtin');
                const loader = new LfxFileLoader(getDynamicEffectRegistry());
                await loader.loadFile(filePath, 'builtin');
                console.log(`[GenesisIPC] ⚡ Hot-registered "${baptismName}" in arsenal + library`);
            }
            catch (hotRegErr) {
                console.warn(`[GenesisIPC] ⚠️ Hot-registration failed (non-fatal, will load on next boot):`, hotRegErr);
            }
            console.log(`[GenesisIPC] 💾 Canonized to disk: ${organismId} → "${baptismName}" → ${filePath}`);
            return {
                success: true,
                filePath,
                fileName,
            };
        }
        catch (error) {
            console.error('[GenesisIPC] canonizeToBuiltins failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });
    console.log('[GenesisIPC 🧬] All genesis channels registered');
}
// ═══════════════════════════════════════════════════════════════════════
// genesis:purgeEcosystem — Delete all organisms except canonized
// ═══════════════════════════════════════════════════════════════════════
ipcMain.handle('genesis:purgeEcosystem', async () => {
    try {
        const vault = getGenesisVault();
        const db = vault._db;
        if (!db) {
            return { success: false, error: 'Vault not initialized' };
        }
        const info = db.prepare("DELETE FROM lfx_organisms WHERE status != 'canonized'").run();
        console.log(`[GenesisIPC 🧬] Purge: ${info.changes} organisms deleted (canonized preserved)`);
        // ☢️ WAVE 6000.V3 FIX: Clear evolved organisms from the live registry.
        // refreshEvolutionaryCandidates() injects organisms with filePath=null.
        // Base blueprint effects from .lfx files have filePath set and are preserved.
        const registry = getDynamicEffectRegistry();
        const evolvedIds = registry.getAllEntries()
            .filter(e => e.filePath === null)
            .map(e => e.id);
        for (const id of evolvedIds) {
            registry.unregisterEffect(id);
        }
        if (evolvedIds.length > 0) {
            console.log(`[GenesisIPC 🧬] Purge: ${evolvedIds.length} evolved entries removed from DynamicEffectRegistry`);
        }
        // Clear materializer cache — stale materialized organisms must not survive purge
        getOrganismMaterializer().clearCache();
        return { success: true, deleted: info.changes };
    }
    catch (error) {
        console.error('[GenesisIPC] purgeEcosystem failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// genesis:deleteCanonized — Permanently delete a canonized organism
// Removes: DB row, .lfx file from builtins/, HephaestusClipIndex entry,
//          DynamicEffectRegistry entry, and blueprints row if present.
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('genesis:deleteCanonized', async (_event, organismId) => {
    try {
        const vault = getGenesisVault();
        const db = vault._db;
        if (!db) {
            return { success: false, error: 'Vault not initialized' };
        }
        // 1. Verify organism is canonized and get its blueprint_id
        const org = db.prepare('SELECT organism_id, custom_name, blueprint_id FROM lfx_organisms WHERE organism_id = ? AND status = ?').get(organismId, 'canonized');
        if (!org) {
            return { success: false, error: 'Organism not found or not canonized' };
        }
        // 2. Determine the .lfx filename — uses custom_name (baptism name) or blueprint_id
        const builtinsDir = path.join(app.getPath('userData'), 'builtins');
        const clipId = org.blueprint_id;
        // Try to find the .lfx file by looking up the clip in the index
        const index = getHephaestusClipIndex();
        const loadedClip = index.getById(clipId);
        let deletedFile = false;
        if (loadedClip) {
            // Delete the .lfx file from disk
            try {
                fs.unlinkSync(loadedClip.filePath);
                console.log(`[GenesisIPC] 🗑️ Deleted .lfx file: ${loadedClip.filePath}`);
                deletedFile = true;
            }
            catch (e) {
                // File may already be gone
                console.warn(`[GenesisIPC] ⚠️ Could not delete .lfx file: ${loadedClip.filePath}`, e);
            }
            // Remove from HephaestusClipIndex
            index.remove(clipId);
            // Unregister from DynamicEffectRegistry
            getDynamicEffectRegistry().unregisterEffect(clipId);
            console.log(`[GenesisIPC] 🗑️ Unregistered "${clipId}" from arsenal + library`);
        }
        else {
            // Fallback: try to find by sanitized name
            const nameToUse = org.custom_name ?? clipId;
            const safeName = nameToUse.replace(/[:<>|"*?/\\]/g, '_');
            const fallbackPath = path.join(builtinsDir, `${safeName}.lfx`);
            if (fs.existsSync(fallbackPath)) {
                try {
                    fs.unlinkSync(fallbackPath);
                    console.log(`[GenesisIPC] 🗑️ Deleted .lfx file (fallback): ${fallbackPath}`);
                    deletedFile = true;
                }
                catch (e) {
                    console.warn(`[GenesisIPC] ⚠️ Could not delete .lfx file (fallback): ${fallbackPath}`, e);
                }
            }
        }
        // 3. Delete the organism row from the DB
        //    NOTE: We do NOT delete the lfx_blueprints row — it's the granite ancestor
        //    and other descendant organisms may reference it via FK CASCADE.
        //    The canonized artifact is the .lfx file + registry entries (already removed above).
        db.prepare('DELETE FROM lfx_organisms WHERE organism_id = ?').run(organismId);
        console.log(`[GenesisIPC] 🗑️ Deleted canonized organism: ${organismId} ` +
            `(file: ${deletedFile ? 'yes' : 'no'}, DB: yes)`);
        return { success: true, deletedFile };
    }
    catch (error) {
        console.error('[GenesisIPC] deleteCanonized failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
export default setupGenesisIPCHandlers;
