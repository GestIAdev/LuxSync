/**
 * TerminalVisualizer.ts
 * 🎨 Visualizador de luces DMX en terminal con colores ANSI
 * 
 * Muestra en tiempo real el estado de fixtures virtuales
 * usando códigos de escape ANSI para colores RGB
 */

import { DMXUniverse } from './VirtualDMXDriver.js';

export interface VisualizerConfig {
  fixtureCount: number;       // Número de fixtures a visualizar
  channelsPerFixture: number; // Canales por fixture (3=RGB, 4=RGBW, etc)
  refreshRate: number;        // Hz (actualizaciones por segundo)
  showBars: boolean;          // Mostrar barras de intensidad
  showHex: boolean;           // Mostrar valores hexadecimales
}

export interface FixtureState {
  id: number;
  channels: number[];         // Valores DMX de este fixture
  rgb: { r: number; g: number; b: number }; // Color RGB resultante
}

/**
 * Visualizador de luces DMX en terminal
 */
export class TerminalVisualizer {
  private config: VisualizerConfig;
  private lastUpdate: number = 0;
  private frameCount: number = 0;

  constructor(config: Partial<VisualizerConfig> = {}) {
    this.config = {
      fixtureCount: config.fixtureCount || 4,
      channelsPerFixture: config.channelsPerFixture || 3, // RGB por defecto
      refreshRate: config.refreshRate || 10, // 10 FPS en terminal
      showBars: config.showBars !== false,
      showHex: config.showHex !== false,
    };
  }

  /**
   * Renderiza el universo DMX en terminal
   */
  render(universe: DMXUniverse, audioData?: {
    beat: boolean;
    beatStrength: number;
    bpm: number;
    bass: number;
    mid: number;
    treble: number;
    rms: number;
  }): void {
    // Rate limiting
    const now = Date.now();
    const minInterval = 1000 / this.config.refreshRate;
    if (now - this.lastUpdate < minInterval) {
      return;
    }
    this.lastUpdate = now;
    this.frameCount++;

    // Clear terminal (mover cursor a inicio sin limpiar todo)
    process.stdout.write('\x1B[2J\x1B[H');

    // Header
    this.printHeader(universe);

    // Fixtures
    const fixtures = this.extractFixtures(universe);
    this.printFixtures(fixtures);

    // Audio info (si está disponible)
    if (audioData) {
      this.printAudioInfo(audioData);
    }

    // Footer
    this.printFooter();
  }

  /**
   * Imprime el header con info del sistema
   */
  private printHeader(universe: DMXUniverse): void {
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              🎸⚡ LUXSYNC - VIRTUAL DMX VISUALIZER ⚡🎸                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  📊 Frame: ${universe.frameCount.toString().padStart(6, '0')}  |  ⏱️  ${new Date(universe.timestamp).toLocaleTimeString()}`);
    console.log('');
  }

  /**
   * Extrae fixtures del universo DMX
   */
  private extractFixtures(universe: DMXUniverse): FixtureState[] {
    const fixtures: FixtureState[] = [];

    for (let i = 0; i < this.config.fixtureCount; i++) {
      const baseChannel = i * this.config.channelsPerFixture;
      const channels: number[] = [];

      // Extraer canales del fixture
      for (let c = 0; c < this.config.channelsPerFixture; c++) {
        const channelIndex = baseChannel + c;
        channels.push(channelIndex < universe.channels.length ? universe.channels[channelIndex] : 0);
      }

      // Asumir RGB para los primeros 3 canales
      const rgb = {
        r: channels[0] || 0,
        g: channels[1] || 0,
        b: channels[2] || 0,
      };

      fixtures.push({
        id: i + 1,
        channels,
        rgb,
      });
    }

    return fixtures;
  }

  /**
   * Imprime los fixtures con colores ANSI
   */
  private printFixtures(fixtures: FixtureState[]): void {
    console.log('  ┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('  │                           💡 FIXTURES 💡                                │');
    console.log('  └─────────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Imprimir en grid 2x2
    const rows = Math.ceil(fixtures.length / 2);
    
    for (let row = 0; row < rows; row++) {
      const fixture1 = fixtures[row * 2];
      const fixture2 = fixtures[row * 2 + 1];

      if (fixture1) {
        this.printFixture(fixture1, fixture2);
      }
      
      console.log('');
    }
  }

  /**
   * Imprime uno o dos fixtures lado a lado
   */
  private printFixture(fixture1: FixtureState, fixture2?: FixtureState): void {
    const width = 30;

    // Línea superior
    let line1 = `  ┌${'─'.repeat(width)}┐`;
    if (fixture2) {
      line1 += `    ┌${'─'.repeat(width)}┐`;
    }
    console.log(line1);

    // Nombre del fixture
    let line2 = `  │ 💡 PAR ${fixture1.id.toString().padEnd(width - 8, ' ')}│`;
    if (fixture2) {
      line2 += `    │ 💡 PAR ${fixture2.id.toString().padEnd(width - 8, ' ')}│`;
    }
    console.log(line2);

    // Separador
    let line3 = `  ├${'─'.repeat(width)}┤`;
    if (fixture2) {
      line3 += `    ├${'─'.repeat(width)}┤`;
    }
    console.log(line3);

    // Color RGB (bloque visual)
    const colorBlock1 = this.getColorBlock(fixture1.rgb);
    let line4 = `  │ ${colorBlock1.block}${' '.repeat(width - colorBlock1.visualLength - 1)}│`;
    
    if (fixture2) {
      const colorBlock2 = this.getColorBlock(fixture2.rgb);
      line4 += `    │ ${colorBlock2.block}${' '.repeat(width - colorBlock2.visualLength - 1)}│`;
    }
    console.log(line4);

    // Valores RGB
    let line5 = `  │ R:${fixture1.rgb.r.toString().padStart(3, ' ')} G:${fixture1.rgb.g.toString().padStart(3, ' ')} B:${fixture1.rgb.b.toString().padStart(3, ' ')}${' '.repeat(width - 18)}│`;
    if (fixture2) {
      line5 += `    │ R:${fixture2.rgb.r.toString().padStart(3, ' ')} G:${fixture2.rgb.g.toString().padStart(3, ' ')} B:${fixture2.rgb.b.toString().padStart(3, ' ')}${' '.repeat(width - 18)}│`;
    }
    console.log(line5);

    // Hex
    if (this.config.showHex) {
      const hex1 = `#${this.rgbToHex(fixture1.rgb)}`;
      let line6 = `  │ ${hex1}${' '.repeat(width - hex1.length - 1)}│`;
      
      if (fixture2) {
        const hex2 = `#${this.rgbToHex(fixture2.rgb)}`;
        line6 += `    │ ${hex2}${' '.repeat(width - hex2.length - 1)}│`;
      }
      console.log(line6);
    }

    // Línea inferior
    let line7 = `  └${'─'.repeat(width)}┘`;
    if (fixture2) {
      line7 += `    └${'─'.repeat(width)}┘`;
    }
    console.log(line7);
  }

  /**
   * Genera un bloque de color ANSI con el RGB especificado
   * Retorna: { block: string, visualLength: number }
   */
  private getColorBlock(rgb: { r: number; g: number; b: number }): { block: string; visualLength: number } {
    // Código ANSI para RGB: \x1b[38;2;R;G;Bm para foreground
    // \x1b[48;2;R;G;Bm para background
    const bgColor = `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
    const reset = '\x1b[0m';
    
    const visualLength = 16; // Longitud visual (sin contar códigos ANSI)
    const block = `${bgColor}${' '.repeat(visualLength)}${reset}`;
    
    return { block, visualLength };
  }

  /**
   * Convierte RGB a hex
   */
  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    return `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  /**
   * Imprime información de audio (beat, BPM, frecuencias)
   */
  private printAudioInfo(audio: {
    beat: boolean;
    beatStrength: number;
    bpm: number;
    bass: number;
    mid: number;
    treble: number;
    rms: number;
  }): void {
    console.log('  ┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('  │                           🎵 AUDIO ANALYSIS 🎵                          │');
    console.log('  └─────────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Beat indicator
    const beatIcon = audio.beat ? '🥁 BEAT!' : '⚪ ----';
    const beatBar = this.createBar(audio.beatStrength, 20);
    console.log(`  ${beatIcon}  ${beatBar} ${(audio.beatStrength * 100).toFixed(0)}%`);
    console.log('');

    // BPM
    console.log(`  🎼 BPM: ${audio.bpm.toString().padStart(3, ' ')} beats/min`);
    console.log('');

    // Frequency bands
    const bassBar = this.createBar(audio.bass, 20);
    const midBar = this.createBar(audio.mid, 20);
    const trebleBar = this.createBar(audio.treble, 20);
    const rmsBar = this.createBar(audio.rms, 20);

    console.log(`  🔊 BASS:   ${bassBar} ${(audio.bass * 100).toFixed(0)}%`);
    console.log(`  🎹 MID:    ${midBar} ${(audio.mid * 100).toFixed(0)}%`);
    console.log(`  🎺 TREBLE: ${trebleBar} ${(audio.treble * 100).toFixed(0)}%`);
    console.log(`  📢 RMS:    ${rmsBar} ${(audio.rms * 100).toFixed(0)}%`);
    console.log('');
  }

  /**
   * Crea una barra de progreso ASCII
   */
  private createBar(value: number, length: number): string {
    const filled = Math.round(value * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Imprime el footer con controles
   */
  private printFooter(): void {
    console.log('  ┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('  │  🎛️  Presiona Ctrl+C para detener                                       │');
    console.log('  └─────────────────────────────────────────────────────────────────────────┘');
  }

  /**
   * Muestra un mensaje de bienvenida
   */
  showWelcome(): void {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                           ║');
    console.log('║               🎸⚡ LUXSYNC VIRTUAL VISUALIZER INICIADO ⚡🎸              ║');
    console.log('║                                                                           ║');
    console.log('║         Simulación de luces DMX sin hardware - Modo desarrollo           ║');
    console.log('║                                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  ✨ Fixtures virtuales: ' + this.config.fixtureCount);
    console.log('  🔧 Canales por fixture: ' + this.config.channelsPerFixture);
    console.log('  🎬 Refresh rate: ' + this.config.refreshRate + ' FPS');
    console.log('');
    console.log('  Iniciando visualización...');
    console.log('');
  }
}
