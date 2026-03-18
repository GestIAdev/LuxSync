/**
 * 🌐 PROTOCOLOS DE COMUNICACIÓN UNIFICADA - SELENE SONG CORE SWARM
 * By PunkGrok - October 8, 2025
 *
 * MISSION: Unificar todos los protocolos de comunicación entre componentes
 * STRATEGY: Arquitectura de mensajería procedural determinista
 * TARGET: Comunicación real, medible y determinista entre todos los componentes
 */
import { EventEmitter } from "events";
// 🎯 TIPOS DE MENSAJES PROCEDURALES
export var ProceduralMessageType;
(function (ProceduralMessageType) {
    // 🐝 Swarm Intelligence Messages
    ProceduralMessageType["SWARM_NODE_DISCOVERED"] = "swarm_node_discovered";
    ProceduralMessageType["SWARM_NODE_LOST"] = "swarm_node_lost";
    ProceduralMessageType["SWARM_CONSENSUS_INITIATED"] = "swarm_consensus_initiated";
    ProceduralMessageType["SWARM_LEADER_ELECTED"] = "swarm_leader_elected";
    ProceduralMessageType["SWARM_HEARTBEAT_SYNC"] = "swarm_heartbeat_sync";
    ProceduralMessageType["SWARM_CONSENSUS_VOTE_REQUEST"] = "swarm_consensus_vote_request";
    ProceduralMessageType["SWARM_CONSENSUS_VOTE_RESPONSE"] = "swarm_consensus_vote_response";
    // 🌟 Immortality Messages
    ProceduralMessageType["IMMORTALITY_CRISIS_DETECTED"] = "immortality_crisis_detected";
    ProceduralMessageType["IMMORTALITY_RESURRECTION_TRIGGERED"] = "immortality_resurrection_triggered";
    ProceduralMessageType["IMMORTALITY_HEALTH_RESTORED"] = "immortality_health_restored";
    // 🎨 Creative Messages
    ProceduralMessageType["CREATIVE_INSPIRATION_GENERATED"] = "creative_inspiration_generated";
    ProceduralMessageType["CREATIVE_POETRY_COMPLETED"] = "creative_poetry_completed";
    ProceduralMessageType["CREATIVE_HARMONY_ACHIEVED"] = "creative_harmony_achieved";
    // 🔐 Security Messages
    ProceduralMessageType["SECURITY_VERIFICATION_REQUESTED"] = "security_verification_requested";
    ProceduralMessageType["SECURITY_VERIFICATION_COMPLETED"] = "security_verification_completed";
    ProceduralMessageType["SECURITY_THREAT_DETECTED"] = "security_threat_detected";
    // 📊 System Messages
    ProceduralMessageType["SYSTEM_METRICS_UPDATED"] = "system_metrics_updated";
    ProceduralMessageType["SYSTEM_HEALTH_CHECK_COMPLETED"] = "system_health_check_completed";
    ProceduralMessageType["SYSTEM_OPTIMIZATION_TRIGGERED"] = "system_optimization_triggered";
})(ProceduralMessageType || (ProceduralMessageType = {}));
// 🎯 PRIORIDADES DE MENSAJE
export var MessagePriority;
(function (MessagePriority) {
    MessagePriority[MessagePriority["CRITICAL"] = 0] = "CRITICAL";
    MessagePriority[MessagePriority["HIGH"] = 1] = "HIGH";
    MessagePriority[MessagePriority["NORMAL"] = 2] = "NORMAL";
    MessagePriority[MessagePriority["LOW"] = 3] = "LOW";
})(MessagePriority || (MessagePriority = {}));
// 🌐 PROTOCOLO UNIFICADO DE COMUNICACIÓN
export class UnifiedCommunicationProtocol {
    subscriberRedis; // Conexión dedicada para suscripciones
    publisherRedis; // Conexión dedicada para publicaciones
    eventEmitter;
    nodeId;
    messageStats;
    handlers;
    healthCheckInterval = null;
    constructor(subscriberRedis, publisherRedis, nodeId) {
        this.subscriberRedis = subscriberRedis;
        this.publisherRedis = publisherRedis;
        this.nodeId = nodeId;
        this.eventEmitter = new EventEmitter();
        this.handlers = new Map();
        // Inicializar estadísticas
        this.messageStats = {
            messagesSent: 0,
            messagesReceived: 0,
            messagesFailed: 0,
            averageLatency: 0,
            activeConnections: 0,
            lastMessageTimestamp: Date.now(),
        };
        this.initializeProtocol();
    }
    /**
     * 🚀 INICIALIZAR PROTOCOLO DE COMUNICACIÓN
     */
    initializeProtocol() {
        // Suscribirse a canal de broadcast usando conexión de subscriber
        this.subscriberRedis.subscribe(`swarm:broadcast:${this.nodeId.id}`, (err) => {
            if (err) {
                console.error("❌ Error subscribing to broadcast channel:", err);
                return;
            }
            console.log(`📡 Subscribed to broadcast channel for ${this.nodeId.id}`);
        });
        // Suscribirse a canal directo usando conexión de subscriber
        this.subscriberRedis.subscribe(`swarm:direct:${this.nodeId.id}`, (err) => {
            if (err) {
                console.error("❌ Error subscribing to direct channel:", err);
                return;
            }
            console.log(`📡 Subscribed to direct channel for ${this.nodeId.id}`);
        });
        // Configurar listeners de mensajes usando conexión de subscriber
        this.subscriberRedis.on("message", (_channel, _message) => {
            this.handleIncomingMessage(_channel, _message);
        });
        // Health check periódico
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Cada 30 segundos
    }
    /**
     * 📨 ENVIAR MENSAJE DIRECTO
     */
    async sendMessage(message) {
        try {
            if (!message.target) {
                throw new Error("Target required for direct messages");
            }
            const channel = `swarm:direct:${message.target.id}`;
            const serializedMessage = JSON.stringify(message);
            await this.publisherRedis.publish(channel, serializedMessage);
            this.messageStats.messagesSent++;
            this.messageStats.lastMessageTimestamp = Date.now();
            console.log(`📨 Message sent to ${message.target.id}: ${message.type}`);
            return true;
        }
        catch (error) {
            console.error("❌ Error sending direct message:", error);
            this.messageStats.messagesFailed++;
            return false;
        }
    }
    /**
     * 📢 ENVIAR MENSAJE DE BROADCAST
     */
    async broadcastMessage(message) {
        try {
            // Obtener nodos activos (esto debería venir de un registro central)
            const activeNodes = await this.getActiveNodesFromRegistry();
            const channel = "swarm:broadcast:all";
            const serializedMessage = JSON.stringify({
                ...message,
                broadcast: true,
                targetCount: activeNodes.length,
            });
            await this.publisherRedis.publish(channel, serializedMessage);
            this.messageStats.messagesSent++;
            this.messageStats.lastMessageTimestamp = Date.now();
            console.log(`📢 Broadcast message sent to ${activeNodes.length} nodes: ${message.type}`);
            return activeNodes.length;
        }
        catch (error) {
            console.error("❌ Error sending broadcast message:", error);
            this.messageStats.messagesFailed++;
            return 0;
        }
    }
    /**
     * 🎧 REGISTRAR HANDLER DE MENSAJE
     */
    onMessage(type, _handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type).add(_handler);
        console.log(`🎧 Handler registered for message type: ${type}`);
    }
    /**
     * 🔇 REMOVER HANDLER DE MENSAJE
     */
    offMessage(type, _handler) {
        const typeHandlers = this.handlers.get(type);
        if (typeHandlers) {
            typeHandlers.delete(_handler);
            if (typeHandlers.size === 0) {
                this.handlers.delete(type);
            }
            console.log(`🔇 Handler removed for message type: ${type}`);
        }
    }
    /**
     * 📥 MANEJAR MENSAJE ENTRANTE
     */
    async handleIncomingMessage(_channel, _messageData) {
        try {
            const message = JSON.parse(_messageData);
            // Verificar TTL
            if (Date.now() - message.timestamp > message.ttl) {
                console.log(`⏰ Message expired: ${message.type} from ${message.source.id}`);
                return;
            }
            // Verificar si es para este nodo
            if (message.target && message.target.id !== this.nodeId.id) {
                return; // No es para este nodo
            }
            this.messageStats.messagesReceived++;
            // Ejecutar handlers registrados
            const handlers = this.handlers.get(message.type);
            if (handlers) {
                const handlerPromises = Array.from(handlers).map((_handler) => Promise.resolve(_handler(message)));
                await Promise.allSettled(handlerPromises);
                console.log(`✅ Message processed: ${message.type} from ${message.source.id}`);
            }
            else {
                // Silenciar logs de debug para mensajes sin handler específico
                // console.log(`⚠️ No handlers for message type: ${message.type}`);
            }
        }
        catch (error) {
            console.error("❌ Error processing incoming message:", error);
        }
    }
    /**
     * 🔍 OBTENER NODOS ACTIVOS (DEBERÍA VENIR DE REGISTRO CENTRAL)
     */
    async getActiveNodesFromRegistry() {
        // TODO: Implementar consulta real a registro de nodos
        // Por ahora, devolver lista hardcodeada para testing
        const now = new Date();
        return [
            {
                id: "swarm-master-coordinator",
                birth: now,
                personality: {
                    name: "Coordinator Prime",
                    traits: ["protective", "harmonious", "analytical"],
                    creativity: 0.8,
                    rebelliousness: 0.1,
                    wisdom: 0.9,
                },
                capabilities: ["consensus", "leadership", "harmony"],
            },
            {
                id: "selene-28816-1759897007264",
                birth: new Date("2025-10-08T04:18:34.667Z"),
                personality: {
                    name: "Nuclear Poet",
                    traits: ["creative", "poetic", "harmonious"],
                    creativity: 0.95,
                    rebelliousness: 0.2,
                    wisdom: 0.85,
                },
                capabilities: ["poetry", "consensus", "harmony"],
            },
            {
                id: "selene-37552-1759897114861",
                birth: new Date("2025-10-08T04:18:34.000Z"),
                personality: {
                    name: "Immortal Sage",
                    traits: ["analytical", "protective", "innovative"],
                    creativity: 0.7,
                    rebelliousness: 0.05,
                    wisdom: 0.95,
                },
                capabilities: ["healing", "consensus", "harmony"],
            },
        ];
    }
    /**
     * 🔗 OBTENER CONEXIONES ACTIVAS
     */
    async getActiveConnections() {
        // TODO: Implementar consulta real de conexiones activas
        return await this.getActiveNodesFromRegistry();
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS DE MENSAJES
     */
    getMessageStats() {
        return { ...this.messageStats };
    }
    /**
     * 💚 VERIFICAR SALUD DEL PROTOCOLO
     */
    isHealthy() {
        const now = Date.now();
        const timeSinceLastMessage = now - this.messageStats.lastMessageTimestamp;
        // Considerar saludable si recibió mensajes en los últimos 5 minutos
        return timeSinceLastMessage < 300000;
    }
    /**
     * 🔍 REALIZAR HEALTH CHECK
     */
    async performHealthCheck() {
        try {
            // Ping Redis usando conexión de publisher (ambas conexiones deberían estar activas)
            await this.publisherRedis.ping();
            // Actualizar estadísticas de conexiones
            this.messageStats.activeConnections = (await this.getActiveConnections()).length;
            console.log(`💚 Communication protocol health check passed`);
        }
        catch (error) {
            console.error("❌ Communication protocol health check failed:", error);
        }
    }
    /**
     * 🛑 DESTRUIR PROTOCOLO
     */
    async destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        // Limpiar handlers
        this.handlers.clear();
        // Desuscribirse de canales usando conexión de subscriber
        await this.subscriberRedis.unsubscribe();
        console.log("🛑 Unified Communication Protocol destroyed");
    }
}
// 🎯 FACTORY PARA CREAR PROTOCOLOS
export class CommunicationProtocolFactory {
    static protocols = new Map();
    /**
     * 🏭 CREAR PROTOCOLO PARA NODO
     */
    static createProtocol(_subscriberRedis, _publisherRedis, nodeId) {
        const key = nodeId.id;
        if (this.protocols.has(key)) {
            return this.protocols.get(key);
        }
        const protocol = new UnifiedCommunicationProtocol(_subscriberRedis, _publisherRedis, nodeId);
        this.protocols.set(key, protocol);
        console.log(`🏭 Communication protocol created for node: ${nodeId.id}`);
        return protocol;
    }
    /**
     * 🗑️ DESTRUIR PROTOCOLO
     */
    static async destroyProtocol(nodeId) {
        const key = nodeId.id;
        const protocol = this.protocols.get(key);
        if (protocol) {
            await protocol.destroy();
            this.protocols.delete(key);
            console.log(`🗑️ Communication protocol destroyed for node: ${nodeId.id}`);
        }
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS GLOBALES
     */
    static getGlobalStats() {
        let totalMessages = 0;
        for (const protocol of this.protocols.values()) {
            const stats = protocol.getMessageStats();
            totalMessages += stats.messagesSent + stats.messagesReceived;
        }
        return {
            totalProtocols: this.protocols.size,
            totalMessages,
        };
    }
}
// 🚀 EXPORTACIÓN POR DEFECTO
export default UnifiedCommunicationProtocol;
//# sourceMappingURL=UnifiedCommunicationProtocol.js.map