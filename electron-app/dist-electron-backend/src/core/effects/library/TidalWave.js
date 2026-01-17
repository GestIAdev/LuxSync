/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 TIDAL WAVE - SPATIAL PHASE SWEEP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680: THE ARSENAL - La ola que barre el escenario
 *
 * COMPORTAMIENTO:
 * - Una ola de luz que viaja de FRONT → BACK (o viceversa)
 * - Phase shift entre grupos crea efecto de movimiento
 * - Velocidad sincronizada al BPM
 *
 * FÍSICA:
 * - Cada zona tiene un offset de fase diferente
 * - La "ola" es una envolvente sinusoidal que viaja
 * - Intensidad del pico modulada por Z-Score
 *
 * ZONAS TARGET:
 * - front (PAR front) → pars (PAR back) → back (Wash back) → movers
 * - La ola viaja en secuencia, cada zona picos 90° desfasado
 *
 * PERFECT FOR:
 * - Buildups (ola lenta ascendente)
 * - Drops (ola rápida que barre)
 * - Breakdowns (ola muy lenta, casi breathing)
 *
 * @module core/effects/library/TidalWave
 * @version WAVE 680
 */
import { BaseEffect } from '../BaseEffect';
const DEFAULT_CONFIG = {
    wavePeriodMs: 1000, // 1 segundo por ola
    waveCount: 3, // 3 olas
    bpmSync: true,
    beatsPerWave: 2, // 2 beats = 1 ola
    forwardDirection: true,
    // 🌊 WAVE 691.5: Color CÁLIDO para Latina - no más azul frío
    waveColor: { h: 280, s: 70, l: 55 }, // Violeta cálido
    whiteOnPeak: false,
    intensityFloor: 0.1,
};
// 🌊 WAVE 691.5: TODAS las zonas participan, no solo front
const ZONE_ORDER = ['front', 'pars', 'back', 'movers'];
// ═══════════════════════════════════════════════════════════════════════════
// TIDAL WAVE CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class TidalWave extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('tidal_wave');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'tidal_wave';
        this.name = 'Tidal Wave';
        this.category = 'physical';
        this.priority = 70; // Menor que strobe, mayor que ambient
        this.wavePhase = 0; // 0-1, fase global de la ola
        this.wavesCompleted = 0;
        this.actualWavePeriodMs = 1000;
        // Per-zone intensity cache (para output)
        this.zoneIntensities = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Init zone intensities
        for (const zone of ZONE_ORDER) {
            this.zoneIntensities.set(zone, 0);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        this.wavePhase = 0;
        this.wavesCompleted = 0;
        this.calculateWavePeriod();
        // 🌊 WAVE 691.5: Adaptar color según vibe
        if (config.musicalContext?.vibeId === 'fiesta-latina') {
            // Colores cálidos para latina
            this.config.waveColor = { h: 30, s: 85, l: 55 }; // Naranja dorado
        }
        console.log(`[TidalWave 🌊] TRIGGERED! Period=${this.actualWavePeriodMs}ms Waves=${this.config.waveCount} Color=hsl(${this.config.waveColor.h},${this.config.waveColor.s}%,${this.config.waveColor.l}%)`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Update wave phase
        this.wavePhase += deltaMs / this.actualWavePeriodMs;
        // Check if wave completed
        if (this.wavePhase >= 1) {
            this.wavesCompleted++;
            this.wavePhase = this.wavePhase % 1;
            // All waves done?
            if (this.wavesCompleted >= this.config.waveCount) {
                this.phase = 'finished';
                console.log(`[TidalWave 🌊] Completed (${this.wavesCompleted} waves, ${this.elapsedMs}ms)`);
                return;
            }
        }
        // Update zone intensities
        this.updateZoneIntensities();
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // TidalWave produce output para cada zona afectada
        // El MasterArbiter debe manejar múltiples zonas
        // Por ahora, retornamos el output de la zona con mayor intensidad
        let maxIntensity = 0;
        let peakZone = 'all';
        for (const [zone, intensity] of this.zoneIntensities) {
            if (intensity > maxIntensity) {
                maxIntensity = intensity;
                peakZone = zone;
            }
        }
        const scaledIntensity = this.getIntensityFromZScore(maxIntensity * this.triggerIntensity, 0.25);
        // 🌊 WAVE 691.5: Color con saturación alta, NO desaturar a blanco
        // El problema era que L subía demasiado → gris/blanco
        const colorShift = this.wavePhase * 30; // ±30° de hue durante la ola
        const color = {
            h: (this.config.waveColor.h + colorShift) % 360,
            s: this.config.waveColor.s, // Mantener saturación ALTA
            l: Math.min(75, this.config.waveColor.l + scaledIntensity * 10), // 🔧 FIX: Cap L at 75%
        };
        // 🔍 WAVE 691.5: Debug del color para diagnóstico
        if (Math.random() < 0.05) { // 5% de los frames
            console.log(`[TidalWave 🎨] Color=hsl(${color.h.toFixed(0)},${color.s}%,${color.l.toFixed(0)}%) Intensity=${scaledIntensity.toFixed(2)} Zones=${this.getActiveZones().join(',')}`);
        }
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.getActiveZones(),
            intensity: scaledIntensity,
            dimmerOverride: scaledIntensity,
            colorOverride: color,
            // White solo en el pico de la ola
            whiteOverride: this.config.whiteOnPeak && scaledIntensity > 0.8
                ? (scaledIntensity - 0.8) * 5 // Ramp de 0.8→1 = white 0→1
                : undefined,
            globalOverride: false, // TidalWave es espacial, no global
            // 🌊 WAVE 680: Metadata extra para MasterArbiter (zona actual)
            // El arbiter puede usar esto para aplicar diferente intensidad por zona
        };
    }
    /**
     * 🌊 GET ZONE INTENSITIES - Para sistemas que manejan múltiples zonas
     */
    getZoneIntensities() {
        return new Map(this.zoneIntensities);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Wave physics
    // ─────────────────────────────────────────────────────────────────────────
    calculateWavePeriod() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            // Sincronizar con BPM
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualWavePeriodMs = msPerBeat * this.config.beatsPerWave;
        }
        else {
            this.actualWavePeriodMs = this.config.wavePeriodMs;
        }
        // Clamp para evitar extremos
        this.actualWavePeriodMs = Math.max(200, Math.min(5000, this.actualWavePeriodMs));
    }
    updateZoneIntensities() {
        const numZones = ZONE_ORDER.length;
        for (let i = 0; i < numZones; i++) {
            const zone = ZONE_ORDER[i];
            // Calcular offset de fase para esta zona
            // En forward direction: front=0, pars=0.25, back=0.5, movers=0.75
            const phaseOffset = this.config.forwardDirection
                ? i / numZones
                : (numZones - 1 - i) / numZones;
            // Fase local de esta zona
            const localPhase = (this.wavePhase + phaseOffset) % 1;
            // Intensidad sinusoidal (pico en phase=0.5)
            // Sin: -1 → +1, normalizado a floor → 1
            const sineValue = Math.sin(localPhase * Math.PI * 2);
            const normalizedSine = (sineValue + 1) / 2; // 0-1
            // Aplicar floor
            const intensity = this.config.intensityFloor +
                normalizedSine * (1 - this.config.intensityFloor);
            this.zoneIntensities.set(zone, intensity);
        }
    }
    getActiveZones() {
        // Retornar zonas con intensidad significativa (>0.3)
        const active = [];
        for (const [zone, intensity] of this.zoneIntensities) {
            if (intensity > 0.3) {
                active.push(zone);
            }
        }
        return active.length > 0 ? active : ['all'];
    }
    calculateProgress() {
        const totalWaves = this.config.waveCount;
        return (this.wavesCompleted + this.wavePhase) / totalWaves;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createTidalWave(config) {
    return new TidalWave(config);
}
