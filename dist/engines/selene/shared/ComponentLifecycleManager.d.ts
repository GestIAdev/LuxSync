/**
 * 🔧 COMPONENT LIFECYCLE MANAGER V194
 * Directiva V194: Cirugía del Panteón - Fix #1
 *
 * PROPÓSITO: Gestión automática del lifecycle de componentes Selene
 * para prevenir event listener leaks y referencias circulares
 */
import { EventEmitter } from "events";
export interface ComponentCleanupable {
    cleanup(): Promise<void> | void;
    getId(): string;
}
export interface EventListenerRegistry {
    event: string;
    listener: (...args: any[]) => void;
    emitter: EventEmitter;
    timestamp: number;
}
export interface TimerRegistry {
    id: NodeJS.Timeout | NodeJS.Timer;
    type: "timeout" | "interval";
    created: number;
    lastExecution?: number;
}
export declare class ComponentLifecycleManager {
    private static instance;
    private registeredComponents;
    private eventListeners;
    private timers;
    private cleanupCallbacks;
    private readonly MAX_LISTENERS_PER_COMPONENT;
    private readonly MAX_TIMERS_PER_COMPONENT;
    private readonly CLEANUP_INTERVAL;
    private cleanupInterval;
    private constructor();
    static getInstance(): ComponentLifecycleManager;
    /**
     * Registra un componente para gestión de lifecycle
     */
    registerComponent(component: ComponentCleanupable): void;
    /**
     * Registra un event listener con cleanup automático
     */
    registerEventListener(componentId: string, emitter: EventEmitter, event: string, listener: (...args: any[]) => void): void;
    /**
     * Registra un timer con cleanup automático
     */
    registerTimer(componentId: string, timer: NodeJS.Timeout | NodeJS.Timer, type: "timeout" | "interval"): void;
    /**
     * Registra callback de cleanup personalizado
     */
    registerCleanupCallback(componentId: string, _callback: Function): void;
    /**
     * Desregistra y limpia un componente completamente
     */
    unregisterComponent(componentId: string): Promise<void>;
    /**
     * Limpia event listeners de un componente
     */
    private cleanupEventListeners;
    /**
     * Limpia timers de un componente
     */
    private cleanupTimers;
    /**
     * Ejecuta callbacks de cleanup personalizados
     */
    private executeCleanupCallbacks;
    /**
     * Cleanup periódico automático
     */
    private startPeriodicCleanup;
    /**
     * Ejecuta cleanup periódico de recursos huérfanos
     */
    private performPeriodicCleanup;
    /**
     * Shutdown completo del manager
     */
    shutdown(): Promise<void>;
    /**
     * Obtener estadísticas del manager
     */
    getStats(): any;
}
export declare const lifecycleManager: ComponentLifecycleManager;
export default lifecycleManager;
//# sourceMappingURL=ComponentLifecycleManager.d.ts.map