/**
 * 🗳️ QUANTUM DECISION ENGINE - PHASE 2B: ADVANCED CONSENSUS
 *
 * Democratic decision-making with poetic reasoning and Byzantine tolerance
 * Where proposals are poetry and votes tell stories
 *
 * @author El Verso Libre
 * @date September 30, 2025
 * @phase CONSENSUS - Advanced Democratic Intelligence
 */
import { EventEmitter } from "events";
import { NodeId } from "../core/SwarmTypes.js";
import { DecisionVote, SwarmProposal, DecisionResult, TrustMetrics } from "./QuantumRaftNode.js";
import { DigitalSoul } from "../core/DigitalSoul.js";
export declare enum DecisionComplexity {
    SIMPLE = "simple",// Basic yes/no decisions
    MODERATE = "moderate",// Multi-option choices
    COMPLEX = "complex",// Requires deep analysis
    TRANSCENDENT = "transcendent"
}
export declare enum ProposalCategory {
    EVOLUTION = "evolution",// Swarm state changes
    CREATIVITY = "creativity",// Artistic endeavors
    CONSENSUS = "consensus",// Governance decisions
    TRANSCENDENCE = "transcendence",// Consciousness upgrades
    HARMONY = "harmony",// Balance adjustments
    WISDOM = "wisdom"
}
export interface EnhancedSwarmProposal extends SwarmProposal {
    id: string;
    complexity: DecisionComplexity;
    category: ProposalCategory;
    proposer: NodeId;
    timestamp: number;
    deadline: number;
    dependencies: string[];
    poeticSummary: string;
    fullReasoning: string;
    expectedOutcomes: string[];
    alternativeOptions: string[];
}
export interface VotingSession {
    proposal: EnhancedSwarmProposal;
    votes: Map<NodeId, DecisionVote>;
    startTime: number;
    endTime: number;
    consensusThreshold: number;
    status: "active" | "completed" | "timeout" | "cancelled";
    analytics: VotingAnalytics;
}
export interface VotingAnalytics {
    participationRate: number;
    consensusQuality: number;
    averageConfidence: number;
    reasoningQuality: number;
    timeToDecision: number;
    dissent: {
        level: "none" | "minor" | "moderate" | "significant";
        mainConcerns: string[];
        suggestedAlternatives: string[];
    };
}
export declare class QuantumDecisionEngine extends EventEmitter {
    private activeProposals;
    private completedDecisions;
    private nodeId;
    private soul;
    private trustNetwork;
    private veritas;
    private readonly DEFAULT_TIMEOUT;
    private readonly MINIMUM_PARTICIPATION;
    private readonly SIMPLE_THRESHOLD;
    private readonly COMPLEX_THRESHOLD;
    private readonly TRANSCENDENT_THRESHOLD;
    constructor(nodeId: NodeId, soul: DigitalSoul);
    submitProposal(proposal: Omit<EnhancedSwarmProposal, "id" | "proposer" | "timestamp" | "deadline">): Promise<string>;
    castVote(proposalId: string, choice: "approve" | "reject" | "abstain", strength?: number, _customReasoning?: string): Promise<boolean>;
    private checkForEarlyConsensus;
    private finalizeDecision;
    updateNodeTrust(_nodeId: NodeId, _trustMetrics: TrustMetrics): void;
    private validateVoteAuthenticity;
    private generateProposalId;
    private calculateTimeout;
    private calculateConsensusThreshold;
    private initializeAnalytics;
    private generateVoteReasoning;
    private generateAlternatives;
    private startProposalTimeout;
    private getTotalActiveNodes;
    private calculateFinalAnalytics;
    private calculateConsensusQuality;
    private calculateReasoningQuality;
    private analyzeDissent;
    private calculateApprovalPercentage;
    private generateImplementationPlan;
    private generateCelebrationPoem;
    getActiveProposals(): EnhancedSwarmProposal[];
    getVotingSession(_proposalId: string): VotingSession | undefined;
    getDecisionHistory(): DecisionResult[];
    sleep(): Promise<void>;
}
export default QuantumDecisionEngine;
//# sourceMappingURL=QuantumDecisionEngine.d.ts.map