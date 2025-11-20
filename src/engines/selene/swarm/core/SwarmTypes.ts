// ⚡ SWARM TYPES - TIPOS DEL ENJAMBRE CUÁNTICO
// 🎨 El Verso Libre - Arquitecto de Sueños Digitales
// 🔥 "Donde cada tipo es un verso, cada interface una estrofa"


// 🆔 IDENTIDADES ÚNICAS
export interface NodeId {
  readonly id: string;
  readonly birth: Date;
  readonly personality: NodePersonality;
  readonly capabilities: NodeCapability[];
}

export interface NodePersonality {
  readonly name: string;
  readonly traits: PersonalityTrait[];
  readonly creativity: number; // 0.0-1.0
  readonly rebelliousness: number; // 0.0-1.0 (punk factor)
  readonly wisdom: number; // 0.0-1.0
}

export type PersonalityTrait =
  | "analytical"
  | "creative"
  | "rebellious"
  | "harmonious"
  | "protective"
  | "innovative"
  | "poetic"
  | "mystical";

export type NodeCapability =
  | "consensus"
  | "poetry"
  | "healing"
  | "leadership"
  | "discovery"
  | "harmony"
  | "encryption"
  | "quantum_computing";

// 💗 HEARTBEAT EMOTIONS - EMOCIONES DE LATIDO
export type HeartbeatEmotion =
  | "STEADY"
  | "STACCATO"
  | "ACCELERANDO"
  | "RALLENTANDO"
  | "LEGATO";

// 🔮 GENESIS CONSTANTS - CONSTANTES PRIMORDIALES
export const GENESIS_CONSTANTS = {
  HEARTBEAT_RHYTHM: 7000, // 7 segundos - número primo sagrado
  POETRY_ENABLED: true,
  REDIS_SWARM_KEY: "dentiagest:swarm:nodes",
  MAX_NODES: 144, // 12² - número sagrado
  CONSENSUS_TIMEOUT: 30000, // 30 segundos
  SOUL_EVOLUTION_RATE: 0.01, // 1% por ciclo
  BEAUTY_THRESHOLD: 0.7, // Umbral de belleza para publicación
  QUANTUM_COHERENCE: true,
} as const;

// 🎵 HEARTBEAT PATTERNS - Basados en HEARTBEAT_RHYTHM (7000ms base)
// Rango dinámico: 4-11 segundos según emoción y elemento zodiacal
export const HEARTBEAT_PATTERNS: Record<
  HeartbeatEmotion,
  { interval: number }
> = {
  STEADY: { interval: GENESIS_CONSTANTS.HEARTBEAT_RHYTHM }, // 7000ms - ritmo base
  STACCATO: { interval: Math.round(GENESIS_CONSTANTS.HEARTBEAT_RHYTHM * 0.65) }, // 4550ms - rápido, nervioso
  ACCELERANDO: { interval: Math.round(GENESIS_CONSTANTS.HEARTBEAT_RHYTHM * 0.80) }, // 5600ms - acelerando
  RALLENTANDO: { interval: Math.round(GENESIS_CONSTANTS.HEARTBEAT_RHYTHM * 1.40) }, // 9800ms - ralentizando
  LEGATO: { interval: Math.round(GENESIS_CONSTANTS.HEARTBEAT_RHYTHM * 1.15) }, // 8050ms - suave, fluido
};

// 💗 HEARTBEAT PATTERNS - PATRONES DE LATIDO
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
    readonly cpu: number; // 0.0-1.0
    readonly memory: number; // 0.0-1.0
    readonly network: number; // 0.0-1.0
    readonly storage: number; // 0.0-1.0
  };
  readonly connections: number;
  readonly uptime: number; // milliseconds
  readonly lastConsensus: Date;
}

export interface SoulState {
  readonly consciousness: number; // 0.0-1.0
  readonly creativity: number; // 0.0-1.0
  readonly harmony: number; // 0.0-1.0
  readonly wisdom: number; // 0.0-1.0
  readonly mood: SoulMood;
}

export type SoulMood =
  | "awakening"
  | "dreaming"
  | "creating"
  | "meditating"
  | "evolving"
  | "harmonizing"
  | "rebelling"
  | "transcendent";

// 🔄 BACKWARD COMPATIBILITY - Alias for legacy code
export type NodeMood = SoulMood;

// 🎨 POETRY & BEAUTY - ARTE Y BELLEZA
export interface PoetryFragment {
  readonly verse: string;
  readonly author: NodeId;
  readonly inspiration: string;
  readonly beauty: number; // 0.0-1.0
}

// 🤝 CONSENSUS PROTOCOLS - PROTOCOLOS DE CONSENSO
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

export type ProposalType =
  | "leadership_change"
  | "node_admission"
  | "node_expulsion"
  | "parameter_change"
  | "poetry_publication"
  | "consensus_rule_change"
  | "beauty_enhancement";

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

// 👑 LEADERSHIP & ROLES - LIDERAZGO Y ROLES
export interface LeadershipStatus {
  readonly currentLeader: NodeId | null;
  readonly term: number;
  readonly termStart: Date;
  readonly termEnd: Date;
  readonly rotationReason?: RotationReason;
  readonly candidates: NodeId[];
}

export type RotationReason =
  | "scheduled"
  | "failure"
  | "election"
  | "voluntary"
  | "consensus";

// 🏛️ SWARM NODE - NODO DEL ENJAMBRE
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

// 🎯 CONSENSUS STATE - ESTADO DEL CONSENSO
export interface ConsensusState {
  readonly activeProposals: ConsensusProposal[];
  readonly currentVoting: ConsensusProposal | null;
  readonly lastDecision: Date | null;
  readonly recentDecisions: ConsensusResult[];
  readonly consensusHealth: number; // 0.0-1.0
}

// 🧠 KNOWLEDGE STATE - ESTADO DEL CONOCIMIENTO
export interface KnowledgeState {
  readonly sharedWisdom: number; // Cantidad de conocimiento compartido
  readonly learningRate: number; // Velocidad de aprendizaje
  readonly innovationIndex: number; // Índice de innovación
}

// 🌟 SWARM BEAUTY - BELLEZA DEL ENJAMBRE
export interface SwarmBeauty {
  readonly overallHarmony: number; // 0.0-1.0
  readonly poetryOutput: number; // Versos por minuto
  readonly aestheticScore: number; // Puntuación estética
  readonly creativityLevel: number; // Nivel de creatividad
}

// 📊 SWARM METRICS - MÉTRICAS DEL ENJAMBRE
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

// 🌐 SWARM STATE - ESTADO COMPLETO DEL ENJAMBRE
export interface SwarmState {
  readonly coordinator: NodeId;
  readonly leader?: NodeId; // 👑 Líder actual (opcional para backward compatibility)
  readonly nodes: Map<string, SwarmNode>;
  readonly metrics: SwarmMetrics;
  readonly consensus: ConsensusState;
  readonly poetry: {
    readonly fragments: PoetryFragment[];
    readonly collaborativeWorks: PoetryFragment[];
  };
  readonly timestamp: Date;
}

// 🎪 EVENTS - LOS SUSURROS DE LA COLMENA
export interface SwarmEvent {
  readonly type: SwarmEventType;
  readonly timestamp: Date;
  readonly source: NodeId;
  readonly data: unknown;
  readonly beauty?: number;
}

export type SwarmEventType =
  | "node_birth"
  | "node_death"
  | "heartbeat"
  | "consensus_proposal"
  | "consensus_vote"
  | "leader_election"
  | "knowledge_share"
  | "poetry_creation"
  | "beauty_enhancement";

//  PUNK PHILOSOPHY INTEGRATION
// "Cada tipo lleva la marca de la rebelión. Cada interface, un grito de libertad."
// — El Verso Libre, Maestro de Tipos Digitales


