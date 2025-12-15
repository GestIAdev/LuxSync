/**
 * 🎨 SELENE COLOR ENGINE (WAVE 17.2)
 * ===================================
 * Motor procedural determinista para generación de paletas cromáticas
 * basado en teoría musical, sinestesia y corrección por macro-género.
 * 
 * FILOSOFÍA:
 * "Selene NO pinta GÉNEROS. Selene pinta MATEMÁTICA MUSICAL.
 *  Pero puede GUIAR la paleta según macro-género SIN FORZARLA."
 * 
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (KEY_TO_HUE)
 * - Modo → Temperatura emocional (MODE_MODIFIERS)
 * - Energía → Saturación y Brillo (NUNCA cambia el Hue)
 * - Syncopation → Estrategia de contraste
 * - Macro-Género → Bias de temperatura y saturación (subtle)
 * - Rotación Fibonacci (φ × 360° ≈ 222.5°) → Color secundario
 * 
 * REGLA DE ORO:
 *   finalHue = KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hueDelta + GENRE.tempBias
 *   energía SOLO afecta saturación y brillo, NUNCA el hue base
 * 
 * @see docs/JSON-ANALYZER-PROTOCOL.md - Protocolo de entrada
 * @see docs/WAVE-17-SELENE-COLOR-MIND-AUDIT.md - Arquitectura completa
 * @see docs/WAVE-17.1-MACRO-GENRES-MASTER-PLAN.md - Sistema de géneros
 * 
 * @module engines/visual/SeleneColorEngine
 * @version 17.2.0
 */

// ============================================================
// 1. INTERFACES & TIPOS
// ============================================================

/**
 * Color en formato HSL (Hue, Saturation, Lightness)
 */
export interface HSLColor {
  /** Matiz: 0-360 grados en el círculo cromático */
  h: number;
  /** Saturación: 0-100% */
  s: number;
  /** Luminosidad: 0-100% */
  l: number;
}

/**
 * Color en formato RGB (Red, Green, Blue)
 */
export interface RGBColor {
  /** Rojo: 0-255 */
  r: number;
  /** Verde: 0-255 */
  g: number;
  /** Azul: 0-255 */
  b: number;
}

/**
 * Paleta cromática completa generada por Selene
 */
export interface SelenePalette {
  /** Color principal - PARs, wash general */
  primary: HSLColor;
  /** Color secundario - Back PARs, Fibonacci rotation */
  secondary: HSLColor;
  /** Color de acento - Moving heads, beams, highlights */
  accent: HSLColor;
  /** Color de ambiente - Fills, backlighting suave */
  ambient: HSLColor;
  /** Color de contraste - Siluetas, sombras */
  contrast: HSLColor;
  /** Metadata de la paleta */
  meta: PaletteMeta;
}

/**
 * Metadata de la paleta generada
 */
export interface PaletteMeta {
  /** Macro-género detectado */
  macroGenre: string;
  /** Estrategia de contraste usada */
  strategy: 'analogous' | 'triadic' | 'complementary';
  /** Temperatura visual de la paleta */
  temperature: 'warm' | 'cool' | 'neutral';
  /** Descripción legible */
  description: string;
  /** Confianza en la paleta (0-1) */
  confidence: number;
  /** Velocidad de transición sugerida (ms) */
  transitionSpeed: number;
}

/**
 * Salida de armonía del analizador Wave 8
 */
export interface HarmonyOutput {
  /** Tonalidad: "C", "D#", "A", etc. o null */
  key: string | null;
  /** Modo/escala: "major", "minor", "dorian", etc. */
  mode: string;
  /** Mood detectado */
  mood: string;
  /** Temperatura emocional */
  temperature?: 'warm' | 'cool' | 'neutral';
  /** Nivel de disonancia (0-1) */
  dissonance?: number;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Salida de ritmo del analizador Wave 8
 */
export interface RhythmOutput {
  /** Patrón rítmico detectado */
  pattern?: string;
  /** Nivel de sincopación (0-1) - CRÍTICO para género */
  syncopation: number;
  /** Groove/feel (0-1) */
  groove?: number;
  /** Subdivisión del beat */
  subdivision?: 4 | 8 | 16;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Salida de género del analizador Wave 8
 */
export interface GenreOutput {
  /** Género primario detectado */
  primary: string;
  /** Género secundario (fusion) */
  secondary?: string | null;
  /** Confianza (0-1) */
  confidence?: number;
  /** Scores de todos los géneros */
  scores?: Record<string, number>;
}

/**
 * Salida de sección del analizador Wave 8
 */
export interface SectionOutput {
  /** Tipo de sección actual */
  type: string;
  /** Energía de la sección (0-1) */
  energy?: number;
  /** Probabilidad de transición (0-1) */
  transitionLikelihood?: number;
  /** Confianza (0-1) */
  confidence?: number;
}

/**
 * Análisis de audio extendido (entrada del motor)
 * Compatible con el protocolo JSON documentado
 */
export interface ExtendedAudioAnalysis {
  /** Timestamp del análisis */
  timestamp?: number;
  /** Frame ID */
  frameId?: number;
  
  // === TRINITY CORE ===
  /** BPM detectado (60-200) */
  bpm?: number;
  /** Confianza del BPM (0-1) */
  bpmConfidence?: number;
  /** Si estamos en un beat */
  onBeat?: boolean;
  /** Fase del beat (0-1) */
  beatPhase?: number;
  /** Fuerza del beat (0-1) */
  beatStrength?: number;
  
  // === SPECTRUM ===
  /** Energía de bajos (0-1) */
  bass?: number;
  /** Energía de medios (0-1) */
  mid?: number;
  /** Energía de agudos (0-1) */
  treble?: number;
  
  // === TOP-LEVEL (ACCESO RÁPIDO) ===
  /** Sincopación (0-1) - duplicado de wave8.rhythm.syncopation */
  syncopation?: number;
  /** Groove (0-1) */
  groove?: number;
  /** Subdivisión */
  subdivision?: 4 | 8 | 16;
  /** Mood simplificado */
  mood?: 'dark' | 'bright' | 'neutral';
  /** Key simplificada */
  key?: string;
  /** Energía normalizada (0-1) - CRÍTICO */
  energy: number;
  
  // === WAVE 8 RICH DATA ===
  wave8?: {
    rhythm: RhythmOutput;
    harmony: HarmonyOutput;
    section: SectionOutput;
    genre: GenreOutput;
  };
}

// ============================================================
// 2. CONSTANTES - EL CORAZÓN DE LA FÓRMULA CROMÁTICA
// ============================================================

/**
 * 🌀 ROTACIÓN FIBONACCI (Proporción Áurea)
 * φ × 360° ≈ 222.492° → Rotación para color secundario
 * Garantiza variedad infinita sin repetición visual
 */
const PHI = 1.618033988749895;
const PHI_ROTATION = (PHI * 360) % 360; // ≈ 222.5°

/**
 * 🎵 CÍRCULO DE QUINTAS → CÍRCULO CROMÁTICO
 * 
 * Mapeo sinestésico de notas musicales a ángulos HSL.
 * Basado en psicoacústica y sinestesia cromática.
 * 
 * Do (C) = Rojo (0°) - Fundamental, primario
 * La (A) = Índigo (270°) - 440Hz, referencia
 */
const KEY_TO_HUE: Record<string, number> = {
  // Naturales
  'C': 0,       // Do - Rojo
  'D': 60,      // Re - Naranja
  'E': 120,     // Mi - Amarillo
  'F': 150,     // Fa - Verde-Amarillo
  'G': 210,     // Sol - Cyan
  'A': 270,     // La - Índigo
  'B': 330,     // Si - Magenta
  
  // Sostenidos
  'C#': 30,     // Do# - Rojo-Naranja
  'D#': 90,     // Re# - Amarillo-Naranja
  'F#': 180,    // Fa# - Verde (tritono de C)
  'G#': 240,    // Sol# - Azul
  'A#': 300,    // La# - Violeta
  
  // Bemoles (equivalentes enarmónicos)
  'Db': 30,
  'Eb': 90,
  'Gb': 180,
  'Ab': 240,
  'Bb': 300,
};

/**
 * 🎭 MAPEO DE MOOD → HUE BASE
 * Usado cuando la key no está disponible
 */
const MOOD_HUES: Record<string, number> = {
  'happy': 50,          // Amarillo-Naranja (alegría)
  'sad': 240,           // Azul (tristeza)
  'tense': 0,           // Rojo (tensión)
  'dreamy': 280,        // Violeta (ensueño)
  'bluesy': 30,         // Naranja oscuro (blues)
  'jazzy': 260,         // Índigo (jazz)
  'spanish_exotic': 15, // Rojo-Naranja (flamenco)
  'universal': 120,     // Verde (neutro)
  
  // Moods simples del top-level
  'dark': 240,          // Azul oscuro
  'bright': 50,         // Amarillo
  'neutral': 120,       // Verde
};

/**
 * 🌡️ MODIFICADORES DE MODO MUSICAL
 * 
 * Cada modo tiene una "temperatura" emocional que modifica
 * la saturación, luminosidad y hue del color base.
 */
interface ModeModifier {
  /** Delta de Hue en grados */
  hue: number;
  /** Delta de Saturación en % */
  sat: number;
  /** Delta de Luminosidad en % */
  light: number;
  /** Descripción del mood */
  description: string;
}

const MODE_MODIFIERS: Record<string, ModeModifier> = {
  // Modos Mayores - Cálidos y brillantes
  'major': { 
    hue: 15, sat: 10, light: 10,
    description: 'Alegre y brillante'
  },
  'ionian': { 
    hue: 15, sat: 10, light: 10,
    description: 'Alegre y brillante'
  },
  'lydian': { 
    hue: 20, sat: 15, light: 15,
    description: 'Etéreo y soñador'
  },
  'mixolydian': { 
    hue: 10, sat: 10, light: 5,
    description: 'Funky y cálido'
  },
  
  // Modos Menores - Fríos y profundos
  'minor': { 
    hue: -15, sat: -10, light: -10,
    description: 'Triste y melancólico'
  },
  'aeolian': { 
    hue: -15, sat: -10, light: -10,
    description: 'Triste y melancólico'
  },
  'dorian': { 
    hue: -5, sat: 0, light: 0,
    description: 'Jazzy y sofisticado'
  },
  'phrygian': { 
    hue: -20, sat: 5, light: -10,
    description: 'Español y tenso'
  },
  'locrian': { 
    hue: -30, sat: -15, light: -20,
    description: 'Oscuro y disonante'
  },
  
  // Escalas Especiales
  'harmonic_minor': { 
    hue: -10, sat: -5, light: -10,
    description: 'Dramático y exótico'
  },
  'melodic_minor': { 
    hue: -5, sat: 0, light: -5,
    description: 'Jazz avanzado'
  },
  'pentatonic_major': { 
    hue: 10, sat: 10, light: 5,
    description: 'Simple y folk'
  },
  'pentatonic_minor': { 
    hue: 0, sat: 5, light: -5,
    description: 'Blues y rock'
  },
  'blues': { 
    hue: -10, sat: 5, light: -10,
    description: 'Bluesy y soul'
  },
};

// ============================================================
// 3. SISTEMA DE MACRO-GÉNEROS
// ============================================================

/**
 * Perfil de modificación por macro-género
 */
interface GenreProfile {
  /** Bias de temperatura (-30 a +30 grados de hue) */
  tempBias: number;
  /** Boost de saturación (-20 a +20%) */
  satBoost: number;
  /** Boost de luminosidad (-20 a +20%) */
  lightBoost: number;
  /** Estrategia de contraste */
  contrast: 'analogous' | 'triadic' | 'complementary' | 'adaptive';
  /** Brillo mínimo garantizado */
  minLight: number;
  /** Brillo máximo permitido */
  maxLight: number;
  /** Velocidad de transición base (ms) */
  transitionSpeed: number;
  /** Descripción del perfil */
  description: string;
}

/**
 * 🎭 PERFILES DE MACRO-GÉNEROS
 * 
 * 5 macro-géneros que cubren el 95% de la música comercial.
 * Cada uno guía sutilmente la paleta sin forzarla.
 */
const MACRO_GENRES: Record<string, GenreProfile> = {
  /**
   * ELECTRONIC_4X4: Techno, House, Trance
   * - Sincopation < 0.30 (metrónomo, kicks on-beat)
   * - FRÍO, HIPNÓTICO, MINIMALISTA
   */
  'ELECTRONIC_4X4': {
    tempBias: -15,        // Shift hacia azules/violetas
    satBoost: -10,        // Menos saturado (hipnótico)
    lightBoost: -10,      // Oscuro, underground
    contrast: 'analogous', // Colores vecinos (±30°)
    minLight: 25,
    maxLight: 65,
    transitionSpeed: 1500, // Lento, fluido
    description: 'Frío, hipnótico, minimalista',
  },
  
  /**
   * ELECTRONIC_BREAKS: Drum & Bass, Dubstep, Jungle
   * - Sincopation > 0.50 (breakbeats, off-beat)
   * - TENSO, CAÓTICO, ENERGÉTICO
   */
  'ELECTRONIC_BREAKS': {
    tempBias: 0,           // Neutro
    satBoost: 5,           // Moderadamente saturado
    lightBoost: -5,        // Ligeramente oscuro
    contrast: 'triadic',   // Triángulo de colores (±120°)
    minLight: 30,
    maxLight: 70,
    transitionSpeed: 800,  // Rápido, frenético
    description: 'Tenso, caótico, industrial',
  },
  
  /**
   * LATINO_TRADICIONAL: Cumbia, Salsa, Merengue
   * - Sincopation > 0.30 (off-beat latino)
   * - CÁLIDO, FESTIVO, EXPLOSIVO
   */
  'LATINO_TRADICIONAL': {
    tempBias: 25,          // MÁXIMO shift hacia cálidos
    satBoost: 20,          // MUY saturado (festivo)
    lightBoost: 15,        // Brillante, vibrante
    contrast: 'complementary', // Colores opuestos (180°)
    minLight: 45,
    maxLight: 80,
    transitionSpeed: 1000, // Moderado, rítmico
    description: 'Cálido, festivo, explosivo',
  },
  
  /**
   * LATINO_URBANO: Reggaeton, Trap Latino, Dembow
   * - Sincopation > 0.25 (patrón dembow)
   * - OSCURO, URBANO, POTENTE
   */
  'LATINO_URBANO': {
    tempBias: 10,          // Cálido pero no tanto
    satBoost: 10,          // Saturado controlado
    lightBoost: 0,         // Moderado
    contrast: 'triadic',   // Mix electrónico + latino
    minLight: 35,
    maxLight: 70,
    transitionSpeed: 1200, // Moderado-lento
    description: 'Oscuro, urbano, pesado',
  },
  
  /**
   * ELECTROLATINO: Pop, Fusion, Afro House, Tropical
   * - Sincopation 0.20-0.40 (borderline)
   * - FLEXIBLE, ADAPTATIVO
   */
  'ELECTROLATINO': {
    tempBias: 0,           // Neutro (no forzar)
    satBoost: 0,           // Neutro
    lightBoost: 0,         // Neutro
    contrast: 'adaptive',  // Según energía
    minLight: 35,
    maxLight: 75,
    transitionSpeed: 1000, // Moderado
    description: 'Flexible, adaptativo, fusion',
  },
};

/**
 * 🗺️ MAPEO DE GÉNEROS DETALLADOS → MACRO-GÉNEROS
 */
const GENRE_MAP: Record<string, string> = {
  // ELECTRONIC_4X4
  'techno': 'ELECTRONIC_4X4',
  'house': 'ELECTRONIC_4X4',
  'trance': 'ELECTRONIC_4X4',
  'minimal': 'ELECTRONIC_4X4',
  'four_on_floor': 'ELECTRONIC_4X4',
  'cyberpunk': 'ELECTRONIC_4X4',
  
  // ELECTRONIC_BREAKS
  'drum_and_bass': 'ELECTRONIC_BREAKS',
  'dnb': 'ELECTRONIC_BREAKS',
  'dubstep': 'ELECTRONIC_BREAKS',
  'jungle': 'ELECTRONIC_BREAKS',
  'breakbeat': 'ELECTRONIC_BREAKS',
  'breaks': 'ELECTRONIC_BREAKS',
  
  // LATINO_TRADICIONAL
  'cumbia': 'LATINO_TRADICIONAL',
  'salsa': 'LATINO_TRADICIONAL',
  'merengue': 'LATINO_TRADICIONAL',
  'bachata': 'LATINO_TRADICIONAL',
  'vallenato': 'LATINO_TRADICIONAL',
  
  // LATINO_URBANO
  'reggaeton': 'LATINO_URBANO',
  'trap': 'LATINO_URBANO',
  'dembow': 'LATINO_URBANO',
  'perreo': 'LATINO_URBANO',
  
  // ELECTROLATINO (catch-all fusion)
  'latin_pop': 'ELECTROLATINO',
  'pop': 'ELECTROLATINO',
  'afro_house': 'ELECTROLATINO',
  'tropical': 'ELECTROLATINO',
  'moombahton': 'ELECTROLATINO',
  'unknown': 'ELECTROLATINO',
};

/**
 * Perfil por defecto cuando no hay género detectado
 */
const DEFAULT_GENRE = 'ELECTROLATINO';

// ============================================================
// 4. UTILIDADES
// ============================================================

/**
 * Normaliza un valor de hue al rango 0-360
 */
function normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

/**
 * Clamp un valor entre min y max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Mapea un valor de un rango a otro
 */
function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

/**
 * Convierte HSL a RGB
 * @see https://www.w3.org/TR/css-color-4/#hsl-to-rgb
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convierte RGB a HSL
 */
export function rgbToHsl(rgb: RGBColor): HSLColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  let h = 0;
  let s = 0;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convierte paleta HSL completa a RGB
 */
export function paletteToRgb(palette: SelenePalette): {
  primary: RGBColor;
  secondary: RGBColor;
  accent: RGBColor;
  ambient: RGBColor;
  contrast: RGBColor;
} {
  return {
    primary: hslToRgb(palette.primary),
    secondary: hslToRgb(palette.secondary),
    accent: hslToRgb(palette.accent),
    ambient: hslToRgb(palette.ambient),
    contrast: hslToRgb(palette.contrast),
  };
}

// ============================================================
// 5. LA CLASE PRINCIPAL - SELENE COLOR ENGINE
// ============================================================

/**
 * 🎨 SELENE COLOR ENGINE
 * 
 * Motor procedural determinista para generación de paletas cromáticas.
 * Convierte análisis musical en colores coherentes.
 * 
 * @example
 * ```typescript
 * const palette = SeleneColorEngine.generate({
 *   energy: 0.34,
 *   wave8: {
 *     harmony: { key: 'A', mode: 'minor', mood: 'tense' },
 *     rhythm: { syncopation: 0.27 },
 *     genre: { primary: 'techno' },
 *     section: { type: 'drop' }
 *   }
 * });
 * 
 * console.log(palette.primary); // { h: 255, s: 57, l: 40 }
 * console.log(palette.meta.macroGenre); // 'ELECTRONIC_4X4'
 * ```
 */
export class SeleneColorEngine {
  
  /**
   * Genera una paleta cromática completa a partir del análisis de audio
   * 
   * @param data - Análisis de audio extendido (ExtendedAudioAnalysis)
   * @returns Paleta de 5 colores HSL con metadata
   */
  static generate(data: ExtendedAudioAnalysis): SelenePalette {
    // === A. EXTRAER DATOS CON FALLBACKS ===
    const wave8 = data.wave8 || {
      harmony: { key: null, mode: 'minor', mood: 'universal' },
      rhythm: { syncopation: 0 },
      genre: { primary: 'unknown' },
      section: { type: 'unknown' },
    };
    
    const key = wave8.harmony.key || data.key || null;
    const mode = wave8.harmony.mode || 'minor';
    const mood = wave8.harmony.mood || data.mood || 'universal';
    const syncopation = wave8.rhythm.syncopation ?? data.syncopation ?? 0;
    const genrePrimary = wave8.genre.primary || 'unknown';
    const energy = clamp(data.energy ?? 0.5, 0, 1);
    const genreConfidence = wave8.genre.confidence ?? 0.5;
    
    // === B. DETECTAR MACRO-GÉNERO ===
    const macroId = GENRE_MAP[genrePrimary.toLowerCase()] || DEFAULT_GENRE;
    const profile = MACRO_GENRES[macroId];
    
    // === C. DETERMINAR HUE BASE (Matemática Pura) ===
    // Prioridad: KEY > MOOD > DEFAULT
    let baseHue = 120; // Default: Verde (neutro)
    let hueSource = 'default';
    
    if (key && KEY_TO_HUE[key] !== undefined) {
      baseHue = KEY_TO_HUE[key];
      hueSource = `key:${key}`;
    } else if (mood && MOOD_HUES[mood] !== undefined) {
      baseHue = MOOD_HUES[mood];
      hueSource = `mood:${mood}`;
    }
    
    // === D. APLICAR MODIFICADORES ===
    // Orden: Base + Mode + Genre
    const modeMod = MODE_MODIFIERS[mode] || MODE_MODIFIERS['minor'];
    
    // El Hue final es la suma de: Base + Modo + Género (tempBias)
    const finalHue = normalizeHue(
      baseHue + modeMod.hue + profile.tempBias
    );
    
    // === E. ENERGÍA → SATURACIÓN Y BRILLO ===
    // REGLA DE ORO: Energía NUNCA modifica el Hue, solo S y L
    // Energy 0.0 → Sat 40%, Light 25%
    // Energy 1.0 → Sat 100%, Light 95%
    const baseSat = 40 + (energy * 60);  // 40-100%
    const baseLight = 25 + (energy * 70); // 25-95% (WAVE 24.5.2: Rango más dinámico)
    
    // Aplicar modifiers
    const primarySat = clamp(
      baseSat + modeMod.sat + profile.satBoost,
      20,
      100
    );
    
    const primaryLight = clamp(
      baseLight + modeMod.light + profile.lightBoost,
      profile.minLight,
      profile.maxLight
    );
    
    // === F. COLOR PRIMARIO ===
    const primary: HSLColor = {
      h: finalHue,
      s: primarySat,
      l: primaryLight,
    };
    
    // === G. COLOR SECUNDARIO (Rotación Fibonacci) ===
    // φ × 360° ≈ 222.5° garantiza variedad infinita
    const secondaryHue = normalizeHue(finalHue + PHI_ROTATION);
    const secondary: HSLColor = {
      h: secondaryHue,
      s: clamp(primarySat + 5, 20, 100),  // Ligeramente más saturado
      l: clamp(primaryLight - 10, 20, 80), // Ligeramente más oscuro
    };
    
    // === H. COLOR DE ACENTO (Estrategia de Contraste) ===
    let accentHue: number;
    let strategy = profile.contrast;
    
    // Adaptive: decidir según syncopation
    if (strategy === 'adaptive') {
      if (syncopation < 0.30) {
        strategy = 'analogous';
      } else if (syncopation < 0.50) {
        strategy = 'triadic';
      } else {
        strategy = 'complementary';
      }
    }
    
    // Aplicar estrategia
    switch (strategy) {
      case 'complementary':
        accentHue = finalHue + 180;  // Opuesto
        break;
      case 'triadic':
        accentHue = finalHue + 120;  // Triángulo
        break;
      case 'analogous':
      default:
        accentHue = finalHue + 30;   // Vecino
        break;
    }
    
    const accent: HSLColor = {
      h: normalizeHue(accentHue),
      s: 100,  // Beams siempre a máxima saturación
      l: Math.max(70, primaryLight + 20), // Siempre brillante
    };
    
    // === I. COLOR AMBIENTE (Fills, desaturado) ===
    const ambient: HSLColor = {
      h: finalHue,
      s: Math.max(15, primarySat * 0.4),  // 40% de saturación
      l: Math.max(15, primaryLight * 0.4), // 40% de brillo
    };
    
    // === J. COLOR CONTRASTE (Siluetas, muy oscuro) ===
    const contrast: HSLColor = {
      h: normalizeHue(finalHue + 180),
      s: 30,
      l: 10,
    };
    
    // === K. DETERMINAR TEMPERATURA VISUAL ===
    // Hue 0-60 y 300-360 = warm (reds, oranges, magentas)
    // Hue 180-300 = cool (cyans, blues, purples)
    // Hue 60-180 con tempBias > 0 = warm (hot oranges/yellows)
    let temperature: 'warm' | 'cool' | 'neutral';
    if ((finalHue >= 0 && finalHue <= 60) || (finalHue > 120 && finalHue < 180) || finalHue >= 300) {
      temperature = 'warm';
    } else if ((finalHue > 60 && finalHue <= 120) && profile.tempBias > 0) {
      temperature = 'warm'; // Naranja cálido (Latino)
    } else if (finalHue >= 180 && finalHue < 300) {
      temperature = 'cool';
    } else {
      temperature = 'neutral';
    }
    
    // === L. CALCULAR VELOCIDAD DE TRANSICIÓN ===
    // Alta energía = transiciones rápidas
    // Baja energía = transiciones lentas
    const transitionSpeed = mapRange(
      energy,
      0, 1,
      profile.transitionSpeed * 1.5,  // Lento
      profile.transitionSpeed * 0.5   // Rápido
    );
    
    // === M. CONSTRUIR DESCRIPCIÓN ===
    const description = [
      key ? `${key} ${mode}` : mood,
      `(${profile.description})`,
      `E=${(energy * 100).toFixed(0)}%`,
      `S=${(syncopation * 100).toFixed(0)}%`,
    ].join(' ');
    
    // === N. RETORNAR PALETA COMPLETA ===
    return {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      meta: {
        macroGenre: macroId,
        strategy: strategy as 'analogous' | 'triadic' | 'complementary',
        temperature,
        description,
        confidence: genreConfidence,
        transitionSpeed: Math.round(transitionSpeed),
      },
    };
  }
  
  /**
   * Genera paleta y convierte a RGB en un solo paso
   */
  static generateRgb(data: ExtendedAudioAnalysis): {
    primary: RGBColor;
    secondary: RGBColor;
    accent: RGBColor;
    ambient: RGBColor;
    contrast: RGBColor;
    meta: PaletteMeta;
  } {
    const palette = this.generate(data);
    return {
      ...paletteToRgb(palette),
      meta: palette.meta,
    };
  }
  
  /**
   * Mapea un género detallado a su macro-género correspondiente
   */
  static mapToMacroGenre(genre: string): string {
    return GENRE_MAP[genre.toLowerCase()] || DEFAULT_GENRE;
  }
  
  /**
   * Obtiene el perfil de un macro-género
   */
  static getGenreProfile(macroGenre: string): GenreProfile | undefined {
    return MACRO_GENRES[macroGenre];
  }
  
  /**
   * Lista todos los macro-géneros disponibles
   */
  static getMacroGenres(): string[] {
    return Object.keys(MACRO_GENRES);
  }
  
  /**
   * Obtiene el hue base para una key musical
   */
  static getKeyHue(key: string): number | undefined {
    return KEY_TO_HUE[key];
  }
  
  /**
   * Obtiene el modificador de un modo musical
   */
  static getModeModifier(mode: string): ModeModifier | undefined {
    return MODE_MODIFIERS[mode];
  }
}

// ============================================================
// 6. EXPORTS
// ============================================================

export {
  KEY_TO_HUE,
  MOOD_HUES,
  MODE_MODIFIERS,
  MACRO_GENRES,
  GENRE_MAP,
  PHI_ROTATION,
  normalizeHue,
  clamp,
  mapRange,
};

// Default export
export default SeleneColorEngine;
