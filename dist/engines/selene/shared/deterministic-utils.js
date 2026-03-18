// 🎯 DETERMINISTIC RANDOM UTILITY - NO deterministicRandom()
// ⚡ Algoritmo procedural puro: Linear Congruential Generator (LCG)
// 🔒 Semilla fija para 100% determinismo
const DETERMINISTIC_SEED = 1728345600000; // Timestamp fijo para determinismo
let state = DETERMINISTIC_SEED;
const a = 1664525; // Multiplicador
const c = 1013904223; // Incremento
const m = 4294967296; // Módulo (2^32)
export function deterministicRandom() {
    state = (a * state + c) % m;
    return state / m; // Retorna valor entre 0 y 1
}
// 🎨 Función para números enteros deterministas
export function deterministicInt(min, _max) {
    return Math.floor(deterministicRandom() * (_max - min + 1)) + min;
}
// 🔮 Función para booleanos deterministas
export function deterministicBool(_probability = 0.5) {
    return deterministicRandom() < _probability;
}
// 🎯 Reset del estado para pruebas consistentes
export function resetDeterministicState() {
    state = DETERMINISTIC_SEED;
}
/**
 * 🔧 UTILIDADES DETERMINISTAS - ANTI-SIMULACIÓN
 *
 * Este módulo proporciona funciones deterministas que reemplazan cualquier uso de Math.random()
 * o generadores no deterministas. Todo aquí es reproducible y verificable.
 *
 * AXIOMA ANTI-SIMULACIÓN: Solo algoritmos puros, sin aleatoriedad.
 */
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32-bit integer
    }
    return Math.abs(hash);
}
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
export function deterministicId(prefix, data) {
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    const timestamp = Date.now(); // Incluir timestamp para unicidad temporal
    const hashInput = `${prefix}-${dataString}-${timestamp}`;
    const hash = hashString(hashInput);
    // Convertir hash a base36 y añadir timestamp para asegurar unicidad
    return `${prefix}_${timestamp.toString(36)}_${hash.toString(36)}`;
}
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
export function deterministicNoise(x, y = 0, time = 0, seed = '') {
    const input = `${seed}_${x.toFixed(2)}_${y.toFixed(2)}_${time.toFixed(2)}`;
    const hash = hashString(input);
    return (hash % 1000000) / 1000000; // Normalizar a 0-1
}
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
export function deterministicPerlinNoise(x, y = 0, time = 0, seed = '') {
    // Gradientes en las esquinas del cuadrado
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    // Vectores de gradiente deterministas
    const g00 = deterministicNoise(x0, y0, time, `${seed}_g00`) * 2 - 1;
    const g10 = deterministicNoise(x1, y0, time, `${seed}_g10`) * 2 - 1;
    const g01 = deterministicNoise(x0, y1, time, `${seed}_g01`) * 2 - 1;
    const g11 = deterministicNoise(x1, y1, time, `${seed}_g11`) * 2 - 1;
    // Función de interpolación suave
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = fade(x - x0);
    const v = fade(y - y0);
    // Interpolación bilineal
    const n00 = g00 * (x - x0) + g10 * (x1 - x);
    const n10 = g01 * (x - x0) + g11 * (x1 - x);
    const n = n00 * (y - y0) + n10 * (y1 - y);
    return (n + 1) / 2; // Normalizar a 0-1
}
//# sourceMappingURL=deterministic-utils.js.map