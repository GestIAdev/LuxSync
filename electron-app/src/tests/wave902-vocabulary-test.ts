/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌀 WAVE 902: VOCABULARY SYNC TEST
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Verifica que el Dream Engine solo use efectos que existen en EffectManager.
 * 
 * TESTS:
 * 1. ✅ Todos los efectos del Dream tienen factory en EffectManager
 * 2. ✅ No quedan nombres imaginarios (laser_sweep, fire_burst, etc.)
 * 3. ✅ Todas las categorías están pobladas con efectos reales
 */

import { EffectManager } from '../core/effects/EffectManager'

// Importar las constantes del DreamSimulator (WAVE 902.1: TRUTH)
// 🎯 Only 2 genres implemented: Latina (10) + Techno (3)
const DREAM_EFFECT_CATEGORIES = {
  'techno-industrial': [
    'industrial_strobe',
    'acid_sweep',
    'cyber_dualism'
  ],
  'latino-organic': [
    'solar_flare',
    'strobe_storm',
    'strobe_burst',
    'tidal_wave',
    'ghost_breath',
    'tropical_pulse',
    'salsa_fire',
    'cumbia_moon',
    'clave_rhythm',
    'corazon_latino',
    'oro_solido',       // 🥇 WAVE 2189: El Trompetazo
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runVocabularyTests() {
  console.log('\n🌀 WAVE 902: VOCABULARY SYNC TEST\n')
  console.log('═'.repeat(80))
  
  let passed = 0
  let failed = 0
  
  // Get available effects from EffectManager
  const effectManager = new EffectManager()
  const availableEffects = effectManager.getAvailableEffects()
  
  console.log(`\n📋 Available Effects in EffectManager (${availableEffects.length}):`)
  availableEffects.sort().forEach(effect => {
    console.log(`   ✅ ${effect}`)
  })
  
  // TEST 1: All Dream effects exist in EffectManager
  console.log('\n─'.repeat(80))
  console.log('TEST 1: Dream Effects Registry Validation')
  console.log('─'.repeat(80))
  
  let test1Pass = true
  const allDreamEffects = [
    ...DREAM_EFFECT_CATEGORIES['techno-industrial'],
    ...DREAM_EFFECT_CATEGORIES['latino-organic']
    // No chill-ambient - not implemented yet
  ]
  
  for (const effect of allDreamEffects) {
    const exists = availableEffects.includes(effect)
    if (exists) {
      console.log(`   ✅ ${effect} - REGISTERED`)
    } else {
      console.log(`   ❌ ${effect} - NOT FOUND IN EFFECTMANAGER`)
      test1Pass = false
    }
  }
  
  if (test1Pass) {
    console.log('\n✅ TEST 1 PASSED: All Dream effects are registered')
    passed++
  } else {
    console.log('\n❌ TEST 1 FAILED: Some effects are missing')
    failed++
  }
  
  // TEST 2: No imaginary effects
  console.log('\n─'.repeat(80))
  console.log('TEST 2: Imaginary Effects Detection')
  console.log('─'.repeat(80))
  
  const FORBIDDEN_EFFECTS = [
    'laser_sweep',
    'fire_burst',
    'rainbow_spiral',
    'borealis_wave',
    'ice_cascade',
    'sonar_ping'
  ]
  
  let test2Pass = true
  for (const forbidden of FORBIDDEN_EFFECTS) {
    if (allDreamEffects.includes(forbidden)) {
      console.log(`   ❌ ${forbidden} - IMAGINARY EFFECT FOUND`)
      test2Pass = false
    } else {
      console.log(`   ✅ ${forbidden} - Not in Dream vocabulary`)
    }
  }
  
  if (test2Pass) {
    console.log('\n✅ TEST 2 PASSED: No imaginary effects detected')
    passed++
  } else {
    console.log('\n❌ TEST 2 FAILED: Imaginary effects found')
    failed++
  }
  
  // TEST 3: Category coverage
  console.log('\n─'.repeat(80))
  console.log('TEST 3: Category Coverage')
  console.log('─'.repeat(80))
  
  let test3Pass = true
  for (const [category, effects] of Object.entries(DREAM_EFFECT_CATEGORIES)) {
    console.log(`\n   📁 ${category}: ${effects.length} effects`)
    if (effects.length === 0) {
      console.log(`      ❌ Empty category`)
      test3Pass = false
    } else {
      effects.forEach(e => console.log(`      • ${e}`))
    }
  }
  
  if (test3Pass) {
    console.log('\n✅ TEST 3 PASSED: All categories have effects')
    passed++
  } else {
    console.log('\n❌ TEST 3 FAILED: Empty categories found')
    failed++
  }
  
  // SUMMARY
  console.log('\n═'.repeat(80))
  console.log('📊 TEST SUMMARY')
  console.log('═'.repeat(80))
  console.log(`✅ Passed: ${passed}/3`)
  console.log(`❌ Failed: ${failed}/3`)
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - Vocabulary is SYNCED')
    process.exit(0)
  } else {
    console.log('\n💥 TESTS FAILED - Vocabulary mismatch detected')
    process.exit(1)
  }
}

// RUN
runVocabularyTests().catch(err => {
  console.error('💥 Test execution error:', err)
  process.exit(1)
})
