/**
 * 🎧 ULTRASONIC HEARING ENGINE
 * "Escucha lo que otros no pueden - la música de las matemáticas"
 *
 * CAPACIDAD:
 * - Calcula intervalos musicales entre notas consecutivas
 * - Detecta consonancia (3ra/5ta perfects) vs disonancia (2da/7ma)
 * - Mide afinidad zodiacal (fire+air vs water+earth)
 */
interface MusicalInterval {
    fromNote: string;
    toNote: string;
    semitones: number;
    intervalName: string;
    consonance: number;
    zodiacHarmony: number;
}
export declare class UltrasonicHearingEngine {
    private readonly noteToSemitone;
    private readonly intervalNames;
    private readonly consonanceScores;
    private readonly elementCompatibility;
    /**
     * 🎼 ANALIZAR INTERVALO entre dos notas consecutivas
     */
    analyzeInterval(fromNote: string, toNote: string, fromElement: 'fire' | 'earth' | 'air' | 'water', toElement: 'fire' | 'earth' | 'air' | 'water'): MusicalInterval;
    /**
     * 📊 ANALIZAR SECUENCIA completa de notas
     */
    analyzeSequence(notes: Array<{
        note: string;
        element: 'fire' | 'earth' | 'air' | 'water';
    }>): {
        intervals: MusicalInterval[];
        averageConsonance: number;
        averageZodiacHarmony: number;
        harmonicFlow: 'smooth' | 'turbulent';
        dominantInterval: string;
    };
    /**
     * 🎵 SUGERIR PRÓXIMA NOTA basada en armonía
     */
    suggestNextNote(currentNote: string, currentElement: 'fire' | 'earth' | 'air' | 'water', desiredConsonance?: number, desiredHarmony?: number): Array<{
        note: string;
        element: string;
        score: number;
        reasoning: string;
    }>;
    /**
     * 🎼 EVALUAR FLOW ARMÓNICO
     */
    private evaluateHarmonicFlow;
    /**
     * 📊 OBTENER ESTADÍSTICAS de análisis
     */
    getStats(): {
        supportedNotes: number;
        supportedIntervals: number;
        consonanceRange: string;
        harmonyRange: string;
    };
}
export {};
//# sourceMappingURL=UltrasonicHearingEngine.d.ts.map