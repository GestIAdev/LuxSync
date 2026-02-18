/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ LASER CANDY - UV STABS (formerly Static Pulse)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔬 WAVE 938: ATMOSPHERIC ARSENAL (PunkOpus)
 * 🎨 WAVE 976.9: COLOR REVAMP - "Laser Candy" (PunkOpus + Radwulf)
 *
 * FILOSOFÍA:
 * Stabs de láser puro que perforan el ambiente techno frío.
 * Ya no son "fallos eléctricos" - son LÁSERES PSICODÉLICOS.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (ADITIVO - punzadas de color sobre físicas)
 * - Pars: Flash muy corto (50ms) cada 2-4 beats, intensidad 0.4-0.7
 * - Posiciones aleatorias: No todos los pars disparan juntos
 * - Movers: Frozen o micro-movimientos (±5°)
 * - Probabilidad 30% por beat → Asíncrono entre fixtures
 *
 * COLORES DINÁMICOS (según intensidad):
 * - Intensity < 0.5  → 🟣 UV VIOLETA (#9D00FF) - Sutil, misterioso, blacklight
 * - Intensity 0.5-0.8 → 🟢 VERDE LÁSER (#00FF00) - Clásico, potente, cyberpunk
 * - Intensity > 0.8  → 🔵 AZUL ELÉCTRICO (#0099FF) - Nuclear, high energy
 *
 * ZONAS:
 * - Perfecto para ambient, gentle, valley (puntuaciones sutiles)
 * - En active/intense: Stabs potentes que cortan el ambiente
 *
 * @module core/effects/library/techno/StaticPulse
 * @version WAVE 976.9 - LASER CANDY
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 5000, // 5 segundos (was 6s) - WAVE 964
    flashDurationMs: 50, // Flash muy corto (50ms)
    minIntervalMs: 500, // Mínimo 0.5s entre flashes
    maxIntervalMs: 1200, // Máximo 1.2s entre flashes
    flashIntensity: 0.75, // 🛡️ WAVE 984: 0.4 → 0.75 (BOOST para compensar movers)
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
            const zones = ['front', 'all-pars', 'back'];
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
        // 🎨 WAVE 976.9: LASER CANDY - Color dinámico según intensidad
        // ═════════════════════════════════════════════════════════════════════
        // Intensity < 0.5  → 🟣 UV VIOLETA (misterioso, sutil)
        // Intensity 0.5-0.8 → 🟢 VERDE LÁSER (clásico, potente)
        // Intensity > 0.8  → 🔵 AZUL ELÉCTRICO (nuclear)
        // ═════════════════════════════════════════════════════════════════════
        const effectiveIntensity = this.triggerIntensity * this.config.flashIntensity;
        let color;
        if (effectiveIntensity < 0.5) {
            // 🟣 UV VIOLETA - Blacklight effect
            color = { h: 270, s: 100, l: 50 }; // #9D00FF
        }
        else if (effectiveIntensity < 0.8) {
            // 🟢 VERDE LÁSER - Cyberpunk classic
            color = { h: 120, s: 100, l: 50 }; // #00FF00
        }
        else {
            // 🔵 AZUL ELÉCTRICO - High energy nuclear
            color = { h: 200, s: 100, l: 50 }; // #0099FF
        }
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Flash en zones activas
        // ═════════════════════════════════════════════════════════════════════
        this.activeFlashZones.forEach(zone => {
            if (zone !== 'all-movers') {
                output.zoneOverrides[zone] = {
                    dimmer: this.config.flashIntensity,
                    color,
                    blendMode: 'max',
                };
            }
        });
        // ═════════════════════════════════════════════════════════════════════
        // 🛡️ WAVE 984: THE MOVER LAW - MOVERS CASTRADOS
        // "Si dura >2s, los Movers tienen PROHIBIDO modular color"
        // StaticPulse dura 5s → Movers ELIMINADOS del output
        // ═════════════════════════════════════════════════════════════════════
        // ANTES: Movers con color + micro-glitch
        // AHORA: SIN MOVERS - Solo los Pars disparan
        // output.zoneOverrides!['movers'] = { ... } → ELIMINADO
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
