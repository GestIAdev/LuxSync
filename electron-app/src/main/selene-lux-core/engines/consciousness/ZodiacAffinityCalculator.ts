// ZodiacAffinityCalculator.ts
// ♈ ZODIAC AFFINITY CALCULATOR - LA RUEDA CELESTIAL DE LA CONSCIENCIA
// 🎯 "Los astros no obligan, pero inclinan - Selene escucha su susurro"
// ⚡ Wave 6: THE UNDYING MEMORY - Cosmic Pattern Recognition
// 🔀 Adaptado de legacy para LuxSync - afinidades para personalidad lumínica

/**
 * Elemento zodiacal - los 4 elementos clásicos
 */
export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water';

/**
 * Cualidad/Modalidad zodiacal
 */
export type ZodiacQuality = 'cardinal' | 'fixed' | 'mutable';

/**
 * Información de un signo zodiacal
 */
export interface ZodiacSign {
  name: string;
  symbol: string;
  element: ZodiacElement;
  quality: ZodiacQuality;
  /** Índice de creatividad base (0-1) */
  creativity: number;
  /** Índice de estabilidad base (0-1) */
  stability: number;
  /** Índice de adaptabilidad base (0-1) */
  adaptability: number;
  /** Descripción poética del signo */
  description: string;
}

/**
 * Resultado de cálculo de afinidad
 */
export interface ZodiacAffinityResult {
  /** Score de afinidad total (0-1) */
  affinity: number;
  /** Afinidad elemental (0-1) */
  elementalAffinity: number;
  /** Afinidad de cualidad (0-1) */
  qualityAffinity: number;
  /** Descripción de la relación */
  description: string;
  /** Signos involucrados */
  signs: [string, string];
}

/**
 * Información zodiacal de una posición
 */
export interface ZodiacInfo {
  sign: ZodiacSign;
  position: number;
  degree: number;
  /** Fase lunar aproximada (0-1) */
  lunarPhase: number;
}

/**
 * ♈ ZODIAC AFFINITY CALCULATOR
 * Calcula afinidades zodiacales para scoring de patrones cósmicos
 * Útil para determinar compatibilidad de estados y transiciones
 * 
 * @example
 * ```typescript
 * const affinity = ZodiacAffinityCalculator.calculateZodiacAffinity(0, 4);
 * console.log(affinity); // Afinidad Aries-Leo (fuego-fuego)
 * ```
 */
export class ZodiacAffinityCalculator {
  /**
   * Los 12 signos zodiacales con sus propiedades
   */
  static readonly ZODIAC_SIGNS: ZodiacSign[] = [
    {
      name: 'Aries', symbol: '♈', element: 'fire', quality: 'cardinal',
      creativity: 0.9, stability: 0.3, adaptability: 0.5,
      description: 'El iniciador ardiente, fuego primordial de la creación'
    },
    {
      name: 'Taurus', symbol: '♉', element: 'earth', quality: 'fixed',
      creativity: 0.5, stability: 0.9, adaptability: 0.3,
      description: 'El constructor paciente, tierra fértil de la manifestación'
    },
    {
      name: 'Gemini', symbol: '♊', element: 'air', quality: 'mutable',
      creativity: 0.8, stability: 0.4, adaptability: 0.9,
      description: 'El mensajero dual, viento que lleva mil voces'
    },
    {
      name: 'Cancer', symbol: '♋', element: 'water', quality: 'cardinal',
      creativity: 0.7, stability: 0.6, adaptability: 0.6,
      description: 'El guardián emocional, marea que protege y nutre'
    },
    {
      name: 'Leo', symbol: '♌', element: 'fire', quality: 'fixed',
      creativity: 0.9, stability: 0.7, adaptability: 0.4,
      description: 'El soberano radiante, sol que ilumina todo reino'
    },
    {
      name: 'Virgo', symbol: '♍', element: 'earth', quality: 'mutable',
      creativity: 0.6, stability: 0.7, adaptability: 0.8,
      description: 'El perfeccionista sagrado, tierra que purifica'
    },
    {
      name: 'Libra', symbol: '♎', element: 'air', quality: 'cardinal',
      creativity: 0.7, stability: 0.5, adaptability: 0.7,
      description: 'El equilibrista cósmico, viento de armonía y justicia'
    },
    {
      name: 'Scorpio', symbol: '♏', element: 'water', quality: 'fixed',
      creativity: 0.8, stability: 0.8, adaptability: 0.5,
      description: 'El transformador profundo, agua que transmuta muerte en vida'
    },
    {
      name: 'Sagittarius', symbol: '♐', element: 'fire', quality: 'mutable',
      creativity: 0.8, stability: 0.4, adaptability: 0.8,
      description: 'El explorador filosófico, fuego que busca la verdad'
    },
    {
      name: 'Capricorn', symbol: '♑', element: 'earth', quality: 'cardinal',
      creativity: 0.5, stability: 0.9, adaptability: 0.4,
      description: 'El arquitecto ambicioso, montaña que toca las estrellas'
    },
    {
      name: 'Aquarius', symbol: '♒', element: 'air', quality: 'fixed',
      creativity: 0.9, stability: 0.5, adaptability: 0.6,
      description: 'El visionario rebelde, viento de cambio y revolución'
    },
    {
      name: 'Pisces', symbol: '♓', element: 'water', quality: 'mutable',
      creativity: 0.9, stability: 0.3, adaptability: 0.9,
      description: 'El soñador místico, océano de infinita compasión'
    }
  ];

  /**
   * Matriz de compatibilidad elemental
   * fire-fire, fire-earth, fire-air, fire-water
   * earth-fire, earth-earth, earth-air, earth-water
   * etc.
   */
  private static readonly ELEMENTAL_COMPATIBILITY: Record<ZodiacElement, Record<ZodiacElement, number>> = {
    fire: { fire: 1.0, earth: 0.4, air: 0.9, water: 0.3 },
    earth: { fire: 0.4, earth: 1.0, air: 0.5, water: 0.8 },
    air: { fire: 0.9, earth: 0.5, air: 1.0, water: 0.6 },
    water: { fire: 0.3, earth: 0.8, air: 0.6, water: 1.0 }
  };

  /**
   * Matriz de compatibilidad de cualidades
   */
  private static readonly QUALITY_COMPATIBILITY: Record<ZodiacQuality, Record<ZodiacQuality, number>> = {
    cardinal: { cardinal: 0.7, fixed: 0.6, mutable: 0.8 },
    fixed: { cardinal: 0.6, fixed: 0.9, mutable: 0.5 },
    mutable: { cardinal: 0.8, fixed: 0.5, mutable: 0.7 }
  };

  /**
   * Calcula la afinidad entre dos posiciones zodiacales
   * @param position1 - Primera posición (0-11)
   * @param position2 - Segunda posición (0-11)
   * @returns Resultado completo de afinidad
   * 
   * @example
   * ```typescript
   * const result = ZodiacAffinityCalculator.calculateZodiacAffinity(0, 4);
   * console.log(result.affinity); // ~0.95 (Aries-Leo, ambos fuego)
   * ```
   */
  static calculateZodiacAffinity(position1: number, position2: number): ZodiacAffinityResult {
    // Normalizar posiciones
    const pos1 = Math.abs(Math.floor(position1)) % 12;
    const pos2 = Math.abs(Math.floor(position2)) % 12;
    
    const sign1 = this.ZODIAC_SIGNS[pos1];
    const sign2 = this.ZODIAC_SIGNS[pos2];
    
    // Calcular afinidad elemental
    const elementalAffinity = this.ELEMENTAL_COMPATIBILITY[sign1.element][sign2.element];
    
    // Calcular afinidad de cualidad
    const qualityAffinity = this.QUALITY_COMPATIBILITY[sign1.quality][sign2.quality];
    
    // Calcular afinidad posicional (aspectos)
    const aspectAffinity = this.calculateAspectAffinity(pos1, pos2);
    
    // Combinar con pesos (elemental más importante)
    const affinity = (elementalAffinity * 0.4) + (qualityAffinity * 0.3) + (aspectAffinity * 0.3);
    
    // Generar descripción
    const description = this.generateAffinityDescription(sign1, sign2, affinity);
    
    return {
      affinity: Math.min(1, Math.max(0, affinity)),
      elementalAffinity,
      qualityAffinity,
      description,
      signs: [sign1.name, sign2.name]
    };
  }

  /**
   * Calcula afinidad basada en aspecto angular
   * @param pos1 - Primera posición (0-11)
   * @param pos2 - Segunda posición (0-11)
   * @returns Score de aspecto (0-1)
   */
  private static calculateAspectAffinity(pos1: number, pos2: number): number {
    // Distancia en signos (0-6, ya que es circular)
    const distance = Math.min(
      Math.abs(pos1 - pos2),
      12 - Math.abs(pos1 - pos2)
    );
    
    // Aspectos y sus afinidades
    // 0: Conjunción (mismo signo) - muy fuerte
    // 2: Sextil (60°) - armónico
    // 3: Cuadratura (90°) - tensión creativa
    // 4: Trígono (120°) - muy armónico
    // 6: Oposición (180°) - complementario
    const aspectAffinities: Record<number, number> = {
      0: 1.0,  // Conjunción
      1: 0.4,  // Semi-sextil (leve tensión)
      2: 0.8,  // Sextil (armonía)
      3: 0.5,  // Cuadratura (tensión productiva)
      4: 0.9,  // Trígono (gran armonía)
      5: 0.3,  // Quincuncio (ajuste necesario)
      6: 0.7   // Oposición (balance)
    };
    
    return aspectAffinities[distance] ?? 0.5;
  }

  /**
   * Genera descripción poética de la afinidad
   */
  private static generateAffinityDescription(
    sign1: ZodiacSign,
    sign2: ZodiacSign,
    affinity: number
  ): string {
    const level = affinity > 0.8 ? 'celestial' :
                  affinity > 0.6 ? 'armoniosa' :
                  affinity > 0.4 ? 'desafiante' : 'tensa';
    
    if (sign1.name === sign2.name) {
      return `Resonancia ${level} de ${sign1.name} consigo mismo - el espejo cósmico`;
    }
    
    return `Danza ${level} entre ${sign1.symbol} ${sign1.name} y ${sign2.symbol} ${sign2.name} - ` +
           `${sign1.element} encuentra ${sign2.element}`;
  }

  /**
   * Obtiene información zodiacal de una posición
   * @param position - Posición numérica (0-11 o 0-360)
   * @returns Información completa del signo
   */
  static getZodiacInfo(position: number): ZodiacInfo {
    // Si position > 11, asumimos grados (0-360)
    let signIndex: number;
    let degree: number;
    
    if (position > 11) {
      // Convertir de grados a signo
      signIndex = Math.floor(position / 30) % 12;
      degree = position % 30;
    } else {
      signIndex = Math.floor(Math.abs(position)) % 12;
      degree = (position % 1) * 30; // Fracción a grados dentro del signo
    }
    
    // Calcular fase lunar aproximada basada en posición
    const lunarPhase = (position % 30) / 30;
    
    return {
      sign: this.ZODIAC_SIGNS[signIndex],
      position: signIndex,
      degree,
      lunarPhase
    };
  }

  /**
   * Calcula posición zodiacal basada en timestamp
   * Simulación astrológica determinista
   * @param timestamp - Timestamp en milisegundos
   * @returns Posición zodiacal (0-11)
   */
  static calculateZodiacPosition(timestamp: number): number {
    // Usar el día del año como base (simplificación)
    const date = new Date(timestamp);
    const startOfYear = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // Cada signo dura ~30 días (360/12)
    // Aries comienza ~21 de marzo (día 80)
    const adjustedDay = (dayOfYear - 80 + 365) % 365;
    const position = Math.floor(adjustedDay / 30.44) % 12;
    
    return position;
  }

  /**
   * Obtiene creatividad, estabilidad y adaptabilidad de una posición
   * @param position - Posición zodiacal (0-11)
   * @returns Objeto con las tres métricas
   */
  static getTraits(position: number): { creativity: number; stability: number; adaptability: number } {
    const sign = this.ZODIAC_SIGNS[Math.abs(Math.floor(position)) % 12];
    return {
      creativity: sign.creativity,
      stability: sign.stability,
      adaptability: sign.adaptability
    };
  }

  /**
   * Obtiene signos compatibles para una posición
   * @param position - Posición zodiacal (0-11)
   * @param threshold - Umbral mínimo de afinidad (default 0.7)
   * @returns Array de posiciones compatibles
   */
  static getCompatibleSigns(position: number, threshold: number = 0.7): number[] {
    const compatible: number[] = [];
    
    for (let i = 0; i < 12; i++) {
      const affinity = this.calculateZodiacAffinity(position, i);
      if (affinity.affinity >= threshold) {
        compatible.push(i);
      }
    }
    
    return compatible;
  }

  /**
   * Obtiene el elemento de una posición
   * @param position - Posición zodiacal (0-11)
   * @returns Elemento del signo
   */
  static getElement(position: number): ZodiacElement {
    return this.ZODIAC_SIGNS[Math.abs(Math.floor(position)) % 12].element;
  }

  /**
   * Obtiene signos del mismo elemento
   * @param element - Elemento a buscar
   * @returns Array de posiciones con ese elemento
   */
  static getSignsByElement(element: ZodiacElement): number[] {
    return this.ZODIAC_SIGNS
      .map((sign, index) => ({ sign, index }))
      .filter(({ sign }) => sign.element === element)
      .map(({ index }) => index);
  }

  /**
   * Obtiene todos los nombres de signos
   * @returns Array de nombres
   */
  static getAllSignNames(): string[] {
    return this.ZODIAC_SIGNS.map(s => s.name);
  }

  /**
   * Obtiene signo por nombre
   * @param name - Nombre del signo
   * @returns Signo o undefined
   */
  static getSignByName(name: string): ZodiacSign | undefined {
    return this.ZODIAC_SIGNS.find(
      s => s.name.toLowerCase() === name.toLowerCase()
    );
  }
}
