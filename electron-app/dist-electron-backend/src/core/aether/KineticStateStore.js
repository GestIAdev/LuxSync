/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 AETHER MATRIX — KINETIC STATE STORE (WAVE 8271)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Almacén persistente del estado mecánico EXPLÍCITO del operador, particionado
 * por `deviceId`. Resuelve la "deshidratación cinética" documentada en
 * WAVE 8270-RECON: `purgeForShow()` + el swap atómico del NodeGraph destruían
 * el estado L2 (radar anchors, gobos, prismas, rotación continua, targets
 * espaciales) en CADA cambio de patch en caliente.
 *
 * MODELO DE VERDAD:
 *   - Los mapas del NodeArbiter/AetherKineticEngine son la verdad LIVE.
 *   - Este store es un MIRROR por referencia de esos mapas, indexado por
 *     `deviceId` (estable entre repatches — los nodeIds `${deviceId}:${suffix}`
 *     se derivan determinísticamente).
 *   - Mirror-by-reference: el arbiter/engine mutan sus Records in-place; al
 *     compartir la referencia el store refleja siempre el estado más fresco
 *     sin coste de copia y sin escrituras en el hot path.
 *
 * ESCRITORES (gesture/patch time — NUNCA en el frame loop):
 *   - NodeArbiter: setManualOverride/clearManualOverride,
 *     setMotorKineticOverride/clearMotorKineticOverride,
 *     setManualPatternLock/clearManualPatternLock,
 *     setInhibitLimit/clearInhibitLimit, purgeForShow/purgeForDevice.
 *   - AetherKineticEngine: setManualKinetics/updateScalars (via ref),
 *     removeNodes/stop, restoreNodeConfig.
 *   - FixtureHydrationEngine: capturePosition() antes de unregisterDevice.
 *
 * REHIDRATACIÓN:
 *   `FixtureHydrationEngine.registerAetherDevice()` consulta getDevice()
 *   tras registrar los nodos y re-aplica el estado al arbiter/engine/PPP.
 *   La guarda "skip-if-live" evita que el mirror pise estado más reciente.
 *
 * @module core/aether/KineticStateStore
 * @version WAVE 8271
 */
// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════
export class KineticStateStore {
    constructor() {
        /** deviceId → (nodeId → estado cinético) */
        this._devices = new Map();
    }
    // ── Internals ──────────────────────────────────────────────────────────
    /** deviceId desde un nodeId `${deviceId}:${suffix}` (fallback: el propio id) */
    _deviceIdOf(nodeId) {
        const sep = nodeId.indexOf(':');
        return (sep > 0 ? nodeId.slice(0, sep) : nodeId);
    }
    _nodeState(nodeId, deviceId) {
        const dev = deviceId ?? this._deviceIdOf(nodeId);
        let bucket = this._devices.get(dev);
        if (!bucket) {
            bucket = new Map();
            this._devices.set(dev, bucket);
        }
        let state = bucket.get(nodeId);
        if (!state) {
            state = {
                manualChannels: null,
                motorOverride: null,
                pattern: null,
                patternLock: false,
                spatialCoupled: false,
                distanceScale: null,
                inhibitLimit: null,
                lastPan: NaN,
                lastTilt: NaN,
            };
            bucket.set(nodeId, state);
        }
        return state;
    }
    // ── Mirrors del NodeArbiter (gesture time) ─────────────────────────────
    /** Post-state mirror de `_manualOverrides[nodeId]` — comparte la referencia. */
    mirrorManual(nodeId, record) {
        this._nodeState(nodeId).manualChannels = record;
    }
    /** La entrada del arbiter fue eliminada → el mirror se invalida. */
    dropManual(nodeId) {
        const dev = this._deviceIdOf(nodeId);
        const state = this._devices.get(dev)?.get(nodeId);
        if (state)
            state.manualChannels = null;
    }
    /** Post-state mirror de `_motorKineticOverrides[nodeId]` (contiene targetX/Y/Z en IK). */
    mirrorMotor(nodeId, record) {
        this._nodeState(nodeId).motorOverride = record;
    }
    dropMotor(nodeId) {
        const dev = this._deviceIdOf(nodeId);
        const state = this._devices.get(dev)?.get(nodeId);
        if (state)
            state.motorOverride = null;
    }
    notePatternLock(nodeId, locked) {
        this._nodeState(nodeId).patternLock = locked;
    }
    /** Mirror de `_spatialCoupledLock` — el nodo está en modo Spatial/IK. */
    noteSpatialCoupled(nodeId, coupled) {
        this._nodeState(nodeId).spatialCoupled = coupled;
    }
    /** Mirror de `_spatialDistanceScales` — escala de offsets por distancia al target. */
    noteDistanceScale(nodeId, scale) {
        this._nodeState(nodeId).distanceScale = scale;
    }
    noteInhibitLimit(nodeId, limit) {
        this._nodeState(nodeId).inhibitLimit = limit;
    }
    // ── Mirrors del AetherKineticEngine ────────────────────────────────────
    /** Registra la config de pista (referencia viva — updateScalars la muta in-place). */
    notePattern(nodeId, cfg) {
        this._nodeState(nodeId).pattern = cfg;
    }
    dropPattern(nodeId) {
        const dev = this._deviceIdOf(nodeId);
        const state = this._devices.get(dev)?.get(nodeId);
        if (state)
            state.pattern = null;
    }
    /** engine.stop() — todas las pistas eliminadas. */
    dropAllPatterns() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.pattern = null;
            }
        }
    }
    /**
     * Espejo de `arbiter.clearAllManualOverrides()`:
     * limpia manualChannels + motorOverride + patternLock en TODOS los devices.
     * Conserva pattern (la pista del engine sigue activa), inhibit y posición.
     */
    dropAllManualAndMotor() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.manualChannels = null;
                state.motorOverride = null;
                state.patternLock = false;
            }
        }
    }
    /** Espejo de `arbiter.clearAllMotorKineticOverrides()`. */
    dropAllMotor() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.motorOverride = null;
            }
        }
    }
    /** Espejo de `arbiter.clearAllManualPatternLocks()`. */
    dropAllPatternLocks() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.patternLock = false;
            }
        }
    }
    /** Espejo de `arbiter.clearAllInhibitLimits()`. */
    dropAllInhibitLimits() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.inhibitLimit = null;
            }
        }
    }
    /** Espejo de `arbiter.clearAllSpatialDistanceScales()`. */
    dropAllDistanceScales() {
        for (const bucket of this._devices.values()) {
            for (const state of bucket.values()) {
                state.distanceScale = null;
            }
        }
    }
    // ── Captura física (patch time, pre-unregister) ────────────────────────
    /** Snapshot de la posición física del nodo justo antes de morir. */
    capturePosition(nodeId, pan, tilt) {
        const state = this._nodeState(nodeId);
        state.lastPan = pan;
        state.lastTilt = tilt;
    }
    // ── Lectura para rehidratación ─────────────────────────────────────────
    /** Estado cinético almacenado de un device (undefined si nunca hubo). */
    getDevice(deviceId) {
        return this._devices.get(deviceId);
    }
    hasDevice(deviceId) {
        const bucket = this._devices.get(deviceId);
        return bucket !== undefined && bucket.size > 0;
    }
    // ── Purga ──────────────────────────────────────────────────────────────
    /** Elimina TODO el estado del device (fixture realmente eliminado del patch). */
    deleteDevice(deviceId) {
        this._devices.delete(deviceId);
    }
    /** Elimina un nodeId concreto (nodo desaparecido en la nueva definición del device). */
    deleteNode(nodeId) {
        const dev = this._deviceIdOf(nodeId);
        const bucket = this._devices.get(dev);
        if (!bucket)
            return;
        bucket.delete(nodeId);
        if (bucket.size === 0)
            this._devices.delete(dev);
    }
    /** Wipe total — equivalente a purgeForShow (solo en carga de show). */
    clear() {
        this._devices.clear();
    }
}
