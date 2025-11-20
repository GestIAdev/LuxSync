import { AutoOptimizationEngine } from './AutoOptimizationEngine.js';
import { SeleneEvolutionEngine } from '../../evolutionary/selene-evolution-engine.js';
import { SafetyContext } from './MetaEngineInterfaces.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Redis = require('ioredis');

// Interface local para Optimization (basada en AutoOptimizationEngine)
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

// Importar EvolutionarySuggestion
import { EvolutionarySuggestion } from '../../evolutionary/interfaces/evolutionary-engine-interfaces.js';


export class EvolutionaryAutoOptimizationEngine extends AutoOptimizationEngine {
  evolutionEngine: SeleneEvolutionEngine;
  private feedbackSubscriber: any;

  constructor(config: any, evolutionEngine?: SeleneEvolutionEngine) { // Use appropriate config type
    super(config); // Call parent constructor
    this.evolutionEngine = evolutionEngine!;
    console.log('� [EVOLUTION-CYCLE] Engine initialized with Switch integration');
    
    // Configurar listener de feedback humano
    this.setupFeedbackListener();
  }

  /**
   * Generate evolutionary optimization suggestions using the Selene Synergy Engine
   */
  public async generateEvolutionarySuggestions(context: SafetyContext): Promise<Optimization[]> {
    console.log('� [EVOLUTION-CYCLE] Generating evolutionary suggestions with Switch...');

    // Use the evolutionary engine to generate novel suggestions
    const evolutionarySuggestions: EvolutionarySuggestion[] = await this.evolutionEngine.executeEvolutionCycle();

    // Convert to the format expected by the AutoOptimizationEngine base class
    const suggestions: Optimization[] = evolutionarySuggestions.map((evoSugg): Optimization => ({
      optimizationId: evoSugg.id, // Ensure Optimization interface matches
      targetComponent: evoSugg.targetComponent,
      changeType: evoSugg.changeType,
      oldValue: evoSugg.oldValue,
      newValue: evoSugg.newValue,
      expectedImprovement: evoSugg.expectedImprovement,
      riskLevel: evoSugg.riskLevel,
      status: 'pending_human' as const, // Default status
      appliedAt: undefined, // Not applied yet
      performanceImpact: undefined, // Unknown until applied
      humanApproved: undefined, // Needs approval
      humanApprovedBy: undefined,
      abTested: false, // Default
      poeticDescription: evoSugg.poeticDescription,
      technicalDescription: evoSugg.technicalDescription
    }));

    console.log(`� [EVOLUTION-CYCLE] Generated ${suggestions.length} evolutionary suggestions`);

    return suggestions;
  }

  /**
   * Run evolutionary auto-optimization mode
   */
  public async runEvolutionaryAutoMode(context: SafetyContext): Promise<void> {
    console.log('🔥 [EVOLUTION-CYCLE] Executing cycle with current Switch mode...');

    try {
      const evolutionarySuggestions: EvolutionarySuggestion[] = await this.evolutionEngine.executeEvolutionCycle();
      await this.publishEvolutionarySuggestions(evolutionarySuggestions);

      console.log(`🔥 [EVOLUTION-CYCLE] ✅ Generated and published ${evolutionarySuggestions.length} evolutionary suggestions`);

      // Note: Actual application would require human approval or additional logic
      // For now, we just generate and publish the suggestions

    } catch (error) {
      console.error('🔥 [EVOLUTION-CYCLE] ❌ Error in evolution cycle:', error as Error);
      throw error;
    }
  }

  private async publishEvolutionarySuggestions(suggestions: EvolutionarySuggestion[]): Promise<void> {
    try {
      const publisher = new Redis();
      for (const suggestion of suggestions) {
        await publisher.publish('selene:evolution:suggestions', JSON.stringify(suggestion));
        console.log(`📤 [EVOLUTION-CYCLE] Published suggestion ${suggestion.id}`);
      }
      await publisher.quit();
    } catch (error) {
      console.error('❌ [EVOLUTION-CYCLE] Error publishing suggestions:', error as Error);
    }
  }

  /**
   * Setup feedback listener for human feedback via Redis Pub/Sub
   */
  private async setupFeedbackListener(): Promise<void> {
    try {
      // Use Redis from top-level import
      this.feedbackSubscriber = new Redis();
      
      // Subscribe to feedback channel
      this.feedbackSubscriber.subscribe('selene:evolution:feedback', (err: any) => {
        if (err) {
          console.error('❌ [EVOLUTION-FEEDBACK] Error subscribing to feedback channel:', err);
          return;
        }
        console.log('✅ [EVOLUTION-FEEDBACK] Subscribed to selene:evolution:feedback channel');
      });
      
      // Handle incoming feedback messages
      this.feedbackSubscriber.on('message', (channel: string, message: string) => {
        if (channel === 'selene:evolution:feedback') {
          try {
            const feedback = JSON.parse(message);
            console.log('📨 [EVOLUTION-FEEDBACK] Received feedback:', feedback);
            
            // Register feedback with evolution engine
            this.evolutionEngine.registerHumanFeedback(feedback);
          } catch (error) {
            console.error('❌ [EVOLUTION-FEEDBACK] Error processing feedback message:', error as Error);
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [EVOLUTION-FEEDBACK] Error setting up feedback listener:', error as Error);
    }
  }

  /**
   * Publish evolutionary suggestions to dashboard via Redis Pub/Sub
   */
  private async publishSuggestions(suggestions: Optimization[]): Promise<void> {
    try {
      // Use Redis from top-level require (createRequire pattern)
      const publisher = new Redis();
      
      for (const suggestion of suggestions) {
        await publisher.publish('selene:evolution:suggestions', JSON.stringify(suggestion));
        console.log(`📤 [EVOLUTION-CYCLE] Published suggestion ${suggestion.optimizationId}`);
      }
      
      await publisher.quit();
    } catch (error) {
      console.error('❌ [EVOLUTION-CYCLE] Error publishing suggestions:', error as Error);
    }
  }
}


