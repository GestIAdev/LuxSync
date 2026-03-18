/**
 * 🔧 TIMER MANAGER V195
 * Directiva V195: Gestión de Ciclo de Vida - Fase 2
 *
 * PROPÓSITO: Sistema global para gestionar timers (setInterval, setTimeout)
 * y prevenir memory leaks por timers no limpiados.
 */
import { deterministicRandom } from "./deterministic-utils.js";
/**
 * Manager centralizado para timers con tracking y limpieza automática
 */
export class TimerManager {
    static instance;
    timers = new Map();
    nativeTimers = new Map();
    stats = {
        totalCreated: 0,
        totalCleared: 0,
    };
    constructor() {
        // Cleanup on process exit
        process.on("SIGINT", () => this.clearAll());
        process.on("SIGTERM", () => this.clearAll());
    }
    static getInstance() {
        if (!TimerManager.instance) {
            TimerManager.instance = new TimerManager();
        }
        return TimerManager.instance;
    }
    /**
     * Crea un setInterval gestionado
     */
    setInterval(callback, delay, _id) {
        const timerId = _id || `interval_${Date.now()}_${deterministicRandom()}`;
        const nativeId = setInterval(callback, delay);
        const timerRef = {
            id: timerId,
            type: "interval",
            callback,
            delay,
            created: Date.now(),
            cleared: false,
        };
        this.timers.set(timerId, timerRef);
        this.nativeTimers.set(timerId, nativeId);
        this.stats.totalCreated++;
        return timerId;
    }
    /**
     * Crea un setTimeout gestionado
     */
    setTimeout(callback, delay, _id) {
        const timerId = _id || `timeout_${Date.now()}_${deterministicRandom()}`;
        const nativeId = setTimeout(() => {
            this.clear(timerId); // Auto-clear on execution
            callback();
        }, delay);
        const timerRef = {
            id: timerId,
            type: "timeout",
            callback,
            delay,
            created: Date.now(),
            cleared: false,
        };
        this.timers.set(timerId, timerRef);
        this.nativeTimers.set(timerId, nativeId);
        this.stats.totalCreated++;
        return timerId;
    }
    /**
     * Limpia un timer específico
     */
    clear(timerId) {
        const timerRef = this.timers.get(timerId);
        if (!timerRef || timerRef.cleared)
            return false;
        const nativeId = this.nativeTimers.get(timerId);
        if (nativeId) {
            if (timerRef.type === "interval") {
                clearInterval(nativeId);
            }
            else {
                clearTimeout(nativeId);
            }
        }
        timerRef.cleared = true;
        this.stats.totalCleared++;
        return true;
    }
    /**
     * Limpia todos los timers activos
     */
    clearAll() {
        this.timers.forEach((_, _id) => {
            this.clear(_id);
        });
    }
    /**
     * Obtiene estadísticas de timers
     */
    getStats() {
        const activeTimers = Array.from(this.timers.values()).filter((_t) => !_t.cleared);
        const oldest = activeTimers.length > 0
            ? Math.min(...activeTimers.map((_t) => _t.created))
            : null;
        const newest = activeTimers.length > 0
            ? Math.max(...activeTimers.map((_t) => _t.created))
            : null;
        return {
            totalTimers: this.stats.totalCreated,
            activeTimers: activeTimers.length,
            clearedTimers: this.stats.totalCleared,
            oldestTimer: oldest,
            newestTimer: newest,
        };
    }
    /**
     * Lista todos los timers activos
     */
    listActive() {
        return Array.from(this.timers.values()).filter((_t) => !_t.cleared);
    }
}
// Export singleton
export const timerManager = TimerManager.getInstance();
//# sourceMappingURL=TimerManager.js.map