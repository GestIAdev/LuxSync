/**
 * 🌉 VIBE BRIDGE - Traductor Vibe → Consciousness
 * ================================================
 * WAVE 450: CORE 3 - Despertar de Selene
 * 
 * Convierte las restricciones del VibeManager (ColorConstitution, VibeProfile)
 * en un "bounded context" que la consciencia puede entender y respetar.
 * 
 * FILOSOFÍA:
 * "La Constitución es LEY. Selene no la cuestiona, pero la interpreta."
 * 
 * FLUJO:
 * 1. VibeManager.getColorConstitution() → GenerationOptions
 * 2. VibeBridge.toBoundedContext() → ConsciousnessBounds
 * 3. SeleneLuxConscious.think(audio, bounds) → ConsciousnessOutput
 * 4. VibeBridge.validateDecision() → true/false
 * 
 * @module engine/consciousness/VibeBridge
 * @version 450.0.0
 */

import type { GenerationOptions } from '../color/SeleneColorEngine'
import type { VibeProfile, MoodType, ColorStrategy } from '../../types/VibeProfile'
import type { ConsciousnessColorDecision, ConsciousnessMovementDecision } from './ConsciousnessOutput'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bounded Context para la consciencia
 * 
 * Define QUÉ está permitido hacer. La consciencia elige DENTRO de estos límites.
 */
export interface ConsciousnessBounds {
  // ═══════════════════════════════════════════════════════════════════════
  // COLOR BOUNDS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Rangos de hue permitidos: [[min1, max1], [min2, max2], ...] */
  hueRanges: [number, number][]
  
  /** Rangos de hue PROHIBIDOS (tienen prioridad sobre permitidos) */
  forbiddenHueRanges: [number, number][]
  
  /** Rango de saturación permitido [min, max] (0-100) */
  saturationBounds: [number, number]
  
  /** Rango de luminosidad permitido [min, max] (0-100) */
  lightnessBounds: [number, number]
  
  /** Estrategias de color permitidas */
  allowedStrategies: ColorStrategy[]
  
  /** Temperatura atmosférica del Vibe (para gravedad térmica) */
  atmosphericTemp: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // MOVEMENT BOUNDS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Patrones de movimiento permitidos */
  allowedPatterns: string[]
  
  /** Rango de velocidad [min, max] (0-1) */
  speedRange: [number, number]
  
  /** Sync preferido ('beat' | 'measure' | 'phrase') */
  preferredSync: string
  
  // ═══════════════════════════════════════════════════════════════════════
  // PHYSICS BOUNDS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Efectos permitidos */
  allowedEffects: string[]
  
  /** Strobe permitido */
  strobeAllowed: boolean
  
  /** Rate máximo de strobe (Hz) */
  maxStrobeRate: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // MOOD BOUNDS
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Moods permitidos */
  allowedMoods: MoodType[]
  
  /** Mood fallback si el detectado no está permitido */
  fallbackMood: MoodType
  
  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ID del Vibe fuente */
  vibeId: string
  
  /** Timestamp de creación del bounded context */
  timestamp: number
}

/**
 * Resultado de validación de una decisión
 */
export interface ValidationResult {
  /** ¿Es válida la decisión? */
  isValid: boolean
  
  /** Razón si no es válida */
  reason?: string
  
  /** Sugerencia de corrección */
  suggestion?: Partial<ConsciousnessColorDecision>
}

// ═══════════════════════════════════════════════════════════════════════════
// VIBE BRIDGE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class VibeBridge {
  
  // ═══════════════════════════════════════════════════════════════════════
  // CONVERSIÓN: Constitution → Bounds
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🌉 Convierte ColorConstitution + VibeProfile a bounded context
   * 
   * @param constitution - GenerationOptions del VibeManager
   * @param profile - VibeProfile completo
   * @returns ConsciousnessBounds para la consciencia
   */
  static toBoundedContext(
    constitution: GenerationOptions,
    profile: VibeProfile
  ): ConsciousnessBounds {
    return {
      // Color bounds desde Constitution
      hueRanges: constitution.allowedHueRanges ?? [[0, 360]],
      forbiddenHueRanges: constitution.forbiddenHueRanges ?? [],
      saturationBounds: constitution.saturationRange ?? [0, 100],
      lightnessBounds: constitution.lightnessRange ?? [0, 100],
      allowedStrategies: this.extractAllowedStrategies(constitution, profile),
      atmosphericTemp: constitution.atmosphericTemp ?? 6500,
      
      // Movement bounds desde Profile
      allowedPatterns: profile.movement?.allowedPatterns ?? ['sweep', 'static'],
      speedRange: [
        profile.movement?.speedRange?.min ?? 0.3,
        profile.movement?.speedRange?.max ?? 1.0,
      ],
      preferredSync: profile.movement?.preferredSync ?? 'beat',
      
      // Physics bounds desde Profile
      allowedEffects: profile.effects?.allowed ?? [],
      strobeAllowed: (profile.effects?.maxStrobeRate ?? 10) > 0,
      maxStrobeRate: profile.effects?.maxStrobeRate ?? 10,
      
      // Mood bounds desde Profile
      allowedMoods: profile.mood?.allowed ?? ['calm', 'energetic'],
      fallbackMood: profile.mood?.fallback ?? 'calm',
      
      // Meta
      vibeId: profile.id,
      timestamp: Date.now(),
    }
  }
  
  /**
   * Extrae las estrategias permitidas de constitution + profile
   */
  private static extractAllowedStrategies(
    constitution: GenerationOptions,
    profile: VibeProfile
  ): ColorStrategy[] {
    // Si constitution fuerza una estrategia, solo esa
    if (constitution.forceStrategy) {
      return [constitution.forceStrategy as ColorStrategy]
    }
    
    // Si no, usar las del profile
    return profile.color?.strategies ?? ['analogous', 'complementary', 'triadic']
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // VALIDACIÓN DE DECISIONES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🔍 Valida que una decisión de color respete los bounds
   * 
   * @param decision - Decisión de la consciencia
   * @param bounds - Bounded context del Vibe
   * @returns Resultado de validación con posible sugerencia
   */
  static validateColorDecision(
    decision: ConsciousnessColorDecision,
    bounds: ConsciousnessBounds
  ): ValidationResult {
    // Validar hue
    if (decision.suggestedHue !== undefined) {
      const hue = decision.suggestedHue
      
      // Verificar que no esté en rangos prohibidos
      const inForbidden = bounds.forbiddenHueRanges.some(
        ([min, max]) => this.isHueInRange(hue, min, max)
      )
      
      if (inForbidden) {
        const nearestValid = this.findNearestValidHue(hue, bounds)
        return {
          isValid: false,
          reason: `Hue ${hue}° está en rango prohibido`,
          suggestion: { suggestedHue: nearestValid },
        }
      }
      
      // Verificar que esté en rangos permitidos
      const inAllowed = bounds.hueRanges.some(
        ([min, max]) => this.isHueInRange(hue, min, max)
      )
      
      if (!inAllowed) {
        const nearestValid = this.findNearestValidHue(hue, bounds)
        return {
          isValid: false,
          reason: `Hue ${hue}° no está en rangos permitidos`,
          suggestion: { suggestedHue: nearestValid },
        }
      }
    }
    
    // Validar estrategia
    if (decision.suggestedStrategy !== undefined) {
      const strategyAllowed = bounds.allowedStrategies.includes(decision.suggestedStrategy as ColorStrategy)
      if (!strategyAllowed) {
        return {
          isValid: false,
          reason: `Estrategia '${decision.suggestedStrategy}' no permitida`,
          suggestion: { suggestedStrategy: bounds.allowedStrategies[0] as ConsciousnessColorDecision['suggestedStrategy'] },
        }
      }
    }
    
    return { isValid: true }
  }
  
  /**
   * 🔍 Valida que una decisión de movimiento respete los bounds
   */
  static validateMovementDecision(
    decision: ConsciousnessMovementDecision,
    bounds: ConsciousnessBounds
  ): ValidationResult {
    // Validar patrón
    if (decision.pattern !== undefined) {
      if (!bounds.allowedPatterns.includes(decision.pattern)) {
        return {
          isValid: false,
          reason: `Patrón '${decision.pattern}' no permitido`,
        }
      }
    }
    
    // Validar velocidad
    if (decision.speedMultiplier !== undefined) {
      const [minSpeed, maxSpeed] = bounds.speedRange
      const effectiveSpeed = decision.speedMultiplier
      
      // speedMultiplier es multiplicador (0.5-1.5), verificar que el resultado esté en rango
      if (effectiveSpeed < 0.5 || effectiveSpeed > 1.5) {
        return {
          isValid: false,
          reason: `Speed multiplier ${effectiveSpeed} fuera de rango [0.5, 1.5]`,
        }
      }
    }
    
    return { isValid: true }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Verifica si un hue está en un rango (maneja wrap-around del círculo)
   */
  private static isHueInRange(hue: number, min: number, max: number): boolean {
    // Normalizar hue a 0-360
    const normalizedHue = ((hue % 360) + 360) % 360
    
    if (min <= max) {
      // Rango normal: [120, 240]
      return normalizedHue >= min && normalizedHue <= max
    } else {
      // Rango wrap-around: [300, 60] significa 300-360 y 0-60
      return normalizedHue >= min || normalizedHue <= max
    }
  }
  
  /**
   * Encuentra el hue válido más cercano al hue sugerido
   */
  private static findNearestValidHue(
    targetHue: number,
    bounds: ConsciousnessBounds
  ): number {
    const normalizedTarget = ((targetHue % 360) + 360) % 360
    let nearestHue = normalizedTarget
    let minDistance = Infinity
    
    // Buscar en rangos permitidos
    for (const [min, max] of bounds.hueRanges) {
      // Verificar que no esté en rangos prohibidos
      const isMinForbidden = bounds.forbiddenHueRanges.some(
        ([fMin, fMax]) => this.isHueInRange(min, fMin, fMax)
      )
      const isMaxForbidden = bounds.forbiddenHueRanges.some(
        ([fMin, fMax]) => this.isHueInRange(max, fMin, fMax)
      )
      
      // Probar extremos del rango
      if (!isMinForbidden) {
        const distMin = this.hueDistance(normalizedTarget, min)
        if (distMin < minDistance) {
          minDistance = distMin
          nearestHue = min
        }
      }
      
      if (!isMaxForbidden) {
        const distMax = this.hueDistance(normalizedTarget, max)
        if (distMax < minDistance) {
          minDistance = distMax
          nearestHue = max
        }
      }
      
      // Probar el centro del rango
      const center = (min + max) / 2
      const isCenterForbidden = bounds.forbiddenHueRanges.some(
        ([fMin, fMax]) => this.isHueInRange(center, fMin, fMax)
      )
      if (!isCenterForbidden) {
        const distCenter = this.hueDistance(normalizedTarget, center)
        if (distCenter < minDistance) {
          minDistance = distCenter
          nearestHue = center
        }
      }
    }
    
    return nearestHue
  }
  
  /**
   * Calcula distancia angular entre dos hues (0-180)
   */
  private static hueDistance(hue1: number, hue2: number): number {
    const diff = Math.abs(hue1 - hue2)
    return Math.min(diff, 360 - diff)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-CORRECCIÓN
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * 🔧 Auto-corrige una decisión para que respete los bounds
   * 
   * Si la decisión es inválida, la modifica para que sea válida.
   * Retorna la decisión corregida.
   */
  static autoCorrectColorDecision(
    decision: ConsciousnessColorDecision,
    bounds: ConsciousnessBounds
  ): ConsciousnessColorDecision {
    const validation = this.validateColorDecision(decision, bounds)
    
    if (validation.isValid) {
      return decision
    }
    
    // Aplicar sugerencia de corrección
    return {
      ...decision,
      ...validation.suggestion,
      // Reducir confianza porque fue auto-corregida
      confidence: decision.confidence * 0.8,
    }
  }
  
  /**
   * 🔧 Auto-corrige una decisión de movimiento
   */
  static autoCorrectMovementDecision(
    decision: ConsciousnessMovementDecision,
    bounds: ConsciousnessBounds
  ): ConsciousnessMovementDecision {
    const validation = this.validateMovementDecision(decision, bounds)
    
    if (validation.isValid) {
      return decision
    }
    
    // Si el patrón no está permitido, usar el primero permitido
    const correctedPattern = bounds.allowedPatterns[0] as any
    
    return {
      ...decision,
      pattern: decision.pattern && !bounds.allowedPatterns.includes(decision.pattern)
        ? correctedPattern
        : decision.pattern,
      speedMultiplier: Math.max(0.5, Math.min(1.5, decision.speedMultiplier ?? 1.0)),
      confidence: decision.confidence * 0.8,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default VibeBridge
