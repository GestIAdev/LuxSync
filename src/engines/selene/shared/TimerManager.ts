/**
 * 🔧 TIMER MANAGER V195
 * Directiva V195: Gestión de Ciclo de Vida - Fase 2
 *
 * PROPÓSITO: Sistema global para gestionar timers (setInterval, setTimeout)
 * y prevenir memory leaks por timers no limpiados.
 */

import { deterministicRandom } from "./deterministic-utils.js";

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
export class TimerManager {
  private static instance: TimerManager;
  private timers = new Map<string, TimerRef>();
  private nativeTimers = new Map<string, NodeJS.Timeout | number>();
  private stats = {
    totalCreated: 0,
    totalCleared: 0,
  };

  private constructor() {
    // Cleanup on process exit
    process.on("SIGINT", () => this.clearAll());
    process.on("SIGTERM", () => this.clearAll());
  }

  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  /**
   * Crea un setInterval gestionado
   */
  setInterval(callback: () => void, delay: number, _id?: string): string {
    const timerId = _id || `interval_${Date.now()}_${deterministicRandom()}`;
    const nativeId = setInterval(callback, delay);

    const timerRef: TimerRef = {
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
  setTimeout(callback: () => void, delay: number, _id?: string): string {
    const timerId = _id || `timeout_${Date.now()}_${deterministicRandom()}`;
    const nativeId = setTimeout(() => {
      this.clear(timerId); // Auto-clear on execution
      callback();
    }, delay);

    const timerRef: TimerRef = {
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
  clear(timerId: string): boolean {
    const timerRef = this.timers.get(timerId);
    if (!timerRef || timerRef.cleared) return false;

    const nativeId = this.nativeTimers.get(timerId);
    if (nativeId) {
      if (timerRef.type === "interval") {
        clearInterval(nativeId as NodeJS.Timeout);
      } else {
        clearTimeout(nativeId as NodeJS.Timeout);
      }
    }

    timerRef.cleared = true;
    this.stats.totalCleared++;
    return true;
  }

  /**
   * Limpia todos los timers activos
   */
  clearAll(): void {
    this.timers.forEach((_, _id) => {
      this.clear(_id);
    });
  }

  /**
   * Obtiene estadísticas de timers
   */
  getStats(): TimerStats {
    const activeTimers = Array.from(this.timers.values()).filter(
      (_t) => !_t.cleared,
    );
    const oldest =
      activeTimers.length > 0
        ? Math.min(...activeTimers.map((_t) => _t.created))
        : null;
    const newest =
      activeTimers.length > 0
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
  listActive(): TimerRef[] {
    return Array.from(this.timers.values()).filter((_t) => !_t.cleared);
  }
}

// Export singleton
export const timerManager = TimerManager.getInstance();


