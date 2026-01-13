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

export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  type: string;
  channels: FixtureChannel[];
  // WAVE 388: Extended metadata for persistence
  physics?: {
    motorType: 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro';
    maxAcceleration: number;
    safetyCap: number | boolean; // Can be boolean (on/off) or number (percentage)
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
