/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌊 WAVE 1072: THE OCEAN TRANSLATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FILOSOFÍA: "El océano como compositor, la profundidad como partitura"
 *
 * Este módulo traduce el estado oceánico (profundidad, zona, mareas) a
 * parámetros de contexto musical que SeleneColorEngine puede entender.
 *
 * EN VEZ DE BYPASEAR con colores hardcodeados, MODULAMOS el sistema existente.
 *
 * MÉTRICAS ESTABLES PARA CHILL:
 * - clarity: ⭐⭐⭐⭐⭐ (0.94-0.98 constante) → Modula brillo
 * - spectralFlatness: ⭐⭐⭐⭐ (0.03-0.10) → Detecta textura vs vacío
 * - smoothedEnergy: ⭐⭐⭐ (con smoothing) → Respiración del océano
 * - bassEnergy: ⭐⭐⭐ → Triggers de ballenas
 *
 * MÉTRICAS INESTABLES (NO USAR DIRECTAMENTE):
 * - centroid: Fluctúa 1800-8000Hz en frames consecutivos
 * - transientDensity: Semi-estable, usar solo para triggers puntuales
 *
 * @module hal/physics/OceanicContextAdapter
 * @version WAVE 1072
 */
/**
 * Configuración de color por zona oceánica
 * Estos valores serán usados como INFLUENCIA, no como override
 */
const ZONE_CONFIGS = {
    SHALLOWS: {
        hue: 160, // Verde esmeralda
        hueVariation: 20, // Puede variar 140-180
        saturation: 75,
        lightness: 55,
        section: 'intro',
        emotion: 'serene',
        baseEnergy: 0.35,
    },
    OCEAN: {
        hue: 200, // Azul tropical
        hueVariation: 15,
        saturation: 70,
        lightness: 50,
        section: 'verse',
        emotion: 'contemplative',
        baseEnergy: 0.30,
    },
    TWILIGHT: {
        hue: 245, // Índigo profundo
        hueVariation: 20,
        saturation: 65,
        lightness: 38,
        section: 'breakdown',
        emotion: 'melancholic',
        baseEnergy: 0.22,
    },
    MIDNIGHT: {
        hue: 290, // Magenta bioluminiscente
        hueVariation: 40, // Gran variación para efecto alienígena
        saturation: 85,
        lightness: 28,
        section: 'ambient',
        emotion: 'ethereal',
        baseEnergy: 0.15,
    },
};
const smoothingState = {
    energyHistory: [],
    hueHistory: [],
    lastUpdate: 0,
};
const SMOOTHING_CONFIG = {
    /** Tamaño del buffer de smoothing (frames) */
    BUFFER_SIZE: 30, // ~0.5s a 60fps
    /** Peso del valor actual vs histórico (0-1) */
    CURRENT_WEIGHT: 0.08, // Solo 8% del valor nuevo por frame
    /** Máximo cambio de hue por frame */
    MAX_HUE_DELTA: 2, // Máximo 2° de cambio por frame
    /** Máximo cambio de energía por frame */
    MAX_ENERGY_DELTA: 0.02, // Máximo 2% de cambio por frame
};
/**
 * Aplica smoothing a un valor usando el buffer histórico
 */
function smoothValue(current, history, maxDelta, weight) {
    if (history.length === 0) {
        return current;
    }
    const lastValue = history[history.length - 1];
    // Weighted average con historial
    const avgHistory = history.reduce((a, b) => a + b, 0) / history.length;
    const blended = avgHistory * (1 - weight) + current * weight;
    // Clamping del delta máximo
    const delta = blended - lastValue;
    const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
    return lastValue + clampedDelta;
}
// ═══════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL: TRANSLATE
// ═══════════════════════════════════════════════════════════════════════════
/**
 * 🌊 Traduce el estado oceánico a contexto musical
 *
 * Esta es la función principal del Ocean Translator.
 * Toma la profundidad y las métricas estables del GodEar,
 * y produce un contexto que SeleneColorEngine puede usar
 * para generar paletas oceánicas NATURALMENTE.
 *
 * @param depth - Profundidad actual en metros (0-10000)
 * @param zone - Zona oceánica actual
 * @param tidePhase - Fase de marea (0-1)
 * @param godEar - Métricas estables del FFT (opcional)
 * @returns Contexto musical oceánico
 */
export function translateOceanicContext(depth, zone, tidePhase, godEar) {
    const now = Date.now();
    const config = ZONE_CONFIGS[zone];
    // ═══════════════════════════════════════════════════════════════════════
    // 1. EXTRAER MÉTRICAS ESTABLES (con defaults seguros)
    // ═══════════════════════════════════════════════════════════════════════
    const clarity = godEar?.clarity ?? 0.95;
    const flatness = godEar?.spectralFlatness ?? 0.05;
    const energy = godEar?.smoothedEnergy ?? 0.2;
    const bass = godEar?.bassEnergy ?? 0.3;
    const crest = godEar?.crestFactor ?? 10;
    // ═══════════════════════════════════════════════════════════════════════
    // 2. CALCULAR BREATHING FACTOR (modulación sutil por audio)
    // ═══════════════════════════════════════════════════════════════════════
    // El breathing combina energía suave + claridad para modular sutilmente
    // Rango: 0.85 - 1.15 (±15% de modulación máxima)
    const rawBreathing = 0.85 + (energy * 0.2) + (clarity * 0.1);
    // Smoothing del breathing
    const smoothedBreathing = smoothValue(rawBreathing, smoothingState.energyHistory, SMOOTHING_CONFIG.MAX_ENERGY_DELTA, SMOOTHING_CONFIG.CURRENT_WEIGHT);
    // Actualizar historial
    smoothingState.energyHistory.push(smoothedBreathing);
    if (smoothingState.energyHistory.length > SMOOTHING_CONFIG.BUFFER_SIZE) {
        smoothingState.energyHistory.shift();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 3. CALCULAR HUE INFLUENCE
    // ═══════════════════════════════════════════════════════════════════════
    // Variación del hue basada en tiempo (muy lento) + bass sutil
    const timeVariation = Math.sin(now / 8000) * config.hueVariation;
    const bassVariation = (bass - 0.3) * 5; // ±5° basado en bass
    let rawHue = config.hue + timeVariation + bassVariation;
    // Smoothing del hue
    const smoothedHue = smoothValue(rawHue, smoothingState.hueHistory, SMOOTHING_CONFIG.MAX_HUE_DELTA, SMOOTHING_CONFIG.CURRENT_WEIGHT);
    // Actualizar historial
    smoothingState.hueHistory.push(smoothedHue);
    if (smoothingState.hueHistory.length > SMOOTHING_CONFIG.BUFFER_SIZE) {
        smoothingState.hueHistory.shift();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // 4. CALCULAR MODULADORES DE COLOR
    // ═══════════════════════════════════════════════════════════════════════
    // Fuerza de influencia: más fuerte en zonas profundas
    // SHALLOWS = 0.6, OCEAN = 0.7, TWILIGHT = 0.8, MIDNIGHT = 0.9
    const depthFactor = Math.min(1, depth / 10000);
    const influenceStrength = 0.6 + depthFactor * 0.3;
    // Moduladores de saturación y luminosidad basados en breathing
    const saturationMod = (smoothedBreathing - 1) * 20; // ±20% de modulación
    const lightnessMod = (smoothedBreathing - 1) * 15; // ±15% de modulación
    // ═══════════════════════════════════════════════════════════════════════
    // 5. CALCULAR ENERGÍA TRADUCIDA
    // ═══════════════════════════════════════════════════════════════════════
    // Energía = base de zona + modulación suave por audio
    // El audio puede modular ±10% sobre la base de zona
    const audioEnergyMod = (energy - 0.2) * 0.1; // Si energy=0.2 → mod=0
    const translatedEnergy = Math.max(0.1, Math.min(0.5, config.baseEnergy + audioEnergyMod));
    // ═══════════════════════════════════════════════════════════════════════
    // 6. CONSTRUIR OUTPUT
    // ═══════════════════════════════════════════════════════════════════════
    return {
        // Moduladores de color
        hueInfluence: smoothedHue,
        hueInfluenceStrength: influenceStrength,
        saturationMod,
        lightnessMod,
        // Contexto musical traducido
        translatedSection: config.section,
        translatedEnergy,
        translatedEmotion: config.emotion,
        // Metadatos
        depth,
        zone,
        tidePhase,
        breathingFactor: smoothedBreathing,
    };
}
// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Resetea el estado de smoothing (útil al cambiar de vibe)
 */
export function resetOceanicSmoothing() {
    smoothingState.energyHistory = [];
    smoothingState.hueHistory = [];
    smoothingState.lastUpdate = 0;
}
/**
 * Obtiene la configuración de color de una zona (para debug/UI)
 */
export function getZoneConfig(zone) {
    return { ...ZONE_CONFIGS[zone] };
}
/**
 * Calcula la zona desde profundidad (helper)
 */
export function getZoneFromDepth(depth) {
    if (depth < 1000)
        return 'SHALLOWS';
    if (depth < 3000)
        return 'OCEAN';
    if (depth < 6000)
        return 'TWILIGHT';
    return 'MIDNIGHT';
}
