/**
 * 🌊 SURFACE SHIMMER - Destellos Sutiles en SHALLOWS (0-1000m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1072: AMBIENT FAUNA - Tier 2 (Frequent/Subtle)
 * WAVE 1085: CHILL LOUNGE FINAL POLISH
 *   - Organic easing curves (shimmer más natural)
 *   - Intensity floor: 0.4 (micro-fauna, muy sutil)
 *   - Atmospheric bed: 10% esmeralda tenue (superficie del agua)
 *   - Fade más orgánico
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * DESCRIPCIÓN: Pequeños destellos que imitan la luz del sol refractándose
 * en la superficie del agua. Efecto sutil y constante.
 * Los destellos EMERGEN suavemente, no aparecen bruscamente.
 *
 * COLORES: Tonos esmeralda brillante y oro pálido
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 *
 * ZONA: SHALLOWS exclusivamente
 * COOLDOWN: 15s (más frecuente que SolarCaustics)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 2500, // Más corto que SolarCaustics
    shimmerCount: 5, // Varios destellos pequeños
    peakIntensity: 0.95, // 🌊 WAVE 1083.1: SUBIDO de 0.45 → 0.95 (sin limitación artificial)
    minIntensity: 0.75, // 🌊 WAVE 1083.1: SUBIDO de 0.40 → 0.75 (superar noise floor 0.5)
    atmosphericBed: 0.10, // 🌊 WAVE 1085: 10% atmósfera esmeralda
};
// 🌊 COLORES SUPERFICIE: Esmeralda brillante + oro pálido
const SHIMMER_COLORS = [
    { h: 155, s: 75, l: 60 }, // Esmeralda claro
    { h: 165, s: 80, l: 55 }, // Verde mar
    { h: 50, s: 60, l: 70 }, // Oro pálido (sol)
    { h: 145, s: 70, l: 65 }, // Agua verde
];
export class SurfaceShimmer extends BaseEffect {
    constructor(config) {
        super('surface_shimmer');
        this.effectType = 'surface_shimmer';
        this.name = 'Surface Shimmer';
        this.category = 'physical'; // 'physical' porque mueve luz espacialmente
        this.priority = 40; // Prioridad más baja (efecto de fondo)
        this.mixBus = 'htp'; // HTP - El más brillante gana
        this.shimmerOffsets = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        // Offsets determinísticos basados en timestamp del trigger
        // NO usamos Math.random() - Axioma Anti-Simulación
        const baseSeed = Date.now();
        this.shimmerOffsets = Array.from({ length: this.config.shimmerCount }, (_, i) => ((baseSeed + i * 137) % 100) / 100 // 137 es primo = buena distribución
        );
        console.log(`[🌊 SurfaceShimmer] TRIGGERED! Shimmers=${this.config.shimmerCount}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // 🌊 WAVE 1085: ORGANIC EASING - Ease-in-out cubic
        // Los destellos EMERGEN suavemente, no aparecen bruscamente
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        // 🌊 WAVE 1085: INTENSITY FLOOR - Garantizar visibilidad micro-fauna
        const effectiveIntensity = Math.max(this.triggerIntensity, this.config.minIntensity);
        // 🌊 WAVE 1085: Envelope con transiciones orgánicas
        let envelope;
        if (progress < 0.20) {
            envelope = easeInOutCubic(progress / 0.20); // Entrada orgánica
        }
        else if (progress < 0.65) {
            envelope = 1.0;
        }
        else {
            // 🌊 WAVE 1085: Salida suave y orgánica
            const fadeOutProgress = (progress - 0.65) / 0.35;
            envelope = (1 - easeInOutCubic(fadeOutProgress));
        }
        // 🌊 WAVE 1085: ATMOSPHERIC BED - Esmeralda tenue de superficie
        const atmosphericAmbient = this.config.atmosphericBed * envelope * effectiveIntensity;
        const atmosphericColor = { h: 158, s: 65, l: 42 }; // Esmeralda profundo
        // Calcular shimmer combinado de todos los destellos con easing
        let shimmerValue = 0;
        for (let i = 0; i < this.shimmerOffsets.length; i++) {
            const offset = this.shimmerOffsets[i];
            const shimmerPhase = (progress * 3 + offset) * Math.PI * 2;
            const singleShimmer = Math.max(0, Math.sin(shimmerPhase));
            shimmerValue += singleShimmer / this.shimmerOffsets.length;
        }
        // 🌊 WAVE 1083.1: Intensidad SIN doble multiplicación
        // effectiveIntensity ya está aplicado en el cálculo de intensity
        const intensity = envelope * this.config.peakIntensity * shimmerValue * effectiveIntensity;
        // Color que varía sutilmente con el tiempo
        const colorIndex = Math.floor((progress * SHIMMER_COLORS.length * 2) % SHIMMER_COLORS.length);
        const shimmerColor = SHIMMER_COLORS[colorIndex];
        // Output estructurado según EffectFrameOutput
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['frontL', 'frontR', 'backL', 'backR'], // Solo PARs, no movers
            intensity, // 🌊 WAVE 1083.1: FIX - Solo intensity, NO effectiveIntensity × intensity
            zoneOverrides: {},
        };
        // 🌊 WAVE 1085: Front con atmospheric bed
        output.zoneOverrides['frontL'] = {
            dimmer: Math.max(intensity, atmosphericAmbient),
            color: intensity > atmosphericAmbient ? shimmerColor : atmosphericColor,
            blendMode: 'max',
        };
        output.zoneOverrides['frontR'] = {
            dimmer: Math.max(intensity * 0.85, atmosphericAmbient),
            color: intensity * 0.85 > atmosphericAmbient ? shimmerColor : atmosphericColor,
            blendMode: 'max',
        };
        // 🌊 WAVE 1085: Back sutil con atmospheric bed
        output.zoneOverrides['backL'] = {
            dimmer: Math.max(intensity * 0.3, atmosphericAmbient * 0.6),
            color: intensity * 0.3 > atmosphericAmbient * 0.6 ? shimmerColor : atmosphericColor,
            blendMode: 'max',
        };
        output.zoneOverrides['backR'] = {
            dimmer: Math.max(intensity * 0.25, atmosphericAmbient * 0.5),
            color: intensity * 0.25 > atmosphericAmbient * 0.5 ? shimmerColor : atmosphericColor,
            blendMode: 'max',
        };
        return output;
    }
    // Validar que solo se dispare en SHALLOWS
    static isValidForZone(zone) {
        return zone === 'SHALLOWS';
    }
}
