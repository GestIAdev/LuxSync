/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 TRUTH STORE - WAVE 248: TITAN 2.0 FUSION
 * "El Nuevo Corazón de la UI"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este store es ESTÚPIDO a propósito.
 * NO calcula nada. NO tiene efectos complejos. NO traduce datos.
 * 
 * Solo hace UNA cosa:
 * - Recibe SeleneTruth del backend
 * - Lo guarda
 * - Los componentes lo leen
 * 
 * FIN.
 * 
 * WAVE 248: Migrado de SeleneBroadcast (V1) a SeleneTruth (TITAN 2.0)
 * - Nuevo import desde core/protocol/SeleneProtocol
 * - Selectores remapeados a la nueva estructura
 * 
 * @module stores/truthStore
 * @version 248.0.0
 */

import { create } from 'zustand'
import { 
  SeleneTruth, 
  createDefaultTruth,
  isSeleneTruth 
} from '../core/protocol/SeleneProtocol'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TruthState {
  /** 🌙 La Verdad Universal - TODO el estado de Selene */
  truth: SeleneTruth
  
  /** Contador de frames recibidos (para debug) */
  framesReceived: number
  
  /** Timestamp del último update */
  lastUpdate: number
  
  /** ¿Está conectado al backend? */
  isConnected: boolean
  
  /** Actualizar la verdad (llamado por useSeleneTruth) */
  setTruth: (data: SeleneTruth) => void
  
  /** Marcar conexión */
  setConnected: (connected: boolean) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useTruthStore = create<TruthState>((set) => ({
  // Estado inicial seguro (sin nulls, sin undefined, sin NaN)
  truth: createDefaultTruth(),
  framesReceived: 0,
  lastUpdate: 0,
  isConnected: false,
  
  // El setter más simple del mundo
  setTruth: (data) => {
    // Validación mínima para evitar crashes
    if (!isSeleneTruth(data)) {
      console.warn('[TruthStore] ⚠️ Invalid truth received, ignoring')
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
// SELECTORS (WAVE 248: Remapeados a nueva estructura SeleneTruth)
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: Audio data (from sensory layer) */
export const selectAudio = (state: TruthState) => state.truth.sensory.audio

/** Selector: Beat data (from sensory layer) */
export const selectBeat = (state: TruthState) => state.truth.sensory.beat

/** Selector: Palette (from intent layer) */
export const selectPalette = (state: TruthState) => state.truth.intent.palette

/** Selector: Genre (from context layer) */
export const selectGenre = (state: TruthState) => state.truth.context.genre

/** Selector: Section (from context layer) */
export const selectSection = (state: TruthState) => state.truth.context.section

/** Selector: Rhythm info (from context layer - bpm, syncopation, beatPhase) */
export const selectRhythm = (state: TruthState) => ({
  bpm: state.truth.context.bpm,
  syncopation: state.truth.context.syncopation,
  beatPhase: state.truth.context.beatPhase,
  confidence: state.truth.context.confidence
})

/** Selector: Movement (from intent layer) */
export const selectMovement = (state: TruthState) => state.truth.intent.movement

/** Selector: Effects (from intent layer) */
export const selectEffects = (state: TruthState) => state.truth.intent.effects

/** Selector: System metadata */
export const selectSystem = (state: TruthState) => state.truth.system

/** Selector: Consciousness (mood, dreams, zodiac, evolution) */
export const selectConsciousness = (state: TruthState) => state.truth.consciousness

/** Selector: Cognitive - ALIAS for backwards compat */
export const selectCognitive = selectConsciousness

/** Selector: Musical Context */
export const selectContext = (state: TruthState) => state.truth.context

/** 
 * Selector: Hardware state
 * 🔧 WAVE 347.8: Returns a SHALLOW COPY to force React re-renders
 * The backend mutates fixture properties (pan, tilt) but keeps same array reference
 * By returning { ...hardware, fixtures: [...fixtures] }, we ensure React detects changes
 */
export const selectHardware = (state: TruthState) => {
  const hardware = state.truth.hardware
  // Force new reference for fixtures array so React re-renders
  return hardware ? { ...hardware, fixtures: [...(hardware.fixtures || [])] } : hardware
}

/** Selector: Intensity & Saturation (from intent) */
export const selectColorParams = (state: TruthState) => ({
  intensity: state.truth.intent.masterIntensity,
  saturation: 1, // WAVE 248: saturation ahora es parte de palette
})

/** Selector: FPS tracking */
export const selectFPS = (state: TruthState) => state.truth.system.actualFPS

/** Selector: Mode (selene/flow/manual/locked) */
export const selectMode = (state: TruthState) => state.truth.system.mode

/** Selector: Brain status (current mood) */
export const selectBrainStatus = (state: TruthState) => state.truth.system.brainStatus

/** Selector: Vibe (from consciousness layer) */
export const selectVibe = (state: TruthState) => state.truth.consciousness.vibe

/** Selector: Dream state */
export const selectDream = (state: TruthState) => state.truth.consciousness.dream

/** Selector: Zodiac affinity */
export const selectZodiac = (state: TruthState) => state.truth.consciousness.zodiac

/** Selector: Beauty metrics */
export const selectBeauty = (state: TruthState) => state.truth.consciousness.beauty

/** Selector: Evolution state */
export const selectEvolution = (state: TruthState) => state.truth.consciousness.evolution

/** Selector: Drop state */
export const selectDropState = (state: TruthState) => state.truth.consciousness.dropState

// ═══════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════

/** Log current state (for console debugging) */
export const debugTruth = () => {
  const state = useTruthStore.getState()
  console.log('🌙 TRUTH STATE (TITAN 2.0):', {
    framesReceived: state.framesReceived,
    isConnected: state.isConnected,
    lastUpdate: new Date(state.lastUpdate).toISOString(),
    mode: state.truth.system.mode,
    vibe: state.truth.system.vibe,
    fps: state.truth.system.actualFPS,
    energy: state.truth.sensory.audio.energy.toFixed(3),
    genre: state.truth.context.genre?.macro ?? 'UNKNOWN',
    section: state.truth.context.section?.type ?? 'unknown',
    mood: state.truth.consciousness.mood,
    dreamActive: state.truth.consciousness.dream.isActive,
  })
  return state.truth
}

// Exponer en window para debugging desde consola
if (typeof window !== 'undefined') {
  (window as any).debugTruth = debugTruth
  ;(window as any).getTruthStore = () => useTruthStore.getState()
}
