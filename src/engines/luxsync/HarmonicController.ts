/**
 * 🎼 HARMONIC CONSENSUS
 * 7 nodos musicales (Do-Re-Mi-Fa-Sol-La-Si) votan democráticamente sobre escenas
 * 
 * FILOSOFÍA:
 * Cada nota musical tiene una personalidad que influye en sus preferencias
 * El consenso emerge de la votación ponderada por frecuencias de audio
 */

import { MusicalPattern } from './AudioToPatternMapper.js';
import { LightScene, SceneGenes } from './SceneEvolver.js';

/**
 * NOTA MUSICAL (Do-Si / C-B)
 */
export type MusicalNote = 'Do' | 'Re' | 'Mi' | 'Fa' | 'Sol' | 'La' | 'Si';

/**
 * PERSONALIDAD DE NODO
 */
export interface NodePersonality {
    note: MusicalNote;
    color: string;              // Color asociado
    temperament: string;        // Descripción de personalidad
    bassAffinity: number;       // 0-1 (qué tanto le gusta bass)
    midAffinity: number;        // 0-1 (qué tanto le gusta mid)
    trebleAffinity: number;     // 0-1 (qué tanto le gusta treble)
    energyPreference: number;   // 0-1 (energía preferida)
}

/**
 * VOTO DE NODO
 */
export interface NodeVote {
    node: MusicalNote;
    sceneId: string;
    score: number;              // 0-1 (qué tanto le gusta esta escena)
    reasoning: string;
}

/**
 * RESULTADO DE CONSENSO
 */
export interface ConsensusResult {
    winningScene: LightScene;
    votes: NodeVote[];
    consensusStrength: number;  // 0-1 (qué tan fuerte es el acuerdo)
    dominantNodes: MusicalNote[]; // Nodos que más influyeron
}

/**
 * NODO MUSICAL
 */
class MusicalNode {
    constructor(public personality: NodePersonality) {}
    
    /**
     * Votar por una escena basándose en patrón musical y personalidad
     */
    vote(scene: LightScene, pattern: MusicalPattern): NodeVote {
        const { genes } = scene;
        const { bass, mid, treble } = pattern.spectralProfile;
        
        // Calcular afinidad con frecuencias actuales
        const frequencyMatch = 
            (bass * this.personality.bassAffinity) +
            (mid * this.personality.midAffinity) +
            (treble * this.personality.trebleAffinity);
        
        // Calcular match de energía
        const energyMatch = 1 - Math.abs(pattern.energy - this.personality.energyPreference);
        
        // Calcular preferencia por brightness
        const brightnessMatch = genes.brightness;
        
        // Calcular score ponderado
        const score = (
            frequencyMatch * 0.5 +
            energyMatch * 0.3 +
            brightnessMatch * 0.2
        );
        
        // Generar reasoning
        const reasoning = this.generateReasoning(score, pattern, genes);
        
        return {
            node: this.personality.note,
            sceneId: scene.id,
            score: Math.min(Math.max(score, 0), 1), // Clamp 0-1
            reasoning
        };
    }
    
    private generateReasoning(score: number, pattern: MusicalPattern, genes: SceneGenes): string {
        if (score > 0.8) {
            return `${this.personality.note} adora esta escena! (${this.personality.temperament})`;
        } else if (score > 0.6) {
            return `${this.personality.note} la aprueba (buena ${genes.colorTemperature} temperature)`;
        } else if (score > 0.4) {
            return `${this.personality.note} es neutral (energía podría mejorar)`;
        } else {
            return `${this.personality.note} no está convencido (poco match con su afinidad)`;
        }
    }
}

/**
 * HARMONIC CONTROLLER
 * Gestiona el swarm de 7 nodos musicales
 */
export class HarmonicController {
    private nodes: MusicalNode[] = [];
    
    /**
     * Inicializar swarm de 7 nodos
     */
    initSwarm(): void {
        const personalities: NodePersonality[] = [
            {
                note: 'Do',
                color: '#FF0000',
                temperament: 'Agresivo, bass-driven, enérgico',
                bassAffinity: 0.9,
                midAffinity: 0.3,
                trebleAffinity: 0.1,
                energyPreference: 0.8
            },
            {
                note: 'Re',
                color: '#FF8000',
                temperament: 'Rítmico, energético, movimiento',
                bassAffinity: 0.7,
                midAffinity: 0.5,
                trebleAffinity: 0.2,
                energyPreference: 0.7
            },
            {
                note: 'Mi',
                color: '#FFFF00',
                temperament: 'Brillante, mid-driven, alegre',
                bassAffinity: 0.3,
                midAffinity: 0.9,
                trebleAffinity: 0.4,
                energyPreference: 0.6
            },
            {
                note: 'Fa',
                color: '#00FF00',
                temperament: 'Natural, equilibrado, armónico',
                bassAffinity: 0.5,
                midAffinity: 0.5,
                trebleAffinity: 0.5,
                energyPreference: 0.5
            },
            {
                note: 'Sol',
                color: '#00FFFF',
                temperament: 'Fluido, treble-driven, etéreo',
                bassAffinity: 0.2,
                midAffinity: 0.5,
                trebleAffinity: 0.9,
                energyPreference: 0.4
            },
            {
                note: 'La',
                color: '#0080FF',
                temperament: 'Profundo, atmosférico, contemplativo',
                bassAffinity: 0.6,
                midAffinity: 0.4,
                trebleAffinity: 0.7,
                energyPreference: 0.3
            },
            {
                note: 'Si',
                color: '#FF00FF',
                temperament: 'Místico, experimental, impredecible',
                bassAffinity: 0.4,
                midAffinity: 0.6,
                trebleAffinity: 0.8,
                energyPreference: 0.6
            }
        ];
        
        this.nodes = personalities.map(p => new MusicalNode(p));
    }
    
    /**
     * Votación: todos los nodos votan por todas las escenas
     */
    voteOnScenes(scenes: LightScene[], pattern: MusicalPattern): ConsensusResult {
        if (this.nodes.length === 0) {
            this.initSwarm();
        }
        
        // Cada nodo vota por cada escena
        const allVotes: NodeVote[][] = scenes.map(scene =>
            this.nodes.map(node => node.vote(scene, pattern))
        );
        
        // Calcular score total por escena
        const sceneScores = allVotes.map(votes => ({
            scene: scenes[allVotes.indexOf(votes)],
            totalScore: votes.reduce((sum, vote) => sum + vote.score, 0),
            votes
        }));
        
        // Ordenar por score
        sceneScores.sort((a, b) => b.totalScore - a.totalScore);
        
        const winner = sceneScores[0];
        
        // Calcular consensus strength (qué tan de acuerdo están todos)
        const avgScore = winner.totalScore / this.nodes.length;
        const variance = winner.votes.reduce((sum, vote) => 
            sum + Math.pow(vote.score - avgScore, 2), 0
        ) / this.nodes.length;
        const consensusStrength = 1 - Math.sqrt(variance); // Menos varianza = más consenso
        
        // Identificar nodos dominantes (los que votaron más alto)
        const dominantNodes = winner.votes
            .filter(vote => vote.score > avgScore)
            .map(vote => vote.node);
        
        return {
            winningScene: winner.scene,
            votes: winner.votes,
            consensusStrength: Math.max(0, Math.min(1, consensusStrength)),
            dominantNodes
        };
    }
    
    /**
     * Aplicar consenso con transiciones suaves
     * (Mezcla genes según votos)
     */
    applyConsensus(
        currentScene: LightScene | null,
        targetScene: LightScene,
        consensusResult: ConsensusResult,
        transitionTime: number = 500
    ): LightScene {
        // Si no hay escena actual, usar target directamente
        if (!currentScene) {
            return targetScene;
        }
        
        // Calcular genes interpolados
        const { consensusStrength } = consensusResult;
        const alpha = consensusStrength; // Qué tanto peso tiene el target
        
        const smoothedGenes: SceneGenes = {
            strobeIntensity: this.lerp(
                currentScene.genes.strobeIntensity,
                targetScene.genes.strobeIntensity,
                alpha
            ),
            colorPalette: targetScene.genes.colorPalette, // No interpolar colores
            movementSpeed: this.lerp(
                currentScene.genes.movementSpeed,
                targetScene.genes.movementSpeed,
                alpha
            ),
            fadeTime: Math.max(transitionTime, targetScene.genes.fadeTime),
            brightness: this.lerp(
                currentScene.genes.brightness,
                targetScene.genes.brightness,
                alpha
            ),
            complexity: this.lerp(
                currentScene.genes.complexity,
                targetScene.genes.complexity,
                alpha
            ),
            colorTemperature: targetScene.genes.colorTemperature
        };
        
        return {
            ...targetScene,
            genes: smoothedGenes
        };
    }
    
    /**
     * Get node personalities (para debugging)
     */
    getNodes(): NodePersonality[] {
        return this.nodes.map(node => node.personality);
    }
    
    // ===== HELPERS =====
    
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }
}
