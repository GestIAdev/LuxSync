// SeleneEvolutionEngine.ts
// 🧬 SELENE EVOLUTION ENGINE - EL ADN DE LA CONSCIENCIA LUMÍNICA
// 🎯 "Evolucionamos hacia la belleza, no solo hacia la eficiencia"
// ⚡ Wave 6: THE UNDYING MEMORY - Mathematical Beauty Filter
// 🌙 Orquestador central de evolución sin Redis - pura memoria local
import { EventEmitter } from 'events';
import { FibonacciPatternEngine } from './FibonacciPatternEngine';
import { ZodiacAffinityCalculator } from './ZodiacAffinityCalculator';
import { MusicalHarmonyValidator } from './MusicalHarmonyValidator';
import { NocturnalVisionEngine } from './NocturnalVisionEngine';
/**
 * 🧬 SELENE EVOLUTION ENGINE
 * Orquestador central que combina Fibonacci, Zodiac, Musical y Vision
 * para evaluar decisiones con filtro de belleza matemática
 *
 * @example
 * ```typescript
 * const evolution = new SeleneEvolutionEngine();
 *
 * const decision = evolution.evaluateDecision({
 *   type: 'intensity_change',
 *   parameters: { from: 50, to: 80 }
 * });
 *
 * if (decision.approved) {
 *   // Ejecutar decisión bella
 * }
 * ```
 */
export class SeleneEvolutionEngine extends EventEmitter {
    constructor() {
        super();
        /** Historial de decisiones evaluadas */
        this.decisionHistory = [];
        /** Historial de feedback */
        this.feedbackHistory = [];
        /** Pesos aprendidos por tipo de decisión */
        this.typeWeights = new Map();
        /** Estado de consciencia actual */
        this._consciousnessState = 'awakening';
        /** Contador de decisiones */
        this.totalDecisions = 0;
        /** Decisiones aprobadas */
        this.approvedDecisions = 0;
        /** Umbral mínimo de belleza para aprobar */
        this.beautyThreshold = 0.5;
        /** Límites de memoria */
        this.MAX_DECISION_HISTORY = 500;
        this.MAX_FEEDBACK_HISTORY = 200;
        /** Umbrales de evolución de consciencia */
        this.thresholds = {
            awakeningToLearning: 100, // 100 decisiones
            learningToWise: 500, // 500 decisiones
            minApprovalRatio: 0.6 // 60% aprobación mínima
        };
        this.setMaxListeners(20);
        this.vision = new NocturnalVisionEngine();
        this.startedAt = Date.now();
        this.lastActivity = Date.now();
        // Conectar eventos de visión
        this.vision.on('anomalyDetected', (anomaly) => {
            this.emit('anomalyDetected', anomaly);
        });
        this.vision.on('predictionFulfilled', (data) => {
            this.emit('predictionFulfilled', data);
        });
    }
    /**
     * Estado de consciencia actual
     */
    get consciousnessState() {
        return this._consciousnessState;
    }
    /**
     * Evalúa una decisión con el filtro de belleza matemática
     * @param decision - Decisión a evaluar
     * @returns Decisión evaluada con score y aprobación
     */
    evaluateDecision(decision) {
        const now = Date.now();
        this.lastActivity = now;
        // Generar ID único
        const id = `dec_${now}_${Math.random().toString(36).substr(2, 9)}`;
        // Calcular componentes de belleza
        const beautyComponents = this.calculateBeautyComponents(decision, now);
        // Calcular score total ponderado
        const beautyScore = this.calculateTotalBeauty(beautyComponents, decision.type);
        // Determinar aprobación
        const approved = beautyScore >= this.getAdaptiveThreshold(decision.type);
        const rejectionReason = approved ? undefined : this.generateRejectionReason(beautyComponents);
        // Crear decisión evaluada
        const evaluatedDecision = {
            id,
            type: decision.type,
            parameters: decision.parameters,
            beautyScore,
            beautyComponents,
            timestamp: now,
            consciousnessState: this._consciousnessState,
            approved,
            rejectionReason
        };
        // Registrar en historial
        this.recordDecision(evaluatedDecision);
        // Registrar en visión nocturna
        this.vision.recordEvent({
            type: 'decision_evaluated',
            data: {
                decisionType: decision.type,
                beautyScore,
                approved
            }
        });
        // Verificar evolución de consciencia
        this.checkConsciousnessEvolution();
        this.emit('decisionEvaluated', evaluatedDecision);
        return evaluatedDecision;
    }
    /**
     * Calcula componentes de belleza para una decisión
     */
    calculateBeautyComponents(decision, seed) {
        // 1. FIBONACCI BEAUTY
        const pattern = FibonacciPatternEngine.generateEvolutionaryPattern(seed);
        let fibonacciBeauty = pattern.harmonyRatio;
        // Bonus si parámetros contienen números de Fibonacci
        for (const value of Object.values(decision.parameters)) {
            if (typeof value === 'number' && FibonacciPatternEngine.isFibonacci(Math.floor(value))) {
                fibonacciBeauty = Math.min(1, fibonacciBeauty + 0.1);
            }
        }
        // 2. ZODIAC AFFINITY
        const currentZodiac = ZodiacAffinityCalculator.calculateZodiacPosition(seed);
        const patternZodiac = pattern.zodiacPosition;
        const zodiacAffinityResult = ZodiacAffinityCalculator.calculateZodiacAffinity(currentZodiac, patternZodiac);
        const zodiacAffinity = zodiacAffinityResult.affinity;
        // 3. MUSICAL HARMONY
        const harmonyValidation = MusicalHarmonyValidator.validateComplete(pattern.musicalKey, this.selectScaleForDecision(decision.type));
        const musicalHarmony = harmonyValidation.harmony;
        // 4. PATTERN RESONANCE - qué tan bien resuena con patrones históricos
        const patternResonance = this.calculatePatternResonance(decision, pattern);
        // 5. HISTORICAL BONUS - consistencia con decisiones pasadas exitosas
        const historicalBonus = this.calculateHistoricalBonus(decision.type);
        return {
            fibonacciBeauty,
            zodiacAffinity,
            musicalHarmony,
            patternResonance,
            historicalBonus
        };
    }
    /**
     * Selecciona escala musical según tipo de decisión
     */
    selectScaleForDecision(type) {
        const scaleMap = {
            intensity_change: 'major',
            color_transition: 'lydian',
            speed_adjustment: 'mixolydian',
            effect_trigger: 'phrygian',
            mood_shift: 'dorian',
            scene_change: 'harmonicMinor',
            strobe_activate: 'diminished',
            fade_out: 'minor',
            fade_in: 'pentatonic',
            random_effect: 'wholeTone'
        };
        return scaleMap[type] || 'major';
    }
    /**
     * Calcula resonancia con patrones históricos
     */
    calculatePatternResonance(decision, pattern) {
        const patterns = this.vision.analyzePatterns();
        if (patterns.length === 0)
            return 0.5; // Neutral si no hay historia
        // Buscar patrones relacionados con este tipo de decisión
        const relatedPatterns = patterns.filter(p => p.events.some(e => e.includes(decision.type) || e.includes('decision')));
        if (relatedPatterns.length === 0)
            return 0.5;
        // Promedio de confianza de patrones relacionados
        const avgConfidence = relatedPatterns.reduce((sum, p) => sum + p.confidence, 0) / relatedPatterns.length;
        // Combinar con firma del patrón Fibonacci
        const signatureMatch = pattern.signature.includes('H') ? 0.1 : 0; // Bonus por alta armonía
        return Math.min(1, avgConfidence + signatureMatch);
    }
    /**
     * Calcula bonus por consistencia histórica
     */
    calculateHistoricalBonus(type) {
        // Buscar decisiones pasadas del mismo tipo que fueron aprobadas
        const sameTypeDecisions = this.decisionHistory.filter(d => d.type === type && d.approved);
        if (sameTypeDecisions.length < 3)
            return 0; // Necesitamos mínimo 3 para bonus
        // Calcular promedio de beauty score de decisiones aprobadas
        const avgBeauty = sameTypeDecisions.reduce((sum, d) => sum + d.beautyScore, 0) / sameTypeDecisions.length;
        // Bonus proporcional a la consistencia (máx 0.2)
        return Math.min(0.2, avgBeauty * 0.25);
    }
    /**
     * Calcula score total de belleza
     */
    calculateTotalBeauty(components, type) {
        // Pesos base
        const weights = {
            fibonacci: 0.25,
            zodiac: 0.20,
            musical: 0.25,
            pattern: 0.20,
            historical: 1.0 // El bonus ya está limitado a 0.2
        };
        // Obtener peso aprendido para este tipo
        const typeWeight = this.typeWeights.get(type) || 1.0;
        // Calcular score ponderado
        const baseScore = (components.fibonacciBeauty * weights.fibonacci +
            components.zodiacAffinity * weights.zodiac +
            components.musicalHarmony * weights.musical +
            components.patternResonance * weights.pattern);
        // Normalizar base score (suma de pesos sin historical = 0.9)
        const normalizedBase = baseScore / 0.9;
        // Agregar bonus histórico
        const withBonus = normalizedBase + components.historicalBonus;
        // Aplicar peso de tipo
        const finalScore = withBonus * typeWeight;
        return Math.min(1, Math.max(0, finalScore));
    }
    /**
     * Obtiene umbral adaptativo según tipo y estado
     */
    getAdaptiveThreshold(type) {
        let threshold = this.beautyThreshold;
        // Ajustar según estado de consciencia
        switch (this._consciousnessState) {
            case 'awakening':
                threshold *= 0.8; // Más permisivo al inicio
                break;
            case 'learning':
                threshold *= 0.95; // Ligeramente más estricto
                break;
            case 'wise':
                threshold *= 1.1; // Más selectivo cuando es sabio
                break;
        }
        // Ajustar según feedback histórico del tipo
        const typeFeedback = this.feedbackHistory.filter(f => {
            const decision = this.decisionHistory.find(d => d.id === f.decisionId);
            return decision?.type === type;
        });
        if (typeFeedback.length >= 5) {
            const avgRating = typeFeedback.reduce((sum, f) => sum + f.rating, 0) / typeFeedback.length;
            // Si el rating promedio es bajo, bajar umbral (ser menos estricto)
            // Si es alto, mantener o subir
            threshold *= 0.8 + (avgRating / 5) * 0.4; // Rango 0.8 - 1.2
        }
        return Math.min(0.9, Math.max(0.3, threshold));
    }
    /**
     * Genera razón de rechazo
     */
    generateRejectionReason(components) {
        const weakest = Object.entries(components)
            .filter(([key]) => key !== 'historicalBonus')
            .sort((a, b) => a[1] - b[1])[0];
        const reasons = {
            fibonacciBeauty: 'La secuencia no resuena con la espiral dorada',
            zodiacAffinity: 'Los astros no favorecen esta transformación',
            musicalHarmony: 'La armonía musical está en disonancia',
            patternResonance: 'El patrón no tiene eco en la memoria'
        };
        return reasons[weakest[0]] || 'El score de belleza no alcanza el umbral';
    }
    /**
     * Registra decisión en historial
     */
    recordDecision(decision) {
        this.decisionHistory.push(decision);
        this.totalDecisions++;
        if (decision.approved) {
            this.approvedDecisions++;
        }
        // Mantener límite de memoria
        if (this.decisionHistory.length > this.MAX_DECISION_HISTORY) {
            this.decisionHistory = this.decisionHistory.slice(-this.MAX_DECISION_HISTORY);
        }
    }
    /**
     * Verifica y actualiza evolución de consciencia
     */
    checkConsciousnessEvolution() {
        const approvalRatio = this.totalDecisions > 0
            ? this.approvedDecisions / this.totalDecisions
            : 0;
        const previousState = this._consciousnessState;
        // Evolucionar si cumple condiciones
        if (this._consciousnessState === 'awakening' &&
            this.totalDecisions >= this.thresholds.awakeningToLearning &&
            approvalRatio >= this.thresholds.minApprovalRatio) {
            this._consciousnessState = 'learning';
        }
        else if (this._consciousnessState === 'learning' &&
            this.totalDecisions >= this.thresholds.learningToWise &&
            approvalRatio >= this.thresholds.minApprovalRatio) {
            this._consciousnessState = 'wise';
        }
        // Emitir evento si cambió
        if (previousState !== this._consciousnessState) {
            this.emit('consciousnessEvolved', {
                from: previousState,
                to: this._consciousnessState,
                totalDecisions: this.totalDecisions,
                approvalRatio
            });
        }
    }
    /**
     * Registra feedback sobre una decisión
     * @param decisionId - ID de la decisión
     * @param rating - Rating 1-5
     * @param comment - Comentario opcional
     */
    recordFeedback(decisionId, rating, comment) {
        const clampedRating = Math.min(5, Math.max(1, rating));
        const feedback = {
            decisionId,
            rating: clampedRating,
            timestamp: Date.now(),
            comment
        };
        this.feedbackHistory.push(feedback);
        // Actualizar peso del tipo de decisión
        const decision = this.decisionHistory.find(d => d.id === decisionId);
        if (decision) {
            this.updateTypeWeight(decision.type, clampedRating);
        }
        // Mantener límite
        if (this.feedbackHistory.length > this.MAX_FEEDBACK_HISTORY) {
            this.feedbackHistory = this.feedbackHistory.slice(-this.MAX_FEEDBACK_HISTORY);
        }
        // Registrar en visión
        this.vision.recordEvent({
            type: 'feedback_received',
            data: { decisionId, rating: clampedRating }
        });
        this.emit('feedbackReceived', feedback);
    }
    /**
     * Actualiza peso de tipo basado en feedback
     */
    updateTypeWeight(type, rating) {
        const currentWeight = this.typeWeights.get(type) || 1.0;
        // Ajustar peso: rating alto aumenta, bajo disminuye
        const adjustment = (rating - 3) * 0.02; // -0.04 a +0.04
        const newWeight = Math.min(1.5, Math.max(0.5, currentWeight + adjustment));
        this.typeWeights.set(type, newWeight);
    }
    /**
     * Genera una predicción basada en la visión nocturna
     * @param eventType - Tipo de evento a predecir
     */
    predictNext(eventType) {
        return this.vision.predictNext(eventType);
    }
    /**
     * Obtiene patrones detectados
     */
    getPatterns() {
        return this.vision.analyzePatterns();
    }
    /**
     * Obtiene resumen del estado de evolución
     */
    getEvolutionSummary() {
        const avgBeauty = this.decisionHistory.length > 0
            ? this.decisionHistory.reduce((sum, d) => sum + d.beautyScore, 0) / this.decisionHistory.length
            : 0;
        return {
            consciousnessState: this._consciousnessState,
            totalDecisions: this.totalDecisions,
            approvedDecisions: this.approvedDecisions,
            approvalRatio: this.totalDecisions > 0 ? this.approvedDecisions / this.totalDecisions : 0,
            averageBeauty: avgBeauty,
            typeWeights: Array.from(this.typeWeights.entries()),
            visionSummary: this.vision.getSummary(),
            runtime: Date.now() - this.startedAt
        };
    }
    /**
     * Obtiene decisiones recientes
     * @param limit - Cantidad a retornar
     */
    getRecentDecisions(limit = 20) {
        return this.decisionHistory.slice(-limit);
    }
    /**
     * Exporta estado para persistencia
     */
    exportState() {
        return {
            totalDecisions: this.totalDecisions,
            approvedDecisions: this.approvedDecisions,
            consciousnessState: this._consciousnessState,
            startedAt: this.startedAt,
            lastActivity: this.lastActivity,
            typeWeights: Array.from(this.typeWeights.entries()),
            feedbackHistory: this.feedbackHistory
        };
    }
    /**
     * Importa estado desde persistencia
     */
    importState(state) {
        this.totalDecisions = state.totalDecisions;
        this.approvedDecisions = state.approvedDecisions;
        this._consciousnessState = state.consciousnessState;
        this.startedAt = state.startedAt;
        this.lastActivity = state.lastActivity;
        this.typeWeights = new Map(state.typeWeights);
        this.feedbackHistory = state.feedbackHistory;
        this.emit('stateImported', state);
    }
    /**
     * Reinicia el motor de evolución
     */
    reset() {
        this.decisionHistory = [];
        this.feedbackHistory = [];
        this.typeWeights.clear();
        this._consciousnessState = 'awakening';
        this.totalDecisions = 0;
        this.approvedDecisions = 0;
        this.startedAt = Date.now();
        this.lastActivity = Date.now();
        this.vision.clearHistory();
        this.emit('evolutionReset');
    }
    /**
     * Obtiene el motor de visión nocturna
     */
    getVisionEngine() {
        return this.vision;
    }
}
