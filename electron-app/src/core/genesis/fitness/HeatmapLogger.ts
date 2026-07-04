// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA III: Heatmap Logger (Silent Collector)
// ═══════════════════════════════════════════════════════════════════════════
//  Ultra-light async logger that records fire events without blocking
//  the 44Hz hot path.
//
//  Architecture:
//    - recordFireEvent() → pushes to in-memory queue (O(1), zero I/O)
//    - setInterval (10s) → flushes queue → batch INSERT into context_heatmaps
//    - All events assumed outcome='survived' (veto abolished in live)
//
//  ZERO UI listeners. ZERO L2 live hammer. ZERO hot-path blocking.
// ═══════════════════════════════════════════════════════════════════════════

import type { ContextVector6D } from '../types'
import type { GenesisVaultService } from '../GenesisVaultService'
import { getGenesisVault } from '../GenesisVaultService'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface FireEvent {
  organismId: string
  firedAt: number
  context: ContextVector6D
  vibeId: string
  sectionId: string
  energyZone: string
  texture: string
  bpm: number | null
  beatPhase: number | null
  outcome: 'survived'  // Always 'survived' — veto abolished in live
}

export interface HeatmapLoggerStats {
  queueLength: number
  totalLogged: number
  totalFlushes: number
  lastFlushAt: number | null
}

// ─── HEATMAP LOGGER ─────────────────────────────────────────────────────────

const FLUSH_INTERVAL_MS = 10_000  // 10 seconds
const BATCH_MAX = 500             // Max events per batch insert

export class HeatmapLogger {
  private readonly _queue: FireEvent[] = []
  private _flushTimer: ReturnType<typeof setInterval> | null = null
  private readonly _vault: GenesisVaultService

  private _totalLogged = 0
  private _totalFlushes = 0
  private _lastFlushAt: number | null = null

  constructor(vault?: GenesisVaultService) {
    this._vault = vault ?? getGenesisVault()
  }

  /**
   * Starts the periodic flush timer.
   * Call once during idle initialization (NOT in the hot path).
   */
  start(): void {
    if (this._flushTimer != null) return
    this._flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.warn('[HeatmapLogger ⚠️] Flush error:', err)
      })
    }, FLUSH_INTERVAL_MS)
    console.log(`[HeatmapLogger 🧬] Started — flush every ${FLUSH_INTERVAL_MS / 1000}s`)
  }

  /**
   * Stops the periodic flush timer and drains the queue.
   */
  async stop(): Promise<void> {
    if (this._flushTimer != null) {
      clearInterval(this._flushTimer)
      this._flushTimer = null
    }
    await this.flush()
    console.log('[HeatmapLogger 🧬] Stopped.')
  }

  /**
   * Records a fire event. O(1) push to in-memory queue.
   * ZERO I/O. ZERO blocking. Safe to call from the 44Hz hot path.
   *
   * All events are assumed outcome='survived' — the veto is abolished
   * in live evaluation (operator selects mutations post-show).
   */
  recordFireEvent(
    organismId: string,
    context: ContextVector6D,
    metadata: {
      vibeId: string
      sectionId: string
      energyZone: string
      texture: string
      bpm?: number
      beatPhase?: number
    },
  ): void {
    this._queue.push({
      organismId,
      firedAt: Date.now(),
      context,
      vibeId: metadata.vibeId,
      sectionId: metadata.sectionId,
      energyZone: metadata.energyZone,
      texture: metadata.texture,
      bpm: metadata.bpm ?? null,
      beatPhase: metadata.beatPhase ?? null,
      outcome: 'survived',
    })
  }

  /**
   * Flushes the queue to the database in a single batch transaction.
   * Called by the periodic timer or manually during shutdown.
   */
  async flush(): Promise<void> {
    if (this._queue.length === 0) return

    const db = (this._vault as any)._db
    if (!db) {
      console.warn('[HeatmapLogger ⚠️] Vault not initialized — skipping flush')
      return
    }

    // Drain queue (take up to BATCH_MAX)
    const batch = this._queue.splice(0, BATCH_MAX)

    const insertStmt = db.prepare(
      `INSERT INTO context_heatmaps (
        organism_id, fired_at,
        vibe_id, section_id, energy_zone,
        z_score_avg_3s, z_score_max_3s,
        low_band_avg_3s, mid_band_avg_3s, high_band_avg_3s,
        texture, energy_max_30s, energy_phase,
        bpm, beat_phase,
        outcome
      ) VALUES (
        @organism_id, @fired_at,
        @vibe_id, @section_id, @energy_zone,
        @z_score_avg_3s, @z_score_max_3s,
        @low_band_avg_3s, @mid_band_avg_3s, @high_band_avg_3s,
        @texture, @energy_max_30s, @energy_phase,
        @bpm, @beat_phase,
        @outcome
      )`,
    )

    const tx = db.transaction((events: FireEvent[]) => {
      for (const evt of events) {
        insertStmt.run({
          organism_id: evt.organismId,
          fired_at: evt.firedAt,
          vibe_id: evt.vibeId,
          section_id: evt.sectionId,
          energy_zone: evt.energyZone,
          z_score_avg_3s: evt.context.zScoreAvg3s,
          z_score_max_3s: evt.context.zScoreAvg3s, // proxy — real max from analyzer later
          low_band_avg_3s: evt.context.lowBandAvg3s,
          mid_band_avg_3s: 0, // filled from analyzer when available
          high_band_avg_3s: 0,
          texture: evt.texture,
          energy_max_30s: evt.context.lowBandAvg3s, // proxy
          energy_phase: 'unknown', // filled from analyzer when available
          bpm: evt.bpm,
          beat_phase: evt.beatPhase,
          outcome: evt.outcome,
        })
      }
    })

    tx(batch)

    this._totalLogged += batch.length
    this._totalFlushes++
    this._lastFlushAt = Date.now()

    if (batch.length > 0) {
      console.log(
        `[HeatmapLogger 🧬] Flushed ${batch.length} events ` +
        `(total: ${this._totalLogged}, flushes: ${this._totalFlushes})`,
      )
    }
  }

  /**
   * Returns current stats for telemetry.
   */
  getStats(): HeatmapLoggerStats {
    return {
      queueLength: this._queue.length,
      totalLogged: this._totalLogged,
      totalFlushes: this._totalFlushes,
      lastFlushAt: this._lastFlushAt,
    }
  }

  /**
   * Returns the current queue length (for monitoring backpressure).
   */
  get queueLength(): number {
    return this._queue.length
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: HeatmapLogger | null = null

export function getHeatmapLogger(): HeatmapLogger {
  if (_instance == null) _instance = new HeatmapLogger()
  return _instance
}

export function __resetHeatmapLoggerForTests(): void {
  if (_instance) {
    _instance.stop().catch(() => {})
    _instance = null
  }
}
