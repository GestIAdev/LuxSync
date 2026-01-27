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

// Config Manager V2 (WAVE 367) - PREFERENCES ONLY, NO FIXTURES
import { configManager } from '../src/core/config/ConfigManagerV2'

// External Services
import { FixturePhysicsDriver } from '../src/engine/movement/FixturePhysicsDriver'
import { universalDMX, type DMXDevice } from '../src/hal/drivers/UniversalDMXDriver'
import { artNetDriver } from '../src/hal/drivers/ArtNetDriver'
// 🎨 WAVE 686.10: Import ArtNetDriverAdapter to bridge ArtNet to HAL
import { createArtNetAdapter } from '../src/hal/drivers/ArtNetDriverAdapter'
import { EffectsEngine } from '../src/engine/color/EffectsEngine'
// ShowManager PURGED - WAVE 365: Replaced by StagePersistence
import { FXTParser, fxtParser } from '../src/core/library/FXTParser'

// =============================================================================
// GLOBAL STATE
// =============================================================================

let mainWindow: BrowserWindow | null = null
let effectsEngine: EffectsEngine | null = null
let titanOrchestrator: TitanOrchestrator | null = null

const fixturePhysicsDriver = new FixturePhysicsDriver()
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// =============================================================================
// FIXTURE TYPES & ZONING (WAVE 9.6)
// =============================================================================

type FixtureZone = 'FRONT_PARS' | 'BACK_PARS' | 'MOVING_LEFT' | 'MOVING_RIGHT' | 'STROBES' | 'LASERS' | 'UNASSIGNED'

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
  console.log('[Library] 🔄 WAVE 390.5: Rescanning ALL libraries...')
  
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
  console.log(`[Library] ✅ Rescanned: ${factoryDefinitions.length} factory + ${customDefinitions.length} custom = ${fixtureLibrary.length} merged fixtures`)
  
  return fixtureLibrary
}

function resetZoneCounters(): void {
  zoneCounters = { par: 0, moving: 0, strobe: 0, laser: 0 }
  console.log('[Zoning] Zone counters reset')
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
  console.log('[Zoning] Counters recalculated:', zoneCounters)
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
    const zone = currentCount % 2 === 0 ? 'MOVING_LEFT' : 'MOVING_RIGHT'
    console.log('[Zoning] Moving Head #' + currentCount + ' "' + fixtureName + '" -> ' + zone)
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
  
  // PAR/LED/Wash - alternating front/back
  const currentParCount = zoneCounters.par
  zoneCounters.par++
  const zone = currentParCount % 2 === 0 ? 'BACK_PARS' : 'FRONT_PARS'
  console.log('[Zoning] PAR/LED #' + currentParCount + ' "' + fixtureName + '" -> ' + zone)
  return zone
}

// =============================================================================
// WINDOW CREATION
// =============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
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
      console.log('[Main] Broadcasted ' + patchedFixtures.length + ' fixtures to renderer')
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

// =============================================================================
// TITAN 2.0 INITIALIZATION
// =============================================================================

async function initTitan(): Promise<void> {
  console.log('[Main] ===============================================')
  console.log('[Main]   BOOTING TITAN 2.0 - WAVE 254: THE SPARK')
  console.log('[Main]   WAVE 365: SYSTEM INTEGRATION')
  console.log('[Main]   LuxSync V2 - NO HAY VUELTA ATRAS')
  console.log('[Main] ===============================================')

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 365: Initialize Stage Persistence (BEFORE other systems)
  // ═══════════════════════════════════════════════════════════════════════════
  await stagePersistence.init()
  setupStageIPCHandlers(() => mainWindow)
  console.log('[Main] 💾 Stage Persistence V2 initialized')

  // Initialize EffectsEngine
  effectsEngine = new EffectsEngine()
  
  // 🎨 WAVE 686.10: Create ArtNet adapter for HAL integration
  const artNetAdapter = createArtNetAdapter(artNetDriver)
  console.log('[Main] 🎨 ArtNetDriverAdapter created (WAVE 686.10)')
  
  // Initialize TitanOrchestrator (WAVE 254: Now the ONLY orchestrator)
  // Pass ArtNet adapter so HAL can output to real hardware
  titanOrchestrator = new TitanOrchestrator({ 
    debug: isDev,
    dmxDriver: artNetAdapter
  })
  
  // WAVE 380: Register as singleton so IPC handlers can access the same instance
  registerTitanOrchestrator(titanOrchestrator)
  
  await titanOrchestrator.init()
  
  // WAVE 255.5: Connect broadcast callback to send fixture states to frontend
  titanOrchestrator.setBroadcastCallback((truth) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('selene:truth', truth)
    }
  })

  // WAVE 257: Connect log callback for Tactical Log
  titanOrchestrator.setLogCallback((entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('lux:log', entry)
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
  }
  
  setupIPCHandlers(ipcDeps)
  console.log('[Main] IPC Handlers registered via IPCHandlers module')
  
  // 🎭 WAVE 374 + 377: Arbiter IPC Handlers (unified)
  // Note: Using registerArbiterHandlers from arbiter module (more complete)
  // setupArbiterHandlers from orchestrator is deprecated (duplicate handlers)
  registerArbiterHandlers(masterArbiter)
  console.log('[Main] � Arbiter handlers registered (WAVE 374 + 377)')

  // ArtNet event forwarding
  artNetDriver.on('ready', () => {
    console.log('[ArtNet] Ready')
    mainWindow?.webContents.send('artnet:ready', artNetDriver.getStatus())
  })
  artNetDriver.on('error', (error: Error) => {
    console.error('[ArtNet] Error:', error.message)
    mainWindow?.webContents.send('artnet:error', error.message)
  })
  artNetDriver.on('disconnected', () => {
    console.log('[ArtNet] Disconnected')
    mainWindow?.webContents.send('artnet:disconnected')
  })

  console.log('[Main] ===============================================')
  console.log('[Main]   TITAN 2.0 ONLINE')
  console.log('[Main]   All modules initialized')
  console.log('[Main] ===============================================')
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
  console.log('[Main] LuxSync V2 starting...')
  console.log('[Main] ═══════════════════════════════════════════════════════')
  console.log('[Main]   WAVE 367: SPRING CLEANING ARCHITECTURE')
  console.log('[Main]   ConfigManagerV2 → Preferences Only')
  console.log('[Main]   StagePersistence → ShowFileV2 (fixtures, scenes)')
  console.log('[Main] ═══════════════════════════════════════════════════════')
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 367: Load preferences (ConfigManagerV2 - NO FIXTURES)
  // ═══════════════════════════════════════════════════════════════════════════
  const { config: preferences, legacyFixtures } = configManager.load()
  console.log(`[Main] 📦 Preferences loaded: v${preferences.version}`)
  
  // If legacy fixtures were found (V1 → V2 migration), they need to be saved to ShowFileV2
  if (legacyFixtures.length > 0) {
    console.log(`[Main] 🔄 MIGRATION: ${legacyFixtures.length} legacy fixtures detected`)
    console.log('[Main] 🔄 These will be migrated to ShowFileV2 when stageStore loads')
    // Legacy fixtures are now extracted - ConfigManagerV2 has already saved without them
    // The renderer will handle migration via stageStore.loadFromDisk() → autoMigrate()
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 255: LA BIBLIOTECA - Load fixture definitions from luxsync/librerias
  // WAVE 387: THE LIBRARY PATHFINDER - Setup custom library path in userData
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Factory library path (read-only, bundled with app)
  const factoryLibraryPath = isDev 
    ? path.join(__dirname, '../../librerias')  // Dev: luxsync/librerias
    : path.join(app.getPath('userData'), 'librerias')  // Prod: userData/librerias (copied on first run)
  
  // Custom library path (user's custom fixtures and edited definitions)
  const customLibraryPath = path.join(app.getPath('userData'), 'fixtures')
  
  // WAVE 390.5: Store paths globally for rescanAllLibraries()
  factoryLibPath = factoryLibraryPath
  customLibPath = customLibraryPath
  
  // WAVE 387 STEP 2: Auto-create custom library folder
  const fs = await import('fs')
  if (!fs.existsSync(customLibraryPath)) {
    fs.mkdirSync(customLibraryPath, { recursive: true })
    console.log('[Library] � Created custom library folder:', customLibraryPath)
    
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
      console.log(`[Library] 📋 Copied ${copiedCount} factory fixtures to custom library`)
    }
  } else {
    console.log('[Library] 📁 Custom library folder exists:', customLibraryPath)
  }
  
  // WAVE 387 STEP 3: Configure FXTParser with custom library path
  fxtParser.setLibraryPath(customLibraryPath)
  
  // WAVE 390.5: Use unified rescanAllLibraries() for initial load
  // This ensures consistent merge logic and debug logging
  console.log('[Library] 📚 Initial library scan using rescanAllLibraries()...')
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
  console.log('[Main] 📭 patchedFixtures starts empty (will be loaded from ShowFileV2)')
  
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
app.on('before-quit', () => {
  configManager.forceSave()
  if (titanOrchestrator) {
    titanOrchestrator.stop()
  }
  console.log('[Main] Config saved, TITAN stopped')
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Basic IPC handlers that need to stay in main
ipcMain.handle('app:getVersion', () => app.getVersion())

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

console.log('LuxSync V2 Main Process Loaded - WAVE 243.5')
