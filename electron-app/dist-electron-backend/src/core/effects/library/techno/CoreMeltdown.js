/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☢️ CORE MELTDOWN - LA BESTIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔧 WAVE 988: THE FINAL ARSENAL
 *
 * FILOSOFÍA:
 * El arma nuclear del arsenal. Strobe Magenta/Blanco al límite de seguridad.
 * Diseñado para testear el override system al máximo. CAOS TOTAL.
 *
 * ⚠️ ADVERTENCIA: Este efecto está diseñado para momentos PEAK/EPIC únicamente.
 * Úsese con extrema precaución. Puede causar fatiga visual si se abusa.
 *
 * ZONA TARGET: PEAK / EPIC ONLY (E > 0.85, zScore > 3.0)
 * Solo cuando la música EXPLOTA.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR ABSOLUTO - override total)
 * - TODOS los canales a valores EXTREMOS
 * - Strobe rate: 12-15 Hz (límite de seguridad)
 * - Colores: Magenta nuclear → Blanco cegador (alternando)
 * - blendMode: 'replace' en TODAS las zonas (test de override)
 *
 * ADN:
 * - Aggression: 1.00 (MÁXIMA - La Bestia)
 * - Chaos: 1.00 (MÁXIMO - Impredecible)
 * - Organicity: 0.00 (100% máquina apocalíptica)
 *
 * DURACIÓN: 800ms (SHORT) - Exento de THE MOVER LAW
 *
 * @module core/effects/library/techno/CoreMeltdown
 * @version WAVE 988 - THE FINAL ARSENAL
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    // 🔨 WAVE 2202: VISUAL REPOWER
    // Era: 800ms, 12Hz, fadeOut 300ms (37% del tiempo en fade = efecto castrado)
    // Ahora: 1200ms (La Bestia necesita espacio), 14Hz (más violento), fadeOut 150ms (solo 12%)
    durationMs: 1200, // 1200ms — La Bestia necesita tiempo para devastar
    strobeRateHz: 14, // 14 Hz — Dentro del límite 15Hz, MUCHO más brutal
    maxIntensity: 1.0, // 100% - SIN PIEDAD
    fadeInMs: 0, // 🌊 WAVE 1090: TECHNO = Ataque instantáneo
    fadeOutMs: 150, // 🌊 WAVE 2202: 300→150ms. Era el 37% del efecto. Reducido al 12%.
};
// ═══════════════════════════════════════════════════════════════════════════
// COLORES NUCLEARES
// ═══════════════════════════════════════════════════════════════════════════
const COLORS = {
    // Magenta nuclear - El color de la radiación
    nuclearMagenta: { h: 300, s: 100, l: 60 },
    // Blanco cegador - Puro como el sol
    blindingWhite: { h: 0, s: 0, l: 100 },
    // Negro absoluto - El vacío entre flashes
    absoluteBlack: { h: 0, s: 0, l: 0 },
};
// TODAS las zonas - La Bestia no perdona a nadie
const ALL_ZONES = ['front', 'all-pars', 'back', 'all-movers', 'movers-left', 'movers-right'];
// ═══════════════════════════════════════════════════════════════════════════
// ☢️ CORE MELTDOWN CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class CoreMeltdown extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('core_meltdown');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'core_meltdown';
        this.name = 'Core Meltdown';
        this.category = 'physical';
        this.priority = 100; // MÁXIMA PRIORIDAD - LA BESTIA DOMINA TODO
        this.mixBus = 'global'; // ☢️ DICTADOR ABSOLUTO
        this.isOneShot = true; // 🎯 WAVE 2067: Meltdown único — NO re-trigger
        // ─────────────────────────────────────────────────────────────────────────
        // Internal state
        // ─────────────────────────────────────────────────────────────────────────
        this.config = DEFAULT_CONFIG;
        this.strobeState = false;
        this.strobeAccumulator = 0; // 🔧 WAVE 2493: replaces lastStrobeToggle
        this.useWhiteFlash = false;
        if (config) {
            this.config = { ...DEFAULT_CONFIG, ...config };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        this.strobeState = true; // Empezar encendido
        this.strobeAccumulator = 0; // 🔧 WAVE 2493: reset accumulator
        // 🔥 WAVE 2202: Restaurar devastación visual. 
        // WAVE 998.1 había castrado esto a siempre-magenta. 
        // La Bestia alterna: primera ON = magenta (impacto), luego blanco, luego magenta...
        // El blanco aparece en cada 2º ciclo ON — perceptualmente diferente de magenta
        // porque el ojo humano procesa el blanco como "más caliente"/más agresivo
        this.useWhiteFlash = false; // Primer flash: magenta. Luego alterna libremente.
        console.log(`[☢️ CORE_MELTDOWN] ⚠️ LA BESTIA DESPIERTA! Rate=${this.config.strobeRateHz}Hz`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // ¿Terminó?
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[☢️ CORE_MELTDOWN] La Bestia duerme...`);
            return;
        }
        // 🔧 WAVE 2493: FRAME-GUARANTEED STROBE TOGGLE
        // At 14Hz the half-period is 35ms — shorter than a frame (40-55ms).
        // The old code compared elapsed vs lastStrobeToggle, missing toggles
        // that fit entirely inside one frame interval.
        // FIX: Accumulate delta in strobeAccumulator, consume full half-cycles.
        const halfPeriod = 500 / this.config.strobeRateHz;
        this.strobeAccumulator += deltaMs;
        while (this.strobeAccumulator >= halfPeriod) {
            this.strobeAccumulator -= halfPeriod;
            this.strobeState = !this.strobeState;
            // Alternar color cada 2 flashes (only on ON transitions)
            if (this.strobeState) {
                this.useWhiteFlash = !this.useWhiteFlash;
            }
        }
        // Phase siempre en attack (es todo explosión)
        this.phase = 'attack';
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // 🌊 WAVE 1090: FLUID DYNAMICS - Fade calculation
        let fadeOpacity = 1.0;
        const fadeOutStart = this.config.durationMs - this.config.fadeOutMs;
        if (this.config.fadeInMs > 0 && this.elapsedMs < this.config.fadeInMs) {
            fadeOpacity = (this.elapsedMs / this.config.fadeInMs) ** 1.5;
        }
        else if (this.config.fadeOutMs > 0 && this.elapsedMs > fadeOutStart) {
            fadeOpacity = ((this.config.durationMs - this.elapsedMs) / this.config.fadeOutMs) ** 1.5;
        }
        // ═════════════════════════════════════════════════════════════════════
        // NUCLEAR STROBE: ON/OFF binario, sin fades
        // ═════════════════════════════════════════════════════════════════════
        // Determinar color actual
        const currentColor = this.strobeState
            ? (this.useWhiteFlash ? COLORS.blindingWhite : COLORS.nuclearMagenta)
            : COLORS.absoluteBlack;
        // Intensidad: 100% cuando ON, 0% cuando OFF (binario puro)
        const intensity = this.strobeState ? this.config.maxIntensity : 0;
        // ═════════════════════════════════════════════════════════════════════
        // ZONE OVERRIDES: TODAS LAS ZONAS CON blendMode='replace'
        // TEST DE OVERRIDE MÁXIMO
        // ═════════════════════════════════════════════════════════════════════
        const zoneOverrides = {};
        for (const zone of ALL_ZONES) {
            zoneOverrides[zone] = {
                dimmer: intensity * this.triggerIntensity,
                color: currentColor,
                blendMode: 'replace', // ☢️ OVERRIDE ABSOLUTO
            };
        }
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ALL_ZONES,
            intensity: intensity * this.triggerIntensity,
            dimmerOverride: intensity * this.triggerIntensity, // ☢️ OVERRIDE DIRECTO
            colorOverride: currentColor,
            globalComposition: fadeOpacity, // 🌊 WAVE 1090: Fluid Dynamics
            strobeRate: this.config.strobeRateHz,
            zoneOverrides,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Debug
    // ─────────────────────────────────────────────────────────────────────────
    getDebugState() {
        return {
            effectType: this.effectType,
            phase: this.phase,
            elapsedMs: this.elapsedMs,
            durationMs: this.config.durationMs,
            strobeState: this.strobeState ? 'ON ☢️' : 'OFF',
            currentColor: this.useWhiteFlash ? 'WHITE' : 'MAGENTA',
            strobeRateHz: this.config.strobeRateHz,
        };
    }
}
// Default export para compatibilidad
export default CoreMeltdown;
