/**
 * 🎼 WAVE 8: MUSICAL INTELLIGENCE - TYPE DEFINITIONS
 * ===================================================
 * Tipos e interfaces base para el Motor de Inteligencia Musical
 * 
 * REGLAS DE ORO IMPLEMENTADAS:
 * - REGLA 1: Separación Main Thread vs Worker Thread
 * - REGLA 2: Campo 'confidence' en todas las interfaces críticas
 * - REGLA 3: 'syncopation' como ciudadano de primera clase
 * 
 * @module engines/musical/types
 */

// PHI definido localmente (heredado de FibonacciPatternEngine)
const PHI = (1 + Math.sqrt(5)) / 2; // ≈ 1.6180339887...

// ============================================================
// 🎵 GÉNEROS MUSICALES
// ============================================================

/**
 * Géneros musicales reconocidos por Selene
 * 
 * IMPORTANTE: 'cumbia' y 'reggaeton' son DISTINTOS
 * - Cumbia: Caballito güiro constante, 85-115 BPM
 * - Reggaeton: Dembow pattern (Kick...Snare), 90-100 BPM
 */
export type MusicGenre =
  // Electrónica
  | 'edm'
  | 'house'
  | 'techno'
  | 'trance'
  | 'dubstep'
  | 'drum_and_bass'
  // Latino - CRÍTICO para Argentina
  | 'reggaeton'        // Dembow pattern (Kick...Snare)
  | 'cumbia'           // 🇦🇷 Caballito güiro constante
  | 'latin_pop'
  | 'salsa'
  | 'bachata'
  // Pop/Rock
  | 'pop'
  | 'rock'
  | 'indie'
  | 'alternative'
  // Urbano
  | 'hip_hop'
  | 'trap'
  | 'r_and_b'
  // Otros
  | 'jazz'
  | 'classical'
  | 'ambient'
  | 'unknown';

// ============================================================
// 🥁 ANÁLISIS RÍTMICO
// ============================================================

/**
 * Tipos de patrón de batería/percusión
 */
export type DrumPatternType =
  | 'four_on_floor'    // EDM, House, Disco - Kick en cada beat
  | 'breakbeat'        // Drum & Bass, Jungle - Sincopado complejo
  | 'half_time'        // Dubstep, Trap - Snare en beat 3
  | 'reggaeton'        // Dembow pattern (Kick...Snare)
  | 'cumbia'           // 🇦🇷 Caballito güiro constante
  | 'rock_standard'    // Rock básico 4/4
  | 'jazz_swing'       // Swing con ride cymbal
  | 'latin'            // Clave patterns (3-2, 2-3)
  | 'minimal'          // Intro/Outro - Mínima percusión
  | 'unknown';

/**
 * Detección de elementos de batería
 */
export interface DrumDetection {
  kickDetected: boolean;
  kickIntensity: number;        // 0-1
  snareDetected: boolean;
  snareIntensity: number;       // 0-1
  hihatDetected: boolean;
  hihatIntensity: number;       // 0-1
  crashDetected: boolean;
  fillDetected: boolean;
}

/**
 * Análisis del groove (feeling rítmico)
 * 
 * ⚠️ REGLA 3: syncopation es CRÍTICO para clasificación
 */
export interface GrooveAnalysis {
  /**
   * 🎯 SINCOPACIÓN - ARMA SECRETA
   * 
   * Mide qué tan "off-beat" es el ritmo
   * - < 0.15: Straight/Four-on-floor (Techno, House)
   * - 0.15-0.4: Moderado (Pop, Rock)
   * - > 0.4: Alto (Reggaeton, Funk)
   * 
   * REGLA 3: Priorizar ANTES que BPM para clasificar
   */
  syncopation: number;          // 0-1 ← CIUDADANO DE PRIMERA CLASE
  
  /**
   * Swing amount (para Jazz/Blues)
   * - < 0.05: Straight
   * - 0.05-0.15: Light swing
   * - > 0.15: Heavy swing (Jazz)
   */
  swingAmount: number;          // 0-1
  
  /**
   * Complejidad del patrón
   */
  complexity: 'low' | 'medium' | 'high';
  
  /**
   * Humanización (variación de timing)
   * Basado en DrumPatternEngine: ~6% default
   */
  humanization: number;         // 0-1
}

/**
 * 🥁 RHYTHM ANALYSIS - Resultado completo
 * 
 * Ejecutar en: Main Thread (ligero)
 * Frecuencia: 30ms
 * 
 * ⚠️ REGLA 2: Incluye 'confidence' para fallback
 */
export interface RhythmAnalysis {
  /** BPM detectado */
  bpm: number;
  
  /** Confianza del análisis (0-1) */
  confidence: number;           // ← REGLA 2
  
  /** Fase dentro del beat (0-1) */
  beatPhase: number;
  
  /** Fase dentro del compás (0-1) */
  barPhase: number;
  
  /** Tipo de patrón detectado */
  pattern: {
    type: DrumPatternType;
    confidence: number;
  };
  
  /** Detección de elementos de batería */
  drums: DrumDetection;
  
  /** 
   * Análisis del groove
   * ⚠️ syncopation aquí es CRÍTICO
   */
  groove: GrooveAnalysis;
  
  /** Fill detectado (para anticipar cambios) */
  fillInProgress: boolean;
  
  /** Timestamp del análisis */
  timestamp: number;
}

// ============================================================
// 🎸 ANÁLISIS ARMÓNICO
// ============================================================

/**
 * Escalas modales soportadas
 * Basado en ScaleUtils.ts de Aura Forge
 */
export type ModalScale =
  | 'major'            // Ionian - Feliz, brillante
  | 'minor'            // Aeolian - Triste, melancólico
  | 'dorian'           // Jazzy, sofisticado
  | 'phrygian'         // Spanish, exótico
  | 'lydian'           // Dreamy, etéreo
  | 'mixolydian'       // Bluesy, rock
  | 'locrian'          // Tenso, inestable
  | 'harmonic_minor'   // Dramático
  | 'melodic_minor'    // Jazz avanzado
  | 'pentatonic_major' // Simple, folk
  | 'pentatonic_minor' // Blues, rock
  | 'blues'            // Blues scale
  | 'chromatic';       // Todas las notas

/**
 * Mood derivado de la armonía
 */
export type HarmonicMood =
  | 'happy'            // Major modes
  | 'sad'              // Minor modes
  | 'jazzy'            // Dorian, altered
  | 'spanish_exotic'   // Phrygian
  | 'dreamy'           // Lydian
  | 'bluesy'           // Mixolydian, blues
  | 'tense'            // Locrian, diminished
  | 'universal';       // Pentatonic

/**
 * 🎸 HARMONY ANALYSIS
 * 
 * Ejecutar en: Worker Thread (pesado)
 * Frecuencia: Throttled 500ms
 * 
 * ⚠️ REGLA 2: Incluye 'confidence'
 */
export interface HarmonyAnalysis {
  /** Tonalidad detectada (C, D, E...) */
  key: string | null;
  
  /** Escala/modo detectado */
  mode: {
    scale: ModalScale;
    confidence: number;
    mood: HarmonicMood;
  };
  
  /** Acorde actual estimado */
  currentChord: {
    root: string | null;
    quality: 'major' | 'minor' | 'diminished' | 'augmented' | 'suspended' | null;
    confidence: number;
  };
  
  /** Confianza general */
  confidence: number;           // ← REGLA 2
  
  timestamp: number;
}

// ============================================================
// 📊 ANÁLISIS DE SECCIÓN
// ============================================================

/**
 * Tipos de sección musical
 */
export type SectionType =
  | 'intro'
  | 'verse'
  | 'pre_chorus'
  | 'chorus'
  | 'bridge'
  | 'buildup'
  | 'drop'
  | 'breakdown'
  | 'outro'
  | 'unknown';

/**
 * Tipo de transición entre secciones
 */
export type TransitionType =
  | 'smooth'           // Gradual
  | 'hard_cut'         // Abrupto
  | 'fill'             // Con fill de batería
  | 'breakdown';       // Con breakdown

/**
 * 📊 SECTION ANALYSIS
 * 
 * Ejecutar en: Worker Thread (pesado)
 * Frecuencia: Throttled 500ms
 * 
 * ⚠️ REGLA 2: Incluye 'confidence'
 */
export interface SectionAnalysis {
  /** Sección actual */
  current: {
    type: SectionType;
    confidence: number;
    startedAt: number;         // timestamp
    duration: number;          // ms estimado
  };
  
  /** Predicción de siguiente sección */
  predicted: {
    type: SectionType;
    probability: number;
    estimatedIn: number;       // ms hasta que ocurra
  } | null;
  
  /** Intensidad de la sección (0-1) */
  intensity: number;
  
  /** Trend de intensidad */
  intensityTrend: 'rising' | 'falling' | 'stable';
  
  /** Confianza general */
  confidence: number;           // ← REGLA 2
  
  timestamp: number;
}

// ============================================================
// 🎭 CLASIFICACIÓN DE GÉNERO
// ============================================================

/**
 * 🎭 GENRE CLASSIFICATION
 * 
 * Ejecutar en: Worker Thread (pesado)
 * Frecuencia: Throttled 500ms
 * 
 * ⚠️ REGLA 2: Incluye 'confidence' para fallback
 * ⚠️ REGLA 3: Se basa en syncopation, NO solo BPM
 */
export interface GenreClassification {
  /** Género principal detectado */
  primary: MusicGenre;
  
  /** Confianza en el género principal (0-1) */
  confidence: number;           // ← REGLA 2
  
  /** Género secundario (influencia o subgénero) */
  secondary?: MusicGenre;
  
  /** Características detectadas */
  characteristics: GenreCharacteristic[];
  
  timestamp: number;
}

/**
 * Características que identifican un género
 */
export type GenreCharacteristic =
  // Ritmo
  | 'four_on_floor'
  | 'syncopated'
  | 'half_time'
  | 'swing'
  // Bass
  | 'bass_heavy'
  | 'sub_bass'
  | '808_bass'
  | 'wobble_bass'
  // Percusión
  | 'dembow'           // Reggaeton: Kick...Snare
  | 'caballito'        // 🇦🇷 Cumbia: Güiro constante
  | 'hi_hats'
  | 'clap'
  // Producción
  | 'electronic'
  | 'acoustic'
  | 'synth_heavy'
  | 'organic';

// ============================================================
// 🧠 CONTEXTO MUSICAL UNIFICADO
// ============================================================

/**
 * Mood sintetizado de múltiples señales
 */
export type SynthesizedMood =
  | 'euphoric'         // Drop + Major + High energy
  | 'melancholic'      // Minor + Slow + Low energy
  | 'aggressive'       // High bass + Fast + Tense
  | 'chill'            // Slow + Low intensity + Dreamy
  | 'groovy'           // High syncopation + Medium energy
  | 'epic'             // Buildup + Rising intensity
  | 'intimate'         // Low intensity + Acoustic
  | 'party'            // High energy + Danceable
  | 'neutral';

/**
 * 🧠 MUSICAL CONTEXT - Estado completo
 * 
 * Este es el objeto principal que consume el sistema de luces
 * 
 * ⚠️ REGLA 2: confidence determina si usar fallback
 */
export interface MusicalContext {
  /** Análisis rítmico (actualizado 30ms) */
  rhythm: RhythmAnalysis;
  
  /** Análisis armónico (actualizado 500ms) */
  harmony: HarmonyAnalysis;
  
  /** Análisis de sección (actualizado 500ms) */
  section: SectionAnalysis;
  
  /** Clasificación de género (actualizado 500ms) */
  genre: GenreClassification;
  
  /** Mood sintetizado */
  mood: SynthesizedMood;
  
  /** Energía general (0-1) */
  energy: number;
  
  /**
   * 🎯 CONFIANZA GENERAL
   * 
   * ⚠️ REGLA 2 CRÍTICA:
   * - < 0.5 → Usar MODO REACTIVO (V17)
   * - >= 0.5 → Usar MODO INTELIGENTE
   */
  confidence: number;
  
  /** Timestamp de última actualización */
  timestamp: number;
}

// ============================================================
// 🔮 PREDICCIONES
// ============================================================

/**
 * Tipos de predicción
 */
export type PredictionType =
  | 'drop_incoming'           // Se viene un drop
  | 'buildup_starting'        // Empezando buildup
  | 'breakdown_imminent'      // Breakdown próximo
  | 'transition_beat'         // Cambio de sección en próximo beat
  | 'fill_expected'           // Fill de batería esperado
  | 'key_change';             // Cambio de tonalidad

/**
 * 🔮 PREDICTION
 */
export interface MusicalPrediction {
  type: PredictionType;
  probability: number;         // 0-1
  timeUntil: number;           // ms hasta que ocurra
  beatsUntil: number;          // beats hasta que ocurra
  timestamp: number;
}

// ============================================================
// 🎨 MAPEO MÚSICA → LUCES
// ============================================================

/**
 * Sugerencia de iluminación basada en análisis musical
 */
export interface LightingSuggestion {
  /** Paleta sugerida */
  palette: {
    id: string;                // ID de LivingPalette
    intensity: number;         // 0-1
    saturation: number;        // 0-1
  };
  
  /** Movimiento sugerido */
  movement: {
    pattern: string;           // wave, circle, figure8, etc.
    speed: number;             // Relativo al BPM
    range: number;             // Rango de movimiento 0-1
    syncToBpm: boolean;
  };
  
  /** Efectos sugeridos */
  effects: EffectSuggestion[];
  
  /** Duración de transición */
  transitionDuration: number;  // ms
  
  /** Confianza en la sugerencia */
  confidence: number;
  
  /** Razón de la sugerencia (para debug) */
  reasoning: string;
}

/**
 * Sugerencia de efecto individual
 */
export interface EffectSuggestion {
  id: string;                  // flash, strobe, pulse, breathe, etc.
  intensity: number;           // 0-1
  duration: number;            // ms
  trigger?: 'beat' | 'section' | 'prediction' | 'immediate';
}

// ============================================================
// 📚 APRENDIZAJE
// ============================================================

/**
 * Patrón aprendido para un género/contexto
 */
export interface LearnedPattern {
  id: string;
  genre: MusicGenre;
  characteristics: GenreCharacteristic[];
  
  /** Mapeo aprendido */
  mapping: {
    palette: string;
    movement: string;
    effects: string[];
  };
  
  /** Métricas de uso */
  metrics: {
    timesUsed: number;
    successRate: number;       // 0-1 basado en feedback
    beautyScore: number;       // 0-1 basado en PHI
    beautyTrend: 'rising' | 'falling' | 'stable';
  };
  
  /** Última actualización */
  lastUpdated: number;
}

// ============================================================
// 🔧 CONFIGURACIÓN
// ============================================================

/**
 * Configuración del Motor Musical
 */
export interface MusicalEngineConfig {
  /** Frecuencia de análisis en Main Thread (ms) */
  mainThreadInterval: number;  // Default: 30
  
  /** Frecuencia de análisis en Worker Thread (ms) */
  workerThreadInterval: number; // Default: 500
  
  /** Umbral de confianza para modo inteligente */
  confidenceThreshold: number;  // Default: 0.5 (REGLA 2)
  
  /** Tiempo de warmup antes de clasificar (ms) */
  warmupTime: number;           // Default: 5000 (5 segundos)
  
  /** Habilitar aprendizaje */
  learningEnabled: boolean;
  
  /** Habilitar predicciones */
  predictionsEnabled: boolean;
}

/**
 * Configuración por defecto
 */
export const DEFAULT_MUSICAL_ENGINE_CONFIG: MusicalEngineConfig = {
  mainThreadInterval: 30,
  workerThreadInterval: 500,
  confidenceThreshold: 0.5,
  warmupTime: 5000,
  learningEnabled: true,
  predictionsEnabled: true,
};

// ============================================================
// 🌟 CONSTANTES
// ============================================================

/**
 * Constante PHI (Golden Ratio) - Heredada de Selene
 */
export const MUSICAL_PHI = PHI;

/**
 * Umbrales de sincopación por género
 * ⚠️ REGLA 3: Estos son los valores de referencia
 */
export const SYNCOPATION_THRESHOLDS = {
  /** Techno/House: Muy bajo (straight beat) */
  STRAIGHT: 0.15,
  
  /** Pop/Rock: Moderado */
  MODERATE: 0.4,
  
  /** Reggaeton/Funk: Alto */
  HIGH: 0.4,
  
  /** Jazz swing threshold */
  SWING_MIN: 0.15,
} as const;

/**
 * Umbrales de BPM por género (solo para desempate)
 * ⚠️ REGLA 3: Usar DESPUÉS de syncopation
 */
export const BPM_RANGES = {
  reggaeton: { min: 85, max: 100 },
  cumbia: { min: 85, max: 115 },
  house: { min: 118, max: 130 },
  techno: { min: 125, max: 145 },
  dubstep: { min: 138, max: 145 },
  trap: { min: 60, max: 90 },
  drum_and_bass: { min: 160, max: 180 },
} as const;

// ============================================================
// 🎧 AUDIO ANALYSIS INPUT
// ============================================================

/**
 * Espectro de audio por bandas de frecuencia
 * Compatible con BeatDetector output
 */
export interface AudioSpectrum {
  /** 20-250 Hz (0.0-1.0) */
  bass: number;
  /** 250-500 Hz */
  lowMid: number;
  /** 500-2000 Hz */
  mid: number;
  /** 2000-4000 Hz */
  highMid: number;
  /** 4000-20000 Hz */
  treble: number;
}

/**
 * Información de beat del BeatDetector
 */
export interface BeatInfo {
  detected: boolean;
  bpm: number;
  confidence: number;       // 0.0-1.0
  beatPhase: number;        // 0.0-1.0 (posición en el beat actual)
  timeSinceLastBeat: number; // milliseconds
}

/**
 * Información de energía del audio
 */
export interface EnergyInfo {
  current: number;          // 0.0-1.0 (energía instantánea)
  average: number;          // Rolling average (5s window)
  variance: number;         // Volatilidad de la energía
  trend: 'rising' | 'falling' | 'stable';
  peakRecent: number;       // Máximo en últimos 10s
}

/**
 * Análisis de audio completo
 * Input estándar para todos los motores de Wave 8
 * 
 * Compatible con BeatDetector y FFTAnalyzer outputs
 */
export interface AudioAnalysis {
  timestamp: number;
  
  /** Espectro de frecuencias (FFT resumido) */
  spectrum: AudioSpectrum;
  
  /** Detección de beat */
  beat: BeatInfo;
  
  /** Análisis de energía */
  energy: EnergyInfo;
  
  /** FFT crudo para análisis avanzado (chromagrama) */
  rawFFT?: Float32Array;
  
  /** Waveform crudo */
  waveform?: Float32Array;
  
  /** Transientes detectados (para drums) */
  transients?: {
    bass: number;       // 0-1
    mid: number;        // 0-1
    treble: number;     // 0-1
  };
}
