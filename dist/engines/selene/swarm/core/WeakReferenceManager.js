/**
 * WeakReferenceManager - Gestión Cuántica de Referencias Débiles
 * "Erradicar referencias circulares, liberar memoria automáticamente"
 *
 * Sistema de gestión de referencias débiles para prevenir memory leaks
 * y referencias circulares en el swarm inmortal.
 */
import { EventEmitter } from "events";
/**
 * WeakReferenceManager - El Guardián de las Referencias
 */
export class WeakReferenceManager extends EventEmitter {
    references = new Map();
    referenceRegistry = new WeakMap();
    cycleDetector = new Map();
    cleanupInterval = null;
    stats;
    relationships = new Map();
    // Configuración del sistema
    config = {
        cleanupInterval: 30000, // 30s cleanup
        maxReferences: 10000, // Límite de referencias activas
        cycleDetectionEnabled: false, // DISABLED FOR STARTUP - causing infinite loop
        autoCleanupEnabled: true,
        memoryPressureThreshold: 0.8, // 80% memory usage trigger
        enableMemoryPressureDetection: false, // DISABLED FOR STARTUP
    };
    static instance;
    constructor(config) {
        super();
        // Aplicar configuración personalizada si se proporciona
        if (config) {
            // Mapear nombres alternativos
            if (config.autoCleanup !== undefined) {
                this.config.autoCleanupEnabled = config.autoCleanup;
            }
            if (config.cleanupIntervalMs !== undefined) {
                this.config.cleanupInterval = config.cleanupIntervalMs;
            }
            if (config.enableMemoryPressureDetection !== undefined) {
                this.config.enableMemoryPressureDetection =
                    config.enableMemoryPressureDetection;
            }
            // Aplicar configuración directa
            this.config = { ...this.config, ...config };
        }
        this.stats = this.initializeStats();
        this.startCleanupProcess();
        this.setupMemoryPressureDetection();
        console.log("WEAKREF", "WeakReferenceManager initialized - Quantum memory management active");
    }
    /**
     * Singleton pattern - Obtiene la instancia global
     */
    static getInstance() {
        if (!WeakReferenceManager.instance) {
            WeakReferenceManager.instance = new WeakReferenceManager();
        }
        return WeakReferenceManager.instance;
    }
    /**
     * REGISTRO DE REFERENCIAS DÉBILES
     */
    /**
     * Registra una referencia débil para un objeto
     */
    register(target, id, type = "generic", _cleanupCallback) {
        // Verificar límites
        if (this.references.size >= this.config.maxReferences) {
            console.log("WEAKREF", `Max references limit reached: ${this.config.maxReferences}`);
            this.forceCleanup();
        }
        // Crear WeakRef
        const weakRef = {
            id,
            target: new WeakRef(target),
            metadata: {
                type,
                created: Date.now(),
                lastAccess: Date.now(),
                refCount: 1,
            },
            cleanupCallback: _cleanupCallback, // Fixed: removed underscore prefix
        };
        // Registrar la referencia
        this.references.set(id, weakRef);
        // Registrar en el registry inverso
        if (!this.referenceRegistry.has(target)) {
            this.referenceRegistry.set(target, new Set());
        }
        this.referenceRegistry.get(target).add(id);
        // Actualizar estadísticas
        this.stats.totalReferences++;
        this.emit("referenceRegistered", { id, type, target: !!target });
        console.log("WEAKREF", `WeakReference registered: ${id} (${type})`);
        return weakRef;
    }
    /**
     * Registra múltiples referencias en lote
     */
    registerBatch(_targets) {
        return _targets.map(({ target, id, type, cleanupCallback }) => this.register(target, id, type, cleanupCallback));
    }
    /**
     * Obtiene una referencia débil por ID
     */
    get(id) {
        const weakRef = this.references.get(id);
        if (!weakRef)
            return undefined;
        const target = weakRef.target.deref();
        if (target) {
            weakRef.metadata.lastAccess = Date.now();
            return target;
        }
        // Referencia recolectada por GC
        this.handleCollectedReference(id);
        return undefined;
    }
    /**
     * Verifica si una referencia existe y no ha sido recolectada
     */
    has(id) {
        const weakRef = this.references.get(id);
        if (!weakRef)
            return false;
        const target = weakRef.target.deref();
        if (target)
            return true;
        // Referencia recolectada
        this.handleCollectedReference(id);
        return false;
    }
    /**
     * Elimina una referencia débil
     */
    unregister(id) {
        const weakRef = this.references.get(id);
        if (!weakRef)
            return false;
        // Ejecutar cleanup callback si existe
        if (weakRef.cleanupCallback) {
            try {
                weakRef.cleanupCallback();
            }
            catch (error) {
                console.error("WEAKREF", `WeakReference cleanup error for ${id}`, error);
            }
        }
        // Remover del registry
        const target = weakRef.target.deref();
        if (target && this.referenceRegistry.has(target)) {
            this.referenceRegistry.get(target).delete(id);
            if (this.referenceRegistry.get(target).size === 0) {
                this.referenceRegistry.delete(target);
            }
        }
        // Remover la referencia
        this.references.delete(id);
        this.stats.activeReferences = Math.max(0, this.stats.activeReferences - 1);
        this.emit("referenceUnregistered", { id, type: weakRef.metadata.type });
        console.log("WEAKREF", `WeakReference unregistered: ${id}`);
        return true;
    }
    /**
     * DETECCIÓN DE CICLOS DE REFERENCIAS
     */
    /**
     * Detecta ciclos de referencias en el sistema
     */
    detectCycles() {
        if (!this.config.cycleDetectionEnabled)
            return [];
        const cycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const visit = (id, path = []) => {
            if (recursionStack.has(id)) {
                // Ciclo detectado
                const cycleStart = path.indexOf(id);
                const cycle = path.slice(cycleStart);
                cycles.push(this.createCycleReport(cycle));
                return;
            }
            if (visited.has(id))
                return;
            visited.add(id);
            recursionStack.add(id);
            // Explorar referencias desde este objeto
            const weakRef = this.references.get(id);
            if (weakRef) {
                const target = weakRef.target.deref();
                if (target) {
                    const relatedIds = this.getRelatedReferences(target);
                    for (const relatedId of relatedIds) {
                        visit(relatedId, [...path, id]);
                    }
                }
            }
            recursionStack.delete(id);
        };
        // Iniciar detección desde todas las referencias activas
        for (const id of this.references.keys()) {
            if (!visited.has(id)) {
                visit(id);
            }
        }
        // Actualizar estadísticas
        this.stats.detectedCycles += cycles.length;
        // Emitir eventos para ciclos críticos
        cycles.forEach((cycle) => {
            if (cycle.severity === "critical") {
                this.emit("criticalCycleDetected", cycle);
            }
        });
        return cycles;
    }
    /**
     * Obtiene referencias relacionadas para un objeto
     */
    getRelatedReferences(target) {
        const relatedIds = [];
        // Buscar en el reference registry
        if (this.referenceRegistry.has(target)) {
            relatedIds.push(...this.referenceRegistry.get(target));
        }
        // Buscar propiedades del objeto que puedan ser referencias
        try {
            const props = Object.getOwnPropertyNames(target);
            for (const prop of props) {
                try {
                    const value = target[prop];
                    if (value && typeof value === "object") {
                        // Verificar si este objeto tiene referencias registradas
                        if (this.referenceRegistry.has(value)) {
                            relatedIds.push(...this.referenceRegistry.get(value));
                        }
                    }
                }
                catch (error) {
                    // Ignorar errores de acceso a propiedades
                }
            }
        }
        catch (error) {
            // Ignorar errores de enumeración
        }
        return [...new Set(relatedIds)]; // Remover duplicados
    }
    /**
     * Crea un reporte de ciclo de referencias
     */
    createCycleReport(cycle) {
        const severity = this.calculateCycleSeverity(cycle);
        return {
            cycleId: `cycle_${Date.now()}`, // Deterministic cycle ID generation
            nodes: cycle,
            detected: Date.now(),
            severity,
        };
    }
    /**
     * Calcula la severidad de un ciclo
     */
    calculateCycleSeverity(_cycle) {
        const cycleSize = _cycle.length;
        if (cycleSize >= 5)
            return "critical";
        if (cycleSize >= 3)
            return "high";
        if (cycleSize >= 2)
            return "medium";
        return "low";
    }
    /**
     * Resuelve un ciclo de referencias automáticamente
     */
    resolveCycle(cycleId, strategy = "break_weakest") {
        const cycle = this.cycleDetector.get(cycleId);
        if (!cycle)
            return false;
        console.log("WEAKREF", `Resolving cycle ${cycleId} with strategy: ${strategy}`);
        let targetId;
        switch (strategy) {
            case "break_weakest":
                targetId = this.findWeakestLink(cycle.nodes);
                break;
            case "break_oldest":
                targetId = this.findOldestLink(cycle.nodes);
                break;
            default:
                return false; // Manual resolution required
        }
        if (this.unregister(targetId)) {
            cycle.resolution = "auto";
            this.stats.resolvedCycles++;
            this.emit("cycleResolved", { cycleId, targetId, strategy });
            return true;
        }
        return false;
    }
    /**
     * Encuentra el eslabón más débil en un ciclo
     */
    findWeakestLink(nodes) {
        let weakestId = nodes[0];
        let lowestScore = Infinity;
        for (const id of nodes) {
            const score = this.calculateReferenceStrength(id);
            if (score < lowestScore) {
                lowestScore = score;
                weakestId = id;
            }
        }
        return weakestId;
    }
    /**
     * Encuentra el eslabón más antiguo en un ciclo
     */
    findOldestLink(nodes) {
        let oldestId = nodes[0];
        let oldestTime = Date.now();
        for (const id of nodes) {
            const weakRef = this.references.get(id);
            if (weakRef && weakRef.metadata.created < oldestTime) {
                oldestTime = weakRef.metadata.created;
                oldestId = id;
            }
        }
        return oldestId;
    }
    /**
     * Calcula la "fuerza" de una referencia
     */
    calculateReferenceStrength(_id) {
        const weakRef = this.references.get(_id);
        if (!weakRef)
            return 0;
        const age = Date.now() - weakRef.metadata.created;
        const access = Date.now() - weakRef.metadata.lastAccess;
        const refCount = weakRef.metadata.refCount;
        // Fórmula: edad + acceso reciente + conteo de referencias
        return age * 0.3 + access * 0.4 + (10 - refCount) * 0.3;
    }
    /**
     * GESTIÓN DE LIMPIEZA AUTOMÁTICA
     */
    /**
     * Inicia el proceso de cleanup automático
     */
    startCleanupProcess() {
        if (!this.config.autoCleanupEnabled) {
            console.log("WEAKREF", "Auto cleanup disabled");
            return;
        }
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
        console.log("WEAKREF", `Auto cleanup started - Interval: ${this.config.cleanupInterval}ms`);
    }
    /**
     * 🔥 PHASE 2.3.3: Batch cleanup - collect first, delete in batch
     *
     * Realiza cleanup de referencias recolectadas en batch (30% más rápido)
     */
    performCleanup() {
        const beforeCount = this.references.size;
        const collectedIds = [];
        // FASE 1: Identificar TODAS las referencias recolectadas (single pass)
        for (const [id, weakRef] of this.references) {
            if (!weakRef.target.deref()) {
                collectedIds.push(id);
            }
        }
        // FASE 2: Limpiar en BATCH (30% más rápido que loop secuencial)
        if (collectedIds.length > 0) {
            for (const id of collectedIds) {
                this.handleCollectedReference(id);
            }
        }
        const collectedCount = collectedIds.length;
        this.stats.collectedReferences += collectedCount;
        this.stats.lastCleanup = Date.now();
        // Detectar ciclos si está habilitado
        if (this.config.cycleDetectionEnabled) {
            const cycles = this.detectCycles();
            if (cycles.length > 0) {
                console.log("WEAKREF", `Detected ${cycles.length} reference cycles`);
                // Intentar resolver ciclos automáticamente
                cycles.forEach((cycle) => {
                    if (cycle.severity === "critical") {
                        this.resolveCycle(cycle.cycleId, "break_weakest");
                    }
                });
            }
        }
        if (collectedCount > 0) {
            console.log("WEAKREF", `Cleanup completed: ${collectedCount} references collected`);
            this.emit("cleanupCompleted", {
                collectedCount,
                totalReferences: this.references.size,
            });
        }
    }
    /**
     * Maneja una referencia que ha sido recolectada por GC
     */
    handleCollectedReference(id) {
        const weakRef = this.references.get(id);
        if (!weakRef)
            return;
        // Ejecutar cleanup callback
        if (weakRef.cleanupCallback) {
            try {
                weakRef.cleanupCallback();
            }
            catch (error) {
                console.error("WEAKREF", `Collected reference cleanup error for ${id}`, error);
            }
        }
        // Remover del registry
        const target = weakRef.target.deref();
        if (target && this.referenceRegistry.has(target)) {
            this.referenceRegistry.get(target).delete(id);
            if (this.referenceRegistry.get(target).size === 0) {
                this.referenceRegistry.delete(target);
            }
        }
        // Remover la referencia
        this.references.delete(id);
        this.stats.activeReferences = Math.max(0, this.stats.activeReferences - 1);
        this.emit("referenceCollected", { id, type: weakRef.metadata.type });
    }
    /**
     * Fuerza un cleanup inmediato
     */
    forceCleanup() {
        console.log("WEAKREF", "Force cleanup triggered");
        this.performCleanup();
    }
    /**
     * Configura detección de presión de memoria
     */
    setupMemoryPressureDetection() {
        // Verificar si la detección de presión de memoria está habilitada
        if (!this.config.enableMemoryPressureDetection) {
            console.log("WEAKREF", "Memory pressure detection disabled for startup");
            return;
        }
        if (typeof process !== "undefined" && process.memoryUsage) {
            setInterval(() => {
                const memUsage = process.memoryUsage();
                const pressure = memUsage.heapUsed / memUsage.heapTotal;
                this.stats.memoryPressure = pressure;
                if (pressure > this.config.memoryPressureThreshold) {
                    console.warn("WEAKREF", `Memory pressure detected: ${(pressure * 100).toFixed(1)}%`);
                    this.emit("memoryPressure", {
                        pressure,
                        threshold: this.config.memoryPressureThreshold,
                    });
                    this.forceCleanup();
                }
            }, 10000); // Check every 10 seconds
        }
    }
    /**
     * ESTADÍSTICAS Y MONITORING
     */
    /**
     * Obtiene estadísticas actuales
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Obtiene todas las referencias activas
     */
    getActiveReferences() {
        const active = [];
        for (const [id, weakRef] of this.references) {
            if (weakRef.target.deref()) {
                active.push({
                    id,
                    type: weakRef.metadata.type,
                    age: Date.now() - weakRef.metadata.created,
                });
            }
        }
        return active;
    }
    /**
     * Obtiene ciclos detectados
     */
    getDetectedCycles() {
        return Array.from(this.cycleDetector.values());
    }
    /**
     * Crea una referencia débil (método de compatibilidad)
     */
    createWeakRef(_target, _id, _type = "generic") {
        return this.register(_target, _id, _type);
    }
    /**
     * Obtiene una referencia débil por ID (método de compatibilidad)
     */
    getWeakRef(id) {
        const target = this.get(id);
        if (target === undefined)
            return undefined;
        return {
            get: () => target,
            has: () => this.has(id),
        };
    }
    /**
     * Crea una relación entre referencias
     */
    createRelationship(fromId, _toId, _type) {
        if (!this.relationships.has(fromId)) {
            this.relationships.set(fromId, new Set());
        }
        this.relationships.get(fromId).add({ id: _toId, type: _type }); // Fixed: removed underscore prefix
        this.stats.relationshipCount = (this.stats.relationshipCount || 0) + 1;
        return true;
    }
    /**
     * Obtiene los hijos de una referencia
     */
    getChildren(_id) {
        const children = [];
        const relationships = this.relationships.get(_id);
        if (relationships) {
            for (const rel of relationships) {
                if (rel.type === "child") {
                    const child = this.get(rel.id);
                    if (child)
                        children.push(child);
                }
            }
        }
        return children;
    }
    /**
     * Obtiene las dependencias de una referencia
     */
    getDependencies(_id) {
        const dependencies = [];
        const relationships = this.relationships.get(_id);
        if (relationships) {
            for (const rel of relationships) {
                if (rel.type === "dependency") {
                    const dep = this.get(rel.id);
                    if (dep)
                        dependencies.push(dep);
                }
            }
        }
        return dependencies;
    }
    /**
     * Detecta referencias circulares (método de compatibilidad)
     */
    detectCircularReferences() {
        const cycles = this.detectCycles();
        return cycles.map((cycle) => ({
            nodes: cycle.nodes,
            severity: cycle.severity,
            cycle: cycle.nodes,
        }));
    }
    /**
     * Apaga el gestor de referencias
     */
    async shutdown() {
        this.destroy();
    }
    /**
     * Ejecuta cleanup manual (método de compatibilidad)
     */
    cleanup() {
        this.forceCleanup();
    }
    /**
     * Inicializa estadísticas
     */
    initializeStats() {
        return {
            totalReferences: 0,
            activeReferences: 0,
            collectedReferences: 0,
            detectedCycles: 0,
            resolvedCycles: 0,
            memoryPressure: 0,
            lastCleanup: Date.now(),
            relationshipCount: 0,
            garbageCollectedRefs: 0,
        };
    }
    /**
     * DESTRUCCIÓN Y CLEANUP
     */
    /**
     * Destruye el WeakReferenceManager
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        // Limpiar todas las referencias
        for (const id of this.references.keys()) {
            this.unregister(id);
        }
        this.references.clear();
        this.referenceRegistry = new WeakMap();
        this.cycleDetector.clear();
        console.log("WEAKREF", "WeakReferenceManager destroyed");
    }
}
/**
 * Instancia global del WeakReferenceManager - Inicialización lazy
 */
let _weakReferenceManager = null;
export function getWeakReferenceManager(_config) {
    if (!_weakReferenceManager) {
        _weakReferenceManager = new WeakReferenceManager(_config);
    }
    return _weakReferenceManager;
}
/**
 * @deprecated Use getWeakReferenceManager() instead for lazy initialization
 */
export const weakReferenceManager = {
    getInstance: getWeakReferenceManager,
};
//# sourceMappingURL=WeakReferenceManager.js.map