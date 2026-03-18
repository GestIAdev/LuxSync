/**
 * 🎸 PRESET: TRIBAL DRUMS
 * Ritmos tribales intensos con percusión prominente. African drums meets electronic beats.
 */
export const TRIBAL_DRUMS = {
    id: 'tribal-drums',
    name: 'Tribal Drums',
    description: 'Ritmos tribales intensos con percusión prominente. African drums meets electronic beats.',
    tags: ['tribal', 'percussion', 'rhythmic', 'intense', 'organic'],
    musical: {
        mode: 'pentatonic', // Pentatónica simple
        tempo: 140, // Energético
        timeSignature: [4, 4],
        rootRange: [36, 48], // Registro medio-grave
        harmonic: {
            progressionType: 'modal',
            chordComplexity: 'triads', // Simple
            density: 0.5, // Acordes espaciados
            inversionProbability: 0.3,
            dissonanceLevel: 0.1, // Baja disonancia
            modulationStrategy: 'modal' // Cambios modales
        },
        melodic: {
            range: [0, 1], // Limitado
            contourPreference: 'ascending',
            noteDensity: 0.4, // Moderado
            restProbability: 0.3,
            ornamentation: 'minimal',
            motifRepetition: 0.8 // Repetitivo
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'complex',
            swing: 0.2,
            syncopation: 0.7, // Muy sincopado
            layerDensity: 5 // Máxima percusión
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 4,
            velocity: 60,
            velocityVariation: 0.3,
            articulation: 'staccato',
            noteDuration: 0.8,
            mixWeight: 0.4
        },
        harmony: {
            enabled: true,
            octave: 3,
            velocity: 50,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 1.5,
            mixWeight: 0.5
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 70,
            velocityVariation: 0.25,
            articulation: 'staccato',
            noteDuration: 1.0,
            mixWeight: 0.7
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 90, // Muy prominente
            velocityVariation: 0.4,
            articulation: 'staccato',
            noteDuration: 0.4,
            mixWeight: 1.0 // Dominante
        },
        pad: false,
        lead: {
            enabled: true,
            octave: 5,
            velocity: 55,
            velocityVariation: 0.3,
            articulation: 'staccato',
            noteDuration: 0.6,
            mixWeight: 0.6
        }
    },
    texture: {
        density: 'dense',
        verticalSpacing: 0.4,
        activeLayersRange: [4, 5],
        transparency: 0.2
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0,
        intensityArc: 'flat',
        fadeIn: 1.0,
        fadeOut: 2.0,
        loopable: true
    }
};
//# sourceMappingURL=tribal-drums.js.map