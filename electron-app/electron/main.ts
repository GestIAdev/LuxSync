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

// ============================================
// AUDIO STATE (receives real data from renderer)
// ============================================
let currentAudioData: {
  bass: number
  mid: number
  treble: number
  energy: number
  bpm: number
  onBeat: boolean
} = {
  bass: 0.3,
  mid: 0.3,
  treble: 0.3,
  energy: 0.3,
  bpm: 120,
  onBeat: false,
}

function startMainLoop() {
  if (mainLoopInterval) return
  
  let frameIndex = 0
  
  mainLoopInterval = setInterval(() => {
    if (!selene || !mainWindow) return
    
    const now = Date.now()
    const deltaTime = now - lastFrameTime
    lastFrameTime = now
    
    // Use real audio data or fallback to gentle simulation
    const useRealAudio = currentAudioData.energy > 0.05
    const audioInput = useRealAudio ? currentAudioData : {
      bass: 0.3 + Math.sin(now * 0.002) * 0.1,
      mid: 0.3 + Math.sin(now * 0.003) * 0.1,
      treble: 0.3 + Math.sin(now * 0.005) * 0.1,
      energy: 0.3 + Math.sin(now * 0.001) * 0.1,
      bpm: 120,
      onBeat: Math.sin(now * 0.008) > 0.95,
    }
    
    frameIndex++
    
    const state = selene.processAudioFrame({
      bass: audioInput.bass,
      mid: audioInput.mid,
      treble: audioInput.treble,
      energy: audioInput.energy,
      bpm: audioInput.bpm,
      beatPhase: (now % (60000 / audioInput.bpm)) / (60000 / audioInput.bpm),
      beatConfidence: useRealAudio ? 0.8 : 0.5,
      onBeat: audioInput.onBeat,
      peak: audioInput.energy * 1.2,
      timestamp: now,
      frameIndex,
    }, deltaTime)
    
    // 🔊 DMX LOG - Log every 30 frames (~1 second)
    if (Math.random() < 0.033) {
      const c = state.colors
      console.log('[DMX] 🎨 RGB:', 
        c.primary.r.toFixed(0), c.primary.g.toFixed(0), c.primary.b.toFixed(0), 
        '| 🎯 Pos:', state.movement?.pan?.toFixed(2) || 0, state.movement?.tilt?.toFixed(2) || 0,
        '| 🥁 Beat:', state.beat?.onBeat ? 'HIT' : '---',
        '| 🎵 Audio:', useRealAudio ? 'LIVE' : 'SIM')
    }
    
    mainWindow.webContents.send('lux:update-state', state)
  }, 30)
  
  console.log('Selene main loop started (30ms) - DMX output active')
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
  bpm?: number
}) => {
  // 🔗 WAVE 3: Update current audio data for main loop
  currentAudioData = {
    bass: audioData.bass,
    mid: audioData.mid,
    treble: audioData.treble,
    energy: audioData.energy,
    bpm: audioData.bpm || 120,
    onBeat: audioData.bass > 0.7, // High bass = beat hit
  }
  
  return { success: true }
})

console.log('LuxSync Main Process Started')
