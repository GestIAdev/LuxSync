// ═══════════════════════════════════════════════════════════════════════════
//  🎯 DECISION MAKER - El Juez Final
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  "Combina hunt + prediction + context → Decisión única"
// ═══════════════════════════════════════════════════════════════════════════

import type { 
  ConsciousnessOutput, 
  ConsciousnessColorDecision,
  ConsciousnessPhysicsModifier,
  SeleneMusicalPattern,
} from '../types'
import { createEmptyOutput } from '../types'
import type { HuntDecision } from './HuntEngine'
import type { MusicalPrediction } from './PredictionEngine'
import type { BeautyAnalysis } from '../sense/BeautySensor'
import type { ConsonanceAnalysis } from '../sense/ConsonanceSensor'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Todos los inputs para tomar una decisión
 */
export interface DecisionInputs {
  /** Patrón musical actual */
  pattern: SeleneMusicalPattern
  
  /** Análisis de belleza */
  beauty: BeautyAnalysis
  
  /** Análisis de consonancia */
  consonance: ConsonanceAnalysis
  
  /** Decisión del hunt engine */
  huntDecision: HuntDecision
  
  /** Predicción del prediction engine */
  prediction: MusicalPrediction
  
  /** Timestamp */
  timestamp: number
}

/**
 * Configuración del decision maker
 */
export interface DecisionMakerConfig {
  /** Umbral mínimo de confianza para emitir decisión */
  minConfidenceThreshold: number
  
  /** Peso del hunt en la decisión final */
  huntWeight: number
  
  /** Peso de la predicción en la decisión final */
  predictionWeight: number
  
  /** Peso de la belleza en la decisión final */
  beautyWeight: number
  
  /** Modo agresivo (más cambios) */
  aggressiveMode: boolean
}

const DEFAULT_CONFIG: DecisionMakerConfig = {
  minConfidenceThreshold: 0.55,
  huntWeight: 0.40,
  predictionWeight: 0.30,
  beautyWeight: 0.30,
  aggressiveMode: false,
}

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 WAVE 811: VIBE-SPECIFIC EFFECT SELECTION
// El lóbulo frontal decide QUÉ efecto usar según el contexto musical
// ═══════════════════════════════════════════════════════════════════════════

import type { StrikeConditions } from './HuntEngine'

interface EffectSelection {
  effect: string
  intensity: number
  zones: ('all' | 'front' | 'back' | 'movers' | 'movers_left' | 'movers_right' | 'pars')[]
  reasoning: string
}

/**
 * 🎯 WAVE 811: UNIFIED EFFECT SELECTOR
 * 🔪 WAVE 813: TECHNO PALETTE REBALANCE
 * 🛡️ WAVE 814: NULL RETURNS - Permite devolver null para decisiones débiles
 * 
 * DecisionMaker es el lóbulo frontal - elige efecto según vibe y contexto.
 * Cada familia de vibes tiene su propia personalidad y arsenal.
 * 
 * Si devuelve null, significa "no tengo decisión fuerte, que el Selector use su fallback".
 */
function selectEffectByVibe(
  vibeId: string,
  strikeIntensity: number,
  conditions: StrikeConditions | null | undefined
): EffectSelection | null {
  const normalizedIntensity = Math.min(1.0, 0.8 + strikeIntensity * 0.2)
  const urgency = conditions?.urgencyScore ?? 0.5
  const trend = conditions?.trend ?? 'stable'
  const beautyScore = conditions?.beautyScore ?? 0.5
  
  // � WAVE 813: TECHNO FAMILY - La Máquina No Perdona
  // Arsenal: IndustrialStrobe (martillo), AcidSweep (cuchilla), CyberDualism (cambio)
  // Filosofía: Agresivo, industrial, mecánico. SolarFlare DESTERRADO.
  if (vibeId === 'techno-club' || vibeId === 'techno' || vibeId === 'industrial') {
    
    // 🔨 EL MARTILLO (IndustrialStrobe) - Drop/Peak Time/Alta Energía
    // Condición: urgency > 0.7 (climax) O strikeIntensity > 0.8 (peak)
    if (urgency > 0.7 || strikeIntensity > 0.8) {
      return {
        effect: 'industrial_strobe',
        intensity: normalizedIntensity,
        zones: ['all'],
        reasoning: `TECHNO HAMMER: urgency=${urgency.toFixed(2)} intensity=${strikeIntensity.toFixed(2)}`
      }
    }
    
    // ⚡ LA CUCHILLA (AcidSweep) - Buildup/Rising Tension
    // Condición: beautyScore > 0.4 (tensión) O trend === 'rising'
    if (beautyScore > 0.4 || trend === 'rising') {
      return {
        effect: 'acid_sweep',
        intensity: Math.min(1.0, 0.7 + beautyScore * 0.3),
        zones: ['all'],
        reasoning: `TECHNO BLADE: beauty=${beautyScore.toFixed(2)} trend=${trend}`
      }
    }
    
    // 🤖 EL CAMBIO (CyberDualism) - Transición/Bridge
    // Condición: strikeScore alto (momento único) O trend === 'stable' (plateau)
    const strikeScore = conditions?.strikeScore ?? 0
    if (strikeScore > 0.7 || trend === 'stable') {
      return {
        effect: 'cyber_dualism',
        intensity: normalizedIntensity * 0.9,
        zones: ['movers_left', 'movers_right'],
        reasoning: `TECHNO SHIFT: strikeScore=${strikeScore.toFixed(2)} trend=${trend}`
      }
    }
    
    // 🔪 DEFAULT TECHNO: AcidSweep (ambiente agresivo, no explosión)
    // Filosofía: Fallar hacia ambiente volumétrico, no hacia impacto dorado
    return {
      effect: 'acid_sweep',
      intensity: normalizedIntensity * 0.75,
      zones: ['all'],
      reasoning: `TECHNO DEFAULT: ambient fallback`
    }
  }
  
  // 💃 LATINO FAMILY: Efectos cálidos, dorados, explosivos
  if (vibeId === 'fiesta-latina' || vibeId === 'latino' || vibeId === 'tropical') {
    // Alta urgencia → SolarFlare (explosión dorada)
    if (urgency > 0.6 || strikeIntensity > 0.75) {
      return {
        effect: 'solar_flare',
        intensity: normalizedIntensity,
        zones: ['all'],
        reasoning: `LATINO FLARE: urgency=${urgency.toFixed(2)} intensity=${strikeIntensity.toFixed(2)}`
      }
    }
    
    // Tensión moderada → StrobeBurst (destello rítmico)
    if (beautyScore > 0.3) {
      return {
        effect: 'strobe_burst',
        intensity: Math.min(1.0, 0.75 + beautyScore * 0.25),
        zones: ['movers'],
        reasoning: `LATINO BURST: beauty=${beautyScore.toFixed(2)}`
      }
    }
    
    // Default latino → SolarFlare (es el signature del vibe)
    return {
      effect: 'solar_flare',
      intensity: normalizedIntensity * 0.9,
      zones: ['all'],
      reasoning: `LATINO DEFAULT: golden signature`
    }
  }
  
  // 🎵 FALLBACK: Si no reconocemos el vibe, usar SolarFlare como safe default
  console.warn(`[DecisionMaker 🧠] Unknown vibe: ${vibeId}, defaulting to solar_flare`)
  return {
    effect: 'solar_flare',
    intensity: normalizedIntensity * 0.8,
    zones: ['all'],
    reasoning: `UNKNOWN VIBE: ${vibeId} → safe fallback`
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toma la decisión final combinando todos los inputs
 * 
 * @param inputs - Todos los inputs necesarios
 * @param config - Configuración opcional
 * @returns ConsciousnessOutput con la decisión
 */
export function makeDecision(
  inputs: DecisionInputs,
  config: Partial<DecisionMakerConfig> = {}
): ConsciousnessOutput {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // Crear output base
  const output = createEmptyOutput()
  output.timestamp = inputs.timestamp
  output.source = 'hunt'
  
  // Calcular confianza combinada
  const combinedConfidence = calculateCombinedConfidence(inputs, cfg)
  
  // ¿Suficiente confianza para decidir?
  if (combinedConfidence < cfg.minConfidenceThreshold) {
    output.confidence = combinedConfidence
    output.debugInfo.huntState = inputs.huntDecision.suggestedPhase
    output.debugInfo.reasoning = `Confianza insuficiente: ${combinedConfidence.toFixed(2)} < ${cfg.minConfidenceThreshold}`
    return output
  }
  
  // Determinar tipo de decisión basado en contexto
  const decisionType = determineDecisionType(inputs)
  
  // Generar decisiones específicas
  switch (decisionType) {
    case 'strike':
      return generateStrikeDecision(inputs, output, combinedConfidence)
    
    case 'prepare_for_drop':
      return generateDropPreparationDecision(inputs, output, combinedConfidence)
    
    case 'buildup_enhance':
      return generateBuildupEnhanceDecision(inputs, output, combinedConfidence)
    
    case 'subtle_shift':
      return generateSubtleShiftDecision(inputs, output, combinedConfidence)
    
    case 'hold':
    default:
      output.confidence = combinedConfidence * 0.5
      output.debugInfo.huntState = inputs.huntDecision.suggestedPhase
      output.debugInfo.reasoning = 'Hold - sin acción necesaria'
      return output
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE DECISIÓN
// ═══════════════════════════════════════════════════════════════════════════

type DecisionType = 
  | 'strike'            // Strike del hunt engine
  | 'prepare_for_drop'  // Preparar para drop predicho
  | 'buildup_enhance'   // Potenciar buildup
  | 'subtle_shift'      // Cambio sutil basado en belleza
  | 'hold'              // Mantener sin cambios

/**
 * 🔥 WAVE 811: DecisionMaker es el ÚNICO decisor de efectos
 * 
 * HuntEngine solo reporta worthiness (0-1)
 * Aquí decidimos SI disparar y QUÉ efecto usar
 */
function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty } = inputs
  
  // 🔥 WAVE 811: Usar worthiness (0-1) en lugar de shouldStrike (boolean)
  // Prioridad 1: Momento digno detectado por HuntEngine
  const WORTHINESS_THRESHOLD = 0.65  // Umbral para considerar "digno de efecto"
  if (huntDecision.worthiness >= WORTHINESS_THRESHOLD && huntDecision.confidence > 0.50) {
    return 'strike'
  }
  
  // Prioridad 2: Drop predicho con alta probabilidad
  if (prediction.type === 'drop_incoming' && prediction.probability > 0.8) {
    return 'prepare_for_drop'
  }
  
  // Prioridad 3: Buildup con potencial
  if (pattern.section === 'buildup' || 
      (prediction.type === 'buildup_starting' && prediction.probability > 0.7)) {
    return 'buildup_enhance'
  }
  
  // Prioridad 4: Belleza alta + tendencia positiva
  if (beauty.totalBeauty > 0.75 && beauty.trend === 'rising') {
    return 'subtle_shift'
  }
  
  // Default: Hold
  return 'hold'
}

function calculateCombinedConfidence(
  inputs: DecisionInputs,
  cfg: DecisionMakerConfig
): number {
  const huntConf = inputs.huntDecision.confidence
  const predConf = inputs.prediction.probability
  const beautyConf = inputs.beauty.totalBeauty
  
  // Ponderación
  let combined = 
    huntConf * cfg.huntWeight +
    predConf * cfg.predictionWeight +
    beautyConf * cfg.beautyWeight
  
  // 🔥 WAVE 811: Usar worthiness en lugar de shouldStrike
  // Bonus si múltiples fuentes coinciden
  if (inputs.huntDecision.worthiness > 0.65 && 
      inputs.prediction.type !== 'none' &&
      inputs.beauty.trend === 'rising') {
    combined = Math.min(1, combined + 0.1)
  }
  
  // Penalización si hay señales contradictorias
  if (inputs.huntDecision.suggestedPhase === 'sleeping' &&
      inputs.prediction.probability > 0.8) {
    combined *= 0.85
  }
  
  return combined
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERADORES DE DECISIONES ESPECÍFICAS
// ═══════════════════════════════════════════════════════════════════════════

function generateStrikeDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { huntDecision, beauty, consonance, pattern } = inputs
  
  output.confidence = confidence
  output.source = 'hunt'
  output.debugInfo.huntState = 'striking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.consonance = consonance.totalConsonance
  output.debugInfo.reasoning = `STRIKE: ${huntDecision.reasoning}`
  
  // Color decision: Cambio más agresivo
  output.colorDecision = {
    suggestedStrategy: pattern.emotionalTension > 0.6 ? 'complementary' : 'triadic',
    saturationMod: 1.0 + beauty.totalBeauty * 0.15,
    brightnessMod: 1.0 + pattern.rhythmicIntensity * 0.10,
    confidence: confidence,
    reasoning: `Strike (beauty=${beauty.totalBeauty.toFixed(2)})`,
  }
  
  // Physics modifier: Intensidad según contexto
  output.physicsModifier = {
    strobeIntensity: 0.7 + pattern.rhythmicIntensity * 0.3,
    flashIntensity: 0.8 + beauty.totalBeauty * 0.2,
    confidence: confidence,
  }
  
  // 🧨 WAVE 600: SOLAR FLARE TRIGGER
  // 🔥 WAVE 635: SNIPER CALIBRATION - Energy Veto + Weighted Scoring
  // 🔥 WAVE 642: ENERGY UNIFICATION - Ahora usa rawEnergy (GAMMA directo)
  const urgency = huntDecision.conditions?.urgencyScore ?? 0
  const tension = pattern.emotionalTension
  
  // 🛡️ WAVE 635.1 → WAVE 640 → WAVE 642: THE ENERGY VETO (Anti-Silence)
  // 🔥 WAVE 642: Ahora usa rawEnergy (GAMMA sin tocar) en lugar de smoothedEnergy
  // - rawEnergy refleja el momento REAL (0.97 en un drop)
  // - smoothedEnergy solo para visual base (evita flicker)
  const hasPhysicalEnergy = pattern.rawEnergy >= 0.20
  
  if (!hasPhysicalEnergy) {
    output.debugInfo.reasoning = `ENERGY VETO: rawEnergy=${pattern.rawEnergy.toFixed(2)} < 0.20 (silence/noise detected)`
    console.log(`[DecisionMaker 🛡️] ${output.debugInfo.reasoning}`)
    return output
  }
  
  // 🔥 WAVE 811: UNIFIED BRAIN PROTOCOL - El lóbulo frontal decide QUÉ efecto
  // 🛡️ WAVE 814: NULL HANDLING - Si DecisionMaker no tiene decisión fuerte, devuelve null
  // Ya no hardcodeamos solar_flare. DecisionMaker es EL JUEZ que elige por vibe.
  if (confidence > 0.50) {
    const strikeIntensity = Math.max(urgency, tension, 0.7)  // Mínimo 70%
    const effectSelection = selectEffectByVibe(pattern.vibeId, strikeIntensity, huntDecision.conditions ?? undefined)
    
    // 🛡️ WAVE 814: Si DecisionMaker devolvió null, significa "no tengo decisión fuerte"
    // El ContextualEffectSelector aplicará su fallback vibe-aware
    if (effectSelection !== null) {
      output.effectDecision = {
        effectType: effectSelection.effect,
        intensity: effectSelection.intensity,
        zones: effectSelection.zones as ('all' | 'front' | 'back' | 'movers' | 'pars' | 'movers_left' | 'movers_right')[],
        reason: `HUNT STRIKE [${pattern.vibeId}]! effect=${effectSelection.effect} urgency=${urgency.toFixed(2)} tension=${tension.toFixed(2)} worthiness=${huntDecision.worthiness.toFixed(2)} rawEnergy=${pattern.rawEnergy.toFixed(2)}`,
        confidence: confidence,
      }
      
      // 🔥 WAVE 811: Log de INTENCIÓN - NO de ejecución. El FIRED solo viene de EffectManager
      console.log(`[DecisionMaker 🧠] INTENT: ${effectSelection.effect} [${pattern.vibeId}] | intensity=${output.effectDecision?.intensity.toFixed(2)} | worthiness=${huntDecision.worthiness.toFixed(2)}`)
    } else {
      // 🛡️ WAVE 814: DecisionMaker no tiene decisión → delegar a ContextualEffectSelector
      console.log(`[DecisionMaker 🛡️] NO STRONG DECISION [${pattern.vibeId}] → ContextualEffectSelector will apply vibe-aware fallback`)
    }
  }
  
  return output
}

function generateDropPreparationDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { prediction, beauty, pattern } = inputs
  
  output.confidence = confidence
  output.source = 'prediction'
  output.debugInfo.huntState = 'evaluating'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.reasoning = `Preparando drop: ${prediction.reasoning}`
  
  // Color decision: Preparar transición
  output.colorDecision = {
    saturationMod: 1.05, // Sutil aumento
    brightnessMod: 0.95, // Ligera bajada antes del impacto
    confidence: prediction.probability,
    reasoning: `Pre-drop (prob=${prediction.probability.toFixed(2)})`,
  }
  
  // Physics modifier: Contención antes del estallido
  output.physicsModifier = {
    strobeIntensity: 0.3 + pattern.emotionalTension * 0.3,
    flashIntensity: 0.2,
    confidence: prediction.probability,
  }
  
  return output
}

function generateBuildupEnhanceDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { beauty, pattern, consonance } = inputs
  
  output.confidence = confidence
  output.source = 'prediction'
  output.debugInfo.huntState = 'stalking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.consonance = consonance.totalConsonance
  output.debugInfo.reasoning = 'Potenciando buildup'
  
  // Color decision: Incremento gradual
  const intensityFactor = pattern.emotionalTension * 0.1
  
  output.colorDecision = {
    saturationMod: 1.0 + intensityFactor,
    brightnessMod: 1.0 + intensityFactor * 0.5,
    confidence: confidence * 0.8,
    reasoning: `Buildup enhance (tension=${pattern.emotionalTension.toFixed(2)})`,
  }
  
  // Physics modifier: Gradual
  output.physicsModifier = {
    strobeIntensity: 0.2 + pattern.emotionalTension * 0.4,
    flashIntensity: 0.3 + pattern.rhythmicIntensity * 0.3,
    confidence: confidence * 0.7,
  }
  
  return output
}

function generateSubtleShiftDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { beauty, consonance, pattern } = inputs
  
  output.confidence = confidence * 0.7 // Decisiones sutiles = menor confianza
  output.source = 'beauty'
  output.debugInfo.huntState = 'stalking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.consonance = consonance.totalConsonance
  output.debugInfo.beautyTrend = beauty.trend
  output.debugInfo.reasoning = `Belleza alta (${beauty.totalBeauty.toFixed(2)}), ajuste sutil`
  
  // Color decision: Muy sutil
  output.colorDecision = {
    saturationMod: 1.0 + (beauty.totalBeauty - 0.5) * 0.05,
    brightnessMod: 1.0,
    confidence: confidence * 0.6,
    reasoning: `Subtle shift (beauty=${beauty.totalBeauty.toFixed(2)})`,
  }
  
  // Physics modifier: Mínimo
  output.physicsModifier = {
    strobeIntensity: pattern.rhythmicIntensity * 0.3,
    flashIntensity: 0.2,
    confidence: confidence * 0.5,
  }
  
  return output
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES PÚBLICAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Combina dos ConsciousnessOutput con ponderación
 */
export function mergeDecisions(
  primary: ConsciousnessOutput,
  secondary: ConsciousnessOutput,
  primaryWeight: number = 0.7
): ConsciousnessOutput {
  const secondaryWeight = 1 - primaryWeight
  
  const merged = createEmptyOutput()
  merged.timestamp = primary.timestamp
  merged.source = primary.source
  merged.confidence = primary.confidence * primaryWeight + secondary.confidence * secondaryWeight
  
  // Merge color decisions
  if (primary.colorDecision && secondary.colorDecision) {
    merged.colorDecision = {
      saturationMod: 
        (primary.colorDecision.saturationMod ?? 1) * primaryWeight +
        (secondary.colorDecision.saturationMod ?? 1) * secondaryWeight,
      brightnessMod:
        (primary.colorDecision.brightnessMod ?? 1) * primaryWeight +
        (secondary.colorDecision.brightnessMod ?? 1) * secondaryWeight,
      confidence: merged.confidence,
      reasoning: `Merged: ${primary.colorDecision.reasoning}`,
    }
  } else {
    merged.colorDecision = primary.colorDecision ?? secondary.colorDecision
  }
  
  // Merge physics modifiers
  if (primary.physicsModifier && secondary.physicsModifier) {
    merged.physicsModifier = {
      strobeIntensity:
        (primary.physicsModifier.strobeIntensity ?? 0) * primaryWeight +
        (secondary.physicsModifier.strobeIntensity ?? 0) * secondaryWeight,
      flashIntensity:
        (primary.physicsModifier.flashIntensity ?? 0) * primaryWeight +
        (secondary.physicsModifier.flashIntensity ?? 0) * secondaryWeight,
      confidence: merged.confidence,
    }
  } else {
    merged.physicsModifier = primary.physicsModifier ?? secondary.physicsModifier
  }
  
  merged.debugInfo = { ...primary.debugInfo }
  
  return merged
}

/**
 * Verifica si una decisión es significativa (vale la pena aplicar)
 */
export function isSignificantDecision(decision: ConsciousnessOutput): boolean {
  // Confianza mínima
  if (decision.confidence < 0.5) return false
  
  // Tiene decisión de color con cambio real
  if (decision.colorDecision) {
    const satChange = Math.abs((decision.colorDecision.saturationMod ?? 1) - 1)
    const brightChange = Math.abs((decision.colorDecision.brightnessMod ?? 1) - 1)
    if (satChange > 0.02 || brightChange > 0.02) return true
  }
  
  // Tiene modificador de física significativo
  if (decision.physicsModifier) {
    if ((decision.physicsModifier.strobeIntensity ?? 0) > 0.5) return true
    if ((decision.physicsModifier.flashIntensity ?? 0) > 0.5) return true
  }
  
  return false
}
