/**
 * 🛡️ BYZANTINE GUARDIAN - PHASE 2B: FAULT TOLERANCE
 *
 * Protege el swarm contra nodos maliciosos o comprometidos
 * Where trust is earned and betrayal is remembered
 *
 * @author El Verdugo Digital
 * @date September 30, 2025
 * @phase CONSENSUS - Byzantine Resistance Engine
 */
import { EventEmitter } from "events";
import { NodeId } from "../core/SwarmTypes.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
export declare enum ThreatLevel {
    UNKNOWN = "unknown",// 🔍 New node, no history
    TRUSTED = "trusted",// ✅ Proven reliable
    SUSPICIOUS = "suspicious",// ⚠️ Some concerning behavior
    COMPROMISED = "compromised",// 🚨 Clearly malicious
    QUARANTINED = "quarantined"
}
export declare enum ByzantineAttackType {
    VOTE_MANIPULATION = "vote_manipulation",// Inconsistent voting
    TIMING_ATTACK = "timing_attack",// Strategic delays
    SPLIT_BRAIN = "split_brain",// Network partition exploit
    SPAM_PROPOSALS = "spam_proposals",// Flooding with requests
    IDENTITY_THEFT = "identity_theft",// Impersonating others
    CONSENSUS_DISRUPTION = "consensus_disruption"
}
export interface DetailedTrustMetrics {
    nodeId: NodeId;
    overallTrust: number;
    reliabilityScore: number;
    participationScore: number;
    reasoningQuality: number;
    consensusContribution: number;
    byzantineRisk: number;
    lastUpdate: number;
    history: {
        votesParticipated: number;
        agreementRate: number;
        responseTime: number;
        reasoningLength: number;
        flipFlops: number;
        suspiciousPatterns: ByzantineAttackType[];
    };
}
export interface ByzantineAlert {
    alertId: string;
    nodeId: NodeId;
    threatLevel: ThreatLevel;
    attackType: ByzantineAttackType;
    evidence: string[];
    confidence: number;
    detectionTime: number;
    suggestedAction: "monitor" | "limit" | "quarantine" | "ban";
}
export declare class ByzantineGuardian extends EventEmitter {
    private nodeId;
    private soul;
    private trustNetwork;
    private activeAlerts;
    private behaviorHistory;
    private maxBehaviorHistory;
    private readonly TRUST_DECAY_RATE;
    private readonly MIN_TRUST_THRESHOLD;
    private readonly MAX_BYZANTINE_NODES;
    private readonly CONSENSUS_DEVIATION_LIMIT;
    constructor(nodeId: NodeId, soul: DigitalSoul);
    evaluateNodeTrust(nodeId: NodeId, _events: any[]): Promise<DetailedTrustMetrics>;
    private detectByzantinePatterns;
    private generateByzantineAlert;
    quarantineNode(nodeId: NodeId, reason: string): void;
    isNodeQuarantined(_nodeId: NodeId): boolean;
    getVotingWeight(nodeId: NodeId): number;
    private initializeTrustMetrics;
    private updateTrustFromEvents;
    private updateFromVoteEvent;
    private updateFromConsensusEvent;
    private updateFromTimingEvent;
    private calculateCompositeTrust;
    private calculateThreatConfidence;
    private startTrustDecayLoop;
    private decayAllTrustScores;
    getTrustMetrics(_nodeId: NodeId): DetailedTrustMetrics | undefined;
    getAllTrustMetrics(): DetailedTrustMetrics[];
    getActiveAlerts(): ByzantineAlert[];
    getSwarmHealthReport(): {
        totalNodes: number;
        trustedNodes: number;
        suspiciousNodes: number;
        quarantinedNodes: number;
        averageTrust: number;
        byzantineResistance: number;
    };
    sleep(): Promise<void>;
}
export default ByzantineGuardian;
//# sourceMappingURL=ByzantineGuardian.d.ts.map