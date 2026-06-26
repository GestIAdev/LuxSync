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
  HephAutomationClipV3,
} from './types'
import type { HephClipMetadata } from './HephFileIO'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type HephSchemaVersion = 'luxsync.lfx/3.0'

export interface LoadedClip {
  id: string
  filePath: string
  schemaVersion: HephSchemaVersion
  metadata: HephClipMetadata
  clip: HephAutomationClipV3
  modifiedAt: number
  source: 'builtin' | 'user'
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construye un objeto HephClipMetadata a partir de un clip V3.
 */
function _buildMetadata(
  clip: HephAutomationClipV3,
  filePath: string,
  modifiedAt: number,
): HephClipMetadata {
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

      let clip: HephAutomationClipV3 | null = null
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
        console.error(`[HephClipIndex] ❌ Invalid clip structure in ${filePath}: expected V3 schema 'luxsync.lfx/3.0' with tracks[]`)
        return null
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
