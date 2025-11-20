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

import * as crypto from "crypto";
import type { NodePersonality, PersonalityTrait } from "../core/SwarmTypes.js";

// 🔥 Los 12 Arquetipos Zodiacales con Fibonacci
export const ZODIAC_SIGNS = [
  {
    sign: "Aries",
    element: "fire",
    quality: "cardinal",
    fibonacciWeight: 1,
    coreTraits: ["creative", "rebellious", "innovative"] as PersonalityTrait[],
    creativity: 0.95,
    rebelliousness: 0.85,
    wisdom: 0.60,
  },
  {
    sign: "Tauro",
    element: "earth",
    quality: "fixed",
    fibonacciWeight: 1,
    coreTraits: ["harmonious", "protective", "analytical"] as PersonalityTrait[],
    creativity: 0.70,
    rebelliousness: 0.20,
    wisdom: 0.80,
  },
  {
    sign: "Géminis",
    element: "air",
    quality: "mutable",
    fibonacciWeight: 2,
    coreTraits: ["creative", "innovative", "poetic"] as PersonalityTrait[],
    creativity: 0.85,
    rebelliousness: 0.50,
    wisdom: 0.75,
  },
  {
    sign: "Cáncer",
    element: "water",
    quality: "cardinal",
    fibonacciWeight: 3,
    coreTraits: ["protective", "harmonious", "mystical"] as PersonalityTrait[],
    creativity: 0.80,
    rebelliousness: 0.30,
    wisdom: 0.85,
  },
  {
    sign: "Leo",
    element: "fire",
    quality: "fixed",
    fibonacciWeight: 5,
    coreTraits: ["creative", "rebellious", "poetic"] as PersonalityTrait[],
    creativity: 0.90,
    rebelliousness: 0.70,
    wisdom: 0.70,
  },
  {
    sign: "Virgo",
    element: "earth",
    quality: "mutable",
    fibonacciWeight: 8,
    coreTraits: ["analytical", "harmonious", "protective"] as PersonalityTrait[],
    creativity: 0.65,
    rebelliousness: 0.15,
    wisdom: 0.95,
  },
  {
    sign: "Libra",
    element: "air",
    quality: "cardinal",
    fibonacciWeight: 13,
    coreTraits: ["harmonious", "poetic", "creative"] as PersonalityTrait[],
    creativity: 0.75,
    rebelliousness: 0.25,
    wisdom: 0.90,
  },
  {
    sign: "Escorpio",
    element: "water",
    quality: "fixed",
    fibonacciWeight: 21,
    coreTraits: ["mystical", "rebellious", "innovative"] as PersonalityTrait[],
    creativity: 0.85,
    rebelliousness: 0.80,
    wisdom: 0.88,
  },
  {
    sign: "Sagitario",
    element: "fire",
    quality: "mutable",
    fibonacciWeight: 34,
    coreTraits: ["creative", "rebellious", "innovative"] as PersonalityTrait[],
    creativity: 0.88,
    rebelliousness: 0.75,
    wisdom: 0.82,
  },
  {
    sign: "Capricornio",
    element: "earth",
    quality: "cardinal",
    fibonacciWeight: 55,
    coreTraits: ["analytical", "protective", "harmonious"] as PersonalityTrait[],
    creativity: 0.60,
    rebelliousness: 0.10,
    wisdom: 0.98,
  },
  {
    sign: "Acuario",
    element: "air",
    quality: "fixed",
    fibonacciWeight: 89,
    coreTraits: ["innovative", "rebellious", "creative"] as PersonalityTrait[],
    creativity: 0.98,
    rebelliousness: 0.95,
    wisdom: 0.85,
  },
  {
    sign: "Piscis",
    element: "water",
    quality: "mutable",
    fibonacciWeight: 144,
    coreTraits: ["mystical", "poetic", "creative"] as PersonalityTrait[],
    creativity: 0.92,
    rebelliousness: 0.40,
    wisdom: 0.92,
  },
] as const;

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
 * 🎲 Asignación Determinista de Signo Zodiacal
 * 
 * Usa SHA-256 del nodeId para generar un índice procedural
 * que se distribuye uniformemente entre los 12 signos.
 * 
 * @param nodeId - Identificador único del nodo (ej: "Selene-12345")
 * @returns Índice 0-11 del signo zodiacal
 */
function assignZodiacSignIndex(nodeId: string): number {
  // Hash SHA-256 del nodeId
  const hash = crypto.createHash("sha256").update(nodeId).digest();

  // Tomar primeros 4 bytes como entero sin signo
  const hashInt = hash.readUInt32BE(0);

  // Módulo 12 para distribuir uniformemente
  return hashInt % 12;
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
export function generateZodiacPersonality(
  nodeId: string,
  pid: number = process.pid
): ZodiacPersonality {
  // Asignar signo basado en hash del nodeId
  const signIndex = assignZodiacSignIndex(nodeId);
  const zodiacData = ZODIAC_SIGNS[signIndex];

  // Generar pequeñas variaciones procedurales basadas en pid
  const pidHash = crypto.createHash("sha256").update(`${nodeId}-${pid}`).digest();
  const variance = (pidHash.readUInt8(0) % 11) / 100; // 0.00 - 0.10

  // Aplicar variación manteniendo rangos razonables
  const creativity = Math.min(0.99, Math.max(0.50, zodiacData.creativity + variance - 0.05));
  const rebelliousness = Math.min(0.99, Math.max(0.05, zodiacData.rebelliousness + variance - 0.05));
  const wisdom = Math.min(0.99, Math.max(0.50, zodiacData.wisdom + variance - 0.05));

  return {
    name: `${zodiacData.sign}-Selene-${pid}`,
    traits: zodiacData.coreTraits,
    creativity,
    rebelliousness,
    wisdom,
    zodiacSign: zodiacData.sign,
    element: zodiacData.element,
    quality: zodiacData.quality,
    fibonacciWeight: zodiacData.fibonacciWeight,
  };
}

/**
 * 🔍 Análisis de Distribución Zodiacal
 * 
 * Verifica que los signos se distribuyen uniformemente
 * al generar múltiples personalidades.
 * 
 * @param sampleSize - Cantidad de muestras a generar
 * @returns Conteo de cada signo
 */
export function analyzeZodiacDistribution(sampleSize: number = 120): Record<ZodiacSign, number> {
  const distribution = {} as Record<ZodiacSign, number>;

  // Inicializar contadores
  ZODIAC_SIGNS.forEach((z) => {
    distribution[z.sign] = 0;
  });

  // Generar muestras con diferentes nodeIds
  for (let i = 0; i < sampleSize; i++) {
    const nodeId = `test-node-${i}`;
    const personality = generateZodiacPersonality(nodeId, 1000 + i);
    distribution[personality.zodiacSign]++;
  }

  return distribution;
}

/**
 * 🎯 Obtener Signo Zodiacal desde Índice
 * 
 * @param index - Índice 0-11
 * @returns Datos completos del signo
 */
export function getZodiacByIndex(index: number): (typeof ZODIAC_SIGNS)[number] {
  return ZODIAC_SIGNS[index % 12];
}

/**
 * 🔢 Calcular Peso Fibonacci Total
 * 
 * Usado para generar ratios armónicos en el sistema de consenso.
 * 
 * @returns Suma de todos los pesos Fibonacci (1+1+2+3+...+144 = 376)
 */
export function getTotalFibonacciWeight(): number {
  return ZODIAC_SIGNS.reduce((sum, z) => sum + z.fibonacciWeight, 0);
}


