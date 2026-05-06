/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ WAVE 4573 — mountQuaternion.ts
 * Módulo puro: tabla de cuaterniones de montaje por orientación de instalación.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ANTES: MOUNT_QUATERNIONS estaba duplicado en HyperionMovingHead3D.tsx y
 *        HyperionPar3D.tsx (mismo código, dos instancias en memoria).
 * AHORA: Fuente única de verdad. Importada por ambos componentes.
 *
 * Notación Three.js (right-hand rule, Y arriba):
 *   - Los modelos de Hyperion tienen eje de emisión local en -Y.
 *   - ceiling   : identidad — foco colgado apunta al suelo (-Y global)
 *   - floor     : R_X(π) — foco de piso apunta al techo (+Y global)
 *   - truss-front: igual que ceiling
 *   - truss-back : R_Y(π) — mismo vector vertical, invertido en yaw
 *   - wall-left  : R_Z(+π/2) — pared izquierda, haz hacia +X (centro)
 *   - wall-right : R_Z(-π/2) — pared derecha, haz hacia -X (centro)
 *
 * @module components/hyperion/views/visualizer/utils/mountQuaternion
 * @version WAVE 4573
 */

import * as THREE from 'three'
import type { InstallationOrientation } from '../../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// TABLA ESTÁTICA — UNA SOLA ASIGNACIÓN DE MEMORIA EN TODA LA APP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cuaterniones base por orientación de montaje.
 * Cada entrada define la rotación del cuerpo del fixture ANTES de aplicar
 * los valores dinámicos de pan/tilt en runtime.
 *
 * Estos valores son PUROS MATEMÁTICOS — verificados por Suite B (mountQuaternion.test.ts).
 */
export const MOUNT_QUATERNIONS: Readonly<Record<InstallationOrientation, THREE.Quaternion>> = (() => {
  // Ceiling: los modelos ya emiten en -Y local, así que no hay rotación extra.
  const ceiling = new THREE.Quaternion()

  // Floor: invertimos el eje de emisión para que el haz suba hacia +Y.
  const floor = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))

  // Truss frontal: mismo montaje que techo (cuelga del truss frontal)
  const trussFront = ceiling.clone()

  // Truss trasero: mismo vector vertical, pero yaw invertido 180°.
  const trussBack = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0))

  // Pared izquierda: haz hacia +X (centro del escenario)
  const wallLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))

  // Pared derecha: haz hacia -X (centro del escenario)
  const wallRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2))

  return {
    'ceiling':    ceiling,
    'floor':      floor,
    'truss-front': trussFront,
    'truss-back':  trussBack,
    'wall-left':   wallLeft,
    'wall-right':  wallRight,
  } as const
})()

/**
 * Obtiene el cuaternión base para la orientación dada.
 * Fallback seguro a 'ceiling' si la orientación no existe en la tabla.
 */
export function getMountQuaternion(orientation: InstallationOrientation): THREE.Quaternion {
  return MOUNT_QUATERNIONS[orientation] ?? MOUNT_QUATERNIONS['ceiling']
}
