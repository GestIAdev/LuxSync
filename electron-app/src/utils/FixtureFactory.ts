import { FixtureDefinition, ChannelType } from '../types/FixtureDefinition';

export class FixtureFactory {
  private static generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static createEmpty(): FixtureDefinition {
    return {
      id: this.generateUUID(),
      name: '',
      manufacturer: '',
      type: 'Moving Head',
      channels: []
    };
  }

  static validate(def: FixtureDefinition): boolean {
    return (
      def.name.trim().length > 0 &&
      def.channels.length > 0
    );
  }

  static generateChannels(count: number, existingChannels: FixtureDefinition['channels'] = []): FixtureDefinition['channels'] {
    const channels: FixtureDefinition['channels'] = [];
    for (let i = 0; i < count; i++) {
      if (existingChannels[i]) {
        channels.push(existingChannels[i]);
      } else {
        channels.push({
          index: i + 1,
          type: 'unknown' as ChannelType,
          name: '',
          defaultValue: 0,
          is16bit: false
        });
      }
    }
    return channels;
  }

  static getChannelTypes(): ChannelType[] {
    return [
      'dimmer',
      'strobe',
      'shutter',
      'red',
      'green',
      'blue',
      'white',
      'amber',
      'uv',
      'pan',
      'pan_fine',
      'tilt',
      'tilt_fine',
      'color_wheel',
      'gobo',
      'prism',
      'focus',
      'zoom',
      'speed',
      'macro',
      'control',
      'unknown'
    ];
  }

  static getChannelLabel(type: ChannelType): string {
    const labels: Record<ChannelType, string> = {
      'dimmer': 'Dimmer',
      'strobe': 'Strobe',
      'shutter': 'Shutter',
      'red': 'Red',
      'green': 'Green',
      'blue': 'Blue',
      'white': 'White',
      'amber': 'Amber',
      'uv': 'UV',
      'pan': 'Pan',
      'pan_fine': 'Pan Fine',
      'tilt': 'Tilt',
      'tilt_fine': 'Tilt Fine',
      'color_wheel': 'Color Wheel',
      'gobo': 'Gobo',
      'prism': 'Prism',
      'focus': 'Focus',
      'zoom': 'Zoom',
      'speed': 'Speed',
      'macro': 'Macro',
      'control': 'Control',
      'unknown': 'Unknown'
    };
    return labels[type] || type;
  }

  static getChannelColor(type: ChannelType): string {
    const colors: Record<string, string> = {
      'dimmer': '#ffffff',
      'shutter': '#e0e0e0',
      'strobe': '#ffeb3b',
      'red': '#ff3366',
      'green': '#00ff88',
      'blue': '#3366ff',
      'white': '#ffffff',
      'amber': '#ffaa00',
      'uv': '#bb00ff',
      'pan': '#00d4ff',
      'pan_fine': '#0099cc',
      'tilt': '#00d4ff',
      'tilt_fine': '#0099cc',
      'color_wheel': '#ff00ff',
      'gobo': '#aa00ff',
      'prism': '#dd00ff',
      'focus': '#00ffcc',
      'zoom': '#00ffcc',
      'speed': '#ffeb3b',
      'macro': '#00ff44',
      'control': '#00ff44',
      'unknown': '#666666'
    };
    return colors[type] || '#666666';
  }

  static getChannelCategory(type: ChannelType): string {
    const categories: Record<string, string> = {
      'dimmer': 'intensity',
      'shutter': 'intensity',
      'strobe': 'intensity',
      'red': 'color',
      'green': 'color',
      'blue': 'color',
      'white': 'color',
      'amber': 'color',
      'uv': 'color',
      'color_wheel': 'color',
      'pan': 'position',
      'pan_fine': 'position',
      'tilt': 'position',
      'tilt_fine': 'position',
      'gobo': 'beam',
      'prism': 'beam',
      'focus': 'beam',
      'zoom': 'beam',
      'speed': 'control',
      'macro': 'control',
      'control': 'control'
    };
    return categories[type] || 'control';
  }
}
