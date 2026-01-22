/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌧️ DIGITAL RAIN - MATRIX VIBES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (Radwulf)
 *
 * FILOSOFÍA:
 * Inspirado en Matrix - visualiza bits cayendo como lluvia de datos.
 * Comportamiento asíncrono y caótico pero suave, perfecto para zonas tranquilas.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - flota sobre la física)
 * - Pars: Flicker aleatorio rápido, intensidad baja (0.1-0.3)
 * - Movers: Tilt hacia abajo (mirando al público), Pan escaneando lento
 * - NO usa beatCount: Math.random() cada frame para decidir encendido/apagado
 *
 * COLORES:
 * - CYAN (#00ffff) y LIME (#00ff00) - Terminal retro
 * - Transiciones suaves entre ambos colores
 *
 * ZONAS:
 * - Perfecto para ambient, gentle, valley
 * - Ideal para intros y momentos de transición
 *
 * @module core/effects/library/techno/DigitalRain
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (Radwulf)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 6000, // 6 segundos (was 8s) - WAVE 964
    flickerProbability: 0.15, // 15% chance por frame (~9 FPS flickering)
    minIntensity: 0.1,
    maxIntensity: 0.3,
    scanSpeed: 15, // 15°/s - muy lento
    tiltAngle: -45, // Mirando hacia abajo
};
// ═══════════════════════════════════════════════════════════════════════════
// DIGITAL RAIN EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class DigitalRain extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('digital_rain');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'digital_rain';
        this.name = 'Digital Rain';
        this.category = 'physical';
        this.priority = 70; // Media-alta - WAVE 964: Subida de 40 a 70
        this.mixBus = 'global'; // WAVE 964: HTP→GLOBAL para visibilidad
        this.panOffset = -180;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.panOffset = -180; // Empieza desde la izquierda
        console.log(`[DigitalRain 💾] TRIGGERED! Duration=${this.config.durationMs}ms FlickerProb=${this.config.flickerProbability}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Pan de movers: escaneo lento de izquierda a derecha
        this.panOffset += (this.config.scanSpeed * deltaMs) / 1000;
        if (this.panOffset > 180)
            this.panOffset = -180; // Wrap around
        // Check si terminó
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[DigitalRain 💾] FINISHED (${this.config.durationMs}ms)`);
        }
    }
    /**
     * 📤 GET OUTPUT - Devuelve el output del frame actual
     * 💾 WAVE 938: MATRIX VIBES - Flicker aleatorio con escaneo lento
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['front', 'pars', 'back', 'movers'],
            intensity: this.triggerIntensity,
            zoneOverrides: {},
        };
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Flicker aleatorio con colores CYAN/LIME
        // ═════════════════════════════════════════════════════════════════════
        const parZones = ['front', 'pars', 'back'];
        parZones.forEach(zone => {
            const dimmerValue = Math.random() < this.config.flickerProbability
                ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
                : 0;
            if (dimmerValue > 0) {
                // Color: alternar entre CYAN y LIME
                const useCyan = Math.random() > 0.5;
                const color = useCyan
                    ? { h: 180, s: 100, l: 50 } // CYAN
                    : { h: 120, s: 100, l: 50 }; // LIME
                output.zoneOverrides[zone] = {
                    dimmer: dimmerValue,
                    color: color,
                    blendMode: 'max',
                };
            }
        });
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Tilt fijo hacia abajo, Pan escaneo lento
        // ═════════════════════════════════════════════════════════════════════
        output.zoneOverrides['movers'] = {
            dimmer: 0.15,
            color: { h: 180, s: 100, l: 50 }, // CYAN
            blendMode: 'max',
            movement: {
                pan: this.panOffset,
                tilt: this.config.tiltAngle,
            },
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        console.log(`[DigitalRain 🌧️] Aborted`);
    }
}
