// ═══════════════════════════════════════════════════════════════════════════
//  🎯 DECISION MAKER - El Juez Final (EL ÚNICO GENERAL)
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  WAVE 1010 - FRONTAL LOBOTOMY - UNIFIED BRAIN
//  WAVE 1028 - THE CURATOR - Texture Awareness Integration
//  "Combina hunt + prediction + context → Decisión única"
//  "El General manda. El Bibliotecario obedece."
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
// 🧬 WAVE 972.2: DNA Brain Integration
import type { IntegrationDecision } from '../integration/DreamEngineIntegrator'
// 🔪 WAVE 1010: Zone Awareness (movido desde ContextualEffectSelector)
import type { EnergyZone, EnergyContext } from '../../protocol/MusicalContext'
// 🎨 WAVE 1028: THE CURATOR - Texture Filter integration
import { getContextualEffectSelector } from '../../effects/ContextualEffectSelector'
import type { SpectralContext } from '../../protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010: DIVINE THRESHOLD & VIBE-AWARE ARSENAL
// ═══════════════════════════════════════════════════════════════════════════
// Movido desde ContextualEffectSelector - EL GENERAL tiene el control total

/** Umbral de Z-Score para DIVINE moment (momento de máximo impacto obligatorio) */
export const DIVINE_THRESHOLD = 3.5

/**
 * 🔪 WAVE 1010: DIVINE ARSENAL BY VIBE
 * Armas de destrucción masiva por género musical.
 * Cuando Z > DIVINE_THRESHOLD, el General ordena fuego pesado.
 */
export const DIVINE_ARSENAL: Record<string, string[]> = {
  'fiesta-latina': [
    'solar_flare',       // ☀️ Explosión dorada
    'strobe_storm',      // ⚡ Tormenta de strobes
    'latina_meltdown',   // 🔥 El derretimiento final
    'corazon_latino',    // ❤️ El alma del arquitecto
  ],
  'techno-club': [
    'industrial_strobe', // 🔨 El Martillo
    'gatling_raid',      // 🔫 Metralladora
    'core_meltdown',     // ☢️ LA BESTIA
    'strobe_storm',      // ⚡ Tormenta compartida
  ],
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020: POP-ROCK LEGENDS - DIVINE ARSENAL
  // ═══════════════════════════════════════════════════════════════════════════
  'pop-rock': [
    'thunder_struck',    // ⚡ Stadium blinder - AC/DC moment
    'feedback_storm',    // 😵 Caos visual - metal/harshness peak
    'strobe_burst',      // 💥 Impacto puntual - drops menores
    'liquid_solo',       // 🎸 Spotlight guitarra - solos épicos
    // ═══════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - DIVINE ADDITIONS
    // ═══════════════════════════════════════════════════════════════════════
    'power_chord',       // ⚡ Flash + strobe - power chord hits
    'spotlight_pulse',   // 💡 Pulso emotivo - builds épicos
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Todos los inputs para tomar una decisión
 * 🧬 WAVE 972.2: Ahora incluye DNA Brain integration
 * 🔪 WAVE 1010: Ahora incluye Zone & Vibe Awareness (movido desde Selector)
 * 🎨 WAVE 1028: THE CURATOR - Ahora incluye SpectralContext para texture awareness
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
  
  /** 🧬 WAVE 972.2: DNA Brain integration decision (opcional) */
  dreamIntegration?: IntegrationDecision
  
  /** 🔪 WAVE 1010: Contexto energético para consciencia de zona */
  energyContext?: EnergyContext
  
  /** 🔪 WAVE 1010: Z-Score actual (para DIVINE detection) */
  zScore?: number
  
  /** 🎨 WAVE 1028: THE CURATOR - Contexto espectral para texture awareness */
  spectralContext?: {
    clarity: number
    texture: 'clean' | 'warm' | 'harsh' | 'noisy'
    harshness: number
    flatness: number
    centroid: number
  }
  
  /** 🔒 WAVE 1177: CALIBRATION - Dictador activo (efecto global en ejecución) */
  activeDictator?: string | null
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
// 🔪 WAVE 975: THE FRONTAL LOBOTOMY
// ═══════════════════════════════════════════════════════════════════════════
// 
// LEGACY CODE ELIMINATED:
// - selectEffectByVibe() - REMOVED (martillos, cuchillas hardcodeadas)
// - Techno/Latino fallbacks - REMOVED
// - Unknown vibe defaults - REMOVED
//
// DNA BRAIN IS THE ONLY DECISION MAKER NOW.
// "El silencio a veces es una opción." - Radwulf
//
// Si DNA no propone → SILENCE. Las físicas reactivas son perfectas.
// ═══════════════════════════════════════════════════════════════════════════

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
    output.debugInfo.reasoning = `Low Confidence Matrix: ${combinedConfidence.toFixed(2)} < ${cfg.minConfidenceThreshold}`
    return output
  }
  
  // Determinar tipo de decisión basado en contexto
  const decisionType = determineDecisionType(inputs)
  
  // Generar decisiones específicas
  switch (decisionType) {
    // 🔪 WAVE 1010: DIVINE STRIKE - Máximo impacto obligatorio
    case 'divine_strike':
      return generateDivineStrikeDecision(inputs, output, combinedConfidence)
    
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
  | 'divine_strike'     // 🔪 WAVE 1010: Z > 3.5 = FUEGO OBLIGATORIO
  | 'strike'            // Strike del hunt engine
  | 'prepare_for_drop'  // Preparar para drop predicho
  | 'buildup_enhance'   // Potenciar buildup
  | 'subtle_shift'      // Cambio sutil basado en belleza
  | 'hold'              // Mantener sin cambios

/**
 * 🔥 WAVE 811 → 🧬 WAVE 972.2 → 🔪 WAVE 1010: UNIFIED BRAIN
 * 🔒 WAVE 1177: CALIBRATION - Skip DIVINE evaluation if dictator is active
 * 
 * NUEVA JERARQUÍA (WAVE 1010):
 * 0. 🌩️ DIVINE MOMENT (Z > 3.5 + zona válida) - OBLIGATORIO
 * 1. 🧬 DNA Brain Integration (si disponible y aprobado)
 * 2. 🎯 HuntEngine worthiness
 * 3. 📉 Drop predicho
 * 4. 📈 Buildup/Beauty
 * 5. 🧘 Hold
 */
function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty, dreamIntegration, energyContext, zScore, activeDictator } = inputs
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌩️ PRIORIDAD -1: DIVINE MOMENT (Z > 3.5)
  // WAVE 1010: Movido desde ContextualEffectSelector - EL GENERAL DECIDE
  // 🔒 WAVE 1177: Skip if dictator is active (prevents log spam)
  // ═══════════════════════════════════════════════════════════════════════
  const currentZ = zScore ?? 0
  
  // 🔒 WAVE 1177: Si hay dictador activo, no intentar DIVINE
  // (El efecto activo tiene "la palabra", no le interrumpimos)
  if (activeDictator) {
    // No loggear nada - silencio total para evitar spam
    // El dictador ya fue anunciado cuando se disparó
  } else if (currentZ >= DIVINE_THRESHOLD) {
    const zone = energyContext?.zone ?? 'gentle'
    
    // Consciencia energética: NO divine en zonas de silencio
    // (No dispares artillería pesada en un funeral)
    if (zone === 'silence' || zone === 'valley') {
      console.log(`[DecisionMaker 🌩️] DIVINE BLOCKED: Z=${currentZ.toFixed(2)}σ but zone=${zone} (protected)`)
      // Continuar a siguiente prioridad, no return 'hold'
    } else {
      console.log(`[DecisionMaker 🌩️] DIVINE MOMENT: Z=${currentZ.toFixed(2)}σ zone=${zone} → MANDATORY FIRE`)
      return 'divine_strike'  // 🔪 WAVE 1010: Nuevo tipo
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 1178: VALLEY PROTECTION - Bloquear TODOS los disparos en valley+Z<0
  // 🧹 WAVE 1178.1: SILENCIADO - spam innecesario
  // ═══════════════════════════════════════════════════════════════════════
  // Si estamos en zone de baja energía Y la energía está BAJANDO (Z<0),
  // NO DISPARAR EFECTOS. La música está en un funeral, no molestes.
  const zone = energyContext?.zone ?? 'gentle'
  if ((zone === 'valley' || zone === 'silence') && currentZ < 0) {
    // 🧹 WAVE 1178.1: Log SILENCIADO - ya sabemos que funciona
    // console.log(`[DecisionMaker 🛡️] VALLEY PROTECTION: zone=${zone} Z=${currentZ.toFixed(2)} → HOLD`)
    return 'hold'  // BLOQUEADO - música muriendo
  }
  
  // 🧬 PRIORIDAD 0: DNA BRAIN - LA ÚLTIMA PALABRA
  // 🔌 WAVE 976.4: FIX - Chequear effect.effect (STRING), no solo el objeto
  if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
    return 'strike'  // DNA aprobó → strike con efecto de DNA
  }
  
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010: DIVINE STRIKE - MANDATORY MAXIMUM IMPACT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🌩️ DIVINE STRIKE DECISION
 * 
 * Cuando Z > 3.5 y estamos en zona válida, ES OBLIGATORIO disparar.
 * El General ordena fuego pesado, el Repository seleccionará el arma específica.
 * 
 * 🎨 WAVE 1028: THE CURATOR - Now texture-aware
 * El arsenal se filtra por compatibilidad de textura antes de seleccionar.
 * 
 * VIBE-AWARE:
 * - Latino: solar_flare, strobe_storm, latina_meltdown, corazon_latino
 * - Techno: industrial_strobe, gatling_raid, core_meltdown, strobe_storm
 */
function generateDivineStrikeDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { beauty, pattern, zScore, energyContext, spectralContext } = inputs
  const vibeId = pattern.vibeId
  
  output.confidence = 0.99  // DIVINE = máxima confianza
  output.source = 'hunt'
  output.debugInfo.huntState = 'striking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  
  // 🔪 WAVE 1010: Seleccionar arsenal según vibe
  let arsenal = DIVINE_ARSENAL[vibeId] || DIVINE_ARSENAL['fiesta-latina']
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 WAVE 1028: THE CURATOR - Texture Filter for DIVINE arsenal
  // ═══════════════════════════════════════════════════════════════════════
  // Ejemplo: Solo de violín (High Energy, Rock, CLEAN texture)
  //   - Sin filtro: thunder_struck (dirty) → RUIDO VISUAL MATA LA ELEGANCIA
  //   - Con filtro: liquid_solo (clean) → SPOTLIGHT ELEGANTE ✨
  // ═══════════════════════════════════════════════════════════════════════
  if (spectralContext) {
    const selector = getContextualEffectSelector()
    const filteredArsenal = selector.filterArsenalByTexture(arsenal, {
      clarity: spectralContext.clarity,
      texture: spectralContext.texture,
      harshness: spectralContext.harshness,
      flatness: spectralContext.flatness,
      centroid: spectralContext.centroid,
      bands: {
        subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0
      }
    })
    
    if (filteredArsenal.length > 0) {
      console.log(
        `[DecisionMaker 🎨] DIVINE TEXTURE FILTER: ${arsenal.length} → ${filteredArsenal.length} | ` +
        `texture=${spectralContext.texture} | clarity=${spectralContext.clarity.toFixed(2)}`
      )
      arsenal = filteredArsenal
    } else {
      // Si el filtro eliminó TODO, usar arsenal original (fallback de seguridad)
      console.warn(
        `[DecisionMaker 🎨] DIVINE TEXTURE FILTER: All effects filtered out! Using original arsenal.`
      )
    }
  }
  
  const suggestedEffect = arsenal[0]  // Primer efecto del arsenal (será validado por Repository)
  
  output.debugInfo.reasoning = `🌩️ DIVINE MOMENT: Z=${(zScore ?? 0).toFixed(2)}σ | vibe=${vibeId} | texture=${spectralContext?.texture ?? 'unknown'} | suggested=${suggestedEffect}`
  
  // 🔪 WAVE 1010: El General ordena el TIPO de ataque, el Repository elige el arma disponible
  output.effectDecision = {
    effectType: suggestedEffect,  // Sugerencia - Repository puede cambiar si está en cooldown
    intensity: 1.0,  // DIVINE = máxima intensidad
    zones: ['all'],  // DIVINE afecta todo
    reason: `🌩️ DIVINE: Z=${(zScore ?? 0).toFixed(2)}σ > ${DIVINE_THRESHOLD} | Arsenal: ${arsenal.join(', ')}`,
    confidence: 0.99,
    // 🔪 WAVE 1010: Metadata para el Repository
    divineArsenal: arsenal,  // Lista de efectos válidos para DIVINE en este vibe
  } as any  // Type assertion para añadir divineArsenal
  
  // Color decision: Máximo impacto
  output.colorDecision = {
    suggestedStrategy: 'complementary',  // Alto contraste
    saturationMod: 1.25,  // Colores vivos
    brightnessMod: 1.20,  // Brillante
    confidence: 0.99,
    reasoning: `DIVINE Strike (Z=${(zScore ?? 0).toFixed(2)}σ)`,
  }
  
  // Physics modifier: Máxima potencia
  output.physicsModifier = {
    strobeIntensity: 1.0,
    flashIntensity: 1.0,
    confidence: 0.99,
  }
  
  console.log(
    `[DecisionMaker 🌩️] DIVINE STRIKE: Z=${(zScore ?? 0).toFixed(2)}σ | ` +
    `vibe=${vibeId} | zone=${energyContext?.zone ?? 'unknown'} | ` +
    `texture=${spectralContext?.texture ?? 'N/A'} | ` +
    `arsenal=[${arsenal.join(', ')}]`
  )
  
  return output
}

function generateStrikeDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { huntDecision, beauty, consonance, pattern, dreamIntegration } = inputs
  
  // � WAVE 982.5: Silenciado (arqueología del día 2)
  // �🔍 WAVE 976.4: DEBUG - Ver si DNA data llega aquí
  // console.log(
  //   `[DecisionMaker] 🔍 generateStrikeDecision called | ` +
  //   `DNA approved=${dreamIntegration?.approved ?? false} | ` +
  //   `effect=${dreamIntegration?.effect?.effect ?? 'null'}`
  // )
  
  output.confidence = confidence
  output.source = 'hunt'
  output.debugInfo.huntState = 'striking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.consonance = consonance.totalConsonance
  
  // 🧬 WAVE 972.2: SI DNA DECIDIÓ, USAR SU EFECTO DIRECTAMENTE
  // 🔌 WAVE 976.2: FIX - Chequear que effect.effect exista (no solo el objeto)
  if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
    const dnaEffect = dreamIntegration.effect
    
    output.debugInfo.reasoning = `🧬 DNA BRAIN: ${dreamIntegration.dreamRecommendation}`
    output.effectDecision = {
      effectType: dnaEffect.effect,
      intensity: dnaEffect.intensity,
      zones: dnaEffect.zones as ('all' | 'front' | 'back' | 'movers' | 'pars' | 'movers_left' | 'movers_right')[],
      reason: `🧬 DNA: ${dreamIntegration.dreamRecommendation} | Ethics: ${dreamIntegration.ethicalVerdict?.ethicalScore.toFixed(2)}`,
      confidence: dreamIntegration.ethicalVerdict?.ethicalScore ?? 0.85,
    }
    
    // Color decision: Cambio agresivo (DNA aprobó)
    output.colorDecision = {
      suggestedStrategy: pattern.emotionalTension > 0.6 ? 'complementary' : 'triadic',
      saturationMod: 1.0 + beauty.totalBeauty * 0.15,
      brightnessMod: 1.0 + pattern.rhythmicIntensity * 0.10,
      confidence: confidence,
      reasoning: `DNA Strike (beauty=${beauty.totalBeauty.toFixed(2)})`,
    }
    
    // Physics modifier: Intensidad según contexto
    output.physicsModifier = {
      strobeIntensity: 0.7 + pattern.rhythmicIntensity * 0.3,
      flashIntensity: 0.8 + beauty.totalBeauty * 0.2,
      confidence: confidence,
    }
    
    // 🔇 WAVE 982.5: Silenciado (arqueología del día 2)
    // console.log(`[DecisionMaker 🧬] DNA BRAIN DECISION: ${dnaEffect.effect} @ ${dnaEffect.intensity.toFixed(2)} | ethics=${dreamIntegration.ethicalVerdict?.ethicalScore.toFixed(2)}`)
    return output
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🧘 WAVE 975: THE SILENCE RULE
  // ═══════════════════════════════════════════════════════════════════════════
  // DNA Brain did not propose an effect → SILENCE IS GOLDEN
  // 
  // "El silencio a veces es una opción. Si Selene no tiene nada que disparar...
  //  pues que NO dispare, y ya. La reactividad de las físicas que tenemos 
  //  implementadas es PERFECTA." - Radwulf
  //
  // NO MORE LEGACY FALLBACKS. NO MORE selectEffectByVibe().
  // DNA or silence. That's it.
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Color decision: Subtle enhancement based on beauty (no effect)
  output.colorDecision = {
    suggestedStrategy: pattern.emotionalTension > 0.6 ? 'complementary' : 'triadic',
    saturationMod: 1.0 + beauty.totalBeauty * 0.10,
    brightnessMod: 1.0 + pattern.rhythmicIntensity * 0.05,
    confidence: confidence * 0.5,
    reasoning: `Silence Rule (DNA has no proposal)`,
  }
  
  // Physics modifier: Let reactive physics do their job
  output.physicsModifier = {
    strobeIntensity: pattern.rhythmicIntensity * 0.2,
    flashIntensity: 0.1,
    confidence: confidence * 0.3,
  }
  
  output.debugInfo.reasoning = `🧘 SILENCE: DNA has no proposal | vibe=${pattern.vibeId} | energy=${pattern.rawEnergy.toFixed(2)}`
  console.log(`[DecisionMaker 🧘] SILENCE: DNA has no proposal | ${pattern.vibeId} | E=${pattern.rawEnergy.toFixed(2)}`)
  
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
  output.debugInfo.reasoning = 'BOOSTING BUILD-UP PHASE'
  
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
