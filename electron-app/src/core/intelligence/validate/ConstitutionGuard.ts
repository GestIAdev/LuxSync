/**
 * 📜 WAVE 500: CONSTITUTION GUARD - El Guardián de la Ley
 * =========================================================
 * 
 * "La Constitución es LEY. Selene no la cuestiona, pero la interpreta."
 * 
 * Este módulo garantiza que TODA decisión de consciencia respete
 * las reglas del Vibe activo (GenerationOptions / Constitution).
 * 
 * RESPONSABILIDADES:
 * - Validar hues contra forbiddenHueRanges
 * - Validar saturación/luminosidad contra rangos
 * - Auto-corregir decisiones inválidas
 * - Log de violaciones evitadas
 * 
 * @module core/intelligence/validate/ConstitutionGuard
 * @version 500.0.0
 */

import type { GenerationOptions } from '../../../engine/color/SeleneColorEngine'
import {
  type ConsciousnessColorDecision,
  type ConsciousnessMovementDecision,
  clampColorDecision,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado de validación
 */
export interface ValidationResult {
  /** ¿Es válida la decisión? */
  isValid: boolean
  
  /** Violaciones detectadas */
  violations: ValidationViolation[]
  
  /** Decisión corregida (si había violaciones) */
  correctedDecision: ConsciousnessColorDecision | null
}

/**
 * Una violación específica
 */
export interface ValidationViolation {
  /** Tipo de violación */
  type: 'forbidden_hue' | 'saturation_out_of_range' | 'lightness_out_of_range' | 'forbidden_strategy'
  
  /** Valor original */
  originalValue: number | string
  
  /** Valor corregido */
  correctedValue: number | string
  
  /** Descripción legible */
  description: string
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE VALIDACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔍 Valida una decisión de color contra la Constitución
 * 
 * @param decision Decisión de la consciencia
 * @param constitution Constitución del Vibe activo
 * @returns Resultado con validación y correcciones
 */
export function validateColorDecision(
  decision: ConsciousnessColorDecision | null,
  constitution: GenerationOptions
): ValidationResult {
  
  // Decisión nula = válida (no hay nada que validar)
  if (!decision) {
    return {
      isValid: true,
      violations: [],
      correctedDecision: null,
    }
  }
  
  const violations: ValidationViolation[] = []
  let corrected = { ...decision }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 1. VALIDAR HUE CONTRA FORBIDDEN RANGES
  // ─────────────────────────────────────────────────────────────────────────
  if (decision.suggestedHue !== undefined) {
    const forbiddenRanges = constitution.forbiddenHueRanges ?? []
    
    for (const [min, max] of forbiddenRanges) {
      if (isHueInRange(decision.suggestedHue, min, max)) {
        // VIOLACIÓN: Hue está en rango prohibido
        const nearestAllowed = findNearestAllowedHue(
          decision.suggestedHue,
          constitution.allowedHueRanges ?? [[0, 360]],
          forbiddenRanges
        )
        
        violations.push({
          type: 'forbidden_hue',
          originalValue: decision.suggestedHue,
          correctedValue: nearestAllowed,
          description: `Hue ${decision.suggestedHue}° está en rango prohibido [${min}°-${max}°], corregido a ${nearestAllowed}°`,
        })
        
        corrected.suggestedHue = nearestAllowed
        break  // Solo reportar primera violación de hue
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 2. VALIDAR SATURACIÓN
  // ─────────────────────────────────────────────────────────────────────────
  if (decision.saturationMod !== undefined) {
    const [minSat, maxSat] = constitution.saturationRange ?? [0, 100]
    
    // El modifier va de 0.8 a 1.2 (±20%)
    // No podemos validar directamente contra el rango absoluto,
    // pero sí limitar el modifier
    const clampedMod = Math.max(0.8, Math.min(1.2, decision.saturationMod))
    
    if (clampedMod !== decision.saturationMod) {
      violations.push({
        type: 'saturation_out_of_range',
        originalValue: decision.saturationMod,
        correctedValue: clampedMod,
        description: `Saturación modifier ${decision.saturationMod.toFixed(2)} fuera de rango [0.8-1.2], corregido a ${clampedMod.toFixed(2)}`,
      })
      
      corrected.saturationMod = clampedMod
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 3. VALIDAR LUMINOSIDAD
  // ─────────────────────────────────────────────────────────────────────────
  if (decision.brightnessMod !== undefined) {
    const clampedMod = Math.max(0.8, Math.min(1.2, decision.brightnessMod))
    
    if (clampedMod !== decision.brightnessMod) {
      violations.push({
        type: 'lightness_out_of_range',
        originalValue: decision.brightnessMod,
        correctedValue: clampedMod,
        description: `Brightness modifier ${decision.brightnessMod.toFixed(2)} fuera de rango [0.8-1.2], corregido a ${clampedMod.toFixed(2)}`,
      })
      
      corrected.brightnessMod = clampedMod
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 4. VALIDAR ESTRATEGIA
  // ─────────────────────────────────────────────────────────────────────────
  if (decision.suggestedStrategy !== undefined) {
    // Si la constitution fuerza una estrategia, ignorar sugerencia
    if (constitution.forceStrategy && 
        decision.suggestedStrategy !== constitution.forceStrategy) {
      violations.push({
        type: 'forbidden_strategy',
        originalValue: decision.suggestedStrategy,
        correctedValue: constitution.forceStrategy,
        description: `Estrategia ${decision.suggestedStrategy} no permitida, Constitution fuerza ${constitution.forceStrategy}`,
      })
      
      corrected.suggestedStrategy = constitution.forceStrategy as typeof decision.suggestedStrategy
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    correctedDecision: violations.length > 0 ? corrected : null,
  }
}

/**
 * 🛡️ Aplica correcciones automáticas a una decisión
 * 
 * Combina validateColorDecision + aplicar correcciones.
 * 
 * @param decision Decisión original
 * @param constitution Constitución del Vibe
 * @returns Decisión corregida (o la original si era válida)
 */
export function enforceConstitution(
  decision: ConsciousnessColorDecision | null,
  constitution: GenerationOptions
): ConsciousnessColorDecision | null {
  
  if (!decision) return null
  
  const result = validateColorDecision(decision, constitution)
  
  if (result.isValid) {
    return decision
  }
  
  return result.correctedDecision
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES PRIVADAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica si un hue está dentro de un rango (considerando wrap-around)
 */
function isHueInRange(hue: number, min: number, max: number): boolean {
  // Normalizar hue a 0-360
  const normalizedHue = ((hue % 360) + 360) % 360
  
  if (min <= max) {
    // Rango normal: [60, 120]
    return normalizedHue >= min && normalizedHue <= max
  } else {
    // Rango con wrap-around: [330, 30] = [330-360] + [0-30]
    return normalizedHue >= min || normalizedHue <= max
  }
}

/**
 * Encuentra el hue permitido más cercano al prohibido
 */
function findNearestAllowedHue(
  forbiddenHue: number,
  allowedRanges: [number, number][],
  forbiddenRanges: [number, number][]
): number {
  // Normalizar
  const hue = ((forbiddenHue % 360) + 360) % 360
  
  // Si no hay rangos permitidos, usar todo el espectro
  if (allowedRanges.length === 0) {
    allowedRanges = [[0, 360]]
  }
  
  // Buscar el punto permitido más cercano
  let nearestHue = hue
  let minDistance = Infinity
  
  // Probar bordes de rangos prohibidos
  for (const [min, max] of forbiddenRanges) {
    // Probar justo antes del rango prohibido
    const beforeMin = (min - 1 + 360) % 360
    if (!isHueInAnyForbiddenRange(beforeMin, forbiddenRanges)) {
      const dist = hueDistance(hue, beforeMin)
      if (dist < minDistance) {
        minDistance = dist
        nearestHue = beforeMin
      }
    }
    
    // Probar justo después del rango prohibido
    const afterMax = (max + 1) % 360
    if (!isHueInAnyForbiddenRange(afterMax, forbiddenRanges)) {
      const dist = hueDistance(hue, afterMax)
      if (dist < minDistance) {
        minDistance = dist
        nearestHue = afterMax
      }
    }
  }
  
  return nearestHue
}

/**
 * Verifica si un hue está en algún rango prohibido
 */
function isHueInAnyForbiddenRange(hue: number, forbiddenRanges: [number, number][]): boolean {
  for (const [min, max] of forbiddenRanges) {
    if (isHueInRange(hue, min, max)) {
      return true
    }
  }
  return false
}

/**
 * Calcula distancia entre dos hues (considerando círculo)
 */
function hueDistance(hue1: number, hue2: number): number {
  const diff = Math.abs(hue1 - hue2)
  return Math.min(diff, 360 - diff)
}
