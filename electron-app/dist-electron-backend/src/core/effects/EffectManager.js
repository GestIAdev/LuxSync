/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECT MANAGER - THE ORCHESTRA CONDUCTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 600: EFFECT ARSENAL
 * WAVE 680: THE ARSENAL & THE SHIELD
 *
 * El EffectManager es el orquestador central de todos los efectos.
 * Mantiene la lista de efectos activos, los actualiza cada frame,
 * y combina sus outputs para el MasterArbiter.
 *
 * 🛡️ WAVE 680: THE SHIELD - Sistema de permisos por Vibe
 * Antes de disparar cualquier efecto, consulta las restricciones del Vibe activo.
 * Si el efecto está prohibido, se bloquea. Si está degradado, se ajusta.
 *
 * RESPONSABILIDADES:
 * 1. Registry de tipos de efectos disponibles
 * 2. Instanciar y disparar efectos bajo demanda
 * 3. 🛡️ Validar permisos de Vibe antes de disparar (THE SHIELD)
 * 4. Actualizar efectos activos cada frame
 * 5. Combinar outputs (HTP para dimmer, LTP para color)
 * 6. Limpiar efectos terminados
 *
 * SINGLETON: Solo hay un EffectManager global
 *
 * @module core/effects/EffectManager
 * @version WAVE 680
 */
import { EventEmitter } from 'events';
// Import effect library
import { SolarFlare } from './library/SolarFlare';
import { StrobeStorm } from './library/StrobeStorm';
import { StrobeBurst } from './library/StrobeBurst';
import { TidalWave } from './library/TidalWave';
import { GhostBreath } from './library/GhostBreath';
// 🎺 WAVE 692: FIESTA LATINA ARSENAL
import { TropicalPulse } from './library/TropicalPulse';
import { SalsaFire } from './library/SalsaFire';
// 🥁 WAVE 700.6: NEW LATINA EFFECT
import { ClaveRhythm } from './library/ClaveRhythm';
import { CumbiaMoon } from './library/CumbiaMoon';
// 🛡️ WAVE 680: Import VibeManager for THE SHIELD
import { VibeManager } from '../../engine/vibe/VibeManager';
/**
 * 🛡️ EFFECT TYPE → VIBE RULES
 *
 * Define qué efectos son bloqueados/degradados en cada Vibe.
 * Las reglas se consultan en runtime contra el VibeProfile activo.
 */
const EFFECT_VIBE_RULES = {
    'solar_flare': { isDynamic: true },
    'strobe_storm': { requiresStrobe: true, isDynamic: true },
    'strobe_burst': { isDynamic: true }, // 🔥 WAVE 691: Rhythmic strobe for Latina
    'tidal_wave': { isDynamic: true },
    'ghost_breath': { isDynamic: true },
    // 🎺 WAVE 692: FIESTA LATINA ARSENAL
    'tropical_pulse': { isDynamic: true }, // 🌴 Crescendo bursts
    'salsa_fire': { isDynamic: true }, // 🔥 Fire flicker
    'cumbia_moon': { isDynamic: false }, // 🌙 Ambient - allowed even in chill
    // 🥁 WAVE 700.6: NEW LATINA EFFECT
    'clave_rhythm': { isDynamic: true }, // 🥁 3-2 Clave pattern with movement
};
// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class EffectManager extends EventEmitter {
    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────
    constructor() {
        super();
        // ─────────────────────────────────────────────────────────────────────────
        // State
        // ─────────────────────────────────────────────────────────────────────────
        /** Registry de factories de efectos */
        this.effectFactories = new Map();
        /** Efectos actualmente activos */
        this.activeEffects = new Map();
        /** Stats */
        this.stats = {
            totalTriggered: 0,
            lastTriggered: null,
            lastTriggerTime: 0,
        };
        /** Frame timing */
        this.lastUpdateTime = Date.now();
        this.registerBuiltinEffects();
        console.log('[EffectManager 🎛️] Initialized with built-in effects');
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🧨 TRIGGER - Dispara un efecto
     *
     * 🛡️ WAVE 680: THE SHIELD integrado
     * Antes de disparar, valida permisos del Vibe activo.
     *
     * @param config Configuración del disparo
     * @returns ID de la instancia del efecto, o null si bloqueado/falla
     */
    trigger(config) {
        const factory = this.effectFactories.get(config.effectType);
        if (!factory) {
            console.warn(`[EffectManager ⚠️] Unknown effect type: ${config.effectType}`);
            return null;
        }
        // 🛡️ THE SHIELD - Validar permisos del Vibe
        const vibeId = config.musicalContext?.vibeId || this.getCurrentVibeId();
        const shieldResult = this.validateWithShield(config.effectType, vibeId);
        if (!shieldResult.allowed) {
            console.log(`[EffectManager ⛔] ${config.effectType} BLOCKED in ${vibeId}. ${shieldResult.message}`);
            this.emit('effectBlocked', {
                effectType: config.effectType,
                vibeId,
                reason: shieldResult.message,
            });
            return null;
        }
        // Crear nueva instancia
        const effect = factory();
        // 🛡️ Si está degradado, aplicar constraints
        if (shieldResult.degraded && shieldResult.constraints) {
            this.applyShieldConstraints(effect, shieldResult.constraints);
            console.log(`[EffectManager ⚠️] ${config.effectType} DEGRADED in ${vibeId}. ${shieldResult.message}`);
        }
        // Disparar
        effect.trigger(config);
        // Registrar como activo
        this.activeEffects.set(effect.id, effect);
        // Stats
        this.stats.totalTriggered++;
        this.stats.lastTriggered = config.effectType;
        this.stats.lastTriggerTime = Date.now();
        // Emit event
        this.emit('effectTriggered', {
            effectId: effect.id,
            effectType: config.effectType,
            intensity: config.intensity,
            source: config.source,
            vibeId,
            degraded: shieldResult.degraded,
        });
        // 🛡️ Log con estado de shield
        const shieldStatus = shieldResult.degraded ? '(DEGRADED)' : '';
        const zInfo = config.musicalContext?.zScore
            ? `Z: ${config.musicalContext.zScore.toFixed(1)}`
            : '';
        console.log(`[EffectManager ✅] ${config.effectType} FIRED in ${vibeId} ${shieldStatus} (Intensity: ${config.intensity.toFixed(2)} ${zInfo})`);
        return effect.id;
    }
    /**
     * 🔄 UPDATE - Actualiza todos los efectos activos
     *
     * Llamar cada frame desde TitanEngine o el main loop.
     */
    update() {
        const now = Date.now();
        const deltaMs = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        // Update each active effect
        const toRemove = [];
        for (const [id, effect] of this.activeEffects) {
            effect.update(deltaMs);
            if (effect.isFinished()) {
                toRemove.push(id);
            }
        }
        // Remove finished effects
        for (const id of toRemove) {
            this.activeEffects.delete(id);
            this.emit('effectFinished', { effectId: id });
        }
    }
    /**
     * 📤 GET COMBINED OUTPUT - Output combinado de todos los efectos activos
     *
     * Combina usando:
     * - HTP (Highest Takes Precedence) para dimmer
     * - Mayor prioridad para color
     * - 🧨 WAVE 630: globalOverride bypasea zonas
     */
    getCombinedOutput() {
        if (this.activeEffects.size === 0) {
            return {
                hasActiveEffects: false,
                intensity: 0,
                contributingEffects: [],
            };
        }
        let maxDimmer = 0;
        let maxWhite = 0;
        let maxAmber = 0; // 🧨 WAVE 630
        let maxStrobeRate = 0;
        let maxIntensity = 0;
        let globalOverride = false; // 🧨 WAVE 630
        let highestPriorityColor;
        let highestPriority = -1;
        const contributing = [];
        for (const [id, effect] of this.activeEffects) {
            const output = effect.getOutput();
            if (!output)
                continue;
            contributing.push(id);
            // HTP for dimmer
            if (output.dimmerOverride !== undefined && output.dimmerOverride > maxDimmer) {
                maxDimmer = output.dimmerOverride;
            }
            // HTP for white
            if (output.whiteOverride !== undefined && output.whiteOverride > maxWhite) {
                maxWhite = output.whiteOverride;
            }
            // 🧨 WAVE 630: HTP for amber
            if (output.amberOverride !== undefined && output.amberOverride > maxAmber) {
                maxAmber = output.amberOverride;
            }
            // Max strobe rate
            if (output.strobeRate !== undefined && output.strobeRate > maxStrobeRate) {
                maxStrobeRate = output.strobeRate;
            }
            // Max intensity
            if (output.intensity > maxIntensity) {
                maxIntensity = output.intensity;
            }
            // 🧨 WAVE 630: Global override - cualquier efecto con globalOverride activa el bypass
            if (output.globalOverride) {
                globalOverride = true;
            }
            // Highest priority takes color
            if (output.colorOverride && effect.priority > highestPriority) {
                highestPriority = effect.priority;
                highestPriorityColor = output.colorOverride;
            }
        }
        return {
            hasActiveEffects: true,
            dimmerOverride: maxDimmer > 0 ? maxDimmer : undefined,
            whiteOverride: maxWhite > 0 ? maxWhite : undefined,
            amberOverride: maxAmber > 0 ? maxAmber : undefined, // 🧨 WAVE 630
            colorOverride: highestPriorityColor,
            strobeRate: maxStrobeRate > 0 ? maxStrobeRate : undefined,
            intensity: maxIntensity,
            contributingEffects: contributing,
            globalOverride: globalOverride, // 🧨 WAVE 630
        };
    }
    /**
     * 📊 GET STATE - Estado actual del manager
     */
    getState() {
        return {
            activeCount: this.activeEffects.size,
            activeEffects: Array.from(this.activeEffects.keys()),
            lastTriggered: this.stats.lastTriggered,
            lastTriggerTime: this.stats.lastTriggerTime,
            totalTriggered: this.stats.totalTriggered,
        };
    }
    /**
     * ⛔ ABORT ALL - Aborta todos los efectos activos
     */
    abortAll() {
        for (const effect of this.activeEffects.values()) {
            effect.abort();
        }
        this.activeEffects.clear();
        console.log('[EffectManager ⛔] All effects aborted');
    }
    /**
     * ⛔ ABORT - Aborta un efecto específico
     */
    abort(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (effect) {
            effect.abort();
            this.activeEffects.delete(effectId);
            return true;
        }
        return false;
    }
    /**
     * 📋 LIST AVAILABLE - Lista tipos de efectos disponibles
     */
    getAvailableEffects() {
        return Array.from(this.effectFactories.keys());
    }
    /**
     * 🔌 REGISTER EFFECT - Registra un nuevo tipo de efecto
     */
    registerEffect(effectType, factory) {
        this.effectFactories.set(effectType, factory);
        console.log(`[EffectManager 🔌] Registered effect: ${effectType}`);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE: Built-in effects registration
    // ─────────────────────────────────────────────────────────────────────────
    registerBuiltinEffects() {
        // ☀️ Solar Flare - WAVE 600
        this.effectFactories.set('solar_flare', () => new SolarFlare());
        // ⚡ Strobe Storm - WAVE 680 (harsh, for rock/techno)
        this.effectFactories.set('strobe_storm', () => new StrobeStorm());
        // 🔥 Strobe Burst - WAVE 691 (rhythmic, for latina/festive)
        this.effectFactories.set('strobe_burst', () => new StrobeBurst());
        // 🌊 Tidal Wave - WAVE 680
        this.effectFactories.set('tidal_wave', () => new TidalWave());
        // 👻 Ghost Breath - WAVE 680
        this.effectFactories.set('ghost_breath', () => new GhostBreath());
        // ═══════════════════════════════════════════════════════════════════════
        // 🎺 WAVE 692: FIESTA LATINA ARSENAL
        // ═══════════════════════════════════════════════════════════════════════
        // 🌴 Tropical Pulse - Crescendo bursts like conga rhythm
        this.effectFactories.set('tropical_pulse', () => new TropicalPulse());
        // 🔥 Salsa Fire - Organic fire flicker effect  
        this.effectFactories.set('salsa_fire', () => new SalsaFire());
        // 🌙 Cumbia Moon - Soft breathing glow for breakdowns
        this.effectFactories.set('cumbia_moon', () => new CumbiaMoon());
        // ═══════════════════════════════════════════════════════════════════════
        // 🥁 WAVE 700.6: NEW LATINA EFFECT
        // ═══════════════════════════════════════════════════════════════════════
        // 🥁 Clave Rhythm - 3-2 pattern with color + movement
        this.effectFactories.set('clave_rhythm', () => new ClaveRhythm());
    }
    // ─────────────────────────────────────────────────────────────────────────
    // 🛡️ THE SHIELD - Vibe Permission System (WAVE 680)
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * 🛡️ GET CURRENT VIBE ID
     *
     * Obtiene el Vibe activo del VibeManager singleton.
     */
    getCurrentVibeId() {
        try {
            return VibeManager.getInstance().getActiveVibe().id;
        }
        catch {
            return 'idle'; // Fallback si VibeManager no está inicializado
        }
    }
    /**
     * 🛡️ VALIDATE WITH SHIELD
     *
     * Valida si un efecto está permitido en el Vibe actual.
     *
     * REGLAS:
     * - chill-lounge: BLOQUEO TOTAL de efectos dinámicos
     * - fiesta-latina: strobe PROHIBIDO (degradado a pulsos)
     * - techno-club: SIN RESTRICCIONES
     * - pop-rock: strobe con límite de 10Hz
     * - idle: BLOQUEO TOTAL (no hay show)
     */
    validateWithShield(effectType, vibeId) {
        const rules = EFFECT_VIBE_RULES[effectType];
        // Si no hay reglas para este efecto, permitir
        if (!rules) {
            return { allowed: true, degraded: false, message: 'No rules defined' };
        }
        // Obtener restricciones del Vibe
        let vibeEffects;
        try {
            const vibe = VibeManager.getInstance().getActiveVibe();
            vibeEffects = {
                allowed: vibe.effects.allowed,
                maxStrobeRate: vibe.effects.maxStrobeRate,
                maxIntensity: vibe.effects.maxIntensity,
            };
        }
        catch {
            // Fallback restrictivo si VibeManager falla
            vibeEffects = { allowed: [], maxStrobeRate: 0, maxIntensity: 0 };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 1: chill-lounge e idle = BLOQUEO TOTAL de dinámicos
        // ═══════════════════════════════════════════════════════════════
        if ((vibeId === 'chill-lounge' || vibeId === 'idle') && rules.isDynamic) {
            return {
                allowed: false,
                degraded: false,
                message: `Dynamic effects blocked in ${vibeId}`,
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 2: Strobe check - si maxStrobeRate = 0, degradar o bloquear
        // ═══════════════════════════════════════════════════════════════
        if (rules.requiresStrobe) {
            if (vibeEffects.maxStrobeRate === 0) {
                // fiesta-latina: degradar a pulsos simples (no strobe real)
                if (vibeId === 'fiesta-latina') {
                    return {
                        allowed: true,
                        degraded: true,
                        message: `Strobe degraded to pulses (no real strobe in ${vibeId})`,
                        constraints: {
                            maxStrobeRate: 0,
                            maxIntensity: vibeEffects.maxIntensity,
                        },
                    };
                }
                // Otros vibes con maxStrobeRate=0: bloquear
                return {
                    allowed: false,
                    degraded: false,
                    message: `Strobe effects blocked (maxStrobeRate=0)`,
                };
            }
            // Strobe permitido pero con límite de frecuencia
            return {
                allowed: true,
                degraded: vibeEffects.maxStrobeRate < 8, // Degradado si <8Hz
                message: `Strobe allowed (max ${vibeEffects.maxStrobeRate}Hz)`,
                constraints: {
                    maxStrobeRate: vibeEffects.maxStrobeRate,
                    maxIntensity: vibeEffects.maxIntensity,
                },
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // REGLA 3: Efectos dinámicos con maxIntensity < 0.5 = degradados
        // ═══════════════════════════════════════════════════════════════
        if (rules.isDynamic && vibeEffects.maxIntensity < 0.5) {
            return {
                allowed: true,
                degraded: true,
                message: `Effect intensity capped at ${vibeEffects.maxIntensity}`,
                constraints: {
                    maxIntensity: vibeEffects.maxIntensity,
                },
            };
        }
        // ═══════════════════════════════════════════════════════════════
        // DEFAULT: Permitido sin restricciones
        // ═══════════════════════════════════════════════════════════════
        return {
            allowed: true,
            degraded: false,
            message: 'No restrictions',
        };
    }
    /**
     * 🛡️ APPLY SHIELD CONSTRAINTS
     *
     * Aplica constraints del Shield a un efecto antes de dispararlo.
     */
    applyShieldConstraints(effect, constraints) {
        // Si el efecto tiene método setVibeConstraints, usarlo
        if ('setVibeConstraints' in effect && typeof effect.setVibeConstraints === 'function') {
            const degraded = constraints.maxStrobeRate === 0;
            effect.setVibeConstraints(constraints.maxStrobeRate ?? 15, degraded);
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let effectManagerInstance = null;
/**
 * Obtiene el singleton del EffectManager
 */
export function getEffectManager() {
    if (!effectManagerInstance) {
        effectManagerInstance = new EffectManager();
    }
    return effectManagerInstance;
}
/**
 * Reset del singleton (para tests)
 */
export function resetEffectManager() {
    if (effectManagerInstance) {
        effectManagerInstance.abortAll();
    }
    effectManagerInstance = null;
}
