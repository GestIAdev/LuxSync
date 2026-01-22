/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 CUMBIA MOON - OLA DE LUZ SUAVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 *
 * CONCEPTO:
 * Un "respiro" de luz que sube y baja suavemente - como la luna sobre el mar.
 * NO es un flash. NO es harsh. Es SUAVE y ENVOLVENTE.
 *
 * COMPORTAMIENTO:
 * - Sube lentamente (2-3 segundos)
 * - Mantiene un pico breve
 * - Baja lentamente (2-3 segundos)
 * - Colores: violeta tropical → cyan → azul profundo
 *
 * PHYSICS:
 * - Curva sinusoidal suave (ease-in-out)
 * - Intensidad máxima relativamente baja (~60%)
 * - Color shift durante el ciclo
 *
 * DIFERENCIA CON GHOSTBREATH:
 * - GhostBreath: Solo prende, mono-color, solo front
 * - CumbiaMoon: Sube Y BAJA, multi-color, ALL zones con globalOverride
 *
 * PERFECT FOR:
 * - Breakdown suaves
 * - Momentos de "respiro" en la música
 * - Transiciones lentas
 * - Cuando la energía baja pero no quieres oscuridad total
 *
 * @module core/effects/library/CumbiaMoon
 * @version WAVE 692
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    cycleDurationMs: 3000, // 🌙 WAVE 750: 3 segundos - más corto
    peakIntensity: 0.30, // 🌙 WAVE 785: 30% máximo - lunitas sutiles
    floorIntensity: 0.05, // 🌙 WAVE 750: Casi apagado
    peakSustainMs: 400, // 🌙 WAVE 750: Sustain breve
    // 🌙 WAVE 785: PLATA LUNAR - azul pálido que insinúa, no grita
    colorCycle: [
        { h: 210, s: 10, l: 60 }, // Plata tenue (inicio)
        { h: 210, s: 10, l: 70 }, // Plata lunar (pico) - INSINUACIÓN
        { h: 210, s: 10, l: 55 }, // Plata oscura (final)
    ],
    bpmSync: true,
    beatsPerCycle: 4, // 🌙 WAVE 750: 4 beats = más rápido
};
// ═══════════════════════════════════════════════════════════════════════════
// CUMBIA MOON CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class CumbiaMoon extends BaseEffect {
    constructor(config) {
        super('cumbia_moon');
        this.effectType = 'cumbia_moon';
        this.name = 'Cumbia Moon';
        this.category = 'physical';
        this.priority = 65; // Baja prioridad - es ambient
        this.mixBus = 'global'; // 🚂 WAVE 800: Dictador - necesita silencio para brillar
        this.currentIntensity = 0;
        this.actualCycleDurationMs = 5000;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = { ...this.config.colorCycle[0] };
    }
    trigger(config) {
        super.trigger(config);
        // Calcular duración basada en BPM si está activado
        this.calculateCycleDuration();
        console.log(`[CumbiaMoon 🌙] TRIGGERED! Duration=${this.actualCycleDurationMs}ms Peak=${(this.config.peakIntensity * 100).toFixed(0)}%`);
    }
    calculateCycleDuration() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualCycleDurationMs = msPerBeat * this.config.beatsPerCycle;
        }
        else {
            this.actualCycleDurationMs = this.config.cycleDurationMs;
        }
        // Clamp a un rango razonable
        this.actualCycleDurationMs = Math.max(2000, Math.min(8000, this.actualCycleDurationMs));
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Check if finished
        if (this.elapsedMs >= this.actualCycleDurationMs) {
            this.phase = 'finished';
            console.log(`[CumbiaMoon 🌙] Completed (${this.elapsedMs}ms)`);
            return;
        }
        // Calculate current position in cycle (0-1)
        const cycleProgress = this.elapsedMs / this.actualCycleDurationMs;
        // Calculate intensity using smooth bell curve
        this.currentIntensity = this.calculateBellIntensity(cycleProgress);
        // Update color based on progress
        this.updateColor(cycleProgress);
    }
    calculateBellIntensity(progress) {
        const { peakIntensity, floorIntensity, peakSustainMs } = this.config;
        const sustainRatio = peakSustainMs / this.actualCycleDurationMs;
        // Dividir el ciclo en: rise (40%), sustain (20%), fall (40%)
        const riseEnd = 0.4 - sustainRatio / 2;
        const sustainEnd = 0.6 + sustainRatio / 2;
        let intensity;
        if (progress < riseEnd) {
            // Rising phase - smooth ease-in-out
            const riseProgress = progress / riseEnd;
            intensity = this.easeInOutSine(riseProgress);
        }
        else if (progress < sustainEnd) {
            // Sustain at peak
            intensity = 1.0;
        }
        else {
            // Falling phase - smooth ease-in-out
            const fallProgress = (progress - sustainEnd) / (1 - sustainEnd);
            intensity = 1 - this.easeInOutSine(fallProgress);
        }
        // Scale to range [floor, peak]
        return (floorIntensity + (peakIntensity - floorIntensity) * intensity) * this.triggerIntensity;
    }
    easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }
    updateColor(progress) {
        const colors = this.config.colorCycle;
        if (colors.length === 1) {
            this.currentColor = { ...colors[0] };
            return;
        }
        // Interpolar entre colores basado en progress
        const scaledProgress = progress * (colors.length - 1);
        const colorIndex = Math.floor(scaledProgress);
        const blendFactor = scaledProgress - colorIndex;
        const currentColor = colors[Math.min(colorIndex, colors.length - 1)];
        const nextColor = colors[Math.min(colorIndex + 1, colors.length - 1)];
        // Interpolación circular para hue (el camino más corto)
        let hueDiff = nextColor.h - currentColor.h;
        if (hueDiff > 180)
            hueDiff -= 360;
        if (hueDiff < -180)
            hueDiff += 360;
        this.currentColor = {
            h: (currentColor.h + hueDiff * blendFactor + 360) % 360,
            s: currentColor.s + (nextColor.s - currentColor.s) * blendFactor,
            l: currentColor.l + (nextColor.l - currentColor.l) * blendFactor,
        };
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // � WAVE 800: CumbiaMoon usa globalOverride para IMPONERSE a las físicas
        // El sistema zoneOverrides + blendMode no funciona bien para este caso
        // globalOverride es el camino probado y confiable
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.actualCycleDurationMs,
            zones: ['front', 'back', 'movers'],
            intensity: this.currentIntensity,
            // � WAVE 800: Sistema LEGACY que funciona
            dimmerOverride: this.currentIntensity,
            colorOverride: this.currentColor,
            // 🌙 WAVE 800: globalOverride = TRUE - La luna manda sobre las físicas
            globalOverride: true,
            zoneOverrides: undefined,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createCumbiaMoon(config) {
    return new CumbiaMoon(config);
}
