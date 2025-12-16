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
}
