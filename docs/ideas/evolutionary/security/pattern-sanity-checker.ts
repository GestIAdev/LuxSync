// pattern-sanity-checker.ts
/**
 * 🔍 PATTERN SANITY CHECKER
 * Verifica cordura de patrones antes de usarlos
 * "La locura creativa debe tener límites matemáticos"
 */

import { EvolutionaryPattern } from '../interfaces/evolutionary-engine-interfaces.js';

export interface SanityCheckResult {
  isSane: boolean;
  issues: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export class PatternSanityChecker {
  private static readonly MAX_FIBONACCI_VALUE = 1000000;
  private static readonly MIN_FIBONACCI_VALUE = -1000000;
  private static readonly MAX_RATIO_CHANGE = 5.0;
  private static readonly MIN_RATIO_CHANGE = 0.2;

  /**
   * Verifica cordura de patrón evolutivo
   */
  static checkPatternSanity(pattern: EvolutionaryPattern): SanityCheckResult {
    const issues: string[] = [];

    // Verificar valores fibonacci
    const fibonacciIssues = this.checkFibonacciValues(pattern.fibonacciSequence);
    issues.push(...fibonacciIssues);

    // Verificar ratios fibonacci
    const ratioIssues = this.checkFibonacciRatios(pattern.fibonacciSequence);
    issues.push(...ratioIssues);

    // Verificar posición zodiacal
    const zodiacIssues = this.checkZodiacPosition(pattern.zodiacPosition);
    issues.push(...zodiacIssues);

    // Verificar clave musical
    const musicalIssues = this.checkMusicalKey(pattern.musicalKey);
    issues.push(...musicalIssues);

    // Verificar ratio de armonía
    const harmonyIssues = this.checkHarmonyRatio(pattern.harmonyRatio);
    issues.push(...harmonyIssues);

    // Determinar severidad
    const severity = this.determineSeverity(issues);

    // Generar recomendaciones
    const recommendations: string[] = [];
    if (issues.length > 0) {
      recommendations.push('Review and correct pattern parameters');
      if (severity === 'critical') {
        recommendations.push('Reject pattern immediately');
      } else if (severity === 'high') {
        recommendations.push('Apply maximum containment');
      } else if (severity === 'medium') {
        recommendations.push('Monitor closely during application');
      }
    }

    return {
      isSane: issues.length === 0,
      issues,
      severity,
      recommendations
    };
  }

  /**
   * Verifica valores fibonacci
   */
  private static checkFibonacciValues(sequence: number[]): string[] {
    const issues: string[] = [];

    if (!sequence || sequence.length === 0) {
      issues.push('Fibonacci sequence is empty or null');
      return issues;
    }

    for (let i = 0; i < sequence.length; i++) {
      const value = sequence[i];

      if (typeof value !== 'number' || isNaN(value)) {
        issues.push(`Fibonacci value at position ${i} is not a valid number: ${value}`);
      } else if (!isFinite(value)) {
        issues.push(`Fibonacci value at position ${i} is non-finite: ${value}`);
      } else if (value > this.MAX_FIBONACCI_VALUE) {
        issues.push(`Fibonacci value at position ${i} exceeds maximum: ${value} > ${this.MAX_FIBONACCI_VALUE}`);
      } else if (value < this.MIN_FIBONACCI_VALUE) {
        issues.push(`Fibonacci value at position ${i} below minimum: ${value} < ${this.MIN_FIBONACCI_VALUE}`);
      }
    }

    return issues;
  }

  /**
   * Verifica ratios fibonacci
   */
  private static checkFibonacciRatios(sequence: number[]): string[] {
    const issues: string[] = [];

    if (!sequence || sequence.length < 3) {
      return issues; // No ratios to check
    }

    for (let i = 2; i < sequence.length; i++) {
      const current = sequence[i];
      const previous = sequence[i - 1];

      if (previous === 0) {
        issues.push(`Division by zero in Fibonacci ratio at position ${i}`);
        continue;
      }

      const ratio = current / previous;

      if (!isFinite(ratio)) {
        issues.push(`Non-finite Fibonacci ratio at position ${i}: ${ratio}`);
      } else if (ratio > this.MAX_RATIO_CHANGE) {
        issues.push(`Fibonacci ratio at position ${i} exceeds maximum change: ${ratio} > ${this.MAX_RATIO_CHANGE}`);
      } else if (ratio < this.MIN_RATIO_CHANGE) {
        issues.push(`Fibonacci ratio at position ${i} below minimum change: ${ratio} < ${this.MIN_RATIO_CHANGE}`);
      }
    }

    return issues;
  }

  /**
   * Verifica posición zodiacal
   */
  private static checkZodiacPosition(position: number): string[] {
    const issues: string[] = [];

    if (typeof position !== 'number' || isNaN(position)) {
      issues.push(`Zodiac position is not a valid number: ${position}`);
    } else if (!isFinite(position)) {
      issues.push(`Zodiac position is non-finite: ${position}`);
    } else if (position < 0 || position >= 12) {
      issues.push(`Zodiac position out of range [0,12): ${position}`);
    }

    return issues;
  }

  /**
   * Verifica clave musical
   */
  private static checkMusicalKey(key: string): string[] {
    const issues: string[] = [];

    if (!key || typeof key !== 'string') {
      issues.push('Musical key is null, undefined, or not a string');
      return issues;
    }

    const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    if (!validKeys.includes(key.toUpperCase())) {
      issues.push(`Invalid musical key: ${key}. Must be one of: ${validKeys.join(', ')}`);
    }

    return issues;
  }

  /**
   * Verifica ratio de armonía
   */
  private static checkHarmonyRatio(ratio: number): string[] {
    const issues: string[] = [];

    if (typeof ratio !== 'number' || isNaN(ratio)) {
      issues.push(`Harmony ratio is not a valid number: ${ratio}`);
    } else if (!isFinite(ratio)) {
      issues.push(`Harmony ratio is non-finite: ${ratio}`);
    } else if (ratio < 0 || ratio > 1) {
      issues.push(`Harmony ratio out of range [0,1]: ${ratio}`);
    }

    return issues;
  }

  /**
   * Determina severidad de issues
   */
  private static determineSeverity(issues: string[]): SanityCheckResult['severity'] {
    if (issues.some(issue => issue.includes('critical') || issue.includes('Non-finite'))) {
      return 'critical';
    } else if (issues.some(issue => issue.includes('maximum') || issue.includes('below minimum'))) {
      return 'high';
    } else if (issues.length > 2) {
      return 'medium';
    } else if (issues.length > 0) {
      return 'low';
    } else {
      return 'low'; // No issues
    }
  }

  /**
   * Verifica lote de patrones
   */
  static checkPatternBatch(patterns: EvolutionaryPattern[]): SanityCheckResult[] {
    return patterns.map(pattern => this.checkPatternSanity(pattern));
  }
}

