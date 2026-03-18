/**
 * 🎸 PRESET: NEOCLASSICAL DRONE
 * Minimalismo contemporáneo con drones armónicos. Max Richter meets Jóhann Jóhannsson.
 */
export const NEOCLASSICAL_DRONE = {
    id: 'neoclassical-drone',
    name: 'Neoclassical Drone',
    description: 'Minimalismo contemporáneo con drones armónicos. Max Richter meets Jóhann Jóhannsson.',
    tags: ['classical', 'minimalist', 'drone', 'slow', 'meditative'],
    musical: {
        mode: 'dorian',
        tempo: 50, // Muy lento
        timeSignature: [3, 4], // Vals lento
        rootRange: [40, 52],
        harmonic: {
            progressionType: 'modal',
            chordComplexity: 'extended',
            density: 0.125, // 1 acorde cada 8 compases
            inversionProbability: 0.5,
            dissonanceLevel: 0.4,
            modulationStrategy: 'parallel'
        },
        melodic: {
            range: [1, 2],
            contourPreference: 'ascending',
            noteDensity: 0.2, // Muy espaciado
            restProbability: 0.5,
            ornamentation: 'none',
            motifRepetition: 0.8
        },
        rhythmic: {
            baseDivision: 4,
            complexity: 'simple',
            swing: 0,
            syncopation: 0,
            layerDensity: 1
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 45,
            velocityVariation: 0.1,
            articulation: 'legato',
            noteDuration: 3.0,
            mixWeight: 0.7
        },
        harmony: {
            enabled: true,
            octave: 3,
            velocity: 35,
            velocityVariation: 0.05,
            articulation: 'legato',
            noteDuration: 12.0, // Drones larguísimos
            mixWeight: 1.0
        },
        bass: false,
        rhythm: false,
        pad: {
            enabled: true,
            octave: 4,
            velocity: 30,
            velocityVariation: 0.05,
            articulation: 'legato',
            noteDuration: 16.0,
            mixWeight: 0.5
        },
        lead: false
    },
    texture: {
        density: 'sparse',
        verticalSpacing: 0.9,
        activeLayersRange: [2, 3],
        transparency: 0.8
    },
    temporal: {
        tempoEvolution: 'rubato', // Tempo flexible
        tempoVariation: 0.15,
        intensityArc: 'crescendo',
        fadeIn: 8.0,
        fadeOut: 10.0,
        loopable: false
    }
};
//# sourceMappingURL=neoclassical.js.map