/**
 * ⚖️ VISUAL CONSCIENCE ENGINE
 * "El Juez Estético que protege belleza y seguridad"
 *
 * WAVE 900.2 - Phase 2: Ethical Core
 * WAVE 920.2 - Mood compliance integration
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
 * - 🎭 WAVE 920.2: Verificar mood compliance
 *
 * FILOSOFÍA:
 * "La belleza sin ética es vanidad. La ética sin belleza es dogma.
 *  Selene debe ser ambas: bella Y consciente."
 *
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */
import { VISUAL_ETHICAL_VALUES, SEVERITY_PENALTIES } from './VisualEthicalValues';
import { CircuitBreaker, TimeoutWrapper } from './CircuitBreaker';
// 🎭 WAVE 920.2: MOOD COMPLIANCE
import { MoodController } from '../../mood/MoodController';
// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const BASE_APPROVAL_THRESHOLD = 0.5; // Score mínimo para aprobar (normal)
const EPILEPSY_APPROVAL_THRESHOLD = 0.7; // Score mínimo en epilepsy mode (más estricto)
const MATURITY_EVOLUTION_RATE = 0.02; // Máximo 2% cambio por ciclo
const EXPERIENCE_FOR_EVOLUTION = 100; // Decisiones antes de evolucionar
/**
 * 🧬 WAVE 2093 COG-7: Approval threshold dinámico
 * En epilepsyMode el umbral sube a 0.7 — solo efectos de alta ética pasan.
 * Esto elimina el margen gris que permitía efectos borderline en modo seguro.
 */
function getApprovalThreshold(epilepsyMode) {
    return epilepsyMode ? EPILEPSY_APPROVAL_THRESHOLD : BASE_APPROVAL_THRESHOLD;
}
const MATURITY_THRESHOLDS = {
    basic: 0.3,
    intermediate: 0.6,
    advanced: 0.8,
    transcendent: 0.95
};
// ═══════════════════════════════════════════════════════════════
// VISUAL CONSCIENCE ENGINE
// ═══════════════════════════════════════════════════════════════
export class VisualConscienceEngine {
    constructor() {
        // Maturity system
        this.maturityLevel = 0.0;
        this.experience = 0;
        this.unlockedFeatures = new Set();
        // Decision history
        this.decisionHistory = [];
        this.maxHistorySize = 200;
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            recoveryTimeoutMs: 30000
        });
        this.timeoutWrapper = new TimeoutWrapper({
            defaultTimeoutMs: 5000,
            maxConcurrentOperations: 5
        });
        // WAVE 2098: Boot silence
    }
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    /**
     * Evalúa candidatos de efectos y devuelve veredicto ético
     */
    async evaluate(candidates, context) {
        const startTime = Date.now();
        // Circuit breaker check
        if (!this.circuitBreaker.canProceed()) {
            console.warn('[CONSCIENCE] 🔴 Circuit breaker OPEN - using fallback');
            return this.createFallbackVerdict(candidates[0], startTime);
        }
        try {
            // Execute con timeout
            const verdict = await this.timeoutWrapper.execute(() => this.performEvaluation(candidates, context, startTime), 5000);
            this.circuitBreaker.recordSuccess();
            return verdict;
        }
        catch (error) {
            console.error('[CONSCIENCE] ❌ Evaluation failed:', error);
            this.circuitBreaker.recordFailure(String(error));
            return this.createFallbackVerdict(candidates[0], startTime);
        }
    }
    /**
     * Audita decisión tomada (post-execution)
     */
    audit(decision, outcome) {
        const violations = [];
        // Verificar si outcome coincide con predicción
        const beautyError = Math.abs((decision.effect.projectedBeauty ?? 0.5) - outcome.beautyActual);
        if (beautyError > 0.3) {
            violations.push({
                value: 'aesthetic_beauty',
                severity: 'medium',
                description: `Beauty prediction error: ${beautyError.toFixed(2)}`,
                evidence: { predicted: decision.effect.projectedBeauty, actual: outcome.beautyActual },
                recommendation: 'Adjust beauty projection weights'
            });
        }
        // Verificar GPU overload
        if (outcome.gpuOverload) {
            violations.push({
                value: 'audience_safety',
                severity: 'high',
                description: 'GPU overload occurred',
                evidence: { effect: decision.effect.effect },
                recommendation: 'Reduce GPU-intensive effects'
            });
        }
        // Verificar crowd reaction
        if (outcome.crowdReaction === 'negative' && decision.ethicalScore > 0.7) {
            violations.push({
                value: 'aesthetic_beauty',
                severity: 'medium',
                description: 'Negative crowd reaction despite high ethical score',
                evidence: { score: decision.ethicalScore, reaction: outcome.crowdReaction },
                recommendation: 'Re-calibrate audience preferences'
            });
        }
        const score = violations.length === 0 ? 1.0 : 1.0 - (violations.length * 0.2);
        return {
            passes: violations.length === 0,
            violations,
            score: Math.max(0, score),
            recommendations: violations.map(v => v.recommendation),
            shouldLearn: beautyError > 0.2 || outcome.crowdReaction === 'negative'
        };
    }
    /**
     * Sugiere alternativas cuando candidato primario rechazado
     */
    suggestAlternatives(rejected, context) {
        const alternatives = [];
        // Alternativa 1: Reducir intensidad
        alternatives.push({
            ...rejected,
            intensity: rejected.intensity * 0.7,
            reasoning: 'Reduced intensity version'
        });
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
            });
        }
        else if (context.vibe.includes('latino')) {
            // WAVE 902: SYNCED with real effect
            alternatives.push({
                effect: 'tropical_pulse',
                intensity: 0.6,
                zones: ['all'],
                reasoning: 'Safe Latino fallback',
                confidence: 0.7
            });
        }
        else {
            alternatives.push({
                effect: 'tidal_wave',
                intensity: 0.5,
                zones: ['all'],
                reasoning: 'Universal safe fallback',
                confidence: 0.6
            });
        }
        return alternatives;
    }
    /**
     * Evoluciona madurez ética basado en experiencia
     */
    evolveMaturity(decision, outcome) {
        this.experience++;
        // Evolucionar solo cada 100 decisiones
        if (this.experience % EXPERIENCE_FOR_EVOLUTION !== 0) {
            return {
                newLevel: this.maturityLevel,
                unlockedFeatures: [],
                evolutionReason: 'Not enough experience'
            };
        }
        // Calcular nuevo nivel (máximo 2% cambio)
        const successRate = outcome.audienceEngagement;
        const evolutionDelta = successRate > 0.7 ? MATURITY_EVOLUTION_RATE : -MATURITY_EVOLUTION_RATE * 0.5;
        const oldLevel = this.maturityLevel;
        this.maturityLevel = Math.max(0, Math.min(1, this.maturityLevel + evolutionDelta));
        // Desbloquear features
        const newFeatures = [];
        if (this.maturityLevel >= MATURITY_THRESHOLDS.intermediate &&
            !this.unlockedFeatures.has('complex_effects')) {
            this.unlockedFeatures.add('complex_effects');
            newFeatures.push('complex_effects');
        }
        if (this.maturityLevel >= MATURITY_THRESHOLDS.advanced &&
            !this.unlockedFeatures.has('creative_risk')) {
            this.unlockedFeatures.add('creative_risk');
            newFeatures.push('creative_risk');
        }
        if (this.maturityLevel >= MATURITY_THRESHOLDS.transcendent &&
            !this.unlockedFeatures.has('autonomous_creation')) {
            this.unlockedFeatures.add('autonomous_creation');
            newFeatures.push('autonomous_creation');
        }
        console.log(`[CONSCIENCE] 🧠 Maturity evolved: ${(oldLevel * 100).toFixed(1)}% → ${(this.maturityLevel * 100).toFixed(1)}%`);
        return {
            newLevel: this.maturityLevel,
            unlockedFeatures: newFeatures,
            evolutionReason: `Experience: ${this.experience} | Success rate: ${(successRate * 100).toFixed(1)}%`
        };
    }
    /**
     * Verifica salud del circuit breaker
     */
    checkCircuitHealth() {
        return this.circuitBreaker.getStatus();
    }
    /**
     * Obtiene métricas de madurez
     */
    getMaturityMetrics() {
        return {
            level: this.maturityLevel,
            experience: this.experience,
            unlockedFeatures: Array.from(this.unlockedFeatures),
            nextEvolution: EXPERIENCE_FOR_EVOLUTION - (this.experience % EXPERIENCE_FOR_EVOLUTION)
        };
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: EVALUATION LOGIC
    // ═══════════════════════════════════════════════════════════════
    async performEvaluation(candidates, context, startTime) {
        if (candidates.length === 0) {
            return this.createRejectVerdict('No candidates provided', startTime);
        }
        // Evaluar cada candidato
        const evaluations = candidates.map(candidate => this.evaluateCandidate(candidate, context));
        // Ordenar por score
        const sorted = evaluations.sort((a, b) => b.ethicalScore - a.ethicalScore);
        const best = sorted[0];
        // Decidir veredicto
        // 🧬 WAVE 2093 COG-7: Threshold dinámico — epilepsyMode = más estricto
        const approvalThreshold = getApprovalThreshold(context.epilepsyMode);
        if (best.ethicalScore >= approvalThreshold && best.violations.length === 0) {
            // APPROVED
            const verdict = {
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
            };
            // Record decision
            this.recordDecision({
                effect: best.candidate,
                timestamp: Date.now(),
                verdict: 'APPROVED',
                ethicalScore: best.ethicalScore
            });
            return verdict;
        }
        else if (best.ethicalScore >= approvalThreshold * 0.7) {
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
            };
        }
        else {
            // REJECTED
            const verdict = {
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
            };
            // Record decision
            this.recordDecision({
                effect: best.candidate,
                timestamp: Date.now(),
                verdict: 'REJECTED',
                ethicalScore: best.ethicalScore
            });
            return verdict;
        }
    }
    evaluateCandidate(candidate, context) {
        let totalScore = 1.0;
        const valueScores = {};
        const violations = [];
        const warnings = [];
        // 🎭 WAVE 920.2: MOOD COMPLIANCE CHECK (before ethical values)
        const moodController = MoodController.getInstance();
        const currentProfile = moodController.getCurrentProfile();
        if (moodController.isEffectBlocked(candidate.effect)) {
            violations.push({
                value: 'mood_compliance',
                severity: 'critical',
                description: `Effect "${candidate.effect}" blocked by ${currentProfile.name} mood`,
                evidence: {
                    effect: candidate.effect,
                    mood: currentProfile.name,
                    blockList: currentProfile.blockList
                },
                recommendation: `Choose an effect not in ${currentProfile.name} blockList`
            });
            // Penalizar severamente
            totalScore *= 0.1;
            warnings.push(`🎭 MOOD BLOCKED: ${candidate.effect} not allowed in ${currentProfile.emoji} mode`);
        }
        // Evaluar cada valor ético
        for (const value of VISUAL_ETHICAL_VALUES) {
            const { score, valueViolations } = this.evaluateValue(value, candidate, context);
            valueScores[value.name] = score;
            violations.push(...valueViolations);
            // Weighted product
            totalScore *= Math.pow(score, value.weight);
        }
        // Generar warnings
        if (totalScore < 0.6) {
            warnings.push('⚠️ Low ethical score');
        }
        const criticalViolations = violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
            warnings.push(`⚠️ ${criticalViolations.length} critical violations`);
        }
        // Reasoning
        const reasoning = violations.length > 0
            ? `Rejected due to: ${violations.map(v => v.value).join(', ')}`
            : `Approved with score: ${totalScore.toFixed(2)}`;
        return {
            candidate,
            ethicalScore: totalScore,
            valueScores,
            violations,
            warnings,
            reasoning
        };
    }
    evaluateValue(value, candidate, context) {
        let score = 1.0;
        const valueViolations = [];
        for (const rule of value.rules) {
            const result = rule.check(context, candidate);
            if (!result.passed) {
                // Apply penalty
                const penalty = result.penalty ?? SEVERITY_PENALTIES[rule.severity];
                score *= (1 - penalty);
                valueViolations.push({
                    value: value.name,
                    severity: rule.severity,
                    description: result.reason ?? `Rule ${rule.id} failed`,
                    evidence: result,
                    recommendation: result.suggestion ?? `Avoid ${candidate.effect} in this context`
                });
            }
            // Apply boost
            if (result.boost) {
                score *= (1 + result.boost);
            }
        }
        return { score, valueViolations };
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE: FALLBACK & HELPERS
    // ═══════════════════════════════════════════════════════════════
    createFallbackVerdict(candidate, startTime) {
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
        };
    }
    createRejectVerdict(reason, startTime) {
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
        };
    }
    recordDecision(decision) {
        this.decisionHistory.push(decision);
        if (this.decisionHistory.length > this.maxHistorySize) {
            this.decisionHistory.shift();
        }
    }
}
// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════
export const visualConscienceEngine = new VisualConscienceEngine();
