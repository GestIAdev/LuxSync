/**
 * 🧠 MUSICAL CONTEXT ENGINE - El Director de Orquesta de Selene
 * ================================================================
 * Wave 8 - FASE 4: Orquestación
 * 
 * La clase maestra que coordina TODOS los analizadores musicales
 * y genera el MusicalContext unificado para la Consciencia Felina.
 * 
 * FLUJO:
 * 1. Recibe AudioAnalysis (cada 30ms del Main Thread)
 * 2. Ejecuta RhythmAnalyzer (Main Thread, ligero)
 * 3. Ejecuta HarmonyDetector + SectionTracker + GenreClassifier (Throttled 500ms)
 * 4. Sintetiza el Mood global
 * 5. Calcula la Energía Global
 * 6. Calcula la Confianza Combinada
 * 7. **DECIDE: Modo Reactivo vs Modo Inteligente** ← REGLA 2 CRÍTICA
 * 8. Emite evento 'context' con todo empaquetado
 * 
 * ⚠️ REGLAS DE ORO:
 * - REGLA 1: Main Thread < 5ms, Worker/Throttle para análisis pesado
 * - REGLA 2: confidence < 0.5 → fallbackReactiveMode() (V17 style)
 * - REGLA 3: Sincopación tiene peso 90% vs BPM 10% en confianza
 * 
 * @module engines/musical/context/MusicalContextEngine
 * @version 1.0.0 - FASE 4
 */

import { EventEmitter } from 'events';
import {
  AudioAnalysis,
  MusicalContext,
  RhythmAnalysis,
  HarmonyAnalysis,
  SectionAnalysis,
  GenreClassification,
  SynthesizedMood,
  MusicalEngineConfig,
  DEFAULT_MUSICAL_ENGINE_CONFIG,
  MusicGenre,
  SectionType,
  HarmonicMood,
} from '../types.js';

import { RhythmAnalyzer } from '../analysis/RhythmAnalyzer.js';
import { HarmonyDetector, createHarmonyDetector } from '../analysis/HarmonyDetector.js';
import { SectionTracker, createSectionTracker } from '../analysis/SectionTracker.js';
import { GenreClassifier } from '../classification/GenreClassifier.js';
import { PredictionMatrix, createPredictionMatrix, ExtendedPrediction } from './PredictionMatrix.js';

// ============================================================
// 📊 TIPOS Y CONSTANTES
// ============================================================

/**
 * Modo de operación del motor
 */
export type OperationMode = 'reactive' | 'intelligent' | 'transitioning';

/**
 * Resultado del modo reactivo (V17 style)
 * Mapeo directo: Bass→Pulso, Treble→Shimmer, Beat→Flash
 */
export interface ReactiveResult {
  mode: 'reactive';
  pulse: number;          // Basado en bass (0-1)
  shimmer: number;        // Basado en treble (0-1)
  flash: boolean;         // Si hay beat detectado
  intensity: number;      // Energía general (0-1)
  timestamp: number;
}

/**
 * Resultado del modo inteligente
 */
export interface IntelligentResult {
  mode: 'intelligent';
  context: MusicalContext;
  prediction: ExtendedPrediction | null;
  suggestedPalette: string;
  suggestedMovement: string;
  timestamp: number;
}

/**
 * Resultado unificado del motor
 */
export type EngineResult = ReactiveResult | IntelligentResult;

/**
 * Configuración extendida del motor
 */
export interface MusicalContextEngineConfig extends MusicalEngineConfig {
  /** Habilitar modo reactivo como fallback */
  enableReactiveFallback: boolean;
  /** Peso de ritmo en confianza combinada */
  rhythmConfidenceWeight: number;
  /** Peso de armonía en confianza combinada */
  harmonyConfidenceWeight: number;
  /** Peso de género en confianza combinada */
  genreConfidenceWeight: number;
  /** Peso de sección en confianza combinada */
  sectionConfidenceWeight: number;
  /** Umbral de histéresis para cambio de modo */
  modeHysteresis: number;
}

const DEFAULT_ENGINE_CONFIG: MusicalContextEngineConfig = {
  ...DEFAULT_MUSICAL_ENGINE_CONFIG,
  enableReactiveFallback: true,
  rhythmConfidenceWeight: 0.35,     // Ritmo es MUY confiable
  harmonyConfidenceWeight: 0.20,    // Armonía tarda más en converger
  genreConfidenceWeight: 0.25,      // Género es importante
  sectionConfidenceWeight: 0.20,    // Sección es útil
  modeHysteresis: 0.05,             // 5% de histéresis para evitar flip-flop
};

/**
 * Mapeo de género a paleta sugerida
 * 🔥 WAVE 12: Cyberpunk → NEÓN obligatorio
 */
const GENRE_TO_PALETTE: Record<MusicGenre, string> = {
  cumbia: 'fuego',
  reggaeton: 'neon',
  techno: 'cyber',
  cyberpunk: 'neon',    // 🔥 WAVE 12: CYBERPUNK → NEÓN SIEMPRE
  house: 'rainbow',
  latin_pop: 'tropical',
  trap: 'dark',
  drum_and_bass: 'energy',
  ambient: 'ocean',
  edm: 'electric',
  trance: 'aurora',
  dubstep: 'glitch',
  pop: 'candy',
  rock: 'fire',
  indie: 'sunset',
  alternative: 'forest',
  hip_hop: 'urban',
  r_and_b: 'velvet',
  jazz: 'smoky',
  classical: 'elegant',
  salsa: 'salsa',
  bachata: 'romance',
  unknown: 'default',
};

/**
 * Mapeo de mood a movimiento sugerido
 */
const MOOD_TO_MOVEMENT: Record<SynthesizedMood, string> = {
  euphoric: 'burst',
  melancholic: 'wave',
  aggressive: 'slash',
  chill: 'breathe',
  groovy: 'figure8',
  epic: 'sweep',
  intimate: 'pulse',
  party: 'random',
  neutral: 'circular',
};

// ============================================================
// 🧠 MUSICAL CONTEXT ENGINE CLASS
// ============================================================

/**
 * Motor de Contexto Musical - El Cerebro de Wave 8
 */
export class MusicalContextEngine extends EventEmitter {
  // Analizadores
  private rhythmAnalyzer: RhythmAnalyzer;
  private harmonyDetector: HarmonyDetector;
  private sectionTracker: SectionTracker;
  private genreClassifier: GenreClassifier;
  private predictionMatrix: PredictionMatrix;
  
  // Estado
  private config: MusicalContextEngineConfig;
  private currentMode: OperationMode = 'reactive';
  private overallConfidence: number = 0;
  private lastContext: MusicalContext | null = null;
  private lastResult: EngineResult | null = null;
  
  // Throttling para análisis pesado
  private lastHeavyAnalysisTime: number = 0;
  private cachedHarmony: HarmonyAnalysis | null = null;
  private cachedSection: SectionAnalysis | null = null;
  private cachedGenre: GenreClassification | null = null;
  
  // Warmup tracking
  private startTime: number = Date.now();
  private processCount: number = 0;
  
  // Performance tracking
  private totalProcessTime: number = 0;
  
  constructor(config: Partial<MusicalContextEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    
    // Inicializar analizadores
    this.rhythmAnalyzer = new RhythmAnalyzer();
    this.harmonyDetector = createHarmonyDetector();
    this.sectionTracker = createSectionTracker();
    this.genreClassifier = new GenreClassifier();
    this.predictionMatrix = createPredictionMatrix();
    
    // Escuchar eventos de los analizadores
    this.setupEventListeners();
  }
  
  // ============================================================
  // 🎯 MÉTODO PRINCIPAL: PROCESS
  // ============================================================
  
  /**
   * Procesa el audio y retorna el resultado apropiado
   * 
   * ⚠️ REGLA 2 IMPLEMENTADA:
   * - Si confidence < 0.5 → fallbackReactiveMode()
   * - Si confidence >= 0.5 → intelligentMode()
   * 
   * @param audio - Análisis de audio del BeatDetector/FFTAnalyzer
   * @returns Resultado reactivo o inteligente según confianza
   */
  process(audio: AudioAnalysis): EngineResult {
    const startTime = performance.now();
    const now = Date.now();
    this.processCount++;
    
    // =====================================================
    // PASO 1: Análisis Rítmico (SIEMPRE, Main Thread, Ligero)
    // =====================================================
    const audioMetrics = this.audioToMetrics(audio);
    const beatState = {
      bpm: audio.beat.bpm,
      phase: audio.beat.beatPhase,
      onBeat: audio.beat.detected,
    };
    const rhythm = this.rhythmAnalyzer.analyze(audioMetrics, beatState);
    
    // =====================================================
    // PASO 2: Análisis Pesado (Throttled 500ms)
    // =====================================================
    const shouldDoHeavyAnalysis = now - this.lastHeavyAnalysisTime >= this.config.workerThreadInterval;
    
    // Audio simplificado para SectionTracker y GenreClassifier
    const simpleAudio = {
      energy: audio.energy?.current ?? 0.5,
      bass: audio.spectrum.bass,
      mid: audio.spectrum.mid,
      treble: audio.spectrum.treble,
    };
    
    if (shouldDoHeavyAnalysis) {
      this.lastHeavyAnalysisTime = now;
      
      // Harmony (throttled)
      this.cachedHarmony = this.harmonyDetector.analyze(audio);
      
      // Section (throttled)
      this.cachedSection = this.sectionTracker.track(
        rhythm,
        this.cachedHarmony!,
        simpleAudio
      );
      
      // Genre (throttled)
      const genreResult = this.genreClassifier.classify(
        rhythm,
        this.cachedHarmony!,
        simpleAudio
      );
      this.cachedGenre = {
        primary: genreResult.genre,
        confidence: genreResult.confidence,
        secondary: genreResult.subgenre !== 'none' ? genreResult.genre : undefined,
        characteristics: this.extractCharacteristics(genreResult),
        timestamp: now,
      };
    }
    
    // =====================================================
    // PASO 3: Calcular Confianza Combinada
    // =====================================================
    this.overallConfidence = this.calculateOverallConfidence(
      rhythm,
      this.cachedHarmony,
      this.cachedSection,
      this.cachedGenre
    );
    
    // =====================================================
    // PASO 4: DECIDIR MODO (REGLA 2 CRÍTICA)
    // =====================================================
    const previousMode = this.currentMode;
    const newMode = this.decideMode(this.overallConfidence);
    
    // Emitir evento si cambió el modo
    if (newMode !== previousMode && newMode !== 'transitioning') {
      this.currentMode = newMode;
      this.emit('mode-change', {
        from: previousMode,
        to: newMode,
        confidence: this.overallConfidence,
        timestamp: now,
      });
    }
    
    // =====================================================
    // PASO 5: Ejecutar el modo apropiado
    // =====================================================
    let result: EngineResult;
    
    if (this.currentMode === 'reactive' || !this.hasValidAnalysis()) {
      result = this.fallbackReactiveMode(audio);
    } else {
      result = this.intelligentMode(
        rhythm,
        this.cachedHarmony!,
        this.cachedSection!,
        this.cachedGenre!,
        audio
      );
    }
    
    // Performance tracking
    const elapsed = performance.now() - startTime;
    this.totalProcessTime += elapsed;
    
    // Guardar resultado
    this.lastResult = result;
    
    // Emitir resultado
    this.emit('result', result);
    
    return result;
  }
  
  // ============================================================
  // ❄️ MODO REACTIVO (REGLA 2 - FALLBACK)
  // ============================================================
  
  /**
   * 🔥 MODO REACTIVO (V17 Style)
   * 
   * Cuando confidence < 0.5, NO esperamos al análisis de género.
   * Simplemente mapeamos directo:
   * - Bass → Pulso (intensidad de graves)
   * - Treble → Shimmer (brillo/parpadeo)
   * - Beat → Flash (flash en cada golpe)
   * 
   * Esto garantiza que SIEMPRE hay reacción visual,
   * incluso en los primeros segundos de la canción.
   * 
   * @param audio - Análisis de audio actual
   * @returns ReactiveResult con mapeo directo
   */
  fallbackReactiveMode(audio: AudioAnalysis): ReactiveResult {
    const now = Date.now();
    
    // Mapeo directo de frecuencias a efectos visuales
    const pulse = Math.pow(audio.spectrum.bass, 0.8);      // Bass → Pulso
    const shimmer = audio.spectrum.treble * 0.7 +           // Treble → Shimmer
                    audio.spectrum.highMid * 0.3;
    const flash = audio.beat.detected;                      // Beat → Flash
    
    // Energía general (promedio ponderado)
    const intensity = (
      audio.spectrum.bass * 0.4 +
      audio.spectrum.mid * 0.3 +
      audio.spectrum.treble * 0.3
    );
    
    const result: ReactiveResult = {
      mode: 'reactive',
      pulse: Math.min(1, pulse),
      shimmer: Math.min(1, shimmer),
      flash,
      intensity: Math.min(1, intensity),
      timestamp: now,
    };
    
    this.emit('reactive-update', result);
    return result;
  }
  
  // ============================================================
  // 🎭 MODO INTELIGENTE
  // ============================================================
  
  /**
   * 🧠 MODO INTELIGENTE
   * 
   * Cuando confidence >= 0.5, usamos toda la inteligencia:
   * - Género detectado → Paleta de colores
   * - Mood sintetizado → Patrón de movimiento
   * - Sección → Intensidad base
   * - Predicciones → Anticipación de cambios
   * 
   * @returns IntelligentResult con contexto completo
   */
  private intelligentMode(
    rhythm: RhythmAnalysis,
    harmony: HarmonyAnalysis,
    section: SectionAnalysis,
    genre: GenreClassification,
    audio: AudioAnalysis
  ): IntelligentResult {
    const now = Date.now();
    
    // Sintetizar mood
    const mood = this.synthesizeMood(harmony, section, genre);
    
    // Calcular energía global
    const energy = this.calculateEnergy(rhythm, section, audio);
    
    // Construir contexto musical completo
    const context: MusicalContext = {
      rhythm,
      harmony,
      section,
      genre,
      mood,
      energy,
      confidence: this.overallConfidence,
      timestamp: now,
    };
    
    // Generar predicción
    const prediction = this.predictionMatrix.generate(rhythm, section);
    
    // Seleccionar paleta y movimiento
    const suggestedPalette = GENRE_TO_PALETTE[genre.primary] || 'default';
    const suggestedMovement = MOOD_TO_MOVEMENT[mood] || 'circular';
    
    // Guardar contexto
    this.lastContext = context;
    
    // Emitir contexto
    this.emit('context', context);
    
    // Emitir predicción si existe
    if (prediction) {
      this.emit('prediction', prediction);
    }
    
    return {
      mode: 'intelligent',
      context,
      prediction,
      suggestedPalette,
      suggestedMovement,
      timestamp: now,
    };
  }
  
  // ============================================================
  // 🎭 SÍNTESIS DE MOOD
  // ============================================================
  
  /**
   * Sintetiza el mood combinando armonía, sección y género
   * 
   * Prioridad:
   * 1. Sección (drop = euphoric, breakdown = chill)
   * 2. Armonía (mood detectado)
   * 3. Género (características típicas)
   */
  private synthesizeMood(
    harmony: HarmonyAnalysis,
    section: SectionAnalysis,
    genre: GenreClassification
  ): SynthesizedMood {
    // Sección tiene prioridad alta
    const sectionMood = this.getSectionMood(section.current.type);
    if (sectionMood !== 'neutral') {
      return sectionMood;
    }
    
    // Luego considerar armonía
    const harmonicMood = harmony.mode?.mood || 'universal';
    const harmonicSynthMood = this.mapHarmonicToSynthesized(harmonicMood);
    
    // Combinar con género para casos específicos
    if (genre.primary === 'reggaeton' || genre.primary === 'cumbia') {
      return section.intensity > 0.7 ? 'party' : 'groovy';
    }
    
    if (genre.primary === 'ambient') {
      return 'chill';
    }
    
    if (genre.primary === 'drum_and_bass' || genre.primary === 'dubstep') {
      return section.intensity > 0.6 ? 'aggressive' : 'groovy';
    }
    
    return harmonicSynthMood;
  }
  
  /**
   * Mapea tipo de sección a mood
   */
  private getSectionMood(sectionType: SectionType): SynthesizedMood {
    const mapping: Partial<Record<SectionType, SynthesizedMood>> = {
      drop: 'euphoric',
      buildup: 'epic',
      breakdown: 'chill',
      chorus: 'party',
      verse: 'groovy',
      intro: 'intimate',
      outro: 'melancholic',
    };
    return mapping[sectionType] || 'neutral';
  }
  
  /**
   * Mapea mood armónico a mood sintetizado
   */
  private mapHarmonicToSynthesized(harmonic: HarmonicMood): SynthesizedMood {
    const mapping: Record<HarmonicMood, SynthesizedMood> = {
      happy: 'euphoric',
      sad: 'melancholic',
      jazzy: 'groovy',
      spanish_exotic: 'aggressive',
      dreamy: 'chill',
      bluesy: 'intimate',
      tense: 'aggressive',
      universal: 'neutral',
    };
    return mapping[harmonic] || 'neutral';
  }
  
  // ============================================================
  // ⚡ CÁLCULO DE ENERGÍA
  // ============================================================
  
  /**
   * Calcula la energía global del momento musical
   * 
   * Combina:
   * - Intensidad de sección (40%)
   * - Energía de audio (40%)
   * - Actividad rítmica (20%)
   */
  private calculateEnergy(
    rhythm: RhythmAnalysis,
    section: SectionAnalysis,
    audio: AudioAnalysis
  ): number {
    // Energía de sección
    const sectionEnergy = section.intensity;
    
    // Energía de audio (espectro)
    const audioEnergy = (
      audio.spectrum.bass * 0.4 +
      audio.spectrum.mid * 0.3 +
      audio.spectrum.treble * 0.2 +
      (audio.energy?.current || 0.5) * 0.1
    );
    
    // Actividad rítmica
    const rhythmActivity = (
      (rhythm.drums.kickDetected ? 0.3 : 0) +
      (rhythm.drums.snareDetected ? 0.3 : 0) +
      (rhythm.drums.hihatDetected ? 0.2 : 0) +
      (rhythm.fillInProgress ? 0.2 : 0)
    );
    
    // Combinar con pesos
    const totalEnergy = 
      sectionEnergy * 0.4 +
      audioEnergy * 0.4 +
      rhythmActivity * 0.2;
    
    return Math.min(1, Math.max(0, totalEnergy));
  }
  
  // ============================================================
  // 📊 CÁLCULO DE CONFIANZA COMBINADA
  // ============================================================
  
  /**
   * Calcula la confianza combinada de todos los análisis
   * 
   * ⚠️ REGLA 2: Este valor determina si usar fallback
   * 
   * Sistema de confianza ponderada:
   * - Ritmo: 35% (muy confiable, rápido en converger)
   * - Género: 25% (importante para paleta)
   * - Armonía: 20% (tarda más en converger)
   * - Sección: 20% (útil para intensidad)
   * 
   * REGLA 3 aplicada: Si ritmo dice Techno (90%) y armonía dice Jazz (10%),
   * la confianza de ritmo domina.
   */
  private calculateOverallConfidence(
    rhythm: RhythmAnalysis,
    harmony: HarmonyAnalysis | null,
    section: SectionAnalysis | null,
    genre: GenreClassification | null
  ): number {
    // Verificar si estamos en warmup
    const timeSinceStart = Date.now() - this.startTime;
    if (timeSinceStart < this.config.warmupTime) {
      // Durante warmup, confianza reducida proporcionalmente
      const warmupFactor = timeSinceStart / this.config.warmupTime;
      return Math.min(0.4, warmupFactor * 0.4);
    }
    
    // Obtener confianzas individuales
    const rhythmConf = rhythm.confidence;
    const harmonyConf = harmony?.confidence ?? 0;
    const sectionConf = section?.confidence ?? 0;
    const genreConf = genre?.confidence ?? 0;
    
    // Calcular confianza ponderada
    const weightedConfidence = 
      rhythmConf * this.config.rhythmConfidenceWeight +
      harmonyConf * this.config.harmonyConfidenceWeight +
      sectionConf * this.config.sectionConfidenceWeight +
      genreConf * this.config.genreConfidenceWeight;
    
    // Penalizar si algún análisis falta
    const analysisCoverage = [
      harmony !== null,
      section !== null,
      genre !== null,
    ].filter(Boolean).length / 3;
    
    return weightedConfidence * (0.7 + 0.3 * analysisCoverage);
  }
  
  // ============================================================
  // 🔄 DECISIÓN DE MODO
  // ============================================================
  
  /**
   * Decide el modo de operación con histéresis
   * 
   * ⚠️ REGLA 2: El umbral es 0.5 (configurable)
   * 
   * Histéresis para evitar flip-flop:
   * - Para entrar en intelligent: confidence > threshold + hysteresis
   * - Para salir de intelligent: confidence < threshold - hysteresis
   */
  private decideMode(confidence: number): OperationMode {
    const threshold = this.config.confidenceThreshold;
    const hysteresis = this.config.modeHysteresis;
    
    if (this.currentMode === 'reactive') {
      // Estamos en reactivo, necesitamos superar threshold + hysteresis
      if (confidence >= threshold + hysteresis) {
        return 'intelligent';
      }
      return 'reactive';
    } else {
      // Estamos en inteligente, caemos si bajamos de threshold - hysteresis
      if (confidence < threshold - hysteresis) {
        return 'reactive';
      }
      return 'intelligent';
    }
  }
  
  // ============================================================
  // 🛠️ UTILIDADES
  // ============================================================
  
  /**
   * Verifica si tenemos análisis válidos
   */
  private hasValidAnalysis(): boolean {
    return (
      this.cachedHarmony !== null &&
      this.cachedSection !== null &&
      this.cachedGenre !== null
    );
  }
  
  /**
   * Convierte AudioAnalysis a formato de RhythmAnalyzer
   */
  private audioToMetrics(audio: AudioAnalysis): any {
    return {
      lowBass: audio.spectrum.bass,
      midBass: audio.spectrum.lowMid,
      lowMid: audio.spectrum.mid,
      highMid: audio.spectrum.highMid,
      treble: audio.spectrum.treble,
      spectralCentroid: 0.5, // Default
      beatPhase: audio.beat.beatPhase,
      bpm: audio.beat.bpm,
      beatConfidence: audio.beat.confidence,
    };
  }
  
  /**
   * Extrae características del análisis de género
   */
  private extractCharacteristics(genreResult: any): any[] {
    const chars: any[] = [];
    
    if (genreResult.features?.hasDembow) chars.push('dembow');
    if (genreResult.features?.hasGuiro) chars.push('caballito');
    if (genreResult.features?.bpm >= 120) chars.push('four_on_floor');
    if (genreResult.features?.syncopation > 0.4) chars.push('syncopated');
    
    return chars;
  }
  
  /**
   * Configura listeners para eventos de analizadores
   */
  private setupEventListeners(): void {
    // Propagar eventos de SectionTracker
    this.sectionTracker.on('section-change', (data: any) => {
      this.emit('section-change', data);
    });
    
    // Propagar eventos de HarmonyDetector
    this.harmonyDetector.on('key-change', (data: any) => {
      this.emit('key-change', data);
    });
    
    this.harmonyDetector.on('tension', (data: any) => {
      this.emit('tension', data);
    });
    
    // Propagar eventos de PredictionMatrix
    this.predictionMatrix.on('prediction', (data: any) => {
      this.emit('prediction', data);
    });
  }
  
  // ============================================================
  // 📊 API PÚBLICA
  // ============================================================
  
  /**
   * Obtiene el modo de operación actual
   */
  getMode(): OperationMode {
    return this.currentMode;
  }
  
  /**
   * Obtiene la confianza actual
   */
  getConfidence(): number {
    return this.overallConfidence;
  }
  
  /**
   * Obtiene el último contexto (solo válido en modo inteligente)
   */
  getLastContext(): MusicalContext | null {
    return this.lastContext;
  }
  
  /**
   * Obtiene el último resultado
   */
  getLastResult(): EngineResult | null {
    return this.lastResult;
  }
  
  /**
   * 🎵 WAVE 14.5: Obtiene el último análisis rítmico
   * Útil para modo reactivo donde no hay context completo
   */
  getLastRhythm(): RhythmAnalysis | null {
    return this.rhythmAnalyzer.getLastResult();
  }
  
  /**
   * Obtiene estadísticas de rendimiento
   */
  getPerformanceStats(): {
    processCount: number;
    averageProcessTime: number;
    currentMode: OperationMode;
    overallConfidence: number;
    timeSinceStart: number;
  } {
    return {
      processCount: this.processCount,
      averageProcessTime: this.processCount > 0
        ? this.totalProcessTime / this.processCount
        : 0,
      currentMode: this.currentMode,
      overallConfidence: this.overallConfidence,
      timeSinceStart: Date.now() - this.startTime,
    };
  }
  
  /**
   * Resetea el estado del motor
   */
  reset(): void {
    this.currentMode = 'reactive';
    this.overallConfidence = 0;
    this.lastContext = null;
    this.lastResult = null;
    this.cachedHarmony = null;
    this.cachedSection = null;
    this.cachedGenre = null;
    this.lastHeavyAnalysisTime = 0;
    this.startTime = Date.now();
    this.processCount = 0;
    this.totalProcessTime = 0;
    
    // Reset analizadores
    this.rhythmAnalyzer.reset?.();
    this.harmonyDetector.reset?.();
    this.sectionTracker.reset?.();
    this.genreClassifier.reset?.();
    this.predictionMatrix.reset();
    
    this.emit('reset');
  }
  
  /**
   * Actualiza la configuración
   */
  updateConfig(config: Partial<MusicalContextEngineConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }
  
  /**
   * Fuerza el modo de operación (para testing/debug)
   */
  forceMode(mode: OperationMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;
    if (mode !== previousMode) {
      this.emit('mode-change', {
        from: previousMode,
        to: mode,
        confidence: this.overallConfidence,
        forced: true,
        timestamp: Date.now(),
      });
    }
  }
}

// ============================================================
// 🏭 FACTORY FUNCTION
// ============================================================

/**
 * Crea una instancia de MusicalContextEngine con configuración opcional
 */
export function createMusicalContextEngine(
  config?: Partial<MusicalContextEngineConfig>
): MusicalContextEngine {
  return new MusicalContextEngine(config);
}

// Export default
export default MusicalContextEngine;
