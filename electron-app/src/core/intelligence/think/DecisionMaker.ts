// ═══════════════════════════════════════════════════════════════════════════
//  🎯 DECISION MAKER - El Juez Final (EL ÚNICO GENERAL)
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 500 - PROJECT GENESIS - PHASE 3
//  WAVE 1010 - FRONTAL LOBOTOMY - UNIFIED BRAIN
//  WAVE 1028 - THE CURATOR - Texture Awareness Integration
//  WAVE 2183 - DIVERSITY FIX — DROP no puede saltarse la penalización
//  WAVE 2185 - MINIMAL TECHNO FIX — DIVINE dual validation (Z>4.0 + energy>0.65)
//  WAVE 2200 - SELENE RECALIBRATION — 4 tactical fixes:
//    2200.1 — Cassandra temporal seal (pre-buffer leak)
//    2200.2 — Anti-fake-drop sanity check (Z-Score guard on heavy arsenal)
//    2200.3 — Buildup heavy arsenal restriction (no premature climax)
//    2200.4 — DIVINE ARSENAL log honesty
//  WAVE 2203 - FUZZY BUILDUP WALL — Close the bypass gap
//    The Buildup Restriction (2200.3) only guarded DNA Priority 0.
//    Fuzzy and Hunt could still sneak heavy arsenal through during buildups.
//    Now: section=buildup + HEAVY_ARSENAL blocks at ALL decision paths.
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
import type { EnergyContext } from '../../protocol/MusicalContext'
// 🎨 WAVE 1028: THE CURATOR - Texture Filter integration
import type { SpectralContext } from '../../protocol/MusicalContext'
// 🎲 WAVE 2183: DIVERSITY FIX — Arsenal selector respeta penalización de diversidad
import { getDNAAnalyzer } from '../dna/EffectDNA'
// ⚡ WAVE 4843: COGNITIVE BRIDGE — Registry como fuente de verdad de pesadez de efectos
import { getDynamicEffectRegistry, effectDisplayName } from '../../arsenal/DynamicEffectRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// ⏱️ WAVE 5009: THROTTLE MECHANISM PARA LOGS DE BLOQUEO
// ═══════════════════════════════════════════════════════════════════════════
const logThrottles = new Map<string, number>()
function throttledLog(reason: string, message: string, limitMs: number = 1000) {
  const now = Date.now()
  const lastTime = logThrottles.get(reason) || 0
  if (now - lastTime >= limitMs) {
    console.log(message)
    logThrottles.set(reason, now)
  }
}

/** Clamp x to [0, 1] without branches (ΠMΔG interpolation helper) */
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010: DIVINE THRESHOLD & VIBE-AWARE ARSENAL
// ═══════════════════════════════════════════════════════════════════════════
// Movido desde ContextualEffectSelector - EL GENERAL tiene el control total

/** V3.4: Static DIVINE_THRESHOLD purged — V3 epicness > epsilon_divine is the sole authority. */

/**
 * ⚡ WAVE 4915: DIVINE ARSENAL purgado.
 *
 * El arsenal divino vive 100% en el DynamicEffectRegistry.
 * Un efecto entra al pool divino de un vibe cuando su .lfx declara
 * `simulationMeta.isDivineCandidate: true` y su `compatibleVibes`
 * incluye ese vibe. No hay fallback hardcodeado.
 */

/**
 * ⚡ WAVE 4843: ¿Está permitido este efecto en la sección musical actual?
 * Lee `validSections` del RegistryEntry. Si el array está vacío o el efecto
 * no está en el registry, se permite (fail-open).
 */
function isEffectAllowedInSection(effectId: string, section: string): boolean {
  const entry = getDynamicEffectRegistry().getEntry(effectId)
  if (!entry || entry.validSections.length === 0) return true
  
  // ⏳ WAVE 5009 FIX 5: Section Aliasing
  // Algunos .lfx usan 'build' en lugar de 'buildup', o 'active' en lugar de 'chorus'
  const normalizedSection = section === 'buildup' ? 'build' : 
                            section === 'chorus' ? 'active' : section
  
  return entry.validSections.includes(section) || entry.validSections.includes(normalizedSection)
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

  /** 🐘 WAVE 4861: Energía máxima histórica de la ventana de 30s (de RollingStats.max) */
  energyMaxHistoric?: number

  /** V3.4: Epicness from Liquid Cognition — sole authority for Divine arsenal routing */
  v3Epicness?: number

  /** V3 TUNE: Contextual phase from ContextualMemory (building, climax, release, etc.) */
  contextualPhase?: string

  /** 🩸 WAVE 7171: RMS 10s average for two-path divine gate (sustained epicness check) */
  rmsAverage10s?: number
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
  // 🧬 WAVE 7004.6: DNA-approved effects bypass confidence threshold.
  // combinedConfidence (pred*0.3 + beauty*0.3) almost never reaches 0.55 in practice,
  // blocking ALL DNA-approved effects before determineDecisionType is even called.
  // If DNA approved with high ethics, the effect should proceed regardless.
  const dnaApproved = inputs.dreamIntegration?.approved && inputs.dreamIntegration.effect?.effect
  if (!dnaApproved && combinedConfidence < cfg.minConfidenceThreshold) {
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
 * 0. 🌩️ DIVINE MOMENT (Z > 4.0 + energy > 0.65 + zona válida) - OBLIGATORIO
 * 1. 🧬 DNA Brain Integration (si disponible y aprobado)
 * 2. 🎯 HuntEngine worthiness
 * 3. 📉 Drop predicho
 * 4. 📈 Buildup/Beauty
 * 5. 🧘 Hold
 */

function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty, dreamIntegration, energyContext, zScore, activeDictator } = inputs

  // ═══════════════════════════════════════════════════════════════════════
  // 🌩️ PRIORIDAD -1: DIVINE MOMENT — V3.4: epicness > epsilon_divine
  // Static Z-score thresholds extirpated. V3 Liquid Cognition's epicness
  // is the sole authority for Divine arsenal routing.
  //
  // §5.4: Vibe branches (isTechnoVibe / isLatinVibe) PURGED — replaced with
  // continuous ΠMΔG interpolation. The divine threshold is now a function of
  // the fluid descriptors, not a genre string:
  //   V3_EPSILON_DIVINE = 0.60 - 0.10 · Π·(1−M)
  //     High percussiveness + low melodicity (techno) → 0.50 (permissive)
  //     Low percussiveness or high melodicity (ambient) → 0.60 (strict)
  //   DIVINE_SUSTAINED_RMS_FLOOR = 0.75 - 0.10 · G
  //     High groove (latin reggaeton) → 0.65 (lower floor)
  //     Low groove (ambient) → 0.75 (strict floor)
  // ═══════════════════════════════════════════════════════════════════════
  const v3Epicness = inputs.v3Epicness ?? 0
  // ΠMΔG interpolation — no genre strings, pure fluid descriptors
  const Π = pattern.rhythmicIntensity ?? 0  // percussiveness proxy (pattern-level)
  const M = pattern.harmonicDensity ?? 0.5   // melodicity proxy
  const G = pattern.syncopation ?? 0         // groove
  const V3_EPSILON_DIVINE = 0.60 - 0.10 * clamp01(Π * (1 - clamp01(M)))
  // 🩸 WAVE 7171: Two-path divine gate — A) brutal isolated peak OR B) sustained epicness
  const rms10s = inputs.rmsAverage10s ?? 0
  const DIVINE_SUSTAINED_RMS_FLOOR = 0.75 - 0.10 * clamp01(G)
  // 🩸 WAVE 7186: Sustained epicness threshold raised to 0.50 for ALL vibes.
  const DIVINE_SUSTAINED_EPICNESS = 0.50
  const divinePeakPassed = v3Epicness > V3_EPSILON_DIVINE
  const divineSustainedPassed = v3Epicness > DIVINE_SUSTAINED_EPICNESS && rms10s > DIVINE_SUSTAINED_RMS_FLOOR
  // 🩸 WAVE 7186: Z-SCORE FLOOR — Divine is a rare event by definition.
  const DIVINE_MIN_Z_SCORE = 2.10
  const divineZPassed = (zScore ?? 0) >= DIVINE_MIN_Z_SCORE
  const divineGatePassed = (divinePeakPassed || divineSustainedPassed) && divineZPassed

  if (activeDictator) {
    // No loggear nada - silencio total para evitar spam
  } else if (divineGatePassed) {
    console.log(
      `[DecisionMaker 🌩️] DIVINE MOMENT: V3 epicness=${v3Epicness.toFixed(3)}` +
      ` (peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${DIVINE_SUSTAINED_EPICNESS}+rms>${DIVINE_SUSTAINED_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
      ` Z=${(zScore ?? 0).toFixed(2)}σ ≥ ${DIVINE_MIN_Z_SCORE}? ${divineZPassed}` +
      ` → MANDATORY FIRE`
    )
    return 'divine_strike'
  }

  // 🧬 PRIORIDAD 0: DNA BRAIN - LA ÚLTIMA PALABRA
  const section = pattern.section
  if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
    const proposedEffect = dreamIntegration.effect.effect
    const isDivineEffect = getDynamicEffectRegistry().getEntry(proposedEffect)?.simMeta.isDivineCandidate ?? false
    // 🩸 WAVE 7171: Two-path divine leak check — blocked only if BOTH paths fail
    const divineLeakBlocked = isDivineEffect && !divineGatePassed
    if (section === 'buildup' && !isEffectAllowedInSection(proposedEffect, section)) {
      // Fall through — buildup handler below will manage with soft effects
    } else if (divineLeakBlocked) {
      throttledLog(
        `divineLeak:${proposedEffect}`,
        `[DecisionMaker 🛡️] DIVINE LEAK BLOCKED: "${proposedEffect}" is divine ` +
        `but V3 epicness=${v3Epicness.toFixed(3)} ` +
        `(peak>${V3_EPSILON_DIVINE.toFixed(2)}? ${divinePeakPassed}; sustained>${DIVINE_SUSTAINED_EPICNESS}+rms>${DIVINE_SUSTAINED_RMS_FLOOR.toFixed(2)}? ${divineSustainedPassed})` +
        ` → falling through`,
        5000
      )
    } else {
      return 'strike'
    }
  }

  // V3.3.B: HuntEngine worthiness gate removed — V3 ignite is the sole authority.
  // Prioridad 1: Drop predicho con alta probabilidad
  // 🛡️ V3 TUNE: Gate with contextualPhase — a drop is only valid if the track
  // is in a BUILDING phase. Prevents false drops on vocal transients / slow songs.
  const contextualPhase = inputs.contextualPhase ?? 'building'
  if (prediction.type === 'drop_incoming' && prediction.probability > 0.65 && contextualPhase === 'building') {
    return 'prepare_for_drop'
  }
  if (pattern.section === 'drop' && v3Epicness > 0.20) {
    return 'prepare_for_drop'
  }

  // Prioridad 3: energy_spike — gated by contextualPhase to prevent false drops
  if (prediction.type === 'energy_spike' && prediction.probability > 0.75 && pattern.rhythmicIntensity > 0.6 && contextualPhase === 'building') {
    return 'prepare_for_drop'
  }

  // Prioridad 4: Buildup con potencial
  if (pattern.section === 'buildup' ||
      (prediction.type === 'buildup_starting' && prediction.probability > 0.7)) {
    return 'buildup_enhance'
  }

  // Prioridad 5: Belleza alta + tendencia positiva
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
  const predConf = inputs.prediction.probability
  const beautyConf = inputs.beauty.totalBeauty
  
  // V3.3.B: HuntEngine worthiness removed from confidence — V3 ignite is sole authority.
  // Combined confidence now uses prediction + beauty only.
  let combined = 
    predConf * cfg.predictionWeight +
    beautyConf * cfg.beautyWeight
  
  // Bonus si múltiples fuentes coinciden
  if (inputs.prediction.type !== 'none' &&
      inputs.beauty.trend === 'rising') {
    combined = Math.min(1, combined + 0.1)
  }
  
  return combined
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERADORES DE DECISIONES ESPECÍFICAS
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// 🎲 WAVE 2183: DIVERSITY-AWARE ARSENAL SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selecciona el mejor efecto de un arsenal aplicando penalización de diversidad.
 * 
 * PROBLEMA ANTERIOR:
 *   arsenal[0] siempre ganaba (primer efecto del array = neon_blinder).
 *   El penalizador de diversidad (0.15x) existía en DNAAnalyzer pero
 *   DIVINE STRIKE y DROP EFFECT lo ignoraban completamente.
 * 
 * SOLUCIÓN (WAVE 2183):
 *   Puntuar cada candidato del arsenal = baseScore * diversityFactor.
 *   baseScore = 1.0 para todos (todos merecen dispararse en un drop).
 *   diversityFactor = [1.0, 0.70, 0.35, 0.15] según usos recientes.
 *   El de mayor puntuación gana. Empates → orden original del array.
 * 
 * @param arsenal - Lista de efectos candidatos en orden de prioridad base
 * @returns El efectoID con mayor diversityScore
 */
function selectFromArsenalWithDiversity(arsenal: string[]): string {
  if (arsenal.length === 0) return ''
  
  const ranked = rankArsenalByDiversity(arsenal)
  return ranked[0] || arsenal[0]
}

/**
 * 🎲 WAVE 2494: Ordena arsenal completo por diversity score (mayor primero)
 * Devuelve el array completo rankeado, no solo el ganador.
 * Esto permite que el Repository itere candidatos si el #1 está en cooldown.
 */
function rankArsenalByDiversity(arsenal: string[]): string[] {
  if (arsenal.length === 0) return []
  
  const analyzer = getDNAAnalyzer()
  
  const scored: { id: string, score: number }[] = arsenal.map(effectId => {
    const relevance = analyzer.calculateRelevance(effectId, {
      aggression: 0.90,
      chaos: 0.30,
      organicity: 0.05,
      confidence: 1.0,
    })
    return { id: effectId, score: relevance }
  })

  // Ordenar por score descendente (mayor diversidad+relevancia primero)
  scored.sort((a, b) => b.score - a.score)

  const winner = scored[0]
  console.log(
    `[DecisionMaker 🎲] DIVERSITY SELECT: winner=${effectDisplayName(winner.id)} score=${winner.score.toFixed(3)} ` +
    `from [${arsenal.map(effectDisplayName).join(', ')}]`
  )
  
  return scored.map(s => s.id)
}

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
  
  // ⚡ WAVE 4914+4915: LIVE REGISTRY — única fuente de verdad.
  const _registryDivine = getDynamicEffectRegistry().getDivineArsenal(vibeId)
  const arsenal: string[] = _registryDivine.map(e => e.id)

  if (arsenal.length === 0) {
    console.warn(`[DecisionMaker 🌩️] DIVINE registry empty for vibe=${vibeId} — no divine strike possible.`)
    output.confidence = 0.0
    output.source = 'hunt'
    output.debugInfo.reasoning = `DIVINE SUPPRESSED: empty divine registry for ${vibeId}`
    return output
  }
  
  // ⚡ WAVE 4849: TEXTURE FILTER ELIMINADO
  // WAVE 1028 filtraba el arsenal DIVINE por textura espectral (clean/harsh/warm/noisy).
  // Problema: Solo era efectivo en techno (donde la FFT distingue texturas claras).
  // En fiesta-latina ya había bypass. El filtro reducía el arsenal sin beneficio real
  // y podía vaciar el arsenal completamente en textura "noisy" (techno duro).
  // DOCTRINA: La elección del arsenal por vibe es suficiente — el DNA decide el resto.

  // 🎲 WAVE 2494: DIVERSITY FIX v3 — pasar arsenal completo RANKEADO por diversity score
  // WAVE 2183.1 "LOBOTOMY" fue un ERROR: pasar [winner] mataba la diversidad.
  // Si el ganador está en cooldown → silencio. No hay plan B.
  // FIX: Pasar todo el arsenal ordenado por diversity score.
  // Repository itera en orden de preferencia, el PRIMERO sin cooldown dispara.
  const rankedArsenal = rankArsenalByDiversity(arsenal)
  const suggestedEffect = rankedArsenal[0] || arsenal[0]
  
  output.debugInfo.reasoning = `🌩️ DIVINE MOMENT: epicness=${(inputs.v3Epicness ?? 0).toFixed(3)} | vibe=${vibeId} | texture=${spectralContext?.texture ?? 'unknown'} | suggested=${effectDisplayName(suggestedEffect)}`
  
  // 🎲 WAVE 2494: Arsenal completo rankeado → Repository elige el primero disponible
  output.effectDecision = {
    effectType: suggestedEffect,
    effectName: getDynamicEffectRegistry().getEntry(suggestedEffect)?.name,
    intensity: 1.0,  // DIVINE = máxima intensidad
    zones: ['all'],  // DIVINE afecta todo
    reason: `🌩️ DIVINE: epicness=${(inputs.v3Epicness ?? 0).toFixed(3)} | Ranked: ${rankedArsenal.map(effectDisplayName).join(' > ')} | Full arsenal: ${arsenal.map(effectDisplayName).join(', ')}`,
    confidence: 0.99,
    // 🎲 WAVE 2494: Arsenal COMPLETO rankeado por diversity score
    // Repository itera en orden: primer candidato sin cooldown dispara.
    // Si TODOS están en cooldown → silencio (exhaustion legítimo).
    divineArsenal: rankedArsenal,
  } as any
  
  // Color decision: Máximo impacto
  output.colorDecision = {
    suggestedStrategy: 'complementary',  // Alto contraste
    saturationMod: 1.25,  // Colores vivos
    brightnessMod: 1.20,  // Brillante
    confidence: 0.99,
    reasoning: `DIVINE Strike (epicness=${(inputs.v3Epicness ?? 0).toFixed(3)})`,
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
    `arsenal=[${arsenal.map(effectDisplayName).join(', ')}]`
  )
  
  return output
}

function generateStrikeDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { huntDecision, beauty, consonance, pattern, dreamIntegration } = inputs
  
  //  WAVE 982.5: Silenciado (arqueología del día 2)
  // 🔍 WAVE 976.4: DEBUG - Ver si DNA data llega aquí
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
      effectName: dnaEffect.effectName,
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
  // 🔇 WAVE 4998: Log silenciado — SILENCE es estado normal, no requiere console
  // ⏳ WAVE 5009 FIX 1: Restaurar log usando Throttle (max 1 por segundo)
  throttledLog('silence_dna', `[DecisionMaker 🧘] SILENCE: DNA has no proposal | ${pattern.vibeId} | E=${pattern.rawEnergy.toFixed(2)}`, 1000)
  
  return output
}

function generateDropPreparationDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { prediction, beauty, pattern, zScore, energyContext } = inputs
  
  output.confidence = Math.max(confidence, 0.85)
  output.source = 'prediction'
  output.debugInfo.huntState = 'evaluating'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.reasoning = `🔴 DROP PREPARATION: ${prediction.reasoning} | Z=${(zScore ?? 0).toFixed(2)}`
  
  const isDropImminent = prediction.estimatedTimeMs < 800 || pattern.section === 'drop'
  
  if (prediction.probability > 0.7 && isDropImminent) {
    const vibeId = pattern.vibeId
    let _registryDivineForDrop = getDynamicEffectRegistry().getDivineArsenal(vibeId)
    if (_registryDivineForDrop.length < 2) {
      const heavyFallback = getDynamicEffectRegistry().getHeavyArsenal(vibeId)
      const merged = [..._registryDivineForDrop, ...heavyFallback]
      _registryDivineForDrop = Array.from(new Map(merged.map(item => [item.id, item])).values())
    }
    const dropArsenal: string[] = _registryDivineForDrop.map(e => e.id)

    if (dropArsenal.length === 0) {
      console.warn(`[DecisionMaker 🔴] DROP registry empty for vibe=${vibeId} — no drop effect possible.`)
    } else {
      // 🩸 WAVE 2531: DROP EPICNESS FLOOR
      // The DROP path is hierarchically BELOW Divine and Sovereign Clock.
      // It should NOT require divine-level epicness (0.60+). However, it
      // needs a moderate floor to prevent autotuned vocals and compressed
      // drums from triggering drop effects. A floor of 0.25 blocks the
      // "voz de nariz tapada" case (epicness ~0.18) while allowing real
      // drops (epicness > 0.30) to fire freely.
      // Divine effects that share the drop arsenal (like Latina Meltdown)
      // are allowed to fire via DROP at this lower tier — the DROP
      // prediction itself is the authority, not the divine gate.
      const v3EpicForDrop = inputs.v3Epicness ?? 0
      const DROP_EPICNESS_FLOOR = 0.25

      if (v3EpicForDrop < DROP_EPICNESS_FLOOR) {
        console.log(
          `[DecisionMaker 🛡️] DROP EPICNESS FLOOR: epicness=${v3EpicForDrop.toFixed(3)} < ${DROP_EPICNESS_FLOOR}` +
          ` — drop prediction preserved but effect suppressed (autotune/vocal transient)` +
          ` → falling through to hold`
        )
      } else {
        const suggestedEffect = selectFromArsenalWithDiversity(dropArsenal)
        const currentZ = zScore ?? 0

        output.effectDecision = {
          effectType: suggestedEffect,
          effectName: getDynamicEffectRegistry().getEntry(suggestedEffect)?.name,
          intensity: 0.8 + prediction.probability * 0.2,
          zones: ['all'],
          reason: `🔴 DROP: prob=${prediction.probability.toFixed(2)} | winner=${effectDisplayName(suggestedEffect)} | full arsenal=${dropArsenal.map(effectDisplayName).join(', ')}`,
          confidence: prediction.probability,
          divineArsenal: [suggestedEffect],
        } as any

        console.log(
          `[DecisionMaker 🔴] DROP EFFECT: ${effectDisplayName(suggestedEffect)} | prob=${prediction.probability.toFixed(2)} ` +
          `vibe=${vibeId} | Z=${currentZ.toFixed(2)} | epicness=${v3EpicForDrop.toFixed(3)}`
        )
      }
    }
  }

  // Color decision: Preparar transición
  output.colorDecision = {
    saturationMod: 1.05,
    brightnessMod: 0.95,
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
