/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚓ mountTransforms.ts — WAVE 7178 (M1.2): FUENTE ÚNICA DE VERDAD DE MONTAJE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reemplaza la dualidad histórica entre:
 *   - InverseKinematicsEngine.MOUNT_ANGLES   (grados, dominio IK)
 *   - visualizer/utils/mountQuaternion.ts    (THREE.Quaternion, dominio render)
 *
 * ⚠️ HALLAZGO DE DISEÑO (WAVE 7178 M1.2): estos dos dominios NO comparten
 * la misma convención matemática, aunque describan la misma física:
 *
 *   - El IK (`InverseKinematicsEngine.solveInto`) NUNCA rota el eje vertical
 *     por montaje. El tilt correcto para 'floor'/'totem' emerge del SIGNO de
 *     `dy` (target arriba del fixture) en la fórmula
 *     `tiltDeg = atan2(horizontalDist, -local.y)` — no de una rotación de
 *     pitch. Ver test WAVE 4899 "Pan Unflip" en
 *     `InverseKinematicsEngine.test.ts`. Por eso `pitchRad` del IK es
 *     SIEMPRE 0 para toda orientación — la verticalidad es una propiedad del
 *     SOLVER, no del frame de montaje.
 *
 *   - El visor 3D SÍ rota una malla física real. Un fixture 'floor'/'totem'
 *     necesita `pitch=π` para que el modelo (cuyo eje de emisión local es
 *     -Y) apunte hacia +Y global. Un 'wall-left/right' necesita `roll=±π/2`
 *     porque el visor tuerce la carcasa físicamente hacia el lado — el IK,
 *     en cambio, resuelve las paredes rotando el FRAME DE REFERENCIA
 *     horizontal (yaw), no la carcasa.
 *
 * SOLUCIÓN: esta SSOT no almacena ángulos de un solo dominio. Almacena
 * SEMÁNTICA FÍSICA pura (`MountSemantics`) — hacia dónde encara el fixture,
 * sin comprometerse a una convención de rotación. Dos funciones puras
 * derivan de esa semántica la representación EXACTA que cada dominio
 * necesita. Ambas derivaciones fueron verificadas para reproducir bit a bit
 * los valores históricos de `MOUNT_ANGLES` y `MOUNT_QUATERNIONS` — cero
 * regresión física, unificación real de la fuente de verdad conceptual.
 *
 * Este módulo es puro y determinista: CERO dependencias de Three.js, DOM,
 * IPC o React. Consumible tanto por el main process (IK) como por el
 * renderer (visor 3D) sin cruzar ninguna frontera de proceso.
 *
 * @module engine/movement/mountTransforms
 * @version WAVE 7178.2
 */
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const PI = Math.PI;
// ═══════════════════════════════════════════════════════════════════════════
// ⚓ SSOT — SEMÁNTICA FÍSICA PURA POR ORIENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Tabla congelada de semántica de montaje por InstallationOrientation.
 * Describe QUÉ es cada orientación físicamente, no CÓMO rotarla — eso lo
 * decide cada dominio consumidor vía sus funciones de derivación.
 */
export const MOUNT_SEMANTICS = Object.freeze({
    'ceiling': Object.freeze({ facing: 'down', backFacing: false, wallSide: 'none' }),
    'truss-front': Object.freeze({ facing: 'down', backFacing: false, wallSide: 'none' }),
    'truss-back': Object.freeze({ facing: 'down', backFacing: true, wallSide: 'none' }),
    'floor': Object.freeze({ facing: 'up', backFacing: false, wallSide: 'none' }),
    'totem': Object.freeze({ facing: 'up', backFacing: false, wallSide: 'none' }),
    'wall-left': Object.freeze({ facing: 'down', backFacing: false, wallSide: 'left' }),
    'wall-right': Object.freeze({ facing: 'down', backFacing: false, wallSide: 'right' }),
});
/**
 * Obtiene la semántica de montaje para la orientación dada.
 * Fallback seguro a 'ceiling' si la orientación no existe en la tabla.
 */
export function getMountSemantics(o) {
    return MOUNT_SEMANTICS[o] ?? MOUNT_SEMANTICS['ceiling'];
}
// ═══════════════════════════════════════════════════════════════════════════
// DERIVACIÓN 1 — DOMINIO IK (InverseKinematicsEngine)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Deriva la transformación de montaje en la convención del motor IK.
 *
 * Convención IK: `pitchRad` es SIEMPRE 0 — la verticalidad (facing up/down)
 * la resuelve el signo de `dy` dentro de `solveInto()`, no una rotación de
 * frame. Solo `yawRad` varía: π para backFacing (truss-back), ±π/2 para
 * paredes (el IK modela las paredes rotando el frame de referencia
 * horizontal, no tuerce una carcasa).
 *
 * Reproduce EXACTAMENTE los valores históricos de `MOUNT_ANGLES`.
 */
export function getIKMountAngles(o) {
    const s = getMountSemantics(o);
    const yawRad = s.backFacing
        ? PI
        : s.wallSide === 'left'
            ? PI / 2
            : s.wallSide === 'right'
                ? -PI / 2
                : 0;
    return { pitchRad: 0, yawRad, rollRad: 0 };
}
// ═══════════════════════════════════════════════════════════════════════════
// DERIVACIÓN 2 — DOMINIO VISUAL (visor 3D / mountQuaternion adapter)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Deriva la transformación de montaje en la convención del visor 3D.
 *
 * Convención visual: rota la malla física real.
 *   - `facing: 'up'` → pitchRad=π (el eje de emisión local -Y se invierte
 *     hacia +Y global — fixture de pie apuntando al techo).
 *   - `backFacing` → yawRad=π (mismo vector vertical, frente↔espalda
 *     invertido).
 *   - `wallSide` → rollRad=±π/2 (la carcasa se tuerce físicamente hacia el
 *     lado — a diferencia del IK, que rota el frame en vez de la carcasa).
 *
 * Reproduce EXACTAMENTE los valores históricos de `MOUNT_QUATERNIONS`.
 */
export function getVisualMountTransform(o) {
    const s = getMountSemantics(o);
    const pitchRad = s.facing === 'up' ? PI : 0;
    const yawRad = s.backFacing ? PI : 0;
    const rollRad = s.wallSide === 'left' ? PI / 2 : s.wallSide === 'right' ? -PI / 2 : 0;
    return { pitchRad, yawRad, rollRad };
}
