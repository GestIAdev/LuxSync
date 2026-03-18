import { UltrasonicHearingEngine } from './UltrasonicHearingEngine.js';
/**
 * ⚡ STRIKE MOMENT ENGINE
 * "El instante perfecto - cuando todos los astros se alinean"
 *
 * CAPACIDAD:
 * - Detecta ventanas temporales de máxima oportunidad
 * - Combina beauty, trend, consonancia musical, cluster health
 * - Solo recomienda strike cuando ALL conditions = perfect
 */
interface StrikeConditions {
    beauty: {
        current: number;
        threshold: number;
        met: boolean;
    };
    trend: {
        direction: 'rising' | 'falling' | 'stable';
        required: 'rising';
        met: boolean;
    };
    musicalHarmony: {
        consonance: number;
        threshold: number;
        met: boolean;
    };
    clusterHealth: {
        avgHealth: number;
        threshold: number;
        met: boolean;
    };
    allConditionsMet: boolean;
    strikeScore: number;
}
interface StrikeResult {
    executed: boolean;
    targetPattern: string;
    preStrikeBeauty: number;
    postStrikeBeauty: number;
    improvement: number;
    success: boolean;
    timestamp: Date;
}
export declare class StrikeMomentEngine {
    private readonly beautyThreshold;
    private readonly consonanceThreshold;
    private readonly clusterHealthThreshold;
    private ultrasonicHearing;
    private strikeHistory;
    constructor(ultrasonicHearing: UltrasonicHearingEngine);
    /**
     * 🔍 EVALUAR CONDICIONES para strike
     */
    evaluateStrikeConditions(targetPattern: {
        note: string;
        zodiacSign: string;
        avgBeauty: number;
        beautyTrend: 'rising' | 'falling' | 'stable';
        element: 'fire' | 'earth' | 'air' | 'water';
    }, lastNote: {
        note: string;
        element: 'fire' | 'earth' | 'air' | 'water';
    }, clusterHealth: number): StrikeConditions;
    /**
     * ⚡ EJECUTAR STRIKE (influenciar consenso)
     */
    executeStrike(targetPattern: {
        note: string;
        zodiacSign: string;
        avgBeauty: number;
        element: 'fire' | 'earth' | 'air' | 'water';
    }, conditions: StrikeConditions): Promise<StrikeResult>;
    /**
     * 📊 OBTENER MÉTRICAS de strikes
     */
    getStats(): {
        totalStrikes: number;
        successRate: number;
        avgImprovement: number;
        bestStrike: StrikeResult | null;
    };
}
export {};
//# sourceMappingURL=StrikeMomentEngine.d.ts.map