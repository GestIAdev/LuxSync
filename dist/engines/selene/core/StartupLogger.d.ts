/**
 * 🎯 DIRECTIVA V165 - APOLLO STARTUP LOG MANAGER
 * 🔥 Clean, Professional, Informative Startup Logging
 *
 * By PunkGrok - September 28, 2025
 */
export declare class SeleneStartupLogger {
    private static instance;
    private components;
    private startTime;
    private isVerbose;
    private constructor();
    static getInstance(): SeleneStartupLogger;
    /**
     * 🎯 Register component initialization
     */
    registerComponent(name: string, status: "starting" | "ready" | "failed", details?: string): void;
    /**
     * 🔥 Show startup banner
     */
    showStartupBanner(): void;
    /**
     * ✅ Show completion summary
     */
    showStartupSummary(port: number): void;
    /**
     * 🔧 Show detailed component status (verbose mode)
     */
    private showDetailedStatus;
    /**
     * 🎯 Log individual component
     */
    private logComponent;
    /**
     * 🔍 Check if component is critical for summary
     */
    private isCriticalComponent;
    /**
     * ⚠️ Show error summary
     */
    showErrors(): void;
}
export declare const startupLogger: SeleneStartupLogger;
//# sourceMappingURL=StartupLogger.d.ts.map