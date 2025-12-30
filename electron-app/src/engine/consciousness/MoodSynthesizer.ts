/**
 * 🌈 MOOD SYNTHESIZER
 * Sintetiza el "mood" emocional de la música para guiar iluminación
 * 
 * Basado en: EmotionalTone + ConsciousnessState de Auditoría 1
 * - Analiza métricas de audio para inferir emoción
 * - Suaviza transiciones entre estados
 * - Influye en paletas, velocidad de movimiento, efectos
 */

import type {
  AudioMetrics,
  EmotionalTone,
  MusicalPattern,
} from '../types'
import type { BeatState } from '../audio/BeatDetector'

/**
 * Estado de mood sintetizado
 */
export interface MoodState {
  primary: EmotionalTone
  secondary: EmotionalTone | null
  
  // Dimensiones del mood
  valence: number         // -1 (negativo) a 1 (positivo)
  arousal: number         // -1 (calmado) a 1 (excitado)
  dominance: number       // -1 (sumiso) a 1 (dominante)
  
  // Intensidad y estabilidad
  intensity: number       // 0-1
  stability: number       // 0-1 (qué tan estable es el mood actual)
  
  // Transición
  transitioning: boolean
  transitionProgress: number // 0-1
}

/**
 * Mapa de características de audio a mood
 */
interface MoodSignature {
  energy: [number, number]      // [min, max]
  bpm: [number, number]
  bassRatio: [number, number]   // bass / (bass + mid + treble)
  trebleRatio: [number, number]
}

const MOOD_SIGNATURES: Record<EmotionalTone, MoodSignature> = {
  peaceful: {
    energy: [0, 0.4],
    bpm: [60, 100],
    bassRatio: [0.2, 0.4],
    trebleRatio: [0.2, 0.4],
  },
  energetic: {
    energy: [0.5, 1.0],
    bpm: [120, 180],
    bassRatio: [0.3, 0.5],
    trebleRatio: [0.2, 0.4],
  },
  chaotic: {
    energy: [0.7, 1.0],
    bpm: [140, 200],
    bassRatio: [0.3, 0.6],
    trebleRatio: [0.3, 0.5],
  },
  harmonious: {
    energy: [0.3, 0.7],
    bpm: [80, 130],
    bassRatio: [0.25, 0.4],
    trebleRatio: [0.25, 0.4],
  },
  building: {
    energy: [0.2, 0.6],  // Energía subiendo
    bpm: [100, 140],
    bassRatio: [0.3, 0.5],
    trebleRatio: [0.2, 0.35],
  },
  dropping: {
    energy: [0.6, 1.0],  // Energía alta (post-build)
    bpm: [120, 160],
    bassRatio: [0.4, 0.6],
    trebleRatio: [0.15, 0.3],
  },
}

/**
 * 🌈 MoodSynthesizer
 */
export class MoodSynthesizer {
  private state: MoodState
  private previousState: MoodState
  
  // Historial para detección de tendencias
  private energyHistory: number[] = []
  private readonly historyLength = 60 // ~1 segundo a 60fps
  
  // Configuración de transición
  private readonly transitionSpeed: number
  
  constructor() {
    this.transitionSpeed = 0.05  // Velocidad de transición entre moods
    
    this.state = this.createNeutralState()
    this.previousState = this.createNeutralState()
  }
  
  private createNeutralState(): MoodState {
    return {
      primary: 'harmonious',
      secondary: null,
      valence: 0,
      arousal: 0,
      dominance: 0,
      intensity: 0.5,
      stability: 1,
      transitioning: false,
      transitionProgress: 0,
    }
  }
  
  /**
   * Procesar frame de audio y actualizar mood
   */
  process(
    metrics: AudioMetrics,
    beatState: BeatState,
    pattern?: MusicalPattern
  ): MoodState {
    // Actualizar historial
    this.energyHistory.push(metrics.energy)
    if (this.energyHistory.length > this.historyLength) {
      this.energyHistory.shift()
    }
    
    // Calcular características
    const total = metrics.bass + metrics.mid + metrics.treble || 1
    const bassRatio = metrics.bass / total
    const trebleRatio = metrics.treble / total
    
    // Detectar tendencia de energía
    const energyTrend = this.detectEnergyTrend()
    
    // Calcular scores para cada mood
    const scores = this.calculateMoodScores(
      metrics.energy,
      beatState.bpm,
      bassRatio,
      trebleRatio,
      energyTrend
    )
    
    // Encontrar mejor mood
    const sortedMoods = Object.entries(scores)
      .sort(([, a], [, b]) => b - a) as [EmotionalTone, number][]
    
    const [newPrimary] = sortedMoods[0]
    const [newSecondary, secondaryScore] = sortedMoods[1] || [null, 0]
    
    // Usar patrón si está disponible y tiene alta confianza
    const primaryMood = (pattern && pattern.confidence > 0.7)
      ? pattern.emotionalTone
      : newPrimary
    
    // Detectar si necesitamos transición
    if (primaryMood !== this.state.primary) {
      this.previousState = { ...this.state }
      this.state.transitioning = true
      this.state.transitionProgress = 0
    }
    
    // Actualizar transición
    if (this.state.transitioning) {
      this.state.transitionProgress += this.transitionSpeed
      if (this.state.transitionProgress >= 1) {
        this.state.transitioning = false
        this.state.transitionProgress = 0
        this.state.primary = primaryMood
      }
    } else {
      this.state.primary = primaryMood
    }
    
    this.state.secondary = secondaryScore > 0.3 ? newSecondary : null
    
    // Calcular dimensiones VAD (Valence-Arousal-Dominance)
    this.calculateVAD(metrics, beatState)
    
    // Calcular intensidad y estabilidad
    this.state.intensity = metrics.energy * (0.5 + beatState.confidence * 0.5)
    this.state.stability = this.calculateStability()
    
    return this.getState()
  }
  
  /**
   * Calcular scores para cada mood
   */
  private calculateMoodScores(
    energy: number,
    bpm: number,
    bassRatio: number,
    trebleRatio: number,
    energyTrend: number
  ): Record<EmotionalTone, number> {
    const scores: Record<EmotionalTone, number> = {} as Record<EmotionalTone, number>
    
    for (const [mood, sig] of Object.entries(MOOD_SIGNATURES)) {
      let score = 0
      
      // Score por energía
      score += this.rangeScore(energy, sig.energy[0], sig.energy[1]) * 0.3
      
      // Score por BPM
      score += this.rangeScore(bpm, sig.bpm[0], sig.bpm[1]) * 0.25
      
      // Score por bass ratio
      score += this.rangeScore(bassRatio, sig.bassRatio[0], sig.bassRatio[1]) * 0.25
      
      // Score por treble ratio
      score += this.rangeScore(trebleRatio, sig.trebleRatio[0], sig.trebleRatio[1]) * 0.2
      
      // Bonus para building/dropping basado en tendencia
      if (mood === 'building' && energyTrend > 0.3) {
        score += 0.3
      } else if (mood === 'dropping' && energyTrend < -0.3) {
        score += 0.3
      }
      
      scores[mood as EmotionalTone] = Math.max(0, Math.min(1, score))
    }
    
    return scores
  }
  
  /**
   * Score de qué tan bien un valor está en un rango
   */
  private rangeScore(value: number, min: number, max: number): number {
    if (value >= min && value <= max) {
      // Dentro del rango: score basado en cercanía al centro
      const center = (min + max) / 2
      const halfRange = (max - min) / 2
      return 1 - Math.abs(value - center) / halfRange * 0.5
    }
    // Fuera del rango: score decrece con distancia
    const distance = value < min ? min - value : value - max
    return Math.max(0, 1 - distance * 2)
  }
  
  /**
   * Detectar tendencia de energía
   */
  private detectEnergyTrend(): number {
    if (this.energyHistory.length < 10) return 0
    
    const recent = this.energyHistory.slice(-10)
    const older = this.energyHistory.slice(-30, -20)
    
    if (older.length === 0) return 0
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    
    return recentAvg - olderAvg // Positivo = subiendo, Negativo = bajando
  }
  
  /**
   * Calcular dimensiones Valence-Arousal-Dominance
   */
  private calculateVAD(metrics: AudioMetrics, beatState: BeatState): void {
    // Arousal: energía + BPM alto = más excitado
    this.state.arousal = (metrics.energy * 0.6 + (beatState.bpm / 180) * 0.4) * 2 - 1
    
    // Valence: más armónico (mid) = más positivo
    const total = metrics.bass + metrics.mid + metrics.treble || 1
    const midRatio = metrics.mid / total
    this.state.valence = (midRatio - 0.33) * 3 // Escala a -1 a 1
    
    // Dominance: bass alto = más dominante
    this.state.dominance = (metrics.bass / total - 0.33) * 3
    
    // Suavizar
    this.state.arousal = Math.max(-1, Math.min(1, this.state.arousal))
    this.state.valence = Math.max(-1, Math.min(1, this.state.valence))
    this.state.dominance = Math.max(-1, Math.min(1, this.state.dominance))
  }
  
  /**
   * Calcular estabilidad del mood
   */
  private calculateStability(): number {
    if (this.energyHistory.length < 10) return 1
    
    const recent = this.energyHistory.slice(-10)
    const variance = this.calculateVariance(recent)
    
    // Menos varianza = más estable
    return Math.max(0, 1 - variance * 4)
  }
  
  private calculateVariance(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length
  }
  
  /**
   * Obtener estado actual (con interpolación si está en transición)
   */
  getState(): MoodState {
    if (!this.state.transitioning) {
      return { ...this.state }
    }
    
    // Interpolar entre estado anterior y nuevo durante transición
    const t = this.state.transitionProgress
    return {
      ...this.state,
      valence: this.lerp(this.previousState.valence, this.state.valence, t),
      arousal: this.lerp(this.previousState.arousal, this.state.arousal, t),
      dominance: this.lerp(this.previousState.dominance, this.state.dominance, t),
      intensity: this.lerp(this.previousState.intensity, this.state.intensity, t),
    }
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
  }
  
  /**
   * Obtener sugerencia de paleta basada en mood
   */
  getSuggestedPalette(): string {
    const moodToPalette: Record<EmotionalTone, string> = {
      peaceful: 'ocean',
      energetic: 'fire',
      chaotic: 'neon',
      harmonious: 'forest',
      building: 'sunset',
      dropping: 'cosmic',
    }
    
    return moodToPalette[this.state.primary] || 'fire'
  }
  
  /**
   * Obtener multiplicador de velocidad basado en arousal
   */
  getSpeedMultiplier(): number {
    // arousal de -1 a 1 -> multiplicador de 0.5 a 1.5
    return 1 + this.state.arousal * 0.5
  }
}
