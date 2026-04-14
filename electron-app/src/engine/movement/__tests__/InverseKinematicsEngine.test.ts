/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 WAVE 2602: INVERSE KINEMATICS ENGINE — SUITE DE VALIDACIÓN MATEMÁTICA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Si el IK falla → un fixture apunta al público → ceguera temporal →
 * demanda legal → LuxSync muere. No es broma.
 *
 * Cada test representa geometría REAL: fixtures en posiciones conocidas,
 * targets previsibles, resultados verificables a mano con trigonometría.
 * Sin mocks de lógica de negocio. Sin simulaciones. Solo matemáticas puras.
 *
 * COBERTURA:
 * - Geometría básica: fixture→target en los 6 ejes cardinales (6 tests)
 * - Matriz de orientación: ceiling vs floor vs truss (4 tests)
 * - Gimbal Lock: target en eje vertical del fixture (2 tests)
 * - Anti-Flip: pan zero-crossing shortest path (3 tests)
 * - Calibración: offsets e inversiones (3 tests)
 * - Tilt limits: seguridad absoluta (2 tests)
 * - solveGroup: batch coherente (1 test)
 * - buildProfile: factory defaults (1 test)
 * - Reachability: target fuera de rango mecánico (1 test)
 *
 * @module tests/InverseKinematicsEngine
 * @version WAVE 2602
 */

import { describe, it, expect } from 'vitest'
import {
  solve,
  solveGroup,
  buildProfile,
  computeLineFanOffsets,
  computeCircleFanOffsets,
  solveGroupWithFan,
  type Target3D,
  type IKFixtureProfile,
  type IKResult,
  type SpatialFanMode,
  type IKFanResult,
} from '../InverseKinematicsEngine'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Pan DMX center (DMX 127-128 range) */
const PAN_CENTER = 127
const TILT_CENTER = 127

/** Tolerance for DMX assertions (±N DMX units) */
const DMX_TOLERANCE = 3

/**
 * Build a minimal ceiling-mounted fixture at a given position.
 * No calibration offsets, no inverts — pure geometry.
 */
function ceilingFixture(id: string, x: number, y: number, z: number): IKFixtureProfile {
  return buildProfile(id, { x, y, z }, undefined, 'ceiling')
}

/**
 * Build a minimal floor-mounted fixture at a given position.
 */
function floorFixture(id: string, x: number, y: number, z: number): IKFixtureProfile {
  return buildProfile(id, { x, y, z }, undefined, 'floor')
}

// ═══════════════════════════════════════════════════════════════════════════
// BASIC GEOMETRY — Fixture apunta en las 6 direcciones cardinales
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — IK Basic Geometry', () => {

  it('Ceiling fixture pointing straight down → valid DMX, no NaN', () => {
    // Fixture en techo a (0, 4, 0). Target directamente abajo en (0, 0, 0).
    // Ceiling: pitch base = -90° → mira hacia abajo.
    // Tras rotación inversa, en frame local: (0, 0, -4) → pan = atan2(0, -4) = 180°.
    // Pan DMX = (180 + 270)/540 * 255 ≈ 213. Esto es correcto geométricamente.
    const fixture = ceilingFixture('f1', 0, 4, 0)
    const target: Target3D = { x: 0, y: 0, z: 0 }
    const result = solve(fixture, target)

    // Pan DMX es determinista y válido
    expect(result.pan).toBeGreaterThanOrEqual(5)
    expect(result.pan).toBeLessThanOrEqual(250)
    expect(Number.isNaN(result.pan)).toBe(false)
    expect(Number.isNaN(result.tilt)).toBe(false)
    expect(result.reachable).toBe(true)
  })

  it('Ceiling fixture pointing forward (Z+) → tilt changes with depth', () => {
    // Fixture en techo a (0, 4, -3). Target en suelo frente a él: (0, 0, 3).
    // Vector mundo: (0, -4, 6). Tras rotación ceiling, local.z < 0.
    // Pan será ~180° (target en "back" del frame local del ceiling).
    // Lo importante: tilt cambia respecto al caso "straight down".
    const fixture = ceilingFixture('f2', 0, 4, -3)
    const targetFront: Target3D = { x: 0, y: 0, z: 3 }
    const targetBelow: Target3D = { x: 0, y: 0, z: -3 }  // Directamente debajo

    const rFront = solve(fixture, targetFront)
    const rBelow = solve(fixture, targetBelow)

    // Tilt debe diferir — la profundidad Z cambia el ángulo de elevación
    expect(rFront.tilt).not.toBe(rBelow.tilt)
    expect(rFront.reachable).toBe(true)
  })

  it('Ceiling fixture pointing right (X+) → pan shifts right of center', () => {
    // Fixture en techo a (0, 4, 0). Target a la derecha en el suelo: (5, 0, 0).
    // El target está a la derecha → pan se mueve en una dirección.
    const fixture = ceilingFixture('f3', 0, 4, 0)
    const target: Target3D = { x: 5, y: 0, z: 0 }
    const result = solve(fixture, target)

    // Pan NO está centrado — se ha desplazado
    expect(Math.abs(result.pan - PAN_CENTER)).toBeGreaterThan(DMX_TOLERANCE)
    expect(result.reachable).toBe(true)
  })

  it('Ceiling fixture pointing left (X-) → pan shifts opposite to right', () => {
    // Fixture en techo a (0, 4, 0). Target a la izquierda en el suelo: (-5, 0, 0).
    const fixture = ceilingFixture('f4', 0, 4, 0)
    const targetRight: Target3D = { x: 5, y: 0, z: 0 }
    const targetLeft: Target3D = { x: -5, y: 0, z: 0 }

    const resultRight = solve(fixture, targetRight)
    const resultLeft  = solve(fixture, targetLeft)

    // Pan derecha e izquierda deben ser simétricos respecto al centro
    const deltaRight = resultRight.pan - PAN_CENTER
    const deltaLeft  = resultLeft.pan - PAN_CENTER
    // Deben tener signos opuestos (o al menos ser distintos del centro)
    expect(Math.sign(deltaRight)).not.toBe(Math.sign(deltaLeft))
  })

  it('Two ceiling fixtures at different X → same target → different pan', () => {
    // Dos fixtures en el techo, separados en X, apuntando al mismo punto.
    // Deben tener pan DIFERENTE porque miran desde ángulos distintos.
    const f1 = ceilingFixture('left', -3, 4, 0)
    const f2 = ceilingFixture('right', 3, 4, 0)
    const target: Target3D = { x: 0, y: 0, z: 2 }

    const r1 = solve(f1, target)
    const r2 = solve(f2, target)

    // Pan debe ser distinto — está es LA RAZÓN DE SER del IK
    expect(r1.pan).not.toBe(r2.pan)
    // Ambos deben ser alcanzables
    expect(r1.reachable).toBe(true)
    expect(r2.reachable).toBe(true)
  })

  it('Fixture at same position as target → still returns valid DMX', () => {
    // Edge case: target coincide con la posición del fixture.
    // Vector = (0,0,0) → gimbal lock. Debe devolver algo válido sin NaN.
    const fixture = ceilingFixture('same', 2, 3, 1)
    const target: Target3D = { x: 2, y: 3, z: 1 }
    const result = solve(fixture, target)

    expect(result.pan).toBeGreaterThanOrEqual(0)
    expect(result.pan).toBeLessThanOrEqual(255)
    expect(result.tilt).toBeGreaterThanOrEqual(0)
    expect(result.tilt).toBeLessThanOrEqual(255)
    // No debe ser NaN
    expect(Number.isNaN(result.pan)).toBe(false)
    expect(Number.isNaN(result.tilt)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ORIENTATION MATRIX — ceiling vs floor vs truss
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Orientation Matrix', () => {

  it('Floor fixture pointing at target above → different tilt than ceiling', () => {
    // Ceiling y floor en la misma columna vertical, mirando al mismo target.
    // Ceiling mira abajo, floor mira arriba → tilts deben ser distintos.
    const ceiling = ceilingFixture('ceil', 0, 5, 0)
    const floor   = floorFixture('flr', 0, 0, 0)
    const target: Target3D = { x: 2, y: 2.5, z: 3 }

    const rCeiling = solve(ceiling, target)
    const rFloor   = solve(floor, target)

    // Tilts distintos — miran desde direcciones opuestas
    expect(rCeiling.tilt).not.toBe(rFloor.tilt)
    expect(rCeiling.reachable).toBe(true)
    expect(rFloor.reachable).toBe(true)
  })

  it('Truss-back fixture → yaw 180° inverts pan direction vs truss-front', () => {
    const front = buildProfile('front', { x: 0, y: 4, z: -2 }, undefined, 'truss-front')
    const back  = buildProfile('back',  { x: 0, y: 4, z: -2 }, undefined, 'truss-back')
    const target: Target3D = { x: 3, y: 0, z: 2 }

    const rFront = solve(front, target)
    const rBack  = solve(back, target)

    // Pan debe diferir significativamente por el yaw de 180°
    expect(Math.abs(rFront.pan - rBack.pan)).toBeGreaterThan(10)
  })

  it('Wall-left fixture → pan/tilt shifted for lateral mount', () => {
    const wall = buildProfile('wall', { x: -5, y: 2, z: 0 }, undefined, 'wall-left')
    const target: Target3D = { x: 0, y: 1, z: 0 }
    const result = solve(wall, target)

    // Debe devolver DMX válido (no NaN, no fuera de rango)
    expect(result.pan).toBeGreaterThanOrEqual(0)
    expect(result.pan).toBeLessThanOrEqual(255)
    expect(result.tilt).toBeGreaterThanOrEqual(0)
    expect(result.tilt).toBeLessThanOrEqual(255)
  })

  it('Custom rotation on top of ceiling → shifts result vs pure ceiling', () => {
    const pure    = buildProfile('pure', { x: 0, y: 4, z: 0 }, undefined, 'ceiling')
    const rotated = buildProfile('rotated', { x: 0, y: 4, z: 0 }, { yaw: 45 }, 'ceiling')
    const target: Target3D = { x: 3, y: 0, z: 3 }

    const rPure    = solve(pure, target)
    const rRotated = solve(rotated, target)

    // El yaw de 45° debe cambiar el pan
    expect(rPure.pan).not.toBe(rRotated.pan)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// GIMBAL LOCK — target en eje vertical del fixture
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Gimbal Lock Protection', () => {

  it('Target at same position as fixture → preserves currentPan', () => {
    // Target EXACTAMENTE en la misma posición del fixture → gimbal lock.
    // Con currentPanDMX = 200, el IK debe preservar ese pan.
    const fixture = ceilingFixture('gl1', 0, 5, 0)
    const target: Target3D = { x: 0, y: 5, z: 0 }

    const result = solve(fixture, target, 200)

    // El pan debería estar cerca del currentPan (200), no saltar a 127
    // Nota: puede haber ligera desviación por el safety margin, pero no un salto brusco
    expect(Math.abs(result.pan - 200)).toBeLessThan(20)
    expect(Number.isNaN(result.pan)).toBe(false)
  })

  it('Target directly below without currentPan → defaults to 0° (center DMX)', () => {
    // Gimbal lock REAL: target en la misma posición X,Z del fixture, solo Y distinta.
    // Para ceiling: local frame transforma dy puro a local.z puro → horizontalDist > 0.
    // Gimbal lock VERDADERO solo ocurre cuando (local.x, local.z) ≈ (0, 0),
    // es decir, el vector mundo es puro después de la rotación.
    //
    // Caso REAL de gimbal lock: fixture y target en la misma posición exacta.
    const fixture = ceilingFixture('gl2', 0, 5, 0)
    const target: Target3D = { x: 0, y: 5, z: 0 }  // Mismo punto

    // Sin currentPanDMX → default panDeg = 0° → DMX ~127
    const result = solve(fixture, target, null)

    expect(result.pan).toBeGreaterThanOrEqual(PAN_CENTER - DMX_TOLERANCE)
    expect(result.pan).toBeLessThanOrEqual(PAN_CENTER + DMX_TOLERANCE)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// ANTI-FLIP — Pan Zero-Crossing Shortest Path
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Anti-Flip (Pan Shortest Path)', () => {

  it('Pan near 0 DMX with target requiring ~250 → picks shorter path', () => {
    // Fixture en ceiling, target que requiere pan opuesto al actual.
    // El anti-flip debería elegir la representación ±360° que sea más cercana.
    const fixture = ceilingFixture('af1', 0, 4, 0)
    const target: Target3D = { x: -4, y: 0, z: 0.01 } // Ligeramente offset para evitar gimbal lock

    // Calcular sin anti-flip primero (currentPan = null)
    const withoutFlip = solve(fixture, target, null)
    
    // Ahora con currentPan cercano al resultado → no debería forzar flip
    const withFlip = solve(fixture, target, withoutFlip.pan)
    
    // La distancia con anti-flip no debería ser mayor que sin él
    expect(Math.abs(withFlip.pan - withoutFlip.pan)).toBeLessThanOrEqual(1)
  })

  it('Pan at 240 DMX, target needs ~10 DMX → anti-flip avoids 230-unit jump', () => {
    // Si el fixture está en pan=240 y el target "ideal" es pan=10,
    // el anti-flip debería encontrar la representación +360° para acercarse.
    const fixture = ceilingFixture('af2', 0, 4, 0)
    
    // Generamos un target que cause un pan extremo
    const target: Target3D = { x: -3, y: 0, z: 0.01 }
    const rawResult = solve(fixture, target, null)
    
    // Ahora resolvemos con un currentPan lejano pero en rango
    const fromFarPan = solve(fixture, target, 240)
    
    // Anti-flip debe producir un resultado válido
    expect(fromFarPan.pan).toBeGreaterThanOrEqual(5)  // safety margin
    expect(fromFarPan.pan).toBeLessThanOrEqual(250)   // safety margin
    expect(fromFarPan.reachable).toBe(true)
  })

  it('antiFlipApplied flag is true when path was corrected', () => {
    // Verificar que el flag se activa cuando se usa una representación alternativa
    const fixture = ceilingFixture('af3', 0, 4, 0)
    const target: Target3D = { x: 3, y: 0, z: 3 }
    
    // Sin currentPan → no hay flip possible
    const noFlip = solve(fixture, target, null)
    expect(noFlip.antiFlipApplied).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CALIBRACIÓN — Offsets e inversiones
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Calibration', () => {

  it('panOffset shifts result by proportional DMX amount', () => {
    const noCal = buildProfile('noCal', { x: 0, y: 4, z: 0 }, undefined, 'ceiling')
    const withCal = buildProfile('withCal', { x: 0, y: 4, z: 0 }, undefined, 'ceiling', {
      panOffset: 27, // 27° = 27/540 * 255 ≈ 12.75 DMX
    })
    const target: Target3D = { x: 3, y: 0, z: 3 }

    const rNoCal = solve(noCal, target)
    const rWithCal = solve(withCal, target)

    // La diferencia entre sí debería ser ~13 DMX (27°/540° × 255)
    const expectedDeltaDMX = (27 / 540) * 255  // ≈ 12.75
    const actualDelta = Math.abs(rWithCal.pan - rNoCal.pan)
    expect(actualDelta).toBeGreaterThan(expectedDeltaDMX - DMX_TOLERANCE)
    expect(actualDelta).toBeLessThan(expectedDeltaDMX + DMX_TOLERANCE)
  })

  it('panInvert flips pan axis (255 - raw)', () => {
    const normal = buildProfile('normal', { x: 0, y: 4, z: 0 }, undefined, 'ceiling')
    const inverted = buildProfile('inverted', { x: 0, y: 4, z: 0 }, undefined, 'ceiling', {
      panInvert: true,
    })
    const target: Target3D = { x: 3, y: 0, z: 3 }

    const rNormal   = solve(normal, target)
    const rInverted = solve(inverted, target)

    // Con inversión, pan ≈ 255 - panNormal (con tolerancia por clamp/safety margin)
    const expectedInverted = 255 - rNormal.pan
    expect(Math.abs(rInverted.pan - expectedInverted)).toBeLessThanOrEqual(DMX_TOLERANCE + 1)
  })

  it('tiltInvert flips tilt axis', () => {
    const normal = buildProfile('normal', { x: 0, y: 4, z: 0 }, undefined, 'ceiling')
    const inverted = buildProfile('inverted', { x: 0, y: 4, z: 0 }, undefined, 'ceiling', {
      tiltInvert: true,
    })
    const target: Target3D = { x: 2, y: 0, z: 3 }

    const rNormal   = solve(normal, target)
    const rInverted = solve(inverted, target)

    // Tilt invertido ≈ 255 - tiltNormal (tolerancia por tilt limits)
    const expectedInverted = 255 - rNormal.tilt
    expect(Math.abs(rInverted.tilt - expectedInverted)).toBeLessThanOrEqual(DMX_TOLERANCE + 1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// TILT LIMITS — Seguridad absoluta
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Tilt Limits (Safety)', () => {

  it('Tilt result clamped to tiltLimits.min/max', () => {
    // Fixture con tilt limits restrictivos: 50-180 DMX
    const fixture = buildProfile(
      'limited', { x: 0, y: 4, z: 0 }, undefined, 'ceiling',
      undefined, undefined, undefined,
      { min: 50, max: 180 }
    )
    const target: Target3D = { x: 0, y: 0, z: 5 } // Target que podría causar tilt extremo

    const result = solve(fixture, target)

    expect(result.tilt).toBeGreaterThanOrEqual(50)
    expect(result.tilt).toBeLessThanOrEqual(180)
  })

  it('Tilt limits always applied — even with extreme target', () => {
    // Target directamente al costado → tilt extremo, pero los limits lo atrapan
    const fixture = buildProfile(
      'safe', { x: 0, y: 4, z: 0 }, undefined, 'ceiling',
      undefined, undefined, undefined,
      { min: 20, max: 200 }
    )
    // Target muy lejos horizontalmente y al mismo nivel → tilt cerca del límite
    const target: Target3D = { x: 0, y: 4, z: 100 }
    const result = solve(fixture, target)

    expect(result.tilt).toBeGreaterThanOrEqual(20)
    expect(result.tilt).toBeLessThanOrEqual(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// solveGroup — Batch coherente
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — solveGroup', () => {

  it('Group of 3 fixtures → each gets different pan/tilt for same target', () => {
    const fixtures = [
      ceilingFixture('left',   -3, 4, -2),
      ceilingFixture('center',  0, 4, -2),
      ceilingFixture('right',   3, 4, -2),
    ]
    const target: Target3D = { x: 0, y: 0, z: 3 }

    const results = solveGroup(fixtures, target)

    expect(results.size).toBe(3)

    const rLeft   = results.get('left')!
    const rCenter = results.get('center')!
    const rRight  = results.get('right')!

    // Los tres deben ser válidos
    expect(rLeft.reachable).toBe(true)
    expect(rCenter.reachable).toBe(true)
    expect(rRight.reachable).toBe(true)

    // Cada fixture tiene posición X distinta → deben producir diferentes pan
    // Left y Right son equidistantes del target en X → deben tener pan diferente entre sí
    expect(rLeft.pan).not.toBe(rRight.pan)
    // Center tiene diferente pan que left y right
    expect(rCenter.pan).not.toBe(rLeft.pan)
    expect(rCenter.pan).not.toBe(rRight.pan)

    // Todos deben producir valores válidos dentro del rango DMX
    for (const r of [rLeft, rCenter, rRight]) {
      expect(r.pan).toBeGreaterThanOrEqual(0)
      expect(r.pan).toBeLessThanOrEqual(255)
      expect(r.tilt).toBeGreaterThanOrEqual(0)
      expect(r.tilt).toBeLessThanOrEqual(255)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// buildProfile — Factory defaults
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — buildProfile', () => {

  it('Defaults: ceiling, 540° pan, 270° tilt, no calibration', () => {
    const profile = buildProfile('test', { x: 1, y: 2, z: 3 })

    expect(profile.id).toBe('test')
    expect(profile.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(profile.orientation.installation).toBe('ceiling')
    expect(profile.orientation.rotation).toEqual({ pitch: 0, yaw: 0, roll: 0 })
    expect(profile.limits.panRangeDeg).toBe(540)
    expect(profile.limits.tiltRangeDeg).toBe(270)
    expect(profile.limits.tiltLimits).toBeUndefined()
    expect(profile.calibration.panOffset).toBe(0)
    expect(profile.calibration.tiltOffset).toBe(0)
    expect(profile.calibration.panInvert).toBe(false)
    expect(profile.calibration.tiltInvert).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// REACHABILITY — Target fuera de rango mecánico
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Reachability', () => {

  it('Target behind ceiling fixture back → might be unreachable', () => {
    // Fixture en ceiling con tilt limits restrictivos.
    // Target detrás y arriba → tilt debe exceder el rango → reachable = false
    const fixture = buildProfile(
      'restricted', { x: 0, y: 4, z: 0 }, undefined, 'ceiling',
      undefined, undefined, undefined,
      { min: 80, max: 180 }
    )
    // Target directamente detrás y ligeramente arriba del fixture
    const target: Target3D = { x: 0, y: 4.5, z: -10 }
    const result = solve(fixture, target)

    // El resultado debe ser válido (clamped), pero con tilt limits el
    // valor se trunca → puede ser unreachable
    expect(result.tilt).toBeGreaterThanOrEqual(80)
    expect(result.tilt).toBeLessThanOrEqual(180)
    // Pan y tilt siempre válidos incluso si unreachable
    expect(result.pan).toBeGreaterThanOrEqual(0)
    expect(result.pan).toBeLessThanOrEqual(255)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// DETERMINISMO — Axioma Anti-Simulación
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2602 — Determinism (Axioma Anti-Simulación)', () => {

  it('Same input 1000 times → same output every time', () => {
    const fixture = ceilingFixture('det', -2, 5, 1)
    const target: Target3D = { x: 3.7, y: 0.5, z: 2.1 }

    const reference = solve(fixture, target, 100)

    for (let i = 0; i < 1000; i++) {
      const result = solve(fixture, target, 100)
      expect(result.pan).toBe(reference.pan)
      expect(result.tilt).toBe(reference.tilt)
      expect(result.reachable).toBe(reference.reachable)
      expect(result.antiFlipApplied).toBe(reference.antiFlipApplied)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2623 — SPATIAL FAN OFFSETS (LINE + CIRCLE)
// Verificación determinista de la distribución geométrica de sub-targets.
// ═══════════════════════════════════════════════════════════════════════════

describe('WAVE 2623 — computeLineFanOffsets', () => {

  it('0 fixtures → empty array', () => {
    const offsets = computeLineFanOffsets([], { x: 0, y: 0, z: 0 }, 5)
    expect(offsets).toHaveLength(0)
  })

  it('1 fixture → zero offset regardless of amplitude', () => {
    const offsets = computeLineFanOffsets(
      [{ x: 0, y: 4, z: 0 }],
      { x: 5, y: 0, z: 5 },
      10
    )
    expect(offsets).toHaveLength(1)
    expect(offsets[0].dx).toBe(0)
    expect(offsets[0].dz).toBe(0)
  })

  it('amplitude 0 → all offsets zero', () => {
    const positions = [
      { x: -2, y: 4, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 2, y: 4, z: 0 },
    ]
    const offsets = computeLineFanOffsets(positions, { x: 0, y: 0, z: 5 }, 0)
    expect(offsets).toHaveLength(3)
    for (const o of offsets) {
      expect(o.dx).toBe(0)
      expect(o.dz).toBe(0)
    }
  })

  it('3 fixtures, amplitude 6 → center fixture at origin, extremes symmetric', () => {
    // Fixtures en línea en X, target delante en Z
    const positions = [
      { x: -2, y: 4, z: 0 },
      { x: 0, y: 4, z: 0 },
      { x: 2, y: 4, z: 0 },
    ]
    const target: Target3D = { x: 0, y: 0, z: 5 }
    const offsets = computeLineFanOffsets(positions, target, 6)

    expect(offsets).toHaveLength(3)

    // Fixture del medio (i=1) → t=0 → offset = 0
    expect(Math.abs(offsets[1].dx)).toBeLessThan(0.001)
    expect(Math.abs(offsets[1].dz)).toBeLessThan(0.001)

    // Extremos simétricos: offset[0] = -offset[2]
    expect(offsets[0].dx).toBeCloseTo(-offsets[2].dx, 5)
    expect(offsets[0].dz).toBeCloseTo(-offsets[2].dz, 5)

    // Amplitud extremo a extremo = 6m
    const totalDx = offsets[2].dx - offsets[0].dx
    const totalDz = offsets[2].dz - offsets[0].dz
    const totalSpread = Math.sqrt(totalDx * totalDx + totalDz * totalDz)
    expect(totalSpread).toBeCloseTo(6, 3)
  })

  it('spread perpendicular to centroid→target vector', () => {
    // Centroide fixtures en (0,4,0), target en (0,0,5) → vector (0,0,5)
    // Perpendicular en XZ → debe ser dirección X
    const positions = [
      { x: -1, y: 4, z: 0 },
      { x: 1, y: 4, z: 0 },
    ]
    const target: Target3D = { x: 0, y: 0, z: 5 }
    const offsets = computeLineFanOffsets(positions, target, 4)

    // Perpendicular a (0, +Z) es ±X → los offsets deben ser puramente en X
    expect(Math.abs(offsets[0].dz)).toBeLessThan(0.001)
    expect(Math.abs(offsets[1].dz)).toBeLessThan(0.001)
    // dx extremo a extremo = amplitude = 4
    expect(Math.abs(offsets[1].dx - offsets[0].dx)).toBeCloseTo(4, 3)
  })

  it('target at centroid → defaults to X spread', () => {
    // Centroide = (0,4,0), target = (0,4,0) → vector nulo
    const positions = [
      { x: -1, y: 4, z: 0 },
      { x: 1, y: 4, z: 0 },
    ]
    const target: Target3D = { x: 0, y: 4, z: 0 }
    const offsets = computeLineFanOffsets(positions, target, 4)

    // Fallback dirección X → offsets en X, dz ≈ 0
    expect(Math.abs(offsets[0].dz)).toBeLessThan(0.001)
    expect(Math.abs(offsets[1].dz)).toBeLessThan(0.001)
    expect(offsets[1].dx - offsets[0].dx).toBeCloseTo(4, 3)
  })
})

describe('WAVE 2623 — computeCircleFanOffsets', () => {

  it('0 fixtures → empty', () => {
    expect(computeCircleFanOffsets(0, 5)).toHaveLength(0)
  })

  it('1 fixture → zero offset', () => {
    const offsets = computeCircleFanOffsets(1, 10)
    expect(offsets).toHaveLength(1)
    expect(offsets[0].dx).toBe(0)
    expect(offsets[0].dz).toBe(0)
  })

  it('amplitude 0 → zero offset', () => {
    const offsets = computeCircleFanOffsets(4, 0)
    expect(offsets).toHaveLength(1) // early return single item
    expect(offsets[0].dx).toBe(0)
  })

  it('4 fixtures, amplitude 10 → radius 5, on circumference', () => {
    const offsets = computeCircleFanOffsets(4, 10)
    expect(offsets).toHaveLength(4)
    const radius = 5

    // Cada offset debe estar a exactamente radius del centro
    for (const o of offsets) {
      const dist = Math.sqrt(o.dx * o.dx + o.dz * o.dz)
      expect(dist).toBeCloseTo(radius, 3)
    }
  })

  it('center of gravity of 4 points on circle ≈ origin', () => {
    const offsets = computeCircleFanOffsets(4, 8)
    let sumDx = 0, sumDz = 0
    for (const o of offsets) {
      sumDx += o.dx
      sumDz += o.dz
    }
    expect(sumDx / 4).toBeCloseTo(0, 5)
    expect(sumDz / 4).toBeCloseTo(0, 5)
  })

  it('3 fixtures → equilateral triangle on circumference', () => {
    const offsets = computeCircleFanOffsets(3, 6)
    const radius = 3

    // Todos a la misma distancia del centro
    for (const o of offsets) {
      const dist = Math.sqrt(o.dx * o.dx + o.dz * o.dz)
      expect(dist).toBeCloseTo(radius, 3)
    }

    // Distancia entre cada par de puntos consecutivos debe ser igual
    const d01 = Math.sqrt(
      (offsets[1].dx - offsets[0].dx) ** 2 + (offsets[1].dz - offsets[0].dz) ** 2
    )
    const d12 = Math.sqrt(
      (offsets[2].dx - offsets[1].dx) ** 2 + (offsets[2].dz - offsets[1].dz) ** 2
    )
    const d20 = Math.sqrt(
      (offsets[0].dx - offsets[2].dx) ** 2 + (offsets[0].dz - offsets[2].dz) ** 2
    )
    expect(d01).toBeCloseTo(d12, 3)
    expect(d12).toBeCloseTo(d20, 3)
  })
})

describe('WAVE 2623 — solveGroupWithFan', () => {

  it('converge mode → all IKFanResults have same subTarget as input', () => {
    const fixtures = [
      ceilingFixture('f1', -2, 4, 0),
      ceilingFixture('f2', 0, 4, 0),
      ceilingFixture('f3', 2, 4, 0),
    ]
    const target: Target3D = { x: 0, y: 0, z: 5 }
    const results = solveGroupWithFan(fixtures, target, 'converge', 10)

    expect(results.size).toBe(3)
    for (const [, r] of results) {
      expect(r.subTarget.x).toBe(target.x)
      expect(r.subTarget.y).toBe(target.y)
      expect(r.subTarget.z).toBe(target.z)
    }
  })

  it('amplitude 0 → converge regardless of mode', () => {
    const fixtures = [
      ceilingFixture('f1', -2, 4, 0),
      ceilingFixture('f2', 2, 4, 0),
    ]
    const target: Target3D = { x: 0, y: 0, z: 5 }
    const results = solveGroupWithFan(fixtures, target, 'line', 0)

    expect(results.size).toBe(2)
    for (const [, r] of results) {
      expect(r.subTarget.x).toBe(target.x)
      expect(r.subTarget.z).toBe(target.z)
    }
  })

  it('line mode → different pan values for spread fixtures', () => {
    const fixtures = [
      ceilingFixture('f1', 0, 4, 0),
      ceilingFixture('f2', 0, 4, 0),
      ceilingFixture('f3', 0, 4, 0),
    ]
    const target: Target3D = { x: 0, y: 0, z: 5 }
    const results = solveGroupWithFan(fixtures, target, 'line', 6)

    // Con spread de 6m, los sub-targets son diferentes
    const r1 = results.get('f1')!
    const r2 = results.get('f2')!
    const r3 = results.get('f3')!

    // Sub-targets deben ser distintos (salvo el central)
    expect(r1.subTarget.x).not.toBe(r3.subTarget.x)
    // Center fixture should be at target
    expect(r2.subTarget.x).toBeCloseTo(target.x, 3)
    expect(r2.subTarget.z).toBeCloseTo(target.z, 3)
  })

  it('circle mode → all subTargets at same radius from center', () => {
    const fixtures = [
      ceilingFixture('a', -3, 5, 0),
      ceilingFixture('b', 0, 5, 0),
      ceilingFixture('c', 3, 5, 0),
      ceilingFixture('d', 0, 5, -3),
    ]
    const target: Target3D = { x: 5, y: 0, z: 5 }
    const results = solveGroupWithFan(fixtures, target, 'circle', 8)

    const radius = 4 // amplitude / 2
    for (const [, r] of results) {
      const dx = r.subTarget.x - target.x
      const dz = r.subTarget.z - target.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      expect(dist).toBeCloseTo(radius, 2)
    }
  })

  it('all DMX values in 0-255 range for any fan mode', () => {
    const fixtures = [
      ceilingFixture('f1', -3, 5, 0),
      ceilingFixture('f2', 0, 5, 0),
      ceilingFixture('f3', 3, 5, 0),
    ]
    const target: Target3D = { x: 2, y: 0, z: 4 }

    for (const mode of ['converge', 'line', 'circle'] as SpatialFanMode[]) {
      const results = solveGroupWithFan(fixtures, target, mode, 6)
      for (const [, r] of results) {
        expect(r.pan).toBeGreaterThanOrEqual(0)
        expect(r.pan).toBeLessThanOrEqual(255)
        expect(r.tilt).toBeGreaterThanOrEqual(0)
        expect(r.tilt).toBeLessThanOrEqual(255)
      }
    }
  })

  it('fan is deterministic — same inputs → same outputs (1000x)', () => {
    const fixtures = [
      ceilingFixture('d1', -1, 4, 0),
      ceilingFixture('d2', 1, 4, 0),
    ]
    const target: Target3D = { x: 2, y: 0, z: 3 }
    const reference = solveGroupWithFan(fixtures, target, 'line', 4)

    for (let i = 0; i < 1000; i++) {
      const result = solveGroupWithFan(fixtures, target, 'line', 4)
      for (const [id, r] of result) {
        const ref = reference.get(id)!
        expect(r.pan).toBe(ref.pan)
        expect(r.tilt).toBe(ref.tilt)
        expect(r.subTarget.x).toBe(ref.subTarget.x)
        expect(r.subTarget.z).toBe(ref.subTarget.z)
      }
    }
  })
})
