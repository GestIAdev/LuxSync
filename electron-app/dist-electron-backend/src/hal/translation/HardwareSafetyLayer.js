/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 1000 → WAVE 2711: HARDWARE SAFETY LAYER — PASSIVE DEBOUNCE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Protege la rueda mecánica de color de cambios más rápidos que su motor.
 *
 * 🔧 WAVE 2711: DESMANTELAMIENTO DEL BÚNKER
 *
 * ANTES (WAVE 1000):
 *   - CHECK 1: Chaos Latch → congelaba el color en lastColorDmx durante 2s
 *   - CHECK 2: Chaos detection → >3 cambios/sec disparaba latch
 *   - CHECK 3: Debounce → bloqueaba cambios más rápidos que minChangeTimeMs
 *   - Strobe delegation → inyectaba strobe shutter en el fixture
 *
 * PROBLEMA:
 *   - Chaos latch congelaba en DMX 0 = White/Open en Beam 2R
 *   - Strobe delegation hacía flash blanco involuntario
 *   - DarkSpinFilter (WAVE 2690) ya maneja blackout durante tránsito de rueda
 *   - HarmonicQuantizer (WAVE 2672) ya gate colores al BPM
 *   → El búnker era REDUNDANTE y DAÑINO
 *
 * AHORA:
 *   - SOLO debounce pasivo (minChangeTimeMs del perfil)
 *   - SIN chaos latch, SIN strobe delegation
 *   - delegateToStrobe = SIEMPRE false
 *   - suggestedShutter = SIEMPRE 255 (shutter open)
 *
 * @module hal/translation/HardwareSafetyLayer
 * @version WAVE 2711
 */
import { isMechanicalFixture, } from './FixtureProfiles';
const DEFAULT_CONFIG = {
    debug: false,
    safetyMargin: 1.2, // 20% margen de seguridad extra
    chaosThreshold: 3, // WAVE 2711: legacy, unused
    latchDurationMs: 2000, // WAVE 2711: legacy, unused
};
// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE SAFETY LAYER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class HardwareSafetyLayer {
    constructor(config = {}) {
        this.fixtureStates = new Map();
        this.totalBlockedChanges = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * 🎯 MÉTODO PRINCIPAL: Filtra un cambio de color — solo debounce pasivo
     *
     * WAVE 2711: Chaos latch y strobe delegation ELIMINADOS.
     * DarkSpinFilter (WAVE 2690) y HarmonicQuantizer (WAVE 2672) manejan
     * la protección inteligente. Este layer solo protege el motor físico.
     *
     * @param fixtureId - ID único del fixture
     * @param requestedColorDmx - Color DMX que quiere Selene
     * @param profile - Perfil del fixture
     * @param currentDimmer - Dimmer actual (preserved for API compat)
     * @returns Resultado filtrado
     */
    filter(fixtureId, requestedColorDmx, profile, currentDimmer = 255) {
        const now = Date.now();
        // ═══════════════════════════════════════════════════════════════════
        // CASO 1: Sin perfil o es fixture digital → Pass-through
        // ═══════════════════════════════════════════════════════════════════
        if (!profile || !isMechanicalFixture(profile)) {
            return {
                finalColorDmx: requestedColorDmx,
                wasBlocked: false,
                isDebounced: false,
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CASO 2: Fixture mecánico → Debounce pasivo solamente
        // ═══════════════════════════════════════════════════════════════════
        let state = this.fixtureStates.get(fixtureId);
        if (!state) {
            state = {
                fixtureId,
                lastColorDmx: requestedColorDmx,
                lastColorChangeTime: now,
                blockedChanges: 0,
            };
            this.fixtureStates.set(fixtureId, state);
        }
        // ═══════════════════════════════════════════════════════════════════
        // DEBOUNCE: ¿Ha pasado suficiente tiempo desde el último cambio?
        // Si el color no cambió, pass-through inmediato.
        // ═══════════════════════════════════════════════════════════════════
        if (requestedColorDmx !== state.lastColorDmx) {
            const minChangeTime = this.getMinChangeTime(profile);
            const timeSinceLastChange = now - state.lastColorChangeTime;
            if (timeSinceLastChange < minChangeTime) {
                // Cambio demasiado rápido para el motor → BLOQUEAR
                state.blockedChanges++;
                this.totalBlockedChanges++;
                if (this.config.debug && state.blockedChanges % 30 === 0) {
                    console.log(`[SafetyLayer] 🚫 DEBOUNCE: ${fixtureId} (${timeSinceLastChange}ms < ${minChangeTime}ms)`);
                }
                return {
                    finalColorDmx: state.lastColorDmx,
                    wasBlocked: true,
                    isDebounced: true,
                    blockReason: `DEBOUNCE (${timeSinceLastChange}ms < ${minChangeTime}ms)`,
                };
            }
            // Cambio permitido — actualizar estado
            state.lastColorDmx = requestedColorDmx;
            state.lastColorChangeTime = now;
            state.blockedChanges = 0;
            if (this.config.debug) {
                console.log(`[SafetyLayer] ✅ ALLOWED: ${fixtureId} → color DMX ${requestedColorDmx}`);
            }
        }
        return {
            finalColorDmx: requestedColorDmx,
            wasBlocked: false,
            isDebounced: false,
        };
    }
    /**
     * 🔧 WAVE 2711: getLastColor — devuelve el último color aplicado
     * para que HarmonicQuantizer sepa qué valor holdear cuando el gate está cerrado.
     */
    getLastColor(fixtureId) {
        return this.fixtureStates.get(fixtureId)?.lastColorDmx;
    }
    /**
     * Resetea el estado de un fixture específico
     */
    resetFixture(fixtureId) {
        this.fixtureStates.delete(fixtureId);
    }
    resetAll() {
        this.fixtureStates.clear();
    }
    /**
     * Obtiene métricas de seguridad
     * WAVE 2711: solo debounce, sin latch/strobe
     */
    getMetrics() {
        return {
            totalBlockedChanges: this.totalBlockedChanges,
            activeFixtures: this.fixtureStates.size,
        };
    }
    /**
     * Imprime un reporte de métricas
     */
    printMetrics() {
        const m = this.getMetrics();
        console.log('[SafetyLayer] 📊 METRICS:');
        console.log(`  Blocked changes (debounce): ${m.totalBlockedChanges}`);
        console.log(`  Active fixtures: ${m.activeFixtures}`);
    }
    /**
     * Actualiza la configuración
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }
    getMinChangeTime(profile) {
        const baseTime = profile.colorEngine?.colorWheel?.minChangeTimeMs ?? 500;
        return Math.round(baseTime * this.config.safetyMargin);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
export function getHardwareSafetyLayer() {
    if (!instance) {
        instance = new HardwareSafetyLayer();
    }
    return instance;
}
