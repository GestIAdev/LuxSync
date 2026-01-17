/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 SALSA FIRE - FUEGO DE PASIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 *
 * CONCEPTO:
 * Ráfagas de rojo/naranja que simulan llamas bailando con la música.
 * Es fuego ORGÁNICO - no mecánico. Como las llamas reales, tiene variación.
 *
 * COMPORTAMIENTO:
 * - Flicker rápido pero suave (no strobe harsh)
 * - Colores: rojo profundo → naranja → amarillo → back
 * - Intensidad varía de forma "caótica controlada"
 * - El fuego "respira" - nunca es constante
 *
 * PHYSICS:
 * - Base intensity + random variation (Perlin-like noise)
 * - Color shifts based on intensity (más brillo = más amarillo)
 * - Duración corta pero impactante
 *
 * PERFECT FOR:
 * - Momentos sensuales
 * - Cuando la música tiene "sabor"
 * - Solos de instrumentos
 * - Transiciones dramáticas
 *
 * @module core/effects/library/SalsaFire
 * @version WAVE 692
 */
import { BaseEffect } from '../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 2500,
    flickerFrequency: 12, // 12 Hz - fuego natural
    intensityVariation: 0.35,
    baseColor: { h: 10, s: 100, l: 45 }, // Rojo profundo
    hotColor: { h: 50, s: 100, l: 70 }, // Amarillo cálido
    minIntensity: 0.4,
    fadeInMs: 200,
    fadeOutMs: 400,
};
// ═══════════════════════════════════════════════════════════════════════════
// SALSA FIRE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class SalsaFire extends BaseEffect {
    constructor(config) {
        super('salsa_fire');
        this.effectType = 'salsa_fire';
        this.name = 'Salsa Fire';
        this.category = 'physical';
        this.priority = 72; // Entre strobe y ambient
        this.currentIntensity = 0;
        this.noisePhase = 0; // Para el flicker pseudo-random
        this.noiseSpeed = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = { ...this.config.baseColor };
    }
    trigger(config) {
        super.trigger(config);
        // Seed único para este disparo
        this.noisePhase = Date.now() % 1000;
        this.noiseSpeed = this.config.flickerFrequency * 2 * Math.PI / 1000;
        console.log(`[SalsaFire 🔥] TRIGGERED! Duration=${this.config.durationMs}ms Flicker=${this.config.flickerFrequency}Hz`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.noisePhase += deltaMs * this.noiseSpeed;
        // Check if finished
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[SalsaFire 🔥] Completed (${this.elapsedMs}ms)`);
            return;
        }
        // Calculate envelope (fade in/out)
        const envelope = this.calculateEnvelope();
        // Calculate flicker intensity using multiple sine waves (pseudo-Perlin)
        const flicker = this.calculateFlicker();
        // Final intensity
        const baseIntensity = this.config.minIntensity +
            (1 - this.config.minIntensity) * flicker;
        this.currentIntensity = baseIntensity * envelope * this.triggerIntensity;
        // Update color based on intensity (hotter = more yellow)
        this.updateColor();
    }
    calculateEnvelope() {
        const { fadeInMs, fadeOutMs, durationMs } = this.config;
        // Fade in
        if (this.elapsedMs < fadeInMs) {
            return this.elapsedMs / fadeInMs;
        }
        // Fade out
        const fadeOutStart = durationMs - fadeOutMs;
        if (this.elapsedMs > fadeOutStart) {
            return 1 - (this.elapsedMs - fadeOutStart) / fadeOutMs;
        }
        // Sustain
        return 1;
    }
    calculateFlicker() {
        // Múltiples ondas sinusoidales con frecuencias diferentes
        // Esto crea un patrón de "ruido" más orgánico que random
        const wave1 = Math.sin(this.noisePhase) * 0.5;
        const wave2 = Math.sin(this.noisePhase * 2.3) * 0.3; // Frecuencia irracional
        const wave3 = Math.sin(this.noisePhase * 0.7) * 0.2;
        // Combinar y normalizar a 0-1
        const combined = (wave1 + wave2 + wave3 + 1) / 2;
        // Aplicar variación
        const variation = this.config.intensityVariation;
        return (1 - variation) + (combined * variation * 2);
    }
    updateColor() {
        const { baseColor, hotColor } = this.config;
        // Interpolar entre base (rojo) y hot (amarillo) según intensidad
        const hotFactor = Math.pow(this.currentIntensity, 2); // Cuadrático para que el amarillo solo aparezca en picos
        this.currentColor = {
            h: baseColor.h + (hotColor.h - baseColor.h) * hotFactor,
            s: baseColor.s,
            l: baseColor.l + (hotColor.l - baseColor.l) * hotFactor,
        };
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.config.durationMs,
            zones: ['all'],
            intensity: this.currentIntensity,
            dimmerOverride: this.currentIntensity,
            colorOverride: this.currentColor,
            globalOverride: true, // 🔥 CLAVE: Funciona con arquitectura actual
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createSalsaFire(config) {
    return new SalsaFire(config);
}
