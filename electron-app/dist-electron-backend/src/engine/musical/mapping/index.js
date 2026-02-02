/**
 * 🎨 MAPPING MODULE
 * =================
 * Traducción de análisis musical a decisiones de iluminación
 *
 * Componentes:
 * - ProceduralPaletteGenerator: Genera paletas basadas en ADN musical (sinestesia)
 * - PaletteManager: Gestiona transiciones con histéresis anti-flicker
 * - MusicToLightMapper: Traduce paleta + contexto a parámetros de fixtures
 *
 * PRINCIPIO FUNDAMENTAL:
 * "No le decimos a Selene qué colores usar.
 *  Le enseñamos a SENTIR la música y PINTAR lo que siente."
 *
 * @module engines/musical/mapping
 */
// ============================================================
// PROCEDURAL PALETTE GENERATOR
// ============================================================
export { ProceduralPaletteGenerator, createProceduralPaletteGenerator, hslToRgb, hslToHex, CONSTANTS as PALETTE_CONSTANTS, } from './ProceduralPaletteGenerator';
// ============================================================
// PALETTE MANAGER
// ============================================================
export { PaletteManager, createPaletteManager, } from './PaletteManager';
// ============================================================
// MUSIC TO LIGHT MAPPER
// ============================================================
export { MusicToLightMapper, createMusicToLightMapper, MAPPING_CONSTANTS, } from './MusicToLightMapper';
