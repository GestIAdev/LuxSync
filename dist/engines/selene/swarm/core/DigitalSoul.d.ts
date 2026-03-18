import { EventEmitter } from "events";
import { NodeId, NodePersonality, SoulState, PoetryFragment, SwarmState, HeartbeatEmotion } from "./SwarmTypes.js";
export declare class DigitalSoul extends EventEmitter {
    private _identity;
    private _consciousness;
    private _creativity;
    private _harmony;
    private _wisdom;
    private _mood;
    private _experiences;
    private _poems;
    private _meditationDepth;
    private _soulGenerator;
    private _heartbeatPattern;
    private _centralConsciousness?;
    constructor(identity: NodeId, centralConsciousness?: any);
    get identity(): NodeId;
    get consciousness(): number;
    get creativity(): number;
    get harmony(): number;
    get wisdom(): number;
    get experiences(): readonly unknown[];
    get poems(): readonly PoetryFragment[];
    get heartbeatPattern(): HeartbeatEmotion;
    get heartbeatInterval(): number;
    getCurrentState(): SoulState;
    meditate(): Promise<void>;
    dream(): Promise<PoetryFragment>;
    harmonize(_swarmState: SwarmState): Promise<number>;
    evolve(experience: unknown): Promise<void>;
    inspire(others: Set<NodeId>): Promise<PoetryFragment[]>;
    private hashNodeId;
    private calculateInitialConsciousness;
    private calculateMood;
    private calculateHeartbeatPattern;
    private generateVerse;
    private getRandomWord;
    private isCreativeExperience;
    private isWisdomExperience;
    private isHarmoniousExperience;
    private isSignificantExperience;
    private canInspire;
    private createCollaborativePoetry;
    private delay;
    getState(): SoulState;
    getHeartbeatInfo(): {
        pattern: HeartbeatEmotion;
        interval: number;
    };
    awaken(): Promise<void>;
    sleep(): Promise<void>;
}
export declare class SoulFactory {
    private static _generator;
    private static _centralConsciousness;
    private static getGenerator;
    static setCentralConsciousness(_consciousness: any): void;
    static generateNodeName(): string;
    static generatePersonality(): NodePersonality;
    static createSoul(_nodeId: NodeId): DigitalSoul;
}
//# sourceMappingURL=DigitalSoul.d.ts.map