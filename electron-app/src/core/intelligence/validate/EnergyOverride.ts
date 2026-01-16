/**
 * ⚡ WAVE 500: ENERGY OVERRIDE - La Ley del Drop
 * ===============================================
 * 
 * "En los drops, la física manda. En los valles, Selene piensa."
 * 
 * Esta es la regla más importante de la consciencia:
 * Cuando la energía supera el umbral, TODAS las decisiones de
 * modulación son anuladas y la física toma el control total.
 * 
 * FILOSOFÍA:
 * - Los drops son momentos SAGRADOS
 * - El público espera REACCIÓN MÁXIMA
 * - Selene no debe "pensar" durante un clímax
 * - La física reactiva ES la respuesta correcta
 * 
 * @module core/intelligence/validate/EnergyOverride
 * @version 500.0.0
 */

import {
  type TitanStabilizedState,
  type ConsciousnessOutput,
  ENERGY_OVERRIDE_THRESHOLD,
  createEmptyOutput,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

/** 
 * Umbral de energía para activar override (0.85)
 * Por encima de este valor, la física tiene VETO TOTAL
 */
export { ENERGY_OVERRIDE_THRESHOLD }

/**
 * Output fijo cuando Energy Override está activo
 * Strobe/Flash al máximo, sin modulaciones
 */
const OVERRIDE_OUTPUT: ConsciousnessOutput = {
  colorDecision: null,  // No modular colores
  physicsModifier: {
    strobeIntensity: 1.0,     // Full power strobe
    flashIntensity: 1.0,      // Full power flash
    triggerThresholdMod: 1.0, // Sensibilidad normal
    confidence: 1.0,          // Máxima confianza en override
  },
  movementDecision: null,  // No modular movimiento
  effectDecision: null,    // 🧨 WAVE 600: No forzar efectos en override
  confidence: 1.0,
  timestamp: 0,  // Se actualiza en cada llamada
  source: 'hunt',
  debugInfo: {
    huntState: 'striking',
    beautyScore: 1.0,
    consonance: 1.0,
    beautyTrend: 'stable',
    biasesDetected: [],
    cyclesInCurrentState: 0,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔥 Verifica si Energy Override está activo
 * 
 * @param energy Energía suavizada (0-1)
 * @returns true si estamos en modo drop
 */
export function isEnergyOverrideActive(energy: number): boolean {
  return energy > ENERGY_OVERRIDE_THRESHOLD
}

/**
 * ⚡ Aplica Energy Override si es necesario
 * 
 * Si la energía supera el umbral, devuelve output de override.
 * Si no, devuelve null (procesar normalmente).
 * 
 * @param state Estado de Titan
 * @returns ConsciousnessOutput de override, o null si no aplica
 * 
 * @example
 * ```typescript
 * const override = applyEnergyOverride(state)
 * if (override) {
 *   // Estamos en DROP - devolver override directamente
 *   return override
 * }
 * // Procesar normalmente
 * ```
 */
export function applyEnergyOverride(
  state: TitanStabilizedState
): ConsciousnessOutput | null {
  
  // Check umbral
  if (!isEnergyOverrideActive(state.smoothedEnergy)) {
    return null  // No override, procesar normalmente
  }
  
  // 🔥 DROP MODE ACTIVO
  return {
    ...OVERRIDE_OUTPUT,
    timestamp: state.timestamp,
    debugInfo: {
      ...OVERRIDE_OUTPUT.debugInfo,
      // Incluir info adicional para debug
      activePrediction: undefined,
      lastDream: undefined,
    },
  }
}

/**
 * 📊 Obtiene información de debug sobre Energy Override
 * 
 * @param state Estado de Titan
 * @returns Info para logs/UI
 */
export function getEnergyOverrideInfo(state: TitanStabilizedState): {
  active: boolean
  energy: number
  threshold: number
  margin: number
  reason: string
} {
  const active = isEnergyOverrideActive(state.smoothedEnergy)
  const margin = state.smoothedEnergy - ENERGY_OVERRIDE_THRESHOLD
  
  return {
    active,
    energy: state.smoothedEnergy,
    threshold: ENERGY_OVERRIDE_THRESHOLD,
    margin: Math.abs(margin),
    reason: active 
      ? `DROP MODE: Energy ${(state.smoothedEnergy * 100).toFixed(0)}% > ${(ENERGY_OVERRIDE_THRESHOLD * 100).toFixed(0)}%` 
      : `VALLEY MODE: Energy ${(state.smoothedEnergy * 100).toFixed(0)}% < ${(ENERGY_OVERRIDE_THRESHOLD * 100).toFixed(0)}%`,
  }
}

/**
 * 🎚️ Calcula cuánto falta para activar/desactivar override
 * 
 * Útil para predicción y UI.
 * 
 * @param state Estado de Titan
 * @returns Distancia al umbral (positivo = sobre umbral, negativo = bajo)
 */
export function getEnergyDistanceToThreshold(state: TitanStabilizedState): number {
  return state.smoothedEnergy - ENERGY_OVERRIDE_THRESHOLD
}

/**
 * 🔮 Predice si el override se activará pronto
 * 
 * Basado en:
 * - Energía actual
 * - Si estamos en buildup/drop detectado
 * - Sección musical
 * 
 * @param state Estado de Titan
 * @returns Probabilidad de override en próximos 2 segundos (0-1)
 */
export function predictEnergyOverride(state: TitanStabilizedState): number {
  // Ya estamos en override
  if (isEnergyOverrideActive(state.smoothedEnergy)) {
    return 1.0
  }
  
  // Calcular probabilidad basada en cercanía al umbral
  const distance = ENERGY_OVERRIDE_THRESHOLD - state.smoothedEnergy
  
  // Factores que aumentan probabilidad
  let probability = 0
  
  // Factor 1: Cercanía al umbral (0.75-0.85 = alta probabilidad)
  if (state.smoothedEnergy > 0.70) {
    probability += (state.smoothedEnergy - 0.70) / 0.15 * 0.5  // 0-0.5
  }
  
  // Factor 2: Sección musical
  if (state.sectionType === 'build') {
    probability += 0.3
  } else if (state.sectionType === 'drop') {
    probability += 0.5  // Drop detectado, casi seguro
  }
  
  // Factor 3: isDropActive del FSM
  if (state.isDropActive) {
    probability += 0.2
  }
  
  return Math.min(1.0, probability)
}
