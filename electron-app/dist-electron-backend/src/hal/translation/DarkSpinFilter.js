/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌑 WAVE 2690: DARK-SPIN FILTER - LA LEY FÍSICA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMA QUE RESUELVE:
 * Los fixtures mecánicos (Beam 2R, etc.) tienen una rueda de colores física.
 * Cuando el DMX ordena un cambio de slot, la rueda gira — y durante ~500ms
 * el cristal intermedio queda visible. Bajo ninguna circunstancia el público
 * debe ver el cristal intermedio.
 *
 * SOLUCIÓN:
 * Dark-Spin es una LEY FÍSICA GLOBAL que aplica a TODO el sistema:
 * Si se detecta un cambio de valor DMX en el canal colorWheel de un
 * fixture mecánico, se inyecta un REPLACE silencioso de dimmer=0 (Blackout)
 * para ese fixture. El blackout se mantiene durante el tiempo de tránsito
 * (minChangeTimeMs). Terminado el tránsito, se libera el dimmer.
 *
 * RELACIÓN CON HardwareSafetyLayer:
 * El SafetyLayer decide SI el cambio se permite (debounce, latch, caos).
 * El DarkSpinFilter asume que el cambio YA fue aprobado y enmascara el
 * tránsito mecánico con un blackout temporal.
 *
 * RELACIÓN CON HarmonicQuantizer:
 * El Quantizer cuantiza los cambios a subdivisiones musicales.
 * El DarkSpinFilter opera DESPUÉS: cuando un cambio cuantizado y aprobado
 * realmente ocurre, enmascara el tránsito.
 *
 * @module hal/translation/DarkSpinFilter
 * @version WAVE 2690
 */
// ═══════════════════════════════════════════════════════════════════════════
// DARK-SPIN FILTER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class DarkSpinFilter {
    constructor(safetyMargin = 1.1) {
        /** Estado por fixture */
        this.fixtureStates = new Map();
        this.safetyMargin = safetyMargin;
    }
    /**
     * 🌑 MÉTODO PRINCIPAL: Evalúa si un fixture necesita blackout de tránsito
     *
     * Se llama DESPUÉS del SafetyLayer, con el colorWheelDmx aprobado.
     * Si detecta que el color cambió, activa un blackout temporal.
     *
     * @param fixtureId - ID único del fixture
     * @param currentColorDmx - Color wheel DMX que el SafetyLayer aprobó
     * @param profile - Perfil del fixture (para obtener minChangeTimeMs)
     * @param requestedDimmer - Dimmer que el sistema quiere aplicar
     * @returns Resultado con el dimmer filtrado
     */
    filter(fixtureId, currentColorDmx, profile, requestedDimmer) {
        const now = Date.now();
        // Obtener o crear estado
        let state = this.fixtureStates.get(fixtureId);
        if (!state) {
            state = {
                lastStableColorDmx: currentColorDmx,
                pendingColorDmx: currentColorDmx,
                inTransit: false,
                transitStartTime: 0,
                transitDurationMs: 0,
            };
            this.fixtureStates.set(fixtureId, state);
            // Primer frame — no hay tránsito
            return { dimmer: requestedDimmer, inTransit: false, transitRemainingMs: 0 };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CHECK 1: ¿Estamos en tránsito activo?
        // ═══════════════════════════════════════════════════════════════════
        if (state.inTransit) {
            const elapsed = now - state.transitStartTime;
            const remaining = state.transitDurationMs - elapsed;
            // 🔧 WAVE 2691 FAIL-SAFE: Si el tránsito lleva más de minChangeTimeMs * 2,
            // forzar reset para evitar deadlock infinito (p.ej. si el clock se congela
            // o si algún bug externo impide que elapsed supere transitDurationMs).
            const failSafeLimit = state.transitDurationMs * 2;
            if (elapsed >= failSafeLimit) {
                console.warn(`[DarkSpin 🔴 FAIL-SAFE] ${fixtureId}: Tránsito atascado ${elapsed}ms (límite ${failSafeLimit}ms). Forzando reset.`);
                state.inTransit = false;
                state.lastStableColorDmx = state.pendingColorDmx;
                // ← caemos al CHECK 2 para evaluar si hay un nuevo cambio
            }
            else if (remaining > 0) {
                // Tránsito en progreso → BLACKOUT
                // El colorWheel (pendingColorDmx) YA fue enviado al hardware en el frame de inicio.
                // Forzamos dimmer=0 para enmascarar el cristal intermedio.
                return { dimmer: 0, inTransit: true, transitRemainingMs: remaining };
            }
            else {
                // Tránsito terminado normalmente → liberar
                state.inTransit = false;
                state.lastStableColorDmx = state.pendingColorDmx;
            }
        }
        // ═══════════════════════════════════════════════════════════════════
        // CHECK 2: ¿Hay un nuevo cambio de color?
        // ═══════════════════════════════════════════════════════════════════
        if (currentColorDmx !== state.lastStableColorDmx) {
            // ¡CAMBIO DETECTADO! Activar blackout de tránsito.
            // CRITICAL: Solo se activa UNA VEZ — guardamos pendingColorDmx para que
            // los frames subsiguientes (con el mismo currentColorDmx) no re-disparen
            // el tránsito. El flag inTransit se evalúa en CHECK 1 arriba.
            const minChangeTime = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500;
            const transitDuration = Math.round(minChangeTime * this.safetyMargin);
            state.inTransit = true;
            state.transitStartTime = now;
            state.transitDurationMs = transitDuration;
            state.pendingColorDmx = currentColorDmx; // El nuevo color en vuelo
            console.log(`[DarkSpin 🌑] ${fixtureId}: Color transit DMX ${state.lastStableColorDmx}→${currentColorDmx} — Blackout ${transitDuration}ms`);
            // El color estable se actualiza cuando el tránsito TERMINA (arriba en CHECK 1).
            // pendingColorDmx == currentColorDmx, así que los frames siguientes entran
            // directamente por CHECK 1 (inTransit=true) sin re-disparar CHECK 2.
            return { dimmer: 0, inTransit: true, transitRemainingMs: transitDuration };
        }
        // ═══════════════════════════════════════════════════════════════════
        // SIN CAMBIO: Pass-through
        // ═══════════════════════════════════════════════════════════════════
        return { dimmer: requestedDimmer, inTransit: false, transitRemainingMs: 0 };
    }
    /**
     * Resetea el estado de un fixture
     */
    resetFixture(fixtureId) {
        this.fixtureStates.delete(fixtureId);
    }
    /**
     * Resetea todos los estados
     */
    resetAll() {
        this.fixtureStates.clear();
    }
    /**
     * Métricas de diagnóstico
     */
    getMetrics() {
        let inTransit = 0;
        for (const state of this.fixtureStates.values()) {
            if (state.inTransit)
                inTransit++;
        }
        return { activeFixtures: this.fixtureStates.size, fixturesInTransit: inTransit };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
export function getDarkSpinFilter() {
    if (!instance) {
        instance = new DarkSpinFilter();
    }
    return instance;
}
