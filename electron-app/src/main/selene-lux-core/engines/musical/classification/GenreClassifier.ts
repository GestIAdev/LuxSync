/**
 * â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
 * â•‘                         ðŸŽ­ GENRE CLASSIFIER                                  â•‘
 * â•‘â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â•‘    if (bpm < 85 || bpm > 105) return false;
    
    // WAVE 19.3: Syncopation desde raiz o groove
    const syncopation = typeof (rhythm as any).syncopation === 'number'
      ? (rhythm as any).syncopation
      // WAVE 19.3: CAMINO LATINO - Sync >= 0.30 = tiene swing (GAP CERRADO!)
    if (features.syncopation >= 0.30 && features.bpm >= 85 && features.bpm <= 125) {  : (rhythm.groove?.syncopation ?? 0.35);
    
    // El dembow tiene sincopacion MAS ALTA que cumbia
    // Cumbia: 0.2-0.4, Reggaeton: 0.45-0.7
    // Y requiere snare muy prominente (el "tun-tun" del dembow)
    return (
      syncopation > 0.45 &&
      syncopation < 0.75 &&
      rhythm.drums.snareIntensity > 0.6  // Snare muy prominente en dembow
    );
  }sificador de gÃ©neros musicales basado en caracterÃ­sticas rÃ­tmicas,      â•‘
 * â•‘  armÃ³nicas y espectrales. DiseÃ±ado para mÃºsica latina y electrÃ³nica.        â•‘
 * â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 
 * ï¿½ WAVE 12.5: SELENE LIBRE
 * El gÃ©nero ya NO afecta los colores. Solo se clasifica para logging opcional.
 * Los colores emergen de la MATEMÃTICA PURA (Energy, Syncopation, Key).
 * 
 * ï¿½ðŸŽ¯ FILOSOFÃA: Cada gÃ©nero tiene "reglas" especÃ­ficas basadas en caracterÃ­sticas
 *    medibles. No adivinamos - analizamos patrones reales de la mÃºsica.
 * 
 * ðŸ“Š GÃ‰NEROS SOPORTADOS:
 *    - CUMBIA: GÃ¼iro (treble density) + BPM medio (85-115) + sincopaciÃ³n media
 *    - REGGAETON: Dembow + BPM medio (90-100) + sincopaciÃ³n alta
 *    - TECHNO: Four-on-floor + BPM alto (120-150) + sincopaciÃ³n baja
 *    - HOUSE: Four-on-floor + BPM medio (118-130) + sincopaciÃ³n media
 *    - LATIN_POP: CaracterÃ­sticas latinas suaves + BPM variable
 *    - TRAP: 808s + hi-hats rÃ¡pidos + BPM lento (60-85)
 *    - UNKNOWN: No se detectÃ³ patrÃ³n claro
 * 
 * ðŸ”¬ CARACTERÃSTICAS ANALIZADAS:
 *    1. BPM y rango
 *    2. SincopaciÃ³n (groove)
 *    3. PatrÃ³n de kick (four-on-floor vs dembow)
 *    4. Treble density (gÃ¼iro, hi-hats)
 *    5. Bass character (808s vs kicks acÃºsticos)
 *    6. Mood armÃ³nico
 * 
 * âš¡ PERFORMANCE:
 *    - Throttled a 200ms (5 anÃ¡lisis/segundo mÃ¡ximo)
 *    - CachÃ© de resultados para frames similares
 *    - Early-return si no hay suficiente data
 * 
 * @author Selene AI
 * @version WAVE-12.5
 */

import { RhythmAnalysis, HarmonyAnalysis } from '../types.js';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ðŸŒŠ WAVE 12.5: LOGGING SILENCIADO
// El gÃ©nero ya no afecta la iluminaciÃ³n, solo es informativo
// Poner en TRUE para debugging cuando se necesite
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const VERBOSE_LOGGING = false;

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TIPOS Y CONSTANTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * GÃ©neros musicales soportados por el clasificador
 * ðŸ”¥ WAVE 12: AÃ±adido 'cyberpunk' para Mid-Tempo Electronic
 */
export type MusicGenre = 
  | 'cumbia'
  | 'reggaeton'
  | 'techno'
  | 'cyberpunk'    // ðŸ”¥ WAVE 12: Mid-tempo electronic (90-120 BPM, robÃ³tico)
  | 'house'
  | 'latin_pop'
  | 'trap'
  | 'drum_and_bass'
  | 'ambient'
  | 'unknown';

/**
 * SubgÃ©neros para mayor precisiÃ³n
 * ðŸ”¥ WAVE 12: AÃ±adidos subgÃ©neros cyberpunk
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
  | 'cyberpunk_dark'      // ðŸ”¥ WAVE 12
  | 'cyberpunk_synthwave' // ðŸ”¥ WAVE 12
  | 'none';

/**
 * Resultado del anÃ¡lisis de gÃ©nero
 */
export interface GenreAnalysis {
  /** GÃ©nero principal detectado */
  genre: MusicGenre;
  /** SubgÃ©nero si se puede determinar */
  subgenre: MusicSubgenre;
  /** Confianza en la clasificaciÃ³n (0-1) */
  confidence: number;
  /** Scores de todos los gÃ©neros analizados */
  scores: Record<MusicGenre, number>;
  /** CaracterÃ­sticas que llevaron a esta clasificaciÃ³n */
  features: GenreFeatures;
  /** Mood sugerido basado en el gÃ©nero */
  mood: GenreMood;
}

/**
 * CaracterÃ­sticas extraÃ­das para clasificaciÃ³n
 */
export interface GenreFeatures {
  /** BPM detectado */
  bpm: number;
  /** Nivel de sincopaciÃ³n (0-1) */
  syncopation: number;
  /** PatrÃ³n four-on-floor detectado */
  hasFourOnFloor: boolean;
  /** PatrÃ³n dembow detectado */
  hasDembow: boolean;
  /** Densidad de treble (gÃ¼iro/hi-hats) */
  trebleDensity: number;
  /** Presencia de 808 bass */
  has808Bass: boolean;
  /** EnergÃ­a promedio */
  avgEnergy: number;
}

/**
 * Mood derivado del gÃ©nero
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
 * ConfiguraciÃ³n del clasificador
 */
export interface GenreClassifierConfig {
  /** Tiempo mÃ­nimo entre anÃ¡lisis (ms) */
  throttleMs: number;
  /** Umbral mÃ­nimo de confianza para declarar un gÃ©nero */
  minConfidence: number;
  /** Peso del BPM en la clasificaciÃ³n */
  bpmWeight: number;
  /** Peso de la sincopaciÃ³n */
  syncopationWeight: number;
  /** Peso del patrÃ³n rÃ­tmico */
  patternWeight: number;
  /** Peso del treble */
  trebleWeight: number;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REGLAS DE GÃ‰NERO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Reglas para identificar cada gÃ©nero
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
  priorityBonus?: number; // Bonus para gÃ©neros con patrones muy especÃ­ficos
}

const GENRE_RULES: GenreRule[] = [
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ðŸ”¥ WAVE 12.1: CALIBRACIÃ“N FINA - "El gÃ¼iro ya no es elitista"
  // El audio real (YouTube/Micro) no viene masterizado al mÃ¡ximo
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  // CUMBIA: Treble bajo pero CONSTANTE (gÃ¼iro no calla)
  // ðŸ”¥ WAVE 12.1: Bajado de 0.7 a 0.15 + BPM hasta 125
  {
    genre: 'cumbia',
    bpmRange: { min: 85, max: 125, ideal: 100 },  // ðŸ”¥ Expandido hasta 125 BPM
    syncopationRange: { min: 0.35, max: 0.65 },   // ðŸ”¥ Sync > 0.35 = tiene swing
    trebleDensityRange: { min: 0.15, max: 0.95 }, // ðŸ”¥ Bajado a 0.15
    priorityBonus: 0.15,
  },
  
  // REGGAETON: Dembow + BPM especÃ­fico + sincopaciÃ³n alta
  {
    genre: 'reggaeton',
    bpmRange: { min: 88, max: 102, ideal: 95 },
    syncopationRange: { min: 0.35, max: 0.7 },
    requiresDembow: true,
    priorityBonus: 0.15,
  },
  
  // ðŸ”¥ CYBERPUNK / MID-TEMPO ELECTRONIC
  // Ritmo cuadrado (sincopaciÃ³n baja) + BPM 85-130
  // "El Cyberpunk es ROBÃ“TICO, la Cumbia tiene SWING"
  // ðŸ”¥ WAVE 12.1: Sync < 0.30 = ELECTRÃ“NICO (sin swing)
  {
    genre: 'cyberpunk',
    bpmRange: { min: 85, max: 130, ideal: 100 },
    syncopationRange: { min: 0, max: 0.30 },  // ðŸ”¥ Sync < 0.30 = robÃ³tico
    requiresFourOnFloor: true,
    priorityBonus: 0.25,  // Alta prioridad para ritmos robÃ³ticos
  },
  
  // TECHNO: Four-on-floor + BPM ampliado 90-180
  // ðŸ”¥ WAVE 12: Ahora acepta desde 90 BPM
  {
    genre: 'techno',
    bpmRange: { min: 125, max: 180, ideal: 140 },  // BPM alto
    syncopationRange: { min: 0, max: 0.15 },
    requiresFourOnFloor: true,
    priorityBonus: 0.1,
  },
  
  // HOUSE: Four-on-floor + BPM medio + sincopaciÃ³n moderada
  {
    genre: 'house',
    bpmRange: { min: 118, max: 132, ideal: 125 },
    syncopationRange: { min: 0.1, max: 0.35 },
    requiresFourOnFloor: true,
  },
  
  // TRAP: BPM lento + 808s + hi-hats rÃ¡pidos
  {
    genre: 'trap',
    bpmRange: { min: 60, max: 90, ideal: 75 },
    syncopationRange: { min: 0.3, max: 0.6 },
    requires808: true,
    trebleDensityRange: { min: 0.5, max: 1.0 },
    priorityBonus: 0.1,
  },
  
  // DRUM AND BASS: BPM muy alto + sincopaciÃ³n alta
  {
    genre: 'drum_and_bass',
    bpmRange: { min: 160, max: 180, ideal: 174 },
    syncopationRange: { min: 0.4, max: 0.8 },
  },
  
  // LATIN POP: BPM variable + sincopaciÃ³n media + sin patrones extremos
  {
    genre: 'latin_pop',
    bpmRange: { min: 90, max: 130, ideal: 110 },
    syncopationRange: { min: 0.15, max: 0.4 },
  },
  
  // AMBIENT: BPM bajo o variable + sincopaciÃ³n muy baja
  {
    genre: 'ambient',
    bpmRange: { min: 60, max: 120, ideal: 90 },
    syncopationRange: { min: 0, max: 0.1 },
  },
];

/**
 * Mapeo de gÃ©nero + mood armÃ³nico â†’ subgÃ©nero
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
  // ðŸ”¥ WAVE 12: Cyberpunk subgÃ©neros
  cyberpunk: {
    dark: 'cyberpunk_dark',
    melancholic: 'cyberpunk_synthwave',
    default: 'cyberpunk_dark',
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
 * Mapeo de gÃ©nero â†’ mood por defecto
 * ðŸ”¥ WAVE 12: Cyberpunk = OSCURO (dark/tense)
 */
const GENRE_MOOD_MAP: Record<MusicGenre, GenreMood> = {
  cumbia: 'fiesta',
  reggaeton: 'fiesta',
  techno: 'hipnotico',
  cyberpunk: 'oscuro',     // ðŸ”¥ WAVE 12: Cyberpunk es OSCURO/TENSE
  house: 'relajado',
  trap: 'oscuro',
  drum_and_bass: 'energetico',
  latin_pop: 'relajado',
  ambient: 'melancolico',
  unknown: 'neutral',
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GENRE CLASSIFIER CLASS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * ConfiguraciÃ³n por defecto
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
  
  // ðŸ”¥ WAVE 12.2: HISTÃ‰RESIS - Estabilidad de gÃ©nero
  private currentStableGenre: MusicGenre = 'unknown';
  private stableGenreCount: number = 0;
  private readonly STABILITY_THRESHOLD = 5;  // Necesita 5 detecciones consecutivas para cambiar
  private lastGenreChangeTime: number = 0;
  private readonly MIN_GENRE_HOLD_MS = 2000;  // Mantener gÃ©nero mÃ­nimo 2 segundos
  
  constructor(config: Partial<GenreClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // API PÃšBLICA
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * ðŸŽ­ CLASSIFY - Punto de entrada principal
   * 
   * Analiza el frame actual y clasifica el gÃ©nero musical.
   * 
   * âš ï¸ THROTTLED: Solo ejecuta anÃ¡lisis completo cada 200ms
   * âš ï¸ REGLA 2: Siempre retorna confidence
   * 
   * @param rhythm AnÃ¡lisis rÃ­tmico del frame
   * @param harmony AnÃ¡lisis armÃ³nico (puede ser null)
   * @param audio MÃ©tricas de audio
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

    // === PASO 1: Extraer caracterÃ­sticas ===
    const features = this.extractFeatures(rhythm, audio);
    
    // === PASO 2: Calcular scores para cada gÃ©nero ===
    const scores = this.calculateGenreScores(features);
    
    // === PASO 3: Seleccionar gÃ©nero ganador ===
    const { genre, confidence } = this.selectWinningGenre(scores, features);
    
    // === PASO 4: Determinar subgÃ©nero ===
    const subgenre = this.determineSubgenre(genre, harmony);
    
    // === PASO 5: Determinar mood ===
    const mood = this.determineMood(genre, harmony);
    
    // === PASO 6: Actualizar historial ===
    this.updateHistory(genre);
    
    // === PASO 6.5: ðŸ”¥ WAVE 12.2 - HISTÃ‰RESIS ===
    // Estabilizar gÃ©nero para evitar cambios frame-a-frame
    const stabilizedGenre = this.stabilizeGenre(genre, confidence);
    
    // === PASO 7: Construir resultado ===
    const analysis: GenreAnalysis = {
      genre: stabilizedGenre,  // ðŸ”¥ Usar gÃ©nero estabilizado
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
   * ðŸ”¥ WAVE 12.2: HISTÃ‰RESIS - Estabiliza el gÃ©nero detectado
   * Evita cambios caÃ³ticos frame-a-frame
   */
  private stabilizeGenre(detectedGenre: MusicGenre, confidence: number): MusicGenre {
    const now = Date.now();
    
    // Si es el mismo gÃ©nero que el estable actual, reforzar
    if (detectedGenre === this.currentStableGenre) {
      this.stableGenreCount++;
      return this.currentStableGenre;
    }
    
    // Si es diferente, contar cuÃ¡ntas veces seguidas aparece
    // Buscar en historial reciente
    const recentHistory = this.genreHistory.slice(-this.STABILITY_THRESHOLD);
    const detectedCount = recentHistory.filter(g => g === detectedGenre).length;
    
    // Â¿El nuevo gÃ©nero aparece consistentemente?
    const isConsistent = detectedCount >= Math.ceil(this.STABILITY_THRESHOLD * 0.6); // 60% del umbral
    
    // Â¿Ha pasado suficiente tiempo desde el Ãºltimo cambio?
    const timeSinceLastChange = now - this.lastGenreChangeTime;
    const canChange = timeSinceLastChange > this.MIN_GENRE_HOLD_MS;
    
    // Cambiar solo si es consistente Y ha pasado tiempo suficiente Y confianza alta
    if (isConsistent && canChange && confidence > 0.6) {
      if (VERBOSE_LOGGING) if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸ”„ CAMBIO DE GÃ‰NERO: ${this.currentStableGenre} â†’ ${detectedGenre} (despuÃ©s de ${(timeSinceLastChange/1000).toFixed(1)}s)`);
      this.currentStableGenre = detectedGenre;
      this.stableGenreCount = 1;
      this.lastGenreChangeTime = now;
      return detectedGenre;
    }
    
    // Mantener el gÃ©nero estable actual
    return this.currentStableGenre !== 'unknown' ? this.currentStableGenre : detectedGenre;
  }

  /**
   * Obtiene el gÃ©nero mÃ¡s comÃºn del historial reciente
   * Ãštil para estabilidad en la clasificaciÃ³n
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // EXTRACCIÃ“N DE CARACTERÃSTICAS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Extrae las caracterÃ­sticas relevantes para clasificaciÃ³n
   */
  private extractFeatures(
    rhythm: RhythmAnalysis,
    audio: { energy: number; bass: number; mid: number; treble: number }
  ): GenreFeatures {
    // BPM desde el analisis ritmico
    const bpm = rhythm.bpm;
    
    // WAVE 19.3: Syncopation - soportar AMBOS formatos:
    // - SimpleRhythmDetector: rhythm.syncopation (en la raiz)
    // - RhythmAnalyzer: rhythm.groove.syncopation (objeto anidado)
    const syncopation = typeof (rhythm as any).syncopation === 'number'
      ? (rhythm as any).syncopation
      : (rhythm.groove?.syncopation ?? 0.35);
    
    if (VERBOSE_LOGGING && Math.random() < 0.1) {
      console.log(`[GenreClassifier] SYNC: raw=${(rhythm as any).syncopation}, groove=${rhythm.groove?.syncopation}, final=${syncopation}`);
    }
    
    // Detectar patrones
    const hasFourOnFloor = this.detectFourOnFloor(rhythm);
    const hasDembow = this.detectDembow(rhythm, bpm);
    
    // Treble density - proporciÃ³n de treble vs total
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
   * Detecta patron four-on-floor (kick en cada beat)
   * Caracteristico de techno, house
   */
  private detectFourOnFloor(rhythm: RhythmAnalysis): boolean {
    // Four-on-floor tiene:
    // 1. Alta regularidad en beats
    // 2. Baja sincopacion
    // 3. Alta confianza de BPM
    // 4. Kick prominente
    
    // WAVE 19.3: Syncopation desde raiz o groove
    const syncopation = typeof (rhythm as any).syncopation === 'number'
      ? (rhythm as any).syncopation
      : (rhythm.groove?.syncopation ?? 0.5);
    
    return (
      syncopation < 0.2 &&
      rhythm.drums.kickIntensity > 0.5 &&
      rhythm.confidence > 0.5
    );
  }

  /**
   * Detecta patrÃ³n dembow (reggaeton)
   * El dembow tiene kick + snare en patrÃ³n especÃ­fico 3+3+2
   */
  private detectDembow(rhythm: RhythmAnalysis, bpm: number): boolean {
    // Dembow requiere:
    // 1. BPM en rango reggaeton (88-102)
    // 2. SincopaciÃ³n ALTA (> 0.45) - diferencia clave con cumbia
    // 3. Snare prominente (el dembow tiene snare muy marcado)
    
    if (bpm < 85 || bpm > 105) return false;
    
    const groove = rhythm.groove;
    
    // El dembow tiene sincopaciÃ³n MÃS ALTA que cumbia
    // Cumbia: 0.2-0.4, Reggaeton: 0.45-0.7
    // Y requiere snare muy prominente (el "tun-tun" del dembow)
    return (
      groove.syncopation > 0.45 &&
      groove.syncopation < 0.75 &&
      rhythm.drums.snareIntensity > 0.6  // Snare muy prominente en dembow
    );
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CÃLCULO DE SCORES
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Calcula el score para cada gÃ©nero basado en las caracterÃ­sticas
   * ðŸ”¥ WAVE 12: AÃ±adido cyberpunk
   */
  private calculateGenreScores(features: GenreFeatures): Record<MusicGenre, number> {
    const scores: Record<MusicGenre, number> = {
      cumbia: 0,
      reggaeton: 0,
      techno: 0,
      cyberpunk: 0,  // ðŸ”¥ WAVE 12
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
   * Calcula el score para una regla especÃ­fica
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
        score *= 0.5; // PenalizaciÃ³n significativa
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
    
    // Dentro del rango - score basado en cercanÃ­a al ideal
    const distanceToIdeal = Math.abs(bpm - ideal);
    const maxDistance = Math.max(ideal - min, max - ideal);
    
    return 1.0 - (distanceToIdeal / maxDistance) * 0.5;
  }

  /**
   * Calcula score para un valor dentro de un rango
   */
  private calculateRangeScore(value: number, min: number, max: number): number {
    if (value < min || value > max) {
      // Fuera del rango - penalizaciÃ³n basada en distancia
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SELECCIÃ“N Y DETERMINACIÃ“N
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Selecciona el gÃ©nero ganador basado en scores
   * 
   * ðŸ”¥ WAVE 12.1: REGLA DE HIERRO BIDIRECCIONAL
   * - Sync < 0.30 = ELECTRÃ“NICO (robÃ³tico)
   * - Sync > 0.35 = LATINO (con swing)
   */
  private selectWinningGenre(
    scores: Record<MusicGenre, number>,
    features: GenreFeatures
  ): { genre: MusicGenre; confidence: number } {
    
    // ðŸ” DEBUG: Log de caracterÃ­sticas para diagnÃ³stico
    // ðŸ”¥ WAVE 12.1: 20% de frames durante calibraciÃ³n
    if (Math.random() < 0.20) {
      if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸ“Š Features: BPM=${features.bpm.toFixed(0)}, Sync=${features.syncopation.toFixed(2)}, Treble=${features.trebleDensity.toFixed(2)}, FourFloor=${features.hasFourOnFloor}`)
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ðŸ”¥ WAVE 12.1: REGLA DE HIERRO BIDIRECCIONAL
    // La sincopaciÃ³n es el FACTOR DECISIVO:
    // - Sync < 0.30 = ELECTRÃ“NICO (ritmo robÃ³tico, sin swing)
    // - Sync > 0.35 = LATINO (tiene swing/groove)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    // ðŸ¤– CAMINO ELECTRÃ“NICO: Sync < 0.30 = robÃ³tico
    if (features.syncopation < 0.30) {
      if (features.bpm >= 85 && features.bpm <= 130) {
        if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸ¤– REGLA DE HIERRO: Sync=${features.syncopation.toFixed(2)} < 0.30 â†’ CYBERPUNK`)
        return { genre: 'cyberpunk', confidence: 0.85 }
      } else if (features.bpm > 130) {
        if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸ¤– REGLA DE HIERRO: Sync=${features.syncopation.toFixed(2)} < 0.30, BPM=${features.bpm.toFixed(0)} â†’ TECHNO`)
        return { genre: 'techno', confidence: 0.85 }
      }
    }
    
    // ðŸ’ƒ CAMINO LATINO: Sync > 0.35 = tiene swing
    if (features.syncopation > 0.35 && features.bpm >= 85 && features.bpm <= 125) {
      // Tiene swing! Ahora distinguir entre Cumbia y Reggaeton
      // Cumbia: treble > 0.15 (gÃ¼iro presente, no necesita ser fuerte)
      // Reggaeton: dembow pattern
      
      if (features.trebleDensity > 0.15) {
        // Hay gÃ¼iro (aunque sea suave) â†’ CUMBIA
        if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ï¿½ REGLA DE HIERRO: Sync=${features.syncopation.toFixed(2)} > 0.35, Treble=${features.trebleDensity.toFixed(2)} > 0.15 â†’ CUMBIA`)
        return { genre: 'cumbia', confidence: 0.90 }
      } else if (features.hasDembow) {
        // Sin gÃ¼iro pero con dembow â†’ REGGAETON
        if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸŽ¤ REGLA DE HIERRO: Sync=${features.syncopation.toFixed(2)} > 0.35, Dembow=true â†’ REGGAETON`)
        return { genre: 'reggaeton', confidence: 0.85 }
      } else {
        // Swing pero sin gÃ¼iro ni dembow â†’ LATIN_POP genÃ©rico
        if (VERBOSE_LOGGING) console.log(`[GenreClassifier] ðŸŽµ REGLA DE HIERRO: Sync=${features.syncopation.toFixed(2)} > 0.35 â†’ LATIN_POP`)
        return { genre: 'latin_pop', confidence: 0.70 }
      }
    }
    
    // Encontrar el mÃ¡ximo score (fallback para casos intermedios)
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
      // El gÃ©nero dominante estÃ¡ muy cerca, mantenerlo para estabilidad
      winningGenre = dominantGenre;
      maxScore = scores[dominantGenre];
    }

    // Calcular confianza basada en separaciÃ³n de scores
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    const scoreDiff = sortedScores[0] - (sortedScores[1] || 0);
    
    // Confianza = score mÃ¡ximo * factor de separaciÃ³n
    let confidence = maxScore * (0.5 + scoreDiff);
    
    // Bonus de confianza si hay patrones claros
    if (features.hasFourOnFloor && (winningGenre === 'techno' || winningGenre === 'house')) {
      confidence += 0.1;
    }
    if (features.hasDembow && winningGenre === 'reggaeton') {
      confidence += 0.15;
    }
    // ðŸ”¥ WAVE 12: Bonus para cyberpunk con ritmo robÃ³tico
    if (features.syncopation < 0.15 && winningGenre === 'cyberpunk') {
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
   * Determina el subgÃ©nero basado en caracterÃ­sticas armÃ³nicas
   */
  private determineSubgenre(
    genre: MusicGenre,
    harmony: HarmonyAnalysis | null
  ): MusicSubgenre {
    const subgenreRules = SUBGENRE_RULES[genre];
    if (!subgenreRules) return 'none';
    
    // Si no hay anÃ¡lisis armÃ³nico o no tiene mood, usar default
    if (!harmony || !harmony.mode?.mood) {
      return subgenreRules['default'] || 'none';
    }
    
    // Buscar subgÃ©nero que coincida con el mood armÃ³nico
    const mood = harmony.mode.mood.toLowerCase();
    
    if (subgenreRules[mood]) {
      return subgenreRules[mood];
    }
    
    return subgenreRules['default'] || 'none';
  }

  /**
   * Determina el mood basado en gÃ©nero y armonÃ­a
   */
  private determineMood(
    genre: MusicGenre,
    harmony: HarmonyAnalysis | null
  ): GenreMood {
    // Base mood del gÃ©nero
    const baseMood = GENRE_MOOD_MAP[genre];
    
    // Modificar basado en armonÃ­a si estÃ¡ disponible
    if (harmony?.mode?.mood) {
      const harmonyMood = harmony.mode.mood.toLowerCase();
      
      // Mapear mood armÃ³nico a genre mood
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
   * Actualiza el historial de gÃ©neros
   */
  private updateHistory(genre: MusicGenre): void {
    this.genreHistory.push(genre);
    
    // Mantener tamaÃ±o mÃ¡ximo
    while (this.genreHistory.length > this.historySize) {
      this.genreHistory.shift();
    }
  }
}

export default GenreClassifier;

