/**
 * 🎸⚡ LUXSYNC CONFIGURATION
 * 
 * Configuración centralizada del sistema LuxSync
 */

export interface LuxSyncConfig {
  // Server
  server: {
    port: number;
    host: string;
  };

  // Redis
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };

  // DMX
  dmx: {
    interface: 'tornado' | 'artnet' | 'sacn';
    port?: string;           // USB port (tornado)
    artnetIp?: string;       // Art-Net IP
    universes: number;
  };

  // Audio
  audio: {
    inputDevice: string;
    sampleRate: number;
    bufferSize: number;
  };

  // LuxSync Engine
  luxsync: {
    mode: 'development' | 'production';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    seed: number;
    latencyTarget: number;   // Target latency in ms (1-7ms)
  };

  // Fixtures
  fixtures: {
    path: string;
    reloadOnChange: boolean;
  };

  // Shows
  shows: {
    path: string;
    autoRecord: boolean;
  };

  // GraphQL
  graphql: {
    playground: boolean;
    introspection: boolean;
  };
}

// Default configuration
export const defaultConfig: LuxSyncConfig = {
  server: {
    port: parseInt(process.env.SERVER_PORT || '4000'),
    host: process.env.SERVER_HOST || 'localhost',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },

  dmx: {
    interface: (process.env.DMX_INTERFACE as any) || 'tornado',
    port: process.env.DMX_PORT || '/dev/ttyUSB0',
    artnetIp: process.env.DMX_ARTNET_IP,
    universes: parseInt(process.env.DMX_UNIVERSES || '1'),
  },

  audio: {
    inputDevice: process.env.AUDIO_INPUT_DEVICE || 'default',
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '44100'),
    bufferSize: parseInt(process.env.AUDIO_BUFFER_SIZE || '2048'),
  },

  luxsync: {
    mode: (process.env.LUXSYNC_MODE as any) || 'development',
    logLevel: (process.env.LUXSYNC_LOG_LEVEL as any) || 'debug',
    seed: parseInt(process.env.LUXSYNC_SEED || '42'),
    latencyTarget: 5, // 5ms target (Selene can do 1-7ms)
  },

  fixtures: {
    path: process.env.FIXTURES_PATH || './fixtures',
    reloadOnChange: process.env.FIXTURES_RELOAD_ON_CHANGE === 'true',
  },

  shows: {
    path: process.env.SHOWS_PATH || './shows',
    autoRecord: process.env.SHOWS_AUTO_RECORD === 'true',
  },

  graphql: {
    playground: process.env.GRAPHQL_PLAYGROUND === 'true',
    introspection: process.env.GRAPHQL_INTROSPECTION === 'true',
  },
};

// Export singleton instance
export const config: LuxSyncConfig = defaultConfig;
