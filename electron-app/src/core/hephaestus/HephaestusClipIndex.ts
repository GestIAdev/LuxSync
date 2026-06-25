/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS CLIP INDEX — O(1) In-Memory Index for .lfx Clips
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FASE 1 — Creación del índice.
 *
 * Singleton en el main process que mantiene dos Map<> para búsquedas
 * instantáneas por ID o por filePath. Reemplaza los escaneos lineales
 * O(N) de HephFileIO y el fs.readFileSync de HephaestusRuntime.
 *
 * @module core/hephaestus/HephaestusClipIndex
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  HephAutomationClip,
  HephAutomationClipV3,
  HephAutomationClipSerialized,
} from './types'
import { deserializeHephClip } from './types'
import type { HephClipMetadata } from './HephFileIO'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HephSchemaVersion = 'hephaestus/v1' | 'hephaestus/v2.1' | 'luxsync.lfx/3.0'

export interface LoadedClip {
  id: string
  filePath: string
  schemaVersion: HephSchemaVersion
  metadata: HephClipMetadata
  clip: HephAutomationClip | HephAutomationClipV3
  modifiedAt: number
  source: 'builtin' | 'user'
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Discriminador de tipo en runtime para distinguir V2 (curves: Map) de V3 (tracks: []).
 */
function _isV3(clip: HephAutomationClip | HephAutomationClipV3): clip is HephAutomationClipV3 {
  return (clip as HephAutomationClipV3).tracks !== undefined
}

/**
 * Construye un objeto HephClipMetadata a partir de un clip V2 o V3.
 */
function _buildMetadata(
  clip: HephAutomationClip | HephAutomationClipV3,
  filePath: string,
  modifiedAt: number,
): HephClipMetadata {
  if (_isV3(clip)) {
    return {
      id: clip.id,
      name: clip.name,
      author: clip.author,
      category: clip.category,
      tags: [...clip.tags],
      durationMs: clip.durationMs,
      effectType: clip.effectType,
      paramCount: clip.tracks.length,
      filePath,
      modifiedAt,
    }
  }
  return {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags: [...clip.tags],
    durationMs: clip.durationMs,
    effectType: clip.effectType,
    paramCount: clip.curves.size,
    filePath,
    modifiedAt,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON CLASS
// ═══════════════════════════════════════════════════════════════════════════

class HephaestusClipIndex {
  private readonly _byId = new Map<string, LoadedClip>()
  private readonly _byPath = new Map<string, LoadedClip>()

  // ── O(1) Lookups (synchronous) ──────────────────────────────────────────

  public getById(id: string): LoadedClip | undefined {
    return this._byId.get(id)
  }

  public getByPath(filePath: string): LoadedClip | undefined {
    return this._byPath.get(filePath)
  }

  public getAllMetadata(): HephClipMetadata[] {
    const result: HephClipMetadata[] = []
    for (const loaded of this._byId.values()) {
      result.push(loaded.metadata)
    }
    return result
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  public remove(id: string): void {
    const loaded = this._byId.get(id)
    if (!loaded) return
    this._byId.delete(id)
    this._byPath.delete(loaded.filePath)
  }

  public clear(): void {
    this._byId.clear()
    this._byPath.clear()
  }

  // ── Async Ingest ────────────────────────────────────────────────────────

  /**
   * Lee, parsea y valida un archivo .lfx desde disco de forma asíncrona
   * (no bloqueante). Inserta el resultado en ambos mapas.
   *
   * @returns El `LoadedClip` si tuvo éxito, `null` si falló.
   */
  public async upsert(
    filePath: string,
    source: 'builtin' | 'user',
  ): Promise<LoadedClip | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      if (!raw || raw.trim().length === 0) {
        console.error(`[HephClipIndex] ❌ Empty file: ${filePath}`)
        return null
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>
      const schema = parsed?.$schema as string | undefined

      let clip: HephAutomationClip | HephAutomationClipV3 | null = null
      let schemaVersion: HephSchemaVersion

      // ── V3 PATH ────────────────────────────────────────────────────────
      if (schema === 'luxsync.lfx/3.0' && parsed?.clip && typeof parsed.clip === 'object') {
        const v3 = parsed.clip as HephAutomationClipV3
        if (!Array.isArray(v3.tracks) || v3.tracks.length === 0) {
          console.error(`[HephClipIndex] ❌ V3 clip in ${filePath} has no tracks[]`)
          return null
        }
        for (const t of v3.tracks) {
          if (!t || typeof t !== 'object' || !t.curve || !Array.isArray(t.curve.keyframes)) {
            console.error(`[HephClipIndex] ❌ Invalid V3 track in ${filePath}: missing curve/keyframes`)
            return null
          }
          if (!Array.isArray(t.zones) || t.zones.length === 0) {
            console.error(`[HephClipIndex] ❌ Invalid V3 track in ${filePath}: track '${t.id}' has no zones`)
            return null
          }
        }
        clip = v3
        schemaVersion = 'luxsync.lfx/3.0'
      } else {
        // ── V2.1 PATH (legacy curves Record) ──────────────────────────────
        let serialized: HephAutomationClipSerialized | null = null

        if (parsed?.clip && typeof parsed.clip === 'object') {
          serialized = parsed.clip as HephAutomationClipSerialized
        } else if (parsed?.curves && typeof parsed.curves === 'object') {
          serialized = parsed as unknown as HephAutomationClipSerialized
        } else {
          console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: no V3 tracks[] and no V2 curves{}`)
          return null
        }

        if (!serialized.curves || typeof serialized.curves !== 'object') {
          console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: missing or invalid curves`)
          return null
        }

        for (const [paramId, curve] of Object.entries(serialized.curves)) {
          if (!curve || typeof curve !== 'object') {
            console.error(`[HephClipIndex] ❌ Invalid curve '${paramId}' in ${filePath}: not an object`)
            return null
          }
          const hephCurve = curve as { keyframes?: unknown }
          if (!Array.isArray(hephCurve.keyframes)) {
            console.error(`[HephClipIndex] ❌ Invalid curve '${paramId}' in ${filePath}: keyframes is not an array`)
            return null
          }
        }

        const v2 = deserializeHephClip(serialized)
        if (!v2 || !v2.curves || v2.curves.size === 0) {
          console.error(`[HephClipIndex] ❌ Deserialization failed or empty curves in ${filePath}`)
          return null
        }
        clip = v2
        schemaVersion = schema === 'hephaestus/v2.1' ? 'hephaestus/v2.1' : 'hephaestus/v1'
      }

      if (!clip) return null

      // ── Stat for modifiedAt ──────────────────────────────────────────────
      let modifiedAt = Date.now()
      try {
        const stats = await fs.stat(filePath)
        modifiedAt = stats.mtimeMs
      } catch {
        // stat falló — usar Date.now() como fallback
      }

      // ── Build LoadedClip ─────────────────────────────────────────────────
      const metadata = _buildMetadata(clip, filePath, modifiedAt)
      const loaded: LoadedClip = {
        id: clip.id,
        filePath,
        schemaVersion,
        metadata,
        clip,
        modifiedAt,
        source,
      }

      // ── Upsert: si ya existía un clip con el mismo ID pero distinto path,
      //    eliminamos la entrada anterior del byPath para evitar stale entries.
      const existing = this._byId.get(clip.id)
      if (existing && existing.filePath !== filePath) {
        this._byPath.delete(existing.filePath)
      }

      this._byId.set(clip.id, loaded)
      this._byPath.set(filePath, loaded)

      return loaded
    } catch (err) {
      console.error(`[HephClipIndex] ❌ Failed to upsert ${filePath}:`, err)
      return null
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

let _instance: HephaestusClipIndex | null = null

export function getHephaestusClipIndex(): HephaestusClipIndex {
  if (_instance == null) _instance = new HephaestusClipIndex()
  return _instance
}

/** SOLO para tests: resetea el singleton y limpia los mapas. */
export function __resetHephaestusClipIndexForTests(): void {
  _instance?.clear()
  _instance = null
}

export type { HephClipMetadata } from './HephFileIO'
