/**
 * 🎸 HARMONY ENGINE
 * Motor de armonía para generar progresiones y acordes
 */
import { SeededRandom } from '../utils/SeededRandom.js';
import { CHORD_PROGRESSIONS } from './progressions/index.js';
import { ChordBuilder } from './ChordBuilder.js';
import { VoiceLeading } from './VoiceLeading.js';
/**
 * Motor de armonía principal
 */
export class HarmonyEngine {
    random;
    constructor(seed = 42) {
        this.random = new SeededRandom(seed);
    }
    /**
     * Generar secuencia de acordes
     * @param options Opciones de generación (incluye section completa)
     * @returns Secuencia de acordes MIDI
     */
    generateChordSequence(options) {
        const { section, key, mode, complexity, voiceLeadingStrategy, seed, totalLoad = 0 } = options;
        // ✅ USAR section.tempo, section.bars DIRECTAMENTE
        const tempo = section.profile?.tempoMultiplier
            ? (section.profile.tempoMultiplier * 120) // TODO: Obtener tempo base de StylePreset
            : 120; // Fallback
        const totalBars = section.bars;
        // 🔥 DETERMINISMO: Re-inicializar random con el seed proporcionado
        this.random = new SeededRandom(seed);
        // Seleccionar progresión base según complejidad y modo
        const progression = this.selectProgression(mode, complexity);
        // Adaptar progresión a la tonalidad
        const adaptedProgression = this.adaptProgressionToKey(progression, key);
        // Generar acordes MIDI con ajuste de densidad
        const chordSequence = this.buildChordSequence(adaptedProgression, section, // ✅ PASAR SECTION COMPLETA
        complexity, totalLoad);
        // Aplicar conducción de voces
        return VoiceLeading.optimizeChordSequence(chordSequence, voiceLeadingStrategy);
    }
    /**
     * Seleccionar progresión según modo y complejidad
     */
    selectProgression(mode, complexity) {
        const genre = this.selectGenreForMode(mode, complexity);
        const progressions = CHORD_PROGRESSIONS[genre];
        if (!progressions) {
            // Fallback a pop si no hay progresiones para el género
            const popProgressions = Object.values(CHORD_PROGRESSIONS.pop);
            return this.random.choice(popProgressions);
        }
        const availableProgressions = Object.values(progressions);
        return this.random.choice(availableProgressions);
    }
    /**
     * Seleccionar género según modo y complejidad
     */
    selectGenreForMode(mode, complexity) {
        if (mode === 'minor') {
            return complexity > 0.7 ? 'jazz' : complexity > 0.4 ? 'blues' : 'rock';
        }
        else {
            return complexity > 0.7 ? 'classical' : complexity > 0.4 ? 'modal' : 'pop';
        }
    }
    adaptProgressionToKey(progression, key) {
        return {
            ...progression,
            chords: progression.chords.map((chord) => ({
                ...chord,
                degree: (chord.degree + key) % 12
            }))
        };
    }
    /**
     * Construir secuencia de acordes MIDI con ajuste de densidad
     * ✅ REFACTORIZADO: Recibe section completa, respeta section.duration
     */
    buildChordSequence(progression, section, // ✅ RECIBIR SECTION COMPLETA
    complexity = 0.5, totalLoad = 0) {
        const sequence = [];
        let currentBar = 0;
        // ✅ USAR section.duration, section.bars
        const secondsPerBar = section.duration / section.bars;
        const totalBars = section.bars;
        // OPTIMIZACIÓN: Ajustar complejidad basada en carga total (similar a RhythmEngine)
        let adjustedComplexity = complexity;
        if (totalLoad > 1.5) {
            // Alta carga: reducir complejidad para evitar acordes de 5 notas
            adjustedComplexity = Math.min(complexity, 0.6);
            console.log(`[HARMONY DEBUG] High load detected (${totalLoad.toFixed(2)}), reducing chord complexity to ${adjustedComplexity.toFixed(2)}`);
        }
        else if (totalLoad > 0.8) {
            // Carga media: moderar complejidad
            adjustedComplexity = Math.min(complexity, 0.75);
            console.log(`[HARMONY DEBUG] Medium load detected (${totalLoad.toFixed(2)}), moderating chord complexity to ${adjustedComplexity.toFixed(2)}`);
        }
        // Repetir progresión hasta completar los compases requeridos
        while (currentBar < totalBars) {
            for (const chord of progression.chords) {
                if (currentBar >= totalBars)
                    break;
                // chord.degree es grado de escala (0-11), NO añadir octava aquí
                // El Orchestrator se encarga de ajustar a la octava correcta
                const midiChord = ChordBuilder.buildChord(chord.degree, chord.quality, adjustedComplexity, // Usar complejidad ajustada
                this.random);
                // ✅ APLICAR DURACIÓN DEL ACORDE (en segundos, respetando section)
                const durationSeconds = chord.duration * secondsPerBar;
                const startTime = section.startTime + (currentBar * secondsPerBar);
                sequence.push(midiChord.map(note => ({
                    ...note,
                    startTime,
                    duration: durationSeconds
                })));
                currentBar += chord.duration;
            }
            // Si la progresión es cíclica y no hemos completado, continuar
            if (!progression.cyclic && currentBar < totalBars) {
                break;
            }
        }
        // ✅ VALIDACIÓN: Asegurar que no excedemos section.duration
        const sectionEnd = section.startTime + section.duration;
        let totalDuration = 0;
        for (const chord of sequence) {
            if (chord[0]) {
                const chordEnd = chord[0].startTime + chord[0].duration;
                if (chordEnd > sectionEnd) {
                    // Truncar última nota si excede
                    const excess = chordEnd - sectionEnd;
                    console.warn(`[HARMONY DEBUG] Chord exceeds section end by ${excess.toFixed(2)}s, truncating`);
                    chord.forEach(note => {
                        note.duration = Math.max(0.1, note.duration - excess);
                    });
                }
                totalDuration += chord[0].duration;
            }
        }
        console.log(`[HARMONY DEBUG] Section ${section.index}: Generated ${sequence.length} chords, total duration: ${totalDuration.toFixed(2)}s (section: ${section.duration.toFixed(2)}s)`);
        return sequence;
    }
    /**
     * Generar acompañamiento armónico
     * @param chordSequence Secuencia de acordes
     * @param style Estilo ('block', 'arpeggio', 'broken')
     * @returns Notas de acompañamiento
     */
    generateAccompaniment(chordSequence, style = 'block') {
        const accompaniment = [];
        for (const chord of chordSequence) {
            switch (style) {
                case 'block':
                    accompaniment.push(...this.generateBlockChords(chord));
                    break;
                case 'arpeggio':
                    accompaniment.push(...this.generateArpeggios(chord));
                    break;
                case 'broken':
                    accompaniment.push(...this.generateBrokenChords(chord));
                    break;
            }
        }
        return accompaniment;
    }
    /**
     * Generar acordes bloque (todos juntos)
     */
    generateBlockChords(chord) {
        return chord.map(note => ({
            ...note,
            velocity: 70, // Más suave para acompañamiento
            channel: 1 // Canal diferente para acompañamiento
        }));
    }
    /**
     * Generar arpegios
     */
    generateArpeggios(chord) {
        const arpeggio = [];
        const duration = chord[0]?.duration ?? 480;
        const startTime = chord[0]?.startTime ?? 0;
        const noteDuration = duration / chord.length;
        chord.forEach((note, index) => {
            arpeggio.push({
                ...note,
                startTime: startTime + (index * noteDuration),
                duration: noteDuration,
                velocity: 60,
                channel: 1
            });
        });
        return arpeggio;
    }
    /**
     * Generar acordes rotos
     */
    generateBrokenChords(chord) {
        const broken = [];
        const duration = chord[0]?.duration ?? 480;
        const startTime = chord[0]?.startTime ?? 0;
        const pattern = [0, 2, 1, 2]; // Patrón de acordes rotos
        pattern.forEach((index, patternIndex) => {
            const note = chord[index % chord.length];
            if (note) {
                broken.push({
                    ...note,
                    startTime: startTime + (patternIndex * duration / pattern.length),
                    duration: duration / pattern.length,
                    velocity: 65,
                    channel: 1
                });
            }
        });
        return broken;
    }
    /**
     * Modificar complejidad de una secuencia
     * @param sequence Secuencia original
     * @param targetComplexity Complejidad objetivo (0-1)
     * @returns Secuencia modificada
     */
    modifyComplexity(sequence, targetComplexity) {
        if (targetComplexity < 0.3) {
            // Simplificar: reducir a tríadas básicas
            return sequence.map(chord => chord.slice(0, 3).map(note => ({ ...note, pitch: note.pitch % 12 + 48 })));
        }
        else if (targetComplexity > 0.7) {
            // Complicar: agregar extensiones y alteraciones
            return sequence.map(chord => {
                const root = chord[0]?.pitch ?? 60;
                return ChordBuilder.buildExtendedChord(root % 12, 'dominant', [7, 9, 11]).map(note => ({
                    ...note,
                    startTime: chord[0]?.startTime ?? 0,
                    duration: chord[0]?.duration ?? 480
                }));
            });
        }
        return sequence; // Mantener complejidad media
    }
}
//# sourceMappingURL=HarmonyEngine.js.map