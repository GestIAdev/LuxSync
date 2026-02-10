/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎧 CHRONOS IPC HANDLERS
 * 
 * WAVE 2005.3: THE PHANTOM WORKER - Audio analysis
 * WAVE 2014: THE MEMORY CORE - Project save/load
 * 
 * IPC handlers for Chronos audio analysis and project persistence.
 * 
 * HANDLERS:
 * - chronos:analyze-audio - Analyze an audio file
 * - chronos:get-analysis-status - Check if analysis is in progress
 * - chronos:cancel-analysis - Cancel ongoing analysis (future)
 * - chronos:save-project - Save .lux project file
 * - chronos:load-project - Load .lux project file
 * - chronos:check-file-exists - Check if a file exists
 * 
 * @module electron/ipc/ChronosIPCHandlers
 * @version WAVE 2014
 */

import { ipcMain, BrowserWindow, dialog } from 'electron'
import { getPhantomWorker, type AnalysisRequest, type AnalysisProgress } from '../workers/PhantomWorkerManager'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FILE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PROJECT_EXTENSION = '.lux'
const PROJECT_FILTER = {
  name: 'LuxSync Project',
  extensions: ['lux'],
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AnalyzeAudioRequest {
  /** Path to audio file, or 'temp' if sending buffer */
  filePath?: string
  /** Original filename */
  fileName: string
  /** Optional: Buffer data if file is from drag-drop */
  buffer?: ArrayBuffer
}

interface AnalyzeAudioResponse {
  success: boolean
  data?: any
  error?: string
  durationMs?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMP FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const tempDir = path.join(os.tmpdir(), 'luxsync-audio')

async function ensureTempDir(): Promise<void> {
  try {
    await fs.promises.mkdir(tempDir, { recursive: true })
  } catch (err) {
    // Already exists
  }
}

async function saveTempFile(buffer: ArrayBuffer, fileName: string): Promise<string> {
  await ensureTempDir()
  
  const uniqueName = `${Date.now()}-${fileName}`
  const filePath = path.join(tempDir, uniqueName)
  
  await fs.promises.writeFile(filePath, Buffer.from(buffer))
  console.log(`[ChronosIPC] 💾 Saved temp file: ${filePath}`)
  
  return filePath
}

async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    if (filePath.startsWith(tempDir)) {
      await fs.promises.unlink(filePath)
      console.log(`[ChronosIPC] 🧹 Cleaned up: ${filePath}`)
    }
  } catch (err) {
    // File might already be deleted
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST ID GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

let requestCounter = 0

function generateRequestId(): string {
  return `chronos-${Date.now()}-${++requestCounter}`
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export function setupChronosIPCHandlers(mainWindow: BrowserWindow): void {
  console.log('[ChronosIPC] 🎧 Setting up Chronos IPC handlers...')
  
  const phantom = getPhantomWorker()
  
  // Setup progress forwarding to main window
  phantom.setProgressCallback((progress: AnalysisProgress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('chronos:analysis-progress', progress)
    }
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:analyze-audio
  // Main handler for audio file analysis
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:analyze-audio', async (event, request: AnalyzeAudioRequest): Promise<AnalyzeAudioResponse> => {
    console.log(`[ChronosIPC] 📂 Analyze request: ${request.fileName}`)
    
    let tempFilePath: string | null = null
    
    try {
      // Ensure phantom is ready
      if (!phantom.ready) {
        await phantom.init()
      }
      
      // Determine file path
      let filePath = request.filePath
      
      // If buffer is provided (drag-drop), save to temp file
      if (request.buffer) {
        tempFilePath = await saveTempFile(request.buffer, request.fileName)
        filePath = tempFilePath
      }
      
      if (!filePath) {
        throw new Error('No file path or buffer provided')
      }
      
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }
      
      // Get file stats
      const stats = await fs.promises.stat(filePath)
      console.log(`[ChronosIPC] 📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`)
      
      // Create analysis request
      const analysisRequest: AnalysisRequest = {
        requestId: generateRequestId(),
        filePath,
        fileName: request.fileName,
      }
      
      // Send to phantom for processing
      const result = await phantom.analyzeAudioFile(analysisRequest)
      
      // Cleanup temp file if created
      if (tempFilePath) {
        await cleanupTempFile(tempFilePath)
      }
      
      if (result.success) {
        console.log(`[ChronosIPC] ✅ Analysis complete in ${result.durationMs}ms`)
        return {
          success: true,
          data: result.data,
          durationMs: result.durationMs,
        }
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
      
    } catch (err) {
      console.error(`[ChronosIPC] ❌ Analysis error:`, err)
      
      // Cleanup temp file on error
      if (tempFilePath) {
        await cleanupTempFile(tempFilePath)
      }
      
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:save-temp-audio
  // Save a buffer to temp file and return path
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:save-temp-audio', async (event, data: { buffer: ArrayBuffer, fileName: string }): Promise<string> => {
    const filePath = await saveTempFile(data.buffer, data.fileName)
    return filePath
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:cleanup-temp-audio
  // Cleanup a temp file
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:cleanup-temp-audio', async (event, filePath: string): Promise<void> => {
    await cleanupTempFile(filePath)
  })
  
  console.log('[ChronosIPC] ✅ Chronos IPC handlers ready')
  
  // ─────────────────────────────────────────────────────────────────────────
  // 💾 WAVE 2014: PROJECT FILE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  
  setupProjectIPCHandlers(mainWindow)
}

// ═══════════════════════════════════════════════════════════════════════════
// 💾 PROJECT IPC HANDLERS - WAVE 2014: THE MEMORY CORE
// ═══════════════════════════════════════════════════════════════════════════

interface SaveProjectRequest {
  json: string
  currentPath: string | null
  defaultName: string
}

interface SaveProjectResponse {
  success: boolean
  path?: string
  error?: string
  cancelled?: boolean
}

interface LoadProjectRequest {
  path?: string
}

interface LoadProjectResponse {
  success: boolean
  json?: string
  path?: string
  error?: string
  cancelled?: boolean
}

function setupProjectIPCHandlers(mainWindow: BrowserWindow): void {
  console.log('[ChronosIPC] 💾 Setting up Project IPC handlers...')
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:save-project
  // Save .lux project file with native dialog
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:save-project', async (event, request: SaveProjectRequest): Promise<SaveProjectResponse> => {
    console.log(`[ChronosIPC] 💾 Save project request`)
    
    try {
      let filePath = request.currentPath
      
      // If no current path, show save dialog
      if (!filePath) {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Save Chronos Project',
          defaultPath: request.defaultName,
          filters: [PROJECT_FILTER],
          properties: ['showOverwriteConfirmation'],
        })
        
        if (result.canceled || !result.filePath) {
          return { success: false, cancelled: true }
        }
        
        filePath = result.filePath
        
        // Ensure .lux extension
        if (!filePath.endsWith(PROJECT_EXTENSION)) {
          filePath += PROJECT_EXTENSION
        }
      }
      
      // Write file
      await fs.promises.writeFile(filePath, request.json, 'utf-8')
      console.log(`[ChronosIPC] ✅ Project saved: ${filePath}`)
      
      return { success: true, path: filePath }
      
    } catch (err) {
      console.error('[ChronosIPC] ❌ Save error:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : String(err) 
      }
    }
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:load-project
  // Load .lux project file with native dialog
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:load-project', async (event, request: LoadProjectRequest): Promise<LoadProjectResponse> => {
    console.log(`[ChronosIPC] 📂 Load project request`)
    
    try {
      let filePath = request.path
      
      // If no path provided, show open dialog
      if (!filePath) {
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Open Chronos Project',
          filters: [PROJECT_FILTER],
          properties: ['openFile'],
        })
        
        if (result.canceled || !result.filePaths[0]) {
          return { success: false, cancelled: true }
        }
        
        filePath = result.filePaths[0]
      }
      
      // Verify file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` }
      }
      
      // Read file
      const json = await fs.promises.readFile(filePath, 'utf-8')
      console.log(`[ChronosIPC] ✅ Project loaded: ${filePath}`)
      
      return { success: true, json, path: filePath }
      
    } catch (err) {
      console.error('[ChronosIPC] ❌ Load error:', err)
      return { 
        success: false, 
        error: err instanceof Error ? err.message : String(err) 
      }
    }
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:check-file-exists
  // Check if a file exists (for audio path validation)
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:check-file-exists', async (event, filePath: string): Promise<boolean> => {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  })
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLER: chronos:browse-audio
  // Browse for audio file to replace missing audio
  // ─────────────────────────────────────────────────────────────────────────
  
  ipcMain.handle('chronos:browse-audio', async (event): Promise<{ path: string } | null> => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio File',
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    
    if (result.canceled || !result.filePaths[0]) {
      return null
    }
    
    return { path: result.filePaths[0] }
  })
  
  console.log('[ChronosIPC] ✅ Project IPC handlers ready')
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

export async function cleanupChronosIPC(): Promise<void> {
  // Remove audio analysis handlers
  ipcMain.removeHandler('chronos:analyze-audio')
  ipcMain.removeHandler('chronos:save-temp-audio')
  ipcMain.removeHandler('chronos:cleanup-temp-audio')
  
  // Remove project handlers (WAVE 2014)
  ipcMain.removeHandler('chronos:save-project')
  ipcMain.removeHandler('chronos:load-project')
  ipcMain.removeHandler('chronos:check-file-exists')
  ipcMain.removeHandler('chronos:browse-audio')
  
  // Cleanup temp directory
  try {
    const files = await fs.promises.readdir(tempDir)
    for (const file of files) {
      await fs.promises.unlink(path.join(tempDir, file))
    }
    console.log(`[ChronosIPC] 🧹 Cleaned up ${files.length} temp files`)
  } catch (err) {
    // Temp dir might not exist
  }
}
