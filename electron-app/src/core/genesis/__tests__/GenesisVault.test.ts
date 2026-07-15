// ═══════════════════════════════════════════════════════════════════════════
// 🧪 WAVE 5000.V3 — ERA VI: CRASH TEST — GenesisVault Persistence & Immutability
// ═══════════════════════════════════════════════════════════════════════════
//  Tests:
//  1. Blueprint Immutability — UPDATE trigger aborts
//  2. Generation Cap — generation=17 rejected
//  3. Lineage Trigger — trg_org_lineage_path populates lineage_tree
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

// ─── SCHEMA (inline copy from GenesisVaultService for in-memory tests) ───────

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

CREATE TRIGGER IF NOT EXISTS lfx_blueprints_immutable
BEFORE UPDATE ON lfx_blueprints
BEGIN
  SELECT RAISE(ABORT, 'Ancestro de granito. Inmutable. Usa lfx_organisms para evolucionar.');
END;

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
`

// ─── FIXTURE ─────────────────────────────────────────────────────────────────

function makeBlueprintPayload(id: string) {
  return {
    blueprint_id: id,
    name: `Test ${id}`,
    author: 'test',
    category: 'utility',
    source_origin: 'builtin',
    dna_aggression: 0.5,
    dna_chaos: 0.3,
    dna_organicity: 0.7,
    texture_affinity: 'universal',
    compatible_vibes: '["techno-club"]',
    valid_sections: '["drop"]',
    energy_zone_min: 'ambient',
    energy_zone_max: 'peak',
    aggression_range_min: 0.3,
    aggression_range_max: 0.8,
    spatial_behavior: 'static',
    clip_v3_json: '{"id":"test","tracks":[]}',
    execution_domain: 'vector',
    is_strobe: 0,
    is_divine_candidate: 0,
    is_heavy_candidate: 0,
    checksum_sha256: 'abc123',
    schema_version: '3.0',
    imported_at: Date.now(),
  }
}

function makeOrganismPayload(id: string, blueprintId: string, generation = 1, parentId: string | null = null) {
  return {
    organism_id: id,
    blueprint_id: blueprintId,
    parent_organism_id: parentId,
    generation,
    custom_name: null,
    delta_json: '[]',
    bezier_signature: Buffer.from(new Float32Array(128).buffer),
    rarity_score: 0.5,
    rarity_tier: 'COMMON',
    l2_distance_parent: 0.1,
    operator_used: 'focal_mutation',
    neonatal_shield_until: 5,
    birth_vector_json: '{"zScoreAvg3s":0,"lowBandAvg3s":0,"energyPhaseEncoded":0,"vibeHash":0,"sectionEncoded":0,"textureEncoded":0}',
    fitness_score: 0.3,
    trials_count: 0,
    wins_count: 0,
    vetoes_count: 0,
    passes_count: 0,
    status: 'alive',
    species_id: null,
    born_at: Date.now(),
    last_evaluated_at: null,
    last_fired_at: null,
    swarm_origin_console: null,
  }
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe('🧬 GenesisVault — Persistence & Immutability', () => {
  let db: DatabaseType

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA_SQL)
  })

  afterEach(() => {
    db.close()
  })

  // ── 1. Immutability ──────────────────────────────────────────────────────

  it('should ABORT on UPDATE to lfx_blueprints (granite ancestor is immutable)', () => {
    // Insert a blueprint
    db.prepare(
      `INSERT INTO lfx_blueprints (blueprint_id, name, author, category, source_origin,
        dna_aggression, dna_chaos, dna_organicity, texture_affinity,
        compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
        aggression_range_min, aggression_range_max, spatial_behavior,
        clip_v3_json, execution_domain, is_strobe, is_divine_candidate, is_heavy_candidate,
        checksum_sha256, schema_version, imported_at)
      VALUES (@blueprint_id, @name, @author, @category, @source_origin,
        @dna_aggression, @dna_chaos, @dna_organicity, @texture_affinity,
        @compatible_vibes, @valid_sections, @energy_zone_min, @energy_zone_max,
        @aggression_range_min, @aggression_range_max, @spatial_behavior,
        @clip_v3_json, @execution_domain, @is_strobe, @is_divine_candidate, @is_heavy_candidate,
        @checksum_sha256, @schema_version, @imported_at)`,
    ).run(makeBlueprintPayload('bp-test-001'))

    // Attempt UPDATE — should throw
    expect(() => {
      db.prepare('UPDATE lfx_blueprints SET name = ? WHERE blueprint_id = ?').run('HACKED', 'bp-test-001')
    }).toThrow()

    // Verify original name is intact
    const row = db.prepare('SELECT name FROM lfx_blueprints WHERE blueprint_id = ?').get('bp-test-001') as { name: string }
    expect(row.name).toBe('Test bp-test-001')
  })

  // ── 2. Generation Cap ─────────────────────────────────────────────────────

  it('should REJECT organism with generation=17 (cap is 16)', () => {
    // Insert prerequisite blueprint
    db.prepare(
      `INSERT INTO lfx_blueprints (blueprint_id, name, author, category, source_origin,
        dna_aggression, dna_chaos, dna_organicity, texture_affinity,
        compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
        aggression_range_min, aggression_range_max, spatial_behavior,
        clip_v3_json, execution_domain, is_strobe, is_divine_candidate, is_heavy_candidate,
        checksum_sha256, schema_version, imported_at)
      VALUES (@blueprint_id, @name, @author, @category, @source_origin,
        @dna_aggression, @dna_chaos, @dna_organicity, @texture_affinity,
        @compatible_vibes, @valid_sections, @energy_zone_min, @energy_zone_max,
        @aggression_range_min, @aggression_range_max, @spatial_behavior,
        @clip_v3_json, @execution_domain, @is_strobe, @is_divine_candidate, @is_heavy_candidate,
        @checksum_sha256, @schema_version, @imported_at)`,
    ).run(makeBlueprintPayload('bp-gen-test'))

    // Attempt to insert gen=17 — should throw
    expect(() => {
      db.prepare(
        `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
          custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
          l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
          fitness_score, trials_count, wins_count, vetoes_count, passes_count,
          status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
        VALUES (@organism_id, @blueprint_id, @parent_organism_id, @generation,
          @custom_name, @delta_json, @bezier_signature, @rarity_score, @rarity_tier,
          @l2_distance_parent, @operator_used, @neonatal_shield_until, @birth_vector_json,
          @fitness_score, @trials_count, @wins_count, @vetoes_count, @passes_count,
          @status, @species_id, @born_at, @last_evaluated_at, @last_fired_at, @swarm_origin_console)`,
      ).run(makeOrganismPayload('org-gen17', 'bp-gen-test', 17))
    }).toThrow()

    // Verify gen=16 is accepted
    db.prepare(
      `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
        custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
        l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
        fitness_score, trials_count, wins_count, vetoes_count, passes_count,
        status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
      VALUES (@organism_id, @blueprint_id, @parent_organism_id, @generation,
        @custom_name, @delta_json, @bezier_signature, @rarity_score, @rarity_tier,
        @l2_distance_parent, @operator_used, @neonatal_shield_until, @birth_vector_json,
        @fitness_score, @trials_count, @wins_count, @vetoes_count, @passes_count,
        @status, @species_id, @born_at, @last_evaluated_at, @last_fired_at, @swarm_origin_console)`,
    ).run(makeOrganismPayload('org-gen16', 'bp-gen-test', 16))

    const row = db.prepare('SELECT generation FROM lfx_organisms WHERE organism_id = ?').get('org-gen16') as { generation: number }
    expect(row.generation).toBe(16)
  })

  // ── 3. Lineage Trigger ─────────────────────────────────────────────────────

  it('should populate lineage_tree on organism insert (trg_org_lineage_path)', () => {
    // Insert blueprint
    db.prepare(
      `INSERT INTO lfx_blueprints (blueprint_id, name, author, category, source_origin,
        dna_aggression, dna_chaos, dna_organicity, texture_affinity,
        compatible_vibes, valid_sections, energy_zone_min, energy_zone_max,
        aggression_range_min, aggression_range_max, spatial_behavior,
        clip_v3_json, execution_domain, is_strobe, is_divine_candidate, is_heavy_candidate,
        checksum_sha256, schema_version, imported_at)
      VALUES (@blueprint_id, @name, @author, @category, @source_origin,
        @dna_aggression, @dna_chaos, @dna_organicity, @texture_affinity,
        @compatible_vibes, @valid_sections, @energy_zone_min, @energy_zone_max,
        @aggression_range_min, @aggression_range_max, @spatial_behavior,
        @clip_v3_json, @execution_domain, @is_strobe, @is_divine_candidate, @is_heavy_candidate,
        @checksum_sha256, @schema_version, @imported_at)`,
    ).run(makeBlueprintPayload('bp-lineage'))

    // Insert parent organism (gen 1, no parent)
    db.prepare(
      `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
        custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
        l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
        fitness_score, trials_count, wins_count, vetoes_count, passes_count,
        status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
      VALUES (@organism_id, @blueprint_id, @parent_organism_id, @generation,
        @custom_name, @delta_json, @bezier_signature, @rarity_score, @rarity_tier,
        @l2_distance_parent, @operator_used, @neonatal_shield_until, @birth_vector_json,
        @fitness_score, @trials_count, @wins_count, @vetoes_count, @passes_count,
        @status, @species_id, @born_at, @last_evaluated_at, @last_fired_at, @swarm_origin_console)`,
    ).run(makeOrganismPayload('org-parent', 'bp-lineage', 1, null))

    // Insert child organism (gen 2, parent = org-parent)
    db.prepare(
      `INSERT INTO lfx_organisms (organism_id, blueprint_id, parent_organism_id, generation,
        custom_name, delta_json, bezier_signature, rarity_score, rarity_tier,
        l2_distance_parent, operator_used, neonatal_shield_until, birth_vector_json,
        fitness_score, trials_count, wins_count, vetoes_count, passes_count,
        status, species_id, born_at, last_evaluated_at, last_fired_at, swarm_origin_console)
      VALUES (@organism_id, @blueprint_id, @parent_organism_id, @generation,
        @custom_name, @delta_json, @bezier_signature, @rarity_score, @rarity_tier,
        @l2_distance_parent, @operator_used, @neonatal_shield_until, @birth_vector_json,
        @fitness_score, @trials_count, @wins_count, @vetoes_count, @passes_count,
        @status, @species_id, @born_at, @last_evaluated_at, @last_fired_at, @swarm_origin_console)`,
    ).run(makeOrganismPayload('org-child', 'bp-lineage', 2, 'org-parent'))

    // Verify lineage_tree entries
    const parentLineage = db.prepare('SELECT * FROM lineage_tree WHERE organism_id = ?').get('org-parent') as {
      ancestor_path: string
      depth: number
      blueprint_id: string
    }
    expect(parentLineage).toBeDefined()
    expect(parentLineage.ancestor_path).toBe('org-parent')
    expect(parentLineage.depth).toBe(1)
    expect(parentLineage.blueprint_id).toBe('bp-lineage')

    const childLineage = db.prepare('SELECT * FROM lineage_tree WHERE organism_id = ?').get('org-child') as {
      ancestor_path: string
      depth: number
      blueprint_id: string
    }
    expect(childLineage).toBeDefined()
    expect(childLineage.ancestor_path).toBe('org-parent/org-child')
    expect(childLineage.depth).toBe(2)
  })
})
