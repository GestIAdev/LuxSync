/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ AETHER VIRTUAL STROBE ENGINE — WYSIWYG Shutter Simulator (WAVE 4855)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RESPONSABILIDAD:
 * Simular físicamente el comportamiento de un obturador mecánico/electrónico
 * de fixture profesional para que la UI 2D/3D refleje exactamente lo que
 * verá el operador en hardware (paradigma WYSIWYG, igual que MA3D, Capture,
 * Depence).
 *
 * FILOSOFÍA:
 * El campo arbitrado `strobeRate ∈ [0,1]` es una intención semántica — la
 * tasa de parpadeo deseada. La UI lee estado puro y por sí sola NUNCA
 * dibujaría un flash: necesita un oscilador con memoria de fase que
 * interrumpa el flujo lumínico a la frecuencia indicada. Este motor es
 * ese oscilador.
 *
 * ARQUITECTURA:
 *   1. Mapeo semántico → físico
 *        strobeRate (0 .. 1)  →  frequencyHz (STROBE_MIN_HZ .. STROBE_MAX_HZ)
 *        Dead-zone alrededor de 0 evita ruido y micro-flashes parasitarios.
 *
 *   2. Acumulador de fase per-fixture (continuidad temporal)
 *        phase[fixtureId] = (phase[fixtureId] + hz * dtSeconds) % 1
 *        Sin saltos al cambiar de tasa: la fase se preserva entre frames.
 *
 *   3. Oscilador onda-cuadrada
 *        mask = phase < DUTY_CYCLE ? 1.0 : 0.0
 *        Binario puro (no anti-aliasing) — refleja la naturaleza ON/OFF
 *        del shutter físico. La UI a 44 Hz puede aliasear visualmente con
 *        frecuencias > 22 Hz, igual que cualquier strobe real bajo cámara.
 *
 *   4. Shutter como gate absoluto
 *        Si shutter ≤ 0  ⇒  mask = 0  (obturador cerrado, sin importar rate).
 *
 * GARANTÍAS:
 *   - Zero-alloc en hot path (un único Map<string,number> reutilizado).
 *   - Determinismo dado fixtureId + secuencia de (rate, shutter, dt).
 *   - Independencia de Date.now(): consume el deltaMs del FrameScheduler.
 *
 * NO-HACK CLAUSE:
 *   No hay smart-fallbacks, ni LUTs aproximadas, ni decay artificial.
 *   El motor es la física estricta de un shutter ideal.
 *
 * @module core/aether/resolver/AetherVirtualStrobeEngine
 * @version WAVE 4855 — Perfection First
 */
// ── Constantes físicas del shutter virtual ────────────────────────────────
/**
 * Frecuencia mínima cuando strobeRate sale de la dead-zone.
 * 1 Hz = un parpadeo lento, claramente percibible (no decorativo).
 */
const STROBE_MIN_HZ = 1.0;
/**
 * Frecuencia máxima a strobeRate = 1.0.
 * 18 Hz es el techo de renderizado físico de fixture (operation bureaucracy).
 * Alineado con SAFE_MAX_STROBE_HZ en ChronosIPCBridge.ts y el schema [1, 18].
 * Por encima de Nyquist del refresh visual (22 Hz @ 44 fps) se produce
 * aliasing intencional — fiel al comportamiento de cámaras/UI reales.
 */
const STROBE_MAX_HZ = 18.0;
/**
 * Dead-zone: rates por debajo de este umbral se consideran "sin strobe"
 * y devuelven máscara = 1.0 (luz constante). Evita microflashes por ruido
 * de cuantización en el path arbitrado.
 */
const STROBE_DEADZONE = 0.02;
/**
 * Duty cycle del oscilador onda-cuadrada (0..1).
 * 0.5 = 50/50 ON/OFF — perfil de shutter mecánico estándar.
 */
const STROBE_DUTY_CYCLE = 0.5;
/**
 * Cap defensivo del avance de fase en un solo frame.
 * A 60 Hz nominales (~16 ms) con 25 Hz máx → 0.4 ciclos/frame.
 * Si dt explota (stall del worker), evitamos saltos de fase enormes.
 */
const MAX_PHASE_STEP = 0.5;
/**
 * Motor virtual de strobo: traduce intención semántica a máscara binaria.
 *
 * Una instancia es compartida por todos los fixtures de la escena. El
 * estado interno es exclusivamente el acumulador de fase per-fixture.
 */
export class AetherVirtualStrobeEngine {
    constructor() {
        /** fixtureId → fase actual ∈ [0, 1). */
        this._phase = new Map();
    }
    /**
     * Calcula la máscara binaria de visibilidad para un fixture en este frame.
     *
     * @param fixtureId   - Identificador estable (DeviceId) del fixture.
     * @param strobeRate  - Tasa normalizada [0..1] desde el nodo IMPACT arbitrado.
     * @param shutter     - Estado del obturador [0..1] (1 = abierto). 0 ⇒ off duro.
     * @param dtMs        - Delta del frame en ms (FrameScheduler, monotónico).
     * @returns           - 1.0 (visible) o 0.0 (apagado). Binario estricto.
     */
    computeMask(fixtureId, strobeRate, shutter, dtMs) {
        // 1) Obturador cerrado → todo apagado, sin avanzar fase (queda congelada).
        if (shutter <= 0) {
            return 0;
        }
        // 2) Sin strobo: salir de dead-zone preserva fase para continuidad si se
        //    reactiva en el siguiente frame sin glitch visual.
        if (!(strobeRate > STROBE_DEADZONE)) {
            return 1.0;
        }
        // 3) Mapeo lineal rate → frecuencia. Clamp defensivo a [0,1].
        const clampedRate = strobeRate > 1 ? 1 : strobeRate;
        const hz = STROBE_MIN_HZ + clampedRate * (STROBE_MAX_HZ - STROBE_MIN_HZ);
        // 4) Avance de fase. dtMs negativo (clock skew) → no avanza.
        const safeDtMs = dtMs > 0 ? dtMs : 0;
        let step = hz * (safeDtMs / 1000);
        if (step > MAX_PHASE_STEP)
            step = MAX_PHASE_STEP;
        const prev = this._phase.get(fixtureId) ?? 0;
        let phase = prev + step;
        // Wrap manual zero-alloc (evita Math.floor cuando step << 1).
        while (phase >= 1)
            phase -= 1;
        this._phase.set(fixtureId, phase);
        // 5) Onda cuadrada binaria estricta.
        return phase < STROBE_DUTY_CYCLE ? 1.0 : 0.0;
    }
    /**
     * Olvida el estado de fase de un fixture (al despatchearlo de la escena).
     * Evita fugas si el set de fixtures cambia dinámicamente.
     */
    forget(fixtureId) {
        this._phase.delete(fixtureId);
    }
    /**
     * Resetea todas las fases. Útil en blackout duro, cambio de escena
     * o transiciones donde se desea sincronizar el strobo de toda la escena.
     */
    reset() {
        this._phase.clear();
    }
    /** Diagnóstico: número de fixtures con fase activa. */
    get trackedCount() {
        return this._phase.size;
    }
}
