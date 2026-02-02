/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ POWER_CHORD - EL GOLPE DEL ACORDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1020.9: ROCK ARSENAL EXPANSION - "Short & Safe"
 *
 * CONCEPTO:
 * El momento del power chord. Un golpe visual sincronizado.
 * Movers + PARs iluminan juntos en un flash potente y breve.
 *
 * COMPORTAMIENTO:
 * - Duración: 2 segundos (ultra corto, catcheable)
 * - NO movimiento de movers (estaticos, solo dimmer)
 * - Color: Warm White estable (NO cambia rueda de color)
 * - PARs: Strobe rítmico (3-4 flashes)
 * - Movers: Flash sostenido
 *
 * AUDIO KEY:
 * - Se alimenta del Bass + MidHigh (el "golpe" del acorde)
 * - Harshness alta = más intensidad
 *
 * FILOSOFÍA:
 * Corto, simple, efectivo. El martillo visual del rock.
 *
 * @module core/effects/library/poprock/PowerChord
 * @version WAVE 1020.9 - ROCK ARSENAL EXPANSION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 2000, // 2 segundos - ultra corto
    // 💡 Warm White (seguro para rueda)
    warmWhite: { h: 40, s: 15, l: 92 },
    strobeCount: 4, // 4 flashes rítmicos
    fadeInMs: 100, // 🌊 WAVE 1090: Ataque de guitarra (rock)
    fadeOutMs: 1000, // 🌊 WAVE 1090: Resonancia (sustain largo)
};
// ═══════════════════════════════════════════════════════════════════════════
// ⚡ POWER_CHORD CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class PowerChord extends BaseEffect {
    constructor(config) {
        super('power_chord');
        this.effectType = 'power_chord';
        this.name = 'Power Chord';
        this.category = 'color'; // Color change (flash)
        this.priority = 80;
        this.mixBus = 'global'; // Global - override total
        // ⚡ State
        this.chordIntensity = 0;
        this.strobePhase = 0; // Fase del strobe (0-1 por flash)
        this.currentFlash = 0; // Flash actual (0 to strobeCount-1)
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.chordIntensity = 0;
        this.strobePhase = 0;
        this.currentFlash = 0;
        console.log(`[PowerChord ⚡] TRIGGERED! Duration=${this.config.durationMs}ms`);
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
            console.log(`[PowerChord ⚡] CHORD COMPLETE`);
            return;
        }
        // Actualizar intensidad
        this.updateIntensity(progress);
        // Actualizar strobe (solo para PARs)
        this.updateStrobe(progress);
    }
    updateIntensity(progress) {
        // Envelope: Attack (20%) → Sustain (50%) → Decay (30%)
        if (progress < 0.2) {
            // Attack rápido
            this.chordIntensity = Math.pow(progress / 0.2, 0.5);
        }
        else if (progress < 0.7) {
            // Sustain alto
            this.chordIntensity = 0.98;
        }
        else {
            // Decay
            const decayProgress = (progress - 0.7) / 0.3;
            this.chordIntensity = 0.98 * (1 - Math.pow(decayProgress, 0.6));
        }
    }
    updateStrobe(progress) {
        // Duración de cada flash
        const flashDuration = 1 / this.config.strobeCount;
        // ¿En qué flash estamos?
        this.currentFlash = Math.floor(progress * this.config.strobeCount);
        // Fase dentro del flash actual (0-1)
        this.strobePhase = (progress % flashDuration) / flashDuration;
    }
    getStrobeIntensity() {
        // Flash on/off con duty cycle 40% (40% encendido, 60% apagado)
        return this.strobePhase < 0.4 ? 1.0 : 0.0;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const elapsed = this.elapsedMs;
        const duration = this.config.durationMs;
        // 🌊 WAVE 1090: FLUID DYNAMICS (Rock - ataque medio, resonancia larga)
        let fadeOpacity = 1.0;
        const fadeOutStart = duration - this.config.fadeOutMs;
        if (this.config.fadeInMs > 0 && elapsed < this.config.fadeInMs) {
            fadeOpacity = (elapsed / this.config.fadeInMs) ** 1.5;
        }
        else if (this.config.fadeOutMs > 0 && elapsed > fadeOutStart) {
            fadeOpacity = ((duration - elapsed) / this.config.fadeOutMs) ** 1.5;
        }
        const strobeIntensity = this.getStrobeIntensity();
        // ⚡ MOVERS - Flash sostenido (NO strobe, solo dimmer)
        const moverOverride = {
            color: this.config.warmWhite,
            dimmer: this.chordIntensity * 0.95,
            // NO movement - movers estáticos
            blendMode: 'replace',
        };
        // ⚡ PARs - Strobe rítmico
        const parOverride = {
            color: this.config.warmWhite,
            dimmer: this.chordIntensity * strobeIntensity,
            blendMode: 'replace',
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
            progress: elapsed / duration,
            zones: Object.keys(zoneOverrides),
            intensity: this.chordIntensity,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090: FLUID DYNAMICS
            zoneOverrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    resetState() {
        this.chordIntensity = 0;
        this.strobePhase = 0;
        this.currentFlash = 0;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createPowerChord(config) {
    return new PowerChord(config);
}
