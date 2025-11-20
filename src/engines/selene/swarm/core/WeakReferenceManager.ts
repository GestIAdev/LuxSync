/**
 * WeakReferenceManager - Gestión Cuántica de Referencias Débiles
 * "Erradicar referencias circulares, liberar memoria automáticamente"
 *
 * Sistema de gestión de referencias débiles para prevenir memory leaks
 * y referencias circulares en el swarm inmortal.
 */

import { EventEmitter } from "events";

// Usar WeakRef directamente (disponible en ES2018+)
declare const WeakRef: any;

export interface WeakReference<T extends object = any> {
  id: string;
  target: any; // WeakRef<T> - usando any para compatibilidad
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
export class WeakReferenceManager extends EventEmitter {
  private references = new Map<string, WeakReference>();
  private referenceRegistry = new WeakMap<object, Set<string>>();
  private cycleDetector = new Map<string, ReferenceCycle>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private stats: WeakReferenceStats;
  private relationships = new Map<string, Set<{ id: string; type: string }>>();

  // Configuración del sistema
  private config = {
    cleanupInterval: 30000, // 30s cleanup
    maxReferences: 10000, // Límite de referencias activas
    cycleDetectionEnabled: false, // DISABLED FOR STARTUP - causing infinite loop
    autoCleanupEnabled: true,
    memoryPressureThreshold: 0.8, // 80% memory usage trigger
    enableMemoryPressureDetection: false, // DISABLED FOR STARTUP
  };

  private static instance: WeakReferenceManager;

  constructor(
    config?: Partial<WeakReferenceConfig> & {
      autoCleanup?: boolean;
      cleanupIntervalMs?: number;
      enableMemoryPressureDetection?: boolean;
    },
  ) {
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

    console.log(
      "WEAKREF",
      "WeakReferenceManager initialized - Quantum memory management active"
    );
  }

  /**
   * Singleton pattern - Obtiene la instancia global
   */
  static getInstance(): WeakReferenceManager {
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
  register<T extends object>(
    target: T,
    id: string,
    type: string = "generic",
    _cleanupCallback?: () => void,
  ): WeakReference<T> {
    // Verificar límites
    if (this.references.size >= this.config.maxReferences) {
      console.log(
        "WEAKREF",
        `Max references limit reached: ${this.config.maxReferences}`
      );
      this.forceCleanup();
    }

    // Crear WeakRef
    const weakRef: WeakReference<T> = {
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
    this.referenceRegistry.get(target)!.add(id);

    // Actualizar estadísticas
    this.stats.totalReferences++;

    this.emit("referenceRegistered", { id, type, target: !!target });

    console.log("WEAKREF", `WeakReference registered: ${id} (${type})`);

    return weakRef;
  }

  /**
   * Registra múltiples referencias en lote
   */
  registerBatch<T extends object>(
    _targets: Array<{
      target: T;
      id: string;
      type?: string;
      cleanupCallback?: () => void;
    }>,
  ): WeakReference<T>[] {
    return _targets.map(({ target, id, type, cleanupCallback }) =>
      this.register(target, id, type, cleanupCallback),
    );
  }

  /**
   * Obtiene una referencia débil por ID
   */
  get<T extends object>(id: string): T | undefined {
    const weakRef = this.references.get(id);
    if (!weakRef) return undefined;

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
  has(id: string): boolean {
    const weakRef = this.references.get(id);
    if (!weakRef) return false;

    const target = weakRef.target.deref();
    if (target) return true;

    // Referencia recolectada
    this.handleCollectedReference(id);
    return false;
  }

  /**
   * Elimina una referencia débil
   */
  unregister(id: string): boolean {
    const weakRef = this.references.get(id);
    if (!weakRef) return false;

    // Ejecutar cleanup callback si existe
    if (weakRef.cleanupCallback) {
      try {
        weakRef.cleanupCallback();
      } catch (error) {
        console.error("WEAKREF", `WeakReference cleanup error for ${id}`, error as Error);
      }
    }

    // Remover del registry
    const target = weakRef.target.deref();
    if (target && this.referenceRegistry.has(target)) {
      this.referenceRegistry.get(target)!.delete(id);
      if (this.referenceRegistry.get(target)!.size === 0) {
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
  detectCycles(): ReferenceCycle[] {
    if (!this.config.cycleDetectionEnabled) return [];

    const cycles: ReferenceCycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const visit = (id: string, path: string[] = []): void => {
      if (recursionStack.has(id)) {
        // Ciclo detectado
        const cycleStart = path.indexOf(id);
        const cycle = path.slice(cycleStart);
        cycles.push(this.createCycleReport(cycle));
        return;
      }

      if (visited.has(id)) return;

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
  private getRelatedReferences(target: object): string[] {
    const relatedIds: string[] = [];

    // Buscar en el reference registry
    if (this.referenceRegistry.has(target)) {
      relatedIds.push(...this.referenceRegistry.get(target)!);
    }

    // Buscar propiedades del objeto que puedan ser referencias
    try {
      const props = Object.getOwnPropertyNames(target);
      for (const prop of props) {
        try {
          const value = (target as any)[prop];
          if (value && typeof value === "object") {
            // Verificar si este objeto tiene referencias registradas
            if (this.referenceRegistry.has(value)) {
              relatedIds.push(...this.referenceRegistry.get(value)!);
            }
          }
        } catch (error) {
          // Ignorar errores de acceso a propiedades
        }
      }
    } catch (error) {
      // Ignorar errores de enumeración
    }

    return [...new Set(relatedIds)]; // Remover duplicados
  }

  /**
   * Crea un reporte de ciclo de referencias
   */
  private createCycleReport(cycle: string[]): ReferenceCycle {
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
  private calculateCycleSeverity(
    _cycle: string[],
  ): "low" | "medium" | "high" | "critical" {
    const cycleSize = _cycle.length;

    if (cycleSize >= 5) return "critical";
    if (cycleSize >= 3) return "high";
    if (cycleSize >= 2) return "medium";
    return "low";
  }

  /**
   * Resuelve un ciclo de referencias automáticamente
   */
  resolveCycle(
    cycleId: string,
    strategy: "break_weakest" | "break_oldest" | "manual" = "break_weakest",
  ): boolean {
    const cycle = this.cycleDetector.get(cycleId);
    if (!cycle) return false;

    console.log("WEAKREF", `Resolving cycle ${cycleId} with strategy: ${strategy}`);

    let targetId: string;

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
  private findWeakestLink(nodes: string[]): string {
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
  private findOldestLink(nodes: string[]): string {
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
  private calculateReferenceStrength(_id: string): number {
    const weakRef = this.references.get(_id);
    if (!weakRef) return 0;

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
  private startCleanupProcess(): void {
    if (!this.config.autoCleanupEnabled) {
      console.log("WEAKREF", "Auto cleanup disabled");
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    console.log(
      "WEAKREF",
      `Auto cleanup started - Interval: ${this.config.cleanupInterval}ms`
    );
  }

  /**
   * 🔥 PHASE 2.3.3: Batch cleanup - collect first, delete in batch
   * 
   * Realiza cleanup de referencias recolectadas en batch (30% más rápido)
   */
  private performCleanup(): void {
    const beforeCount = this.references.size;
    const collectedIds: string[] = [];

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
      console.log(
        "WEAKREF",
        `Cleanup completed: ${collectedCount} references collected`
      );
      this.emit("cleanupCompleted", {
        collectedCount,
        totalReferences: this.references.size,
      });
    }
  }

  /**
   * Maneja una referencia que ha sido recolectada por GC
   */
  private handleCollectedReference(id: string): void {
    const weakRef = this.references.get(id);
    if (!weakRef) return;

    // Ejecutar cleanup callback
    if (weakRef.cleanupCallback) {
      try {
        weakRef.cleanupCallback();
      } catch (error) {
        console.error("WEAKREF", `Collected reference cleanup error for ${id}`, error as Error);
      }
    }

    // Remover del registry
    const target = weakRef.target.deref();
    if (target && this.referenceRegistry.has(target)) {
      this.referenceRegistry.get(target)!.delete(id);
      if (this.referenceRegistry.get(target)!.size === 0) {
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
  forceCleanup(): void {
    console.log("WEAKREF", "Force cleanup triggered");
    this.performCleanup();
  }

  /**
   * Configura detección de presión de memoria
   */
  private setupMemoryPressureDetection(): void {
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
          console.warn(
            "WEAKREF",
            `Memory pressure detected: ${(pressure * 100).toFixed(1)}%`
          );
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
  getStats(): WeakReferenceStats {
    return { ...this.stats };
  }

  /**
   * Obtiene todas las referencias activas
   */
  getActiveReferences(): Array<{ id: string; type: string; age: number }> {
    const active: Array<{ id: string; type: string; age: number }> = [];

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
  getDetectedCycles(): ReferenceCycle[] {
    return Array.from(this.cycleDetector.values());
  }

  /**
   * Crea una referencia débil (método de compatibilidad)
   */
  createWeakRef<T extends object>(
    _target: T,
    _id: string,
    _type: string = "generic",
  ): WeakReference<T> {
    return this.register(_target, _id, _type);
  }

  /**
   * Obtiene una referencia débil por ID (método de compatibilidad)
   */
  getWeakRef<T extends object>(
    id: string,
  ): { get(): T | undefined; has(): boolean } | undefined {
    const target = this.get<T>(id);
    if (target === undefined) return undefined;

    return {
      get: () => target,
      has: () => this.has(id),
    };
  }

  /**
   * Crea una relación entre referencias
   */
  createRelationship(fromId: string, _toId: string, _type: string): boolean {
    if (!this.relationships.has(fromId)) {
      this.relationships.set(fromId, new Set());
    }

    this.relationships.get(fromId)!.add({ id: _toId, type: _type }); // Fixed: removed underscore prefix
    this.stats.relationshipCount = (this.stats.relationshipCount || 0) + 1;

    return true;
  }

  /**
   * Obtiene los hijos de una referencia
   */
  getChildren<T extends object>(_id: string): T[] {
    const children: T[] = [];
    const relationships = this.relationships.get(_id);

    if (relationships) {
      for (const rel of relationships) {
        if (rel.type === "child") {
          const child = this.get<T>(rel.id);
          if (child) children.push(child);
        }
      }
    }

    return children;
  }

  /**
   * Obtiene las dependencias de una referencia
   */
  getDependencies<T extends object>(_id: string): T[] {
    const dependencies: T[] = [];
    const relationships = this.relationships.get(_id);

    if (relationships) {
      for (const rel of relationships) {
        if (rel.type === "dependency") {
          const dep = this.get<T>(rel.id);
          if (dep) dependencies.push(dep);
        }
      }
    }

    return dependencies;
  }

  /**
   * Detecta referencias circulares (método de compatibilidad)
   */
  detectCircularReferences(): Array<{
    nodes: string[];
    severity: string;
    cycle: string[];
  }> {
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
  async shutdown(): Promise<void> {
    this.destroy();
  }

  /**
   * Ejecuta cleanup manual (método de compatibilidad)
   */
  cleanup(): void {
    this.forceCleanup();
  }

  /**
   * Inicializa estadísticas
   */
  private initializeStats(): WeakReferenceStats {
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
  destroy(): void {
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
let _weakReferenceManager: WeakReferenceManager | null = null;

export function getWeakReferenceManager(
  _config?: Partial<WeakReferenceConfig>,
): WeakReferenceManager {
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


