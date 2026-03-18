import { Redis } from "ioredis";
import { StalkingEngine } from './StalkingEngine.js';
import { StrikeMomentEngine } from './StrikeMomentEngine.js';
import { PreyRecognitionEngine } from './PreyRecognitionEngine.js';
/**
 * 🎯 HUNT ORCHESTRATOR
 * "El maestro de la caza - coordina la sinfonía depredadora"
 *
 * CAPACIDAD:
 * - Coordina hunting cycles completos (5-consensus)
 * - Integra StalkingEngine + StrikeMomentEngine + PreyRecognitionEngine
 * - Requiere ENLIGHTENED status para activarse
 * - Gestiona flujo completo: observar → evaluar → golpear → aprender
 */
interface MusicalPattern {
    note: string;
    zodiacSign: string;
    avgBeauty: number;
    occurrences: number;
    beautyTrend: 'rising' | 'falling' | 'stable';
    recentBeautyScores: number[];
    element: 'fire' | 'earth' | 'air' | 'water';
}
interface ProximityReport {
    avgHealth: number;
    nodeCount: number;
    consensusLevel: number;
}
interface HuntCycle {
    cycleId: string;
    startTime: Date;
    endTime?: Date;
    generation?: number;
    stalkedPrey: string | null;
    stalkingCycles: number;
    strikeConditions: {
        beauty: number;
        trend: 'rising' | 'falling' | 'stable';
        consonance: number;
        clusterHealth: number;
    };
    strikeExecuted: boolean;
    strikeResult?: {
        preBeauty: number;
        postBeauty: number;
        improvement: number;
        success: boolean;
    };
    huntRecorded: boolean;
    status: 'stalking' | 'evaluating' | 'striking' | 'learning' | 'completed';
}
interface HuntOrchestratorConfig {
    redis: Redis;
    stalkingEngine: StalkingEngine;
    strikeEngine: StrikeMomentEngine;
    preyEngine: PreyRecognitionEngine;
    ultrasonicEngine: any;
    whiskerEngine: any;
}
export declare class HuntOrchestrator {
    private redis;
    private stalkingEngine;
    private strikeEngine;
    private preyEngine;
    private ultrasonicEngine;
    private whiskerEngine;
    private readonly cycleKeyPrefix;
    private readonly consensusCyclesRequired;
    private activeCycle;
    private cycleConsensusCount;
    private completedCyclesCount;
    constructor(config: HuntOrchestratorConfig);
    /**
     * 🎯 INICIAR CICLO DE CAZA
     * Solo si ENLIGHTENED status = true
     */
    initiateHuntCycle(enlightenedStatus: boolean): Promise<{
        initiated: boolean;
        cycleId?: string;
        reasoning: string;
    }>;
    /**
     * 🔄 EJECUTAR CICLO DE CAZA (llamado cada consensus cycle)
     */
    executeHuntCycle(currentPatterns: MusicalPattern[], proximityReport: ProximityReport, generation: number): Promise<{
        actionTaken: boolean;
        actionType: 'stalking' | 'evaluating' | 'striking' | 'learning' | 'waiting';
        details: any;
    }>;
    /**
     * 🐆 FASE 1: STALKING
     */
    private executeStalkingPhase;
    /**
     * ⚡ FASE 2: EVALUATION
     */
    private executeEvaluationPhase;
    /**
     * 🎯 FASE 3: STRIKING
     */
    private executeStrikePhase;
    /**
     * 🧠 FASE 4: LEARNING
     */
    private executeLearningPhase;
    /**
     * 🎵 CALCULAR CONSONANCIA MUSICAL (DETERMINISTA)
     * Basado en propiedades reales del pattern, no simulación
     */
    private getMusicalConsonance;
    /**
     * 🔢 GENERAR ID DETERMINISTA
     * Basado en estado real del sistema, no aleatoriedad
     */
    private generateDeterministicId;
    /**
     * 💾 PERSISTIR CICLO en Redis
     */
    private persistCycle;
    /**
     * 📊 OBTENER ESTADÍSTICAS
     */
    getStats(): Promise<{
        activeCycle: HuntCycle | null;
        totalCyclesCompleted: number;
        successRate: number;
        avgImprovement: number;
    }>;
}
export {};
//# sourceMappingURL=HuntOrchestrator.d.ts.map