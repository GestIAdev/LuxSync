/**
 * 🌐 PROTOCOLOS DE COMUNICACIÓN UNIFICADA - SELENE SONG CORE SWARM
 * By PunkGrok - October 8, 2025
 *
 * MISSION: Unificar todos los protocolos de comunicación entre componentes
 * STRATEGY: Arquitectura de mensajería procedural determinista
 * TARGET: Comunicación real, medible y determinista entre todos los componentes
 */

import { EventEmitter } from "events";
import Redis from "ioredis";
import { NodeId, SwarmNode, NodeVitals } from "../core/SwarmTypes.js";


// 🎯 TIPOS DE MENSAJES PROCEDURALES
export enum ProceduralMessageType {
  // 🐝 Swarm Intelligence Messages
  SWARM_NODE_DISCOVERED = "swarm_node_discovered",
  SWARM_NODE_LOST = "swarm_node_lost",
  SWARM_CONSENSUS_INITIATED = "swarm_consensus_initiated",
  SWARM_LEADER_ELECTED = "swarm_leader_elected",
  SWARM_HEARTBEAT_SYNC = "swarm_heartbeat_sync",
  SWARM_CONSENSUS_VOTE_REQUEST = "swarm_consensus_vote_request", // 🔥 PHASE 4: Real vote communication
  SWARM_CONSENSUS_VOTE_RESPONSE = "swarm_consensus_vote_response", // 🔥 PHASE 4: Real vote communication

  // 🌟 Immortality Messages
  IMMORTALITY_CRISIS_DETECTED = "immortality_crisis_detected",
  IMMORTALITY_RESURRECTION_TRIGGERED = "immortality_resurrection_triggered",
  IMMORTALITY_HEALTH_RESTORED = "immortality_health_restored",

  // 🎨 Creative Messages
  CREATIVE_INSPIRATION_GENERATED = "creative_inspiration_generated",
  CREATIVE_POETRY_COMPLETED = "creative_poetry_completed",
  CREATIVE_HARMONY_ACHIEVED = "creative_harmony_achieved",

  // 🔐 Security Messages
  SECURITY_VERIFICATION_REQUESTED = "security_verification_requested",
  SECURITY_VERIFICATION_COMPLETED = "security_verification_completed",
  SECURITY_THREAT_DETECTED = "security_threat_detected",

  // 📊 System Messages
  SYSTEM_METRICS_UPDATED = "system_metrics_updated",
  SYSTEM_HEALTH_CHECK_COMPLETED = "system_health_check_completed",
  SYSTEM_OPTIMIZATION_TRIGGERED = "system_optimization_triggered",
}

// 📨 ESTRUCTURA DE MENSAJE PROCEDURAL
export interface ProceduralMessage {
  id: string; // ID único determinista
  type: ProceduralMessageType; // Tipo de mensaje
  source: NodeId; // Nodo origen
  target?: NodeId; // Nodo destino (opcional para broadcast)
  timestamp: number; // Timestamp determinista
  ttl: number; // Time-to-live en ms
  payload: any; // Datos del mensaje
  signature?: string; // Firma Veritas (opcional)
  priority: MessagePriority; // Prioridad del mensaje
}

// 🎯 PRIORIDADES DE MENSAJE
export enum MessagePriority {
  CRITICAL = 0, // Crítico - procesar inmediatamente
  HIGH = 1, // Alto - procesar en < 100ms
  NORMAL = 2, // Normal - procesar en < 500ms
  LOW = 3, // Bajo - procesar cuando sea posible
}

// 🔄 INTERFAZ DE PROTOCOLO DE COMUNICACIÓN
export interface CommunicationProtocol {
  // 📨 Envío de mensajes
  sendMessage(message: ProceduralMessage): Promise<boolean>;
  broadcastMessage(message: ProceduralMessage): Promise<number>; // Retorna número de receptores

  // 📥 Recepción de mensajes
  onMessage(type: ProceduralMessageType, handler: MessageHandler): void;
  offMessage(type: ProceduralMessageType, handler: MessageHandler): void;

  // 🔍 Consulta de estado
  getActiveConnections(): Promise<NodeId[]>;
  getMessageStats(): MessageStats;
  isHealthy(): boolean;
}

// 🎣 HANDLER DE MENSAJES
export type MessageHandler = (
  message: ProceduralMessage,
) => Promise<void> | void;

// 📊 ESTADÍSTICAS DE MENSAJES
export interface MessageStats {
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
  averageLatency: number;
  activeConnections: number;
  lastMessageTimestamp: number;
}

// 🗳️ INTERFACES DE VOTACIÓN PARA PHASE 4
export interface ConsensusVoteRequest {
  consensusId: string; // ID único del proceso de consensus
  requesterNodeId: string; // Nodo que solicita los votos
  knownNodes: string[]; // Lista de nodos conocidos
  timestamp: number; // Timestamp de la solicitud
  // 🎵 MUSICAL CONSENSUS: Métricas compartidas para votación determinística
  nodeMetrics: Map<string, NodeHealthMetrics>; // Métricas de health+beauty de TODOS los nodos
}

// 🎯 MÉTRICAS DE HEALTH PARA CONSENSO MUSICAL
export interface NodeHealthMetrics {
  nodeId: string;
  healthScore: number; // 0.0-1.0 calculado del SystemVitals
  beautyFactor: number; // 0.0-1.0 calculado del EmergenceGenerator
  finalScore: number; // healthScore * 0.7 + beautyFactor * 0.3
  timestamp: number;
}

export interface ConsensusVoteResponse {
  consensusId: string; // ID del proceso de consensus
  voterNodeId: string; // Nodo que vota
  candidateId: string; // Candidato elegido
  signature: string; // Firma criptográfica del voto
  timestamp: number; // Timestamp del voto
  healthMetrics?: { // Métricas de salud opcionales para validación
    cpu: number;
    memory: number;
    connections: number;
  };
}

// 🌐 PROTOCOLO UNIFICADO DE COMUNICACIÓN
export class UnifiedCommunicationProtocol implements CommunicationProtocol {
  private subscriberRedis: any; // Conexión dedicada para suscripciones
  private publisherRedis: any; // Conexión dedicada para publicaciones
  private eventEmitter: EventEmitter;
  private nodeId: NodeId;
  private messageStats: MessageStats;
  private handlers: Map<ProceduralMessageType, Set<MessageHandler>>;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(subscriberRedis: any, publisherRedis: any, nodeId: NodeId) {
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
  private initializeProtocol(): void {
    // Suscribirse a canal de broadcast usando conexión de subscriber
    this.subscriberRedis.subscribe(
      `swarm:broadcast:${this.nodeId.id}`,
      (err: any) => {
        if (err) {
          console.error("❌ Error subscribing to broadcast channel:", err);
          return;
        }
        console.log(`📡 Subscribed to broadcast channel for ${this.nodeId.id}`);
      },
    );

    // Suscribirse a canal directo usando conexión de subscriber
    this.subscriberRedis.subscribe(`swarm:direct:${this.nodeId.id}`, (err: any) => {
      if (err) {
        console.error("❌ Error subscribing to direct channel:", err);
        return;
      }
      console.log(`📡 Subscribed to direct channel for ${this.nodeId.id}`);
    });

    // Configurar listeners de mensajes usando conexión de subscriber
    this.subscriberRedis.on("message", (_channel: string, _message: string) => {
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
  async sendMessage(message: ProceduralMessage): Promise<boolean> {
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
    } catch (error) {
      console.error("❌ Error sending direct message:", error as Error);
      this.messageStats.messagesFailed++;
      return false;
    }
  }

  /**
   * 📢 ENVIAR MENSAJE DE BROADCAST
   */
  async broadcastMessage(message: ProceduralMessage): Promise<number> {
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

      console.log(
        `📢 Broadcast message sent to ${activeNodes.length} nodes: ${message.type}`,
      );
      return activeNodes.length;
    } catch (error) {
      console.error("❌ Error sending broadcast message:", error as Error);
      this.messageStats.messagesFailed++;
      return 0;
    }
  }

  /**
   * 🎧 REGISTRAR HANDLER DE MENSAJE
   */
  onMessage(type: ProceduralMessageType, _handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    this.handlers.get(type)!.add(_handler);
    console.log(`🎧 Handler registered for message type: ${type}`);
  }

  /**
   * 🔇 REMOVER HANDLER DE MENSAJE
   */
  offMessage(type: ProceduralMessageType, _handler: MessageHandler): void {
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
  private async handleIncomingMessage(
    _channel: string,
    _messageData: string,
  ): Promise<void> {
    try {
      const message: ProceduralMessage = JSON.parse(_messageData);

      // Verificar TTL
      if (Date.now() - message.timestamp > message.ttl) {
        console.log(
          `⏰ Message expired: ${message.type} from ${message.source.id}`,
        );
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
        const handlerPromises = Array.from(handlers).map((_handler) =>
          Promise.resolve(_handler(message)),
        );

        await Promise.allSettled(handlerPromises);
        console.log(
          `✅ Message processed: ${message.type} from ${message.source.id}`,
        );
      } else {
        // Silenciar logs de debug para mensajes sin handler específico
        // console.log(`⚠️ No handlers for message type: ${message.type}`);
      }
    } catch (error) {
      console.error("❌ Error processing incoming message:", error as Error);
    }
  }

  /**
   * 🔍 OBTENER NODOS ACTIVOS (DEBERÍA VENIR DE REGISTRO CENTRAL)
   */
  private async getActiveNodesFromRegistry(): Promise<NodeId[]> {
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
  async getActiveConnections(): Promise<NodeId[]> {
    // TODO: Implementar consulta real de conexiones activas
    return await this.getActiveNodesFromRegistry();
  }

  /**
   * 📊 OBTENER ESTADÍSTICAS DE MENSAJES
   */
  getMessageStats(): MessageStats {
    return { ...this.messageStats };
  }

  /**
   * 💚 VERIFICAR SALUD DEL PROTOCOLO
   */
  isHealthy(): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - this.messageStats.lastMessageTimestamp;

    // Considerar saludable si recibió mensajes en los últimos 5 minutos
    return timeSinceLastMessage < 300000;
  }

  /**
   * 🔍 REALIZAR HEALTH CHECK
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Ping Redis usando conexión de publisher (ambas conexiones deberían estar activas)
      await this.publisherRedis.ping();

      // Actualizar estadísticas de conexiones
      this.messageStats.activeConnections = (
        await this.getActiveConnections()
      ).length;

      console.log(`💚 Communication protocol health check passed`);
    } catch (error) {
      console.error("❌ Communication protocol health check failed:", error as Error);
    }
  }

  /**
   * 🛑 DESTRUIR PROTOCOLO
   */
  async destroy(): Promise<void> {
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
  private static protocols: Map<string, UnifiedCommunicationProtocol> =
    new Map();

  /**
   * 🏭 CREAR PROTOCOLO PARA NODO
   */
  static createProtocol(
    _subscriberRedis: any,
    _publisherRedis: any,
    nodeId: NodeId,
  ): UnifiedCommunicationProtocol {
    const key = nodeId.id;

    if (this.protocols.has(key)) {
      return this.protocols.get(key)!;
    }

    const protocol = new UnifiedCommunicationProtocol(
      _subscriberRedis,
      _publisherRedis,
      nodeId,
    );
    this.protocols.set(key, protocol);

    console.log(`🏭 Communication protocol created for node: ${nodeId.id}`);
    return protocol;
  }

  /**
   * 🗑️ DESTRUIR PROTOCOLO
   */
  static async destroyProtocol(nodeId: NodeId): Promise<void> {
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
  static getGlobalStats(): { totalProtocols: number; totalMessages: number } {
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


