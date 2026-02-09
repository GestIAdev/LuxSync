/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎧 CHRONOS IPC HANDLERS - WAVE 2005.3: THE PHANTOM WORKER
 *
 * IPC handlers for Chronos audio analysis using the PhantomWorker.
 *
 * HANDLERS:
 * - chronos:analyze-audio - Analyze an audio file
 * - chronos:get-analysis-status - Check if analysis is in progress
 * - chronos:cancel-analysis - Cancel ongoing analysis (future)
 *
 * @module electron/ipc/ChronosIPCHandlers
 * @version WAVE 2005.3
 */
import { ipcMain } from 'electron';
import { getPhantomWorker } from '../workers/PhantomWorkerManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
}
// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════
export async function cleanupChronosIPC() {
    // Remove handlers
    ipcMain.removeHandler('chronos:analyze-audio');
    ipcMain.removeHandler('chronos:save-temp-audio');
    ipcMain.removeHandler('chronos:cleanup-temp-audio');
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
