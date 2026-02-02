/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ❤️ CORAZÓN LATINO - AMBIENT HEARTBEAT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 750: LATIN RESURRECTION - EL BROCHE DE ORO
 * 🪜 WAVE 1004.4: THE LATINO LADDER - Recalibrado a AMBIENT ZONE (A=0.38)
 *
 * CONCEPTO AMBIENT:
 * Un latido SUAVE y contenido. La pasión existe pero en modo introspectivo.
 * Ya no es la explosión sino el susurro del corazón latino.
 *
 * FILOSOFÍA AMBIENT ZONE:
 * - Latidos más lentos y espaciados (2s por latido)
 * - Intensidad reducida (~65%)
 * - Movimientos de expansión contenidos (50%)
 * - Transiciones más suaves
 *
 * MECÁNICA VISUAL:
 *
 * 1. EL LATIDO (Heartbeat) - BACK PARS
 *    - Doble latido suave: dum-dum... dum-dum...
 *    - Color: Rojo/Rosa tenue pulsando suavemente
 *    - El corazón descansa, respira
 *
 * 2. LA EXPANSIÓN (The Heat) - MOVERS (MODO FANTASMA)
 *    - Solo dimmer, sin color (efecto LONG)
 *    - Movimiento contenido y lento
 *
 * 3. EL DESTELLO (The Spark) - FRONT PARS
 *    - Glow cálido constante (no blinder agresivo)
 *    - Ámbar suave que acompaña
 *
 * DNA PROFILE (THE LATINO LADDER):
 * ┌─────────────────────────────────────────────────┐
 * │ Aggression:  0.38 → AMBIENT ZONE (30-45%)      │
 * │ Complexity:  0.60 → Patrón de latido orgánico  │
 * │ Organicity:  0.90 → Muy natural y respirable   │
 * │ Duration:    LONG → MODO FANTASMA en movers    │
 * └─────────────────────────────────────────────────┘
 *
 * PERFECT FOR:
 * - Momentos de balada/románticos
 * - Intros suaves de cumbia
 * - Transiciones calmadas
 * - Build-ups antes del drop
 *
 * @module core/effects/library/CorazonLatino
 * @version WAVE 750, 1004.4
 * @author The Architect (via Radwulf) - El Alma del Sistema
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    heartbeatDurationMs: 1500, // 🪜 LADDER: 2 segundos por latido (antes 1.5s) - más lento
    heartbeatCount: 2, // 2 latidos = ~4 segundos
    strongBeatRatio: 0.55, // 🪜 LADDER: 55% tiempo fuerte (antes 65%) - menos contraste
    // 🌸 Rosa/Rojo suave (base) - AMBIENT ZONE
    heartColorBase: { h: 350, s: 80, l: 40 }, // 🪜 LADDER: Menos saturación
    // 🌹 Rosa/Rojo tenue (pico) - AMBIENT ZONE
    heartColorPeak: { h: 355, s: 85, l: 50 }, // 🪜 LADDER: Menos contraste con base
    // 🧡 Ámbar suave (expansión) - AMBIENT ZONE
    heatColor: { h: 40, s: 70, l: 50 }, // 🪜 LADDER: Menos saturación
    // 🧡 Ámbar suave (glow) - AMBIENT ZONE (ya no es blinder)
    blinderColor: { h: 40, s: 65, l: 45 }, // 🪜 LADDER: Mucho más suave
    bpmSync: true,
    beatsPerHeartbeat: 4, // 4 beats = 1 latido
    expansionAmplitude: 0.5, // 🪜 LADDER: 50% movimiento (antes 80%) - más contenido
};
// ═══════════════════════════════════════════════════════════════════════════
// CORAZÓN LATINO CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class CorazonLatino extends BaseEffect {
    constructor(config) {
        super('corazon_latino');
        this.effectType = 'corazon_latino';
        this.name = 'Corazón Latino';
        this.category = 'physical';
        this.priority = 85; // Alta prioridad - es épico
        this.mixBus = 'global'; // 🚂 WAVE 800: Dictador - corazón necesita sus colores
        this.currentHeartbeat = 0;
        this.heartbeatPhase = 'rest';
        this.phaseTimer = 0;
        this.actualHeartbeatDurationMs = 1500;
        this.totalDurationMs = 6000; // 🔥 WAVE 750: Total duration calculada
        // ❤️ State del corazón
        this.heartIntensity = 0;
        // 🌟 State de expansión (movers)
        this.expansionProgress = 0;
        this.moverPanOffset = 0;
        // ✨ State del blinder
        this.blinderIntensity = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.currentHeartColor = { ...this.config.heartColorBase };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    trigger(config) {
        super.trigger(config);
        // Reset state
        this.currentHeartbeat = 0;
        this.heartbeatPhase = 'strong';
        this.phaseTimer = 0;
        this.heartIntensity = 0;
        this.expansionProgress = 0;
        this.moverPanOffset = 0;
        this.blinderIntensity = 0;
        // Calcular duración basada en BPM
        this.calculateHeartbeatDuration();
        console.log(`[CorazonLatino ❤️] TRIGGERED! HeartbeatDuration=${this.actualHeartbeatDurationMs}ms Beats=${this.config.heartbeatCount}`);
        console.log(`[CorazonLatino ❤️] THE ARCHITECT'S SOUL AWAKENS...`);
    }
    calculateHeartbeatDuration() {
        if (this.config.bpmSync && this.musicalContext?.bpm) {
            const msPerBeat = 60000 / this.musicalContext.bpm;
            this.actualHeartbeatDurationMs = msPerBeat * this.config.beatsPerHeartbeat;
        }
        else {
            this.actualHeartbeatDurationMs = this.config.heartbeatDurationMs;
        }
        // Calcular duración total
        this.totalDurationMs = this.actualHeartbeatDurationMs * this.config.heartbeatCount;
        // 🔥 WAVE 770: MAX DURATION de seguridad - 4 segundos máximo
        // Evita que BPMs bajos (60bpm) creen duraciones extremas (16s)
        const MAX_DURATION_MS = 4000;
        if (this.totalDurationMs > MAX_DURATION_MS) {
            const scaleFactor = MAX_DURATION_MS / this.totalDurationMs;
            this.actualHeartbeatDurationMs *= scaleFactor;
            this.totalDurationMs = MAX_DURATION_MS;
            console.log(`[CorazonLatino ❤️] WAVE 770: Duration capped to ${MAX_DURATION_MS}ms (BPM too slow)`);
        }
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        this.phaseTimer += deltaMs;
        // Calcular duración de cada fase del latido
        const strongDuration = this.actualHeartbeatDurationMs * this.config.strongBeatRatio;
        const weakDuration = this.actualHeartbeatDurationMs * (1 - this.config.strongBeatRatio) * 0.6;
        const restDuration = this.actualHeartbeatDurationMs * (1 - this.config.strongBeatRatio) * 0.4;
        // State machine del latido
        switch (this.heartbeatPhase) {
            case 'strong':
                this.updateStrongBeat(strongDuration);
                if (this.phaseTimer >= strongDuration) {
                    this.heartbeatPhase = 'weak';
                    this.phaseTimer = 0;
                }
                break;
            case 'weak':
                this.updateWeakBeat(weakDuration);
                if (this.phaseTimer >= weakDuration) {
                    this.heartbeatPhase = 'rest';
                    this.phaseTimer = 0;
                }
                break;
            case 'rest':
                this.updateRest(restDuration);
                if (this.phaseTimer >= restDuration) {
                    // Siguiente latido
                    this.currentHeartbeat++;
                    if (this.currentHeartbeat >= this.config.heartbeatCount) {
                        this.phase = 'finished';
                        console.log(`[CorazonLatino ❤️] Completed (${this.config.heartbeatCount} heartbeats, ${this.elapsedMs}ms)`);
                        console.log(`[CorazonLatino ❤️] THE PASSION FADES... BUT NEVER DIES.`);
                        return;
                    }
                    this.heartbeatPhase = 'strong';
                    this.phaseTimer = 0;
                }
                break;
        }
        // Actualizar blinder (solo en el último latido)
        this.updateBlinder();
        // Actualizar color del corazón basado en intensidad
        this.updateHeartColor();
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Heartbeat Physics
    // ─────────────────────────────────────────────────────────────────────────
    updateStrongBeat(duration) {
        const progress = Math.min(1, this.phaseTimer / duration);
        // DUM! - Golpe fuerte con attack rápido y decay lento
        // Curva: exponential attack (0→peak rápido) + linear decay
        if (progress < 0.2) {
            // Attack: 0→1 en 20% del tiempo
            this.heartIntensity = Math.pow(progress / 0.2, 0.5); // sqrt para attack explosivo
        }
        else {
            // Decay: 1→0.3 en 80% del tiempo
            const decayProgress = (progress - 0.2) / 0.8;
            this.heartIntensity = 1 - (decayProgress * 0.7); // No baja de 0.3
        }
        // Expansión de los movers (abren en el DUM)
        this.expansionProgress = this.heartIntensity * this.config.expansionAmplitude;
        this.moverPanOffset = this.expansionProgress; // Pan hacia afuera
    }
    updateWeakBeat(duration) {
        const progress = Math.min(1, this.phaseTimer / duration);
        // dum - Golpe débil, más suave
        if (progress < 0.15) {
            // Attack más suave
            this.heartIntensity = 0.3 + (Math.pow(progress / 0.15, 0.7) * 0.4); // 0.3→0.7
        }
        else {
            // Decay
            const decayProgress = (progress - 0.15) / 0.85;
            this.heartIntensity = 0.7 - (decayProgress * 0.5); // 0.7→0.2
        }
        // Los movers empiezan a volver
        this.moverPanOffset = this.expansionProgress * (1 - progress * 0.5);
    }
    updateRest(duration) {
        const progress = Math.min(1, this.phaseTimer / duration);
        // Silencio entre latidos
        this.heartIntensity = Math.max(0.1, this.heartIntensity * (1 - progress));
        // Los movers vuelven a centro
        this.moverPanOffset = this.moverPanOffset * (1 - progress);
    }
    updateBlinder() {
        // El blinder solo aparece en el ÚLTIMO latido, al final
        const isLastHeartbeat = this.currentHeartbeat === this.config.heartbeatCount - 1;
        const progressInEffect = this.elapsedMs / this.totalDurationMs;
        if (isLastHeartbeat && progressInEffect > 0.85) {
            // ¡BLINDER FINAL!
            const blinderProgress = (progressInEffect - 0.85) / 0.15; // 0→1 en el último 15%
            // Attack explosivo
            if (blinderProgress < 0.3) {
                this.blinderIntensity = Math.pow(blinderProgress / 0.3, 0.5); // sqrt para explosión
            }
            else {
                // Mantener y decay suave
                this.blinderIntensity = 1 - ((blinderProgress - 0.3) / 0.7) * 0.3; // 1→0.7
            }
        }
        else {
            // Front tenue durante los latidos
            this.blinderIntensity = 0.1;
        }
    }
    updateHeartColor() {
        // Interpolar entre base (oscuro) y peak (vivo) según intensidad
        const t = this.heartIntensity;
        this.currentHeartColor = {
            h: this.config.heartColorBase.h + (this.config.heartColorPeak.h - this.config.heartColorBase.h) * t,
            s: this.config.heartColorBase.s + (this.config.heartColorPeak.s - this.config.heartColorBase.s) * t,
            l: this.config.heartColorBase.l + (this.config.heartColorPeak.l - this.config.heartColorBase.l) * t,
        };
        // Normalizar hue (puede ser negativo si va de 350→0)
        if (this.currentHeartColor.h < 0)
            this.currentHeartColor.h += 360;
        this.currentHeartColor.h = this.currentHeartColor.h % 360;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Output
    // ─────────────────────────────────────────────────────────────────────────
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        // ❤️ BACK - EL CORAZÓN (Rojo pulsante)
        const backOverride = {
            color: this.currentHeartColor,
            dimmer: this.heartIntensity,
        };
        // 🔓 WAVE 1009: FREEDOM DAY - Movers RECIBEN COLOR
        // El HAL traduce Ámbar/Oro → DMX 70 en EL-1140
        const moverOverride = {
            color: this.config.heatColor, // 🔓 ¡LIBERTAD! Ámbar/Oro para movers
            dimmer: this.heartIntensity * 0.8, // Un poco menos que el corazón
            movement: {
                pan: this.moverPanOffset, // Abre hacia afuera en cada DUM
                tilt: -0.2, // Tilt ligeramente hacia arriba
                isAbsolute: false, // Offset sobre el movimiento base
                speed: 0.6, // Velocidad media (orgánico, no mecánico)
            },
        };
        // ✨ FRONT - EL DESTELLO (Tenue→Blinder al final)
        const isBlinding = this.blinderIntensity > 0.5;
        const frontOverride = {
            color: this.config.blinderColor,
            dimmer: this.blinderIntensity,
            white: isBlinding ? this.blinderIntensity * 0.6 : undefined, // White solo en blinder
            amber: isBlinding ? this.blinderIntensity * 0.4 : undefined, // Amber para calidez
        };
        // 🎨 WAVE 750/780: zoneOverrides - ARQUITECTURA PURA + SMART BLEND
        // 🚨 WAVE 1004.2: MOVER LAW applied to moverOverride (no color)
        const zoneOverrides = {
            'back': { ...backOverride, blendMode: 'max' },
            'movers': { ...moverOverride, blendMode: 'max' },
            'front': { ...frontOverride, blendMode: 'max' },
        };
        return {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.elapsedMs / this.totalDurationMs,
            // 🔥 WAVE 740: zones derivado de zoneOverrides
            zones: Object.keys(zoneOverrides),
            intensity: this.heartIntensity,
            // 🔥 WAVE 740: Legacy DEPRECATED
            dimmerOverride: undefined,
            colorOverride: undefined,
            zoneOverrides,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════
export function createCorazonLatino(config) {
    return new CorazonLatino(config);
}
