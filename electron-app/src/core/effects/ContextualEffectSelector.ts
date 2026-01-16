/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CONTEXTUAL EFFECT SELECTOR - THE ARTISTIC BRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 685: CONTEXTUAL INTELLIGENCE
 * 
 * "MG Music: Sonido e Iluminación Contextual IA"
 * 
 * Este módulo es EL CEREBRO ARTÍSTICO de Selene. Decide QUÉ efecto disparar
 * basándose en el contexto musical completo:
 * 
 * - Z-Score: ¿Qué tan intenso es el momento?
 * - Section Type: ¿Es buildup, drop, breakdown?
 * - Vibe: ¿Qué restricciones tenemos?
 * - Hunt Decision: ¿El cazador dice que es momento de atacar?
 * - Energy Trend: ¿Subiendo o bajando?
 * 
 * FILOSOFÍA:
 * - NO es aleatorio - es contextual
 * - NO es repetitivo - variamos los efectos
 * - NO es invasivo - respetamos el Vibe
 * - SÍ es musical - respiramos con la canción
 * 
 * @module core/effects/ContextualEffectSelector
 * @version WAVE 685
 */

import type { MusicalContext } from './types'
import type { HuntDecision } from '../intelligence/think/HuntEngine'
import type { FuzzyDecision } from '../intelligence/think/FuzzyDecisionMaker'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado de la selección contextual
 */
export interface ContextualEffectSelection {
  /** Efecto seleccionado (null = no disparar nada) */
  effectType: string | null
  
  /** Intensidad calculada */
  intensity: number
  
  /** Razón de la selección (para logging) */
  reason: string
  
  /** Confianza en la decisión (0-1) */
  confidence: number
  
  /** ¿Es una decisión de override/bypass? */
  isOverride: boolean
  
  /** Contexto musical inyectado */
  musicalContext: MusicalContext
}

/**
 * Input completo para el selector
 */
export interface ContextualSelectorInput {
  /** Contexto musical en tiempo real */
  musicalContext: MusicalContext
  
  /** Decisión del HuntEngine (opcional) */
  huntDecision?: HuntDecision
  
  /** Decisión del FuzzyDecisionMaker (opcional) */
  fuzzyDecision?: FuzzyDecision
  
  /** Tipo de sección actual */
  sectionType: 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro'
  
  /** Tendencia de energía */
  energyTrend: 'rising' | 'stable' | 'falling'
  
  /** Timestamp del último efecto disparado (cooldown) */
  lastEffectTimestamp: number
  
  /** Último efecto disparado (anti-repetición) */
  lastEffectType: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface EffectSelectionConfig {
  /** Cooldown mínimo entre efectos (ms) */
  minCooldownMs: number
  
  /** Cooldown extra si es el mismo efecto */
  sameEffectCooldownMs: number
  
  /** Umbrales de Z-Score para cada nivel */
  zScoreThresholds: {
    normal: number      // < este = normal
    elevated: number    // >= este = elevated
    epic: number        // >= este = epic (drop territory)
    divine: number      // >= este = solar flare obligatorio
  }
  
  /** Umbral de confianza mínima del Hunt para disparar */
  minHuntConfidence: number
}

const DEFAULT_CONFIG: EffectSelectionConfig = {
  minCooldownMs: 800,          // 0.8 segundos mínimo entre efectos
  sameEffectCooldownMs: 3000,  // 3 segundos si es el mismo efecto
  zScoreThresholds: {
    normal: 1.5,
    elevated: 2.0,
    epic: 2.8,
    divine: 3.5,
  },
  minHuntConfidence: 0.6,
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MAPPING BY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 EFFECT PALETTE BY SECTION
 * 
 * Define qué efectos son apropiados para cada sección de la canción.
 * El selector elige de esta paleta basándose en intensidad y contexto.
 */
const SECTION_EFFECT_PALETTE: Record<string, {
  primary: string      // Efecto principal para esta sección
  secondary: string    // Alternativa
  ambient: string      // Para momentos suaves dentro de la sección
}> = {
  'intro': {
    primary: 'ghost_breath',    // Respiración misteriosa
    secondary: 'tidal_wave',    // Ola suave de bienvenida
    ambient: 'ghost_breath',
  },
  'verse': {
    primary: 'tidal_wave',      // Olas suaves
    secondary: 'ghost_breath',
    ambient: 'ghost_breath',
  },
  'chorus': {
    primary: 'solar_flare',     // Momento épico
    secondary: 'strobe_storm',  // Si ya hubo flare
    ambient: 'tidal_wave',
  },
  'bridge': {
    primary: 'ghost_breath',    // Tensión
    secondary: 'tidal_wave',
    ambient: 'ghost_breath',
  },
  'buildup': {
    primary: 'ghost_breath',    // Tensión creciente
    secondary: 'tidal_wave',    // Ola que sube
    ambient: 'ghost_breath',
  },
  'drop': {
    primary: 'solar_flare',     // BOOM
    secondary: 'strobe_storm',  // Caos
    ambient: 'tidal_wave',      // Post-drop
  },
  'breakdown': {
    primary: 'ghost_breath',    // Calma tensa
    secondary: 'tidal_wave',    // Ola lenta
    ambient: 'ghost_breath',
  },
  'outro': {
    primary: 'ghost_breath',    // Despedida suave
    secondary: 'tidal_wave',
    ambient: 'ghost_breath',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SELECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 CONTEXTUAL EFFECT SELECTOR
 * 
 * El cerebro artístico que decide qué efecto pintar en cada momento.
 */
export class ContextualEffectSelector {
  private config: EffectSelectionConfig
  private consecutiveSameEffect = 0
  
  constructor(config?: Partial<EffectSelectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  /**
   * 🎯 SELECT EFFECT
   * 
   * Método principal: dado el contexto completo, decide qué efecto disparar.
   * 
   * @returns Selección de efecto (puede ser null si no hay que disparar nada)
   */
  public select(input: ContextualSelectorInput): ContextualEffectSelection {
    const { musicalContext, sectionType, lastEffectTimestamp, lastEffectType } = input
    const now = Date.now()
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 1: COOLDOWN CHECK
    // ═══════════════════════════════════════════════════════════════
    
    const timeSinceLastEffect = now - lastEffectTimestamp
    const cooldown = this.calculateCooldown(lastEffectType)
    
    if (timeSinceLastEffect < cooldown) {
      return this.noEffectDecision(musicalContext, `Cooldown (${cooldown - timeSinceLastEffect}ms remaining)`)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 2: Z-SCORE CLASSIFICATION
    // ═══════════════════════════════════════════════════════════════
    
    const zLevel = this.classifyZScore(musicalContext.zScore)
    
    // 🌩️ DIVINE MOMENT: Z > 3.5 = SOLAR FLARE OBLIGATORIO
    if (zLevel === 'divine') {
      return this.divineDecision(musicalContext)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 3: HUNT/FUZZY DECISION CHECK
    // ═══════════════════════════════════════════════════════════════
    
    const shouldStrike = this.evaluateHuntFuzzy(input)
    
    if (!shouldStrike.should) {
      return this.noEffectDecision(musicalContext, shouldStrike.reason)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 4: CONTEXT-BASED EFFECT SELECTION
    // ═══════════════════════════════════════════════════════════════
    
    const effectType = this.selectEffectForContext(
      sectionType, 
      zLevel, 
      input.energyTrend,
      lastEffectType
    )
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 5: INTENSITY CALCULATION
    // ═══════════════════════════════════════════════════════════════
    
    const intensity = this.calculateIntensity(musicalContext, zLevel)
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 6: BUILD DECISION
    // ═══════════════════════════════════════════════════════════════
    
    // Anti-repetición tracking
    if (effectType === lastEffectType) {
      this.consecutiveSameEffect++
    } else {
      this.consecutiveSameEffect = 0
    }
    
    return {
      effectType,
      intensity,
      reason: `${zLevel.toUpperCase()} moment in ${sectionType} | Z=${musicalContext.zScore.toFixed(2)}σ`,
      confidence: shouldStrike.confidence,
      isOverride: false,
      musicalContext,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Classification helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  private classifyZScore(z: number): 'normal' | 'elevated' | 'epic' | 'divine' {
    const { zScoreThresholds: t } = this.config
    if (z >= t.divine) return 'divine'
    if (z >= t.epic) return 'epic'
    if (z >= t.elevated) return 'elevated'
    return 'normal'
  }
  
  private calculateCooldown(lastEffectType: string | null): number {
    if (!lastEffectType) return this.config.minCooldownMs
    
    // Cooldown extra si repetimos el mismo efecto
    if (this.consecutiveSameEffect > 0) {
      return this.config.sameEffectCooldownMs * (1 + this.consecutiveSameEffect * 0.5)
    }
    
    return this.config.minCooldownMs
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Hunt/Fuzzy evaluation
  // ─────────────────────────────────────────────────────────────────────────
  
  private evaluateHuntFuzzy(input: ContextualSelectorInput): { 
    should: boolean
    reason: string
    confidence: number 
  } {
    const { huntDecision, fuzzyDecision, musicalContext } = input
    
    // Si el Hunt dice strike con alta confianza, go
    if (huntDecision?.shouldStrike && huntDecision.confidence >= this.config.minHuntConfidence) {
      return {
        should: true,
        reason: `Hunt STRIKE (confidence=${huntDecision.confidence.toFixed(2)})`,
        confidence: huntDecision.confidence,
      }
    }
    
    // Si el Fuzzy dice strike/force_strike, go
    if (fuzzyDecision) {
      if (fuzzyDecision.action === 'force_strike') {
        return {
          should: true,
          reason: `Fuzzy FORCE_STRIKE: ${fuzzyDecision.reasoning}`,
          confidence: fuzzyDecision.confidence,
        }
      }
      if (fuzzyDecision.action === 'strike' && fuzzyDecision.confidence >= 0.7) {
        return {
          should: true,
          reason: `Fuzzy STRIKE: ${fuzzyDecision.reasoning}`,
          confidence: fuzzyDecision.confidence,
        }
      }
    }
    
    // Si Z-Score es epic (>2.8) aunque Hunt/Fuzzy no lo digan, dispararemos algo suave
    if (musicalContext.zScore >= this.config.zScoreThresholds.epic) {
      return {
        should: true,
        reason: `Epic Z-Score bypass (Z=${musicalContext.zScore.toFixed(2)}σ)`,
        confidence: 0.75,
      }
    }
    
    // No disparar
    return {
      should: false,
      reason: `No trigger conditions met (Z=${musicalContext.zScore.toFixed(2)}σ)`,
      confidence: 0,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Effect selection logic
  // ─────────────────────────────────────────────────────────────────────────
  
  private selectEffectForContext(
    sectionType: string,
    zLevel: 'normal' | 'elevated' | 'epic' | 'divine',
    energyTrend: 'rising' | 'stable' | 'falling',
    lastEffectType: string | null
  ): string {
    const palette = SECTION_EFFECT_PALETTE[sectionType] || SECTION_EFFECT_PALETTE['verse']
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 1: DIVINE/EPIC = Primary effect (lo más potente)
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'divine' || zLevel === 'epic') {
      // Evitar repetir el mismo efecto
      if (palette.primary === lastEffectType && this.consecutiveSameEffect >= 2) {
        return palette.secondary
      }
      return palette.primary
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 2: ELEVATED + RISING = Build tension
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated' && energyTrend === 'rising') {
      // Buildup/Bridge: Ghost Breath para tensión
      if (sectionType === 'buildup' || sectionType === 'bridge') {
        return 'ghost_breath'
      }
      // Otros: Tidal Wave para momentum
      return 'tidal_wave'
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 3: ELEVATED + FALLING = Release suave
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated' && energyTrend === 'falling') {
      return 'tidal_wave'  // Ola que baja
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 4: ELEVATED + STABLE = Mantener momentum
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated') {
      // En drop/chorus: strobe para mantener energía
      if (sectionType === 'drop' || sectionType === 'chorus') {
        return lastEffectType === 'strobe_storm' ? 'tidal_wave' : 'strobe_storm'
      }
      return palette.secondary
    }
    
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT: Ambient effect (suave)
    // ═══════════════════════════════════════════════════════════════
    return palette.ambient
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Intensity calculation
  // ─────────────────────────────────────────────────────────────────────────
  
  private calculateIntensity(
    musicalContext: MusicalContext,
    zLevel: 'normal' | 'elevated' | 'epic' | 'divine'
  ): number {
    // Base intensity por nivel de Z
    const baseIntensity: Record<typeof zLevel, number> = {
      normal: 0.4,
      elevated: 0.6,
      epic: 0.85,
      divine: 1.0,
    }
    
    let intensity = baseIntensity[zLevel]
    
    // Modular con energía del audio
    intensity = intensity * (0.7 + musicalContext.energy * 0.3)
    
    // Clamp
    return Math.min(1.0, Math.max(0.2, intensity))
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Decision builders
  // ─────────────────────────────────────────────────────────────────────────
  
  private divineDecision(musicalContext: MusicalContext): ContextualEffectSelection {
    return {
      effectType: 'solar_flare',
      intensity: 1.0,
      reason: `🌩️ DIVINE MOMENT! Z=${musicalContext.zScore.toFixed(2)}σ - SOLAR FLARE MANDATORY`,
      confidence: 0.99,
      isOverride: true,
      musicalContext,
    }
  }
  
  private noEffectDecision(musicalContext: MusicalContext, reason: string): ContextualEffectSelection {
    return {
      effectType: null,
      intensity: 0,
      reason,
      confidence: 0,
      isOverride: false,
      musicalContext,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let selectorInstance: ContextualEffectSelector | null = null

export function getContextualEffectSelector(): ContextualEffectSelector {
  if (!selectorInstance) {
    selectorInstance = new ContextualEffectSelector()
  }
  return selectorInstance
}

export function resetContextualEffectSelector(): void {
  selectorInstance = null
}
