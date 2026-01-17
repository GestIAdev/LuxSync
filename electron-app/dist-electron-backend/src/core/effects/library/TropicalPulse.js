/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌴 TROPICAL PULSE - EL LATIDO DEL CARIBE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 *
 * CONCEPTO:
 * Pulsos de color que suben de intensidad como el ritmo de una conga.
 * No es un strobe frío - es un LATIDO cálido y orgánico.
 *
 * COMPORTAMIENTO:
 * - 3-4 pulsos que van creciendo en intensidad
 * - Cada pulso es más brillante que el anterior (crescendo)
 * - Colores: coral → magenta → amarillo tropical
 * - Timing con "swing" latino (no mecánico como techno)
 *
 * PHYSICS:
 * - BPM-synced pero con groove (±10% timing variation)
 * - Cada pulso dura ~200ms (attack) + ~300ms (decay)
 * - El último pulso es el más brillante (clímax)
 *
 * PERFECT FOR:
 * - Momentos de energía media-alta
 * - Transiciones entre secciones
 * - Cuando la música "sube" pero no es el clímax
 *
 * @module core/effects/library/TropicalPulse
 * @version WAVE 692
 */
import { BaseEffect } from '../BaseEffect';
const DEFAULT_CONFIG = {
    pulseCount: 4,
    pulseAttackMs: 150,
    pulseDecayMs: 250,
    pulseGapMs: 300,
    bpmSync: true,
    colorProgression: [
        { h: 15, s: 100, l: 60 }, // Coral cálido
        { h: 330, s: 100, l: 55 }, // Magenta
        { h: 45, s: 100, l: 65 }, // Amarillo tropical
        { h: 30, s: 100, l: 70 }, // Dorado brillante (clímax)
    ],
    startIntensity: 0.5,
    endIntensity: 1.0,
    swingFactor: 0.15, // Groove latino sutil
};
// ═══════════════════════════════════════════════════════════════════════════
// TROPICAL PULSE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class TropicalPulse extends BaseEffect {
    constructor(config) {
        super('tropical_pulse');
        this.effectType = 'tropical_pulse';
        this.name = 'Tropical Pulse';
        this.category = 'physical'; // HTP - brilla por encima
        this.priority = 75;
        this.currentPulse = 0;
        this.pulsePhase = 'attack';
        this.phaseTimer = 0;
        this.currentIntensity = 0;
        this.totalDurationMs = 0;
        // Swing timing - cada pulso tiene timing ligeramente diferente
        this.pulseTimings = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = this.config.colorProgression[0];
    }
    trigger(config) {
        super.trigger(config);
        this.currentPulse = 0;
        this.pulsePhase = 'attack';
        this.phaseTimer = 0;
        this.currentIntensity = 0;
        // Calcular timings con swing
        this.calculateSwingTimings();
        // Calcular duración total
        this.calculateTotalDuration();
        console.log(`[TropicalPulse 🌴] TRIGGERED! Pulses=${this.config.pulseCount} Duration=${this.totalDurationMs}ms Swing=${(this.config.swingFactor * 100).toFixed(0)}%`);
    }
    calculateSwingTimings() {
        this.pulseTimings = [];
        const baseGap = this.config.bpmSync && this.musicalContext?.bpm
            ? (60000 / this.musicalContext.bpm) / 2 // Eighth note
            : this.config.pulseGapMs;
        for (let i = 0; i < this.config.pulseCount; i++) {
            // Swing: pulsos pares llegan un poco tarde, impares un poco temprano
            const swingOffset = i % 2 === 0
                ? -this.config.swingFactor
                : this.config.swingFactor;
            const timing = baseGap * (1 + swingOffset);
            this.pulseTimings.push(Math.max(100, timing));
        }
    }
    calculateTotalDuration() {
        const pulseDuration = this.config.pulseAttackMs + this.config.pulseDecayMs;
        const totalGaps = this.pulseTimings.reduce((a, b) => a + b, 0);
        this.totalDurationMs = (pulseDuration * this.config.pulseCount) + totalGaps;
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.phaseTimer += deltaMs;
        // Estado de la máquina de pulsos
        switch (this.pulsePhase) {
            case 'attack':
                this.updateAttack();
                break;
            case 'decay':
                this.updateDecay();
                break;
            case 'gap':
                this.updateGap();
                break;
        }
        // Actualizar color basado en el pulso actual
        this.updateColor();
    }
    updateAttack() {
        const progress = Math.min(1, this.phaseTimer / this.config.pulseAttackMs);
        // Curva de ataque: ease-out para golpe inmediato
        const eased = 1 - Math.pow(1 - progress, 3);
        // Intensidad escala con el número de pulso (crescendo)
        const pulseIntensityFactor = this.currentPulse / (this.config.pulseCount - 1);
        const targetIntensity = this.config.startIntensity +
            (this.config.endIntensity - this.config.startIntensity) * pulseIntensityFactor;
        this.currentIntensity = eased * targetIntensity * this.triggerIntensity;
        if (progress >= 1) {
            this.pulsePhase = 'decay';
            this.phaseTimer = 0;
        }
    }
    updateDecay() {
        const progress = Math.min(1, this.phaseTimer / this.config.pulseDecayMs);
        // Curva de decay: ease-in para caída suave
        const eased = Math.pow(progress, 2);
        const pulseIntensityFactor = this.currentPulse / (this.config.pulseCount - 1);
        const peakIntensity = this.config.startIntensity +
            (this.config.endIntensity - this.config.startIntensity) * pulseIntensityFactor;
        this.currentIntensity = (1 - eased) * peakIntensity * this.triggerIntensity;
        if (progress >= 1) {
            this.currentPulse++;
            if (this.currentPulse >= this.config.pulseCount) {
                this.phase = 'finished';
                console.log(`[TropicalPulse 🌴] Completed (${this.config.pulseCount} pulses, ${this.elapsedMs}ms)`);
                return;
            }
            this.pulsePhase = 'gap';
            this.phaseTimer = 0;
        }
    }
    updateGap() {
        const gapDuration = this.pulseTimings[this.currentPulse] || this.config.pulseGapMs;
        // Durante el gap, intensidad muy baja (no cero, para que no sea harsh)
        this.currentIntensity = 0.05 * this.triggerIntensity;
        if (this.phaseTimer >= gapDuration) {
            this.pulsePhase = 'attack';
            this.phaseTimer = 0;
        }
    }
    updateColor() {
        // Interpolar color basado en el pulso actual
        const colorIndex = Math.min(this.currentPulse, this.config.colorProgression.length - 1);
        const nextColorIndex = Math.min(colorIndex + 1, this.config.colorProgression.length - 1);
        const currentColor = this.config.colorProgression[colorIndex];
        const nextColor = this.config.colorProgression[nextColorIndex];
        // Blend entre colores durante el pulso
        const blendFactor = this.pulsePhase === 'attack'
            ? this.phaseTimer / this.config.pulseAttackMs
            : 0;
        this.currentColor = {
            h: currentColor.h + (nextColor.h - currentColor.h) * blendFactor * 0.3,
            s: currentColor.s,
            l: currentColor.l + (this.currentIntensity * 15), // Más brillo con más intensidad
        };
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            zones: ['all'],
            intensity: this.currentIntensity,
            dimmerOverride: this.currentIntensity,
            colorOverride: this.currentColor,
            globalOverride: true, // 🔥 CLAVE: Esto hace que funcione con la arquitectura actual
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createTropicalPulse(config) {
    return new TropicalPulse(config);
}
