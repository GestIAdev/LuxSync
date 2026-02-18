/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 STAGE_WASH - LAVADO DE ESCENARIO CÁLIDO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1020.9: ROCK ARSENAL EXPANSION - "Short & Safe"
 *
 * CONCEPTO:
 * Un wash suave y cálido que ilumina todo el escenario.
 * Momento de "respiración" entre partes intensas.
 *
 * COMPORTAMIENTO:
 * - Duración: 3.5 segundos
 * - NO movimiento de movers (estaticos)
 * - Color: Amber/Warm estable (seguro para rueda)
 * - Fade in/out suave
 * - Todos los fixtures iluminan juntos
 *
 * AUDIO KEY:
 * - Se alimenta del balance general
 * - Funciona bien en transiciones suaves
 *
 * FILOSOFÍA:
 * El "respiro cálido" del rock. Simple, efectivo, seguro.
 *
 * @module core/effects/library/poprock/StageWash
 * @version WAVE 1020.9 - ROCK ARSENAL EXPANSION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3500, // 3.5 segundos
    // 🟠 Amber Warm (seguro para rueda)
    amberWarm: { h: 30, s: 75, l: 60 },
    peakIntensity: 0.85, // No 100% para no quemar
};
// ═══════════════════════════════════════════════════════════════════════════
// 🌊 STAGE_WASH CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class StageWash extends BaseEffect {
    constructor(config) {
        super('stage_wash');
        this.effectType = 'stage_wash';
        this.name = 'Stage Wash';
        this.category = 'color';
        this.priority = 50; // Baja - es un fondo
        this.mixBus = 'htp';
        // 🌊 State
        this.washIntensity = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.washIntensity = 0;
        console.log(`[StageWash 🌊] TRIGGERED! Duration=${this.config.durationMs}ms`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Progreso normalizado (0-1)
        const progress = Math.min(1, this.elapsedMs / this.config.durationMs);
        // ¿Terminamos?
        if (progress >= 1) {
            this.phase = 'finished';
            console.log(`[StageWash 🌊] WASH COMPLETE`);
            return;
        }
        // Actualizar intensidad
        this.updateIntensity(progress);
    }
    updateIntensity(progress) {
        // Envelope: Fade in (25%) → Sustain (50%) → Fade out (25%)
        if (progress < 0.25) {
            // Fade in suave
            const t = progress / 0.25;
            this.washIntensity = Math.pow(t, 0.7) * this.config.peakIntensity;
        }
        else if (progress < 0.75) {
            // Sustain estable
            this.washIntensity = this.config.peakIntensity;
        }
        else {
            // Fade out suave
            const t = (progress - 0.75) / 0.25;
            this.washIntensity = this.config.peakIntensity * (1 - Math.pow(t, 0.7));
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // 🌊 TODOS LOS FIXTURES - Mismo color amber/warm
        const washOverride = {
            color: this.config.amberWarm,
            dimmer: this.washIntensity,
            // NO movement - estáticos
            blendMode: 'max',
        };
        const zoneOverrides = {
            'movers-left': washOverride,
            'movers-right': washOverride,
            'back': washOverride,
            'front': washOverride,
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.config.durationMs,
            zones: Object.keys(zoneOverrides),
            intensity: this.washIntensity,
            zoneOverrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    resetState() {
        this.washIntensity = 0;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createStageWash(config) {
    return new StageWash(config);
}
