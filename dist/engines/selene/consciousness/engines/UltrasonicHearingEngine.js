/**
 * 🎧 ULTRASONIC HEARING ENGINE
 * "Escucha lo que otros no pueden - la música de las matemáticas"
 *
 * CAPACIDAD:
 * - Calcula intervalos musicales entre notas consecutivas
 * - Detecta consonancia (3ra/5ta perfects) vs disonancia (2da/7ma)
 * - Mide afinidad zodiacal (fire+air vs water+earth)
 */
export class UltrasonicHearingEngine {
    noteToSemitone = {
        'DO': 0,
        'DO#': 1,
        'RE': 2,
        'RE#': 3,
        'MI': 4,
        'FA': 5,
        'FA#': 6,
        'SOL': 7,
        'SOL#': 8,
        'LA': 9,
        'LA#': 10,
        'SI': 11,
    };
    intervalNames = {
        0: 'unison',
        1: 'minor second',
        2: 'major second',
        3: 'minor third',
        4: 'major third',
        5: 'perfect fourth',
        6: 'tritone',
        7: 'perfect fifth',
        8: 'minor sixth',
        9: 'major sixth',
        10: 'minor seventh',
        11: 'major seventh',
        12: 'octave',
    };
    consonanceScores = {
        0: 1.0, // unison - perfect
        1: 0.1, // minor second - very dissonant
        2: 0.2, // major second - dissonant
        3: 0.8, // minor third - consonant
        4: 0.9, // major third - very consonant
        5: 0.7, // perfect fourth - consonant
        6: 0.0, // tritone - maximally dissonant
        7: 1.0, // perfect fifth - perfect
        8: 0.6, // minor sixth - somewhat consonant
        9: 0.8, // major sixth - consonant
        10: 0.3, // minor seventh - dissonant
        11: 0.4, // major seventh - dissonant
        12: 1.0, // octave - perfect
    };
    elementCompatibility = {
        'fire': { 'fire': 1.0, 'air': 0.8, 'earth': 0.3, 'water': 0.2 },
        'air': { 'air': 1.0, 'fire': 0.8, 'water': 0.3, 'earth': 0.2 },
        'earth': { 'earth': 1.0, 'water': 0.8, 'fire': 0.3, 'air': 0.2 },
        'water': { 'water': 1.0, 'earth': 0.8, 'air': 0.3, 'fire': 0.2 },
    };
    /**
     * 🎼 ANALIZAR INTERVALO entre dos notas consecutivas
     */
    analyzeInterval(fromNote, toNote, fromElement, toElement) {
        const fromSemitone = this.noteToSemitone[fromNote];
        const toSemitone = this.noteToSemitone[toNote];
        if (fromSemitone === undefined || toSemitone === undefined) {
            throw new Error(`Invalid notes: ${fromNote} or ${toNote}`);
        }
        // Calcular intervalo (siempre ascendente)
        let semitones = toSemitone - fromSemitone;
        if (semitones < 0)
            semitones += 12;
        const intervalName = this.intervalNames[semitones] || `unknown (${semitones} semitones)`;
        const consonance = this.consonanceScores[semitones] || 0.5;
        const zodiacHarmony = this.elementCompatibility[fromElement][toElement];
        return {
            fromNote,
            toNote,
            semitones,
            intervalName,
            consonance,
            zodiacHarmony,
        };
    }
    /**
     * 📊 ANALIZAR SECUENCIA completa de notas
     */
    analyzeSequence(notes) {
        if (notes.length < 2) {
            return {
                intervals: [],
                averageConsonance: 0.5,
                averageZodiacHarmony: 0.5,
                harmonicFlow: 'smooth',
                dominantInterval: 'none',
            };
        }
        const intervals = [];
        let totalConsonance = 0;
        let totalHarmony = 0;
        const intervalCounts = {};
        // Analizar cada transición
        for (let i = 0; i < notes.length - 1; i++) {
            const interval = this.analyzeInterval(notes[i].note, notes[i + 1].note, notes[i].element, notes[i + 1].element);
            intervals.push(interval);
            totalConsonance += interval.consonance;
            totalHarmony += interval.zodiacHarmony;
            // Contar intervalos
            intervalCounts[interval.intervalName] = (intervalCounts[interval.intervalName] || 0) + 1;
        }
        const averageConsonance = totalConsonance / intervals.length;
        const averageZodiacHarmony = totalHarmony / intervals.length;
        // Determinar intervalo dominante
        let dominantInterval = 'none';
        let maxCount = 0;
        Object.entries(intervalCounts).forEach(([interval, count]) => {
            if (count > maxCount) {
                maxCount = count;
                dominantInterval = interval;
            }
        });
        // Evaluar flow armónico
        const harmonicFlow = this.evaluateHarmonicFlow(intervals, averageConsonance);
        return {
            intervals,
            averageConsonance,
            averageZodiacHarmony,
            harmonicFlow,
            dominantInterval,
        };
    }
    /**
     * 🎵 SUGERIR PRÓXIMA NOTA basada en armonía
     */
    suggestNextNote(currentNote, currentElement, desiredConsonance = 0.8, desiredHarmony = 0.7) {
        const suggestions = [];
        // Evaluar todas las posibles transiciones
        Object.keys(this.noteToSemitone).forEach(note => {
            ['fire', 'earth', 'air', 'water'].forEach((element) => {
                const interval = this.analyzeInterval(currentNote, note, currentElement, element);
                // Calcular score basado en cercanía a objetivos deseados
                const consonanceScore = 1 - Math.abs(interval.consonance - desiredConsonance);
                const harmonyScore = 1 - Math.abs(interval.zodiacHarmony - desiredHarmony);
                const overallScore = (consonanceScore + harmonyScore) / 2;
                suggestions.push({
                    note,
                    element,
                    score: overallScore,
                    reasoning: `${interval.intervalName} (${interval.semitones}s) - Cons: ${(interval.consonance * 100).toFixed(0)}%, Harm: ${(interval.zodiacHarmony * 100).toFixed(0)}%`,
                });
            });
        });
        // Ordenar por score descendente
        return suggestions.sort((a, b) => b.score - a.score);
    }
    /**
     * 🎼 EVALUAR FLOW ARMÓNICO
     */
    evaluateHarmonicFlow(intervals, avgConsonance) {
        if (intervals.length === 0)
            return 'smooth';
        // Contar intervalos disonantes (< 0.5)
        const dissonantIntervals = intervals.filter(i => i.consonance < 0.5).length;
        const dissonanceRatio = dissonantIntervals / intervals.length;
        // Calcular varianza de consonancia
        const consonanceVariance = intervals.reduce((acc, i) => {
            return acc + Math.pow(i.consonance - avgConsonance, 2);
        }, 0) / intervals.length;
        // Flow turbulento si >30% disonancia o alta varianza
        if (dissonanceRatio > 0.3 || consonanceVariance > 0.1) {
            return 'turbulent';
        }
        return 'smooth';
    }
    /**
     * 📊 OBTENER ESTADÍSTICAS de análisis
     */
    getStats() {
        return {
            supportedNotes: Object.keys(this.noteToSemitone).length,
            supportedIntervals: Object.keys(this.intervalNames).length,
            consonanceRange: '0.0-1.0 (perfect dissonance to perfect consonance)',
            harmonyRange: '0.0-1.0 (elemental incompatibility to perfect harmony)',
        };
    }
}
//# sourceMappingURL=UltrasonicHearingEngine.js.map