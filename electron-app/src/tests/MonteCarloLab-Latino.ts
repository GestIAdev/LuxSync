/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎲 MONTE CARLO LAB - LATINO LADDER VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🌊 WAVE 1005.6: THE MONTE CARLO SIMULATION
 * 
 * OBJETIVO:
 * Validar estadísticamente THE LATINO LADDER (7 zonas) mediante:
 * - Módulo A: Zone Sweeper (distribución 0.00 → 1.00)
 * - Módulo B: Shadowban Torture (diversidad bajo repetición)
 * 
 * EJECUCIÓN:
 *   npx ts-node --transpile-only src/tests/MonteCarloLab-Latino.ts
 * 
 * @module tests/MonteCarloLab-Latino
 * @version WAVE 1005.6
 */

// ═══════════════════════════════════════════════════════════════════════════
// INLINE DNA REGISTRY (standalone - no external imports)
// ═══════════════════════════════════════════════════════════════════════════

interface EffectDNA {
  aggression: number
  chaos: number
  organicity: number
}

const EFFECT_DNA_REGISTRY: Record<string, EffectDNA> = {
  // WAVE 1009.4: REGGAETON REALITY CHECK - FINAL VISUAL ITERATION
  // Objetivo: HACER VISIBLES glitch_guaguanco, machete_spark, strobe_burst
  
  // SILENCE (0-15%) - Target Center: 0.075
  'amazon_mist': { aggression: 0.05, chaos: 0.15, organicity: 0.80 },
  'ghost_breath': { aggression: 0.13, chaos: 0.25, organicity: 0.80 },
  
  // VALLEY (15-30%) - Target Center: 0.225
  'cumbia_moon': { aggression: 0.21, chaos: 0.20, organicity: 0.80 },
  'tidal_wave': { aggression: 0.28, chaos: 0.25, organicity: 0.65 },
  
  // AMBIENT (30-45%) - Target Center: 0.375
  'corazon_latino': { aggression: 0.37, chaos: 0.25, organicity: 0.65 },
  'strobe_burst': { aggression: 0.43, chaos: 0.25, organicity: 0.45 },
  
  // GENTLE (45-60%) - Target Center: 0.525
  'clave_rhythm': { aggression: 0.48, chaos: 0.20, organicity: 0.70 },
  'tropical_pulse': { aggression: 0.54, chaos: 0.25, organicity: 0.65 },
  
  // ACTIVE (60-75%) - Target Center: 0.675
  'glitch_guaguanco': { aggression: 0.64, chaos: 0.30, organicity: 0.35 },
  'machete_spark': { aggression: 0.70, chaos: 0.20, organicity: 0.30 },
  
  // INTENSE (75-90%) - Target Center: 0.825
  'salsa_fire': { aggression: 0.81, chaos: 0.30, organicity: 0.35 },
  'solar_flare': { aggression: 0.86, chaos: 0.25, organicity: 0.45 },
  
  // PEAK (90-100%) - Target Center: 0.95
  'latina_meltdown': { aggression: 0.97, chaos: 0.20, organicity: 0.20 },
  'strobe_storm': { aggression: 0.93, chaos: 0.75, organicity: 0.15 },
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  /** Total iterations for zone sweeper */
  ZONE_SWEEPER_ITERATIONS: 10000,
  
  /** Repetitions for shadowban torture */
  SHADOWBAN_ITERATIONS: 20,
  
  /** Target energy for shadowban test (ACTIVE zone) */
  SHADOWBAN_ENERGY: 0.70,
  
  /** Maximum consecutive same-effect before fail */
  MAX_CONSECUTIVE_SAME: 5,
}

// ═══════════════════════════════════════════════════════════════════════════
// LATINO EFFECT IDS (14 efectos totales)
// ═══════════════════════════════════════════════════════════════════════════

const LATINO_EFFECTS = Object.keys(EFFECT_DNA_REGISTRY)

// ═══════════════════════════════════════════════════════════════════════════
// ZONE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneDefinition {
  name: string
  emoji: string
  min: number
  max: number
  expected: string[]
}

const ZONES: ZoneDefinition[] = [
  { name: 'SILENCE', emoji: '🌿', min: 0.00, max: 0.15, expected: ['amazon_mist', 'ghost_breath'] },
  { name: 'VALLEY',  emoji: '🌙', min: 0.15, max: 0.30, expected: ['cumbia_moon', 'tidal_wave'] },
  { name: 'AMBIENT', emoji: '💫', min: 0.30, max: 0.45, expected: ['corazon_latino', 'strobe_burst'] },
  { name: 'GENTLE',  emoji: '🎵', min: 0.45, max: 0.60, expected: ['clave_rhythm', 'tropical_pulse'] },
  { name: 'ACTIVE',  emoji: '⚡', min: 0.60, max: 0.75, expected: ['glitch_guaguanco', 'machete_spark'] },
  { name: 'INTENSE', emoji: '🔥', min: 0.75, max: 0.90, expected: ['salsa_fire', 'solar_flare'] },
  { name: 'PEAK',    emoji: '☢️', min: 0.90, max: 1.00, expected: ['latina_meltdown', 'strobe_storm'] },
]

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLIFIED DNA ANALYZER (inline implementation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deriva el DNA objetivo basado en energía
 * Simplificado: Aggression = Energy, Chaos/Organicity derivados
 */
function deriveTargetDNA(energy: number): EffectDNA {
  return {
    aggression: energy,
    // REGGAETON REALITY CHECK: dembow es altamente ordenado → reducir rango de chaos
    chaos: 0.15 + energy * 0.15,   // 0.15-0.30 range (low chaos)
    organicity: 0.8 - energy * 0.5,  // 0.8-0.3 range (más energía = más mecánico)
  }
}

/**
 * Calcula distancia euclidiana PONDERADA 3D entre dos DNAs
 * 🚀 WAVE 1005.10: RELATIVITY UPDATE
 * Aggression tiene 2x peso - la energía es la dimensión primaria
 */
function calculateDistance(a: EffectDNA, b: EffectDNA): number {
  const WEIGHT_AGGRESSION = 2.0
  const WEIGHT_CHAOS = 1.0
  const WEIGHT_ORGANICITY = 1.0
  
  return Math.sqrt(
    Math.pow((a.aggression - b.aggression) * WEIGHT_AGGRESSION, 2) +
    Math.pow((a.chaos - b.chaos) * WEIGHT_CHAOS, 2) +
    Math.pow((a.organicity - b.organicity) * WEIGHT_ORGANICITY, 2)
  )
}

/**
 * Selecciona el mejor efecto basado en DNA match + diversity penalty
 */
function selectBestEffect(
  energy: number,
  effectPool: string[],
  usageCount: Map<string, number>
): { effectId: string; score: number; penalized: boolean } {
  const targetDNA = deriveTargetDNA(energy)
  const MAX_DISTANCE = Math.sqrt(6)  // 🚀 WAVE 1005.10: √6 por cubo ponderado
  
  let bestEffect = effectPool[0]
  let bestScore = -Infinity
  let wasPenalized = false
  
  for (const effectId of effectPool) {
    const effectDNA = EFFECT_DNA_REGISTRY[effectId]
    if (!effectDNA) continue
    
    // Distance to target (lower = better)
    const distance = calculateDistance(effectDNA, targetDNA)
    
    // Convert to score (1 = perfect match, 0 = worst)
    let score = 1 - (distance / MAX_DISTANCE)
    
    // Apply diversity penalty (shadowban)
    const usages = usageCount.get(effectId) || 0
    const diversityFactors = [1.0, 0.7, 0.4, 0.1]
    const diversityFactor = diversityFactors[Math.min(usages, 3)]
    
    const penalized = diversityFactor < 1.0
    score *= diversityFactor
    
    if (score > bestScore) {
      bestScore = score
      bestEffect = effectId
      wasPenalized = penalized
    }
  }
  
  return { effectId: bestEffect, score: bestScore, penalized: wasPenalized }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE A: ZONE SWEEPER
// ═══════════════════════════════════════════════════════════════════════════

interface ZoneStats {
  zone: ZoneDefinition
  effectCounts: Map<string, number>
  totalSelections: number
  expectedHitRate: number
  foreignEffects: string[]
}

function runZoneSweeper(): ZoneStats[] {
  console.log('\n🎯 MODULE A: ZONE SWEEPER')
  console.log('━'.repeat(60))
  console.log(`Running ${CONFIG.ZONE_SWEEPER_ITERATIONS} iterations across energy 0.00 → 1.00\n`)
  
  const zoneStats: ZoneStats[] = ZONES.map(zone => ({
    zone,
    effectCounts: new Map<string, number>(),
    totalSelections: 0,
    expectedHitRate: 0,
    foreignEffects: [],
  }))
  
  for (let i = 0; i < CONFIG.ZONE_SWEEPER_ITERATIONS; i++) {
    // Random energy 0.00 → 1.00
    const energy = Math.random()
    
    // Find zone
    let zoneIndex = ZONES.findIndex(z => energy >= z.min && energy < z.max)
    if (zoneIndex === -1) zoneIndex = ZONES.length - 1  // Edge: energy = 1.00
    
    const stats = zoneStats[zoneIndex]
    
    // Select effect (fresh usage count each iteration for zone test)
    const usageCount = new Map<string, number>()
    const { effectId } = selectBestEffect(energy, LATINO_EFFECTS, usageCount)
    
    // Count
    const current = stats.effectCounts.get(effectId) || 0
    stats.effectCounts.set(effectId, current + 1)
    stats.totalSelections++
    
    // Track foreign
    if (!stats.zone.expected.includes(effectId) && !stats.foreignEffects.includes(effectId)) {
      stats.foreignEffects.push(effectId)
    }
  }
  
  // Calculate hit rates
  for (const stats of zoneStats) {
    let expectedHits = 0
    for (const expected of stats.zone.expected) {
      expectedHits += stats.effectCounts.get(expected) || 0
    }
    stats.expectedHitRate = stats.totalSelections > 0 
      ? (expectedHits / stats.totalSelections) * 100 
      : 0
  }
  
  return zoneStats
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE B: SHADOWBAN TORTURE
// ═══════════════════════════════════════════════════════════════════════════

interface ShadowbanResult {
  iteration: number
  effectId: string
  score: number
  penalized: boolean
  consecutiveCount: number
}

function runShadowbanTorture(): { results: ShadowbanResult[]; passed: boolean; maxConsecutive: number } {
  console.log('\n⚔️ MODULE B: SHADOWBAN TORTURE')
  console.log('━'.repeat(60))
  console.log(`Simulating ${CONFIG.SHADOWBAN_ITERATIONS} consecutive frames at Energy=${CONFIG.SHADOWBAN_ENERGY}`)
  console.log('Expecting diversity mechanism to kick in after 2-3 repetitions\n')
  
  const usageCount = new Map<string, number>()
  const results: ShadowbanResult[] = []
  
  let lastEffect = ''
  let consecutiveCount = 0
  let maxConsecutive = 0
  
  for (let i = 0; i < CONFIG.SHADOWBAN_ITERATIONS; i++) {
    const { effectId, score, penalized } = selectBestEffect(
      CONFIG.SHADOWBAN_ENERGY, 
      LATINO_EFFECTS, 
      usageCount
    )
    
    // Track consecutive
    if (effectId === lastEffect) {
      consecutiveCount++
    } else {
      consecutiveCount = 1
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveCount)
    lastEffect = effectId
    
    // Record usage (persists across iterations)
    const currentUsage = usageCount.get(effectId) || 0
    usageCount.set(effectId, currentUsage + 1)
    
    results.push({
      iteration: i + 1,
      effectId,
      score,
      penalized,
      consecutiveCount,
    })
  }
  
  const passed = maxConsecutive < CONFIG.MAX_CONSECUTIVE_SAME
  
  return { results, passed, maxConsecutive }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateReport(
  zoneStats: ZoneStats[], 
  shadowban: { results: ShadowbanResult[]; passed: boolean; maxConsecutive: number }
): void {
  console.log('\n')
  console.log('═'.repeat(70))
  console.log('🎲 MONTE CARLO REPORT - FIESTA LATINA (N=10,000)')
  console.log('═'.repeat(70))
  
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: ZONE DISTRIBUTION
  // ─────────────────────────────────────────────────────────────────────────
  
  console.log('\n## 1. ZONE DISTRIBUTION ACCURACY\n')
  
  let allZonesPass = true
  
  for (const stats of zoneStats) {
    const { zone, effectCounts, totalSelections, expectedHitRate, foreignEffects } = stats
    
    // Top effects
    const sortedEffects = Array.from(effectCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    
    const effectBreakdown: string[] = []
    for (const [effectId, count] of sortedEffects) {
      const pct = ((count / totalSelections) * 100).toFixed(1)
      const isExpected = zone.expected.includes(effectId)
      effectBreakdown.push(`${effectId}: ${pct}%${isExpected ? '' : ' ⚠️'}`)
    }
    
    // Status
    const status = expectedHitRate >= 70 ? '✅ GREAT' : 
                   expectedHitRate >= 50 ? '✅ PASS' : 
                   expectedHitRate >= 30 ? '⚠️ WEAK' : '❌ FAIL'
    
    if (expectedHitRate < 30) allZonesPass = false
    
    console.log(`[${zone.emoji} ${zone.name.padEnd(8)} ${zone.min.toFixed(2)}-${zone.max.toFixed(2)}] ${status}`)
    console.log(`   Expected: ${zone.expected.join(', ')}`)
    console.log(`   Actual:   ${effectBreakdown.join(', ')}`)
    console.log(`   Hit Rate: ${expectedHitRate.toFixed(1)}% (n=${totalSelections})`)
    if (foreignEffects.length > 0) {
      console.log(`   Foreign:  ${foreignEffects.slice(0, 3).join(', ')} (cross-zone diversity)`)
    }
    console.log('')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: SHADOWBAN MECHANISM
  // ─────────────────────────────────────────────────────────────────────────
  
  console.log('\n## 2. SHADOWBAN MECHANISM (Diversity Test)\n')
  
  let swapCount = 0
  
  for (const result of shadowban.results) {
    const marker = result.penalized ? '🔻 PENALIZED' : ''
    const swapMarker = result.consecutiveCount === 1 && result.iteration > 1 ? '🔄 SWAP' : ''
    
    if (swapMarker) swapCount++
    
    console.log(
      `Iteration ${String(result.iteration).padStart(2)}: ` +
      `${result.effectId.padEnd(18)} ` +
      `(Score: ${result.score.toFixed(3)}) ` +
      `${marker} ${swapMarker}`
    )
  }
  
  console.log(`\nMax Consecutive Same Effect: ${shadowban.maxConsecutive}`)
  console.log(`Total Swaps Detected: ${swapCount}`)
  console.log(`Shadowban Status: ${shadowban.passed ? '✅ WORKING' : '❌ BROKEN'}`)
  
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: FINAL VERDICT
  // ─────────────────────────────────────────────────────────────────────────
  
  console.log('\n')
  console.log('═'.repeat(70))
  
  const overallPass = allZonesPass && shadowban.passed
  
  if (overallPass) {
    console.log('🎺 RESULTADO FINAL: ✅ PASS')
    console.log('   THE LATINO LADDER está correctamente calibrada.')
    console.log('   El Shadowban funciona correctamente.')
  } else {
    console.log('🎺 RESULTADO FINAL: ❌ FAIL')
    if (!allZonesPass) console.log('   - Alguna zona tiene hit rate < 30%')
    if (!shadowban.passed) console.log(`   - Shadowban roto (${shadowban.maxConsecutive} consecutivos > ${CONFIG.MAX_CONSECUTIVE_SAME})`)
  }
  
  console.log('═'.repeat(70))
  
  // ─────────────────────────────────────────────────────────────────────────
  // DNA REFERENCE TABLE
  // ─────────────────────────────────────────────────────────────────────────
  
  console.log('\n## DNA REFERENCE TABLE\n')
  console.log('| Effect           | Aggression | Zone     |')
  console.log('|------------------|------------|----------|')
  
  for (const effectId of LATINO_EFFECTS) {
    const dna = EFFECT_DNA_REGISTRY[effectId]
    if (dna) {
      const zone = ZONES.find(z => z.expected.includes(effectId))
      console.log(`| ${effectId.padEnd(16)} | ${dna.aggression.toFixed(2).padStart(10)} | ${(zone?.name || 'N/A').padEnd(8)} |`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

function main(): void {
  console.log('╔════════════════════════════════════════════════════════════════════╗')
  console.log('║  🎲 MONTE CARLO LAB - FIESTA LATINA VALIDATION                     ║')
  console.log('║  WAVE 1005.6 - THE LATINO LADDER                                   ║')
  console.log('╚════════════════════════════════════════════════════════════════════╝')
  
  // Run simulations
  const zoneStats = runZoneSweeper()
  const shadowbanResults = runShadowbanTorture()
  
  // Generate report
  generateReport(zoneStats, shadowbanResults)
}

// Execute
main()
