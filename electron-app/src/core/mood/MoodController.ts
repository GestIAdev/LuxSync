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

import { MoodId, MoodProfile, MoodChangeEvent, MoodChangeListener } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROFILES - Configuración de los 3 modos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 MOOD PROFILES
 * La configuración inmutable de cada modo
 */
export const MOOD_PROFILES: Record<MoodId, MoodProfile> = {
  
  // ═══════════════════════════════════════════════════════════════════════
  // 😌 CALM - "Tráeme un drop de nivel DIOS o me lo guardo"
  // ═══════════════════════════════════════════════════════════════════════
  calm: {
    name: 'calm',
    description: 'Filtro de calidad. Solo dispara en momentos ÉPICOS.',
    emoji: '😌',
    thresholdMultiplier: 1.5,      // 50% más difícil disparar
    cooldownMultiplier: 2.0,       // Doble espera entre efectos
    maxIntensity: 0.6,             // Max 60% intensidad
    minIntensity: undefined,       // Sin mínimo
    blockList: [
      'strobe_storm',              // Strobes agresivos PROHIBIDOS
      'strobe_burst',              // Mini-strobes también
    ],
    forceUnlock: undefined,        // Cooldowns normales
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ⚖️ BALANCED - "Disparo cuando la música lo pide"
  // ═══════════════════════════════════════════════════════════════════════
  balanced: {
    name: 'balanced',
    description: 'El profesional. Dispara cuando la música lo pide.',
    emoji: '⚖️',
    thresholdMultiplier: 1.0,      // Sin modificación
    cooldownMultiplier: 1.0,       // Cooldowns normales
    maxIntensity: 1.0,             // Sin límite
    minIntensity: undefined,       // Sin mínimo
    blockList: [],                 // Nada bloqueado
    forceUnlock: undefined,        // Cooldowns normales
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 PUNK - "¿Ha estornudado el DJ? ¡SOLAR FLARE!"
  // ═══════════════════════════════════════════════════════════════════════
  punk: {
    name: 'punk',
    description: 'El anarquista. Cualquier excusa es buena para disparar.',
    emoji: '🔥',
    thresholdMultiplier: 0.6,      // 40% más fácil disparar
    cooldownMultiplier: 0.3,       // Cooldowns x0.3 (3x más rápido)
    maxIntensity: 1.0,             // Sin límite
    minIntensity: 0.5,             // MÍNIMO 50% intensidad siempre
    blockList: [],                 // Nada bloqueado
    forceUnlock: [
      'strobe_burst',              // Strobes SIEMPRE disponibles
      'solar_flare',               // Flares ignoran cooldown
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
  private static instance: MoodController | null = null;
  
  /** Mood actual - default BALANCED (el profesional) */
  private currentMood: MoodId = 'balanced';
  
  /** Listeners para cambios de mood */
  private listeners: Set<MoodChangeListener> = new Set();
  
  /** Timestamp del último cambio */
  private lastChangeTimestamp: number = Date.now();
  
  // ═══════════════════════════════════════════════════════════════════════
  // SINGLETON
  // ═══════════════════════════════════════════════════════════════════════
  
  private constructor() {
    console.log('[MoodController] 🎭 Initialized with BALANCED mode');
  }
  
  /**
   * Obtener la instancia única del MoodController
   */
  static getInstance(): MoodController {
    if (!MoodController.instance) {
      MoodController.instance = new MoodController();
    }
    return MoodController.instance;
  }
  
  /**
   * Reset para testing (NO usar en producción)
   */
  static resetInstance(): void {
    MoodController.instance = null;
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtener el mood actual
   */
  getCurrentMood(): MoodId {
    return this.currentMood;
  }
  
  /**
   * Obtener el profile completo del mood actual
   */
  getCurrentProfile(): MoodProfile {
    return MOOD_PROFILES[this.currentMood];
  }
  
  /**
   * Obtener un profile específico por ID
   */
  getProfile(moodId: MoodId): MoodProfile {
    return MOOD_PROFILES[moodId];
  }
  
  /**
   * Obtener todos los profiles disponibles
   */
  getAllProfiles(): MoodProfile[] {
    return Object.values(MOOD_PROFILES);
  }
  
  /**
   * Tiempo desde el último cambio de mood (ms)
   */
  getTimeSinceLastChange(): number {
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
  setMood(mood: MoodId): void {
    if (mood === this.currentMood) {
      return; // No-op si es el mismo mood
    }
    
    const previousMood = this.currentMood;
    this.currentMood = mood;
    this.lastChangeTimestamp = Date.now();
    
    const profile = this.getCurrentProfile();
    console.log(
      `[MoodController] 🎭 Mood changed: ${previousMood.toUpperCase()} → ${mood.toUpperCase()} ` +
      `${profile.emoji} "${profile.description}"`
    );
    
    // Notificar a los listeners
    const event: MoodChangeEvent = {
      previousMood,
      newMood: mood,
      timestamp: this.lastChangeTimestamp,
    };
    
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
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
  applyThreshold(rawScore: number): number {
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
  applyCooldown(baseCooldown: number): number {
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
  applyIntensity(baseIntensity: number): number {
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
  isEffectBlocked(effectId: string): boolean {
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
  isEffectForceUnlocked(effectId: string): boolean {
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
  onMoodChange(listener: MoodChangeListener): () => void {
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
  subscribe(callback: (mood: MoodId) => void): () => void {
    const listener: MoodChangeListener = (event) => {
      callback(event.newMood);
    };
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Eliminar un listener específico
   */
  offMoodChange(listener: MoodChangeListener): void {
    this.listeners.delete(listener);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DEBUG / STATUS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Obtener el estado actual para debugging
   */
  getStatus(): {
    currentMood: MoodId;
    profile: MoodProfile;
    timeSinceLastChange: number;
    listenerCount: number;
  } {
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
  logStatus(): void {
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
