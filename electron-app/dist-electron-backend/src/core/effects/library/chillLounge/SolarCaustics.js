/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌞 SOLAR CAUSTICS - Rayos de Sol Submarinos
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 1070: THE LIVING OCEAN
 *
 * Simula los rayos de luz solar penetrando la superficie del agua.
 * Se activa SOLO en zona SHALLOWS (0-200m) cuando la claridad
 * del audio es alta (voces claras, guitarras acústicas, pianos).
 *
 * VISUAL:
 * - Movers en blanco cálido (2800K) muy pálido
 * - Movimiento lento y orgánico simulando cáusticas
 * - Intensidad modulada por "olas" de superficie
 *
 * FILOSOFÍA:
 * Los rayos de sol son efímeros y gentiles. No deslumbran,
 * acarician. Como la luz que entra por una ventana al amanecer.
 *
 * @module core/effects/library/chillLounge/SolarCaustics
 * @version WAVE 1070 - THE LIVING OCEAN
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 4000,
    peakIntensity: 0.65,
    patternSpeed: 1.0,
    rayCount: 3,
};
// Color: Blanco cálido con hint de ámbar (2800K equivalent)
const CAUSTIC_COLOR = { h: 45, s: 25, l: 88 };
// ═══════════════════════════════════════════════════════════════════════════
// SOLAR CAUSTICS EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class SolarCaustics extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('solar_caustics');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'solar_caustics';
        this.name = 'Solar Caustics';
        this.category = 'physical';
        this.priority = 75;
        // Global override para simular rayos de sol reales penetrando
        this.mixBus = 'global';
        this.startTime = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.startTime = Date.now();
        console.log(`[SolarCaustics 🌞] TRIGGERED! Duration=${this.config.durationMs}ms`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[SolarCaustics 🌞] FINISHED - Rays faded`);
        }
    }
    /**
     * 📤 GET OUTPUT - Patrón de cáusticas solares
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        const now = Date.now();
        // ═════════════════════════════════════════════════════════════════════
        // ENVELOPE: Fade in suave → sustain → fade out largo
        // ═════════════════════════════════════════════════════════════════════
        let envelope;
        if (progress < 0.15) {
            // Fade in (15%)
            envelope = progress / 0.15;
        }
        else if (progress < 0.7) {
            // Sustain (55%)
            envelope = 1.0;
        }
        else {
            // Fade out largo (30%)
            envelope = 1 - ((progress - 0.7) / 0.3);
        }
        // Curva suave
        envelope = envelope * envelope * (3 - 2 * envelope);
        // ═════════════════════════════════════════════════════════════════════
        // CAUSTIC PATTERN: Múltiples rayos con fases desfasadas
        // ═════════════════════════════════════════════════════════════════════
        const speed = this.config.patternSpeed;
        let causticIntensity = 0;
        for (let i = 0; i < this.config.rayCount; i++) {
            // Cada rayo tiene su propia frecuencia y fase
            const rayPhase = (i * Math.PI * 2) / this.config.rayCount;
            const rayFreq = 2000 + i * 500; // Frecuencias diferentes
            // Patrón de cáustica: superposición de senos
            const ray = Math.sin((now * speed) / rayFreq + rayPhase);
            const ripple = Math.sin((now * speed) / (rayFreq * 0.7) + rayPhase * 1.3);
            // Solo sumamos cuando es positivo (rayos, no sombras)
            causticIntensity += Math.max(0, (ray + ripple * 0.5) / 1.5);
        }
        // Normalizar por número de rayos
        causticIntensity = causticIntensity / this.config.rayCount;
        // Aplicar envelope y peak
        const dimmer = causticIntensity * envelope * this.config.peakIntensity;
        // ═════════════════════════════════════════════════════════════════════
        // MOVEMENT: Pan/Tilt orgánico simulando olas de superficie
        // ═════════════════════════════════════════════════════════════════════
        const waveX = Math.sin(now / 3000) * 25 + Math.sin(now / 1700) * 10;
        const waveY = Math.cos(now / 2500) * 15 + Math.cos(now / 1900) * 8;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['movers'],
            intensity: this.triggerIntensity * dimmer,
            zoneOverrides: {},
        };
        // Movers: Color blanco cálido + movimiento de cáusticas
        output.zoneOverrides['movers'] = {
            dimmer,
            color: CAUSTIC_COLOR,
            blendMode: 'max',
            movement: {
                pan: waveX,
                tilt: waveY - 20, // Apuntan ligeramente hacia arriba (luz viene de arriba)
            },
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        console.log(`[SolarCaustics 🌞] Aborted`);
    }
}
