/**
 * 🎯 REDIS COMMAND LISTENER FOR FORJA 9.0
 * Separate module to handle Redis command listening
 */

// TIERRA QUEMADA - Configuration removed, using console directly

export class RedisCommandListener {
  private static redisSubscriber: any = null;
  private static redisWriter: any = null;
  private static musicEngine: any = null; // 🎯 SINGLETON PARA EVITAR MEMORY LEAK

  /**
   * 🎯 GET OR CREATE REDIS SUBSCRIBER
   * Obtiene o crea una conexión Redis dedicada para suscripción (solo pub/sub)
   */
  private static async getRedisSubscriber() {
    if (!this.redisSubscriber) {
      const { default: Redis } = await import('ioredis');
      this.redisSubscriber = new (Redis as any)({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: 3,
      });

      this.redisSubscriber.on('error', (error: any) => {
        console.error('❌ Redis subscriber error:', error as Error);
      });

      this.redisSubscriber.on('connect', () => {
        console.log('✅ Redis subscriber connected');
      });
    }
    return this.redisSubscriber;
  }

  /**
   * 🎯 GET OR CREATE MUSIC ENGINE SINGLETON
   * Obtiene la instancia singleton de MusicEngine para evitar memory leaks
   */
  private static async getMusicEngine() {
    if (!this.musicEngine) {
      const { MusicEngine } = await import('../swarm/music/MusicalConsensusRecorder.js');
      this.musicEngine = new MusicEngine();
      console.log('🎯 MusicEngine singleton creado para RedisCommandListener');
    }
    return this.musicEngine;
  }

  /**
   * 🎯 GET OR CREATE REDIS WRITER
   * Obtiene o crea una conexión Redis dedicada para operaciones de escritura
   */
  private static async getRedisWriter() {
    if (!this.redisWriter) {
      const { default: Redis } = await import('ioredis');
      this.redisWriter = new (Redis as any)({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        maxRetriesPerRequest: 3,
      });

      this.redisWriter.on('error', (error: any) => {
        console.error('❌ Redis writer error:', error as Error);
      });

      this.redisWriter.on('connect', () => {
        console.log('✅ Redis writer connected');
      });
    }
    return this.redisWriter;
  }

  /**
   * 🎯 START REDIS COMMAND LISTENER - FORJA 10.0 TEST HARNESS
   * Escucha comandos desde el dashboard en los canales 'selene:control:commands', 'selene:control:force_consensus' y 'selene:control:export_stats'
   */
  static async startRedisCommandListener(): Promise<void> {
    try {
      // Obtener cliente Redis dedicado para suscripción
      const commandSubscriber = await this.getRedisSubscriber();

      // Suscribirse SOLO al canal de intenciones (FORJA 9.0)
      await commandSubscriber.subscribe(['selene:intention:commands']);

      // Escuchar mensajes en el canal
      commandSubscriber.on('message', async (channel: string, message: string) => {
        try {
          const command = JSON.parse(message);

          if (command.type === 'generate_with_intention') {
            await RedisCommandListener.processIntentionGenerationCommand(command);
          } else if (command.type === 'force_consensus') {
            // NUEVA LÓGICA 10.0 (Disparar consenso real)
            await RedisCommandListener.processForcedConsensus();
          } else if (command.type === 'export_profile_stats') {
            // DIRECTIVA 12.13 (Exportar estadísticas de perfiles en tiempo real)
            await RedisCommandListener.processExportProfileStats(command);
          } else {
            // Unknown command type - silently ignore
          }
        } catch (error) {
          console.error('❌ Error processing Redis command:', error as Error);
        }
      });

      commandSubscriber.on('error', (error: any) => {
        console.error('❌ Redis command listener error:', error as Error);
      });

    } catch (error) {
      console.error('❌ Failed to start Redis command listener:', error as Error);
    }
  }

  /**
   * 🎨 PROCESS INTENTION GENERATION COMMAND
   * Procesa comandos de generación con intención desde el dashboard
   * Usa el sistema de consenso MusicalConsensusRecorder para clasificación real
   * Y AUTOMÁTICAMENTE ejecuta un consenso para procesar la intención
   */
  static async processIntentionGenerationCommand(command: any): Promise<void> {
    try {
      const intentionParams = command.intentionParams;

      if (!intentionParams) {
        console.error('❌ intentionParams is undefined in command:', command);
        return;
      }

      console.log(`🎨 Processing intention generation: ${JSON.stringify(intentionParams)}`);
      console.log(`   Intention: ${JSON.stringify(intentionParams)}`);

      // LÓGICA REFACTORIZADA 9.4 (Listener)
      // 1. Obtener el escritor de Redis
      const redisWriter = await this.getRedisWriter();

      // 2. Establecer la intención para el PRÓXIMO consenso
      // Usamos una lista (lpush) para "encolar" intenciones
      await redisWriter.lpush('selene:intent:queue', JSON.stringify(intentionParams));

      console.log(`✅ [AXIOM-COMPLIANT] Intención ${JSON.stringify(intentionParams)} encolada para el próximo consenso real.`);

    } catch (error) {
      console.error('❌ Error encolando la intención:', error as Error);
    }
  }

  /**
   * 🔥 PROCESS FORCED CONSENSUS - FORJA 10.0 TEST HARNESS
   * Fuerza la ejecución de un consenso real usando datos deterministas
   */
  static async processForcedConsensus(): Promise<void> {
    try {
      console.log('🔥 [FORJA 9.4+] Iniciando consenso automático para procesar intención...');

      // 🔥 SOLUCIÓN: Usar singleton de MusicEngine para evitar memory leaks
      const recorder = await this.getMusicEngine();

      // Crear un consenso simulado básico con datos deterministas
      const simulatedConsensus = {
        consensusAchieved: true,
        participants: ['selene-auto-consensus'],
        consensusTime: Date.now(),
        beauty: 0.7, // Valor base razonable
        // Agregar cualquier otro campo necesario para el consenso
      };

      console.log('🔥 [FORJA 9.4+] Consenso simulado creado:', simulatedConsensus);

      // 🔥 EJECUTAR EL CONSENSO REAL - SSE-7.6: removed intentParameters
      await recorder.recordConsensusEvent(simulatedConsensus);

      console.log('✅ [FORJA 9.4+] Consenso automático completado - intención procesada');

    } catch (error) {
      console.error('❌ [FORJA 9.4+] Error en consenso automático:', error as Error);
    }
  }

  /**
   * 🎯 PROCESS EXPORT PROFILE STATS - DIRECTIVA 12.13
   * Exporta estadísticas de perfiles capturados en tiempo real desde todos los nodos activos
   */
  static async processExportProfileStats(command: any): Promise<void> {
    try {
      console.log('🎯 DIRECTIVA 12.13: Exportando estadísticas de perfiles en tiempo real...');

      // 1. Usar singleton de MusicEngine para evitar memory leaks
      const recorder = await this.getMusicEngine();

      // 2. Obtener estadísticas de perfiles
      const stats = recorder.exportProfileStats();

      if (!stats) {
        console.log('❌ DIRECTIVA 12.13: No hay perfiles capturados para exportar');
        return;
      }

      // 3. Obtener el escritor de Redis
      const redisWriter = await this.getRedisWriter();

      // 4. Publicar las estadísticas en un canal dedicado
      const statsMessage = {
        type: 'profile_stats_export',
        timestamp: Date.now(),
        stats: stats,
        nodeId: process.env.NODE_ID || 'unknown'
      };

      await redisWriter.publish('selene:stats:export', JSON.stringify(statsMessage));

      console.log('✅ DIRECTIVA 12.13: Estadísticas de perfiles exportadas exitosamente');

    } catch (error) {
      console.error(`❌ [DIRECTIVA 12.13] Fallo al exportar estadísticas de perfiles:`, error as Error);
    }
  }
}

