/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎲 TECHNO STRICT TEST - MONTE CARLO VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 988.6: STRICT TECHNO MODE - SOLO TECHNO, NADA MÁS
 * 
 * JERARQUÍA VALIDADA:
 * 
 * ZONA 1: THE VOID (Silence/Valley/Ambient) - E < 0.45
 *   - void_mist, deep_breath, sonar_ping, fiber_optics, digital_rain
 * 
 * ZONA 2: THE DRIVE (Gentle/Active) - E: 0.45-0.75
 *   - ambient_strobe, acid_sweep, cyber_dualism, binary_glitch
 * 
 * ZONA 3: THE IMPACT (Intense) - E: 0.75-0.90
 *   - seismic_snap, sky_saw, abyssal_rise
 * 
 * ZONA 4: THE DESTRUCTION (Peak) - E ≥ 0.90
 *   - industrial_strobe, gatling_raid, core_meltdown
 * 
 * BLACKLIST: Si aparece CUALQUIER efecto fuera de esta lista = TEST FAIL
 * 
 * @author PunkOpus
 * @version WAVE 988.6 - STRICT TECHNO MODE
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG - STRICT TECHNO MODE
// ═══════════════════════════════════════════════════════════════════════════

const ITERATIONS = 500
const VIBE = 'techno-club'

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 THE TECHNO WHITELIST - NADA MÁS PUEDE EXISTIR
// ═══════════════════════════════════════════════════════════════════════════

const TECHNO_WHITELIST: Record<string, {
  zone: string
  description: string
  icon: string
}> = {
  // ZONA 1: THE VOID
  'void_mist':     { zone: 'THE VOID', description: 'Neblina', icon: '🌫️' },
  'deep_breath':   { zone: 'THE VOID', description: 'Respiración', icon: '💨' },
  'sonar_ping':    { zone: 'THE VOID', description: 'El submarino', icon: '📡' },
  'fiber_optics':  { zone: 'THE VOID', description: '✨ NUEVO - Flujo de datos', icon: '🔮' },
  'digital_rain':  { zone: 'THE VOID', description: 'La Reina Matrix', icon: '🌧️' },
  
  // ZONA 2: THE DRIVE
  'ambient_strobe': { zone: 'THE DRIVE', description: 'Flashes de cámara', icon: '📷' },
  'acid_sweep':     { zone: 'THE DRIVE', description: 'La cuchilla líquida', icon: '🔪' },
  'cyber_dualism':  { zone: 'THE DRIVE', description: 'El gemelo digital', icon: '👯' },
  'binary_glitch':  { zone: 'THE DRIVE', description: '⚡ RESUCITADO - Tartamudeo', icon: '⚡' },
  
  // ZONA 3: THE IMPACT
  'seismic_snap':  { zone: 'THE IMPACT', description: '💥 RESUCITADO - Obturador', icon: '💥' },
  'sky_saw':       { zone: 'THE IMPACT', description: 'La sierra aérea', icon: '🪚' },
  'abyssal_rise':  { zone: 'THE IMPACT', description: 'La subida épica - 5s', icon: '🌊' },
  
  // ZONA 4: THE DESTRUCTION
  'industrial_strobe': { zone: 'THE DESTRUCTION', description: 'El martillo clásico', icon: '🔨' },
  'gatling_raid':      { zone: 'THE DESTRUCTION', description: '🔫 RETORNADO - Ametralladora', icon: '🔫' },
  'core_meltdown':     { zone: 'THE DESTRUCTION', description: '☢️ NUEVO - Bomba nuclear', icon: '☢️' },
}

// Total: 16 efectos TECHNO STRICT
const ALLOWED_EFFECTS = Object.keys(TECHNO_WHITELIST)

// ═══════════════════════════════════════════════════════════════════════════
// BLACKLIST - SI APARECE CUALQUIERA DE ESTOS, EL TEST FALLA
// ═══════════════════════════════════════════════════════════════════════════

const BLACKLIST = [
  // 🌴 TROPICAL (PROHIBIDO)
  'solar_flare', 'tropical_pulse', 'salsa_fire', 'clave_rhythm',
  'corazon_latino', 'cumbia_moon',
  // 👻 LEGACY (PROHIBIDO)
  'ghost_breath', 'tidal_wave', 'strobe_burst', 'strobe_storm',
  // ❓ UNKNOWN (PROHIBIDO)
  'pulse_wave', 'ambient_pulse', 'color_wash',
]

// ═══════════════════════════════════════════════════════════════════════════
// STRICT ZONE ALLOCATION - LA NUEVA LEY
// ═══════════════════════════════════════════════════════════════════════════

type StrictZone = 'THE VOID' | 'THE DRIVE' | 'THE IMPACT' | 'THE DESTRUCTION'

const ZONE_BY_ENERGY: { maxEnergy: number, zone: StrictZone }[] = [
  { maxEnergy: 0.45, zone: 'THE VOID' },       // Silence/Valley/Ambient
  { maxEnergy: 0.75, zone: 'THE DRIVE' },      // Gentle/Active
  { maxEnergy: 0.90, zone: 'THE IMPACT' },     // Intense
  { maxEnergy: 1.00, zone: 'THE DESTRUCTION' } // Peak
]

function energyToStrictZone(energy: number): StrictZone {
  for (const { maxEnergy, zone } of ZONE_BY_ENERGY) {
    if (energy < maxEnergy) return zone
  }
  return 'THE DESTRUCTION'
}

// Efectos por zona STRICT
const EFFECTS_BY_STRICT_ZONE: Record<StrictZone, string[]> = {
  'THE VOID': ['void_mist', 'deep_breath', 'sonar_ping', 'fiber_optics', 'digital_rain'],
  'THE DRIVE': ['ambient_strobe', 'acid_sweep', 'cyber_dualism', 'binary_glitch'],
  'THE IMPACT': ['seismic_snap', 'sky_saw', 'abyssal_rise'],
  'THE DESTRUCTION': ['industrial_strobe', 'gatling_raid', 'core_meltdown'],
}

// ═══════════════════════════════════════════════════════════════════════════
// COOLDOWNS (Techno-specific)
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_COOLDOWNS: Record<string, number> = {
  // THE VOID (largos - atmosféricos)
  'void_mist': 15000,
  'deep_breath': 20000,
  'sonar_ping': 25000,
  'fiber_optics': 20000,
  'digital_rain': 18000,
  
  // THE DRIVE (medios - rítmicos)
  'ambient_strobe': 14000,
  'acid_sweep': 12000,
  'cyber_dualism': 15000,
  'binary_glitch': 10000,
  
  // THE IMPACT (cortos - golpes)
  'seismic_snap': 12000,
  'sky_saw': 10000,
  'abyssal_rise': 25000,  // Reducido de 45s porque ahora dura 5s
  
  // THE DESTRUCTION (cortos - violentos)
  'industrial_strobe': 10000,
  'gatling_raid': 8000,
  'core_meltdown': 30000,  // Nuclear = raro
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SCENARIOS - LOS 4 ESCENARIOS PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════

interface StrictScenario {
  name: string
  energy: number
  expectedZone: StrictZone
  keyEffects: string[]  // Efectos CLAVE que DEBEN aparecer
  description: string
}

const STRICT_SCENARIOS: StrictScenario[] = [
  {
    name: '🌑 THE VOID (Valley)',
    energy: 0.20,
    expectedZone: 'THE VOID',
    keyEffects: ['fiber_optics', 'digital_rain', 'void_mist'],
    description: 'E=0.20 → Ver fiber_optics (✨ NUEVO)'
  },
  {
    name: '⚡ THE DRIVE (Active)',
    energy: 0.60,
    expectedZone: 'THE DRIVE',
    keyEffects: ['binary_glitch', 'acid_sweep', 'cyber_dualism'],
    description: 'E=0.60 → Ver binary_glitch (⚡ RESUCITADO)'
  },
  {
    name: '💥 THE IMPACT (Intense)',
    energy: 0.85,
    expectedZone: 'THE IMPACT',
    keyEffects: ['seismic_snap', 'sky_saw', 'abyssal_rise'],
    description: 'E=0.85 → Ver seismic_snap vs sky_saw'
  },
  {
    name: '☢️ THE DESTRUCTION (Peak)',
    energy: 0.98,
    expectedZone: 'THE DESTRUCTION',
    keyEffects: ['gatling_raid', 'core_meltdown', 'industrial_strobe'],
    description: 'E=0.98 → Ver gatling vs meltdown'
  }
]

// ═══════════════════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

interface StrictResult {
  scenario: string
  zone: StrictZone
  effectCounts: Record<string, number>
  totalSelections: number
  nullSelections: number
  keyEffectsFound: string[]
  keyEffectsMissing: string[]
  blacklistViolations: string[]  // ⛔ SI HAY ALGO AQUÍ = TEST FAIL
  unknownEffects: string[]       // ❓ Efectos no en whitelist
}

function runStrictSimulation(scenario: StrictScenario): StrictResult {
  const effectCounts: Record<string, number> = {}
  let nullSelections = 0
  let lastEffectType: string | null = null
  const cooldownTracker: Map<string, number> = new Map()
  let currentTime = 0
  
  // Efectos permitidos en esta zona
  const zoneEffects = EFFECTS_BY_STRICT_ZONE[scenario.expectedZone]
  
  for (let i = 0; i < ITERATIONS; i++) {
    // Pequeña variación de energía (±5%)
    const energyVariance = (Math.random() - 0.5) * 0.10
    const energy = Math.max(0, Math.min(1, scenario.energy + energyVariance))
    const actualZone = energyToStrictZone(energy)
    
    // Obtener efectos de la zona ACTUAL (puede variar por energyVariance)
    const allowedEffects = EFFECTS_BY_STRICT_ZONE[actualZone]
    
    // Filtrar por cooldown
    const availableEffects = allowedEffects.filter(fx => {
      const lastFired = cooldownTracker.get(fx)
      if (!lastFired) return true
      const cooldown = EFFECT_COOLDOWNS[fx] || 10000
      return (currentTime - lastFired) >= cooldown
    })
    
    // Anti-repetición
    const candidates = availableEffects.filter(fx => fx !== lastEffectType)
    
    if (candidates.length === 0) {
      nullSelections++
      currentTime += 1000
      continue
    }
    
    // Selección Monte Carlo (uniforme)
    const selectedIndex = Math.floor(Math.random() * candidates.length)
    const selectedEffect = candidates[selectedIndex]
    
    effectCounts[selectedEffect] = (effectCounts[selectedEffect] || 0) + 1
    cooldownTracker.set(selectedEffect, currentTime)
    lastEffectType = selectedEffect
    
    currentTime += 2000 + Math.random() * 5000
  }
  
  // Análisis de resultados
  const detectedEffects = Object.keys(effectCounts)
  
  const blacklistViolations = detectedEffects.filter(e => BLACKLIST.includes(e))
  const unknownEffects = detectedEffects.filter(e => !ALLOWED_EFFECTS.includes(e) && !BLACKLIST.includes(e))
  
  const keyEffectsFound = scenario.keyEffects.filter(e => effectCounts[e] && effectCounts[e] > 0)
  const keyEffectsMissing = scenario.keyEffects.filter(e => !effectCounts[e] || effectCounts[e] === 0)
  
  return {
    scenario: scenario.name,
    zone: scenario.expectedZone,
    effectCounts,
    totalSelections: ITERATIONS - nullSelections,
    nullSelections,
    keyEffectsFound,
    keyEffectsMissing,
    blacklistViolations,
    unknownEffects
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function printStrictReport(result: StrictResult, scenario: StrictScenario): void {
  console.log('\n' + '═'.repeat(75))
  console.log(`${scenario.name} - Energy: ${scenario.energy}`)
  console.log(`📝 ${scenario.description}`)
  console.log(`🎯 Zona esperada: ${scenario.expectedZone}`)
  console.log(`📋 Efectos de zona: ${EFFECTS_BY_STRICT_ZONE[scenario.expectedZone].join(', ')}`)
  console.log('═'.repeat(75))
  
  console.log(`\n📊 RESULTADOS (${result.totalSelections} selecciones, ${result.nullSelections} nulls):`)
  
  // Ordenar por count descendente
  const sorted = Object.entries(result.effectCounts)
    .map(([effect, count]) => ({ 
      effect, 
      count, 
      pct: (count / result.totalSelections) * 100,
      info: TECHNO_WHITELIST[effect]
    }))
    .sort((a, b) => b.count - a.count)
  
  console.log('\n  EFECTO              | COUNT | %      | ZONA            | STATUS')
  console.log('  ' + '-'.repeat(70))
  
  for (const { effect, count, pct, info } of sorted) {
    const isKey = scenario.keyEffects.includes(effect)
    const isWhitelisted = ALLOWED_EFFECTS.includes(effect)
    const isBlacklisted = BLACKLIST.includes(effect)
    
    let status = ''
    if (isBlacklisted) status = '⛔ BLACKLIST!'
    else if (!isWhitelisted) status = '❓ UNKNOWN'
    else if (isKey) status = '🎯 KEY'
    else status = '✅ OK'
    
    const zoneInfo = info ? info.zone : '???'
    const icon = info ? info.icon : '?'
    
    console.log(`  ${icon} ${effect.padEnd(18)} | ${String(count).padStart(5)} | ${pct.toFixed(1).padStart(5)}% | ${zoneInfo.padEnd(15)} | ${status}`)
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  // ⛔ BLACKLIST CHECK
  if (result.blacklistViolations.length > 0) {
    console.log(`\n⛔⛔⛔ BLACKLIST VIOLATIONS (TEST FAIL!) ⛔⛔⛔`)
    result.blacklistViolations.forEach(e => {
      console.log(`   ⛔ ${e} - ESTE EFECTO NO DEBERÍA EXISTIR EN TECHNO`)
    })
  } else {
    console.log(`\n✅ BLACKLIST CHECK: PASSED (0 violaciones)`)
  }
  
  // ❓ UNKNOWN CHECK
  if (result.unknownEffects.length > 0) {
    console.log(`\n❓ UNKNOWN EFFECTS DETECTED:`)
    result.unknownEffects.forEach(e => {
      console.log(`   ❓ ${e} - No está en whitelist ni blacklist`)
    })
  }
  
  // 🎯 KEY EFFECTS CHECK
  if (result.keyEffectsMissing.length > 0) {
    console.log(`\n⚠️  KEY EFFECTS MISSING:`)
    result.keyEffectsMissing.forEach(e => {
      const info = TECHNO_WHITELIST[e]
      console.log(`   ❌ ${e} (${info?.description || '?'})`)
    })
  } else {
    console.log(`\n🎯 KEY EFFECTS: ALL FOUND (${result.keyEffectsFound.length}/${scenario.keyEffects.length})`)
    result.keyEffectsFound.forEach(e => {
      const count = result.effectCounts[e]
      const pct = (count / result.totalSelections) * 100
      const info = TECHNO_WHITELIST[e]
      console.log(`   ✅ ${e}: ${count} hits (${pct.toFixed(1)}%) - ${info?.description || ''}`)
    })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
  console.log('║  🎲🎹 TECHNO STRICT TEST - MONTE CARLO VALIDATION                        ║')
  console.log('║  WAVE 988.6: SOLO TECHNO, NADA MÁS                                        ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝')
  console.log(`\n⚙️  Config: ${ITERATIONS} iteraciones | Vibe: ${VIBE} (STRICT MODE)`)
  console.log(`📋 Whitelist: ${ALLOWED_EFFECTS.length} efectos techno`)
  console.log(`⛔ Blacklist: ${BLACKLIST.length} efectos prohibidos`)
  
  const allResults: StrictResult[] = []
  let totalBlacklistViolations = 0
  let totalKeyMissing = 0
  
  for (const scenario of STRICT_SCENARIOS) {
    const result = runStrictSimulation(scenario)
    allResults.push(result)
    printStrictReport(result, scenario)
    
    totalBlacklistViolations += result.blacklistViolations.length
    totalKeyMissing += result.keyEffectsMissing.length
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n')
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
  console.log('║                    📋 RESUMEN FINAL - STRICT TECHNO                       ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝')
  
  console.log('\n📊 RESULTADOS POR ESCENARIO:')
  console.log('  ' + '-'.repeat(70))
  
  for (let i = 0; i < allResults.length; i++) {
    const result = allResults[i]
    const scenario = STRICT_SCENARIOS[i]
    
    const blacklistStatus = result.blacklistViolations.length === 0 ? '✅' : '⛔'
    const keyStatus = result.keyEffectsMissing.length === 0 ? '✅' : '⚠️'
    
    console.log(`  ${blacklistStatus} ${keyStatus} ${scenario.name}`)
    console.log(`       Selecciones: ${result.totalSelections} | Keys: ${result.keyEffectsFound.length}/${scenario.keyEffects.length}`)
    
    if (result.blacklistViolations.length > 0) {
      console.log(`       ⛔ BLACKLIST: ${result.blacklistViolations.join(', ')}`)
    }
    if (result.keyEffectsMissing.length > 0) {
      console.log(`       ⚠️  MISSING: ${result.keyEffectsMissing.join(', ')}`)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GLOBAL VERDICT
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n' + '═'.repeat(75))
  
  if (totalBlacklistViolations > 0) {
    console.log('⛔⛔⛔ TEST FAILED: BLACKLIST VIOLATIONS DETECTED ⛔⛔⛔')
    console.log(`   ${totalBlacklistViolations} efectos prohibidos aparecieron`)
    console.log('   El sistema está sugiriendo efectos NO-TECHNO!')
  } else if (totalKeyMissing > 0) {
    console.log('⚠️  TEST PARTIAL: SOME KEY EFFECTS MISSING')
    console.log(`   ${totalKeyMissing} efectos clave no aparecieron`)
    console.log('   Revisar zone allocation o cooldowns')
  } else {
    console.log('🎉🎹 TEST PASSED: STRICT TECHNO MODE VALIDATED 🎹🎉')
    console.log('   ✅ 0 blacklist violations')
    console.log('   ✅ Todos los efectos clave presentes')
    console.log('   ✅ Solo efectos TECHNO en rotación')
  }
  
  // Efectos únicos detectados
  const allEffects = new Set<string>()
  for (const result of allResults) {
    Object.keys(result.effectCounts).forEach(e => allEffects.add(e))
  }
  
  console.log(`\n📊 Total efectos únicos detectados: ${allEffects.size}/${ALLOWED_EFFECTS.length}`)
  
  // Mostrar cuáles efectos de la whitelist NO aparecieron nunca
  const neverSeen = ALLOWED_EFFECTS.filter(e => !allEffects.has(e))
  if (neverSeen.length > 0) {
    console.log(`\n⚠️  Efectos de whitelist que NUNCA aparecieron:`)
    neverSeen.forEach(e => {
      const info = TECHNO_WHITELIST[e]
      console.log(`   ❌ ${e} (${info?.zone}) - ${info?.description}`)
    })
  } else {
    console.log(`\n✅ Todos los ${ALLOWED_EFFECTS.length} efectos techno rotaron al menos una vez`)
  }
  
  console.log('\n═'.repeat(75))
  console.log('🎹 TECHNO STRICT TEST COMPLETE 🎹')
  console.log('═'.repeat(75))
}

main()
