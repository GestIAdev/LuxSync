/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🌙 SELENE LUX - CLASE MAESTRA
 * "La Consciencia Lumínica que Orquesta Todo"
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE-8 FASE 8: Integración Nuclear
 * 
 * El flujo ahora es:
 *   AUDIO → BRAIN → HARD      // 🛡️ WAVE 24.5.1: ANTI-FLICKER OUTPUT GUARD
      // Si detectamos NaN, mantenemos el color anterior en vez de negro
      const isInvalid = (n: number) => !Number.isFinite(n) || isNaN(n)
      
      if (isInvalid(freshRgbValues.primary.r) || isInvalid(freshRgbValues.primary.g)) {
        // Solo loguear ocasionalmente para no saturar
        if (this.frameCount % 120 === 0) {
          console.warn(`[SeleneLux] ⚠️ NaN detected! Holding previous color. E=${metrics.energy.toFixed(4)}`)
        }
        // ANTI-FLICKER: Mantener el último color válido en vez de apagar
        freshRgbValues.primary = this.lastColors.primary
        freshRgbValues.secondary = this.lastColors.secondary
        freshRgbValues.accent = this.lastColors.accent
        freshRgbValues.ambient = this.lastColors.ambient
      }l SeleneMusicalBrain unifica:
 * - Análisis musical contextual
 * - Memoria de patrones exitosos
 * - Generación procedural de paletas
 * - Mapeo música → luz
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
// 🧠 WAVE-8: El Cerebro Musical
import { 
  SeleneMusicalBrain, 
  getMusicalBrain,
  type BrainOutput,
  type BrainConfig,
} from './engines/musical'
import type { AudioAnalysis } from './engines/musical/types'
// 🎨 WAVE 24.4: Motor de Color Procedural + Helper de conversión HSL→RGB
// 🔥 WAVE 24.9: Añadir rgbToHsl para sincronizar Flow Mode palette
// 🌙 WAVE 37.0: Import SelenePalette type para Brain Transplant
// 🎨 WAVE 49: Import SeleneColorInterpolator para transiciones suaves
import { SeleneColorEngine, SeleneColorInterpolator, paletteToRgb, rgbToHsl, type SelenePalette } from './engines/visual/SeleneColorEngine'
// 📡 WAVE-14: Telemetry Collector
import { 
  SeleneTelemetryCollector, 
  getTelemetryCollector,
  type SeleneTelemetryPacket,
} from './engines/telemetry/SeleneTelemetryCollector'
// 🌙 WAVE 37.0: Meta-Consciencia Avanzada (Resurrección de Motores)
import { 
  SeleneLuxConscious,
  type SeleneLuxConsciousState,
} from './engines/consciousness/SeleneLuxConscious'
// 🐅 WAVE 39.0: HuntOrchestrator + ZodiacAffinity (Engine Wiring)
import { 
  HuntOrchestrator,
  type HuntFrameResult,
  type HuntStatus,
} from './engines/consciousness/HuntOrchestrator'
import { 
  ZodiacAffinityCalculator,
  type ZodiacInfo,
} from './engines/consciousness/ZodiacAffinityCalculator'
// 🌙 WAVE-25: Universal Truth Protocol
import {
  type SeleneBroadcast,
  type UnifiedColor,
  createDefaultBroadcast,
} from '../../types/SeleneProtocol'

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
  // 🧠 WAVE-8: Configuración del Brain
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
  // 🧠 WAVE-8: Información del Brain
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
  
  // � WAVE 39.9.2: GHOST BRAIN ELIMINATED
  // El Brain ahora vive SOLO en Trinity Worker - Main Process no piensa
  // Mantenemos la propiedad para compatibilidad de API pero NUNCA se inicializa
  private brain!: SeleneMusicalBrain  // Non-null assertion - nunca se usa
  private useBrain = false // 🪓 WAVE 39.9.2: DESACTIVADO - Brain lives in Worker
  private brainInitialized = false
  
  // 📡 WAVE-14: Telemetry Collector
  private telemetryCollector: SeleneTelemetryCollector
  private inputGain = 1.0 // From audio settings
  
  // � WAVE 37.0: Meta-Consciencia Avanzada (DreamForge + SelfAnalysis)
  private advancedConscious: SeleneLuxConscious | null = null
  private lastAdvancedState: SeleneLuxConsciousState | null = null
  private useAdvancedConscious = true // Flag para activar meta-consciencia

  // 🐅 WAVE 39.0: HuntOrchestrator + ZodiacAffinity (Engine Wiring)
  private huntOrchestrator: HuntOrchestrator | null = null
  private lastHuntResult: HuntFrameResult | null = null
  private lastZodiacInfo: ZodiacInfo | null = null
  private currentZodiacPosition: number = 0
  private lastFftBins: number[] = new Array(256).fill(0)
  
  // �🎨 WAVE 13.6: Multiplicadores Globales de Color (STATE OF TRUTH)
  private globalSaturation = 1.0  // 0-1, default 100%
  private globalIntensity = 1.0   // 0-1, default 100%
  
  private currentPalette: LivingPaletteId = 'fuego'
  private currentPattern: MusicalPattern | null = null
  private consciousness: ConsciousnessState
  
  // 🔥 WAVE 24.11: ARCHITECTURAL FIX - Initialize with VALID colors (not null/black)
  // Previene blackout anómalo en primer frame cuando ColorEngine aún no generó output
  private lastColors: ColorOutput = {
    primary: { r: 150, g: 50, b: 50 },    // Rojo cálido (Fuego default)
    secondary: { r: 200, g: 100, b: 50 }, // Naranja
    accent: { r: 255, g: 150, b: 0 },     // Amarillo
    ambient: { r: 255, g: 100, b: 50 },   // Naranja brillante
    intensity: 0.5,
    saturation: 0.8,
  }
  
  // 🎨 WAVE 49: COLOR INTERPOLATOR - Transiciones suaves (anti-epilepsia)
  private colorInterpolator: SeleneColorInterpolator = new SeleneColorInterpolator()
  
  private lastMovement: MovementOutput | null = null
  private lastBeat: BeatState | null = null
  private lastBrainOutput: BrainOutput | null = null
  
  // 📡 WAVE 46.0 → 47.2: DATA BRIDGE - Recibe datos de Trinity Worker
  // El Worker (GAMMA) tiene el género, key, syncopation real
  // Este es el puente que conecta Worker → getBroadcast() → UI
  // WAVE 47.2: Ahora incluye mood (MoodSynthesizer) y sectionDetail (SectionTracker)
  private lastTrinityData: {
    macroGenre?: string
    key?: string | null
    mode?: string
    syncopation?: number
    strategy?: string
    temperature?: string
    description?: string
    timestamp: number
    mood?: any  // 💫 WAVE 47.2: MoodSynthesizer output (copado directo del spread)
    sectionDetail?: any  // 💫 WAVE 47.2: SectionTracker output (copado directo del spread)
    debugInfo?: {
      mood?: any
      sectionDetail?: any
    }
  } | null = null
  
  // 💫 WAVE 47.3: SECTION STABILITY - Histéresis para evitar flicker
  private lastStableSection: { type: string; timestamp: number; confidence: number } = {
    type: 'unknown',
    timestamp: Date.now(),
    confidence: 0
  }
  
  // 🌙 WAVE-25: Tracking para Universal Truth Broadcast
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
    
    // � WAVE 39.9.2: BRAIN ELIMINATED FROM MAIN PROCESS
    // El Brain SOLO vive en Trinity Worker para evitar:
    // - Doble instancia = doble RAM
    // - Conflictos de bloqueo SQLite
    // this.brain = getMusicalBrain(config.brain)
    // this.setupBrainEventListeners()
    console.info('[SeleneLux] 🪓 WAVE 39.9.2: Brain lives in Trinity Worker (not here)')
    
    // 📡 WAVE-14: Inicializar Telemetry Collector (20 FPS)
    this.telemetryCollector = getTelemetryCollector(20)
    
    // 🌙 WAVE 37.0: Inicializar Meta-Consciencia Avanzada
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
        console.info('[SeleneLux] 🌙 WAVE 37.0: Meta-Consciencia activada (DreamForge + SelfAnalysis)')
      } catch (err) {
        console.warn('[SeleneLux] ⚠️ Meta-Consciencia no pudo inicializar:', err)
        this.useAdvancedConscious = false
      }
    }
    
    // 🐅 WAVE 39.0: Inicializar HuntOrchestrator (El Cazador)
    try {
      this.huntOrchestrator = new HuntOrchestrator()
      console.info('[SeleneLux] 🐅 WAVE 39.0: HuntOrchestrator activado (El Cazador)')
    } catch (err) {
      console.warn('[SeleneLux] ⚠️ HuntOrchestrator no pudo inicializar:', err)
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
    
    console.info('[SeleneLux] 🪓 WAVE 39.9.2: Initialized (Brain lives in Worker)')
    this.emit('ready')
    
    // 🪓 WAVE 39.9.2: Brain auto-init REMOVED
    // El cerebro vive exclusivamente en Trinity Worker
    // if (this.mode === 'selene') {
    //   this.initializeBrain().catch(...)
    // }
  }
  
  /**
   * 🧠 Configura listeners de eventos del Brain
   * 🪓 WAVE 39.9.3: Agregado early-return guard - brain vive en Worker
   */
  private setupBrainEventListeners(): void {
    // 🪓 WAVE 39.9.3: Guard para prevenir crash si brain no existe
    if (!this.brain) {
      console.info('[SeleneLux] 🪓 setupBrainEventListeners() skipped (no local brain)')
      return
    }
    
    this.brain.on('output', (output: BrainOutput) => {
      this.emit('brain-output', output)
    })
    
    this.brain.on('pattern-learned', (data) => {
      this.consciousness.totalPatternsDiscovered++
      this.consciousness.lastInsight = `Aprendí un nuevo patrón: ${data.patternHash?.slice(0, 8)}`
      this.emit('pattern-learned', data)
      
      // � WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Brain', `Nuevo patrón aprendido: ${data.emotionalTone}`, { 
        patternHash: data.patternHash, 
        beauty: data.avgBeautyScore 
      })
      
      // �📡 WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'MEMORY',
        `📚 Nuevo patrón aprendido: ${data.emotionalTone} (Beauty: ${(data.avgBeautyScore * 100).toFixed(0)}%)`,
        'success',
        { patternHash: data.patternHash, beauty: data.avgBeautyScore }
      )
      this.telemetryCollector.recordPatternLearned()
    })
    
    this.brain.on('mode-change', (data) => {
      this.emit('brain-mode-change', data)
      
      // � WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Mode', `Cambio de modo: ${data.from} → ${data.to}`, { reason: data.reason })
      
      // �📡 WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'MODE',
        `🔄 Cambio de modo: ${data.from} → ${data.to} (${data.reason})`,
        'info',
        data
      )
    })
    
    this.brain.on('section-change', (data) => {
      this.emit('section-change', data)
      
      // � WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Music', `Nueva sección: ${data.to}`, { 
        from: data.from, 
        confidence: data.confidence 
      })
      
      // �📡 WAVE-14.5: Log to telemetry
      this.telemetryCollector.addLog(
        'SECTION',
        `🎵 Nueva sección: ${data.to} (Confianza: ${(data.confidence * 100).toFixed(0)}%)`,
        'info',
        data
      )
    })
    
    // 📡 WAVE-14.5: Capturar generación de paletas
    this.brain.on('palette-generated', (data: any) => {
      // 📜 WAVE 25.7: Emit to dedicated log channel
      this.emitLog('Visual', `Paleta generada: ${data.source}`, { colors: data.colors?.length || 0 })
      
      this.telemetryCollector.addLog(
        'PALETTE',
        `🎨 Paleta generada: ${data.source} - ${data.colors?.length || 0} colores`,
        'info',
        { source: data.source, colors: data.colors }
      )
    })
  }
  
  /**
   * � WAVE 39.9.2: initializeBrain es ahora NO-OP
   * El Brain vive exclusivamente en Trinity Worker
   * Mantenido para compatibilidad de API
   */
  async initializeBrain(_dbPath?: string): Promise<void> {
    // 🪓 WAVE 39.9.2: Brain lives in Worker - this is just a compatibility stub
    console.info('[SeleneLux] 🪓 initializeBrain() is no-op (brain lives in Worker)')
    this.brainInitialized = true // Mark ready for compatibility
    this.consciousness.status = 'wise'
    this.consciousness.lastInsight = 'Conectado a Trinity Worker.'
    this.emit('brain-ready')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 📜 WAVE 25.7: THE CHRONICLER - Centralized Log Emission
  // ═══════════════════════════════════════════════════════════════════════════
  
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
   * ═══════════════════════════════════════════════════════════════════════════
   * 🎯 PROCESO PRINCIPAL - Audio → Brain → Hardware
   * ═══════════════════════════════════════════════════════════════════════════
   */
  processAudioFrame(metrics: AudioMetrics, deltaTime: number): SeleneState {
    this.frameCount++
    this.emit('audio-frame', metrics)
    
    // Siempre procesar beat para compatibilidad
    const beatState = this.beatDetector.process(metrics)
    this.lastBeat = beatState
    
    // ─────────────────────────────────────────────────────────────────────────
    // 🧠 WAVE-8: FLUJO PRINCIPAL - Audio → Brain → Hardware
    // 🧠 WAVE 39.9.3: Agregado guard `this.brain` para prevenir crash
    // Desde WAVE 39.9.2 useBrain=false, así que este bloque NUNCA se ejecuta
    // ─────────────────────────────────────────────────────────────────────────
    if (this.useBrain && this.brainInitialized && this.brain) {
      // Convertir AudioMetrics a AudioAnalysis para el Brain
      const audioAnalysis = this.convertToAudioAnalysis(metrics, beatState)
      
      // 1️⃣ PRIMERO: EJECUTAR EL CEREBRO PARA SABER QUÉ SUENA
      // Necesitamos el género real antes de calcular el color
      const brainOutput = this.brain.process(audioAnalysis)
      this.lastBrainOutput = brainOutput
      
      // �️ WAVE 24.3: EXTRAER GÉNERO REAL (Desde el contexto del cerebro)
      // Usamos context.genre.primary que es donde vive realmente
      const realGenre = brainOutput.context?.genre?.primary || 
                        (brainOutput.debugInfo as any)?.macroGenre || 
                        'ELECTROLATINO'
      
      // 2️⃣ SEGUNDO: PREPARAR DATOS SEGUROS (FIX DE TIPOS WAVE 24.3)
      // 🔥 WAVE 24.1: DATA SANITIZATION (NaN Prevention)
      // 🔥 WAVE 24.3: TYPE ALIGNMENT (Corregir estructura de datos)
      // PROBLEMA 1: El proceso Main no tiene los datos complejos (Wave 8) que tienen los workers.
      //   → audioAnalysis.wave8 puede ser undefined
      //   → SeleneColorEngine intenta acceder a propiedades que no existen
      // PROBLEMA 2: SeleneColorEngine espera energy como NUMBER (top-level), no como objeto
      //   → audioAnalysis.energy puede ser objeto {current, peak, ...}
      //   → Matemáticas usan energy directamente → undefined → NaN
      // PROBLEMA 3: SeleneColorEngine espera genre.primary, no genre.genre
      //   → Estructura incorrecta → no encuentra género → fallback
      // SOLUCIÓN: Crear 'safeAnalysis' con estructura correcta + defaults
      //   → Inyectar mock data (Wave 8 mínimo)
      //   → energy como NUMBER top-level
      //   → genre.primary en lugar de genre.genre
      //   → Verificar salida con isInvalid()
      //   → Fallback a Negro si hay NaN (seguridad)
      
      const safeAnalysis = {
        ...audioAnalysis,
        
        // 🔥 FIX CRÍTICO 1: ENERGY DEBE SER NÚMERO (TOP-LEVEL)
        // El engine espera .energy como number, no como objeto.
        energy: metrics.energy,
        
        wave8: {
          rhythm: {
            syncopation: 0,
            confidence: 1,
            // activity no es crítico, syncopation sí
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
            // 🔥 FIX CRÍTICO 2: USAR PROPIEDAD 'primary'
            primary: realGenre,  // ELECTRONIC_4X4, LATINO_TRADICIONAL, etc.
            confidence: 1
          }
        }
      }
      
      // 🔥 WAVE 24.4: GENERAR HSL PRIMERO (Para la UI)
      // 🌙 WAVE 37.0: RESPETAR DECISIONES DEL BRAIN - Detener Lobotomía
      // Si el Brain tiene una paleta desde memoria (experiencias exitosas),
      // la respetamos en lugar de sobrescribirla con ColorEngine procedural.
      
      let finalHslPalette: SelenePalette
      let finalPaletteSource = brainOutput.paletteSource
      
      // El Brain YA viene con una paleta. Verificamos si es de memoria.
      const brainHasMemoryPalette = brainOutput.paletteSource === 'memory' && brainOutput.palette?.primary
      
      if (brainHasMemoryPalette) {
        // 🧠 WAVE 37.0: BRAIN RESPECTED - Usar paleta de memoria
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
        // 🎨 WAVE 49: COLOR INTERPOLATION - Transiciones suaves anti-epilepsia
        // WAVE 55: Usar DROP confirmado (override) en lugar de section bruta
        // Solo transición rápida si StrategyArbiter confirmó DROP con energía relativa
        const currentSection = this.lastTrinityData?.sectionDetail?.type || 'unknown'
        const colorStrategy = (this.lastTrinityData as any)?.mood?.colorStrategy
        const isConfirmedDrop = colorStrategy?.sectionOverride === 'drop'
        
        // isDrop = true solo si el StrategyArbiter lo confirmó con energía relativa
        const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy)
        
        // Usar interpolador en lugar de generar directamente
        finalHslPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop)
        finalPaletteSource = 'procedural'
      }
      
      // 🎨 WAVE 24.4: CONVERTIR A RGB (Para los Focos/DMX)
      // Usamos el helper del motor para obtener los valores físicos
      const freshRgbValues = paletteToRgb(finalHslPalette)
      
      // �🛡️ WAVE 24.1: OUTPUT GUARD (Red de Seguridad Final)
      // Verificamos matemáticamente que no haya NaN. Si hay, fallback a Negro.
      const isInvalid = (n: number) => !Number.isFinite(n) || isNaN(n)
      
      if (isInvalid(freshRgbValues.primary.r) || isInvalid(freshRgbValues.primary.g)) {
        // Solo loguear ocasionalmente para no saturar
        if (this.frameCount % 120 === 0) {
          console.warn(`[SeleneLux] ⚠️ NaN detected in RGB! Metrics: E=${metrics.energy.toFixed(4)}`)
        }
        const safeColor = { r: 0, g: 0, b: 0 }
        freshRgbValues.primary = safeColor
        freshRgbValues.secondary = safeColor
        freshRgbValues.accent = safeColor
        freshRgbValues.ambient = safeColor
      }
      
      // 2. Calcular intensidad (manteniendo lógica existente)
      const baseIntensity = audioAnalysis.energy.current
      const intensity = Math.min(1, baseIntensity * this.globalIntensity)
      
      // 3️⃣ WAVE 37.0: INYECTAR PALETA FINAL EN BRAIN OUTPUT
      // 🌙 Si viene de memoria, ya tiene los valores correctos
      // 🎨 Si es procedural, usamos lo generado por ColorEngine
      brainOutput.palette = {
        primary: finalHslPalette.primary,
        secondary: finalHslPalette.secondary,
        accent: finalHslPalette.accent,
        ambient: finalHslPalette.ambient,
        contrast: finalHslPalette.contrast,
        strategy: finalHslPalette.meta?.strategy || 'unknown',
      }
      brainOutput.paletteSource = finalPaletteSource as 'memory' | 'procedural' | 'fallback'
      
      // 4️⃣ WAVE 24.4: ASIGNAR RGB A HARDWARE (Fix DMX/Canvas)
      this.lastColors = {
        primary: freshRgbValues.primary,       // RGB Correcto {r,g,b}
        secondary: freshRgbValues.secondary,   // RGB Correcto
        accent: freshRgbValues.accent,         // RGB Correcto
        ambient: freshRgbValues.ambient,       // RGB Correcto
        intensity: isInvalid(intensity) ? 0 : intensity,  // Protección extra
        saturation: this.globalSaturation       // State of Truth
      }
      
      // 🔇 WAVE 37.0: Silenciado - log WAVE24.4 DUAL removido para consola limpia
      // Si necesitas debug, descomentar:
      // if (this.frameCount % 100 === 0) {
      //   const hsl = finalHslPalette.primary
      //   const rgb = this.lastColors.primary
      //   console.log(`[SeleneLux] HSL=${Math.round(hsl.h)}°,${Math.round(hsl.s)}%,${Math.round(hsl.l)}% | RGB=${rgb.r},${rgb.g},${rgb.b}`)
      // }
      
      // El movimiento viene de la sugerencia del Brain
      this.lastMovement = this.brainOutputToMovement(brainOutput, deltaTime)
      
      // Actualizar consciencia con datos del Brain
      this.consciousness.beautyScore = brainOutput.estimatedBeauty
      this.consciousness.totalExperiences++
      
      // 🌙 WAVE 37.0: Procesar con Meta-Consciencia Avanzada
      // DreamForge simula escenarios futuros, SelfAnalysis detecta sesgos
      if (this.advancedConscious && this.useAdvancedConscious) {
        try {
          this.lastAdvancedState = this.advancedConscious.processAudioFrame(metrics, deltaTime)
          
          // Enriquecer consciencia básica con insights de la meta-consciencia
          if (this.lastAdvancedState.consciousness.lastInsight) {
            this.consciousness.lastInsight = this.lastAdvancedState.consciousness.lastInsight
          }
          if (this.lastAdvancedState.consciousness.mood) {
            // Sincronizar mood (emotional tone) desde la meta-consciencia
            // Cast seguro: EmotionalTone tiene más variantes en meta-consciencia
            const advMood = this.lastAdvancedState.consciousness.mood as string
            const validMoods = ['peaceful', 'energetic', 'dark', 'playful', 'calm', 'dramatic', 'euphoric', 'melancholic', 'aggressive']
            if (validMoods.includes(advMood)) {
              this.consciousness.currentMood = advMood as any
            }
          }
        } catch (err) {
          // Silenciar errores de meta-consciencia para no afectar flujo principal
          if (this.frameCount % 300 === 0) {
            console.warn('[SeleneLux] ⚠️ Meta-consciencia error (silenciado):', err)
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
      // ✨ WAVE 39.0: Actualizar ZodiacInfo cada ~5 segundos
      if (this.frameCount % 150 === 0) {
        try {
          this.currentZodiacPosition = ZodiacAffinityCalculator.calculateZodiacPosition(Date.now())
          this.lastZodiacInfo = ZodiacAffinityCalculator.getZodiacInfo(this.currentZodiacPosition)
        } catch (err) {
          // Silenciar errores de zodiac
        }
      }
      
      // �🔥 WAVE 23.4: Esta condición nunca se cumple (paletteSource siempre 'procedural' tras lobotomía)
      // 🔥 WAVE 24.11: Added 'as any' cast to silence TS warning
      // Mantenido para compatibilidad pero inactivo
      if (brainOutput.mode === 'intelligent' && (brainOutput.paletteSource as any) === 'memory') {
        this.decisionCount++ // Usó su experiencia (NUNCA ocurre tras WAVE 23.4)
      }
    } else {
      // ─────────────────────────────────────────────────────────────────────
      // LEGACY: Modo sin Brain (FLOW/reactive mode)
      // ─────────────────────────────────────────────────────────────────────
      
      // 🛡️ WAVE 24.6: Validar métricas antes de generar colores
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
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🛡️ WAVE 24.8: HARDENING - Sanitize helper para asegurar RGB válido
      // Doble barrera: Primero sanitize, luego HOLD si aún hay problemas
      // ═══════════════════════════════════════════════════════════════════════
      const sanitize = (c: { r: number; g: number; b: number }): { r: number; g: number; b: number } => ({
        r: Number.isFinite(c.r) ? Math.round(Math.max(0, Math.min(255, c.r))) : 0,
        g: Number.isFinite(c.g) ? Math.round(Math.max(0, Math.min(255, c.g))) : 0,
        b: Number.isFinite(c.b) ? Math.round(Math.max(0, Math.min(255, c.b))) : 0,
      })
      
      // Sanitize TODOS los colores antes de aplicar multiplicadores
      const sanitizedPrimary = sanitize(colors.primary)
      const sanitizedSecondary = sanitize(colors.secondary)
      const sanitizedAccent = sanitize(colors.accent)
      const sanitizedAmbient = sanitize(colors.ambient)
      
      // 🛡️ WAVE 24.6: Output Guard - Validar colores antes de asignar
      // Si ColorEngine retorna NaN, mantenemos el último color válido (HOLD pattern)
      const isValidColor = (c: { r: number; g: number; b: number }) => 
        Number.isFinite(c.r) && Number.isFinite(c.g) && Number.isFinite(c.b)
      
      const validPrimary = isValidColor(sanitizedPrimary)
      const validSecondary = isValidColor(sanitizedSecondary)
      const validAccent = isValidColor(sanitizedAccent)
      const validAmbient = isValidColor(sanitizedAmbient)
      
      // 🎨 WAVE 13.6: Aplicar multiplicadores globales (Intensidad y Saturación)
      // CRÍTICO: Los sliders del usuario deben afectar el modo FLOW
      // 🛡️ WAVE 24.6: Solo asignar colores válidos, else HOLD anterior
      // 🛡️ WAVE 24.8: Usar colores sanitizados (clamped 0-255, NaN→0)
      // 🔥 WAVE 24.11: lastColors SIEMPRE tiene valores (inicializado con Fuego warm colors)
      this.lastColors = {
        primary: validPrimary 
          ? this.applyGlobalMultipliers(sanitizedPrimary) 
          : this.lastColors.primary,  // HOLD último color válido (NO fallback a negro)
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
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎨 WAVE 46.5: CHROMATIC UNLOCK - Usar SeleneColorEngine cuando Trinity esté activo
      // Si tenemos datos del Worker (género, key, etc.), generamos colores procedurales
      // en lugar de usar Flow fallback. Esto desbloquea paletas reales (Techno = cian/magenta)
      // ═══════════════════════════════════════════════════════════════════════
      
      let finalPalette: any
      let finalPaletteSource: 'procedural' | 'fallback' = 'fallback'
      
      // 🔓 WAVE 46.5: Si Trinity tiene un género válido, generamos colores procedurales
      const hasTrinityContext = this.lastTrinityData?.macroGenre && 
                                 this.lastTrinityData.macroGenre !== 'UNKNOWN'
      
      if (hasTrinityContext) {
        // Construir análisis seguro para SeleneColorEngine
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
              mood: 'energetic' as const  // Forzar energetic para géneros electrónicos
            },
            section: {
              type: 'drop' as const,  // Asumir drop para máxima energía
              energy: metrics.energy,
              confidence: 0.8
            },
            genre: {
              primary: this.lastTrinityData?.macroGenre ?? 'ELECTRONIC_4X4',
              confidence: 1
            }
          }
        }
        
        // 🎨 WAVE 49: Generar paleta CON INTERPOLACIÓN
        // WAVE 55: Usar DROP confirmado (override) en lugar de section bruta
        const currentSection = this.lastTrinityData?.sectionDetail?.type || 'unknown'
        const colorStrategy = (this.lastTrinityData as any)?.mood?.colorStrategy
        const isConfirmedDrop = colorStrategy?.sectionOverride === 'drop'
        const isDrop = isConfirmedDrop || (currentSection === 'drop' && !colorStrategy)
        const proceduralPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop)
        
        // Convertir HSL → RGB para hardware
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
        // 🔥 WAVE 24.9: FALLBACK - Modo Flow cuando no hay Trinity data
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
      
      // Construir Brain Output (Procedural o Flow según Trinity data)
      // 🌊 WAVE 41.0: Agregado context con rhythm.groove.syncopation para telemetría
      this.lastBrainOutput = {
        timestamp: Date.now(),
        sessionId: hasTrinityContext ? 'trinity-session' : 'flow-session',
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
        // 🌊 WAVE 41.0: Context mínimo para que telemetría no crashee
        context: {
          rhythm: {
            bpm: beatState.bpm || 120,
            confidence: beatState.confidence || 0.5,
            beatPhase: beatState.phase || 0,
            barPhase: ((beatState.beatCount || 0) % 4) / 4,
            pattern: { type: 'unknown' as const, confidence: 0 },
            drums: { kick: false, snare: false, hihat: false, clap: false, tom: false },
            groove: {
              syncopation: 0, // Modo FLOW no tiene sincopación avanzada
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
    
    // ───────────────────────────────────────────────────────────────────────
    // 📡 WAVE-14: Collect & Emit Telemetry
    // ───────────────────────────────────────────────────────────────────────
    const audioAnalysis = this.useBrain && this.brainInitialized 
      ? this.convertToAudioAnalysis(metrics, beatState)
      : this.convertToAudioAnalysis(metrics, beatState)
    
    // 🔧 WAVE 24: Pasar lastColors para generar FixtureValues en telemetría
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
   * 🔄 Convierte AudioMetrics a AudioAnalysis (formato del Brain)
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
   * 🎨 Convierte BrainOutput a ColorOutput (para hardware)
   */
  private brainOutputToColors(output: BrainOutput): ColorOutput {
    const { palette, lighting } = output
    
    // Convertir HSL a RGB
    const primaryRGB = this.hslToRgb(palette.primary)
    const secondaryRGB = this.hslToRgb(palette.secondary)
    const accentRGB = this.hslToRgb(palette.accent)
    
    // 🪞 ESPEJO CROMÁTICO: Si hay ambient en la paleta, usarlo
    // Si no, crear una variación cálida del accent para coherencia visual
    let ambientRGB: { r: number; g: number; b: number }
    if (palette.ambient) {
      ambientRGB = this.hslToRgb(palette.ambient)
    } else {
      // Crear espejo cromático: variación más cálida del accent
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
    
    // 🎨 WAVE 13.6: Aplicar multiplicadores globales
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
   * 🔄 Convierte HSL a RGB
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
   * 🎯 Convierte BrainOutput a MovementOutput
   * WAVE 10: Ahora usa MovementEngine para posiciones dinámicas
   * Respeta los parámetros configurados por el UI (speed, range, pattern)
   */
  private brainOutputToMovement(output: BrainOutput, deltaTime: number): MovementOutput {
    // 🔥 WAVE 10 FIX: NO sobrescribir el pattern del UI
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
   * 🎛️ Activa/desactiva el uso del Brain
   */
  setUseBrain(enabled: boolean): void {
    this.useBrain = enabled
    console.info(`[SeleneLux] Brain ${enabled ? 'ENABLED' : 'DISABLED'}`)
    this.emit('brain-toggle', enabled)
  }
  
  /**
   * 📊 Obtiene estadísticas del Brain
   */
  /**
   * 🪓 WAVE 39.9.2: getBrainStats retorna stats simulados
   * Brain vive en Worker, estas stats son para compatibilidad UI
   */
  getBrainStats(): { session: unknown; memory: unknown; hasMemory: boolean } | null {
    if (!this.brainInitialized) return null
    // 🪓 WAVE 39.9.2: Return simulated stats (real brain is in Worker)
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
   * 🎯 WAVE 39.1: Recibir FFT bins desde IPC para visualización
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
  
  // 🎯 WAVE 10: New methods for movement control
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
      // 🧠 WAVE-8: Estado del Brain
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
   * 🎨 WAVE 13.6: STATE OF TRUTH - Multiplicadores Globales de Color
   */
  setGlobalSaturation(value: number): void {
    this.globalSaturation = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] 🎨 Global Saturation: ${(this.globalSaturation * 100).toFixed(0)}%`)
  }
  
  setGlobalIntensity(value: number): void {
    this.globalIntensity = Math.max(0, Math.min(1, value))
    console.log(`[SeleneLux] 💡 Global Intensity: ${(this.globalIntensity * 100).toFixed(0)}%`)
  }
  
  getGlobalColorParams(): { saturation: number; intensity: number } {
    return {
      saturation: this.globalSaturation,
      intensity: this.globalIntensity
    }
  }
  
  /**
   * 🎨 WAVE 13.6: Aplica multiplicadores globales a un color RGB
   * CRÍTICO: Atenúa la intensidad multiplicando cada canal por globalIntensity
   * 
   * 🛡️ WAVE 24.6: Anti-NaN Guard añadido
   * Si llega NaN, usamos 0 para evitar flicker y propagación
   */
  private applyGlobalMultipliers(rgb: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
    // 🛡️ WAVE 24.6: Validar entrada antes de multiplicar
    // NaN * globalIntensity = NaN → FLICKER
    const safeR = Number.isFinite(rgb.r) ? rgb.r : 0
    const safeG = Number.isFinite(rgb.g) ? rgb.g : 0
    const safeB = Number.isFinite(rgb.b) ? rgb.b : 0
    
    // Aplicar intensidad (dimmer) - afecta todos los canales por igual
    const dimmedR = safeR * this.globalIntensity
    const dimmedG = safeG * this.globalIntensity
    const dimmedB = safeB * this.globalIntensity
    
    // Aplicar saturación - desatura hacia el promedio de los canales
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
   * � WAVE-14: Input Gain para telemetría
   */
  setInputGain(value: number): void {
    this.inputGain = Math.max(0, Math.min(4, value))
    console.log(`[SeleneLux] 🎚️ Input Gain: ${(this.inputGain * 100).toFixed(0)}%`)
  }
  
  getInputGain(): number {
    return this.inputGain
  }
  
  /**
   * 🪓 WAVE 39.9.2: forceColorMutation es NO-OP
   * Brain vive en Worker - esta función es para compatibilidad
   */
  forceColorMutation(_reason: string = 'Manual trigger'): void {
    // 🪓 WAVE 39.9.2: Brain lives in Worker - log only
    console.info('[SeleneLux] 🪓 forceColorMutation() - brain is in Worker')
  }
  
  /**
   * � WAVE 39.9.2: resetMemory es NO-OP
   * Brain vive en Worker - esta función es para compatibilidad
   */
  resetMemory(): void {
    // 🪓 WAVE 39.9.2: Brain lives in Worker - log only
    console.info('[SeleneLux] 🪓 resetMemory() - brain is in Worker')
  }

  /**
   * 📡 WAVE 46.0 → 47.2: DATA BRIDGE - Recibe datos de Trinity Worker
   * 
   * Este método conecta el Worker (GAMMA/mind.ts) con getBroadcast() para la UI.
   * El Worker tiene la data correcta (género, key, syncopation) pero antes
   * no llegaba a la UI porque lastBrainOutput estaba vacío (useBrain=false).
   * 
   * WAVE 47.2: Ahora incluye mood (MoodSynthesizer) y sectionDetail (SectionTracker)
   * 
   * @param debugInfo - debugInfo del LightingDecision que viene del Worker
   */
  updateFromTrinity(debugInfo: {
    macroGenre?: string
    key?: string | null
    mode?: string
    syncopation?: number
    strategy?: string
    temperature?: string
    description?: string
    mood?: any  // 💫 WAVE 47.2: MoodSynthesizer output (VAD)
    sectionDetail?: any  // 💫 WAVE 47.2: SectionTracker output
  } | undefined): void {
    if (!debugInfo) return
    
    this.lastTrinityData = {
      ...debugInfo,
      timestamp: Date.now()
    }
    
    // 💫 WAVE 47.2: Log actualizado para verificar mood & section desde spread directo
    if (this.frameCount % 150 === 0) {
      console.log('[SeleneLux] 📡 WAVE 47.2 Trinity Data:', JSON.stringify({
        genre: this.lastTrinityData.macroGenre,
        key: this.lastTrinityData.key,
        synco: this.lastTrinityData.syncopation?.toFixed(2),
        mood: this.lastTrinityData.mood?.primary,  // Acceso directo (spread)
        arousal: this.lastTrinityData.mood?.arousal?.toFixed(2),
        valence: this.lastTrinityData.mood?.valence?.toFixed(2),
        section: this.lastTrinityData.sectionDetail?.type,  // Acceso directo (spread)
        sectionConf: this.lastTrinityData.sectionDetail?.confidence?.toFixed(2)
      }, null, 0))
    }
  }

  /**
   * 📡 WAVE-14: Acceso al TelemetryCollector
   */
  getTelemetryCollector(): SeleneTelemetryCollector {
    return this.telemetryCollector
  }  // ═══════════════════════════════════════════════════════════════════════════
  // 🌙 WAVE 25: UNIVERSAL TRUTH PROTOCOL - getBroadcast()
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🌙 WAVE 25: Obtiene el broadcast completo de Selene
   * Este es el ÚNICO objeto que el Frontend necesita para renderizar todo.
   * 
   * FLUJO: Brain + ColorEngine + Movement + Consciousness → SeleneBroadcast
   * 
   * @returns SeleneBroadcast - La Verdad Universal de Selene a 30fps
   */
  public getBroadcast(): SeleneBroadcast {
    const now = Date.now()
    const deltaTime = now - this.lastFrameTime
    
    // 📊 FPS Tracking
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // HELPER: RGB → UnifiedColor (HSL + RGB + HEX)
    // ═══════════════════════════════════════════════════════════════════════
    const toUnifiedColor = (rgb: { r: number; g: number; b: number }): UnifiedColor => {
      const r = Math.max(0, Math.min(255, Math.round(rgb.r ?? 0)))
      const g = Math.max(0, Math.min(255, Math.round(rgb.g ?? 0)))
      const b = Math.max(0, Math.min(255, Math.round(rgb.b ?? 0)))
      
      // RGB → HSL
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 1. SENSORY DATA (Audio crudo)
    // ═══════════════════════════════════════════════════════════════════════
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
      // 🎯 WAVE 39.1: FFT bins reales desde useAudioCapture (64 bins normalizados)
      // Si tenemos menos de 256, pad con ceros; si tenemos más, truncar
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
    
    // 📡 WAVE 46.0: Trinity Worker Data - Mover ANTES para usarlo en cognitive
    const trinityData = this.lastTrinityData
    
    // ═══════════════════════════════════════════════════════════════════════
    // 2. COGNITIVE DATA (Consciencia)
    // ═══════════════════════════════════════════════════════════════════════
    // 💫 WAVE 47.1.3: Mood arbitrado viene del GAMMA Worker (mind.ts)
    // La arbitración ya se hizo en el Worker con prioridad: genre > harmony > VAD
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
        sign: this.lastZodiacInfo?.sign?.symbol ?? '♈',
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
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 3. MUSICAL DNA (Análisis musical profundo)
    // ═══════════════════════════════════════════════════════════════════════
    const context = brain?.context
    
    // 📡 WAVE 46.0: trinityData ya declarado arriba (línea 1446) para uso en cognitive
    // El Worker (GAMMA) tiene género/key/syncopation correctos
    
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
      // 📡 WAVE 46.0: Priorizar Trinity data para key
      key: trinityData?.key ?? context?.harmony?.key ?? null,
      mode: {
        // 📡 WAVE 46.0: Usar mode de Trinity si disponible
        scale: ((trinityData?.mode === 'minor' ? 'minor' : trinityData?.mode === 'major' ? 'major' : context?.harmony?.mode?.scale) ?? 'major') as 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'locrian' | 'harmonic_minor' | 'melodic_minor' | 'pentatonic_major' | 'pentatonic_minor' | 'blues' | 'chromatic',
        mood: (context?.harmony?.mode?.mood ?? 'universal') as 'happy' | 'sad' | 'jazzy' | 'spanish_exotic' | 'dreamy' | 'bluesy' | 'tense' | 'universal',
        confidence: context?.harmony?.confidence ?? (trinityData ? 0.8 : 0),
      },
      genre: {
        // 📡 WAVE 46.0: PRIORIZAR Trinity data para género - LA VERDAD DEL WORKER
        primary: ((trinityData?.macroGenre ?? context?.genre?.primary ?? 'UNKNOWN') as 'ELECTRONIC_4X4' | 'ELECTRONIC_BREAK' | 'LATINO_TRADICIONAL' | 'LATINO_URBANO' | 'ROCK_POP' | 'JAZZ_SOUL' | 'AMBIENT_CHILL' | 'UNKNOWN'),
        subGenre: context?.genre?.secondary ?? null,
        confidence: trinityData?.macroGenre ? 0.9 : (context?.genre?.confidence ?? 0),
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
        // 💫 WAVE 47.3: SECTION STABILITY - Histéresis para evitar flicker de 10 cambios/segundo
        // Solo cambiar sección si: 1) confidence > 0.8, 2) distinta a actual, 3) han pasado >3 segundos
        current: (() => {
          const rawSection = trinityData?.sectionDetail?.type ?? context?.section?.current?.type ?? 'unknown'
          const rawConfidence = trinityData?.sectionDetail?.confidence ?? context?.section?.current?.confidence ?? 0
          const timeSinceLastChange = now - this.lastStableSection.timestamp
          const MIN_SECTION_DURATION = 3000 // 3 segundos mínimo por sección
          
          // Si la sección es diferente Y tiene alta confianza Y ha pasado suficiente tiempo → cambiar
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 4. VISUAL DECISION (Colores y Movimiento)
    // ═══════════════════════════════════════════════════════════════════════
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
        strategy: (palette?.strategy ?? 'analogous') as 'analogous' | 'triadic' | 'complementary',
        temperature: (brain?.debugInfo?.temperature ?? 'neutral') as 'warm' | 'cool' | 'neutral',
        description: brain?.debugInfo?.description ?? `Palette: ${this.currentPalette}`,
        source: (brain?.paletteSource ?? 'fallback') as 'procedural' | 'memory' | 'fallback',
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
        strobe: { active: false, rate: 0, intensity: 0 },
        fog: { active: false, density: 0 },
        laser: { active: false, pattern: '', color: null },
        beam: { active: false, width: 0 },
        prism: { active: false, facets: 0 },
        blackout: false,
      },
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 5. HARDWARE STATE (DMX - placeholder, se llenará en main.ts)
    // ═══════════════════════════════════════════════════════════════════════
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // 6. SYSTEM METADATA
    // ═══════════════════════════════════════════════════════════════════════
    // 🧠 WAVE 39.9.2: brainStatus ahora muestra el MOOD actual (no el fantasma reactive/intelligent)
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
   * 🌙 WAVE 25: Actualiza el estado de audio (para tracking en broadcast)
   */
  setAudioState(metrics: AudioMetrics, analysis: AudioAnalysis | null, deviceName?: string): void {
    this.lastAudioMetrics = metrics
    this.lastAudioAnalysis = analysis
    if (deviceName) this.audioDeviceName = deviceName
    this.audioActive = metrics.energy > 0.02
  }
  
  /**
   * 🪓 WAVE 39.9.2: Cierra limpiamente Selene (Brain vive en Worker)
   */
  async shutdown(): Promise<void> {
    this.running = false
    
    // 🪓 WAVE 39.9.2: Brain lives in Worker, nothing to shutdown here
    this.brainInitialized = false
    
    console.info('[SeleneLux] � WAVE 39.9.2: Shutdown complete (brain is in Worker)')
    this.emit('shutdown')
  }
}
