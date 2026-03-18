export class WhiskerVibrationalEngine {
    redis;
    myNodeId;
    vitalsKeyPrefix = 'swarm:vitals:';
    vitalsTTL = 30; // 30 segundos TTL para vitals
    constructor(redis, nodeId) {
        this.redis = redis;
        this.myNodeId = nodeId;
    }
    /**
     * 📡 PUBLICAR VITALS del nodo actual
     */
    async publishVitals(cpu, memory, health, uptime) {
        const vitalsKey = `${this.vitalsKeyPrefix}${this.myNodeId}`;
        try {
            const vitals = {
                nodeId: this.myNodeId,
                cpu,
                memory,
                health,
                uptime,
                lastSeen: new Date(),
            };
            await this.redis.hmset(vitalsKey, {
                nodeId: vitals.nodeId,
                cpu: vitals.cpu.toString(),
                memory: vitals.memory.toString(),
                health: vitals.health.toString(),
                uptime: vitals.uptime.toString(),
                lastSeen: vitals.lastSeen.toISOString(),
            });
            // TTL para cleanup automático
            await this.redis.expire(vitalsKey, this.vitalsTTL);
            console.log(`🐱 [WHISKER] Vitals published: CPU ${(cpu * 100).toFixed(1)}%, MEM ${(memory * 100).toFixed(1)}%, Health ${(health * 100).toFixed(1)}%`);
        }
        catch (error) {
            console.error('🐱 [WHISKER-PUBLISH-ERROR]:', error);
        }
    }
    /**
     * 🌐 ESCANEAR ENTORNO: Leer vitals de todos los nodos
     */
    async scanEnvironment() {
        try {
            // Obtener todas las keys de vitals
            const vitalsKeys = await this.redis.keys(`${this.vitalsKeyPrefix}*`);
            if (vitalsKeys.length === 0) {
                return {
                    nearbyNodes: [],
                    weakNodes: [],
                    avgClusterHealth: 0,
                    myPosition: 'isolated',
                };
            }
            const allNodes = [];
            let totalHealth = 0;
            // Leer vitals de cada nodo
            for (const key of vitalsKeys) {
                const nodeId = key.replace(this.vitalsKeyPrefix, '');
                const vitals = await this.readNodeVitals(nodeId);
                if (vitals) {
                    allNodes.push(vitals);
                    totalHealth += vitals.health;
                }
            }
            const avgClusterHealth = allNodes.length > 0 ? totalHealth / allNodes.length : 0;
            // Filtrar nodos cercanos (todos los nodos son candidatos)
            const nearbyNodes = this.findNearbyNodes(allNodes);
            const weakNodes = allNodes.filter(n => n.health < 0.5);
            // Determinar mi posición
            const myPosition = this.determineMyPosition(allNodes, avgClusterHealth);
            return {
                nearbyNodes,
                weakNodes,
                avgClusterHealth,
                myPosition,
            };
        }
        catch (error) {
            console.error('🐱 [WHISKER-SCAN-ERROR]:', error);
            return {
                nearbyNodes: [],
                weakNodes: [],
                avgClusterHealth: 0,
                myPosition: 'isolated',
            };
        }
    }
    /**
     * 📖 LEER VITALS de un nodo específico
     */
    async readNodeVitals(nodeId) {
        const vitalsKey = `swarm:vitals:${nodeId}`;
        try {
            const data = await this.redis.get(vitalsKey);
            if (!data) {
                return null;
            }
            const parsed = JSON.parse(data);
            // Adaptar formato SwarmVitalsPublisher al formato esperado
            return {
                nodeId: parsed.nodeId,
                cpu: parsed.vitals.load.cpu,
                memory: parsed.vitals.load.memory,
                health: parsed.vitals.health === 'healthy' ? 1.0 : 0.5, // Convertir string a number
                uptime: parsed.vitals.uptime,
                lastSeen: new Date(parsed.timestamp),
            };
        }
        catch (error) {
            console.error(`🐱 [WHISKER-READ-ERROR] ${nodeId}:`, error);
            return null;
        }
    }
    /**
     * 🔍 ENCONTRAR NODOS CERCANOS (similitud en recursos)
     */
    findNearbyNodes(allNodes) {
        if (allNodes.length <= 1)
            return [];
        // Usar el primer nodo como referencia para calcular proximidad
        // En un sistema real, esto sería el nodo actual
        const referenceNode = allNodes[0];
        const otherNodes = allNodes.filter(n => n.nodeId !== referenceNode.nodeId);
        // Calcular similitud basada en CPU, memory y health
        const nearby = otherNodes.map(node => {
            const cpuDiff = Math.abs(node.cpu - referenceNode.cpu);
            const memDiff = Math.abs(node.memory - referenceNode.memory);
            const healthDiff = Math.abs(node.health - referenceNode.health);
            // Score de proximidad (0-1, 1 = idéntico)
            const proximityScore = 1 - ((cpuDiff + memDiff + healthDiff) / 3);
            return { node, proximityScore };
        });
        // Filtrar nodos con proximidad > 0.7 (70% similar)
        return nearby
            .filter(item => item.proximityScore > 0.7)
            .sort((a, b) => b.proximityScore - a.proximityScore)
            .map(item => item.node);
    }
    /**
     * 👑 DETERMINAR MI POSICIÓN en el cluster
     */
    determineMyPosition(allNodes, avgClusterHealth) {
        if (allNodes.length === 0)
            return 'isolated';
        // Si hay nodos activos, no estamos aislados
        if (allNodes.length >= 1) {
            // Si somos el único nodo, somos leader por defecto
            if (allNodes.length === 1)
                return 'leader';
            // Si hay múltiples nodos, determinar posición basada en health promedio
            // Como no tenemos nuestros propios vitals, usar lógica simplificada
            if (avgClusterHealth > 0.8)
                return 'leader';
            if (avgClusterHealth > 0.6)
                return 'follower';
            return 'follower'; // Default para clusters con health baja
        }
        return 'isolated';
    }
    /**
     * 📡 DETECTAR ANOMALÍAS en el cluster
     */
    async detectAnomalies() {
        const report = await this.scanEnvironment();
        const issues = [];
        // Verificar nodos débiles
        if (report.weakNodes.length > 0) {
            issues.push(`${report.weakNodes.length} weak nodes detected (health < 50%)`);
        }
        // Verificar health promedio baja
        if (report.avgClusterHealth < 0.6) {
            issues.push(`Low cluster health: ${(report.avgClusterHealth * 100).toFixed(1)}%`);
        }
        // Verificar aislamiento
        if (report.myPosition === 'isolated') {
            issues.push('Node is isolated - no other active nodes detected');
        }
        // Verificar falta de proximidad
        if (report.nearbyNodes.length === 0 && report.myPosition !== 'isolated') {
            issues.push('No nearby nodes with similar resource usage');
        }
        return {
            hasAnomalies: issues.length > 0,
            issues,
        };
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS del sensor
     */
    async getStats() {
        const report = await this.scanEnvironment();
        return {
            activeNodes: report.nearbyNodes.length + report.weakNodes.length + 1, // +1 para mí mismo
            nearbyNodes: report.nearbyNodes.length,
            weakNodes: report.weakNodes.length,
            avgClusterHealth: report.avgClusterHealth,
            myPosition: report.myPosition,
            vitalsTTL: this.vitalsTTL,
        };
    }
}
//# sourceMappingURL=WhiskerVibrationalEngine.js.map