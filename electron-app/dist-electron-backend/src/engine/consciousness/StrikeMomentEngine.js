/**
 * ⚡ STRIKE MOMENT ENGINE
 * "El instante perfecto - cuando todos los astros se alinean"
 *
 * WAVE 5: THE HUNT - Capa de Cognición
 *
 * CAPACIDADES:
 * - Detecta ventanas temporales de máxima oportunidad
 * - Combina beauty + trend + consonancia + cluster health
 * - Solo recomienda strike cuando ALL conditions = perfect
 *
 * FILOSOFÍA FELINA:
 * El gato no salta cuando quiere.
 * Salta cuando SABE que va a atrapar.
 * El instante perfecto es cuando TODAS las condiciones se alinean.
 */
// ============================================
// 🎵 CONSTANTES MUSICALES
// ============================================
const NOTE_TO_SEMITONE = {
    'DO': 0, 'DO#': 1, 'RE': 2, 'RE#': 3,
    'MI': 4, 'FA': 5, 'FA#': 6, 'SOL': 7,
    'SOL#': 8, 'LA': 9, 'LA#': 10, 'SI': 11
};
const INTERVAL_NAMES = {
    0: 'unison',
    1: 'minor second',
    2: 'major second',
    3: 'minor third',
    4: 'major third',
    5: 'perfect fourth',
    6: 'tritone',
    7: 'perfect fifth',
    8: 'minor sixth',
    9: 'major sixth',
    10: 'minor seventh',
    11: 'major seventh',
    12: 'octave'
};
/** Scores de consonancia por intervalo (teoría musical) */
const CONSONANCE_SCORES = {
    0: 1.0, // unison - perfect
    1: 0.1, // minor second - very dissonant
    2: 0.2, // major second - dissonant
    3: 0.8, // minor third - consonant
    4: 0.9, // major third - very consonant
    5: 0.7, // perfect fourth - consonant
    6: 0.0, // tritone - maximally dissonant (diabulus in musica)
    7: 1.0, // perfect fifth - perfect
    8: 0.6, // minor sixth - somewhat consonant
    9: 0.8, // major sixth - consonant
    10: 0.3, // minor seventh - dissonant
    11: 0.4, // major seventh - dissonant
    12: 1.0 // octave - perfect
};
/** Compatibilidad elemental (astrología clásica) */
const ELEMENT_COMPATIBILITY = {
    'fire': { fire: 1.0, air: 0.8, earth: 0.3, water: 0.2 },
    'air': { air: 1.0, fire: 0.8, water: 0.3, earth: 0.2 },
    'earth': { earth: 1.0, water: 0.8, fire: 0.3, air: 0.2 },
    'water': { water: 1.0, earth: 0.8, air: 0.3, fire: 0.2 }
};
// ============================================
// ⚡ STRIKE MOMENT ENGINE
// ============================================
export class StrikeMomentEngine {
    constructor(config) {
        // === Configuración ===
        this.config = {
            beautyThreshold: 0.85, // 85% beauty mínimo
            consonanceThreshold: 0.7, // 70% consonancia mínima
            clusterHealthThreshold: 0.6, // 60% health mínimo
            strictMode: false // Modo flexible por defecto
        };
        // === Estado interno ===
        this.strikeHistory = [];
        this.maxHistory = 100;
        this.lastNote = null;
        this.consecutiveStrikes = 0;
        this.cooldownUntil = 0;
        this.strikeCooldownMs = 2000; // 2 segundos entre strikes
        if (config) {
            this.config = { ...this.config, ...config };
        }
        console.log('⚡ [STRIKE] Engine initialized');
    }
    // ============================================
    // 🔍 EVALUAR CONDICIONES
    // ============================================
    /**
     * Evaluar si las condiciones son óptimas para un strike
     */
    evaluateStrikeConditions(targetPrey, clusterHealth = 0.8) {
        const { pattern } = targetPrey;
        // 1. Beauty check
        const beautyMet = pattern.avgBeauty >= this.config.beautyThreshold;
        // 2. Trend check
        const trendMet = this.config.strictMode
            ? pattern.beautyTrend === 'rising'
            : pattern.beautyTrend === 'rising' ||
                (pattern.beautyTrend === 'stable' && pattern.avgBeauty > 0.9);
        // 3. Musical harmony check (si tenemos nota previa)
        let consonance = 0.7; // Default si no hay historial
        if (this.lastNote) {
            const interval = this.analyzeInterval(this.lastNote.note, pattern.note, this.lastNote.element, pattern.element);
            consonance = (interval.consonance * 0.7) + (interval.zodiacHarmony * 0.3);
        }
        const consonanceMet = consonance >= this.config.consonanceThreshold;
        // 4. Cluster health check
        const healthMet = clusterHealth >= this.config.clusterHealthThreshold;
        // 5. Cooldown check
        const cooldownMet = Date.now() > this.cooldownUntil;
        // Contar condiciones cumplidas
        const conditions = [beautyMet, trendMet, consonanceMet, healthMet, cooldownMet];
        const conditionsMet = conditions.filter(Boolean).length;
        const totalConditions = conditions.length;
        // All conditions met?
        const allMet = this.config.strictMode
            ? conditions.every(Boolean)
            : conditionsMet >= 4; // Al menos 4 de 5 en modo flexible
        // Calculate strike score
        const strikeScore = allMet
            ? this.calculateStrikeScore(pattern.avgBeauty, trendMet, consonance, clusterHealth)
            : 0.0;
        return {
            beauty: {
                current: pattern.avgBeauty,
                threshold: this.config.beautyThreshold,
                met: beautyMet
            },
            trend: {
                direction: pattern.beautyTrend,
                required: this.config.strictMode ? 'rising' : 'rising_or_stable',
                met: trendMet
            },
            musicalHarmony: {
                consonance,
                threshold: this.config.consonanceThreshold,
                met: consonanceMet
            },
            clusterHealth: {
                avgHealth: clusterHealth,
                threshold: this.config.clusterHealthThreshold,
                met: healthMet
            },
            allConditionsMet: allMet,
            strikeScore,
            conditionsMet,
            totalConditions
        };
    }
    // ============================================
    // ⚡ EJECUTAR STRIKE
    // ============================================
    /**
     * Registrar la ejecución de un strike
     */
    executeStrike(targetPrey, conditions, postStrikeBeauty) {
        const patternKey = `${targetPrey.pattern.note}-${targetPrey.pattern.element}`;
        const preStrikeBeauty = targetPrey.pattern.avgBeauty;
        const actualPostBeauty = postStrikeBeauty ?? preStrikeBeauty; // Se actualiza después
        console.log('');
        console.log('⚡ ═══════════════════════════════════════════════════');
        console.log(`⚡ [STRIKE] EXECUTING on pattern: ${patternKey}`);
        console.log(`⚡ [STRIKE] Pre-beauty: ${preStrikeBeauty.toFixed(3)}`);
        console.log(`⚡ [STRIKE] Strike score: ${conditions.strikeScore.toFixed(3)}`);
        console.log(`⚡ [STRIKE] Conditions: ${conditions.conditionsMet}/${conditions.totalConditions}`);
        console.log('⚡ ═══════════════════════════════════════════════════');
        console.log('');
        const result = {
            executed: true,
            targetPattern: patternKey,
            preStrikeBeauty,
            postStrikeBeauty: actualPostBeauty,
            improvement: actualPostBeauty - preStrikeBeauty,
            success: actualPostBeauty >= preStrikeBeauty,
            timestamp: Date.now(),
            conditions
        };
        // Actualizar estado
        this.lastNote = {
            note: targetPrey.pattern.note,
            element: targetPrey.pattern.element
        };
        // Aplicar cooldown
        this.cooldownUntil = Date.now() + this.strikeCooldownMs;
        this.consecutiveStrikes++;
        // Guardar en historial
        this.strikeHistory.push(result);
        if (this.strikeHistory.length > this.maxHistory) {
            this.strikeHistory.shift();
        }
        return result;
    }
    /**
     * Actualizar resultado de strike después de conocer el impacto real
     */
    updateStrikeResult(strikeIndex, postStrikeBeauty) {
        if (strikeIndex >= 0 && strikeIndex < this.strikeHistory.length) {
            const strike = this.strikeHistory[strikeIndex];
            strike.postStrikeBeauty = postStrikeBeauty;
            strike.improvement = postStrikeBeauty - strike.preStrikeBeauty;
            strike.success = strike.improvement >= 0;
        }
    }
    // ============================================
    // 🎵 ANÁLISIS MUSICAL
    // ============================================
    /**
     * Analizar intervalo musical entre dos notas
     */
    analyzeInterval(fromNote, toNote, fromElement, toElement) {
        const fromSemitone = NOTE_TO_SEMITONE[fromNote] ?? 0;
        const toSemitone = NOTE_TO_SEMITONE[toNote] ?? 0;
        // Calcular intervalo (siempre ascendente, mod 12)
        let semitones = toSemitone - fromSemitone;
        if (semitones < 0)
            semitones += 12;
        const intervalName = INTERVAL_NAMES[semitones] || `unknown (${semitones} semitones)`;
        const consonance = CONSONANCE_SCORES[semitones] ?? 0.5;
        const zodiacHarmony = ELEMENT_COMPATIBILITY[fromElement]?.[toElement] ?? 0.5;
        return {
            fromNote,
            toNote,
            semitones,
            intervalName,
            consonance,
            zodiacHarmony
        };
    }
    // ============================================
    // 📊 CÁLCULOS INTERNOS
    // ============================================
    /**
     * Calcular score de strike (probabilidad de éxito)
     */
    calculateStrikeScore(beauty, trendMet, consonance, clusterHealth) {
        // Pesos de los factores
        const weights = {
            beauty: 0.35,
            trend: 0.20,
            consonance: 0.25,
            health: 0.20
        };
        return (beauty * weights.beauty +
            (trendMet ? 1.0 : 0.5) * weights.trend +
            consonance * weights.consonance +
            clusterHealth * weights.health);
    }
    // ============================================
    // 📈 GETTERS Y ESTADÍSTICAS
    // ============================================
    /** Obtener historial de strikes */
    getStrikeHistory() {
        return [...this.strikeHistory];
    }
    /** Obtener último strike */
    getLastStrike() {
        return this.strikeHistory[this.strikeHistory.length - 1] ?? null;
    }
    /** Verificar si estamos en cooldown */
    isInCooldown() {
        return Date.now() < this.cooldownUntil;
    }
    /** Obtener tiempo restante de cooldown */
    getCooldownRemaining() {
        return Math.max(0, this.cooldownUntil - Date.now());
    }
    /** Obtener estadísticas */
    getStats() {
        const total = this.strikeHistory.length;
        const successful = this.strikeHistory.filter(s => s.success).length;
        const avgImprovement = total > 0
            ? this.strikeHistory.reduce((sum, s) => sum + s.improvement, 0) / total
            : 0;
        return {
            totalStrikes: total,
            successfulStrikes: successful,
            successRate: total > 0 ? successful / total : 0,
            avgImprovement,
            consecutiveStrikes: this.consecutiveStrikes,
            inCooldown: this.isInCooldown()
        };
    }
    /** Actualizar configuración */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        console.log('⚡ [STRIKE] Config updated:', this.config);
    }
    /** Reset del motor */
    reset() {
        this.strikeHistory = [];
        this.lastNote = null;
        this.consecutiveStrikes = 0;
        this.cooldownUntil = 0;
        console.log('⚡ [STRIKE] Engine reset');
    }
}
