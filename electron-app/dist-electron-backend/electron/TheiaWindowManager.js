/**
 * 🎬 WAVE 4864 / 🌊 WAVE 8215 — THEIA WINDOW MANAGER (Main Process)
 *
 * Spawnea y gestiona la ventana secundaria del proyector Theia (HDMI / LED
 * wall). Es **frameless**, **fullscreen**, **fondo #000000** y tiene un único
 * propósito: recibir los frame-buffers transferibles del ThetaWorker y
 * blittearlos en su `<canvas>` vía `requestAnimationFrame`.
 *
 * 🌊 WAVE 8215 — THE OPUS GLASS-BRIDGE PIVOT: ya NO hay SharedArrayBuffer
 * cross-proceso. Este manager hace de BROKER de un `MessageChannelMain`
 * directo entre los dos renderers:
 *   - portA → main window  (ThetaWorker escribe frames, recibe acks)
 *   - portB → output window (TheiaOutputView lee frames, devuelve buffers)
 * Una vez entregados los extremos, el ping-pong de `ArrayBuffer` corre por
 * Mojo renderer↔renderer — el main process queda FUERA del hot path.
 *
 * Targeting de display: si hay >= 2 monitores conectados, abre en el segundo;
 * si solo hay uno, abre en el primario (modo dev/preview).
 *
 * IPC handlers:
 *   theia:open-output        → abre ventana
 *   theia:close-output       → cierra ventana
 *   theia:is-output-open     → boolean
 *   theia:video-port         → push del port pair (postMessage + transfer)
 *   theia:video-unlink       → notify al cerrar (main window top-up su pool)
 *   theia:request-video-port → pull-driven re-broker: cualquier renderer que
 *                              pida el video link obtiene un channel NUEVO
 *                              (worker respawn, window reload, late mount).
 *                              NO-OP si la output window no está abierta.
 *
 * ZERO-ALLOC: este manager NO toca payloads — solo crea `MessageChannelMain`
 * pairs y mueve sus extremos como transferibles. Ningún ArrayBuffer ni
 * SharedArrayBuffer cruza por aquí: el ping-pong de buffers es 100%
 * renderer↔renderer vía Mojo una vez entregados los extremos.
 */
import { BrowserWindow, ipcMain, MessageChannelMain, screen } from 'electron';
import path from 'path';
// ─────────────────────────────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────────────────────────────
export class TheiaWindowManager {
    constructor(opts) {
        this.outputWindow = null;
        this.opts = opts;
    }
    static initialize(opts) {
        if (!TheiaWindowManager._instance) {
            TheiaWindowManager._instance = new TheiaWindowManager(opts);
            TheiaWindowManager._instance.registerIPCHandlers();
        }
        return TheiaWindowManager._instance;
    }
    static getInstance() {
        return TheiaWindowManager._instance;
    }
    // ─── Glass Bridge (WAVE 8215) ───────────────────────────────────────────
    /**
     * Crea el `MessageChannelMain` worker↔output y entrega cada extremo a su
     * renderer. El main process sale del hot path: a partir de aquí los
     * `ArrayBuffer` de 8.3MB ping-ponguean por Mojo con ownership transfer.
     * El consumidor devuelve cada buffer vía `ack` — zero-alloc certificado.
     */
    linkVideoPort() {
        if (!this.outputWindow || this.outputWindow.isDestroyed())
            return;
        const mainWin = this.opts.getMainWindow();
        if (!mainWin || mainWin.isDestroyed()) {
            console.warn('[TheiaWindowManager] linkVideoPort: main window unavailable');
            return;
        }
        const { port1, port2 } = new MessageChannelMain();
        mainWin.webContents.postMessage('theia:video-port', { role: 'producer' }, [port1]);
        this.outputWindow.webContents.postMessage('theia:video-port', { role: 'consumer' }, [port2]);
        // eslint-disable-next-line no-console
        console.log('[TheiaWindowManager] � video Glass-Bridge linked (worker ↔ output)');
    }
    unlinkVideoPort() {
        const mainWin = this.opts.getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
            // El worker marca los buffers en vuelo como perdidos y re-llena el pool
            // (bounded re-alloc por lifecycle event — nunca por frame).
            mainWin.webContents.send('theia:video-unlink');
        }
    }
    // ─── Window lifecycle ───────────────────────────────────────────────────
    isOutputOpen() {
        return this.outputWindow !== null && !this.outputWindow.isDestroyed();
    }
    openOutput() {
        if (this.isOutputOpen()) {
            // Re-foco si ya está abierta (la ventana puede estar oculta)
            this.outputWindow?.show();
            this.outputWindow?.focus();
            return { ok: true };
        }
        try {
            const targetDisplay = this.pickTargetDisplay();
            const primaryDisplay = screen.getPrimaryDisplay();
            const externalDisplay = targetDisplay.id !== primaryDisplay.id ? targetDisplay : null;
            this.outputWindow = externalDisplay
                ? new BrowserWindow({
                    x: externalDisplay.bounds.x,
                    y: externalDisplay.bounds.y,
                    width: externalDisplay.bounds.width,
                    height: externalDisplay.bounds.height,
                    frame: false,
                    fullscreen: true,
                    backgroundColor: '#000000',
                    title: 'Theia Output',
                    // 🛡️ WAVE 4866: Anti-poltergeist — la ventana no existe visualmente
                    // hasta que el renderer haya pintado el primer frame.
                    show: false,
                    focusable: false,
                    skipTaskbar: true,
                    acceptFirstMouse: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: this.opts.preloadPath,
                        backgroundThrottling: false,
                    },
                })
                : new BrowserWindow({
                    width: 800,
                    height: 450,
                    frame: true,
                    fullscreen: false,
                    backgroundColor: '#000000',
                    title: 'Theia Output',
                    // 🛡️ WAVE 4866: idem — fallback dev mode tampoco secuestra el foco.
                    show: false,
                    focusable: false,
                    skipTaskbar: true,
                    acceptFirstMouse: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: this.opts.preloadPath,
                        backgroundThrottling: false,
                    },
                });
            // Mostrar la ventana SOLO cuando el renderer haya pintado el primer frame.
            // Evita el frame negro que captura el foco de sistema antes de estar lista.
            this.outputWindow.once('ready-to-show', () => {
                this.outputWindow?.show();
            });
            // ESC sale de fullscreen / cierra (atajo de operador)
            this.outputWindow.webContents.on('before-input-event', (_, input) => {
                if (input.type === 'keyDown' && input.key === 'Escape') {
                    this.closeOutput();
                }
            });
            this.outputWindow.on('closed', () => {
                this.outputWindow = null;
            });
            // 🌊 WAVE 8215 — el Glass Bridge se enlaza cuando el preload de la
            // ventana de salida ya está vivo (did-finish-load). Los ports llegan al
            // mundo aislado del preload y quedan BUFFERED hasta que la página haga
            // pull (`__luxTheiaReq`) — entrega idempotente en ambos extremos.
            this.outputWindow.webContents.once('did-finish-load', () => {
                this.linkVideoPort();
            });
            // Cargar la URL con flag ?theia-output=1 — main.tsx detecta y monta TheiaOutputView
            if (this.opts.isDev) {
                void this.outputWindow.loadURL(`${this.opts.devUrl}?theia-output=1`);
            }
            else {
                void this.outputWindow.loadFile(this.opts.prodIndexPath, {
                    query: { 'theia-output': '1' },
                });
            }
            // eslint-disable-next-line no-console
            const openedDisplayLabel = externalDisplay
                ? `external display ${externalDisplay.id} (${externalDisplay.bounds.x},${externalDisplay.bounds.y})`
                : `primary display ${primaryDisplay.id} (fallback 800x450)`;
            console.log(`[TheiaWindowManager] 🎬 output window opened on ${openedDisplayLabel}`);
            return { ok: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            // eslint-disable-next-line no-console
            console.error('[TheiaWindowManager] openOutput failed:', msg);
            return { ok: false, error: msg };
        }
    }
    closeOutput() {
        if (this.outputWindow && !this.outputWindow.isDestroyed()) {
            // 🌊 WAVE 8215 — notify ANTES de destruir: el worker marca los buffers
            // en vuelo como perdidos (nunca volverán por ack) y rellena su pool
            // solo en el próximo attach — bounded re-alloc por lifecycle event.
            this.unlinkVideoPort();
            try {
                this.outputWindow.destroy();
            }
            catch {
                /* noop */
            }
        }
        this.outputWindow = null;
    }
    /** Selecciona el monitor donde abrir: externo si existe, primario si no. */
    pickTargetDisplay() {
        const all = screen.getAllDisplays();
        const primary = screen.getPrimaryDisplay();
        const externalDisplay = all.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);
        return externalDisplay ?? primary;
    }
    // ─── IPC ────────────────────────────────────────────────────────────────
    registerIPCHandlers() {
        ipcMain.handle('theia:open-output', () => this.openOutput());
        ipcMain.handle('theia:close-output', () => {
            this.closeOutput();
            return { ok: true };
        });
        ipcMain.handle('theia:is-output-open', () => this.isOutputOpen());
        // 🌊 WAVE 8215 — pull-driven re-broker. El preload de un renderer pide
        // un video link FRESCO (página que llega tarde, worker respawn tras
        // Phoenix, reload de ventana). Responder es re-entregar un channel nuevo
        // a AMBOS extremos — los consumers reemplazan su port y el producer
        // top-up su pool de transferibles en el attach (nunca por frame).
        // NO-OP si no hay output window: el push de `did-finish-load` cubrirá
        // el enlace cuando ésta abra.
        ipcMain.on('theia:request-video-port', () => {
            this.linkVideoPort();
        });
    }
    // ─── Shutdown ──────────────────────────────────────────────────────────
    shutdown() {
        this.closeOutput();
    }
}
TheiaWindowManager._instance = null;
/**
 * Helper de conveniencia para integrar desde main.ts:
 *   const theiaMgr = setupTheiaWindowManager({ isDev, ... })
 */
export function setupTheiaWindowManager(opts) {
    return TheiaWindowManager.initialize(opts);
}
/** Path helper para resolver el preload desde main.ts (typing-friendly). */
export function defaultPreloadPath(__dirnameFromMain) {
    return path.join(__dirnameFromMain, 'preload.js');
}
