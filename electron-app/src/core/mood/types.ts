/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎭 MOOD TYPES - WAVE 700.1
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * THE MOOD SWITCH - 3 posiciones, 0 bullshit.
 * 
 * NO ES MACHINE LEARNING.
 * NO ES FUZZY LOGIC.
 * ES UN PUTO SWITCH CON 3 POSICIONES.
 * 
 * @author PunkOpus
 * @wave 700.1
 */

// ═══════════════════════════════════════════════════════════════════════════
// MOOD ID - Las 3 posiciones del switch
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 Identificadores de los 3 modos
 * 
 * - calm: "Tráeme un drop de nivel DIOS o me lo guardo"
 * - balanced: "Disparo cuando la música lo pide"
 * - punk: "¿Ha estornudado el DJ? ¡SOLAR FLARE!"
 */
export type MoodId = 'calm' | 'balanced' | 'punk';

// ═══════════════════════════════════════════════════════════════════════════
// MOOD PROFILE - La configuración de cada modo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎭 MOOD PROFILE
 * Define cómo cada modo modifica el comportamiento del sistema
 */
export interface MoodProfile {
  /** Identificador del modo */
  name: MoodId;
  
  /** Descripción para humanos */
  description: string;
  
  /** Emoji representativo */
  emoji: string;
  
  // ═══════════════════════════════════════════════════════════════════════
  // THRESHOLD MULTIPLIERS - El corazón del sistema
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Multiplica el UMBRAL de disparo
   * 
   * Fórmula: effectiveScore = rawScore / thresholdMultiplier
   * 
   * > 1.0 = más difícil disparar (necesitas score más alto)
   * < 1.0 = más fácil disparar (scores bajos ya disparan)
   * 
   * @example
   * CALM (1.5):     0.75 / 1.5 = 0.50 → NO DISPARA (trigger 0.7)
   * BALANCED (1.0): 0.75 / 1.0 = 0.75 → DISPARA ✓
   * PUNK (0.6):     0.75 / 0.6 = 1.25 → DISPARA CON GANAS ✓
   */
  thresholdMultiplier: number;
  
  /**
   * Multiplica los COOLDOWNS de efectos
   * 
   * > 1.0 = espera más entre efectos
   * < 1.0 = repite efectos más rápido
   * 
   * @example
   * CALM (2.0):     25000ms * 2.0 = 50000ms (50 seg entre flares)
   * BALANCED (1.0): 25000ms * 1.0 = 25000ms (25 seg - normal)
   * PUNK (0.3):     25000ms * 0.3 = 7500ms  (7.5 seg - CAOS)
   */
  cooldownMultiplier: number;
  
  /**
   * 🧬 WAVE 973: Umbral ético para DNA cooldown override
   * 
   * Cuando DNA Brain decide con ethics score > ethicsThreshold,
   * puede IGNORAR cooldowns y ejecutar su decisión inmediatamente.
   * 
   * Cada mood define su tolerancia a "romper las reglas del cooldown":
   * - CALM (0.98):  Solo si la idea es SUBLIME (9.8/10)
   * - BALANCED (0.90): Si es excelente (9/10)
   * - PUNK (0.75): Si mola un poco (7.5/10) → ¡A LA MIERDA!
   * - EUPHORIC (0.85): Si es bueno (8.5/10)
   * 
   * @example
   * CALM: DNA ethics=0.97 < 0.98 → respeta cooldown
   * CALM: DNA ethics=0.99 > 0.98 → IGNORA cooldown (sublime)
   * 
   * PUNK: DNA ethics=0.78 > 0.75 → IGNORA cooldown (mola)
   * PUNK: DNA ethics=0.50 < 0.75 → respeta cooldown
   */
  ethicsThreshold: number;
  
  // ═══════════════════════════════════════════════════════════════════════
  // INTENSITY LIMITS - Techo y suelo de intensidad
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Intensidad máxima permitida (0-1)
   * 
   * CALM: 0.6 (max 60%)
   * BALANCED: 1.0 (sin límite)
   * PUNK: 1.0 (sin límite superior)
   */
  maxIntensity: number;
  
  /** 
   * Intensidad mínima forzada (0-1)
   * Solo PUNK tiene esto - garantiza que siempre haya PUNCH
   * 
   * undefined = sin mínimo forzado
   */
  minIntensity?: number;
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT RESTRICTIONS - Bloqueos y desbloqueos
  // ═══════════════════════════════════════════════════════════════════════
  
  /** 
   * Efectos PROHIBIDOS en este modo
   * 
   * CALM bloquea strobes agresivos
   * BALANCED no bloquea nada
   * PUNK no bloquea nada
   */
  blockList: string[];
  
  /** 
   * Efectos SIEMPRE disponibles (ignora cooldown)
   * Solo PUNK tiene esto - CAOS TOTAL
   * 
   * undefined = cooldowns normales aplican
   */
  forceUnlock?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MOOD EVENT - Para notificaciones de cambio de mood
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evento emitido cuando cambia el mood
 */
export interface MoodChangeEvent {
  previousMood: MoodId;
  newMood: MoodId;
  timestamp: number;
}

/**
 * Callback para listeners de cambio de mood
 */
export type MoodChangeListener = (event: MoodChangeEvent) => void;
