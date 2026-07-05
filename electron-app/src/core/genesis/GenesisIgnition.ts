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

import { getHeatmapLogger } from './fitness/HeatmapLogger'
import { getColiseumService } from './ColiseumService'
import { getGenesisVault } from './GenesisVaultService'

const MAINTENANCE_INTERVAL_MS = 60_000  // 60 seconds — geological time

let _maintenanceTimer: ReturnType<typeof setInterval> | null = null
let _ignited = false

/**
 * Ignites the Genesis Engine's geological loop.
 *
 * Call once during application bootstrap (main process, after IPC handlers).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function igniteGenesisEngine(): void {
  if (_ignited) return
  _ignited = true

  // 1. Start the HeatmapLogger flush timer (10s)
  try {
    getHeatmapLogger().start()
  } catch (err) {
    console.warn('[GenesisIgnition ⚠️] HeatmapLogger start failed:', err)
  }

  // 2. Cold-start seeding: if any blueprint has zero living descendants, seed it
  try {
    _seedColdStart()
  } catch (err) {
    console.warn('[GenesisIgnition ⚠️] Cold-start seeding failed:', err)
  }

  // 3. Geological maintenance timer (60s)
  _maintenanceTimer = setInterval(() => {
    getColiseumService()
      .runEcologicalMaintenance()
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
 * Cold-start seeding: for each blueprint with zero living organisms,
 * spawns an initial cohort to seed the medium.
 */
function _seedColdStart(): void {
  const vault = getGenesisVault()
  const db = (vault as any)._db
  if (!db) {
    console.warn('[GenesisIgnition ⚠️] Vault not initialized — skipping cold-start seed')
    return
  }

  // Find blueprints with zero living descendants
  const barrenBlueprints = db.prepare(
    `SELECT b.blueprint_id
     FROM lfx_blueprints b
     LEFT JOIN lfx_organisms o
       ON b.blueprint_id = o.blueprint_id AND o.status = 'alive'
     WHERE o.organism_id IS NULL`,
  ).all() as { blueprint_id: string }[]

  if (barrenBlueprints.length === 0) {
    console.log('[GenesisIgnition 🧬] All blueprints have living descendants — no seeding needed')
    return
  }

  const coliseum = getColiseumService()
  let totalSeeded = 0

  for (const bp of barrenBlueprints) {
    try {
      const results = coliseum.spawnInitialCohort(bp.blueprint_id)
      const viable = results.filter((r) => r.success).length
      totalSeeded += viable
    } catch (err) {
      // Blueprint may not be materializable — skip
    }
  }

  console.log(
    `[GenesisIgnition 🧬] Cold-start seeding: ${totalSeeded} organisms ` +
    `from ${barrenBlueprints.length} barren blueprints`,
  )
}
