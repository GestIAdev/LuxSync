import { CircuitBreaker } from "../core/CircuitBreaker.js";
export interface ThreatSignature {
    signature_id: string;
    threat_pattern: string;
    severity_level: "low" | "medium" | "high" | "critical";
    detection_confidence: number;
    behavioral_markers: BehavioralMarker[];
    mutation_resistance: number;
    first_observed: number;
    last_observed: number;
}
export interface BehavioralMarker {
    marker_type: "network_anomaly" | "consensus_manipulation" | "resource_abuse" | "data_corruption" | "identity_spoofing";
    pattern_description: string;
    detection_threshold: number;
    false_positive_rate: number;
    adaptive_weight: number;
}
export interface ImmuneResponse {
    response_id: string;
    triggered_by: string;
    response_type: "isolation" | "neutralization" | "adaptation" | "observation";
    threat_target: string;
    response_intensity: number;
    success_probability: number;
    side_effects: SideEffect[];
    execution_time: number;
}
export interface SideEffect {
    effect_type: "performance_degradation" | "connectivity_loss" | "false_positive" | "resource_consumption";
    severity: number;
    duration: number;
    mitigation_available: boolean;
}
export interface ImmuneMemory {
    memory_id: string;
    threat_signature: ThreatSignature;
    successful_responses: ImmuneResponse[];
    failed_responses: ImmuneResponse[];
    adaptation_history: AdaptationRecord[];
    retention_strength: number;
    last_activation: number;
}
export interface AdaptationRecord {
    adaptation_id: string;
    original_pattern: string;
    evolved_pattern: string;
    adaptation_trigger: string;
    effectiveness_improvement: number;
    adaptation_timestamp: number;
}
export interface QuarantineZone {
    zone_id: string;
    isolated_entities: IsolatedEntity[];
    containment_level: "observation" | "isolation" | "complete_quarantine";
    creation_time: number;
    auto_release_time: number | null;
    monitoring_intensity: number;
}
export interface IsolatedEntity {
    entity_id: string;
    entity_type: "node" | "message" | "code_block" | "data_structure";
    isolation_reason: string;
    threat_assessment: ThreatAssessment;
    isolation_time: number;
    rehabilitation_progress: number;
}
export interface ThreatAssessment {
    threat_level: number;
    infection_probability: number;
    spread_potential: number;
    damage_potential: number;
    stealth_factor: number;
}
export interface AdaptiveDefense {
    defense_id: string;
    defense_name: string;
    target_threat_types: string[];
    activation_conditions: ActivationCondition[];
    defense_mechanisms: DefenseMechanism[];
    learning_capability: LearningCapability;
    current_effectiveness: number;
}
export interface ActivationCondition {
    condition_type: "threshold" | "pattern" | "frequency" | "correlation";
    parameter: string;
    trigger_value: number;
    evaluation_window: number;
}
export interface DefenseMechanism {
    mechanism_id: string;
    mechanism_type: "preventive" | "reactive" | "adaptive";
    action: "block" | "redirect" | "transform" | "analyze" | "quarantine";
    resource_cost: number;
    effectiveness_score: number;
}
export interface LearningCapability {
    learning_rate: number;
    adaptation_speed: "slow" | "moderate" | "fast" | "instant";
    memory_capacity: number;
    generalization_ability: number;
    overfitting_resistance: number;
}
export declare class QuantumImmuneSystem {
    private immune_memory;
    private active_defenses;
    private quarantine_zones;
    private threat_signatures;
    private monitoring_active;
    private monitoring_timer;
    private adaptation_learning_rate;
    private threatBreaker;
    private responseBreaker;
    private scanBreaker;
    constructor();
    /**
     * 🧬 REGISTRO DE COMPONENTES PARA GESTIÓN DE REFERENCIAS DÉBILES
     * Registra todos los cachés y circuit breakers con WeakReferenceManager
     */
    private register_components_for_cleanup;
    /**
     * 📊 ESTADÍSTICAS DE REFERENCIAS DÉBILES
     */
    get weakReferenceStats(): import("../core/WeakReferenceManager.js").WeakReferenceStats;
    private initialize_base_defenses;
    start_immune_monitoring(): Promise<void>;
    stop_monitoring(): Promise<void>;
    private perform_threat_scan;
    private perform_memory_cleanup;
    private scan_for_threats;
    private process_detected_threat;
    private find_memory_match;
    private execute_learned_response;
    private analyze_and_respond;
    private execute_immune_response;
    private isolate_threat;
    private neutralize_threat;
    private adapt_to_threat;
    private observe_threat;
    private adapt_defenses;
    private create_immune_memory;
    private calculate_threat_severity_real;
    private identify_threat_source_real;
    private generate_behavioral_indicators;
    private determine_response_type;
    private calculate_response_intensity;
    private calculate_side_effects;
    private severity_to_number;
    private find_relevant_defense;
    private calculate_pattern_similarity;
    private update_threat_signatures;
    get_immune_status(): ImmuneSystemStatus;
    private calculate_threats_neutralized;
    private calculate_adaptation_efficiency;
    private calculate_overall_readiness;
    get_detailed_status(): Promise<string>;
    get circuitBreakers(): {
        threat: CircuitBreaker;
        response: CircuitBreaker;
        scan: CircuitBreaker;
    };
    demonstrate_immune_system(): Promise<void>;
}
interface ImmuneSystemStatus {
    monitoring_active: boolean;
    active_defenses: number;
    immune_memories: number;
    quarantine_zones: number;
    threat_signatures: number;
    overall_readiness: number;
    threats_neutralized: number;
    memory_bank: Map<string, ImmuneMemory>;
    adaptation_efficiency: number;
}
export {};
//# sourceMappingURL=QuantumImmuneSystem.d.ts.map