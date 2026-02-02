/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 SEISMIC SNAP - TERREMOTO VISUAL CONTUNDENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * � WAVE 997.6: SEISMIC RECONSTRUCTION - "De flash rojo a terremoto visual"
 *
 * FILOSOFÍA ACTUALIZADA:
 * NO es un "flash de cámara". Es un TERREMOTO SÍSMICO.
 * Blackout → SNAP CONTUNDENTE → SHAKE (vibración) → Fade out.
 * El impacto físico de un golpe que hace VIBRAR el escenario.
 *
 * ❌ ELIMINADO (WAVE 997.6):
 * - Snap de 200ms (invisible)
 * - Duración total de 1,500ms (demasiado corta)
 * - Concepto "flash de fotógrafo" (poco techno)
 *
 * ✅ NUEVO:
 * - Snap de 400ms (VISIBLE y CONTUNDENTE)
 * - Fase SHAKE de 600ms (vibración post-impacto)
 * - Duración total: 2,500ms (impactante)
 *
 * ZONA TARGET: ACTIVE / INTENSE (E=0.45-0.82)
 * Para momentos que necesitan IMPACTO BRUTAL y VISIBLE.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (OVERRIDE total durante el efecto)
 * - Pattern: 4 fases estrictas
 *   1. BLACKOUT (150ms) - Preparación del golpe
 *   2. SNAP (400ms) - Flash ROJO/BLANCO al 100% SOSTENIDO
 *   3. SHAKE (600ms) - Vibración rápida post-impacto
 *   4. FADE (1350ms) - Decay exponencial
 * - Duración total: 2500ms (MEDIUM - exento de THE MOVER LAW)
 *
 * ⚠️ AXIOMA ANTI-SIMULACIÓN:
 * Timing FIJO. Colores FIJOS. DETERMINISTA al 100%.
 *
 * ADN:
 * - Aggression: 0.80 (Golpe físico brutal)
 * - Chaos: 0.30 (Vibración añade caos controlado)
 * - Organicity: 0.10 (Casi 100% máquina)
 *
 * THE MOVER LAW: Este efecto es MEDIUM (2500ms > 2000ms)
 * → Movers en MODO FANTASMA (solo dimmer, sin color override rápido)
 *
 * @module core/effects/library/techno/SeismicSnap
 * @version WAVE 997.6 - SEISMIC RECONSTRUCTION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    blackoutDurationMs: 150, // 🔥 WAVE 997.6: 150ms (más corto)
    snapDurationMs: 400, // 🔥 WAVE 997.6: 400ms (DOBLE - visible y contundente)
    shakeDurationMs: 600, // 🔥 WAVE 997.6: 600ms (nueva fase - vibración post-impacto)
    fadeDurationMs: 1350, // 🔥 WAVE 997.6: 1350ms (decay más largo)
    shakeFrequencyHz: 10, // 🔥 WAVE 997.6: 10 Hz = 10 vibraciones por segundo
    fadeInMs: 0, // 🌊 WAVE 1090: TECHNO = Ataque instantáneo
    fadeOutMs: 400, // 🌊 WAVE 1090: Fade out en últimos 400ms
};
// Total: 2500ms - WAVE 997.6
// ═══════════════════════════════════════════════════════════════════════════
// COLORES Y ZONAS
// ═══════════════════════════════════════════════════════════════════════════
// Colores: ROJO IMPACTO y BLANCO PURO (alternados por trigger)
const COLORS = {
    impactRed: { h: 0, s: 90, l: 55 }, // Rojo impacto
    pureWhite: { h: 0, s: 0, l: 100 }, // Blanco puro
    warmWhite: { h: 40, s: 30, l: 95 }, // Blanco cálido (flash foto)
};
// Zonas para el efecto
const SNAP_ZONES = ['front', 'pars', 'back', 'movers'];
// ═══════════════════════════════════════════════════════════════════════════
// 💥 SEISMIC SNAP CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class SeismicSnap extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor() {
        super('seismic_snap');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'seismic_snap';
        this.name = 'Seismic Snap';
        this.category = 'physical';
        this.priority = 78; // Alto - este es un efecto de IMPACTO
        this.mixBus = 'global'; // 🎯 OVERRIDE física total
        // ─────────────────────────────────────────────────────────────────────────
        // Internal state
        // ─────────────────────────────────────────────────────────────────────────
        this.config = DEFAULT_CONFIG;
        this.currentPhase = 'blackout';
        this.useWhiteFlash = false;
        this.triggerTimestamp = 0;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Computed durations
    // ─────────────────────────────────────────────────────────────────────────
    get totalDurationMs() {
        return this.config.blackoutDurationMs + this.config.snapDurationMs +
            this.config.shakeDurationMs + this.config.fadeDurationMs;
    }
    get snapStartMs() {
        return this.config.blackoutDurationMs;
    }
    get shakeStartMs() {
        return this.config.blackoutDurationMs + this.config.snapDurationMs;
    }
    get fadeStartMs() {
        return this.config.blackoutDurationMs + this.config.snapDurationMs + this.config.shakeDurationMs;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Trigger: Determinar color del flash (DETERMINISTA)
     */
    trigger(config) {
        super.trigger(config);
        this.triggerTimestamp = Date.now();
        this.currentPhase = 'blackout';
        // 🔥 WAVE 998.1: ALTERNANCIA REAL DETERMINISTA
        // ❌ ANTES: triggerSecond % 2 (múltiples disparos mismo segundo = mismo color)
        // ✅ AHORA: Siempre ROJO (el blanco ya no es bienvenido en techno)
        this.useWhiteFlash = false;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Update loop
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Update: Avanza tiempo y determina fase actual
     */
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // ¿Terminado?
        if (this.elapsedMs >= this.totalDurationMs) {
            this.phase = 'finished';
            return;
        }
        // Determinar fase interna
        if (this.elapsedMs < this.snapStartMs) {
            this.currentPhase = 'blackout';
        }
        else if (this.elapsedMs < this.shakeStartMs) {
            this.currentPhase = 'snap';
        }
        else if (this.elapsedMs < this.fadeStartMs) {
            this.currentPhase = 'shake';
        }
        else {
            this.currentPhase = 'fade';
        }
    }
    /**
     * GetOutput: Genera frame según fase actual
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const elapsed = this.elapsedMs;
        const progress = Math.min(elapsed / this.totalDurationMs, 1);
        // 🌊 WAVE 1090: FLUID DYNAMICS - Calcular fadeOpacity global
        let fadeOpacity = 1.0;
        const fadeOutStart = this.totalDurationMs - this.config.fadeOutMs;
        if (this.config.fadeInMs > 0 && elapsed < this.config.fadeInMs) {
            fadeOpacity = (elapsed / this.config.fadeInMs) ** 1.5;
        }
        else if (this.config.fadeOutMs > 0 && elapsed > fadeOutStart) {
            fadeOpacity = ((this.totalDurationMs - elapsed) / this.config.fadeOutMs) ** 1.5;
        }
        switch (this.currentPhase) {
            case 'blackout':
                return this.buildBlackoutOutput(progress, fadeOpacity);
            case 'snap':
                return this.buildSnapOutput(progress, fadeOpacity);
            case 'shake':
                return this.buildShakeOutput(progress, fadeOpacity);
            case 'fade':
                return this.buildFadeOutput(progress, fadeOpacity);
            default:
                return null;
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output builders por fase
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🖤 FASE 1: BLACKOUT
     * Preparación del golpe. Silencio total antes del SNAP.
     */
    buildBlackoutOutput(progress, fadeOpacity) {
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: SNAP_ZONES,
            intensity: 0,
            dimmerOverride: 0,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090
            zoneOverrides: this.buildZoneOverrides(0, null),
        };
    }
    /**
     * ⚡ FASE 2: SNAP
     * Flash instantáneo al 100% SOSTENIDO. El golpe propiamente dicho.
     * 🔥 WAVE 997.6: Ahora dura 400ms (visible y contundente)
     */
    buildSnapOutput(progress, fadeOpacity) {
        const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: SNAP_ZONES,
            intensity: 1.0,
            dimmerOverride: 1.0,
            colorOverride: color,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090
            zoneOverrides: this.buildZoneOverrides(1.0, color),
        };
    }
    /**
     * 🌀 FASE 3: SHAKE (NUEVA - WAVE 997.6)
     * Vibración rápida post-impacto. Como un terremoto visual.
     * Flicker ON/OFF a 10 Hz (10 vibraciones por segundo)
     */
    buildShakeOutput(progress, fadeOpacity) {
        const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed;
        // Calcular progreso dentro de la fase shake
        const shakeElapsed = this.elapsedMs - this.shakeStartMs;
        const shakeProgress = Math.min(shakeElapsed / this.config.shakeDurationMs, 1);
        // Vibración ON/OFF basada en frecuencia
        const cycleDurationMs = 1000 / this.config.shakeFrequencyHz;
        const cycleProgress = (shakeElapsed % cycleDurationMs) / cycleDurationMs;
        const isOn = cycleProgress < 0.5;
        // Intensidad decae durante la vibración (de 1.0 a 0.4)
        const decayIntensity = 1.0 - (shakeProgress * 0.6);
        const vibrateIntensity = isOn ? decayIntensity : (decayIntensity * 0.3);
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: SNAP_ZONES,
            intensity: vibrateIntensity,
            dimmerOverride: vibrateIntensity,
            colorOverride: color,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090
            zoneOverrides: this.buildZoneOverrides(vibrateIntensity, color),
        };
    }
    /**
     * 📉 FASE 4: FADE
     * Decay exponencial. Como la persistencia retiniana del impacto.
     */
    buildFadeOutput(progress, fadeOpacity) {
        // Calcular progreso dentro de la fase fade
        const fadeElapsed = this.elapsedMs - this.fadeStartMs;
        const fadeProgress = Math.min(fadeElapsed / this.config.fadeDurationMs, 1);
        // Decay exponencial: empieza rápido, termina lento
        // Curva: (1 - t)^2 → al 50% del tiempo ya está al 25%
        const decayIntensity = Math.pow(1 - fadeProgress, 2);
        const color = this.useWhiteFlash ? COLORS.warmWhite : COLORS.impactRed;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: SNAP_ZONES,
            intensity: decayIntensity,
            dimmerOverride: decayIntensity,
            colorOverride: color,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090
            zoneOverrides: this.buildZoneOverrides(decayIntensity, color),
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Zone overrides builder
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Construye zoneOverrides para todas las zonas
     */
    buildZoneOverrides(dimmer, color) {
        const overrides = {};
        for (const zone of SNAP_ZONES) {
            if (color) {
                overrides[zone] = { dimmer, color };
            }
            else {
                overrides[zone] = { dimmer };
            }
        }
        return overrides;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Debug
    // ─────────────────────────────────────────────────────────────────────────
    getDebugState() {
        return {
            effectType: this.effectType,
            phase: this.phase,
            currentPhase: this.currentPhase,
            elapsedMs: this.elapsedMs,
            totalDurationMs: this.totalDurationMs,
            useWhiteFlash: this.useWhiteFlash,
            intensity: this.getOutput()?.intensity ?? 0,
        };
    }
}
// Default export para compatibilidad
export default SeismicSnap;
