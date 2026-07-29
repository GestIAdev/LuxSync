/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨ WAVE 4805: KEYFORGE — LOADOUT IPC HANDLERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two channels for portability of KeyForge profiles:
 *
 *   lux:keyforge:export  — opens native Save As dialog, writes JSON to disk
 *   lux:keyforge:import  — opens native Open dialog, reads JSON from disk
 *
 * Non-blocking contract: all file I/O uses `fs.promises` (async, no main-thread
 * stall). Dialog calls are inherently async in Electron.
 *
 * Security:
 *   - Export: file extension is forced to `.kf.json` by the dialog filter;
 *     the written content is only the validated loadout object passed from
 *     the renderer via contextBridge.
 *   - Import: the handler reads the chosen file and returns raw parsed JSON.
 *     Schema validation (version check) happens here in the main process so
 *     the renderer never receives malformed data that could break the store.
 *
 * Pattern: mirrors `setupStageIPCHandlers` in `core/stage/StageIPCHandlers.ts`.
 *
 * @module core/keyforge/KeyForgeIPCHandlers
 * @version WAVE 4805
 */

import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (mirrored here to avoid cross-process import of renderer types)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal structural check for an inbound loadout JSON.
 * The store's `importLoadout` trusts this shape; we validate here in main.
 */
interface KeyForgeLoadoutShape {
  id:        string
  name:      string
  version:   number
  createdAt: string
  updatedAt: string
  bindings:  Record<string, unknown>
  chords:    unknown[]
}

const SUPPORTED_VERSIONS = new Set([1])

function isValidLoadout(obj: unknown): obj is KeyForgeLoadoutShape {
  if (typeof obj !== 'object' || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    typeof o['id']        === 'string'
    && typeof o['name']   === 'string'
    && typeof o['version'] === 'number'
    && SUPPORTED_VERSIONS.has(o['version'] as number)
    && typeof o['createdAt'] === 'string'
    && typeof o['updatedAt'] === 'string'
    && typeof o['bindings']  === 'object' && o['bindings'] !== null
    && Array.isArray(o['chords'])
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register KeyForge Loadout IPC handlers.
 *
 * @param getMainWindow - Factory that returns the current main BrowserWindow
 *   (may be null during early boot; handlers gracefully return error then).
 */
export function setupKeyForgeIPCHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {

  // ─────────────────────────────────────────────────────────────────────────
  // lux:keyforge:export
  // Renderer sends a full KeyForgeLoadout object. We open a Save dialog and
  // write the JSON to the chosen file path using fs.promises (non-blocking).
  // ─────────────────────────────────────────────────────────────────────────
  ipcMain.handle('lux:keyforge:export', async (
    _event,
    loadout: KeyForgeLoadoutShape,
  ): Promise<{ success: boolean; filePath?: string; cancelled?: boolean; error?: string }> => {
    console.log(`[KeyForgeIPC] 📦 Export request for loadout: "${loadout?.name}"`)

    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' }
    }

    // Default output directory: userData/arsenal/ (unified storage)
    const defaultDir = path.join(app.getPath('userData'), 'arsenal')
    try {
      await fs.mkdir(defaultDir, { recursive: true })
    } catch {
      // Non-fatal — dialog will still work even if mkdir fails
    }

    const suggestedName = (loadout?.name ?? 'keyforge-profile')
      .replace(/[<>:"/\\|?*]/g, '-') // sanitize for fs
    const defaultPath = path.join(defaultDir, `${suggestedName}.kf.json`)

    const result = await dialog.showSaveDialog(mainWindow, {
      title:       'Export KeyForge Profile',
      defaultPath,
      filters:     [{ name: 'KeyForge Profiles', extensions: ['kf.json'] }],
      buttonLabel: 'Export',
    })

    if (result.canceled || !result.filePath) {
      console.log('[KeyForgeIPC] 📦 Export cancelled')
      return { success: false, cancelled: true }
    }

    const filePath = result.filePath
    try {
      await fs.writeFile(filePath, JSON.stringify(loadout, null, 2), 'utf-8')
      console.log(`[KeyForgeIPC] ✅ Loadout exported to: ${filePath}`)
      return { success: true, filePath }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[KeyForgeIPC] ❌ Export write failed:', msg)
      return { success: false, error: msg }
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // lux:keyforge:import
  // Open a file picker, read the chosen .kf.json, validate its schema, and
  // return the parsed object to the renderer. Validation happens here in
  // the main process — the renderer never sees a malformed payload.
  // ─────────────────────────────────────────────────────────────────────────
  ipcMain.handle('lux:keyforge:import', async (
    _event,
  ): Promise<{ success: boolean; loadout?: KeyForgeLoadoutShape; error?: string; cancelled?: boolean }> => {
    console.log('[KeyForgeIPC] 📥 Import request')

    const mainWindow = getMainWindow()
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' }
    }

    const defaultDir = path.join(app.getPath('userData'), 'arsenal')

    const result = await dialog.showOpenDialog(mainWindow, {
      title:       'Import KeyForge Profile',
      defaultPath: defaultDir,
      filters:     [{ name: 'KeyForge Profiles', extensions: ['kf.json'] }],
      buttonLabel: 'Import',
      properties:  ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[KeyForgeIPC] 📥 Import cancelled')
      return { success: false, cancelled: true }
    }

    const filePath = result.filePaths[0]
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed: unknown = JSON.parse(raw)

      if (!isValidLoadout(parsed)) {
        const msg = `Invalid or unsupported KeyForge loadout format in: ${path.basename(filePath)}`
        console.warn('[KeyForgeIPC] ⚠️', msg)
        return { success: false, error: msg }
      }

      console.log(`[KeyForgeIPC] ✅ Loadout imported: "${parsed.name}" (v${parsed.version})`)
      return { success: true, loadout: parsed }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[KeyForgeIPC] ❌ Import read/parse failed:', msg)
      return { success: false, error: msg }
    }
  })

  // KeyForgeIPC handlers registered log silenced
}
