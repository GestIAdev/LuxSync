/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔫 GATLING RAID - THE MACHINE GUN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔥 WAVE 930: THE ARSENAL
 *
 * FILOSOFÍA:
 * No disparamos a "zonas". Disparamos a INDIVIDUOS.
 * Cada PAR es un cañón. Cada MOVER es un francotirador.
 * La ráfaga barre de izquierda a derecha como una ametralladora.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'global' (DICTADOR - necesita el negro entre disparos)
 * - Patrón: Secuencia L→C→R repetida a velocidad de metralleta
 * - Timing: 1/16 o 1/32 de nota (snare roll territory)
 * - Cada "bala" es un flash de 20-30ms en UN solo fixture
 *
 * USO IDEAL:
 * - Snare rolls ("trrrraaa")
 * - Upswings antes del drop
 * - Hi-hat abierto en techno minimal
 *
 * COLORES:
 * - Default: Blanco estroboscópico (máxima brutalidad)
 * - High intensity: Rojo alarma
 * - Medium intensity: Amarillo tóxico
 *
 * TARGETING QUIRÚRGICO:
 * - front_left → front_center → front_right
 * - back_left → back_center → back_right
 * - O mezclado: FL→BR→FC→BL→FR→BC (patrón caótico)
 *
 * @module core/effects/library/techno/GatlingRaid
 * @version WAVE 930 - THE MACHINE GUN
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    bulletCount: 6, // 6 posiciones (3 front + 3 back)
    bulletDurationMs: 30, // 🔫 WAVE 930.4: 30ms por bala (was 25ms) - más visible
    bulletGapMs: 35, // 🔫 WAVE 930.4: 35ms entre balas (was 40ms) - más rápido
    sweepCount: 3, // 🔫 WAVE 930.4: 3 barridos completos (was 2) - más ametralladora
    pattern: 'linear', // L→C→R default
};
// Posiciones del rig (orden de disparo)
const LINEAR_SEQUENCE = [
    'front_left', 'front_center', 'front_right',
    'back_left', 'back_center', 'back_right'
];
const ZIGZAG_SEQUENCE = [
    'front_left', 'back_right', 'front_center',
    'back_left', 'front_right', 'back_center'
];
const CHAOS_SEQUENCE = [
    'back_center', 'front_left', 'back_right',
    'front_center', 'back_left', 'front_right'
];
// ═══════════════════════════════════════════════════════════════════════════
// 🔫 GATLING RAID CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class GatlingRaid extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('gatling_raid');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'gatling_raid';
        this.name = 'Gatling Raid';
        this.category = 'physical';
        this.priority = 92; // Alta pero menor que industrial_strobe
        this.mixBus = 'global'; // 🚂 DICTADOR - necesita negro entre balas
        this.currentBullet = 0; // Índice del disparo actual
        this.currentSweep = 0; // Barrido actual (0 to sweepCount-1)
        this.bulletTimer = 0; // Timer dentro del ciclo bala+gap
        this.totalDurationMs = 0;
        this.sequence = LINEAR_SEQUENCE;
        this.isFlashOn = false;
        // Color calculado (blanco por defecto, pero puede cambiar según intensity)
        this.bulletColor = { h: 0, s: 0, l: 100 };
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateTotalDuration();
    }
    calculateTotalDuration() {
        const bulletsPerSweep = this.config.bulletCount;
        const bulletCycleMs = this.config.bulletDurationMs + this.config.bulletGapMs;
        this.totalDurationMs = bulletsPerSweep * bulletCycleMs * this.config.sweepCount;
    }
    selectSequence() {
        switch (this.config.pattern) {
            case 'zigzag':
                this.sequence = ZIGZAG_SEQUENCE;
                break;
            case 'chaos':
                this.sequence = CHAOS_SEQUENCE;
                break;
            default:
                this.sequence = LINEAR_SEQUENCE;
        }
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // GatlingRaid afecta todo el escenario pero dispara uno a uno
        this.zones = ['front', 'back'];
        // Reset state
        this.currentBullet = 0;
        this.currentSweep = 0;
        this.bulletTimer = 0;
        this.isFlashOn = true; // Empezar con flash
        // Seleccionar secuencia según pattern
        this.selectSequence();
        // Color basado en intensidad (más intenso = más saturado hacia rojo)
        if (config.intensity > 0.8) {
            this.bulletColor = { h: 0, s: 100, l: 50 }; // Rojo alarma
        }
        else if (config.intensity > 0.6) {
            this.bulletColor = { h: 55, s: 100, l: 55 }; // Amarillo tóxico
        }
        else {
            this.bulletColor = { h: 0, s: 0, l: 100 }; // Blanco puro
        }
        console.log(`[GatlingRaid 🔫] TRIGGERED: ${this.config.sweepCount} sweeps x ${this.config.bulletCount} bullets | ` +
            `Pattern: ${this.config.pattern}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.bulletTimer += deltaMs;
        // Alternar entre flash y gap
        if (this.isFlashOn) {
            if (this.bulletTimer >= this.config.bulletDurationMs) {
                this.isFlashOn = false;
                this.bulletTimer = 0;
            }
        }
        else {
            if (this.bulletTimer >= this.config.bulletGapMs) {
                this.isFlashOn = true;
                this.bulletTimer = 0;
                this.currentBullet++;
                // Check sweep completion
                if (this.currentBullet >= this.config.bulletCount) {
                    this.currentBullet = 0;
                    this.currentSweep++;
                    if (this.currentSweep >= this.config.sweepCount) {
                        this.phase = 'finished';
                        console.log(`[GatlingRaid 🔫] FINISHED (${this.elapsedMs}ms)`);
                        return;
                    }
                }
            }
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = Math.min(1, this.elapsedMs / this.totalDurationMs);
        const targetPosition = this.sequence[this.currentBullet];
        // Durante el gap: NEGRO TOTAL
        if (!this.isFlashOn) {
            return {
                effectId: this.id,
                category: this.category,
                phase: this.phase,
                progress,
                dimmerOverride: 0,
                colorOverride: { h: 0, s: 0, l: 0 },
                intensity: 0,
                zones: this.zones,
                globalOverride: true
            };
        }
        // Durante el flash: Usar zoneOverrides para iluminar SOLO el target
        const zoneOverrides = {};
        // Mapear fixture position a zona
        const isTargetFront = targetPosition.startsWith('front');
        const targetZone = isTargetFront ? 'front' : 'back';
        // Iluminar solo la zona del target
        zoneOverrides[targetZone] = {
            color: this.bulletColor,
            dimmer: this.triggerIntensity
        };
        // La otra zona queda en negro
        const otherZone = isTargetFront ? 'back' : 'front';
        zoneOverrides[otherZone] = {
            color: { h: 0, s: 0, l: 0 },
            dimmer: 0
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            dimmerOverride: this.triggerIntensity,
            colorOverride: this.bulletColor,
            intensity: this.triggerIntensity,
            zones: this.zones,
            globalOverride: true,
            zoneOverrides
        };
    }
    getPhase() {
        return this.phase;
    }
    isFinished() {
        return this.phase === 'finished';
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export default GatlingRaid;
