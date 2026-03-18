import { NodePersonality } from "./SwarmTypes.js";
export interface ProceduralConfig {
    complexity: number;
    creativity: number;
    harmony: number;
    seed?: string;
}
export declare class ProceduralSoulGenerator {
    private vitals;
    private config;
    constructor(config?: ProceduralConfig);
    generateName(_seed?: string): string;
    generatePersonality(_seed?: string): NodePersonality;
    generateInspiration(_seed?: string): string;
    generateVerse(_inspiration: string, _seed?: string): string;
    generateWord(category: string, _seed?: string): string;
    updateConfig(_newConfig: Partial<ProceduralConfig>): void;
    private createSeedFromVitals;
    private hashString;
    private generatePrefix;
    private generateSuffix;
    private generateArchetype;
    private calculateAttribute;
    private generateInspirationPool;
    private generateVersePatterns;
    private generateWordPool;
}
//# sourceMappingURL=ProceduralSoulGenerator.d.ts.map