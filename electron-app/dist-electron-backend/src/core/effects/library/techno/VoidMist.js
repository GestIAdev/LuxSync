/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌫️ VOID MIST - NEBLINA DEL VACÍO (REWORK)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * � WAVE 2182: PARS PAINT, MOVERS PIERCE (Rework from WAVE 938)
 *
 * FILOSOFÍA (POST-REWORK):
 * La neblina ya no es un humo errante — es un pulso de oscuridad viva.
 * Los PARs respiran UV/Midnight Blue en ciclos deterministas.
 * Los movers abandonan la oscilación mecánica de pan y se congelan
 * como obeliscos negros con color LATCHED, modulando solo su dimmer.
 *
 * CAMBIOS WAVE 2182:
 * ✅ Duración: 4000ms → 3000ms (más táctico)
 * ✅ Pars: Respiración determinista sin Math.random() (Axioma Anti-Simulación)
 * ✅ Movers: getMoverColorOverride() con color latch UV estático
 * ✅ Movers: Pan/Tilt fijo — CERO movimiento mecánico
 * ✅ Movers: Dimmer modulado por sine wave (la vida está en la luz, no en el motor)
 * ✅ Eliminado Math.random() — offsets por zona derivados de beatPhase
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR — controla toda la escena)
 * - Duración: 3000ms
 * - Pars: Respiración sine 0.25Hz, UV/Midnight Blue, rango 0.10-0.45
 * - Movers: Color LATCHED Deep Purple (h:270, s:100, l:12)
 *   - Sin pan, sin tilt — congelados
 *   - Dimmer modulado por sine 0.3Hz desfasada left/right
 * - oneShot: false — cíclico
 *
 * @module core/effects/library/techno/VoidMist
 * @version WAVE 2182 — PARS PAINT, MOVERS PIERCE (rework)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 3000, // WAVE 2182: 4000 → 3000ms (más táctico)
    minIntensity: 0.10, // WAVE 2182: respiración suave pero visible
    maxIntensity: 0.45, // WAVE 2182: pico moderado
    parBreathHz: 0.25, // 4 segundos por ciclo — lento y profundo
    moverBreathHz: 0.3, // Movers respiran ligeramente más rápido
    moverMaxDimmer: 0.25, // Tenue — los movers son presencias, no protagonistas
    moverMinDimmer: 0.03, // Casi invisibles en el valle
};
// Color de latch para movers: Deep Purple UV
const VOID_MOVER_COLOR = { h: 270, s: 100, l: 12 };
// ═══════════════════════════════════════════════════════════════════════════
// VOID MIST EFFECT
// ═══════════════════════════════════════════════════════════════════════════
export class VoidMist extends BaseEffect {
    constructor(config) {
        super('void_mist');
        this.effectType = 'void_mist';
        this.name = 'Void Mist';
        this.category = 'physical';
        this.priority = 60;
        this.mixBus = 'global';
        this.isOneShot = false;
        /**
         * Offsets de fase por zona para respiración independiente.
         * Deterministas: derivados del beatPhase en trigger, no de Math.random().
         * Axioma Anti-Simulación: mismo beatPhase = mismo patrón siempre.
         */
        this.zonePhaseOffsets = {};
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        this.setDuration(this.config.durationMs);
        // Axioma Anti-Simulación: offsets derivados del beatPhase, NO de Math.random()
        const beatPhase = triggerConfig.musicalContext?.beatPhase ?? 0.0;
        this.zonePhaseOffsets = {
            'front': beatPhase * Math.PI * 2, // 0 a 2π
            'all-pars': (beatPhase + 0.33) * Math.PI * 2, // +120° offset
            'back': (beatPhase + 0.66) * Math.PI * 2, // +240° offset
            'movers-left': beatPhase * Math.PI * 1.5, // Desfase propio
            'movers-right': (beatPhase + 0.5) * Math.PI * 1.5, // 180° opuesto a left
        };
        console.log(`[VoidMist 🌫️] TRIGGERED! Duration=${this.config.durationMs}ms ` +
            `beatPhase=${beatPhase.toFixed(3)} parBreath=${this.config.parBreathHz}Hz`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
        else {
            this.phase = 'sustain';
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.getProgress();
        // ═════════════════════════════════════════════════════════════════════
        // FADE ENVELOPE — entrada/salida suaves (300ms cada extremo)
        // ═════════════════════════════════════════════════════════════════════
        let envelope = 1.0;
        const fadeMs = 300;
        if (this.elapsedMs < fadeMs) {
            envelope = this.elapsedMs / fadeMs;
        }
        else if (this.elapsedMs > this.config.durationMs - fadeMs) {
            envelope = (this.config.durationMs - this.elapsedMs) / fadeMs;
        }
        envelope = Math.max(0, Math.min(1, envelope));
        // ═════════════════════════════════════════════════════════════════════
        // COLOR TRANSITION: DARK PURPLE → MIDNIGHT BLUE (progresiva)
        // ═════════════════════════════════════════════════════════════════════
        const hue = 270 - progress * 50; // 270 (purple) → 220 (midnight blue)
        const parColor = { h: hue, s: 100, l: 10 };
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: ['front', 'all-pars', 'back', 'movers-left', 'movers-right'],
            intensity: this.triggerIntensity,
            zoneOverrides: {},
        };
        // ═════════════════════════════════════════════════════════════════════
        // PARS: Respiración determinista por zona
        // Sine wave a parBreathHz con offset derivado de beatPhase
        // ═════════════════════════════════════════════════════════════════════
        const parPeriodMs = 1000 / this.config.parBreathHz;
        const parZones = ['front', 'all-pars', 'back'];
        for (const zone of parZones) {
            const phaseOffset = this.zonePhaseOffsets[zone] ?? 0;
            const breathPhase = (this.elapsedMs / parPeriodMs) * 2 * Math.PI + phaseOffset;
            const breathPulse = (Math.sin(breathPhase) + 1) / 2; // 0-1
            const dimmer = (this.config.minIntensity +
                breathPulse * (this.config.maxIntensity - this.config.minIntensity)) * envelope * this.triggerIntensity;
            output.zoneOverrides[zone] = {
                dimmer,
                color: { ...parColor },
                blendMode: 'max',
            };
        }
        // ═════════════════════════════════════════════════════════════════════
        // MOVERS: Color LATCHED (Deep Purple UV), dimmer modulado, SIN MOVIMIENTO
        // WAVE 2182: "Pars paint, Movers pierce"
        // - getMoverColorOverride() con color estático
        // - Sin pan, sin tilt — congelados como monolitos
        // - La vida está en la modulación del dimmer
        // ═════════════════════════════════════════════════════════════════════
        const moverPeriodMs = 1000 / this.config.moverBreathHz;
        const leftPhaseOffset = this.zonePhaseOffsets['movers-left'] ?? 0;
        const rightPhaseOffset = this.zonePhaseOffsets['movers-right'] ?? 0;
        const leftPulse = (Math.sin((this.elapsedMs / moverPeriodMs) * 2 * Math.PI + leftPhaseOffset) + 1) / 2;
        const rightPulse = (Math.sin((this.elapsedMs / moverPeriodMs) * 2 * Math.PI + rightPhaseOffset) + 1) / 2;
        const dimmerLeft = (this.config.moverMinDimmer +
            (this.config.moverMaxDimmer - this.config.moverMinDimmer) * leftPulse) * envelope * this.triggerIntensity;
        const dimmerRight = (this.config.moverMinDimmer +
            (this.config.moverMaxDimmer - this.config.moverMinDimmer) * rightPulse) * envelope * this.triggerIntensity;
        output.zoneOverrides['movers-left'] = this.getMoverColorOverride(VOID_MOVER_COLOR, dimmerLeft);
        output.zoneOverrides['movers-right'] = this.getMoverColorOverride(VOID_MOVER_COLOR, dimmerRight);
        return output;
    }
    isFinished() {
        return this.phase === 'finished';
    }
    abort() {
        this.phase = 'finished';
    }
}
