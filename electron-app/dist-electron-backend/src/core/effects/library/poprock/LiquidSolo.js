/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎸 LIQUID_SOLO - SPOTLIGHT SWEEP ELEGANTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1020.8: REDISEÑO COMPLETO - Realismo y Timing
 *
 * CONCEPTO:
 * Un sweep horizontal suave de spotlight, como si un foco siguiera
 * un movimiento fluido en el escenario. NO asume posición de músico.
 *
 * COMPORTAMIENTO FÍSICO:
 * - Sweep L→R o R→L (aleatorio con seed determinista)
 * - Movimiento SUAVE y continuo (no errático)
 * - Iris cerrado (spot definido)
 * - Duración: 3-4 segundos MAX (catcheable por Selene)
 *
 * AUDIO KEY:
 * - Se alimenta del MidHigh (guitarra/melodía)
 * - Clarity alta = movimiento más pronunciado
 *
 * COLORES:
 * - Azul Eléctrico (elegante)
 * - Transición a Blanco Cálido en el peak del sweep
 *
 * @module core/effects/library/poprock/LiquidSolo
 * @version WAVE 1020.8 - REDISEÑO REALISTA
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3500, // 3.5 segundos - corto y catcheable
    // 💙 Azul Eléctrico
    electricBlue: { h: 210, s: 85, l: 55 },
    // 💡 Blanco Cálido para peak
    peakWhite: { h: 40, s: 20, l: 88 },
    sweepAmplitude: 0.6, // Sweep amplio pero no extremo
};
// Deterministic random para dirección del sweep
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
// ═══════════════════════════════════════════════════════════════════════════
// 🎸 LIQUID_SOLO CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class LiquidSolo extends BaseEffect {
    constructor(config) {
        super('liquid_solo');
        this.effectType = 'liquid_solo';
        this.name = 'Liquid Solo';
        this.category = 'movement'; // Movement - evita spam
        this.priority = 75; // Moderado - no compite con thunder_struck
        this.mixBus = 'htp';
        // 🎸 State
        this.sweepIntensity = 0;
        this.sweepProgress = 0; // 0-1 progress del sweep
        this.sweepDirection = 1; // 1 = L→R, -1 = R→L
        this.currentPan = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = { ...this.config.electricBlue };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.sweepIntensity = 0;
        this.sweepProgress = 0;
        // Dirección aleatoria (pero determinista) basada en timestamp
        const seed = Date.now();
        this.sweepDirection = seededRandom(seed) > 0.5 ? 1 : -1;
        // Pan inicial: borde opuesto a la dirección del sweep
        this.currentPan = -this.sweepDirection * this.config.sweepAmplitude;
        console.log(`[LiquidSolo 🎸] TRIGGERED! Duration=${this.config.durationMs}ms Direction=${this.sweepDirection > 0 ? 'L→R' : 'R→L'}`);
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
            console.log(`[LiquidSolo 🎸] SWEEP COMPLETE (${this.elapsedMs}ms)`);
            return;
        }
        // Curva de intensidad: Fade in → Sustain → Fade out
        this.updateIntensity(progress);
        // Actualizar sweep (movimiento horizontal suave)
        this.updateSweep(progress);
        // Actualizar color
        this.updateColor(progress);
    }
    updateIntensity(progress) {
        // Envelope: Attack (15%) → Sustain (60%) → Decay (25%)
        if (progress < 0.15) {
            // Fade in suave
            this.sweepIntensity = Math.pow(progress / 0.15, 0.6);
        }
        else if (progress < 0.75) {
            // Sustain estable
            this.sweepIntensity = 0.95;
        }
        else {
            // Fade out elegante
            const decayProgress = (progress - 0.75) / 0.25;
            this.sweepIntensity = 0.95 * (1 - Math.pow(decayProgress, 0.4));
        }
    }
    updateSweep(progress) {
        // Sweep suave con easing (ease-in-out)
        // Fórmula: 3t² - 2t³ (smooth hermite interpolation)
        this.sweepProgress = progress * progress * (3 - 2 * progress);
        // Pan position: Start → End con dirección
        const startPan = -this.sweepDirection * this.config.sweepAmplitude;
        const endPan = this.sweepDirection * this.config.sweepAmplitude;
        this.currentPan = startPan + (endPan - startPan) * this.sweepProgress;
    }
    updateColor(progress) {
        // Transición: Azul → Blanco en el peak (centro del sweep)
        // Peak = cuando sweepProgress ≈ 0.5
        const distanceFromCenter = Math.abs(this.sweepProgress - 0.5) * 2; // 0-1
        const peakBlend = 1 - distanceFromCenter; // 1 en centro, 0 en bordes
        const t = peakBlend * 0.5; // Máximo 50% de blanco en el peak
        this.currentColor = {
            h: this.config.electricBlue.h + (this.config.peakWhite.h - this.config.electricBlue.h) * t,
            s: this.config.electricBlue.s + (this.config.peakWhite.s - this.config.electricBlue.s) * t,
            l: this.config.electricBlue.l + (this.config.peakWhite.l - this.config.electricBlue.l) * t,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // 🎸 MOVERS - Sweep horizontal suave
        const moverOverride = {
            color: this.currentColor,
            dimmer: this.sweepIntensity * 0.95,
            movement: {
                pan: this.currentPan,
                tilt: -0.05, // Ligeramente hacia abajo (público/escenario)
                isAbsolute: false,
                speed: 0.7, // Smooth sweep
            },
            blendMode: 'max',
        };
        // 💡 PARs - Acompañan sutilmente (no roban protagonismo)
        const backOverride = {
            color: { ...this.config.electricBlue, l: this.config.electricBlue.l * 0.4 },
            dimmer: this.sweepIntensity * 0.25,
            blendMode: 'max',
        };
        const frontOverride = {
            color: { ...this.config.electricBlue, l: this.config.electricBlue.l * 0.3 },
            dimmer: this.sweepIntensity * 0.15,
            blendMode: 'max',
        };
        const zoneOverrides = {
            'movers_left': moverOverride,
            'movers_right': moverOverride, // Ambos movers hacen el MISMO sweep
            'back': backOverride,
            'front': frontOverride,
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.config.durationMs,
            zones: Object.keys(zoneOverrides),
            intensity: this.sweepIntensity,
            zoneOverrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    resetState() {
        this.sweepIntensity = 0;
        this.sweepProgress = 0;
        this.currentPan = 0;
        this.currentColor = { ...this.config.electricBlue };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createLiquidSolo(config) {
    return new LiquidSolo(config);
}
