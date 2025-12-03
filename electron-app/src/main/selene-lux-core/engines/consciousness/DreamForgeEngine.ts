/**
 * 🔮 DREAM FORGE ENGINE
 * El Simulador de Sueños de Selene
 * 
 * Wave 7: Meta-Consciencia
 * 
 * Selene puede "soñar" escenarios antes de ejecutarlos.
 * Si el BeautyScore soñado es bajo, aborta el cambio.
 * 
 * "En mis sueños, veo todas las posibilidades.
 *  Solo despierto cuando encuentro la más bella."
 *                              — Selene, Gen 1
 */

import { EventEmitter } from 'events'
import { FibonacciPatternEngine } from './FibonacciPatternEngine'
import { MusicalHarmonyValidator } from './MusicalHarmonyValidator'
import { ZodiacAffinityCalculator } from './ZodiacAffinityCalculator'

// ============================================================================
// TYPES
// ============================================================================

/** Tipo de sueño/escenario a simular */
export type DreamType = 
  | 'palette_change'      // Cambio de paleta de colores
  | 'intensity_shift'     // Cambio de intensidad
  | 'movement_change'     // Cambio de patrón de movimiento
  | 'effect_activation'   // Activación de efecto
  | 'mood_transition'     // Transición de estado emocional
  | 'strike_execution'    // Ejecución de strike
  | 'full_scene_change'   // Cambio completo de escena

/** Escenario hipotético a simular */
export interface DreamScenario {
  type: DreamType
  description: string
  parameters: Record<string, unknown>
  currentState: DreamState
  proposedState: DreamState
}

/** Estado de un sueño (actual o propuesto) */
export interface DreamState {
  palette?: string
  intensity?: number
  movement?: string
  effects?: string[]
  mood?: string
  note?: string
  element?: string
  energy?: number
}

/** Resultado de un sueño simulado */
export interface DreamResult {
  dreamId: string
  scenario: DreamScenario
  
  // Métricas de belleza
  currentBeautyScore: number
  projectedBeautyScore: number
  beautyDelta: number
  
  // Análisis de componentes
  components: DreamComponents
  
  // Decisión
  recommendation: 'execute' | 'modify' | 'abort'
  confidence: number
  reasoning: string
  
  // Alternativas sugeridas (si abort/modify)
  alternatives: DreamAlternative[]
  
  // Timing
  simulationTimeMs: number
  timestamp: number
}

/** Componentes de belleza del sueño */
export interface DreamComponents {
  harmonicBeauty: number      // Armonía musical 0-1
  fibonacciAlignment: number  // Alineación con PHI 0-1
  zodiacResonance: number     // Resonancia zodiacal 0-1
  transitionSmoothness: number // Suavidad de transición 0-1
  noveltyBonus: number        // Bonus por novedad 0-0.2
}

/** Alternativa sugerida cuando un sueño es rechazado */
export interface DreamAlternative {
  description: string
  modifiedParameters: Record<string, unknown>
  projectedBeautyScore: number
}

/** Configuración del Dream Forge */
export interface DreamForgeConfig {
  minBeautyThreshold: number     // Score mínimo para ejecutar (default: 0.6)
  abortThreshold: number         // Score para abortar automático (default: 0.3)
  maxSimulationTimeMs: number    // Tiempo máximo por simulación (default: 50ms)
  generateAlternatives: boolean  // Generar alternativas si falla (default: true)
  maxAlternatives: number        // Máximo de alternativas (default: 3)
}

/** Historial de sueños */
interface DreamHistory {
  dream: DreamResult
  wasExecuted: boolean
  actualOutcome?: number  // Beauty real si se ejecutó
}

/** Estado del Dream Forge */
export interface DreamForgeState {
  status: 'idle' | 'dreaming' | 'analyzing'
  currentDream: DreamScenario | null
  dreamsProcessed: number
  dreamsApproved: number
  dreamsAborted: number
  averageBeautyGain: number
  lastDreamTime: number
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Mapeo de notas a escalas */
const NOTE_TO_SCALE: Record<string, string> = {
  'DO': 'major',
  'RE': 'dorian',
  'MI': 'phrygian',
  'FA': 'lydian',
  'SOL': 'mixolydian',
  'LA': 'minor',
  'SI': 'locrian'
}

/** Mapeo de elementos a posiciones zodiacales */
const ELEMENT_TO_POSITION: Record<string, number> = {
  'fire': 0,    // Aries
  'earth': 1,   // Taurus
  'air': 2,     // Gemini
  'water': 3    // Cancer
}

// ============================================================================
// DREAM FORGE ENGINE
// ============================================================================

export class DreamForgeEngine extends EventEmitter {
  // Configuración
  private config: DreamForgeConfig
  
  // Estado
  private _status: 'idle' | 'dreaming' | 'analyzing' = 'idle'
  private currentDream: DreamScenario | null = null
  private dreamHistory: DreamHistory[] = []
  private dreamCounter = 0
  
  // Estadísticas
  private dreamsProcessed = 0
  private dreamsApproved = 0
  private dreamsAborted = 0
  private totalBeautyGain = 0
  
  // Cache de estados recientes para calcular novedad
  private recentStates: DreamState[] = []
  private readonly MAX_RECENT_STATES = 50
  
  constructor(config: Partial<DreamForgeConfig> = {}) {
    super()
    
    this.config = {
      minBeautyThreshold: 0.6,
      abortThreshold: 0.3,
      maxSimulationTimeMs: 50,
      generateAlternatives: true,
      maxAlternatives: 3,
      ...config
    }
    
    console.log('🔮 [DREAM-FORGE] Engine initialized - Selene can now dream')
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  /**
   * 🔮 SOÑAR UN ESCENARIO
   * Simula un cambio antes de ejecutarlo
   */
  dream(scenario: DreamScenario): DreamResult {
    const startTime = performance.now()
    this._status = 'dreaming'
    this.currentDream = scenario
    
    const dreamId = `dream_${++this.dreamCounter}_${Date.now()}`
    
    this.emit('dream-started', { dreamId, scenario })
    
    try {
      // 1. Calcular beauty del estado actual
      const currentBeauty = this.evaluateBeauty(scenario.currentState)
      
      // 2. Calcular beauty del estado propuesto
      const projectedBeauty = this.evaluateBeauty(scenario.proposedState)
      
      // 3. Calcular componentes detallados
      const components = this.calculateComponents(
        scenario.currentState,
        scenario.proposedState
      )
      
      // 4. Calcular delta
      const beautyDelta = projectedBeauty - currentBeauty
      
      // 5. Determinar recomendación
      const { recommendation, confidence, reasoning } = this.makeRecommendation(
        projectedBeauty,
        beautyDelta,
        components
      )
      
      // 6. Generar alternativas si es necesario
      let alternatives: DreamAlternative[] = []
      if (recommendation !== 'execute' && this.config.generateAlternatives) {
        this._status = 'analyzing'
        alternatives = this.generateAlternatives(scenario)
      }
      
      const simulationTime = performance.now() - startTime
      
      const result: DreamResult = {
        dreamId,
        scenario,
        currentBeautyScore: currentBeauty,
        projectedBeautyScore: projectedBeauty,
        beautyDelta,
        components,
        recommendation,
        confidence,
        reasoning,
        alternatives,
        simulationTimeMs: simulationTime,
        timestamp: Date.now()
      }
      
      // Actualizar estadísticas
      this.dreamsProcessed++
      if (recommendation === 'execute') {
        this.dreamsApproved++
        this.totalBeautyGain += beautyDelta
      } else if (recommendation === 'abort') {
        this.dreamsAborted++
      }
      
      // Guardar en historial
      this.dreamHistory.push({
        dream: result,
        wasExecuted: false
      })
      
      // Mantener historial limitado
      if (this.dreamHistory.length > 100) {
        this.dreamHistory.shift()
      }
      
      this._status = 'idle'
      this.currentDream = null
      
      this.emit('dream-completed', result)
      
      // Log para depuración
      const emoji = recommendation === 'execute' ? '✨' : 
                    recommendation === 'modify' ? '🔄' : '⛔'
      console.log(`🔮 [DREAM] ${emoji} ${scenario.type}: ${projectedBeauty.toFixed(2)} (${beautyDelta >= 0 ? '+' : ''}${beautyDelta.toFixed(2)}) - ${reasoning}`)
      
      return result
      
    } catch (error) {
      this._status = 'idle'
      this.currentDream = null
      throw error
    }
  }
  
  /**
   * 💫 SOÑAR MÚLTIPLES ESCENARIOS
   * Compara varios escenarios y retorna el mejor
   */
  dreamBest(scenarios: DreamScenario[]): DreamResult | null {
    if (scenarios.length === 0) return null
    
    const results = scenarios.map(s => this.dream(s))
    
    // Ordenar por projected beauty
    results.sort((a, b) => b.projectedBeautyScore - a.projectedBeautyScore)
    
    // Retornar el mejor si supera el threshold
    const best = results[0]
    if (best.projectedBeautyScore >= this.config.minBeautyThreshold) {
      return best
    }
    
    return null
  }
  
  /**
   * 🌙 SUEÑO RÁPIDO
   * Versión simplificada para decisiones rápidas
   */
  quickDream(
    type: DreamType,
    current: Partial<DreamState>,
    proposed: Partial<DreamState>
  ): { approve: boolean; score: number; reason: string } {
    const scenario: DreamScenario = {
      type,
      description: `Quick dream: ${type}`,
      parameters: {},
      currentState: current as DreamState,
      proposedState: proposed as DreamState
    }
    
    const result = this.dream(scenario)
    
    return {
      approve: result.recommendation === 'execute',
      score: result.projectedBeautyScore,
      reason: result.reasoning
    }
  }
  
  /**
   * 📊 REGISTRAR RESULTADO REAL
   * Después de ejecutar, registra el resultado real para aprendizaje
   */
  recordOutcome(dreamId: string, actualBeautyScore: number): void {
    const historyEntry = this.dreamHistory.find(h => h.dream.dreamId === dreamId)
    
    if (historyEntry) {
      historyEntry.wasExecuted = true
      historyEntry.actualOutcome = actualBeautyScore
      
      // Calcular precisión de la predicción
      const prediction = historyEntry.dream.projectedBeautyScore
      const error = Math.abs(prediction - actualBeautyScore)
      
      this.emit('outcome-recorded', {
        dreamId,
        predicted: prediction,
        actual: actualBeautyScore,
        error
      })
    }
  }
  
  /**
   * 📈 OBTENER ESTADO
   */
  getState(): DreamForgeState {
    return {
      status: this._status,
      currentDream: this.currentDream,
      dreamsProcessed: this.dreamsProcessed,
      dreamsApproved: this.dreamsApproved,
      dreamsAborted: this.dreamsAborted,
      averageBeautyGain: this.dreamsApproved > 0 
        ? this.totalBeautyGain / this.dreamsApproved 
        : 0,
      lastDreamTime: this.dreamHistory.length > 0
        ? this.dreamHistory[this.dreamHistory.length - 1].dream.timestamp
        : 0
    }
  }
  
  /** Getter para estado de sueño */
  get status(): 'idle' | 'dreaming' | 'analyzing' {
    return this._status
  }
  
  /**
   * 🔄 RESET
   */
  reset(): void {
    this._status = 'idle'
    this.currentDream = null
    this.dreamHistory = []
    this.dreamsProcessed = 0
    this.dreamsApproved = 0
    this.dreamsAborted = 0
    this.totalBeautyGain = 0
    this.recentStates = []
    console.log('🔮 [DREAM-FORGE] Reset complete')
  }
  
  /**
   * 📜 OBTENER HISTORIAL
   */
  getHistory(limit: number = 10): DreamResult[] {
    return this.dreamHistory
      .slice(-limit)
      .map(h => h.dream)
  }
  
  // ============================================================================
  // PRIVATE: EVALUACIÓN DE BELLEZA
  // ============================================================================
  
  /**
   * 🎨 EVALUAR BELLEZA DE UN ESTADO
   */
  private evaluateBeauty(state: DreamState): number {
    let totalScore = 0
    let weights = 0
    
    // 1. Evaluar armonía de intensidad (Fibonacci)
    if (state.intensity !== undefined) {
      const intensityBeauty = FibonacciPatternEngine.evaluateMathematicalBeauty(state.intensity)
      totalScore += intensityBeauty * 0.2
      weights += 0.2
    }
    
    // 2. Evaluar armonía musical si hay nota
    if (state.note) {
      const scale = NOTE_TO_SCALE[state.note] || 'major'
      const validation = MusicalHarmonyValidator.validateComplete(state.note, scale)
      totalScore += validation.harmony * 0.3
      weights += 0.3
    }
    
    // 3. Evaluar resonancia zodiacal si hay elemento
    if (state.element) {
      const position = ELEMENT_TO_POSITION[state.element] ?? 0
      const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(position, position)
      totalScore += affinity.affinity * 0.2
      weights += 0.2
    }
    
    // 4. Evaluar energía (si está en proporción áurea)
    if (state.energy !== undefined) {
      const energyBeauty = FibonacciPatternEngine.calculateGoldenHarmony(state.energy, 1 - state.energy)
      totalScore += energyBeauty * 0.15
      weights += 0.15
    }
    
    // 5. Bonus por coherencia interna
    const coherenceBonus = this.calculateCoherence(state) * 0.15
    totalScore += coherenceBonus
    weights += 0.15
    
    // Normalizar
    return weights > 0 ? totalScore / weights : 0.5
  }
  
  /**
   * 📊 CALCULAR COMPONENTES DETALLADOS
   */
  private calculateComponents(
    current: DreamState,
    proposed: DreamState
  ): DreamComponents {
    // Armonía musical
    let harmonicBeauty = 0.5
    if (proposed.note) {
      const scale = NOTE_TO_SCALE[proposed.note] || 'major'
      const validation = MusicalHarmonyValidator.validateComplete(proposed.note, scale)
      harmonicBeauty = validation.harmony
    }
    
    // Alineación Fibonacci
    const fibonacciAlignment = proposed.intensity !== undefined
      ? FibonacciPatternEngine.evaluateMathematicalBeauty(proposed.intensity)
      : 0.5
    
    // Resonancia zodiacal
    let zodiacResonance = 0.5
    if (proposed.element) {
      const position = ELEMENT_TO_POSITION[proposed.element] ?? 0
      const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(position, position)
      zodiacResonance = affinity.affinity
    }
    
    // Suavidad de transición
    const transitionSmoothness = this.calculateTransitionSmoothness(current, proposed)
    
    // Bonus de novedad
    const noveltyBonus = this.calculateNovelty(proposed)
    
    return {
      harmonicBeauty,
      fibonacciAlignment,
      zodiacResonance,
      transitionSmoothness,
      noveltyBonus
    }
  }
  
  /**
   * 🎯 HACER RECOMENDACIÓN
   */
  private makeRecommendation(
    projectedBeauty: number,
    beautyDelta: number,
    components: DreamComponents
  ): { recommendation: 'execute' | 'modify' | 'abort'; confidence: number; reasoning: string } {
    // Caso 1: Beauty muy alta - EJECUTAR
    if (projectedBeauty >= this.config.minBeautyThreshold && beautyDelta >= -0.1) {
      const confidence = Math.min(1, projectedBeauty + (beautyDelta * 0.5))
      return {
        recommendation: 'execute',
        confidence,
        reasoning: `Belleza proyectada alta (${(projectedBeauty * 100).toFixed(0)}%) con delta aceptable`
      }
    }
    
    // Caso 2: Beauty muy baja - ABORTAR
    if (projectedBeauty < this.config.abortThreshold) {
      return {
        recommendation: 'abort',
        confidence: 1 - projectedBeauty,
        reasoning: `Belleza proyectada demasiado baja (${(projectedBeauty * 100).toFixed(0)}%)`
      }
    }
    
    // Caso 3: Transición muy brusca - ABORTAR
    if (components.transitionSmoothness < 0.3) {
      return {
        recommendation: 'abort',
        confidence: 0.8,
        reasoning: `Transición demasiado brusca (suavidad: ${(components.transitionSmoothness * 100).toFixed(0)}%)`
      }
    }
    
    // Caso 4: Delta muy negativo - MODIFICAR
    if (beautyDelta < -0.2) {
      return {
        recommendation: 'modify',
        confidence: 0.7,
        reasoning: `El cambio reduce la belleza significativamente (${(beautyDelta * 100).toFixed(0)}%)`
      }
    }
    
    // Caso 5: Zona intermedia - MODIFICAR para mejorar
    return {
      recommendation: 'modify',
      confidence: 0.5,
      reasoning: `Belleza aceptable pero mejorable (${(projectedBeauty * 100).toFixed(0)}%)`
    }
  }
  
  /**
   * 🔄 GENERAR ALTERNATIVAS
   */
  private generateAlternatives(scenario: DreamScenario): DreamAlternative[] {
    const alternatives: DreamAlternative[] = []
    const { proposedState, currentState } = scenario
    
    // Alternativa 1: Reducir intensidad del cambio
    if (proposedState.intensity !== undefined && currentState.intensity !== undefined) {
      const midIntensity = (proposedState.intensity + currentState.intensity) / 2
      const modifiedState = { ...proposedState, intensity: midIntensity }
      const score = this.evaluateBeauty(modifiedState)
      
      alternatives.push({
        description: 'Intensidad moderada',
        modifiedParameters: { intensity: midIntensity },
        projectedBeautyScore: score
      })
    }
    
    // Alternativa 2: Mantener el mood actual
    if (proposedState.mood && currentState.mood) {
      const modifiedState = { ...proposedState, mood: currentState.mood }
      const score = this.evaluateBeauty(modifiedState)
      
      alternatives.push({
        description: 'Mantener mood actual',
        modifiedParameters: { mood: currentState.mood },
        projectedBeautyScore: score
      })
    }
    
    // Alternativa 3: Usar proporción áurea
    if (proposedState.intensity !== undefined) {
      const goldenIntensity = proposedState.intensity * FibonacciPatternEngine.PHI_INVERSE
      const modifiedState = { ...proposedState, intensity: Math.min(1, goldenIntensity) }
      const score = this.evaluateBeauty(modifiedState)
      
      alternatives.push({
        description: 'Intensidad en proporción áurea',
        modifiedParameters: { intensity: goldenIntensity },
        projectedBeautyScore: score
      })
    }
    
    // Ordenar por score y limitar
    return alternatives
      .sort((a, b) => b.projectedBeautyScore - a.projectedBeautyScore)
      .slice(0, this.config.maxAlternatives)
  }
  
  // ============================================================================
  // PRIVATE: UTILIDADES
  // ============================================================================
  
  /**
   * Calcular suavidad de transición entre estados
   */
  private calculateTransitionSmoothness(current: DreamState, proposed: DreamState): number {
    let differences = 0
    let totalChecks = 0
    
    // Diferencia de intensidad
    if (current.intensity !== undefined && proposed.intensity !== undefined) {
      differences += Math.abs(current.intensity - proposed.intensity)
      totalChecks++
    }
    
    // Cambio de paleta (binario)
    if (current.palette && proposed.palette) {
      differences += current.palette !== proposed.palette ? 0.5 : 0
      totalChecks++
    }
    
    // Cambio de mood (binario)
    if (current.mood && proposed.mood) {
      differences += current.mood !== proposed.mood ? 0.3 : 0
      totalChecks++
    }
    
    // Cambio de movimiento (binario)
    if (current.movement && proposed.movement) {
      differences += current.movement !== proposed.movement ? 0.4 : 0
      totalChecks++
    }
    
    if (totalChecks === 0) return 0.8  // Default si no hay datos
    
    // Invertir: menos diferencias = más suave
    return Math.max(0, 1 - (differences / totalChecks))
  }
  
  /**
   * Calcular novedad del estado propuesto
   */
  private calculateNovelty(state: DreamState): number {
    if (this.recentStates.length === 0) {
      this.recentStates.push(state)
      return 0.2  // Máximo bonus por ser primer estado
    }
    
    // Contar cuántas veces hemos visto estados similares
    let similarCount = 0
    for (const recent of this.recentStates) {
      if (this.statesAreSimilar(state, recent)) {
        similarCount++
      }
    }
    
    // Agregar estado actual a recientes
    this.recentStates.push(state)
    if (this.recentStates.length > this.MAX_RECENT_STATES) {
      this.recentStates.shift()
    }
    
    // Menos similar = más novedad
    const similarity = similarCount / this.recentStates.length
    return Math.max(0, 0.2 * (1 - similarity))
  }
  
  /**
   * Verificar si dos estados son similares
   */
  private statesAreSimilar(a: DreamState, b: DreamState): boolean {
    // Similar si comparten paleta y mood
    if (a.palette && b.palette && a.palette === b.palette) return true
    if (a.mood && b.mood && a.mood === b.mood) return true
    
    // Similar si intensidad está cerca
    if (a.intensity !== undefined && b.intensity !== undefined) {
      if (Math.abs(a.intensity - b.intensity) < 0.1) return true
    }
    
    return false
  }
  
  /**
   * Calcular coherencia interna de un estado
   */
  private calculateCoherence(state: DreamState): number {
    let coherenceScore = 0.5  // Base
    
    // Coherencia elemento-mood
    const elementMoodMap: Record<string, string[]> = {
      'fire': ['energetic', 'chaotic'],
      'water': ['peaceful', 'harmonious'],
      'air': ['harmonious', 'building'],
      'earth': ['peaceful', 'building']
    }
    
    if (state.element && state.mood) {
      const compatibleMoods = elementMoodMap[state.element] || []
      if (compatibleMoods.includes(state.mood)) {
        coherenceScore += 0.2
      }
    }
    
    // Coherencia intensidad-mood
    if (state.intensity !== undefined && state.mood) {
      const highEnergyMoods = ['energetic', 'chaotic']
      const lowEnergyMoods = ['peaceful', 'harmonious']
      
      if (state.intensity > 0.7 && highEnergyMoods.includes(state.mood)) {
        coherenceScore += 0.15
      } else if (state.intensity < 0.4 && lowEnergyMoods.includes(state.mood)) {
        coherenceScore += 0.15
      }
    }
    
    return Math.min(1, coherenceScore)
  }
}

// Factory
export function createDreamForgeEngine(config?: Partial<DreamForgeConfig>): DreamForgeEngine {
  return new DreamForgeEngine(config)
}
