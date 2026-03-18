/**
 * 🔧 SELENE DEBUG CONFIGURATION
 * Centralized debug flags for conditional logging
 */
type DebugLevel = keyof typeof DEBUG_CONFIG;
export declare const DEBUG_CONFIG: {
    CORE_STARTUP: boolean;
    CORE_HEALTH: boolean;
    CORE_MEMORY: boolean;
    HEALING_ACTIONS: boolean;
    HEALING_DIAGNOSTICS: boolean;
    HEALING_MEMORY: boolean;
    EMERGENCY: boolean;
    PERFORMANCE: boolean;
    TIMEOUTS: boolean;
    VERBOSE: boolean;
    TRACE: boolean;
};
/**
 * Debug logger with conditional output
 */
export declare class DebugLogger {
    static log(level: DebugLevel, message: string, ...args: any[]): void;
    static error(level: DebugLevel, message: string, ...args: any[]): void;
    static warn(level: DebugLevel, message: string, ...args: any[]): void;
}
export {};
//# sourceMappingURL=DebugConfig.d.ts.map