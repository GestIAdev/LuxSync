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
 *   - ceiling   : R_X(π)  — cabeza cuelga hacia abajo (beam apunta -Y)
 *   - floor     : identidad — pie en el suelo (beam apunta +Y)
 *   - truss-front: igual que ceiling
 *   - truss-back : R_X(π) · R_Y(π) — techo, orientado hacia atrás del truss
 *   - wall-left  : R_Z(-π/2) — pared izquierda, rota 90° en Z
 *   - wall-right : R_Z(+π/2) — pared derecha, rota -90° en Z
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
  // Techo: fixture cuelga. El beam apunta hacia -Y por defecto (sin pan/tilt),
  // lo que requiere girar 180° en X para invertir la dirección natural.
  const ceiling = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))

  // Suelo: fixture de pie. Sin rotación adicional — identidad.
  const floor = new THREE.Quaternion()

  // Truss frontal: mismo montaje que techo (cuelga del truss frontal)
  const trussFront = ceiling.clone()

  // Truss trasero: techo rotado 180° en Y (el fixture mira hacia atrás del escenario)
  const trussBack = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, Math.PI, 0))

  // Pared izquierda: fixture montado en la pared izquierda, apunta al centro del escenario
  const wallLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI / 2))

  // Pared derecha: fixture montado en la pared derecha, apunta al centro del escenario
  const wallRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2))

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
