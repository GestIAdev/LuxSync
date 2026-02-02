/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💡 SPOTLIGHT_PULSE - PULSO DE SPOTLIGHT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1020.9: ROCK ARSENAL EXPANSION - "Short & Safe"
 *
 * CONCEPTO:
 * Movers pulsando en intensidad como un "respiro" de luz.
 * No se mueven, solo respiran en brillo.
 *
 * COMPORTAMIENTO:
 * - Duración: 3 segundos
 * - NO movimiento de movers (completamente estáticos)
 * - Color: Cool White estable (seguro para rueda)
 * - Dimmer pulsando (2-3 respiraciones)
 * - PARs acompañan sutilmente
 *
 * AUDIO KEY:
 * - Se alimenta del MidHigh (melodía/lead)
 * - Clarity alta = pulso más pronunciado
 *
 * FILOSOFÍA:
 * El "latido" del spotlight. Minimalista, elegante, seguro.
 *
 * @module core/effects/library/poprock/SpotlightPulse
 * @version WAVE 1020.9 - ROCK ARSENAL EXPANSION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3000, // 3 segundos
    // ❄️ Cool White (seguro para rueda)
    coolWhite: { h: 200, s: 5, l: 90 },
    pulseCount: 2.5, // 2.5 pulsos (2 completos + medio)
    minIntensity: 0.35, // No se apaga del todo
    maxIntensity: 0.95, // Peak alto
};
// ═══════════════════════════════════════════════════════════════════════════
// 💡 SPOTLIGHT_PULSE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class SpotlightPulse extends BaseEffect {
    constructor(config) {
        super('spotlight_pulse');
        this.effectType = 'spotlight_pulse';
        this.name = 'Spotlight Pulse';
        this.category = 'color';
        this.priority = 65;
        this.mixBus = 'htp';
        // 💡 State
        this.pulseIntensity = 0;
        this.envelope = 0; // Envelope general del efecto (fade in/out)
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.pulseIntensity = 0;
        this.envelope = 0;
        console.log(`[SpotlightPulse 💡] TRIGGERED! Duration=${this.config.durationMs}ms`);
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
            console.log(`[SpotlightPulse 💡] PULSE COMPLETE`);
            return;
        }
        // Actualizar envelope general
        this.updateEnvelope(progress);
        // Actualizar pulso
        this.updatePulse(progress);
    }
    updateEnvelope(progress) {
        // Envelope general: Fade in (15%) → Sustain (70%) → Fade out (15%)
        if (progress < 0.15) {
            this.envelope = Math.pow(progress / 0.15, 0.6);
        }
        else if (progress < 0.85) {
            this.envelope = 1.0;
        }
        else {
            const t = (progress - 0.85) / 0.15;
            this.envelope = 1 - Math.pow(t, 0.6);
        }
    }
    updatePulse(progress) {
        // Pulso sinusoidal
        const pulsePhase = progress * this.config.pulseCount * Math.PI * 2;
        const pulseFactor = (Math.sin(pulsePhase) + 1) / 2; // 0-1
        // Intensidad entre min y max
        const range = this.config.maxIntensity - this.config.minIntensity;
        this.pulseIntensity = this.config.minIntensity + pulseFactor * range;
        // Aplicar envelope general
        this.pulseIntensity *= this.envelope;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // 💡 MOVERS - Pulso de intensidad (NO movement)
        const moverOverride = {
            color: this.config.coolWhite,
            dimmer: this.pulseIntensity,
            // NO movement - completamente estáticos
            blendMode: 'max',
        };
        // 💡 PARs - Acompañan sutilmente (50% intensidad)
        const parOverride = {
            color: this.config.coolWhite,
            dimmer: this.pulseIntensity * 0.5,
            blendMode: 'max',
        };
        const zoneOverrides = {
            'movers_left': moverOverride,
            'movers_right': moverOverride,
            'back': parOverride,
            'front': parOverride,
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.config.durationMs,
            zones: Object.keys(zoneOverrides),
            intensity: this.pulseIntensity,
            zoneOverrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    resetState() {
        this.pulseIntensity = 0;
        this.envelope = 0;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createSpotlightPulse(config) {
    return new SpotlightPulse(config);
}
