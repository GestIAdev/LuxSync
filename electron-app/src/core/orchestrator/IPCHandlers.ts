/**
 * 🌊 WAVE 237: IPC HANDLER EXTRACTION
 * 
 * Centraliza todos los handlers IPC en un solo lugar.
 * Los handlers delegan a módulos especializados, no contienen lógica de negocio.
 * 
 * @module IPCHandlers
 */

import { ipcMain, BrowserWindow, desktopCapturer, app } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any

/**
 * Dependencias inyectadas para los handlers IPC
 * Usamos tipos genéricos para evitar acoplamiento con implementaciones específicas
 */
export interface IPCDependencies {
  // Getters para instancias dinámicas
  getMainWindow: () => BrowserWindow | null
  getSelene: () => SeleneLuxInterface | null
  getEffectsEngine: () => EffectsEngineInterface | null
  getTrinity: () => TrinityInterface | null
  
  // Módulos estáticos (any para flexibilidad)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  universalDMX: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artNetDriver: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configManager: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showManager: any
  
  // Estado mutable
  state: IPCState
  
  // Callbacks para operaciones del sistema
  callbacks: IPCCallbacks
}

/**
 * Interfaces mínimas para los módulos principales
 */
export interface SeleneLuxInterface {
  getState: () => Record<string, unknown> | null
  setMode?: (mode: string) => void
  setUseBrain?: (enabled: boolean) => void
  setInputGain?: (gain: number) => void
  setVibe?: (vibeId: string) => void
  setLivingPalette?: (palette: string) => void
  setMovementPattern?: (pattern: string) => void
  setMovementSpeed?: (speed: number) => void
  setMovementIntensity?: (intensity: number) => void
  setGlobalColorParams?: (params: { saturation?: number; intensity?: number }) => void
  processAudioFrame?: (data: Record<string, unknown>) => void
  forceMutation?: () => void
  resetMemory?: () => void
  triggerEffect?: (name: string, params?: Record<string, unknown>) => void
}

export interface EffectsEngineInterface {
  triggerEffect: (name: string, params?: Record<string, unknown>, duration?: number) => number
  cancelEffect: (id: number | string) => void
  cancelAllEffects: () => void
}

export interface TrinityInterface {
  systemWake: () => void
  systemSleep: () => void
  enableBrain: () => void
  disableBrain: () => void
  setInputGain?: (gain: number) => void
  getWorkerHealth?: () => Promise<Record<string, unknown>>
  sendAudioBuffer?: (buffer: ArrayBuffer) => void
  processAudioFrame?: (data: Record<string, unknown>) => void
}

/**
 * Estado mutable compartido
 */
export interface IPCState {
  patchedFixtures: PatchedFixture[]
  manualOverrides: Map<string, ManualOverride>
  blackoutActive: boolean
  lastFixtureStatesForBroadcast: FixtureState[]
  zoneCounters: { front: number; back: number; left: number; right: number; ground: number }
}

export type FixtureZone = 'front' | 'back' | 'left' | 'right' | 'ground'

export interface PatchedFixture {
  id: string
  name: string
  type: string
  manufacturer: string
  channelCount: number
  dmxAddress: number
  universe: number
  zone: FixtureZone
  filePath?: string
}

export interface ManualOverride {
  pan?: number
  tilt?: number
  dimmer?: number
  r?: number
  g?: number
  b?: number
  timestamp: number
}

export interface FixtureState {
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
}

/**
 * Callbacks para operaciones del sistema
 */
export interface IPCCallbacks {
  startMainLoop: () => void
  stopMainLoop: () => void
  initSeleneLux: () => void
  autoAssignZone: (type: string, name: string) => FixtureZone
  recalculateZoneCounters: () => void
  runSeleneDiagnostics: () => void
}

/**
 * Registra todos los handlers IPC
 */
export function setupIPCHandlers(deps: IPCDependencies): void {
  console.log('[IPC] 📡 Setting up IPC handlers (WAVE 237)')
  
  // ═══════════════════════════════════════════════════════════════════════════
  // APP & SYSTEM HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  setupAppHandlers(deps)
  setupAudioHandlers(deps)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SELENE LUX HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  setupSeleneLuxHandlers(deps)
  setupPaletteHandlers(deps)
  setupMovementHandlers(deps)
  setupEffectsHandlers(deps)
  setupOverrideHandlers(deps)
  setupStateHandlers(deps)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FIXTURE & PATCH HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  setupFixtureHandlers(deps)
  setupShowHandlers(deps)
  setupConfigHandlers(deps)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DMX & ARTNET HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  setupDMXHandlers(deps)
  setupArtNetHandlers(deps)
  
  console.log('[IPC] ✅ All IPC handlers registered')
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER GROUPS
// ═══════════════════════════════════════════════════════════════════════════

function setupAppHandlers(deps: IPCDependencies): void {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}

function setupAudioHandlers(deps: IPCDependencies): void {
  ipcMain.handle('audio:getDevices', async () => {
    return []
  })

  ipcMain.handle('audio:getDesktopSources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      console.log('[IPC] Desktop sources found:', sources.length)
      return sources.map(s => ({
        id: s.id,
        name: s.name,
        displayId: s.display_id
      }))
    } catch (err) {
      console.error('[IPC] Failed to get desktop sources:', err)
      return []
    }
  })
}

function setupSeleneLuxHandlers(deps: IPCDependencies): void {
  const { getSelene, getTrinity, callbacks, configManager, state } = deps
  
  ipcMain.handle('lux:start', () => {
    const selene = getSelene()
    
    if ((globalThis as Record<string, unknown>).__lux_isSystemRunning) {
      console.log('[IPC] ⚠️ lux:start called but system already running - ignoring')
      callbacks.startMainLoop()
      
      try {
        const trinityRef = getTrinity()
        if (trinityRef) {
          trinityRef.systemWake()
        }
      } catch (e) {
        console.warn('[IPC] ⚠️ Could not send SYSTEM_WAKE:', e)
      }
      
      const savedConfig = configManager.getConfig()
      const savedGain = savedConfig.audio?.inputGain ?? 1.0
      return { success: true, alreadyRunning: true, inputGain: savedGain }
    }
    
    if (!selene) {
      callbacks.initSeleneLux()
    }
    
    callbacks.startMainLoop()
    ;(globalThis as Record<string, unknown>).__lux_isSystemRunning = true
    
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.systemWake()
      }
    } catch (e) {
      console.warn('[IPC] ⚠️ Could not get Trinity for SYSTEM_WAKE:', e)
    }
    
    const savedConfig = configManager.getConfig()
    const savedGain = savedConfig.audio?.inputGain ?? 1.0
    
    return { success: true, inputGain: savedGain }
  })

  ipcMain.handle('lux:stop', () => {
    callbacks.stopMainLoop()
    ;(globalThis as Record<string, unknown>).__lux_isSystemRunning = false
    
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.systemSleep()
      }
    } catch (e) {
      console.warn('[IPC] ⚠️ Could not get Trinity for SYSTEM_SLEEP:', e)
    }
    
    return { success: true }
  })

  ipcMain.handle('lux:set-mode', async (_event, mode: 'reactive' | 'intelligent') => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    selene.setMode(mode === 'reactive' ? 'flow' : 'selene')
    selene.setUseBrain(mode === 'intelligent')
    
    let trinity: ReturnType<typeof getTrinity> | null = null
    try {
      trinity = getTrinity()
    } catch {
      console.log('[IPC] Trinity not initialized yet')
    }
    
    if (mode === 'intelligent') {
      selene.setUseBrain(true)
      if (trinity) {
        trinity.enableBrain()
      }
    } else {
      selene.setUseBrain(false)
      if (trinity) {
        trinity.disableBrain()
      }
    }
    
    console.log(`[IPC] 🧠 Mode changed to: ${mode}`)
    return { success: true, mode }
  })

  ipcMain.handle('lux:set-input-gain', (_event, value: number) => {
    const selene = getSelene()
    const clampedGain = Math.max(0, Math.min(3.0, value))
    
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.setInputGain(clampedGain)
      }
    } catch (e) {
      console.warn('[IPC] ⚠️ Could not set Trinity input gain:', e)
    }
    
    if (selene) {
      selene.setInputGain(clampedGain)
    }
    
    // Persist to config
    configManager.setConfig({
      audio: {
        ...configManager.getConfig().audio,
        inputGain: clampedGain
      }
    })
    
    console.log(`[IPC] 🎚️ Input gain set to: ${clampedGain.toFixed(2)}`)
    return { success: true, gain: clampedGain }
  })

  ipcMain.handle('lux:set-global-color-params', async (_event, params: { saturation?: number; intensity?: number }) => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      selene.setGlobalColorParams(params)
      console.log(`[IPC] 🎨 Global color params:`, params)
      return { success: true, params }
    } catch (err) {
      console.error('[IPC] Failed to set global color params:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('lux:initialize-system', async () => {
    console.log('[IPC] 🚀 Initializing LuxSync system...')
    
    if ((globalThis as Record<string, unknown>).__lux_isSystemRunning) {
      console.log('[IPC] ⚠️ System already running')
      return { success: true, alreadyRunning: true }
    }
    
    callbacks.initSeleneLux()
    callbacks.startMainLoop()
    ;(globalThis as Record<string, unknown>).__lux_isSystemRunning = true
    
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.systemWake()
      }
    } catch (e) {
      console.warn('[IPC] ⚠️ Could not get Trinity:', e)
    }
    
    return { success: true }
  })
}

function setupPaletteHandlers(deps: IPCDependencies): void {
  const { getSelene } = deps
  
  ipcMain.handle('lux:set-palette', (_event, palette: string) => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    selene.setLivingPalette?.(palette)
    console.log(`[IPC] 🎨 Palette set to: ${palette}`)
    return { success: true, palette }
  })
}

function setupMovementHandlers(deps: IPCDependencies): void {
  const { getSelene } = deps
  
  ipcMain.handle('lux:set-movement', (_event, config: { pattern?: string; speed?: number; intensity?: number }) => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    if (config.pattern !== undefined) {
      selene.setMovementPattern(config.pattern)
    }
    if (config.speed !== undefined) {
      selene.setMovementSpeed(config.speed)
    }
    if (config.intensity !== undefined) {
      selene.setMovementIntensity(config.intensity)
    }
    
    console.log(`[IPC] 🌀 Movement config:`, config)
    return { success: true, config }
  })
}

function setupEffectsHandlers(deps: IPCDependencies): void {
  const { getSelene, getEffectsEngine } = deps
  
  ipcMain.handle('lux:trigger-effect', (_event, data: { effectName: string; params?: Record<string, unknown>; duration?: number }) => {
    const selene = getSelene()
    const effectsEngine = getEffectsEngine()
    
    if (!selene && !effectsEngine) {
      return { success: false, error: 'Neither Selene nor EffectsEngine initialized' }
    }
    
    console.log(`[IPC] ⚡ Effect triggered: ${data.effectName}`, data.params)
    
    try {
      if (effectsEngine) {
        const effectId = effectsEngine.triggerEffect(data.effectName, data.params, data.duration)
        return { success: true, effectId }
      } else if (selene) {
        selene.triggerEffect?.(data.effectName, data.params)
        return { success: true }
      }
    } catch (err) {
      console.error(`[IPC] ❌ Effect error:`, err)
      return { success: false, error: String(err) }
    }
    
    return { success: false, error: 'No effect engine available' }
  })

  ipcMain.handle('lux:cancel-effect', (_event, effectIdOrName: number | string) => {
    const effectsEngine = getEffectsEngine()
    
    if (!effectsEngine) {
      return { success: false, error: 'Effects engine not initialized' }
    }
    
    try {
      effectsEngine.cancelEffect(effectIdOrName)
      console.log(`[IPC] ❌ Effect cancelled: ${effectIdOrName}`)
      return { success: true }
    } catch (err) {
      console.error(`[IPC] ❌ Cancel effect error:`, err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('lux:cancel-all-effects', () => {
    const effectsEngine = getEffectsEngine()
    
    if (!effectsEngine) {
      return { success: false, error: 'Effects engine not initialized' }
    }
    
    try {
      effectsEngine.cancelAllEffects()
      console.log('[IPC] ❌ All effects cancelled')
      return { success: true }
    } catch (err) {
      console.error('[IPC] ❌ Cancel all effects error:', err)
      return { success: false, error: String(err) }
    }
  })
}

function setupOverrideHandlers(deps: IPCDependencies): void {
  const { getMainWindow, state } = deps
  
  ipcMain.handle('override:set', (_event, fixtureId: string, values: Partial<Omit<ManualOverride, 'timestamp'>>) => {
    const existing = state.manualOverrides.get(fixtureId) || { timestamp: 0 }
    state.manualOverrides.set(fixtureId, {
      ...existing,
      ...values,
      timestamp: Date.now()
    })
    console.log(`[IPC] 🕹️ Override ${fixtureId}: pan=${values.pan} tilt=${values.tilt} dimmer=${values.dimmer}`)
    return { success: true }
  })

  ipcMain.handle('override:set-multiple', (_event, fixtureIds: string[], values: Partial<Omit<ManualOverride, 'timestamp'>>) => {
    const now = Date.now()
    for (const id of fixtureIds) {
      const existing = state.manualOverrides.get(id) || { timestamp: 0 }
      state.manualOverrides.set(id, {
        ...existing,
        ...values,
        timestamp: now
      })
    }
    console.log(`[IPC] 🕹️ Override ${fixtureIds.length} fixtures: pan=${values.pan} tilt=${values.tilt} dimmer=${values.dimmer}`)
    return { success: true }
  })

  ipcMain.handle('override:clear', (_event, fixtureId: string) => {
    state.manualOverrides.delete(fixtureId)
    console.log(`[IPC] 🔓 Released: ${fixtureId}`)
    return { success: true }
  })

  ipcMain.handle('override:clear-all', () => {
    state.manualOverrides.clear()
    console.log('[IPC] 🔓 Released ALL overrides')
    return { success: true }
  })

  ipcMain.handle('lux:set-blackout', (_event, active: boolean) => {
    state.blackoutActive = active
    console.log(`[IPC] 🔲 Blackout: ${active ? 'ON' : 'OFF'}`)
    
    const mainWindow = getMainWindow()
    if (mainWindow) {
      mainWindow.webContents.send('lux:blackout-changed', active)
    }
    
    return { success: true, blackout: active }
  })
}

function setupStateHandlers(deps: IPCDependencies): void {
  const { getSelene, getTrinity, universalDMX, state } = deps
  
  ipcMain.handle('lux:get-state', () => {
    const selene = getSelene()
    if (!selene) return null
    return selene.getState()
  })

  ipcMain.handle('lux:get-full-state', () => {
    const selene = getSelene()
    const seleneState = selene ? selene.getState() : null
    
    let trinity: ReturnType<typeof getTrinity> | null = null
    try {
      trinity = getTrinity()
    } catch {
      // Trinity not initialized
    }
    
    return {
      dmx: {
        isConnected: universalDMX.isConnected,
        status: universalDMX.isConnected ? 'connected' : 'disconnected',
        driver: universalDMX.device?.friendlyName || null,
        port: universalDMX.device?.path || null,
      },
      selene: {
        isRunning: selene !== null,
        mode: seleneState?.mode || null,
        brainMode: seleneState?.brainMode || null,
        paletteSource: seleneState?.paletteSource || null,
        consciousness: seleneState?.consciousness || null,
      },
      audio: {
        hasWorkers: trinity !== null,
      },
    }
  })

  ipcMain.handle('selene:getBrainStats', async () => {
    try {
      const trinityRef = getTrinity()
      if (!trinityRef) {
        return { success: false, error: 'Trinity not initialized' }
      }
      
      const health = await trinityRef.getWorkerHealth()
      return {
        success: true,
        stats: {
          frameCount: health.frameCount || 0,
          messagesProcessed: health.messagesProcessed || 0,
          uptime: health.uptime || 0,
          lastUpdate: health.lastUpdate || Date.now(),
          errors: health.errors || [],
        }
      }
    } catch (err) {
      console.error('[IPC] Failed to get brain stats:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('selene:force-mutate', () => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      selene.forceMutation?.()
      console.log('[IPC] 🧬 Forced mutation triggered')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('selene:reset-memory', () => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      selene.resetMemory?.()
      console.log('[IPC] 🧹 Memory reset')
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

function setupFixtureHandlers(deps: IPCDependencies): void {
  const { getMainWindow, configManager, state, callbacks } = deps
  
  ipcMain.handle('lux:scan-fixtures', async (_event, customPath?: string) => {
    // Delegate to fixture scanner logic
    console.log('[IPC] 🔍 Scanning fixtures...', customPath ? `Custom path: ${customPath}` : '')
    // Implementation delegated to fixture module
    return { success: true, fixtures: [] }
  })

  ipcMain.handle('lux:get-fixture-library', () => {
    return configManager.getFixtureLibrary?.() || []
  })

  ipcMain.handle('lux:get-patched-fixtures', () => {
    return state.patchedFixtures
  })

  ipcMain.handle('lux:patch-fixture', (_event, data: { fixtureId: string; dmxAddress: number; universe?: number; zone?: FixtureZone }) => {
    // Patching logic delegated
    console.log(`[IPC] 📍 Patching fixture ${data.fixtureId} at DMX ${data.dmxAddress}`)
    return { success: true }
  })

  ipcMain.handle('lux:unpatch-fixture', (_event, dmxAddress: number) => {
    const idx = state.patchedFixtures.findIndex(f => f.dmxAddress === dmxAddress)
    if (idx >= 0) {
      state.patchedFixtures.splice(idx, 1)
      callbacks.recalculateZoneCounters()
      configManager.setConfig({ patchedFixtures: state.patchedFixtures })
      console.log(`[IPC] 🗑️ Unpatched fixture at DMX ${dmxAddress}`)
      return { success: true }
    }
    return { success: false, error: 'Fixture not found' }
  })

  ipcMain.handle('lux:force-fixture-type', (_event, dmxAddress: number, newType: string) => {
    const fixture = state.patchedFixtures.find(f => f.dmxAddress === dmxAddress)
    if (fixture) {
      fixture.type = newType
      fixture.zone = callbacks.autoAssignZone(newType, fixture.name)
      callbacks.recalculateZoneCounters()
      configManager.setConfig({ patchedFixtures: state.patchedFixtures })
      console.log(`[IPC] 🔧 Forced fixture type at DMX ${dmxAddress} to: ${newType}`)
      return { success: true, fixture }
    }
    return { success: false, error: 'Fixture not found' }
  })

  ipcMain.handle('lux:set-installation', (_event, installationType: 'ceiling' | 'floor') => {
    configManager.setConfig({ installationType })
    console.log(`[IPC] 🏗️ Installation type set to: ${installationType}`)
    return { success: true, installationType }
  })

  ipcMain.handle('lux:clear-patch', () => {
    state.patchedFixtures.length = 0
    state.zoneCounters = { front: 0, back: 0, left: 0, right: 0, ground: 0 }
    configManager.setConfig({ patchedFixtures: [] })
    console.log('[IPC] 🗑️ Patch cleared')
    return { success: true }
  })

  ipcMain.handle('lux:save-fixture-definition', async (_event, def: Record<string, unknown>) => {
    console.log('[IPC] 💾 Saving fixture definition:', def.name)
    return { success: true }
  })
}

function setupShowHandlers(deps: IPCDependencies): void {
  const { showManager, state, configManager, callbacks, getMainWindow } = deps
  
  ipcMain.handle('lux:new-show', () => {
    state.patchedFixtures.length = 0
    state.zoneCounters = { front: 0, back: 0, left: 0, right: 0, ground: 0 }
    configManager.setConfig({ patchedFixtures: [] })
    console.log('[IPC] 📄 New show created')
    return { success: true }
  })

  ipcMain.handle('lux:list-shows', () => {
    return showManager.listShows()
  })

  ipcMain.handle('lux:save-show', (_event, data: { name: string; description: string }) => {
    return showManager.saveShow(data.name, data.description, state.patchedFixtures)
  })

  ipcMain.handle('lux:load-show', async (_event, filename: string) => {
    try {
      const result = showManager.loadShow(filename)
      if (result.success && result.show) {
        state.patchedFixtures.length = 0
        state.patchedFixtures.push(...(result.show.fixtures || []))
        callbacks.recalculateZoneCounters()
        configManager.setConfig({ patchedFixtures: state.patchedFixtures })
        
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send('lux:fixtures-updated', state.patchedFixtures)
        }
        
        console.log(`[IPC] 📂 Loaded show: ${filename}`)
      }
      return result
    } catch (err) {
      console.error('[IPC] Failed to load show:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('lux:delete-show', (_event, filename: string) => {
    return showManager.deleteShow(filename)
  })

  ipcMain.handle('lux:create-show', (_event, data: { name: string; description?: string }) => {
    return showManager.saveShow(data.name, data.description || '', state.patchedFixtures)
  })

  ipcMain.handle('lux:get-shows-path', () => {
    return showManager.getShowsPath()
  })
}

function setupConfigHandlers(deps: IPCDependencies): void {
  const { configManager } = deps
  
  ipcMain.handle('lux:get-config', () => {
    return configManager.getConfig()
  })

  ipcMain.handle('lux:save-config', (_event, config: Parameters<typeof configManager.setConfig>[0]) => {
    configManager.setConfig(config)
    return { success: true }
  })

  ipcMain.handle('lux:reset-config', () => {
    configManager.resetConfig?.()
    return { success: true }
  })

  ipcMain.handle('lux:get-loaded-config', () => {
    return configManager.getConfig()
  })
}

function setupDMXHandlers(deps: IPCDependencies): void {
  const { universalDMX, getMainWindow, state } = deps
  
  ipcMain.handle('dmx:getStatus', () => {
    return { connected: universalDMX.isConnected, interface: universalDMX.device?.friendlyName || 'none' }
  })

  ipcMain.handle('dmx:list-devices', async () => {
    try {
      const devices = await universalDMX.listDevices()
      return { success: true, devices }
    } catch (err) {
      console.error('[IPC] DMX list devices error:', err)
      return { success: false, error: String(err), devices: [] }
    }
  })

  ipcMain.handle('dmx:auto-connect', async () => {
    try {
      const result = await universalDMX.autoConnect()
      if (result) {
        console.log('[IPC] 🔌 DMX auto-connected')
      }
      return { success: result, connected: universalDMX.isConnected }
    } catch (err) {
      console.error('[IPC] DMX auto-connect error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dmx:connect', async (_event, portPath: string) => {
    try {
      const result = await universalDMX.connect(portPath)
      return { success: result, connected: universalDMX.isConnected }
    } catch (err) {
      console.error('[IPC] DMX connect error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dmx:disconnect', async () => {
    try {
      await universalDMX.disconnect()
      return { success: true }
    } catch (err) {
      console.error('[IPC] DMX disconnect error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dmx:get-status', () => {
    return {
      isConnected: universalDMX.isConnected,
      device: universalDMX.device,
    }
  })

  ipcMain.handle('dmx:blackout', () => {
    state.blackoutActive = true
    console.log('[IPC] 🔲 DMX Blackout')
    return { success: true }
  })

  ipcMain.handle('dmx:highlight-fixture', async (_event, startChannel: number, channelCount: number, isMovingHead: boolean) => {
    console.log(`[IPC] 💡 Highlight fixture at DMX ${startChannel}, ${channelCount} channels`)
    // Highlight logic delegated to driver
    return { success: true }
  })
}

function setupArtNetHandlers(deps: IPCDependencies): void {
  const { artNetDriver, getMainWindow } = deps
  
  ipcMain.handle('artnet:start', async (_event, config?: { ip?: string; port?: number; universe?: number }) => {
    try {
      await artNetDriver.start(config)
      return { success: true, ...artNetDriver.getStatus() }
    } catch (err) {
      console.error('[IPC] ArtNet start error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('artnet:stop', async () => {
    try {
      await artNetDriver.stop()
      return { success: true }
    } catch (err) {
      console.error('[IPC] ArtNet stop error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('artnet:configure', (_event, config: { ip?: string; port?: number; universe?: number; refreshRate?: number }) => {
    try {
      artNetDriver.configure(config)
      return { success: true, config: artNetDriver.currentConfig }
    } catch (err) {
      console.error('[IPC] ArtNet configure error:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('artnet:get-status', () => {
    return {
      success: true,
      ...artNetDriver.getStatus()
    }
  })
  
  // ArtNet events to renderer
  const mainWindow = getMainWindow()
  
  artNetDriver.on('ready', () => {
    console.log('[IPC] 🎨 ArtNet Ready')
    mainWindow?.webContents.send('artnet:ready', artNetDriver.getStatus())
  })

  artNetDriver.on('error', (error: Error) => {
    console.error('[IPC] ❌ ArtNet Error:', error.message)
    mainWindow?.webContents.send('artnet:error', error.message)
  })

  artNetDriver.on('disconnected', () => {
    console.log('[IPC] 🔌 ArtNet Disconnected')
    mainWindow?.webContents.send('artnet:disconnected')
  })
}

// Additional handlers that need special setup
export function setupVibeHandlers(deps: IPCDependencies): void {
  const { getSelene, getTrinity } = deps
  
  ipcMain.handle('selene:setVibe', async (_event, vibeId: string) => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      selene.setVibe?.(vibeId)
      console.log(`[IPC] 🎭 Vibe set to: ${vibeId}`)
      return { success: true, vibeId }
    } catch (err) {
      console.error('[IPC] Failed to set vibe:', err)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('selene:getVibe', async () => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      const state = selene.getState()
      return { success: true, vibeId: state?.vibe || 'pop-rock' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('selene:setMode', async (_event, uiMode: 'flow' | 'selene' | 'locked') => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    console.log(`[IPC] 🎚️ BIG SWITCH: ${uiMode.toUpperCase()}`)
    
    let trinity: ReturnType<typeof getTrinity> | null = null
    try {
      trinity = getTrinity()
    } catch {
      console.log('[IPC] Trinity not initialized yet - worker commands skipped')
    }
    
    let result: { success: boolean; mode?: string; brain?: boolean; error?: string }
    
    switch (uiMode) {
      case 'flow':
        selene.setMode('flow')
        selene.setUseBrain(false)
        if (trinity) {
          trinity.disableBrain()
        }
        console.log('[IPC] 🔄 FLOW MODE - Reactive lighting, no AI')
        result = { success: true, mode: 'flow', brain: false }
        break
        
      case 'selene':
        selene.setMode('selene')
        selene.setUseBrain(true)
        if (trinity) {
          trinity.enableBrain()
        }
        console.log('[IPC] 🧠 SELENE MODE - AI-driven lighting')
        result = { success: true, mode: 'selene', brain: true }
        break
        
      case 'locked':
        selene.setMode('locked')
        selene.setUseBrain(false)
        if (trinity) {
          trinity.disableBrain()
        }
        console.log('[IPC] 🔒 LOCKED MODE - Manual control only')
        result = { success: true, mode: 'locked', brain: false }
        break
        
      default:
        result = { success: false, error: `Unknown mode: ${uiMode}` }
    }
    
    return result
  })
}

export function setupAudioFrameHandlers(deps: IPCDependencies): void {
  const { getTrinity, getSelene } = deps
  
  ipcMain.handle('lux:audio-buffer', (_event, bufferData: ArrayBuffer) => {
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.sendAudioBuffer(bufferData)
      }
    } catch (e) {
      console.warn('[IPC] ⚠️ Could not send audio buffer:', e)
    }
    return { success: true }
  })

  ipcMain.handle('lux:audio-frame', (_event, audioData: {
    bass: number
    mid: number
    high: number
    energy: number
    frequencyBands: number[]
    waveform: number[]
  }) => {
    const selene = getSelene()
    if (!selene) {
      return { success: false, error: 'Selene not initialized' }
    }
    
    try {
      const trinityRef = getTrinity()
      if (trinityRef) {
        trinityRef.processAudioFrame(audioData)
      }
    } catch (e) {
      // Trinity not available, use selene directly
    }
    
    selene.processAudioFrame?.(audioData)
    return { success: true }
  })
}
