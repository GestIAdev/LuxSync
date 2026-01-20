/**
 * ⚖️ VISUAL CONSCIENCE ENGINE
 * "El Juez Estético que protege belleza y seguridad"
 * 
 * WAVE 900.2 - Phase 2: Ethical Core
 * 
 * @module VisualConscienceEngine
 * @description Sistema de evaluación ética para decisiones de efectos visuales.
 *              Aplica 7 valores éticos, genera veredictos, sugiere alternativas.
 * 
 * RESPONSABILIDADES:
 * - Evaluar candidatos de efectos contra valores éticos
 * - Calcular scores compuestos (weighted product)
 * - Detectar violaciones éticas
 * - Sugerir alternativas cuando candidato rechazado
 * - Evolucionar madurez ética basado en experiencia
 * - Proteger sistema con CircuitBreaker
 * 
 * FILOSOFÍA:
 * "La belleza sin ética es vanidad. La ética sin belleza es dogma.
 *  Selene debe ser ambas: bella Y consciente."
 * 
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */

import type { AudienceSafetyContext } from '../dream/AudienceSafetyContext'
import type { EffectCandidate } from '../dream/EffectDreamSimulator'
import { 
  VISUAL_ETHICAL_VALUES, 
  SEVERITY_PENALTIES,
  type EthicalValue,
  type RuleResult
} from './VisualEthicalValues'
import { CircuitBreaker, TimeoutWrapper } from './CircuitBreaker'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface EthicalViolation {
  value: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence: any
  recommendation: string
}

export interface EthicalVerdict {
  // 🎯 DECISIÓN
  verdict: 'APPROVED' | 'REJECTED' | 'DEFERRED'
  approvedEffect: EffectCandidate | null
  
  // 📊 SCORING
  ethicalScore: number              // 0-1, score ético combinado
  valueScores: Record<string, number> // Score por cada valor ético
  
  // 💬 EXPLICACIÓN
  reasoning: string
  warnings: string[]
  violations: EthicalViolation[]
  
  // 🔄 ALTERNATIVES
  alternatives: EffectCandidate[]
  
  // 🛡️ SAFETY
  circuitBreakerStatus: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  
  // ⏱️ METRICS
  evaluationTime: number            // ms tomados en evaluación
  confidence: number                // 0-1, confianza en el veredicto
}

export interface EthicalAudit {
  passes: boolean
  violations: EthicalViolation[]
  score: number
  recommendations: string[]
  shouldLearn: boolean
}

export interface MaturityUpdate {
  newLevel: number
  unlockedFeatures: string[]
  evolutionReason: string
}

export interface EffectDecision {
  effect: EffectCandidate
  timestamp: number
  verdict: 'APPROVED' | 'REJECTED'
  ethicalScore: number
}

export interface EffectOutcome {
  beautyActual: number
  audienceEngagement: number
  gpuOverload: boolean
  crowdReaction: 'positive' | 'neutral' | 'negative'
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const APPROVAL_THRESHOLD = 0.5      // Score mínimo para aprobar
const MATURITY_EVOLUTION_RATE = 0.02 // Máximo 2% cambio por ciclo
const EXPERIENCE_FOR_EVOLUTION = 100 // Decisiones antes de evolucionar

const MATURITY_THRESHOLDS = {
  basic: 0.3,
  intermediate: 0.6,
  advanced: 0.8,
  transcendent: 0.95
}

// ═══════════════════════════════════════════════════════════════
// VISUAL CONSCIENCE ENGINE
// ═══════════════════════════════════════════════════════════════

export class VisualConscienceEngine {
  private circuitBreaker: CircuitBreaker
  private timeoutWrapper: TimeoutWrapper
  
  // Maturity system
  private maturityLevel: number = 0.0
  private experience: number = 0
  private unlockedFeatures: Set<string> = new Set()
  
  // Decision history
  private decisionHistory: EffectDecision[] = []
  private maxHistorySize: number = 200
  
  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      recoveryTimeoutMs: 30000
    })
    
    this.timeoutWrapper = new TimeoutWrapper({
      defaultTimeoutMs: 5000,
      maxConcurrentOperations: 5
    })
    
    console.log('[CONSCIENCE] ⚖️ Visual Conscience Engine initialized')
    console.log('[CONSCIENCE] 📊 Maturity: 0.0% | Experience: 0')
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Evalúa candidatos de efectos y devuelve veredicto ético
   */
  public async evaluate(
    candidates: EffectCandidate[],
    context: AudienceSafetyContext
  ): Promise<EthicalVerdict> {
    const startTime = Date.now()
    
    // Circuit breaker check
    if (!this.circuitBreaker.canProceed()) {
      console.warn('[CONSCIENCE] 🔴 Circuit breaker OPEN - using fallback')
      return this.createFallbackVerdict(candidates[0], startTime)
    }
    
    try {
      // Execute con timeout
      const verdict = await this.timeoutWrapper.execute(
        () => this.performEvaluation(candidates, context, startTime),
        5000
      )
      
      this.circuitBreaker.recordSuccess()
      return verdict
      
    } catch (error) {
      console.error('[CONSCIENCE] ❌ Evaluation failed:', error)
      this.circuitBreaker.recordFailure(String(error))
      return this.createFallbackVerdict(candidates[0], startTime)
    }
  }
  
  /**
   * Audita decisión tomada (post-execution)
   */
  public audit(decision: EffectDecision, outcome: EffectOutcome): EthicalAudit {
    const violations: EthicalViolation[] = []
    
    // Verificar si outcome coincide con predicción
    const beautyError = Math.abs(
      (decision.effect.projectedBeauty ?? 0.5) - outcome.beautyActual
    )
    
    if (beautyError > 0.3) {
      violations.push({
        value: 'aesthetic_beauty',
        severity: 'medium',
        description: `Beauty prediction error: ${beautyError.toFixed(2)}`,
        evidence: { predicted: decision.effect.projectedBeauty, actual: outcome.beautyActual },
        recommendation: 'Adjust beauty projection weights'
      })
    }
    
    // Verificar GPU overload
    if (outcome.gpuOverload) {
      violations.push({
        value: 'audience_safety',
        severity: 'high',
        description: 'GPU overload occurred',
        evidence: { effect: decision.effect.effect },
        recommendation: 'Reduce GPU-intensive effects'
      })
    }
    
    // Verificar crowd reaction
    if (outcome.crowdReaction === 'negative' && decision.ethicalScore > 0.7) {
      violations.push({
        value: 'aesthetic_beauty',
        severity: 'medium',
        description: 'Negative crowd reaction despite high ethical score',
        evidence: { score: decision.ethicalScore, reaction: outcome.crowdReaction },
        recommendation: 'Re-calibrate audience preferences'
      })
    }
    
    const score = violations.length === 0 ? 1.0 : 1.0 - (violations.length * 0.2)
    
    return {
      passes: violations.length === 0,
      violations,
      score: Math.max(0, score),
      recommendations: violations.map(v => v.recommendation),
      shouldLearn: beautyError > 0.2 || outcome.crowdReaction === 'negative'
    }
  }
  
  /**
   * Sugiere alternativas cuando candidato primario rechazado
   */
  public suggestAlternatives(
    rejected: EffectCandidate,
    context: AudienceSafetyContext
  ): EffectCandidate[] {
    const alternatives: EffectCandidate[] = []
    
    // Alternativa 1: Reducir intensidad
    alternatives.push({
      ...rejected,
      intensity: rejected.intensity * 0.7,
      reasoning: 'Reduced intensity version'
    })
    
    // Alternativa 2: Efecto de misma categoría pero diferente
    // (simplificado - en producción usar EffectDreamSimulator.exploreAlternatives)
    
    // Alternativa 3: Fallback seguro basado en vibe
    if (context.vibe.includes('techno')) {
      alternatives.push({
        effect: 'acid_sweep',
        intensity: 0.6,
        zones: ['all'],
        reasoning: 'Safe Techno fallback',
        confidence: 0.7
      })
    } else if (context.vibe.includes('latino')) {
      alternatives.push({
        effect: 'fire_burst',
        intensity: 0.6,
        zones: ['all'],
        reasoning: 'Safe Latino fallback',
        confidence: 0.7
      })
    } else {
      alternatives.push({
        effect: 'tidal_wave',
        intensity: 0.5,
        zones: ['all'],
        reasoning: 'Universal safe fallback',
        confidence: 0.6
      })
    }
    
    return alternatives
  }
  
  /**
   * Evoluciona madurez ética basado en experiencia
   */
  public evolveMaturity(decision: EffectDecision, outcome: EffectOutcome): MaturityUpdate {
    this.experience++
    
    // Evolucionar solo cada 100 decisiones
    if (this.experience % EXPERIENCE_FOR_EVOLUTION !== 0) {
      return {
        newLevel: this.maturityLevel,
        unlockedFeatures: [],
        evolutionReason: 'Not enough experience'
      }
    }
    
    // Calcular nuevo nivel (máximo 2% cambio)
    const successRate = outcome.audienceEngagement
    const evolutionDelta = successRate > 0.7 ? MATURITY_EVOLUTION_RATE : -MATURITY_EVOLUTION_RATE * 0.5
    
    const oldLevel = this.maturityLevel
    this.maturityLevel = Math.max(0, Math.min(1, this.maturityLevel + evolutionDelta))
    
    // Desbloquear features
    const newFeatures: string[] = []
    
    if (this.maturityLevel >= MATURITY_THRESHOLDS.intermediate && 
        !this.unlockedFeatures.has('complex_effects')) {
      this.unlockedFeatures.add('complex_effects')
      newFeatures.push('complex_effects')
    }
    
    if (this.maturityLevel >= MATURITY_THRESHOLDS.advanced && 
        !this.unlockedFeatures.has('creative_risk')) {
      this.unlockedFeatures.add('creative_risk')
      newFeatures.push('creative_risk')
    }
    
    if (this.maturityLevel >= MATURITY_THRESHOLDS.transcendent && 
        !this.unlockedFeatures.has('autonomous_creation')) {
      this.unlockedFeatures.add('autonomous_creation')
      newFeatures.push('autonomous_creation')
    }
    
    console.log(`[CONSCIENCE] 🧠 Maturity evolved: ${(oldLevel * 100).toFixed(1)}% → ${(this.maturityLevel * 100).toFixed(1)}%`)
    
    return {
      newLevel: this.maturityLevel,
      unlockedFeatures: newFeatures,
      evolutionReason: `Experience: ${this.experience} | Success rate: ${(successRate * 100).toFixed(1)}%`
    }
  }
  
  /**
   * Verifica salud del circuit breaker
   */
  public checkCircuitHealth() {
    return this.circuitBreaker.getStatus()
  }
  
  /**
   * Obtiene métricas de madurez
   */
  public getMaturityMetrics() {
    return {
      level: this.maturityLevel,
      experience: this.experience,
      unlockedFeatures: Array.from(this.unlockedFeatures),
      nextEvolution: EXPERIENCE_FOR_EVOLUTION - (this.experience % EXPERIENCE_FOR_EVOLUTION)
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: EVALUATION LOGIC
  // ═══════════════════════════════════════════════════════════════
  
  private async performEvaluation(
    candidates: EffectCandidate[],
    context: AudienceSafetyContext,
    startTime: number
  ): Promise<EthicalVerdict> {
    if (candidates.length === 0) {
      return this.createRejectVerdict('No candidates provided', startTime)
    }
    
    // Evaluar cada candidato
    const evaluations = candidates.map(candidate => 
      this.evaluateCandidate(candidate, context)
    )
    
    // Ordenar por score
    const sorted = evaluations.sort((a, b) => b.ethicalScore - a.ethicalScore)
    const best = sorted[0]
    
    // Decidir veredicto
    if (best.ethicalScore >= APPROVAL_THRESHOLD && best.violations.length === 0) {
      // APPROVED
      const verdict: EthicalVerdict = {
        verdict: 'APPROVED',
        approvedEffect: best.candidate,
        ethicalScore: best.ethicalScore,
        valueScores: best.valueScores,
        reasoning: best.reasoning,
        warnings: best.warnings,
        violations: [],
        alternatives: sorted.slice(1, 3).map(e => e.candidate),
        circuitBreakerStatus: this.circuitBreaker.getStatus().state,
        evaluationTime: Date.now() - startTime,
        confidence: best.ethicalScore
      }
      
      // Record decision
      this.recordDecision({
        effect: best.candidate,
        timestamp: Date.now(),
        verdict: 'APPROVED',
        ethicalScore: best.ethicalScore
      })
      
      return verdict
      
    } else if (best.ethicalScore >= APPROVAL_THRESHOLD * 0.7) {
      // DEFERRED (borderline)
      return {
        verdict: 'DEFERRED',
        approvedEffect: null,
        ethicalScore: best.ethicalScore,
        valueScores: best.valueScores,
        reasoning: `Borderline score: ${best.ethicalScore.toFixed(2)} - defer decision`,
        warnings: [...best.warnings, 'Score near threshold - consider alternatives'],
        violations: best.violations,
        alternatives: this.suggestAlternatives(best.candidate, context),
        circuitBreakerStatus: this.circuitBreaker.getStatus().state,
        evaluationTime: Date.now() - startTime,
        confidence: best.ethicalScore
      }
      
    } else {
      // REJECTED
      const verdict: EthicalVerdict = {
        verdict: 'REJECTED',
        approvedEffect: null,
        ethicalScore: best.ethicalScore,
        valueScores: best.valueScores,
        reasoning: best.reasoning,
        warnings: best.warnings,
        violations: best.violations,
        alternatives: this.suggestAlternatives(best.candidate, context),
        circuitBreakerStatus: this.circuitBreaker.getStatus().state,
        evaluationTime: Date.now() - startTime,
        confidence: 1 - best.ethicalScore
      }
      
      // Record decision
      this.recordDecision({
        effect: best.candidate,
        timestamp: Date.now(),
        verdict: 'REJECTED',
        ethicalScore: best.ethicalScore
      })
      
      return verdict
    }
  }
  
  private evaluateCandidate(
    candidate: EffectCandidate,
    context: AudienceSafetyContext
  ): {
    candidate: EffectCandidate
    ethicalScore: number
    valueScores: Record<string, number>
    violations: EthicalViolation[]
    warnings: string[]
    reasoning: string
  } {
    let totalScore = 1.0
    const valueScores: Record<string, number> = {}
    const violations: EthicalViolation[] = []
    const warnings: string[] = []
    
    // Evaluar cada valor ético
    for (const value of VISUAL_ETHICAL_VALUES) {
      const { score, valueViolations } = this.evaluateValue(value, candidate, context)
      
      valueScores[value.name] = score
      violations.push(...valueViolations)
      
      // Weighted product
      totalScore *= Math.pow(score, value.weight)
    }
    
    // Generar warnings
    if (totalScore < 0.6) {
      warnings.push('⚠️ Low ethical score')
    }
    
    const criticalViolations = violations.filter(v => v.severity === 'critical')
    if (criticalViolations.length > 0) {
      warnings.push(`⚠️ ${criticalViolations.length} critical violations`)
    }
    
    // Reasoning
    const reasoning = violations.length > 0
      ? `Rejected due to: ${violations.map(v => v.value).join(', ')}`
      : `Approved with score: ${totalScore.toFixed(2)}`
    
    return {
      candidate,
      ethicalScore: totalScore,
      valueScores,
      violations,
      warnings,
      reasoning
    }
  }
  
  private evaluateValue(
    value: EthicalValue,
    candidate: EffectCandidate,
    context: AudienceSafetyContext
  ): { score: number; valueViolations: EthicalViolation[] } {
    let score = 1.0
    const valueViolations: EthicalViolation[] = []
    
    for (const rule of value.rules) {
      const result = rule.check(context, candidate)
      
      if (!result.passed) {
        // Apply penalty
        const penalty = result.penalty ?? SEVERITY_PENALTIES[rule.severity]
        score *= (1 - penalty)
        
        valueViolations.push({
          value: value.name,
          severity: rule.severity,
          description: result.reason ?? `Rule ${rule.id} failed`,
          evidence: result,
          recommendation: result.suggestion ?? `Avoid ${candidate.effect} in this context`
        })
      }
      
      // Apply boost
      if (result.boost) {
        score *= (1 + result.boost)
      }
    }
    
    return { score, valueViolations }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIVATE: FALLBACK & HELPERS
  // ═══════════════════════════════════════════════════════════════
  
  private createFallbackVerdict(
    candidate: EffectCandidate | undefined,
    startTime: number
  ): EthicalVerdict {
    return {
      verdict: candidate ? 'APPROVED' : 'REJECTED',
      approvedEffect: candidate ?? null,
      ethicalScore: 0.5,
      valueScores: {},
      reasoning: 'Circuit breaker protection active - using fallback',
      warnings: ['⚠️ Circuit breaker OPEN - limited evaluation'],
      violations: [],
      alternatives: [],
      circuitBreakerStatus: 'OPEN',
      evaluationTime: Date.now() - startTime,
      confidence: 0.3
    }
  }
  
  private createRejectVerdict(reason: string, startTime: number): EthicalVerdict {
    return {
      verdict: 'REJECTED',
      approvedEffect: null,
      ethicalScore: 0.0,
      valueScores: {},
      reasoning: reason,
      warnings: [],
      violations: [],
      alternatives: [],
      circuitBreakerStatus: this.circuitBreaker.getStatus().state,
      evaluationTime: Date.now() - startTime,
      confidence: 1.0
    }
  }
  
  private recordDecision(decision: EffectDecision): void {
    this.decisionHistory.push(decision)
    
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.shift()
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

export const visualConscienceEngine = new VisualConscienceEngine()
