/**
 * SELENE LUX - CLASE MAESTRA
 * La Consciencia Luminica que Orquesta Todo
 */

import { EventEmitter } from 'events'
import type {
  AudioMetrics,
  MusicalPattern,
  ConsciousnessState,
  SeleneMode,
  MovementPattern,
} from './types'
import { ColorEngine, type LivingPaletteId, type ColorOutput } from './engines/visual/ColorEngine'
import { MovementEngine, type MovementOutput, type FixtureMovement } from './engines/visual/MovementEngine'
import { BeatDetector, type BeatState } from './engines/audio/BeatDetector'

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
}

export interface SeleneState {
  mode: SeleneMode
  palette: LivingPaletteId
  colors: ColorOutput
  movement: MovementOutput
  beat: BeatState
  consciousness: ConsciousnessState
  stats: { frames: number; decisions: number; uptime: number }
}

export class SeleneLux extends EventEmitter {
  private initialized = false
  private running = false
  private mode: SeleneMode = 'flow'
  
  private colorEngine: ColorEngine
  private movementEngine: MovementEngine
  private beatDetector: BeatDetector
  
  private currentPalette: LivingPaletteId = 'fuego'
  private currentPattern: MusicalPattern | null = null
  private consciousness: ConsciousnessState
  
  private lastColors: ColorOutput | null = null
  private lastMovement: MovementOutput | null = null
  private lastBeat: BeatState | null = null
  
  private frameCount = 0
  private decisionCount = 0
  private startTime = 0
  
  constructor(config: SeleneConfig) {
    super()
    
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
    
    console.info('[SeleneLux] Initialized')
    this.emit('ready')
  }
  
  processAudioFrame(metrics: AudioMetrics, deltaTime: number): SeleneState {
    this.frameCount++
    this.emit('audio-frame', metrics)
    
    const beatState = this.beatDetector.process(metrics)
    this.lastBeat = beatState
    
    const colors = this.colorEngine.generate(metrics, beatState, this.currentPattern)
    this.lastColors = colors
    
    this.colorEngine.updateTransition(deltaTime)
    
    const movement = this.movementEngine.calculate(metrics, beatState, deltaTime)
    this.lastMovement = movement
    
    if (beatState.onBeat) {
      this.consciousness.totalExperiences++
    }
    
    this.decisionCount++
    
    return this.getState()
  }
  
  setPalette(palette: LivingPaletteId): void {
    this.currentPalette = palette
    this.colorEngine.setPalette(palette)
    console.info(`[SeleneLux] Palette changed to: ${palette}`)
  }
  
  setMovementPattern(pattern: MovementPattern): void {
    this.movementEngine.setPattern(pattern)
    console.info(`[SeleneLux] Movement pattern changed to: ${pattern}`)
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
}
