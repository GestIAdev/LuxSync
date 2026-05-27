/**
 * 🎬 WAVE 4864 — THEIA WINDOW MANAGER (Main Process · Phase 3)
 *
 * Spawnea y gestiona la ventana secundaria del proyector Theia (HDMI / LED
 * wall). Es **frameless**, **fullscreen**, **fondo #000000** y tiene un único
 * propósito: leer el `SharedVideoFrameBuffer` y blittearlo en su `<canvas>`
 * vía `requestAnimationFrame`.
 *
 * Comparte el SAB con el ThetaOrchestrator del renderer principal (que a su
 * vez lo entrega al ThetaWorker). El SAB es **propiedad del main process**:
 *   - Se crea lazy en la primera petición (`getVideoFrameSAB`).
 *   - Sobrevive a aperturas/cierres repetidos de la ventana secundaria.
 *   - Si el main muere, todos los renderers que lo tenían se quedan con un
 *     SAB huérfano (sin escritor) — el output ve frame fijo, no rompe.
 *
 * Targeting de display: si hay >= 2 monitores conectados, abre en el segundo;
 * si solo hay uno, abre en el primario (modo dev/preview).
 *
 * IPC handlers:
 *   theia:open-output      → abre ventana
 *   theia:close-output     → cierra ventana
 *   theia:get-video-sab    → devuelve SharedArrayBuffer (lazy create)
 *   theia:is-output-open   → boolean
 */

import { BrowserWindow, ipcMain, screen, type Display } from 'electron'
import path from 'path'
import {
  createSharedVideoFrameBuffer,
  VIDEO_SAB_BYTE_LENGTH,
} from '../src/theia/SharedVideoFrameBuffer'

// ─────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────

interface TheiaWindowManagerOptions {
  isDev: boolean
  /** URL del dev server (ej. 'http://localhost:5173'). */
  devUrl: string
  /** Ruta absoluta al index.html de producción. */
  prodIndexPath: string
  /** Path absoluto al preload.js. */
  preloadPath: string
}

// ─────────────────────────────────────────────────────────────────────────
// Manager
// ─────────────────────────────────────────────────────────────────────────

export class TheiaWindowManager {
  private static _instance: TheiaWindowManager | null = null

  private outputWindow: BrowserWindow | null = null
  private videoSAB: SharedArrayBuffer | null = null
  private opts: TheiaWindowManagerOptions

  private constructor(opts: TheiaWindowManagerOptions) {
    this.opts = opts
  }

  static initialize(opts: TheiaWindowManagerOptions): TheiaWindowManager {
    if (!TheiaWindowManager._instance) {
      TheiaWindowManager._instance = new TheiaWindowManager(opts)
      TheiaWindowManager._instance.registerIPCHandlers()
    }
    return TheiaWindowManager._instance
  }

  static getInstance(): TheiaWindowManager | null {
    return TheiaWindowManager._instance
  }

  // ─── SAB ────────────────────────────────────────────────────────────────

  /**
   * Devuelve (creando si hace falta) el SharedArrayBuffer del video pipeline.
   * El SAB se crea una sola vez y sobrevive a aperturas múltiples de la ventana.
   */
  getVideoFrameSAB(): SharedArrayBuffer {
    if (!this.videoSAB) {
      this.videoSAB = createSharedVideoFrameBuffer()
      // eslint-disable-next-line no-console
      console.log(`[TheiaWindowManager] 🎬 created video SAB (${(VIDEO_SAB_BYTE_LENGTH / (1024 * 1024)).toFixed(1)} MB)`)
    }
    return this.videoSAB
  }

  // ─── Window lifecycle ───────────────────────────────────────────────────

  isOutputOpen(): boolean {
    return this.outputWindow !== null && !this.outputWindow.isDestroyed()
  }

  openOutput(): { ok: boolean; error?: string } {
    if (this.isOutputOpen()) {
      // Re-foco si ya está abierta (la ventana puede estar oculta)
      this.outputWindow?.show()
      this.outputWindow?.focus()
      return { ok: true }
    }

    try {
      const targetDisplay = this.pickTargetDisplay()
      const primaryDisplay = screen.getPrimaryDisplay()
      const externalDisplay = targetDisplay.id !== primaryDisplay.id ? targetDisplay : null

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
          })

      // Mostrar la ventana SOLO cuando el renderer haya pintado el primer frame.
      // Evita el frame negro que captura el foco de sistema antes de estar lista.
      this.outputWindow.once('ready-to-show', () => {
        this.outputWindow?.show()
      })

      // ESC sale de fullscreen / cierra (atajo de operador)
      this.outputWindow.webContents.on('before-input-event', (_, input) => {
        if (input.type === 'keyDown' && input.key === 'Escape') {
          this.closeOutput()
        }
      })

      this.outputWindow.on('closed', () => {
        this.outputWindow = null
      })

      // Cargar la URL con flag ?theia-output=1 — main.tsx detecta y monta TheiaOutputView
      if (this.opts.isDev) {
        void this.outputWindow.loadURL(`${this.opts.devUrl}?theia-output=1`)
      } else {
        void this.outputWindow.loadFile(this.opts.prodIndexPath, {
          query: { 'theia-output': '1' },
        })
      }

      // eslint-disable-next-line no-console
      const openedDisplayLabel = externalDisplay
        ? `external display ${externalDisplay.id} (${externalDisplay.bounds.x},${externalDisplay.bounds.y})`
        : `primary display ${primaryDisplay.id} (fallback 800x450)`
      console.log(`[TheiaWindowManager] 🎬 output window opened on ${openedDisplayLabel}`)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error('[TheiaWindowManager] openOutput failed:', msg)
      return { ok: false, error: msg }
    }
  }

  closeOutput(): void {
    if (this.outputWindow && !this.outputWindow.isDestroyed()) {
      try {
        this.outputWindow.destroy()
      } catch {
        /* noop */
      }
    }
    this.outputWindow = null
  }

  /** Selecciona el monitor donde abrir: externo si existe, primario si no. */
  private pickTargetDisplay(): Display {
    const all = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const externalDisplay = all.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0)
    return externalDisplay ?? primary
  }

  // ─── IPC ────────────────────────────────────────────────────────────────

  private registerIPCHandlers(): void {
    ipcMain.handle('theia:open-output', () => this.openOutput())
    ipcMain.handle('theia:close-output', () => {
      this.closeOutput()
      return { ok: true }
    })
    ipcMain.handle('theia:is-output-open', () => this.isOutputOpen())
    ipcMain.handle('theia:get-video-sab', (): SharedArrayBuffer | null => {
      // invoke()+structured clone no es fiable para SAB en todos los entornos
      // de Electron (especialmente file:// empaquetado). Evitamos throw global.
      return null
    })
  }

  // ─── Shutdown ──────────────────────────────────────────────────────────

  shutdown(): void {
    this.closeOutput()
    // El SAB se libera cuando todos los handlers GC-en sus referencias.
    this.videoSAB = null
  }
}

/**
 * Helper de conveniencia para integrar desde main.ts:
 *   const theiaMgr = setupTheiaWindowManager({ isDev, ... })
 */
export function setupTheiaWindowManager(opts: TheiaWindowManagerOptions): TheiaWindowManager {
  return TheiaWindowManager.initialize(opts)
}

/** Path helper para resolver el preload desde main.ts (typing-friendly). */
export function defaultPreloadPath(__dirnameFromMain: string): string {
  return path.join(__dirnameFromMain, 'preload.js')
}
