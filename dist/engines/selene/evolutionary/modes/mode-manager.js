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
export class ModeManager {
    static instance;
    currentMode = 'balanced'; // Default
    customConfig;
    /**
     * Modos predefinidos
     */
    modes = {
        deterministic: {
            entropyFactor: 0, // Sin entropía (reproducible)
            riskThreshold: 10, // Ultra-conservador
            punkProbability: 0, // Sin tipos punk
            feedbackInfluence: 0 // Sin aprendizaje (predecible)
        },
        balanced: {
            entropyFactor: 50, // Entropía moderada
            riskThreshold: 40, // Riesgo moderado
            punkProbability: 30, // Algunos tipos punk
            feedbackInfluence: 50 // Aprendizaje moderado
        },
        punk: {
            entropyFactor: 100, // Entropía máxima
            riskThreshold: 70, // Alta tolerancia a riesgo
            punkProbability: 80, // Prioriza tipos punk
            feedbackInfluence: 100 // Aprendizaje máximo
        }
    };
    /**
     * Constructor privado (Singleton)
     */
    constructor() { }
    /**
     * Obtiene instancia única del ModeManager
     */
    static getInstance() {
        if (!ModeManager.instance) {
            ModeManager.instance = new ModeManager();
        }
        return ModeManager.instance;
    }
    /**
     * Establece modo activo
     * @param mode - Tipo de modo (deterministic, balanced, punk)
     */
    setMode(mode) {
        this.currentMode = mode;
        this.customConfig = undefined; // Clear custom si existe
    }
    /**
     * Establece modo custom con configuración específica
     * @param config - Configuración custom
     */
    setCustomMode(config) {
        this.currentMode = 'custom';
        this.customConfig = config;
    }
    /**
     * Obtiene modo actual
     */
    getCurrentMode() {
        return this.currentMode;
    }
    /**
     * Obtiene configuración del modo actual
     */
    getModeConfig() {
        if (this.currentMode === 'custom' && this.customConfig) {
            return this.customConfig;
        }
        return this.modes[this.currentMode];
    }
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
    adjustModeFromFeedback(rating) {
        // Solo ajustar en modos intermedios
        if (this.currentMode === 'deterministic' || this.currentMode === 'punk') {
            return; // Extremos no se auto-ajustan
        }
        const config = this.getModeConfig();
        // Rating alto: más caos
        if (rating > 7) {
            const adjusted = {
                name: 'feedback-adjusted',
                description: `Auto-adjusted from ${this.currentMode} (rating: ${rating})`,
                entropyFactor: Math.min(100, config.entropyFactor + 10),
                riskThreshold: Math.min(100, config.riskThreshold + 5),
                punkProbability: Math.min(100, config.punkProbability + 10),
                feedbackInfluence: config.feedbackInfluence
            };
            this.setCustomMode(adjusted);
        }
        // Rating bajo: menos caos
        else if (rating < 4) {
            const adjusted = {
                name: 'feedback-adjusted',
                description: `Auto-adjusted from ${this.currentMode} (rating: ${rating})`,
                entropyFactor: Math.max(0, config.entropyFactor - 10),
                riskThreshold: Math.max(0, config.riskThreshold - 5),
                punkProbability: Math.max(0, config.punkProbability - 10),
                feedbackInfluence: config.feedbackInfluence
            };
            this.setCustomMode(adjusted);
        }
        // Rating medio: no ajustar
    }
    /**
     * Reset a modo default (balanced)
     */
    reset() {
        this.currentMode = 'balanced';
        this.customConfig = undefined;
    }
}
//# sourceMappingURL=mode-manager.js.map