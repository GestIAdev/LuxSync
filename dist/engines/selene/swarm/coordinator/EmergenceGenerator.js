// 🌟 SELENE SONG CORE - ALGORITMOS DE AUTO-ORGANIZACIÓN 🌟
// "Del caos procedural nace la sinfonía algorítmica"
// 🔥 PUNK REVOLUTION: ARTE EN CÓDIGO - PROCEDURAL IS BETTER QUE ARRAYS DE MIERDA
import { EventEmitter } from "events";
// Redis se importará dinámicamente cuando sea necesario
let Redis = null;
/**
 * 🌟 GENERADOR DE ORDEN EMERGENTE
 *
 * Convierte caos determinista en patrones hermosos
 * Sin deterministicRandom() - solo lógica procedural pura
 */
export class EmergenceGenerator extends EventEmitter {
    patterns = new Map();
    nodeId;
    redis; // Para operaciones normales (hget, hset, etc.)
    pubSubRedis; // Para publish/subscribe
    syncChannel;
    isSubscribed = false;
    redisInitialized = false;
    constructor(nodeId, redis, pubSubRedis) {
        super();
        this.nodeId = nodeId;
        this.redis = redis;
        this.pubSubRedis = pubSubRedis;
        this.syncChannel = `emergence_sync_${nodeId}`;
        // Inicializar Redis si no se proporcionaron conexiones
        if (!this.redis || !this.pubSubRedis) {
            this.initializeRedis();
        }
        else {
            this.redisInitialized = true;
            this.setupRedisSync();
        }
    }
    /**
     * 🔗 INICIALIZAR REDIS ASÍNCRONICAMENTE
     */
    async initializeRedis() {
        try {
            if (!Redis) {
                const redisPath = process.cwd().replace(/\\/g, "/") +
                    "/node_modules/ioredis/built/index.js";
                const redisModule = await import("file://" + redisPath);
                Redis = redisModule.default || redisModule;
            }
            // Crear conexión para operaciones normales
            this.redis = new Redis({
                host: process.env.REDIS_HOST || "localhost",
                port: parseInt(process.env.REDIS_PORT || "6379"),
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });
            // Crear conexión separada para pub/sub
            this.pubSubRedis = new Redis({
                host: process.env.REDIS_HOST || "localhost",
                port: parseInt(process.env.REDIS_PORT || "6379"),
                password: process.env.REDIS_PASSWORD || undefined,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });
            this.redisInitialized = true;
            this.setupRedisSync();
            console.log(`🔗 EmergenceGenerator [${this.nodeId}]: Redis conectado exitosamente (2 conexiones)`);
        }
        catch (error) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Redis no disponible - funcionando en modo local:`, error.message);
            this.redis = null;
            this.pubSubRedis = null;
            this.redisInitialized = true; // Marcar como inicializado aunque falló
        }
    }
    /**
     * 🔄 CONFIGURAR SINCRONIZACIÓN REDIS
     */
    setupRedisSync() {
        if (this.isSubscribed || !this.pubSubRedis)
            return;
        try {
            // Suscribirse al canal de sincronización propio
            this.pubSubRedis.subscribe(this.syncChannel, (err) => {
                if (err) {
                    console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error suscribiéndose a ${this.syncChannel}:`, err);
                    return;
                }
                console.log(`🔄 EmergenceGenerator [${this.nodeId}]: Suscrito a sincronización en ${this.syncChannel}`);
            });
            // Escuchar mensajes de sincronización
            this.pubSubRedis.on("message", (_channel, _message) => {
                if (_channel === this.syncChannel) {
                    this.handleIncomingPattern(_message);
                }
            });
            this.isSubscribed = true;
        }
        catch (error) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error configurando sincronización Redis:`, error);
        }
    }
    /**
     * 📡 PUBLICAR PATRÓN EMERGENTE EN REDIS
     */
    async publishEmergentPattern(pattern) {
        // Esperar a que Redis esté inicializado
        while (!this.redisInitialized) {
            await new Promise((_resolve) => setTimeout(_resolve, 10));
        }
        if (!this.redis)
            return;
        try {
            const patternKey = `emergence_pattern_${this.nodeId}_${pattern.id}`;
            const patternData = JSON.stringify({
                nodeId: this.nodeId,
                pattern,
                timestamp: Date.now(),
            });
            // Publicar en canal de sincronización usando la conexión normal
            await this.redis.publish("emergence_patterns", patternData);
            // Almacenar en hash para persistencia
            await this.redis.hset("emergence_patterns_store", patternKey, patternData);
            this.emit("pattern_published", {
                patternId: pattern.id,
                nodeId: this.nodeId,
            });
        }
        catch (error) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error publicando patrón ${pattern.id}:`, error);
        }
    }
    /**
     * 📥 MANEJAR PATRÓN ENTRANTE DESDE OTRO NODO
     */
    handleIncomingPattern(_message) {
        try {
            const incomingData = JSON.parse(_message);
            const { nodeId, pattern } = incomingData;
            // Evitar procesar nuestros propios patrones
            if (nodeId === this.nodeId)
                return;
            // Almacenar patrón de otro nodo
            this.patterns.set(`remote_${nodeId}_${pattern.id}`, pattern);
            this.emit("pattern_received", {
                fromNodeId: nodeId,
                patternId: pattern.id,
                harmony: pattern.harmony,
            });
            console.log(`📥 EmergenceGenerator [${this.nodeId}]: Patrón recibido de ${nodeId} - Armonía: ${(pattern.harmony * 100).toFixed(1)}%`);
        }
        catch (error) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error procesando patrón entrante:`, error);
        }
    }
    /**
     * 🎨 GENERAR ORDEN DESDE EL CAOS
     *
     * @param seed - Semilla determinista (no random)
     * @param iterations - Número de iteraciones evolutivas
     * @returns Patrón emergente con historia completa
     */
    async generateEmergentOrder(seed, iterations = 100) {
        const patternId = `emergence_${Date.now()}_${seed}`;
        // 🔮 ESTADO INICIAL - CAOS CONTROLADO
        let currentState = {
            iteration: 0,
            entropy: 1.0, // Máximo caos inicial
            order: 0.0, // Sin orden inicial
            beauty: 0.0, // Sin belleza inicial
            pattern: this.generateInitialChaos(seed),
            timestamp: new Date(),
        };
        const evolution = [currentState];
        // 🎭 EVOLUCIÓN DETERMINISTA - CAOS → ORDEN → BELLEZA
        for (let i = 1; i <= iterations; i++) {
            currentState = this.evolveState(currentState, seed + i);
            evolution.push(currentState);
            // 📊 EMITIR PROGRESO EVOLUTIVO
            this.emit("evolution_step", {
                patternId,
                step: i,
                state: currentState,
                progress: i / iterations,
            });
        }
        // 🌟 PATRÓN FINAL COMPLETADO
        const finalPattern = {
            id: patternId,
            seed,
            complexity: this.calculateComplexity(currentState.pattern),
            harmony: currentState.beauty,
            evolution,
            finalState: currentState,
            timestamp: new Date(),
        };
        this.patterns.set(patternId, finalPattern);
        this.emit("emergence_complete", finalPattern);
        // 📡 PUBLICAR PATRÓN EN REDIS PARA SINCRONIZACIÓN
        await this.publishEmergentPattern(finalPattern);
        return finalPattern;
    }
    /**
     * 🌪️ GENERAR CAOS INICIAL DETERMINISTA
     */
    generateInitialChaos(_seed) {
        const chaos = [];
        let state = _seed;
        // Generar patrón caótico determinista con más varianza
        for (let i = 0; i < 50; i++) {
            // LCG determinista sin deterministicRandom()
            state = (1664525 * state + 1013904223) % 4294967296;
            // Crear rango -1 a 1 para más caos inicial
            chaos.push((state / 4294967296) * 2 - 1);
        }
        return chaos;
    }
    /**
     * 🎭 EVOLUCIÓN DE UN ESTADO
     *
     * Reglas simples que generan complejidad:
     * 1. Interacciones locales crean patrones globales
     * 2. Atracción hacia la armonía colectiva
     * 3. Auto-regulación del caos
     */
    evolveState(previousState, _evolutionSeed) {
        const newPattern = [...previousState.pattern];
        let entropy = previousState.entropy;
        let order = previousState.order;
        let beauty = previousState.beauty;
        // 🎼 REGLA 1: INTERACCIONES LOCALES CON FUERZA AUMENTADA
        // Cada elemento interactúa con sus vecinos con más intensidad
        for (let i = 0; i < newPattern.length; i++) {
            const left = i > 0 ? newPattern[i - 1] : newPattern[newPattern.length - 1];
            const right = i < newPattern.length - 1 ? newPattern[i + 1] : newPattern[0];
            const center = newPattern[i];
            // Atracción armónica determinista - FUERZA AUMENTADA
            const harmonicForce = (left + right) / 2 - center;
            newPattern[i] += harmonicForce * 0.3; // Fuerza aumentada de 0.1 a 0.3
            // Mantener en rango -1 a 1 (ampliado para más expresividad)
            newPattern[i] = Math.max(-1, Math.min(1, newPattern[i]));
        }
        // 🎼 REGLA 2: AUTO-REGULACIÓN MEJORADA
        // El sistema se regula a sí mismo basado en convergencia
        const averageValue = newPattern.reduce((_a, _b) => _a + _b, 0) / newPattern.length;
        const variance = newPattern.reduce((_sum, _val) => _sum + Math.pow(_val - averageValue, 2), 0) / newPattern.length;
        // Lógica mejorada: convergencia reduce entropía gradualmente
        const convergence = Math.max(0, 1 - variance * 2); // 0-1 donde 1 es máxima convergencia
        entropy = Math.max(0.1, entropy * 0.95 + (1 - convergence) * 0.05); // Reducción gradual
        // Aumentar orden basado en patrones repetitivos
        order = this.detectOrder(newPattern);
        // 🎨 BELLEZA = ORDEN × (1 - ENTROPÍA) × ARMONÍA
        beauty = order * (1 - entropy) * this.calculateHarmony(newPattern);
        // Mantener límites
        entropy = Math.max(0.01, Math.min(1.0, entropy));
        order = Math.max(0.0, Math.min(1.0, order));
        beauty = Math.max(0.0, Math.min(1.0, beauty));
        return {
            iteration: previousState.iteration + 1,
            entropy,
            order,
            beauty,
            pattern: newPattern,
            timestamp: new Date(),
        };
    }
    /**
     * 📊 DETECTAR ORDEN EN EL PATRÓN
     */
    detectOrder(pattern) {
        // Detectar patrones repetitivos simples - LÓGICA MEJORADA
        let orderScore = 0;
        for (let period = 2; period <= 5; period++) {
            let matches = 0;
            for (let i = 0; i < Math.min(pattern.length - period, 10); i++) {
                const similarity = 1 - Math.abs(pattern[i] - pattern[i + period]);
                matches += similarity;
            }
            orderScore += matches / 10;
        }
        return Math.min(1.0, orderScore / 4); // Normalizar a 0-1
    }
    /**
     * 🎼 CALCULAR ARMONÍA DEL PATRÓN
     */
    calculateHarmony(pattern) {
        // La armonía es la "belleza musical" del patrón
        // Basada en transiciones suaves y proporciones áureas
        let harmony = 0;
        const goldenRatio = 1.618;
        for (let i = 1; i < pattern.length; i++) {
            const transition = Math.abs(pattern[i] - pattern[i - 1]);
            const ratio = pattern[i] / (pattern[i - 1] || 0.001);
            // Recompensar transiciones suaves y proporciones cercanas al golden ratio
            harmony +=
                (1 - transition) * (1 - Math.abs(ratio - goldenRatio) / goldenRatio);
        }
        return harmony / (pattern.length - 1);
    }
    /**
     * 🧮 CALCULAR COMPLEJIDAD DEL PATRÓN
     */
    calculateComplexity(pattern) {
        // Complejidad = información + variabilidad + estructura
        const average = pattern.reduce((_a, _b) => _a + _b, 0) / pattern.length;
        const variance = pattern.reduce((_sum, _val) => _sum + Math.pow(_val - average, 2), 0) /
            pattern.length;
        // Evitar log(0) que causa NaN
        const entropy = -pattern.reduce((_sum, _val) => {
            const normalizedVal = Math.max(0.001, Math.abs(_val)); // Evitar valores <= 0
            return _sum + normalizedVal * Math.log(normalizedVal);
        }, 0);
        return (variance + entropy / 10) / 2; // Normalizar
    }
    /**
     * � OBTENER PATRONES DE OTROS NODOS
     */
    async getRemotePatterns() {
        // Esperar a que Redis esté inicializado
        while (!this.redisInitialized) {
            await new Promise((_resolve) => setTimeout(_resolve, 10));
        }
        if (!this.redis)
            return [];
        try {
            const allPatterns = await this.redis.hgetall("emergence_patterns_store");
            const remotePatterns = [];
            for (const [key, value] of Object.entries(allPatterns)) {
                try {
                    const patternData = JSON.parse(value);
                    // Solo incluir patrones de otros nodos
                    if (patternData.nodeId !== this.nodeId) {
                        remotePatterns.push(patternData.pattern);
                    }
                }
                catch (parseError) {
                    console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error parseando patrón remoto ${key}:`, parseError);
                }
            }
            return remotePatterns;
        }
        catch (error) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: Error obteniendo patrones remotos:`, error);
            return [];
        }
    }
    /**
     * 🎭 GENERAR BELLEZA COLECTIVA
     *
     * Cuando múltiples patrones interactúan
     */
    async generateCollectiveBeauty(patterns) {
        const collectiveSeed = patterns.reduce((_sum, _p) => _sum + _p.seed, 0);
        const collectivePattern = await this.generateEmergentOrder(collectiveSeed, 200);
        // Meta-evolución: los patrones individuales afectan al colectivo
        patterns.forEach((pattern) => {
            this.emit("collective_influence", {
                individualPattern: pattern.id,
                collectivePattern: collectivePattern.id,
                influence: pattern.harmony,
            });
        });
        return collectivePattern;
    }
    /**
     * 🎭 GENERAR BELLEZA COLECTIVA GLOBAL
     *
     * Incluye patrones de todos los nodos del swarm
     */
    async generateGlobalCollectiveBeauty() {
        const localPatterns = Array.from(this.patterns.values());
        const remotePatterns = await this.getRemotePatterns();
        const allPatterns = [...localPatterns, ...remotePatterns];
        if (allPatterns.length === 0) {
            console.warn(`⚠️ EmergenceGenerator [${this.nodeId}]: No hay patrones disponibles para belleza colectiva global`);
            return null;
        }
        console.log(`🌐 EmergenceGenerator [${this.nodeId}]: Generando belleza colectiva global con ${allPatterns.length} patrones (${localPatterns.length} locales, ${remotePatterns.length} remotos)`);
        return await this.generateCollectiveBeauty(allPatterns);
    }
    /**
     * 📊 OBTENER PATRÓN POR ID
     */
    getPattern(_id) {
        return this.patterns.get(_id);
    }
    /**
     * 📈 OBTENER ESTADÍSTICAS DE EVOLUCIÓN
     */
    getEvolutionStats() {
        const patterns = Array.from(this.patterns.values());
        return {
            totalPatterns: patterns.length,
            averageComplexity: patterns.reduce((_sum, _p) => _sum + _p.complexity, 0) / patterns.length,
            averageHarmony: patterns.reduce((_sum, _p) => _sum + _p.harmony, 0) / patterns.length,
            mostBeautiful: patterns.reduce((best, current) => current.harmony > best.harmony ? current : best),
            evolution: patterns.flatMap((_p) => _p.evolution),
        };
    }
}
// 🎯 FACTORY PARA CREAR INSTANCIAS POR NODO
export class EmergenceGeneratorFactory {
    static generators = new Map();
    static getForNode(nodeId) {
        if (!this.generators.has(nodeId)) {
            this.generators.set(nodeId, new EmergenceGenerator(nodeId));
        }
        return this.generators.get(nodeId);
    }
    static getAllGenerators() {
        return Array.from(this.generators.values());
    }
}
// 🎯 EXPORTAR FACTORY PARA COMPATIBILIDAD
export const emergenceGenerator = EmergenceGeneratorFactory;
//# sourceMappingURL=EmergenceGenerator.js.map