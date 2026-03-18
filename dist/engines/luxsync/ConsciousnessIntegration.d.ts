/**
 * 🌙 CONSCIOUSNESS INTEGRATION (LuxSync Simplified)
 * Integración simplificada de Selene Consciousness para LuxSync
 *
 * CAPAS ACTIVAS:
 * 1. Hunting Layer - Caza de patrones (sentidos felinos)
 * 2. Dream Layer - Generación creativa
 * 3. Ethics Layer - Validación de seguridad
 * 4. Self-Analysis Layer - Aprendizaje
 * 5. Memory Layer - Persistencia (Redis opcional)
 *
 * Nota: Esta es una versión STANDALONE que NO requiere dependencias pesadas de Selene
 */
import { MusicalPattern, MusicMood } from './AudioToPatternMapper.js';
import { LightScene, SceneGenes } from './SceneEvolver.js';
/**
 * TIPO DE PATRÓN ESTRUCTURAL
 */
export type StructuralPattern = 'intro' | 'verse' | 'chorus' | 'bridge' | 'drop' | 'breakdown' | 'buildup' | 'outro';
/**
 * RESULTADO DE ANÁLISIS DE PATRÓN
 */
export interface PatternAnalysis {
    patternType: StructuralPattern;
    confidence: number;
    suggestions: string[];
    energyTrend: 'rising' | 'falling' | 'stable';
}
/**
 * SUGERENCIA CREATIVA (Dream Layer)
 */
export interface CreativeSuggestion {
    id: string;
    description: string;
    genes: Partial<SceneGenes>;
    novelty: number;
}
/**
 * VALIDACIÓN ÉTICA
 */
export interface EthicsValidation {
    safe: boolean;
    warnings: string[];
    adjustments: Partial<SceneGenes>;
}
/**
 * CONSCIENCIA SIMPLIFICADA
 */
export declare class ConsciousnessIntegration {
    private patternHistory;
    private sceneSuccessHistory;
    private patternCounts;
    private readonly MAX_STROBE_FREQUENCY;
    private readonly MAX_BRIGHTNESS;
    /**
     * HUNTING LAYER: Caza de patrones estructurales
     * Sentidos felinos detectan estructuras musicales
     */
    analyzePattern(pattern: MusicalPattern): PatternAnalysis;
    /**
     * DREAM LAYER: Generación creativa
     * Exploración de ideas no obvias
     */
    dreamScenes(pattern: MusicalPattern, count?: number): CreativeSuggestion[];
    /**
     * ETHICS LAYER: Validación de seguridad
     * Previene strobes peligrosos y cambios bruscos
     */
    ethicsCheck(scene: LightScene): EthicsValidation;
    /**
     * SELF-ANALYSIS LAYER: Aprendizaje continuo
     * Analiza qué escenas funcionan mejor
     */
    selfAnalysis(): {
        insights: string[];
        bestPatterns: StructuralPattern[];
        avgSuccessRate: number;
    };
    /**
     * MEMORY LAYER: Recordar escenas exitosas
     * (Versión simplificada sin Redis)
     */
    rememberScene(scene: LightScene, success: number): void;
    /**
     * Recuperar escenas similares exitosas
     */
    recallSuccessfulScenes(mood: MusicMood, minFitness?: number): string[];
    private detectEnergyTrend;
    private generateSuggestions;
    private invertColors;
    /**
     * Get statistics
     */
    getStats(): {
        patternHistorySize: number;
        sceneMemorySize: number;
        patternCounts: {
            [k: string]: number;
        };
    };
}
//# sourceMappingURL=ConsciousnessIntegration.d.ts.map