/**
 * 🔍 SELF ANALYSIS ENGINE
 * El Monitor de Sesgos de Selene
 * 
 * Wave 7: Meta-Consciencia
 * 
 * Selene observa su propio comportamiento y detecta sesgos:
 * - "Llevo 10 minutos usando solo azul"
 * - "Mi intensidad promedio es muy baja"
 * - "Nunca uso el movimiento 'random'"
 * 
 * "Me observo a mí misma para ser mejor.
 *  Cada sesgo detectado es una oportunidad de crecer."
 *                              — Selene, Gen 1
 */

import { EventEmitter } from 'events'

// ============================================================================
// TYPES
// ============================================================================

/** Tipo de sesgo detectado */
export type BiasType = 
  | 'color_fixation'      // Usando mucho un color
  | 'intensity_skew'      // Intensidad siempre alta o baja
  | 'movement_neglect'    // Ignorando ciertos movimientos
  | 'palette_obsession'   // Repitiendo misma paleta
  | 'mood_stagnation'     // Mismo mood por mucho tiempo
  | 'effect_avoidance'    // Evitando ciertos efectos
  | 'tempo_mismatch'      // No sincronizando con el BPM
  | 'variety_deficit'     // Falta general de variedad

/** Sesgo detectado */
export interface DetectedBias {
  type: BiasType
  severity: 'low' | 'medium' | 'high'
  description: string
  metric: string
  currentValue: number
  expectedRange: [number, number]
  detectedAt: number
  duration: number  // Cuánto tiempo lleva el sesgo
  suggestion: string
}

/** Histograma de uso */
export interface UsageHistogram {
  category: string
  bins: Map<string, number>
  totalSamples: number
  lastUpdated: number
}

/** Estadísticas de sesión */
export interface SessionStats {
  startTime: number
  duration: number
  framesProcessed: number
  strikesExecuted: number
  palettesUsed: Set<string>
  movementsUsed: Set<string>
  effectsUsed: Set<string>
  averageIntensity: number
  averageBeauty: number
  biasesDetected: number
  correctionsApplied: number
}

/** Corrección automática */
export interface AutoCorrection {
  biasType: BiasType
  correction: string
  parameters: Record<string, unknown>
  timestamp: number
  applied: boolean
}

/** Estado del análisis */
export interface SelfAnalysisState {
  status: 'idle' | 'analyzing' | 'correcting'
  activebiases: DetectedBias[]
  sessionStats: SessionStats
  lastAnalysisTime: number
  healthScore: number  // 0-1, qué tan "saludable" es el comportamiento
}

/** Configuración del Self Analysis */
export interface SelfAnalysisConfig {
  analysisIntervalMs: number    // Cada cuánto analizar (default: 30000 = 30s)
  biasThresholdLow: number      // Umbral para sesgo leve (default: 0.6)
  biasThresholdHigh: number     // Umbral para sesgo severo (default: 0.8)
  autoCorrectEnabled: boolean   // Auto-corregir sesgos (default: true)
  historyWindowMs: number       // Ventana de historial (default: 300000 = 5min)
  minSamplesForAnalysis: number // Muestras mínimas (default: 50)
}

/** Muestra de comportamiento */
interface BehaviorSample {
  timestamp: number
  palette: string
  intensity: number
  movement: string
  effects: string[]
  mood: string
  beauty: number
  note?: string
  element?: string
}

// ============================================================================
// CONSTANTES
// ============================================================================

/** Paletas esperadas (para detectar si faltan) */
const EXPECTED_PALETTES = ['fuego', 'hielo', 'selva', 'neon', 'sunset', 'ocean', 'galaxy']

/** Movimientos esperados */
const EXPECTED_MOVEMENTS = ['circle', 'lissajous', 'wave', 'random', 'linear', 'spiral']

/** Efectos esperados */
const EXPECTED_EFFECTS = ['strobe', 'pulse', 'chase', 'fade', 'breathe', 'rainbow']

/** Moods esperados */
const EXPECTED_MOODS = ['energetic', 'peaceful', 'chaotic', 'harmonious', 'building']

// ============================================================================
// SELF ANALYSIS ENGINE
// ============================================================================

export class SelfAnalysisEngine extends EventEmitter {
  // Configuración
  private config: SelfAnalysisConfig
  
  // Estado
  private _status: 'idle' | 'analyzing' | 'correcting' = 'idle'
  private behaviorHistory: BehaviorSample[] = []
  private activebiases: DetectedBias[] = []
  private corrections: AutoCorrection[] = []
  
  // Histogramas de uso
  private paletteHistogram: Map<string, number> = new Map()
  private movementHistogram: Map<string, number> = new Map()
  private effectHistogram: Map<string, number> = new Map()
  private moodHistogram: Map<string, number> = new Map()
  private intensityBuckets: number[] = [0, 0, 0, 0, 0]  // 0-0.2, 0.2-0.4, ...
  
  // Estadísticas de sesión
  private sessionStart: number = Date.now()
  private framesProcessed = 0
  private strikesExecuted = 0
  private totalIntensity = 0
  private totalBeauty = 0
  private biasesDetected = 0
  private correctionsApplied = 0
  
  // Timer de análisis
  private analysisInterval: ReturnType<typeof setInterval> | null = null
  
  constructor(config: Partial<SelfAnalysisConfig> = {}) {
    super()
    
    this.config = {
      analysisIntervalMs: 30000,      // 30 segundos
      biasThresholdLow: 0.6,
      biasThresholdHigh: 0.8,
      autoCorrectEnabled: true,
      historyWindowMs: 300000,        // 5 minutos
      minSamplesForAnalysis: 50,
      ...config
    }
    
    // Inicializar histogramas
    this.initializeHistograms()
    
    console.log('🔍 [SELF-ANALYSIS] Engine initialized - Selene can now introspect')
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  /**
   * 🎯 INICIAR ANÁLISIS PERIÓDICO
   */
  startPeriodicAnalysis(): void {
    if (this.analysisInterval) return
    
    this.analysisInterval = setInterval(() => {
      this.runAnalysis()
    }, this.config.analysisIntervalMs)
    
    console.log(`🔍 [SELF-ANALYSIS] Periodic analysis started (every ${this.config.analysisIntervalMs / 1000}s)`)
  }
  
  /**
   * ⏹️ DETENER ANÁLISIS PERIÓDICO
   */
  stopPeriodicAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
      this.analysisInterval = null
      console.log('🔍 [SELF-ANALYSIS] Periodic analysis stopped')
    }
  }
  
  /**
   * 📝 REGISTRAR COMPORTAMIENTO
   * Llamar en cada frame o decisión importante
   */
  recordBehavior(sample: Omit<BehaviorSample, 'timestamp'>): void {
    const fullSample: BehaviorSample = {
      ...sample,
      timestamp: Date.now()
    }
    
    // Agregar a historial
    this.behaviorHistory.push(fullSample)
    
    // Limpiar historial antiguo
    const cutoff = Date.now() - this.config.historyWindowMs
    this.behaviorHistory = this.behaviorHistory.filter(s => s.timestamp > cutoff)
    
    // Actualizar histogramas
    this.updateHistograms(fullSample)
    
    // Actualizar estadísticas
    this.framesProcessed++
    this.totalIntensity += sample.intensity
    this.totalBeauty += sample.beauty
  }
  
  /**
   * 📊 REGISTRAR STRIKE
   */
  recordStrike(): void {
    this.strikesExecuted++
  }
  
  /**
   * 🔍 EJECUTAR ANÁLISIS MANUAL
   */
  runAnalysis(): DetectedBias[] {
    if (this.behaviorHistory.length < this.config.minSamplesForAnalysis) {
      return []  // No hay suficientes datos
    }
    
    this._status = 'analyzing'
    this.emit('analysis-started')
    
    const detectedBiases: DetectedBias[] = []
    
    // 1. Analizar sesgos de color/paleta
    const paletteBias = this.analyzePaletteBias()
    if (paletteBias) detectedBiases.push(paletteBias)
    
    // 2. Analizar sesgos de intensidad
    const intensityBias = this.analyzeIntensityBias()
    if (intensityBias) detectedBiases.push(intensityBias)
    
    // 3. Analizar sesgos de movimiento
    const movementBias = this.analyzeMovementBias()
    if (movementBias) detectedBiases.push(movementBias)
    
    // 4. Analizar sesgos de mood
    const moodBias = this.analyzeMoodBias()
    if (moodBias) detectedBiases.push(moodBias)
    
    // 5. Analizar variedad general
    const varietyBias = this.analyzeVarietyBias()
    if (varietyBias) detectedBiases.push(varietyBias)
    
    // Actualizar estado
    this.activebiases = detectedBiases
    this.biasesDetected += detectedBiases.length
    
    // Auto-corregir si está habilitado
    if (this.config.autoCorrectEnabled && detectedBiases.length > 0) {
      this._status = 'correcting'
      const corrections = this.generateCorrections(detectedBiases)
      this.corrections.push(...corrections)
      this.correctionsApplied += corrections.filter(c => c.applied).length
    }
    
    this._status = 'idle'
    
    // Emitir evento
    if (detectedBiases.length > 0) {
      this.emit('biases-detected', detectedBiases)
      
      // Log
      for (const bias of detectedBiases) {
        const emoji = bias.severity === 'high' ? '🚨' : bias.severity === 'medium' ? '⚠️' : '📝'
        console.log(`🔍 [BIAS] ${emoji} ${bias.type}: ${bias.description}`)
      }
    }
    
    this.emit('analysis-completed', {
      biasesFound: detectedBiases.length,
      healthScore: this.calculateHealthScore()
    })
    
    return detectedBiases
  }
  
  /**
   * 📈 OBTENER ESTADO
   */
  getState(): SelfAnalysisState {
    return {
      status: this._status,
      activebiases: [...this.activebiases],
      sessionStats: this.getSessionStats(),
      lastAnalysisTime: this.behaviorHistory.length > 0 
        ? this.behaviorHistory[this.behaviorHistory.length - 1].timestamp 
        : 0,
      healthScore: this.calculateHealthScore()
    }
  }
  
  /**
   * 📊 OBTENER ESTADÍSTICAS DE SESIÓN
   */
  getSessionStats(): SessionStats {
    return {
      startTime: this.sessionStart,
      duration: Date.now() - this.sessionStart,
      framesProcessed: this.framesProcessed,
      strikesExecuted: this.strikesExecuted,
      palettesUsed: new Set(this.paletteHistogram.keys()),
      movementsUsed: new Set(this.movementHistogram.keys()),
      effectsUsed: new Set(this.effectHistogram.keys()),
      averageIntensity: this.framesProcessed > 0 
        ? this.totalIntensity / this.framesProcessed 
        : 0,
      averageBeauty: this.framesProcessed > 0 
        ? this.totalBeauty / this.framesProcessed 
        : 0,
      biasesDetected: this.biasesDetected,
      correctionsApplied: this.correctionsApplied
    }
  }
  
  /**
   * 📊 OBTENER HISTOGRAMAS
   */
  getHistograms(): {
    palettes: Record<string, number>
    movements: Record<string, number>
    effects: Record<string, number>
    moods: Record<string, number>
    intensity: number[]
  } {
    return {
      palettes: Object.fromEntries(this.paletteHistogram),
      movements: Object.fromEntries(this.movementHistogram),
      effects: Object.fromEntries(this.effectHistogram),
      moods: Object.fromEntries(this.moodHistogram),
      intensity: [...this.intensityBuckets]
    }
  }
  
  /**
   * 🎯 OBTENER SUGERENCIA DE CORRECCIÓN
   * Retorna qué debería hacer diferente Selene
   */
  getSuggestion(): string | null {
    if (this.activebiases.length === 0) return null
    
    // Priorizar por severidad
    const sorted = [...this.activebiases].sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    
    return sorted[0].suggestion
  }
  
  /**
   * 🔄 RESET
   */
  reset(): void {
    this.stopPeriodicAnalysis()
    this._status = 'idle'
    this.behaviorHistory = []
    this.activebiases = []
    this.corrections = []
    this.initializeHistograms()
    this.sessionStart = Date.now()
    this.framesProcessed = 0
    this.strikesExecuted = 0
    this.totalIntensity = 0
    this.totalBeauty = 0
    this.biasesDetected = 0
    this.correctionsApplied = 0
    console.log('🔍 [SELF-ANALYSIS] Reset complete')
  }
  
  /** Getter para status */
  get status(): 'idle' | 'analyzing' | 'correcting' {
    return this._status
  }
  
  // ============================================================================
  // PRIVATE: INICIALIZACIÓN
  // ============================================================================
  
  private initializeHistograms(): void {
    this.paletteHistogram = new Map()
    this.movementHistogram = new Map()
    this.effectHistogram = new Map()
    this.moodHistogram = new Map()
    this.intensityBuckets = [0, 0, 0, 0, 0]
    
    // Pre-poblar con valores esperados (count 0)
    for (const p of EXPECTED_PALETTES) this.paletteHistogram.set(p, 0)
    for (const m of EXPECTED_MOVEMENTS) this.movementHistogram.set(m, 0)
    for (const e of EXPECTED_EFFECTS) this.effectHistogram.set(e, 0)
    for (const mood of EXPECTED_MOODS) this.moodHistogram.set(mood, 0)
  }
  
  // ============================================================================
  // PRIVATE: ACTUALIZACIÓN DE HISTOGRAMAS
  // ============================================================================
  
  private updateHistograms(sample: BehaviorSample): void {
    // Paleta
    const paletteCount = this.paletteHistogram.get(sample.palette) || 0
    this.paletteHistogram.set(sample.palette, paletteCount + 1)
    
    // Movimiento
    const movementCount = this.movementHistogram.get(sample.movement) || 0
    this.movementHistogram.set(sample.movement, movementCount + 1)
    
    // Efectos
    for (const effect of sample.effects) {
      const effectCount = this.effectHistogram.get(effect) || 0
      this.effectHistogram.set(effect, effectCount + 1)
    }
    
    // Mood
    const moodCount = this.moodHistogram.get(sample.mood) || 0
    this.moodHistogram.set(sample.mood, moodCount + 1)
    
    // Intensidad (buckets)
    const bucket = Math.min(4, Math.floor(sample.intensity * 5))
    this.intensityBuckets[bucket]++
  }
  
  // ============================================================================
  // PRIVATE: ANÁLISIS DE SESGOS
  // ============================================================================
  
  /**
   * Analizar sesgo de paleta/color
   */
  private analyzePaletteBias(): DetectedBias | null {
    const total = Array.from(this.paletteHistogram.values()).reduce((a, b) => a + b, 0)
    if (total < this.config.minSamplesForAnalysis) return null
    
    // Encontrar paleta dominante
    let maxPalette = ''
    let maxCount = 0
    for (const [palette, count] of this.paletteHistogram) {
      if (count > maxCount) {
        maxCount = count
        maxPalette = palette
      }
    }
    
    const dominance = maxCount / total
    
    if (dominance >= this.config.biasThresholdHigh) {
      return {
        type: 'palette_obsession',
        severity: 'high',
        description: `Usando ${maxPalette} el ${(dominance * 100).toFixed(0)}% del tiempo`,
        metric: 'palette_dominance',
        currentValue: dominance,
        expectedRange: [0.1, 0.4],
        detectedAt: Date.now(),
        duration: this.estimateBiasDuration('palette', maxPalette),
        suggestion: `Considera usar paletas como ${this.getSuggestedAlternatives('palette', maxPalette)}`
      }
    } else if (dominance >= this.config.biasThresholdLow) {
      return {
        type: 'color_fixation',
        severity: 'medium',
        description: `Tendencia hacia ${maxPalette} (${(dominance * 100).toFixed(0)}%)`,
        metric: 'palette_dominance',
        currentValue: dominance,
        expectedRange: [0.1, 0.4],
        detectedAt: Date.now(),
        duration: this.estimateBiasDuration('palette', maxPalette),
        suggestion: `Intenta variar más las paletas`
      }
    }
    
    return null
  }
  
  /**
   * Analizar sesgo de intensidad
   */
  private analyzeIntensityBias(): DetectedBias | null {
    const total = this.intensityBuckets.reduce((a, b) => a + b, 0)
    if (total < this.config.minSamplesForAnalysis) return null
    
    // Verificar si la intensidad está muy sesgada hacia un extremo
    const lowIntensity = (this.intensityBuckets[0] + this.intensityBuckets[1]) / total
    const highIntensity = (this.intensityBuckets[3] + this.intensityBuckets[4]) / total
    
    if (lowIntensity >= this.config.biasThresholdHigh) {
      return {
        type: 'intensity_skew',
        severity: 'high',
        description: `Intensidad muy baja el ${(lowIntensity * 100).toFixed(0)}% del tiempo`,
        metric: 'low_intensity_ratio',
        currentValue: lowIntensity,
        expectedRange: [0.2, 0.4],
        detectedAt: Date.now(),
        duration: 0,
        suggestion: `Aumenta la intensidad, especialmente en momentos de alta energía`
      }
    } else if (highIntensity >= this.config.biasThresholdHigh) {
      return {
        type: 'intensity_skew',
        severity: 'high',
        description: `Intensidad muy alta el ${(highIntensity * 100).toFixed(0)}% del tiempo`,
        metric: 'high_intensity_ratio',
        currentValue: highIntensity,
        expectedRange: [0.2, 0.4],
        detectedAt: Date.now(),
        duration: 0,
        suggestion: `Reduce la intensidad en momentos tranquilos para crear contraste`
      }
    }
    
    return null
  }
  
  /**
   * Analizar sesgo de movimiento
   */
  private analyzeMovementBias(): DetectedBias | null {
    const total = Array.from(this.movementHistogram.values()).reduce((a, b) => a + b, 0)
    if (total < this.config.minSamplesForAnalysis) return null
    
    // Verificar movimientos nunca usados
    const unusedMovements = EXPECTED_MOVEMENTS.filter(m => 
      (this.movementHistogram.get(m) || 0) === 0
    )
    
    if (unusedMovements.length >= 3) {
      return {
        type: 'movement_neglect',
        severity: 'medium',
        description: `Nunca usas: ${unusedMovements.join(', ')}`,
        metric: 'unused_movements',
        currentValue: unusedMovements.length,
        expectedRange: [0, 1],
        detectedAt: Date.now(),
        duration: 0,
        suggestion: `Prueba usar el movimiento '${unusedMovements[0]}' para variar`
      }
    }
    
    return null
  }
  
  /**
   * Analizar sesgo de mood
   */
  private analyzeMoodBias(): DetectedBias | null {
    const total = Array.from(this.moodHistogram.values()).reduce((a, b) => a + b, 0)
    if (total < this.config.minSamplesForAnalysis) return null
    
    // Encontrar mood dominante
    let maxMood = ''
    let maxCount = 0
    for (const [mood, count] of this.moodHistogram) {
      if (count > maxCount) {
        maxCount = count
        maxMood = mood
      }
    }
    
    const dominance = maxCount / total
    
    if (dominance >= this.config.biasThresholdHigh) {
      return {
        type: 'mood_stagnation',
        severity: 'high',
        description: `Estancada en mood '${maxMood}' (${(dominance * 100).toFixed(0)}%)`,
        metric: 'mood_dominance',
        currentValue: dominance,
        expectedRange: [0.1, 0.4],
        detectedAt: Date.now(),
        duration: this.estimateBiasDuration('mood', maxMood),
        suggestion: `Permite más transiciones de mood según la música`
      }
    }
    
    return null
  }
  
  /**
   * Analizar variedad general
   */
  private analyzeVarietyBias(): DetectedBias | null {
    const palettesUsed = Array.from(this.paletteHistogram.values()).filter(v => v > 0).length
    const movementsUsed = Array.from(this.movementHistogram.values()).filter(v => v > 0).length
    const effectsUsed = Array.from(this.effectHistogram.values()).filter(v => v > 0).length
    
    const varietyScore = (
      (palettesUsed / EXPECTED_PALETTES.length) +
      (movementsUsed / EXPECTED_MOVEMENTS.length) +
      (effectsUsed / EXPECTED_EFFECTS.length)
    ) / 3
    
    if (varietyScore < 0.3) {
      return {
        type: 'variety_deficit',
        severity: 'high',
        description: `Variedad general muy baja (${(varietyScore * 100).toFixed(0)}%)`,
        metric: 'variety_score',
        currentValue: varietyScore,
        expectedRange: [0.5, 1.0],
        detectedAt: Date.now(),
        duration: 0,
        suggestion: `Explora más opciones: ${EXPECTED_PALETTES.length - palettesUsed} paletas, ${EXPECTED_MOVEMENTS.length - movementsUsed} movimientos sin usar`
      }
    } else if (varietyScore < 0.5) {
      return {
        type: 'variety_deficit',
        severity: 'low',
        description: `Variedad moderada (${(varietyScore * 100).toFixed(0)}%)`,
        metric: 'variety_score',
        currentValue: varietyScore,
        expectedRange: [0.5, 1.0],
        detectedAt: Date.now(),
        duration: 0,
        suggestion: `Podrías explorar más opciones disponibles`
      }
    }
    
    return null
  }
  
  // ============================================================================
  // PRIVATE: CORRECCIONES
  // ============================================================================
  
  /**
   * Generar correcciones para los sesgos detectados
   */
  private generateCorrections(biases: DetectedBias[]): AutoCorrection[] {
    const corrections: AutoCorrection[] = []
    
    for (const bias of biases) {
      const correction: AutoCorrection = {
        biasType: bias.type,
        correction: bias.suggestion,
        parameters: {},
        timestamp: Date.now(),
        applied: false
      }
      
      // Generar parámetros específicos según el tipo de sesgo
      switch (bias.type) {
        case 'palette_obsession':
        case 'color_fixation':
          correction.parameters = {
            suggestedPalettes: this.getLeastUsedPalettes(3),
            avoidPalette: this.getMostUsedPalette()
          }
          break
          
        case 'intensity_skew':
          correction.parameters = {
            targetIntensityRange: bias.currentValue > 0.5 
              ? [0.3, 0.6]  // Reducir
              : [0.5, 0.8]  // Aumentar
          }
          break
          
        case 'movement_neglect':
          correction.parameters = {
            suggestedMovements: EXPECTED_MOVEMENTS.filter(m => 
              (this.movementHistogram.get(m) || 0) === 0
            ).slice(0, 2)
          }
          break
          
        case 'mood_stagnation':
          correction.parameters = {
            suggestedMoods: EXPECTED_MOODS.filter(m => 
              m !== this.getMostUsedMood()
            )
          }
          break
          
        case 'variety_deficit':
          correction.parameters = {
            unusedPalettes: this.getLeastUsedPalettes(3),
            unusedMovements: EXPECTED_MOVEMENTS.filter(m => 
              (this.movementHistogram.get(m) || 0) === 0
            )
          }
          break
      }
      
      // Marcar como aplicada si auto-correct está habilitado
      correction.applied = this.config.autoCorrectEnabled
      
      corrections.push(correction)
    }
    
    // Emitir correcciones
    if (corrections.length > 0) {
      this.emit('corrections-generated', corrections)
    }
    
    return corrections
  }
  
  // ============================================================================
  // PRIVATE: UTILIDADES
  // ============================================================================
  
  /**
   * Calcular score de "salud" del comportamiento
   */
  private calculateHealthScore(): number {
    if (this.framesProcessed < this.config.minSamplesForAnalysis) {
      return 1.0  // Sin datos suficientes, asumir saludable
    }
    
    // Penalizar por sesgos activos
    let score = 1.0
    for (const bias of this.activebiases) {
      switch (bias.severity) {
        case 'high': score -= 0.3; break
        case 'medium': score -= 0.15; break
        case 'low': score -= 0.05; break
      }
    }
    
    // Bonus por variedad
    const palettesUsed = Array.from(this.paletteHistogram.values()).filter(v => v > 0).length
    const varietyBonus = (palettesUsed / EXPECTED_PALETTES.length) * 0.1
    score += varietyBonus
    
    return Math.max(0, Math.min(1, score))
  }
  
  /**
   * Estimar duración de un sesgo
   */
  private estimateBiasDuration(category: string, value: string): number {
    // Buscar desde cuándo está dominando este valor
    let firstDominant = Date.now()
    
    for (let i = this.behaviorHistory.length - 1; i >= 0; i--) {
      const sample = this.behaviorHistory[i]
      let sampleValue = ''
      
      switch (category) {
        case 'palette': sampleValue = sample.palette; break
        case 'mood': sampleValue = sample.mood; break
        case 'movement': sampleValue = sample.movement; break
      }
      
      if (sampleValue === value) {
        firstDominant = sample.timestamp
      } else {
        break  // Ya no es dominante
      }
    }
    
    return Date.now() - firstDominant
  }
  
  /**
   * Obtener alternativas sugeridas
   */
  private getSuggestedAlternatives(category: string, current: string): string {
    let alternatives: string[] = []
    
    switch (category) {
      case 'palette':
        alternatives = EXPECTED_PALETTES.filter(p => p !== current).slice(0, 3)
        break
      case 'movement':
        alternatives = EXPECTED_MOVEMENTS.filter(m => m !== current).slice(0, 2)
        break
      case 'mood':
        alternatives = EXPECTED_MOODS.filter(m => m !== current).slice(0, 2)
        break
    }
    
    return alternatives.join(', ')
  }
  
  /**
   * Obtener paletas menos usadas
   */
  private getLeastUsedPalettes(count: number): string[] {
    const sorted = Array.from(this.paletteHistogram.entries())
      .sort((a, b) => a[1] - b[1])
    
    return sorted.slice(0, count).map(([palette]) => palette)
  }
  
  /**
   * Obtener paleta más usada
   */
  private getMostUsedPalette(): string {
    let max = ''
    let maxCount = 0
    for (const [palette, count] of this.paletteHistogram) {
      if (count > maxCount) {
        maxCount = count
        max = palette
      }
    }
    return max
  }
  
  /**
   * Obtener mood más usado
   */
  private getMostUsedMood(): string {
    let max = ''
    let maxCount = 0
    for (const [mood, count] of this.moodHistogram) {
      if (count > maxCount) {
        maxCount = count
        max = mood
      }
    }
    return max
  }
}

// Factory
export function createSelfAnalysisEngine(config?: Partial<SelfAnalysisConfig>): SelfAnalysisEngine {
  return new SelfAnalysisEngine(config)
}
