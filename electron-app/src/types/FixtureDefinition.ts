import type { InstallationOrientation } from '../core/stage/ShowFileV2'
import type { IForgeNodeGraph } from '../core/forge/types'

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2084: UNIVERSAL CHANNEL DNA
// Soporta desde movers clásicos hasta ingenios alienígenas (fans, lasers, FX)
// ═══════════════════════════════════════════════════════════════════════════
export type ChannelType =
  // INTENSITY
  | 'dimmer'
  | 'dimmer_fine'
  | 'strobe'
  | 'shutter'
  // COLOR
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'cyan'
  | 'magenta'
  | 'yellow'
  | 'color_wheel'
  // POSITION
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  // BEAM
  | 'gobo'
  | 'gobo_rotation'
  | 'prism'
  | 'prism_rotation'
  | 'focus'
  | 'zoom'
  | 'frost'
  | 'iris'
  // CONTROL
  | 'speed'
  | 'macro'
  | 'control'
  // 🔥 WAVE 2084: INGENIOS — Canales para dispositivos no convencionales
  | 'rotation'    // Rotación continua (bolas de espejos, scanners rotativos, etc.)
  | 'custom'      // Canal libre definido por el usuario (fans, heaters, fog, etc.)
  // 🟢 WAVE 7737: LASER GEOMETRY — escala y tumble 3D de patrón.
  // Galvos (X/Y) NO viven aquí: se tipan como 'pan'/'tilt' para heredar
  // VMM/IK/physics gratis. Pattern bank = 'gobo'. Spin en plano = 'gobo_rotation'.
  | 'scale_x'     // Escala horizontal del patrón (0-255)
  | 'scale_y'     // Escala vertical del patrón (0-255)
  | 'rot_x'       // Tumble 3D del patrón, eje X (0-255)
  | 'rot_y'       // Tumble 3D del patrón, eje Y (0-255)
  // 🚨 WAVE 7737: SAFETY INTERLOCK — nunca driveable por L0/L1. Fail-closed.
  | 'emission_gate' // Habilitación de emisión láser / interlock legal (default 0)
  // 🌫️ WAVE 7737: ATMOSPHERE — humo/niebla/ventilación, cuarentena L2/L3 @ 4Hz.
  | 'smoke_pump'    // Salida de la bomba de fluido (fog/haze)
  | 'smoke_density' // Densidad / ratio de mezcla del fluido
  | 'fan_speed'     // Velocidad de ventilador (dispersión o standalone)
  // 🔥 WAVE 7737: FIRE — safety-critical, fail-closed, nunca driveable por L0/L1.
  | 'fire_valve'    // Válvula de combustible / solenoide (default 0)
  | 'fire_ignite'   // Disparo de ignición (default 0)
  // FALLBACK
  | 'unknown';

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 1120: STRICT FIXTURE TYPE ENUM
// "Moving-head, Scanner, Par, Bar, Strobe, Effect, Laser, Generic"
// ═══════════════════════════════════════════════════════════════════════════
export type FixtureType =
  | 'moving-head'
  | 'scanner'
  | 'par'
  | 'bar'
  | 'wash'
  | 'strobe'
  | 'effect'
  | 'laser'
  | 'blinder'
  // 🔥 WAVE 2084: INGENIOS — Tipos para dispositivos no convencionales
  | 'fan'       // Ventiladores DMX
  | 'fog'       // Máquinas de humo/haze
  | 'mirror-ball'  // Bolas de espejos motorizadas
  | 'pyro'      // Efectos pirotécnicos DMX
  | 'generic';

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 1120: DERIVED CAPABILITIES (Auto-detected from channels)
// "Inteligencia Derivada" - No pedir datos que se puedan deducir
// ═══════════════════════════════════════════════════════════════════════════
export interface DerivedCapabilities {
  hasPanTilt: boolean
  hasColorMixing: boolean
  colorMixingType: 'rgb' | 'cmy' | 'rgbw' | 'none'
  hasColorWheel: boolean
  hasGobos: boolean
  hasGoboRotation: boolean
  hasZoom: boolean
  hasFocus: boolean
  hasPrism: boolean
  hasPrismRotation: boolean
  hasShutter: boolean
  hasDimmer: boolean
  hasFrost: boolean
  is16bit: boolean
  channelCount: number
  // 🔥 WAVE 2084: INGENIOS capabilities
  hasRotation: boolean       // Tiene canales de rotación continua
  hasCustomChannels: boolean // Tiene canales custom (fan, fog, laser, etc.)
  hasMacro: boolean          // Tiene canales macro/program
  hasSpeed: boolean          // Tiene canal de velocidad
  customChannelNames: string[] // Nombres descriptivos de canales custom
  // 🟢 WAVE 7737: LASER & ATMOSPHERE capabilities
  hasLaserGeometry: boolean  // Tiene scale_x/y o rot_x/y (patrón láser 2D/3D)
  hasAtmosphere: boolean     // Tiene canales de humo/niebla/ventilación
  hasPyro: boolean           // Tiene fire_valve o fire_ignite (safety-critical)
  hasEmissionGate: boolean   // Tiene interlock de emisión láser
}

/**
 * 🧠 WAVE 1120: CAPABILITIES ENGINE
 * Derive features from channel definitions - ZERO user input required
 */
export function deriveCapabilities(channels: FixtureChannel[]): DerivedCapabilities {
  const types = new Set(channels.map(ch => ch.type))

  // RGB detection
  const hasRGB = types.has('red') && types.has('green') && types.has('blue')
  const hasWhite = types.has('white')

  // CMY detection
  const hasCMY = types.has('cyan') && types.has('magenta') && types.has('yellow')

  // Determine color mixing type
  let colorMixingType: 'rgb' | 'cmy' | 'rgbw' | 'none' = 'none'
  if (hasCMY) colorMixingType = 'cmy'
  else if (hasRGB && hasWhite) colorMixingType = 'rgbw'
  else if (hasRGB) colorMixingType = 'rgb'

  return {
    hasPanTilt: types.has('pan') || types.has('tilt'),
    hasColorMixing: hasRGB || hasCMY,
    colorMixingType,
    hasColorWheel: types.has('color_wheel'),
    hasGobos: types.has('gobo'),
    hasGoboRotation: types.has('gobo_rotation'),
    hasZoom: types.has('zoom'),
    hasFocus: types.has('focus'),
    hasPrism: types.has('prism'),
    hasPrismRotation: types.has('prism_rotation'),
    hasShutter: types.has('shutter') || types.has('strobe'),
    hasDimmer: types.has('dimmer'),
    hasFrost: types.has('frost'),
    is16bit: channels.some(ch => ch.is16bit || ch.type.includes('_fine')),
    channelCount: channels.length,
    // 🔥 WAVE 2084: INGENIOS capabilities detection
    hasRotation: types.has('rotation') || channels.some(ch => ch.continuousRotation === true),
    hasCustomChannels: types.has('custom'),
    hasMacro: types.has('macro'),
    hasSpeed: types.has('speed'),
    customChannelNames: channels
      .filter(ch => ch.type === 'custom' && ch.customName)
      .map(ch => ch.customName!),
    // 🟢 WAVE 7737: LASER & ATMOSPHERE capabilities detection
    hasLaserGeometry: types.has('scale_x') || types.has('scale_y') || types.has('rot_x') || types.has('rot_y'),
    hasAtmosphere: types.has('smoke_pump') || types.has('smoke_density') || types.has('fan_speed'),
    hasPyro: types.has('fire_valve') || types.has('fire_ignite'),
    hasEmissionGate: types.has('emission_gate'),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 4718: IGNITION DEPENDENCIES — GrandMA-style channel prerequisites
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Declaración de una dependencia de ignición.
 * "Para que ESTE canal funcione, `channelType` debe estar en `requiredValue`."
 *
 * Ejemplo (Beam 2R, canal Dimmer):
 *   { channelType: 'shutter', requiredValue: 255 }
 * → "El dimmer requiere que el Shutter esté en 255 (abierto) para emitir luz."
 *
 * Las dependencias se leen por las capas Aether (CORE) y los bridges de test
 * (WheelSmith / TestPanel) para asegurar la ignición de luminarias de
 * descarga (Beam, Spot, Wash con lámpara) que actualmente fallan al subir
 * solo el canal de intensidad.
 */
export interface IgnitionDependency {
  /**
   * WAVE 4722: Índice DMX 0-based del canal target (máxima prioridad).
   * Cuando presente, tiene precedencia absoluta sobre channelType.
   * Evita colisiones en fixtures con múltiples dimmers del mismo tipo.
   * Ejemplo: { targetChannelIndex: 2, requiredValue: 255 } → canal offset 2.
   */
  targetChannelIndex?: number;
  /** Tipo de canal del que depende (referencia semántica, no por índice) */
  channelType: ChannelType;
  /** Valor DMX (0-255) que el canal target debe tener para que ESTE canal funcione */
  requiredValue: number;
  /**
   * Modo de inyección:
   * - 'hold' (default): inyectar SIEMPRE mientras este perfil esté activo.
   * - 'release': inyectar SOLO cuando el canal fuente (este canal) > 0.
   */
  mode?: 'hold' | 'release';
}

export interface FixtureChannel {
  index: number;
  name: string;
  type: ChannelType;
  defaultValue: number;
  is16bit: boolean;
  // 🔥 WAVE 2084: INGENIOS — Nombre personalizado para canales custom/macro
  // Cuando type='custom' o type='macro', este campo describe qué hace el canal
  // Ejemplo: "Fan Speed", "Fog Output", "Laser Pattern", "Mirror Ball Rotation"
  customName?: string;
  // 🔥 WAVE 2084: INGENIOS — Indica si el canal es de rotación continua (no posicional)
  // true = 0-127 CW speed, 128 stop, 129-255 CCW speed (convención DMX estándar)
  continuousRotation?: boolean;
  // 🔥 WAVE 4718: IGNITION DEPENDENCIES — prerequisitos de canales para que
  // ESTE canal pueda emitir luz/movimiento. Opcional: perfiles LED y
  // luminarias simples no lo usan y siguen funcionando sin cambios.
  ignitionDeps?: IgnitionDependency[];
}

// 🎨 WAVE 1002: Color Engine types for HAL translation
export type ColorEngineType = 'rgb' | 'rgbw' | 'cmy' | 'wheel' | 'hybrid' | 'none';

// 🎨 WAVE 1006: Wheel Color type (compatible with HAL's FixtureProfiles.ts)
export interface WheelColor {
  /** Valor DMX para seleccionar este color (0-255) */
  dmx: number
  /** Nombre legible del color */
  name: string
  /** Aproximación RGB para cálculos de distancia */
  rgb: { r: number; g: number; b: number }
  /** Si el color incluye gobo o textura */
  hasTexture?: boolean
}

// 🎨 WAVE 1006: Color Wheel Definition (compatible con HAL's FixtureProfiles.ts)
// Legacy: se mantiene para JSONs pre-Blueprint. El nuevo contrato usa IForgeWheels.
export interface ColorWheelDefinition {
  /** Lista de colores disponibles en orden de rueda */
  colors: WheelColor[]
  /** ¿Permite giro continuo (rainbow effect)? */
  allowsContinuousSpin?: boolean
  /** DMX value para activar giro continuo (si aplica) */
  spinStartDmx?: number
  /** Tiempo mínimo entre cambios de color (ms) - PROTECCIÓN MECÁNICA */
  minChangeTimeMs?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DMX GOVERNOR ENGINE — Tipos de reglas de última milla
// ═══════════════════════════════════════════════════════════════════════════

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
  // 🚨 WAVE 7737: SAFETY INTENTS — deben mantenerse en sincronía estructural
  // con core/aether/device.ts::GovernorIntentType (fixtureDef.dmxGovernors
  // se asigna directamente a IDeviceDefinition.dmxGovernors sin traducción —
  // ver NodeExtractionPipeline.ts línea ~467).
  | 'emission'
  | 'fire'
  | 'smoke'
  | 'fallback';

export interface IGovernorRule {
  readonly when: {
    readonly intentType: GovernorIntentType
    readonly min?: number
    readonly max?: number
  }
  readonly then: {
    readonly forceByte?: number
    readonly mapToRange?: readonly [number, number]
    readonly clampMin?: number
  }
}

export interface IDMXGovernor {
  /** Offset DMX 0-based relativo a la dirección base del device. */
  readonly channelIndex: number
  /** Descripción humana opcional para la UI. */
  readonly description?: string
  /** Reglas evaluadas en orden. Primera regla con match gana. */
  readonly rules: readonly IGovernorRule[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 WAVE 7737: HARD SAFETY GOVERNORS — reglas fail-closed de referencia.
//
// Estas NO se inyectan automáticamente en ningún perfil. Son un catálogo que
// el Forge (o un fixture JSON de librería) debe spreadear explícitamente en
// `dmxGovernors` al crear un perfil de láser/pirotecnia/humo, indexando cada
// entrada al `channelIndex` real del canal en ESE fixture concreto.
//
// Uso típico en un builder de perfil:
// ```ts
// dmxGovernors: [
//   { ...HARD_SAFETY_GOVERNORS.emissionGate, channelIndex: emissionChannelIdx },
//   { ...HARD_SAFETY_GOVERNORS.fireIgnite,    channelIndex: igniteChannelIdx },
//   { ...HARD_SAFETY_GOVERNORS.smokePumpCap,  channelIndex: pumpChannelIdx },
// ]
// ```
//
// Estas reglas son la ÚLTIMA MILLA: se evalúan en _writeNode() DESPUÉS de
// todos los transforms de calibración/personality (ver DMXGovernorEvaluator).
// Ninguna capa del Arbiter (ni siquiera L3++ Calibration) puede sortearlas.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cada entrada es un `IDMXGovernor` SIN `channelIndex` (se rellena en el
 * sitio de uso, ya que depende del layout físico del fixture concreto).
 */
export const HARD_SAFETY_GOVERNORS: Readonly<Record<
  'emissionGate' | 'fireIgnite' | 'smokePumpCap',
  Omit<IDMXGovernor, 'channelIndex'>
>> = Object.freeze({
  /**
   * emission_gate: forzado a 0 (cerrado) salvo que el valor normalizado
   * sea exactamente el máximo (armado explícito, sin zona gris analógica).
   */
  emissionGate: {
    description: 'WAVE 7737: Emission gate fail-closed — solo 100% arma la emisión.',
    rules: [
      { when: { intentType: 'emission', max: 1.0 }, then: { forceByte: 0 } },
    ],
  },
  /**
   * fire_ignite: solo un comando literal a escala completa (normalizado
   * >= 254/255) dispara la ignición. Cualquier valor intermedio —ruido,
   * fade accidental, redondeo— se fuerza a 0.
   */
  fireIgnite: {
    description: 'WAVE 7737: Fire ignite fail-closed — requiere full-scale exacto.',
    rules: [
      { when: { intentType: 'fire', max: 254 / 255 }, then: { forceByte: 0 } },
    ],
  },
  /**
   * smoke_pump: cap duro al 70% del rango físico, independientemente de
   * lo que pida la capa de arbitraje — protección de duty cycle continuo.
   */
  smokePumpCap: {
    description: 'WAVE 7737: Smoke pump — cap duro al 70% de duty cycle.',
    rules: [
      { when: { intentType: 'smoke' }, then: { mapToRange: [0, 178] } },
    ],
  },
})

// ═══════════════════════════════════════════════════════════════════════════
// PHYSICS — Motor, aceleración y límites mecánicos
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgePhysics {
  // 🟢 WAVE 7737: 'galvo' — motor ultra-low-inertia para láser (settle ~1ms).
  // Permite al PhysicsPostProcessor seleccionar un perfil sin la inercia
  // de un moving head (3kg) para nodos KINETIC de galvos de láser.
  readonly motorType: 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro' | 'galvo'
  readonly maxAcceleration: number
  readonly maxVelocity?: number
  readonly safetyCap: number | boolean
  readonly orientation?: InstallationOrientation
  readonly invertPan?: boolean
  readonly invertTilt?: boolean
  readonly swapPanTilt?: boolean
  readonly homePosition?: { readonly pan: number; readonly tilt: number }
  readonly tiltLimits?: { readonly min: number; readonly max: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEELS — Rueda de color y motor de mezcla
// ═══════════════════════════════════════════════════════════════════════════

export interface IForgeWheels {
  readonly colors: WheelColor[]
  readonly colorEngine: ColorEngineType
  readonly minChangeTimeMs?: number
  readonly allowsContinuousSpin?: boolean
  readonly spinStartDmx?: number
}

// ═══════════════════════════════════════════════════════════════════════════
// AETHER CELL SNAPSHOT — Layout visual puro para persistencia 1:1
// ═══════════════════════════════════════════════════════════════════════════

export interface IAetherCellSnapshot {
  readonly id: string
  readonly label: string
  readonly family: string
  readonly zone?: string
  readonly channelIndices: readonly number[]
  readonly layout?: { readonly x: number; readonly y: number }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE DEFINITION — Contrato raíz unificado (Trinity Contract)
// ═══════════════════════════════════════════════════════════════════════════

export interface FixtureDefinition {
  // ── Identidad ─────────────────────────────────────────────────────────
  id: string;
  name: string;
  manufacturer: string;
  type: FixtureType;  // WAVE 1120: Strict enum instead of free string

  // ── Canales físicos ───────────────────────────────────────────────────
  channels: FixtureChannel[];

  // ── Capabilities (estrictamente derivadas) ─────────────────────────
  // DOGMA 4: capabilities es output, nunca input manual.
  capabilities: DerivedCapabilities;

  // ── Rueda de color (unificado) ─────────────────────────────────────
  // Incluye colorEngine y minChangeTimeMs; antes dispersos en capabilities.
  wheels?: IForgeWheels | null;

  // ── Física del motor ─────────────────────────────────────────────────
  physics?: IForgePhysics | null;

  // ── Gobernadores DMX (última milla) ─────────────────────────────────
  dmxGovernors?: IDMXGovernor[];

  // ── Snapshot de células Aether (layout visual) ─────────────────────
  aetherCells?: IAetherCellSnapshot[];

  // ── Grafo de nodos compilado (fuente de verdad Aether) ─────────────
  nodeGraph?: IForgeNodeGraph | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4548.3: UNIFIED CAPABILITIES — Canales + wheels + physics
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified capability derivation.
 *
 * DOGMA 4: capabilities se deduce estrictamente de channels, wheels y physics.
 * No acepta overrides manuales.
 *
 * @param channels — Canales físicos DMX
 * @param wheels   — Rueda de color y motor de mezcla
 * @param physics  — Física del motor (puede influir en detection futura)
 */
export function deriveCapabilitiesUnified(
  channels: readonly FixtureChannel[],
  wheels?: IForgeWheels | null,
  physics?: IForgePhysics | null,
): DerivedCapabilities {
  const base = deriveCapabilities([...channels])

  let colorMixingType: 'rgb' | 'cmy' | 'rgbw' | 'none' = base.colorMixingType
  let hasColorWheel = base.hasColorWheel

  if (wheels) {
    if (wheels.colors.length > 0) {
      hasColorWheel = true
    }
    if (wheels.colorEngine === 'wheel') {
      colorMixingType = 'none'
    } else if (wheels.colorEngine === 'rgb' || wheels.colorEngine === 'cmy' || wheels.colorEngine === 'rgbw') {
      if (colorMixingType === 'none') {
        colorMixingType = wheels.colorEngine
      }
    }
  }

  // physics se reserva para future capabilities (ej. tilt range limits, etc.)
  void physics

  return {
    ...base,
    hasColorWheel,
    colorMixingType,
  }
}
