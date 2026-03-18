/**
 * 🎸 PRESET: LO-FI CHILL
 * Hip-hop relajado con jazz armonías. ChilledCow meets Nujabes.
 */
export const LOFI_CHILL = {
    id: 'lofi-minimalist',
    name: 'Lo-Fi Chill',
    description: 'Hip-hop relajado con jazz armonías. ChilledCow meets Nujabes.',
    tags: ['lofi', 'chill', 'jazz', 'relaxed', 'study'],
    musical: {
        mode: 'dorian',
        tempo: 85,
        timeSignature: [4, 4],
        rootRange: [48, 60],
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'extended', // Jazz chords (9, 11, 13)
            density: 0.5,
            inversionProbability: 0.6,
            dissonanceLevel: 0.35,
            modulationStrategy: 'relative'
        },
        melodic: {
            range: [0, 2],
            contourPreference: 'wave',
            noteDensity: 0.4,
            restProbability: 0.3,
            ornamentation: 'minimal',
            motifRepetition: 0.75
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'simple',
            swing: 0.6, // Heavy swing (lo-fi feel)
            syncopation: 0.4,
            layerDensity: 2
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 55,
            velocityVariation: 0.25,
            articulation: 'legato',
            noteDuration: 1.2,
            mixWeight: 0.8
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 45,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 2.0,
            mixWeight: 0.7
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 50,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 0.8,
            mixWeight: 0.6
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 40, // Soft drums
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 0.4,
            mixWeight: 0.4
        },
        pad: false,
        lead: false
    },
    texture: {
        density: 'medium',
        verticalSpacing: 0.5,
        activeLayersRange: [3, 4],
        transparency: 0.4
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0.05,
        intensityArc: 'flat',
        fadeIn: 2.0,
        fadeOut: 3.0,
        loopable: true
    }
};
//# sourceMappingURL=lofi.js.map