/**
 * 🧠 SETUP STORE - Device Configuration State
 * WAVE 370: UI LEGACY PURGE - Tabs eliminated, Devices only
 * 
 * Manages:
 * - Audio configuration (source selection)
 * - DMX configuration (driver, port)
 * - Device detection cache
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

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
  
  // === RESET ===
  reset: () => void
}

// ============================================
// INITIAL STATE
// ============================================

const initialState = {
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
}

// ============================================
// STORE
// ============================================

export const useSetupStore = create<SetupState>((set) => ({
  ...initialState,
  
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
  
  // === RESET ===
  reset: () => set(initialState),
}))

// ============================================
// SELECTORS (for optimized re-renders)
// ============================================

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

// 🛡️ WAVE 2042.13.2: React 19 stable selector for UsbDmxPanel
export const selectUsbDmxPanel = (state: SetupState) => ({
  dmxComPort: state.dmxComPort,
  detectedDmxPorts: state.detectedDmxPorts,
  isDmxScanning: state.isDmxScanning,
  setDmxPort: state.setDmxPort,
  setDetectedDmxPorts: state.setDetectedDmxPorts,
  setDmxScanning: state.setDmxScanning,
})
