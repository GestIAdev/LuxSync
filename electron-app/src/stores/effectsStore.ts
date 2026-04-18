/**
 * ⚡ EFFECTS STORE - Global Effects & Blackout
 * WAVE 9: Efectos instantáneos disponibles en cualquier pestaña
 */

import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

export type EffectId = 'strobe' | 'blinder' | 'smoke' | 'laser' | 'rainbow' | 'police' | 'beam' | 'prism'

export interface EffectConfig {
  id: EffectId
  label: string
  icon: string
  shortcut: string
  color: string
  description: string
}

export interface EffectsState {
  // Blackout es especial - override total
  blackout: boolean
  
  // Efectos activos (puede haber varios)
  activeEffects: Set<EffectId>
  
  // Historial para debug
  lastToggled: EffectId | 'blackout' | null
  lastToggleTime: number
  
  // Actions
  toggleBlackout: () => void
  setBlackout: (value: boolean) => void
  toggleEffect: (effect: EffectId) => void
  activateEffect: (effect: EffectId) => void
  deactivateEffect: (effect: EffectId) => void
  clearAllEffects: () => void
  isEffectActive: (effect: EffectId) => boolean
}

// ============================================
// EFFECTS CONFIGURATION
// ============================================

export const EFFECTS: EffectConfig[] = [
  // 🔦 OPTICAL CONTROLS (primero - más importantes)
  {
    id: 'beam',
    label: 'BEAM',
    icon: '🔦',
    shortcut: 'B',
    color: '#00ffff',
    description: 'Haz cerrado spotlight',
  },
  {
    id: 'prism',
    label: 'PRISM',
    icon: '💎',
    shortcut: 'P',
    color: '#ff00ff',
    description: 'Fragmentación prisma RGB',
  },
  // ⚡ PANIC BUTTONS
  {
    id: 'strobe',
    label: 'STROBE',
    icon: '⚡',
    shortcut: 'S',
    color: '#ffffff',
    description: 'Flash rápido estroboscópico',
  },
  {
    id: 'blinder',
    label: 'BLINDER',
    icon: '💥',
    shortcut: 'L',
    color: '#ffd700',
    description: 'Destello cegador momentáneo',
  },
  {
    id: 'smoke',
    label: 'SMOKE',
    icon: '💨',
    shortcut: '3',
    color: '#9ca3af',
    description: 'Activar máquina de humo',
  },
  {
    id: 'laser',
    label: 'LASER',
    icon: '🔴',
    shortcut: '4',
    color: '#ff0000',
    description: 'Efectos láser',
  },
  {
    id: 'rainbow',
    label: 'RAINBOW',
    icon: '🌈',
    shortcut: '5',
    color: 'linear-gradient(90deg, #ff0000, #ff9900, #ffff00, #00ff00, #00ffff, #ff00ff)',
    description: 'Ciclo de colores arcoíris',
  },
  {
    id: 'police',
    label: 'POLICE',
    icon: '🚨',
    shortcut: '6',
    color: '#3b82f6',
    description: 'Rojo y azul alternando',
  },
]

// ============================================
// STORE
// ============================================

export const useEffectsStore = create<EffectsState>((set, get) => ({
  blackout: false,
  activeEffects: new Set(),
  lastToggled: null,
  lastToggleTime: 0,
  
  toggleBlackout: () => {
    set((state) => ({
      blackout: !state.blackout,
      // Blackout desactiva todos los efectos
      activeEffects: state.blackout ? state.activeEffects : new Set(),
      lastToggled: 'blackout',
      lastToggleTime: Date.now(),
    }))
  },
  
  setBlackout: (value: boolean) => {
    set({
      blackout: value,
      activeEffects: value ? new Set() : get().activeEffects,
      lastToggled: 'blackout',
      lastToggleTime: Date.now(),
    })
  },
  
  toggleEffect: (effect: EffectId) => {
    const { blackout } = get()
    // No permitir efectos durante blackout
    if (blackout) return
    
    set((state) => {
      const newEffects = new Set(state.activeEffects)
      if (newEffects.has(effect)) {
        newEffects.delete(effect)
      } else {
        newEffects.add(effect)
      }
      return {
        activeEffects: newEffects,
        lastToggled: effect,
        lastToggleTime: Date.now(),
      }
    })
  },
  
  activateEffect: (effect: EffectId) => {
    const { blackout, activeEffects } = get()
    if (blackout || activeEffects.has(effect)) return
    
    set((state) => ({
      activeEffects: new Set([...state.activeEffects, effect]),
      lastToggled: effect,
      lastToggleTime: Date.now(),
    }))
  },
  
  deactivateEffect: (effect: EffectId) => {
    set((state) => {
      const newEffects = new Set(state.activeEffects)
      newEffects.delete(effect)
      return {
        activeEffects: newEffects,
        lastToggled: effect,
        lastToggleTime: Date.now(),
      }
    })
  },
  
  clearAllEffects: () => {
    set({
      activeEffects: new Set(),
      lastToggled: null,
      lastToggleTime: Date.now(),
    })
  },
  
  isEffectActive: (effect: EffectId) => {
    return get().activeEffects.has(effect)
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 2042.13.4: REACT 19 FIX - Stable Selectors
// ═══════════════════════════════════════════════════════════════════════════

/** Selector: Blackout state only (boolean - stable) */
export const selectBlackout = (state: EffectsState) => state.blackout

/** Selector: Toggle blackout function (stable reference) */
export const selectToggleBlackout = (state: EffectsState) => state.toggleBlackout

/** Selector: Active effects (Set reference changes on toggle) */
export const selectActiveEffects = (state: EffectsState) => state.activeEffects

/** Selector: MainLayout needs blackout boolean */
export const selectMainLayoutEffects = (state: EffectsState) => ({
  blackout: state.blackout,
})

/** Selector: QuickActions - needs activeEffects + toggleEffect */
export const selectQuickActions = (state: EffectsState) => ({
  activeEffects: state.activeEffects,
  toggleEffect: state.toggleEffect,
})

/** Selector: KeyboardProvider - blackout setter + effect toggle */
export const selectKeyboardEffects = (state: EffectsState) => ({
  blackout: state.blackout,
  setBlackout: state.setBlackout,
  toggleEffect: state.toggleEffect,
})

/** Selector: BlackoutButton - state + action */
export const selectBlackoutButton = (state: EffectsState) => ({
  blackout: state.blackout,
  setBlackout: state.setBlackout,
})

/** Selector: CommandDeck - just blackout state */
export const selectCommandDeckBlackout = (state: EffectsState) => state.blackout

// ═══════════════════════════════════════════════════════════════════════════
