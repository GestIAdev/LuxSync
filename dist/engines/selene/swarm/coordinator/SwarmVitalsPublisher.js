// 🌟 SWARM VITALS PUBLISHER - Publica métricas reales de nodos a Redis
// Para compartir datos de salud entre nodos multinodales
// 🔥 AXIOMA ANTI-SIMULACIÓN: Solo datos reales, no simulaciones
import * as process from "process";
import { timerManager } from "../../shared/TimerManager.js";
export class SwarmVitalsPublisher {
    nodeId;
    redis;
    systemVitals;
    publishIntervalId = null;
    publishInterval = 30000; // 30 segundos - REDUCED spam
    vitalsTTL = 30000; // 30 segundos TTL
    constructor(nodeId, redis, systemVitals, options = {}) {
        this.nodeId = nodeId;
        this.redis = redis;
        this.systemVitals = systemVitals;
        if (options.publishInterval)
            this.publishInterval = options.publishInterval;
        if (options.vitalsTTL)
            this.vitalsTTL = options.vitalsTTL;
        console.log(`📡 SwarmVitalsPublisher initialized for node ${nodeId.id}`);
        console.log(`⏱️ Publish interval: ${this.publishInterval}ms, TTL: ${this.vitalsTTL}ms`);
    }
    /**
     * 🚀 Iniciar publicación periódica de vitals
     */
    async start() {
        if (this.publishIntervalId) {
            console.warn("⚠️ SwarmVitalsPublisher already started");
            return;
        }
        console.log("🚀 Starting SwarmVitalsPublisher...");
        // Publicar inmediatamente al iniciar
        await this.publishVitals();
        // Configurar publicación periódica
        this.publishIntervalId = timerManager.setInterval(async () => {
            try {
                await this.publishVitals();
            }
            catch (error) {
                console.error("❌ Error publishing vitals:", error);
            }
        }, this.publishInterval, `swarm_vitals_publisher_${this.nodeId.id}`);
        console.log("✅ SwarmVitalsPublisher started - Publishing real vitals every 5 seconds");
    }
    /**
     * 🛑 Detener publicación de vitals
     */
    async stop() {
        if (this.publishIntervalId) {
            timerManager.clear(this.publishIntervalId);
            this.publishIntervalId = null;
            console.log("🛑 SwarmVitalsPublisher stopped");
        }
        // Limpiar vitals publicados
        await this.clearPublishedVitals();
    }
    /**
     * 📡 Publicar vitals actuales del nodo a Redis
     */
    async publishVitals() {
        try {
            // 🔥 OBTENER MÉTRICAS REALES DEL SISTEMA - NO SIMULACIONES
            const metrics = this.systemVitals.getCurrentMetrics();
            const vitalSigns = this.systemVitals.getCurrentVitalSigns();
            // 🏥 CALCULAR SALUD REAL BASADA EN MÉTRICAS ACTUALES
            const cpuHealth = 1.0 - metrics.cpu.usage;
            const memoryHealth = 1.0 - metrics.memory.usage;
            const connectionHealth = Math.min(metrics.network.connections / 100, 1.0);
            const latencyHealth = Math.max(0, 1.0 - metrics.network.latency / 1000);
            const errorHealth = 1.0 - Math.min(metrics.errors.rate / 10, 1.0);
            // 🔥 DETERMINAR ESTADO DE SALUD REAL
            let healthStatus;
            const overallHealth = (cpuHealth + memoryHealth + connectionHealth + latencyHealth + errorHealth) / 5;
            if (overallHealth >= 0.9)
                healthStatus = "optimal";
            else if (overallHealth >= 0.7)
                healthStatus = "healthy";
            else if (overallHealth >= 0.5)
                healthStatus = "warning";
            else if (overallHealth >= 0.3)
                healthStatus = "critical";
            else
                healthStatus = "failing";
            // 📊 CREAR VITALS REALES
            const realVitals = {
                health: healthStatus,
                load: {
                    cpu: metrics.cpu.usage,
                    memory: metrics.memory.usage,
                    network: metrics.network.latency,
                    storage: 0.5, // Estimación base
                },
                connections: metrics.network.connections,
                uptime: process.uptime(),
                lastConsensus: new Date(),
            };
            // 🔥 PUBLICAR A REDIS CON TTL
            const vitalsKey = `swarm:vitals:${this.nodeId.id}`;
            const vitalsData = {
                nodeId: this.nodeId.id,
                vitals: realVitals,
                timestamp: Date.now(),
                publisher: this.nodeId.id,
            };
            await this.redis.set(vitalsKey, JSON.stringify(vitalsData), 'PX', this.vitalsTTL);
            console.log(`📡 [VITALS-PUBLISHED] Node ${this.nodeId.id} health: ${healthStatus} (${(overallHealth * 100).toFixed(1)}%)`);
        }
        catch (error) {
            console.error(`❌ [VITALS-PUBLISH-ERROR] Failed to publish vitals for ${this.nodeId.id}:`, error);
        }
    }
    /**
     * 🧹 Limpiar vitals publicados al detener
     */
    async clearPublishedVitals() {
        try {
            const vitalsKey = `swarm:vitals:${this.nodeId.id}`;
            await this.redis.del(vitalsKey);
            console.log(`🧹 Cleared published vitals for ${this.nodeId.id}`);
        }
        catch (error) {
            console.error("❌ Error clearing published vitals:", error);
        }
    }
    /**
     * 🔍 Obtener vitals publicados por otro nodo (para debugging)
     */
    async getPublishedVitals(nodeId) {
        try {
            const vitalsKey = `swarm:vitals:${nodeId}`;
            const data = await this.redis.get(vitalsKey);
            if (data) {
                const parsed = JSON.parse(data);
                return parsed.vitals;
            }
            return null;
        }
        catch (error) {
            console.error(`❌ Error getting published vitals for ${nodeId}:`, error);
            return null;
        }
    }
    /**
     * 📊 Obtener estado del publisher
     */
    getStatus() {
        return {
            active: this.publishIntervalId !== null,
            nodeId: this.nodeId.id,
            publishInterval: this.publishInterval,
            vitalsTTL: this.vitalsTTL,
        };
    }
}
//# sourceMappingURL=SwarmVitalsPublisher.js.map