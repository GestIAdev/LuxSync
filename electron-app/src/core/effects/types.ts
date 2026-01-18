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
  
  /**
   * 🥁 WAVE 700.7: MOVEMENT OVERRIDE
   * Permite a los efectos controlar directamente el Pan/Tilt de los movers.
   * 
   * USAGE:
   * - isAbsolute=true: IGNORA las físicas, usa estos valores directamente (0-1 range)
   * - isAbsolute=false: SUMA a las físicas (offset mode, -1.0 to 1.0)
   * 
   * Los valores -1.0 a 1.0 se mapean al rango completo de pan/tilt:
   * - Pan: -1.0 = 0°, 0.0 = 180°, 1.0 = 360°
   * - Tilt: -1.0 = -90°, 0.0 = 0°, 1.0 = 90°
   */
  movement?: {
    /** Override de Pan (-1.0 a 1.0) */
    pan?: number
    /** Override de Tilt (-1.0 a 1.0) */
    tilt?: number
    /** true = override total, false = offset sumado a físicas */
    isAbsolute?: boolean
    /** Velocidad de transición (0-1, opcional) */
    speed?: number
  }
  
  /**
   * 🎨 WAVE 725: ZONE OVERRIDES - "PINCELES FINOS"
   * 
   * Permite control granular por zona en un solo frame.
   * REEMPLAZA la "brocha gorda" del colorOverride global cuando se necesita
   * pintar diferentes zonas con diferentes colores.
   * 
   * PRIORIDAD (cuando presente):
   * zoneOverrides > colorOverride/dimmerOverride globales
   * 
   * EJEMPLO DE USO:
   * ```ts
   * zoneOverrides: {
   *   'front': { color: { h: 0, s: 100, l: 50 }, dimmer: 0.9 },   // ROJO
   *   'back':  { color: { h: 240, s: 100, l: 50 }, dimmer: 0.8 }, // AZUL
   *   'movers': { movement: { pan: 0.5, tilt: 0.2, isAbsolute: true } }
   * }
   * ```
   * 
   * ZONAS SOPORTADAS:
   * - 'front': Front PARs (floor-front, FRONT_PARS)
   * - 'back': Back PARs (floor-back, BACK_PARS)  
   * - 'movers': Moving heads (ceiling-*, MOVING_*)
   * - 'pars': Todos los PARs (front + back)
   * - 'all': Todas las fixtures (equivalente a globalOverride)
   */
  zoneOverrides?: {
    [zoneId: string]: {
      /** Color específico para esta zona (HSL) */
      color?: { h: number; s: number; l: number }
      /** Dimmer específico para esta zona (0-1) */
      dimmer?: number
      /** White override específico (0-1) */
      white?: number
      /** Amber override específico (0-1) */
      amber?: number
      /** Movement específico para movers */
      movement?: {
        pan?: number
        tilt?: number
        isAbsolute?: boolean
        speed?: number
      }
    }
  }
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
  
  /**
   * 🌴 WAVE 700.8: ZONE FILTERING
   * Zonas afectadas por los efectos combinados.
   * Solo se usa cuando globalOverride=false.
   */
  zones?: EffectZone[]
  
  /**
   * 🥁 WAVE 700.7: COMBINED MOVEMENT OVERRIDE
   * Movimiento combinado de todos los efectos activos.
   * Prioridad: El efecto con mayor priority toma el control del movimiento.
   */
  movementOverride?: {
    pan?: number
    tilt?: number
    isAbsolute?: boolean
    speed?: number
  }
  
  /**
   * 🎨 WAVE 725: COMBINED ZONE OVERRIDES - "PINCELES FINOS"
   * 
   * Mapa de zone → overrides específicos, combinados de todos los efectos activos.
   * Permite que diferentes zonas reciban diferentes colores en el mismo frame.
   * 
   * PRIORIDAD DE MERGE:
   * - HTP para dimmer/white/amber (el más alto gana)
   * - LTP para color (el efecto de mayor prioridad gana)
   * - LTP para movement (el efecto de mayor prioridad gana)
   */
  zoneOverrides?: {
    [zoneId: string]: {
      /** Color para esta zona (HSL) */
      color?: { h: number; s: number; l: number }
      /** Dimmer para esta zona (0-1) */
      dimmer?: number
      /** White para esta zona (0-1) */
      white?: number
      /** Amber para esta zona (0-1) */
      amber?: number
      /** Movement para esta zona */
      movement?: {
        pan?: number
        tilt?: number
        isAbsolute?: boolean
        speed?: number
      }
      /** Prioridad del efecto que contribuyó este override */
      priority?: number
    }
  }
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
