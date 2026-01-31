/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🐟 SCHOOL OF FISH - Banco de Peces Cruzando
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1070: THE LIVING OCEAN
 *
 * Simula un banco de peces brillantes cruzando el campo visual.
 * Se activa cuando hay muchos transientes suaves (hi-hats, shakers)
 * en la zona OPEN_OCEAN (200-1000m).
 *
 * VISUAL:
 * - Movers en cyan brillante cruzando de L→R (o R→L)
 * - Pulsos de intensidad durante el cruce (cada "pez")
 * - Movimiento rápido pero no violento
 *
 * FILOSOFÍA:
 * Los peces no saben que están siendo observados.
 * Su movimiento es natural, fluido, como si siempre
 * hubieran estado ahí. Aparecen y desaparecen.
 *
 * @module core/effects/library/chillLounge/SchoolOfFish
 * @version WAVE 1070 - THE LIVING OCEAN
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 1800,
    peakIntensity: 0.85,
    direction: 'random',
    fishCount: 5,
};
// Color: Cyan tropical brillante (dentro de CHILL_CONSTITUTION)
const FISH_COLOR = { h: 185, s: 90, l: 58 };
// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL OF FISH EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class SchoolOfFish extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('school_of_fish');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'school_of_fish';
        this.name = 'School of Fish';
        this.category = 'physical';
        this.priority = 70;
        // HTP: Se suma a la física base, no la reemplaza
        this.mixBus = 'htp';
        this.actualDirection = 'LtoR';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        // Determinar dirección
        if (this.config.direction === 'random') {
            // Usar tiempo para pseudo-random determinista (NO Math.random)
            this.actualDirection = Date.now() % 2 === 0 ? 'LtoR' : 'RtoL';
        }
        else {
            this.actualDirection = this.config.direction;
        }
        console.log(`[SchoolOfFish 🐟] TRIGGERED! Direction=${this.actualDirection} FishCount=${this.config.fishCount}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[SchoolOfFish 🐟] FINISHED - School passed`);
        }
    }
    /**
     * 📤 GET OUTPUT - Banco de peces cruzando
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // ═════════════════════════════════════════════════════════════════════
        // ENVELOPE: Fade in rápido → sustain → fade out rápido
        // ═════════════════════════════════════════════════════════════════════
        let envelope;
        if (progress < 0.1) {
            envelope = progress / 0.1; // Fade in 10%
        }
        else if (progress < 0.85) {
            envelope = 1.0; // Sustain 75%
        }
        else {
            envelope = 1 - ((progress - 0.85) / 0.15); // Fade out 15%
        }
        // ═════════════════════════════════════════════════════════════════════
        // FISH PULSES: Cada pez es un pulso de intensidad
        // ═════════════════════════════════════════════════════════════════════
        const fishPhase = progress * this.config.fishCount * Math.PI * 2;
        const fishPulse = (Math.sin(fishPhase) + 1) / 2; // 0-1
        // Intensidad: base + pulso
        const baseIntensity = 0.4;
        const pulseIntensity = 0.6 * fishPulse;
        const dimmer = (baseIntensity + pulseIntensity) * envelope * this.config.peakIntensity;
        // ═════════════════════════════════════════════════════════════════════
        // PAN SWEEP: Cruce de lado a lado
        // ═════════════════════════════════════════════════════════════════════
        let panProgress = progress;
        if (this.actualDirection === 'RtoL') {
            panProgress = 1 - progress;
        }
        // Curva suave para el pan (easing)
        const easedPan = panProgress * panProgress * (3 - 2 * panProgress);
        // Convertir a grados: -60° a +60°
        const panDegrees = -60 + easedPan * 120;
        // Tilt ligeramente ondulante (peces no nadan en línea recta)
        const tiltWobble = Math.sin(progress * Math.PI * 4) * 8;
        const tiltDegrees = tiltWobble;
        // ═════════════════════════════════════════════════════════════════════
        // OUTPUT
        // ═════════════════════════════════════════════════════════════════════
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['movers_left', 'movers_right'],
            intensity: this.triggerIntensity * dimmer,
            zoneOverrides: {},
        };
        // Movers izquierdo: Lidera si LtoR, sigue si RtoL
        const leftDelay = this.actualDirection === 'LtoR' ? 0 : 0.15;
        const leftProgress = Math.max(0, Math.min(1, progress - leftDelay));
        const leftPan = -60 + (leftProgress * leftProgress * (3 - 2 * leftProgress)) * 120;
        output.zoneOverrides['movers_left'] = {
            dimmer: dimmer * (this.actualDirection === 'LtoR' ? 1 : 0.7),
            color: FISH_COLOR,
            blendMode: 'max',
            movement: {
                pan: leftPan,
                tilt: tiltDegrees,
            },
        };
        // Movers derecho: Sigue si LtoR, lidera si RtoL
        const rightDelay = this.actualDirection === 'RtoL' ? 0 : 0.15;
        const rightProgress = Math.max(0, Math.min(1, progress - rightDelay));
        const rightPan = -60 + (rightProgress * rightProgress * (3 - 2 * rightProgress)) * 120;
        output.zoneOverrides['movers_right'] = {
            dimmer: dimmer * (this.actualDirection === 'RtoL' ? 1 : 0.7),
            color: FISH_COLOR,
            blendMode: 'max',
            movement: {
                pan: rightPan,
                tilt: tiltDegrees + 5, // Ligeramente diferente
            },
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        console.log(`[SchoolOfFish 🐟] Aborted`);
    }
}
