// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — THE LAMARCKIAN MEDIUM: Genesis Ignition
// ═══════════════════════════════════════════════════════════════════════════
//  Bootstraps the geological loop and passive telemetry on cold start.
//
//  1. Starts the HeatmapLogger flush timer (10s interval)
//  2. Arranges a 60s background timer for runEcologicalMaintenance()
//  3. On cold start, seeds any blueprint with zero descendants
//
//  All timers are .unref()'d — they never keep the process alive.
//  Zero hot-path impact. Zero UI blocking.
// ═══════════════════════════════════════════════════════════════════════════
import { getHeatmapLogger } from './fitness/HeatmapLogger';
import { getColiseumService } from './ColiseumService';
import { getGenesisVault } from './GenesisVaultService';
import { getAncestralIngestor } from './AncestralIngestor';
import { getDynamicEffectRegistry } from '../arsenal/DynamicEffectRegistry';
const MAINTENANCE_INTERVAL_MS = 60000; // 60 seconds — geological time
let _maintenanceTimer = null;
let _ignited = false;
/**
 * Ignites the Genesis Engine's geological loop.
 *
 * Call once during application bootstrap (main process, after IPC handlers).
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * BIG BANG FIX: Awaits AncestralIngestor.ingestAll() BEFORE cold-start seeding
 * to guarantee lfx_blueprints is populated. Without this, the cold-start query
 * sees an empty table and skips seeding entirely.
 */
export async function igniteGenesisEngine() {
    if (_ignited)
        return;
    _ignited = true;
    // 1. Start the HeatmapLogger flush timer (10s)
    try {
        getHeatmapLogger().start();
    }
    catch (err) {
        console.warn('[GenesisIgnition ⚠️] HeatmapLogger start failed:', err);
    }
    // 2. Ancestral ingestion — populate lfx_blueprints from .lfx catalog BEFORE seeding
    try {
        const report = await getAncestralIngestor().ingestAll();
        console.log(`[GenesisIgnition 🧬] Ancestral ingestion: ${report.inserted} inserted, ` +
            `${report.skipped} skipped, ${report.errors} errors`);
    }
    catch (err) {
        console.warn('[GenesisIgnition ⚠️] Ancestral ingestion failed:', err);
    }
    // 3. Cold-start seeding: if any blueprint has zero living descendants, seed it
    try {
        _seedColdStart();
    }
    catch (err) {
        console.warn('[GenesisIgnition ⚠️] Cold-start seeding failed:', err);
    }
    // 4. Geological maintenance timer (60s) + Arena Gates refresh
    _maintenanceTimer = setInterval(() => {
        getColiseumService()
            .runEcologicalMaintenance()
            .then(() => {
            // Arena Gates: inject evolved candidates into the DreamSimulator pool
            try {
                const injected = getDynamicEffectRegistry().refreshEvolutionaryCandidates(10);
                if (injected > 0) {
                    console.log(`[GenesisIgnition 🧬] Arena Gates: ${injected} mutants injected into live pool`);
                }
            }
            catch (err) {
                console.warn('[GenesisIgnition ⚠️] Arena Gates refresh failed:', err);
            }
        })
            .catch((err) => {
            console.warn('[GenesisIgnition ⚠️] Maintenance cycle error:', err);
        });
    }, MAINTENANCE_INTERVAL_MS);
    _maintenanceTimer.unref();
    console.log(`[GenesisIgnition 🧬] Geological loop ignited — ` +
        `maintenance every ${MAINTENANCE_INTERVAL_MS / 1000}s, ` +
        `heatmap flush every 10s`);
}
/**
 * Shuts down the geological loop. Call during app shutdown.
 */
export function shutdownGenesisEngine() {
    if (_maintenanceTimer != null) {
        clearInterval(_maintenanceTimer);
        _maintenanceTimer = null;
    }
    getHeatmapLogger()
        .stop()
        .catch(() => { });
    _ignited = false;
    console.log('[GenesisIgnition 🧬] Geological loop stopped.');
}
/**
 * Cold-start seeding: for each blueprint with zero living organisms,
 * spawns an initial cohort to seed the medium.
 */
function _seedColdStart() {
    const vault = getGenesisVault();
    const db = vault._db;
    if (!db) {
        console.warn('[GenesisIgnition ⚠️] Vault not initialized — skipping cold-start seed');
        return;
    }
    // Find blueprints with zero living descendants
    const barrenBlueprints = db.prepare(`SELECT b.blueprint_id
     FROM lfx_blueprints b
     LEFT JOIN lfx_organisms o
       ON b.blueprint_id = o.blueprint_id AND o.status = 'alive'
     WHERE o.organism_id IS NULL`).all();
    if (barrenBlueprints.length === 0) {
        console.log('[GenesisIgnition 🧬] All blueprints have living descendants — no seeding needed');
        return;
    }
    const coliseum = getColiseumService();
    let totalSeeded = 0;
    for (const bp of barrenBlueprints) {
        try {
            const results = coliseum.spawnInitialCohort(bp.blueprint_id);
            const viable = results.filter((r) => r.success).length;
            totalSeeded += viable;
        }
        catch (err) {
            // Blueprint may not be materializable — skip
        }
    }
    console.log(`[GenesisIgnition 🧬] Cold-start seeding: ${totalSeeded} organisms ` +
        `from ${barrenBlueprints.length} barren blueprints`);
}
