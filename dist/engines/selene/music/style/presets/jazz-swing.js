/**
 * 🎸 PRESET: JAZZ SWING
 * Ritmo swing con armonías complejas e improvisación. Miles Davis meets Django Reinhardt.
 */
export const JAZZ_SWING = {
    id: 'jazz-swing',
    name: 'Jazz Swing',
    description: 'Ritmo swing con armonías complejas e improvisación. Miles Davis meets Django Reinhardt.',
    tags: ['jazz', 'swing', 'complex', 'improvisational', 'energetic'],
    musical: {
        mode: 'mixolydian', // Escala jazzística
        tempo: 180, // Rápido, swing
        timeSignature: [4, 4],
        rootRange: [48, 60], // Registro medio
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'extended', // 9nas, 11vas, 13vas
            density: 1.0, // 1 acorde por compás
            inversionProbability: 0.6, // Inversiones frecuentes
            dissonanceLevel: 0.4, // Moderada tensión
            modulationStrategy: 'relative' // Cambios a relativos
        },
        melodic: {
            range: [1, 3], // Amplio rango
            contourPreference: 'arched', // Arqueado, expresivo
            noteDensity: 0.8, // Denso, improvisado
            restProbability: 0.1, // Pocos silencios
            ornamentation: 'heavy', // Ornamentación jazzística
            motifRepetition: 0.4 // Menos repetitivo, improvisado
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'complex',
            swing: 0.7, // Alto swing
            syncopation: 0.6, // Muy sincopado
            layerDensity: 3
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 70,
            velocityVariation: 0.4,
            articulation: 'normal',
            noteDuration: 0.8,
            mixWeight: 0.9 // Protagonista
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 50,
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 1.0,
            mixWeight: 0.7
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 65,
            velocityVariation: 0.35,
            articulation: 'staccato',
            noteDuration: 0.7,
            mixWeight: 0.8
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 60,
            velocityVariation: 0.4,
            articulation: 'staccato',
            noteDuration: 0.4,
            mixWeight: 0.6
        },
        pad: false,
        lead: {
            enabled: true,
            octave: 6,
            velocity: 55,
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 0.9,
            mixWeight: 0.7
        }
    },
    texture: {
        density: 'dense',
        verticalSpacing: 0.5,
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
//# sourceMappingURL=jazz-swing.js.map