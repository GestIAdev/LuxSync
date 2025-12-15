/**
 * 🔌 LUXSYNC ELECTRON - PRELOAD SCRIPT
 * Puente seguro entre Main y Renderer
 * 
 * V2.0: Añadido window.lux para comunicación con Selene Lux Core
 * V2.1: Añadido desktopCapturer para audio del sistema (via IPC)
 */

import { contextBridge, ipcRenderer } from 'electron'

// ============================================================================
// SELENE STATE TYPE (para tipado en React)
// ============================================================================
export interface SeleneStateUpdate {
  // Color
  r: number
  g: number
  b: number
  w: number
  
  // Position
  pan: number
  tilt: number
  
  // Dimmer
  dimmer: number
  
  // Movement state
  movementPhase: number
  
  // Effects
  activeEffects: string[]
  
  // Optics
  prismActive: boolean
  goboIndex: number
  
  // Audio metrics (opcional)
  audioMetrics?: {
    bass: number
    mid: number
    treble: number
    energy: number
    bpm: number
  }
  
  // Palette info
  paletteIndex: number
  paletteName: string
  
  // Timing
  timestamp: number
}

// API expuesta al renderer de forma segura
const api = {
  // ============================================
  // APP
  // ============================================
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // ============================================
  // DMX - WAVE 11: Universal Driver
  // ============================================
  dmx: {
    getStatus: () => ipcRenderer.invoke('dmx:get-status'),
    sendValues: (values: number[]) => ipcRenderer.invoke('dmx:send', values),
    onUpdate: (callback: (values: number[]) => void) => {
      ipcRenderer.on('dmx:update', (_, values) => callback(values))
    },
    // 🌪️ WAVE 11: Nuevas funciones
    listDevices: () => ipcRenderer.invoke('dmx:list-devices'),
    autoConnect: () => ipcRenderer.invoke('dmx:auto-connect'),
    connect: (portPath: string) => ipcRenderer.invoke('dmx:connect', portPath),
    disconnect: () => ipcRenderer.invoke('dmx:disconnect'),
    blackout: () => ipcRenderer.invoke('dmx:blackout'),
    // 🔦 Highlight fixture para testing
    highlightFixture: (startChannel: number, channelCount: number, isMovingHead: boolean) =>
      ipcRenderer.invoke('dmx:highlight-fixture', startChannel, channelCount, isMovingHead),
    // 📡 Status events (connected/disconnected/reconnecting)
    onStatus: (callback: (status: { state: string; device?: any; error?: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: any) => callback(status)
      ipcRenderer.on('dmx:status', handler)
      return () => ipcRenderer.removeListener('dmx:status', handler)
    },
    onConnected: (callback: (device: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, device: any) => callback(device)
      ipcRenderer.on('dmx:connected', handler)
      return () => ipcRenderer.removeListener('dmx:connected', handler)
    },
    onDisconnected: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('dmx:disconnected', handler)
      return () => ipcRenderer.removeListener('dmx:disconnected', handler)
    },
  },

  // ============================================
  // AUDIO
  // ============================================
  audio: {
    getDevices: () => ipcRenderer.invoke('audio:getDevices'),
    onBeat: (callback: (data: { bpm: number; energy: number }) => void) => {
      ipcRenderer.on('audio:beat', (_, data) => callback(data))
    },
    onSpectrum: (callback: (spectrum: number[]) => void) => {
      ipcRenderer.on('audio:spectrum', (_, spectrum) => callback(spectrum))
    },
    
    // WAVE 9.6.2: Desktop Capturer via IPC (main process)
    getDesktopSources: () => ipcRenderer.invoke('audio:getDesktopSources')
  },

  // ============================================
  // SELENE
  // ============================================
  selene: {
    onDecision: (callback: (decision: any) => void) => {
      ipcRenderer.on('selene:decision', (_, decision) => callback(decision))
    },
    onMoodChange: (callback: (mood: string) => void) => {
      ipcRenderer.on('selene:mood', (_, mood) => callback(mood))
    },
    setMode: (mode: 'flow' | 'selene' | 'locked') => {
      ipcRenderer.invoke('selene:setMode', mode)
    },
    // 🧠 WAVE 10: Brain metrics subscription
    onBrainMetrics: (callback: (metrics: {
      connected: boolean
      mode: 'reactive' | 'intelligent'
      energy: number
      confidence: number
      beautyScore: number
      framesProcessed: number
      patternsLearned: number
      sessionPatterns: number
      memoryUsage: number
      sessionId: string | null
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, metrics: any) => callback(metrics)
      ipcRenderer.on('selene:brain-metrics', handler)
      return () => ipcRenderer.removeListener('selene:brain-metrics', handler)
    },
    // 🧠 WAVE 10: Decision log entries
    onDecisionLog: (callback: (entry: {
      type: string
      message: string
      data?: any
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, entry: any) => callback(entry)
      ipcRenderer.on('selene:decision-log', handler)
      return () => ipcRenderer.removeListener('selene:decision-log', handler)
    },
    // 🧠 WAVE 10: Get brain stats on demand
    getBrainStats: () => ipcRenderer.invoke('selene:getBrainStats'),
  },

  // ============================================
  // CONTROLS
  // ============================================
  controls: {
    setPalette: (paletteId: string) => ipcRenderer.invoke('controls:setPalette', paletteId),
    triggerEffect: (effectId: string) => ipcRenderer.invoke('controls:triggerEffect', effectId),
    setBlackout: (active: boolean) => ipcRenderer.invoke('controls:setBlackout', active),
    setMovement: (params: Record<string, number>) => ipcRenderer.invoke('controls:setMovement', params),
  },
}

// ============================================================================
// 🌙 LUX API - Selene Lux Core Bridge (WAVE 2)
// ============================================================================
const luxApi = {
  // === CONTROL ===
  /** Iniciar el motor Selene */
  start: () => ipcRenderer.invoke('lux:start'),
  
  /** Detener el motor Selene */
  stop: () => ipcRenderer.invoke('lux:stop'),
  
  /** Cambiar paleta de colores - Acepta IDs canónicos del ColorEngine */
  setPalette: (paletteId: string) => ipcRenderer.invoke('lux:set-palette', paletteId),
  
  /** Configurar movimiento */
  setMovement: (config: { pattern?: string; speed?: number; intensity?: number }) => 
    ipcRenderer.invoke('lux:set-movement', config),
  
  /** 🎚️ WAVE 13.6: Cambiar modo Selene (flow, selene, locked) */
  setMode: (mode: 'flow' | 'selene' | 'locked') => ipcRenderer.invoke('selene:setMode', mode),
  
  /** 🎨 WAVE 13.6: Multiplicadores Globales de Color (saturation, intensity) */
  setGlobalColorParams: (params: { saturation?: number; intensity?: number }) => 
    ipcRenderer.invoke('lux:set-global-color-params', params),
  
  /** Disparar un efecto */
  triggerEffect: (effectName: string, params?: Record<string, any>, duration?: number) =>
    ipcRenderer.invoke('lux:trigger-effect', { effectName, params, duration }),
  
  /** Cancelar efecto por ID o nombre */
  cancelEffect: (effectIdOrName: number | string) => ipcRenderer.invoke('lux:cancel-effect', effectIdOrName),
  
  /** Cancelar todos los efectos */
  cancelAllEffects: () => ipcRenderer.invoke('lux:cancel-all-effects'),
  
  /** Blackout master - todas las luces apagadas */
  setBlackout: (active: boolean) => ipcRenderer.invoke('lux:set-blackout', active),
  
  /** 🗡️ WAVE 15.3 REAL: Enviar buffer de audio CRUDO a Trinity
   * Este es el ÚNICO camino válido. El buffer pasa por Beta (FFT) antes de llegar a Gamma.
   */
  audioBuffer: (buffer: Float32Array) => 
    ipcRenderer.invoke('lux:audio-buffer', buffer.buffer),
  
  /** Legacy: Simular frame de audio (NO alimenta Trinity Workers) */
  audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm: number }) =>
    ipcRenderer.invoke('lux:audio-frame', metrics),
  
  /** Obtener estado actual */
  getState: () => ipcRenderer.invoke('lux:get-state'),
  
  /** 🎯 WAVE 13.6: Obtener estado COMPLETO del Backend (DMX, Selene, Fixtures, Audio) */
  getFullState: () => ipcRenderer.invoke('lux:get-full-state'),
  
  // === EVENTOS ===
  /** Suscribirse a actualizaciones de estado (30fps) */
  onStateUpdate: (callback: (state: SeleneStateUpdate) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: SeleneStateUpdate) => callback(state)
    ipcRenderer.on('lux:state-update', handler)
    
    // Retornar función para desuscribirse
    return () => {
      ipcRenderer.removeListener('lux:state-update', handler)
    }
  },
  
  /** Suscribirse a cambios de paleta */
  onPaletteChange: (callback: (paletteId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('lux:palette-change', handler)
    return () => ipcRenderer.removeListener('lux:palette-change', handler)
  },
  
  /** Suscribirse a eventos de efectos */
  onEffectTriggered: (callback: (effectName: string, effectId: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { name: string; id: number }) => 
      callback(data.name, data.id)
    ipcRenderer.on('lux:effect-triggered', handler)
    return () => ipcRenderer.removeListener('lux:effect-triggered', handler)
  },
  
  /** 🎯 WAVE 13.6: Suscribirse a cambios de modo confirmados por el Backend */
  onModeChange: (callback: (data: { mode: string; brain: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { mode: string; brain: boolean }) => 
      callback(data)
    ipcRenderer.on('selene:mode-changed', handler)
    return () => ipcRenderer.removeListener('selene:mode-changed', handler)
  },

  /** 📡 WAVE-14: Suscribirse a telemetría en tiempo real (20 FPS) */
  onTelemetryUpdate: (callback: (packet: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, packet: any) => callback(packet)
    ipcRenderer.on('selene:telemetry-update', handler)
    return () => ipcRenderer.removeListener('selene:telemetry-update', handler)
  },
  
  /** 📡 WAVE 15.3: TRUTH CABLE - Datos reales de Trinity Workers */
  onAudioAnalysis: (callback: (analysis: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, analysis: any) => callback(analysis)
    ipcRenderer.on('trinity:audio-analysis', handler)
    return () => ipcRenderer.removeListener('trinity:audio-analysis', handler)
  },
  
  /** 📡 WAVE 15.3: TRUTH CABLE - Decisiones reales de Gamma */
  onLightingDecision: (callback: (decision: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, decision: any) => callback(decision)
    ipcRenderer.on('trinity:lighting-decision', handler)
    return () => ipcRenderer.removeListener('trinity:lighting-decision', handler)
  },
  
  /** 🌙 WAVE 25: UNIVERSAL TRUTH PROTOCOL - La Verdad Única a 30fps
   * Este es el ÚNICO canal que el Frontend necesita para renderizar TODO.
   * Reemplaza: telemetry-update, state-update, brain-metrics
   */
  onTruthUpdate: (callback: (data: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('selene:truth', handler)
    return () => ipcRenderer.removeListener('selene:truth', handler)
  },
  
  /** � WAVE 25.7: THE CHRONICLER - Log events via dedicated channel
   * Logs llegan por canal separado para no interferir con el broadcast de 30fps
   */
  onLog: (callback: (logEntry: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, logEntry: any) => callback(logEntry)
    ipcRenderer.on('selene:log', handler)
    return () => ipcRenderer.removeListener('selene:log', handler)
  },
  
  /** �📡 WAVE-14: Establecer Input Gain */
  setInputGain: (value: number) => ipcRenderer.invoke('lux:set-input-gain', value),
  
  /** 🎨 WAVE-14.5: Forzar mutación de paleta */
  forceMutate: () => ipcRenderer.invoke('selene:force-mutate'),
  
  /** 🧠 WAVE-14.5: Resetear memoria de Selene */
  resetMemory: () => ipcRenderer.invoke('selene:reset-memory'),

  // ============================================
  // WAVE 9.5: FIXTURES
  // ============================================
  
  /** Escanear carpeta de fixtures */
  scanFixtures: (customPath?: string) => 
    ipcRenderer.invoke('lux:scan-fixtures', customPath),
  
  /** Obtener biblioteca de fixtures */
  getFixtureLibrary: () => 
    ipcRenderer.invoke('lux:get-fixture-library'),
  
  /** Obtener fixtures patcheados */
  getPatchedFixtures: () => 
    ipcRenderer.invoke('lux:get-patched-fixtures'),
  
  /** Añadir fixture al patch */
  patchFixture: (fixtureId: string, dmxAddress: number, universe?: number) =>
    ipcRenderer.invoke('lux:patch-fixture', { fixtureId, dmxAddress, universe }),
  
  /** Eliminar fixture del patch */
  unpatchFixture: (dmxAddress: number) =>
    ipcRenderer.invoke('lux:unpatch-fixture', dmxAddress),
  
  /** 🔬 WAVE 10.5: Forzar tipo de fixture manualmente */
  forceFixtureType: (dmxAddress: number, newType: string) =>
    ipcRenderer.invoke('lux:force-fixture-type', dmxAddress, newType),
  
  /** 🎯 WAVE 12.5: Selector de Montaje (ceiling/floor) */
  setInstallationType: (type: 'ceiling' | 'floor') =>
    ipcRenderer.invoke('lux:set-installation', type),
  
  /** Limpiar todo el patch */
  clearPatch: () => 
    ipcRenderer.invoke('lux:clear-patch'),
  
  /** 🎭 WAVE 10.6: Nuevo show - reset completo */
  newShow: () =>
    ipcRenderer.invoke('lux:new-show'),
  
  // ============================================
  // WAVE 9.5: CONFIG
  // ============================================
  
  /** Obtener configuración */
  getConfig: () => 
    ipcRenderer.invoke('lux:get-config'),
  
  /** Guardar configuración */
  saveConfig: (config: Record<string, any>) =>
    ipcRenderer.invoke('lux:save-config', config),
  
  /** Resetear configuración */
  resetConfig: () =>
    ipcRenderer.invoke('lux:reset-config'),
}

// 🎯 WAVE 13.6: STATE OF TRUTH - Exponer ipcRenderer para suscripciones a eventos
const electronAPI = {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

// Exponer las APIs al renderer
contextBridge.exposeInMainWorld('luxsync', api)
contextBridge.exposeInMainWorld('lux', luxApi)
contextBridge.exposeInMainWorld('electron', electronAPI)

// Tipos para TypeScript en el renderer
export type LuxSyncAPI = typeof api
export type LuxAPI = typeof luxApi
export type ElectronAPI = typeof electronAPI
