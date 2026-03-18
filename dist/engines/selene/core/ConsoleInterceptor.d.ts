/**
 * 🎸 CONSOLE INTERCEPTOR - PARCHE QUIRÚRGICO PM2
 *
 * DIRECTIVA 27.10.25-F-PM2.3: INTERCEPTOR BRUTAL
 *
 * PROBLEMA DETECTADO:
 * - 2,913 console.log() directos en el código compilado
 * - any.config solo afecta a console.log(), NO a console.log()
 * - PM2 daemon crash por STDOUT saturation (6 KB/sec)
 *
 * SOLUCIÓN:
 * - Interceptar console.log/info/warn/error globalmente
 * - En producción: SILENCIAR TODO excepto console.error (errores críticos)
 * - En desarrollo: Dejar fluir todo (debugging)
 *
 * USO:
 *   import { initConsoleInterceptor } from './core/ConsoleInterceptor.js';
 *   initConsoleInterceptor(); // Al inicio de server.ts
 *
 * @author PunkClaude
 */
/**
 * Inicializa el interceptor de console según el entorno.
 *
 * - PRODUCTION: Solo console.error pasa (errores críticos)
 * - STAGING: console.warn + console.error pasan
 * - DEVELOPMENT: Todo pasa (sin filtro)
 * - TEST: Todo silenciado
 */
export declare function initConsoleInterceptor(): void;
/**
 * Restaura las funciones originales de console.
 * Útil para testing o debugging temporal.
 */
export declare function restoreConsole(): void;
/**
 * Obtiene las funciones originales (útil para testing).
 */
export declare function getOriginalConsole(): {
    log: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    info: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    warn: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    error: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    debug: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    trace: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
};
declare const _default: {
    init: typeof initConsoleInterceptor;
    restore: typeof restoreConsole;
    getOriginal: typeof getOriginalConsole;
};
export default _default;
//# sourceMappingURL=ConsoleInterceptor.d.ts.map