/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — KINETIC SYSTEM
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.3: El cerebro del movimiento mecánico.
 *
 * RESPONSABILIDAD:
 * Traducir los vectores de movimiento (patrones del VMM —
 * Vibe Movement Manager) en NodeIntents de pan/tilt/rotation para
 * todos los KINETIC_NODEs registrados.
 *
 * DOMINIO:
 * El KineticSystem es el dueño exclusivo de los canales `pan`, `tilt`,
 * `pan_fine`, `tilt_fine`, `rotation`, y `speed` en la capa L0.
 *
 * FILOSOFÍA DE MOVIMIENTO:
 * El sistema genera posiciones en coordenadas normalizadas (0-1).
 * La conversión a DMX (0-255) es responsabilidad exclusiva del NodeResolver.
 * 0.5 siempre significa "centro" para pan/tilt.
 *
 * PATRONES VMM (Vibe Movement Manager):
 * Los patrones son funciones deterministas del tiempo y el contexto musical.
 * No hay Math.random() — el movimiento es siempre predecible y musical.
 *
 * Patrones disponibles (determinista, indexados por MusicalContext.section):
 * - 'idle'    → Pan/tilt estático en posición home
 * - 'sweep'   → Barrido sinusoidal sincronizado al BPM
 * - 'scatter' → Dispersión periódica basada en stereoIndex
 * - 'converge'→ Todos los fixtures apuntan al mismo punto
 * - 'wave'    → Onda viajera a través del array (snake)
 * - 'build'   → Tilt cae progresivamente (tensión creciente)
 * - 'drop'    → Movimiento rápido + posición dramática
 *
 * STEREO ROUTING:
 * Los nodos con position.x < 0 (izquierda) espejean el pan del lado derecho.
 * Snake pattern: cada nodo tiene un phase offset proporcional a stereoIndex.
 *
 * GEARBOX BUDGET:
 * El sistema respeta `maxPanSpeed` y `maxTiltSpeed` del nodo.
 * Si el pattern quiere moverse más rápido que el motor permite,
 * el movimiento se limita (clampeado por velocidad máxima).
 *
 * ZERO-ALLOC GARANTIZADO:
 * Todo el cálculo es aritmética pura sobre variables locales del stack.
 * `_intentScratch` + `_valuesDict` heredados de BaseSystem — sin new.
 *
 * @module core/aether/systems/KineticSystem
 * @version WAVE 3505.3
 */
import { NodeFamily } from '../types';
import { BaseSystem, } from './BaseSystem';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const KINETIC_INTENT_PRIORITY = 10;
// Posición home (centro): 0.5 normalizado = centro del rango pan/tilt
const HOME_PAN = 0.5;
const HOME_TILT = 0.5;
// Rango de movimiento del sweep sinusoidal en unidades normalizadas.
// 0.5 ±0.35 = rango total de 0.15..0.85 (evitamos los extremos mecánicos)
const SWEEP_AMPLITUDE_PAN = 0.35;
const SWEEP_AMPLITUDE_TILT = 0.20;
// Velocidad del seno sincronizado al BPM en modo sweep.
// Se calcula como `beatsPerSecond * TWO_PI` cuando bpm > 0.
const TWO_PI = Math.PI * 2;
// Tilt dramático para el drop: la cabeza apunta hacia el público
const DROP_TILT = 0.20;
// Tilt base para build: sube progresivamente hasta apuntar al techo
const BUILD_TILT_TARGET = 0.90;
// Separación de fase entre nodos del array en modo wave/scatter.
// 1 / 8 = cada fixture en un array de 8 elementos lleva 45° de fase.
const WAVE_PHASE_INCREMENT = 1 / 8;
// Threshold de BPM mínimo para sincronización
const MIN_BPM_THRESHOLD = 40;
// Threshold de velocidad máxima de motor para considerar suave (grados/s)
// Motores con maxPanSpeed < SLOW_MOTOR_THRESHOLD reciben targets suavizados.
const SLOW_MOTOR_THRESHOLD = 90;
// ═══════════════════════════════════════════════════════════════════════════
// KINETIC SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎯 KineticSystem — El cerebro del movimiento en el Motor Agnóstico.
 *
 * Genera posiciones de pan/tilt para cada KINETIC_NODE basándose en:
 * - Patrón VMM (determinado por la sección musical).
 * - Contexto musical (BPM, beatPhase, dropImminent, sectionIntensity).
 * - Routing stereo (position.x determina mirror/direct).
 * - Budget de velocidad del motor (maxPanSpeed / maxTiltSpeed).
 */
export class KineticSystem extends BaseSystem {
    constructor() {
        super();
        this.name = 'KineticSystem';
        this.family = NodeFamily.KINETIC;
        this._intentScratch.source = 'kinetic_system';
        this._intentScratch.priority = KINETIC_INTENT_PRIORITY;
        this._intentScratch.confidence = 1.0;
    }
    // ═════════════════════════════════════════════════════════════════════════
    // process() — EL HOT PATH. 44 veces por segundo.
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Calcula y escribe los NodeIntents de posición para todos los
     * KINETIC_NODEs en el IntentBus.
     *
     * PROTOCOLO ZERO-ALLOC:
     * ```
     * selectPattern(musical)           → pattern ID (integer)
     * forEach(node) → {
     *   1. computeRawPosition(node, pattern, context) → {pan, tilt}
     *   2. applyStereRouting(node, pan)               → mirroredPan
     *   3. applyGearboxBudget(node, position, prev)   → clampedPosition
     *   4. writeIntent(_intentScratch, position)
     *   5. bus.push(_intentScratch as INodeIntent)
     * }
     * ```
     */
    process(view, context, bus) {
        const musical = context.musical;
        const audio = context.audio;
        const deltaMs = context.deltaMs;
        const vibe = context.vibe;
        // Seleccionar el patrón VMM para el frame actual (O(1), sin alloc)
        const pattern = KineticSystem._selectPattern(musical);
        // Pre-limpiar keys del frame anterior
        if ('pan_fine' in this._valuesDict)
            delete this._valuesDict['pan_fine'];
        if ('tilt_fine' in this._valuesDict)
            delete this._valuesDict['tilt_fine'];
        if ('rotation' in this._valuesDict)
            delete this._valuesDict['rotation'];
        if ('speed' in this._valuesDict)
            delete this._valuesDict['speed'];
        view.forEach((node) => {
            // ── 1. Calcular posición raw según el patrón VMM ──────────────────────
            let pan = HOME_PAN;
            let tilt = HOME_TILT;
            switch (pattern) {
                case 0: // idle
                    pan = HOME_PAN;
                    tilt = HOME_TILT;
                    break;
                case 1: { // sweep — barrido sinusoidal sincronizado al BPM
                    const freq = audio.bpm > MIN_BPM_THRESHOLD
                        ? (audio.bpm / 60) * TWO_PI
                        : TWO_PI * 0.5; // 0.5 Hz si no hay BPM detectado
                    // Phase offset único por nodo basado en stereoIndex — onda viajera
                    const phaseOffset = node.stereoIndex * WAVE_PHASE_INCREMENT * TWO_PI;
                    // nowMs en segundos para el argumento del seno
                    const t = context.nowMs / 1000;
                    pan = HOME_PAN + SWEEP_AMPLITUDE_PAN * Math.sin(freq * t + phaseOffset);
                    tilt = HOME_TILT + SWEEP_AMPLITUDE_TILT * Math.sin(freq * t * 0.5 + phaseOffset);
                    break;
                }
                case 2: { // scatter — posiciones dispersas fijas por nodo
                    // Cada nodo tiene una posición "personal" estable que no cambia
                    // en esta sección, basada en su índice en el array.
                    // Función determinista: f(stereoIndex, stereoTotal)
                    // Produce distribución regular sin random.
                    const total = node.stereoTotal > 0 ? node.stereoTotal : 1;
                    const frac = node.stereoIndex / total;
                    pan = 0.15 + frac * 0.70; // 0.15 a 0.85, distribuido regular
                    tilt = 0.35 + (1 - frac) * 0.30; // tilt inverso al pan
                    break;
                }
                case 3: { // converge — todos apuntan al mismo punto
                    // El punto central es modulado por la tensión armónica
                    const tension = context.musical.harmonicTension;
                    pan = HOME_PAN;
                    tilt = BASE_lerp(0.6, 0.3, tension); // más tensión = más abajo
                    break;
                }
                case 4: { // wave — onda viajera lenta
                    const phase = audio.beatPhase; // 0-1 dentro del beat actual
                    const waveOffset = (node.stereoIndex * WAVE_PHASE_INCREMENT + phase) % 1;
                    pan = 0.2 + waveOffset * 0.6; // rango 0.2..0.8
                    tilt = HOME_TILT + SWEEP_AMPLITUDE_TILT * Math.sin(waveOffset * TWO_PI);
                    break;
                }
                case 5: { // build — tilt sube progresivamente
                    // El tilt sube desde HOME hasta BUILD_TILT_TARGET
                    // en proporción al tiempo transcurrido en la sección
                    const progress = BaseSystem.clamp01(musical.sectionElapsedMs / 16000); // 16s
                    tilt = BASE_lerp(HOME_TILT, BUILD_TILT_TARGET, progress * musical.sectionIntensity);
                    pan = HOME_PAN + SWEEP_AMPLITUDE_PAN * 0.5 * Math.sin((context.nowMs / 1000) * 0.8 * TWO_PI);
                    break;
                }
                case 6: { // drop — movimiento dramático de impacto
                    // Al inicio del drop: movimiento rápido hacia posición de impacto
                    const elapsed = musical.sectionElapsedMs;
                    const settlePeriod = 400; // ms para estabilizarse
                    if (elapsed < settlePeriod) {
                        const t = elapsed / settlePeriod;
                        tilt = BASE_lerp(HOME_TILT, DROP_TILT, BaseSystem.applySCurve(t));
                    }
                    else {
                        tilt = DROP_TILT;
                    }
                    // Phase offset stereo para abanico de impacto
                    const total = node.stereoTotal > 0 ? node.stereoTotal : 1;
                    const frac = node.stereoIndex / total;
                    pan = 0.30 + frac * 0.40; // 0.30 a 0.70
                    break;
                }
                default:
                    pan = HOME_PAN;
                    tilt = HOME_TILT;
                    break;
            }
            // ── 2. Stereo routing: mirror/direct según position.x ─────────────────
            // Nodos en la izquierda (x < 0) espejean el pan.
            // Esto crea efecto de apertura/cierre simétrico sin lógica adicional.
            if (node.physicalPosition.x < 0) {
                pan = 1 - pan;
            }
            // ── 3. Escala global de movimiento del Vibe ───────────────────────────
            // movementSpeed=0 → todo va al HOME; movementSpeed=1 → movimiento total.
            const speed = vibe.movementSpeed;
            if (speed < 1.0) {
                pan = BASE_lerp(HOME_PAN, pan, speed);
                tilt = BASE_lerp(HOME_TILT, tilt, speed);
            }
            // ── 4. Gearbox budget: limitar velocidad máxima del motor ─────────────
            // Calculamos cuánto ha cambiado la posición y lo limitamos al maxSpeed.
            const currentPan = node.currentPosition.pan;
            const currentTilt = node.currentPosition.tilt;
            // maxSpeed en grados/s → convertir a unidades normalizadas por ms.
            // Asumimos 540° de rango total de pan (convención estándar de movers).
            // 1 unidad normalizada = 540°; velocidad en norm/ms = deg_per_s / (540 * 1000)
            const maxPanDeltaPerMs = node.maxPanSpeed / (540 * 1000);
            const maxTiltDeltaPerMs = node.maxTiltSpeed / (270 * 1000); // tilt: 270° estándar
            const maxPanDelta = maxPanDeltaPerMs * deltaMs;
            const maxTiltDelta = maxTiltDeltaPerMs * deltaMs;
            const panDelta = pan - currentPan;
            const tiltDelta = tilt - currentTilt;
            // Clampear el movimiento al budget del motor
            const limitedPan = currentPan + clampDelta(panDelta, maxPanDelta);
            const limitedTilt = currentTilt + clampDelta(tiltDelta, maxTiltDelta);
            // Actualizar posición actual del nodo in-place
            node.currentPosition.pan = limitedPan;
            node.currentPosition.tilt = limitedTilt;
            // ── 5. Escribir intent ─────────────────────────────────────────────────
            this._intentScratch.nodeId = node.nodeId;
            this._valuesDict['pan'] = limitedPan;
            this._valuesDict['tilt'] = limitedTilt;
            // Para motores lentos (steppers), incluir canales fine si están disponibles
            // Esto mejora la resolución de posición para hardware que lo soporta.
            if (node.maxPanSpeed < SLOW_MOTOR_THRESHOLD) {
                // El canal pan_fine lleva los decimales (0-1 = 0-255 de subprecisión)
                const panFraction = limitedPan * 255;
                this._valuesDict['pan_fine'] = (panFraction % 1);
                const tiltFraction = limitedTilt * 255;
                this._valuesDict['tilt_fine'] = (tiltFraction % 1);
            }
            bus.push(this._intentScratch);
        });
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Selecciona el patrón VMM para el frame actual basándose en la
     * sección musical y el estado del show.
     *
     * Retorna un integer (enum intern de patrón) — cero alloc.
     *
     * 0=idle, 1=sweep, 2=scatter, 3=converge, 4=wave, 5=build, 6=drop
     */
    static _selectPattern(musical) {
        if (musical.dropImminent)
            return 5; // build antes del drop
        switch (musical.section) {
            case 'intro': return 0; // idle o muy suave
            case 'verse': return 1; // sweep suave
            case 'build': return 5; // build + tensión
            case 'drop': return 6; // drop dramático
            case 'break': return 3; // converge suave
            case 'outro': return 0; // fade to home
            default: return musical.sectionIntensity > 0.7 ? 1 : 0;
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// INLINE HELPERS (no métodos de clase, para acceso más rápido en hot path)
// ═══════════════════════════════════════════════════════════════════════════
/** Lerp inline para el hot path (evita la penalización de lookup de método estático) */
function BASE_lerp(a, b, t) {
    return a + (b - a) * t;
}
/**
 * Clampear un delta de movimiento al máximo permitido.
 * Preserva el signo del delta.
 */
function clampDelta(delta, maxAbs) {
    if (delta > maxAbs)
        return maxAbs;
    if (delta < -maxAbs)
        return -maxAbs;
    return delta;
}
