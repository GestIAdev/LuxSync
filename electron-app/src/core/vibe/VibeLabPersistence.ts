/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💾 VibeLabPersistence.ts — Atomic .luxvibe read/write
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Lectura/escritura atómica de archivos .luxvibe en userData/vibes/.
 * Espejo del patrón de StagePersistence:
 *   1. Write to .tmp
 *   2. Rename .tmp → target (atomic on most filesystems)
 *
 * @module core/vibe/VibeLabPersistence
 * @version FASE 4.3
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import * as path from 'path'
import type { CustomVibeOverride, CustomVibeKey, CustomVibeMeta } from '../../types/CustomVibe'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface VibeVaultEntry {
  key: CustomVibeKey
  meta: CustomVibeMeta
  filename: string
  fullPath: string
  sizeBytes: number
  modifiedAt: string
}

export interface VibeSaveResult {
  ok: boolean
  path?: string
  error?: string
}

export interface VibeReadResult {
  ok: boolean
  data?: CustomVibeOverride
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// PATH HELPERS
// ═══════════════════════════════════════════════════════════════════════════

let _vibesDir: string | null = null

function getVibesDir(): string {
  if (_vibesDir) return _vibesDir
  _vibesDir = path.join(app.getPath('userData'), 'vibes')
  if (!fs.existsSync(_vibesDir)) {
    fs.mkdirSync(_vibesDir, { recursive: true })
  }
  return _vibesDir
}

/** Convierte una CustomVibeKey a nombre de archivo seguro. */
function keyToFilename(key: CustomVibeKey): string {
  // 'custom:dubstep-cathedral-a1b2' → 'dubstep-cathedral-a1b2.luxvibe'
  const slug = key.replace(/^custom:/, '')
  return `${slug}.luxvibe`
}

/** Convierte un nombre de archivo a CustomVibeKey. */
function filenameToKey(filename: string): CustomVibeKey {
  const slug = filename.replace(/\.luxvibe$/, '')
  return `custom:${slug}` as CustomVibeKey
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

class VibeLabPersistence {
  /**
   * Lista todos los .luxvibe en userData/vibes/.
   */
  async list(): Promise<VibeVaultEntry[]> {
    const dir = getVibesDir()
    try {
      const files = await fsp.readdir(dir)
      const luxvibeFiles = files.filter((f) => f.endsWith('.luxvibe'))

      const entries: VibeVaultEntry[] = []
      for (const filename of luxvibeFiles) {
        const fullPath = path.join(dir, filename)
        try {
          const stat = await fsp.stat(fullPath)
          const content = await fsp.readFile(fullPath, 'utf-8')
          const data = JSON.parse(content) as CustomVibeOverride
          entries.push({
            key: filenameToKey(filename),
            meta: data.meta ?? { name: filename, author: 'unknown', key: filenameToKey(filename) },
            filename,
            fullPath,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          })
        } catch {
          // Skip malformed files
        }
      }
      return entries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    } catch {
      return []
    }
  }

  /**
   * Lee un .luxvibe específico por key.
   */
  async read(key: CustomVibeKey): Promise<VibeReadResult> {
    const dir = getVibesDir()
    const filename = keyToFilename(key)
    const fullPath = path.join(dir, filename)
    try {
      const content = await fsp.readFile(fullPath, 'utf-8')
      const data = JSON.parse(content) as CustomVibeOverride
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: `Failed to read ${filename}: ${err}` }
    }
  }

  /**
   * Guarda un CustomVibeOverride a disco (escritura atómica).
   */
  async save(data: CustomVibeOverride): Promise<VibeSaveResult> {
    const dir = getVibesDir()
    const filename = keyToFilename(data.meta.key)
    const targetPath = path.join(dir, filename)
    const tempPath = targetPath + '.tmp'

    try {
      const content = JSON.stringify(data, null, 2)
      await fsp.writeFile(tempPath, content, 'utf-8')
      await fsp.rename(tempPath, targetPath)
      return { ok: true, path: targetPath }
    } catch (err) {
      // Clean up orphan temp
      try { await fsp.unlink(tempPath) } catch { /* best effort */ }
      return { ok: false, error: `Failed to save: ${err}` }
    }
  }

  /**
   * Elimina un .luxvibe por key.
   */
  async delete(key: CustomVibeKey): Promise<VibeSaveResult> {
    const dir = getVibesDir()
    const filename = keyToFilename(key)
    const fullPath = path.join(dir, filename)
    try {
      await fsp.unlink(fullPath)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: `Failed to delete: ${err}` }
    }
  }

  /**
   * Exporta un .luxvibe a una ruta elegida por el usuario (diálogo).
   */
  async exportToPath(data: CustomVibeOverride, outputPath: string): Promise<VibeSaveResult> {
    try {
      const content = JSON.stringify(data, null, 2)
      await fsp.writeFile(outputPath, content, 'utf-8')
      return { ok: true, path: outputPath }
    } catch (err) {
      return { ok: false, error: `Export failed: ${err}` }
    }
  }

  /**
   * Importa un .luxvibe desde una ruta externa al vault.
   * Genera una nueva key única para evitar colisiones.
   */
  async importFromPath(sourcePath: string): Promise<VibeReadResult> {
    try {
      const content = await fsp.readFile(sourcePath, 'utf-8')
      const data = JSON.parse(content) as CustomVibeOverride
      // Regenerar key con hash del nombre + timestamp para evitar colisiones
      const slug = (data.meta?.name ?? 'imported')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
      const hash = Date.now().toString(36).slice(-6)
      const newKey = `custom:${slug}-${hash}` as CustomVibeKey
      data.meta = { ...data.meta, key: newKey }
      // Guardar en el vault
      const saveResult = await this.save(data)
      if (!saveResult.ok) {
        return { ok: false, error: saveResult.error }
      }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: `Import failed: ${err}` }
    }
  }
}

/** Singleton de persistencia. */
export const vibeLabPersistence = new VibeLabPersistence()
