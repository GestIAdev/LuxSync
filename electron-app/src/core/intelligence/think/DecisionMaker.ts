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
import type { EnergyZone, EnergyContext } from '../../protocol/MusicalContext'
// 🎨 WAVE 1028: THE CURATOR - Texture Filter integration
import { getContextualEffectSelector } from '../../effects/ContextualEffectSelector'
import type { SpectralContext } from '../../protocol/MusicalContext'
// 🩸 WAVE 2105: FUZZY RESURRECTION — Fuzzy gets a real vote
import type { FuzzyDecision } from './FuzzyDecisionMaker'
// 🎲 WAVE 2183: DIVERSITY FIX — Arsenal selector respeta penalización de diversidad
import { getDNAAnalyzer, EFFECT_DNA_REGISTRY } from '../dna/EffectDNA'

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010: DIVINE THRESHOLD & VIBE-AWARE ARSENAL
// ═══════════════════════════════════════════════════════════════════════════
// Movido desde ContextualEffectSelector - EL GENERAL tiene el control total

/** 
 * Umbral de Z-Score para DIVINE moment (momento de máximo impacto obligatorio) 
 * 🔬 WAVE 2185: Elevado de 3.5 a 4.0 + dual validation con energía efectiva
 */
export const DIVINE_THRESHOLD = 4.0

/**
 * 🔪 WAVE 1010: DIVINE ARSENAL BY VIBE
 * Armas de destrucción masiva por género musical.
 * Cuando Z > DIVINE_THRESHOLD, el General ordena fuego pesado.
 */
export const DIVINE_ARSENAL: Record<string, string[]> = {
  'fiesta-latina': [
    'latina_meltdown',   // 🔥 El derretimiento final — APEX LATINO PURO
    'oro_solido',        // 🥇 WAVE 2189: El Trompetazo — muro de oro, peso y brillo
    'solar_flare',       // ☀️ Explosión dorada
    'salsa_fire',        // 🔥 Fuego salsero como drop de refuerzo
    //  WAVE 2187: strobe_storm EXILIADO — deportado a techno-club.
    // El strobe_storm es una criatura techno/industrial. En fiesta-latina
    // provocaba multi-disparos caóticos y rompía la identidad sonora del show.
    // Su hogar es el bunker, no la cantina.
  ],
  'techno-club': [
    'neon_blinder',      // ⚡ WAVE 2182: APEX flash wall (primero — más nuevo y brutal)
    'industrial_strobe', // 🔨 El Martillo — APEX único, dueño del DROP
    'gatling_raid',      // 🔫 Metralladora
    'core_meltdown',     // ☢️ LA BESTIA
    'strobe_storm',      // ⚡ 🛸 WAVE 2187: Tormenta — SOLO techno, su hogar natural
    // ⚰️ WAVE 2214: surgical_strike EXILIADO del DIVINE_ARSENAL
    // Era el segundo en el arsenal y ganaba el DROP con score de diversidad inflado.
    // El surgical_strike es tier INTENSE, no PEAK/DIVINE. Su hogar es la buildup,
    // no el drop. El DROP pertenece al Martillo.
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
// 🛡️ WAVE 2200.3: HEAVY ARSENAL DEFINITION
// ═══════════════════════════════════════════════════════════════════════════
// Efectos con aggression >= 0.80 en el DNA registry.
// Estos efectos son ARMAS NUCLEARES — solo se disparan en:
//   1. DIVINE (Z > 4.0σ + energy > 0.65) — emergencia estadística real
//   2. DROP CONFIRMED (section === 'drop') — el clímax ya llegó
// En buildups, versos y breakdowns están PROHIBIDOS porque:
//   "Un core_meltdown en un buildup es como tirar fuegos artificiales
//    antes de las campanadas. Visualmente no queda MAL, pero narrativamente
//    arruina el clímax." — Radwulf, WAVE 2200
// ═══════════════════════════════════════════════════════════════════════════
export const HEAVY_ARSENAL_EFFECTS: ReadonlySet<string> = new Set([
  'core_meltdown',       // aggression: 1.00, chaos: 0.75 — LA BESTIA (WAVE 2202)
  'industrial_strobe',   // aggression: 0.95, chaos: 0.55 — El Martillo (WAVE 2202)
  'gatling_raid',        // aggression: 0.90, chaos: 0.40 — Metralladora
  'neon_blinder',        // aggression: 0.82, chaos: 0.15 — Flash wall
  'strobe_storm',        // aggression: 0.80, chaos: 0.75 — Tormenta
  'latina_meltdown',     // aggression: 0.95, chaos: ?   — El derretimiento latino
  'thunder_struck',      // aggression: 0.85, chaos: ?   — Stadium blinder
  'feedback_storm',      // aggression: 0.80, chaos: ?   — Caos visual
])

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

  /** 🩸 WAVE 2105: FUZZY RESURRECTION — Fuzzy decision gets a real vote in the pipeline */
  fuzzyDecision?: FuzzyDecision
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
//  WAVE 2187: THE DROP LOCK — Anti-Esquizofrenia
// ═══════════════════════════════════════════════════════════════════════════
// 
// PROBLEMA OBSERVADO (logs):
//   strobe_storm → latina_meltdown → solar_flare en < 1 segundo durante drops largos.
//   El DecisionMaker lanzaba 'prepare_for_drop' en CADA frame mientras section=drop.
//   Resultado: multi-disparos caóticos = show esquizofrénico.
//
// SOLUCIÓN:
//   Un estado de módulo: dropLock.
//   - Al disparar un DROP EFFECT, se activa el lock con el sectionId del drop.
//   - Mientras section===drop y el lock esté activo, NO se lanza otro DROP EFFECT.
//   - El lock se resetea cuando section cambia (sale del drop).
//
// Un Drop = Un Efecto principal. El DIVINE (Z>4σ) puede seguir sobreescribiendo
// porque eso es un evento físico único, no una repetición del drop.
// ═══════════════════════════════════════════════════════════════════════════

/** Estado del lock de drop — sección del drop que ya disparó */
let _dropLockSection: string | null = null

/**
 * 🔒 WAVE 2187: Resetea el drop lock si la sección cambió.
 * Debe llamarse al inicio de cada makeDecision() para detectar transición out-of-drop.
 */
function updateDropLock(currentSection: string): void {
  if (_dropLockSection !== null && currentSection !== 'drop') {
    console.log(`[DecisionMaker 🔒] DROP LOCK RELEASED: section transitioned drop→${currentSection}`)
    _dropLockSection = null
  }
}

/**
 * 🔒 WAVE 2187: Intenta adquirir el drop lock.
 * @returns true si el lock se adquirió (primera vez en este drop), false si ya estaba bloqueado.
 */
function acquireDropLock(): boolean {
  if (_dropLockSection !== null) {
    return false  // Ya hay un efecto de drop disparado en esta sección
  }
  _dropLockSection = 'drop'
  console.log(`[DecisionMaker 🔒] DROP LOCK ACQUIRED — single effect per drop`)
  return true
}
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
  
  // 🔒 WAVE 2187: Actualizar drop lock — detecta salida del drop
  updateDropLock(inputs.pattern.section)
  
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
 * 0. 🌩️ DIVINE MOMENT (Z > 4.0 + energy > 0.65 + zona válida) - OBLIGATORIO
 * 1. 🧬 DNA Brain Integration (si disponible y aprobado)
 * 2. 🎯 HuntEngine worthiness
 * 3. 📉 Drop predicho
 * 4. 📈 Buildup/Beauty
 * 5. 🧘 Hold
 */
function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty, dreamIntegration, energyContext, zScore, activeDictator, fuzzyDecision } = inputs
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌩️ PRIORIDAD -1: DIVINE MOMENT (Z > 4.0 + energy gate)
  // WAVE 1010: Movido desde ContextualEffectSelector - EL GENERAL DECIDE
  // 🔒 WAVE 1177: Skip if dictator is active (prevents log spam)
  // 🔬 WAVE 2185: DUAL VALIDATION — Z alto + energía real alta
  //    En minimal techno, Z puede explotar por micro-variaciones estadísticas
  //    pero la energía real de la pista es baja (0.25-0.45).
  //    DIVINE solo se justifica cuando la pista REALMENTE está ardiendo.
  // ═══════════════════════════════════════════════════════════════════════
  const currentZ = zScore ?? 0

  // ═══════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 2201: DIVINE ENERGY GATE — Hard Techno Minimal Calibration
  // ═══════════════════════════════════════════════════════════════════════
  // PROBLEMA DETECTADO (buildupextrema.md + hard-techno-minimal sessions):
  //   Bombos secos tras silencios largos generan Z-Scores masivos (+7.0σ)
  //   porque la stdDev acumulada es casi cero (silencio → un golpe = Z enorme).
  //   Con DIVINE_ENERGY_GATE = 0.65 estos "falsos positivos estadísticos"
  //   pasaban el gate y disparaban MANDATORY FIRE durante versos y transiciones.
  //   En techno-club la energía media es 0.78 y el pico real empieza en 0.92.
  //   0.65 es prácticamente un valle en ese perfil.
  //
  // SOLUCIÓN (2 tramos):
  //   • energy < 0.85 (zone gentle/active pero no hirviendo):
  //       → FALL THROUGH a prioridades inferiores.
  //       El Z estadístico NO justifica el arsenal divino si la pista no está
  //       en zona Intense/Peak. Las prioridades de drop/buildup/hunt siguen activas.
  //   • 0.85 <= energy (zone intense/peak — la pista REALMENTE está ardiendo):
  //       → DIVINE STRIKE. Aquí sí tiene sentido el arsenal nuclear.
  //
  // CAMBIO vs WAVE 2185:
  //   Antes: energy < 0.65 → return 'strike' (disparo garantizado, solo no-DIVINE)
  //   Ahora: energy < 0.85 → fall through (el contexto musical decide, no forzamos)
  //   El tramo 0.65–0.84 ya NO fuerza ningún strike — deja al resto de prioridades
  //   evaluar si corresponde o no. Más musical, menos mecánico.
  // ═══════════════════════════════════════════════════════════════════════
  const DIVINE_ENERGY_GATE = 0.85  // 🔬 WAVE 2201: zona Intense/Peak threshold
  
  // 🔒 WAVE 1177: Si hay dictador activo, no intentar DIVINE
  // (El efecto activo tiene "la palabra", no le interrumpimos)
  if (activeDictator) {
    // No loggear nada - silencio total para evitar spam
    // El dictador ya fue anunciado cuando se disparó
  } else if (currentZ >= DIVINE_THRESHOLD) {
    const zone = energyContext?.zone ?? 'gentle'
    const effectiveEnergy = energyContext?.smoothed ?? 0
    
    // Consciencia energética: NO divine en zonas de silencio
    // (No dispares artillería pesada en un funeral)
    if (zone === 'silence' || zone === 'valley') {
      console.log(`[DecisionMaker 🌩️] DIVINE BLOCKED: Z=${currentZ.toFixed(2)}σ but zone=${zone} (protected)`)
      // Fall through a siguiente prioridad
    } else if (effectiveEnergy < DIVINE_ENERGY_GATE) {
      // 🔬 WAVE 2201: Z estadísticamente masivo pero energía real insuficiente
      // (bombo seco tras silencio, minimal techno transición, verso de baja energía)
      // → NO forzar ningún strike, dejar que el pipeline musical decida
      console.log(
        `[DecisionMaker 🌩️] DIVINE SUPPRESSED: Z=${currentZ.toFixed(2)}σ but energy=${effectiveEnergy.toFixed(2)} < ${DIVINE_ENERGY_GATE} ` +
        `(gate Intense/Peak) → falling through to musical context priorities`
      )
      // Fall through — NO return aquí. Hunt/drop/buildup evaluarán el frame.
    } else {
      console.log(`[DecisionMaker 🌩️] DIVINE MOMENT: Z=${currentZ.toFixed(2)}σ energy=${effectiveEnergy.toFixed(2)} zone=${zone} → MANDATORY FIRE`)
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🩸 WAVE 2106: BREAKDOWN PROTECTION — La oscuridad es sagrada
  // ═══════════════════════════════════════════════════════════════════════
  // LOG EVIDENCE (1123 lines, post-WAVE 2105):
  //   8 of 15 effects fired during section=breakdown. acid_sweep in darkness.
  //   gatling_raid 1 tick after buildup→breakdown transition.
  //   industrial_strobe + abyssal_rise in breakdown back-to-back.
  // ROOT CAUSE: VALLEY_PROTECTION only blocks zone=valley/silence + Z<0.
  //   But during breakdowns, energy bounces 0.4-0.9 (zone=gentle/active/intense),
  //   so VALLEY_PROTECTION never triggers. Breakdowns had ZERO protection.
  // FIX: If section=breakdown → HOLD. Period. Only DIVINE (Z>3.5σ) can override.
  //   The DIVINE check above already happened — if we're here, it wasn't divine.
  //   "Estas ahi en un breakdown con silencio total, disfrutando la oscuridad
  //    de la sala.... y ala! una acid sweep" — Radwulf, WAVE 2106
  // ═══════════════════════════════════════════════════════════════════════
  const section = pattern.section
  if (section === 'breakdown') {
    return 'hold'  // 🖤 Breakdowns are sacred darkness — only DIVINE can override
  }
  
  // 🧬 PRIORIDAD 0: DNA BRAIN - LA ÚLTIMA PALABRA
  // 🔌 WAVE 976.4: FIX - Chequear effect.effect (STRING), no solo el objeto
  if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
    // ═══════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 2200.3: BUILDUP RESTRICTION — Heavy arsenal waits for the climax
    // ═══════════════════════════════════════════════════════════════════
    // ROOT CAUSE: DNA Priority 0 retornaba 'strike' INCONDICIONALMENTE.
    // Un core_meltdown (aggression=1.00) aprobado por DNA durante un buildup
    // se disparaba sin importar la sección, porque este check está ENCIMA
    // de los guards de buildup/drop/breakdown.
    //
    // FIX: Si section=buildup Y el efecto es HEAVY ARSENAL → demote.
    // El efecto NO se pierde — queda en pre-buffer o se re-evalúa cuando
    // la sección cambie a 'drop'. Los efectos light (aggression < 0.80)
    // pasan normal — un acid_sweep en buildup es musical, un core_meltdown no.
    //
    // EVIDENCE: buildupextrema.md frame ~7780:
    //   DNA approves core_meltdown at Z=0.5σ during buildup → fires as strike
    //   Should have waited for the drop 3.9s later.
    // ═══════════════════════════════════════════════════════════════════
    const proposedEffect = dreamIntegration.effect.effect
    if (section === 'buildup' && HEAVY_ARSENAL_EFFECTS.has(proposedEffect)) {
      console.log(
        `[DecisionMaker 🛡️] BUILDUP RESTRICTION: "${proposedEffect}" BLOCKED — ` +
        `section=${section}, Z=${currentZ.toFixed(2)}σ → waiting for climax`
      )
      // Fall through — el buildup handler (más abajo) se encargará con efectos suaves
    } else {
      return 'strike'  // DNA aprobó → strike con efecto de DNA
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🩸 WAVE 2105→2109: FUZZY RESURRECTION — The Fuzzy Brain gets a REAL VOTE
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 2105: Fuzzy can now trigger 'strike' → generateStrikeDecision()
  // WAVE 2109 FIX: Fuzzy was returning 'strike' 16 times but DNA had no proposal.
  //   generateStrikeDecision() checks dreamIntegration?.approved → FALSE → SILENCE.
  //   Result: 16x "[FUZZY STRIKE → strike]" immediately followed by "SILENCE: DNA has no proposal"
  //   This was a VOID SCREAM — Fuzzy ordered fire but nobody loaded the weapon.
  //   FIX: Fuzzy STRIKE only triggers 'strike' if DNA has a loaded weapon.
  //   If DNA has nothing, Fuzzy STRIKE falls through to Hunt/prediction/buildup priorities.
  //   This means Fuzzy still ACCELERATES decision-making when DNA is ready,
  //   but doesn't create 16 useless log lines when DNA pipeline is on cooldown.
  //
  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ WAVE 2203: FUZZY BUILDUP WALL
  // ═══════════════════════════════════════════════════════════════════════
  // ROOT CAUSE (LOG EVIDENCE — Radwulf's Minimal Techno session):
  //   1. BUILDUP RESTRICTION (OBJ 2200.3) blocks core_meltdown @ DNA Priority 0 ✓
  //   2. Flow falls through to Fuzzy
  //   3. Zone transition intense→peak fires (E=0.94)
  //   4. Notable_Energy_Strike: zScore.notable(1.35σ)=0.675 * energy.high(0.94)=0.88 
  //      * energyZone.highZone=1.0 = 0.594 * weight 0.75 = 0.446 → passes defuzzify
  //   5. Fuzzy says 'strike', DNA still has core_meltdown loaded → LA BESTIA DESPIERTA
  //
  // THE GRIETA: OBJ 2200.3 only guarded DNA Priority 0 path.
  //   Fuzzy bypass was UNGUARDED — it checked hasDNAProposal (true, the meltdown)
  //   but never asked "should this specific effect be allowed in a buildup?"
  //
  // FIX: Mirror the same BUILDUP + HEAVY_ARSENAL check from OBJ 2200.3.
  //   If section=buildup AND DNA's loaded weapon is HEAVY_ARSENAL → Fuzzy falls through.
  //   The Fuzzy's energy reading is REAL (E=0.94 IS high), but the SECTION is wrong.
  //   The climax hasn't arrived yet. The buildup "wawawa" atmosférico is what pushed
  //   E=0.94 — the DROP is still 800ms away. Patience.
  //
  // NOTE: This does NOT neuter Fuzzy. Fuzzy strike + light effects (acid_sweep,
  //   liquid_pulse, etc.) still passes in buildups. Only nuclear weapons are gated.
  // ═══════════════════════════════════════════════════════════════════════
  const hasDNAProposal = dreamIntegration?.approved && dreamIntegration.effect?.effect
  const fuzzyBlockedByBuildup = hasDNAProposal &&
    section === 'buildup' &&
    HEAVY_ARSENAL_EFFECTS.has(dreamIntegration!.effect!.effect)
  
  if (fuzzyDecision) {
    if (fuzzyBlockedByBuildup) {
      console.log(
        `[DecisionMaker 🛡️] FUZZY BUILDUP WALL: "${dreamIntegration!.effect!.effect}" ` +
        `blocked — Fuzzy wanted ${fuzzyDecision.action} (${fuzzyDecision.dominantRule}) ` +
        `but section=${section}, heavy arsenal waits for climax`
      )
      // Fall through — buildup_enhance handler below will manage with soft effects
    } else {
      if (fuzzyDecision.action === 'force_strike' && fuzzyDecision.confidence >= 0.60 && hasDNAProposal) {
        console.log(
          `[DecisionMaker 🧠] FUZZY FORCE_STRIKE → strike | ` +
          `conf=${fuzzyDecision.confidence.toFixed(2)} | ${fuzzyDecision.dominantRule}`
        )
        return 'strike'
      }
      if (fuzzyDecision.action === 'strike' && fuzzyDecision.confidence >= 0.50 && hasDNAProposal) {
        console.log(
          `[DecisionMaker 🧠] FUZZY STRIKE → strike | ` +
          `conf=${fuzzyDecision.confidence.toFixed(2)} | ${fuzzyDecision.dominantRule}`
        )
        return 'strike'
      }
    }
  }
  
  // 🔥 WAVE 811: Usar worthiness (0-1) en lugar de shouldStrike (boolean)
  // Prioridad 1: Momento digno detectado por HuntEngine
  // 🛡️ WAVE 2203: Same buildup wall applies — Hunt can't sneak heavy arsenal through
  const WORTHINESS_THRESHOLD = 0.65  // Umbral para considerar "digno de efecto"
  if (huntDecision.worthiness >= WORTHINESS_THRESHOLD && huntDecision.confidence > 0.50) {
    if (fuzzyBlockedByBuildup) {
      console.log(
        `[DecisionMaker 🛡️] HUNT BUILDUP WALL: worthiness=${huntDecision.worthiness.toFixed(2)} ` +
        `but "${dreamIntegration!.effect!.effect}" blocked — section=${section}`
      )
      // Fall through to buildup_enhance
    } else {
      return 'strike'
    }
  }
  
  // Prioridad 2: Drop predicho con alta probabilidad
  // 🩸 WAVE 2095: Bajado 0.8 → 0.65 — Brejcha/minimal tienen drops sutiles.
  // PredictionEngine ya filtra con confianza; 0.8 era redundantemente alto.
  // También: si section ES drop (detectado por Worker), actuar inmediatamente.
  if (prediction.type === 'drop_incoming' && prediction.probability > 0.65) {
    return 'prepare_for_drop'
  }
  if (pattern.section === 'drop') {
    return 'prepare_for_drop'
  }
  
  // Prioridad 3: energy_spike también puede ser un drop (PredictionEngine a veces lo clasifica así)
  if (prediction.type === 'energy_spike' && prediction.probability > 0.75 && pattern.rhythmicIntensity > 0.6) {
    return 'prepare_for_drop'
  }
  
  // Prioridad 4: Buildup con potencial
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
  
  const analyzer = getDNAAnalyzer()
  
  // Target DNA neutral para el cálculo (drops = máxima agresión)
  // No importa la distancia aquí — todos los del arsenal ya son "adecuados".
  // Solo nos importa el diversityFactor.
  const DIVERSITY_FACTORS = [1.0, 0.70, 0.35, 0.15]
  
  let bestEffect = arsenal[0]
  let bestScore = -1

  for (let i = 0; i < arsenal.length; i++) {
    const effectId = arsenal[i]
    // Calculamos el relevance del efecto vs un target neutro de drops (A=0.90, C=0.30, O=0.05)
    // Esto aplica el diversity factor sin necesitar el target real del frame
    const relevance = analyzer.calculateRelevance(effectId, {
      aggression: 0.90,
      chaos: 0.30,
      organicity: 0.05,
      confidence: 1.0,
    })
    
    // Tiebreak: si hay empate perfecto, el orden original del array gana
    if (relevance > bestScore + 0.001) {
      bestScore = relevance
      bestEffect = effectId
    }
  }

  console.log(
    `[DecisionMaker 🎲] DIVERSITY SELECT: winner=${bestEffect} score=${bestScore.toFixed(3)} ` +
    `from [${arsenal.join(', ')}]`
  )
  
  return bestEffect
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
  
  // 🔪 WAVE 1010: Seleccionar arsenal según vibe
  // 🌊 WAVE 2470: fallback seguro por familia — chill → chill, techno → techno, etc.
  const _arsenalFallback = (vibeId.includes('chill') || vibeId.includes('lounge') || vibeId.includes('ambient'))
    ? DIVINE_ARSENAL['chill-lounge']
    : (vibeId.includes('latin') || vibeId.includes('fiesta'))
      ? DIVINE_ARSENAL['fiesta-latina']
      : DIVINE_ARSENAL['techno-club']
  let arsenal = DIVINE_ARSENAL[vibeId] || _arsenalFallback
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 WAVE 1028: THE CURATOR - Texture Filter for DIVINE arsenal
  // ═══════════════════════════════════════════════════════════════════════
  // Ejemplo: Solo de violín (High Energy, Rock, CLEAN texture)
  //   - Sin filtro: thunder_struck (dirty) → RUIDO VISUAL MATA LA ELEGANCIA
  //   - Con filtro: liquid_solo (clean) → SPOTLIGHT ELEGANTE ✨
  // ═══════════════════════════════════════════════════════════════════════
  if (spectralContext) {
    const selector = getContextualEffectSelector()
    // 🔓 WAVE 2187: Pass vibeId so fiesta-latina bypasses CRYSTAL RULE
    const filteredArsenal = selector.filterArsenalByTexture(arsenal, {
      clarity: spectralContext.clarity,
      texture: spectralContext.texture,
      harshness: spectralContext.harshness,
      flatness: spectralContext.flatness,
      centroid: spectralContext.centroid,
      bands: {
        subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, ultraAir: 0
      }
    }, vibeId)
    
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
  
  // 🎲 WAVE 2183: DIVERSITY FIX — selección respeta penalización de uso reciente
  // 🎲 WAVE 2183.1: LOBOTOMY FIX — pasar [winner] no el arsenal completo
  // Antes: divineArsenal = arsenal completo → Repository cogía índice 0 → monopolio
  // Ahora: divineArsenal = [winner] → Repository solo valida HARD_COOLDOWN del ganador
  const suggestedEffect = selectFromArsenalWithDiversity(arsenal)
  
  output.debugInfo.reasoning = `🌩️ DIVINE MOMENT: Z=${(zScore ?? 0).toFixed(2)}σ | vibe=${vibeId} | texture=${spectralContext?.texture ?? 'unknown'} | suggested=${suggestedEffect}`
  
  // 🔪 WAVE 1010 / WAVE 2183.1: El General ya eligió. Repository solo verifica HARD_COOLDOWN.
  output.effectDecision = {
    effectType: suggestedEffect,
    intensity: 1.0,  // DIVINE = máxima intensidad
    zones: ['all'],  // DIVINE afecta todo
    reason: `🌩️ DIVINE: Z=${(zScore ?? 0).toFixed(2)}σ > ${DIVINE_THRESHOLD} | Winner: ${suggestedEffect} | Full arsenal: ${arsenal.join(', ')}`,
    confidence: 0.99,
    // 🎲 WAVE 2183.1: [winner] solamente — Frontal Lobe Supremacy
    // Repository itera este array de 1 elemento: si está en HARD_COOLDOWN → silencio.
    // No hay plan B aleatorio. El General ya habló.
    divineArsenal: [suggestedEffect],
  } as any
  
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
  const { prediction, beauty, pattern, zScore, energyContext } = inputs
  
  output.confidence = Math.max(confidence, 0.85)  // 🩸 WAVE 2095: Drops merecen alta confianza
  output.source = 'prediction'
  output.debugInfo.huntState = 'evaluating'
  output.debugInfo.beautyScore = beauty.totalBeauty
  output.debugInfo.reasoning = `🔴 DROP PREPARATION: ${prediction.reasoning} | Z=${(zScore ?? 0).toFixed(2)}`
  
  // 🩸 WAVE 2095 / WAVE 2101.2: Si el drop OCURRE AHORA, sugerir efecto HARD
  // La predicción nos avisa con 'timeToEvent' de hasta 4000-8000ms de antelación.
  // Solo disparamos la artillería cuando estamos MUY cerca o si ya estamos en section=drop.
  // Si no, vaciamos el arsenal durante el buildup (spam de CIENTOS de efectos).
  const isDropImminent = prediction.estimatedTimeMs < 800 || pattern.section === 'drop'
  
  if (prediction.probability > 0.7 && isDropImminent) {
    // 🔒 WAVE 2187: THE DROP LOCK — Anti-Esquizofrenia
    // Si ya disparamos un efecto en este drop, NO volver a disparar.
    // Un Drop = Un Efecto principal. El DIVINE (Z>4σ) tiene su propio path.
    if (!acquireDropLock()) {
      console.log(`[DecisionMaker 🔒] DROP LOCKED — effect already fired for this drop section. Suppressing.`)
      // Sin effectDecision — las physics reactivas siguen funcionando
    } else {
      const vibeId = pattern.vibeId
      // Usar el arsenal DIVINE como pool de efectos hard para drops
      // 🌊 WAVE 2470: fallback seguro — chill no hereda el arsenal techno
      const _dropFallback = (vibeId.includes('chill') || vibeId.includes('lounge') || vibeId.includes('ambient'))
        ? DIVINE_ARSENAL['chill-lounge']
        : (vibeId.includes('latin') || vibeId.includes('fiesta'))
          ? DIVINE_ARSENAL['fiesta-latina']
          : DIVINE_ARSENAL['techno-club']
      const dropArsenal = DIVINE_ARSENAL[vibeId] || _dropFallback
      
      // 🎲 WAVE 2183: DIVERSITY FIX — DROP no puede saltarse la penalización
      // 🎲 WAVE 2183.1: LOBOTOMY FIX — pasar [winner] no el arsenal completo
      // ANTES: dropArsenal completo → Repository cogía índice 0 → neon_blinder siempre
      // AHORA: [winner] → Repository solo valida HARD_COOLDOWN. El General ya eligió.
      const suggestedEffect = selectFromArsenalWithDiversity(dropArsenal)
      
      // ═══════════════════════════════════════════════════════════════════
      // 🛡️ WAVE 2200.2: ANTI-FAKE-DROP — Z-Score Sanity Check
      // ═══════════════════════════════════════════════════════════════════
      // ROOT CAUSE: generateDropPreparationDecision() tenía CERO validación
      // energética. Un drop con Z negativo (energía colapsando) seguía
      // disparando arsenal pesado. El Oracle predice ESTRUCTURA (hay drop),
      // pero la ENERGÍA puede no acompañar (fake drop, DJ cortó graves).
      //
      // FIX: Si el efecto seleccionado es HEAVY ARSENAL Y Z < 0.5σ → abortar.
      // Los efectos ligeros (no-heavy) pasan sin restricción — un flash suave
      // en un mini-drop es aceptable. Solo los nucleares requieren energía real.
      //
      // EVIDENCE: buildupextrema.md:
      //   Drop predictions fire during DJ EQ manipulation (bass cut),
      //   Oracle sees structure → predicts drop, but energy is actually falling.
      // ═══════════════════════════════════════════════════════════════════
      const currentZ = zScore ?? 0
      if (HEAVY_ARSENAL_EFFECTS.has(suggestedEffect) && currentZ < 0.5) {
        console.log(
          `[DecisionMaker 🛡️] ANTI-FAKE-DROP: "${suggestedEffect}" ABORTED — ` +
          `Z=${currentZ.toFixed(2)}σ < 0.5 (energy insufficient for heavy arsenal)`
        )
        // Sin effectDecision — las physics reactivas manejan la transición suavemente
      } else {
        output.effectDecision = {
          effectType: suggestedEffect,
          intensity: 0.8 + prediction.probability * 0.2,  // 0.94-1.0 según probabilidad
          zones: ['all'],
          reason: `🔴 DROP: prob=${prediction.probability.toFixed(2)} | winner=${suggestedEffect} | full arsenal=${dropArsenal.join(', ')}`,
          confidence: prediction.probability,
          // 🎲 WAVE 2183.1: [winner] solamente — Frontal Lobe Supremacy
          divineArsenal: [suggestedEffect],
        } as any
        
        console.log(
          `[DecisionMaker 🔴] DROP EFFECT: ${suggestedEffect} | prob=${prediction.probability.toFixed(2)} ` +
          `vibe=${vibeId} | Z=${currentZ.toFixed(2)}`
        )
      }
    }
  }
  
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
