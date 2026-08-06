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
 *
 * @module core/vibe/VibeLabIPCHandlers
 * @version FASE 4.3
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { vibeLabPersistence } from './VibeLabPersistence'
import type { CustomVibeKey, CustomVibeOverride } from '../../types/CustomVibe'

const CHANNEL = {
  LIST: 'vibeLab:list',
  READ: 'vibeLab:read',
  SAVE: 'vibeLab:save',
  DELETE: 'vibeLab:delete',
  EXPORT: 'vibeLab:export',
  IMPORT: 'vibeLab:import',
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

  console.log('[VibeLabIPCHandlers] ✅ Registered 6 IPC channels')
}

/** Nombres de canal expuestos para que preload.ts los consuma. */
export const VIBE_LAB_IPC_CHANNELS = CHANNEL
