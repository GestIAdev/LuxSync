/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 TRUTH STORE - WAVE 25: UNIVERSAL TRUTH PROTOCOL
 * "El Nuevo Corazón de la UI"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este store es ESTÚPIDO a propósito.
 * NO calcula nada. NO tiene efectos complejos. NO traduce datos.
 * 
 * Solo hace UNA cosa:
 * - Recibe SeleneBroadcast del backend
 * - Lo guarda
 * - Los componentes lo leen
 * 
 * FIN.
 * 
 * Esto elimina:
 * - Race conditions
 * - Loops de actualización
 * - Blackouts anómalos
 * - Confusión HSL/RGB
 * - 8 stores separados
 * 
 * @module stores/truthStore
 * @version 25.0.0
 */

import { create } from 'zustand'
import { 
  SeleneBroadcast, 
  createDefaultBroadcast,
  isSeleneBroadcast 
} from '../types/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TruthState {
  /** 🌙 La Verdad Universal - TODO el estado de Selene */
  truth: SeleneBroadcast
  
  /** Contador de frames recibidos (para debug) */
  framesReceived: number
  
  /** Timestamp del último update */
  lastUpdate: number
  
  /** ¿Está conectado al backend? */
  isConnected: boolean
  
  /** Actualizar la verdad (llamado por useSeleneTruth) */
  setTruth: (data: SeleneBroadcast) => void
  
  /** Marcar conexión */
  setConnected: (connected: boolean) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useTruthStore = create<TruthState>((set) => ({
  // Estado inicial seguro (sin nulls, sin undefined, sin NaN)
  truth: createDefaultBroadcast(),
  framesReceived: 0,
  lastUpdate: 0,
  isConnected: false,
  
  // El setter más simple del mundo
  setTruth: (data) => {
    // Validación mínima para evitar crashes
    if (!isSeleneBroadcast(data)) {
      console.warn('[TruthStore] ⚠️ Invalid broadcast received, ignoring')
      return
    }
    
    set((state) => ({
      truth: data,
      framesReceived: state.framesReceived + 1,
      lastUpdate: Date.now(),
      isConnected: true,
    }))
  },
  
  setConnected: (connected) => set({ isConnected: connected }),
}))

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (Para optimizar re-renders)
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: Audio data */
export const selectAudio = (state: TruthState) => state.truth.sensory.audio

/** Selector: Beat data */
export const selectBeat = (state: TruthState) => state.truth.sensory.beat

/** Selector: Palette (colores unificados) */
export const selectPalette = (state: TruthState) => state.truth.visualDecision.palette

/** Selector: Genre */
export const selectGenre = (state: TruthState) => state.truth.musicalDNA.genre

/** Selector: Section */
export const selectSection = (state: TruthState) => state.truth.musicalDNA.section

/** Selector: Rhythm */
export const selectRhythm = (state: TruthState) => state.truth.musicalDNA.rhythm

/** Selector: Movement */
export const selectMovement = (state: TruthState) => state.truth.visualDecision.movement

/** Selector: Effects */
export const selectEffects = (state: TruthState) => state.truth.visualDecision.effects

/** Selector: System metadata */
export const selectSystem = (state: TruthState) => state.truth.system

/** Selector: Cognitive (mood, dreams, zodiac) */
export const selectCognitive = (state: TruthState) => state.truth.cognitive

/** Selector: Prediction */
export const selectPrediction = (state: TruthState) => state.truth.musicalDNA.prediction

/** Selector: Hardware state */
export const selectHardware = (state: TruthState) => state.truth.hardwareState

/** Selector: Intensity & Saturation */
export const selectColorParams = (state: TruthState) => ({
  intensity: state.truth.visualDecision.intensity,
  saturation: state.truth.visualDecision.saturation,
})

/** Selector: FPS tracking */
export const selectFPS = (state: TruthState) => state.truth.system.actualFPS

/** Selector: Mode (selene/flow/manual) */
export const selectMode = (state: TruthState) => state.truth.system.mode

/** Selector: Brain status */
export const selectBrainStatus = (state: TruthState) => state.truth.system.brainStatus

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════

/** Log current state (for console debugging) */
export const debugTruth = () => {
  const state = useTruthStore.getState()
  console.log('🌙 TRUTH STATE:', {
    framesReceived: state.framesReceived,
    isConnected: state.isConnected,
    lastUpdate: new Date(state.lastUpdate).toISOString(),
    mode: state.truth.system.mode,
    fps: state.truth.system.actualFPS,
    energy: state.truth.sensory.audio.energy.toFixed(3),
    genre: state.truth.musicalDNA.genre.primary,
    section: state.truth.musicalDNA.section.current,
    palette: state.truth.visualDecision.palette.description,
  })
  return state.truth
}

// Exponer en window para debugging desde consola
if (typeof window !== 'undefined') {
  (window as any).debugTruth = debugTruth
  ;(window as any).getTruthStore = () => useTruthStore.getState()
}
