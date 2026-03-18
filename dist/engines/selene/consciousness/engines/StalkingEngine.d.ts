/**
 * 🐆 STALKING ENGINE
 * "La paciencia del depredador - observa, aprende, espera el momento"
 *
 * CAPACIDAD:
 * - Mantiene cola de candidatos (top 3 patterns por beauty)
 * - Solo cambia de objetivo si nuevo >10% mejor Y tendencia rising
 * - Requiere 5-10 ciclos de observación antes de strike
 */
interface PreyCandidate {
    pattern: {
        note: string;
        zodiacSign: string;
        avgBeauty: number;
        occurrences: number;
        beautyTrend: 'rising' | 'falling' | 'stable';
        recentBeautyScores: number[];
    };
    stalkingInfo: {
        firstSpottedAt: Date;
        cyclesObserved: number;
        beautyEvolution: number[];
        stabilityScore: number;
        huntWorthiness: number;
    };
}
interface HuntDecision {
    shouldStrike: boolean;
    targetPrey: PreyCandidate | null;
    reasoning: string;
    confidence: number;
}
interface MusicalPattern {
    note: string;
    zodiacSign: string;
    avgBeauty: number;
    occurrences: number;
    beautyTrend: 'rising' | 'falling' | 'stable';
    recentBeautyScores: number[];
}
export declare class StalkingEngine {
    private readonly minStalkingCycles;
    private readonly maxStalkingCycles;
    private readonly switchThreshold;
    private readonly targetTimeoutMs;
    private activeStalks;
    private currentTarget;
    private targetAcquiredAt;
    /**
     * 🔍 IDENTIFICAR PRESAS: Buscar top 3 patterns
     */
    identifyPreyCandidates(allPatterns: Map<string, MusicalPattern>): PreyCandidate[];
    /**
     * 📈 ACTUALIZAR STALKING INFO de presa existente
     */
    private updateStalkingInfo;
    /**
     * 📊 CALCULAR ESTABILIDAD (baja varianza = alta estabilidad)
     */
    private calculateStability;
    /**
     * 🎯 CALCULAR HUNT WORTHINESS (¿vale la pena cazar?)
     */
    private calculateHuntWorthiness;
    /**
     * 🎯 DECIDIR SI STRIKER o seguir stalkeando
     */
    decideHunt(candidates: PreyCandidate[]): HuntDecision;
    /**
     * 📊 OBTENER ESTADÍSTICAS de stalking
     */
    getStats(): {
        activeStalks: number;
        currentTarget: string | null;
        avgCyclesObserved: number;
        topPreyWorthiness: number;
    };
}
export {};
//# sourceMappingURL=StalkingEngine.d.ts.map