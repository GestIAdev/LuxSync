/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ WAVE 1000: HARDWARE SAFETY LAYER - EL BÚNKER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Protege la maquinaria de las demandas imposibles de la IA.
 *
 * PROBLEMA QUE RESUELVE:
 * Selene sueña un efecto estroboscópico multicolor a 20Hz.
 * El Beam 2R tiene rueda mecánica que tarda 500ms en cambiar.
 * Si intentamos seguir a Selene, el motor se quema.
 *
 * SOLUCIÓN:
 * 1. DEBOUNCE: Ignorar cambios más rápidos que el límite del hardware
 * 2. LATCH: En efectos caóticos, elegir un color y mantenerlo
 * 3. SHUTTER DELEGATION: Si no puedes cambiar de color, strobeaen blanco
 *
 * FILOSOFÍA:
 * "Es mejor un show imperfecto que un fixture roto"
 *
 * @module hal/translation/HardwareSafetyLayer
 * @version WAVE 1000
 */
import { isMechanicalFixture, } from './FixtureProfiles';
const DEFAULT_CONFIG = {
    debug: false,
    safetyMargin: 1.2, // 20% margen de seguridad extra
    chaosThreshold: 3, // 3 cambios/segundo = caos
    latchDurationMs: 2000, // 2 segundos de latch
};
// ═══════════════════════════════════════════════════════════════════════════
// HARDWARE SAFETY LAYER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class HardwareSafetyLayer {
    constructor(config = {}) {
        // Estado por fixture
        this.fixtureStates = new Map();
        // Métricas globales
        this.totalBlockedChanges = 0;
        this.totalLatchActivations = 0;
        this.totalStrobeDelegations = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        console.log('[SafetyLayer] 🛡️ WAVE 1000: Hardware Safety Layer initialized');
        console.log(`[SafetyLayer]    Safety margin: ${this.config.safetyMargin}x`);
        console.log(`[SafetyLayer]    Chaos threshold: ${this.config.chaosThreshold} changes/sec`);
        console.log(`[SafetyLayer]    Latch duration: ${this.config.latchDurationMs}ms`);
    }
    /**
     * 🎯 MÉTODO PRINCIPAL: Filtra un cambio de color a través del búnker de seguridad
     *
     * @param fixtureId - ID único del fixture
     * @param requestedColorDmx - Color DMX que quiere Selene
     * @param profile - Perfil del fixture
     * @param currentDimmer - Dimmer actual (para detectar strobe patterns)
     * @returns Resultado filtrado
     */
    filter(fixtureId, requestedColorDmx, profile, currentDimmer = 255) {
        const now = Date.now();
        // ═══════════════════════════════════════════════════════════════════
        // CASO 1: Sin perfil o es fixture digital → Pass-through (sin restricciones)
        // ═══════════════════════════════════════════════════════════════════
        if (!profile || !isMechanicalFixture(profile)) {
            return {
                finalColorDmx: requestedColorDmx,
                wasBlocked: false,
                isInLatch: false,
                suggestedShutter: 255,
                delegateToStrobe: false,
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CASO 2: Fixture mecánico → Aplicar protección
        // ═══════════════════════════════════════════════════════════════════
        // Obtener o crear estado del fixture
        let state = this.fixtureStates.get(fixtureId);
        if (!state) {
            state = this.createInitialState(fixtureId, requestedColorDmx);
            this.fixtureStates.set(fixtureId, state);
        }
        // Actualizar historial de cambios
        this.updateChangeHistory(state, requestedColorDmx, now);
        // ═══════════════════════════════════════════════════════════════════
        // CHECK 1: ¿Estamos en modo LATCH?
        // ═══════════════════════════════════════════════════════════════════
        if (state.isLatched) {
            const latchElapsed = now - state.latchStartTime;
            if (latchElapsed < this.config.latchDurationMs) {
                // Aún en latch → mantener color bloqueado
                state.blockedChanges++;
                this.totalBlockedChanges++;
                if (this.config.debug && state.blockedChanges % 10 === 0) {
                    console.log(`[SafetyLayer] 🔒 LATCH: ${fixtureId} blocked (${Math.round(latchElapsed)}ms/${this.config.latchDurationMs}ms)`);
                }
                return {
                    finalColorDmx: state.latchedColorDmx,
                    wasBlocked: true,
                    isInLatch: true,
                    blockReason: `LATCH active (${Math.round(latchElapsed)}ms remaining)`,
                    suggestedShutter: this.calculateStrobeShutter(state, currentDimmer),
                    delegateToStrobe: this.shouldDelegateToStrobe(state),
                };
            }
            else {
                // Latch expirado → liberar
                state.isLatched = false;
                if (this.config.debug) {
                    console.log(`[SafetyLayer] 🔓 LATCH released: ${fixtureId}`);
                }
            }
        }
        // ═══════════════════════════════════════════════════════════════════
        // CHECK 2: ¿Detectamos patrón de CAOS?
        // ═══════════════════════════════════════════════════════════════════
        const changesPerSecond = this.calculateChangesPerSecond(state, now);
        if (changesPerSecond > this.config.chaosThreshold) {
            // ¡CAOS DETECTADO! Activar LATCH
            state.isLatched = true;
            state.latchedColorDmx = state.lastColorDmx; // Mantener el último color bueno
            state.latchStartTime = now;
            this.totalLatchActivations++;
            if (this.config.debug) {
                console.log(`[SafetyLayer] ⚠️ CHAOS DETECTED: ${fixtureId} (${changesPerSecond.toFixed(1)} changes/sec)`);
                console.log(`[SafetyLayer] 🔒 LATCH activated: holding color DMX ${state.latchedColorDmx}`);
            }
            return {
                finalColorDmx: state.latchedColorDmx,
                wasBlocked: true,
                isInLatch: true,
                blockReason: `CHAOS (${changesPerSecond.toFixed(1)} changes/sec > ${this.config.chaosThreshold})`,
                suggestedShutter: this.calculateStrobeShutter(state, currentDimmer),
                delegateToStrobe: true, // En caos, delegamos a strobe
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CHECK 3: ¿Ha pasado suficiente tiempo desde el último cambio?
        // ═══════════════════════════════════════════════════════════════════
        const minChangeTime = this.getMinChangeTime(profile);
        const timeSinceLastChange = now - state.lastColorChangeTime;
        if (requestedColorDmx !== state.lastColorDmx && timeSinceLastChange < minChangeTime) {
            // Cambio demasiado rápido → BLOQUEAR
            state.blockedChanges++;
            this.totalBlockedChanges++;
            if (this.config.debug && state.blockedChanges % 30 === 0) {
                console.log(`[SafetyLayer] 🚫 DEBOUNCE: ${fixtureId} (${timeSinceLastChange}ms < ${minChangeTime}ms)`);
            }
            return {
                finalColorDmx: state.lastColorDmx, // Mantener color anterior
                wasBlocked: true,
                isInLatch: false,
                blockReason: `DEBOUNCE (${timeSinceLastChange}ms < ${minChangeTime}ms)`,
                suggestedShutter: 255,
                delegateToStrobe: false,
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CASO SEGURO: Permitir el cambio
        // ═══════════════════════════════════════════════════════════════════
        if (requestedColorDmx !== state.lastColorDmx) {
            state.lastColorDmx = requestedColorDmx;
            state.lastColorChangeTime = now;
            if (this.config.debug) {
                console.log(`[SafetyLayer] ✅ ALLOWED: ${fixtureId} → color DMX ${requestedColorDmx}`);
            }
        }
        state.lastDimmer = currentDimmer;
        return {
            finalColorDmx: requestedColorDmx,
            wasBlocked: false,
            isInLatch: false,
            suggestedShutter: 255,
            delegateToStrobe: false,
        };
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════════
    createInitialState(fixtureId, initialColor) {
        return {
            fixtureId,
            lastColorDmx: initialColor,
            lastColorChangeTime: Date.now(),
            isLatched: false,
            latchedColorDmx: 0,
            latchStartTime: 0,
            blockedChanges: 0,
            lastDimmer: 255,
            recentChanges: [],
        };
    }
    getMinChangeTime(profile) {
        const baseTime = profile.colorEngine.colorWheel?.minChangeTimeMs ?? 500;
        return Math.round(baseTime * this.config.safetyMargin);
    }
    updateChangeHistory(state, newColor, now) {
        // Si el color cambió, registrar el timestamp
        if (newColor !== state.lastColorDmx) {
            state.recentChanges.push(now);
        }
        // Limpiar cambios viejos (más de 2 segundos)
        const cutoff = now - 2000;
        state.recentChanges = state.recentChanges.filter(t => t > cutoff);
    }
    calculateChangesPerSecond(state, now) {
        // Contar cambios en el último segundo
        const oneSecondAgo = now - 1000;
        const recentCount = state.recentChanges.filter(t => t > oneSecondAgo).length;
        return recentCount;
    }
    shouldDelegateToStrobe(state) {
        // Delegar a strobe si hay muchos cambios bloqueados
        return state.blockedChanges > 10;
    }
    calculateStrobeShutter(state, currentDimmer) {
        // Si estamos en modo strobe delegation, calcular velocidad de strobe
        // basado en la intensidad de la demanda
        if (!this.shouldDelegateToStrobe(state)) {
            return 255; // Shutter abierto
        }
        // Mapear cambios bloqueados a velocidad de strobe
        // Más cambios = strobe más rápido
        const intensity = Math.min(state.blockedChanges / 30, 1); // 0-1
        // Strobe típico: 128 = medio, 200 = rápido, 255 = muy rápido
        return Math.round(128 + intensity * 127);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Resetea el estado de un fixture específico
     */
    resetFixture(fixtureId) {
        this.fixtureStates.delete(fixtureId);
        if (this.config.debug) {
            console.log(`[SafetyLayer] 🔄 Reset: ${fixtureId}`);
        }
    }
    /**
     * Resetea todos los estados
     */
    resetAll() {
        this.fixtureStates.clear();
        console.log('[SafetyLayer] 🔄 All fixtures reset');
    }
    /**
     * Obtiene métricas de seguridad
     */
    getMetrics() {
        let fixturesInLatch = 0;
        this.fixtureStates.forEach(state => {
            if (state.isLatched)
                fixturesInLatch++;
        });
        return {
            totalBlockedChanges: this.totalBlockedChanges,
            totalLatchActivations: this.totalLatchActivations,
            totalStrobeDelegations: this.totalStrobeDelegations,
            activeFixtures: this.fixtureStates.size,
            fixturesInLatch,
        };
    }
    /**
     * Imprime un reporte de métricas
     */
    printMetrics() {
        const m = this.getMetrics();
        console.log('[SafetyLayer] 📊 METRICS:');
        console.log(`  Blocked changes: ${m.totalBlockedChanges}`);
        console.log(`  Latch activations: ${m.totalLatchActivations}`);
        console.log(`  Strobe delegations: ${m.totalStrobeDelegations}`);
        console.log(`  Active fixtures: ${m.activeFixtures}`);
        console.log(`  Fixtures in latch: ${m.fixturesInLatch}`);
    }
    /**
     * Actualiza la configuración
     */
    setConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('[SafetyLayer] ⚙️ Config updated');
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
