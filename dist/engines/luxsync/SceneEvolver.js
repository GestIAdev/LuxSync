/**
 * 🧬 SCENE EVOLVER
 * Evolution Engine para generar y evolucionar escenas de iluminación
 *
 * FLUJO:
 * MusicalPattern → Scene con genes → Mutación → Fitness → Evolución
 */
/**
 * SCENE EVOLVER
 */
export class SceneEvolver {
    generation = 0;
    sceneHistory = [];
    /**
     * Generar escena nueva basada en patrón musical
     */
    generateScene(pattern, fixtureCount) {
        const { mood, energy, entropy, bpm } = pattern;
        // Determinar modo de entropía según mood
        const entropyMode = mood === 'chill' ? 'orderly' :
            mood === 'drop' ? 'chaotic' :
                'balanced';
        // Generar genes según mood
        const genes = {
            strobeIntensity: mood === 'drop' ? 0.8 : mood === 'build' ? 0.4 : 0.0,
            colorPalette: this.generateColorPalette(mood, energy),
            movementSpeed: Math.min(bpm / 180, 1), // BPM normalizado
            fadeTime: mood === 'chill' ? 1000 : mood === 'drop' ? 100 : 500,
            brightness: energy,
            complexity: entropy,
            colorTemperature: this.getColorTemperature(mood)
        };
        this.generation++;
        const scene = {
            id: `scene_${Date.now()}_${this.generation}`,
            genes,
            fitness: 0.5, // Inicial neutral
            generation: this.generation,
            mood,
            timestamp: Date.now()
        };
        this.sceneHistory.push(scene);
        return scene;
    }
    /**
     * Mutar escena (evolución)
     */
    mutateScene(scene, mutationRate = 0.2, entropyMode = 'balanced') {
        const mutated = { ...scene };
        mutated.genes = { ...scene.genes };
        mutated.id = `scene_${Date.now()}_${++this.generation}`;
        mutated.generation = this.generation;
        mutated.timestamp = Date.now();
        // Factor de mutación según entropía
        const entropyFactor = entropyMode === 'orderly' ? 0.5 :
            entropyMode === 'chaotic' ? 2.0 :
                1.0;
        const effectiveMutationRate = mutationRate * entropyFactor;
        // Mutar cada gene con probabilidad
        if (Math.random() < effectiveMutationRate) {
            mutated.genes.strobeIntensity = this.mutateValue(scene.genes.strobeIntensity, 0.2);
        }
        if (Math.random() < effectiveMutationRate) {
            mutated.genes.movementSpeed = this.mutateValue(scene.genes.movementSpeed, 0.2);
        }
        if (Math.random() < effectiveMutationRate) {
            mutated.genes.brightness = this.mutateValue(scene.genes.brightness, 0.15);
        }
        if (Math.random() < effectiveMutationRate) {
            mutated.genes.complexity = this.mutateValue(scene.genes.complexity, 0.15);
        }
        if (Math.random() < effectiveMutationRate) {
            mutated.genes.fadeTime = Math.max(50, mutated.genes.fadeTime + (Math.random() - 0.5) * 500);
        }
        // Mutación de paleta de colores (raramente)
        if (Math.random() < effectiveMutationRate * 0.3) {
            mutated.genes.colorPalette = this.mutateColorPalette(scene.genes.colorPalette);
        }
        this.sceneHistory.push(mutated);
        return mutated;
    }
    /**
     * Evaluar fitness de escena
     */
    evaluateFitness(scene, feedback) {
        const { audioCorrelation, humanLike, stability } = feedback;
        // Weighted average
        let fitness = audioCorrelation * 0.5; // Audio sync = 50%
        if (humanLike !== undefined) {
            fitness += humanLike * 0.3; // Human feedback = 30%
            fitness += stability * 0.2; // Stability = 20%
        }
        else {
            fitness += stability * 0.5; // Si no hay feedback humano, stability = 50%
        }
        // Actualizar fitness de escena
        scene.fitness = fitness;
        return fitness;
    }
    /**
     * Crossover: combinar dos escenas exitosas
     */
    crossover(sceneA, sceneB) {
        const childGenes = {
            // Tomar genes alternados de A y B
            strobeIntensity: Math.random() > 0.5 ? sceneA.genes.strobeIntensity : sceneB.genes.strobeIntensity,
            colorPalette: Math.random() > 0.5 ? sceneA.genes.colorPalette : sceneB.genes.colorPalette,
            movementSpeed: (sceneA.genes.movementSpeed + sceneB.genes.movementSpeed) / 2, // Promedio
            fadeTime: Math.random() > 0.5 ? sceneA.genes.fadeTime : sceneB.genes.fadeTime,
            brightness: (sceneA.genes.brightness + sceneB.genes.brightness) / 2, // Promedio
            complexity: (sceneA.genes.complexity + sceneB.genes.complexity) / 2, // Promedio
            colorTemperature: Math.random() > 0.5 ? sceneA.genes.colorTemperature : sceneB.genes.colorTemperature
        };
        return {
            id: `scene_${Date.now()}_${++this.generation}`,
            genes: childGenes,
            fitness: (sceneA.fitness + sceneB.fitness) / 2, // Fitness promedio inicial
            generation: this.generation,
            mood: sceneA.mood, // Heredar mood del padre A
            timestamp: Date.now()
        };
    }
    /**
     * Obtener mejores escenas de la historia
     */
    getBestScenes(count = 5) {
        return [...this.sceneHistory]
            .sort((a, b) => b.fitness - a.fitness)
            .slice(0, count);
    }
    // ===== HELPERS PRIVADOS =====
    generateColorPalette(mood, energy) {
        switch (mood) {
            case 'chill':
                return ['#0080FF', '#00FFFF', '#8080FF']; // Blues suaves
            case 'build':
                return ['#FF8000', '#FFFF00', '#FF0080']; // Naranjas/Amarillos cálidos
            case 'drop':
                return ['#FF0000', '#FF00FF', '#FFFFFF']; // Rojos/Magentas intensos
            case 'break':
                return ['#404040', '#808080', '#C0C0C0']; // Grises
            default:
                return ['#FFFFFF'];
        }
    }
    getColorTemperature(mood) {
        switch (mood) {
            case 'chill': return 'cool';
            case 'drop': return 'warm';
            case 'build': return 'warm';
            case 'break': return 'neutral';
            default: return 'neutral';
        }
    }
    mutateValue(value, maxDelta) {
        const delta = (Math.random() - 0.5) * 2 * maxDelta;
        return Math.max(0, Math.min(1, value + delta));
    }
    mutateColorPalette(palette) {
        // Cambiar un color aleatorio
        const newPalette = [...palette];
        const index = Math.floor(Math.random() * newPalette.length);
        newPalette[index] = this.randomColor();
        return newPalette;
    }
    randomColor() {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
//# sourceMappingURL=SceneEvolver.js.map