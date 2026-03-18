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
// ============================================================================
// BACKUP DE LAS FUNCIONES ORIGINALES
// ============================================================================
const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
    trace: console.trace.bind(console)
};
// ============================================================================
// INTERCEPTOR
// ============================================================================
/**
 * Inicializa el interceptor de console según el entorno.
 *
 * - PRODUCTION: Solo console.error pasa (errores críticos)
 * - STAGING: console.warn + console.error pasan
 * - DEVELOPMENT: Todo pasa (sin filtro)
 * - TEST: Todo silenciado
 */
export function initConsoleInterceptor() {
    const env = process.env.NODE_ENV || 'development';
    const nodeId = process.env.NODE_ID || `node-${process.pid}`;
    // ============================================================================
    // PRODUCTION: SILENCIO TOTAL (solo errores)
    // ============================================================================
    if (env === 'production') {
        console.log = () => { }; // SILENCIO
        console.info = () => { }; // SILENCIO
        console.warn = () => { }; // SILENCIO
        console.debug = () => { }; // SILENCIO
        console.trace = () => { }; // SILENCIO
        // Solo errores críticos pasan
        console.error = (...args) => {
            originalConsole.error(`[${nodeId}]`, ...args);
        };
        // Log único de activación (irónico, lo sé)
        originalConsole.warn(`🎸 [ConsoleInterceptor] PRODUCTION MODE: console.* silenced (only errors)`);
    }
    // ============================================================================
    // STAGING: WARN + ERROR
    // ============================================================================
    else if (env === 'staging') {
        console.log = () => { }; // SILENCIO
        console.info = () => { }; // SILENCIO
        console.debug = () => { }; // SILENCIO
        console.trace = () => { }; // SILENCIO
        console.warn = (...args) => {
            originalConsole.warn(`[${nodeId}]`, ...args);
        };
        console.error = (...args) => {
            originalConsole.error(`[${nodeId}]`, ...args);
        };
        originalConsole.warn(`🎸 [ConsoleInterceptor] STAGING MODE: console.log/info silenced`);
    }
    // ============================================================================
    // TEST: SILENCIO ABSOLUTO
    // ============================================================================
    else if (env === 'test') {
        console.log = () => { };
        console.info = () => { };
        console.warn = () => { };
        console.error = () => { };
        console.debug = () => { };
        console.trace = () => { };
    }
    // ============================================================================
    // DEVELOPMENT: SIN FILTRO (debugging completo)
    // ============================================================================
    else {
        // No hacer nada, dejar console.* funcionando normalmente
        originalConsole.info(`🎸 [ConsoleInterceptor] DEVELOPMENT MODE: console.* unfiltered`);
    }
}
/**
 * Restaura las funciones originales de console.
 * Útil para testing o debugging temporal.
 */
export function restoreConsole() {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    console.trace = originalConsole.trace;
    console.info(`🎸 [ConsoleInterceptor] Console restored to original state`);
}
/**
 * Obtiene las funciones originales (útil para testing).
 */
export function getOriginalConsole() {
    return originalConsole;
}
// ============================================================================
// EXPORT POR DEFECTO
// ============================================================================
export default {
    init: initConsoleInterceptor,
    restore: restoreConsole,
    getOriginal: getOriginalConsole
};
//# sourceMappingURL=ConsoleInterceptor.js.map