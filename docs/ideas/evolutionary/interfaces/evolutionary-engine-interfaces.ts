// evolutionary-engine-interfaces.ts
import { SystemMetrics, VitalSigns } from '../../swarm/core/SystemVitals.js';
import { OptimizationSuggestion } from '../../consciousness/engines/MetaEngineInterfaces.js';
import { ContainmentResult } from '../security/decision-containment-system.js';

export interface EvolutionaryPattern {
  fibonacciSequence: number[];
  zodiacPosition: number; // 0-11 (signos zodiacales)
  musicalKey: string; // C, D, E, F, G, A, B + sostenidos/bemoles
  harmonyRatio: number; // Proporción áurea aplicada a armonía
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
  validationScore: number; // Veritas validation
}

export interface EvolutionContext {
  systemVitals: VitalSigns;
  systemMetrics: SystemMetrics;
  currentPatterns: EvolutionaryPattern[];
  feedbackHistory: FeedbackEntry[];
  seleneConsciousness: {
    creativity: number;
    /* Lines 96-98 omitted */
    stress: number;
  };
}

export interface FeedbackEntry {
  decisionTypeId: string;
  humanRating: number; // 1-10
  humanFeedback: string;
  appliedSuccessfully: boolean;
  performanceImpact: number;
  timestamp: number;
}

export interface EvolutionarySuggestion extends OptimizationSuggestion {
  evolutionaryType: EvolutionaryDecisionType;
  patternSignature: EvolutionaryPattern;
  creativityScore: number;
  noveltyIndex: number; // Cuán novedoso es vs decisiones existentes
  containment?: ContainmentResult;
}

