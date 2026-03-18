/**
 * TerminalVisualizer.ts
 * 🎨 Visualizador de luces DMX en terminal con colores ANSI
 *
 * Muestra en tiempo real el estado de fixtures virtuales
 * usando códigos de escape ANSI para colores RGB
 */
import { DMXUniverse } from './VirtualDMXDriver.js';
export interface VisualizerConfig {
    fixtureCount: number;
    channelsPerFixture: number;
    refreshRate: number;
    showBars: boolean;
    showHex: boolean;
}
export interface FixtureState {
    id: number;
    channels: number[];
    rgb: {
        r: number;
        g: number;
        b: number;
    };
}
/**
 * Visualizador de luces DMX en terminal
 */
export declare class TerminalVisualizer {
    private config;
    private lastUpdate;
    private frameCount;
    constructor(config?: Partial<VisualizerConfig>);
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
    }): void;
    /**
     * Imprime el header con info del sistema
     */
    private printHeader;
    /**
     * Extrae fixtures del universo DMX
     */
    private extractFixtures;
    /**
     * Imprime los fixtures con colores ANSI
     */
    private printFixtures;
    /**
     * Imprime uno o dos fixtures lado a lado
     */
    private printFixture;
    /**
     * Genera un bloque de color ANSI con el RGB especificado
     * Retorna: { block: string, visualLength: number }
     */
    private getColorBlock;
    /**
     * Convierte RGB a hex
     */
    private rgbToHex;
    /**
     * Imprime información de audio (beat, BPM, frecuencias)
     */
    private printAudioInfo;
    /**
     * Crea una barra de progreso ASCII
     */
    private createBar;
    /**
     * Imprime el footer con controles
     */
    private printFooter;
    /**
     * Muestra un mensaje de bienvenida
     */
    showWelcome(): void;
}
//# sourceMappingURL=TerminalVisualizer.d.ts.map