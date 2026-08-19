// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA I: THE GENESIS VAULT — Type Definitions
// ═══════════════════════════════════════════════════════════════════════════
//  Core types for the Selene Genesis Engine.
//  Re-exports arsenal types where possible to avoid duplication.
// ═══════════════════════════════════════════════════════════════════════════

import type { LFXFileV3 } from '../arsenal/lfxTypes'
import type { HephAutomationClipV3 } from '../hephaestus/types'

// ─── ENUMS / UNIONES ────────────────────────────────────────────────────────

export type RarityTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC'

export type OrganismStatus = 'alive' | 'champion' | 'culled' | 'quarantined' | 'canonized'

export type MutationOperator =
  | 'focal_mutation'
  | 'spatial_resonance'
  | 'gene_augmentation'
  | 'adaptive_pruning'
  | 'macro_splice'
  | 'crossover'
  | 'proportional_stretch'
  | 'curve_adaptation'
  | 'color_hue_shift'

export type SourceOrigin = 'hephaestus' | 'swarm' | 'builtin' | 'canonized'

// ─── GENOME TYPES (re-exported from arsenal) ────────────────────────────────

export type { FrozenGenome, TextureAffinity, SpatialBehavior } from '../arsenal/lfxTypes'
import type { FrozenGenome, TextureAffinity, SpatialBehavior } from '../arsenal/lfxTypes'

// ─── CONTEXT VECTOR ─────────────────────────────────────────────────────────

export interface ContextVector6D {
  readonly zScoreAvg3s: number
  readonly lowBandAvg3s: number
  readonly energyPhaseEncoded: number
  readonly vibeHash: number
  readonly sectionEncoded: number
  readonly textureEncoded: number
}

// ─── BLUEPRINT (Ancestro de Granito) ────────────────────────────────────────

/**
 * Immutable blueprint record as stored in `lfx_blueprints`.
 * The granite ancestor — never mutated after insertion.
 */
export interface LfxBlueprint {
  readonly blueprintId: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly sourceOrigin: SourceOrigin

  // ADN Germinal
  readonly dna: FrozenGenome
  readonly textureAffinity: TextureAffinity

  // ADN Regulador
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZoneMin: string
  readonly energyZoneMax: string
  readonly aggressionRangeMin: number
  readonly aggressionRangeMax: number
  readonly spatialBehavior: SpatialBehavior

  // ADN Somático
  readonly clipV3: HephAutomationClipV3
  readonly executionDomain: string

  // SimulationMeta
  readonly isStrobe: boolean
  readonly isDivineCandidate: boolean
  readonly isHeavyCandidate: boolean

  // Integrity
  readonly checksumSha256: string
  readonly schemaVersion: string
  readonly importedAt: number
}

/**
 * Row shape returned by SELECT queries on `lfx_blueprints`.
 * Maps 1:1 to the SQL columns.
 */
export interface BlueprintRow {
  readonly blueprint_id: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly source_origin: string
  readonly dna_aggression: number
  readonly dna_chaos: number
  readonly dna_organicity: number
  readonly texture_affinity: string
  readonly compatible_vibes: string
  readonly valid_sections: string
  readonly energy_zone_min: string
  readonly energy_zone_max: string
  readonly aggression_range_min: number
  readonly aggression_range_max: number
  readonly spatial_behavior: string
  readonly clip_v3_json: string
  readonly execution_domain: string
  readonly is_strobe: number
  readonly is_divine_candidate: number
  readonly is_heavy_candidate: number
  readonly checksum_sha256: string
  readonly schema_version: string
  readonly imported_at: number
}

// ─── ORGANISM (Descendiente Vivo) ───────────────────────────────────────────

/**
 * Mutable organism record as stored in `lfx_organisms`.
 * Each organism is a descendant carrying a delta from its parent.
 */
export interface LfxOrganism {
  readonly organismId: string
  readonly blueprintId: string
  readonly parentOrganismId: string | null
  readonly generation: number
  readonly customName: string | null

  readonly deltaJson: string
  readonly bezierSignature: Float32Array

  // Loot
  readonly rarityScore: number
  readonly rarityTier: RarityTier
  readonly l2DistanceParent: number
  readonly operatorUsed: MutationOperator
  readonly neonatalShieldUntil: number

  // Context
  readonly birthVector: ContextVector6D

  // Fitness
  fitnessScore: number
  trialsCount: number
  winsCount: number
  vetoesCount: number
  passesCount: number
  status: OrganismStatus
  speciesId: string | null

  readonly bornAt: number
  lastEvaluatedAt: number | null
  lastFiredAt: number | null
  readonly swarmOriginConsole: string | null
}

// ─── INGESTION HELPERS ──────────────────────────────────────────────────────

/**
 * Payload for inserting a blueprint into the vault.
 * Derived from a parsed `.lfx` V3 file.
 */
export interface BlueprintInsertPayload {
  readonly blueprintId: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly sourceOrigin: SourceOrigin
  readonly dnaAggression: number
  readonly dnaChaos: number
  readonly dnaOrganicity: number
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: string
  readonly validSections: string
  readonly energyZoneMin: string
  readonly energyZoneMax: string
  readonly aggressionRangeMin: number
  readonly aggressionRangeMax: number
  readonly spatialBehavior: SpatialBehavior
  readonly clipV3Json: string
  readonly executionDomain: string
  readonly isStrobe: number
  readonly isDivineCandidate: number
  readonly isHeavyCandidate: number
  readonly checksumSha256: string
  readonly schemaVersion: string
  readonly importedAt: number
}

/**
 * Result of an ancestral ingestion pass.
 */
export interface IngestionReport {
  readonly scanned: number
  readonly inserted: number
  readonly skipped: number
  readonly errors: number
  readonly insertedIds: readonly string[]
}
