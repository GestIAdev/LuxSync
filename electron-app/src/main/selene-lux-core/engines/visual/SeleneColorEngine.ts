/**
 * 🎨 SELENE COLOR ENGINE (WAVE 68.5)
 * ===================================
 * Motor procedural determinista para generación de paletas cromáticas
 * basado EXCLUSIVAMENTE en teoría musical y física del sonido.
 * 
 * FILOSOFÍA:
 * "Selene pinta MATEMÁTICA MUSICAL PURA.
 *  El VibeProfile es el único jefe que define restricciones."
 * 
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (KEY_TO_HUE)
 * - Modo → Temperatura emocional (MODE_MODIFIERS)
 * - Energía → Saturación y Brillo (NUNCA cambia el Hue)
 * - Syncopation → Estrategia de contraste (analogous/triadic/complementary)
 * - Rotación Fibonacci (φ × 360° ≈ 222.5°) → Color secundario
 * 
 * WAVE 68.5 - PURGA DE GÉNERO:
 * ✅ Eliminado: MACRO_GENRES, GENRE_MAP, GenreProfile, tempBias, satBoost, lightBoost
 * ✅ El motor genera colores PUROS - sin bias de género
 * ✅ El VibeManager aplica clamps DESPUÉS (temperatura/saturación min/max)
 * 
 * REGLA DE ORO:
 *   finalHue = KEY_TO_HUE[key] + MODE_MODIFIERS[mode].hueDelta
 *   energía SOLO afecta saturación y brillo, NUNCA el hue base
 * 
 * @see docs/JSON-ANALYZER-PROTOCOL.md - Protocolo de entrada
 * @see docs/WAVE-17-SELENE-COLOR-MIND-AUDIT.md - Arquitectura original
 * @see docs/Wave60_70/WAVE-68-5-GENRE-PURGE.md - Eliminación de lógica de género
 * 
 * @module engines/visual/SeleneColorEngine
 * @version 68.5.0
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
 * 🎨 WAVE 68.5: Sin macroGenre - solo matemática musical pura
 */
export interface PaletteMeta {
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
  
  // 🔌 WAVE 65: Smart Logging - Tracking para evitar logs repetitivos
  private static lastLoggedKey: string | null = null;
  private static lastLoggedStrategy: string | null = null;
  private static lastLoggedVibe: string | null = null;
  private static logCooldownFrames = 0;
  private static readonly LOG_COOLDOWN = 180;  // 3 segundos entre logs similares
  
  /**
   * 🔬 WAVE 65: CHROMATIC AUDIT LOG
   * 
   * Log compacto en formato JSON que se dispara SOLO cuando:
   * - Cambia la key musical
   * - Cambia la estrategia de color
   * - Cambia el vibe activo
   * - O han pasado 3 segundos desde el último log
   * 
   * @param data - Datos del análisis actual
   * @param palette - Paleta generada
   * @param vibeId - ID del vibe activo
   * @param overrideReason - Razón del override si aplica
   */
  static logChromaticAudit(
    data: { key: string | null; mood: string | null; energy: number },
    palette: SelenePalette,
    vibeId: string = 'unknown',
    overrideReason: string | null = null
  ): void {
    const currentKey = data.key || 'null';
    const currentStrategy = palette.meta.strategy;
    
    // Decrementar cooldown
    if (this.logCooldownFrames > 0) {
      this.logCooldownFrames--;
    }
    
    // Solo loguear si algo cambió O pasó el cooldown
    const keyChanged = currentKey !== this.lastLoggedKey;
    const strategyChanged = currentStrategy !== this.lastLoggedStrategy;
    const vibeChanged = vibeId !== this.lastLoggedVibe;
    const cooldownExpired = this.logCooldownFrames === 0;
    
    if (keyChanged || strategyChanged || vibeChanged || cooldownExpired) {
      // Calcular temperatura en Kelvin aproximada
      // Warm = 2700-3500K, Neutral = 4000-5000K, Cool = 5500-6500K
      let tempKelvin = 4500;
      
      // 🔥 WAVE 68: HARD CLAMP FINAL - Si el vibe es Latino, forzar temperatura cálida
      // Esto es un failsafe adicional al clamp en generate()
      const isLatinoVibe = vibeId.toLowerCase().includes('latin') || vibeId.toLowerCase().includes('fiesta');
      let effectiveTemp = palette.meta.temperature;
      
      if (isLatinoVibe && effectiveTemp !== 'warm') {
        effectiveTemp = 'warm';  // Forzar cálido para vibes Latino
      }
      
      if (effectiveTemp === 'warm') {
        tempKelvin = 3000 + Math.floor(palette.primary.h / 360 * 500);
      } else if (effectiveTemp === 'cool') {
        tempKelvin = 5500 + Math.floor((360 - palette.primary.h) / 360 * 1000);
      }
      
      // 🔥 WAVE 68: Clamp final de temperatura para Latino
      if (isLatinoVibe) {
        tempKelvin = Math.min(tempKelvin, 4500);  // Máximo 4500K para Latino
      }
      
      const audit = {
        vibe: vibeId,
        key: currentKey,
        strategy: currentStrategy,
        reason: overrideReason || 'vibe_optimal',
        temp: tempKelvin,
        mood: data.mood || 'neutral',
        hue: Math.round(palette.primary.h),
        sat: Math.round(palette.primary.s),
        energy: Math.round(data.energy * 100)
      };
      
      console.log(`[COLOR_AUDIT] 🎨 ${JSON.stringify(audit)}`);
      
      // Actualizar tracking
      this.lastLoggedKey = currentKey;
      this.lastLoggedStrategy = currentStrategy;
      this.lastLoggedVibe = vibeId;
      this.logCooldownFrames = this.LOG_COOLDOWN;
    }
  }
  
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
    const energy = clamp(data.energy ?? 0.5, 0, 1);
    
    // === B. DETERMINAR HUE BASE (Matemática Pura) ===
    // 🎨 WAVE 68.5: PURE COLOR - Solo Key, Mode y Mood
    // NO género, NO bias, solo matemática musical pura
    // 🔥 WAVE 74: MOOD OVERRIDE - Si mood es 'bright', forzar Hue cálido
    // Esto evita que Fiesta Latina muestre verdes/cyans por la Key detectada
    let baseHue = 120; // Default: Verde (neutro)
    let hueSource = 'default';
    
    // 🔥 WAVE 74: Mood 'bright' tiene PRIORIDAD sobre Key
    // Fiesta Latina usa mood='bright' y SIEMPRE debe ser cálido
    if (mood === 'bright') {
      // Rango cálido: rojos, naranjas, amarillos (0-60°)
      // Usamos Key para variar DENTRO del rango cálido
      if (key && KEY_TO_HUE[key] !== undefined) {
        const keyHue = KEY_TO_HUE[key];
        // Mapear cualquier Key al rango cálido (0-60°)
        // Usamos el módulo de la Key para crear variación
        baseHue = (keyHue % 60);  // Siempre 0-59°
      } else {
        baseHue = 30; // Default cálido: naranja
      }
      hueSource = `mood:bright+warm`;
    } else if (mood === 'dark') {
      // 🔥 WAVE 74: Mood 'dark' = azules/violetas (200-280°)
      if (key && KEY_TO_HUE[key] !== undefined) {
        const keyHue = KEY_TO_HUE[key];
        baseHue = 200 + (keyHue % 80);  // 200-280°
      } else {
        baseHue = 240; // Default frío: azul
      }
      hueSource = `mood:dark+cold`;
    } else if (key && KEY_TO_HUE[key] !== undefined) {
      // Comportamiento original: Key determina Hue
      baseHue = KEY_TO_HUE[key];
      hueSource = `key:${key}`;
    } else if (mood && MOOD_HUES[mood] !== undefined) {
      baseHue = MOOD_HUES[mood];
      hueSource = `mood:${mood}`;
    }
    
    // === C. APLICAR MODIFICADORES DE MODO ===
    // Solo aplicamos el modifier del modo musical (major/minor)
    const modeMod = MODE_MODIFIERS[mode] || MODE_MODIFIERS['minor'];
    
    // El Hue final es: Base + Modo (SIN GÉNERO)
    const finalHue = normalizeHue(baseHue + modeMod.hue);
    
    // === D. ENERGÍA → SATURACIÓN Y BRILLO ===
    // REGLA DE ORO: Energía NUNCA modifica el Hue, solo S y L
    // Energy 0.0 → Sat 40%, Light 25%
    // Energy 1.0 → Sat 100%, Light 95%
    const baseSat = 40 + (energy * 60);  // 40-100%
    const baseLight = 25 + (energy * 70); // 25-95% (WAVE 24.5.2: Rango más dinámico)
    
    // Aplicar solo modifiers de modo (SIN GÉNERO BOOST)
    const primarySat = clamp(
      baseSat + modeMod.sat,
      20,
      100
    );
    
    const primaryLight = clamp(
      baseLight + modeMod.light,
      20,  // Mínimo absoluto
      95   // Máximo absoluto
    );
    
    // === E. COLOR PRIMARIO ===
    const primary: HSLColor = {
      h: finalHue,
      s: primarySat,
      l: primaryLight,
    };
    
    // === F. COLOR SECUNDARIO (Rotación Fibonacci) ===
    // φ × 360° ≈ 222.5° garantiza variedad infinita
    const secondaryHue = normalizeHue(finalHue + PHI_ROTATION);
    const secondary: HSLColor = {
      h: secondaryHue,
      s: clamp(primarySat + 5, 20, 100),  // Ligeramente más saturado
      l: clamp(primaryLight - 10, 20, 80), // Ligeramente más oscuro
    };
    
    // === G. COLOR DE ACENTO (Estrategia de Contraste) ===
    // 🎨 WAVE 68.5: Estrategia PURA basada en syncopation
    // SIN género, solo matemática rítmica
    let accentHue: number;
    let strategy: 'analogous' | 'triadic' | 'complementary';
    
    // Decisión basada solo en syncopation
    if (syncopation < 0.30) {
      strategy = 'analogous';
      accentHue = finalHue + 30;   // Vecino
    } else if (syncopation < 0.50) {
      strategy = 'triadic';
      accentHue = finalHue + 120;  // Triángulo
    } else {
      strategy = 'complementary';
      accentHue = finalHue + 180;  // Opuesto
    }
    
    const accent: HSLColor = {
      h: normalizeHue(accentHue),
      s: 100,  // Beams siempre a máxima saturación
      l: Math.max(70, primaryLight + 20), // Siempre brillante
    };
    
    // === H. COLOR AMBIENTE (Fills, desaturado) ===
    const ambient: HSLColor = {
      h: finalHue,
      s: Math.max(15, primarySat * 0.4),  // 40% de saturación
      l: Math.max(15, primaryLight * 0.4), // 40% de brillo
    };
    
    // === I. COLOR CONTRASTE (Siluetas, muy oscuro) ===
    const contrast: HSLColor = {
      h: normalizeHue(finalHue + 180),
      s: 30,
      l: 10,
    };
    
    // === J. DETERMINAR TEMPERATURA VISUAL ===
    // 🌡️ WAVE 68.5: Temperatura PURA basada solo en HUE
    // Hue 0-60 y 300-360 = warm (reds, oranges, magentas)
    // Hue 180-300 = cool (cyans, blues, purples)
    // Hue 60-180 = neutral/warm (yellows, greens)
    let temperature: 'warm' | 'cool' | 'neutral';
    if ((finalHue >= 0 && finalHue <= 60) || finalHue >= 300) {
      temperature = 'warm';
    } else if (finalHue >= 180 && finalHue < 300) {
      temperature = 'cool';
    } else {
      temperature = 'neutral';
    }
    
    // === K. CALCULAR VELOCIDAD DE TRANSICIÓN ===
    // Alta energía = transiciones rápidas
    // Baja energía = transiciones lentas
    const baseTransitionSpeed = 1200; // ms (default moderado)
    const transitionSpeed = mapRange(
      energy,
      0, 1,
      baseTransitionSpeed * 1.5,  // Lento (1800ms)
      baseTransitionSpeed * 0.5   // Rápido (600ms)
    );
    
    // === L. CONSTRUIR DESCRIPCIÓN ===
    // 🎨 WAVE 68.5: Descripción PURA sin género
    const description = [
      key ? `${key} ${mode}` : mood,
      `${temperature}`,
      `E=${(energy * 100).toFixed(0)}%`,
      `S=${(syncopation * 100).toFixed(0)}%`,
    ].join(' ');
    
    // === M. RETORNAR PALETA COMPLETA ===
    return {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      meta: {
        strategy: strategy as 'analogous' | 'triadic' | 'complementary',
        temperature,
        description,
        confidence: 1.0,  // 🎨 WAVE 68.5: Confianza siempre 100% (matemática determinista)
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
  PHI_ROTATION,
  normalizeHue,
  clamp,
  mapRange,
};

// ============================================================
// 7. WAVE 49: COLOR INTERPOLATOR (Smooth Transitions)
// ============================================================

/**
 * 🎨 WAVE 49: SELENE COLOR INTERPOLATOR
 * ====================================
 * Wrapper con estado para interpolación suave de colores.
 * Evita "epilepsia cromática" cuando cambia Key o Mood.
 * 
 * REGLAS:
 * - Transición normal: 4 beats (~2 segundos a 120 BPM)
 * - Transición DROP: 0.5 segundos (rápido pero no instantáneo)
 * - NUNCA cambio instantáneo (0 frames)
 * - Reset en nueva canción
 */
export class SeleneColorInterpolator {
  // Estado actual (lo que se envía a fixtures)
  private currentPalette: SelenePalette | null = null;
  
  // Estado objetivo (hacia donde interpolamos)
  private targetPalette: SelenePalette | null = null;
  
  // Progreso de interpolación (0 = inicio, 1 = completado)
  private transitionProgress = 1.0;
  
  // Velocidad de transición (incremento por frame)
  private transitionSpeed = 0.02;  // ~50 frames = ~0.8s default
  
  // Configuración
  // WAVE 55: Transiciones lentas para evitar parpadeo en Cumbia
  private readonly NORMAL_TRANSITION_FRAMES = 240;  // 8 beats @ 120bpm @ 60fps ≈ 4s
  private readonly DROP_TRANSITION_FRAMES = 30;     // 0.5 segundos
  private readonly MIN_TRANSITION_FRAMES = 6;       // Mínimo 0.1s (nunca instantáneo)
  
  // Frame counter para logging
  private frameCount = 0;
  private lastLogFrame = 0;
  
  /**
   * Actualiza el color interpolado cada frame
   * 
   * @param targetData - Datos de análisis de audio
   * @param isDrop - Si estamos en un DROP (transición rápida)
   * @returns Paleta interpolada para enviar a fixtures
   * 
   * 🌊 WAVE 70.5: Tolerancia de jitter - solo resetear transición si cambio > 15°
   */
  update(targetData: ExtendedAudioAnalysis, isDrop: boolean = false): SelenePalette {
    this.frameCount++;
    
    // Generar la paleta objetivo
    const newTarget = SeleneColorEngine.generate(targetData);
    
    // Si no hay paleta actual, inicializar sin transición
    if (!this.currentPalette) {
      this.currentPalette = newTarget;
      this.targetPalette = newTarget;
      this.transitionProgress = 1.0;
      return newTarget;
    }
    
    // � WAVE 70.5: Calcular diferencia de Hue con camino más corto en el círculo
    const currentTargetHue = normalizeHue(this.targetPalette!.primary.h);
    const newTargetHue = normalizeHue(newTarget.primary.h);
    let hueDiff = Math.abs(currentTargetHue - newTargetHue);
    if (hueDiff > 180) hueDiff = 360 - hueDiff; // Camino más corto
    
    // 🌊 WAVE 70.5: Solo es cambio REAL si supera tolerancia de 15°
    // Evita flicker por jitter/oscilación del análisis
    const isRealChange = hueDiff > 15;
    
    if (isRealChange) {
      // Cambio significativo de Key/Mood - iniciar nueva transición
      this.targetPalette = newTarget;
      this.transitionProgress = 0;
      
      // Velocidad según contexto
      const transitionFrames = isDrop ? this.DROP_TRANSITION_FRAMES : this.NORMAL_TRANSITION_FRAMES;
      this.transitionSpeed = 1.0 / Math.max(transitionFrames, this.MIN_TRANSITION_FRAMES);
    } else if (hueDiff > 0) {
      // 🌊 WAVE 70.5: Jitter detectado - actualizar target silenciosamente
      // NO reseteamos transitionProgress, permitiendo corrección suave del rumbo
      this.targetPalette = newTarget;
    }
    
    // Avanzar transición
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + this.transitionSpeed);
      
      // Interpolar todos los colores de la paleta
      this.currentPalette = this.lerpPalette(
        this.currentPalette!,
        this.targetPalette!,
        this.transitionProgress
      );
    }
    
    return this.currentPalette;
  }
  
  /**
   * Interpola entre dos paletas completas
   */
  private lerpPalette(from: SelenePalette, to: SelenePalette, t: number): SelenePalette {
    return {
      primary: this.lerpHSL(from.primary, to.primary, t),
      secondary: this.lerpHSL(from.secondary, to.secondary, t),
      accent: this.lerpHSL(from.accent, to.accent, t),
      ambient: this.lerpHSL(from.ambient, to.ambient, t),
      contrast: this.lerpHSL(from.contrast, to.contrast, t),
      meta: t >= 0.5 ? to.meta : from.meta, // Metadata cambia a mitad de transición
    };
  }
  
  /**
   * Interpola entre dos colores HSL
   * Usa el camino más corto en el círculo de hue (evita saltos de 350° a 10°)
   * 
   * 🔥 WAVE 67.5: DESATURATION DIP
   * Si la diferencia de Hue es > 60°, desaturamos en el punto medio (t ≈ 0.5)
   * Esto crea un efecto de 'lavado' (blanco/gris) en el cruce, evitando el efecto arcoíris sucio
   */
  private lerpHSL(from: HSLColor, to: HSLColor, t: number): HSLColor {
    // Hue: usar el camino más corto en el círculo
    let hueDiff = to.h - from.h;
    if (hueDiff > 180) hueDiff -= 360;
    if (hueDiff < -180) hueDiff += 360;
    const h = normalizeHue(from.h + hueDiff * t);
    
    // S y L: interpolación lineal simple
    let s = from.s + (to.s - from.s) * t;
    const l = from.l + (to.l - from.l) * t;
    
    // 🔥 WAVE 67.5: DESATURATION DIP
    // Si el salto de hue es grande (> 60°), desaturar en el punto medio
    // Esto evita ver "todos los colores intermedios" (arcoíris sucio)
    const absHueDiff = Math.abs(hueDiff);
    if (absHueDiff > 60) {
      // Curva de desaturación: máximo en t=0.5, mínimo en t=0 y t=1
      // Usamos una función gaussiana centrada en 0.5
      const dipCenter = 0.5;
      const dipWidth = 0.25;  // Ancho de la "zona de lavado"
      const distanceFromCenter = Math.abs(t - dipCenter);
      
      // Si estamos cerca del centro, aplicar desaturación
      if (distanceFromCenter < dipWidth) {
        // Factor de desaturación: 1.0 (sin efecto) → 0.3 (máximo lavado) en el centro
        // Curva suave: 1 - (1 - 0.3) * cos²(...)
        const dipStrength = 0.3;  // Saturación mínima en el dip (30% de la original)
        const normalizedDist = distanceFromCenter / dipWidth;  // 0 en centro, 1 en bordes
        const dipFactor = dipStrength + (1 - dipStrength) * (normalizedDist * normalizedDist);
        
        s = s * dipFactor;
      }
    }
    
    return { h, s, l };
  }
  
  /**
   * 🧹 WAVE 49: HARD RESET - Limpiar estado para nueva canción
   */
  reset(): void {
    console.log('[ColorInterpolator] 🧹 RESET: Estado limpiado para nueva canción');
    this.currentPalette = null;
    this.targetPalette = null;
    this.transitionProgress = 1.0;
    this.frameCount = 0;
    this.lastLogFrame = 0;
  }
  
  /**
   * Obtiene el progreso actual de la transición (0-1)
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }
  
  /**
   * Comprueba si hay una transición en curso
   */
  isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }
  
  /**
   * Fuerza una transición inmediata (para casos especiales)
   * ⚠️ Usar con precaución - puede causar saltos visuales
   */
  forceImmediate(palette: SelenePalette): void {
    this.currentPalette = palette;
    this.targetPalette = palette;
    this.transitionProgress = 1.0;
  }
}

// Default export
export default SeleneColorEngine;
