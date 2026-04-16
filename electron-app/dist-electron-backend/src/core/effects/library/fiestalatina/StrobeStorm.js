/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚡ STROBE STORM - PEAK ZONE CHAOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680:  THE ARSENAL — Primera arma de asalto
 * WAVE 1004.4: THE LATINO LADDER — Posicionado en PEAK ZONE (A=0.95)
 * WAVE 2214:  THE REAL STORM — Era un pequeño flash azul. Arreglado.
 * WAVE 2700:  LA VERDADERA TORMENTA — Rediseño total.
 *             "Pulso sinusoidal al 70%" era inaceptable. Ahora es caos puro.
 *
 * DNA PROFILE (THE LATINO LADDER):
 * ┌─────────────────────────────────────────────────┐
 * │ Aggression:  0.98 → PEAK ZONE MÁXIMO           │
 * │ Complexity:  0.80 → Caos multi-fase asíncrono  │
 * │ Organicity:  0.10 → Mecánico/Brutal/Industrial │
 * │ Duration:    SHORT → COLOR PASS-THROUGH movers │
 * └─────────────────────────────────────────────────┘
 *
 * ARQUITECTURA (WAVE 2700):
 *   - PRE-BLACKOUT: 60ms de silencio total antes del caos (contraste máximo)
 *   - BURST VOLLEY: ráfagas de cortes duros a frecuencias altas (18-25 Hz)
 *     usando divisiones de BPM para mantener sincronía musical
 *   - CHAOS ENGINE: generador determinista de asimetría (sin Math.random)
 *     — el caos nace del BPM y el beatPhase, no de números aleatorios
 *   - DECAY: desaceleración en escalones (no lineal), cortes bruscos al final
 *   - movers: color: undefined → PASS-THROUGH (Layer 0 aporta el color base,
 *     StrobeStorm solo dispara dimmer al 100%)
 *
 * FILOSOFÍA:
 *   El strobe NO gradúa intensidades. Un strobe es ON (100%) u OFF (0%).
 *   Cualquier valor intermedio es un pulso suave disfrazado, no una tormenta.
 *
 * @module core/effects/library/fiestalatina/StrobeStorm
 * @version WAVE 680, 1004.4, 2214, 2700
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    preBlackoutMs: 60, // 60ms de silencio absoluto (contraste quirúrgico)
    burstMs: 700, // 700ms de infierno
    decayMs: 130, // 130ms de salida en escalones
    burstFrequencyHz: 18, // 18Hz base — PEAK ZONE VIOLENTO
    maxFrequencyHz: 25, // Techo absoluto (hardware safety)
    degradedMode: false,
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
        // ILightEffect required properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'strobe_storm';
        this.name = 'Strobe Storm';
        this.category = 'physical';
        this.priority = 90;
        this.mixBus = 'global'; // Dictador — suprime Layer 0 en burst
        this.phaseStartMs = 0; // timestamp de when this.phase started
        this.activeFrequencyHz = 0; // frecuencia actual del strobe
        this.strobeAccMs = 0; // acumulador del half-cycle del strobe
        this.isFlashOn = false; // estado ON/OFF del flash software
        this.flashDirty = false; // garantía: al menos 1 frame visible en cada toggle
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC: Vibe constraints (called by EffectManager before trigger)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🛡️ SET VIBE CONSTRAINTS
     * Establece los límites del Vibe para esta instancia.
     * EffectManager llama esto antes de trigger().
     */
    setVibeConstraints(maxHz, degraded) {
        this.config.maxFrequencyHz = maxHz;
        this.config.degradedMode = degraded;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        this.phase = 'attack'; // 'attack' = pre-blackout
        this.phaseStartMs = this.elapsedMs;
        this.activeFrequencyHz = 0;
        this.strobeAccMs = 0;
        this.isFlashOn = false;
        this.flashDirty = false;
        const mode = this.config.degradedMode ? ' [DEGRADED]' : '';
        console.log(`[StrobeStorm ⚡] TRIGGERED! f=${this.config.burstFrequencyHz}Hz maxHz=${this.config.maxFrequencyHz}${mode}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        const phaseElapsed = this.elapsedMs - this.phaseStartMs;
        switch (this.phase) {
            case 'attack':
                // attack = pre-blackout phase
                if (phaseElapsed >= this.config.preBlackoutMs) {
                    this.transitionPhase('sustain');
                    this.activeFrequencyHz = this.computeBurstFrequency();
                }
                break;
            case 'sustain':
                // Frecuencia asíncrona modulada por divisiones de BPM
                this.activeFrequencyHz = this.computeBurstFrequency();
                this.advanceStrobeCycle(deltaMs);
                if (phaseElapsed >= this.config.burstMs) {
                    this.transitionPhase('decay');
                }
                break;
            case 'decay':
                // Escalones: cada 35ms baja un slot de frecuencia
                const decayProgress = Math.min(1, phaseElapsed / this.config.decayMs);
                // 3 escalones bruscos (no rampa lineal)
                const step = Math.floor(decayProgress * 3);
                const stepFreq = [0.65, 0.35, 0.0];
                const freqFactor = stepFreq[step] ?? 0;
                this.activeFrequencyHz = this.computeBurstFrequency() * freqFactor;
                this.advanceStrobeCycle(deltaMs);
                if (decayProgress >= 1) {
                    this.transitionPhase('finished');
                    this.activeFrequencyHz = 0;
                    console.log(`[StrobeStorm ⚡] Impact complete — ${this.elapsedMs}ms total`);
                }
                break;
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // PRE-BLACKOUT: silencio forzado antes del burst
        if (this.phase === 'attack') {
            return {
                effectId: this.id,
                category: this.category,
                phase: this.phase,
                progress: 0,
                zones: this.zones,
                intensity: 0,
                dimmerOverride: 0,
                globalComposition: 1.0,
                zoneOverrides: {
                    front: { dimmer: 0, blendMode: 'replace' },
                    back: { dimmer: 0, blendMode: 'replace' },
                    'all-movers': { dimmer: 0, blendMode: 'replace' },
                },
            };
        }
        // DEGRADED: pulso de dimmer duro (sin sinusoide suave — la directiva es clara)
        if (this.config.degradedMode) {
            return this.getDegradedOutput();
        }
        // BURST / DECAY: strobe real con movers en pass-through de color
        return this.getStrobeOutput();
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Strobe cycle — frame-guaranteed (WAVE 2493 pattern preserved)
    // ─────────────────────────────────────────────────────────────────────────
    advanceStrobeCycle(deltaMs) {
        if (this.activeFrequencyHz <= 0) {
            this.isFlashOn = false;
            return;
        }
        const halfCycleMs = 500 / this.activeFrequencyHz;
        this.strobeAccMs += deltaMs;
        while (this.strobeAccMs >= halfCycleMs) {
            this.strobeAccMs -= halfCycleMs;
            this.isFlashOn = !this.isFlashOn;
            this.flashDirty = true; // garantiza al menos 1 frame visible del toggle
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Frequency computation — CHAOS ENGINE (determinista, no random)
    //
    // El caos no nace de Math.random() (prohibido por Axioma Anti-Simulación).
    // Nace de:
    //   - El BPM: dictamine el pulso base
    //   - beatPhase: la posición dentro del beat crea asimetría natural
    //   - Divisiones de subbeat (16ths, 32nds) como multiplicadores
    //
    // Resultado: una frecuencia que PARECE caótica pero es musical y
    // reproducible dado el mismo contexto musical.
    // ─────────────────────────────────────────────────────────────────────────
    computeBurstFrequency() {
        const base = this.config.burstFrequencyHz * this.triggerIntensity;
        const zAdjusted = this.getIntensityFromZScore(base, 0.35);
        // Asimetría determinista basada en beatPhase
        // beatPhase oscila 0→1 cada beat; usamos fracturas de subbeat
        const beatPhase = this.musicalContext?.beatPhase ?? 0;
        // Fold beatPhase en 32nds (0.03125) — crea picos en tiempos fuertes
        const subGrid = (beatPhase * 32) % 1; // 0-1 dentro de un 32nd
        // En la primera mitad del 32nd (+10%), en la segunda mitad (-15%)
        const asymFactor = subGrid < 0.5 ? 1.10 : 0.85;
        const raw = zAdjusted * asymFactor;
        return Math.min(raw, this.config.maxFrequencyHz);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output generators
    // ─────────────────────────────────────────────────────────────────────────
    getStrobeOutput() {
        // ⚡ WAVE 2493 dual-path:
        //   Hardware: dimmerOverride + strobeRate → fixture strobe channel hace el trabajo real
        //   Simulator: isFlashOn toggle → canvas ve los flashes
        const visualIntensity = this.isFlashOn ? this.triggerIntensity : 0;
        this.flashDirty = false; // consume el flag
        const progress = this.calculateProgress();
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: this.zones,
            intensity: visualIntensity,
            // DMX hardware: full dimmer + strobe channel
            strobeRate: this.activeFrequencyHz,
            dimmerOverride: this.triggerIntensity,
            whiteOverride: this.triggerIntensity,
            // ⚡ WAVE 2700: ZONE-COMPLETE con movers en COLOR PASS-THROUGH
            // front/back: Blanco puro (máximo impacto físico en PARs RGB)
            // movers: color: undefined → hereda Layer 0 (Vibe base color)
            //   StrobeStorm solo dispara dimmer 100% en movers, no reemplaza color
            zoneOverrides: {
                front: {
                    color: { h: 0, s: 0, l: 100 }, // Blanco puro
                    dimmer: this.isFlashOn ? this.triggerIntensity : 0,
                    blendMode: 'replace',
                },
                back: {
                    color: { h: 0, s: 0, l: 100 }, // Blanco puro
                    dimmer: this.isFlashOn ? this.triggerIntensity : 0,
                    blendMode: 'replace',
                },
                'movers-left': {
                    // 🌑 WAVE 2700: COLOR PASS-THROUGH — undefined = Layer 0 manda el color
                    color: undefined,
                    dimmer: this.isFlashOn ? this.triggerIntensity : 0,
                    blendMode: 'replace',
                },
                'movers-right': {
                    color: undefined,
                    dimmer: this.isFlashOn ? this.triggerIntensity : 0,
                    blendMode: 'replace',
                },
            },
            // Dictador total — suprime cualquier layer inferior durante la tormenta
            globalComposition: 1.0,
        };
    }
    getDegradedOutput() {
        // Modo degradado forzado por Vibe (ej. entorno donde el strobe está prohibido).
        // WAVE 2700: Ya NO es un pulso sinusoidal. Es un corte duro ON/OFF
        // modulado cada 2 beats. Suave NO. Degradado NO significa cariñoso.
        const bpm = this.getCurrentBpm(120);
        const msPerBeat = 60000 / bpm;
        const cutPeriodMs = msPerBeat * 2; // corte cada 2 beats
        const pos = (this.elapsedMs % cutPeriodMs) / cutPeriodMs;
        // Primera mitad: encendido / Segunda mitad: apagado — corte duro
        const dimmer = pos < 0.5 ? this.triggerIntensity : 0;
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones,
            intensity: dimmer,
            dimmerOverride: dimmer,
            // Sin color — pass-through en modo degradado también
            globalComposition: 1.0,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────
    transitionPhase(newPhase) {
        this.phase = newPhase;
        this.phaseStartMs = this.elapsedMs;
    }
    calculateProgress() {
        const total = this.config.preBlackoutMs + this.config.burstMs + this.config.decayMs;
        return Math.min(1, this.elapsedMs / total);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createStrobeStorm(config) {
    return new StrobeStorm(config);
}
