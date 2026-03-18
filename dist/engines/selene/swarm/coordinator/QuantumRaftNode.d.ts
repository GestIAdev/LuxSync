export interface RaftNodeState {
    nodeId: string;
    term: number;
    votedFor?: string;
    state: 'follower' | 'candidate' | 'leader';
    commitIndex: number;
    lastApplied: number;
}
export interface RaftLogEntry {
    term: number;
    index: number;
    command: any;
    timestamp: number;
}
export interface QuantumDecision {
    id: string;
    proposal: SwarmProposal;
    votes: DecisionVote[];
    result: DecisionResult;
    timestamp: number;
}
export interface DecisionVote {
    voterId: string;
    voter?: string | {
        id: string;
        name?: string;
    };
    decision: 'approve' | 'reject' | 'abstain';
    choice?: string;
    confidence: number;
    strength?: number;
    reasoning: string;
    alternativeIdeas?: string[];
    timestamp?: number;
    verified?: boolean;
}
export interface SwarmProposal {
    id: string;
    proposerId: string;
    action: string;
    parameters: any;
    priority: number;
    timestamp: number;
}
export interface DecisionResult {
    status: DecisionStatus;
    approved: boolean;
    consensusLevel: number;
    timestamp: number;
    decision?: boolean;
    approvalPercentage?: number;
    celebrationPoem?: string;
    overallTrust?: number;
}
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'implemented';
export interface TrustMetrics {
    reliability: number;
    response_time: number;
    vote_accuracy: number;
    consistency: number;
    overallTrust?: number;
}
export declare class QuantumRaftNode {
    private nodeId;
    private state;
    private log;
    constructor(nodeId: string);
    /**
     * Get node state
     */
    getState(): RaftNodeState;
    /**
     * Append log entry
     */
    appendEntry(entry: RaftLogEntry): void;
    /**
     * Get last log index
     */
    getLastLogIndex(): number;
    /**
     * Become leader
     */
    becomeLeader(): void;
    /**
     * Become follower
     */
    becomeFollower(): void;
    /**
     * Vote for candidate
     */
    voteFor(candidateId: string): boolean;
}
//# sourceMappingURL=QuantumRaftNode.d.ts.map