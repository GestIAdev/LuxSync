// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA I: GenesisVaultService
// ═══════════════════════════════════════════════════════════════════════════
//  Singleton managing the `selene-genesis.db` SQLite3 WAL database.
//  Prepared statements are cached at construction time — zero SQL
//  recompilation in the hot path.
//
//  ERA I scope: blueprint CRUD (read + insert). No organism mutations yet.
// ═══════════════════════════════════════════════════════════════════════════

import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { createHash } from 'crypto'

import type {
  BlueprintRow,
  BlueprintInsertPayload,
  LfxBlueprint,
} from './types'
import type { LFXFileV3 } from '../arsenal/lfxTypes'
import type { HephAutomationClipV3 } from '../hephaestus/types'

// ─── SCHEMA EMBED ───────────────────────────────────────────────────────────

const SCHEMA_SQL = fs.readFileSync(
  path.join(__dirname, 'schema.sql'),
  'utf8',
)

// ─── SERVICE ────────────────────────────────────────────────────────────────

export class GenesisVaultService {
  private _db: DatabaseType | null = null
  private _isInitialized = false
  private _dbPath: string

  // Prepared statements (zero recompilation in runtime)
  private _stmts: {
    getBlueprint: Statement
    getAllBlueprints: Statement
    getBlueprintsByVibe: Statement
    getBlueprintsByCategory: Statement
    insertBlueprint: Statement
    blueprintExists: Statement
    countBlueprints: Statement
  } | null = null

  constructor(dbPath?: string) {
    this._dbPath = dbPath ?? this._getDefaultDbPath()
  }

  // ─── LIFECYCLE ───────────────────────────────────────────────────────────

  /**
   * Opens the database, applies pragmas + schema, and prepares statements.
   * Idempotent — safe to call multiple times.
   */
  initialize(): void {
    if (this._isInitialized) return

    const dbDir = path.dirname(this._dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }

    this._db = new Database(this._dbPath)

    // High-performance pragmas
    this._db.pragma('journal_mode = WAL')
    this._db.pragma('synchronous = NORMAL')
    this._db.pragma('cache_size = -64000')
    this._db.pragma('foreign_keys = ON')
    this._db.pragma('temp_store = MEMORY')
    this._db.pragma('wal_autocheckpoint = 0')

    // Apply schema (CREATE IF NOT EXISTS — idempotent)
    this._db.exec(SCHEMA_SQL)

    // Prepare static statements
    this._stmts = {
      getBlueprint: this._db.prepare(
        'SELECT * FROM lfx_blueprints WHERE blueprint_id = ?',
      ),
      getAllBlueprints: this._db.prepare(
        'SELECT * FROM lfx_blueprints ORDER BY imported_at ASC',
      ),
      getBlueprintsByVibe: this._db.prepare(
        `SELECT * FROM lfx_blueprints
         WHERE compatible_vibes LIKE '%' || ? || '%'
         ORDER BY imported_at ASC`,
      ),
      getBlueprintsByCategory: this._db.prepare(
        'SELECT * FROM lfx_blueprints WHERE category = ? ORDER BY imported_at ASC',
      ),
      insertBlueprint: this._db.prepare(
        `INSERT OR IGNORE INTO lfx_blueprints (
          blueprint_id, name, author, category, source_origin,
          dna_aggression, dna_chaos, dna_organicity, texture_affinity,
          compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
          aggression_range_min, aggression_range_max, spatial_behavior,
          clip_v3_json, execution_domain,
          is_strobe, is_divine_candidate, is_heavy_candidate,
          checksum_sha256, schema_version, imported_at
        ) VALUES (
          @blueprint_id, @name, @author, @category, @source_origin,
          @dna_aggression, @dna_chaos, @dna_organicity, @texture_affinity,
          @compatible_vibes, @valid_sections, @energy_zone_min, @energy_zone_max,
          @aggression_range_min, @aggression_range_max, @spatial_behavior,
          @clip_v3_json, @execution_domain,
          @is_strobe, @is_divine_candidate, @is_heavy_candidate,
          @checksum_sha256, @schema_version, @imported_at
        )`,
      ),
      blueprintExists: this._db.prepare(
        'SELECT 1 FROM lfx_blueprints WHERE blueprint_id = ?',
      ),
      countBlueprints: this._db.prepare(
        'SELECT COUNT(*) as cnt FROM lfx_blueprints',
      ),
    }

    this._isInitialized = true
    console.log(`[GenesisVault 🧬] Initialized at: ${this._dbPath}`)
  }

  /**
   * Runs a manual WAL checkpoint (call during idle / session end).
   */
  checkpoint(): void {
    if (!this._db) return
    this._db.pragma('wal_checkpoint(TRUNCATE)')
  }

  /**
   * Closes the database connection.
   */
  close(): void {
    if (this._db) {
      this.checkpoint()
      this._db.close()
      this._db = null
      this._stmts = null
      this._isInitialized = false
      console.log('[GenesisVault 🧬] Closed.')
    }
  }

  // ─── BLUEPRINT READ METHODS ──────────────────────────────────────────────

  /**
   * Returns a single blueprint by ID, or null if not found.
   */
  getBlueprint(id: string): LfxBlueprint | null {
    this._ensureReady()
    const row = this._stmts!.getBlueprint.get(id) as BlueprintRow | undefined
    return row ? this._rowToBlueprint(row) : null
  }

  /**
   * Returns all blueprints ordered by import time.
   */
  getAllBlueprints(): readonly LfxBlueprint[] {
    this._ensureReady()
    const rows = this._stmts!.getAllBlueprints.all() as BlueprintRow[]
    return rows.map((r) => this._rowToBlueprint(r))
  }

  /**
   * Returns blueprints whose `compatible_vibes` JSON array contains the given vibe.
   */
  getBlueprintsByVibe(vibe: string): readonly LfxBlueprint[] {
    this._ensureReady()
    const rows = this._stmts!.getBlueprintsByVibe.all(vibe) as BlueprintRow[]
    return rows.map((r) => this._rowToBlueprint(r))
  }

  /**
   * Returns blueprints by category.
   */
  getBlueprintsByCategory(category: string): readonly LfxBlueprint[] {
    this._ensureReady()
    const rows = this._stmts!.getBlueprintsByCategory.all(category) as BlueprintRow[]
    return rows.map((r) => this._rowToBlueprint(r))
  }

  /**
   * Returns true if a blueprint with the given ID already exists.
   */
  blueprintExists(id: string): boolean {
    this._ensureReady()
    return this._stmts!.blueprintExists.get(id) !== undefined
  }

  /**
   * Returns the total number of blueprints in the vault.
   */
  countBlueprints(): number {
    this._ensureReady()
    const row = this._stmts!.countBlueprints.get() as { cnt: number }
    return row.cnt
  }

  // ─── BLUEPRINT INSERT ────────────────────────────────────────────────────

  /**
   * Inserts a blueprint in a transaction. Returns true if inserted, false if
   * the ID already existed (INSERT OR IGNORE).
   */
  insertBlueprint(payload: BlueprintInsertPayload): boolean {
    this._ensureReady()
    const tx = this._db!.transaction(() => {
      const info = this._stmts!.insertBlueprint.run({
        blueprint_id: payload.blueprintId,
        name: payload.name,
        author: payload.author,
        category: payload.category,
        source_origin: payload.sourceOrigin,
        dna_aggression: payload.dnaAggression,
        dna_chaos: payload.dnaChaos,
        dna_organicity: payload.dnaOrganicity,
        texture_affinity: payload.textureAffinity,
        compatible_vibes: payload.compatibleVibes,
        valid_sections: payload.validSections,
        energy_zone_min: payload.energyZoneMin,
        energy_zone_max: payload.energyZoneMax,
        aggression_range_min: payload.aggressionRangeMin,
        aggression_range_max: payload.aggressionRangeMax,
        spatial_behavior: payload.spatialBehavior,
        clip_v3_json: payload.clipV3Json,
        execution_domain: payload.executionDomain,
        is_strobe: payload.isStrobe,
        is_divine_candidate: payload.isDivineCandidate,
        is_heavy_candidate: payload.isHeavyCandidate,
        checksum_sha256: payload.checksumSha256,
        schema_version: payload.schemaVersion,
        imported_at: payload.importedAt,
      })
      return info.changes > 0
    })
    return tx()
  }

  // ─── LFX → BLUEPRINT CONVERSION ──────────────────────────────────────────

  /**
   * Converts a parsed `.lfx` V3 file into a `BlueprintInsertPayload` ready
   * for `insertBlueprint()`. Computes SHA-256 checksum if missing.
   */
  lfxToBlueprintPayload(
    lfx: LFXFileV3,
    sourceOrigin: 'builtin' | 'hephaestus' | 'swarm' | 'canonized' = 'builtin',
  ): BlueprintInsertPayload {
    const clip = lfx.clip as HephAutomationClipV3
    const dna = clip.cognitiveDNA
    const sim = clip.simulationMeta

    if (!dna) {
      throw new Error(`[GenesisVault] Blueprint "${clip.id}" has no cognitiveDNA — cannot ingest.`)
    }

    // Compute checksum from canonical JSON if not present
    const checksum = lfx.checksum && lfx.checksum.length > 0
      ? (lfx.checksum.startsWith('sha256:') ? lfx.checksum.slice(7) : lfx.checksum)
      : createHash('sha256').update(JSON.stringify(clip)).digest('hex')

    return {
      blueprintId: clip.id,
      name: clip.name,
      author: clip.author,
      category: clip.category,
      sourceOrigin,
      dnaAggression: dna.genome.aggression,
      dnaChaos: dna.genome.chaos,
      dnaOrganicity: dna.genome.organicity,
      textureAffinity: dna.textureAffinity,
      compatibleVibes: JSON.stringify(dna.compatibleVibes),
      validSections: JSON.stringify(dna.validSections),
      energyZoneMin: dna.energyZone.min,
      energyZoneMax: dna.energyZone.max,
      aggressionRangeMin: dna.aggressionRange.min,
      aggressionRangeMax: dna.aggressionRange.max,
      spatialBehavior: dna.spatialBehavior,
      clipV3Json: JSON.stringify(clip),
      executionDomain: dna.executionDomain ?? 'vector',
      isStrobe: sim?.isStrobe ? 1 : 0,
      isDivineCandidate: sim?.isDivineCandidate ? 1 : 0,
      isHeavyCandidate: sim?.isHeavyCandidate ? 1 : 0,
      checksumSha256: checksum,
      schemaVersion: '3.0',
      importedAt: Date.now(),
    }
  }

  // ─── INTERNALS ───────────────────────────────────────────────────────────

  private _ensureReady(): void {
    if (!this._isInitialized || !this._db || !this._stmts) {
      throw new Error('[GenesisVault] Not initialized. Call initialize() first.')
    }
  }

  private _getDefaultDbPath(): string {
    if (typeof app !== 'undefined' && app.getPath) {
      const userDataPath = app.getPath('userData')
      return path.join(userDataPath, 'selene-genesis.db')
    }
    return path.join(process.cwd(), 'selene-genesis.db')
  }

  private _rowToBlueprint(row: BlueprintRow): LfxBlueprint {
    const clip = JSON.parse(row.clip_v3_json) as HephAutomationClipV3
    return {
      blueprintId: row.blueprint_id,
      name: row.name,
      author: row.author,
      category: row.category,
      sourceOrigin: row.source_origin as LfxBlueprint['sourceOrigin'],
      dna: {
        aggression: row.dna_aggression,
        chaos: row.dna_chaos,
        organicity: row.dna_organicity,
      },
      textureAffinity: row.texture_affinity as LfxBlueprint['textureAffinity'],
      compatibleVibes: JSON.parse(row.compatible_vibes),
      validSections: JSON.parse(row.valid_sections),
      energyZoneMin: row.energy_zone_min,
      energyZoneMax: row.energy_zone_max,
      aggressionRangeMin: row.aggression_range_min,
      aggressionRangeMax: row.aggression_range_max,
      spatialBehavior: row.spatial_behavior as LfxBlueprint['spatialBehavior'],
      clipV3: clip,
      executionDomain: row.execution_domain,
      isStrobe: row.is_strobe === 1,
      isDivineCandidate: row.is_divine_candidate === 1,
      isHeavyCandidate: row.is_heavy_candidate === 1,
      checksumSha256: row.checksum_sha256,
      schemaVersion: row.schema_version,
      importedAt: row.imported_at,
    }
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: GenesisVaultService | null = null

export function getGenesisVault(): GenesisVaultService {
  if (_instance == null) _instance = new GenesisVaultService()
  return _instance
}

export function __resetGenesisVaultForTests(): void {
  if (_instance) {
    _instance.close()
    _instance = null
  }
}
