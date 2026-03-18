/**
 * 🎼 CLASSICAL PROGRESSIONS
 * Progresiones clásicas y académicas
 */
export const CLASSICAL_PROGRESSIONS = {
    'classical-cadence': {
        id: 'classical-cadence',
        name: 'Perfect Authentic Cadence',
        description: 'Cadencia perfecta auténtica. Resolución clásica V-I.',
        tags: ['classical', 'cadence', 'authentic', 'resolution'],
        chords: [
            { degree: 4, quality: 'major', extensions: [], duration: 2, inversion: 0 }, // V (2 bars)
            { degree: 0, quality: 'major', extensions: [], duration: 2, inversion: 0 } // I (2 bars)
        ],
        totalBars: 4,
        voiceLeading: 'contrary',
        cyclic: false
    },
    'classical-circle': {
        id: 'classical-circle',
        name: 'Circle of Fifths',
        description: 'Círculo de quintas ascendente. Base de la armonía clásica.',
        tags: ['classical', 'circle-of-fifths', 'harmonic', 'foundation'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // V
            { degree: 1, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // ii
            { degree: 5, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // vi
            { degree: 2, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // iii
            { degree: 6, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // vii°
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 } // I
        ],
        totalBars: 8,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'classical-romantic': {
        id: 'classical-romantic',
        name: 'Romantic Sequence',
        description: 'Secuencia romántica con modulaciones.',
        tags: ['classical', 'romantic', 'sequence', 'modulation'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 2, inversion: 0 }, // I (2 bars)
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // V
            { degree: 1, quality: 'minor', extensions: [], duration: 1, inversion: 0 }, // ii
            { degree: 5, quality: 'major', extensions: [], duration: 2, inversion: 0 }, // vi (2 bars)
            { degree: 2, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // iii
            { degree: 6, quality: 'diminished', extensions: [], duration: 1, inversion: 0 }, // vii°
            { degree: 0, quality: 'major', extensions: [], duration: 2, inversion: 0 } // I (2 bars)
        ],
        totalBars: 10,
        voiceLeading: 'contrary',
        cyclic: false
    },
    'classical-baroque': {
        id: 'classical-baroque',
        name: 'Baroque Ground Bass',
        description: 'Bajo continuo barroco con armonía rica.',
        tags: ['classical', 'baroque', 'ground-bass', 'continuo'],
        chords: [
            { degree: 0, quality: 'major', extensions: [6], duration: 4, inversion: 0 }, // I6 (4 bars)
            { degree: 4, quality: 'major', extensions: [6, 4], duration: 2, inversion: 0 }, // V6/4 (2 bars)
            { degree: 0, quality: 'major', extensions: [], duration: 2, inversion: 0 }, // I (2 bars)
            { degree: 3, quality: 'major', extensions: [6], duration: 4, inversion: 0 } // IV6 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'contrary',
        cyclic: true
    },
    'classical-impressionist': {
        id: 'classical-impressionist',
        name: 'Impressionist Harmony',
        description: 'Armonía impresionista con acordes extendidos.',
        tags: ['classical', 'impressionist', 'extended', 'atmospheric'],
        chords: [
            { degree: 0, quality: 'major', extensions: [7], duration: 4, inversion: 0 }, // Imaj7 (4 bars)
            { degree: 3, quality: 'major', extensions: [7], duration: 2, inversion: 0 }, // IVmaj7 (2 bars)
            { degree: 1, quality: 'minor', extensions: [7], duration: 2, inversion: 0 }, // iim7 (2 bars)
            { degree: 5, quality: 'minor', extensions: [7], duration: 4, inversion: 0 } // vim7 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    }
};
//# sourceMappingURL=classical.js.map