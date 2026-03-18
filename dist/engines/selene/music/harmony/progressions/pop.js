/**
 * 🎸 POP PROGRESSIONS
 * Progresiones pop clásicas y modernas
 */
export const POP_PROGRESSIONS = {
    'pop-classic': {
        id: 'pop-classic',
        name: 'I-V-vi-IV (Classic Pop)',
        description: 'La progresión más famosa del pop moderno. Let It Be, Don\'t Stop Believin\', With Or Without You.',
        tags: ['pop', 'rock', 'anthemic', 'emotional'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // V
            { degree: 5, quality: 'minor', extensions: [], duration: 1, inversion: 0 }, // vi
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 } // IV
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'pop-sensitive': {
        id: 'pop-sensitive',
        name: 'vi-IV-I-V (Sensitive Pop)',
        description: 'Progresión emotiva que empieza en menor. Someone Like You, Apologize.',
        tags: ['pop', 'emotional', 'melancholic'],
        chords: [
            { degree: 5, quality: 'minor', extensions: [], duration: 1, inversion: 0 }, // vi
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 } // V
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'pop-dreamy': {
        id: 'pop-dreamy',
        name: 'I-vi-IV-V (Dreamy Pop)',
        description: 'Progresión soñadora y nostálgica. Dreams, Hey Soul Sister.',
        tags: ['pop', 'dreamy', 'nostalgic', 'soft'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 5, quality: 'minor', extensions: [], duration: 1, inversion: 0 }, // vi
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 } // V
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'pop-upbeat': {
        id: 'pop-upbeat',
        name: 'I-IV-V-I (Upbeat Pop)',
        description: 'Progresión energética y positiva. Happy, Can\'t Stop the Feeling.',
        tags: ['pop', 'upbeat', 'energetic', 'positive'],
        chords: [
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // I
            { degree: 3, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // IV
            { degree: 4, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // V
            { degree: 0, quality: 'major', extensions: [], duration: 1, inversion: 0 } // I
        ],
        totalBars: 4,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'pop-minor': {
        id: 'pop-minor',
        name: 'i-VI-III-VII (Minor Pop)',
        description: 'Progresión menor emotiva. Someone You Loved, drivers license.',
        tags: ['pop', 'minor', 'emotional', 'sad'],
        chords: [
            { degree: 0, quality: 'minor', extensions: [], duration: 1, inversion: 0 }, // i
            { degree: 5, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // VI
            { degree: 2, quality: 'major', extensions: [], duration: 1, inversion: 0 }, // III
            { degree: 6, quality: 'major', extensions: [], duration: 1, inversion: 0 } // VII
        ],
        totalBars: 4,
        voiceLeading: 'smooth',
        cyclic: true
    }
};
//# sourceMappingURL=pop.js.map