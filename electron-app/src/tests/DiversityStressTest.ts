/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎲 DIVERSITY STRESS TEST - MONTE CARLO EFFECT SELECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 988: THE FINAL ARSENAL - VALIDATION
 * 
 * OBJETIVO:
 * Simular N iteraciones del selector de efectos en diferentes escenarios
 * de energía para validar que TODOS los efectos rotan correctamente.
 * 
 * ESCENARIOS:
 * 1. AMBIENT (E=0.35) - fiber_optics, void_mist, digital_rain
 * 2. ACTIVE (E=0.70) - binary_glitch, seismic_snap, acid_sweep, cyber_dualism
 * 3. PEAK (E=0.95) - core_meltdown, gatling_raid, industrial_strobe
 * 
 * @author PunkOpus
 * @version WAVE 988
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const ITERATIONS = 500  // Iteraciones por escenario
const VIBE = 'techno-club'

// ═══════════════════════════════════════════════════════════════════════════
// INLINE: EFFECTS_BY_VIBE (copied from ContextualEffectSelector)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECTS_BY_VIBE: Record<string, string[]> = {
  'techno-club': [
    'ghost_breath',
    'acid_sweep',
    'cyber_dualism',
    'gatling_raid',
    'sky_saw',
    'industrial_strobe',
    'strobe_burst',
    'abyssal_rise',
    'tidal_wave',
    'void_mist',
    'digital_rain',
    'deep_breath',
    'ambient_strobe',
    'sonar_ping',
    // 🔪 WAVE 988: FIX! binary_glitch + seismic_snap AÑADIDOS
    'binary_glitch',
    'seismic_snap',
    // 🔮 WAVE 988: THE FINAL ARSENAL
    'fiber_optics',
    'core_meltdown',
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
// INLINE: EFFECTS_BY_INTENSITY (copied from ContextualEffectSelector)
// ═══════════════════════════════════════════════════════════════════════════

type DivTestEnergyZone = 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'

const EFFECTS_BY_INTENSITY: Record<DivTestEnergyZone, string[]> = {
  silence: ['ghost_breath', 'void_mist', 'deep_breath', 'sonar_ping', 'fiber_optics'],
  valley: ['ghost_breath', 'tidal_wave', 'void_mist', 'digital_rain', 'deep_breath', 'sonar_ping', 'fiber_optics'],
  ambient: ['acid_sweep', 'tidal_wave', 'digital_rain', 'deep_breath', 'fiber_optics'],
  gentle: ['acid_sweep', 'cyber_dualism', 'strobe_burst', 'ghost_breath', 'digital_rain', 'ambient_strobe', 'binary_glitch'],
  active: ['cyber_dualism', 'sky_saw', 'acid_sweep', 'strobe_burst', 'ambient_strobe', 'binary_glitch', 'seismic_snap'],
  intense: ['gatling_raid', 'industrial_strobe', 'sky_saw', 'solar_flare', 'cyber_dualism', 'acid_sweep', 'strobe_burst', 'corazon_latino', 'seismic_snap', 'core_meltdown'],
  peak: ['gatling_raid', 'industrial_strobe', 'solar_flare', 'sky_saw', 'cyber_dualism', 'abyssal_rise', 'strobe_burst', 'corazon_latino', 'core_meltdown'],
}

// ═══════════════════════════════════════════════════════════════════════════
// INLINE: COOLDOWNS (copied from ContextualEffectSelector)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_COOLDOWNS: Record<string, number> = {
  'cumbia_moon': 25000,
  'tropical_pulse': 28000,
  'salsa_fire': 18000,
  'clave_rhythm': 22000,
  'solar_flare': 30000,
  'strobe_burst': 25000,
  'strobe_storm': 40000,
  'ghost_breath': 35000,
  'tidal_wave': 20000,
  'industrial_strobe': 10000,
  'acid_sweep': 12000,
  'cyber_dualism': 15000,
  'gatling_raid': 8000,
  'sky_saw': 10000,
  'abyssal_rise': 45000,
  'void_mist': 15000,
  'digital_rain': 18000,
  'deep_breath': 20000,
  'ambient_strobe': 14000,
  'sonar_ping': 25000,
  'binary_glitch': 10000,
  'seismic_snap': 12000,
  'fiber_optics': 20000,
  'core_meltdown': 30000,
}

// Mapeo energía → zona
function energyToZone(energy: number): DivTestEnergyZone {
  if (energy < 0.15) return 'silence'
  if (energy < 0.30) return 'valley'
  if (energy < 0.45) return 'ambient'
  if (energy < 0.60) return 'gentle'
  if (energy < 0.75) return 'active'
  if (energy < 0.90) return 'intense'
  return 'peak'
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE SELECTOR SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function getEffectsAllowedForZone(zone: DivTestEnergyZone, vibe: string): string[] {
  const zoneAllowed = EFFECTS_BY_INTENSITY[zone] || []
  const vibeAllowed = EFFECTS_BY_VIBE[vibe] || []
  
  // INTERSECCIÓN: Solo efectos que están en AMBAS listas
  return zoneAllowed.filter(fx => vibeAllowed.includes(fx))
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

interface DivTestScenario {
  name: string
  energy: number
  zScore: number
  expectedEffects: string[]
  description: string
}

const DIVTEST_SCENARIOS: DivTestScenario[] = [
  {
    name: '🌫️ AMBIENT',
    energy: 0.35,
    zScore: 0.8,
    expectedEffects: ['fiber_optics', 'void_mist', 'digital_rain', 'deep_breath'],
    description: 'Zona baja - efectos atmosféricos deben dominar'
  },
  {
    name: '⚡ ACTIVE',
    energy: 0.70,
    zScore: 1.8,
    expectedEffects: ['binary_glitch', 'seismic_snap', 'cyber_dualism', 'acid_sweep', 'sky_saw', 'ambient_strobe'],
    description: 'Zona media - binary_glitch y seismic_snap deben RESUCITAR'
  },
  {
    name: '🔥 PEAK',
    energy: 0.95,
    zScore: 3.2,
    expectedEffects: ['core_meltdown', 'gatling_raid', 'industrial_strobe', 'sky_saw'],
    description: 'Zona extrema - artillería pesada debe disparar'
  }
]

// ═══════════════════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════

interface SimulationResult {
  scenario: string
  effectCounts: Record<string, number>
  effectPercentages: Record<string, string>
  totalSelections: number
  nullSelections: number
  missingExpected: string[]
  unexpectedDominators: string[]
}

function runMonteCarloSimulation(scenario: DivTestScenario): SimulationResult {
  const effectCounts: Record<string, number> = {}
  let nullSelections = 0
  let lastEffectType: string | null = null
  const cooldownTracker: Map<string, number> = new Map()
  let currentTime = 0
  
  for (let i = 0; i < ITERATIONS; i++) {
    // Variar ligeramente la energía
    const energyVariance = (Math.random() - 0.5) * 0.10
    const energy = Math.max(0, Math.min(1, scenario.energy + energyVariance))
    const zone = energyToZone(energy)
    
    // Obtener efectos permitidos (intersección zona + vibe)
    const allowedEffects = getEffectsAllowedForZone(zone, VIBE)
    
    // Filtrar por cooldown
    const availableEffects = allowedEffects.filter(fx => {
      const lastFired = cooldownTracker.get(fx)
      if (!lastFired) return true
      const cooldown = EFFECT_COOLDOWNS[fx] || 10000
      return (currentTime - lastFired) >= cooldown
    })
    
    // Anti-repetición: excluir último efecto
    const candidates = availableEffects.filter(fx => fx !== lastEffectType)
    
    if (candidates.length === 0) {
      nullSelections++
      currentTime += 1000  // Avanzar tiempo
      continue
    }
    
    // Selección aleatoria uniforme (Monte Carlo puro)
    const selectedIndex = Math.floor(Math.random() * candidates.length)
    const selectedEffect = candidates[selectedIndex]
    
    effectCounts[selectedEffect] = (effectCounts[selectedEffect] || 0) + 1
    cooldownTracker.set(selectedEffect, currentTime)
    lastEffectType = selectedEffect
    
    // Avanzar tiempo (simular que pasan segundos entre disparos)
    currentTime += 2000 + Math.random() * 5000  // 2-7s entre selecciones
  }
  
  // Calcular porcentajes
  const totalSelections = ITERATIONS - nullSelections
  const effectPercentages: Record<string, string> = {}
  
  for (const [effect, count] of Object.entries(effectCounts)) {
    const percentage = (count / totalSelections) * 100
    effectPercentages[effect] = `${percentage.toFixed(1)}%`
  }
  
  // Detectar efectos esperados que NO aparecieron
  const missingExpected = scenario.expectedEffects.filter(
    e => !effectCounts[e] || effectCounts[e] < 1
  )
  
  // Detectar dominadores inesperados (>40%)
  const unexpectedDominators = Object.entries(effectCounts)
    .filter(([_, count]) => (count / totalSelections) > 0.40)
    .map(([effect]) => effect)
  
  return {
    scenario: scenario.name,
    effectCounts,
    effectPercentages,
    totalSelections,
    nullSelections,
    missingExpected,
    unexpectedDominators
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function printReport(result: SimulationResult, scenario: DivTestScenario): void {
  console.log('\n' + '═'.repeat(70))
  console.log(`${scenario.name} - Energy: ${scenario.energy} | zScore: ${scenario.zScore}`)
  console.log(`📝 ${scenario.description}`)
  console.log('═'.repeat(70))
  
  // Mostrar efectos permitidos para esta zona
  const zone = energyToZone(scenario.energy)
  const allowed = getEffectsAllowedForZone(zone, VIBE)
  console.log(`\n🎯 Zona detectada: ${zone}`)
  console.log(`📋 Efectos permitidos (${allowed.length}): ${allowed.join(', ')}`)
  
  console.log(`\n📊 RESULTADOS (${result.totalSelections} selecciones, ${result.nullSelections} nulls):`)
  
  // Ordenar por porcentaje descendente
  const sorted = Object.entries(result.effectPercentages)
    .map(([effect, pct]) => ({ effect, pct, count: result.effectCounts[effect] }))
    .sort((a, b) => b.count - a.count)
  
  // Imprimir tabla
  console.log('\n  EFECTO                  | COUNT | %     | ESPERADO')
  console.log('  ' + '-'.repeat(55))
  
  for (const { effect, pct, count } of sorted) {
    const isExpected = scenario.expectedEffects.includes(effect)
    const marker = isExpected ? '✅' : '  '
    const bar = '█'.repeat(Math.ceil(count / 10))
    console.log(`  ${marker} ${effect.padEnd(20)} | ${String(count).padStart(5)} | ${pct.padStart(5)} | ${bar}`)
  }
  
  // Alertas
  if (result.missingExpected.length > 0) {
    console.log(`\n⚠️  ALERTA: Efectos ESPERADOS que NO aparecieron:`)
    result.missingExpected.forEach(e => console.log(`   ❌ ${e}`))
  } else {
    console.log(`\n✅ Todos los efectos esperados aparecieron`)
  }
  
  if (result.unexpectedDominators.length > 0) {
    console.log(`\n⚠️  ALERTA: Dominadores inesperados (>40%):`)
    result.unexpectedDominators.forEach(e => console.log(`   ⚡ ${e}`))
  }
  
  // Verificaciones específicas
  if (scenario.name.includes('ACTIVE')) {
    const binaryGlitch = result.effectCounts['binary_glitch'] || 0
    const seismicSnap = result.effectCounts['seismic_snap'] || 0
    if (binaryGlitch > 0 && seismicSnap > 0) {
      console.log(`\n🎉 RESURRECCIÓN CONFIRMADA:`)
      console.log(`   ⚡ binary_glitch: ${binaryGlitch} apariciones (${((binaryGlitch / result.totalSelections) * 100).toFixed(1)}%)`)
      console.log(`   💥 seismic_snap: ${seismicSnap} apariciones (${((seismicSnap / result.totalSelections) * 100).toFixed(1)}%)`)
    } else {
      console.log(`\n💀 RESURRECCIÓN FALLIDA:`)
      if (binaryGlitch === 0) console.log(`   ❌ binary_glitch SIGUE MUERTO`)
      if (seismicSnap === 0) console.log(`   ❌ seismic_snap SIGUE MUERTO`)
    }
  }
  
  if (scenario.name.includes('PEAK')) {
    const coreMeltdown = result.effectCounts['core_meltdown'] || 0
    const gatlingRaid = result.effectCounts['gatling_raid'] || 0
    console.log(`\n☢️  ARMAS NUCLEARES:`)
    console.log(`   ☢️ core_meltdown: ${coreMeltdown} detonaciones (${((coreMeltdown / result.totalSelections) * 100).toFixed(1)}%)`)
    console.log(`   🔫 gatling_raid: ${gatlingRaid} ráfagas (${((gatlingRaid / result.totalSelections) * 100).toFixed(1)}%)`)
    
    if (gatlingRaid === 0) {
      console.log(`   ⚠️  GATLING_RAID DESAPARECIDO EN COMBATE`)
    }
  }
  
  if (scenario.name.includes('AMBIENT')) {
    const fiberOptics = result.effectCounts['fiber_optics'] || 0
    const pct = (fiberOptics / result.totalSelections) * 100
    if (pct >= 5) {
      console.log(`\n🌈 fiber_optics ACTIVO: ${pct.toFixed(1)}% (objetivo: >5%) ✅`)
    } else {
      console.log(`\n⚠️  fiber_optics BAJO: ${pct.toFixed(1)}% (objetivo: >5%)`)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║  🎲 DIVERSITY STRESS TEST - MONTE CARLO EFFECT SELECTOR               ║')
  console.log('║  WAVE 988: THE FINAL ARSENAL VALIDATION                               ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝')
  console.log(`\nConfig: ${ITERATIONS} iteraciones por escenario | Vibe: ${VIBE}`)
  
  const allResults: SimulationResult[] = []
  
  for (const scenario of DIVTEST_SCENARIOS) {
    const result = runMonteCarloSimulation(scenario)
    allResults.push(result)
    printReport(result, scenario)
  }
  
  // Summary
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════════════════╗')
  console.log('║                      📋 RESUMEN FINAL                                 ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════╝')
  
  let totalMissing = 0
  for (const result of allResults) {
    const status = result.missingExpected.length === 0 ? '✅' : '❌'
    console.log(`${status} ${result.scenario}: ${result.totalSelections} selecciones, ${result.missingExpected.length} missing`)
    totalMissing += result.missingExpected.length
  }
  
  if (totalMissing === 0) {
    console.log('\n🎉 TODOS LOS EFECTOS ROTAN CORRECTAMENTE')
  } else {
    console.log(`\n⚠️  ${totalMissing} efectos esperados no aparecieron`)
  }
  
  // Efectos únicos totales
  const allEffects = new Set<string>()
  for (const result of allResults) {
    Object.keys(result.effectCounts).forEach(e => allEffects.add(e))
  }
  console.log(`\n📊 Total efectos únicos detectados: ${allEffects.size}`)
  console.log(`   ${Array.from(allEffects).sort().join(', ')}`)
}

main()
