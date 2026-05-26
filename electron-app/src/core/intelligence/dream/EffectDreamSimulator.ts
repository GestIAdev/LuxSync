/**
 * 🔮 EFFECT DREAM SIMULATOR
 * "El Oráculo que ve el futuro de los efectos"
 * 
 * WAVE 900.1 - Phase 1: Foundation
 * WAVE 920.2 - Mood integration (pre-filtering blocked effects)
 * WAVE 970 - 🧬 CONTEXTUAL DNA: Relevancia contextual reemplaza belleza hardcodeada
 * 
 * @module EffectDreamSimulator
 * @description Sistema de simulación predictiva para efectos visuales.
 *              Simula múltiples escenarios de efectos y rankea por RELEVANCIA CONTEXTUAL,
 *              riesgo, coherencia de vibe y diversidad.
 * 
 * RESPONSABILIDADES:
 * - Simular escenarios de efectos (no solo color como ScenarioSimulator)
 * - 🧬 WAVE 970: Predecir RELEVANCIA (no belleza) usando DNA matching
 * - Calcular risk level (GPU load, audience fatiga, cooldowns)
 * - Detectar conflictos de cooldown
 * - Mirar 4 compases adelante (musical prediction)
 * - Rankear escenarios por ADECUACIÓN CONTEXTUAL
 * - 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
 * 
 * FILOSOFÍA:
 * "Soñar antes de actuar. Ver el futuro antes de decidir."
 * 
 * 🧬 WAVE 970 PHILOSOPHY:
 * "Selene no busca belleza. Selene busca VERDAD."
 * Un efecto no es "bonito" o "feo" - es ADECUADO o INADECUADO para el contexto.
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-21
 */

import type { AudienceSafetyContext } from './AudienceSafetyContext'

// 🎭 WAVE 920.2: MOOD INTEGRATION
import { MoodController } from '../../mood/MoodController'

// 🧬 WAVE 970: CONTEXTUAL DNA SYSTEM
// 🎨 WAVE 1029: THE DREAMER - Texture Affinity Integration
import { 
  getDNAAnalyzer,
  type TargetDNA,
  type AudioMetricsForDNA,
  type MusicalContextForDNA
} from '../dna/EffectDNA'

// ⚡ WAVE 4824: DYNAMIC EFFECT REGISTRY — fuente única de verdad del arsenal
import { getDynamicEffectRegistry } from '../../arsenal/DynamicEffectRegistry'

// ⚡ WAVE 4846: SPATIAL COGNITION — Hardware Guard
import { getTitanOrchestrator } from '../../orchestrator/TitanOrchestrator'
import { normalizeZone } from '../../stage/ShowFileV2'

// SelenePalette type (minimal definition for Phase 1)
interface SelenePalette {
  primary: number
  secondary: number
  accent: number
  [key: string]: number
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EffectCandidate {
  effect: string                    // 'industrial_strobe', 'acid_sweep', etc.
  intensity: number                 // 0-1
  zones: string[]                   // ['all'], ['movers'], etc.
  reasoning: string                 // Why this effect?
  confidence: number                // 0-1, from DecisionMaker
  projectedBeauty?: number          // From DreamEngine (si disponible)
  riskLevel?: number                // From DreamEngine (si disponible)
}

export interface SystemState {
  // 🎨 VISUAL STATE
  currentPalette: SelenePalette
  currentBeauty: number             // 0-1
  
  // ⚡ EFFECT STATE
  lastEffect: string | null
  lastEffectTime: number            // ms
  activeCooldowns: Map<string, number>
  
  // 📊 METRICS
  energy: number                    // 0-1, energía musical
  tempo: number                     // BPM
  vibe: string
}

export interface MusicalPrediction {
  // 🎵 PREDICTION (+4 bars)
  predictedEnergy: number           // Energía esperada
  predictedSection: string          // 'drop', 'buildup', 'breakdown', etc.
  predictedTempo: number            // BPM esperado
  
  // 🎯 CONFIDENCE
  confidence: number                // 0-1, confianza en predicción
  
  // 📊 ANALYSIS
  isDropComing: boolean             // ¿Viene un drop en 4 bars?
  isBreakdownComing: boolean        // ¿Viene un breakdown?
  energyTrend: 'rising' | 'stable' | 'falling'
  
  // 🧠 WAVE 1173: NEURAL LINK - Oracle → Dreamer
  /** Tipo de predicción cruda del Oráculo (para boost/penalty en scoring) */
  predictionType?: 'energy_spike' | 'buildup_starting' | 'breakdown_imminent' | 'drop_incoming' | 'energy_drop' | 'none'
  
  // 🔮 WAVE 1190: PROYECTO CASSANDRA - Anticipación inteligente
  /** Tiempo estimado hasta el evento predicho (ms) */
  timeToEventMs?: number
  /** ¿Es urgente? (<2s y alta probabilidad) */
  isUrgent?: boolean
  /** Probabilidad real del Oráculo (0-1) */
  oracleProbability?: number
  /** Efectos sugeridos por el Oráculo */
  suggestedEffects?: string[]
  /** Razonamiento del Oráculo para debug/learning */
  oracleReasoning?: string | null
}

export interface EffectScenario {
  // 🎯 EFFECT
  effect: EffectCandidate
  
  // 📊 PROJECTED METRICS
  // 🧬 WAVE 970: projectedBeauty DEPRECADO - ahora es projectedRelevance
  projectedBeauty: number           // 0-1, LEGACY (alias de projectedRelevance)
  projectedRelevance: number        // 🧬 0-1, relevancia contextual DNA
  beautyDelta: number               // Cambio vs estado actual (legacy)
  riskLevel: number                 // 0-1, riesgo del efecto
  
  // 🧬 WAVE 970: DNA METRICS
  dnaDistance: number               // Distancia euclidiana al Target DNA
  targetDNA?: TargetDNA             // Target DNA usado para calcular
  
  // 🔮 PREDICTION
  projectedConsonance: number       // Coherencia con estado anterior
  gpuLoadImpact: number             // Impacto en GPU (0-1)
  audienceFatigueImpact: number     // Impacto en fatiga (0-1)
  
  // ⚠️ CONFLICTS
  cooldownConflicts: string[]       // Efectos en cooldown que bloquean
  hardwareConflicts: string[]       // Conflictos de hardware
  
  // 🎭 CONTEXT
  vibeCoherence: number             // 0-1, qué tan coherente con vibe
  diversityScore: number            // 0-1, qué tan diverso vs recent
  
  // 🔬 CONFIDENCE
  simulationConfidence: number      // 0-1, confianza en simulación
}

export interface EffectDreamResult {
  scenarios: EffectScenario[]       // Todos los escenarios simulados
  bestScenario: EffectScenario | null // El mejor encontrado
  recommendation: 'execute' | 'modify' | 'abort' // Qué hacer
  reason: string                    // Por qué
  warnings: string[]                // Advertencias detectadas
  simulationTimeMs: number          // Tiempo de cómputo
}


// ═══════════════════════════════════════════════════════════════
// EFFECT DREAM SIMULATOR
// ═══════════════════════════════════════════════════════════════

/**
 * 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Cache
 * Guarda efectos pre-calculados para eventos predichos con alta confianza
 */
interface PreBufferedEffect {
  /** Efecto pre-calculado */
  effect: EffectCandidate
  /** Score del escenario */
  score: number
  /** Timestamp de cuando fue bufferizado */
  bufferedAt: number
  /** Timestamp predicho para el evento */
  predictedEventAt: number
  /** Tipo de predicción que lo generó */
  predictionType: string
  /** Probabilidad del Oráculo al momento de bufferizar */
  oracleProbability: number
}

export class EffectDreamSimulator {
  private simulationCount: number = 0
  
  // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer system
  private preBuffer: PreBufferedEffect | null = null
  private readonly PRE_BUFFER_MIN_PROBABILITY = 0.65  // Solo buffer si Oráculo > 65% seguro
  private readonly PRE_BUFFER_MIN_TIME_MS = 2000      // Solo buffer si > 2s hasta evento
  private readonly PRE_BUFFER_MAX_AGE_MS = 5000       // Expira después de 5s
  
  constructor() {
    // WAVE 2098: Boot silence
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Simula múltiples escenarios de efectos y rankea por belleza
   */
  public async dreamEffects(
    currentState: SystemState,
    musicalPrediction: MusicalPrediction,
    context: AudienceSafetyContext
  ): Promise<EffectDreamResult> {
    const startTime = Date.now()
    this.simulationCount++
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Check
    // Si tenemos un efecto pre-bufferizado y el evento está cerca, USARLO
    // ═══════════════════════════════════════════════════════════════
    
    const now = Date.now()
    // 🛡️ WAVE 2093.1: Guard Infinity — `Infinity ?? 4000` returns Infinity (not null).
    const timeToEvent = (Number.isFinite(musicalPrediction.timeToEventMs) && musicalPrediction.timeToEventMs! > 0)
      ? musicalPrediction.timeToEventMs! : 4000
    const oracleProbability = musicalPrediction.oracleProbability ?? 0
    const isUrgent = musicalPrediction.isUrgent ?? false
    
    // Verificar si el pre-buffer es válido y relevante
    if (this.preBuffer) {
      const bufferAge = now - this.preBuffer.bufferedAt
      const isExpired = bufferAge > this.PRE_BUFFER_MAX_AGE_MS
      const isEventImminent = timeToEvent < 1500 // < 1.5s = ya casi llega
      
      if (isExpired) {
        // Buffer expirado, limpiar
        this.preBuffer = null
      } else if (isEventImminent && isUrgent) {
        // 🚀 CASSANDRA FAST PATH: Usar el efecto pre-bufferizado!
        console.log(`[DREAM_SIMULATOR] 🔮⚡ CASSANDRA FAST PATH: Using pre-buffered "${this.preBuffer.effect.effect}" (buffered ${bufferAge}ms ago, event in ${timeToEvent}ms)`)
        
        // Crear escenario desde el buffer
        const bufferedScenario = this.simulateScenario(this.preBuffer.effect, currentState, context)
        
        // Limpiar buffer (usado)
        const usedBuffer = this.preBuffer
        this.preBuffer = null
        
        const simulationTimeMs = Date.now() - startTime
        
        return {
          scenarios: [bufferedScenario],
          bestScenario: bufferedScenario,
          recommendation: 'execute',
          reason: `🔮 CASSANDRA PRE-BUFFER: "${usedBuffer.effect.effect}" ready for ${usedBuffer.predictionType} (${(usedBuffer.oracleProbability * 100).toFixed(0)}% confidence)`,
          warnings: [],
          simulationTimeMs
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // NORMAL PATH: Generar y evaluar candidatos
    // ═══════════════════════════════════════════════════════════════
    
    // 1. Generar candidatos basados en vibe y prediction
    const candidates = this.generateCandidates(currentState, musicalPrediction, context)
    
    // 2. Simular cada escenario
    const scenarios: EffectScenario[] = []
    for (const candidate of candidates) {
      const scenario = this.simulateScenario(candidate, currentState, context)
      scenarios.push(scenario)
    }
    
    // 3. Rankear escenarios
    const rankedScenarios = this.rankScenarios(scenarios, musicalPrediction)
    
    // 4. Seleccionar mejor escenario
    const bestScenario = rankedScenarios[0] || null
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Storage
    // Si alta confianza y tiempo suficiente, guardar el mejor para después
    // ═══════════════════════════════════════════════════════════════
    
    if (bestScenario && 
        oracleProbability >= this.PRE_BUFFER_MIN_PROBABILITY && 
        timeToEvent >= this.PRE_BUFFER_MIN_TIME_MS &&
        !this.preBuffer) {  // Solo si no hay buffer ya
      
      const predictionType = musicalPrediction.predictionType ?? 'none'
      
      if (predictionType !== 'none') {
        this.preBuffer = {
          effect: bestScenario.effect,
          score: bestScenario.projectedRelevance,
          bufferedAt: now,
          predictedEventAt: now + timeToEvent,
          predictionType,
          oracleProbability,
        }
        
        console.log(`[DREAM_SIMULATOR] 🔮📦 CASSANDRA PRE-BUFFER: "${bestScenario.effect.effect}" stored for ${predictionType} in ~${(timeToEvent / 1000).toFixed(1)}s (${(oracleProbability * 100).toFixed(0)}% confidence)`)
      }
    }
    
    // 5. Generar recomendación
    const recommendation = this.generateRecommendation(bestScenario, context)
    
    // 6. Detectar warnings
    const warnings = this.detectWarnings(rankedScenarios, context)
    
    const simulationTimeMs = Date.now() - startTime
    
    // 🧹 WAVE 1015: Solo logear si slow (>5ms) o si hay problema
    if (simulationTimeMs > 5 && bestScenario) {
      console.log(`[DREAM_SIMULATOR] 🎯 ${bestScenario.effect.effect} (${simulationTimeMs}ms)`)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 2200.1: CASSANDRA TEMPORAL SEAL
    // ═══════════════════════════════════════════════════════════════
    // ROOT CAUSE: Cuando Cassandra almacena un pre-buffer (timeToEvent >= 2000ms),
    // generateRecommendation() TAMBIÉN devuelve 'execute' si projectedRelevance >= 0.30.
    // El Integrator ve 'execute' → aprueba → DecisionMaker dispara inmediatamente.
    // El pre-buffer se vuelve redundante porque el efecto ya se disparó.
    //
    // FIX: Si ESTE frame acaba de almacenar un pre-buffer, la recomendación se
    // degrada a 'modify' (= "tengo algo pero NO es hora"). El efecto queda
    // sellado en el buffer hasta que el FAST PATH lo libere cuando:
    //   - timeToEvent < 1500ms (urgencia real)
    //   - O la sección predicha se confirme
    //
    // EVIDENCE: buildupextrema.md frame ~7780:
    //   CASSANDRA stores core_meltdown for drop in ~3.9s
    //   → INTEGRATOR ✅ APPROVED (because recommendation was 'execute')
    //   → core_meltdown fires at Z=0.5σ during buildup. PREMATURO.
    // ═══════════════════════════════════════════════════════════════
    const justBuffered = this.preBuffer && this.preBuffer.bufferedAt === now
    if (justBuffered && recommendation.action === 'execute') {
      const deferredReason = `🔮 CASSANDRA DEFERRED: "${bestScenario!.effect.effect}" sealed for ${this.preBuffer!.predictionType} in ~${(timeToEvent / 1000).toFixed(1)}s — awaiting section confirmation`
      console.log(`[DREAM_SIMULATOR] 🔮🛡️ TEMPORAL SEAL: ${bestScenario!.effect.effect} → 'modify' (pre-buffer active, timeToEvent=${timeToEvent}ms)`)
      return {
        scenarios: rankedScenarios,
        bestScenario,
        recommendation: 'modify',
        reason: deferredReason,
        warnings,
        simulationTimeMs,
      }
    }
    
    return {
      scenarios: rankedScenarios,
      bestScenario,
      recommendation: recommendation.action,
      reason: recommendation.reason,
      warnings,
      simulationTimeMs
    }
  }
  
  /**
   * Simula UN escenario específico (para evaluación rápida)
   */
  public simulateScenario(
    effect: EffectCandidate,
    currentState: SystemState,
    context: AudienceSafetyContext
  ): EffectScenario {
    // Proyectar belleza
    const projectedBeauty = this.projectBeauty(effect, currentState, context)
    const beautyDelta = projectedBeauty - currentState.currentBeauty
    
    // Calcular riesgo
    const riskLevel = this.calculateRisk(effect, currentState, context)
    
    // Proyectar consonancia (coherencia con estado anterior)
    const projectedConsonance = this.projectConsonance(effect, currentState)
    
    // Impacto en GPU
    const gpuLoadImpact = this.calculateGpuImpact(effect, context)
    
    // Impacto en fatiga de audiencia
    const audienceFatigueImpact = this.calculateFatigueImpact(effect, context)
    
    // Detectar conflictos
    const cooldownConflicts = this.detectCooldownConflicts(effect, currentState)
    const hardwareConflicts = this.detectHardwareConflicts(effect, context)
    
    // Coherencia con vibe
    const vibeCoherence = this.calculateVibeCoherence(effect, context)
    
    // Score de diversidad
    const diversityScore = this.calculateDiversityScore(effect, context)
    
    // Confianza en simulación
    const simulationConfidence = this.calculateSimulationConfidence(
      effect,
      currentState,
      context
    )
    
    // 🧬 WAVE 970: DNA-based contextual relevance
    const { relevance: projectedRelevance, distance: dnaDistance, targetDNA } = 
      this.calculateDNARelevance(effect, currentState, context)
    
    return {
      effect,
      projectedBeauty,
      projectedRelevance,       // 🧬 WAVE 970: DNA relevance (replaces beauty as primary)
      beautyDelta,
      riskLevel,
      dnaDistance,              // 🧬 WAVE 970: Euclidean distance to target DNA
      targetDNA,                // 🧬 WAVE 970: For debugging/logging
      projectedConsonance,
      gpuLoadImpact,
      audienceFatigueImpact,
      cooldownConflicts,
      hardwareConflicts,
      vibeCoherence,
      diversityScore,
      simulationConfidence
    }
  }
  
  /**
   * Explora efectos alternativos (similar a hue shifts pero para efectos)
   */
  public exploreAlternatives(
    primaryEffect: EffectCandidate,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    // ⚡ WAVE 4824: Registry exclusivo — EFFECT_CATEGORIES exterminado
    const registry = getDynamicEffectRegistry()
    const primaryEntry = registry.getEntry(primaryEffect.effect)
    if (!primaryEntry) return []

    const vibe = primaryEntry.compatibleVibes[0] ?? ''
    return registry.getEffectsForVibe(vibe)
      .filter(e => e.id !== primaryEffect.effect)
      .map(e => ({
        effect: e.id,
        intensity: primaryEffect.intensity * 0.9,
        zones: primaryEffect.zones,
        reasoning: `Alternative to ${primaryEffect.effect} (same vibe)`,
        confidence: primaryEffect.confidence * 0.8
      }))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: CANDIDATE GENERATION
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * 🛡️ WAVE 975: VIBE SHIELD
   * 
   * Solo efectos permitidos para el VIBE actual.
   * industrial_strobe NUNCA aparece en fiesta-latina.
   * cumbia_moon NUNCA aparece en techno-club.
   */
  private getVibeAllowedEffects(vibe: string): string[] {
    // ⚡ WAVE 4824: Registry exclusivo — EFFECTS_BY_VIBE exterminado
    const entries = getDynamicEffectRegistry().getEffectsForVibe(vibe)
    if (entries.length > 0) return entries.map(e => e.id)
    return []
  }
  
  /**
   * 🧘 WAVE 975: ZONE AWARENESS
   * 🔥 WAVE 982: ZONE FILTER RECALIBRATION - Post Peak Hold
   * 
   * Filtra efectos por zona energética usando DNA Aggression.
   * 
   * FILOSOFÍA DE DISEÑO:
   * - DigitalRain (A=0.35): Efecto AMBIENTAL, no debe aparecer en drops pesados
   * - Gatling (A=0.90): AMETRALLADORA para builds finales y peaks ultra-rápidos
   * 
   * AJUSTES POST-PEAK HOLD (WAVE 980.4):
   * - Zonas energéticas: active (0.82), intense (0.92), peak (≥0.92)
   * - Techno builds pre-drop (E=0.78-0.82) están en 'active'
   * 
   * PROBLEMA DETECTADO (WAVE 982):
   * - Gatling (A=0.90) bloqueado en 'active' (max era 0.85)
   * - Builds intensos (E=0.80) = zona 'active' pero necesitan Gatling
   * 
   * SOLUCIÓN:
   * - 'active': max 0.85 → 0.95 (GATLING entra en builds)
   * - 'intense': min 0.45 SIN CAMBIOS (DigitalRain correctamente bloqueado)
   */
  private filterByZone(effects: string[], zone: string): string[] {
    // 🎚️ WAVE 996: THE LADDER OVERRIDES - Rangos ampliados para no competir con ContextualEffectSelector
    // THE LADDER ya hace la clasificación correcta en ContextualEffectSelector.
    // Aquí solo filtramos extremos obvios (no poner strobe pesado en silence).
    const aggressionLimits: Record<string, { min: number; max: number }> = {
      'silence': { min: 0, max: 0.30 },    // Solo efectos muy suaves
      'valley':  { min: 0, max: 0.50 },    // Suaves + algo de respiración
      'ambient': { min: 0, max: 0.70 },    // Moderados (ampliar para digital_rain + acid_sweep)
      'gentle':  { min: 0, max: 0.85 },    // Transición amplia (incluir ambient_strobe, binary_glitch)
      'active':  { min: 0.20, max: 1.00 }, // Libertad casi total (cyber_dualism, seismic_snap)
      'intense': { min: 0.45, max: 1.00 }, // Agresivos completos (sky_saw, abyssal_rise)
      'peak':    { min: 0.70, max: 1.00 }, // Solo los más brutales (gatling, core_meltdown, industrial)
    }
    
    const limits = aggressionLimits[zone] || { min: 0, max: 1 }
    
    const registry = getDynamicEffectRegistry()
    const filtered = effects.filter(effect => {
      const entry = registry.getEntry(effect)
      if (!entry) {
        console.warn(`[DREAM_SIMULATOR] ⚠️ No Registry entry for effect: ${effect}`)
        return false
      }
      return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
    })
    
    // Si el filtro es demasiado estricto y no queda nada, relajar
    if (filtered.length === 0) {
      console.log(`[DREAM_SIMULATOR] 🧘 Zone ${zone} filter too strict (limits: ${limits.min}-${limits.max}), returning suavest available`)
      // Devolver los 3 efectos con menor agresión de la lista original
      return effects
        .filter(e => registry.getEntry(e))
        .sort((a, b) => (registry.getEntry(a)?.dna.aggression ?? 0) - (registry.getEntry(b)?.dna.aggression ?? 0))
        .slice(0, 3)
    }
    
    return filtered
  }
  
  /**
   * Helper para logging: muestra el rango de agresión de una zona
   * 🎚️ WAVE 996: Updated para THE LADDER - rangos ampliados
   */
  private getZoneAggressionRange(zone: string): string {
    const ranges: Record<string, string> = {
      'silence': '0-0.30',
      'valley': '0-0.50',
      'ambient': '0-0.70',
      'gentle': '0-0.85',
      'active': '0.20-1.00',
      'intense': '0.45-1.00',
      'peak': '0.70-1.00',
    }
    return ranges[zone] || '0-1.00'
  }
  
  /**
   * 🎲 WAVE 1178: ANTI-DETERMINISM - Hash de nombre de efecto
   * 
   * Genera un número determinista (0-99) basado en el nombre del efecto.
   * NO ES ALEATORIO - el mismo nombre siempre da el mismo hash.
   * 
   * Se usa combinado con el timestamp para crear una "rotación"
   * de qué efectos tienen boost en cada ventana de tiempo.
   * 
   * Esto rompe el determinismo sin violar el Axioma Anti-Simulación
   * (no usamos Math.random(), usamos el timestamp del mundo real).
   */
  private hashEffectName(name: string): number {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash) % 100
  }
  
  /**
   * 🧘 WAVE 975: Deriva la zona energética del valor de energía (0-1)
   * Mismo mapeo que SeleneTitanConscious usa
   */
  private deriveEnergyZone(energy: number): string {
    if (energy < 0.10) return 'silence'
    if (energy < 0.25) return 'valley'
    if (energy < 0.40) return 'ambient'
    if (energy < 0.55) return 'gentle'
    if (energy < 0.70) return 'active'
    if (energy < 0.85) return 'intense'
    return 'peak'
  }
  
  private generateCandidates(
    state: SystemState,
    prediction: MusicalPrediction,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    const candidates: EffectCandidate[] = []
    
    // 🛡️ WAVE 975: VIBE SHIELD - Solo efectos permitidos para este VIBE
    const vibeAllowedEffects = this.getVibeAllowedEffects(state.vibe)
    
    // 🛡️ WAVE 1178: ZONE PROTECTION - Obtener Z-Score para protección de valles
    const zScore = context.zScore ?? 0
    
    // 🔴 WAVE 1178: VALLEY/SILENCE PROTECTION
    // Si estamos en zone de baja energía Y la energía está BAJANDO (Z<0),
    // NO DISPARAR EFECTOS. La música está en un funeral, no molestes.
    const energyZone = context.energyZone ?? this.deriveEnergyZone(context.energy)
    
    if ((energyZone === 'valley' || energyZone === 'silence') && zScore < 0) {
      // 🧹 WAVE 1178.1: Log SILENCIADO - spam innecesario
      // console.log(`[DREAM_SIMULATOR] 🛡️ VALLEY PROTECTION: zone=${energyZone} Z=${zScore.toFixed(2)} → NO CANDIDATES`)
      return [] // No generar candidatos - la música está muriendo
    }
    
    const zoneSource = context.energyZone ? 'SeleneTitanConscious' : 'local-fallback'
    
    const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, energyZone)

    // 🎯 WAVE 4865: Muestreo sin reemplazo por effect id.
    // Evita clones en ranking cuando múltiples aliases/vías aportan el mismo efecto.
    const seenEffectIds = new Set<string>()
    
    // 🧹 WAVE 1015: Silenciado - spam innecesario
    
    // 🎭 WAVE 920.2: Pre-filtrar efectos bloqueados por mood
    const moodController = MoodController.getInstance()
    const currentProfile = moodController.getCurrentProfile()
    let blockedCount = 0
    let zoneBlockedCount = vibeAllowedEffects.length - zoneFilteredEffects.length
    
    // ⚡ WAVE 4846: SPATIAL COGNITION — Hardware manifest snapshot (once per call)
    // Construimos el Set de CanonicalZones activas UNA SOLA VEZ antes del loop.
    // Cada fixture habilitado contribuye su zona normalizada → el guard compara contra este Set.
    const _hwManifest = getTitanOrchestrator().getFixturesForZoneMapping()
    const activeZoneSet = new Set<string>(
      _hwManifest
        .filter(f => f.enabled !== false)
        .map(f => normalizeZone(f.zone))
    )

    // Generar candidatos SOLO de efectos filtrados
    for (const effect of zoneFilteredEffects) {
      if (seenEffectIds.has(effect)) {
        continue
      }
      seenEffectIds.add(effect)

      // 🎭 WAVE 920.2: Skip efectos bloqueados por mood (no gastar CPU simulando)
      if (moodController.isEffectBlocked(effect)) {
        blockedCount++
        continue
      }
      
      // ═══════════════════════════════════════════════════════════════════════════
      // ⚡ WAVE 4843: COGNITIVE BRIDGE — STROBE Z-GUARD + ZSCORE GUARDS
      // ═══════════════════════════════════════════════════════════════════════════
      // WAVE 1179/1180 usaban una lista hardcodeada STROBE_EFFECTS y un nombre
      // hardcodeado ('gatling_raid'). Ambos destruidos en WAVE 4843.
      //
      // NUEVO COMPORTAMIENTO (lee directamente del .lfx):
      //   1. Si entry.simMeta.isStrobe === true y zScore <= 0 → skip
      //      (los efectos strobe se auto-declaran strobe en su JSON)
      //
      //   2. Si entry.simMeta.zScoreGuards.minimumZ existe y zScore < minimumZ → skip
      //      (cualquier efecto puede declarar su guard mínimo de Z-Score)
      //
      //   3. Si entry.simMeta.zScoreGuards.minimumEnergy existe y energy < minimumEnergy → skip
      //      (idem para energía)
      //
      // Esto convierte los guards en metadatos del efecto, no del motor.
      // ═══════════════════════════════════════════════════════════════════════════
      const registry = getDynamicEffectRegistry()
      const entry = registry.getEntry(effect)
      if (entry) {
        const { isStrobe, zScoreGuards } = entry.simMeta
        const { energy } = context

        // Guard 1: Strobe en energía descendente
        if (isStrobe && zScore <= 0) {
          continue
        }

        // Guard 2: minimumZ declarado en el .lfx
        if (zScoreGuards.minimumZ !== null && zScore < zScoreGuards.minimumZ) {
          continue
        }

        // Guard 3: minimumEnergy declarado en el .lfx
        if (zScoreGuards.minimumEnergy !== null && energy < zScoreGuards.minimumEnergy) {
          continue
        }

        // Guard 4: Hardware Compatibility — fixtureTargeting vs active manifest
        // ⚡ WAVE 4846: Si el .lfx exige un hardware específico (movers, strobes, pars…)
        // que no está presente en el rig actual, el candidato se descarta aquí.
        // 'all' = universal, siempre pasa. Fail-open: targeting desconocido → no bloquea.
        if (!this._isTargetingAvailable(entry.execHints.fixtureTargeting, activeZoneSet)) {
          continue
        }
      }
      
      // Calcular intensidad basada en energía predicha
      const intensity = this.calculateIntensity(prediction.predictedEnergy, effect)
      
      // 🔮 WAVE 1190: PROYECTO CASSANDRA - Boost para efectos sugeridos por el Oráculo
      const isSuggestedByOracle = prediction.suggestedEffects?.some(
        suggested => effect.includes(suggested) || suggested.includes(effect)
      ) ?? false
      
      // 🔮 CASSANDRA: Confidence boost si el Oráculo sugirió este efecto
      // 🩸 WAVE 2104: Reducido de 0.15 a 0.08 — sugerencia, no imposición
      const oracleBoost = isSuggestedByOracle ? 0.08 : 0
      const baseConfidence = prediction.confidence * 0.9
      const finalConfidence = Math.min(1, baseConfidence + oracleBoost)
      
      candidates.push({
        effect,
        intensity,
        zones: ['all'], // Simplificado para Phase 1
        reasoning: isSuggestedByOracle 
          ? `🔮 CASSANDRA: Oracle suggested | vibe=${state.vibe} zone=${energyZone}`
          : `🧬 DNA Dream: vibe=${state.vibe} zone=${energyZone}`,
        confidence: finalConfidence
      })
    }
    
    // 🔮 WAVE 1190: CASSANDRA LOG - Solo si hay predicción fuerte
    if (prediction.confidence > 0.6 && prediction.predictionType !== 'none') {
      console.log(
        `[DREAM_SIMULATOR] 🔮 CASSANDRA: type=${prediction.predictionType} ` +
        `conf=${prediction.confidence.toFixed(2)} ` +
        `timeToEvent=${prediction.timeToEventMs ?? '?'}ms ` +
        `urgent=${prediction.isUrgent} ` +
        `candidates=${candidates.length}`
      )
    }
    
    return candidates
  }
  
  /**
   * ⚡ WAVE 4846: SPATIAL COGNITION — Hardware Guard
   *
   * Verifica si el hardware presente en el rig satisface el requisito declarado
   * en `fixtureTargeting` del .lfx. Opera sobre el Set de CanonicalZones activas
   * construido una vez en `generateCandidates()` con normalizeZone().
   *
   * Mapping FixtureTargeting → CanonicalZone:
   *   'all'        → universal, siempre true
   *   'movers'     → movers-left | movers-right
   *   'pars'       → front | back | floor
   *   'strobes'    → center  (normalizeZone('strobes') = 'center')
   *   'zone-front' → front
   *   'zone-back'  → back
   *   'zone-left'  → movers-left
   *   'zone-right' → movers-right
   *   unknown      → true  (fail-open: no bloqueamos targeting futuro desconocido)
   */
  private _isTargetingAvailable(targeting: string, activeZones: Set<string>): boolean {
    switch (targeting) {
      case 'all':   return true
      case 'movers':    return activeZones.has('movers-left') || activeZones.has('movers-right')
      case 'pars':      return activeZones.has('front') || activeZones.has('back') || activeZones.has('floor')
      case 'strobes':   return activeZones.has('center')
      case 'zone-front': return activeZones.has('front')
      case 'zone-back':  return activeZones.has('back')
      case 'zone-left':  return activeZones.has('movers-left')
      case 'zone-right': return activeZones.has('movers-right')
      default:      return true
    }
  }

  private calculateIntensity(predictedEnergy: number, effect: string): number {
    // Intensidad base de la energía predicha
    let intensity = predictedEnergy
    
    // Ajustar por tipo de efecto
    if (effect.includes('strobe') || effect.includes('laser')) {
      // Efectos agresivos usan full energy
      intensity = Math.min(1.0, predictedEnergy * 1.1)
    } else if (effect.includes('wave') || effect.includes('cascade')) {
      // Efectos suaves usan menos energy
      intensity = predictedEnergy * 0.8
    }
    
    return Math.max(0, Math.min(1, intensity))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🦕 LEGACY: BEAUTY PROJECTION (WAVE 970: DEPRECADO)
  // ═══════════════════════════════════════════════════════════════
  // 
  // ⚠️ WAVE 970: Este método está DEPRECADO.
  // La "belleza" ya no es el criterio principal.
  // Usamos calculateDNARelevance() para matching contextual.
  // 
  // Este método se mantiene SOLO para:
  // 1. Compatibilidad con código legacy que espere projectedBeauty
  // 2. Período de transición mientras se valida el nuevo sistema
  // 
  // TODO WAVE 971+: Remover completamente una vez validado DNA system
  // ═══════════════════════════════════════════════════════════════
  
  private projectBeauty(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    // ⚡ WAVE 4823: Registry exclusivo — EFFECT_BEAUTY_WEIGHTS exterminado (ACO Triad)
    const simMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)
    if (!simMeta) return 0.5  // No en registry → neutro

    const { base, energyMultiplier, vibeBonus } = simMeta.beautyWeights

    // ACO Triad: base × energía × vibe
    let beauty = base
    beauty *= (1 + (context.energy - 0.5) * (energyMultiplier - 1))
    beauty += vibeBonus

    // Intensity factor + momentum de belleza actual
    beauty *= (0.7 + 0.3 * effect.intensity)
    beauty = beauty * 0.7 + state.currentBeauty * 0.3

    return Math.max(0, Math.min(1, beauty))
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: RISK CALCULATION
  // ═══════════════════════════════════════════════════════════════
  
  private calculateRisk(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    let risk = 0.0
    
    // GPU overload risk — ⚡ WAVE 4823: Registry
    const simMeta = getDynamicEffectRegistry().getSimMeta(effect.effect)
    const gpuCost = simMeta?.gpuCost ?? 0.15
    const projectedGpuLoad = context.gpuLoad + gpuCost * effect.intensity
    
    if (projectedGpuLoad > 0.8) {
      risk += 0.3 // High GPU risk
    } else if (projectedGpuLoad > 0.6) {
      risk += 0.1 // Moderate GPU risk
    }
    
    // Audience fatigue risk — ⚡ WAVE 4823: Registry
    const fatigueImpact = simMeta?.fatigueImpact ?? 0.05
    const projectedFatigue = context.audienceFatigue + fatigueImpact * effect.intensity
    
    if (projectedFatigue > 0.8) {
      risk += 0.4 // High fatigue risk
    } else if (projectedFatigue > 0.6) {
      risk += 0.2 // Moderate fatigue risk
    }
    
    // Epilepsy risk (strobes en epilepsy mode)
    if (context.epilepsyMode && effect.effect.includes('strobe')) {
      risk += 0.5 // Critical risk
    }
    
    // Cooldown violation risk
    if (state.activeCooldowns.has(effect.effect)) {
      risk += 0.2
    }
    
    // Intensity risk (muy alto = arriesgado)
    if (effect.intensity > 0.9) {
      risk += 0.1
    }
    
    return Math.min(1.0, risk)
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: OTHER PROJECTIONS
  // ═══════════════════════════════════════════════════════════════
  
  private projectConsonance(effect: EffectCandidate, state: SystemState): number {
    // Si no hay efecto anterior, consonancia neutral
    if (!state.lastEffect) return 0.7
    
    // Mismo efecto = alta consonancia (pero puede ser monotonía)
    if (effect.effect === state.lastEffect) return 0.9
    
    // ⚡ WAVE 4824: Misma familia de vibes = consonancia moderada (Registry)
    const registry = getDynamicEffectRegistry()
    const effectVibes = registry.getEntry(effect.effect)?.compatibleVibes ?? []
    const lastVibes = registry.getEntry(state.lastEffect)?.compatibleVibes ?? []
    if (effectVibes.some(v => lastVibes.includes(v))) {
      return 0.7
    }
    
    // Efectos de categoría diferente = baja consonancia (puede ser bueno o malo)
    return 0.4
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 🧬 WAVE 970: DNA-BASED CONTEXTUAL RELEVANCE
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calcula la relevancia contextual de un efecto usando DNA matching.
   * Reemplaza el antiguo sistema de "belleza" con algo más inteligente.
   * 
  * @returns { relevance: 0-1, distance: 0-√3, targetDNA: TargetDNA }
   */
  private calculateDNARelevance(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): { relevance: number; distance: number; targetDNA: TargetDNA } {
    // Obtener el DNA del efecto del Registry dinámico
    const effectEntry = getDynamicEffectRegistry().getEntry(effect.effect)
    
    // Si no existe en el registry, usar valores neutros
    if (!effectEntry) {
      console.warn(`[DREAM_SIMULATOR] ⚠️ Effect ${effect.effect} not in Registry, using neutral DNA`)
      return {
        relevance: 0.50,  // Neutral
        distance: 0.866,  // √3/2 = centro del espacio
        targetDNA: { aggression: 0.5, chaos: 0.5, organicity: 0.5, confidence: 0.5 }
      }
    }
    
    // ⚡ WAVE 4849: Texture neutralized in Selene runtime (no reject/boost by texture)
    const harshness = context.spectral?.harshness ?? 0.4
    const spectralFlatness = context.spectral?.flatness ?? 0.5
    
    // Construir MusicalContext para el DNAAnalyzer
    // Derivamos todo lo que podemos de AudienceSafetyContext + SystemState
    const musicalContext: MusicalContextForDNA = {
      energy: state.energy,
      syncopation: undefined,  // No disponible directamente
      mood: this.deriveMusicalMood(context),
      section: {
        type: this.deriveSection(state, context),
        confidence: 0.75
      },
      rhythm: {
        drums: {
          kickIntensity: state.energy * 0.8  // Derivado de energía
        },
        fillDetected: false,
        groove: context.vibe.includes('latino') ? 0.8 : 0.5,
        confidence: 0.7
      },
      energyContext: {
        trend: state.energy > 0.5 ? 1 : state.energy < 0.3 ? -1 : 0
      },
      confidence: 0.75
    }
    
    // Construir AudioMetrics para el DNAAnalyzer
    const audioMetrics: AudioMetricsForDNA = {
      bass: state.energy * 0.7,
      mid: 0.5,
      treble: context.vibe.includes('techno') ? 0.6 : 0.4,
      volume: state.energy,
      harshness,
      spectralFlatness
    }
    
    // Usar el DNAAnalyzer singleton para derivar el Target DNA
    const dnaAnalyzer = getDNAAnalyzer()
    const targetDNA = dnaAnalyzer.deriveTargetDNA(musicalContext, audioMetrics)
    
    // 🩸 WAVE 2104.1: DIAGNOSTIC — Target DNA (throttled: 1 per effect per dream cycle)
    // Solo loguear para el PRIMER efecto evaluado en cada dream cycle (evitar spam)
    if (this.simulationCount % 5 === 0 && effect.effect === 'acid_sweep') {
      console.log(`[DNA_TARGET] 🎯 Target: A=${targetDNA.aggression.toFixed(2)} C=${targetDNA.chaos.toFixed(2)} O=${targetDNA.organicity.toFixed(2)} | E=${state.energy.toFixed(2)} H=${harshness.toFixed(2)}`)
    }
    
    // Calcular distancia euclidiana 3D usando dna del Registry
    const effDna = effectEntry.dna
    const dA = effDna.aggression - targetDNA.aggression
    const dC = effDna.chaos - targetDNA.chaos
    const dO = effDna.organicity - targetDNA.organicity
    const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
    
    // Convertir distancia a relevancia (0-1)
    // Distancia máxima teórica es √3 ≈ 1.732
    const MAX_DISTANCE = Math.sqrt(3)
    let relevance = 1.0 - (distance / MAX_DISTANCE)
    
    relevance = Math.max(0, Math.min(1, relevance))
    
    return { relevance, distance, targetDNA }
  }
  
  /**
   * 🧬 WAVE 970: Deriva mood musical del contexto de audiencia
   */
  private deriveMusicalMood(context: AudienceSafetyContext): 'aggressive' | 'melancholic' | 'euphoric' | 'neutral' {
    if (context.vibe.includes('techno')) return 'aggressive'
    if (context.vibe.includes('latino')) return 'euphoric'
    if (context.vibe.includes('chill') || context.vibe.includes('ambient')) return 'melancholic'
    return 'neutral'
  }
  
  /**
   * 🧬 WAVE 970: Deriva sección del estado actual
   */
  private deriveSection(state: SystemState, context: AudienceSafetyContext): 'drop' | 'buildup' | 'breakdown' | 'verse' | 'chorus' | 'intro' | 'outro' {
    // Derivación simple basada en energía
    if (state.energy > 0.85) return 'drop'
    if (state.energy > 0.65) return 'chorus'
    if (state.energy < 0.25) return 'breakdown'
    return 'verse'
  }

  private calculateGpuImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ⚡ WAVE 4823: Registry
    const gpuCost = getDynamicEffectRegistry().getSimMeta(effect.effect)?.gpuCost ?? 0.15
    return Math.min(1.0, gpuCost * effect.intensity)
  }
  
  private calculateFatigueImpact(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ⚡ WAVE 4823: Registry
    const fatigueImpact = getDynamicEffectRegistry().getSimMeta(effect.effect)?.fatigueImpact ?? 0.05
    return fatigueImpact * effect.intensity
  }
  
  private detectCooldownConflicts(effect: EffectCandidate, state: SystemState): string[] {
    const conflicts: string[] = []
    
    if (state.activeCooldowns.has(effect.effect)) {
      const remainingMs = state.activeCooldowns.get(effect.effect)!
      conflicts.push(`${effect.effect} in cooldown (${(remainingMs / 1000).toFixed(1)}s remaining)`)
    }
    
    return conflicts
  }
  
  private detectHardwareConflicts(effect: EffectCandidate, context: AudienceSafetyContext): string[] {
    const conflicts: string[] = []
    
    // GPU overload — ⚡ WAVE 4823: Registry
    const gpuCost = getDynamicEffectRegistry().getSimMeta(effect.effect)?.gpuCost ?? 0.15
    if (context.gpuLoad + gpuCost > 0.9) {
      conflicts.push('GPU overload risk')
    }
    
    // Epilepsy mode
    if (context.epilepsyMode && effect.effect.includes('strobe')) {
      conflicts.push('Epilepsy mode blocks strobes')
    }
    
    return conflicts
  }
  
  private calculateVibeCoherence(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ═══════════════════════════════════════════════════════════════
    // 🩸 WAVE 2104: VIBE COHERENCE REFORM
    // ANTES: Solo 3 efectos (industrial_strobe, acid_sweep, cyber_dualism) tenían 1.0
    //        Los otros 12 efectos techno tenían 0.5 → cyber_dualism ganaba +0.09 siempre
    // AHORA: TODOS los efectos registrados en EFFECTS_BY_VIBE son "de la casa" (0.85)
    //        Los no registrados (herejía inter-género) son 0.0
    //        Efectos desconocidos: 0.4
    // FILOSOFÍA: La coherencia de vibe ya se filtra en generateCandidates() con
    //            getVibeAllowedEffects(). Si un efecto llegó hasta aquí, ES coherente.
    //            Dar ventaja injusta a 3 elegidos es ARISTOCRACIA, no democracia.
    // ═══════════════════════════════════════════════════════════════
    
    // TECHNO: Todos los efectos techno registrados son igualmente de casa
    if (context.vibe.includes('techno')) {
      const TECHNO_FAMILY = [
        'industrial_strobe', 'gatling_raid', 'core_meltdown',
        'sky_saw', 'abyssal_rise',
        'cyber_dualism', 'seismic_snap',
        'ambient_strobe', 'binary_glitch',
        'acid_sweep', 'digital_rain',
        'void_mist', 'fiber_optics',
        'deep_breath', 'sonar_ping'
      ]
      if (TECHNO_FAMILY.includes(effect.effect)) {
        return 0.85  // Todos son familia — nadie es más techno que otro
      }
      // Herejía inter-género
      if (['solar_flare', 'tropical_pulse', 'salsa_fire', 'corazon_latino'].includes(effect.effect)) {
        return 0.0
      }
      return 0.4  // Desconocido
    }
    
    // LATINO: Todos los efectos latinos registrados son igualmente de casa
    if (context.vibe.includes('latino')) {
      const LATINO_FAMILY = [
        'ghost_breath', 'amazon_mist',
        'cumbia_moon', 'tidal_wave',
        'corazon_latino', 'strobe_burst',
        'clave_rhythm', 'tropical_pulse',
        'glitch_guaguanco', 'machete_spark',
        'salsa_fire', 'solar_flare',
        'latina_meltdown', 'strobe_storm'
      ]
      if (LATINO_FAMILY.includes(effect.effect)) {
        return 0.85
      }
      return 0.4
    }
    
    return 0.6 // Neutral para vibes desconocidos
  }
  
  private calculateDiversityScore(effect: EffectCandidate, context: AudienceSafetyContext): number {
    // ═══════════════════════════════════════════════════════════════
    // 🔥 WAVE 982.5: DIVERSITY ENGINE - ESCALERA DE PENALIZACIÓN
    // ═══════════════════════════════════════════════════════════════
    
    // 🧹 WAVE 1178.1: DEBUG silenciado
    // if (effect.effect === 'cyber_dualism') {
    //   console.log(`[DIVERSITY_DEBUG] 🔍 cyber_dualism: historySize=${context.recentEffects.length}, effects=[${context.recentEffects.map(e=>e.effect).join(',')}]`)
    // }
    
    // Contar uso reciente (últimos efectos en el historial)
    const recentUsage = context.recentEffects
      .filter(e => e.effect === effect.effect)
      .length
    
    // 🎯 ESCALERA DE PENALIZACIÓN DIRECTA
    let diversityScore: number
    
    switch (recentUsage) {
      case 0:
        diversityScore = 1.0   // ✅ Efecto fresco - sin penalización
        break
      case 1:
        diversityScore = 0.7   // ⚠️ Usado 1x - 30% penalty
        break
      case 2:
        diversityScore = 0.4   // 🟠 Usado 2x - 60% penalty
        break
      default:
        diversityScore = 0.1   // 🔴 Usado 3+x - 90% SHADOWBAN
        break
    }

    // 🩸 WAVE 4865: FATIGUE Z-SCORE — efectos con fatiga extrema se castigan más.
    // 0.80 -> x1.00, 0.90 -> x0.75, 1.00 -> x0.50
    const fatigueImpact = getDynamicEffectRegistry().getSimMeta(effect.effect)?.fatigueImpact ?? 0
    if (fatigueImpact > 0.8) {
      const highFatigueMultiplier = 1 - ((fatigueImpact - 0.8) * 2.5)
      diversityScore *= Math.max(0.5, highFatigueMultiplier)
      diversityScore = Math.max(0.05, diversityScore)
    }
    
    return diversityScore
  }
  
  private calculateSimulationConfidence(
    effect: EffectCandidate,
    state: SystemState,
    context: AudienceSafetyContext
  ): number {
    let confidence = 1.0
    
    // Reducir confianza si poco historial
    if (context.recentEffects.length < 10) {
      confidence *= 0.7
    }
    
    // Reducir confianza si alta fatiga (comportamiento impredecible)
    if (context.audienceFatigue > 0.7) {
      confidence *= 0.8
    }
    
    // Reducir confianza si efecto desconocido en Registry
    if (!getDynamicEffectRegistry().getEntry(effect.effect)) {
      confidence *= 0.5
    }
    
    return confidence
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: RANKING & RECOMMENDATION
  // ═══════════════════════════════════════════════════════════════
  
  private rankScenarios(scenarios: EffectScenario[], prediction: MusicalPrediction): EffectScenario[] {
    // Multi-factor ranking
    // 🔍 WAVE 996.6: DEBUG - Log top candidates to diagnose diversity issues
    const scored = scenarios.map(s => ({
      scenario: s,
      score: this.calculateScenarioScore(s, prediction)
    })).sort((a, b) => b.score - a.score)
    
    // � WAVE 2104.1: DIAGNOSTIC LOG — Top 5 candidatos con desglose completo
    // SIN ESTO ESTAMOS CIEGOS. Se desactiva cuando el sistema esté calibrado.
    const top5 = scored.slice(0, 5)
    const predType = prediction.predictionType ?? 'none'
    console.log(
      `[DREAM_RANKING] 🏆 TOP 5 (${scored.length} total) | pred=${predType} conf=${prediction.confidence.toFixed(2)}:\n` +
      top5.map((s, i) => {
        const sc = s.scenario
        const dna = `DNA=${sc.projectedRelevance.toFixed(2)}`
        const div = `DIV=${sc.diversityScore.toFixed(2)}`
        const vib = `VIB=${sc.vibeCoherence.toFixed(2)}`
        const rsk = `RSK=${sc.riskLevel.toFixed(2)}`
        const dist = `dist=${sc.dnaDistance.toFixed(2)}`
        const tex = sc.effect.reasoning.includes('TEXTURE') ? '🎨REJECTED' : ''
        return `  ${i + 1}. ${sc.effect.effect.padEnd(20)} SCORE=${s.score.toFixed(3)} | ${dna} ${div} ${vib} ${rsk} ${dist} ${tex}`
      }).join('\n')
    )
    
    return scored.map(s => s.scenario)
  }
  
  private calculateScenarioScore(scenario: EffectScenario, prediction: MusicalPrediction): number {
    // ═══════════════════════════════════════════════════════════════
    // 🧬 WAVE 970: DNA-BASED SCORING
    // 🔥 WAVE 982.5: DIVERSITY ENGINE INTEGRATION
    // 🧠 WAVE 1173: NEURAL LINK - Oracle → Dreamer scoring
    // 🎲 WAVE 1178: ANTI-DETERMINISM ENGINE - Exploration factor
    // ═══════════════════════════════════════════════════════════════
    // 
    // FÓRMULA:
    // FinalScore = (Relevance * DiversityFactor) + vibeBonus + riskPenalty + SPIKE_BOOST + EXPLORATION
    // 
    // 🎲 WAVE 1178: EXPLORATION FACTOR
    // El problema: DNA scoring es 100% determinista, siempre gana el mismo.
    // Solución: Añadir varianza basada en TIMESTAMP para que diferentes
    //           candidatos ganen en diferentes momentos sin usar Math.random().
    // 
    // El exploration factor usa el hash del nombre del efecto XOR timestamp
    // para crear una rotación determinista que varía en el tiempo.
    // Esto NO es aleatorio, pero tampoco es predecible sin conocer el timestamp.
    // ═══════════════════════════════════════════════════════════════
    
    let score = 0
    const effectName = scenario.effect.effect.toLowerCase()
    
    // 🩸 WAVE 2104: adjustedRelevance ya no se usa en pesos principales
    // (diversity es factor independiente ahora), pero se mantiene para el perfect match check
    const adjustedRelevance = scenario.projectedRelevance * scenario.diversityScore
    
    // 🎲 WAVE 1178: ANTI-DETERMINISM - Exploration Factor
    // 🩸 WAVE 2104: Ventana 10s→8s, probabilidad 30%→40%, boost 0.15→0.12
    // Más efectos rotan más frecuentemente pero con boost más moderado.
    // Antes: 30% recibían +0.15 cada 10s = picos agresivos infrecuentes
    // Ahora: 40% reciben +0.12 cada 8s = rotación más suave y constante
    const effectHash = this.hashEffectName(effectName)
    const timeWindow = Math.floor(Date.now() / 8000) // 🩸 WAVE 2104: Cambia cada 8 segundos (era 10)
    const explorationSeed = (effectHash + timeWindow) % 100
    const explorationBoost = (explorationSeed < 40) ? 0.12 : 0 // 🩸 WAVE 2104: 40% de efectos (era 30%), boost 0.12 (era 0.15)
    
    // 🧬 Pesos del scoring (ajustados para hacer espacio a exploración)
    // 🩸 WAVE 2104: REBALANCE — "Cassandra es el copiloto, no el piloto"
    // ANTES: relevance*0.45, vibe*0.18, risk*0.18, simConf*0.09, exploration*0.10
    // PROBLEMA: DNA relevance (45%) dominaba todo. cyber_dualism SIEMPRE ganaba porque
    //           su DNA (A=0.55, C=0.50, O=0.45) está en el CENTRO del espacio y
    //           la distancia euclidiana es MÍNIMA para energías medias.
    //           Diversity se multiplicaba DENTRO de relevance → el efecto con mejor
    //           DNA distance aplastaba cualquier penalización de diversidad.
    // AHORA: Diversity se pondera SEPARADAMENTE del DNA relevance.
    //        DNA baja a 0.35, Diversity sube a 0.20 como factor INDEPENDIENTE.
    //        Exploration sube a 0.12 para más varianza temporal.
    score += scenario.projectedRelevance * 0.35     // 🧬 DNA puro (era 0.45 con diversity incluida)
    score += scenario.diversityScore * 0.20          // 🎲 Diversity INDEPENDIENTE (nuevo)
    score += scenario.vibeCoherence * 0.15           // Coherencia de vibe (era 0.18, ahora que es igualitaria baja)
    score += (1 - scenario.riskLevel) * 0.13         // Bajo riesgo (era 0.18)
    score += scenario.simulationConfidence * 0.05    // Confianza (era 0.09)
    score += explorationBoost                        // 🎲 WAVE 1178: Exploration (12% efectivo)
    
    // Penalizar conflictos
    score -= scenario.cooldownConflicts.length * 0.15
    score -= scenario.hardwareConflicts.length * 0.20
    
    // Boost si viene drop
    if (prediction.isDropComing && scenario.effect.intensity > 0.7) {
      score += 0.1
    }
    
    // Boost si match perfecto (alta relevancia Y sin penalización de diversidad)
    if (adjustedRelevance > 0.80 && scenario.dnaDistance < 0.3) {
      score += 0.05
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🧠 WAVE 1173: NEURAL LINK - Oracle Spike Reaction
    // 🎯 WAVE 1176: OPERATION SNIPER - Reacción VIOLENTA a drops
    // "El sistema debe reaccionar visualmente ANTES que el humano"
    // ═══════════════════════════════════════════════════════════════
    
    const predictionType = prediction.predictionType ?? 'none'
    
    if (predictionType === 'energy_spike' || predictionType === 'drop_incoming') {
      // 🎯 WAVE 2093 COG-6: RATIO SIMÉTRICO ±0.40
      // Era +0.50/-0.70 (ratio 7:5 asimétrico) — destruía candidatos atmosféricos en falsos spike.
      // Ahora ±0.40 simétrico: boost justo, penalti justo. Equilibrio.
      //
      // 🩸 WAVE 2095.3: Añadidos 'saw', 'abyssal', 'rise', 'dualism', 'cyber'
      // PROBLEMA: Los efectos hard con textureAffinity='dirty' (industrial_strobe, gatling_raid)
      // eran los únicos con keywords en IMPACT_EFFECTS. Pero en textura CLEAN (Brejcha,
      // clarity 0.80, harshness 0.01), todos los 'dirty' son VETADOS por texture filter.
      // Los efectos universal agresivos (sky_saw A=0.80, abyssal_rise A=0.80, cyber_dualism A=0.55)
      // NO tenían keywords aquí → ninguno recibía el +0.40 boost durante drops.
      // Resultado: en clean texture + drop_incoming, NADIE recibía boost → acid_sweep seguía ganando.
      const IMPACT_EFFECTS = [
        'strobe', 'flash', 'blind', 'gatling', 'thunder', 'meltdown', 
        'storm', 'raid', 'snap', 'spark', 'burst', 'strike', 'glitch',
        'saw', 'abyssal', 'rise', 'dualism', 'cyber'  // 🩸 WAVE 2095.3: universal agresivos
      ]
      const isImpactEffect = IMPACT_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isImpactEffect) {
        score += 0.40  // 🎯 WAVE 2093: Simétrico (era 0.50)
        // También boost intensity del candidato (mutación temporal para scoring)
        scenario.effect.intensity = Math.min(1.0, scenario.effect.intensity * 1.25)
      }
      
      // 🎯 WAVE 2093 COG-6: Penalti simétrico para lentos
      const SLOW_EFFECTS = [
        'breath', 'mist', 'drift', 'moon', 'wave', 'sweep', 'ambient', 
        'fiber', 'pulse', 'shimmer', 'plankton', 'whale', 'caustic'
      ]
      const isSlowEffect = SLOW_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isSlowEffect) {
        score -= 0.40  // 🎯 WAVE 2093: Simétrico (era 0.70 — demasiado destructivo)
      }
    }
    
    // 🌊 WAVE 1173: Buildup - Boost efectos de tensión
    if (predictionType === 'buildup_starting') {
      const TENSION_EFFECTS = ['rise', 'sweep', 'ramp', 'build', 'acid']
      const isTensionEffect = TENSION_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isTensionEffect) {
        score += 0.15
      }
    }
    
    // 📉 WAVE 1173: Breakdown - Boost efectos atmosféricos
    if (predictionType === 'breakdown_imminent' || predictionType === 'energy_drop') {
      const ATMOSPHERIC_EFFECTS = ['mist', 'breath', 'ambient', 'fiber', 'drift', 'moon']
      const isAtmospheric = ATMOSPHERIC_EFFECTS.some(keyword => effectName.includes(keyword))
      
      if (isAtmospheric) {
        score += 0.20
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1189: PROJECT CASSANDRA - URGENCY SCORING
    // Si el Oráculo dice que algo viene PRONTO (< 2s), hay que actuar YA
    // No hay tiempo para deliberación - el efecto correcto AHORA > perfecto tarde
    // ═══════════════════════════════════════════════════════════════
    
    const isUrgent = prediction.isUrgent ?? false
    // 🛡️ WAVE 2093.1: Guard Infinity — same pattern as Cassandra pre-buffer
    const timeToEvent = (Number.isFinite(prediction.timeToEventMs) && prediction.timeToEventMs! > 0)
      ? prediction.timeToEventMs! : 4000
    const oracleProbability = prediction.oracleProbability ?? 0
    
    if (isUrgent && oracleProbability > 0.5) {
      // 🚨 URGENCIA ALTA: < 2 segundos para el evento
      // 🩸 WAVE 2104: "Cassandra es el copiloto de rally que anticipa curvas, no el piloto"
      // ANTES: Max +0.35 → dominaba el scoring, convertía al Oráculo en dictador
      // AHORA: Max +0.18 → influencia significativa pero no dictatorial
      const urgencyBoost = Math.min(0.18, (2000 - timeToEvent) / 2000 * 0.18)
      score += urgencyBoost
      
      // Log para debugging de Cassandra urgency
      if (urgencyBoost > 0.10) {
        console.log(`[DREAM_SIMULATOR] ⚡ CASSANDRA URGENCY: "${effectName}" +${urgencyBoost.toFixed(2)} (${timeToEvent}ms to event, prob: ${oracleProbability.toFixed(2)})`)
      }
    }
    
    // 🔮 CASSANDRA: Boost adicional si alta probabilidad del Oráculo (> 0.7)
    // 🩸 WAVE 2104: Reducido de 0.2 a 0.10 — apoyo, no dominación
    if (oracleProbability > 0.7) {
      const confidenceBoost = (oracleProbability - 0.7) * 0.10 // Max +0.03 para prob=1.0 (era +0.06)
      score += confidenceBoost
    }
    
    return Math.max(0, Math.min(1, score))
  }
  
  private generateRecommendation(
    bestScenario: EffectScenario | null,
    context: AudienceSafetyContext
  ): { action: 'execute' | 'modify' | 'abort'; reason: string } {
    if (!bestScenario) {
      return {
        action: 'abort',
        reason: 'No viable scenarios found'
      }
    }
    
    // ABORT conditions
    if (bestScenario.riskLevel > 0.7) {
      return {
        action: 'abort',
        reason: `High risk: ${bestScenario.riskLevel.toFixed(2)}`
      }
    }
    
    if (bestScenario.hardwareConflicts.length > 0) {
      return {
        action: 'abort',
        reason: `Hardware conflicts: ${bestScenario.hardwareConflicts.join(', ')}`
      }
    }
    
    // MODIFY conditions
    // 🧬 WAVE 2093 COG-2: projectedBeauty → projectedRelevance (ghost dependency fix)
    // projectedBeauty era una métrica legacy deprecada desde WAVE 970.
    // projectedRelevance es la métrica primaria: distancia euclidiana DNA real.
    //
    // 🩸 WAVE 2095.3: Gate bajado 0.45 → 0.30
    // PROBLEMA: Con drop_incoming, los efectos IMPACT (strobes, aggression=0.85-0.95) 
    // tienen projectedRelevance BAJA (~0.35) porque el target DNA tiene aggression ~0.35
    // a energías medias de Brejcha. El ranking de CASSANDRA ya incorporó el boost de
    // +0.40 para IMPACT_EFFECTS, así que si llegó como bestScenario, GANÓ la competencia.
    // El gate de 0.45 era un second-guess redundante que MATABA todo efecto hard durante drops.
    // 0.30 mantiene protección contra efectos genuinamente irrelevantes sin vetar a los ganadores.
    if (bestScenario.projectedRelevance < 0.30) {
      return {
        action: 'modify',
        reason: `Low relevance: ${bestScenario.projectedRelevance.toFixed(2)} - consider alternatives`
      }
    }
    
    if (bestScenario.cooldownConflicts.length > 0) {
      return {
        action: 'modify',
        reason: `Cooldown conflicts - try alternative`
      }
    }
    
    // EXECUTE
    return {
      action: 'execute',
      reason: `Relevance: ${bestScenario.projectedRelevance.toFixed(2)}, Risk: ${bestScenario.riskLevel.toFixed(2)} - GO!`
    }
  }
  
  private detectWarnings(scenarios: EffectScenario[], context: AudienceSafetyContext): string[] {
    const warnings: string[] = []
    
    // High risk scenarios
    const highRiskScenarios = scenarios.filter(s => s.riskLevel > 0.7)
    if (highRiskScenarios.length > scenarios.length / 2) {
      warnings.push('⚠️ Majority of scenarios are high-risk')
    }
    
    // Low diversity
    const lowDiversityScenarios = scenarios.filter(s => s.diversityScore < 0.3)
    if (lowDiversityScenarios.length > scenarios.length / 2) {
      warnings.push('⚠️ Approaching monotony - diversity low')
    }
    
    // GPU stress
    if (context.gpuLoad > 0.7) {
      warnings.push('⚠️ GPU load high - consider lighter effects')
    }
    
    // Audience fatigue
    if (context.audienceFatigue > 0.7) {
      warnings.push('⚠️ Audience fatigue high - consider rest')
    }
    
    return warnings
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

export const effectDreamSimulator = new EffectDreamSimulator()
