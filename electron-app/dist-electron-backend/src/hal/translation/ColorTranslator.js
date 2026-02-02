/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 WAVE 1000: COLOR TRANSLATOR - EL INTÉRPRETE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Traduce intenciones artísticas (RGB) a realidades físicas (DMX).
 *
 * PROBLEMA QUE RESUELVE:
 * Selene sueña en "#00FFFF" (Cian Cyberpunk), pero el Beam 2R solo
 * tiene 8 colores fijos en su rueda. ¿Qué hacemos?
 *
 * SOLUCIÓN:
 * 1. Calculamos la "distancia" del color pedido a cada color de la rueda
 * 2. Elegimos el color más cercano (vecino más próximo)
 * 3. Enviamos el DMX de ese color
 *
 * ALGORITMOS DE DISTANCIA:
 * - Euclidiana RGB: Simple pero no perceptualmente uniforme
 * - CIE Delta E 2000: Perceptualmente uniforme, más complejo
 * - Usamos RGB por eficiencia (suficiente para ruedas de 8-12 colores)
 *
 * @module hal/translation/ColorTranslator
 * @version WAVE 1000
 */
import { needsColorTranslation, } from './FixtureProfiles';
// ═══════════════════════════════════════════════════════════════════════════
// ALGORITMOS DE DISTANCIA DE COLOR
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Distancia Euclidiana en espacio RGB
 *
 * Simple y rápida. Suficiente para ruedas de pocos colores.
 * No es perceptualmente uniforme (verde se percibe diferente a rojo)
 * pero para nuestro caso (8-12 colores) funciona bien.
 *
 * Distancia máxima posible: sqrt(255² + 255² + 255²) ≈ 441.67
 */
function rgbDistance(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}
/**
 * Distancia ponderada perceptualmente
 *
 * Los humanos son más sensibles al verde, luego al rojo, luego al azul.
 * Esta fórmula compensa esa diferencia.
 */
function weightedRgbDistance(c1, c2) {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    // Pesos basados en sensibilidad humana
    const rWeight = 0.299;
    const gWeight = 0.587;
    const bWeight = 0.114;
    return Math.sqrt(rWeight * dr * dr +
        gWeight * dg * dg +
        bWeight * db * db);
}
/**
 * Calcula la luminosidad percibida de un color
 */
function getLuminance(c) {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}
/**
 * Calcula la saturación aproximada de un color
 */
function getSaturation(c) {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    if (max === 0)
        return 0;
    return (max - min) / max;
}
// ═══════════════════════════════════════════════════════════════════════════
// COLOR TRANSLATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════
export class ColorTranslator {
    constructor() {
        // Cache de traducciones para evitar recalcular cada frame
        this.translationCache = new Map();
        // Umbral de "poor match" - si la distancia supera esto, es mejor usar blanco
        // 441 es la distancia máxima (negro a blanco), usamos ~40% como umbral
        this.POOR_MATCH_THRESHOLD = 180;
        // Tamaño máximo del cache
        this.MAX_CACHE_SIZE = 256;
        console.log('[ColorTranslator] 🎨 WAVE 1000: Initialized');
    }
    /**
     * 🎯 MÉTODO PRINCIPAL: Traduce un color RGB al formato físico del fixture
     *
     * @param targetRGB - Color que Selene quiere
     * @param profile - Perfil del fixture (define sus capacidades)
     * @returns Resultado de la traducción
     */
    translate(targetRGB, profile) {
        // ═══════════════════════════════════════════════════════════════════
        // CASO 1: Sin perfil conocido → Pass-through (asume RGB)
        // ═══════════════════════════════════════════════════════════════════
        if (!profile) {
            return {
                outputRGB: targetRGB,
                colorDistance: 0,
                wasTranslated: false,
                poorMatch: false,
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CASO 2: Fixture RGB/RGBW/CMY → Pass-through (puede hacer cualquier color)
        // ═══════════════════════════════════════════════════════════════════
        if (!needsColorTranslation(profile)) {
            return {
                outputRGB: targetRGB,
                colorDistance: 0,
                wasTranslated: false,
                poorMatch: false,
            };
        }
        // ═══════════════════════════════════════════════════════════════════
        // CASO 3: Fixture con rueda de colores → Buscar vecino más cercano
        // ═══════════════════════════════════════════════════════════════════
        const colorWheel = profile.colorEngine.colorWheel;
        if (!colorWheel || colorWheel.colors.length === 0) {
            // Perfil mal configurado, usar blanco como fallback
            console.warn(`[ColorTranslator] ⚠️ Profile ${profile.id} has no color wheel defined`);
            return {
                outputRGB: { r: 255, g: 255, b: 255 },
                colorWheelDmx: 0,
                colorName: 'Open (Fallback)',
                colorDistance: 441, // Máxima distancia
                wasTranslated: true,
                poorMatch: true,
            };
        }
        // Check cache
        const cacheKey = this.getCacheKey(targetRGB, profile.id);
        const cached = this.translationCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        // Buscar el color más cercano
        const result = this.findNearestColor(targetRGB, colorWheel);
        // Guardar en cache
        this.cacheResult(cacheKey, result);
        return result;
    }
    /**
     * 🔍 Busca el color más cercano en la rueda
     */
    findNearestColor(target, wheel) {
        let nearestColor = wheel.colors[0];
        let smallestDistance = Infinity;
        for (const wheelColor of wheel.colors) {
            // Usamos distancia ponderada para mejor percepción
            const distance = weightedRgbDistance(target, wheelColor.rgb);
            if (distance < smallestDistance) {
                smallestDistance = distance;
                nearestColor = wheelColor;
            }
        }
        // Determinar si es un "poor match"
        const poorMatch = smallestDistance > this.POOR_MATCH_THRESHOLD;
        // Si es muy malo el match y el color pedido es saturado, considerar alternativas
        let finalColor = nearestColor;
        if (poorMatch && getSaturation(target) < 0.3) {
            // Color poco saturado + poor match = probablemente mejor usar blanco
            const whiteColor = wheel.colors.find(c => c.name.toLowerCase().includes('white') || c.name.toLowerCase().includes('open'));
            if (whiteColor) {
                finalColor = whiteColor;
                smallestDistance = weightedRgbDistance(target, whiteColor.rgb);
            }
        }
        return {
            outputRGB: finalColor.rgb,
            colorWheelDmx: finalColor.dmx,
            colorName: finalColor.name,
            colorDistance: smallestDistance,
            wasTranslated: true,
            poorMatch,
        };
    }
    /**
     * 🎲 Genera una clave de cache
     */
    getCacheKey(rgb, profileId) {
        // Cuantizamos el color para aumentar hits de cache
        // (colores muy similares comparten resultado)
        const qr = Math.round(rgb.r / 8) * 8;
        const qg = Math.round(rgb.g / 8) * 8;
        const qb = Math.round(rgb.b / 8) * 8;
        return `${profileId}:${qr},${qg},${qb}`;
    }
    /**
     * 💾 Guarda resultado en cache con límite de tamaño
     */
    cacheResult(key, result) {
        // Evitar que el cache crezca infinitamente
        if (this.translationCache.size >= this.MAX_CACHE_SIZE) {
            // Eliminar el primer elemento (LRU simple)
            const firstKey = this.translationCache.keys().next().value;
            if (firstKey) {
                this.translationCache.delete(firstKey);
            }
        }
        this.translationCache.set(key, result);
    }
    /**
     * 🧹 Limpia el cache de traducciones
     */
    clearCache() {
        this.translationCache.clear();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // MÉTODOS DE UTILIDAD
    // ═══════════════════════════════════════════════════════════════════════
    /**
     * Obtiene todos los colores disponibles en un perfil
     */
    getAvailableColors(profile) {
        if (profile.colorEngine.mixing === 'wheel' || profile.colorEngine.mixing === 'hybrid') {
            return profile.colorEngine.colorWheel?.colors ?? [];
        }
        // Para RGB, devolvemos colores primarios y secundarios como referencia
        return [
            { dmx: 0, name: 'Red', rgb: { r: 255, g: 0, b: 0 } },
            { dmx: 0, name: 'Green', rgb: { r: 0, g: 255, b: 0 } },
            { dmx: 0, name: 'Blue', rgb: { r: 0, g: 0, b: 255 } },
            { dmx: 0, name: 'Yellow', rgb: { r: 255, g: 255, b: 0 } },
            { dmx: 0, name: 'Cyan', rgb: { r: 0, g: 255, b: 255 } },
            { dmx: 0, name: 'Magenta', rgb: { r: 255, g: 0, b: 255 } },
            { dmx: 0, name: 'White', rgb: { r: 255, g: 255, b: 255 } },
        ];
    }
    /**
     * Debug: muestra la distancia de un color a cada color de la rueda
     */
    debugDistances(target, profile) {
        const colors = this.getAvailableColors(profile);
        console.log(`[ColorTranslator] 🔬 Distances from RGB(${target.r}, ${target.g}, ${target.b}):`);
        for (const color of colors) {
            const dist = weightedRgbDistance(target, color.rgb);
            const bar = '█'.repeat(Math.round(dist / 10));
            console.log(`  ${color.name.padEnd(15)} DMX:${color.dmx.toString().padStart(3)} | Distance: ${dist.toFixed(1).padStart(6)} | ${bar}`);
        }
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════
let instance = null;
export function getColorTranslator() {
    if (!instance) {
        instance = new ColorTranslator();
    }
    return instance;
}
