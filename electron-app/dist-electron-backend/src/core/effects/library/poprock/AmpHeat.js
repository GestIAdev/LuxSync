/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 AMP_HEAT - VÁLVULAS CALIENTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1019: ROCK LEGENDS ARSENAL - "ANALOG POWER"
 *
 * CONCEPTO:
 * La atmósfera de un amplificador Marshall encendido en un escenario oscuro.
 * Para intros, versos o momentos tranquilos. El calor del rock análogo.
 *
 * COMPORTAMIENTO FÍSICO:
 * - Color: Rojo Sangre pulsando hacia Naranja Ámbar
 * - Intensidad: "Respiración" lenta, como válvulas calentándose
 * - Sigue el LowMid (el cuerpo del bajo) suavemente
 * - Movimiento: Casi nulo. Una deriva (Drift) imperceptible
 *
 * VIBE:
 * - Intimidad
 * - Tensión acumulada
 * - El momento antes de la tormenta
 *
 * COLORES:
 * - Rojo Sangre Profundo (base)
 * - Naranja Ámbar (peak de respiración)
 *
 * @module core/effects/library/poprock/AmpHeat
 * @version WAVE 1019 - ROCK LEGENDS ARSENAL
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 6000, // Efecto largo, atmosférico
    bpmSync: true,
    beatsTotal: 16, // 16 beats (4 compases típicos)
    // ❤️ Rojo Sangre Profundo
    bloodRed: { h: 0, s: 85, l: 30 },
    // 🧡 Naranja Ámbar (válvulas calientes)
    amberOrange: { h: 25, s: 90, l: 45 },
    breathFrequency: 0.25, // Una respiración cada 4 segundos
    driftAmplitude: 0.05, // Drift casi imperceptible
};
// ═══════════════════════════════════════════════════════════════════════════
// 🔥 AMP_HEAT CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class AmpHeat extends BaseEffect {
    constructor(config) {
        super('amp_heat');
        this.effectType = 'amp_heat';
        this.name = 'Amp Heat';
        this.category = 'color'; // Principalmente afecta color
        this.priority = 60; // Media - es ambiental, no intrusivo
        this.mixBus = 'htp'; // HTP - se mezcla suavemente
        this.actualDurationMs = 6000;
        // 🔥 State
        this.heatIntensity = 0;
        this.breathPhase = 0;
        this.driftPhase = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = { ...this.config.bloodRed };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.heatIntensity = 0;
        this.breathPhase = 0;
        this.driftPhase = 0;
        // Calcular duración basada en BPM
        this.calculateDuration();
        console.log(`[AmpHeat 🔥] TRIGGERED! Duration=${this.actualDurationMs}ms`);
        console.log(`[AmpHeat 🔥] VALVES WARMING UP...`);
    }
    calculateDuration() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualDurationMs = msPerBeat * this.config.beatsTotal;
        }
        else {
            this.actualDurationMs = this.config.durationMs;
        }
        // MAX DURATION de seguridad (este puede ser largo)
        const MAX_DURATION_MS = 12000;
        if (this.actualDurationMs > MAX_DURATION_MS) {
            this.actualDurationMs = MAX_DURATION_MS;
        }
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Progreso normalizado (0-1)
        const progress = Math.min(1, this.elapsedMs / this.actualDurationMs);
        // ¿Terminamos?
        if (progress >= 1) {
            this.phase = 'finished';
            console.log(`[AmpHeat 🔥] VALVES COOLING DOWN (${this.elapsedMs}ms)`);
            return;
        }
        // Actualizar fases
        this.breathPhase += (deltaMs / 1000) * this.config.breathFrequency * 2 * Math.PI;
        this.driftPhase += (deltaMs / 1000) * 0.1 * 2 * Math.PI; // Drift muy lento
        // Calcular intensidad con envelope
        this.updateIntensity(progress);
        // Actualizar color (respiración Rojo → Ámbar)
        this.updateColor();
    }
    updateIntensity(progress) {
        // Envelope muy suave: Fade in lento → Sustain largo → Fade out lento
        if (progress < 0.15) {
            // Fade in muy lento (como válvulas calentándose)
            this.heatIntensity = Math.pow(progress / 0.15, 0.5) * 0.7;
        }
        else if (progress < 0.85) {
            // Sustain con respiración
            const sustainProgress = (progress - 0.15) / 0.7;
            // Respiración: onda sinusoidal suave
            const breathe = Math.sin(this.breathPhase) * 0.15;
            // Base intensity + breathing
            this.heatIntensity = 0.65 + breathe + sustainProgress * 0.1; // Sube un poco con el tiempo
        }
        else {
            // Fade out lento
            const decayProgress = (progress - 0.85) / 0.15;
            const lastIntensity = 0.75 + Math.sin(this.breathPhase) * 0.1;
            this.heatIntensity = lastIntensity * (1 - Math.pow(decayProgress, 0.7));
        }
    }
    updateColor() {
        // Respiración de color: Rojo Sangre ↔ Naranja Ámbar
        // Usa la misma fase que la intensidad para coherencia
        const colorBlend = (Math.sin(this.breathPhase) + 1) / 2; // Normalizado 0-1
        const t = colorBlend * 0.5; // Máximo 50% de transición
        this.currentColor = {
            h: this.config.bloodRed.h + (this.config.amberOrange.h - this.config.bloodRed.h) * t,
            s: this.config.bloodRed.s + (this.config.amberOrange.s - this.config.bloodRed.s) * t,
            l: this.config.bloodRed.l + (this.config.amberOrange.l - this.config.bloodRed.l) * t,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.actualDurationMs;
        // Drift sutil para los movers
        const driftPan = Math.sin(this.driftPhase) * this.config.driftAmplitude;
        const driftTilt = Math.cos(this.driftPhase * 0.7) * this.config.driftAmplitude * 0.5;
        // 🔥 BACK PARS - El glow principal (válvulas)
        const backOverride = {
            color: this.currentColor,
            dimmer: this.heatIntensity,
            blendMode: 'max',
        };
        // 🔥 FRONT PARS - Acompañamiento sutil
        const frontOverride = {
            color: { ...this.currentColor, l: this.currentColor.l * 0.7 }, // Más oscuro
            dimmer: this.heatIntensity * 0.5,
            blendMode: 'max',
        };
        // 🔥 MOVERS - Drift imperceptible, como calor subiendo
        const moverOverride = {
            color: this.config.amberOrange, // Siempre ámbar (válvulas)
            dimmer: this.heatIntensity * 0.4,
            movement: {
                pan: driftPan,
                tilt: driftTilt,
                isAbsolute: false, // Offset sobre la física
                speed: 0.2, // MUY lento
            },
            blendMode: 'max',
        };
        const zoneOverrides = {
            'back': backOverride,
            'front': frontOverride,
            'movers': moverOverride,
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: Object.keys(zoneOverrides),
            intensity: this.heatIntensity,
            zoneOverrides,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createAmpHeat(config) {
    return new AmpHeat(config);
}
