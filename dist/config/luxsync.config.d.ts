/**
 * 🎸⚡ LUXSYNC CONFIGURATION
 *
 * Configuración centralizada del sistema LuxSync
 */
export interface LuxSyncConfig {
    server: {
        port: number;
        host: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string;
        db: number;
    };
    dmx: {
        interface: 'tornado' | 'artnet' | 'sacn';
        port?: string;
        artnetIp?: string;
        universes: number;
    };
    audio: {
        inputDevice: string;
        sampleRate: number;
        bufferSize: number;
    };
    luxsync: {
        mode: 'development' | 'production';
        logLevel: 'debug' | 'info' | 'warn' | 'error';
        seed: number;
        latencyTarget: number;
    };
    fixtures: {
        path: string;
        reloadOnChange: boolean;
    };
    shows: {
        path: string;
        autoRecord: boolean;
    };
    graphql: {
        playground: boolean;
        introspection: boolean;
    };
}
export declare const defaultConfig: LuxSyncConfig;
export declare const config: LuxSyncConfig;
//# sourceMappingURL=luxsync.config.d.ts.map