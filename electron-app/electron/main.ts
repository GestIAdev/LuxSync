/**
 * LUXSYNC ELECTRON - MAIN PROCESS
 */

import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
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
      // WAVE 9.6.2: Permisos para audio del sistema
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
  })
  
  // WAVE 9.6.2: Permitir captura de audio del sistema
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'audioCapture', 'display-capture']
    if (allowedPermissions.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
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

// WAVE 9.6.2: Desktop Capturer para audio del sistema
ipcMain.handle('audio:getDesktopSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 0, height: 0 }
    })
    console.log('[Main] Desktop sources found:', sources.length)
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      displayId: s.display_id
    }))
  } catch (err) {
    console.error('[Main] Failed to get desktop sources:', err)
    return []
  }
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
        '| 🎵 Audio:', useRealAudio ? 'LIVE' : 'SIM',
        '| 🧠 Mode:', state.brainMode || 'legacy')
    }
    
    // 🔺 TRINITY PHASE 2: Transform state to UI format
    const uiState = {
      colors: state.colors ? {
        primary: state.colors.primary,
        secondary: state.colors.secondary,
        accent: state.colors.accent,
      } : undefined,
      movement: state.movement ? {
        pan: state.movement.pan,
        tilt: state.movement.tilt,
        pattern: state.movement.pattern,
        speed: state.movement.speed,
      } : undefined,
      beat: state.beat ? {
        bpm: state.beat.bpm,
        onBeat: state.beat.onBeat,
        beatPhase: state.beat.phase,
        confidence: state.beat.confidence,
      } : undefined,
      brain: {
        mode: state.brainMode || 'reactive',
        confidence: state.brainOutput?.confidence || 0.5,
        beautyScore: state.consciousness?.beautyScore || 0.5,
        energy: audioInput.energy,
        mood: state.brainOutput?.context?.mood || 'neutral',
        section: state.brainOutput?.context?.section?.current?.type || 'unknown',
      },
      palette: {
        name: String(state.palette),
        source: state.paletteSource || 'legacy',
      },
      frameId: state.stats?.frames || frameIndex,
      timestamp: now,
    }
    
    mainWindow.webContents.send('lux:state-update', uiState)
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

ipcMain.handle('lux:set-movement', (_event, config: { pattern?: MovementPattern; speed?: number; intensity?: number }) => {
  if (!selene) return { success: false, error: 'Selene not initialized' }
  
  // Aplicar pattern si viene en el config
  if (config.pattern) {
    selene.setMovementPattern(config.pattern)
  }
  
  // TODO: speed e intensity se pueden usar para configurar el MovementEngine
  // Por ahora solo loggeamos
  console.log('[Main] 🎯 Movement config:', config)
  
  return { success: true, config }
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

// ============================================
// WAVE 9.5: FIXTURE LIBRARY IPC HANDLERS
// ============================================

import fs from 'fs'

// Tipos para fixtures (simplificados para IPC)
interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
}

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
}

// Estado de fixtures
let fixtureLibrary: FixtureLibraryItem[] = []
let patchedFixtures: PatchedFixture[] = []

// Parsear archivo .fxt (simplificado)
function parseFXTFile(filePath: string): FixtureLibraryItem | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split(/\r?\n/)
    
    // Línea 0: Fabricante
    const manufacturer = lines[0]?.trim() || 'Unknown'
    
    // Buscar nombre y canales
    let name = path.basename(filePath, '.fxt')
    let channelCount = 0
    
    // Líneas típicas de .fxt tienen estructura específica
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim()
      
      // Detectar número de canales (línea con solo número)
      if (/^\d+$/.test(line) && parseInt(line) > 0 && parseInt(line) <= 512) {
        channelCount = parseInt(line)
      }
      
      // Algunas líneas tienen el nombre real del fixture
      if (line.length > 3 && !line.includes('"') && !line.includes('.') && !line.includes('\\')) {
        if (i > 2 && i < 10) {
          name = line
        }
      }
    }
    
    // Detectar tipo por nombre
    const nameLower = name.toLowerCase()
    let type = 'generic'
    if (nameLower.includes('moving') || nameLower.includes('beam') || nameLower.includes('spot')) {
      type = 'moving_head'
    } else if (nameLower.includes('par') || nameLower.includes('led')) {
      type = 'par'
    } else if (nameLower.includes('strobe')) {
      type = 'strobe'
    } else if (nameLower.includes('wash')) {
      type = 'wash'
    }
    
    return {
      id: path.basename(filePath, '.fxt').replace(/\s+/g, '_').toLowerCase(),
      name,
      manufacturer,
      channelCount: channelCount || 1,
      type,
      filePath,
    }
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err)
    return null
  }
}

// Escanear carpeta de fixtures
ipcMain.handle('lux:scan-fixtures', async (_event, customPath?: string) => {
  try {
    // Rutas por defecto
    const defaultPaths = [
      path.join(app.getPath('userData'), 'fixtures'),
      path.join(__dirname, '../../fixtures'),
      path.join(__dirname, '../../../fixtures'),
      path.join(__dirname, '../../librerias'),
      path.join(__dirname, '../../../librerias'),
    ]
    
    const searchPaths = customPath ? [customPath, ...defaultPaths] : defaultPaths
    const foundFixtures: FixtureLibraryItem[] = []
    
    for (const searchPath of searchPaths) {
      if (!fs.existsSync(searchPath)) continue
      
      const files = fs.readdirSync(searchPath)
      for (const file of files) {
        if (file.toLowerCase().endsWith('.fxt')) {
          const fullPath = path.join(searchPath, file)
          const fixture = parseFXTFile(fullPath)
          if (fixture) {
            foundFixtures.push(fixture)
          }
        }
      }
    }
    
    fixtureLibrary = foundFixtures
    console.log(`[Fixtures] 📦 Found ${foundFixtures.length} fixtures`)
    
    return { 
      success: true, 
      fixtures: foundFixtures,
      searchPaths: searchPaths.filter(p => fs.existsSync(p))
    }
  } catch (err) {
    console.error('[Fixtures] Scan error:', err)
    return { success: false, error: String(err), fixtures: [] }
  }
})

// Obtener biblioteca de fixtures
ipcMain.handle('lux:get-fixture-library', () => {
  return { success: true, fixtures: fixtureLibrary }
})

// Obtener fixtures patcheados
ipcMain.handle('lux:get-patched-fixtures', () => {
  return { success: true, fixtures: patchedFixtures }
})

// Añadir fixture al patch
ipcMain.handle('lux:patch-fixture', (_event, data: { fixtureId: string; dmxAddress: number; universe?: number }) => {
  const libraryFixture = fixtureLibrary.find(f => f.id === data.fixtureId)
  if (!libraryFixture) {
    return { success: false, error: 'Fixture not found in library' }
  }
  
  const patched: PatchedFixture = {
    ...libraryFixture,
    dmxAddress: data.dmxAddress,
    universe: data.universe || 1,
  }
  
  patchedFixtures.push(patched)
  console.log(`[Fixtures] ✅ Patched ${libraryFixture.name} at DMX ${data.dmxAddress}`)
  
  return { success: true, fixture: patched, totalPatched: patchedFixtures.length }
})

// Eliminar fixture del patch
ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress: number) => {
  const index = patchedFixtures.findIndex(f => f.dmxAddress === dmxAddress)
  if (index === -1) {
    return { success: false, error: 'Fixture not found at that address' }
  }
  
  const removed = patchedFixtures.splice(index, 1)[0]
  console.log(`[Fixtures] 🗑️ Unpatched ${removed.name} from DMX ${dmxAddress}`)
  
  return { success: true, removed, totalPatched: patchedFixtures.length }
})

// Limpiar todo el patch
ipcMain.handle('lux:clear-patch', () => {
  const count = patchedFixtures.length
  patchedFixtures = []
  console.log(`[Fixtures] 🧹 Cleared ${count} fixtures from patch`)
  return { success: true, cleared: count }
})

// ============================================
// WAVE 9.5: CONFIG PERSISTENCE
// ============================================

interface LuxSyncConfig {
  audio: {
    source: 'microphone' | 'system' | 'simulation'
    deviceId?: string
    sensitivity: number
  }
  dmx: {
    driver: string
    port: string
    universe: number
    frameRate: number
  }
  fixtures: PatchedFixture[]
  ui: {
    theme: string
    showAdvanced: boolean
  }
}

const CONFIG_FILE = path.join(app.getPath('userData'), 'luxsync-config.json')

function getDefaultConfig(): LuxSyncConfig {
  return {
    audio: {
      source: 'simulation',
      sensitivity: 50,
    },
    dmx: {
      driver: 'enttec-open',
      port: 'COM3',
      universe: 1,
      frameRate: 44,
    },
    fixtures: [],
    ui: {
      theme: 'dark',
      showAdvanced: false,
    },
  }
}

function loadConfig(): LuxSyncConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const config = JSON.parse(data) as LuxSyncConfig
      // Restaurar fixtures patcheados
      patchedFixtures = config.fixtures || []
      return config
    }
  } catch (err) {
    console.error('[Config] Error loading config:', err)
  }
  return getDefaultConfig()
}

function saveConfig(config: Partial<LuxSyncConfig>): boolean {
  try {
    const currentConfig = loadConfig()
    const newConfig = { ...currentConfig, ...config, fixtures: patchedFixtures }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2))
    console.log('[Config] 💾 Config saved')
    return true
  } catch (err) {
    console.error('[Config] Error saving config:', err)
    return false
  }
}

// IPC Handlers para config
ipcMain.handle('lux:get-config', () => {
  return { success: true, config: loadConfig() }
})

ipcMain.handle('lux:save-config', (_event, config: Partial<LuxSyncConfig>) => {
  const success = saveConfig(config)
  return { success }
})

ipcMain.handle('lux:reset-config', () => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
    patchedFixtures = []
    return { success: true, config: getDefaultConfig() }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

// Cargar config al iniciar
loadConfig()

console.log('LuxSync Main Process Started')
