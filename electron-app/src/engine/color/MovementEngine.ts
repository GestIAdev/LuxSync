/**
 * MOVEMENT ENGINE - LISSAJOUS PATTERNS
 * 
 * MIGRADO desde: demo/selene-movement-engine.js
 * 
 * WAVE 273: ELEMENTAL INJECTION
 * El elemento zodiacal modula:
 * - Aire (jitterAmplitude > 0): Añade vibración orgánica al movimiento
 * - Agua (decayMultiplier > 1): Movimiento más suave y lento
 * - Fuego (decayMultiplier < 1): Movimiento más reactivo
 * - Tierra (jitterAmplitude = 0): Movimiento sólido, sin vibración
 * 
 * Patrones de movimiento para moving heads:
 * - circle, infinity, sweep, cloud, waves, static
 * - Sincronizacion con BPM
 * - Phase offset por fixture (movimiento organico)
 * - Entropia determinista (sin Math.random)
 */

// WAVE 273: Elemental Modifiers
import { ElementalModifiers } from '../physics/ElementalModifiers';

import type {
  MovementState,
  MovementPattern,
  VisualConfig,
  AudioMetrics,
} from '../types'
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
  
  // ---------------------------------------------------------------------------
  // ??? WAVE 24.6: HARDWARE SAFETY - Smoothed position tracking
  // Previene latigazos mec�nicos en motores de moving heads
  // ---------------------------------------------------------------------------
  private lastPan = 0.5   // Centro por defecto
  private lastTilt = 0.5  // Centro por defecto
  
  private readonly patterns: Record<string, PatternConfig> = {
    // -----------------------------------------------------------------------
    // ?? UI PATTERNS (match MovementControl.tsx exactly)
    // -----------------------------------------------------------------------
    lissajous: { freqX: 2, freqY: 3, phaseShift: Math.PI / 4, amplitude: 0.8 },  // Classic Lissajous 2:3
    circle: { freqX: 1, freqY: 1, phaseShift: Math.PI / 2, amplitude: 0.8 },     // Perfect circle
    wave: { freqX: 1, freqY: 2, phaseShift: Math.PI / 3, amplitude: 0.6 },       // Wave pattern
    figure8: { freqX: 2, freqY: 1, phaseShift: 0, amplitude: 0.7 },              // Figure 8 (infinity)
    scan: { freqX: 1, freqY: 0.1, phaseShift: 0, amplitude: 0.9 },               // Horizontal scan
    random: { freqX: 1.7, freqY: 2.3, phaseShift: Math.PI / 7, amplitude: 0.5 }, // Organic/random-like
    
    // --- Legacy patterns (backward compatibility) ---
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
  
  // ?? WAVE 13: PALETTE ? PATTERN MAP
  // Cuando el usuario selecciona una paleta manual, el movimiento debe coincidir
  private readonly palettePatternMap: Record<string, string> = {
    'fuego': 'infinity',   // ?? Latino caliente ? Figure 8 apasionado
    'fire': 'infinity',    // Alias ingl�s
    'hielo': 'cloud',      // ?? Arctic dreams ? Suave, et�reo
    'ice': 'cloud',        // Alias ingl�s
    'selva': 'waves',      // ?? Tropical storm ? Ondulante, org�nico
    'jungle': 'waves',     // Alias ingl�s
    'neon': 'sweep',       // ? Cyberpunk ? Barridos electr�nicos
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
   * 🎚️ WAVE 275: Calcula intensidad por fixture basada en TREBLE
   * 
   * Los movers son el "alma melódica" - responden a melodías, voces y efectos.
   * El treble se empuja x1.3 porque naturalmente tiene menos energía que bass.
   */
  private calculateIntensity(
    audioData: { energy: number; bass: number; treble: number },
    fixtureIndex: number,
    totalFixtures: number
  ): number {
    // WAVE 275: Movers = Treble (empujado 1.3x) + un poco de energy para suavidad
    const treblePushed = audioData.treble * 1.3;
    const baseIntensity = treblePushed * 0.8 + audioData.energy * 0.2;
    
    const waveOffset = Math.sin(this.time * 2 + (fixtureIndex / totalFixtures) * Math.PI * 2)
    const waveIntensity = baseIntensity + waveOffset * 0.15
    
    // Sin mínimo artificial - si no hay agudos, no hay luz
    return Math.max(0, Math.min(1, waveIntensity))
  }
  
  /**
   * Calcula posicion para un solo fixture
   * 
   * WAVE 273: Acepta modificadores elementales para modulación zodiacal:
   * - jitterAmplitude: Añade vibración orgánica (Aire)
   * - decayMultiplier: Modifica el smoothing (Agua = más suave)
   * 
   * @param metrics - Métricas de audio
   * @param beatState - Estado del beat
   * @param deltaTime - Delta time en ms
   * @param mods - Modificadores elementales opcionales
   */
  calculate(
    metrics: AudioMetrics,
    beatState: BeatState,
    deltaTime: number = 16,
    mods?: ElementalModifiers
  ): MovementOutput {
    // WAVE 273: Extraer modificadores elementales
    const jitter = mods?.jitterAmplitude ?? 0.0;
    const decayMod = mods?.decayMultiplier ?? 1.0;
    
    // ?? WAVE 10 FIX: Speed SIEMPRE afecta el movimiento
    // Multiplicador base: speed va de 0.01 (muy lento) a 1.0 (normal)
    const baseSpeedFactor = this.state.speed * 0.5  // Reducir velocidad general
    
    // Si syncToBpm est� activo, el BPM modifica la velocidad
    const bpmFactor = this.state.syncToBpm ? (beatState.bpm / 120) : 1.0
    
    // Incremento de tiempo respetando la velocidad configurada
    this.time += (deltaTime / 1000) * baseSpeedFactor * bpmFactor
    
    // La fase SIEMPRE se calcula desde this.time (que respeta speed)
    this.phase = this.time * Math.PI * 2
    
    let pan = 0.5
    let tilt = 0.5
    
    // ?? FIX: Use pattern directly (lissajous now has its own config)
    const patternName = this.state.pattern
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
    
    // -----------------------------------------------------------------------
    // WAVE 273: ELEMENTAL JITTER (Aire = vibración orgánica)
    // Inyectamos micro-oscilaciones deterministas para dar "vida" al movimiento
    // Fuego/Tierra/Agua tienen jitter = 0, Aire tiene jitter = 0.15
    // -----------------------------------------------------------------------
    if (jitter > 0) {
      const jitterFreq = 7.3; // Frecuencia de vibración (Hz)
      const now = Date.now() * 0.001;
      const jitterX = Math.sin(now * jitterFreq * Math.PI * 2) * jitter;
      const jitterY = Math.cos(now * jitterFreq * 1.3 * Math.PI * 2) * jitter;
      pan += jitterX;
      tilt += jitterY;
    }
    
    pan = Math.max(0, Math.min(1, pan))
    tilt = Math.max(0, Math.min(1, tilt))
    
    // -----------------------------------------------------------------------
    // ??? WAVE 24.6: INTERPOLACIÓN OBLIGATORIA (Hardware Safety)
    // Los motores de moving heads NO pueden teletransportarse.
    // Usamos lerp para suavizar la transición hacia el target.
    // smoothFactor bajo = movimiento más suave pero con más latencia
    // smoothFactor alto = respuesta rápida pero más brusca
    // 
    // WAVE 273: decayMod modifica el smoothing
    // Agua (decayMod > 1) = más suave, Fuego (decayMod < 1) = más reactivo
    // -----------------------------------------------------------------------
    const baseSmoothFactor = this.smoothing * 0.15  // 0.8 * 0.15 = 0.12 → suave
    const effectiveSmoothFactor = baseSmoothFactor / decayMod; // Agua = más lento
    this.lastPan += (pan - this.lastPan) * effectiveSmoothFactor
    this.lastTilt += (tilt - this.lastTilt) * effectiveSmoothFactor
    
    // Clamp final por seguridad
    this.lastPan = Math.max(0, Math.min(1, this.lastPan))
    this.lastTilt = Math.max(0, Math.min(1, this.lastTilt))
    
    // Movement log disabled - too spammy
    // if (Math.random() < 0.01) {
    //   console.log(`[Movement] Pattern: ${patternName} | Pan: ${pan.toFixed(2)} Tilt: ${tilt.toFixed(2)}`)
    // }
    
    return {
      pan: this.lastPan,
      tilt: this.lastTilt,
      speed: this.state.speed,
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
    console.log(`[MovementEngine] ? Speed set to: ${this.state.speed.toFixed(3)}`)
  }
  
  setRange(range: number): void {
    this.state.range = Math.max(0, Math.min(1, range))
    console.log(`[MovementEngine] ?? Range set to: ${this.state.range.toFixed(3)}`)
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
  
  /**
   * ?? WAVE 13: Get pattern suggestion based on palette
   * When user selects a manual palette, return the matching pattern
   */
  getPatternForPalette(paletteId: string): string | null {
    const normalized = paletteId.toLowerCase()
    return this.palettePatternMap[normalized] ?? null
  }
  
  /**
   * ?? WAVE 13: Set pattern from palette (for Flow mode)
   * Returns true if a matching pattern was found and set
   */
  setPatternFromPalette(paletteId: string): boolean {
    const pattern = this.getPatternForPalette(paletteId)
    if (pattern && this.patterns[pattern]) {
      this.state.pattern = pattern as MovementPattern
      console.log(`[MovementEngine] ?? Palette "${paletteId}" ? Pattern "${pattern}"`)
      return true
    }
    return false
  }
  
  /**
   * ?? WAVE 13: Get pattern suggestion based on mood
   */
  getPatternForMood(mood: string): string | null {
    const normalized = mood.toLowerCase()
    return this.moodPatternMap[normalized] ?? null
  }
}
