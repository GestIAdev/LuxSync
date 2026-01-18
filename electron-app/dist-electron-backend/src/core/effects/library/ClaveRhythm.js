/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 CLAVE RHYTHM - LA CLAVE QUE MANDA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 700.6: NUEVO EFECTO FIESTA LATINA
 *
 * CONCEPTO:
 * Basado en el patrón rítmico de clave 3-2 de la salsa/son cubano.
 * Tres golpes seguidos + pausa + dos golpes.
 * Cada golpe es un "hit" de color que también mueve los movers.
 *
 * TIMING PATTERN:
 * 3-2 Clave: X..X...X....X..X.......
 *            │  │   │    │  │
 *            1  2   3    4  5
 *            └──3──┘    └2┘
 *
 * COMPORTAMIENTO:
 * - 5 hits totales siguiendo el patrón de clave
 * - Cada hit: color vibrante + movimiento snap de movers
 * - Colores rotan: rojo → naranja → amarillo → verde → magenta
 * - Movers hacen snaps pequeños en cada hit (±30° pan)
 * - Intensidad varía: fuerte-medio-fuerte / medio-fuerte
 *
 * PHYSICS:
 * - BPM-synced (el patrón completo dura 2 compases)
 * - Cada hit dura ~150ms (attack) + ~200ms (decay)
 * - Movers snapean en cada hit con aceleración latina (ease-out cúbico)
 *
 * PERFECT FOR:
 * - Momentos de energía media-alta
 * - Cuando la percusión latina está marcada
 * - Agregar dinamismo sin ser spam
 *
 * @module core/effects/library/ClaveRhythm
 * @version WAVE 700.6
 */
import { BaseEffect } from '../BaseEffect';
const DEFAULT_CONFIG = {
    // Patrón 3-2 clave (en beats de 1/8)
    clavePattern: [0, 2, 3.5, 6, 7], // Hits en beats 0, 2, 3.5, 6, 7
    hitAttackMs: 120,
    hitDecayMs: 180,
    // Progresión de colores cálidos latinos
    hitColors: [
        { h: 0, s: 95, l: 55 }, // Rojo intenso
        { h: 25, s: 90, l: 60 }, // Naranja cálido
        { h: 45, s: 95, l: 65 }, // Amarillo dorado
        { h: 145, s: 85, l: 50 }, // Verde esmeralda
        { h: 320, s: 90, l: 60 }, // Magenta vibrante
    ],
    // Patrón de intensidades: fuerte-medio-fuerte / medio-fuerte
    hitIntensities: [0.85, 0.65, 0.90, 0.70, 0.95],
    panSnapAmplitude: 35, // ±35° de movimiento
    tiltSnapAmplitude: 20, // ±20° de movimiento
};
// ═══════════════════════════════════════════════════════════════════════════
// CLAVE RHYTHM CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class ClaveRhythm extends BaseEffect {
    constructor(config) {
        super('clave_rhythm');
        this.effectType = 'clave_rhythm';
        this.name = 'Clave Rhythm';
        this.category = 'physical';
        this.priority = 72;
        this.currentHit = 0;
        this.hitPhase = 'wait';
        this.phaseTimer = 0;
        this.currentIntensity = 0;
        this.totalDurationMs = 0;
        this.hitTimingsMs = [];
        this.nextHitTimeMs = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentColor = this.config.hitColors[0];
    }
    trigger(config) {
        super.trigger(config);
        this.currentHit = 0;
        this.hitPhase = 'wait';
        this.phaseTimer = 0;
        this.currentIntensity = 0;
        // Calcular timings basados en BPM
        this.calculateHitTimings();
        this.nextHitTimeMs = this.hitTimingsMs[0];
        console.log(`[ClaveRhythm 🥁] TRIGGERED! Pattern=3-2 Duration=${this.totalDurationMs}ms BPM=${this.musicalContext?.bpm || 'unknown'}`);
    }
    calculateHitTimings() {
        const bpm = this.musicalContext?.bpm || 120;
        const beatDurationMs = 60000 / bpm;
        const eighthNoteDurationMs = beatDurationMs / 2;
        this.hitTimingsMs = this.config.clavePattern.map(beat => beat * eighthNoteDurationMs);
        // Duración total: último hit + decay
        const lastHitTime = this.hitTimingsMs[this.hitTimingsMs.length - 1];
        this.totalDurationMs = lastHitTime + this.config.hitAttackMs + this.config.hitDecayMs + 200;
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.phaseTimer += deltaMs;
        // Check si es momento del siguiente hit
        if (this.hitPhase === 'wait' && this.elapsedMs >= this.nextHitTimeMs) {
            this.startHit();
        }
        // Actualizar fase actual
        switch (this.hitPhase) {
            case 'attack':
                this.updateAttack();
                break;
            case 'decay':
                this.updateDecay();
                break;
            case 'wait':
                this.currentIntensity = 0;
                break;
        }
        // Check si terminamos
        if (this.elapsedMs >= this.totalDurationMs) {
            this.phase = 'finished';
            console.log(`[ClaveRhythm 🥁] Completed (${this.config.clavePattern.length} hits, ${this.elapsedMs}ms)`);
        }
    }
    startHit() {
        this.hitPhase = 'attack';
        this.phaseTimer = 0;
        // Color del hit actual
        const colorIndex = this.currentHit % this.config.hitColors.length;
        this.currentColor = this.config.hitColors[colorIndex];
    }
    updateAttack() {
        const progress = Math.min(1, this.phaseTimer / this.config.hitAttackMs);
        // Ataque con punch (ease-out cúbico)
        const eased = 1 - Math.pow(1 - progress, 3);
        const hitIntensity = this.config.hitIntensities[this.currentHit] || 0.8;
        this.currentIntensity = eased * hitIntensity * this.triggerIntensity;
        if (progress >= 1) {
            this.hitPhase = 'decay';
            this.phaseTimer = 0;
        }
    }
    updateDecay() {
        const progress = Math.min(1, this.phaseTimer / this.config.hitDecayMs);
        // Decay suave (ease-in cuadrático)
        const eased = Math.pow(progress, 2);
        const hitIntensity = this.config.hitIntensities[this.currentHit] || 0.8;
        this.currentIntensity = (1 - eased) * hitIntensity * this.triggerIntensity;
        if (progress >= 1) {
            this.currentHit++;
            // Preparar siguiente hit
            if (this.currentHit < this.config.clavePattern.length) {
                this.nextHitTimeMs = this.hitTimingsMs[this.currentHit];
                this.hitPhase = 'wait';
            }
            else {
                // Ya no hay más hits, esperar a que termine
                this.hitPhase = 'wait';
            }
            this.phaseTimer = 0;
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // 🎯 WAVE 700.6: ClaveRhythm outputs color hits
        // Movimiento lo manejará el choreographer, aquí solo color
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            zones: ['all'],
            intensity: this.currentIntensity,
            dimmerOverride: this.currentIntensity,
            colorOverride: this.currentColor,
            globalOverride: true,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createClaveRhythm(config) {
    return new ClaveRhythm(config);
}
