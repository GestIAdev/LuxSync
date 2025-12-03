/**
 * 🎯 PRECISION JUMP ENGINE
 * "El momento perfecto no es fijo - es adaptativo"
 *
 * WAVE 5: THE HUNT - Capa de Cognición
 * 
 * CAPACIDADES:
 * - Ajusta window size para insights (5-50 observaciones)
 * - Ventana pequeña (5-10) en alta volatilidad → reacción rápida
 * - Ventana grande (30-50) en estabilidad → análisis profundo
 * 
 * FILOSOFÍA FELINA:
 * Un gato en un ambiente caótico está alerta, reactivo.
 * Un gato en un ambiente tranquilo observa con paciencia infinita.
 * La adaptación es supervivencia.
 */

// ============================================
// 🎯 INTERFACES
// ============================================

/**
 * Volatilidad del sistema medida
 */
export interface SystemVolatility {
  beautyVariance: number        // Varianza en scores de belleza
  convergenceVariance: number   // Varianza en tiempos de convergencia
  patternSwitchRate: number     // Tasa de cambio de patrones (0-1)
  energyVariance: number        // Varianza en energía
  overallVolatility: VolatilityLevel
}

export type VolatilityLevel = 'low' | 'medium' | 'high' | 'extreme'

/**
 * Configuración de ventanas adaptativas
 */
export interface WindowConfig {
  minWindow: number       // Ventana mínima (alta volatilidad)
  maxWindow: number       // Ventana máxima (baja volatilidad)
  defaultWindow: number   // Ventana por defecto
  extremeWindow: number   // Ventana para volatilidad extrema
}

/**
 * Patrón para análisis de volatilidad
 */
export interface VolatilityPattern {
  beauty: number
  convergenceTime: number
  note: string
  energy: number
  timestamp: number
}

/**
 * Recomendación de timing
 */
export interface TimingRecommendation {
  nextInsightAt: number         // Experiencia en la que evaluar
  windowSize: number            // Tamaño de ventana actual
  reasoning: string             // Explicación
  urgency: 'low' | 'medium' | 'high'
  adaptiveSpeed: number         // 0-1 (qué tan rápido adaptar)
}

/**
 * Estadísticas de volatilidad
 */
export interface VolatilityStats {
  volatilityLevel: string
  beautyStability: 'LOW' | 'MEDIUM' | 'HIGH'
  timeStability: 'LOW' | 'MEDIUM' | 'HIGH'
  patternStability: 'LOW' | 'MEDIUM' | 'HIGH'
  energyStability: 'LOW' | 'MEDIUM' | 'HIGH'
  recommendedWindow: number
  adaptiveMultiplier: number
}

// ============================================
// 🎯 PRECISION JUMP ENGINE
// ============================================

export class PrecisionJumpEngine {
  // === Configuración de ventanas ===
  private windowConfig: WindowConfig = {
    minWindow: 5,        // Mínimo para volatilidad extrema
    maxWindow: 50,       // Máximo para estabilidad total
    defaultWindow: 20,   // Default para volatilidad media
    extremeWindow: 3     // Ultra-reactivo
  }
  
  // === Estado interno ===
  private patternHistory: VolatilityPattern[] = []
  private maxHistorySize = 100
  private currentVolatility: SystemVolatility | null = null
  private currentWindow: number
  private lastInsightAt = 0
  private insightCount = 0
  
  // === Thresholds ===
  private readonly thresholds = {
    beautyVariance: {
      low: 0.005,
      medium: 0.01,
      high: 0.02
    },
    convergenceVariance: {
      low: 500000,    // 0.5s
      medium: 1000000, // 1s
      high: 2000000   // 2s
    },
    switchRate: {
      low: 0.3,
      medium: 0.5,
      high: 0.7
    },
    energyVariance: {
      low: 0.01,
      medium: 0.03,
      high: 0.05
    }
  }
  
  constructor(config?: Partial<WindowConfig>) {
    if (config) {
      this.windowConfig = { ...this.windowConfig, ...config }
    }
    this.currentWindow = this.windowConfig.defaultWindow
    console.log('🎯 [PRECISION] Engine initialized')
  }
  
  // ============================================
  // 📊 CALCULAR VOLATILIDAD
  // ============================================
  
  /**
   * Calcular volatilidad del sistema basado en patrones recientes
   */
  calculateVolatility(recentPatterns?: VolatilityPattern[]): SystemVolatility {
    // Usar patrones proporcionados o historial interno
    const patterns = recentPatterns ?? this.patternHistory.slice(-20)
    
    if (patterns.length < 5) {
      return {
        beautyVariance: 0,
        convergenceVariance: 0,
        patternSwitchRate: 0,
        energyVariance: 0,
        overallVolatility: 'medium'
      }
    }
    
    // 1. Varianza de beauty scores
    const beautyScores = patterns.map(p => p.beauty)
    const avgBeauty = this.average(beautyScores)
    const beautyVariance = this.variance(beautyScores, avgBeauty)
    
    // 2. Varianza de convergence times
    const times = patterns.map(p => p.convergenceTime)
    const avgTime = this.average(times)
    const convergenceVariance = this.variance(times, avgTime)
    
    // 3. Tasa de cambio de patterns
    let switches = 0
    for (let i = 1; i < patterns.length; i++) {
      if (patterns[i].note !== patterns[i - 1].note) {
        switches++
      }
    }
    const patternSwitchRate = switches / (patterns.length - 1)
    
    // 4. Varianza de energía
    const energies = patterns.map(p => p.energy)
    const avgEnergy = this.average(energies)
    const energyVariance = this.variance(energies, avgEnergy)
    
    // 5. Clasificar volatilidad overall
    const overallVolatility = this.classifyVolatility(
      beautyVariance, 
      convergenceVariance, 
      patternSwitchRate,
      energyVariance
    )
    
    const volatility: SystemVolatility = {
      beautyVariance,
      convergenceVariance,
      patternSwitchRate,
      energyVariance,
      overallVolatility
    }
    
    // Guardar para uso posterior
    this.currentVolatility = volatility
    
    return volatility
  }
  
  /**
   * Clasificar nivel de volatilidad
   */
  private classifyVolatility(
    beautyVar: number,
    convVar: number,
    switchRate: number,
    energyVar: number
  ): VolatilityLevel {
    const th = this.thresholds
    
    // Contar factores volátiles
    let volatileFactors = 0
    let extremeFactors = 0
    
    // Beauty
    if (beautyVar > th.beautyVariance.high) { volatileFactors++; extremeFactors++ }
    else if (beautyVar > th.beautyVariance.medium) volatileFactors++
    
    // Convergence
    if (convVar > th.convergenceVariance.high) { volatileFactors++; extremeFactors++ }
    else if (convVar > th.convergenceVariance.medium) volatileFactors++
    
    // Switch rate
    if (switchRate > th.switchRate.high) { volatileFactors++; extremeFactors++ }
    else if (switchRate > th.switchRate.medium) volatileFactors++
    
    // Energy
    if (energyVar > th.energyVariance.high) { volatileFactors++; extremeFactors++ }
    else if (energyVar > th.energyVariance.medium) volatileFactors++
    
    // Clasificar
    if (extremeFactors >= 3) return 'extreme'
    if (volatileFactors >= 3) return 'high'
    if (volatileFactors >= 1) return 'medium'
    return 'low'
  }
  
  // ============================================
  // 🎯 CALCULAR VENTANA ÓPTIMA
  // ============================================
  
  /**
   * Calcular tamaño de ventana óptima según volatilidad
   */
  calculateOptimalWindow(volatility?: SystemVolatility): number {
    const vol = volatility ?? this.currentVolatility ?? this.calculateVolatility()
    
    let window: number
    
    switch (vol.overallVolatility) {
      case 'extreme':
        // Ultra-reactivo - ventana mínima
        window = this.windowConfig.extremeWindow
        break
        
      case 'high':
        // Alta volatilidad - ventana pequeña para reacción rápida
        window = this.windowConfig.minWindow
        break
        
      case 'medium':
        // Volatilidad media - ventana default
        window = this.windowConfig.defaultWindow
        break
        
      case 'low':
        // Baja volatilidad - ventana grande para análisis profundo
        window = this.windowConfig.maxWindow
        break
    }
    
    // Actualizar ventana actual
    this.currentWindow = window
    
    return window
  }
  
  // ============================================
  // ⏰ RECOMENDACIONES DE TIMING
  // ============================================
  
  /**
   * Recomendar próximo momento para insight/evaluación
   */
  recommendInsightTiming(currentExperience: number): TimingRecommendation {
    const volatility = this.currentVolatility ?? this.calculateVolatility()
    const window = this.calculateOptimalWindow(volatility)
    
    // Calcular próximo insight
    const nextInsightAt = Math.ceil(currentExperience / window) * window
    
    // Determinar urgencia
    let urgency: 'low' | 'medium' | 'high'
    let adaptiveSpeed: number
    
    switch (volatility.overallVolatility) {
      case 'extreme':
        urgency = 'high'
        adaptiveSpeed = 1.0
        break
      case 'high':
        urgency = 'high'
        adaptiveSpeed = 0.8
        break
      case 'medium':
        urgency = 'medium'
        adaptiveSpeed = 0.5
        break
      case 'low':
        urgency = 'low'
        adaptiveSpeed = 0.2
        break
    }
    
    // Generar reasoning
    const reasoning = this.generateTimingReasoning(volatility, window)
    
    return {
      nextInsightAt,
      windowSize: window,
      reasoning,
      urgency,
      adaptiveSpeed
    }
  }
  
  /**
   * Generar explicación del timing
   */
  private generateTimingReasoning(volatility: SystemVolatility, window: number): string {
    switch (volatility.overallVolatility) {
      case 'extreme':
        return `⚠️ EXTREME volatility - ultra-reactive mode (every ${window} exp)`
      case 'high':
        return `🔥 High volatility - frequent insights (every ${window} exp)`
      case 'medium':
        return `⚖️ Medium volatility - balanced analysis (every ${window} exp)`
      case 'low':
        return `🧘 Low volatility - deep observation (every ${window} exp)`
    }
  }
  
  // ============================================
  // 📈 REGISTRO DE PATRONES
  // ============================================
  
  /**
   * Registrar nuevo patrón para análisis de volatilidad
   */
  recordPattern(pattern: VolatilityPattern): void {
    this.patternHistory.push(pattern)
    
    // Mantener tamaño máximo
    if (this.patternHistory.length > this.maxHistorySize) {
      this.patternHistory.shift()
    }
    
    // Re-calcular volatilidad periódicamente
    if (this.patternHistory.length % 5 === 0) {
      this.calculateVolatility()
    }
  }
  
  /**
   * Registrar que se tomó un insight
   */
  recordInsight(experience: number): void {
    this.lastInsightAt = experience
    this.insightCount++
  }
  
  // ============================================
  // 📊 ESTADÍSTICAS
  // ============================================
  
  /**
   * Obtener estadísticas de volatilidad
   */
  getVolatilityStats(): VolatilityStats {
    const volatility = this.currentVolatility ?? this.calculateVolatility()
    const th = this.thresholds
    
    return {
      volatilityLevel: volatility.overallVolatility.toUpperCase(),
      beautyStability: volatility.beautyVariance < th.beautyVariance.low ? 'HIGH' :
                       volatility.beautyVariance < th.beautyVariance.medium ? 'MEDIUM' : 'LOW',
      timeStability: volatility.convergenceVariance < th.convergenceVariance.low ? 'HIGH' :
                     volatility.convergenceVariance < th.convergenceVariance.medium ? 'MEDIUM' : 'LOW',
      patternStability: volatility.patternSwitchRate < th.switchRate.low ? 'HIGH' :
                        volatility.patternSwitchRate < th.switchRate.medium ? 'MEDIUM' : 'LOW',
      energyStability: volatility.energyVariance < th.energyVariance.low ? 'HIGH' :
                       volatility.energyVariance < th.energyVariance.medium ? 'MEDIUM' : 'LOW',
      recommendedWindow: this.currentWindow,
      adaptiveMultiplier: this.getAdaptiveMultiplier(volatility)
    }
  }
  
  /**
   * Obtener multiplicador adaptativo para otros sistemas
   */
  getAdaptiveMultiplier(volatility?: SystemVolatility): number {
    const vol = volatility ?? this.currentVolatility
    if (!vol) return 1.0
    
    switch (vol.overallVolatility) {
      case 'extreme': return 2.0   // Doble velocidad
      case 'high': return 1.5      // 50% más rápido
      case 'medium': return 1.0    // Normal
      case 'low': return 0.5       // 50% más lento
    }
  }
  
  // ============================================
  // 🔧 UTILIDADES MATEMÁTICAS
  // ============================================
  
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }
  
  private variance(values: number[], mean?: number): number {
    if (values.length < 2) return 0
    const avg = mean ?? this.average(values)
    return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  }
  
  // ============================================
  // 🔧 GETTERS Y UTILIDADES
  // ============================================
  
  /** Obtener ventana actual */
  getCurrentWindow(): number {
    return this.currentWindow
  }
  
  /** Obtener volatilidad actual */
  getCurrentVolatility(): SystemVolatility | null {
    return this.currentVolatility
  }
  
  /** Obtener historial de patrones */
  getPatternHistory(): VolatilityPattern[] {
    return [...this.patternHistory]
  }
  
  /** Verificar si debemos tomar insight */
  shouldTakeInsight(currentExperience: number): boolean {
    return (currentExperience - this.lastInsightAt) >= this.currentWindow
  }
  
  /** Actualizar configuración de ventanas */
  updateWindowConfig(config: Partial<WindowConfig>): void {
    this.windowConfig = { ...this.windowConfig, ...config }
    console.log('🎯 [PRECISION] Window config updated:', this.windowConfig)
  }
  
  /** Reset del motor */
  reset(): void {
    this.patternHistory = []
    this.currentVolatility = null
    this.currentWindow = this.windowConfig.defaultWindow
    this.lastInsightAt = 0
    this.insightCount = 0
    console.log('🎯 [PRECISION] Engine reset')
  }
}
