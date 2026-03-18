/**
 * ⚡ SELENE RESOURCE MANAGER - INTELLIGENT RESOURCE ALLOCATION SYSTEM
 * Directiva V156: Acondicionamiento del Núcleo - Fase 1: Refuerzo Estructural
 *
 * MISSION: Intelligent resource allocation and containment for AI processes
 * STRATEGY: Monitor, allocate, and isolate resources to prevent system overload
 */
import { EventEmitter } from "events";
export interface ResourceMetrics {
    timestamp: Date;
    cpu: {
        usage: number;
        cores: number;
        loadAverage: number[];
    };
    memory: {
        used: number;
        total: number;
        usage: number;
        heapUsed?: number;
        heapTotal?: number;
    };
    gpu?: {
        usage: number;
        memoryUsed: number;
        memoryTotal: number;
        temperature: number;
    };
    processes: {
        total: number;
        aiProcesses: number;
        highCpuProcesses: number;
    };
}
export interface ResourceLimits {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxGpuUsage?: number;
    maxAiProcesses: number;
    emergencyThreshold: {
        cpu: number;
        memory: number;
        gpu?: number;
    };
}
export interface ProcessInfo {
    pid: number;
    name: string;
    cpu: number;
    memory: number;
    type: "ai" | "system" | "user" | "unknown";
    isolated: boolean;
    priority: "low" | "normal" | "high" | "critical";
}
export interface ContainmentProtocol {
    id: string;
    name: string;
    trigger: {
        resource: "cpu" | "memory" | "gpu";
        threshold: number;
        duration: number;
    };
    actions: {
        isolateProcesses: boolean;
        reducePriority: boolean;
        killProcesses: boolean;
        scaleDown: boolean;
    };
    cooldown: number;
    lastTriggered: Date | null;
}
/**
 * ⚡ SELENE RESOURCE MANAGER - THE RESOURCE GUARDIAN
 * Intelligent resource allocation and containment system
 */
export declare class SeleneResourceManager extends EventEmitter {
    private isActive;
    private metrics;
    private limits;
    private processes;
    private containmentProtocols;
    private isolatedProcesses;
    private monitoringInterval;
    private containmentInterval;
    private resourceAllocation;
    private aiProcessTracker;
    constructor(limits?: Partial<ResourceLimits>);
    /**
     * 🚀 Start resource management
     */
    start(): Promise<void>;
    /**
     * 🛑 Stop resource management
     */
    stop(): Promise<void>;
    /**
     * 📊 Start resource monitoring
     */
    private startResourceMonitoring;
    /**
     * 📊 Collect resource metrics
     */
    private collectResourceMetrics;
    /**
     * 📊 Get CPU usage
     */
    private getCpuUsage;
    /**
     * 📊 Monitor processes
     */
    private monitorProcesses;
    /**
     * 🛡️ Initialize containment protocols
     */
    private initializeContainmentProtocols;
    /**
     * 🛡️ Start containment monitoring
     */
    private startContainmentMonitoring;
    /**
     * 🛡️ Monitor containment triggers
     */
    private monitorContainmentTriggers;
    /**
     * 🛡️ Check protocol trigger
     */
    private checkProtocolTrigger;
    /**
     * 🛡️ Trigger containment protocol
     */
    private triggerContainmentProtocol;
    /**
     * 🚧 Isolate high usage processes
     */
    private isolateHighUsageProcesses;
    /**
     * 🚧 Isolate specific process
     */
    isolateProcess(pid: number): Promise<void>;
    /**
     * 🚧 Release process isolation
     */
    releaseIsolation(pid: number): Promise<void>;
    /**
     * 🚧 Release all isolations
     */
    private releaseAllIsolations;
    /**
     * ⚡ Allocate resources for AI process
     */
    allocateResourcesForAI(processId: string, requirements: any): Promise<boolean>;
    /**
     * ⚡ Release resources for AI process
     */
    releaseResourcesForAI(processId: string): Promise<void>;
    /**
     * ⚡ Check resource availability
     */
    private checkResourceAvailability;
    /**
     * 🚨 Check resource alerts
     */
    private checkResourceAlerts;
    /**
     * 🚨 Check runaway processes
     */
    private checkRunawayProcesses;
    /**
     * 🔧 Reduce process priorities
     */
    private reduceProcessPriorities;
    /**
     * 🔧 Kill runaway processes
     */
    private killRunawayProcesses;
    /**
     * 🔧 Scale down resources
     */
    private scaleDownResources;
    /**
     * 🔧 Assess system resources
     */
    private assessSystemResources;
    /**
     * 📊 Get latest metrics
     */
    getLatestMetrics(): ResourceMetrics | null;
    /**
     * 📊 Get resource status
     */
    getResourceStatus(): any;
    /**
     * 📊 Get resource report
     */
    getResourceReport(): any;
    /**
     * 📊 Generate resource recommendations
     */
    private generateResourceRecommendations;
}
//# sourceMappingURL=ResourceManager.d.ts.map