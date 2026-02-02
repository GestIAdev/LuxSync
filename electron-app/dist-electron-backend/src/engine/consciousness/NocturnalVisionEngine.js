// NocturnalVisionEngine.ts
// 🌙 NOCTURNAL VISION ENGINE - LOS OJOS EN LA OSCURIDAD
// 🎯 "Selene ve patrones donde otros ven caos"
// ⚡ Wave 6: THE UNDYING MEMORY - Predictive Memory System
// 🔮 Motor de predicción basado en memoria histórica
import { EventEmitter } from 'events';
/**
 * 🌙 NOCTURNAL VISION ENGINE
 * Motor de visión nocturna que analiza patrones históricos,
 * detecta anomalías y genera predicciones
 *
 * @example
 * ```typescript
 * const vision = new NocturnalVisionEngine();
 * vision.recordEvent({ type: 'mood_change', data: { mood: 'energetic' } });
 * const patterns = vision.analyzePatterns();
 * const prediction = vision.predictNext('mood_change');
 * ```
 */
export class NocturnalVisionEngine extends EventEmitter {
    constructor() {
        super();
        /** Memoria de eventos históricos */
        this.eventHistory = [];
        /** Patrones detectados */
        this.patterns = new Map();
        /** Anomalías detectadas */
        this.anomalies = [];
        /** Predicciones activas */
        this.activePredictions = new Map();
        /** Límite máximo de eventos en memoria */
        this.MAX_HISTORY = 1000;
        /** Límite de anomalías */
        this.MAX_ANOMALIES = 100;
        /** Umbral mínimo para considerar un patrón */
        this.MIN_PATTERN_OCCURRENCES = 3;
        /** Umbral de confianza para predicciones */
        this.PREDICTION_CONFIDENCE_THRESHOLD = 0.6;
        this.setMaxListeners(20);
    }
    /**
     * Registra un evento en la memoria histórica
     * @param event - Evento parcial (timestamp y context se auto-generan)
     */
    recordEvent(event) {
        const now = Date.now();
        const date = new Date(now);
        const fullEvent = {
            ...event,
            timestamp: now,
            context: {
                hourOfDay: date.getHours(),
                dayOfWeek: date.getDay(),
                energy: this.calculateCurrentEnergy(),
                mood: this.getCurrentMood()
            },
            importance: this.calculateEventImportance(event)
        };
        // Agregar a historia
        this.eventHistory.push(fullEvent);
        // Mantener límite de memoria
        if (this.eventHistory.length > this.MAX_HISTORY) {
            // Eliminar eventos menos importantes primero
            this.pruneHistory();
        }
        // Verificar anomalías
        this.checkForAnomalies(fullEvent);
        // Actualizar patrones
        this.updatePatterns(fullEvent);
        // Verificar predicciones cumplidas
        this.checkPredictions(fullEvent);
        this.emit('eventRecorded', fullEvent);
    }
    /**
     * Calcula importancia de un evento
     */
    calculateEventImportance(event) {
        let importance = 0.5; // Base
        // Eventos de cambio son más importantes
        if (event.type.includes('change'))
            importance += 0.2;
        // Eventos con muchos datos son más ricos
        const dataKeys = Object.keys(event.data).length;
        importance += Math.min(0.2, dataKeys * 0.05);
        return Math.min(1, importance);
    }
    /**
     * Podar historia manteniendo eventos importantes
     */
    pruneHistory() {
        // Ordenar por importancia
        this.eventHistory.sort((a, b) => b.importance - a.importance);
        // Mantener top 80% por importancia, pero siempre mantener recientes
        const keepCount = Math.floor(this.MAX_HISTORY * 0.8);
        const recentThreshold = Date.now() - 3600000; // Última hora
        this.eventHistory = this.eventHistory.filter((event, index) => {
            return index < keepCount || event.timestamp > recentThreshold;
        });
    }
    /**
     * Calcula energía actual basada en eventos recientes
     */
    calculateCurrentEnergy() {
        const recentEvents = this.eventHistory.filter(e => e.timestamp > Date.now() - 300000 // Últimos 5 minutos
        );
        if (recentEvents.length === 0)
            return 0.5;
        // Más eventos = más energía
        const eventDensity = Math.min(1, recentEvents.length / 20);
        // Promedio de importancia
        const avgImportance = recentEvents.reduce((sum, e) => sum + e.importance, 0) / recentEvents.length;
        return (eventDensity + avgImportance) / 2;
    }
    /**
     * Obtiene mood actual de eventos recientes
     */
    getCurrentMood() {
        const recentMoodEvents = this.eventHistory
            .filter(e => e.type === 'mood_change' && e.timestamp > Date.now() - 600000)
            .sort((a, b) => b.timestamp - a.timestamp);
        if (recentMoodEvents.length > 0) {
            return recentMoodEvents[0].data.mood || 'neutral';
        }
        return 'neutral';
    }
    /**
     * Verifica anomalías con nuevo evento
     */
    checkForAnomalies(event) {
        // 1. Cambio súbito de energía
        const prevEnergy = this.eventHistory.length > 1
            ? this.eventHistory[this.eventHistory.length - 2].context.energy
            : 0.5;
        if (Math.abs(event.context.energy - prevEnergy) > 0.5) {
            this.recordAnomaly({
                timestamp: event.timestamp,
                type: 'sudden_change',
                description: `Cambio súbito de energía: ${prevEnergy.toFixed(2)} → ${event.context.energy.toFixed(2)}`,
                severity: Math.abs(event.context.energy - prevEnergy),
                triggerEvent: event
            });
        }
        // 2. Evento en hora inusual
        const hourStats = this.getHourStatistics(event.type);
        if (hourStats.count > 5 && !hourStats.commonHours.includes(event.context.hourOfDay)) {
            this.recordAnomaly({
                timestamp: event.timestamp,
                type: 'timing_deviation',
                description: `Evento ${event.type} en hora inusual (${event.context.hourOfDay}:00)`,
                severity: 0.5,
                triggerEvent: event
            });
        }
        // 3. Valor inusual en datos
        if (event.data.intensity !== undefined) {
            const avgIntensity = this.getAverageIntensity(event.type);
            const intensity = event.data.intensity;
            if (Math.abs(intensity - avgIntensity) > 0.4) {
                this.recordAnomaly({
                    timestamp: event.timestamp,
                    type: 'unusual_value',
                    description: `Intensidad inusual en ${event.type}: ${intensity.toFixed(2)} (avg: ${avgIntensity.toFixed(2)})`,
                    severity: Math.abs(intensity - avgIntensity),
                    triggerEvent: event
                });
            }
        }
    }
    /**
     * Registra una anomalía
     */
    recordAnomaly(anomaly) {
        this.anomalies.push(anomaly);
        // Mantener límite
        if (this.anomalies.length > this.MAX_ANOMALIES) {
            this.anomalies = this.anomalies.slice(-this.MAX_ANOMALIES);
        }
        this.emit('anomalyDetected', anomaly);
    }
    /**
     * Obtiene estadísticas de hora para un tipo de evento
     */
    getHourStatistics(eventType) {
        const typeEvents = this.eventHistory.filter(e => e.type === eventType);
        const hourCounts = new Map();
        for (const event of typeEvents) {
            const hour = event.context.hourOfDay;
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
        // Horas con más del 10% de eventos son "comunes"
        const threshold = typeEvents.length * 0.1;
        const commonHours = Array.from(hourCounts.entries())
            .filter(([_, count]) => count >= threshold)
            .map(([hour]) => hour);
        return { count: typeEvents.length, commonHours };
    }
    /**
     * Obtiene intensidad promedio para un tipo de evento
     */
    getAverageIntensity(eventType) {
        const typeEvents = this.eventHistory.filter(e => e.type === eventType && e.data.intensity !== undefined);
        if (typeEvents.length === 0)
            return 0.5;
        const sum = typeEvents.reduce((acc, e) => acc + e.data.intensity, 0);
        return sum / typeEvents.length;
    }
    /**
     * Actualiza patrones con nuevo evento
     */
    updatePatterns(event) {
        // 1. Buscar patrones temporales (mismo tipo, misma hora)
        this.detectTemporalPatterns(event);
        // 2. Buscar patrones secuenciales (A siempre seguido de B)
        this.detectSequentialPatterns(event);
        // 3. Buscar correlaciones (cuando X, también Y)
        this.detectCorrelations(event);
    }
    /**
     * Detecta patrones temporales
     */
    detectTemporalPatterns(event) {
        const patternId = `temporal_${event.type}_h${event.context.hourOfDay}`;
        const matchingEvents = this.eventHistory.filter(e => e.type === event.type && e.context.hourOfDay === event.context.hourOfDay);
        if (matchingEvents.length >= this.MIN_PATTERN_OCCURRENCES) {
            const confidence = Math.min(1, matchingEvents.length / 10);
            this.patterns.set(patternId, {
                id: patternId,
                type: 'temporal',
                description: `${event.type} ocurre frecuentemente a las ${event.context.hourOfDay}:00`,
                confidence,
                occurrences: matchingEvents.length,
                prediction: confidence >= this.PREDICTION_CONFIDENCE_THRESHOLD ? {
                    what: event.type,
                    when: `mañana a las ${event.context.hourOfDay}:00`,
                    confidence,
                    suggestedAction: `Preparar para ${event.type}`
                } : undefined,
                events: matchingEvents.map(e => e.type)
            });
        }
    }
    /**
     * Detecta patrones secuenciales (A → B)
     */
    detectSequentialPatterns(event) {
        if (this.eventHistory.length < 2)
            return;
        const prevEvent = this.eventHistory[this.eventHistory.length - 2];
        const patternId = `seq_${prevEvent.type}_${event.type}`;
        // Contar cuántas veces prevEvent.type es seguido por event.type
        let sequenceCount = 0;
        for (let i = 1; i < this.eventHistory.length; i++) {
            if (this.eventHistory[i - 1].type === prevEvent.type &&
                this.eventHistory[i].type === event.type) {
                sequenceCount++;
            }
        }
        if (sequenceCount >= this.MIN_PATTERN_OCCURRENCES) {
            // Calcular probabilidad condicional
            const prevTypeCount = this.eventHistory.filter(e => e.type === prevEvent.type).length;
            const confidence = prevTypeCount > 0 ? sequenceCount / prevTypeCount : 0;
            if (confidence >= 0.3) { // Al menos 30% de las veces
                this.patterns.set(patternId, {
                    id: patternId,
                    type: 'sequential',
                    description: `${prevEvent.type} suele ser seguido por ${event.type}`,
                    confidence,
                    occurrences: sequenceCount,
                    prediction: {
                        what: event.type,
                        when: `después de ${prevEvent.type}`,
                        confidence
                    },
                    events: [prevEvent.type, event.type]
                });
            }
        }
    }
    /**
     * Detecta correlaciones (cuando X, también Y en ventana de tiempo)
     */
    detectCorrelations(event) {
        const windowMs = 60000; // Ventana de 1 minuto
        // Buscar eventos de otros tipos en la misma ventana de tiempo
        const nearbyEvents = this.eventHistory.filter(e => e.type !== event.type &&
            Math.abs(e.timestamp - event.timestamp) <= windowMs);
        // Agrupar por tipo
        const typeCounts = new Map();
        for (const e of nearbyEvents) {
            typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
        }
        // Registrar correlaciones significativas
        for (const [otherType, count] of typeCounts) {
            if (count >= this.MIN_PATTERN_OCCURRENCES) {
                const patternId = `corr_${event.type}_${otherType}`;
                const confidence = Math.min(1, count / 10);
                this.patterns.set(patternId, {
                    id: patternId,
                    type: 'correlation',
                    description: `${event.type} y ${otherType} suelen ocurrir juntos`,
                    confidence,
                    occurrences: count,
                    events: [event.type, otherType]
                });
            }
        }
    }
    /**
     * Verifica predicciones cumplidas
     */
    checkPredictions(event) {
        for (const [id, prediction] of this.activePredictions) {
            if (prediction.what === event.type) {
                this.emit('predictionFulfilled', { prediction, event });
                this.activePredictions.delete(id);
            }
        }
    }
    /**
     * Analiza patrones actuales
     * @returns Array de patrones detectados
     */
    analyzePatterns() {
        return Array.from(this.patterns.values())
            .sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Predice próximo evento de un tipo
     * @param eventType - Tipo de evento a predecir
     * @returns Predicción o null si no hay confianza suficiente
     */
    predictNext(eventType) {
        // Buscar patrones relacionados con este tipo
        const relatedPatterns = Array.from(this.patterns.values())
            .filter(p => p.events.includes(eventType) && p.prediction)
            .sort((a, b) => b.confidence - a.confidence);
        if (relatedPatterns.length === 0)
            return null;
        const bestPattern = relatedPatterns[0];
        if (bestPattern.confidence < this.PREDICTION_CONFIDENCE_THRESHOLD)
            return null;
        const prediction = bestPattern.prediction;
        // Registrar predicción activa
        this.activePredictions.set(`pred_${eventType}_${Date.now()}`, prediction);
        return prediction;
    }
    /**
     * Obtiene anomalías recientes
     * @param limit - Cantidad máxima a retornar
     */
    getRecentAnomalies(limit = 10) {
        return this.anomalies.slice(-limit);
    }
    /**
     * Obtiene resumen del sistema de visión
     */
    getSummary() {
        const avgConfidence = this.patterns.size > 0
            ? Array.from(this.patterns.values()).reduce((sum, p) => sum + p.confidence, 0) / this.patterns.size
            : 0;
        return {
            totalEvents: this.eventHistory.length,
            activePatterns: this.patterns.size,
            recentAnomalies: this.anomalies.filter(a => a.timestamp > Date.now() - 3600000).length,
            pendingPredictions: this.activePredictions.size,
            overallConfidence: avgConfidence,
            memoryHealth: this.eventHistory.length < this.MAX_HISTORY * 0.5 ? 'healthy' :
                this.eventHistory.length < this.MAX_HISTORY * 0.9 ? 'degraded' : 'limited'
        };
    }
    /**
     * Obtiene historial de eventos recientes
     * @param limit - Cantidad a retornar
     * @param type - Filtrar por tipo (opcional)
     */
    getRecentHistory(limit = 50, type) {
        let events = this.eventHistory;
        if (type) {
            events = events.filter(e => e.type === type);
        }
        return events.slice(-limit);
    }
    /**
     * Limpia la memoria histórica
     */
    clearHistory() {
        this.eventHistory = [];
        this.patterns.clear();
        this.anomalies = [];
        this.activePredictions.clear();
        this.emit('historyCleared');
    }
    /**
     * Exporta estado para persistencia
     */
    exportState() {
        return {
            events: this.eventHistory,
            patterns: Array.from(this.patterns.entries()),
            anomalies: this.anomalies
        };
    }
    /**
     * Importa estado desde persistencia
     */
    importState(state) {
        this.eventHistory = state.events;
        this.patterns = new Map(state.patterns);
        this.anomalies = state.anomalies;
        this.emit('stateImported');
    }
}
