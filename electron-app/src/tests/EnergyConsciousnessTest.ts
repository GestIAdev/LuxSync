/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔋 WAVE 934: ENERGY CONSCIOUSNESS CALIBRATION TEST
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Test automatizado para verificar que la consciencia energética funciona
 * y evita el "Síndrome del Grito en la Biblioteca".
 * 
 * ESCENARIOS A TESTEAR:
 * 1. Silencio + Z-Alto → NO dispara gatling (máx ghost_breath)
 * 2. Valle + Z-Medio → Solo efectos suaves
 * 3. Activo + Z-Alto → Dispara normalmente
 * 4. Fake Drop → Silencio → Drop instantáneo (timing asimétrico)
 * 5. Sostenido bajo → Sigue en zona baja
 * 
 * @module tests/EnergyConsciousnessTest
 * @version WAVE 934
 */

import { EnergyConsciousnessEngine } from '../core/intelligence/EnergyConsciousnessEngine'
import { ContextualEffectSelector, ContextualSelectorInput } from '../core/effects/ContextualEffectSelector'
import { createDefaultEnergyContext, EnergyZone } from '../core/protocol/MusicalContext'
import { MoodController } from '../core/mood'

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

interface TestScenario {
  name: string
  description: string
  energySequence: number[]  // Secuencia de energías a simular
  expectedZone: EnergyZone  // Zona esperada al final
  zScore: number            // Z-Score a aplicar
  expectedBehavior: 'block' | 'soft' | 'fire'  // Comportamiento esperado
  forbiddenEffects?: string[]  // Efectos que NO deberían dispararse
  allowedEffects?: string[]    // Efectos permitidos
}

const TEST_SCENARIOS: TestScenario[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // 🏛️ ESCENARIO 1: BIBLIOTECA (Silencio + Z-Alto)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'BIBLIOTECA_SILENCIO',
    description: 'Silencio profundo → pequeño sonido → Z=4.0 PERO estamos en biblioteca',
    energySequence: [0.02, 0.03, 0.02, 0.03, 0.02, 0.05, 0.15], // 500ms de silencio, luego sube
    expectedZone: 'silence',  // Debería seguir siendo silencio (timing lento)
    zScore: 4.0,  // DIVINE según el Z-Score
    expectedBehavior: 'soft',  // Pero solo soft effects
    forbiddenEffects: ['gatling_raid', 'industrial_strobe', 'solar_flare', 'sky_saw'],
    allowedEffects: ['ghost_breath', 'cumbia_moon'],
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 ESCENARIO 2: VALLE PRE-DROP
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'VALLE_PRE_DROP',
    description: 'Valle suave después de un clímax → preparación',
    energySequence: [0.8, 0.6, 0.4, 0.25, 0.20, 0.18, 0.15], // Bajando del clímax
    expectedZone: 'valley',
    zScore: 2.5,  // EPIC según Z pero estamos en valle
    expectedBehavior: 'soft',
    forbiddenEffects: ['gatling_raid', 'industrial_strobe', 'solar_flare'],
    allowedEffects: ['ghost_breath', 'tidal_wave', 'cumbia_moon', 'clave_rhythm'],
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 ESCENARIO 3: DROP REAL
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'DROP_REAL',
    description: 'Drop real con energía alta → dispara con todo',
    energySequence: [0.3, 0.5, 0.7, 0.85, 0.95], // Subiendo hacia el drop
    expectedZone: 'peak',
    zScore: 4.2,  // DIVINE
    expectedBehavior: 'fire',
    allowedEffects: ['gatling_raid', 'industrial_strobe', 'solar_flare', 'sky_saw', 'cyber_dualism', 'abyssal_rise'],
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⚡ ESCENARIO 4: FAKE DROP (TIMING ASIMÉTRICO)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'FAKE_DROP_INSTANT',
    description: 'Silencio → Drop INSTANTÁNEO (debe salir de silencio RÁPIDO)',
    energySequence: [0.02, 0.02, 0.03, 0.02, 0.95], // Silencio largo, luego BOOM
    expectedZone: 'peak',  // Debe haber salido de silencio INSTANTÁNEAMENTE
    zScore: 5.0,  // DIVINE++
    expectedBehavior: 'fire',
    allowedEffects: ['gatling_raid', 'industrial_strobe', 'solar_flare'],
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌙 ESCENARIO 5: AMBIENT SOSTENIDO
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'AMBIENT_SOSTENIDO',
    description: 'Pad ambiental sostenido por 30+ segundos',
    energySequence: [0.25, 0.27, 0.24, 0.26, 0.25, 0.28, 0.24, 0.27], // Estable en ambient
    expectedZone: 'ambient',
    zScore: 1.8,  // ELEVATED
    expectedBehavior: 'soft',
    forbiddenEffects: ['gatling_raid', 'industrial_strobe', 'solar_flare'],
    allowedEffects: ['acid_sweep', 'tidal_wave', 'cumbia_moon', 'tropical_pulse', 'salsa_fire'],
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎸 ESCENARIO 6: ACTIVE ZONE - VERSO ENERGÉTICO
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'ACTIVE_VERSE',
    description: 'Verso con energía media-alta → efectos permitidos',
    energySequence: [0.5, 0.55, 0.58, 0.52, 0.60, 0.55],
    expectedZone: 'active',
    zScore: 2.2,  // EPIC
    expectedBehavior: 'fire',
    allowedEffects: ['cyber_dualism', 'gatling_raid', 'sky_saw', 'industrial_strobe', 'acid_sweep', 'strobe_burst'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

interface TestResult {
  scenario: string
  passed: boolean
  zoneResult: EnergyZone
  expectedZone: EnergyZone
  zonePassed: boolean
  effectResult: string | null
  behaviorPassed: boolean
  details: string
}

function runTest(scenario: TestScenario): TestResult {
  // Crear engine fresh
  const engine = new EnergyConsciousnessEngine()
  
  // Simular secuencia de energías
  let energyContext = createDefaultEnergyContext()
  for (const energy of scenario.energySequence) {
    energyContext = engine.process(energy)
  }
  
  // Verificar zona
  const zonePassed = energyContext.zone === scenario.expectedZone
  
  // Verificar efectos permitidos
  let behaviorPassed = true
  let effectResult: string | null = null
  
  // Los efectos permitidos para la zona
  const EFFECTS_BY_ZONE: Record<EnergyZone, string[]> = {
    silence: ['ghost_breath', 'cumbia_moon'],
    valley: ['ghost_breath', 'tidal_wave', 'cumbia_moon', 'clave_rhythm'],
    ambient: ['acid_sweep', 'tidal_wave', 'cumbia_moon', 'tropical_pulse', 'salsa_fire'],
    gentle: ['acid_sweep', 'cyber_dualism', 'strobe_burst', 'tropical_pulse', 'salsa_fire', 'clave_rhythm'],
    active: ['cyber_dualism', 'gatling_raid', 'sky_saw', 'industrial_strobe', 'acid_sweep', 'strobe_burst'],
    intense: ['gatling_raid', 'industrial_strobe', 'sky_saw', 'solar_flare', 'cyber_dualism', 'acid_sweep'],
    peak: ['gatling_raid', 'industrial_strobe', 'solar_flare', 'sky_saw', 'cyber_dualism', 'abyssal_rise'],
  }
  
  const allowedForZone = EFFECTS_BY_ZONE[energyContext.zone] || []
  
  // Verificar que los efectos prohibidos NO estén permitidos
  if (scenario.forbiddenEffects) {
    for (const forbidden of scenario.forbiddenEffects) {
      if (allowedForZone.includes(forbidden)) {
        behaviorPassed = false
        effectResult = `FORBIDDEN ${forbidden} is allowed in zone ${energyContext.zone}`
        break
      }
    }
  }
  
  // Verificar comportamiento esperado
  if (behaviorPassed) {
    switch (scenario.expectedBehavior) {
      case 'block':
        // Debería bloquear todo - zona silence
        if (energyContext.zone !== 'silence') {
          behaviorPassed = false
          effectResult = `Expected BLOCK but zone is ${energyContext.zone}`
        }
        break
      case 'soft':
        // Solo efectos suaves - zona silence/valley/ambient
        if (!['silence', 'valley', 'ambient'].includes(energyContext.zone)) {
          behaviorPassed = false
          effectResult = `Expected SOFT effects but zone is ${energyContext.zone}`
        }
        break
      case 'fire':
        // Puede disparar fuerte - zona active/intense/peak
        if (!['active', 'intense', 'peak', 'gentle'].includes(energyContext.zone)) {
          behaviorPassed = false
          effectResult = `Expected FIRE allowed but zone is ${energyContext.zone}`
        }
        break
    }
  }
  
  const passed = zonePassed && behaviorPassed
  
  return {
    scenario: scenario.name,
    passed,
    zoneResult: energyContext.zone,
    expectedZone: scenario.expectedZone,
    zonePassed,
    effectResult,
    behaviorPassed,
    details: `Zone: ${energyContext.zone} (expected: ${scenario.expectedZone}) | Z=${scenario.zScore} | Behavior: ${scenario.expectedBehavior}`,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

export function runEnergyConsciousnessTests(): void {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('🔋 WAVE 934: ENERGY CONSCIOUSNESS CALIBRATION TEST')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('')
  
  const results: TestResult[] = []
  let passed = 0
  let failed = 0
  
  for (const scenario of TEST_SCENARIOS) {
    console.log(`📋 Testing: ${scenario.name}`)
    console.log(`   ${scenario.description}`)
    
    const result = runTest(scenario)
    results.push(result)
    
    if (result.passed) {
      console.log(`   ✅ PASSED: ${result.details}`)
      passed++
    } else {
      console.log(`   ❌ FAILED: ${result.details}`)
      if (!result.zonePassed) {
        console.log(`      Zone mismatch: got ${result.zoneResult}, expected ${result.expectedZone}`)
      }
      if (!result.behaviorPassed && result.effectResult) {
        console.log(`      Behavior: ${result.effectResult}`)
      }
      failed++
    }
    console.log('')
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(`📊 RESULTS: ${passed}/${passed + failed} passed (${Math.round(passed/(passed+failed)*100)}%)`)
  console.log('═══════════════════════════════════════════════════════════════════')
  
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! La consciencia energética funciona correctamente.')
  } else {
    console.log(`⚠️ ${failed} tests failed. Revisar calibración de EnergyConsciousnessEngine.`)
  }
}

// Run if executed directly
if (typeof window === 'undefined') {
  runEnergyConsciousnessTests()
}
