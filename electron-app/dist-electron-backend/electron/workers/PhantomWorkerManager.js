/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 PHANTOM WORKER MANAGER - WAVE 2005.3: THE PHANTOM WORKER
 *
 * Gestiona una BrowserWindow OCULTA que procesa audio sin afectar la UI.
 *
 * ARQUITECTURA:
 * - PhantomWindow = BrowserWindow({ show: false })
 * - Usa AudioContext NATIVO de Chromium (cero dependencias)
 * - Aislamiento total: si crashea, la UI sigue viva
 * - Memoria separada del renderer principal
 *
 * FLUJO:
 * 1. Main Process recibe filePath de la UI
 * 2. Main lee el archivo con fs.readFile()
 * 3. Main envía ArrayBuffer al PhantomWorker
 * 4. Phantom decodifica con AudioContext + analiza con GodEarOffline
 * 5. Phantom devuelve AnalysisData (JSON ligero)
 * 6. Main envía resultado a la UI
 *
 * FILOSOFÍA PUNK:
 * - Zero external dependencies
 * - Reutiliza Chromium que ya tenemos
 * - GodEarOffline intacto (puro TypeScript)
 *
 * @module electron/workers/PhantomWorkerManager
 * @version WAVE 2005.3
 */
import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// ═══════════════════════════════════════════════════════════════════════════
// PHANTOM WORKER MANAGER
// ═══════════════════════════════════════════════════════════════════════════
export class PhantomWorkerManager {
    constructor() {
        this.phantomWindow = null;
        this.isReady = false;
        this.pendingRequests = new Map();
        console.log('[PhantomWorker] 👻 Manager created');
    }
    /**
     * Initialize the phantom worker
     * Creates a hidden BrowserWindow that handles audio processing
     */
    async init() {
        if (this.phantomWindow) {
            console.warn('[PhantomWorker] Already initialized');
            return;
        }
        console.log('[PhantomWorker] 👻 Initializing hidden worker...');
        // Create hidden BrowserWindow
        this.phantomWindow = new BrowserWindow({
            show: false, // 👻 INVISIBLE - this is the magic
            width: 400,
            height: 300,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                // Enable web audio
                webSecurity: true,
            },
        });
        // Handle phantom crashes gracefully
        this.phantomWindow.webContents.on('crashed', () => {
            console.error('[PhantomWorker] 💀 Phantom crashed! Restarting...');
            this.handlePhantomCrash();
        });
        this.phantomWindow.on('closed', () => {
            console.log('[PhantomWorker] 👻 Phantom window closed');
            this.phantomWindow = null;
            this.isReady = false;
        });
        // Setup IPC handlers for phantom responses
        this.setupIpcHandlers();
        // Load the phantom worker HTML
        const workerPath = path.join(__dirname, 'phantomWorker.html');
        // Check if file exists (dev vs prod)
        if (fs.existsSync(workerPath)) {
            await this.phantomWindow.loadFile(workerPath);
        }
        else {
            // In development, might be in different location
            const devPath = path.join(app.getAppPath(), 'electron', 'workers', 'phantomWorker.html');
            if (fs.existsSync(devPath)) {
                await this.phantomWindow.loadFile(devPath);
            }
            else {
                throw new Error(`[PhantomWorker] Cannot find phantomWorker.html at ${workerPath} or ${devPath}`);
            }
        }
        this.isReady = true;
        console.log('[PhantomWorker] 👻 Phantom ready for audio processing!');
    }
    /**
     * Setup IPC handlers for communication with phantom
     */
    setupIpcHandlers() {
        // Handle analysis complete
        ipcMain.on('phantom:analysis-complete', (_, result) => {
            console.log(`[PhantomWorker] ✅ Analysis complete: ${result.requestId}`);
            const pending = this.pendingRequests.get(result.requestId);
            if (pending) {
                pending.resolve(result);
                this.pendingRequests.delete(result.requestId);
            }
        });
        // Handle analysis error
        ipcMain.on('phantom:analysis-error', (_, result) => {
            console.error(`[PhantomWorker] ❌ Analysis error: ${result.requestId} - ${result.error}`);
            const pending = this.pendingRequests.get(result.requestId);
            if (pending) {
                pending.reject(new Error(result.error || 'Unknown error'));
                this.pendingRequests.delete(result.requestId);
            }
        });
        // Handle progress updates
        ipcMain.on('phantom:analysis-progress', (_, progress) => {
            if (this.onProgressCallback) {
                this.onProgressCallback(progress);
            }
        });
        // Handle phantom ready signal
        ipcMain.on('phantom:ready', () => {
            console.log('[PhantomWorker] 👻 Phantom signals ready');
            this.isReady = true;
        });
    }
    /**
     * Set callback for progress updates
     */
    setProgressCallback(callback) {
        this.onProgressCallback = callback;
    }
    /**
     * Analyze an audio file
     * Reads the file and sends it to the phantom for processing
     */
    async analyzeAudioFile(request) {
        if (!this.phantomWindow || !this.isReady) {
            throw new Error('[PhantomWorker] Phantom not ready');
        }
        console.log(`[PhantomWorker] 📂 Analyzing: ${request.fileName}`);
        // Read file from disk
        const buffer = await fs.promises.readFile(request.filePath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        console.log(`[PhantomWorker] 📦 File size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
        // Create promise for result
        return new Promise((resolve, reject) => {
            // Store pending request
            this.pendingRequests.set(request.requestId, { resolve, reject });
            // Set timeout (5 minutes max for huge files)
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(request.requestId);
                reject(new Error('Analysis timeout (5 minutes exceeded)'));
            }, 5 * 60 * 1000);
            // Wrap resolve to clear timeout
            const originalResolve = resolve;
            this.pendingRequests.set(request.requestId, {
                resolve: (result) => {
                    clearTimeout(timeout);
                    originalResolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            // Send to phantom (transfer ArrayBuffer)
            this.phantomWindow.webContents.send('phantom:analyze', {
                requestId: request.requestId,
                fileName: request.fileName,
                buffer: arrayBuffer,
            });
        });
    }
    /**
     * Handle phantom crash - restart it
     */
    async handlePhantomCrash() {
        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            pending.reject(new Error('Phantom worker crashed'));
        }
        this.pendingRequests.clear();
        // Cleanup
        if (this.phantomWindow) {
            this.phantomWindow.destroy();
            this.phantomWindow = null;
        }
        this.isReady = false;
        // Restart after short delay
        setTimeout(async () => {
            try {
                await this.init();
                console.log('[PhantomWorker] 👻 Phantom restarted successfully');
            }
            catch (err) {
                console.error('[PhantomWorker] ❌ Failed to restart phantom:', err);
            }
        }, 1000);
    }
    /**
     * Cleanup and destroy phantom
     */
    destroy() {
        console.log('[PhantomWorker] 👻 Destroying phantom...');
        // Reject pending requests
        for (const [_, pending] of this.pendingRequests) {
            pending.reject(new Error('PhantomWorker destroyed'));
        }
        this.pendingRequests.clear();
        // Remove IPC handlers
        ipcMain.removeAllListeners('phantom:analysis-complete');
        ipcMain.removeAllListeners('phantom:analysis-error');
        ipcMain.removeAllListeners('phantom:analysis-progress');
        ipcMain.removeAllListeners('phantom:ready');
        // Destroy window
        if (this.phantomWindow) {
            this.phantomWindow.destroy();
            this.phantomWindow = null;
        }
        this.isReady = false;
    }
    /**
     * Check if phantom is ready
     */
    get ready() {
        return this.isReady && this.phantomWindow !== null;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════
let phantomInstance = null;
export function getPhantomWorker() {
    if (!phantomInstance) {
        phantomInstance = new PhantomWorkerManager();
    }
    return phantomInstance;
}
export function destroyPhantomWorker() {
    if (phantomInstance) {
        phantomInstance.destroy();
        phantomInstance = null;
    }
}
