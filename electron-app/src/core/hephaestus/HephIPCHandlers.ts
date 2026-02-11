/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ HEPHAESTUS IPC HANDLERS - WAVE 2030.5
 * IPC bridge for FX automation clip persistence
 * 
 * Channels:
 * - heph:save      - Save a clip to disk
 * - heph:load      - Load a clip by ID or path
 * - heph:list      - List all clips (metadata only)
 * - heph:delete    - Delete a clip
 * - heph:exists    - Check if clip name exists
 * - heph:getPath   - Get effects folder path
 * 
 * @module core/hephaestus/HephIPCHandlers
 * @version WAVE 2030.5
 */

import { ipcMain } from 'electron'
import { hephFileIO } from './HephFileIO'
import type { HephAutomationClipSerialized } from './types'
import { deserializeHephClip, serializeHephClip } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register all Hephaestus-related IPC handlers.
 * Call this during app initialization.
 */
export function setupHephIPCHandlers(): void {
  console.log('[HephIPC] Setting up Hephaestus IPC handlers (WAVE 2030.5)')

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Save a clip to disk.
   * 
   * @param clipData - Serialized clip data (Record, not Map)
   * @returns { success, filePath, error }
   */
  ipcMain.handle('heph:save', async (_event, clipData: HephAutomationClipSerialized) => {
    console.log('[HephIPC] Save clip:', clipData.name)
    
    try {
      // Deserialize for internal processing (Record → Map)
      const clip = deserializeHephClip(clipData)
      
      // Save to disk
      const filePath = await hephFileIO.saveClip(clip)
      
      return {
        success: true,
        filePath,
        id: clip.id,
      }
    } catch (error) {
      console.error('[HephIPC] Save failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Load a clip by ID or file path.
   * 
   * @param idOrPath - Clip ID or full file path
   * @returns { success, clip, error }
   */
  ipcMain.handle('heph:load', async (_event, idOrPath: string) => {
    console.log('[HephIPC] Load clip:', idOrPath)
    
    try {
      const clip = await hephFileIO.loadClip(idOrPath)
      
      // Serialize for IPC transport (Map → Record)
      const serialized = serializeHephClip(clip)
      
      return {
        success: true,
        clip: serialized,
      }
    } catch (error) {
      console.error('[HephIPC] Load failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // LIST
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * List all available clips (metadata only).
   * 
   * @returns { success, clips, error }
   */
  ipcMain.handle('heph:list', async () => {
    console.log('[HephIPC] List clips')
    
    try {
      const clips = await hephFileIO.listClips()
      
      return {
        success: true,
        clips,
      }
    } catch (error) {
      console.error('[HephIPC] List failed:', error)
      return {
        success: false,
        clips: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Delete a clip by ID or file path.
   * 
   * @param idOrPath - Clip ID or full file path
   * @returns { success, deleted, error }
   */
  ipcMain.handle('heph:delete', async (_event, idOrPath: string) => {
    console.log('[HephIPC] Delete clip:', idOrPath)
    
    try {
      const deleted = await hephFileIO.deleteClip(idOrPath)
      
      return {
        success: true,
        deleted,
      }
    } catch (error) {
      console.error('[HephIPC] Delete failed:', error)
      return {
        success: false,
        deleted: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // EXISTS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if a clip with given name already exists.
   * 
   * @param name - Clip name
   * @returns { success, exists }
   */
  ipcMain.handle('heph:exists', async (_event, name: string) => {
    console.log('[HephIPC] Check exists:', name)
    
    try {
      const exists = await hephFileIO.clipExists(name)
      
      return {
        success: true,
        exists,
      }
    } catch (error) {
      console.error('[HephIPC] Exists check failed:', error)
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // GET PATH
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the effects folder path.
   * 
   * @returns { success, path }
   */
  ipcMain.handle('heph:getPath', async () => {
    console.log('[HephIPC] Get effects path')
    
    try {
      const effectsPath = await hephFileIO.getEffectsPath()
      
      return {
        success: true,
        path: effectsPath,
      }
    } catch (error) {
      console.error('[HephIPC] Get path failed:', error)
      return {
        success: false,
        path: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // GENERATE ID
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Generate a unique clip ID.
   * 
   * @returns { id }
   */
  ipcMain.handle('heph:generateId', async () => {
    return {
      id: hephFileIO.generateId(),
    }
  })

  console.log('[HephIPC] ✓ All Hephaestus handlers registered')
}

export default setupHephIPCHandlers
