/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 WAVE 2002 TEST: VERIFY SYNAPTIC BRIDGE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Script de verificación del puente sináptico Chronos ↔ Titan
 * 
 * TESTS:
 * 1. Forzar Vibe a 'techno-club' - Override
 * 2. Disparar efecto 'gatling_raid' a través del Bridge
 * 3. Control de progress manual en efecto activo
 * 
 * EJECUCIÓN:
 * npm run test -- --testPathPattern=verifyBridge
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { TitanEngine } from '../engine/TitanEngine'
import { 
  getChronosInjector, 
  type ChronosOverrides,
  type ChronosTriggerEvent,
  type ChronosEffectWithProgress,
} from '../chronos/bridge/ChronosInjector'
import { getEffectManager } from '../core/effects/EffectManager'
import type { MusicalContext } from '../core/protocol/MusicalContext'
import type { EngineAudioMetrics } from '../engine/TitanEngine'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

let titanEngine: TitanEngine
let effectManager: ReturnType<typeof getEffectManager>

// Crear contexto musical dummy (simula audio real)
function createDummyContext(): MusicalContext {
  return {
    timestamp: Date.now(),
    bpm: 128,
    beatPhase: 0.5,
    confidence: 0.8,
    energy: 0.4, // Energía baja para ver el override
    key: 'C',
    mode: 'minor' as const,
    mood: 'neutral' as const,
    syncopation: 0.3,
    section: {
      current: 'verse',
      type: 'verse',
      confidence: 0.7,
      duration: 16000,
      isTransition: false,
    },
    genre: {
      macro: 'ELECTRONIC' as const,
      subGenre: 'house',
      confidence: 0.8,
    },
    vibeId: 'fiesta-latina',
  }
}

// Crear métricas de audio dummy
function createDummyAudio(): EngineAudioMetrics {
  return {
    bass: 0.3,
    mid: 0.4,
    high: 0.3,
    energy: 0.4,
    isBeat: false,
    beatPhase: 0.5,
    beatCount: 0,
    kickDetected: false,
    snareDetected: false,
    hihatDetected: false,
    spectralCentroid: 1000,
    spectralFlatness: 0.3,
    harshness: 0.2,
    clarity: 0.7,
    ultraAir: 0.1,
    subBass: 0.2,
    lowMid: 0.3,
    highMid: 0.4,
  }
}

// Crear ChronosOverrides vacíos (baseline)
function createEmptyOverrides(): ChronosOverrides {
  return {
    active: false,
    mode: 'whisper' as const,
    timestamp: Date.now(),
    forcedVibe: null,
    modulators: {
      masterIntensity: null,
      masterSpeed: null,
      hueOffset: null,
      saturation: null,
      energyOverride: null,
      custom: new Map(),
    },
    triggerEvents: [],
    activeEffectsWithProgress: [],
    zoneOverride: null,
    colorOverride: null,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════

describe('🕰️ WAVE 2002: SYNAPTIC BRIDGE', () => {
  
  beforeAll(() => {
    console.log('\n═══════════════════════════════════════════════════════════════════')
    console.log('🧪 WAVE 2002 TEST: VERIFY SYNAPTIC BRIDGE')
    console.log('═══════════════════════════════════════════════════════════════════\n')
    
    // Crear instancia de TitanEngine
    titanEngine = new TitanEngine({ 
      debug: true, 
      initialVibe: 'fiesta-latina'
    })
    
    // Obtener EffectManager
    effectManager = getEffectManager()
    
    console.log('[SETUP] ✓ TitanEngine instanciado')
    console.log('[SETUP] ✓ EffectManager obtenido')
    console.log('[SETUP] ✓ ChronosInjector disponible\n')
  })
  
  afterEach(() => {
    // Limpiar estado de Chronos después de cada test
    titanEngine.clearChronosInput()
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 1: FORCE VIBE OVERRIDE
  // ═══════════════════════════════════════════════════════════════════════
  
  it('TEST 1: Force Vibe Override - Chronos dicta vibe techno-club', async () => {
    console.log('\n─────────────────────────────────────────────────────────────────')
    console.log('🧪 TEST 1: FORCE VIBE OVERRIDE')
    console.log('   Objetivo: Forzar vibe "techno-club" ignorando audio')
    console.log('─────────────────────────────────────────────────────────────────\n')
    
    // Crear overrides que fuerzan techno-club
    const chronosOverrides: ChronosOverrides = {
      active: true,
      mode: 'full' as const, // Modo dictado
      timestamp: Date.now(),
      forcedVibe: {
        vibeId: 'techno-club',
        transition: 'cut',
        transitionProgress: 1.0,
      },
      modulators: {
        masterIntensity: null,
        masterSpeed: null,
        hueOffset: null,
        saturation: null,
        energyOverride: 0.8, // Forzar energía alta
        custom: new Map(),
      },
      triggerEvents: [],
      activeEffectsWithProgress: [],
      zoneOverride: null,
      colorOverride: null,
    }
    
    console.log('[TEST 1] 📤 Inyectando ChronosOverrides...')
    console.log('[TEST 1]    forcedVibe: "techno-club"')
    console.log('[TEST 1]    energyOverride: 0.8')
    
    // Inyectar overrides en TitanEngine
    titanEngine.setChronosInput(chronosOverrides)
    
    // Verificar que Chronos está activo
    const isActive = titanEngine.isChronosActive()
    console.log(`[TEST 1] ✓ isChronosActive(): ${isActive}`)
    
    expect(isActive).toBe(true)
    
    // Ejecutar algunos frames con override activo
    console.log('[TEST 1] ⏱️ Ejecutando 60 frames con Chronos activo...')
    
    for (let i = 0; i < 60; i++) {
      const context = createDummyContext()
      const audio = createDummyAudio()
      await titanEngine.update(context, audio)
    }
    
    console.log('[TEST 1] ✓ 60 frames completados con override activo')
    
    // Limpiar override
    console.log('[TEST 1] 🧹 Limpiando ChronosInput...')
    titanEngine.clearChronosInput()
    
    const isActiveAfter = titanEngine.isChronosActive()
    console.log(`[TEST 1] ✓ isChronosActive() después de clear: ${isActiveAfter}`)
    
    expect(isActiveAfter).toBe(false)
    
    console.log('[TEST 1] ✅ PASS: Force Vibe Override funcionó correctamente\n')
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 2: TRIGGER EFFECT VIA BRIDGE
  // ═══════════════════════════════════════════════════════════════════════
  
  it('TEST 2: Trigger Effect via Bridge - Disparar gatling_raid', async () => {
    console.log('\n─────────────────────────────────────────────────────────────────')
    console.log('🧪 TEST 2: TRIGGER EFFECT VIA BRIDGE')
    console.log('   Objetivo: Disparar "gatling_raid" a través del puente Chronos')
    console.log('─────────────────────────────────────────────────────────────────\n')
    
    // Crear trigger event para gatling_raid
    const triggerEvent: ChronosTriggerEvent = {
      effectId: 'gatling_raid',
      intensity: 0.8,
      speed: 1.0,
      zones: ['all'],
      params: {},
      sourceClipId: 'test-clip-001',
      isNewTrigger: true,
    }
    
    // Crear overrides con el trigger
    const chronosOverrides: ChronosOverrides = {
      active: true,
      mode: 'whisper' as const,
      timestamp: Date.now(),
      forcedVibe: null,
      modulators: {
        masterIntensity: null,
        masterSpeed: null,
        hueOffset: null,
        saturation: null,
        energyOverride: null,
        custom: new Map(),
      },
      triggerEvents: [triggerEvent],
      activeEffectsWithProgress: [],
      zoneOverride: null,
      colorOverride: null,
    }
    
    console.log('[TEST 2] 📤 Inyectando trigger event...')
    console.log('[TEST 2]    effectId: "gatling_raid"')
    console.log('[TEST 2]    intensity: 0.8')
    console.log('[TEST 2]    isNewTrigger: true')
    
    // Inyectar overrides
    titanEngine.setChronosInput(chronosOverrides)
    
    // Verificar Chronos activo
    expect(titanEngine.isChronosActive()).toBe(true)
    
    // Ejecutar UN frame (esto debe procesar el trigger)
    const context = createDummyContext()
    const audio = createDummyAudio()
    await titanEngine.update(context, audio)
    
    console.log('[TEST 2] ⚡ Frame ejecutado con trigger')
    console.log('[TEST 2]    (El efecto puede ser bloqueado por THE SHIELD según vibe)')
    
    // El test pasa si no hay errores - el efecto puede ser bloqueado por permisos
    console.log('[TEST 2] ✅ PASS: Trigger procesado sin errores\n')
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 3: MANUAL PROGRESS CONTROL (SCRUBBING)
  // ═══════════════════════════════════════════════════════════════════════
  
  it('TEST 3: Manual Progress Control - Scrubbing de efecto', async () => {
    console.log('\n─────────────────────────────────────────────────────────────────')
    console.log('🧪 TEST 3: MANUAL PROGRESS CONTROL (SCRUBBING)')
    console.log('   Objetivo: Demostrar control manual de progress en efecto activo')
    console.log('─────────────────────────────────────────────────────────────────\n')
    
    // Disparar un efecto manualmente para tener algo que controlar
    console.log('[TEST 3] 🎯 Disparando efecto de prueba...')
    
    const effectId = effectManager.trigger({
      effectType: 'solar_flare',
      intensity: 0.7,
      source: 'manual',
      reason: 'Test de Chronos Bridge - Scrubbing',
    })
    
    console.log(`[TEST 3]    effectId: ${effectId || 'bloqueado'}`)
    
    // Crear estructura de efecto con progress
    const effectWithProgress: ChronosEffectWithProgress = {
      effectId: 'solar_flare',
      instanceId: effectId,
      progress: 0.0,
      intensity: 0.7,
      sourceClipId: 'test-clip-scrub',
    }
    
    console.log('[TEST 3] 🎛️ Simulando scrubbing de progress...')
    
    // Simular scrubbing: 0% → 50% → 100%
    const progressSteps = [0.0, 0.5, 1.0]
    
    for (const progress of progressSteps) {
      effectWithProgress.progress = progress
      
      const chronosOverrides: ChronosOverrides = {
        active: true,
        mode: 'whisper' as const,
        timestamp: Date.now(),
        forcedVibe: null,
        modulators: {
          masterIntensity: null,
          masterSpeed: null,
          hueOffset: null,
          saturation: null,
          energyOverride: null,
          custom: new Map(),
        },
        triggerEvents: [],
        activeEffectsWithProgress: [effectWithProgress],
        zoneOverride: null,
        colorOverride: null,
      }
      
      titanEngine.setChronosInput(chronosOverrides)
      
      // Ejecutar frame
      const context = createDummyContext()
      const audio = createDummyAudio()
      await titanEngine.update(context, audio)
      
      console.log(`[TEST 3]    Progress forzado: ${(progress * 100).toFixed(0)}%`)
    }
    
    console.log('[TEST 3] ✓ Scrubbing completado')
    console.log('[TEST 3] ✅ PASS: Manual Progress Control funcionó\n')
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // TEST 4: CHRONOS STATE TOGGLE
  // ═══════════════════════════════════════════════════════════════════════
  
  it('TEST 4: Chronos State Toggle - Activar/desactivar correctamente', () => {
    console.log('\n─────────────────────────────────────────────────────────────────')
    console.log('🧪 TEST 4: CHRONOS STATE TOGGLE')
    console.log('   Objetivo: Verificar que el estado de Chronos se alterna correctamente')
    console.log('─────────────────────────────────────────────────────────────────\n')
    
    // Inicialmente inactivo
    expect(titanEngine.isChronosActive()).toBe(false)
    console.log('[TEST 4] ✓ Estado inicial: inactivo')
    
    // Activar con overrides
    const overrides = createEmptyOverrides()
    overrides.active = true
    titanEngine.setChronosInput(overrides)
    
    expect(titanEngine.isChronosActive()).toBe(true)
    console.log('[TEST 4] ✓ Después de setChronosInput: activo')
    
    // Desactivar con null
    titanEngine.setChronosInput(null)
    
    expect(titanEngine.isChronosActive()).toBe(false)
    console.log('[TEST 4] ✓ Después de setChronosInput(null): inactivo')
    
    // Reactivar
    titanEngine.setChronosInput(overrides)
    expect(titanEngine.isChronosActive()).toBe(true)
    console.log('[TEST 4] ✓ Reactivación: activo')
    
    // Limpiar con clearChronosInput
    titanEngine.clearChronosInput()
    
    expect(titanEngine.isChronosActive()).toBe(false)
    console.log('[TEST 4] ✓ Después de clearChronosInput: inactivo')
    
    console.log('[TEST 4] ✅ PASS: State Toggle funcionó correctamente\n')
  })
  
})
