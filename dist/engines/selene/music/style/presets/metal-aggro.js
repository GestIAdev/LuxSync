/**
 * 🎸 PRESET: METAL AGGRO
 * Agresivo y rápido con riffs pesados y batería intensa. Metallica meets Slayer.
 */
export const METAL_AGGRO = {
    id: 'metal-aggro',
    name: 'Metal Aggro',
    description: 'Agresivo y rápido con riffs pesados y batería intensa. Metallica meets Slayer.',
    tags: ['metal', 'aggressive', 'fast', 'heavy', 'intense'],
    musical: {
        mode: 'phrygian', // Escala metalera oscura
        tempo: 160, // Muy rápido
        timeSignature: [4, 4],
        rootRange: [36, 48], // Registro grave
        harmonic: {
            progressionType: 'tonal',
            chordComplexity: 'seventh', // Power chords con séptimas
            density: 1.5, // Más de 1 acorde por compás
            inversionProbability: 0.2, // Pocas inversiones
            dissonanceLevel: 0.7, // Alta disonancia
            modulationStrategy: 'chromatic' // Modulaciones abruptas
        },
        melodic: {
            range: [1, 2], // Rango medio
            contourPreference: 'ascending', // Ascendente, agresivo
            noteDensity: 0.9, // Muy denso
            restProbability: 0.05, // Casi sin silencios
            ornamentation: 'moderate',
            motifRepetition: 0.9 // Muy repetitivo
        },
        rhythmic: {
            baseDivision: 16,
            complexity: 'complex',
            swing: 0,
            syncopation: 0.3,
            layerDensity: 5 // Máxima percusión
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 4,
            velocity: 100, // Máximo
            velocityVariation: 0.1,
            articulation: 'staccato',
            noteDuration: 0.6,
            mixWeight: 1.0 // Dominante
        },
        harmony: {
            enabled: true,
            octave: 3,
            velocity: 90,
            velocityVariation: 0.2,
            articulation: 'staccato',
            noteDuration: 0.8,
            mixWeight: 0.9
        },
        bass: {
            enabled: true,
            octave: 2,
            velocity: 95,
            velocityVariation: 0.15,
            articulation: 'staccato',
            noteDuration: 0.7,
            mixWeight: 0.8
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 100,
            velocityVariation: 0.2,
            articulation: 'staccato',
            noteDuration: 0.3,
            mixWeight: 0.9
        },
        pad: false,
        lead: {
            enabled: true,
            octave: 5,
            velocity: 85,
            velocityVariation: 0.3,
            articulation: 'staccato',
            noteDuration: 0.5,
            mixWeight: 0.7
        }
    },
    texture: {
        density: 'ultra-dense',
        verticalSpacing: 0.3, // Cerrado, pesado
        activeLayersRange: [4, 5],
        transparency: 0.1 // Casi continuo
    },
    temporal: {
        tempoEvolution: 'accelerando', // Tempo creciente
        tempoVariation: 0.1,
        intensityArc: 'dramatic',
        fadeIn: 0.5,
        fadeOut: 1.0,
        loopable: true
    }
};
//# sourceMappingURL=metal-aggro.js.map