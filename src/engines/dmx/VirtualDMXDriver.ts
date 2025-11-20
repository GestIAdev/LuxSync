/**
 * VirtualDMXDriver.ts
 * 🎨 Simulador de DMX para desarrollo sin hardware
 * 
 * Simula un universo DMX512 (512 canales) y permite
 * visualizar los valores en terminal antes de enviar
 * a hardware real (TORNADO USB)
 */

import { EventEmitter } from 'events';

export interface VirtualDMXConfig {
  universeSize: number;       // 512 para DMX512 estándar
  updateRate: number;         // Hz (típicamente 44Hz para DMX)
  logUpdates: boolean;        // Log cada actualización (debug)
}

export interface DMXUniverse {
  channels: Uint8Array;       // 512 bytes (0-255 cada uno)
  timestamp: number;          // Última actualización
  frameCount: number;         // Contador de frames enviados
}

/**
 * Driver DMX virtual para desarrollo
 * Emite eventos 'update' cada vez que se actualiza el universo
 */
export class VirtualDMXDriver extends EventEmitter {
  private config: VirtualDMXConfig;
  private universe: DMXUniverse;
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<VirtualDMXConfig> = {}) {
    super();
    
    this.config = {
      universeSize: config.universeSize || 512,
      updateRate: config.updateRate || 44, // 44 Hz = ~23ms refresh
      logUpdates: config.logUpdates !== false,
    };

    // Inicializar universo DMX (todo en 0)
    this.universe = {
      channels: new Uint8Array(this.config.universeSize),
      timestamp: Date.now(),
      frameCount: 0,
    };
  }

  /**
   * Inicializa el driver virtual
   */
  async initialize(): Promise<void> {
    console.log('🎨 [VirtualDMX] Inicializando driver virtual...');
    console.log(`   Universo: ${this.config.universeSize} canales`);
    console.log(`   Refresh: ${this.config.updateRate} Hz (~${Math.round(1000 / this.config.updateRate)}ms)`);

    // Blackout inicial (todos los canales a 0)
    this.blackout();

    this.isRunning = true;
    console.log('✅ [VirtualDMX] Driver virtual listo (modo simulación)');
  }

  /**
   * Envía un paquete DMX al universo virtual
   * @param startChannel Canal de inicio (1-512, DMX usa indexación 1-based)
   * @param values Valores a escribir (0-255)
   */
  sendDMX(startChannel: number, values: number[]): void {
    if (!this.isRunning) {
      console.warn('⚠️  [VirtualDMX] Driver no inicializado');
      return;
    }

    // Validar canal de inicio
    if (startChannel < 1 || startChannel > this.config.universeSize) {
      console.error(`❌ [VirtualDMX] Canal inválido: ${startChannel}`);
      return;
    }

    // Convertir a índice 0-based
    const channelIndex = startChannel - 1;

    // Escribir valores en el universo
    for (let i = 0; i < values.length; i++) {
      const targetIndex = channelIndex + i;
      
      if (targetIndex >= this.config.universeSize) {
        console.warn(`⚠️  [VirtualDMX] Overflow: Canal ${targetIndex + 1} fuera de rango`);
        break;
      }

      // Clamp valores entre 0-255
      this.universe.channels[targetIndex] = Math.max(0, Math.min(255, values[i]));
    }

    // Actualizar metadata
    this.universe.timestamp = Date.now();
    this.universe.frameCount++;

    // Log si está habilitado
    if (this.config.logUpdates) {
      const channelRange = values.length === 1 
        ? `${startChannel}`
        : `${startChannel}-${startChannel + values.length - 1}`;
      
      console.log(`💡 [VirtualDMX] CH ${channelRange}: [${values.join(', ')}]`);
    }

    // Emitir evento de actualización
    this.emit('update', { ...this.universe });
  }

  /**
   * Establece un canal específico a un valor
   */
  setChannel(channel: number, value: number): void {
    this.sendDMX(channel, [value]);
  }

  /**
   * Obtiene el valor actual de un canal
   * @param channel Canal (1-512)
   */
  getChannel(channel: number): number {
    if (channel < 1 || channel > this.config.universeSize) {
      return 0;
    }
    return this.universe.channels[channel - 1];
  }

  /**
   * Obtiene una copia del universo completo
   */
  getUniverse(): DMXUniverse {
    return {
      channels: new Uint8Array(this.universe.channels), // Copiar array
      timestamp: this.universe.timestamp,
      frameCount: this.universe.frameCount,
    };
  }

  /**
   * Blackout - Apaga todas las luces (todos los canales a 0)
   */
  blackout(): void {
    this.universe.channels.fill(0);
    this.universe.timestamp = Date.now();
    console.log('🌑 [VirtualDMX] BLACKOUT - Todos los canales a 0');
    this.emit('blackout');
  }

  /**
   * Whiteout - Todas las luces al máximo
   */
  whiteout(): void {
    this.universe.channels.fill(255);
    this.universe.timestamp = Date.now();
    console.log('☀️  [VirtualDMX] WHITEOUT - Todos los canales a 255');
    this.emit('whiteout');
  }

  /**
   * Test pattern - Patrón de prueba alternado
   */
  testPattern(): void {
    for (let i = 0; i < this.config.universeSize; i++) {
      this.universe.channels[i] = i % 2 === 0 ? 255 : 0;
    }
    this.universe.timestamp = Date.now();
    console.log('🔲 [VirtualDMX] TEST PATTERN - Patrón alternado');
    this.emit('testPattern');
  }

  /**
   * Rainbow test - Ciclo RGB en los primeros 12 canales (4 fixtures RGB)
   */
  async rainbowTest(duration: number = 5000): Promise<void> {
    console.log('🌈 [VirtualDMX] RAINBOW TEST - Iniciando...');
    
    const startTime = Date.now();
    const step = 50; // ms entre actualizaciones
    
    while (Date.now() - startTime < duration) {
      const progress = (Date.now() - startTime) / duration;
      const hue = progress * 360; // 0-360 grados
      
      // Convertir HSV a RGB
      const rgb = this.hsvToRgb(hue, 1.0, 1.0);
      
      // Aplicar a los primeros 4 fixtures (asumiendo RGB por fixture)
      for (let fixture = 0; fixture < 4; fixture++) {
        const baseChannel = fixture * 3 + 1; // CH1-3, CH4-6, CH7-9, CH10-12
        this.sendDMX(baseChannel, [rgb.r, rgb.g, rgb.b]);
      }
      
      await new Promise(resolve => setTimeout(resolve, step));
    }
    
    this.blackout();
    console.log('✅ [VirtualDMX] Rainbow test completado');
  }

  /**
   * Convierte HSV a RGB (para efectos de color)
   */
  private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  /**
   * Habilita/deshabilita logging de actualizaciones
   */
  setLogging(enabled: boolean): void {
    this.config.logUpdates = enabled;
    console.log(`🔧 [VirtualDMX] Logging ${enabled ? 'habilitado' : 'deshabilitado'}`);
  }

  /**
   * Obtiene estadísticas del driver
   */
  getStats() {
    return {
      frameCount: this.universe.frameCount,
      uptime: Date.now() - (this.universe.timestamp - this.universe.frameCount * (1000 / this.config.updateRate)),
      fps: this.config.updateRate,
      channelsActive: Array.from(this.universe.channels).filter(v => v > 0).length,
    };
  }

  /**
   * Cierra el driver virtual
   */
  async close(): Promise<void> {
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.blackout();
    console.log('🛑 [VirtualDMX] Driver virtual cerrado');
  }
}
