/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧨 EFFECT TYPES - THE ARSENAL FOUNDATION
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 600: EFFECT ARSENAL
 * 
 * Tipos base para el sistema de efectos de iluminación.
 * Los efectos son acciones temporales que modifican el output de las luces
 * por encima de cualquier decisión de la consciencia o física.
 * 
 * FILOSOFÍA:
 * - Efectos son HTP (Highest Takes Precedence) para dimmer
 * - Tienen fases: TRIGGER → SUSTAIN → DECAY
 * - Se pueden apilar (múltiples efectos activos)
 * - Son deterministas (no random)
 * 
 * @module core/effects/types
 * @version WAVE 600
 */

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categoría del efecto - determina cómo se aplica
 */
export type EffectCategory = 
  | 'physical'   // Afecta dimmer/strobe (HTP - brilla por encima de todo)
  | 'color'      // Afecta color/saturación
  | 'movement'   // Afecta pan/tilt

/**
 * Fase actual del efecto
 */
export type EffectPhase = 
  | 'idle'       // No activo
  | 'attack'     // Subiendo (trigger)
  | 'sustain'    // Manteniendo pico
  | 'decay'      // Bajando
  | 'finished'   // Completado

/**
 * Zonas que puede afectar un efecto
 */
export type EffectZone = 
  | 'all'
  | 'front'
  | 'back'
  | 'movers'
  | 'pars'

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT OUTPUT - Lo que produce cada efecto por frame
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Output de un efecto para un frame específico
 * 
 * Todos los valores son modificadores o overrides:
 * - `dimmerOverride`: 0-1, si set, IGNORA el dimmer base (HTP)
 * - `colorOverride`: HSL, si set, REEMPLAZA el color
 * - `whiteOverride`: 0-1, para efectos con blanco puro
 */
export interface EffectFrameOutput {
  /** ID del efecto que genera este output */
  effectId: string
  
  /** Categoría del efecto */
  category: EffectCategory
  
  /** Fase actual */
  phase: EffectPhase
  
  /** Progreso dentro de la fase actual (0-1) */
  progress: number
  
  /** Override de dimmer (0-1). Si set, aplica HTP. */
  dimmerOverride?: number
  
  /** Override de blanco puro (0-1). Para efectos tipo flash/flare. */
  whiteOverride?: number
  
  /** Override de color en HSL */
  colorOverride?: { h: number; s: number; l: number }
  
  /** Override de strobe rate (Hz) */
  strobeRate?: number
  
  /** Zonas afectadas */
  zones: EffectZone[]
  
  /** Intensidad global del efecto (0-1) */
  intensity: number
  
  /**
   * 🧨 WAVE 630: GLOBAL OVERRIDE FLAG
   * Si true, el efecto bypasea TODA la lógica de zonas.
   * Todas las fixtures con dimmer reciben el override al 100%.
   */
  globalOverride?: boolean
  
  /**
   * 🧨 WAVE 630: AMBER OVERRIDE
   * Override del canal Amber (0-1) para fixtures RGBWA
   */
  amberOverride?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT CONFIG - Configuración para disparar un efecto
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧨 WAVE 680: MUSICAL CONTEXT - El alma que respira
 * 
 * Datos musicales en tiempo real inyectados en cada efecto.
 * Los efectos "respiran" con estos datos.
 */
export interface MusicalContext {
  /** Z-Score actual (desviación del audio - 0=silencio, 1.5=normal, >2.8=DROP) */
  zScore: number
  
  /** BPM detectado */
  bpm: number
  
  /** Energía del audio (0-1) */
  energy: number
  
  /** ID del vibe activo */
  vibeId: string
  
  /** Fase de beat (0-1, donde 0=downbeat) */
  beatPhase?: number
  
  /** ¿Estamos en un drop? */
  inDrop?: boolean
}

/**
 * Configuración base para disparar cualquier efecto
 */
export interface EffectTriggerConfig {
  /** ID único del tipo de efecto (e.g., 'solar_flare', 'strobe_burst') */
  effectType: string
  
  /** Intensidad del disparo (0-1). Afecta la magnitud del efecto. */
  intensity: number
  
  /** Zonas objetivo. Default: 'all' */
  zones?: EffectZone[]
  
  /** Fuente del disparo (para logging) */
  source: 'hunt_strike' | 'prediction' | 'manual' | 'physics' | 'vibe'
  
  /** Razón del disparo (para debug) */
  reason?: string
  
  /**
   * 🧨 WAVE 680: Musical context para efectos que respiran
   */
  musicalContext?: MusicalContext
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACE: ILightEffect - El contrato de todo efecto
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧨 Interface base para todos los efectos de iluminación
 * 
 * Cada efecto es una clase que implementa esta interface.
 * El EffectManager los orquesta y mezcla sus outputs.
 * 
 * CICLO DE VIDA:
 * 1. trigger() - Inicia el efecto
 * 2. update(deltaMs) - Llamado cada frame
 * 3. getOutput() - Devuelve el output actual
 * 4. isFinished() → true - Efecto terminado, se elimina
 */
export interface ILightEffect {
  /** ID único de la instancia del efecto */
  readonly id: string
  
  /** Tipo de efecto (e.g., 'solar_flare') */
  readonly effectType: string
  
  /** Nombre legible del efecto */
  readonly name: string
  
  /** Categoría del efecto */
  readonly category: EffectCategory
  
  /** Prioridad (mayor = más importante en conflictos) */
  readonly priority: number
  
  /**
   * Dispara el efecto con la configuración dada
   * @param config Configuración del disparo
   */
  trigger(config: EffectTriggerConfig): void
  
  /**
   * Actualiza el estado interno del efecto
   * @param deltaMs Milisegundos desde el último frame
   */
  update(deltaMs: number): void
  
  /**
   * Obtiene el output actual del efecto
   * @returns Output del frame actual, o null si no hay output
   */
  getOutput(): EffectFrameOutput | null
  
  /**
   * ¿Ha terminado el efecto?
   * @returns true si el efecto completó su ciclo
   */
  isFinished(): boolean
  
  /**
   * Aborta el efecto inmediatamente
   */
  abort(): void
  
  /**
   * Fase actual del efecto
   */
  getPhase(): EffectPhase
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado del EffectManager para telemetría
 */
export interface EffectManagerState {
  /** Número de efectos activos */
  activeCount: number
  
  /** IDs de efectos activos */
  activeEffects: string[]
  
  /** Último efecto disparado */
  lastTriggered: string | null
  
  /** Timestamp del último trigger */
  lastTriggerTime: number
  
  /** Total de efectos disparados esta sesión */
  totalTriggered: number
}

/**
 * Resultado combinado de todos los efectos activos
 */
export interface CombinedEffectOutput {
  /** ¿Hay algún efecto activo? */
  hasActiveEffects: boolean
  
  /** Override de dimmer combinado (HTP de todos los efectos) */
  dimmerOverride?: number
  
  /** Override de blanco combinado (HTP) */
  whiteOverride?: number
  
  /** 🧨 WAVE 630: Override de ámbar combinado (HTP) */
  amberOverride?: number
  
  /** Override de color (del efecto con mayor prioridad) */
  colorOverride?: { h: number; s: number; l: number }
  
  /** Strobe rate máximo */
  strobeRate?: number
  
  /** Intensidad combinada */
  intensity: number
  
  /** IDs de efectos contribuyendo */
  contributingEffects: string[]
  
  /**
   * 🧨 WAVE 630: GLOBAL OVERRIDE FLAG
   * Si true, bypasea TODA la lógica de zonas.
   * El efecto se aplica a TODAS las fixtures con dimmer.
   */
  globalOverride?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSCIOUSNESS INTEGRATION - Para el gatillo desde la IA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Decisión de efecto desde la consciencia
 * 
 * WAVE 600: Se añade al ConsciousnessOutput
 */
export interface ConsciousnessEffectDecision {
  /** Tipo de efecto a disparar */
  effectType: string
  
  /** Intensidad (0-1) */
  intensity: number
  
  /** Zonas objetivo */
  zones?: EffectZone[]
  
  /** Razón del disparo */
  reason?: string
  
  /** Confianza en esta decisión */
  confidence: number
}
