/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌈 FIBER OPTICS - TRAVELING COLORS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔧 WAVE 988: THE FINAL ARSENAL
 *
 * FILOSOFÍA:
 * Colores viajando suavemente por los PARs como fibra óptica.
 * Tecnología pura, sin caos, sin agresión. El efecto más "zen" del arsenal.
 * Perfecto para intros, silencios y momentos de transición.
 *
 * ZONA TARGET: SILENCE / VALLEY / AMBIENT (E < 0.45)
 * Cuando la música respira, la fibra brilla.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (para tener control total del escenario)
 * - PARs: Onda de color viajando back → pars → front (traveling wave)
 * - Movers: MODO FANTASMA - Solo movimiento lento, sin color override
 * - Colores: Cian → Magenta → Azul (paleta tech fría)
 * - Transiciones: Suaves, sinusoidales
 *
 * ADN:
 * - Aggression: 0.10 (Mínima - efecto zen)
 * - Chaos: 0.20 (Bajo - predecible y ordenado)
 * - Organicity: 0.00 (100% tecnología)
 *
 * THE MOVER LAW: Duración 6000ms (LONG > 2s)
 * → Movers en MODO FANTASMA (solo dimmer, NO color override)
 *
 * @module core/effects/library/techno/FiberOptics
 * @version WAVE 988 - THE FINAL ARSENAL
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 6000, // 6 segundos - LONG effect
    waveSpeedHz: 0.25, // 0.25 Hz = 1 ciclo cada 4 segundos (muy lento)
    parIntensity: 0.45, // 45% - visible pero suave
    moverIntensity: 0.20, // 20% - tenue para modo fantasma
    moverSpeedDegPerSec: 8, // 8°/s - movimiento muy lento
};
// ═══════════════════════════════════════════════════════════════════════════
// PALETA DE COLORES - TECH COLD
// ═══════════════════════════════════════════════════════════════════════════
const FIBER_COLORS = [
    { h: 190, s: 100, l: 50 }, // Cian brillante
    { h: 280, s: 80, l: 55 }, // Magenta tech
    { h: 220, s: 90, l: 50 }, // Azul eléctrico
    { h: 170, s: 85, l: 45 }, // Turquesa profundo
];
// Zonas de PARs para el traveling wave
const PAR_ZONES = ['back', 'pars', 'front'];
// ═══════════════════════════════════════════════════════════════════════════
// 🌈 FIBER OPTICS CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class FiberOptics extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('fiber_optics');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'fiber_optics';
        this.name = 'Fiber Optics';
        this.category = 'physical';
        this.priority = 50; // Baja prioridad - efecto ambiental
        this.mixBus = 'global'; // Control total del escenario
        // ─────────────────────────────────────────────────────────────────────────
        // Internal state
        // ─────────────────────────────────────────────────────────────────────────
        this.config = DEFAULT_CONFIG;
        this.baseColorIndex = 0;
        this.moverPanOffset = 0;
        if (config) {
            this.config = { ...DEFAULT_CONFIG, ...config };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Selección determinista del color base (por timestamp)
        this.baseColorIndex = Date.now() % FIBER_COLORS.length;
        this.moverPanOffset = 0;
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // Actualizar pan offset de movers (movimiento lento)
        this.moverPanOffset += (this.config.moverSpeedDegPerSec * deltaMs) / 1000;
        if (this.moverPanOffset > 360)
            this.moverPanOffset -= 360;
        // ¿Terminó?
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            return;
        }
        // Actualizar phase
        const progress = this.elapsedMs / this.config.durationMs;
        if (progress < 0.15) {
            this.phase = 'attack';
        }
        else if (progress < 0.85) {
            this.phase = 'sustain';
        }
        else {
            this.phase = 'decay';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        const elapsed = this.elapsedMs;
        // ═════════════════════════════════════════════════════════════════════
        // ENVELOPE: Fade in/out suave
        // ═════════════════════════════════════════════════════════════════════
        let envelope = 1.0;
        if (progress < 0.15) {
            // Attack: fade in
            envelope = progress / 0.15;
        }
        else if (progress > 0.85) {
            // Decay: fade out
            envelope = (1.0 - progress) / 0.15;
        }
        // ═════════════════════════════════════════════════════════════════════
        // TRAVELING WAVE: Colores viajando por las zonas
        // Cada zona tiene un offset de fase diferente
        // ═════════════════════════════════════════════════════════════════════
        const wavePhase = (elapsed / 1000) * this.config.waveSpeedHz * 2 * Math.PI;
        const zoneOverrides = {};
        PAR_ZONES.forEach((zone, index) => {
            // Offset de fase por zona (0, 2π/3, 4π/3) = distribución equidistante
            const zonePhaseOffset = (index / PAR_ZONES.length) * 2 * Math.PI;
            const zoneWave = Math.sin(wavePhase + zonePhaseOffset);
            // Normalizar wave de [-1,1] a [0,1]
            const normalizedWave = (zoneWave + 1) / 2;
            // Calcular color interpolado entre colores adyacentes
            const colorProgress = normalizedWave * (FIBER_COLORS.length - 1);
            const colorIndex1 = Math.floor(colorProgress) % FIBER_COLORS.length;
            const colorIndex2 = (colorIndex1 + 1) % FIBER_COLORS.length;
            const colorBlend = colorProgress - Math.floor(colorProgress);
            const color1 = FIBER_COLORS[(this.baseColorIndex + colorIndex1) % FIBER_COLORS.length];
            const color2 = FIBER_COLORS[(this.baseColorIndex + colorIndex2) % FIBER_COLORS.length];
            // Interpolación lineal de HSL
            const interpolatedColor = {
                h: color1.h + (color2.h - color1.h) * colorBlend,
                s: color1.s + (color2.s - color1.s) * colorBlend,
                l: color1.l + (color2.l - color1.l) * colorBlend,
            };
            // Intensidad modulada por wave + envelope
            const zoneIntensity = this.config.parIntensity * envelope * (0.5 + 0.5 * normalizedWave);
            zoneOverrides[zone] = {
                dimmer: zoneIntensity * this.triggerIntensity,
                color: interpolatedColor,
                blendMode: 'replace',
            };
        });
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: MODO FANTASMA - Solo dimmer, NO color override
        // 🛡️ THE MOVER LAW: Efecto >2s → Proteger ruedas mecánicas
        // ═════════════════════════════════════════════════════════════════════
        zoneOverrides['movers'] = {
            dimmer: this.config.moverIntensity * envelope * this.triggerIntensity,
            // 🚫 NO COLOR - Física controla la rueda mecánica
            blendMode: 'replace',
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: [...PAR_ZONES, 'movers'],
            intensity: this.config.parIntensity * envelope,
            zoneOverrides,
            // Movement override para movers: pan lento
            movement: {
                pan: this.moverPanOffset / 360, // Normalizado 0-1
                tilt: 0.3, // Ligeramente hacia arriba
                isAbsolute: false, // Offset mode, suma a física
            },
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
            baseColorIndex: this.baseColorIndex,
            moverPanOffset: this.moverPanOffset.toFixed(1),
        };
    }
}
// Default export para compatibilidad
export default FiberOptics;
