/**
 * 🎸 PRESET: CLASSICAL WALTZ
 * Vals elegante con melodía fluida y armonías ricas. Strauss meets Chopin.
 */
export const CLASSICAL_WALTZ = {
    id: 'classical-waltz',
    name: 'Classical Waltz',
    description: 'Vals elegante con melodía fluida y armonías ricas. Strauss meets Chopin.',
    tags: ['classical', 'waltz', 'elegant', 'melodic', 'romantic'],
    musical: {
        mode: 'major', // Mayor, elegante
        tempo: 120, // Tempo de vals
        timeSignature: [3, 4], // 3/4 para vals
        rootRange: [48, 60], // Registro medio
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'seventh', // Séptimas para riqueza
            density: 0.75, // 3 acordes por 4 compases
            inversionProbability: 0.5, // Inversiones elegantes
            dissonanceLevel: 0.2, // Baja disonancia
            modulationStrategy: 'relative' // Cambios suaves
        },
        melodic: {
            range: [1, 3], // Amplio rango
            contourPreference: 'wave', // Ondulante, expresivo
            noteDensity: 0.6, // Fluido
            restProbability: 0.2, // Moderados silencios
            ornamentation: 'moderate',
            motifRepetition: 0.6 // Moderadamente repetitivo
        },
        rhythmic: {
            baseDivision: 8,
            complexity: 'moderate',
            swing: 0.1, // Ligero swing
            syncopation: 0.2,
            layerDensity: 2
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 75,
            velocityVariation: 0.25,
            articulation: 'legato',
            noteDuration: 1.2,
            mixWeight: 1.0 // Protagonista
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 55,
            velocityVariation: 0.2,
            articulation: 'legato',
            noteDuration: 2.0,
            mixWeight: 0.8
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 60,
            velocityVariation: 0.15,
            articulation: 'normal',
            noteDuration: 1.5,
            mixWeight: 0.6
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 50,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 0.8,
            mixWeight: 0.4
        },
        pad: {
            enabled: true,
            octave: 4,
            velocity: 40,
            velocityVariation: 0.1,
            articulation: 'legato',
            noteDuration: 4.0,
            mixWeight: 0.5
        },
        lead: false
    },
    texture: {
        density: 'medium',
        verticalSpacing: 0.7,
        activeLayersRange: [3, 4],
        transparency: 0.4
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0.05,
        intensityArc: 'flat',
        fadeIn: 2.0,
        fadeOut: 4.0,
        loopable: true
    }
};
//# sourceMappingURL=classical-waltz.js.map