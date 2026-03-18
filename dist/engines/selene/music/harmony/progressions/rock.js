/**
 * 🎸 ROCK PROGRESSIONS
 * Progresiones rock clásicas y modernas
 */
export const ROCK_PROGRESSIONS = {
    'rock-power': {
        id: 'rock-power',
        name: 'I-IV-V (Rock Power)',
        description: 'La progresión del rock clásico. Chuck Berry, The Beatles, AC/DC.',
        tags: ['rock', 'power', 'classic', 'energetic'],
        chords: [
            { degree: 0, quality: 'power', extensions: [], duration: 2, inversion: 0 }, // I (2 bars)
            { degree: 3, quality: 'power', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 4, quality: 'power', extensions: [], duration: 1, inversion: 0 } // V
        ],
        totalBars: 4,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'rock-blues': {
        id: 'rock-blues',
        name: 'I-IV-I-V-IV-I (Rock Blues)',
        description: 'Progresión rock con influencia blues. Johnny B. Goode, La Bamba.',
        tags: ['rock', 'blues', 'classic', 'groovy'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // I7 (2 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // IV7
            { degree: 0, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // I7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 } // IV7
        ],
        totalBars: 6,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'rock-punk': {
        id: 'rock-punk',
        name: 'I-♭VII-IV (Punk Raw)',
        description: 'Progresión punk con acorde prestado. Blink-182, Green Day.',
        tags: ['punk', 'raw', 'rebellious'],
        chords: [
            { degree: 0, quality: 'power', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 6, quality: 'power', extensions: [], duration: 1, inversion: 0, borrowed: true }, // ♭VII (prestado del eólico)
            { degree: 3, quality: 'power', extensions: [], duration: 2, inversion: 0 } // IV (2 bars)
        ],
        totalBars: 4,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'rock-ballad': {
        id: 'rock-ballad',
        name: 'I-VI-IV-V (Rock Ballad)',
        description: 'Progresión emotiva para baladas rock. More Than Words, Every Rose Has Its Thorn.',
        tags: ['rock', 'ballad', 'emotional', 'slow'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 5, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // VI
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 } // V
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'rock-progressive': {
        id: 'rock-progressive',
        name: 'I-II-III-IV (Progressive Rock)',
        description: 'Progresión progresiva ascendente. Dream Theater, Rush.',
        tags: ['rock', 'progressive', 'complex', 'ascending'],
        chords: [
            { degree: 0, quality: 'major', extensions: [7], duration: 1, inversion: 0 }, // Imaj7
            { degree: 1, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // iim7
            { degree: 2, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // iiim7
            { degree: 3, quality: 'major', extensions: [7], duration: 1, inversion: 0 } // IVmaj7
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    }
};
//# sourceMappingURL=rock.js.map