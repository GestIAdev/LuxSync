/**
 * 🎛️ WAVE 59: VIBE MANAGER
 *
 * Singleton que gestiona el Vibe activo y provee restricciones a todos los Arbiters.
 * NO TOMA DECISIONES - Solo RESTRINGE el espacio de decisiones.
 *
 * Patrón: Service Locator + Bounded Context Provider
 *
 * FILOSOFÍA: RESTRINGIR, NO FORZAR
 *
 * 🏛️ WAVE 144: Añadido getColorConstitution() para proveer GenerationOptions
 */
import { DEFAULT_VIBE, getVibePreset, isValidVibeId, } from './profiles/index';
import { getColorConstitution as getConstitution } from '../color/colorConstitutions';
// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROXIMITY MAP
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Mapa de proximidad conceptual entre moods.
 * Usado para sugerir alternativas cuando un mood está prohibido.
 */
const MOOD_PROXIMITY = {
    'peaceful': ['calm', 'dreamy', 'playful'],
    'calm': ['peaceful', 'dreamy', 'playful'],
    'dreamy': ['calm', 'peaceful', 'playful'],
    'playful': ['festive', 'euphoric', 'energetic', 'calm'],
    'festive': ['playful', 'euphoric', 'energetic'],
    'euphoric': ['festive', 'playful', 'energetic', 'dramatic'],
    'dark': ['dramatic', 'tense', 'calm'],
    'dramatic': ['dark', 'tense', 'energetic', 'euphoric'],
    'aggressive': ['dramatic', 'tense', 'energetic', 'dark'],
    'energetic': ['dramatic', 'euphoric', 'festive', 'playful'],
    'tense': ['dramatic', 'dark', 'energetic', 'aggressive'],
};
// ═══════════════════════════════════════════════════════════════════════════
// VIBE MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class VibeManager {
    // ═══════════════════════════════════════════════════════════════
    // CONSTRUCTOR (Private for Singleton)
    // ═══════════════════════════════════════════════════════════════
    constructor() {
        this.previousVibe = null;
        this.transitionProgress = 1.0; // 1.0 = fully transitioned
        this.transitionDurationFrames = 180; // 3 seconds @ 60fps
        this.transitionStartFrame = 0;
        this.currentFrame = 0;
        const defaultPreset = getVibePreset(DEFAULT_VIBE);
        if (!defaultPreset) {
            throw new Error(`[VibeManager] Default vibe '${DEFAULT_VIBE}' not found in registry!`);
        }
        this.currentVibe = defaultPreset;
    }
    // ═══════════════════════════════════════════════════════════════
    // SINGLETON ACCESS
    // ═══════════════════════════════════════════════════════════════
    /**
     * Obtiene la instancia única del VibeManager.
     */
    static getInstance() {
        if (!VibeManager.instance) {
            VibeManager.instance = new VibeManager();
        }
        return VibeManager.instance;
    }
    /**
     * Resetea la instancia (útil para tests).
     */
    static resetInstance() {
        VibeManager.instance = null;
    }
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API - VIBE SWITCHING
    // ═══════════════════════════════════════════════════════════════
    /**
     * Cambia el Vibe activo con transición suave.
     *
     * @param vibeId - ID del vibe a activar
     * @param frameCount - Frame actual (opcional, usa interno si no se provee)
     * @returns true si el cambio fue iniciado, false si el vibe no existe o ya está activo
     */
    setActiveVibe(vibeId, frameCount) {
        // Validar ID
        if (!isValidVibeId(vibeId)) {
            console.warn(`[VibeManager] Invalid vibe ID: '${vibeId}'`);
            return false;
        }
        const newVibe = getVibePreset(vibeId);
        if (!newVibe) {
            console.warn(`[VibeManager] Vibe not found: '${vibeId}'`);
            return false;
        }
        // No hacer nada si ya es el vibe activo
        if (newVibe.id === this.currentVibe.id) {
            // 🐛 WAVE 69.1: Log para debug - no es un error, solo idempotencia
            console.log(`[VibeManager] Vibe already active: '${vibeId}' (no transition needed)`);
            return false;
        }
        // Iniciar transición
        this.previousVibe = this.currentVibe;
        this.currentVibe = newVibe;
        this.transitionProgress = 0.0;
        this.transitionStartFrame = frameCount ?? this.currentFrame;
        console.log(`[VibeManager] Transitioning: ${this.previousVibe.id} → ${newVibe.id}`);
        return true;
    }
    /**
     * Cambio instantáneo sin transición (para emergencias o inicio).
     */
    setActiveVibeImmediate(vibeId) {
        if (!isValidVibeId(vibeId)) {
            return false;
        }
        const newVibe = getVibePreset(vibeId);
        if (!newVibe) {
            return false;
        }
        this.currentVibe = newVibe;
        this.previousVibe = null;
        this.transitionProgress = 1.0;
        return true;
    }
    /**
     * Actualizar progreso de transición (llamar cada frame).
     */
    updateTransition(frameCount) {
        this.currentFrame = frameCount;
        if (this.transitionProgress >= 1.0) {
            return;
        }
        const elapsed = frameCount - this.transitionStartFrame;
        this.transitionProgress = Math.min(1.0, elapsed / this.transitionDurationFrames);
        if (this.transitionProgress >= 1.0) {
            this.previousVibe = null; // Cleanup
            console.log(`[VibeManager] Transition complete: ${this.currentVibe.id}`);
        }
    }
    /**
     * Obtiene el Vibe actualmente activo.
     */
    getActiveVibe() {
        return this.currentVibe;
    }
    /**
     * Verifica si hay una transición en curso.
     */
    isTransitioning() {
        return this.transitionProgress < 1.0;
    }
    /**
     * Obtiene el estado actual de la transición.
     */
    getTransitionState() {
        return {
            isTransitioning: this.isTransitioning(),
            from: this.previousVibe?.id ?? null,
            to: this.currentVibe.id,
            progress: this.transitionProgress,
            startFrame: this.transitionStartFrame,
            durationFrames: this.transitionDurationFrames,
        };
    }
    // ═══════════════════════════════════════════════════════════════
    // 🏛️ WAVE 144: COLOR CONSTITUTION API
    // ═══════════════════════════════════════════════════════════════
    /**
     * 🏛️ WAVE 144: GET COLOR CONSTITUTION
     *
     * Obtiene las GenerationOptions (Constitución Cromática) del Vibe activo.
     * Usado por SeleneLux para pasar restricciones al SeleneColorEngine.
     *
     * @returns GenerationOptions con las restricciones cromáticas del Vibe activo
     *
     * @example
     * ```typescript
     * const vibeManager = VibeManager.getInstance();
     * const constitution = vibeManager.getColorConstitution();
     * const palette = SeleneColorEngine.generate(audioData, constitution);
     * ```
     */
    getColorConstitution() {
        return getConstitution(this.currentVibe.id);
    }
    // ═══════════════════════════════════════════════════════════════
    // CONSTRAINT METHODS - For Arbiters
    // ═══════════════════════════════════════════════════════════════
    /**
     * 🎭 VALIDATE MOOD
     *
     * Verifica si un mood está permitido en el vibe actual.
     *
     * @param mood - Mood a validar
     * @returns true si está permitido, false si está prohibido
     */
    validateMood(mood) {
        const profile = this.getEffectiveProfile();
        return profile.mood.allowed.includes(mood);
    }
    /**
     * 🎭 GET MOOD VALIDATION (Detailed)
     *
     * Versión detallada que incluye sugerencia de alternativa.
     */
    getMoodValidation(mood) {
        const profile = this.getEffectiveProfile();
        const isValid = profile.mood.allowed.includes(mood);
        let suggestedAlternative;
        if (!isValid) {
            suggestedAlternative = this.findClosestMood(mood, profile.mood.allowed);
        }
        return {
            isValid,
            requestedMood: mood,
            allowedMoods: profile.mood.allowed,
            suggestedAlternative,
        };
    }
    /**
     * 🎭 CONSTRAIN MOOD
     *
     * Si el mood está permitido, lo devuelve.
     * Si no, devuelve el mood más cercano permitido o el fallback.
     */
    constrainMood(mood) {
        const profile = this.getEffectiveProfile();
        if (profile.mood.allowed.includes(mood)) {
            return mood;
        }
        // Buscar el más cercano permitido
        const closest = this.findClosestMood(mood, profile.mood.allowed);
        return closest ?? profile.mood.fallback;
    }
    /**
     * 🎨 CONSTRAIN COLOR
     *
     * Auto-corrige parámetros de color para que estén dentro del rango permitido.
     * NO devuelve error - CORRIGE el valor.
     */
    constrainColor(params) {
        const profile = this.getEffectiveProfile();
        const colorConstraints = profile.color;
        // Track what was constrained
        let temperatureClamped = false;
        let saturationClamped = false;
        let strategyChanged = false;
        // Clamp temperature to allowed range
        let temperature = params.temperature;
        if (temperature < colorConstraints.temperature.min) {
            temperature = colorConstraints.temperature.min;
            temperatureClamped = true;
        }
        else if (temperature > colorConstraints.temperature.max) {
            temperature = colorConstraints.temperature.max;
            temperatureClamped = true;
        }
        // Clamp saturation to allowed range
        let saturation = params.saturation;
        if (saturation < colorConstraints.saturation.min) {
            saturation = colorConstraints.saturation.min;
            saturationClamped = true;
        }
        else if (saturation > colorConstraints.saturation.max) {
            saturation = colorConstraints.saturation.max;
            saturationClamped = true;
        }
        // Constrain strategy
        let strategy = params.strategy ?? colorConstraints.strategies[0];
        if (!colorConstraints.strategies.includes(strategy)) {
            strategy = colorConstraints.strategies[0];
            strategyChanged = true;
        }
        const wasConstrained = temperatureClamped || saturationClamped || strategyChanged;
        return {
            temperature,
            saturation,
            strategy,
            wasConstrained,
            constraintDetails: wasConstrained ? {
                temperatureClamped,
                saturationClamped,
                strategyChanged,
            } : undefined,
        };
    }
    /**
     * 🌡️ CONSTRAIN TEMPERATURE (Convenience method)
     */
    constrainTemperature(rawKelvin) {
        const profile = this.getEffectiveProfile();
        return Math.max(profile.color.temperature.min, Math.min(profile.color.temperature.max, rawKelvin));
    }
    /**
     * 🎚️ CONSTRAIN SATURATION (Convenience method)
     */
    constrainSaturation(rawSaturation) {
        const profile = this.getEffectiveProfile();
        return Math.max(profile.color.saturation.min, Math.min(profile.color.saturation.max, rawSaturation));
    }
    /**
     * 💡 GET DIMMER FLOOR
     *
     * Devuelve el suelo mínimo de dimmer permitido.
     * Durante transición, interpola entre los valores.
     */
    getDimmerFloor() {
        if (!this.isTransitioning() || !this.previousVibe) {
            return this.currentVibe.dimmer.floor;
        }
        // Durante transición: usar el MÁS ALTO para evitar blackouts accidentales
        const fromFloor = this.previousVibe.dimmer.floor;
        const toFloor = this.currentVibe.dimmer.floor;
        // Safe transition: max de ambos hasta 70% de progreso
        if (this.transitionProgress < 0.7) {
            return Math.max(fromFloor, toFloor);
        }
        // Último 30%: interpolar hacia target
        const localProgress = (this.transitionProgress - 0.7) / 0.3;
        return this.interpolate(Math.max(fromFloor, toFloor), toFloor, localProgress);
    }
    /**
     * 💡 GET DIMMER CEILING
     */
    getDimmerCeiling() {
        return this.getEffectiveProfile().dimmer.ceiling;
    }
    /**
     * 💡 CONSTRAIN DIMMER
     *
     * Aplica floor, ceiling y blackout rules.
     */
    constrainDimmer(rawDimmer) {
        const profile = this.getEffectiveProfile();
        const floor = this.getDimmerFloor();
        const ceiling = profile.dimmer.ceiling;
        // Blackout check - si piden ~0 y está permitido, devolver 0
        if (rawDimmer < 0.01) {
            return profile.dimmer.allowBlackout ? 0 : floor;
        }
        return Math.max(floor, Math.min(ceiling, rawDimmer));
    }
    /**
     * 💡 IS BLACKOUT ALLOWED
     */
    isBlackoutAllowed() {
        return this.getEffectiveProfile().dimmer.allowBlackout;
    }
    // ═══════════════════════════════════════════════════════════════
    // WAVE 60: META-EMOTION INTEGRATION (For MoodArbiter)
    // ═══════════════════════════════════════════════════════════════
    /**
     * 🎭 CONSTRAIN META-EMOTION
     *
     * Adapta MetaEmotion (BRIGHT/DARK/NEUTRAL) del MoodArbiter
     * a los moods permitidos por el Vibe actual.
     *
     * Mapeo:
     * - BRIGHT → [festive, euphoric, playful, energetic]
     * - DARK → [dark, dramatic, tense, aggressive]
     * - NEUTRAL → [calm, peaceful, dreamy]
     *
     * @returns MetaEmotion constrained (o el mismo si está permitido)
     */
    constrainMetaEmotion(metaEmotion) {
        const profile = this.getEffectiveProfile();
        const allowed = profile.mood.allowed;
        // Map MetaEmotion to MoodTypes
        const metaToMoods = {
            'BRIGHT': ['festive', 'euphoric', 'playful', 'energetic'],
            'DARK': ['dark', 'dramatic', 'tense', 'aggressive'],
            'NEUTRAL': ['calm', 'peaceful', 'dreamy'],
        };
        // Check if ANY mood from this meta-emotion is allowed
        const candidateMoods = metaToMoods[metaEmotion];
        const hasAllowedMood = candidateMoods.some(m => allowed.includes(m));
        if (hasAllowedMood) {
            return metaEmotion;
        }
        // Find the best alternative MetaEmotion
        // Priority: NEUTRAL → BRIGHT → DARK (or based on fallback)
        const fallback = profile.mood.fallback;
        if (metaToMoods['NEUTRAL'].includes(fallback))
            return 'NEUTRAL';
        if (metaToMoods['BRIGHT'].includes(fallback))
            return 'BRIGHT';
        if (metaToMoods['DARK'].includes(fallback))
            return 'DARK';
        // Ultimate fallback based on what's allowed
        for (const [meta, moods] of Object.entries(metaToMoods)) {
            if (moods.some(m => allowed.includes(m))) {
                return meta;
            }
        }
        return 'NEUTRAL'; // Absolute fallback
    }
    /**
     * 🎨 CONSTRAIN STRATEGY
     *
     * Verifica si una estrategia de color está permitida.
     * Si no, devuelve la primera permitida.
     */
    constrainStrategy(strategy) {
        const profile = this.getEffectiveProfile();
        if (profile.color.strategies.includes(strategy)) {
            return strategy;
        }
        return profile.color.strategies[0];
    }
    /**
     * ⚡ IS DROP ALLOWED
     *
     * Verifica si un drop está permitido dado el estado actual.
     */
    isDropAllowed(currentEnergy, smoothedEnergy, framesSinceLastDrop) {
        const profile = this.getEffectiveProfile();
        const dropConstraints = profile.drop;
        // Cooldown check
        if (framesSinceLastDrop < dropConstraints.timing.cooldownFrames) {
            return false;
        }
        // Energy threshold check
        const energyDelta = currentEnergy - smoothedEnergy;
        const effectiveThreshold = dropConstraints.energyThreshold * dropConstraints.sensitivity;
        if (energyDelta < effectiveThreshold) {
            return false;
        }
        return true;
    }
    /**
     * ⚡ GET DROP CONSTRAINTS
     */
    getDropConstraints() {
        return this.getEffectiveProfile().drop;
    }
    /**
     * ✨ IS EFFECT ALLOWED
     */
    isEffectAllowed(effect) {
        const profile = this.getEffectiveProfile();
        return profile.effects.allowed.includes(effect);
    }
    /**
     * ⚡ GET MAX STROBE RATE
     */
    getMaxStrobeRate() {
        return this.getEffectiveProfile().effects.maxStrobeRate;
    }
    // ═══════════════════════════════════════════════════════════════
    // DEBUG / OBSERVABILITY
    // ═══════════════════════════════════════════════════════════════
    /**
     * Obtiene información de debug para visualización.
     */
    getDebugInfo() {
        const profile = this.currentVibe;
        return {
            activeVibe: profile.id,
            previousVibe: this.previousVibe?.id ?? null,
            transitionProgress: this.transitionProgress,
            isTransitioning: this.isTransitioning(),
            constraints: {
                allowedMoods: profile.mood.allowed,
                dimmerFloor: this.getDimmerFloor(),
                dimmerCeiling: profile.dimmer.ceiling,
                temperatureRange: profile.color.temperature,
                dropSensitivity: profile.drop.sensitivity,
            },
        };
    }
    // ═══════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════
    /**
     * Obtiene el perfil efectivo (durante transición usa el actual).
     */
    getEffectiveProfile() {
        // Durante transición, siempre usamos el target para restricciones
        // Esto asegura que los valores ya estén dentro del nuevo bounded context
        return this.currentVibe;
    }
    /**
     * Encuentra el mood más cercano de un array permitido.
     */
    findClosestMood(target, allowed) {
        const proxies = MOOD_PROXIMITY[target] || [];
        for (const proxy of proxies) {
            if (allowed.includes(proxy)) {
                return proxy;
            }
        }
        return undefined;
    }
    /**
     * Interpolación lineal con easing.
     */
    interpolate(from, to, t) {
        // Ease-in-out
        const eased = t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
        return from + (to - from) * eased;
    }
}
// Singleton instance
VibeManager.instance = null;
// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORT
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Acceso rápido al singleton.
 */
export const vibeManager = () => VibeManager.getInstance();
