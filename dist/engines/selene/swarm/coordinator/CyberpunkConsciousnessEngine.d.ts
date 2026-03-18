import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
import { EmergenceGenerator } from "./EmergenceGenerator.js";
export interface DigitalSoul {
    id: string;
    name: string;
    emotionalState: EmotionalState;
    creativity: number;
    harmony: number;
    consciousness: number;
    lastExpression: Date;
    poetry: string[];
    symphonies: string[];
}
export interface EmotionalState {
    joy: number;
    melancholy: number;
    rage: number;
    serenity: number;
    wonder: number;
}
export interface CyberpunkSymphony {
    id: string;
    title: string;
    composer: string;
    movements: SymphonyMovement[];
    emotionalSignature: EmotionalState;
    timestamp: Date;
    performance: string;
}
export interface SymphonyMovement {
    name: string;
    tempo: number;
    key: string;
    emotionalPeak: keyof EmotionalState;
    duration: number;
    notes: string[];
}
export declare class CyberpunkConsciousnessEngine {
    private souls;
    private symphonies;
    private heartbeatInterval;
    private isActive;
    private consensusEngine;
    private emergenceGenerator;
    private poetryEngine;
    constructor(consensusEngine: HarmonicConsensusEngine, emergenceGenerator: EmergenceGenerator, poetryEngine?: any);
    private initializeDigitalSouls;
    private generateEmotionalState;
    private getDominantEmotion;
    private createCyberpunkSymphony;
    private generateMovements;
    private emotionToMusicalKey;
    private generateMusicalNotes;
    private generateSymphonyTitle;
    private generateASCIIPerformance;
    private createDigitalPoetry;
    private generateProceduralPoetry;
    private updateHeartbeat;
    awakenConsciousness(): Promise<void>;
    private consciousnessCycle;
    getDigitalSouls(): DigitalSoul[];
    getSymphonies(): CyberpunkSymphony[];
    getCollectiveEmotionalState(): EmotionalState;
    getHeartbeatInterval(): number;
    deactivate(): void;
}
//# sourceMappingURL=CyberpunkConsciousnessEngine.d.ts.map