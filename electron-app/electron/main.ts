/**
 * LUXSYNC ELECTRON - MAIN PROCESS
 */

import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { SeleneLux } from '../src/main/selene-lux-core/SeleneLux'
import type { LivingPaletteId } from '../src/main/selene-lux-core/engines/visual/ColorEngine'
import type { MovementPattern } from '../src/main/selene-lux-core/types'
import { configManager, type PatchedFixtureConfig } from './ConfigManager'
import { FixturePhysicsDriver } from '../src/main/selene-lux-core/hardware'
// 🧠 WAVE 10: Trinity Orchestrator for worker communication
import { getTrinity } from '../src/main/workers/TrinityOrchestrator'
// 🌪️ WAVE 11: UniversalDMXDriver - Soporte para CUALQUIER chip serial
import { universalDMX, type DMXDevice } from './UniversalDMXDriver'
// ⚡ WAVE 10.7: EffectsEngine para efectos de pánico
import { EffectsEngine } from '../src/main/selene-lux-core/engines/visual/EffectsEngine'
// 🎭 WAVE 26: ShowManager for save/load/delete shows
import { showManager } from './ShowManager'
// ⚡ WAVE 27: FixtureDefinition types for Fixture Forge
import type { FixtureDefinition } from '../src/types/FixtureDefinition'
// 🧪 WAVE 111: Selene Diagnostic Suite
import { runSeleneDiagnostics } from './SeleneValidator'

let mainWindow: BrowserWindow | null = null
let selene: SeleneLux | null = null
let effectsEngine: EffectsEngine | null = null // ⚡ Global effects engine
let mainLoopInterval: NodeJS.Timeout | null = null
let lastBroadcastInterval: NodeJS.Timeout | null = null
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

// Instancia global del driver de física de fixtures (si está disponible)
const fixturePhysicsDriver = new FixturePhysicsDriver()

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
  // 🧪 WAVE 111: Ejecutar diagnósticos al inicio
  console.log('[Main] 🧪 Running Selene Diagnostics...')
  const diagnostics = runSeleneDiagnostics()
  if (diagnostics.failed > 0) {
    console.warn(`[Main] ⚠️ ${diagnostics.failed} diagnostic tests failed!`)
  } else {
    console.log('[Main] ✅ All diagnostic tests passed!')
  }
  
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
        let pipelineAuditCounter = 0
        
        trinity.on('audio-analysis', (analysis) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('trinity:audio-analysis', analysis)
          }
          
          // 💓 WAVE 44.0: PIPELINE AUDIT - Log keys every 5 seconds
          // 🧹 WAVE 63: Comentado - solo vibes importan
          pipelineAuditCounter++
          // if (pipelineAuditCounter % 150 === 0) {
          //   const keys = analysis ? Object.keys(analysis) : []
          //   console.log('[PIPELINE AUDIT] 🔬 BETA→Main keys:', keys.join(', ') || 'EMPTY')
          // }
        })
        
        trinity.on('lighting-decision', (decision) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('trinity:lighting-decision', decision)
          }
          
          // 🎨 WAVE 69.3: DATA BRIDGE COMPLETE - Enviar debugInfo Y palette a SeleneLux
          // Esto conecta el Worker (colores RGB del ColorEngine) con la UI
          if (decision && selene) {
            selene.updateFromTrinity(decision.debugInfo, decision.palette)
          }
          
          // 💓 WAVE 44.0: PIPELINE AUDIT - Log keys every 5 seconds
          // 🧹 WAVE 63: Comentado - solo vibes importan
          // if (pipelineAuditCounter % 150 === 0) {
          //   const keys = decision ? Object.keys(decision) : []
          //   console.log('[PIPELINE AUDIT] 🔬 GAMMA→Main keys:', keys.join(', ') || 'EMPTY')
          // }
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
      // Standardize to 'lux:log' channel for frontend
      mainWindow.webContents.send('lux:log', logEntry)
    }
  })
  console.log('[Main] 📜 Log forwarding ENABLED (WAVE 25.7 - lux:log)')

  // mark system as running
  globalThis.__lux_isSystemRunning = true
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌙 WAVE 25: UNIVERSAL TRUTH BROADCAST - 30 FPS Heartbeat
  // ═══════════════════════════════════════════════════════════════════════════
  // Este loop es SEPARADO del mainLoop de audio/DMX para garantizar 30fps
  // El Frontend recibe la VERDAD COMPLETA aquí, no fragmentos dispersos
  lastBroadcastInterval = setInterval(() => {
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

// ═══════════════════════════════════════════════════════════════════════════
// 🏛️ WAVE 107: UNIFIED REACTIVITY PIPELINE
// ═══════════════════════════════════════════════════════════════════════════
// Arquitectura de 5 fases: Gatekeeper → Router → Physics → Constraints → Clipper
// Motor global con Vibe Constraints para ajustes específicos por género
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 108: VIBE CONSTRAINTS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
// CORRECCIÓN CRÍTICA: Los 4 Vibes reales son:
// 1. TechnoClub - Industrial Standard (Default)
// 2. FiestaLatina - La Metralleta 
// 3. PopRock - Alto Contraste (física "Dubstep")
// 4. ChillLounge - Fluidez Total
// ═══════════════════════════════════════════════════════════════════════════

interface VibeConstraints {
  name: string;              // Nombre descriptivo del preset
  // PARS (Rhythm Engine)
  parGate: number;           // Gate para Front PARs
  parGain: number;           // Ganancia para Front PARs
  parMax: number;            // 🔥 W114: Techo máximo para Front PARs (Headroom)
  backParGate: number;       // Gate para Back PARs
  backParGain: number;       // Ganancia para Back PARs (Latino incluye Snare Priority)
  backParMax: number;        // 🔥 W114: Techo máximo para Back PARs
  // MOVERS (Atmosphere Engine)
  moverFloor: number;        // Floor base de móviles (0 = oscuridad total)
  melodyThreshold: number;   // Umbral para detectar "melodía real"
  // PHYSICS
  decaySpeed: number;        // Velocidad de decay (1=instantáneo, 10=líquido)
  hardClipThreshold: number; // Umbral del soft knee clipper
}

const VIBE_PRESETS: Record<string, VibeConstraints> = {
  // ═══════════════════════════════════════════════════════════════════════
  // 🏭 TECHNO CLUB - Industrial Standard (DEFAULT) - WAVE 113→115
  // ═══════════════════════════════════════════════════════════════════════
  // Hard Techno, Dubstep, Noise. Golpes potentes + sintes agresivos.
  'techno-club': {
    name: 'Techno/Default',
    parGate: 0.05,           // W113: Sensibilidad máxima
    parGain: 6.0,            // W113: Golpe visual fuerte
    parMax: 0.78,            // W114: HEADROOM - Techo 78% para dejar espacio al Snare
    backParGate: 0.12,       // W113: Más reactivo
    backParGain: 5.0,        // W113: Hi-hats potentes
    backParMax: 1.0,         // W114: El Snare tiene permiso para cegar
    moverFloor: 0.0,         // Sin suelo (oscuridad total en drops)
    melodyThreshold: 0.25,   // W115: Restaurado (0.35 mataba Dubstep)
    decaySpeed: 2,           // Rápido (Cuchillo)
    hardClipThreshold: 0.12, // W113: Menos recorte
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 💃 FIESTA LATINA - La Metralleta
  // ═══════════════════════════════════════════════════════════════════════
  // Reggaetón, Cumbia, Salsa. Pulsos rápidos, snare/timbal prioritario.
  'fiesta-latina': {
    name: 'Latino',
    parGate: 0.05,           // Gate bajísimo para pillar metralletas rápidas
    parGain: 6.0,            // Ganancia extrema para compensar gate bajo
    parMax: 1.0,             // W114: Sin límites, todo a tope
    backParGate: 0.12,
    backParGain: 5.5,        // (4.0 * 1.35) ¡PRIORIDAD SNARE/TIMBAL!
    backParMax: 1.0,         // W114: Sin límites
    moverFloor: 0.0,         // Sin suelo en rhythm
    melodyThreshold: 0.40,   // Estricto (evitar falsos positivos de melodía)
    decaySpeed: 1,           // Instantáneo (corte seco)
    hardClipThreshold: 0.12,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎸 POP / ROCK - Alto Contraste (Física "Dubstep")
  // ═══════════════════════════════════════════════════════════════════════
  // Baterías acústicas con mucha dinámica. Desde toque suave hasta crash.
  'pop-rock': {
    name: 'Pop/Rock',
    parGate: 0.10,           // Gate medio
    parGain: 5.0,            // Alta ganancia para llenar escenario
    parMax: 0.85,            // W114: Algo de headroom para platos
    backParGate: 0.18,
    backParGain: 4.5,        // Platos brillantes
    backParMax: 1.0,         // W114: Platos sin límite
    moverFloor: 0.05,        // Mínimo 5% luz ambiente para ver la banda
    melodyThreshold: 0.30,   // Detectar melodías claras
    decaySpeed: 3,           // Decay natural (resonancia platos/cuerdas)
    hardClipThreshold: 0.15,
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🍹 CHILL / LOUNGE - Fluidez Total
  // ═══════════════════════════════════════════════════════════════════════
  // Ambient, Lo-Fi, Downtempo. Movimiento líquido, siempre presente.
  'chill-lounge': {
    name: 'Chill',
    parGate: 0.0,            // Sin gate, todo pasa
    parGain: 2.0,            // Ganancia suave, sin latigazos
    parMax: 0.60,            // W114: Techo bajo para fluidez (nunca cegar)
    backParGate: 0.10,
    backParGain: 2.0,
    backParMax: 0.60,        // W114: Techo bajo
    moverFloor: 0.20,        // SIEMPRE presentes (20% suelo)
    melodyThreshold: 0.0,    // Cualquier sonido mueve los focos
    decaySpeed: 10,          // Muy lento (líquido)
    hardClipThreshold: 0.08, // Clipper suave (brillos permitidos)
  },
};

// 🎭 Vibe actual (se actualiza desde el frontend)
let currentVibePreset: string = 'techno-club';

// ═══════════════════════════════════════════════════════════════════════════
// 🎛️ WAVE 108: SMART VIBE MATCHER
// ═══════════════════════════════════════════════════════════════════════════
// Busca coincidencias flexibles para mapear vibeId del frontend a presets
function getVibePreset(vibeId?: string): VibeConstraints {
  const id = (vibeId || currentVibePreset).toLowerCase();
  
  // 💃 FIESTA LATINA
  if (id.includes('latin') || id.includes('reggaeton') || id.includes('cumbia') || id.includes('salsa')) {
    return VIBE_PRESETS['fiesta-latina'];
  }
  
  // 🎸 POP / ROCK
  if (id.includes('pop') || id.includes('rock') || id.includes('concert') || id.includes('band')) {
    return VIBE_PRESETS['pop-rock'];
  }
  
  // 🍹 CHILL / LOUNGE
  if (id.includes('chill') || id.includes('lounge') || id.includes('ambient') || id.includes('lofi')) {
    return VIBE_PRESETS['chill-lounge'];
  }
  
  // 🏭 TECHNO CLUB (Default)
  return VIBE_PRESETS['techno-club'];
}

// 🔪 WAVE 107: Wrapper de Soft Knee Clipper con preset threshold
function applySoftKneeClipper(val: number): number {
  const preset = getVibePreset();
  return softKneeClip(val, preset.hardClipThreshold);
}

// 🔧 WAVE 107: Soft Knee Clipper - Anti-parpadeo
function softKneeClip(val: number, threshold: number): number {
  if (val < threshold) return 0;
  // Remapear [threshold, 1.0] → [0.0, 1.0] con entrada suave
  return (val - threshold) / (1 - threshold);
}

// 🔧 WAVE 107: Context Router - RHYTHM vs ATMOS vs HYBRID
type ContextMode = 'RHYTHM' | 'ATMOS' | 'HYBRID';
function getContextMode(rawBass: number, melodySum: number): { mode: ContextMode; rhythmPriority: number } {
  const isRhythm = rawBass > 0.50 && rawBass > melodySum;
  const isAtmos = melodySum > (rawBass * 1.5) || rawBass < 0.30;
  
  if (isRhythm) return { mode: 'RHYTHM', rhythmPriority: 1.0 };
  if (isAtmos) return { mode: 'ATMOS', rhythmPriority: 0.0 };
  return { mode: 'HYBRID', rhythmPriority: 0.5 };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 109: ASYMMETRIC DECAY PHYSICS
// ═══════════════════════════════════════════════════════════════════════════
// Física diferenciada por zona: Flash (PARs) vs Inercia (Movers)
// Attack: SIEMPRE instantáneo (sync con música)
// Decay: Asimétrico según zoneType
// ═══════════════════════════════════════════════════════════════════════════

// Estado persistente por zona (intensidades del frame anterior)
interface ZoneState {
  frontIntensity: number;
  backIntensity: number;
  moverIntensity: number;
}
const physicsState: ZoneState = { frontIntensity: 0, backIntensity: 0, moverIntensity: 0 };

// Buffers de decay por fixture individual (para fixtures múltiples)
const decayBuffers = new Map<string, number>();

/**
 * WAVE 109: Asymmetric Physics Engine
 * @param target - Intensidad objetivo calculada por análisis de audio (0.0-1.0)
 * @param current - Intensidad del frame anterior
 * @param decaySpeed - Velocidad del preset (1=instantáneo, 10=líquido)
 * @param zoneType - 'PAR' para Flash Physics, 'MOVER' para Inertia Physics
 */
function applyPhysics(target: number, current: number, decaySpeed: number, zoneType: 'PAR' | 'MOVER'): number {
  // A. ATTACK (Subida): Siempre instantáneo para mantener sync musical
  if (target >= current) {
    return target;
  }
  
  // B. DECAY (Bajada): Asimétrico según zoneType
  let dropRate: number;
  
  if (zoneType === 'PAR') {
    // FLASH PHYSICS: Caída rápida pero no instantánea (evita "glitch eléctrico")
    // Rango: 0.10 a 0.40 por frame
    // decaySpeed 1 → dropRate 0.40 (corte seco Latino)
    // decaySpeed 10 → dropRate 0.04 (respiro Chill)
    dropRate = 0.40 / decaySpeed;
  } else {
    // INERTIA PHYSICS: Caída suave como humo (sensación premium)
    // Rango: 0.01 a 0.10 por frame
    // decaySpeed 1 → dropRate 0.10 (respuesta rápida)
    // decaySpeed 10 → dropRate 0.01 (líquido total)
    dropRate = 0.10 / decaySpeed;
  }
  
  // Aplicar Linear Decay (resta, no multiplicación)
  const nextValue = current - dropRate;
  return Math.max(0, nextValue);
}

/**
 * WAVE 109: Apply decay with persistent buffer (para fixtures individuales)
 * @param key - Clave única del fixture+zona
 * @param targetValue - Intensidad objetivo
 * @param decaySpeed - Velocidad del preset
 * @param zoneType - Tipo de física a aplicar
 */
function applyDecayWithPhysics(key: string, targetValue: number, decaySpeed: number, zoneType: 'PAR' | 'MOVER'): number {
  const prevValue = decayBuffers.get(key) ?? 0;
  const newValue = applyPhysics(targetValue, prevValue, decaySpeed, zoneType);
  decayBuffers.set(key, newValue);
  return newValue;
}

// Mantener función legacy para compatibilidad
function applyDecay(key: string, targetValue: number, decayRate: number): number {
  const prevValue = decayBuffers.get(key) ?? 0;
  let newValue: number;
  
  if (targetValue > prevValue) {
    // Attack: subida instantánea
    newValue = targetValue;
  } else {
    // Decay: bajada con inercia
    newValue = Math.max(prevValue * decayRate, targetValue);
  }
  
  decayBuffers.set(key, newValue);
  return newValue;
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
    
    // � WAVE 39.5: Silenciado DMX log periódico (era ~10 segundos)
    // if (Math.random() < 0.003) {
    //   const c = state.colors
    //   const currentMode = selene?.getState()?.mode || 'unknown' // Use Selene's actual mode (flow/selene/locked)
    //   console.log('[DMX] 🎨 RGB:', 
    //     c.primary.r.toFixed(0), c.primary.g.toFixed(0), c.primary.b.toFixed(0), 
    //     '| 🎯 Pos:', state.movement?.pan?.toFixed(2) || 0, state.movement?.tilt?.toFixed(2) || 0,
    //     '| 🥁 Beat:', state.beat?.onBeat ? 'HIT' : '---',
    //     '| 🎵 Audio:', useRealAudio ? 'LIVE' : 'SIM',
    //     '| 🧠 Mode:', currentMode)
    // }
    
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
    
    // 🎚️ WAVE 94.2: AGC normalized audio para Relative Gates
    // El Worker normaliza el audio y calcula avgNormEnergy (~3s rolling average)
    const agcData = selene.getAgcData()
    const normBass = agcData?.normalizedBass ?? audioInput.bass
    const normMid = agcData?.normalizedMid ?? audioInput.mid
    const normTreble = agcData?.normalizedTreble ?? audioInput.treble
    const normEnergy = agcData?.normalizedEnergy ?? 0.5  // Global energy (fallback)
    const avgNormEnergy = agcData?.avgNormEnergy ?? 0.5  // Fallback: centro
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🏛️ WAVE 107: UNIFIED REACTIVITY PIPELINE
    // ═══════════════════════════════════════════════════════════════════════
    // Arquitectura de 5 fases: Gatekeeper → Router → Physics → Constraints → Clipper
    // Este reemplaza W103-W106 con un sistema unificado y mantenible
    // ═══════════════════════════════════════════════════════════════════════
    
    // 📦 Obtener constraints del vibe actual
    const constraints = VIBE_PRESETS[currentVibePreset] || VIBE_PRESETS['techno-club'];
    
    // 🔍 WAVE 116: VIBE AUDIT - Verificar mapping
    if (Math.random() < 0.001) {
      console.log(`[VIBE_AUDIT] currentVibePreset:'${currentVibePreset}' | parMax:${constraints.parMax} | backParMax:${constraints.backParMax} | melodyThreshold:${constraints.melodyThreshold}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // FASE 1: GATEKEEPER (Juez de Silencio)
    // ═══════════════════════════════════════════════════════════════════════
    const rawBass = audioInput.bass;
    const rawMid = audioInput.mid;
    const rawTreble = audioInput.treble;
    const totalEnergy = rawBass + rawMid + rawTreble;
    const isGlobalBlackout = totalEnergy < 0.15;
    
    // ═══════════════════════════════════════════════════════════════════════
    // FASE 2: ROUTER (Clasificador de Contexto)
    // ═══════════════════════════════════════════════════════════════════════
    const melodySum = rawMid + rawTreble;
    const { mode: contextMode, rhythmPriority } = getContextMode(rawBass, melodySum);
    const isRealSilence = totalEnergy < 0.15;
    // 🔧 W107: isMelodyDominant para compatibilidad con código existente
    const isMelodyDominant = contextMode === 'ATMOS';
    
    // ═══════════════════════════════════════════════════════════════════════
    // FASE 3: PHYSICS ENGINE (Cálculo de señales base)
    // ═══════════════════════════════════════════════════════════════════════
    const bassFloor = avgNormEnergy || 0.5;
    let bassPulse = rawBass - (bassFloor * 0.60);
    if (bassPulse < 0) bassPulse = 0;
    
    const melodySignal = Math.max(normMid, normTreble);
    
    // Log periódico para debug (cada ~5 segundos)
    if (Math.random() < 0.003) {
      console.log(`[LUX_DEBUG] Mode:${contextMode} | RAW[B:${rawBass.toFixed(2)} M:${rawMid.toFixed(2)} T:${rawTreble.toFixed(2)}] | Pulse:${bassPulse.toFixed(2)} Floor:${bassFloor.toFixed(2)} | Vibe:${currentVibePreset}`)
    }
    // ═══════════════════════════════════════════════════════════════════════
    
    const fixtureStates = patchedFixtures.map(fixture => {
      const color = state.colors?.primary || { r: 0, g: 0, b: 0 }
      const secondary = state.colors?.secondary || { r: 0, g: 0, b: 0 }
      const accent = state.colors?.accent || color // Para MOVING_LEFT
      // � WAVE 86: Ambient para MOVING_RIGHT (Stereo Mirror)
      const ambient = state.colors?.ambient || secondary
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🌴 WAVE 86: 5-COLOR STAGE MAPPING - BackPar Analogous Twist
      // Crear variante del primary con +25° de hue para profundidad en BACK_PARS
      // Esto evita la saturación monocromática Front/Back
      // ═══════════════════════════════════════════════════════════════════════
      const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
      };
      
      const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
      };
      
      // Crear backParColor: Primary + 25° twist (Rojo→Naranja, Naranja→Amarillo)
      const primaryHsl = rgbToHsl(color.r, color.g, color.b);
      const backParHsl = { 
        h: (primaryHsl.h + 25) % 360, 
        s: primaryHsl.s, 
        l: Math.max(primaryHsl.l, 40) // Boost si muy oscuro
      };
      const backParColor = hslToRgb(backParHsl.h, backParHsl.s, backParHsl.l);
      // ═══════════════════════════════════════════════════════════════════════
      
      // � WAVE 39.5: Silenciado DEBUG-RGB (log periódico)
      // if (Math.random() < 0.005 && fixture.zone?.includes('MOVING')) {
      //   console.log(`[DEBUG-RGB] ${fixture.zone}:`, 
      //     `Primary=[${color.r},${color.g},${color.b}]`,
      //     `Accent=[${accent.r},${accent.g},${accent.b}]`,
      //     `Ambient=[${ambient.r},${ambient.g},${ambient.b}]`)
      // }
      
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
        case 'FRONT_PARS': {
          // ═══════════════════════════════════════════════════════════════════
          // � WAVE 107: VIBE-AWARE PIPELINE - FRONT PARS
          // ═══════════════════════════════════════════════════════════════════
          // ARQUITECTURA: Motor Global + Vibe Constraints (GeminiPunk Design)
          // 1. Gate/Gain dinámicos según Vibe Preset
          // 2. Flash Physics: decay 2 frames (respuesta instantánea)
          // 3. Soft Knee Clipper: elimina 12% basura (val < 0.15 → 0)
          // ═══════════════════════════════════════════════════════════════════
          
          const preset = getVibePreset();
          const parKey = `${fixture.dmxAddress}-front`;
          let targetIntensity = 0;

          // 1. VOCAL LOCK: Si melodia domina, PARs apagados
          if (isMelodyDominant || isRealSilence) {
            targetIntensity = 0;
          } else if (bassPulse > preset.parGate) {
            // VIBE-AWARE: Gate y Gain del preset activo
            let rawIntensity = Math.min(1, (bassPulse - preset.parGate) * preset.parGain);
            const beforeParMax = rawIntensity; // 🔍 WAVE 116: DIAGNOSTIC
            
            // WAVE 114→115: VISUAL HEADROOM - Techo de intensidad por vibe
            // Techno: 78% max para dejar espacio al snare/hat
            // WAVE 115: Se eliminó cross-inhibition (mataba tracks densos)
            rawIntensity = Math.min(preset.parMax, rawIntensity);
            
            // SOFT KNEE CLIPPER: Eliminar ruido
            targetIntensity = applySoftKneeClipper(rawIntensity);
            
            // 🔍 WAVE 116: ACOPLAMIENTO AUDIT - Log cada ~30 frames si hay diferencia significativa
            if (Math.random() < 0.033 && beforeParMax > 0.8) {
              console.log(`[PAR_AUDIT] Pulse:${bassPulse.toFixed(2)} | Before:${beforeParMax.toFixed(2)} | After parMax(${preset.parMax}):${rawIntensity.toFixed(2)} | After Clip:${targetIntensity.toFixed(2)} | Vibe:${currentVibePreset}`);
            }
          }
          
          // 🌊 WAVE 109: FLASH PHYSICS - Decay rápido tipo estroboscopio
          intensity = applyDecayWithPhysics(parKey, targetIntensity, preset.decaySpeed, 'PAR');
          
          // 🔍 WAVE 116: Post-Physics Audit - Ver si decay respeta parMax
          if (Math.random() < 0.033 && intensity > 0.79) {
            console.log(`[PAR_PHYSICS] Target:${targetIntensity.toFixed(2)} → Final:${intensity.toFixed(2)} | DecaySpeed:${preset.decaySpeed} | Key:${parKey}`);
          }
          
          fixtureColor = color;
          break;
        }

        case 'BACK_PARS': {
          // ═══════════════════════════════════════════════════════════════════
          // 🌊 WAVE 109: ASYMMETRIC DECAY - BACK PARS (Shimmer Physics)
          // ═══════════════════════════════════════════════════════════════════
          // ARQUITECTURA: Motor Global + Vibe Constraints + Asymmetric Physics
          // 1. Gate/Gain dinámicos según Vibe Preset
          // 2. Shimmer Physics: Decay intermedio (más cola para platos/hi-hats)
          // 3. Soft Knee Clipper: elimina basura
          // 4. Latino Snare Trap: backParGain incluye x1.35 multiplicador
          // ═══════════════════════════════════════════════════════════════════
          
          const preset = getVibePreset();
          const backKey = `${fixture.dmxAddress}-back`;
          let targetIntensity = 0;
          
          if (isMelodyDominant || isRealSilence) {
            targetIntensity = 0;
          } else if (rawTreble > preset.backParGate) {
            // VIBE-AWARE: Gate y Gain del preset (Latino ya incluye boost)
            let rawIntensity = Math.min(1, (rawTreble - preset.backParGate) * preset.backParGain);
            
            // WAVE 114→115: VISUAL HEADROOM - Techo de intensidad por vibe
            // WAVE 115: Se eliminó cross-inhibition (mataba snares en Dubstep)
            rawIntensity = Math.min(preset.backParMax, rawIntensity);
            
            // SOFT KNEE CLIPPER: Eliminar ruido
            targetIntensity = applySoftKneeClipper(rawIntensity);
          }
          
          // 🌊 WAVE 109: SHIMMER PHYSICS - Decay intermedio (más cola para platos)
          // Multiplicamos decaySpeed * 1.5 para obtener decay más lento que Front PARs
          const shimmerDecaySpeed = Math.min(10, preset.decaySpeed * 1.5);
          intensity = applyDecayWithPhysics(backKey, targetIntensity, shimmerDecaySpeed, 'PAR');
          
          fixtureColor = backParColor;
          break;
        }
          
        case 'MOVING_LEFT': {
          // ═══════════════════════════════════════════════════════════════════
          // � WAVE 107: VIBE-AWARE PIPELINE - MOVING LEFT
          // ═══════════════════════════════════════════════════════════════════
          // ARQUITECTURA: Motor Global + Inertia Physics
          // 1. Floor unificado desde preset (0=oscuro total, 0.20=siempre visible)
          // 2. decaySpeed: 1=instantáneo, 10=líquido
          // 3. Soft Knee Clipper: elimina parpadeos pequeños
          // ═══════════════════════════════════════════════════════════════════

          const preset = getVibePreset();
          const moverKey = `${fixture.dmxAddress}-mover`;
          const floor = preset.moverFloor;
          
          // WAVE 110: DYNAMIC MASKING
          // Si el bajo está golpeando fuerte, subimos el umbral de la melodía
          // "Si hay mucho ruido, tienes que gritar más para que te vea"
          // Rango de Masking: 0.0 (Breakdown) a 0.2 (Drop pesado)
          const bassMasking = Math.min(0.2, rawBass * 0.25);
          const effectiveThreshold = preset.melodyThreshold + bassMasking;
          
          let targetMover = 0;

          if (isRealSilence) {
            // SILENCIO TOTAL: Reset completo
            targetMover = 0;
            decayBuffers.set(moverKey, 0);
          } else if (melodySignal > effectiveThreshold) {
            // PASÓ EL GATE: Es una melodía real
            // Normalizamos la entrada restando el umbral para que empiece suave
            const cleanSignal = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
            
            // Aplicar curva (Cuadrática para drops, Lineal para breakdowns)
            const curve = isMelodyDominant ? 1.0 : 2.0;
            const curvedSignal = Math.pow(Math.max(0, cleanSignal), curve);
            
            // Aplicar Floor del Preset (Chill:0.20, Techno:0, Pop:0.05)
            targetMover = floor + (curvedSignal * (1 - floor));
          } else {
            // NO PASÓ EL GATE: Es ruido o reverb
            // En breakdown mantenemos floor, en drop vamos a negro
            targetMover = isMelodyDominant ? floor : 0;
          }
          
          // WAVE 115: RELAXED MOVER GATE (Techno Only)
          // Relajado de 1.1 a 0.7 - Solo matar si bajo es MUY dominante
          // Permite que sintes agresivos de Dubstep/Noise pasen
          if (currentVibePreset === 'techno-club' && rawMid < rawBass * 0.7) {
            targetMover = 0;
          }
          
          // WAVE 109+110: INERTIA PHYSICS - Decay lento como humo flotante
          intensity = applyDecayWithPhysics(moverKey, targetMover, preset.decaySpeed, 'MOVER');
          fixtureColor = secondary;
          break;
        }
        case 'MOVING_RIGHT': {
          // ═══════════════════════════════════════════════════════════════════
          // � WAVE 107: VIBE-AWARE PIPELINE - MOVING RIGHT (Stereo)
          // ═══════════════════════════════════════════════════════════════════
          // Mismo cálculo que MOVING_LEFT, color AMBIENT para depth estéreo
          // ═══════════════════════════════════════════════════════════════════
          
          const preset = getVibePreset();
          const moverKey = `${fixture.dmxAddress}-mover`;
          const floor = preset.moverFloor;
          
          // WAVE 110: DYNAMIC MASKING (Stereo Mirror)
          const bassMasking = Math.min(0.2, rawBass * 0.25);
          const effectiveThreshold = preset.melodyThreshold + bassMasking;
          
          let targetMover = 0;

          if (isRealSilence) {
            targetMover = 0;
            decayBuffers.set(moverKey, 0);
          } else if (melodySignal > effectiveThreshold) {
            const cleanSignal = (melodySignal - effectiveThreshold) / (1 - effectiveThreshold);
            const curve = isMelodyDominant ? 1.0 : 2.0;
            const curvedSignal = Math.pow(Math.max(0, cleanSignal), curve);
            targetMover = floor + (curvedSignal * (1 - floor));
          } else {
            targetMover = isMelodyDominant ? floor : 0;
          }
          
          // WAVE 115: RELAXED MOVER GATE (Techno Only)
          // Relajado de 1.1 a 0.7 - Solo matar si bajo es MUY dominante
          if (currentVibePreset === 'techno-club' && rawMid < rawBass * 0.7) {
            targetMover = 0;
          }
          
          // WAVE 109+110: INERTIA PHYSICS - Decay lento como humo flotante
          intensity = applyDecayWithPhysics(moverKey, targetMover, preset.decaySpeed, 'MOVER');
          
          // STEREO MIRROR - Right usa AMBIENT
          fixtureColor = ambient;
          break;
        }

        case 'STROBES':
          // 🌴 WAVE 86: SOLAR FLARE - Strobes usan ACCENT (blanco dorado en Latino)
          intensity = audioInput.onBeat && audioInput.bass > 0.8 ? 1 : 0
          fixtureColor = accent
          break
          
        default:
          // ═══════════════════════════════════════════════════════════════════
          // 🏛️ WAVE 103: FALLBACK PARA MOVERS NO RECONOCIDOS
          // ═══════════════════════════════════════════════════════════════════
          if (zone.includes('MOVING')) {
            // Aplicar lógica contextual de movers
            if (isMelodyDominant && !isRealSilence) {
              intensity = 0.15 + (melodySignal * 0.85);
            } else if (!isRealSilence && melodySignal > 0.25) {
              intensity = Math.pow(melodySignal, 2);
            } else {
              intensity = 0;
            }
            fixtureColor = secondary;
          } else {
            // Zona desconocida: usar energy por defecto
            intensity = audioInput.energy;
            fixtureColor = color;
          }
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
    
    // 🏛️ WAVE 103: ENHANCED DIAGNOSTIC LOGGING (1 vez cada ~60 frames)
    if (Math.random() < 0.016) {
      const mode = isMelodyDominant ? 'MELODY' : (rawBass > 0.5 ? 'DROP' : 'TRANS')
      
      // Buscar fixtures para debug
      const moverState = fixtureStates.find(f => f.zone.includes('MOVING'))
      const parState = fixtureStates.find(f => f.zone.includes('PAR'))
      
      const moverOut = moverState ? (moverState.dimmer / 255).toFixed(2) : 'N/A'
      const parOut = parState ? (parState.dimmer / 255).toFixed(2) : 'N/A'
      
      // W105: Mostrar PULSE + FLOOR + TREBLE para diagnóstico (LINEAR GAIN)
      console.log(`[LUX_DEBUG] Mode:${mode} | RAW[B:${rawBass.toFixed(2)} M:${rawMid.toFixed(2)} T:${rawTreble.toFixed(2)}] | Pulse:${bassPulse.toFixed(2)} Floor:${bassFloor.toFixed(2)} | MelDom:${isMelodyDominant ? 'Y' : 'N'} | PAR:${parOut} MOV:${moverOut}`)
    }
    
    // 🌈 WAVE 25.5: Guardar para broadcast de verdad
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
    
    // � WAVE 63.95: Send SYSTEM_WAKE in case workers were sleeping
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.systemWake()
      }
    } catch (e) {
      console.warn('[Main] ⚠️ Could not send SYSTEM_WAKE:', e)
    }
    
    // �🔧 WAVE 15.1: Return saved inputGain even when already running
    const savedConfig = configManager.getConfig()
    const savedGain = savedConfig.audio?.inputGain ?? 1.0
    return { success: true, alreadyRunning: true, inputGain: savedGain }
  }

  initSelene()
  startMainLoop()
  
  // 🔌 WAVE 63.95: Send SYSTEM_WAKE to workers
  try {
    const trinityRef = getTrinity()
    if (trinityRef) {
      trinityRef.systemWake()
    }
  } catch (e) {
    console.warn('[Main] ⚠️ Could not send SYSTEM_WAKE:', e)
  }
  
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
  // 🔌 WAVE 63.95: Send SYSTEM_SLEEP to workers BEFORE stopping
  try {
    const trinityRef = getTrinity()
    if (trinityRef) {
      trinityRef.systemSleep()
    }
  } catch (e) {
    console.warn('[Main] ⚠️ Could not send SYSTEM_SLEEP:', e)
  }
  
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
  console.log('[Main] 🔌 WAVE 63.95: System stopped + SYSTEM_SLEEP sent')
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

// ============================================
// 🎛️ WAVE 62: VIBE SELECTOR - Set Active Vibe Context
// ============================================
ipcMain.handle('selene:setVibe', async (_event, vibeId: string) => {
  console.log(`[Main] 🎛️ VIBE CHANGE REQUEST: ${vibeId}`)
  
  // 🏛️ WAVE 112: VIBE IDENTITY SYNC FIX - Mapeo corregido
  // Alinear IDs del frontend con claves de VIBE_PRESETS
  const vibeToPreset: Record<string, string> = {
    'techno-club': 'techno-club',
    'techno': 'techno-club',
    'minimal-techno': 'techno-club',
    // 💃 LATINO → fiesta-latina
    'fiesta-latina': 'fiesta-latina',      // ✅ Identidad directa
    'latino-reggaeton': 'fiesta-latina',
    'reggaeton': 'fiesta-latina',
    'cumbia': 'fiesta-latina',
    'salsa': 'fiesta-latina',
    'latin': 'fiesta-latina',
    // 🎸 DUBSTEP/EDM → pop-rock (Alto Contraste)
    'pop-rock': 'pop-rock',               // ✅ Identidad directa
    'dubstep-edm': 'pop-rock',
    'dubstep': 'pop-rock',
    'edm': 'pop-rock',
    'bass-house': 'pop-rock',
    // 🍹 CHILL → chill-lounge
    'chill-lounge': 'chill-lounge',       // ✅ Ya estaba
    'chill': 'chill-lounge',
    'lounge': 'chill-lounge',
    'ambient': 'chill-lounge',
  };
  currentVibePreset = vibeToPreset[vibeId] || 'techno-club';
  
  // 🔍 WAVE 112: Debug log para confirmar sincronización
  console.log(`[Main] �️ W112 VIBE SYNC: "${vibeId}" → Preset: "${currentVibePreset}"`)
  const preset = getVibePreset(currentVibePreset);
  console.log(`[Main] 🎯 PHYSICS ACTIVE: ${preset.name} | Gate:${preset.parGate} Gain:${preset.parGain}x`)

  
  // Get Trinity orchestrator for worker communication
  let trinity: ReturnType<typeof getTrinity> | null = null
  try {
    trinity = getTrinity()
  } catch {
    console.log('[Main] Trinity not initialized - vibe change queued')
  }
  
  if (trinity) {
    try {
      // Send SET_VIBE message to GAMMA worker
      trinity.setVibe(vibeId)
      console.log(`[Main] 🎛️ VIBE SET: ${vibeId} → GAMMA worker`)
      
      // Emit confirmation to UI
      if (mainWindow) {
        mainWindow.webContents.send('selene:vibe-changed', {
          vibeId,
          preset: currentVibePreset,
          timestamp: Date.now()
        })
      }
      
      return { success: true, vibeId, preset: currentVibePreset }
    } catch (error) {
      console.error('[Main] ❌ Error setting vibe:', error)
      return { success: false, error: String(error) }
    }
  }
  
  return { success: false, error: 'Trinity not available' }
})

// ============================================
// 🎛️ WAVE 62 + WAVE 64.5: VIBE SELECTOR - Get Current Vibe
// AMNESIA: Siempre devuelve 'idle' al arranque hasta que se consulte al worker
// ============================================
ipcMain.handle('selene:getVibe', async () => {
  let trinity: ReturnType<typeof getTrinity> | null = null
  try {
    trinity = getTrinity()
  } catch {
    // 🔌 WAVE 64.5: Si no hay Trinity, devolver 'idle' (no techno)
    return { success: true, vibeId: 'idle' }
  }
  
  if (trinity) {
    // 🔌 WAVE 64.5: El VibeManager arranca en idle (DEFAULT_VIBE = 'idle')
    // Cuando tengamos query real al worker, obtener el vibe actual
    // Por ahora, confiar en que el backend arranca en idle
    return { success: true, vibeId: 'idle' }
  }
  
  // 🔌 WAVE 64.5: Default es idle, no techno
  return { success: true, vibeId: 'idle' }
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
// 🎯 WAVE 39.1: Ahora recibe fftBins (64 bins normalizados 0-1)
ipcMain.handle('lux:audio-frame', (_event, audioData: {
  bass: number
  mid: number
  treble: number
  energy: number
  bpm?: number
  fftBins?: number[]  // 🎯 WAVE 39.1: FFT bins para visualización
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
  
  // 🎯 WAVE 39.1: Almacenar FFT bins en SeleneLux para getBroadcast()
  if (audioData.fftBins && selene) {
    selene.setFftBins(audioData.fftBins)
  }
  
  // 🛡️ WAVE 15.3: BYPASS ELIMINADO
  // El frontend DEBE enviar el buffer crudo via lux:audio-buffer
  // Este handler legacy NO alimenta a Trinity Workers
  
  return { success: true }
})

// ============================================
// WAVE 9.5: FIXTURE LIBRARY IPC HANDLERS
// ============================================

// using native fs (sync) via top-level imports; promise-based fs is `fsp`

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
        const fullPath = path.join(searchPath, file)
        if (file.toLowerCase().endsWith('.fxt')) {
          const fixture = parseFXTFile(fullPath)
          if (fixture) {
            foundFixtures.push(fixture)
          }
        } else if (file.toLowerCase().endsWith('.json')) {
          try {
            const content = await fsp.readFile(fullPath, 'utf-8')
            const fixture = JSON.parse(content) as FixtureLibraryItem
            if (fixture && fixture.id && fixture.name) {
              foundFixtures.push(fixture)
            }
          } catch (err) {
            console.warn(`[Fixtures] Failed to parse JSON fixture: ${file}`, err)
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

// ⚡ WAVE 27 - PHASE 1.5: Fixture Forge - Save Definition
ipcMain.handle('lux:save-fixture-definition', async (_event, def: FixtureDefinition) => {
  try {
    console.log('[Main] 💾 Request to save fixture:', def.name);

    // 1. Determinar la ruta.
    // process.cwd() suele ser la raíz del proyecto en desarrollo.
    const librariesPath = isDev
      ? path.resolve(process.cwd(), '..', 'librerias')
      : path.join(process.resourcesPath, 'librerias');

    // 2. Asegurar que la carpeta existe
    try {
      await fsp.access(librariesPath);
    } catch {
      console.log('[Main] Creating /librerias folder...');
      await fsp.mkdir(librariesPath, { recursive: true });
    }

    // 3. Sanitizar nombre (cambiar espacios por guiones, etc)
    const safeName = def.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `${safeName}.json`;
    const fullPath = path.join(librariesPath, fileName);

    // 4. Escribir el archivo
  await fsp.writeFile(fullPath, JSON.stringify(def, null, 2), 'utf-8');

    console.log('[Main] ✅ Saved successfully at:', fullPath);

    return { success: true, path: fullPath };

  } catch (error) {
    console.error('[Main] ❌ Error saving fixture:', error);
    return { success: false, error: String(error) };
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

  // Si el frontend envía opciones de física, registrar la fixture en el FixturePhysicsDriver
  try {
    const anyData: any = data as any
    if (anyData.physics) {
      // Usamos el id único del patched para registrar
      fixturePhysicsDriver.registerFixture(patched.id, anyData.physics)
      console.log(`[Physics] Registered fixture ${patched.id} with physics config`)
    }
  } catch (err) {
    console.warn('[Physics] Failed to register fixture physics:', err)
  }
  
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
