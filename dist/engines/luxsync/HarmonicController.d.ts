/**
 * 🎼 HARMONIC CONSENSUS
 * 7 nodos musicales (Do-Re-Mi-Fa-Sol-La-Si) votan democráticamente sobre escenas
 *
 * FILOSOFÍA:
 * Cada nota musical tiene una personalidad que influye en sus preferencias
 * El consenso emerge de la votación ponderada por frecuencias de audio
 */
import { MusicalPattern } from './AudioToPatternMapper.js';
import { LightScene } from './SceneEvolver.js';
/**
 * NOTA MUSICAL (Do-Si / C-B)
 */
export type MusicalNote = 'Do' | 'Re' | 'Mi' | 'Fa' | 'Sol' | 'La' | 'Si';
/**
 * PERSONALIDAD DE NODO
 */
export interface NodePersonality {
    note: MusicalNote;
    color: string;
    temperament: string;
    bassAffinity: number;
    midAffinity: number;
    trebleAffinity: number;
    energyPreference: number;
}
/**
 * VOTO DE NODO
 */
export interface NodeVote {
    node: MusicalNote;
    sceneId: string;
    score: number;
    reasoning: string;
}
/**
 * RESULTADO DE CONSENSO
 */
export interface ConsensusResult {
    winningScene: LightScene;
    votes: NodeVote[];
    consensusStrength: number;
    dominantNodes: MusicalNote[];
}
/**
 * HARMONIC CONTROLLER
 * Gestiona el swarm de 7 nodos musicales
 */
export declare class HarmonicController {
    private nodes;
    /**
     * Inicializar swarm de 7 nodos
     */
    initSwarm(): void;
    /**
     * Votación: todos los nodos votan por todas las escenas
     */
    voteOnScenes(scenes: LightScene[], pattern: MusicalPattern): ConsensusResult;
    /**
     * Aplicar consenso con transiciones suaves
     * (Mezcla genes según votos)
     */
    applyConsensus(currentScene: LightScene | null, targetScene: LightScene, consensusResult: ConsensusResult, transitionTime?: number): LightScene;
    /**
     * Get node personalities (para debugging)
     */
    getNodes(): NodePersonality[];
    private lerp;
}
//# sourceMappingURL=HarmonicController.d.ts.map