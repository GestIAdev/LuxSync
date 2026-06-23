/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — DEVICE DEFINITION CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: La carcasa física — el contenedor inerte.
 *
 * Un Device es la representación de un aparato físico (fixture) en
 * el Aether. Pero a diferencia del modelo legacy donde el fixture
 * era la entidad principal, aquí el Device es solo un empaquetado:
 * agrupa N CapabilityNodes que comparten dirección DMX base y universo.
 *
 * El Device solo existe en dos momentos:
 * 1. PATCH TIME  — La Forja define el Device y genera sus nodos.
 * 2. FLUSH TIME  — El NodeResolver reagrupa nodos por DeviceId
 *                  para ensamblar paquetes DMX.
 *
 * Entre patch y flush, el motor solo ve nodos.
 *
 * @module core/aether/device
 * @version WAVE 3505.1
 */

import type { DeviceId } from './types'
import type { ICapabilityNode } from './capability-node'

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE CALIBRATION — Datos de calibración por dispositivo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos de calibración física de un Device.
 *
 * Aplicados por el CalibrationApplier del NodeResolver como último
 * paso antes de emitir DMX. Estos offsets compensan las diferencias
 * de instalación física (fixture colgado al revés, rotado, etc.)
 * sin alterar los valores que los Systems producen.
 */
export interface IDeviceCalibration {
  /**
   * Inversión de pan: el eje pan está montado al revés.
   * Si true, el NodeResolver aplica `255 - panValue`.
   */
  readonly invertPan?: boolean
  /**
   * Inversión de tilt: el eje tilt está montado al revés.
   * Si true, el NodeResolver aplica `255 - tiltValue`.
   */
  readonly invertTilt?: boolean
  /**
   * Offset de pan en unidades DMX (-128 a +127).
   * Sumado al valor de pan tras la inversión.
   */
  readonly panOffset?: number
  /**
   * Offset de tilt en unidades DMX (-128 a +127).
   * Sumado al valor de tilt tras la inversión.
   */
  readonly tiltOffset?: number
  /**
   * Límite inferior de tilt en DMX (0-255).
   * Previene que el fixture apunte al público por seguridad.
   */
  readonly tiltLimitMin?: number
  /**
   * Límite superior de tilt en DMX (0-255).
   * Previene que el fixture apunte al techo.
   */
  readonly tiltLimitMax?: number
  /**
   * Factor de corrección de dimmer (0-1).
   * Multiplica el valor final de dimmer para igualar
   * el brillo percibido entre fixtures de distinta potencia.
   */
  readonly dimmerScale?: number
  /**
   * WAVE 1135.3: Dead-zone floor del dimmer en DMX (0-255).
   * Valor mínimo en el que el dimmer realmente enciende la lámpara.
   * Si el valor calculado es > 0 pero < dimmerMin, se eleva a dimmerMin.
   * Si el valor es exactamente 0 (apagado intencional), se deja en 0.
   */
  readonly dimmerMin?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX GOVERNOR ENGINE — Reglas declarativas de última milla
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tipo de intención semántica para el matching de reglas de gobernador.
 * 'fallback' es un comodín — hace match con cualquier tipo de canal.
 */
export type GovernorIntentType =
  | 'shutter'
  | 'strobe'
  | 'intensity'
  | 'prism'
  | 'prism-rotation'
  | 'gobo'
  | 'frost'
  | 'zoom'
  | 'focus'
  | 'fallback'

/**
 * Condición de activación de una regla de gobernador.
 * Todos los campos presentes deben cumplirse simultáneamente (semántica AND).
 */
export interface IGovernorCondition {
  /** Tipo semántico de canal a interceptar. 'fallback' hace match con cualquiera. */
  readonly intentType: GovernorIntentType
  /** Valor normalizado mínimo (inclusive). Ausente = sin límite inferior. */
  readonly min?: number
  /** Valor normalizado máximo (exclusivo). Ausente = sin límite superior. */
  readonly max?: number
}

/**
 * Transformación física aplicada cuando la condición de la regla hace match.
 * forceByte tiene precedencia sobre mapToRange. clampMin se aplica al final.
 */
export interface IGovernorAction {
  /** Sobreescribir con un byte DMX fijo [0-255]. Máxima precedencia. */
  readonly forceByte?: number
  /** Re-mapear el input normalizado [0,1] al rango DMX físico [min, max]. */
  readonly mapToRange?: readonly [number, number]
  /** Si el byte calculado es > 0 pero < clampMin, elevarlo a clampMin. */
  readonly clampMin?: number
}

/**
 * Regla declarativa única: condición → transformación física.
 * La primera regla del array que hace match gana (short-circuit).
 */
export interface IGovernorRule {
  readonly when: IGovernorCondition
  readonly then: IGovernorAction
}

/**
 * Gobernador DMX: vincula un conjunto ordenado de reglas a un canal físico concreto.
 * channelIndex es 0-based, relativo a la dmxAddress base del device.
 * Si existen múltiples gobernadores para el mismo channelIndex,
 * solo se evalúa el primero (first-match wins).
 */
export interface IDMXGovernor {
  /** Offset DMX 0-based relativo a la dirección base del device. */
  readonly channelIndex: number
  /** Reglas evaluadas en orden. Primera regla con match gana. */
  readonly rules: readonly IGovernorRule[]
}

// ═══════════════════════════════════════════════════════════════════════════
// DEVICE DEFINITION — Lo que La Forja produce
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🏭 IDeviceDefinition — El contrato del contenedor físico.
 *
 * Producido por La Forja (editor de fixtures) en patch time.
 * Consumido por el NodeGraph para generar y registrar los
 * CapabilityNodes correspondientes.
 *
 * Un DeviceDefinition se puede generar de dos formas:
 * 1. **AutoNodeDetector** — a partir de un FixtureDefinition legacy
 *    (heurísticas sobre channels[] y capabilities).
 * 2. **Manual Node Assignment** — el usuario asigna canales a nodos
 *    en un editor visual (fixtures complejos como fans, barras LED).
 *
 * INVARIANTES:
 * - `deviceId` es globalmente único.
 * - Todos los `dmxOffset` de los nodos están dentro de [0, channelCount).
 * - Ningún canal DMX aparece en más de un nodo.
 * - La suma de canales de todos los nodos ≤ channelCount.
 *
 * @see WAVE-3505-BLUEPRINT.md §1.3 "Sub-Emisores"
 * @see WAVE-3505-BLUEPRINT.md §8.3 "Compatibilidad con La Forja"
 */
export interface IDeviceDefinition {
  /** Identificador único del Device */
  readonly deviceId: DeviceId
  /** Nombre legible para la UI (e.g. "Fan Tungsteno #3") */
  readonly name: string
  /**
   * Tipo original del fixture (para la UI y compatibilidad legacy).
   * Ejemplo: "beam_2r", "par_led_rgbw", "fan_tungsten".
   */
  readonly type: string
  /** Dirección DMX base (1-512) */
  readonly dmxAddress: number
  /** Universo DMX (1-based) */
  readonly universe: number
  /** Número total de canales DMX que ocupa este Device */
  readonly channelCount: number
  /**
   * Nodos de capacidad que contiene este Device.
   * Cada nodo describe una capacidad física indivisible
   * con sus canales DMX, constraints, y rol semántico.
   */
  readonly nodes: readonly ICapabilityNode[]
  /**
   * Datos de calibración para compensar la instalación física.
   * Aplicados por el NodeResolver como último paso antes de DMX.
   */
  readonly calibration?: IDeviceCalibration
  /**
   * ¿Es un Device virtual (solo preview, no genera DMX físico)?
   * Usado para visualización 3D sin hardware conectado.
   */
  readonly isVirtual?: boolean
  /**
   * 🧭 WAVE 4573: Orientación de instalación del fixture en el espacio 3D.
   * Leída desde FixtureV2.orientation (root) — no desde physics.orientation.
   * Usada por el IK engine para calcular la inversión de tilt.
   */
  readonly orientation?: string
  /**
   * ⚡ WAVE 4573: Flag de posicionamiento 3D.
   * false = modo Guerrilla (Quick-Add sin posición real).
   * El SpatialRegistrar omite la inyección de coordenadas IK cuando es false.
   */
  readonly isPlaced?: boolean
  /**
   * 🏛️ DMX GOVERNOR ENGINE: Reglas declarativas de última milla.
   * Evaluadas por canal en _writeNode() tras todos los transforms de
   * seguridad/calibración/personality. Zero-allocation — congeladas en patch time.
   */
  readonly dmxGovernors?: readonly IDMXGovernor[]
}
