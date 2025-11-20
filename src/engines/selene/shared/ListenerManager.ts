/**
 * 🔧 LISTENER MANAGER V195
 * Directiva V195: Gestión de Ciclo de Vida - Fase 2
 *
 * PROPÓSITO: Sistema global para gestionar event listeners
 * y prevenir memory leaks por listeners no removidos.
 */

import { deterministicRandom } from "./deterministic-utils.js";


export interface ListenerRef {
  id: string;
  emitter: any;
  event: string;
  listener: Function;
  once: boolean;
  created: number;
  removed: boolean;
}

export interface ListenerStats {
  totalListeners: number;
  activeListeners: number;
  removedListeners: number;
  oldestListener: number | null;
  newestListener: number | null;
}

/**
 * Manager centralizado para event listeners con tracking y limpieza automática
 */
export class ListenerManager {
  private static instance: ListenerManager;
  private listeners = new Map<string, ListenerRef>();
  private stats = {
    totalCreated: 0,
    totalRemoved: 0,
  };

  private constructor() {
    // Cleanup on process exit
    process.on("SIGINT", () => this.removeAll());
    process.on("SIGTERM", () => this.removeAll());
  }

  static getInstance(): ListenerManager {
    if (!ListenerManager.instance) {
      ListenerManager.instance = new ListenerManager();
    }
    return ListenerManager.instance;
  }

  /**
   * Agrega un listener gestionado
   */
  addListener(
    emitter: any,
    event: string,
    listener: Function,
    once: boolean = false,
    _id?: string,
  ): string {
    const listenerId = _id || `listener_${Date.now()}_${deterministicRandom()}`;

    const listenerRef: ListenerRef = {
      id: listenerId,
      emitter,
      event,
      listener,
      once,
      created: Date.now(),
      removed: false,
    };

    this.listeners.set(listenerId, listenerRef);
    this.stats.totalCreated++;

    // Agregar el listener al emitter
    if (once) {
      emitter.once(event, listener);
    } else {
      emitter.on(event, listener);
    }

    return listenerId;
  }

  /**
   * Remueve un listener específico
   */
  removeListener(listenerId: string): boolean {
    const listenerRef = this.listeners.get(listenerId);
    if (!listenerRef || listenerRef.removed) return false;

    try {
      listenerRef.emitter.removeListener(
        listenerRef.event,
        listenerRef.listener,
      );
      listenerRef.removed = true;
      this.stats.totalRemoved++;
      return true;
    } catch (error) {
      console.warn(`Failed to remove listener ${listenerId}:`, error as Error);
      return false;
    }
  }

  /**
   * Remueve todos los listeners de un emitter específico
   */
  removeAllFromEmitter(_emitter: any): number {
    let removed = 0;
    this.listeners.forEach((ref, _id) => {
      if (ref.emitter === _emitter && !ref.removed) {
        this.removeListener(_id);
        removed++;
      }
    });
    return removed;
  }

  /**
   * Remueve todos los listeners activos
   */
  removeAll(): void {
    this.listeners.forEach((_, _id) => {
      this.removeListener(_id);
    });
  }

  /**
   * Obtiene estadísticas de listeners
   */
  getStats(): ListenerStats {
    const activeListeners = Array.from(this.listeners.values()).filter(
      (_l) => !_l.removed,
    );
    const oldest =
      activeListeners.length > 0
        ? Math.min(...activeListeners.map((_l) => _l.created))
        : null;
    const newest =
      activeListeners.length > 0
        ? Math.max(...activeListeners.map((_l) => _l.created))
        : null;

    return {
      totalListeners: this.stats.totalCreated,
      activeListeners: activeListeners.length,
      removedListeners: this.stats.totalRemoved,
      oldestListener: oldest,
      newestListener: newest,
    };
  }

  /**
   * Lista todos los listeners activos
   */
  listActive(): ListenerRef[] {
    return Array.from(this.listeners.values()).filter((_l) => !_l.removed);
  }
}

// Export singleton
export const listenerManager = ListenerManager.getInstance();


