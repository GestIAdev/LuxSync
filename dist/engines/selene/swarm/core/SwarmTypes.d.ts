export interface NodeId {
    readonly id: string;
    readonly birth: Date;
    readonly personality: NodePersonality;
    readonly capabilities: NodeCapability[];
}
export interface NodePersonality {
    readonly name: string;
    readonly traits: PersonalityTrait[];
    readonly creativity: number;
    readonly rebelliousness: number;
    readonly wisdom: number;
}
export type PersonalityTrait = "analytical" | "creative" | "rebellious" | "harmonious" | "protective" | "innovative" | "poetic" | "mystical";
export type NodeCapability = "consensus" | "poetry" | "healing" | "leadership" | "discovery" | "harmony" | "encryption" | "quantum_computing";
export type HeartbeatEmotion = "STEADY" | "STACCATO" | "ACCELERANDO" | "RALLENTANDO" | "LEGATO";
export declare const GENESIS_CONSTANTS: {
    readonly HEARTBEAT_RHYTHM: 7000;
    readonly POETRY_ENABLED: true;
    readonly REDIS_SWARM_KEY: "dentiagest:swarm:nodes";
    readonly MAX_NODES: 144;
    readonly CONSENSUS_TIMEOUT: 30000;
    readonly SOUL_EVOLUTION_RATE: 0.01;
    readonly BEAUTY_THRESHOLD: 0.7;
    readonly QUANTUM_COHERENCE: true;
};
export declare const HEARTBEAT_PATTERNS: Record<HeartbeatEmotion, {
    interval: number;
}>;
export interface HeartbeatPattern {
    readonly nodeId: NodeId;
    readonly timestamp: Date;
    readonly sequence: number;
    readonly vitals: NodeVitals;
    readonly soulState: SoulState;
    readonly poetry?: PoetryFragment;
}
export interface NodeVitals {
    readonly health: "optimal" | "healthy" | "warning" | "critical" | "failing";
    readonly load: {
        readonly cpu: number;
        readonly memory: number;
        readonly network: number;
        readonly storage: number;
    };
    readonly connections: number;
    readonly uptime: number;
    readonly lastConsensus: Date;
}
export interface SoulState {
    readonly consciousness: number;
    readonly creativity: number;
    readonly harmony: number;
    readonly wisdom: number;
    readonly mood: SoulMood;
}
export type SoulMood = "awakening" | "dreaming" | "creating" | "meditating" | "evolving" | "harmonizing" | "rebelling" | "transcendent";
export type NodeMood = SoulMood;
export interface PoetryFragment {
    readonly verse: string;
    readonly author: NodeId;
    readonly inspiration: string;
    readonly beauty: number;
}
export interface ConsensusProposal {
    readonly id: string;
    readonly proposer: NodeId;
    readonly timestamp: Date;
    readonly type: ProposalType;
    readonly data: unknown;
    readonly requiredVotes: number;
    readonly currentVotes: VoteRecord[];
    readonly deadline: Date;
}
export type ProposalType = "leadership_change" | "node_admission" | "node_expulsion" | "parameter_change" | "poetry_publication" | "consensus_rule_change" | "beauty_enhancement";
export interface VoteRecord {
    readonly voter: NodeId;
    readonly decision: VoteDecision;
    readonly timestamp: Date;
    readonly reasoning?: string;
}
export type VoteDecision = "approve" | "reject" | "abstain";
export interface ConsensusResult {
    readonly proposal: ConsensusProposal;
    readonly outcome: "approved" | "rejected" | "expired";
    readonly finalVotes: VoteRecord[];
    readonly executedAt?: Date;
}
export interface LeadershipStatus {
    readonly currentLeader: NodeId | null;
    readonly term: number;
    readonly termStart: Date;
    readonly termEnd: Date;
    readonly rotationReason?: RotationReason;
    readonly candidates: NodeId[];
}
export type RotationReason = "scheduled" | "failure" | "election" | "voluntary" | "consensus";
export interface SwarmNode {
    readonly nodeId: NodeId;
    readonly vitals: NodeVitals;
    readonly soul: SoulState;
    readonly lastSeen: Date;
    readonly role: NodeRole;
    readonly connections: Set<string>;
    readonly status: "active" | "dormant" | "disconnected";
}
export type NodeRole = "leader" | "follower" | "candidate" | "observer";
export interface ConsensusState {
    readonly activeProposals: ConsensusProposal[];
    readonly currentVoting: ConsensusProposal | null;
    readonly lastDecision: Date | null;
    readonly recentDecisions: ConsensusResult[];
    readonly consensusHealth: number;
}
export interface KnowledgeState {
    readonly sharedWisdom: number;
    readonly learningRate: number;
    readonly innovationIndex: number;
}
export interface SwarmBeauty {
    readonly overallHarmony: number;
    readonly poetryOutput: number;
    readonly aestheticScore: number;
    readonly creativityLevel: number;
}
export interface SwarmMetrics {
    readonly totalNodes: number;
    readonly activeNodes: number;
    readonly avgHealth: number;
    readonly avgLoad: {
        readonly cpu: number;
        readonly memory: number;
        readonly network: number;
        readonly storage: number;
    };
    readonly consensusStrength: number;
    readonly collectiveConsciousness: number;
    readonly harmonyIndex: number;
}
export interface SwarmState {
    readonly coordinator: NodeId;
    readonly leader?: NodeId;
    readonly nodes: Map<string, SwarmNode>;
    readonly metrics: SwarmMetrics;
    readonly consensus: ConsensusState;
    readonly poetry: {
        readonly fragments: PoetryFragment[];
        readonly collaborativeWorks: PoetryFragment[];
    };
    readonly timestamp: Date;
}
export interface SwarmEvent {
    readonly type: SwarmEventType;
    readonly timestamp: Date;
    readonly source: NodeId;
    readonly data: unknown;
    readonly beauty?: number;
}
export type SwarmEventType = "node_birth" | "node_death" | "heartbeat" | "consensus_proposal" | "consensus_vote" | "leader_election" | "knowledge_share" | "poetry_creation" | "beauty_enhancement";
//# sourceMappingURL=SwarmTypes.d.ts.map