/**
 * ============================================================================
 * SELENE EFFECTS ENGINE - V17.0
 * ============================================================================
 * 
 * Sistema de Efectos y Ópticas basado en arquitectura de capas:
 * 
 *   ┌─────────────────────────────────────────────────────┐
 *   │                   FINAL OUTPUT                       │
 *   │              (Lo que va al DMX)                      │
 *   └─────────────────────────────────────────────────────┘
 *                          ▲
 *                          │ merge()
 *   ┌─────────────────────────────────────────────────────┐
 *   │               OPTICS LAYER                          │
 *   │     (Zoom, Gobo, Prism - con Mechanical Hold)       │
 *   └─────────────────────────────────────────────────────┘
 *                          ▲
 *   ┌─────────────────────────────────────────────────────┐
 *   │               EFFECTS LAYER                         │
 *   │     (Strobe, Pulse, Blinder, Shake, etc)            │
 *   └─────────────────────────────────────────────────────┘
 *                          ▲
 *   ┌─────────────────────────────────────────────────────┐
 *   │                 BASE LAYER                          │
 *   │     (Color + Position from V15/V16)                 │
 *   └─────────────────────────────────────────────────────┘
 * 
 * SAFETY: Mechanical Debounce de 2000ms para Gobo/Prism
 * (Protege los servos de cambios rápidos)
 * 
 * @author Claude Opus (PunkOpus Quantum Engineer)
 * @auditor GeminiPunk Architect
 * @version 17.0
 */

// ============================================================================
// LAYER STACK - Sistema de Capas (como Photoshop)
// ============================================================================

class LayerStack {
    constructor() {
        // Capa base: lo que dice Selene (color + position)
        this.baseLayer = {
            r: 0, g: 0, b: 0, w: 0,
            dimmer: 255,
            pan: 127, tilt: 127,
            // Optics abstractos (0.0-1.0)
            beamWidth: 0.5,      // 0=spot, 1=wash
            texture: 0.0,        // 0=open, 1=complex gobo
            fragmentation: 0.0,  // 0=single beam, 1=prism max
        };
        
        // Capa de efectos: modificadores temporales
        this.effectsLayer = {
            dimmerMultiplier: 1.0,  // Para strobe/pulse
            colorOverride: null,    // {r,g,b} o null
            positionOffset: { pan: 0, tilt: 0 },  // Para shake
            active: false,
        };
        
        // Capa de ópticas: estado mecánico
        this.opticsLayer = {
            prismActive: false,
            goboIndex: 0,       // 0 = open
            zoomValue: 0.5,     // 0-1
            focusValue: 0.5,    // 0-1
        };
    }
    
    /**
     * Merge todas las capas en un estado final
     * @returns {Object} Estado mezclado listo para convertir a DMX
     */
    merge() {
        const base = this.baseLayer;
        const fx = this.effectsLayer;
        const optics = this.opticsLayer;
        
        // Empezar con base
        const result = {
            r: base.r,
            g: base.g,
            b: base.b,
            w: base.w,
            dimmer: base.dimmer,
            pan: base.pan,
            tilt: base.tilt,
            // Optics
            beamWidth: base.beamWidth,
            texture: base.texture,
            fragmentation: base.fragmentation,
            prismActive: optics.prismActive,
            goboIndex: optics.goboIndex,
            zoomValue: optics.zoomValue,
            focusValue: optics.focusValue,
        };
        
        // Aplicar effects layer si está activo
        if (fx.active) {
            // Dimmer multiplier (strobe, pulse, blinder)
            result.dimmer = Math.round(result.dimmer * fx.dimmerMultiplier);
            
            // Color override (blinder white, police colors)
            if (fx.colorOverride) {
                result.r = fx.colorOverride.r;
                result.g = fx.colorOverride.g;
                result.b = fx.colorOverride.b;
                if (fx.colorOverride.w !== undefined) {
                    result.w = fx.colorOverride.w;
                }
            }
            
            // Position offset (shake, dizzy)
            result.pan = Math.max(0, Math.min(255, result.pan + fx.positionOffset.pan));
            result.tilt = Math.max(0, Math.min(255, result.tilt + fx.positionOffset.tilt));
        }
        
        // Clamp final
        result.dimmer = Math.max(0, Math.min(255, result.dimmer));
        result.r = Math.max(0, Math.min(255, result.r));
        result.g = Math.max(0, Math.min(255, result.g));
        result.b = Math.max(0, Math.min(255, result.b));
        result.w = Math.max(0, Math.min(255, result.w));
        
        return result;
    }
    
    /**
     * Actualiza la capa base desde Selene decision
     */
    setBase(state) {
        Object.assign(this.baseLayer, state);
    }
    
    /**
     * Resetea la capa de efectos
     */
    clearEffects() {
        this.effectsLayer = {
            dimmerMultiplier: 1.0,
            colorOverride: null,
            positionOffset: { pan: 0, tilt: 0 },
            active: false,
        };
    }
}


// ============================================================================
// EFFECT DEFINITIONS - Cada efecto como objeto
// ============================================================================

const EFFECT_DEFINITIONS = {
    // -------------------------------------------------------------------------
    // STROBE - Parpadeo rápido sincronizado
    // -------------------------------------------------------------------------
    strobe: {
        name: 'Strobe',
        type: 'dimmer',
        params: {
            rate: 10,           // Hz (flashes per second)
            intensity: 1.0,     // 0-1, cuánto apaga en off
            dutyCycle: 0.3,     // % del tiempo encendido
        },
        process: (time, params, entropy) => {
            const period = 1000 / params.rate;
            const phase = (time % period) / period;
            const on = phase < params.dutyCycle;
            return {
                dimmerMultiplier: on ? 1.0 : (1.0 - params.intensity),
            };
        },
        minDuration: 500,  // ms mínimo activo
    },
    
    // -------------------------------------------------------------------------
    // PULSE - Respiración suave (sin wave)
    // -------------------------------------------------------------------------
    pulse: {
        name: 'Pulse',
        type: 'dimmer',
        params: {
            rate: 1.0,          // Hz
            minBrightness: 0.3, // Mínimo dimmer
            maxBrightness: 1.0, // Máximo dimmer
        },
        process: (time, params, entropy) => {
            // Sine wave manual: sin(2π * freq * t)
            const phase = (time / 1000) * params.rate * 2 * Math.PI;
            const sine = Math.sin(phase);
            // Map -1..1 to min..max
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
    // BLINDER - Flash blanco total
    // -------------------------------------------------------------------------
    blinder: {
        name: 'Blinder',
        type: 'color',
        params: {
            useWhite: true,     // Usar canal W si existe
            intensity: 1.0,
        },
        process: (time, params, entropy) => {
            return {
                dimmerMultiplier: params.intensity,
                colorOverride: params.useWhite 
                    ? { r: 255, g: 255, b: 255, w: 255 }
                    : { r: 255, g: 255, b: 255 },
            };
        },
        minDuration: 100,  // Puede ser muy corto
    },
    
    // -------------------------------------------------------------------------
    // SHAKE - Vibración en position
    // -------------------------------------------------------------------------
    shake: {
        name: 'Shake',
        type: 'position',
        params: {
            intensity: 20,      // Amplitud en DMX units
            rate: 8,            // Hz
            axis: 'both',       // 'pan', 'tilt', 'both'
        },
        process: (time, params, entropy) => {
            // Pseudo-random shake usando entropy y time
            const seed = entropy + Math.floor(time / (1000 / params.rate));
            const hash = (seed * 9301 + 49297) % 233280;
            const rnd1 = (hash / 233280) * 2 - 1;  // -1 to 1
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
    // DIZZY - Movimiento circular rápido
    // -------------------------------------------------------------------------
    dizzy: {
        name: 'Dizzy',
        type: 'position',
        params: {
            radius: 30,         // Amplitud en DMX units
            rate: 3,            // Rotaciones por segundo
        },
        process: (time, params, entropy) => {
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
            rate: 4,            // Hz (cambios por segundo)
        },
        process: (time, params, entropy) => {
            const period = 1000 / params.rate;
            const phase = Math.floor(time / period) % 2;
            return {
                colorOverride: phase === 0 
                    ? { r: 255, g: 0, b: 0 }    // Rojo
                    : { r: 0, g: 0, b: 255 },   // Azul
            };
        },
        minDuration: 2000,
    },
    
    // -------------------------------------------------------------------------
    // RAINBOW - Ciclo de colores (usando entropía para fase)
    // -------------------------------------------------------------------------
    rainbow: {
        name: 'Rainbow',
        type: 'color',
        params: {
            rate: 0.5,          // Ciclos por segundo
            saturation: 1.0,
        },
        process: (time, params, entropy) => {
            // Hue cycle con offset por entropía
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
            rate: 0.15,         // Muy lento: ~7 segundos por ciclo
            minBrightness: 0.4,
            maxBrightness: 1.0,
        },
        process: (time, params, entropy) => {
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
};

// Helper: HSL to RGB
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}


// ============================================================================
// EFFECT MANAGER - Gestiona efectos activos
// ============================================================================

class EffectManager {
    constructor() {
        this.activeEffects = new Map();  // effectId -> { def, params, startTime, endTime }
        this.effectIdCounter = 0;
    }
    
    /**
     * Activa un efecto
     * @param {string} effectName - Nombre del efecto (strobe, pulse, etc)
     * @param {Object} params - Parámetros override (opcional)
     * @param {number} duration - Duración en ms (0 = indefinido)
     * @returns {number} effectId para poder cancelarlo
     */
    trigger(effectName, params = {}, duration = 0) {
        const def = EFFECT_DEFINITIONS[effectName];
        if (!def) {
            console.warn(`[EffectManager] Unknown effect: ${effectName}`);
            return -1;
        }
        
        const id = ++this.effectIdCounter;
        const now = performance.now();
        
        // Merge params con defaults
        const mergedParams = { ...def.params, ...params };
        
        // Calcular endTime
        const minDuration = def.minDuration || 500;
        const actualDuration = duration > 0 ? Math.max(duration, minDuration) : 0;
        
        this.activeEffects.set(id, {
            def,
            params: mergedParams,
            startTime: now,
            endTime: actualDuration > 0 ? now + actualDuration : Infinity,
        });
        
        console.log(`[EffectManager] ⚡ Triggered: ${effectName} (id=${id}, duration=${actualDuration}ms)`);
        return id;
    }
    
    /**
     * Cancela un efecto por ID
     */
    cancel(effectId) {
        if (this.activeEffects.has(effectId)) {
            const fx = this.activeEffects.get(effectId);
            console.log(`[EffectManager] ❌ Cancelled: ${fx.def.name}`);
            this.activeEffects.delete(effectId);
        }
    }
    
    /**
     * Cancela todos los efectos de un tipo
     */
    cancelType(typeName) {
        for (const [id, fx] of this.activeEffects) {
            if (fx.def.name.toLowerCase() === typeName.toLowerCase()) {
                this.activeEffects.delete(id);
            }
        }
    }
    
    /**
     * Cancela todos los efectos
     */
    cancelAll() {
        this.activeEffects.clear();
    }
    
    /**
     * Procesa todos los efectos activos y retorna el estado combinado
     * @param {number} entropy - Entropía del sistema para determinismo
     * @returns {Object} Estado combinado del effects layer
     */
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
                console.log(`[EffectManager] ⏱️ Expired: ${fx.def.name}`);
                this.activeEffects.delete(id);
            }
        }
        
        // Si no hay efectos activos, retornar estado neutro
        if (this.activeEffects.size === 0) {
            return result;
        }
        
        result.active = true;
        
        // Procesar cada efecto
        for (const [id, fx] of this.activeEffects) {
            const relativeTime = now - fx.startTime;
            const fxResult = fx.def.process(relativeTime, fx.params, entropy);
            
            // Merge resultados (último gana para color, multiplicativo para dimmer)
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
    
    /**
     * Retorna lista de efectos activos (para debug/UI)
     */
    getActiveList() {
        return Array.from(this.activeEffects.values()).map(fx => fx.def.name);
    }
}


// ============================================================================
// OPTICS ENGINE - Motor de Ópticas con MECHANICAL DEBOUNCE
// ============================================================================

/**
 * ⚠️ CRITICAL SAFETY: MECHANICAL HOLD TIME
 * 
 * Los Gobos y Prismas son piezas MECÁNICAS con motores paso a paso.
 * No son LEDs que cambian instantáneamente.
 * 
 * Si cambias el prisma 10 veces por segundo:
 * - El motor se quemará
 * - Hará ruido horrible (clack-clack-clack)
 * - Acortarás la vida del fixture
 * 
 * SOLUCIÓN: Mechanical Hysteresis
 * Una vez que un estado mecánico cambia, se BLOQUEA por HOLD_TIME_MS
 */

const MECHANICAL_HOLD_TIME_MS = 2000;  // 2 segundos - CRÍTICO PARA HARDWARE

class OpticEngine {
    constructor() {
        // Estado actual de ópticas
        this.state = {
            prismActive: false,
            goboIndex: 0,        // 0 = open
            zoomValue: 0.5,      // 0-1
            focusValue: 0.5,     // 0-1
        };
        
        // ⚠️ Timestamps de último cambio para debounce mecánico
        this.lastChangeTime = {
            prism: 0,
            gobo: 0,
        };
        
        // Target state (lo que Selene quiere)
        this.targetState = { ...this.state };
        
        // Gobo presets por "mood" (mapeo abstracto)
        this.goboPresets = {
            open: 0,
            dots: 1,
            lines: 2,
            star: 3,
            spiral: 4,
            breakup: 5,
        };
    }
    
    /**
     * Selene solicita un estado óptico abstracto
     * @param {Object} opticsMood - { beamWidth, texture, fragmentation }
     * @param {number} entropy - Para selección determinista de gobos
     */
    setTarget(opticsMood, entropy = 0) {
        const { beamWidth = 0.5, texture = 0, fragmentation = 0 } = opticsMood;
        
        // Zoom: beamWidth directo (continuo, sin debounce)
        this.targetState.zoomValue = beamWidth;
        
        // Focus: inverso a zoom para mantener enfoque
        this.targetState.focusValue = 1.0 - beamWidth * 0.3;
        
        // Prism: activo si fragmentation > 0.5
        this.targetState.prismActive = fragmentation > 0.5;
        
        // Gobo: selección basada en texture + entropy
        if (texture < 0.1) {
            this.targetState.goboIndex = 0;  // Open
        } else {
            // Usar entropy para seleccionar gobo de forma determinista
            const goboCount = Object.keys(this.goboPresets).length - 1;  // Sin 'open'
            const selectedGobo = 1 + Math.floor((entropy % 1000) / 1000 * goboCount);
            this.targetState.goboIndex = Math.min(selectedGobo, goboCount);
        }
    }
    
    /**
     * Update con MECHANICAL DEBOUNCE
     * Solo permite cambios mecánicos si ha pasado HOLD_TIME
     */
    update() {
        const now = performance.now();
        
        // Zoom y Focus: actualizan inmediatamente (son continuos)
        // Pero con interpolación suave para no saltar
        this.state.zoomValue += (this.targetState.zoomValue - this.state.zoomValue) * 0.1;
        this.state.focusValue += (this.targetState.focusValue - this.state.focusValue) * 0.1;
        
        // ⚠️ PRISM: Mechanical Debounce
        if (this.targetState.prismActive !== this.state.prismActive) {
            const timeSinceLastChange = now - this.lastChangeTime.prism;
            if (timeSinceLastChange >= MECHANICAL_HOLD_TIME_MS) {
                this.state.prismActive = this.targetState.prismActive;
                this.lastChangeTime.prism = now;
                console.log(`[OpticEngine] 🔷 Prism: ${this.state.prismActive ? 'IN' : 'OUT'} (held ${Math.round(timeSinceLastChange)}ms)`);
            }
            // Si no ha pasado el hold time, ignorar el cambio
        }
        
        // ⚠️ GOBO: Mechanical Debounce
        if (this.targetState.goboIndex !== this.state.goboIndex) {
            const timeSinceLastChange = now - this.lastChangeTime.gobo;
            if (timeSinceLastChange >= MECHANICAL_HOLD_TIME_MS) {
                this.state.goboIndex = this.targetState.goboIndex;
                this.lastChangeTime.gobo = now;
                const goboName = Object.keys(this.goboPresets)[this.state.goboIndex] || 'custom';
                console.log(`[OpticEngine] 🎯 Gobo: ${goboName} (index=${this.state.goboIndex}, held ${Math.round(timeSinceLastChange)}ms)`);
            }
        }
        
        return { ...this.state };
    }
    
    /**
     * Forzar reset inmediato (para emergencias o inicio)
     */
    forceReset() {
        this.state = {
            prismActive: false,
            goboIndex: 0,
            zoomValue: 0.5,
            focusValue: 0.5,
        };
        this.targetState = { ...this.state };
        this.lastChangeTime.prism = 0;
        this.lastChangeTime.gobo = 0;
        console.log('[OpticEngine] 🔄 Force reset to defaults');
    }
    
    /**
     * Retorna el estado actual para debug/UI
     */
    getState() {
        return {
            current: { ...this.state },
            target: { ...this.targetState },
            holdTimes: {
                prism: Math.max(0, MECHANICAL_HOLD_TIME_MS - (performance.now() - this.lastChangeTime.prism)),
                gobo: Math.max(0, MECHANICAL_HOLD_TIME_MS - (performance.now() - this.lastChangeTime.gobo)),
            },
        };
    }
}


// ============================================================================
// SELENE EFFECTS ENGINE - Integración completa
// ============================================================================

class SeleneEffectsEngine {
    constructor() {
        this.layerStack = new LayerStack();
        this.effectManager = new EffectManager();
        this.opticEngine = new OpticEngine();
        
        // Sistema de entropía determinista
        this.entropy = 0;
        this.frameCount = 0;
        
        console.log('[SeleneEffectsEngine] 🌟 V17 initialized');
        console.log(`[SeleneEffectsEngine] ⚙️ Mechanical Hold Time: ${MECHANICAL_HOLD_TIME_MS}ms`);
    }
    
    /**
     * Update principal - llamar cada frame
     * @param {Object} baseState - Estado base de Selene (color, position)
     * @param {Object} audioState - Estado de audio { energy, bass, mid, treble, bpm }
     * @param {number} paletteIndex - Índice de paleta activa (para entropía)
     */
    update(baseState, audioState = {}, paletteIndex = 0) {
        this.frameCount++;
        
        // Calcular entropía determinista
        this.entropy = this.getSystemEntropy(paletteIndex);
        
        // 1. Actualizar capa base
        this.layerStack.setBase(baseState);
        
        // 2. Procesar efectos activos
        const effectsState = this.effectManager.process(this.entropy);
        this.layerStack.effectsLayer = effectsState;
        
        // 3. Actualizar ópticas (con mechanical debounce)
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
    
    /**
     * Entropía determinista - misma canción = mismo show
     */
    getSystemEntropy(paletteIndex) {
        // Basado en frameCount y paletteIndex
        // Determinista: mismo input = mismo output
        const seed = (this.frameCount * 127 + paletteIndex * 9973) % 100000;
        return seed;
    }
    
    /**
     * Disparar un efecto
     */
    triggerEffect(effectName, params = {}, duration = 0) {
        return this.effectManager.trigger(effectName, params, duration);
    }
    
    /**
     * Cancelar efecto
     */
    cancelEffect(effectId) {
        this.effectManager.cancel(effectId);
    }
    
    /**
     * Cancelar todos los efectos
     */
    cancelAllEffects() {
        this.effectManager.cancelAll();
    }
    
    /**
     * Establecer estado óptico abstracto
     */
    setOptics(opticsMood) {
        this.opticEngine.setTarget(opticsMood, this.entropy);
    }
    
    /**
     * Reset de emergencia
     */
    emergencyReset() {
        this.effectManager.cancelAll();
        this.opticEngine.forceReset();
        this.layerStack.clearEffects();
        console.log('[SeleneEffectsEngine] 🚨 Emergency reset complete');
    }
    
    /**
     * Estado para debug/UI
     */
    getDebugState() {
        return {
            activeEffects: this.effectManager.getActiveList(),
            optics: this.opticEngine.getState(),
            entropy: this.entropy,
            frameCount: this.frameCount,
        };
    }
}


// ============================================================================
// FIXTURE OPTICS MAPPER - Traduce OpticState a DMX real
// ============================================================================

/**
 * Este mapper conecta el OpticEngine abstracto con los canales DMX reales
 * del fixture según su configuración .fxt
 */
class FixtureOpticsMapper {
    constructor(fixtureConfig) {
        // fixtureConfig viene del FXTParser
        this.config = fixtureConfig || {};
        this.channels = this.config.channels || {};
    }
    
    /**
     * Mapea OpticState abstracto a valores DMX
     * @param {Object} opticState - { prismActive, goboIndex, zoomValue, focusValue }
     * @returns {Object} Valores DMX para cada canal óptico
     */
    mapToDMX(opticState) {
        const dmx = {};
        
        // ZOOM: 0-1 → 0-255
        if (this.channels.zoom !== undefined) {
            dmx.zoom = Math.round(opticState.zoomValue * 255);
        }
        
        // FOCUS: 0-1 → 0-255
        if (this.channels.focus !== undefined) {
            dmx.focus = Math.round(opticState.focusValue * 255);
        }
        
        // PRISM: boolean → valor DMX (típicamente 0=off, 128+=on)
        if (this.channels.prism !== undefined) {
            dmx.prism = opticState.prismActive ? 200 : 0;
        }
        
        // GOBO: index → valor DMX (depende del fixture)
        // La mayoría de fixtures dividen 0-255 entre sus gobos
        if (this.channels.gobo !== undefined) {
            const goboCount = this.config.goboCount || 8;
            const goboStep = Math.floor(255 / goboCount);
            dmx.gobo = opticState.goboIndex * goboStep;
        }
        
        return dmx;
    }
    
    /**
     * Actualiza la configuración del fixture
     */
    setFixtureConfig(config) {
        this.config = config;
        this.channels = config.channels || {};
    }
}


// ============================================================================
// EXPORTS
// ============================================================================

// Para uso en browser
if (typeof window !== 'undefined') {
    window.SeleneEffectsEngine = SeleneEffectsEngine;
    window.EffectManager = EffectManager;
    window.OpticEngine = OpticEngine;
    window.LayerStack = LayerStack;
    window.FixtureOpticsMapper = FixtureOpticsMapper;
    window.EFFECT_DEFINITIONS = EFFECT_DEFINITIONS;
    window.MECHANICAL_HOLD_TIME_MS = MECHANICAL_HOLD_TIME_MS;
}

// Para uso en Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SeleneEffectsEngine,
        EffectManager,
        OpticEngine,
        LayerStack,
        FixtureOpticsMapper,
        EFFECT_DEFINITIONS,
        MECHANICAL_HOLD_TIME_MS,
    };
}
