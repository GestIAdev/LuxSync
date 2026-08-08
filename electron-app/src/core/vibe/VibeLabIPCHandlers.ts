/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 VibeLabIPCHandlers.ts — IPC handlers for .luxvibe operations
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registra los handlers IPC para:
 *   - vibeLab:list
 *   - vibeLab:read
 *   - vibeLab:save
 *   - vibeLab:delete
 *   - vibeLab:export
 *   - vibeLab:import
 *   - lux:graft-vibe  (PROTEUS GRAFT — inject custom vibe into backend registries)
 *
 * @module core/vibe/VibeLabIPCHandlers
 * @version FASE 4.3 + PROTEUS GRAFT
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { vibeLabPersistence } from './VibeLabPersistence'
import type { CustomVibeKey, CustomVibeOverride, FusedVibeBundle } from '../../types/CustomVibe'
import { graft as graftToBackend, ungraftAll } from '../../engine/vibe/custom/VibeGraftRegistry'

const CHANNEL = {
  LIST: 'vibeLab:list',
  READ: 'vibeLab:read',
  SAVE: 'vibeLab:save',
  DELETE: 'vibeLab:delete',
  EXPORT: 'vibeLab:export',
  IMPORT: 'vibeLab:import',
  GRAFT_VIBE: 'lux:graft-vibe',
} as const

let _registered = false

/**
 * Registra todos los handlers IPC de VibeLab.
 * Idempotente: si ya están registrados, no hace nada.
 */
export function registerVibeLabIPCHandlers(): void {
  if (_registered) return
  _registered = true

  // ── LIST ────────────────────────────────────────────────────────────
  ipcMain.handle(CHANNEL.LIST, async () => {
    return vibeLabPersistence.list()
  })

  // ── READ ────────────────────────────────────────────────────────────
  ipcMain.handle(CHANNEL.READ, async (_evt, key: CustomVibeKey) => {
    return vibeLabPersistence.read(key)
  })

  // ── SAVE ────────────────────────────────────────────────────────────
  ipcMain.handle(CHANNEL.SAVE, async (_evt, data: CustomVibeOverride) => {
    return vibeLabPersistence.save(data)
  })

  // ── DELETE ──────────────────────────────────────────────────────────
  ipcMain.handle(CHANNEL.DELETE, async (_evt, key: CustomVibeKey) => {
    return vibeLabPersistence.delete(key)
  })

  // ── EXPORT (abre diálogo "save as") ─────────────────────────────────
  ipcMain.handle(CHANNEL.EXPORT, async (evt, data: CustomVibeOverride) => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export .luxvibe',
      defaultPath: `${(data.meta?.name ?? 'vibe').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.luxvibe`,
      filters: [{ name: 'LuxVibe File', extensions: ['luxvibe'] }],
    })
    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'Cancelled' }
    }
    return vibeLabPersistence.exportToPath(data, result.filePath)
  })

  // ── IMPORT (abre diálogo "open") ────────────────────────────────────
  ipcMain.handle(CHANNEL.IMPORT, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import .luxvibe',
      properties: ['openFile'],
      filters: [{ name: 'LuxVibe File', extensions: ['luxvibe'] }],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'Cancelled' }
    }
    return vibeLabPersistence.importFromPath(result.filePaths[0])
  })

  // ── PROTEUS GRAFT ───────────────────────────────────────────────────
  // 🧬 Inject a FusedVibeBundle into the MAIN PROCESS's copies of the 7
  // canonical registries (VIBE_REGISTRY, PROFILE_REGISTRY, etc.).
  //
  // The frontend's VibeGraftRegistry.graft() only mutates the RENDERER's
  // copies. When setVibe('custom:...') reaches the backend, VibeManager
  // calls normalizeVibeId() which checks `vibeId in VIBE_REGISTRY` — but
  // the backend's VIBE_REGISTRY doesn't have the custom key → 404 → idle.
  //
  // This handler grafts the bundle into the backend's registries so that
  // normalizeVibeId() finds the key and setActiveVibe() succeeds.
  ipcMain.handle(CHANNEL.GRAFT_VIBE, async (_evt, bundle: FusedVibeBundle) => {
    try {
      if (!bundle || typeof bundle !== 'object' || !bundle.key) {
        return { success: false, error: 'Invalid bundle: missing key' }
      }
      const ok = graftToBackend(bundle)
      if (!ok) {
        return { success: false, error: `Graft failed for key: ${bundle.key}` }
      }
      return { success: true }
    } catch (e) {
      console.error('[VibeLabIPCHandlers] lux:graft-vibe error:', e)
      return { success: false, error: String(e) }
    }
  })

  console.log('[VibeLabIPCHandlers] ✅ Registered 7 IPC channels (incl. PROTEUS GRAFT)')
}

/** Nombres de canal expuestos para que preload.ts los consuma. */
export const VIBE_LAB_IPC_CHANNELS = CHANNEL
