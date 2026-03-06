/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MOOD CONTROLLER - THE SWITCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 700.1 - El corazón del sistema de mood.
 *
 * "El Modo CALM entra como un caballero: eleva el listón."
 * "El Modo PUNK baja la valla: ¿Ha estornudado el DJ? ¡SOLAR FLARE!"
 *
 * NO ES MACHINE LEARNING.
 * NO ES FUZZY LOGIC.
 * ES UN PUTO SWITCH CON 3 POSICIONES.
 *
 * @author PunkOpus
 * @wave 700.1
 */
// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROFILES - Configuración de los 3 modos
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎭 MOOD PROFILES
 * La configuración inmutable de cada modo
 */
export const MOOD_PROFILES = {
    // ═══════════════════════════════════════════════════════════════════════
    // 😌 CALM - "Cubata en mano, salsa, reggaetón tranquilo"
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 700.5.2 - Consenso del Cónclave: "Menos es más cuando lo que tienes es BUENO"
    // 🔥 WAVE 1010.8: CALM = CALMADO DE VERDAD
    // 🍹 WAVE 1182: CALM = Efectos suaves permitidos, strobes prohibidos
    // 🧘 WAVE 1182.2: CALM REALISTA - Threshold/cooldown permiten efectos suaves
    // FILOSOFÍA: threshold x2.5 + cooldown x4 = ~1-2 EPM con efectos suaves
    //            Strobes y agresivos bloqueados por blockList
    //            maxIntensity 0.6 = todo suave y tranquilo
    // Target EPM: 1-2 (momentos significativos con efectos suaves, no agresivos)
    calm: {
        name: 'calm',
        description: 'Zen mode. Efectos suaves, nada agresivo. 🍹',
        emoji: '😌',
        thresholdMultiplier: 2.5, // 🧘 WAVE 1182.2: Filtro fuerte pero no imposible (era 99.0)
        cooldownMultiplier: 4.0, // 🧘 WAVE 1182.2: Cooldowns x4 (era 10.0)
        ethicsThreshold: 0.95, // 🧘 WAVE 1182.2: Solo LEGENDARY bypassea (era 99.0)
        maxIntensity: 0.6, // 🧘 WAVE 1182.2: Max 60% - todo suave (era 0.7)
        minIntensity: undefined, // Sin mínimo
        blockList: [
            // 🚨 STROBES - Todo lo que parpadea rápido
            'strobe_storm',
            'strobe_burst',
            'industrial_strobe',
            'ambient_strobe', // Strobes suaves también prohibidos
            // 🔥 RAIDS & AGRESIVOS - Gatling, machetes, ataques
            'gatling_raid',
            'machete_spark',
            // 💥 MELTDOWNS - Caos nuclear
            'latina_meltdown',
            'core_meltdown',
            // 🎪 GLITCHES - Efectos caóticos
            'glitch_guaguanco',
            // ⚡ OTROS AGRESIVOS
            'solar_flare', // Flares muy intensos
            'seismic_snap', // Snap muy agresivo
        ],
        forceUnlock: undefined, // Cooldowns normales
    },
    // ═══════════════════════════════════════════════════════════════════════
    // ⚖️ BALANCED - "Fiesta normal, el DJ está sobrio"
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 937: BALANCED = PROFESIONAL → Solo momentos BUENOS, no "apenas dignos"
    // 🔥 WAVE 998: THE RESPECT PROTOCOL - Un pelín más de filtro y aire
    // 🎯 WAVE 1176: OPERATION SNIPER - Balanced más estricto, francotirador
    // 🎧 WAVE 1182: ETHICS RECALIBRATION - Solo épicos (1.13+) bypassean cooldown
    // 🩸 WAVE 2095.2: RECALIBRADO PARA BREJCHA — 1.35 era demasiado estricto.
    //   Raw worthiness de Brejcha vive en 0.65-0.85. Con 1.35x, 0.65/1.35=0.481 → BLOCKED.
    //   Solo raw>0.75 pasaba. Resultado: 1 efecto en 400+ frames (casi nada).
    //   1.20x: 0.65/1.20=0.542(borderline) | 0.70/1.20=0.583✅ | 0.75/1.20=0.625✅
    //   Objetivo: 4-6 EPM. Francotirador, no estatua.
    balanced: {
        name: 'balanced',
        description: 'El profesional. El DJ está sobrio. 🎧',
        emoji: '⚖️',
        thresholdMultiplier: 1.20, // 🩸 WAVE 2095.2: 1.35→1.20 (Brejcha raw 0.65-0.85 necesita más aire)
        cooldownMultiplier: 1.8, // 🎯 WAVE 1176: Cooldowns x1.8
        ethicsThreshold: 1.20, // 🩸 WAVE 2104.2: 1.12→1.20. Con 1.12, ethics=1.134 pasaba con margen de 0.014 = GRATIS. El override debe ser ÉPICO, no rutinario.
        maxIntensity: 1.0, // Sin límite
        minIntensity: undefined, // Los pads tienen su propio dimmer mínimo
        blockList: [], // Nada bloqueado
        forceUnlock: undefined, // Cooldowns normales
    },
    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 PUNK - "El DJ se ha drogado y quiere fiesta"
    // ═══════════════════════════════════════════════════════════════════════
    // WAVE 700.5.2 - Consenso del Cónclave: Caos controlado, no epilepsia
    // 💊 WAVE 1182: Mantenemos valores - 15 EPM ya es MUCHA fiesta
    // Target EPM: 8-15 (1 efecto cada 4-8 segundos)
    punk: {
        name: 'punk',
        description: 'El DJ se ha drogado. Cualquier excusa es buena. 💊🔥',
        emoji: '🔥',
        thresholdMultiplier: 0.8, // 20% más fácil
        cooldownMultiplier: 0.7, // Cooldowns x0.7
        ethicsThreshold: 0.75, // 🧬 WAVE 973: "Si mola (7.5/10), ¡A LA MIERDA EL COOLDOWN!"
        maxIntensity: 1.0, // Sin límite
        minIntensity: 0.5, // MÍNIMO 50% intensidad siempre
        blockList: [], // Nada bloqueado
        forceUnlock: [
            'strobe_burst', // Strobes SIEMPRE disponibles
            'solar_flare', // Flares ignoran cooldown
        ],
    },
};
// ═══════════════════════════════════════════════════════════════════════════
// MOOD CONTROLLER - Singleton
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🎭 MOOD CONTROLLER
 * The Switch - Un singleton que controla EL HUMOR de Selene
 *
 * Singleton pattern porque solo puede haber UN mood activo en todo el sistema.
 */
export class MoodController {
    // ═══════════════════════════════════════════════════════════════════════
    // SINGLETON
    // ═══════════════════════════════════════════════════════════════════════
    constructor() {
        /** Mood actual - default BALANCED (el profesional) */
        this.currentMood = 'balanced';
        /** Listeners para cambios de mood */
        this.listeners = new Set();
        /** Timestamp del último cambio */
        this.lastChangeTimestamp = Date.now();
        // WAVE 2098: Boot silence
    }
    /**
     * Obtener la instancia única del MoodController
     */
    static getInstance() {
        if (!MoodController.instance) {
            MoodController.instance = new MoodController();
        }
        return MoodController.instance;
    }
    /**
     * Reset para testing (NO usar en producción)
     */
    static resetInstance() {
        MoodController.instance = null;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtener el mood actual
     */
    getCurrentMood() {
        return this.currentMood;
    }
    /**
     * Obtener el profile completo del mood actual
     */
    getCurrentProfile() {
        return MOOD_PROFILES[this.currentMood];
    }
    /**
     * Obtener un profile específico por ID
     */
    getProfile(moodId) {
        return MOOD_PROFILES[moodId];
    }
    /**
     * Obtener todos los profiles disponibles
     */
    getAllProfiles() {
        return Object.values(MOOD_PROFILES);
    }
    /**
     * Tiempo desde el último cambio de mood (ms)
     */
    getTimeSinceLastChange() {
        return Date.now() - this.lastChangeTimestamp;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // SETTER
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Cambiar el mood actual
     *
     * @param mood - El nuevo mood a establecer
     * @emits MoodChangeEvent a todos los listeners registrados
     */
    setMood(mood) {
        if (mood === this.currentMood) {
            return; // No-op si es el mismo mood
        }
        const previousMood = this.currentMood;
        this.currentMood = mood;
        this.lastChangeTimestamp = Date.now();
        const profile = this.getCurrentProfile();
        console.log(`[MoodController] 🎭 Mood changed: ${previousMood.toUpperCase()} → ${mood.toUpperCase()} ` +
            `${profile.emoji} "${profile.description}"`);
        // Notificar a los listeners
        const event = {
            previousMood,
            newMood: mood,
            timestamp: this.lastChangeTimestamp,
        };
        this.listeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                console.error('[MoodController] Error in listener:', error);
            }
        });
    }
    // ═══════════════════════════════════════════════════════════════════════
    // THRESHOLD MODIFIER - El corazón del sistema
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Aplica el modificador de umbral al score crudo
     *
     * Esta es LA función clave. Divide el score por el multiplicador:
     * - Mayor multiplicador = score efectivo MÁS BAJO = MÁS DIFÍCIL disparar
     * - Menor multiplicador = score efectivo MÁS ALTO = MÁS FÁCIL disparar
     *
     * @param rawScore - Score de 0-1+ del FuzzyDecisionMaker o HuntEngine
     * @returns Effective score (modificado por el mood)
     *
     * @example
     * // CALM mode (thresholdMultiplier = 1.5)
     * applyThreshold(0.75) // → 0.50 (NO dispara con trigger 0.7)
     *
     * // PUNK mode (thresholdMultiplier = 0.6)
     * applyThreshold(0.50) // → 0.83 (SÍ dispara con trigger 0.7)
     */
    applyThreshold(rawScore) {
        const profile = this.getCurrentProfile();
        return rawScore / profile.thresholdMultiplier;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // COOLDOWN MODIFIER
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Aplica el modificador de cooldown
     *
     * @param baseCooldown - Cooldown base en ms
     * @returns Cooldown modificado (redondeado a entero)
     *
     * @example
     * // CALM (cooldownMultiplier = 2.0)
     * applyCooldown(25000) // → 50000ms (50 seg)
     *
     * // PUNK (cooldownMultiplier = 0.3)
     * applyCooldown(25000) // → 7500ms (7.5 seg)
     */
    applyCooldown(baseCooldown) {
        const profile = this.getCurrentProfile();
        return Math.round(baseCooldown * profile.cooldownMultiplier);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // INTENSITY MODIFIER
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Aplica límites de intensidad según el mood
     *
     * @param baseIntensity - Intensidad base 0-1
     * @returns Intensidad clampeada por el mood
     *
     * @example
     * // CALM (max 0.6)
     * applyIntensity(0.9) // → 0.6
     *
     * // PUNK (min 0.5)
     * applyIntensity(0.3) // → 0.5 (fuerza mínimo)
     */
    applyIntensity(baseIntensity) {
        const profile = this.getCurrentProfile();
        let intensity = baseIntensity;
        // Aplicar máximo
        intensity = Math.min(intensity, profile.maxIntensity);
        // Aplicar mínimo (solo PUNK tiene esto)
        if (profile.minIntensity !== undefined) {
            intensity = Math.max(intensity, profile.minIntensity);
        }
        return intensity;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // EFFECT RESTRICTIONS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * ¿Está este efecto bloqueado en el mood actual?
     *
     * NOTA: Esto es ADICIONAL al Vibe Shield.
     * Si el Vibe Shield bloquea algo, el Mood NO puede desbloquearlo.
     * Pero el Mood SÍ puede bloquear cosas adicionales.
     *
     * @param effectId - ID del efecto a verificar
     * @returns true si el efecto está bloqueado por el mood actual
     */
    isEffectBlocked(effectId) {
        const profile = this.getCurrentProfile();
        return profile.blockList.includes(effectId);
    }
    /**
     * ¿Está este efecto desbloqueado forzosamente? (ignora cooldown)
     *
     * Solo PUNK tiene forceUnlock - permite disparar ciertos efectos
     * incluso si están en cooldown.
     *
     * @param effectId - ID del efecto a verificar
     * @returns true si el efecto ignora cooldown en el mood actual
     */
    isEffectForceUnlocked(effectId) {
        const profile = this.getCurrentProfile();
        return profile.forceUnlock?.includes(effectId) ?? false;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Registrar un listener para cambios de mood
     *
     * @param listener - Función a llamar cuando cambie el mood
     * @returns Función para desregistrar el listener
     */
    onMoodChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Suscribirse a cambios de mood (simplified callback)
     * Para uso en componentes React que solo necesitan el mood ID
     *
     * @param callback - Función a llamar con el nuevo MoodId
     * @returns Función para desuscribirse
     */
    subscribe(callback) {
        const listener = (event) => {
            callback(event.newMood);
        };
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Eliminar un listener específico
     */
    offMoodChange(listener) {
        this.listeners.delete(listener);
    }
    // ═══════════════════════════════════════════════════════════════════════
    // DEBUG / STATUS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtener el estado actual para debugging
     */
    getStatus() {
        return {
            currentMood: this.currentMood,
            profile: this.getCurrentProfile(),
            timeSinceLastChange: this.getTimeSinceLastChange(),
            listenerCount: this.listeners.size,
        };
    }
    /**
     * Log del estado actual (para debug)
     */
    logStatus() {
        const status = this.getStatus();
        console.log('[MoodController] 📊 Status:', {
            mood: `${status.profile.emoji} ${status.currentMood.toUpperCase()}`,
            thresholdMult: status.profile.thresholdMultiplier,
            cooldownMult: status.profile.cooldownMultiplier,
            maxIntensity: status.profile.maxIntensity,
            minIntensity: status.profile.minIntensity ?? 'none',
            blocked: status.profile.blockList.length > 0
                ? status.profile.blockList.join(', ')
                : 'none',
            forceUnlock: status.profile.forceUnlock?.join(', ') ?? 'none',
        });
    }
}
MoodController.instance = null;
