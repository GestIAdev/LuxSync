/**
 * 🎵 MODAL PROGRESSIONS
 * Progresiones modales para jazz, world music y ambient
 */
export const MODAL_PROGRESSIONS = {
    'modal-dorian': {
        id: 'modal-dorian',
        name: 'Dorian Modal Vamp',
        description: 'Vamp dorian clásico. Base del jazz modal.',
        tags: ['modal', 'dorian', 'jazz', 'vamp'],
        chords: [
            { degree: 0, quality: 'minor', extensions: [7], duration: 4, inversion: 0 }, // im7 (4 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // IV7 (4 bars)
            { degree: 0, quality: 'minor', extensions: [7], duration: 4, inversion: 0 } // im7 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'modal-phrygian': {
        id: 'modal-phrygian',
        name: 'Phrygian Dominant',
        description: 'Progresión frígia dominante. Atmósfera española/oriental.',
        tags: ['modal', 'phrygian', 'spanish', 'oriental'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7, 9, 11], duration: 4, inversion: 0 }, // I7(♭9,♯11) (4 bars)
            { degree: 3, quality: 'minor', extensions: [7, 9], duration: 4, inversion: 0 }, // ivm7(♭9) (4 bars)
            { degree: 0, quality: 'dominant', extensions: [7, 9, 11], duration: 4, inversion: 0 } // I7(♭9,♯11) (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'modal-lydian': {
        id: 'modal-lydian',
        name: 'Lydian Dream',
        description: 'Progresión lidia. Atmósfera soñadora y etérea.',
        tags: ['modal', 'lydian', 'dreamy', 'ethereal'],
        chords: [
            { degree: 0, quality: 'major', extensions: [6], duration: 4, inversion: 0 }, // Imaj6 (4 bars)
            { degree: 1, quality: 'minor', extensions: [7], duration: 2, inversion: 0 }, // iim7 (2 bars)
            { degree: 4, quality: 'major', extensions: [6], duration: 2, inversion: 0 }, // Vmaj6 (2 bars)
            { degree: 0, quality: 'major', extensions: [6], duration: 4, inversion: 0 } // Imaj6 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'modal-mixolydian': {
        id: 'modal-mixolydian',
        name: 'Mixolydian Groove',
        description: 'Groove mixolidio. Base del rock y funk.',
        tags: ['modal', 'mixolydian', 'groove', 'rock', 'funk'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // I7 (4 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // IV7 (4 bars)
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 } // I7 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'modal-aeolian': {
        id: 'modal-aeolian',
        name: 'Aeolian Lament',
        description: 'Lamento eolio. Atmósfera melancólica y emotiva.',
        tags: ['modal', 'aeolian', 'melancholic', 'emotional'],
        chords: [
            { degree: 0, quality: 'minor', extensions: [7], duration: 4, inversion: 0 }, // im7 (4 bars)
            { degree: 4, quality: 'dominant', extensions: [7, 9], duration: 2, inversion: 0 }, // V7(♭9) (2 bars)
            { degree: 3, quality: 'minor', extensions: [7], duration: 2, inversion: 0 }, // ivm7 (2 bars)
            { degree: 0, quality: 'minor', extensions: [7], duration: 4, inversion: 0 } // im7 (4 bars)
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    },
    // NUEVAS PROGRESIONES
    'phrygian-dark': {
        id: 'phrygian-dark',
        name: 'Phrygian Dark',
        description: 'Progresión frígia oscura con tensión modal',
        chords: [
            { degree: 0, quality: 'minor', duration: 2, extensions: [] }, // i
            { degree: 1, quality: 'major', duration: 2, extensions: [] }, // ♭II
            { degree: 7, quality: 'minor', duration: 2, extensions: [] }, // ♭vii
            { degree: 0, quality: 'minor', duration: 2, extensions: [] } // i
        ],
        totalBars: 8,
        voiceLeading: 'smooth',
        tags: ['modal', 'phrygian', 'dark', 'tense'],
        cyclic: true
    },
    'lydian-bright': {
        id: 'lydian-bright',
        name: 'Lydian Bright',
        description: 'Progresión lidia brillante y uplifting',
        chords: [
            { degree: 0, quality: 'major', duration: 2, extensions: [] }, // I
            { degree: 2, quality: 'major', duration: 1, extensions: [] }, // II
            { degree: 6, quality: 'minor', duration: 1, extensions: [] }, // #iv°
            { degree: 0, quality: 'major', duration: 2, extensions: [] } // I
        ],
        totalBars: 6,
        voiceLeading: 'smooth',
        tags: ['modal', 'lydian', 'bright', 'uplifting'],
        cyclic: true
    },
    'dorian-groovy': {
        id: 'dorian-groovy',
        name: 'Dorian Groovy',
        description: 'Progresión dorian groovy con feeling funk',
        chords: [
            { degree: 0, quality: 'minor', duration: 2, extensions: [] }, // i
            { degree: 5, quality: 'minor', duration: 2, extensions: [] }, // iv
            { degree: 7, quality: 'major', duration: 2, extensions: [] }, // VII
            { degree: 10, quality: 'major', duration: 2, extensions: [] } // V
        ],
        totalBars: 8,
        voiceLeading: 'smooth',
        tags: ['modal', 'dorian', 'groovy', 'funk'],
        cyclic: true
    }
};
//# sourceMappingURL=modal.js.map