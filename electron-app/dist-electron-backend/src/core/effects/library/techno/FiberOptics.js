/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌈 FIBER OPTICS - TRAVELING COLORS (FAST & VISIBLE)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * � WAVE 997.5: RESURRECTION - "De zen invisible a techno visible"
 *
 * FILOSOFÍA ACTUALIZADA:
 * Colores viajando RÁPIDAMENTE por los PARs como fibra óptica.
 * Tecnología pura, VISIBLE, con FLOW y VIDA. Ya no es "zen invisible".
 * Perfecto para intros, transiciones y momentos ambient CON ENERGÍA.
 *
 * ❌ ELIMINADO (WAVE 997.5):
 * - Intensidad baja (0.45 → 0.85) - Ya no es "suave", es VISIBLE
 * - Velocidad zen (0.25 Hz → 1.0 Hz) - 4x más rápido
 * - Movers fantasma débiles (0.20 → 0.50) - Más presencia
 *
 * ZONA TARGET: SILENCE / VALLEY / AMBIENT (E < 0.45)
 * Cuando la música respira, la fibra BRILLA CON VIDA.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (para tener control total del escenario)
 * - PARs: Onda de color viajando back → pars → front (traveling wave RÁPIDO)
 * - Movers: MODO FANTASMA - Solo movimiento medio-rápido, sin color override
 * - Colores: Cian → Magenta → Azul (paleta tech fría BRILLANTE)
 * - Transiciones: Fluidas, sinusoidales, VISIBLES
 *
 * ADN:
 * - Aggression: 0.10 (Mínima - efecto ambient)
 * - Chaos: 0.20 (Bajo - predecible y ordenado)
 * - Organicity: 0.00 (100% tecnología)
 *
 * THE MOVER LAW: Duración 6000ms (LONG > 2s)
 * → Movers en MODO FANTASMA (solo dimmer, NO color override)
 *
 * @module core/effects/library/techno/FiberOptics
 * @version WAVE 997.5 - THE RESURRECTION
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 6000, // 6 segundos - LONG effect
    waveSpeedHz: 1.0, // 🔥 WAVE 997.5: 1.0 Hz = 1 ciclo por segundo (4x más rápido que antes)
    parIntensity: 0.85, // 🔥 WAVE 997.5: 85% - VISIBLE y BRILLANTE (era 0.45)
    moverIntensity: 0.50, // 🔥 WAVE 997.5: 50% - Más presencia (era 0.20)
    moverSpeedDegPerSec: 15, // 🔥 WAVE 997.5: 15°/s - Movimiento más rápido (era 8°/s)
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
            // 🔥 WAVE 997.7: ELIMINADA multiplicación por triggerIntensity
            // Estaba causando doble atenuación (0.85 × 0.7 × wave = solo 34% real!)
            // Ahora: 0.85 × wave = 70-85% real (VISIBLE como debe ser)
            const waveModulation = 0.5 + 0.5 * normalizedWave; // 0.5 - 1.0 (menos contraste, más brillo)
            const zoneIntensity = this.config.parIntensity * envelope * waveModulation;
            zoneOverrides[zone] = {
                dimmer: zoneIntensity, // 🔥 SIN triggerIntensity
                color: interpolatedColor,
                blendMode: 'replace',
            };
        });
        // ═════════════════════════════════════════════════════════════════════
        // 🔓 WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR
        // El HAL traduce Cyan/Azul → Color Wheel DMX automáticamente
        // ═════════════════════════════════════════════════════════════════════
        zoneOverrides['movers'] = {
            color: FIBER_COLORS[0], // 🔓 ¡LIBERTAD! Cian brillante para movers
            dimmer: this.config.moverIntensity * envelope,
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
