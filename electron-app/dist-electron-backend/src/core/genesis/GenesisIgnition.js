// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — THE LAMARCKIAN MEDIUM: Genesis Ignition
// ═══════════════════════════════════════════════════════════════════════════
//  Bootstraps the geological loop and passive telemetry on cold start.
//
//  1. Starts the HeatmapLogger flush timer (10s interval)
//  2. Arranges a 60s background timer for runEcologicalMaintenance()
//  3. WAVE 6000.V6: Cold-start seeding PURGED — zero artificial spawns at boot.
//     The only entry point for spawnInitialCohort is the natural live fire
//     event in EffectManager.ts.
//
//  All timers are .unref()'d — they never keep the process alive.
//  Zero hot-path impact. Zero UI blocking.
// ═══════════════════════════════════════════════════════════════════════════
import { getHeatmapLogger } from './fitness/HeatmapLogger';
import { getColiseumService } from './ColiseumService';
import { getAncestralIngestor } from './AncestralIngestor';
import { getDynamicEffectRegistry } from '../arsenal/DynamicEffectRegistry';
import { dreamEngineIntegrator } from '../intelligence/integration/DreamEngineIntegrator';
const MAINTENANCE_INTERVAL_MS = 60000; // 60 seconds — geological time
let _maintenanceTimer = null;
let _ignited = false;
// 🔒 WAVE 7527: Default PAUSED — ecosystem is OPT-IN per session.
// The geological loop (maintenance + heatmap) does NOT auto-start on boot.
// The operator must explicitly press "▶ START ECOSYSTEM" in the Genesis Lab.
let _genesisPaused = true;
/**
 * Ignites the Genesis Engine's geological loop.
 *
 * Call once during application bootstrap (main process, after IPC handlers).
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * BIG BANG FIX: Awaits AncestralIngestor.ingestAll() BEFORE cold-start seeding
 * to guarantee lfx_blueprints is populated. Without this, the cold-start query
 * sees an empty table and skips seeding entirely.
 *
 * 🔒 WAVE 7527: This function NO LONGER starts the HeatmapLogger or the
 * maintenance timer. Those are deferred to resumeGenesisEngine(), which the
 * UI calls when the operator explicitly starts the ecosystem. This prevents
 * mutant organism flooding during routine Selene testing.
 */
export async function igniteGenesisEngine() {
    if (_ignited)
        return;
    _ignited = true;
    // 1. Ancestral ingestion — populate lfx_blueprints from .lfx catalog.
    // This is a one-time bootstrap operation, NOT an interval. It must run
    // regardless of ecosystem paused state so the arsenal is available.
    try {
        const report = await getAncestralIngestor().ingestAll();
        // Ancestral ingestion summary log silenced
    }
    catch (err) {
        console.warn('[GenesisIgnition ⚠️] Ancestral ingestion failed:', err);
    }
    // 2. WAVE 6000.V6: Cold-start seeding PURGED.
    // The ecosystem boots with zero artificial organisms. Spawns happen
    // exclusively via the natural live-fire event in EffectManager.ts.
    // 🔒 WAVE 7527: HeatmapLogger and maintenance timer are NOT started here.
    // They are started in resumeGenesisEngine() when the operator explicitly
    // enables the ecosystem via the Genesis Lab UI.
    console.log('[GenesisIgnition 🧬] Bootstrap complete — ecosystem PAUSED (opt-in). Press ▶ START in Genesis Lab to activate.');
}
/**
 * 🔒 WAVE 7527: Starts the geological loop timers (HeatmapLogger + maintenance).
 * Called by resumeGenesisEngine() when the operator explicitly enables the ecosystem.
 * Safe to call multiple times — if timers are already running, this is a no-op.
 */
function _startEcosystemTimers() {
    if (_maintenanceTimer != null)
        return; // Already running
    // Start the HeatmapLogger flush timer (10s)
    try {
        getHeatmapLogger().start();
    }
    catch (err) {
        console.warn('[GenesisIgnition ⚠️] HeatmapLogger start failed:', err);
    }
    // Geological maintenance timer (60s) + Arena Gates refresh
    _maintenanceTimer = setInterval(() => {
        if (_genesisPaused)
            return;
        getColiseumService()
            .runEcologicalMaintenance()
            .then(() => {
            // Arena Gates: inject evolved candidates into the DreamSimulator pool
            try {
                const injected = getDynamicEffectRegistry().refreshEvolutionaryCandidates(3);
                if (injected > 0) {
                    console.log(`[GenesisIgnition 🧬] Arena Gates: ${injected} mutants injected into live pool`);
                    // 🧬 WAVE 7003: Invalidate dream cache so Selene sees fresh candidates immediately.
                    // Without this, the 5s dream cache returns stale "DNA: ❌ none" results
                    // even after new champion/canonized organisms are registered.
                    dreamEngineIntegrator.invalidateDreamCache();
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
}
/**
 * 🔒 WAVE 7527: Stops the geological loop timers.
 * Called by pauseGenesisEngine() when the operator pauses the ecosystem.
 */
function _stopEcosystemTimers() {
    if (_maintenanceTimer != null) {
        clearInterval(_maintenanceTimer);
        _maintenanceTimer = null;
    }
    getHeatmapLogger()
        .stop()
        .catch(() => { });
}
/**
 * Shuts down the geological loop. Call during app shutdown.
 */
export function shutdownGenesisEngine() {
    _stopEcosystemTimers();
    _ignited = false;
    console.log('[GenesisIgnition 🧬] Geological loop stopped.');
}
/**
 * Pauses the Genesis ecosystem — stops spawning/mutating organisms.
 * 🔒 WAVE 7527: Now also stops the timers (HeatmapLogger + maintenance)
 * instead of letting them idle. This fully halts the geological loop.
 */
export function pauseGenesisEngine() {
    if (_genesisPaused)
        return;
    _genesisPaused = true;
    _stopEcosystemTimers();
    console.log('[GenesisIgnition 🧬] Ecosystem PAUSED — geological loop halted.');
}
/**
 * Resumes the Genesis ecosystem — organisms will spawn/mutate again.
 * 🔒 WAVE 7527: Now starts the timers (HeatmapLogger + maintenance)
 * that were deferred from igniteGenesisEngine(). This is the ONLY path
 * that activates the geological loop.
 */
export function resumeGenesisEngine() {
    if (!_genesisPaused)
        return;
    _genesisPaused = false;
    _startEcosystemTimers();
    console.log('[GenesisIgnition 🧬] Ecosystem RESUMED — geological loop active.');
}
/**
 * Returns true if the Genesis ecosystem is currently paused.
 */
export function isGenesisPaused() {
    return _genesisPaused;
}
/**
 * WAVE 6000.V6: Cold-start seeding PURGED.
 * Kept as a no-op for backward compatibility — does nothing.
 * The ecosystem must boot with zero artificial spawns. The only entry
 * point for ColiseumService.spawnInitialCohort() is the natural live-fire
 * event in EffectManager.ts (BIG BANG SPARK).
 */
function _seedColdStart() {
    // NO-OP — intentionally purged in WAVE 6000.V6
}
