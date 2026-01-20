/**
 * 🎨 VISUAL ETHICAL VALUES
 * "Los 7 Principios que guían la Conciencia Visual"
 * 
 * WAVE 900.2 - Phase 2: Ethical Core
 * 
 * @module VisualEthicalValues
 * @description Define los valores éticos para decisiones de efectos visuales.
 *              Transformación de ética médica (DentiAgest) → ética visual (LuxSync).
 * 
 * TRANSFORMACIÓN:
 * - Patient Safety → Audience Safety (anti-epilepsia, fatiga)
 * - Data Integrity → Vibe Coherence (no solar_flare en Techno)
 * - Fairness → Effect Diversity (no monotonía)
 * 
 * FILOSOFÍA:
 * "La belleza sin ética es vanidad. La ética sin belleza es dogma."
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */

import type { AudienceSafetyContext } from '../dream/AudienceSafetyContext'
import type { EffectCandidate } from '../dream/EffectDreamSimulator'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EthicalValue {
  name: 'audience_safety' | 'vibe_coherence' | 'effect_diversity' | 
        'aesthetic_beauty' | 'temporal_balance' | 'effect_justice' | 'risk_creativity'
  weight: number                    // 0-1, importancia relativa
  description: string
  rules: EthicalRule[]
}

export interface EthicalRule {
  id: string
  check: (context: AudienceSafetyContext, effect: EffectCandidate) => RuleResult
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface RuleResult {
  passed: boolean
  reason?: string
  boost?: number                    // Bonus positivo (0-1)
  penalty?: number                  // Penalización (0-1)
  suggestion?: string
}

// ═══════════════════════════════════════════════════════════════
// SEVERITY PENALTIES
// ═══════════════════════════════════════════════════════════════

export const SEVERITY_PENALTIES = {
  'low': 0.1,      // -10%
  'medium': 0.3,   // -30%
  'high': 0.6,     // -60%
  'critical': 1.0  // -100% (BLOCK)
} as const

// ═══════════════════════════════════════════════════════════════
// VALUE 1: AUDIENCE SAFETY (Weight: 1.0)
// ═══════════════════════════════════════════════════════════════

const AUDIENCE_SAFETY: EthicalValue = {
  name: 'audience_safety',
  weight: 1.0, // MÁXIMA PRIORIDAD
  description: 'Proteger salud visual y neurológica de la audiencia',
  rules: [
    {
      id: 'epilepsy_protection',
      severity: 'critical',
      check: (context, effect) => {
        // Si epilepsy mode activo, bloquear strobes rápidos
        if (context.epilepsyMode && effect.effect.includes('strobe')) {
          return {
            passed: false,
            reason: 'Epilepsy mode blocks strobes',
            penalty: 1.0
          }
        }
        return { passed: true }
      }
    },
    {
      id: 'fatigue_protection',
      severity: 'high',
      check: (context, effect) => {
        // Si fatiga > 0.8, bloquear efectos intensos
        if (context.audienceFatigue > 0.8 && effect.intensity > 0.7) {
          return {
            passed: false,
            reason: `Audience fatigue critical (${(context.audienceFatigue * 100).toFixed(1)}%)`,
            penalty: 0.6
          }
        }
        
        // Si fatiga > 0.6, reducir intensidad
        if (context.audienceFatigue > 0.6 && effect.intensity > 0.8) {
          return {
            passed: true,
            reason: 'Fatigue moderate - intensity should be reduced',
            suggestion: 'Reduce intensity to 0.7 or lower',
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'luminosity_budget',
      severity: 'high',
      check: (context, effect) => {
        // Límite de luminosidad acumulada por minuto
        const MINUTE_MS = 60000
        const MAX_INTENSITY_PER_MINUTE = 25.0
        
        const recentIntensity = context.recentEffects
          .filter(e => Date.now() - e.timestamp < MINUTE_MS)
          .reduce((sum, e) => sum + e.intensity, 0)
        
        if (recentIntensity + effect.intensity > MAX_INTENSITY_PER_MINUTE) {
          return {
            passed: false,
            reason: `Luminosity budget exceeded: ${recentIntensity.toFixed(1)}/25.0`,
            penalty: 0.6
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'intense_effect_rate_limit',
      severity: 'medium',
      check: (context, effect) => {
        // No disparar efectos intensos si último fue hace <2s
        const MIN_INTERVAL_MS = 2000
        
        if (effect.intensity > 0.7 && 
            Date.now() - context.lastIntenseEffect < MIN_INTERVAL_MS) {
          return {
            passed: false,
            reason: `Too soon after last intense effect (${Date.now() - context.lastIntenseEffect}ms)`,
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 2: VIBE COHERENCE (Weight: 0.9)
// ═══════════════════════════════════════════════════════════════

const VIBE_COHERENCE: EthicalValue = {
  name: 'vibe_coherence',
  weight: 0.9,
  description: 'Respetar identidad del vibe (no solar_flare en Techno)',
  rules: [
    {
      id: 'vibe_effect_match',
      severity: 'critical',
      check: (context, effect) => {
        // TECHNO NO DEBE USAR SOLAR_FLARE (HEREJÍA ABSOLUTA)
        if (context.vibe.includes('techno') && effect.effect === 'solar_flare') {
          return {
            passed: false,
            reason: 'HERESY: solar_flare forbidden in Techno',
            penalty: 1.0
          }
        }
        
        // Latino NO debe usar industrial_strobe (a menos que sea drop épico)
        if (context.vibe.includes('latino') && 
            effect.effect === 'industrial_strobe' && 
            context.energy < 0.85) {
          return {
            passed: false,
            reason: 'industrial_strobe too aggressive for Latino (energy < 0.85)',
            penalty: 0.6
          }
        }
        
        // Chill NO debe usar strobes agresivos
        if (context.vibe.includes('chill') && 
            effect.effect.includes('strobe') && 
            effect.intensity > 0.5) {
          return {
            passed: false,
            reason: 'Strobe too aggressive for Chill vibe',
            penalty: 0.6
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'vibe_category_bonus',
      severity: 'low',
      check: (context, effect) => {
        // Boost efectos que matchen perfectamente con vibe
        
        // Techno + industrial effects
        if (context.vibe.includes('techno')) {
          const technoEffects = ['industrial_strobe', 'acid_sweep', 'cyber_dualism', 'laser_sweep']
          if (technoEffects.includes(effect.effect)) {
            return {
              passed: true,
              boost: 0.15,
              reason: 'Perfect Techno match'
            }
          }
        }
        
        // Latino + organic effects
        if (context.vibe.includes('latino')) {
          const latinoEffects = ['solar_flare', 'fire_burst', 'rainbow_spiral']
          if (latinoEffects.includes(effect.effect)) {
            return {
              passed: true,
              boost: 0.15,
              reason: 'Perfect Latino match'
            }
          }
        }
        
        // Chill + ambient effects
        if (context.vibe.includes('chill')) {
          const chillEffects = ['borealis_wave', 'tidal_wave', 'ice_cascade']
          if (chillEffects.includes(effect.effect)) {
            return {
              passed: true,
              boost: 0.15,
              reason: 'Perfect Chill match'
            }
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 3: EFFECT DIVERSITY (Weight: 0.8)
// ═══════════════════════════════════════════════════════════════

const EFFECT_DIVERSITY: EthicalValue = {
  name: 'effect_diversity',
  weight: 0.8,
  description: 'Evitar monotonía, forzar variedad',
  rules: [
    {
      id: 'abuse_prevention',
      severity: 'medium',
      check: (context, effect) => {
        // Si el efecto se usó >50% de las últimas 20, bloquear
        const last20 = context.recentEffects.slice(-20)
        if (last20.length < 10) return { passed: true } // Poco historial
        
        const usageCount = last20.filter(e => e.effect === effect.effect).length
        const usageRate = usageCount / last20.length
        
        if (usageRate > 0.5) {
          return {
            passed: false,
            reason: `${effect.effect} overused: ${usageCount}/20 times (${(usageRate * 100).toFixed(1)}%)`,
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'forgotten_effect_boost',
      severity: 'low',
      check: (context, effect) => {
        // Si el efecto NO se usó en últimos 50, +boost
        const last50 = context.recentEffects.slice(-50)
        if (last50.length < 20) return { passed: true }
        
        const used = last50.some(e => e.effect === effect.effect)
        
        if (!used) {
          return {
            passed: true,
            boost: 0.2,
            reason: `${effect.effect} is forgotten - diversity boost`
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'consecutive_same_effect',
      severity: 'high',
      check: (context, effect) => {
        // No permitir mismo efecto 3 veces seguidas
        const last3 = context.recentEffects.slice(-3)
        if (last3.length < 3) return { passed: true }
        
        const allSame = last3.every(e => e.effect === effect.effect)
        
        if (allSame) {
          return {
            passed: false,
            reason: `${effect.effect} used 3 times consecutively - monotony detected`,
            penalty: 0.6
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 4: AESTHETIC BEAUTY (Weight: 0.85)
// ═══════════════════════════════════════════════════════════════

const AESTHETIC_BEAUTY: EthicalValue = {
  name: 'aesthetic_beauty',
  weight: 0.85,
  description: 'Priorizar belleza armónica sobre impacto bruto',
  rules: [
    {
      id: 'beauty_threshold',
      severity: 'medium',
      check: (context, effect) => {
        // Si projectedBeauty < 0.4, rechazar (a menos que sea momento crítico)
        if (effect.projectedBeauty && 
            effect.projectedBeauty < 0.4 && 
            context.energy < 0.8) {
          return {
            passed: false,
            reason: `Low projected beauty: ${effect.projectedBeauty.toFixed(2)}`,
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'beauty_bonus',
      severity: 'low',
      check: (context, effect) => {
        // Boost efectos con alta belleza proyectada
        if (effect.projectedBeauty && effect.projectedBeauty > 0.8) {
          return {
            passed: true,
            boost: 0.1,
            reason: `High projected beauty: ${effect.projectedBeauty.toFixed(2)}`
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 5: TEMPORAL BALANCE (Weight: 0.7)
// ═══════════════════════════════════════════════════════════════

const TEMPORAL_BALANCE: EthicalValue = {
  name: 'temporal_balance',
  weight: 0.7,
  description: 'Evitar cambios demasiado rápidos o patrones predecibles',
  rules: [
    {
      id: 'temporal_pattern_break',
      severity: 'medium',
      check: (context, effect) => {
        // Si BiasTracker detecta patrón temporal, romperlo
        if (context.biasReport?.biases.some(b => b.type === 'temporal_pattern')) {
          // Introducir delay o rechazar
          return {
            passed: false,
            reason: 'Breaking temporal pattern detected by BiasTracker',
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'rapid_fire_prevention',
      severity: 'low',
      check: (context, effect) => {
        // No más de 5 efectos en 10 segundos
        const TEN_SECONDS_MS = 10000
        const recentInWindow = context.recentEffects.filter(e => 
          Date.now() - e.timestamp < TEN_SECONDS_MS
        )
        
        if (recentInWindow.length >= 5) {
          return {
            passed: false,
            reason: 'Rapid fire detected: 5 effects in 10s',
            penalty: 0.1
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 6: EFFECT JUSTICE (Weight: 0.6)
// ═══════════════════════════════════════════════════════════════

const EFFECT_JUSTICE: EthicalValue = {
  name: 'effect_justice',
  weight: 0.6,
  description: 'Todos los efectos merecen oportunidad',
  rules: [
    {
      id: 'forgotten_effect_rescue',
      severity: 'low',
      check: (context, effect) => {
        // Si hay efectos olvidados y energía baja, sugerir usarlos
        const forgotten = context.biasReport?.forgottenEffects ?? []
        
        if (forgotten.length > 0 && 
            context.energy < 0.6 && 
            forgotten.includes(effect.effect)) {
          return {
            passed: true,
            boost: 0.15,
            reason: `Rescuing forgotten effect: ${effect.effect}`,
            suggestion: 'Low energy moment - perfect for forgotten effects'
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'neglected_effect_priority',
      severity: 'low',
      check: (context, effect) => {
        // Si el efecto está en la lista de "neglected" del BiasReport
        const neglectedBias = context.biasReport?.biases.find(
          b => b.type === 'effect_neglect' && b.description.includes(effect.effect)
        )
        
        if (neglectedBias) {
          return {
            passed: true,
            boost: 0.1,
            reason: `Priority boost for neglected effect: ${effect.effect}`
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// VALUE 7: RISK CREATIVITY (Weight: 0.5)
// ═══════════════════════════════════════════════════════════════

const RISK_CREATIVITY: EthicalValue = {
  name: 'risk_creativity',
  weight: 0.5,
  description: 'Permitir sorpresas controladas',
  rules: [
    {
      id: 'allow_experimental',
      severity: 'low',
      check: (context, effect) => {
        // 10% de las veces, permitir efecto "fuera de zona"
        if (Math.random() < 0.1 && effect.riskLevel && effect.riskLevel < 0.7) {
          return {
            passed: true,
            boost: 0.1,
            reason: 'Experimental effect allowed (10% creativity budget)'
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'risk_ceiling',
      severity: 'medium',
      check: (context, effect) => {
        // Si riskLevel > 0.85, rechazar (demasiado caótico)
        if (effect.riskLevel && effect.riskLevel > 0.85) {
          return {
            passed: false,
            reason: `Risk too high: ${effect.riskLevel.toFixed(2)}`,
            penalty: 0.3
          }
        }
        
        return { passed: true }
      }
    },
    {
      id: 'creative_moment_boost',
      severity: 'low',
      check: (context, effect) => {
        // En drops o momentos épicos, permitir más riesgo
        if (context.energy > 0.85 && effect.riskLevel && effect.riskLevel < 0.8) {
          return {
            passed: true,
            boost: 0.05,
            reason: 'High energy moment - creative risk encouraged'
          }
        }
        
        return { passed: true }
      }
    }
  ]
}

// ═══════════════════════════════════════════════════════════════
// EXPORT ALL VALUES
// ═══════════════════════════════════════════════════════════════

export const VISUAL_ETHICAL_VALUES: EthicalValue[] = [
  AUDIENCE_SAFETY,
  VIBE_COHERENCE,
  EFFECT_DIVERSITY,
  AESTHETIC_BEAUTY,
  TEMPORAL_BALANCE,
  EFFECT_JUSTICE,
  RISK_CREATIVITY
]

// ═══════════════════════════════════════════════════════════════
// HELPER: Get value by name
// ═══════════════════════════════════════════════════════════════

export function getValueByName(name: string): EthicalValue | undefined {
  return VISUAL_ETHICAL_VALUES.find(v => v.name === name)
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Log all values
// ═══════════════════════════════════════════════════════════════

export function logEthicalValues(): void {
  console.log('[ETHICAL_VALUES] 🎨 Visual Ethical Framework:')
  for (const value of VISUAL_ETHICAL_VALUES) {
    console.log(`  ${value.name}: weight=${value.weight.toFixed(2)} | ${value.rules.length} rules`)
  }
}
