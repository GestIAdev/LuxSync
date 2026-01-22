/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ STATIC PULSE - PULSO ESTÁTICO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (PunkOpus)
 *
 * FILOSOFÍA:
 * Interferencia electromagnética - glitch sutil y tenso.
 * Flashes cortos asíncronos entre fixtures, como si hubiera fallas eléctricas.
 * Perfecto para tensión en transiciones.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - suma con física)
 * - Pars: Flash muy corto (50ms) cada 2-4 beats, intensidad 0.3-0.5
 * - Posiciones aleatorias: No todos los pars disparan juntos
 * - Movers: NO se mueven (frozen) o micro-movimientos (±5°)
 * - Probabilidad 30% por beat → Asíncrono entre fixtures
 *
 * COLORES:
 * - WHITE con tinte COLD BLUE (#e0f0ff)
 * - Simula luz fluorescente fallando
 *
 * ZONAS:
 * - Perfecto para ambient, gentle (transiciones tensas)
 * - Ideal para crear incomodidad sutil antes de eventos grandes
 *
 * @module core/effects/library/techno/StaticPulse
 * @version WAVE 938 - ATMOSPHERIC ARSENAL (PunkOpus)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 5000, // 5 segundos (was 6s) - WAVE 964
    flashDurationMs: 50, // Flash muy corto (50ms)
    minIntervalMs: 500, // Mínimo 0.5s entre flashes
    maxIntervalMs: 1200, // Máximo 1.2s entre flashes
    flashIntensity: 0.4, // Intensidad media
    flashProbability: 0.3, // 30% chance por fixture
    bpmSync: true,
    minBeatsInterval: 2, // Mínimo 2 beats
    maxBeatsInterval: 4, // Máximo 4 beats
};
// ═══════════════════════════════════════════════════════════════════════════
// STATIC PULSE EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class StaticPulse extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('static_pulse');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'static_pulse';
        this.name = 'Static Pulse';
        this.category = 'physical'; // Afecta dimmer
        this.priority = 70; // Media-alta - WAVE 964: Subida de 50 a 70
        this.mixBus = 'global'; // WAVE 964: HTP→GLOBAL para visibilidad
        this.nextFlashTime = 0;
        this.flashEndTime = 0;
        this.isFlashing = false;
        // Qué fixtures están flashing en el frame actual
        this.activeFlashZones = new Set();
        // Mover positions (frozen o micro-movimiento)
        this.moverPan = 0;
        this.moverTilt = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.nextFlashTime = this.getRandomInterval();
        this.flashEndTime = 0;
        this.isFlashing = false;
        this.activeFlashZones.clear();
        // Movers random position (frozen)
        this.moverPan = Math.random() * 360 - 180;
        this.moverTilt = Math.random() * 40 - 20;
        console.log(`[StaticPulse ⚡] TRIGGERED! Duration=${this.config.durationMs}ms FlashInterval=${this.config.minIntervalMs}-${this.config.maxIntervalMs}ms`);
    }
    getRandomInterval() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            const msPerBeat = 60000 / this.musicalContext.bpm;
            const beatsInterval = this.config.minBeatsInterval +
                Math.random() * (this.config.maxBeatsInterval - this.config.minBeatsInterval);
            return beatsInterval * msPerBeat;
        }
        else {
            return this.config.minIntervalMs +
                Math.random() * (this.config.maxIntervalMs - this.config.minIntervalMs);
        }
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        // ═════════════════════════════════════════════════════════════════════
        // FLASH STATE MACHINE
        // ═════════════════════════════════════════════════════════════════════
        if (!this.isFlashing && this.elapsedMs >= this.nextFlashTime) {
            // TRIGGER FLASH
            this.isFlashing = true;
            this.flashEndTime = this.elapsedMs + this.config.flashDurationMs;
            // Decidir qué zones flashean (probabilistic)
            this.activeFlashZones.clear();
            const zones = ['front', 'pars', 'back'];
            zones.forEach(zone => {
                if (Math.random() < this.config.flashProbability) {
                    this.activeFlashZones.add(zone);
                }
            });
            // Micro-movimiento de movers (glitch)
            this.moverPan += (Math.random() - 0.5) * 10; // ±5°
            this.moverTilt += (Math.random() - 0.5) * 10; // ±5°
        }
        if (this.isFlashing && this.elapsedMs >= this.flashEndTime) {
            // END FLASH
            this.isFlashing = false;
            this.activeFlashZones.clear();
            // Programar próximo flash
            this.nextFlashTime = this.elapsedMs + this.getRandomInterval();
        }
        // Check si terminó
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
            console.log(`[StaticPulse ⚡] FINISHED (${this.config.durationMs}ms)`);
        }
    }
    /**
     * 📤 GET OUTPUT - Devuelve el output del frame actual
     * ⚡ WAVE 938: STATIC PULSE - Glitch asíncrono
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // Si no estamos flashing, no emitimos nada (silencio)
        if (!this.isFlashing || this.activeFlashZones.size === 0) {
            return null;
        }
        const progress = this.elapsedMs / this.config.durationMs;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: Array.from(this.activeFlashZones),
            intensity: this.triggerIntensity * this.config.flashIntensity,
            zoneOverrides: {},
        };
        // ═════════════════════════════════════════════════════════════════════
        // COLOR: WHITE con tinte COLD BLUE
        // ═════════════════════════════════════════════════════════════════════
        const color = { h: 200, s: 20, l: 95 }; // Blanco azulado
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Flash en zones activas
        // ═════════════════════════════════════════════════════════════════════
        this.activeFlashZones.forEach(zone => {
            if (zone !== 'movers') {
                output.zoneOverrides[zone] = {
                    dimmer: this.config.flashIntensity,
                    color,
                    blendMode: 'max',
                };
            }
        });
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Frozen con micro-glitch
        // ═════════════════════════════════════════════════════════════════════
        output.zoneOverrides['movers'] = {
            dimmer: 0.1, // Muy bajo - solo outline
            color,
            blendMode: 'max',
            movement: {
                pan: this.moverPan,
                tilt: this.moverTilt,
            },
        };
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
        this.isFlashing = false;
        this.activeFlashZones.clear();
        console.log(`[StaticPulse ⚡] Aborted`);
    }
}
