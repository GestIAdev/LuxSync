// WAVE-6005-SPIKE-3: Main — Privileged protocol 'aether' + COOP/COEP → SAB cruza sin bloqueo.

import { app, BrowserWindow, protocol, MessageChannelMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// ═══════════════════════════════════════════════════════════════════════════
// PASO 1: Registrar esquema privilegiado ANTES de app.whenReady()
// ═══════════════════════════════════════════════════════════════════════════
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'aether',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const SAB_BYTES = 1024 * 1024 // 1 MB
const INTERVAL_MS = 22 // ~44Hz

let mainWindow: BrowserWindow | null = null
let sab: SharedArrayBuffer
let view: Int32Array
let tick = 0
let timer: ReturnType<typeof setInterval> | null = null

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function createSAB(): void {
  sab = new SharedArrayBuffer(SAB_BYTES)
  view = new Int32Array(sab)
  console.log(`[MAIN] SAB creado: ${(SAB_BYTES / 1024).toFixed(0)} KB`)
}

function startWriting(): void {
  timer = setInterval(() => {
    tick++
    Atomics.store(view, 0, tick)
    Atomics.store(view, 1, (tick * 7 + 13) & 0xff)
    if (tick % 100 === 0) {
      console.log(`[MAIN] tick=${tick} | SAB[0]=${Atomics.load(view, 0)} SAB[1]=${Atomics.load(view, 1)}`)
    }
  }, INTERVAL_MS)
}

function createWindow(): void {
  const preloadPath = path.join(__dirname, 'spike3-preload.js')

  mainWindow = new BrowserWindow({
    width: 600,
    height: 480,
    title: 'WAVE-6005-SPIKE-3 — Glass Bridge Privileged',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      backgroundThrottling: false,
    },
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] did-finish-load — enviando SAB via MessageChannelMain')
    mainWindow!.webContents.openDevTools({ mode: 'detach' })
    const { port1, port2 } = new MessageChannelMain()
    mainWindow!.webContents.postMessage('glass-bridge', null, [port2])
    port1.postMessage({ sab })
    startWriting()
  })

  mainWindow.on('closed', () => {
    if (timer) clearInterval(timer)
    mainWindow = null
  })

  void mainWindow.loadURL('aether://localhost/index.html')
}

// ═══════════════════════════════════════════════════════════════════════════
// App lifecycle
// ═══════════════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
  // PASO 1b: Handler del protocolo con headers COOP/COEP
  protocol.handle('aether', (request) => {
    const url = new URL(request.url)
    let filePath: string

    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.join(__dirname, 'spike3-renderer.html')
    } else {
      filePath = path.join(__dirname, url.pathname)
    }

    const body = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
    }
    const mime = mimeMap[ext] || 'application/octet-stream'

    return new Response(body, {
      headers: {
        'Content-Type': mime,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    })
  })

  createSAB()
  createWindow()
})

app.on('window-all-closed', () => {
  if (timer) clearInterval(timer)
  app.quit()
})
