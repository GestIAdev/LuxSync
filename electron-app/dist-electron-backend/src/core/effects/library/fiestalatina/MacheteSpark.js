/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚔️ MACHETE SPARK - EL CORTE DEL ACERO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🌊 WAVE 1004.4: THE LATINO LADDER - Zona ACTIVE (60-75%)
 *
 * CONCEPTO:
 * El brillo metálico del machete cortando la caña de azúcar.
 * Destellos cortos, nítidos, precisos. No es un strobe masivo,
 * son "cortes" de luz - como el filo del acero reflejando el sol.
 *
 * DNA TARGET:
 * - Aggression: 0.70 (Alta pero controlada - golpes precisos)
 * - Chaos: 0.50 (Medio - rítmico pero con variación)
 * - Organicity: 0.30 (Semi-mecánico - el swing del machete es humano pero repetitivo)
 *
 * FILOSOFÍA:
 * "En el campo, el machete canta. Cada corte es música.
 * La luz del acero marca el ritmo del trabajo."
 *
 * MECÁNICA:
 * - Destellos muy cortos (20-30ms) - como el brillo del filo
 * - 3-5 "cortes" por ráfaga
 * - Pre-blackout de 50ms antes de cada corte (contraste)
 * - Colores: Blanco Frío (sparkle) sobre Ámbar Profundo (fondo)
 * - Intensidad alta pero breve
 *
 * MOVER LAW:
 * - Efecto SHORT (~800ms) = COLOR PERMITIDO
 * - Movers pueden participar en el corte
 *
 * PERFECT FOR:
 * - Zona ACTIVE (60-75% energía)
 * - Versos con ritmo marcado
 * - Percusión constante
 * - Cuando hay "trabajo" musical
 *
 * @module core/effects/library/fiestalatina/MacheteSpark
 * @version WAVE 1004.4
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    cutCount: 2, // 4 cortes por ráfaga
    sparkDurationMs: 25, // 25ms - destello muy corto (filo del acero)
    preBlackoutMs: 50, // 50ms de oscuridad antes del corte
    gapMs: 120, // 120ms entre cortes (ritmo de trabajo)
    sparkIntensity: 0.95, // 95% - brillante pero no cegador
    alternateSides: true, // Alterna L-R como el swing del machete
};
// Duración total: (50 + 25 + 120) * 4 = 780ms (SHORT effect)
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 PALETA DEL ACERO
// ═══════════════════════════════════════════════════════════════════════════
const STEEL_PALETTE = {
    // Blanco Frío - El destello del filo
    WHITE_SPARK: { h: 210, s: 10, l: 95 }, // Blanco ligeramente azulado (acero)
    // Ámbar Profundo - La caña/tierra
    AMBER_DEEP: { h: 35, s: 80, l: 30 },
    // Plata Metálica - Reflejos secundarios
    SILVER_FLASH: { h: 0, s: 0, l: 85 },
};
// ═══════════════════════════════════════════════════════════════════════════
// ⚔️ MACHETE SPARK CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class MacheteSpark extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('machete_spark');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'machete_spark';
        this.name = 'Machete Spark';
        this.category = 'physical';
        this.priority = 78; // Alta pero no máxima
        this.mixBus = 'global'; // Global override durante el corte
        this.currentCut = 0;
        this.totalDurationMs = 0;
        // Estado de la fase actual dentro de un corte
        this.cutPhase = 'pre-blackout';
        this.cutPhaseTimer = 0;
        // Lado actual del swing (para alternancia L-R)
        this.currentSide = 'left';
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateTotalDuration();
    }
    calculateTotalDuration() {
        const cutCycleMs = this.config.preBlackoutMs +
            this.config.sparkDurationMs +
            this.config.gapMs;
        this.totalDurationMs = cutCycleMs * this.config.cutCount;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // GLOBAL - Afecta todo el escenario
        this.zones = ['front', 'back', 'movers'];
        // Reset state
        this.currentCut = 0;
        this.cutPhase = 'pre-blackout';
        this.cutPhaseTimer = 0;
        this.currentSide = 'left';
        console.log(`[MacheteSpark ⚔️] STEEL CUTS! Cuts=${this.config.cutCount} Duration=${this.totalDurationMs}ms`);
        console.log(`[MacheteSpark ⚔️] DNA: A=0.70 C=0.50 O=0.30 (ACTIVE ZONE)`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.cutPhaseTimer += deltaMs;
        // Verificar fin del efecto
        if (this.currentCut >= this.config.cutCount) {
            this.phase = 'finished';
            console.log(`[MacheteSpark ⚔️] The work is done`);
            return;
        }
        // State machine: pre-blackout → spark → gap → next cut
        this.updateCutPhase();
        // Safety timeout
        if (this.elapsedMs > this.totalDurationMs * 1.5) {
            this.phase = 'finished';
        }
    }
    updateCutPhase() {
        switch (this.cutPhase) {
            case 'pre-blackout':
                if (this.cutPhaseTimer >= this.config.preBlackoutMs) {
                    this.cutPhase = 'spark';
                    this.cutPhaseTimer = 0;
                }
                break;
            case 'spark':
                if (this.cutPhaseTimer >= this.config.sparkDurationMs) {
                    this.cutPhase = 'gap';
                    this.cutPhaseTimer = 0;
                }
                break;
            case 'gap':
                if (this.cutPhaseTimer >= this.config.gapMs) {
                    // Siguiente corte
                    this.currentCut++;
                    this.cutPhase = 'pre-blackout';
                    this.cutPhaseTimer = 0;
                    // Alternar lado
                    if (this.config.alternateSides) {
                        this.currentSide = this.currentSide === 'left' ? 'right' : 'left';
                    }
                }
                break;
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // ═══════════════════════════════════════════════════════════════════════
        // ⚔️ STEEL CUT OUTPUT
        // ═══════════════════════════════════════════════════════════════════════
        let dimmer = 0;
        let color = STEEL_PALETTE.AMBER_DEEP; // Color base
        switch (this.cutPhase) {
            case 'pre-blackout':
                // 50ms de NEGRURA - el machete se levanta
                dimmer = 0;
                break;
            case 'spark':
                // ¡EL CORTE! Destello blanco del acero
                dimmer = this.config.sparkIntensity;
                color = STEEL_PALETTE.WHITE_SPARK;
                break;
            case 'gap':
                // Respiro entre cortes - ámbar bajo
                dimmer = 0.08;
                color = STEEL_PALETTE.AMBER_DEEP;
                break;
        }
        // ═══════════════════════════════════════════════════════════════════════
        // SHORT EFFECT (~780ms) = COLOR PERMITIDO EN MOVERS
        // El machete corta en todo el escenario
        // ═══════════════════════════════════════════════════════════════════════
        // Determinar zonas según el lado del swing
        const activeZones = this.cutPhase === 'spark' && this.config.alternateSides
            ? (this.currentSide === 'left'
                ? ['front', 'movers_left']
                : ['back', 'movers_right'])
            : ['front', 'back', 'movers'];
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            zones: activeZones,
            intensity: dimmer,
            dimmerOverride: dimmer,
            colorOverride: color,
            // White boost durante el spark para brillo metálico
            whiteOverride: this.cutPhase === 'spark' ? 0.7 : undefined,
            // 🌊 WAVE 1090: globalOverride → globalComposition
            globalComposition: this.cutPhase === 'spark' ? 1.0 : 0,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Getters
    // ─────────────────────────────────────────────────────────────────────────
    getDurationMs() {
        return this.totalDurationMs;
    }
    getCurrentCut() {
        return this.currentCut;
    }
    getCurrentSide() {
        return this.currentSide;
    }
}
export default MacheteSpark;
