/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECT MANAGER - THE ORCHESTRA CONDUCTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 600: EFFECT ARSENAL
 * 
 * El EffectManager es el orquestador central de todos los efectos.
 * Mantiene la lista de efectos activos, los actualiza cada frame,
 * y combina sus outputs para el MasterArbiter.
 * 
 * RESPONSABILIDADES:
 * 1. Registry de tipos de efectos disponibles
 * 2. Instanciar y disparar efectos bajo demanda
 * 3. Actualizar efectos activos cada frame
 * 4. Combinar outputs (HTP para dimmer, LTP para color)
 * 5. Limpiar efectos terminados
 * 
 * SINGLETON: Solo hay un EffectManager global
 * 
 * @module core/effects/EffectManager
 * @version WAVE 600
 */

import { EventEmitter } from 'events'
import {
  ILightEffect,
  EffectTriggerConfig,
  EffectFrameOutput,
  CombinedEffectOutput,
  EffectManagerState,
  EffectCategory,
} from './types'

// Import effect library
import { SolarFlare } from './library/SolarFlare'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT FACTORY TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factory function para crear efectos
 */
type EffectFactory = () => ILightEffect

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class EffectManager extends EventEmitter {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Registry de factories de efectos */
  private effectFactories: Map<string, EffectFactory> = new Map()
  
  /** Efectos actualmente activos */
  private activeEffects: Map<string, ILightEffect> = new Map()
  
  /** Stats */
  private stats = {
    totalTriggered: 0,
    lastTriggered: null as string | null,
    lastTriggerTime: 0,
  }
  
  /** Frame timing */
  private lastUpdateTime = Date.now()
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor() {
    super()
    this.registerBuiltinEffects()
    console.log('[EffectManager 🎛️] Initialized with built-in effects')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🧨 TRIGGER - Dispara un efecto
   * 
   * @param config Configuración del disparo
   * @returns ID de la instancia del efecto, o null si falla
   */
  trigger(config: EffectTriggerConfig): string | null {
    const factory = this.effectFactories.get(config.effectType)
    
    if (!factory) {
      console.warn(`[EffectManager ⚠️] Unknown effect type: ${config.effectType}`)
      return null
    }
    
    // Crear nueva instancia
    const effect = factory()
    
    // Disparar
    effect.trigger(config)
    
    // Registrar como activo
    this.activeEffects.set(effect.id, effect)
    
    // Stats
    this.stats.totalTriggered++
    this.stats.lastTriggered = config.effectType
    this.stats.lastTriggerTime = Date.now()
    
    // Emit event
    this.emit('effectTriggered', {
      effectId: effect.id,
      effectType: config.effectType,
      intensity: config.intensity,
      source: config.source,
    })
    
    console.log(`[EffectManager 🧨] Triggered: ${config.effectType} (ID: ${effect.id})`)
    
    return effect.id
  }
  
  /**
   * 🔄 UPDATE - Actualiza todos los efectos activos
   * 
   * Llamar cada frame desde TitanEngine o el main loop.
   */
  update(): void {
    const now = Date.now()
    const deltaMs = now - this.lastUpdateTime
    this.lastUpdateTime = now
    
    // Update each active effect
    const toRemove: string[] = []
    
    for (const [id, effect] of this.activeEffects) {
      effect.update(deltaMs)
      
      if (effect.isFinished()) {
        toRemove.push(id)
      }
    }
    
    // Remove finished effects
    for (const id of toRemove) {
      this.activeEffects.delete(id)
      this.emit('effectFinished', { effectId: id })
    }
  }
  
  /**
   * 📤 GET COMBINED OUTPUT - Output combinado de todos los efectos activos
   * 
   * Combina usando:
   * - HTP (Highest Takes Precedence) para dimmer
   * - Mayor prioridad para color
   * - 🧨 WAVE 630: globalOverride bypasea zonas
   */
  getCombinedOutput(): CombinedEffectOutput {
    if (this.activeEffects.size === 0) {
      return {
        hasActiveEffects: false,
        intensity: 0,
        contributingEffects: [],
      }
    }
    
    let maxDimmer = 0
    let maxWhite = 0
    let maxAmber = 0  // 🧨 WAVE 630
    let maxStrobeRate = 0
    let maxIntensity = 0
    let globalOverride = false  // 🧨 WAVE 630
    let highestPriorityColor: { h: number; s: number; l: number } | undefined
    let highestPriority = -1
    const contributing: string[] = []
    
    for (const [id, effect] of this.activeEffects) {
      const output = effect.getOutput()
      if (!output) continue
      
      contributing.push(id)
      
      // HTP for dimmer
      if (output.dimmerOverride !== undefined && output.dimmerOverride > maxDimmer) {
        maxDimmer = output.dimmerOverride
      }
      
      // HTP for white
      if (output.whiteOverride !== undefined && output.whiteOverride > maxWhite) {
        maxWhite = output.whiteOverride
      }
      
      // 🧨 WAVE 630: HTP for amber
      if (output.amberOverride !== undefined && output.amberOverride > maxAmber) {
        maxAmber = output.amberOverride
      }
      
      // Max strobe rate
      if (output.strobeRate !== undefined && output.strobeRate > maxStrobeRate) {
        maxStrobeRate = output.strobeRate
      }
      
      // Max intensity
      if (output.intensity > maxIntensity) {
        maxIntensity = output.intensity
      }
      
      // 🧨 WAVE 630: Global override - cualquier efecto con globalOverride activa el bypass
      if (output.globalOverride) {
        globalOverride = true
      }
      
      // Highest priority takes color
      if (output.colorOverride && effect.priority > highestPriority) {
        highestPriority = effect.priority
        highestPriorityColor = output.colorOverride
      }
    }
    
    return {
      hasActiveEffects: true,
      dimmerOverride: maxDimmer > 0 ? maxDimmer : undefined,
      whiteOverride: maxWhite > 0 ? maxWhite : undefined,
      amberOverride: maxAmber > 0 ? maxAmber : undefined,  // 🧨 WAVE 630
      colorOverride: highestPriorityColor,
      strobeRate: maxStrobeRate > 0 ? maxStrobeRate : undefined,
      intensity: maxIntensity,
      contributingEffects: contributing,
      globalOverride: globalOverride,  // 🧨 WAVE 630
    }
  }
  
  /**
   * 📊 GET STATE - Estado actual del manager
   */
  getState(): EffectManagerState {
    return {
      activeCount: this.activeEffects.size,
      activeEffects: Array.from(this.activeEffects.keys()),
      lastTriggered: this.stats.lastTriggered,
      lastTriggerTime: this.stats.lastTriggerTime,
      totalTriggered: this.stats.totalTriggered,
    }
  }
  
  /**
   * ⛔ ABORT ALL - Aborta todos los efectos activos
   */
  abortAll(): void {
    for (const effect of this.activeEffects.values()) {
      effect.abort()
    }
    this.activeEffects.clear()
    console.log('[EffectManager ⛔] All effects aborted')
  }
  
  /**
   * ⛔ ABORT - Aborta un efecto específico
   */
  abort(effectId: string): boolean {
    const effect = this.activeEffects.get(effectId)
    if (effect) {
      effect.abort()
      this.activeEffects.delete(effectId)
      return true
    }
    return false
  }
  
  /**
   * 📋 LIST AVAILABLE - Lista tipos de efectos disponibles
   */
  getAvailableEffects(): string[] {
    return Array.from(this.effectFactories.keys())
  }
  
  /**
   * 🔌 REGISTER EFFECT - Registra un nuevo tipo de efecto
   */
  registerEffect(effectType: string, factory: EffectFactory): void {
    this.effectFactories.set(effectType, factory)
    console.log(`[EffectManager 🔌] Registered effect: ${effectType}`)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Built-in effects registration
  // ─────────────────────────────────────────────────────────────────────────
  
  private registerBuiltinEffects(): void {
    // ☀️ Solar Flare
    this.effectFactories.set('solar_flare', () => new SolarFlare())
    
    // TODO WAVE 600+: Añadir más efectos
    // - 'strobe_burst' - Ráfaga de strobe
    // - 'color_wash' - Lavado de color
    // - 'rainbow_sweep' - Arcoíris
    // - 'blackout_flash' - Blackout + flash
    // - 'mover_snap' - Snap de movers
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let effectManagerInstance: EffectManager | null = null

/**
 * Obtiene el singleton del EffectManager
 */
export function getEffectManager(): EffectManager {
  if (!effectManagerInstance) {
    effectManagerInstance = new EffectManager()
  }
  return effectManagerInstance
}

/**
 * Reset del singleton (para tests)
 */
export function resetEffectManager(): void {
  if (effectManagerInstance) {
    effectManagerInstance.abortAll()
  }
  effectManagerInstance = null
}
