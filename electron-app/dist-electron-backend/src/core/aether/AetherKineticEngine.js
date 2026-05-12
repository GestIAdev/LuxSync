/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER KINETIC ENGINE — WAVE 4700: NATIVE L2 RESOLVER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Motor cinético nativo en el pipeline Aether. Reemplaza la dependencia del
 * masterArbiter y del VibeMovementManager para el control MANUAL de patrones.
 *
 * RESPONSABILIDADES:
 * - Acumular fase propia (monotonic, deterministic) para cada fixture.
 * - Calcular la posición {x, y} del patrón activo con desfase de fan.
 * - Escribir `pan_base` / `tilt_base` en NodeArbiter L2 vía `setManualOverride`.
 *
 * ARQUITECTURA DE DATOS (flujo por frame):
 *   UI → IPC → AetherKineticEngine.setManualKinetics()     (configuración)
 *   TitanOrchestrator.tick() → engine.tick(dtSeconds)      (hot path 44Hz)
 *     → acumulador de fase por nodeId
 *     → PATTERN_FN[pattern](phase + fanOffset, index, total) → {x, y}
 *     → arbiter.setManualOverride(`${fixtureId}:kinetic`, { pan_base, tilt_base })
 *
 * CANALES EMITIDOS:
 * - `pan_base`  / `tilt_base`: lectura del orbit math L2 (WAVE 4661).
 *   Están en MANUAL_HARD_LOCK_EXCLUDED_CHANNELS → no se re-aplican post-L3.
 *   Resultado final: `pan = pan_base + (L0.pan − 0.5)` — flujo correcto.
 *
 * DESFASE FAN:
 * - fanValue [0,1] → desfase de fase total de 2π radianes entre fixture 0 y N-1.
 * - Fixture i recibe: phase + (fanValue * TWO_PI * i / (N - 1))
 *   (si N === 1 el denominador se evita → sin desfase).
 *
 * ESCALA DE AMPLITUD (normalizada → ángulos reales):
 * - amplitude [0,1] → escala el radio del patrón en [-1, 1].
 * - El NodeResolver traduce 0-1 normalizado a DMX 0-255 usando la
 *   TransferCurve del perfil. La amplitud sólo aplica a la excursión
 *   del patrón, no al `pan_base` (punto de anclaje del radar).
 *
 * ESCALA DE VELOCIDAD:
 * - speed [0,1] → frecuencia en Hz = SPEED_MIN + speed × (SPEED_MAX − SPEED_MIN).
 * - Rango: 0.03 Hz (1 ciclo en 33 s) … 1.2 Hz (1 ciclo en ~0.8 s).
 *   Calibrado para rango visual de calidad profesional.
 *
 * PATRONES DISPONIBLES:
 * Subconjunto determinista del Golden Dozen del VMM. Cada uno trabaja
 * en [-1, 1] como el VMM (misma semántica, sin dependencia de instancia VMM).
 *
 * ZERO-ALLOC GARANTIZADO EN HOT PATH:
 * - `_phaseMap`: Map<nodeId, phaseAccumulator> — pre-warm on setManualKinetics.
 * - `_overrideBuffer`: Record<string, number> — objeto fijo reutilizado por nodo.
 *   NOTA: `setManualOverride` en NodeArbiter acepta `Readonly<Record<string,number>>`
 *   y almacena la referencia. Para garantizar zero-alloc usamos un Record por
 *   nodeId en `_overridePool`.
 *
 * @module core/aether/AetherKineticEngine
 * @version WAVE 4700
 */
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;
/** Rango de frecuencia [0,1] → Hz */
const SPEED_MIN_HZ = 0.03; // 1 ciclo cada 33 s (muy lento, ambiental)
const SPEED_MAX_HZ = 1.2; // 1.2 ciclos/s (rápido sin epilepsia)
const PATTERN_FNS = {
    // Círculo puro (Lissajous 1:1 con 90° de offset)
    circle: (p) => ({
        x: Math.sin(p),
        y: Math.cos(p),
    }),
    // Figure-8 clásica (Lissajous 1:2)
    figure8: (p) => ({
        x: Math.sin(p),
        y: Math.sin(p * 2) * 0.75,
    }),
    // Lemniscata horizontal (figure8 rotada 90°)
    lemniscate: (p) => ({
        x: Math.sin(p * 2) * 0.75,
        y: Math.sin(p),
    }),
    // Barrido horizontal con ondulación vertical (searchlight)
    scan_x: (p) => ({
        x: Math.sin(p),
        y: Math.sin(p * 2) * 0.45,
    }),
    // Cuadrado con interpolación lineal entre esquinas
    square: (p) => {
        const corners = [
            { x: 1, y: 1 },
            { x: 1, y: -1 },
            { x: -1, y: -1 },
            { x: -1, y: 1 },
        ];
        const n = (p / TWO_PI) * 4;
        const i = Math.floor(n) % 4;
        const j = (i + 1) % 4;
        const t = n - Math.floor(n);
        return {
            x: corners[i].x + (corners[j].x - corners[i].x) * t,
            y: corners[i].y + (corners[j].y - corners[i].y) * t,
        };
    },
    // Rombo (square rotado 45°)
    diamond: (p) => {
        const verts = [
            { x: 0, y: 1 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: -1, y: 0 },
        ];
        const n = (p / TWO_PI) * 4;
        const i = Math.floor(n) % 4;
        const j = (i + 1) % 4;
        const t = n - Math.floor(n);
        return {
            x: verts[i].x + (verts[j].x - verts[i].x) * t,
            y: verts[i].y + (verts[j].y - verts[i].y) * t,
        };
    },
    // Péndulo latino — ola en U cadenciosa
    wave_y: (p) => ({
        x: Math.sin(p) * 0.8,
        y: -(Math.abs(Math.cos(p * 0.5)) * 0.6),
    }),
    // Caos controlado (Fourier armónicos 1+3+5)
    ballyhoo: (p) => {
        const x = Math.sin(p) * 0.5 + Math.sin(p * 3) * 0.3 + Math.sin(p * 5) * 0.15;
        const y = Math.cos(p) * 0.4 + Math.cos(p * 3) * 0.25 + Math.cos(p * 5) * 0.1;
        return { x: x * 1.8, y: y * 1.8 };
    },
    // Órbita elíptica oscura con pulso de radio
    darkspin: (p) => ({
        x: Math.sin(p) * (0.70 + 0.20 * Math.sin(p * 0.5)),
        y: Math.cos(p * 1.5) * 0.62,
    }),
    // Pendulo suave solo en X
    sway: (p) => ({
        x: Math.sin(p),
        y: 0,
    }),
};
// ─────────────────────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * AetherKineticEngine — Motor cinético nativo L2.
 *
 * Singleton gestionado por TitanOrchestrator.
 * El método tick() se llama en el hot path antes de arbitrate().
 */
export class AetherKineticEngine {
    constructor() {
        /** Acumulador de fase monotónico por nodeId (radianes) */
        this._phaseMap = new Map();
        /**
         * Pool de override records pre-allocated por nodeId.
         * Evita `{}` en el hot path — el NodeArbiter almacena la referencia
         * y la lee en cada arbitrate(), nosotros la mutamos antes de cada tick.
         */
        this._overridePool = new Map();
        /** Configuración activa. null = motor inactivo */
        this._config = null;
        /** WAVE 4706 TELEMETRÍA — contador de frames para heartbeat rate-limited */
        this._heartbeatCounter = 0;
    }
    // ── API pública ──────────────────────────────────────────────────────────
    /**
     * Activa el motor con la configuración dada.
     * Llamado desde AetherIPCHandlers vía `lux:aether:setManualPattern`.
     *
     * @param nodeIds   Array de nodeIds en formato `${fixtureId}:kinetic`
     * @param pattern   Patrón nativo a ejecutar
     * @param speed     [0, 1] — velocidad del patrón
     * @param amplitude [0, 1] — amplitud (excursión del patrón)
     * @param fan       [0, 1] — valor del slider Fan/Dispersión
     */
    setManualKinetics(nodeIds, pattern, speed, amplitude, fan) {
        console.log('[SONDA L2-ENGINE] Registrando patrón manual:', pattern, 'Nodos:', nodeIds.length, 'IDs:', nodeIds);
        if (nodeIds.length === 0) {
            this.stop();
            return;
        }
        // Pre-warm phase map y override pool para los nodeIds nuevos
        for (const nodeId of nodeIds) {
            if (!this._phaseMap.has(nodeId)) {
                this._phaseMap.set(nodeId, 0);
            }
            if (!this._overridePool.has(nodeId)) {
                this._overridePool.set(nodeId, { pan_base: 0.5, tilt_base: 0.5 });
            }
        }
        this._config = {
            nodeIds,
            pattern,
            speed: clamp01(speed),
            amplitude: clamp01(amplitude),
            fan: clampSigned(fan),
        };
    }
    /**
     * Detiene el motor y limpia los overrides L2 del Arbiter.
     * Llamado en Unlock o cuando pattern === null.
     */
    stop(arbiter) {
        if (arbiter && this._config) {
            for (const nodeId of this._config.nodeIds) {
                arbiter.clearMotorKineticOverride(nodeId);
            }
        }
        this._config = null;
        // Resetear fases para el próximo arranque (evita phase glitch en re-trigger)
        this._phaseMap.clear();
    }
    /**
     * Actualiza velocidad y amplitud sin reiniciar la fase.
     * Para cambios en tiempo real de los sliders de UI.
     */
    updateScalars(speed, amplitude, fan) {
        if (!this._config)
            return;
        this._config.speed = clamp01(speed);
        this._config.amplitude = clamp01(amplitude);
        this._config.fan = clampSigned(fan);
    }
    /** ¿Hay un patrón activo? */
    isActive() {
        return this._config !== null;
    }
    /**
     * WAVE L2-SUPREMACY: ¿Este nodeId está bajo control manual L2?
     * Usado por KineticAdapter para silenciar el emit L0 por nodo.
     * Zero-alloc: solo lectura de config.nodeIds (Array.includes O(n) pero n pequeño).
     */
    hasNode(nodeId) {
        return this._config !== null && this._config.nodeIds.includes(nodeId);
    }
    /** Snapshot serializable del estado manual actual del motor. */
    getState() {
        const cfg = this._config;
        if (!cfg) {
            return {
                active: false,
                nodeIds: [],
                pattern: null,
                speed: 0,
                amplitude: 0,
                fan: 0,
            };
        }
        return {
            active: true,
            nodeIds: [...cfg.nodeIds],
            pattern: cfg.pattern,
            speed: cfg.speed,
            amplitude: cfg.amplitude,
            fan: cfg.fan,
        };
    }
    /**
     * HOT PATH — 44Hz.
     *
     * Calcula la nueva posición de cada fixture y la escribe en NodeArbiter L2.
     *
     * WAVE 4718 — ANCHOR DINÁMICO:
     * Antes de calcular la oscilación, el motor lee el override L2 actual del
     * nodeId (escrito por KineticsBridge._flushClassic como `pan_base`/`tilt_base`)
     * y lo usa como punto de anclaje del patrón. Si el operador no ha movido el
     * radar (o aún no hay override L2), el fallback es 0.5 (centro del universo).
     *
     * Esto garantiza:
     *   pan_base_final = radar_anchor_pan + scaledX * 0.5
     * donde scaledX ∈ [-amplitude, amplitude].
     *
     * @param dtSeconds Segundos transcurridos desde el último tick.
     * @param arbiter   Referencia al NodeArbiter activo.
     */
    tick(dtSeconds, arbiter) {
        const cfg = this._config;
        if (!cfg)
            return;
        const patternFn = PATTERN_FNS[cfg.pattern];
        if (!patternFn)
            return;
        const total = cfg.nodeIds.length;
        const freqHz = SPEED_MIN_HZ + cfg.speed * (SPEED_MAX_HZ - SPEED_MIN_HZ);
        const dPhase = freqHz * TWO_PI * dtSeconds;
        const amplitude = cfg.amplitude;
        // Fan: desfase total de 2π cuando fan === 1 (spread máximo entre fixture[0] y fixture[N-1])
        const fanRange = cfg.fan * TWO_PI;
        for (let i = 0; i < total; i++) {
            const nodeId = cfg.nodeIds[i];
            // Acumular fase (monotonic, wrap en 2π para evitar pérdida de precisión flotante)
            const prevPhase = this._phaseMap.get(nodeId) ?? 0;
            const phase = (prevPhase + dPhase) % TWO_PI;
            this._phaseMap.set(nodeId, phase);
            // Desfase de fan por índice — determinista, cero alloc
            const fanOffset = total > 1 ? (fanRange * i) / (total - 1) : 0;
            const { x, y } = patternFn(phase + fanOffset);
            // Escalar amplitud: x/y ∈ [-1, 1] → [-amplitude, amplitude]
            const scaledX = x * amplitude;
            const scaledY = y * amplitude;
            // WAVE 4718 — ANCHOR DEL RADAR:
            // Leer el override L2 actual (escrito por KineticsBridge._flushClassic).
            // Si el operador posicionó el radar, pan_base/tilt_base tienen su valor.
            // Si no hay override todavía, usar 0.5 (centro).
            const l2 = arbiter.getManualOverride(nodeId);
            const anchorPan = (l2 && Number.isFinite(l2['pan_base'])) ? l2['pan_base'] : 0.5;
            const anchorTilt = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5;
            // Convertir a normalizado [0,1] usando el anchor real del radar
            const panBase = clamp01(anchorPan + scaledX * 0.5);
            const tiltBase = clamp01(anchorTilt + scaledY * 0.5);
            // Escribir en el pool reutilizable (cero alloc en hot path)
            let rec = this._overridePool.get(nodeId);
            if (!rec) {
                rec = { pan_base: panBase, tilt_base: tiltBase };
                this._overridePool.set(nodeId, rec);
            }
            else {
                rec['pan_base'] = panBase;
                rec['tilt_base'] = tiltBase;
            }
            arbiter.setMotorKineticOverride(nodeId, rec);
        }
        // WAVE 4706 TELEMETRÍA — heartbeat rate-limited (1 log/seg @ 44Hz)
        this._heartbeatCounter++;
        if (this._heartbeatCounter >= 44) {
            this._heartbeatCounter = 0;
            const firstNodeId = cfg.nodeIds[0];
            const sampleRec = firstNodeId ? this._overridePool.get(firstNodeId) : null;
            console.log(`[KineticEngine L2] Nodos activos: ${total}` +
                ` | Pattern: ${cfg.pattern}` +
                ` | Speed: ${cfg.speed.toFixed(3)}` +
                ` | Amplitude: ${cfg.amplitude.toFixed(3)}` +
                ` | Fan: ${cfg.fan.toFixed(3)}` +
                ` | Output muestra[${firstNodeId}]: ` +
                (sampleRec
                    ? `{pan: ${sampleRec['pan_base'].toFixed(3)}, tilt: ${sampleRec['tilt_base'].toFixed(3)}}`
                    : 'null'));
        }
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clampSigned(v) {
    if (v <= -1)
        return -1;
    if (v >= 1)
        return 1;
    return v;
}
// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────
/** Instancia singleton compartida por TitanOrchestrator y AetherIPCHandlers */
export const aetherKineticEngine = new AetherKineticEngine();
