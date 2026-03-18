/**
 * 🎸 SCALE UTILS
 * Escalas y modos musicales
 */
/**
 * INTERVALOS DE ESCALAS (semitonos desde tónica)
 */
const SCALE_INTERVALS = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'locrian': [0, 1, 3, 5, 6, 8, 10],
    'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
    'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
    'pentatonic': [0, 2, 4, 7, 9],
    'blues': [0, 3, 5, 6, 7, 10],
    'whole-tone': [0, 2, 4, 6, 8, 10],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};
/**
 * Obtener notas de escala
 */
export function getScaleNotes(root, scale) {
    return SCALE_INTERVALS[scale].map(interval => root + interval);
}
/**
 * Obtener grado de escala
 */
export function getScaleDegree(root, scale, degree) {
    const intervals = SCALE_INTERVALS[scale];
    const index = (degree - 1) % intervals.length;
    const octaveShift = Math.floor((degree - 1) / intervals.length) * 12;
    return root + intervals[index] + octaveShift;
}
/**
 * Verificar si nota pertenece a escala
 */
export function isInScale(pitch, root, scale) {
    const notes = getScaleNotes(root, scale);
    const pitchClass = pitch % 12;
    return notes.some(note => (note % 12) === pitchClass);
}
//# sourceMappingURL=ScaleUtils.js.map