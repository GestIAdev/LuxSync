/**
 * ⏱️ TIMEOUT WRAPPER - Control de timeouts con tracking de operaciones
 * Fase 0: Wrapper reutilizable para operaciones con timeout
 *
 * Características: Correlation IDs, Cleanup automático, Métricas
 * Forged by PunkClaude + Claude 4.5
 */
export interface TimeoutConfig {
    defaultTimeoutMs: number;
    maxConcurrentOperations: number;
    cleanupIntervalMs: number;
    name: string;
}
export interface TimeoutResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    executionTime: number;
    timedOut: boolean;
    correlationId: string;
}
export interface ActiveOperation {
    correlationId: string;
    operationName: string;
    startTime: Date;
    timeout: NodeJS.Timeout;
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}
/**
 * ⏱️ Timeout Wrapper con gestión avanzada de operaciones
 */
export declare class TimeoutWrapper {
    private config;
    private activeOperations;
    private operationMetrics;
    private cleanupInterval?;
    constructor(configOrTimeout?: TimeoutConfig | number);
    /**
     * 🚀 Execute operation with timeout protection
     */
    execute<T>(operation: () => Promise<T>, timeoutMs?: number, operationName?: string, correlationId?: string): Promise<TimeoutResult<T>>;
    /**
     * 🛑 Cancel operation by correlation ID
     */
    cancelOperation(correlationId: string): boolean;
    /**
     * 📊 Get active operations
     */
    getActiveOperations(): ActiveOperationInfo[];
    /**
     * 📈 Get operation metrics
     */
    getMetrics(operationName?: string): OperationMetrics | Map<string, OperationMetrics>;
    /**
     * 🧹 Cleanup resources
     */
    cleanup(): void;
    private generateCorrelationId;
    private startCleanupInterval;
    private performCleanup;
    private recordSuccess;
    private recordFailure;
    private recordTimeout;
    private recordCancellation;
    private updateMetrics;
    private createEmptyMetrics;
}
/**
 * 📊 Operation Metrics Interface
 */
export interface OperationMetrics {
    operationName: string;
    totalOperations: number;
    successCount: number;
    failureCount: number;
    timeoutCount: number;
    cancelledCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    lastUpdated: Date;
}
/**
 * ℹ️ Active Operation Info (without internal handles)
 */
export interface ActiveOperationInfo {
    correlationId: string;
    operationName: string;
    startTime: Date;
    elapsedMs: number;
}
/**
 * 🏭 Timeout Wrapper Factory
 */
export declare class TimeoutWrapperFactory {
    private static defaultConfig;
    /**
     * 🛠️ Create timeout wrapper with custom config
     */
    static create(config: TimeoutConfig): TimeoutWrapper;
    /**
     * ⚡ Create timeout wrapper with defaults
     */
    static createDefault(name: string): TimeoutWrapper;
    /**
     * 🔧 Create timeout wrapper for engine operations
     */
    static createForEngine(engineId: string): TimeoutWrapper;
    /**
     * 🌐 Create timeout wrapper for orchestration
     */
    static createForOrchestration(orchestratorId: string): TimeoutWrapper;
}
//# sourceMappingURL=TimeoutWrapper.d.ts.map