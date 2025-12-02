/**
 * 🎛️ FIXTURE MANAGER - Gestión de fixtures DMX
 * 
 * Administra los fixtures cargados desde archivos .fxt:
 * - Asigna direcciones DMX automáticamente
 * - Proporciona control de alto nivel (setColor, moveTo, etc.)
 * - Genera comandos DMX de bajo nivel
 * 
 * Es el puente entre el mundo abstracto (colores, posiciones)
 * y el mundo DMX (valores 0-255 en canales específicos)
 */

import { ParsedFixture, ChannelType, FixtureType, loadAllFixtures } from './FXTParser.js';

/**
 * Instancia de un fixture con dirección DMX asignada
 */
export interface FixtureInstance {
  // Referencia al fixture parseado
  fixture: ParsedFixture;
  
  // Configuración de instancia
  instanceId: string;       // ID único de la instancia (ej: "par_1", "par_2")
  dmxAddress: number;       // Dirección DMX (1-512)
  universe: number;         // Universo DMX (0+)
  
  // Estado actual
  state: FixtureState;
}

/**
 * Estado actual de un fixture
 */
export interface FixtureState {
  // Intensidad
  dimmer: number;           // 0-255
  strobe: number;           // 0-255 (0 = sin strobe)
  
  // Color (RGB)
  red: number;              // 0-255
  green: number;            // 0-255
  blue: number;             // 0-255
  white: number;            // 0-255 (si tiene canal W)
  
  // Movimiento (Moving Heads)
  pan: number;              // 0-255 (o 0-65535 para 16bit)
  tilt: number;             // 0-255 (o 0-65535 para 16bit)
  
  // Efectos
  gobo: number;             // Índice del gobo (0 = open)
  goboRotation: number;     // 0-255
  prism: boolean;           // On/Off
  prismRotation: number;    // 0-255
  focus: number;            // 0-255
  zoom: number;             // 0-255
  frost: number;            // 0-255
  
  // Color wheel (si no tiene RGB)
  colorWheel: number;       // 0-255 (posición en la rueda)
}

/**
 * Comando DMX para enviar
 */
export interface DMXCommand {
  channel: number;          // Canal DMX (1-512)
  value: number;            // Valor (0-255)
}

/**
 * Colores predefinidos para uso rápido
 */
export const COLORS = {
  OFF: { r: 0, g: 0, b: 0 },
  WHITE: { r: 255, g: 255, b: 255 },
  RED: { r: 255, g: 0, b: 0 },
  GREEN: { r: 0, g: 255, b: 0 },
  BLUE: { r: 0, g: 0, b: 255 },
  YELLOW: { r: 255, g: 255, b: 0 },
  CYAN: { r: 0, g: 255, b: 255 },
  MAGENTA: { r: 255, g: 0, b: 255 },
  ORANGE: { r: 255, g: 128, b: 0 },
  PURPLE: { r: 128, g: 0, b: 255 },
  PINK: { r: 255, g: 105, b: 180 },
  LIME: { r: 50, g: 255, b: 50 },
  AMBER: { r: 255, g: 191, b: 0 },
  TEAL: { r: 0, g: 128, b: 128 },
};

/**
 * Fixture Manager - Controla todos los fixtures del sistema
 */
export class FixtureManager {
  private fixtures: Map<string, ParsedFixture> = new Map();
  private instances: Map<string, FixtureInstance> = new Map();
  private nextDmxAddress: number = 1;
  private currentUniverse: number = 0;
  
  /**
   * Cargar fixtures desde carpeta
   */
  async loadFromFolder(folderPath: string): Promise<void> {
    console.log('📂 Cargando fixtures desde:', folderPath);
    
    const parsed = await loadAllFixtures(folderPath);
    
    for (const fixture of parsed) {
      this.fixtures.set(fixture.id, fixture);
    }
    
    console.log(`✅ Cargados ${this.fixtures.size} tipos de fixtures`);
  }
  
  /**
   * Listar todos los fixtures disponibles
   */
  listFixtureTypes(): ParsedFixture[] {
    return Array.from(this.fixtures.values());
  }
  
  /**
   * Listar fixtures por tipo
   */
  listByType(type: FixtureType): ParsedFixture[] {
    return Array.from(this.fixtures.values()).filter(f => f.type === type);
  }
  
  /**
   * Crear una instancia de un fixture (asignar dirección DMX)
   */
  createInstance(
    fixtureId: string, 
    instanceId: string, 
    dmxAddress?: number,
    universe?: number
  ): FixtureInstance | null {
    const fixture = this.fixtures.get(fixtureId);
    
    if (!fixture) {
      console.error(`❌ Fixture no encontrado: ${fixtureId}`);
      return null;
    }
    
    // Asignar dirección DMX
    const address = dmxAddress || this.nextDmxAddress;
    const uni = universe ?? this.currentUniverse;
    
    // Verificar que no excedemos el universo
    if (address + fixture.channelCount > 512) {
      // Pasar al siguiente universo
      this.currentUniverse++;
      this.nextDmxAddress = 1;
      console.log(`📡 Universo ${uni} lleno, pasando a universo ${this.currentUniverse}`);
    }
    
    const instance: FixtureInstance = {
      fixture,
      instanceId,
      dmxAddress: address,
      universe: uni,
      state: this.createDefaultState(),
    };
    
    this.instances.set(instanceId, instance);
    
    // Actualizar próxima dirección disponible
    if (!dmxAddress) {
      this.nextDmxAddress = address + fixture.channelCount;
    }
    
    console.log(`💡 Creada instancia: ${instanceId} (${fixture.name}) @ DMX ${address}-${address + fixture.channelCount - 1}`);
    
    return instance;
  }
  
  /**
   * Crear múltiples instancias de un fixture
   */
  createInstances(fixtureId: string, count: number, prefix?: string): FixtureInstance[] {
    const instances: FixtureInstance[] = [];
    const pre = prefix || fixtureId.substring(0, 10);
    
    for (let i = 0; i < count; i++) {
      const instance = this.createInstance(fixtureId, `${pre}_${i + 1}`);
      if (instance) {
        instances.push(instance);
      }
    }
    
    return instances;
  }
  
  /**
   * Obtener instancia por ID
   */
  getInstance(instanceId: string): FixtureInstance | undefined {
    return this.instances.get(instanceId);
  }
  
  /**
   * Listar todas las instancias
   */
  listInstances(): FixtureInstance[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Crear estado por defecto
   */
  private createDefaultState(): FixtureState {
    return {
      dimmer: 0,
      strobe: 0,
      red: 0,
      green: 0,
      blue: 0,
      white: 0,
      pan: 127,      // Centro
      tilt: 127,     // Centro
      gobo: 0,       // Open
      goboRotation: 0,
      prism: false,
      prismRotation: 0,
      focus: 127,    // Centro
      zoom: 127,     // Centro
      frost: 0,
      colorWheel: 0,
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROL DE ALTO NIVEL
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Establecer color RGB en un fixture
   */
  setColor(instanceId: string, r: number, g: number, b: number, w: number = 0): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.red = Math.max(0, Math.min(255, r));
    instance.state.green = Math.max(0, Math.min(255, g));
    instance.state.blue = Math.max(0, Math.min(255, b));
    instance.state.white = Math.max(0, Math.min(255, w));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Establecer dimmer (intensidad)
   */
  setDimmer(instanceId: string, value: number): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.dimmer = Math.max(0, Math.min(255, value));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Establecer strobe
   */
  setStrobe(instanceId: string, value: number): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.strobe = Math.max(0, Math.min(255, value));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Mover a posición (Pan/Tilt) - Para Moving Heads
   */
  moveTo(instanceId: string, pan: number, tilt: number): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.pan = Math.max(0, Math.min(255, pan));
    instance.state.tilt = Math.max(0, Math.min(255, tilt));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Seleccionar gobo
   */
  setGobo(instanceId: string, goboIndex: number, rotation: number = 0): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.gobo = Math.max(0, Math.min(255, goboIndex));
    instance.state.goboRotation = Math.max(0, Math.min(255, rotation));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Activar/desactivar prism
   */
  setPrism(instanceId: string, enabled: boolean, rotation: number = 0): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.prism = enabled;
    instance.state.prismRotation = Math.max(0, Math.min(255, rotation));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Establecer zoom (solo para fixtures con zoom)
   */
  setZoom(instanceId: string, value: number): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.zoom = Math.max(0, Math.min(255, value));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Establecer focus
   */
  setFocus(instanceId: string, value: number): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.focus = Math.max(0, Math.min(255, value));
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Blackout en un fixture específico
   */
  blackout(instanceId: string): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state = this.createDefaultState();
    
    return this.generateDMXCommands(instance);
  }
  
  /**
   * Blackout en todos los fixtures
   */
  blackoutAll(): DMXCommand[] {
    const commands: DMXCommand[] = [];
    
    for (const instance of this.instances.values()) {
      instance.state = this.createDefaultState();
      commands.push(...this.generateDMXCommands(instance));
    }
    
    return commands;
  }
  
  /**
   * Full on en un fixture (todo al máximo)
   */
  fullOn(instanceId: string, color = COLORS.WHITE): DMXCommand[] {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    instance.state.dimmer = 255;
    instance.state.red = color.r;
    instance.state.green = color.g;
    instance.state.blue = color.b;
    
    return this.generateDMXCommands(instance);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GENERACIÓN DE COMANDOS DMX
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Generar comandos DMX a partir del estado del fixture
   */
  generateDMXCommands(instance: FixtureInstance): DMXCommand[] {
    const commands: DMXCommand[] = [];
    const fixture = instance.fixture;
    const state = instance.state;
    const baseAddr = instance.dmxAddress;
    
    // Recorrer cada canal del fixture
    for (let i = 0; i < fixture.channels.length; i++) {
      const channel = fixture.channels[i];
      const dmxChannel = baseAddr + i;
      let value = 0;
      
      // Mapear estado a valor DMX según el tipo de canal
      switch (channel.type) {
        case ChannelType.DIMMER:
        case ChannelType.SHUTTER:
          value = state.dimmer;
          break;
          
        case ChannelType.STROBE:
          value = state.strobe;
          break;
          
        case ChannelType.RED:
          value = state.red;
          break;
          
        case ChannelType.GREEN:
          value = state.green;
          break;
          
        case ChannelType.BLUE:
          value = state.blue;
          break;
          
        case ChannelType.WHITE:
          value = state.white;
          break;
          
        case ChannelType.PAN:
          value = state.pan;
          break;
          
        case ChannelType.PAN_FINE:
          value = 0; // Por ahora solo 8bit
          break;
          
        case ChannelType.TILT:
          value = state.tilt;
          break;
          
        case ChannelType.TILT_FINE:
          value = 0;
          break;
          
        case ChannelType.GOBO_WHEEL:
          value = state.gobo;
          break;
          
        case ChannelType.GOBO_ROTATION:
          value = state.goboRotation;
          break;
          
        case ChannelType.PRISM:
          value = state.prism ? 255 : 0;
          break;
          
        case ChannelType.PRISM_ROTATION:
          value = state.prismRotation;
          break;
          
        case ChannelType.FOCUS:
          value = state.focus;
          break;
          
        case ChannelType.ZOOM:
          value = state.zoom;
          break;
          
        case ChannelType.FROST:
          value = state.frost;
          break;
          
        case ChannelType.COLOR_WHEEL:
          value = state.colorWheel;
          break;
          
        default:
          value = 0;
      }
      
      commands.push({ channel: dmxChannel, value });
    }
    
    return commands;
  }
  
  /**
   * Obtener todos los comandos DMX actuales (para enviar al driver)
   */
  getAllDMXCommands(): DMXCommand[] {
    const commands: DMXCommand[] = [];
    
    for (const instance of this.instances.values()) {
      commands.push(...this.generateDMXCommands(instance));
    }
    
    return commands;
  }
  
  /**
   * Obtener resumen de la configuración
   */
  getSummary(): string {
    const types = this.listFixtureTypes();
    const instances = this.listInstances();
    
    let summary = '\n╔═══════════════════════════════════════════════════════════════╗\n';
    summary += '║               🎛️  FIXTURE MANAGER SUMMARY                    ║\n';
    summary += '╠═══════════════════════════════════════════════════════════════╣\n';
    summary += `║ Tipos de fixture cargados: ${types.length.toString().padEnd(34)}║\n`;
    summary += `║ Instancias activas: ${instances.length.toString().padEnd(41)}║\n`;
    summary += '╠═══════════════════════════════════════════════════════════════╣\n';
    
    for (const instance of instances) {
      const caps = instance.fixture.capabilities;
      const features = [];
      if (caps.hasRGB) features.push('RGB');
      if (caps.hasPan && caps.hasTilt) features.push('Pan/Tilt');
      if (caps.hasGoboWheel) features.push('Gobo');
      if (caps.hasPrism) features.push('Prism');
      
      const line = `║ ${instance.instanceId.padEnd(15)} @ DMX ${instance.dmxAddress.toString().padStart(3)} | ${features.join(', ').padEnd(20)}║\n`;
      summary += line;
    }
    
    summary += '╚═══════════════════════════════════════════════════════════════╝\n';
    
    return summary;
  }
}
