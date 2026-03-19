// ═══════════════════════════════════════════════════════════════════════════
// WAVE 2084: UNIVERSAL CHANNEL DNA
// Soporta desde movers clásicos hasta ingenios alienígenas (fans, lasers, FX)
// ═══════════════════════════════════════════════════════════════════════════
export type ChannelType = 
  // INTENSITY
  | 'dimmer'
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
  // CONTROL
  | 'speed'
  | 'macro'
  | 'control'
  // 🔥 WAVE 2084: INGENIOS — Canales para dispositivos no convencionales
  | 'rotation'    // Rotación continua (bolas de espejos, scanners rotativos, etc.)
  | 'custom'      // Canal libre definido por el usuario (fans, heaters, fog, etc.)
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
  }
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
}

// WAVE 390.6: Import InstallationOrientation from ShowFileV2 for type consistency
import type { InstallationOrientation } from '../core/stage/ShowFileV2'

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

// 🎨 WAVE 1006: Color Wheel Definition (compatible with HAL's FixtureProfiles.ts)
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

export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  type: FixtureType;  // WAVE 1120: Strict enum instead of free string
  channels: FixtureChannel[];
  
  // 🎡 WAVE 1112: THE WHEELSMITH - Root level wheel colors for JSON export
  wheels?: {
    colors: WheelColor[];
  };
  
  // WAVE 388 + 390.5: Extended metadata for persistence
  physics?: {
    motorType: 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro';
    maxAcceleration: number;
    maxVelocity?: number;
    safetyCap: number | boolean;
    // WAVE 390.6: Use proper InstallationOrientation type
    orientation?: InstallationOrientation;
    invertPan?: boolean;
    invertTilt?: boolean;
    swapPanTilt?: boolean;
    homePosition?: { pan: number; tilt: number };
    tiltLimits?: { min: number; max: number };
  };
  capabilities?: {
    hasPan?: boolean;
    hasTilt?: boolean;
    hasColorMixing?: boolean;
    hasColorWheel?: boolean;
    hasGobo?: boolean;
    hasPrism?: boolean;
    hasStrobe?: boolean;
    hasDimmer?: boolean;
    // 🎨 WAVE 1002: Explicit color engine type (overrides auto-detection)
    colorEngine?: ColorEngineType;
    // 🎨 WAVE 1006: THE WHEELSMITH - Mapa físico de la rueda de colores
    colorWheel?: ColorWheelDefinition;
    // 🔥 WAVE 2084: INGENIOS capabilities
    hasRotation?: boolean;
    hasCustomChannels?: boolean;
    hasMacro?: boolean;
    // 🔥 WAVE 1135.3: Dead Zone floor — valor DMX mínimo donde el dimmer realmente enciende
    dimmerMin?: number;
  };
}
