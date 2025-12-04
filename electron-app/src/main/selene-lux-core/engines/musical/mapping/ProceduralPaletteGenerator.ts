/**
 * 🎨 PROCEDURAL PALETTE GENERATOR
 * ================================
 * Generador de paletas cromáticas basado en ADN musical
 * 
 * PRINCIPIO FUNDAMENTAL:
 * "No le decimos a Selene qué colores usar.
 *  Le enseñamos a SENTIR la música y PINTAR lo que siente."
 * 
 * FUNDAMENTOS:
 * - Círculo de Quintas → Círculo Cromático (Sinestesia)
 * - Modo → Temperatura emocional
 * - Energía → Estrategia de contraste
 * - Sincopación → Saturación del secundario
 * 
 * Blueprint: BLUEPRINT-SELENE-CHROMATIC-FORMULA.md
 * 
 * @module engines/musical/mapping/ProceduralPaletteGenerator
 */

import { EventEmitter } from 'events';

// ============================================================
// TIPOS E INTERFACES
// ============================================================

/**
 * Color en formato HSL
 */
export interface HSLColor {
  h: number;  // Hue: 0-360
  s: number;  // Saturation: 0-100
  l: number;  // Lightness: 0-100
}

/**
 * Color en formato RGB
 */
export interface RGBColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
}

/**
 * ADN musical de una canción/momento
 */
export interface MusicalDNA {
  /** Tonalidad (C, D, E..., null si desconocida) */
  key: string | null;
  
  /** Modo/escala (major, minor, dorian...) */
  mode: string;
  
  /** Nivel de energía (0-1) */
  energy: number;
  
  /** Nivel de sincopación (0-1) */
  syncopation: number;
  
  /** Mood detectado */
  mood: string;
  
  /** Sección actual */
  section: string;
}

/**
 * Paleta completa generada por Selene
 */
export interface SelenePalette {
  /** Color principal - Fixtures estáticos, wash general */
  primary: HSLColor;
  
  /** Color secundario - Moving heads, efectos de acento */
  secondary: HSLColor;
  
  /** Color de acento - Strobes, flashes, momentos de impacto */
  accent: HSLColor;
  
  /** Color de ambiente - Backlighting, fills suaves */
  ambient: HSLColor;
  
  /** Color de contraste - Highlights, siluetas */
  contrast: HSLColor;
  
  /** Metadata de la paleta */
  metadata: PaletteMetadata;
}

/**
 * Metadata de la paleta generada
 */
export interface PaletteMetadata {
  /** Timestamp de generación */
  generatedAt: number;
  
  /** ADN musical que generó esta paleta */
  musicalDNA: MusicalDNA;
  
  /** Confianza en la paleta (0-1) */
  confidence: number;
  
  /** Velocidad de transición sugerida (ms) */
  transitionSpeed: number;
  
  /** Estrategia de color usada */
  colorStrategy: 'analogous' | 'triadic' | 'complementary';
  
  /** Descripción legible */
  description: string;
}

/**
 * Modificadores de modo musical
 */
interface ModeModifier {
  saturationDelta: number;  // -20 a +20
  lightnessDelta: number;   // -20 a +20
  hueDelta: number;         // Grados de shift en el círculo
  emotionalWeight: number;  // Para mezclar con otras señales
  description: string;      // Descripción del mood
}

/**
 * Variación de sección
 */
interface SectionVariation {
  primaryLightnessShift: number;
  secondaryLightnessShift: number;
  accentIntensity: number;      // Multiplicador 0-1
  ambientPresence: number;      // Multiplicador 0-1
}

// ============================================================
// CONSTANTES - EL CORAZÓN DE LA FÓRMULA CROMÁTICA
// ============================================================

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
 * 🌡️ MODIFICADORES DE MODO
 * 
 * Cada modo tiene una "temperatura" emocional que modifica
 * la saturación, luminosidad y hue del color base.
 */
const MODE_MODIFIERS: Record<string, ModeModifier> = {
  // Modos mayores - Cálidos y brillantes
  'major': {
    saturationDelta: 15,
    lightnessDelta: 10,
    hueDelta: 15,
    emotionalWeight: 0.8,
    description: 'Alegre y brillante'
  },
  'ionian': {
    saturationDelta: 15,
    lightnessDelta: 10,
    hueDelta: 15,
    emotionalWeight: 0.8,
    description: 'Alegre y brillante'
  },
  'lydian': {
    saturationDelta: 20,
    lightnessDelta: 15,
    hueDelta: 25,
    emotionalWeight: 0.7,
    description: 'Etéreo y soñador'
  },
  'mixolydian': {
    saturationDelta: 10,
    lightnessDelta: 5,
    hueDelta: 10,
    emotionalWeight: 0.6,
    description: 'Funky y cálido'
  },
  
  // Modos menores - Fríos y profundos
  'minor': {
    saturationDelta: -10,
    lightnessDelta: -15,
    hueDelta: -15,
    emotionalWeight: 0.7,
    description: 'Triste y melancólico'
  },
  'aeolian': {
    saturationDelta: -10,
    lightnessDelta: -15,
    hueDelta: -15,
    emotionalWeight: 0.7,
    description: 'Triste y melancólico'
  },
  'dorian': {
    saturationDelta: 5,
    lightnessDelta: 0,
    hueDelta: -5,
    emotionalWeight: 0.6,
    description: 'Jazzy y sofisticado'
  },
  'phrygian': {
    saturationDelta: -5,
    lightnessDelta: -10,
    hueDelta: -20,
    emotionalWeight: 0.9,
    description: 'Español y tenso'
  },
  'locrian': {
    saturationDelta: -15,
    lightnessDelta: -20,
    hueDelta: -30,
    emotionalWeight: 0.5,
    description: 'Oscuro y disonante'
  },
  
  // Escalas especiales
  'harmonic_minor': {
    saturationDelta: -5,
    lightnessDelta: -10,
    hueDelta: -10,
    emotionalWeight: 0.8,
    description: 'Dramático y exótico'
  },
  'melodic_minor': {
    saturationDelta: 0,
    lightnessDelta: -5,
    hueDelta: -5,
    emotionalWeight: 0.6,
    description: 'Jazz avanzado'
  },
  'pentatonic_major': {
    saturationDelta: 10,
    lightnessDelta: 5,
    hueDelta: 10,
    emotionalWeight: 0.5,
    description: 'Simple y folk'
  },
  'pentatonic_minor': {
    saturationDelta: 5,
    lightnessDelta: -5,
    hueDelta: 0,
    emotionalWeight: 0.5,
    description: 'Blues y rock'
  },
  'blues': {
    saturationDelta: 5,
    lightnessDelta: -10,
    hueDelta: -10,
    emotionalWeight: 0.7,
    description: 'Bluesy y soul'
  },
};

/**
 * 📊 VARIACIONES POR SECCIÓN
 * 
 * Cada sección modifica la intensidad y presencia
 * de los colores sin cambiar la paleta base.
 */
const SECTION_VARIATIONS: Record<string, SectionVariation> = {
  'intro': {
    primaryLightnessShift: -20,
    secondaryLightnessShift: -15,
    accentIntensity: 0.3,
    ambientPresence: 0.7,
  },
  'verse': {
    primaryLightnessShift: -10,
    secondaryLightnessShift: -5,
    accentIntensity: 0.5,
    ambientPresence: 0.5,
  },
  'pre_chorus': {
    primaryLightnessShift: 0,
    secondaryLightnessShift: 5,
    accentIntensity: 0.7,
    ambientPresence: 0.4,
  },
  'chorus': {
    primaryLightnessShift: 15,
    secondaryLightnessShift: 20,
    accentIntensity: 1.0,
    ambientPresence: 0.3,
  },
  'drop': {
    primaryLightnessShift: 20,
    secondaryLightnessShift: 25,
    accentIntensity: 1.0,
    ambientPresence: 0.1,  // Casi sin ambiente, puro impacto
  },
  'buildup': {
    primaryLightnessShift: 5,
    secondaryLightnessShift: 10,
    accentIntensity: 0.8,
    ambientPresence: 0.3,
  },
  'breakdown': {
    primaryLightnessShift: -15,
    secondaryLightnessShift: -10,
    accentIntensity: 0.4,
    ambientPresence: 0.6,
  },
  'bridge': {
    primaryLightnessShift: -5,
    secondaryLightnessShift: 10,
    accentIntensity: 0.6,
    ambientPresence: 0.6,
  },
  'outro': {
    primaryLightnessShift: -15,
    secondaryLightnessShift: -20,
    accentIntensity: 0.2,
    ambientPresence: 0.8,
  },
  'unknown': {
    primaryLightnessShift: 0,
    secondaryLightnessShift: 0,
    accentIntensity: 0.5,
    ambientPresence: 0.5,
  },
};

/**
 * Valores por defecto para DNA desconocido
 */
const DEFAULT_DNA: MusicalDNA = {
  key: 'C',
  mode: 'major',
  energy: 0.5,
  syncopation: 0.3,
  mood: 'neutral',
  section: 'unknown',
};

// ============================================================
// FUNCIONES UTILITARIAS
// ============================================================

/**
 * Limita un valor a un rango
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
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Normaliza un ángulo a 0-360
 */
function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/**
 * Convierte HSL a RGB
 */
export function hslToRgb(hsl: HSLColor): RGBColor {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convierte HSL a hex string
 */
export function hslToHex(hsl: HSLColor): string {
  const rgb = hslToRgb(hsl);
  return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}

// ============================================================
// CLASE PRINCIPAL
// ============================================================

/**
 * 🎨 PROCEDURAL PALETTE GENERATOR
 * 
 * Genera paletas de color basadas en el ADN musical.
 * 
 * Eventos:
 * - 'palette-generated': SelenePalette
 * - 'palette-variation': { section, palette }
 */
export class ProceduralPaletteGenerator extends EventEmitter {
  private lastGeneratedPalette: SelenePalette | null = null;
  private generationCount: number = 0;
  
  constructor() {
    super();
    console.log('🎨 [PALETTE-GENERATOR] Initialized - Selene can now paint music');
  }

  // ============================================================
  // MÉTODOS DE CONVERSIÓN KEY → HUE
  // ============================================================

  /**
   * Convierte una tonalidad musical a un ángulo HSL
   * Basado en el Círculo de Quintas Cromático
   */
  keyToHue(key: string | null): number {
    if (!key) {
      // Si no hay key, usar un hue neutral basado en timestamp
      // para variar un poco sin información
      return (Date.now() % 36000) / 100; // Rotación lenta cada 100 segundos
    }
    
    // Normalizar key (quitar números de octava si existen)
    const normalizedKey = key.replace(/[0-9]/g, '').trim();
    
    return KEY_TO_HUE[normalizedKey] ?? 0;
  }

  /**
   * Obtiene los modificadores de modo
   */
  getModeModifier(mode: string): ModeModifier {
    const normalizedMode = mode.toLowerCase().replace(/[^a-z_]/g, '');
    return MODE_MODIFIERS[normalizedMode] ?? MODE_MODIFIERS['major'];
  }

  // ============================================================
  // ESTRATEGIA DE COLOR SECUNDARIO
  // ============================================================

  /**
   * Determina la estrategia de color secundario basada en la energía
   * 
   * - Baja energía → Análogos (suaves, armoniosos)
   * - Media energía → Triádicos (equilibrados)
   * - Alta energía → Complementarios (impactantes)
   */
  calculateColorStrategy(energy: number): 'analogous' | 'triadic' | 'complementary' {
    if (energy < 0.3) {
      return 'analogous';
    } else if (energy < 0.6) {
      return 'triadic';
    } else {
      return 'complementary';
    }
  }

  /**
   * Calcula el hue del color secundario
   */
  calculateSecondaryHue(baseHue: number, energy: number, syncopation: number): number {
    const strategy = this.calculateColorStrategy(energy);
    
    let separation: number;
    
    switch (strategy) {
      case 'analogous':
        // Colores vecinos (30° de diferencia)
        separation = 30;
        break;
      case 'triadic':
        // Colores en triángulo (120° de diferencia)
        separation = 120;
        break;
      case 'complementary':
        // Colores opuestos (180° de diferencia)
        separation = 180;
        break;
    }
    
    // La sincopación determina la dirección en el círculo
    // Alta sincopación = hacia adelante (más cálido generalmente)
    const direction = syncopation > 0.5 ? 1 : -1;
    
    return normalizeHue(baseHue + separation * direction);
  }

  /**
   * Calcula la saturación del color secundario
   * Alta sincopación = más saturación (más "punch" visual)
   */
  calculateSecondarySaturation(baseSaturation: number, syncopation: number): number {
    const saturationBoost = syncopation * 30; // 0-30% extra
    return clamp(baseSaturation + saturationBoost, 20, 100);
  }

  // ============================================================
  // GENERACIÓN DE PALETA PRINCIPAL
  // ============================================================

  /**
   * 🎨 GENERA UNA PALETA COMPLETA
   * 
   * Este es el método principal que convierte ADN musical en colores.
   * 
   * @param dna - ADN musical (key, mode, energy, syncopation, section)
   * @returns SelenePalette - Paleta de 5 colores + metadata
   */
  generatePalette(dna: Partial<MusicalDNA> = {}): SelenePalette {
    const fullDNA: MusicalDNA = { ...DEFAULT_DNA, ...dna };
    
    // 1. COLOR BASE desde la tonalidad
    const baseHue = this.keyToHue(fullDNA.key);
    
    // 2. MODIFICADORES desde el modo
    const modeModifier = this.getModeModifier(fullDNA.mode);
    
    // 3. ESTRATEGIA de color
    const colorStrategy = this.calculateColorStrategy(fullDNA.energy);
    
    // 4. PRIMARY - Color base con modificadores de modo
    const primaryHue = normalizeHue(baseHue + modeModifier.hueDelta);
    const primary: HSLColor = {
      h: primaryHue,
      s: clamp(70 + modeModifier.saturationDelta, 20, 100),
      l: clamp(50 + modeModifier.lightnessDelta, 20, 80),
    };
    
    // 5. SECONDARY - Según energía y sincopación
    const secondaryHue = this.calculateSecondaryHue(
      primary.h,
      fullDNA.energy,
      fullDNA.syncopation
    );
    const secondary: HSLColor = {
      h: secondaryHue,
      s: this.calculateSecondarySaturation(primary.s, fullDNA.syncopation),
      l: clamp(
        primary.l + (fullDNA.energy > 0.5 ? 10 : -10),
        20,
        85
      ),
    };
    
    // 6. ACCENT - Siempre complementario para máximo impacto
    const accent: HSLColor = {
      h: normalizeHue(primary.h + 180),
      s: clamp(primary.s + 20, 20, 100),
      l: clamp(primary.l + 20, 20, 90),
    };
    
    // 7. AMBIENT - Desaturado y oscuro para atmósfera
    const ambient: HSLColor = {
      h: primary.h,
      s: clamp(primary.s - 40, 10, 40),
      l: clamp(primary.l - 25, 10, 30),
    };
    
    // 8. CONTRAST - Muy oscuro para siluetas
    const contrast: HSLColor = {
      h: normalizeHue(primary.h + 30),
      s: 30,
      l: 10,
    };
    
    // 9. VELOCIDAD DE TRANSICIÓN según energía
    // Baja energía = transiciones lentas (2000ms)
    // Alta energía = transiciones rápidas (300ms)
    const transitionSpeed = Math.round(
      mapRange(fullDNA.energy, 0, 1, 2000, 300)
    );
    
    // 10. CONFIANZA de la paleta
    const confidence = this.calculatePaletteConfidence(fullDNA);
    
    // 11. DESCRIPCIÓN legible
    const description = this.generateDescription(fullDNA, modeModifier);
    
    const palette: SelenePalette = {
      primary,
      secondary,
      accent,
      ambient,
      contrast,
      metadata: {
        generatedAt: Date.now(),
        musicalDNA: fullDNA,
        confidence,
        transitionSpeed,
        colorStrategy,
        description,
      },
    };
    
    // Guardar y emitir
    this.lastGeneratedPalette = palette;
    this.generationCount++;
    
    this.emit('palette-generated', palette);
    
    console.log(`🎨 [PALETTE] Generated: ${description} (confidence: ${(confidence * 100).toFixed(0)}%)`);
    
    return palette;
  }

  /**
   * Calcula la confianza de la paleta basada en el DNA
   */
  private calculatePaletteConfidence(dna: MusicalDNA): number {
    let confidence = 0.5; // Base
    
    // Si tenemos key, más confianza
    if (dna.key) {
      confidence += 0.2;
    }
    
    // Si el modo no es genérico, más confianza
    if (dna.mode !== 'major' && dna.mode !== 'unknown') {
      confidence += 0.1;
    }
    
    // Si la sección es específica, más confianza
    if (dna.section !== 'unknown') {
      confidence += 0.1;
    }
    
    // Energía extrema (muy baja o muy alta) da más confianza
    if (dna.energy < 0.2 || dna.energy > 0.8) {
      confidence += 0.1;
    }
    
    return clamp(confidence, 0, 1);
  }

  /**
   * Genera una descripción legible de la paleta
   */
  private generateDescription(dna: MusicalDNA, modifier: ModeModifier): string {
    const keyName = dna.key || 'Unknown';
    const modeName = dna.mode.charAt(0).toUpperCase() + dna.mode.slice(1);
    
    const energyDesc = 
      dna.energy < 0.3 ? 'Baja energía' :
      dna.energy < 0.6 ? 'Energía media' :
      'Alta energía';
    
    return `${keyName} ${modeName} (${modifier.description}) - ${energyDesc}`;
  }

  // ============================================================
  // VARIACIONES POR SECCIÓN
  // ============================================================

  /**
   * Aplica variaciones de sección a una paleta existente
   * 
   * Esto permite variar la intensidad sin cambiar los colores base.
   */
  applySectionVariation(palette: SelenePalette, section: string): SelenePalette {
    const variation = SECTION_VARIATIONS[section] ?? SECTION_VARIATIONS['unknown'];
    
    const variedPalette: SelenePalette = {
      primary: {
        ...palette.primary,
        l: clamp(
          palette.primary.l + variation.primaryLightnessShift,
          10,
          95
        ),
      },
      secondary: {
        ...palette.secondary,
        l: clamp(
          palette.secondary.l + variation.secondaryLightnessShift,
          10,
          95
        ),
      },
      accent: {
        ...palette.accent,
        s: clamp(palette.accent.s * variation.accentIntensity, 10, 100),
      },
      ambient: {
        ...palette.ambient,
        l: clamp(palette.ambient.l * (1 + (variation.ambientPresence - 0.5)), 5, 40),
      },
      contrast: palette.contrast, // Contraste no varía
      metadata: {
        ...palette.metadata,
        musicalDNA: {
          ...palette.metadata.musicalDNA,
          section,
        },
      },
    };
    
    this.emit('palette-variation', { section, palette: variedPalette });
    
    return variedPalette;
  }

  // ============================================================
  // MÉTODOS DE UTILIDAD
  // ============================================================

  /**
   * Obtiene la última paleta generada
   */
  getLastPalette(): SelenePalette | null {
    return this.lastGeneratedPalette;
  }

  /**
   * Obtiene el número de paletas generadas
   */
  getGenerationCount(): number {
    return this.generationCount;
  }

  /**
   * Convierte toda la paleta a formato hex
   */
  paletteToHex(palette: SelenePalette): Record<string, string> {
    return {
      primary: hslToHex(palette.primary),
      secondary: hslToHex(palette.secondary),
      accent: hslToHex(palette.accent),
      ambient: hslToHex(palette.ambient),
      contrast: hslToHex(palette.contrast),
    };
  }

  /**
   * Convierte toda la paleta a formato RGB
   */
  paletteToRgb(palette: SelenePalette): Record<string, RGBColor> {
    return {
      primary: hslToRgb(palette.primary),
      secondary: hslToRgb(palette.secondary),
      accent: hslToRgb(palette.accent),
      ambient: hslToRgb(palette.ambient),
      contrast: hslToRgb(palette.contrast),
    };
  }

  /**
   * Reset del estado interno
   */
  reset(): void {
    this.lastGeneratedPalette = null;
    this.generationCount = 0;
    console.log('🎨 [PALETTE-GENERATOR] Reset');
  }

  /**
   * Obtiene estadísticas
   */
  getStats(): {
    generationCount: number;
    lastPaletteAge: number | null;
    lastStrategy: string | null;
  } {
    return {
      generationCount: this.generationCount,
      lastPaletteAge: this.lastGeneratedPalette
        ? Date.now() - this.lastGeneratedPalette.metadata.generatedAt
        : null,
      lastStrategy: this.lastGeneratedPalette
        ? this.lastGeneratedPalette.metadata.colorStrategy
        : null,
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

/**
 * Factory function
 */
export function createProceduralPaletteGenerator(): ProceduralPaletteGenerator {
  return new ProceduralPaletteGenerator();
}

// Re-export constantes para testing
export const CONSTANTS = {
  KEY_TO_HUE,
  MODE_MODIFIERS,
  SECTION_VARIATIONS,
};
