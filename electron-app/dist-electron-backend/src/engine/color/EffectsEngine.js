/**
 *  EFFECTS ENGINE V17.0
 * Arquitectura de 3 Capas: Base  Effects  Optics
 *
 * Migrado desde: demo/selene-effects-engine.js
 *
 * Features:
 * - LayerStack: 3 capas que se fusionan para output final
 * - EffectManager: Gestiona efectos activos con duraci�n
 * - OpticEngine: Gobos y Prismas con MECHANICAL DEBOUNCE (2000ms)
 * - 8 efectos predefinidos: strobe, pulse, blinder, shake, dizzy, police, rainbow, breathe
 */
// ============================================================================
// CONSTANTS
// ============================================================================
/**  CRITICAL SAFETY: Tiempo m�nimo entre cambios mec�nicos (gobos/prismas) */
export const MECHANICAL_HOLD_TIME_MS = 2000;
// ============================================================================
// HELPER: HSL to RGB
// ============================================================================
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
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
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}
// ============================================================================
// EFFECT DEFINITIONS - V17 Effects Library
// ============================================================================
export const EFFECT_DEFINITIONS = {
    // -------------------------------------------------------------------------
    // STROBE - Parpadeo r�pido de dimmer
    // -------------------------------------------------------------------------
    strobe: {
        name: 'Strobe',
        type: 'dimmer',
        params: {
            rate: 10, // Hz
            intensity: 1.0,
            dutyCycle: 0.3,
        },
        process: (time, params, _entropy) => {
            const period = 1000 / params.rate;
            const phase = (time % period) / period;
            const isOn = phase < params.dutyCycle;
            return {
                dimmerMultiplier: isOn ? params.intensity : 0,
            };
        },
        minDuration: 500,
    },
    // -------------------------------------------------------------------------
    // PULSE - Respiraci�n suave con sine wave
    // -------------------------------------------------------------------------
    pulse: {
        name: 'Pulse',
        type: 'dimmer',
        params: {
            rate: 1.0, // Hz
            minBrightness: 0.3,
            maxBrightness: 1.0,
        },
        process: (time, params, _entropy) => {
            const phase = (time / 1000) * params.rate * 2 * Math.PI;
            const sine = Math.sin(phase);
            const normalized = (sine + 1) / 2;
            const brightness = params.minBrightness +
                normalized * (params.maxBrightness - params.minBrightness);
            return {
                dimmerMultiplier: brightness,
            };
        },
        minDuration: 2000,
    },
    // -------------------------------------------------------------------------
    // BLINDER - Flash blanco total con fade out gradual V17.2
    // -------------------------------------------------------------------------
    blinder: {
        name: 'Blinder',
        type: 'color',
        params: {
            useWhite: true,
            intensity: 1.0,
            fadeOutTime: 300,
        },
        process: (time, params, _entropy, duration) => {
            let intensityMult = params.intensity;
            if (duration && duration > 0) {
                const timeRemaining = duration - time;
                const fadeOutTime = params.fadeOutTime;
                if (timeRemaining < fadeOutTime && timeRemaining > 0) {
                    const fadeProgress = timeRemaining / fadeOutTime;
                    intensityMult = params.intensity * (fadeProgress * fadeProgress);
                }
                else if (timeRemaining <= 0) {
                    intensityMult = 0;
                }
            }
            return {
                dimmerMultiplier: intensityMult,
                colorOverride: params.useWhite
                    ? { r: 255, g: 255, b: 255, w: 255 }
                    : { r: 255, g: 255, b: 255 },
            };
        },
        minDuration: 1000,
    },
    // -------------------------------------------------------------------------
    // SHAKE - Vibraci�n en position
    // -------------------------------------------------------------------------
    shake: {
        name: 'Shake',
        type: 'position',
        params: {
            intensity: 20,
            rate: 8,
            axis: 'both',
        },
        process: (time, params, entropy) => {
            const seed = entropy + Math.floor(time / (1000 / params.rate));
            const hash = (seed * 9301 + 49297) % 233280;
            const rnd1 = (hash / 233280) * 2 - 1;
            const rnd2 = ((hash * 127) % 233280) / 233280 * 2 - 1;
            const panOffset = (params.axis !== 'tilt')
                ? Math.round(rnd1 * params.intensity) : 0;
            const tiltOffset = (params.axis !== 'pan')
                ? Math.round(rnd2 * params.intensity) : 0;
            return {
                positionOffset: { pan: panOffset, tilt: tiltOffset },
            };
        },
        minDuration: 500,
    },
    // -------------------------------------------------------------------------
    // DIZZY - Movimiento circular r�pido
    // -------------------------------------------------------------------------
    dizzy: {
        name: 'Dizzy',
        type: 'position',
        params: {
            radius: 30,
            rate: 3,
        },
        process: (time, params, _entropy) => {
            const angle = (time / 1000) * params.rate * 2 * Math.PI;
            return {
                positionOffset: {
                    pan: Math.round(Math.cos(angle) * params.radius),
                    tilt: Math.round(Math.sin(angle) * params.radius),
                },
            };
        },
        minDuration: 1000,
    },
    // -------------------------------------------------------------------------
    // POLICE - Alternancia rojo/azul
    // -------------------------------------------------------------------------
    police: {
        name: 'Police',
        type: 'color',
        params: {
            rate: 4,
        },
        process: (time, params, _entropy) => {
            const period = 1000 / params.rate;
            const phase = Math.floor(time / period) % 2;
            return {
                colorOverride: phase === 0
                    ? { r: 255, g: 0, b: 0 }
                    : { r: 0, g: 0, b: 255 },
            };
        },
        minDuration: 2000,
    },
    // -------------------------------------------------------------------------
    // RAINBOW - Ciclo de colores
    // -------------------------------------------------------------------------
    rainbow: {
        name: 'Rainbow',
        type: 'color',
        params: {
            rate: 0.5,
            saturation: 1.0,
        },
        process: (time, params, entropy) => {
            const hue = ((time / 1000) * params.rate + entropy / 1000) % 1;
            const rgb = hslToRgb(hue, params.saturation, 0.5);
            return {
                colorOverride: { r: rgb.r, g: rgb.g, b: rgb.b },
            };
        },
        minDuration: 3000,
    },
    // -------------------------------------------------------------------------
    // BREATHE - Pulse muy lento para ambient
    // -------------------------------------------------------------------------
    breathe: {
        name: 'Breathe',
        type: 'dimmer',
        params: {
            rate: 0.15,
            minBrightness: 0.4,
            maxBrightness: 1.0,
        },
        process: (time, params, _entropy) => {
            const phase = (time / 1000) * params.rate * 2 * Math.PI;
            const sine = Math.sin(phase);
            const normalized = (sine + 1) / 2;
            const brightness = params.minBrightness +
                normalized * (params.maxBrightness - params.minBrightness);
            return {
                dimmerMultiplier: brightness,
            };
        },
        minDuration: 5000,
    },
    // -------------------------------------------------------------------------
    // ?? BEAM - Haz cerrado para spotlight effect (WAVE 10.7)
    // -------------------------------------------------------------------------
    beam: {
        name: 'Beam',
        type: 'dimmer',
        params: {
            beamWidth: 0.0, // Fully closed
            iris: 0.2, // Tight iris
            zoom: 0, // Min zoom
            intensity: 1.0,
        },
        process: (_time, params, _entropy) => {
            // BEAM effect just sets intensity high, actual beamWidth is handled by optics
            return {
                dimmerMultiplier: params.intensity,
            };
        },
        minDuration: 0, // Instant, hold-based
    },
    // -------------------------------------------------------------------------
    // ?? PRISM - Fragmentaci�n del haz con rotaci�n (WAVE 10.7)
    // -------------------------------------------------------------------------
    prism: {
        name: 'Prism',
        type: 'dimmer',
        params: {
            fragmentation: 1.0,
            textureRotation: 0.5,
            prismActive: true,
            intensity: 1.0,
        },
        process: (time, params, _entropy) => {
            // Add subtle rotation animation to the prism effect
            const rotationSpeed = params.textureRotation * 0.1;
            const _rotation = ((time / 1000) * rotationSpeed) % 1; // For texture rotation
            return {
                dimmerMultiplier: params.intensity,
            };
        },
        minDuration: 0, // Instant, hold-based
    },
};
// ============================================================================
// LAYER STACK - 3-Layer Merge System
// ============================================================================
export class LayerStack {
    constructor() {
        this.baseLayer = {
            r: 0, g: 0, b: 0, w: 0,
            dimmer: 255,
            pan: 127, tilt: 127,
            beamWidth: 0.5,
            texture: 0,
            fragmentation: 0,
        };
        this.effectsLayer = {
            dimmerMultiplier: 1.0,
            colorOverride: null,
            positionOffset: { pan: 0, tilt: 0 },
            active: false,
        };
        this.opticsLayer = {
            prismActive: false,
            goboIndex: 0,
            zoomValue: 0.5,
            focusValue: 0.5,
        };
    }
    /** Establece el estado base */
    setBase(state) {
        Object.assign(this.baseLayer, state);
    }
    /** Limpia la capa de efectos */
    clearEffects() {
        this.effectsLayer = {
            dimmerMultiplier: 1.0,
            colorOverride: null,
            positionOffset: { pan: 0, tilt: 0 },
            active: false,
        };
    }
    /** Fusiona las 3 capas en estado final */
    merge() {
        const base = this.baseLayer;
        const fx = this.effectsLayer;
        const optics = this.opticsLayer;
        // Color final: override o base
        const finalColor = fx.colorOverride || { r: base.r, g: base.g, b: base.b, w: base.w };
        // Dimmer final: base * multiplicador
        const finalDimmer = Math.round(base.dimmer * fx.dimmerMultiplier);
        // Position final: base + offset
        const finalPan = Math.max(0, Math.min(255, base.pan + fx.positionOffset.pan));
        const finalTilt = Math.max(0, Math.min(255, base.tilt + fx.positionOffset.tilt));
        return {
            r: finalColor.r,
            g: finalColor.g,
            b: finalColor.b,
            w: finalColor.w || 0,
            dimmer: Math.max(0, Math.min(255, finalDimmer)),
            pan: finalPan,
            tilt: finalTilt,
            beamWidth: base.beamWidth,
            texture: base.texture,
            fragmentation: base.fragmentation,
            prismActive: optics.prismActive,
            goboIndex: optics.goboIndex,
            zoomValue: optics.zoomValue,
            focusValue: optics.focusValue,
        };
    }
}
// ============================================================================
// EFFECT MANAGER - Gestiona efectos activos
// ============================================================================
export class EffectManager {
    constructor() {
        this.activeEffects = new Map();
        this.effectIdCounter = 0;
    }
    /** Activa un efecto */
    trigger(effectName, params = {}, duration = 0) {
        const def = EFFECT_DEFINITIONS[effectName];
        if (!def) {
            console.warn(`[EffectManager] Unknown effect: ${effectName}`);
            return -1;
        }
        const id = ++this.effectIdCounter;
        const now = performance.now();
        const mergedParams = { ...def.params, ...params };
        const minDuration = def.minDuration || 500;
        const actualDuration = duration > 0 ? Math.max(duration, minDuration) : 0;
        this.activeEffects.set(id, {
            def,
            params: mergedParams,
            startTime: now,
            endTime: actualDuration > 0 ? now + actualDuration : Infinity,
        });
        console.log(`[EffectManager]  Triggered: ${effectName} (id=${id}, duration=${actualDuration}ms)`);
        return id;
    }
    /** Cancela un efecto por ID */
    cancel(effectId) {
        if (this.activeEffects.has(effectId)) {
            const fx = this.activeEffects.get(effectId);
            console.log(`[EffectManager]  Cancelled: ${fx.def.name}`);
            this.activeEffects.delete(effectId);
        }
    }
    /** Cancela todos los efectos de un tipo */
    cancelType(typeName) {
        for (const [id, fx] of this.activeEffects) {
            if (fx.def.name.toLowerCase() === typeName.toLowerCase()) {
                this.activeEffects.delete(id);
            }
        }
    }
    /** Cancela todos los efectos */
    cancelAll() {
        this.activeEffects.clear();
    }
    /** Procesa todos los efectos activos */
    process(entropy = 0) {
        const now = performance.now();
        const result = {
            dimmerMultiplier: 1.0,
            colorOverride: null,
            positionOffset: { pan: 0, tilt: 0 },
            active: false,
        };
        // Limpiar efectos expirados
        for (const [id, fx] of this.activeEffects) {
            if (now >= fx.endTime) {
                console.log(`[EffectManager]  Expired: ${fx.def.name}`);
                this.activeEffects.delete(id);
            }
        }
        if (this.activeEffects.size === 0) {
            return result;
        }
        result.active = true;
        // Procesar cada efecto
        for (const [_id, fx] of this.activeEffects) {
            const relativeTime = now - fx.startTime;
            const effectDuration = fx.endTime !== Infinity ? fx.endTime - fx.startTime : 0;
            const fxResult = fx.def.process(relativeTime, fx.params, entropy, effectDuration);
            if (fxResult.dimmerMultiplier !== undefined) {
                result.dimmerMultiplier *= fxResult.dimmerMultiplier;
            }
            if (fxResult.colorOverride) {
                result.colorOverride = fxResult.colorOverride;
            }
            if (fxResult.positionOffset) {
                result.positionOffset.pan += fxResult.positionOffset.pan;
                result.positionOffset.tilt += fxResult.positionOffset.tilt;
            }
        }
        return result;
    }
    /** Lista de efectos activos */
    getActiveList() {
        return Array.from(this.activeEffects.values()).map(fx => fx.def.name);
    }
}
// ============================================================================
// OPTIC ENGINE - Motor de �pticas con MECHANICAL DEBOUNCE
// ============================================================================
export class OpticEngine {
    constructor() {
        this.state = {
            prismActive: false,
            goboIndex: 0,
            zoomValue: 0.5,
            focusValue: 0.5,
        };
        this.lastChangeTime = {
            prism: 0,
            gobo: 0,
        };
        this.targetState = { ...this.state };
        this.goboPresets = {
            open: 0,
            dots: 1,
            lines: 2,
            star: 3,
            spiral: 4,
            breakup: 5,
        };
    }
    /** Selene solicita un estado �ptico abstracto */
    setTarget(opticsMood, entropy = 0) {
        const { beamWidth = 0.5, texture = 0, fragmentation = 0 } = opticsMood;
        this.targetState.zoomValue = beamWidth;
        this.targetState.focusValue = 1.0 - beamWidth * 0.3;
        this.targetState.prismActive = fragmentation > 0.5;
        if (texture < 0.1) {
            this.targetState.goboIndex = 0;
        }
        else {
            const goboCount = Object.keys(this.goboPresets).length - 1;
            const selectedGobo = 1 + Math.floor((entropy % 1000) / 1000 * goboCount);
            this.targetState.goboIndex = Math.min(selectedGobo, goboCount);
        }
    }
    /** Update con MECHANICAL DEBOUNCE */
    update() {
        const now = performance.now();
        // Zoom y Focus: interpolaci�n suave
        this.state.zoomValue += (this.targetState.zoomValue - this.state.zoomValue) * 0.1;
        this.state.focusValue += (this.targetState.focusValue - this.state.focusValue) * 0.1;
        //  PRISM: Mechanical Debounce
        if (this.targetState.prismActive !== this.state.prismActive) {
            const timeSinceLastChange = now - this.lastChangeTime.prism;
            if (timeSinceLastChange >= MECHANICAL_HOLD_TIME_MS) {
                this.state.prismActive = this.targetState.prismActive;
                this.lastChangeTime.prism = now;
                console.log(`[OpticEngine]  Prism: ${this.state.prismActive ? 'IN' : 'OUT'}`);
            }
        }
        //  GOBO: Mechanical Debounce
        if (this.targetState.goboIndex !== this.state.goboIndex) {
            const timeSinceLastChange = now - this.lastChangeTime.gobo;
            if (timeSinceLastChange >= MECHANICAL_HOLD_TIME_MS) {
                this.state.goboIndex = this.targetState.goboIndex;
                this.lastChangeTime.gobo = now;
                const goboName = Object.keys(this.goboPresets)[this.state.goboIndex] || 'custom';
                console.log(`[OpticEngine]  Gobo: ${goboName}`);
            }
        }
        return { ...this.state };
    }
    /** Reset inmediato */
    forceReset() {
        this.state = { prismActive: false, goboIndex: 0, zoomValue: 0.5, focusValue: 0.5 };
        this.targetState = { ...this.state };
        this.lastChangeTime.prism = 0;
        this.lastChangeTime.gobo = 0;
        console.log('[OpticEngine]  Force reset');
    }
    getState() {
        return { current: { ...this.state }, target: { ...this.targetState } };
    }
}
// ============================================================================
// SELENE EFFECTS ENGINE V17 - Integraci�n completa
// ============================================================================
export class EffectsEngine {
    constructor() {
        this.layerStack = new LayerStack();
        this.effectManager = new EffectManager();
        this.opticEngine = new OpticEngine();
        this.entropy = 0;
        this.frameCount = 0;
        console.log('[EffectsEngine]  V17 initialized');
        console.log(`[EffectsEngine]  Mechanical Hold Time: ${MECHANICAL_HOLD_TIME_MS}ms`);
    }
    /** Update principal - llamar cada frame */
    update(baseState, paletteIndex = 0) {
        this.frameCount++;
        this.entropy = this.getSystemEntropy(paletteIndex);
        // 1. Actualizar capa base
        this.layerStack.setBase(baseState);
        // 2. Procesar efectos activos
        const effectsState = this.effectManager.process(this.entropy);
        this.layerStack.effectsLayer = effectsState;
        // 3. Actualizar �pticas (con mechanical debounce)
        if (baseState.beamWidth !== undefined ||
            baseState.texture !== undefined ||
            baseState.fragmentation !== undefined) {
            this.opticEngine.setTarget({
                beamWidth: baseState.beamWidth || 0.5,
                texture: baseState.texture || 0,
                fragmentation: baseState.fragmentation || 0,
            }, this.entropy);
        }
        const opticsState = this.opticEngine.update();
        this.layerStack.opticsLayer = opticsState;
        // 4. Merge y retornar estado final
        return this.layerStack.merge();
    }
    /** Entrop�a determinista */
    getSystemEntropy(paletteIndex) {
        return (this.frameCount * 127 + paletteIndex * 9973) % 100000;
    }
    /** Disparar un efecto */
    triggerEffect(effectName, params = {}, duration = 0) {
        return this.effectManager.trigger(effectName, params, duration);
    }
    /** Cancelar efecto */
    cancelEffect(effectId) {
        this.effectManager.cancel(effectId);
    }
    /** Cancelar todos los efectos */
    cancelAllEffects() {
        this.effectManager.cancelAll();
    }
    /** Establecer estado �ptico abstracto */
    setOptics(opticsMood) {
        this.opticEngine.setTarget(opticsMood, this.entropy);
    }
    /** Reset de emergencia */
    emergencyReset() {
        this.effectManager.cancelAll();
        this.opticEngine.forceReset();
        this.layerStack.clearEffects();
        console.log('[EffectsEngine]  Emergency reset complete');
    }
    /** Estado para debug/UI */
    getDebugState() {
        return {
            activeEffects: this.effectManager.getActiveList(),
            optics: this.opticEngine.getState(),
            entropy: this.entropy,
            frameCount: this.frameCount,
        };
    }
    /** Toggle effect (compatibilidad) */
    toggleEffect(effect, enabled) {
        if (enabled === false) {
            this.effectManager.cancelType(effect);
        }
        else {
            this.effectManager.trigger(effect, {}, 2000);
        }
    }
    /** Getters de estado (compatibilidad) */
    getState() {
        return {
            autoTrigger: true,
            activeEffects: this.effectManager.getActiveList(),
        };
    }
}
