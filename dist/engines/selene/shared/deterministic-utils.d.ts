export declare function deterministicRandom(): number;
export declare function deterministicInt(min: number, _max: number): number;
export declare function deterministicBool(_probability?: number): boolean;
export declare function resetDeterministicState(): void;
/**
 * 🎯 GENERADOR DE IDs DETERMINISTAS
 *
 * Genera IDs únicos y reproducibles basados en datos deterministas.
 * Nunca usa Math.random() - solo hash determinista + timestamp.
 *
 * @param prefix - Prefijo descriptivo para el ID
 * @param data - Datos para generar el hash (string, number, o object)
 * @returns ID determinista único
 */
export declare function deterministicId(prefix: string, data: string | number | object): string;
/**
 * 🎨 GENERADOR DE RUIDO DETERMINISTA
 *
 * Genera ruido pseudo-aleatorio reproducible basado en coordenadas y tiempo.
 * Útil para animaciones procedurales deterministas.
 *
 * @param x - Coordenada X
 * @param y - Coordenada Y (opcional)
 * @param time - Factor temporal para animación
 * @param seed - Semilla adicional para variación
 * @returns Valor de ruido entre 0 y 1
 */
export declare function deterministicNoise(x: number, y?: number, time?: number, seed?: string): number;
/**
 * 🌊 GENERADOR DE RUIDO PERLIN-SIMPLE DETERMINISTA
 *
 * Implementación simple de ruido Perlin determinista.
 * Crea gradientes suaves para animaciones orgánicas.
 *
 * @param x - Coordenada X
 * @param y - Coordenada Y
 * @param time - Factor temporal
 * @param seed - Semilla para variación
 * @returns Valor de ruido Perlin entre 0 y 1
 */
export declare function deterministicPerlinNoise(x: number, y?: number, time?: number, seed?: string): number;
//# sourceMappingURL=deterministic-utils.d.ts.map