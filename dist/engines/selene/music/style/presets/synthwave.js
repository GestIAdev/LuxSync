/**
 * 🎸 PRESET: SYNTHWAVE ACTION
 * Energía retro 80s con sintetizadores pulsantes. Hotline Miami meets Drive.
 */
export const SYNTHWAVE_ACTION = {
    id: 'synthwave-action',
    name: 'Synthwave Action',
    description: 'Energía retro 80s con sintetizadores pulsantes. Hotline Miami meets Drive.',
    tags: ['synthwave', 'retro', '80s', 'energetic', 'action'],
    musical: {
        mode: 'minor',
        tempo: 128,
        timeSignature: [4, 4],
        rootRange: [48, 60],
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'seventh',
            density: 0.5,
            inversionProbability: 0.2,
            dissonanceLevel: 0.3,
            modulationStrategy: 'relative'
        },
        melodic: {
            range: [1, 2],
            contourPreference: 'arched',
            noteDensity: 0.6,
            restProbability: 0.2,
            ornamentation: 'moderate',
            motifRepetition: 0.85
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'moderate',
            swing: 0,
            syncopation: 0.3,
            layerDensity: 4
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 90,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 0.7,
            mixWeight: 0.9
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 75,
            velocityVariation: 0.15,
            articulation: 'staccato',
            noteDuration: 0.5,
            mixWeight: 0.7
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 85,
            velocityVariation: 0.1,
            articulation: 'staccato',
            noteDuration: 0.4,
            mixWeight: 0.8
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 80,
            velocityVariation: 0.25,
            articulation: 'staccato',
            noteDuration: 0.2,
            mixWeight: 0.6
        },
        pad: {
            enabled: true,
            octave: 3,
            velocity: 50,
            velocityVariation: 0.1,
            articulation: 'legato',
            noteDuration: 4.0,
            mixWeight: 0.4
        },
        lead: false
    },
    texture: {
        density: 'dense',
        verticalSpacing: 0.5,
        activeLayersRange: [4, 5],
        transparency: 0.1
    },
    temporal: {
        tempoEvolution: 'static',
        tempoVariation: 0,
        intensityArc: 'dramatic',
        fadeIn: 1.0,
        fadeOut: 2.0,
        loopable: true
    }
};
//# sourceMappingURL=synthwave.js.map