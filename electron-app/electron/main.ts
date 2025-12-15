/**
 * LUXSYNC ELECTRON - MAIN PROCESS
 */

import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'path'
import { SeleneLux } from '../src/main/selene-lux-core/SeleneLux'
import type { LivingPaletteId } from '../src/main/selene-lux-core/engines/visual/ColorEngine'
import type { MovementPattern } from '../src/main/selene-lux-core/types'
import { configManager, type PatchedFixtureConfig } from './ConfigManager'
// 🧠 WAVE 10: Trinity Orchestrator for worker communication
import { getTrinity } from '../src/main/workers/TrinityOrchestrator'
// 🌪️ WAVE 11: UniversalDMXDriver - Soporte para CUALQUIER chip serial
import { universalDMX, type DMXDevice } from './UniversalDMXDriver'
// ⚡ WAVE 10.7: EffectsEngine para efectos de pánico
import { EffectsEngine } from '../src/main/selene-lux-core/engines/visual/EffectsEngine'
// 🎭 WAVE 26: ShowManager for save/load/delete shows
import { showManager } from './ShowManager'

let mainWindow: BrowserWindow | null = null
let selene: SeleneLux | null = null
let effectsEngine: EffectsEngine | null = null // ⚡ Global effects engine
let mainLoopInterval: NodeJS.Timeout | null = null
let lastFrameTime = Date.now()
let brainMetricsCounter = 0 // 🧠 Para throttle de métricas al UI

// 🌙 WAVE 25.5: Last calculated fixture states para el broadcast
let lastFixtureStatesForBroadcast: Array<{
  dmxAddress: number
  universe: number
  name: string
  zone: string
  type: string
  dimmer: number
  r: number
  g: number
  b: number
  pan: number
  tilt: number
}> = []

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ⚡ WAVE 10.7: HSL to RGB helper for rainbow effect
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

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

  // WAVE 9.6.3: CRITICAL - Handler para getDisplayMedia popup
  // Sin esto, el popup de selección de pantalla NO aparece en Electron
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    console.log('[Main] Display media request received')
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 }
      })
      console.log('[Main] Available sources:', sources.map(s => s.name))
      
      // Devolver la primera fuente (pantalla completa) con audio
      // El usuario puede cambiar esto en el popup nativo
      if (sources.length > 0) {
        callback({ video: sources[0], audio: 'loopback' })
      } else {
        callback({ video: undefined, audio: undefined })
      }
    } catch (err) {
      console.error('[Main] Display media error:', err)
      callback({ video: undefined, audio: undefined })
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
    
    // 🚨 WAVE 14.9: Broadcast fixtures por canal dedicado (solo una vez al inicio)
    if (patchedFixtures.length > 0 && mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
      console.log(`[Main] 📡 Broadcasted ${patchedFixtures.length} fixtures to renderer`)
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
  // 🔧 WAVE 10: Cargar configuración guardada ANTES de crear la ventana
  const savedConfig = configManager.load()
  
  // Restaurar patch de fixtures
  if (savedConfig.patchedFixtures.length > 0) {
    // 🔥 WAVE 10 FIX: Re-asignar zonas al restaurar para corregir cualquier inconsistencia
    resetZoneCounters()
    patchedFixtures = savedConfig.patchedFixtures.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      manufacturer: f.manufacturer,
      channelCount: f.channelCount,
      dmxAddress: f.dmxAddress,
      universe: f.universe,
      zone: autoAssignZone(f.type, f.name), // 🔥 Re-calcular zona, NO usar la guardada
      filePath: f.filePath,
    }))
    recalculateZoneCounters()
    console.log(`[Main] 🔄 Restored ${patchedFixtures.length} fixtures from config`)
    
    // 🚨 WAVE 14.9: Broadcast fixtures por canal dedicado (después de crear ventana)
    // Nota: La ventana aún no existe aquí, se enviará en createWindow
  }
  
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 🔧 WAVE 10: Guardar config al cerrar
app.on('before-quit', () => {
  configManager.forceSave()
  console.log('[Main] 💾 Config saved before quit')
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
  // Idempotent init: if selene already exists, do nothing
  if (globalThis.__lux_isSystemRunning) {
    console.log('[Main] ⚠️ initSelene called but system already running - skipping')
    return
  }

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
  
  // ⚡ WAVE 10.7: Initialize effects engine for panic buttons
  effectsEngine = new EffectsEngine()
  console.log('[Main] ⚡ EffectsEngine initialized for panic buttons')
  
  console.log('Selene LUX initialized')
  
  // 🌊 WAVE 12.5: Auto-inicializar el Brain para que los colores procedan del ProceduralPaletteGenerator
  selene.initializeBrain().then(async () => {
    console.log('[Main] 🧠 Brain auto-initialized for procedural colors')
    
    // 🔧 WAVE 15.2: AUTO-START SELENE MODE - No esperar al clic del usuario
    // El modo Selene es el default profesional - arrancamos Trinity inmediatamente
    selene.setMode('selene')
    selene.setUseBrain(true)
    
    const trinity = getTrinity()
    if (trinity) {
      try {
        await trinity.start()
        console.log('[Main] 🛡️ TRINITY AUTO-STARTED - All workers spawned')
        trinity.enableBrain()
        
        // 💉 Inyectar configuración inicial incluyendo inputGain
        const savedConfig = configManager.getConfig()
        const savedGain = savedConfig.audio?.inputGain ?? 1.0
        trinity.updateConfig({ inputGain: savedGain })
        console.log(`[Main] 💉 Injected initial config: Gain=${(savedGain * 100).toFixed(0)}%`)
        
        // 📡 WAVE 15.3: CONECTAR TRINITY → FRONTEND (El Cable de la Verdad)
        // Los datos REALES de Beta/Gamma ahora fluyen al frontend
        trinity.on('audio-analysis', (analysis) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('trinity:audio-analysis', analysis)
          }
        })
        
        trinity.on('lighting-decision', (decision) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('trinity:lighting-decision', decision)
          }
        })
        
        console.log('[Main] 📡 TRUTH CABLE CONNECTED - Trinity → Frontend')
        
      } catch (err) {
        console.warn('[Main] ⚠️ Trinity auto-start failed (non-fatal):', err)
      }
    }
    
    console.log('[Main] ⚡ SELENE MODE AUTO-ACTIVATED!')
    console.log('[Main] 🧠 Brain: ENABLED (default)')
    
    // Notify UI that mode is 'selene' by default
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lux:mode-change', { mode: 'selene', brain: true })
    }
  }).catch((err) => {
    console.warn('[Main] ⚠️ Brain init failed (colors will be legacy):', err)
  })
  
  // 📡 WAVE-14: Forward telemetry updates to renderer
  // 🌙 WAVE 25: DEPRECATED - Now included in selene:truth broadcast
  // TODO: Remove after frontend migration complete
  selene.on('telemetry-update', (packet) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // mainWindow.webContents.send('selene:telemetry-update', packet)
    }
  })
  console.log('[Main] 📡 Telemetry forwarding DISABLED (WAVE 25 - use selene:truth)')

  // 📜 WAVE 25.7: THE CHRONICLER - Forward logs to renderer via dedicated channel
  selene.on('log', (logEntry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('selene:log', logEntry)
    }
  })
  console.log('[Main] 📜 Log forwarding ENABLED (WAVE 25.7 - selene:log)')

  // mark system as running
  globalThis.__lux_isSystemRunning = true
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌙 WAVE 25: UNIVERSAL TRUTH BROADCAST - 30 FPS Heartbeat
  // ═══════════════════════════════════════════════════════════════════════════
  // Este loop es SEPARADO del mainLoop de audio/DMX para garantizar 30fps
  // El Frontend recibe la VERDAD COMPLETA aquí, no fragmentos dispersos
  setInterval(() => {
    if (selene && mainWindow && !mainWindow.isDestroyed()) {
      const truth = selene.getBroadcast()
      
      // 🌙 WAVE 25.5: Poblar hardwareState.fixtures con datos reales
      truth.hardwareState.fixturesTotal = lastFixtureStatesForBroadcast.length
      truth.hardwareState.fixturesActive = lastFixtureStatesForBroadcast.filter(f => f.dimmer > 0).length
      truth.hardwareState.fixtures = lastFixtureStatesForBroadcast.map(f => ({
        id: `fixture-${f.dmxAddress}`,
        name: f.name,
        type: f.type,
        dmxAddress: f.dmxAddress,
        zone: f.zone,
        color: {
          r: f.r,
          g: f.g,
          b: f.b,
          h: 0, s: 0, l: 0, // Simplificado, el Canvas calcula si necesita
          hex: `#${f.r.toString(16).padStart(2,'0')}${f.g.toString(16).padStart(2,'0')}${f.b.toString(16).padStart(2,'0')}`
        },
        intensity: f.dimmer / 255,
        pan: f.pan / 255,
        tilt: f.tilt / 255,
        active: f.dimmer > 0,
      }))
      truth.hardwareState.dmx.connected = universalDMX.isConnected
      
      mainWindow.webContents.send('selene:truth', truth)
    }
  }, 33) // 33ms ≈ 30 FPS
  console.log('[Main] 🌙 WAVE 25: Universal Truth Broadcast started @ 30fps')
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

// 🔄 FIX CRÍTICO 4: Anti-flicker smoothing para moving heads
const smoothedIntensities = new Map<number, number>()
const SMOOTHING_DECAY = 0.75 // 25% decay por frame (caída rápida y dramática)
const MOVING_HEAD_GATE = 0.15 // Threshold: si energy < 15%, NEGRO total

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
    
    // 🌙 WAVE 25: Update audio state for Universal Truth Broadcast
    selene.setAudioState(
      {
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
      },
      null, // AudioAnalysis se genera internamente en SeleneLux
      useRealAudio ? 'System Audio' : 'Simulation'
    )
    
    // 🔊 DMX LOG - Log every ~10 seconds (very sparse)
    if (Math.random() < 0.003) {
      const c = state.colors
      const currentMode = selene?.getState()?.mode || 'unknown' // Use Selene's actual mode (flow/selene/locked)
      console.log('[DMX] 🎨 RGB:', 
        c.primary.r.toFixed(0), c.primary.g.toFixed(0), c.primary.b.toFixed(0), 
        '| 🎯 Pos:', state.movement?.pan?.toFixed(2) || 0, state.movement?.tilt?.toFixed(2) || 0,
        '| 🥁 Beat:', state.beat?.onBeat ? 'HIT' : '---',
        '| 🎵 Audio:', useRealAudio ? 'LIVE' : 'SIM',
        '| 🧠 Mode:', currentMode)
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
    
    // 🔗 WAVE 9.6: Process fixtures by zone and send DMX values
    // 🔇 FIX CRÍTICO 1: SILENCE GATE - Si no hay audio real, BLACKOUT TOTAL
    const isSilence = !useRealAudio || audioInput.energy < 0.05
    
    const fixtureStates = patchedFixtures.map(fixture => {
      const color = state.colors?.primary || { r: 0, g: 0, b: 0 }
      const secondary = state.colors?.secondary || { r: 0, g: 0, b: 0 }
      const accent = state.colors?.accent || color // Para MOVING_LEFT
      const ambient = state.colors?.ambient || accent // Para MOVING_RIGHT (espejo cromático)
      
      // 🚨 DEBUG: Log RGB values periodically
      if (Math.random() < 0.005 && fixture.zone?.includes('MOVING')) {
        console.log(`[DEBUG-RGB] ${fixture.zone}:`, 
          `Primary=[${color.r},${color.g},${color.b}]`,
          `Accent=[${accent.r},${accent.g},${accent.b}]`,
          `Ambient=[${ambient.r},${ambient.g},${ambient.b}]`)
      }
      
      // 🔇 SILENCE GATE: Sin audio = sin luz
      if (isSilence) {
        return {
          dmxAddress: fixture.dmxAddress,
          universe: fixture.universe,
          name: fixture.name,
          zone: fixture.zone || 'UNASSIGNED',
          type: fixture.type || 'unknown',
          dimmer: 0, r: 0, g: 0, b: 0, pan: 127, tilt: 127, // Centro en silencio
        }
      }
      
      // Calculate intensity based on zone and audio
      let intensity = 0
      let fixtureColor = color
      const zone = fixture.zone || 'UNASSIGNED'
      
      switch (zone) {
        case 'FRONT_PARS':
          // PARs react strongly to bass (bombo)
          intensity = Math.min(1, audioInput.bass * 1.5)
          fixtureColor = color
          break
          
        case 'BACK_PARS':
          // Back PARs react to mid frequencies
          intensity = Math.min(1, audioInput.mid * 1.3)
          fixtureColor = secondary
          break
          
        case 'MOVING_LEFT': {
          // 🎨 MOVING_LEFT usa ACCENT (side='left') - CON DRAMA
          // Gate: sin energía suficiente = NEGRO
          if (audioInput.energy < MOVING_HEAD_GATE) {
            intensity = 0
            smoothedIntensities.set(fixture.dmxAddress, 0)
          } else {
            // Base intensity + bass punch (variación dramática)
            const bassPunch = audioInput.bass > 0.6 ? audioInput.bass * 0.4 : 0
            const targetIntensity = Math.min(1, (audioInput.energy * 1.0) + bassPunch)
            const prevIntensity = smoothedIntensities.get(fixture.dmxAddress) ?? 0
            // Subida rápida, bajada más lenta pero no infinita
            if (targetIntensity > prevIntensity) {
              intensity = targetIntensity // Subida INSTANTÁNEA
            } else {
              intensity = Math.max(prevIntensity * SMOOTHING_DECAY, targetIntensity)
            }
            smoothedIntensities.set(fixture.dmxAddress, intensity)
          }
          fixtureColor = accent
          break
        }
          
        case 'MOVING_RIGHT': {
          // 🪞 MOVING_RIGHT usa AMBIENT (side='right') - ESPEJO CON TREBLE
          // Gate: sin energía suficiente = NEGRO
          if (audioInput.energy < MOVING_HEAD_GATE) {
            intensity = 0
            smoothedIntensities.set(fixture.dmxAddress, 0)
          } else {
            // Treble punch (diferente al LEFT que usa bass)
            const treblePunch = audioInput.treble > 0.5 ? audioInput.treble * 0.3 : 0
            const targetIntensity = Math.min(1, (audioInput.energy * 0.9) + treblePunch)
            const prevIntensity = smoothedIntensities.get(fixture.dmxAddress) ?? 0
            // Subida rápida, bajada suave
            if (targetIntensity > prevIntensity) {
              intensity = targetIntensity // Subida INSTANTÁNEA
            } else {
              intensity = Math.max(prevIntensity * SMOOTHING_DECAY, targetIntensity)
            }
            smoothedIntensities.set(fixture.dmxAddress, intensity)
          }
          fixtureColor = ambient
          break
        }
          
        case 'STROBES':
          // Strobes only on strong beats
          intensity = audioInput.onBeat && audioInput.bass > 0.8 ? 1 : 0
          fixtureColor = { r: 255, g: 255, b: 255 }
          break
          
        default:
          intensity = audioInput.energy
          fixtureColor = color
      }
      
      // 🪞 FIX CRÍTICO 2: Espejo para MOVING_RIGHT
      let panValue = state.movement?.pan ?? 0.5
      if (zone === 'MOVING_RIGHT') {
        panValue = 1 - panValue // Invertir para efecto espejo
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🏠 WAVE 24.6: CEILING TILT INVERSION (Hardware Safety)
      // Para fixtures COLGADOS del techo, invertimos TILT globalmente.
      // Esto asegura que "arriba" en la UI sea "arriba" en la pista.
      // Sin inversión: tilt=0 apunta al techo (incorrecto si está colgado)
      // Con inversión: tilt=0 apunta a la pista (correcto para ceiling)
      // ═══════════════════════════════════════════════════════════════════════
      let tiltValue = state.movement?.tilt ?? 0.5
      const installationType = configManager.getInstallationType()
      if (installationType === 'ceiling' && zone.includes('MOVING')) {
        tiltValue = 1 - tiltValue // Invertir para fixtures colgados
      }
      
      return {
        dmxAddress: fixture.dmxAddress,
        universe: fixture.universe,
        name: fixture.name,
        zone: fixture.zone || 'UNASSIGNED',
        type: fixture.type || 'unknown',
        // DMX values
        // 🎨 FIX CRÍTICO: El DIMMER controla intensidad, RGB mantiene color PURO
        // Antes: RGB * intensity = colores lavados/grises
        // Ahora: RGB puro, dimmer = intensity
        dimmer: Math.round(intensity * 255),
        r: fixtureColor.r,  // ¡Color PURO sin multiplicar!
        g: fixtureColor.g,
        b: fixtureColor.b,
        // Movement for moving heads - Convert 0-1 to 0-255
        pan: zone.includes('MOVING') 
          ? Math.round(panValue * 255) 
          : 0,
        tilt: zone.includes('MOVING') 
          ? Math.round(tiltValue * 255) 
          : 0,
      }
    })
    
    // � WAVE 25.5: Guardar para broadcast de verdad
    lastFixtureStatesForBroadcast = fixtureStates
    
    // �🌪️ WAVE 11: Enviar valores DMX reales si el driver está conectado
    if (universalDMX.isConnected) {
      for (const fixture of fixtureStates) {
        const addr = fixture.dmxAddress
        
        // ⚡ WAVE 10.7: Apply effects override
        let finalDimmer = fixture.dimmer
        let finalR = fixture.r
        let finalG = fixture.g
        let finalB = fixture.b
        
        // 🔲 BLACKOUT: Override todo a 0
        if (blackoutActive) {
          finalDimmer = 0
          finalR = 0
          finalG = 0
          finalB = 0
        } else {
          // ⚡ Apply active effects
          if (activeEffectIds.has('strobe')) {
            // Strobe: parpadeo rápido (50% on/off cada ~50ms)
            const strobeOn = (Math.floor(now / 50) % 2) === 0
            finalDimmer = strobeOn ? 255 : 0
          }
          
          if (activeEffectIds.has('blinder')) {
            // Blinder: full white
            finalDimmer = 255
            finalR = 255
            finalG = 255
            finalB = 255
          }
          
          if (activeEffectIds.has('police')) {
            // Police: rojo/azul alternando cada 250ms
            const policePhase = (Math.floor(now / 250) % 2) === 0
            finalDimmer = 255
            finalR = policePhase ? 255 : 0
            finalG = 0
            finalB = policePhase ? 0 : 255
          }
          
          if (activeEffectIds.has('rainbow')) {
            // Rainbow: ciclo HSL
            const hue = (now / 3000) % 1
            const rgb = hslToRgb(hue, 1.0, 0.5)
            finalR = rgb.r
            finalG = rgb.g
            finalB = rgb.b
            finalDimmer = 255
          }
        }
        
        // Formato típico de moving head: Pan, Tilt, Dimmer, R, G, B, ...
        universalDMX.setChannel(addr, fixture.pan)       // Canal 1: Pan
        universalDMX.setChannel(addr + 1, fixture.tilt)  // Canal 2: Tilt
        universalDMX.setChannel(addr + 2, finalDimmer)   // Canal 3: Dimmer
        universalDMX.setChannel(addr + 3, finalR)        // Canal 4: Red
        universalDMX.setChannel(addr + 4, finalG)        // Canal 5: Green
        universalDMX.setChannel(addr + 5, finalB)        // Canal 6: Blue
      }
    }
    
    // ⚡ WAVE 10.7: Apply effects to UI state too
    const effectOverrides = {
      blackout: blackoutActive,
      strobe: activeEffectIds.has('strobe'),
      blinder: activeEffectIds.has('blinder'),
      police: activeEffectIds.has('police'),
      rainbow: activeEffectIds.has('rainbow'),
      beam: activeEffectIds.has('beam'),
      prism: activeEffectIds.has('prism'),
    }
    
    // 🌙 WAVE 25: DEPRECATED - Now included in selene:truth broadcast
    // TODO: Remove after frontend migration complete
    // mainWindow.webContents.send('lux:state-update', { ...uiState, fixtures: fixtureStates, effects: effectOverrides })
    
    // 🧠 BRAIN METRICS - cada ~200ms (6 frames de 30ms)
    // 🌙 WAVE 25: DEPRECATED - Now included in selene:truth broadcast
    // TODO: Remove after frontend migration complete
    brainMetricsCounter++
    if (brainMetricsCounter >= 6) {
      brainMetricsCounter = 0
      /* WAVE 25 DEPRECATED
      const brainStats = selene.getBrainStats?.()
      if (brainStats) {
        mainWindow.webContents.send('selene:brain-metrics', {
          energy: audioInput.energy,
          confidence: brainStats.hasMemory ? 0.95 : 0.7,
          mode: (selene as any).mode ?? 'flow',
          framesAnalyzed: (brainStats.session as any)?.frames ?? 0,
          patternsLearned: (brainStats.memory as any)?.totalLearned ?? 0,
          hasMemory: brainStats.hasMemory,
          beautyScore: (brainStats as any).beauty?.current ?? 0.75, // 🎨 Belleza actual
          sessionPatterns: (brainStats.session as any)?.patterns ?? 0,
          timestamp: Date.now()
        })
      }
      */
    }
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
  
  // 🔧 WAVE 10 FIX: Apply ALL movement parameters
  if (config.pattern) {
    selene.setMovementPattern(config.pattern)
  }
  
  if (config.speed !== undefined) {
    selene.setMovementSpeed(config.speed)
  }
  
  if (config.intensity !== undefined) {
    selene.setMovementRange(config.intensity)  // intensity maps to range
  }
  
  console.log('[Main] 🎯 Movement config applied:', config)
  
  return { success: true, config }
})

// ============================================
// ⚡ WAVE 10.7: EFFECTS CONTROL (Connected to EffectsEngine)
// ============================================

// Tracking active effects
let activeEffectIds = new Map<string, number>()

ipcMain.handle('lux:trigger-effect', (_event, data: { effectName: string; params?: Record<string, unknown>; duration?: number }) => {
  console.log(`[Main] ⚡ Effect request: ${data.effectName}`, data.params, `duration: ${data.duration || 0}ms`)
  
  if (!effectsEngine) {
    // Initialize if not ready
    effectsEngine = new EffectsEngine()
    console.log('[Main] ⚡ EffectsEngine lazy-initialized')
  }
  
  // Trigger effect in the engine
  const effectId = effectsEngine.triggerEffect(
    data.effectName, 
    data.params as Record<string, number> || {}, 
    data.duration || 0
  )
  
  activeEffectIds.set(data.effectName, effectId)
  console.log(`[Main] ⚡ Effect ACTIVE: ${data.effectName} (id: ${effectId})`)
  
  // 🔥 WAVE 10.7: Auto-expire effects with duration
  if (data.duration && data.duration > 0) {
    setTimeout(() => {
      if (activeEffectIds.has(data.effectName)) {
        activeEffectIds.delete(data.effectName)
        console.log(`[Main] ⏱️ Effect auto-expired: ${data.effectName}`)
        
        // Notify UI
        if (mainWindow) {
          mainWindow.webContents.send('lux:effect-expired', data.effectName)
        }
      }
    }, data.duration)
  }
  
  // Broadcast to UI
  if (mainWindow) {
    mainWindow.webContents.send('lux:effect-triggered', data.effectName, effectId)
  }
  
  return { success: true, effectId }
})

ipcMain.handle('lux:cancel-effect', (_event, effectIdOrName: number | string) => {
  // Support both numeric ID and effect name
  if (typeof effectIdOrName === 'string') {
    // Cancel by name
    const effectId = activeEffectIds.get(effectIdOrName)
    if (effectId !== undefined && effectsEngine) {
      effectsEngine.cancelEffect(effectId)
      activeEffectIds.delete(effectIdOrName)
      console.log(`[Main] 🛑 Effect cancelled by name: ${effectIdOrName}`)
    }
  } else {
    // Cancel by ID (legacy)
    if (effectsEngine) {
      effectsEngine.cancelEffect(effectIdOrName)
    }
    
    // Find and remove from tracking
    activeEffectIds.forEach((id, name) => {
      if (id === effectIdOrName) {
        activeEffectIds.delete(name)
        console.log(`[Main] 🛑 Effect cancelled: ${name}`)
      }
    })
  }
  return { success: true }
})

ipcMain.handle('lux:cancel-all-effects', () => {
  if (effectsEngine) {
    effectsEngine.cancelAllEffects()
  }
  activeEffectIds.clear()
  console.log('[Main] 🛑 All effects cancelled')
  return { success: true }
})

// Blackout state
let blackoutActive = false

ipcMain.handle('lux:set-blackout', (_event, active: boolean) => {
  blackoutActive = active
  console.log(`[Main] 🔲 Blackout: ${active ? 'ON' : 'OFF'}`)
  
  // Broadcast to DMX - set all dimmers to 0
  if (active && selene) {
    // TODO: Add blackout method to selene
    console.log('[Main] 🔲 Blackout applied to all fixtures')
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('lux:blackout-changed', active)
  }
  
  return { success: true, blackout: active }
})

ipcMain.handle('lux:get-state', () => {
  if (!selene) return null
  return selene.getState()
})

// 🎯 WAVE 13.6: FULL STATE SYNC - "Truth First"
// Devuelve el estado completo del Backend para sincronización inicial de la UI
ipcMain.handle('lux:get-full-state', () => {
  const seleneState = selene ? selene.getState() : null
  
  return {
    // DMX Status
    dmx: {
      isConnected: universalDMX.isConnected,
      status: universalDMX.isConnected ? 'connected' : 'disconnected',
      driver: universalDMX.device?.friendlyName || null,
      port: universalDMX.device?.path || null,
    },
    
    // Selene Status
    selene: {
      isRunning: selene !== null,
      mode: seleneState?.mode || null,
      brainMode: seleneState?.brainMode || null,
      paletteSource: seleneState?.paletteSource || null,
      consciousness: seleneState?.consciousness || null,
    },
    
    // 🚨 WAVE 14.9: Fixtures ELIMINADOS del handshake inicial
    // Ahora se cargan por canal dedicado (lux:config-loaded)
    // fixtures: patchedFixtures,  ← CORTADO
    
    // Audio Status (Trinity)
    audio: {
      hasWorkers: getTrinity() !== null,
    },
  }
})

ipcMain.handle('lux:start', () => {
  if (globalThis.__lux_isSystemRunning) {
    console.log('[Main] ⚠️ lux:start called but system already running - ignoring')
    // still ensure main loop is running
    startMainLoop()
    
    // 🔧 WAVE 15.1: Return saved inputGain even when already running
    const savedConfig = configManager.getConfig()
    const savedGain = savedConfig.audio?.inputGain ?? 1.0
    return { success: true, alreadyRunning: true, inputGain: savedGain }
  }

  initSelene()
  startMainLoop()
  
  // 🔧 WAVE 15.1: Return saved inputGain on fresh start
  const savedConfig = configManager.getConfig()
  const savedGain = savedConfig.audio?.inputGain ?? 1.0
  if (selene) {
    selene.setInputGain(savedGain)
  }
  console.log(`[Main] 🎚️ Restored inputGain from config: ${(savedGain * 100).toFixed(0)}%`)
  
  return { success: true, inputGain: savedGain }
})

ipcMain.handle('lux:stop', () => {
  stopMainLoop()
  if (selene) {
    try {
      // attempt graceful shutdown
      selene.shutdown && selene.shutdown()
    } catch (e) {
      console.warn('[Main] ⚠️ Error during selene.shutdown()', e)
    }
  }
  selene = null
  globalThis.__lux_isSystemRunning = false
  return { success: true }
})

// ============================================
// 🧠 WAVE 10: MODE CONTROL (Brain Link)
// ============================================
// Modos disponibles:
// - 'reactive': Respuesta básica al audio (legacy)
// - 'intelligent': SeleneMusicalBrain toma el control (AI full)

ipcMain.handle('lux:set-mode', async (_event, mode: 'reactive' | 'intelligent') => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  console.log(`[Main] 🧠 Setting mode to: ${mode}`)
  
  if (mode === 'intelligent') {
    // Activar el Brain (necesita inicialización si no está hecho)
    if (!selene['brainInitialized']) {
      await selene.initializeBrain()
    }
    selene.setUseBrain(true)
    console.log('[Main] 🧠 Intelligent mode ACTIVATED - SeleneMusicalBrain in control')
  } else {
    // Modo reactivo - desactivar el Brain
    selene.setUseBrain(false)
    console.log('[Main] 🔄 Reactive mode ACTIVATED - Legacy fallback')
  }
  
  return { success: true, mode }
})

// ============================================
// 🎚️ WAVE 10: BIG SWITCH HANDLER (UI Bridge)
// ============================================
// El Frontend usa 'flow' | 'selene' | 'locked'
// Este handler traduce al sistema interno y DESPIERTA LA BESTIA

ipcMain.handle('selene:setMode', async (_event, uiMode: 'flow' | 'selene' | 'locked') => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  console.log(`[Main] 🎚️ BIG SWITCH: ${uiMode.toUpperCase()}`)
  
  // 🧠 WAVE 10: Get Trinity orchestrator for worker communication
  let trinity: ReturnType<typeof getTrinity> | null = null
  try {
    trinity = getTrinity()
  } catch {
    console.log('[Main] Trinity not initialized yet - worker commands skipped')
  }
  
  let result: { success: boolean; mode?: string; brain?: boolean; error?: string }
  
  switch (uiMode) {
    case 'flow':
      // FLOW = Modo reactivo simple (lo que acabamos de pulir)
      selene.setMode('flow')
      selene.setUseBrain(false)
      
      // 🧠 WAVE 10: Disable brain in worker
      if (trinity) {
        trinity.disableBrain()
      }
      
      console.log('[Main] 🔄 FLOW MODE - Reactive lighting, no AI')
      result = { success: true, mode: 'flow', brain: false }
      break
      
    case 'selene':
      // SELENE = ACTIVAR EL CEREBRO COMPLETO 🧠
      selene.setMode('selene')
      
      // Inicializar el Brain si no está listo
      if (!selene['brainInitialized']) {
        console.log('[Main] 🧠 Initializing SeleneMusicalBrain...')
        await selene.initializeBrain()
      }
      
      // ENCENDER TODO
      selene.setUseBrain(true)
      
      // 🧠 WAVE 10: Start Trinity if not running, then enable brain in GAMMA
      if (trinity) {
        try {
          // Start Trinity (spawns BETA and GAMMA workers)
          await trinity.start()
          console.log('[Main] 🛡️ TRINITY ONLINE - All workers spawned')
        } catch (err) {
          console.warn('[Main] ⚠️ Trinity start failed (non-fatal):', err)
        }
        trinity.enableBrain()
      }
      
      // Check actual brain status
      const brainStats = selene.getBrainStats?.()
      const hasMemory = brainStats?.hasMemory ?? false
      
      console.log('[Main] ⚡ SELENE MODE ACTIVATED!')
      console.log('[Main] 🧠 Brain: ENABLED')
      console.log('[Main] 🎵 GenreClassifier: ACTIVE')
      console.log('[Main] 👁️ StalkingEngine: HUNTING')
      console.log('[Main] 🧬 EvolutionEngine: MUTATING')
      console.log(`[Main] 💾 Memory: ${hasMemory ? 'SQLite CONNECTED' : 'AMNESIA MODE (no persistence)'}`)
      
      result = { success: true, mode: 'selene', brain: true }
      break
      
    case 'locked':
      // LOCKED = Modo manual (colores estáticos, sin reacción)
      selene.setMode('locked')
      selene.setUseBrain(false)
      
      // 🧠 WAVE 10: Disable brain in worker
      if (trinity) {
        trinity.disableBrain()
      }
      
      console.log('[Main] 🔒 LOCKED MODE - Manual control only')
      result = { success: true, mode: 'locked', brain: false }
      break
      
    default:
      console.warn(`[Main] Unknown mode: ${uiMode}`)
      result = { success: false, error: `Unknown mode: ${uiMode}` }
  }
  
  // 🎯 WAVE 13.6: STATE OF TRUTH - Emitir evento de confirmación para que la UI se sincronice
  if (result.success && mainWindow) {
    mainWindow.webContents.send('selene:mode-changed', {
      mode: result.mode,
      brain: result.brain,
      timestamp: Date.now()
    })
    console.log(`[Main] 📡 Mode change confirmed to UI: ${result.mode}`)
  }
  
  return result
})

// 🎨 WAVE 13.6: STATE OF TRUTH - Multiplicadores Globales de Color
ipcMain.handle('lux:set-global-color-params', async (_event, params: { saturation?: number; intensity?: number }) => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  try {
    if (params.saturation !== undefined) {
      selene.setGlobalSaturation(params.saturation)
    }
    
    if (params.intensity !== undefined) {
      selene.setGlobalIntensity(params.intensity)
    }
    
    const current = selene.getGlobalColorParams()
    console.log(`[Main] 🎨 Global Color Params updated: Saturation=${(current.saturation * 100).toFixed(0)}%, Intensity=${(current.intensity * 100).toFixed(0)}%`)
    
    return { 
      success: true, 
      params: {
        saturation: current.saturation,
        intensity: current.intensity
      }
    }
  } catch (error) {
    console.error('[Main] ❌ Error setting global color params:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// 🧠 WAVE 10: GET BRAIN STATS (for UI)
// ============================================
ipcMain.handle('selene:getBrainStats', async () => {
  const brainStats = selene.getBrainStats?.()
  if (!brainStats) {
    return {
      connected: false,
      mode: 'reactive' as const,
      energy: 0,
      confidence: 0,
      beautyScore: 0.5,
      framesProcessed: 0,
      patternsLearned: 0,
      sessionPatterns: 0,
      memoryUsage: 0,
      sessionId: null,
    }
  }
  
  const sessionStats = brainStats.session as any
  const memoryStats = brainStats.memory as any
  
  return {
    connected: true,
    mode: (selene as any).mode === 'selene' ? 'intelligent' : 'reactive',
    energy: sessionStats?.avgEnergy ?? 0,
    confidence: sessionStats?.avgBeautyScore ?? 0.5,
    beautyScore: sessionStats?.avgBeautyScore ?? 0.5,
    framesProcessed: sessionStats?.framesProcessed ?? 0,
    patternsLearned: memoryStats?.totalPatterns ?? 0,
    sessionPatterns: sessionStats?.patternsLearned ?? 0,
    memoryUsage: (memoryStats?.dbSizeBytes ?? 0) / (10 * 1024 * 1024), // 10MB max reference
    sessionId: sessionStats?.sessionId ?? null,
    hasMemory: brainStats.hasMemory,
  }
})

// ============================================
// 🎚️ WAVE-14: INPUT GAIN
// ============================================
ipcMain.handle('lux:set-input-gain', (_event, value: number) => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  try {
    selene.setInputGain(value)
    
    // 🔧 WAVE 15 FIX: Propagar al Worker Beta
    const trinity = getTrinity()
    if (trinity) {
      trinity.updateConfig({ inputGain: value })
      console.log(`[Main] 🎚️ Input Gain propagado a Worker: ${(value * 100).toFixed(0)}%`)
    }
    
    // 🔧 WAVE 15: Persistir en config
    configManager.setAudioConfig({ inputGain: value })
    
    return { success: true, inputGain: selene.getInputGain() }
  } catch (error) {
    console.error('[Main] ❌ Error setting input gain:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// 🎨 WAVE-14.5: LAB CONTROLS
// ============================================
ipcMain.handle('selene:force-mutate', () => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  try {
    selene.forceColorMutation('UI Manual Trigger')
    return { success: true }
  } catch (error) {
    console.error('[Main] ❌ Error forcing mutation:', error)
    return { success: false, error: String(error) }
  }
})

ipcMain.handle('selene:reset-memory', () => {
  if (!selene) {
    return { success: false, error: 'Selene not initialized' }
  }
  
  try {
    selene.resetMemory()
    return { success: true }
  } catch (error) {
    console.error('[Main] ❌ Error resetting memory:', error)
    return { success: false, error: String(error) }
  }
})

// ============================================
// 🔗 WAVE 10: SYSTEM INITIALIZATION
// ============================================
// Handler para inicializar el sistema con auto-zoning

ipcMain.handle('lux:initialize-system', async () => {
  console.log('[Main] 🚀 Initializing LuxSync System...')
  
  // 1. Recalcular zonas de fixtures existentes
  recalculateZoneCounters()
  
  // 2. Reasignar zonas a fixtures existentes si no tienen
  patchedFixtures.forEach((fixture, index) => {
    if (!fixture.zone || fixture.zone === 'UNASSIGNED') {
      fixture.zone = autoAssignZone(fixture.type, fixture.name)
      console.log(`[Main] 📍 Re-assigned zone for ${fixture.name}: ${fixture.zone}`)
    }
  })
  
  // 3. Inicializar Selene si no está
  if (!selene) {
    initSelene()
    globalThis.__lux_isSystemRunning = true
  }
  
  // 4. Inicializar el Brain
  if (selene && !selene['brainInitialized']) {
    // ensure only one initialization occurs
    try {
      await selene.initializeBrain()
    } catch (err) {
      console.warn('[Main] ⚠️ Brain init failed during initialize-system:', err)
    }
  }
  
  // 🔧 WAVE 15: Propagar inputGain guardado al Worker Beta
  const savedConfig = configManager.getConfig()
  const savedGain = savedConfig.audio?.inputGain ?? 1.0
  if (selene) {
    selene.setInputGain(savedGain)
  }
  const trinity = getTrinity()
  if (trinity) {
    trinity.updateConfig({ inputGain: savedGain })
    console.log(`[Main] 🎚️ Restored inputGain from config: ${(savedGain * 100).toFixed(0)}%`)
  }
  
  console.log('[Main] ✅ System initialized with', patchedFixtures.length, 'fixtures')
  
  return { 
    success: true, 
    fixtures: patchedFixtures,
    zoneCounters,
    inputGain: savedGain,  // 🔧 WAVE 15.1: Return saved gain so Renderer can update audioStore
  }
})

// 🗡️ WAVE 15.3 REAL: RAW AUDIO BUFFER - El único camino válido
// Frontend envía Float32Array crudo → Beta hace FFT → Gamma recibe análisis real
ipcMain.handle('lux:audio-buffer', (_event, bufferData: ArrayBuffer) => {
  const trinity = getTrinity()
  if (trinity) {
    // Convertir ArrayBuffer a Float32Array
    const buffer = new Float32Array(bufferData)
    trinity.feedAudioBuffer(buffer)
  }
  return { success: true }
})

// Legacy handler - mantener para compatibilidad pero SIN bypass a Trinity
ipcMain.handle('lux:audio-frame', (_event, audioData: {
  bass: number
  mid: number
  treble: number
  energy: number
  bpm?: number
}) => {
  // Audio packet received - no spam logging
  
  // WAVE 3: Update current audio data for main loop (SeleneLux legacy)
  currentAudioData = {
    bass: audioData.bass,
    mid: audioData.mid,
    treble: audioData.treble,
    energy: audioData.energy,
    bpm: audioData.bpm || 120,
    onBeat: audioData.bass > 0.7, // High bass = beat hit
  }
  
  // �️ WAVE 15.3: BYPASS ELIMINADO
  // El frontend DEBE enviar el buffer crudo via lux:audio-buffer
  // Este handler legacy NO alimenta a Trinity Workers
  
  return { success: true }
})

// ============================================
// WAVE 9.5: FIXTURE LIBRARY IPC HANDLERS
// ============================================

import fs from 'fs'

// 🔗 WAVE 9.6: Zone types for auto-assignment
type FixtureZone = 'FRONT_PARS' | 'BACK_PARS' | 'MOVING_LEFT' | 'MOVING_RIGHT' | 'STROBES' | 'LASERS' | 'UNASSIGNED'

// Tipos para fixtures (simplificados para IPC)
interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
  // 🔬 WAVE 10.5: Metadatos del parser avanzado
  confidence?: number              // Confianza en la detección (0-1)
  detectionMethod?: string         // 'channels' | 'model' | 'heuristic' | 'name' | 'manual'
  hasMovementChannels?: boolean    // Tiene Pan/Tilt
  has16bitMovement?: boolean       // Tiene Pan16bit/Tilt16bit
  hasColorMixing?: boolean         // Tiene RGB
  hasColorWheel?: boolean          // Tiene rueda de colores
  manualOverride?: string          // Tipo forzado manualmente por el usuario
}

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
  zone: FixtureZone // 🔗 WAVE 9.6: Auto-assigned zone
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌙 WAVE 10: AUTO-ZONING INTELIGENTE
// ═══════════════════════════════════════════════════════════════════════════
// Contadores separados por tipo para asignación de zonas correcta:
// - PARs: Primeros 50% → BACK_PARS, resto → FRONT_PARS
// - Moving Heads: Par → MOVING_LEFT, Impar → MOVING_RIGHT
let zoneCounters = {
  par: 0,        // Contador de PARs/Wash
  moving: 0,     // Contador de Moving Heads
  strobe: 0,     // Contador de Strobes
  laser: 0,      // Contador de Lasers
}

// Reset de contadores (llamar al limpiar patch o inicializar sistema)
function resetZoneCounters(): void {
  zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 }
  console.log('[Zoning] 🔄 Zone counters reset')
}

// Recalcular contadores basado en fixtures existentes
function recalculateZoneCounters(): void {
  resetZoneCounters()
  patchedFixtures.forEach(f => {
    const typeUpper = (f.type || '').toUpperCase()
    if (typeUpper.includes('PAR') || typeUpper.includes('WASH') || typeUpper.includes('LED')) {
      zoneCounters.par++
    } else if (typeUpper.includes('MOVING') || typeUpper.includes('SPOT') || typeUpper.includes('BEAM') || typeUpper.includes('HEAD')) {
      zoneCounters.moving++
    } else if (typeUpper.includes('STROBE')) {
      zoneCounters.strobe++
    } else if (typeUpper.includes('LASER')) {
      zoneCounters.laser++
    }
  })
  console.log('[Zoning] 📊 Counters recalculated:', zoneCounters)
}

// 🔗 WAVE 10: Auto-assign zone based on fixture type with proper counters
function autoAssignZone(fixtureType: string | undefined, fixtureName?: string): FixtureZone {
  const typeUpper = (fixtureType || '').toUpperCase()
  const nameUpper = (fixtureName || '').toUpperCase()
  
  // Moving heads -> MOVING_LEFT (par) / MOVING_RIGHT (impar)
  // PRIORIDAD: Detectar móviles ANTES que PARs (algunos móviles tienen PAR en el nombre)
  // Layout: Izquierda y derecha del escenario, espejados
  if (typeUpper.includes('MOVING') || typeUpper.includes('SPOT') || typeUpper.includes('BEAM') || typeUpper.includes('HEAD') ||
      nameUpper.includes('BEAM') || nameUpper.includes('SPOT') || nameUpper.includes('VIZI') || 
      nameUpper.includes('5R') || nameUpper.includes('7R') || nameUpper.includes('MOVING')) {
    const currentCount = zoneCounters.moving
    zoneCounters.moving++
    
    // Par → LEFT, Impar → RIGHT (alternado)
    const zone = currentCount % 2 === 0 ? 'MOVING_LEFT' : 'MOVING_RIGHT'
    console.log(`[Zoning] 🎯 Moving Head #${currentCount} "${fixtureName}" → ${zone}`)
    return zone
  }
  
  // Strobes
  if (typeUpper.includes('STROBE') || nameUpper.includes('STROBE')) {
    zoneCounters.strobe++
    return 'STROBES'
  }
  
  // Lasers
  if (typeUpper.includes('LASER') || nameUpper.includes('LASER')) {
    zoneCounters.laser++
    return 'LASERS'
  }
  
  // PAR fixtures -> BACK_PARS (primeros 50%) / FRONT_PARS (resto 50%)
  // Layout: Back = detrás del DJ (ambiente), Front = frente al público (impacto)
  // Incluye: PAR, WASH, LED, y cualquier fixture desconocido
  const currentParCount = zoneCounters.par
  zoneCounters.par++
  
  // Alternamos: 0→BACK, 1→FRONT, 2→BACK, 3→FRONT... para distribución uniforme
  const zone = currentParCount % 2 === 0 ? 'BACK_PARS' : 'FRONT_PARS'
  console.log(`[Zoning] 💡 PAR/LED #${currentParCount} "${fixtureName}" → ${zone}`)
  return zone
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔬 WAVE 10.5: FXTParser Profesional
// ─────────────────────────────────────────────────────────────────────────────
import { FXTParser, fxtParser, type ParsedFixture as FXTParsedFixture } from './FXTParser'

// Estado de fixtures
let fixtureLibrary: FixtureLibraryItem[] = []
let patchedFixtures: PatchedFixture[] = []

// Función auxiliar para convertir ParsedFixture del parser a FixtureLibraryItem
function convertToLibraryItem(parsed: FXTParsedFixture): FixtureLibraryItem {
  return {
    id: parsed.id,
    name: parsed.name,
    manufacturer: parsed.manufacturer,
    channelCount: parsed.channelCount,
    type: parsed.type === 'wash' ? 'moving_head' : parsed.type, // Wash = Moving para zoning
    filePath: parsed.filePath,
    // Metadatos extra del parser avanzado
    confidence: parsed.confidence,
    detectionMethod: parsed.detectionMethod,
    hasMovementChannels: parsed.hasMovementChannels,
    has16bitMovement: parsed.has16bitMovement,
    hasColorMixing: parsed.hasColorMixing,
    hasColorWheel: parsed.hasColorWheel,
  }
}

// DEPRECATED: Parsear archivo .fxt (mantener por compatibilidad)
function parseFXTFile(filePath: string): FixtureLibraryItem | null {
  // 🔬 WAVE 10.5: Usar el nuevo parser profesional
  const parsed = fxtParser.parseFile(filePath)
  if (!parsed) return null
  return convertToLibraryItem(parsed)
}

// Escanear carpeta de fixtures
ipcMain.handle('lux:scan-fixtures', async (_event, customPath?: string) => {
  try {
    // __dirname en dev = electron-app/dist-electron
    // Necesitamos: LuxSync/librerias
    // Desde dist-electron: ../.. = electron-app, ../../.. = LuxSync ❌ NO
    // Correcto: .. = electron-app, ../.. = LuxSync ✓
    const projectRoot = path.join(__dirname, '../..')  // dist-electron -> electron-app -> LuxSync
    const defaultPath = path.join(projectRoot, 'librerias')
    const searchPath = customPath || defaultPath
    
    console.log(`[Fixtures] 🔍 __dirname: ${__dirname}`)
    console.log(`[Fixtures] 🔍 Searching in: ${searchPath}`)
    
    const foundFixtures: FixtureLibraryItem[] = []
    
    if (fs.existsSync(searchPath)) {
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
    } else {
      console.warn(`[Fixtures] ⚠️ Folder not found: ${searchPath}`)
    }
    
    fixtureLibrary = foundFixtures
    console.log(`[Fixtures] 📦 Found ${foundFixtures.length} fixtures`)
    
    return { 
      success: true, 
      fixtures: foundFixtures,
      searchPath
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
ipcMain.handle('lux:patch-fixture', (_event, data: { fixtureId: string; dmxAddress: number; universe?: number; zone?: FixtureZone }) => {
  const libraryFixture = fixtureLibrary.find(f => f.id === data.fixtureId)
  if (!libraryFixture) {
    return { success: false, error: 'Fixture not found in library' }
  }
  
  // 🔗 WAVE 10: Auto-assign zone if not provided (usando el nuevo sistema de contadores)
  const assignedZone = data.zone || autoAssignZone(libraryFixture.type, libraryFixture.name)
  
  const patched: PatchedFixture = {
    ...libraryFixture,
    dmxAddress: data.dmxAddress,
    universe: data.universe || 1,
    zone: assignedZone,
  }
  
  patchedFixtures.push(patched)
  
  // 🔧 WAVE 10: Auto-save al ConfigManager
  configManager.setPatchedFixtures(patchedFixtures.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    manufacturer: f.manufacturer,
    channelCount: f.channelCount,
    dmxAddress: f.dmxAddress,
    universe: f.universe,
    zone: f.zone,
    filePath: f.filePath,
  })))
  
  console.log(`[Fixtures] ✅ Patched ${libraryFixture.name} at DMX ${data.dmxAddress} -> Zone: ${assignedZone}`)
  
  // 🚨 WAVE 14.9: Broadcast cambio de fixtures por canal dedicado
  if (mainWindow) {
    mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
  }
  
  return { success: true, fixture: patched, totalPatched: patchedFixtures.length }
})

// Eliminar fixture del patch
ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress: number) => {
  const index = patchedFixtures.findIndex(f => f.dmxAddress === dmxAddress)
  if (index === -1) {
    return { success: false, error: 'Fixture not found at that address' }
  }
  
  const removed = patchedFixtures.splice(index, 1)[0]
  // 🔗 WAVE 10: Recalcular contadores después de eliminar
  recalculateZoneCounters()
  
  // 🔧 WAVE 10: Auto-save al ConfigManager
  configManager.setPatchedFixtures(patchedFixtures.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    manufacturer: f.manufacturer,
    channelCount: f.channelCount,
    dmxAddress: f.dmxAddress,
    universe: f.universe,
    zone: f.zone,
    filePath: f.filePath,
  })))
  
  console.log(`[Fixtures] 🗑️ Unpatched ${removed.name} from DMX ${dmxAddress}`)
  
  // 🚨 WAVE 14.9: Broadcast cambio de fixtures por canal dedicado
  if (mainWindow) {
    mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
  }
  
  return { success: true, removed, totalPatched: patchedFixtures.length }
})

// 🔬 WAVE 10.5: Forzar tipo de fixture manualmente
ipcMain.handle('lux:force-fixture-type', (_event, dmxAddress: number, newType: string) => {
  const fixture = patchedFixtures.find(f => f.dmxAddress === dmxAddress)
  if (!fixture) {
    return { success: false, error: 'Fixture not found at that address' }
  }
  
  const oldType = fixture.type
  fixture.type = newType
  fixture.manualOverride = newType
  
  // Reasignar zona basada en nuevo tipo
  const oldZone = fixture.zone
  fixture.zone = autoAssignZone(newType, fixture.name)
  
  // Guardar en config
  configManager.setPatchedFixtures(patchedFixtures.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    manufacturer: f.manufacturer,
    channelCount: f.channelCount,
    dmxAddress: f.dmxAddress,
    universe: f.universe,
    zone: f.zone,
    filePath: f.filePath,
    manualOverride: f.manualOverride,
  })))
  
  console.log(`[Fixtures] 🔧 Forced ${fixture.name} @${dmxAddress}: ${oldType} → ${newType} (zone: ${oldZone} → ${fixture.zone})`)
  
  return { success: true, fixture, oldType, newType }
})

// 🎯 WAVE 12.5: Selector de Montaje - Aplica preset físico a Moving Heads
ipcMain.handle('lux:set-installation', (_event, installationType: 'ceiling' | 'floor') => {
  // Guardar en config
  configManager.setInstallationType(installationType)
  
  // Nota: El FixturePhysicsDriver se aplicará cuando se envíen comandos de movimiento
  // La configuración se persiste y afectará a futuros comandos
  
  console.log(`[Installation] 🎯 Installation type set to: ${installationType}`)
  console.log(`[Installation] 📐 ${installationType === 'ceiling' ? 'COLGADOS - Tilt invertido' : 'DE PIE - Tilt normal'}`)
  
  return { 
    success: true, 
    installationType, 
    appliedTo: patchedFixtures.length,
    description: installationType === 'ceiling' ? 'Moving Heads colgados del techo' : 'Moving Heads de pie en el suelo'
  }
})

// Limpiar todo el patch
ipcMain.handle('lux:clear-patch', () => {
  const count = patchedFixtures.length
  patchedFixtures = []
  // 🔗 WAVE 10: Resetear contadores de zonas
  resetZoneCounters()
  
  // 🔧 WAVE 10: Auto-save al ConfigManager
  configManager.clearPatch()
  
  console.log(`[Fixtures] 🧹 Cleared ${count} fixtures from patch`)
  return { success: true, cleared: count }
})

// 🎭 WAVE 10.6: NEW SHOW - Reset completo para empezar de cero
ipcMain.handle('lux:new-show', () => {
  console.log('[Show] 🎭 NEW SHOW - Resetting everything...')
  
  // 1. Limpiar fixtures
  const fixtureCount = patchedFixtures.length
  patchedFixtures = []
  resetZoneCounters()
  
  // 2. Resetear config a defaults
  configManager.clearPatch()
  configManager.setAudioConfig({ source: 'simulation' })
  configManager.setSeleneMode('reactive')
  
  // 3. Detener Selene si está corriendo
  if (selene) {
    selene.stop()
  }
  
  console.log(`[Show] 🎭 NEW SHOW created - Cleared ${fixtureCount} fixtures`)
  return { 
    success: true, 
    message: 'New show created',
    clearedFixtures: fixtureCount 
  }
})

// ============================================
// 🎭 WAVE 26: SHOW MANAGEMENT (Save/Load/Delete)
// ============================================

// List all shows in the folder
ipcMain.handle('lux:list-shows', () => {
  return showManager.listShows()
})

// Save current config as a show
ipcMain.handle('lux:save-show', (_event, data: { name: string; description: string }) => {
  const currentConfig = configManager.getConfig()
  return showManager.saveShow(data.name, data.description, currentConfig)
})

// Load a show from file
ipcMain.handle('lux:load-show', async (_event, filename: string) => {
  const result = showManager.loadShow(filename)
  
  if (result.success && result.data) {
    // Apply the loaded config
    const showData = result.data
    
    // Update audio config
    if (showData.audio) {
      configManager.setAudioConfig(showData.audio)
    }
    
    // Update DMX config
    if (showData.dmx) {
      configManager.setDMXConfig(showData.dmx)
    }
    
    // Update fixtures
    if (showData.patchedFixtures) {
      patchedFixtures = showData.patchedFixtures.map(f => ({
        ...f,
        zone: f.zone as any, // Cast to FixtureZone
      }))
      configManager.setPatchedFixtures(showData.patchedFixtures)
      recalculateZoneCounters()
      
      // Broadcast to UI
      if (mainWindow) {
        mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
      }
    }
    
    // Update Selene mode
    if (showData.seleneMode) {
      configManager.setSeleneMode(showData.seleneMode as any)
    }
    
    // Update installation type
    if (showData.installationType) {
      configManager.setInstallationType(showData.installationType)
    }
    
    console.log(`[Show] 📂 Loaded show: ${showData.name} (${showData.patchedFixtures?.length || 0} fixtures)`)
  }
  
  return result
})

// Delete a show file
ipcMain.handle('lux:delete-show', (_event, filename: string) => {
  return showManager.deleteShow(filename)
})

// Create a new empty show
ipcMain.handle('lux:create-show', (_event, data: { name: string; description?: string }) => {
  return showManager.createNewShow(data.name, data.description || '')
})

// Get shows folder path
ipcMain.handle('lux:get-shows-path', () => {
  return { success: true, path: showManager.getShowsPath() }
})

// ============================================
// 🔧 WAVE 10: CONFIG PERSISTENCE (NEW ConfigManager)
// ============================================

// IPC Handlers para config - usando ConfigManager
ipcMain.handle('lux:get-config', () => {
  return { success: true, config: configManager.getConfig() }
})

ipcMain.handle('lux:save-config', (_event, config: Partial<ReturnType<typeof configManager.getConfig>>) => {
  try {
    if (config.dmx) configManager.setDMXConfig(config.dmx)
    if (config.audio) configManager.setAudioConfig(config.audio)
    if (config.seleneMode) configManager.setSeleneMode(config.seleneMode)
    if (config.ui) configManager.setUIPreferences(config.ui)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

ipcMain.handle('lux:reset-config', () => {
  try {
    patchedFixtures = []
    resetZoneCounters()
    configManager.clearPatch()
    configManager.forceSave()
    return { success: true, config: configManager.getConfig() }
  } catch (err) {
    return { success: false, error: String(err) }
  }
})

// Handler para obtener config cargada (llamado desde UI al iniciar)
ipcMain.handle('lux:get-loaded-config', () => {
  return {
    success: true,
    config: configManager.getConfig(),
    fixtures: patchedFixtures,
    fixtureCount: patchedFixtures.length,
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// 🌪️ WAVE 11: UNIVERSAL DMX DRIVER - Soporte para CUALQUIER chip serial
// ═══════════════════════════════════════════════════════════════════════════

// Lista dispositivos DMX USB disponibles (detecta FTDI, CH340, Prolific, etc.)
ipcMain.handle('dmx:list-devices', async () => {
  try {
    const devices = await universalDMX.listDevices()
    return { success: true, devices }
  } catch (err) {
    console.error('[DMX] List devices error:', err)
    return { success: false, error: String(err), devices: [] }
  }
})

// Autodetecta y conecta al dispositivo DMX
ipcMain.handle('dmx:auto-connect', async () => {
  try {
    const connected = await universalDMX.autoConnect()
    return { 
      success: connected, 
      device: universalDMX.device,
      state: universalDMX.currentState,
      error: connected ? null : universalDMX.error
    }
  } catch (err) {
    console.error('[DMX] Auto-connect error:', err)
    return { success: false, error: String(err) }
  }
})

// Conecta a un dispositivo específico
ipcMain.handle('dmx:connect', async (_event, portPath: string) => {
  try {
    const connected = await universalDMX.connect(portPath)
    return { 
      success: connected, 
      device: universalDMX.device,
      state: universalDMX.currentState,
      error: connected ? null : universalDMX.error
    }
  } catch (err) {
    console.error('[DMX] Connect error:', err)
    return { success: false, error: String(err) }
  }
})

// Desconecta del dispositivo DMX
ipcMain.handle('dmx:disconnect', async () => {
  try {
    await universalDMX.disconnect()
    return { success: true, state: universalDMX.currentState }
  } catch (err) {
    console.error('[DMX] Disconnect error:', err)
    return { success: false, error: String(err) }
  }
})

// Obtiene el estado actual del driver DMX
ipcMain.handle('dmx:get-status', () => {
  return {
    success: true,
    ...universalDMX.getStats()
  }
})

// Blackout (todos los canales a 0)
ipcMain.handle('dmx:blackout', () => {
  universalDMX.blackout()
  return { success: true }
})

// 🔦 WAVE 11: Highlight fixture para testing
ipcMain.handle('dmx:highlight-fixture', async (_event, startChannel: number, channelCount: number, isMovingHead: boolean) => {
  try {
    await universalDMX.highlightFixture(startChannel, channelCount, isMovingHead)
    return { success: true }
  } catch (err) {
    console.error('[DMX] Highlight error:', err)
    return { success: false, error: String(err) }
  }
})

// Eventos del driver DMX al renderer (incluyendo watchdog)
universalDMX.on('connected', (device: DMXDevice) => {
  console.log(`[DMX] 🌪️ Connected to ${device.friendlyName}`)
  mainWindow?.webContents.send('dmx:connected', device)
  mainWindow?.webContents.send('dmx:status', { state: 'connected', device })
})

universalDMX.on('disconnected', () => {
  console.log('[DMX] 🔌 Disconnected')
  mainWindow?.webContents.send('dmx:disconnected')
  mainWindow?.webContents.send('dmx:status', { state: 'disconnected' })
})

universalDMX.on('reconnecting', () => {
  console.log('[DMX] 🔄 Reconnecting...')
  mainWindow?.webContents.send('dmx:status', { state: 'reconnecting' })
})

universalDMX.on('state', (state: string) => {
  mainWindow?.webContents.send('dmx:state', state)
  mainWindow?.webContents.send('dmx:status', { state })
})

universalDMX.on('error', (error: string) => {
  console.error('[DMX] ❌ Error:', error)
  mainWindow?.webContents.send('dmx:status', { state: 'error', error })
})

console.log('LuxSync Main Process Started')
