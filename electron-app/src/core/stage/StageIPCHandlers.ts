/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 STAGE IPC HANDLERS - WAVE 365 Phase 5
 * "El Sistema Nervioso - Conectando Frontend y Backend"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * IPC handlers for Stage Constructor persistence operations.
 * 
 * Channels:
 * - lux:stage:load      - Load a show file
 * - lux:stage:save      - Save current show
 * - lux:stage:saveAs    - Save show with new name
 * - lux:stage:list      - List all shows
 * - lux:stage:delete    - Delete a show
 * - lux:stage:recent    - Get recent shows
 * - lux:stage:getPath   - Get shows folder path
 * 
 * @module core/stage/StageIPCHandlers
 * @version 365.0.0
 */

import { ipcMain, BrowserWindow } from 'electron'
import { stagePersistence } from './StagePersistence'
import type { ShowFileV2 } from './ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all Stage-related IPC handlers
 */
export function setupStageIPCHandlers(getMainWindow: () => BrowserWindow | null): void {
  console.log('[StageIPC] Setting up Stage Constructor IPC handlers (WAVE 365)')

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Load a show file
   * @param path - Optional path to show file. If not provided, loads active show.
   */
  ipcMain.handle('lux:stage:load', async (_event, filePath?: string) => {
    console.log('[StageIPC] Load show:', filePath || '(active)')
    
    const result = await stagePersistence.loadShow(filePath)
    
    if (result.success && result.showFile) {
      // Broadcast loaded show to renderer
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('lux:stage:loaded', {
          showFile: result.showFile,
          migrated: result.migrated,
          warnings: result.warnings
        })
      }
    }
    
    return result
  })

  /**
   * Load the active show (called at startup)
   */
  ipcMain.handle('lux:stage:loadActive', async () => {
    console.log('[StageIPC] Load active show')
    return stagePersistence.loadShow()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Save current show
   * @param showFile - The ShowFileV2 data to save
   * @param path - Optional path. If not provided, saves to active show path.
   */
  ipcMain.handle('lux:stage:save', async (_event, showFile: ShowFileV2, filePath?: string) => {
    console.log('[StageIPC] Save show:', showFile.name)
    return stagePersistence.saveShow(showFile, filePath)
  })

  /**
   * Save show with a new name
   * @param showFile - The ShowFileV2 data to save
   * @param name - New show name
   */
  ipcMain.handle('lux:stage:saveAs', async (_event, showFile: ShowFileV2, name: string) => {
    console.log('[StageIPC] Save show as:', name)
    return stagePersistence.saveShowAs(showFile, name)
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LIST & METADATA
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * List all shows
   */
  ipcMain.handle('lux:stage:list', async () => {
    console.log('[StageIPC] List shows')
    return stagePersistence.listShows()
  })

  /**
   * Get recent shows
   */
  ipcMain.handle('lux:stage:recent', async () => {
    console.log('[StageIPC] Get recent shows')
    return stagePersistence.getRecentShows()
  })

  /**
   * Delete a show
   * @param filePath - Full path to show file
   */
  ipcMain.handle('lux:stage:delete', async (_event, filePath: string) => {
    console.log('[StageIPC] Delete show:', filePath)
    return stagePersistence.deleteShow(filePath)
  })

  /**
   * Get shows folder path
   */
  ipcMain.handle('lux:stage:getPath', async () => {
    return stagePersistence.getShowsPath()
  })

  /**
   * Check if show exists
   * @param name - Show name to check
   */
  ipcMain.handle('lux:stage:exists', async (_event, name: string) => {
    return stagePersistence.showExists(name)
  })

  console.log('[StageIPC] ✅ All Stage IPC handlers registered')
}

// ═══════════════════════════════════════════════════════════════════════════
// PRELOAD TYPES (for TypeScript in renderer)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stage API exposed to renderer via preload
 */
export interface StagePreloadAPI {
  load: (path?: string) => Promise<import('./StagePersistence').LoadResult>
  loadActive: () => Promise<import('./StagePersistence').LoadResult>
  save: (showFile: ShowFileV2, path?: string) => Promise<import('./StagePersistence').SaveResult>
  saveAs: (showFile: ShowFileV2, name: string) => Promise<import('./StagePersistence').SaveResult>
  list: () => Promise<import('./StagePersistence').ListResult>
  recent: () => Promise<import('./StagePersistence').ShowMetadataV2[]>
  delete: (path: string) => Promise<import('./StagePersistence').SaveResult>
  getPath: () => Promise<string>
  exists: (name: string) => Promise<boolean>
  
  // Events
  onLoaded: (callback: (data: { showFile: ShowFileV2; migrated?: boolean; warnings?: string[] }) => void) => () => void
}
