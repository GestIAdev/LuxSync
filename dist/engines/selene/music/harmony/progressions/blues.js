/**
 * 🎸 BLUES PROGRESSIONS
 * Progresiones blues tradicionales y modernas
 */
export const BLUES_PROGRESSIONS = {
    'blues-12bar': {
        id: 'blues-12bar',
        name: '12-Bar Blues (Classic)',
        description: 'El blues de 12 compases clásico. Base del blues, rock & roll, jazz.',
        tags: ['blues', 'classic', 'foundational'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // I7 (4 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // IV7 (2 bars)
            { degree: 0, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // I7 (2 bars)
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // IV7
            { degree: 0, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // I7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 } // V7 (turnaround)
        ],
        totalBars: 12,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'blues-minor': {
        id: 'blues-minor',
        name: 'Minor Blues (Moody)',
        description: 'Blues menor para atmósferas más oscuras.',
        tags: ['blues', 'minor', 'dark', 'moody'],
        chords: [
            { degree: 0, quality: 'minor', extensions: [7], duration: 4, inversion: 0 }, // im7 (4 bars)
            { degree: 3, quality: 'minor', extensions: [7], duration: 2, inversion: 0 }, // ivm7 (2 bars)
            { degree: 0, quality: 'minor', extensions: [7], duration: 2, inversion: 0 }, // im7 (2 bars)
            { degree: 4, quality: 'dominant', extensions: [7, 9], duration: 2, inversion: 0 }, // V7(♭9) (2 bars)
            { degree: 3, quality: 'minor', extensions: [7], duration: 1, inversion: 0 }, // ivm7
            { degree: 0, quality: 'minor', extensions: [7], duration: 1, inversion: 0 } // im7
        ],
        totalBars: 12,
        voiceLeading: 'smooth',
        cyclic: true
    },
    'blues-quick-change': {
        id: 'blues-quick-change',
        name: 'Quick Change Blues',
        description: 'Blues de 8 compases con cambios rápidos.',
        tags: ['blues', 'quick', 'energetic'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // I7 (2 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // IV7
            { degree: 0, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // I7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // IV7
            { degree: 0, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // I7
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 } // V7
        ],
        totalBars: 8,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'blues-slow': {
        id: 'blues-slow',
        name: 'Slow Blues (16-Bar)',
        description: 'Blues lento de 16 compases para atmósferas profundas.',
        tags: ['blues', 'slow', 'deep', 'atmospheric'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 6, inversion: 0 }, // I7 (6 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // IV7 (2 bars)
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // I7 (4 bars)
            { degree: 4, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // V7
            { degree: 3, quality: 'dominant', extensions: [7], duration: 1, inversion: 0 }, // IV7
            { degree: 0, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 } // I7 (2 bars)
        ],
        totalBars: 16,
        voiceLeading: 'parallel',
        cyclic: true
    },
    'blues-shuffle': {
        id: 'blues-shuffle',
        name: 'Shuffle Blues',
        description: 'Blues con ritmo shuffle característico.',
        tags: ['blues', 'shuffle', 'groovy', 'swing'],
        chords: [
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // I7 (4 bars)
            { degree: 0, quality: 'dominant', extensions: [7], duration: 4, inversion: 0 }, // I7 (4 bars)
            { degree: 3, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 }, // IV7 (2 bars)
            { degree: 0, quality: 'dominant', extensions: [7], duration: 2, inversion: 0 } // I7 (2 bars)
        ],
        totalBars: 12,
        voiceLeading: 'parallel',
        cyclic: true
    }
};
//# sourceMappingURL=blues.js.map