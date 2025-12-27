/**
 * ---------------------------------------------------------------------------
 * ?? SELENE LUX - CLASE MAESTRA
 * "La Consciencia Lum�nica que Orquesta Todo"
 * ---------------------------------------------------------------------------
 * 
 * WAVE-8 FASE 8: Integraci�n Nuclear
 * 
 * El flujo ahora es:
 *   AUDIO ? BRAIN ? HARD      // ??? WAVE 24.5.1: ANTI-FLICKER OUTPUT GUARD
      // Si detectamos NaN, mantenemos el color anterior en vez de negro
      const isInvalid = (n: number) => !Number.isFinite(n) || isNaN(n)
      
      if (isInvalid(freshRgbValues.primary.r) || isInvalid(freshRgbValues.primary.g)) {
        // Solo loguear ocasionalmente para no saturar
        if (this.frameCount % 120 === 0) {
          console.warn(`[SeleneLux] ?? NaN detected! Holding previous color. E=${metrics.energy.toFixed(4)}`)
        }
        // ANTI-FLICKER: Mantener el �ltimo color v�lido en vez de apagar
        freshRgbValues.primary = this.lastColors.primary
        freshRgbValues.secondary = this.lastColors.secondary
        freshRgbValues.accent = this.lastColors.accent
        freshRgbValues.ambient = this.lastColors.ambient
      }l SeleneMusicalBrain unifica:
 * - An�lisis musical contextual
 * - Memoria de patrones exitosos
 * - Generaci�n procedural de paletas
 * - Mapeo m�sica ? luz
 * 
 * Ya no usamos engines separados de forma manual.
 * El Brain orquesta todo internamente.
 */

import { EventEmitter } from 'events'
import type {
  AudioMetrics,
  MusicalPattern,
  MusicalNote,
  ElementType,
  EmotionalTone,
  ConsciousnessState,
  SeleneMode,
  MovementPattern,
} from './types'
// Legacy engines (para compatibilidad)
import { ColorEngine, type LivingPaletteId, type ColorOutput } from './engines/visual/ColorEngine'
import { MovementEngine, type MovementOutput, type FixtureMovement } from './engines/visual/MovementEngine'
import { BeatDetector, type BeatState } from './engines/audio/BeatDetector'
// ?? WAVE-8: El Cerebro Musical
import { 
  SeleneMusicalBrain, 
  getMusicalBrain,
  type BrainOutput,
  type BrainConfig,
} from './engines/musical'
import type { AudioAnalysis } from './engines/musical/types'
// ?? WAVE 24.4: Motor de Color Procedural + Helper de conversi�n HSL?RGB
// ?? WAVE 24.9: A�adir rgbToHsl para sincronizar Flow Mode palette
// ?? WAVE 37.0: Import SelenePalette type para Brain Transplant
// ?? WAVE 49: Import SeleneColorInterpolator para transiciones suaves
import { SeleneColorEngine, SeleneColorInterpolator, paletteToRgb, rgbToHsl, type SelenePalette } from './engines/visual/SeleneColorEngine'
// ?? WAVE-14: Telemetry Collector
import { 
  SeleneTelemetryCollector, 
  getTelemetryCollector,
  type SeleneTelemetryPacket,
} from './engines/telemetry/SeleneTelemetryCollector'
// ?? WAVE 37.0: Meta-Consciencia Avanzada (Resurrecci�n de Motores)
import { 
  SeleneLuxConscious,
  type SeleneLuxConsciousState,
} from './engines/consciousness/SeleneLuxConscious'
// ?? WAVE 39.0: HuntOrchestrator + ZodiacAffinity (Engine Wiring)
import { 
  HuntOrchestrator,
  type HuntFrameResult,
  type HuntStatus,
} from './engines/consciousness/HuntOrchestrator'
import { 
  ZodiacAffinityCalculator,
  type ZodiacInfo,
} from './engines/consciousness/ZodiacAffinityCalculator'
// ?? WAVE-25: Universal Truth Protocol
import {
  type SeleneBroadcast,
  type UnifiedColor,
  createDefaultBroadcast,
} from '../../types/SeleneProtocol'
// ⚡ WAVE 141-146: Physics Modules (Reactividad extraída por Vibe)
import { TechnoStereoPhysics, RockStereoPhysics, LatinoStereoPhysics, ChillStereoPhysics } from './physics'
// 🎛️ WAVE 142: GenerationOptions para restricciones de color
import type { GenerationOptions } from './engines/visual/SeleneColorEngine'
// 📜 WAVE 144: Constituciones de Color (Reglas por Vibe)
import { getColorConstitution } from '../../engines/context/colorConstitutions'

export interface SeleneConfig {
  audio: {
    device: string
    sensitivity: number
    noiseGate: number
    fftSize: number
    smoothing: number
  }
  visual: {
    transitionTime: number
    colorSmoothing: number
    movementSmoothing: number
    effectIntensity: number
  }
  dmx: {
    universe: number
    driver: string
    frameRate: number
  }
  // ?? WAVE-8: Configuraci�n del Brain
  brain?: Partial<BrainConfig>
}

export interface SeleneState {
  mode: SeleneMode
  palette: LivingPaletteId
  colors: ColorOutput
  movement: MovementOutput
  beat: BeatState
  consciousness: ConsciousnessState
  stats: { frames: number; decisions: number; uptime: number }
  // ?? WAVE-8: Informaci�n del Brain
  brainOutput?: BrainOutput | null
  brainMode?: 'reactive' | 'intelligent'
  paletteSource?: 'memory' | 'procedural' | 'fallback' | 'legacy'
}

export class SeleneLux extends EventEmitter {
  private initialized = false
  private running = false
  private mode: SeleneMode = 'selene' // WAVE 13.6: Arrancar SIEMPRE en Selene (Intelligent mode)
  
  // Legacy engines (para compatibilidad gradual)
  private colorEngine: ColorEngine
  private movementEngine: MovementEngine
  private beatDetector: BeatDetector
  
  // ⚡ WAVE 147: Physics Module Instances (para géneros con estado)
  // Latino y Chill mantienen estado interno (blackout frames, breathing phase)
  private latinoPhysics = new LatinoStereoPhysics()
  private chillPhysics = new ChillStereoPhysics()
  
  // ? WAVE 39.9.2: GHOST BRAIN ELIMINATED
  // El Brain ahora vive SOLO en Trinity Worker - Main Process no piensa
  // Mantenemos la propiedad para compatibilidad de API pero NUNCA se inicializa
  private brain!: SeleneMusicalBrain  // Non-null assertion - nunca se usa
  private useBrain = false // ?? WAVE 39.9.2: DESACTIVADO - Brain lives in Worker
  private brainInitialized = false
  
  // ?? WAVE-14: Telemetry Collector
  private telemetryCollector: SeleneTelemetryCollector
  private inputGain = 1.0 // From audio settings
  
  // ? WAVE 37.0: Meta-Consciencia Avanzada (DreamForge + SelfAnalysis)
  private advancedConscious: SeleneLuxConscious | null = null
  private lastAdvancedState: SeleneLuxConsciousState | null = null
  private useAdvancedConscious = true // Flag para activar meta-consciencia

  // ?? WAVE 39.0: HuntOrchestrator + ZodiacAffinity (Engine Wiring)
  private huntOrchestrator: HuntOrchestrator | null = null
  private lastHuntResult: HuntFrameResult | null = null
  private lastZodiacInfo: ZodiacInfo | null = null
  private currentZodiacPosition: number = 0
  private lastFftBins: number[] = new Array(256).fill(0)
  
  // ??? WAVE 13.6: Multiplicadores Globales de Color (STATE OF TRUTH)
  private globalSaturation = 1.0  // 0-1, default 100%
  private globalIntensity = 1.0   // 0-1, default 100%
  
  // ⚡ WAVE 148: Estado del Strobe para UI
  private lastStrobeActive = false
  
  private currentPalette: LivingPaletteId = 'fuego'
  private currentPattern: MusicalPattern | null = null
  private consciousness: ConsciousnessState
  
  // ?? WAVE 24.11: ARCHITECTURAL FIX - Initialize with VALID colors (not null/black)
  // Previene blackout an�malo en primer frame cuando ColorEngine a�n no gener� output
  private lastColors: ColorOutput = {
    primary: { r: 150, g: 50, b: 50 },    // Rojo c�lido (Fuego default)
    secondary: { r: 200, g: 100, b: 50 }, // Naranja
    accent: { r: 255, g: 150, b: 0 },     // Amarillo
    ambient: { r: 255, g: 100, b: 50 },   // Naranja brillante
    intensity: 0.5,
    saturation: 0.8,
  }
  
  // ?? WAVE 49: COLOR INTERPOLATOR - Transiciones suaves (anti-epilepsia)
  private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()
  
  // ?? WAVE 69.5: RGB INTERPOLATOR for Worker data (anti-strobing)
  // Interpolaci�n simple RGB con morphing suave
  private workerColorState = {
    current: null as { r: number; g: number; b: number }[] | null,
    target: null as { r: number; g: number; b: number }[] | null,
    progress: 1.0,
    speed: 0.02,  // ~50 frames = ~1.6s @ 30fps
  }
  
  // ??? WAVE 72: SINGLE SOURCE OF TRUTH - Worker est� activo si recibimos datos recientes
  // Si el Worker env�a datos dentro de los �ltimos 2 segundos, consideramos que est� activo
  private isWorkerActive(): boolean {
    if (!this.lastTrinityData?.timestamp) return false;
    const age = Date.now() - this.lastTrinityData.timestamp;
    return age < 2000; // 2 segundos de gracia
  }
  
  // ??? WAVE 72: Helper para fallback emocional basado en Vibe activo
  // Evita que NEUTRAL permita moods incompatibles con el Vibe
  private getSafeFallbackForVibe(vibeId: string): 'BRIGHT' | 'DARK' | 'NEUTRAL' {
    const id = vibeId.toLowerCase();
    // Vibes latinos/festivos ? BRIGHT (prohibe DARK)
    if (id.includes('latin') || id.includes('fiesta') || id.includes('pop') || id.includes('cumbia') || id.includes('reggaeton')) {
      return 'BRIGHT';
    }
    // Vibes electr�nicos oscuros ? NEUTRAL (permite DARK pero no fuerza)
    if (id.includes('techno') || id.includes('minimal') || id.includes('industrial')) {
      return 'NEUTRAL'; // Techno puede ser DARK o NEUTRAL
    }
    // Default: NEUTRAL es seguro para la mayor�a
    return 'NEUTRAL';
  }

  // ??? WAVE 134: Helper para generar label visual de la estrategia
  // Traduce la estrategia t�cnica a un nombre profesional para la UI
  // ?? WAVE 136: STADIUM SEPARATION para Pop/Rock (upgrade de ROCK DYNAMICS)
  private getStrategyLabel(activeVibe?: string, colorStrategy?: string): string {
    const vibe = (activeVibe ?? '').toLowerCase();
    const strategy = (colorStrategy ?? 'analogous').toLowerCase();
    
    // Techno Vibes ? PRISM branding
    if (vibe.includes('techno') || vibe.includes('minimal') || vibe.includes('industrial')) {
      return 'TETRADIC PRISM';
    }
    
    // ?? WAVE 136: Pop/Rock Vibes ? STADIUM SEPARATION branding
    if (vibe.includes('pop') || vibe.includes('rock')) {
      return 'STADIUM DYNAMICS';
    }
    
    // Fiesta/Latin Vibes ? TROPICAL branding
    if (vibe.includes('latin') || vibe.includes('fiesta') || vibe.includes('cumbia') || vibe.includes('reggaeton')) {
      return 'TROPICAL BURST';
    }
    
    // Chill Vibes ? AMBIENT branding
    if (vibe.includes('chill') || vibe.includes('lounge') || vibe.includes('ambient')) {
      return 'AMBIENT FLOW';
    }
    
    // Fallback: Mostrar la estrategia del StrategyArbiter en formato profesional
    const strategyLabels: Record<string, string> = {
      'analogous': 'ANALOGOUS',
      'triadic': 'TRIADIC',
      'complementary': 'COMPLEMENTARY',
      'split-complementary': 'SPLIT-COMP',
      'monochromatic': 'MONO'
    };
    return strategyLabels[strategy] ?? 'ADAPTIVE';
  }

  private lastMovement: MovementOutput | null = null
  private lastBeat: BeatState | null = null
  private lastBrainOutput: BrainOutput | null = null
  
  // ?? WAVE 46.0 ? 47.2: DATA BRIDGE - Recibe datos de Trinity Worker
  // El Worker (GAMMA) tiene el g�nero, key, syncopation real
  // Este es el puente que conecta Worker ? getBroadcast() ? UI
  // WAVE 47.2: Ahora incluye mood (MoodSynthesizer) y sectionDetail (SectionTracker)
  // ?? WAVE 57.5: A�adido drop (DROP STATE MACHINE)
  // ??? WAVE 66: A�adido activeVibe y vibeTransitioning
  private lastTrinityData: {
    macroGenre?: string
    key?: string | null
    mode?: string
    syncopation?: number
    strategy?: string
    temperature?: string
    description?: string
    timestamp: number
    mood?: any  // ?? WAVE 47.2: MoodSynthesizer output (copado directo del spread)
    sectionDetail?: any  // ?? WAVE 47.2: SectionTracker output (copado directo del spread)
    drop?: {  // ?? WAVE 57.5: DROP STATE MACHINE output
      isDropActive?: boolean
      dropState?: any
    }
    // ??? WAVE 66: Vibe context
    activeVibe?: string
    vibeTransitioning?: boolean
    debugInfo?: {
      mood?: any
      sectionDetail?: any
      drop?: any
      activeVibe?: string
      vibeTransitioning?: boolean
    }
  } | null = null
  
  // ??? WAVE 94.2: AGC normalized audio para Relative Gates
  // Acceso p�blico para que main.ts pueda usarlo en el loop de fixtures
  private _agcData: {
    normalizedBass: number
    normalizedMid: number
    normalizedTreble: number
    normalizedEnergy: number
    avgNormEnergy: number
    gainFactor: number
  } | null = null
  
  /**
   * ??? WAVE 94.2: Get AGC normalized audio data
   * Usado por main.ts para Relative Gates en fixtures
   */
  getAgcData(): typeof this._agcData {
    return this._agcData
  }
  
  // ?? WAVE 47.3: SECTION STABILITY - Hist�resis para evitar flicker
  private lastStableSection: { type: string; timestamp: number; confidence: number } = {
    type: 'unknown',
    timestamp: Date.now(),
    confidence: 0
  }
  
  // ?? WAVE-25: Tracking para Universal Truth Broadcast
  private lastAudioMetrics: AudioMetrics | null = null
  private lastAudioAnalysis: AudioAnalysis | null = null
  private lastFrameTime = Date.now()
  private sessionId = `selene-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  private fpsCounter = { frames: 0, lastCheck: Date.now(), currentFPS: 30 }
  private audioDeviceName = 'System Audio'
  private audioActive = false
  
  private frameCount = 0
  private decisionCount = 0
  private startTime = 0
  
  constructor(config: SeleneConfig) {
    super()
    
    // Legacy engines (para compatibilidad)
    this.colorEngine = new ColorEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing,
    })
    
    this.movementEngine = new MovementEngine({
      transitionTime: config.visual.transitionTime,
      colorSmoothing: config.visual.colorSmoothing,
      movementSmoothing: config.visual.movementSmoothing,
    })
    
    this.beatDetector = new BeatDetector({
      sampleRate: 44100,
      fftSize: config.audio.fftSize,
      smoothingTimeConstant: config.audio.smoothing,
      minBpm: 60,
      maxBpm: 180,
    })
    
    // ? WAVE 39.9.2: BRAIN ELIMINATED FROM MAIN PROCESS
    // El Brain SOLO vive en Trinity Worker para evitar:
    // - Doble instancia = doble RAM
    // - Conflictos de bloqueo SQLite
    // this.brain = getMusicalBrain(config.brain)
    // this.setupBrainEventListeners()
    console.info('[SeleneLux] ?? WAVE 39.9.2: Brain lives in Trinity Worker (not here)')
    
    // ?? WAVE-14: Inicializar Telemetry Collector (20 FPS)
    this.telemetryCollector = getTelemetryCollector(20)
    
    // ?? WAVE 37.0: Inicializar Meta-Consciencia Avanzada
    // DreamForge simula escenarios futuros, SelfAnalysis detecta sesgos
    if (this.useAdvancedConscious) {
      try {
        this.advancedConscious = new SeleneLuxConscious({
          visual: {
            transitionTime: config.visual.transitionTime,
            colorSmoothing: config.visual.colorSmoothing,
            movementSmoothing: config.visual.movementSmoothing,
          },
          consciousness: {
            strikeBeautyThreshold: 0.85,
            strikeConsonanceThreshold: 0.7,
            minStalkCycles: 3,
          }
        })
        console.info('[SeleneLux] ?? WAVE 37.0: Meta-Consciencia activada (DreamForge + SelfAnalysis)')
      } catch (err) {
        console.warn('[SeleneLux] ?? Meta-Consciencia no pudo inicializar:', err)
        this.useAdvancedConscious = false
      }
    }
    
    // ?? WAVE 39.0: Inicializar HuntOrchestrator (El Cazador)
    try {
      this.huntOrchestrator = new HuntOrchestrator()
      console.info('[SeleneLux] ?? WAVE 39.0: HuntOrchestrator activado (El Cazador)')
    } catch (err) {
      console.warn('[SeleneLux] ?? HuntOrchestrator no pudo inicializar:', err)
      this.huntOrchestrator = null
    }
    
    this.consciousness = {
      generation: 1,
      status: 'awakening',
      totalExperiences: 0,
      totalPatternsDiscovered: 0,
      currentMood: 'peaceful',
      lastInsight: 'Selene Lux despertando...',
      beautyScore: 0.5,
      lineage: ['Genesis'],
    }
    
    this.initialized = true
    this.running = true
    this.startTime = Date.now()
    this.consciousness.status = 'learning'
    
    console.info('[SeleneLux] ?? WAVE 39.9.2: Initialized (Brain lives in Worker)')
    this.emit('ready')
    
    // ?? WAVE 39.9.2: Brain auto-init REMOVED
    // El cerebro vive exclusivamente en Trinity Worker
    // if (this.mode === 'selene') {
    //   this.initializeBrain().catch(...)
    // }
  }
  
  /**
   * ?? Configura listeners de eventos del Brain
   * ?? WAVE 39.9.3: Agregado early-return guard - brain vive en Worker
   */
  private setupBrainEventListeners(): void {
    // ?? WAVE 39.9.3: Guard para prevenir crash si brain no existe
    if (!this.brain) {
      console.info('[SeleneLux] ?? setupBrainEventListeners() skipped (no local brain)')
      return
    }
    
    this.brain.on('output', (output: BrainOutput) => {
      this.emit('brain-output', output)
    })
    
    this.brain.on('pattern-learned', (data) => {
      this.consciousness.totalPatternsDiscovered++
      this.consciousness.lastInsight = `Aprend� un nuevo patr�n: ${data.patternHash?.slice(0, 8)}`
      this.emit('pattern-learned', data)
      
      // ? WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Brain', `Nuevo patr�n aprendido: ${data.emotionalTone}`, { 
        patternHash: data.patternHash, 
        beauty: data.avgBeautyScore 
      })
      
      // ??? WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'MEMORY',
        `?? Nuevo patr�n aprendido: ${data.emotionalTone} (Beauty: ${(data.avgBeautyScore * 100).toFixed(0)}%)`,
        'success',
        { patternHash: data.patternHash, beauty: data.avgBeautyScore }
      )
      this.telemetryCollector.recordPatternLearned()
    })
    
    this.brain.on('mode-change', (data) => {
      this.emit('brain-mode-change', data)
      
      // ? WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Mode', `Cambio de modo: ${data.from} ? ${data.to}`, { reason: data.reason })
      
      // ??? WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'MODE',
        `?? Cambio de modo: ${data.from} ? ${data.to} (${data.reason})`,
        'info',
        data
      )
    })
    
    this.brain.on('section-change', (data) => {
      this.emit('section-change', data)
      
      // ? WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Music', `Nueva secci�n: ${data.to}`, { 
        from: data.from, 
        confidence: data.confidence 
      })
      
      // ??? WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'SECTION',
        `?? Nueva secci�n: ${data.to} (Confianza: ${(data.confidence * 100).toFixed(0)}%)`,
        'info',
        data
      )
    })
    
    // ?? WAVE-14.5: Capturar generaci�n de paletas
    this.brain.on('palette-generated', (data: any) => {
      // ?? WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Visual', `Paleta generada: ${data.source}`, { colors: data.colors?.length || 0 })
      
      this.telemetryCollector.addLog(
        'PALETTE',
        `?? Paleta generada: ${data.source} - ${data.colors?.length || 0} colores`,
        'info',
        { source: data.source, colors: data.colors }
      )
    })
  }
  
  /**
   * ? WAVE 39.9.2: initializeBrain es ahora NO-OP
   * El Brain vive exclusivamente en Trinity Worker
   * Mantenido para compatibilidad de API
   */
  async initializeBrain(_dbPath?: string): Promise<void> {
    // ?? WAVE 39.9.2: Brain lives in Worker - this is just a compatibility stub
    console.info('[SeleneLux] ?? initializeBrain() is no-op (brain lives in Worker)')
    this.brainInitialized = true // Mark ready for compatibility
    this.consciousness.status = 'wise'
    this.consciousness.lastInsight = 'Conectado a Trinity Worker.'
    this.emit('brain-ready')
  }

  // ---------------------------------------------------------------------------
  // ?? WAVE 25.7: THE CHRONICLER - Centralized Log Emission
  // ---------------------------------------------------------------------------
  
  /**
   * Emite un log estructurado para el frontend (canal dedicado, no en broadcast 30fps)
   * @param category 'Music' | 'DMX' | 'System' | 'Brain' | 'Visual' | 'Mode'
   * @param message Mensaje descriptivo
   * @param data Datos adicionales opcionales
   */
  public emitLog(category: string, message: string, data?: any) {
    const logEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      category,
      message,
      data
    }
    this.emit('log', logEntry)
  }

  /**
   * ---------------------------------------------------------------------------
   * ?? PROCESO PRINCIPAL - Audio ? Brain ? Hardware
   * ---------------------------------------------------------------------------
   */
  processAudioFrame(metrics: AudioMetrics, deltaTime: number): SeleneState {
    this.frameCount++
    this.emit('audio-frame', metrics)
    
    // Siempre procesar beat para compatibilidad
    const beatState = this.beatDetector.process(metrics)
    this.lastBeat = beatState
    
    // -------------------------------------------------------------------------
    // ?? WAVE-8: FLUJO PRINCIPAL - Audio ? Brain ? Hardware
    // ?? WAVE 39.9.3: Agregado guard `this.brain` para prevenir crash
    // Desde WAVE 39.9.2 useBrain=false, as� que este bloque NUNCA se ejecuta
    // -------------------------------------------------------------------------
    if (this.useBrain && this.brainInitialized && this.brain) {
      // Convertir AudioMetrics a AudioAnalysis para el Brain
      const audioAnalysis = this.convertToAudioAnalysis(metrics, beatState)
      
      // 1?? PRIMERO: EJECUTAR EL CEREBRO PARA SABER QU� SUENA
      // Necesitamos el g�nero real antes de calcular el color
      const brainOutput = this.brain.process(audioAnalysis)
      this.lastBrainOutput = brainOutput
      
      // ?? WAVE 24.3: EXTRAER G�NERO REAL (Desde el contexto del cerebro)
      // Usamos context.genre.primary que es donde vive realmente
      const realGenre = brainOutput.context?.genre?.primary || 
                        (brainOutput.debugInfo as any)?.macroGenre || 
                        'ELECTROLATINO'
      
      // 2?? SEGUNDO: PREPARAR DATOS SEGUROS (FIX DE TIPOS WAVE 24.3)
      // ?? WAVE 24.1: DATA SANITIZATION (NaN Prevention)
      // ?? WAVE 24.3: TYPE ALIGNMENT (Corregir estructura de datos)
      // PROBLEMA 1: El proceso Main no tiene los datos complejos (Wave 8) que tienen los workers.
      //   ? audioAnalysis.wave8 puede ser undefined
      //   ? SeleneColorEngine intenta acceder a propiedades que no existen
      // PROBLEMA 2: SeleneColorEngine espera energy como NUMBER (top-level), no como objeto
      //   ? audioAnalysis.energy puede ser objeto {current, peak, ...}
      //   ? Matem�ticas usan energy directamente ? undefined ? NaN
      // PROBLEMA 3: SeleneColorEngine espera genre.primary, no genre.genre
      //   ? Estructura incorrecta ? no encuentra g�nero ? fallback
      // SOLUCI�N: Crear 'safeAnalysis' con estructura correcta + defaults
      //   ? Inyectar mock data (Wave 8 m�nimo)
      //   ? energy como NUMBER top-level
      //   ? genre.primary en lugar de genre.genre
      //   ? Verificar salida con isInvalid()
      //   ? Fallback a Negro si hay NaN (seguridad)
      
      const safeAnalysis = {
        ...audioAnalysis,
        
        // ?? FIX CR�TICO 1: ENERGY DEBE SER N�MERO (TOP-LEVEL)
        // El engine espera .energy como number, no como objeto.
        energy: metrics.energy,
        
        wave8: {
          rhythm: {
            syncopation: 0,
            confidence: 1,
            // activity no es cr�tico, syncopation s�
          },
          harmony: {
            key: brainOutput.context?.harmony?.key || 'C',
            mode: brainOutput.context?.harmony?.mode || 'major',
            confidence: 0,
            mood: 'neutral'
          },
          section: {
            type: 'unknown',
            energy: metrics.energy,
            confidence: 0
          },
          genre: {
            // ?? FIX CR�TICO 2: USAR PROPIEDAD 'primary'
            primary: realGenre,  // ELECTRONIC_4X4, LATINO_TRADICIONAL, etc.
            confidence: 1
          }
        }
      }
      
      // ?? WAVE 24.4: GENERAR HSL PRIMERO (Para la UI)
      // ?? WAVE 37.0: RESPETAR DECISIONES DEL BRAIN - Detener Lobotom�a
      // Si el Brain tiene una paleta desde memoria (experiencias exitosas),
      // la respetamos en lugar de sobrescribirla con ColorEngine procedural.
      
      let finalHslPalette: SelenePalette
      let finalPaletteSource = brainOutput.paletteSource
      
      // El Brain YA viene con una paleta. Verificamos si es de memoria.
      const brainHasMemoryPalette = brainOutput.paletteSource === 'memory' && brainOutput.palette?.primary
      
      if (brainHasMemoryPalette) {
        // ?? WAVE 37.0: BRAIN RESPECTED - Usar paleta de memoria
        finalHslPalette = {
          primary: brainOutput.palette.primary,
          secondary: brainOutput.palette.secondary,
          accent: brainOutput.palette.accent,
          ambient: brainOutput.palette.ambient,
          contrast: brainOutput.palette.contrast || { h: 180, s: 50, l: 50 },
          meta: { strategy: brainOutput.palette.strategy || 'memory-recalled' }
        } as SelenePalette
        finalPaletteSource = 'memory'
      } else {
        // ?? WAVE 49: COLOR INTERPOLATION - Transiciones suaves anti-epilepsia
        // WAVE 55: Usar DROP confirmado (override) en lugar de section bruta
        // Solo transici�n r�pida si StrategyArbiter confirm� DROP con energ�a relativa
        const currentSection = this.lastTrinityData?.sectionDetail?.type || 'unknown'
        const colorStrategy = (this.lastTrinityData as any)?.mood?.colorStrategy
        const isConfirmedDrop = colorStrategy?.sectionOverride === 'drop'
        
        // isDrop = true solo si el StrategyArbiter lo confirm� con energ�a relativa
        const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy)
        
        // 🔌 WAVE 150: THE THERMAL CONNECTION - Enchufar constitución del Vibe
        const activeVibe = this.lastTrinityData?.activeVibe ?? 
                          this.lastTrinityData?.debugInfo?.activeVibe ?? 
                          'idle'
        const constitution = getColorConstitution(activeVibe)
        
        // Usar interpolador CON la Constitución (incluye atmosphericTemp)
        finalHslPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop, constitution)
        finalPaletteSource = 'procedural'
      }
      
      // ?? WAVE 24.4: CONVERTIR A RGB (Para los Focos/DMX)
      // Usamos el helper del motor para obtener los valores f�sicos
      const freshRgbValues = paletteToRgb(finalHslPalette)
      
      // ???? WAVE 24.1: OUTPUT GUARD (Red de Seguridad Final)
      // Verificamos matem�ticamente que no haya NaN. Si hay, fallback a Negro.
      const isInvalid = (n: number) => !Number.isFinite(n) || isNaN(n)
      
      if (isInvalid(freshRgbValues.primary.r) || isInvalid(freshRgbValues.primary.g)) {
        // Solo loguear ocasionalmente para no saturar
        if (this.frameCount % 120 === 0) {
          console.warn(`[SeleneLux] ?? NaN detected in RGB! Metrics: E=${metrics.energy.toFixed(4)}`)
        }
        const safeColor = { r: 0, g: 0, b: 0 }
        freshRgbValues.primary = safeColor
        freshRgbValues.secondary = safeColor
        freshRgbValues.accent = safeColor
        freshRgbValues.ambient = safeColor
      }
      
      // 2. Calcular intensidad (manteniendo l�gica existente)
      const baseIntensity = audioAnalysis.energy.current
      const intensity = Math.min(1, baseIntensity * this.globalIntensity)
      
      // 3?? WAVE 37.0: INYECTAR PALETA FINAL EN BRAIN OUTPUT
      // ?? Si viene de memoria, ya tiene los valores correctos
      // ?? Si es procedural, usamos lo generado por ColorEngine
      brainOutput.palette = {
        primary: finalHslPalette.primary,
        secondary: finalHslPalette.secondary,
        accent: finalHslPalette.accent,
        ambient: finalHslPalette.ambient,
        contrast: finalHslPalette.contrast,
        strategy: finalHslPalette.meta?.strategy || 'unknown',
      }
      brainOutput.paletteSource = finalPaletteSource as 'memory' | 'procedural' | 'fallback'
      
      // 4?? WAVE 24.4: ASIGNAR RGB A HARDWARE (Fix DMX/Canvas)
      this.lastColors = {
        primary: freshRgbValues.primary,       // RGB Correcto {r,g,b}
        secondary: freshRgbValues.secondary,   // RGB Correcto
        accent: freshRgbValues.accent,         // RGB Correcto
        ambient: freshRgbValues.ambient,       // RGB Correcto
        intensity: isInvalid(intensity) ? 0 : intensity,  // Protecci�n extra
        saturation: this.globalSaturation       // State of Truth
      }
      
      // ?? WAVE 37.0: Silenciado - log WAVE24.4 DUAL removido para consola limpia
      // Si necesitas debug, descomentar:
      // if (this.frameCount % 100 === 0) {
      //   const hsl = finalHslPalette.primary
      //   const rgb = this.lastColors.primary
      //   console.log(`[SeleneLux] HSL=${Math.round(hsl.h)}�,${Math.round(hsl.s)}%,${Math.round(hsl.l)}% | RGB=${rgb.r},${rgb.g},${rgb.b}`)
      // }
      
      // El movimiento viene de la sugerencia del Brain
      this.lastMovement = this.brainOutputToMovement(brainOutput, deltaTime)
      
      // Actualizar consciencia con datos del Brain
      this.consciousness.beautyScore = brainOutput.estimatedBeauty
      this.consciousness.totalExperiences++
      
      // ?? WAVE 37.0: Procesar con Meta-Consciencia Avanzada
      // DreamForge simula escenarios futuros, SelfAnalysis detecta sesgos
      if (this.advancedConscious && this.useAdvancedConscious) {
        try {
          this.lastAdvancedState = this.advancedConscious.processAudioFrame(metrics, deltaTime)
          
          // Enriquecer consciencia b�sica con insights de la meta-consciencia
          if (this.lastAdvancedState.consciousness.lastInsight) {
            this.consciousness.lastInsight = this.lastAdvancedState.consciousness.lastInsight
          }
          if (this.lastAdvancedState.consciousness.mood) {
            // Sincronizar mood (emotional tone) desde la meta-consciencia
            // Cast seguro: EmotionalTone tiene m�s variantes en meta-consciencia
            const advMood = this.lastAdvancedState.consciousness.mood as string
            const validMoods = ['peaceful', 'energetic', 'dark', 'playful', 'calm', 'dramatic', 'euphoric', 'melancholic', 'aggressive']
            if (validMoods.includes(advMood)) {
              this.consciousness.currentMood = advMood as any
            }
          }
        } catch (err) {
          // Silenciar errores de meta-consciencia para no afectar flujo principal
          if (this.frameCount % 300 === 0) {
            console.warn('[SeleneLux] ?? Meta-consciencia error (silenciado):', err)
          }
        }
      }
      
      //  WAVE 39.0: Procesar con HuntOrchestrator (El Cazador)
      // Construir MusicalPattern desde brainOutput para alimentar la caza
      if (this.huntOrchestrator) {
        try {
          // Mapear key (C, D, E...) a nota (DO, RE, MI...)
          const keyToNote: Record<string, MusicalNote> = {
            'C': 'DO', 'D': 'RE', 'E': 'MI', 'F': 'FA', 'G': 'SOL', 'A': 'LA', 'B': 'SI'
          }
          const keyStr = brainOutput.context?.harmony?.key || 'C'
          const note: MusicalNote = keyToNote[keyStr] || 'DO'
          
          // Mapear energy a elemento
          const element: ElementType = metrics.energy > 0.7 ? 'fire'
            : metrics.energy > 0.5 ? 'air'
            : metrics.energy > 0.3 ? 'water'
            : 'earth'
          
          // Mapear mood a tono emocional
          const moodToTone: Record<string, EmotionalTone> = {
            'happy': 'energetic', 'sad': 'peaceful', 'energetic': 'energetic',
            'calm': 'peaceful', 'tense': 'chaotic', 'neutral': 'harmonious'
          }
          const moodStr = brainOutput.context?.mood || 'neutral'
          const emotionalTone: EmotionalTone = moodToTone[moodStr] || 'harmonious'
          
          const pattern: MusicalPattern = {
            note,
            element,
            emotionalTone,
            avgBeauty: brainOutput.estimatedBeauty ?? 0.5,
            beautyTrend: 'stable',
            occurrences: this.frameCount,
            confidence: brainOutput.confidence ?? 0.8,
          }
          
          const clusterHealth = brainOutput.confidence ?? 0.8
          this.lastHuntResult = this.huntOrchestrator.processFrame(pattern, clusterHealth)
          this.currentPattern = pattern
          
          if (this.frameCount % 300 === 0 && this.lastHuntResult.actionTaken) {
            console.info(`[SeleneLux]  Hunt: ${this.lastHuntResult.actionType} (${this.lastHuntResult.details?.reasoning || 'ok'})`)
          }
        } catch (err) {
          if (this.frameCount % 600 === 0) {
            console.warn('[SeleneLux]  HuntOrchestrator error (silenciado):', err)
          }
        }
      }
      // ? WAVE 39.0: Actualizar ZodiacInfo cada ~5 segundos
      if (this.frameCount % 150 === 0) {
        try {
          this.currentZodiacPosition = ZodiacAffinityCalculator.calculateZodiacPosition(Date.now())
          this.lastZodiacInfo = ZodiacAffinityCalculator.getZodiacInfo(this.currentZodiacPosition)
        } catch (err) {
          // Silenciar errores de zodiac
        }
      }
      
      // ??? WAVE 23.4: Esta condici�n nunca se cumple (paletteSource siempre 'procedural' tras lobotom�a)
      // ?? WAVE 24.11: Added 'as any' cast to silence TS warning
      // Mantenido para compatibilidad pero inactivo
      if (brainOutput.mode === 'intelligent' && (brainOutput.paletteSource as any) === 'memory') {
        this.decisionCount++ // Us� su experiencia (NUNCA ocurre tras WAVE 23.4)
      }
    } else {
      // ---------------------------------------------------------------------
      // LEGACY: Modo sin Brain (FLOW/reactive mode)
      // ---------------------------------------------------------------------
      
      // -----------------------------------------------------------------------
      // ??? WAVE 79: THE FINAL EXORCISM - SSOT GUARD PRIMERO
      // Si el Worker est� activo y estamos en modo Selene, NO TOCAR lastColors.
      // updateFromTrinity() ya los actualiza con interpolaci�n suave.
      // La generaci�n local SOLO ocurre en modo FLOW o sin Worker.
      // -----------------------------------------------------------------------
      const workerIsActive = this.isWorkerActive()
      const isSeleneMode = this.mode === 'selene' || this.mode === 'locked'
      
      let finalPalette: any
      let finalPaletteSource: 'procedural' | 'fallback' = 'fallback'
      
      if (workerIsActive && isSeleneMode) {
        // -------------------------------------------------------------------
        // ??? WAVE 79: Worker SSOT - NO GENERAR COLORES LOCALES
        // lastColors fue actualizado por updateFromTrinity() con colores del Worker
        // Aqu� solo construimos metadata para debugging, NUNCA tocamos lastColors
        // -------------------------------------------------------------------
        finalPalette = {
          primary: rgbToHsl(this.lastColors.primary),
          secondary: rgbToHsl(this.lastColors.secondary),
          accent: rgbToHsl(this.lastColors.accent),
          ambient: rgbToHsl(this.lastColors.ambient),
          contrast: { h: 0, s: 0, l: 0, hex: '#000000' },
          strategy: 'worker_passthrough' as const,
          source: 'procedural' as const,
          description: 'Worker-driven (SSOT - WAVE 79)',
        }
        finalPaletteSource = 'procedural'
        
        // Log cada 5 segundos para confirmar SSOT
        if (this.frameCount % 150 === 0) {
          console.log('[SeleneLux] ??? WAVE 79 SSOT: Worker active, skipping ALL local color generation')
        }
      } else {
        // -------------------------------------------------------------------
        // ?? WAVE 79: FLOW MODE o Worker inactivo ? Generaci�n local permitida
        // SOLO aqu� podemos tocar lastColors porque el Worker NO est� activo
        // -------------------------------------------------------------------
        
        // ??? WAVE 24.6: Validar m�tricas antes de generar colores
        // Si energy/bass/mid/treble son NaN, usamos valores seguros (0)
        const safeMetrics: typeof metrics = {
          ...metrics,
          energy: Number.isFinite(metrics.energy) ? metrics.energy : 0,
          bass: Number.isFinite(metrics.bass) ? metrics.bass : 0,
          mid: Number.isFinite(metrics.mid) ? metrics.mid : 0,
          treble: Number.isFinite(metrics.treble) ? metrics.treble : 0,
          peak: Number.isFinite(metrics.peak) ? metrics.peak : 0,
        }
        
        const colors = this.colorEngine.generate(safeMetrics, beatState, this.currentPattern)
        
        // -----------------------------------------------------------------------
        // ??? WAVE 24.8: HARDENING - Sanitize helper para asegurar RGB v�lido
        // Doble barrera: Primero sanitize, luego HOLD si a�n hay problemas
        // -----------------------------------------------------------------------
        const sanitize = (c: { r: number; g: number; b: number }): { r: number; g: number; b: number } => ({
          r: Number.isFinite(c.r) ? Math.round(Math.max(0, Math.min(255, c.r))) : 0,
          g: Number.isFinite(c.g) ? Math.round(Math.max(0, Math.min(255, c.g))) : 0,
          b: Number.isFinite(c.b) ? Math.round(Math.max(0, Math.min(255, c.g))) : 0,
        })
        
        // Sanitize TODOS los colores antes de aplicar multiplicadores
        const sanitizedPrimary = sanitize(colors.primary)
        const sanitizedSecondary = sanitize(colors.secondary)
        const sanitizedAccent = sanitize(colors.accent)
        const sanitizedAmbient = sanitize(colors.ambient)
        
        // ??? WAVE 24.6: Output Guard - Validar colores antes de asignar
        // Si ColorEngine retorna NaN, mantenemos el �ltimo color v�lido (HOLD pattern)
        const isValidColor = (c: { r: number; g: number; b: number }) => 
          Number.isFinite(c.r) && Number.isFinite(c.g) && Number.isFinite(c.b)
        
        const validPrimary = isValidColor(sanitizedPrimary)
        const validSecondary = isValidColor(sanitizedSecondary)
        const validAccent = isValidColor(sanitizedAccent)
        const validAmbient = isValidColor(sanitizedAmbient)
        
        // ?? WAVE 13.6: Aplicar multiplicadores globales (Intensidad y Saturaci�n)
        // CR�TICO: Los sliders del usuario deben afectar el modo FLOW
        // ??? WAVE 24.6: Solo asignar colores v�lidos, else HOLD anterior
        // ??? WAVE 24.8: Usar colores sanitizados (clamped 0-255, NaN?0)
        // ?? WAVE 24.11: lastColors SIEMPRE tiene valores (inicializado con Fuego warm colors)
        // ??? WAVE 79: Este bloque SOLO se ejecuta si Worker NO est� activo
        this.lastColors = {
          primary: validPrimary 
            ? this.applyGlobalMultipliers(sanitizedPrimary) 
            : this.lastColors.primary,  // HOLD �ltimo color v�lido (NO fallback a negro)
          secondary: validSecondary 
            ? this.applyGlobalMultipliers(sanitizedSecondary) 
            : this.lastColors.secondary,
          accent: validAccent 
            ? this.applyGlobalMultipliers(sanitizedAccent) 
            : this.lastColors.accent,
          ambient: validAmbient 
            ? this.applyGlobalMultipliers(sanitizedAmbient) 
            : this.lastColors.ambient,
          intensity: Number.isFinite(colors.intensity) 
            ? colors.intensity * this.globalIntensity 
            : this.lastColors.intensity,
          saturation: Number.isFinite(colors.saturation) 
            ? colors.saturation * this.globalSaturation 
            : this.lastColors.saturation,
        }
        
        // -----------------------------------------------------------------------
        // ?? WAVE 46.5: CHROMATIC UNLOCK - Usar SeleneColorEngine cuando Trinity est� activo
        // Si tenemos datos del Worker (g�nero, key, etc.), generamos colores procedurales
        // en lugar de usar Flow fallback. Esto desbloquea paletas reales (Techno = cian/magenta)
        // -----------------------------------------------------------------------
        
        // Verificar si tenemos datos de Trinity para generar colores procedurales
        const hasTrinityContext = this.lastTrinityData?.macroGenre && 
                                   this.lastTrinityData.macroGenre !== 'UNKNOWN'
        
        if (hasTrinityContext) {
          // Construir an�lisis seguro para SeleneColorEngine
          const safeAnalysis = {
            energy: metrics.energy,
            wave8: {
              rhythm: {
                syncopation: this.lastTrinityData?.syncopation ?? 0,
                confidence: 1,
              },
              harmony: {
                key: this.lastTrinityData?.key ?? 'C',
                mode: this.lastTrinityData?.mode ?? 'major',
                confidence: 0.8,
                mood: 'energetic' as const
              },
              section: {
                type: 'drop' as const,
                energy: metrics.energy,
                confidence: 0.8
              },
              genre: {
                primary: this.lastTrinityData?.macroGenre ?? 'ELECTRONIC_4X4',
                confidence: 1
              }
            }
          }
          
          // ?? WAVE 49: Generar paleta CON INTERPOLACI�N
          const currentSection = this.lastTrinityData?.sectionDetail?.type || 'unknown'
          const colorStrategy = (this.lastTrinityData as any)?.mood?.colorStrategy
          const isConfirmedDrop = colorStrategy?.sectionOverride === 'drop'
          const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy)
          
          // 🔌 WAVE 150: THE THERMAL CONNECTION - Enchufar constitución del Vibe
          const activeVibe = this.lastTrinityData?.activeVibe ?? 
                            this.lastTrinityData?.debugInfo?.activeVibe ?? 
                            'idle'
          const constitution = getColorConstitution(activeVibe)
          
          const proceduralPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop, constitution)
          
          // Convertir HSL ? RGB para hardware
          const rgbPalette = paletteToRgb(proceduralPalette)
          
          // Aplicar multiplicadores globales y asignar a lastColors
          this.lastColors = {
            primary: this.applyGlobalMultipliers(rgbPalette.primary),
            secondary: this.applyGlobalMultipliers(rgbPalette.secondary),
            accent: this.applyGlobalMultipliers(rgbPalette.accent),
            ambient: this.applyGlobalMultipliers(rgbPalette.ambient),
            intensity: this.lastColors.intensity,
            saturation: this.globalSaturation
          }
          
          finalPalette = proceduralPalette
          finalPaletteSource = 'procedural'
        } else {
          // ?? WAVE 24.9: FALLBACK - Modo Flow cuando no hay Trinity data
          finalPalette = {
            primary: rgbToHsl(this.lastColors.primary),
            secondary: rgbToHsl(this.lastColors.secondary),
            accent: rgbToHsl(this.lastColors.accent),
            ambient: rgbToHsl(this.lastColors.ambient),
            contrast: { h: 0, s: 0, l: 0, hex: '#000000' },
            strategy: 'flow_preset' as const,
            source: 'fallback' as const,
            description: `Flow: ${this.currentPalette}`,
          }
          finalPaletteSource = 'fallback'
        }
      }
      
      // Construir Brain Output (Procedural o Flow seg�n Trinity data)
      // ?? WAVE 41.0: Agregado context con rhythm.groove.syncopation para telemetr�a
      // ??? WAVE 72: Usar workerIsActive en lugar de hasTrinityContext
      this.lastBrainOutput = {
        timestamp: Date.now(),
        sessionId: workerIsActive ? 'trinity-session' : 'flow-session',
        mode: 'reactive' as const,
        palette: finalPalette,  // Procedural (Selene) o Flow (Presets)
        paletteSource: finalPaletteSource as 'procedural' | 'fallback',
        confidence: 1.0,
        estimatedBeauty: this.lastColors.saturation || 0.8,
        lighting: { fixtures: {} } as any,  // Dummy
        performance: { 
          totalMs: 0, 
          contextMs: 0,
          memoryMs: 0,
          paletteMs: 0,
          mappingMs: 0
        },
        // ?? WAVE 41.0: Context m�nimo para que telemetr�a no crashee
        context: {
          rhythm: {
            bpm: beatState.bpm || 120,
            confidence: beatState.confidence || 0.5,
            beatPhase: beatState.phase || 0,
            barPhase: ((beatState.beatCount || 0) % 4) / 4,
            pattern: { type: 'unknown' as const, confidence: 0 },
            drums: { kick: false, snare: false, hihat: false, clap: false, tom: false },
            groove: {
              syncopation: 0, // Modo FLOW no tiene sincopaci�n avanzada
              swingAmount: 0,
              complexity: 'low' as const,
              humanization: 0,
            },
            fillInProgress: false,
            timestamp: Date.now(),
          },
          harmony: {
            key: null,
            mode: { scale: 'major' as const, confidence: 0 },
            confidence: 0,
          },
          section: {
            current: { type: 'unknown' as const, confidence: 0, startedAt: 0, duration: 0 },
            predicted: null,
            confidence: 0,
          },
          genre: {
            primary: 'UNKNOWN',
            secondary: null,
            confidence: 0,
          },
          mood: 'neutral' as const,
          energy: metrics.energy || 0,
          confidence: 0.5,
          timestamp: Date.now(),
        } as any,  // Cast temporal para compatibilidad
      }
      
      this.colorEngine.updateTransition(deltaTime)
      
      const movement = this.movementEngine.calculate(metrics, beatState, deltaTime)
      this.lastMovement = movement
      
      if (beatState.onBeat) {
        this.consciousness.totalExperiences++
      }
      this.decisionCount++
    }
    
    // -----------------------------------------------------------------------
    // ?? WAVE-14: Collect & Emit Telemetry
    // -----------------------------------------------------------------------
    const audioAnalysis = this.useBrain && this.brainInitialized 
      ? this.convertToAudioAnalysis(metrics, beatState)
      : this.convertToAudioAnalysis(metrics, beatState)
    
    // ?? WAVE 24: Pasar lastColors para generar FixtureValues en telemetr�a
    const telemetryPacket = this.telemetryCollector.collect(
      audioAnalysis,
      this.lastBrainOutput,
      this.inputGain,
      this.lastColors  // Colores RGB reales para sincronizar canvas
    )
    
    if (telemetryPacket) {
      this.emit('telemetry-update', telemetryPacket)
    }
    
    return this.getState()
  }
  
  /**
   * ?? Convierte AudioMetrics a AudioAnalysis (formato del Brain)
   */
  private convertToAudioAnalysis(metrics: AudioMetrics, beat: BeatState): AudioAnalysis {
    return {
      timestamp: metrics.timestamp,
      spectrum: {
        bass: metrics.bass,
        lowMid: (metrics.bass + metrics.mid) / 2,
        mid: metrics.mid,
        highMid: (metrics.mid + metrics.treble) / 2,
        treble: metrics.treble,
      },
      energy: {
        current: metrics.energy,
        average: metrics.energy,
        variance: Math.abs(metrics.energy - metrics.peak) * 0.5,
        trend: 'stable',
        peakRecent: metrics.peak,
      },
      beat: {
        detected: beat.onBeat,
        bpm: beat.bpm,
        confidence: beat.confidence,
        beatPhase: beat.phase,
        timeSinceLastBeat: Date.now() - beat.lastBeatTime,
      },
      transients: {
        bass: beat.kickDetected ? 1 : 0,
        mid: beat.snareDetected ? 0.5 : 0,
        treble: beat.hihatDetected ? 0.3 : 0,
      },
    }
  }
  
  /**
   * ?? Convierte BrainOutput a ColorOutput (para hardware)
   */
  private brainOutputToColors(output: BrainOutput): ColorOutput {
    const { palette, lighting } = output
    
    // Convertir HSL a RGB
    const primaryRGB = this.hslToRgb(palette.primary)
    const secondaryRGB = this.hslToRgb(palette.secondary)
    const accentRGB = this.hslToRgb(palette.accent)
    
    // ?? ESPEJO CROM�TICO: Si hay ambient en la paleta, usarlo
    // Si no, crear una variaci�n c�lida del accent para coherencia visual
    let ambientRGB: { r: number; g: number; b: number }
    if (palette.ambient) {
      ambientRGB = this.hslToRgb(palette.ambient)
    } else {
      // Crear espejo crom�tico: variaci�n m�s c�lida del accent
      // Shift hacia magenta/rosa para complementar el accent
      ambientRGB = {
        r: Math.min(255, Math.round(accentRGB.r * 1.1)),
        g: Math.round(accentRGB.g * 0.85),
        b: Math.min(255, Math.round(accentRGB.b * 1.15)),
      }
    }
    
    // Obtener intensidad promedio de los fixtures
    const movingHeadParams = lighting.fixtures['moving_head']
    const avgIntensity = movingHeadParams ? movingHeadParams.intensity / 255 : 0.5
    
    // ?? WAVE 13.6: Aplicar multiplicadores globales
    const finalIntensity = avgIntensity * this.globalIntensity
    const finalSaturation = (palette.primary.s / 100) * this.globalSaturation
    
    return {
      primary: primaryRGB,
      secondary: secondaryRGB,
      accent: accentRGB,
      ambient: ambientRGB,
      intensity: finalIntensity,
      saturation: finalSaturation,
    }
  }
  
  /**
   * ?? Convierte HSL a RGB
   */
  private hslToRgb(hsl: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
    const h = hsl.h / 360
    const s = hsl.s / 100
    const l = hsl.l / 100
    
    let r: number, g: number, b: number
    
    if (s === 0) {
      r = g = b = l
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1
        if (t > 1) t -= 1
        if (t < 1/6) return p + (q - p) * 6 * t
        if (t < 1/2) return q
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
        return p
      }
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s
      const p = 2 * l - q
      r = hue2rgb(p, q, h + 1/3)
      g = hue2rgb(p, q, h)
      b = hue2rgb(p, q, h - 1/3)
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    }
  }
  
  /**
   * ?? Convierte BrainOutput a MovementOutput
   * WAVE 10: Ahora usa MovementEngine para posiciones din�micas
   * Respeta los par�metros configurados por el UI (speed, range, pattern)
   */
  private brainOutputToMovement(output: BrainOutput, deltaTime: number): MovementOutput {
    // ?? WAVE 10 FIX: NO sobrescribir el pattern del UI
    // El pattern, speed y range se configuran desde MovementControl.tsx via IPC
    // Solo usamos el MovementEngine para calcular las posiciones
    
    // Usar lastBeat o crear uno por defecto
    const beatState = this.lastBeat || {
      bpm: 120,
      phase: 0,
      confidence: 0.5,
      onBeat: false,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
      beatCount: 0,
      lastBeatTime: Date.now(),
    }
    
    // Calcular movimiento real usando el engine (con los params del UI ya configurados)
    const calculatedMovement = this.movementEngine.calculate(
      {
        bass: 0.5,
        mid: 0.5,
        treble: 0.5,
        bpm: 120,
        beatConfidence: 0.7,
        onBeat: false,
        beatPhase: (Date.now() % 500) / 500,
        timestamp: Date.now(),
        energy: 0.6,
        peak: 0.7,
        frameIndex: this.frameCount,
      },
      beatState,
      deltaTime
    )
    
    return {
      pan: calculatedMovement.pan,
      tilt: calculatedMovement.tilt,
      speed: calculatedMovement.speed,
      pattern: calculatedMovement.pattern,
    }
  }
  
  /**
   * ??? Activa/desactiva el uso del Brain
   */
  setUseBrain(enabled: boolean): void {
    this.useBrain = enabled
    console.info(`[SeleneLux] Brain ${enabled ? 'ENABLED' : 'DISABLED'}`)
    this.emit('brain-toggle', enabled)
  }
  
  /**
   * ?? Obtiene estad�sticas del Brain
   */
  /**
   * ?? WAVE 39.9.2: getBrainStats retorna stats simulados
   * Brain vive en Worker, estas stats son para compatibilidad UI
   */
  getBrainStats(): { session: unknown; memory: unknown; hasMemory: boolean } | null {
    if (!this.brainInitialized) return null
    // ?? WAVE 39.9.2: Return simulated stats (real brain is in Worker)
    return {
      session: { framesProcessed: this.frameCount, decisionsCount: this.decisionCount },
      memory: { patterns: 0, experiences: this.consciousness.totalExperiences },
      hasMemory: true,
    }
  }
  
  setPalette(palette: LivingPaletteId): void {
    this.currentPalette = palette
    this.colorEngine.setPalette(palette)
    console.info(`[SeleneLux] Palette changed to: ${palette}`)
  }
  
  /**
   * ?? WAVE 39.1: Recibir FFT bins desde IPC para visualizaci�n
   * @param bins Array de 64 valores normalizados (0-1)
   */
  setFftBins(bins: number[]): void {
    if (bins && bins.length > 0) {
      this.lastFftBins = bins
    }
  }
  
  setMovementPattern(pattern: MovementPattern): void {
    this.movementEngine.setPattern(pattern)
    console.info(`[SeleneLux] Movement pattern changed to: ${pattern}`)
  }
  
  // ?? WAVE 10: New methods for movement control
  setMovementSpeed(speed: number): void {
    this.movementEngine.setSpeed(speed)
    console.info(`[SeleneLux] Movement speed changed to: ${speed.toFixed(2)}`)
  }
  
  setMovementRange(range: number): void {
    this.movementEngine.setRange(range)
    console.info(`[SeleneLux] Movement range changed to: ${range.toFixed(2)}`)
  }
  
  setMode(mode: SeleneMode): void {
    this.mode = mode
    console.info(`[SeleneLux] Mode changed to: ${mode}`)
  }
  
  getState(): SeleneState {
    const defaultBeat: BeatState = {
      bpm: 120,
      confidence: 0,
      phase: 0,
      onBeat: false,
      beatCount: 0,
      lastBeatTime: 0,
      kickDetected: false,
      snareDetected: false,
      hihatDetected: false,
    }
    
    return {
      mode: this.mode,
      palette: this.currentPalette,
      colors: this.lastColors || {
        primary: { r: 255, g: 0, b: 0 },
        secondary: { r: 200, g: 50, b: 0 },
        accent: { r: 255, g: 100, b: 0 },
        ambient: { r: 150, g: 0, b: 50 },
        intensity: 0.5,
        saturation: 0.9,
      },
      movement: this.lastMovement || {
        pan: 0.5,
        tilt: 0.5,
        speed: 0.5,
        pattern: 'lissajous',
      },
      beat: this.lastBeat || defaultBeat,
      consciousness: { ...this.consciousness },
      stats: {
        frames: this.frameCount,
        decisions: this.decisionCount,
        uptime: Date.now() - this.startTime,
      },
      // ?? WAVE-8: Estado del Brain
      brainOutput: this.lastBrainOutput,
      brainMode: this.lastBrainOutput?.mode,
      paletteSource: this.lastBrainOutput?.paletteSource || 'legacy',
    }
  }
  
  tickMovement(audioData: { energy: number; bass: number; mid: number; treble: number }, deltaTime: number, fixtureIds: string[]): FixtureMovement[] {
    return this.movementEngine.tick(audioData, deltaTime, fixtureIds)
  }
  
  isInitialized(): boolean {
    return this.initialized
  }
  
  isRunning(): boolean {
    return this.running
  }
  
  start(): void {
    this.running = true
    console.info('[SeleneLux] Started')
  }
  
  stop(): void {
    this.running = false
    console.info('[SeleneLux] Stopped')
  }
  
  /**
   * ?? WAVE 13.6: STATE OF TRUTH - Multiplicadores Globales de Color
   */
  setGlobalSaturation(value: number): void {
    this.globalSaturation = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] ?? Global Saturation: ${(this.globalSaturation * 100).toFixed(0)}%`)
  }
  
  setGlobalIntensity(value: number): void {
    this.globalIntensity = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] ?? Global Intensity: ${(this.globalIntensity * 100).toFixed(0)}%`)
  }
  
  getGlobalColorParams(): { saturation: number; intensity: number } {
    return {
      saturation: this.globalSaturation,
      intensity: this.globalIntensity
    }
  }
  
  /**
   * ?? WAVE 13.6: Aplica multiplicadores globales a un color RGB
   * CR�TICO: Aten�a la intensidad multiplicando cada canal por globalIntensity
   * 
   * ??? WAVE 24.6: Anti-NaN Guard a�adido
   * Si llega NaN, usamos 0 para evitar flicker y propagaci�n
   */
  private applyGlobalMultipliers(rgb: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
    // ??? WAVE 24.6: Validar entrada antes de multiplicar
    // NaN * globalIntensity = NaN ? FLICKER
    const safeR = Number.isFinite(rgb.r) ? rgb.r : 0
    const safeG = Number.isFinite(rgb.g) ? rgb.g : 0
    const safeB = Number.isFinite(rgb.b) ? rgb.b : 0
    
    // Aplicar intensidad (dimmer) - afecta todos los canales por igual
    const dimmedR = safeR * this.globalIntensity
    const dimmedG = safeG * this.globalIntensity
    const dimmedB = safeB * this.globalIntensity
    
    // Aplicar saturaci�n - desatura hacia el promedio de los canales
    const avg = (dimmedR + dimmedG + dimmedB) / 3
    const finalR = avg + (dimmedR - avg) * this.globalSaturation
    const finalG = avg + (dimmedG - avg) * this.globalSaturation
    const finalB = avg + (dimmedB - avg) * this.globalSaturation
    
    return {
      r: Math.round(Math.max(0, Math.min(255, finalR))),
      g: Math.round(Math.max(0, Math.min(255, finalG))),
      b: Math.round(Math.max(0, Math.min(255, finalB))),
    }
  }
  
  /**
   * ? WAVE-14: Input Gain para telemetr�a
   */
  setInputGain(value: number): void {
    this.inputGain = Math.max(0, Math.min(4, value))
    console.log(`[SeleneLux] ??? Input Gain: ${(this.inputGain * 100).toFixed(0)}%`)
  }
  
  getInputGain(): number {
    return this.inputGain
  }
  
  /**
   * ?? WAVE 39.9.2: forceColorMutation es NO-OP
   * Brain vive en Worker - esta funci�n es para compatibilidad
   */
  forceColorMutation(_reason: string = 'Manual trigger'): void {
    // ?? WAVE 39.9.2: Brain lives in Worker - log only
    console.info('[SeleneLux] ?? forceColorMutation() - brain is in Worker')
  }
  
  /**
   * ? WAVE 39.9.2: resetMemory es NO-OP
   * Brain vive en Worker - esta funci�n es para compatibilidad
   */
  resetMemory(): void {
    // ?? WAVE 39.9.2: Brain lives in Worker - log only
    console.info('[SeleneLux] ?? resetMemory() - brain is in Worker')
  }

  /**
   * ?? WAVE 46.0 ? 72: DATA BRIDGE - Recibe datos de Trinity Worker
   * 
   * ??? WAVE 72: SINGLE SOURCE OF TRUTH
   * Este m�todo es el �NICO autorizado para escribir en `lastColors` cuando 
   * estamos en modo Selene y el Worker est� activo. processAudioFrame() 
   * verifica `isWorkerActive()` y NO sobrescribe si el Worker tiene control.
   * 
   * Este m�todo conecta el Worker (GAMMA/mind.ts) con getBroadcast() para la UI.
   * El Worker tiene la data correcta (g�nero, key, syncopation) pero antes
   * no llegaba a la UI porque lastBrainOutput estaba vac�o (useBrain=false).
   * 
   * WAVE 47.2: Ahora incluye mood (MoodSynthesizer) y sectionDetail (SectionTracker)
   * ?? WAVE 57.5: A�adido drop (DROP STATE MACHINE)
   * 
   * @param debugInfo - debugInfo del LightingDecision que viene del Worker
   * @param palette - ?? WAVE 69.3: Palette RGB del ColorEngine (Worker)
   */
  updateFromTrinity(debugInfo: {
    macroGenre?: string
    key?: string | null
    mode?: string
    syncopation?: number
    strategy?: string
    temperature?: string
    description?: string
    mood?: any  // ?? WAVE 47.2: MoodSynthesizer output (VAD)
    sectionDetail?: any  // ?? WAVE 47.2: SectionTracker output
    drop?: {  // ?? WAVE 57.5: DROP STATE MACHINE output
      isDropActive?: boolean
      dropState?: any
    }
    // ??? WAVE 94.2: AGC normalized audio
    agc?: {
      normalizedBass: number
      normalizedMid: number
      normalizedTreble: number
      normalizedEnergy: number
      avgNormEnergy: number
      gainFactor: number
    }
  } | undefined, palette?: {
    primary: { r: number; g: number; b: number }
    secondary: { r: number; g: number; b: number }
    accent: { r: number; g: number; b: number }
    ambient?: { r: number; g: number; b: number }  // ?? WAVE 84.5: Ambient independiente
    intensity: number
  }): void {
    if (!debugInfo) return
    
    this.lastTrinityData = {
      ...debugInfo,
      timestamp: Date.now()
    }
    
    // ??? WAVE 94.2: Almacenar AGC data para Relative Gates
    if (debugInfo.agc) {
      this._agcData = debugInfo.agc
    }
    
    // ?? WAVE 74: SINGLE INTERPOLATOR - Confiar en el Worker
    // El Worker (mind.ts) ya interpola con SeleneColorInterpolator (240 frames = 4s)
    // NO re-interpolamos aqu� - eso causaba conflicto y flickering
    // 
    // -----------------------------------------------------------------------
    // ??? WAVE 83: RAW RGB PRESERVATION (Anti-Barro Fix)
    // -----------------------------------------------------------------------
    // PROBLEMA: Multiplicar RGB por intensity oscurec�a los colores.
    // Cuando RGB oscurecido se reconvierte a HSL, la saturaci�n/luminosidad baja.
    // Esto causaba que colores vibrantes (S=94) aparecieran como barro (S=49, L=36).
    //
    // SOLUCI�N: Pasar RGB PUROS a lastColors. La intensity debe controlar el 
    // DIMMER del fixture, no el color HSL. As� el color permanece vibrante
    // y solo cambia el brillo f�sico de la luz.
    // -----------------------------------------------------------------------
    if (palette) {
      let rawIntensity = palette.intensity ?? 1.0
      
      // -----------------------------------------------------------------------
      // ??? WAVE 91: DYNAMIC NOISE GATE - Blackout real en cortes dram�ticos
      // -----------------------------------------------------------------------
      // PROBLEMA: En cumbia/reggaeton, los silencios dram�ticos (breaks) manten�an
      // luz tenue (15-20%), destruyendo el impacto visual del corte.
      // 
      // SOLUCI�N: Gate agresivo + expansi�n exponencial
      // - <15% energ�a ? 0% luz (BLACKOUT TOTAL)
      // - >15% energ�a ? Re-mapeo 0.15-1.0 a 0.0-1.0 + pow(2) para punch
      // 
      // Resultado: "Mentirosa" de Reik ahora tiene blacks REALES en los cortes.
      // -----------------------------------------------------------------------
      
      let processedIntensity: number;
      
      if (rawIntensity < 0.15) {
        // GATE: Silencio dram�tico ? Oscuridad total
        processedIntensity = 0;
      } else {
        // EXPANSI�N: Re-mapear 0.15-1.0 ? 0.0-1.0
        const normalized = (rawIntensity - 0.15) / 0.85;
        
        // PUNCH: Elevar al cuadrado (golpes fuertes brillan M�S)
        // 0.5 ? 0.25, 1.0 ? 1.0
        processedIntensity = Math.pow(normalized, 2);
      }
      
      // ⚗️ WAVE 83: Asignar colores PUROS del Worker (sin multiplicar por intensity)
      // La intensity se guarda por separado para uso del dimmer
      // 🌴 WAVE 84.5: Usar palette.ambient en lugar de clonar secondary
      this.lastColors = {
        primary: { ...palette.primary },
        secondary: { ...palette.secondary },
        accent: { ...palette.accent },
        ambient: palette.ambient ? { ...palette.ambient } : { ...palette.secondary },  // 🌴 WAVE 84.5: STEREO REAL
        intensity: processedIntensity,  // ⚗️ WAVE 91: Usar intensity procesada con noise gate
        saturation: this.globalSaturation
      }
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🔥 WAVE 147: THE GREAT PURGE - UNIFIED PHYSICS FLOW
      // ═══════════════════════════════════════════════════════════════════════
      // 
      // ANTES (Wave 141-142): Lógica de color HARDCODED por Vibe:
      //   - Techno: Cold Dictator + Prism (140 líneas)
      //   - Rock: Stage Lighting + Stadium palette (95 líneas)
      //   - Total: 235 líneas de código duplicado y frágil
      // 
      // AHORA: Flujo Unificado de 3 Pasos:
      //   1. VibeManager.getColorConstitution() → Reglas del Vibe actual
      //   2. SeleneColorEngine.generate(audio, constitution) → Paleta base
      //   3. Physics[Vibe].apply(palette, audio) → Reactividad específica
      // 
      // La lógica de COLOR vive en colorConstitutions.ts (forbiddenHueRanges, etc.)
      // La lógica de FÍSICA vive en physics/*StereoPhysics.ts (strobe, flashes, etc.)
      // SeleneLux solo ORQUESTA - nunca decide colores.
      // ═══════════════════════════════════════════════════════════════════════
      
      const activeVibe = this.lastTrinityData?.activeVibe ?? 
                         this.lastTrinityData?.debugInfo?.activeVibe ?? 
                         'idle'
      
      // Extraer métricas de audio para delegación de física
      const agc = this._agcData
      const audioMetrics = {
        normalizedTreble: agc?.normalizedTreble ?? 0.0,
        normalizedBass: agc?.normalizedBass ?? 0.0,
        normalizedMid: agc?.normalizedMid ?? 0.0,
        avgNormEnergy: agc?.avgNormEnergy ?? 0.4
      }
      
      // Capturar hue base para referencia de física
      const primaryHsl = rgbToHsl(this.lastColors.primary)
      const baseHue = primaryHsl.h
      
      // Paleta actual para procesar
      const currentPalette = {
        primary: this.lastColors.primary,
        secondary: this.lastColors.secondary,
        ambient: this.lastColors.ambient,
        accent: this.lastColors.accent
      }
      
      // ───────────────────────────────────────────────────────────────────────
      // ⚡ PHYSICS DELEGATION BY VIBE
      // ───────────────────────────────────────────────────────────────────────
      // Cada módulo de física sabe qué hacer con su género:
      //   - TechnoStereoPhysics: Industrial Strobe (treble drops)
      //   - RockStereoPhysics: Snare Crack + Kick Punch
      //   - LatinoStereoPhysics: Solar Flare (kick) + Machine Gun (blackout)
      //   - ChillStereoPhysics: Breathing Pulse (sin strobe)
      // 
      // Los COLORES ya vienen correctos del ColorEngine con la Constitution.
      // Aquí solo aplicamos la FÍSICA de reactividad.
      // ───────────────────────────────────────────────────────────────────────
      
      const vibeNormalized = activeVibe.toLowerCase()
      
      // ⚡ WAVE 148: Reset strobe state (solo Techno lo activa)
      this.lastStrobeActive = false
      
      if (vibeNormalized.includes('techno') || vibeNormalized.includes('electro')) {
        // ⚡ TECHNO: Industrial Strobe Physics
        const physicsResult = TechnoStereoPhysics.apply(
          currentPalette,
          {
            normalizedTreble: audioMetrics.normalizedTreble,
            normalizedBass: audioMetrics.normalizedBass
          }
        )
        this.lastColors.accent = physicsResult.palette.accent
        
        // ⚡ WAVE 148: Guardar estado del strobe para UI feedback
        this.lastStrobeActive = physicsResult.isStrobeActive
        
        // Debug log esporádico
        if (Math.random() < 0.003) {
          const dbg = physicsResult.debugInfo
          console.log(`[WAVE148] ⚡ TECHNO PHYSICS | Base:${baseHue.toFixed(0)}° | RawT:${dbg.rawTreble.toFixed(2)} | Floor:${dbg.dynamicFloor.toFixed(2)} | Strobe:${physicsResult.isStrobeActive}`)
        }
      } else if (vibeNormalized.includes('pop') || vibeNormalized.includes('rock')) {
        // 🎸 ROCK: Snare Crack + Kick Punch Physics
        const physicsResult = RockStereoPhysics.apply(
          currentPalette,
          {
            normalizedMid: audioMetrics.normalizedMid,
            normalizedBass: audioMetrics.normalizedBass,
            avgNormEnergy: audioMetrics.avgNormEnergy
          },
          baseHue
        )
        this.lastColors.accent = physicsResult.palette.accent
        
        if (Math.random() < 0.003) {
          const dbg = physicsResult.debugInfo
          console.log(`[WAVE147] 🎸 ROCK PHYSICS | Base:${baseHue.toFixed(0)}° | Snare:${physicsResult.isSnareHit} | Kick:${physicsResult.isKickHit}`)
        }
      } else if (vibeNormalized.includes('latin') || vibeNormalized.includes('fiesta') || 
                 vibeNormalized.includes('reggae') || vibeNormalized.includes('cumbia') ||
                 vibeNormalized.includes('salsa') || vibeNormalized.includes('bachata')) {
        // ☀️ LATINO: Solar Flare + Machine Gun Blackout
        const physicsResult = this.latinoPhysics.apply(
          currentPalette,
          {
            normalizedBass: audioMetrics.normalizedBass,
            normalizedEnergy: audioMetrics.avgNormEnergy
          }
        )
        
        // Latino modifica PRIMARY (Solar Flare) y controla INTENSITY
        this.lastColors.primary = physicsResult.palette.primary
        this.lastColors.accent = physicsResult.palette.accent
        if (physicsResult.dimmerOverride !== null) {
          this.lastColors.intensity = physicsResult.dimmerOverride
        }
        
        if (Math.random() < 0.003) {
          const dbg = physicsResult.debugInfo
          console.log(`[WAVE147] ☀️ LATINO PHYSICS | Solar:${physicsResult.isSolarFlare} | Blackout:${physicsResult.isMachineGunBlackout} | Dimmer:${physicsResult.dimmerOverride ?? 'N/A'}`)
        }
      } else if (vibeNormalized.includes('chill') || vibeNormalized.includes('ambient') ||
                 vibeNormalized.includes('lounge') || vibeNormalized.includes('jazz') ||
                 vibeNormalized.includes('classical') || vibeNormalized.includes('acoustic')) {
        // 🌊 CHILL: Breathing Pulse (Sin Strobe Jamás)
        const physicsResult = this.chillPhysics.apply(
          currentPalette,
          {
            normalizedEnergy: audioMetrics.avgNormEnergy
          }
        )
        
        // Chill modifica la INTENSIDAD con respiración suave
        // Usamos getModulatedDimmer para obtener el dimmer final
        const modulatedDimmer = this.chillPhysics.getModulatedDimmer(this.lastColors.intensity)
        this.lastColors.intensity = modulatedDimmer
        
        // Aplicar colores modulados por la respiración
        this.lastColors.primary = physicsResult.palette.primary
        this.lastColors.secondary = physicsResult.palette.secondary
        this.lastColors.ambient = physicsResult.palette.ambient
        this.lastColors.accent = physicsResult.palette.accent
        
        if (Math.random() < 0.003) {
          const dbg = physicsResult.debugInfo
          console.log(`[WAVE147] 🌊 CHILL PHYSICS | Breathing Phase:${physicsResult.breathPhase.toFixed(2)} | Dimmer:${modulatedDimmer.toFixed(2)}`)
        }
      }
      // ═══════════════════════════════════════════════════════════════════════
      // 🔥 FIN WAVE 147: THE GREAT PURGE
      // 235 líneas de código hardcoded → 120 líneas de delegación limpia
      // ═══════════════════════════════════════════════════════════════════════
    }
    
    // ?? WAVE 47.2: Log actualizado para verificar mood & section desde spread directo
    // ?? WAVE 56: A�adido colorStrategy para debug
    // ?? WAVE 63: Comentado - solo vibes importan
    // if (this.frameCount % 150 === 0) {
    //   const cs = this.lastTrinityData.mood?.colorStrategy
    //   console.log('[SeleneLux] ?? WAVE 47.2 Trinity Data:', JSON.stringify({
    //     genre: this.lastTrinityData.macroGenre,
    //     key: this.lastTrinityData.key,
    //     synco: this.lastTrinityData.syncopation?.toFixed(2),
    //     mood: this.lastTrinityData.mood?.primary,  // Acceso directo (spread)
    //     section: this.lastTrinityData.sectionDetail?.type,  // Acceso directo (spread)
    //     sectionConf: this.lastTrinityData.sectionDetail?.confidence?.toFixed(2),
    //     strategy: cs?.stable,  // ?? WAVE 56: colorStrategy debug
    //     override: cs?.sectionOverride,
    //   }, null, 0))
    // }
  }

  /**
   * ?? WAVE-14: Acceso al TelemetryCollector
   */
  getTelemetryCollector(): SeleneTelemetryCollector {
    return this.telemetryCollector
  }  // ---------------------------------------------------------------------------
  // ?? WAVE 25: UNIVERSAL TRUTH PROTOCOL - getBroadcast()
  // ---------------------------------------------------------------------------
  
  /**
   * ?? WAVE 25: Obtiene el broadcast completo de Selene
   * Este es el �NICO objeto que el Frontend necesita para renderizar todo.
   * 
   * FLUJO: Brain + ColorEngine + Movement + Consciousness ? SeleneBroadcast
   * 
   * @returns SeleneBroadcast - La Verdad Universal de Selene a 30fps
   */
  public getBroadcast(): SeleneBroadcast {
    const now = Date.now()
    const deltaTime = now - this.lastFrameTime
    
    // ?? FPS Tracking
    this.fpsCounter.frames++
    if (now - this.fpsCounter.lastCheck >= 1000) {
      this.fpsCounter.currentFPS = this.fpsCounter.frames
      this.fpsCounter.frames = 0
      this.fpsCounter.lastCheck = now
    }
    
    // Safe defaults para optional chaining
    const brain = this.lastBrainOutput
    const beat = this.lastBeat
    const movement = this.lastMovement
    const metrics = this.lastAudioMetrics
    const analysis = this.lastAudioAnalysis
    
    // -----------------------------------------------------------------------
    // HELPER: RGB ? UnifiedColor (HSL + RGB + HEX)
    // -----------------------------------------------------------------------
    const toUnifiedColor = (rgb: { r: number; g: number; b: number }): UnifiedColor => {
      const r = Math.max(0, Math.min(255, Math.round(rgb.r ?? 0)))
      const g = Math.max(0, Math.min(255, Math.round(rgb.g ?? 0)))
      const b = Math.max(0, Math.min(255, Math.round(rgb.b ?? 0)))
      
      // RGB ? HSL
      const rNorm = r / 255
      const gNorm = g / 255
      const bNorm = b / 255
      const max = Math.max(rNorm, gNorm, bNorm)
      const min = Math.min(rNorm, gNorm, bNorm)
      const l = (max + min) / 2
      
      let h = 0
      let s = 0
      
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break
          case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break
          case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break
        }
      }
      
      // HEX
      const toHex = (n: number) => n.toString(16).padStart(2, '0')
      const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
      
      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
        r, g, b,
        hex
      }
    }
    
    // -----------------------------------------------------------------------
    // 1. SENSORY DATA (Audio crudo)
    // -----------------------------------------------------------------------
    const sensory = {
      audio: {
        energy: metrics?.energy ?? 0,
        peak: metrics?.peak ?? 0,
        average: analysis?.energy?.average ?? metrics?.energy ?? 0,
        bass: metrics?.bass ?? 0,
        mid: metrics?.mid ?? 0,
        high: metrics?.treble ?? 0,
        spectralCentroid: 0, // TODO: Calcular desde FFT si disponible
        spectralFlux: 0,
        zeroCrossingRate: 0,
      },
      // ?? WAVE 39.1: FFT bins reales desde useAudioCapture (64 bins normalizados)
      // Si tenemos menos de 256, pad con ceros; si tenemos m�s, truncar
      fft: this.lastFftBins.length >= 256 
        ? this.lastFftBins.slice(0, 256) 
        : [...this.lastFftBins, ...new Array(256 - this.lastFftBins.length).fill(0)],
      beat: {
        onBeat: beat?.onBeat ?? false,
        confidence: beat?.confidence ?? 0,
        bpm: beat?.bpm ?? 120,
        beatPhase: beat?.phase ?? 0,
        barPhase: ((beat?.beatCount ?? 0) % 4) / 4,
        timeSinceLastBeat: now - (beat?.lastBeatTime ?? now),
      },
      input: {
        gain: this.inputGain,
        device: this.audioDeviceName,
        active: this.audioActive,
        isClipping: (metrics?.peak ?? 0) > 0.98,
      },
    }
    
    // ?? WAVE 46.0: Trinity Worker Data - Mover ANTES para usarlo en cognitive
    const trinityData = this.lastTrinityData
    
    // -----------------------------------------------------------------------
    // 2. COGNITIVE DATA (Consciencia)
    // -----------------------------------------------------------------------
    // ?? WAVE 47.1.3: Mood arbitrado viene del GAMMA Worker (mind.ts)
    // La arbitraci�n ya se hizo en el Worker con prioridad: genre > harmony > VAD
    const calculatedMood = trinityData?.mood?.primary
    const moodFallback = this.consciousness.currentMood as 'peaceful' | 'energetic' | 'dark' | 'playful' | 'calm' | 'dramatic' | 'euphoric'
    
    const cognitive = {
      mood: calculatedMood ?? moodFallback,
      consciousnessLevel: this.consciousness.beautyScore ?? 0.5,
      evolution: {
        stage: this.consciousness.status as 'awakening' | 'learning' | 'wise',
        totalExperiences: this.consciousness.totalExperiences,
        patternsDiscovered: this.consciousness.totalPatternsDiscovered,
        generation: this.consciousness.generation,
        lineage: this.consciousness.lineage,
      },
      dream: {
        isActive: this.advancedConscious !== null && this.useAdvancedConscious,
        currentType: (this.lastAdvancedState?.lastLightCommand ? 'mood_transition' : null) as 'palette_change' | 'intensity_shift' | 'movement_change' | 'effect_activation' | 'mood_transition' | 'strike_execution' | 'full_scene_change' | null,
        currentThought: this.lastAdvancedState?.consciousness?.lastInsight || this.consciousness.lastInsight,
        projectedBeauty: this.lastAdvancedState?.stats?.averageBeauty ?? brain?.estimatedBeauty ?? 0.5,
        lastRecommendation: (this.lastAdvancedState?.felina?.isHunting ? 'execute' : null) as 'execute' | 'modify' | 'abort' | null,
      },
      zodiac: {
        element: (this.lastZodiacInfo?.sign?.element ?? 'fire') as 'fire' | 'earth' | 'air' | 'water',
        sign: this.lastZodiacInfo?.sign?.symbol ?? '?',
        affinity: this.lastZodiacInfo?.sign?.creativity ?? 0.5,
        quality: (this.lastZodiacInfo?.sign?.quality ?? 'cardinal') as 'cardinal' | 'fixed' | 'mutable',
        description: this.lastZodiacInfo?.sign?.description ?? 'The passionate initiator',
      },
      beauty: {
        current: brain?.estimatedBeauty ?? this.consciousness.beautyScore ?? 0.5,
        average: this.consciousness.beautyScore ?? 0.5,
        max: 1.0,
        components: {
          fibonacciAlignment: 0,
          zodiacResonance: 0,
          musicalHarmony: brain?.confidence ?? 0,
          patternResonance: 0,
          historicalBonus: 0,
        },
      },
      lastInsight: this.consciousness.lastInsight,
      // ?? WAVE 57.5: Active data sources influencing mood/behavior
      activeSources: (() => {
        const sources: string[] = [];
        const moodSources = trinityData?.mood?.sources;
        
        // GENRE: Si el clasificador de g�nero tiene confianza
        if (moodSources?.genre?.confidence && moodSources.genre.confidence > 0.3) {
          sources.push('GENRE');
        }
        
        // HARMONY: Si el analizador arm�nico tiene confianza
        if (moodSources?.harmony?.confidence && moodSources.harmony.confidence > 0.3) {
          sources.push('HARMONY');
        }
        
        // VAD: Siempre activo si hay audio (energ�a > umbral m�nimo)
        if ((metrics?.energy ?? 0) > 0.01) {
          sources.push('VAD');
        }
        
        // ZODIAC: Si hay informaci�n de signo zodiacal activa
        if (this.lastZodiacInfo?.sign) {
          sources.push('ZODIAC');
        }
        
        // SECTION: Si el tracker de secci�n tiene confianza
        if (trinityData?.sectionDetail?.confidence && trinityData.sectionDetail.confidence > 0.5) {
          sources.push('SECTION');
        }
        
        // STRATEGY: Si StrategyArbiter tiene estrategia no-default
        if (trinityData?.mood?.colorStrategy?.stable && trinityData.mood.colorStrategy.stable !== 'analogous') {
          sources.push('STRATEGY');
        }
        
        return sources;
      })(),
      
      // ??? WAVE 66: Vibe Context from VibeManager
      vibe: {
        active: trinityData?.activeVibe ?? trinityData?.debugInfo?.activeVibe ?? 'idle',
        transitioning: trinityData?.vibeTransitioning ?? trinityData?.debugInfo?.vibeTransitioning ?? false
      },
      
      // ?? WAVE 66 + 72: Stabilized Emotion from MoodArbiter
      // ??? WAVE 72: Fallback consciente del Vibe activo - evita NEUTRAL gen�rico
      stableEmotion: (trinityData?.mood?.stableEmotion ?? 
                      this.getSafeFallbackForVibe(trinityData?.activeVibe ?? trinityData?.debugInfo?.activeVibe ?? 'idle')
                     ) as 'BRIGHT' | 'DARK' | 'NEUTRAL',
      
      // ??? WAVE 66: Thermal Temperature in Kelvin
      thermalTemperature: trinityData?.mood?.thermalTemperature ?? 4500,
      
      // ?? WAVE 68: Drop State Machine Status - FIX: dropState es objeto {state, framesInState, isActive}
      // EnergyStabilizer.getDropState() devuelve objeto, no string
      dropState: {
        state: (trinityData?.drop?.dropState?.state ?? 'IDLE') as 'IDLE' | 'ATTACK' | 'SUSTAIN' | 'RELEASE' | 'COOLDOWN',
        isActive: trinityData?.drop?.isDropActive === true && 
                  trinityData?.drop?.dropState?.state === 'SUSTAIN'
      }
    }
    
    // -----------------------------------------------------------------------
    // 3. MUSICAL DNA (An�lisis musical profundo)
    // -----------------------------------------------------------------------
    const context = brain?.context
    
    // ?? WAVE 46.0: trinityData ya declarado arriba (l�nea 1446) para uso en cognitive
    // El Worker (GAMMA) tiene g�nero/key/syncopation correctos
    
    // Extraer syncopation de la estructura real: context.rhythm.groove.syncopation
    // WAVE 46.0: Priorizar Trinity data
    const syncopationValue = trinityData?.syncopation ?? context?.rhythm?.groove?.syncopation ?? 0
    
    // Extraer pattern type de la estructura real: context.rhythm.pattern.type
    const patternType = context?.rhythm?.pattern?.type ?? 'unknown'
    
    // Extraer section intensity de la estructura real: context.section.intensity
    const sectionIntensity = context?.section?.intensity ?? metrics?.energy ?? 0
    
    // Calcular bars aproximados desde duration
    const sectionBars = context?.section?.current 
      ? Math.floor((Date.now() - context.section.current.startedAt) / (60000 / (beat?.bpm ?? 120)) / 4)
      : 0
    
    const musicalDNA = {
      // ?? WAVE 46.0: Priorizar Trinity data para key
      key: trinityData?.key ?? context?.harmony?.key ?? null,
      mode: {
        // ?? WAVE 46.0: Usar mode de Trinity si disponible
        scale: ((trinityData?.mode === 'minor' ? 'minor' : trinityData?.mode === 'major' ? 'major' : context?.harmony?.mode?.scale) ?? 'major') as 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'harmonic_minor' | 'melodic_minor' | 'pentatonic_major' | 'pentatonic_minor' | 'blues' | 'chromatic',
        mood: (context?.harmony?.mode?.mood ?? 'universal') as 'happy' | 'sad' | 'jazzy' | 'spanish_exotic' | 'dreamy' | 'bluesy' | 'tense' | 'universal',
        confidence: context?.harmony?.confidence ?? (trinityData ? 0.8 : 0),
      },
      genre: {
        // ?? WAVE 69.3: Genre detection REMOVED - Now using VIBE-only system
        // macroGenre is no longer calculated in backend
        primary: 'UNKNOWN' as 'ELECTRONIC_4X4' | 'ELECTRONIC_BREAK' | 'LATINO_TRADICIONAL' | 'LATINO_URBANO' | 'ROCK_POP' | 'JAZZ_SOUL' | 'AMBIENT_CHILL' | 'UNKNOWN',
        subGenre: null,
        confidence: 0,
        distribution: {},
      },
      rhythm: {
        bpm: beat?.bpm ?? 120,
        confidence: context?.rhythm?.confidence ?? beat?.confidence ?? 0,
        syncopation: syncopationValue,
        syncopationSmoothed: syncopationValue, // Use same value, smoothing applied upstream
        swing: context?.rhythm?.groove?.swingAmount ?? 0,
        complexity: (context?.rhythm?.groove?.complexity ?? 'medium') as 'low' | 'medium' | 'high',
        pattern: patternType as 'four_on_floor' | 'breakbeat' | 'half_time' | 'reggaeton' | 'cumbia' | 'rock_standard' | 'jazz_swing' | 'latin' | 'minimal' | 'unknown',
      },
      section: {
        // ?? WAVE 47.3: SECTION STABILITY - Hist�resis para evitar flicker de 10 cambios/segundo
        // ?? WAVE 57.5: DROP STATE MACHINE OVERRIDE - Si isDropActive, FORZAR 'drop'
        // Solo cambiar secci�n si: 1) confidence > 0.8, 2) distinta a actual, 3) han pasado >3 segundos
        current: (() => {
          // ?? WAVE 57.5: DROP STATE MACHINE tiene PRIORIDAD ABSOLUTA
          const isDropActive = trinityData?.drop?.isDropActive === true;
          if (isDropActive) {
            return 'drop' as const;
          }
          
          const rawSection = trinityData?.sectionDetail?.type ?? context?.section?.current?.type ?? 'unknown'
          const rawConfidence = trinityData?.sectionDetail?.confidence ?? context?.section?.current?.confidence ?? 0
          const timeSinceLastChange = now - this.lastStableSection.timestamp
          const MIN_SECTION_DURATION = 3000 // 3 segundos m�nimo por secci�n
          
          // Si la secci�n es diferente Y tiene alta confianza Y ha pasado suficiente tiempo ? cambiar
          if (rawSection !== this.lastStableSection.type && rawConfidence > 0.8 && timeSinceLastChange > MIN_SECTION_DURATION) {
            this.lastStableSection = {
              type: rawSection,
              timestamp: now,
              confidence: rawConfidence
            }
          }
          
          return this.lastStableSection.type as 'intro' | 'verse' | 'chorus' | 'bridge' | 'breakdown' | 'drop' | 'buildup' | 'outro' | 'transition' | 'unknown'
        })(),
        energy: trinityData?.sectionDetail?.energy ?? sectionIntensity,
        barsInSection: sectionBars,
        confidence: trinityData?.sectionDetail?.confidence ?? context?.section?.current?.confidence ?? 0,
      },
      prediction: {
        nextSection: {
          type: context?.section?.predicted?.type ?? 'unknown',
          probability: context?.section?.predicted?.probability ?? 0,
          barsUntil: context?.section?.predicted?.estimatedIn 
            ? Math.floor(context.section.predicted.estimatedIn / (60000 / (beat?.bpm ?? 120)) / 4)
            : 0,
        },
        dropPrediction: {
          isImminent: false,
          barsUntil: 0,
          probability: 0,
        },
        huntStatus: {
          // Mapear estados de HuntOrchestrator a los esperados por MusicalDNAData
          phase: (() => {
            const huntPhase = this.lastHuntResult?.actionType ?? 'idle'
            const phaseMap: Record<string, 'locked' | 'idle' | 'stalking' | 'striking' | 'tracking'> = {
              'idle': 'idle',
              'stalking': 'stalking',
              'evaluating': 'tracking',
              'striking': 'striking',
              'learning': 'locked',
              'completed': 'locked',
              'aborted': 'idle',
            }
            return phaseMap[huntPhase] ?? 'idle'
          })(),
          lockPercentage: this.lastHuntResult?.details?.confidence ?? 0,
          targetType: this.lastHuntResult?.details?.targetPrey ?? null,
        },
      },
      harmony: {
        chordRoot: context?.harmony?.key ?? null,
        chordQuality: null,
        confidence: context?.harmony?.confidence ?? 0,
      },
    }
    
    // -----------------------------------------------------------------------
    // 4. VISUAL DECISION (Colores y Movimiento)
    // -----------------------------------------------------------------------
    const colors = this.lastColors
    const palette = brain?.palette
    
    // Crear paleta unificada (RGB + HSL + HEX)
    const defaultColor = toUnifiedColor({ r: 128, g: 128, b: 128 })
    
    const visualDecision = {
      palette: {
        primary: colors?.primary ? toUnifiedColor(colors.primary) : defaultColor,
        secondary: colors?.secondary ? toUnifiedColor(colors.secondary) : defaultColor,
        accent: colors?.accent ? toUnifiedColor(colors.accent) : defaultColor,
        ambient: colors?.ambient ? toUnifiedColor(colors.ambient) : defaultColor,
        contrast: palette?.contrast ? toUnifiedColor(this.hslToRgb(palette.contrast)) : defaultColor,
        // ?? WAVE 89: Fix STRATEGY TYPE - Incluir todos los valores posibles de ColorStrategy
        strategy: (trinityData?.mood?.colorStrategy?.stable ?? 'analogous') as 'analogous' | 'triadic' | 'complementary' | 'split-complementary' | 'monochromatic',
        // ?? WAVE 134: Label visual para la UI (nombre amigable de la estrategia)
        strategyLabel: this.getStrategyLabel(trinityData?.activeVibe, trinityData?.mood?.colorStrategy?.stable),
        // ??? WAVE 69.3: Leer temperature y description desde trinityData (Worker)
        temperature: (trinityData?.temperature ?? brain?.debugInfo?.temperature ?? 'neutral') as 'warm' | 'cool' | 'neutral',
        description: trinityData?.description ?? brain?.debugInfo?.description ?? `Palette: ${this.currentPalette}`,
        // ?? WAVE 69.3: Source = 'procedural' si tenemos palette del Worker (lastColors actualizado)
        source: (trinityData?.strategy ? 'procedural' : brain?.paletteSource ?? 'fallback') as 'procedural' | 'memory' | 'fallback',
      },
      intensity: this.globalIntensity,
      saturation: this.globalSaturation,
      movement: {
        pan: movement?.pan ?? 127,
        tilt: movement?.tilt ?? 127,
        speed: movement?.speed ?? 0.5,
        patternName: movement?.pattern ?? 'static',
        physicsActive: false, // TODO: Conectar con FixturePhysicsDriver
        physics: null,
      },
      effects: {
        // ⚡ WAVE 148: Estado real del strobe desde Physics Module
        strobe: { active: this.lastStrobeActive, rate: this.lastStrobeActive ? 20 : 0, intensity: this.lastStrobeActive ? 1.0 : 0 },
        fog: { active: false, density: 0 },
        laser: { active: false, pattern: '', color: null },
        beam: { active: false, width: 0 },
        prism: { active: false, facets: 0 },
        blackout: false,
      },
    }
    
    // -----------------------------------------------------------------------
    // 5. HARDWARE STATE (DMX - placeholder, se llenará en main.ts)
    // -----------------------------------------------------------------------
    const hardwareState = {
      dmxOutput: new Array(512).fill(0),
      fixturesActive: 0,
      fixturesTotal: 0,
      fixtures: [],
      dmx: {
        connected: false,
        driver: 'universal',
        universe: 1,
        frameRate: 40,
        lastUpdate: now,
      },
    }
    
    // -----------------------------------------------------------------------
    // 6. SYSTEM METADATA
    // -----------------------------------------------------------------------
    // ?? WAVE 39.9.2: brainStatus ahora muestra el MOOD actual (no el fantasma reactive/intelligent)
    const currentMood = this.consciousness.currentMood || 'peaceful'
    const system = {
      frameNumber: this.frameCount,
      timestamp: now,
      deltaTime,
      targetFPS: 30,
      actualFPS: this.fpsCounter.currentFPS,
      mode: this.mode as 'selene' | 'flow' | 'manual',
      brainStatus: currentMood as 'peaceful' | 'energetic' | 'dark' | 'playful' | 'calm' | 'dramatic' | 'euphoric',
      uptime: Math.floor((now - this.startTime) / 1000),
      performance: {
        audioProcessingMs: 0,
        brainProcessingMs: brain?.performance?.totalMs ?? 0,
        colorEngineMs: brain?.performance?.paletteMs ?? 0,
        dmxOutputMs: 0,
        totalFrameMs: deltaTime,
      },
      workers: {
        alpha: { healthy: true, lastHeartbeat: now },
        beta: { healthy: true, lastHeartbeat: now },
        gamma: { healthy: true, lastHeartbeat: now },
      },
      sessionId: this.sessionId,
      version: '25.0.0',
    }
    
    this.lastFrameTime = now
    
    return {
      sensory,
      cognitive,
      musicalDNA,
      visualDecision,
      hardwareState,
      system,
    }
  }
  
  /**
   * ?? WAVE 25: Actualiza el estado de audio (para tracking en broadcast)
   */
  setAudioState(metrics: AudioMetrics, analysis: AudioAnalysis | null, deviceName?: string): void {
    this.lastAudioMetrics = metrics
    this.lastAudioAnalysis = analysis
    if (deviceName) this.audioDeviceName = deviceName
    this.audioActive = metrics.energy > 0.02
  }
  
  /**
   * ?? WAVE 39.9.2: Cierra limpiamente Selene (Brain vive en Worker)
   */
  async shutdown(): Promise<void> {
    this.running = false
    
    // ?? WAVE 39.9.2: Brain lives in Worker, nothing to shutdown here
    this.brainInitialized = false
    
    console.info('[SeleneLux] ? WAVE 39.9.2: Shutdown complete (brain is in Worker)')
    this.emit('shutdown')
  }
}
