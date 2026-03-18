export type ZodiacSign = 'Aries' | 'Taurus' | 'Gemini' | 'Cancer' | 'Leo' | 'Virgo' | 'Libra' | 'Scorpio' | 'Sagittarius' | 'Capricorn' | 'Aquarius' | 'Pisces';
export interface ZodiacPoetryResult {
    zodiacSign: ZodiacSign;
    note: string;
    musicalNote: string;
    frequency: number;
    element: 'fire' | 'earth' | 'air' | 'water';
    beauty: number;
    fibonacciRatio: number;
    timestamp: number;
}
export declare class MusicalZodiacPoetryEngine {
    private cache;
    /**
     * Generate poetry for zodiac
     */
    generate(sign: ZodiacSign): ZodiacPoetryResult;
    /**
     * Get cached poetry
     */
    getFromCache(key: string): ZodiacPoetryResult | undefined;
    /**
     * Clear cache
     */
    clearCache(): void;
}
//# sourceMappingURL=MusicalZodiacPoetryEngine.d.ts.map