/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏗️ WAVE 4573 / 7178 (M1.2) — mountQuaternion.ts
 * Adaptador Three.js: deriva cuaterniones de montaje desde la SSOT pura
 * (engine/movement/mountTransforms.ts).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ANTES (WAVE 4573): MOUNT_QUATERNIONS estaba duplicado en HyperionMovingHead3D.tsx
 *        y HyperionPar3D.tsx (mismo código, dos instancias en memoria).
 * DESPUÉS (WAVE 7178): la tabla ya no se define aquí — este módulo es la
 *        ÚNICA frontera con Three.js. Los ángulos (pitch/yaw/roll) vienen
 *        de `getVisualMountTransform()`, derivados de la misma semántica
 *        física (`MOUNT_SEMANTICS`) que consume el motor IK. Ver el
 *        comentario de diseño en mountTransforms.ts sobre por qué IK y
 *        visor usan convenciones de rotación distintas para la misma física.
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
 * @version WAVE 7178.2
 */

import * as THREE from 'three'
import type { InstallationOrientation } from '../../../../../core/stage/ShowFileV2'
import { getVisualMountTransform } from '../../../../../engine/movement/mountTransforms'

// ═══════════════════════════════════════════════════════════════════════════
// CACHE — UNA SOLA ASIGNACIÓN DE MEMORIA POR ORIENTACIÓN EN TODA LA APP
// ═══════════════════════════════════════════════════════════════════════════

const ALL_ORIENTATIONS: readonly InstallationOrientation[] = [
  'ceiling', 'floor', 'totem', 'truss-front', 'truss-back', 'wall-left', 'wall-right',
]

/**
 * Cuaterniones base por orientación de montaje, derivados de la SSOT.
 * Cada entrada define la rotación del cuerpo del fixture ANTES de aplicar
 * los valores dinámicos de pan/tilt en runtime.
 *
 * Pre-computados una sola vez al importar el módulo (misma semántica de
 * "una sola asignación de memoria" que la tabla estática original).
 */
export const MOUNT_QUATERNIONS: Readonly<Record<InstallationOrientation, THREE.Quaternion>> =
  Object.freeze(
    ALL_ORIENTATIONS.reduce((acc, o) => {
      const m = getVisualMountTransform(o)
      acc[o] = new THREE.Quaternion().setFromEuler(new THREE.Euler(m.pitchRad, m.yawRad, m.rollRad))
      return acc
    }, {} as Record<InstallationOrientation, THREE.Quaternion>)
  )

/**
 * Obtiene el cuaternión base para la orientación dada.
 * Fallback seguro a 'ceiling' si la orientación no existe en la tabla.
 */
export function getMountQuaternion(orientation: InstallationOrientation): THREE.Quaternion {
  return MOUNT_QUATERNIONS[orientation] ?? MOUNT_QUATERNIONS['ceiling']
}
