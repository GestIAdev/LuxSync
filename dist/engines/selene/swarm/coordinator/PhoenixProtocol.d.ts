import { HealthOracle } from "./HealthOracle.js";
import { HarmonicConsensusEngine } from "./HarmonicConsensusEngine.js";
import { SystemVitals } from "../core/SystemVitals.js";
import { QuantumSwarmCoordinator } from "./QuantumSwarmCoordinator.js";
export interface PhoenixSnapshot {
    snapshot_id: string;
    timestamp: number;
    swarm_state: SwarmState;
    consensus_state: ConsensusState;
    poetry_state: PoetryState;
    health_state: HealthState;
    integrity_hash: string;
    recovery_priority: number;
}
export interface SwarmState {
    active_nodes: NodeSnapshot[];
    network_topology: NetworkTopology;
    message_queue: QueuedMessage[];
    shared_memory: SharedMemoryState;
    personality_states: PersonalityState[];
}
export interface NodeSnapshot {
    node_id: string;
    node_type: string;
    last_known_state: any;
    memory_snapshot: MemoryState;
    connection_state: ConnectionState;
    recovery_data: RecoveryMetadata;
}
export interface ConsensusState {
    active_proposals: any[];
    voting_history: any[];
    decision_tree: DecisionTreeState;
    byzantine_guardian_state: any;
    musical_consensus_state: any;
}
export interface PoetryState {
    quantum_poetry_engine_state: any;
    veritas_validation_cache: any;
    creative_domain_states: any;
    beauty_truth_synthesis: any;
}
export interface HealthState {
    last_health_metrics: any;
    diagnostic_history: any[];
    predictive_models: any;
    maintenance_schedules: any[];
}
export interface RecoveryOperation {
    operation_id: string;
    recovery_type: "node_restoration" | "state_rollback" | "full_resurrection" | "selective_recovery";
    target_snapshot: string;
    affected_components: string[];
    estimated_recovery_time: number;
    recovery_status: "initiated" | "in_progress" | "validating" | "completed" | "failed";
    recovery_start_time: number;
    recovery_progress: number;
}
export interface ResurrectionPlan {
    plan_id: string;
    failure_scenario: FailureScenario;
    recovery_steps: RecoveryStep[];
    resource_requirements: ResourceRequirement[];
    estimated_total_time: number;
    success_probability: number;
}
export interface FailureScenario {
    scenario_id: string;
    failure_type: "node_crash" | "network_partition" | "consensus_failure" | "data_corruption" | "byzantine_attack" | "cascading_failure";
    severity: "minor" | "moderate" | "severe" | "catastrophic";
    affected_systems: string[];
    detection_time: number;
}
export interface RecoveryStep {
    step_id: string;
    step_order: number;
    description: string;
    step_type: "validation" | "restoration" | "verification" | "synchronization";
    dependencies: string[];
    estimated_duration: number;
    critical_path: boolean;
}
export interface ResourceRequirement {
    resource_type: "cpu" | "memory" | "network" | "storage";
    required_amount: number;
    duration: number;
    availability_check: boolean;
}
export declare class PhoenixProtocol {
    private snapshot_interval;
    private max_snapshots;
    private snapshots;
    private active_recovery;
    private continuous_backup;
    private backup_timer;
    private nodeId;
    private snapshotsDir;
    private health_oracle;
    private consensus_engine;
    private poetry_engine;
    private system_vitals;
    private swarm_coordinator?;
    constructor(nodeId?: string, healthOracle?: HealthOracle, consensusEngine?: HarmonicConsensusEngine, poetryEngine?: any, systemVitals?: SystemVitals, swarmCoordinator?: QuantumSwarmCoordinator);
    /**
     * 📁 Initialize snapshots directory and load existing snapshots
     */
    private initializeSnapshotsDirectory;
    /**
     * 📥 Load existing snapshots from disk
     */
    private loadExistingSnapshots;
    start_continuous_backup(): Promise<void>;
    stop_backup(): Promise<void>;
    /**
     * 🚨 PREVENT HEAP ANCHORING - Clean up in-memory snapshots to allow heap expansion
     */
    private preventHeapAnchoring;
    /**
     * 🧹 Clean up old snapshots beyond retention limit - EVENT LOOP OPTIMIZED
     */
    private cleanupOldSnapshots;
    create_snapshot(_trigger: string): Promise<PhoenixSnapshot>;
    /**
     * 💾 Save snapshot to disk - EVENT LOOP OPTIMIZED
     */
    private saveSnapshotToDisk;
    /**
     * ⚡ Async JSON stringification to prevent event loop blocking
     */
    private asyncJsonStringify;
    /**
     * 🗑️ Delete snapshot from disk
     */
    private deleteSnapshotFromDisk;
    private capture_swarm_state;
    private capture_node_states;
    private capture_consensus_state;
    private capture_poetry_state;
    private capture_health_state;
    initiate_resurrection(failure_scenario: FailureScenario): Promise<ResurrectionPlan>;
    private create_resurrection_plan;
    execute_resurrection(plan: ResurrectionPlan): Promise<boolean>;
    private execute_recovery_step;
    private validate_resurrection;
    private determine_recovery_type;
    private select_best_snapshot;
    private calculate_success_probability;
    private calculate_resource_requirements;
    private calculate_recovery_priority;
    private calculate_integrity_hash;
    private generate_hash;
    private capture_network_topology;
    private capture_message_queue;
    private capture_shared_memory;
    private capture_personality_states;
    get_protocol_status(): {
        total_snapshots: number;
        recovery_plans_ready: number;
        resurrection_ready: boolean;
        node_id: string;
        snapshots_directory: string;
        last_snapshot_time: number;
        backup_active: boolean;
        available_recovery_types: string[];
    };
    get_snapshot_count(): number;
    get_latest_snapshot(): PhoenixSnapshot | null;
    get_recovery_status(): RecoveryOperation | null;
    private fallback_node_states;
    private validateSystemState;
    private restoreFromSnapshot;
    private verifyRestorationIntegrity;
    private synchronizeWithSwarm;
    private extract_health_metrics;
    private get_real_consensus_state;
    private get_real_poetry_state;
    private calculate_node_health;
    private calculate_node_load;
    private calculate_node_connections;
    private generate_checkpoint_hash;
    private fallback_consensus_state;
    private fallback_poetry_state;
    private fallback_health_state;
}
interface NetworkTopology {
    node_count: number;
    connection_matrix: string;
    routing_table: string;
}
interface QueuedMessage {
    message_id: string;
    sender: string;
    recipient: string;
    content: any;
    timestamp: number;
}
interface SharedMemoryState {
    global_state: any;
    cache_size: number;
}
interface PersonalityState {
    personality_id: string;
    current_state: string;
    memory_context: any;
    decision_history: any[];
}
interface MemoryState {
    heap_usage: number;
    cache_size: number;
    active_connections: number;
}
interface ConnectionState {
    peer_connections: number;
    network_latency: number;
    message_queue_size: number;
}
interface RecoveryMetadata {
    last_backup: number;
    checkpoint_hash: string;
    recovery_complexity: number;
}
interface DecisionTreeState {
    current_level: number;
    branch_states: string[];
}
export {};
//# sourceMappingURL=PhoenixProtocol.d.ts.map