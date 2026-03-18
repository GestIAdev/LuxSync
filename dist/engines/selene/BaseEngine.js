// 🔧 BASE ENGINE - Interfaz base para todos los engines Selene
// Used by MusicalConsensusRecorder y otros módulos
export class BaseEngine {
    status = {
        running: false,
        healthy: true,
        lastUpdate: Date.now(),
        errors: 0,
    };
    metrics = {
        totalExecutions: 0,
        averageLatency: 0,
        errorCount: 0,
        lastExecution: 0,
    };
    rateLimits = {};
    getStatus() {
        return { ...this.status };
    }
    getMetrics() {
        return { ...this.metrics };
    }
    setRateLimits(limits) {
        this.rateLimits = limits;
    }
    start() {
        this.status.running = true;
    }
    stop() {
        this.status.running = false;
    }
    reset() {
        this.metrics = {
            totalExecutions: 0,
            averageLatency: 0,
            errorCount: 0,
            lastExecution: 0,
        };
    }
}
//# sourceMappingURL=BaseEngine.js.map