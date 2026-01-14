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

export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  type: string;
  channels: FixtureChannel[];
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
  };
}
