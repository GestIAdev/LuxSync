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
export declare abstract class BaseEngine {
    protected status: EngineStatus;
    protected metrics: UsageMetrics;
    protected rateLimits: RateLimits;
    abstract execute(input: EngineInput): Promise<EngineOutput>;
    getStatus(): EngineStatus;
    getMetrics(): UsageMetrics;
    setRateLimits(limits: RateLimits): void;
    start(): void;
    stop(): void;
    reset(): void;
}
//# sourceMappingURL=BaseEngine.d.ts.map