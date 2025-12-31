/**
 * WAVE 243.5: TITAN ORCHESTRATOR - SIMPLIFIED V2
 * 
 * Orquesta Brain -> Engine -> HAL pipeline.
 * main.ts se encarga de IPC handlers, este módulo solo orquesta el flujo de datos.
 * 
 * @module TitanOrchestrator
 */

import { TrinityBrain } from '../../brain/TrinityBrain'
import { TitanEngine } from '../../engine/TitanEngine'
import { HardwareAbstraction } from '../../hal/HardwareAbstraction'
import { EventRouter, getEventRouter } from './EventRouter'
import { getTrinity, TrinityOrchestrator } from '../../workers/TrinityOrchestrator'
import type { MusicalContext } from '../protocol/MusicalContext'
import { 
  SeleneTruth, 
  createDefaultTruth,
  createDefaultCognitive,
  createDefaultSensory 
} from '../protocol/SeleneProtocol'

// Use inline type to avoid import issues
type VibeId = 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge' | 'idle'

/**
 * Configuración del orquestador
 */
export interface TitanConfig {
  debug?: boolean
  initialVibe?: VibeId
}

/**
 * TitanOrchestrator - Simple orchestration of Brain -> Engine -> HAL
 */
export class TitanOrchestrator {
  private brain: TrinityBrain | null = null
  private engine: TitanEngine | null = null
  private hal: HardwareAbstraction | null = null
  private trinity: TrinityOrchestrator | null = null  // 🧠 WAVE 258: Trinity reference
  private eventRouter: EventRouter
  
  private config: TitanConfig
  private isInitialized = false
  private isRunning = false
  private mainLoopInterval: NodeJS.Timeout | null = null
  private frameCount = 0
  
  // WAVE 252: Real fixtures from ConfigManager (no more mocks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fixtures: any[] = []
  
  // Vibe rotation for demo
  private vibeSequence: VibeId[] = ['fiesta-latina', 'techno-club', 'pop-rock', 'chill-lounge']
  private currentVibeIndex = 0

  // WAVE 254: Control state
  private mode: 'auto' | 'manual' = 'auto'
  private useBrain = true
  private inputGain = 1.0

  // WAVE 255: Real audio buffer from frontend
  private lastAudioData: { bass: number; mid: number; high: number; energy: number } = {
    bass: 0, mid: 0, high: 0, energy: 0
  }
  private hasRealAudio = false

  // WAVE 255.5: Callback to broadcast fixture states to frontend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onBroadcast: ((truth: any) => void) | null = null

  constructor(config: TitanConfig = {}) {
    this.config = {
      debug: false,
      // WAVE 255: Force IDLE on startup - system starts in blackout
      initialVibe: 'idle',
      ...config,
    }
    
    this.eventRouter = getEventRouter()
    console.log('[TitanOrchestrator] Created (WAVE 243.5)')
  }

  /**
   * Initialize all TITAN modules
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('[TitanOrchestrator] Already initialized')
      return
    }
    
    console.log('[TitanOrchestrator] ===============================================')
    console.log('[TitanOrchestrator]   INITIALIZING TITAN 2.0')
    console.log('[TitanOrchestrator] ===============================================')
    
    // Initialize Brain
    this.brain = new TrinityBrain()
    console.log('[TitanOrchestrator] TrinityBrain created')
    
    // Connect Brain to Trinity Orchestrator and START the neural network
    try {
      const trinity = getTrinity()
      this.trinity = trinity  // 🧠 WAVE 258: Save reference for audio feeding
      this.brain.connectToOrchestrator(trinity)
      console.log('[TitanOrchestrator] Brain connected to Trinity')
      
      // 🧠 WAVE 258 CORTEX KICKSTART: Start the Workers!
      console.log('[TitanOrchestrator] 🧠 Starting Trinity Neural Network...')
      await trinity.start()
      console.log('[TitanOrchestrator] ✅ Trinity Workers are LIVE!')
    } catch (e) {
      console.error('[TitanOrchestrator] ❌ Trinity startup failed:', e)
      console.log('[TitanOrchestrator] Brain will use simulated context as fallback')
    }
    
    // Initialize Engine with initial vibe
    this.engine = new TitanEngine({ 
      debug: this.config.debug, 
      initialVibe: this.config.initialVibe 
    })
    console.log('[TitanOrchestrator] TitanEngine created')
    
    // Initialize HAL
    this.hal = new HardwareAbstraction({ debug: this.config.debug })
    console.log('[TitanOrchestrator] HardwareAbstraction created')
    
    // TODO: EventRouter connection needs interface alignment
    // this.eventRouter.connect(this.brain, this.engine, this.hal)
    console.log('[TitanOrchestrator] EventRouter ready (direct mode)')
    
    this.isInitialized = true
    
    console.log('[TitanOrchestrator] ===============================================')
    console.log('[TitanOrchestrator]   TITAN 2.0 INITIALIZED')
    console.log('[TitanOrchestrator] ===============================================')
  }

  /**
   * Start the main loop
   */
  start(): void {
    if (!this.isInitialized) {
      console.error('[TitanOrchestrator] Cannot start - not initialized')
      return
    }
    
    if (this.isRunning) {
      console.log('[TitanOrchestrator] Already running')
      return
    }
    
    console.log('[TitanOrchestrator] Starting main loop @ 30fps')
    
    this.isRunning = true
    this.mainLoopInterval = setInterval(() => {
      this.processFrame()
    }, 33) // ~30fps
    
    // WAVE 257: Log system start to Tactical Log (delayed to ensure callback is set)
    setTimeout(() => {
      this.log('System', '🚀 TITAN 2.0 ONLINE - Main loop started @ 30fps')
      this.log('Info', `📊 Fixtures loaded: ${this.fixtures.length}`)
    }, 100)
  }

  /**
   * Stop the main loop
   */
  stop(): void {
    if (this.mainLoopInterval) {
      clearInterval(this.mainLoopInterval)
      this.mainLoopInterval = null
    }
    this.isRunning = false
    console.log('[TitanOrchestrator] Stopped')
  }

  /**
   * Process a single frame of the Brain -> Engine -> HAL pipeline
   */
  private processFrame(): void {
    if (!this.brain || !this.engine || !this.hal) return
    
    this.frameCount++
    
    // WAVE 255: No more auto-rotation, system stays in selected vibe
    // Vibe changes only via IPC lux:setVibe
    
    const shouldLog = this.frameCount % 30 === 0 // Log every ~1 second
    
    // 1. Brain produces MusicalContext
    const context = this.brain.getCurrentContext()
    
    // 2. WAVE 255: Use real audio if available, otherwise silence (IDLE mode)
    let bass: number, mid: number, high: number, energy: number
    
    if (this.hasRealAudio) {
      bass = this.lastAudioData.bass * this.inputGain
      mid = this.lastAudioData.mid * this.inputGain
      high = this.lastAudioData.high * this.inputGain
      energy = this.lastAudioData.energy * this.inputGain
    } else {
      // Silence - system in standby
      bass = 0
      mid = 0
      high = 0
      energy = 0
    }
    
    // For TitanEngine
    const engineAudioMetrics = {
      bass,
      mid,
      high,
      energy,
      beatPhase: (this.frameCount % 30) / 30,
      isBeat: this.frameCount % 30 === 0 && energy > 0.3,
    }
    
    // For HAL
    const halAudioMetrics = {
      rawBass: bass,
      rawMid: mid,
      rawTreble: high,
      energy,
      isRealSilence: false,
      isAGCTrap: false,
    }
    
    // 3. Engine processes context -> produces LightingIntent
    const intent = this.engine.update(context, engineAudioMetrics)
    
    // 4. HAL renders intent -> produces fixture states (WAVE 252: uses real fixtures)
    const fixtureStates = this.hal.render(intent, this.fixtures, halAudioMetrics)
    
    // WAVE 257: Throttled logging to Tactical Log (every second = 30 frames)
    const shouldLogToTactical = this.frameCount % 30 === 0
    
    if (shouldLogToTactical && this.hasRealAudio) {
      const avgDimmer = fixtureStates.length > 0 
        ? fixtureStates.reduce((sum, f) => sum + f.dimmer, 0) / fixtureStates.length 
        : 0
      const movers = fixtureStates.filter(f => f.zone.includes('MOVING'))
      const avgMover = movers.length > 0 ? movers.reduce((s, f) => s + f.dimmer, 0) / movers.length : 0
      const frontPars = fixtureStates.filter(f => f.zone === 'FRONT_PARS')
      const avgFront = frontPars.length > 0 ? frontPars.reduce((s, f) => s + f.dimmer, 0) / frontPars.length : 0
      
      // Send to Tactical Log
      this.log('Visual', `🎨 P:${intent.palette.primary.hex || '#???'} | Front:${avgFront.toFixed(0)} Mover:${avgMover.toFixed(0)}`, {
        bass, mid, high, energy,
        avgDimmer: avgDimmer.toFixed(0),
        paletteStrategy: intent.palette.strategy
      })
    }
    
    // 5. WAVE 256: Broadcast VALID SeleneTruth to frontend for StageSimulator
    if (this.onBroadcast) {
      const currentVibe = this.engine.getCurrentVibe()
      
      // Build a valid SeleneTruth structure
      const truth: SeleneTruth = {
        system: {
          frameNumber: this.frameCount,
          timestamp: Date.now(),
          deltaTime: 33,
          targetFPS: 30,
          actualFPS: 30,
          mode: this.mode === 'auto' ? 'selene' : 'manual',
          vibe: currentVibe,
          brainStatus: 'peaceful',
          uptime: this.frameCount * 33,
          titanEnabled: true,
          sessionId: 'titan-2.0',
          version: '2.0.0',
          performance: {
            audioProcessingMs: 0,
            brainProcessingMs: 0,
            colorEngineMs: 0,
            dmxOutputMs: 0,
            totalFrameMs: 0
          }
        },
        sensory: {
          audio: {
            energy,
            peak: energy,
            average: energy * 0.8,
            bass,
            mid,
            high,
            spectralCentroid: 0,
            spectralFlux: 0,
            zeroCrossingRate: 0
          },
          fft: new Array(256).fill(0),
          beat: {
            onBeat: engineAudioMetrics.isBeat,
            confidence: 0.8,
            bpm: context.bpm || 120,
            beatPhase: context.beatPhase || 0,
            barPhase: 0,
            timeSinceLastBeat: 0
          },
          input: {
            gain: this.inputGain,
            device: 'Microphone',
            active: this.hasRealAudio,
            isClipping: false
          }
        },
        consciousness: createDefaultCognitive(),
        // 🧠 WAVE 260: SYNAPTIC BRIDGE - Usar el contexto REAL del Brain
        // Antes esto estaba hardcodeado a UNKNOWN/null. Ahora propagamos
        // el contexto que ya obtuvimos de brain.getCurrentContext()
        context: {
          key: context.key,
          mode: context.mode,
          bpm: context.bpm,
          beatPhase: context.beatPhase,
          syncopation: context.syncopation,
          section: context.section,
          energy: context.energy,
          mood: context.mood,
          genre: context.genre,
          confidence: context.confidence,
          timestamp: context.timestamp
        },
        intent: {
          palette: intent.palette,
          masterIntensity: intent.masterIntensity,
          zones: intent.zones,
          movement: intent.movement,
          effects: intent.effects,
          source: 'procedural',
          timestamp: Date.now()
        },
        hardware: {
          dmx: {
            connected: true,
            driver: 'none',
            universe: 1,
            frameRate: 30,
            port: null
          },
          dmxOutput: new Array(512).fill(0),
          fixturesActive: fixtureStates.filter(f => f.dimmer > 0).length,
          fixturesTotal: fixtureStates.length,
          // Map HAL FixtureState to Protocol FixtureState
          // WAVE 256.3: Normalize DMX values (0-255) to frontend values (0-1)
          // WAVE 256.7: Map zone names for StageSimulator2 compatibility
          fixtures: fixtureStates.map((f, i) => {
            // Map HAL zones to StageSimulator2 zones
            const zoneMap: Record<string, string> = {
              'FRONT_PARS': 'front',
              'BACK_PARS': 'back', 
              'MOVING_LEFT': 'left',
              'MOVING_RIGHT': 'right',
              'STROBES': 'center',
              'AMBIENT': 'center',
              'FLOOR': 'front',
              'UNASSIGNED': 'center'
            }
            const mappedZone = zoneMap[f.zone] || 'center'
            
            return {
              id: `fix_${i}`,
              name: f.name,
              type: f.type,
              zone: mappedZone,
              dmxAddress: f.dmxAddress,
              universe: f.universe,
              dimmer: f.dimmer / 255,           // Normalize 0-255 → 0-1
              intensity: f.dimmer / 255,        // Normalize 0-255 → 0-1
              color: { 
                r: Math.round(f.r),             // Keep 0-255 for RGB
                g: Math.round(f.g), 
                b: Math.round(f.b) 
              },
              pan: f.pan / 255,                 // Normalize 0-255 → 0-1
              tilt: f.tilt / 255,               // Normalize 0-255 → 0-1
              online: true,
              active: f.dimmer > 0
            }
          })
        },
        timestamp: Date.now()
      }
      
      this.onBroadcast(truth)
      
      // 🧠 WAVE 260: Debug log para verificar que el contexto fluye a la UI
      // Log cada 2 segundos (60 frames @ 30fps)
      if (this.frameCount % 60 === 0) {
        console.log(
          `[Titan] 🌉 SYNAPTIC BRIDGE: Key=${context.key ?? '---'} ${context.mode} | ` +
          `Genre=${context.genre.macro}/${context.genre.subGenre ?? 'none'} | ` +
          `BPM=${context.bpm} | Energy=${(context.energy * 100).toFixed(0)}%`
        )
      }
    }
    
    // Log every second
    if (shouldLog && this.config.debug) {
      const currentVibe = this.engine.getCurrentVibe()
      console.log(`[TitanOrchestrator] Frame ${this.frameCount}: Vibe=${currentVibe}, Fixtures=${fixtureStates.length}`)
    }
  }

  /**
   * Set the current vibe
   */
  setVibe(vibeId: VibeId): void {
    if (this.engine) {
      this.engine.setVibe(vibeId)
      console.log(`[TitanOrchestrator] Vibe set to: ${vibeId}`)
      // WAVE 257: Log vibe change to Tactical Log
      this.log('Mode', `🎭 Vibe changed to: ${vibeId.toUpperCase()}`)
    }
  }

  /**
   * WAVE 254: Set mode (auto/manual)
   */
  setMode(mode: string): void {
    this.mode = mode as 'auto' | 'manual'
    console.log(`[TitanOrchestrator] Mode set to: ${mode}`)
    // WAVE 257: Log mode change to Tactical Log
    this.log('System', `⚙️ Mode: ${mode.toUpperCase()}`)
  }

  /**
   * WAVE 254: Enable/disable brain processing
   */
  setUseBrain(enabled: boolean): void {
    this.useBrain = enabled
    console.log(`[TitanOrchestrator] Brain ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * WAVE 254: Set input gain for audio
   */
  setInputGain(gain: number): void {
    this.inputGain = Math.max(0, Math.min(2, gain))
    console.log(`[TitanOrchestrator] Input gain set to: ${this.inputGain}`)
  }

  /**
   * WAVE 255.5: Set callback for broadcasting truth to frontend
   * This enables StageSimulator2 to receive fixture states
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBroadcastCallback(callback: (truth: any) => void): void {
    this.onBroadcast = callback
    console.log('[TitanOrchestrator] Broadcast callback registered')
  }

  /**
   * WAVE 257: Set callback for sending logs to frontend (Tactical Log)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private onLog: ((entry: any) => void) | null = null
  
  setLogCallback(callback: (entry: any) => void): void {
    this.onLog = callback
    console.log('[TitanOrchestrator] Log callback registered')
  }

  /**
   * WAVE 257: Send a log entry to the frontend Tactical Log
   * @param category - Log category (Brain, Mode, Hunt, Beat, Music, Genre, Visual, DMX, System, Error, Info)
   * @param message - The log message
   * @param data - Optional additional data
   */
  log(category: string, message: string, data?: Record<string, unknown>): void {
    if (!this.onLog) return
    
    this.onLog({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      category,
      message,
      data: data || null,
      level: category === 'Error' ? 'error' : 'info'
    })
  }

  /**
   * WAVE 255: Process incoming audio frame from frontend
   * This method receives audio data and stores it for the main loop
   */
  processAudioFrame(data: Record<string, unknown>): void {
    if (!this.isRunning || !this.useBrain) return
    
    // Extract audio metrics from incoming data
    const bass = typeof data.bass === 'number' ? data.bass : 0
    const mid = typeof data.mid === 'number' ? data.mid : 0
    const high = typeof data.high === 'number' ? (data.high as number) : 
                 typeof data.treble === 'number' ? (data.treble as number) : 0
    const energy = typeof data.energy === 'number' ? data.energy : 
                   typeof data.volume === 'number' ? data.volume : 0
    
    // Store for main loop
    this.lastAudioData = { bass, mid, high, energy }
    this.hasRealAudio = energy > 0.01 // Mark as having real audio if not silent
    
    // 🧠 WAVE 258: Feed audio to Trinity Workers for real analysis!
    if (this.trinity && this.hasRealAudio) {
      this.trinity.feedAudioMetrics({
        bass,
        mid,
        treble: high,
        energy
      })
    }
    
    if (this.config.debug && this.frameCount % 30 === 0) {
      console.log(`[TitanOrchestrator] 👂 Audio: bass=${bass.toFixed(2)} mid=${mid.toFixed(2)} energy=${energy.toFixed(2)}`)
    }
  }

  /**
   * 🩸 WAVE 259: RAW VEIN - Process raw audio buffer from frontend
   * This sends the Float32Array directly to BETA Worker for real FFT analysis
   */
  processAudioBuffer(buffer: Float32Array): void {
    if (!this.isRunning || !this.useBrain) return
    
    // 🩸 Send raw buffer to Trinity -> BETA Worker for FFT
    if (this.trinity) {
      this.trinity.feedAudioBuffer(buffer)
    }
  }

  /**
   * WAVE 252: Set fixtures from ConfigManager (real data, no mocks)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFixtures(fixtures: any[]): void {
    this.fixtures = fixtures
    console.log(`[TitanOrchestrator] Fixtures loaded: ${fixtures.length} real fixtures`)
  }

  /**
   * WAVE 252: Get current fixtures count
   */
  getFixturesCount(): number {
    return this.fixtures.length
  }

  /**
   * Get current state for diagnostics
   */
  getState(): {
    isInitialized: boolean
    isRunning: boolean
    frameCount: number
    currentVibe: string | null
    fixturesCount: number
  } {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      currentVibe: this.engine?.getCurrentVibe() ?? null,
      fixturesCount: this.fixtures.length,
    }
  }
}

// Singleton instance
let orchestratorInstance: TitanOrchestrator | null = null

export function getTitanOrchestrator(): TitanOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new TitanOrchestrator()
  }
  return orchestratorInstance
}
