import { EventEmitter } from "events";
/**
 * 🎭 ORDEN EMERGENTE - EL CORAZÓN DE LA AUTO-ORGANIZACIÓN
 *
 * "Reglas simples generan complejidad hermosa"
 * - Caos determinista como semilla
 * - Evolución procedural predecible
 * - Belleza que emerge de la lógica
 */
export interface EmergencePattern {
    id: string;
    seed: number;
    complexity: number;
    harmony: number;
    evolution: EmergenceState[];
    finalState: EmergenceState;
    timestamp: Date;
}
export interface EmergenceState {
    iteration: number;
    entropy: number;
    order: number;
    beauty: number;
    pattern: number[];
    timestamp: Date;
}
/**
 * 🌟 GENERADOR DE ORDEN EMERGENTE
 *
 * Convierte caos determinista en patrones hermosos
 * Sin deterministicRandom() - solo lógica procedural pura
 */
export declare class EmergenceGenerator extends EventEmitter {
    private patterns;
    private nodeId;
    private redis;
    private pubSubRedis;
    private syncChannel;
    private isSubscribed;
    private redisInitialized;
    constructor(nodeId: string, redis?: any, pubSubRedis?: any);
    /**
     * 🔗 INICIALIZAR REDIS ASÍNCRONICAMENTE
     */
    private initializeRedis;
    /**
     * 🔄 CONFIGURAR SINCRONIZACIÓN REDIS
     */
    private setupRedisSync;
    /**
     * 📡 PUBLICAR PATRÓN EMERGENTE EN REDIS
     */
    private publishEmergentPattern;
    /**
     * 📥 MANEJAR PATRÓN ENTRANTE DESDE OTRO NODO
     */
    private handleIncomingPattern;
    /**
     * 🎨 GENERAR ORDEN DESDE EL CAOS
     *
     * @param seed - Semilla determinista (no random)
     * @param iterations - Número de iteraciones evolutivas
     * @returns Patrón emergente con historia completa
     */
    generateEmergentOrder(seed: number, iterations?: number): Promise<EmergencePattern>;
    /**
     * 🌪️ GENERAR CAOS INICIAL DETERMINISTA
     */
    private generateInitialChaos;
    /**
     * 🎭 EVOLUCIÓN DE UN ESTADO
     *
     * Reglas simples que generan complejidad:
     * 1. Interacciones locales crean patrones globales
     * 2. Atracción hacia la armonía colectiva
     * 3. Auto-regulación del caos
     */
    private evolveState;
    /**
     * 📊 DETECTAR ORDEN EN EL PATRÓN
     */
    private detectOrder;
    /**
     * 🎼 CALCULAR ARMONÍA DEL PATRÓN
     */
    private calculateHarmony;
    /**
     * 🧮 CALCULAR COMPLEJIDAD DEL PATRÓN
     */
    private calculateComplexity;
    /**
     * � OBTENER PATRONES DE OTROS NODOS
     */
    getRemotePatterns(): Promise<EmergencePattern[]>;
    /**
     * 🎭 GENERAR BELLEZA COLECTIVA
     *
     * Cuando múltiples patrones interactúan
     */
    generateCollectiveBeauty(patterns: EmergencePattern[]): Promise<EmergencePattern>;
    /**
     * 🎭 GENERAR BELLEZA COLECTIVA GLOBAL
     *
     * Incluye patrones de todos los nodos del swarm
     */
    generateGlobalCollectiveBeauty(): Promise<EmergencePattern | null>;
    /**
     * 📊 OBTENER PATRÓN POR ID
     */
    getPattern(_id: string): EmergencePattern | undefined;
    /**
     * 📈 OBTENER ESTADÍSTICAS DE EVOLUCIÓN
     */
    getEvolutionStats(): any;
}
export declare class EmergenceGeneratorFactory {
    private static generators;
    static getForNode(nodeId: string): EmergenceGenerator;
    static getAllGenerators(): EmergenceGenerator[];
}
export declare const emergenceGenerator: typeof EmergenceGeneratorFactory;
//# sourceMappingURL=EmergenceGenerator.d.ts.map