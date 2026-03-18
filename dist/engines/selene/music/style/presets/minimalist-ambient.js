/**
 * 🎸 PRESET: MINIMALIST AMBIENT
 * Espacios amplios con texturas minimalistas. Brian Eno meets Arvo Pärt.
 */
export const MINIMALIST_AMBIENT = {
    id: 'minimalist-ambient',
    name: 'Minimalist Ambient',
    description: 'Espacios amplios con texturas minimalistas. Brian Eno meets Arvo Pärt.',
    tags: ['minimalist', 'ambient', 'sparse', 'meditative', 'slow'],
    musical: {
        mode: 'major', // Mayor, sereno
        tempo: 50, // Muy lento
        timeSignature: [4, 4],
        rootRange: [36, 48], // Registro grave
        harmonic: {
            progressionType: 'modal',
            chordComplexity: 'triads', // Simple
            density: 0.125, // Muy espaciado
            inversionProbability: 0.4,
            dissonanceLevel: 0.1, // Baja disonancia
            modulationStrategy: 'modal' // Cambios sutiles
        },
        melodic: {
            range: [1, 2], // Moderado
            contourPreference: 'ascending',
            noteDensity: 0.1, // Muy espaciado
            restProbability: 0.7, // Muchos silencios
            ornamentation: 'none',
            motifRepetition: 0.9 // Muy repetitivo
        },
        rhythmic: {
            baseDivision: 4,
            complexity: 'simple',
            swing: 0,
            syncopation: 0,
            layerDensity: 1 // Minimal percusión
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 35, // Muy suave
            velocityVariation: 0.1,
            articulation: 'legato',
            noteDuration: 4.0, // Muy largo
            mixWeight: 0.8
        },
        harmony: {
            enabled: true,
            octave: 3,
            velocity: 25,
            velocityVariation: 0.05,
            articulation: 'legato',
            noteDuration: 8.0, // Drones
            mixWeight: 0.6
        },
        bass: false,
        rhythm: false,
        pad: {
            enabled: true,
            octave: 4,
            velocity: 20, // Extremadamente suave
            velocityVariation: 0.02,
            articulation: 'legato',
            noteDuration: 12.0, // Ultra largo
            mixWeight: 0.4
        },
        lead: false
    },
    texture: {
        density: 'sparse',
        verticalSpacing: 0.9, // Muy amplio
        activeLayersRange: [1, 2],
        transparency: 0.9 // Casi todo espacio
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0.02,
        intensityArc: 'flat',
        fadeIn: 10.0, // Fade in largo
        fadeOut: 15.0, // Fade out muy largo
        loopable: true
    }
};
//# sourceMappingURL=minimalist-ambient.js.map