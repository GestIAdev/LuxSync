// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA I: GenesisVaultService
// ═══════════════════════════════════════════════════════════════════════════
//  Singleton managing the `selene-genesis.db` SQLite3 WAL database.
//  Prepared statements are cached at construction time — zero SQL
//  recompilation in the hot path.
//
//  ERA I scope: blueprint CRUD (read + insert). No organism mutations yet.
// ═══════════════════════════════════════════════════════════════════════════
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
// ─── SCHEMA EMBED ───────────────────────────────────────────────────────────
// Inlined as string constant to avoid ENOENT when running from dist-electron/.
const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA wal_autocheckpoint = 0;

CREATE TABLE IF NOT EXISTS lfx_blueprints (
  blueprint_id          TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  author                TEXT NOT NULL,
  category              TEXT NOT NULL,
  source_origin         TEXT NOT NULL DEFAULT 'builtin',
  dna_aggression        REAL NOT NULL CHECK (dna_aggression BETWEEN 0 AND 1),
  dna_chaos             REAL NOT NULL CHECK (dna_chaos BETWEEN 0 AND 1),
  dna_organicity        REAL NOT NULL CHECK (dna_organicity BETWEEN 0 AND 1),
  texture_affinity      TEXT NOT NULL CHECK (texture_affinity IN ('clean','dirty','universal')),
  compatible_vibes      TEXT NOT NULL,
  valid_sections        TEXT NOT NULL,
  energy_zone_min       TEXT NOT NULL,
  energy_zone_max       TEXT NOT NULL,
  aggression_range_min  REAL NOT NULL,
  aggression_range_max  REAL NOT NULL,
  spatial_behavior      TEXT NOT NULL,
  clip_v3_json          TEXT NOT NULL,
  execution_domain      TEXT NOT NULL DEFAULT 'vector',
  is_strobe             INTEGER NOT NULL DEFAULT 0,
  is_divine_candidate   INTEGER NOT NULL DEFAULT 0,
  is_heavy_candidate    INTEGER NOT NULL DEFAULT 0,
  checksum_sha256       TEXT NOT NULL,
  schema_version        TEXT NOT NULL DEFAULT '3.0',
  imported_at           INTEGER NOT NULL
);

CREATE TRIGGER IF NOT EXISTS lfx_blueprints_immutable
BEFORE UPDATE ON lfx_blueprints
BEGIN
  SELECT RAISE(ABORT, 'Ancestro de granito. Inmutable. Usa lfx_organisms para evolucionar.');
END;

CREATE INDEX IF NOT EXISTS idx_bp_dna ON lfx_blueprints(dna_aggression, dna_chaos, dna_organicity);
CREATE INDEX IF NOT EXISTS idx_bp_origin ON lfx_blueprints(source_origin);
CREATE INDEX IF NOT EXISTS idx_bp_category ON lfx_blueprints(category);

CREATE TABLE IF NOT EXISTS lfx_organisms (
  organism_id           TEXT PRIMARY KEY,
  blueprint_id          TEXT NOT NULL,
  parent_organism_id    TEXT,
  generation            INTEGER NOT NULL DEFAULT 1 CHECK (generation <= 16),
  custom_name           TEXT NULL,
  delta_json            TEXT NOT NULL,
  bezier_signature      BLOB NOT NULL,
  rarity_score          REAL NOT NULL CHECK (rarity_score BETWEEN 0 AND 1),
  rarity_tier           TEXT NOT NULL CHECK (rarity_tier IN ('COMMON','RARE','EPIC','LEGENDARY','MYTHIC')),
  l2_distance_parent    REAL NOT NULL,
  operator_used         TEXT NOT NULL,
  neonatal_shield_until INTEGER NOT NULL DEFAULT 5,
  birth_vector_json     TEXT NOT NULL,
  fitness_score         REAL NOT NULL DEFAULT 0.0,
  trials_count          INTEGER NOT NULL DEFAULT 0,
  wins_count            INTEGER NOT NULL DEFAULT 0,
  vetoes_count          INTEGER NOT NULL DEFAULT 0,
  passes_count          INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'alive'
    CHECK (status IN ('alive','champion','culled','quarantined','canonized')),
  species_id            TEXT,
  born_at               INTEGER NOT NULL,
  last_evaluated_at     INTEGER,
  last_fired_at         INTEGER,
  swarm_origin_console  TEXT,
  FOREIGN KEY (blueprint_id) REFERENCES lfx_blueprints(blueprint_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_blueprint ON lfx_organisms(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_org_status_fitness ON lfx_organisms(status, fitness_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_species ON lfx_organisms(species_id) WHERE species_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_rarity ON lfx_organisms(rarity_tier, fitness_score DESC);
CREATE INDEX IF NOT EXISTS idx_org_lineage ON lfx_organisms(parent_organism_id);
CREATE INDEX IF NOT EXISTS idx_org_custom_name ON lfx_organisms(custom_name) WHERE custom_name IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_org_generation_cap
BEFORE INSERT ON lfx_organisms
WHEN NEW.generation > 16
BEGIN
  SELECT RAISE(ABORT, 'Generacion > 16. Canoniza como blueprint o deja morir la rama.');
END;

CREATE TRIGGER IF NOT EXISTS trg_org_lineage_path
AFTER INSERT ON lfx_organisms
BEGIN
  INSERT INTO lineage_tree(organism_id, blueprint_id, ancestor_path, depth)
  VALUES (
    NEW.organism_id, NEW.blueprint_id,
    COALESCE(
      (SELECT ancestor_path || '/' || NEW.organism_id FROM lineage_tree WHERE organism_id = NEW.parent_organism_id),
      NEW.organism_id
    ),
    NEW.generation
  );
END;

CREATE TABLE IF NOT EXISTS context_heatmaps (
  heatmap_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organism_id           TEXT NOT NULL,
  fired_at              INTEGER NOT NULL,
  vibe_id               TEXT NOT NULL,
  section_id            TEXT NOT NULL,
  energy_zone           TEXT NOT NULL,
  z_score_avg_3s        REAL NOT NULL,
  z_score_max_3s        REAL NOT NULL,
  low_band_avg_3s       REAL NOT NULL,
  mid_band_avg_3s       REAL NOT NULL,
  high_band_avg_3s      REAL NOT NULL,
  texture               TEXT NOT NULL,
  energy_max_30s        REAL NOT NULL,
  energy_phase          TEXT NOT NULL,
  bpm                   REAL,
  beat_phase            REAL,
  outcome               TEXT,
  vetoed_within_ms      INTEGER,
  veto_severity         REAL,
  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_heat_org ON context_heatmaps(organism_id);
CREATE INDEX IF NOT EXISTS idx_heat_vibe_section ON context_heatmaps(vibe_id, section_id);
CREATE INDEX IF NOT EXISTS idx_heat_6d ON context_heatmaps(z_score_avg_3s, low_band_avg_3s, energy_max_30s, texture);

CREATE TABLE IF NOT EXISTS lineage_tree (
  node_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  organism_id           TEXT NOT NULL UNIQUE,
  blueprint_id          TEXT NOT NULL,
  ancestor_path         TEXT NOT NULL,
  depth                 INTEGER NOT NULL,
  peak_rarity_in_line   TEXT,
  is_extinct            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lineage_path ON lineage_tree(ancestor_path);
CREATE INDEX IF NOT EXISTS idx_lineage_blueprint ON lineage_tree(blueprint_id);

CREATE TABLE IF NOT EXISTS swarm_imports (
  import_id             TEXT PRIMARY KEY,
  origin_console_id     TEXT NOT NULL,
  origin_console_label  TEXT,
  imported_at           INTEGER NOT NULL,
  bundle_signature      TEXT NOT NULL,
  blueprint_count       INTEGER NOT NULL,
  organism_count        INTEGER NOT NULL,
  legendary_count       INTEGER NOT NULL DEFAULT 0,
  integration_status    TEXT NOT NULL
    CHECK (integration_status IN ('quarantine','partial','merged','rejected')),
  quarantine_until      INTEGER,
  local_dialect_drift   REAL,
  trust_score           REAL NOT NULL DEFAULT 0.5
);

CREATE VIEW IF NOT EXISTS v_contextual_candidates AS
SELECT o.organism_id, o.blueprint_id, o.fitness_score, o.rarity_tier, o.species_id,
       o.custom_name,
       AVG(h.z_score_avg_3s) AS hist_z, AVG(h.low_band_avg_3s) AS hist_low,
       COUNT(CASE WHEN h.outcome='survived' THEN 1 END) AS survivals,
       COUNT(CASE WHEN h.outcome='vetoed'   THEN 1 END) AS vetoes
FROM lfx_organisms o
LEFT JOIN context_heatmaps h ON h.organism_id = o.organism_id
WHERE o.status IN ('alive','champion')
GROUP BY o.organism_id;

CREATE VIEW IF NOT EXISTS v_hall_of_fame AS
SELECT o.*, CAST(o.passes_count AS REAL)/(o.trials_count+1) AS survival_rate
FROM lfx_organisms o
WHERE o.rarity_tier IN ('LEGENDARY','MYTHIC')
  AND o.trials_count >= 25
  AND CAST(o.passes_count AS REAL)/(o.trials_count+1) > 0.85
ORDER BY o.fitness_score DESC;
`;
// ─── SERVICE ────────────────────────────────────────────────────────────────
export class GenesisVaultService {
    constructor(dbPath) {
        this._db = null;
        this._isInitialized = false;
        // Prepared statements (zero recompilation in runtime)
        this._stmts = null;
        this._dbPath = dbPath ?? this._getDefaultDbPath();
    }
    // ─── LIFECYCLE ───────────────────────────────────────────────────────────
    /**
     * Opens the database, applies pragmas + schema, and prepares statements.
     * Idempotent — safe to call multiple times.
     */
    initialize() {
        if (this._isInitialized)
            return;
        const dbDir = path.dirname(this._dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this._db = new Database(this._dbPath);
        // High-performance pragmas
        this._db.pragma('journal_mode = WAL');
        this._db.pragma('synchronous = NORMAL');
        this._db.pragma('cache_size = -64000');
        this._db.pragma('foreign_keys = ON');
        this._db.pragma('temp_store = MEMORY');
        this._db.pragma('wal_autocheckpoint = 0');
        // Apply schema (CREATE IF NOT EXISTS — idempotent)
        this._db.exec(SCHEMA_SQL);
        // ─── WAVE 6000.V3 MIGRATION: Add parent_organism_id_secondary ──────────
        // SQLite doesn't support ADD COLUMN IF NOT EXISTS, so check pragma_table_info
        const cols = this._db.prepare("SELECT name FROM pragma_table_info('lfx_organisms') WHERE name = 'parent_organism_id_secondary'").get();
        if (!cols) {
            this._db.exec('ALTER TABLE lfx_organisms ADD COLUMN parent_organism_id_secondary TEXT REFERENCES lfx_organisms(organism_id) ON DELETE SET NULL');
            console.log('[GenesisVault 🧬] Migration: added parent_organism_id_secondary column');
        }
        // Prepare static statements
        this._stmts = {
            getBlueprint: this._db.prepare('SELECT * FROM lfx_blueprints WHERE blueprint_id = ?'),
            getAllBlueprints: this._db.prepare('SELECT * FROM lfx_blueprints ORDER BY imported_at ASC'),
            getBlueprintsByVibe: this._db.prepare(`SELECT * FROM lfx_blueprints
         WHERE compatible_vibes LIKE '%' || ? || '%'
         ORDER BY imported_at ASC`),
            getBlueprintsByCategory: this._db.prepare('SELECT * FROM lfx_blueprints WHERE category = ? ORDER BY imported_at ASC'),
            insertBlueprint: this._db.prepare(`INSERT OR IGNORE INTO lfx_blueprints (
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
        )`),
            blueprintExists: this._db.prepare('SELECT 1 FROM lfx_blueprints WHERE blueprint_id = ?'),
            countBlueprints: this._db.prepare('SELECT COUNT(*) as cnt FROM lfx_blueprints'),
        };
        this._isInitialized = true;
        // GenesisVault initialized log silenced
    }
    /**
     * Runs a manual WAL checkpoint (call during idle / session end).
     */
    checkpoint() {
        if (!this._db)
            return;
        this._db.pragma('wal_checkpoint(TRUNCATE)');
    }
    /**
     * Closes the database connection.
     */
    close() {
        if (this._db) {
            this.checkpoint();
            this._db.close();
            this._db = null;
            this._stmts = null;
            this._isInitialized = false;
            console.log('[GenesisVault 🧬] Closed.');
        }
    }
    // ─── BLUEPRINT READ METHODS ──────────────────────────────────────────────
    /**
     * Returns a single blueprint by ID, or null if not found.
     */
    getBlueprint(id) {
        this._ensureReady();
        const row = this._stmts.getBlueprint.get(id);
        return row ? this._rowToBlueprint(row) : null;
    }
    /**
     * Returns all blueprints ordered by import time.
     */
    getAllBlueprints() {
        this._ensureReady();
        const rows = this._stmts.getAllBlueprints.all();
        return rows.map((r) => this._rowToBlueprint(r));
    }
    /**
     * Returns blueprints whose `compatible_vibes` JSON array contains the given vibe.
     */
    getBlueprintsByVibe(vibe) {
        this._ensureReady();
        const rows = this._stmts.getBlueprintsByVibe.all(vibe);
        return rows.map((r) => this._rowToBlueprint(r));
    }
    /**
     * Returns blueprints by category.
     */
    getBlueprintsByCategory(category) {
        this._ensureReady();
        const rows = this._stmts.getBlueprintsByCategory.all(category);
        return rows.map((r) => this._rowToBlueprint(r));
    }
    /**
     * Returns true if a blueprint with the given ID already exists.
     */
    blueprintExists(id) {
        this._ensureReady();
        return this._stmts.blueprintExists.get(id) !== undefined;
    }
    /**
     * Returns the total number of blueprints in the vault.
     */
    countBlueprints() {
        this._ensureReady();
        const row = this._stmts.countBlueprints.get();
        return row.cnt;
    }
    // ─── BLUEPRINT INSERT ────────────────────────────────────────────────────
    /**
     * Inserts a blueprint in a transaction. Returns true if inserted, false if
     * the ID already existed (INSERT OR IGNORE).
     */
    insertBlueprint(payload) {
        this._ensureReady();
        const tx = this._db.transaction(() => {
            const info = this._stmts.insertBlueprint.run({
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
            });
            return info.changes > 0;
        });
        return tx();
    }
    // ─── LFX → BLUEPRINT CONVERSION ──────────────────────────────────────────
    /**
     * Converts a parsed `.lfx` V3 file into a `BlueprintInsertPayload` ready
     * for `insertBlueprint()`. Computes SHA-256 checksum if missing.
     */
    lfxToBlueprintPayload(lfx, sourceOrigin = 'builtin') {
        const clip = lfx.clip;
        const dna = clip.cognitiveDNA;
        const sim = clip.simulationMeta;
        if (!dna) {
            throw new Error(`[GenesisVault] Blueprint "${clip.id}" has no cognitiveDNA — cannot ingest.`);
        }
        // Compute checksum from canonical JSON if not present
        const checksum = lfx.checksum && lfx.checksum.length > 0
            ? (lfx.checksum.startsWith('sha256:') ? lfx.checksum.slice(7) : lfx.checksum)
            : createHash('sha256').update(JSON.stringify(clip)).digest('hex');
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
        };
    }
    // ─── INTERNALS ───────────────────────────────────────────────────────────
    /**
     * 🔬 WAVE 7533: Returns the underlying better-sqlite3 Database instance.
     *
     * This is the **single sanctioned escape hatch** for ecology modules that
     * need direct SQL access (ColiseumService, SpeciationEngine,
     * LifecycleManager, SpeciesQuotaSelector, OrganismMaterializer,
     * HeatmapLogger). It replaces the previous `(this._vault as any)._db`
     * bypass with a typed, audited public API.
     *
     * **Contract:** the returned Database is for read/write queries only.
     * Schema modifications (CREATE/ALTER/DROP) must go through the Vault's
     * own migration logic. The caller must NOT close the database or modify
     * pragmas — those are lifecycle concerns owned by the Vault.
     *
     * @throws if the Vault is not initialized
     */
    getDb() {
        this._ensureReady();
        return this._db;
    }
    /**
     * 🔬 WAVE 7533: Executes a function inside a synchronous transaction.
     *
     * Wraps `better-sqlite3`'s `db.transaction()` — if the function throws,
     * the transaction is rolled back automatically. This is the atomic
     * boundary for the metabolic pipeline (§5.6 of the Due Diligence).
     *
     * @example
     * const result = vault.executeTransaction(() => {
     *   vault.getDb().prepare('UPDATE ...').run(...)
     *   return 42
     * })
     */
    executeTransaction(fn) {
        this._ensureReady();
        const tx = this._db.transaction(fn);
        return tx();
    }
    _ensureReady() {
        if (!this._isInitialized || !this._db || !this._stmts) {
            throw new Error('[GenesisVault] Not initialized. Call initialize() first.');
        }
    }
    _getDefaultDbPath() {
        if (typeof app !== 'undefined' && app.getPath) {
            const userDataPath = app.getPath('userData');
            return path.join(userDataPath, 'selene-genesis.db');
        }
        return path.join(process.cwd(), 'selene-genesis.db');
    }
    _rowToBlueprint(row) {
        const clip = JSON.parse(row.clip_v3_json);
        return {
            blueprintId: row.blueprint_id,
            name: row.name,
            author: row.author,
            category: row.category,
            sourceOrigin: row.source_origin,
            dna: {
                aggression: row.dna_aggression,
                chaos: row.dna_chaos,
                organicity: row.dna_organicity,
            },
            textureAffinity: row.texture_affinity,
            compatibleVibes: JSON.parse(row.compatible_vibes),
            validSections: JSON.parse(row.valid_sections),
            energyZoneMin: row.energy_zone_min,
            energyZoneMax: row.energy_zone_max,
            aggressionRangeMin: row.aggression_range_min,
            aggressionRangeMax: row.aggression_range_max,
            spatialBehavior: row.spatial_behavior,
            clipV3: clip,
            executionDomain: row.execution_domain,
            isStrobe: row.is_strobe === 1,
            isDivineCandidate: row.is_divine_candidate === 1,
            isHeavyCandidate: row.is_heavy_candidate === 1,
            checksumSha256: row.checksum_sha256,
            schemaVersion: row.schema_version,
            importedAt: row.imported_at,
        };
    }
}
// ─── SINGLETON ──────────────────────────────────────────────────────────────
let _instance = null;
export function getGenesisVault() {
    if (_instance == null)
        _instance = new GenesisVaultService();
    return _instance;
}
export function __resetGenesisVaultForTests() {
    if (_instance) {
        _instance.close();
        _instance = null;
    }
}
