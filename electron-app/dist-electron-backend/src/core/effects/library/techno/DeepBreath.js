/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🫁 DEEP BREATH - RESPIRACIÓN PROFUNDA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (Radwulf)
 *
 * FILOSOFÍA:
 * Darle pulmones a la pista de baile. Orgánico y biomecánico.
 * Respiración lenta y profunda (4 compases completos).
 *
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - respira con la física)
 * - Sincronización: 4 compases (16 beats) - MUY LENTO
 * - Compás 1-2 (Inhalar): 0% → 60% + Movers se abren (Tilt Up + Pan Out)
 * - Compás 3-4 (Exhalar): 60% → 0% + Movers se cierran (Tilt Down + Pan In)
 * - Usa sine wave basado en tiempo del sistema (continuo, no golpes)
 *
 * COLORES:
 * - DEEP BLUE (#0033aa) o UV PURPLE (#6600ff)
 * - Transición suave durante la respiración
 *
 * ZONAS:
 * - Perfecto para valley, breakdown, silence
 * - Ideal para momentos tensos antes del drop
 *
 * @module core/effects/library/techno/DeepBreath
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (Radwulf)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    breathCycleMs: 2500, // 3 segundos por ciclo (was 8s) - WAVE 964
    breathCount: 2, // 2 respiraciones completas → 6s total
    peakIntensity: 0.6, // 60% máximo
    bpmSync: true,
    beatsPerCycle: 16, // 4 compases = 16 beats
    movementAmplitude: 60, // ±60° de movimiento
};
// ═══════════════════════════════════════════════════════════════════════════
// DEEP BREATH EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class DeepBreath extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('deep_breath');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'deep_breath';
        this.name = 'Deep Breath';
        this.category = 'physical';
        this.priority = 65; // Media - WAVE 964: Subida de 45 a 65
        this.mixBus = 'global'; // WAVE 964: HTP→GLOBAL para visibilidad
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.totalDurationMs = this.config.breathCycleMs * this.config.breathCount;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        console.log(`[DeepBreath 🫁] TRIGGERED! Cycles=${this.config.breathCount} CycleMs=${this.config.breathCycleMs}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Check si terminó
        if (this.elapsedMs >= this.totalDurationMs) {
            this.phase = 'finished';
            console.log(`[DeepBreath 🫁] FINISHED (${this.config.breathCount} cycles)`);
        }
    }
    /**
     * 📤 GET OUTPUT - Devuelve el output del frame actual
     * 🫁 WAVE 938: DEEP BREATH - Respiración orgánica
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.totalDurationMs;
        // ═════════════════════════════════════════════════════════════════════
        // SINE WAVE: Respiración continua
        // ═════════════════════════════════════════════════════════════════════
        const cycleProgress = (this.elapsedMs % this.config.breathCycleMs) / this.config.breathCycleMs;
        const sinePhase = cycleProgress * 2 * Math.PI;
        // Sine wave: 0 → 1 → 0 (inhale → peak → exhale)
        const breathIntensity = (Math.sin(sinePhase - Math.PI / 2) + 1) / 2;
        const dimmer = breathIntensity * this.config.peakIntensity;
        // Color: transición DEEP BLUE ↔ UV PURPLE durante respiración
        const hue = 220 + breathIntensity * 60; // 220 (blue) → 280 (purple)
        const color = { h: hue, s: 100, l: 40 };
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['front', 'all-pars', 'back', 'all-movers'],
            intensity: this.triggerIntensity * breathIntensity,
            zoneOverrides: {},
        };
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Dimmer sincronizado con respiración
        // ═════════════════════════════════════════════════════════════════════
        const parZones = ['front', 'all-pars', 'back'];
        parZones.forEach(zone => {
            output.zoneOverrides[zone] = {
                dimmer,
                color,
                blendMode: 'max',
            };
        });
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Movimiento orgánico (abrir/cerrar)
        // 🛡️ WAVE 984: THE MOVER LAW - Solo dimmer + movement, SIN COLOR
        // ═════════════════════════════════════════════════════════════════════
        // 🚨 WAVE 2690: pan/tilt movement PURGED — Selene no conduce posiciones
        output.zoneOverrides['all-movers'] = {
            dimmer,
            // 🚭 NO COLOR - Transparente a rueda mecánica (física decide)
            blendMode: 'max',
            // 🚨 WAVE 2690: movement PURGED
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        console.log(`[DeepBreath 🫁] Aborted`);
    }
}
