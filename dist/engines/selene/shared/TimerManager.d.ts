/**
 * 🔧 TIMER MANAGER V195
 * Directiva V195: Gestión de Ciclo de Vida - Fase 2
 *
 * PROPÓSITO: Sistema global para gestionar timers (setInterval, setTimeout)
 * y prevenir memory leaks por timers no limpiados.
 */
export interface TimerRef {
    id: string;
    type: "interval" | "timeout";
    callback: () => void;
    delay: number;
    created: number;
    cleared: boolean;
}
export interface TimerStats {
    totalTimers: number;
    activeTimers: number;
    clearedTimers: number;
    oldestTimer: number | null;
    newestTimer: number | null;
}
/**
 * Manager centralizado para timers con tracking y limpieza automática
 */
export declare class TimerManager {
    private static instance;
    private timers;
    private nativeTimers;
    private stats;
    private constructor();
    static getInstance(): TimerManager;
    /**
     * Crea un setInterval gestionado
     */
    setInterval(callback: () => void, delay: number, _id?: string): string;
    /**
     * Crea un setTimeout gestionado
     */
    setTimeout(callback: () => void, delay: number, _id?: string): string;
    /**
     * Limpia un timer específico
     */
    clear(timerId: string): boolean;
    /**
     * Limpia todos los timers activos
     */
    clearAll(): void;
    /**
     * Obtiene estadísticas de timers
     */
    getStats(): TimerStats;
    /**
     * Lista todos los timers activos
     */
    listActive(): TimerRef[];
}
export declare const timerManager: TimerManager;
//# sourceMappingURL=TimerManager.d.ts.map