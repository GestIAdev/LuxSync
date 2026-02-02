export type ChannelType = 
  | 'dimmer'
  | 'strobe'
  | 'shutter'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'amber'
  | 'uv'
  | 'pan'
  | 'pan_fine'
  | 'tilt'
  | 'tilt_fine'
  | 'color_wheel'
  | 'gobo'
  | 'prism'
  | 'focus'
  | 'zoom'
  | 'speed'
  | 'macro'
  | 'control'
  | 'unknown';

export interface FixtureChannel {
  index: number;
  name: string;
  type: ChannelType;
  defaultValue: number;
  is16bit: boolean;
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
  type: string;
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
  };
}
