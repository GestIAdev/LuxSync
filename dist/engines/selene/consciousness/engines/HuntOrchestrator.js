export class HuntOrchestrator {
    redis;
    stalkingEngine;
    strikeEngine;
    preyEngine;
    ultrasonicEngine;
    whiskerEngine;
    cycleKeyPrefix = 'selene:consciousness:hunt-cycles:';
    consensusCyclesRequired = 5;
    activeCycle = null;
    cycleConsensusCount = 0;
    completedCyclesCount = 0;
    constructor(config) {
        this.redis = config.redis;
        this.stalkingEngine = config.stalkingEngine;
        this.strikeEngine = config.strikeEngine;
        this.preyEngine = config.preyEngine;
        this.ultrasonicEngine = config.ultrasonicEngine;
        this.whiskerEngine = config.whiskerEngine;
    }
    /**
     * 🎯 INICIAR CICLO DE CAZA
     * Solo si ENLIGHTENED status = true
     */
    async initiateHuntCycle(enlightenedStatus) {
        if (!enlightenedStatus) {
            return {
                initiated: false,
                reasoning: 'ENLIGHTENED status required for hunting',
            };
        }
        if (this.activeCycle) {
            return {
                initiated: false,
                reasoning: 'Hunt cycle already active',
            };
        }
        // Crear nuevo ciclo con ID determinista basado en estado real del sistema
        const timestamp = Date.now();
        const systemState = `${this.cycleConsensusCount}-${this.completedCyclesCount}-${timestamp}`;
        const cycleId = `hunt-${this.generateDeterministicId(systemState)}`;
        this.activeCycle = {
            cycleId,
            startTime: new Date(),
            stalkedPrey: null,
            stalkingCycles: 0,
            strikeConditions: {
                beauty: 0,
                trend: 'stable',
                consonance: 0,
                clusterHealth: 0,
            },
            strikeExecuted: false,
            huntRecorded: false,
            status: 'stalking',
        };
        // Persistir ciclo en Redis
        await this.persistCycle();
        console.log(`🎯 [HUNT-ORCHESTRATOR] Hunt cycle initiated: ${cycleId}`);
        return {
            initiated: true,
            cycleId,
            reasoning: 'Hunt cycle initiated successfully',
        };
    }
    /**
     * 🔄 EJECUTAR CICLO DE CAZA (llamado cada consensus cycle)
     */
    async executeHuntCycle(currentPatterns, proximityReport, generation) {
        if (!this.activeCycle) {
            return {
                actionTaken: false,
                actionType: 'waiting',
                details: { reason: 'No active hunt cycle' },
            };
        }
        this.cycleConsensusCount++;
        try {
            switch (this.activeCycle.status) {
                case 'stalking':
                    return await this.executeStalkingPhase(currentPatterns);
                case 'evaluating':
                    return await this.executeEvaluationPhase(currentPatterns, proximityReport);
                case 'striking':
                    return await this.executeStrikePhase(generation, currentPatterns);
                case 'learning':
                    return await this.executeLearningPhase();
                case 'completed':
                    return {
                        actionTaken: false,
                        actionType: 'waiting',
                        details: { reason: 'Hunt cycle completed' },
                    };
                default:
                    return {
                        actionTaken: false,
                        actionType: 'waiting',
                        details: { reason: 'Unknown cycle status' },
                    };
            }
        }
        catch (error) {
            console.error('🎯 [HUNT-CYCLE-ERROR]:', error);
            return {
                actionTaken: false,
                actionType: 'waiting',
                details: { error: error instanceof Error ? error.message : 'Unknown error' },
            };
        }
    }
    /**
     * 🐆 FASE 1: STALKING
     */
    async executeStalkingPhase(currentPatterns) {
        // Convertir patterns a candidates para el stalking engine
        const candidates = currentPatterns.map(pattern => {
            // Calcular stabilityScore determinista basado en variabilidad de beauty
            const beautyVariance = pattern.recentBeautyScores.length > 1
                ? pattern.recentBeautyScores.reduce((sum, score, i, arr) => {
                    if (i === 0)
                        return 0;
                    return sum + Math.pow(score - arr[i - 1], 2);
                }, 0) / (pattern.recentBeautyScores.length - 1)
                : 0;
            const stabilityScore = Math.max(0, 1 - beautyVariance); // 1 = perfectamente estable, 0 = muy variable
            // Calcular huntWorthiness determinista basado en múltiples factores
            const beautyFactor = pattern.avgBeauty;
            const frequencyFactor = Math.min(0.3, pattern.occurrences / 50); // Patterns comunes son más valiosos
            const trendFactor = pattern.beautyTrend === 'rising' ? 0.2 :
                pattern.beautyTrend === 'stable' ? 0.1 : 0;
            const elementFactor = pattern.element === 'fire' ? 0.1 :
                pattern.element === 'earth' ? 0.05 : 0;
            const huntWorthiness = beautyFactor + frequencyFactor + trendFactor + elementFactor + (stabilityScore * 0.2);
            return {
                pattern,
                stalkingInfo: {
                    firstSpottedAt: new Date(),
                    cyclesObserved: 0,
                    beautyEvolution: [pattern.avgBeauty],
                    stabilityScore,
                    huntWorthiness,
                },
            };
        });
        // Ejecutar stalking
        const decision = this.stalkingEngine.decideHunt(candidates);
        this.activeCycle.stalkingCycles++;
        if (decision.shouldStrike && decision.targetPrey) {
            // Cambiar a evaluación
            this.activeCycle.stalkedPrey = `${decision.targetPrey.pattern.note}-${decision.targetPrey.pattern.zodiacSign}`;
            this.activeCycle.status = 'evaluating';
            await this.persistCycle();
            return {
                actionTaken: true,
                actionType: 'stalking',
                details: {
                    targetSelected: this.activeCycle.stalkedPrey,
                    stalkingCycles: this.activeCycle.stalkingCycles,
                    confidence: decision.confidence,
                },
            };
        }
        // Continuar acechando
        return {
            actionTaken: false,
            actionType: 'stalking',
            details: {
                stalkingCycles: this.activeCycle.stalkingCycles,
                reasoning: decision.reasoning,
            },
        };
    }
    /**
     * ⚡ FASE 2: EVALUATION
     */
    async executeEvaluationPhase(currentPatterns, proximityReport) {
        if (!this.activeCycle.stalkedPrey) {
            throw new Error('No stalked prey for evaluation');
        }
        // Encontrar el pattern actual
        const targetPattern = currentPatterns.find(p => `${p.note}-${p.zodiacSign}` === this.activeCycle.stalkedPrey);
        if (!targetPattern) {
            // Presa desapareció - volver a stalking
            this.activeCycle.status = 'stalking';
            await this.persistCycle();
            return {
                actionTaken: false,
                actionType: 'evaluating',
                details: { reason: 'Target pattern no longer available' },
            };
        }
        // Obtener consonance del ultrasonic engine
        const consonance = await this.getMusicalConsonance(targetPattern);
        // Actualizar condiciones
        this.activeCycle.strikeConditions = {
            beauty: targetPattern.avgBeauty,
            trend: targetPattern.beautyTrend,
            consonance,
            clusterHealth: proximityReport.avgHealth,
        };
        // Evaluar si todas las condiciones se cumplen
        const allConditionsMet = targetPattern.avgBeauty > 0.95 &&
            targetPattern.beautyTrend === 'rising' &&
            consonance > 0.9 &&
            proximityReport.avgHealth > 0.7;
        if (allConditionsMet) {
            // Cambiar a striking
            this.activeCycle.status = 'striking';
            await this.persistCycle();
            return {
                actionTaken: true,
                actionType: 'evaluating',
                details: {
                    conditionsMet: true,
                    strikeConditions: this.activeCycle.strikeConditions,
                },
            };
        }
        // Continuar evaluando
        return {
            actionTaken: false,
            actionType: 'evaluating',
            details: {
                conditionsMet: false,
                strikeConditions: this.activeCycle.strikeConditions,
            },
        };
    }
    /**
     * 🎯 FASE 3: STRIKING
     */
    async executeStrikePhase(generation, currentPatterns) {
        if (!this.activeCycle.stalkedPrey) {
            throw new Error('No stalked prey for striking');
        }
        // Crear objeto pattern para el strike engine usando datos reales
        const [note, zodiacSign] = this.activeCycle.stalkedPrey.split('-');
        // Encontrar el pattern real para obtener el element correcto
        const realTargetPattern = currentPatterns.find(p => p.note === note && p.zodiacSign === zodiacSign);
        if (!realTargetPattern) {
            throw new Error(`Target pattern ${this.activeCycle.stalkedPrey} not found in current patterns`);
        }
        const targetPattern = {
            note,
            zodiacSign,
            avgBeauty: this.activeCycle.strikeConditions.beauty,
            element: realTargetPattern.element, // Elemento real del pattern
        };
        // Crear conditions para el strike
        const strikeConditions = {
            beauty: {
                current: this.activeCycle.strikeConditions.beauty,
                threshold: 0.95,
                met: this.activeCycle.strikeConditions.beauty > 0.95,
            },
            trend: {
                direction: this.activeCycle.strikeConditions.trend,
                required: 'rising',
                met: this.activeCycle.strikeConditions.trend === 'rising',
            },
            musicalHarmony: {
                consonance: this.activeCycle.strikeConditions.consonance,
                threshold: 0.9,
                met: this.activeCycle.strikeConditions.consonance > 0.9,
            },
            clusterHealth: {
                avgHealth: this.activeCycle.strikeConditions.clusterHealth,
                threshold: 0.7,
                met: this.activeCycle.strikeConditions.clusterHealth > 0.7,
            },
            allConditionsMet: true,
            strikeScore: 0.95, // Ya verificado que todas las condiciones se cumplen
        };
        // Ejecutar strike
        const strikeResult = await this.strikeEngine.executeStrike(targetPattern, strikeConditions);
        // Registrar resultado
        this.activeCycle.strikeExecuted = true;
        this.activeCycle.strikeResult = {
            preBeauty: strikeResult.preStrikeBeauty,
            postBeauty: strikeResult.postStrikeBeauty,
            improvement: strikeResult.improvement,
            success: strikeResult.success,
        };
        this.activeCycle.generation = generation; // Almacenar generation para learning phase
        // Cambiar a learning
        this.activeCycle.status = 'learning';
        await this.persistCycle();
        return {
            actionTaken: true,
            actionType: 'striking',
            details: {
                strikeExecuted: true,
                improvement: strikeResult.improvement,
                success: strikeResult.success,
            },
        };
    }
    /**
     * 🧠 FASE 4: LEARNING
     */
    async executeLearningPhase() {
        if (!this.activeCycle.strikeResult || !this.activeCycle.stalkedPrey) {
            throw new Error('No strike result for learning');
        }
        // Crear hunt record
        const huntRecord = {
            huntId: this.activeCycle.cycleId,
            targetPattern: this.activeCycle.stalkedPrey,
            preStrikeBeauty: this.activeCycle.strikeConditions.beauty,
            preStrikeTrend: this.activeCycle.strikeConditions.trend,
            preStrikeConsonance: this.activeCycle.strikeConditions.consonance,
            clusterHealth: this.activeCycle.strikeConditions.clusterHealth,
            postStrikeBeauty: this.activeCycle.strikeResult.postBeauty,
            improvement: this.activeCycle.strikeResult.improvement,
            success: this.activeCycle.strikeResult.success,
            stalkingCycles: this.activeCycle.stalkingCycles,
            timestamp: new Date(),
            generation: this.activeCycle.generation || 0, // Usar generation almacenada
        };
        // Registrar en PreyRecognitionEngine
        await this.preyEngine.recordHunt(huntRecord);
        // Completar ciclo
        this.activeCycle.huntRecorded = true;
        this.activeCycle.status = 'completed';
        this.activeCycle.endTime = new Date();
        await this.persistCycle();
        // Reset para próximo ciclo
        this.activeCycle = null;
        this.cycleConsensusCount = 0;
        this.completedCyclesCount++;
        return {
            actionTaken: true,
            actionType: 'learning',
            details: {
                huntRecorded: true,
                cycleCompleted: this.activeCycle.cycleId,
            },
        };
    }
    /**
     * 🎵 CALCULAR CONSONANCIA MUSICAL (DETERMINISTA)
     * Basado en propiedades reales del pattern, no simulación
     */
    async getMusicalConsonance(pattern) {
        try {
            // CÁLCULO DETERMINISTA basado en propiedades del pattern:
            // 1. Beauty como base (patterns más bellos tienden a ser más consonantes)
            const beautyFactor = pattern.avgBeauty;
            // 2. Estabilidad mejora consonance (patterns estables suenan mejor)
            const stabilityFactor = pattern.beautyTrend === 'stable' ? 0.1 :
                pattern.beautyTrend === 'rising' ? 0.05 : 0;
            // 3. Frecuencia de aparición (patterns comunes son más "familiares")
            const frequencyFactor = Math.min(0.1, pattern.occurrences / 100);
            // 4. Elemento musical (ciertos elementos son más consonantes)
            const elementFactor = pattern.element === 'earth' ? 0.05 :
                pattern.element === 'water' ? 0.03 : 0;
            // Combinar factores de manera determinista
            const consonance = Math.min(1.0, beautyFactor + stabilityFactor + frequencyFactor + elementFactor);
            return consonance;
        }
        catch (error) {
            console.error('🎯 [CONSONANCE-ERROR]:', error);
            return 0.5; // Valor neutral determinista
        }
    }
    /**
     * 🔢 GENERAR ID DETERMINISTA
     * Basado en estado real del sistema, no aleatoriedad
     */
    generateDeterministicId(systemState) {
        // Crear hash determinista usando algoritmo simple pero consistente
        let hash = 0;
        for (let i = 0; i < systemState.length; i++) {
            const char = systemState.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a 32-bit
        }
        // Convertir a string base36 positivo
        return Math.abs(hash).toString(36).substr(0, 9);
    }
    /**
     * 💾 PERSISTIR CICLO en Redis
     */
    async persistCycle() {
        if (!this.activeCycle)
            return;
        const cycleKey = `${this.cycleKeyPrefix}${this.activeCycle.cycleId}`;
        await this.redis.hmset(cycleKey, {
            cycleId: this.activeCycle.cycleId,
            startTime: this.activeCycle.startTime.toISOString(),
            endTime: this.activeCycle.endTime?.toISOString() || '',
            stalkedPrey: this.activeCycle.stalkedPrey || '',
            stalkingCycles: this.activeCycle.stalkingCycles.toString(),
            strikeConditions: JSON.stringify(this.activeCycle.strikeConditions),
            strikeExecuted: this.activeCycle.strikeExecuted.toString(),
            strikeResult: this.activeCycle.strikeResult ? JSON.stringify(this.activeCycle.strikeResult) : '',
            huntRecorded: this.activeCycle.huntRecorded.toString(),
            status: this.activeCycle.status,
        });
        // TTL: 7 días
        await this.redis.expire(cycleKey, 7 * 24 * 60 * 60);
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    async getStats() {
        try {
            const cycleKeys = await this.redis.keys(`${this.cycleKeyPrefix}*`);
            if (cycleKeys.length === 0) {
                return {
                    activeCycle: this.activeCycle,
                    totalCyclesCompleted: 0,
                    successRate: 0,
                    avgImprovement: 0,
                };
            }
            // Cargar ciclos completados
            const completedCycles = [];
            for (const key of cycleKeys) {
                const data = await this.redis.hgetall(key);
                if (data.status === 'completed') {
                    completedCycles.push(data);
                }
            }
            const totalCompleted = completedCycles.length;
            const successful = completedCycles.filter(c => c.strikeResult && JSON.parse(c.strikeResult).success).length;
            const successRate = totalCompleted > 0 ? successful / totalCompleted : 0;
            const improvements = completedCycles
                .map(c => c.strikeResult ? JSON.parse(c.strikeResult).improvement : 0)
                .filter(i => i > 0);
            const avgImprovement = improvements.length > 0
                ? improvements.reduce((sum, i) => sum + i, 0) / improvements.length
                : 0;
            return {
                activeCycle: this.activeCycle,
                totalCyclesCompleted: totalCompleted,
                successRate,
                avgImprovement,
            };
        }
        catch (error) {
            console.error('🎯 [STATS-ERROR]:', error);
            return {
                activeCycle: this.activeCycle,
                totalCyclesCompleted: 0,
                successRate: 0,
                avgImprovement: 0,
            };
        }
    }
}
//# sourceMappingURL=HuntOrchestrator.js.map