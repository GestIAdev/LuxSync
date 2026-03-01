/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ☀️ SOLAR FLARE - INTENSE ZONE BLINDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 600: EFFECT ARSENAL - Primera arma del arsenal
 * 🪜 WAVE 1004.4: THE LATINO LADDER - Posicionado en INTENSE ZONE (A=0.85)
 *
 * COMPORTAMIENTO:
 * - PRE-BLACKOUT: 50ms de negrura antes del golpe (máximo contraste)
 * - ATTACK:  Sube instantáneamente al pico (0ms)
 * - SUSTAIN: Mantiene el pico un momento (150ms)
 * - DECAY:   Baja exponencialmente pasando por rojo cálido (800ms)
 *
 * DNA PROFILE (THE LATINO LADDER):
 * ┌─────────────────────────────────────────────────┐
 * │ Aggression:  0.85 → INTENSE ZONE (75-90%)      │
 * │ Complexity:  0.25 → Patrón simple y directo    │
 * │ Organicity:  0.30 → Físico/Mecánico dominante  │
 * │ Duration:    SHORT → COLOR PERMITIDO en movers │
 * └─────────────────────────────────────────────────┘
 *
 * FÍSICA:
 * - HTP (Highest Takes Precedence) para dimmer
 * - Brilla POR ENCIMA de cualquier otra cosa
 * - Dorado brillante que QUEMA (no blanco frío)
 *
 * ZONA INTENSE:
 * - Compañero de SalsaFire (A=0.82)
 * - Pre-drop y momentos de alta energía
 * - No tan extremo como PEAK pero impactante
 *
 * @module core/effects/library/SolarFlare
 * @version WAVE 600, 1004.4
 */
const DEFAULT_CONFIG = {
    attackMs: 0, // 🔥 INSTANTÁNEO - sin ramp
    sustainMs: 150, // Pico sostenido
    decayMs: 500, // Decay lento y cálido
    decayCurve: 2.0, // Exponencial suave
    // 🪜 WAVE 1004.4: PRE-BLACKOUT para INTENSE ZONE
    preBlackoutMs: 50, // 50ms de negro antes del flash (máximo contraste)
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
        this.mixBus = 'htp'; // 🔥 WAVE 790: HTP - Let physics breathe during decay
        this.isOneShot = true; // 🎯 WAVE 2067: One-hit wonder — NO re-trigger
        this.phase = 'idle';
        this.phaseStartTime = 0;
        this.elapsedMs = 0;
        this.intensity = 0;
        this.triggerIntensity = 1.0;
        this.zones = ['all'];
        this.source = 'unknown';
        /** 🪜 WAVE 1004.4: Pre-blackout state */
        this.preBlackoutActive = false;
        this.preBlackoutEndTime = 0;
        this.id = `solar_flare_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // ILightEffect implementation
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * ☀️ TRIGGER - Inicia el Solar Flare
     * 🪜 WAVE 1004.4: Ahora comienza con pre-blackout (50ms negro)
     */
    trigger(triggerConfig) {
        const now = Date.now();
        // 🪜 WAVE 1004.4: Pre-blackout antes del flash
        if (this.config.preBlackoutMs > 0) {
            this.preBlackoutActive = true;
            this.preBlackoutEndTime = now + this.config.preBlackoutMs;
            this.phase = 'attack'; // En attack pero con intensidad 0 (pre-blackout)
            this.intensity = 0; // Negro total
        }
        else {
            this.phase = 'attack';
            this.preBlackoutActive = false;
        }
        this.phaseStartTime = now;
        this.elapsedMs = 0;
        this.triggerIntensity = triggerConfig.intensity;
        this.zones = triggerConfig.zones || ['all'];
        this.source = triggerConfig.source;
        console.log(`[SolarFlare ☀️] TRIGGERED! Intensity=${this.triggerIntensity.toFixed(2)} Source=${this.source} PreBlackout=${this.config.preBlackoutMs}ms`);
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
            // 🔥 WAVE 790.1: CRITICAL OVERRIDES para preservar el ORO
            // HTP + overrides raíz = Dominancia total en white/amber (ORO GARANTIZADO)
            dimmerOverride: intensityScaled,
            whiteOverride: (rgbwa.white / 255) * intensityScaled,
            amberOverride: (rgbwa.amber / 255) * intensityScaled,
            // 🎨 Color override (HSL para compatibilidad)
            colorOverride: {
                h: h * 360, // 0-360
                s: s * 100, // 0-100
                l: l * 100, // 0-100
            },
            // 🧨 WAVE 790: HTP CONVERSION - Zone overrides with MAX blend
            // No global override = physics can breathe during decay
            zoneOverrides: Object.fromEntries(this.zones.map((zone) => [
                zone,
                {
                    color: {
                        h: h * 360, // 0-360
                        s: s * 100, // 0-100
                        l: l * 100, // 0-100
                    },
                    dimmer: intensityScaled,
                    white: (rgbwa.white / 255) * intensityScaled,
                    amber: (rgbwa.amber / 255) * intensityScaled,
                    blendMode: 'max', // HTP = Maximum wins
                },
            ])),
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
    /**
     * 📏 WAVE 2067: NATIVE DURATION
     *
     * SolarFlare's real duration = preBlackout + attack + sustain + decay
     * With defaults: 50 + 0 + 150 + 500 = 700ms (NOT the registry's 3000ms!)
     */
    getDurationMs() {
        return this.config.preBlackoutMs + this.config.attackMs + this.config.sustainMs + this.config.decayMs;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Phase processors
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * ⬆️ ATTACK - Subida INSTANTÁNEA al pico (0ms)
     * 🔥 WAVE 610: Sin ramp - directo a 100%
     * 🪜 WAVE 1004.4: Respeta pre-blackout antes del flash
     */
    processAttack(phaseElapsed) {
        const now = Date.now();
        // 🪜 WAVE 1004.4: Si estamos en pre-blackout, mantener negro
        if (this.preBlackoutActive && now < this.preBlackoutEndTime) {
            this.intensity = 0; // Negro total durante pre-blackout
            return;
        }
        // Pre-blackout terminó, ahora sí flasheamos
        if (this.preBlackoutActive) {
            this.preBlackoutActive = false;
            this.phaseStartTime = now; // Reset del timer de attack
        }
        // Si attackMs es 0, transición instantánea a sustain
        if (this.config.attackMs === 0) {
            this.intensity = 1.0;
            this.transitionTo('sustain');
            return;
        }
        // Fallback para configs con attack > 0ms
        const attackElapsed = now - this.phaseStartTime;
        const progress = Math.min(1, attackElapsed / this.config.attackMs);
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
