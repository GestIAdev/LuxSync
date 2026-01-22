/**
 * 🔬 EFFECT BIAS TRACKER
 * "El Psicoanalista que detecta monotonía y patrones repetitivos"
 *
 * WAVE 900.1 - Phase 1: Foundation
 *
 * @module EffectBiasTracker
 * @description Sistema de auto-análisis para detectar sesgos en decisiones de efectos.
 *              Similar a BiasDetector.ts pero para efectos visuales en lugar de paletas.
 *
 * RESPONSABILIDADES:
 * - Trackear historial completo de efectos disparados
 * - Detectar sesgos: abuso, olvido, patrones temporales
 * - Calcular métricas de diversidad (0-1)
 * - Identificar efectos "olvidados" (nunca usados)
 * - Detectar patrones temporales (efecto cada X segundos)
 *
 * FILOSOFÍA:
 * "Un cerebro que no se analiza a sí mismo, repite sus errores eternamente."
 *
 * @author PunkOpus (Opus 4.5)
 * @date 2026-01-20
 */
// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DEFAULT_WINDOW_SIZE = 100; // Últimas 100 decisiones
const TEMPORAL_PATTERN_THRESHOLD = 3; // Mínimo 3 ocurrencias para patrón
const TEMPORAL_TOLERANCE_MS = 500; // ±500ms tolerancia en intervalos
const ABUSE_THRESHOLD = 0.5; // >50% = abuso
const NEGLECT_THRESHOLD = 0.05; // <5% = neglect
const FORGOTTEN_THRESHOLD = 50; // No usado en últimos 50 = olvidado
// Efectos conocidos (ALL_EFFECTS del sistema - WAVE 902.1: TRUTH)
// 🎯 Only 2 genres: Latina (10) + Techno (3)
const KNOWN_EFFECTS = [
    // 🌴 LATINO-ORGANIC (10 effects)
    'solar_flare',
    'strobe_storm',
    'strobe_burst',
    'tidal_wave',
    'ghost_breath',
    'tropical_pulse',
    'salsa_fire',
    'cumbia_moon',
    'clave_rhythm',
    'corazon_latino',
    // 🔪 TECHNO-INDUSTRIAL (3 effects)
    'industrial_strobe',
    'acid_sweep',
    'cyber_dualism'
];
// ═══════════════════════════════════════════════════════════════
// EFFECT BIAS TRACKER
// ═══════════════════════════════════════════════════════════════
export class EffectBiasTracker {
    constructor(maxHistorySize = 200) {
        this.history = [];
        this.maxHistorySize = maxHistorySize;
        console.log(`[BIAS_TRACKER] 🔬 Initialized (window: ${maxHistorySize})`);
    }
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    /**
     * Registra un efecto disparado
     */
    recordEffect(entry) {
        this.history.push(entry);
        // Mantener tamaño máximo (circular buffer)
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        // Log cada 10 efectos
        if (this.history.length % 10 === 0) {
            const recent = this.history.slice(-10);
            const uniqueEffects = new Set(recent.map(e => e.effect)).size;
            console.log(`[BIAS_TRACKER] 📊 Last 10 effects: ${uniqueEffects}/10 unique`);
        }
    }
    /**
     * Analiza sesgos en historial de efectos
     */
    analyzeBiases(windowSize = DEFAULT_WINDOW_SIZE) {
        const window = this.history.slice(-windowSize);
        if (window.length < 10) {
            return this.emptyAnalysis();
        }
        const biases = [];
        // 1. Detectar EFFECT ABUSE (>50% uso)
        const abuseDetection = this.detectAbuse(window);
        biases.push(...abuseDetection);
        // 2. Detectar EFFECT NEGLECT (<5% uso)
        const neglectDetection = this.detectNeglect(window);
        biases.push(...neglectDetection);
        // 3. Detectar TEMPORAL PATTERNS
        const temporalDetection = this.detectTemporalPatternBiases(window);
        biases.push(...temporalDetection);
        // 4. Detectar VIBE LOCK (mismo efecto en múltiples vibes)
        const vibeLockDetection = this.detectVibeLock(window);
        biases.push(...vibeLockDetection);
        // 5. Detectar INTENSITY HABIT (siempre misma intensidad)
        const intensityDetection = this.detectIntensityHabit(window);
        biases.push(...intensityDetection);
        // 6. Detectar ZONE PREFERENCE (siempre mismas zonas)
        const zoneDetection = this.detectZonePreference(window);
        biases.push(...zoneDetection);
        // Calcular métricas
        const stats = this.calculateUsageStats(window);
        const diversityScore = this.calculateDiversityFromStats(stats);
        const forgottenEffects = this.findForgottenEffects();
        const hasCriticalBias = biases.some(b => b.severity === 'critical');
        // Generar warnings y recommendations
        const warnings = this.generateWarnings(biases, diversityScore);
        const recommendations = this.generateRecommendations(biases, forgottenEffects);
        return {
            biases,
            hasCriticalBias,
            diversityScore,
            sampleSize: window.length,
            timestamp: Date.now(),
            mostUsedEffect: stats[0]?.effect || 'none',
            leastUsedEffect: stats[stats.length - 1]?.effect || 'none',
            forgottenEffects,
            warnings,
            recommendations
        };
    }
    /**
     * Identifica efectos "olvidados" (nunca usados o muy raramente)
     */
    findForgottenEffects() {
        const recent = this.history.slice(-FORGOTTEN_THRESHOLD);
        const usedEffects = new Set(recent.map(e => e.effect));
        return KNOWN_EFFECTS.filter(effect => !usedEffects.has(effect));
    }
    /**
     * Calcula diversidad de efectos (0-1, 1 = perfecta diversidad)
     */
    calculateDiversity() {
        if (this.history.length < 10)
            return 1.0;
        const recent = this.history.slice(-50); // Últimos 50
        const stats = this.calculateUsageStats(recent);
        return this.calculateDiversityFromStats(stats);
    }
    /**
     * Obtiene historial completo (para debugging)
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Limpia historial (para testing)
     */
    clearHistory() {
        this.history = [];
        console.log('[BIAS_TRACKER] 🗑️ History cleared');
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE DETECTION METHODS
    // ═══════════════════════════════════════════════════════════════
    detectAbuse(window) {
        const biases = [];
        const stats = this.calculateUsageStats(window);
        for (const stat of stats) {
            if (stat.percentage > ABUSE_THRESHOLD) {
                biases.push({
                    type: 'effect_abuse',
                    severity: stat.percentage > 0.7 ? 'critical' :
                        stat.percentage > 0.6 ? 'high' : 'medium',
                    description: `${stat.effect} overused: ${(stat.percentage * 100).toFixed(1)}% of decisions`,
                    evidence: stat,
                    recommendation: `Reduce ${stat.effect} usage. Consider alternatives.`
                });
            }
        }
        return biases;
    }
    detectNeglect(window) {
        const biases = [];
        const stats = this.calculateUsageStats(window);
        for (const stat of stats) {
            if (stat.percentage < NEGLECT_THRESHOLD && stat.count > 0) {
                biases.push({
                    type: 'effect_neglect',
                    severity: 'low',
                    description: `${stat.effect} rarely used: ${(stat.percentage * 100).toFixed(1)}% of decisions`,
                    evidence: stat,
                    recommendation: `Consider using ${stat.effect} more often.`
                });
            }
        }
        return biases;
    }
    detectTemporalPatternBiases(window) {
        const biases = [];
        const patterns = this.findTemporalPatterns(window);
        for (const pattern of patterns) {
            if (pattern.confidence > 0.7) {
                biases.push({
                    type: 'temporal_pattern',
                    severity: pattern.confidence > 0.9 ? 'high' : 'medium',
                    description: `${pattern.effect} fired every ~${(pattern.interval / 1000).toFixed(1)}s (${pattern.occurrences} times)`,
                    evidence: pattern,
                    recommendation: `Break temporal pattern for ${pattern.effect}. Vary timing.`
                });
            }
        }
        return biases;
    }
    findTemporalPatterns(window) {
        const patterns = [];
        // Agrupar por efecto
        const effectGroups = new Map();
        for (const entry of window) {
            if (!effectGroups.has(entry.effect)) {
                effectGroups.set(entry.effect, []);
            }
            effectGroups.get(entry.effect).push(entry.timestamp);
        }
        // Analizar intervalos para cada efecto
        for (const [effect, timestamps] of effectGroups) {
            if (timestamps.length < TEMPORAL_PATTERN_THRESHOLD)
                continue;
            // Calcular intervalos entre disparos
            const intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }
            // Buscar intervalos repetitivos (±500ms)
            const intervalClusters = this.clusterIntervals(intervals, TEMPORAL_TOLERANCE_MS);
            for (const cluster of intervalClusters) {
                if (cluster.count >= TEMPORAL_PATTERN_THRESHOLD) {
                    patterns.push({
                        interval: cluster.avgInterval,
                        effect,
                        occurrences: cluster.count,
                        confidence: Math.min(1.0, cluster.count / 10),
                        lastDetection: timestamps[timestamps.length - 1]
                    });
                }
            }
        }
        return patterns;
    }
    detectVibeLock(window) {
        const biases = [];
        // Agrupar por efecto
        const effectVibes = new Map();
        for (const entry of window) {
            if (!effectVibes.has(entry.effect)) {
                effectVibes.set(entry.effect, new Set());
            }
            effectVibes.get(entry.effect).add(entry.vibe);
        }
        // Detectar efectos usados en múltiples vibes (puede ser correcto o incorrecto)
        for (const [effect, vibes] of effectVibes) {
            if (vibes.size === 1 && window.filter(e => e.effect === effect).length > 10) {
                biases.push({
                    type: 'vibe_lock',
                    severity: 'low',
                    description: `${effect} only used in vibe: ${Array.from(vibes)[0]}`,
                    evidence: { effect, vibes: Array.from(vibes) },
                    recommendation: `Consider if ${effect} could work in other vibes.`
                });
            }
        }
        return biases;
    }
    detectIntensityHabit(window) {
        const biases = [];
        // Calcular estadísticas de intensidad por efecto
        const effectIntensities = new Map();
        for (const entry of window) {
            if (!effectIntensities.has(entry.effect)) {
                effectIntensities.set(entry.effect, []);
            }
            effectIntensities.get(entry.effect).push(entry.intensity);
        }
        // Detectar baja varianza (siempre misma intensidad)
        for (const [effect, intensities] of effectIntensities) {
            if (intensities.length < 5)
                continue;
            const variance = this.calculateVariance(intensities);
            if (variance < 0.01) { // Varianza muy baja
                biases.push({
                    type: 'intensity_habit',
                    severity: 'low',
                    description: `${effect} always used at ~${intensities[0].toFixed(2)} intensity (low variance)`,
                    evidence: { effect, intensities, variance },
                    recommendation: `Vary ${effect} intensity based on context.`
                });
            }
        }
        return biases;
    }
    detectZonePreference(window) {
        const biases = [];
        // Contar uso de zonas
        const zoneUsage = new Map();
        for (const entry of window) {
            const zoneKey = entry.zones.sort().join(',');
            zoneUsage.set(zoneKey, (zoneUsage.get(zoneKey) || 0) + 1);
        }
        // Detectar preferencia extrema
        const totalEffects = window.length;
        for (const [zone, count] of zoneUsage) {
            const percentage = count / totalEffects;
            if (percentage > 0.8) {
                biases.push({
                    type: 'zone_preference',
                    severity: 'medium',
                    description: `Zone preference detected: ${zone} (${(percentage * 100).toFixed(1)}%)`,
                    evidence: { zone, count, percentage },
                    recommendation: `Consider varying zone targets.`
                });
            }
        }
        return biases;
    }
    // ═══════════════════════════════════════════════════════════════
    // PRIVATE HELPER METHODS
    // ═══════════════════════════════════════════════════════════════
    calculateUsageStats(window) {
        const effectCounts = new Map();
        // Contar uso
        for (const entry of window) {
            if (!effectCounts.has(entry.effect)) {
                effectCounts.set(entry.effect, {
                    count: 0,
                    intensities: [],
                    lastUsed: 0,
                    vibes: new Set()
                });
            }
            const stat = effectCounts.get(entry.effect);
            stat.count++;
            stat.intensities.push(entry.intensity);
            stat.lastUsed = Math.max(stat.lastUsed, entry.timestamp);
            stat.vibes.add(entry.vibe);
        }
        // Convertir a array y calcular porcentajes
        const stats = [];
        for (const [effect, data] of effectCounts) {
            stats.push({
                effect,
                count: data.count,
                percentage: data.count / window.length,
                avgIntensity: data.intensities.reduce((a, b) => a + b, 0) / data.intensities.length,
                lastUsed: data.lastUsed,
                vibes: data.vibes
            });
        }
        // Ordenar por uso (más usado primero)
        stats.sort((a, b) => b.count - a.count);
        return stats;
    }
    calculateDiversityFromStats(stats) {
        if (stats.length === 0)
            return 1.0;
        // Shannon entropy normalizado
        const totalEffects = stats.reduce((sum, s) => sum + s.count, 0);
        let entropy = 0;
        for (const stat of stats) {
            const p = stat.count / totalEffects;
            if (p > 0) {
                entropy -= p * Math.log2(p);
            }
        }
        // Normalizar por máxima entropía posible
        const maxEntropy = Math.log2(KNOWN_EFFECTS.length);
        return maxEntropy > 0 ? entropy / maxEntropy : 1.0;
    }
    clusterIntervals(intervals, tolerance) {
        const clusters = [];
        for (const interval of intervals) {
            // Buscar cluster compatible
            let found = false;
            for (const cluster of clusters) {
                const avg = cluster.intervals.reduce((a, b) => a + b, 0) / cluster.intervals.length;
                if (Math.abs(interval - avg) <= tolerance) {
                    cluster.intervals.push(interval);
                    found = true;
                    break;
                }
            }
            if (!found) {
                clusters.push({ intervals: [interval] });
            }
        }
        // Convertir a resultado
        return clusters
            .filter(c => c.intervals.length >= TEMPORAL_PATTERN_THRESHOLD)
            .map(c => ({
            avgInterval: c.intervals.reduce((a, b) => a + b, 0) / c.intervals.length,
            count: c.intervals.length
        }));
    }
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    generateWarnings(biases, diversityScore) {
        const warnings = [];
        // Critical biases
        const criticalBiases = biases.filter(b => b.severity === 'critical');
        if (criticalBiases.length > 0) {
            warnings.push(`⚠️ CRITICAL: ${criticalBiases.length} critical biases detected`);
        }
        // Low diversity
        if (diversityScore < 0.5) {
            warnings.push(`⚠️ Low diversity detected: ${(diversityScore * 100).toFixed(1)}%`);
        }
        // Abuse patterns
        const abuseBiases = biases.filter(b => b.type === 'effect_abuse');
        if (abuseBiases.length > 0) {
            warnings.push(`⚠️ Effect abuse detected: ${abuseBiases.length} effects overused`);
        }
        // Temporal patterns
        const temporalBiases = biases.filter(b => b.type === 'temporal_pattern');
        if (temporalBiases.length > 0) {
            warnings.push(`⚠️ Temporal patterns detected: ${temporalBiases.length} predictable rhythms`);
        }
        return warnings;
    }
    generateRecommendations(biases, forgottenEffects) {
        const recommendations = [];
        // Forgotten effects
        if (forgottenEffects.length > 0) {
            recommendations.push(`💡 Consider using forgotten effects: ${forgottenEffects.slice(0, 3).join(', ')}`);
        }
        // Diversity boost
        const abuseBiases = biases.filter(b => b.type === 'effect_abuse');
        if (abuseBiases.length > 0) {
            recommendations.push(`💡 Boost diversity: reduce usage of top ${abuseBiases.length} effects`);
        }
        // Break patterns
        const temporalBiases = biases.filter(b => b.type === 'temporal_pattern');
        if (temporalBiases.length > 0) {
            recommendations.push(`💡 Break temporal patterns: vary timing and sequencing`);
        }
        return recommendations;
    }
    emptyAnalysis() {
        return {
            biases: [],
            hasCriticalBias: false,
            diversityScore: 1.0,
            sampleSize: 0,
            timestamp: Date.now(),
            mostUsedEffect: 'none',
            leastUsedEffect: 'none',
            forgottenEffects: [],
            warnings: ['⚠️ Insufficient data (< 10 effects)'],
            recommendations: ['💡 Collect more data before analysis']
        };
    }
}
// ═══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════
export const effectBiasTracker = new EffectBiasTracker(200);
