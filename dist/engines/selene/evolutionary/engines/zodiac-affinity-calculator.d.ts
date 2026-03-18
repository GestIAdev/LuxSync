/**
 * 🏹 CALCULADORA DE AFINIDAD ZODIACAL
 * Calcula afinidades astrológicas deterministas para evolución creativa
 */
export declare class ZodiacAffinityCalculator {
    private static readonly ZODIAC_SIGNS;
    private static readonly SIGN_TRAITS;
    private static readonly ELEMENTAL_COMPATIBILITY;
    private static readonly QUALITY_COMPATIBILITY;
    /**
     * Calcula afinidad zodiacal entre dos posiciones
     * @param position1 - Primera posición zodiacal (0-11)
     * @param position2 - Segunda posición zodiacal (0-11)
     * @returns Afinidad entre 0 y 1
     */
    static calculateZodiacAffinity(position1: number, position2: number): number;
    /**
     * Genera descripción poética del signo zodiacal
     * @param position - Posición zodiacal (0-11)
     * @returns Descripción poética del signo
     */
    static generateZodiacDescription(position: number): string;
    /**
     * Valida compatibilidad zodiacal para evolución
     * @param positions - Array de posiciones zodiacales
     * @returns true si la combinación es compatible para evolución
     */
    static validateZodiacCompatibility(positions: number[]): boolean;
    /**
     * Obtiene información completa de un signo zodiacal
     * @param position - Posición zodiacal (0-11)
     * @returns Información completa del signo
     */
    static getZodiacInfo(position: number): {
        sign: string;
        traits: {
            element: string;
            quality: string;
            creativity: number;
            stability: number;
            adaptability: number;
        };
        description: string;
    };
    /**
     * Calcula posición zodiacal basada en timestamp determinista
     * @param timestamp - Timestamp base
     * @returns Posición zodiacal (0-11)
     */
    static calculateZodiacPosition(timestamp: number): number;
}
//# sourceMappingURL=zodiac-affinity-calculator.d.ts.map