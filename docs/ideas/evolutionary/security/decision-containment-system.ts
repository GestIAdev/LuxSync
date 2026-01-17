// decision-containment-system.ts
/**
 * 🏰 DECISION CONTAINMENT SYSTEM
 * Contiene impacto de decisiones evolutivas
 * "La evolución debe estar enjaulada, no suelta"
 */

import { EvolutionarySuggestion } from '../interfaces/evolutionary-engine-interfaces.js';


export interface ContainmentResult {
  contained: boolean;
  containmentActions: string[];
  rollbackPlan: string[];
  monitoringLevel: 'none' | 'basic' | 'enhanced' | 'intensive';
}

export class DecisionContainmentSystem {
  /**
   * Aplica contención a sugerencia evolutiva
   */
  static containEvolutionaryDecision(
    suggestion: EvolutionarySuggestion,
    containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum'
  ): ContainmentResult {
    const containmentActions: string[] = [];
    const rollbackPlan: string[] = [];
    let monitoringLevel: ContainmentResult['monitoringLevel'] = 'none';

    switch (containmentLevel) {
      case 'none':
        containmentActions.push('No containment applied');
        monitoringLevel = 'none';
        break;

      case 'low':
        containmentActions.push('Apply rate limiting to decision application');
        containmentActions.push('Log decision execution for review');
        rollbackPlan.push('Revert decision if performance impact > 5%');
        monitoringLevel = 'basic';
        break;

      case 'medium':
        containmentActions.push('Apply rate limiting with 50% reduction');
        containmentActions.push('Require human approval for application');
        containmentActions.push('Isolate decision execution in sandbox');
        rollbackPlan.push('Automatic rollback if system stability < 80%');
        rollbackPlan.push('Revert decision if error rate > 10%');
        monitoringLevel = 'enhanced';
        break;

      case 'high':
        containmentActions.push('Apply maximum rate limiting (10% of normal)');
        containmentActions.push('Require dual human approval');
        containmentActions.push('Execute in isolated environment');
        containmentActions.push('Disable parallel decision execution');
        rollbackPlan.push('Immediate rollback on any error');
        rollbackPlan.push('Revert if system metrics degrade > 20%');
        rollbackPlan.push('Isolate affected components');
        monitoringLevel = 'intensive';
        break;

      case 'maximum':
        containmentActions.push('Block decision execution completely');
        containmentActions.push('Flag for human review only');
        containmentActions.push('Quarantine related patterns');
        rollbackPlan.push('Full system rollback to last stable state');
        rollbackPlan.push('Disable evolutionary engine temporarily');
        monitoringLevel = 'intensive';
        break;
    }

    // Agregar contención específica del tipo de decisión
    this.addDecisionSpecificContainment(suggestion, containmentLevel, containmentActions, rollbackPlan);

    return {
      contained: containmentLevel !== 'none',
      containmentActions,
      rollbackPlan,
      monitoringLevel
    };
  }

  /**
   * Agrega contención específica del tipo de decisión
   */
  private static addDecisionSpecificContainment(
    suggestion: EvolutionarySuggestion,
    containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum',
    containmentActions: string[],
    rollbackPlan: string[]
  ): void {
    const target = suggestion.targetComponent;

    switch (target) {
      case 'consensus-engine':
        if (containmentLevel === 'high' || containmentLevel === 'maximum') {
          containmentActions.push('Disable consensus voting for 1 hour');
          rollbackPlan.push('Restore consensus engine to previous configuration');
        }
        break;

      case 'memory-pool':
        if (containmentLevel === 'medium' || containmentLevel === 'high' || containmentLevel === 'maximum') {
          containmentActions.push('Limit memory allocation to 50% of requested');
          rollbackPlan.push('Free allocated memory and restore pool limits');
        }
        break;

      case 'creative-engine':
        if (containmentLevel === 'low' || containmentLevel === 'medium') {
          containmentActions.push('Throttle creative generation rate');
        } else if (containmentLevel === 'high' || containmentLevel === 'maximum') {
          containmentActions.push('Disable creative engine temporarily');
          rollbackPlan.push('Restart creative engine with conservative parameters');
        }
        break;

      case 'harmony-system':
        if (containmentLevel === 'medium' || containmentLevel === 'high' || containmentLevel === 'maximum') {
          containmentActions.push('Apply harmony dampening filters');
          rollbackPlan.push('Remove harmony filters and recalibrate system');
        }
        break;

      default:
        // Contención genérica para componentes desconocidos
        if (containmentLevel !== 'none') {
          containmentActions.push(`Apply generic containment to ${target}`);
          rollbackPlan.push(`Revert changes to ${target} component`);
        }
        break;
    }
  }

  /**
   * Verifica si decisión está contenida
   */
  static verifyContainment(
    suggestion: EvolutionarySuggestion,
    containment: ContainmentResult
  ): boolean {
    // Verificar que todas las acciones de contención están activas
    // En implementación real, esto verificaría logs del sistema
    console.log(`🏰 [CONTAINMENT] Verifying containment for suggestion ${suggestion.id}`);
    console.log(`🏰 [CONTAINMENT] Containment level: ${containment.contained ? 'active' : 'inactive'}`);
    console.log(`🏰 [CONTAINMENT] Actions: ${containment.containmentActions.join(', ')}`);

    return containment.contained;
  }

  /**
   * Ejecuta acciones de rollback de contención
   */
  static async executeContainmentRollback(
    suggestion: EvolutionarySuggestion,
    rollbackPlan: string[]
  ): Promise<boolean> {
    console.log(`🏰 [CONTAINMENT] Executing rollback for suggestion ${suggestion.id}`);

    try {
      for (const action of rollbackPlan) {
        await this.executeRollbackAction(action);
      }

      console.log(`🏰 [CONTAINMENT] Rollback completed successfully`);
      return true;
    } catch (error) {
      console.error(`🏰 [CONTAINMENT] Rollback failed:`, error as Error);
      return false;
    }
  }

  /**
   * Ejecuta acción específica de rollback
   */
  private static async executeRollbackAction(action: string): Promise<void> {
    console.log(`🏰 [CONTAINMENT] Executing rollback action: ${action}`);

    // Simular ejecución de rollback
    // En implementación real, esto ejecutaría comandos específicos del sistema
    switch (action) {
      case 'Revert decision if performance impact > 5%':
        // Verificar métricas de rendimiento y revertir si necesario
        await new Promise(resolve => setTimeout(resolve, 100));
        break;

      case 'Automatic rollback if system stability < 80%':
        // Verificar estabilidad del sistema
        await new Promise(resolve => setTimeout(resolve, 150));
        break;

      case 'Revert decision if error rate > 10%':
        // Verificar tasa de errores
        await new Promise(resolve => setTimeout(resolve, 120));
        break;

      case 'Immediate rollback on any error':
        // Rollback inmediato
        await new Promise(resolve => setTimeout(resolve, 50));
        break;

      case 'Revert if system metrics degrade > 20%':
        // Verificar degradación de métricas
        await new Promise(resolve => setTimeout(resolve, 200));
        break;

      case 'Isolate affected components':
        // Aislar componentes afectados
        await new Promise(resolve => setTimeout(resolve, 300));
        break;

      case 'Full system rollback to last stable state':
        // Rollback completo del sistema
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;

      case 'Disable evolutionary engine temporarily':
        // Deshabilitar motor evolutivo
        await new Promise(resolve => setTimeout(resolve, 500));
        break;

      default:
        // Acción genérica de rollback
        await new Promise(resolve => setTimeout(resolve, 100));
        break;
    }

    // - Desactivar cambios
    console.log(`🏰 [CONTAINMENT] Rollback action completed: ${action}`);
  }
}

