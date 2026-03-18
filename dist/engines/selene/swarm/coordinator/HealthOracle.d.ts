export interface HealthMetrics {
    node_vitality: NodeVitality[];
    consensus_health: ConsensusHealth;
    network_connectivity: NetworkHealth;
    performance_indicators: PerformanceMetrics;
    threat_assessment: ThreatAnalysis;
    predictive_insights: PredictiveAnalysis;
}
export interface NodeVitality {
    node_id: string;
    health_score: number;
    cpu_utilization: number;
    memory_usage: number;
    network_latency: number;
    last_heartbeat: number;
    status: "healthy" | "degraded" | "critical" | "offline";
    anomaly_indicators: AnomalyIndicator[];
}
export interface ConsensusHealth {
    decision_latency: number;
    agreement_rate: number;
    byzantine_resistance: number;
    musical_harmony: number;
    veritas_accuracy: number;
    democratic_participation: number;
}
export interface NetworkHealth {
    total_nodes: number;
    active_nodes: number;
    partition_resistance: number;
    message_delivery_rate: number;
    network_topology_strength: number;
    redundancy_factor: number;
}
export interface PerformanceMetrics {
    transactions_per_second: number;
    average_response_time: number;
    throughput_efficiency: number;
    resource_optimization: number;
    scalability_index: number;
}
export interface ThreatAnalysis {
    active_threats: Threat[];
    vulnerability_score: number;
    immune_system_readiness: number;
    last_attack_time: number;
    defense_success_rate: number;
}
export interface Threat {
    threat_id: string;
    severity: "low" | "medium" | "high" | "critical";
    type: "malicious_code" | "byzantine_node" | "ddos" | "data_corruption" | "consensus_attack";
    source_node: string | null;
    detection_time: number;
    mitigation_status: "detected" | "isolating" | "neutralized" | "monitoring";
}
export interface PredictiveAnalysis {
    failure_probability: number;
    degradation_trend: "improving" | "stable" | "declining" | "critical";
    recommended_actions: RecommendedAction[];
    maintenance_schedule: MaintenanceTask[];
    capacity_projection: CapacityForecast;
}
export interface RecommendedAction {
    action_id: string;
    priority: "low" | "medium" | "high" | "urgent";
    description: string;
    estimated_impact: number;
    resource_requirement: number;
    execution_time_estimate: number;
}
export interface MaintenanceTask {
    task_id: string;
    scheduled_time: number;
    type: "preventive" | "corrective" | "optimization";
    target_components: string[];
    expected_downtime: number;
}
export interface CapacityForecast {
    current_utilization: number;
    projected_growth: number;
    capacity_threshold: number;
    scaling_recommendation: "none" | "horizontal" | "vertical" | "optimization";
}
export interface AnomalyIndicator {
    metric: string;
    current_value: number;
    expected_range: [number, number];
    deviation_score: number;
    trend: "increasing" | "decreasing" | "stable" | "erratic";
}
export declare class HealthOracle {
    private diagnostic_interval;
    private prediction_window;
    private health_history;
    private max_history_entries;
    private active_monitoring;
    private diagnostic_timer;
    private healthBreaker;
    private comprehensiveBreaker;
    constructor();
    private register_components_for_cleanup;
    /**
     * 📊 ESTADÍSTICAS DE REFERENCIAS DÉBILES
     */
    get weakReferenceStats(): import("../core/WeakReferenceManager.js").WeakReferenceStats;
    start_continuous_monitoring(): Promise<void>;
    stop_monitoring(): Promise<void>;
    perform_health_scan(): Promise<HealthMetrics>;
    private assess_node_vitality;
    private get_real_node_vitals;
    private get_estimated_node_vitals;
    private detect_real_node_anomalies;
    private assess_consensus_health;
    private assess_network_health;
    private assess_performance;
    private assess_threats;
    private generate_predictions;
    private generate_recommendations;
    private generate_maintenance_schedule;
    private evaluate_critical_conditions;
    private trigger_emergency_protocols;
    private calculate_overall_health;
    get_health_summary(): Promise<string>;
    perform_comprehensive_health_scan(): Promise<{
        overall_health: number;
        detected_issues: string[];
        predictive_insights: string[];
    }>;
    getHealthBreakerStatus(): {
        state: import("../core/CircuitBreaker.js").CircuitBreakerState;
        metrics: import("../core/CircuitBreaker.js").CircuitBreakerMetrics;
    };
    getComprehensiveBreakerStatus(): {
        state: import("../core/CircuitBreaker.js").CircuitBreakerState;
        metrics: import("../core/CircuitBreaker.js").CircuitBreakerMetrics;
    };
    demonstrate_health_oracle(): Promise<void>;
}
//# sourceMappingURL=HealthOracle.d.ts.map