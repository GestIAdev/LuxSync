/**
 * 🔧 FXT PARSER - Parser de archivos .fxt de FreeStyler
 * 
 * Lee los archivos de fixture de FreeStyler y extrae:
 * - Nombre del fixture
 * - Número de canales DMX
 * - Mapa de canales (qué hace cada canal)
 * - Capabilities (Pan, Tilt, RGB, Gobo, etc.)
 * - Gobos y colores disponibles
 * 
 * Formato .fxt es un archivo de texto plano con estructura específica
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Canal DMX individual
 */
export interface DMXChannel {
  index: number;          // Índice del canal (1-based)
  name: string;           // Nombre del canal (Pan, Tilt, Red, etc.)
  defaultValue: number;   // Valor por defecto (0-255)
  type: ChannelType;      // Tipo de canal
}

/**
 * Tipos de canales soportados
 */
export enum ChannelType {
  // Movimiento
  PAN = 'pan',
  PAN_FINE = 'pan_fine',
  TILT = 'tilt',
  TILT_FINE = 'tilt_fine',
  PAN_TILT_SPEED = 'pan_tilt_speed',
  
  // Intensidad
  DIMMER = 'dimmer',
  STROBE = 'strobe',
  SHUTTER = 'shutter',
  
  // Color
  RED = 'red',
  GREEN = 'green',
  BLUE = 'blue',
  WHITE = 'white',
  AMBER = 'amber',
  UV = 'uv',
  COLOR_WHEEL = 'color_wheel',
  COLOR_MACRO = 'color_macro',
  
  // Gobo
  GOBO_WHEEL = 'gobo_wheel',
  GOBO_ROTATION = 'gobo_rotation',
  GOBO_SHAKE = 'gobo_shake',
  
  // Efectos
  PRISM = 'prism',
  PRISM_ROTATION = 'prism_rotation',
  FOCUS = 'focus',
  ZOOM = 'zoom',
  FROST = 'frost',
  IRIS = 'iris',
  
  // Control
  RESET = 'reset',
  LAMP = 'lamp',
  MACRO = 'macro',
  SPEED = 'speed',
  
  // Genérico
  UNKNOWN = 'unknown',
}

/**
 * Color disponible en la rueda de colores
 */
export interface ColorWheelSlot {
  position: number;       // Posición DMX (0-255)
  name: string;           // Nombre del color
  imagePath?: string;     // Ruta a la imagen (del .fxt)
}

/**
 * Gobo disponible en la rueda de gobos
 */
export interface GoboWheelSlot {
  position: number;       // Posición DMX (0-255)
  name: string;           // Nombre del gobo
  imagePath?: string;     // Ruta a la imagen (del .fxt)
}

/**
 * Capacidades del fixture (qué puede hacer)
 */
export interface FixtureCapabilities {
  // Movimiento
  hasPan: boolean;
  hasTilt: boolean;
  panRange?: number;      // Grados (ej: 540)
  tiltRange?: number;     // Grados (ej: 270)
  hasFinePanTilt: boolean;
  
  // Color
  hasRGB: boolean;
  hasRGBW: boolean;
  hasColorWheel: boolean;
  colorWheelSlots: ColorWheelSlot[];
  
  // Gobo
  hasGoboWheel: boolean;
  hasGoboRotation: boolean;
  goboWheelSlots: GoboWheelSlot[];
  
  // Efectos
  hasPrism: boolean;
  hasFrost: boolean;
  hasFocus: boolean;
  hasZoom: boolean;
  hasIris: boolean;
  
  // Intensidad
  hasDimmer: boolean;
  hasStrobe: boolean;
}

/**
 * Tipo de fixture
 */
export enum FixtureType {
  PAR = 'par',
  MOVING_HEAD_SPOT = 'moving_head_spot',
  MOVING_HEAD_WASH = 'moving_head_wash',
  MOVING_HEAD_BEAM = 'moving_head_beam',
  WASH = 'wash',
  BEAM = 'beam',
  STROBE = 'strobe',
  SCANNER = 'scanner',
  EFFECT = 'effect',
  UNKNOWN = 'unknown',
}

/**
 * Fixture parseado
 */
export interface ParsedFixture {
  // Identificación
  id: string;                   // ID único generado
  name: string;                 // Nombre del fixture
  manufacturer: string;         // Fabricante (de la primera línea)
  type: FixtureType;            // Tipo deducido
  
  // Canales
  channelCount: number;         // Número total de canales
  channels: DMXChannel[];       // Mapa de canales
  
  // Capabilities
  capabilities: FixtureCapabilities;
  
  // Metadata
  sourceFile: string;           // Archivo .fxt original
  comments: string;             // Comentarios del archivo
  imagePath?: string;           // Imagen del fixture
}

/**
 * Parser de archivos .fxt de FreeStyler
 */
export class FXTParser {
  
  /**
   * Parsear un archivo .fxt
   */
  async parseFile(filePath: string): Promise<ParsedFixture> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    return this.parseLines(lines, filePath);
  }
  
  /**
   * Parsear las líneas de un archivo .fxt
   */
  private parseLines(lines: string[], sourceFile: string): ParsedFixture {
    // Línea 0: Fabricante
    const manufacturer = lines[0]?.trim() || 'Unknown';
    
    // Línea 1: Comments: (etiqueta)
    // Línea 2+: Comentarios entre comillas (puede ser multilínea)
    let comments = '';
    let lineIndex = 2;
    while (lineIndex < lines.length && lines[lineIndex]?.includes('"')) {
      comments += lines[lineIndex].replace(/"/g, '').trim() + ' ';
      lineIndex++;
      if (lines[lineIndex - 1]?.endsWith('"')) break;
    }
    comments = comments.trim();
    
    // Siguiente línea: Nombre del fixture
    const name = lines[lineIndex]?.trim() || path.basename(sourceFile, '.fxt');
    lineIndex++;
    
    // Siguiente línea: Número de canales
    const channelCount = parseInt(lines[lineIndex]?.trim() || '0', 10);
    lineIndex++;
    
    // Las siguientes líneas contienen info de gobos, colores, etc.
    // Luego viene el mapa de canales
    
    // Buscar la sección de nombres de canales
    // En el formato .fxt, los nombres de canales aparecen después de varias líneas numéricas
    const channelNames = this.extractChannelNames(lines, channelCount);
    
    // Crear canales con tipos deducidos
    const channels = this.createChannels(channelNames);
    
    // Extraer colores y gobos
    const colorWheelSlots = this.extractColorWheelSlots(lines);
    const goboWheelSlots = this.extractGoboWheelSlots(lines);
    
    // Deducir capabilities
    const capabilities = this.deduceCapabilities(channels, colorWheelSlots, goboWheelSlots);
    
    // Deducir tipo de fixture
    const type = this.deduceFixtureType(capabilities, name);
    
    // Buscar imagen del fixture
    const imagePath = this.extractImagePath(lines);
    
    return {
      id: this.generateId(name, manufacturer),
      name,
      manufacturer,
      type,
      channelCount,
      channels,
      capabilities,
      sourceFile: path.basename(sourceFile),
      comments,
      imagePath,
    };
  }
  
  /**
   * Extraer nombres de canales del archivo
   */
  private extractChannelNames(lines: string[], channelCount: number): string[] {
    const channelNames: string[] = [];
    
    // Buscar líneas que contengan nombres típicos de canales
    const knownChannelNames = [
      'pan', 'tilt', 'dimmer', 'strobe', 'shutter', 'red', 'green', 'blue', 
      'white', 'color', 'gobo', 'prism', 'focus', 'zoom', 'frost', 'iris',
      'reset', 'lamp', 'macro', 'speed', 'cw', 'ww', 'amber', 'uv'
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Si la línea contiene un nombre conocido de canal
      for (const knownName of knownChannelNames) {
        if (line.includes(knownName) && !line.includes('.gif') && !line.includes('.bmp')) {
          // Capitalizar primera letra
          const channelName = lines[i].trim();
          if (channelName.length > 0 && channelName.length < 30) {
            channelNames.push(channelName);
          }
        }
      }
    }
    
    // Si no encontramos suficientes, usar nombres genéricos
    while (channelNames.length < channelCount) {
      channelNames.push(`Channel ${channelNames.length + 1}`);
    }
    
    return channelNames.slice(0, channelCount);
  }
  
  /**
   * Crear objetos de canal con tipos deducidos
   */
  private createChannels(channelNames: string[]): DMXChannel[] {
    return channelNames.map((name, index) => ({
      index: index + 1,
      name,
      defaultValue: 0,
      type: this.deduceChannelType(name),
    }));
  }
  
  /**
   * Deducir tipo de canal por su nombre
   */
  private deduceChannelType(name: string): ChannelType {
    const lowerName = name.toLowerCase();
    
    // Movimiento
    if (lowerName === 'pan' || lowerName === 'pan 8bit') return ChannelType.PAN;
    if (lowerName.includes('pan') && lowerName.includes('16') || lowerName.includes('pan fine')) return ChannelType.PAN_FINE;
    if (lowerName === 'tilt' || lowerName === 'tilt 8bit') return ChannelType.TILT;
    if (lowerName.includes('tilt') && lowerName.includes('16') || lowerName.includes('tilt fine')) return ChannelType.TILT_FINE;
    
    // Intensidad
    if (lowerName === 'dimmer' || lowerName === 'lamp') return ChannelType.DIMMER;
    if (lowerName.includes('strobe')) return ChannelType.STROBE;
    if (lowerName.includes('shutter')) return ChannelType.SHUTTER;
    
    // Color RGB
    if (lowerName === 'red') return ChannelType.RED;
    if (lowerName === 'green') return ChannelType.GREEN;
    if (lowerName === 'blue') return ChannelType.BLUE;
    if (lowerName === 'white' || lowerName === 'ww' || lowerName === 'cw') return ChannelType.WHITE;
    if (lowerName === 'amber') return ChannelType.AMBER;
    if (lowerName === 'uv') return ChannelType.UV;
    if (lowerName.includes('color') && !lowerName.includes('macro')) return ChannelType.COLOR_WHEEL;
    
    // Gobo
    if (lowerName.includes('gobo') && !lowerName.includes('rot')) return ChannelType.GOBO_WHEEL;
    if (lowerName.includes('gobo') && lowerName.includes('rot')) return ChannelType.GOBO_ROTATION;
    
    // Efectos
    if (lowerName.includes('prism') && !lowerName.includes('rot')) return ChannelType.PRISM;
    if (lowerName.includes('prism') && lowerName.includes('rot')) return ChannelType.PRISM_ROTATION;
    if (lowerName.includes('focus')) return ChannelType.FOCUS;
    if (lowerName.includes('zoom')) return ChannelType.ZOOM;
    if (lowerName.includes('frost')) return ChannelType.FROST;
    if (lowerName.includes('iris')) return ChannelType.IRIS;
    
    // Control
    if (lowerName.includes('reset')) return ChannelType.RESET;
    if (lowerName.includes('macro')) return ChannelType.MACRO;
    if (lowerName.includes('speed')) return ChannelType.SPEED;
    
    return ChannelType.UNKNOWN;
  }
  
  /**
   * Extraer slots de la rueda de colores
   */
  private extractColorWheelSlots(lines: string[]): ColorWheelSlot[] {
    const slots: ColorWheelSlot[] = [];
    
    // Buscar patrones de color en el archivo
    const colorPatterns = [
      { regex: /white/i, name: 'White' },
      { regex: /red/i, name: 'Red' },
      { regex: /blue/i, name: 'Blue' },
      { regex: /green/i, name: 'Green' },
      { regex: /yellow/i, name: 'Yellow' },
      { regex: /orange/i, name: 'Orange' },
      { regex: /purple|violet/i, name: 'Purple' },
      { regex: /pink|magenta/i, name: 'Pink' },
      { regex: /cyan/i, name: 'Cyan' },
      { regex: /amber/i, name: 'Amber' },
    ];
    
    let position = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Buscar archivos de imagen de colores
      if (line.includes('color') && (line.includes('.gif') || line.includes('.bmp'))) {
        for (const pattern of colorPatterns) {
          if (pattern.regex.test(line)) {
            slots.push({
              position: position * 20, // Aproximación
              name: pattern.name,
              imagePath: lines[i].trim(),
            });
            position++;
            break;
          }
        }
      }
    }
    
    return slots;
  }
  
  /**
   * Extraer slots de la rueda de gobos
   */
  private extractGoboWheelSlots(lines: string[]): GoboWheelSlot[] {
    const slots: GoboWheelSlot[] = [];
    let position = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Buscar archivos de imagen de gobos
      if ((line.includes('gobo') || line.includes('star') || line.includes('flower') || 
           line.includes('circle') || line.includes('dot') || line.includes('swirl')) && 
          (line.includes('.gif') || line.includes('.bmp'))) {
        slots.push({
          position: position * 20,
          name: `Gobo ${position + 1}`,
          imagePath: lines[i].trim(),
        });
        position++;
      }
    }
    
    return slots;
  }
  
  /**
   * Deducir capabilities del fixture
   */
  private deduceCapabilities(
    channels: DMXChannel[], 
    colorSlots: ColorWheelSlot[],
    goboSlots: GoboWheelSlot[]
  ): FixtureCapabilities {
    const hasChannel = (type: ChannelType) => channels.some(ch => ch.type === type);
    
    return {
      // Movimiento
      hasPan: hasChannel(ChannelType.PAN),
      hasTilt: hasChannel(ChannelType.TILT),
      panRange: hasChannel(ChannelType.PAN) ? 540 : undefined, // Default
      tiltRange: hasChannel(ChannelType.TILT) ? 270 : undefined, // Default
      hasFinePanTilt: hasChannel(ChannelType.PAN_FINE) || hasChannel(ChannelType.TILT_FINE),
      
      // Color
      hasRGB: hasChannel(ChannelType.RED) && hasChannel(ChannelType.GREEN) && hasChannel(ChannelType.BLUE),
      hasRGBW: hasChannel(ChannelType.RED) && hasChannel(ChannelType.GREEN) && 
               hasChannel(ChannelType.BLUE) && hasChannel(ChannelType.WHITE),
      hasColorWheel: hasChannel(ChannelType.COLOR_WHEEL),
      colorWheelSlots: colorSlots,
      
      // Gobo
      hasGoboWheel: hasChannel(ChannelType.GOBO_WHEEL),
      hasGoboRotation: hasChannel(ChannelType.GOBO_ROTATION),
      goboWheelSlots: goboSlots,
      
      // Efectos
      hasPrism: hasChannel(ChannelType.PRISM),
      hasFrost: hasChannel(ChannelType.FROST),
      hasFocus: hasChannel(ChannelType.FOCUS),
      hasZoom: hasChannel(ChannelType.ZOOM),
      hasIris: hasChannel(ChannelType.IRIS),
      
      // Intensidad
      hasDimmer: hasChannel(ChannelType.DIMMER) || hasChannel(ChannelType.SHUTTER),
      hasStrobe: hasChannel(ChannelType.STROBE) || hasChannel(ChannelType.SHUTTER),
    };
  }
  
  /**
   * Deducir tipo de fixture
   */
  private deduceFixtureType(capabilities: FixtureCapabilities, name: string): FixtureType {
    const lowerName = name.toLowerCase();
    
    // Por nombre
    if (lowerName.includes('strobe')) return FixtureType.STROBE;
    if (lowerName.includes('par')) return FixtureType.PAR;
    if (lowerName.includes('wash')) return FixtureType.WASH;
    if (lowerName.includes('beam')) return FixtureType.BEAM;
    if (lowerName.includes('spot')) return FixtureType.MOVING_HEAD_SPOT;
    
    // Por capabilities
    if (capabilities.hasPan && capabilities.hasTilt) {
      if (capabilities.hasGoboWheel) return FixtureType.MOVING_HEAD_SPOT;
      if (capabilities.hasZoom) return FixtureType.MOVING_HEAD_WASH;
      return FixtureType.MOVING_HEAD_BEAM;
    }
    
    if (capabilities.hasRGB && !capabilities.hasPan) return FixtureType.PAR;
    if (capabilities.hasStrobe && !capabilities.hasRGB) return FixtureType.STROBE;
    
    return FixtureType.UNKNOWN;
  }
  
  /**
   * Extraer ruta de imagen del fixture
   */
  private extractImagePath(lines: string[]): string | undefined {
    for (const line of lines) {
      if ((line.includes('.gif') || line.includes('.bmp')) && 
          !line.includes('gobo') && !line.includes('color')) {
        return line.trim();
      }
    }
    return undefined;
  }
  
  /**
   * Generar ID único
   */
  private generateId(name: string, manufacturer: string): string {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const cleanMfr = manufacturer.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `${cleanMfr}_${cleanName}`;
  }
}

/**
 * Cargar todos los fixtures de una carpeta
 */
export async function loadAllFixtures(folderPath: string): Promise<ParsedFixture[]> {
  const parser = new FXTParser();
  const fixtures: ParsedFixture[] = [];
  
  try {
    const files = await fs.readdir(folderPath);
    const fxtFiles = files.filter(f => f.toLowerCase().endsWith('.fxt'));
    
    console.log(`📂 Encontrados ${fxtFiles.length} archivos .fxt en ${folderPath}`);
    
    for (const file of fxtFiles) {
      try {
        const fixture = await parser.parseFile(path.join(folderPath, file));
        fixtures.push(fixture);
        console.log(`  ✅ ${fixture.name} (${fixture.type}, ${fixture.channelCount} canales)`);
      } catch (err) {
        console.log(`  ❌ Error parseando ${file}:`, err);
      }
    }
    
    return fixtures;
  } catch (err) {
    console.error('❌ Error leyendo carpeta de fixtures:', err);
    return [];
  }
}
