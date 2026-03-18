/**
 * 🎸 MUSIC THEORY UTILS
 * Utilidades de teoría musical
 */
/**
 * Construir acorde desde fundamental
 */
export function buildChord(root, quality) {
    const intervals = {
        'major': [0, 4, 7],
        'minor': [0, 3, 7],
        'diminished': [0, 3, 6],
        'augmented': [0, 4, 8],
        'dominant': [0, 4, 7, 10],
        'half-diminished': [0, 3, 6, 10],
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
        'power': [0, 7]
    };
    return intervals[quality].map(interval => root + interval);
}
/**
 * Transponer nota
 */
export function transpose(pitch, semitones) {
    return Math.max(0, Math.min(127, pitch + semitones));
}
/**
 * Calcular intervalo entre dos notas
 */
export function interval(pitch1, pitch2) {
    return Math.abs(pitch2 - pitch1);
}
//# sourceMappingURL=MusicTheoryUtils.js.map