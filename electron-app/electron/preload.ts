/**
 * 🔌 LUXSYNC ELECTRON - PRELOAD SCRIPT
 * Puente seguro entre Main y Renderer
 */

import { contextBridge, ipcRenderer } from 'electron'

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

// Exponer la API al renderer
contextBridge.exposeInMainWorld('luxsync', api)

// Tipos para TypeScript en el renderer
export type LuxSyncAPI = typeof api
