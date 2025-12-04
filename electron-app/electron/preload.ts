/**
 * 🔌 LUXSYNC ELECTRON - PRELOAD SCRIPT
 * Puente seguro entre Main y Renderer
 * 
 * V2.0: Añadido window.lux para comunicación con Selene Lux Core
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
  // DMX
  // ============================================
  dmx: {
    getStatus: () => ipcRenderer.invoke('dmx:getStatus'),
    sendValues: (values: number[]) => ipcRenderer.invoke('dmx:send', values),
    onUpdate: (callback: (values: number[]) => void) => {
      ipcRenderer.on('dmx:update', (_, values) => callback(values))
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
  
  /** Disparar un efecto */
  triggerEffect: (effectName: string, params?: Record<string, any>, duration?: number) =>
    ipcRenderer.invoke('lux:trigger-effect', { effectName, params, duration }),
  
  /** Cancelar efecto */
  cancelEffect: (effectId: number) => ipcRenderer.invoke('lux:cancel-effect', effectId),
  
  /** Cancelar todos los efectos */
  cancelAllEffects: () => ipcRenderer.invoke('lux:cancel-all-effects'),
  
  /** Simular frame de audio */
  audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm: number }) =>
    ipcRenderer.invoke('lux:audio-frame', metrics),
  
  /** Obtener estado actual */
  getState: () => ipcRenderer.invoke('lux:get-state'),
  
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
  
  /** Limpiar todo el patch */
  clearPatch: () => 
    ipcRenderer.invoke('lux:clear-patch'),
  
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

// Exponer las APIs al renderer
contextBridge.exposeInMainWorld('luxsync', api)
contextBridge.exposeInMainWorld('lux', luxApi)

// Tipos para TypeScript en el renderer
export type LuxSyncAPI = typeof api
export type LuxAPI = typeof luxApi
