/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ INDUSTRIAL STROBE - THE HAMMER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔪 WAVE 770: TECHNO PHYSICS KERNEL
 *
 * FILOSOFÍA:
 * El strobe industrial es el martillo que golpea el acero.
 * No pregunta. No espera. Solo EJECUTA.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - ignora física, toma control total)
 * - Reactivo a context.spectral.harshness (acid lines)
 * - Reactivo a context.spectral.flatness (noise/CO2)
 * - Pre-ducking: 50ms de negro antes del flash (contraste)
 * - Duración: 30-50ms por flash
 *
 * SAFETY:
 * - Anti-epilepsia: máximo 10Hz
 * - Cooldown mínimo: 100ms entre ráfagas
 *
 * COLORES:
 * - Normal: Blanco puro (0,0,100)
 * - Acid mode: Cyan tóxico (180,100,70)
 * - Noise mode: Magenta industrial (300,100,75)
 *
 * @module core/effects/library/techno/IndustrialStrobe
 * @version WAVE 770 - THE HAMMER
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    flashCount: 3, // 3 flashes por ráfaga
    flashDurationMs: 35, // 35ms por flash (corto y brutal)
    gapDurationMs: 65, // 65ms entre flashes (100ms ciclo = 10Hz max)
    preDuckMs: 50, // 50ms de negro antes del primer flash
    maxFrequencyHz: 10, // Máximo 10 Hz (seguro para epilepsia)
    cooldownMs: 150, // 150ms entre ráfagas
    harshnessThreshold: 0.6, // Umbral para modo ácido
    flatnessThreshold: 0.7, // Umbral para modo noise
    fadeInMs: 0, // 🌊 WAVE 1090: TECHNO = Ataque instantáneo
    fadeOutMs: 100, // 🌊 WAVE 1090: Salida muy corta (efecto corto)
};
// ═══════════════════════════════════════════════════════════════════════════
// 🔪 INDUSTRIAL STROBE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class IndustrialStrobe extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('industrial_strobe');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'industrial_strobe';
        this.name = 'Industrial Strobe';
        this.category = 'physical';
        this.priority = 95; // MÁXIMA - el martillo no se detiene
        this.mixBus = 'global'; // 🚂 DICTADOR - toma control total
        this.currentFlash = 0;
        this.isFlashOn = false;
        this.isPreDucking = false;
        this.phaseTimer = 0;
        this.totalDurationMs = 0;
        // Spectral modes (detectados del contexto)
        this.acidMode = false;
        this.noiseMode = false;
        // Color calculado
        this.calculatedColor = { h: 0, s: 0, l: 100 };
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateTotalDuration();
    }
    calculateTotalDuration() {
        // Pre-duck + flashes + gaps
        this.totalDurationMs = this.config.preDuckMs +
            this.config.flashCount * this.config.flashDurationMs +
            (this.config.flashCount - 1) * this.config.gapDurationMs;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // IndustrialStrobe es GLOBAL - afecta todo el escenario
        this.zones = ['front', 'back', 'all-movers', 'all-pars'];
        // Reset state
        this.currentFlash = 0;
        this.isFlashOn = false;
        this.isPreDucking = true; // Empezar con pre-duck
        this.phaseTimer = 0;
        // 🔪 Detectar modos espectrales del contexto
        this.detectSpectralModes(config);
        // 🔪 Calcular color según modo
        this.calculateFlashColor();
        console.log(`[IndustrialStrobe ⚡] TRIGGERED! Flashes=${this.config.flashCount} AcidMode=${this.acidMode} NoiseMode=${this.noiseMode} Color=hsl(${this.calculatedColor.h},${this.calculatedColor.s}%,${this.calculatedColor.l}%)`);
    }
    /**
     * 🔪 Detectar modos espectrales del contexto musical
     */
    detectSpectralModes(config) {
        // Por ahora usamos valores mock si no hay contexto
        // En producción vendrán de context.spectral.harshness/flatness
        const harshness = config.harshness ?? 0;
        const flatness = config.flatness ?? 0;
        this.acidMode = harshness > this.config.harshnessThreshold;
        this.noiseMode = flatness > this.config.flatnessThreshold;
    }
    /**
     * 🔪 Calcular color del flash según modo espectral
     */
    calculateFlashColor() {
        if (this.acidMode) {
            // 🧪 ACID MODE: Cyan tóxico
            this.calculatedColor = { h: 180, s: 100, l: 70 };
        }
        else if (this.noiseMode) {
            // 📻 NOISE MODE: Magenta industrial
            this.calculatedColor = { h: 300, s: 100, l: 75 };
        }
        else {
            // ⚪ NORMAL: Blanco puro
            this.calculatedColor = { h: 0, s: 0, l: 100 };
        }
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.phaseTimer += deltaMs;
        // 🔪 FASE 1: Pre-ducking (negro antes del flash)
        if (this.isPreDucking) {
            if (this.phaseTimer >= this.config.preDuckMs) {
                this.isPreDucking = false;
                this.isFlashOn = true;
                this.phaseTimer = 0;
            }
            return;
        }
        // 🔪 FASE 2: Flash/Gap alternante
        if (this.isFlashOn) {
            // Estamos en un flash
            if (this.phaseTimer >= this.config.flashDurationMs) {
                this.isFlashOn = false;
                this.phaseTimer = 0;
                this.currentFlash++;
                // ¿Terminamos todos los flashes?
                if (this.currentFlash >= this.config.flashCount) {
                    this.phase = 'finished';
                    console.log(`[IndustrialStrobe ⚡] FINISHED (${this.elapsedMs}ms)`);
                    return;
                }
            }
        }
        else {
            // Estamos en un gap
            if (this.phaseTimer >= this.config.gapDurationMs) {
                this.isFlashOn = true;
                this.phaseTimer = 0;
            }
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = Math.min(1, this.elapsedMs / this.totalDurationMs);
        // 🌊 WAVE 1090: FLUID DYNAMICS - Calcular fadeOpacity
        let fadeOpacity = 1.0;
        const fadeOutStart = this.totalDurationMs - this.config.fadeOutMs;
        if (this.config.fadeInMs > 0 && this.elapsedMs < this.config.fadeInMs) {
            fadeOpacity = (this.elapsedMs / this.config.fadeInMs) ** 1.5;
        }
        else if (this.config.fadeOutMs > 0 && this.elapsedMs > fadeOutStart) {
            fadeOpacity = ((this.totalDurationMs - this.elapsedMs) / this.config.fadeOutMs) ** 1.5;
        }
        // 🔪 Durante pre-duck: NEGRO TOTAL (el contraste hace el efecto)
        if (this.isPreDucking) {
            return {
                effectId: this.id,
                category: this.category,
                phase: this.phase,
                progress,
                dimmerOverride: 0,
                colorOverride: { h: 0, s: 0, l: 0 }, // Negro
                intensity: 0,
                zones: this.zones,
                globalComposition: fadeOpacity // 🌊 WAVE 1090
            };
        }
        // 🔪 Durante flash: COLOR A FULL
        if (this.isFlashOn) {
            return {
                effectId: this.id,
                category: this.category,
                phase: this.phase,
                progress,
                dimmerOverride: 1.0,
                colorOverride: this.calculatedColor,
                intensity: 1.0, // FULL
                zones: this.zones,
                globalComposition: fadeOpacity // 🌊 WAVE 1090
            };
        }
        // 🔪 Durante gap: NEGRO (crea el contraste)
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            dimmerOverride: 0,
            colorOverride: { h: 0, s: 0, l: 0 }, // Negro
            intensity: 0,
            zones: this.zones,
            globalComposition: fadeOpacity // 🌊 WAVE 1090
        };
    }
    getPhase() {
        return this.phase;
    }
    isFinished() {
        return this.phase === 'finished';
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default IndustrialStrobe;
