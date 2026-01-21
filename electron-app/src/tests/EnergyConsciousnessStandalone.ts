/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔋 WAVE 934: ENERGY CONSCIOUSNESS STANDALONE TEST
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Test standalone que simula la lógica del EnergyConsciousnessEngine
 * para verificar calibración sin necesidad de importar módulos complejos.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS Y CONSTANTES (copiados de EnergyConsciousnessEngine)
// ═══════════════════════════════════════════════════════════════════════════

type EnergyZone = 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'

const ZONE_THRESHOLDS = {
  silence: 0.05,
  valley: 0.15,
  ambient: 0.30,
  gentle: 0.45,
  active: 0.60,
  intense: 0.80,
  peak: 1.0,
}

const LOW_ZONES: EnergyZone[] = ['silence', 'valley']
const HIGH_ZONES: EnergyZone[] = ['active', 'intense', 'peak']

// Timing asimétrico (en frames @ ~60fps, pero simplificado aquí)
const FRAMES_TO_ENTER_SILENCE = 30  // ~500ms lento para entrar
const FRAMES_TO_EXIT_SILENCE = 3    // ~50ms instantáneo para salir

interface EnergyContext {
  zone: EnergyZone
  absolute: number
  smoothed: number
  sustainedLow: boolean
  framesInCurrentZone: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULADOR DE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function classifyZone(energy: number): EnergyZone {
  if (energy < ZONE_THRESHOLDS.silence) return 'silence'
  if (energy < ZONE_THRESHOLDS.valley) return 'valley'
  if (energy < ZONE_THRESHOLDS.ambient) return 'ambient'
  if (energy < ZONE_THRESHOLDS.gentle) return 'gentle'
  if (energy < ZONE_THRESHOLDS.active) return 'active'
  if (energy < ZONE_THRESHOLDS.intense) return 'intense'
  return 'peak'
}

function simulateEngine(energySequence: number[]): EnergyContext {
  let currentZone: EnergyZone = 'ambient'
  let smoothedEnergy = 0.5
  let framesInZone = 0
  let sustainedLow = false
  let framesLow = 0
  
  for (const energy of energySequence) {
    // Smoothing
    smoothedEnergy = smoothedEnergy * 0.8 + energy * 0.2
    
    // Classify raw zone
    const rawZone = classifyZone(energy)
    
    // Asymmetric timing
    const isTransitioningToLow = LOW_ZONES.includes(rawZone) && !LOW_ZONES.includes(currentZone)
    const isTransitioningToHigh = HIGH_ZONES.includes(rawZone) && LOW_ZONES.includes(currentZone)
    
    if (isTransitioningToLow) {
      // Lento para entrar en silencio
      framesInZone++
      if (framesInZone >= FRAMES_TO_ENTER_SILENCE) {
        currentZone = rawZone
        framesInZone = 0
      }
    } else if (isTransitioningToHigh) {
      // INSTANTÁNEO para salir de silencio
      currentZone = rawZone
      framesInZone = 0
    } else if (rawZone === currentZone) {
      framesInZone++
    } else {
      // Transición normal
      framesInZone++
      if (framesInZone >= 5) {
        currentZone = rawZone
        framesInZone = 0
      }
    }
    
    // Track sustained low
    if (LOW_ZONES.includes(currentZone)) {
      framesLow++
      sustainedLow = framesLow > 60  // ~1 segundo
    } else {
      framesLow = 0
      sustainedLow = false
    }
  }
  
  return {
    zone: currentZone,
    absolute: energySequence[energySequence.length - 1],
    smoothed: smoothedEnergy,
    sustainedLow,
    framesInCurrentZone: framesInZone,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCENARIOS DE TEST
// ═══════════════════════════════════════════════════════════════════════════

interface TestScenario {
  name: string
  description: string
  energySequence: number[]
  expectedZone: EnergyZone
  zScore: number
  expectedBehavior: 'block' | 'soft' | 'fire'
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'BIBLIOTECA_SILENCIO',
    description: 'Silencio profundo con pequeño sonido - debería QUEDARSE en silencio',
    energySequence: Array(30).fill(0.02).concat([0.15]),  // 30 frames silence + 1 bump
    expectedZone: 'silence',  // Debería seguir en silencio (timing lento para entrar, ya estaba)
    zScore: 4.0,
    expectedBehavior: 'soft',
  },
  {
    name: 'FAKE_DROP_INSTANTANEO',
    description: 'Silencio → DROP súbito - debe SALIR de silencio INSTANTÁNEAMENTE',
    energySequence: Array(30).fill(0.02).concat([0.95]),  // 30 frames silence + BOOM
    expectedZone: 'peak',  // Debe haber salido INSTANTÁNEO
    zScore: 5.0,
    expectedBehavior: 'fire',
  },
  {
    name: 'VALLE_SOSTENIDO',
    description: 'Valle suave sostenido',
    energySequence: Array(20).fill(0.12),
    expectedZone: 'valley',
    zScore: 2.0,
    expectedBehavior: 'soft',
  },
  {
    name: 'ACTIVE_NORMAL',
    description: 'Actividad normal - verso energético',
    energySequence: Array(20).fill(0.55),
    expectedZone: 'active',
    zScore: 2.2,
    expectedBehavior: 'fire',
  },
  {
    name: 'PEAK_DROP',
    description: 'Drop real con energía máxima',
    energySequence: [0.3, 0.5, 0.7, 0.85, 0.95, 0.98],
    expectedZone: 'peak',
    zScore: 4.5,
    expectedBehavior: 'fire',
  },
  {
    name: 'DESCENSO_A_VALLE',
    description: 'Bajada gradual del pico al valle (timing lento)',
    energySequence: [0.9, 0.7, 0.5, 0.3, 0.15, 0.12, 0.10],
    expectedZone: 'gentle',  // No llega a valley tan rápido
    zScore: 1.5,
    expectedBehavior: 'fire',  // Gentle permite fuego
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// EJECUTOR
// ═══════════════════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════════════════════════════')
console.log('🔋 WAVE 934: ENERGY CONSCIOUSNESS CALIBRATION TEST')
console.log('═══════════════════════════════════════════════════════════════════')
console.log('')

let passed = 0
let failed = 0

for (const scenario of SCENARIOS) {
  console.log(`📋 ${scenario.name}`)
  console.log(`   ${scenario.description}`)
  
  const result = simulateEngine(scenario.energySequence)
  const zonePassed = result.zone === scenario.expectedZone
  
  // Verificar comportamiento
  let behaviorPassed = true
  if (scenario.expectedBehavior === 'soft') {
    behaviorPassed = ['silence', 'valley', 'ambient'].includes(result.zone)
  } else if (scenario.expectedBehavior === 'fire') {
    behaviorPassed = ['gentle', 'active', 'intense', 'peak'].includes(result.zone)
  }
  
  const testPassed = zonePassed && behaviorPassed
  
  if (testPassed) {
    console.log(`   ✅ PASSED | Zone: ${result.zone} | Energy: ${result.absolute.toFixed(2)} | Smoothed: ${result.smoothed.toFixed(2)}`)
    passed++
  } else {
    console.log(`   ❌ FAILED | Zone: ${result.zone} (expected: ${scenario.expectedZone})`)
    console.log(`            | Energy: ${result.absolute.toFixed(2)} | Smoothed: ${result.smoothed.toFixed(2)}`)
    if (!behaviorPassed) {
      console.log(`            | Behavior: expected ${scenario.expectedBehavior}, got zone ${result.zone}`)
    }
    failed++
  }
  console.log('')
}

console.log('═══════════════════════════════════════════════════════════════════')
console.log(`📊 RESULTS: ${passed}/${passed + failed} passed (${Math.round(passed/(passed+failed)*100)}%)`)
console.log('═══════════════════════════════════════════════════════════════════')

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED!')
} else {
  console.log(`⚠️ ${failed} tests need calibration adjustments`)
}
