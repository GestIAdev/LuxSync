/**
 * LUXSYNC ELECTRON - MAIN PROCESS
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { SeleneLux } from '../src/main/selene-lux-core/SeleneLux'
import type { LivingPaletteId } from '../src/main/selene-lux-core/engines/visual/ColorEngine'
import type { MovementPattern } from '../src/main/selene-lux-core/types'

let mainWindow: BrowserWindow | null = null
let selene: SeleneLux | null = null
let mainLoopInterval: NodeJS.Timeout | null = null
let lastFrameTime = Date.now()

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#7C4DFF',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================
// IPC HANDLERS - Basic
// ============================================

ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('dmx:getStatus', () => {
  return { connected: false, interface: 'none' }
})

ipcMain.handle('audio:getDevices', async () => {
  return []
})

// ============================================
// SELENE LUX CORE - Engine & Loop
// ============================================

function initSelene() {
  selene = new SeleneLux({
    audio: {
      device: 'default',
      sensitivity: 0.7,
      noiseGate: 0.05,
      fftSize: 2048,
      smoothing: 0.8,
    },
    visual: {
      transitionTime: 300,
      colorSmoothing: 0.85,
      movementSmoothing: 0.8,
      effectIntensity: 1.0,
    },
    dmx: {
      universe: 1,
      driver: 'virtual',
      frameRate: 40,
    },
  })
  console.log('Selene LUX initialized')
}

function startMainLoop() {
  if (mainLoopInterval) return
  
  mainLoopInterval = setInterval(() => {
    if (!selene || !mainWindow) return
    
    const now = Date.now()
    const deltaTime = now - lastFrameTime
    lastFrameTime = now
    
    const state = selene.processAudioFrame({
      bass: 0.5 + Math.sin(now * 0.002) * 0.3,
      mid: 0.4 + Math.sin(now * 0.003) * 0.2,
      treble: 0.3 + Math.sin(now * 0.005) * 0.2,
      energy: 0.5 + Math.sin(now * 0.001) * 0.3,
      spectralCentroid: 2000,
      spectralFlux: 0.1,
      rms: 0.4,
      peak: 0.7,
      zeroCrossings: 100,
    }, deltaTime)
    
    mainWindow.webContents.send('lux:update-state', state)
  }, 30)
  
  console.log('Selene main loop started (30ms)')
}

function stopMainLoop() {
  if (mainLoopInterval) {
    clearInterval(mainLoopInterval)
    mainLoopInterval = null
  }
}

// ============================================
// SELENE IPC HANDLERS
// ============================================

ipcMain.handle('lux:set-palette', (_event, palette: LivingPaletteId) => {
  if (!selene) return { success: false, error: 'Selene not initialized' }
  selene.setPalette(palette)
  return { success: true, palette }
})

ipcMain.handle('lux:set-movement', (_event, pattern: MovementPattern) => {
  if (!selene) return { success: false, error: 'Selene not initialized' }
  selene.setMovementPattern(pattern)
  return { success: true, pattern }
})

ipcMain.handle('lux:get-state', () => {
  if (!selene) return null
  return selene.getState()
})

ipcMain.handle('lux:start', () => {
  initSelene()
  startMainLoop()
  return { success: true }
})

ipcMain.handle('lux:stop', () => {
  stopMainLoop()
  selene = null
  return { success: true }
})

ipcMain.handle('lux:audio-frame', (_event, audioData: {
  bass: number
  mid: number
  treble: number
  energy: number
}) => {
  if (!selene || !mainWindow) return null
  
  const now = Date.now()
  const deltaTime = now - lastFrameTime
  lastFrameTime = now
  
  const state = selene.processAudioFrame({
    ...audioData,
    spectralCentroid: 2000,
    spectralFlux: 0.1,
    rms: audioData.energy * 0.8,
    peak: audioData.energy,
    zeroCrossings: 100,
  }, deltaTime)
  
  return state
})

console.log('LuxSync Main Process Started')
