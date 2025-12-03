/**
 * MOVEMENT ENGINE - LISSAJOUS PATTERNS
 * 
 * MIGRADO desde: demo/selene-movement-engine.js
 * 
 * Patrones de movimiento para moving heads:
 * - circle, infinity, sweep, cloud, waves, static
 * - Sincronizacion con BPM
 * - Phase offset por fixture (movimiento organico)
 * - Entropia determinista (sin Math.random)
 */

import type {
  MovementState,
  MovementPattern,
  VisualConfig,
  AudioMetrics,
} from '../../types'
import type { BeatState } from '../audio/BeatDetector'

export interface MovementOutput {
  pan: number
  tilt: number
  speed: number
  pattern: MovementPattern
}

export interface FixtureMovement {
  fixtureId: string
  x: number
  y: number
  intensity: number
}

interface PatternConfig {
  freqX: number
  freqY: number
  phaseShift: number
  amplitude: number
}

export class MovementEngine {
  private state: MovementState
  private time = 0
  private phase = 0
  private entropyState = { timeSeed: 0, audioSeed: 0 }
  private audioEnergy = 0.5
  
  private readonly patterns: Record<string, PatternConfig> = {
    circle: { freqX: 1, freqY: 1, phaseShift: Math.PI / 2, amplitude: 0.8 },
    infinity: { freqX: 2, freqY: 1, phaseShift: 0, amplitude: 0.7 },
    sweep: { freqX: 1, freqY: 0.1, phaseShift: 0, amplitude: 0.9 },
    cloud: { freqX: 1.3, freqY: 1.7, phaseShift: Math.PI / 4, amplitude: 0.5 },
    waves: { freqX: 1, freqY: 2, phaseShift: Math.PI / 3, amplitude: 0.6 },
    static: { freqX: 0, freqY: 0, phaseShift: 0, amplitude: 0 },
  }
  
  private readonly moodPatternMap: Record<string, string> = {
    peaceful: 'cloud',
    energetic: 'sweep',
    chaotic: 'infinity',
    harmonious: 'circle',
    building: 'waves',
    dropping: 'sweep',
  }
  
  private readonly smoothing: number
  
  constructor(config: VisualConfig) {
    this.smoothing = config.movementSmoothing || 0.8
    
    this.state = {
      pattern: 'lissajous',
      speed: 0.5,
      range: 0.8,
      phase: 0,
      syncToBpm: true,
      mirrorMode: false,
    }
  }
  
  /**
   * TICK - Actualiza movimiento para todos los fixtures
   * Migrado de selene-movement-engine.js tick()
   */
  tick(
    audioData: { energy: number; bass: number; mid: number; treble: number },
    deltaTime: number,
    fixtureIds: string[]
  ): FixtureMovement[] {
    this.audioEnergy = audioData.energy
    this.time += deltaTime * 0.001 * this.state.speed
    
    const results: FixtureMovement[] = []
    const patternName = this.state.pattern === 'lissajous' ? 'circle' : this.state.pattern
    const patternConfig = this.patterns[patternName] || this.patterns.circle
    
    for (let i = 0; i < fixtureIds.length; i++) {
      const fixtureId = fixtureIds[i]
      const phaseOffset = (i / fixtureIds.length) * Math.PI * 2
      
      const pos = this.calculateLissajous(
        this.time,
        patternConfig,
        phaseOffset,
        audioData
      )
      
      results.push({
        fixtureId,
        x: pos.x,
        y: pos.y,
        intensity: this.calculateIntensity(audioData, i, fixtureIds.length),
      })
    }
    
    return results
  }
  
  /**
   * Calcula posicion Lissajous
   */
  private calculateLissajous(
    t: number,
    config: PatternConfig,
    phaseOffset: number,
    audioData: { energy: number; bass: number }
  ): { x: number; y: number } {
    const energyMod = 0.8 + audioData.energy * 0.4
    const bassMod = 1 + audioData.bass * 0.2
    
    const x = Math.sin(t * config.freqX * bassMod + phaseOffset) * config.amplitude * energyMod
    const y = Math.sin(t * config.freqY * bassMod + config.phaseShift + phaseOffset) * config.amplitude * energyMod
    
    return {
      x: (x + 1) / 2,
      y: (y + 1) / 2,
    }
  }
  
  /**
   * Calcula intensidad por fixture
   */
  private calculateIntensity(
    audioData: { energy: number; bass: number; treble: number },
    fixtureIndex: number,
    totalFixtures: number
  ): number {
    const baseIntensity = audioData.energy * 0.7 + audioData.bass * 0.3
    const waveOffset = Math.sin(this.time * 2 + (fixtureIndex / totalFixtures) * Math.PI * 2)
    const waveIntensity = baseIntensity + waveOffset * 0.15
    
    return Math.max(0, Math.min(1, waveIntensity))
  }
  
  /**
   * Calcula posicion para un solo fixture
   */
  calculate(
    metrics: AudioMetrics,
    beatState: BeatState,
    deltaTime: number = 16
  ): MovementOutput {
    const speedMultiplier = this.state.syncToBpm
      ? beatState.bpm / 120
      : 1.0
    
    this.time += (deltaTime / 1000) * this.state.speed * speedMultiplier
    
    if (this.state.syncToBpm) {
      this.phase = beatState.phase * Math.PI * 2
    } else {
      this.phase = this.time * Math.PI * 2
    }
    
    let pan = 0.5
    let tilt = 0.5
    
    const patternName = this.state.pattern === 'lissajous' ? 'circle' : this.state.pattern
    const config = this.patterns[patternName] || this.patterns.circle
    
    if (config.amplitude > 0) {
      pan = 0.5 + Math.sin(this.phase * config.freqX) * 0.5 * this.state.range
      tilt = 0.5 + Math.sin(this.phase * config.freqY + config.phaseShift) * 0.5 * this.state.range
    }
    
    const energyRange = this.state.range * (0.7 + metrics.energy * 0.3)
    pan = 0.5 + (pan - 0.5) * (energyRange / this.state.range)
    tilt = 0.5 + (tilt - 0.5) * (energyRange / this.state.range)
    
    if (beatState.onBeat && metrics.bass > 0.6) {
      const entropy = this.getSystemEntropy(Date.now())
      const beatBoost = 0.1 * metrics.bass
      pan = Math.max(0, Math.min(1, pan + (entropy - 0.5) * beatBoost))
      tilt = Math.max(0, Math.min(1, tilt + (entropy - 0.5) * beatBoost))
    }
    
    pan = Math.max(0, Math.min(1, pan))
    tilt = Math.max(0, Math.min(1, tilt))
    
    return {
      pan,
      tilt,
      speed: this.state.speed * speedMultiplier,
      pattern: this.state.pattern,
    }
  }
  
  /**
   * Entropia determinista (sin Math.random)
   */
  getSystemEntropy(seedOffset: number = 0): number {
    const time = Date.now()
    const audioNoise = (this.audioEnergy * 1000) % 1
    const combinedSeed = time * 0.001 + audioNoise * 100 + seedOffset * 7.3
    const entropy = (Math.sin(combinedSeed) + Math.cos(combinedSeed * 0.7) + 2) / 4
    
    this.entropyState.timeSeed = (time % 100000) / 100000
    this.entropyState.audioSeed = audioNoise
    
    return Math.max(0, Math.min(1, entropy))
  }
  
  setPattern(pattern: MovementPattern): void {
    this.state.pattern = pattern
  }
  
  setPatternFromMood(mood: string): void {
    const pattern = this.moodPatternMap[mood]
    if (pattern && pattern in this.patterns) {
      this.state.pattern = pattern as MovementPattern
    }
  }
  
  setSpeed(speed: number): void {
    this.state.speed = Math.max(0, Math.min(1, speed))
  }
  
  setRange(range: number): void {
    this.state.range = Math.max(0, Math.min(1, range))
  }
  
  setSyncToBpm(sync: boolean): void {
    this.state.syncToBpm = sync
  }
  
  setMirrorMode(mirror: boolean): void {
    this.state.mirrorMode = mirror
  }
  
  getState(): MovementState {
    return { ...this.state }
  }
  
  calculateMirrored(
    metrics: AudioMetrics,
    beatState: BeatState,
    fixtureIndex: number,
    totalFixtures: number
  ): MovementOutput {
    const base = this.calculate(metrics, beatState)
    
    if (!this.state.mirrorMode) return base
    
    const isEven = fixtureIndex % 2 === 0
    
    return {
      ...base,
      pan: isEven ? base.pan : 1 - base.pan,
    }
  }
  
  triggerEvent(eventType: string, intensity: number = 1): void {
    switch (eventType) {
      case 'drop':
        this.state.speed = Math.min(1, this.state.speed * 1.5)
        this.state.range = Math.min(1, this.state.range * 1.2)
        break
      case 'build':
        this.state.speed = Math.min(1, this.state.speed * 1.1 * intensity)
        break
      case 'break':
        this.state.speed = this.state.speed * 0.5
        this.state.range = this.state.range * 0.7
        break
    }
  }
}
