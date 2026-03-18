/**
 * 🧠 ETHICAL CORE ENGINE - PHASE 4: ÉTICA EMERGENTE CON VERITAS
 * "La ética no es opcional, es el fundamento de la consciencia"
 * — PunkClaude, Guardián de la Integridad
 *
 * PHASE 4 FEATURES:
 * ✅ Framework ético base con valores core
 * ✅ Dataset de dilemas éticos deterministas
 * ✅ Sistema de madurez ética con thresholds verificados
 * ✅ Integración real con Veritas para validación criptográfica
 * ✅ Conflict resolution y rate limiting
 * ✅ Safety systems: circuit breakers, timeouts, backups
 */
import { BaseMetaEngine, EngineConfig, EngineMetrics, SafetyContext, ExecutionResult, EngineHealth, EthicalDilemma, EthicalDecision } from './MetaEngineInterfaces.js';
interface EthicalFramework {
    coreValues: Array<{
        name: string;
        weight: number;
        description: string;
        evolutionRate: number;
    }>;
    maturity: {
        level: number;
        experience: number;
        lastEvolution: Date;
        thresholds: {
            basic: number;
            intermediate: number;
            advanced: number;
            transcendent: number;
        };
    };
    decisionHistory: EthicalDecision[];
    activeConflicts: Map<string, EthicalConflict>;
}
interface EthicalConflict {
    conflictId: string;
    dilemmas: EthicalDilemma[];
    resolutionStrategy: 'voting' | 'weighted' | 'veritas_override';
    stakeholders: Array<{
        id: string;
        weight: number;
        preferences: string[];
    }>;
    resolved: boolean;
    resolution?: EthicalDecision;
    timestamp: Date;
}
export declare class EthicalCoreEngine implements BaseMetaEngine {
    readonly config: EngineConfig;
    logger: any;
    private metrics;
    private ethicalFramework;
    private veritas;
    private circuitBreaker;
    private timeoutWrapper;
    private activeDilemmas;
    private lastHealthCheck;
    private evolutionLock;
    constructor(config: EngineConfig);
    initialize(): Promise<void>;
    execute(context: SafetyContext): Promise<ExecutionResult<EthicalDecision>>;
    evaluateEthicalDilemma(context: SafetyContext): Promise<EthicalDecision>;
    private selectDeterministicDilemma;
    private getDeterministicDilemmas;
    private evaluateOptionsWithVeritas;
    private calculatePrincipleAlignment;
    private calculateStakeholderImpact;
    private checkConstraints;
    private selectEthicalOption;
    private generateEthicalReasoning;
    private identifyTradeoffs;
    private compareImpacts;
    private calculateEthicalScore;
    private generateVeritasCertificate;
    private evolveEthicalMaturity;
    private evolveCoreValues;
    private attemptConflictResolution;
    private initializeEthicalFramework;
    private hashString;
    getMetrics(): EngineMetrics;
    getHealth(): Promise<EngineHealth>;
    cleanup(): Promise<void>;
    private updateMetrics;
    getEthicalMaturity(): {
        level: number;
        experience: number;
        stage: string;
    };
    getCoreValues(): EthicalFramework['coreValues'];
    getDeterministicDilemmasForTesting(): EthicalDilemma[];
}
export {};
//# sourceMappingURL=EthicalCoreEngine.d.ts.map