/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧱 BASE EFFECT - THE FOUNDATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 680: THE ARSENAL & THE SHIELD
 * WAVE 1004.2: MOVER LAW - Protección anti disco-ball para efectos LONG
 *
 * Clase abstracta base para todos los efectos.
 * Provee helpers comunes para que los efectos "respiren" con la música.
 *
 * HELPERS PROVISTOS:
 * - getIntensityFromZScore(): Escala intensidad según momento musical
 * - getBpmPulse(): Pulso sincronizado al BPM
 * - getPhaseOffset(): Offset de fase para efectos secuenciales
 * - getMoverGhostOverride(): 🆕 WAVE 1004.2 - Override para Mover Law
 *
 * MOVER LAW (WAVE 1004.2):
 * - Efectos SHORT (< 2000ms): Pueden usar color en movers
 * - Efectos LONG (>= 2000ms): Solo dimmer en movers (MODO FANTASMA)
 * - Razón: Evitar disco-ball spam en efectos largos
 *
 * @module core/effects/BaseEffect
 * @version WAVE 680, 1004.2
 */
// ═══════════════════════════════════════════════════════════════════════════
// � WAVE 1009: FREEDOM DAY - MOVER LAW ABOLISHED
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @deprecated WAVE 1009 - FREEDOM DAY: La Mover Law ha sido ABOLIDA
 *
 * El HAL ahora tiene ColorTranslator que convierte RGB → Color Wheel DMX.
 * Los efectos PUEDEN y DEBEN enviar color a movers - el HAL traduce.
 *
 * ANTES (Ley Seca):
 *   - Efectos NO enviaban color a movers (miedo a disco-ball)
 *   - Movers siempre en blanco
 *
 * AHORA (Freedom Day):
 *   - Efectos ENVÍAN color RGB a movers
 *   - HAL traduce RGB → nearest color wheel position
 *   - HardwareSafetyLayer debouncea cambios rápidos
 *
 * La constante se mantiene por compatibilidad pero ya no tiene efecto.
 */
export const MOVER_LAW_DURATION_MS = 2000; // DEPRECATED - Ignored by HAL
// ═══════════════════════════════════════════════════════════════════════════
// BASE EFFECT ABSTRACT CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🧱 BASE EFFECT
 *
 * Todos los efectos heredan de aquí.
 * Implementa ILightEffect y provee helpers comunes.
 */
export class BaseEffect {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(idPrefix) {
        // ─────────────────────────────────────────────────────────────────────────
        // 🚂 WAVE 800: RAILWAY SWITCH - Mix Bus Declaration
        // 
        // 'htp' = High Takes Precedence - Se mezcla con física (aditivo)
        // 'global' = Global Override - Ignora física (dictador)
        // 
        // Default: 'htp' - Los efectos suman por defecto
        // Los efectos que necesitan "silencio" deben sobrescribir con 'global'
        // ─────────────────────────────────────────────────────────────────────────
        this.mixBus = 'htp';
        this.phase = 'idle';
        this.elapsedMs = 0;
        this.triggerIntensity = 1.0;
        this.zones = ['all'];
        this.source = 'unknown';
        this.musicalContext = null;
        this.id = `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation (base)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🎯 TRIGGER - Base implementation
     * Los hijos pueden override para lógica adicional
     */
    trigger(config) {
        this.phase = 'attack';
        this.elapsedMs = 0;
        this.triggerIntensity = config.intensity;
        this.zones = config.zones || ['all'];
        this.source = config.source;
        this.musicalContext = config.musicalContext || null;
    }
    /**
     * ❓ IS FINISHED
     */
    isFinished() {
        return this.phase === 'finished';
    }
    /**
     * ⛔ ABORT
     */
    abort() {
        this.phase = 'finished';
    }
    /**
     * 📊 GET PHASE
     */
    getPhase() {
        return this.phase;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 🎵 MUSICAL HELPERS - El alma que respira
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 📈 GET INTENSITY FROM Z-SCORE
     *
     * Escala la intensidad según el momento musical.
     *
     * @param base Intensidad base (0-1)
     * @param scale Factor de escala del zScore (default: 0.3)
     * @returns Intensidad ajustada (0-1)
     *
     * Ejemplos:
     * - Silencio (Z=0): base * 0.7
     * - Normal (Z=1.5): base * 1.0
     * - Drop (Z=3.5): base * 1.3 (capped at 1.0)
     */
    getIntensityFromZScore(base, scale = 0.3) {
        if (!this.musicalContext)
            return base;
        const z = this.musicalContext.zScore;
        // Normalizar Z: 1.5 = neutral, <1.5 reduce, >1.5 amplifica
        const zFactor = 1 + (z - 1.5) * scale;
        return Math.min(1.0, Math.max(0.0, base * zFactor));
    }
    /**
     * 🥁 GET BPM PULSE
     *
     * Genera un pulso sincronizado al BPM.
     *
     * @param divisor Divisor del beat (1=beat, 2=half, 4=quarter)
     * @returns Valor 0-1 donde 0=downbeat, 1=upbeat
     */
    getBpmPulse(divisor = 1) {
        if (!this.musicalContext || this.musicalContext.bpm <= 0)
            return 0.5;
        const msPerBeat = 60000 / this.musicalContext.bpm;
        const msPerPulse = msPerBeat / divisor;
        // Usar beatPhase si disponible, sino calcular con elapsed
        if (this.musicalContext.beatPhase !== undefined) {
            return (this.musicalContext.beatPhase * divisor) % 1;
        }
        // Fallback: usar tiempo elapsed (menos preciso)
        return (this.elapsedMs % msPerPulse) / msPerPulse;
    }
    /**
     * 🌊 GET SINUSOIDAL PULSE
     *
     * Pulso sinusoidal suave para efectos orgánicos.
     *
     * @param periodMs Periodo en milisegundos
     * @param phaseOffset Offset de fase (0-1)
     * @returns Valor 0-1 en forma de onda sinusoidal
     */
    getSinePulse(periodMs, phaseOffset = 0) {
        const phase = ((this.elapsedMs / periodMs) + phaseOffset) % 1;
        // Sin(-PI/2) starts at 0, sin(PI/2) = 1, normalizado a 0-1
        return (Math.sin((phase - 0.25) * Math.PI * 2) + 1) / 2;
    }
    /**
     * 📐 GET PHASE OFFSET FOR ZONE
     *
     * Calcula offset de fase para efectos de ola/secuencia.
     *
     * @param zone Zona del efecto
     * @param totalZones Número total de zonas
     * @returns Offset 0-1
     */
    getZonePhaseOffset(zone, totalZones = 4) {
        const zoneOrder = {
            'front': 0,
            'frontL': 0, // 🪼 WAVE 1070.3: Stereo PARs
            'frontR': 0.25, // 🪼 WAVE 1070.3: Slight offset
            'pars': 1,
            'back': 2,
            'backL': 2, // 🪼 WAVE 1070.3: Stereo PARs
            'backR': 2.25, // 🪼 WAVE 1070.3: Slight offset
            'movers': 3,
            'movers_left': 3, // 🤖 WAVE 810: L/R tienen mismo orden que movers
            'movers_right': 3,
            'all': 0,
        };
        return (zoneOrder[zone] || 0) / totalZones;
    }
    /**
     * ⚡ GET ENERGY FACTOR
     *
     * Factor multiplicador basado en energía del audio.
     *
     * @param minFactor Factor mínimo cuando energía es 0
     * @param maxFactor Factor máximo cuando energía es 1
     * @returns Factor entre min y max
     */
    getEnergyFactor(minFactor = 0.5, maxFactor = 1.0) {
        if (!this.musicalContext)
            return (minFactor + maxFactor) / 2;
        const energy = this.musicalContext.energy;
        return minFactor + (maxFactor - minFactor) * energy;
    }
    /**
     * 🎯 GET CURRENT BPM
     *
     * Obtiene el BPM actual o un fallback.
     */
    getCurrentBpm(fallback = 120) {
        return this.musicalContext?.bpm || fallback;
    }
    /**
     * 📊 IS IN DROP
     *
     * ¿Estamos actualmente en un drop/climax?
     */
    isInDrop() {
        return this.musicalContext?.inDrop ?? false;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 🎨 COLOR HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🎨 RGB to HSL conversion
     *
     * @param r Red 0-255
     * @param g Green 0-255
     * @param b Blue 0-255
     * @returns HSL object {h: 0-360, s: 0-100, l: 0-100}
     */
    rgbToHsl(r, g, b) {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === rn)
                h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            else if (max === gn)
                h = ((bn - rn) / d + 2) / 6;
            else
                h = ((rn - gn) / d + 4) / 6;
        }
        return {
            h: h * 360,
            s: s * 100,
            l: l * 100
        };
    }
    /**
     * 🎨 HSL to RGB conversion
     */
    hslToRgb(h, s, l) {
        const sn = s / 100;
        const ln = l / 100;
        const hn = h / 360;
        if (sn === 0) {
            const v = Math.round(ln * 255);
            return { r: v, g: v, b: v };
        }
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
        const p = 2 * ln - q;
        return {
            r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
            g: Math.round(hue2rgb(p, q, hn) * 255),
            b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
        };
    }
    /**
     * 🔀 INTERPOLATE VALUES
     *
     * Interpola linealmente entre dos valores.
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    /**
     * 📐 EASE IN OUT CUBIC
     *
     * Curva de aceleración/desaceleración suave.
     */
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // � WAVE 1009: FREEDOM DAY - MOVER COLOR HELPERS (Replacing Mover Law)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🎨 GET MOVER COLOR OVERRIDE
     *
     * WAVE 1009: Freedom Day - Los movers RECIBEN color
     *
     * El HAL traduce RGB → Color Wheel DMX automáticamente.
     * Ya no hay restricción de color para movers.
     *
     * USO:
     * ```ts
     * // En getOutput() de cualquier efecto:
     * zoneOverrides['movers'] = this.getMoverColorOverride(color, intensity, movement)
     * ```
     *
     * @param color Color HSL a enviar (HAL traduce a wheel position)
     * @param dimmer Intensidad del mover (0-1)
     * @param movement Opcional: override de movimiento
     * @returns Override de zona para movers CON COLOR
     */
    getMoverColorOverride(color, dimmer, movement) {
        return {
            color, // � FREEDOM! HAL traduce RGB → Color Wheel DMX
            dimmer,
            blendMode: 'max',
            ...(movement && { movement }),
        };
    }
    /**
     * 👻 GET MOVER GHOST OVERRIDE
     *
     * @deprecated WAVE 1009 - Freedom Day: Usa getMoverColorOverride() en su lugar
     *
     * Se mantiene por compatibilidad pero se recomienda migrar a getMoverColorOverride()
     * para que los movers muestren color real en lugar de blanco.
     *
     * @param dimmer Intensidad del mover (0-1)
     * @param movement Opcional: override de movimiento
     * @returns Override de zona para movers sin color (DEPRECATED)
     */
    getMoverGhostOverride(dimmer, movement) {
        console.warn('[BaseEffect] ⚠️ getMoverGhostOverride() is DEPRECATED. Use getMoverColorOverride() instead - WAVE 1009 Freedom Day');
        return {
            dimmer,
            blendMode: 'max',
            ...(movement && { movement }),
        };
    }
    /**
     * ⏱️ IS LONG EFFECT
     *
     * @deprecated WAVE 1009 - Freedom Day: Ya no importa la duración
     *
     * El HAL maneja la traducción y debounce de color para movers.
     * Los efectos pueden enviar color independientemente de su duración.
     *
     * @param durationMs Duración total del efecto en ms
     * @returns true si es LONG (pero ya no tiene efecto sobre color)
     */
    isLongEffect(durationMs) {
        return durationMs >= MOVER_LAW_DURATION_MS;
    }
}
