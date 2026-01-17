// ═══════════════════════════════════════════════════════════════════════════
//  🧠 CONTEXTUAL MEMORY - El Hipocampo de Selene
// ═══════════════════════════════════════════════════════════════════════════
//  WAVE 665 - CONTEXTUAL MEMORY - PHASE 2
//  "Selene recuerda la narrativa musical para predecir el futuro"
// ═══════════════════════════════════════════════════════════════════════════
import { CircularBuffer } from './CircularBuffer';
import { RollingStats } from './RollingStats';
const DEFAULT_CONFIG = {
    bufferSize: 300, // ~5 segundos @ 60fps
    zScoreNotable: 1.5, // |z| > 1.5 = notable
    zScoreSignificant: 2.0, // |z| > 2.0 = significativo
    zScoreEpic: 2.5, // |z| > 2.5 = anomalía/épico (trigger threshold)
    sectionHistorySize: 8, // Últimas 8 secciones
    transientWindowMs: 1000, // 1 segundo para calcular transient rate
};
// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTUAL MEMORY CLASS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🧠 CONTEXTUAL MEMORY - El Hipocampo de Selene
 *
 * Mantiene estadísticas rodantes de las métricas musicales y detecta
 * momentos estadísticamente significativos usando Z-Score.
 *
 * **Z-Score Interpretation:**
 * - |z| < 1.5: Normal (68% de las observaciones)
 * - |z| >= 1.5: Notable (algo interesante)
 * - |z| >= 2.0: Significativo (raro, ~5% de ocurrencia)
 * - |z| >= 2.5: Anomalía/Épico (~1% de ocurrencia)
 * - |z| >= 3.0: Momento divino (~0.15% de ocurrencia) → FORCE_STRIKE
 *
 * @example
 * ```typescript
 * const memory = new ContextualMemory();
 *
 * // En cada frame:
 * const output = memory.update({
 *   energy: 0.85,
 *   bass: 0.72,
 *   harshness: 0.45,
 *   sectionType: 'drop',
 *   timestamp: Date.now(),
 * });
 *
 * if (output.anomaly.isAnomaly && output.anomaly.recommendation === 'force_strike') {
 *   // MOMENTO ÉPICO DETECTADO
 *   triggerSolarFlare();
 * }
 * ```
 */
export class ContextualMemory {
    constructor(config = {}) {
        this.currentSectionStart = 0;
        this.currentSectionType = 'unknown';
        this.currentSectionEnergySum = 0;
        this.currentSectionEnergyPeak = 0;
        this.currentSectionFrameCount = 0;
        // Tracking de transientes
        this.transientTimestamps = [];
        // Frame counter para debug
        this.frameCount = 0;
        this.lastLogFrame = 0;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.energyStats = new RollingStats({ windowSize: this.config.bufferSize });
        this.bassStats = new RollingStats({ windowSize: this.config.bufferSize });
        this.harshnessStats = new RollingStats({ windowSize: this.config.bufferSize });
        this.sectionHistory = new CircularBuffer(this.config.sectionHistorySize);
    }
    /**
     * Actualiza la memoria con nuevos datos y retorna análisis completo.
     */
    update(input) {
        this.frameCount++;
        // 1. Actualizar rolling stats
        const energyMetrics = this.energyStats.update(input.energy);
        const bassMetrics = this.bassStats.update(input.bass);
        const harshnessMetrics = this.harshnessStats.update(input.harshness);
        // 2. Tracking de transientes
        if (input.hasTransient) {
            this.transientTimestamps.push(input.timestamp);
        }
        // Limpiar transientes antiguos
        const transientCutoff = input.timestamp - this.config.transientWindowMs;
        this.transientTimestamps = this.transientTimestamps.filter(t => t > transientCutoff);
        const transientRate = this.transientTimestamps.length / (this.config.transientWindowMs / 1000);
        // 3. Actualizar historial de secciones
        this.updateSectionHistory(input);
        // 4. Calcular contexto narrativo
        const narrative = this.calculateNarrativeContext(input);
        // 5. Detectar anomalías
        const anomaly = this.detectAnomaly(energyMetrics, bassMetrics, harshnessMetrics, input.sectionType);
        // 6. Debug log cada ~1 segundo
        if (this.frameCount - this.lastLogFrame >= 60 && this.energyStats.isWarmedUp) {
            this.lastLogFrame = this.frameCount;
            this.logContextState(energyMetrics, bassMetrics, harshnessMetrics, anomaly, narrative);
        }
        return {
            stats: {
                energy: energyMetrics,
                bass: bassMetrics,
                harshness: harshnessMetrics,
                transientRate,
            },
            narrative,
            anomaly,
            isWarmedUp: this.energyStats.isWarmedUp,
        };
    }
    /**
     * Obtiene solo el Z-Score de energía (acceso rápido).
     */
    getEnergyZScore() {
        return this.energyStats.getStats()?.zScore ?? 0;
    }
    /**
     * Obtiene solo el Z-Score de bass (acceso rápido).
     */
    getBassZScore() {
        return this.bassStats.getStats()?.zScore ?? 0;
    }
    /**
     * ¿Está la memoria calentada para estadísticas confiables?
     */
    get isWarmedUp() {
        return this.energyStats.isWarmedUp;
    }
    /**
     * Reinicia la memoria.
     */
    reset() {
        this.energyStats.reset();
        this.bassStats.reset();
        this.harshnessStats.reset();
        this.sectionHistory.clear();
        this.transientTimestamps = [];
        this.currentSectionStart = 0;
        this.currentSectionType = 'unknown';
        this.currentSectionEnergySum = 0;
        this.currentSectionEnergyPeak = 0;
        this.currentSectionFrameCount = 0;
        this.frameCount = 0;
        this.lastLogFrame = 0;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS PRIVADOS
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Actualiza el historial de secciones cuando hay cambio.
     */
    updateSectionHistory(input) {
        // Acumular energía de la sección actual
        this.currentSectionEnergySum += input.energy;
        this.currentSectionEnergyPeak = Math.max(this.currentSectionEnergyPeak, input.energy);
        this.currentSectionFrameCount++;
        // Detectar cambio de sección
        if (input.sectionType !== this.currentSectionType) {
            // Guardar sección anterior si no es la primera
            if (this.currentSectionType !== 'unknown' && this.currentSectionFrameCount > 0) {
                const avgEnergy = this.currentSectionEnergySum / this.currentSectionFrameCount;
                const duration = input.timestamp - this.currentSectionStart;
                this.sectionHistory.push({
                    type: this.currentSectionType,
                    startTime: this.currentSectionStart,
                    duration,
                    avgEnergy,
                    peakEnergy: this.currentSectionEnergyPeak,
                });
            }
            // Iniciar nueva sección
            this.currentSectionType = input.sectionType;
            this.currentSectionStart = input.timestamp;
            this.currentSectionEnergySum = 0;
            this.currentSectionEnergyPeak = 0;
            this.currentSectionFrameCount = 0;
        }
    }
    /**
     * Calcula el contexto narrativo basado en historial.
     */
    calculateNarrativeContext(input) {
        const history = this.sectionHistory.getAll();
        const sectionAge = input.timestamp - this.currentSectionStart;
        // Determinar fase narrativa
        const narrativePhase = this.inferNarrativePhase(history, input.sectionType);
        // Predecir próxima sección
        const predictedNext = this.predictNextSection(history, input.sectionType);
        return {
            currentSection: input.sectionType,
            sectionAge,
            sectionHistory: history,
            narrativePhase,
            predictedNext,
        };
    }
    /**
     * Infiere la fase narrativa de la música.
     */
    inferNarrativePhase(history, current) {
        // Fase directa por sección actual
        if (current === 'intro')
            return 'intro';
        if (current === 'outro')
            return 'outro';
        if (current === 'drop' || current === 'chorus')
            return 'climax';
        if (current === 'breakdown' || current === 'bridge')
            return 'release';
        // Inferir de historial
        const recentTypes = history.slice(-3).map(h => h.type);
        // Buildup → buildup = algo grande viene
        if (recentTypes.filter(t => t === 'buildup').length >= 2) {
            return 'building';
        }
        // Post-drop = release (chequear si hubo drop reciente)
        const hadRecentDrop = recentTypes.some(t => t === 'drop');
        if (hadRecentDrop) {
            return 'release';
        }
        // Default
        if (current === 'buildup' || current === 'verse')
            return 'building';
        return 'building';
    }
    /**
     * Predice la próxima sección basándose en patrones.
     */
    predictNextSection(history, current) {
        // Patrones típicos de transición
        const patterns = {
            'intro': { section: 'verse', probability: 0.7 },
            'verse': { section: 'buildup', probability: 0.6 },
            'buildup': { section: 'drop', probability: 0.8 },
            'chorus': { section: 'verse', probability: 0.5 },
            'drop': { section: 'breakdown', probability: 0.7 },
            'breakdown': { section: 'buildup', probability: 0.6 },
            'bridge': { section: 'chorus', probability: 0.7 },
            'outro': { section: 'unknown', probability: 0.3 },
            'unknown': { section: 'verse', probability: 0.3 },
        };
        // Buscar patrón: buildup → buildup = DROP INCOMING con alta probabilidad
        const recentTypes = history.slice(-2).map(h => h.type);
        if (recentTypes.length >= 2 &&
            recentTypes[0] === 'buildup' &&
            recentTypes[1] === 'buildup') {
            return { section: 'drop', probability: 0.9 };
        }
        return patterns[current] || null;
    }
    /**
     * Detecta anomalías estadísticas.
     */
    detectAnomaly(energy, bass, harshness, sectionType) {
        // No detectar anomalías hasta que la memoria esté calentada
        if (!this.energyStats.isWarmedUp) {
            return {
                isAnomaly: false,
                type: null,
                severity: 0,
                triggerMetric: null,
                recommendation: 'ignore',
                reason: 'Memory warming up',
            };
        }
        // Encontrar la métrica con Z-Score más alto
        const absEnergyZ = Math.abs(energy.zScore);
        const absBassZ = Math.abs(bass.zScore);
        const absHarshnessZ = Math.abs(harshness.zScore);
        let triggerMetric = null;
        let maxZ = 0;
        let zScore = 0;
        if (absEnergyZ >= absBassZ && absEnergyZ >= absHarshnessZ) {
            triggerMetric = 'energy';
            maxZ = absEnergyZ;
            zScore = energy.zScore;
        }
        else if (absBassZ >= absHarshnessZ) {
            triggerMetric = 'bass';
            maxZ = absBassZ;
            zScore = bass.zScore;
        }
        else {
            triggerMetric = 'harshness';
            maxZ = absHarshnessZ;
            zScore = harshness.zScore;
        }
        // Determinar tipo de anomalía
        let type = null;
        if (maxZ >= this.config.zScoreNotable) {
            if (zScore > 0) {
                type = 'spike';
            }
            else {
                type = 'drop';
            }
            // Detectar cambio de textura por harshness
            if (triggerMetric === 'harshness' && absHarshnessZ >= this.config.zScoreSignificant) {
                type = 'texture_shift';
            }
        }
        // Determinar recomendación
        let recommendation = 'ignore';
        let reason = 'Normal activity';
        if (maxZ >= this.config.zScoreEpic) {
            // Z > 2.5 en DROP section = FORCE STRIKE territory
            if (sectionType === 'drop' && zScore > 0) {
                recommendation = 'force_strike';
                reason = `EPIC: ${triggerMetric} Z=${zScore.toFixed(1)}σ in DROP`;
            }
            else if (zScore > 0) {
                recommendation = 'strike';
                reason = `Anomaly: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
            }
            else {
                recommendation = 'prepare';
                reason = `Valley detected: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
            }
        }
        else if (maxZ >= this.config.zScoreSignificant) {
            recommendation = 'prepare';
            reason = `Building: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
        }
        else if (maxZ >= this.config.zScoreNotable) {
            recommendation = 'ignore'; // Notable pero no actionable
            reason = `Notable: ${triggerMetric} Z=${zScore.toFixed(1)}σ`;
        }
        return {
            isAnomaly: maxZ >= this.config.zScoreEpic,
            type,
            severity: maxZ,
            triggerMetric,
            recommendation,
            reason,
        };
    }
    /**
     * Log del estado contextual para debug.
     */
    logContextState(energy, bass, harshness, anomaly, narrative) {
        const formatZ = (z) => {
            const sign = z >= 0 ? '+' : '';
            const absZ = Math.abs(z);
            const emoji = absZ >= 2.5 ? '🔴' : absZ >= 1.5 ? '🟡' : '🟢';
            return `${sign}${z.toFixed(1)}σ ${emoji}`;
        };
        console.log(`[MEMORY 🧠] ` +
            `E:${formatZ(energy.zScore)} ` +
            `B:${formatZ(bass.zScore)} ` +
            `H:${formatZ(harshness.zScore)} | ` +
            `Phase: ${narrative.narrativePhase.toUpperCase()} | ` +
            `${anomaly.isAnomaly ? `⚡ ${anomaly.recommendation.toUpperCase()}` : 'normal'}`);
    }
}
export default ContextualMemory;
