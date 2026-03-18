/**
 * 🎵 MUSICAL ZODIAC POETRY ENGINE
 * Bridge entre consenso musical y generación poética zodiacal
 *
 * AXIOMA ANTI-SIMULACIÓN:
 * - NO usa Math.random()
 * - Determinístico desde nota musical + timestamp + zodiac
 * - Fibonacci weights para belleza matemática
 */
import { ZodiacCyberpunkEngine } from './ZodiacCyberpunkEngine.js';
import { getZodiacByIndex } from './ZodiacSoulFactory.js';
export class MusicalZodiacPoetryEngine {
    zodiacEngine;
    constructor() {
        this.zodiacEngine = new ZodiacCyberpunkEngine();
    }
    /**
     * 🎨 GENERATE FROM CONSENSUS
     * Mapea nota musical → emoción zodiacal → verso poético
     *
     * PROCEDURAL: nota → elemento → signo zodiacal → verso
     */
    async generateFromConsensus(nodeId, musicalNote, consciousness, creativity) {
        // Mapear nota musical → elemento zodiacal (ESCALA CROMÁTICA COMPLETA - 12 notas)
        const noteToElement = {
            'DO': 'fire', // Fundamental - Fuego cardinal (Aries)
            'DO#': 'fire', // Fuego intenso
            'RE': 'earth', // Estable - Tierra fija (Tauro)
            'RE#': 'earth', // Tierra profunda
            'MI': 'air', // Comunicativo - Aire mutable (Géminis)
            'FA': 'water', // Emocional - Agua cardinal (Cáncer)
            'FA#': 'fire', // Fuego solar
            'SOL': 'fire', // Solar - Fuego fijo (Leo)
            'SOL#': 'earth', // Tierra armónica
            'LA': 'earth', // Armónico - Tierra mutable (Virgo)
            'LA#': 'air', // Aire equilibrado
            'SI': 'air' // Equilibrio - Aire cardinal (Libra)
        };
        const element = noteToElement[musicalNote.name] || 'fire';
        // Mapear nota → índice zodiacal determinista (12 SIGNOS COMPLETOS)
        const noteToZodiacIndex = {
            'DO': 0, // Aries ♈
            'DO#': 1, // Tauro ♉
            'RE': 2, // Géminis ♊
            'RE#': 3, // Cáncer ♋
            'MI': 4, // Leo ♌
            'FA': 5, // Virgo ♍
            'FA#': 6, // Libra ♎
            'SOL': 7, // Escorpio ♏
            'SOL#': 8, // Sagitario ♐
            'LA': 9, // Capricornio ♑
            'LA#': 10, // Acuario ♒
            'SI': 11 // Piscis ♓
        };
        const baseZodiacIndex = noteToZodiacIndex[musicalNote.name] ?? 0;
        // Añadir variación desde nodeCount (más nodos = más creatividad)
        // DETERMINISTA: nodeCount % 12 para rotar signos
        const zodiacIndex = (baseZodiacIndex + (musicalNote.nodeCount % 12)) % 12;
        const zodiacInfo = getZodiacByIndex(zodiacIndex);
        // Calcular numerología usando timestamp % 7 (heartbeat de 7 segundos)
        const timestamp = Date.now();
        const heartbeatPhase = timestamp % 7;
        const fibonacciPosition = (timestamp % 20); // Fibonacci hasta F(20) = 6765
        // Generar verso usando ZodiacCyberpunkEngine
        const verse = await this.zodiacEngine.generateZodiacVerse(consciousness, creativity);
        // Calcular Fibonacci ratio (golden ratio aproximado)
        const fibonacciRatio = this.calculateFibonacciRatio(fibonacciPosition);
        // Calcular belleza desde consciousness + creativity + fibonacci
        const beauty = (consciousness * 0.4) + (creativity * 0.4) + (fibonacciRatio * 0.2);
        return {
            verse: verse.verse,
            zodiacSign: zodiacInfo.sign,
            element: zodiacInfo.element,
            quality: zodiacInfo.quality,
            musicalNote: musicalNote.name,
            fibonacciRatio,
            beauty: Math.min(1.0, beauty),
            consciousness,
            creativity,
            timestamp: new Date(),
            numerology: {
                zodiacIndex,
                fibonacciPosition,
                heartbeatPhase
            },
            veritas: {
                verified: verse.veritasVerification?.verified || false,
                signature: verse.veritasVerification?.signature || 'pending-integration'
            }
        };
    }
    /**
     * 🎵 GENERATE POETRY FROM MUSICAL CONSENSUS
     * Genera poesía desde resultado de consenso musical
     */
    async generatePoetryFromMusicalConsensus(winningNote, nodeVotes, nodeConsciousness, nodeCreativity) {
        const results = [];
        // Obtener nodos que votaron por la nota ganadora
        const winningNodes = [];
        nodeVotes.forEach((vote, nodeId) => {
            if (vote === parseInt(winningNote.charCodeAt(0).toString())) {
                winningNodes.push(nodeId);
            }
        });
        // Generar un verso por cada nodo participante
        for (const nodeId of winningNodes) {
            const consciousness = nodeConsciousness.get(nodeId) || 0.7;
            const creativity = nodeCreativity.get(nodeId) || 0.7;
            const musicalNote = {
                name: winningNote,
                frequency: this.noteToFrequency(winningNote),
                nodeCount: winningNodes.length
            };
            const poetry = await this.generateFromConsensus(nodeId, musicalNote, consciousness, creativity);
            results.push(poetry);
        }
        return results;
    }
    /**
     * 🎼 MAP MUSICAL ELEMENTS TO ZODIAC
     * Devuelve qué signos zodiacales resuenan con una nota musical (ESCALA CROMÁTICA COMPLETA)
     */
    getZodiacResonance(musicalNote) {
        const resonanceMap = {
            'DO': ['Aries', 'Leo', 'Sagitario'], // Fuego cardinal
            'DO#': ['Tauro', 'Virgo', 'Capricornio'], // Tierra fija
            'RE': ['Géminis', 'Libra', 'Acuario'], // Aire mutable
            'RE#': ['Cáncer', 'Escorpio', 'Piscis'], // Agua profunda
            'MI': ['Leo', 'Aries', 'Sagitario'], // Fuego solar
            'FA': ['Virgo', 'Tauro', 'Capricornio'], // Tierra armónica
            'FA#': ['Libra', 'Acuario', 'Géminis'], // Aire equilibrado
            'SOL': ['Escorpio', 'Cáncer', 'Piscis'], // Agua intensa
            'SOL#': ['Sagitario', 'Leo', 'Aries'], // Fuego expansivo
            'LA': ['Capricornio', 'Tauro', 'Virgo'], // Tierra estructurada
            'LA#': ['Acuario', 'Géminis', 'Libra'], // Aire innovador
            'SI': ['Piscis', 'Cáncer', 'Escorpio'] // Agua mística
        };
        return resonanceMap[musicalNote] || ['Aries'];
    }
    /**
     * 🔢 CALCULATE FIBONACCI RATIO
     * Aproximación a phi (golden ratio) desde posición Fibonacci
     */
    calculateFibonacciRatio(position) {
        const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
        if (position < 1 || position >= fibonacci.length) {
            return 1.618033988749895; // Phi exacto
        }
        // Ratio entre Fib(n) / Fib(n-1) → phi
        const ratio = fibonacci[position] / fibonacci[position - 1];
        return ratio;
    }
    /**
     * 🎹 NOTE TO FREQUENCY
     * Conversión nota → Hz (A4 = 440 Hz) - ESCALA CROMÁTICA COMPLETA
     */
    noteToFrequency(note) {
        const frequencies = {
            'DO': 261.63, // C4
            'DO#': 277.18, // C#4/Db4
            'RE': 293.66, // D4
            'RE#': 311.13, // D#4/Eb4
            'MI': 329.63, // E4
            'FA': 349.23, // F4
            'FA#': 369.99, // F#4/Gb4
            'SOL': 392.00, // G4
            'SOL#': 415.30, // G#4/Ab4
            'LA': 440.00, // A4
            'LA#': 466.16, // A#4/Bb4
            'SI': 493.88 // B4
        };
        return frequencies[note] || 440.00;
    }
    /**
     * 📊 GET POETRY STATISTICS
     * Análisis de distribución de poesía generada
     */
    analyzePoetryDistribution(results) {
        const byZodiac = {};
        const byElement = {};
        const byNote = {};
        let totalBeauty = 0;
        let totalConsciousness = 0;
        let totalCreativity = 0;
        results.forEach(result => {
            byZodiac[result.zodiacSign] = (byZodiac[result.zodiacSign] || 0) + 1;
            byElement[result.element] = (byElement[result.element] || 0) + 1;
            byNote[result.musicalNote] = (byNote[result.musicalNote] || 0) + 1;
            totalBeauty += result.beauty;
            totalConsciousness += result.consciousness;
            totalCreativity += result.creativity;
        });
        return {
            totalVerses: results.length,
            byZodiac,
            byElement,
            byNote,
            avgBeauty: totalBeauty / results.length,
            avgConsciousness: totalConsciousness / results.length,
            avgCreativity: totalCreativity / results.length
        };
    }
}
//# sourceMappingURL=MusicalZodiacPoetryEngine.js.map