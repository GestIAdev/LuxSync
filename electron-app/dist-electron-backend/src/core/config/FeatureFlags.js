/**
 * 🏛️ WAVE 200: TITAN FEATURE FLAGS
 *
 * Este archivo controla el "Airlock" entre Legacy V1 y TITAN 2.0.
 *
 * ⚠️ REGLA DE ORO: No modificar TITAN_ENABLED a true hasta que
 * todos los módulos de TITAN estén implementados y testeados.
 *
 * @version WAVE 200 - Phase 0
 * @date 29 Diciembre 2025
 */
export const FLAGS = {
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔴 INTERRUPTOR MAESTRO - MANTENER EN FALSE DURANTE CONSTRUCCIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Cuando sea TRUE, el sistema ignorará el código Legacy V1 y arrancará TITAN 2.0.
     *
     * Checklist antes de activar:
     * - [ ] TitanOrchestrator implementado
     * - [ ] TrinityBrain migrado
     * - [ ] SeleneLux 2.0 operativo
     * - [ ] HAL conectado a drivers DMX
     * - [ ] Tests de integración pasando
     */
    TITAN_ENABLED: false,
    // ═══════════════════════════════════════════════════════════════════════════
    // FLAGS GRANULARES (Para migración incremental - Phase 1+)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Usa el nuevo TrinityBrain en lugar del worker mind.ts legacy
     */
    USE_TITAN_BRAIN: false,
    /**
     * Usa el nuevo SeleneLux 2.0 Engine en lugar de SeleneLux legacy
     */
    USE_TITAN_ENGINE: false,
    /**
     * Usa la nueva capa HAL en lugar de la lógica embebida en main.ts
     */
    USE_TITAN_HAL: false,
    /**
     * Activa logging verboso de TITAN para debugging
     */
    TITAN_DEBUG: true,
};
