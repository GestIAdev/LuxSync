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
import { getTrinity } from '../../workers/TrinityOrchestrator'
import type { MusicalContext } from '../protocol/MusicalContext'

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

  constructor(config: TitanConfig = {}) {
    this.config = {
      debug: false,
      initialVibe: 'pop-rock',
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
    
    // Connect Brain to Trinity Orchestrator
    try {
      const trinity = getTrinity()
      this.brain.connectToOrchestrator(trinity)
      console.log('[TitanOrchestrator] Brain connected to Trinity')
    } catch (e) {
      console.log('[TitanOrchestrator] Trinity not ready - Brain will use simulated context')
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
    
    // Rotate vibe every 5 seconds (150 frames @ 30fps) for demo
    if (this.frameCount % 150 === 0) {
      this.currentVibeIndex = (this.currentVibeIndex + 1) % this.vibeSequence.length
      const newVibe = this.vibeSequence[this.currentVibeIndex]
      this.engine.setVibe(newVibe)
      console.log(`[TitanOrchestrator] VIBE CHANGE -> ${newVibe.toUpperCase()}`)
    }
    
    const shouldLog = this.frameCount % 30 === 0 // Log every ~1 second
    
    // 1. Brain produces MusicalContext
    const context = this.brain.getCurrentContext()
    
    // 2. Simulated audio metrics (in production from worker)
    const bass = 0.5 + Math.sin(this.frameCount * 0.1) * 0.3
    const mid = 0.4 + Math.sin(this.frameCount * 0.15) * 0.2
    const high = 0.3 + Math.sin(this.frameCount * 0.2) * 0.2
    const energy = 0.6 + Math.sin(this.frameCount * 0.05) * 0.3
    
    // For TitanEngine
    const engineAudioMetrics = {
      bass,
      mid,
      high,
      energy,
      beatPhase: (this.frameCount % 30) / 30,
      isBeat: this.frameCount % 30 === 0,
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
