/**
 * 🌈 MUSIC TO LIGHT MAPPER
 * ========================
 * Traduce el contexto musical y la paleta a parámetros de iluminación concretos
 *
 * FLUJO:
 * MusicalContext + SelenePalette → LightingParameters → DMX
 *
 * Este es el puente entre el análisis musical y los fixtures físicos.
 * Traduce conceptos abstractos (mood, energía) a valores concretos (intensidad, velocidad).
 *
 * ⚠️ REGLA 2: Incluye mapFallback() para modo reactivo
 *
 * @module engines/musical/mapping/MusicToLightMapper
 */
import { EventEmitter } from 'events';
import { hslToRgb, } from './ProceduralPaletteGenerator';
// ============================================================
// CONSTANTES
// ============================================================
/**
 * Mapeo de sección a intensidad base
 */
const SECTION_TO_INTENSITY = {
    'intro': 80,
    'verse': 120,
    'pre_chorus': 160,
    'chorus': 220,
    'drop': 255,
    'buildup': 180,
    'breakdown': 100,
    'bridge': 140,
    'outro': 60,
    'unknown': 128,
};
/**
 * Mapeo de mood a velocidad de movimiento
 */
const MOOD_TO_MOVEMENT_SPEED = {
    'euphoric': 200,
    'aggressive': 220,
    'party': 180,
    'groovy': 150,
    'epic': 160,
    'chill': 60,
    'melancholic': 40,
    'intimate': 30,
    'neutral': 100,
};
/**
 * Mapeo de mood a tipo de movimiento
 */
const MOOD_TO_MOVEMENT_TYPE = {
    'euphoric': 'circle',
    'aggressive': 'random',
    'party': 'chase',
    'groovy': 'figure_eight',
    'epic': 'slow_pan',
    'chill': 'static',
    'melancholic': 'slow_tilt',
    'intimate': 'static',
    'neutral': 'slow_pan',
};
/**
 * Intensidad base por tipo de fixture
 */
const FIXTURE_BASE_INTENSITY = {
    'par': 1.0,
    'moving_head': 0.9,
    'strobe': 0.0, // Solo en beats/drops
    'bar': 0.8,
    'wash': 0.7,
    'spot': 0.85,
    'blinder': 0.0, // Solo en momentos de impacto
    'laser': 0.6,
};
/**
 * Qué color de la paleta usa cada fixture
 */
const FIXTURE_TO_PALETTE_COLOR = {
    'par': 'primary',
    'moving_head': 'secondary',
    'strobe': 'accent',
    'bar': 'primary',
    'wash': 'ambient',
    'spot': 'secondary',
    'blinder': 'accent',
    'laser': 'contrast',
};
// ============================================================
// CLASE PRINCIPAL
// ============================================================
/**
 * 🌈 MUSIC TO LIGHT MAPPER
 *
 * Traduce contexto musical y paleta a parámetros de iluminación.
 *
 * Eventos:
 * - 'suggestion': LightingSuggestion
 * - 'beat-effect': { fixture, params }
 * - 'drop-effect': { fixtures, params }
 */
export class MusicToLightMapper extends EventEmitter {
    constructor() {
        super();
        this.lastSuggestion = null;
        this.suggestionCount = 0;
        console.log('🌈 [LIGHT-MAPPER] Initialized - Ready to translate music to light');
    }
    // ============================================================
    // MÉTODO PRINCIPAL
    // ============================================================
    /**
     * 🌈 MAPEA MÚSICA A LUCES
     *
     * Método principal que genera sugerencias de iluminación.
     *
     * @param palette - Paleta de colores de Selene
     * @param context - Contexto musical actual
     * @returns LightingSuggestion - Parámetros para todos los fixtures
     */
    map(palette, context) {
        const suggestion = {
            timestamp: Date.now(),
            fixtures: this.generateAllFixtureParams(palette, context),
            mode: 'intelligent',
            confidence: palette.metadata.confidence,
            description: this.generateDescription(palette, context),
        };
        this.lastSuggestion = suggestion;
        this.suggestionCount++;
        this.emit('suggestion', suggestion);
        return suggestion;
    }
    /**
     * ⚠️ MODO FALLBACK - REGLA 2
     *
     * Mapeo reactivo cuando no hay suficiente confianza en el análisis.
     * Reacciona directamente al audio sin contexto musical.
     */
    mapFallback(audio) {
        // Generar colores basados en audio (sin paleta procedural)
        const reactiveParams = this.generateReactiveParams(audio);
        const suggestion = {
            timestamp: Date.now(),
            fixtures: reactiveParams,
            mode: 'reactive',
            confidence: 0.3, // Baja confianza en modo reactivo
            description: 'Modo Reactivo - Bass→Pulso, Treble→Shimmer, Beat→Flash',
        };
        this.lastSuggestion = suggestion;
        this.suggestionCount++;
        this.emit('suggestion', suggestion);
        return suggestion;
    }
    // ============================================================
    // GENERACIÓN DE PARÁMETROS
    // ============================================================
    /**
     * Genera parámetros para todos los tipos de fixture
     */
    generateAllFixtureParams(palette, context) {
        const fixtureTypes = [
            'par', 'moving_head', 'strobe', 'bar', 'wash', 'spot', 'blinder', 'laser'
        ];
        const result = {};
        for (const fixtureType of fixtureTypes) {
            result[fixtureType] = this.generateFixtureParams(fixtureType, palette, context);
        }
        return result;
    }
    /**
     * Genera parámetros para un tipo de fixture específico
     */
    generateFixtureParams(fixtureType, palette, context) {
        // 1. Obtener color de la paleta según el fixture
        const paletteKey = FIXTURE_TO_PALETTE_COLOR[fixtureType];
        const hslColor = palette[paletteKey];
        const rgbColor = hslToRgb(hslColor);
        // 2. Calcular intensidad base según sección
        const sectionIntensity = SECTION_TO_INTENSITY[context.section] ?? 128;
        const fixtureMultiplier = FIXTURE_BASE_INTENSITY[fixtureType];
        const intensity = Math.round(sectionIntensity * fixtureMultiplier);
        // 3. Calcular dimmer (afectado por energía)
        const dimmer = Math.round(intensity * (0.5 + context.energy * 0.5));
        // 4. Strobe solo en momentos de alta energía o drops
        let strobe = 0;
        if (fixtureType === 'strobe' || fixtureType === 'blinder') {
            if (context.section === 'drop' || context.fillInProgress) {
                strobe = Math.round(150 + context.energy * 100);
            }
        }
        // 5. Movimiento según mood
        const movement = MOOD_TO_MOVEMENT_TYPE[context.mood] ?? 'static';
        const movementSpeed = MOOD_TO_MOVEMENT_SPEED[context.mood] ?? 100;
        // 6. Gobo speed basado en BPM simulado (sincopación)
        const goboSpeed = Math.round(50 + context.syncopation * 150);
        return {
            color: rgbColor,
            intensity,
            dimmer,
            strobe,
            goboSpeed,
            movement,
            movementSpeed: Math.round(movementSpeed * (0.7 + context.energy * 0.3)),
        };
    }
    /**
     * Genera parámetros reactivos (modo fallback)
     * V17 Style: Bass→Pulso, Treble→Shimmer, Beat→Flash
     */
    generateReactiveParams(audio) {
        // Colores reactivos basados en frecuencias
        const bassColor = {
            r: Math.round(200 + audio.bass * 55),
            g: Math.round(50 * (1 - audio.bass)),
            b: Math.round(100 + audio.bass * 100),
        };
        const trebleColor = {
            r: Math.round(100 + audio.treble * 100),
            g: Math.round(150 + audio.treble * 105),
            b: Math.round(200 + audio.treble * 55),
        };
        const midColor = {
            r: Math.round(150 + audio.mid * 50),
            g: Math.round(100 + audio.mid * 100),
            b: Math.round(50 + audio.mid * 50),
        };
        const baseIntensity = Math.round(100 + audio.energy * 155);
        const beatStrobe = audio.beatDetected ? 200 : 0;
        return {
            'par': {
                color: bassColor,
                intensity: baseIntensity,
                dimmer: Math.round(baseIntensity * audio.bass),
                strobe: 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            'moving_head': {
                color: midColor,
                intensity: Math.round(baseIntensity * 0.9),
                dimmer: Math.round(baseIntensity * audio.mid),
                strobe: 0,
                goboSpeed: Math.round((audio.syncopation ?? 0.3) * 100),
                movement: audio.energy > 0.6 ? 'chase' : 'slow_pan',
                movementSpeed: Math.round(50 + audio.energy * 150),
            },
            'strobe': {
                color: { r: 255, g: 255, b: 255 },
                intensity: beatStrobe,
                dimmer: beatStrobe,
                strobe: audio.beatDetected ? 255 : 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            'bar': {
                color: trebleColor,
                intensity: Math.round(baseIntensity * 0.8),
                dimmer: Math.round(baseIntensity * audio.treble),
                strobe: 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            'wash': {
                color: bassColor,
                intensity: Math.round(baseIntensity * 0.6),
                dimmer: Math.round(baseIntensity * 0.5),
                strobe: 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            'spot': {
                color: midColor,
                intensity: Math.round(baseIntensity * 0.85),
                dimmer: Math.round(baseIntensity * audio.mid),
                strobe: 0,
                goboSpeed: Math.round((audio.syncopation ?? 0.3) * 80),
                movement: 'sync_beat',
                movementSpeed: Math.round(100 + audio.energy * 100),
            },
            'blinder': {
                color: { r: 255, g: 255, b: 255 },
                intensity: audio.beatDetected && audio.energy > 0.8 ? 255 : 0,
                dimmer: audio.beatDetected && audio.energy > 0.8 ? 255 : 0,
                strobe: 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            'laser': {
                color: trebleColor,
                intensity: Math.round(baseIntensity * 0.6),
                dimmer: Math.round(baseIntensity * audio.treble * 0.6),
                strobe: 0,
                goboSpeed: Math.round(50 + audio.bpm / 2),
                movement: audio.energy > 0.5 ? 'random' : 'slow_pan',
                movementSpeed: Math.round(audio.bpm / 2),
            },
        };
    }
    // ============================================================
    // EFECTOS ESPECIALES
    // ============================================================
    /**
     * Genera efecto de beat (flash en el beat)
     */
    generateBeatEffect(palette, intensity = 1.0) {
        const accentRgb = hslToRgb(palette.accent);
        const params = {
            color: accentRgb,
            intensity: Math.round(255 * intensity),
            dimmer: Math.round(255 * intensity),
            strobe: 200,
            goboSpeed: 0,
            movement: 'static',
            movementSpeed: 0,
        };
        this.emit('beat-effect', { fixture: 'strobe', params });
        return params;
    }
    /**
     * Genera efecto de drop (impacto máximo)
     */
    generateDropEffect(palette) {
        const accentRgb = hslToRgb(palette.accent);
        const secondaryRgb = hslToRgb(palette.secondary);
        const effects = {
            strobe: {
                color: { r: 255, g: 255, b: 255 },
                intensity: 255,
                dimmer: 255,
                strobe: 255,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            blinder: {
                color: accentRgb,
                intensity: 255,
                dimmer: 255,
                strobe: 0,
                goboSpeed: 0,
                movement: 'static',
                movementSpeed: 0,
            },
            moving_head: {
                color: secondaryRgb,
                intensity: 255,
                dimmer: 255,
                strobe: 0,
                goboSpeed: 255,
                movement: 'chase',
                movementSpeed: 255,
            },
        };
        this.emit('drop-effect', { fixtures: effects });
        return effects;
    }
    // ============================================================
    // UTILIDADES
    // ============================================================
    /**
     * Genera descripción legible de la sugerencia
     */
    generateDescription(palette, context) {
        return `${palette.metadata.description} | ${context.section} | ${context.mood}`;
    }
    /**
     * Obtiene la última sugerencia
     */
    getLastSuggestion() {
        return this.lastSuggestion;
    }
    /**
     * Obtiene el contador de sugerencias
     */
    getSuggestionCount() {
        return this.suggestionCount;
    }
    /**
     * Reset del estado
     */
    reset() {
        this.lastSuggestion = null;
        this.suggestionCount = 0;
        console.log('🌈 [LIGHT-MAPPER] Reset');
    }
    /**
     * Obtiene estadísticas
     */
    getStats() {
        return {
            suggestionCount: this.suggestionCount,
            lastSuggestionAge: this.lastSuggestion
                ? Date.now() - this.lastSuggestion.timestamp
                : null,
            lastMode: this.lastSuggestion?.mode ?? null,
        };
    }
}
// ============================================================
// EXPORTS
// ============================================================
/**
 * Factory function
 */
export function createMusicToLightMapper() {
    return new MusicToLightMapper();
}
// Re-export constantes para testing
export const MAPPING_CONSTANTS = {
    SECTION_TO_INTENSITY,
    MOOD_TO_MOVEMENT_SPEED,
    MOOD_TO_MOVEMENT_TYPE,
    FIXTURE_BASE_INTENSITY,
    FIXTURE_TO_PALETTE_COLOR,
};
