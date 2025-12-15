/**
 * 🧠 SETUP STORE - The Command Center Brain
 * WAVE 26 Phase 1: Dashboard Híbrido Navigation & Config State
 * 
 * Gestiona:
 * - Navegación entre tabs (devices/patch/library)
 * - Estado temporal de configuración (no persiste hasta "Save")
 * - Cache visual para evitar parpadeos al cambiar tabs
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type SetupTab = 'devices' | 'patch' | 'library'

export interface DetectedPort {
  path: string
  manufacturer?: string
  vendorId?: string
  productId?: string
  confidence: number
  chipType?: string
}

export interface AudioDeviceInfo {
  id: string
  name: string
  isDefault: boolean
}

export interface SetupState {
  // === TAB NAVIGATION ===
  activeTab: SetupTab
  setActiveTab: (tab: SetupTab) => void
  
  // === AUDIO CONFIG (Visual Cache) ===
  audioDeviceId: string | null
  audioDeviceName: string | null
  audioSource: 'microphone' | 'system' | 'simulation' | null
  setAudioDevice: (id: string, name: string) => void
  setAudioSource: (source: 'microphone' | 'system' | 'simulation') => void
  
  // === DMX CONFIG (Visual Cache) ===
  dmxDriver: string | null           // 'usb-serial' | 'artnet' | 'virtual'
  dmxComPort: string | null          // e.g., 'COM3'
  dmxChipType: string | null         // e.g., 'FTDI'
  setDmxDriver: (driver: string) => void
  setDmxPort: (port: string, chip?: string) => void
  
  // === DETECTED DEVICES (Scan Results) ===
  detectedDmxPorts: DetectedPort[]
  detectedAudioDevices: AudioDeviceInfo[]
  setDetectedDmxPorts: (ports: DetectedPort[]) => void
  setDetectedAudioDevices: (devices: AudioDeviceInfo[]) => void
  
  // === STATUS FLAGS ===
  isDmxScanning: boolean
  isAudioScanning: boolean
  setDmxScanning: (scanning: boolean) => void
  setAudioScanning: (scanning: boolean) => void
  
  // === DIRTY STATE ===
  hasUnsavedChanges: boolean
  markDirty: () => void
  markClean: () => void
  
  // === CURRENT SHOW ===
  currentShowName: string
  setCurrentShowName: (name: string) => void
  
  // === RESET ===
  reset: () => void
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
  activeTab: 'devices' as SetupTab,
  
  audioDeviceId: null,
  audioDeviceName: null,
  audioSource: null,
  
  dmxDriver: null,
  dmxComPort: null,
  dmxChipType: null,
  
  detectedDmxPorts: [],
  detectedAudioDevices: [],
  
  isDmxScanning: false,
  isAudioScanning: false,
  
  hasUnsavedChanges: false,
  
  currentShowName: 'Default',
}

// ============================================
// STORE
// ============================================

export const useSetupStore = create<SetupState>((set) => ({
  ...initialState,
  
  // === TAB NAVIGATION ===
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // === AUDIO ===
  setAudioDevice: (id, name) => set({ 
    audioDeviceId: id, 
    audioDeviceName: name,
    hasUnsavedChanges: true 
  }),
  
  setAudioSource: (source) => set({ 
    audioSource: source,
    hasUnsavedChanges: true 
  }),
  
  // === DMX ===
  setDmxDriver: (driver) => set({ 
    dmxDriver: driver,
    hasUnsavedChanges: true 
  }),
  
  setDmxPort: (port, chip) => set({ 
    dmxComPort: port, 
    dmxChipType: chip ?? null,
    hasUnsavedChanges: true 
  }),
  
  // === DETECTED DEVICES ===
  setDetectedDmxPorts: (ports) => set({ detectedDmxPorts: ports }),
  setDetectedAudioDevices: (devices) => set({ detectedAudioDevices: devices }),
  
  // === STATUS FLAGS ===
  setDmxScanning: (scanning) => set({ isDmxScanning: scanning }),
  setAudioScanning: (scanning) => set({ isAudioScanning: scanning }),
  
  // === DIRTY STATE ===
  markDirty: () => set({ hasUnsavedChanges: true }),
  markClean: () => set({ hasUnsavedChanges: false }),
  
  // === CURRENT SHOW ===
  setCurrentShowName: (name) => set({ currentShowName: name }),
  
  // === RESET ===
  reset: () => set(initialState),
}))

// ============================================
// SELECTORS (for optimized re-renders)
// ============================================

export const selectActiveTab = (state: SetupState) => state.activeTab
export const selectDmxConfig = (state: SetupState) => ({
  driver: state.dmxDriver,
  comPort: state.dmxComPort,
  chipType: state.dmxChipType,
})
export const selectAudioConfig = (state: SetupState) => ({
  deviceId: state.audioDeviceId,
  deviceName: state.audioDeviceName,
  source: state.audioSource,
})
