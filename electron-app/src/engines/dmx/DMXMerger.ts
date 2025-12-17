/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ DMX MERGER - WAVE 30: Stage Command & Dashboard
 * Motor de fusión de valores DMX con sistema de prioridades
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Pipeline de prioridad (alto → bajo):
 * 1. MANUAL OVERRIDE  - Valores forzados por usuario (Inspector)
 * 2. FLOW ENGINE      - Patrones reactivos (chase, wave, etc.)
 * 3. SELENE AI        - Decisiones automáticas basadas en audio
 * 
 * Formula: finalValue = override ?? (flow * mask) ?? aiValue
 * 
 * @module engines/dmx/DMXMerger
 * @version 30.1.0
 */

import { 
  FixtureOverride, 
  ChannelMask, 
  Override,
  hslToRgb,
} from '../../stores/overrideStore'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valores de canales para un fixture
 */
export interface FixtureChannelValues {
  r: number        // 0-255
  g: number        // 0-255
  b: number        // 0-255
  w: number        // 0-255 (white)
  dimmer: number   // 0-255
  pan: number      // 0-255 (DMX raw)
  tilt: number     // 0-255 (DMX raw)
  gobo: number     // 0-255
  prism: number    // 0-255 (0 = off, 255 = on)
  focus: number    // 0-255
  zoom: number     // 0-255
}

/**
 * Input para el merger por fixture
 */
export interface MergeInput {
  fixtureId: string
  
  /** Valores de Selene AI (capa base) */
  aiValues: FixtureChannelValues
  
  /** Valores del Flow Engine (capa media) */
  flowValues: FixtureChannelValues | null
  
  /** Override manual del usuario (capa superior) */
  override: Override | null
  
  /** ¿Está el Flow habilitado globalmente? */
  flowEnabled: boolean
  
  /** Intensidad del blend de Flow (0-1) */
  flowIntensity: number
  
  /** ¿Blackout master activo? */
  blackout: boolean
}

/**
 * Output del merger por fixture
 */
export interface MergeOutput {
  fixtureId: string
  
  /** Valores finales de cada canal */
  channels: FixtureChannelValues
  
  /** Fuente de cada canal (para debug/UI) */
  sources: {
    [K in keyof FixtureChannelValues]?: 'ai' | 'flow' | 'override'
  }
  
  /** ¿Este fixture tiene overrides activos? */
  hasOverride: boolean
}

/**
 * Estado de fade para transiciones suaves
 */
interface FadeState {
  startValue: number
  targetValue: number
  startTime: number
  duration: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Mapeo de canales a tipo de máscara */
const CHANNEL_TO_MASK: Record<keyof FixtureChannelValues, keyof ChannelMask> = {
  r: 'color',
  g: 'color',
  b: 'color',
  w: 'color',
  dimmer: 'dimmer',
  pan: 'position',
  tilt: 'position',
  gobo: 'optics',
  prism: 'optics',
  focus: 'optics',
  zoom: 'optics',
}

/** Mapeo de override a canal */
const OVERRIDE_TO_CHANNEL: Partial<Record<keyof FixtureOverride, keyof FixtureChannelValues>> = {
  r: 'r',
  g: 'g',
  b: 'b',
  w: 'w',
  dimmer: 'dimmer',
  pan: 'pan',
  tilt: 'tilt',
  gobo: 'gobo',
  focus: 'focus',
  zoom: 'zoom',
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX MERGER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class DMXMerger {
  /** Estados de fade por fixture y canal */
  private fadeStates: Map<string, Map<keyof FixtureChannelValues, FadeState>> = new Map()
  
  /** Último timestamp de update */
  private lastUpdate: number = 0
  
  // ═════════════════════════════════════════════════════════════════════════
  // PUBLIC METHODS
  // ═════════════════════════════════════════════════════════════════════════
  
  /**
   * Merge values from all sources for a single fixture
   */
  mergeFixture(input: MergeInput): MergeOutput {
    const { 
      fixtureId, 
      aiValues, 
      flowValues, 
      override, 
      flowEnabled, 
      flowIntensity, 
      blackout,
    } = input
    
    // Inicializar con valores AI
    const channels: FixtureChannelValues = { ...aiValues }
    const sources: MergeOutput['sources'] = {}
    let hasOverride = false
    
    // Lista de canales a procesar
    const channelKeys: (keyof FixtureChannelValues)[] = [
      'r', 'g', 'b', 'w', 'dimmer', 'pan', 'tilt', 'gobo', 'prism', 'focus', 'zoom',
    ]
    
    // Procesar override HSL si está presente (convertir a RGB)
    let overrideRgb: { r?: number; g?: number; b?: number } = {}
    if (override?.values.h !== undefined || override?.values.s !== undefined || override?.values.l !== undefined) {
      const h = override.values.h ?? 0
      const s = override.values.s ?? 100
      const l = override.values.l ?? 50
      overrideRgb = hslToRgb(h, s, l)
    }
    
    for (const channel of channelKeys) {
      let value = aiValues[channel]
      let source: 'ai' | 'flow' | 'override' = 'ai'
      
      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 1: Manual Override (highest priority)
      // ─────────────────────────────────────────────────────────────────────
      
      if (override && this.isMasked(channel, override.mask)) {
        const overrideValue = this.getOverrideValue(channel, override.values, overrideRgb)
        if (overrideValue !== undefined) {
          // Aplicar fade si hay fadeTime
          const fadeTime = override.values.fadeTime ?? 200
          value = this.applyFade(fixtureId, channel, value, overrideValue, fadeTime)
          source = 'override'
          hasOverride = true
        }
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 2: Flow Engine (medium priority)
      // ─────────────────────────────────────────────────────────────────────
      
      else if (flowEnabled && flowValues && flowValues[channel] !== undefined) {
        // Blend flow con AI basado en intensidad
        value = this.lerp(value, flowValues[channel], flowIntensity)
        source = 'flow'
      }
      
      // ─────────────────────────────────────────────────────────────────────
      // PRIORITY 3: AI Value (default, already assigned)
      // ─────────────────────────────────────────────────────────────────────
      
      // ─────────────────────────────────────────────────────────────────────
      // MASTER CONTROLS
      // ─────────────────────────────────────────────────────────────────────
      
      // Blackout: Solo afecta al dimmer
      if (blackout && channel === 'dimmer') {
        value = 0
      }
      
      // Clamp a rango DMX válido
      channels[channel] = this.clamp(Math.round(value), 0, 255)
      sources[channel] = source
    }
    
    return { fixtureId, channels, sources, hasOverride }
  }
  
  /**
   * Merge all fixtures
   */
  mergeAll(inputs: MergeInput[]): MergeOutput[] {
    this.lastUpdate = Date.now()
    return inputs.map(input => this.mergeFixture(input))
  }
  
  /**
   * Crear valores base vacíos (todo en 0)
   */
  createEmptyValues(): FixtureChannelValues {
    return {
      r: 0,
      g: 0,
      b: 0,
      w: 0,
      dimmer: 0,
      pan: 127,
      tilt: 127,
      gobo: 0,
      prism: 0,
      focus: 127,
      zoom: 127,
    }
  }
  
  /**
   * Crear valores desde fixture del truthStore
   */
  createValuesFromFixture(fixture: {
    color?: { r: number; g: number; b: number }
    intensity?: number
    pan?: number
    tilt?: number
  }): FixtureChannelValues {
    return {
      r: fixture.color?.r ?? 0,
      g: fixture.color?.g ?? 0,
      b: fixture.color?.b ?? 0,
      w: 0,
      dimmer: Math.round((fixture.intensity ?? 1) * 255),
      pan: Math.round((fixture.pan ?? 0.5) * 255),
      tilt: Math.round((fixture.tilt ?? 0.5) * 255),
      gobo: 0,
      prism: 0,
      focus: 127,
      zoom: 127,
    }
  }
  
  /**
   * Limpiar todos los estados de fade
   */
  clearFadeStates(): void {
    this.fadeStates.clear()
  }
  
  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════════════════════════════
  
  /**
   * Check if a channel is masked by override
   */
  private isMasked(channel: keyof FixtureChannelValues, mask: ChannelMask): boolean {
    return mask[CHANNEL_TO_MASK[channel]] ?? false
  }
  
  /**
   * Get override value for a channel
   */
  private getOverrideValue(
    channel: keyof FixtureChannelValues, 
    values: FixtureOverride,
    overrideRgb: { r?: number; g?: number; b?: number }
  ): number | undefined {
    // Si hay RGB calculado desde HSL, usarlo para canales de color
    if (channel === 'r' && overrideRgb.r !== undefined) return overrideRgb.r
    if (channel === 'g' && overrideRgb.g !== undefined) return overrideRgb.g
    if (channel === 'b' && overrideRgb.b !== undefined) return overrideRgb.b
    
    // Mapeo directo para la mayoría de canales
    const key = OVERRIDE_TO_CHANNEL[channel as keyof FixtureOverride]
    if (key && values[key as keyof FixtureOverride] !== undefined) {
      const val = values[key as keyof FixtureOverride]
      return typeof val === 'number' ? val : undefined
    }
    
    // Para prism (boolean → number)
    if (channel === 'prism' && values.prism !== undefined) {
      return values.prism ? 255 : 0
    }
    
    // Convertir pan/tilt de grados a DMX
    if (channel === 'pan' && values.pan !== undefined) {
      // 0-540° → 0-255
      return Math.round((values.pan / 540) * 255)
    }
    if (channel === 'tilt' && values.tilt !== undefined) {
      // 0-270° → 0-255
      return Math.round((values.tilt / 270) * 255)
    }
    
    return undefined
  }
  
  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
  
  /**
   * Clamp value to range
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
  
  /**
   * Apply fade/transition to value
   * Por ahora retorna target directamente, en producción
   * debería usar requestAnimationFrame para transiciones suaves
   */
  private applyFade(
    fixtureId: string,
    channel: keyof FixtureChannelValues,
    currentValue: number,
    targetValue: number,
    fadeTimeMs: number
  ): number {
    // Para simplicidad actual, retornamos target directamente
    // TODO: Implementar transiciones suaves con fadeStates
    if (fadeTimeMs <= 0) {
      return targetValue
    }
    
    // Simple implementación de fade
    const now = Date.now()
    let fixtureStates = this.fadeStates.get(fixtureId)
    if (!fixtureStates) {
      fixtureStates = new Map()
      this.fadeStates.set(fixtureId, fixtureStates)
    }
    
    let fadeState = fixtureStates.get(channel)
    
    // Si no hay estado de fade o el target cambió, iniciar nuevo fade
    if (!fadeState || fadeState.targetValue !== targetValue) {
      fadeState = {
        startValue: currentValue,
        targetValue,
        startTime: now,
        duration: fadeTimeMs,
      }
      fixtureStates.set(channel, fadeState)
    }
    
    // Calcular progreso del fade
    const elapsed = now - fadeState.startTime
    const progress = Math.min(elapsed / fadeState.duration, 1)
    
    // Easing cuadrático out (más natural para luces)
    const eased = 1 - Math.pow(1 - progress, 2)
    
    return this.lerp(fadeState.startValue, fadeState.targetValue, eased)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const dmxMerger = new DMXMerger()

export default DMXMerger
