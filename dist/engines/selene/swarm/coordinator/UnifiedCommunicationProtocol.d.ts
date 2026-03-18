/**
 * 🌐 PROTOCOLOS DE COMUNICACIÓN UNIFICADA - SELENE SONG CORE SWARM
 * By PunkGrok - October 8, 2025
 *
 * MISSION: Unificar todos los protocolos de comunicación entre componentes
 * STRATEGY: Arquitectura de mensajería procedural determinista
 * TARGET: Comunicación real, medible y determinista entre todos los componentes
 */
import { NodeId } from "../core/SwarmTypes.js";
export declare enum ProceduralMessageType {
    SWARM_NODE_DISCOVERED = "swarm_node_discovered",
    SWARM_NODE_LOST = "swarm_node_lost",
    SWARM_CONSENSUS_INITIATED = "swarm_consensus_initiated",
    SWARM_LEADER_ELECTED = "swarm_leader_elected",
    SWARM_HEARTBEAT_SYNC = "swarm_heartbeat_sync",
    SWARM_CONSENSUS_VOTE_REQUEST = "swarm_consensus_vote_request",// 🔥 PHASE 4: Real vote communication
    SWARM_CONSENSUS_VOTE_RESPONSE = "swarm_consensus_vote_response",// 🔥 PHASE 4: Real vote communication
    IMMORTALITY_CRISIS_DETECTED = "immortality_crisis_detected",
    IMMORTALITY_RESURRECTION_TRIGGERED = "immortality_resurrection_triggered",
    IMMORTALITY_HEALTH_RESTORED = "immortality_health_restored",
    CREATIVE_INSPIRATION_GENERATED = "creative_inspiration_generated",
    CREATIVE_POETRY_COMPLETED = "creative_poetry_completed",
    CREATIVE_HARMONY_ACHIEVED = "creative_harmony_achieved",
    SECURITY_VERIFICATION_REQUESTED = "security_verification_requested",
    SECURITY_VERIFICATION_COMPLETED = "security_verification_completed",
    SECURITY_THREAT_DETECTED = "security_threat_detected",
    SYSTEM_METRICS_UPDATED = "system_metrics_updated",
    SYSTEM_HEALTH_CHECK_COMPLETED = "system_health_check_completed",
    SYSTEM_OPTIMIZATION_TRIGGERED = "system_optimization_triggered"
}
export interface ProceduralMessage {
    id: string;
    type: ProceduralMessageType;
    source: NodeId;
    target?: NodeId;
    timestamp: number;
    ttl: number;
    payload: any;
    signature?: string;
    priority: MessagePriority;
}
export declare enum MessagePriority {
    CRITICAL = 0,// Crítico - procesar inmediatamente
    HIGH = 1,// Alto - procesar en < 100ms
    NORMAL = 2,// Normal - procesar en < 500ms
    LOW = 3
}
export interface CommunicationProtocol {
    sendMessage(message: ProceduralMessage): Promise<boolean>;
    broadcastMessage(message: ProceduralMessage): Promise<number>;
    onMessage(type: ProceduralMessageType, handler: MessageHandler): void;
    offMessage(type: ProceduralMessageType, handler: MessageHandler): void;
    getActiveConnections(): Promise<NodeId[]>;
    getMessageStats(): MessageStats;
    isHealthy(): boolean;
}
export type MessageHandler = (message: ProceduralMessage) => Promise<void> | void;
export interface MessageStats {
    messagesSent: number;
    messagesReceived: number;
    messagesFailed: number;
    averageLatency: number;
    activeConnections: number;
    lastMessageTimestamp: number;
}
export interface ConsensusVoteRequest {
    consensusId: string;
    requesterNodeId: string;
    knownNodes: string[];
    timestamp: number;
    nodeMetrics: Map<string, NodeHealthMetrics>;
}
export interface NodeHealthMetrics {
    nodeId: string;
    healthScore: number;
    beautyFactor: number;
    finalScore: number;
    timestamp: number;
}
export interface ConsensusVoteResponse {
    consensusId: string;
    voterNodeId: string;
    candidateId: string;
    signature: string;
    timestamp: number;
    healthMetrics?: {
        cpu: number;
        memory: number;
        connections: number;
    };
}
export declare class UnifiedCommunicationProtocol implements CommunicationProtocol {
    private subscriberRedis;
    private publisherRedis;
    private eventEmitter;
    private nodeId;
    private messageStats;
    private handlers;
    private healthCheckInterval;
    constructor(subscriberRedis: any, publisherRedis: any, nodeId: NodeId);
    /**
     * 🚀 INICIALIZAR PROTOCOLO DE COMUNICACIÓN
     */
    private initializeProtocol;
    /**
     * 📨 ENVIAR MENSAJE DIRECTO
     */
    sendMessage(message: ProceduralMessage): Promise<boolean>;
    /**
     * 📢 ENVIAR MENSAJE DE BROADCAST
     */
    broadcastMessage(message: ProceduralMessage): Promise<number>;
    /**
     * 🎧 REGISTRAR HANDLER DE MENSAJE
     */
    onMessage(type: ProceduralMessageType, _handler: MessageHandler): void;
    /**
     * 🔇 REMOVER HANDLER DE MENSAJE
     */
    offMessage(type: ProceduralMessageType, _handler: MessageHandler): void;
    /**
     * 📥 MANEJAR MENSAJE ENTRANTE
     */
    private handleIncomingMessage;
    /**
     * 🔍 OBTENER NODOS ACTIVOS (DEBERÍA VENIR DE REGISTRO CENTRAL)
     */
    private getActiveNodesFromRegistry;
    /**
     * 🔗 OBTENER CONEXIONES ACTIVAS
     */
    getActiveConnections(): Promise<NodeId[]>;
    /**
     * 📊 OBTENER ESTADÍSTICAS DE MENSAJES
     */
    getMessageStats(): MessageStats;
    /**
     * 💚 VERIFICAR SALUD DEL PROTOCOLO
     */
    isHealthy(): boolean;
    /**
     * 🔍 REALIZAR HEALTH CHECK
     */
    private performHealthCheck;
    /**
     * 🛑 DESTRUIR PROTOCOLO
     */
    destroy(): Promise<void>;
}
export declare class CommunicationProtocolFactory {
    private static protocols;
    /**
     * 🏭 CREAR PROTOCOLO PARA NODO
     */
    static createProtocol(_subscriberRedis: any, _publisherRedis: any, nodeId: NodeId): UnifiedCommunicationProtocol;
    /**
     * 🗑️ DESTRUIR PROTOCOLO
     */
    static destroyProtocol(nodeId: NodeId): Promise<void>;
    /**
     * 📊 OBTENER ESTADÍSTICAS GLOBALES
     */
    static getGlobalStats(): {
        totalProtocols: number;
        totalMessages: number;
    };
}
export default UnifiedCommunicationProtocol;
//# sourceMappingURL=UnifiedCommunicationProtocol.d.ts.map