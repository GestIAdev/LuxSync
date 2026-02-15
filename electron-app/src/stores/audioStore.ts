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
  
  // Sensitivity & Gain
  sensitivity: number    // 0-1
  inputGain: number      // 🎯 WAVE 14: Multiplicador de ganancia (1.0 = 100%, 2.0 = 200%)
  
  // Actions
  setDevice: (id: string, name: string) => void
  disconnect: () => void
  setAvailableDevices: (devices: AudioDevice[]) => void
  updateMetrics: (metrics: Partial<AudioState>) => void
  setSensitivity: (sensitivity: number) => void
  setInputGain: (gain: number) => void  // 🎯 WAVE 14
  registerBeat: () => void
  reset: () => void
}

// ============================================
// STORE
// ============================================

export const useAudioStore = create<AudioState>((set, get) => ({
  // Initial state - 🚑 RESCUE DIRECTIVE: No mock BPM
  deviceId: null,
  deviceName: null,
  isConnected: false,
  availableDevices: [],
  bpm: 0,
  bpmConfidence: 0,
  level: -60,
  bass: 0,
  mid: 0,
  treble: 0,
  onBeat: false,
  beatCount: 0,
  lastBeatTime: 0,
  sensitivity: 0.5,
  inputGain: 1.0,  // 🎯 WAVE 14: Default = 100% (sin boost)
  
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
  
  setInputGain: (gain) => {  // 🎯 WAVE 14
    set({ inputGain: Math.max(0.1, Math.min(4.0, gain)) }) // 10% - 400%
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
      bpm: 0, // 🚑 RESCUE DIRECTIVE: No mock BPM
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

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13.4: REACT 19 FIX - Stable Selectors
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: Audio metrics for display/sync */
export const selectAudioMetrics = (state: AudioState) => ({
  isConnected: state.isConnected,
  bass: state.bass,
  mid: state.mid,
  treble: state.treble,
  bpm: state.bpm,
  onBeat: state.onBeat,
})

/** Selector: HyperionView - BPM display only */
export const selectHyperionAudio = (state: AudioState) => ({
  bpm: state.bpm,
  bpmConfidence: state.bpmConfidence,
  onBeat: state.onBeat,
})

/** Selector: setInputGain function only (for useDevicePersistence) */
export const selectSetInputGain = (state: AudioState) => state.setInputGain

/** Selector: TrinityProvider - update functions only */
export const selectTrinityAudioActions = (state: AudioState) => ({
  updateMetrics: state.updateMetrics,
  registerBeat: state.registerBeat,
})

// ═══════════════════════════════════════════════════════════════════════════
