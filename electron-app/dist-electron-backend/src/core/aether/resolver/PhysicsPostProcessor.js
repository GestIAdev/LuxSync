/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚙️  AETHER MATRIX — PHYSICS POST-PROCESSOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 4518.1 — THE INERTIA ENGINE
 *
 * Procesa el ArbitratedNodeMap post-arbitración, pre-resolución.
 * Solo actúa sobre nodos KINETIC — el resto pasa transparente.
 *
 * POSICIÓN EN EL PIPELINE:
 *   IntentBus → NodeArbiter → [PhysicsPostProcessor] → NodeResolver
 *
 * RESPONSABILIDAD:
 * El NodeArbiter produce posiciones target instantáneas (0-1).
 * Este módulo aplica un modelo de inercia física realista:
 *   - Modo CLASSIC: rampa suave con aceleración/deceleración.
 *   - Modo SNAP:    seguimiento rápido con factor de porcentaje.
 * Ambos respetan los límites de velocidad máxima del motor.
 *
 * LA CLÁUSULA WOODSTOCK (Precisión Temporal):
 * PROHIBIDO usar Date.now(). El deltaMs llega del FrameScheduler
 * basado en performance.now(). Esta ley existe porque 1ms de
 * baja resolución temporal puede convertir una aceleración fluida
 * en un parón de hardware (división por cero o velocidad 0).
 *
 * ZERO-ALLOC HOT PATH:
 * - Estado por nodo en Float32Arrays pre-allocated.
 * - Sin new Map(), new Array(), ni spread operators en process().
 * - Los Records del ArbitratedNodeMap se mutan in-place (son mutables
 *   en runtime aunque el tipo diga Readonly<> — el Arbiter los produce
 *   como objetos planos y solo los castea a ReadonlyMap para el contrato).
 *
 * @module core/aether/resolver/PhysicsPostProcessor
 * @version WAVE 4518.1
 */
import { NodeFamily } from '../types';
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — Seguridad mecánica
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Tiempo delta máximo en ms antes de activar TELEPORT MODE.
 * Si el frame jump supera este umbral, asumimos que el motor
 * estuvo congelado (sleep, tab background) y saltamos directo al target.
 * Idéntico al comportamiento del FixturePhysicsDriver legacy.
 */
const TELEPORT_THRESHOLD_MS = 200;
/**
 * Anti-jitter threshold (unidades normalizadas 0-1).
 * Deltas por debajo de este valor se ignoran para evitar ruido en motores
 * con tremor eléctrico. Equivalente al 3% de la velocidad máxima
 * en el FixturePhysicsDriver — aquí lo expresamos en espacio normalizado.
 */
const JITTER_THRESHOLD = 0.0005;
/**
 * Factor de conversión: grados/segundo → unidades normalizadas/segundo.
 * Los motores pan/tilt tienen un rango físico de 540° → 1.0 normalizado.
 */
const DEG_PER_SEC_TO_NORM_PER_SEC = 1 / 540;
/**
 * Aceleración máxima de seguridad en espacio normalizado/s².
 * En WAVE 4636 liberamos la ruta clásica: este cap ya no se deriva de DMX/255/540,
 * porque el dominio aquí ya es normalizado [0..1].
 */
const SAFETY_MAX_ACCELERATION_NORM = 20.0;
/**
 * Velocidad máxima de seguridad en espacio normalizado/s.
 * En WAVE 4636 liberamos la ruta clásica: permitimos barridos rápidos en
 * espacio normalizado sin el cap microscópico heredado de DMX.
 */
const SAFETY_MAX_VELOCITY_NORM = 5.0;
// ── WAVE 4617-B M3: Inercia espacial 3D parametrizada por escenario ─────
/**
 * Factor de conversión: grados → radianes.
 * Usado para derivar la velocidad lineal máxima a partir de la velocidad
 * angular del motor y la escala del escenario.
 *
 * maxVelLinear = motorSpeed(deg/s) * DEG_TO_RAD * stageHalf(m)
 *
 * Esto escala correctamente: un escenario de 16m produce el doble de
 * velocidad lineal que uno de 8m para el mismo motor, reflejando que
 * el motor necesita barrer más metros por segundo en un espacio grande.
 */
const DEG_TO_RAD = Math.PI / 180;
/** Velocidad máxima de seguridad base en espacio métrico [m/s] */
const SAFETY_MAX_3D_VEL_BASE_MS = 5.0;
/** Aceleración máxima de seguridad base en espacio métrico [m/s²] */
const SAFETY_MAX_3D_ACC_BASE_MS2 = 20.0;
/** Escala de referencia del escenario (diagonal del default 8×4m) */
const REF_STAGE_DIAG = Math.sqrt(8 * 8 + 4 * 4); // ≈ 8.94m
/** Posición 3D inicial X por defecto — centro del escenario [m] */
const DEFAULT_3D_X = 0.0;
/** Posición 3D inicial Y por defecto — altura de trabajo [m] */
const DEFAULT_3D_Y = 1.5;
/** Posición 3D inicial Z por defecto — profundidad nominal [m] */
const DEFAULT_3D_Z = 2.0;
// ═══════════════════════════════════════════════════════════════════════════
// SLOT INDICES — Para los Float32Arrays de estado
// ═══════════════════════════════════════════════════════════════════════════
/** Posición actual de pan [0-1] */
const SLOT_PAN_POS = 0;
/** Posición actual de tilt [0-1] */
const SLOT_TILT_POS = 1;
/** Velocidad actual de pan [norm/s] */
const SLOT_PAN_VEL = 2;
/** Velocidad actual de tilt [norm/s] */
const SLOT_TILT_VEL = 3;
// ── WAVE 4523.5: Slots para inercia espacial 3D ──────────────────────
/** Posición actual X en escenario [metros] */
const SLOT_X3D_POS = 4;
/** Posición actual Y en escenario [metros] */
const SLOT_Y3D_POS = 5;
/** Posición actual Z en escenario [metros] */
const SLOT_Z3D_POS = 6;
/** Velocidad actual X [m/s] */
const SLOT_X3D_VEL = 7;
/** Velocidad actual Y [m/s] */
const SLOT_Y3D_VEL = 8;
/** Velocidad actual Z [m/s] */
const SLOT_Z3D_VEL = 9;
/** Tamaño del buffer de estado por nodo (4 legacy pan/tilt + 6 3D spatial) */
const STATE_SLOTS = 10;
// ═══════════════════════════════════════════════════════════════════════════
// IMPLEMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * PhysicsPostProcessor — Implementación concreta del IPhysicsPostProcessor.
 *
 * Diseñado para 0 allocations en el hot path (44Hz).
 *
 * ESTADO INTERNO:
 * - `_states`: Map<NodeId, Float32Array> — buffer de 4 floats (panPos, tiltPos, panVel, tiltVel)
 *   pre-alocado en registerNode(). En el hot path solo se leen/escriben índices en arrays existentes.
 *
 * MODO CLASSIC (curva-S):
 * - Si la distancia al target supera la distancia de frenado, acelera.
 * - Si está dentro de la distancia de frenado, desacelera.
 * - Clampeado por velocidad máxima del motor (convertida a norm/s).
 * - Anti-jitter: deltas < JITTER_THRESHOLD ignorados.
 *
 * MODO SNAP (fracción de delta):
 * - Mueve snapFactor * (target - current) por frame.
 * - Clampeado por un REV_LIMIT por frame.
 * - Más simple y predecible para géneros electrónicos.
 */
export class PhysicsPostProcessor {
    constructor() {
        // ── Estado de inercia por nodo (patch-time allocated) ─────────────────
        this._states = new Map();
        // ── Configuración de modo ──────────────────────────────────────────────
        this._mode = 'classic';
        this._snapFactor = 0.5;
        // ── Variables temporales reutilizadas en el hot path (zero-alloc) ─────
        // NO son const porque se mutan en cada iteración del process()
        this._panTarget = 0;
        this._tiltTarget = 0;
        this._panDelta = 0;
        this._tiltDelta = 0;
        this._panVel = 0;
        this._tiltVel = 0;
        this._panPos = 0;
        this._tiltPos = 0;
        this._dt = 0; // deltaMs convertido a segundos
        this._maxVelNorm = 0; // velocidad máxima normalizada para este nodo
        this._maxAccNorm = 0; // aceleración máxima normalizada para este nodo
        this._brakeDist = 0; // distancia de frenado actual
        this._telemetryFrame = 0; // WAVE 4621-A: throttle para sondas
        // ── WAVE 4617-B M3: Stage bounds + temporales 3D (zero-alloc) ────────
        this._stageHalfW = 4.0; // half width  (meters)
        this._stageHalfH = 2.0; // half height (meters)
        this._stageHalfD = 1.0; // half depth  (meters)
        this._stageDiag = REF_STAGE_DIAG;
        this._x3dTarget = 0;
        this._y3dTarget = 0;
        this._z3dTarget = 0;
        this._maxVelX3d = 0;
        this._maxVelY3d = 0;
        this._maxVelZ3d = 0;
        this._maxAcc3d = 0;
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * Procesa el ArbitratedNodeMap in-place.
     *
     * ESTRATEGIA DE ITERACIÓN:
     * En lugar de iterar todo el ArbitratedNodeMap buscando nodos KINETIC
     * (O(N) con lookup en NodeGraph por cada entry), iteramos el view KINETIC
     * del NodeGraph directamente — solo nodos que nos importan, zero-alloc.
     * Luego accedemos al entry del ArbitratedNodeMap por nodeId (O(1) Map.get).
     */
    process(arbitrated, nodeGraph, deltaMs, _vibeId) {
        // TELEPORT MODE: frame jump demasiado grande → skip physics, el motor
        // habría estado congelado de todos modos (background tab, sleep, etc.)
        if (deltaMs <= 0 || deltaMs > TELEPORT_THRESHOLD_MS) {
            if (deltaMs > TELEPORT_THRESHOLD_MS) {
                this._teleportAll(arbitrated, nodeGraph);
            }
            return;
        }
        // Convertir delta a segundos — una sola vez por frame
        this._dt = deltaMs * 0.001;
        const kineticView = nodeGraph.getView(NodeFamily.KINETIC);
        kineticView.forEach((node) => {
            const entry = arbitrated.get(node.nodeId);
            if (entry === undefined)
                return; // nodo sin intent este frame → skip
            const state = this._states.get(node.nodeId);
            if (state === undefined)
                return; // nodo no registrado → skip (no debería ocurrir)
            // ── WAVE 4617-B M1+M3: Inercia espacial 3D parametrizada por escenario ──
            // La decisión de procesar en modo 3D depende de:
            //   1. El device está posicionado (isPlaced === true)
            //   2. Existen canales espaciales targetX en el ArbitratedNodeMap
            // Esto es consistente con el Gatekeeper de Hierro del NodeResolver.
            const device3d = entry['targetX'] !== undefined
                ? nodeGraph.getDevice(node.deviceId)
                : undefined;
            if (device3d?.isPlaced === true && entry['targetX'] !== undefined) {
                const xT = entry['targetX'];
                const yT = entry['targetY'];
                const zT = entry['targetZ'];
                this._x3dTarget = isFinite(xT) ? xT : state[SLOT_X3D_POS];
                this._y3dTarget = isFinite(yT ?? NaN) ? (yT ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS];
                this._z3dTarget = isFinite(zT ?? NaN) ? (zT ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS];
                // WAVE 4617-B M3: Derivar límites de velocidad por eje a partir de
                // la velocidad angular del motor y la escala real del escenario.
                //
                //   maxVelLinear = motorAngularSpeed * DEG_TO_RAD * stageHalfDimension
                //
                // Esto reemplaza el factor fijo 4.0/270 que asumía un escenario de 8m.
                // Un escenario grande produce límites lineales más altos (correcto:
                // el motor barre más metros por segundo en un espacio grande).
                //
                // El safety cap escala con la diagonal del escenario vs la referencia
                // (8×4m) para no estrangular escenarios grandes.
                const stageScale = this._stageDiag / REF_STAGE_DIAG;
                const safetyMaxVel = SAFETY_MAX_3D_VEL_BASE_MS * Math.max(1.0, stageScale);
                const safetyMaxAcc = SAFETY_MAX_3D_ACC_BASE_MS2 * Math.max(1.0, stageScale);
                this._maxVelX3d = Math.min(node.maxPanSpeed * DEG_TO_RAD * this._stageHalfW, safetyMaxVel);
                this._maxVelY3d = Math.min(node.maxTiltSpeed * DEG_TO_RAD * this._stageHalfH, safetyMaxVel);
                this._maxVelZ3d = Math.min(node.maxPanSpeed * DEG_TO_RAD * this._stageHalfD, safetyMaxVel);
                this._maxAcc3d = Math.min(Math.max(this._maxVelX3d, this._maxVelY3d) * 4, safetyMaxAcc);
                // WAVE 4621-A: TELEMETRY — Spatial 3D physics limits (cada 60 frames)
                if ((++this._telemetryFrame % 60) === 0) {
                    console.log(`[PHYSICS-3D] node=${String(node.nodeId)} mode=${this._mode} ` +
                        `stageHalf=(${this._stageHalfW.toFixed(2)},${this._stageHalfH.toFixed(2)},${this._stageHalfD.toFixed(2)}) ` +
                        `diag=${this._stageDiag.toFixed(2)} stageScale=${stageScale.toFixed(2)} ` +
                        `motorSpeeds=(pan=${node.maxPanSpeed},tilt=${node.maxTiltSpeed}) ` +
                        `maxVel3D=(${this._maxVelX3d.toFixed(4)},${this._maxVelY3d.toFixed(4)},${this._maxVelZ3d.toFixed(4)}) ` +
                        `maxAcc3D=${this._maxAcc3d.toFixed(4)} dt=${this._dt.toFixed(4)} ` +
                        `target=(${this._x3dTarget.toFixed(2)},${this._y3dTarget.toFixed(2)},${this._z3dTarget.toFixed(2)})`);
                }
                if (this._mode === 'snap') {
                    const dxSnap = this._snapFactor * (this._x3dTarget - state[SLOT_X3D_POS]);
                    const dySnap = this._snapFactor * (this._y3dTarget - state[SLOT_Y3D_POS]);
                    const dzSnap = this._snapFactor * (this._z3dTarget - state[SLOT_Z3D_POS]);
                    const maxMoveX = this._maxVelX3d * this._dt;
                    const maxMoveY = this._maxVelY3d * this._dt;
                    const maxMoveZ = this._maxVelZ3d * this._dt;
                    state[SLOT_X3D_POS] += clampAbs(Math.abs(dxSnap) < JITTER_THRESHOLD ? 0 : dxSnap, maxMoveX);
                    state[SLOT_Y3D_POS] += clampAbs(Math.abs(dySnap) < JITTER_THRESHOLD ? 0 : dySnap, maxMoveY);
                    state[SLOT_Z3D_POS] += clampAbs(Math.abs(dzSnap) < JITTER_THRESHOLD ? 0 : dzSnap, maxMoveZ);
                    state[SLOT_X3D_VEL] = 0;
                    state[SLOT_Y3D_VEL] = 0;
                    state[SLOT_Z3D_VEL] = 0;
                }
                else {
                    this._applyClassicAxis(state, SLOT_X3D_POS, SLOT_X3D_VEL, this._x3dTarget, this._maxVelX3d, this._maxAcc3d);
                    this._applyClassicAxis(state, SLOT_Y3D_POS, SLOT_Y3D_VEL, this._y3dTarget, this._maxVelY3d, this._maxAcc3d);
                    this._applyClassicAxis(state, SLOT_Z3D_POS, SLOT_Z3D_VEL, this._z3dTarget, this._maxVelZ3d, this._maxAcc3d);
                }
                entry['targetX'] = state[SLOT_X3D_POS];
                entry['targetY'] = state[SLOT_Y3D_POS];
                entry['targetZ'] = state[SLOT_Z3D_POS];
                return; // nodo espacial procesado — skip flujo legacy pan/tilt
            }
            // Leer target del ArbitratedNodeMap
            this._panTarget = entry['pan'] ?? 0.5;
            this._tiltTarget = entry['tilt'] ?? 0.5;
            // NaN guard — si el arbiter produce un NaN, mantener posición anterior
            if (!isFinite(this._panTarget))
                this._panTarget = state[SLOT_PAN_POS];
            if (!isFinite(this._tiltTarget))
                this._tiltTarget = state[SLOT_TILT_POS];
            // Leer estado de inercia (posición y velocidad actuales)
            this._panPos = state[SLOT_PAN_POS];
            this._tiltPos = state[SLOT_TILT_POS];
            this._panVel = state[SLOT_PAN_VEL];
            this._tiltVel = state[SLOT_TILT_VEL];
            // Calcular límites del motor en espacio normalizado/s
            // maxPanSpeed y maxTiltSpeed están en grados/segundo
            // 540° → 1.0 normalizado
            this._maxVelNorm = Math.min(node.maxPanSpeed * DEG_PER_SEC_TO_NORM_PER_SEC, SAFETY_MAX_VELOCITY_NORM);
            this._maxAccNorm = Math.min(
            // Usamos maxPanSpeed como proxy para aceleración si no hay dato explícito
            // (el FixturePhysicsDriver hace lo mismo con el physicsProfile)
            node.maxPanSpeed * DEG_PER_SEC_TO_NORM_PER_SEC * 4, SAFETY_MAX_ACCELERATION_NORM);
            if (this._mode === 'snap') {
                this._applySnap(state);
            }
            else {
                this._applyClassic(state, node);
            }
            // Clamp final a [0, 1] — la posición física no puede salir del rango
            state[SLOT_PAN_POS] = clamp01(state[SLOT_PAN_POS]);
            state[SLOT_TILT_POS] = clamp01(state[SLOT_TILT_POS]);
            // Escribir los valores suavizados de vuelta al ArbitratedNodeMap (in-place)
            entry['pan'] = state[SLOT_PAN_POS];
            entry['tilt'] = state[SLOT_TILT_POS];
            // Actualizar también el campo mutable del nodo para que el KineticSystem
            // del siguiente frame tenga la posición correcta como base de cálculo
            node.currentPosition.pan = state[SLOT_PAN_POS];
            node.currentPosition.tilt = state[SLOT_TILT_POS];
        });
    }
    registerNode(nodeId) {
        if (this._states.has(nodeId))
            return; // idempotente
        // Pre-aloca el buffer de estado inicializado a posición neutra (0.5, 0.5)
        const state = new Float32Array(STATE_SLOTS);
        state[SLOT_PAN_POS] = 0.5;
        state[SLOT_TILT_POS] = 0.5;
        state[SLOT_PAN_VEL] = 0;
        state[SLOT_TILT_VEL] = 0;
        state[SLOT_X3D_POS] = DEFAULT_3D_X;
        state[SLOT_Y3D_POS] = DEFAULT_3D_Y;
        state[SLOT_Z3D_POS] = DEFAULT_3D_Z;
        state[SLOT_X3D_VEL] = 0;
        state[SLOT_Y3D_VEL] = 0;
        state[SLOT_Z3D_VEL] = 0;
        this._states.set(nodeId, state);
    }
    onVibeChange(_newVibeId) {
        // Zerear velocidades en todos los nodos para evitar overshoot residual
        // entre vibes de distinto tempo. La posición se mantiene (no teleport).
        for (const state of this._states.values()) {
            state[SLOT_PAN_VEL] = 0;
            state[SLOT_TILT_VEL] = 0;
            state[SLOT_X3D_VEL] = 0;
            state[SLOT_Y3D_VEL] = 0;
            state[SLOT_Z3D_VEL] = 0;
        }
    }
    /**
     * WAVE 4617-B M3: Actualiza las dimensiones del escenario para escalar
     * la inercia espacial proporcionalmente.
     * Llamar cuando cambie el stageConfig (setFixtures, stage resize).
     */
    setStageBounds(width, height, depth) {
        this._stageHalfW = width > 0 ? width * 0.5 : 4.0;
        this._stageHalfH = height > 0 ? height * 0.5 : 2.0;
        this._stageHalfD = depth > 0 ? depth * 0.5 : 1.0;
        this._stageDiag = Math.sqrt(width * width + height * height) || REF_STAGE_DIAG;
    }
    setPhysicsMode(mode, snapFactor = 0.5) {
        this._mode = mode;
        this._snapFactor = clamp01(snapFactor);
        // Al cambiar de modo, limpiar velocidades residuales
        for (const state of this._states.values()) {
            state[SLOT_PAN_VEL] = 0;
            state[SLOT_TILT_VEL] = 0;
            state[SLOT_X3D_VEL] = 0;
            state[SLOT_Y3D_VEL] = 0;
            state[SLOT_Z3D_VEL] = 0;
        }
    }
    // ═════════════════════════════════════════════════════════════════════════
    // PRIVATE — Modos de física
    // ═════════════════════════════════════════════════════════════════════════
    /**
     * SNAP MODE: desplazamiento fraccional directo al target.
     *
     * newPos = currentPos + snapFactor * (target - current)
     *
     * Clampeado por un REV_LIMIT por frame: el motor no puede mover
     * más de maxVel * dt en un solo tick, incluso en modo snap.
     */
    _applySnap(state) {
        const maxMovePerFrame = this._maxVelNorm * this._dt;
        this._panDelta = this._snapFactor * (this._panTarget - this._panPos);
        this._tiltDelta = this._snapFactor * (this._tiltTarget - this._tiltPos);
        // Anti-jitter
        if (Math.abs(this._panDelta) < JITTER_THRESHOLD)
            this._panDelta = 0;
        if (Math.abs(this._tiltDelta) < JITTER_THRESHOLD)
            this._tiltDelta = 0;
        // REV_LIMIT clamp
        this._panDelta = clampAbs(this._panDelta, maxMovePerFrame);
        this._tiltDelta = clampAbs(this._tiltDelta, maxMovePerFrame);
        state[SLOT_PAN_POS] = this._panPos + this._panDelta;
        state[SLOT_TILT_POS] = this._tiltPos + this._tiltDelta;
        // Snap no acumula velocidad física — resetear a 0
        state[SLOT_PAN_VEL] = 0;
        state[SLOT_TILT_VEL] = 0;
    }
    /**
     * CLASSIC MODE: física de curva-S con aceleración y frenado.
     *
     * Algoritmo:
     * 1. Calcular distancia al target.
     * 2. Calcular distancia de frenado: d_brake = v² / (2 * maxAcc)
     * 3. Si |delta| > d_brake → acelerar (hasta maxVel)
     * 4. Si |delta| <= d_brake → frenar (hasta 0)
     * 5. Integrar posición: pos += vel * dt
     *
     * Fuente: FixturePhysicsDriver.applyPhysicsEasing() adaptado a espacio normalizado.
     */
    _applyClassic(state, node) {
        // Calcular maxVel diferenciado por eje si el motor tiene velocidades distintas
        const maxVelTilt = Math.min(node.maxTiltSpeed * DEG_PER_SEC_TO_NORM_PER_SEC, SAFETY_MAX_VELOCITY_NORM);
        this._applyClassicAxis(state, SLOT_PAN_POS, SLOT_PAN_VEL, this._panTarget, this._maxVelNorm, this._maxAccNorm);
        this._applyClassicAxis(state, SLOT_TILT_POS, SLOT_TILT_VEL, this._tiltTarget, maxVelTilt, this._maxAccNorm);
    }
    /**
     * Aplica física de curva-S en un eje único (pan o tilt).
     * Inline para evitar overhead de call en el hot path.
     */
    _applyClassicAxis(state, posSlot, velSlot, target, maxVel, maxAcc) {
        let pos = state[posSlot];
        let vel = state[velSlot];
        const delta = target - pos;
        const absDelta = Math.abs(delta);
        // Anti-jitter: si el delta es microscópico y la velocidad ya es mínima, stop
        if (absDelta < JITTER_THRESHOLD && Math.abs(vel) < JITTER_THRESHOLD) {
            state[posSlot] = target; // snap al target exacto para evitar drift
            state[velSlot] = 0;
            return;
        }
        // Distancia de frenado = v² / (2 * maxAcc)
        this._brakeDist = (vel * vel) / (2 * maxAcc + 0.000001); // +epsilon evita div/0
        const sign = delta >= 0 ? 1 : -1;
        if (absDelta > this._brakeDist) {
            // Fase de aceleración
            vel += sign * maxAcc * this._dt;
        }
        else {
            // Fase de frenado
            vel -= sign * maxAcc * this._dt;
            // Evitar overshoot de velocidad en sentido contrario durante frenado
            if (sign > 0 && vel < 0)
                vel = 0;
            if (sign < 0 && vel > 0)
                vel = 0;
        }
        // Clamp de velocidad máxima (cap de seguridad)
        vel = clampAbs(vel, maxVel);
        // Integrar posición
        pos += vel * this._dt;
        // Si cruzamos el target, snap y stop para evitar oscilación
        if ((sign > 0 && pos >= target) || (sign < 0 && pos <= target)) {
            pos = target;
            vel = 0;
        }
        state[posSlot] = pos;
        state[velSlot] = vel;
    }
    /**
     * TELEPORT MODE: si deltaMs > TELEPORT_THRESHOLD_MS, copiar targets directamente.
     * El motor estuvo congelado — no tiene sentido simular inercia de ese gap.
     */
    _teleportAll(arbitrated, nodeGraph) {
        const kineticView = nodeGraph.getView(NodeFamily.KINETIC);
        kineticView.forEach((node) => {
            const entry = arbitrated.get(node.nodeId);
            if (entry === undefined)
                return;
            const state = this._states.get(node.nodeId);
            if (state === undefined)
                return;
            // WAVE 4617-B M1: Consistent isPlaced guard in teleport path
            const teleportDevice = entry['targetX'] !== undefined
                ? nodeGraph.getDevice(node.deviceId)
                : undefined;
            if (teleportDevice?.isPlaced === true && entry['targetX'] !== undefined) {
                const xT = isFinite(entry['targetX']) ? entry['targetX'] : state[SLOT_X3D_POS];
                const yT = isFinite(entry['targetY'] ?? NaN) ? (entry['targetY'] ?? DEFAULT_3D_Y) : state[SLOT_Y3D_POS];
                const zT = isFinite(entry['targetZ'] ?? NaN) ? (entry['targetZ'] ?? DEFAULT_3D_Z) : state[SLOT_Z3D_POS];
                state[SLOT_X3D_POS] = xT;
                state[SLOT_Y3D_POS] = yT;
                state[SLOT_Z3D_POS] = zT;
                state[SLOT_X3D_VEL] = 0;
                state[SLOT_Y3D_VEL] = 0;
                state[SLOT_Z3D_VEL] = 0;
                entry['targetX'] = xT;
                entry['targetY'] = yT;
                entry['targetZ'] = zT;
                return;
            }
            const panT = isFinite(entry['pan'] ?? NaN) ? (entry['pan'] ?? 0.5) : state[SLOT_PAN_POS];
            const tiltT = isFinite(entry['tilt'] ?? NaN) ? (entry['tilt'] ?? 0.5) : state[SLOT_TILT_POS];
            state[SLOT_PAN_POS] = panT;
            state[SLOT_TILT_POS] = tiltT;
            state[SLOT_PAN_VEL] = 0;
            state[SLOT_TILT_VEL] = 0;
            entry['pan'] = panT;
            entry['tilt'] = tiltT;
            node.currentPosition.pan = panT;
            node.currentPosition.tilt = tiltT;
        });
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES — Inline para zero-overhead en hot path
// ═══════════════════════════════════════════════════════════════════════════
/** Clamp a [0, 1] */
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
/** Clamp el valor absoluto a [-maxAbs, +maxAbs] */
function clampAbs(v, maxAbs) {
    return v > maxAbs ? maxAbs : v < -maxAbs ? -maxAbs : v;
}
