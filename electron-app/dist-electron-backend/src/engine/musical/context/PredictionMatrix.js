/**
 * 🔮 PREDICTION MATRIX - El Oráculo Musical de Selene
 * ====================================================
 * Wave 8 - FASE 4: Orquestación
 *
 * Genera predicciones basadas en el historial musical:
 * - Si llevamos 8 compases de Build-up → Drop Inminente (90%)
 * - Si llevamos 4 compases de Chorus → Verse/Bridge próximo
 * - Si detectamos Fill → Transición en próximo beat
 *
 * ALGORITMO:
 * 1. Mantener historial de secciones (últimas 8)
 * 2. Detectar patrones de progresión
 * 3. Calcular probabilidad de próximo evento
 * 4. Generar acciones de iluminación sugeridas
 *
 * ⚠️ REGLA 1: Throttled 500ms (análisis pesado)
 * ⚠️ REGLA 2: Retorna 'confidence' para decisiones
 *
 * @module engines/musical/context/PredictionMatrix
 * @version 1.0.0 - FASE 4
 */
import { EventEmitter } from 'events';
const DEFAULT_CONFIG = {
    historySize: 8,
    minProbabilityThreshold: 0.6,
    referenceBpm: 120,
    dropAnticipationBars: 2,
    enableTransitionPrediction: true,
    enableFillPrediction: true,
};
/**
 * Patrones conocidos de progresión
 */
const PROGRESSION_PATTERNS = [
    // Buildup prolongado → Drop inminente
    {
        pattern: ['buildup', 'buildup'],
        nextProbable: 'drop',
        probability: 0.90,
        predictionType: 'drop_incoming',
    },
    {
        pattern: ['verse', 'pre_chorus'],
        nextProbable: 'chorus',
        probability: 0.85,
        predictionType: 'transition_beat',
    },
    {
        pattern: ['chorus', 'chorus'],
        nextProbable: 'verse',
        probability: 0.70,
        predictionType: 'transition_beat',
    },
    {
        pattern: ['chorus', 'verse'],
        nextProbable: 'bridge',
        probability: 0.60,
        predictionType: 'transition_beat',
    },
    {
        pattern: ['drop', 'drop'],
        nextProbable: 'breakdown',
        probability: 0.75,
        predictionType: 'breakdown_imminent',
    },
    {
        pattern: ['breakdown'],
        nextProbable: 'buildup',
        probability: 0.80,
        predictionType: 'buildup_starting',
    },
    {
        pattern: ['intro'],
        nextProbable: 'verse',
        probability: 0.85,
        predictionType: 'transition_beat',
    },
    {
        pattern: ['verse', 'verse'],
        nextProbable: 'pre_chorus',
        probability: 0.65,
        predictionType: 'transition_beat',
    },
];
/**
 * Acciones de iluminación por tipo de predicción
 */
const PREDICTION_ACTIONS = {
    drop_incoming: {
        preAction: {
            type: 'prepare',
            effect: 'intensity_ramp',
            intensity: 0.8,
            duration: 2000,
            timing: -2000,
        },
        mainAction: {
            type: 'execute',
            effect: 'flash',
            intensity: 1.0,
            duration: 200,
            timing: 0,
        },
        postAction: {
            type: 'recover',
            effect: 'strobe',
            intensity: 0.9,
            duration: 4000,
            timing: 200,
        },
    },
    buildup_starting: {
        preAction: {
            type: 'prepare',
            effect: 'color_shift',
            intensity: 0.5,
            duration: 500,
            timing: -500,
        },
        mainAction: {
            type: 'execute',
            effect: 'intensity_ramp',
            intensity: 0.7,
            duration: 8000,
            timing: 0,
        },
    },
    breakdown_imminent: {
        preAction: {
            type: 'prepare',
            effect: 'breathe',
            intensity: 0.4,
            duration: 1000,
            timing: -1000,
        },
        mainAction: {
            type: 'execute',
            effect: 'breathe',
            intensity: 0.3,
            duration: 4000,
            timing: 0,
        },
    },
    transition_beat: {
        mainAction: {
            type: 'execute',
            effect: 'pulse',
            intensity: 0.6,
            duration: 500,
            timing: 0,
        },
    },
    fill_expected: {
        mainAction: {
            type: 'execute',
            effect: 'flash',
            intensity: 0.7,
            duration: 300,
            timing: 0,
        },
    },
    key_change: {
        preAction: {
            type: 'prepare',
            effect: 'color_shift',
            intensity: 0.6,
            duration: 1000,
            timing: -500,
        },
        mainAction: {
            type: 'execute',
            effect: 'color_shift',
            intensity: 0.8,
            duration: 2000,
            timing: 0,
        },
    },
};
// ============================================================
// 🔮 PREDICTION MATRIX CLASS
// ============================================================
/**
 * Motor de predicción musical
 * Analiza patrones de sección y genera predicciones
 */
export class PredictionMatrix extends EventEmitter {
    constructor(config = {}) {
        super();
        this.sectionHistory = [];
        this.lastPrediction = null;
        this.lastAnalysisTime = 0;
        this.cachedResult = null;
        this.fillHistory = [];
        // Performance tracking
        this.analysisCount = 0;
        this.totalAnalysisTime = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ============================================================
    // 🎯 MÉTODO PRINCIPAL: GENERATE
    // ============================================================
    /**
     * Genera predicciones basadas en el contexto musical actual
     *
     * ⚠️ REGLA 1: Throttled 500ms
     *
     * @param rhythm - Análisis rítmico actual
     * @param section - Análisis de sección actual
     * @param forceAnalysis - Forzar análisis (ignorar throttle)
     * @returns Predicción extendida con acciones sugeridas
     */
    generate(rhythm, section, forceAnalysis = false) {
        const startTime = performance.now();
        const now = Date.now();
        // Throttle: usar cache si no ha pasado suficiente tiempo
        if (!forceAnalysis && now - this.lastAnalysisTime < 500 && this.cachedResult) {
            return this.cachedResult;
        }
        this.lastAnalysisTime = now;
        // Actualizar historial de secciones
        this.updateSectionHistory(section);
        // Actualizar historial de fills
        if (rhythm.fillInProgress) {
            this.fillHistory.push(now);
            // Mantener solo últimos 10 fills
            if (this.fillHistory.length > 10) {
                this.fillHistory.shift();
            }
        }
        // Generar predicción
        const prediction = this.analyzePatterns(rhythm, section);
        if (prediction) {
            this.cachedResult = prediction;
            this.lastPrediction = prediction;
            this.emit('prediction', prediction);
        }
        // Performance tracking
        const elapsed = performance.now() - startTime;
        this.totalAnalysisTime += elapsed;
        this.analysisCount++;
        return prediction;
    }
    // ============================================================
    // 🔍 ANÁLISIS DE PATRONES
    // ============================================================
    /**
     * Analiza el historial de secciones para detectar patrones
     */
    analyzePatterns(rhythm, section) {
        const predictions = [];
        // 1. Predicción basada en patrones de sección
        const sectionPrediction = this.predictFromSectionPattern(section);
        if (sectionPrediction) {
            predictions.push(sectionPrediction);
        }
        // 2. Predicción de drop basada en buildup
        const dropPrediction = this.predictDrop(section, rhythm);
        if (dropPrediction) {
            predictions.push(dropPrediction);
        }
        // 3. Predicción de transición basada en fills
        if (this.config.enableFillPrediction) {
            const fillPrediction = this.predictFromFills(rhythm, section);
            if (fillPrediction) {
                predictions.push(fillPrediction);
            }
        }
        // Seleccionar la predicción más probable
        if (predictions.length === 0) {
            return null;
        }
        // Ordenar por probabilidad y retornar la mejor
        predictions.sort((a, b) => b.probability - a.probability);
        // Filtrar por umbral mínimo
        const bestPrediction = predictions[0];
        if (bestPrediction.probability < this.config.minProbabilityThreshold) {
            return null;
        }
        return bestPrediction;
    }
    /**
     * Predice basándose en patrones de sección conocidos
     */
    predictFromSectionPattern(section) {
        if (this.sectionHistory.length < 1) {
            return null;
        }
        // Obtener últimas secciones como tipos
        const recentSections = this.sectionHistory
            .slice(-3)
            .map(s => s.type);
        // Buscar coincidencia con patrones conocidos
        for (const pattern of PROGRESSION_PATTERNS) {
            if (this.matchesPattern(recentSections, pattern.pattern)) {
                const bpm = this.getEstimatedBpm();
                const beatsPerBar = 4;
                const msPerBar = (60000 / bpm) * beatsPerBar;
                // Estimar tiempo hasta la transición (típicamente 4-8 compases)
                const barsUntilTransition = 4;
                const timeUntil = msPerBar * barsUntilTransition;
                const beatsUntil = beatsPerBar * barsUntilTransition;
                return {
                    type: pattern.predictionType,
                    probability: pattern.probability * section.confidence,
                    timeUntil,
                    beatsUntil,
                    timestamp: Date.now(),
                    actions: this.getActionsForPrediction(pattern.predictionType),
                    reasoning: `Pattern detected: ${pattern.pattern.join(' → ')} suggests ${pattern.nextProbable}`,
                };
            }
        }
        return null;
    }
    /**
     * Predicción específica de DROP
     *
     * CRÍTICO: 8 compases de buildup → Drop con 90% probabilidad
     */
    predictDrop(section, rhythm) {
        // Solo predecir drop si estamos en buildup
        if (section.current.type !== 'buildup') {
            return null;
        }
        // Calcular duración del buildup actual
        const buildupDuration = Date.now() - section.current.startedAt;
        const bpm = rhythm.bpm || this.config.referenceBpm;
        const msPerBar = (60000 / bpm) * 4;
        const barsInBuildup = buildupDuration / msPerBar;
        // Intensidad subiendo + tiempo suficiente = Drop inminente
        const isIntensityRising = section.intensityTrend === 'rising';
        const isLongEnough = barsInBuildup >= this.config.dropAnticipationBars;
        if (isIntensityRising && isLongEnough) {
            // Calcular probabilidad basada en duración
            // Más largo el buildup = más probable el drop
            const durationFactor = Math.min(barsInBuildup / 8, 1);
            const baseProbability = 0.7;
            const probability = baseProbability + (durationFactor * 0.25);
            // Estimar tiempo hasta el drop (final del compás actual)
            const barsUntilDrop = Math.max(1, 8 - Math.floor(barsInBuildup));
            const timeUntil = barsUntilDrop * msPerBar;
            const beatsUntil = barsUntilDrop * 4;
            return {
                type: 'drop_incoming',
                probability: Math.min(probability, 0.95),
                timeUntil,
                beatsUntil,
                timestamp: Date.now(),
                actions: PREDICTION_ACTIONS.drop_incoming,
                reasoning: `Buildup duration: ${barsInBuildup.toFixed(1)} bars, intensity ${section.intensityTrend}`,
            };
        }
        return null;
    }
    /**
     * Predice transición basada en fills de batería
     */
    predictFromFills(rhythm, section) {
        // Fill en progreso = transición probable en próximo beat
        if (rhythm.fillInProgress) {
            const bpm = rhythm.bpm || this.config.referenceBpm;
            const msPerBeat = 60000 / bpm;
            return {
                type: 'fill_expected',
                probability: 0.75,
                timeUntil: msPerBeat * 2, // Típicamente 2 beats de fill
                beatsUntil: 2,
                timestamp: Date.now(),
                actions: PREDICTION_ACTIONS.fill_expected,
                reasoning: 'Fill detected, transition likely on next beat',
            };
        }
        // Analizar patrón de fills recientes
        if (this.fillHistory.length >= 2) {
            const now = Date.now();
            const recentFills = this.fillHistory.filter(t => now - t < 30000);
            if (recentFills.length >= 2) {
                // Calcular intervalo promedio entre fills
                const intervals = [];
                for (let i = 1; i < recentFills.length; i++) {
                    intervals.push(recentFills[i] - recentFills[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                // Si el intervalo es consistente, predecir próximo fill
                const lastFillTime = recentFills[recentFills.length - 1];
                const timeSinceLastFill = now - lastFillTime;
                if (timeSinceLastFill > avgInterval * 0.7 && timeSinceLastFill < avgInterval * 1.3) {
                    const timeUntilNextFill = avgInterval - timeSinceLastFill;
                    if (timeUntilNextFill > 0 && timeUntilNextFill < 5000) {
                        return {
                            type: 'fill_expected',
                            probability: 0.65,
                            timeUntil: timeUntilNextFill,
                            beatsUntil: Math.round(timeUntilNextFill / (60000 / (rhythm.bpm || 120))),
                            timestamp: now,
                            actions: PREDICTION_ACTIONS.fill_expected,
                            reasoning: `Fill pattern detected, avg interval: ${(avgInterval / 1000).toFixed(1)}s`,
                        };
                    }
                }
            }
        }
        return null;
    }
    /**
     * Predice transiciones entre secciones
     */
    predictTransition(currentSection) {
        // Si ya tenemos una predicción de sección, usar esa info
        if (currentSection.predicted && currentSection.predicted.probability > 0.6) {
            const bpm = this.getEstimatedBpm();
            const beatsUntil = Math.round(currentSection.predicted.estimatedIn / (60000 / bpm));
            return {
                type: 'transition_beat',
                probability: currentSection.predicted.probability,
                timeUntil: currentSection.predicted.estimatedIn,
                beatsUntil,
                timestamp: Date.now(),
                actions: PREDICTION_ACTIONS.transition_beat,
                reasoning: `Section predictor: ${currentSection.current.type} → ${currentSection.predicted.type}`,
            };
        }
        return null;
    }
    // ============================================================
    // 🛠️ UTILIDADES
    // ============================================================
    /**
     * Actualiza el historial de secciones
     */
    updateSectionHistory(section) {
        const lastEntry = this.sectionHistory[this.sectionHistory.length - 1];
        // Solo agregar si es una sección diferente o no hay historial
        if (!lastEntry || lastEntry.type !== section.current.type) {
            // Si hay una entrada previa, actualizar su duración
            if (lastEntry) {
                lastEntry.duration = section.current.startedAt - lastEntry.timestamp;
            }
            this.sectionHistory.push({
                type: section.current.type,
                duration: 0,
                energy: section.intensity,
                timestamp: section.current.startedAt,
            });
            // Mantener solo las últimas N entradas
            while (this.sectionHistory.length > this.config.historySize) {
                this.sectionHistory.shift();
            }
            // Emitir evento de cambio de sección
            this.emit('section-change', {
                from: lastEntry?.type || 'unknown',
                to: section.current.type,
                timestamp: Date.now(),
            });
        }
        else {
            // Actualizar energía de la sección actual
            lastEntry.energy = (lastEntry.energy + section.intensity) / 2;
        }
    }
    /**
     * Verifica si las secciones recientes coinciden con un patrón
     */
    matchesPattern(recent, pattern) {
        if (recent.length < pattern.length) {
            return false;
        }
        const recentSlice = recent.slice(-pattern.length);
        return pattern.every((type, i) => recentSlice[i] === type);
    }
    /**
     * Obtiene acciones para un tipo de predicción
     */
    getActionsForPrediction(type) {
        return PREDICTION_ACTIONS[type] || PREDICTION_ACTIONS.transition_beat;
    }
    /**
     * Estima el BPM actual basado en el historial
     */
    getEstimatedBpm() {
        // Por ahora retornamos el BPM de referencia
        // TODO: Integrar con RhythmAnalyzer para BPM real
        return this.config.referenceBpm;
    }
    // ============================================================
    // 📊 MÉTRICAS Y DEBUG
    // ============================================================
    /**
     * Obtiene estadísticas de rendimiento
     */
    getPerformanceStats() {
        return {
            analysisCount: this.analysisCount,
            averageAnalysisTime: this.analysisCount > 0
                ? this.totalAnalysisTime / this.analysisCount
                : 0,
            historySize: this.sectionHistory.length,
            lastPrediction: this.lastPrediction,
        };
    }
    /**
     * Obtiene el historial de secciones (para debug)
     */
    getSectionHistory() {
        return [...this.sectionHistory];
    }
    /**
     * Resetea el estado del motor
     */
    reset() {
        this.sectionHistory = [];
        this.lastPrediction = null;
        this.cachedResult = null;
        this.fillHistory = [];
        this.analysisCount = 0;
        this.totalAnalysisTime = 0;
        this.emit('reset');
    }
    /**
     * Actualiza la configuración
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.emit('config-updated', this.config);
    }
}
// ============================================================
// 🏭 FACTORY FUNCTION
// ============================================================
/**
 * Crea una instancia de PredictionMatrix con configuración opcional
 */
export function createPredictionMatrix(config) {
    return new PredictionMatrix(config);
}
// Export default
export default PredictionMatrix;
