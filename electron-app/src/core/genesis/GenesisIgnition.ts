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

import { getHeatmapLogger } from './fitness/HeatmapLogger'
import { getColiseumService } from './ColiseumService'
import { getAncestralIngestor } from './AncestralIngestor'
import { getDynamicEffectRegistry } from '../arsenal/DynamicEffectRegistry'

const MAINTENANCE_INTERVAL_MS = 60_000  // 60 seconds — geological time

let _maintenanceTimer: ReturnType<typeof setInterval> | null = null
let _ignited = false

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
export async function igniteGenesisEngine(): Promise<void> {
  if (_ignited) return
  _ignited = true

  // 1. Start the HeatmapLogger flush timer (10s)
  try {
    getHeatmapLogger().start()
  } catch (err) {
    console.warn('[GenesisIgnition ⚠️] HeatmapLogger start failed:', err)
  }

  // 2. Ancestral ingestion — populate lfx_blueprints from .lfx catalog BEFORE seeding
  try {
    const report = await getAncestralIngestor().ingestAll()
    console.log(
      `[GenesisIgnition 🧬] Ancestral ingestion: ${report.inserted} inserted, ` +
      `${report.skipped} skipped, ${report.errors} errors`,
    )
  } catch (err) {
    console.warn('[GenesisIgnition ⚠️] Ancestral ingestion failed:', err)
  }

  // 3. WAVE 6000.V6: Cold-start seeding PURGED.
  // The ecosystem boots with zero artificial organisms. Spawns happen
  // exclusively via the natural live-fire event in EffectManager.ts.
  // (Previous _seedColdStart() call removed — no bureaucratic seeding.)

  // 4. Geological maintenance timer (60s) + Arena Gates refresh
  _maintenanceTimer = setInterval(() => {
    getColiseumService()
      .runEcologicalMaintenance()
      .then(() => {
        // Arena Gates: inject evolved candidates into the DreamSimulator pool
        try {
          const injected = getDynamicEffectRegistry().refreshEvolutionaryCandidates(3)
          if (injected > 0) {
            console.log(`[GenesisIgnition 🧬] Arena Gates: ${injected} mutants injected into live pool`)
          }
        } catch (err) {
          console.warn('[GenesisIgnition ⚠️] Arena Gates refresh failed:', err)
        }
      })
      .catch((err) => {
        console.warn('[GenesisIgnition ⚠️] Maintenance cycle error:', err)
      })
  }, MAINTENANCE_INTERVAL_MS)
  _maintenanceTimer.unref()

  console.log(
    `[GenesisIgnition 🧬] Geological loop ignited — ` +
    `maintenance every ${MAINTENANCE_INTERVAL_MS / 1000}s, ` +
    `heatmap flush every 10s`,
  )
}

/**
 * Shuts down the geological loop. Call during app shutdown.
 */
export function shutdownGenesisEngine(): void {
  if (_maintenanceTimer != null) {
    clearInterval(_maintenanceTimer)
    _maintenanceTimer = null
  }
  getHeatmapLogger()
    .stop()
    .catch(() => {})
  _ignited = false
  console.log('[GenesisIgnition 🧬] Geological loop stopped.')
}

/**
 * WAVE 6000.V6: Cold-start seeding PURGED.
 * Kept as a no-op for backward compatibility — does nothing.
 * The ecosystem must boot with zero artificial spawns. The only entry
 * point for ColiseumService.spawnInitialCohort() is the natural live-fire
 * event in EffectManager.ts (BIG BANG SPARK).
 */
function _seedColdStart(): void {
  // NO-OP — intentionally purged in WAVE 6000.V6
}
