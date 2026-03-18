/**
 * 🎵 MUSICAL ZODIAC POETRY ENGINE
 * Bridge entre consenso musical y generación poética zodiacal
 *
 * AXIOMA ANTI-SIMULACIÓN:
 * - NO usa Math.random()
 * - Determinístico desde nota musical + timestamp + zodiac
 * - Fibonacci weights para belleza matemática
 */
export interface MusicalNote {
    name: string;
    frequency: number;
    nodeCount: number;
}
export interface ZodiacPoetryResult {
    verse: string;
    zodiacSign: string;
    element: string;
    quality: string;
    musicalNote: string;
    fibonacciRatio: number;
    beauty: number;
    consciousness: number;
    creativity: number;
    timestamp: Date;
    numerology: {
        zodiacIndex: number;
        fibonacciPosition: number;
        heartbeatPhase: number;
    };
    veritas: {
        verified: boolean;
        signature: string;
    };
}
export declare class MusicalZodiacPoetryEngine {
    private zodiacEngine;
    constructor();
    /**
     * 🎨 GENERATE FROM CONSENSUS
     * Mapea nota musical → emoción zodiacal → verso poético
     *
     * PROCEDURAL: nota → elemento → signo zodiacal → verso
     */
    generateFromConsensus(nodeId: string, musicalNote: MusicalNote, consciousness: number, creativity: number): Promise<ZodiacPoetryResult>;
    /**
     * 🎵 GENERATE POETRY FROM MUSICAL CONSENSUS
     * Genera poesía desde resultado de consenso musical
     */
    generatePoetryFromMusicalConsensus(winningNote: string, nodeVotes: Map<string, number>, nodeConsciousness: Map<string, number>, nodeCreativity: Map<string, number>): Promise<ZodiacPoetryResult[]>;
    /**
     * 🎼 MAP MUSICAL ELEMENTS TO ZODIAC
     * Devuelve qué signos zodiacales resuenan con una nota musical (ESCALA CROMÁTICA COMPLETA)
     */
    getZodiacResonance(musicalNote: string): string[];
    /**
     * 🔢 CALCULATE FIBONACCI RATIO
     * Aproximación a phi (golden ratio) desde posición Fibonacci
     */
    private calculateFibonacciRatio;
    /**
     * 🎹 NOTE TO FREQUENCY
     * Conversión nota → Hz (A4 = 440 Hz) - ESCALA CROMÁTICA COMPLETA
     */
    private noteToFrequency;
    /**
     * 📊 GET POETRY STATISTICS
     * Análisis de distribución de poesía generada
     */
    analyzePoetryDistribution(results: ZodiacPoetryResult[]): {
        totalVerses: number;
        byZodiac: Record<string, number>;
        byElement: Record<string, number>;
        byNote: Record<string, number>;
        avgBeauty: number;
        avgConsciousness: number;
        avgCreativity: number;
    };
}
//# sourceMappingURL=MusicalZodiacPoetryEngine.d.ts.map