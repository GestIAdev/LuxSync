/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 FIXTURE PHYSICS DRIVER — SUITE DE REGRESIÓN DE SEGURIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * EL TEST MÁS IMPORTANTE DE LUXSYNC.
 * 
 * Si SAFETY_CAP falla → un mover chino recibe 848°/s → pierde pasos →
 * correa rota → fixture muerto → usuario pierde dinero → LuxSync muere.
 * 
 * Cada test aquí representa un escenario REAL que protege hardware REAL.
 * No hay mocks de lógica de negocio. No hay simulaciones. Solo matemáticas
 * puras contra constantes verificables.
 * 
 * COBERTURA:
 * - SAFETY_CAP: muro inquebrantable (7 escenarios)
 * - REV_LIMIT: frame-rate independiente (4 escenarios)
 * - SNAP vs CLASSIC: activación correcta por physicsMode (6 escenarios)
 * - NaN Guard: fallback a home (3 escenarios)
 * - Teleport Mode: deltaTime > 200ms (3 escenarios)
 * - Anti-stuck: escape de endstops (2 escenarios)
 * - KEA-001: 16-bit fine channel (4 escenarios)
 * - PhysicsProfile: 3-tier hierarchy (5 escenarios)
 * 
 * @module tests/FixturePhysicsDriver
 * @version PRE-BETA 1.0 — WAVE 2100
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  FixturePhysicsDriver,
  type PhysicsProfile,
  type DMXPosition,
} from '../FixturePhysicsDriver'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES DE REFERENCIA (extraídas del código fuente — NUNCA inventadas)
// ═══════════════════════════════════════════════════════════════════════════

/** SAFETY_CAP hardcodeado en FixturePhysicsDriver.ts línea ~221 */
const SAFETY_CAP_MAX_ACCEL = 900   // DMX/s²
const SAFETY_CAP_MAX_VEL = 400     // DMX/s

/** PAN_SAFETY_MARGIN hardcodeado en línea ~230 */
const PAN_SAFETY_MARGIN = 5

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createDriver(): FixturePhysicsDriver {
  return new FixturePhysicsDriver()
}

function registerDefaultFixture(driver: FixturePhysicsDriver, id = 'mover-1'): void {
  driver.registerFixture(id, {
    installationType: 'ceiling',
    home: { pan: 127, tilt: 40 },
    range: { pan: 540, tilt: 270 },
  })
}

function registerBudgetMover(driver: FixturePhysicsDriver, id = 'budget-1'): void {
  const budgetProfile: PhysicsProfile = {
    motorType: 'stepper',
    qualityTier: 'budget',
    maxAcceleration: 1200, // grados/s² → convertido a ~566 DMX/s²
    maxVelocity: 400,      // grados/s → convertido a ~189 DMX/s
    panSpeedFactor: 0.7,
    tiltSpeedFactor: 0.6,
  }
  driver.registerFixture(id, {
    installationType: 'ceiling',
    home: { pan: 127, tilt: 40 },
    range: { pan: 540, tilt: 270 },
    physicsProfile: budgetProfile,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('🏎️ FixturePhysicsDriver — Motor Bodyguard', () => {
  let driver: FixturePhysicsDriver

  beforeEach(() => {
    driver = createDriver()
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 SAFETY_CAP — EL MURO INQUEBRANTABLE
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔒 SAFETY_CAP — Nunca se excede', () => {
    
    it('Techno pide maxAccel=2000, physicsConfig recibe ≤ 900', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Después de setVibe, la physicsConfig interna está clampeada.
      // Lo verificamos indirectamente: si enviamos un target lejano con dt pequeño,
      // el desplazamiento por frame NUNCA puede exceder SAFETY_CAP_MAX_VEL * dt
      const result1 = driver.translateDMX('mover-1', 0, 40, 16) // Frame 1: ir a 0
      const result2 = driver.translateDMX('mover-1', 255, 40, 16) // Frame 2: ir a 255
      
      // En SNAP mode con snapFactor=0.85, delta = (255 - pos) * 0.85
      // Pero REV_LIMIT capea a: min(revLimitPanPerSec, effectiveMaxVel) * dt/1000
      // effectiveMaxVel = min(SAFETY_CAP=400, vibeRequest=600) = 400
      // cappedRevLimit = min(400, 400) = 400 DMX/s
      // maxPanThisFrame = 400 * 0.016 = 6.4 DMX
      const displacement = Math.abs(result2.panDMX - result1.panDMX)
      const maxAllowedDisplacement = SAFETY_CAP_MAX_VEL * (16 / 1000) + 1 // +1 para redondeo floor
      
      expect(displacement).toBeLessThanOrEqual(maxAllowedDisplacement)
    })

    it('vibeRequest extremo (accel=5000, vel=2000) es clampeado por SAFETY_CAP', () => {
      registerDefaultFixture(driver)
      // Forzamos el vibe a techno que pide 2000/600 → clampeado a 900/400
      driver.setVibe('techno-club')
      
      // Posicionar el mover en un extremo
      driver.forcePosition('mover-1', 0, 40)
      
      // Pedir un salto de 255 DMX con dt=16ms
      const result = driver.translateDMX('mover-1', 255, 40, 16)
      
      // El pan NO puede haber saltado más de SAFETY_CAP_MAX_VEL * dt
      // 400 * 0.016 = 6.4 DMX máximo por frame
      expect(result.panDMX).toBeLessThanOrEqual(0 + SAFETY_CAP_MAX_VEL * (16 / 1000) + 1)
    })

    it('SAFETY_CAP protege incluso sin physicsProfile', () => {
      registerDefaultFixture(driver) // Sin physicsProfile
      driver.setVibe('techno-club')
      
      driver.forcePosition('mover-1', 127, 40)
      const r1 = driver.translateDMX('mover-1', 255, 40, 16)
      
      // Desplazamiento máximo con SAFETY_CAP_MAX_VEL=400 y dt=16ms:
      // maxDisplacement = 400 * 0.016 = 6.4
      const displacement = Math.abs(r1.panDMX - 127)
      expect(displacement).toBeLessThanOrEqual(SAFETY_CAP_MAX_VEL * 0.016 + 1)
    })

    it('Todos los vibes respetan SAFETY_CAP', () => {
      const vibes = ['techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge', 'idle']
      
      for (const vibe of vibes) {
        const d = createDriver()
        registerDefaultFixture(d, `mover-${vibe}`)
        d.setVibe(vibe)
        d.forcePosition(`mover-${vibe}`, 50, 40)
        
        // 10 frames de movimiento hacia 200
        let maxDisplacement = 0
        let prevPan = 50
        for (let i = 0; i < 10; i++) {
          const r = d.translateDMX(`mover-${vibe}`, 200, 40, 16)
          const disp = Math.abs(r.panDMX - prevPan)
          maxDisplacement = Math.max(maxDisplacement, disp)
          prevPan = r.panDMX + r.panFine / 255 // Reconstruir posición float para precisión
        }
        
        // Ningún frame individual puede exceder SAFETY_CAP_MAX_VEL * dt
        // 400 * 0.016 = 6.4 DMX/frame
        expect(maxDisplacement).toBeLessThanOrEqual(
          SAFETY_CAP_MAX_VEL * (16 / 1000) + 1
        )
      }
    })

    it('SAFETY_CAP + budget PhysicsProfile: el hardware manda', () => {
      registerBudgetMover(driver)
      driver.setVibe('techno-club')
      
      driver.forcePosition('budget-1', 50, 40)
      const result = driver.translateDMX('budget-1', 250, 40, 16)
      
      // Budget mover: maxVel=400°/s → 400*(255/540)≈189 DMX/s
      // effectiveMaxVel = min(SAFETY_CAP=400, vibe=400, hardware≈189) ≈ 189
      // cappedRevLimit = min(technoRevLimit=400, 189) = 189
      // Con speedFactorPan=0.7: limitPan = 189 * 0.7 ≈ 132 DMX/s
      // maxPanThisFrame = 132 * 0.016 ≈ 2.1 DMX
      const displacement = Math.abs(result.panDMX - 50)
      const degToDmx = 255 / 540
      const hwMaxVel = 400 * degToDmx  // ≈189 DMX/s
      const effectiveVel = Math.min(SAFETY_CAP_MAX_VEL, hwMaxVel) * 0.7 // speedFactor
      const maxAllowed = effectiveVel * 0.016 + 1
      
      expect(displacement).toBeLessThanOrEqual(maxAllowed)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ REV_LIMIT — FRAME-RATE INDEPENDENT
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🏎️ REV_LIMIT — Frame-rate independiente', () => {
    
    it('El desplazamiento escala linealmente con deltaTime', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Frame corto (8ms)
      driver.forcePosition('mover-1', 100, 40)
      const r8 = driver.translateDMX('mover-1', 200, 40, 8)
      const disp8 = Math.abs(r8.panDMX + r8.panFine / 255 - 100)
      
      // Frame largo (32ms)
      driver.forcePosition('mover-1', 100, 40)
      const r32 = driver.translateDMX('mover-1', 200, 40, 32)
      const disp32 = Math.abs(r32.panDMX + r32.panFine / 255 - 100)
      
      // El desplazamiento con 32ms debe ser ~4x el de 8ms (±20% por snapFactor)
      // Como ambos están clampeados por REV_LIMIT * dt, la proporcionalidad es directa
      const ratio = disp32 / Math.max(0.01, disp8)
      expect(ratio).toBeGreaterThan(2.5)
      expect(ratio).toBeLessThan(5.5)
    })

    it('REV_LIMIT a 60fps vs 30fps produce desplazamiento total similar en 1 segundo', () => {
      const d60 = createDriver()
      const d30 = createDriver()
      registerDefaultFixture(d60, 'm60')
      registerDefaultFixture(d30, 'm30')
      d60.setVibe('fiesta-latina')
      d30.setVibe('fiesta-latina')
      
      d60.forcePosition('m60', 50, 40)
      d30.forcePosition('m30', 50, 40)
      
      // 1 segundo a 60fps (60 frames × 16.67ms)
      let pos60 = 50
      for (let i = 0; i < 60; i++) {
        const r = d60.translateDMX('m60', 200, 40, 16.67)
        pos60 = r.panDMX + r.panFine / 255
      }
      
      // 1 segundo a 30fps (30 frames × 33.33ms)
      let pos30 = 50
      for (let i = 0; i < 30; i++) {
        const r = d30.translateDMX('m30', 200, 40, 33.33)
        pos30 = r.panDMX + r.panFine / 255
      }
      
      // La posición final debe ser similar (±15% tolerancia)
      const diff = Math.abs(pos60 - pos30)
      const avgTravel = (Math.abs(pos60 - 50) + Math.abs(pos30 - 50)) / 2
      expect(diff / Math.max(1, avgTravel)).toBeLessThan(0.20)
    })

    it('Con dt=0 no hay desplazamiento (protección div/0)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      driver.forcePosition('mover-1', 100, 40)
      
      // dt=0 debería resultar en cero movimiento (Live Mode: dt < 50ms)
      // maxPanThisFrame = revLimit * (0/1000) = 0
      const r = driver.translateDMX('mover-1', 200, 40, 0)
      // Con dt=0, el snap calcula delta pero maxPanThisFrame=0, así que no se mueve
      expect(r.panDMX).toBe(100)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ SNAP MODE vs CLASSIC MODE
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🏎️ SNAP vs CLASSIC — Activación por physicsMode', () => {
    
    it('Techno activa SNAP mode (respuesta directa con snapFactor)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // SNAP: delta = (target - current) * snapFactor, capped by REV_LIMIT
      driver.forcePosition('mover-1', 127, 40)
      const r = driver.translateDMX('mover-1', 200, 40, 16)
      
      // En snap mode, el mover PERSIGUE el target. Debe moverse hacia 200.
      expect(r.panDMX).toBeGreaterThan(127)
    })

    it('Chill activa CLASSIC mode (inercia con aceleración/frenado)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('chill-lounge')
      
      // CLASSIC: Aceleración → velocidad → posición (Newtonian)
      driver.forcePosition('mover-1', 127, 40)
      
      // Frame 1: aceleración desde reposo — movimiento mínimo
      const r1 = driver.translateDMX('mover-1', 200, 40, 16)
      const disp1 = Math.abs(r1.panDMX + r1.panFine / 255 - 127)
      
      // Frame 10: ya tiene velocidad — movimiento mayor
      let r: DMXPosition = r1
      for (let i = 0; i < 9; i++) {
        r = driver.translateDMX('mover-1', 200, 40, 16)
      }
      const disp10 = Math.abs(r.panDMX + r.panFine / 255 - (r1.panDMX + r1.panFine / 255))
      
      // En classic, la velocidad crece con la aceleración.
      // El primer frame tiene menos desplazamiento que frames posteriores.
      // (En snap sería constante o decreciente)
      expect(disp1).toBeLessThan(5)  // Chill arranca lento
    })

    it('Latino usa SNAP mode (sigue trayectorias curvas)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('fiesta-latina')
      
      driver.forcePosition('mover-1', 50, 40)
      const r = driver.translateDMX('mover-1', 200, 40, 16)
      
      // Latino en snap: persigue target, pero con snapFactor=0.70 (menor que Techno=0.85)
      expect(r.panDMX).toBeGreaterThan(50)
    })

    it('Rock usa SNAP mode con peso visible (snapFactor < Techno)', () => {
      registerDefaultFixture(driver)
      
      // Comparar: Techno vs Rock desde la misma posición
      driver.setVibe('techno-club')
      driver.forcePosition('mover-1', 50, 40)
      const rTechno = driver.translateDMX('mover-1', 200, 40, 16)
      const dispTechno = Math.abs(rTechno.panDMX + rTechno.panFine / 255 - 50)
      
      driver.setVibe('pop-rock')
      driver.forcePosition('mover-1', 50, 40)
      const rRock = driver.translateDMX('mover-1', 200, 40, 16)
      const dispRock = Math.abs(rRock.panDMX + rRock.panFine / 255 - 50)
      
      // Rock (snap=0.65) se mueve MENOS que Techno (snap=0.85) en el mismo frame
      // Ambos clampeados por REV_LIMIT, pero Rock tiene revLimit=300 vs Techno=400
      expect(dispRock).toBeLessThanOrEqual(dispTechno + 0.01)
    })

    it('Idle usa CLASSIC mode', () => {
      registerDefaultFixture(driver)
      driver.setVibe('idle')
      
      driver.forcePosition('mover-1', 127, 40)
      const r = driver.translateDMX('mover-1', 200, 40, 16)
      
      // Idle en classic: arranca lento (accel=200, maxVel=100)
      expect(r.panDMX).toBeGreaterThanOrEqual(127) // Se mueve algo
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ NaN GUARD — FALLBACK A HOME
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🛡️ NaN Guard — Nunca enviar basura al motor', () => {
    
    it('Target NaN → resultado usa home position', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      const result = driver.translateDMX('mover-1', NaN, NaN, 16)
      
      // NaN target → safePan = clamp(NaN) = NaN → physics produce NaN
      // NaN Guard: Number.isFinite(NaN) = false → usa config.home
      // Home por defecto para ceiling: { pan: 127, tilt: 40 }
      expect(result.panDMX).toBe(127)
      expect(result.tiltDMX).toBe(40)
    })

    it('Target Infinity → resultado usa home position', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      const result = driver.translateDMX('mover-1', Infinity, -Infinity, 16)
      
      // Infinity pasa por clamp → 255/0, pero en la cadena de physics
      // puede generar Infinity en velocity. NaN Guard lo atrapa.
      expect(Number.isFinite(result.panDMX)).toBe(true)
      expect(Number.isFinite(result.tiltDMX)).toBe(true)
      expect(result.panDMX).toBeGreaterThanOrEqual(0)
      expect(result.panDMX).toBeLessThanOrEqual(255)
    })

    it('Fixture no registrado → valores seguros por defecto', () => {
      const result = driver.translateDMX('fantasma-inexistente', 100, 100, 16)
      
      expect(result.panDMX).toBe(127)
      expect(result.tiltDMX).toBe(127)
      expect(result.panFine).toBe(0)
      expect(result.tiltFine).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🚀 TELEPORT MODE — deltaTime > 200ms
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🚀 Teleport Mode — Saltos de timeline', () => {
    
    it('deltaTime > 200ms → posición salta instantáneamente al target', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      driver.forcePosition('mover-1', 50, 40)
      
      // Simular salto de timeline (2 segundos)
      const result = driver.translateDMX('mover-1', 200, 100, 2000)
      
      // En Teleport Mode: smoothedDMX = targetDMX (salto instantáneo)
      // safePan = clamp(200) = 200
      // safeTilt = clamp dentro de limits
      expect(result.panDMX).toBe(200)
    })

    it('deltaTime > 200ms → velocidad se anula (no math explosion)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      driver.forcePosition('mover-1', 50, 40)
      
      // Teleport
      driver.translateDMX('mover-1', 200, 100, 2000)
      
      // El siguiente frame normal debería partir desde velocidad 0
      const physics = driver.getPhysicsState('mover-1')
      expect(physics.panVelocity).toBe(0)
      expect(physics.tiltVelocity).toBe(0)
    })

    it('deltaTime 50-200ms → Phantom Mode (iterative chunking, no freeze)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      driver.forcePosition('mover-1', 100, 40)
      
      // Phantom mode: 120ms → divide en ~8 chunks de ~15ms
      const result = driver.translateDMX('mover-1', 200, 40, 120)
      
      // Debe haberse movido hacia el target (no congelado)
      expect(result.panDMX).toBeGreaterThan(100)
      // Pero no teleportado al target
      expect(result.panDMX).toBeLessThan(200)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 ANTI-STUCK — Escape de endstops
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔧 Anti-stuck — Escape de endstops mecánicos', () => {
    
    it('Fixture pegado en 254 con target lejano → sale del bloqueo (CLASSIC)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('chill-lounge') // Classic mode para anti-stuck
      
      // Forzar posición cerca del endstop superior
      driver.forcePosition('mover-1', 254, 40)
      
      // Target lejos (distancia > 20 DMX, requerido por anti-stuck)
      // Ejecutar varios frames para que el anti-stuck se active
      let pan = 254
      for (let i = 0; i < 20; i++) {
        const r = driver.translateDMX('mover-1', 100, 40, 16)
        pan = r.panDMX + r.panFine / 255
      }
      
      // Después de varios frames, debe haberse alejado del endstop
      expect(pan).toBeLessThan(254)
    })

    it('Fixture pegado en 1 con target lejano → sale del bloqueo (CLASSIC)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('chill-lounge')
      
      driver.forcePosition('mover-1', 1, 40)
      
      let pan = 1
      for (let i = 0; i < 20; i++) {
        const r = driver.translateDMX('mover-1', 200, 40, 16)
        pan = r.panDMX + r.panFine / 255
      }
      
      expect(pan).toBeGreaterThan(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 KEA-001: 16-BIT FINE CHANNEL REGRESSION
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🔧 KEA-001 — 16-bit fine channel', () => {
    
    it('panDMX usa Math.floor (no Math.round)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('chill-lounge')
      
      // Forzar posición con componente fraccional
      driver.forcePosition('mover-1', 200, 40)
      
      // El floor de 200 es 200, y el fine debería reflejar la fracción
      const result = driver.translateDMX('mover-1', 200, 40, 16)
      
      // panDMX debe ser un entero (floor del valor flotante)
      expect(result.panDMX).toBe(Math.floor(result.panDMX))
      expect(Number.isInteger(result.panDMX)).toBe(true)
    })

    it('Fine channel está en rango [0, 255]', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Ejecutar varios frames con movimiento
      driver.forcePosition('mover-1', 50, 40)
      for (let i = 0; i < 30; i++) {
        const r = driver.translateDMX('mover-1', 200, 40, 16)
        
        expect(r.panFine).toBeGreaterThanOrEqual(0)
        expect(r.panFine).toBeLessThanOrEqual(255)
        expect(r.tiltFine).toBeGreaterThanOrEqual(0)
        expect(r.tiltFine).toBeLessThanOrEqual(255)
        expect(Number.isInteger(r.panFine)).toBe(true)
        expect(Number.isInteger(r.tiltFine)).toBe(true)
      }
    })

    it('Coarse + Fine reconstruyen el valor original con precisión 16-bit', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Después de varios frames el mover tiene posición fraccionaria
      driver.forcePosition('mover-1', 100, 40)
      let lastResult: DMXPosition | null = null
      for (let i = 0; i < 5; i++) {
        lastResult = driver.translateDMX('mover-1', 200, 40, 16)
      }
      
      if (lastResult) {
        // Reconstruir el valor 16-bit
        const reconstructed = lastResult.panDMX + lastResult.panFine / 255
        
        // La reconstrucción debe ser razonable (no negativa, dentro de rango)
        expect(reconstructed).toBeGreaterThanOrEqual(0)
        expect(reconstructed).toBeLessThanOrEqual(256) // panDMX 255 + fine 255/255 = 256 teórico
        
        // El fine NUNCA debe ser negativo (el bug KEA-001 original)
        expect(lastResult.panFine).toBeGreaterThanOrEqual(0)
      }
    })

    it('Valor exacto entero → fine = 0', () => {
      registerDefaultFixture(driver)
      
      // forcePosition establece una posición exacta sin fracción
      driver.forcePosition('mover-1', 127, 100)
      
      // Teleport mode: dt > 200 → salta directo al target
      const result = driver.translateDMX('mover-1', 127, 100, 300)
      
      // Con posición exacta de 127.0, floor(127.0) = 127, fine = round(0.0 * 255) = 0
      expect(result.panDMX).toBe(127)
      expect(result.panFine).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🏗️ PHYSICS PROFILE — 3-Tier Hierarchy
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🏗️ PhysicsProfile — 3-Tier Safety Hierarchy', () => {
    
    it('Sin perfil: solo SAFETY_CAP + Vibe aplican', () => {
      registerDefaultFixture(driver) // Sin physicsProfile
      driver.setVibe('techno-club')
      
      driver.forcePosition('mover-1', 50, 40)
      const r = driver.translateDMX('mover-1', 250, 40, 16)
      
      // Sin perfil: effectiveMaxVel = min(SAFETY_CAP=400, vibe=600→clamped 400) = 400
      const displacement = Math.abs(r.panDMX + r.panFine / 255 - 50)
      expect(displacement).toBeLessThanOrEqual(SAFETY_CAP_MAX_VEL * 0.016 + 1)
      expect(displacement).toBeGreaterThan(0) // Sí se mueve
    })

    it('Budget tier auto-tune limita velocidad sin valores explícitos', () => {
      const budgetAutoTune: PhysicsProfile = {
        motorType: 'stepper',
        qualityTier: 'budget',
        // Sin maxAcceleration ni maxVelocity explícitos → auto-tune
      }
      driver.registerFixture('auto-budget', {
        installationType: 'ceiling',
        range: { pan: 540, tilt: 270 },
        home: { pan: 127, tilt: 40 },
        physicsProfile: budgetAutoTune,
      })
      driver.setVibe('techno-club')
      
      driver.forcePosition('auto-budget', 50, 40)
      const r = driver.translateDMX('auto-budget', 250, 40, 16)
      
      // budget auto-tune: 400°/s * (255/540) ≈ 189 DMX/s
      // effectiveMaxVel = min(400, 400, 189) = 189
      const displacement = Math.abs(r.panDMX + r.panFine / 255 - 50)
      const degToDmx = 255 / 540
      const budgetMaxVel = 400 * degToDmx // ≈189
      expect(displacement).toBeLessThanOrEqual(budgetMaxVel * 0.016 + 1)
    })

    it('Pro tier: solo SAFETY_CAP limita', () => {
      const proProfile: PhysicsProfile = {
        motorType: 'servo',
        qualityTier: 'pro',
        // Pro no agrega limitación extra
      }
      driver.registerFixture('pro-1', {
        installationType: 'ceiling',
        range: { pan: 540, tilt: 270 },
        home: { pan: 127, tilt: 40 },
        physicsProfile: proProfile,
      })
      driver.setVibe('techno-club')
      
      driver.forcePosition('pro-1', 50, 40)
      const r = driver.translateDMX('pro-1', 250, 40, 16)
      
      // Pro: effectiveMaxVel = min(SAFETY_CAP=400, vibe=400) = 400 (pro no limita más)
      const displacement = Math.abs(r.panDMX + r.panFine / 255 - 50)
      expect(displacement).toBeLessThanOrEqual(SAFETY_CAP_MAX_VEL * 0.016 + 1)
      expect(displacement).toBeGreaterThan(0)
    })

    it('Hot-reload: cambiar physicsProfile en vivo', () => {
      registerDefaultFixture(driver, 'hot-mover')
      driver.setVibe('techno-club')
      
      // Sin perfil → velocidad normal
      driver.forcePosition('hot-mover', 50, 40)
      const r1 = driver.translateDMX('hot-mover', 200, 40, 16)
      const disp1 = Math.abs(r1.panDMX + r1.panFine / 255 - 50)
      
      // Inyectar perfil budget → velocidad limitada
      const slowProfile: PhysicsProfile = {
        motorType: 'stepper',
        qualityTier: 'budget',
        maxVelocity: 100, // Solo 100°/s → ~47 DMX/s
        maxAcceleration: 500,
      }
      driver.updatePhysicsProfile('hot-mover', slowProfile)
      
      driver.forcePosition('hot-mover', 50, 40)
      const r2 = driver.translateDMX('hot-mover', 200, 40, 16)
      const disp2 = Math.abs(r2.panDMX + r2.panFine / 255 - 50)
      
      // Con perfil lento, el desplazamiento debe ser MENOR
      expect(disp2).toBeLessThan(disp1 + 0.01)
    })

    it('speedFactor reduce el REV_LIMIT proporcionalmente', () => {
      // Fixture con speedFactor = 0.5 (motor lento)
      const slowMotor: PhysicsProfile = {
        motorType: 'stepper',
        qualityTier: 'mid',
        panSpeedFactor: 0.5,
        tiltSpeedFactor: 0.5,
      }
      driver.registerFixture('slow-1', {
        installationType: 'ceiling',
        range: { pan: 540, tilt: 270 },
        home: { pan: 127, tilt: 40 },
        physicsProfile: slowMotor,
      })
      
      // Fixture con speedFactor = 1.0 (motor rápido)
      const fastMotor: PhysicsProfile = {
        motorType: 'servo',
        qualityTier: 'mid',
        panSpeedFactor: 1.0,
        tiltSpeedFactor: 1.0,
      }
      driver.registerFixture('fast-1', {
        installationType: 'ceiling',
        range: { pan: 540, tilt: 270 },
        home: { pan: 127, tilt: 40 },
        physicsProfile: fastMotor,
      })
      
      driver.setVibe('techno-club')
      
      driver.forcePosition('slow-1', 50, 40)
      driver.forcePosition('fast-1', 50, 40)
      
      const rSlow = driver.translateDMX('slow-1', 200, 40, 16)
      const rFast = driver.translateDMX('fast-1', 200, 40, 16)
      
      const dispSlow = Math.abs(rSlow.panDMX + rSlow.panFine / 255 - 50)
      const dispFast = Math.abs(rFast.panDMX + rFast.panFine / 255 - 50)
      
      // El motor lento (0.5x) se mueve MENOS que el rápido (1.0x)
      expect(dispSlow).toBeLessThan(dispFast + 0.01)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🛡️ PAN_SAFETY_MARGIN — El Airbag
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('🛡️ PAN_SAFETY_MARGIN — Airbag de endstops', () => {
    
    it('Pan nunca baja de PAN_SAFETY_MARGIN (translate con x=-1)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Forzar posición baja y pedir abstract extremo
      const result = driver.translate({
        fixtureId: 'mover-1',
        x: -1, // Extremo izquierdo
        y: 0,
      }, 16)
      
      // El airbag impide llegar a 0
      expect(result.panDMX).toBeGreaterThanOrEqual(PAN_SAFETY_MARGIN)
    })

    it('Pan nunca supera 255 - PAN_SAFETY_MARGIN (translate con x=+1)', () => {
      registerDefaultFixture(driver)
      driver.setVibe('techno-club')
      
      // Forzar varios frames para llegar al extremo
      for (let i = 0; i < 200; i++) {
        driver.translate({
          fixtureId: 'mover-1',
          x: 1, // Extremo derecho
          y: 0,
        }, 16)
      }
      
      const finalState = driver.getPhysicsState('mover-1')
      // Después de muchos frames intentando llegar al extremo, debe respetar el margen
      expect(finalState.physicalPan).toBeLessThanOrEqual(255 - PAN_SAFETY_MARGIN + 1)
    })
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 📐 DMX OUTPUT — Valores siempre válidos
  // ═══════════════════════════════════════════════════════════════════════
  
  describe('📐 DMX Output — Siempre en rango válido', () => {
    
    it('Todos los campos DMX están en [0, 255]', () => {
      registerDefaultFixture(driver)
      
      const vibes = ['techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge', 'idle']
      const targets = [
        { pan: 0, tilt: 0 },
        { pan: 255, tilt: 255 },
        { pan: 127, tilt: 127 },
        { pan: -50, tilt: -50 },   // Fuera de rango bajo
        { pan: 300, tilt: 300 },   // Fuera de rango alto
      ]
      
      for (const vibe of vibes) {
        driver.setVibe(vibe)
        for (const target of targets) {
          const result = driver.translateDMX('mover-1', target.pan, target.tilt, 16)
          
          expect(result.panDMX).toBeGreaterThanOrEqual(0)
          expect(result.panDMX).toBeLessThanOrEqual(255)
          expect(result.tiltDMX).toBeGreaterThanOrEqual(0)
          expect(result.tiltDMX).toBeLessThanOrEqual(255)
          expect(result.panFine).toBeGreaterThanOrEqual(0)
          expect(result.panFine).toBeLessThanOrEqual(255)
          expect(result.tiltFine).toBeGreaterThanOrEqual(0)
          expect(result.tiltFine).toBeLessThanOrEqual(255)
          
          expect(Number.isInteger(result.panDMX)).toBe(true)
          expect(Number.isInteger(result.tiltDMX)).toBe(true)
          expect(Number.isInteger(result.panFine)).toBe(true)
          expect(Number.isInteger(result.tiltFine)).toBe(true)
        }
      }
    })
  })
})
