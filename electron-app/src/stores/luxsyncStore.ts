/**
 * 🧠 LUXSYNC STORE - Estado Global
 * Zustand para gestión de estado reactivo
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

// WAVE 422: 'flow' mode ELIMINATED - system is Auto-Override
export type SeleneMode = 'selene' | 'locked'
export type PaletteId = 'fire' | 'ice' | 'jungle' | 'neon'
export type MoodType = 'peaceful' | 'energetic' | 'chaotic' | 'harmonious' | 'building' | 'dropping'
export type EffectId = 'strobe' | 'blinder' | 'smoke' | 'laser' | 'rainbow' | 'police' | 'beam' | 'prism'
export type MovementPattern = 'lissajous' | 'circle' | 'wave' | 'figure8' | 'scan' | 'random'

export interface Palette {
  id: PaletteId
  name: string
  emoji: string
  description: string
  colors: string[]
  temperature: number // 0 = frío, 1 = cálido
}

export interface MovementParams {
  pattern: MovementPattern
  speed: number
  range: number
  scale: number
  chaos: number
  phase: number
  syncToBpm: boolean
  mirrorMode: boolean
  locked: {
    pattern: boolean
    speed: boolean
    range: boolean
    scale: boolean
    chaos: boolean
    phase: boolean
  }
}

export interface AudioState {
  bpm: number
  energy: number
  bass: number
  mid: number
  treble: number
  beatSync: boolean
}

export interface SeleneState {
  mode: SeleneMode
  mood: MoodType
  generation: number
  health: number
  lastInsight: string
}

// ============================================
// PALETTES DATA
// ============================================

export const PALETTES: Record<PaletteId, Palette> = {
  fire: {
    id: 'fire',
    name: 'Latino Heat',
    emoji: '🔥',
    description: 'Pasión, ritmo y energía',
    colors: ['#FF1744', '#FF6D00', '#FFD600', '#FF9100'],
    temperature: 0.8,
  },
  ice: {
    id: 'ice',
    name: 'Arctic Dreams',
    emoji: '❄️',
    description: 'Frío elegante y misterioso',
    colors: ['#00B8D4', '#00E5FF', '#FFFFFF', '#B388FF'],
    temperature: 0.2,
  },
  jungle: {
    id: 'jungle',
    name: 'Tropical Storm',
    emoji: '🌿',
    description: 'Naturaleza salvaje',
    colors: ['#00C853', '#64DD17', '#AEEA00', '#FFD600'],
    temperature: 0.5,
  },
  neon: {
    id: 'neon',
    name: 'Cyberpunk Night',
    emoji: '💜',
    description: 'Futuro oscuro y neón',
    colors: ['#E040FB', '#7C4DFF', '#00E5FF', '#FF1744'],
    temperature: 0.4,
  },
}

// ============================================
// MOVEMENT PATTERNS
// ============================================

export const MOVEMENT_PATTERNS = [
  { id: 'lissajous_8', name: 'LISSAJOUS 8', emoji: '∞' },
  { id: 'lissajous_circle', name: 'CIRCLE', emoji: '○' },
  { id: 'lissajous_rose', name: 'ROSE', emoji: '❀' },
  { id: 'sweep_horizontal', name: 'H-SWEEP', emoji: '↔' },
  { id: 'sweep_vertical', name: 'V-SWEEP', emoji: '↕' },
  { id: 'chase', name: 'CHASE', emoji: '🏃' },
  { id: 'random', name: 'RANDOM', emoji: '🎲' },
  { id: 'home', name: 'HOME', emoji: '🏠' },
]

// ============================================
// EFFECTS DATA
// ============================================

export interface Effect {
  id: EffectId
  label: string
  icon: string
  color: string
  keyBind: string
}

export const EFFECTS: Record<EffectId, Effect> = {
  // Optical Controls (Hold mode)
  beam: { id: 'beam', label: 'BEAM', icon: '🔦', color: '#00FFFF', keyBind: 'B' },
  prism: { id: 'prism', label: 'PRISM', icon: '💎', color: '#FF00FF', keyBind: 'P' },
  
  // Panic Buttons (Toggle mode)
  strobe: { id: 'strobe', label: 'STROBE', icon: '⚡', color: '#FFFFFF', keyBind: 'S' },
  blinder: { id: 'blinder', label: 'BLINDER', icon: '💡', color: '#FFD700', keyBind: 'L' },
  smoke: { id: 'smoke', label: 'SMOKE', icon: '💨', color: '#888888', keyBind: '3' },
  laser: { id: 'laser', label: 'LASER', icon: '🔴', color: '#FF0000', keyBind: '4' },
  rainbow: { id: 'rainbow', label: 'RAINBOW', icon: '🌈', color: '#FF69B4', keyBind: '5' },
  police: { id: 'police', label: 'POLICE', icon: '🚔', color: '#0066FF', keyBind: '6' },
}

// ============================================
// STORE DEFINITION
// ============================================

interface ColorsState {
  saturation: number
  intensity: number
}

interface EffectsState {
  active: Set<EffectId>
}

interface LuxSyncStore {
  // Selene
  selene: SeleneState & { confidence: number }
  setSeleneMode: (mode: SeleneMode) => void
  setSeleneMood: (mood: MoodType) => void

  // Palette
  activePalette: PaletteId
  colors: ColorsState
  setActivePalette: (id: PaletteId) => void
  setColorSaturation: (value: number) => void
  setColorIntensity: (value: number) => void

  // Movement
  movement: MovementParams
  setMovementPattern: (pattern: MovementPattern) => void
  setMovementSpeed: (value: number) => void
  setMovementRange: (value: number) => void
  toggleMovementLock: (param: 'pattern' | 'speed' | 'range' | 'scale' | 'chaos' | 'phase') => void

  // Effects
  effects: EffectsState
  toggleEffect: (effect: EffectId) => void
  triggerEffect: (effect: EffectId) => void
  setActiveEffects: (effects: Set<EffectId>) => void  // 🔥 WAVE 10.7: From backend

  // Blackout
  blackout: boolean
  setBlackout: (active: boolean) => void
  toggleBlackout: () => void

  // Audio
  audio: AudioState
  updateAudio: (data: Partial<AudioState>) => void

  // Master
  masterDimmer: number
  setMasterDimmer: (value: number) => void
}

export const useLuxSyncStore = create<LuxSyncStore>((set) => ({
  // ============================================
  // SELENE STATE
  // ============================================
  selene: {
    mode: 'selene' as SeleneMode, // WAVE 422: Default to AI control
    mood: 'harmonious' as MoodType,
    generation: 1,
    health: 1,
    confidence: 0.85,
    lastInsight: 'Sistema iniciado. Esperando audio...',
  },

  setSeleneMode: (mode: SeleneMode) => {
    // Update local state
    set((state) => ({
      selene: { ...state.selene, mode },
    }))
    
    // 🧠 WAVE 10: Call backend to actually switch modes!
    // API exposed via preload as window.luxsync.selene.setMode
    if (typeof window !== 'undefined' && window.luxsync?.selene?.setMode) {
      console.log('[Store] 🎚️ Sending mode to backend:', mode)
      window.luxsync.selene.setMode(mode)
    } else {
      console.warn('[Store] ⚠️ window.luxsync.selene.setMode not available')
    }
  },

  setSeleneMood: (mood: MoodType) =>
    set((state) => ({
      selene: { ...state.selene, mood },
    })),

  // ============================================
  // PALETTE STATE
  // ============================================
  activePalette: 'fire' as PaletteId,
  colors: {
    saturation: 1.0,  // 🎨 WAVE 13.6: STATE OF TRUTH - Default 100%
    intensity: 1.0,   // 💡 Default 100%
  },

  setActivePalette: (id: PaletteId) => set({ activePalette: id }),
  setColorSaturation: (value: number) => 
    set((state) => ({ 
      colors: { ...state.colors, saturation: value } 
    })),
  setColorIntensity: (value: number) => 
    set((state) => ({ 
      colors: { ...state.colors, intensity: value } 
    })),

  // ============================================
  // MOVEMENT STATE
  // ============================================
  movement: {
    pattern: 'lissajous' as MovementPattern,
    speed: 0.6,
    range: 0.8,
    scale: 0.8,
    chaos: 0.2,
    phase: 90,
    syncToBpm: true,
    mirrorMode: false,
    locked: {
      pattern: false,
      speed: true,
      range: false,
      scale: false,
      chaos: true, // ¡Importante lockear chaos por defecto!
      phase: false,
    },
  },

  setMovementPattern: (pattern: MovementPattern) =>
    set((state) => ({
      movement: { ...state.movement, pattern },
    })),

  setMovementSpeed: (value: number) =>
    set((state) => ({
      movement: { ...state.movement, speed: value },
    })),

  setMovementRange: (value: number) =>
    set((state) => ({
      movement: { ...state.movement, range: value },
    })),

  toggleMovementLock: (param: 'pattern' | 'speed' | 'range' | 'scale' | 'chaos' | 'phase') =>
    set((state) => ({
      movement: {
        ...state.movement,
        locked: {
          ...state.movement.locked,
          [param]: !state.movement.locked[param],
        },
      },
    })),

  // ============================================
  // EFFECTS STATE
  // ============================================
  effects: {
    active: new Set<EffectId>(),
  },

  toggleEffect: (effect: EffectId) =>
    set((state) => {
      const newEffects = new Set(state.effects.active)
      if (newEffects.has(effect)) {
        newEffects.delete(effect)
      } else {
        newEffects.add(effect)
      }
      return { effects: { active: newEffects } }
    }),

  triggerEffect: (effect: EffectId) => {
    // Para efectos de un solo disparo (como blinder)
    set((state) => {
      const newEffects = new Set(state.effects.active)
      newEffects.add(effect)
      return { effects: { active: newEffects } }
    })

    // Auto-desactivar después de un tiempo
    setTimeout(() => {
      set((state) => {
        const newEffects = new Set(state.effects.active)
        newEffects.delete(effect)
        return { effects: { active: newEffects } }
      })
    }, 1000)
  },

  // 🔥 WAVE 10.7: Set effects from backend state-update
  setActiveEffects: (effects: Set<EffectId>) => {
    set({ effects: { active: effects } })
  },

  // ============================================
  // BLACKOUT STATE
  // ============================================
  blackout: false,
  setBlackout: (active: boolean) => set({ blackout: active }),
  toggleBlackout: () => set((state) => ({ blackout: !state.blackout })),

  // ============================================
  // AUDIO STATE
  // ============================================
  audio: {
    bpm: 128,
    energy: 0.5,
    bass: 0.5,
    mid: 0.5,
    treble: 0.5,
    beatSync: true,
  },

  updateAudio: (data: Partial<AudioState>) =>
    set((state) => ({
      audio: { ...state.audio, ...data },
    })),

  // ============================================
  // MASTER STATE
  // ============================================
  masterDimmer: 1.0,
  setMasterDimmer: (value: number) => set({ masterDimmer: value }),
}))

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13.5: REACT 19 FIX - Stable Selectors for useLuxSyncStore
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: BigSwitch - selene.mode + setSeleneMode */
export const selectBigSwitch = (state: LuxSyncStore) => ({
  seleneMode: state.selene.mode,
  setSeleneMode: state.setSeleneMode,
})

/** Selector: EffectsBar - effects.active + toggle functions */
export const selectEffectsBar = (state: LuxSyncStore) => ({
  activeEffects: state.effects.active,
  toggleEffect: state.toggleEffect,
  triggerEffect: state.triggerEffect,
})

/** Selector: App.tsx - blackout + updateAudio */
export const selectAppMain = (state: LuxSyncStore) => ({
  blackout: state.blackout,
  toggleBlackout: state.toggleBlackout,
  updateAudio: state.updateAudio,
})

/** Selector: Header.tsx - display info only */
export const selectHeader = (state: LuxSyncStore) => ({
  activePalette: state.activePalette,
  seleneGeneration: state.selene.generation,
  masterDimmer: state.masterDimmer,
  setMasterDimmer: state.setMasterDimmer,
})

/** Selector: TrinityProvider - effects sync functions only */
export const selectTrinityEffectsSync = (state: LuxSyncStore) => ({
  setActiveEffects: state.setActiveEffects,
  setBlackout: state.setBlackout,
})

// ═══════════════════════════════════════════════════════════════════════════
