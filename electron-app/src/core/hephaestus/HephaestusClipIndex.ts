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
import { computeLfxChecksum } from '../arsenal/LfxFileLoader'

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
  /** Declared SHA-256 checksum from the `.lfx` wrapper (propagated to the registry). */
  checksum: string
  modifiedAt: number
  source: 'builtin' | 'user'
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza un clip V3 en memoria para garantizar que todas las curvas
 * tengan `range` y `mode` — campos requeridos por HephCurve pero que
 * algunos archivos .lfx factory no incluyen.
 *
 * También asegura arrays a nivel clip (tags, vibeCompat, spatialZones).
 *
 * Mutates in-place. Safe to call on already-complete clips (no-op).
 */
function _normalizeClipCurves(clip: HephAutomationClipV3): void {
  if (!Array.isArray(clip.tags)) clip.tags = []
  if (!Array.isArray(clip.vibeCompat)) clip.vibeCompat = []
  if (!Array.isArray(clip.spatialZones)) clip.spatialZones = []
  if (!clip.staticParams) clip.staticParams = {}

  for (const track of clip.tracks) {
    const c = track.curve
    if (!c) continue

    if (!Array.isArray(c.range) || c.range.length !== 2) {
      c.range = c.valueType === 'color' ? [0, 360] : [0, 1]
    }
    if (!c.mode) {
      c.mode = 'absolute'
    }
  }
}

/**
 * Construye un objeto HephClipMetadata a partir de un clip V3.
 * WAVE 2524: Incluye vibeCompat (para filtrado por vibe en la UI) y
 * isBuiltin (para proteger clips factory del borrado).
 */
function _buildMetadata(
  clip: HephAutomationClipV3,
  filePath: string,
  modifiedAt: number,
  source: 'builtin' | 'user',
): HephClipMetadata {
  return {
    id: clip.id,
    name: clip.name,
    author: clip.author,
    category: clip.category,
    tags: [...clip.tags],
    vibeCompat: [...clip.vibeCompat],
    isBuiltin: source === 'builtin',
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
  private _changeListeners: Array<() => void> = []

  // ── Change Notification ─────────────────────────────────────────────

  /**
   * Register a callback fired whenever the index changes (upsert/remove/clear).
   * Used by the main process to push 'heph:index-updated' IPC events to the renderer.
   */
  public onDidChange(cb: () => void): () => void {
    this._changeListeners.push(cb)
    return () => {
      this._changeListeners = this._changeListeners.filter(fn => fn !== cb)
    }
  }

  private _notifyChange(): void {
    for (const cb of this._changeListeners) {
      try { cb() } catch { /* listener error — ignore */ }
    }
  }

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
    this._notifyChange()
  }

  public clear(): void {
    this._byId.clear()
    this._byPath.clear()
    this._notifyChange()
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
      let raw = await fs.readFile(filePath, 'utf-8')
      if (!raw || raw.trim().length === 0) {
        console.error(`[HephClipIndex] ❌ Empty file: ${filePath}`)
        return null
      }
      // Strip UTF-8 BOM (U+FEFF) if present — some editors save with BOM
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1)
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

      // ── G2: Checksum integrity (mirrors Chronos `.lux` LAZARUS B-4) ───────
      // A **wrong** checksum is a HARD ERROR (corruption detected) — refuse the
      // file. An **empty/missing** checksum is permitted (warning) so legacy /
      // migrated files can still load. The hash is computed over the RAW clip
      // payload as it appears on disk, BEFORE `_normalizeClipCurves` mutates it
      // (otherwise the hash would never match the on-disk signature).
      const declaredChecksum =
        typeof parsed.checksum === 'string' ? parsed.checksum : ''
      // WAVE 7520.1: Normalize `sha256:` prefix — builtins may store bare hex
      // while computeLfxChecksum() returns `sha256:<hex>`. Both are valid.
      const stripSha256Prefix = (s: string): string =>
        s.startsWith('sha256:') ? s.slice(7) : s
      if (declaredChecksum.length > 0) {
        const recomputed = computeLfxChecksum(parsed.clip)
        if (stripSha256Prefix(recomputed) !== stripSha256Prefix(declaredChecksum)) {
          console.error(
            `[HephClipIndex] ❌ Checksum mismatch (corruption detected) in ${filePath}: ` +
            `declared '${declaredChecksum}', recomputed '${recomputed}'`,
          )
          return null
        }
      } else {
        console.warn(
          `[HephClipIndex] ⚠️ Missing checksum in ${filePath} — allowed for ` +
          `legacy migration; re-save to embed an integrity signature.`,
        )
      }

      // ── Normalize: ensure all curves have range and mode ────────────────
      _normalizeClipCurves(clip)

      // ── Stat for modifiedAt ──────────────────────────────────────────────
      let modifiedAt = Date.now()
      try {
        const stats = await fs.stat(filePath)
        modifiedAt = stats.mtimeMs
      } catch {
        // stat falló — usar Date.now() como fallback
      }

      // ── Build LoadedClip ─────────────────────────────────────────────────
      const metadata = _buildMetadata(clip, filePath, modifiedAt, source)
      const loaded: LoadedClip = {
        id: clip.id,
        filePath,
        schemaVersion,
        metadata,
        clip,
        checksum: declaredChecksum,
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

      this._notifyChange()

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
