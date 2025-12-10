/**
 * 🎨 VISUAL ENGINES - Index
 * Sub-motores de generación visual
 */

export { ColorEngine } from './ColorEngine'
export { MovementEngine } from './MovementEngine'
export { EffectsEngine } from './EffectsEngine'

// WAVE 17.2: Nuevo motor de color procedural
export { 
  SeleneColorEngine,
  // Tipos
  type HSLColor,
  type RGBColor,
  type SelenePalette,
  type PaletteMeta,
  type ExtendedAudioAnalysis,
  // Utilidades
  hslToRgb,
  rgbToHsl,
  paletteToRgb,
  normalizeHue,
  clamp,
  mapRange,
  // Constantes
  KEY_TO_HUE,
  MOOD_HUES,
  MODE_MODIFIERS,
  MACRO_GENRES,
  GENRE_MAP,
  PHI_ROTATION,
} from './SeleneColorEngine'
