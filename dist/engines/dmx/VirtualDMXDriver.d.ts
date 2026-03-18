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
    universeSize: number;
    updateRate: number;
    logUpdates: boolean;
}
export interface DMXUniverse {
    channels: Uint8Array;
    timestamp: number;
    frameCount: number;
}
/**
 * Driver DMX virtual para desarrollo
 * Emite eventos 'update' cada vez que se actualiza el universo
 */
export declare class VirtualDMXDriver extends EventEmitter {
    private config;
    private universe;
    private isRunning;
    private updateInterval;
    constructor(config?: Partial<VirtualDMXConfig>);
    /**
     * Inicializa el driver virtual
     */
    initialize(): Promise<void>;
    /**
     * Envía un paquete DMX al universo virtual
     * @param startChannel Canal de inicio (1-512, DMX usa indexación 1-based)
     * @param values Valores a escribir (0-255)
     */
    sendDMX(startChannel: number, values: number[]): void;
    /**
     * Establece un canal específico a un valor
     */
    setChannel(channel: number, value: number): void;
    /**
     * Obtiene el valor actual de un canal
     * @param channel Canal (1-512)
     */
    getChannel(channel: number): number;
    /**
     * Obtiene una copia del universo completo
     */
    getUniverse(): DMXUniverse;
    /**
     * Blackout - Apaga todas las luces (todos los canales a 0)
     */
    blackout(): void;
    /**
     * Whiteout - Todas las luces al máximo
     */
    whiteout(): void;
    /**
     * Test pattern - Patrón de prueba alternado
     */
    testPattern(): void;
    /**
     * Rainbow test - Ciclo RGB en los primeros 12 canales (4 fixtures RGB)
     */
    rainbowTest(duration?: number): Promise<void>;
    /**
     * Convierte HSV a RGB (para efectos de color)
     */
    private hsvToRgb;
    /**
     * Habilita/deshabilita logging de actualizaciones
     */
    setLogging(enabled: boolean): void;
    /**
     * Obtiene estadísticas del driver
     */
    getStats(): {
        frameCount: number;
        uptime: number;
        fps: number;
        channelsActive: number;
    };
    /**
     * Cierra el driver virtual
     */
    close(): Promise<void>;
}
//# sourceMappingURL=VirtualDMXDriver.d.ts.map