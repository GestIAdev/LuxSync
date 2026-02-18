/**
 * ═════════════════════════════════════════════════════════════════════const DEFAULT_CONFIG: GhostBreathConfig = {
  breathPeriodMs: 4000,   // 4 segundos por respiración
  breathCount: 1,          // 👻 WAVE 750: SOLO 1 respiración = 4s total (silencio dramático)
  inhaleRatio: 0.35,       // Inhale más rápido que exhale
  intensityFloor: 0.05,    // 5% mínimo (no blackout)
  intensityCeiling: 1.0,   // 🔥 WAVE 770: 100% máximo - UV necesita potencia para notarse
  useUV: true,
  // � WAVE 770: UV PROFUNDO - no azul, ULTRAVIOLETA real
  baseColor: { h: 275, s: 100, l: 40 },   // UV Profundo (antes Deep Blue 220)
  uvColor: { h: 285, s: 100, l: 45 },     // Violeta UV intenso
  bpmSync: false,          // Por defecto NO sync (orgánico)
  beatsPerBreath: 4,       // 🌙 WAVE 750: 4 beats = 1 respiración si sync
}👻 GHOST BREATH - SLOW SINUSOIDAL MODULATION
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
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    breathPeriodMs: 3000, // 4 segundos por respiración
    breathCount: 1, //  WAVE 750: SOLO 1 respiración = 4s total (silencio dramático)
    inhaleRatio: 0.35, // Inhale más rápido que exhale
    intensityFloor: 0.15, // 5% mínimo (no blackout)
    intensityCeiling: 0.7, // 70% máximo (no cegador)
    useUV: true,
    baseColor: { h: 270, s: 100, l: 40 }, // Deep Blue oscuro
    uvColor: { h: 270, s: 100, l: 40 }, // Violeta UV
    bpmSync: false, // Por defecto NO sync (orgánico)
    beatsPerBreath: 4, // 🌙 WAVE 750: 4 beats = 1 respiración si sync
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
        this.mixBus = 'global'; // 🚂 WAVE 800: Dictador - UV tenue necesita silencio
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
        // � WAVE 725: Ghost Breath solo afecta BACK y MOVERS
        // El fantasma está DETRÁS del escenario - Front queda intacto
        this.zones = ['back', 'all-movers'];
        this.breathPhase = 0;
        this.breathsCompleted = 0;
        this.currentIntensity = this.config.intensityFloor;
        this.isInhaling = true;
        this.calculateBreathPeriod();
        console.log(`[GhostBreath 👻] TRIGGERED! Period=${this.actualBreathPeriodMs}ms Breaths=${this.config.breathCount} Zones=[back, movers]`);
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
        const ghostColor = {
            h: this.lerp(this.config.baseColor.h, this.config.uvColor.h, uvBlend * 0.5),
            s: this.lerp(this.config.baseColor.s, this.config.uvColor.s, uvBlend * 0.3),
            l: this.lerp(this.config.baseColor.l, this.config.uvColor.l, scaledIntensity * 0.5),
        };
        // 🎨 WAVE 725: Zone Overrides - El fantasma solo respira en BACK y MOVERS
        // FRONT queda INTACTO (sin override = mantiene la paleta base)
        // � WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR (HAL traduce)
        const zoneOverrides = {
            'back': {
                color: ghostColor,
                dimmer: scaledIntensity,
                blendMode: 'replace', // 🎚️ WAVE 780: LTP - La respiración manda
            },
            // � WAVE 1009: FREEDOM DAY - Movers reciben color fantasmal
            'all-movers': {
                color: ghostColor, // 🔓 ¡LIBERTAD! Color UV/Cyan para movers
                dimmer: scaledIntensity * 0.7, // Movers más sutiles
                blendMode: 'replace', // 🎚️ WAVE 780: LTP - La respiración manda
            }
            // NOTA: NO incluimos 'front' - esto deja los Front PARs INTACTOS
            // El fantasma está DETRÁS del escenario
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            // 🔥 WAVE 740: zones derivado de zoneOverrides (fuente de verdad única)
            zones: Object.keys(zoneOverrides),
            intensity: scaledIntensity,
            // 🔥 WAVE 740: Legacy fallback ELIMINADO cuando hay zoneOverrides
            // dimmerOverride y colorOverride podrían causar conflictos
            dimmerOverride: undefined,
            colorOverride: undefined,
            // Sin white - el fantasma no brilla, solo respira
            whiteOverride: undefined,
            // Sin strobe - orgánico y suave
            strobeRate: undefined,
            // 🎨 WAVE 725/740: ZONE OVERRIDES - ÚNICA FUENTE DE VERDAD
            zoneOverrides,
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
