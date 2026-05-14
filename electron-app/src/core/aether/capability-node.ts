/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  AETHER MATRIX — CAPABILITY NODE CONTRACTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WAVE 3505.1: El contrato atómico de un Nodo de Capacidad.
 *
 * Un CapabilityNode es la unidad fundamental del Motor Agnóstico.
 * No es un fixture, no es un canal, no es un aparato.
 * Es una **capacidad física** que el motor entiende nativamente:
 * emitir color, interrumpir luz, generar movimiento, conformar haz,
 * o modificar la atmósfera.
 *
 * Un fixture es simplemente una carcasa que agrupa N nodos.
 * El motor jamás habla con fixtures — solo con nodos.
 *
 * JERARQUÍA DE TIPOS:
 *   ICapabilityNode (base)
 *     ├── IColorNodeData
 *     ├── IImpactNodeData
 *     ├── IKineticNodeData
 *     ├── IBeamNodeData
 *     └── IAtmosphereNodeData
 *
 * @module core/aether/capability-node
 * @version WAVE 3505.1
 */

import type {
  NodeId,
  DeviceId,
  ZoneId,
  NodeFamily,
  NodeRole,
  AetherChannelType,
  ResponseType,
  TransferCurve,
  ColorMixingType,
  ColorWheelDefinition,
  MotorType,
  AtmosphereType,
  Position3D,
  BandMixWeights,
  AtmosphereSafetyState,
  DarkSpinState,
  EnvelopeState,
} from './types'

// WAVE 4523.4: Tipos IK reutilizados por referencia directa desde el engine.
// No se redefinen — se importan para que IKineticNodeData sea type-safe con
// el IKFixtureProfile assembly que hará el NodeResolver en WAVE 4523.5.
import type {
  FixtureOrientation  as IKOrientation,
  MechanicalLimits    as IKMechanicalLimits,
  FixtureCalibration  as IKCalibration,
} from '../../engine/movement/InverseKinematicsEngine'

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL DEFINITION — Átomo de un canal DMX dentro de un nodo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Definición de un canal DMX individual dentro de un CapabilityNode.
 *
 * Cada canal mapea exactamente a un (o dos, si 16-bit) slots DMX
 * en el Device físico. El `dmxOffset` es relativo a la dirección
 * base del Device, no absoluto al universo.
 *
 * Un canal pertenece a **exactamente un nodo**. No hay canales
 * compartidos entre nodos del mismo Device.
 */
export interface INodeChannelDef {
  /** Tipo de canal según la taxonomía Aether */
  readonly type: AetherChannelType
  /**
   * Offset DMX relativo al inicio del Device.
   * Ejemplo: si el Device empieza en dirección 100 y el canal
   * tiene dmxOffset=5, el canal vive en la dirección 105.
   */
  readonly dmxOffset: number
  /**
   * Valor DMX por defecto cuando ningún System ni Layer controla
   * este canal. Típicamente 0 para dimmers, 0 para color,
   * 128 para pan/tilt (centro).
   */
  readonly defaultValue: number
  /**
   * ¿Es un canal de 16-bit (ocupa 2 slots DMX consecutivos)?
   * Si true, `dmxOffset` apunta al byte coarse (MSB) y
   * `dmxOffset + 1` es el byte fine (LSB).
   */
  readonly is16bit?: boolean
  /**
   * Nombre personalizado para canales de tipo `custom`.
   * Ejemplo: "pump", "fan-speed", "spark-rate".
   */
  readonly customName?: string
  /**
   * 🔥 WAVE 4720: IGNITION DEPENDENCIES — canales que deben estar activos
   * para que este canal produzca salida. Pre-computados en patch-time y
   * usados por NodeResolver._precomputeIgnitionMap() para construir el
   * mapa de inyección HTP. NUNCA iterar en el hot path (44Hz).
   */
  readonly ignitionDeps?: readonly {
    readonly targetChannelType: AetherChannelType
    readonly requiredValue: number
    readonly mode: 'hold' | 'release'
    /** WAVE 4722: Offset DMX 0-based del canal master. Precedencia sobre targetChannelType. */
    readonly targetDmxOffset?: number
  }[]
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE CONSTRAINTS — Restricciones físicas del hardware
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Restricciones físicas y de seguridad de un CapabilityNode.
 *
 * Informan al NodeResolver y al physics layer sobre los límites
 * reales del hardware detrás del nodo. Violar estas restricciones
 * puede causar daño mecánico, parpadeo visible, o comportamiento
 * no deseado.
 */
export interface INodeConstraints {
  /**
   * Tipo de respuesta física del hardware.
   * Determina el modelo de interpolación del physics layer.
   * @see ResponseType
   */
  readonly responseType: ResponseType
  /**
   * Tiempo mínimo entre cambios de valor (ms).
   * Protección mecánica contra cambios demasiado rápidos.
   * - Ruedas de colores: ~200-500ms
   * - Ruedas de gobos: ~300-600ms
   * - LEDs digitales: 0ms
   */
  readonly minChangeTimeMs: number
  /**
   * Valor DMX máximo permitido para este nodo (0-255).
   * Protección contra sobre-potencia en hardware sensible.
   * Ejemplo: un shutter mecánico con maxValue=200 para
   * evitar resonancia a frecuencias muy altas.
   */
  readonly maxValue: number
  /**
   * Velocidad máxima del hardware.
   * - Para KINETIC_NODE: grados por segundo del motor
   * - Para IMPACT_NODE: DMX units por segundo (slew rate)
   * - Para otros: no aplica (undefined)
   */
  readonly maxSpeed?: number
  /**
   * Curva de transferencia sugerida para este nodo.
   * El NodeResolver la aplica al convertir valores normalizados
   * (0-1) a rango DMX (0-255).
   * Si no se especifica, el sistema usa `linear` por defecto.
   */
  readonly transferCurve?: TransferCurve
}

// ═══════════════════════════════════════════════════════════════════════════
// ICAPABILITYNODE — La interfaz atómica base
/**
 * WAVE 4735.2: Metadata de perfil HAL con tipo seguro.
 *
 * Permite acceso directo a `customLabel` sin casts ni bracket access.
 * El index signature preserva la extensibilidad para datos de familia
 * específicos que aún no tienen campo formalizado.
 */
export interface IProfileMetadata {
  /** Etiqueta de display personalizada (asignada por Forge, WAVE 4738) */
  readonly customLabel?: string
  /** Extensible — datos de perfil HAL adicionales */
  readonly [key: string]: unknown
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Representa una capacidad física indivisible: emitir color,
 * producir impacto lumínico, generar movimiento, conformar un haz,
 * o modificar la atmósfera.
 *
 * INVARIANTES:
 * - Un `nodeId` es globalmente único e inmutable tras patch.
 * - Un canal DMX pertenece a exactamente un nodo.
 * - El estado pre-allocated (`state`) se muta in-place por los
 *   Systems y el physics layer — zero-alloc en hot path.
 * - Los `channels` y `constraints` son readonly tras patch.
 *
 * CICLO DE VIDA:
 * 1. Creado en patch time por NodeFactory al registrar un Device.
 * 2. Almacenado en el NodeGraph en un dense array por familia.
 * 3. Iterado frame a frame por el System correspondiente.
 * 4. Resuelto a DMX por el NodeResolver en flush time.
 * 5. Destruido cuando el Device se desregistra.
 *
 * @see WAVE-3505-BLUEPRINT.md §1.2 "Anatomía de un CapabilityNode"
 */
export interface ICapabilityNode {
  /** Identificador único e inmutable. Formato: `"<deviceId>:<label>"` */
  readonly nodeId: NodeId
  /** Familia de capacidad a la que pertenece este nodo */
  readonly family: NodeFamily
  /** Device físico que contiene este nodo */
  readonly deviceId: DeviceId
  /** Zona espacial asignada */
  readonly zoneId: ZoneId
  /** Posición física 3D en el escenario (para stereo routing y pixel mapping) */
  readonly position?: Position3D
  /** Rol semántico — hint para los Systems sobre cómo reaccionar */
  readonly role: NodeRole
  /** Canales DMX que este nodo posee en exclusiva */
  readonly channels: readonly INodeChannelDef[]
  /** Restricciones físicas y de seguridad del hardware */
  readonly constraints: INodeConstraints
  /**
   * Metadata extra del perfil HAL.
   * Datos específicos por familia que no encajan en los campos
   * estándar. Ejemplo: definición de rueda de colores para
   * COLOR_NODE, ángulos máximos para KINETIC_NODE.
   */
  readonly profileMeta?: Readonly<IProfileMetadata>
  /**
   * Estado pre-allocated del nodo (mutable in-place).
   *
   * Float64Array de 4 posiciones:
   * - [0] = target value   (valor deseado por el último System)
   * - [1] = current value   (valor actual post-physics interpolation)
   * - [2] = velocity        (velocidad de cambio para modelos spring)
   * - [3] = timestamp       (último frame que escribió el target)
   *
   * Este array se pre-alloca en patch time y se muta in-place
   * frame a frame. Zero allocations en el hot path.
   *
   * @see WAVE-3505-BLUEPRINT.md §0 "Principio 3: Zero-alloc frame path"
   */
  readonly state: Float64Array
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-FAMILY DISCRIMINATED DATA INTERFACES
// ═══════════════════════════════════════════════════════════════════════════
//
// Cada familia tiene datos adicionales específicos de su dominio.
// Los Systems reciben NodeViews tipados con estos interfaces,
// garantizando type safety sin casts en runtime.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Datos específicos de un nodo de la familia COLOR.
 *
 * Describe las capacidades cromáticas del hardware:
 * tipo de mezcla (RGB, rueda, CMY), y mantiene un cache
 * del último color asignado para interpolación LERP suave.
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.1 "ColorSystem"
 */
export interface IColorNodeData extends ICapabilityNode {
  readonly family: NodeFamily.COLOR
  /**
   * Tipo de mezcla de color que soporta este nodo.
   * Determina la estrategia del ColorSystem para traducir
   * un color target a valores DMX.
   */
  readonly mixingType: ColorMixingType
  /**
   * Definición de la rueda de colores mecánica (si aplica).
   * Solo presente cuando `mixingType` es `'wheel'` o `'hybrid'`.
   */
  readonly colorWheel?: ColorWheelDefinition
  /**
   * Cache del último color RGB asignado.
   * Usado por el ColorSystem para interpolación LERP frame-a-frame,
   * evitando saltos bruscos de color.
   * Mutable: se actualiza in-place cada frame.
   */
  currentColor: { r: number; g: number; b: number }
}

/**
 * Datos específicos de un nodo de la familia IMPACT.
 *
 * Modela la física reactiva de interrupción de luz:
 * cómo responde al audio, con qué curva, y el estado
 * del envolvente para decay orgánico.
 *
 * FILOSOFÍA "Snappy Attack":
 * Los IMPACT_NODEs con role `percussion` usan curva exponencial(2.5):
 * - Input 0.3 → Output 0.049 (casi apagado)
 * - Input 0.7 → Output 0.408 (presencia media)
 * - Input 0.95 → Output 0.881 (explosión)
 * Sensación: latigazo instantáneo cuando golpea el kick.
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.2 "ImpactSystem"
 */
export interface IImpactNodeData extends ICapabilityNode {
  readonly family: NodeFamily.IMPACT
  /**
   * Curva de transferencia que define la "personalidad"
   * reactiva de este nodo frente al audio.
   */
  readonly transferCurve: TransferCurve
  /**
   * Pesos de mezcla de bandas de frecuencia para este nodo.
   * Determinan cuánto influye cada banda del espectro en
   * la intensidad final.
   * Configurables por Vibe — no hardcodeados.
   */
  readonly bandMix: BandMixWeights
  /**
   * Estado runtime del envolvente de intensidad.
   * Permite decay suave entre frames. Mutable in-place.
   */
  envelopeState: EnvelopeState
}

/**
 * Datos específicos de un nodo de la familia KINETIC.
 *
 * Modela el comportamiento mecánico de movimiento: tipos de motor,
 * velocidades máximas, posición actual para physics interpolation,
 * y datos de stereo para generación de patrones mirror/snake.
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.3 "KineticSystem"
 */
export interface IKineticNodeData extends ICapabilityNode {
  readonly family: NodeFamily.KINETIC
  /** Tipo de motor físico que impulsa este nodo */
  readonly motorType: MotorType
  /**
   * Si true, este nodo controla rotación continua (fan, mirror ball, pétalo)
   * en lugar de posicionamiento absoluto (pan/tilt de mover).
   */
  readonly isContinuous: boolean
  /** Velocidad máxima de pan (grados por segundo) */
  readonly maxPanSpeed: number
  /** Velocidad máxima de tilt (grados por segundo) */
  readonly maxTiltSpeed: number
  /** Velocidad máxima de rotación continua (revoluciones por segundo o grados/s) */
  readonly maxRotationSpeed?: number
  /**
   * Posición actual del motor (para physics interpolation).
   * Valores normalizados 0-1 (0 = mínimo mecánico, 1 = máximo mecánico).
   * Para nodos continuos, `rotation` representa la posición/velocidad normalizada.
   * Mutable: actualizado por el physics layer cada frame.
   */
  currentPosition: { pan: number; tilt: number; rotation?: number }
  /**
   * Posición física 3D del nodo en el escenario.
   * Usada por el KineticSystem para stereo routing:
   * nodos con x negativo espejean el patrón respecto a x positivo.
   */
  readonly physicalPosition: Position3D
  /**
   * Índice de este nodo en la secuencia stereo del show.
   * Usado por el VMM para calcular phase offsets en patrones
   * mirror, snake, y wave.
   */
  readonly stereoIndex: number
  /** Número total de nodos cinéticos en la secuencia stereo */
  readonly stereoTotal: number

  // ── WAVE 4523.4: Datos para IKEngine (Fase C — WAVE 4523.5) ────────────────
  // Estos campos son opcionales: si no están presentes, el NodeResolver
  // cae en el flujo legacy (pan/tilt normalizados → DMX directo).
  // Se populan desde ShowFileV2.FixtureV2 durante el patch time en NodeFactory.

  /**
   * Orientación de montaje del fixture.
   * Define el tipo de instalación (ceiling/floor/truss-front/etc.) y la
   * rotación adicional personalizada. El IKEngine lo usa para calcular
   * el frame local del fixture a partir del que resuelve el apuntado.
   */
  readonly ikOrientation?: IKOrientation

  /**
   * Límites mecánicos del fixture (rangos de pan/tilt en grados).
   * Si no está presente, el IKEngine usa defaults de industria:
   * panRange=540°, tiltRange=270°.
   */
  readonly ikLimits?: IKMechanicalLimits

  /**
   * Calibración del fixture (offsets de ángulo e inversiones de eje).
   * El IKEngine la aplica internamente al producir el resultado DMX.
   * El NodeResolver NO debe aplicar _applyCalibration() adicional para
   * los canales pan/tilt que provienen del IKEngine (anti-double-calibration).
   */
  readonly ikCalibration?: IKCalibration
}

/**
 * Datos específicos de un nodo de la familia BEAM.
 *
 * Describe las capacidades de conformación de haz: qué elementos
 * ópticos están disponibles (gobo, prism, zoom, focus, frost),
 * y mantiene el estado de DarkSpin para debounce de ruedas mecánicas.
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.4 "BeamSystem"
 */
export interface IBeamNodeData extends ICapabilityNode {
  readonly family: NodeFamily.BEAM
  /** Tiene rueda de gobos */
  readonly hasGobo: boolean
  /** Tiene rotación de gobo continua */
  readonly hasGoboRotation: boolean
  /** Tiene prisma */
  readonly hasPrism: boolean
  /** Tiene rotación de prisma continua */
  readonly hasPrismRotation: boolean
  /** Tiene zoom motorizado */
  readonly hasZoom: boolean
  /** Tiene focus motorizado */
  readonly hasFocus: boolean
  /** Tiene frost motorizado */
  readonly hasFrost: boolean
  /**
   * Estado del filtro DarkSpin para ruedas mecánicas.
   * Previene parpadeo por cambios demasiado rápidos.
   * Mutable: actualizado por el BeamSystem cada frame.
   */
  darkSpinState?: DarkSpinState
}

/**
 * Datos específicos de un nodo de la familia ATMOSPHERE.
 *
 * Modela dispositivos no lumínicos controlados por cues,
 * no por el frame loop de audio. Incluye estado de seguridad
 * para enforcar cooldowns e interlocks.
 *
 * @see WAVE-3505-BLUEPRINT.md §2.3.5 "AtmosphereSystem"
 */
export interface IAtmosphereNodeData extends ICapabilityNode {
  readonly family: NodeFamily.ATMOSPHERE
  /** Tipo de dispositivo atmosférico */
  readonly atmosType: AtmosphereType
  /**
   * Estado de seguridad runtime.
   * Trackeado para enforcar cooldowns obligatorios,
   * tiempos máximos de activación, e interlocks
   * (e.g. no humo + chispas simultáneo).
   * Mutable: actualizado por el AtmosphereSystem.
   */
  safety: AtmosphereSafetyState
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCRIMINATED UNION — Tipo unión para pattern matching
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unión discriminada de todos los tipos de datos de nodo por familia.
 *
 * Permite pattern matching exhaustivo sobre el campo `family`:
 * ```ts
 * function processNode(node: AnyNodeData) {
 *   switch (node.family) {
 *     case NodeFamily.COLOR:      // node es IColorNodeData
 *     case NodeFamily.IMPACT:     // node es IImpactNodeData
 *     case NodeFamily.KINETIC:    // node es IKineticNodeData
 *     case NodeFamily.BEAM:       // node es IBeamNodeData
 *     case NodeFamily.ATMOSPHERE: // node es IAtmosphereNodeData
 *   }
 * }
 * ```
 */
export type AnyNodeData =
  | IColorNodeData
  | IImpactNodeData
  | IKineticNodeData
  | IBeamNodeData
  | IAtmosphereNodeData
