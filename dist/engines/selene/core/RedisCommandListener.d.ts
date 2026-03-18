/**
 * 🎯 REDIS COMMAND LISTENER FOR FORJA 9.0
 * Separate module to handle Redis command listening
 */
export declare class RedisCommandListener {
    private static redisSubscriber;
    private static redisWriter;
    private static musicEngine;
    /**
     * 🎯 GET OR CREATE REDIS SUBSCRIBER
     * Obtiene o crea una conexión Redis dedicada para suscripción (solo pub/sub)
     */
    private static getRedisSubscriber;
    /**
     * 🎯 GET OR CREATE MUSIC ENGINE SINGLETON
     * Obtiene la instancia singleton de MusicEngine para evitar memory leaks
     */
    private static getMusicEngine;
    /**
     * 🎯 GET OR CREATE REDIS WRITER
     * Obtiene o crea una conexión Redis dedicada para operaciones de escritura
     */
    private static getRedisWriter;
    /**
     * 🎯 START REDIS COMMAND LISTENER - FORJA 10.0 TEST HARNESS
     * Escucha comandos desde el dashboard en los canales 'selene:control:commands', 'selene:control:force_consensus' y 'selene:control:export_stats'
     */
    static startRedisCommandListener(): Promise<void>;
    /**
     * 🎨 PROCESS INTENTION GENERATION COMMAND
     * Procesa comandos de generación con intención desde el dashboard
     * Usa el sistema de consenso MusicalConsensusRecorder para clasificación real
     * Y AUTOMÁTICAMENTE ejecuta un consenso para procesar la intención
     */
    static processIntentionGenerationCommand(command: any): Promise<void>;
    /**
     * 🔥 PROCESS FORCED CONSENSUS - FORJA 10.0 TEST HARNESS
     * Fuerza la ejecución de un consenso real usando datos deterministas
     */
    static processForcedConsensus(): Promise<void>;
    /**
     * 🎯 PROCESS EXPORT PROFILE STATS - DIRECTIVA 12.13
     * Exporta estadísticas de perfiles capturados en tiempo real desde todos los nodos activos
     */
    static processExportProfileStats(command: any): Promise<void>;
}
//# sourceMappingURL=RedisCommandListener.d.ts.map