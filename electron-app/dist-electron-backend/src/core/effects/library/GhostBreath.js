/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👻 GHOST BREATH - SLOW SINUSOIDAL MODULATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680: THE ARSENAL - El susurro en la oscuridad
 *
 * COMPORTAMIENTO:
 * - Modulación sinusoidal MUY lenta del dimmer
 * - Color: Deep Blue / UV para atmósfera fantasmal
 * - Target: Back + Movers (no front - el fantasma está detrás)
 *
 * FÍSICA:
 * - Periodo largo (4-8 segundos por respiración)
 * - Fase de "inhale" (subida) más rápida que "exhale" (bajada)
 * - No llega a blackout total (floor de 5-10%)
 *
 * PERFECT FOR:
 * - Buildups lentos (tensión que crece)
 * - Breakdowns (momento de calma tensa)
 * - Intros/Outros (atmósfera misteriosa)
 * - Chill-lounge (si estuviera permitido, pero NO - solo colores lentos ahí)
 *
 * ZONAS TARGET:
 * - back: Principal (wash atmosférico)
 * - movers: Secundario (beam ambiental)
 * - NO front: El fantasma está detrás del DJ
 *
 * @module core/effects/library/GhostBreath
 * @version WAVE 680
 */
import { BaseEffect } from '../BaseEffect';
const DEFAULT_CONFIG = {
    breathPeriodMs: 4000, // 4 segundos por respiración
    breathCount: 2, // 🌊 WAVE 691: SOLO 2 respiraciones (~8 segundos max)
    inhaleRatio: 0.35, // Inhale más rápido que exhale
    intensityFloor: 0.05, // 5% mínimo (no blackout)
    intensityCeiling: 0.7, // 70% máximo (no cegador)
    useUV: true,
    baseColor: { h: 220, s: 90, l: 30 }, // Deep Blue oscuro
    uvColor: { h: 270, s: 100, l: 40 }, // Violeta UV
    bpmSync: false, // Por defecto NO sync (orgánico)
    beatsPerBreath: 8, // 8 beats = 1 respiración si sync
};
// ═══════════════════════════════════════════════════════════════════════════
// GHOST BREATH CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class GhostBreath extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('ghost_breath');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'ghost_breath';
        this.name = 'Ghost Breath';
        this.category = 'physical';
        this.priority = 50; // Baja - efecto ambiental de fondo
        this.breathPhase = 0; // 0-1, fase de la respiración
        this.breathsCompleted = 0;
        this.actualBreathPeriodMs = 4000;
        this.currentIntensity = 0;
        this.isInhaling = true; // true = subiendo, false = bajando
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // 🌊 WAVE 691: Ghost Breath llena TODAS las zonas para no dejar huecos
        // El fantasma respira en todo el espacio, no solo atrás
        this.zones = ['front', 'back', 'movers'];
        this.breathPhase = 0;
        this.breathsCompleted = 0;
        this.currentIntensity = this.config.intensityFloor;
        this.isInhaling = true;
        this.calculateBreathPeriod();
        console.log(`[GhostBreath 👻] TRIGGERED! Period=${this.actualBreathPeriodMs}ms Breaths=${this.config.breathCount}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Update breath phase
        this.breathPhase += deltaMs / this.actualBreathPeriodMs;
        // Check if breath completed
        if (this.breathPhase >= 1) {
            this.breathsCompleted++;
            this.breathPhase = this.breathPhase % 1;
            // All breaths done?
            if (this.breathsCompleted >= this.config.breathCount) {
                this.phase = 'finished';
                console.log(`[GhostBreath 👻] Completed (${this.breathsCompleted} breaths, ${this.elapsedMs}ms)`);
                return;
            }
        }
        // Calculate current intensity with asymmetric sine
        this.updateIntensity();
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // Escalar intensidad con Z-Score (pero menos agresivo - es ambiental)
        const scaledIntensity = this.getIntensityFromZScore(this.currentIntensity * this.triggerIntensity, 0.15 // Escala suave con Z
        );
        // Interpolar entre base color y UV color según fase
        const uvBlend = this.config.useUV ? this.breathPhase : 0;
        const color = {
            h: this.lerp(this.config.baseColor.h, this.config.uvColor.h, uvBlend * 0.5),
            s: this.lerp(this.config.baseColor.s, this.config.uvColor.s, uvBlend * 0.3),
            l: this.lerp(this.config.baseColor.l, this.config.uvColor.l, scaledIntensity * 0.5),
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones, // back + movers
            intensity: scaledIntensity,
            dimmerOverride: scaledIntensity,
            colorOverride: color,
            // Sin white - el fantasma no brilla, solo respira
            whiteOverride: undefined,
            // Sin strobe - orgánico y suave
            strobeRate: undefined,
            globalOverride: false, // Nunca global - solo zonas específicas
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Breath physics
    // ─────────────────────────────────────────────────────────────────────────
    calculateBreathPeriod() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            // Sincronizar con BPM
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualBreathPeriodMs = msPerBeat * this.config.beatsPerBreath;
        }
        else {
            this.actualBreathPeriodMs = this.config.breathPeriodMs;
        }
        // Clamp para evitar extremos
        this.actualBreathPeriodMs = Math.max(1000, Math.min(10000, this.actualBreathPeriodMs));
    }
    updateIntensity() {
        const { inhaleRatio, intensityFloor, intensityCeiling } = this.config;
        // Fase 0 → inhaleRatio: INHALE (subiendo)
        // Fase inhaleRatio → 1: EXHALE (bajando)
        let normalizedPhase;
        if (this.breathPhase < inhaleRatio) {
            // INHALE - fase de subida
            this.isInhaling = true;
            normalizedPhase = this.breathPhase / inhaleRatio; // 0→1 durante inhale
            // Ease-out para inhale (empieza rápido, frena al pico)
            const eased = 1 - Math.pow(1 - normalizedPhase, 2);
            this.currentIntensity = intensityFloor + eased * (intensityCeiling - intensityFloor);
        }
        else {
            // EXHALE - fase de bajada
            this.isInhaling = false;
            normalizedPhase = (this.breathPhase - inhaleRatio) / (1 - inhaleRatio); // 0→1 durante exhale
            // Ease-in-out para exhale (suave salida, suave llegada)
            const eased = this.easeInOutCubic(normalizedPhase);
            this.currentIntensity = intensityCeiling - eased * (intensityCeiling - intensityFloor);
        }
    }
    calculateProgress() {
        const totalBreaths = this.config.breathCount;
        return (this.breathsCompleted + this.breathPhase) / totalBreaths;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Public API for external queries
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 👻 GET BREATH STATE - Para telemetría
     */
    getBreathState() {
        return {
            isInhaling: this.isInhaling,
            intensity: this.currentIntensity,
            breathCount: this.breathsCompleted,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createGhostBreath(config) {
    return new GhostBreath(config);
}
