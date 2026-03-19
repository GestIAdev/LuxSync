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

import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import path from 'path'

// TITAN 2.0 Core Modules
import { TitanOrchestrator, setupIPCHandlers, type IPCDependencies, registerTitanOrchestrator } from '../src/core/orchestrator'

// Arbiter IPC Handlers (WAVE 377 - TitanSyncBridge support)
import { registerArbiterHandlers, masterArbiter } from '../src/core/arbiter'

// Stage Persistence (WAVE 365)
import { stagePersistence, setupStageIPCHandlers } from '../src/core/stage'

// ⚒️ Hephaestus File I/O (WAVE 2030.5)
import { setupHephIPCHandlers } from '../src/core/hephaestus'

// Config Manager V2 (WAVE 367) - PREFERENCES ONLY, NO FIXTURES
import { configManager } from '../src/core/config/ConfigManagerV2'

// External Services
import { FixturePhysicsDriver } from '../src/engine/movement/FixturePhysicsDriver'
import { universalDMX, type DMXDevice } from '../src/hal/drivers/UniversalDMXDriver'
import { artNetDriver } from '../src/hal/drivers/ArtNetDriver'
// 🎨 WAVE 686.10: Import ArtNetDriverAdapter to bridge ArtNet to HAL
import { createArtNetAdapter } from '../src/hal/drivers/ArtNetDriverAdapter'
// 🔥 WAVE 2100: CompositeDMXDriver — dual output USB + ArtNet
import { CompositeDMXDriver } from '../src/hal/drivers/CompositeDMXDriver'
import { USBDMXDriverAdapter } from '../src/hal/drivers/USBDMXDriverAdapter'
import { EffectsEngine } from '../src/engine/color/EffectsEngine'
// ShowManager PURGED - WAVE 365: Replaced by StagePersistence
import { FXTParser, fxtParser } from '../src/core/library/FXTParser'

// 👻 WAVE 2005.3: Phantom Worker for audio analysis
import { getPhantomWorker, destroyPhantomWorker } from './workers/PhantomWorkerManager'
import { setupChronosIPCHandlers, cleanupChronosIPC } from './ipc/ChronosIPCHandlers'
// 🎬 WAVE 2053.1: TimelineEngine playback IPC
import { setupPlaybackIPCHandlers, cleanupPlaybackIPC } from './ipc/PlaybackIPCHandlers'

// =============================================================================
// GLOBAL STATE
// =============================================================================

let mainWindow: BrowserWindow | null = null
let effectsEngine: EffectsEngine | null = null
let titanOrchestrator: TitanOrchestrator | null = null

const fixturePhysicsDriver = new FixturePhysicsDriver()
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

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
  const factoryDefinitions = fxtParser.scanFolder(factoryLibPath)
  const customDefinitions = fxtParser.scanFolder(customLibPath)
  
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,           // Custom title bar
    title: 'LuxSync',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  })

  // Desktop capturer permissions
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation']
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
    
    // Broadcast fixtures if loaded
    if (patchedFixtures.length > 0 && mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
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
  // ⚒️ WAVE 2030.5: Initialize Hephaestus File I/O
  // ═══════════════════════════════════════════════════════════════════════════
  setupHephIPCHandlers()

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
  
  // WAVE 380: Register as singleton so IPC handlers can access the same instance
  registerTitanOrchestrator(titanOrchestrator)
  
  await titanOrchestrator.init()
  
  // WAVE 255.5: Connect broadcast callback to send fixture states to frontend
  // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
  titanOrchestrator.setBroadcastCallback((truth) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('selene:truth', truth)
      }
    } catch (err) {
      // Silently ignore - the renderer is being destroyed (e.g., during heavy audio loading)
      // This is not a critical error, just a timing issue
    }
  })

  // WAVE 257: Connect log callback for Tactical Log
  // 🛡️ WAVE 2005.1: Added try-catch for "Render frame disposed" errors
  titanOrchestrator.setLogCallback((entry) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
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
    setFixtureLibrary: (library: FixtureLibraryItem[]) => { fixtureLibrary = library },
    // WAVE 390.5: Rescan ALL libraries (factory + custom)
    rescanAllLibraries,
    // WAVE 1115: Library paths (resolved by PATHFINDER)
    getFactoryLibPath: () => factoryLibPath,
    getCustomLibPath: () => customLibPath,
  }
  
  setupIPCHandlers(ipcDeps)
  
  // 🎭 WAVE 374 + 377: Arbiter IPC Handlers (unified)
  // Note: Using registerArbiterHandlers from arbiter module (more complete)
  // setupArbiterHandlers from orchestrator is deprecated (duplicate handlers)
  registerArbiterHandlers(masterArbiter)

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

app.whenReady().then(async () => {
  // WAVE 2098: Boot silence — startup banners removed
  
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
  
  createWindow()
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 367: TitanOrchestrator fixture injection happens from renderer
  // When stageStore loads ShowFileV2, it syncs to main process via IPC
  // ═══════════════════════════════════════════════════════════════════════════

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Save config before quit
app.on('before-quit', async () => {
  configManager.forceSave()
  if (titanOrchestrator) {
    titanOrchestrator.stop()
  }
  // 👻 WAVE 2005.3: Cleanup Phantom Worker
  destroyPhantomWorker()
  await cleanupChronosIPC()
  cleanupPlaybackIPC()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
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

// WAVE 2098: Boot silence — module load log removed
