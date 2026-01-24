/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💥 SEISMIC SNAP - GOLPE FÍSICO DE LUZ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔪 WAVE 986: ACTIVE REINFORCEMENTS
 * Obturador de cámara gigante. El "snap" que corta el aire.
 *
 * FILOSOFÍA:
 * Como el flash de un fotógrafo con cámara de película.
 * BLACKOUT → SNAP instantáneo → Fade out rápido.
 * El contraste total crea percepción de "golpe físico".
 *
 * ZONA TARGET: ACTIVE / INTENSE (E=0.45-0.82)
 * Para momentos que necesitan IMPACTO puntual.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (OVERRIDE total durante el efecto)
 * - Pattern: 3 fases estrictas
 *   1. BLACKOUT (200ms) - Preparación del golpe
 *   2. SNAP (200ms) - Flash ROJO/BLANCO al 100%
 *   3. FADE (1100ms) - Decay exponencial
 * - Duración total: 1500ms (SHORT - exento de THE MOVER LAW)
 *
 * ⚠️ AXIOMA ANTI-SIMULACIÓN:
 * Timing FIJO. Colores FIJOS. DETERMINISTA al 100%.
 *
 * ADN:
 * - Aggression: 0.70 (Golpe físico)
 * - Chaos: 0.20 (Muy ordenado - SNAP preciso)
 * - Organicity: 0.10 (Casi 100% máquina)
 *
 * THE MOVER LAW: Este efecto es SHORT (1500ms < 2000ms)
 * → PUEDE usar color en movers (exento de MODO FANTASMA)
 *
 * @module core/effects/library/techno/SeismicSnap
 * @version WAVE 986 - ACTIVE REINFORCEMENTS
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    blackoutDurationMs: 200, // 200ms de blackout preparatorio
    snapDurationMs: 200, // 200ms de flash máximo
    fadeDurationMs: 1100, // 1100ms de fade out
};
// Total: 1500ms
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
        return this.config.blackoutDurationMs + this.config.snapDurationMs + this.config.fadeDurationMs;
    }
    get snapStartMs() {
        return this.config.blackoutDurationMs;
    }
    get fadeStartMs() {
        return this.config.blackoutDurationMs + this.config.snapDurationMs;
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
        // 🎨 SELECCIÓN DETERMINISTA DE COLOR
        // Alterna entre blanco y rojo basado en segundo del trigger
        const triggerSecond = Math.floor(this.triggerTimestamp / 1000);
        this.useWhiteFlash = triggerSecond % 2 === 0;
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
        else if (this.elapsedMs < this.fadeStartMs) {
            this.currentPhase = 'snap';
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
        switch (this.currentPhase) {
            case 'blackout':
                return this.buildBlackoutOutput(progress);
            case 'snap':
                return this.buildSnapOutput(progress);
            case 'fade':
                return this.buildFadeOutput(progress);
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
    buildBlackoutOutput(progress) {
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: SNAP_ZONES,
            intensity: 0,
            dimmerOverride: 0,
            globalOverride: true,
            zoneOverrides: this.buildZoneOverrides(0, null),
        };
    }
    /**
     * ⚡ FASE 2: SNAP
     * Flash instantáneo al 100%. El golpe propiamente dicho.
     */
    buildSnapOutput(progress) {
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
            globalOverride: true,
            zoneOverrides: this.buildZoneOverrides(1.0, color),
        };
    }
    /**
     * 📉 FASE 3: FADE
     * Decay exponencial. Como la persistencia retiniana del flash.
     */
    buildFadeOutput(progress) {
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
            globalOverride: true,
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
