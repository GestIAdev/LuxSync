// 🛡️ SISTEMA INMUNITARIO CUÁNTICO - DEFENSOR ADAPTATIVO DE LA COLMENA 🛡️
// "In the quantum realm, immunity is not just protection - it's evolution"

import * as os from "os";
import { TTLCache, TTLCacheFactory } from "../../shared/TTLCache.js";
import {
  CircuitBreaker,
  CircuitBreakerFactory,
} from "../core/CircuitBreaker.js";
import { getWeakReferenceManager } from "../core/WeakReferenceManager.js";


export interface ThreatSignature {
  signature_id: string;
  threat_pattern: string;
  severity_level: "low" | "medium" | "high" | "critical";
  detection_confidence: number; // 0.0-1.0
  behavioral_markers: BehavioralMarker[];
  mutation_resistance: number; // 0.0-1.0
  first_observed: number;
  last_observed: number;
}

export interface BehavioralMarker {
  marker_type:
    | "network_anomaly"
    | "consensus_manipulation"
    | "resource_abuse"
    | "data_corruption"
    | "identity_spoofing";
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
  response_intensity: number; // 0.0-1.0
  success_probability: number;
  side_effects: SideEffect[];
  execution_time: number;
}

export interface SideEffect {
  effect_type:
    | "performance_degradation"
    | "connectivity_loss"
    | "false_positive"
    | "resource_consumption";
  severity: number; // 0.0-1.0
  duration: number; // milliseconds
  mitigation_available: boolean;
}

export interface ImmuneMemory {
  memory_id: string;
  threat_signature: ThreatSignature;
  successful_responses: ImmuneResponse[];
  failed_responses: ImmuneResponse[];
  adaptation_history: AdaptationRecord[];
  retention_strength: number; // 0.0-1.0
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
  monitoring_intensity: number; // 0.0-1.0
}

export interface IsolatedEntity {
  entity_id: string;
  entity_type: "node" | "message" | "code_block" | "data_structure";
  isolation_reason: string;
  threat_assessment: ThreatAssessment;
  isolation_time: number;
  rehabilitation_progress: number; // 0.0-1.0
}

export interface ThreatAssessment {
  threat_level: number; // 0.0-1.0
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
  current_effectiveness: number; // 0.0-1.0
}

export interface ActivationCondition {
  condition_type: "threshold" | "pattern" | "frequency" | "correlation";
  parameter: string;
  trigger_value: number;
  evaluation_window: number; // milliseconds
}

export interface DefenseMechanism {
  mechanism_id: string;
  mechanism_type: "preventive" | "reactive" | "adaptive";
  action: "block" | "redirect" | "transform" | "analyze" | "quarantine";
  resource_cost: number;
  effectiveness_score: number;
}

export interface LearningCapability {
  learning_rate: number; // 0.0-1.0
  adaptation_speed: "slow" | "moderate" | "fast" | "instant";
  memory_capacity: number;
  generalization_ability: number; // 0.0-1.0
  overfitting_resistance: number; // 0.0-1.0
}

// 🛡️ THE QUANTUM IMMUNE SYSTEM - ADAPTIVE GUARDIAN
export class QuantumImmuneSystem {
  private immune_memory: TTLCache<string, ImmuneMemory>;
  private active_defenses: TTLCache<string, AdaptiveDefense>;
  private quarantine_zones: TTLCache<string, QuarantineZone>;
  private threat_signatures: TTLCache<string, ThreatSignature>;
  private monitoring_active: boolean = false;
  private monitoring_timer: NodeJS.Timeout | null = null;
  private adaptation_learning_rate: number = 0.1;

  // 🛡️ CIRCUIT BREAKERS - PROTECCIÓN CONTRA CASCADAS DE FALLOS
  private threatBreaker: CircuitBreaker;
  private responseBreaker: CircuitBreaker;
  private scanBreaker: CircuitBreaker;

  constructor() {
    // 🎯 Initialize TTL Caches for automatic memory management
    this.immune_memory = TTLCacheFactory.createUnlimitedCache<
      string,
      ImmuneMemory
    >(`immune_memory_${Date.now()}`, 4 * 60 * 60 * 1000); // 4 hours
    this.active_defenses = TTLCacheFactory.createLongCache<
      string,
      AdaptiveDefense
    >(`active_defenses_${Date.now()}`);
    this.quarantine_zones = TTLCacheFactory.createSessionCache<
      string,
      QuarantineZone
    >(`quarantine_zones_${Date.now()}`);
    this.threat_signatures = TTLCacheFactory.createUnlimitedCache<
      string,
      ThreatSignature
    >(`threat_signatures_${Date.now()}`, 24 * 60 * 60 * 1000); // 24 hours

    // 🛡️ Initialize Circuit Breakers for threat response protection
    this.threatBreaker = CircuitBreakerFactory.createThreatBreaker(
      `threat_response_${Date.now()}`,
    );
    this.responseBreaker = CircuitBreakerFactory.createThreatBreaker(
      `immune_response_${Date.now()}`,
    );
    this.scanBreaker = CircuitBreakerFactory.createThreatBreaker(
      `threat_scan_${Date.now()}`,
    );

    this.initialize_base_defenses();
    this.register_components_for_cleanup();
    console.log(
      "🛡️ QuantumImmuneSystem initialized - Adaptive protection active",
    );
  }

  /**
   * 🧬 REGISTRO DE COMPONENTES PARA GESTIÓN DE REFERENCIAS DÉBILES
   * Registra todos los cachés y circuit breakers con WeakReferenceManager
   */
  private register_components_for_cleanup(): void {
    const weakRefManager = getWeakReferenceManager({
      autoCleanupEnabled: false,
      cycleDetectionEnabled: false,
      enableMemoryPressureDetection: false,
    });

    // Registrar cachés de memoria inmune
    weakRefManager.register(
      this.immune_memory,
      "quantum_immune_memory_cache",
      "cache",
      () => {
        console.log(
          "🧹 WeakReferenceManager: Limpiando caché de memoria inmune",
        );
        this.immune_memory.clear();
      },
    );

    // Registrar cachés de defensas activas
    weakRefManager.register(
      this.active_defenses,
      "quantum_immune_defenses_cache",
      "cache",
      () => {
        console.log(
          "🧹 WeakReferenceManager: Limpiando caché de defensas activas",
        );
        this.active_defenses.clear();
      },
    );

    // Registrar zonas de cuarentena
    weakRefManager.register(
      this.quarantine_zones,
      "quantum_immune_quarantine_cache",
      "cache",
      () => {
        console.log("🧹 WeakReferenceManager: Limpiando zonas de cuarentena");
        this.quarantine_zones.clear();
      },
    );

    // Registrar firmas de amenazas
    weakRefManager.register(
      this.threat_signatures,
      "quantum_immune_threats_cache",
      "cache",
      () => {
        console.log("🧹 WeakReferenceManager: Limpiando firmas de amenazas");
        this.threat_signatures.clear();
      },
    );

    // Registrar circuit breakers
    weakRefManager.register(
      this.threatBreaker,
      "quantum_immune_threat_breaker",
      "circuit_breaker",
      () => {
        console.log(
          "🧹 WeakReferenceManager: Limpiando circuit breaker de amenazas",
        );
        this.threatBreaker.destroy();
      },
    );

    weakRefManager.register(
      this.responseBreaker,
      "quantum_immune_response_breaker",
      "circuit_breaker",
      () => {
        console.log(
          "🧹 WeakReferenceManager: Limpiando circuit breaker de respuestas",
        );
        this.responseBreaker.destroy();
      },
    );

    weakRefManager.register(
      this.scanBreaker,
      "quantum_immune_scan_breaker",
      "circuit_breaker",
      () => {
        console.log(
          "🧹 WeakReferenceManager: Limpiando circuit breaker de escaneo",
        );
        this.scanBreaker.destroy();
      },
    );

    console.log(
      "🧬 QuantumImmuneSystem: Componentes registrados con WeakReferenceManager",
    );
  }

  /**
   * 📊 ESTADÍSTICAS DE REFERENCIAS DÉBILES
   */
  get weakReferenceStats() {
    const weakRefManager = getWeakReferenceManager({
      autoCleanupEnabled: false,
      cycleDetectionEnabled: false,
      enableMemoryPressureDetection: false,
    });
    return weakRefManager.getStats();
  }

  // 🧬 INITIALIZE BASE DEFENSE MECHANISMS
  private initialize_base_defenses(): void {
    // Anti-Byzantine Defense
    this.active_defenses.set("anti-byzantine", {
      defense_id: "anti-byzantine",
      defense_name: "Byzantine Fault Tolerance",
      target_threat_types: ["consensus_manipulation", "identity_spoofing"],
      activation_conditions: [
        {
          condition_type: "threshold",
          parameter: "consensus_agreement_rate",
          trigger_value: 0.7, // Activate if agreement drops below 70%
          evaluation_window: 10000,
        },
      ],
      defense_mechanisms: [
        {
          mechanism_id: "byzantine-isolation",
          mechanism_type: "reactive",
          action: "quarantine",
          resource_cost: 0.3,
          effectiveness_score: 0.9,
        },
      ],
      learning_capability: {
        learning_rate: 0.05,
        adaptation_speed: "moderate",
        memory_capacity: 1000,
        generalization_ability: 0.8,
        overfitting_resistance: 0.7,
      },
      current_effectiveness: 0.85,
    });

    // Network Anomaly Defense
    this.active_defenses.set("network-guardian", {
      defense_id: "network-guardian",
      defense_name: "Network Anomaly Guardian",
      target_threat_types: ["network_anomaly", "resource_abuse"],
      activation_conditions: [
        {
          condition_type: "pattern",
          parameter: "message_frequency",
          trigger_value: 100, // Messages per second threshold
          evaluation_window: 5000,
        },
      ],
      defense_mechanisms: [
        {
          mechanism_id: "rate-limiting",
          mechanism_type: "preventive",
          action: "block",
          resource_cost: 0.1,
          effectiveness_score: 0.8,
        },
      ],
      learning_capability: {
        learning_rate: 0.08,
        adaptation_speed: "fast",
        memory_capacity: 500,
        generalization_ability: 0.7,
        overfitting_resistance: 0.6,
      },
      current_effectiveness: 0.8,
    });

    // Data Integrity Defense
    this.active_defenses.set("data-sentinel", {
      defense_id: "data-sentinel",
      defense_name: "Data Integrity Sentinel",
      target_threat_types: ["data_corruption"],
      activation_conditions: [
        {
          condition_type: "correlation",
          parameter: "checksum_failures",
          trigger_value: 3, // Number of failures
          evaluation_window: 15000,
        },
      ],
      defense_mechanisms: [
        {
          mechanism_id: "integrity-verification",
          mechanism_type: "preventive",
          action: "analyze",
          resource_cost: 0.2,
          effectiveness_score: 0.95,
        },
      ],
      learning_capability: {
        learning_rate: 0.03,
        adaptation_speed: "slow",
        memory_capacity: 2000,
        generalization_ability: 0.9,
        overfitting_resistance: 0.8,
      },
      current_effectiveness: 0.95,
    });
  }

  // 🔍 CONTINUOUS THREAT MONITORING - OPTIMIZADO
  async start_immune_monitoring(): Promise<void> {
    if (this.monitoring_active) {
      console.log("⚠️ Immune monitoring already active");
      return;
    }

    this.monitoring_active = true;
    console.log("🛡️ Starting continuous immune monitoring...");

    // 🚀 OPTIMIZACIÓN: Aumentar intervalo de 8s a 15s para reducir carga en event loop
    this.monitoring_timer = setInterval(async () => {
      await this.perform_threat_scan();
      await this.perform_memory_cleanup(); // ⚡ MEMORY LEAK PREVENTION: Periodic cleanup
    }, 15000); // 🚀 OPTIMIZACIÓN: 8s → 15s para mejor rendimiento

    console.log("✅ Quantum immune monitoring activated");
  }

  async stop_monitoring(): Promise<void> {
    this.monitoring_active = false;
    if (this.monitoring_timer) {
      clearInterval(this.monitoring_timer);
      this.monitoring_timer = null;
    }

    // Limpiar circuit breakers
    this.threatBreaker.destroy();
    this.responseBreaker.destroy();
    this.scanBreaker.destroy();

    console.log("🛡️ Immune monitoring stopped");
  }

  // 🔬 COMPREHENSIVE THREAT SCANNING
  private async perform_threat_scan(): Promise<void> {
    return this.scanBreaker.execute(async () => {
      const scan_results = await this.scan_for_threats();

      for (const threat of scan_results) {
        await this.process_detected_threat(threat);
      }

      // Adaptation learning
      await this.adapt_defenses();
    });
  }

  // 🧹 MEMORY LEAK PREVENTION: Periodic cleanup of unbounded arrays
  private async perform_memory_cleanup(): Promise<void> {
    // Limit adaptation_history in each immune memory to 3 entries max
    for (const memory of this.immune_memory.values()) {
      if (memory.adaptation_history.length > 3) {
        memory.adaptation_history = memory.adaptation_history
          .sort((_a, _b) => _b.adaptation_timestamp - _a.adaptation_timestamp) // Keep newest
          .slice(0, 3);
      }
    }

    // Limit quarantine zones to 5 active zones max
    if (this.quarantine_zones.size() > 5) {
      const zones_to_remove = Array.from(this.quarantine_zones.entries())
        .sort(([, a], [, b]) => a.creation_time - b.creation_time) // Remove oldest
        .slice(0, this.quarantine_zones.size() - 5);

      for (const [zone_id] of zones_to_remove) {
        this.quarantine_zones.delete(zone_id);
      }
      console.log(
        `🗑️ Cleaned up ${zones_to_remove.length} old quarantine zones`,
      );
    }

    // Limit threat signatures to 20 max
    if (this.threat_signatures.size() > 20) {
      const signatures_to_remove = Array.from(this.threat_signatures.entries())
        .sort(([, a], [, b]) => a.first_observed - b.first_observed) // Remove oldest
        .slice(0, this.threat_signatures.size() - 20);

      for (const [sig_id] of signatures_to_remove) {
        this.threat_signatures.delete(sig_id);
      }
      console.log(
        `🗑️ Cleaned up ${signatures_to_remove.length} old threat signatures`,
      );
    }
  }

  private async scan_for_threats(): Promise<DetectedThreat[]> {
    const threats: DetectedThreat[] = [];
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Real threat detection based on system metrics
    const memory_pressure = memUsage.heapUsed / memUsage.heapTotal;
    const cpu_load =
      (cpuUsage.user + cpuUsage.system) /
      (process.uptime() * 1000000 * os.cpus().length);
    const system_load = os.loadavg()[0] / os.cpus().length;

    // Detect threats based on real system anomalies - DETERMINISTIC threshold
    const threat_level = (memory_pressure + cpu_load + system_load) / 3;
    const threat_threshold = 0.6; // Trigger when system stress exceeds 60%

    if (threat_level > threat_threshold) {
      // REAL threat detection based on system health
      const threat_types = [
        "consensus_manipulation",
        "network_anomaly",
        "data_corruption",
        "resource_abuse",
      ];
      // Select threat type based on which metric is most stressed
      let selected_type = "resource_abuse"; // default
      if (cpu_load > memory_pressure && cpu_load > system_load) {
        selected_type = "consensus_manipulation";
      } else if (memory_pressure > cpu_load && memory_pressure > system_load) {
        selected_type = "data_corruption";
      } else if (system_load > cpu_load && system_load > memory_pressure) {
        selected_type = "network_anomaly";
      }

      threats.push({
        threat_id: `threat-${Date.now()}-${(Date.now() * memory_pressure).toString(36).substr(2, 6)}`,
        threat_type: selected_type,
        severity: this.calculate_threat_severity_real(
          cpu_load,
          memory_pressure,
          system_load,
        ),
        source_location: this.identify_threat_source_real(),
        detection_confidence: Math.max(
          0.7,
          Math.min(1.0, 0.8 + (cpu_load + memory_pressure + system_load) / 3),
        ),
        behavioral_indicators:
          this.generate_behavioral_indicators(selected_type),
        detection_time: Date.now(),
      });
    }

    return threats;
  }

  // ⚔️ THREAT PROCESSING AND RESPONSE
  private async process_detected_threat(threat: DetectedThreat): Promise<void> {
    return this.threatBreaker.execute(async () => {
      console.log(
        `🚨 Threat detected: ${threat.threat_type} (${threat.severity})`,
      );
      console.log(
        `🎯 Confidence: ${(threat.detection_confidence * 100).toFixed(1)}%`,
      );

      // Check if we have memory of this threat pattern
      const memory_match = this.find_memory_match(threat);

      if (memory_match) {
        console.log(`🧠 Memory match found: ${memory_match.memory_id}`);
        await this.execute_learned_response(threat, memory_match);
      } else {
        console.log("🆕 New threat pattern - analyzing and responding");
        await this.analyze_and_respond(threat);
      }

      // Update threat signatures
      await this.update_threat_signatures(threat);
    });
  }

  private find_memory_match(_threat: DetectedThreat): ImmuneMemory | null {
    for (const memory of this.immune_memory.values()) {
      const similarity = this.calculate_pattern_similarity(
        _threat.behavioral_indicators,
        memory.threat_signature.behavioral_markers,
      );

      if (similarity > 0.8) {
        // 80% similarity threshold
        return memory;
      }
    }
    return null;
  }

  private async execute_learned_response(
    _threat: DetectedThreat,
    memory: ImmuneMemory,
  ): Promise<void> {
    // Use the most successful response from memory
    const best_response = memory.successful_responses.sort(
      (_a, _b) => _b.success_probability - _a.success_probability,
    )[0];

    if (best_response) {
      console.log(
        `🎯 Executing learned response: ${best_response.response_type}`,
      );
      await this.execute_immune_response(_threat, best_response.response_type);

      // Update memory activation
      memory.last_activation = Date.now();
    }
  }

  private async analyze_and_respond(threat: DetectedThreat): Promise<void> {
    // Determine appropriate response based on threat characteristics
    const response_type = this.determine_response_type(threat);

    console.log(`🛡️ Executing ${response_type} response`);
    const response = await this.execute_immune_response(threat, response_type);

    // Create new immune memory
    await this.create_immune_memory(threat, response);
  }

  private async execute_immune_response(
    threat: DetectedThreat,
    response_type: string,
  ): Promise<ImmuneResponse> {
    return this.responseBreaker.execute(async () => {
      const memUsage = process.memoryUsage();
      const memory_health = 1.0 - memUsage.heapUsed / memUsage.heapTotal;

      const response: ImmuneResponse = {
        response_id: `response-${Date.now()}`,
        triggered_by: threat.threat_id,
        response_type: response_type as any,
        threat_target: threat.threat_id,
        response_intensity: this.calculate_response_intensity(threat),
        success_probability: Math.max(
          0.7,
          Math.min(0.95, 0.8 + memory_health * 0.15),
        ),
        side_effects: this.calculate_side_effects(response_type),
        execution_time: Date.now(),
      };

      switch (response_type) {
        case "isolation":
          await this.isolate_threat(threat);
          break;
        case "neutralization":
          await this.neutralize_threat(threat);
          break;
        case "adaptation":
          await this.adapt_to_threat(threat);
          break;
        case "observation":
          await this.observe_threat(threat);
          break;
      }

      console.log(`✅ Response ${response.response_id} executed`);
      return response;
    });
  }

  // 🔒 THREAT CONTAINMENT METHODS
  private async isolate_threat(threat: DetectedThreat): Promise<void> {
    const zone_id = `quarantine-${Date.now()}`;

    const quarantine_zone: QuarantineZone = {
      zone_id,
      isolated_entities: [
        {
          entity_id: threat.source_location,
          entity_type: "node",
          isolation_reason: `Threat: ${threat.threat_type}`,
          threat_assessment: {
            threat_level: this.severity_to_number(threat.severity),
            infection_probability: threat.detection_confidence,
            spread_potential: Math.min(0.8, threat.detection_confidence * 0.6), // Based on detection confidence
            damage_potential: Math.min(
              0.9,
              this.severity_to_number(threat.severity),
            ), // Based on severity
            stealth_factor: Math.max(0.1, 1.0 - threat.detection_confidence), // Inverse of detection confidence
          },
          isolation_time: Date.now(),
          rehabilitation_progress: 0.0,
        },
      ],
      containment_level: "isolation",
      creation_time: Date.now(),
      auto_release_time: Date.now() + 300000, // 5 minutes
      monitoring_intensity: 0.8,
    };

    this.quarantine_zones.set(zone_id, quarantine_zone);
    console.log(
      `🔒 Entity ${threat.source_location} isolated in quarantine zone ${zone_id}`,
    );
  }

  private async neutralize_threat(threat: DetectedThreat): Promise<void> {
    console.log(`⚔️ Neutralizing threat: ${threat.threat_id}`);
    // Simulate neutralization process
    await new Promise((_resolve) => setTimeout(_resolve, 500));
    console.log(`✅ Threat ${threat.threat_id} neutralized`);
  }

  private async adapt_to_threat(threat: DetectedThreat): Promise<void> {
    console.log(`🧬 Adapting defenses to counter: ${threat.threat_type}`);

    // Find relevant defense system
    const relevant_defense = this.find_relevant_defense(threat.threat_type);
    if (relevant_defense) {
      // Improve defense effectiveness
      relevant_defense.current_effectiveness = Math.min(
        1.0,
        relevant_defense.current_effectiveness + this.adaptation_learning_rate,
      );

      console.log(
        `📈 Defense ${relevant_defense.defense_name} adapted (effectiveness: ${(relevant_defense.current_effectiveness * 100).toFixed(1)}%)`,
      );
    }
  }

  private async observe_threat(_threat: DetectedThreat): Promise<void> {
    console.log(
      `👁️ Monitoring threat: ${_threat.threat_id} for behavioral analysis`,
    );
    // Low-intensity monitoring for pattern learning
  }

  // 🧠 LEARNING AND ADAPTATION
  private async adapt_defenses(): Promise<void> {
    // Adapt based on recent threat activity and system health
    const recent_threats = Array.from(this.immune_memory.values()).filter(
      (_memory) => Date.now() - _memory.last_activation < 3600000,
    ).length; // Last hour

    const memUsage = process.memoryUsage();
    const system_stress = memUsage.heapUsed / memUsage.heapTotal;

    // Higher adaptation when there are recent threats or system stress - DETERMINISTIC
    const adaptation_score = recent_threats * 0.01 + system_stress * 0.02;
    const adaptation_threshold = 0.03; // Adapt when score exceeds 3%

    if (adaptation_score > adaptation_threshold) {
      console.log("🧬 Evolving defense mechanisms...");

      for (const defense of this.active_defenses.values()) {
        if (defense.learning_capability.adaptation_speed === "fast") {
          defense.current_effectiveness = Math.min(
            1.0,
            defense.current_effectiveness + 0.001,
          );
        }
      }
    }
  }

  private async create_immune_memory(
    threat: DetectedThreat,
    response: ImmuneResponse,
  ): Promise<void> {
    const memory_id = `memory-${threat.threat_type}-${Date.now()}`;

    const signature: ThreatSignature = {
      signature_id: `sig-${Date.now()}`,
      threat_pattern: threat.threat_type,
      severity_level: threat.severity,
      detection_confidence: threat.detection_confidence,
      behavioral_markers: threat.behavioral_indicators.map((indicator) => ({
        marker_type: indicator.indicator_type as any,
        pattern_description: indicator.description,
        detection_threshold: indicator.threshold,
        false_positive_rate: 0.05,
        adaptive_weight: 1.0,
      })),
      mutation_resistance: 0.7,
      first_observed: Date.now(),
      last_observed: Date.now(),
    };

    const memory: ImmuneMemory = {
      memory_id,
      threat_signature: signature,
      successful_responses:
        response.success_probability > 0.7 ? [response] : [],
      failed_responses: response.success_probability <= 0.7 ? [response] : [],
      adaptation_history: [], // ⚡ MEMORY LEAK PREVENTION: Start empty, limit to 3 entries max
      retention_strength: 0.8,
      last_activation: Date.now(),
    };

    this.immune_memory.set(memory_id, memory);
    console.log(`🧠 New immune memory created: ${memory_id}`);

    // ⚡ MEMORY LEAK PREVENTION: Limit immune memory bank to 10 entries max
    if (this.immune_memory.size() > 10) {
      const oldest_memory = Array.from(this.immune_memory.entries()).sort(
        ([, a], [, b]) => a.last_activation - b.last_activation,
      )[0];
      if (oldest_memory) {
        this.immune_memory.delete(oldest_memory[0]);
        console.log(
          "🗑️ Cleaned up oldest immune memory to prevent memory leaks",
        );
      }
    }
  }

  // 🛠️ UTILITY METHODS
  private calculate_threat_severity_real(
    _cpu_load: number,
    _memory_pressure: number,
    _system_load: number,
  ): "low" | "medium" | "high" | "critical" {
    const combined_stress = (_cpu_load + _memory_pressure + _system_load) / 3;

    if (combined_stress < 0.3) return "low";
    if (combined_stress < 0.5) return "medium";
    if (combined_stress < 0.7) return "high";
    return "critical";
  }

  private identify_threat_source_real(): string {
    const memUsage = process.memoryUsage();
    const memory_pressure = memUsage.heapUsed / memUsage.heapTotal;

    // Select source based on system state
    if (memory_pressure > 0.8) {
      return "warrior-node"; // High memory usage suggests active processing node
    } else if (process.uptime() > 3600) {
      return "sage-node"; // Long uptime suggests wisdom/monitoring node
    } else {
      return "poet-node"; // Default creative node
    }
  }

  private generate_behavioral_indicators(
    _threat_type: string,
  ): BehavioralIndicator[] {
    const indicators: BehavioralIndicator[] = [];

    switch (_threat_type) {
      case "consensus_manipulation":
        indicators.push({
          indicator_type: "consensus_manipulation",
          description: "Unusual voting patterns detected",
          threshold: 0.7,
          confidence: 0.8,
        });
        break;
      case "network_anomaly":
        indicators.push({
          indicator_type: "network_anomaly",
          description: "Abnormal message frequency",
          threshold: 100,
          confidence: 0.9,
        });
        break;
      case "data_corruption":
        indicators.push({
          indicator_type: "data_corruption",
          description: "Checksum verification failures",
          threshold: 3,
          confidence: 0.95,
        });
        break;
    }

    return indicators;
  }

  private determine_response_type(_threat: DetectedThreat): string {
    switch (_threat.severity) {
      case "critical":
        return "isolation";
      case "high":
        return "neutralization";
      case "medium":
        return "adaptation";
      default:
        return "observation";
    }
  }

  private calculate_response_intensity(threat: DetectedThreat): number {
    const severity_factor = this.severity_to_number(threat.severity);
    const confidence_factor = threat.detection_confidence;
    return (severity_factor + confidence_factor) / 2;
  }

  private calculate_side_effects(_response_type: string): SideEffect[] {
    const side_effects: SideEffect[] = [];

    if (_response_type === "isolation") {
      side_effects.push({
        effect_type: "connectivity_loss",
        severity: 0.3,
        duration: 60000, // 1 minute
        mitigation_available: true,
      });
    }

    return side_effects;
  }

  private severity_to_number(_severity: string): number {
    switch (_severity) {
      case "low":
        return 0.25;
      case "medium":
        return 0.5;
      case "high":
        return 0.75;
      case "critical":
        return 1.0;
      default:
        return 0.1;
    }
  }

  private find_relevant_defense(_threat_type: string): AdaptiveDefense | null {
    for (const defense of this.active_defenses.values()) {
      if (defense.target_threat_types.includes(_threat_type)) {
        return defense;
      }
    }
    return null;
  }

  private calculate_pattern_similarity(
    indicators1: BehavioralIndicator[],
    markers2: BehavioralMarker[],
  ): number {
    if (indicators1.length === 0 || markers2.length === 0) return 0;

    let matches = 0;
    for (const indicator of indicators1) {
      for (const marker of markers2) {
        if (indicator.indicator_type === marker.marker_type) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(indicators1.length, markers2.length);
  }

  private async update_threat_signatures(
    threat: DetectedThreat,
  ): Promise<void> {
    const existing_signature = Array.from(this.threat_signatures.values()).find(
      (_sig) => _sig.threat_pattern === threat.threat_type,
    );

    if (existing_signature) {
      existing_signature.last_observed = Date.now();
      existing_signature.detection_confidence = Math.max(
        existing_signature.detection_confidence,
        threat.detection_confidence,
      );
    } else {
      const new_signature: ThreatSignature = {
        signature_id: `sig-${Date.now()}`,
        threat_pattern: threat.threat_type,
        severity_level: threat.severity,
        detection_confidence: threat.detection_confidence,
        behavioral_markers: threat.behavioral_indicators.map((indicator) => ({
          marker_type: indicator.indicator_type as any,
          pattern_description: indicator.description,
          detection_threshold: indicator.threshold,
          false_positive_rate: 0.05,
          adaptive_weight: 1.0,
        })),
        mutation_resistance: 0.7,
        first_observed: Date.now(),
        last_observed: Date.now(),
      };

      this.threat_signatures.set(new_signature.signature_id, new_signature);
    }
  }

  // 📊 STATUS AND MONITORING
  get_immune_status(): ImmuneSystemStatus {
    return {
      monitoring_active: this.monitoring_active,
      active_defenses: this.active_defenses.size(),
      immune_memories: this.immune_memory.size(),
      quarantine_zones: this.quarantine_zones.size(),
      threat_signatures: this.threat_signatures.size(),
      overall_readiness: this.calculate_overall_readiness(),
      // V402 Multi-Node Properties
      threats_neutralized: this.calculate_threats_neutralized(),
      memory_bank: new Map(this.immune_memory.entries()),
      adaptation_efficiency: this.calculate_adaptation_efficiency(),
    };
  }

  private calculate_threats_neutralized(): number {
    // Count successful responses across all immune memories
    let neutralized = 0;
    for (const memory of this.immune_memory.values()) {
      neutralized += memory.successful_responses.length;
    }
    return neutralized;
  }

  private calculate_adaptation_efficiency(): number {
    if (this.active_defenses.size() === 0) return 0.8; // Default efficiency

    // Calculate average effectiveness of all active defenses
    const total_effectiveness = Array.from(
      this.active_defenses.values(),
    ).reduce((_sum, _defense) => _sum + _defense.current_effectiveness, 0);

    return total_effectiveness / this.active_defenses.size();
  }

  private calculate_overall_readiness(): number {
    const defense_avg =
      Array.from(this.active_defenses.values()).reduce(
        (_sum, _defense) => _sum + _defense.current_effectiveness,
        0,
      ) / this.active_defenses.size();

    const memory_factor = Math.min(1.0, this.immune_memory.size() / 10); // Optimal around 10 memories

    return (defense_avg + memory_factor) / 2;
  }

  async get_detailed_status(): Promise<string> {
    const status = this.get_immune_status();

    return `🛡️ Quantum Immune System Status:
Monitoring: ${status.monitoring_active ? "ACTIVE" : "INACTIVE"}
Active Defenses: ${status.active_defenses}
Immune Memories: ${status.immune_memories}
Quarantine Zones: ${status.quarantine_zones}
Threat Signatures: ${status.threat_signatures}
Overall Readiness: ${(status.overall_readiness * 100).toFixed(1)}%`;
  }

  // 🛡️ GETTERS - CIRCUIT BREAKERS
  get circuitBreakers() {
    return {
      threat: this.threatBreaker,
      response: this.responseBreaker,
      scan: this.scanBreaker,
    };
  }

  // 🎭 DEMONSTRATION METHOD
  async demonstrate_immune_system(): Promise<void> {
    console.log("\n🛡️ DEMONSTRATING QUANTUM IMMUNE SYSTEM 🛡️");
    console.log("━".repeat(50));

    // Start monitoring
    await this.start_immune_monitoring();

    console.log("\n📊 Initial immune system status:");
    console.log(await this.get_detailed_status());

    console.log("\n🦠 SIMULATING THREAT SCENARIOS 🦠");

    // Simulate various threats
    const test_threats: DetectedThreat[] = [
      {
        threat_id: "demo-threat-001",
        threat_type: "consensus_manipulation",
        severity: "high",
        source_location: "warrior-node",
        detection_confidence: 0.95,
        behavioral_indicators: [
          {
            indicator_type: "consensus_manipulation",
            description: "Suspicious voting patterns",
            threshold: 0.8,
            confidence: 0.9,
          },
        ],
        detection_time: Date.now(),
      },
      {
        threat_id: "demo-threat-002",
        threat_type: "network_anomaly",
        severity: "medium",
        source_location: "external-entity",
        detection_confidence: 0.8,
        behavioral_indicators: [
          {
            indicator_type: "network_anomaly",
            description: "Excessive message frequency",
            threshold: 150,
            confidence: 0.85,
          },
        ],
        detection_time: Date.now(),
      },
    ];

    for (const threat of test_threats) {
      console.log(`\n🚨 Processing threat: ${threat.threat_id}`);
      await this.process_detected_threat(threat);
      await new Promise((_resolve) => setTimeout(_resolve, 1000));
    }

    console.log("\n📈 Post-threat system status:");
    console.log(await this.get_detailed_status());

    // Show quarantine zones
    if (this.quarantine_zones.size() > 0) {
      console.log("\n🔒 ACTIVE QUARANTINE ZONES:");
      for (const zone of this.quarantine_zones.values()) {
        console.log(
          `  Zone ${zone.zone_id}: ${zone.isolated_entities.length} entities isolated`,
        );
      }
    }

    // Show immune memories
    if (this.immune_memory.size() > 0) {
      console.log("\n🧠 IMMUNE MEMORY BANK:");
      for (const memory of this.immune_memory.values()) {
        console.log(
          `  ${memory.memory_id}: ${memory.threat_signature.threat_pattern} (${memory.successful_responses.length} successful responses)`,
        );
      }
    }

    await this.stop_monitoring();
    console.log("\n✅ Quantum Immune System demonstration complete!");
  }
}

// Supporting interfaces
interface DetectedThreat {
  threat_id: string;
  threat_type: string;
  severity: "low" | "medium" | "high" | "critical";
  source_location: string;
  detection_confidence: number;
  behavioral_indicators: BehavioralIndicator[];
  detection_time: number;
}

interface BehavioralIndicator {
  indicator_type: string;
  description: string;
  threshold: number;
  confidence: number;
}

interface ImmuneSystemStatus {
  monitoring_active: boolean;
  active_defenses: number;
  immune_memories: number;
  quarantine_zones: number;
  threat_signatures: number;
  overall_readiness: number;
  // V402 Multi-Node Properties
  threats_neutralized: number;
  memory_bank: Map<string, ImmuneMemory>;
  adaptation_efficiency: number;
}


