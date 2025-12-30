/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                    🎨 CONSCIOUSNESS TO LIGHT MAPPER 🎨
 *                  "Donde las Decisiones Felinas se Vuelven Luz"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Traduce las decisiones de la mente felina de Selene a comandos
 * concretos de luz (paletas, movimientos, efectos)
 * 
 * Wave 4 - Despertar Felino
 * Arquitecto: Claude + PunkGrok
 */

import type { MusicalNote, ZodiacElement, EmotionalTone, BeautyTrend, MusicalPattern } from './AudioToMusicalMapper'
import type { LivingPaletteId } from '../color/ColorEngine'

// ============================================================================
// TYPES
// ============================================================================

export type MovementPatternId = 'circle' | 'wave' | 'lissajous' | 'random' | 'static' | 'chase'
export type EffectId = 'strobe' | 'pulse' | 'breathe' | 'fade' | 'chase' | 'random' | 'blinder' | 'none'

export interface HuntDecision {
  /** ¿Debería atacar ahora? */
  shouldStrike: boolean
  /** Presa objetivo (el patrón que queremos expresar) */
  targetPrey: MusicalPattern | null
  /** Confianza en la decisión (0-1) */
  confidence: number
  /** Razón de la decisión */
  reasoning: string
}

export interface LightCommand {
  /** ID de paleta a usar */
  palette: LivingPaletteId
  /** Patrón de movimiento */
  movement: MovementPatternId
  /** Intensidad general (0-1) */
  intensity: number
  /** Velocidad del movimiento (0-1) */
  speed: number
  /** Efectos a activar */
  effects: EffectId[]
  /** Tiempo de transición en ms */
  transitionTime: number
  /** Metadata para debug/learning */
  _source: {
    note: MusicalNote
    element: ZodiacElement
    beauty: number
    confidence: number
    shouldStrike: boolean
    emotionalTone: EmotionalTone
  }
}

// ============================================================================
// 🎨 CONSCIOUSNESS TO LIGHT MAPPER
// ============================================================================

export class ConsciousnessToLightMapper {
  // 🎵 Mapeo de notas musicales a paletas de color
  // Basado en sinestesia musical y teoría del color
  private readonly NOTE_TO_PALETTE: Record<MusicalNote, LivingPaletteId> = {
    'DO': 'fuego',    // Rojo/naranja - base, fundamento, raíz
    'RE': 'fuego',    // Naranja cálido - movimiento, danza
    'MI': 'selva',    // Verde - naturaleza, crecimiento, corazón
    'FA': 'hielo',    // Azul - calma, profundidad, garganta
    'SOL': 'neon',    // Amarillo/dorado - brillo, poder, plexo solar
    'LA': 'hielo',    // Azul violeta - intuición, tercer ojo
    'SI': 'neon',     // Violeta/magenta - tensión, corona, resolución
  }

  // 🔥 Mapeo de elementos zodiacales a patrones de movimiento
  private readonly ELEMENT_TO_MOVEMENT: Record<ZodiacElement, MovementPatternId> = {
    'fire': 'random',     // Fuego: impredecible, explosivo, caótico
    'earth': 'wave',      // Tierra: ondulante, estable, orgánico
    'air': 'lissajous',   // Aire: fluido, infinito, matemático
    'water': 'circle',    // Agua: circular, envolvente, cíclico
  }

  // 🎭 Mapeo de mood emocional a efectos
  private readonly MOOD_TO_EFFECTS: Record<EmotionalTone, EffectId[]> = {
    'energetic': ['pulse', 'chase'],
    'explosive': ['strobe', 'blinder'],
    'chaotic': ['strobe', 'random'],
    'peaceful': ['breathe', 'fade'],
    'harmonious': ['fade', 'breathe'],
    'building': ['pulse', 'chase'],
  }

  // ⚡ Mapeo de mood a velocidad base
  private readonly MOOD_TO_SPEED: Record<EmotionalTone, number> = {
    'energetic': 0.8,
    'explosive': 1.0,
    'chaotic': 0.9,
    'peaceful': 0.3,
    'harmonious': 0.5,
    'building': 0.6,
  }

  /**
   * 🎨 TRADUCE DECISIÓN DE CAZA A COMANDO DE LUZ
   * El corazón del mapper - donde la consciencia se vuelve fotones
   */
  translateDecision(decision: HuntDecision): LightCommand {
    const { shouldStrike, targetPrey, confidence } = decision

    // Si no hay presa (patrón), usar defaults
    if (!targetPrey) {
      return this.getDefaultCommand()
    }

    const { note, element, avgBeauty, beautyTrend, emotionalTone } = targetPrey

    // 1. PALETA: Basada en nota musical
    const palette = this.NOTE_TO_PALETTE[note] || 'fuego'

    // 2. MOVIMIENTO: Basado en elemento zodiacal
    let movement = this.ELEMENT_TO_MOVEMENT[element] || 'circle'
    
    // Si es strike, movimiento más agresivo
    if (shouldStrike && movement === 'circle') {
      movement = 'random'
    }

    // 3. INTENSIDAD: Confidence × Beauty
    const intensity = Math.min(1, confidence * avgBeauty * 1.2)

    // 4. VELOCIDAD: Basada en mood + boost si strike
    let speed = this.MOOD_TO_SPEED[emotionalTone] || 0.5
    if (shouldStrike) {
      speed = Math.min(1, speed * 1.5) // 50% más rápido en strike
    }

    // 5. EFECTOS: Basados en mood
    let effects = [...(this.MOOD_TO_EFFECTS[emotionalTone] || [])]
    
    // Strike añade efectos de impacto
    if (shouldStrike) {
      if (!effects.includes('strobe')) {
        effects.unshift('strobe')
      }
    }
    
    // Limitar a 2 efectos máximo para no saturar
    effects = effects.slice(0, 2)

    // 6. TIEMPO DE TRANSICIÓN: Basado en trend + strike
    let transitionTime = this.calculateTransitionTime(beautyTrend, shouldStrike)

    return {
      palette,
      movement,
      intensity,
      speed,
      effects: effects.length > 0 ? effects : ['none'],
      transitionTime,
      _source: {
        note,
        element,
        beauty: avgBeauty,
        confidence,
        shouldStrike,
        emotionalTone,
      },
    }
  }

  /**
   * ⏱️ CALCULA TIEMPO DE TRANSICIÓN
   */
  private calculateTransitionTime(trend: BeautyTrend, shouldStrike: boolean): number {
    // Strike = transición instantánea
    if (shouldStrike) return 0

    // Basado en trend
    switch (trend) {
      case 'rising':
        return 300  // Subiendo = transición media-rápida
      case 'falling':
        return 1500 // Bajando = transición lenta
      case 'chaotic':
        return 100  // Caótico = rápido
      case 'stable':
      default:
        return 800  // Estable = normal
    }
  }

  /**
   * 🔧 COMANDO POR DEFECTO
   */
  private getDefaultCommand(): LightCommand {
    return {
      palette: 'fuego',
      movement: 'circle',
      intensity: 0.5,
      speed: 0.5,
      effects: ['breathe'],
      transitionTime: 1000,
      _source: {
        note: 'DO',
        element: 'earth',
        beauty: 0.5,
        confidence: 0.5,
        shouldStrike: false,
        emotionalTone: 'harmonious',
      },
    }
  }

  // ============================================================================
  // UTILIDADES DE CONSULTA
  // ============================================================================

  /**
   * 🎨 Obtener paleta para una nota específica
   */
  getPaletteForNote(note: MusicalNote): LivingPaletteId {
    return this.NOTE_TO_PALETTE[note] || 'fuego'
  }

  /**
   * 🎯 Obtener movimiento para un elemento
   */
  getMovementForElement(element: ZodiacElement): MovementPatternId {
    return this.ELEMENT_TO_MOVEMENT[element] || 'circle'
  }

  /**
   * 🎭 Obtener efectos para un mood
   */
  getEffectsForMood(mood: EmotionalTone): EffectId[] {
    return [...(this.MOOD_TO_EFFECTS[mood] || [])]
  }

  /**
   * ⚡ Obtener velocidad para un mood
   */
  getSpeedForMood(mood: EmotionalTone): number {
    return this.MOOD_TO_SPEED[mood] || 0.5
  }

  /**
   * 🐛 Debug info
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      noteMappings: this.NOTE_TO_PALETTE,
      elementMappings: this.ELEMENT_TO_MOVEMENT,
      moodEffects: this.MOOD_TO_EFFECTS,
    }
  }
}

// Export singleton
export const consciousnessToLightMapper = new ConsciousnessToLightMapper()
