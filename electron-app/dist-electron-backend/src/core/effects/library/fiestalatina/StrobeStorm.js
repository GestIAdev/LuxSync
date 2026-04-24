/**
 * =============================================================================
 * STROBE STORM - TORMENTA MULTI-ZONA
 * =============================================================================
 *
 * WAVE 680:    THE ARSENAL — Primera arma de asalto
 * WAVE 1004.4: THE LATINO LADDER — Posicionado en PEAK ZONE (A=0.95)
 * WAVE 2214:   THE REAL STORM — Era un pequeño flash azul. Arreglado.
 * WAVE 2700:   LA VERDADERA TORMENTA — Rediseño total. Caos puro.
 * WAVE 3300:   LA TORMENTA MULTI-ZONA — Reescritura total.
 *              Inspirado en GatlingRaid pero libre y caótico.
 *              NO usamos canal strobe nativo. DIMMER es dios.
 *              Pulsos ultra-rápidos de dimmer simulan strobe
 *              con más control, más musicalidad y sin artefactos
 *              de shutter mecánico.
 *
 * DNA PROFILE (THE LATINO LADDER):
 *   Aggression:  0.98  — PEAK ZONE MÁXIMO
 *   Complexity:  0.90  — Caos multi-zona concurrente
 *   Organicity:  0.10  — Mecánico/Brutal/Industrial
 *   Duration:    SHORT — COLOR PASS-THROUGH movers
 *
 * ARQUITECTURA (WAVE 3300):
 *
 *   FILOSOFÍA DE HARDWARE:
 *   Canal "strobe" nativo de fixtures = shutter mecánico.
 *   No todos los fixtures lo tienen, y los que lo tienen
 *   tienen latencia y artefactos mecánicos (ruido, drift).
 *   Solución: DIMMER es dios. Pulsos on/off de dimmer a
 *   20-30 Hz simulan strobe con precisión de frame.
 *   (misma técnica que GatlingRaid — cero strobeRate en output)
 *
 *   FASES:
 *   1. PRE-BLACKOUT (60ms)
 *      Silencio total. Contraste máximo. La calma antes del caos.
 *
 *   2. VOLLEY BURST (800ms)
 *      7 voleas paralelas e independientes, cada una con su propio
 *      half-cycle determinista. Las zonas no parpadean en sincronía —
 *      la asimetría entre ellas ES la tormenta.
 *
 *      ZONAS (independientes):
 *        front-left    -> volley 0
 *        front-center  -> volley 1
 *        front-right   -> volley 2
 *        back-left     -> volley 3
 *        back-right    -> volley 4
 *        movers-left   -> volley 5 (PASS-THROUGH color)
 *        movers-right  -> volley 6 (PASS-THROUGH color)
 *
 *      Cada volley tiene su propio acumulador de tiempo, su propio
 *      half-cycle y su propia fase inicial (calculada desde BPM y
 *      el índice de zona — determinista, sin Math.random).
 *
 *   3. DECAY (150ms)
 *      Zonas se apagan en cascada (front primero, movers último).
 *      No es una rampa lineal — es un countdown de slots.
 *
 *   NOTAS:
 *   - Sin canal strobeRate en output (dimmer puro)
 *   - Movers: color: undefined -> PASS-THROUGH (Layer 0 manda el color)
 *   - StrobeStorm solo dispara dimmer en movers, nunca reemplaza color
 *   - Chaos engine 100% determinista (BPM + beatPhase + zone index)
 *
 * @module core/effects/library/fiestalatina/StrobeStorm
 * @version WAVE 680, 1004.4, 2214, 2700, 3300
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    preBlackoutMs: 60, // Silencio quirúrgico antes del caos
    burstMs: 800, // 800ms de infierno multi-zona
    decayMs: 150, // Cascada de apagado por zona
    burstFrequencyHz: 15, // WAVE 3471: strobe software bloqueado a 15Hz
    maxFrequencyHz: 15, // WAVE 3471: techo estricto de 15Hz
    degradedMode: false,
};
// Zonas que participan en la tormenta y su orden de decay.
// Índice 0..6 — usado como semilla para el chaos engine (determinista).
const STORM_ZONES = [
    'front-left', // 0
    'front-center', // 1
    'front-right', // 2
    'back-left', // 3
    'back-right', // 4
    'movers-left', // 5 — COLOR PASS-THROUGH
    'movers-right', // 6 — COLOR PASS-THROUGH
];
// Zonas de movers que NO reciben color (pass-through)
const MOVER_ZONES = new Set(['movers-left', 'movers-right']);
// =============================================================================
// STROBE STORM CLASS
// =============================================================================
export class StrobeStorm extends BaseEffect {
    // ---------------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------------
    constructor(config) {
        super('strobe_storm');
        // ---------------------------------------------------------------------------
        // ILightEffect required properties
        // ---------------------------------------------------------------------------
        this.effectType = 'strobe_storm';
        this.name = 'Strobe Storm';
        this.category = 'physical';
        this.priority = 90;
        this.mixBus = 'global'; // Dictador — suprime Layer 0 durante tormenta
        this.phaseStartMs = 0;
        // Un estado de volley independiente por zona
        this.volleys = [];
        // Qué zonas siguen activas en la fase decay (se apagan en cascada)
        this.activeInDecay = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ---------------------------------------------------------------------------
    // PUBLIC: Vibe constraints (called by EffectManager before trigger)
    // ---------------------------------------------------------------------------
    setVibeConstraints(maxHz, degraded) {
        void maxHz;
        // WAVE 3471/3471.1: StrobeStorm queda bloqueado a 15Hz, sin degradación por BPM ni límites dinámicos.
        this.config.maxFrequencyHz = 15;
        this.config.degradedMode = degraded;
    }
    // ---------------------------------------------------------------------------
    // ILightEffect implementation
    // ---------------------------------------------------------------------------
    trigger(config) {
        super.trigger(config);
        this.phase = 'attack'; // attack = pre-blackout
        this.phaseStartMs = this.elapsedMs;
        // Inicializar volleys — un cañón por zona, con phase offset determinista.
        // Derivado del BPM y del índice de zona — sin Math.random.
        //   offset = (i × beatsub32) % halfCycleMs
        //   donde beatsub32 = período de un 32avo de beat en ms
        const baseHz = 15;
        this.volleys = STORM_ZONES.map((_, i) => {
            return {
                accMs: 0,
                isOn: true,
                halfCycleMs: this.computeHalfCycle(i),
            };
        });
        this.activeInDecay = STORM_ZONES.map(() => true);
        const mode = this.config.degradedMode ? ' [DEGRADED]' : '';
        console.log(`[StrobeStorm] TRIGGERED! baseHz=${baseHz} maxHz=${this.config.maxFrequencyHz} zones=${STORM_ZONES.length}${mode}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        const phaseElapsed = this.elapsedMs - this.phaseStartMs;
        switch (this.phase) {
            case 'attack':
                if (phaseElapsed >= this.config.preBlackoutMs) {
                    this.transitionPhase('sustain');
                    // Recalcular halfCycles con BPM actualizado al inicio del burst
                    this.volleys.forEach((v, i) => {
                        v.halfCycleMs = this.computeHalfCycle(i);
                    });
                }
                break;
            case 'sustain':
                this.advanceAllVolleys(deltaMs);
                // Recalcular halfCycles cada frame (BPM puede cambiar en vivo)
                this.volleys.forEach((v, i) => {
                    v.halfCycleMs = this.computeHalfCycle(i);
                });
                if (phaseElapsed >= this.config.burstMs) {
                    this.transitionPhase('decay');
                }
                break;
            case 'decay': {
                this.advanceAllVolleys(deltaMs);
                // WAVE 3471.1: Global total en decay — sin apagado en cascada por zonas.
                const decayProgress = Math.min(1, phaseElapsed / this.config.decayMs);
                if (decayProgress >= 1) {
                    this.transitionPhase('finished');
                    console.log(`[StrobeStorm] Impact complete — ${this.elapsedMs.toFixed(0)}ms total`);
                }
                break;
            }
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // PRE-BLACKOUT: silencio total — contraste máximo antes del primer flash
        if (this.phase === 'attack') {
            return this.buildBlackoutOutput();
        }
        // DEGRADED: pulso duro de 2 beats cuando el vibe lo restringe
        if (this.config.degradedMode) {
            return this.getDegradedOutput();
        }
        return this.buildStormOutput();
    }
    // ---------------------------------------------------------------------------
    // Volley engine
    // ---------------------------------------------------------------------------
    advanceAllVolleys(deltaMs) {
        for (let i = 0; i < this.volleys.length; i++) {
            const v = this.volleys[i];
            // En decay, no avanzar las zonas ya apagadas
            if (this.phase === 'decay' && !this.activeInDecay[i])
                continue;
            v.accMs += deltaMs;
            while (v.accMs >= v.halfCycleMs) {
                v.accMs -= v.halfCycleMs;
                v.isOn = !v.isOn;
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Half-cycle computation — CHAOS ENGINE (determinista, sin Math.random)
    //
    // El "caos" es musical: nace del BPM (ritmo real de la pista),
    // del beatPhase (posición exacta dentro del beat), y del índice
    // de zona (desincronización geográfica de los fixtures).
    //
    // Cada zona tiene un half-cycle ligeramente diferente, creando
    // la asimetría visual que percibimos como "tormenta".
    // ---------------------------------------------------------------------------
    computeHalfCycle(zoneIndex) {
        void zoneIndex;
        // ⚡ WAVE 3471: Oscilador estricto a 15Hz.
        // 66ms por ciclo completo, 33ms por half-cycle.
        return 33;
    }
    calculateState() {
        // ⚡ WAVE 3471: Oscilador estricto a 15Hz (66.6ms por ciclo)
        const strobePeriodMs = 66;
        const pos = this.elapsedMs % strobePeriodMs;
        // 50% Duty Cycle: 33ms ON, 33ms OFF
        return pos < 33 ? 1.0 : 0;
    }
    // ---------------------------------------------------------------------------
    // Output builders
    // ---------------------------------------------------------------------------
    buildBlackoutOutput() {
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
    buildStormOutput() {
        const progress = this.calculateProgress();
        const strictDimmer = this.calculateState();
        // WAVE 3471.1: Strobe perfectamente global y sincronizado.
        const globalIntensity = strictDimmer;
        // Construir zoneOverrides para cada zona de la tormenta.
        // CLAVE: NO enviamos strobeRate — usamos dimmer puro.
        //   El canal shutter/strobe nativo queda en 0 (desactivado).
        //   El HAL/HarmonicQuantizer pasa dimmer inmediatamente (no cuantizado).
        const zoneOverrides = {};
        STORM_ZONES.forEach((zone, i) => {
            const active = this.phase !== 'decay' || this.activeInDecay[i];
            const dimmer = active ? strictDimmer : 0;
            const isMover = MOVER_ZONES.has(zone);
            zoneOverrides[zone] = {
                // Movers: PASS-THROUGH — Layer 0 aporta el color base del vibe.
                // StrobeStorm solo controla el dimmer de los movers.
                // PAR/wash front+back: blanco puro (máximo impacto fotónico).
                color: isMover ? undefined : { h: 0, s: 0, l: 100 },
                dimmer,
                blendMode: 'replace',
            };
        });
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: this.zones,
            intensity: globalIntensity,
            // Sin strobeRate — dimmer es el canal de control exclusivo
            dimmerOverride: globalIntensity,
            globalComposition: 1.0,
            zoneOverrides,
        };
    }
    getDegradedOutput() {
        const dimmer = this.calculateState();
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones,
            intensity: dimmer,
            dimmerOverride: dimmer,
            globalComposition: 1.0,
        };
    }
    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------
    transitionPhase(newPhase) {
        this.phase = newPhase;
        this.phaseStartMs = this.elapsedMs;
    }
    calculateProgress() {
        const total = this.config.preBlackoutMs + this.config.burstMs + this.config.decayMs;
        return Math.min(1, this.elapsedMs / total);
    }
}
// =============================================================================
// FACTORY
// =============================================================================
export function createStrobeStorm(config) {
    return new StrobeStorm(config);
}
