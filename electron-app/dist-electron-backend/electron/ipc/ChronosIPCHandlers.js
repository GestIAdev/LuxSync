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
import { ipcMain, dialog } from 'electron';
import { getPhantomWorker } from '../workers/PhantomWorkerManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FILE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const PROJECT_EXTENSION = '.lux';
const PROJECT_FILTER = {
    name: 'LuxSync Project',
    extensions: ['lux'],
};
// ═══════════════════════════════════════════════════════════════════════════
// TEMP FILE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
const tempDir = path.join(os.tmpdir(), 'luxsync-audio');
async function ensureTempDir() {
    try {
        await fs.promises.mkdir(tempDir, { recursive: true });
    }
    catch (err) {
        // Already exists
    }
}
async function saveTempFile(buffer, fileName) {
    await ensureTempDir();
    const uniqueName = `${Date.now()}-${fileName}`;
    const filePath = path.join(tempDir, uniqueName);
    await fs.promises.writeFile(filePath, Buffer.from(buffer));
    console.log(`[ChronosIPC] 💾 Saved temp file: ${filePath}`);
    return filePath;
}
async function cleanupTempFile(filePath) {
    try {
        if (filePath.startsWith(tempDir)) {
            await fs.promises.unlink(filePath);
            console.log(`[ChronosIPC] 🧹 Cleaned up: ${filePath}`);
        }
    }
    catch (err) {
        // File might already be deleted
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// REQUEST ID GENERATOR
// ═══════════════════════════════════════════════════════════════════════════
let requestCounter = 0;
function generateRequestId() {
    return `chronos-${Date.now()}-${++requestCounter}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
export function setupChronosIPCHandlers(mainWindow) {
    console.log('[ChronosIPC] 🎧 Setting up Chronos IPC handlers...');
    const phantom = getPhantomWorker();
    // Setup progress forwarding to main window
    phantom.setProgressCallback((progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chronos:analysis-progress', progress);
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:analyze-audio
    // Main handler for audio file analysis
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:analyze-audio', async (event, request) => {
        console.log(`[ChronosIPC] 📂 Analyze request: ${request.fileName}`);
        let tempFilePath = null;
        try {
            // Ensure phantom is ready
            if (!phantom.ready) {
                await phantom.init();
            }
            // Determine file path
            let filePath = request.filePath;
            // If buffer is provided (drag-drop), save to temp file
            if (request.buffer) {
                tempFilePath = await saveTempFile(request.buffer, request.fileName);
                filePath = tempFilePath;
            }
            if (!filePath) {
                throw new Error('No file path or buffer provided');
            }
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            // Get file stats
            const stats = await fs.promises.stat(filePath);
            console.log(`[ChronosIPC] 📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
            // Create analysis request
            const analysisRequest = {
                requestId: generateRequestId(),
                filePath,
                fileName: request.fileName,
            };
            // Send to phantom for processing
            const result = await phantom.analyzeAudioFile(analysisRequest);
            // Cleanup temp file if created
            if (tempFilePath) {
                await cleanupTempFile(tempFilePath);
            }
            if (result.success) {
                console.log(`[ChronosIPC] ✅ Analysis complete in ${result.durationMs}ms`);
                return {
                    success: true,
                    data: result.data,
                    durationMs: result.durationMs,
                };
            }
            else {
                throw new Error(result.error || 'Analysis failed');
            }
        }
        catch (err) {
            console.error(`[ChronosIPC] ❌ Analysis error:`, err);
            // Cleanup temp file on error
            if (tempFilePath) {
                await cleanupTempFile(tempFilePath);
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:save-temp-audio
    // Save a buffer to temp file and return path
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:save-temp-audio', async (event, data) => {
        const filePath = await saveTempFile(data.buffer, data.fileName);
        return filePath;
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:cleanup-temp-audio
    // Cleanup a temp file
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:cleanup-temp-audio', async (event, filePath) => {
        await cleanupTempFile(filePath);
    });
    console.log('[ChronosIPC] ✅ Chronos IPC handlers ready');
    // ─────────────────────────────────────────────────────────────────────────
    // 💾 WAVE 2014: PROJECT FILE HANDLERS
    // ─────────────────────────────────────────────────────────────────────────
    setupProjectIPCHandlers(mainWindow);
}
function setupProjectIPCHandlers(mainWindow) {
    console.log('[ChronosIPC] 💾 Setting up Project IPC handlers...');
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:save-project
    // Save .lux project file with native dialog
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:save-project', async (event, request) => {
        console.log(`[ChronosIPC] 💾 Save project request`);
        try {
            let filePath = request.currentPath;
            // If no current path, show save dialog
            if (!filePath) {
                const result = await dialog.showSaveDialog(mainWindow, {
                    title: 'Save Chronos Project',
                    defaultPath: request.defaultName,
                    filters: [PROJECT_FILTER],
                    properties: ['showOverwriteConfirmation'],
                });
                if (result.canceled || !result.filePath) {
                    return { success: false, cancelled: true };
                }
                filePath = result.filePath;
                // Ensure .lux extension
                if (!filePath.endsWith(PROJECT_EXTENSION)) {
                    filePath += PROJECT_EXTENSION;
                }
            }
            // Write file
            await fs.promises.writeFile(filePath, request.json, 'utf-8');
            console.log(`[ChronosIPC] ✅ Project saved: ${filePath}`);
            return { success: true, path: filePath };
        }
        catch (err) {
            console.error('[ChronosIPC] ❌ Save error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:load-project
    // Load .lux project file with native dialog
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:load-project', async (event, request) => {
        console.log(`[ChronosIPC] 📂 Load project request`);
        try {
            let filePath = request.path;
            // If no path provided, show open dialog
            if (!filePath) {
                const result = await dialog.showOpenDialog(mainWindow, {
                    title: 'Open Chronos Project',
                    filters: [PROJECT_FILTER],
                    properties: ['openFile'],
                });
                if (result.canceled || !result.filePaths[0]) {
                    return { success: false, cancelled: true };
                }
                filePath = result.filePaths[0];
            }
            // Verify file exists
            if (!fs.existsSync(filePath)) {
                return { success: false, error: `File not found: ${filePath}` };
            }
            // Read file
            const json = await fs.promises.readFile(filePath, 'utf-8');
            console.log(`[ChronosIPC] ✅ Project loaded: ${filePath}`);
            return { success: true, json, path: filePath };
        }
        catch (err) {
            console.error('[ChronosIPC] ❌ Load error:', err);
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err)
            };
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:check-file-exists
    // Check if a file exists (for audio path validation)
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:check-file-exists', async (event, filePath) => {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    });
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLER: chronos:browse-audio
    // Browse for audio file to replace missing audio
    // ─────────────────────────────────────────────────────────────────────────
    ipcMain.handle('chronos:browse-audio', async (event) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Audio File',
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });
        if (result.canceled || !result.filePaths[0]) {
            return null;
        }
        return { path: result.filePaths[0] };
    });
    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2017: PROJECT LAZARUS - Auto-Save Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    // Auto-save directory (in user data folder)
    const autoSaveDir = path.join(os.homedir(), '.luxsync', 'autosave');
    // Ensure auto-save directory exists
    fs.promises.mkdir(autoSaveDir, { recursive: true }).catch(() => { });
    /**
     * Write auto-save file (shadow copy)
     */
    ipcMain.handle('chronos:write-auto-save', async (_event, request) => {
        try {
            // If path is just a filename, put it in the auto-save directory
            const filePath = path.isAbsolute(request.path)
                ? request.path
                : path.join(autoSaveDir, request.path);
            await fs.promises.writeFile(filePath, request.json, 'utf-8');
            console.log(`[ChronosIPC] 🛡️ Auto-save written: ${filePath}`);
            return { success: true, path: filePath };
        }
        catch (err) {
            console.error('[ChronosIPC] ❌ Auto-save write failed:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Check if auto-save file exists and get its modification time
     */
    ipcMain.handle('chronos:check-auto-save', async (_event, request) => {
        try {
            const filePath = path.isAbsolute(request.path)
                ? request.path
                : path.join(autoSaveDir, request.path);
            const stats = await fs.promises.stat(filePath);
            return {
                exists: true,
                mtime: stats.mtime.toISOString(),
                path: filePath,
            };
        }
        catch (err) {
            // File doesn't exist
            return { exists: false };
        }
    });
    /**
     * Load auto-save file for recovery
     */
    ipcMain.handle('chronos:load-auto-save', async (_event, request) => {
        try {
            const filePath = path.isAbsolute(request.path)
                ? request.path
                : path.join(autoSaveDir, request.path);
            const json = await fs.promises.readFile(filePath, 'utf-8');
            console.log(`[ChronosIPC] 🛡️ Auto-save loaded for recovery: ${filePath}`);
            return { success: true, json };
        }
        catch (err) {
            console.error('[ChronosIPC] ❌ Auto-save load failed:', err);
            return { success: false, error: String(err) };
        }
    });
    /**
     * Delete auto-save file (after successful manual save)
     */
    ipcMain.handle('chronos:delete-auto-save', async (_event, request) => {
        try {
            const filePath = path.isAbsolute(request.path)
                ? request.path
                : path.join(autoSaveDir, request.path);
            await fs.promises.unlink(filePath);
            console.log(`[ChronosIPC] 🗑️ Auto-save deleted: ${filePath}`);
            return { success: true };
        }
        catch (err) {
            // File might not exist, that's OK
            return { success: true };
        }
    });
    console.log('[ChronosIPC] ✅ Project IPC handlers ready');
}
// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════
export async function cleanupChronosIPC() {
    // Remove audio analysis handlers
    ipcMain.removeHandler('chronos:analyze-audio');
    ipcMain.removeHandler('chronos:save-temp-audio');
    ipcMain.removeHandler('chronos:cleanup-temp-audio');
    // Remove project handlers (WAVE 2014)
    ipcMain.removeHandler('chronos:save-project');
    ipcMain.removeHandler('chronos:load-project');
    ipcMain.removeHandler('chronos:check-file-exists');
    ipcMain.removeHandler('chronos:browse-audio');
    // Remove auto-save handlers (WAVE 2017)
    ipcMain.removeHandler('chronos:write-auto-save');
    ipcMain.removeHandler('chronos:check-auto-save');
    ipcMain.removeHandler('chronos:load-auto-save');
    ipcMain.removeHandler('chronos:delete-auto-save');
    // Cleanup temp directory
    try {
        const files = await fs.promises.readdir(tempDir);
        for (const file of files) {
            await fs.promises.unlink(path.join(tempDir, file));
        }
        console.log(`[ChronosIPC] 🧹 Cleaned up ${files.length} temp files`);
    }
    catch (err) {
        // Temp dir might not exist
    }
}
