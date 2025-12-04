/**
 * 🎵 AUDIO STORE - Audio Input & Metrics
 * WAVE 9: Estado del audio y métricas en tiempo real
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export interface AudioDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface AudioState {
  // Device
  deviceId: string | null
  deviceName: string | null
  isConnected: boolean
  availableDevices: AudioDevice[]
  
  // Real-time metrics
  bpm: number
  bpmConfidence: number  // 0-1
  level: number          // dB (-60 to 0)
  
  // Spectrum bands
  bass: number           // 0-1
  mid: number            // 0-1
  treble: number         // 0-1
  
  // Beat detection
  onBeat: boolean
  beatCount: number
  lastBeatTime: number
  
  // Sensitivity
  sensitivity: number    // 0-1
  
  // Actions
  setDevice: (id: string, name: string) => void
  disconnect: () => void
  setAvailableDevices: (devices: AudioDevice[]) => void
  updateMetrics: (metrics: Partial<AudioState>) => void
  setSensitivity: (sensitivity: number) => void
  registerBeat: () => void
  reset: () => void
}

// ============================================
// STORE
// ============================================

export const useAudioStore = create<AudioState>((set, get) => ({
  // Initial state
  deviceId: null,
  deviceName: null,
  isConnected: false,
  availableDevices: [],
  bpm: 120,
  bpmConfidence: 0,
  level: -60,
  bass: 0,
  mid: 0,
  treble: 0,
  onBeat: false,
  beatCount: 0,
  lastBeatTime: 0,
  sensitivity: 0.5,
  
  // Actions
  setDevice: (id, name) => {
    set({
      deviceId: id,
      deviceName: name,
      isConnected: true,
    })
  },
  
  disconnect: () => {
    set({
      deviceId: null,
      deviceName: null,
      isConnected: false,
      level: -60,
      bass: 0,
      mid: 0,
      treble: 0,
      onBeat: false,
    })
  },
  
  setAvailableDevices: (devices) => {
    set({ availableDevices: devices })
  },
  
  updateMetrics: (metrics) => {
    set(metrics)
  },
  
  setSensitivity: (sensitivity) => {
    set({ sensitivity: Math.max(0, Math.min(1, sensitivity)) })
  },
  
  registerBeat: () => {
    set((state) => ({
      onBeat: true,
      beatCount: state.beatCount + 1,
      lastBeatTime: Date.now(),
    }))
    
    // Auto-reset onBeat after 100ms
    setTimeout(() => {
      set({ onBeat: false })
    }, 100)
  },
  
  reset: () => {
    set({
      bpm: 120,
      bpmConfidence: 0,
      level: -60,
      bass: 0,
      mid: 0,
      treble: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
    })
  },
}))
