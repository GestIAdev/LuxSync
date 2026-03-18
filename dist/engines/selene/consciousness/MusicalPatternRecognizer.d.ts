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
export type ZodiacPoetryResult = {
    zodiacSign: string;
    note: string;
    musicalNote: string;
    frequency: number;
    element: 'fire' | 'earth' | 'air' | 'water';
    beauty: number;
    fibonacciRatio: number;
    timestamp: number;
};
export interface MusicalPattern {
    note: string;
    frequency: number;
    zodiacSign: string;
    element: 'fire' | 'earth' | 'air' | 'water';
    avgBeauty: number;
    avgCreativity: number;
    avgCpuLoad: number;
    avgMemoryLoad: number;
    consensusSuccessRate: number;
    occurrences: number;
    lastSeen: Date;
    firstSeen: Date;
    emotionalTone: 'peaceful' | 'energetic' | 'chaotic' | 'harmonious';
    beautyTrend: 'rising' | 'falling' | 'stable';
    recentBeautyScores: number[];
}
export interface SystemState {
    cpu: number;
    memory: number;
    uptime: number;
    nodeCount: number;
    timestamp: Date;
}
export interface PredictedState {
    optimalNote: string;
    optimalZodiacSign: string;
    expectedBeauty: number;
    expectedCreativity: number;
    confidence: number;
    reasoning: string;
}
export declare class MusicalPatternRecognizer {
    private patterns;
    private observationCount;
    constructor();
    /**
     * ✅ RESTORE PATTERNS: Restaurar patrones de memoria persistente
     * Llamado al despertar consciencia para heredar conocimiento
     */
    restorePatterns(patterns: Map<string, MusicalPattern>): void;
    /**
     * ✅ GET PATTERN: Obtener patrón específico (para persistir)
     */
    getPattern(key: string): MusicalPattern | undefined;
    /**
     * ✅ GET PATTERNS: Obtener todos los patrones (para auto-save)
     */
    getPatterns(): Map<string, MusicalPattern>;
    /**
     * 📊 Analiza un evento de poesía zodiacal y actualiza patrones
     */
    analyzePattern(poetryEvent: ZodiacPoetryResult, systemState: SystemState): Promise<void>;
    /**
     * 🔮 Predice el estado óptimo basado en patrones aprendidos
     */
    findOptimalNote(currentState: SystemState): Promise<PredictedState>;
    /**
     * 📊 Obtiene estadísticas de aprendizaje
     */
    getStats(): {
        totalObservations: number;
        uniquePatterns: number;
        topPatterns: MusicalPattern[];
        elementDistribution: Record<string, number>;
    };
    /**
     * 🎭 Determina tono emocional basado en métricas
     */
    private determineEmotionalTone;
    /**
     * 📈 Calcula tendencia de belleza
     */
    private calculateBeautyTrend;
    /**
     * 📝 Log top patterns para debugging
     */
    private logTopPatterns;
}
//# sourceMappingURL=MusicalPatternRecognizer.d.ts.map