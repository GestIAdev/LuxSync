/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 STAGE IPC HANDLERS - WAVE 369.5
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
 * - lux:stage:openDialog    - WAVE 369.5: Native Open dialog
 * - lux:stage:saveAsDialog  - WAVE 369.5: Native Save As dialog
 * 
 * @module core/stage/StageIPCHandlers
 * @version 369.5.0
 */

import { ipcMain, BrowserWindow, dialog } from 'electron'
import { stagePersistence } from './StagePersistence'
import type { ShowFileV2 } from './ShowFileV2'
import path from 'path'

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all Stage-related IPC handlers
 */
export function setupStageIPCHandlers(getMainWindow: () => BrowserWindow | null): void {

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
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        try {
          mainWindow.webContents.send('lux:stage:loaded', {
            showFile: result.showFile,
            migrated: result.migrated,
            warnings: result.warnings
          })
        } catch {
          // Renderer disposed during reload
        }
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

  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 369.5: NATIVE FILE DIALOGS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Open file dialog - Let user select a .luxshow file
   * @returns Selected file path or null if cancelled
   */
  ipcMain.handle('lux:stage:openDialog', async () => {
    console.log('[StageIPC] 📂 Opening file dialog...')
    
    const mainWindow = getMainWindow()
    const showsPath = stagePersistence.getShowsPath()
    
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open Stage Show',
      defaultPath: showsPath,
      filters: [
        { name: 'LuxSync Shows', extensions: ['luxshow', 'v2.luxshow'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      console.log('[StageIPC] 📂 Dialog cancelled')
      return { success: false, cancelled: true }
    }
    
    const filePath = result.filePaths[0]
    console.log('[StageIPC] 📂 Selected file:', filePath)
    
    // Load the selected file
    const loadResult = await stagePersistence.loadShow(filePath)
    
    if (loadResult.success && loadResult.showFile) {
      // Broadcast to renderer
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        try {
          mainWindow.webContents.send('lux:stage:loaded', {
            showFile: loadResult.showFile,
            filePath: filePath,
            migrated: loadResult.migrated,
            warnings: loadResult.warnings
          })
        } catch {
          // Renderer disposed during reload
        }
      }
    }
    
    return { ...loadResult, filePath }
  })

  /**
   * Save As dialog - Let user choose name/location for new file
   * @param showFile - The show data to save
   * @param suggestedName - Suggested filename
   * @returns Save result with chosen path
   */
  ipcMain.handle('lux:stage:saveAsDialog', async (_event, showFile: ShowFileV2, suggestedName?: string) => {
    console.log('[StageIPC] 💾 Opening Save As dialog...')
    
    const mainWindow = getMainWindow()
    const showsPath = stagePersistence.getShowsPath()
    const defaultName = suggestedName || showFile.name || 'Untitled Stage'
    
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Stage Show As',
      defaultPath: path.join(showsPath, `${defaultName}.v2.luxshow`),
      filters: [
        { name: 'LuxSync Shows', extensions: ['v2.luxshow'] }
      ]
    })
    
    if (result.canceled || !result.filePath) {
      console.log('[StageIPC] 💾 Save As cancelled')
      return { success: false, cancelled: true }
    }
    
    const filePath = result.filePath
    console.log('[StageIPC] 💾 Saving to:', filePath)
    
    // Extract name from path for the show
    const fileName = path.basename(filePath, '.v2.luxshow')
    showFile.name = fileName
    
    // Save to the chosen path
    const saveResult = await stagePersistence.saveShow(showFile, filePath)
    
    return { ...saveResult, filePath, name: fileName }
  })

  /**
   * Confirm dialog for unsaved changes
   * @param showName - Name of the show with unsaved changes
   * @returns 'save' | 'discard' | 'cancel'
   */
  ipcMain.handle('lux:stage:confirmUnsaved', async (_event, showName: string) => {
    const mainWindow = getMainWindow()
    
    const result = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: 'Unsaved Changes',
      message: `"${showName}" has unsaved changes.`,
      detail: 'Do you want to save your changes before continuing?',
      buttons: ['Save', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    
    switch (result.response) {
      case 0: return 'save'
      case 1: return 'discard'
      default: return 'cancel'
    }
  })

  // WAVE 2098: Boot silence
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
