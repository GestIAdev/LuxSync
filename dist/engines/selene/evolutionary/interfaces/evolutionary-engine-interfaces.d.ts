import { SystemMetrics, VitalSigns } from '../../swarm/core/SystemVitals.js';
import { OptimizationSuggestion } from '../../consciousness/engines/MetaEngineInterfaces.js';
import { ContainmentResult } from '../security/decision-containment-system.js';
export interface EvolutionaryPattern {
    fibonacciSequence: number[];
    zodiacPosition: number;
    musicalKey: string;
    harmonyRatio: number;
    timestamp: number;
}
export interface EvolutionaryDecisionType {
    typeId: string;
    name: string;
    description: string;
    poeticDescription: string;
    technicalBasis: string;
    riskLevel: number;
    expectedCreativity: number;
    fibonacciSignature: number[];
    zodiacAffinity: string;
    musicalKey: string;
    musicalHarmony: number;
    generationTimestamp: number;
    validationScore: number;
}
export interface EvolutionContext {
    systemVitals: VitalSigns;
    systemMetrics: SystemMetrics;
    currentPatterns: EvolutionaryPattern[];
    feedbackHistory: FeedbackEntry[];
    seleneConsciousness: {
        creativity: number;
        stress: number;
    };
}
export interface FeedbackEntry {
    decisionTypeId: string;
    humanRating: number;
    humanFeedback: string;
    appliedSuccessfully: boolean;
    performanceImpact: number;
    timestamp: number;
}
export interface EvolutionarySuggestion extends OptimizationSuggestion {
    evolutionaryType: EvolutionaryDecisionType;
    patternSignature: EvolutionaryPattern;
    creativityScore: number;
    noveltyIndex: number;
    containment?: ContainmentResult;
}
//# sourceMappingURL=evolutionary-engine-interfaces.d.ts.map