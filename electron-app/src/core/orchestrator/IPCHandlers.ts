/**
 * WAVE 243.5: IPC HANDLERS - SIMPLIFIED V2
 * 
 * Centraliza todos los handlers IPC.
 * Recibe dependencias directamente desde main.ts V2.
 * 
 * @module IPCHandlers
 */

import { ipcMain, BrowserWindow } from 'electron'

// Type for zone (matches main.ts)
export type FixtureZone = 'FRONT_PARS' | 'BACK_PARS' | 'MOVING_LEFT' | 'MOVING_RIGHT' | 'STROBES' | 'LASERS' | 'UNASSIGNED'

/**
 * WAVE 243.5: Dependencias inyectadas directamente desde main.ts V2
 */
export interface IPCDependencies {
  // Core instances (can be null during init)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mainWindow: BrowserWindow | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selene: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  effectsEngine: any
  
  // External services
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configManager: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  universalDMX: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artNetDriver: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showManager: any
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
  setupShowHandlers(deps)
  setupDMXHandlers(deps)
  setupArtNetHandlers(deps)
  
  console.log('[IPC] All IPC handlers registered')
}

// =============================================================================
// SELENE LUX HANDLERS
// =============================================================================

function setupSeleneLuxHandlers(deps: IPCDependencies): void {
  const { selene, configManager } = deps
  
  ipcMain.handle('lux:start', () => {
    console.log('[IPC] lux:start - SeleneLux active via TitanOrchestrator')
    const savedConfig = configManager.getConfig()
    const savedGain = savedConfig?.audio?.inputGain ?? 1.0
    return { success: true, inputGain: savedGain }
  })
  
  ipcMain.handle('lux:stop', () => {
    console.log('[IPC] lux:stop - Handled by TitanOrchestrator')
    return { success: true }
  })
  
  ipcMain.handle('lux:getState', () => {
    if (selene) {
      return selene.getState?.() ?? null
    }
    return null
  })
  
  ipcMain.handle('lux:setMode', (_event, mode: string) => {
    console.log('[IPC] lux:setMode:', mode)
    if (selene?.setMode) {
      selene.setMode(mode)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setUseBrain', (_event, enabled: boolean) => {
    console.log('[IPC] lux:setUseBrain:', enabled)
    if (selene?.setUseBrain) {
      selene.setUseBrain(enabled)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setInputGain', (_event, gain: number) => {
    console.log('[IPC] lux:setInputGain:', gain)
    if (selene?.setInputGain) {
      selene.setInputGain(gain)
    }
    configManager.updateConfig({ audio: { inputGain: gain } })
    return { success: true }
  })
  
  ipcMain.handle('lux:setVibe', (_event, vibeId: string) => {
    console.log('[IPC] lux:setVibe:', vibeId)
    if (selene?.setVibe) {
      selene.setVibe(vibeId)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setLivingPalette', (_event, palette: string) => {
    console.log('[IPC] lux:setLivingPalette:', palette)
    if (selene?.setLivingPalette) {
      selene.setLivingPalette(palette)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementPattern', (_event, pattern: string) => {
    console.log('[IPC] lux:setMovementPattern:', pattern)
    if (selene?.setMovementPattern) {
      selene.setMovementPattern(pattern)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementSpeed', (_event, speed: number) => {
    if (selene?.setMovementSpeed) {
      selene.setMovementSpeed(speed)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setMovementIntensity', (_event, intensity: number) => {
    if (selene?.setMovementIntensity) {
      selene.setMovementIntensity(intensity)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:setGlobalColorParams', (_event, params: { saturation?: number; intensity?: number }) => {
    if (selene?.setGlobalColorParams) {
      selene.setGlobalColorParams(params)
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:forceMutation', () => {
    if (selene?.forceMutation) {
      selene.forceMutation()
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:resetMemory', () => {
    if (selene?.resetMemory) {
      selene.resetMemory()
    }
    return { success: true }
  })
  
  ipcMain.handle('lux:audioFrame', (_event, data: Record<string, unknown>) => {
    if (selene?.processAudioFrame) {
      selene.processAudioFrame(data)
    }
    return true
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
    getMainWindow 
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
}

// =============================================================================
// SHOW HANDLERS
// =============================================================================

function setupShowHandlers(deps: IPCDependencies): void {
  const { showManager, getPatchedFixtures, setPatchedFixtures, configManager, getMainWindow, resetZoneCounters, autoAssignZone, recalculateZoneCounters } = deps
  
  ipcMain.handle('shows:list', async () => {
    return showManager.listShows()
  })
  
  ipcMain.handle('shows:save', async (_event, name: string) => {
    const patchedFixtures = getPatchedFixtures()
    return showManager.saveShow(name, { fixtures: patchedFixtures })
  })
  
  ipcMain.handle('shows:load', async (_event, name: string) => {
    const show = await showManager.loadShow(name)
    
    if (show?.fixtures) {
      resetZoneCounters()
      const fixtures = show.fixtures.map((f: Record<string, unknown>) => ({
        ...f,
        zone: autoAssignZone(f.type as string, f.name as string)
      }))
      setPatchedFixtures(fixtures)
      recalculateZoneCounters()
      configManager.updateConfig({ patchedFixtures: fixtures })
      
      const mainWindow = getMainWindow()
      if (mainWindow) {
        mainWindow.webContents.send('lux:fixtures-loaded', fixtures)
      }
    }
    
    return { success: true }
  })
  
  ipcMain.handle('shows:delete', async (_event, name: string) => {
    return showManager.deleteShow(name)
  })
}

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
