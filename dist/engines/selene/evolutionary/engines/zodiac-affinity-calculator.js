// zodiac-affinity-calculator.ts
// 🔥 ZODIAC AFFINITY CALCULATOR - LA ALQUIMIA ASTROLÓGICA
// 🎯 "Los signos zodiacales son las coordenadas emocionales del universo evolutivo"
// ⚡ Arquitecto: PunkGrok + Radwulf
/**
 * 🏹 CALCULADORA DE AFINIDAD ZODIACAL
 * Calcula afinidades astrológicas deterministas para evolución creativa
 */
export class ZodiacAffinityCalculator {
    // Constantes zodiacales - coordenadas astrológicas fijas
    static ZODIAC_SIGNS = [
        'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
    ];
    // Rasgos característicos de cada signo - personalidad astrológica
    static SIGN_TRAITS = {
        Aries: { element: 'Fire', quality: 'Cardinal', creativity: 0.9, stability: 0.3, adaptability: 0.8 },
        Taurus: { element: 'Earth', quality: 'Fixed', creativity: 0.4, stability: 0.9, adaptability: 0.2 },
        Gemini: { element: 'Air', quality: 'Mutable', creativity: 0.8, stability: 0.4, adaptability: 0.9 },
        Cancer: { element: 'Water', quality: 'Cardinal', creativity: 0.7, stability: 0.6, adaptability: 0.7 },
        Leo: { element: 'Fire', quality: 'Fixed', creativity: 0.8, stability: 0.7, adaptability: 0.5 },
        Virgo: { element: 'Earth', quality: 'Mutable', creativity: 0.6, stability: 0.8, adaptability: 0.6 },
        Libra: { element: 'Air', quality: 'Cardinal', creativity: 0.7, stability: 0.5, adaptability: 0.8 },
        Scorpio: { element: 'Water', quality: 'Fixed', creativity: 0.8, stability: 0.8, adaptability: 0.4 },
        Sagittarius: { element: 'Fire', quality: 'Mutable', creativity: 0.9, stability: 0.3, adaptability: 0.9 },
        Capricorn: { element: 'Earth', quality: 'Cardinal', creativity: 0.5, stability: 0.9, adaptability: 0.4 },
        Aquarius: { element: 'Air', quality: 'Fixed', creativity: 0.9, stability: 0.4, adaptability: 0.7 },
        Pisces: { element: 'Water', quality: 'Mutable', creativity: 0.8, stability: 0.5, adaptability: 0.8 }
    };
    // Compatibilidad elemental (afinidad entre elementos)
    static ELEMENTAL_COMPATIBILITY = {
        Fire: { Fire: 0.7, Earth: 0.4, Air: 0.8, Water: 0.3 },
        Earth: { Fire: 0.4, Earth: 0.8, Air: 0.5, Water: 0.6 },
        Air: { Fire: 0.8, Earth: 0.5, Air: 0.6, Water: 0.7 },
        Water: { Fire: 0.3, Earth: 0.6, Air: 0.7, Water: 0.8 }
    };
    // Compatibilidad por calidad (cardinal, fixed, mutable)
    static QUALITY_COMPATIBILITY = {
        Cardinal: { Cardinal: 0.6, Fixed: 0.7, Mutable: 0.8 },
        Fixed: { Cardinal: 0.7, Fixed: 0.8, Mutable: 0.5 },
        Mutable: { Cardinal: 0.8, Fixed: 0.5, Mutable: 0.9 }
    };
    /**
     * Calcula afinidad zodiacal entre dos posiciones
     * @param position1 - Primera posición zodiacal (0-11)
     * @param position2 - Segunda posición zodiacal (0-11)
     * @returns Afinidad entre 0 y 1
     */
    static calculateZodiacAffinity(position1, position2) {
        // Normalizar posiciones
        const pos1 = Math.max(0, Math.min(11, position1));
        const pos2 = Math.max(0, Math.min(11, position2));
        if (pos1 === pos2)
            return 1.0; // Misma signo = afinidad máxima
        const sign1 = this.ZODIAC_SIGNS[pos1];
        const sign2 = this.ZODIAC_SIGNS[pos2];
        const traits1 = this.SIGN_TRAITS[sign1];
        const traits2 = this.SIGN_TRAITS[sign2];
        // Calcular compatibilidad elemental
        const elementalAffinity = this.ELEMENTAL_COMPATIBILITY[traits1.element][traits2.element];
        // Calcular compatibilidad por calidad
        const qualityAffinity = this.QUALITY_COMPATIBILITY[traits1.quality][traits2.quality];
        // Calcular distancia angular (compatibilidad por proximidad en zodiaco)
        const angularDistance = Math.min(Math.abs(pos1 - pos2), 12 - Math.abs(pos1 - pos2));
        const angularAffinity = 1 - (angularDistance / 6); // Máxima afinidad a 180 grados
        // Promedio ponderado de factores
        const affinity = (elementalAffinity * 0.4 +
            qualityAffinity * 0.3 +
            angularAffinity * 0.3);
        return Math.max(0, Math.min(1, affinity));
    }
    /**
     * Genera descripción poética del signo zodiacal
     * @param position - Posición zodiacal (0-11)
     * @returns Descripción poética del signo
     */
    static generateZodiacDescription(position) {
        const pos = Math.max(0, Math.min(11, position));
        const sign = this.ZODIAC_SIGNS[pos];
        const traits = this.SIGN_TRAITS[sign];
        const descriptions = {
            Aries: "El guerrero ardiente que carga contra lo desconocido",
            Taurus: "La tierra fértil que cultiva sueños duraderos",
            Gemini: "El viento mercurial que baila entre mundos",
            Cancer: "La luna cambiante que protege y transforma",
            Leo: "El sol radiante que ilumina caminos evolutivos",
            Virgo: "La mente analítica que perfecciona la creación",
            Libra: "La balanza armoniosa que equilibra el caos",
            Scorpio: "Las profundidades misteriosas que regeneran",
            Sagittarius: "El arquero visionario que apunta a las estrellas",
            Capricorn: "La montaña inquebrantable que construye imperios",
            Aquarius: "El agua revolucionaria que libera mentes",
            Pisces: "El océano infinito que disuelve fronteras"
        };
        return descriptions[sign] || "Un signo de misterios cósmicos";
    }
    /**
     * Valida compatibilidad zodiacal para evolución
     * @param positions - Array de posiciones zodiacales
     * @returns true si la combinación es compatible para evolución
     */
    static validateZodiacCompatibility(positions) {
        if (positions.length < 2)
            return true;
        if (positions.length > 4)
            return false; // Máximo 4 signos para evolución equilibrada
        // Calcular afinidad promedio
        let totalAffinity = 0;
        let count = 0;
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                totalAffinity += this.calculateZodiacAffinity(positions[i], positions[j]);
                count++;
            }
        }
        const averageAffinity = count > 0 ? totalAffinity / count : 0;
        // Requiere afinidad promedio mínima del 50%
        return averageAffinity >= 0.5;
    }
    /**
     * Obtiene información completa de un signo zodiacal
     * @param position - Posición zodiacal (0-11)
     * @returns Información completa del signo
     */
    static getZodiacInfo(position) {
        const pos = Math.max(0, Math.min(11, position));
        const sign = this.ZODIAC_SIGNS[pos];
        return {
            sign,
            traits: this.SIGN_TRAITS[sign],
            description: this.generateZodiacDescription(pos)
        };
    }
    /**
     * Calcula posición zodiacal basada en timestamp determinista
     * @param timestamp - Timestamp base
     * @returns Posición zodiacal (0-11)
     */
    static calculateZodiacPosition(timestamp) {
        // Algoritmo determinista basado en ciclos lunares y solares
        const lunarCycle = 29.53; // Días
        const solarCycle = 365.25; // Días
        const lunarPosition = (timestamp / (lunarCycle * 24 * 60 * 60 * 1000)) % 1;
        const solarPosition = (timestamp / (solarCycle * 24 * 60 * 60 * 1000)) % 1;
        // Combinar ciclos para posición zodiacal
        const combinedPosition = (lunarPosition * 0.7 + solarPosition * 0.3) * 12;
        return Math.floor(combinedPosition) % 12;
    }
}
//# sourceMappingURL=zodiac-affinity-calculator.js.map