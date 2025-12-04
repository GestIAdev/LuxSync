/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                         🎭 GENRE CLASSIFIER                                  ║
 * ║━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━║
 * ║  Clasificador de géneros musicales basado en características rítmicas,      ║
 * ║  armónicas y espectrales. Diseñado para música latina y electrónica.        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 * 
 * 🎯 FILOSOFÍA: Cada género tiene "reglas" específicas basadas en características
 *    medibles. No adivinamos - analizamos patrones reales de la música.
 * 
 * 📊 GÉNEROS SOPORTADOS:
 *    - CUMBIA: Güiro (treble density) + BPM medio (85-115) + sincopación media
 *    - REGGAETON: Dembow + BPM medio (90-100) + sincopación alta
 *    - TECHNO: Four-on-floor + BPM alto (120-150) + sincopación baja
 *    - HOUSE: Four-on-floor + BPM medio (118-130) + sincopación media
 *    - LATIN_POP: Características latinas suaves + BPM variable
 *    - TRAP: 808s + hi-hats rápidos + BPM lento (60-85)
 *    - UNKNOWN: No se detectó patrón claro
 * 
 * 🔬 CARACTERÍSTICAS ANALIZADAS:
 *    1. BPM y rango
 *    2. Sincopación (groove)
 *    3. Patrón de kick (four-on-floor vs dembow)
 *    4. Treble density (güiro, hi-hats)
 *    5. Bass character (808s vs kicks acústicos)
 *    6. Mood armónico
 * 
 * ⚡ PERFORMANCE:
 *    - Throttled a 200ms (5 análisis/segundo máximo)
 *    - Caché de resultados para frames similares
 *    - Early-return si no hay suficiente data
 * 
 * @author Selene AI
 * @version WAVE-8
 */

import { RhythmAnalysis, HarmonyAnalysis } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS Y CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Géneros musicales soportados por el clasificador
 */
export type MusicGenre = 
  | 'cumbia'
  | 'reggaeton'
  | 'techno'
  | 'house'
  | 'latin_pop'
  | 'trap'
  | 'drum_and_bass'
  | 'ambient'
  | 'unknown';

/**
 * Subgéneros para mayor precisión
 */
export type MusicSubgenre =
  | 'cumbia_villera'
  | 'cumbia_santafesina'
  | 'cumbia_colombiana'
  | 'reggaeton_clasico'
  | 'reggaeton_moderno'
  | 'dembow'
  | 'techno_dark'
  | 'techno_melodic'
  | 'tech_house'
  | 'deep_house'
  | 'progressive_house'
  | 'latin_trap'
  | 'trap_808'
  | 'none';

/**
 * Resultado del análisis de género
 */
export interface GenreAnalysis {
  /** Género principal detectado */
  genre: MusicGenre;
  /** Subgénero si se puede determinar */
  subgenre: MusicSubgenre;
  /** Confianza en la clasificación (0-1) */
  confidence: number;
  /** Scores de todos los géneros analizados */
  scores: Record<MusicGenre, number>;
  /** Características que llevaron a esta clasificación */
  features: GenreFeatures;
  /** Mood sugerido basado en el género */
  mood: GenreMood;
}

/**
 * Características extraídas para clasificación
 */
export interface GenreFeatures {
  /** BPM detectado */
  bpm: number;
  /** Nivel de sincopación (0-1) */
  syncopation: number;
  /** Patrón four-on-floor detectado */
  hasFourOnFloor: boolean;
  /** Patrón dembow detectado */
  hasDembow: boolean;
  /** Densidad de treble (güiro/hi-hats) */
  trebleDensity: number;
  /** Presencia de 808 bass */
  has808Bass: boolean;
  /** Energía promedio */
  avgEnergy: number;
}

/**
 * Mood derivado del género
 */
export type GenreMood = 
  | 'fiesta'       // Cumbia, reggaeton
  | 'hipnotico'    // Techno, deep house
  | 'melancolico'  // Ambient, trap sad
  | 'energetico'   // Drum and bass, hard techno
  | 'relajado'     // Chill house, latin pop
  | 'oscuro'       // Dark techno, trap
  | 'neutral';

/**
 * Configuración del clasificador
 */
export interface GenreClassifierConfig {
  /** Tiempo mínimo entre análisis (ms) */
  throttleMs: number;
  /** Umbral mínimo de confianza para declarar un género */
  minConfidence: number;
  /** Peso del BPM en la clasificación */
  bpmWeight: number;
  /** Peso de la sincopación */
  syncopationWeight: number;
  /** Peso del patrón rítmico */
  patternWeight: number;
  /** Peso del treble */
  trebleWeight: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGLAS DE GÉNERO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reglas para identificar cada género
 * Cada regla define rangos ideales y pesos
 */
interface GenreRule {
  genre: MusicGenre;
  bpmRange: { min: number; max: number; ideal: number };
  syncopationRange: { min: number; max: number };
  requiresFourOnFloor?: boolean;
  requiresDembow?: boolean;
  trebleDensityRange?: { min: number; max: number };
  requires808?: boolean;
  priorityBonus?: number; // Bonus para géneros con patrones muy específicos
}

const GENRE_RULES: GenreRule[] = [
  // CUMBIA: Güiro (treble) + BPM medio + sincopación media
  {
    genre: 'cumbia',
    bpmRange: { min: 85, max: 115, ideal: 95 },
    syncopationRange: { min: 0.2, max: 0.45 },
    trebleDensityRange: { min: 0.4, max: 0.9 },
    priorityBonus: 0.1, // Bonus por treble característico
  },
  
  // REGGAETON: Dembow + BPM específico + sincopación alta
  {
    genre: 'reggaeton',
    bpmRange: { min: 88, max: 102, ideal: 95 },
    syncopationRange: { min: 0.35, max: 0.7 },
    requiresDembow: true,
    priorityBonus: 0.15, // El dembow es muy distintivo
  },
  
  // TECHNO: Four-on-floor + BPM alto + sincopación muy baja
  {
    genre: 'techno',
    bpmRange: { min: 125, max: 150, ideal: 135 },
    syncopationRange: { min: 0, max: 0.15 },
    requiresFourOnFloor: true,
    priorityBonus: 0.1,
  },
  
  // HOUSE: Four-on-floor + BPM medio + sincopación moderada
  {
    genre: 'house',
    bpmRange: { min: 118, max: 132, ideal: 125 },
    syncopationRange: { min: 0.1, max: 0.35 },
    requiresFourOnFloor: true,
  },
  
  // TRAP: BPM lento + 808s + hi-hats rápidos
  {
    genre: 'trap',
    bpmRange: { min: 60, max: 90, ideal: 75 },
    syncopationRange: { min: 0.3, max: 0.6 },
    requires808: true,
    trebleDensityRange: { min: 0.5, max: 1.0 },
    priorityBonus: 0.1,
  },
  
  // DRUM AND BASS: BPM muy alto + sincopación alta
  {
    genre: 'drum_and_bass',
    bpmRange: { min: 160, max: 180, ideal: 174 },
    syncopationRange: { min: 0.4, max: 0.8 },
  },
  
  // LATIN POP: BPM variable + sincopación media + sin patrones extremos
  {
    genre: 'latin_pop',
    bpmRange: { min: 90, max: 130, ideal: 110 },
    syncopationRange: { min: 0.15, max: 0.4 },
  },
  
  // AMBIENT: BPM bajo o variable + sincopación muy baja
  {
    genre: 'ambient',
    bpmRange: { min: 60, max: 120, ideal: 90 },
    syncopationRange: { min: 0, max: 0.1 },
  },
];

/**
 * Mapeo de género + mood armónico → subgénero
 */
const SUBGENRE_RULES: Record<MusicGenre, Record<string, MusicSubgenre>> = {
  cumbia: {
    happy: 'cumbia_santafesina',
    energetic: 'cumbia_villera',
    melancholic: 'cumbia_colombiana',
    default: 'cumbia_villera',
  },
  reggaeton: {
    energetic: 'reggaeton_clasico',
    dark: 'dembow',
    default: 'reggaeton_moderno',
  },
  techno: {
    dark: 'techno_dark',
    melancholic: 'techno_melodic',
    default: 'techno_dark',
  },
  house: {
    happy: 'progressive_house',
    melancholic: 'deep_house',
    energetic: 'tech_house',
    default: 'deep_house',
  },
  trap: {
    dark: 'trap_808',
    melancholic: 'latin_trap',
    default: 'latin_trap',
  },
  latin_pop: { default: 'none' },
  drum_and_bass: { default: 'none' },
  ambient: { default: 'none' },
  unknown: { default: 'none' },
};

/**
 * Mapeo de género → mood por defecto
 */
const GENRE_MOOD_MAP: Record<MusicGenre, GenreMood> = {
  cumbia: 'fiesta',
  reggaeton: 'fiesta',
  techno: 'hipnotico',
  house: 'relajado',
  trap: 'oscuro',
  drum_and_bass: 'energetico',
  latin_pop: 'relajado',
  ambient: 'melancolico',
  unknown: 'neutral',
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENRE CLASSIFIER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: GenreClassifierConfig = {
  throttleMs: 200,
  minConfidence: 0.3,
  bpmWeight: 0.3,
  syncopationWeight: 0.25,
  patternWeight: 0.3,
  trebleWeight: 0.15,
};

export class GenreClassifier {
  private config: GenreClassifierConfig;
  private cachedAnalysis: GenreAnalysis | null = null;
  private lastAnalysisTime: number = 0;
  
  // Historial para suavizado
  private genreHistory: MusicGenre[] = [];
  private readonly historySize = 8;
  
  constructor(config: Partial<GenreClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🎭 CLASSIFY - Punto de entrada principal
   * 
   * Analiza el frame actual y clasifica el género musical.
   * 
   * ⚠️ THROTTLED: Solo ejecuta análisis completo cada 200ms
   * ⚠️ REGLA 2: Siempre retorna confidence
   * 
   * @param rhythm Análisis rítmico del frame
   * @param harmony Análisis armónico (puede ser null)
   * @param audio Métricas de audio
   * @param forceAnalysis Ignorar throttle (para tests)
   */
  classify(
    rhythm: RhythmAnalysis,
    harmony: HarmonyAnalysis | null,
    audio: { energy: number; bass: number; mid: number; treble: number },
    forceAnalysis: boolean = false
  ): GenreAnalysis {
    const now = Date.now();
    
    // THROTTLING
    if (!forceAnalysis &&
        this.cachedAnalysis &&
        (now - this.lastAnalysisTime) < this.config.throttleMs) {
      return this.cachedAnalysis;
    }

    // === PASO 1: Extraer características ===
    const features = this.extractFeatures(rhythm, audio);
    
    // === PASO 2: Calcular scores para cada género ===
    const scores = this.calculateGenreScores(features);
    
    // === PASO 3: Seleccionar género ganador ===
    const { genre, confidence } = this.selectWinningGenre(scores, features);
    
    // === PASO 4: Determinar subgénero ===
    const subgenre = this.determineSubgenre(genre, harmony);
    
    // === PASO 5: Determinar mood ===
    const mood = this.determineMood(genre, harmony);
    
    // === PASO 6: Actualizar historial ===
    this.updateHistory(genre);
    
    // === PASO 7: Construir resultado ===
    const analysis: GenreAnalysis = {
      genre,
      subgenre,
      confidence,
      scores,
      features,
      mood,
    };
    
    // Cache
    this.cachedAnalysis = analysis;
    this.lastAnalysisTime = now;
    
    return analysis;
  }

  /**
   * Obtiene el género más común del historial reciente
   * Útil para estabilidad en la clasificación
   */
  getDominantGenre(): MusicGenre {
    if (this.genreHistory.length === 0) return 'unknown';
    
    const counts = new Map<MusicGenre, number>();
    for (const g of this.genreHistory) {
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    
    let maxCount = 0;
    let dominant: MusicGenre = 'unknown';
    for (const [genre, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        dominant = genre;
      }
    }
    
    return dominant;
  }

  /**
   * Reset del estado interno
   */
  reset(): void {
    this.cachedAnalysis = null;
    this.lastAnalysisTime = 0;
    this.genreHistory = [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTRACCIÓN DE CARACTERÍSTICAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Extrae las características relevantes para clasificación
   */
  private extractFeatures(
    rhythm: RhythmAnalysis,
    audio: { energy: number; bass: number; mid: number; treble: number }
  ): GenreFeatures {
    // BPM desde el análisis rítmico
    const bpm = rhythm.bpm;
    
    // Sincopación desde groove
    const syncopation = rhythm.groove.syncopation;
    
    // Detectar patrones
    const hasFourOnFloor = this.detectFourOnFloor(rhythm);
    const hasDembow = this.detectDembow(rhythm, bpm);
    
    // Treble density - proporción de treble vs total
    const totalSpectrum = audio.bass + audio.mid + audio.treble + 0.001;
    const trebleDensity = audio.treble / totalSpectrum;
    
    // 808 bass - bass dominante con poca mid
    const has808Bass = audio.bass > 0.6 && audio.mid < audio.bass * 0.5;
    
    return {
      bpm,
      syncopation,
      hasFourOnFloor,
      hasDembow,
      trebleDensity,
      has808Bass,
      avgEnergy: audio.energy,
    };
  }

  /**
   * Detecta patrón four-on-floor (kick en cada beat)
   * Característico de techno, house
   */
  private detectFourOnFloor(rhythm: RhythmAnalysis): boolean {
    // Four-on-floor tiene:
    // 1. Alta regularidad en beats
    // 2. Baja sincopación
    // 3. Alta confianza de BPM
    // 4. Kick prominente
    const groove = rhythm.groove;
    
    return (
      groove.syncopation < 0.2 &&
      rhythm.drums.kickIntensity > 0.5 &&
      rhythm.confidence > 0.5
    );
  }

  /**
   * Detecta patrón dembow (reggaeton)
   * El dembow tiene kick + snare en patrón específico 3+3+2
   */
  private detectDembow(rhythm: RhythmAnalysis, bpm: number): boolean {
    // Dembow requiere:
    // 1. BPM en rango reggaeton (88-102)
    // 2. Sincopación ALTA (> 0.45) - diferencia clave con cumbia
    // 3. Snare prominente (el dembow tiene snare muy marcado)
    
    if (bpm < 85 || bpm > 105) return false;
    
    const groove = rhythm.groove;
    
    // El dembow tiene sincopación MÁS ALTA que cumbia
    // Cumbia: 0.2-0.4, Reggaeton: 0.45-0.7
    // Y requiere snare muy prominente (el "tun-tun" del dembow)
    return (
      groove.syncopation > 0.45 &&
      groove.syncopation < 0.75 &&
      rhythm.drums.snareIntensity > 0.6  // Snare muy prominente en dembow
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CÁLCULO DE SCORES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula el score para cada género basado en las características
   */
  private calculateGenreScores(features: GenreFeatures): Record<MusicGenre, number> {
    const scores: Record<MusicGenre, number> = {
      cumbia: 0,
      reggaeton: 0,
      techno: 0,
      house: 0,
      trap: 0,
      drum_and_bass: 0,
      latin_pop: 0,
      ambient: 0,
      unknown: 0.1, // Base score para unknown
    };

    for (const rule of GENRE_RULES) {
      scores[rule.genre] = this.calculateRuleScore(rule, features);
    }

    return scores;
  }

  /**
   * Calcula el score para una regla específica
   */
  private calculateRuleScore(rule: GenreRule, features: GenreFeatures): number {
    let score = 0;
    let matchCount = 0;
    let totalWeight = 0;

    // === BPM Score ===
    const bpmScore = this.calculateBpmScore(
      features.bpm,
      rule.bpmRange.min,
      rule.bpmRange.max,
      rule.bpmRange.ideal
    );
    score += bpmScore * this.config.bpmWeight;
    totalWeight += this.config.bpmWeight;
    if (bpmScore > 0.5) matchCount++;

    // === Syncopation Score ===
    const syncScore = this.calculateRangeScore(
      features.syncopation,
      rule.syncopationRange.min,
      rule.syncopationRange.max
    );
    score += syncScore * this.config.syncopationWeight;
    totalWeight += this.config.syncopationWeight;
    if (syncScore > 0.5) matchCount++;

    // === Pattern Score (Four-on-floor / Dembow) ===
    let patternScore = 0.5; // Neutral si no se requiere
    
    if (rule.requiresFourOnFloor !== undefined) {
      patternScore = rule.requiresFourOnFloor === features.hasFourOnFloor ? 1.0 : 0.0;
    }
    if (rule.requiresDembow !== undefined) {
      patternScore = rule.requiresDembow === features.hasDembow ? 1.0 : 0.0;
    }
    
    score += patternScore * this.config.patternWeight;
    totalWeight += this.config.patternWeight;
    if (patternScore > 0.5) matchCount++;

    // === Treble Density Score ===
    let trebleScore = 0.5; // Neutral si no hay rango definido
    
    if (rule.trebleDensityRange) {
      trebleScore = this.calculateRangeScore(
        features.trebleDensity,
        rule.trebleDensityRange.min,
        rule.trebleDensityRange.max
      );
    }
    
    score += trebleScore * this.config.trebleWeight;
    totalWeight += this.config.trebleWeight;

    // === 808 Requirement ===
    if (rule.requires808 !== undefined) {
      if (rule.requires808 !== features.has808Bass) {
        score *= 0.5; // Penalización significativa
      }
    }

    // Normalizar y aplicar bonus
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
    const bonus = rule.priorityBonus || 0;
    
    // El bonus se aplica solo si hay buen match general
    return normalizedScore > 0.4 
      ? Math.min(1.0, normalizedScore + bonus) 
      : normalizedScore;
  }

  /**
   * Calcula score de BPM con preferencia por el ideal
   */
  private calculateBpmScore(
    bpm: number,
    min: number,
    max: number,
    ideal: number
  ): number {
    // Fuera de rango = 0
    if (bpm < min - 10 || bpm > max + 10) return 0;
    
    // Dentro del rango pero cerca de los bordes
    if (bpm < min || bpm > max) {
      const distance = bpm < min ? min - bpm : bpm - max;
      return Math.max(0, 0.5 - (distance / 20));
    }
    
    // Dentro del rango - score basado en cercanía al ideal
    const distanceToIdeal = Math.abs(bpm - ideal);
    const maxDistance = Math.max(ideal - min, max - ideal);
    
    return 1.0 - (distanceToIdeal / maxDistance) * 0.5;
  }

  /**
   * Calcula score para un valor dentro de un rango
   */
  private calculateRangeScore(value: number, min: number, max: number): number {
    if (value < min || value > max) {
      // Fuera del rango - penalización basada en distancia
      const distance = value < min ? min - value : value - max;
      return Math.max(0, 1.0 - distance * 2);
    }
    
    // Dentro del rango - score alto
    // Preferencia por el centro del rango
    const center = (min + max) / 2;
    const halfRange = (max - min) / 2;
    const distanceToCenter = Math.abs(value - center);
    
    return 1.0 - (distanceToCenter / halfRange) * 0.3;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECCIÓN Y DETERMINACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Selecciona el género ganador basado en scores
   */
  private selectWinningGenre(
    scores: Record<MusicGenre, number>,
    features: GenreFeatures
  ): { genre: MusicGenre; confidence: number } {
    // Encontrar el máximo score
    let maxScore = 0;
    let winningGenre: MusicGenre = 'unknown';
    
    for (const [genre, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        winningGenre = genre as MusicGenre;
      }
    }

    // Validar con historial (estabilidad)
    const dominantGenre = this.getDominantGenre();
    if (dominantGenre !== 'unknown' && 
        dominantGenre !== winningGenre &&
        scores[dominantGenre] > maxScore * 0.85) {
      // El género dominante está muy cerca, mantenerlo para estabilidad
      winningGenre = dominantGenre;
      maxScore = scores[dominantGenre];
    }

    // Calcular confianza basada en separación de scores
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const scoreDiff = sortedScores[0] - (sortedScores[1] || 0);
    
    // Confianza = score máximo * factor de separación
    let confidence = maxScore * (0.5 + scoreDiff);
    
    // Bonus de confianza si hay patrones claros
    if (features.hasFourOnFloor && (winningGenre === 'techno' || winningGenre === 'house')) {
      confidence += 0.1;
    }
    if (features.hasDembow && winningGenre === 'reggaeton') {
      confidence += 0.15;
    }
    
    // Si el score es muy bajo, marcar como unknown
    if (maxScore < this.config.minConfidence) {
      return { genre: 'unknown', confidence: maxScore };
    }

    return {
      genre: winningGenre,
      confidence: Math.min(1.0, confidence),
    };
  }

  /**
   * Determina el subgénero basado en características armónicas
   */
  private determineSubgenre(
    genre: MusicGenre,
    harmony: HarmonyAnalysis | null
  ): MusicSubgenre {
    const subgenreRules = SUBGENRE_RULES[genre];
    if (!subgenreRules) return 'none';
    
    // Si no hay análisis armónico o no tiene mood, usar default
    if (!harmony || !harmony.mode?.mood) {
      return subgenreRules['default'] || 'none';
    }
    
    // Buscar subgénero que coincida con el mood armónico
    const mood = harmony.mode.mood.toLowerCase();
    
    if (subgenreRules[mood]) {
      return subgenreRules[mood];
    }
    
    return subgenreRules['default'] || 'none';
  }

  /**
   * Determina el mood basado en género y armonía
   */
  private determineMood(
    genre: MusicGenre,
    harmony: HarmonyAnalysis | null
  ): GenreMood {
    // Base mood del género
    const baseMood = GENRE_MOOD_MAP[genre];
    
    // Modificar basado en armonía si está disponible
    if (harmony?.mode?.mood) {
      const harmonyMood = harmony.mode.mood.toLowerCase();
      
      // Mapear mood armónico a genre mood
      if (harmonyMood.includes('dark') || harmonyMood.includes('tense')) {
        return 'oscuro';
      }
      if (harmonyMood.includes('sad') || harmonyMood.includes('melan')) {
        return 'melancolico';
      }
      if (harmonyMood.includes('happy') || harmonyMood.includes('bright')) {
        if (genre === 'techno' || genre === 'house') {
          return 'energetico';
        }
        return 'fiesta';
      }
    }
    
    return baseMood;
  }

  /**
   * Actualiza el historial de géneros
   */
  private updateHistory(genre: MusicGenre): void {
    this.genreHistory.push(genre);
    
    // Mantener tamaño máximo
    while (this.genreHistory.length > this.historySize) {
      this.genreHistory.shift();
    }
  }
}

export default GenreClassifier;
