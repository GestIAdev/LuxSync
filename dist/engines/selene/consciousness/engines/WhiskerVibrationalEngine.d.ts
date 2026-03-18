/**
 * 🐱 WHISKER VIBRATIONAL ENGINE
 * "Siente las vibraciones del entorno - conoce sin mirar"
 *
 * CAPACIDAD:
 * - Lee vitals publicados por otros nodos en Redis
 * - Detecta proximidad (nodes con CPU/memory similar)
 * - Identifica nodos débiles (health < 50%)
 */
interface NodeVitals {
    nodeId: string;
    cpu: number;
    memory: number;
    health: number;
    uptime: number;
    lastSeen: Date;
}
interface ProximityReport {
    nearbyNodes: NodeVitals[];
    weakNodes: NodeVitals[];
    avgClusterHealth: number;
    myPosition: 'leader' | 'follower' | 'isolated';
}
export declare class WhiskerVibrationalEngine {
    private redis;
    private myNodeId;
    private vitalsKeyPrefix;
    private vitalsTTL;
    constructor(redis: any, nodeId: string);
    /**
     * 📡 PUBLICAR VITALS del nodo actual
     */
    publishVitals(cpu: number, memory: number, health: number, uptime: number): Promise<void>;
    /**
     * 🌐 ESCANEAR ENTORNO: Leer vitals de todos los nodos
     */
    scanEnvironment(): Promise<ProximityReport>;
    /**
     * 📖 LEER VITALS de un nodo específico
     */
    private readNodeVitals;
    /**
     * 🔍 ENCONTRAR NODOS CERCANOS (similitud en recursos)
     */
    private findNearbyNodes;
    /**
     * 👑 DETERMINAR MI POSICIÓN en el cluster
     */
    private determineMyPosition;
    /**
     * 📡 DETECTAR ANOMALÍAS en el cluster
     */
    detectAnomalies(): Promise<{
        hasAnomalies: boolean;
        issues: string[];
    }>;
    /**
     * 📊 OBTENER ESTADÍSTICAS del sensor
     */
    getStats(): Promise<{
        activeNodes: number;
        nearbyNodes: number;
        weakNodes: number;
        avgClusterHealth: number;
        myPosition: string;
        vitalsTTL: number;
    }>;
}
export {};
//# sourceMappingURL=WhiskerVibrationalEngine.d.ts.map