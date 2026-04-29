/**
 * 🎯 WAVE 3504-EXT.1 — MOVEMENT GENERATORS
 *
 * Funciones puras de generación de movimiento extraídas de TitanEngine.
 * Cero estado. Cero singletons. Cero side-effects.
 *
 * Toda la matemática de coordenadas, gearbox budget y construcción de
 * MovementIntent vive aquí y puede ser testeada sin levantar el Engine.
 *
 * @layer ENGINE/GENERATORS (Pure Math)
 */
import { vibeMovementManager, } from '../movement/VibeMovementManager';
import { getMovementPhysics } from '../movement/VibeMovementPresets';
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Velocidad máxima del sistema (DMX/s).
 * Debe mantenerse sincronizado con FixturePhysicsDriver.SAFETY_CAP.maxVelocity.
 * WAVE 2095.1 FIX VULN-02: Gearbox Budget.
 */
export const SYSTEM_SAFETY_CAP_VELOCITY = 400;
/**
 * Número de movers en el rig estéreo estándar (L + R).
 */
export const STEREO_TOTAL = 2;
// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES PURAS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Normaliza una coordenada VMM (-1..+1) al espacio de protocolo (0..1).
 *
 * @pure
 */
export function vmmCoordToProtocol(vmmCoord) {
    return Math.max(0, Math.min(1, 0.5 + vmmCoord * 0.5));
}
/**
 * Calcula el presupuesto de velocidad (gearbox) para el VMM de un vibe dado.
 *
 * No supera SYSTEM_SAFETY_CAP_VELOCITY para que el PhysicsDriver nunca reciba
 * amplitudes imposibles para un mover físico real.
 *
 * @pure — solo lee la tabla de presets, no muta nada.
 */
export function calculateGearboxBudget(vibeId) {
    const vibeMaxVelocity = getMovementPhysics(vibeId).maxVelocity;
    return Math.min(vibeMaxVelocity, SYSTEM_SAFETY_CAP_VELOCITY);
}
/**
 * Construye el VMMContext a partir de los datos de audio y el contexto musical.
 *
 * @pure
 */
export function buildVMMContext(audio, musical) {
    return {
        energy: musical.energy, // WAVE 935: normalizado (AGC)
        bass: audio.bass,
        mids: audio.mid,
        highs: audio.high,
        bpm: musical.bpm,
        beatPhase: audio.beatPhase,
        beatCount: audio.beatCount ?? 0,
    };
}
/**
 * Ensambla un MovementIntent de protocolo a partir de los intents VMM estéreo.
 *
 * Convierte coordenadas VMM (-1..+1) → protocolo (0..1).
 * Calcula el centro global como promedio de L/R para compatibilidad
 * con rigs de un solo mover y el spread del Arbiter.
 *
 * WAVE 2086.1: Stereo generation — ambas posiciones viajan como mechanicsL/R
 * para que MasterArbiter enrute cada mover a su posición correcta.
 *
 * @pure
 */
export function assembleStereoMovementIntent(vmmIntentL, vmmIntentR) {
    const leftX = vmmCoordToProtocol(vmmIntentL.x);
    const leftY = vmmCoordToProtocol(vmmIntentL.y);
    const rightX = vmmCoordToProtocol(vmmIntentR.x);
    const rightY = vmmCoordToProtocol(vmmIntentR.y);
    return {
        pattern: vmmIntentL.pattern,
        speed: Math.max(0, Math.min(1, vmmIntentL.speed)),
        amplitude: vmmIntentL.amplitude,
        centerX: Math.max(0, Math.min(1, (leftX + rightX) / 2)),
        centerY: Math.max(0, Math.min(1, (leftY + rightY) / 2)),
        beatSync: true,
        phaseType: vmmIntentL.phaseType,
        // WAVE 2086.1: Stereo coordinates for MasterArbiter routing
        mechanicsL: { pan: leftX, tilt: leftY },
        mechanicsR: { pan: rightX, tilt: rightY },
    };
}
/**
 * Pipeline completo de generación de movimiento estéreo sin estado.
 *
 * Coordina VMM → gearbox → conversión de coordenadas → protocolo.
 * Reemplaza el método privado `TitanEngine.calculateMovement()`.
 *
 * @param vibeId      - ID del vibe activo (para presets y gearbox budget).
 * @param audio       - Métricas de audio del frame actual.
 * @param musical     - Contexto musical del frame actual.
 * @returns MovementIntent listo para el MasterArbiter.
 *
 * @pure (delegada — vibeMovementManager tiene estado, pero esta función
 *        no muta nada ni guarda resultado entre llamadas)
 */
export function generateStereoMovement(vibeId, audio, musical) {
    const vmmContext = buildVMMContext(audio, musical);
    const gearboxSpeed = calculateGearboxBudget(vibeId);
    const intentL = vibeMovementManager.generateIntent(vibeId, vmmContext, 0, STEREO_TOTAL, gearboxSpeed);
    const intentR = vibeMovementManager.generateIntent(vibeId, vmmContext, 1, STEREO_TOTAL, gearboxSpeed);
    return assembleStereoMovementIntent(intentL, intentR);
}
/**
 * Construye un MovementIntent de bypass mecánico (WAVE 1046: THE MECHANICS BYPASS).
 *
 * Cuando SeleneLux envía coordenadas directas (THE DEEP FIELD), no se llama al VMM.
 * El Arbiter se encarga del spread per-mover a partir de mechanicsL/R.
 *
 * @param mechL - Coordenadas 0..1 normalizadas del mover izquierdo.
 * @param mechR - Coordenadas 0..1 normalizadas del mover derecho.
 * @returns MovementIntent de bypass listo para el MasterArbiter.
 *
 * @pure
 */
export function buildMechanicsBypassIntent(mechL, mechR) {
    const avgPan = Math.max(0, Math.min(1, (mechL.pan + mechR.pan) / 2));
    const avgTilt = Math.max(0, Math.min(1, (mechL.tilt + mechR.tilt) / 2));
    return {
        pattern: 'CELESTIAL_MOVERS',
        speed: 0.1, // Implícito en las coordenadas directas
        amplitude: 0.5, // Amplitud ya codificada en las coordenadas
        centerX: avgPan,
        centerY: avgTilt,
        beatSync: false, // THE DEEP FIELD no usa beatSync
        mechanicsL: { pan: Math.max(0, Math.min(1, mechL.pan)), tilt: Math.max(0, Math.min(1, mechL.tilt)) },
        mechanicsR: { pan: Math.max(0, Math.min(1, mechR.pan)), tilt: Math.max(0, Math.min(1, mechR.tilt)) },
    };
}
