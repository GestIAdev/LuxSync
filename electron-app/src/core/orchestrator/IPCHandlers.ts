/**
 * WAVE 243.5: IPC HANDLERS - SIMPLIFIED V2
 * 
 * Centraliza todos los handlers IPC.
 * Recibe dependencias directamente desde main.ts V2.
 * 
 * @module IPCHandlers
 */

import { ipcMain, BrowserWindow } from 'electron'
import type { TitanOrchestrator } from './TitanOrchestrator'

// Type for zone (matches main.ts)
export type FixtureZone = 'FRONT_PARS' | 'BACK_PARS' | 'MOVING_LEFT' | 'MOVING_RIGHT' | 'STROBES' | 'LASERS' | 'UNASSIGNED'

/**
 * WAVE 254: Dependencias inyectadas desde main.ts
 * SeleneLux eliminado - TitanOrchestrator es ahora el único orquestador
 */
export interface IPCDependencies {
  // Core instances (can be null during init)
  mainWindow: BrowserWindow | null
  titanOrchestrator: TitanOrchestrator | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectsEngine: any
  
  // External services
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configManager: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  universalDMX: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artNetDriver: any
  // showManager PURGED - WAVE 365: Replaced by StagePersistence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fixturePhysicsDriver: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fxtParser: any
  
  // State arrays (passed by reference from main)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patchedFixtures: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manualOverrides: Map<number, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fixtureLibrary: any[]
  
  // Zone functions
  autoAssignZone: (type: string | undefined, name?: string) => FixtureZone
  resetZoneCounters: () => void
  recalculateZoneCounters: () => void
  
  // Dynamic getters/setters for mutable state
  getMainWindow: () => BrowserWindow | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPatchedFixtures: () => any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setPatchedFixtures: (fixtures: any[]) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFixtureLibrary: () => any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFixtureLibrary: (library: any[]) => void
  
  // WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rescanAllLibraries: () => Promise<any[]>
  
  // WAVE 1115: Library paths (resolved in main.ts)
  getFactoryLibPath: () => string
  getCustomLibPath: () => string
}

/**
 * Registra todos los handlers IPC
 */
export function setupIPCHandlers(deps: IPCDependencies): void {
  console.log('[IPC] Setting up IPC handlers (WAVE 243.5 V2)')
  
  setupSeleneLuxHandlers(deps)
  setupEffectHandlers(deps)
  setupOverrideHandlers(deps)
  setupConfigHandlers(deps)
  setupFixtureHandlers(deps)
  // setupShowHandlers PURGED - WAVE 365: Use StageIPCHandlers instead
  setupDMXHandlers(deps)
  setupArtNetHandlers(deps)
  
  console.log('[IPC] All IPC handlers registered')
}

// =============================================================================
// TITAN ORCHESTRATOR HANDLERS (WAVE 254: THE SPARK)
// =============================================================================

function setupSeleneLuxHandlers(deps: IPCDependencies): void {
  const { titanOrchestrator, configManager, getMainWindow } = deps
  
  ipcMain.handle('lux:start', () => {
    console.log('[IPC] lux:start - TitanOrchestrator active')
    if (titanOrchestrator && !titanOrchestrator.getState().isRunning) {
      titanOrchestrator.start()
    }
    const savedConfig = configManager.getConfig()
    const savedGain = savedConfig?.audio?.inputGain ?? 1.0
    return { success: true, inputGain: savedGain }
  })
  
  ipcMain.handle('lux:stop', () => {
    console.log('[IPC] lux:stop - TitanOrchestrator stopping')
    if (titanOrchestrator) {
      titanOrchestrator.stop()
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:getState', () => {
    if (titanOrchestrator) {
      return titanOrchestrator.getState()
    }
    return null
  })
  
  ipcMain.handle('lux:setMode', (_event, mode: string) => {
    console.log('[IPC] lux:setMode:', mode)
    if (titanOrchestrator) {
      titanOrchestrator.setMode(mode)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setUseBrain', (_event, enabled: boolean) => {
    console.log('[IPC] lux:setUseBrain:', enabled)
    if (titanOrchestrator) {
      titanOrchestrator.setUseBrain(enabled)
    }
    return { success: true }
  })
  
  // 🧬 WAVE 560: Separated consciousness toggle (Layer 1 only - NO BLACKOUT!)
  ipcMain.handle('lux:setConsciousness', (_event, enabled: boolean) => {
    console.log('[IPC] lux:setConsciousness:', enabled)
    if (titanOrchestrator) {
      titanOrchestrator.setConsciousnessEnabled(enabled)
    }
    return { success: true }
  })
  
  // 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
  ipcMain.handle('lux:forceStrike', (_event, config: { effect: string; intensity: number }) => {
    console.log('[IPC] 🧨 lux:forceStrike:', config)
    if (titanOrchestrator) {
      titanOrchestrator.forceStrikeNextFrame(config)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setInputGain', (_event, gain: number) => {
    console.log('[IPC] lux:setInputGain:', gain)
    if (titanOrchestrator) {
      titanOrchestrator.setInputGain(gain)
    }
    configManager.updateConfig({ audio: { inputGain: gain } })
    return { success: true }
  })
  
  ipcMain.handle('lux:setVibe', (_event, vibeId: string) => {
    console.log('[IPC] lux:setVibe:', vibeId)
    if (titanOrchestrator) {
      titanOrchestrator.setVibe(vibeId as any)
    }
    return { success: true }
  })
  
  // 🎭 WAVE 700.5.4: MOOD CONTROL
  ipcMain.handle('lux:setMood', (_event, moodId: 'calm' | 'balanced' | 'punk') => {
    console.log('[IPC] 🎭 lux:setMood:', moodId)
    if (titanOrchestrator) {
      titanOrchestrator.setMood(moodId)
      
      // Notify all frontends
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('lux:mood-changed', {
          moodId,
          timestamp: Date.now()
        })
      }
    }
    return { success: true, moodId }
  })
  
  ipcMain.handle('lux:getMood', () => {
    if (titanOrchestrator) {
      const currentMood = titanOrchestrator.getMood()
      return { success: true, moodId: currentMood }
    }
    return { success: false, moodId: 'balanced', error: 'Orchestrator not initialized' }
  })
  
  ipcMain.handle('lux:setLivingPalette', (_event, palette: string) => {
    console.log('[IPC] lux:setLivingPalette:', palette)
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementPattern', (_event, pattern: string) => {
    console.log('[IPC] lux:setMovementPattern:', pattern)
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementSpeed', (_event, speed: number) => {
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementIntensity', (_event, intensity: number) => {
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:setGlobalColorParams', (_event, params: { saturation?: number; intensity?: number }) => {
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:forceMutation', () => {
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:resetMemory', () => {
    // TODO: Implement in TitanOrchestrator
    return { success: true }
  })
  
  // WAVE 254: Audio handler
  ipcMain.handle('lux:audioFrame', (_event, data: Record<string, unknown>) => {
    if (titanOrchestrator) {
      titanOrchestrator.processAudioFrame(data)
    }
    return true
  })
  
  // =========================================================================
  // WAVE 250: NERVE SPLICING - Canales kebab-case estándar
  // WAVE 252: SILENCE - Logs eliminados para reducir spam
  // WAVE 254: Migrado a TitanOrchestrator
  // =========================================================================
  
  // Audio frame (kebab-case - lo que envía preload.ts)
  ipcMain.handle('lux:audio-frame', (_event, data: Record<string, unknown>) => {
    if (titanOrchestrator) {
      titanOrchestrator.processAudioFrame(data)
    }
    return { success: true }
  })
  
  // 🩸 WAVE 259: RAW VEIN - Audio buffer crudo para Trinity FFT
  // 🔥 WAVE 264.8: Cambiado de handle() a on() para FIRE-AND-FORGET
  // handle() requiere devolver una Promise y crea backpressure a 60fps
  // on() es unidireccional - procesa sin esperar respuesta
  let audioBufferCallCount = 0;
  let lastLogTime = Date.now();
  ipcMain.on('lux:audio-buffer', (_event, buffer: ArrayBuffer) => {
    audioBufferCallCount++;
    
    // 🔍 WAVE 264.7: Log AGRESIVO cada 2 segundos (basado en tiempo, no frames)
    const now = Date.now();
    if (now - lastLogTime >= 2000) {
      const titanState = titanOrchestrator?.getState();
      console.log(`[IPC 📡] audioBuffer #${audioBufferCallCount} | ` +
        `titan.running=${titanState?.isRunning ?? 'null'} | ` +
        `size=${buffer?.byteLength || 0}`);
      lastLogTime = now;
    }
    
    if (titanOrchestrator && buffer) {
      const float32 = new Float32Array(buffer)
      titanOrchestrator.processAudioBuffer(float32)
    } else if (!titanOrchestrator) {
      console.warn('[IPC ⚠️] audioBuffer: titanOrchestrator is null!');
    } else if (!buffer) {
      console.warn('[IPC ⚠️] audioBuffer: buffer is null!');
    }
    // 🔥 WAVE 264.8: NO return - fire-and-forget
  })
  
  // Get current vibe
  ipcMain.handle('lux:get-vibe', async () => {
    if (titanOrchestrator) {
      const state = titanOrchestrator.getState()
      return { success: true, vibeId: state.currentVibe ?? 'idle' }
    }
    return { success: true, vibeId: 'idle' }
  })
  
  // Get full state (SeleneTruth) - WAVE 254: Migrated to TitanOrchestrator state
  ipcMain.handle('lux:get-full-state', async () => {
    if (titanOrchestrator) {
      const state = titanOrchestrator.getState()
      return {
        dmx: { isConnected: false, status: 'pending', driver: null, port: null },
        selene: { 
          isRunning: state.isRunning, 
          mode: 'auto', 
          brainMode: 'reactive', 
          paletteSource: 'vibe', 
          consciousness: null 
        },
        fixtures: [],
        audio: { hasWorkers: true },
        titan: state
      }
    }
    // Fallback minimal state
    return {
      dmx: { isConnected: false, status: 'disconnected', driver: null, port: null },
      selene: { isRunning: false, mode: null, brainMode: null, paletteSource: null, consciousness: null },
      fixtures: [],
      audio: { hasWorkers: false }
    }
  })
  
  // WAVE 252: Alias for get-full-state - WAVE 254: Use TitanOrchestrator
  ipcMain.handle('lux:get-state', async () => {
    if (titanOrchestrator) {
      return titanOrchestrator.getState()
    }
    return null
  })
  
  // WAVE 252: Save config
  ipcMain.handle('lux:save-config', async (_event, config: Record<string, unknown>) => {
    if (configManager?.saveConfig) {
      await configManager.saveConfig(config)
      return { success: true }
    }
    return { success: false, error: 'ConfigManager not available' }
  })
}

// =============================================================================
// EFFECT HANDLERS
// =============================================================================

function setupEffectHandlers(deps: IPCDependencies): void {
  const { effectsEngine } = deps
  
  ipcMain.handle('lux:triggerEffect', (_event, name: string, params?: Record<string, unknown>) => {
    if (effectsEngine?.triggerEffect) {
      const id = effectsEngine.triggerEffect(name, params)
      return { success: true, id }
    }
    return { success: false }
  })
  
  ipcMain.handle('lux:cancelEffect', (_event, id: number | string) => {
    if (effectsEngine?.cancelEffect) {
      effectsEngine.cancelEffect(id)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:cancelAllEffects', () => {
    if (effectsEngine?.cancelAllEffects) {
      effectsEngine.cancelAllEffects()
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:blackout', (_event, enabled: boolean) => {
    console.log('[IPC] lux:blackout:', enabled)
    // TODO: Implement blackout via TitanOrchestrator
    return { success: true }
  })
  
  ipcMain.handle('lux:strobe', (_event, enabled: boolean, speed?: number) => {
    console.log('[IPC] lux:strobe:', enabled, speed)
    // TODO: Implement strobe via TitanOrchestrator
    return { success: true }
  })
}

// =============================================================================
// OVERRIDE HANDLERS
// =============================================================================

function setupOverrideHandlers(deps: IPCDependencies): void {
  const { manualOverrides, getMainWindow } = deps
  
  ipcMain.handle('lux:setManualOverride', (_event, fixtureId: number, overrides: Record<string, number>) => {
    manualOverrides.set(fixtureId, overrides)
    return { success: true }
  })
  
  ipcMain.handle('lux:clearManualOverride', (_event, fixtureId: number) => {
    manualOverrides.delete(fixtureId)
    return { success: true }
  })
  
  ipcMain.handle('lux:clearAllManualOverrides', () => {
    manualOverrides.clear()
    return { success: true }
  })
  
  ipcMain.handle('lux:getManualOverrides', () => {
    return Object.fromEntries(manualOverrides)
  })
}

// =============================================================================
// CONFIG HANDLERS
// =============================================================================

function setupConfigHandlers(deps: IPCDependencies): void {
  const { configManager } = deps
  
  ipcMain.handle('config:get', () => {
    return configManager.getConfig()
  })
  
  ipcMain.handle('config:set', (_event, config: Record<string, unknown>) => {
    configManager.updateConfig(config)
    return { success: true }
  })
  
  ipcMain.handle('config:save', () => {
    configManager.forceSave()
    return { success: true }
  })
}

// =============================================================================
// FIXTURE HANDLERS
// =============================================================================

function setupFixtureHandlers(deps: IPCDependencies): void {
  const { 
    fxtParser, 
    getPatchedFixtures, 
    setPatchedFixtures, 
    getFixtureLibrary, 
    setFixtureLibrary,
    autoAssignZone,
    resetZoneCounters,
    recalculateZoneCounters,
    configManager,
    getMainWindow,
    rescanAllLibraries,  // WAVE 390.5: Full library rescan
    getFactoryLibPath,   // WAVE 1115: Resolved paths
    getCustomLibPath     // WAVE 1115: Resolved paths
  } = deps
  
  ipcMain.handle('fixtures:scanLibrary', async (_event, folderPath: string) => {
    try {
      const fixtures = await fxtParser.scanFolder(folderPath)
      setFixtureLibrary(fixtures)
      return { success: true, fixtures }
    } catch (err) {
      console.error('[IPC] fixtures:scanLibrary error:', err)
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('fixtures:getLibrary', () => {
    return getFixtureLibrary()
  })
  
  ipcMain.handle('fixtures:getPatch', () => {
    return getPatchedFixtures()
  })
  
  ipcMain.handle('fixtures:addToPatch', (_event, fixture: Record<string, unknown>, dmxAddress: number, universe: number) => {
    const patchedFixtures = getPatchedFixtures()
    const zone = autoAssignZone(fixture.type as string, fixture.name as string)
    
    const patched = {
      ...fixture,
      dmxAddress,
      universe,
      zone
    }
    
    patchedFixtures.push(patched)
    configManager.updateConfig({ patchedFixtures })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
    }
    
    return { success: true, fixture: patched }
  })
  
  ipcMain.handle('fixtures:removeFromPatch', (_event, fixtureId: string) => {
    const patchedFixtures = getPatchedFixtures()
    const index = patchedFixtures.findIndex((f: { id: string }) => f.id === fixtureId)
    
    if (index !== -1) {
      patchedFixtures.splice(index, 1)
      recalculateZoneCounters()
      configManager.updateConfig({ patchedFixtures })
      
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
      }
      
      return { success: true }
    }
    
    return { success: false, error: 'Fixture not found' }
  })
  
  ipcMain.handle('fixtures:clearPatch', () => {
    setPatchedFixtures([])
    resetZoneCounters()
    configManager.updateConfig({ patchedFixtures: [] })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', [])
    }
    
    return { success: true }
  })
  
  ipcMain.handle('fixtures:updateAddress', (_event, fixtureId: string, dmxAddress: number, universe: number) => {
    const patchedFixtures = getPatchedFixtures()
    const fixture = patchedFixtures.find((f: { id: string }) => f.id === fixtureId)
    
    if (fixture) {
      fixture.dmxAddress = dmxAddress
      fixture.universe = universe
      configManager.updateConfig({ patchedFixtures })
      return { success: true }
    }
    
    return { success: false, error: 'Fixture not found' }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // WAVE 256: LUX ALIASES - Handlers con prefijo lux: para compatibilidad
  // El preload.ts usa lux:* pero los handlers originales son fixtures:*
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 🔍 WAVE 255.5: Scan fixtures - alias para fixtures:scanLibrary
  // Si no se pasa path, retorna la librería ya cargada (desde main.ts WAVE 255)
  ipcMain.handle('lux:scan-fixtures', async (_event, customPath?: string) => {
    try {
      // If no custom path, just return the already-loaded library
      if (!customPath) {
        const cached = getFixtureLibrary()
        console.log(`[IPC] lux:scan-fixtures returning cached library: ${cached.length} fixtures`)
        return { success: true, fixtures: cached }
      }
      
      // Scan custom path
      console.log('[IPC] lux:scan-fixtures scanning:', customPath)
      const definitions = await fxtParser.scanFolder(customPath)
      setFixtureLibrary(definitions)
      
      console.log(`[IPC] lux:scan-fixtures found ${definitions.length} fixtures`)
      return { success: true, fixtures: definitions }
    } catch (err) {
      console.error('[IPC] lux:scan-fixtures error:', err)
      return { success: true, fixtures: getFixtureLibrary() } // Return cached library on error
    }
  })
  
  ipcMain.handle('lux:get-patched-fixtures', () => {
    return { success: true, fixtures: getPatchedFixtures() }
  })
  
  ipcMain.handle('lux:get-fixture-library', () => {
    return { success: true, fixtures: getFixtureLibrary() }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 384: GET FIXTURE DEFINITION - Returns FULL fixture data with channels
  // This is the missing link that caused "fixtures nacen genéricos"
  // ═══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('lux:getFixtureDefinition', (_event, profileId: string) => {
    try {
      const library = getFixtureLibrary()
      const definition = library.find((f: { id: string }) => f.id === profileId)
      
      if (!definition) {
        console.warn(`[IPC] lux:getFixtureDefinition: Profile "${profileId}" not found in library`)
        return { success: false, error: `Profile "${profileId}" not found` }
      }
      
      // Return the COMPLETE fixture definition from library
      // This includes channels[], capabilities, hasMovementChannels, etc.
      console.log(`[IPC] 🔥 lux:getFixtureDefinition: Returning "${definition.name}" (${definition.channelCount}ch, type: ${definition.type}, motor: ${definition.physics?.motorType || 'none'})`)
      
      return { 
        success: true, 
        definition: {
          id: definition.id,
          name: definition.name,
          manufacturer: definition.manufacturer,
          type: definition.type,
          channelCount: definition.channelCount,
          channels: definition.channels || [],
          filePath: definition.filePath,
          // 🔥 WAVE 1042.1: INCLUDE PHYSICS!
          physics: definition.physics || null,
          // 🔥 WAVE 1042.1: FULL CAPABILITIES including colorEngine and colorWheel
          capabilities: definition.capabilities || null,
          // Legacy flat capabilities flags (for backward compat)
          hasMovementChannels: definition.hasMovementChannels || false,
          has16bitMovement: definition.has16bitMovement || false,
          hasColorMixing: definition.hasColorMixing || false,
          hasColorWheel: definition.hasColorWheel || false,
          confidence: definition.confidence,
          detectionMethod: definition.detectionMethod
        }
      }
    } catch (err) {
      console.error('[IPC] lux:getFixtureDefinition error:', err)
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('lux:patch-fixture', async (_event, data: { fixtureId: string; dmxAddress: number; universe?: number }) => {
    const library = getFixtureLibrary()
    const fixture = library.find((f: { id: string }) => f.id === data.fixtureId)
    
    if (!fixture) {
      return { success: false, error: 'Fixture not found in library' }
    }
    
    const patchedFixtures = getPatchedFixtures()
    const zone = autoAssignZone(fixture.type as string, fixture.name as string)
    
    const patched = {
      ...fixture,
      dmxAddress: data.dmxAddress,
      universe: data.universe || 0,
      zone
    }
    
    patchedFixtures.push(patched)
    configManager.updateConfig({ patchedFixtures })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
    }
    
    return { success: true, fixture: patched }
  })
  
  ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress: number) => {
    const patchedFixtures = getPatchedFixtures()
    const index = patchedFixtures.findIndex((f: { dmxAddress: number }) => f.dmxAddress === dmxAddress)
    
    if (index !== -1) {
      patchedFixtures.splice(index, 1)
      recalculateZoneCounters()
      configManager.updateConfig({ patchedFixtures })
      
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
      }
      
      return { success: true }
    }
    
    return { success: false, error: 'Fixture not found at that address' }
  })
  
  // ✏️ WAVE 256: Editar fixture patcheado - ALL fields
  ipcMain.handle('lux:edit-fixture', (_event, data: { 
    originalDmxAddress: number
    newDmxAddress: number
    universe?: number
    name?: string
    zone?: string
    physics?: {
      installationType?: string
      invert?: { pan?: boolean; tilt?: boolean }
      swapXY?: boolean
    }
  }) => {
    const patchedFixtures = getPatchedFixtures()
    const fixture = patchedFixtures.find((f: { dmxAddress: number }) => f.dmxAddress === data.originalDmxAddress)
    
    if (!fixture) {
      return { success: false, error: `Fixture not found at DMX ${data.originalDmxAddress}` }
    }
    
    // Check for address collision (if address changed)
    if (data.newDmxAddress !== data.originalDmxAddress) {
      const collision = patchedFixtures.find((f: { dmxAddress: number }) => f.dmxAddress === data.newDmxAddress)
      if (collision) {
        return { success: false, error: `DMX address ${data.newDmxAddress} is already in use` }
      }
    }
    
    // Update basic fields
    fixture.dmxAddress = data.newDmxAddress
    if (data.universe !== undefined) {
      fixture.universe = data.universe
    }
    if (data.name !== undefined) {
      fixture.name = data.name
    }
    if (data.zone !== undefined) {
      fixture.zone = data.zone
    }
    
    // Update physical installation config
    if (data.physics) {
      fixture.orientation = data.physics.installationType || fixture.orientation
      fixture.invertPan = data.physics.invert?.pan ?? fixture.invertPan
      fixture.invertTilt = data.physics.invert?.tilt ?? fixture.invertTilt
      fixture.swapXY = data.physics.swapXY ?? fixture.swapXY
    }
    
    // Recalculate and save
    recalculateZoneCounters()
    configManager.updateConfig({ patchedFixtures })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
    }
    
    console.log(`✏️ [IPCHandlers] Fixture edited: ${fixture.name} @ DMX ${data.newDmxAddress}`)
    return { success: true, fixture }
  })
  
  ipcMain.handle('lux:clear-patch', () => {
    setPatchedFixtures([])
    resetZoneCounters()
    configManager.updateConfig({ patchedFixtures: [] })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', [])
    }
    
    return { success: true }
  })
  
  ipcMain.handle('lux:force-fixture-type', (_event, dmxAddress: number, newType: string) => {
    const patchedFixtures = getPatchedFixtures()
    const fixture = patchedFixtures.find((f: { dmxAddress: number }) => f.dmxAddress === dmxAddress)
    
    if (fixture) {
      fixture.type = newType
      fixture.manualOverride = newType
      configManager.updateConfig({ patchedFixtures })
      return { success: true }
    }
    
    return { success: false, error: 'Fixture not found' }
  })
  
  ipcMain.handle('lux:set-installation', (_event, type: 'ceiling' | 'floor') => {
    configManager.updateConfig({ installation: type })
    console.log(`[IPC] Installation type set to: ${type}`)
    return { success: true }
  })
  
  ipcMain.handle('lux:new-show', () => {
    setPatchedFixtures([])
    resetZoneCounters()
    configManager.updateConfig({ patchedFixtures: [] })
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:fixtures-loaded', [])
    }
    
    console.log('[IPC] New show created - patch cleared')
    return { success: true }
  })
  
  ipcMain.handle('lux:save-fixture-definition', async (_event, definition: Record<string, unknown>) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const libraryPath = fxtParser.getLibraryPath ? fxtParser.getLibraryPath() : ''
      
      if (!libraryPath) {
        console.error('[IPC] Library path not configured!')
        return { success: false, error: 'Library path not configured' }
      }
      
      // WAVE 388 EXT: Sanitize filename
      const safeName = (definition.name as string || 'custom')
        .replace(/[^a-z0-9áéíóúñü\s-]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 50)
      
      const fileName = `${safeName}.json`
      const filePath = path.join(libraryPath, fileName)
      
      // WAVE 388 EXT: Pretty print with 2 spaces
      fs.writeFileSync(filePath, JSON.stringify(definition, null, 2), 'utf-8')
      console.log(`[IPC] ✅ Saved fixture definition: ${filePath}`)
      
      // WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
      try {
        const updatedLibrary = await rescanAllLibraries()
        console.log(`[IPC] 🔄 WAVE 390.5 Library rescanned: ${updatedLibrary.length} fixtures (factory + custom merged)`)
      } catch (rescanErr) {
        console.warn('[IPC] ⚠️ Failed to rescan libraries after save:', rescanErr)
      }
      
      // WAVE 388 EXT: Return BOTH path and filePath for compatibility
      return { success: true, path: filePath, filePath }
    } catch (err) {
      console.error('[IPC] ❌ Failed to save fixture definition:', err)
      return { success: false, error: String(err) }
    }
  })
  
  // WAVE 388 EXT: Delete fixture definition from library
  // WAVE 389: Rescan library after delete to invalidate cache
  // Accepts either full filePath or fixture name to search
  ipcMain.handle('lux:delete-fixture-definition', async (_event, identifier: string) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      const libraryPath = fxtParser.getLibraryPath ? fxtParser.getLibraryPath() : ''
      
      if (!libraryPath) {
        return { success: false, error: 'Library path not configured' }
      }
      
      let fileToDelete: string | null = null
      
      // WAVE 388.7: Check if identifier is already a full path
      if (identifier.includes(path.sep) && fs.existsSync(identifier)) {
        // It's a full path - verify it's inside library folder
        if (identifier.startsWith(libraryPath)) {
          fileToDelete = identifier
        } else {
          return { success: false, error: 'File path outside library folder' }
        }
      } else {
        // Search by scanning the library
        const files = fs.readdirSync(libraryPath)
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue
          
          const filePath = path.join(libraryPath, file)
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            const fixture = JSON.parse(content)
            
            // Match by id OR by name OR by filename
            if (fixture.id === identifier || 
                fixture.name === identifier || 
                file === identifier ||
                file === `${identifier}.json`) {
              fileToDelete = filePath
              break
            }
          } catch (parseErr) {
            // Skip files that can't be parsed
            continue
          }
        }
      }
      
      if (!fileToDelete) {
        return { success: false, error: `Fixture "${identifier}" not found in library` }
      }
      
      // Delete the file
      fs.unlinkSync(fileToDelete)
      console.log(`[IPC] 🗑️ Deleted fixture: ${fileToDelete}`)
      
      // WAVE 390.5: Rescan ALL libraries (factory + custom) with proper merge
      try {
        const updatedLibrary = await rescanAllLibraries()
        console.log(`[IPC] 🔄 WAVE 390.5 Library rescanned: ${updatedLibrary.length} fixtures remain (factory + custom merged)`)
      } catch (rescanErr) {
        console.warn('[IPC] ⚠️ Failed to rescan libraries after delete:', rescanErr)
      }
      
      return { success: true, deletedPath: fileToDelete }
    } catch (err) {
      console.error('[IPC] ❌ Failed to delete fixture:', err)
      return { success: false, error: String(err) }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔌 WAVE 1113: LIBRARY UNIFIED API - Real FileSystem, No localStorage
  // Single Source of Truth for Forge + StageConstructor
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List ALL fixtures from both sources:
   * - System (factory): Read-only, from /librerias (resolved by PATHFINDER in main.ts)
   * - User (custom): Writable, from userData/fixtures
   * 
   * WAVE 1115 FIX: Use paths resolved by PATHFINDER, not hardcoded
   */
  ipcMain.handle('lux:library:list-all', async () => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      
      // WAVE 1115 FIX: Get paths from main.ts (resolved by PATHFINDER)
      const factoryPath = getFactoryLibPath()
      const userPath = getCustomLibPath()
      
      console.log(`[Library IPC] 📂 Factory path: ${factoryPath}`)
      console.log(`[Library IPC] 📂 User path: ${userPath}`)
      
      // Ensure user path exists
      if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true })
      }
      
      const systemFixtures: any[] = []
      const userFixtures: any[] = []
      
      // Scan factory library
      if (fs.existsSync(factoryPath)) {
        const factoryFiles = fs.readdirSync(factoryPath)
        for (const file of factoryFiles) {
          if (file.endsWith('.json')) {
            try {
              const content = fs.readFileSync(path.join(factoryPath, file), 'utf-8')
              const fixture = JSON.parse(content)
              systemFixtures.push({
                ...fixture,
                source: 'system',
                filePath: path.join(factoryPath, file),
              })
            } catch (e) {
              console.warn(`[Library] ⚠️ Failed to parse factory fixture: ${file}`)
            }
          } else if (file.endsWith('.fxt')) {
            // Parse FXT files via parser
            const parsed = fxtParser.parseFile(path.join(factoryPath, file))
            if (parsed) {
              systemFixtures.push({
                ...parsed,
                source: 'system',
                filePath: path.join(factoryPath, file),
              })
            }
          }
        }
      } else {
        console.warn(`[Library IPC] ⚠️ Factory path does not exist: ${factoryPath}`)
      }
      
      // Scan user library
      if (fs.existsSync(userPath)) {
        const userFiles = fs.readdirSync(userPath)
        for (const file of userFiles) {
          if (file.endsWith('.json')) {
            try {
              const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
              const fixture = JSON.parse(content)
              userFixtures.push({
                ...fixture,
                source: 'user',
                filePath: path.join(userPath, file),
              })
            } catch (e) {
              console.warn(`[Library] ⚠️ Failed to parse user fixture: ${file}`)
            }
          }
        }
      }
      
      console.log(`[Library IPC] ✅ Loaded ${systemFixtures.length} system + ${userFixtures.length} user fixtures`)
      
      return {
        success: true,
        systemFixtures,
        userFixtures,
        paths: {
          system: factoryPath,
          user: userPath,
        },
      }
    } catch (err) {
      console.error('[Library] ❌ Failed to list fixtures:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Save a user fixture to userData/fixtures
   * WAVE 1114 FIX: Check if file already exists and update instead of duplicating
   * WAVE 1116.2 FIX: Use PATHFINDER-resolved custom library path
   */
  ipcMain.handle('lux:library:save-user', async (_event, fixture: any) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      
      // WAVE 1116.2: Use PATHFINDER-resolved path
      const userPath = getCustomLibPath()
      
      console.log(`[Library Save] 📂 User path: ${userPath}`)
      
      // Ensure directory exists
      if (!fs.existsSync(userPath)) {
        fs.mkdirSync(userPath, { recursive: true })
      }
      
      // Ensure fixture has an ID
      if (!fixture.id) {
        fixture.id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      
      // WAVE 1114 FIX: Check if fixture already exists (by ID)
      // If exists, update the same file instead of creating new
      let existingFilePath: string | null = null
      
      const existingFiles = fs.readdirSync(userPath)
      for (const file of existingFiles) {
        if (!file.endsWith('.json')) continue
        
        try {
          const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
          const existingFixture = JSON.parse(content)
          
          if (existingFixture.id === fixture.id) {
            existingFilePath = path.join(userPath, file)
            console.log(`[Library] 🔄 Updating existing fixture file: ${file}`)
            break
          }
        } catch (e) {
          continue
        }
      }
      
      // Determine file path
      let filePath: string
      
      if (existingFilePath) {
        // Update existing file
        filePath = existingFilePath
      } else {
        // Create new file with safe name from fixture id
        const safeId = fixture.id
          .replace(/[^a-z0-9áéíóúñü\s-]/gi, '')
          .replace(/\s+/g, '_')
          .substring(0, 50)
        
        const fileName = `${safeId}.json`
        filePath = path.join(userPath, fileName)
      }
      
      // Add metadata
      fixture.savedAt = new Date().toISOString()
      fixture.source = 'user'
      
      // Write file
      fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2), 'utf-8')
      
      console.log(`[Library] 💾 WAVE 1114: Saved user fixture: ${filePath}`)
      
      // Rescan to update cache
      await rescanAllLibraries()
      
      return {
        success: true,
        filePath,
        fixture,
      }
    } catch (err) {
      console.error('[Library] ❌ Failed to save user fixture:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Delete a user fixture from userData/fixtures
   * Only user fixtures can be deleted (not system)
   * WAVE 1116 FIX: Use PATHFINDER-resolved custom library path
   */
  ipcMain.handle('lux:library:delete-user', async (_event, fixtureId: string) => {
    try {
      const fs = await import('fs')
      const path = await import('path')
      
      // WAVE 1116: Use PATHFINDER-resolved path
      const userPath = getCustomLibPath()
      
      if (!fs.existsSync(userPath)) {
        return { success: false, error: 'User fixtures folder does not exist' }
      }
      
      // Find the fixture file
      const files = fs.readdirSync(userPath)
      let fileToDelete: string | null = null
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        try {
          const content = fs.readFileSync(path.join(userPath, file), 'utf-8')
          const fixture = JSON.parse(content)
          
          if (fixture.id === fixtureId) {
            fileToDelete = path.join(userPath, file)
            break
          }
        } catch (e) {
          continue
        }
      }
      
      if (!fileToDelete) {
        return { success: false, error: `Fixture "${fixtureId}" not found in user library` }
      }
      
      // Delete the file
      fs.unlinkSync(fileToDelete)
      
      console.log(`[Library] 🗑️ WAVE 1113: Deleted user fixture: ${fileToDelete}`)
      
      // Rescan to update cache
      await rescanAllLibraries()
      
      return { success: true, deletedPath: fileToDelete }
    } catch (err) {
      console.error('[Library] ❌ Failed to delete user fixture:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Get DMX connection status for Live Probe
   * WAVE 1115 FIX: Check BOTH UniversalDMX (USB) and ArtNet
   */
  ipcMain.handle('lux:library:dmx-status', () => {
    const { universalDMX, artNetDriver } = deps
    
    // Check USB DMX
    const usbConnected = universalDMX?.isConnected ?? false
    const usbDevice = universalDMX?.currentDevice ?? null
    
    // Check ArtNet
    const artNetStatus = artNetDriver?.getStatus?.() || null
    const artNetConnected = artNetStatus?.connected ?? false
    
    // Return combined status (connected if EITHER is connected)
    const connected = usbConnected || artNetConnected
    const device = usbDevice || (artNetConnected ? 'ArtNet' : null)
    
    console.log(`[Library DMX Status] USB:${usbConnected} ArtNet:${artNetConnected} → ${connected}`)
    
    return {
      connected,
      device,
    }
  })
}

// =============================================================================
// SHOW HANDLERS - WAVE 365: PURGED
// Legacy ShowManager eliminated. All persistence now via StagePersistence + StageIPCHandlers
// Channels 'shows:*' removed. Use 'lux:stage:*' channels instead.
// =============================================================================

// =============================================================================
// DMX HANDLERS
// =============================================================================

function setupDMXHandlers(deps: IPCDependencies): void {
  const { universalDMX, getMainWindow } = deps
  
  ipcMain.handle('dmx:getStatus', () => {
    return {
      connected: universalDMX.isConnected,
      interface: universalDMX.currentDevice || 'none'
    }
  })
  
  ipcMain.handle('dmx:scan', async () => {
    try {
      const devices = await universalDMX.scanDevices()
      return { success: true, devices }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('dmx:connect', async (_event, devicePath: string) => {
    try {
      await universalDMX.connect(devicePath)
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('dmx:connected', universalDMX.currentDevice)
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('dmx:disconnect', async () => {
    try {
      await universalDMX.disconnect()
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('dmx:disconnected')
      }
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('dmx:sendChannel', (_event, channel: number, value: number) => {
    universalDMX.setChannel(channel, value)
    return { success: true }
  })
  
  ipcMain.handle('dmx:sendFrame', (_event, frame: number[]) => {
    universalDMX.sendFrame(frame)
    return { success: true }
  })

  // 🌪️ WAVE 688: Auto-connect to best available device
  ipcMain.handle('dmx:autoConnect', async () => {
    try {
      const success = await universalDMX.autoConnect()
      if (success) {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send('dmx:connected', universalDMX.currentDevice)
        }
      }
      return { success, device: universalDMX.currentDevice }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 🌪️ WAVE 688: Blackout - all channels to 0
  ipcMain.handle('dmx:blackout', () => {
    try {
      universalDMX.blackout()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  // 🌪️ WAVE 688: Highlight fixture for testing
  ipcMain.handle('dmx:highlightFixture', (_event, startChannel: number, channelCount: number, isMovingHead: boolean) => {
    try {
      universalDMX.highlightFixture(startChannel, channelCount, isMovingHead)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎛️ WAVE 1007: THE NERVE LINK - Direct DMX injection for calibration tools
  // GOD MODE: Bypasses HAL and TitanEngine for raw hardware access
  // ═══════════════════════════════════════════════════════════════════════════
  ipcMain.handle('dmx:sendDirect', (_event, params: { universe: number; address: number; value: number }) => {
    try {
      const { universe, address, value } = params
      
      // Clamp values to valid DMX range
      const clampedValue = Math.max(0, Math.min(255, Math.floor(value)))
      const clampedAddress = Math.max(1, Math.min(512, Math.floor(address)))
      
      console.log(`[IPC] 🎛️ NERVE LINK: Uni ${universe} | Addr ${clampedAddress} | Val ${clampedValue}`)
      
      // Universe 0 = USB (universalDMX), Universe 1+ = ArtNet
      if (universe === 0 || universe === 1) {
        // Primary universe - send via USB/Serial
        if (universalDMX?.isConnected) {
          universalDMX.setChannel(clampedAddress, clampedValue)
        }
        // Also send via ArtNet if configured (for ArtNet universe 0)
        if (deps.artNetDriver?.isRunning) {
          deps.artNetDriver.setChannel(clampedAddress, clampedValue)
          deps.artNetDriver.send()  // 🔥 WAVE 1008.5: Force immediate send for calibration
        }
      } else {
        // Higher universes - ArtNet only
        if (deps.artNetDriver?.isRunning) {
          deps.artNetDriver.setChannel(clampedAddress, clampedValue, universe)
          deps.artNetDriver.send()  // 🔥 WAVE 1008.5: Force immediate send
        }
      }
      
      return { success: true }
    } catch (err) {
      console.error('[IPC] 🔥 NERVE LINK Error:', err)
      return { success: false, error: String(err) }
    }
  })
}

// =============================================================================
// ARTNET HANDLERS
// =============================================================================

function setupArtNetHandlers(deps: IPCDependencies): void {
  const { artNetDriver } = deps
  
  ipcMain.handle('artnet:getStatus', () => {
    return artNetDriver.getStatus()
  })
  
  ipcMain.handle('artnet:start', async (_event, config?: { ip?: string; port?: number; universe?: number }) => {
    try {
      if (config) {
        artNetDriver.configure(config)
      }
      const success = await artNetDriver.start()
      return { success, status: artNetDriver.getStatus() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('artnet:stop', async () => {
    try {
      await artNetDriver.stop()
      return { success: true, status: artNetDriver.getStatus() }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  
  ipcMain.handle('artnet:configure', (_event, config: { ip?: string; port?: number; universe?: number; refreshRate?: number }) => {
    try {
      artNetDriver.configure(config)
      return { success: true, config: artNetDriver.currentConfig }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
