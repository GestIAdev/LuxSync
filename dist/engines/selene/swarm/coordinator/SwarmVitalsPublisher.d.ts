import { SystemVitals } from "../core/SystemVitals.js";
import { NodeId, NodeVitals } from "../core/SwarmTypes.js";
export declare class SwarmVitalsPublisher {
    private nodeId;
    private redis;
    private systemVitals;
    private publishIntervalId;
    private publishInterval;
    private vitalsTTL;
    constructor(nodeId: NodeId, redis: any, systemVitals: SystemVitals, options?: {
        publishInterval?: number;
        vitalsTTL?: number;
    });
    /**
     * 🚀 Iniciar publicación periódica de vitals
     */
    start(): Promise<void>;
    /**
     * 🛑 Detener publicación de vitals
     */
    stop(): Promise<void>;
    /**
     * 📡 Publicar vitals actuales del nodo a Redis
     */
    private publishVitals;
    /**
     * 🧹 Limpiar vitals publicados al detener
     */
    private clearPublishedVitals;
    /**
     * 🔍 Obtener vitals publicados por otro nodo (para debugging)
     */
    getPublishedVitals(nodeId: string): Promise<NodeVitals | null>;
    /**
     * 📊 Obtener estado del publisher
     */
    getStatus(): {
        active: boolean;
        nodeId: string;
        publishInterval: number;
        vitalsTTL: number;
        lastPublish?: number;
    };
}
//# sourceMappingURL=SwarmVitalsPublisher.d.ts.map