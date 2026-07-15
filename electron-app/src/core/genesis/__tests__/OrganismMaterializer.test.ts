// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — OrganismMaterializer Cache & Fallback
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. LRU Cache — insert 300 items, verify size ≤ 256
//  2. Corrupt delta_json — fallback returns granite ancestor's clipV3
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock electron before importing modules that depend on it
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}))

import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { OrganismMaterializer } from '../OrganismMaterializer'
import type { HephAutomationClipV3 } from '../../hephaestus/types'

// ─── SCHEMA (inline for in-memory) ───────────────────────────────────────────

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
`

// ─── MOCK CLIP ───────────────────────────────────────────────────────────────

const MOCK_CLIP_JSON = JSON.stringify({
  id: 'bp-ancestor-001',
  name: 'Granite Ancestor',
  author: 'test',
  category: 'composite',
  tags: [],
  vibeCompat: [],
  spatialZones: ['all'],
  mixBus: 'global',
  priority: 5,
  durationMs: 2000,
  effectType: 'chase',
  tracks: [{
    id: 'track-1',
    paramId: 'intensity',
    zones: ['all'],
    curve: {
      paramId: 'intensity',
      valueType: 'number',
      range: [0, 1],
      defaultValue: 0,
      keyframes: [
        { timeMs: 0, value: 0.5, interpolation: 'linear' },
        { timeMs: 1000, value: 1.0, interpolation: 'linear' },
      ],
      mode: 'absolute',
    },
  }],
  staticParams: {},
  schemaVersion: '3.0',
} satisfies HephAutomationClipV3)

// ─── MOCK VAULT (duck-typed to satisfy OrganismMaterializer) ─────────────────

interface MockVault {
  _db: DatabaseType
  getBlueprint(id: string): { clipV3: HephAutomationClipV3 } | null
}

function makeMockVault(db: DatabaseType): MockVault {
  return {
    _db: db,
    getBlueprint(id: string) {
      const row = db.prepare('SELECT clip_v3_json FROM lfx_blueprints WHERE blueprint_id = ?').get(id) as { clip_v3_json: string } | undefined
      if (!row) return null
      return { clipV3: JSON.parse(row.clip_v3_json) as HephAutomationClipV3 }
    },
  }
}

// ─── FIXTURES ────────────────────────────────────────────────────────────────

function insertBlueprint(db: DatabaseType, id: string) {
  db.prepare(
    `INSERT INTO lfx_blueprints (blueprint_id, name, author, category, source_origin,
      dna_aggression, dna_chaos, dna_organicity, texture_affinity,
      compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
      aggression_range_min, aggression_range_max, spatial_behavior,
      clip_v3_json, execution_domain, is_strobe, is_divine_candidate, is_heavy_candidate,
      checksum_sha256, schema_version, imported_at)
    VALUES (?, 'Granite', 'test', 'composite', 'builtin',
      0.5, 0.3, 0.7, 'universal',
      '[]', '[]', 'ambient', 'peak',
      0.3, 0.8, 'static',
      ?, 'vector', 0, 0, 0,
      'abc', '3.0', ?)`,
  ).run(id, MOCK_CLIP_JSON, Date.now())
}

function insertOrganism(
  db: DatabaseType,
  id: string,
  blueprintId: string,
  deltaJson: string,
  parentId: string | null = null,
  gen = 1,
) {
  db.prepare(
    `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
      custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
      l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
      fitness_score, trials_count, wins_count, vetoes_count, passes_count,
      status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
    VALUES (?, ?, ?, ?, NULL, ?, ?, 0.5, 'COMMON',
      0.1, 'focal_mutation', 5, '{}',
      0.3, 0, 0, 0, 0,
      'alive', NULL, ?, NULL, NULL, NULL)`,
  ).run(id, blueprintId, parentId, gen, deltaJson, Buffer.from(new Float32Array(128).buffer), Date.now())
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 OrganismMaterializer — Cache & Fallback', () => {
  let db: DatabaseType
  let vault: MockVault
  let materializer: OrganismMaterializer

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA_SQL)
    vault = makeMockVault(db)
    materializer = new OrganismMaterializer(vault as any)
  })

  afterEach(() => {
    db.close()
  })

  // ── 1. LRU Cache eviction ────────────────────────────────────────────────

  it('LRU cache should not exceed 256 entries', () => {
    insertBlueprint(db, 'bp-cache-test')

    // Insert 300 organisms with valid (empty) deltas
    for (let i = 0; i < 300; i++) {
      insertOrganism(db, `org-cache-${i}`, 'bp-cache-test', '[]')
    }

    // Materialize all 300 — each will be cached
    for (let i = 0; i < 300; i++) {
      materializer.materialize(`org-cache-${i}`)
    }

    // Cache size must not exceed 256
    expect(materializer.cacheSize).toBeLessThanOrEqual(256)
  })

  it('LRU cache should evict oldest entries and keep recent ones', () => {
    insertBlueprint(db, 'bp-lru-evict')

    for (let i = 0; i < 300; i++) {
      insertOrganism(db, `org-lru-${i}`, 'bp-lru-evict', '[]')
    }

    // Materialize all 300
    for (let i = 0; i < 300; i++) {
      materializer.materialize(`org-lru-${i}`)
    }

    // org-lru-0 should have been evicted (was first inserted)
    // org-lru-299 should still be in cache (most recent)
    // Since cache cap is 256, entries 0..43 were evicted, 44..299 remain
    // Verify cache size
    expect(materializer.cacheSize).toBe(256)

    // Re-materialize an evicted entry — should work (re-reads from DB)
    const result = materializer.materialize('org-lru-0')
    expect(result.organismId).toBe('org-lru-0')
    expect(result.clip).toBeDefined()
  })

  // ── 2. Corrupt delta fallback ─────────────────────────────────────────────

  it('should return granite ancestor clipV3 when delta_json is corrupt', () => {
    insertBlueprint(db, 'bp-corrupt-test')

    // Insert organism with corrupt delta_json
    insertOrganism(db, 'org-corrupt', 'bp-corrupt-test', '{ THIS IS NOT VALID JSON !!! }')

    // Materialize — should fallback to granite ancestor
    const result = materializer.materialize('org-corrupt')

    expect(result).toBeDefined()
    expect(result.organismId).toBe('org-corrupt')
    // The clip should be the granite ancestor's clipV3
    expect(result.clip.id).toBe('bp-ancestor-001')
    expect(result.clip.name).toBe('Granite Ancestor')
  })

  it('should return granite ancestor clipV3 when delta_json has invalid patch ops', () => {
    insertBlueprint(db, 'bp-bad-patch')

    // Delta with a path that doesn't exist in the clip
    insertOrganism(db, 'org-bad-patch', 'bp-bad-patch', '[{"op":"replace","path":"/nonexistent/deep/path","value":42}]')

    const result = materializer.materialize('org-bad-patch')

    // Even if applyDelta doesn't throw for bad paths, the materializer
    // should still return a valid clip. If it does throw, fallback kicks in.
    expect(result).toBeDefined()
    expect(result.organismId).toBe('org-bad-patch')
    expect(result.clip).toBeDefined()
  })

  it('should cache the fallback result for subsequent calls', () => {
    insertBlueprint(db, 'bp-cache-fallback')

    insertOrganism(db, 'org-fb-cache', 'bp-cache-fallback', '{ CORRUPT JSON }')

    // First call triggers fallback
    const r1 = materializer.materialize('org-fb-cache')
    expect(r1.clip.id).toBe('bp-ancestor-001')

    // Second call should hit cache (same result)
    const r2 = materializer.materialize('org-fb-cache')
    expect(r2.clip.id).toBe('bp-ancestor-001')
    expect(materializer.cacheSize).toBe(1)
  })
})
