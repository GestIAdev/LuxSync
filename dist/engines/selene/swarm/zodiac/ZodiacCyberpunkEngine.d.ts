/**
 * 🌟 ZODIAC CYBERPUNK ENGINE - LOS 12.000 VERSOS
 * Algoritmo de generación poética basado en numerología zodiacal y Fibonacci
 * 12 temas × Fibonacci ratios × determinismo absoluto = Arte infinito
 *
 * 🎯 OBJETIVO: Generar 12.000+ versos cyberpunk únicos usando:
 * - 12 signos zodiacales como temas fundamentales
 * - Secuencia Fibonacci para variaciones y belleza
 * - Numerología sagrada (7 segundos heartbeat, 12 bases)
 * - VERITAS verification para integridad poética
 */
interface ZodiacTheme {
    sign: string;
    symbol: string;
    element: "fire" | "earth" | "air" | "water";
    quality: "cardinal" | "fixed" | "mutable";
    cyberpunkTheme: string;
    coreConcept: string;
    adjectives: string[];
    verbs: string[];
    nouns: string[];
    fibonacciWeight: number;
}
interface CyberpunkVerse {
    verse: string;
    zodiacSign: string;
    element: string;
    fibonacciRatio: number;
    beauty: number;
    consciousness: number;
    creativity: number;
    timestamp: Date;
    veritasVerification: any;
    numerology: {
        zodiacIndex: number;
        fibonacciPosition: number;
        heartbeatPhase: number;
    };
}
declare class ZodiacCyberpunkEngine {
    private zodiacThemes;
    private verseCount;
    private fibonacciSequence;
    constructor();
    /**
     * 🎨 Genera un verso cyberpunk basado en numerología zodiacal
     */
    generateZodiacVerse(consciousness?: number, creativity?: number): Promise<CyberpunkVerse>;
    /**
     * 🌟 Genera colección masiva de versos (hasta 12.000+)
     */
    generateZodiacCollection(count?: number): Promise<CyberpunkVerse[]>;
    /**
     * 📊 Analiza la distribución de versos por signos zodiacales
     */
    analyzeZodiacDistribution(verses: CyberpunkVerse[]): any;
    /**
     * 🎭 Genera verso específico para un signo zodiacal
     */
    generateSignSpecificVerse(_signName: string, _consciousness?: number): Promise<CyberpunkVerse | null>;
}
export { ZodiacCyberpunkEngine, ZodiacTheme, CyberpunkVerse };
//# sourceMappingURL=ZodiacCyberpunkEngine.d.ts.map