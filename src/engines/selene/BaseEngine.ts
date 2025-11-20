// 🔧 BASE ENGINE - Interfaz base para todos los engines Selene
// Used by MusicalConsensusRecorder y otros módulos

export interface EngineInput {
  data: any;
  timestamp?: number;
  context?: any;
}

export interface EngineOutput {
  result: any;
  timestamp: number;
  metadata?: any;
}

export interface EngineStatus {
  running: boolean;
  healthy: boolean;
  lastUpdate: number;
  errors: number;
}

export interface RateLimits {
  maxPerSecond?: number;
  maxPerMinute?: number;
  burstSize?: number;
}

export interface UsageMetrics {
  totalExecutions: number;
  averageLatency: number;
  errorCount: number;
  lastExecution: number;
}

export abstract class BaseEngine {
  protected status: EngineStatus = {
    running: false,
    healthy: true,
    lastUpdate: Date.now(),
    errors: 0,
  };

  protected metrics: UsageMetrics = {
    totalExecutions: 0,
    averageLatency: 0,
    errorCount: 0,
    lastExecution: 0,
  };

  protected rateLimits: RateLimits = {};

  abstract execute(input: EngineInput): Promise<EngineOutput>;

  getStatus(): EngineStatus {
    return { ...this.status };
  }

  getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  setRateLimits(limits: RateLimits): void {
    this.rateLimits = limits;
  }

  start(): void {
    this.status.running = true;
  }

  stop(): void {
    this.status.running = false;
  }

  reset(): void {
    this.metrics = {
      totalExecutions: 0,
      averageLatency: 0,
      errorCount: 0,
      lastExecution: 0,
    };
  }
}
