/**
 * 🔮 WAVE 273: ELEMENTAL MODIFIERS
 * ============================================================================
 * El ADN físico de los 4 elementos zodiacales.
 * 
 * FILOSOFÍA: No cambiamos lógica, solo escalamos parámetros.
 * Cada motor de física (Techno, Rock, Latino, Chill) consulta estos
 * modificadores para adaptar su comportamiento al elemento de la Key.
 * 
 * ELEMENTOS:
 * 🔥 FIRE (Aries, Leo, Sagittarius) - Explosivo, Brillante, Cortante
 * 🌍 EARTH (Taurus, Virgo, Capricorn) - Sólido, Denso, Pesado
 * 💨 AIR (Gemini, Libra, Aquarius) - Errático, Nervioso, Jitter
 * 🌊 WATER (Cancer, Scorpio, Pisces) - Fluido, Profundo, Líquido
 * ============================================================================
 */

import { ZodiacElement, ZodiacAffinityCalculator } from './ZodiacAffinityCalculator';

// ═══════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modificadores físicos aplicados por el elemento zodiacal.
 * No cambian la lógica, solo escalan los parámetros.
 */
export interface ElementalModifiers {
  /** Multiplicador para umbrales de disparo ( >1 = más difícil, <1 = más fácil) */
  thresholdMultiplier: number;
  
  /** Multiplicador de brillo/intensidad (0.7 - 1.2) */
  brightnessMultiplier: number;
  
  /** Multiplicador de decay/cooldown ( >1 = más lento/líquido, <1 = más rápido/cortante) */
  decayMultiplier: number;
  
  /** Amplitud de ruido determinista para posiciones (Solo Aire tiene valor > 0) */
  jitterAmplitude: number;
  
  /** Nombre del elemento para logging */
  elementName: ZodiacElement;
  
  /** Símbolo del signo para logging */
  signSymbol: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY TO ZODIAC MAPPING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapeo de Nota Musical (Key) a Índice Zodiacal (0-11)
 * Basado en escala cromática: C = Aries (0)
 * 
 * Soporta:
 * - Notas simples: "C", "D", "E", etc.
 * - Con sostenido: "C#", "F#", etc.
 * - Con bemol: "Db", "Bb", etc.
 * - Con modo: "Am", "F#m", "Bbm", etc.
 * - Formato completo: "A minor", "C major", etc.
 */
export const KEY_TO_ZODIAC: Record<string, number> = {
  // ♈ Aries (Fire) - C
  'C': 0, 'Cm': 0, 'C major': 0, 'C minor': 0,
  
  // ♉ Taurus (Earth) - C#/Db
  'C#': 1, 'C#m': 1, 'C# major': 1, 'C# minor': 1,
  'Db': 1, 'Dbm': 1, 'Db major': 1, 'Db minor': 1,
  
  // ♊ Gemini (Air) - D
  'D': 2, 'Dm': 2, 'D major': 2, 'D minor': 2,
  
  // ♋ Cancer (Water) - D#/Eb
  'D#': 3, 'D#m': 3, 'D# major': 3, 'D# minor': 3,
  'Eb': 3, 'Ebm': 3, 'Eb major': 3, 'Eb minor': 3,
  
  // ♌ Leo (Fire) - E
  'E': 4, 'Em': 4, 'E major': 4, 'E minor': 4,
  
  // ♍ Virgo (Earth) - F
  'F': 5, 'Fm': 5, 'F major': 5, 'F minor': 5,
  
  // ♎ Libra (Air) - F#/Gb
  'F#': 6, 'F#m': 6, 'F# major': 6, 'F# minor': 6,
  'Gb': 6, 'Gbm': 6, 'Gb major': 6, 'Gb minor': 6,
  
  // ♏ Scorpio (Water) - G
  'G': 7, 'Gm': 7, 'G major': 7, 'G minor': 7,
  
  // ♐ Sagittarius (Fire) - G#/Ab
  'G#': 8, 'G#m': 8, 'G# major': 8, 'G# minor': 8,
  'Ab': 8, 'Abm': 8, 'Ab major': 8, 'Ab minor': 8,
  
  // ♑ Capricorn (Earth) - A
  'A': 9, 'Am': 9, 'A major': 9, 'A minor': 9,
  
  // ♒ Aquarius (Air) - A#/Bb
  'A#': 10, 'A#m': 10, 'A# major': 10, 'A# minor': 10,
  'Bb': 10, 'Bbm': 10, 'Bb major': 10, 'Bb minor': 10,
  
  // ♓ Pisces (Water) - B
  'B': 11, 'Bm': 11, 'B major': 11, 'B minor': 11,
};

/**
 * Símbolos zodiacales para logging bonito
 */
const ZODIAC_SYMBOLS: string[] = [
  '♈', '♉', '♊', '♋', '♌', '♍',
  '♎', '♏', '♐', '♑', '♒', '♓'
];

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENTAL PHYSICS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuración física de los 4 elementos
 * 
 * Estos valores son multiplicadores que se aplican a los parámetros base
 * de cada motor físico (Techno, Rock, Latino, Chill).
 */
const ELEMENTAL_PHYSICS: Record<ZodiacElement, Omit<ElementalModifiers, 'elementName' | 'signSymbol'>> = {
  /**
   * 🔥 FIRE - Ira, Pasión, Explosión
   * Signos: ♈ Aries (C), ♌ Leo (E), ♐ Sagittarius (G#)
   */
  fire: {
    thresholdMultiplier: 0.7,   // Gatillo FÁCIL (dispara más)
    brightnessMultiplier: 1.15, // Más BRILLANTE (explosivo)
    decayMultiplier: 0.6,       // Decay RÁPIDO (cortante)
    jitterAmplitude: 0.03,      // Micro-temblor de llama
  },
  
  /**
   * 🌍 EARTH - Material, Sólido, Stomp
   * Signos: ♉ Taurus (C#), ♍ Virgo (F), ♑ Capricorn (A)
   */
  earth: {
    thresholdMultiplier: 0.8,   // Sensible a GRAVES (stomp)
    brightnessMultiplier: 0.95, // Ligeramente más OSCURO
    decayMultiplier: 1.2,       // Decay MEDIO (pesado)
    jitterAmplitude: 0.0,       // Sin jitter (estable)
  },
  
  /**
   * 💨 AIR - Mente, Nervio, Viento
   * Signos: ♊ Gemini (D), ♎ Libra (F#), ♒ Aquarius (A#)
   */
  air: {
    thresholdMultiplier: 0.9,   // Normal
    brightnessMultiplier: 1.0,  // Normal
    decayMultiplier: 0.8,       // Decay MODERADO
    jitterAmplitude: 0.15,      // MUCHO jitter (viento errático)
  },
  
  /**
   * 🌊 WATER - Emociones, Fluido, Profundo
   * Signos: ♋ Cancer (D#), ♏ Scorpio (G), ♓ Pisces (B)
   */
  water: {
    thresholdMultiplier: 1.3,   // Difícil de disparar (calma)
    brightnessMultiplier: 0.85, // Más SUAVE (profundo)
    decayMultiplier: 1.8,       // Decay MUY LENTO (líquido)
    jitterAmplitude: 0.0,       // Fluido sin interrupciones
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los modificadores elementales basados en la Key musical.
 * 
 * @param key - La tonalidad detectada (ej: "A", "F#m", "A minor")
 * @returns ElementalModifiers con todos los coeficientes del elemento
 * 
 * @example
 * ```typescript
 * const mods = getModifiersFromKey("A minor");
 * // mods.elementName = "earth" (A = Capricorn = Earth)
 * // mods.thresholdMultiplier = 0.8
 * ```
 */
export function getModifiersFromKey(key: string | null | undefined): ElementalModifiers {
  // Fallback a Earth (neutro/sólido) si no hay key
  if (!key) {
    return {
      ...ELEMENTAL_PHYSICS.earth,
      elementName: 'earth',
      signSymbol: '♑', // Capricorn default
    };
  }
  
  // Intentar buscar la key directamente
  let signIndex = KEY_TO_ZODIAC[key];
  
  // Si no se encuentra, extraer solo la nota base
  if (signIndex === undefined) {
    // Extraer nota base de formatos como "A minor", "F# major", etc.
    const noteMatch = key.match(/^([A-G][#b]?)/i);
    if (noteMatch) {
      const baseNote = noteMatch[1].toUpperCase();
      signIndex = KEY_TO_ZODIAC[baseNote];
    }
  }
  
  // Si aún no tenemos índice, fallback a Earth
  if (signIndex === undefined) {
    console.log(`[Elemental 🔮] Key "${key}" no reconocida → fallback EARTH`);
    return {
      ...ELEMENTAL_PHYSICS.earth,
      elementName: 'earth',
      signSymbol: '♑',
    };
  }
  
  // Obtener elemento del signo zodiacal
  const element = ZodiacAffinityCalculator.getElement(signIndex);
  const signSymbol = ZODIAC_SYMBOLS[signIndex];
  
  return {
    ...ELEMENTAL_PHYSICS[element],
    elementName: element,
    signSymbol,
  };
}

/**
 * Obtiene el elemento zodiacal de una Key musical.
 * Versión simplificada que solo retorna el elemento.
 */
export function getElementFromKey(key: string | null | undefined): ZodiacElement {
  return getModifiersFromKey(key).elementName;
}

/**
 * Obtiene los modificadores base de un elemento (sin calcular desde Key).
 */
export function getModifiersFromElement(element: ZodiacElement): ElementalModifiers {
  const symbolMap: Record<ZodiacElement, string> = {
    fire: '🔥',
    earth: '🌍',
    air: '💨',
    water: '🌊',
  };
  
  return {
    ...ELEMENTAL_PHYSICS[element],
    elementName: element,
    signSymbol: symbolMap[element],
  };
}

/**
 * Modifiers vacíos para cuando no queremos modificación elemental.
 * Todos los multiplicadores son 1.0 (neutros).
 */
export const NEUTRAL_MODIFIERS: ElementalModifiers = {
  thresholdMultiplier: 1.0,
  brightnessMultiplier: 1.0,
  decayMultiplier: 1.0,
  jitterAmplitude: 0.0,
  elementName: 'earth',
  signSymbol: '⚪',
};
