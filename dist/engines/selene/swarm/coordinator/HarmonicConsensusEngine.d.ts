import { SystemVitals } from "../core/SystemVitals.js";
import { VeritasInterface } from "../veritas/VeritasInterface.js";
import { TTLCache } from "../../shared/TTLCache.js";
import { NodeVitals } from "../core/SwarmTypes.js";
import { EmergenceGenerator } from "./EmergenceGenerator.js";
import { MusicalNote } from "./MusicalTypes.js";
import { UnifiedCommunicationProtocol } from "./UnifiedCommunicationProtocol.js";
export interface ConsensusResult {
    leader_node_id: string;
    is_leader: boolean;
    total_nodes: number;
    consensus_achieved: boolean;
    timestamp: number;
    dominant_note: MusicalNote;
    harmonic_score: number;
    chord_stability: number;
    musical_rationale: string;
    frequency_hz: number;
    quorum_achieved: boolean;
    quorum_size: number;
    votes_received: number;
    read_only_mode: boolean;
}
export declare class HarmonicConsensusEngine {
    private nodeId;
    private knownNodes;
    private systemVitals;
    private veritas;
    private vitalsCache;
    private emergenceGenerator;
    private communicationProtocol;
    private pendingVotes;
    private redis;
    private cachedResult;
    private lastCalculation;
    private CACHE_TTL;
    private static callCount;
    constructor(nodeId?: string, systemVitals?: SystemVitals, veritas?: VeritasInterface, vitalsCache?: TTLCache<string, NodeVitals>, emergenceGenerator?: EmergenceGenerator, communicationProtocol?: UnifiedCommunicationProtocol, // 🔥 PHASE 4: Real inter-node communication
    redis?: any);
    private createDefaultVeritas;
    /**
     * 🌐 PHASE 4: Setup handler for real vote responses from other nodes
     */
    private setupVoteResponseHandler;
    /**
     * 🌐 PHASE 4: Wait for vote responses from other nodes with timeout
     */
    private waitForVoteResponses;
    /**
     * 🌐 PHASE 4: Handle incoming vote responses from other nodes
     */
    private handleVoteResponse;
    /**
     * 🎵 SELECT LEADER FROM SHARED METRICS - DETERMINISTIC MUSICAL CONSENSUS
     * All nodes vote with the SAME information = TRUE CONSENSUS
     */
    private selectLeaderFromSharedMetrics;
    /**
     * 🌐 PHASE 4: Handle incoming vote REQUEST from another node (they're asking us to vote)
     * 🎵 MUSICAL CONSENSUS: All nodes vote with SHARED metrics (not individual calculations)
     */
    private handleVoteRequest;
    /**
     * Update known nodes in the swarm
     */
    updateKnownNodes(_nodeIds: string[]): void;
    /**
     * 🎵 MUSICAL CONSENSUS WITH QUORUM - Determine leader using 7-note harmony + Directiva V412
     * 🔥 CLAUDE 4.5 OPTIMIZATION: Cache results to prevent CPU burn
     * 🛡️ QUORUM PROTECTION: Majority voting with Veritas cryptographic verification
     */
    determineLeader(): Promise<ConsensusResult>;
    /**
     * 🛡️ DIRECTIVA V412 - Perform quorum voting with Veritas cryptographic verification
     * 🔥 PHASE 4: Real inter-node communication when available, simulation as fallback
     * Requires >50% majority for valid consensus
     */
    private performQuorumVoting;
    /**
     * 🔐 Sign a vote using Veritas cryptographic verification
     * 🎯 PUNK FIX: Deterministic signatures based on vote content
     */
    private signVote;
    /**
     * 🔐 Verify a vote signature using Veritas
     * 🎯 PUNK FIX: Verify deterministic signatures
     */
    private verifyVote;
    /**
     * 🎯 Validate quorum-selected leader candidate with real health metrics
     */
    private validateLeaderWithRealHealth;
    /**
     * 🎵 Select the dominant musical note based on swarm characteristics
     */
    private selectMusicalNote;
    /**
     * 🎯 REAL HEALTH-BASED LEADER SELECTION - No simulations, only real metrics
     * 🎨 INTEGRATION: Emergence beauty influences consensus decisions
     */
    private selectLeaderByRealHealth;
    /**
     * � CALCULATE EMERGENT BEAUTY FACTOR - Real collective beauty influence
     * Uses EmergenceGenerator to quantify node's contribution to swarm harmony
     */
    private calculateEmergentBeautyFactor;
    /**
     * 🏥 Calculate real node health based on actual system metrics
     * 🔥 AXIOMA ANTI-SIMULACIÓN: NO fallback inventado, solo datos REALES
     */
    private calculateRealNodeHealth;
    /**
     * 🎼 Calculate harmonic score based on REAL SYSTEM METRICS - No simulations
     */
    private calculateHarmonicScore;
    /**
     * 🎵 Calculate chord stability based on REAL SYSTEM METRICS - No simulations
     */
    private calculateChordStability;
    /**
     * 🎼 Generate musical rationale for consensus decision
     */
    private generateMusicalRationale;
    /**
     * 🎵 Create musical consensus result with QUORUM support
     */
    private createMusicalResult;
    /**
     * 🎼 MUSICAL DEMOCRACY DEMONSTRATION
     */
    demonstrate_musical_democracy(_sample_proposal: any): Promise<void>;
    /**
     * 🎼 Decision making with musical harmony
     */
    make_decision(_proposal: any): Promise<any>;
}
//# sourceMappingURL=HarmonicConsensusEngine.d.ts.map