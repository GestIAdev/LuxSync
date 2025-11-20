// 🔗 QUANTUM RAFT NODE - Distributed consensus node (stub for LuxSync)
// Simplified version - just enough for type compatibility

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

// Additional interfaces from QuantumDecisionEngine
export interface QuantumDecision {
  id: string;
  proposal: SwarmProposal;
  votes: DecisionVote[];
  result: DecisionResult;
  timestamp: number;
}

export interface DecisionVote {
  voterId: string;
  voter?: string | { id: string; name?: string }; // Alias for voterId (can be object)
  decision: 'approve' | 'reject' | 'abstain';
  choice?: string; // Alternative name
  confidence: number;
  strength?: number; // Alias for confidence
  reasoning: string;
  alternativeIdeas?: string[]; // Additional field
  timestamp?: number; // When vote was cast
  verified?: boolean; // Is vote verified
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

export class QuantumRaftNode {
  private nodeId: string;
  private state: RaftNodeState;
  private log: RaftLogEntry[] = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.state = {
      nodeId,
      term: 0,
      state: 'follower',
      commitIndex: 0,
      lastApplied: 0,
    };
  }

  /**
   * Get node state
   */
  getState(): RaftNodeState {
    return { ...this.state };
  }

  /**
   * Append log entry
   */
  appendEntry(entry: RaftLogEntry): void {
    this.log.push(entry);
  }

  /**
   * Get last log index
   */
  getLastLogIndex(): number {
    return this.log.length > 0 ? this.log[this.log.length - 1].index : 0;
  }

  /**
   * Become leader
   */
  becomeLeader(): void {
    this.state.state = 'leader';
    this.state.term++;
  }

  /**
   * Become follower
   */
  becomeFollower(): void {
    this.state.state = 'follower';
  }

  /**
   * Vote for candidate
   */
  voteFor(candidateId: string): boolean {
    if (this.state.votedFor === undefined) {
      this.state.votedFor = candidateId;
      return true;
    }
    return this.state.votedFor === candidateId;
  }
}
