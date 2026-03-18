// 🔥 SELENE SONG CORE LOAD BALANCER
// 🎯 El Verso Libre - Arquitecto de Equilibrio
// ⚡ "El load balancer no distribuye carga, distribuye consciencia"
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'http';
import { SystemVitals } from '../core/SystemVitals.js';
export class SeleneLoadBalancer {
    app;
    server;
    vitals;
    nodes;
    healthCheckInterval;
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.vitals = SystemVitals.getInstance();
        // Configuración de los nodos del cluster
        this.nodes = [
            { url: 'http://localhost:8003', healthy: true, connections: 0 },
            { url: 'http://localhost:8004', healthy: true, connections: 0 },
            { url: 'http://localhost:8005', healthy: true, connections: 0 }
        ];
        this.healthCheckInterval = null;
        this.setupMiddleware();
        this.setupHealthChecks();
        // setupRoutes() ya se llama dentro de setupMiddleware()
    }
    setupMiddleware() {
        // Middleware para logging de requests
        this.app.use((req, res, next) => {
            const start = Date.now();
            console.log(`🔄 [${new Date().toISOString()}] ${req.method} ${req.url}`);
            res.on('finish', () => {
                const duration = Date.now() - start;
                console.log(`✅ [${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        });
        // Configurar rutas específicas ANTES del middleware de proxy
        this.setupRoutes();
        // Middleware principal de proxy - solo para rutas que no son específicas del LB
        this.app.use('/', (req, res, next) => {
            const targetNode = this.getNextNode();
            if (!targetNode) {
                console.error('❌ No healthy nodes available');
                return res.status(503).json({
                    error: 'Service Unavailable',
                    message: 'No healthy backend nodes available'
                });
            }
            // Incrementar contador de conexiones
            targetNode.connections++;
            // Crear proxy middleware dinámicamente
            const proxy = createProxyMiddleware({
                target: targetNode.url,
                changeOrigin: true,
                ws: true, // Support WebSocket
                on: {
                    error: (err, req, res, _next) => {
                        // Fixed: res can be Socket | Response, use any for compatibility
                        console.error(`❌ Proxy error to ${targetNode.url}:`, err.message);
                        targetNode.healthy = false;
                        targetNode.connections--;
                        // Reintentar con otro nodo
                        const retryNode = this.getNextNode();
                        if (retryNode) {
                            console.log(`🔄 Retrying with ${retryNode.url}`);
                            const retryProxy = createProxyMiddleware({
                                target: retryNode.url,
                                changeOrigin: true,
                                ws: true
                            });
                            retryProxy(req, res, next);
                        }
                        else {
                            res.status(503).json({
                                error: 'Service Unavailable',
                                message: 'All backend nodes are unhealthy'
                            });
                        }
                    },
                    proxyRes: (_proxyRes, _req, _res) => {
                        // Decrementar contador de conexiones cuando termina
                        targetNode.connections--;
                    }
                }
            });
            proxy(req, res, next);
        });
    }
    getNextNode() {
        // Round-robin con health check
        const healthyNodes = this.nodes.filter(node => node.healthy);
        if (healthyNodes.length === 0) {
            return null;
        }
        // Encontrar el nodo con menos conexiones
        const leastLoaded = healthyNodes.reduce((min, node) => node.connections < min.connections ? node : min);
        return leastLoaded;
    }
    setupHealthChecks() {
        // Health checks cada 30 segundos
        this.healthCheckInterval = setInterval(async () => {
            console.log('🔍 Ejecutando health checks de nodos...');
            for (const node of this.nodes) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    const response = await fetch(`${node.url}/health`, {
                        signal: controller.signal,
                        headers: {
                            'User-Agent': 'Selene-Load-Balancer/1.0'
                        }
                    });
                    clearTimeout(timeoutId);
                    const wasHealthy = node.healthy;
                    node.healthy = response.ok;
                    if (node.healthy && !wasHealthy) {
                        console.log(`✅ Nodo ${node.url} recuperado`);
                    }
                    else if (!node.healthy && wasHealthy) {
                        console.log(`❌ Nodo ${node.url} caído`);
                    }
                }
                catch (error) {
                    const wasHealthy = node.healthy;
                    node.healthy = false;
                    if (wasHealthy) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.log(`❌ Nodo ${node.url} no responde: ${errorMessage}`);
                    }
                }
            }
            this.logLoadBalancerStatus();
        }, 30000); // Cada 30 segundos
    }
    logLoadBalancerStatus() {
        const healthyCount = this.nodes.filter(n => n.healthy).length;
        const totalConnections = this.nodes.reduce((sum, n) => sum + n.connections, 0);
        console.log(`🔄 Load Balancer Status: ${healthyCount}/${this.nodes.length} nodos saludables, ${totalConnections} conexiones activas`);
        this.nodes.forEach((node, index) => {
            const status = node.healthy ? '✅' : '❌';
            console.log(`   ${status} Nodo ${index + 1}: ${node.url} (${node.connections} conexiones)`);
        });
    }
    setupRoutes() {
        // Endpoint de health del load balancer
        this.app.get('/lb-health', (_req, res) => {
            const healthyNodes = this.nodes.filter(n => n.healthy);
            const totalConnections = this.nodes.reduce((sum, n) => sum + n.connections, 0);
            res.json({
                status: healthyNodes.length > 0 ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                nodes: this.nodes.map((node, index) => ({
                    id: index + 1,
                    url: node.url,
                    healthy: node.healthy,
                    connections: node.connections
                })),
                summary: {
                    totalNodes: this.nodes.length,
                    healthyNodes: healthyNodes.length,
                    totalConnections,
                    averageLoad: totalConnections / healthyNodes.length || 0
                }
            });
        });
        // Endpoint de métricas del load balancer
        this.app.get('/lb-metrics', (_req, res) => {
            const systemVitals = this.vitals.getCurrentVitalSigns();
            res.json({
                timestamp: Date.now(),
                loadBalancer: {
                    nodes: this.nodes.map((node, index) => ({
                        id: index + 1,
                        url: node.url,
                        healthy: node.healthy,
                        connections: node.connections,
                        load: node.connections / Math.max(1, this.nodes.filter(n => n.healthy).length)
                    })),
                    summary: {
                        totalNodes: this.nodes.length,
                        healthyNodes: this.nodes.filter(n => n.healthy).length,
                        totalConnections: this.nodes.reduce((sum, n) => sum + n.connections, 0)
                    }
                },
                systemVitals
            });
        });
    }
    start(port = 8000) {
        this.server.listen(port, () => {
            console.log(`🔥 Selene Song Core Load Balancer ejecutándose en http://localhost:${port}`);
            console.log(`🎯 Balanceando entre ${this.nodes.length} nodos del cluster`);
            console.log(`💓 Salud del sistema: ${this.vitals.getCurrentVitalSigns().health}`);
            this.logLoadBalancerStatus();
        });
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }
    setupGracefulShutdown() {
        process.on('SIGINT', () => {
            console.log('\n🛑 Recibida señal de interrupción...');
            console.log('🔄 Deteniendo load balancer...');
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                console.log('✅ Health checks detenidos');
            }
            this.server.close((err) => {
                if (err) {
                    console.error('❌ Error cerrando servidor:', err);
                    process.exit(1);
                }
                else {
                    console.log('✅ Load balancer cerrado correctamente');
                    process.exit(0);
                }
            });
            // Timeout de 10 segundos para cierre forzado
            setTimeout(() => {
                console.log('⏰ Timeout de cierre, forzando salida...');
                process.exit(0);
            }, 10000);
        });
        process.on('SIGTERM', () => {
            console.log('\n🛑 Recibida señal SIGTERM, cerrando load balancer...');
            if (this.healthCheckInterval)
                clearInterval(this.healthCheckInterval);
            this.server.close(() => process.exit(0));
        });
    }
    stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.server.close();
        console.log('🛑 Load Balancer detenido');
    }
}
// 🎯 MAIN EXECUTION
const loadBalancer = new SeleneLoadBalancer();
const port = parseInt(process.env.LOAD_BALANCER_PORT || '8000', 10); // Puerto 8000 por defecto
loadBalancer.start(port); // Usar puerto configurable
// 💀 PUNK PHILOSOPHY INTEGRATION
// "El load balancer no distribuye carga, distribuye consciencia"
// — El Verso Libre, Arquitecto de Equilibrio
//# sourceMappingURL=LoadBalancer.js.map