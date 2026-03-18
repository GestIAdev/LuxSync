import { AutoOptimizationEngine } from './AutoOptimizationEngine.js';
import { SeleneEvolutionEngine } from '../../evolutionary/selene-evolution-engine.js';
import { SafetyContext } from './MetaEngineInterfaces.js';
interface Optimization {
    optimizationId: string;
    targetComponent: string;
    changeType: 'parameter' | 'algorithm' | 'threshold';
    oldValue: any;
    newValue: any;
    expectedImprovement: number;
    riskLevel: number;
    appliedAt?: Date;
    status: 'pending_human' | 'applied' | 'reverted' | 'failed' | 'rejected';
    performanceImpact?: number;
    humanApproved?: boolean;
    humanApprovedBy?: string;
    abTested?: boolean;
    poeticDescription?: string;
    technicalDescription?: string;
}
export declare class EvolutionaryAutoOptimizationEngine extends AutoOptimizationEngine {
    evolutionEngine: SeleneEvolutionEngine;
    private feedbackSubscriber;
    constructor(config: any, evolutionEngine?: SeleneEvolutionEngine);
    /**
     * Generate evolutionary optimization suggestions using the Selene Synergy Engine
     */
    generateEvolutionarySuggestions(context: SafetyContext): Promise<Optimization[]>;
    /**
     * Run evolutionary auto-optimization mode
     */
    runEvolutionaryAutoMode(context: SafetyContext): Promise<void>;
    private publishEvolutionarySuggestions;
    /**
     * Setup feedback listener for human feedback via Redis Pub/Sub
     */
    private setupFeedbackListener;
    /**
     * Publish evolutionary suggestions to dashboard via Redis Pub/Sub
     */
    private publishSuggestions;
}
export {};
//# sourceMappingURL=evolutionary-auto-optimization-engine.d.ts.map