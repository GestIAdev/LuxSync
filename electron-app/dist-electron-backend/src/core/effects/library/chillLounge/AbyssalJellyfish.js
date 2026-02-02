/**
 * 🪼 ABYSSAL JELLYFISH - Medusas Bioluminiscentes en MIDNIGHT (6000+m)
 * ═══════════════════════════════════════════════════════════════════════════
 * WAVE 1073.3: COMPLETE REWRITE - DOS MEDUSAS que CRUZAN el escenario
 * WAVE 1085: CHILL LOUNGE FINAL POLISH
 *   - Organic easing curves (ease-in-out cubic) para movimiento etéreo
 *   - Intensity floor: 0.6 (macro-fauna)
 *   - Atmospheric bed: 12% violeta profundo (abismo bioluminiscente)
 *   - Long tail con pulsación que se desvanece
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CONCEPTO SIMPLE Y EFECTIVO:
 * - Medusa MAGENTA: Empieza en IZQUIERDA, viaja hacia DERECHA
 * - Medusa CYAN: Empieza en DERECHA, viaja hacia IZQUIERDA
 * - Se CRUZAN en el centro creando un momento VIOLETA
 * - Cada zona solo se ilumina cuando una medusa está CERCA
 * - Las medusas FLOTAN etéreamente, no se mueven linealmente
 *
 * ZONAS EN ORDEN L→R: frontL(0.0), backL(0.2), movers_L(0.35), movers_R(0.65), backR(0.8), frontR(1.0)
 *
 * HSL FORMAT: h(0-360), s(0-100), l(0-100)
 */
import { BaseEffect } from '../../BaseEffect';
const DEFAULT_CONFIG = {
    durationMs: 18000, // 18 segundos
    peakIntensity: 0.90,
    jellyWidth: 0.18, // 🌊 WAVE 1073.7: 30% → 18% (medusas más focalizadas para stereo)
    minIntensity: 0.60, // 🌊 WAVE 1085: Floor para macro-fauna
    atmosphericBed: 0.12, // 🌊 WAVE 1085: 12% atmósfera violeta
};
// 🪼 COLORES NEON BIOLUMINISCENTES
const JELLY_COLORS = {
    magenta: { h: 310, s: 100, l: 58 }, // MAGENTA NEON - viaja L→R
    cyan: { h: 185, s: 100, l: 55 }, // CYAN NEON - viaja R→L
    violet: { h: 270, s: 100, l: 60 }, // VIOLETA - cuando se cruzan
};
// Zonas ordenadas de L a R (posición 0 a 1)
const ZONE_POSITIONS = {
    frontL: 0.0,
    backL: 0.20,
    movers_left: 0.35,
    movers_right: 0.65,
    backR: 0.80,
    frontR: 1.0,
};
const ZONE_NAMES = ['frontL', 'backL', 'movers_left', 'movers_right', 'backR', 'frontR'];
export class AbyssalJellyfish extends BaseEffect {
    constructor(config) {
        super('abyssal_jellyfish');
        this.effectType = 'abyssal_jellyfish';
        this.name = 'Abyssal Jellyfish';
        this.category = 'physical';
        this.priority = 65;
        this.mixBus = 'htp';
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    trigger(triggerConfig) {
        super.trigger(triggerConfig);
        console.log(`[🪼 JELLY] Two bioluminescent jellies crossing - ${this.config.durationMs}ms | ` +
            `width=${this.config.jellyWidth} | MAGENTA(L→R) CYAN(R→L)`);
    }
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished')
            return;
        this.elapsedMs += deltaMs;
        if (this.elapsedMs >= this.config.durationMs) {
            this.phase = 'finished';
        }
    }
    /**
     * 🪼 Calcula la intensidad de una medusa en una zona
     */
    getJellyIntensity(jellyPos, zonePos) {
        const distance = Math.abs(jellyPos - zonePos);
        if (distance > this.config.jellyWidth)
            return 0;
        // Forma gaussiana: máximo en el centro, cae suavemente
        const normalizedDist = distance / this.config.jellyWidth;
        return Math.exp(-normalizedDist * normalizedDist * 4);
    }
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished')
            return null;
        const progress = this.elapsedMs / this.config.durationMs;
        // 🌊 WAVE 1085: ORGANIC EASING - Ease-in-out cubic
        // Las medusas FLOTAN etéreamente, aceleran suave, frenan suave
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        const easedProgress = easeInOutCubic(progress);
        // 🌊 WAVE 1085: INTENSITY FLOOR - Garantizar visibilidad macro-fauna
        const effectiveIntensity = Math.max(this.triggerIntensity, this.config.minIntensity);
        // 🌊 WAVE 1085: Envelope con LONG TAIL pulsante
        // Entrada: 10% | Sustain: 70% | Fade out pulsante: 20%
        let envelope;
        if (progress < 0.10) {
            envelope = easeInOutCubic(progress / 0.10);
        }
        else if (progress < 0.80) {
            envelope = 1.0;
        }
        else {
            // 🌊 WAVE 1085: LONG TAIL con pulso que se desvanece
            const fadeOutProgress = (progress - 0.80) / 0.20;
            const decayPulse = Math.sin(fadeOutProgress * Math.PI * 3) * 0.15 + 0.85; // Pulsación en decay
            envelope = (1 - fadeOutProgress) ** 2.5 * decayPulse;
        }
        // 🌊 WAVE 1085: ATMOSPHERIC BED - Violeta profundo del abismo
        const atmosphericAmbient = this.config.atmosphericBed * envelope * effectiveIntensity;
        const atmosphericColor = { h: 275, s: 45, l: 18 }; // Violeta muy profundo
        // 🪼 POSICIONES DE LAS DOS MEDUSAS CON EASING
        // Medusa MAGENTA: L→R (empieza en frontL, termina en frontR)
        const magentaPos = easedProgress * 1.0;
        // Medusa CYAN: R→L (empieza en frontR con 15% de desfase, termina en frontL)
        const cyanDelay = 0.15;
        const cyanProgress = Math.max(0, (progress - cyanDelay) / (1 - cyanDelay));
        const cyanEased = easeInOutCubic(cyanProgress);
        const cyanPos = 1.0 - cyanEased;
        // 🌊 WAVE 1085: Pulsos individuales con easing aplicado
        const magentaPulse = Math.sin(easedProgress * Math.PI * 5) * 0.12 + 0.88;
        const cyanPulse = Math.sin(easedProgress * Math.PI * 5.5 + Math.PI * 0.7) * 0.14 + 0.86;
        // 🌊 WAVE 1085: Intensidad final con floor aplicado
        const finalPeakIntensity = this.config.peakIntensity * effectiveIntensity;
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress,
            zones: [...ZONE_NAMES],
            intensity: effectiveIntensity * envelope * this.config.peakIntensity,
            zoneOverrides: {},
        };
        // 🪼 Calcular cada zona con ATMOSPHERIC BED
        for (const zoneName of ZONE_NAMES) {
            const zonePos = ZONE_POSITIONS[zoneName];
            // Intensidad de cada medusa en esta zona
            const magentaInt = this.getJellyIntensity(magentaPos, zonePos) * magentaPulse;
            const cyanInt = this.getJellyIntensity(cyanPos, zonePos) * cyanPulse;
            // Decidir color y intensidad final
            let finalColor;
            let finalIntensity;
            const threshold = 0.15;
            if (magentaInt > threshold && cyanInt > threshold) {
                // ✨ CRUCE: Ambas medusas presentes → VIOLETA brillante
                finalColor = JELLY_COLORS.violet;
                finalIntensity = Math.min(1, (magentaInt + cyanInt) * 1.2);
            }
            else if (magentaInt > cyanInt && magentaInt > threshold) {
                finalColor = JELLY_COLORS.magenta;
                finalIntensity = magentaInt;
            }
            else if (cyanInt > threshold) {
                finalColor = JELLY_COLORS.cyan;
                finalIntensity = cyanInt;
            }
            else {
                // 🌊 WAVE 1085: Sin medusas cerca → atmospheric bed en lugar de casi negro
                finalColor = atmosphericColor;
                finalIntensity = 0;
            }
            // 🌊 WAVE 1085: Math.max entre medusa y atmospheric bed
            const jellyIntensity = finalIntensity * envelope * finalPeakIntensity;
            const zoneDimmer = Math.max(jellyIntensity, atmosphericAmbient);
            output.zoneOverrides[zoneName] = {
                dimmer: zoneDimmer,
                color: jellyIntensity > atmosphericAmbient ? finalColor : atmosphericColor,
                blendMode: 'max',
            };
        }
        // 🪼 Movers: siguen a la medusa más cercana con EASING
        const moverLeftPan = (magentaPos - 0.5) * 18;
        const moverRightPan = (cyanPos - 0.5) * 18;
        const moverTilt = Math.sin(easedProgress * Math.PI * 1.2) * 6;
        output.zoneOverrides['movers_left'] = {
            ...output.zoneOverrides['movers_left'],
            movement: {
                pan: moverLeftPan,
                tilt: moverTilt + 5,
                isAbsolute: false,
                speed: 0.06,
            },
        };
        output.zoneOverrides['movers_right'] = {
            ...output.zoneOverrides['movers_right'],
            movement: {
                pan: moverRightPan,
                tilt: moverTilt - 3,
                isAbsolute: false,
                speed: 0.06,
            },
        };
        return output;
    }
    isFinished() { return this.phase === 'finished'; }
    abort() { this.phase = 'finished'; }
}
