/**
 * 🎸⚡ LUXSYNC ENGINE - INDEX
 *
 * Motor principal de sincronización música-luz
 * - Audio → Light mapping
 * - Scene generation
 * - Evolution & learning
 * - Show recording
 */
import type { AudioFrame } from '../audio/index.js';
export interface LightScene {
    id: string;
    name: string;
    timestamp: number;
    fixtures: {
        id: string;
        channels: number[];
    }[];
    audioContext: {
        bpm: number;
        bass: number;
        mid: number;
        treble: number;
        beat: boolean;
    };
    seed: number;
    rating?: number;
}
export declare class LuxSyncEngine {
    initialize(): Promise<void>;
    generateScene(audioFrame: AudioFrame): Promise<LightScene>;
    evolveScene(scene: LightScene, rating: number): Promise<LightScene>;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map