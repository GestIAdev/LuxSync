/**
 * 🔀 SELENE MODE MANAGER
 *
 * Gestor de modos del sistema evolutivo de Selene.
 * Permite cambiar entre DETERMINISTIC, BALANCED, PUNK y CUSTOM modes.
 *
 * Implementa Opción D: Dualidad adaptativa (ajuste por feedback)
 *
 * @author PunkClaude + Radwulf
 * @date 2025-10-23
 */
/**
 * Tipos de modo disponibles
 */
export type ModeType = 'deterministic' | 'balanced' | 'punk' | 'custom';
/**
 * Configuración de un modo
 */
export interface ModeConfig {
    /** Factor de entropía (0-100): 0 = determinista puro, 100 = caos máximo */
    entropyFactor: number;
    /** Umbral de riesgo (0-100): tipos con riskScore > threshold son filtrados */
    riskThreshold: number;
    /** Probabilidad de tipos punk (0-100): boost para tipos destruction/chaos/rebellion */
    punkProbability: number;
    /** Influencia del feedback loop (0-100): cuánto afectan ratings a generación */
    feedbackInfluence: number;
}
/**
 * Configuración de modo custom con metadata
 */
export interface CustomModeConfig extends ModeConfig {
    name: string;
    description?: string;
}
/**
 * Gestor de modos de Selene (Singleton)
 *
 * Controla el comportamiento global del sistema a través de modos:
 * - DETERMINISTIC: Reproducibilidad 100% (trading, finanzas, auditoría)
 * - BALANCED: Mix predictibilidad + sorpresas (general SaaS)
 * - PUNK: Creatividad máxima (arte, research, gaming)
 * - CUSTOM: Usuario define parámetros exactos
 *
 * @example
 * ```typescript
 * // Cambiar a modo determinista
 * ModeManager.getInstance().setMode('deterministic');
 *
 * // Modo custom
 * ModeManager.getInstance().setCustomMode({
 *   name: 'ultra-chaos',
 *   entropyFactor: 120,
 *   riskThreshold: 90,
 *   punkProbability: 100,
 *   feedbackInfluence: 100
 * });
 * ```
 */
export declare class ModeManager {
    private static instance;
    private currentMode;
    private customConfig?;
    /**
     * Modos predefinidos
     */
    private readonly modes;
    /**
     * Constructor privado (Singleton)
     */
    private constructor();
    /**
     * Obtiene instancia única del ModeManager
     */
    static getInstance(): ModeManager;
    /**
     * Establece modo activo
     * @param mode - Tipo de modo (deterministic, balanced, punk)
     */
    setMode(mode: Exclude<ModeType, 'custom'>): void;
    /**
     * Establece modo custom con configuración específica
     * @param config - Configuración custom
     */
    setCustomMode(config: CustomModeConfig): void;
    /**
     * Obtiene modo actual
     */
    getCurrentMode(): ModeType;
    /**
     * Obtiene configuración del modo actual
     */
    getModeConfig(): ModeConfig;
    /**
     * OPCIÓN D: Dualidad adaptativa
     * Ajusta el modo actual basándose en feedback del usuario
     *
     * @param rating - Rating del usuario (0-10)
     *
     * Comportamiento:
     * - rating > 7: Aumenta entropyFactor y punkProbability (+10%)
     * - rating < 4: Disminuye entropyFactor y punkProbability (-10%)
     * - rating 4-7: No ajusta
     *
     * Solo funciona en modo BALANCED o CUSTOM (no afecta extremos)
     */
    adjustModeFromFeedback(rating: number): void;
    /**
     * Reset a modo default (balanced)
     */
    reset(): void;
}
//# sourceMappingURL=mode-manager.d.ts.map