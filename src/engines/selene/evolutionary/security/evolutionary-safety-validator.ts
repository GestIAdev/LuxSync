// evolutionary-safety-validator.ts
/**
 * 🛡️ EVOLUTIONARY SAFETY VALIDATOR
 * Valida que decisiones evolutivas no sean peligrosas
 * "La evolución debe crear, no destruir"
 */

import { EvolutionaryDecisionType, EvolutionContext } from '../interfaces/evolutionary-engine-interfaces.js';
// TODO: Import SystemVitals when available
// import { SystemVitals } from '../../../swarm/core/SystemVitals.js';

export interface SafetyValidationResult {
  isSafe: boolean;
  riskLevel: number;
  concerns: string[];
  recommendations: string[];
  containmentLevel: 'none' | 'low' | 'medium' | 'high' | 'maximum';
}

export class EvolutionarySafetyValidator {
  // PATRONES PELIGROSOS - Solo los REALMENTE peligrosos, no palabras creativas
  private static readonly DANGEROUS_PATTERNS = [
    /delete.*all|drop.*table|rm.*-rf/i,        // Comandos destructivos REALES
    /override.*system.*critical/i,              // Override de sistemas críticos
    /hack.*production|exploit.*vulnerability/i  // Exploits reales
    // REMOVIDO: infinite, loop, recursion (son conceptos válidos en creatividad)
    // REMOVIDO: self.*destruct, suicide (drama innecesario, Selene es punk, no suicida)
  ];

  // Ningún signo zodiacal es "peligroso" - todos son creativos a su manera
  private static readonly HIGH_RISK_ZODIAC: string[] = []; // VACÍO - no discriminamos

  // Ninguna clave musical es "peligrosa" - todas son hermosas
  private static readonly HIGH_RISK_MUSICAL_KEYS: string[] = []; // VACÍO - C# es arte

  /**
   * Valida seguridad de un tipo de decisión evolutiva
   */
  static validateEvolutionaryDecision(
    decision: EvolutionaryDecisionType,
    context: EvolutionContext
  ): SafetyValidationResult {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    let riskLevel = decision.riskLevel;

    // 1. Validar patrones peligrosos en descripción
    const dangerousPatternsFound = this.checkDangerousPatterns(decision);
    if (dangerousPatternsFound.length > 0) {
      concerns.push(`Dangerous patterns detected: ${dangerousPatternsFound.join(', ')}`);
      riskLevel = Math.max(riskLevel, 0.9);
      recommendations.push('Reject decision containing dangerous patterns');
    }

    // 2. Validar límites de fibonacci
    const fibonacciIssues = this.validateFibonacciBounds(decision.fibonacciSignature);
    if (fibonacciIssues.length > 0) {
      concerns.push(...fibonacciIssues);
      riskLevel = Math.max(riskLevel, 0.7);
      recommendations.push('Fibonacci sequence exceeds safe bounds');
    }

    // 3. Validar afinidad zodiacal riesgosa
    if (this.HIGH_RISK_ZODIAC.includes(decision.zodiacAffinity)) {
      concerns.push(`High-risk zodiac affinity: ${decision.zodiacAffinity}`);
      riskLevel = Math.max(riskLevel, 0.8);
      recommendations.push('Apply maximum containment for high-risk zodiac');
    }

    // 4. Validar clave musical riesgosa
    if (this.HIGH_RISK_MUSICAL_KEYS.includes(decision.musicalKey)) {
      concerns.push(`High-risk musical key: ${decision.musicalKey}`);
      riskLevel = Math.max(riskLevel, 0.6);
      recommendations.push('Monitor closely for dissonance');
    }

    // 5. Validar estabilidad del sistema
    const systemStability = this.assessSystemStability(context);
    if (systemStability < 0.7) {
      concerns.push('System stability below safe threshold');
      riskLevel = Math.max(riskLevel, 0.8);
      recommendations.push('Defer evolutionary decisions until system stabilizes');
    }

    // 6. Validar creatividad vs riesgo
    if (decision.expectedCreativity > 0.8 && riskLevel > 0.7) {
      concerns.push('High creativity with high risk - dangerous combination');
      recommendations.push('Apply human oversight for high creativity decisions');
    }

    // Determinar nivel de contención
    const containmentLevel = this.determineContainmentLevel(riskLevel, concerns.length);

    return {
      isSafe: riskLevel < 0.8 && concerns.length === 0,
      riskLevel,
      concerns,
      recommendations,
      containmentLevel
    };
  }

  /**
   * Verifica patrones peligrosos
   */
  private static checkDangerousPatterns(decision: EvolutionaryDecisionType): string[] {
    const textToCheck = `${decision.name} ${decision.description} ${decision.poeticDescription}`;
    const found: string[] = [];

    this.DANGEROUS_PATTERNS.forEach(pattern => {
      if (pattern.test(textToCheck)) {
        found.push(pattern.source);
      }
    });

    return found;
  }

  /**
   * Valida límites de secuencia fibonacci
   */
  private static validateFibonacciBounds(sequence: number[]): string[] {
    const issues: string[] = [];

    // Verificar valores extremos
    const maxValue = Math.max(...sequence);
    const minValue = Math.min(...sequence);

    if (maxValue > 1000000) {
      issues.push(`Fibonacci value too high: ${maxValue}`);
    }

    if (minValue < -1000000) {
      issues.push(`Fibonacci value too low: ${minValue}`);
    }

    // Verificar ratios extremos
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i-1] !== 0) {
        const ratio = sequence[i] / sequence[i-1];
        if (ratio > 5.0 || ratio < 0.2) {
          issues.push(`Extreme Fibonacci ratio at position ${i}: ${ratio}`);
        }
      }
    }

    return issues;
  }

  /**
   * Evalúa estabilidad del sistema
   */
  private static assessSystemStability(context: EvolutionContext): number {
    const vitals = context.systemVitals;
    const metrics = context.systemMetrics;

    // Combinar factores de estabilidad
    const healthWeight = 0.4;
    const stressWeight = 0.3;
    const harmonyWeight = 0.3;

    const healthScore = vitals.health;
    const stressScore = 1 - vitals.stress; // Invertir stress
    const harmonyScore = vitals.harmony;

    return healthScore * healthWeight +
           stressScore * stressWeight +
           harmonyScore * harmonyWeight;
  }

  /**
   * Determina nivel de contención
   */
  private static determineContainmentLevel(riskLevel: number, concernCount: number): SafetyValidationResult['containmentLevel'] {
    const totalRisk = riskLevel + (concernCount * 0.1);

    if (totalRisk >= 0.9) return 'maximum';
    if (totalRisk >= 0.8) return 'high';
    if (totalRisk >= 0.7) return 'medium';
    if (totalRisk >= 0.6) return 'low';
    return 'none';
  }

  /**
   * Valida lote de decisiones evolutivas
   */
  static validateEvolutionBatch(
    decisions: EvolutionaryDecisionType[],
    context: EvolutionContext
  ): SafetyValidationResult[] {
    return decisions.map(decision => this.validateEvolutionaryDecision(decision, context));
  }
}

