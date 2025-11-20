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
export class ModeManager {
  private static instance: ModeManager;
  private currentMode: ModeType = 'balanced'; // Default
  private customConfig?: CustomModeConfig;

  /**
   * Modos predefinidos
   */
  private readonly modes: Record<Exclude<ModeType, 'custom'>, ModeConfig> = {
    deterministic: {
      entropyFactor: 0,        // Sin entropía (reproducible)
      riskThreshold: 10,       // Ultra-conservador
      punkProbability: 0,      // Sin tipos punk
      feedbackInfluence: 0     // Sin aprendizaje (predecible)
    },
    balanced: {
      entropyFactor: 50,       // Entropía moderada
      riskThreshold: 40,       // Riesgo moderado
      punkProbability: 30,     // Algunos tipos punk
      feedbackInfluence: 50    // Aprendizaje moderado
    },
    punk: {
      entropyFactor: 100,      // Entropía máxima
      riskThreshold: 70,       // Alta tolerancia a riesgo
      punkProbability: 80,     // Prioriza tipos punk
      feedbackInfluence: 100   // Aprendizaje máximo
    }
  };

  /**
   * Constructor privado (Singleton)
   */
  private constructor() {}

  /**
   * Obtiene instancia única del ModeManager
   */
  public static getInstance(): ModeManager {
    if (!ModeManager.instance) {
      ModeManager.instance = new ModeManager();
    }
    return ModeManager.instance;
  }

  /**
   * Establece modo activo
   * @param mode - Tipo de modo (deterministic, balanced, punk)
   */
  public setMode(mode: Exclude<ModeType, 'custom'>): void {
    this.currentMode = mode;
    this.customConfig = undefined; // Clear custom si existe
  }

  /**
   * Establece modo custom con configuración específica
   * @param config - Configuración custom
   */
  public setCustomMode(config: CustomModeConfig): void {
    this.currentMode = 'custom';
    this.customConfig = config;
  }

  /**
   * Obtiene modo actual
   */
  public getCurrentMode(): ModeType {
    return this.currentMode;
  }

  /**
   * Obtiene configuración del modo actual
   */
  public getModeConfig(): ModeConfig {
    if (this.currentMode === 'custom' && this.customConfig) {
      return this.customConfig;
    }
    return this.modes[this.currentMode as Exclude<ModeType, 'custom'>];
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
  public adjustModeFromFeedback(rating: number): void {
    // Solo ajustar en modos intermedios
    if (this.currentMode === 'deterministic' || this.currentMode === 'punk') {
      return; // Extremos no se auto-ajustan
    }

    const config = this.getModeConfig();

    // Rating alto: más caos
    if (rating > 7) {
      const adjusted: CustomModeConfig = {
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
      const adjusted: CustomModeConfig = {
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
  public reset(): void {
    this.currentMode = 'balanced';
    this.customConfig = undefined;
  }
}

