/**
 * 🎸 SCALE IDENTIFIER
 * ============================================================
 * Identificador de escalas musicales para Wave 8
 *
 * Fuente: src/engines/selene/music/utils/ScaleUtils.ts (Aura Forge)
 *
 * Concepto:
 * - Analiza chromagrama (12 pitch classes) del FFT
 * - Compara con patrones de escalas conocidas
 * - Retorna la escala más probable con confidence
 *
 * @author LuxSync Team
 * @version 1.0.0 - Wave 8 FASE 2
 */
// ============================================================
// 📐 CONSTANTES - INTERVALOS DE ESCALAS
// ============================================================
/**
 * Intervalos de escalas (semitonos desde la tónica)
 * Basado en ScaleUtils.ts de Aura Forge
 *
 * Cada array representa las notas de la escala como offsets
 * desde la nota raíz (0 = tónica)
 */
export const SCALE_INTERVALS = {
    // === MODOS DIATÓNICOS (7 notas) ===
    major: [0, 2, 4, 5, 7, 9, 11], // Ionian - Feliz, brillante
    minor: [0, 2, 3, 5, 7, 8, 10], // Aeolian - Triste, melancólico
    dorian: [0, 2, 3, 5, 7, 9, 10], // Jazzy, sofisticado
    phrygian: [0, 1, 3, 5, 7, 8, 10], // Spanish, exótico, tenso
    lydian: [0, 2, 4, 6, 7, 9, 11], // Dreamy, etéreo, #4
    mixolydian: [0, 2, 4, 5, 7, 9, 10], // Bluesy, rock, b7
    locrian: [0, 1, 3, 5, 6, 8, 10], // Muy tenso, b2 b5
    // === ESCALAS MELÓDICAS (7 notas) ===
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11], // Dramático, #7
    melodic_minor: [0, 2, 3, 5, 7, 9, 11], // Jazz avanzado
    // === PENTATÓNICAS (5 notas) ===
    pentatonic_major: [0, 2, 4, 7, 9], // Simple, folk, universal
    pentatonic_minor: [0, 3, 5, 7, 10], // Blues, rock
    // === ESPECIALES ===
    blues: [0, 3, 5, 6, 7, 10], // Blues con blue note (b5)
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // Todas
};
/**
 * Nombres de notas para conversión pitch → string
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DEFAULT_CONFIG = {
    noteThreshold: 0.15,
    scalesToCheck: undefined, // Todas
};
/**
 * Identificador de escalas musicales
 *
 * Algoritmo:
 * 1. Convertir FFT a chromagrama (12 pitch classes)
 * 2. Detectar notas presentes (energía > threshold)
 * 3. Para cada raíz posible (0-11) y cada escala:
 *    - Contar cuántas notas detectadas están en la escala
 *    - Penalizar notas fuera de escala
 * 4. Retornar la mejor coincidencia
 */
export class ScaleIdentifier {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ============================================================
    // 📊 MÉTODOS PÚBLICOS
    // ============================================================
    /**
     * Identificar escala a partir de un chromagrama
     *
     * @param chroma Array de 12 valores (0-1) representando energía de cada pitch class
     * @returns ScaleMatch con la escala más probable
     */
    identifyScale(chroma) {
        if (chroma.length !== 12) {
            throw new Error(`ScaleIdentifier: chromagrama debe tener 12 elementos, recibió ${chroma.length}`);
        }
        // Detectar notas presentes
        const presentNotes = this.detectPresentNotes(chroma);
        // Si no hay notas, retornar chromatic con baja confianza
        if (presentNotes.length === 0) {
            return {
                scale: 'chromatic',
                root: 0,
                rootName: 'C',
                confidence: 0,
                matchedNotes: 0,
                totalNotes: 12,
            };
        }
        // Probar todas las combinaciones de raíz + escala
        let bestMatch = null;
        const scalesToCheck = this.config.scalesToCheck || Object.keys(SCALE_INTERVALS);
        for (let root = 0; root < 12; root++) {
            for (const scale of scalesToCheck) {
                const match = this.calculateMatch(root, scale, presentNotes, chroma);
                if (!bestMatch || match.confidence > bestMatch.confidence) {
                    bestMatch = match;
                }
            }
        }
        return bestMatch;
    }
    /**
     * Obtener notas de una escala dada una raíz
     *
     * @param root Raíz (0-11)
     * @param scale Escala a usar
     * @returns Array de pitch classes (0-11)
     */
    getScaleNotes(root, scale) {
        const intervals = SCALE_INTERVALS[scale];
        return intervals.map(interval => (root + interval) % 12);
    }
    /**
     * Verificar si una nota pertenece a una escala
     *
     * @param pitch Pitch (cualquier octava, se normaliza a 0-11)
     * @param root Raíz de la escala (0-11)
     * @param scale Escala a verificar
     * @returns true si la nota está en la escala
     */
    isInScale(pitch, root, scale) {
        const pitchClass = ((pitch % 12) + 12) % 12; // Normalizar a 0-11
        const scaleNotes = this.getScaleNotes(root, scale);
        return scaleNotes.includes(pitchClass);
    }
    /**
     * Convertir pitch class a nombre de nota
     */
    pitchToName(pitch) {
        return NOTE_NAMES[((pitch % 12) + 12) % 12];
    }
    /**
     * Convertir nombre de nota a pitch class
     */
    nameToPitch(name) {
        const index = NOTE_NAMES.indexOf(name.toUpperCase());
        return index >= 0 ? index : 0;
    }
    // ============================================================
    // 🔧 MÉTODOS PRIVADOS
    // ============================================================
    /**
     * Detectar qué notas están presentes en el chromagrama
     */
    detectPresentNotes(chroma) {
        const present = [];
        const threshold = this.config.noteThreshold;
        for (let i = 0; i < 12; i++) {
            if (chroma[i] > threshold) {
                present.push(i);
            }
        }
        return present;
    }
    /**
     * Calcular match score para una combinación raíz + escala
     *
     * ALGORITMO MEJORADO:
     * 1. La raíz debe tener alta energía (50% del score)
     * 2. Las notas características de la escala deben estar presentes
     * 3. Las notas fuera de la escala penalizan
     *
     * Notas características:
     * - Major vs Minor: La 3ra (Major = 4 semitonos, Minor = 3 semitonos)
     * - Phrygian: La 2da bemol (1 semitono)
     * - Dorian: La 6ta mayor (9 semitonos)
     * - Lydian: La 4ta aumentada (6 semitonos)
     * - Mixolydian: La 7ma menor (10 semitonos)
     */
    calculateMatch(root, scale, presentNotes, chroma) {
        const scaleNotes = this.getScaleNotes(root, scale);
        const scaleNoteSet = new Set(scaleNotes);
        let inScaleEnergy = 0; // Energía de notas dentro de la escala
        let outScaleEnergy = 0; // Energía de notas fuera de la escala
        let matchedNotes = 0;
        // Contar notas presentes que están en la escala
        for (const note of presentNotes) {
            if (scaleNoteSet.has(note)) {
                matchedNotes++;
                inScaleEnergy += chroma[note];
            }
            else {
                outScaleEnergy += chroma[note];
            }
        }
        // Calcular confidence
        // Fórmula: (energía en escala / energía total) * (notas matched / notas presentes)
        const totalEnergy = inScaleEnergy + outScaleEnergy;
        const energyRatio = totalEnergy > 0 ? inScaleEnergy / totalEnergy : 0;
        const noteRatio = presentNotes.length > 0 ? matchedNotes / presentNotes.length : 0;
        // === NUEVO: Root Dominance Score ===
        // La nota raíz debe ser la más fuerte o una de las más fuertes
        // Esto distingue A minor (root=9) de C major (root=0) aunque tengan mismas notas
        const maxChromaEnergy = Math.max(...chroma);
        const rootEnergy = chroma[root];
        const rootDominance = maxChromaEnergy > 0 ? rootEnergy / maxChromaEnergy : 0;
        // === NUEVO: Characteristic Note Bonus ===
        // Verificar si las notas que DIFERENCIAN esta escala están presentes
        const characteristicBonus = this.calculateCharacteristicBonus(root, scale, chroma);
        // Penalización para escalas muy amplias (chromatic, etc.)
        const sizePenalty = scaleNotes.length > 8 ? 0.2 : 0;
        // === NUEVA FÓRMULA ===
        // 35% nota match, 25% energía match, 25% root dominance, 15% características
        const confidence = Math.min(1, Math.max(0, (noteRatio * 0.35) +
            (energyRatio * 0.25) +
            (rootDominance * 0.25) +
            (characteristicBonus * 0.15) -
            sizePenalty));
        return {
            scale,
            root,
            rootName: this.pitchToName(root),
            confidence,
            matchedNotes,
            totalNotes: scaleNotes.length,
        };
    }
    /**
     * Calcular bonus por notas características de la escala
     * Estas notas diferencian escalas que comparten muchas notas
     */
    calculateCharacteristicBonus(root, scale, chroma) {
        // Notas características que DIFERENCIAN cada escala
        const characteristicIntervals = {
            major: [4, 11], // 3ra mayor (4), 7ma mayor (11)
            minor: [3, 10], // 3ra menor (3), 7ma menor (10)
            dorian: [3, 9], // 3ra menor (3), 6ta mayor (9)
            phrygian: [1, 3], // 2da menor (1), 3ra menor (3)
            lydian: [4, 6], // 3ra mayor (4), 4ta aumentada (6)
            mixolydian: [4, 10], // 3ra mayor (4), 7ma menor (10)
            locrian: [1, 6], // 2da menor (1), 5ta disminuida (6)
            harmonic_minor: [3, 11], // 3ra menor (3), 7ma mayor (11)
            melodic_minor: [3, 9, 11], // 3ra menor, 6ta mayor, 7ma mayor
            pentatonic_major: [4, 9], // 3ra mayor (4), 6ta mayor (9)
            pentatonic_minor: [3, 10], // 3ra menor (3), 7ma menor (10)
            blues: [3, 6], // 3ra menor (3), blue note (6)
            chromatic: [], // Ninguna característica
        };
        const intervals = characteristicIntervals[scale];
        if (intervals.length === 0)
            return 0;
        // Verificar energía de notas características
        let characteristicEnergy = 0;
        const threshold = this.config.noteThreshold;
        for (const interval of intervals) {
            const pitchClass = (root + interval) % 12;
            if (chroma[pitchClass] > threshold) {
                characteristicEnergy += chroma[pitchClass];
            }
        }
        // Normalizar por cantidad de características
        return characteristicEnergy / intervals.length;
    }
}
// ============================================================
// 📤 FACTORY FUNCTION
// ============================================================
/**
 * Crear instancia de ScaleIdentifier con config por defecto
 */
export function createScaleIdentifier(config) {
    return new ScaleIdentifier(config);
}
// Export default instance for quick usage
export const defaultScaleIdentifier = new ScaleIdentifier();
