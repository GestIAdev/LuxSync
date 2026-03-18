/**
 * 🎯 DIRECTIVA V166 - CONSOLE SILENCE WRAPPER
 * 🔇 Silenciar logs de startup sin tocar código existente
 *
 * By PunkGrok - September 28, 2025
 */
export declare class ConsoleSilencer {
    private originalConsole;
    private silencedLogs;
    private isActive;
    /**
     * 🔇 Activar modo silencioso
     */
    activate(): void;
    /**
     * 🔊 Desactivar modo silencioso
     */
    deactivate(): void;
    /**
     * 🎯 Determinar si un log es crítico
     */
    private isCriticalLog;
    /**
     * 📊 Mostrar resumen de logs silenciados
     */
    showSummary(): void;
    /**
     * 📄 Obtener logs silenciados
     */
    getSilencedLogs(): string[];
}
export declare const consoleSilencer: ConsoleSilencer;
//# sourceMappingURL=ConsoleSilencer.d.ts.map