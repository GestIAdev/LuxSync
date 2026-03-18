/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SURGICAL STRIKE - THE SCALPEL IN THE DARK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
 * 🔥 WAVE 2183: SEEK & DESTROY UPGRADE
 * ⚰️ WAVE 2214: DEMOTED — No movement. Pure dimmer strobe. No color wheel.
 *
 * FILOSOFÍA:
 * La sala se queda a oscuras. Los cabezales elegidos disparan un estrobo
 * seco via DIMMER PURO — sin mover un milímetro, sin tocar el color wheel.
 * El bisturí no necesita bailar para matar.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — necesita blackout total de PARs)
 * - Duración: 300-400ms (golpe seco, sale rápido)
 * - Pars: Blackout total (0% Dimmer) — la sala en oscuridad
 * - Movers: Escalado dinámico por Z-score, SOLO DIMMER TOGGLE:
 *   - Z < 3.0: 2 cabezales
 *   - Z 3.0-4.0: 4 cabezales
 *   - Z > 4.0: todos
 *   - CERO movimiento Pan/Tilt (regla: strobe de mover = dimmer puro)
 *   - CERO color wheel — blanco puro
 *   - Estrobo via Dimmer toggle a 14Hz
 * - oneShot: true — un solo golpe
 * - TIER: intense (no peak) — deja espacio a IndustrialStrobe
 *
 * @module core/effects/library/techno/SurgicalStrike
 * @version WAVE 2214 — DEMOTED, PURIFIED
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 350, // ⚰️ WAVE 2214: Corto y seco — sale rápido, deja espacio a IndustrialStrobe
    strobeHz: 14, // ⚰️ WAVE 2214: 16→14Hz — más controlado, mismo impacto
};
// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE ESCALADO — Axioma Anti-Simulación (todo determinístico)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Determina la cantidad de cabezales activos según Z-score.
 * Puro determinismo: no Math.random().
 */
function getActiveHeadCount(zScore) {
    if (zScore >= 4.0)
        return 6; // Devastación total
    if (zScore >= 3.0)
        return 4; // Impacto masivo
    return 2; // Bisturí fino (default)
}
// ═══════════════════════════════════════════════════════════════════════════
// SURGICAL STRIKE EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class SurgicalStrike extends BaseEffect {
    constructor(config) {
        super('surgical_strike');
        this.effectType = 'surgical_strike';
        this.name = 'Surgical Strike';
        this.category = 'physical';
        this.priority = 90; // ⚰️ WAVE 2214: 94→90 — por debajo de IndustrialStrobe (95)
        this.mixBus = 'global';
        this.isOneShot = true;
        /** Número de cabezales activos — escalado por Z-score */
        this.activeHeadCount = 2;
        this.targetZone = 'all-movers';
        /** beatPhase almacenado para determinar zona (sin movimiento) */
        this.beatPhaseForZone = 0.5;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.setDuration(this.config.durationMs);
        const beatPhase = triggerConfig.musicalContext?.beatPhase ?? 0.5;
        this.beatPhaseForZone = beatPhase;
        // ═══════════════════════════════════════════════════════════════════════
        // ESCALADO DINÁMICO POR Z-SCORE (Axioma Anti-Simulación)
        // ═══════════════════════════════════════════════════════════════════════
        const effectiveZ = (triggerConfig.intensity - 0.5) * 8; // [0.5→0, 1.0→4.0]
        this.activeHeadCount = getActiveHeadCount(effectiveZ);
        // Zona base según beatPhase
        if (beatPhase < 0.33) {
            this.targetZone = 'movers-left';
        }
        else if (beatPhase < 0.66) {
            this.targetZone = 'movers-right';
        }
        else {
            this.targetZone = 'all-movers';
        }
        // Con 4+ cabezales, siempre ambos lados
        if (this.activeHeadCount >= 4) {
            this.targetZone = 'all-movers';
        }
        console.log(`[SurgicalStrike 🎯] TRIGGERED: heads=${this.activeHeadCount} target=${this.targetZone} ` +
            `strobeHz=${this.config.strobeHz} duration=${this.config.durationMs}ms ` +
            `effectiveZ=${effectiveZ.toFixed(1)} beatPhase=${beatPhase.toFixed(2)} ` +
            `[WAVE 2214: pure-dimmer, no-movement]`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
        else {
            this.phase = 'sustain';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.getProgress();
        // ═════════════════════════════════════════════════════════════════════
        // STROBE TOGGLE: Dimmer alterna entre 0 y 1 a strobeHz
        // ⚰️ WAVE 2214: SOLO DIMMER — sin color wheel, sin movimiento
        // ═════════════════════════════════════════════════════════════════════
        const cycleMs = 1000 / this.config.strobeHz;
        const positionInCycle = this.elapsedMs % cycleMs;
        const isFlashOn = positionInCycle < (cycleMs * 0.4); // 40% duty cycle
        const moverDimmer = isFlashOn ? this.triggerIntensity : 0;
        // ═════════════════════════════════════════════════════════════════════
        // PARS: BLACKOUT TOTAL — la sala a oscuras
        // ═════════════════════════════════════════════════════════════════════
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            dimmerOverride: 0,
            colorOverride: { h: 0, s: 0, l: 0 },
            intensity: moverDimmer,
            zones: ['front', 'all-pars', 'back', 'all-movers'],
            globalComposition: 1.0,
            zoneOverrides: {},
        };
        // Blackout en todas las zonas PAR
        const parZones = ['front', 'all-pars', 'back'];
        for (const zone of parZones) {
            output.zoneOverrides[zone] = {
                color: { h: 0, s: 0, l: 0 },
                dimmer: 0,
                blendMode: 'max',
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Estrobo PURO via dimmer — sin Pan/Tilt, sin color wheel
        // Blanco puro (h:0 s:0 l:100) + dimmer toggle
        // ⚰️ WAVE 2214: El bisturí no necesita bailar para matar
        // ═════════════════════════════════════════════════════════════════════
        const whiteColor = { h: 0, s: 0, l: 100 };
        const moverOverride = this.getMoverColorOverride(whiteColor, moverDimmer);
        if (this.targetZone === 'all-movers' || this.activeHeadCount >= 4) {
            output.zoneOverrides['movers-left'] = this.getMoverColorOverride(whiteColor, moverDimmer);
            output.zoneOverrides['movers-right'] = this.getMoverColorOverride(whiteColor, moverDimmer);
        }
        else if (this.targetZone === 'movers-left') {
            output.zoneOverrides['movers-left'] = moverOverride;
            output.zoneOverrides['movers-right'] = this.getMoverColorOverride(whiteColor, 0);
        }
        else {
            output.zoneOverrides['movers-right'] = moverOverride;
            output.zoneOverrides['movers-left'] = this.getMoverColorOverride(whiteColor, 0);
        }
        return output;
    }
}
