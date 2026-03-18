/**
 * 🧬 SCENE EVOLVER
 * Evolution Engine para generar y evolucionar escenas de iluminación
 *
 * FLUJO:
 * MusicalPattern → Scene con genes → Mutación → Fitness → Evolución
 */
import { MusicalPattern, MusicMood } from './AudioToPatternMapper.js';
/**
 * MODOS DE ENTROPÍA
 * Controlan cuánta variación hay en las mutaciones
 */
export type EntropyMode = 'orderly' | 'balanced' | 'chaotic';
/**
 * GENES DE ESCENA
 * DNA de una escena de iluminación
 */
export interface SceneGenes {
    strobeIntensity: number;
    colorPalette: string[];
    movementSpeed: number;
    fadeTime: number;
    brightness: number;
    complexity: number;
    colorTemperature: 'warm' | 'cool' | 'neutral';
}
/**
 * ESCENA DE ILUMINACIÓN
 */
export interface LightScene {
    id: string;
    genes: SceneGenes;
    fitness: number;
    generation: number;
    mood: MusicMood;
    timestamp: number;
}
/**
 * FEEDBACK DE ESCENA
 */
export interface SceneFeedback {
    audioCorrelation: number;
    humanLike?: number;
    stability: number;
}
/**
 * SCENE EVOLVER
 */
export declare class SceneEvolver {
    private generation;
    private sceneHistory;
    /**
     * Generar escena nueva basada en patrón musical
     */
    generateScene(pattern: MusicalPattern, fixtureCount: number): LightScene;
    /**
     * Mutar escena (evolución)
     */
    mutateScene(scene: LightScene, mutationRate?: number, entropyMode?: EntropyMode): LightScene;
    /**
     * Evaluar fitness de escena
     */
    evaluateFitness(scene: LightScene, feedback: SceneFeedback): number;
    /**
     * Crossover: combinar dos escenas exitosas
     */
    crossover(sceneA: LightScene, sceneB: LightScene): LightScene;
    /**
     * Obtener mejores escenas de la historia
     */
    getBestScenes(count?: number): LightScene[];
    private generateColorPalette;
    private getColorTemperature;
    private mutateValue;
    private mutateColorPalette;
    private randomColor;
}
//# sourceMappingURL=SceneEvolver.d.ts.map