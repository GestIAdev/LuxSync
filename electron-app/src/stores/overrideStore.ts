/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔧 OVERRIDE STORE - WAVE 30: Stage Command & Dashboard
 * Almacena valores manuales forzados por el usuario (Inspector)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Responsabilidades:
 * - Guardar valores manuales (color, dimmer, pan/tilt)
 * - Máscaras de canal para indicar qué está "bloqueado"
 * - Override global opcional
 * - Integración con DMXMerger
 * 
 * @module stores/overrideStore
 * @version 30.1.0
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valores que se pueden overridear por fixture
 */
export interface FixtureOverride {
  // Color (HSL para transiciones suaves)
  h?: number           // 0-360
  s?: number           // 0-100
  l?: number           // 0-100
  
  // RGB directo (alternativa a HSL)
  r?: number           // 0-255
  g?: number           // 0-255
  b?: number           // 0-255
  w?: number           // 0-255 (white channel)
  
  // Intensidad
  dimmer?: number      // 0-255
  
  // Movimiento (cabezas móviles)
  pan?: number         // 0-540 (degrees)
  tilt?: number        // 0-270 (degrees)
  
  // Ópticos
  gobo?: number        // Índice de gobo
  prism?: boolean      // Prisma activo
  focus?: number       // 0-255
  zoom?: number        // 0-255
  
  // Timing
  fadeTime?: number    // ms para transición
}

/**
 * Máscara de canales - define qué canales están "bloqueados" por override
 */
export interface ChannelMask {
  color: boolean
  dimmer: boolean
  position: boolean
  optics: boolean
}

/** Fuente del override */
export type OverrideSource = 'inspector' | 'fader' | 'programmer' | 'cue'

/**
 * Override completo con metadata
 */
export interface Override {
  values: FixtureOverride
  mask: ChannelMask
  timestamp: number
  source: OverrideSource
  priority: number     // Para futuras cues
}

/**
 * Estado del Override Store
 */
export interface OverrideState {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Map de overrides por fixture ID */
  overrides: Map<string, Override>
  
  /** Override global (aplica a todos si está definido) */
  globalOverride: Partial<FixtureOverride> | null
  
  /** Fade time por defecto en ms */
  defaultFadeTime: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Establecer override para un fixture
   */
  setOverride: (
    fixtureId: string, 
    values: Partial<FixtureOverride>, 
    mask?: Partial<ChannelMask>,
    source?: OverrideSource
  ) => void
  
  /**
   * Establecer override para múltiples fixtures (selección)
   */
  setMultipleOverrides: (
    fixtureIds: string[], 
    values: Partial<FixtureOverride>, 
    mask?: Partial<ChannelMask>,
    source?: OverrideSource
  ) => void
  
  /**
   * Limpiar override de un fixture
   * @param channels - Canales específicos a limpiar (todos si no se especifica)
   */
  clearOverride: (fixtureId: string, channels?: (keyof ChannelMask)[]) => void
  
  /**
   * Limpiar todos los overrides (release all)
   */
  clearAllOverrides: () => void
  
  /**
   * Establecer override global
   */
  setGlobalOverride: (values: Partial<FixtureOverride> | null) => void
  
  /**
   * Establecer fade time por defecto
   */
  setDefaultFadeTime: (ms: number) => void
  
  // ═══════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Obtener override de un fixture */
  getOverride: (fixtureId: string) => Override | undefined
  
  /** ¿Tiene override este fixture? */
  hasOverride: (fixtureId: string) => boolean
  
  /** Obtener valor efectivo de un canal específico */
  getEffectiveValue: (fixtureId: string, channel: keyof FixtureOverride) => number | boolean | undefined
  
  /** Obtener máscara de un fixture */
  getMask: (fixtureId: string) => ChannelMask
  
  /** Obtener IDs con overrides activos */
  getActiveOverrideIds: () => string[]
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT VALUES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_MASK: ChannelMask = {
  color: false,
  dimmer: false,
  position: false,
  optics: false,
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useOverrideStore = create<OverrideState>()(
  subscribeWithSelector((set, get) => ({
    // ═══════════════════════════════════════════════════════════════════════
    // INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════════
    
    overrides: new Map(),
    globalOverride: null,
    defaultFadeTime: 200, // ms
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    setOverride: (fixtureId, values, mask, source = 'inspector') => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        const existing = newOverrides.get(fixtureId)
        
        // Inferir máscara desde valores si no se proporciona
        const inferredMask: ChannelMask = {
          color: mask?.color ?? (
            values.h !== undefined || 
            values.s !== undefined || 
            values.l !== undefined || 
            values.r !== undefined || 
            values.g !== undefined || 
            values.b !== undefined
          ),
          dimmer: mask?.dimmer ?? (values.dimmer !== undefined),
          position: mask?.position ?? (values.pan !== undefined || values.tilt !== undefined),
          optics: mask?.optics ?? (
            values.gobo !== undefined || 
            values.prism !== undefined || 
            values.focus !== undefined || 
            values.zoom !== undefined
          ),
        }
        
        const newOverride: Override = {
          values: {
            ...existing?.values,
            ...values,
            fadeTime: values.fadeTime ?? state.defaultFadeTime,
          },
          mask: {
            ...DEFAULT_MASK,
            ...existing?.mask,
            ...inferredMask,
          },
          timestamp: Date.now(),
          source,
          priority: 100,
        }
        
        newOverrides.set(fixtureId, newOverride)
        
        return { overrides: newOverrides }
      })
    },
    
    setMultipleOverrides: (fixtureIds, values, mask, source = 'inspector') => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        const timestamp = Date.now()
        
        // Inferir máscara
        const inferredMask: ChannelMask = {
          color: mask?.color ?? (
            values.h !== undefined || 
            values.s !== undefined || 
            values.l !== undefined ||
            values.r !== undefined || 
            values.g !== undefined || 
            values.b !== undefined
          ),
          dimmer: mask?.dimmer ?? (values.dimmer !== undefined),
          position: mask?.position ?? (values.pan !== undefined || values.tilt !== undefined),
          optics: mask?.optics ?? (
            values.gobo !== undefined || 
            values.prism !== undefined ||
            values.focus !== undefined || 
            values.zoom !== undefined
          ),
        }
        
        fixtureIds.forEach(id => {
          const existing = newOverrides.get(id)
          
          newOverrides.set(id, {
            values: { 
              ...existing?.values, 
              ...values,
              fadeTime: values.fadeTime ?? state.defaultFadeTime,
            },
            mask: { 
              ...DEFAULT_MASK, 
              ...existing?.mask, 
              ...inferredMask,
            },
            timestamp,
            source,
            priority: 100,
          })
        })
        
        return { overrides: newOverrides }
      })
    },
    
    clearOverride: (fixtureId, channels) => {
      set((state) => {
        const newOverrides = new Map(state.overrides)
        
        if (!channels) {
          // Limpiar todo el override
          newOverrides.delete(fixtureId)
        } else {
          // Limpiar canales específicos
          const existing = newOverrides.get(fixtureId)
          if (existing) {
            const newMask = { ...existing.mask }
            channels.forEach(ch => {
              newMask[ch] = false
            })
            
            // Si no quedan canales activos, eliminar el override completo
            if (!Object.values(newMask).some(v => v)) {
              newOverrides.delete(fixtureId)
            } else {
              newOverrides.set(fixtureId, {
                ...existing,
                mask: newMask,
                timestamp: Date.now(),
              })
            }
          }
        }
        
        return { overrides: newOverrides }
      })
    },
    
    clearAllOverrides: () => {
      set({
        overrides: new Map(),
        globalOverride: null,
      })
    },
    
    setGlobalOverride: (values) => {
      set({ globalOverride: values })
    },
    
    setDefaultFadeTime: (ms) => {
      set({ defaultFadeTime: ms })
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════════
    
    getOverride: (fixtureId) => get().overrides.get(fixtureId),
    
    hasOverride: (fixtureId) => get().overrides.has(fixtureId),
    
    getEffectiveValue: (fixtureId, channel) => {
      const override = get().overrides.get(fixtureId)
      return override?.values[channel]
    },
    
    getMask: (fixtureId) => {
      const override = get().overrides.get(fixtureId)
      return override?.mask ?? DEFAULT_MASK
    },
    
    getActiveOverrideIds: () => [...get().overrides.keys()],
  }))
)

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export const selectOverrides = (state: OverrideState) => state.overrides
export const selectGlobalOverride = (state: OverrideState) => state.globalOverride
export const selectDefaultFadeTime = (state: OverrideState) => state.defaultFadeTime

/** Selector para verificar si hay algún override activo */
export const selectHasAnyOverride = (state: OverrideState) => state.overrides.size > 0

/** Selector para obtener número de overrides activos */
export const selectOverrideCount = (state: OverrideState) => state.overrides.size

/**
 * Selector para obtener override de un fixture específico
 */
export const selectOverrideFor = (id: string) => (state: OverrideState) => 
  state.overrides.get(id)

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Convertir HSL a RGB
// ═══════════════════════════════════════════════════════════════════════════

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360
  s = s / 100
  l = l / 100
  
  let r: number, g: number, b: number
  
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Convertir RGB a HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

export default useOverrideStore
