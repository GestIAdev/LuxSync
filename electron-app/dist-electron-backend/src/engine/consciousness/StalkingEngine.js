/**
 * 🐆 STALKING ENGINE
 * "La paciencia del depredador - observa, aprende, espera el momento"
 *
 * WAVE 5: THE HUNT - Capa de Cognición
 *
 * CAPACIDADES:
 * - Mantiene top 3 candidatos (patterns con mayor beauty)
 * - Solo cambia objetivo si nuevo >10% mejor Y tendencia rising
 * - Requiere 5-10 ciclos de observación antes de "strike"
 *
 * FILOSOFÍA FELINA:
 * Un gato no persigue todo lo que se mueve.
 * Observa. Evalúa. Espera. Y cuando salta... no falla.
 */
// ============================================
// 🐆 STALKING ENGINE
// ============================================
export class StalkingEngine {
    constructor(config) {
        // === Configuración ===
        this.config = {
            minStalkingCycles: 5,
            maxStalkingCycles: 10,
            switchThreshold: 0.10, // 10% mejora mínima
            maxCandidates: 3,
            targetTimeoutMs: 5 * 60 * 1000 // 5 minutos
        };
        // === Estado interno ===
        this.activeStalks = new Map();
        this.currentTarget = null;
        this.targetAcquiredAt = null;
        this.cycleCount = 0;
        // === Historial para aprendizaje ===
        this.recentDecisions = [];
        this.maxDecisionHistory = 50;
        if (config) {
            this.config = { ...this.config, ...config };
        }
        console.log('🐆 [STALKING] Engine initialized');
    }
    // ============================================
    // 🔍 IDENTIFICAR PRESAS
    // ============================================
    /**
     * Identificar candidatos a caza del pool de patrones actuales
     * @param allPatterns Mapa de todos los patrones observados
     * @returns Top 3 candidatos ordenados por huntWorthiness
     */
    identifyPreyCandidates(allPatterns) {
        // Filtrar patterns con suficiente data (min 5 occurrences)
        const viablePatterns = Array.from(allPatterns.values())
            .filter(p => p.occurrences >= 5);
        if (viablePatterns.length === 0) {
            console.log('🐆 [STALKING] No viable prey found (need 5+ occurrences)');
            return [];
        }
        // Ordenar por beauty (top N)
        const topPatterns = viablePatterns
            .sort((a, b) => b.avgBeauty - a.avgBeauty)
            .slice(0, this.config.maxCandidates);
        // Convertir a PreyCandidate
        const candidates = topPatterns.map(pattern => {
            const key = this.getPatternKey(pattern);
            const existingStalk = this.activeStalks.get(key);
            if (existingStalk) {
                // Ya estamos stalkeando - actualizar info
                return this.updateStalkingInfo(existingStalk, pattern);
            }
            else {
                // Nueva presa - iniciar stalking
                return this.createNewCandidate(pattern);
            }
        });
        // Actualizar mapa de stalks activos
        const topKeys = new Set(candidates.map(c => this.getPatternKey(c.pattern)));
        // Limpiar stalks de patterns que ya no son top
        this.activeStalks.forEach((_, key) => {
            if (!topKeys.has(key)) {
                this.activeStalks.delete(key);
                console.log(`🐆 [STALKING] Stopped stalking ${key} (no longer top ${this.config.maxCandidates})`);
            }
        });
        // Guardar nuevos stalks
        for (const candidate of candidates) {
            const key = this.getPatternKey(candidate.pattern);
            this.activeStalks.set(key, candidate);
        }
        // Calcular hunt worthiness y ordenar
        return candidates
            .map(c => this.calculateHuntWorthiness(c))
            .sort((a, b) => b.stalkingInfo.huntWorthiness - a.stalkingInfo.huntWorthiness);
    }
    // ============================================
    // 🎯 DECIDIR SI ATACAR
    // ============================================
    /**
     * Decidir si es momento de "atacar" (cambiar escena/estado)
     * @param clusterHealth Salud general del sistema (0-1)
     * @returns Decisión de caza
     */
    decideHunt(clusterHealth = 0.8) {
        this.cycleCount++;
        // Si no hay candidatos activos
        if (this.activeStalks.size === 0) {
            return this.createDecision(false, null, 'No prey candidates available', 0);
        }
        // Obtener mejor candidato actual
        const candidates = Array.from(this.activeStalks.values())
            .sort((a, b) => b.stalkingInfo.huntWorthiness - a.stalkingInfo.huntWorthiness);
        const bestCandidate = candidates[0];
        // ¿Deberíamos cambiar de objetivo?
        if (this.currentTarget) {
            const improvement = this.calculateImprovement(this.currentTarget, bestCandidate);
            if (improvement > this.config.switchThreshold &&
                bestCandidate.pattern.beautyTrend === 'rising') {
                console.log(`🐆 [STALKING] Switching target: ${improvement * 100}% better`);
                this.currentTarget = bestCandidate;
                this.targetAcquiredAt = Date.now();
            }
        }
        else {
            // No tenemos objetivo - adquirir el mejor
            this.currentTarget = bestCandidate;
            this.targetAcquiredAt = Date.now();
        }
        // Verificar timeout de objetivo
        if (this.targetAcquiredAt &&
            (Date.now() - this.targetAcquiredAt) > this.config.targetTimeoutMs) {
            console.log('🐆 [STALKING] Target timeout - abandoning');
            this.currentTarget = null;
            this.targetAcquiredAt = null;
            return this.createDecision(false, null, 'Target timeout - need new prey', 0.3);
        }
        // Evaluar si debemos atacar
        if (!this.currentTarget) {
            return this.createDecision(false, null, 'No target acquired', 0);
        }
        const { stalkingInfo, pattern } = this.currentTarget;
        // Condiciones para strike:
        // 1. Suficientes ciclos de observación
        const enoughObservation = stalkingInfo.cyclesObserved >= this.config.minStalkingCycles;
        // 2. Beauty en tendencia positiva o estable alta
        const goodTrend = pattern.beautyTrend === 'rising' ||
            (pattern.beautyTrend === 'stable' && pattern.avgBeauty > 0.8);
        // 3. Hunt worthiness alto
        const worthyPrey = stalkingInfo.huntWorthiness >= 0.7;
        // 4. Cluster health suficiente
        const healthyCluster = clusterHealth >= 0.6;
        // 5. No hemos excedido max ciclos (forzar decisión)
        const mustDecide = stalkingInfo.cyclesObserved >= this.config.maxStalkingCycles;
        const shouldStrike = (enoughObservation && goodTrend && worthyPrey && healthyCluster) || mustDecide;
        // Calcular confianza
        const confidence = this.calculateConfidence(enoughObservation, goodTrend, worthyPrey, healthyCluster, mustDecide);
        // Generar reasoning
        const reasoning = this.generateReasoning(enoughObservation, goodTrend, worthyPrey, healthyCluster, mustDecide);
        const decision = this.createDecision(shouldStrike, this.currentTarget, reasoning, confidence);
        // Guardar en historial
        this.recentDecisions.push(decision);
        if (this.recentDecisions.length > this.maxDecisionHistory) {
            this.recentDecisions.shift();
        }
        // Si atacamos, resetear objetivo
        if (shouldStrike) {
            console.log(`🐆 [STALKING] STRIKE RECOMMENDED: ${this.getPatternKey(pattern)}`);
            this.currentTarget = null;
            this.targetAcquiredAt = null;
        }
        return decision;
    }
    // ============================================
    // 📊 MÉTODOS AUXILIARES
    // ============================================
    /**
     * Crear clave única para un patrón
     */
    getPatternKey(pattern) {
        return `${pattern.note}-${pattern.element}`;
    }
    /**
     * Crear nuevo candidato a presa
     */
    createNewCandidate(pattern) {
        return {
            pattern: {
                note: pattern.note,
                element: pattern.element,
                avgBeauty: pattern.avgBeauty,
                occurrences: pattern.occurrences,
                beautyTrend: pattern.beautyTrend,
                emotionalTone: pattern.emotionalTone,
            },
            stalkingInfo: {
                firstSpottedAt: Date.now(),
                cyclesObserved: 1,
                beautyEvolution: [pattern.avgBeauty],
                stabilityScore: 0.5, // Neutral al inicio
                huntWorthiness: 0.0, // Se calcula después
            }
        };
    }
    /**
     * Actualizar info de stalking para presa existente
     */
    updateStalkingInfo(existing, updatedPattern) {
        const newBeautyEvolution = [
            ...existing.stalkingInfo.beautyEvolution.slice(-9), // Últimos 9
            updatedPattern.avgBeauty
        ];
        // Calcular estabilidad basado en varianza
        const stabilityScore = this.calculateStability(newBeautyEvolution);
        return {
            pattern: {
                note: updatedPattern.note,
                element: updatedPattern.element,
                avgBeauty: updatedPattern.avgBeauty,
                occurrences: updatedPattern.occurrences,
                beautyTrend: updatedPattern.beautyTrend,
                emotionalTone: updatedPattern.emotionalTone,
            },
            stalkingInfo: {
                ...existing.stalkingInfo,
                cyclesObserved: existing.stalkingInfo.cyclesObserved + 1,
                beautyEvolution: newBeautyEvolution,
                stabilityScore,
            }
        };
    }
    /**
     * Calcular estabilidad basado en varianza de beauty
     */
    calculateStability(beautyHistory) {
        if (beautyHistory.length < 2)
            return 0.5;
        const avg = beautyHistory.reduce((sum, b) => sum + b, 0) / beautyHistory.length;
        const variance = beautyHistory.reduce((sum, b) => sum + Math.pow(b - avg, 2), 0) / beautyHistory.length;
        // Invertir: menor varianza = mayor estabilidad
        // Varianza típica está entre 0-0.1, mapeamos a 1-0
        return Math.max(0, Math.min(1, 1 - variance * 10));
    }
    /**
     * Calcular hunt worthiness (qué tan "cazable" es esta presa)
     */
    calculateHuntWorthiness(candidate) {
        const { pattern, stalkingInfo } = candidate;
        // Factores:
        // 1. Beauty actual (40%)
        const beautyFactor = pattern.avgBeauty * 0.4;
        // 2. Tendencia positiva (25%)
        const trendFactor = pattern.beautyTrend === 'rising' ? 0.25 :
            pattern.beautyTrend === 'stable' ? 0.15 : 0.05;
        // 3. Estabilidad (20%)
        const stabilityFactor = stalkingInfo.stabilityScore * 0.2;
        // 4. Ciclos observados - más observación = más confianza (15%)
        const observationFactor = Math.min(stalkingInfo.cyclesObserved / this.config.maxStalkingCycles, 1) * 0.15;
        const huntWorthiness = beautyFactor + trendFactor + stabilityFactor + observationFactor;
        return {
            ...candidate,
            stalkingInfo: {
                ...stalkingInfo,
                huntWorthiness: Math.min(1, huntWorthiness)
            }
        };
    }
    /**
     * Calcular mejora entre dos candidatos
     */
    calculateImprovement(current, challenger) {
        return (challenger.stalkingInfo.huntWorthiness - current.stalkingInfo.huntWorthiness) /
            Math.max(0.01, current.stalkingInfo.huntWorthiness);
    }
    /**
     * Calcular confianza de la decisión
     */
    calculateConfidence(enoughObs, goodTrend, worthyPrey, healthyCluster, mustDecide) {
        if (mustDecide)
            return 0.6; // Forzado, menos confianza
        let confidence = 0.5;
        if (enoughObs)
            confidence += 0.15;
        if (goodTrend)
            confidence += 0.15;
        if (worthyPrey)
            confidence += 0.15;
        if (healthyCluster)
            confidence += 0.05;
        return Math.min(1, confidence);
    }
    /**
     * Generar explicación de la decisión
     */
    generateReasoning(enoughObs, goodTrend, worthyPrey, healthyCluster, mustDecide) {
        if (mustDecide) {
            return 'Max stalking cycles reached - forced decision';
        }
        const factors = [];
        if (!enoughObs)
            factors.push('Need more observation cycles');
        if (!goodTrend)
            factors.push('Beauty trend not favorable');
        if (!worthyPrey)
            factors.push('Hunt worthiness too low');
        if (!healthyCluster)
            factors.push('Cluster health insufficient');
        if (factors.length === 0) {
            return 'All conditions met - optimal strike moment';
        }
        return `Waiting: ${factors.join(', ')}`;
    }
    /**
     * Crear objeto de decisión
     */
    createDecision(shouldStrike, target, reasoning, confidence) {
        return { shouldStrike, targetPrey: target, reasoning, confidence };
    }
    // ============================================
    // 📈 GETTERS Y UTILIDADES
    // ============================================
    /** Obtener objetivo actual */
    getCurrentTarget() {
        return this.currentTarget;
    }
    /** Obtener todos los stalks activos */
    getActiveStalks() {
        return Array.from(this.activeStalks.values());
    }
    /** Obtener historial de decisiones */
    getDecisionHistory() {
        return [...this.recentDecisions];
    }
    /** Obtener estadísticas */
    getStats() {
        return {
            activeStalks: this.activeStalks.size,
            cycleCount: this.cycleCount,
            hasTarget: this.currentTarget !== null,
            targetKey: this.currentTarget
                ? this.getPatternKey(this.currentTarget.pattern)
                : null,
            recentDecisions: this.recentDecisions.length
        };
    }
    /** Reset del motor */
    reset() {
        this.activeStalks.clear();
        this.currentTarget = null;
        this.targetAcquiredAt = null;
        this.cycleCount = 0;
        this.recentDecisions = [];
        console.log('🐆 [STALKING] Engine reset');
    }
}
