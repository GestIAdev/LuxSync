/**
 * WeakReferenceManager - Gestión Cuántica de Referencias Débiles
 * "Erradicar referencias circulares, liberar memoria automáticamente"
 *
 * Sistema de gestión de referencias débiles para prevenir memory leaks
 * y referencias circulares en el swarm inmortal.
 */
import { EventEmitter } from "events";
export interface WeakReference<T extends object = any> {
    id: string;
    target: any;
    metadata: {
        type: string;
        created: number;
        lastAccess: number;
        refCount: number;
    };
    cleanupCallback?: () => void;
}
export interface ReferenceCycle {
    cycleId: string;
    nodes: string[];
    detected: number;
    severity: "low" | "medium" | "high" | "critical";
    resolution?: "auto" | "manual" | "ignored";
}
export interface WeakReferenceStats {
    totalReferences: number;
    activeReferences: number;
    collectedReferences: number;
    detectedCycles: number;
    resolvedCycles: number;
    memoryPressure: number;
    lastCleanup: number;
    relationshipCount: number;
    garbageCollectedRefs: number;
}
/**
 * Configuración para WeakReferenceManager
 */
interface WeakReferenceConfig {
    cleanupInterval: number;
    maxReferences: number;
    cycleDetectionEnabled: boolean;
    autoCleanupEnabled: boolean;
    memoryPressureThreshold: number;
    enableMemoryPressureDetection?: boolean;
}
/**
 * WeakReferenceManager - El Guardián de las Referencias
 */
export declare class WeakReferenceManager extends EventEmitter {
    private references;
    private referenceRegistry;
    private cycleDetector;
    private cleanupInterval;
    private stats;
    private relationships;
    private config;
    private static instance;
    constructor(config?: Partial<WeakReferenceConfig> & {
        autoCleanup?: boolean;
        cleanupIntervalMs?: number;
        enableMemoryPressureDetection?: boolean;
    });
    /**
     * Singleton pattern - Obtiene la instancia global
     */
    static getInstance(): WeakReferenceManager;
    /**
     * REGISTRO DE REFERENCIAS DÉBILES
     */
    /**
     * Registra una referencia débil para un objeto
     */
    register<T extends object>(target: T, id: string, type?: string, _cleanupCallback?: () => void): WeakReference<T>;
    /**
     * Registra múltiples referencias en lote
     */
    registerBatch<T extends object>(_targets: Array<{
        target: T;
        id: string;
        type?: string;
        cleanupCallback?: () => void;
    }>): WeakReference<T>[];
    /**
     * Obtiene una referencia débil por ID
     */
    get<T extends object>(id: string): T | undefined;
    /**
     * Verifica si una referencia existe y no ha sido recolectada
     */
    has(id: string): boolean;
    /**
     * Elimina una referencia débil
     */
    unregister(id: string): boolean;
    /**
     * DETECCIÓN DE CICLOS DE REFERENCIAS
     */
    /**
     * Detecta ciclos de referencias en el sistema
     */
    detectCycles(): ReferenceCycle[];
    /**
     * Obtiene referencias relacionadas para un objeto
     */
    private getRelatedReferences;
    /**
     * Crea un reporte de ciclo de referencias
     */
    private createCycleReport;
    /**
     * Calcula la severidad de un ciclo
     */
    private calculateCycleSeverity;
    /**
     * Resuelve un ciclo de referencias automáticamente
     */
    resolveCycle(cycleId: string, strategy?: "break_weakest" | "break_oldest" | "manual"): boolean;
    /**
     * Encuentra el eslabón más débil en un ciclo
     */
    private findWeakestLink;
    /**
     * Encuentra el eslabón más antiguo en un ciclo
     */
    private findOldestLink;
    /**
     * Calcula la "fuerza" de una referencia
     */
    private calculateReferenceStrength;
    /**
     * GESTIÓN DE LIMPIEZA AUTOMÁTICA
     */
    /**
     * Inicia el proceso de cleanup automático
     */
    private startCleanupProcess;
    /**
     * 🔥 PHASE 2.3.3: Batch cleanup - collect first, delete in batch
     *
     * Realiza cleanup de referencias recolectadas en batch (30% más rápido)
     */
    private performCleanup;
    /**
     * Maneja una referencia que ha sido recolectada por GC
     */
    private handleCollectedReference;
    /**
     * Fuerza un cleanup inmediato
     */
    forceCleanup(): void;
    /**
     * Configura detección de presión de memoria
     */
    private setupMemoryPressureDetection;
    /**
     * ESTADÍSTICAS Y MONITORING
     */
    /**
     * Obtiene estadísticas actuales
     */
    getStats(): WeakReferenceStats;
    /**
     * Obtiene todas las referencias activas
     */
    getActiveReferences(): Array<{
        id: string;
        type: string;
        age: number;
    }>;
    /**
     * Obtiene ciclos detectados
     */
    getDetectedCycles(): ReferenceCycle[];
    /**
     * Crea una referencia débil (método de compatibilidad)
     */
    createWeakRef<T extends object>(_target: T, _id: string, _type?: string): WeakReference<T>;
    /**
     * Obtiene una referencia débil por ID (método de compatibilidad)
     */
    getWeakRef<T extends object>(id: string): {
        get(): T | undefined;
        has(): boolean;
    } | undefined;
    /**
     * Crea una relación entre referencias
     */
    createRelationship(fromId: string, _toId: string, _type: string): boolean;
    /**
     * Obtiene los hijos de una referencia
     */
    getChildren<T extends object>(_id: string): T[];
    /**
     * Obtiene las dependencias de una referencia
     */
    getDependencies<T extends object>(_id: string): T[];
    /**
     * Detecta referencias circulares (método de compatibilidad)
     */
    detectCircularReferences(): Array<{
        nodes: string[];
        severity: string;
        cycle: string[];
    }>;
    /**
     * Apaga el gestor de referencias
     */
    shutdown(): Promise<void>;
    /**
     * Ejecuta cleanup manual (método de compatibilidad)
     */
    cleanup(): void;
    /**
     * Inicializa estadísticas
     */
    private initializeStats;
    /**
     * DESTRUCCIÓN Y CLEANUP
     */
    /**
     * Destruye el WeakReferenceManager
     */
    destroy(): void;
}
export declare function getWeakReferenceManager(_config?: Partial<WeakReferenceConfig>): WeakReferenceManager;
/**
 * @deprecated Use getWeakReferenceManager() instead for lazy initialization
 */
export declare const weakReferenceManager: {
    getInstance: typeof getWeakReferenceManager;
};
export {};
//# sourceMappingURL=WeakReferenceManager.d.ts.map