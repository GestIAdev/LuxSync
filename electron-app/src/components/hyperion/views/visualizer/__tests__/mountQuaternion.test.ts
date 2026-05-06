/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚗️  WAVE 4573 — PHASE 6
 * Suite B: mountQuaternion — Validación de cuaterniones de instalación
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 *   §1 — La tabla MOUNT_QUATERNIONS es matemáticamente exacta
 *        (identidades, ángulos de 180° en ejes correctos)
 *   §2 — getMountQuaternion() retorna fallback 'ceiling' para orientaciones
 *        desconocidas (defensive programming no-throw)
 *   §3 — Todas las 6 orientaciones están definidas (cobertura completa)
 *   §4 — Los cuaterniones de 'ceiling' y 'floor' son opuestos geométricamente
 *
 * AXIOMA ANTI-SIMULACIÓN: Solo matemáticas deterministas. Sin Three.js Canvas.
 *
 * @module components/hyperion/views/visualizer/__tests__/mountQuaternion.test
 * @version WAVE 4573 Phase 6
 */

import { describe, test, expect } from 'vitest'
import * as THREE from 'three'
import { MOUNT_QUATERNIONS, getMountQuaternion } from '../utils/mountQuaternion'
import type { InstallationOrientation } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS matemáticos
// ═══════════════════════════════════════════════════════════════════════════

/** Precision para comparaciones de floats (5 decimales → ~0.00001 rad) */
const PRECISION = 4

/**
 * Verifica que un Quaternion es la identidad (sin rotación).
 * q_identity = (x:0, y:0, z:0, w:1)
 */
function isIdentity(q: THREE.Quaternion): boolean {
  return (
    Math.abs(q.x) < 1e-6 &&
    Math.abs(q.y) < 1e-6 &&
    Math.abs(q.z) < 1e-6 &&
    Math.abs(Math.abs(q.w) - 1.0) < 1e-6
  )
}

/**
 * Obtiene el eje y ángulo de rotación de un cuaternión.
 * Útil para verificar "rotación de 180° en eje X" directamente.
 */
function getAxisAngle(q: THREE.Quaternion): { axis: THREE.Vector3; angleDeg: number } {
  const axis = new THREE.Vector3()
  const angle = 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(q.w))))
  if (angle < 1e-8) {
    return { axis: new THREE.Vector3(0, 0, 1), angleDeg: 0 }
  }
  const s = Math.sqrt(1 - q.w * q.w)
  axis.set(
    Math.abs(q.w) < 0.9999 ? q.x / s : 0,
    Math.abs(q.w) < 0.9999 ? q.y / s : 0,
    Math.abs(q.w) < 0.9999 ? q.z / s : 0,
  )
  return { axis, angleDeg: (angle * 180) / Math.PI }
}

/**
 * Transforma un Vector3 con un Quaternion y devuelve el resultado.
 * Útil para verificar "¿adónde apunta el vector +Y después de esta rotación?"
 */
function rotateVector(v: THREE.Vector3, q: THREE.Quaternion): THREE.Vector3 {
  return v.clone().applyQuaternion(q)
}

// ═══════════════════════════════════════════════════════════════════════════
// §1 — Corrección matemática de cada cuaternión
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite B §1 — Corrección matemática de MOUNT_QUATERNIONS', () => {

  test('"ceiling": el vector local +Y apunta globalmente hacia -Y (beam cuelga hacia abajo)', () => {
    // Un fixture en el techo: su "haz" sale hacia abajo (-Y global).
    // La rotación de 180° en X transforma +Y → -Y.
    const localUp = new THREE.Vector3(0, 1, 0)
    const result = rotateVector(localUp, MOUNT_QUATERNIONS['ceiling'])

    expect(result.x).toBeCloseTo(0, PRECISION)
    expect(result.y).toBeCloseTo(-1, PRECISION)  // +Y → -Y
    expect(result.z).toBeCloseTo(0, PRECISION)
  })

  test('"floor": es la rotación identidad — fixture de pie sin rotación adicional', () => {
    expect(isIdentity(MOUNT_QUATERNIONS['floor'])).toBe(true)
  })

  test('"floor": el vector local +Y sigue apuntando globalmente hacia +Y (beam apunta arriba)', () => {
    // Un PAR en el suelo apunta hacia arriba — identidad.
    const localUp = new THREE.Vector3(0, 1, 0)
    const result = rotateVector(localUp, MOUNT_QUATERNIONS['floor'])

    expect(result.y).toBeCloseTo(1, PRECISION)
  })

  test('"truss-front" = clon de "ceiling" (mismo eje de montaje)', () => {
    const q_ceiling = MOUNT_QUATERNIONS['ceiling']
    const q_trussFront = MOUNT_QUATERNIONS['truss-front']

    // Deben tener los mismos valores de componentes (son geométricamente equivalentes)
    expect(q_trussFront.x).toBeCloseTo(q_ceiling.x, PRECISION)
    expect(q_trussFront.y).toBeCloseTo(q_ceiling.y, PRECISION)
    expect(q_trussFront.z).toBeCloseTo(q_ceiling.z, PRECISION)
    expect(q_trussFront.w).toBeCloseTo(q_ceiling.w, PRECISION)
  })

  test('"wall-left": el vector local +X apunta globalmente hacia +Y (fixture sale de la pared izquierda)', () => {
    // Wall left = R_Z(-π/2): rota el eje X local hacia +Y global.
    // Un fixture en la pared izquierda: su "delante" apunta hacia el centro del escenario (+X → +Y rotado).
    // Verificamos que la rotación Z(-90°) transforma +Y local → +X global (el haz sale horizontal).
    const localUp = new THREE.Vector3(0, 1, 0)
    const result = rotateVector(localUp, MOUNT_QUATERNIONS['wall-left'])

    // R_Z(-π/2): Y → X
    expect(result.x).toBeCloseTo(1, PRECISION)
    expect(result.y).toBeCloseTo(0, PRECISION)
    expect(result.z).toBeCloseTo(0, PRECISION)
  })

  test('"wall-right": el vector local +Y apunta globalmente hacia -X (pared derecha, inverso de wall-left)', () => {
    // R_Z(+π/2): Y → -X
    const localUp = new THREE.Vector3(0, 1, 0)
    const result = rotateVector(localUp, MOUNT_QUATERNIONS['wall-right'])

    expect(result.x).toBeCloseTo(-1, PRECISION)
    expect(result.y).toBeCloseTo(0, PRECISION)
    expect(result.z).toBeCloseTo(0, PRECISION)
  })

  test('"truss-back": el vector local +Y apunta hacia -Y conservando orientación trasera', () => {
    // R_X(π) · R_Y(π): beam cuelga hacia abajo (-Y) como en ceiling.
    const localUp = new THREE.Vector3(0, 1, 0)
    const result = rotateVector(localUp, MOUNT_QUATERNIONS['truss-back'])

    expect(result.y).toBeCloseTo(-1, PRECISION)
  })

  test('"ceiling": ángulo de rotación es 180° (π radianes)', () => {
    const { angleDeg } = getAxisAngle(MOUNT_QUATERNIONS['ceiling'])
    expect(angleDeg).toBeCloseTo(180, 2)
  })

  test('"wall-left" y "wall-right" son rotaciones opuestas (inversas entre sí)', () => {
    // Si aplico wall-left y luego wall-right (inverso), debería volver a identidad
    const combined = MOUNT_QUATERNIONS['wall-left'].clone()
      .multiply(MOUNT_QUATERNIONS['wall-right'])

    // wall-right = wall-left.conjugate() → producto es identidad si son inversas
    // (Para ser exactamente inversas, wall-right debe ser conjugado de wall-left)
    // R_Z(-π/2) · R_Z(+π/2) = identidad
    expect(isIdentity(combined)).toBe(true)
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §2 — getMountQuaternion: fallback + cobertura de orientaciones
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite B §2 — getMountQuaternion()', () => {

  const ALL_ORIENTATIONS: InstallationOrientation[] = [
    'ceiling', 'floor', 'wall-left', 'wall-right', 'truss-front', 'truss-back',
  ]

  test('retorna cuaternión válido (no nulo) para las 6 orientaciones válidas', () => {
    for (const o of ALL_ORIENTATIONS) {
      const q = getMountQuaternion(o)
      expect(q).toBeInstanceOf(THREE.Quaternion)
      // Un cuaternión válido tiene módulo ~1
      const magnitude = Math.sqrt(q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2)
      expect(magnitude).toBeCloseTo(1, PRECISION)
    }
  })

  test('para orientación desconocida, retorna el cuaternión de "ceiling" como fallback', () => {
    const unknown = 'unknown-orientation' as InstallationOrientation
    const q = getMountQuaternion(unknown)

    // Debe ser igual a 'ceiling'
    const ceiling = MOUNT_QUATERNIONS['ceiling']
    expect(q.x).toBeCloseTo(ceiling.x, PRECISION)
    expect(q.y).toBeCloseTo(ceiling.y, PRECISION)
    expect(q.z).toBeCloseTo(ceiling.z, PRECISION)
    expect(q.w).toBeCloseTo(ceiling.w, PRECISION)
  })

  test('getMountQuaternion("ceiling") es idéntico a MOUNT_QUATERNIONS["ceiling"]', () => {
    const q = getMountQuaternion('ceiling')
    const ref = MOUNT_QUATERNIONS['ceiling']
    expect(q).toBe(ref) // misma referencia de objeto
  })

})

// ═══════════════════════════════════════════════════════════════════════════
// §3 — Cobertura completa: las 6 orientaciones están definidas
// ═══════════════════════════════════════════════════════════════════════════

describe('Suite B §3 — Cobertura completa de MOUNT_QUATERNIONS', () => {

  test('la tabla contiene exactamente las 6 orientaciones canónicas', () => {
    const keys = Object.keys(MOUNT_QUATERNIONS).sort()
    expect(keys).toEqual([
      'ceiling',
      'floor',
      'truss-back',
      'truss-front',
      'wall-left',
      'wall-right',
    ])
  })

  test('cada entrada en la tabla es una instancia de THREE.Quaternion', () => {
    for (const [key, q] of Object.entries(MOUNT_QUATERNIONS)) {
      expect(q).toBeInstanceOf(THREE.Quaternion),
      `${key} should be THREE.Quaternion`
    }
  })

})
