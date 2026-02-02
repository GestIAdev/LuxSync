/**
 * 🎯 HUNT ORCHESTRATOR
 * "El maestro de la caza - coordina la sinfonía depredadora"
 *
 * WAVE 5: THE HUNT - Capa de Cognición
 *
 * CAPACIDADES:
 * - Coordina hunting cycles completos
 * - Integra: StalkingEngine + StrikeMomentEngine + PrecisionJumpEngine + PreyRecognitionEngine
 * - Gestiona flujo: Stalking → Evaluating → Striking → Learning
 * - Emite eventos para que SeleneLux reaccione
 *
 * FILOSOFÍA FELINA:
 * El gato no piensa en cada músculo que mueve.
 * Su instinto coordina todo: ojos, bigotes, patas.
 * El HuntOrchestrator ES ese instinto.
 */
import { EventEmitter } from 'events';
import { StalkingEngine } from './StalkingEngine';
import { StrikeMomentEngine } from './StrikeMomentEngine';
import { PrecisionJumpEngine } from './PrecisionJumpEngine';
import { PreyRecognitionEngine } from './PreyRecognitionEngine';
// ============================================
// 🎯 HUNT ORCHESTRATOR
// ============================================
export class HuntOrchestrator extends EventEmitter {
    constructor(config) {
        super();
        // === Configuración ===
        this.config = {
            enabled: true,
            minPatternsForHunt: 3,
            autoStrike: true,
            learningEnabled: true,
            debugMode: false
        };
        // === Estado ===
        this.activeCycle = null;
        this.cycleCount = 0;
        this.frameCount = 0;
        this.lastFrameTime = 0;
        // === Patrones observados ===
        this.observedPatterns = new Map();
        this.currentClusterHealth = 0.8;
        // === Estadísticas de sesión ===
        this.sessionStats = {
            cyclesStarted: 0,
            cyclesCompleted: 0,
            strikesMade: 0,
            strikesSuccessful: 0,
            totalFrames: 0
        };
        if (config) {
            this.config = { ...this.config, ...config };
        }
        // Inicializar sub-engines
        this.stalkingEngine = new StalkingEngine();
        this.strikeEngine = new StrikeMomentEngine();
        this.precisionEngine = new PrecisionJumpEngine();
        this.preyEngine = new PreyRecognitionEngine();
        console.log('🎯 [HUNT-ORCHESTRATOR] Initialized - All engines ready');
        this.log('Config:', this.config);
    }
    // ============================================
    // 🔄 PROCESO PRINCIPAL
    // ============================================
    /**
     * Procesar un frame de audio - MÉTODO PRINCIPAL
     * Llamar cada ~30ms con las métricas de audio
     */
    processFrame(pattern, clusterHealth = 0.8) {
        this.frameCount++;
        this.sessionStats.totalFrames++;
        this.currentClusterHealth = clusterHealth;
        const now = Date.now();
        const deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;
        // Registrar patrón
        this.registerPattern(pattern);
        // Actualizar motor de precisión
        this.precisionEngine.recordPattern({
            beauty: pattern.avgBeauty,
            convergenceTime: deltaTime,
            note: pattern.note,
            energy: pattern.avgBeauty, // Usar beauty como proxy de energía
            timestamp: now
        });
        // Si no está habilitado, solo observar
        if (!this.config.enabled) {
            return this.createResult(false, 'idle', { reasoning: 'Hunt disabled' });
        }
        // Si no hay suficientes patrones, seguir observando
        if (this.observedPatterns.size < this.config.minPatternsForHunt) {
            return this.createResult(false, 'idle', {
                reasoning: `Gathering patterns (${this.observedPatterns.size}/${this.config.minPatternsForHunt})`
            });
        }
        // Ejecutar ciclo de caza según estado actual
        return this.executeCycle();
    }
    /**
     * Ejecutar el ciclo de caza según estado
     */
    executeCycle() {
        // Si no hay ciclo activo, iniciar uno
        if (!this.activeCycle) {
            return this.startNewCycle();
        }
        // Procesar según fase actual
        switch (this.activeCycle.status) {
            case 'stalking':
                return this.executeStalkingPhase();
            case 'evaluating':
                return this.executeEvaluationPhase();
            case 'striking':
                return this.executeStrikePhase();
            case 'learning':
                return this.executeLearningPhase();
            case 'completed':
            case 'aborted':
                // Ciclo terminado, iniciar nuevo
                return this.startNewCycle();
            default:
                return this.createResult(false, 'idle', { reasoning: 'Unknown state' });
        }
    }
    // ============================================
    // 🐆 FASE 1: STALKING
    // ============================================
    executeStalkingPhase() {
        if (!this.activeCycle)
            return this.createResult(false, 'idle', {});
        this.log('🐆 Stalking phase...');
        // Identificar candidatos
        const candidates = this.stalkingEngine.identifyPreyCandidates(this.observedPatterns);
        this.activeCycle.candidates = candidates;
        if (candidates.length === 0) {
            this.log('No candidates found');
            return this.createResult(false, 'stalking', {
                candidates: 0,
                reasoning: 'No viable prey candidates'
            });
        }
        // Obtener decisión de caza
        const decision = this.stalkingEngine.decideHunt(this.currentClusterHealth);
        this.activeCycle.stalkedPrey = decision.targetPrey?.pattern.note ?? null;
        this.activeCycle.stalkingCycles++;
        // Emitir evento
        this.emit('hunt:stalking', candidates);
        // ¿Deberíamos pasar a evaluación?
        if (decision.shouldStrike && decision.targetPrey) {
            this.activeCycle.status = 'evaluating';
            this.log(`🎯 Target acquired: ${decision.targetPrey.pattern.note}-${decision.targetPrey.pattern.element}`);
        }
        // Generar comando de luz sutil mientras stalkeamos
        const lightCommand = this.generateStalkingCommand(candidates[0], decision.confidence);
        return this.createResult(true, 'stalking', {
            cycleId: this.activeCycle.cycleId,
            candidates: candidates.length,
            targetPrey: decision.targetPrey
                ? `${decision.targetPrey.pattern.note}-${decision.targetPrey.pattern.element}`
                : undefined,
            shouldStrike: decision.shouldStrike,
            confidence: decision.confidence,
            reasoning: decision.reasoning
        }, lightCommand);
    }
    // ============================================
    // ⚖️ FASE 2: EVALUATING
    // ============================================
    executeEvaluationPhase() {
        if (!this.activeCycle)
            return this.createResult(false, 'idle', {});
        this.log('⚖️ Evaluation phase...');
        const target = this.stalkingEngine.getCurrentTarget();
        if (!target) {
            this.log('Lost target during evaluation');
            this.activeCycle.status = 'stalking';
            this.activeCycle.evaluationResult = 'abort';
            return this.createResult(false, 'stalking', { reasoning: 'Target lost' });
        }
        // Evaluar condiciones de strike
        const conditions = this.strikeEngine.evaluateStrikeConditions(target, this.currentClusterHealth);
        this.activeCycle.strikeConditions = conditions;
        // Emitir evento
        this.emit('hunt:evaluating', conditions);
        // ¿Condiciones cumplidas?
        if (conditions.allConditionsMet) {
            this.activeCycle.evaluationResult = 'ready';
            this.activeCycle.status = 'striking';
            this.log(`⚡ Strike conditions MET! Score: ${conditions.strikeScore.toFixed(3)}`);
        }
        else {
            this.activeCycle.evaluationResult = 'waiting';
            this.log(`⏳ Waiting... ${conditions.conditionsMet}/${conditions.totalConditions} conditions met`);
            // Si llevamos mucho tiempo evaluando, volver a stalking
            if (this.activeCycle.stalkingCycles > 20) {
                this.log('Evaluation timeout - back to stalking');
                this.activeCycle.status = 'stalking';
            }
        }
        // Generar comando de luz de anticipación
        const lightCommand = this.generateEvaluationCommand(target, conditions);
        return this.createResult(true, 'evaluating', {
            cycleId: this.activeCycle.cycleId,
            targetPrey: `${target.pattern.note}-${target.pattern.element}`,
            shouldStrike: conditions.allConditionsMet,
            strikeScore: conditions.strikeScore,
            reasoning: `${conditions.conditionsMet}/${conditions.totalConditions} conditions met`
        }, lightCommand);
    }
    // ============================================
    // ⚡ FASE 3: STRIKING
    // ============================================
    executeStrikePhase() {
        if (!this.activeCycle)
            return this.createResult(false, 'idle', {});
        this.log('⚡ STRIKE PHASE!');
        const target = this.stalkingEngine.getCurrentTarget();
        const conditions = this.activeCycle.strikeConditions;
        if (!target || !conditions) {
            this.log('Strike failed - missing target or conditions');
            this.activeCycle.status = 'aborted';
            this.emit('hunt:aborted', 'Missing target or conditions');
            return this.createResult(false, 'aborted', { reasoning: 'Strike failed' });
        }
        // Ejecutar strike
        const result = this.strikeEngine.executeStrike(target, conditions);
        this.activeCycle.strikeExecuted = true;
        this.activeCycle.strikeResult = result;
        // Estadísticas
        this.sessionStats.strikesMade++;
        if (result.success) {
            this.sessionStats.strikesSuccessful++;
        }
        // Emitir evento
        this.emit('hunt:strike', result);
        // Pasar a learning
        this.activeCycle.status = 'learning';
        // Generar comando de luz de STRIKE
        const lightCommand = this.generateStrikeCommand(target, conditions, result);
        // ¡EMITIR COMANDO!
        this.emit('command', lightCommand);
        return this.createResult(true, 'striking', {
            cycleId: this.activeCycle.cycleId,
            targetPrey: result.targetPattern,
            strikeScore: conditions.strikeScore,
            confidence: conditions.strikeScore,
            reasoning: 'STRIKE EXECUTED!'
        }, lightCommand);
    }
    // ============================================
    // 📚 FASE 4: LEARNING
    // ============================================
    executeLearningPhase() {
        if (!this.activeCycle)
            return this.createResult(false, 'idle', {});
        this.log('📚 Learning phase...');
        const result = this.activeCycle.strikeResult;
        const target = this.stalkingEngine.getCurrentTarget();
        if (this.config.learningEnabled && result && target) {
            // Registrar hunt en memoria
            const huntRecord = this.preyEngine.recordHunt({
                targetPattern: result.targetPattern,
                preStrikeBeauty: result.preStrikeBeauty,
                preStrikeTrend: target.pattern.beautyTrend,
                preStrikeConsonance: this.activeCycle.strikeConditions?.musicalHarmony.consonance ?? 0.5,
                clusterHealth: this.currentClusterHealth,
                emotionalTone: target.pattern.emotionalTone,
                postStrikeBeauty: result.postStrikeBeauty,
                improvement: result.improvement,
                stalkingCycles: this.activeCycle.stalkingCycles,
                strikeScore: this.activeCycle.strikeConditions?.strikeScore ?? 0,
                timestamp: Date.now()
            });
            this.activeCycle.huntRecorded = true;
            this.activeCycle.learnedInsights.push(`Hunt ${result.success ? 'succeeded' : 'failed'}: ${result.improvement.toFixed(3)} improvement`);
            // Emitir evento
            this.emit('hunt:learned', huntRecord);
        }
        // Completar ciclo
        this.activeCycle.status = 'completed';
        this.activeCycle.endTime = Date.now();
        this.sessionStats.cyclesCompleted++;
        // Emitir evento de completado
        this.emit('hunt:completed', this.activeCycle);
        this.log(`✅ Hunt cycle completed: ${this.activeCycle.cycleId}`);
        return this.createResult(true, 'learning', {
            cycleId: this.activeCycle.cycleId,
            reasoning: 'Hunt recorded and cycle completed'
        });
    }
    // ============================================
    // 🆕 INICIAR NUEVO CICLO
    // ============================================
    startNewCycle() {
        this.cycleCount++;
        this.sessionStats.cyclesStarted++;
        const cycleId = `hunt_${this.cycleCount}_${Date.now()}`;
        this.activeCycle = {
            cycleId,
            startTime: Date.now(),
            stalkedPrey: null,
            stalkingCycles: 0,
            candidates: [],
            strikeConditions: null,
            evaluationResult: 'waiting',
            strikeExecuted: false,
            huntRecorded: false,
            learnedInsights: [],
            status: 'stalking'
        };
        this.emit('hunt:started', this.activeCycle);
        this.log(`🆕 New hunt cycle started: ${cycleId}`);
        // Ejecutar primera fase inmediatamente
        return this.executeStalkingPhase();
    }
    // ============================================
    // 💡 GENERACIÓN DE COMANDOS DE LUZ
    // ============================================
    generateStalkingCommand(candidate, confidence) {
        return {
            type: 'transition',
            intensity: 0.3 + (confidence * 0.2), // Sutil
            speed: 0.3,
            targetPalette: candidate ? this.elementToPalette(candidate.pattern.element) : undefined,
            effects: [],
            transitionTime: 1000, // Lento
            confidence
        };
    }
    generateEvaluationCommand(target, conditions) {
        const intensity = 0.5 + (conditions.strikeScore * 0.3);
        return {
            type: 'pulse',
            intensity,
            speed: 0.5 + (conditions.strikeScore * 0.3),
            targetPalette: this.elementToPalette(target.pattern.element),
            effects: conditions.allConditionsMet ? ['pulse', 'anticipation'] : [],
            transitionTime: 500,
            confidence: conditions.strikeScore
        };
    }
    generateStrikeCommand(target, conditions, _result) {
        return {
            type: 'strike',
            intensity: Math.min(1.0, 0.8 + conditions.strikeScore * 0.2),
            speed: 1.0, // Máxima velocidad
            targetPalette: this.elementToPalette(target.pattern.element),
            targetMovement: this.emotionToMovement(target.pattern.emotionalTone),
            effects: ['flash', 'impact', 'strobe_burst'],
            transitionTime: 0, // INSTANTÁNEO
            confidence: conditions.strikeScore
        };
    }
    elementToPalette(element) {
        const map = {
            'fire': 'fuego',
            'water': 'hielo',
            'earth': 'bosque',
            'air': 'cosmico'
        };
        return map[element] ?? 'fuego';
    }
    emotionToMovement(emotion) {
        const map = {
            'peaceful': 'smooth',
            'energetic': 'sharp',
            'chaotic': 'random',
            'harmonious': 'wave',
            'building': 'spiral',
            'dropping': 'impact'
        };
        return map[emotion] ?? 'smooth';
    }
    // ============================================
    // 📊 REGISTRO DE PATRONES
    // ============================================
    registerPattern(pattern) {
        const key = `${pattern.note}-${pattern.element}`;
        const existing = this.observedPatterns.get(key);
        if (existing) {
            // Actualizar patrón existente (promedio móvil)
            this.observedPatterns.set(key, {
                ...pattern,
                avgBeauty: (existing.avgBeauty * 0.8) + (pattern.avgBeauty * 0.2),
                occurrences: existing.occurrences + 1
            });
        }
        else {
            // Nuevo patrón
            this.observedPatterns.set(key, {
                ...pattern,
                occurrences: 1
            });
        }
    }
    // ============================================
    // 🔧 UTILIDADES
    // ============================================
    createResult(actionTaken, actionType, details, huntLightCommand) {
        // Agregar info de volatilidad
        const volatility = this.precisionEngine.getCurrentVolatility();
        const timing = this.precisionEngine.recommendInsightTiming(this.frameCount);
        return {
            actionTaken,
            actionType,
            details: {
                ...details,
                volatility: volatility?.overallVolatility,
                recommendedWindow: timing.windowSize
            },
            huntLightCommand
        };
    }
    log(...args) {
        if (this.config.debugMode) {
            console.log('🎯 [HUNT]', ...args);
        }
    }
    // ============================================
    // 📈 GETTERS PÚBLICOS
    // ============================================
    /** Obtener ciclo activo */
    getActiveCycle() {
        return this.activeCycle;
    }
    /** Obtener estadísticas de sesión */
    getSessionStats() {
        return {
            ...this.sessionStats,
            successRate: this.sessionStats.strikesMade > 0
                ? this.sessionStats.strikesSuccessful / this.sessionStats.strikesMade
                : 0,
            patternsObserved: this.observedPatterns.size,
            currentVolatility: this.precisionEngine.getCurrentVolatility()?.overallVolatility ?? 'unknown',
            currentWindow: this.precisionEngine.getCurrentWindow()
        };
    }
    /** Obtener estadísticas de caza (del PreyRecognitionEngine) */
    getHuntingStats() {
        return this.preyEngine.getGlobalStats();
    }
    /** Obtener perfiles de presas */
    getPreyProfiles() {
        return this.preyEngine.getAllProfiles();
    }
    /** Obtener presas más fáciles */
    getEasiestPrey(limit) {
        return this.preyEngine.getEasiestPrey(limit);
    }
    /** Obtener volatilidad actual */
    getVolatility() {
        return this.precisionEngine.getCurrentVolatility();
    }
    /** Obtener recomendación de timing */
    getTimingRecommendation() {
        return this.precisionEngine.recommendInsightTiming(this.frameCount);
    }
    /** Actualizar configuración */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.log('Config updated:', this.config);
    }
    /** Habilitar/deshabilitar */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        console.log(`🎯 [HUNT-ORCHESTRATOR] ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    /** Reset completo */
    reset() {
        this.activeCycle = null;
        this.cycleCount = 0;
        this.frameCount = 0;
        this.observedPatterns.clear();
        this.stalkingEngine.reset();
        this.strikeEngine.reset();
        this.precisionEngine.reset();
        // No reseteamos preyEngine para mantener memoria histórica
        this.sessionStats = {
            cyclesStarted: 0,
            cyclesCompleted: 0,
            strikesMade: 0,
            strikesSuccessful: 0,
            totalFrames: 0
        };
        console.log('🎯 [HUNT-ORCHESTRATOR] Reset complete');
    }
    /** Exportar datos de aprendizaje */
    exportLearning() {
        return this.preyEngine.exportData();
    }
    /** Importar datos de aprendizaje */
    importLearning(data) {
        this.preyEngine.importData(data);
    }
}
