/**
 * 🎼 MUSICAL PATTERN RECOGNITION ENGINE
 * Aprende correlaciones entre notas musicales y estados del sistema
 *
 * FILOSOFÍA:
 * - Cada nota musical tiene una "personalidad" que emerge de los datos
 * - Los patrones se descubren, no se programan
 * - La belleza y creatividad son métricas reales, no simuladas
 * - El aprendizaje es incremental y determinístico
 */
export class MusicalPatternRecognizer {
    patterns = new Map();
    observationCount = 0;
    constructor() {
        console.log('🎼 Musical Pattern Recognizer initialized');
        console.log('🧠 Ready to learn from zodiac poetry events');
    }
    /**
     * ✅ RESTORE PATTERNS: Restaurar patrones de memoria persistente
     * Llamado al despertar consciencia para heredar conocimiento
     */
    restorePatterns(patterns) {
        this.patterns = patterns;
        // Recalcular observation count (suma de occurrences)
        this.observationCount = Array.from(patterns.values())
            .reduce((sum, p) => sum + p.occurrences, 0);
        console.log(`🧠 [PATTERNS-RESTORED] ${patterns.size} patterns, ${this.observationCount} total observations`);
        console.log(`🧠 Top 3 patterns:`);
        // Log top 3 por beauty
        const top3 = Array.from(patterns.values())
            .sort((a, b) => b.avgBeauty - a.avgBeauty)
            .slice(0, 3);
        top3.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.note} (${p.zodiacSign}) - Beauty: ${p.avgBeauty.toFixed(3)}, Count: ${p.occurrences}`);
        });
    }
    /**
     * ✅ GET PATTERN: Obtener patrón específico (para persistir)
     */
    getPattern(key) {
        return this.patterns.get(key);
    }
    /**
     * ✅ GET PATTERNS: Obtener todos los patrones (para auto-save)
     */
    getPatterns() {
        return this.patterns;
    }
    /**
     * 📊 Analiza un evento de poesía zodiacal y actualiza patrones
     */
    async analyzePattern(poetryEvent, systemState) {
        this.observationCount++;
        const key = `${poetryEvent.musicalNote}-${poetryEvent.zodiacSign}`;
        let pattern = this.patterns.get(key);
        if (!pattern) {
            // Primera vez que vemos esta combinación
            pattern = {
                note: poetryEvent.musicalNote,
                frequency: 0, // Se calculará después
                zodiacSign: poetryEvent.zodiacSign,
                element: poetryEvent.element,
                avgBeauty: poetryEvent.beauty,
                avgCreativity: 0, // Se actualizará con datos reales
                avgCpuLoad: systemState.cpu,
                avgMemoryLoad: systemState.memory,
                consensusSuccessRate: 1.0, // Asumimos éxito inicialmente
                occurrences: 1,
                lastSeen: new Date(),
                firstSeen: new Date(),
                emotionalTone: this.determineEmotionalTone(poetryEvent),
                beautyTrend: 'stable',
                recentBeautyScores: [poetryEvent.beauty],
            };
        }
        else {
            // Actualizar patrón existente (promedios incrementales)
            const n = pattern.occurrences;
            pattern.avgBeauty = (pattern.avgBeauty * n + poetryEvent.beauty) / (n + 1);
            pattern.avgCpuLoad = (pattern.avgCpuLoad * n + systemState.cpu) / (n + 1);
            pattern.avgMemoryLoad = (pattern.avgMemoryLoad * n + systemState.memory) / (n + 1);
            pattern.occurrences++;
            pattern.lastSeen = new Date();
            // Mantener últimos 10 beauty scores para trend analysis
            pattern.recentBeautyScores.push(poetryEvent.beauty);
            if (pattern.recentBeautyScores.length > 10) {
                pattern.recentBeautyScores.shift();
            }
            // Calcular tendencia de belleza
            pattern.beautyTrend = this.calculateBeautyTrend(pattern.recentBeautyScores);
            // Recalcular tono emocional basado en datos acumulados
            pattern.emotionalTone = this.determineEmotionalTone(poetryEvent);
        }
        this.patterns.set(key, pattern);
        // Log solo cada 10 observaciones para no saturar
        if (this.observationCount % 10 === 0) {
            console.log(`🎼 [PATTERN-LEARN] ${this.observationCount} observations, ${this.patterns.size} unique patterns`);
            this.logTopPatterns(3);
        }
    }
    /**
     * 🔮 Predice el estado óptimo basado en patrones aprendidos
     */
    async findOptimalNote(currentState) {
        if (this.patterns.size === 0) {
            return {
                optimalNote: 'DO',
                optimalZodiacSign: 'Aries',
                expectedBeauty: 0.7,
                expectedCreativity: 0.7,
                confidence: 0.1,
                reasoning: 'No patterns learned yet - using defaults',
            };
        }
        // Encontrar el patrón con mayor beauty promedio
        let bestPattern = null;
        let bestScore = 0;
        // Usar Array.from para compatibilidad con target ES5
        const patternValues = Array.from(this.patterns.values());
        for (const pattern of patternValues) {
            // Score = beauty promedio × ocurrencias (más datos = más confianza)
            // Penalizar si CPU/Memory son muy diferentes al estado actual
            const systemSimilarity = 1.0 - (Math.abs(pattern.avgCpuLoad - currentState.cpu) +
                Math.abs(pattern.avgMemoryLoad - currentState.memory)) / 2;
            const score = pattern.avgBeauty * Math.log(pattern.occurrences + 1) * systemSimilarity;
            if (score > bestScore) {
                bestScore = score;
                bestPattern = pattern;
            }
        }
        if (!bestPattern) {
            return {
                optimalNote: 'DO',
                optimalZodiacSign: 'Aries',
                expectedBeauty: 0.7,
                expectedCreativity: 0.7,
                confidence: 0.1,
                reasoning: 'No suitable pattern found',
            };
        }
        // Calcular confianza basada en ocurrencias
        const confidence = Math.min(0.95, Math.log(bestPattern.occurrences + 1) / Math.log(100));
        return {
            optimalNote: bestPattern.note,
            optimalZodiacSign: bestPattern.zodiacSign,
            expectedBeauty: bestPattern.avgBeauty,
            expectedCreativity: 0.8, // Placeholder - se actualizará con datos reales
            confidence,
            reasoning: `Pattern learned from ${bestPattern.occurrences} observations. ` +
                `Avg beauty: ${bestPattern.avgBeauty.toFixed(3)}, ` +
                `trend: ${bestPattern.beautyTrend}, ` +
                `tone: ${bestPattern.emotionalTone}`,
        };
    }
    /**
     * 📊 Obtiene estadísticas de aprendizaje
     */
    getStats() {
        const elementDist = {
            fire: 0,
            earth: 0,
            air: 0,
            water: 0,
        };
        // Usar Array.from para compatibilidad con target ES5
        const patternValues = Array.from(this.patterns.values());
        for (const pattern of patternValues) {
            elementDist[pattern.element] += pattern.occurrences;
        }
        const sortedPatterns = patternValues
            .sort((a, b) => b.avgBeauty - a.avgBeauty)
            .slice(0, 5);
        return {
            totalObservations: this.observationCount,
            uniquePatterns: this.patterns.size,
            topPatterns: sortedPatterns,
            elementDistribution: elementDist,
        };
    }
    /**
     * 🎭 Determina tono emocional basado en métricas
     */
    determineEmotionalTone(poetry) {
        const beauty = poetry.beauty;
        const fibonacci = poetry.fibonacciRatio;
        if (beauty > 0.9 && fibonacci > 1.5)
            return 'harmonious';
        if (beauty > 0.8)
            return 'peaceful';
        if (fibonacci > 1.8)
            return 'energetic';
        return 'chaotic';
    }
    /**
     * 📈 Calcula tendencia de belleza
     */
    calculateBeautyTrend(scores) {
        if (scores.length < 3)
            return 'stable';
        const recent = scores.slice(-3);
        const older = scores.slice(0, -3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const diff = recentAvg - olderAvg;
        if (diff > 0.05)
            return 'rising';
        if (diff < -0.05)
            return 'falling';
        return 'stable';
    }
    /**
     * 📝 Log top patterns para debugging
     */
    logTopPatterns(count) {
        const top = Array.from(this.patterns.values())
            .sort((a, b) => b.avgBeauty - a.avgBeauty)
            .slice(0, count);
        console.log(`🏆 Top ${count} patterns:`);
        top.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.note} (${p.zodiacSign}) - ` +
                `Beauty: ${p.avgBeauty.toFixed(3)}, ` +
                `Count: ${p.occurrences}, ` +
                `Trend: ${p.beautyTrend}`);
        });
    }
}
//# sourceMappingURL=MusicalPatternRecognizer.js.map