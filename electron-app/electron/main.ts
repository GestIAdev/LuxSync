/**
 * LUXSYNC ELECTRON - MAIN PROCESS V2
 * 
 * WAVE 243.5: THE REBIRTH
 * WAVE 365: SYSTEM INTEGRATION
 * WAVE 367: SPRING CLEANING
 * 
 * Este archivo ha sido reducido de 3467 lineas a ~300 lineas.
 * Toda la logica ha sido delegada a:
 * - TitanOrchestrator: Orquestacion Brain -> Engine -> HAL
 * - IPCHandlers: 61+ handlers IPC centralizados
 * - EventRouter: Routing de eventos interno
 * - StagePersistence: Persistencia V2 (WAVE 365)
 * - ConfigManagerV2: Solo preferencias (WAVE 367)
 * 
 * LuxSync V2 - NO HAY VUELTA ATRAS
 */

import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, clipboard, session, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { MessageChannelMain } from 'electron'
import { BufferPoolManager } from '../src/core/aether/glass/BufferPoolManager'

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2489: THE OBSIDIAN VAULT — V8 Bytecode License Validator
// bytenode registra el handler para .jsc ANTES de cualquier require()
// ═══════════════════════════════════════════════════════════════════════════
const bytenode = require('bytenode')

// TITAN 2.0 Core Modules
import { TitanOrchestrator, setupIPCHandlers, type IPCDependencies, registerTitanOrchestrator } from '../src/core/orchestrator'

// ⚡ WAVE 4529: Aether Programmer IPC Handlers
import { registerAetherIPCHandlers } from '../src/core/aether/AetherIPCHandlers'

// Stage Persistence (WAVE 365)
import { stagePersistence, setupStageIPCHandlers } from '../src/core/stage'

// ⌨ WAVE 4805: KeyForge Loadout IPC
import { setupKeyForgeIPCHandlers } from '../src/core/keyforge/KeyForgeIPCHandlers'

// 🧬 FASE 4.3: Vibe Lab — .luxvibe persistence IPC
import { registerVibeLabIPCHandlers } from '../src/core/vibe/VibeLabIPCHandlers'
// 🧬 PROTEUS FIX 2: Boot-time regraft of custom vibes
import { vibeLabPersistence } from '../src/core/vibe/VibeLabPersistence'
import { resolveCustomVibe } from '../src/engine/vibe/custom/VibeFusionResolver'
import { graft as graftToBackend } from '../src/engine/vibe/custom/VibeGraftRegistry'

// ⚒️ Hephaestus File I/O (WAVE 2030.5)
import { setupHephIPCHandlers } from '../src/core/hephaestus'

// 🧬 WAVE 5000.V3: Genesis Engine IPC (Era V)
import { setupGenesisIPCHandlers } from '../src/core/genesis/genesisIpc'
import { getGenesisVault } from '../src/core/genesis/GenesisVaultService'
import { igniteGenesisEngine, shutdownGenesisEngine } from '../src/core/genesis/GenesisIgnition'

// 🎬 WAVE 4864: Theia Output Window manager (Phase 3)
import { setupTheiaWindowManager } from './TheiaWindowManager'

// 🚀 WAVE 7580: VANGUARD LAUNCHER — pre-boot render fidelity gate
import { probeHardware, shouldShowLauncher } from './launcher/probeHardware'
import { registerLauncherIpc } from './launcher/launcherIpc'

// ⚡ WAVE 4822: INFINITE ARSENAL — Boot ingestion
import { LfxFileLoader, type DirectorySpec } from '../src/core/arsenal/LfxFileLoader'
import { getDynamicEffectRegistry } from '../src/core/arsenal/DynamicEffectRegistry'

// Config Manager V2 (WAVE 367) - PREFERENCES ONLY, NO FIXTURES
import { configManager } from '../src/core/config/ConfigManagerV2'

// External Services
import { FixturePhysicsDriver } from '../src/engine/movement/FixturePhysicsDriver'
import { universalDMX, type DMXDevice } from '../src/hal/drivers/UniversalDMXDriver'
import { artNetDriver } from '../src/hal/drivers/ArtNetDriver'
// 📡 WAVE 7102: Art-Net Timecode multiplexing on existing UDP 6454 socket
import { parseArtNetTimecodePacket } from '../src/chronos/protocols/ArtNetTimecodeReceiver'
// 🥁 WAVE 7103: MIDI Clock Master — high-resolution timer in Main Process
import { MidiMasterClock } from './midi/MidiMasterClock'
// 🎨 WAVE 686.10: Import ArtNetDriverAdapter to bridge ArtNet to HAL
import { createArtNetAdapter } from '../src/hal/drivers/ArtNetDriverAdapter'
// 🔥 WAVE 2100: CompositeDMXDriver — dual output USB + ArtNet
import { CompositeDMXDriver } from '../src/hal/drivers/CompositeDMXDriver'
import { USBDMXDriverAdapter } from '../src/hal/drivers/USBDMXDriverAdapter'
import { EffectsEngine } from '../src/engine/color/EffectsEngine'
import { latinoEngine41Telemetry } from '../src/hal/physics'
// ShowManager PURGED - WAVE 365: Replaced by StagePersistence
import { FXTParser, fxtParser } from '../src/core/library/FXTParser'
import { setRuntimeFixtureLibrary } from '../src/core/library/RuntimeFixtureLibrary'

// 👻 WAVE 2005.3: Phantom Worker for audio analysis
import { getPhantomWorker, destroyPhantomWorker } from './workers/PhantomWorkerManager'
import { setupChronosIPCHandlers, cleanupChronosIPC } from './ipc/ChronosIPCHandlers'
// 🎬 WAVE 2053.1: TimelineEngine playback IPC
import { setupPlaybackIPCHandlers, cleanupPlaybackIPC } from './ipc/PlaybackIPCHandlers'

// =============================================================================
// GLOBAL STATE
// =============================================================================

let mainWindow: BrowserWindow | null = null
// 🚀 WAVE 7580: VANGUARD LAUNCHER — kept SEPARATE from mainWindow so the
// module-level `mainWindow.on('closed') → doShutdown()` (line ~539) cannot
// tear down the backend when the launcher closes (blueprint invariant #3 / risk #1).
let launcherWindow: BrowserWindow | null = null
// 🚀 WAVE 7581: BOOT GUARD — true from app launch until createWindow() has
// produced the main app window. The `window-all-closed` listener below would
// otherwise fire in the microsecond gap between `launcherWindow.close()` and
// `createWindow()` (the launcher is the only live window at that instant) and
// tear the whole process down before the main window exists. Flipped to false
// once the main window's `did-finish-load` confirms the renderer is up.
let isBooting = true
// 🩸 WAVE 7567: Renderer liveness flag — prevents infinite "Render frame was disposed"
// error flood when the renderer crashes/reloads but webContents.isDestroyed() still
// returns false. All tick-driven broadcast callbacks check this before calling .send().
// Set true on did-finish-load, false on render-process-gone.
let rendererAlive = false
let effectsEngine: EffectsEngine | null = null
let titanOrchestrator: TitanOrchestrator | null = null
export const glassPoolManager = new BufferPoolManager()

const fixturePhysicsDriver = new FixturePhysicsDriver()
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// =============================================================================
// 🧬 PROTEUS FIX 2: Boot-time regraft of custom vibes
// =============================================================================
// Reads all .luxvibe files from userData/vibes/, resolves each one via
// VibeFusionResolver, and grafts the FusedVibeBundle into the backend's 7
// canonical registries. This ensures normalizeVibeId('custom:...') finds the
// key immediately when the renderer requests setVibe after a restart.
// =============================================================================

async function regraftCustomVibesOnBoot(): Promise<void> {
  try {
    const entries = await vibeLabPersistence.list()
    if (entries.length === 0) {
      console.log('[Boot] No custom vibes to regraft.')
      return
    }

    let grafted = 0
    let failed = 0
    for (const entry of entries) {
      try {
        const readResult = await vibeLabPersistence.read(entry.key)
        if (!readResult.ok || !readResult.data) {
          console.warn(`[Boot] Failed to read ${entry.key}: ${readResult.error}`)
          failed++
          continue
        }
        const resolved = resolveCustomVibe(readResult.data)
        if (!resolved.ok || !resolved.bundle) {
          console.warn(`[Boot] Failed to resolve ${entry.key}:`, resolved.diagnostics)
          failed++
          continue
        }
        graftToBackend(resolved.bundle)
        grafted++
      } catch (err) {
        console.warn(`[Boot] Exception regrafting ${entry.key}:`, err)
        failed++
      }
    }
    console.log(`[Boot] 🧬 Regrafted ${grafted} custom vibe(s)${failed > 0 ? `, ${failed} failed` : ''}.`)
  } catch (err) {
    console.error('[Boot] regraftCustomVibesOnBoot error:', err)
  }
}

// 🥁 WAVE 7103: MIDI Master Clock — high-resolution timer in Main Process
const midiMasterClock = new MidiMasterClock()

// ═══════════════════════════════════════════════════════════════════════════
// 👁️ WAVE 3290: OJO DEL HURACÁN — White-list Logging (CONCIENCIA SELECTIVA)
// ═══════════════════════════════════════════════════════════════════════════
// Política de visibilidad por prefijo. Solo hablan los módulos autorizados.
//
// WHITELIST:
//   Selene IA:    [SeleneTitanConscious], [DecisionMaker], [EffectRepository]
//   Coreógrafo:  [CHOREO], [GatlingRaid], [SimpleSectionTracker]
//   Lifecycle:   [TitanOrchestrator], [UniversalDMX], [DMX-Worker], [GLOBAL_COOLDOWN]
//
// SILENCIO ABSOLUTO: [SENSE], [SENSES], [GodEar], [BabelFish], [AGC],
//                    [INTERVAL], [IPC], [AGC TRUST], [Harmony], [FUZZY]
//
// DEBUG PROBE — Comentar este bloque para restaurar salida cruda de consola.
// ─────────────────────────────────────────────────────────────────────────────
// 🔓 WAVE 4571: BLACKOUT DISABLED — Logs fluyen sin filtro
/*
;(function installConsciousnessFilter() {
  const _orig = {
    log:   console.log.bind(console),
    info:  console.info.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  }

  // Prefijos autorizados — cualquier log que empiece con uno de estos PASA
  const WHITELIST: string[] = [
    // Selene IA — narrativa de consciencia
    '[SeleneTitanConscious',
    '[DecisionMaker',
    '[EffectRepository',
    '[EffectManager',
    '[GatlingRaid',
    '[GLOBAL_COOLDOWN',
    // Coreógrafo / Movimiento
    '[CHOREO',
    '[VibeMovementManager',
    // Lifecycle — arranque del sistema y vibes
    '[TitanOrchestrator',
    '[UniversalDMX',
    '[VIBE',
    '[LuxSync',
    // Native audio subsystem — LIFT LOG BLACKOUT (WAVE 3403.2)
    '[NativeAudio',
    '[VirtualWire',
    '[WASAPI',
    '[OmniInput',
    // 🔬 WAVE 3418: Raw peak telemetry — SAB vs LegacyBridge voltage comparison
    '[🔬 PEAK-SAB]',
    '[🔬 PEAK-IPC]',
    '[🔬 BPM-TELEMETRY]',
    // WAVE 3433-A: Forensic audit logs
    '[MATH AUDIT]',
    '[ZOMBIE RADAR]',
    // 🥁 BPM Tracker diagnostics (WAVE 3411 lift)
    '[🥁 INTERVAL BPM]',
    '[DEMBOW CEILING',
    // 🔍 WAVE-DIAG: Color pipeline diagnostics (EL1140 / movers)
    '[🔍 COLOR-DIAG]',
    '[🔍 ARBITER-DIAG]',
    '[🐟 BABEL FISH]',
    // Noto: [SimpleSectionTracker], [HuntEngine], [DNA_ANALYZER], [DMX-Worker]
    // hibernados — son ruido de ticker, no eventos de conciencia.
    // DEBUG PROBE — Añadir aquí si se necesitan para auditoría.
  ]

  function _allowed(args: unknown[]): boolean {
    if (typeof args[0] !== 'string') return false
    const msg = args[0]
    return WHITELIST.some(prefix => msg.startsWith(prefix))
  }

  const _filter = (orig: (...a: unknown[]) => void) =>
    (...args: unknown[]) => { if (_allowed(args)) orig(...args) }

  console.log   = _filter(_orig.log)
  console.info  = _filter(_orig.info)
  console.debug = _filter(_orig.debug)
  console.warn  = _filter(_orig.warn)
  // error siempre pasa — son fallos reales que hay que saber
  console.error = _orig.error
})
*/
// ─────────────────────────────────────────────────────────────────────────────
// Populated after Two-Gate validation. Dev mode defaults to FULL_SUITE.
// ═══════════════════════════════════════════════════════════════════════════
let currentLicenseTier: 'DJ_FOUNDER' | 'FULL_SUITE' = 'FULL_SUITE'

// =============================================================================
// FIXTURE TYPES & ZONING (WAVE 2040.24: CANONICAL)
// =============================================================================

// 🔥 WAVE 2040.24: FixtureZone importado desde fuente canónica
import type { FixtureZone } from '../src/core/stage/ShowFileV2'

interface FixtureLibraryItem {
  id: string
  name: string
  manufacturer: string
  channelCount: number
  type: string
  filePath: string
  confidence?: number
  detectionMethod?: string
  hasMovementChannels?: boolean
  has16bitMovement?: boolean
  hasColorMixing?: boolean
  hasColorWheel?: boolean
  manualOverride?: string
  // WAVE 390.5: Datos completos para Edit
  channels?: Array<{ index: number; name?: string; type: string; is16bit: boolean; defaultValue?: number }>
  physics?: {
    motorType?: string
    maxAcceleration?: number
    maxVelocity?: number
    safetyCap?: number | boolean
    orientation?: string
    invertPan?: boolean
    invertTilt?: boolean
    swapPanTilt?: boolean
    homePosition?: { pan: number; tilt: number }
    tiltLimits?: { min: number; max: number }
  }
  capabilities?: {
    hasPan?: boolean
    hasTilt?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
    hasGobo?: boolean
    hasPrism?: boolean
    hasStrobe?: boolean
    hasDimmer?: boolean
  }
  // 🔧 WAVE 4735.11: Preserve V2 Forge graph data in runtime library
  nodeGraph?: any
  forgeGraph?: any
}

interface PatchedFixture extends FixtureLibraryItem {
  dmxAddress: number
  universe: number
  zone: FixtureZone
}

let fixtureLibrary: FixtureLibraryItem[] = []
let patchedFixtures: PatchedFixture[] = []
let manualOverrides: Map<number, {
  dimmer?: number
  r?: number
  g?: number
  b?: number
  pan?: number
  tilt?: number
}> = new Map()

// Zone counters for auto-assignment
let zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 }

// WAVE 390.5: Factory library path (stored after initialization)
let factoryLibPath: string = ''
let customLibPath: string = ''

/**
 * WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
 * This is the ONLY function that should update fixtureLibrary after save/delete
 */
async function rescanAllLibraries(): Promise<FixtureLibraryItem[]> {
  
  // Scan both libraries
  // ðŸ›¡ï¸ WAVE 7555: UNBLOCK ALPHA â scanFolder ahora es async.
  // Promise.all permite que ambas librerÃ­as se escaneen en paralelo
  // sin bloquear el event loop del main thread.
  const [factoryDefinitions, customDefinitions] = await Promise.all([
    fxtParser.scanFolder(factoryLibPath),
    fxtParser.scanFolder(customLibPath),
  ])
  
  // 🧹 WAVE 671.5: Removed obsolete test_beam debug log (no longer needed)
  // WAVE 390.5 DEBUG: Log test_beam specifically (it has physics)
  // const testBeam = customDefinitions.find(f => f.name.toLowerCase().includes('test'))
  // if (testBeam) {
  //   console.log('[Library] 🔬 test_beam fixture data:', {
  //     name: testBeam.name,
  //     channelCount: testBeam.channelCount,
  //     hasChannels: !!testBeam.channels,
  //     channelsLength: testBeam.channels?.length,
  //     firstChannel: testBeam.channels?.[0],
  //     hasPhysics: !!testBeam.physics,
  //     physics: testBeam.physics
  //   })
  // } else {
  //   console.log('[Library] ℹ️ test_beam not found in custom folder')
  // }
  
  // Merge: custom overrides factory by name (not ID, IDs are unreliable for .fxt files)
  const mergedLibrary: FixtureLibraryItem[] = [...factoryDefinitions]
  for (const customFix of customDefinitions) {
    // Match by name (case-insensitive) since IDs are generated
    const existingIndex = mergedLibrary.findIndex(
      f => f.name.toLowerCase() === customFix.name.toLowerCase()
    )
    if (existingIndex >= 0) {
      mergedLibrary[existingIndex] = customFix // Custom overrides factory
    } else {
      mergedLibrary.push(customFix) // New custom fixture
    }
  }
  
  fixtureLibrary = mergedLibrary
  setRuntimeFixtureLibrary(mergedLibrary as import('../src/core/library/RuntimeFixtureLibrary').RuntimeFixtureDefinition[])
  
  return fixtureLibrary
}

function resetZoneCounters(): void {
  zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 }
}

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
}

function autoAssignZone(fixtureType: string | undefined, fixtureName?: string): FixtureZone {
  const typeUpper = (fixtureType || '').toUpperCase()
  const nameUpper = (fixtureName || '').toUpperCase()
  
  // Moving heads detection
  if (typeUpper.includes('MOVING') || typeUpper.includes('SPOT') || typeUpper.includes('BEAM') || typeUpper.includes('HEAD') ||
      nameUpper.includes('BEAM') || nameUpper.includes('SPOT') || nameUpper.includes('VIZI') || 
      nameUpper.includes('5R') || nameUpper.includes('7R') || nameUpper.includes('MOVING')) {
    const currentCount = zoneCounters.moving
    zoneCounters.moving++
    // 🔥 WAVE 2040.24: Canonical zones
    const zone: FixtureZone = currentCount % 2 === 0 ? 'movers-left' : 'movers-right'
    return zone
  }
  
  // Strobes → center
  if (typeUpper.includes('STROBE') || nameUpper.includes('STROBE')) {
    zoneCounters.strobe++
    return 'center'
  }
  
  // Lasers → air
  if (typeUpper.includes('LASER') || nameUpper.includes('LASER')) {
    zoneCounters.laser++
    return 'air'
  }
  
  // PAR/LED/Wash - alternating back/front
  const currentParCount = zoneCounters.par
  zoneCounters.par++
  // 🔥 WAVE 2040.24: Canonical zones
  const zone: FixtureZone = currentParCount % 2 === 0 ? 'back' : 'front'
  return zone
}

// =============================================================================
// WINDOW CREATION
// =============================================================================

/**
 * 🚀 WAVE 7580: VANGUARD LAUNCHER — open the pre-boot render fidelity window.
 *
 * Returns a Promise that resolves ONLY when the window emits its `'closed'`
 * event. That event is the single funnel for every exit path:
 *   - `launcher:commit` → main calls `win.close()` after the awaited write
 *   - `launcher:cancel` (Esc) → main calls `win.close()`, no write
 *   - OS close button → Electron fires `'closed'` directly
 * Resolving on `'closed'` (not on `launcher:commit`) guarantees boot resumes
 * exactly once regardless of how the operator dismissed the window
 * (blueprint invariant #3 / §1.3 #3).
 *
 * The window is assigned to the module-scoped `launcherWindow` ref — NEVER to
 * `mainWindow`. `mainWindow.on('closed')` triggers `doShutdown()` (line ~539),
 * which would tear down the backend the instant the launcher closes
 * (blueprint risk #1).
 *
 * Never calls `app.quit()` on close — dismissing the launcher must never be
 * able to block startup (blueprint invariant #6, deliberate divergence from
 * the license activation window).
 */
function showLauncherWindow(): Promise<void> {
  return new Promise((resolve) => {
    const iconExt = process.platform === 'darwin' ? 'icns' : process.platform === 'linux' ? 'png' : 'ico'
    const appIcon = path.join(__dirname, `../build/icon.${iconExt}`)

    launcherWindow = new BrowserWindow({
      width: 620,
      height: 460,
      frame: false,
      resizable: false,
      title: 'LuxSync — Vanguard',
      icon: appIcon,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'launcher', 'preload-launcher.js'),
      },
    })

    launcherWindow.loadFile(path.join(__dirname, 'launcher', 'launcher.html'))

    // Single resume funnel — fires for commit, cancel, and OS close alike.
    launcherWindow.once('closed', () => {
      launcherWindow = null
      resolve()
    })
  })
}

function createWindow(): void {
  // 🌟 WAVE 2497: icon multiplataforma — .ico en Windows, .icns en macOS
  const iconExt = process.platform === 'darwin' ? 'icns' : process.platform === 'linux' ? 'png' : 'ico'
  const appIcon = path.join(__dirname, `../build/icon.${iconExt}`)

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,           // Custom title bar
    title: 'LuxSync',
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  })

  // Permission handlers — WAVE 3301: midi + midiSysex unlocked for nanoPAD2
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'midi' || permission === 'midiSysex') return true
    return ['media', 'mediaKeySystem', 'geolocation'].includes(permission)
  })

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'midi', 'midiSysex']
    callback(allowedPermissions.includes(permission))
  })

  // Display media request handler
  mainWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 150, height: 150 }
      })
      
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

    // F12 abre DevTools en cualquier entorno (sin exponer nada al renderer)
    mainWindow?.webContents.on('before-input-event', (_, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow?.webContents.toggleDevTools()
      }
    })
    

  // Evita que un drop de archivo navegue el BrowserWindow fuera de la app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return
    // 🚀 WAVE 7581: BOOT GUARD — the main app renderer is up. The launcher →
    // main window handoff is complete; `window-all-closed` is now safe to act
    // on a future empty window set. Flipping here (rather than at createWindow
    // call time) means a crash during load still leaves the guard armed, so
    // Electron's own crash handling can tear things down without us racing it.
    isBooting = false
    // 🩸 WAVE 7567: Renderer is alive — re-enable broadcast callbacks
    rendererAlive = true
    const { port1, port2 } = new MessageChannelMain()
    glassPoolManager.attach(port1)
    mainWindow.webContents.postMessage('glass:port', null, [port2])

    // WAVE 7120: Calibration SAB is created in setupCalibrationHandlers (IPCHandlers.ts)
    // Broadcast fixtures if loaded
    if (patchedFixtures.length > 0 && mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
    }
  })

  // 🩸 WAVE 7567: Kill broadcast flood at the source. When the renderer process
  // crashes or the render frame is disposed (e.g. HMR hot reload in dev), the
  // webContents.isDestroyed() check still returns false — but .send() throws
  // "Render frame was disposed before WebFrameMain could be accessed". Electron
  // logs this to stderr BEFORE the try-catch can swallow it, and the TickEngine
  // keeps firing at 44Hz → infinite error flood. This handler flips rendererAlive
  // to false so all broadcast callbacks skip .send() entirely until the renderer
  // comes back (did-finish-load re-enables it). The TickEngine keeps running,
  // lights stay on — only the UI broadcast is paused.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    rendererAlive = false
    console.error(`[Main] 🩸 WAVE 7567: Renderer process gone (reason=${details.reason}). Broadcast callbacks paused — lights keep running.`)
  })
  }) // close ready-to-show

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    // ⚡ WAVE 2495: THE SILVER BULLET — Shutdown atado a la puerta principal.
    // window-all-closed NO es fiable cuando hay ventanas ocultas (phantomWorker,
    // background renderers). Este hook dispara SIN EXCUSAS cuando el usuario
    // cierra la ventana visible. No hay ventana secundaria que lo bloquee.
    rendererAlive = false
    mainWindow = null
    doShutdown()
  })

  // Notify renderer of maximize state changes (for custom title bar button icon)
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized', false)
  })
}

// =============================================================================
// TITAN 2.0 INITIALIZATION
// =============================================================================

async function initTitan(): Promise<void> {
  // WAVE 2098: Boot silence — banners removed

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 365: Initialize Stage Persistence (BEFORE other systems)
  // ═══════════════════════════════════════════════════════════════════════════
  await stagePersistence.init()
  setupStageIPCHandlers(() => mainWindow)

  // ═══════════════════════════════════════════════════════════════════════════
  // ⌨ WAVE 4805: KeyForge Loadout persistence
  // ═══════════════════════════════════════════════════════════════════════════
  setupKeyForgeIPCHandlers(() => mainWindow)

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧬 FASE 4.3: Vibe Lab — .luxvibe persistence
  // ═══════════════════════════════════════════════════════════════════════════
  registerVibeLabIPCHandlers()

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧬 PROTEUS FIX 2: Boot-time regraft of custom vibes
  // Read all .luxvibe files from disk, resolve them, and graft into the
  // backend registries so normalizeVibeId('custom:...') finds them
  // immediately when the renderer requests setVibe after a restart.
  // ═══════════════════════════════════════════════════════════════════════════
  regraftCustomVibesOnBoot().catch((err) => {
    console.error('[Boot] Failed to regraft custom vibes:', err)
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 4910.6: Theia Asset export — Native Save As dialog
  // ═══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('lux:theia:exportAsset', async (_event, asset: unknown, suggestedName?: string) => {
    const win = mainWindow
    if (!win) return { success: false, error: 'No main window' }
    try {
      const result = await dialog.showSaveDialog(win, {
        title: 'Exportar Asset .theia',
        defaultPath: suggestedName ?? 'asset.theia',
        filters: [{ name: 'Theia Asset', extensions: ['theia'] }],
      })
      if (result.canceled || !result.filePath) return { success: false, cancelled: true }
      await fs.promises.writeFile(result.filePath, JSON.stringify(asset, null, 2), 'utf-8')
      console.log(`[TheiaExport] ✅ ${result.filePath}`)
      return { success: true, filePath: result.filePath }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[TheiaExport] ❌', msg)
      return { success: false, error: msg }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚒️ WAVE 2030.5: Initialize Hephaestus File I/O
  // ═══════════════════════════════════════════════════════════════════════════
  setupHephIPCHandlers()

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧬 WAVE 5000.V3: Initialize Genesis Engine IPC + Ignite Geological Loop
  // ═══════════════════════════════════════════════════════════════════════════
  setupGenesisIPCHandlers()
  try {
    getGenesisVault().initialize()
    igniteGenesisEngine().catch((err) => {
      console.warn('[Main] ⚠️ Genesis ignition failed (non-fatal):', err)
    })
  } catch (err) {
    console.warn('[Main] ⚠️ Genesis vault init failed (non-fatal):', err)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 👻 WAVE 2005.3: Initialize Phantom Worker for audio analysis
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const phantom = getPhantomWorker()
    await phantom.init()
    setupChronosIPCHandlers(mainWindow!)
    setupPlaybackIPCHandlers(mainWindow!) // WAVE 2054: Pass window for arbiter feedback
  } catch (err) {
    console.error('[Main] ❌ Failed to initialize Phantom Worker:', err)
    // Non-fatal - Chronos will work without audio analysis
  }

  // Initialize EffectsEngine
  effectsEngine = new EffectsEngine()
  
  // 🔥 WAVE 2100: COMPOSITE DRIVER — USB + ArtNet en paralelo
  const usbAdapter = new USBDMXDriverAdapter()
  const artNetAdapter = createArtNetAdapter(artNetDriver)
  const compositeDriver = new CompositeDMXDriver(usbAdapter, artNetAdapter)
  
  // Initialize TitanOrchestrator (WAVE 254: Now the ONLY orchestrator)
  // 🔥 WAVE 2100: Pass COMPOSITE driver so HAL outputs to BOTH USB and ArtNet
  titanOrchestrator = new TitanOrchestrator({ 
    debug: isDev,
    dmxDriver: compositeDriver
  })

  titanOrchestrator.glassPool = glassPoolManager

  // 🔒 WAVE 2490: Inject license tier into TitanOrchestrator
  titanOrchestrator.setLicenseTier(currentLicenseTier)
  
  // WAVE 380: Register as singleton so IPC handlers can access the same instance
  registerTitanOrchestrator(titanOrchestrator)

  // ════════════════════════════════════════════════════════════
  // ⚡ INFINITE ARSENAL — BOOT INGESTION (Single Source of Truth)
  // userData/arsenal/ es la única fuente de verdad para .lfx.
  // Si está vacío, se copia desde builtins/ (fábrica) al primer arranque.
  // WAVE 2529: Manifest-based incremental sync — solo copia builtins nuevos
  // o actualizados, preservando efectos custom del usuario.
  // ════════════════════════════════════════════════════════════
  try {
    const _arsenalPath = path.join(app.getPath('userData'), 'arsenal')
    const _builtinPath = app.isPackaged
      ? path.join(process.resourcesPath, 'builtins')
      : path.join(__dirname, '..', 'src', 'core', 'arsenal', 'builtins')

    // ── Helper: compute SHA-256 checksum (first 16 chars) ──
    const _checksum = (filePath: string): string => {
      const content = fs.readFileSync(filePath)
      return require('crypto').createHash('sha256').update(content).digest('hex').slice(0, 16)
    }

    // ── Helper: recursive copy .lfx files preserving subfolder structure ──
    const _copyRecursive = (srcDir: string, destDir: string) => {
      fs.mkdirSync(destDir, { recursive: true })
      const entries = fs.readdirSync(srcDir, { withFileTypes: true })
      for (const entry of entries) {
        const src = path.join(srcDir, entry.name)
        const dest = path.join(destDir, entry.name)
        if (entry.isDirectory()) {
          _copyRecursive(src, dest)
        } else if (entry.name.toLowerCase().endsWith('.lfx')) {
          fs.copyFileSync(src, dest)
        }
      }
    }

    // ── Helper: count .lfx recursively ──
    const _countLfx = (dir: string): number => {
      let count = 0
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          count += _countLfx(path.join(dir, entry.name))
        } else if (entry.name.toLowerCase().endsWith('.lfx')) {
          count++
        }
      }
      return count
    }

    // ── WAVE 2529: Manifest-based incremental sync ──
    // The manifest.json in builtins/ lists every .lfx with a checksum.
    // We compare it against the installed manifest in userData/arsenal/.
    // New/updated files are copied; user-created effects are never touched.
    const _builtinManifestPath = path.join(_builtinPath, 'manifest.json')
    const _installedManifestPath = path.join(_arsenalPath, '.builtin-manifest.json')

    interface BuiltinManifest {
      schema: number
      version: string
      generatedAt: string
      count: number
      files: Record<string, { relPath: string; checksum: string; size: number }>
    }

    let _builtinManifest: BuiltinManifest | null = null
    let _installedManifest: BuiltinManifest | null = null

    try {
      if (fs.existsSync(_builtinManifestPath)) {
        _builtinManifest = JSON.parse(fs.readFileSync(_builtinManifestPath, 'utf-8'))
      }
    } catch { /* malformed manifest — treat as null */ }

    try {
      if (fs.existsSync(_installedManifestPath)) {
        _installedManifest = JSON.parse(fs.readFileSync(_installedManifestPath, 'utf-8'))
      }
    } catch { /* malformed — treat as null */ }

    if (_builtinManifest && fs.existsSync(_builtinPath)) {
      fs.mkdirSync(_arsenalPath, { recursive: true })

      const _builtinFiles = _builtinManifest.files
      const _installedFiles = _installedManifest?.files ?? {}

      let _syncedCount = 0
      let _skippedCount = 0
      let _newCount = 0

      for (const [relPath, entry] of Object.entries(_builtinFiles)) {
        // 🛡️ WAVE 7545: custom/ is exclusive user-space — never sync as builtin.
        // Even if a stale manifest.json contains custom/ entries (generated before
        // Fix A), this guard prevents them from being copied into userData/arsenal/,
        // protecting user deletions from being undone on every boot.
        if (relPath.startsWith('custom/')) continue

        const _destFile = path.join(_arsenalPath, relPath)
        const _srcFile = path.join(_builtinPath, relPath)

        // Ensure source exists (manifest could be stale if build was partial)
        if (!fs.existsSync(_srcFile)) continue

        // Ensure parent directory exists
        const _destDir = path.dirname(_destFile)
        fs.mkdirSync(_destDir, { recursive: true })

        const _installedEntry = _installedFiles[relPath]

        if (!fs.existsSync(_destFile)) {
          // New file — copy it
          fs.copyFileSync(_srcFile, _destFile)
          _syncedCount++
          _newCount++
        } else if (!_installedEntry || _installedEntry.checksum !== entry.checksum) {
          // Updated builtin — overwrite (user effects have no manifest entry)
          fs.copyFileSync(_srcFile, _destFile)
          _syncedCount++
        } else {
          // Already installed and unchanged — skip
          _skippedCount++
        }
      }

      // Write the installed manifest for next boot's comparison
      fs.writeFileSync(_installedManifestPath, JSON.stringify(_builtinManifest, null, 2))

      if (_syncedCount > 0) {
        console.log(
          `[TitanOrchestrator] 📦 Arsenal sync (v${_builtinManifest.version}): ` +
          `${_syncedCount} .lfx synced (${_newCount} new), ${_skippedCount} unchanged`
        )
      } else {
        console.log(`[TitanOrchestrator] 📦 Arsenal up-to-date: ${_skippedCount} builtins (v${_builtinManifest.version})`)
      }
    } else {
      // Fallback: no manifest — use legacy full copy if arsenal is empty
      let _arsenalIsEmpty = true
      try {
        const _hasLfx = (dir: string): boolean => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
              if (_hasLfx(path.join(dir, entry.name))) return true
            } else if (entry.name.toLowerCase().endsWith('.lfx')) {
              return true
            }
          }
          return false
        }
        _arsenalIsEmpty = !_hasLfx(_arsenalPath)
      } catch { /* dir doesn't exist yet */ }

      if (_arsenalIsEmpty && fs.existsSync(_builtinPath)) {
        fs.mkdirSync(_arsenalPath, { recursive: true })
        _copyRecursive(_builtinPath, _arsenalPath)
        const _copiedCount = _countLfx(_arsenalPath)
        console.log(`[TitanOrchestrator] 📦 Bootstrapped arsenal (legacy): ${_copiedCount} .lfx copied from builtins → userData/arsenal/`)
      }
    }

    // ── WAVE 7522: UNIFIED LOAD PATH — dev == prod ──
    // Both dev and prod load ONLY from userData/arsenal/. The manifest sync
    // above already copies new/updated builtins into userData/arsenal/,
    // preserving user edits. Loading directly from builtins/ in dev was
    // creating a shadow entry with stale DNA (e.g. corazon_latino aggression=0.3
    // from the builtin overwriting the user's 0.527 edit).
    //
    // PREREQUISITE: `npm run build` must be run to regenerate manifest.json
    // and compile the stripSha256Prefix fix. Without it, the manifest sync
    // is stale and the checksum validation rejects valid files.
    const _loadDirs: DirectorySpec[] = [
      { absolutePath: _arsenalPath, source: 'user' }
    ]

    const _lfxLoader = new LfxFileLoader(getDynamicEffectRegistry())
    const _arsenalReport = await _lfxLoader.loadAll(_loadDirs)

    const _sourceLabel = 'userData/arsenal/'
    console.log(
      `[TitanOrchestrator] ⚡ Infinite Arsenal: ` +
      `${_arsenalReport.accepted}/${_arsenalReport.scanned} .lfx cargados desde ${_sourceLabel} ` +
      `(rechazados: ${_arsenalReport.rejected}, errores: ${_arsenalReport.errors})`
    )

    // ☢️ DUMP DE RAM: EFECTOS REALMENTE VIVOS EN REGISTRY
    const _allLiveEffects = getDynamicEffectRegistry().getAllEntries()
    console.log(`\n=== ☢️ DUMP DE RAM: EFECTOS REALMENTE VIVOS (${_allLiveEffects.length}) ===`)
    _allLiveEffects.forEach(e => {
      console.log(`- ID: ${e.id} | Name: ${e.name} | Aggr: ${e.dna.aggression.toFixed(3)} | Zone: ${e.energyZone.min}→${e.energyZone.max} | Press: ${e.pressureRange.min}→${e.pressureRange.max} | Vibes: ${JSON.stringify(e.compatibleVibes)} | Path: ${e.filePath || 'unknown'}`)
    })
    console.log(`====================================================\n`)

    // 🔍 WAVE 7522: DNA PERSISTENCE AUDIT — Verifica que las ediciones de ADN
    // hechas desde la UI sobreescriban los builtins en el registry.
    // Si el archivo userData tiene aggression=0.527 pero el registry dice 0.3,
    // el upsert-by-ID falló silenciosamente.
    const _auditIds = ['corazon_latino']
    for (const _aid of _auditIds) {
      const _entry = getDynamicEffectRegistry().getEntry(_aid)
      if (!_entry) {
        console.warn(`[DNA AUDIT 🔍] ⚠️ "${_aid}" NOT FOUND in registry — was it rejected by a gate?`)
      } else {
        console.log(`[DNA AUDIT 🔍] "${_aid}" → aggression=${_entry.dna.aggression.toFixed(3)} | zone=${_entry.energyZone.min}→${_entry.energyZone.max} | pressure=${_entry.pressureRange.min}→${_entry.pressureRange.max} | source=${_entry.isBuiltin ? 'BUILTIN' : 'USER'} | path=${_entry.filePath ?? 'null'}`)
      }
    }

    // 🔍 WAVE 7522: VIBE INDEX DIAGNOSTIC — Dump the vibe bucket sizes.
    // If the registry has 49 effects but the vibe index only has 2 per vibe,
    // the _appendToIndices / _removeFromIndices upsert logic is broken.
    const _vibeIndex = getDynamicEffectRegistry().getVibeIndexDiagnostic()
    console.log(`[VIBE INDEX 🔍] Bucket counts:`)
    for (const [_v, _c] of Object.entries(_vibeIndex).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${_v}: ${_c} effects`)
    }
  } catch (_arsenalErr) {
    console.error('[TitanOrchestrator] ❌ Arsenal boot failed (non-fatal):', _arsenalErr)
  }

  // ⚒️ UI REACTIVITY: Push 'heph:index-updated' to renderer whenever the
  // HephaestusClipIndex changes (save/canonize/delete/boot). This cures the
  // React UI race condition where useHephLibrary mounts before the index is populated.
  try {
    const { getHephaestusClipIndex } = await import('../src/core/hephaestus/HephaestusClipIndex')
    getHephaestusClipIndex().onDidChange(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('heph:index-updated')
        }
      } catch { /* renderer destroyed — ignore */ }
    })
  } catch (_indexWireErr) {
    console.warn('[TitanOrchestrator] ⚠️ Failed to wire HephaestusClipIndex change listener:', _indexWireErr)
  }
  // ════════════════════════════════════════════════════════════

  await titanOrchestrator.init()
  
  // WAVE 255.5: Connect broadcast callback to send fixture states to frontend
  // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
  // 🩸 WAVE-6060: TickEngine.TRUTH_BROADCAST_DIVIDER=4 controla la tasa (~11Hz).
  // Throttle eliminado del callback — una sola fuente de verdad.
  //
  // 🧬 FASE 1B: VIBE LAB TELEMETRY IGNITION
  // Al final de cada tick (cuando se broadcastea el SeleneTruth), construimos
  // un Float32Array(27) mapeando exactamente a TELEMETRY_LAYOUT del bus y lo
  // enviamos por IPC 'lux:vibe-lab:telemetry' — PERO sólo si hay un suscriptor
  // activo (renderer con el Vibe Lab montado). Sin suscriptores = cero overhead.
  let _vibeLabTelemetrySubscribed = false
  const _vibeLabTelemetryBuffer = new Float32Array(27)

  titanOrchestrator.setBroadcastCallback((truth) => {
    try {
      if (rendererAlive && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        truth.hardware.dmx.outputEnabled = titanOrchestrator.isOutputEnabled()
        mainWindow.webContents.send('selene:truth', truth)

        // 🧬 Vibe Lab telemetry — sólo si el renderer pidió suscripción
        if (_vibeLabTelemetrySubscribed) {
          const buf = _vibeLabTelemetryBuffer
          const zones = truth.intent.zones || {}
          // 0-6: zone intensities (Front L/R, Mover L/R, Back L/R, Ambient)
          buf[0]  = zones.frontL?.intensity ?? zones.front?.intensity ?? 0
          buf[1]  = zones.frontR?.intensity ?? zones.front?.intensity ?? 0
          buf[2]  = zones.left?.intensity ?? 0
          buf[3]  = zones.right?.intensity ?? 0
          buf[4]  = zones.backL?.intensity ?? zones.back?.intensity ?? 0
          buf[5]  = zones.backR?.intensity ?? zones.back?.intensity ?? 0
          buf[6]  = zones.ambient?.intensity ?? 0
          // 7-21: palette HSL (Primary, Secondary, Ambient, Accent, Strobe/Contrast)
          // HSLColor en el protocolo es 0-1 → convertir a H:0-360, S:0-100, L:0-100
          const pal = truth.intent.palette as Record<string, any> | undefined
          if (pal) {
            // 5 slots: primary, secondary, ambient, accent, contrast(strobe)
            const slots: Array<{ h: number; s: number; l: number } | undefined> = [
              pal.primary, pal.secondary, pal.ambient, pal.accent, pal.contrast,
            ]
            for (let i = 0; i < 5; i++) {
              const c = slots[i]
              buf[7 + i]  = c ? c.h * 360 : 0    // H: 0-360
              buf[12 + i] = c ? c.s * 100 : 0    // S: 0-100
              buf[17 + i] = c ? c.l * 100 : 50   // L: 0-100
            }
          } else {
            for (let i = 0; i < 5; i++) {
              buf[7 + i] = 0; buf[12 + i] = 0; buf[17 + i] = 50
            }
          }
          // 22: pan, 23: tilt — INTENT-BASED TELEMETRY (PROTEUS)
          // The Proteus Lab is a sandbox UI — it must show the mathematical
          // movement intent calculated by the choreo engine (Hephaestus /
          // MovementEngine / SeleneLux), DECOUPLED from the actual hardware
          // fixtures array. If the user has no moving heads patched, the
          // fixtures array is empty or has no movers — but the intent tree
          // still carries the calculated pan/tilt geometry.
          //
          // Source priority (all values are 0-1 normalized, 0.5 = center):
          //   1. intent.movement.mechanicsL  — explicit L mover coords from Deep Field
          //   2. intent.mechanics.moverL     — WAVE 1060 physics-driven override
          //   3. intent.movement.centerX/Y   — abstract movement center
          //   4. 0.5 (center)                — static fallback
          const intent = (truth.intent as any) || {}
          const mvmt = intent.movement || {}
          const mech = intent.mechanics || {}
          // Grab the first virtual mover's intent (L mover preferred — it's
          // the lead in stereo choreography)
          const virtualMover = mvmt.mechanicsL || mech.moverL || null
          const pan01 = virtualMover?.pan  ?? mvmt.centerX ?? 0.5
          const tilt01 = virtualMover?.tilt ?? mvmt.centerY ?? 0.5
          // Convert 0-1 normalized → [-1, 1] (0.5 = center = 0.0)
          buf[22] = Math.max(-1, Math.min(1, (pan01  - 0.5) * 2))
          buf[23] = Math.max(-1, Math.min(1, (tilt01 - 0.5) * 2))
          // 24: morphFactor (no disponible en truth → 0; el canvas lo muestra neutro)
          buf[24] = 0
          // 25: beat phase
          buf[25] = truth.sensory.beat?.beatPhase ?? 0
          // 26: energy
          buf[26] = truth.sensory.audio?.energy ?? 0
          mainWindow.webContents.send('lux:vibe-lab:telemetry', buf)
        }
      }
    } catch (err) { /* renderer destroyed, ignore */ }
  })


  // 🧬 Vibe Lab telemetry subscription IPC — el renderer avisa cuando monta/desmonta
  ipcMain.on('lux:vibe-lab:telemetry:subscribe', () => {
    _vibeLabTelemetrySubscribed = true
  })
  ipcMain.on('lux:vibe-lab:telemetry:unsubscribe', () => {
    _vibeLabTelemetrySubscribed = false
  })

  // �️ WAVE-6060 FALLBACK: selene:hot-frame como paracaídas si GlassBridge no levanta.
  let _lastHotFrame = 0
  titanOrchestrator.setHotFrameCallback((hotFrame) => {
    _lastHotFrame++
    try {
      if (rendererAlive && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        const glassActive = glassPoolManager.getMetrics().framesSent > 0
        if (!glassActive) {
          mainWindow.webContents.send('selene:hot-frame', hotFrame)
        }
      }
    } catch (err) { /* ignore */ }
  })

  // WAVE 257: Connect log callback for Tactical Log
  // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
  titanOrchestrator.setLogCallback((entry) => {
    try {
      if (rendererAlive && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('lux:log', entry)
      }
    } catch (err) {
      // Silently ignore - the renderer is being destroyed
    }
  })

  titanOrchestrator.start()  // Setup IPC handlers with all dependencies
  const ipcDeps: IPCDependencies = {
    mainWindow,
    titanOrchestrator,
    effectsEngine,
    configManager,
    universalDMX,
    artNetDriver,
    // showManager PURGED - WAVE 365: StagePersistence handles persistence now
    patchedFixtures,
    manualOverrides,
    fixturePhysicsDriver,
    fxtParser,
    fixtureLibrary,
    // Zone functions
    autoAssignZone,
    resetZoneCounters,
    recalculateZoneCounters,
    // Getters for dynamic state
    getMainWindow: () => mainWindow,
    getPatchedFixtures: () => patchedFixtures,
    setPatchedFixtures: (fixtures: PatchedFixture[]) => { patchedFixtures = fixtures },
    getFixtureLibrary: () => fixtureLibrary,
    setFixtureLibrary: (library: FixtureLibraryItem[]) => {
      fixtureLibrary = library
      setRuntimeFixtureLibrary(library as import('../src/core/library/RuntimeFixtureLibrary').RuntimeFixtureDefinition[])
    },
    // WAVE 390.5: Rescan ALL libraries (factory + custom)
    rescanAllLibraries,
    // WAVE 1115: Library paths (resolved by PATHFINDER)
    getFactoryLibPath: () => factoryLibPath,
    getCustomLibPath: () => customLibPath,
  }
  
  setupIPCHandlers(ipcDeps)
  
  // ⚡ WAVE 4529: Aether Programmer IPC Handlers (L2 overrides via NodeArbiter)
  registerAetherIPCHandlers()

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 WAVE 2490: THE TIER SEPARATION PROTOCOL — License tier IPC
  // ═══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('license:getTier', () => currentLicenseTier)

  // ⚡ WAVE 4914: ARSENAL CATALOG IPC
  // Expone el DynamicEffectRegistry al renderer para que MidiLearn y KeyForge
  // muestren la lista real de efectos .lfx cargados en vez de IDs hardcoded.
  ipcMain.handle('lux:arsenal:getCatalog', () =>
    getDynamicEffectRegistry().getEffectCatalog()
  )

  // ArtNet event forwarding
  artNetDriver.on('ready', () => {
    mainWindow?.webContents.send('artnet:ready', artNetDriver.getStatus())
  })
  artNetDriver.on('error', (error: Error) => {
    console.error('[ArtNet] Error:', error.message)
    mainWindow?.webContents.send('artnet:error', error.message)
  })
  artNetDriver.on('disconnected', () => {
    mainWindow?.webContents.send('artnet:disconnected')
  })

  // 📡 WAVE 7102: Art-Net Timecode multiplexing — forward OpTimeCode packets to renderer
  artNetDriver.on('timecode', (msg: Buffer) => {
    const packet = parseArtNetTimecodePacket(new Uint8Array(msg))
    if (packet) {
      mainWindow?.webContents.send('artnet:timecode', packet)
    }
  })

  // 🥁 WAVE 7103: MIDI Clock Master IPC — high-resolution timer in Main Process
  // 🩸 WAVE 7567: Guard with rendererAlive — MIDI pulse runs at ~56Hz (24ppq @140BPM)
  midiMasterClock.setPulseCallback((midiByte: number) => {
    if (rendererAlive) {
      try { mainWindow?.webContents.send('midi-master:pulse', midiByte) } catch { /* renderer gone */ }
    }
  })
  midiMasterClock.setTransportCallback((midiByte: number) => {
    if (rendererAlive) {
      try { mainWindow?.webContents.send('midi-master:transport', midiByte) } catch { /* renderer gone */ }
    }
  })
  ipcMain.on('midi-master:start', (_event, data: { fromZero?: boolean }) => {
    midiMasterClock.start(data?.fromZero ?? true)
  })
  ipcMain.on('midi-master:stop', () => {
    midiMasterClock.stop()
  })
  ipcMain.on('midi-master:set-bpm', (_event, data: { bpm: number }) => {
    midiMasterClock.setBpm(data.bpm)
  })

  // WAVE 2098: Unified boot banner — the ONLY boot output
  const ts = new Date().toLocaleTimeString()
  console.log('')
  console.log('  ╔══════════════════════════════════════════════╗')
  console.log('  ║                                              ║')
  console.log('  ║   ▓▓  LuxSync  ▓▓  Selene Lux IA Engine     ║')
  console.log('  ║   ══════════════════════════════════════      ║')
  console.log('  ║   TITAN CORE .............. ONLINE            ║')
  console.log('  ║   TRINITY WORKERS ......... LIVE              ║')
  console.log('  ║   HAL ABSTRACTION ......... READY             ║')
  console.log('  ║   DMX OUTPUT .............. ARMED             ║')
  console.log('  ║                                              ║')
  console.log(`  ║   ${ts}                              ║`)
  console.log('  ╚══════════════════════════════════════════════╝')
  console.log('')
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

// WAVE 3401: Enable SharedArrayBuffer for Node.js Worker Threads
// Required for OMNI-INPUT MATRIX zero-copy audio pipeline (ALPHA → BETA).
// Node.js Workers in Electron main process do NOT need COOP/COEP headers
// (those are only for browser Service Workers / cross-origin isolation).
// This switch ensures SAB is available in the V8 isolate backing worker_threads.
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 V-01 FIX: SINGLE-INSTANCE LOCK — Obsidian Vault Containment
// Prevents N simultaneous instances of LuxSync on the same machine.
// If the lock is not obtained (another instance is already running), quit immediately.
// The second-instance handler focuses the existing window when a user tries to re-launch.
// ═══════════════════════════════════════════════════════════════════════════
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  console.log('[SINGLE-INSTANCE] Another instance is already running — quitting.')
  app.quit()
} else {
  app.on('second-instance', () => {
    // Focus or restore the existing mainWindow
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2489 + 2491: THE OBSIDIAN VAULT — Two-Gate License Validation
  // Si falla, abre la pantalla de activación en lugar de un diálogo nativo.
  // 🔒 V-05 FIX: Security gate relies strictly on app.isPackaged — NOT on NODE_ENV,
  //    which is an injectable environment variable. Only app.isPackaged is trustworthy.
  // ═══════════════════════════════════════════════════════════════════════════
  if (app.isPackaged) {
    const fs = await import('fs')
    let licenseValidator: { validateLicense: (p: string) => any; getHardwareId: () => string }
    let validatorLoadError = false
    let fallbackHwId = 'UNKNOWN'

    // En producción el .jsc está en app.asar.unpacked — bytenode necesita el path real del filesystem
    const jscPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'license', 'LicenseValidator.jsc')
      : path.join(__dirname, 'license', 'LicenseValidator.jsc')

    // 🔒 V-02 FIX: FAIL-CLOSED — No JS plaintext fallback.
    // The .jsc bytecode contains the embedded RSA public key and main.js hash.
    // The plaintext .js has only placeholders (%%LUXSYNC_PUBLIC_KEY%%) and MUST NOT
    // be loaded. If the .jsc fails to load, we fail immediately with validatorLoadError.
    // An attacker who drops a modified LicenseValidator.js next to the .jsc can no longer
    // hijack the fallback path.
    try {
      licenseValidator = require(jscPath)
      console.log('[LICENSE] Validator loaded OK')
    } catch (jscErr: any) {
      console.error('[LICENSE] JSC load failed — FAIL-CLOSED:', jscErr?.message || jscErr, 'Path:', jscPath)
      validatorLoadError = true
      licenseValidator = null as any
      // Compute fallback HW ID for the activation screen error display
      try { const os = require('os'); const ifaces = os.networkInterfaces(); for (const name of Object.keys(ifaces)) { for (const addr of (ifaces[name] || [])) { if (addr.family === 'IPv4' && !addr.internal && addr.mac !== '00:00:00:00:00:00') { fallbackHwId = addr.mac.toLowerCase(); break; } } if (fallbackHwId !== 'UNKNOWN') break; } } catch {}
    }

    const licensePath = path.join(app.getPath('userData'), 'license', 'license.luxlicense')
    const licenseDir = path.dirname(licensePath)
    let result: any = null

    if (validatorLoadError) {
      result = { valid: false, detectedHwId: fallbackHwId, error: 'VALIDATOR_LOAD_ERROR' }
    } else {
      result = licenseValidator.validateLicense(licensePath)
    }

    if (!result.valid) {
      // ═══════════════════════════════════════════════════════════════════════
      // 🖥️ WAVE 2491: ACTIVATION SCREEN — Beautiful license UI
      // ═══════════════════════════════════════════════════════════════════════
      let errorTitle: string
      let errorDetail: string

      if (validatorLoadError) {
        errorTitle = 'Error crítico de licencia'
        errorDetail = 'No se pudo cargar el sistema de validación. Reinstala la aplicación o contacta con soporte.'
      } else if (result.gate1 === false && result.gate2 === true) {
        errorTitle = 'Hardware no autorizado'
        errorDetail = 'La licencia no corresponde a este equipo. Copia tu Hardware ID y envíalo a soporte para obtener una licencia actualizada.'
      } else if (result.gate2 === false && result.error?.includes('GATE2')) {
        errorTitle = 'Licencia inválida'
        errorDetail = 'El archivo de licencia no tiene una firma válida. Contacta con soporte para obtener una licencia legítima.'
      } else if (result.error?.includes('TAMPER')) {
        errorTitle = 'Integridad comprometida'
        errorDetail = 'Se detectó una modificación no autorizada. Reinstala la aplicación o contacta con soporte.'
      } else {
        errorTitle = 'Licencia no encontrada'
        errorDetail = 'Carga un archivo .luxlicense válido para activar LuxSync.'
      }

      const detectedHwId = result.detectedHwId || fallbackHwId

      // ── IPC handlers para la pantalla de activación ──
      ipcMain.handle('activation:getData', () => ({
        hwid: detectedHwId,
        errorTitle,
        errorDetail,
      }))

      ipcMain.handle('activation:copyHwid', () => {
        clipboard.writeText(detectedHwId)
      })

      ipcMain.handle('activation:loadLicense', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'Seleccionar archivo de licencia',
          filters: [{ name: 'LuxSync License', extensions: ['luxlicense'] }],
          properties: ['openFile'],
        })

        if (canceled || filePaths.length === 0) {
          return { cancelled: true }
        }

        const selectedPath = filePaths[0]

        // Validar el archivo seleccionado
        if (validatorLoadError) {
          return { valid: false, reason: 'El sistema de validación no está disponible.' }
        }

        const checkResult = licenseValidator.validateLicense(selectedPath)

        if (!checkResult.valid) {
          let reason = 'Archivo de licencia inválido.'
          if (checkResult.gate1 === false) reason = 'La licencia no corresponde a este hardware.'
          else if (checkResult.gate2 === false) reason = 'La firma de la licencia no es válida.'
          return { valid: false, reason }
        }

        // Licencia válida — copiar a la ubicación canónica
        try {
          if (!fs.existsSync(licenseDir)) {
            fs.mkdirSync(licenseDir, { recursive: true })
          }
          fs.copyFileSync(selectedPath, licensePath)
        } catch {
          return { valid: false, reason: 'No se pudo copiar la licencia a la carpeta de la aplicación.' }
        }

        return {
          valid: true,
          client: checkResult.client,
          tier: checkResult.tier,
        }
      })

      ipcMain.on('activation:restart', () => {
        app.relaunch()
        app.exit(0)
      })

      ipcMain.on('activation:quit', () => {
        app.quit()
      })

      // ── Crear ventana de activación ──
      const activationWindow = new BrowserWindow({
        width: 600,
        height: 520,
        frame: false,
        resizable: false,
        title: 'LuxSync — Activación',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'license', 'preload-activation.js'),
        },
      })

      activationWindow.loadFile(path.join(__dirname, 'license', 'activation.html'))

      activationWindow.on('closed', () => {
        app.quit()
      })

      return // No continuar con el boot normal
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 WAVE 2490: Capture license tier from validation result
    // ═══════════════════════════════════════════════════════════════════════════
    if (result.tier === 'DJ_FOUNDER' || result.tier === 'FULL_SUITE') {
      currentLicenseTier = result.tier
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔑 OBSIDIAN VAULT: Activation banner — so you know it's real
    // ═══════════════════════════════════════════════════════════════════════════
    const tierLabel = currentLicenseTier === 'FULL_SUITE' ? 'FULL SUITE ★' : 'DJ FOUNDER'
    const tierColor = currentLicenseTier === 'FULL_SUITE' ? '\x1b[36m' : '\x1b[33m'
    console.log('\x1b[32m')
    console.log('  ╔══════════════════════════════════════════════╗')
    console.log('  ║        🔑  OBSIDIAN VAULT — UNLOCKED         ║')
    console.log('  ╠══════════════════════════════════════════════╣')
    console.log(`  ║  Cliente : \x1b[97m${String(result.client ?? 'Unknown').padEnd(36)}\x1b[32m║`)
    console.log(`  ║  Tier    : ${tierColor}${tierLabel.padEnd(36)}\x1b[32m║`)
    console.log(`  ║  HWID    : \x1b[90m${String(result.hwid ?? '—').padEnd(36)}\x1b[32m║`)
    console.log('  ╚══════════════════════════════════════════════╝')
    console.log('\x1b[0m')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 367: Load preferences (ConfigManagerV2 - NO FIXTURES)
  // ═══════════════════════════════════════════════════════════════════════════
  const { config: preferences, legacyFixtures } = configManager.load()
  
  // If legacy fixtures were found (V1 → V2 migration), they need to be saved to ShowFileV2
  if (legacyFixtures.length > 0) {
    console.warn(`[Main] MIGRATION: ${legacyFixtures.length} legacy fixtures detected — will migrate to ShowFileV2`)
    // Legacy fixtures are now extracted - ConfigManagerV2 has already saved without them
    // The renderer will handle migration via stageStore.loadFromDisk() → autoMigrate()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 WAVE 7580: VANGUARD LAUNCHER — pre-boot render fidelity gate
  // ═══════════════════════════════════════════════════════════════════════════
  // Placement invariants (blueprint §1.3):
  //   1. AFTER license validation (the `if (app.isPackaged)` block above returns
  //      early on failure, so an unlicensed user never reaches here).
  //   2. BEFORE `initTitan()` (further down) — initTitan boots DMX drivers,
  //      audio workers, Genesis and the effects engine. Doing that before the
  //      operator has picked a tier wastes 2-4 s on slow hardware.
  //   3. Config is already loaded above (WAVE 367), so `getPerformanceProfile()`
  //      is safe to read here without a second `configManager.load()`.
  // The launcher:* IPC handlers are registered UNCONDITIONALLY — `launcher:getProfile`
  // is consumed by the main app renderer long after this window is gone, so it must
  // survive even when the launcher is skipped (blueprint risk #5).
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const hardware = probeHardware()
    const profile = configManager.getPerformanceProfile()

    // Registered outside the `if` — launcher:getProfile must outlive the window.
    registerLauncherIpc({
      getLauncherWindow: () => launcherWindow,
      onDecided: (outcome) => {
        console.log(`[Vanguard] Launcher ${outcome} — resuming boot`)
      },
    })

    if (shouldShowLauncher(profile)) {
      // Resolves ONLY on the window's 'closed' event — the single funnel for
      // every exit path (commit, cancel, OS close). Awaited so initTitan()
      // cannot race the config write (invariant #4).
      await showLauncherWindow()
    } else {
      // Refresh the hardware snapshot even when skipping, so support can read
      // the operator's real hardware from the config file after a RAM/GPU
      // upgrade. Fire-and-forget is fine here — no renderer is waiting yet.
      void configManager.setPerformanceProfile({ hardware })
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 255: LA BIBLIOTECA - Load fixture definitions from luxsync/librerias
  // WAVE 387: THE LIBRARY PATHFINDER - Setup custom library path in userData
  // WAVE 1114: PATHFINDER V2 - Multi-path search for system library
  // ═══════════════════════════════════════════════════════════════════════════
  
  const fs = await import('fs')
  
  // WAVE 1114: PATHFINDER - Search multiple locations for system library
  // Order: Root librerias → Legacy dev → Electron packaged → Dev fallbacks
  const candidatePaths = [
    path.join(process.cwd(), '../librerias'),                 // Root: LuxSync/librerias (desde electron-app)
    path.join(process.cwd(), 'librerias'),                    // Legacy Prod/Dev
    path.join(process.cwd(), 'resources/librerias'),          // Electron Packaged
    path.join(__dirname, '../../librerias'),                  // Dev fallback (from dist-electron)
    path.join(__dirname, '../../../librerias'),               // Another dev fallback
    path.join(app.getPath('userData'), 'librerias'),          // Prod: userData copy
  ]
  
  // WAVE 2098: Boot silence — PATHFINDER verbose scan removed
  
  let factoryLibraryPath: string = ''
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const files = fs.readdirSync(candidate).filter((f: string) => f.endsWith('.fxt') || f.endsWith('.json'))
      if (files.length > 0) {
        factoryLibraryPath = candidate
        break
      }
    }
  }
  
  if (!factoryLibraryPath) {
    console.error('[Library] ⛔ CRITICAL: No system library found in any candidate path!')
    console.error('[Library] ⛔ Candidates searched:', candidatePaths)
    // Fallback to first candidate for error display purposes
    factoryLibraryPath = candidatePaths[0]
  }
  
  // Custom library path (user's custom fixtures and edited definitions)
  const customLibraryPath = path.join(app.getPath('userData'), 'fixtures')
  
  // WAVE 390.5: Store paths globally for rescanAllLibraries()
  factoryLibPath = factoryLibraryPath
  customLibPath = customLibraryPath
  
  // WAVE 387 STEP 2: Auto-create custom library folder
  // (fs already imported above in PATHFINDER section)
  if (!fs.existsSync(customLibraryPath)) {
    fs.mkdirSync(customLibraryPath, { recursive: true })
    
    // WAVE 387 STEP 2 BONUS: Copy factory fixtures to custom library if empty
    if (fs.existsSync(factoryLibraryPath)) {
      const factoryFiles = fs.readdirSync(factoryLibraryPath)
      let copiedCount = 0
      for (const file of factoryFiles) {
        if (file.endsWith('.fxt') || file.endsWith('.json')) {
          fs.copyFileSync(
            path.join(factoryLibraryPath, file),
            path.join(customLibraryPath, file)
          )
          copiedCount++
        }
      }
    }
  }
  
  // WAVE 387 STEP 3: Configure FXTParser with custom library path
  fxtParser.setLibraryPath(customLibraryPath)
  
  // WAVE 390.5: Use unified rescanAllLibraries() for initial load
  await rescanAllLibraries()
  
  if (fixtureLibrary.length === 0) {
    console.warn('[Library] ⚠️ No fixture definitions found in any library')
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 367: patchedFixtures now loaded via StagePersistence (ShowFileV2)
  // The renderer calls stageStore.loadFromDisk() which triggers IPC lux:stage:load
  // For now, patchedFixtures[] starts empty - renderer will hydrate it
  // ═══════════════════════════════════════════════════════════════════════════
  // NOTE: Legacy startup that loaded from ConfigManager is REMOVED
  // Fixtures now come from ShowFileV2 via stageStore + StagePersistence
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 1008.5: Initialize Titan BEFORE creating window
  // This ensures IPC handlers are registered BEFORE renderer loads and sends IPCs
  // ═══════════════════════════════════════════════════════════════════════════
  await initTitan()

  // ═══════════════════════════════════════════════════════════════════════════
  // 🧬 WAVE 4910.9-B: Cross-Origin Isolation — habilita SharedArrayBuffer vía IPC
  //
  // ipcMain.handle() usa structured clone para serializar la respuesta. Los SABs
  // son bloqueados por el algoritmo de clonación a menos que la ventana tenga
  // crossOriginIsolated=true. Forzamos COOP + COEP en TODAS las respuestas de la
  // sesión default (mainWindow + TheiaWindow comparten session.defaultSession).
  // LuxSync es 100% local — no hay recursos cross-origin que romper.
  // ═══════════════════════════════════════════════════════════════════════════
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp'],
      },
    })
  })

  createWindow()

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎬 WAVE 4864: Theia Output Window Manager (Phase 3)
  // ═══════════════════════════════════════════════════════════════════════════
  setupTheiaWindowManager({
    isDev,
    devUrl: 'http://localhost:5173',
    prodIndexPath: path.join(__dirname, '../dist/index.html'),
    preloadPath: path.join(__dirname, 'preload.js'),
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 367: TitanOrchestrator fixture injection happens from renderer
  // When stageStore loads ShowFileV2, it syncs to main process via IPC
  // ═══════════════════════════════════════════════════════════════════════════

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // ðŸ›¡ï¸ WAVE 7555: UNBLOCK ALPHA â Watchdog de latencia del Event Loop
  // Monitorea el lag real del event loop cada 100ms. Si el lag supera
  // 250ms (indicando I/O bloqueante o GC pesado), emite un warning.
  // Esto permite correlacionar freezes con falsos Phoenix de workers.
  {
    let _watchdogLastTick = Date.now()
    setInterval(() => {
      const now = Date.now()
      const lag = now - _watchdogLastTick - 100
      if (lag > 250) {
        console.warn(`[ALPHA-WATCHDOG] âšï¸ Event loop congelado por ${lag}ms. Posible I/O bloqueante o GC pesado.`)
      }
      _watchdogLastTick = now
    }, 100)
  }
})

// ============================================================================
// ============================================================================
// ⚡ WAVE 2495: THE SILVER BULLET — Shutdown function
// Extraída como función standalone para ser llamada desde mainWindow.on('closed').
// window-all-closed NO es fiable cuando existen ventanas ocultas (phantomWorker,
// background BrowserWindows). doShutdown() ataca directamente desde la puerta
// principal: si mainWindow cae, todo el proceso cae con ella.
// ============================================================================
let isShuttingDown = false

function doShutdown(): void {
  if (isShuttingDown) return  // Re-entry guard — solo un shutdown simultáneo
  isShuttingDown = true

  // 💀 DEAD MAN'S SWITCH: 1 segundo máximo —si el cleanup se atasca, kill total
  const deadManSwitch = setTimeout(() => { app.exit(0) }, 1000)
  deadManSwitch.unref()  // El timer no mantiene vivo el event loop

  const shutdown = async () => {
    // 1. Stop Titan DMX loop: blackout + 30ms FTDI drain (async, must await)
    if (titanOrchestrator) {
      try { await titanOrchestrator.stop() } catch { /* non-fatal */ }
    }
    // 2. Close ArtNet UDP socket — keeps the Node event loop alive if unclosed
    try { await artNetDriver.stop() } catch { /* non-fatal */ }
    // 3. Kill Phantom Worker thread
    destroyPhantomWorker()
    // 4. Clean up IPC channels
    try { await cleanupChronosIPC() } catch { /* non-fatal */ }
    cleanupPlaybackIPC()
    // 5. Flush config to disk
    configManager.forceSave()
    // 6. Shut down Genesis geological loop
    try { shutdownGenesisEngine() } catch { /* non-fatal */ }
  }

  // app.exit(0) = C++ synchronous kill — bypasses Node event loop entirely
  shutdown().finally(() => app.exit(0))
}

// Guard secundario: si por algún motivo window-all-closed llega antes
// (e.g. ventana oculta se cierra primero), que también ejecute el shutdown.
//
// 🚀 WAVE 7581: BOOT GUARD — `isBooting` blocks this listener during the
// launcher → main window handoff. Between `launcherWindow.close()` and
// `createWindow()` the launcher is gone and no other window exists yet, so
// Electron fires `window-all-closed` and would quit the app mid-boot. The
// guard flips to false once the main window's renderer reports
// `did-finish-load` (see createWindow below), after which this listener
// behaves exactly as before.
app.on('window-all-closed', () => {
  if (isBooting) {
    // Launcher just closed; createWindow() is about to run. Do NOT quit.
    return
  }
  doShutdown()
})

// Guard terciario: before-quit como última red de seguridad
app.on('before-quit', (e) => {
  if (!isShuttingDown) {
    e.preventDefault()
    doShutdown()
  }
})

// Basic IPC handlers that need to stay in main
ipcMain.handle('app:getVersion', () => app.getVersion())

// ============================================================================
// 🪟 WINDOW CONTROLS IPC - Custom title bar
// ============================================================================
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false
})

// ═══════════════════════════════════════════════════════════════════════════
// 🪟 WAVE 7568: MANUAL DRAG — Workaround for Electron 31/32 Windows bug
// -webkit-app-region: drag is broken on Electron 31+ on Windows (issue #43371).
// This IPC-based manual drag uses screen.getCursorScreenPoint() to move the
// window, triggered by pointerdown on the title bar in the renderer.
// ═══════════════════════════════════════════════════════════════════════════
let dragOffset: { x: number; y: number } | null = null

ipcMain.on('window:drag:start', (_event, startPos: { x: number; y: number }) => {
  if (!mainWindow) return
  const winPos = mainWindow.getPosition()
  dragOffset = { x: startPos.x - winPos[0], y: startPos.y - winPos[1] }
})

ipcMain.on('window:drag:move', (_event, cursorPos: { x: number; y: number }) => {
  if (!mainWindow || !dragOffset) return
  // Don't drag if window is maximized — would jump across screens
  if (mainWindow.isMaximized()) return
  mainWindow.setPosition(
    Math.round(cursorPos.x - dragOffset.x),
    Math.round(cursorPos.y - dragOffset.y)
  )
})

ipcMain.on('window:drag:end', () => {
  dragOffset = null
})

// Double-click on title bar toggles maximize
ipcMain.handle('window:drag:doubleClick', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

// Notify renderer when maximize state changes
app.on('ready', () => {
  // Listeners are added after mainWindow is created — see createWindow setup below
})

ipcMain.handle('audio:getDesktopSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 0, height: 0 }
    })
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

// ── WAVE 2434: TELEMETRY LATINO 4.1 — IPC handlers ──────────────────────────
// Uso desde DevTools renderer: await window.luxDebug.telemetry.export()
ipcMain.handle('telemetry:lt41:export', (_event, outputPath?: string) => {
  try {
    // Si no se pasa outputPath, calcula la ruta absoluta desde app.getAppPath()
    // app.getAppPath() en dev = .../electron-app  → sube un nivel al repo raíz
    const resolvedPath = outputPath ?? path.join(app.getAppPath(), '..', 'docs', 'logs', 'latinocalib41.md')
    const count = latinoEngine41Telemetry.exportToFile(resolvedPath)
    return { success: true, framesExported: count, path: resolvedPath }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TELEMETRY] exportToFile failed:', msg)
    return { success: false, error: msg }
  }
})

ipcMain.handle('telemetry:lt41:stop', () => {
  latinoEngine41Telemetry.setTelemetryEnabled(false)
  return { success: true }
})

ipcMain.handle('telemetry:lt41:start', () => {
  latinoEngine41Telemetry.setTelemetryEnabled(true)
  return { success: true }
})

ipcMain.handle('telemetry:lt41:flush', () => {
  latinoEngine41Telemetry.flushBuffer()
  return { success: true }
})

// ── CPU PROFILER — WAVE X-RAY TOTAL ──────────────────────────────────────────
// Captura un perfil V8 de 15 segundos y lo guarda en userData/lux-asesino.cpuprofile
// Triggerable desde la UI para cazar spikes de 20-27ms con precisión matemática.
//
// Usa la API clásica `inspector` con callbacks (Node 18 / Electron 28 compatible).
// node:inspector/promises requiere Node ≥19 — no disponible en Electron 28.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('lux:start-profiler', async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const inspector = require('inspector') as typeof import('inspector')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodePath = require('path') as typeof import('path')

  // Promisify the callback-based inspector API (Node 18 / Electron 28 compatible)
  function postAsync<T = unknown>(session: import('inspector').Session, method: string): Promise<T> {
    return new Promise((resolve, reject) => {
      session.post(method, (err: Error | null, result: any) => {
        if (err) reject(err)
        else resolve(result as T)
      })
    })
  }

  const session = new inspector.Session()
  try {
    session.connect()
    await postAsync(session, 'Profiler.enable')
    await postAsync(session, 'Profiler.start')
    console.log('[PROFILER] 🔴 CPU profiling started — capturing 15 seconds...')

    await new Promise<void>(resolve => setTimeout(resolve, 15_000))

    const { profile } = await postAsync<{ profile: object }>(session, 'Profiler.stop')
    session.disconnect()

    const outputPath = nodePath.join(app.getPath('userData'), 'lux-asesino.cpuprofile')
    fs.writeFileSync(outputPath, JSON.stringify(profile))
    console.log(`[PROFILER] ✅ Profile saved → ${outputPath}`)

    return { success: true, path: outputPath }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PROFILER] ❌ Failed:', msg)
    try { session.disconnect() } catch { /* ignore */ }
    return { success: false, error: msg }
  }
})
// ─────────────────────────────────────────────────────────────────────────────

// WAVE 2098: Boot silence — module load log removed
