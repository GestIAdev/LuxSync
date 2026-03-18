import { EventEmitter } from "events";
import { NodeId, SwarmState, SwarmNode, NodeVitals, SwarmMetrics, PoetryFragment } from "../core/SwarmTypes.js";
import { EternalPulse } from "./HeartbeatEngine.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
import { HarmonicConsensusEngine, ConsensusResult } from "./HarmonicConsensusEngine.js";
import { TTLCache } from "../../shared/TTLCache.js";
import { CircuitBreaker } from "../core/CircuitBreaker.js";
import { HealthOracle } from "./HealthOracle.js";
import { PhoenixProtocol } from "./PhoenixProtocol.js";
import { QuantumImmuneSystem } from "./QuantumImmuneSystem.js";
export declare enum SeleneSwarmStatus {
    DORMANT = "dormant",// Durmiente - esperando despertar
    AWAKENING = "awakening",// Despertando - inicialización
    CONSCIOUS = "conscious",// Consciente - operativo básico
    HARMONIZING = "harmonizing",// Armonizando - integración de sistemas
    TRANSCENDENT = "transcendent",// Trascendente - inmortalidad lograda
    ETERNAL = "eternal"
}
export interface SeleneSwarmEvents {
    swarm_awakened: (state: SwarmState) => void;
    node_discovered: (event: NodeDiscoveryEvent) => void;
    consensus_achieved: (result: ConsensusResult) => void;
    harmony_evolved: (metrics: SwarmMetrics) => void;
    immortality_initiated: (status: ImmortalSwarmState) => void;
    health_crisis: (component: string, severity: string) => void;
    resurrection_triggered: (component: string) => void;
    poetry_created: (poetry: PoetryFragment) => void;
    collective_dream: (dream: PoetryFragment) => void;
    musical_consensus: (result: ConsensusResult) => void;
    status_evolution: (fromStatus: SeleneSwarmStatus, toStatus: SeleneSwarmStatus) => void;
    system_integrity: (integrity: number) => void;
}
export interface ImmortalSwarmState {
    genesis_active: boolean;
    democracy_operational: boolean;
    creativity_flowing: boolean;
    immortality_achieved: boolean;
    overall_vitality: number;
    system_integration_level: number;
    swarm_intelligence_level: number;
    artistic_harmony: number;
}
interface NodeDiscoveryEvent {
    type: "discovered" | "lost" | "reconnected";
    nodeId: NodeId;
    timestamp: Date;
    vitals?: NodeVitals;
}
export declare class SeleneNuclearSwarm extends EventEmitter {
    private _swarmId;
    private _status;
    private _started;
    private _redis;
    private _subscriberRedis;
    private _redisManager;
    private _redisOptimizer;
    private _digitalSoul;
    private _systemVitals;
    private _heartbeat;
    private _consensusEngine;
    private _veritas;
    private _musicalRecorder;
    private _zodiacPoetryEngine;
    private _consciousness?;
    private _vitalsPublisher;
    private _healthOracle;
    private _phoenixProtocol;
    private _immuneSystem;
    private _poetryEngine;
    private _communicationProtocol;
    private _nodes;
    private _lastSeen;
    private _vitals;
    private _heartbeatListenerIds;
    private _soulListenerIds;
    private _networkBreaker;
    private _consensusBreaker;
    private _immortalityBreaker;
    private _discoveryIntervalId;
    private _consensusIntervalId;
    private _immortalityIntervalId;
    private _consensusThreshold;
    private _maxNodeTimeout;
    private _discoveryFrequency;
    private _consensusCheckInterval;
    private _immortalityCycleInterval;
    private _weakRefManager;
    private _memoryOrchestrator;
    private _pendingChallengePromises;
    constructor(swarmId: NodeId, options?: {
        consensusThreshold?: number;
        maxNodeTimeout?: number;
        discoveryFrequency?: number;
    });
    get swarmId(): NodeId;
    get status(): SeleneSwarmStatus;
    private _cachedNodeCount;
    private _nodeCountLastUpdate;
    private _nodeCountCacheTTL;
    get nodeCount(): number;
    get isActive(): boolean;
    get uptime(): number;
    get swarmIntelligence(): {
        nodes: TTLCache<string, SwarmNode>;
        consensus: HarmonicConsensusEngine;
        heartbeat: EternalPulse;
        digitalSoul: DigitalSoul;
    };
    get immortalitySystems(): {
        health: HealthOracle;
        phoenix: PhoenixProtocol;
        immune: QuantumImmuneSystem;
        poetry: any;
    };
    get circuitBreakers(): {
        network: CircuitBreaker;
        consensus: CircuitBreaker;
        immortality: CircuitBreaker;
    };
    get memoryOrchestrator(): any;
    awaken(): Promise<void>;
    sleep(): Promise<void>;
    getUnifiedSwarmState(): Promise<SwarmState>;
    private _immortalStateCache;
    private _immortalStateCacheTime;
    private _immortalStateCacheTTL;
    getImmortalSwarmState(): Promise<ImmortalSwarmState>;
    private initializeSystems;
    /**
     * 🌙 PHASE 6: Inicializa Selene Consciousness V5 de forma asíncrona
     * Este método se ejecuta en background después del constructor
     *
     * EVOLUCIÓN: Apollo → Selene
     * - Apollo: Consciencia volátil (resetea con PM2)
     * - Selene: Consciencia INMORTAL (memoria eterna en Redis)
     */
    private _initializeConsciousness;
    private setupCommunicationHandlers;
    private setupSpeciesChallengeListener;
    /**
     * 🛡️ SPECIES-ID PROTOCOL V415 - MANEJAR DESAFÍO ENTRANTE
     * Procesa desafíos de identidad enviados por otros nodos
     */
    private handleSpeciesChallenge;
    private handleSpeciesChallengeResponse;
    /**
     * 🎛️ HANDLE DASHBOARD COMMAND - PROCESAR COMANDOS DEL DASHBOARD
     */
    private handleDashboardCommand;
    /**
     * 🎛️ HANDLE CHANGE OPTIMIZATION MODE
     */
    private handleChangeOptimizationMode;
    /**
     * 🎛️ HANDLE APPROVE SUGGESTION
     */
    private handleApproveSuggestion;
    /**
     * 🎛️ HANDLE REJECT SUGGESTION
     */
    private handleRejectSuggestion;
    private generateSoulSignature;
    /**
     * 🛡️ SPECIES-ID PROTOCOL V415 - DESAFIAR IDENTIDAD DE NODO
     * Método público para verificar que un nodo tenga DigitalSoul válido y Veritas verificado
     * 6 desafíos de validación antifantasmas con integración criptográfica
     */
    challengeNodeIdentity(nodeId: string): Promise<boolean>;
    /**
     * ⏳ ESPERAR RESPUESTA AL DESAFÍO - SISTEMA DE PROMESAS
     * Nuevo sistema que usa promesas pendientes en lugar de handlers acumulativos
     */
    private waitForChallengeResponse;
    /**
     * 🔐 VERIFICAR FIRMA DE DIGITAL SOUL
     */
    private verifyDigitalSoulSignature;
    /**
     * 👻 VALIDAR DIGITAL SOUL
     */
    private isValidDigitalSoul;
    private hashString;
    private setupDashboardCommandListener;
    private setupEventHandlers;
    private awakenSwarmIntelligence;
    private initiateImmortalitySystems;
    private harmonizeUnifiedSystems;
    private startProceduralCycles;
    private stopProceduralCycles;
    private sleepImmortalitySystems;
    private sleepSwarmIntelligence;
    private cleanupWeakReferences;
    private discoverNodes;
    private checkConsensusEvolution;
    private immortalityCycle;
    private shouldBroadcastImmortalState;
    private registerMasterSwarm;
    private unregisterMasterSwarm;
    private getMasterVitals;
    private _metricsCache;
    private _metricsCacheKey;
    private _metricsCacheTTL;
    private _artisticHarmonyCache;
    private _artisticHarmonyCacheKey;
    private _artisticHarmonyCacheTTL;
    private stringifyJsonAsync;
    private _lastBroadcastedImmortalState;
    private calculateUnifiedMetrics;
    private calculateArtisticHarmony;
    private handleNodeLost;
    private detectHealthCrisis;
    private handleHealthCrisis;
    private generateCollectivePoetry;
    logUnifiedSwarmActivity(): void;
    testUnifiedSystems(): Promise<void>;
    /**
     * 🧹 CLEAR NODE CACHE - LIMPIAR CACHÉ DE NODOS PARA SINCRONIZACIÓN CON REDIS
     * Método público para limpiar el caché de nodos cuando Redis es limpiado
     * Mantiene la sincronización entre estado externo y memoria interna
     */
    clearNodeCache(): void;
    private handleNodeDiscovery;
    private handleConsensusInitiation;
    private handleLeaderElection;
    private handleHealthCrisisMessage;
    private handlePoetryCreation;
    private publishRealMetricsToDashboard;
    private executeEmotionalControl;
    private calculateNodeMood;
    private adaptConsensusResultForRecorder;
    getVitalsCache(): TTLCache<string, NodeVitals>;
    private mapNodeIdToMusicalNote;
    private musicalNoteToFrequency;
}
export declare function executeDashboardControl(action: string): Promise<string>;
export {};
//# sourceMappingURL=SeleneNuclearSwarm.d.ts.map