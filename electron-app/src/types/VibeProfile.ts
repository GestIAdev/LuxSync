/**
 * 🎛️ WAVE 59: VIBE PROFILE TYPE DEFINITIONS
 * 
 * Bounded Context System - Type Safety Layer
 * 
 * FILOSOFÍA: RESTRINGIR, NO FORZAR
 * Estos tipos definen el "espacio de decisiones" permitido para Selene.
 */

// ═══════════════════════════════════════════════════════════════════════════
// PRIMITIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identificadores únicos de Vibes disponibles
 * 🔌 WAVE 64: Añadido 'idle' como estado neutro de espera
 */
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';

/**
 * Estados emocionales que Selene puede expresar
 */
export type MoodType =
  | 'peaceful'   // Low energy, serene
  | 'calm'       // Low energy, stable
  | 'dreamy'     // Low energy, ethereal
  | 'playful'    // Medium energy, fun
  | 'festive'    // High energy, celebratory
  | 'euphoric'   // High energy, peak joy
  | 'dark'       // High energy, brooding
  | 'dramatic'   // High energy, theatrical
  | 'aggressive' // High energy, intense
  | 'energetic'  // High energy, neutral
  | 'tense';     // High energy, suspenseful

/**
 * Estrategias de armonía cromática
 */
export type ColorStrategy = 'analogous' | 'complementary' | 'triadic' | 'monochromatic' | 'split-complementary';

/**
 * Tipos de curvas de transición
 */
export type CurveType = 'instant' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'exponential';

/**
 * Patrones de movimiento para fixtures motorizados
 */
export type MovementPattern =
  | 'static'   // Sin movimiento
  | 'sweep'    // Barrido horizontal/vertical
  | 'circle'   // Círculos
  | 'figure8'  // Figura de 8
  | 'random'   // Aleatorio
  | 'mirror'   // Espejo simétrico
  | 'chase'    // Persecución secuencial
  | 'wave';    // Ondas

/**
 * Tipos de efectos especiales
 */
export type EffectType = 'strobe' | 'fog' | 'laser' | 'beam' | 'prism' | 'blinder';

/**
 * Velocidad de transición del dimmer
 */
export type DimmerTransitionSpeed = 'instant' | 'fast' | 'medium' | 'slow' | 'glacial';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRAINT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 MOOD CONSTRAINTS
 * 
 * Define qué estados emocionales están permitidos/prohibidos
 */
export interface VibeMoodConstraints {
  /** Moods explícitamente permitidos - Selene SOLO puede elegir de esta lista */
  allowed: MoodType[];
  
  /** Mood por defecto cuando el análisis no es confiable */
  fallback: MoodType;
  
  /** 
   * Peso del análisis de audio vs preset bias
   * 0.0 = ignora audio completamente
   * 1.0 = 100% basado en audio
   */
  audioInfluence: number;
}

/**
 * 🎨 COLOR CONSTRAINTS
 * 
 * Define el espacio cromático permitido
 */
export interface VibeColorConstraints {
  /** Estrategias de color permitidas */
  strategies: ColorStrategy[];
  
  /** 
   * Rango de temperatura de color (Kelvin conceptual)
   * 2000K = muy cálido (velas)
   * 6500K = luz día neutral
   * 10000K = muy frío (hielo)
   */
  temperature: {
    min: number;  // 2000-10000
    max: number;  // 2000-10000
  };
  
  /**
   * 🌡️ WAVE 149.6: THERMAL GRAVITY - Temperatura Atmosférica
   * 
   * Define el "clima" del Vibe. Los hues generados serán arrastrados
   * físicamente hacia el polo térmico correspondiente:
   * 
   * - > 7000K: Polo Frío (240° Azul Rey) - Techno, Chill
   * - < 5000K: Polo Cálido (40° Oro) - Latino, Rock
   * - 5000-7000K: Neutro (sin gravedad) - Idle
   * 
   * Cuanto más extrema la temperatura, más fuerte el arrastre.
   * Ejemplo: Techno (9500K) arrastra 80% hacia azul.
   */
  atmosphericTemp?: number;  // 2000-10000K, opcional para compatibilidad
  
  /** Rango de saturación permitido */
  saturation: {
    min: number;  // 0.0 - 1.0
    max: number;  // 0.0 - 1.0
  };
  
  /** Cambio máximo de hue por segundo (anti-epilepsia) */
  maxHueShiftPerSecond: number;  // degrees/second
  
  /** Paletas preferidas (hint, no restricción dura) */
  preferredPalettes?: string[];
}

/**
 * ⚡ DROP PHYSICS CONSTRAINTS
 * 
 * Define cómo se comportan los drops/climax
 */
export interface VibeDropConstraints {
  /** Sensibilidad de detección (0=nunca, 1=muy sensible) */
  sensitivity: number;
  
  /** Umbral de energía relativa para trigger */
  energyThreshold: number;
  
  /** Curvas de transición para cada fase */
  curves: {
    attack: CurveType;
    sustain: CurveType;
    release: CurveType;
  };
  
  /** Tiempos en frames (asumiendo 60fps) */
  timing: {
    minAttack: number;      // frames mínimos en attack
    maxSustain: number;     // frames máximos en sustain
    releaseFrames: number;  // frames de release
    cooldownFrames: number; // frames entre drops
  };
  
  /** ¿Permitir micro-drops? (drops <2s) */
  allowMicroDrops: boolean;
}

/**
 * 💡 DIMMER CONSTRAINTS
 * 
 * Define los límites de intensidad luminosa
 */
export interface VibeDimmerConstraints {
  /** Suelo mínimo de intensidad (blackout protection) */
  floor: number;  // 0.0 - 1.0
  
  /** Techo máximo de intensidad */
  ceiling: number;  // 0.0 - 1.0
  
  /** ¿Permitir blackout total? */
  allowBlackout: boolean;
  
  /** Velocidad de transición */
  transitionSpeed: DimmerTransitionSpeed;
  
  /** Curva de dimmer en breakdowns */
  breakdownCurve: CurveType;
}

/**
 * 🏃 MOVEMENT CONSTRAINTS
 * 
 * Define el comportamiento de fixtures motorizados
 */
export interface VibeMovementConstraints {
  /** Patrones de movimiento permitidos */
  allowedPatterns: MovementPattern[];
  
  /** Rango de velocidad */
  speedRange: {
    min: number;  // 0.0 - 1.0
    max: number;  // 0.0 - 1.0
  };
  
  /** ¿Permitir movimientos agresivos/rápidos? */
  allowAggressive: boolean;
  
  /** Sincronización preferida */
  preferredSync: 'beat' | 'phrase' | 'free';
}

/**
 * ✨ EFFECTS CONSTRAINTS
 * 
 * Define qué efectos especiales están permitidos
 */
export interface VibeEffectsConstraints {
  /** Efectos permitidos */
  allowed: EffectType[];
  
  /** Strobe: máxima frecuencia permitida (Hz) */
  maxStrobeRate: number;
  
  /** ¿Permitir fog automático? */
  autoFog: boolean;
  
  /** Intensidad máxima de efectos */
  maxIntensity: number;
}

/**
 * 🔧 META CONSTRAINTS
 * 
 * Configuración general del comportamiento
 */
export interface VibeMetaConstraints {
  /** Energía base del vibe (afecta todos los cálculos) */
  baseEnergy: number;
  
  /** Volatilidad permitida (cuánto puede variar frame a frame) */
  volatility: number;
  
  /** ¿Priorizar estabilidad sobre reactividad? */
  stabilityFirst: boolean;
  
  /** Override de BPM (para ignorar detección errónea) */
  bpmHint?: {
    min: number;
    max: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROFILE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎛️ VIBE PROFILE
 * 
 * La estructura completa que define un "Bounded Context" para Selene.
 * El DJ selecciona el Vibe, Selene opera DENTRO de sus restricciones.
 */
export interface VibeProfile {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  /** Identificador único */
  id: VibeId;
  
  /** Nombre para mostrar */
  name: string;
  
  /** Descripción del vibe */
  description: string;
  
  /** Emoji para UI */
  icon: string;
  
  // ═══════════════════════════════════════════════════════════════
  // CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  /** Restricciones de mood */
  mood: VibeMoodConstraints;
  
  /** Restricciones de color */
  color: VibeColorConstraints;
  
  /** Restricciones de drops */
  drop: VibeDropConstraints;
  
  /** Restricciones de dimmer */
  dimmer: VibeDimmerConstraints;
  
  /** Restricciones de movimiento */
  movement: VibeMovementConstraints;
  
  /** Restricciones de efectos */
  effects: VibeEffectsConstraints;
  
  /** Configuración meta */
  meta: VibeMetaConstraints;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER TYPES FOR VIBEMANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parámetros de color a validar/restringir
 */
export interface ColorParams {
  temperature: number;
  saturation: number;
  strategy?: ColorStrategy;
  hue?: number;
}

/**
 * Parámetros de color ajustados después de restricción
 */
export interface ConstrainedColorParams {
  temperature: number;
  saturation: number;
  strategy: ColorStrategy;
  wasConstrained: boolean;
  constraintDetails?: {
    temperatureClamped: boolean;
    saturationClamped: boolean;
    strategyChanged: boolean;
  };
}

/**
 * Resultado de validación de mood
 */
export interface MoodValidation {
  isValid: boolean;
  requestedMood: MoodType;
  allowedMoods: MoodType[];
  suggestedAlternative?: MoodType;
}

/**
 * Estado de transición entre Vibes
 */
export interface VibeTransitionState {
  isTransitioning: boolean;
  from: VibeId | null;
  to: VibeId;
  progress: number;  // 0.0 - 1.0
  startFrame: number;
  durationFrames: number;
}

/**
 * Debug info del VibeManager
 */
export interface VibeDebugInfo {
  activeVibe: VibeId;
  previousVibe: VibeId | null;
  transitionProgress: number;
  isTransitioning: boolean;
  constraints: {
    allowedMoods: MoodType[];
    dimmerFloor: number;
    dimmerCeiling: number;
    temperatureRange: { min: number; max: number };
    dropSensitivity: number;
  };
}
