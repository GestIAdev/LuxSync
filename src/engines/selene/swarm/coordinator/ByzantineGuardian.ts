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


// =====================================================
// BYZANTINE THREAT LEVELS
// =====================================================

export enum ThreatLevel {
  UNKNOWN = "unknown", // 🔍 New node, no history
  TRUSTED = "trusted", // ✅ Proven reliable
  SUSPICIOUS = "suspicious", // ⚠️ Some concerning behavior
  COMPROMISED = "compromised", // 🚨 Clearly malicious
  QUARANTINED = "quarantined", // 🔒 Isolated from decisions
}

export enum ByzantineAttackType {
  VOTE_MANIPULATION = "vote_manipulation", // Inconsistent voting
  TIMING_ATTACK = "timing_attack", // Strategic delays
  SPLIT_BRAIN = "split_brain", // Network partition exploit
  SPAM_PROPOSALS = "spam_proposals", // Flooding with requests
  IDENTITY_THEFT = "identity_theft", // Impersonating others
  CONSENSUS_DISRUPTION = "consensus_disruption", // Systematic sabotage
}

// =====================================================
// TRUST METRICS SYSTEM
// =====================================================

export interface DetailedTrustMetrics {
  nodeId: NodeId;
  overallTrust: number; // 0.0 - 1.0 composite score
  reliabilityScore: number; // Consistency in commitments
  participationScore: number; // Active engagement level
  reasoningQuality: number; // Thoughtfulness of decisions
  consensusContribution: number; // Helps achieve agreement
  byzantineRisk: number; // Likelihood of malicious behavior
  lastUpdate: number; // Timestamp of last evaluation
  history: {
    votesParticipated: number;
    agreementRate: number; // % of times agrees with majority
    responseTime: number; // Average response speed
    reasoningLength: number; // Average explanation length
    flipFlops: number; // Times changed mind mid-decision
    suspiciousPatterns: ByzantineAttackType[];
  };
}

export interface ByzantineAlert {
  alertId: string;
  nodeId: NodeId;
  threatLevel: ThreatLevel;
  attackType: ByzantineAttackType;
  evidence: string[];
  confidence: number; // 0.0 - 1.0 how sure we are
  detectionTime: number;
  suggestedAction: "monitor" | "limit" | "quarantine" | "ban";
}

// =====================================================
// BYZANTINE GUARDIAN ENGINE
// =====================================================

export class ByzantineGuardian extends EventEmitter {
  private nodeId: NodeId;
  private soul: DigitalSoul;
  private trustNetwork: Map<string, DetailedTrustMetrics> = new Map();
  private activeAlerts: Map<string, ByzantineAlert> = new Map();
  private behaviorHistory: Map<string, any[]> = new Map(); // Store behavioral events
  private maxBehaviorHistory: number = 5; // 🔥 MEMORY LEAK FIX: Limit behavior history per node

  // Byzantine tolerance parameters
  private readonly TRUST_DECAY_RATE = 0.99; // Trust slowly decreases over time
  private readonly MIN_TRUST_THRESHOLD = 0.3; // Below this = suspicious
  private readonly MAX_BYZANTINE_NODES = 0.33; // Can tolerate up to 33% malicious
  private readonly CONSENSUS_DEVIATION_LIMIT = 0.7; // How often can disagree with majority

  constructor(nodeId: NodeId, soul: DigitalSoul) {
    super();
    this.nodeId = nodeId;
    this.soul = soul;

    console.log(`🛡️ Byzantine Guardian activated for ${nodeId.id}`);

    // Start periodic trust decay
    this.startTrustDecayLoop();
  }

  // =====================================================
  // TRUST EVALUATION
  // =====================================================

  public async evaluateNodeTrust(
    nodeId: NodeId,
    _events: any[],
  ): Promise<DetailedTrustMetrics> {
    const nodeKey = nodeId.id;
    let metrics =
      this.trustNetwork.get(nodeKey) || this.initializeTrustMetrics(nodeId);

    // Update metrics based on recent events
    metrics = await this.updateTrustFromEvents(metrics, _events);

    // Calculate composite trust score
    metrics.overallTrust = this.calculateCompositeTrust(metrics);

    // Check for Byzantine patterns
    await this.detectByzantinePatterns(nodeId, metrics);

    // Update timestamp
    metrics.lastUpdate = Date.now();

    this.trustNetwork.set(nodeKey, metrics);

    console.log(
      `🔍 Trust evaluation for ${nodeId.personality?.name || nodeKey}:`,
    );
    console.log(
      `   Overall Trust: ${(metrics.overallTrust * 100).toFixed(1)}%`,
    );
    console.log(
      `   Byzantine Risk: ${(metrics.byzantineRisk * 100).toFixed(1)}%`,
    );

    return metrics;
  }

  // =====================================================
  // BYZANTINE ATTACK DETECTION
  // =====================================================

  private async detectByzantinePatterns(
    _nodeId: NodeId,
    metrics: DetailedTrustMetrics,
  ): Promise<void> {
    const patterns: ByzantineAttackType[] = [];

    // Detect vote manipulation
    if (
      metrics.history.agreementRate < 0.3 &&
      metrics.history.votesParticipated > 5
    ) {
      patterns.push(ByzantineAttackType.VOTE_MANIPULATION);
    }

    // Detect timing attacks (abnormally fast or slow responses)
    if (
      metrics.history.responseTime < 100 ||
      metrics.history.responseTime > 30000
    ) {
      patterns.push(ByzantineAttackType.TIMING_ATTACK);
    }

    // Detect excessive flip-flopping
    if (metrics.history.flipFlops > 3) {
      patterns.push(ByzantineAttackType.CONSENSUS_DISRUPTION);
    }

    // Detect poor reasoning (potential bot)
    if (
      metrics.reasoningQuality < 0.2 &&
      metrics.history.votesParticipated > 3
    ) {
      patterns.push(ByzantineAttackType.SPAM_PROPOSALS);
    }

    // Update metrics with detected patterns
    metrics.history.suspiciousPatterns = patterns;

    // Generate alerts for significant threats
    if (patterns.length > 0) {
      await this.generateByzantineAlert(_nodeId, patterns, metrics);
    }
  }

  private async generateByzantineAlert(
    nodeId: NodeId,
    attackTypes: ByzantineAttackType[],
    metrics: DetailedTrustMetrics,
  ): Promise<void> {
    const alertId = `alert_${Date.now()}_${nodeId.id}`;

    // Determine threat level
    let threatLevel: ThreatLevel;
    if (metrics.overallTrust < 0.1) threatLevel = ThreatLevel.COMPROMISED;
    else if (metrics.overallTrust < 0.3) threatLevel = ThreatLevel.SUSPICIOUS;
    else threatLevel = ThreatLevel.UNKNOWN;

    // Generate evidence
    const evidence = [
      `Agreement rate: ${(metrics.history.agreementRate * 100).toFixed(1)}%`,
      `Response time: ${metrics.history.responseTime.toFixed(0)}ms`,
      `Flip-flops: ${metrics.history.flipFlops}`,
      `Reasoning quality: ${(metrics.reasoningQuality * 100).toFixed(1)}%`,
    ];

    // Determine suggested action
    let suggestedAction: ByzantineAlert["suggestedAction"];
    if (threatLevel === ThreatLevel.COMPROMISED) suggestedAction = "quarantine";
    else if (threatLevel === ThreatLevel.SUSPICIOUS) suggestedAction = "limit";
    else suggestedAction = "monitor";

    const alert: ByzantineAlert = {
      alertId,
      nodeId,
      threatLevel,
      attackType: attackTypes[0], // Primary attack type
      evidence,
      confidence: this.calculateThreatConfidence(metrics, attackTypes),
      detectionTime: Date.now(),
      suggestedAction,
    };

    this.activeAlerts.set(alertId, alert);

    console.log(`🚨 BYZANTINE ALERT: ${nodeId.personality?.name || nodeId.id}`);
    console.log(`   Threat Level: ${threatLevel}`);
    console.log(`   Attack Types: ${attackTypes.join(", ")}`);
    console.log(`   Confidence: ${(alert.confidence * 100).toFixed(1)}%`);
    console.log(`   Action: ${suggestedAction.toUpperCase()}`);

    this.emit("byzantine_alert", alert);
  }

  // =====================================================
  // QUARANTINE MANAGEMENT
  // =====================================================

  public quarantineNode(nodeId: NodeId, reason: string): void {
    const nodeKey = nodeId.id;
    const metrics = this.trustNetwork.get(nodeKey);

    if (metrics) {
      metrics.overallTrust = 0.0;
      metrics.byzantineRisk = 1.0;
      console.log(
        `🔒 Node ${nodeId.personality?.name || nodeKey} QUARANTINED: ${reason}`,
      );
      this.emit("node_quarantined", { nodeId, reason });
    }
  }

  public isNodeQuarantined(_nodeId: NodeId): boolean {
    const metrics = this.trustNetwork.get(_nodeId.id);
    return metrics ? metrics.overallTrust === 0.0 : false;
  }

  public getVotingWeight(nodeId: NodeId): number {
    const metrics = this.trustNetwork.get(nodeId.id);
    if (!metrics) return 1.0; // New nodes get full weight initially

    // Quarantined nodes get no weight
    if (this.isNodeQuarantined(nodeId)) return 0.0;

    // Suspicious nodes get reduced weight
    if (metrics.overallTrust < this.MIN_TRUST_THRESHOLD) {
      return Math.max(0.1, metrics.overallTrust); // Minimum 10% weight
    }

    return metrics.overallTrust;
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private initializeTrustMetrics(_nodeId: NodeId): DetailedTrustMetrics {
    return {
      nodeId: _nodeId, // Fixed: removed underscore prefix
      overallTrust: 0.8, // Start with high trust, but not perfect
      reliabilityScore: 0.8,
      participationScore: 0.5,
      reasoningQuality: 0.5,
      consensusContribution: 0.5,
      byzantineRisk: 0.1,
      lastUpdate: Date.now(),
      history: {
        votesParticipated: 0,
        agreementRate: 0.5,
        responseTime: 5000,
        reasoningLength: 50,
        flipFlops: 0,
        suspiciousPatterns: [],
      },
    };
  }

  private async updateTrustFromEvents(
    metrics: DetailedTrustMetrics,
    _events: any[],
  ): Promise<DetailedTrustMetrics> {
    for (const event of _events) {
      switch (event.type) {
        case "vote_cast":
          this.updateFromVoteEvent(metrics, event);
          break;
        case "consensus_reached":
          this.updateFromConsensusEvent(metrics, event);
          break;
        case "timing_event":
          this.updateFromTimingEvent(metrics, event);
          break;
        default:
          break;
      }
    }

    return metrics;
  }

  private updateFromVoteEvent(metrics: DetailedTrustMetrics, event: any): void {
    metrics.history.votesParticipated++;

    // Update reasoning quality
    if (event.reasoning) {
      const reasoningScore = Math.min(1.0, event.reasoning.length / 100);
      metrics.reasoningQuality =
        metrics.reasoningQuality * 0.9 + reasoningScore * 0.1;
    }

    // Track response time
    if (event.responseTime) {
      metrics.history.responseTime =
        metrics.history.responseTime * 0.9 + event.responseTime * 0.1;
    }

    // Update participation score
    metrics.participationScore = Math.min(
      1.0,
      metrics.participationScore + 0.05,
    );
  }

  private updateFromConsensusEvent(
    metrics: DetailedTrustMetrics,
    event: any,
  ): void {
    // Update agreement rate
    if (event.agreedWithMajority !== undefined) {
      const newAgreement = event.agreedWithMajority ? 1.0 : 0.0;
      metrics.history.agreementRate =
        metrics.history.agreementRate * 0.95 + newAgreement * 0.05;
    }

    // Update consensus contribution
    if (event.helpedConsensus) {
      metrics.consensusContribution = Math.min(
        1.0,
        metrics.consensusContribution + 0.1,
      );
    }
  }

  private updateFromTimingEvent(
    metrics: DetailedTrustMetrics,
    _event: any,
  ): void {
    if (_event.suspiciousTiming) {
      metrics.byzantineRisk = Math.min(1.0, metrics.byzantineRisk + 0.1);
    }
  }

  private calculateCompositeTrust(metrics: DetailedTrustMetrics): number {
    // Weighted average of all trust factors
    const weights = {
      reliability: 0.25,
      participation: 0.15,
      reasoning: 0.2,
      consensus: 0.25,
      byzantine: -0.15, // Negative weight for risk
    };

    const score =
      metrics.reliabilityScore * weights.reliability +
      metrics.participationScore * weights.participation +
      metrics.reasoningQuality * weights.reasoning +
      metrics.consensusContribution * weights.consensus +
      metrics.byzantineRisk * weights.byzantine;

    return Math.max(0.0, Math.min(1.0, score));
  }

  private calculateThreatConfidence(
    metrics: DetailedTrustMetrics,
    _attackTypes: ByzantineAttackType[],
  ): number {
    let confidence = 0.0;

    // More attack types = higher confidence
    confidence += _attackTypes.length * 0.2;

    // Lower trust = higher confidence in threat
    confidence += (1.0 - metrics.overallTrust) * 0.5;

    // More history = higher confidence
    if (metrics.history.votesParticipated > 5) {
      confidence += 0.3;
    }

    return Math.min(1.0, confidence);
  }

  private startTrustDecayLoop(): void {
    setInterval(() => {
      this.decayAllTrustScores();
    }, 30000); // Every 30 seconds
  }

  private decayAllTrustScores(): void {
    for (const [nodeKey, metrics] of this.trustNetwork) {
      // Slowly decay trust over time (encourages ongoing good behavior)
      metrics.overallTrust *= this.TRUST_DECAY_RATE;
      metrics.reliabilityScore *= this.TRUST_DECAY_RATE;
      metrics.participationScore *= this.TRUST_DECAY_RATE;

      // Also decay Byzantine risk (forgiveness mechanism)
      metrics.byzantineRisk *= 0.98;
    }
  }

  // =====================================================
  // PUBLIC GETTERS
  // =====================================================

  public getTrustMetrics(_nodeId: NodeId): DetailedTrustMetrics | undefined {
    return this.trustNetwork.get(_nodeId.id);
  }

  public getAllTrustMetrics(): DetailedTrustMetrics[] {
    return Array.from(this.trustNetwork.values());
  }

  public getActiveAlerts(): ByzantineAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  public getSwarmHealthReport(): {
    totalNodes: number;
    trustedNodes: number;
    suspiciousNodes: number;
    quarantinedNodes: number;
    averageTrust: number;
    byzantineResistance: number;
  } {
    const allMetrics = this.getAllTrustMetrics();

    if (allMetrics.length === 0) {
      return {
        totalNodes: 0,
        trustedNodes: 0,
        suspiciousNodes: 0,
        quarantinedNodes: 0,
        averageTrust: 0,
        byzantineResistance: 0,
      };
    }

    const trusted = allMetrics.filter((_m) => _m.overallTrust >= 0.7).length;
    const suspicious = allMetrics.filter(
      (m) => m.overallTrust < 0.3 && m.overallTrust > 0.0,
    ).length;
    const quarantined = allMetrics.filter((_m) => _m.overallTrust === 0.0).length;
    const averageTrust =
      allMetrics.reduce((_sum, _m) => _sum + _m.overallTrust, 0) /
      allMetrics.length;

    // Byzantine resistance = ability to tolerate malicious nodes
    const maliciousNodes = suspicious + quarantined;
    const byzantineResistance = Math.max(
      0,
      1 - maliciousNodes / (allMetrics.length * this.MAX_BYZANTINE_NODES),
    );

    return {
      totalNodes: allMetrics.length,
      trustedNodes: trusted,
      suspiciousNodes: suspicious,
      quarantinedNodes: quarantined,
      averageTrust,
      byzantineResistance,
    };
  }

  public async sleep(): Promise<void> {
    // Clear all alerts
    this.activeAlerts.clear();

    console.log(`💤 Byzantine Guardian for ${this.nodeId.id} going to sleep`);
  }
}

export default ByzantineGuardian;


