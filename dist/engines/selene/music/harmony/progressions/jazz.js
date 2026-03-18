/**
 * 🎸 JAZZ PROGRESSIONS
 * Progresiones jazz sofisticadas
 */
export const JAZZ_PROGRESSIONS = {
    'jazz-251': {
        id: 'jazz-251',
        name: 'ii-V-I (Jazz Turnaround)',
        description: 'LA progresión del jazz. Fundamental en bebop y standards.',
        tags: ['jazz', 'sophisticated', 'smooth'],
        chords: [
            { degree: 1, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // iim7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 0, quality: 'major', extensions: [7], duration: 2, inversion: 0 } // Imaj7 (2 bars)
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'jazz-36251': {
        id: 'jazz-36251',
        name: 'iii-vi-ii-V-I (Extended Jazz)',
        description: 'Progresión jazz extendida con más movimiento armónico.',
        tags: ['jazz', 'complex', 'smooth'],
        chords: [
            { degree: 2, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // iiim7
            { degree: 5, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // vim7
            { degree: 1, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // iim7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 0, quality: 'major', extensions: [7], duration: 2, inversion: 0 } // Imaj7 (2 bars)
        ],
        totalBars: 6,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'jazz-rhythm-changes': {
        id: 'jazz-rhythm-changes',
        name: 'Rhythm Changes A (Jazz Standard)',
        description: 'Basado en "I Got Rhythm". Progresión de 8 compases estándar del bebop.',
        tags: ['jazz', 'bebop', 'classic'],
        chords: [
            { degree: 0, quality: 'major', extensions: [7], duration: 1, inversion: 0 }, // Imaj7
            { degree: 5, quality: 'minor', extensions: [7], duration: 0.5, inversion: 0 }, // vim7
            { degree: 1, quality: 'minor', extensions: [7], duration: 0.5, inversion: 0 }, // iim7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 2, quality: 'minor', extensions: [7], duration: 0.5, inversion: 0 }, // iiim7
            { degree: 5, quality: 'minor', extensions: [7], duration: 0.5, inversion: 0 }, // vim7
            { degree: 1, quality: 'minor', extensions: [7], duration: 0.5, inversion: 0 }, // iim7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 0.5, inversion: 0 } // V7
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'jazz-blues': {
        id: 'jazz-blues',
        name: 'Jazz Blues (Extended)',
        description: 'Blues jazz con acordes extendidos. Miles Davis, John Coltrane.',
        tags: ['jazz', 'blues', 'extended', 'sophisticated'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7, 9], duration: 2, inversion: 0 }, // I7(♭9) (2 bars)
            { degree: 3, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 }, // IV7(♭9)
            { degree: 0, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 }, // I7(♭9)
            { degree: 4, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 }, // V7(♭9)
            { degree: 3, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 }, // IV7(♭9)
            { degree: 0, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 }, // I7(♭9)
            { degree: 4, quality: 'dominant', extensions: [7, 9], duration: 1, inversion: 0 } // V7(♭9)
        ],
        totalBars: 8,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'jazz-modal': {
        id: 'jazz-modal',
        name: 'Modal Jazz Vamp',
        description: 'Vamp modal con acordes estáticos. Kind of Blue, In a Silent Way.',
        tags: ['jazz', 'modal', 'ambient', 'miles-davis'],
        chords: [
            { degree: 0, quality: 'minor', extensions: [7, 11], duration: 2, inversion: 0 }, // im7(11)
            { degree: 3, quality: 'major', extensions: [7, 9], duration: 2, inversion: 0 } // IVmaj7(9)
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    }
};
//# sourceMappingURL=jazz.js.map