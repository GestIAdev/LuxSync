-- ═══════════════════════════════════════════════════════════════════════════
-- 🧬 WAVE 5000.V3 — ERA I: THE GENESIS VAULT — Schema SQL
-- ═══════════════════════════════════════════════════════════════════════════
--  SQLite3 WAL schema for the Selene Genesis Engine.
--  5 tables + 3 triggers + 2 views.
--  Executed by GenesisVaultService on first boot via db.exec().
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── HIGH-PERFORMANCE PRAGMAS ───────────────────────────────────────────────
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;       -- 64MB page cache
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA wal_autocheckpoint = 0;    -- Manual checkpoint control (avoid UI stalls)

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 1 — lfx_blueprints (El Ancestro de Granito, V3-nativo)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lfx_blueprints (
  blueprint_id          TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  author                TEXT NOT NULL,
  category              TEXT NOT NULL,
  source_origin         TEXT NOT NULL DEFAULT 'builtin',  -- 'hephaestus'|'swarm'|'builtin'|'canonized'

  -- ADN Germinal (la especie — inmutable)
  dna_aggression        REAL NOT NULL CHECK (dna_aggression BETWEEN 0 AND 1),
  dna_chaos             REAL NOT NULL CHECK (dna_chaos BETWEEN 0 AND 1),
  dna_organicity        REAL NOT NULL CHECK (dna_organicity BETWEEN 0 AND 1),
  texture_affinity      TEXT NOT NULL CHECK (texture_affinity IN ('clean','dirty','universal')),

  -- ADN Regulador (el temperamento)
  compatible_vibes      TEXT NOT NULL,           -- JSON array
  valid_sections        TEXT NOT NULL,           -- JSON array
  energy_zone_min       TEXT NOT NULL,
  energy_zone_max       TEXT NOT NULL,
  aggression_range_min  REAL NOT NULL,
  aggression_range_max  REAL NOT NULL,
  spatial_behavior      TEXT NOT NULL,

  -- ADN Somático completo (el genoma V3 entero, congelado)
  clip_v3_json          TEXT NOT NULL,
  execution_domain      TEXT NOT NULL DEFAULT 'vector',

  -- SimulationMeta
  is_strobe             INTEGER NOT NULL DEFAULT 0,
  is_divine_candidate   INTEGER NOT NULL DEFAULT 0,
  is_heavy_candidate    INTEGER NOT NULL DEFAULT 0,

  -- Integrity
  checksum_sha256       TEXT NOT NULL,
  schema_version        TEXT NOT NULL DEFAULT '3.0',
  imported_at           INTEGER NOT NULL
);

-- TRIGGER: Immutability — blueprints are granite ancestors. NO UPDATE allowed.
CREATE TRIGGER IF NOT EXISTS lfx_blueprints_immutable
BEFORE UPDATE ON lfx_blueprints
BEGIN
  SELECT RAISE(ABORT, 'Ancestro de granito. Inmutable. Usa lfx_organisms para evolucionar.');
END;

CREATE INDEX IF NOT EXISTS idx_bp_dna ON lfx_blueprints(dna_aggression, dna_chaos, dna_organicity);
CREATE INDEX IF NOT EXISTS idx_bp_origin ON lfx_blueprints(source_origin);
CREATE INDEX IF NOT EXISTS idx_bp_category ON lfx_blueprints(category);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 2 — lfx_organisms (Los Descendientes Vivos)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lfx_organisms (
  organism_id           TEXT PRIMARY KEY,        -- <console_hash8>:<uuidv7>
  blueprint_id          TEXT NOT NULL,
  parent_organism_id    TEXT,                    -- NULL si hijo directo del ancestro
  generation            INTEGER NOT NULL DEFAULT 1 CHECK (generation <= 16),

  -- Renombrado procedural/manual (Hephaestus UI)
  custom_name           TEXT NULL,

  -- Herencia diferencial (loci V3)
  delta_json            TEXT NOT NULL,
  bezier_signature      BLOB NOT NULL,

  -- 🎰 LOOT SYSTEM
  rarity_score          REAL NOT NULL CHECK (rarity_score BETWEEN 0 AND 1),
  rarity_tier           TEXT NOT NULL CHECK (rarity_tier IN ('COMMON','RARE','EPIC','LEGENDARY','MYTHIC')),
  l2_distance_parent    REAL NOT NULL,
  operator_used         TEXT NOT NULL,
  neonatal_shield_until INTEGER NOT NULL DEFAULT 5,

  -- Contexto de nacimiento (vector 6D)
  birth_vector_json     TEXT NOT NULL,

  -- Fitness en vivo
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

-- TRIGGER: Generation cap — no organism beyond generation 16.
CREATE TRIGGER IF NOT EXISTS trg_org_generation_cap
BEFORE INSERT ON lfx_organisms
WHEN NEW.generation > 16
BEGIN
  SELECT RAISE(ABORT, 'Generación > 16. Canoniza como blueprint o deja morir la rama.');
END;

-- TRIGGER: Lineage path — auto-populate materialized path on insert.
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

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 3 — context_heatmaps (La Huella de cada Disparo)
-- ═══════════════════════════════════════════════════════════════════════════

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

  outcome               TEXT,                    -- survived|vetoed|passed_silent|culled
  vetoed_within_ms      INTEGER,
  veto_severity         REAL,

  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_heat_org ON context_heatmaps(organism_id);
CREATE INDEX IF NOT EXISTS idx_heat_vibe_section ON context_heatmaps(vibe_id, section_id);
CREATE INDEX IF NOT EXISTS idx_heat_6d ON context_heatmaps(z_score_avg_3s, low_band_avg_3s, energy_max_30s, texture);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 4 — lineage_tree (Materialized path for genealogical queries)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lineage_tree (
  node_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  organism_id           TEXT NOT NULL UNIQUE,
  blueprint_id          TEXT NOT NULL,
  ancestor_path         TEXT NOT NULL,           -- materialized path "M001/M042/M173"
  depth                 INTEGER NOT NULL,
  peak_rarity_in_line   TEXT,                    -- highest tier reached in this branch
  is_extinct            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lineage_path ON lineage_tree(ancestor_path);
CREATE INDEX IF NOT EXISTS idx_lineage_blueprint ON lineage_tree(blueprint_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 5 — swarm_imports (Diplomatic table for future bundles)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS swarm_imports (
  import_id             TEXT PRIMARY KEY,
  origin_console_id     TEXT NOT NULL,
  origin_console_label  TEXT,
  imported_at           INTEGER NOT NULL,
  bundle_signature      TEXT NOT NULL,           -- Ed25519
  blueprint_count       INTEGER NOT NULL,
  organism_count        INTEGER NOT NULL,
  legendary_count       INTEGER NOT NULL DEFAULT 0,
  integration_status    TEXT NOT NULL
    CHECK (integration_status IN ('quarantine','partial','merged','rejected')),
  quarantine_until      INTEGER,
  local_dialect_drift   REAL,
  trust_score           REAL NOT NULL DEFAULT 0.5
);

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS — Query API of the Vault
-- ═══════════════════════════════════════════════════════════════════════════

-- v_contextual_candidates: live candidates with aggregated contextual stats
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

-- v_hall_of_fame: legendary organisms candidates for canonization
CREATE VIEW IF NOT EXISTS v_hall_of_fame AS
SELECT o.*, CAST(o.passes_count AS REAL)/(o.trials_count+1) AS survival_rate
FROM lfx_organisms o
WHERE o.rarity_tier IN ('LEGENDARY','MYTHIC')
  AND o.trials_count >= 25
  AND CAST(o.passes_count AS REAL)/(o.trials_count+1) > 0.85
ORDER BY o.fitness_score DESC;
