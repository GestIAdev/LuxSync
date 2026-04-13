/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ STROBE STORM - PEAK ZONE CHAOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680: THE ARSENAL - Primera arma de asalto
 * 🪜 WAVE 1004.4: THE LATINO LADDER - Posicionado en PEAK ZONE (A=0.95)
 * ⚡ WAVE 2214: THE REAL STORM — Era un pequeño flash azul. Arreglado.
 *
 * EL ARMA DEFINITIVA - Solo para momentos CLIMAX.
 * Strobe caótico pero controlado, reservado para los drops más intensos.
 *
 * DNA PROFILE (THE LATINO LADDER):
 * ┌─────────────────────────────────────────────────┐
 * │ Aggression:  0.95 → PEAK ZONE (90-100%)        │
 * │ Complexity:  0.75 → Caos controlado multi-fase │
 * │ Organicity:  0.15 → Mecánico/Industrial        │
 * │ Duration:    SHORT → COLOR PERMITIDO en movers │
 * └─────────────────────────────────────────────────┘
 *
 * COMPORTAMIENTO (WAVE 2214):
 * - PRE-BLACKOUT: 50ms de negro antes del caos
 * - ATTACK:  Arranca a FULL frequency INMEDIATAMENTE (ya no ramp-up lento)
 * - SUSTAIN: Caos máximo — frecuencia oscila con BPM
 * - DECAY:   Desaceleración gradual
 * - globalComposition: SIEMPRE 1.0 (era 0 fuera de sustain → efecto invisible)
 *
 * FÍSICA:
 * - Frecuencia sincronizada al BPM
 * - Intensidad modulada por Z-Score
 * - Asíncrono pero musical (no random puro)
 *
 * @module core/effects/library/StrobeStorm
 * @version WAVE 680, 1004.4, 2214
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    attackMs: 40, // ⚡ WAVE 2214: 80→40ms. La storm arranca en 40ms, no en 80.
    sustainMs: 700, // ⚡ WAVE 2214: 600→700ms. Más tiempo de infierno.
    decayMs: 120, // ⚡ WAVE 2214: 150→120ms. Sale más rápido = más impacto percibido.
    baseFrequencyHz: 14, // ⚡ WAVE 2214: 12→14 Hz base. PEAK = VIOLENTO.
    degradedMode: false,
    flashColor: { h: 0, s: 0, l: 100 }, // Blanco puro — la storm es blanca, no azul
    preBlackoutMs: 50, // 🪜 LADDER: 50ms negro antes del caos
};
// ═══════════════════════════════════════════════════════════════════════════
// STROBE STORM CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class StrobeStorm extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('strobe_storm');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'strobe_storm';
        this.name = 'Strobe Storm';
        this.category = 'physical';
        this.priority = 90; // Alta, pero menor que Solar Flare
        this.phaseStartTime = 0;
        this.currentFrequency = 0;
        this.maxAllowedFrequency = 15; // Default, overridden by vibe
        this.strobePhase = 0; // ms acumulados dentro del half-cycle actual
        this.isFlashOn = false;
        this.flashDirty = false; // 🔧 WAVE 2493: garantiza 1 frame de visibilidad
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: Set max allowed frequency (called by EffectManager based on Vibe)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🛡️ SET MAX FREQUENCY - The Shield in action
     *
     * Called by EffectManager before trigger based on Vibe constraints.
     *
     * @param maxHz Maximum allowed strobe frequency
     * @param degraded If true, use pulse mode instead of strobe
     */
    setVibeConstraints(maxHz, degraded) {
        this.maxAllowedFrequency = maxHz;
        this.config.degradedMode = degraded;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        this.phaseStartTime = Date.now();
        this.currentFrequency = 0;
        this.strobePhase = 0;
        this.isFlashOn = false;
        this.flashDirty = false;
        const mode = this.config.degradedMode ? '(DEGRADED)' : '';
        console.log(`[StrobeStorm ⚡] TRIGGERED! MaxHz=${this.maxAllowedFrequency} ${mode}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        const phaseElapsed = Date.now() - this.phaseStartTime;
        switch (this.phase) {
            case 'attack':
                this.processAttack(phaseElapsed);
                break;
            case 'sustain':
                this.processSustain(phaseElapsed, deltaMs);
                break;
            case 'decay':
                this.processDecay(phaseElapsed);
                break;
        }
        // Update strobe cycle
        this.updateStrobeCycle(deltaMs);
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // En modo degradado, no enviamos strobeRate - solo dimmer pulses
        if (this.config.degradedMode) {
            return this.getDegradedOutput();
        }
        // Modo normal: strobe real
        return this.getStrobeOutput();
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Phase processors
    // ─────────────────────────────────────────────────────────────────────────
    processAttack(phaseElapsed) {
        const progress = Math.min(1, phaseElapsed / this.config.attackMs);
        // ⚡ WAVE 2214: Arranca a FULL frequency desde el primer ms
        // Antes: ease-in desde 0 → llegaba al máximo al final del attack (80ms de "nada")
        // Ahora: 80% del max en el primer frame, sube al 100% en los 40ms restantes
        const targetFreq = this.calculateTargetFrequency();
        this.currentFrequency = targetFreq * (0.8 + 0.2 * this.easeInOutCubic(progress));
        if (progress >= 1) {
            this.transitionTo('sustain');
        }
    }
    processSustain(phaseElapsed, deltaMs) {
        // Frecuencia oscila sutilmente con el beat
        const bpmPulse = this.getBpmPulse(2); // Medio beat
        const baseFreq = this.calculateTargetFrequency();
        // Modular ±20% con el beat
        this.currentFrequency = baseFreq * (0.9 + bpmPulse * 0.2);
        if (phaseElapsed >= this.config.sustainMs) {
            this.transitionTo('decay');
        }
    }
    processDecay(phaseElapsed) {
        const progress = Math.min(1, phaseElapsed / this.config.decayMs);
        // Desaceleración gradual
        const targetFreq = this.calculateTargetFrequency();
        this.currentFrequency = targetFreq * (1 - this.easeInOutCubic(progress));
        if (progress >= 1) {
            this.transitionTo('finished');
            console.log(`[StrobeStorm ⚡] Completed (${this.elapsedMs}ms total)`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Strobe cycle logic
    //
    // 🔧 WAVE 2493: FRAME-GUARANTEED STROBE
    // At 14Hz the ON half-cycle is 35ms — shorter than a single frame at
    // 25fps (40ms) or under STAMPEDE lag (55ms). The old code advanced
    // strobePhase and derived isFlashOn from < 0.5, which meant the
    // ON→OFF transition could happen BETWEEN two getOutput() calls and
    // the simulator would NEVER see the flash.
    //
    // FIX: Track elapsed time within each half-cycle. When the half-cycle
    // toggles, set a "flash dirty" flag so the NEXT getOutput() always
    // sees at least 1 frame of the new state.
    // ─────────────────────────────────────────────────────────────────────────
    updateStrobeCycle(deltaMs) {
        if (this.currentFrequency <= 0) {
            this.isFlashOn = false;
            return;
        }
        const halfCycleMs = 500 / this.currentFrequency; // half-period in ms
        this.strobePhase += deltaMs;
        // Toggle flash state each half-cycle, guarantee at least 1 frame visible
        while (this.strobePhase >= halfCycleMs) {
            this.strobePhase -= halfCycleMs;
            this.isFlashOn = !this.isFlashOn;
            this.flashDirty = true; // output MUST read this state at least once
        }
    }
    calculateTargetFrequency() {
        // Base frequency modulada por Z-Score
        const baseFreq = this.config.baseFrequencyHz * this.triggerIntensity;
        const zScaleFreq = this.getIntensityFromZScore(baseFreq, 0.4);
        // Cap al máximo permitido por el Vibe
        return Math.min(zScaleFreq, this.maxAllowedFrequency);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output generators
    // ─────────────────────────────────────────────────────────────────────────
    getStrobeOutput() {
        // 🔧 WAVE 2493: Dual-path output
        //
        // DMX HARDWARE: dimmerOverride = triggerIntensity (ALWAYS on),
        //   strobeRate = currentFrequency → the fixture's strobe channel does
        //   the real flashing at 14Hz. No software toggle needed.
        //
        // SIMULATOR VISUAL: intensity toggles ON/OFF for the canvas/3D viz.
        //   flashDirty guarantees at least 1 frame of the ON state is emitted.
        const visualIntensity = this.isFlashOn ? this.triggerIntensity : 0;
        // Consume the dirty flag — the simulator got its frame
        this.flashDirty = false;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones,
            intensity: visualIntensity,
            // ⚡ STROBE RATE — the DMX fixture handles the real flash
            strobeRate: this.currentFrequency,
            // 🔧 WAVE 2493: Dimmer ALWAYS at full during storm.
            // The strobe channel handles the flashing. Keeping dimmer at 0
            // during flash-OFF killed the effect on real hardware too.
            dimmerOverride: this.triggerIntensity,
            // Blanco puro para máximo impacto
            whiteOverride: this.triggerIntensity,
            // Color del flash
            colorOverride: this.config.flashColor,
            // ⚡ WAVE 2214: globalComposition SIEMPRE 1.0
            globalComposition: 1.0,
        };
    }
    getDegradedOutput() {
        // Modo degradado: pulsos de dimmer sin strobe real
        // Para vibes como fiesta-latina que no permiten strobe
        // Usar pulso sinusoidal en lugar de strobe duro
        const bpm = this.getCurrentBpm(120);
        const pulsePeriod = 60000 / bpm / 2; // Pulso cada medio beat
        const pulse = this.getSinePulse(pulsePeriod);
        const intensity = pulse * this.triggerIntensity * 0.7; // 70% de intensidad max
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones,
            intensity: intensity,
            // SIN strobeRate - solo dimmer pulses
            dimmerOverride: intensity,
            // Color cálido en lugar de blanco (menos agresivo)
            colorOverride: { h: 45, s: 80, l: 60 }, // Naranja cálido
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    transitionTo(newPhase) {
        this.phase = newPhase;
        this.phaseStartTime = Date.now();
    }
    calculateProgress() {
        const totalDuration = this.config.attackMs + this.config.sustainMs + this.config.decayMs;
        return Math.min(1, this.elapsedMs / totalDuration);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createStrobeStorm(config) {
    return new StrobeStorm(config);
}
