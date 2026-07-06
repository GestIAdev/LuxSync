// ═══════════════════════════════════════════════════════════════════════════
// 🧬 WAVE 5000.V3 — ERA II: Organism Materializer
// ═══════════════════════════════════════════════════════════════════════════
//  Lazy materialization of organisms from the Genesis Vault.
//  Reconstructs the full HephAutomationClipV3 by applying the chain of
//  delta_json operations from ancestor → parent → child.
//
//  LRU cache (Map-based, capacity 256) avoids re-computation in the hot path.
//
//  FALBACK SAGRADO:
//    If any delta application or parse error occurs, the materializer
//    catches the exception and returns the granite ancestor's clipV3 intact.
//    The operator never sees a lost frame.
// ═══════════════════════════════════════════════════════════════════════════

import type { HephAutomationClipV3 } from '../hephaestus/types'
import type { GenesisVaultService } from './GenesisVaultService'
import { getGenesisVault } from './GenesisVaultService'
import { applyDelta, type JsonPatchOp } from './operators/GeneticOperators'
import { generateOrganismName } from './naming/ProceduralNamer'
import type { RarityTier, MutationOperator, OrganismStatus } from './types'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface MaterializedOrganism {
  organismId: string
  clip: HephAutomationClipV3
  materializedAt: number
  parentOrganismIdSecondary?: string | null
}

// ─── LRU CACHE (Map-based, bounded) ─────────────────────────────────────────

const LRU_MAX_SIZE = 256

class LruCache<K, V> {
  private _map = new Map<K, V>()
  private readonly _max: number

  constructor(max: number) {
    this._max = max
  }

  get(key: K): V | undefined {
    const val = this._map.get(key)
    if (val !== undefined) {
      // Move to end (most recently used)
      this._map.delete(key)
      this._map.set(key, val)
    }
    return val
  }

  set(key: K, val: V): void {
    if (this._map.has(key)) {
      this._map.delete(key)
    } else if (this._map.size >= this._max) {
      // Evict oldest (first entry)
      const oldest = this._map.keys().next().value
      if (oldest !== undefined) this._map.delete(oldest)
    }
    this._map.set(key, val)
  }

  has(key: K): boolean {
    return this._map.has(key)
  }

  clear(): void {
    this._map.clear()
  }

  get size(): number {
    return this._map.size
  }
}

// ─── ORGANISM ROW (from DB) ─────────────────────────────────────────────────

interface OrganismRow {
  organism_id: string
  blueprint_id: string
  parent_organism_id: string | null
  parent_organism_id_secondary: string | null
  generation: number
  delta_json: string
  status: string
  custom_name: string | null
  rarity_score: number
  rarity_tier: string
  l2_distance_parent: number
  operator_used: string
  fitness_score: number
  trials_count: number
  passes_count: number
  neonatal_shield_until: number
  species_id: string | null
}

// ─── MATERIALIZER ───────────────────────────────────────────────────────────

export class OrganismMaterializer {
  private readonly _cache = new LruCache<string, MaterializedOrganism>(LRU_MAX_SIZE)
  private readonly _vault: GenesisVaultService

  constructor(vault?: GenesisVaultService) {
    this._vault = vault ?? getGenesisVault()
  }

  /**
   * Materializes an organism into a full HephAutomationClipV3.
   *
   * - Cache hit → O(1) return.
   * - Cache miss → reads organism from DB, recursively materializes parent
   *   (or falls back to granite ancestor), applies delta chain.
   *
   * Fallback defensivo: on ANY error, returns the granite ancestor's clipV3.
   */
  materialize(organismId: string): MaterializedOrganism {
    // Cache hit
    const hit = this._cache.get(organismId)
    if (hit) return hit

    try {
      const org = this._fetchOrganism(organismId)
      if (!org) {
        throw new Error(`Organism not found: ${organismId}`)
      }

      // Resolve parent clip
      let parentClip: HephAutomationClipV3

      if (org.parent_organism_id) {
        // Recursively materialize parent (bounded by generation ≤ 16)
        const parentMat = this.materialize(org.parent_organism_id)
        parentClip = parentMat.clip
      } else {
        // Direct descendant of granite ancestor
        const blueprint = this._vault.getBlueprint(org.blueprint_id)
        if (!blueprint) {
          throw new Error(`Blueprint not found: ${org.blueprint_id}`)
        }
        parentClip = blueprint.clipV3
      }

      // Apply delta
      const delta = JSON.parse(org.delta_json) as JsonPatchOp[]
      const childClip = applyDelta(parentClip, delta)

      // 🧬 WAVE 5000.V3 FIX: Assign unique identity to the materialized clip.
      // Without this, the child's clip.id collides with the blueprint ancestor's
      // id in DynamicEffectRegistry, causing the child to overwrite the parent
      // instead of coexisting as a competing candidate.
      childClip.id = organismId

      // 🧬 WAVE 5000.V3 FIX: Ensure cognitiveDNA is preserved from the ancestor.
      // applyDelta deep-clones the parent, so cognitiveDNA should survive — but
      // if a delta op removed it, we restore it from the parent to guarantee
      // the clip passes registerEffectV3()'s DNA gate.
      if (!childClip.cognitiveDNA && parentClip.cognitiveDNA) {
        childClip.cognitiveDNA = JSON.parse(JSON.stringify(parentClip.cognitiveDNA))
      }

      // 🧬 WAVE 5000.V3 BAPTISM: Assign a readable name to the materialized clip.
      // If the organism has a custom_name (e.g. champion baptized), use it.
      // Otherwise, generate a procedural name on the fly for arena display.
      if (org.custom_name) {
        childClip.name = org.custom_name
      } else {
        childClip.name = generateOrganismName({
          organismId: org.organism_id,
          blueprintId: org.blueprint_id,
          parentOrganismId: org.parent_organism_id,
          generation: org.generation,
          customName: null,
          deltaJson: org.delta_json,
          bezierSignature: new Float32Array(0),
          rarityScore: org.rarity_score,
          rarityTier: org.rarity_tier as RarityTier,
          l2DistanceParent: org.l2_distance_parent,
          operatorUsed: org.operator_used as MutationOperator,
          neonatalShieldUntil: org.neonatal_shield_until,
          birthVector: { zScoreAvg3s: 0, lowBandAvg3s: 0, energyPhaseEncoded: 0, vibeHash: 0, sectionEncoded: 0, textureEncoded: 0 },
          fitnessScore: org.fitness_score,
          trialsCount: org.trials_count,
          winsCount: 0, vetoesCount: 0, passesCount: org.passes_count,
          status: org.status as OrganismStatus,
          speciesId: org.species_id,
          bornAt: 0, lastEvaluatedAt: null, lastFiredAt: null,
          swarmOriginConsole: null,
        })
      }

      const result: MaterializedOrganism = {
        organismId,
        clip: childClip,
        materializedAt: Date.now(),
        parentOrganismIdSecondary: org.parent_organism_id_secondary ?? null,
      }

      this._cache.set(organismId, result)
      return result
    } catch (err) {
      // FALLBACK SAGRADO — return granite ancestor
      console.warn(`[OrganismMaterializer ⚠️] Fallback to ancestor for ${organismId}:`, err)

      try {
        const org = this._fetchOrganism(organismId)
        if (org) {
          const blueprint = this._vault.getBlueprint(org.blueprint_id)
          if (blueprint) {
            const fallbackClip: HephAutomationClipV3 = JSON.parse(JSON.stringify(blueprint.clipV3))
            fallbackClip.id = organismId
            if (org.custom_name) {
              fallbackClip.name = org.custom_name
            }
            const fallback: MaterializedOrganism = {
              organismId,
              clip: fallbackClip,
              materializedAt: Date.now(),
            }
            this._cache.set(organismId, fallback)
            return fallback
          }
        }
      } catch {
        // Double failure — rethrow original
      }

      throw err
    }
  }

  /**
   * Clears the materialization cache.
   */
  clearCache(): void {
    this._cache.clear()
  }

  /**
   * Returns current cache size (for telemetry).
   */
  get cacheSize(): number {
    return this._cache.size
  }

  // ─── INTERNALS ───────────────────────────────────────────────────────────

  private _fetchOrganism(organismId: string): OrganismRow | null {
    const db = (this._vault as any)._db
    if (!db) {
      throw new Error('GenesisVault not initialized')
    }
    const row = db.prepare(
      `SELECT organism_id, blueprint_id, parent_organism_id,
              parent_organism_id_secondary, generation,
              delta_json, status, custom_name, rarity_score, rarity_tier,
              l2_distance_parent, operator_used, fitness_score, trials_count,
              passes_count, neonatal_shield_until, species_id
       FROM lfx_organisms WHERE organism_id = ?`,
    ).get(organismId) as OrganismRow | undefined
    return row ?? null
  }
}

// ─── SINGLETON ──────────────────────────────────────────────────────────────

let _instance: OrganismMaterializer | null = null

export function getOrganismMaterializer(): OrganismMaterializer {
  if (_instance == null) _instance = new OrganismMaterializer()
  return _instance
}

export function __resetOrganismMaterializerForTests(): void {
  _instance = null
}
