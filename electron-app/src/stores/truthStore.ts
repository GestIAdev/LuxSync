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

// 🛡️ WAVE 2042.13.11: Exported for stable selectors in useSeleneTruth.ts
export interface TruthState {
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

/** 
 * 🛡️ WAVE 2042.13.12: Individual rhythm selectors (primitives - no object creation)
 * Use these instead of selectRhythm to avoid infinite re-renders in React 19
 */
export const selectBPM = (state: TruthState) => state.truth.context.bpm
export const selectSyncopation = (state: TruthState) => state.truth.context.syncopation
export const selectBeatPhase = (state: TruthState) => state.truth.context.beatPhase
export const selectRhythmConfidence = (state: TruthState) => state.truth.context.confidence

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
 * �️ WAVE 2042.13.12: Fixed - returns direct reference, useShallow handles comparison
 * DO NOT create new objects/arrays here - it breaks React 19's getSnapshot caching
 */
export const selectHardware = (state: TruthState) => state.truth.hardware

/** 
 * Selector: Master Intensity (from intent)
 * 🛡️ WAVE 2042.13.12: Returns primitive to avoid new object creation
 * For saturation, use palette directly - it's always derived from palette now
 */
export const selectMasterIntensity = (state: TruthState) => state.truth.intent.masterIntensity

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

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.12: REACT 19 FIX - Stable Hooks
// ═══════════════════════════════════════════════════════════════════════════
/**
 * useShallow wrapper for selectHardware to prevent infinite loops in React 19.
 * 
 * PROBLEM: selectHardware returns new object/array every call → React 19 infinite loop
 * SOLUTION: useShallow hook provides stable reference
 * 
 * USE THIS instead of: useTruthStore(selectHardware)
 */
import { useShallow } from 'zustand/shallow'

export const useHardware = () => {
  return useTruthStore(useShallow(selectHardware))
}

/**
 * 🛡️ WAVE 2042.13.12: Changed to return primitive intensity value
 * If components need { intensity, saturation } object, destructure from intent directly
 */
export const useMasterIntensity = () => {
  return useTruthStore(selectMasterIntensity) // Primitive - no useShallow needed
}

// DEPRECATED: useColorParams - use useMasterIntensity instead
// Keeping for backwards compatibility but will cause warnings
export const useColorParams = () => {
  console.warn('useColorParams is deprecated. Use useMasterIntensity() instead.')
  const intensity = useTruthStore(selectMasterIntensity)
  return { intensity, saturation: 1 }
}

export const useAudio = () => {
  return useTruthStore(useShallow(selectAudio))
}

export const useBeat = () => {
  return useTruthStore(useShallow(selectBeat))
}

/**
 * 🛡️ WAVE 2042.13.12: Returns individual primitive hooks
 * Creating an object here would cause infinite re-renders in React 19
 * If you need all rhythm values, call each hook individually
 */
export const useBPM = () => useTruthStore(selectBPM)
export const useSyncopation = () => useTruthStore(selectSyncopation)
export const useBeatPhase = () => useTruthStore(selectBeatPhase)
export const useRhythmConfidence = () => useTruthStore(selectRhythmConfidence)

// DEPRECATED: useRhythm - use individual hooks instead
// Keeping for backwards compatibility with console warning
export const useRhythm = () => {
  console.warn('useRhythm is deprecated. Use useBPM(), useSyncopation(), useBeatPhase() instead.')
  const bpm = useTruthStore(selectBPM)
  const syncopation = useTruthStore(selectSyncopation)
  const beatPhase = useTruthStore(selectBeatPhase)
  const confidence = useTruthStore(selectRhythmConfidence)
  return { bpm, syncopation, beatPhase, confidence }
}

export const useCognitive = () => {
  return useTruthStore(useShallow(selectCognitive))
}

export const useSection = () => {
  return useTruthStore(useShallow(selectSection))
}

// ═══════════════════════════════════════════════════════════════════════════

// Exponer en window para debugging desde consola
if (typeof window !== 'undefined') {
  (window as any).debugTruth = debugTruth
  ;(window as any).getTruthStore = () => useTruthStore.getState()
}
