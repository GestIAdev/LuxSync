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

import type {
  VibeId,
  VibeProfile,
  MoodType,
  ColorStrategy,
  ColorParams,
  ConstrainedColorParams,
  MoodValidation,
  VibeTransitionState,
  VibeDebugInfo,
} from '../../types/VibeProfile';

import type { GenerationOptions } from '../color/SeleneColorEngine';

import {
  VIBE_REGISTRY,
  DEFAULT_VIBE,
  getVibePreset,
  isValidVibeId,
  normalizeVibeId,
} from './profiles/index';

import { getColorConstitution as getConstitution } from '../color/colorConstitutions';

// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROXIMITY MAP
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapa de proximidad conceptual entre moods.
 * Usado para sugerir alternativas cuando un mood está prohibido.
 */
const MOOD_PROXIMITY: Record<MoodType, MoodType[]> = {
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
  // Singleton instance
  private static instance: VibeManager | null = null;

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  private currentVibe: VibeProfile;
  private previousVibe: VibeProfile | null = null;
  private transitionProgress: number = 1.0;  // 1.0 = fully transitioned
  private transitionDurationFrames: number = 180;  // 3 seconds @ 60fps
  private transitionStartFrame: number = 0;
  private currentFrame: number = 0;

  // ═══════════════════════════════════════════════════════════════
  // CONSTRUCTOR (Private for Singleton)
  // ═══════════════════════════════════════════════════════════════

  private constructor() {
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
  public static getInstance(): VibeManager {
    if (!VibeManager.instance) {
      VibeManager.instance = new VibeManager();
    }
    return VibeManager.instance;
  }

  /**
   * Resetea la instancia (útil para tests).
   */
  public static resetInstance(): void {
    VibeManager.instance = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API - VIBE SWITCHING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Cambia el Vibe activo con transición suave.
   * 
   * @param vibeId - ID del vibe a activar (supports legacy aliases)
   * @param frameCount - Frame actual (opcional, usa interno si no se provee)
   * @returns true si el cambio fue iniciado, false si el vibe no existe o ya está activo
   */
  public setActiveVibe(vibeId: VibeId | string, frameCount?: number): boolean {
    // 🔄 WAVE 2019.10: Normalize ID (handles legacy aliases like 'techno' → 'techno-club')
    const normalizedId = normalizeVibeId(vibeId)
    if (!normalizedId) {
      // 🚨 WAVE 2040.3: EL CHIVATO - Enhanced 404 warning
      console.warn(
        `[VibeManager] ⚠️ ERROR 404: Vibe '${vibeId}' no existe en registry.\n` +
        `   ├─ IDs válidos: fiesta-latina, techno-club, chill-lounge, pop-rock, idle\n` +
        `   ├─ Aliases legacy: techno → techno-club, chill → chill-lounge, rock → pop-rock\n` +
        `   └─ Manteniendo el Vibe actual: '${this.currentVibe.id}'`
      );
      return false;
    }

    const newVibe = getVibePreset(normalizedId);
    if (!newVibe) {
      // 🚨 WAVE 2040.3: Secondary check (should never happen if normalizeVibeId passed)
      console.warn(
        `[VibeManager] ⚠️ ERROR 500: Vibe '${normalizedId}' pasó normalización pero no existe en VIBE_REGISTRY.\n` +
        `   └─ Esto es un bug interno. Manteniendo el Vibe actual: '${this.currentVibe.id}'`
      );
      return false;
    }

    // No hacer nada si ya es el vibe activo
    if (newVibe.id === this.currentVibe.id) {
      // 🐛 WAVE 69.1: Log para debug - no es un error, solo idempotencia
      console.log(`[VibeManager] Vibe already active: '${normalizedId}' (no transition needed)`);
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
  public setActiveVibeImmediate(vibeId: VibeId | string): boolean {
    // 🔄 WAVE 2019.10: Normalize ID
    const normalizedId = normalizeVibeId(vibeId)
    if (!normalizedId) {
      return false;
    }

    const newVibe = getVibePreset(normalizedId);
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
  public updateTransition(frameCount: number): void {
    this.currentFrame = frameCount;

    if (this.transitionProgress >= 1.0) {
      return;
    }

    const elapsed = frameCount - this.transitionStartFrame;
    this.transitionProgress = Math.min(1.0, elapsed / this.transitionDurationFrames);

    if (this.transitionProgress >= 1.0) {
      this.previousVibe = null;  // Cleanup
      console.log(`[VibeManager] Transition complete: ${this.currentVibe.id}`);
    }
  }

  /**
   * Obtiene el Vibe actualmente activo.
   */
  public getActiveVibe(): VibeProfile {
    return this.currentVibe;
  }

  /**
   * Verifica si hay una transición en curso.
   */
  public isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }

  /**
   * Obtiene el estado actual de la transición.
   */
  public getTransitionState(): VibeTransitionState {
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
  public getColorConstitution(): GenerationOptions {
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
  public validateMood(mood: MoodType): boolean {
    const profile = this.getEffectiveProfile();
    return profile.mood.allowed.includes(mood);
  }

  /**
   * 🎭 GET MOOD VALIDATION (Detailed)
   * 
   * Versión detallada que incluye sugerencia de alternativa.
   */
  public getMoodValidation(mood: MoodType): MoodValidation {
    const profile = this.getEffectiveProfile();
    const isValid = profile.mood.allowed.includes(mood);

    let suggestedAlternative: MoodType | undefined;
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
  public constrainMood(mood: MoodType): MoodType {
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
  public constrainColor(params: ColorParams): ConstrainedColorParams {
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
    } else if (temperature > colorConstraints.temperature.max) {
      temperature = colorConstraints.temperature.max;
      temperatureClamped = true;
    }

    // Clamp saturation to allowed range
    let saturation = params.saturation;
    if (saturation < colorConstraints.saturation.min) {
      saturation = colorConstraints.saturation.min;
      saturationClamped = true;
    } else if (saturation > colorConstraints.saturation.max) {
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
  public constrainTemperature(rawKelvin: number): number {
    const profile = this.getEffectiveProfile();
    return Math.max(
      profile.color.temperature.min,
      Math.min(profile.color.temperature.max, rawKelvin)
    );
  }

  /**
   * 🎚️ CONSTRAIN SATURATION (Convenience method)
   */
  public constrainSaturation(rawSaturation: number): number {
    const profile = this.getEffectiveProfile();
    return Math.max(
      profile.color.saturation.min,
      Math.min(profile.color.saturation.max, rawSaturation)
    );
  }

  /**
   * 💡 GET DIMMER FLOOR
   * 
   * Devuelve el suelo mínimo de dimmer permitido.
   * Durante transición, interpola entre los valores.
   */
  public getDimmerFloor(): number {
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
  public getDimmerCeiling(): number {
    return this.getEffectiveProfile().dimmer.ceiling;
  }

  /**
   * 💡 CONSTRAIN DIMMER
   * 
   * Aplica floor, ceiling y blackout rules.
   */
  public constrainDimmer(rawDimmer: number): number {
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
  public isBlackoutAllowed(): boolean {
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
  public constrainMetaEmotion(metaEmotion: 'BRIGHT' | 'DARK' | 'NEUTRAL'): 'BRIGHT' | 'DARK' | 'NEUTRAL' {
    const profile = this.getEffectiveProfile();
    const allowed = profile.mood.allowed;

    // Map MetaEmotion to MoodTypes
    const metaToMoods: Record<'BRIGHT' | 'DARK' | 'NEUTRAL', MoodType[]> = {
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
    if (metaToMoods['NEUTRAL'].includes(fallback)) return 'NEUTRAL';
    if (metaToMoods['BRIGHT'].includes(fallback)) return 'BRIGHT';
    if (metaToMoods['DARK'].includes(fallback)) return 'DARK';

    // Ultimate fallback based on what's allowed
    for (const [meta, moods] of Object.entries(metaToMoods)) {
      if (moods.some(m => allowed.includes(m))) {
        return meta as 'BRIGHT' | 'DARK' | 'NEUTRAL';
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
  public constrainStrategy(strategy: ColorStrategy): ColorStrategy {
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
  public isDropAllowed(
    currentEnergy: number,
    smoothedEnergy: number,
    framesSinceLastDrop: number
  ): boolean {
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
  public getDropConstraints() {
    return this.getEffectiveProfile().drop;
  }

  /**
   * ✨ IS EFFECT ALLOWED
   */
  public isEffectAllowed(effect: string): boolean {
    const profile = this.getEffectiveProfile();
    return profile.effects.allowed.includes(effect as any);
  }

  /**
   * ⚡ GET MAX STROBE RATE
   */
  public getMaxStrobeRate(): number {
    return this.getEffectiveProfile().effects.maxStrobeRate;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEBUG / OBSERVABILITY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Obtiene información de debug para visualización.
   */
  public getDebugInfo(): VibeDebugInfo {
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
  private getEffectiveProfile(): VibeProfile {
    // Durante transición, siempre usamos el target para restricciones
    // Esto asegura que los valores ya estén dentro del nuevo bounded context
    return this.currentVibe;
  }

  /**
   * Encuentra el mood más cercano de un array permitido.
   */
  private findClosestMood(target: MoodType, allowed: MoodType[]): MoodType | undefined {
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
  private interpolate(from: number, to: number, t: number): number {
    // Ease-in-out
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return from + (to - from) * eased;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Acceso rápido al singleton.
 */
export const vibeManager = (): VibeManager => VibeManager.getInstance();
