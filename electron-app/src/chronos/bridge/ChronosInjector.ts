/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 CHRONOS INJECTOR - THE WHISPERER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 2002: THE SYNAPTIC BRIDGE
 * 
 * El puente entre Chronos y el sistema nervioso de LuxSync.
 * Toma el estado del timeline y genera overrides para Selene/Titan.
 * 
 * FILOSOFÍA:
 * - Chronos SUSURRA a Selene, no la reemplaza
 * - En modo 'whisper': Chronos sugiere, Selene refina
 * - En modo 'full': Chronos dicta, Selene obedece
 * 
 * FLUJO DE DATOS:
 * ```
 * ChronosEngine.tick() → ChronosContext
 *                             ↓
 *                    ChronosInjector.inject()
 *                             ↓
 *                    ChronosOverrides (para Titan)
 *                             ↓
 *                    TitanEngine.setChronosInput()
 *                             ↓
 *               MusicalContext modificado → Física normal
 * ```
 * 
 * @module chronos/bridge/ChronosInjector
 * @version 2002.0.0
 */

import type { MusicalContext } from '../../core/protocol/MusicalContext'
import type { EffectTriggerConfig, EffectZone } from '../../core/effects/types'
import type {
  ChronosContext,
  ChronosActiveEffect,
  ChronosOverrideMode,
  TimeMs,
  NormalizedValue,
  AutomationTarget,
} from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 CHRONOS OVERRIDES (OUTPUT)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 CHRONOS OVERRIDES
 * 
 * Payload que Chronos genera para inyectar en TitanEngine.
 * Contiene todo lo que Chronos quiere modificar este frame.
 */
export interface ChronosOverrides {
  /** ¿Está Chronos activo y en control? */
  active: boolean
  
  /** Modo de override */
  mode: ChronosOverrideMode
  
  /** Timestamp actual (ms) */
  timestamp: TimeMs
  
  // ─────────────────────────────────────────────────────────────────────────
  // VIBE OVERRIDE
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Vibe forzado (null = no override) */
  forcedVibe: ForcedVibeOverride | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // MODULATORS (valores de automation)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Moduladores de parámetros (evaluados de las curvas de automation) */
  modulators: ChronosModulators
  
  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT TRIGGERS
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Efectos a disparar este frame */
  triggerEvents: ChronosTriggerEvent[]
  
  /** Efectos activos con progress controlado (para scrubbing) */
  activeEffectsWithProgress: ChronosEffectWithProgress[]
  
  // ─────────────────────────────────────────────────────────────────────────
  // ZONE OVERRIDES
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Override de zonas habilitadas */
  zoneOverride: ChronosZoneOverrideOutput | null
  
  // ─────────────────────────────────────────────────────────────────────────
  // COLOR OVERRIDES
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Override de paleta */
  colorOverride: ChronosColorOverrideOutput | null
}

/**
 * Override de Vibe forzado
 */
export interface ForcedVibeOverride {
  /** ID del vibe */
  vibeId: string
  
  /** Tipo de transición */
  transition: 'cut' | 'fade'
  
  /** Progreso de la transición (0-1) */
  transitionProgress: NormalizedValue
}

/**
 * Moduladores de parámetros desde las curvas de automation
 */
export interface ChronosModulators {
  /** Intensidad master (0-1) */
  masterIntensity: NormalizedValue | null
  
  /** Velocidad master (multiplier) */
  masterSpeed: number | null
  
  /** Offset de hue global (degrees) */
  hueOffset: number | null
  
  /** Saturación master (0-1) */
  saturation: NormalizedValue | null
  
  /** Energía override (0-1) - susurra a la energía de Selene */
  energyOverride: NormalizedValue | null
  
  /** Parámetros custom (automation genéricas) */
  custom: Map<string, number>
}

/**
 * Evento de trigger de efecto
 */
export interface ChronosTriggerEvent {
  /** ID del efecto */
  effectId: string
  
  /** Intensidad */
  intensity: NormalizedValue
  
  /** Velocidad */
  speed: number
  
  /** Zonas target */
  zones: EffectZone[]
  
  /** Parámetros custom */
  params: Record<string, number | string | boolean>
  
  /** ID del clip fuente (para tracking) */
  sourceClipId: string
  
  /** ¿Es nuevo este frame? (true si startMs == currentTime) */
  isNewTrigger: boolean
}

/**
 * Efecto activo con progress controlado (para scrubbing)
 */
export interface ChronosEffectWithProgress {
  /** ID del efecto */
  effectId: string
  
  /** ID de la instancia activa en EffectManager (si existe) */
  instanceId: string | null
  
  /** Progress forzado (0-1) */
  progress: NormalizedValue
  
  /** Intensidad */
  intensity: NormalizedValue
  
  /** ID del clip fuente */
  sourceClipId: string
}

/**
 * Override de zonas
 */
export interface ChronosZoneOverrideOutput {
  /** Zonas habilitadas */
  enabledZones: EffectZone[]
  
  /** ¿Blackout en zonas deshabilitadas? */
  blackoutDisabled: boolean
}

/**
 * Override de color
 */
export interface ChronosColorOverrideOutput {
  /** Paleta override */
  palette: {
    primary: string
    secondary: string
    accent: string
  }
  
  /** Key lock (null = no lock) */
  keyLock: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 CHRONOS INJECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔌 CHRONOS INJECTOR
 * 
 * Transforma ChronosContext (del engine) en ChronosOverrides (para Titan).
 * Es el "traductor" entre el timeline y el sistema en vivo.
 */
export class ChronosInjector {
  // ═══════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Efectos que ya fueron triggerados (para evitar re-triggers) */
  private triggeredClipIds: Set<string> = new Set()
  
  /** Último timestamp procesado (para detectar saltos/seeks) */
  private lastTimestamp: TimeMs = 0
  
  /** Mapeo de clip ID → instance ID en EffectManager */
  private clipToInstanceMap: Map<string, string> = new Map()
  
  /** ¿Está habilitado el injector? */
  private enabled: boolean = true
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Habilita/deshabilita el injector
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
    }
  }
  
  /**
   * ¿Está habilitado?
   */
  isEnabled(): boolean {
    return this.enabled
  }
  
  /**
   * 🔌 INJECT
   * 
   * Transforma ChronosContext en ChronosOverrides.
   * 
   * @param context Contexto de Chronos (del engine)
   * @returns Overrides para inyectar en TitanEngine
   */
  inject(context: ChronosContext): ChronosOverrides {
    if (!this.enabled || !context.active) {
      return this.createEmptyOverrides(context.timestamp)
    }
    
    // Detectar seek/salto (para resetear triggers)
    const isSeek = Math.abs(context.timestamp - this.lastTimestamp) > 100
    if (isSeek) {
      this.handleSeek(context.timestamp)
    }
    this.lastTimestamp = context.timestamp
    
    // Procesar cada componente
    const forcedVibe = this.processForcedVibe(context)
    const modulators = this.processModulators(context)
    const { triggers, activeEffects } = this.processEffects(context)
    const zoneOverride = this.processZoneOverride(context)
    const colorOverride = this.processColorOverride(context)
    
    return {
      active: true,
      mode: context.overrideMode,
      timestamp: context.timestamp,
      forcedVibe,
      modulators,
      triggerEvents: triggers,
      activeEffectsWithProgress: activeEffects,
      zoneOverride,
      colorOverride,
    }
  }
  
  /**
   * 📊 APPLY TO MUSICAL CONTEXT
   * 
   * Aplica los overrides de Chronos a un MusicalContext existente.
   * Usado por TitanEngine para "susurrar" al contexto.
   * 
   * @param original MusicalContext original (del audio en vivo)
   * @param overrides Overrides de Chronos
   * @returns MusicalContext modificado
   */
  applyToMusicalContext(
    original: MusicalContext,
    overrides: ChronosOverrides
  ): MusicalContext {
    if (!overrides.active) {
      return original
    }
    
    const modified = { ...original }
    
    // Aplicar moduladores según modo
    const isWhisper = overrides.mode === 'whisper'
    
    // Energy override
    if (overrides.modulators.energyOverride !== null) {
      if (isWhisper) {
        // Whisper: Blend con energía original (70% Chronos, 30% Live)
        modified.energy = overrides.modulators.energyOverride * 0.7 + original.energy * 0.3
      } else {
        // Full: Dictar energía completamente
        modified.energy = overrides.modulators.energyOverride
      }
    }
    
    // Intensity master → afecta energy también
    if (overrides.modulators.masterIntensity !== null) {
      modified.energy *= overrides.modulators.masterIntensity
    }
    
    // Vibe override
    if (overrides.forcedVibe) {
      // El vibeId se pasa por separado a VibeManager
      // Aquí solo podemos marcar que hay override
      ;(modified as any)._chronosVibeId = overrides.forcedVibe.vibeId
      ;(modified as any)._chronosVibeTransition = overrides.forcedVibe.transitionProgress
    }
    
    // Key lock (color override)
    if (overrides.colorOverride?.keyLock) {
      // Cast a MusicalKey - Chronos garantiza que es válido
      modified.key = overrides.colorOverride.keyLock as MusicalContext['key']
      modified.confidence = 1.0 // Forzar confianza máxima
    }
    
    // Marcar que viene de Chronos
    ;(modified as any)._fromChronos = true
    ;(modified as any)._chronosTimestamp = overrides.timestamp
    
    return modified
  }
  
  /**
   * 🔃 RESET
   * 
   * Resetea el estado interno (para seeks, stops, etc.)
   */
  reset(): void {
    this.triggeredClipIds.clear()
    this.clipToInstanceMap.clear()
    this.lastTimestamp = 0
  }
  
  /**
   * 📝 REGISTER EFFECT INSTANCE
   * 
   * Registra el ID de instancia de un efecto disparado.
   * Usado para poder controlar su progress después.
   */
  registerEffectInstance(clipId: string, instanceId: string): void {
    this.clipToInstanceMap.set(clipId, instanceId)
  }
  
  /**
   * 🗑️ UNREGISTER EFFECT INSTANCE
   * 
   * Limpia el registro cuando un efecto termina.
   */
  unregisterEffectInstance(clipId: string): void {
    this.clipToInstanceMap.delete(clipId)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE - PROCESSORS
  // ═══════════════════════════════════════════════════════════════════════
  
  private processForcedVibe(context: ChronosContext): ForcedVibeOverride | null {
    if (!context.vibeOverride) return null
    
    return {
      vibeId: context.vibeOverride.vibeId,
      transition: context.vibeOverride.transition,
      transitionProgress: context.vibeOverride.progress,
    }
  }
  
  private processModulators(context: ChronosContext): ChronosModulators {
    const mods: ChronosModulators = {
      masterIntensity: null,
      masterSpeed: null,
      hueOffset: null,
      saturation: null,
      energyOverride: null,
      custom: new Map(),
    }
    
    // Extraer valores de automation evaluados
    for (const [target, value] of context.automationValues) {
      switch (target) {
        case 'master.intensity':
          mods.masterIntensity = value
          break
        case 'master.speed':
          mods.masterSpeed = value
          break
        case 'master.hue_offset':
          mods.hueOffset = value * 360 // Normalizado a degrees
          break
        case 'master.saturation':
          mods.saturation = value
          break
        case 'selene.energy':
          mods.energyOverride = value
          break
        default:
          // Parámetros custom
          if (target.startsWith('param.')) {
            const paramName = target.slice(6)
            mods.custom.set(paramName, value)
          }
      }
    }
    
    // Override de intensidad desde clip directo (si hay)
    if (context.intensityOverride !== null) {
      mods.masterIntensity = context.intensityOverride
    }
    
    return mods
  }
  
  private processEffects(context: ChronosContext): {
    triggers: ChronosTriggerEvent[]
    activeEffects: ChronosEffectWithProgress[]
  } {
    const triggers: ChronosTriggerEvent[] = []
    const activeEffects: ChronosEffectWithProgress[] = []
    
    for (const effect of context.activeEffects) {
      // ¿Es nuevo trigger? (no lo hemos disparado antes)
      const isNewTrigger = !this.triggeredClipIds.has(effect.sourceClipId)
      
      if (isNewTrigger) {
        // Marcar como triggerado
        this.triggeredClipIds.add(effect.sourceClipId)
        
        triggers.push({
          effectId: effect.effectId,
          intensity: effect.intensity,
          speed: effect.speed,
          zones: effect.zones as EffectZone[],
          params: effect.params,
          sourceClipId: effect.sourceClipId,
          isNewTrigger: true,
        })
      }
      
      // Siempre añadir a activeEffects con progress (para scrubbing)
      activeEffects.push({
        effectId: effect.effectId,
        instanceId: this.clipToInstanceMap.get(effect.sourceClipId) ?? null,
        progress: effect.progress,
        intensity: effect.intensity,
        sourceClipId: effect.sourceClipId,
      })
    }
    
    // Limpiar clips que ya no están activos
    const activeClipIds = new Set(context.activeEffects.map(e => e.sourceClipId))
    for (const clipId of this.triggeredClipIds) {
      if (!activeClipIds.has(clipId)) {
        this.triggeredClipIds.delete(clipId)
        this.clipToInstanceMap.delete(clipId)
      }
    }
    
    return { triggers, activeEffects }
  }
  
  private processZoneOverride(context: ChronosContext): ChronosZoneOverrideOutput | null {
    if (!context.zoneOverrides) return null
    
    return {
      enabledZones: context.zoneOverrides.enabledZones as EffectZone[],
      blackoutDisabled: context.zoneOverrides.blackoutDisabled,
    }
  }
  
  private processColorOverride(context: ChronosContext): ChronosColorOverrideOutput | null {
    if (!context.colorOverride) return null
    
    return {
      palette: context.colorOverride.palette,
      keyLock: context.colorOverride.keyLock,
    }
  }
  
  private handleSeek(newTimestamp: TimeMs): void {
    // En un seek, limpiar todos los triggers para re-evaluar
    this.triggeredClipIds.clear()
    // Mantener clipToInstanceMap para efectos que siguen activos
  }
  
  private createEmptyOverrides(timestamp: TimeMs): ChronosOverrides {
    return {
      active: false,
      mode: 'whisper',
      timestamp,
      forcedVibe: null,
      modulators: {
        masterIntensity: null,
        masterSpeed: null,
        hueOffset: null,
        saturation: null,
        energyOverride: null,
        custom: new Map(),
      },
      triggerEvents: [],
      activeEffectsWithProgress: [],
      zoneOverride: null,
      colorOverride: null,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🏭 SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let injectorInstance: ChronosInjector | null = null

/**
 * Obtiene la instancia singleton del ChronosInjector
 */
export function getChronosInjector(): ChronosInjector {
  if (!injectorInstance) {
    injectorInstance = new ChronosInjector()
  }
  return injectorInstance
}

/**
 * Resetea la instancia (para testing)
 */
export function resetChronosInjector(): void {
  if (injectorInstance) {
    injectorInstance.reset()
  }
  injectorInstance = null
}
