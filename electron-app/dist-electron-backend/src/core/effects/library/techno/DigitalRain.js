/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌧️ DIGITAL RAIN - MATRIX VIBES
 * ══════════════════════════════════════════════════════════    // ═════════════════════════════════════════════════════════════════════
    // MOVERS: Solo dimmer flickering - MODO FANTASMA
    // 🛡️ WAVE 984: THE MOVER LAW - Eliminar color, deja que VMM controle
    // 🛡️ WAVE 994: THE HOLDING PATTERN - Nunca suelta el control
    // ═════════════════════════════════════════════════════════════════════
    const moverDimmer = Math.random() < this.config.flickerProbability
      ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
      : 0
    
    // 🛡️ WAVE 994: SIEMPRE enviar override (nunca soltar el micro)
    output.zoneOverrides!['movers'] = {
      dimmer: moverDimmer,  // Puede ser 0 (darkness) o >0 (flash)
      // 🚫 NO COLOR - Transparente a rueda mecánica (física decide)
      blendMode: 'replace' as const,  // 🌧️ WAVE 987: max→replace (cortar bombo)
      // NO movement override - VMM takes control
    }═
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
    durationMs: 4000, // 🔪 WAVE 976: 6s → 4s (más dinámico)
    flickerProbability: 0.03, // � WAVE 986.1: 20% → 3% (de metralleta a lluvia)
    minIntensity: 0.35, // 🛡️ WAVE 984: 0.1 → 0.35 (BOOST - era invisible)
    maxIntensity: 0.70, // 🛡️ WAVE 984: 0.3 → 0.70 (BOOST para compensar movers)
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
        this.priority = 90; // 🔪 WAVE 976: High priority (era 70)
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
        // 🛡️ WAVE 994: THE HOLDING PATTERN - Nunca suelta el control
        // ═════════════════════════════════════════════════════════════════════
        const parZones = ['front', 'pars', 'back'];
        parZones.forEach(zone => {
            const dimmerValue = Math.random() < this.config.flickerProbability
                ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
                : 0;
            // 🛡️ WAVE 994: SIEMPRE enviar override, incluso si es dimmer=0
            // LA REGLA DE ORO DEL TECHNO:
            // "Si eres un efecto Global, tú eres el dueño del universo hasta que termines.
            //  Si quieres negro, PINTA NEGRO. No dejes el lienzo en blanco."
            if (dimmerValue > 0) {
                // FLASH: Color visible (CYAN o LIME)
                const useCyan = Math.random() > 0.5;
                const color = useCyan
                    ? { h: 180, s: 100, l: 50 } // CYAN
                    : { h: 120, s: 100, l: 50 }; // LIME
                output.zoneOverrides[zone] = {
                    dimmer: dimmerValue,
                    color: color,
                    blendMode: 'replace', // 🌧️ WAVE 987: max→replace (cortar bombo)
                };
            }
            else {
                // DARKNESS: Blackout explícito para matar physics
                output.zoneOverrides[zone] = {
                    dimmer: 0, // 🛡️ WAVE 994: Darkness explícita (no soltar el micro)
                    blendMode: 'replace',
                };
            }
        });
        // ═════════════════════════════════════════════════════════════════════
        // 🔓 WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR
        // El HAL traduce Cyan/Lime → Color Wheel DMX automáticamente
        // ═════════════════════════════════════════════════════════════════════
        const moverDimmer = Math.random() < this.config.flickerProbability
            ? this.config.minIntensity + Math.random() * (this.config.maxIntensity - this.config.minIntensity)
            : 0;
        if (moverDimmer > 0) {
            // 🔓 FREEDOM: Elegir color aleatorio (cyan o lime) para los movers también
            const useCyan = Math.random() > 0.5;
            const moverColor = useCyan
                ? { h: 180, s: 100, l: 50 } // CYAN
                : { h: 120, s: 100, l: 50 }; // LIME
            output.zoneOverrides['movers'] = {
                color: moverColor, // 🔓 ¡LIBERTAD! Cyan/Lime para movers
                dimmer: moverDimmer,
                blendMode: 'replace',
            };
        }
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
