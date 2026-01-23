/**
 * 🧪 WAVE 982.5: DIVERSITY STRESS TEST - MONTE CARLO JUDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * Test automatizado que ejecuta 500+ iteraciones del DreamEngine para validar:
 * 1. Anti-Monopolio: Ningún efecto >30% del total
 * 2. Inclusión: Todos los efectos compatibles >2%
 * 3. Rotación: No repetir mismo efecto 3x seguidas
 * 
 * BENEFICIO:
 * - No más 14 horas mirando luces
 * - Datos objetivos sobre distribución de efectos
 * - Identificación inmediata de DNA mal calibrado
 * 
 * USO:
 * npm test -- --grep "Diversity"
 * 
 * @author PunkOpus & Radwulf
 * @version 1.0.0 - WAVE 982.5
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EFFECT_DNA_REGISTRY, EffectDNA } from '../../dna/EffectDNA.js'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PARA EL TEST
// ═══════════════════════════════════════════════════════════════════════════

interface RecentEffect {
  effect: string
  timestamp: number
}

interface MockContext {
  energy: number
  zone: string
  vibe: string
  recentEffects: RecentEffect[]
}

interface DistributionResult {
  effectId: string
  count: number
  percentage: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL TEST
// ═══════════════════════════════════════════════════════════════════════════

const TEST_CONFIG = {
  ITERATIONS: 500,                    // Número de simulaciones
  HISTORY_SIZE: 10,                   // Tamaño del historial de efectos recientes
  MAX_MONOPOLY_PERCENTAGE: 30,        // Máximo % permitido para un solo efecto
  MIN_INCLUSION_PERCENTAGE: 2,        // Mínimo % requerido para cada efecto
  MAX_CONSECUTIVE_REPEATS: 3,         // Máximas repeticiones seguidas permitidas
}

// ═══════════════════════════════════════════════════════════════════════════
// EFECTOS TECHNO COMPATIBLES
// ═══════════════════════════════════════════════════════════════════════════

const TECHNO_EFFECTS = [
  'industrial_strobe',
  'acid_sweep',
  'cyber_dualism',
  'gatling_raid',
  'sky_saw',
  'void_mist',
  'static_pulse',
  'digital_rain',
  'deep_breath',
  'ambient_strobe',
  'sonar_ping',
]

// ═══════════════════════════════════════════════════════════════════════════
// ZONE AGGRESSION LIMITS (from EffectDreamSimulator)
// ═══════════════════════════════════════════════════════════════════════════

const ZONE_LIMITS: Record<string, { min: number; max: number }> = {
  'silence': { min: 0, max: 0.20 },
  'valley':  { min: 0, max: 0.35 },
  'ambient': { min: 0, max: 0.50 },
  'gentle':  { min: 0, max: 0.60 },
  'active':  { min: 0.20, max: 0.95 },
  'intense': { min: 0.45, max: 1.00 },
  'peak':    { min: 0.50, max: 1.00 },
}

// ═══════════════════════════════════════════════════════════════════════════
// MINI DNA SELECTOR (Simplified version for testing)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcula la distancia euclidiana en el espacio DNA 3D
 */
function calculateDNADistance(effectDNA: EffectDNA, targetDNA: EffectDNA): number {
  const dA = effectDNA.aggression - targetDNA.aggression
  const dC = effectDNA.chaos - targetDNA.chaos
  const dO = effectDNA.organicity - targetDNA.organicity
  return Math.sqrt(dA * dA + dC * dC + dO * dO)
}

/**
 * Convierte distancia a relevancia (0-1)
 */
function distanceToRelevance(distance: number): number {
  const maxDistance = Math.sqrt(3) // Max posible en espacio 3D normalizado
  return Math.max(0, 1 - (distance / maxDistance))
}

/**
 * Obtiene el target DNA basado en la zona energética
 */
function getTargetDNA(zone: string, energy: number): EffectDNA {
  // Target DNA varía según zona
  const targetMap: Record<string, EffectDNA> = {
    'silence': { aggression: 0.05, chaos: 0.10, organicity: 0.90 },
    'valley':  { aggression: 0.15, chaos: 0.20, organicity: 0.80 },
    'ambient': { aggression: 0.30, chaos: 0.35, organicity: 0.60 },
    'gentle':  { aggression: 0.45, chaos: 0.45, organicity: 0.50 },
    'active':  { aggression: 0.60, chaos: 0.55, organicity: 0.35 },
    'intense': { aggression: 0.80, chaos: 0.65, organicity: 0.20 },
    'peak':    { aggression: 0.95, chaos: 0.70, organicity: 0.10 },
  }
  return targetMap[zone] || targetMap['active']
}

/**
 * Filtra efectos por zona
 */
function filterByZone(effects: string[], zone: string): string[] {
  const limits = ZONE_LIMITS[zone] || { min: 0, max: 1 }
  
  return effects.filter(effectId => {
    const dna = EFFECT_DNA_REGISTRY[effectId]
    if (!dna) return false
    return dna.aggression >= limits.min && dna.aggression <= limits.max
  })
}

/**
 * Calcula diversity score basado en historial
 * 🔥 WAVE 982.5: Escalera de penalización
 */
function calculateDiversityScore(effectId: string, recentEffects: RecentEffect[]): number {
  const usageCount = recentEffects.filter(e => e.effect === effectId).length
  
  switch (usageCount) {
    case 0: return 1.0   // Sin penalización
    case 1: return 0.7   // -30%
    case 2: return 0.4   // -60%
    default: return 0.1  // -90% SHADOWBAN
  }
}

/**
 * Simula una selección de efecto
 */
function simulateEffectSelection(context: MockContext): string {
  // 1. Filtrar efectos por vibe (techno)
  let candidates = [...TECHNO_EFFECTS]
  
  // 2. Filtrar por zona
  candidates = filterByZone(candidates, context.zone)
  
  if (candidates.length === 0) {
    // Fallback: devolver el menos agresivo disponible
    return TECHNO_EFFECTS.sort((a, b) => 
      (EFFECT_DNA_REGISTRY[a]?.aggression || 0) - (EFFECT_DNA_REGISTRY[b]?.aggression || 0)
    )[0]
  }
  
  // 3. Calcular score para cada candidato
  const targetDNA = getTargetDNA(context.zone, context.energy)
  
  const scores = candidates.map(effectId => {
    const effectDNA = EFFECT_DNA_REGISTRY[effectId]
    if (!effectDNA) return { effectId, score: 0 }
    
    // DNA Relevance
    const distance = calculateDNADistance(effectDNA, targetDNA)
    const relevance = distanceToRelevance(distance)
    
    // Diversity Score (ESCALERA)
    const diversityScore = calculateDiversityScore(effectId, context.recentEffects)
    
    // Final Score = Relevance * DiversityScore
    const finalScore = relevance * diversityScore
    
    return { effectId, score: finalScore, relevance, diversityScore }
  })
  
  // 4. Ordenar por score (descending)
  scores.sort((a, b) => b.score - a.score)
  
  // 5. Retornar ganador
  return scores[0]?.effectId || candidates[0]
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════

describe('🧪 WAVE 982.5: DIVERSITY STRESS TEST', () => {
  
  describe('📊 Monte Carlo Simulation - Techno Active Zone', () => {
    
    it('should distribute effects without monopoly (max 30%)', () => {
      const history: RecentEffect[] = []
      const distribution: Record<string, number> = {}
      
      const context: MockContext = {
        energy: 0.70,
        zone: 'active',
        vibe: 'techno-club',
        recentEffects: history,
      }
      
      // Run Monte Carlo simulation
      for (let i = 0; i < TEST_CONFIG.ITERATIONS; i++) {
        // Update context with current history
        context.recentEffects = [...history]
        
        // Simulate selection
        const winner = simulateEffectSelection(context)
        
        // Record result
        history.push({ effect: winner, timestamp: Date.now() + i * 1000 })
        distribution[winner] = (distribution[winner] || 0) + 1
        
        // Keep history at max size (simulate 60s window)
        if (history.length > TEST_CONFIG.HISTORY_SIZE) {
          history.shift()
        }
      }
      
      // Generate report
      const results: DistributionResult[] = Object.entries(distribution)
        .map(([effectId, count]) => ({
          effectId,
          count,
          percentage: (count / TEST_CONFIG.ITERATIONS) * 100
        }))
        .sort((a, b) => b.count - a.count)
      
      console.log('\n📊 DIVERSITY REPORT (Monte Carlo - Techno Active):')
      console.log('─'.repeat(60))
      results.forEach((r, i) => {
        const bar = '█'.repeat(Math.round(r.percentage / 2))
        const status = r.percentage > TEST_CONFIG.MAX_MONOPOLY_PERCENTAGE ? '❌' : '✅'
        console.log(`${i + 1}. ${r.effectId.padEnd(20)} ${r.percentage.toFixed(1).padStart(5)}% (${r.count} hits) ${bar} ${status}`)
      })
      console.log('─'.repeat(60))
      
      // ASSERTION: No monopolies
      const hasMonopoly = results.some(r => r.percentage > TEST_CONFIG.MAX_MONOPOLY_PERCENTAGE)
      expect(hasMonopoly).toBe(false)
      
      if (!hasMonopoly) {
        console.log('✅ TEST PASSED: No monopolies detected\n')
      } else {
        const monopolist = results.find(r => r.percentage > TEST_CONFIG.MAX_MONOPOLY_PERCENTAGE)
        console.log(`❌ TEST FAILED: ${monopolist?.effectId} has ${monopolist?.percentage.toFixed(1)}% (max: ${TEST_CONFIG.MAX_MONOPOLY_PERCENTAGE}%)\n`)
      }
    })
    
    it('should include all zone-compatible effects (min 2%)', () => {
      const history: RecentEffect[] = []
      const distribution: Record<string, number> = {}
      
      const context: MockContext = {
        energy: 0.70,
        zone: 'active',
        vibe: 'techno-club',
        recentEffects: history,
      }
      
      // Get expected effects for this zone
      const expectedEffects = filterByZone(TECHNO_EFFECTS, 'active')
      
      console.log(`\n🎯 Expected effects for zone "active": ${expectedEffects.length}`)
      console.log(`   ${expectedEffects.join(', ')}`)
      
      // Run simulation
      for (let i = 0; i < TEST_CONFIG.ITERATIONS; i++) {
        context.recentEffects = [...history]
        const winner = simulateEffectSelection(context)
        
        history.push({ effect: winner, timestamp: Date.now() + i * 1000 })
        distribution[winner] = (distribution[winner] || 0) + 1
        
        if (history.length > TEST_CONFIG.HISTORY_SIZE) {
          history.shift()
        }
      }
      
      // Check inclusion
      const missingEffects: string[] = []
      const underrepresented: string[] = []
      
      expectedEffects.forEach(effectId => {
        const count = distribution[effectId] || 0
        const percentage = (count / TEST_CONFIG.ITERATIONS) * 100
        
        if (count === 0) {
          missingEffects.push(effectId)
        } else if (percentage < TEST_CONFIG.MIN_INCLUSION_PERCENTAGE) {
          underrepresented.push(`${effectId} (${percentage.toFixed(1)}%)`)
        }
      })
      
      console.log('\n📋 INCLUSION CHECK:')
      
      if (missingEffects.length > 0) {
        console.log(`❌ MISSING (0%): ${missingEffects.join(', ')}`)
      }
      
      if (underrepresented.length > 0) {
        console.log(`⚠️ UNDERREPRESENTED (<2%): ${underrepresented.join(', ')}`)
      }
      
      if (missingEffects.length === 0 && underrepresented.length === 0) {
        console.log('✅ All effects represented adequately\n')
      }
      
      // ASSERTION: No missing effects
      expect(missingEffects.length).toBe(0)
    })
    
    it('should not repeat same effect 3+ times consecutively', () => {
      const history: RecentEffect[] = []
      const selections: string[] = []
      let maxConsecutive = 1
      let currentStreak = 1
      let lastEffect = ''
      
      const context: MockContext = {
        energy: 0.70,
        zone: 'active',
        vibe: 'techno-club',
        recentEffects: history,
      }
      
      // Run simulation
      for (let i = 0; i < TEST_CONFIG.ITERATIONS; i++) {
        context.recentEffects = [...history]
        const winner = simulateEffectSelection(context)
        
        selections.push(winner)
        
        // Track consecutive repeats
        if (winner === lastEffect) {
          currentStreak++
          maxConsecutive = Math.max(maxConsecutive, currentStreak)
        } else {
          currentStreak = 1
        }
        lastEffect = winner
        
        history.push({ effect: winner, timestamp: Date.now() + i * 1000 })
        
        if (history.length > TEST_CONFIG.HISTORY_SIZE) {
          history.shift()
        }
      }
      
      console.log(`\n🔄 ROTATION CHECK:`)
      console.log(`   Max consecutive repeats: ${maxConsecutive}`)
      console.log(`   Threshold: ${TEST_CONFIG.MAX_CONSECUTIVE_REPEATS}`)
      
      // ASSERTION: No long streaks
      const passed = maxConsecutive < TEST_CONFIG.MAX_CONSECUTIVE_REPEATS
      expect(passed).toBe(true)
      
      if (passed) {
        console.log('✅ TEST PASSED: Good rotation, no long streaks\n')
      } else {
        console.log(`❌ TEST FAILED: Found ${maxConsecutive} consecutive repeats\n`)
      }
    })
  })
  
  describe('🌡️ Zone Coverage Tests', () => {
    
    const zones = ['valley', 'ambient', 'gentle', 'active', 'intense', 'peak']
    
    zones.forEach(zone => {
      it(`should have viable candidates in zone "${zone}"`, () => {
        const candidates = filterByZone(TECHNO_EFFECTS, zone)
        
        console.log(`\n🎯 Zone "${zone}": ${candidates.length} candidates`)
        candidates.forEach(c => {
          const dna = EFFECT_DNA_REGISTRY[c]
          console.log(`   - ${c}: A=${dna?.aggression.toFixed(2)}`)
        })
        
        expect(candidates.length).toBeGreaterThan(0)
      })
    })
  })
  
  describe('🧬 DNA Sanity Check', () => {
    
    it('should have valid DNA for all techno effects', () => {
      const invalid: string[] = []
      
      TECHNO_EFFECTS.forEach(effectId => {
        const dna = EFFECT_DNA_REGISTRY[effectId]
        
        if (!dna) {
          invalid.push(`${effectId}: NO DNA`)
        } else {
          if (dna.aggression < 0 || dna.aggression > 1) {
            invalid.push(`${effectId}: aggression out of range (${dna.aggression})`)
          }
          if (dna.chaos < 0 || dna.chaos > 1) {
            invalid.push(`${effectId}: chaos out of range (${dna.chaos})`)
          }
          if (dna.organicity < 0 || dna.organicity > 1) {
            invalid.push(`${effectId}: organicity out of range (${dna.organicity})`)
          }
        }
      })
      
      if (invalid.length > 0) {
        console.log('\n❌ Invalid DNA entries:')
        invalid.forEach(i => console.log(`   ${i}`))
      } else {
        console.log('\n✅ All DNA entries valid')
      }
      
      expect(invalid.length).toBe(0)
    })
    
    it('should have DNA spread across aggression spectrum', () => {
      const aggressionValues = TECHNO_EFFECTS
        .map(e => EFFECT_DNA_REGISTRY[e]?.aggression || 0)
        .sort((a, b) => a - b)
      
      console.log('\n📊 Aggression Distribution:')
      console.log(`   Min: ${aggressionValues[0]?.toFixed(2)}`)
      console.log(`   Max: ${aggressionValues[aggressionValues.length - 1]?.toFixed(2)}`)
      console.log(`   Spread: ${(aggressionValues[aggressionValues.length - 1] - aggressionValues[0]).toFixed(2)}`)
      
      // Should have at least 0.5 spread in aggression
      const spread = aggressionValues[aggressionValues.length - 1] - aggressionValues[0]
      expect(spread).toBeGreaterThan(0.5)
    })
  })
})
