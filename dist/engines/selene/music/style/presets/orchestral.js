/**
 * 🎸 PRESET: EPIC ORCHESTRAL
 * Orquestación cinematográfica grandiosa. Hans Zimmer meets Two Steps from Hell.
 */
export const EPIC_ORCHESTRAL = {
    id: 'epic-orchestral',
    name: 'Epic Orchestral',
    description: 'Orquestación cinematográfica grandiosa. Hans Zimmer meets Two Steps from Hell.',
    tags: ['orchestral', 'epic', 'cinematic', 'dramatic', 'powerful'],
    musical: {
        mode: 'minor',
        tempo: 90,
        timeSignature: [4, 4],
        rootRange: [36, 48],
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'extended',
            density: 0.5,
            inversionProbability: 0.4,
            dissonanceLevel: 0.5,
            modulationStrategy: 'chromatic'
        },
        melodic: {
            range: [2, 4], // Rango amplio
            contourPreference: 'arched',
            noteDensity: 0.5,
            restProbability: 0.15,
            ornamentation: 'heavy',
            motifRepetition: 0.7
        },
        rhythmic: {
            baseDivision: 8,
            complexity: 'complex',
            swing: 0,
            syncopation: 0.2,
            layerDensity: 5
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 5,
            velocity: 100,
            velocityVariation: 0.4,
            articulation: 'normal',
            noteDuration: 1.5,
            mixWeight: 1.0
        },
        harmony: {
            enabled: true,
            octave: 4,
            velocity: 90,
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 2.0,
            mixWeight: 0.9
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 95,
            velocityVariation: 0.2,
            articulation: 'normal',
            noteDuration: 1.0,
            mixWeight: 0.8
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 100,
            velocityVariation: 0.35,
            articulation: 'staccato',
            noteDuration: 0.3,
            mixWeight: 0.7
        },
        pad: {
            enabled: true,
            octave: 3,
            velocity: 70,
            velocityVariation: 0.2,
            articulation: 'legato',
            noteDuration: 6.0,
            mixWeight: 0.6
        },
        lead: {
            enabled: true,
            octave: 6,
            velocity: 110,
            velocityVariation: 0.3,
            articulation: 'normal',
            noteDuration: 1.2,
            mixWeight: 0.9
        }
    },
    texture: {
        density: 'ultra-dense',
        verticalSpacing: 0.7,
        activeLayersRange: [5, 6],
        transparency: 0.1
    },
    temporal: {
        tempoEvolution: 'accelerando',
        tempoVariation: 0.2,
        intensityArc: 'dramatic',
        fadeIn: 2.0,
        fadeOut: 4.0,
        loopable: false
    }
};
//# sourceMappingURL=orchestral.js.map