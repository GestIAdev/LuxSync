// MusicalHarmonyValidator.ts
// 🎵 MUSICAL HARMONY VALIDATOR - LA SINFONÍA DE LA LUZ
// 🎯 "Cada frecuencia es una nota, cada patrón una melodía"
// ⚡ Wave 6: THE UNDYING MEMORY - Harmonic Beauty Filter
// 🔀 Adaptado de legacy para LuxSync - teoría musical para iluminación

/**
 * Escala musical con sus intervalos
 */
export interface MusicalScale {
  name: string;
  intervals: number[];
  mood: 'bright' | 'dark' | 'neutral' | 'exotic' | 'tense';
  energy: number;
}

/**
 * Emoción de una clave musical
 */
export interface KeyEmotion {
  /** Nivel de energía (0-1) */
  energy: number;
  /** Nivel de brillo (0-1) */
  brightness: number;
  /** Nivel de tensión (0-1) */
  tension: number;
  /** Color asociado */
  color: string;
}

/**
 * Resultado de validación de armonía
 */
export interface HarmonyValidation {
  /** Score de armonía total (0-1) */
  harmony: number;
  /** Nivel de disonancia (0-1) */
  dissonance: number;
  /** Nivel de resonancia (0-1) */
  resonance: number;
  /** Descripción poética */
  description: string;
  /** Color sugerido basado en la armonía */
  suggestedColor: string;
}

/**
 * 🎵 MUSICAL HARMONY VALIDATOR
 * Valida y calcula armonía musical para scoring de patrones sonoros
 * Útil para sincronizar estados de luz con teoría musical
 * 
 * @example
 * ```typescript
 * const harmony = MusicalHarmonyValidator.validateMusicalHarmony('A', 'minor');
 * console.log(harmony); // Score de armonía para A menor
 * ```
 */
export class MusicalHarmonyValidator {
  /**
   * 14 escalas musicales con sus intervalos (semitonos desde raíz)
   */
  static readonly MUSICAL_SCALES: Record<string, MusicalScale> = {
    major: {
      name: 'Mayor',
      intervals: [0, 2, 4, 5, 7, 9, 11],
      mood: 'bright',
      energy: 0.8
    },
    minor: {
      name: 'Menor Natural',
      intervals: [0, 2, 3, 5, 7, 8, 10],
      mood: 'dark',
      energy: 0.5
    },
    dorian: {
      name: 'Dórico',
      intervals: [0, 2, 3, 5, 7, 9, 10],
      mood: 'neutral',
      energy: 0.6
    },
    phrygian: {
      name: 'Frigio',
      intervals: [0, 1, 3, 5, 7, 8, 10],
      mood: 'exotic',
      energy: 0.7
    },
    lydian: {
      name: 'Lidio',
      intervals: [0, 2, 4, 6, 7, 9, 11],
      mood: 'bright',
      energy: 0.9
    },
    mixolydian: {
      name: 'Mixolidio',
      intervals: [0, 2, 4, 5, 7, 9, 10],
      mood: 'bright',
      energy: 0.7
    },
    locrian: {
      name: 'Locrio',
      intervals: [0, 1, 3, 5, 6, 8, 10],
      mood: 'tense',
      energy: 0.4
    },
    harmonicMinor: {
      name: 'Menor Armónica',
      intervals: [0, 2, 3, 5, 7, 8, 11],
      mood: 'exotic',
      energy: 0.6
    },
    melodicMinor: {
      name: 'Menor Melódica',
      intervals: [0, 2, 3, 5, 7, 9, 11],
      mood: 'neutral',
      energy: 0.6
    },
    pentatonic: {
      name: 'Pentatónica',
      intervals: [0, 2, 4, 7, 9],
      mood: 'neutral',
      energy: 0.7
    },
    blues: {
      name: 'Blues',
      intervals: [0, 3, 5, 6, 7, 10],
      mood: 'dark',
      energy: 0.6
    },
    wholeTone: {
      name: 'Tons Enteros',
      intervals: [0, 2, 4, 6, 8, 10],
      mood: 'exotic',
      energy: 0.5
    },
    diminished: {
      name: 'Disminuida',
      intervals: [0, 2, 3, 5, 6, 8, 9, 11],
      mood: 'tense',
      energy: 0.4
    },
    augmented: {
      name: 'Aumentada',
      intervals: [0, 3, 4, 7, 8, 11],
      mood: 'tense',
      energy: 0.5
    }
  };

  /**
   * Pesos de armonía para intervalos musicales
   * 0 = disonancia total, 1 = consonancia perfecta
   */
  static readonly HARMONY_WEIGHTS: Record<string, number> = {
    unison: 1.0,          // 0 semitonos - unísono perfecto
    minorSecond: 0.1,     // 1 semitono - muy disonante
    majorSecond: 0.3,     // 2 semitonos - disonante suave
    minorThird: 0.7,      // 3 semitonos - consonante menor
    majorThird: 0.8,      // 4 semitonos - consonante mayor
    perfectFourth: 0.9,   // 5 semitonos - consonante
    tritone: 0.0,         // 6 semitonos - diabulus in musica
    perfectFifth: 1.0,    // 7 semitonos - consonancia perfecta
    minorSixth: 0.6,      // 8 semitonos - consonante
    majorSixth: 0.7,      // 9 semitonos - consonante
    minorSeventh: 0.4,    // 10 semitonos - disonante suave
    majorSeventh: 0.2,    // 11 semitonos - disonante
    octave: 1.0           // 12 semitonos - consonancia perfecta
  };

  /**
   * Emociones asociadas a cada clave musical
   */
  static readonly KEY_EMOTIONS: Record<string, KeyEmotion> = {
    'C': { energy: 0.5, brightness: 0.8, tension: 0.2, color: '#FFFFFF' },  // Blanco - pureza
    'C#': { energy: 0.6, brightness: 0.4, tension: 0.5, color: '#8B0000' }, // Rojo oscuro
    'D': { energy: 0.7, brightness: 0.7, tension: 0.3, color: '#FFA500' },  // Naranja
    'D#': { energy: 0.5, brightness: 0.3, tension: 0.6, color: '#4B0082' }, // Índigo
    'E': { energy: 0.8, brightness: 0.9, tension: 0.2, color: '#FFFF00' },  // Amarillo
    'F': { energy: 0.4, brightness: 0.5, tension: 0.4, color: '#228B22' },  // Verde bosque
    'F#': { energy: 0.6, brightness: 0.4, tension: 0.7, color: '#800080' }, // Púrpura
    'G': { energy: 0.9, brightness: 0.8, tension: 0.1, color: '#FF4500' },  // Naranja-rojo
    'G#': { energy: 0.5, brightness: 0.3, tension: 0.5, color: '#191970' }, // Azul medianoche
    'A': { energy: 0.6, brightness: 0.6, tension: 0.3, color: '#FF0000' },  // Rojo - 440Hz
    'A#': { energy: 0.7, brightness: 0.5, tension: 0.6, color: '#9400D3' }, // Violeta oscuro
    'B': { energy: 0.8, brightness: 0.7, tension: 0.4, color: '#00CED1' }   // Turquesa
  };

  /**
   * Valida la armonía de una combinación clave-escala
   * @param key - Clave musical (C, C#, D, etc.)
   * @param scale - Tipo de escala (major, minor, etc.)
   * @returns Score de armonía (0-1)
   * 
   * @example
   * ```typescript
   * const harmony = MusicalHarmonyValidator.validateMusicalHarmony('A', 'minor');
   * console.log(harmony); // ~0.65
   * ```
   */
  static validateMusicalHarmony(key: string, scale: string): number {
    const scaleData = this.MUSICAL_SCALES[scale];
    if (!scaleData) return 0.5; // Default si escala no existe
    
    const keyEmotion = this.KEY_EMOTIONS[key];
    if (!keyEmotion) return 0.5; // Default si clave no existe
    
    // Calcular armonía basada en intervalos de la escala
    const intervalHarmony = this.calculateIntervalHarmony(scaleData.intervals);
    
    // Combinar con energía de escala y brillo de clave
    const moodMatch = this.calculateMoodMatch(scaleData.mood, keyEmotion);
    
    // Ponderación: 60% intervalos, 40% mood
    return (intervalHarmony * 0.6) + (moodMatch * 0.4);
  }

  /**
   * Calcula armonía promedio de intervalos de una escala
   */
  private static calculateIntervalHarmony(intervals: number[]): number {
    if (intervals.length === 0) return 0;
    
    let totalHarmony = 0;
    let comparisons = 0;
    
    // Comparar cada par de notas adyacentes
    for (let i = 0; i < intervals.length - 1; i++) {
      const interval = intervals[i + 1] - intervals[i];
      const weight = this.getIntervalWeight(interval);
      totalHarmony += weight;
      comparisons++;
    }
    
    return comparisons > 0 ? totalHarmony / comparisons : 0;
  }

  /**
   * Obtiene peso de armonía para un intervalo
   */
  private static getIntervalWeight(semitones: number): number {
    const normalized = Math.abs(semitones) % 12;
    const intervalNames = [
      'unison', 'minorSecond', 'majorSecond', 'minorThird',
      'majorThird', 'perfectFourth', 'tritone', 'perfectFifth',
      'minorSixth', 'majorSixth', 'minorSeventh', 'majorSeventh'
    ];
    return this.HARMONY_WEIGHTS[intervalNames[normalized]] ?? 0.5;
  }

  /**
   * Calcula compatibilidad entre mood de escala y emoción de clave
   */
  private static calculateMoodMatch(mood: string, emotion: KeyEmotion): number {
    switch (mood) {
      case 'bright':
        return emotion.brightness;
      case 'dark':
        return 1 - emotion.brightness;
      case 'tense':
        return emotion.tension;
      case 'exotic':
        return (emotion.energy + emotion.tension) / 2;
      case 'neutral':
      default:
        return 0.5 + (emotion.energy - 0.5) * 0.5;
    }
  }

  /**
   * Calcula nivel de disonancia de una escala
   * @param scale - Nombre de la escala
   * @returns Nivel de disonancia (0-1)
   */
  static calculateDissonance(scale: string): number {
    const scaleData = this.MUSICAL_SCALES[scale];
    if (!scaleData) return 0.5;
    
    // Contar intervalos disonantes
    let dissonanceSum = 0;
    const intervals = scaleData.intervals;
    
    for (let i = 0; i < intervals.length - 1; i++) {
      const interval = intervals[i + 1] - intervals[i];
      const harmony = this.getIntervalWeight(interval);
      dissonanceSum += (1 - harmony);
    }
    
    return intervals.length > 1 ? dissonanceSum / (intervals.length - 1) : 0;
  }

  /**
   * Calcula resonancia entre clave y escala
   * @param key - Clave musical
   * @param scale - Tipo de escala
   * @returns Nivel de resonancia (0-1)
   */
  static calculateResonance(key: string, scale: string): number {
    const harmony = this.validateMusicalHarmony(key, scale);
    const dissonance = this.calculateDissonance(scale);
    
    // Resonancia es alta armonía + baja disonancia
    return (harmony + (1 - dissonance)) / 2;
  }

  /**
   * Validación completa de armonía con descripción
   * @param key - Clave musical
   * @param scale - Tipo de escala
   * @returns Objeto completo de validación
   */
  static validateComplete(key: string, scale: string): HarmonyValidation {
    const harmony = this.validateMusicalHarmony(key, scale);
    const dissonance = this.calculateDissonance(scale);
    const resonance = this.calculateResonance(key, scale);
    
    const keyEmotion = this.KEY_EMOTIONS[key] || this.KEY_EMOTIONS['C'];
    
    const description = this.generateMusicalDescription(key, scale, harmony);
    
    return {
      harmony,
      dissonance,
      resonance,
      description,
      suggestedColor: keyEmotion.color
    };
  }

  /**
   * Genera descripción poética de la armonía
   */
  static generateMusicalDescription(key: string, scale: string, harmony: number): string {
    const harmonyLevel = harmony > 0.8 ? 'divina' :
                        harmony > 0.6 ? 'armoniosa' :
                        harmony > 0.4 ? 'tensa' :
                        harmony > 0.2 ? 'discordante' : 'caótica';

    const keyEmotion = this.KEY_EMOTIONS[key];
    const energy = keyEmotion?.energy || 0.5;
    const brightness = keyEmotion?.brightness || 0.5;

    const energyDesc = energy > 0.7 ? 'vibrante' :
                      energy > 0.4 ? 'equilibrada' : 'serena';

    const brightnessDesc = brightness > 0.7 ? 'radiante' :
                          brightness > 0.4 ? 'cálida' : 'misteriosa';

    const scaleData = this.MUSICAL_SCALES[scale];
    const scaleName = scaleData?.name || scale;

    return `Una sinfonía ${harmonyLevel} en ${key} ${energyDesc} y ${brightnessDesc}, interpretada en escala ${scaleName}`;
  }

  /**
   * Valida progresión de claves musicales
   * @param keys - Array de claves
   * @returns true si la progresión es armónica
   */
  static validateHarmonyProgression(keys: string[]): boolean {
    if (keys.length < 2) return true;
    if (keys.length > 5) return false; // Máximo 5 cambios para estabilidad
    
    let totalHarmony = 0;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const transitionHarmony = this.calculateKeyTransition(keys[i], keys[i + 1]);
      totalHarmony += transitionHarmony;
    }
    
    const averageHarmony = totalHarmony / (keys.length - 1);
    return averageHarmony >= 0.5;
  }

  /**
   * Calcula armonía de transición entre dos claves
   */
  static calculateKeyTransition(key1: string, key2: string): number {
    const emotion1 = this.KEY_EMOTIONS[key1];
    const emotion2 = this.KEY_EMOTIONS[key2];
    
    if (!emotion1 || !emotion2) return 0.5;
    
    // Calcular distancia tonal
    const keys = Object.keys(this.KEY_EMOTIONS);
    const idx1 = keys.indexOf(key1);
    const idx2 = keys.indexOf(key2);
    const distance = Math.min(
      Math.abs(idx1 - idx2),
      12 - Math.abs(idx1 - idx2)
    );
    
    // Afinidad máxima a quinta (7 semitonos = 5 posiciones) o cuarta (5 semitonos = 4 posiciones)
    const tonalAffinity = distance <= 2 ? 1.0 :
                          distance <= 4 ? 0.8 :
                          distance <= 6 ? 0.5 : 0.3;
    
    // Compatibilidad emocional
    const emotionalCompatibility = 1 - Math.abs(emotion1.energy - emotion2.energy) * 0.5;
    
    return (tonalAffinity + emotionalCompatibility) / 2;
  }

  /**
   * Genera clave musical basada en ratio de armonía
   * @param harmonyRatio - Ratio (0-1)
   * @returns Clave musical
   */
  static generateMusicalKey(harmonyRatio: number): string {
    const keys = Object.keys(this.KEY_EMOTIONS);
    const index = Math.floor(harmonyRatio * keys.length);
    return keys[index % keys.length];
  }

  /**
   * Obtiene color sugerido para una clave
   * @param key - Clave musical
   * @returns Color en formato hex
   */
  static getKeyColor(key: string): string {
    return this.KEY_EMOTIONS[key]?.color || '#FFFFFF';
  }

  /**
   * Obtiene emoción de una clave
   * @param key - Clave musical
   * @returns Objeto KeyEmotion
   */
  static getKeyEmotion(key: string): KeyEmotion | undefined {
    return this.KEY_EMOTIONS[key];
  }

  /**
   * Obtiene todas las escalas disponibles
   */
  static getAvailableScales(): string[] {
    return Object.keys(this.MUSICAL_SCALES);
  }

  /**
   * Obtiene todas las claves disponibles
   */
  static getAvailableKeys(): string[] {
    return Object.keys(this.KEY_EMOTIONS);
  }

  /**
   * Obtiene información de una escala
   * @param scale - Nombre de escala
   */
  static getScaleInfo(scale: string): MusicalScale | undefined {
    return this.MUSICAL_SCALES[scale];
  }

  /**
   * Sugiere escala basada en energía deseada
   * @param targetEnergy - Energía objetivo (0-1)
   * @returns Nombre de escala sugerida
   */
  static suggestScaleByEnergy(targetEnergy: number): string {
    let closest = 'major';
    let minDiff = Infinity;
    
    for (const [name, scale] of Object.entries(this.MUSICAL_SCALES)) {
      const diff = Math.abs(scale.energy - targetEnergy);
      if (diff < minDiff) {
        minDiff = diff;
        closest = name;
      }
    }
    
    return closest;
  }

  /**
   * Sugiere clave basada en brillo deseado
   * @param targetBrightness - Brillo objetivo (0-1)
   * @returns Clave sugerida
   */
  static suggestKeyByBrightness(targetBrightness: number): string {
    let closest = 'C';
    let minDiff = Infinity;
    
    for (const [key, emotion] of Object.entries(this.KEY_EMOTIONS)) {
      const diff = Math.abs(emotion.brightness - targetBrightness);
      if (diff < minDiff) {
        minDiff = diff;
        closest = key;
      }
    }
    
    return closest;
  }
}
