/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                      🎵 AUDIO TO MUSICAL MAPPER 🎵
 *                   "El Oído que Traduce Frecuencias a Poesía"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Traduce el lenguaje crudo del audio (bass, mid, treble, energy)
 * al lenguaje poético de Selene (notas, elementos, belleza, mood)
 * 
 * Wave 4 - Despertar Felino
 * Arquitecto: Claude + PunkGrok
 */

import type { AudioMetrics } from '../types'

// ============================================================================
// TYPES - EL LENGUAJE DE SELENE
// ============================================================================

export type MusicalNote = 'DO' | 'RE' | 'MI' | 'FA' | 'SOL' | 'LA' | 'SI'
export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water'
export type BeautyTrend = 'rising' | 'falling' | 'stable' | 'chaotic'
export type EmotionalTone = 'energetic' | 'chaotic' | 'peaceful' | 'harmonious' | 'building' | 'explosive'

export interface MusicalPattern {
  /** Nota musical dominante (DO-SI) */
  note: MusicalNote
  /** Elemento zodiacal basado en energía */
  element: ZodiacElement
  /** Puntuación de belleza armónica (0-1) */
  avgBeauty: number
  /** Tendencia de la belleza */
  beautyTrend: BeautyTrend
  /** Tono emocional detectado */
  emotionalTone: EmotionalTone
  /** Cantidad de ocurrencias del patrón */
  occurrences: number
  /** Confianza en el patrón (0-1) */
  confidence: number
  /** Historial reciente de beauty scores */
  recentBeautyScores: number[]
  /** Timestamp */
  timestamp: number
}

// ============================================================================
// 🎵 AUDIO TO MUSICAL MAPPER
// ============================================================================

export class AudioToMusicalMapper {
  // 🎼 Mapeo de bandas de frecuencia a notas musicales
  // Basado en rangos de frecuencia típicos del audio
  private readonly FREQ_BAND_TO_NOTE: Record<string, MusicalNote> = {
    'sub_bass': 'DO',      // 20-60Hz   - Fundamento, base
    'bass': 'RE',          // 60-250Hz  - Movimiento, groove
    'low_mid': 'MI',       // 250-500Hz - Cuerpo, calidez
    'mid': 'FA',           // 500-2kHz  - Presencia, claridad
    'high_mid': 'SOL',     // 2-4kHz    - Brillo, articulación
    'presence': 'LA',      // 4-6kHz    - Aire, detalle
    'brilliance': 'SI',    // 6-20kHz   - Chispa, tensión
  }

  // 🔥 PHI - Proporción Áurea para cálculo de belleza
  private readonly PHI = 1.618033988749895

  // 📊 Historial para análisis de tendencias
  private beautyHistory: number[] = []
  private readonly HISTORY_SIZE = 30 // ~1 segundo a 30fps
  
  // 🎭 Estado previo para detección de cambios
  private lastPattern: MusicalPattern | null = null
  private patternOccurrences: Map<string, number> = new Map()

  /**
   * 🎵 TRADUCE AUDIO METRICS A MUSICAL PATTERN
   * El corazón del mapper - donde las frecuencias se vuelven poesía
   */
  translateAudio(audio: AudioMetrics): MusicalPattern {
    // 1. Detectar nota dominante por frecuencia
    const note = this.detectDominantNote(audio)
    
    // 2. Detectar elemento por perfil de energía
    const element = this.detectElement(audio)
    
    // 3. Calcular beauty (qué tan "bella" es la armonía)
    const beauty = this.calculateBeauty(audio)
    
    // 4. Actualizar historial y detectar trend
    this.beautyHistory.push(beauty)
    if (this.beautyHistory.length > this.HISTORY_SIZE) {
      this.beautyHistory.shift()
    }
    const beautyTrend = this.detectBeautyTrend()
    
    // 5. Detectar mood emocional
    const emotionalTone = this.detectEmotionalTone(audio, beautyTrend)
    
    // 6. Contar ocurrencias del patrón
    const patternKey = `${note}-${element}`
    const currentOccurrences = (this.patternOccurrences.get(patternKey) || 0) + 1
    this.patternOccurrences.set(patternKey, currentOccurrences)
    
    // Limpiar patrones antiguos (solo mantener los últimos 50)
    if (this.patternOccurrences.size > 50) {
      const firstKey = this.patternOccurrences.keys().next().value
      if (firstKey) this.patternOccurrences.delete(firstKey)
    }
    
    const pattern: MusicalPattern = {
      note,
      element,
      avgBeauty: beauty,
      beautyTrend,
      emotionalTone,
      occurrences: currentOccurrences,
      confidence: audio.beatConfidence || 0.5,
      recentBeautyScores: [...this.beautyHistory.slice(-5)],
      timestamp: Date.now(),
    }
    
    this.lastPattern = pattern
    return pattern
  }

  /**
   * 🎼 DETECTA NOTA DOMINANTE
   * Analiza el espectro para determinar qué banda de frecuencia domina
   */
  private detectDominantNote(audio: AudioMetrics): MusicalNote {
    const { bass, mid, treble } = audio
    
    // Calcular pesos por banda
    const bands = {
      sub_bass: bass * 1.2,           // Sub-bass boost
      bass: bass * 0.9,               // Bass normal
      low_mid: (bass + mid) / 2,      // Transición
      mid: mid,                        // Mids puros
      high_mid: (mid + treble) / 2,   // Transición
      presence: treble * 0.8,          // Presencia
      brilliance: treble * 1.1,        // Brilliance boost
    }
    
    // Encontrar banda dominante
    let dominantBand = 'mid'
    let maxValue = 0
    
    for (const [band, value] of Object.entries(bands)) {
      if (value > maxValue) {
        maxValue = value
        dominantBand = band
      }
    }
    
    return this.FREQ_BAND_TO_NOTE[dominantBand] || 'FA'
  }

  /**
   * 🔥 DETECTA ELEMENTO ZODIACAL
   * Basado en el perfil de energía del audio
   */
  private detectElement(audio: AudioMetrics): ZodiacElement {
    const { bass, treble, energy } = audio
    
    // Calcular ratios
    const bassWeight = bass > 0.6
    const trebleWeight = treble > 0.5
    const highEnergy = energy > 0.6
    
    // 🔥 FIRE: Bass alto + Energía alta = Explosivo
    if (bassWeight && highEnergy) {
      return 'fire'
    }
    
    // 🌍 EARTH: Bass alto + Energía baja = Profundo, estable
    if (bassWeight && !highEnergy) {
      return 'earth'
    }
    
    // 💨 AIR: Treble alto + Energía alta = Brillante, ligero
    if (trebleWeight && highEnergy) {
      return 'air'
    }
    
    // 💧 WATER: Treble alto + Energía baja = Etéreo, fluido
    if (trebleWeight && !highEnergy) {
      return 'water'
    }
    
    // Default: Earth (estabilidad)
    return 'earth'
  }

  /**
   * ✨ CALCULA BELLEZA ARMÓNICA
   * Basado en proporción áurea (PHI) y balance de frecuencias
   */
  private calculateBeauty(audio: AudioMetrics): number {
    const { bass, mid, treble, energy, beatConfidence } = audio
    
    // 1. RATIO ÁUREO: Qué tan cerca está el balance de PHI
    const ratio = (bass + mid) / (treble + 0.1) // +0.1 para evitar división por 0
    const ratioScore = 1 - Math.min(1, Math.abs(ratio - this.PHI) / this.PHI)
    
    // 2. BALANCE: Penalizar extremos (todo bass o todo treble)
    const balanceScore = 1 - Math.abs(bass - treble)
    
    // 3. ENERGÍA: La energía aporta vitalidad
    const energyScore = energy * 0.3
    
    // 4. RITMO: Un beat claro es más "bello"
    const rhythmScore = (beatConfidence || 0.5) * 0.2
    
    // 5. PRESENCIA DE MIDS: Mids dan cuerpo
    const midPresenceScore = mid * 0.2
    
    // Combinar con pesos
    const beauty = (
      ratioScore * 0.3 +      // 30% ratio áureo
      balanceScore * 0.2 +    // 20% balance
      energyScore +           // 30% energía
      rhythmScore +           // 20% ritmo
      midPresenceScore        // ??? mids (bonus)
    )
    
    // Clamp a 0-1
    return Math.max(0, Math.min(1, beauty))
  }

  /**
   * 📈 DETECTA TENDENCIA DE BELLEZA
   * Analiza el historial para ver si la belleza sube, baja o es estable
   */
  private detectBeautyTrend(): BeautyTrend {
    if (this.beautyHistory.length < 5) return 'stable'
    
    const recent = this.beautyHistory.slice(-10)
    const firstHalf = recent.slice(0, 5)
    const secondHalf = recent.slice(-5)
    
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const diff = avgSecond - avgFirst
    
    // Calcular varianza para detectar caos
    const variance = this.calculateVariance(recent)
    
    if (variance > 0.15) return 'chaotic'
    if (diff > 0.1) return 'rising'
    if (diff < -0.1) return 'falling'
    return 'stable'
  }

  /**
   * 🎭 DETECTA TONO EMOCIONAL
   * Combina energía, trend y patrones para determinar el mood
   */
  private detectEmotionalTone(audio: AudioMetrics, trend: BeautyTrend): EmotionalTone {
    const { energy, onBeat } = audio
    const highEnergy = energy > 0.7
    const mediumEnergy = energy > 0.4
    
    // 💥 EXPLOSIVE: Alta energía + on beat + rising
    if (highEnergy && onBeat && trend === 'rising') {
      return 'explosive'
    }
    
    // ⚡ ENERGETIC: Alta energía + rising
    if (highEnergy && trend === 'rising') {
      return 'energetic'
    }
    
    // 🌀 CHAOTIC: Alta energía + chaotic trend
    if (highEnergy && trend === 'chaotic') {
      return 'chaotic'
    }
    
    // 🔨 BUILDING: Energía media + rising
    if (mediumEnergy && trend === 'rising') {
      return 'building'
    }
    
    // ☮️ PEACEFUL: Baja energía + stable/falling
    if (!mediumEnergy && (trend === 'stable' || trend === 'falling')) {
      return 'peaceful'
    }
    
    // 🎵 HARMONIOUS: Default - equilibrio
    return 'harmonious'
  }

  /**
   * 📊 Calcula varianza de un array
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length
  }

  // ============================================================================
  // UTILIDADES PÚBLICAS
  // ============================================================================

  /** Obtener último patrón detectado */
  getLastPattern(): MusicalPattern | null {
    return this.lastPattern
  }

  /** Obtener historial de belleza */
  getBeautyHistory(): number[] {
    return [...this.beautyHistory]
  }

  /** Obtener belleza promedio reciente */
  getAverageBeauty(): number {
    if (this.beautyHistory.length === 0) return 0.5
    return this.beautyHistory.reduce((a, b) => a + b, 0) / this.beautyHistory.length
  }

  /** Reset del mapper */
  reset(): void {
    this.beautyHistory = []
    this.lastPattern = null
    this.patternOccurrences.clear()
  }

  /** Debug info */
  getDebugInfo(): Record<string, unknown> {
    return {
      historyLength: this.beautyHistory.length,
      averageBeauty: this.getAverageBeauty(),
      lastPattern: this.lastPattern,
      uniquePatterns: this.patternOccurrences.size,
    }
  }
}

// Export singleton para uso global
export const audioToMusicalMapper = new AudioToMusicalMapper()
