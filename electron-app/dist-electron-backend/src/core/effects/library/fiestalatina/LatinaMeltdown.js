/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔥 LATINA MELTDOWN - NUCLEAR SALSA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🌊 WAVE 1004.3: FASE 3 - DNA EXTREMOS
 *
 * LA BESTIA: Un estrobo sincronizado al KICK que usa paleta latina
 * (Rojo/Amarillo) pero con la AGRESIVIDAD del Techno.
 *
 * DNA TARGET:
 * - Aggression: 0.95 (BRUTAL - máxima agresión)
 * - Chaos: 0.30 (Rítmico - sincronizado al beat)
 * - Organicity: 0.20 (Sintético - mecánico, preciso)
 *
 * FILOSOFÍA:
 * "Cuando la salsa se vuelve nuclear. El fuego latino con
 * la precisión de una máquina de guerra."
 *
 * MECÁNICA:
 * - Estrobo KICK-SYNC (golpea con el bombo)
 * - Colores: Rojo Profundo (10°) → Amarillo Nuclear (55°)
 * - Pre-blackout de 50ms para MÁXIMO contraste
 * - SHORT effect (<2000ms) = PUEDE usar color en movers
 * - Intensidad 100% sin piedad
 *
 * PERFECT FOR:
 * - Drops de reggaetón pesado
 * - Perreo intenso (BPM ~95-100)
 * - Coros de dembow
 * - Finales explosivos
 *
 * @module core/effects/library/fiestalatina/LatinaMeltdown
 * @version WAVE 1004.3
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    hitCount: 6, // 6 golpes nucleares
    flashDurationMs: 80, // 80ms por flash (corto y brutal)
    preBlackoutMs: 50, // 50ms de oscuridad ANTES de cada golpe
    gapMs: 120, // 120ms entre golpes
    maxIntensity: 1.0, // 100% sin piedad
    alternateColors: true, // Rojo → Amarillo → Rojo → Amarillo
};
// Duración total calculada: ~1500ms (SHORT effect - puede usar color en movers)
// (50 + 80 + 120) * 6 = 1500ms
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETA NUCLEAR LATINA
// ═══════════════════════════════════════════════════════════════════════════
const MELTDOWN_PALETTE = {
    // Rojo Profundo - El corazón del fuego
    ROJO_NUCLEAR: { h: 10, s: 100, l: 50 },
    // Amarillo Nuclear - La explosión
    AMARILLO_NUCLEAR: { h: 55, s: 100, l: 55 },
    // Naranja Fundido - Transición
    NARANJA_FUSION: { h: 30, s: 100, l: 52 },
};
// ═══════════════════════════════════════════════════════════════════════════
// 🔥 LATINA MELTDOWN CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class LatinaMeltdown extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('latina_meltdown');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'latina_meltdown';
        this.name = 'Latina Meltdown';
        this.category = 'physical';
        this.priority = 95; // MÁXIMA prioridad (strobe brutal)
        this.mixBus = 'global'; // 🚂 Dictador total
        this.currentHit = 0;
        this.totalDurationMs = 0;
        // Estado de la fase actual dentro de un hit
        this.hitPhase = 'pre-blackout';
        this.hitPhaseTimer = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateTotalDuration();
    }
    calculateTotalDuration() {
        const hitCycleMs = this.config.preBlackoutMs +
            this.config.flashDurationMs +
            this.config.gapMs;
        this.totalDurationMs = hitCycleMs * this.config.hitCount;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // GLOBAL - Afecta TODO el escenario
        this.zones = ['front', 'back', 'movers'];
        // Reset state
        this.currentHit = 0;
        this.hitPhase = 'pre-blackout';
        this.hitPhaseTimer = 0;
        console.log(`[LatinaMeltdown 🔥] NUCLEAR ACTIVATED! Hits=${this.config.hitCount} Duration=${this.totalDurationMs}ms`);
        console.log(`[LatinaMeltdown 🔥] DNA: A=0.95 C=0.30 O=0.20 (BRUTAL/RITMICO/SINTETICO)`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.hitPhaseTimer += deltaMs;
        // Verificar fin del efecto
        if (this.currentHit >= this.config.hitCount) {
            this.phase = 'finished';
            console.log(`[LatinaMeltdown 🔥] MELTDOWN COMPLETE - Nuclear salsa delivered`);
            return;
        }
        // State machine: pre-blackout → flash → gap → next hit
        this.updateHitPhase();
        // Safety timeout
        if (this.elapsedMs > this.totalDurationMs * 1.5) {
            this.phase = 'finished';
        }
    }
    updateHitPhase() {
        switch (this.hitPhase) {
            case 'pre-blackout':
                if (this.hitPhaseTimer >= this.config.preBlackoutMs) {
                    this.hitPhase = 'flash';
                    this.hitPhaseTimer = 0;
                }
                break;
            case 'flash':
                if (this.hitPhaseTimer >= this.config.flashDurationMs) {
                    this.hitPhase = 'gap';
                    this.hitPhaseTimer = 0;
                }
                break;
            case 'gap':
                if (this.hitPhaseTimer >= this.config.gapMs) {
                    // Siguiente hit
                    this.currentHit++;
                    this.hitPhase = 'pre-blackout';
                    this.hitPhaseTimer = 0;
                }
                break;
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // ═══════════════════════════════════════════════════════════════════════
        // 🔥 NUCLEAR SALSA OUTPUT
        // ═══════════════════════════════════════════════════════════════════════
        let dimmer = 0;
        let color = MELTDOWN_PALETTE.ROJO_NUCLEAR;
        switch (this.hitPhase) {
            case 'pre-blackout':
                // 50ms de NEGRURA total - contraste máximo
                dimmer = 0;
                break;
            case 'flash':
                // EXPLOSIÓN NUCLEAR
                dimmer = this.config.maxIntensity;
                // Alternar colores si está configurado
                if (this.config.alternateColors) {
                    color = this.currentHit % 2 === 0
                        ? MELTDOWN_PALETTE.ROJO_NUCLEAR
                        : MELTDOWN_PALETTE.AMARILLO_NUCLEAR;
                }
                break;
            case 'gap':
                // Oscuridad entre golpes (no total, pero baja)
                dimmer = 0.05; // 5% para no ser negro absoluto
                break;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // 🌊 WAVE 1010.8.6: MOVER SAFETY - DORADO FIJO (no alternancia)
        // PROBLEMA: Alternancia Rojo/Amarillo cada 250ms = riesgo Color Wheel
        // SOLUCIÓN: Movers reciben NARANJA_FUSION fijo (dorado latino)
        // PARs/Wash mantienen alternancia Rojo↔Amarillo (RGB safe)
        // CÓDIGO DEFENSIVO: Aunque HAL limite a 200ms, mejor prevenir desde código
        // ═══════════════════════════════════════════════════════════════════════
        const zoneOverrides = {
            movers: {
                color: this.hitPhase === 'pre-blackout' || this.hitPhase === 'gap'
                    ? { h: 0, s: 0, l: 0 } // Negro en blackout/gap
                    : MELTDOWN_PALETTE.NARANJA_FUSION, // DORADO fijo en flash
                dimmer: dimmer,
                blendMode: 'replace',
            }
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            zones: this.zones,
            intensity: dimmer,
            dimmerOverride: dimmer,
            colorOverride: color, // PARs/Wash con alternancia Rojo↔Amarillo
            zoneOverrides, // 🌊 WAVE 1010.8.6: Movers con DORADO fijo
            // White boost durante flash para punch extra
            whiteOverride: this.hitPhase === 'flash' && dimmer > 0.8 ? 0.3 : undefined,
            globalOverride: true, // 🚂 DICTADOR - manda sobre todo
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Getters
    // ─────────────────────────────────────────────────────────────────────────
    getDurationMs() {
        return this.totalDurationMs;
    }
    getCurrentPhase() {
        return this.hitPhase;
    }
    getCurrentHit() {
        return this.currentHit;
    }
}
export default LatinaMeltdown;
