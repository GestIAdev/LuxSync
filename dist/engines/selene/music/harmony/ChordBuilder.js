/**
 * 🎸 CHORD BUILDER
 * Constructor de acordes con todas las cualidades musicales
 */
import { buildChord } from '../utils/MusicTheoryUtils.js';
/**
 * Builder para construir acordes con diferentes cualidades
 */
export class ChordBuilder {
    /**
     * Construir acorde básico
     * @param root Nota fundamental relativa (0-11, donde C=0)
     * @param quality Calidad del acorde
     * @param complexity Complejidad (0-1) para extensiones
     * @param random Instancia de SeededRandom para determinismo
     * @returns Array de notas MIDI con pitch relativo
     */
    static buildChord(root, quality, complexity = 0.5, random) {
        // Base triads
        const pitches = buildChord(root, quality);
        // Add extensions based on complexity
        if (complexity > 0.3) {
            // Add 7th
            const seventh = quality === 'major' ? 11 : 10; // Major 7th or minor 7th
            pitches.push(root + seventh);
        }
        if (complexity > 0.6) {
            // Add 9th
            pitches.push(root + 14); // 2nd octave + 2 semitones
        }
        if (complexity > 0.8) {
            // Add 11th or 13th - Using deterministic choice
            const rand = random ? random.next() : Math.random();
            const extension = rand < 0.5 ? 17 : 21; // 11th or 13th
            pitches.push(root + extension);
        }
        return pitches.map(pitch => ({
            pitch,
            velocity: 80,
            startTime: 0,
            duration: 1
        }));
    }
    /**
     * Construir acorde con inversiones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde
     * @param inversion Número de inversión (0 = fundamental, 1 = primera inversión, etc.)
     * @returns Array de notas MIDI ordenadas por inversión
     */
    static buildChordWithInversion(root, quality, inversion = 0) {
        const pitches = buildChord(root, quality);
        // Aplicar inversión moviendo las notas al bajo
        for (let i = 0; i < inversion; i++) {
            const firstNote = pitches.shift();
            pitches.push(firstNote + 12); // Octava arriba
        }
        return pitches.map(pitch => ({ pitch, velocity: 80, startTime: 0, duration: 480 }));
    }
    /**
     * Construir acorde con extensiones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param extensions Extensiones a agregar (7, 9, 11, 13, etc.)
     * @returns Array de notas MIDI con extensiones
     */
    static buildExtendedChord(root, quality, extensions = []) {
        let pitches = buildChord(root, quality);
        // Agregar extensiones
        for (const ext of extensions) {
            const extensionPitch = root + ext;
            if (!pitches.includes(extensionPitch)) {
                pitches.push(extensionPitch);
            }
        }
        return pitches.map(pitch => ({ pitch, velocity: 80, startTime: 0, duration: 480 }));
    }
    /**
     * Construir acorde con alteraciones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param alterations Alteraciones a aplicar (ej: {9: -1} para ♭9)
     * @returns Array de notas MIDI con alteraciones
     */
    static buildAlteredChord(root, quality, alterations = {}) {
        let pitches = buildChord(root, quality);
        // Aplicar alteraciones
        for (const [interval, alteration] of Object.entries(alterations)) {
            const intervalNum = parseInt(interval);
            const basePitch = root + intervalNum;
            const alteredPitch = basePitch + alteration;
            // Reemplazar o agregar la nota alterada
            const existingIndex = pitches.findIndex(p => p % 12 === basePitch % 12);
            if (existingIndex !== -1) {
                pitches[existingIndex] = alteredPitch;
            }
            else {
                pitches.push(alteredPitch);
            }
        }
        return pitches.map(pitch => ({ pitch, velocity: 80, startTime: 0, duration: 480 }));
    }
    /**
     * Construir acorde completo con todas las opciones
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde base
     * @param options Opciones avanzadas
     * @returns Array de notas MIDI
     */
    static buildComplexChord(root, quality, options = {}) {
        const { extensions = [], alterations = {}, inversion = 0, octave = 4 } = options;
        // Construir acorde base
        let pitches = buildChord(root, quality);
        // Agregar extensiones
        for (const ext of extensions) {
            const extensionPitch = root + ext;
            if (!pitches.includes(extensionPitch)) {
                pitches.push(extensionPitch);
            }
        }
        // Aplicar alteraciones
        for (const [interval, alteration] of Object.entries(alterations)) {
            const intervalNum = parseInt(interval);
            const basePitch = root + intervalNum;
            const alteredPitch = basePitch + alteration;
            const existingIndex = pitches.findIndex(p => p % 12 === basePitch % 12);
            if (existingIndex !== -1) {
                pitches[existingIndex] = alteredPitch;
            }
            else {
                pitches.push(alteredPitch);
            }
        }
        // Aplicar inversión
        for (let i = 0; i < inversion; i++) {
            const firstNote = pitches.shift();
            pitches.push(firstNote + 12);
        }
        // Aplicar octava base
        pitches = pitches.map(pitch => pitch + (octave * 12));
        return pitches.map(pitch => ({ pitch, velocity: 80, startTime: 0, duration: 480 }));
    }
    /**
     * Obtener nombre del acorde
     * @param root Nota fundamental (0-11)
     * @param quality Calidad del acorde
     * @param extensions Extensiones
     * @param alterations Alteraciones
     * @returns Nombre del acorde
     */
    static getChordName(root, quality, extensions = [], alterations = {}) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        let name = noteNames[root];
        // Calidad base
        const qualitySymbols = {
            'major': '',
            'minor': 'm',
            'diminished': '°',
            'augmented': '+',
            'dominant': '7',
            'half-diminished': 'ø7',
            'sus2': 'sus2',
            'sus4': 'sus4',
            'power': '5'
        };
        name += qualitySymbols[quality];
        // Extensiones
        if (extensions.length > 0) {
            name += extensions.join('');
        }
        // Alteraciones
        for (const [interval, alteration] of Object.entries(alterations)) {
            if (alteration === -1) {
                name += `♭${interval}`;
            }
            else if (alteration === 1) {
                name += `♯${interval}`;
            }
        }
        return name;
    }
}
//# sourceMappingURL=ChordBuilder.js.map