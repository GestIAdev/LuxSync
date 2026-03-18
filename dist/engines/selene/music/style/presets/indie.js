/**
 * 🎸 PRESET: INDIE GAME LOOP
 * Bucle energético y pegadizo para videojuegos indie. Celeste meets Hollow Knight.
 */
export const INDIE_GAME_LOOP = {
    id: 'indie-game-loop',
    name: 'Indie Game Loop',
    description: 'Bucle energético y pegadizo para videojuegos indie. Celeste meets Hollow Knight.',
    tags: ['game', 'loop', 'energetic', 'melodic', 'upbeat'],
    musical: {
        mode: 'mixolydian', // Alegre pero no trivial
        tempo: 140,
        timeSignature: [4, 4],
        rootRange: [48, 60], // Registro medio
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'seventh',
            density: 1.0, // 1 acorde por compás
            inversionProbability: 0.3,
            dissonanceLevel: 0.2, // Consonante
            modulationStrategy: 'relative' // Cambio a relativo menor/mayor
        },
        melodic: {
            range: [0, 2],
            contourPreference: 'arched', // Sube y baja
            noteDensity: 0.7, // Bastante denso
            restProbability: 0.1, // Pocos silencios
            ornamentation: 'moderate',
            motifRepetition: 0.9 // MUY repetitivo (catchy)
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'moderate',
            swing: 0.1,
            syncopation: 0.4,
            layerDensity: 3
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 80,
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 0.9,
            mixWeight: 1.0 // Protagonista
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 60,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 0.8,
            mixWeight: 0.7
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 70,
            velocityVariation: 0.25,
            articulation: 'staccato',
            noteDuration: 0.5,
            mixWeight: 0.6
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 65,
            velocityVariation: 0.3,
            articulation: 'staccato',
            noteDuration: 0.3,
            mixWeight: 0.5
        },
        pad: false,
        lead: false
    },
    texture: {
        density: 'dense',
        verticalSpacing: 0.4,
        activeLayersRange: [3, 4],
        transparency: 0.2
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0,
        intensityArc: 'flat', // Energía constante
        fadeIn: 0.5,
        fadeOut: 1.0,
        loopable: true // DEBE loopearse perfectamente
    }
};
//# sourceMappingURL=indie.js.map