/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 SALSA FIRE - FUEGO DE PASIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 692: FIESTA LATINA EFFECT ARSENAL
 * WAVE 1004.4: THE LATINO LADDER - INTENSE ZONE (75-90%)
 *              + PRE-BLACKOUT PATTERN (50ms antes de cada pico)
 *
 * CONCEPTO:
 * Ráfagas de rojo/naranja que simulan llamas bailando con la música.
 * Es fuego ORGÁNICO - no mecánico. Como las llamas reales, tiene variación.
 *
 * DNA TARGET (WAVE 1004.4):
 * - Aggression: 0.82 (INTENSE - FUEGO QUE QUEMA)
 * - Chaos: 0.55 (Caótico como llamas vivas)
 * - Organicity: 0.60 (Pasional pero intenso)
 *
 * COMPORTAMIENTO:
 * - Flicker rápido pero suave (no strobe harsh)
 * - Colores: rojo profundo → naranja → amarillo → back
 * - Intensidad varía de forma "caótica controlada"
 * - El fuego "respira" - nunca es constante
 * - 🆕 PRE-BLACKOUT: 50ms de negrura antes de cada pico de intensidad
 *
 * PHYSICS:
 * - Base intensity + random variation (Perlin-like noise)
 * - Color shifts based on intensity (más brillo = más amarillo)
 * - Duración corta pero impactante
 *
 * PERFECT FOR:
 * - Momentos sensuales INTENSOS
 * - Cuando la música QUEMA
 * - Solos de instrumentos
 * - Transiciones dramáticas
 *
 * @module core/effects/library/SalsaFire
 * @version WAVE 692, 1004.4
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 2000,
    flickerFrequency: 15, // 🆙 12→15 Hz - fuego más intenso
    intensityVariation: 0.45, // 🆙 0.35→0.45 - más variación
    baseColor: { h: 5, s: 100, l: 50 }, // 🆙 Rojo más profundo (10→5)
    hotColor: { h: 55, s: 100, l: 75 }, // 🆙 Amarillo más brillante
    minIntensity: 0.35, // 🆙 0.4→0.35 - más contraste
    fadeInMs: 150, // 🆙 200→150 - entrada más rápida
    fadeOutMs: 350, // 🆙 400→350 - salida más rápida
    preBlackoutMs: 50, // 🆕 WAVE 1004.4: 50ms de negrura antes de pico
    peakThreshold: 0.75, // 🆕 WAVE 1004.4: Detectar picos > 75%
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
        this.priority = 80; // 🆙 72→80 - INTENSE ZONE
        this.mixBus = 'htp'; // 🌪️ WAVE 805: HTP - Fuego que suma energía
        this.currentIntensity = 0;
        this.noisePhase = 0; // Para el flicker pseudo-random
        this.noiseSpeed = 0;
        // 🆕 WAVE 1004.4: Pre-blackout state
        this.lastFlickerValue = 0;
        this.preBlackoutTimer = 0;
        this.isInPreBlackout = false;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = { ...this.config.baseColor };
    }
    trigger(config) {
        super.trigger(config);
        // Seed único para este disparo
        this.noisePhase = Date.now() % 1000;
        this.noiseSpeed = this.config.flickerFrequency * 2 * Math.PI / 1000;
        // 🆕 WAVE 1004.4: Reset pre-blackout state
        this.lastFlickerValue = 0;
        this.preBlackoutTimer = 0;
        this.isInPreBlackout = false;
        console.log(`[SalsaFire 🔥] INTENSE ZONE TRIGGERED! Duration=${this.config.durationMs}ms Flicker=${this.config.flickerFrequency}Hz`);
        console.log(`[SalsaFire 🔥] DNA: A=0.82 C=0.55 O=0.60 (FUEGO QUE QUEMA)`);
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
        // 🆕 WAVE 1004.4: PRE-BLACKOUT DETECTION
        // Si el flicker cruza hacia arriba del threshold, activar pre-blackout
        if (!this.isInPreBlackout &&
            this.lastFlickerValue < this.config.peakThreshold &&
            flicker >= this.config.peakThreshold) {
            this.isInPreBlackout = true;
            this.preBlackoutTimer = 0;
        }
        // Actualizar timer de pre-blackout
        if (this.isInPreBlackout) {
            this.preBlackoutTimer += deltaMs;
            if (this.preBlackoutTimer >= this.config.preBlackoutMs) {
                this.isInPreBlackout = false;
            }
        }
        this.lastFlickerValue = flicker;
        // Final intensity (con pre-blackout override)
        let baseIntensity = this.config.minIntensity +
            (1 - this.config.minIntensity) * flicker;
        // 🆕 WAVE 1004.4: Durante pre-blackout, forzar negrura
        if (this.isInPreBlackout) {
            baseIntensity = 0;
        }
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
        // � WAVE 1009: FREEDOM DAY - TODOS reciben color
        // El HAL traduce Rojo/Naranja → DMX 120 en EL-1140
        const zoneOverrides = {
            'front': {
                color: this.currentColor,
                dimmer: this.currentIntensity,
                blendMode: 'max',
            },
            'back': {
                color: this.currentColor,
                dimmer: this.currentIntensity * 0.8, // Back un poco más suave
                blendMode: 'max',
            },
            // � WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR
            'movers': {
                color: this.currentColor, // 🔓 ¡LIBERTAD! Rojo fuego para movers
                dimmer: this.currentIntensity * 0.6, // Movers más sutiles que PARs
                blendMode: 'max',
            },
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.config.durationMs,
            zones: Object.keys(zoneOverrides),
            intensity: this.currentIntensity,
            // 🚨 WAVE 1004.2: Eliminado dimmerOverride/colorOverride globales
            dimmerOverride: undefined,
            colorOverride: undefined,
            zoneOverrides,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createSalsaFire(config) {
    return new SalsaFire(config);
}
