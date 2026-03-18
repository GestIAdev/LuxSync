/**
 * 🌟 ZODIAC SOUL FACTORY - Generador Procedural de Personalidades Zodiacales
 *
 * Sistema determinista que asigna signos zodiacales basados en:
 * - Hash del nodeId/pid (procedural, no random)
 * - Rotación balanceada entre 12 signos
 * - Atributos derivados de elemento/calidad
 *
 * ANTI-SIMULACIÓN: Sin Math.random(), todo procedural y verificable
 */
import type { NodePersonality, PersonalityTrait } from "../core/SwarmTypes.js";
export declare const ZODIAC_SIGNS: readonly [{
    readonly sign: "Aries";
    readonly element: "fire";
    readonly quality: "cardinal";
    readonly fibonacciWeight: 1;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.95;
    readonly rebelliousness: 0.85;
    readonly wisdom: 0.6;
}, {
    readonly sign: "Tauro";
    readonly element: "earth";
    readonly quality: "fixed";
    readonly fibonacciWeight: 1;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.7;
    readonly rebelliousness: 0.2;
    readonly wisdom: 0.8;
}, {
    readonly sign: "Géminis";
    readonly element: "air";
    readonly quality: "mutable";
    readonly fibonacciWeight: 2;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.85;
    readonly rebelliousness: 0.5;
    readonly wisdom: 0.75;
}, {
    readonly sign: "Cáncer";
    readonly element: "water";
    readonly quality: "cardinal";
    readonly fibonacciWeight: 3;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.8;
    readonly rebelliousness: 0.3;
    readonly wisdom: 0.85;
}, {
    readonly sign: "Leo";
    readonly element: "fire";
    readonly quality: "fixed";
    readonly fibonacciWeight: 5;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.9;
    readonly rebelliousness: 0.7;
    readonly wisdom: 0.7;
}, {
    readonly sign: "Virgo";
    readonly element: "earth";
    readonly quality: "mutable";
    readonly fibonacciWeight: 8;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.65;
    readonly rebelliousness: 0.15;
    readonly wisdom: 0.95;
}, {
    readonly sign: "Libra";
    readonly element: "air";
    readonly quality: "cardinal";
    readonly fibonacciWeight: 13;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.75;
    readonly rebelliousness: 0.25;
    readonly wisdom: 0.9;
}, {
    readonly sign: "Escorpio";
    readonly element: "water";
    readonly quality: "fixed";
    readonly fibonacciWeight: 21;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.85;
    readonly rebelliousness: 0.8;
    readonly wisdom: 0.88;
}, {
    readonly sign: "Sagitario";
    readonly element: "fire";
    readonly quality: "mutable";
    readonly fibonacciWeight: 34;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.88;
    readonly rebelliousness: 0.75;
    readonly wisdom: 0.82;
}, {
    readonly sign: "Capricornio";
    readonly element: "earth";
    readonly quality: "cardinal";
    readonly fibonacciWeight: 55;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.6;
    readonly rebelliousness: 0.1;
    readonly wisdom: 0.98;
}, {
    readonly sign: "Acuario";
    readonly element: "air";
    readonly quality: "fixed";
    readonly fibonacciWeight: 89;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.98;
    readonly rebelliousness: 0.95;
    readonly wisdom: 0.85;
}, {
    readonly sign: "Piscis";
    readonly element: "water";
    readonly quality: "mutable";
    readonly fibonacciWeight: 144;
    readonly coreTraits: PersonalityTrait[];
    readonly creativity: 0.92;
    readonly rebelliousness: 0.4;
    readonly wisdom: 0.92;
}];
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number]["sign"];
export type ZodiacElement = "fire" | "earth" | "air" | "water";
export type ZodiacQuality = "cardinal" | "fixed" | "mutable";
export interface ZodiacPersonality extends NodePersonality {
    zodiacSign: ZodiacSign;
    element: ZodiacElement;
    quality: ZodiacQuality;
    fibonacciWeight: number;
}
/**
 * 🌟 Generador Procedural de Personalidad Zodiacal
 *
 * Crea personalidades únicas basadas en arquetipos zodiacales,
 * garantizando que cada nodeId siempre obtenga el mismo signo
 * (determinismo total para reproducibilidad).
 *
 * @param nodeId - Identificador único del nodo
 * @param pid - Process ID (usado para nombre)
 * @returns Personalidad zodiacal completa
 */
export declare function generateZodiacPersonality(nodeId: string, pid?: number): ZodiacPersonality;
/**
 * 🔍 Análisis de Distribución Zodiacal
 *
 * Verifica que los signos se distribuyen uniformemente
 * al generar múltiples personalidades.
 *
 * @param sampleSize - Cantidad de muestras a generar
 * @returns Conteo de cada signo
 */
export declare function analyzeZodiacDistribution(sampleSize?: number): Record<ZodiacSign, number>;
/**
 * 🎯 Obtener Signo Zodiacal desde Índice
 *
 * @param index - Índice 0-11
 * @returns Datos completos del signo
 */
export declare function getZodiacByIndex(index: number): (typeof ZODIAC_SIGNS)[number];
/**
 * 🔢 Calcular Peso Fibonacci Total
 *
 * Usado para generar ratios armónicos en el sistema de consenso.
 *
 * @returns Suma de todos los pesos Fibonacci (1+1+2+3+...+144 = 376)
 */
export declare function getTotalFibonacciWeight(): number;
//# sourceMappingURL=ZodiacSoulFactory.d.ts.map