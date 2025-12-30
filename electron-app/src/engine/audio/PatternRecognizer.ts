/**
 * 🎵 PATTERN RECOGNIZER
 * Reconoce patrones musicales en el audio
 * 
 * Basado en: MusicalPatternRecognizer de Auditoría 1
 * - Aprende correlaciones entre notas, elementos y belleza
 * - Predice estados óptimos basados en historial
 */

import type {
  AudioMetrics,
  MusicalPattern,
  MusicalNote,
  ElementType,
  EmotionalTone,
  AudioConfig,
} from '../types'

/**
 * Estado de predicción
 */
export interface PredictedState {
  suggestedNote: MusicalNote
  confidence: number
  basedOnPattern: MusicalPattern | null
  reasoning: string
}

/**
 * 🎵 PatternRecognizer
 * Analiza patrones musicales y aprende de ellos
 */
export class PatternRecognizer {
  private patterns: Map<string, MusicalPattern> = new Map()
  private recentPatterns: MusicalPattern[] = []
  private readonly maxHistory = 100
  
  constructor(private config: AudioConfig) {
    this.initializePatterns()
  }
  
  /**
   * Inicializar patrones base
   */
  private initializePatterns(): void {
    // Patrones iniciales basados en teoría musical/elementos
    const notes: MusicalNote[] = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI']
    const elements: ElementType[] = ['fire', 'earth', 'air', 'water']
    const tones: EmotionalTone[] = ['peaceful', 'energetic', 'chaotic', 'harmonious']
    
    notes.forEach((note, i) => {
      const key = `${note}-initial`
      this.patterns.set(key, {
        note,
        element: elements[i % elements.length],
        emotionalTone: tones[i % tones.length],
        avgBeauty: 0.5,
        beautyTrend: 'stable',
        occurrences: 0,
        confidence: 0.3,
      })
    })
  }
  
  /**
   * Analizar frame de audio y detectar patrón
   */
  analyze(metrics: AudioMetrics): MusicalPattern {
    // Determinar nota dominante basada en frecuencias
    const note = this.detectDominantNote(metrics)
    
    // Determinar elemento basado en características
    const element = this.detectElement(metrics)
    
    // Determinar tono emocional
    const emotionalTone = this.detectEmotionalTone(metrics)
    
    // Buscar o crear patrón
    const key = `${note}-${element}-${emotionalTone}`
    let pattern = this.patterns.get(key)
    
    if (!pattern) {
      pattern = {
        note,
        element,
        emotionalTone,
        avgBeauty: 0.5,
        beautyTrend: 'stable',
        occurrences: 1,
        confidence: 0.4,
      }
      this.patterns.set(key, pattern)
    } else {
      // Actualizar patrón existente
      pattern.occurrences++
      pattern.confidence = Math.min(0.95, pattern.confidence + 0.01)
    }
    
    // Agregar al historial
    this.recentPatterns.push(pattern)
    if (this.recentPatterns.length > this.maxHistory) {
      this.recentPatterns.shift()
    }
    
    return pattern
  }
  
  /**
   * Detectar nota dominante desde frecuencias
   */
  private detectDominantNote(metrics: AudioMetrics): MusicalNote {
    // Mapeo simplificado bass/mid/treble a notas
    // DO-RE: Bass heavy
    // MI-FA-SOL: Mid focused
    // LA-SI: Treble prominent
    
    if (metrics.bass > metrics.mid && metrics.bass > metrics.treble) {
      return metrics.bass > 0.7 ? 'DO' : 'RE'
    } else if (metrics.treble > metrics.mid) {
      return metrics.treble > 0.7 ? 'SI' : 'LA'
    } else {
      if (metrics.mid > 0.7) return 'SOL'
      if (metrics.mid > 0.5) return 'FA'
      return 'MI'
    }
  }
  
  /**
   * Detectar elemento desde características
   */
  private detectElement(metrics: AudioMetrics): ElementType {
    // Fire: Alta energía + bass
    // Water: Baja energía + treble
    // Air: Alta treble + mid
    // Earth: Bass estable + mid
    
    if (metrics.energy > 0.7 && metrics.bass > 0.6) return 'fire'
    if (metrics.energy < 0.4 && metrics.treble > 0.5) return 'water'
    if (metrics.treble > 0.6 && metrics.mid > 0.5) return 'air'
    return 'earth'
  }
  
  /**
   * Detectar tono emocional
   */
  private detectEmotionalTone(metrics: AudioMetrics): EmotionalTone {
    // Basado en energía y patrones de beat
    if (metrics.energy > 0.8) return 'chaotic'
    if (metrics.energy > 0.6 && metrics.onBeat) return 'energetic'
    if (metrics.energy < 0.3) return 'peaceful'
    return 'harmonious'
  }
  
  /**
   * Predecir próximo estado óptimo
   */
  predictOptimalState(): PredictedState {
    if (this.recentPatterns.length < 5) {
      return {
        suggestedNote: 'FA',
        confidence: 0.3,
        basedOnPattern: null,
        reasoning: 'Insuficientes datos. Sugiriendo nota neutral.',
      }
    }
    
    // Encontrar patrón con mayor belleza promedio
    let bestPattern: MusicalPattern | null = null
    let maxBeauty = 0
    
    this.patterns.forEach(pattern => {
      if (pattern.avgBeauty > maxBeauty && pattern.occurrences > 3) {
        maxBeauty = pattern.avgBeauty
        bestPattern = pattern
      }
    })
    
    if (bestPattern !== null) {
      const bp = bestPattern as MusicalPattern // Type assertion para TS
      return {
        suggestedNote: bp.note,
        confidence: bp.confidence,
        basedOnPattern: bp,
        reasoning: `Patrón ${bp.note}-${bp.element} tiene belleza ${(bp.avgBeauty * 100).toFixed(0)}%`,
      }
    }
    
    return {
      suggestedNote: 'SOL',
      confidence: 0.4,
      basedOnPattern: null,
      reasoning: 'Sin patrón dominante. Sugiriendo SOL (equilibrado).',
    }
  }
  
  /**
   * Registrar feedback de belleza
   */
  recordBeautyFeedback(patternKey: string, beautyScore: number): void {
    const pattern = this.patterns.get(patternKey)
    if (pattern) {
      // Media móvil
      pattern.avgBeauty = pattern.avgBeauty * 0.9 + beautyScore * 0.1
      
      // Actualizar tendencia
      if (beautyScore > pattern.avgBeauty + 0.1) {
        pattern.beautyTrend = 'rising'
      } else if (beautyScore < pattern.avgBeauty - 0.1) {
        pattern.beautyTrend = 'falling'
      } else {
        pattern.beautyTrend = 'stable'
      }
    }
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): {
    totalPatterns: number
    avgBeauty: number
    dominantElement: ElementType
  } {
    let totalBeauty = 0
    const elementCounts: Record<ElementType, number> = {
      fire: 0, earth: 0, air: 0, water: 0
    }
    
    this.patterns.forEach(pattern => {
      totalBeauty += pattern.avgBeauty
      elementCounts[pattern.element]++
    })
    
    const dominantElement = (Object.entries(elementCounts)
      .sort((a, b) => b[1] - a[1])[0][0]) as ElementType
    
    return {
      totalPatterns: this.patterns.size,
      avgBeauty: this.patterns.size > 0 ? totalBeauty / this.patterns.size : 0.5,
      dominantElement,
    }
  }
  
  /**
   * Restaurar patrones desde persistencia
   */
  restorePatterns(patterns: Map<string, MusicalPattern>): void {
    this.patterns = new Map(patterns)
  }
  
  /**
   * Exportar patrones para persistencia
   */
  exportPatterns(): Map<string, MusicalPattern> {
    return new Map(this.patterns)
  }
}
