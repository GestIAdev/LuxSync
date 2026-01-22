/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌪️ ABYSSAL RISE - THE TRANCE ASCENSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔥 WAVE 930: THE ARSENAL
 *
 * FILOSOFÍA:
 * Los pads infinitos de Armin. El breakdown de 8 compases.
 * Ese momento donde la música SUBE y SUBE y todo el mundo sabe
 * que viene el drop pero la tensión es INSOPORTABLE.
 *
 * Este efecto dura 4-8 compases. Es un viaje.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - controla todo el viaje)
 * - Duración: 4-8 compases (ajustable)
 * - Fase 1: Oscuridad. Solo un brillo azul profundo en el suelo.
 * - Fase 2: Los movers suben LENTAMENTE hacia el cielo. Zoom out.
 * - Fase 3: Los pares hacen fade in exponencial hacia BLINDING WHITE.
 * - Fase 4: BLACKOUT INSTANTÁNEO (0ms) sincronizado con el drop.
 *
 * USO IDEAL:
 * - Breakdowns épicos de Trance
 * - Buildups de Progressive House
 * - Cualquier momento "la tensión antes de la explosión"
 *
 * COLORES:
 * - Inicio: Azul abismal (240, 100, 15) - casi negro
 * - Medio: Cyan celestial (200, 90, 50) - subiendo
 * - Clímax: Blanco cegador (0, 0, 100) - CEGUERA TOTAL
 * - Final: NEGRO ABSOLUTO (el drop viene)
 *
 * MOVIMIENTO:
 * - Movers empiezan mirando al suelo (tilt bajo)
 * - Suben gradualmente durante toda la duración
 * - Al final miran directo al techo
 * - Pan: Se abren gradualmente (zoom out effect)
 *
 * @module core/effects/library/techno/AbyssalRise
 * @version WAVE 930 - THE ASCENSION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 8000, // 8 segundos (8 compases @ 120 BPM)
    darkPhaseRatio: 0.15, // 15% del tiempo en oscuridad
    risePhaseRatio: 0.60, // 60% del tiempo subiendo
    blindingPhaseRatio: 0.20, // 20% del tiempo en ceguera
    // El 5% restante es el blackout
    fadeExponent: 2.5, // Fade exponencial (curva empinada)
    blackoutDurationMs: 0, // Blackout instantáneo
    startTilt: 0.1, // Empezar casi en el suelo
    endTilt: 0.95, // Terminar casi en el techo
    startPanSpread: 0.2, // Empezar cerrados (0.4 a 0.6)
    endPanSpread: 0.8, // Terminar abiertos (0.1 a 0.9)
};
// Colores del viaje
const COLORS = {
    abyss: { h: 240, s: 100, l: 10 }, // Azul abismal (casi negro)
    deep: { h: 220, s: 90, l: 25 }, // Azul profundo
    celestial: { h: 200, s: 85, l: 50 }, // Cyan celestial
    bright: { h: 190, s: 70, l: 70 }, // Cyan brillante
    blinding: { h: 0, s: 0, l: 100 }, // Blanco cegador
    black: { h: 0, s: 0, l: 0 }, // Negro absoluto
};
// ═══════════════════════════════════════════════════════════════════════════
// 🌪️ ABYSSAL RISE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class AbyssalRise extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('abyssal_rise');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'abyssal_rise';
        this.name = 'Abyssal Rise';
        this.category = 'physical'; // Afecta dimmer (física)
        this.priority = 98; // MÁXIMA - este efecto es un viaje completo
        this.mixBus = 'global'; // 🚂 DICTADOR - controla todo
        this.currentPhase = 'dark';
        // Timestamps de transición entre fases
        this.darkEndMs = 0;
        this.risingEndMs = 0;
        this.blindingEndMs = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculatePhaseTimings();
    }
    calculatePhaseTimings() {
        this.darkEndMs = this.config.durationMs * this.config.darkPhaseRatio;
        this.risingEndMs = this.darkEndMs + (this.config.durationMs * this.config.risePhaseRatio);
        this.blindingEndMs = this.risingEndMs + (this.config.durationMs * this.config.blindingPhaseRatio);
        // Blackout es lo que queda hasta durationMs
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // AbyssalRise afecta TODO
        this.zones = ['front', 'back', 'movers'];
        // Reset state
        this.currentPhase = 'dark';
        // Ajustar duración si viene del contexto musical
        if (config.musicalContext?.bpm) {
            const bpm = config.musicalContext.bpm;
            const beatsPerMs = bpm / 60000;
            // 8 compases = 32 beats
            this.config.durationMs = 32 / beatsPerMs;
            this.calculatePhaseTimings();
        }
        console.log(`[AbyssalRise 🌪️] TRIGGERED: ${(this.config.durationMs / 1000).toFixed(1)}s journey | ` +
            `Phases: Dark(${(this.config.darkPhaseRatio * 100).toFixed(0)}%) → ` +
            `Rise(${(this.config.risePhaseRatio * 100).toFixed(0)}%) → ` +
            `Blind(${(this.config.blindingPhaseRatio * 100).toFixed(0)}%) → BLACKOUT`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Determinar fase actual
        if (this.elapsedMs < this.darkEndMs) {
            this.currentPhase = 'dark';
        }
        else if (this.elapsedMs < this.risingEndMs) {
            this.currentPhase = 'rising';
        }
        else if (this.elapsedMs < this.blindingEndMs) {
            this.currentPhase = 'blinding';
        }
        else if (this.elapsedMs < this.config.durationMs) {
            this.currentPhase = 'blackout';
        }
        else {
            this.phase = 'finished';
            console.log(`[AbyssalRise 🌪️] FINISHED - DROP TIME!`);
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = Math.min(1, this.elapsedMs / this.config.durationMs);
        // Construir output según fase
        switch (this.currentPhase) {
            case 'dark':
                return this.buildDarkOutput(progress);
            case 'rising':
                return this.buildRisingOutput(progress);
            case 'blinding':
                return this.buildBlindingOutput(progress);
            case 'blackout':
                return this.buildBlackoutOutput(progress);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Phase outputs
    // ─────────────────────────────────────────────────────────────────────────
    buildDarkOutput(progress) {
        // Fase oscura: solo un brillo azul abismal en el suelo
        const phaseProgress = this.elapsedMs / this.darkEndMs;
        // Pars: brillo muy bajo, azul abismal
        const parDimmer = 0.05 + (phaseProgress * 0.1); // 5% a 15%
        // Movers: apagados, mirando al suelo
        const moverTilt = this.config.startTilt;
        const panSpread = this.config.startPanSpread;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            intensity: parDimmer,
            colorOverride: COLORS.abyss,
            dimmerOverride: parDimmer,
            zones: this.zones,
            globalOverride: true,
            movement: {
                tilt: moverTilt,
                pan: 0.5, // Centro
                isAbsolute: true,
                speed: 0.3 // Movimiento lento
            },
            zoneOverrides: {
                'front': { color: COLORS.abyss, dimmer: parDimmer },
                'back': { color: COLORS.deep, dimmer: parDimmer * 0.5 },
                'movers': {
                    color: COLORS.black,
                    dimmer: 0,
                    movement: { tilt: moverTilt, pan: 0.5, isAbsolute: true, speed: 0.3 }
                }
            }
        };
    }
    buildRisingOutput(progress) {
        // Fase de ascenso: todo sube gradualmente
        const phaseElapsed = this.elapsedMs - this.darkEndMs;
        const phaseDuration = this.risingEndMs - this.darkEndMs;
        const phaseProgress = Math.min(1, phaseElapsed / phaseDuration);
        // Aplicar curva exponencial
        const expProgress = Math.pow(phaseProgress, this.config.fadeExponent);
        // Interpolar color: abyss → celestial → bright
        const color = this.interpolateColor(phaseProgress < 0.5 ? COLORS.abyss : COLORS.celestial, phaseProgress < 0.5 ? COLORS.celestial : COLORS.bright, phaseProgress < 0.5 ? phaseProgress * 2 : (phaseProgress - 0.5) * 2);
        // Intensidad creciente exponencial
        const parDimmer = 0.15 + (expProgress * 0.6); // 15% a 75%
        const moverDimmer = expProgress * 0.5; // 0% a 50%
        // Movers suben gradualmente
        const moverTilt = this.config.startTilt +
            (this.config.endTilt - this.config.startTilt) * phaseProgress;
        // Pan spread aumenta (zoom out)
        const panSpread = this.config.startPanSpread +
            (this.config.endPanSpread - this.config.startPanSpread) * phaseProgress;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            intensity: parDimmer,
            colorOverride: color,
            dimmerOverride: parDimmer,
            zones: this.zones,
            globalOverride: true,
            movement: {
                tilt: moverTilt,
                pan: 0.5,
                isAbsolute: true,
                speed: 0.2 // Lento
            },
            zoneOverrides: {
                'front': { color, dimmer: parDimmer },
                'back': { color: COLORS.celestial, dimmer: parDimmer * 0.8 },
                'movers_left': {
                    color,
                    dimmer: moverDimmer,
                    movement: { tilt: moverTilt, pan: 0.5 - panSpread / 2, isAbsolute: true, speed: 0.2 }
                },
                'movers_right': {
                    color,
                    dimmer: moverDimmer,
                    movement: { tilt: moverTilt, pan: 0.5 + panSpread / 2, isAbsolute: true, speed: 0.2 }
                }
            }
        };
    }
    buildBlindingOutput(progress) {
        // Fase de ceguera: TODO A TOPE
        const phaseElapsed = this.elapsedMs - this.risingEndMs;
        const phaseDuration = this.blindingEndMs - this.risingEndMs;
        const phaseProgress = Math.min(1, phaseElapsed / phaseDuration);
        // Rápido hacia blanco cegador
        const color = this.interpolateColor(COLORS.bright, COLORS.blinding, phaseProgress);
        // Intensidad máxima
        const dimmer = 0.75 + (phaseProgress * 0.25); // 75% a 100%
        // Movers al máximo
        const moverTilt = this.config.endTilt;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            intensity: dimmer,
            colorOverride: color,
            dimmerOverride: dimmer,
            whiteOverride: phaseProgress, // Añadir canal blanco si disponible
            zones: this.zones,
            globalOverride: true,
            movement: {
                tilt: moverTilt,
                pan: 0.5,
                isAbsolute: true,
                speed: 0.5
            },
            zoneOverrides: {
                'front': { color, dimmer, white: phaseProgress },
                'back': { color, dimmer, white: phaseProgress },
                'movers': {
                    color,
                    dimmer,
                    white: phaseProgress,
                    movement: { tilt: moverTilt, pan: 0.5, isAbsolute: true, speed: 0.5 }
                }
            }
        };
    }
    buildBlackoutOutput(progress) {
        // BLACKOUT INSTANTÁNEO - el drop viene
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            intensity: 0,
            colorOverride: COLORS.black,
            dimmerOverride: 0,
            zones: this.zones,
            globalOverride: true
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    interpolateColor(from, to, t) {
        return {
            h: from.h + (to.h - from.h) * t,
            s: from.s + (to.s - from.s) * t,
            l: from.l + (to.l - from.l) * t,
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
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default AbyssalRise;
