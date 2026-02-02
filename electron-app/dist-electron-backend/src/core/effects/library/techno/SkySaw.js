/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ✂️ SKY SAW - THE BLADE THAT CUTS THE CEILING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔥 WAVE 930: THE ARSENAL
 *
 * FILOSOFÍA:
 * Los movers no "barren". Los movers CORTAN.
 * Imagina una sierra de luz cortando el aire del club.
 * Movimientos duros, sin suavizado, sin piedad.
 *
 * COMPORTAMIENTO:
 * - MixBus: 'htp' (ADITIVO - suma con física porque es movimiento)
 * - Tilt: Snap de 0° (suelo) a 90° (techo) en 0ms
 * - Pan: Cruce en X (tijera) - los movers se cruzan
 * - Timing: Sincronizado al beat, 1 corte por compás
 *
 * USO IDEAL:
 * - Drops sucios de Dubstep/Neurofunk
 * - Momentos de máxima tensión
 * - Cuando quieres que el público mire ARRIBA
 *
 * COLORES:
 * - Default: Cyan tóxico (180, 100, 70)
 * - Acid Mode: Verde ácido (120, 100, 50)
 * - El haz debe ser FINO (iris cerrado conceptualmente)
 *
 * MOVIMIENTO:
 * - Fase 1: Tilt SNAP al techo (0ms transición)
 * - Fase 2: Hold 1 beat
 * - Fase 3: Tilt SNAP al suelo (0ms transición)
 * - Pan: Cruce en X durante todo el efecto
 *
 * @module core/effects/library/techno/SkySaw
 * @version WAVE 930 - THE BLADE
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 2000, // 2s total (4 beats @ 120 BPM)
    cutCount: 2, // 2 cortes por efecto
    ceilingHoldMs: 250, // 250ms mirando al techo (tensión)
    floorHoldMs: 150, // 150ms mirando al suelo (release)
    scissorMode: true, // Cruce en X activo
    ceilingTilt: 0.9, // 90% hacia arriba
    floorTilt: 0.1, // 10% hacia abajo
};
// ═══════════════════════════════════════════════════════════════════════════
// ✂️ SKY SAW CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class SkySaw extends BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        super('sky_saw');
        // ─────────────────────────────────────────────────────────────────────────
        // ILightEffect properties
        // ─────────────────────────────────────────────────────────────────────────
        this.effectType = 'sky_saw';
        this.name = 'Sky Saw';
        this.category = 'movement'; // Es un efecto de movimiento
        this.priority = 88; // Alta - los cortes no esperan
        this.mixBus = 'htp'; // 🚂 ADITIVO - suma con física
        this.currentCut = 0; // Corte actual (0 to cutCount-1)
        this.cutPhase = 'rising';
        this.phaseTimer = 0; // Timer dentro de la fase actual
        this.cutDurationMs = 0; // Duración de cada corte
        // Colores
        this.sawColor = { h: 180, s: 100, l: 70 };
        // Pan positions para scissor mode
        this.leftPan = 0.3; // Mover izquierdo empieza en 30%
        this.rightPan = 0.7; // Mover derecho empieza en 70%
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.calculateCutDuration();
    }
    calculateCutDuration() {
        // Cada corte = rise + ceiling_hold + fall + floor_hold
        // Rise y fall son instantáneos (0ms), solo los holds cuentan
        const holdTime = this.config.ceilingHoldMs + this.config.floorHoldMs;
        // Añadimos 100ms para las transiciones "snap" (aunque son rápidas)
        this.cutDurationMs = holdTime + 100;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // SkySaw solo afecta movers
        this.zones = ['movers'];
        // Reset state
        this.currentCut = 0;
        this.cutPhase = 'rising';
        this.phaseTimer = 0;
        // Color basado en intensidad
        if (config.intensity > 0.7) {
            // Acid green para alta intensidad
            this.sawColor = { h: 120, s: 100, l: 50 };
        }
        else {
            // Cyan tóxico default
            this.sawColor = { h: 180, s: 100, l: 70 };
        }
        // Scissor positions reset
        this.leftPan = 0.3;
        this.rightPan = 0.7;
        console.log(`[SkySaw ✂️] TRIGGERED: ${this.config.cutCount} cuts | ` +
            `Scissor: ${this.config.scissorMode ? 'ON' : 'OFF'} | ` +
            `Color: ${this.sawColor.h === 120 ? 'ACID 💚' : 'CYAN 🔵'}`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.phaseTimer += deltaMs;
        // State machine para las fases del corte
        switch (this.cutPhase) {
            case 'rising':
                // Snap instantáneo al techo (50ms max)
                if (this.phaseTimer >= 50) {
                    this.cutPhase = 'ceiling_hold';
                    this.phaseTimer = 0;
                }
                break;
            case 'ceiling_hold':
                // Mantener posición techo
                if (this.phaseTimer >= this.config.ceilingHoldMs) {
                    this.cutPhase = 'falling';
                    this.phaseTimer = 0;
                }
                break;
            case 'falling':
                // Snap instantáneo al suelo (50ms max)
                if (this.phaseTimer >= 50) {
                    this.cutPhase = 'floor_hold';
                    this.phaseTimer = 0;
                }
                break;
            case 'floor_hold':
                // Mantener posición suelo
                if (this.phaseTimer >= this.config.floorHoldMs) {
                    // Siguiente corte
                    this.currentCut++;
                    if (this.currentCut >= this.config.cutCount) {
                        this.phase = 'finished';
                        console.log(`[SkySaw ✂️] FINISHED (${this.elapsedMs}ms)`);
                        return;
                    }
                    // Reset para siguiente corte
                    this.cutPhase = 'rising';
                    this.phaseTimer = 0;
                    // En scissor mode, invertir pan para el cruce
                    if (this.config.scissorMode) {
                        const temp = this.leftPan;
                        this.leftPan = this.rightPan;
                        this.rightPan = temp;
                    }
                }
                break;
        }
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = Math.min(1, this.elapsedMs / this.config.durationMs);
        // Calcular tilt basado en fase
        let currentTilt;
        switch (this.cutPhase) {
            case 'rising':
                // Transición rápida hacia techo
                currentTilt = this.config.floorTilt +
                    (this.config.ceilingTilt - this.config.floorTilt) * (this.phaseTimer / 50);
                break;
            case 'ceiling_hold':
                currentTilt = this.config.ceilingTilt;
                break;
            case 'falling':
                // Transición rápida hacia suelo
                currentTilt = this.config.ceilingTilt -
                    (this.config.ceilingTilt - this.config.floorTilt) * (this.phaseTimer / 50);
                break;
            case 'floor_hold':
                currentTilt = this.config.floorTilt;
                break;
        }
        // Clamp tilt
        currentTilt = Math.max(0, Math.min(1, currentTilt));
        // Calcular pan para scissor effect
        // Durante ceiling_hold, los movers se cruzan
        let leftPanValue = this.leftPan;
        let rightPanValue = this.rightPan;
        if (this.config.scissorMode && this.cutPhase === 'ceiling_hold') {
            // Cruce gradual durante el hold
            const crossProgress = this.phaseTimer / this.config.ceilingHoldMs;
            leftPanValue = this.leftPan + (this.rightPan - this.leftPan) * crossProgress * 0.5;
            rightPanValue = this.rightPan - (this.rightPan - this.leftPan) * crossProgress * 0.5;
        }
        // Construir zone overrides para movers L y R
        const zoneOverrides = {
            'movers_left': {
                color: this.sawColor,
                dimmer: this.triggerIntensity,
                movement: {
                    pan: leftPanValue,
                    tilt: currentTilt,
                    isAbsolute: true,
                    speed: 1.0 // Máxima velocidad (snap)
                }
            },
            'movers_right': {
                color: this.sawColor,
                dimmer: this.triggerIntensity,
                movement: {
                    pan: rightPanValue,
                    tilt: currentTilt,
                    isAbsolute: true,
                    speed: 1.0 // Máxima velocidad (snap)
                }
            }
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            colorOverride: this.sawColor,
            dimmerOverride: this.triggerIntensity,
            intensity: this.triggerIntensity,
            zones: this.zones,
            // Movement override global (fallback si zoneOverrides no soportado)
            movement: {
                pan: (leftPanValue + rightPanValue) / 2, // Promedio
                tilt: currentTilt,
                isAbsolute: true,
                speed: 1.0
            },
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
export default SkySaw;
