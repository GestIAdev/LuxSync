/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔌 CHRONOS INJECTOR - THE WHISPERER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 2002: THE SYNAPTIC BRIDGE
 *
 * El puente entre Chronos y el sistema nervioso de LuxSync.
 * Toma el estado del timeline y genera overrides para Selene/Titan.
 *
 * FILOSOFÍA:
 * - Chronos SUSURRA a Selene, no la reemplaza
 * - En modo 'whisper': Chronos sugiere, Selene refina
 * - En modo 'full': Chronos dicta, Selene obedece
 *
 * FLUJO DE DATOS:
 * ```
 * ChronosEngine.tick() → ChronosContext
 *                             ↓
 *                    ChronosInjector.inject()
 *                             ↓
 *                    ChronosOverrides (para Titan)
 *                             ↓
 *                    TitanEngine.setChronosInput()
 *                             ↓
 *               MusicalContext modificado → Física normal
 * ```
 *
 * @module chronos/bridge/ChronosInjector
 * @version 2002.0.0
 */
// ═══════════════════════════════════════════════════════════════════════════
// 🔌 CHRONOS INJECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🔌 CHRONOS INJECTOR
 *
 * Transforma ChronosContext (del engine) en ChronosOverrides (para Titan).
 * Es el "traductor" entre el timeline y el sistema en vivo.
 */
export class ChronosInjector {
    constructor() {
        // ═══════════════════════════════════════════════════════════════════════
        // STATE
        // ═══════════════════════════════════════════════════════════════════════
        /** Efectos que ya fueron triggerados (para evitar re-triggers) */
        this.triggeredClipIds = new Set();
        /** Último timestamp procesado (para detectar saltos/seeks) */
        this.lastTimestamp = 0;
        /** Mapeo de clip ID → instance ID en EffectManager */
        this.clipToInstanceMap = new Map();
        /** ¿Está habilitado el injector? */
        this.enabled = true;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Habilita/deshabilita el injector
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.reset();
        }
    }
    /**
     * ¿Está habilitado?
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * 🔌 INJECT
     *
     * Transforma ChronosContext en ChronosOverrides.
     *
     * @param context Contexto de Chronos (del engine)
     * @returns Overrides para inyectar en TitanEngine
     */
    inject(context) {
        if (!this.enabled || !context.active) {
            return this.createEmptyOverrides(context.timestamp);
        }
        // Detectar seek/salto (para resetear triggers)
        const isSeek = Math.abs(context.timestamp - this.lastTimestamp) > 100;
        if (isSeek) {
            this.handleSeek(context.timestamp);
        }
        this.lastTimestamp = context.timestamp;
        // Procesar cada componente
        const forcedVibe = this.processForcedVibe(context);
        const modulators = this.processModulators(context);
        const { triggers, activeEffects } = this.processEffects(context);
        const zoneOverride = this.processZoneOverride(context);
        const colorOverride = this.processColorOverride(context);
        return {
            active: true,
            mode: context.overrideMode,
            timestamp: context.timestamp,
            forcedVibe,
            modulators,
            triggerEvents: triggers,
            activeEffectsWithProgress: activeEffects,
            zoneOverride,
            colorOverride,
        };
    }
    /**
     * 📊 APPLY TO MUSICAL CONTEXT
     *
     * Aplica los overrides de Chronos a un MusicalContext existente.
     * Usado por TitanEngine para "susurrar" al contexto.
     *
     * @param original MusicalContext original (del audio en vivo)
     * @param overrides Overrides de Chronos
     * @returns MusicalContext modificado
     */
    applyToMusicalContext(original, overrides) {
        if (!overrides.active) {
            return original;
        }
        const modified = { ...original };
        // Aplicar moduladores según modo
        const isWhisper = overrides.mode === 'whisper';
        // Energy override
        if (overrides.modulators.energyOverride !== null) {
            if (isWhisper) {
                // Whisper: Blend con energía original (70% Chronos, 30% Live)
                modified.energy = overrides.modulators.energyOverride * 0.7 + original.energy * 0.3;
            }
            else {
                // Full: Dictar energía completamente
                modified.energy = overrides.modulators.energyOverride;
            }
        }
        // Intensity master → afecta energy también
        if (overrides.modulators.masterIntensity !== null) {
            modified.energy *= overrides.modulators.masterIntensity;
        }
        // Vibe override
        if (overrides.forcedVibe) {
            // El vibeId se pasa por separado a VibeManager
            // Aquí solo podemos marcar que hay override
            ;
            modified._chronosVibeId = overrides.forcedVibe.vibeId;
            modified._chronosVibeTransition = overrides.forcedVibe.transitionProgress;
        }
        // Key lock (color override)
        if (overrides.colorOverride?.keyLock) {
            // Cast a MusicalKey - Chronos garantiza que es válido
            modified.key = overrides.colorOverride.keyLock;
            modified.confidence = 1.0; // Forzar confianza máxima
        }
        // Marcar que viene de Chronos
        ;
        modified._fromChronos = true;
        modified._chronosTimestamp = overrides.timestamp;
        return modified;
    }
    /**
     * 🔃 RESET
     *
     * Resetea el estado interno (para seeks, stops, etc.)
     */
    reset() {
        this.triggeredClipIds.clear();
        this.clipToInstanceMap.clear();
        this.lastTimestamp = 0;
    }
    /**
     * 📝 REGISTER EFFECT INSTANCE
     *
     * Registra el ID de instancia de un efecto disparado.
     * Usado para poder controlar su progress después.
     */
    registerEffectInstance(clipId, instanceId) {
        this.clipToInstanceMap.set(clipId, instanceId);
    }
    /**
     * 🗑️ UNREGISTER EFFECT INSTANCE
     *
     * Limpia el registro cuando un efecto termina.
     */
    unregisterEffectInstance(clipId) {
        this.clipToInstanceMap.delete(clipId);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // PRIVATE - PROCESSORS
    // ═══════════════════════════════════════════════════════════════════════
    processForcedVibe(context) {
        if (!context.vibeOverride)
            return null;
        return {
            vibeId: context.vibeOverride.vibeId,
            transition: context.vibeOverride.transition,
            transitionProgress: context.vibeOverride.progress,
        };
    }
    processModulators(context) {
        const mods = {
            masterIntensity: null,
            masterSpeed: null,
            hueOffset: null,
            saturation: null,
            energyOverride: null,
            custom: new Map(),
        };
        // Extraer valores de automation evaluados
        for (const [target, value] of context.automationValues) {
            switch (target) {
                case 'master.intensity':
                    mods.masterIntensity = value;
                    break;
                case 'master.speed':
                    mods.masterSpeed = value;
                    break;
                case 'master.hue_offset':
                    mods.hueOffset = value * 360; // Normalizado a degrees
                    break;
                case 'master.saturation':
                    mods.saturation = value;
                    break;
                case 'selene.energy':
                    mods.energyOverride = value;
                    break;
                default:
                    // Parámetros custom
                    if (target.startsWith('param.')) {
                        const paramName = target.slice(6);
                        mods.custom.set(paramName, value);
                    }
            }
        }
        // Override de intensidad desde clip directo (si hay)
        if (context.intensityOverride !== null) {
            mods.masterIntensity = context.intensityOverride;
        }
        return mods;
    }
    processEffects(context) {
        const triggers = [];
        const activeEffects = [];
        for (const effect of context.activeEffects) {
            // ¿Es nuevo trigger? (no lo hemos disparado antes)
            const isNewTrigger = !this.triggeredClipIds.has(effect.sourceClipId);
            if (isNewTrigger) {
                // Marcar como triggerado
                this.triggeredClipIds.add(effect.sourceClipId);
                triggers.push({
                    effectId: effect.effectId,
                    intensity: effect.intensity,
                    speed: effect.speed,
                    zones: effect.zones,
                    params: effect.params,
                    sourceClipId: effect.sourceClipId,
                    isNewTrigger: true,
                });
            }
            // Siempre añadir a activeEffects con progress (para scrubbing)
            activeEffects.push({
                effectId: effect.effectId,
                instanceId: this.clipToInstanceMap.get(effect.sourceClipId) ?? null,
                progress: effect.progress,
                intensity: effect.intensity,
                sourceClipId: effect.sourceClipId,
            });
        }
        // Limpiar clips que ya no están activos
        const activeClipIds = new Set(context.activeEffects.map(e => e.sourceClipId));
        for (const clipId of this.triggeredClipIds) {
            if (!activeClipIds.has(clipId)) {
                this.triggeredClipIds.delete(clipId);
                this.clipToInstanceMap.delete(clipId);
            }
        }
        return { triggers, activeEffects };
    }
    processZoneOverride(context) {
        if (!context.zoneOverrides)
            return null;
        return {
            enabledZones: context.zoneOverrides.enabledZones,
            blackoutDisabled: context.zoneOverrides.blackoutDisabled,
        };
    }
    processColorOverride(context) {
        if (!context.colorOverride)
            return null;
        return {
            palette: context.colorOverride.palette,
            keyLock: context.colorOverride.keyLock,
        };
    }
    handleSeek(newTimestamp) {
        // En un seek, limpiar todos los triggers para re-evaluar
        this.triggeredClipIds.clear();
        // Mantener clipToInstanceMap para efectos que siguen activos
    }
    createEmptyOverrides(timestamp) {
        return {
            active: false,
            mode: 'whisper',
            timestamp,
            forcedVibe: null,
            modulators: {
                masterIntensity: null,
                masterSpeed: null,
                hueOffset: null,
                saturation: null,
                energyOverride: null,
                custom: new Map(),
            },
            triggerEvents: [],
            activeEffectsWithProgress: [],
            zoneOverride: null,
            colorOverride: null,
        };
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// 🏭 SINGLETON
// ═══════════════════════════════════════════════════════════════════════════
let injectorInstance = null;
/**
 * Obtiene la instancia singleton del ChronosInjector
 */
export function getChronosInjector() {
    if (!injectorInstance) {
        injectorInstance = new ChronosInjector();
    }
    return injectorInstance;
}
/**
 * Resetea la instancia (para testing)
 */
export function resetChronosInjector() {
    if (injectorInstance) {
        injectorInstance.reset();
    }
    injectorInstance = null;
}
