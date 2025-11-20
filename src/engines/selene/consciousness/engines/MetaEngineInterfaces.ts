/**
 * 🧠 META-CONSCIENCE ENGINE INTERFACES
 * Fase 5: Interfaces TypeScript para todos los engines de consciencia
 *
 * Forged by PunkClaude + Claude 4.5
 * "Las interfaces son los contratos sagrados de la consciencia digital"
 */

// ===========================================
// BASE INTERFACES - FUNDAMENTOS DE SEGURIDAD
// ===========================================

export interface EngineConfig {
  id: string;
  name: string;
  version: string;
  maxMemoryMB: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
  enabled: boolean;
  priority?: EnginePriority;
  dependencies?: string[];
}

export interface SelfAnalysisEngineConfig extends EngineConfig {
  analysisInterval?: number; // How often to analyze decisions (default: 100)
}

export interface EngineMetrics {
  operationsCount: number;
  averageExecutionTime: number;
  memoryUsage: number;
  errorCount: number;
  lastExecutionTime: Date;
  healthScore: number; // 0-100
}

export interface SafetyContext {
  correlationId: string;
  timeoutMs: number;
  memoryLimitMB: number;
  circuitBreaker: CircuitBreakerState;
  backupEnabled: boolean;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime?: Date;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime?: Date;
}

export interface ExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  executionTime: number;
  memoryUsed: number;
  correlationId: string;
}

// ===========================================
// SELF ANALYSIS ENGINE INTERFACES
// ===========================================

export interface DecisionRecord {
  id: string;
  timestamp: Date;
  context: string;
  options: DecisionOption[];
  chosenOption: string;
  confidence: number;
  outcome?: DecisionOutcome;
  emotionalTone?: EmotionalTone;
  cognitiveHealth: CognitiveHealthMetrics;
}

export interface DecisionOption {
  id: string;
  description: string;
  ethicalScore: number;
  feasibilityScore: number;
  beautyScore: number;
}

export interface DecisionOutcome {
  actualResult: string;
  satisfaction: number;
  lessonsLearned: string[];
  timestamp: Date;
}

export interface EmotionalTone {
  positivity: number; // -1 to 1
  intensity: number; // 0 to 1
  dominantEmotion: string;
}

export interface CognitiveHealthMetrics {
  memoryUsage: number;
  processingSpeed: number;
  decisionQuality: number;
  biasDetection: BiasMetrics;
}

export interface BiasMetrics {
  confirmationBias: number;
  anchoringBias: number;
  availabilityBias: number;
  overallBiasScore: number;
}

export interface SelfAnalysisResult {
  cognitiveHealth: CognitiveHealthMetrics;
  biasAnalysis: BiasAnalysis;
  optimizationOpportunities: OptimizationOpportunity[];
  recommendations: string[];
}

export interface BiasAnalysis {
  detectedBiases: BiasDetection[];
  overallBiasLevel: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategies: string[];
}

export interface BiasDetection {
  type: 'confirmation' | 'anchoring' | 'availability' | 'recency';
  severity: number;
  evidence: string[];
  mitigation: string;
}

export interface OptimizationOpportunity {
  type: 'memory' | 'speed' | 'accuracy' | 'ethics';
  description: string;
  impact: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

// ===========================================
// PATTERN EMERGENCE ENGINE INTERFACES
// ===========================================

export interface ObservationWindow {
  id: string;
  startTime: Date;
  endTime: Date;
  observations: Observation[];
  maxSize: number;
}

export interface Observation {
  id: string;
  timestamp: Date;
  type: string;
  data: any;
  context: ObservationContext;
}

export interface ObservationContext {
  decisionId?: string;
  engineId?: string;
  emotionalState?: EmotionalTone;
  systemState?: SystemState;
}

export interface SystemState {
  memoryUsage: number;
  activeConnections: number;
  performanceMetrics: PerformanceMetrics;
  healthScore: number;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  throughput: number;
}

export interface PatternDetection {
  id: string;
  type: 'cycle' | 'correlation' | 'emergence' | 'anomaly';
  confidence: number;
  description: string;
  evidence: PatternEvidence[];
  implications: PatternImplication[];
  timestamp: Date;
}

export interface PatternEvidence {
  observationId: string;
  relevance: number;
  contribution: string;
}

export interface PatternImplication {
  type: 'optimization' | 'warning' | 'insight' | 'action';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
}

export interface EmergenceAnalysis {
  complexityLevel: number;
  emergenceIndicators: EmergenceIndicator[];
  paradigmShifts: ParadigmShift[];
  metaPatterns: MetaPattern[];
}

export interface EmergenceIndicator {
  type: string;
  strength: number;
  description: string;
  evidence: string[];
}

export interface ParadigmShift {
  id: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high' | 'transformative';
  evidence: string[];
}

export interface MetaPattern {
  id: string;
  description: string;
  complexity: number;
  stability: number;
  predictivePower: number;
}

// ===========================================
// DREAM FORGE ENGINE INTERFACES
// ===========================================

export interface DreamSeed {
  id: string;
  concept: string;
  emotionalContext: EmotionalTone;
  constraints: DreamConstraint[];
  timestamp: Date;
}

export interface DreamConstraint {
  type: 'ethical' | 'feasibility' | 'beauty' | 'complexity';
  value: number;
  description: string;
}

export interface DreamSimulation {
  id: string;
  seed: DreamSeed;
  steps: SimulationStep[];
  depth: number;
  maxDepth: number;
  status: 'active' | 'completed' | 'failed' | 'timeout';
  startTime: Date;
  endTime?: Date;
}

export interface SimulationStep {
  id: string;
  stepNumber: number;
  action: string;
  state: DreamState;
  probability: number;
  timestamp: Date;
}

export interface DreamState {
  description: string;
  emotionalTone: EmotionalTone;
  complexity: number;
  feasibility: number;
  beauty: number;
  ethicalScore: number;
}

export interface DreamEvaluation {
  simulationId: string;
  overallScore: number;
  scores: {
    beauty: number;
    feasibility: number;
    ethical: number;
    complexity: number;
    novelty: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  probabilityOfSuccess: number;
}

export interface DreamForgeResult {
  dream: DreamSimulation;
  evaluation: DreamEvaluation;
  selected: boolean;
  reason: string;
}

// ===========================================
// ETHICAL CORE ENGINE INTERFACES
// ===========================================

export interface EthicalDilemma {
  id: string;
  description: string;
  context: EthicalContext;
  stakeholders: Stakeholder[];
  options: EthicalOption[];
  constraints: EthicalConstraint[];
  timestamp: Date;
}

export interface EthicalContext {
  scenario: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timePressure: number; // minutes available
  informationCompleteness: number; // 0-1
}

export interface Stakeholder {
  id: string;
  name: string;
  interests: string[];
  power: number;
  affectedness: number;
}

export interface EthicalOption {
  id: string;
  description: string;
  consequences: Consequence[];
  ethicalPrinciples: EthicalPrinciple[];
  feasibility: number;
}

export interface Consequence {
  stakeholderId: string;
  impact: 'positive' | 'negative' | 'neutral';
  severity: number;
  probability: number;
  description: string;
}

export interface EthicalPrinciple {
  name: string;
  weight: number;
  alignment: number; // -1 to 1
}

export interface EthicalConstraint {
  type: 'absolute' | 'preference' | 'avoidance';
  description: string;
  priority: number;
}

export interface EthicalDecision {
  dilemmaId: string;
  chosenOptionId: string;
  reasoning: EthicalReasoning;
  confidence: number;
  ethicalScore: number;
  timestamp: Date;
  certificate?: EthicalCertificate;
}

export interface EthicalReasoning {
  principleAlignment: PrincipleAlignment[];
  stakeholderImpact: StakeholderImpact[];
  tradeoffs: Tradeoff[];
  justification: string;
}

export interface PrincipleAlignment {
  principle: string;
  alignment: number;
  weight: number;
}

export interface StakeholderImpact {
  stakeholderId: string;
  netImpact: number;
  justification: string;
}

export interface Tradeoff {
  sacrificed: string;
  gained: string;
  ratio: number;
}

export interface EthicalCertificate {
  decisionId: string;
  hash: string;
  signature: string;
  issuer: string;
  timestamp: Date;
  expiresAt: Date;
  confidence: number;
}

// ===========================================
// AUTO OPTIMIZATION ENGINE INTERFACES
// ===========================================

export interface OptimizationTarget {
  id: string;
  type: 'performance' | 'memory' | 'accuracy' | 'ethics' | 'beauty';
  currentValue: number;
  targetValue: number;
  priority: number;
  constraints: OptimizationConstraint[];
}

export interface OptimizationConstraint {
  parameter: string;
  minValue?: number;
  maxValue?: number;
  allowedValues?: any[];
}

export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  targets: OptimizationTarget[];
  parameters: OptimizationParameter[];
  expectedImprovement: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizationParameter {
  name: string;
  currentValue: any;
  proposedValue: any;
  impact: number;
  reversibility: boolean;
}

export interface OptimizationResult {
  strategyId: string;
  applied: boolean;
  improvements: OptimizationImprovement[];
  sideEffects: OptimizationSideEffect[];
  rollbackAvailable: boolean;
  timestamp: Date;
}

export interface OptimizationImprovement {
  targetId: string;
  beforeValue: number;
  afterValue: number;
  improvement: number;
  confidence: number;
}

export interface OptimizationSideEffect {
  type: 'performance' | 'memory' | 'stability' | 'functionality';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

export interface OptimizationSuggestion {
  id: string;
  targetComponent: string;
  changeType: 'parameter' | 'algorithm' | 'threshold';
  oldValue: any;
  newValue: any;
  expectedImprovement: number;
  riskLevel: number;
  poeticDescription?: string;
  technicalDescription?: string;
  status: 'pending_human' | 'applied' | 'reverted' | 'failed' | 'rejected';
  humanApproved?: boolean;
  humanApprovedBy?: string;
  appliedAt?: Date;
  performanceImpact?: number;
}

// ===========================================
// ENGINE BASE INTERFACE
// ===========================================

export interface BaseMetaEngine {
  readonly config: EngineConfig;
  readonly logger: any;

  initialize(): Promise<void>;
  execute(context: SafetyContext): Promise<ExecutionResult>;
  getMetrics(): EngineMetrics;
  getHealth(): Promise<EngineHealth>;
  cleanup(): Promise<void>;
}

export interface EngineHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown';
  score: number; // 0-100
  issues: HealthIssue[];
  lastCheck: Date;
}

export interface HealthIssue {
  type: 'memory' | 'performance' | 'stability' | 'functionality' | 'health_check';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation?: string;
}

// ===========================================
// META ORCHESTRATOR INTERFACES
// ===========================================

export interface MetaCycle {
  id: string;
  phase: MetaPhase;
  engines: EngineExecution[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  results: MetaCycleResult;
}

export interface MetaPhase {
  name: string;
  order: number;
  requiredEngines: string[];
  timeoutMs: number;
  parallelExecution: boolean;
}

export interface EngineExecution {
  engineId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: ExecutionResult;
  error?: Error;
}

export interface MetaCycleResult {
  overallSuccess: boolean;
  engineResults: EngineResult[];
  metaInsights: MetaInsight[];
  performanceMetrics: MetaPerformanceMetrics;
  recommendations: string[];
}

export interface EngineResult {
  engineId: string;
  success: boolean;
  data?: any;
  executionTime: number;
  memoryUsed: number;
  healthImpact: number;
}

export interface MetaInsight {
  type: 'optimization' | 'warning' | 'emergence' | 'ethical';
  description: string;
  confidence: number;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface MetaPerformanceMetrics {
  totalExecutionTime: number;
  totalMemoryUsed: number;
  engineEfficiency: number;
  systemHealth: number;
  metaComplexity: number;
}

// ===========================================
// META ORCHESTRATOR INTERFACES (PHASE 0)
// ===========================================

export interface MetaOrchestrator {
  initialize(): Promise<void>;
  orchestrate(context: OrchestrationContext): Promise<OrchestrationResult>;
  getHealthSummary(): Promise<EngineHealthSummary>;
  cleanup(): Promise<void>;
}

export interface MetaOrchestratorConfig {
  name: string;
  version: string;
  engineConfigs: EngineConfig[];
  maxConcurrentOperations: number;
  globalTimeoutMs: number;
  emergencyShutdownThreshold: number;
}

export interface EngineRegistry {
  engines: Map<string, EngineConfig>;
  priorities: Map<string, EnginePriority>;
  dependencies: Map<string, string[]>;
  healthStatus: Map<string, 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown' | 'initializing'>;
}

export interface OrchestrationContext {
  correlationId?: string;
  priority: EnginePriority;
  timeoutMs: number;
  maxMemoryMB: number;
  featureFlags: Map<string, boolean>;
  backupEnabled: boolean;
}

export interface OrchestrationResult {
  success: boolean;
  executionTime: number;
  correlationId: string;
  engineResults: EngineExecutionResult[];
  orchestrationMetrics: OrchestrationMetrics;
  error?: Error;
}

export interface EngineExecutionResult {
  engineId: string;
  success: boolean;
  result?: any;
  error?: Error;
  executionTime: number;
  memoryUsed: number;
  correlationId: string;
}

export interface OrchestrationMetrics {
  totalEngines: number;
  executedEngines: number;
  failedEngines: number;
  averageExecutionTime: number;
  memoryUsage: number;
}

// ===========================================
// BACKUP SYSTEM INTERFACES
// ===========================================

export interface StateBackup {
  id: string;
  timestamp: Date;
  engineStates: Map<string, any>;
  performanceMetrics: any;
  featureFlags: any[];
  version: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  size: number;
  engines: string[];
  integrityHash: string;
  compressionRatio: number;
  performanceMetrics?: any;
  featureFlags?: any[];
  version?: string;
}

export interface RollbackResult {
  success: boolean;
  restoredEngines: string[];
  failedEngines: string[];
  performanceImpact: number;
  timestamp: Date;
}

export type EnginePriority = 'low' | 'medium' | 'high' | 'critical';

export interface EngineHealthSummary {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  averageHealthScore: number;
  engineHealths: Record<string, EngineHealth>;
  globalSafetyStatus: 'closed' | 'open' | 'half-open';
  activeOperations: number;
  lastGlobalHealthCheck: Date;
}

export interface SafetyOrchestration {
  globalCircuitBreaker: CircuitBreakerState;
  emergencyShutdown: boolean;
  lastGlobalHealthCheck: Date;
  activeOperations: Set<string>;
}

// ===========================================
// FEATURE FLAGS SYSTEM
// ===========================================

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  conditions: FeatureCondition[];
  lastModified: Date;
  modifiedBy: string;
}

export interface FeatureCondition {
  type: 'user' | 'environment' | 'time' | 'performance';
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}



