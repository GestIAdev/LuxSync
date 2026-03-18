/**
 * 🧠 PREY RECOexport class PreyRecognitionEngine {
  private redis: any;
  private readonly huntKeyPrefix = 'selene:consciousness:hunts:';
  private readonly profileKeyPrefix = 'selene:consciousness:prey-profiles:';

  constructor(redis: any) {N ENGINE
 * "Recuerda cada caza - aprende de victorias y derrotas"
 *
 * CAPACIDAD:
 * - Persiste hunts en Redis (permanente)
 * - Identifica patterns de éxito (qué presas son más fáciles)
 * - Recomienda mejores momentos según histórico
 */
interface HuntRecord {
    huntId: string;
    targetPattern: string;
    preStrikeBeauty: number;
    preStrikeTrend: 'rising' | 'falling' | 'stable';
    preStrikeConsonance: number;
    clusterHealth: number;
    postStrikeBeauty: number;
    improvement: number;
    success: boolean;
    stalkingCycles: number;
    timestamp: Date;
    generation: number;
}
interface PreyProfile {
    patternKey: string;
    totalHunts: number;
    successfulHunts: number;
    successRate: number;
    avgImprovement: number;
    bestImprovement: number;
    optimalConditions: {
        avgBeautyWhenSuccess: number;
        avgConsonanceWhenSuccess: number;
        avgClusterHealthWhenSuccess: number;
    };
    difficulty: 'easy' | 'medium' | 'hard';
}
export declare class PreyRecognitionEngine {
    private redis;
    private readonly huntKeyPrefix;
    private readonly profileKeyPrefix;
    constructor(redis: any);
    /**
     * 💾 REGISTRAR HUNT en Redis
     */
    recordHunt(hunt: HuntRecord): Promise<void>;
    /**
     * 📊 ACTUALIZAR PROFILE de presa
     */
    private updatePreyProfile;
    /**
     * 📖 CARGAR PROFILE de presa
     */
    loadPreyProfile(patternKey: string): Promise<PreyProfile | null>;
    /**
     * 🎯 RECOMENDAR MEJOR PRESA basado en histórico
     */
    recommendBestPrey(candidates: Array<{
        patternKey: string;
        currentBeauty: number;
    }>): Promise<{
        recommended: string;
        reasoning: string;
        confidence: number;
    }>;
    /**
     * 📊 OBTENER ESTADÍSTICAS generales
     */
    getStats(): Promise<{
        totalHuntsRecorded: number;
        uniquePreyHunted: number;
        overallSuccessRate: number;
        easiestPrey: PreyProfile | null;
        hardestPrey: PreyProfile | null;
    }>;
}
export {};
//# sourceMappingURL=PreyRecognitionEngine.d.ts.map