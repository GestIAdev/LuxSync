// musical-harmony-validator.ts
// 🔥 MUSICAL HARMONY VALIDATOR - LA SINFONÍA EVOLUTIVA
// 🎯 "La armonía musical es el lenguaje matemático del alma creativa"
// ⚡ Arquitecto: PunkGrok + Radwulf

/**
 * 🎼 VALIDADOR DE ARMONÍA MUSICAL
 * Valida y genera armonías musicales deterministas para evolución creativa
 */
export class MusicalHarmonyValidator {
  // Escalas musicales - fundamentos armónicos
  private static readonly MUSICAL_SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], // Do mayor
    minor: [0, 2, 3, 5, 7, 8, 10], // La menor
    dorian: [0, 2, 3, 5, 7, 9, 10], // Re dorio
    phrygian: [0, 1, 3, 5, 7, 8, 10], // Mi frigio
    lydian: [0, 2, 4, 6, 7, 9, 11], // Fa lidio
    mixolydian: [0, 2, 4, 5, 7, 9, 10], // Sol mixolidio
    locrian: [0, 1, 3, 5, 6, 8, 10], // Si locrio
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // La menor armónica
    melodicMinor: [0, 2, 3, 5, 7, 9, 11], // La menor melódica
    pentatonic: [0, 2, 4, 7, 9], // Pentatónica mayor
    blues: [0, 3, 5, 6, 7, 10], // Blues
    wholeTone: [0, 2, 4, 6, 8, 10], // Tonos enteros
    diminished: [0, 2, 3, 5, 6, 8, 9, 11], // Disminuida
    augmented: [0, 3, 4, 7, 8, 11] // Aumentada
  } as const;

  // Intervalos armónicos y su estabilidad percibida
  private static readonly HARMONY_WEIGHTS = {
    unison: 1.0, // Unísono - máxima estabilidad
    minorSecond: 0.1, // Segunda menor - máxima tensión
    majorSecond: 0.3, // Segunda mayor - tensión moderada
    minorThird: 0.7, // Tercera menor - consonancia imperfecta
    majorThird: 0.8, // Tercera mayor - consonancia
    perfectFourth: 0.9, // Cuarta justa - estabilidad
    tritone: 0.0, // Tritono - máxima disonancia
    perfectFifth: 1.0, // Quinta justa - máxima consonancia
    minorSixth: 0.6, // Sexta menor
    majorSixth: 0.7, // Sexta mayor
    minorSeventh: 0.4, // Séptima menor
    majorSeventh: 0.5, // Séptima mayor
    octave: 0.9 // Octava - estabilidad cíclica
  } as const;

  // Claves musicales y su energía emocional
  private static readonly KEY_EMOTIONS = {
    C: { energy: 0.8, brightness: 0.9, tension: 0.3 },
    D: { energy: 0.7, brightness: 0.8, tension: 0.4 },
    E: { energy: 0.9, brightness: 0.7, tension: 0.6 },
    F: { energy: 0.6, brightness: 0.8, tension: 0.2 },
    G: { energy: 0.8, brightness: 0.8, tension: 0.4 },
    A: { energy: 0.7, brightness: 0.6, tension: 0.5 },
    B: { energy: 0.8, brightness: 0.5, tension: 0.7 },
    'C#': { energy: 0.9, brightness: 0.4, tension: 0.8 },
    'D#': { energy: 0.6, brightness: 0.7, tension: 0.5 },
    'F#': { energy: 0.8, brightness: 0.6, tension: 0.6 },
    'G#': { energy: 0.7, brightness: 0.5, tension: 0.7 },
    'A#': { energy: 0.5, brightness: 0.8, tension: 0.4 }
  } as const;

  /**
   * Valida armonía musical de una clave y escala
   * @param key - Clave musical (C, D, E, F, G, A, B + sostenidos)
   * @param scale - Tipo de escala
   * @returns Nivel de armonía (0-1)
   */
  static validateMusicalHarmony(key: string, scale: keyof typeof MusicalHarmonyValidator.MUSICAL_SCALES): number {
    if (!this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS]) {
      return 0; // Clave inválida
    }

    const keyEmotion = this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS];
    const scaleNotes = this.MUSICAL_SCALES[scale];

    if (!scaleNotes) {
      return 0; // Escala inválida
    }

    // Calcular estabilidad armónica de la escala
    let harmonySum = 0;
    let intervalCount = 0;

    for (let i = 0; i < scaleNotes.length; i++) {
      for (let j = i + 1; j < scaleNotes.length; j++) {
        const interval = Math.abs(scaleNotes[j] - scaleNotes[i]) % 12;
        const harmonyWeight = this.getHarmonyWeight(interval);
        harmonySum += harmonyWeight;
        intervalCount++;
      }
    }

    const scaleHarmony = intervalCount > 0 ? harmonySum / intervalCount : 0;

    // Combinar con energía emocional de la clave
    const overallHarmony = (
      scaleHarmony * 0.7 +
      keyEmotion.brightness * 0.2 +
      (1 - keyEmotion.tension) * 0.1
    );

    return Math.max(0, Math.min(1, overallHarmony));
  }

  /**
   * Obtiene peso armónico de un intervalo
   * @param interval - Intervalo en semitonos (0-11)
   * @returns Peso armónico (0-1)
   */
  private static getHarmonyWeight(interval: number): number {
    const intervalNames = [
      'unison', 'minorSecond', 'majorSecond', 'minorThird', 'majorThird',
      'perfectFourth', 'tritone', 'perfectFifth', 'minorSixth', 'majorSixth',
      'minorSeventh', 'majorSeventh'
    ] as const;

    const intervalName = intervalNames[interval % 12];
    return this.HARMONY_WEIGHTS[intervalName] || 0;
  }

  /**
   * Convierte secuencia Fibonacci a intervalos musicales [0-11]
   * @param fibSequence - Secuencia de números Fibonacci
   * @returns Array de intervalos musicales (0-11)
   */
  static convertFibonacciToMusicalIntervals(fibSequence: number[]): number[] {
    return fibSequence.map(num => num % 12);
  }

  /**
   * Calcula nivel de disonancia para una escala [0-1]
   * @param scale - Nombre de la escala musical
   * @returns Nivel de disonancia (0 = consonante, 1 = muy disonante)
   */
  static calculateDissonance(scale: string): number {
    const scaleIntervals = this.MUSICAL_SCALES[scale as keyof typeof this.MUSICAL_SCALES];
    if (!scaleIntervals) return 0.5; // Escala desconocida = disonancia media

    // Contar intervalos disonantes (semitonos y tritonos)
    let dissonanceScore = 0;
    for (let i = 0; i < scaleIntervals.length - 1; i++) {
      const interval = scaleIntervals[i + 1] - scaleIntervals[i];
      // Semitono (1) o tritono (6) = disonante
      if (interval === 1 || interval === 6) {
        dissonanceScore++;
      }
    }

    // Normalizar: escalas con más notas tienen más oportunidades de disonancia
    return Math.min(dissonanceScore / Math.max(scaleIntervals.length - 1, 1), 1.0);
  }

  /**
   * Calcula resonancia emocional [0-1]
   * @param key - Clave musical
   * @param scale - Nombre de la escala
   * @returns Nivel de resonancia (0 = baja, 1 = alta)
   */
  static calculateResonance(key: string, scale: string): number {
    const keyEmotion = this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS];
    if (!keyEmotion) return 0.5; // Clave desconocida = resonancia media

    const dissonance = this.calculateDissonance(scale);

    // Resonancia = inverso de disonancia + factor emocional (brightness)
    const baseResonance = 1 - dissonance;
    const emotionalBoost = keyEmotion.brightness * 0.3;

    return Math.min(baseResonance + emotionalBoost, 1.0);
  }

  /**
   * Genera descripción poética de la armonía
   * @param key - Clave musical
   * @param scale - Nombre de la escala
   * @param harmony - Nivel de armonía (0-1)
   * @returns Descripción poética
   */
  static generateHarmonyDescription(key: string, scale: string, harmony: number): string {
    const keyEmotion = this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS];
    
    // Descriptores emocionales basados en KEY_EMOTIONS
    const emotionalDesc = keyEmotion
      ? keyEmotion.brightness > 0.7
        ? 'brillante claridad'
        : keyEmotion.brightness > 0.5
        ? 'calidez vibrante'
        : 'misterio profundo'
      : 'una cualidad neutral';

    // Nivel de armonía
    const harmonyLevel = harmony > 0.8 ? 'celestial' : harmony > 0.6 ? 'armoniosa' : 'exploradora';

    return `La ${emotionalDesc} de ${key} ${scale} resuena con armonía ${harmonyLevel} (${harmony.toFixed(2)})`;
  }

  /**
   * Genera descripción musical poética
   * @param key - Clave musical
   * @param scale - Tipo de escala
   * @param harmony - Nivel de armonía
   * @returns Descripción poética
   */
  static generateMusicalDescription(key: string, scale: string, harmony: number): string {
    const harmonyLevel = harmony > 0.8 ? 'divina' :
                        harmony > 0.6 ? 'armoniosa' :
                        harmony > 0.4 ? 'tensa' :
                        harmony > 0.2 ? 'discordante' : 'caótica';

    const keyEmotion = this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS];
    const energy = keyEmotion?.energy || 0.5;
    const brightness = keyEmotion?.brightness || 0.5;

    const energyDesc = energy > 0.7 ? 'vibrante' :
                      energy > 0.4 ? 'equilibrada' : 'serena';

    const brightnessDesc = brightness > 0.7 ? 'radiante' :
                          brightness > 0.4 ? 'cálida' : 'misteriosa';

    const scaleDescriptions = {
      major: 'la escala real de la claridad',
      minor: 'la escala sombría de la profundidad',
      dorian: 'el modo ancestral de la sabiduría',
      phrygian: 'el modo apasionado del fuego interior',
      lydian: 'el modo etéreo de la elevación',
      mixolydian: 'el modo terrenal de la celebración',
      locrian: 'el modo oscuro de la transformación',
      harmonicMinor: 'la escala melancólica de la nostalgia',
      melodicMinor: 'el camino ascendente de la esperanza',
      pentatonic: 'la simplicidad ancestral de las esencias',
      blues: 'el lamento universal del alma',
      wholeTone: 'la suspensión infinita del misterio',
      diminished: 'la tensión cíclica de la evolución',
      augmented: 'la expansión cósmica de la posibilidad'
    };

    const scaleDesc = scaleDescriptions[scale as keyof typeof scaleDescriptions] || 'un modo de misterios musicales';

    return `Una sinfonía ${harmonyLevel} en ${key} ${energyDesc} y ${brightnessDesc}, interpretada en ${scaleDesc}`;
  }

  /**
   * Valida progresión armónica
   * @param keys - Array de claves musicales
   * @returns true si la progresión es armónica
   */
  static validateHarmonyProgression(keys: string[]): boolean {
    if (keys.length < 2) return true;
    if (keys.length > 5) return false; // Máximo 5 cambios para evolución equilibrada

    let totalHarmony = 0;
    let transitions = 0;

    for (let i = 0; i < keys.length - 1; i++) {
      const key1 = keys[i];
      const key2 = keys[i + 1];

      const harmony1 = this.calculateKeyHarmony(key1);
      const harmony2 = this.calculateKeyHarmony(key2);

      // Calcular transición armónica
      const transitionHarmony = this.calculateKeyTransition(key1, key2);
      totalHarmony += (harmony1 + harmony2 + transitionHarmony) / 3;
      transitions++;
    }

    const averageHarmony = transitions > 0 ? totalHarmony / transitions : 0;
    return averageHarmony >= 0.5; // Requiere armonía promedio del 50%
  }

  /**
   * Calcula armonía de una clave individual
   * @param key - Clave musical
   * @returns Nivel de armonía (0-1)
   */
  private static calculateKeyHarmony(key: string): number {
    const emotion = this.KEY_EMOTIONS[key as keyof typeof this.KEY_EMOTIONS];
    if (!emotion) return 0;

    return (emotion.energy + emotion.brightness + (1 - emotion.tension)) / 3;
  }

  /**
   * Calcula armonía de transición entre claves
   * @param key1 - Primera clave
   * @param key2 - Segunda clave
   * @returns Armonía de transición (0-1)
   */
  private static calculateKeyTransition(key1: string, key2: string): number {
    const emotion1 = this.KEY_EMOTIONS[key1 as keyof typeof this.KEY_EMOTIONS];
    const emotion2 = this.KEY_EMOTIONS[key2 as keyof typeof this.KEY_EMOTIONS];

    if (!emotion1 || !emotion2) return 0;

    // Calcular distancia tonal (afinidad entre claves relacionadas)
    const keyDistance = Math.abs(this.getKeyIndex(key1) - this.getKeyIndex(key2));
    const tonalAffinity = Math.max(0, 1 - (keyDistance / 6)); // Máxima afinidad a 6 semitonos

    // Combinar con compatibilidad emocional
    const emotionalCompatibility = 1 - Math.abs(emotion1.energy - emotion2.energy) * 0.5;

    return (tonalAffinity + emotionalCompatibility) / 2;
  }

  /**
   * Obtiene índice numérico de una clave
   * @param key - Clave musical
   * @returns Índice (0-11)
   */
  private static getKeyIndex(key: string): number {
    const keyOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return keyOrder.indexOf(key);
  }

  /**
   * Genera clave musical basada en ratio de armonía
   * @param harmonyRatio - Ratio de armonía (0-1)
   * @returns Clave musical
   */
  static generateMusicalKey(harmonyRatio: number): string {
    const keys = Object.keys(this.KEY_EMOTIONS);
    const index = Math.floor(harmonyRatio * keys.length);
    return keys[index % keys.length];
  }

  /**
   * Obtiene todas las escalas disponibles
   * @returns Array de nombres de escalas
   */
  static getAvailableScales(): string[] {
    return Object.keys(this.MUSICAL_SCALES);
  }

  /**
   * Obtiene todas las claves disponibles
   * @returns Array de claves musicales
   */
  static getAvailableKeys(): string[] {
    return Object.keys(this.KEY_EMOTIONS);
  }
}

