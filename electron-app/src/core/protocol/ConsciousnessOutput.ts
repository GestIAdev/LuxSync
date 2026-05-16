/**
 * 🧠 CONSCIOUSNESS OUTPUT - Interface de Comunicación
 * ====================================================
 * WAVE 450: CORE 3 - Despertar de Selene
 * 
 * Define la estructura de comunicación entre SeleneLuxConscious
 * y el resto del sistema (TitanEngine, SeleneLux, MasterArbiter).
 * 
 * FILOSOFÍA:
 * - Consciencia SUGIERE, no ORDENA
 * - Vibe RESTRINGE, Consciencia ELIGE dentro
 * - Física tiene VETO en alta energía (Energy Override)
 * 
 * @module engine/consciousness/ConsciousnessOutput
 * @version 450.0.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS BASE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de caza de la consciencia felina
 */
export type HuntState = 'sleeping' | 'stalking' | 'evaluating' | 'striking' | 'learning'

/**
 * Fuente de la decisión
 * 
 * WAVE 500 - PROJECT GENESIS: Añadidos nuevos sources nativos:
 * - 'prediction': Decisión basada en predicción musical anticipada
 * - 'beauty': Decisión tomada por búsqueda de belleza estética
 * - 'consonance': Decisión para mantener coherencia con estado anterior
 */
export type DecisionSource = 
  | 'hunt' 
  | 'dream' 
  | 'evolution' 
  | 'bias-correction' 
  | 'memory'
  | 'prediction'    // WAVE 500: Anticipación musical
  | 'beauty'        // WAVE 500: Maximización estética
  | 'consonance'    // WAVE 500: Coherencia temporal

// ═══════════════════════════════════════════════════════════════════════════
// DECISIÓN DE COLOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decisión de color de la consciencia
 * 
 * REGLA: suggestedHue DEBE estar dentro de los rangos permitidos por la Constitution
 * Si no está, será ignorado.
 */
export interface ConsciousnessColorDecision {
  /** Hue sugerido (0-360) - DEBE estar dentro de allowedHueRanges */
  suggestedHue?: number
  
  /** Estrategia sugerida - DEBE estar en las permitidas por el Vibe */
  suggestedStrategy?: 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'prism'
  
  /** Modificador de saturación (0.8-1.2) - NO puede romper saturationRange */
  saturationMod?: number
  
  /** Modificador de brillo (0.8-1.2) - NO puede romper lightnessRange */
  brightnessMod?: number
  
  /** Confianza en esta decisión (0-1) */
  confidence: number
  
  /** Razón de la decisión (para debug/UI) */
  reasoning?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// MODIFICADOR DE FÍSICA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modificador de física reactiva
 * 
 * ⚠️ ENERGY OVERRIDE (WAVE 450 ENMIENDA):
 * Si energy > 0.85, estos modificadores son IGNORADOS.
 * La física tiene VETO TOTAL en los drops/clímax.
 */
export interface ConsciousnessPhysicsModifier {
  /**
   * Intensidad del strobe (0.3-1.0)
   * - 1.0 = Full power (default)
   * - 0.3 = Mínimo permitido (no se puede apagar completamente)
   * 
   * ⚠️ IGNORADO si energy > 0.85 (Energy Override)
   */
  strobeIntensity?: number
  
  /**
   * Intensidad del flash (0.3-1.0)
   * ⚠️ IGNORADO si energy > 0.85 (Energy Override)
   */
  flashIntensity?: number
  
  /**
   * Modificador del umbral de trigger (0.8-1.2)
   * - < 1.0 = Más sensible (dispara antes)
   * - > 1.0 = Menos sensible (dispara después)
   */
  triggerThresholdMod?: number
  
  /** Confianza en estos modificadores */
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DECISIÓN DE MOVIMIENTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decisión de movimiento de la consciencia
 * 
 * REGLA: pattern DEBE estar en allowedPatterns del VibeProfile
 */
export interface ConsciousnessMovementDecision {
  /** Patrón sugerido - DEBE estar en allowedPatterns */
  pattern?: 'sweep' | 'chase' | 'static' | 'mirror' | 'circle' | 'figure8' | 'wave'
  
  /** Multiplicador de velocidad (0.5-1.5) - dentro de speedRange */
  speedMultiplier?: number
  
  /** Confianza en esta decisión */
  confidence: number
  
  /** Razón del cambio */
  reasoning?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧨 WAVE 600: DECISIÓN DE EFECTO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decisión de efecto desde la consciencia
 * 
 * WAVE 600: Cuando la consciencia quiere disparar un efecto especial
 * (Solar Flare, Strobe Burst, etc.)
 * WAVE 810: Añadidas zonas movers_left/movers_right para targeting L/R
 */
export interface ConsciousnessEffectDecision {
  /** Tipo de efecto a disparar (e.g., 'solar_flare', 'strobe_burst') */
  effectType: string
  
  /** Intensidad del efecto (0-1) */
  intensity: number
  
  /** Zonas objetivo (default: 'all') 
   * WAVE 810: movers_left/movers_right para efectos L/R como CyberDualism */
  zones?: ('all' | 'front' | 'back' | 'movers' | 'movers_left' | 'movers_right' | 'pars')[]
  
  /** Razón del disparo */
  reason?: string
  
  /** Confianza en esta decisión */
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 CONSCIOUSNESS OUTPUT
 * 
 * Estructura principal que SeleneLuxConscious emite cada frame.
 * TitanEngine y SeleneLux consumen este output para modular su comportamiento.
 * 
 * WAVE 600: Añadido effectDecision para disparar efectos del arsenal.
 */
export interface ConsciousnessOutput {
  /** Decisión de color (opcional) */
  colorDecision: ConsciousnessColorDecision | null
  
  /** Modificadores de física (opcional) */
  physicsModifier: ConsciousnessPhysicsModifier | null
  
  /** Decisión de movimiento (opcional) */
  movementDecision: ConsciousnessMovementDecision | null
  
  /** 🧨 WAVE 600: Decisión de efecto (opcional) */
  effectDecision: ConsciousnessEffectDecision | null
  
  /** Confianza general del output (0-1) */
  confidence: number
  
  /** Timestamp de generación */
  timestamp: number
  
  /** Fuente de la decisión */
  source: DecisionSource
  
  /** Info de debug para UI/logs */
  debugInfo: ConsciousnessDebugInfo
}

/**
 * Información de debug de la consciencia
 * 
 * WAVE 500 - PROJECT GENESIS: Añadido 'reasoning' para trazabilidad completa
 * WAVE 667-669: Añadidos campos fuzzy para debug del sistema de decisión difusa
 */
export interface ConsciousnessDebugInfo {
  /** Estado actual de caza */
  huntState: HuntState
  
  /** Puntuación de belleza actual (0-1) */
  beautyScore: number
  
  /** Consonancia con estado anterior (0-1) */
  consonance: number
  
  /** Tendencia de belleza */
  beautyTrend: 'rising' | 'falling' | 'stable'
  
  /** Sesgos detectados (si hay) */
  biasesDetected: string[]
  
  /**
   * WAVE 500: Razonamiento humano-legible de la decisión
   * Explica POR QUÉ se tomó esta decisión
   */
  reasoning?: string
  
  /** Predicción activa (si hay) */
  activePrediction?: {
    type: string
    probability: number
    timeUntilMs: number
  }
  
  /** Ciclos en estado actual */
  cyclesInCurrentState: number
  
  /** Último sueño simulado (si hay) */
  lastDream?: {
    scenario: string
    beautyDelta: number
    recommendation: 'execute' | 'modify' | 'abort'
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎲 WAVE 667-669: FUZZY DECISION DEBUG INFO
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Acción decidida por el sistema fuzzy */
  fuzzyAction?: 'force_strike' | 'strike' | 'prepare' | 'hold'
  
  /** Z-Score actual de energía */
  zScore?: number
  
  /** Nivel de alerta del Drop Bridge */
  dropBridgeAlert?: 'none' | 'watching' | 'imminent' | 'activated'
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea un output vacío (consciencia dormida o sin decisiones)
 */
export function createEmptyOutput(): ConsciousnessOutput {
  return {
    colorDecision: null,
    physicsModifier: null,
    movementDecision: null,
    effectDecision: null,  // 🧨 WAVE 600
    confidence: 0,
    timestamp: Date.now(),
    source: 'hunt',
    debugInfo: {
      huntState: 'sleeping',
      beautyScore: 0,
      consonance: 0,
      beautyTrend: 'stable',
      biasesDetected: [],
      cyclesInCurrentState: 0,
    },
  }
}

/**
 * Valida que los modificadores de física respeten los límites
 */
export function clampPhysicsModifier(
  modifier: ConsciousnessPhysicsModifier
): ConsciousnessPhysicsModifier {
  return {
    ...modifier,
    // Strobe: mínimo 0.3 (no se puede apagar), máximo 1.0
    strobeIntensity: modifier.strobeIntensity 
      ? Math.max(0.3, Math.min(1.0, modifier.strobeIntensity))
      : undefined,
    // Flash: igual
    flashIntensity: modifier.flashIntensity
      ? Math.max(0.3, Math.min(1.0, modifier.flashIntensity))
      : undefined,
    // Threshold: 0.8-1.2
    triggerThresholdMod: modifier.triggerThresholdMod
      ? Math.max(0.8, Math.min(1.2, modifier.triggerThresholdMod))
      : undefined,
  }
}

/**
 * Valida que los modificadores de color respeten los límites
 */
export function clampColorDecision(
  decision: ConsciousnessColorDecision
): ConsciousnessColorDecision {
  return {
    ...decision,
    // Hue: 0-360 (wrap around)
    suggestedHue: decision.suggestedHue !== undefined
      ? ((decision.suggestedHue % 360) + 360) % 360
      : undefined,
    // Saturación: 0.8-1.2
    saturationMod: decision.saturationMod
      ? Math.max(0.8, Math.min(1.2, decision.saturationMod))
      : undefined,
    // Brillo: 0.8-1.2
    brightnessMod: decision.brightnessMod
      ? Math.max(0.8, Math.min(1.2, decision.brightnessMod))
      : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENERGY OVERRIDE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📜 WAVE 450 ENMIENDA: THE RULE OF COOL
 * 
 * Umbral de energía por encima del cual la física tiene VETO TOTAL.
 * Si energy > ENERGY_OVERRIDE_THRESHOLD, los modificadores de física son ignorados.
 * 
 * "En los drops, la física manda. En los valles, Selene piensa."
 */
export const ENERGY_OVERRIDE_THRESHOLD = 0.75  // WAVE 4829: 0.85→0.75 — captura drops latinos (0.75-0.82)

/**
 * Verifica si estamos en modo Energy Override (drop/clímax)
 */
export function isEnergyOverrideActive(energy: number): boolean {
  return energy > ENERGY_OVERRIDE_THRESHOLD
}

/**
 * Aplica Energy Override a los modificadores de física
 * 
 * Si energy > 0.85, devuelve modificadores neutros (1.0 = full power)
 */
export function applyEnergyOverride(
  modifier: ConsciousnessPhysicsModifier | null,
  energy: number
): ConsciousnessPhysicsModifier | null {
  if (!modifier) return null
  
  if (isEnergyOverrideActive(energy)) {
    // 🔥 DROP MODE: Física al máximo, Selene se calla
    return {
      strobeIntensity: 1.0,
      flashIntensity: 1.0,
      triggerThresholdMod: 1.0,
      confidence: 1.0,  // Máxima confianza en el override
    }
  }
  
  // Valle: Selene puede modular
  return modifier
}
