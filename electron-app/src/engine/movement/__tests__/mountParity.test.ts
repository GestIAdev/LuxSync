/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧪 mountParity.test.ts — WAVE 7178 (M1.2): SUITE DE PARIDAD DE MONTAJE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida `mountTransforms.ts` (SSOT de semántica física) en tres niveles:
 *
 *   1. `MOUNT_SEMANTICS` — la tabla conceptual es correcta y está congelada.
 *   2. `getIKMountAngles()` — reproduce BIT A BIT los valores históricos de
 *      `MOUNT_ANGLES` en `InverseKinematicsEngine.ts` (pitch SIEMPRE 0 — la
 *      verticalidad la resuelve el signo de `dy` en el solver, no una
 *      rotación de frame — ver test WAVE 4899 "Pan Unflip").
 *   3. `getVisualMountTransform()` — reproduce BIT A BIT los valores
 *      históricos de `MOUNT_QUATERNIONS` en `mountQuaternion.ts` (rotación
 *      real de una malla, donde 'floor'/'totem' necesitan pitch=π y las
 *      paredes necesitan roll=±π/2).
 *
 * Guardián permanente: 'totem' y 'floor' DEBEN compartir exactamente la
 * misma semántica (`facing: 'up'`) en la tabla SSOT, y por tanto el MISMO
 * resultado en ambas derivaciones — sin excepción.
 *
 * Esta suite es la RED DE SEGURIDAD que impide reintroducir el error de
 * diseño detectado en M1.2: aplicar la convención de un dominio al otro
 * (p.ej. pitch=π en el IK) rompería la física real de los fixtures de piso
 * y el test WAVE 4899 existente. Cualquier cambio futuro a `mountTransforms.ts`
 * debe mantener verde tanto esta suite como `InverseKinematicsEngine.test.ts`.
 *
 * @module tests/mountParity
 * @version WAVE 7178.2
 */

import { describe, it, expect } from 'vitest'
import {
  MOUNT_SEMANTICS,
  getMountSemantics,
  getIKMountAngles,
  getVisualMountTransform,
  type MountTransform,
} from '../mountTransforms'
import type { InstallationOrientation } from '../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — geometría pura, sin dependencias externas
// ═══════════════════════════════════════════════════════════════════════════

interface Vec3 { x: number; y: number; z: number }

const EPSILON = 1e-9

function approxEqual(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) < eps
}

function expectVec3Close(actual: Vec3, expected: Vec3, eps = 1e-6): void {
  expect(approxEqual(actual.x, expected.x, eps)).toBe(true)
  expect(approxEqual(actual.y, expected.y, eps)).toBe(true)
  expect(approxEqual(actual.z, expected.z, eps)).toBe(true)
}

/**
 * Rotación pura de un vector según una MountTransform, orden de composición
 * Rz(roll) · Rx(pitch) · Ry(yaw) — coherente con la convención pitch/yaw/roll
 * documentada en mountTransforms.ts. Implementación matricial standalone,
 * sin Three.js, para verificar la SEMÁNTICA FÍSICA de la tabla SSOT.
 */
function rotateByMount(v: Vec3, m: MountTransform): Vec3 {
  const { pitchRad: p, yawRad: y, rollRad: r } = m

  // Ry(yaw)
  const cy = Math.cos(y), sy = Math.sin(y)
  let x1 = v.x * cy + v.z * sy
  let y1 = v.y
  let z1 = -v.x * sy + v.z * cy

  // Rx(pitch)
  const cp = Math.cos(p), sp = Math.sin(p)
  let x2 = x1
  let y2 = y1 * cp - z1 * sp
  let z2 = y1 * sp + z1 * cp

  // Rz(roll)
  const cr = Math.cos(r), sr = Math.sin(r)
  const x3 = x2 * cr - y2 * sr
  const y3 = x2 * sr + y2 * cr
  const z3 = z2

  return { x: x3, y: y3, z: z3 }
}

/** Eje de emisión local del fixture (documentado: -Y). Usado solo en la SUITE 3 (visual). */
const LOCAL_DOWN: Vec3 = { x: 0, y: -1, z: 0 }

/** Eje "frontal" local, usado para diferenciar orientaciones de yaw/roll puro. */
const LOCAL_FORWARD: Vec3 = { x: 0, y: 0, z: -1 }

const ALL_ORIENTATIONS: InstallationOrientation[] = [
  'ceiling', 'floor', 'totem', 'truss-front', 'truss-back', 'wall-left', 'wall-right',
]

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1 — MOUNT_SEMANTICS: la tabla conceptual (dominio-agnóstica)
// ═══════════════════════════════════════════════════════════════════════════

describe('MOUNT_SEMANTICS — semántica física conceptual', () => {
  it('ceiling / truss-front encaran hacia abajo, sin backFacing, sin pared', () => {
    expect(MOUNT_SEMANTICS.ceiling).toEqual({ facing: 'down', backFacing: false, wallSide: 'none' })
    expect(MOUNT_SEMANTICS['truss-front']).toEqual(MOUNT_SEMANTICS.ceiling)
  })

  it('truss-back encara hacia abajo pero está backFacing', () => {
    expect(MOUNT_SEMANTICS['truss-back']).toEqual({ facing: 'down', backFacing: true, wallSide: 'none' })
  })

  it('wall-left/right encaran hacia abajo pero declaran su lado de pared', () => {
    expect(MOUNT_SEMANTICS['wall-left'].wallSide).toBe('left')
    expect(MOUNT_SEMANTICS['wall-right'].wallSide).toBe('right')
  })

  it('🔧 GUARDIÁN — floor y totem comparten EXACTAMENTE la misma semántica (facing: up)', () => {
    expect(MOUNT_SEMANTICS.floor).toEqual({ facing: 'up', backFacing: false, wallSide: 'none' })
    expect(MOUNT_SEMANTICS.totem).toEqual(MOUNT_SEMANTICS.floor)
  })

  it('la tabla y cada entrada están congeladas (inmutabilidad garantizada)', () => {
    expect(Object.isFrozen(MOUNT_SEMANTICS)).toBe(true)
    for (const o of ALL_ORIENTATIONS) {
      expect(Object.isFrozen(MOUNT_SEMANTICS[o])).toBe(true)
    }
  })

  it('getMountSemantics() devuelve fallback seguro a ceiling para orientación desconocida', () => {
    // @ts-expect-error — probando el fallback runtime ante datos corruptos/legacy
    expect(getMountSemantics('unknown-orientation')).toBe(MOUNT_SEMANTICS.ceiling)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2 — getIKMountAngles(): paridad BIT A BIT con MOUNT_ANGLES histórico
// ═══════════════════════════════════════════════════════════════════════════

describe('getIKMountAngles() — paridad con InverseKinematicsEngine.MOUNT_ANGLES', () => {
  it('pitchRad es SIEMPRE 0, para toda orientación (invariante del dominio IK)', () => {
    for (const o of ALL_ORIENTATIONS) {
      expect(getIKMountAngles(o).pitchRad).toBe(0)
    }
  })

  it('ceiling / truss-front / floor / totem → identidad completa (yaw=0)', () => {
    for (const o of ['ceiling', 'truss-front', 'floor', 'totem'] as InstallationOrientation[]) {
      expect(getIKMountAngles(o)).toEqual({ pitchRad: 0, yawRad: 0, rollRad: 0 })
    }
  })

  it('truss-back → yaw=π (frente↔espalda invertido)', () => {
    expect(getIKMountAngles('truss-back')).toEqual({ pitchRad: 0, yawRad: Math.PI, rollRad: 0 })
  })

  it('wall-left → yaw=+π/2', () => {
    const m = getIKMountAngles('wall-left')
    expect(approxEqual(m.yawRad, Math.PI / 2)).toBe(true)
    expect(m.rollRad).toBe(0)
  })

  it('wall-right → yaw=-π/2', () => {
    const m = getIKMountAngles('wall-right')
    expect(approxEqual(m.yawRad, -Math.PI / 2)).toBe(true)
    expect(m.rollRad).toBe(0)
  })

  it('🔧 GUARDIÁN F8 — totem y floor producen EXACTAMENTE el mismo resultado IK', () => {
    expect(getIKMountAngles('totem')).toEqual(getIKMountAngles('floor'))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3 — getVisualMountTransform(): paridad BIT A BIT con MOUNT_QUATERNIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('getVisualMountTransform() — paridad con visualizer MOUNT_QUATERNIONS', () => {
  it('ceiling → identidad (el modelo ya emite en -Y local)', () => {
    expect(getVisualMountTransform('ceiling')).toEqual({ pitchRad: 0, yawRad: 0, rollRad: 0 })
  })

  it('truss-front → identidad, igual que ceiling', () => {
    expect(getVisualMountTransform('truss-front')).toEqual(getVisualMountTransform('ceiling'))
  })

  it('floor → pitch=π: el eje de emisión local (-Y) se invierte y apunta a +Y global', () => {
    const m = getVisualMountTransform('floor')
    expect(approxEqual(m.pitchRad, Math.PI)).toBe(true)
    expect(m.yawRad).toBe(0)
    expect(m.rollRad).toBe(0)

    const result = rotateByMount(LOCAL_DOWN, m)
    expectVec3Close(result, { x: 0, y: 1, z: 0 })
  })

  it('🔧 GUARDIÁN F8 — totem produce EXACTAMENTE el mismo resultado visual que floor', () => {
    expect(getVisualMountTransform('totem')).toEqual(getVisualMountTransform('floor'))
  })

  it('truss-back → yaw=π, mismo vector vertical que ceiling, frente invertido', () => {
    const m = getVisualMountTransform('truss-back')
    expect(approxEqual(m.yawRad, Math.PI)).toBe(true)

    const down = rotateByMount(LOCAL_DOWN, m)
    expectVec3Close(down, { x: 0, y: -1, z: 0 })

    const forward = rotateByMount(LOCAL_FORWARD, m)
    expectVec3Close(forward, { x: 0, y: 0, z: 1 })
  })

  it('wall-left → roll=+π/2 (la carcasa se tuerce físicamente hacia el lado)', () => {
    const m = getVisualMountTransform('wall-left')
    expect(approxEqual(m.rollRad, Math.PI / 2)).toBe(true)
    expect(m.pitchRad).toBe(0)
    expect(m.yawRad).toBe(0)
  })

  it('wall-right → roll=-π/2', () => {
    const m = getVisualMountTransform('wall-right')
    expect(approxEqual(m.rollRad, -Math.PI / 2)).toBe(true)
    expect(m.pitchRad).toBe(0)
    expect(m.yawRad).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4 — Consistencia cruzada de dominios
// ═══════════════════════════════════════════════════════════════════════════

describe('Consistencia cruzada IK ↔ Visual (misma semántica, distinta convención)', () => {
  it('para toda orientación sin backFacing ni pared, IK y visual coinciden EXCEPTO en pitch', () => {
    for (const o of ALL_ORIENTATIONS) {
      const s = getMountSemantics(o)
      const ik = getIKMountAngles(o)
      const vi = getVisualMountTransform(o)

      // yaw: ambos dominios codifican backFacing como yaw=π de forma idéntica
      if (s.backFacing) {
        expect(approxEqual(ik.yawRad, Math.PI)).toBe(true)
        expect(approxEqual(vi.yawRad, Math.PI)).toBe(true)
      }

      // pitch: SOLO el dominio visual lo usa para 'facing: up'. El IK es 0 siempre.
      expect(ik.pitchRad).toBe(0)
      if (s.facing === 'up') {
        expect(approxEqual(vi.pitchRad, Math.PI)).toBe(true)
      } else {
        expect(vi.pitchRad).toBe(0)
      }

      // roll: SOLO el dominio visual lo usa para paredes. El IK usa yaw en su lugar.
      expect(ik.rollRad).toBe(0)
      if (s.wallSide === 'left') {
        expect(approxEqual(vi.rollRad, Math.PI / 2)).toBe(true)
        expect(approxEqual(ik.yawRad, Math.PI / 2)).toBe(true)
      } else if (s.wallSide === 'right') {
        expect(approxEqual(vi.rollRad, -Math.PI / 2)).toBe(true)
        expect(approxEqual(ik.yawRad, -Math.PI / 2)).toBe(true)
      }
    }
  })

  it('totem y floor son indistinguibles en AMBOS dominios (regresión F8 permanente)', () => {
    expect(getIKMountAngles('totem')).toEqual(getIKMountAngles('floor'))
    expect(getVisualMountTransform('totem')).toEqual(getVisualMountTransform('floor'))
  })
})
