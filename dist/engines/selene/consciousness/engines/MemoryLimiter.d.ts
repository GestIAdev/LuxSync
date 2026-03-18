/**
 * 🧠 MEMORY LIMITER - Safety System del Apoyo Supremo
 * "Si usas demasiada memoria, para y pide ayuda"
 */
interface MemoryLimiterConfig {
    maxMemoryMB: number;
    warningThresholdMB: number;
    name: string;
}
interface MemoryCheckResult {
    status: 'ok' | 'warning' | 'critical';
    usage: number;
    limit: number;
    available: number;
}
export declare class MemoryLimiter {
    private config;
    constructor(configOrLimit?: MemoryLimiterConfig | number);
    checkMemory(): MemoryCheckResult;
    getMemoryStats(): {
        used: number;
        limit: number;
        available: number;
        percentage: number;
    };
}
export {};
//# sourceMappingURL=MemoryLimiter.d.ts.map