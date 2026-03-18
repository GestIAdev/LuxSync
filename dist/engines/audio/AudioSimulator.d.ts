/**
 * AudioSimulator.ts
 * 🎵 Simulador de audio para testing sin micrófono
 *
 * Genera beats y frecuencias sintéticas para probar
 * la sincronización de luces sin hardware de audio
 */
import { AudioFrame } from './index.js';
export declare class AudioSimulator {
    private startTime;
    private bpm;
    private beatInterval;
    private lastBeatTime;
    constructor(bpm?: number);
    /**
     * Genera un frame de audio sintético
     */
    getFrame(): Promise<AudioFrame>;
    /**
     * Cambia el BPM de la simulación
     */
    setBPM(bpm: number): void;
    /**
     * Reinicia el simulador
     */
    reset(): void;
}
//# sourceMappingURL=AudioSimulator.d.ts.map