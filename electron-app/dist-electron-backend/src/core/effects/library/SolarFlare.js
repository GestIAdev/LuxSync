/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ SOLAR FLARE - THE FIRST WEAPON
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 600: EFFECT ARSENAL - Primera arma del arsenal
 *
 * COMPORTAMIENTO:
 * - ATTACK:  Sube instantáneamente al pico (50ms)
 * - SUSTAIN: Mantiene el pico un momento (100ms)
 * - DECAY:   Baja exponencialmente (400ms)
 *
 * FÍSICA:
 * - HTP (Highest Takes Precedence) para dimmer
 * - Brilla POR ENCIMA de cualquier otra cosa
 * - White override para ese flash cegador
 *
 * TRIGGER SOURCES:
 * - Hunt Strike con urgency > 0.8
 * - Vibes Latino/Fiesta en drops
 * - Manual trigger
 *
 * @module core/effects/library/SolarFlare
 * @version WAVE 600
 */
const DEFAULT_CONFIG = {
    attackMs: 0, // 🔥 INSTANTÁNEO - sin ramp
    sustainMs: 150, // Pico sostenido
    decayMs: 800, // Decay lento y cálido
    decayCurve: 2.0, // Exponencial suave
    // 🌟 WAVE 630: GOLDEN WHITE - Dorado brillante que no se ve gris
    // ⚠️ RGB(255,255,255) se ve azulado en LEDs baratos
    // ✅ R:255, G:200, B:80 = Dorado intenso que QUEMA
    flareColorRGBWA: {
        red: 255,
        green: 200, // 🔥 WAVE 630: Más dorado, menos verde
        blue: 80, // 🔥 WAVE 630: Mínimo azul (evita gris)
        white: 255, // 🔥 WAVE 630: White channel al 100%
        amber: 255, // 🔥 WAVE 630: Amber channel al 100%
    },
    // 🔥 DECAY: Rojo cálido antes de negro
    decayColorRGBWA: {
        red: 255,
        green: 60, // 🔥 WAVE 630: Más naranja en decay
        blue: 0,
        white: 0,
        amber: 180, // 🔥 WAVE 630: Amber persiste más
    },
    decayFloor: 0.0, // Apagado completo
};
// ═══════════════════════════════════════════════════════════════════════════
// SOLAR FLARE CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ☀️ SOLAR FLARE
 *
 * El efecto más dramático del arsenal.
 * Un flash cegador que marca los momentos cumbre de la música.
 */
export class SolarFlare {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor(config) {
        this.effectType = 'solar_flare';
        this.name = 'Solar Flare';
        this.category = 'physical';
        this.priority = 100; // Alta prioridad - brilla sobre todo
        this.phase = 'idle';
        this.phaseStartTime = 0;
        this.elapsedMs = 0;
        this.intensity = 0;
        this.triggerIntensity = 1.0;
        this.zones = ['all'];
        this.source = 'unknown';
        this.id = `solar_flare_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * ☀️ TRIGGER - Inicia el Solar Flare
     */
    trigger(triggerConfig) {
        this.phase = 'attack';
        this.phaseStartTime = Date.now();
        this.elapsedMs = 0;
        this.triggerIntensity = triggerConfig.intensity;
        this.zones = triggerConfig.zones || ['all'];
        this.source = triggerConfig.source;
        this.intensity = 0;
        console.log(`[SolarFlare ☀️] TRIGGERED! Intensity=${this.triggerIntensity.toFixed(2)} Source=${this.source}`);
    }
    /**
     * 🔄 UPDATE - Avanza el estado del efecto
     */
    update(deltaMs) {
        if (this.phase === 'idle' || this.phase === 'finished') {
            return;
        }
        this.elapsedMs += deltaMs;
        const phaseElapsed = Date.now() - this.phaseStartTime;
        switch (this.phase) {
            case 'attack':
                this.processAttack(phaseElapsed);
                break;
            case 'sustain':
                this.processSustain(phaseElapsed);
                break;
            case 'decay':
                this.processDecay(phaseElapsed);
                break;
        }
    }
    /**
     * 📤 GET OUTPUT - Devuelve el output del frame actual
     * 🔥 WAVE 610: GLOBAL BLINDING - Color interpolation RGBWA (Peak → Decay)
     */
    getOutput() {
        if (this.phase === 'idle' || this.phase === 'finished') {
            return null;
        }
        const intensityScaled = this.intensity * this.triggerIntensity;
        // 🔥 Color interpolation: Peak (dorado) → Decay (rojo cálido)
        let rgbwa = this.config.flareColorRGBWA;
        if (this.phase === 'decay') {
            // Interpolar entre peak color y decay color basado en intensity
            const peak = this.config.flareColorRGBWA;
            const decay = this.config.decayColorRGBWA;
            const t = intensityScaled; // 1.0 = peak, 0.0 = decay
            rgbwa = {
                red: Math.round(peak.red * t + decay.red * (1 - t)),
                green: Math.round(peak.green * t + decay.green * (1 - t)),
                blue: Math.round(peak.blue * t + decay.blue * (1 - t)),
                white: Math.round(peak.white * t + decay.white * (1 - t)),
                amber: Math.round(peak.amber * t + decay.amber * (1 - t)),
            };
        }
        // Convertir RGBWA (0-255) a HSL (para colorOverride)
        // Normalizar a 0-1
        const r = rgbwa.red / 255;
        const g = rgbwa.green / 255;
        const b = rgbwa.blue / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r)
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g)
                h = ((b - r) / d + 2) / 6;
            else
                h = ((r - g) / d + 4) / 6;
        }
        const output = {
            effectId: this.id,
            category: this.category,
            phase: this.phase,
            progress: this.calculateProgress(),
            zones: this.zones,
            intensity: intensityScaled,
            // 🔥 HTP - Dimmer override (100% en peak, decay gradual)
            dimmerOverride: intensityScaled,
            // 🌟 White override (blanco puro en peak)
            whiteOverride: (rgbwa.white / 255) * intensityScaled,
            // 🧨 WAVE 630: Amber override (ámbar al 100%)
            amberOverride: (rgbwa.amber / 255) * intensityScaled,
            // 🎨 Color override (HSL para compatibilidad)
            colorOverride: {
                h: h * 360, // 0-360
                s: s * 100, // 0-100
                l: l * 100, // 0-100
            },
            // 🧨 WAVE 630: GLOBAL OVERRIDE - Bypasea zonas, brilla en TODAS las fixtures
            globalOverride: true,
        };
        return output;
    }
    /**
     * ❓ IS FINISHED - ¿Terminó el efecto?
     */
    isFinished() {
        return this.phase === 'finished';
    }
    /**
     * ⛔ ABORT - Aborta inmediatamente
     */
    abort() {
        this.phase = 'finished';
        this.intensity = 0;
        console.log(`[SolarFlare ☀️] Aborted`);
    }
    /**
     * 📊 GET PHASE - Fase actual
     */
    getPhase() {
        return this.phase;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Phase processors
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * ⬆️ ATTACK - Subida INSTANTÁNEA al pico (0ms)
     * 🔥 WAVE 610: Sin ramp - directo a 100%
     */
    processAttack(phaseElapsed) {
        // Si attackMs es 0, transición instantánea a sustain
        if (this.config.attackMs === 0) {
            this.intensity = 1.0;
            this.transitionTo('sustain');
            return;
        }
        // Fallback para configs con attack > 0ms
        const progress = Math.min(1, phaseElapsed / this.config.attackMs);
        this.intensity = 1 - Math.pow(1 - progress, 3);
        if (progress >= 1) {
            this.transitionTo('sustain');
        }
    }
    /**
     * ➡️ SUSTAIN - Mantiene el pico
     */
    processSustain(phaseElapsed) {
        this.intensity = 1.0;
        if (phaseElapsed >= this.config.sustainMs) {
            this.transitionTo('decay');
        }
    }
    /**
     * ⬇️ DECAY - Bajada exponencial
     */
    processDecay(phaseElapsed) {
        const progress = Math.min(1, phaseElapsed / this.config.decayMs);
        // Curva exponencial para bajada natural
        const decayValue = Math.pow(1 - progress, this.config.decayCurve);
        // No baja de decayFloor
        this.intensity = this.config.decayFloor + decayValue * (1 - this.config.decayFloor);
        if (progress >= 1) {
            this.transitionTo('finished');
            console.log(`[SolarFlare ☀️] Completed (${this.elapsedMs}ms total)`);
        }
    }
    /**
     * 🔄 TRANSITION - Cambia de fase
     */
    transitionTo(newPhase) {
        this.phase = newPhase;
        this.phaseStartTime = Date.now();
    }
    /**
     * 📊 CALCULATE PROGRESS - Progreso total del efecto (0-1)
     */
    calculateProgress() {
        const totalDuration = this.config.attackMs + this.config.sustainMs + this.config.decayMs;
        return Math.min(1, this.elapsedMs / totalDuration);
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Crea una nueva instancia de SolarFlare
 */
export function createSolarFlare(config) {
    return new SolarFlare(config);
}
/**
 * Configuración default exportada
 */
export const SOLAR_FLARE_DEFAULT_CONFIG = DEFAULT_CONFIG;
