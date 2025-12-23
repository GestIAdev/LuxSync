/**
 * 🎨 VISUAL ENGINES - Index
 * Sub-motores de generación visual
 */

export { ColorEngine } from './ColorEngine'
export { MovementEngine } from './MovementEngine'
export { EffectsEngine } from './EffectsEngine'

// WAVE 68.5: Motor de color PURO (sin género)
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
  // Constantes (matemática musical pura)
  KEY_TO_HUE,
  MOOD_HUES,
  MODE_MODIFIERS,
  PHI_ROTATION,
} from './SeleneColorEngine'
