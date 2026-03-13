/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ HARDWARE SAFETY LAYER — SUITE DE REGRESIÓN "EL BÚNKER"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Si esto falla, Selene sueña un strobe multicolor a 20Hz y el motor
 * mecánico del Beam 2R intenta seguirla. Resultado: motor quemado.
 * 
 * Este test usa vi.useFakeTimers() para controlar el tiempo sin delays
 * reales. Cada avance de tiempo es determinista y verificable.
 * 
 * COBERTURA:
 * - DEBOUNCE: bloquea cambios antes del minChangeTimeMs
 * - CHAOS detection: >3 cambios/segundo activan LATCH
 * - LATCH: expira correctamente a los 2000ms
 * - KEA-006: blockedChanges se resetea al expirar LATCH
 * - Pass-through: fixtures LED pasan sin overhead
 * 
 * @module tests/HardwareSafetyLayer
 * @version PRE-BETA 1.0 — WAVE 2100
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  HardwareSafetyLayer,
  type SafetyFilterResult,
} from '../HardwareSafetyLayer'
import type { FixtureProfile } from '../FixtureProfiles'

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE PROFILES DE TEST
// ═══════════════════════════════════════════════════════════════════════════

/** Beam 2R mecánico: rueda lenta, necesita protección */
const MECHANICAL_PROFILE: FixtureProfile = {
  id: 'test-beam-2r',
  name: 'Test Beam 2R',
  type: 'beam',
  colorEngine: {
    mixing: 'wheel',
    colorWheel: {
      colors: [
        { dmx: 0,  name: 'White', rgb: { r: 255, g: 255, b: 255 } },
        { dmx: 15, name: 'Red',   rgb: { r: 255, g: 0,   b: 0   } },
        { dmx: 30, name: 'Blue',  rgb: { r: 0,   g: 0,   b: 255 } },
      ],
      allowsContinuousSpin: false,
      minChangeTimeMs: 500, // 500ms mínimo entre cambios
    },
  },
  shutter: { type: 'mechanical', maxStrobeHz: 12 },
  safety: {
    blackoutOnColorChange: false,
    maxContinuousOnTime: 0,
    isDischarge: true,    // ← hace que isMechanicalFixture() retorne true
    cooldownTime: 300,
  },
}

/** LED PAR digital: sin rueda, sin protección necesaria */
const DIGITAL_PROFILE: FixtureProfile = {
  id: 'test-led-par',
  name: 'Test LED PAR',
  type: 'par',
  colorEngine: { mixing: 'rgb' },
  shutter: { type: 'digital' },
  safety: {
    blackoutOnColorChange: false,
    maxContinuousOnTime: 0,
    isDischarge: false,   // ← hace que isMechanicalFixture() retorne false
    cooldownTime: 0,
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🛡️ HardwareSafetyLayer — El Búnker', () => {
  let bunker: HardwareSafetyLayer

  beforeEach(() => {
    vi.useFakeTimers()
    bunker = new HardwareSafetyLayer({ debug: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🟢 PASS-THROUGH — Fixtures LED no se protegen
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🟢 Pass-through — Fixtures LED sin overhead', () => {
    
    it('Fixture LED pasa cualquier color sin bloqueo', () => {
      const result = bunker.filter('led-1', 100, DIGITAL_PROFILE, 255)
      
      expect(result.finalColorDmx).toBe(100)
      expect(result.wasBlocked).toBe(false)
      expect(result.isInLatch).toBe(false)
      expect(result.delegateToStrobe).toBe(false)
    })

    it('Cambios rápidos en LED no activan protección', () => {
      // 10 cambios instantáneos sin avance de tiempo
      for (let i = 0; i < 10; i++) {
        const result = bunker.filter('led-1', i * 25, DIGITAL_PROFILE, 255)
        expect(result.wasBlocked).toBe(false)
        expect(result.isInLatch).toBe(false)
      }
    })

    it('Sin perfil → pass-through', () => {
      const result = bunker.filter('unknown-1', 50, undefined, 255)
      
      expect(result.finalColorDmx).toBe(50)
      expect(result.wasBlocked).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🚫 DEBOUNCE — Bloqueo por velocidad
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🚫 DEBOUNCE — Bloquea cambios demasiado rápidos', () => {
    
    it('Primer cambio siempre pasa', () => {
      const result = bunker.filter('beam-1', 15, MECHANICAL_PROFILE, 255)
      
      // Primer cambio: crea estado inicial con color 15
      // No hay cambio previo → no puede ser bloqueado por debounce
      expect(result.wasBlocked).toBe(false)
      expect(result.finalColorDmx).toBe(15)
    })

    it('Cambio dentro del minChangeTimeMs → BLOQUEADO', () => {
      // minChangeTimeMs = 500, safetyMargin = 1.2 → effectiveMin = 600ms
      
      // Primer cambio: establecer color 15
      bunker.filter('beam-1', 15, MECHANICAL_PROFILE, 255)
      
      // Avanzar 100ms (menos que 600ms)
      vi.advanceTimersByTime(100)
      
      // Segundo cambio: debería ser bloqueado
      const result = bunker.filter('beam-1', 30, MECHANICAL_PROFILE, 255)
      
      expect(result.wasBlocked).toBe(true)
      expect(result.finalColorDmx).toBe(15) // Mantiene color anterior
      expect(result.blockReason).toContain('DEBOUNCE')
    })

    it('Cambio después del minChangeTimeMs → PERMITIDO', () => {
      // Primer cambio
      bunker.filter('beam-1', 15, MECHANICAL_PROFILE, 255)
      
      // Avanzar 700ms (más que 600ms = 500 * 1.2)
      vi.advanceTimersByTime(700)
      
      // Segundo cambio: debería pasar
      const result = bunker.filter('beam-1', 30, MECHANICAL_PROFILE, 255)
      
      expect(result.wasBlocked).toBe(false)
      expect(result.finalColorDmx).toBe(30)
    })

    it('Mismo color repetido no cuenta como cambio (no bloquea)', () => {
      bunker.filter('beam-1', 15, MECHANICAL_PROFILE, 255)
      
      vi.advanceTimersByTime(100)
      
      // Mismo color → no hay "cambio", no debe bloquear
      const result = bunker.filter('beam-1', 15, MECHANICAL_PROFILE, 255)
      
      expect(result.wasBlocked).toBe(false)
      expect(result.finalColorDmx).toBe(15)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️ CHAOS DETECTION — >3 cambios/segundo
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('⚠️ CHAOS Detection — Más de 3 cambios/segundo activan LATCH', () => {
    
    it('4+ registros de color diferente en 1 segundo → LATCH activado', () => {
      // La clave: updateChangeHistory() registra CADA intento con color ≠ lastColorDmx,
      // incluso si DEBOUNCE lo bloquea después. Necesitamos 4+ registros en 1s.
      // 
      // Con minChangeTimeMs=500 y safetyMargin=1.2 → effectiveMin = 600ms
      // lastColorDmx se fija en el primer color y no cambia hasta que pase DEBOUNCE.
      // Cada color diferente al lastColorDmx SE REGISTRA en recentChanges.
      
      // t=0: Primer filter, crea estado con lastColorDmx=10
      bunker.filter('beam-1', 10, MECHANICAL_PROFILE, 255)
      
      // t=100: color 20 ≠ lastColorDmx(10) → registra en recentChanges. DEBOUNCE bloquea.
      vi.advanceTimersByTime(100)
      bunker.filter('beam-1', 20, MECHANICAL_PROFILE, 255)
      
      // t=200: color 30 ≠ lastColorDmx(10) → registra. DEBOUNCE bloquea.
      vi.advanceTimersByTime(100)
      bunker.filter('beam-1', 30, MECHANICAL_PROFILE, 255)
      
      // t=300: color 40 ≠ lastColorDmx(10) → registra. Ahora hay 3 en recentChanges.
      vi.advanceTimersByTime(100)
      bunker.filter('beam-1', 40, MECHANICAL_PROFILE, 255)
      
      // t=400: color 50 ≠ lastColorDmx(10) → registra = 4 in last second. CHAOS > 3!
      vi.advanceTimersByTime(100)
      const result = bunker.filter('beam-1', 50, MECHANICAL_PROFILE, 255)
      
      expect(result.isInLatch).toBe(true)
      expect(result.wasBlocked).toBe(true)
      expect(result.blockReason).toContain('CHAOS')
    })

    it('Cambios espaciados > 1s entre sí → no activan CHAOS', () => {
      bunker.filter('beam-1', 10, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(1100) // > 1 segundo
      
      bunker.filter('beam-1', 20, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(1100)
      
      bunker.filter('beam-1', 30, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(1100)
      
      const result = bunker.filter('beam-1', 40, MECHANICAL_PROFILE, 255)
      
      // Cada cambio está en un segundo diferente → nunca >3 en el mismo segundo
      expect(result.isInLatch).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 LATCH — Expiración a los 2000ms
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔒 LATCH — Expiración y liberación', () => {
    
    /** Helper: forzar activación de LATCH con 5 intentos rápidos de color diferente */
    function activateLatch(fixture: string): number {
      // Primer filter: establece estado con lastColorDmx=10
      bunker.filter(fixture, 10, MECHANICAL_PROFILE, 255)
      
      // 4 intentos rápidos con colores distintos → registra 4 en recentChanges → >3 = CHAOS
      vi.advanceTimersByTime(100)
      bunker.filter(fixture, 20, MECHANICAL_PROFILE, 255) // registra #1
      vi.advanceTimersByTime(100)
      bunker.filter(fixture, 30, MECHANICAL_PROFILE, 255) // registra #2
      vi.advanceTimersByTime(100)
      bunker.filter(fixture, 40, MECHANICAL_PROFILE, 255) // registra #3
      vi.advanceTimersByTime(100)
      const result = bunker.filter(fixture, 50, MECHANICAL_PROFILE, 255) // registra #4 → CHAOS!
      
      expect(result.isInLatch).toBe(true)
      return result.finalColorDmx // El color latched (lastColorDmx = 10)
    }
    
    it('Durante LATCH: todos los cambios son bloqueados', () => {
      const latchedColor = activateLatch('beam-latch')
      
      // Intentar cambiar color durante LATCH
      vi.advanceTimersByTime(500) // Aún dentro de los 2000ms
      const result = bunker.filter('beam-latch', 99, MECHANICAL_PROFILE, 255)
      
      expect(result.isInLatch).toBe(true)
      expect(result.wasBlocked).toBe(true)
      expect(result.finalColorDmx).toBe(latchedColor)
    })

    it('Después de 2000ms: LATCH expira y permite nuevos cambios', () => {
      activateLatch('beam-expire')
      
      // Avanzar EXACTAMENTE 2000ms para que expire
      vi.advanceTimersByTime(2000)
      
      // Siguiente cambio: LATCH expirado → puede avanzar
      // Pero el debounce puede bloquear si el cambio es muy rápido
      // Avanzar un poco más para superar el debounce
      vi.advanceTimersByTime(700)
      
      const result = bunker.filter('beam-expire', 99, MECHANICAL_PROFILE, 255)
      
      expect(result.isInLatch).toBe(false)
      // Puede ser bloqueado por debounce pero no por LATCH
    })

    it('LATCH mantiene el último color "bueno" (el anterior al caos)', () => {
      // Color estable inicial
      bunker.filter('beam-color', 50, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(1000)
      
      // Primer cambio caótico: 1100ms después del inicio → pasa DEBOUNCE (>600ms)
      // lastColorDmx se actualiza a 60
      vi.advanceTimersByTime(100)
      bunker.filter('beam-color', 60, MECHANICAL_PROFILE, 255)
      
      // Los siguientes son demasiado rápidos → DEBOUNCE los bloquea
      // pero updateChangeHistory los registra porque color ≠ lastColorDmx(60)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-color', 70, MECHANICAL_PROFILE, 255) // registra #1
      vi.advanceTimersByTime(100)
      bunker.filter('beam-color', 80, MECHANICAL_PROFILE, 255) // registra #2
      vi.advanceTimersByTime(100)
      bunker.filter('beam-color', 85, MECHANICAL_PROFILE, 255) // registra #3
      vi.advanceTimersByTime(100)
      
      // Este dispara CHAOS → LATCH
      const chaosResult = bunker.filter('beam-color', 90, MECHANICAL_PROFILE, 255) // registra #4 → >3!
      
      expect(chaosResult.isInLatch).toBe(true)
      // El color latched es lastColorDmx = 60 (el último que pasó DEBOUNCE)
      expect(chaosResult.finalColorDmx).toBe(60)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 KEA-006 — blockedChanges se resetea al expirar LATCH
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔧 KEA-006 — blockedChanges reset en LATCH expiry', () => {
    
    it('blockedChanges acumulados durante LATCH NO persisten después', () => {
      // Activar LATCH: 5 intentos rápidos
      bunker.filter('beam-kea006', 10, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-kea006', 20, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-kea006', 30, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-kea006', 40, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-kea006', 50, MECHANICAL_PROFILE, 255) // → LATCH
      
      // Bombardear con 15 cambios bloqueados durante LATCH
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(50)
        bunker.filter('beam-kea006', 50 + i, MECHANICAL_PROFILE, 255)
      }
      
      // Antes del fix KEA-006: blockedChanges = 15+ → shouldDelegateToStrobe = true PARA SIEMPRE
      
      // Expirar el LATCH
      vi.advanceTimersByTime(3000)
      
      // El primer filter después del LATCH expiry ejecuta el reset
      const postLatch = bunker.filter('beam-kea006', 99, MECHANICAL_PROFILE, 255)
      
      // Después de expirar LATCH:
      // - blockedChanges debe ser 0 (reset en KEA-006)
      // - delegateToStrobe debe ser false
      expect(postLatch.isInLatch).toBe(false)
      expect(postLatch.delegateToStrobe).toBe(false)
    })

    it('delegateToStrobe no se activa permanentemente después de 10 bloqueos históricos', () => {
      // Ejecutar 3 ciclos de LATCH completos
      for (let cycle = 0; cycle < 3; cycle++) {
        // Activar LATCH: 5 intentos rápidos con colores distintos
        bunker.filter('beam-perm', 10, MECHANICAL_PROFILE, 255)
        vi.advanceTimersByTime(100)
        bunker.filter('beam-perm', 20, MECHANICAL_PROFILE, 255)
        vi.advanceTimersByTime(100)
        bunker.filter('beam-perm', 30, MECHANICAL_PROFILE, 255)
        vi.advanceTimersByTime(100)
        bunker.filter('beam-perm', 40, MECHANICAL_PROFILE, 255)
        vi.advanceTimersByTime(100)
        bunker.filter('beam-perm', 50, MECHANICAL_PROFILE, 255) // → LATCH
        
        // Unos cuantos intentos bloqueados
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(100)
          bunker.filter('beam-perm', 50 + i, MECHANICAL_PROFILE, 255)
        }
        
        // Expirar LATCH
        vi.advanceTimersByTime(3000)
        
        // Filter post-LATCH (trigger reset)
        bunker.filter('beam-perm', 99, MECHANICAL_PROFILE, 255)
        vi.advanceTimersByTime(1000)
      }
      
      // Después de 3 ciclos: 15 bloqueos totales (>10 históricos)
      // Con el bug KEA-006: delegateToStrobe = true SIEMPRE
      // Con el fix: cada reset pone blockedChanges = 0
      
      // Esperamos y hacemos un cambio limpio
      vi.advanceTimersByTime(1000)
      const finalResult = bunker.filter('beam-perm', 5, MECHANICAL_PROFILE, 255)
      
      expect(finalResult.delegateToStrobe).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 📊 MÉTRICAS — Contadores globales
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('📊 Métricas — Contadores funcionan correctamente', () => {
    
    it('Métricas iniciales son cero', () => {
      const metrics = bunker.getMetrics()
      
      expect(metrics.totalBlockedChanges).toBe(0)
      expect(metrics.totalLatchActivations).toBe(0)
      expect(metrics.activeFixtures).toBe(0)
      expect(metrics.fixturesInLatch).toBe(0)
    })

    it('resetFixture limpia el estado de un fixture específico', () => {
      bunker.filter('beam-reset', 15, MECHANICAL_PROFILE, 255)
      expect(bunker.getMetrics().activeFixtures).toBe(1)
      
      bunker.resetFixture('beam-reset')
      expect(bunker.getMetrics().activeFixtures).toBe(0)
    })

    it('resetAll limpia todos los fixtures', () => {
      bunker.filter('beam-a', 15, MECHANICAL_PROFILE, 255)
      bunker.filter('beam-b', 30, MECHANICAL_PROFILE, 255)
      expect(bunker.getMetrics().activeFixtures).toBe(2)
      
      bunker.resetAll()
      expect(bunker.getMetrics().activeFixtures).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🎛️ MULTI-FIXTURE — Aislamiento de estados
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🎛️ Multi-Fixture — Estados independientes', () => {
    
    it('LATCH en fixture A no afecta a fixture B', () => {
      // Activar LATCH en beam-A: 5 intentos rápidos
      bunker.filter('beam-A', 10, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-A', 20, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-A', 30, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      bunker.filter('beam-A', 40, MECHANICAL_PROFILE, 255)
      vi.advanceTimersByTime(100)
      const resultA = bunker.filter('beam-A', 50, MECHANICAL_PROFILE, 255)
      expect(resultA.isInLatch).toBe(true)
      
      // beam-B debería funcionar normalmente
      vi.advanceTimersByTime(1000)
      const resultB = bunker.filter('beam-B', 50, MECHANICAL_PROFILE, 255)
      expect(resultB.isInLatch).toBe(false)
      expect(resultB.wasBlocked).toBe(false)
      expect(resultB.finalColorDmx).toBe(50)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 CONFIGURACIÓN — safetyMargin
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔧 Configuración — Safety margin', () => {
    
    it('safetyMargin multiplica el minChangeTimeMs del perfil', () => {
      // safetyMargin = 1.2 (default) → 500 * 1.2 = 600ms efectivo
      const conservativeBunker = new HardwareSafetyLayer({ safetyMargin: 2.0 })
      
      // Primer cambio
      conservativeBunker.filter('beam-margin', 15, MECHANICAL_PROFILE, 255)
      
      // Avanzar 700ms (> 600ms del default, < 1000ms del conservador)
      vi.advanceTimersByTime(700)
      
      // Con safetyMargin=2.0: effectiveMin = 500 * 2.0 = 1000ms
      // 700ms < 1000ms → BLOQUEADO
      const result = conservativeBunker.filter('beam-margin', 30, MECHANICAL_PROFILE, 255)
      
      expect(result.wasBlocked).toBe(true)
    })
  })
})
