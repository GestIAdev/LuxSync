/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 SELENE MUSICAL BRAIN - El Sistema Nervioso Central
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este es el CEREBRO de Selene Lux. Conecta:
 * - MusicalContextEngine (percepción)
 * - SeleneMemoryManager (memoria a largo plazo)
 * - ProceduralPaletteGenerator (creatividad)
 * - MusicToLightMapper (acción)
 * 
 * FLUJO INTELIGENTE:
       // Extraer valores de tipos anidados correctamente
      const modeScale = context.harmony?.mode?.scale ?? 'major';
      const sectionType = context.section?.current?.type ?? 'unknown';
      const syncopation = context.rhythm?.groove?.syncopation ?? 0; // RESCUE DIRECTIVE: NO DEFAULTS
      
      // 🧠 WAVE 13: BRAIN UNLOCK - Reactivamos memoria con KEY-driven colors
      // La tonalidad musical determina el Hue base
      // Si no hay key detectada, el fallback es mood > mode
      const detectedKey = context.harmony?.key ?? null;
      
      // 🔮 WAVE 13.5: THE SOUL CONNECTION - Calcular elemento zodiacal desde audio
      const zodiacElement = this.calculateZodiacElement(audio);
      
      const musicalDNA = {
        key: detectedKey, // 🧠 WAVE 13: Key-driven colors (si disponible)
        mode: modeScale,
        energy: context.energy,
        syncopation: syncopation,
        mood: context.mood,
        section: sectionType,
        zodiacElement: zodiacElement, // 🔮 WAVE 13.5: Elemento zodiacal desde frecuencias
      };frame
 * 2. MusicalContextEngine analiza y crea contexto
 * 3. Consulta Memoria: ¿Existe patrón exitoso para este contexto?
 *    - SÍ → Usar configuración aprendida (recall)
 *    - NO → Generar proceduralmente (create)
 * 4. Aplicar a fixtures
 * 5. Evaluar resultado (beauty score)
 * 6. Aprender del resultado (si fue bueno)
 * 
 * @module SeleneMusicalBrain
 * @version 1.0.0
 */

import { EventEmitter } from 'events';

// Context & Analysis
import { 
  MusicalContextEngine,
  type IntelligentResult,
  type ReactiveResult,
} from './context/MusicalContextEngine';

// Memory
import { 
  SeleneMemoryManager, 
  getMemoryManager,
  resetMemoryManager,
  type LearnedPattern,
} from './learning/SeleneMemoryManager';

// Palette Generation
import { 
  ProceduralPaletteGenerator,
  type HSLColor,
} from './mapping/ProceduralPaletteGenerator';

// Light Mapping
import { 
  MusicToLightMapper,
  type LightingSuggestion,
} from './mapping/MusicToLightMapper';

// Types
import type { AudioAnalysis, MusicalContext } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS E INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado completo del procesamiento cerebral
 */
export interface BrainOutput {
  /** Timestamp del frame */
  timestamp: number;
  
  /** ID de la sesión actual */
  sessionId: string;
  
  /** Modo actual: reactive (sin confianza) o intelligent (con análisis completo) */
  mode: 'reactive' | 'intelligent';
  
  /** Confianza general del análisis (0-1) */
  confidence: number;
  
  /** Paleta de colores a aplicar */
  palette: {
    primary: HSLColor;
    secondary: HSLColor;
    accent: HSLColor;
    ambient?: HSLColor;
    contrast?: HSLColor;
    strategy: string;
  };
  
  /** Sugerencias de iluminación por fixture */
  lighting: LightingSuggestion;
  
  /** Contexto musical (solo en modo intelligent) */
  context?: MusicalContext;
  
  /** Fuente de la paleta */
  paletteSource: 'memory' | 'procedural' | 'fallback';
  
  /** ID del patrón usado (si viene de memoria) */
  patternId?: string;
  
  /** Beauty score estimado (0-1) */
  estimatedBeauty: number;
  
  /** 🎨 WAVE 17.2: Debug info from SeleneColorEngine (GAMMA worker) */
  debugInfo?: {
    macroGenre?: string;       // e.g., "ELECTRONIC_4X4"
    strategy?: string;         // e.g., "analogous", "complementary"
    temperature?: string;      // e.g., "warm", "cool", "neutral"
    description?: string;      // e.g., "Azul profundo hipnótico (Techno A minor)"
    key?: string | null;       // e.g., "A", "D#"
    mode?: string;             // e.g., "major", "minor"
  };
  
  /** Métricas de performance */
  performance: {
    totalMs: number;
    contextMs: number;
    memoryMs: number;
    paletteMs: number;
    mappingMs: number;
  };
}

/**
 * Configuración del cerebro
 */
export interface BrainConfig {
  /** Umbral mínimo de confianza para usar memoria */
  memoryConfidenceThreshold: number;
  
  /** Umbral de beauty score para aprender un patrón */
  learningThreshold: number;
  
  /** Mínimo de usos para confiar en un patrón */
  minPatternUsage: number;
  
  /** Activar modo debug con logs */
  debug: boolean;
  
  /** Activar aprendizaje automático */
  autoLearn: boolean;
  
  /** Path de la base de datos (opcional) */
  dbPath?: string;
}

/**
 * Feedback del usuario sobre el resultado
 */
export interface UserFeedback {
  paletteId?: number;
  patternHash?: string;
  rating: -1 | 0 | 1; // malo, neutral, bueno
  comment?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SELENE MUSICAL BRAIN
// ═══════════════════════════════════════════════════════════════════════════

export class SeleneMusicalBrain extends EventEmitter {
  // Sub-sistemas
  private contextEngine: MusicalContextEngine;
  private memory: SeleneMemoryManager;
  private paletteGenerator: ProceduralPaletteGenerator;
  private lightMapper: MusicToLightMapper;
  
  // Estado
  private config: BrainConfig;
  private currentSessionId: string | null = null;
  private isInitialized = false;
  private hasMemoryDB = false; // 🧠 WAVE 10: Track if SQLite is available
  private frameCount = 0;
  private lastOutput: BrainOutput | null = null;
  
  // 🔒 WAVE 14: Histéresis para evitar parpadeo entre fuentes
  private sourceHysteresis = {
    lastSource: 'procedural' as 'memory' | 'procedural' | 'fallback',
    lastSwitchTime: 0,
    lockDurationMs: 5000, // 5 segundos de lock antes de poder cambiar de fuente
  };
  
  // Estadísticas de sesión
  private sessionStats = {
    framesProcessed: 0,
    palettesFromMemory: 0,
    palettesGenerated: 0,
    patternsLearned: 0,
    totalBeautyScore: 0,
    maxBeautyScore: 0,
    minBeautyScore: 1,
  };
  
  // Cache para evitar re-consultas
  private patternCache: Map<string, LearnedPattern | null> = new Map();

  constructor(config: Partial<BrainConfig> = {}) {
    super();
    
    this.config = {
      memoryConfidenceThreshold: 0.6,
      learningThreshold: 0.7,
      minPatternUsage: 3,
      debug: false,
      autoLearn: true,
      dbPath: config.dbPath,
      ...config,
    };
    
    // Inicializar sub-sistemas
    this.contextEngine = new MusicalContextEngine();
    this.memory = getMemoryManager({ dbPath: this.config.dbPath });
    this.paletteGenerator = new ProceduralPaletteGenerator();
    this.lightMapper = new MusicToLightMapper();
    
    this.setupEventListeners();
  }

  /**
   * Configura listeners de eventos internos
   */
  private setupEventListeners(): void {
    // Eventos del context engine
    this.contextEngine.on('mode-change', (data) => {
      this.emit('mode-change', data);
      if (this.config.debug) {
        console.log(`[Brain] Mode change: ${data.from} → ${data.to}`);
      }
    });
    
    this.contextEngine.on('prediction', (prediction) => {
      this.emit('prediction', prediction);
    });
    
    this.contextEngine.on('section-change', (data) => {
      this.emit('section-change', data);
      // Limpiar cache de patrones al cambiar de sección
      this.patternCache.clear();
    });
    
    // Eventos del generador de paletas
    this.paletteGenerator.on('palette-generated', (data) => {
      this.emit('palette-generated', data);
    });
  }

  /**
   * Inicializa el cerebro
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    const startTime = Date.now();
    
    try {
      // Inicializar memoria (puede fallar si SQLite no está disponible)
      await this.memory.initialize();
      
      // Iniciar sesión
      this.currentSessionId = this.memory.startSession('1.0.0');
      
      this.isInitialized = true;
      this.hasMemoryDB = true; // SQLite available!
      
      const elapsed = Date.now() - startTime;
      console.log(`[Brain] 🧠 Initialized WITH MEMORY in ${elapsed}ms. Session: ${this.currentSessionId}`);
      
      this.emit('initialized', { sessionId: this.currentSessionId, elapsed, hasMemory: true });
    } catch (error) {
      // 🧠 WAVE 10: Si SQLite falla, seguimos sin memoria persistente
      console.warn('[Brain] ⚠️ SQLite not available, running WITHOUT persistent memory');
      console.warn('[Brain] ⚠️ GenreClassifier, Palettes, Movement will work, but no pattern learning');
      
      this.currentSessionId = `no-db-${Date.now()}`;
      this.isInitialized = true;
      
      const elapsed = Date.now() - startTime;
      console.log(`[Brain] 🧠 Initialized WITHOUT MEMORY in ${elapsed}ms (SQLite unavailable)`);
      
      this.emit('initialized', { sessionId: this.currentSessionId, elapsed, hasMemory: false });
    }
  }

  /**
   * 🔮 WAVE 13.5: CALCULATE ZODIAC ELEMENT FROM AUDIO
   * 
   * Los 4 elementos zodiacales se mapean a las frecuencias de audio:
   * - FIRE (🔥): Bajos fuertes (bombo, grave) - Energía primordial
   * - WATER (🌊): Medios altos (voz, melodía) - Flujo emocional
   * - AIR (💨): Agudos (hi-hats, cymbals) - Ligereza mental
   * - EARTH (🌍): Medios bajos (bajo, ritmo) - Estabilidad fundamental
   * 
   * "La música es elemental, solo hay que saber escucharla" - Selene
   */
  private calculateZodiacElement(audio: AudioAnalysis): 'fire' | 'water' | 'air' | 'earth' {
    // Usar el espectro de frecuencias del análisis
    const bass = audio.spectrum.bass;
    const mid = audio.spectrum.mid;
    const treble = audio.spectrum.treble;
    
    // Calcular ratios de energía por banda
    const total = bass + mid + treble + 0.001; // Evitar división por cero
    const bassRatio = bass / total;
    const midRatio = mid / total;
    const trebleRatio = treble / total;
    
    // Determinar el elemento dominante con pesos ajustados
    const scores = {
      fire: bassRatio * 1.5,      // 🔥 Bajos = Fuego (peso extra por ser visceral)
      earth: midRatio * 0.8,      // 🌍 Medios bajos = Tierra (estable)
      water: midRatio * 1.2,      // 🌊 Medios altos = Agua (emocional)
      air: trebleRatio * 1.0,     // 💨 Agudos = Aire (etéreo)
    };
    
    // El elemento con mayor score es el ganador
    let maxElement: 'fire' | 'water' | 'air' | 'earth' = 'earth';
    let maxScore = scores.earth;
    
    for (const [element, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxElement = element as 'fire' | 'water' | 'air' | 'earth';
      }
    }
    
    return maxElement;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 PROCESO PRINCIPAL - El latido del corazón de Selene
   * ═══════════════════════════════════════════════════════════════════════════
   */
  process(audio: AudioAnalysis): BrainOutput {
    if (!this.isInitialized) {
      throw new Error('Brain not initialized. Call initialize() first.');
    }
    
    const startTime = performance.now();
    const timestamp = Date.now();
    this.frameCount++;
    
    const perfMetrics = {
      totalMs: 0,
      contextMs: 0,
      memoryMs: 0,
      paletteMs: 0,
      mappingMs: 0,
    };
    
    // 🔮 WAVE 13.5: Calcular elemento zodiacal UNA VEZ al inicio
    const zodiacElement = this.calculateZodiacElement(audio);
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 1: Análisis de contexto musical
    // ─────────────────────────────────────────────────────────────────────────
    const contextStart = performance.now();
    const contextResult = this.contextEngine.process(audio);
    perfMetrics.contextMs = performance.now() - contextStart;
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2: Determinar modo y generar output
    // ─────────────────────────────────────────────────────────────────────────
    let output: BrainOutput;
    
    if (contextResult.mode === 'reactive') {
      // Modo reactivo - Sin suficiente confianza para inteligencia
      output = this.processReactiveMode(
        contextResult as ReactiveResult,
        audio,
        timestamp,
        perfMetrics
      );
    } else {
      // Modo inteligente - Usar memoria y aprendizaje
      output = this.processIntelligentMode(
        contextResult as IntelligentResult,
        timestamp,
        perfMetrics,
        zodiacElement
      );
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 3: Finalizar métricas
    // ─────────────────────────────────────────────────────────────────────────
    perfMetrics.totalMs = performance.now() - startTime;
    output.performance = perfMetrics;
    
    // Actualizar estadísticas
    this.updateSessionStats(output);
    this.lastOutput = output;
    
    // Emitir resultado
    this.emit('output', output);
    
    if (this.config.debug && this.frameCount % 30 === 0) {
      console.log(`[Brain] Frame ${this.frameCount}: ${output.mode} mode, ` +
        `source: ${output.paletteSource}, beauty: ${output.estimatedBeauty.toFixed(2)}, ` +
        `${perfMetrics.totalMs.toFixed(1)}ms`);
    }
    
    return output;
  }

  /**
   * Procesa en modo reactivo (sin análisis musical completo)
   * 🔧 WAVE 14.5: Ahora incluye context parcial con rhythm para telemetría
   */
  private processReactiveMode(
    _result: ReactiveResult,
    audio: AudioAnalysis,
    timestamp: number,
    perf: BrainOutput['performance']
  ): BrainOutput {
    const mappingStart = performance.now();
    
    // Convertir AudioAnalysis a AudioFeatures para mapFallback
    const audioFeatures = {
      bass: audio.spectrum.bass,
      mid: audio.spectrum.mid,
      treble: audio.spectrum.treble,
      energy: audio.energy.current,
      beatDetected: audio.beat.detected,
      bpm: audio.beat.bpm,
    };
    
    // Usar mapper en modo fallback
    const lighting = this.lightMapper.mapFallback(audioFeatures);
    
    perf.mappingMs = performance.now() - mappingStart;
    
    // Paleta básica basada en energía
    const energy = audio.energy.current;
    const palette = this.generateFallbackPalette(energy);
    
    // 🔧 WAVE 14.5: Obtener último rhythm análisis para telemetría
    // Aunque estamos en modo reactivo, el RhythmAnalyzer siempre corre
    const lastRhythm = this.contextEngine.getLastRhythm();
    
    // 🔧 WAVE 14.5: Crear context MÍNIMO para telemetría de syncopation
    // Esto permite que la UI muestre métricas incluso en modo reactivo
    const minimalContext: MusicalContext | undefined = lastRhythm ? {
      rhythm: lastRhythm,
      harmony: {
        key: null,
        mode: { 
          scale: 'major', 
          confidence: 0,
          mood: 'universal',
        },
        currentChord: {
          root: null,
          quality: null,
          confidence: 0,
        },
        confidence: 0,
        timestamp: timestamp,
      },
      section: {
        current: { 
          type: 'unknown', 
          confidence: 0,
          startedAt: timestamp,
          duration: 0,
        },
        predicted: null,
        intensity: energy,
        intensityTrend: 'stable',
        confidence: 0,
        timestamp: timestamp,
      },
      genre: {
        primary: 'unknown',
        confidence: 0,
        characteristics: [],
        timestamp: timestamp,
      },
      mood: 'neutral',
      energy: energy,
      confidence: 0.3,
      timestamp: timestamp,
    } : undefined;

    return {
      timestamp,
      sessionId: this.currentSessionId!,
      mode: 'reactive',
      confidence: 0.3, // Baja confianza en modo reactivo
      palette: {
        ...palette,
        strategy: 'reactive',
      },
      lighting,
      context: minimalContext, // 🔧 WAVE 14.5: Ahora incluye context con rhythm!
      paletteSource: 'fallback',
      estimatedBeauty: 0.5, // Neutral en modo reactivo
      performance: perf,
    };
  }

  /**
   * Procesa en modo inteligente (con análisis completo + memoria)
   */
  private processIntelligentMode(
    result: IntelligentResult,
    timestamp: number,
    perf: BrainOutput['performance'],
    zodiacElement: 'fire' | 'water' | 'air' | 'earth' // 🔮 WAVE 13.5
  ): BrainOutput {
    const context = result.context;
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2A: Consultar memoria - ¿Existe patrón exitoso?
    // 🧠 WAVE 13: BRAIN UNLOCK - Reactivamos memoria con KEY-driven colors
    // ─────────────────────────────────────────────────────────────────────────
    const memoryStart = performance.now();
    const pattern = this.consultMemory(context); // 🧠 WAVE 13: Reactivado
    perf.memoryMs = performance.now() - memoryStart;
    
    let palette: BrainOutput['palette'];
    let paletteSource: BrainOutput['paletteSource'];
    let patternId: string | undefined;
    let estimatedBeauty: number;
    
    // 🔒 WAVE 14: Calcular fuente preferida pero aplicar histéresis
    const now = Date.now();
    const timeSinceSwitch = now - this.sourceHysteresis.lastSwitchTime;
    const isLocked = timeSinceSwitch < this.sourceHysteresis.lockDurationMs;
    
    // Determinar fuente preferida basada en lógica original
    const preferredSource: 'memory' | 'procedural' = 
      (pattern && pattern.timesUsed >= this.config.minPatternUsage) ? 'memory' : 'procedural';
    
    // 🔒 WAVE 14: Si estamos en lock y la fuente cambió, mantener la anterior
    let actualSource = preferredSource;
    if (isLocked && preferredSource !== this.sourceHysteresis.lastSource && this.sourceHysteresis.lastSource !== 'fallback') {
      actualSource = this.sourceHysteresis.lastSource;
      if (this.config.debug && this.frameCount % 100 === 0) {
        console.log(`[Brain] 🔒 Hysteresis: keeping ${actualSource} (${(this.sourceHysteresis.lockDurationMs - timeSinceSwitch) / 1000}s left)`);
      }
    } else if (preferredSource !== this.sourceHysteresis.lastSource) {
      // Source changed, reset lock timer
      this.sourceHysteresis.lastSource = preferredSource;
      this.sourceHysteresis.lastSwitchTime = now;
      console.log(`[Brain] 🔄 Source switched to: ${preferredSource}`);
    }
    
    if (actualSource === 'memory' && pattern) {
      // ─────────────────────────────────────────────────────────────────────
      // USAR PATRÓN DE MEMORIA (Recall)
      // ─────────────────────────────────────────────────────────────────────
      const paletteStart = performance.now();
      palette = this.applyLearnedPattern(pattern, context);
      perf.paletteMs = performance.now() - paletteStart;
      
      paletteSource = 'memory';
      patternId = pattern.patternHash;
      estimatedBeauty = pattern.avgBeautyScore;
      
      this.sessionStats.palettesFromMemory++;
      
      if (this.config.debug) {
        console.log(`[Brain] 📚 Recalled pattern: ${patternId}, ` +
          `avgBeauty: ${estimatedBeauty.toFixed(2)}, used: ${pattern.timesUsed}x`);
      }
    } else {
      // ─────────────────────────────────────────────────────────────────────
      // GENERAR PROCEDURALMENTE (Create)
      // ─────────────────────────────────────────────────────────────────────
      const paletteStart = performance.now();
      
      // Extraer valores de tipos anidados correctamente
      const modeScale = context.harmony?.mode?.scale ?? 'major';
      const sectionType = context.section?.current?.type ?? 'unknown';
      const syncopation = context.rhythm?.groove?.syncopation ?? 0; // RESCUE DIRECTIVE: NO DEFAULTS
      
      // 🧠 WAVE 13: BRAIN UNLOCK - KEY define el color, NO la energía
      // La tonalidad musical determina el Hue base
      // Si no hay key detectada, el fallback es mood > mode
      const detectedKey = context.harmony?.key ?? null;
      
      const musicalDNA = {
        key: detectedKey, // 🧠 WAVE 13: Key-driven colors (si disponible)
        mode: modeScale,
        energy: context.energy,
        syncopation: syncopation,
        mood: context.mood,
        section: sectionType,
      };
      
      const generatedPalette = this.paletteGenerator.generatePalette(musicalDNA);
      perf.paletteMs = performance.now() - paletteStart;
      
      palette = {
        primary: generatedPalette.primary,
        secondary: generatedPalette.secondary,
        accent: generatedPalette.accent,
        ambient: generatedPalette.ambient,
        contrast: generatedPalette.contrast,
        strategy: generatedPalette.metadata.colorStrategy,
      };
      
      paletteSource = 'procedural';
      estimatedBeauty = 0.6; // Base estimate para nuevo
      
      this.sessionStats.palettesGenerated++;
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2B: Mapear a fixtures
    // ─────────────────────────────────────────────────────────────────────────
    const mappingStart = performance.now();
    
    // Crear contexto simplificado para el mapper
    const musicContext = {
      section: context.section?.current?.type ?? 'unknown',
      mood: context.mood,
      energy: context.energy,
      syncopation: context.rhythm?.groove?.syncopation ?? 0, // RESCUE DIRECTIVE: NO DEFAULTS
      beatPhase: context.rhythm?.beatPhase ?? 0,
      fillInProgress: context.rhythm?.fillInProgress ?? false,
    };
    
    // 🔮 WAVE 13.5: Usar el zodiacElement ya calculado al inicio del process()
    
    const lighting = this.lightMapper.map(
      {
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        ambient: palette.ambient || palette.secondary,
        contrast: palette.contrast || palette.accent,
        metadata: {
          generatedAt: timestamp,
          musicalDNA: {
            key: context.harmony?.key ?? null, // 🧠 WAVE 13: Key-driven colors
            mode: context.harmony?.mode?.scale ?? 'major',
            energy: context.energy,
            syncopation: musicContext.syncopation,
            mood: context.mood,
            section: musicContext.section,
            zodiacElement: zodiacElement, // 🔮 WAVE 13.5: Elemento zodiacal
          },
          confidence: context.confidence,
          transitionSpeed: 300,
          colorStrategy: palette.strategy as 'analogous' | 'triadic' | 'complementary',
          description: `Generated for ${context.genre?.primary ?? 'unknown'} in ${musicContext.section}`,
        },
      },
      musicContext
    );
    perf.mappingMs = performance.now() - mappingStart;
    
    // ─────────────────────────────────────────────────────────────────────────
    // PASO 2C: Calcular beauty estimado y preparar para aprendizaje
    // ─────────────────────────────────────────────────────────────────────────
    const calculatedBeauty = this.calculateBeautyScore(palette, context);
    const finalBeauty = paletteSource === 'memory' 
      ? (estimatedBeauty * 0.7 + calculatedBeauty * 0.3) // Blend con histórico
      : calculatedBeauty;
    
    // Auto-aprendizaje si está habilitado y el resultado es bueno
    if (this.config.autoLearn && 
        paletteSource === 'procedural' && 
        finalBeauty >= this.config.learningThreshold) {
      this.learnFromSuccess(context, palette, finalBeauty);
    }
    
    return {
      timestamp,
      sessionId: this.currentSessionId!,
      mode: 'intelligent',
      confidence: context.confidence,
      palette,
      lighting,
      context,
      paletteSource,
      patternId,
      estimatedBeauty: finalBeauty,
      performance: perf,
    };
  }

  /**
   * Consulta la memoria buscando un patrón exitoso para el contexto actual
   */
  private consultMemory(context: MusicalContext): LearnedPattern | null {
    const genre = context.genre?.primary;
    if (!genre) return null;
    
    const key = context.harmony?.key ?? undefined;
    const section = context.section?.current?.type ?? undefined;
    
    // Crear hash para cache
    const cacheKey = `${genre}:${key ?? '*'}:${section ?? '*'}`;
    
    // Verificar cache (válido por 2 segundos)
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey) ?? null;
    }
    
    // Consultar memoria
    const pattern = this.memory.getBestPattern(genre, key, section);
    
    // Guardar en cache
    this.patternCache.set(cacheKey, pattern);
    
    // Limpiar cache viejo cada 100 entradas
    if (this.patternCache.size > 100) {
      const firstKey = this.patternCache.keys().next().value;
      if (firstKey) this.patternCache.delete(firstKey);
    }
    
    return pattern;
  }

  /**
   * Aplica un patrón aprendido para generar la paleta
   */
  private applyLearnedPattern(
    pattern: LearnedPattern,
    context: MusicalContext
  ): BrainOutput['palette'] {
    // Usar la configuración aprendida del patrón
    const baseHue = pattern.preferredHueBase ?? 210;
    const saturation = pattern.preferredSaturation ?? 0.8;
    const intensity = pattern.preferredIntensity ?? 0.7;
    const strategy = pattern.preferredStrategy ?? 'triadic';
    
    // Generar colores basados en preferencias aprendidas
    const primary: HSLColor = {
      h: baseHue,
      s: saturation * 100,
      l: 50 + (intensity - 0.5) * 20,
    };
    
    // Calcular secundario según estrategia
    let secondaryHue: number;
    switch (strategy) {
      case 'complementary':
        secondaryHue = (baseHue + 180) % 360;
        break;
      case 'triadic':
        secondaryHue = (baseHue + 120) % 360;
        break;
      case 'analogous':
        secondaryHue = (baseHue + 30) % 360;
        break;
      default:
        secondaryHue = (baseHue + 60) % 360;
    }
    
    const secondary: HSLColor = {
      h: secondaryHue,
      s: saturation * 90,
      l: 55,
    };
    
    const accent: HSLColor = {
      h: (baseHue + (strategy === 'complementary' ? 180 : 240)) % 360,
      s: saturation * 100,
      l: 45 + context.energy * 10,
    };

    // 🪞 ESPEJO CROMÁTICO: ambient es variación del accent, NO complementario
    // Usa el mismo hue que accent pero con shift de saturación/luminosidad
    // Esto crea coherencia visual entre LEFT y RIGHT
    const ambient: HSLColor = {
      h: accent.h,                    // Mismo hue que accent (espejo)
      s: Math.max(40, accent.s * 0.7), // Menos saturado para suavidad
      l: Math.min(60, accent.l + 10),  // Ligeramente más claro
    };
    
    return {
      primary,
      secondary,
      accent,
      ambient,
      strategy,
    };
  }

  /**
   * Aprende de un resultado exitoso
   */
  private learnFromSuccess(
    context: MusicalContext,
    palette: BrainOutput['palette'],
    beautyScore: number
  ): void {
    const genre = context.genre?.primary;
    if (!genre) return;
    
    const key = context.harmony?.key ?? undefined;
    const mode = context.harmony?.mode?.scale;
    const section = context.section?.current?.type ?? undefined;
    
    // Extraer hue base de la paleta
    const hueBase = palette.primary.h;
    const saturation = palette.primary.s / 100;
    const intensity = (palette.primary.l - 30) / 40; // Normalizar a 0-1
    
    // Guardar en memoria
    this.memory.learnPattern(
      genre,
      key,
      mode,
      section,
      beautyScore,
      {
        strategy: palette.strategy,
        hueBase,
        saturation,
        intensity,
        movement: context.mood,
      }
    );
    
    this.sessionStats.patternsLearned++;
    
    // Invalidar cache para este contexto
    const cacheKey = `${genre}:${key ?? '*'}:${section ?? '*'}`;
    this.patternCache.delete(cacheKey);
    
    if (this.config.debug) {
      console.log(`[Brain] 📝 Learned pattern: ${genre}/${key}/${section}, beauty: ${beautyScore.toFixed(2)}`);
    }
    
    this.emit('pattern-learned', {
      genre,
      key,
      section,
      beautyScore,
      palette,
    });
  }

  /**
   * Calcula un beauty score basado en armonía de colores y contexto
   */
  private calculateBeautyScore(
    palette: BrainOutput['palette'],
    context: MusicalContext
  ): number {
    let score = 0.5; // Base
    
    // Factor 1: Contraste de colores (bueno)
    const hueDiff = Math.abs(palette.primary.h - palette.secondary.h);
    const normalizedDiff = Math.min(hueDiff, 360 - hueDiff) / 180;
    score += normalizedDiff * 0.15;
    
    // Factor 2: Coherencia con energía
    const intensityMatch = 1 - Math.abs(
      context.energy - (palette.primary.l / 100)
    );
    score += intensityMatch * 0.15;
    
    // Factor 3: Saturación apropiada para el género
    const genreExpectsSaturated = ['reggaeton', 'techno', 'house', 'edm'].includes(
      context.genre?.primary ?? ''
    );
    const saturationMatch = genreExpectsSaturated 
      ? palette.primary.s / 100 
      : 1 - (palette.primary.s / 200);
    score += saturationMatch * 0.1;
    
    // Factor 4: Variedad en la paleta
    const hasAmbient = palette.ambient !== undefined;
    const hasContrast = palette.contrast !== undefined;
    score += (hasAmbient ? 0.05 : 0) + (hasContrast ? 0.05 : 0);
    
    // Clamp a [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Genera paleta de fallback basada solo en energía
   * 🌊 WAVE 12.5: Energy controla TODO el espectro de colores
   */
  private generateFallbackPalette(energy: number): {
    primary: HSLColor;
    secondary: HSLColor;
    accent: HSLColor;
  } {
    // 🌊 WAVE 12.5: Energy modula TODO el espectro
    // E=0 → H=200 (azul frío), E=0.5 → H=300 (magenta), E=1 → H=30 (naranja)
    const hue = (200 + energy * 190) % 360;
    
    return {
      primary: { h: hue, s: 70 + energy * 20, l: 50 },
      secondary: { h: (hue + 180) % 360, s: 60, l: 50 },
      accent: { h: (hue + 60) % 360, s: 80, l: 45 },
    };
  }

  /**
   * Actualiza estadísticas de la sesión
   */
  private updateSessionStats(output: BrainOutput): void {
    this.sessionStats.framesProcessed++;
    this.sessionStats.totalBeautyScore += output.estimatedBeauty;
    this.sessionStats.maxBeautyScore = Math.max(
      this.sessionStats.maxBeautyScore,
      output.estimatedBeauty
    );
    this.sessionStats.minBeautyScore = Math.min(
      this.sessionStats.minBeautyScore,
      output.estimatedBeauty
    );
  }

  /**
   * Registra feedback del usuario
   */
  recordFeedback(feedback: UserFeedback): void {
    if (!this.isInitialized) return;
    
    if (feedback.paletteId) {
      this.memory.recordUserFeedback(feedback.paletteId, feedback.rating);
    }
    
    if (feedback.patternHash) {
      this.memory.recordPatternFeedback(
        feedback.patternHash,
        feedback.rating > 0
      );
    }
    
    this.emit('feedback-recorded', feedback);
  }

  /**
   * Obtiene estadísticas de la sesión actual
   */
  getSessionStats(): {
    framesProcessed: number;
    palettesFromMemory: number;
    palettesGenerated: number;
    patternsLearned: number;
    avgBeautyScore: number;
    maxBeautyScore: number;
    minBeautyScore: number;
    memoryUsagePercent: number;
  } {
    const avgBeauty = this.sessionStats.framesProcessed > 0
      ? this.sessionStats.totalBeautyScore / this.sessionStats.framesProcessed
      : 0;
    
    const memoryPercent = this.sessionStats.framesProcessed > 0
      ? (this.sessionStats.palettesFromMemory / this.sessionStats.framesProcessed) * 100
      : 0;
    
    return {
      ...this.sessionStats,
      avgBeautyScore: avgBeauty,
      memoryUsagePercent: memoryPercent,
    };
  }

  /**
   * Obtiene estadísticas de la memoria
   */
  getMemoryStats(): ReturnType<SeleneMemoryManager['getStats']> {
    return this.memory.getStats();
  }

  /**
   * 🧠 WAVE 10: Check if SQLite memory is available
   */
  hasMemory(): boolean {
    return this.hasMemoryDB;
  }

  /**
   * Obtiene el último output
   */
  getLastOutput(): BrainOutput | null {
    return this.lastOutput;
  }

  /**
   * Obtiene el modo actual
   */
  getCurrentMode(): 'reactive' | 'intelligent' | 'transitioning' {
    return this.contextEngine.getMode();
  }

  /**
   * Actualiza configuración en runtime
   */
  updateConfig(newConfig: Partial<BrainConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config-updated', this.config);
  }

  /**
   * Resetea el cerebro (útil para tests)
   */
  reset(): void {
    this.contextEngine.reset();
    this.patternCache.clear();
    this.frameCount = 0;
    this.lastOutput = null;
    this.sessionStats = {
      framesProcessed: 0,
      palettesFromMemory: 0,
      palettesGenerated: 0,
      patternsLearned: 0,
      totalBeautyScore: 0,
      maxBeautyScore: 0,
      minBeautyScore: 1,
    };
    this.emit('reset');
  }

  /**
   * Cierra el cerebro y guarda estado
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;
    
    // Terminar sesión con estadísticas
    const stats = this.getSessionStats();
    this.memory.endSession({
      totalFrames: stats.framesProcessed,
      totalPalettes: stats.palettesFromMemory + stats.palettesGenerated,
      avgBeautyScore: stats.avgBeautyScore,
      maxBeautyScore: stats.maxBeautyScore,
      minBeautyScore: stats.minBeautyScore,
    });
    
    // Cerrar memoria
    this.memory.close();
    
    this.isInitialized = false;
    this.currentSessionId = null;
    
    console.log('[Brain] 🔒 Shutdown complete. Session stats:', stats);
    this.emit('shutdown', stats);
  }

  /**
   * 🎨 WAVE 14.5: Forzar mutación de color (Lab Control)
   * Útil para debugging o controles manuales
   */
  forceColorMutation(reason: string = 'Manual trigger'): void {
    if (this.config.debug) {
      console.log(`[Brain] 🎨 Force color mutation: ${reason}`);
    }
    this.paletteGenerator.forceColorMutation(reason);
  }

  /**
   * 🧠 WAVE 14.5: Resetear memoria del sistema (Lab Control)
   * CUIDADO: Borra todos los patrones aprendidos
   */
  resetMemory(): void {
    if (this.config.debug) {
      console.log('[Brain] 🧠 Resetting memory...');
    }
    resetMemoryManager();
    this.patternCache.clear();
    this.sessionStats = {
      framesProcessed: 0,
      palettesFromMemory: 0,
      palettesGenerated: 0,
      patternsLearned: 0,
      totalBeautyScore: 0,
      maxBeautyScore: 0,
      minBeautyScore: 1,
    };
  }

  /**
   * Verifica si está inicializado
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

let brainInstance: SeleneMusicalBrain | null = null;

/**
 * Obtiene la instancia singleton del cerebro
 */
export function getMusicalBrain(config?: Partial<BrainConfig>): SeleneMusicalBrain {
  if (!brainInstance) {
    brainInstance = new SeleneMusicalBrain(config);
  }
  return brainInstance;
}

/**
 * Resetea la instancia singleton (para tests)
 */
export async function resetMusicalBrain(): Promise<void> {
  if (brainInstance) {
    await brainInstance.shutdown();
    brainInstance = null;
  }
}

export default SeleneMusicalBrain;
