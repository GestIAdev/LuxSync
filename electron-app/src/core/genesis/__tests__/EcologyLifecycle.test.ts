// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — Ecology: Speciation & Lifecycle
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. SpeciationEngine — 30 organisms in 3 clusters → ≥2 species_ids
//  2. LifecycleManager — organism past shield with low survival → culled
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock electron before importing modules that depend on it
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { SpeciationEngine } from '../ecology/SpeciationEngine'
import { LifecycleManager } from '../ecology/LifecycleManager'

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
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

CREATE VIEW IF NOT EXISTS v_hall_of_fame AS
SELECT o.*, CAST(o.passes_count AS REAL)/(o.trials_count+1) AS survival_rate
FROM lfx_organisms o
WHERE o.rarity_tier IN ('LEGENDARY','MYTHIC')
  AND o.trials_count >= 25
  AND CAST(o.passes_count AS REAL)/(o.trials_count+1) > 0.85
ORDER BY o.fitness_score DESC;
`

// ─── MOCK VAULT ──────────────────────────────────────────────────────────────

function makeMockVault(db: DatabaseType) {
  return { _db: db }
}

// ─── SIGNATURE GENERATOR ─────────────────────────────────────────────────────

const SIG_LEN = 128

function makeSignature(cluster: number): Buffer {
  const arr = new Float32Array(SIG_LEN)
  if (cluster === 0) {
    // Cluster A: high values in first half
    for (let i = 0; i < SIG_LEN; i++) arr[i] = i < 64 ? 0.8 + Math.random() * 0.1 : 0.1
  } else if (cluster === 1) {
    // Cluster B: high values in second half
    for (let i = 0; i < SIG_LEN; i++) arr[i] = i >= 64 ? 0.8 + Math.random() * 0.1 : 0.1
  } else {
    // Cluster C: mid-range everywhere
    for (let i = 0; i < SIG_LEN; i++) arr[i] = 0.4 + Math.random() * 0.1
  }
  return Buffer.from(arr.buffer)
}

// ─── FIXTURE INSERT ──────────────────────────────────────────────────────────

function insertBlueprint(db: DatabaseType, id: string) {
  db.prepare(
    `INSERT INTO lfx_blueprints (blueprint_id, name, author, category, source_origin,
      dna_aggression, dna_chaos, dna_organicity, texture_affinity,
      compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
      aggression_range_min, aggression_range_max, spatial_behavior,
      clip_v3_json, execution_domain, is_strobe, is_divine_candidate, is_heavy_candidate,
      checksum_sha256, schema_version, imported_at)
    VALUES (?, 'Test', 'test', 'composite', 'builtin',
      0.5, 0.3, 0.7, 'universal', '[]', '[]', 'ambient', 'peak',
      0.3, 0.8, 'static', '{}', 'vector', 0, 0, 0, 'abc', '3.0', ?)`,
  ).run(id, Date.now())
}

function insertOrganism(
  db: DatabaseType,
  opts: {
    id: string
    blueprintId: string
    signature: Buffer
    status?: string
    speciesId?: string | null
    fitnessScore?: number
    trialsCount?: number
    passesCount?: number
    neonatalShieldUntil?: number
    rarityTier?: string
  },
) {
  db.prepare(
    `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
      custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
      l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
      fitness_score, trials_count, wins_count, vetoes_count, passes_count,
      status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
    VALUES (?, ?, NULL, 1,
      NULL, '[]', ?, 0.5, ?,
      0.1, 'point_mutation', ?, '{}',
      ?, ?, 0, 0, ?,
      ?, ?, ?, NULL, NULL, NULL)`,
  ).run(
    opts.id,
    opts.blueprintId,
    opts.signature,
    opts.rarityTier ?? 'COMMON',
    opts.neonatalShieldUntil ?? 5,
    opts.fitnessScore ?? 0.3,
    opts.trialsCount ?? 0,
    opts.passesCount ?? 0,
    opts.status ?? 'alive',
    opts.speciesId ?? null,
    Date.now(),
  )
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 Ecology — Speciation & Lifecycle', () => {
  let db: DatabaseType
  let vault: ReturnType<typeof makeMockVault>

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA_SQL)
    vault = makeMockVault(db)
  })

  afterEach(() => {
    db.close()
  })

  // ── 1. Speciation via K-means ─────────────────────────────────────────────

  describe('SpeciationEngine', () => {
    it('should assign ≥2 distinct species_ids to 30 organisms in 3 clusters', () => {
      insertBlueprint(db, 'bp-spec')

      // Insert 30 organisms: 10 per cluster
      for (let i = 0; i < 10; i++) {
        insertOrganism(db, {
          id: `org-A-${i}`,
          blueprintId: 'bp-spec',
          signature: makeSignature(0),
        })
      }
      for (let i = 0; i < 10; i++) {
        insertOrganism(db, {
          id: `org-B-${i}`,
          blueprintId: 'bp-spec',
          signature: makeSignature(1),
        })
      }
      for (let i = 0; i < 10; i++) {
        insertOrganism(db, {
          id: `org-C-${i}`,
          blueprintId: 'bp-spec',
          signature: makeSignature(2),
        })
      }

      const engine = new SpeciationEngine(vault as any)
      const result = engine.runSpeciation()

      expect(result.totalOrganisms).toBe(30)
      expect(result.speciesCount).toBeGreaterThanOrEqual(2)

      // Verify species_ids were actually written to DB
      const rows = db.prepare(
        'SELECT DISTINCT species_id FROM lfx_organisms WHERE species_id IS NOT NULL',
      ).all() as { species_id: string }[]
      expect(rows.length).toBeGreaterThanOrEqual(2)
    })

    it('should return empty result when no alive organisms exist', () => {
      insertBlueprint(db, 'bp-empty')

      const engine = new SpeciationEngine(vault as any)
      const result = engine.runSpeciation()

      expect(result.totalOrganisms).toBe(0)
      expect(result.speciesCount).toBe(0)
      expect(result.assignments).toHaveLength(0)
    })
  })

  // ── 2. Lifecycle transitions ──────────────────────────────────────────────

  describe('LifecycleManager', () => {
    it('should cull organism with trials > neonatalShieldUntil and survival < 0.15', () => {
      insertBlueprint(db, 'bp-cull')

      // Insert organism past shield with low survival rate
      // trials=10, passes=0 → survival = 0/(10+1) = 0 < 0.15
      insertOrganism(db, {
        id: 'org-cull-me',
        blueprintId: 'bp-cull',
        signature: makeSignature(0),
        status: 'alive',
        trialsCount: 10,
        passesCount: 0,
        neonatalShieldUntil: 5, // shield expired (trials=10 > 5)
        fitnessScore: 0.1,
      })

      // Insert a healthy organism to provide species average context
      insertOrganism(db, {
        id: 'org-healthy',
        blueprintId: 'bp-cull',
        signature: makeSignature(0),
        status: 'alive',
        trialsCount: 5,
        passesCount: 4,
        neonatalShieldUntil: 5,
        fitnessScore: 0.8,
      })

      const manager = new LifecycleManager(vault as any)
      const result = manager.runTransitions()

      expect(result.culls).toBeGreaterThanOrEqual(1)

      // Verify the organism was culled in DB
      const row = db.prepare('SELECT status FROM lfx_organisms WHERE organism_id = ?').get('org-cull-me') as { status: string }
      expect(row.status).toBe('culled')
    })

    it('should NOT cull organism still within neonatal shield', () => {
      insertBlueprint(db, 'bp-shield')

      // Organism with low survival but still shielded
      insertOrganism(db, {
        id: 'org-shielded',
        blueprintId: 'bp-shield',
        signature: makeSignature(0),
        status: 'alive',
        trialsCount: 3,
        passesCount: 0,
        neonatalShieldUntil: 10, // shield active (trials=3 < 10)
        fitnessScore: 0.05,
      })

      const manager = new LifecycleManager(vault as any)
      const result = manager.runTransitions()

      expect(result.culls).toBe(0)

      const row = db.prepare('SELECT status FROM lfx_organisms WHERE organism_id = ?').get('org-shielded') as { status: string }
      expect(row.status).toBe('alive')
    })

    it('should promote high-fitness organism to champion', () => {
      insertBlueprint(db, 'bp-promote')

      // Insert a species group with average fitness ~0.3
      for (let i = 0; i < 5; i++) {
        insertOrganism(db, {
          id: `org-avg-${i}`,
          blueprintId: 'bp-promote',
          signature: makeSignature(0),
          status: 'alive',
          speciesId: 'species_test',
          trialsCount: 6,
          passesCount: 3,
          neonatalShieldUntil: 5,
          fitnessScore: 0.3,
        })
      }

      // Insert a superstar with fitness way above average
      insertOrganism(db, {
        id: 'org-superstar',
        blueprintId: 'bp-promote',
        signature: makeSignature(0),
        status: 'alive',
        speciesId: 'species_test',
        trialsCount: 6,
        passesCount: 5,
        neonatalShieldUntil: 5,
        fitnessScore: 0.9, // >> 0.3 * 1.3 = 0.39
      })

      const manager = new LifecycleManager(vault as any)
      const result = manager.runTransitions()

      expect(result.promotions).toBeGreaterThanOrEqual(1)

      const row = db.prepare('SELECT status FROM lfx_organisms WHERE organism_id = ?').get('org-superstar') as { status: string }
      expect(row.status).toBe('champion')
    })
  })
})
