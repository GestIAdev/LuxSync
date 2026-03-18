/**
 * 🎸 PRESET: HORROR SUSPENSE
 * Atmósfera oscura y tensa con disonancias crecientes. Hitchcock meets Silent Hill.
 */
export const HORROR_SUSPENSE = {
    id: 'horror-suspense',
    name: 'Horror Suspense',
    description: 'Atmósfera oscura y tensa con disonancias crecientes. Hitchcock meets Silent Hill.',
    tags: ['horror', 'dark', 'tense', 'dissonant', 'atmospheric'],
    musical: {
        mode: 'locrian', // Escala más oscura y tensa
        tempo: 60, // Lento, construyendo tensión
        timeSignature: [4, 4],
        rootRange: [24, 36], // Registro muy grave
        harmonic: {
            progressionType: 'chromatic',
            chordComplexity: 'extended', // Acordes complejos y tensos
            density: 0.5, // Acordes más frecuentes pero cortos
            inversionProbability: 0.8, // Inversiones para tensión
            dissonanceLevel: 0.8, // Alta disonancia
            modulationStrategy: 'chromatic' // Modulaciones abruptas
        },
        melodic: {
            range: [0, 2], // Rango limitado, claustrofóbico
            contourPreference: 'descending', // Descendente, ominoso
            noteDensity: 0.2, // Muy espaciado
            restProbability: 0.6, // Muchos silencios para tensión
            ornamentation: 'none',
            motifRepetition: 0.8 // Repetitivo, obsesivo
        },
        rhythmic: {
            baseDivision: 4,
            complexity: 'simple',
            swing: 0,
            syncopation: 0.1,
            layerDensity: 1 // Percusión minimal
        }
    },
    layers: {
        melody: {
            enabled: true,
            octave: 4,
            velocity: 45, // Moderado
            velocityVariation: 0.3,
            articulation: 'staccato', // Corto, tenso
            noteDuration: 1.5,
            mixWeight: 0.7
        },
        harmony: {
            enabled: true,
            octave: 2,
            velocity: 40,
            velocityVariation: 0.2,
            articulation: 'legato',
            noteDuration: 3.0, // Sostenidos
            mixWeight: 0.9
        },
        bass: {
            enabled: true,
            octave: 1,
            velocity: 50,
            velocityVariation: 0.25,
            articulation: 'staccato',
            noteDuration: 2.0,
            mixWeight: 0.6
        },
        rhythm: {
            enabled: true,
            octave: 3,
            velocity: 35, // Suave, sutil
            velocityVariation: 0.1,
            articulation: 'staccato',
            noteDuration: 0.5,
            mixWeight: 0.3
        },
        pad: {
            enabled: true,
            octave: 3,
            velocity: 30, // Muy suave, fondo ominoso
            velocityVariation: 0.05,
            articulation: 'legato',
            noteDuration: 6.0, // Muy largo
            mixWeight: 0.5
        },
        lead: false
    },
    texture: {
        density: 'sparse',
        verticalSpacing: 0.6, // Moderadamente amplio
        activeLayersRange: [3, 4],
        transparency: 0.7 // Mucho espacio para tensión
    },
    temporal: {
        tempoEvolution: 'ritardando', // Tempo decreciente
        tempoVariation: 0.1,
        intensityArc: 'crescendo', // Intensidad creciente
        fadeIn: 3.0,
        fadeOut: 8.0, // Fade out largo
        loopable: false
    }
};
//# sourceMappingURL=horror-suspense.js.map