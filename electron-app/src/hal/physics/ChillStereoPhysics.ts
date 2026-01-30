/**
 * WAVE 1038: THE ABYSSAL SWAY - La Marea Viva
 * 
 * THE SERPENTINE SINE - Matematicas de Desfase
 * - FRONT: Oscila Izq <-> Der con Fase 0
 * - BACK:  Oscila Izq <-> Der con Fase 90 (retardo)
 * - MOVER: Oscila Izq <-> Der con Fase 180 (opuesto al Front)
 * 
 * @module hal/physics/ChillStereoPhysics
 * @version WAVE 1038 - THE ABYSSAL SWAY
 */

import type { ElementalModifiers } from '../../engine/physics/ElementalModifiers';

export interface ChillPhysicsInput {
  bass: number
  mid: number
  treble: number
  energy: number
  isRealSilence: boolean
  isAGCTrap: boolean
  texture?: 'clean' | 'warm' | 'harsh' | 'noisy'
  clarity?: number
  subBass?: number
  spectralCentroid?: number
  air?: number
}

export interface ChillPhysicsResult {
  frontParIntensityL: number
  frontParIntensityR: number
  backParIntensityL: number
  backParIntensityR: number
  moverIntensityL: number
  moverIntensityR: number
  frontParIntensity: number
  backParIntensity: number
  moverIntensity: number
  moverActive: boolean
  physicsApplied: 'chill'
  swayState?: {
    speedFactor: number
    swayPhase: number
    balanceFront: number
    balanceBack: number
    balanceMover: number
  }
  fluidState?: {
    viscosity: number
    breathPhase: number
    driftPhaseL: number
    driftPhaseR: number
    stereoOffset: number
  }
  reef?: {
    thermalEnergy: number
    activeBubbles: number
    oceanPulse: number
    lighthousePan: number
    lighthouseTilt: number
  }
}

export interface LightBubble {
  laneIndex: number
  progress: number
  speed: number
  size: number
  hueOffset: number
  birthFrame: number
  isPopping: boolean
}

class PerlinNoise {
  private permutation: number[] = []
  
  constructor(seed: number = 42) {
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(this.seededRandom(seed + i) * (i + 1))
      ;[this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]
    }
    this.permutation = [...this.permutation, ...this.permutation]
  }
  
  private seededRandom(x: number): number {
    const sin = Math.sin(x * 12.9898 + 78.233) * 43758.5453
    return sin - Math.floor(sin)
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a)
  }
  
  private grad(hash: number, x: number): number {
    return (hash & 1) === 0 ? x : -x
  }
  
  public noise1D(x: number): number {
    const X = Math.floor(x) & 255
    const xf = x - Math.floor(x)
    const u = this.fade(xf)
    const a = this.permutation[X]
    const b = this.permutation[X + 1]
    return this.lerp(this.grad(a, xf), this.grad(b, xf - 1), u)
  }
}

export class ChillStereoPhysics {
  private readonly SWAY_BASE_SPEED = 0.0008
  private readonly SWAY_ENERGY_MULTIPLIER = 0.003
  private readonly SWAY_MAX_SPEED = 0.006
  private readonly PHASE_OFFSET_BACK = Math.PI / 2
  private readonly PHASE_OFFSET_MOVER = Math.PI
  private readonly AMBIENT_FLOOR = 0.15
  private readonly FRONT_FLOOR = 0.12
  private readonly BACK_FLOOR = 0.18
  private readonly MOVER_FLOOR = 0.10
  private readonly INTENSITY_CEILING = 0.75
  // 🐍 WAVE 1038.1: ENFORCE THE SWAY - Contraste agresivo L/R
  private readonly SWAY_DEPTH_FRONT = 0.85        // Era 0.70 - Contraste más fuerte
  private readonly SWAY_DEPTH_BACK = 0.75         // Era 0.55 - Back también balancea más
  private readonly SWAY_DEPTH_MOVER = 0.90        // Era 0.85 - Movers casi 100% swing
  private readonly SPARKLE_AIR_THRESHOLD = 0.1
  private readonly SPARKLE_INTENSITY = 0.12
  private readonly SPARKLE_SPEED = 0.07
  // 🚑 WAVE 1038.1: BUBBLE THROTTLE - Calmar el jacuzzi
  private readonly HEAT_CHARGE_RATE = 0.03        // Era 0.04 - Más lento
  private readonly HEAT_DECAY_RATE = 0.97         // Era 0.96 - Decae más rápido
  private readonly BUBBLE_SPAWN_THRESHOLD = 0.55  // Era 0.45 - Más difícil disparar
  private readonly BUBBLE_COOLDOWN_FRAMES = 90    // Era 60 - 1.5s entre burbujas
  private readonly TOTAL_LANES = 5
  private readonly BUBBLE_BASE_SPEED = 0.008      // Era 0.012 - Burbujas más lentas (viscosidad)
  private readonly BUBBLE_SIZE_MIN = 0.6
  private readonly BUBBLE_SIZE_MAX = 1.4
  private readonly MAX_ACTIVE_BUBBLES = 5         // Era 8 - Menos burbujas simultáneas
  private readonly BUBBLE_POP_INTENSITY = 1.5
  private readonly BUBBLE_POP_DURATION = 6
  private readonly ATTACK_TIME_SECONDS = 0.3
  private readonly DECAY_TIME_SECONDS = 1.2
  private readonly FRAMES_PER_SECOND = 60
  private readonly ATTACK_FACTOR = 1 - Math.exp(-1 / (this.ATTACK_TIME_SECONDS * this.FRAMES_PER_SECOND))
  private readonly DECAY_FACTOR = 1 - Math.exp(-1 / (this.DECAY_TIME_SECONDS * this.FRAMES_PER_SECOND))
  private readonly BREATH_PERIOD_SECONDS = 8
  private readonly LIGHTHOUSE_FREQUENCY = 0.08
  private readonly LIGHTHOUSE_AMPLITUDE = 0.25
  
  private frameCount = 0
  private swayPhase = 0
  private currentSpeedFactor = this.SWAY_BASE_SPEED
  private frontBaseVal = this.FRONT_FLOOR
  private backBaseVal = this.BACK_FLOOR
  private moverBaseVal = this.MOVER_FLOOR
  private targetFront = this.FRONT_FLOOR
  private targetBack = this.BACK_FLOOR
  private targetMover = this.MOVER_FLOOR
  private smoothBass = 0.1
  private smoothMid = 0.1
  private smoothTreble = 0.05
  private smoothEnergy = 0.1
  private currentViscosity = 0.7
  private breathPhase = 0
  private lighthousePhase = 0
  private thermalEnergy = 0
  private bubbleCooldown = 0
  private activeBubbles: LightBubble[] = []
  private laneSpawnCounter = 0
  private perlin = new PerlinNoise(42)
  private noiseTime = 0
  
  constructor() {
    console.log('[ChillStereoPhysics] WAVE 1038: THE ABYSSAL SWAY initialized')
  }
  
  public applyZones(input: ChillPhysicsInput): ChillPhysicsResult {
    this.frameCount++
    const { bass, mid, treble, energy, isRealSilence, isAGCTrap, texture = 'clean', subBass, air = 0 } = input
    
    this.adaptViscosity(texture)
    this.smoothInputs(bass, mid, treble, energy)
    
    const targetSpeed = Math.min(this.SWAY_MAX_SPEED, this.SWAY_BASE_SPEED + this.smoothEnergy * this.SWAY_ENERGY_MULTIPLIER)
    this.currentSpeedFactor = this.currentSpeedFactor * 0.98 + targetSpeed * 0.02
    
    this.swayPhase += this.currentSpeedFactor * this.FRAMES_PER_SECOND
    if (this.swayPhase > Math.PI * 2) this.swayPhase -= Math.PI * 2
    
    const balanceFront = Math.sin(this.swayPhase)
    const balanceBack = Math.sin(this.swayPhase - this.PHASE_OFFSET_BACK)
    const balanceMover = Math.sin(this.swayPhase - this.PHASE_OFFSET_MOVER)
    
    this.calculateTargets(texture, subBass)
    
    const silenceBoost = (isRealSilence || isAGCTrap) ? 3.0 : 1.0
    this.frontBaseVal = this.tidalFilter(this.frontBaseVal, this.targetFront, silenceBoost)
    this.backBaseVal = this.tidalFilter(this.backBaseVal, this.targetBack, silenceBoost)
    this.moverBaseVal = this.tidalFilter(this.moverBaseVal, this.targetMover, silenceBoost)
    
    const highMid = (mid + treble) * 0.5
    this.updateHeatAccumulator(subBass ?? bass, highMid)
    const bubbleContribution = this.processLightBubbles(balanceFront)
    
    const breathMod = this.calculateBreathing()
    const lighthouse = this.updateLighthouse()
    const sparkle = this.calculateSparkle(air, texture)
    
    // 🚑 NaN Hunter - DIAGNOSTIC: Log all base values before applyBalance
    if (isNaN(this.backBaseVal) || isNaN(sparkle) || isNaN(breathMod)) {
      console.warn('[SWAY] PRE-APPLYBALANCE NaN! backBase:', this.backBaseVal, 'sparkle:', sparkle, 'breathMod:', breathMod)
    }
    
    const frontL = this.applyBalance(this.frontBaseVal + bubbleContribution.front + breathMod * 0.03, balanceFront, this.SWAY_DEPTH_FRONT, 'left')
    const frontR = this.applyBalance(this.frontBaseVal + bubbleContribution.front + breathMod * 0.03, balanceFront, this.SWAY_DEPTH_FRONT, 'right')
    const backL = this.applyBalance(this.backBaseVal + sparkle + breathMod * 0.04, balanceBack, this.SWAY_DEPTH_BACK, 'left')
    const backR = this.applyBalance(this.backBaseVal + sparkle + breathMod * 0.04, balanceBack, this.SWAY_DEPTH_BACK, 'right')
    const moverL = this.applyBalance(this.moverBaseVal + bubbleContribution.moverL + breathMod * 0.02, balanceMover, this.SWAY_DEPTH_MOVER, 'left')
    const moverR = this.applyBalance(this.moverBaseVal + bubbleContribution.moverR + breathMod * 0.02, balanceMover, this.SWAY_DEPTH_MOVER, 'right')
    
    const finalFrontL = this.clampIntensity(frontL)
    const finalFrontR = this.clampIntensity(frontR)
    const finalBackL = this.clampIntensity(backL)
    const finalBackR = this.clampIntensity(backR)
    const finalMoverL = this.clampIntensity(moverL)
    const finalMoverR = this.clampIntensity(moverR)
    
    if (this.frameCount % 90 === 0) {
      console.log('[SWAY] Phase:' + (this.swayPhase * 180 / Math.PI).toFixed(0) + ' Bal:F' + balanceFront.toFixed(2) + ' B' + balanceBack.toFixed(2) + ' M' + balanceMover.toFixed(2))
    }
    
    return {
      frontParIntensityL: finalFrontL, frontParIntensityR: finalFrontR,
      backParIntensityL: finalBackL, backParIntensityR: finalBackR,
      moverIntensityL: finalMoverL, moverIntensityR: finalMoverR,
      frontParIntensity: (finalFrontL + finalFrontR) * 0.5,
      backParIntensity: (finalBackL + finalBackR) * 0.5,
      moverIntensity: (finalMoverL + finalMoverR) * 0.5,
      moverActive: (finalMoverL + finalMoverR) * 0.5 > this.MOVER_FLOOR + 0.05,
      physicsApplied: 'chill',
      swayState: { speedFactor: this.currentSpeedFactor, swayPhase: this.swayPhase, balanceFront, balanceBack, balanceMover },
      fluidState: { viscosity: this.currentViscosity, breathPhase: this.breathPhase, driftPhaseL: this.noiseTime, driftPhaseR: this.noiseTime + 0.5, stereoOffset: 0.5 },
      reef: { thermalEnergy: this.thermalEnergy, activeBubbles: this.activeBubbles.length, oceanPulse: balanceFront, lighthousePan: lighthouse.panOffset, lighthouseTilt: lighthouse.tiltOffset }
    }
  }
  
  private applyBalance(baseIntensity: number, balance: number, depth: number, side: 'left' | 'right'): number {
    // 🚑 WAVE 1038.1: NaN HUNTER - Defensive validation
    if (isNaN(baseIntensity) || isNaN(balance) || isNaN(depth)) {
      console.warn('[SWAY] NaN detected! base:', baseIntensity, 'bal:', balance, 'depth:', depth)
      return this.BACK_FLOOR // Safe fallback
    }
    
    const leftBias = (-balance + 1) / 2
    const rightBias = (balance + 1) / 2
    let multiplier: number
    
    if (side === 'left') {
      multiplier = (1 - depth) + depth * leftBias * 2
      multiplier = Math.min(1.0, Math.max(1 - depth, multiplier))
    } else {
      multiplier = (1 - depth) + depth * rightBias * 2
      multiplier = Math.min(1.0, Math.max(1 - depth, multiplier))
    }
    
    const result = baseIntensity * multiplier
    
    // 🚑 Final NaN guard
    if (isNaN(result)) {
      console.warn('[SWAY] NaN in result! Returning floor.')
      return this.BACK_FLOOR
    }
    
    return result
  }
  
  private clampIntensity(value: number): number {
    // 🚑 WAVE 1038.1: NaN guard en clamp
    if (isNaN(value)) {
      console.warn('[SWAY] NaN in clampIntensity! Returning AMBIENT_FLOOR')
      return this.AMBIENT_FLOOR
    }
    return Math.max(this.AMBIENT_FLOOR, Math.min(this.INTENSITY_CEILING, value))
  }
  
  private adaptViscosity(texture: string): void {
    let targetViscosity = 0.70
    if (texture === 'warm') targetViscosity = 0.80
    else if (texture === 'clean') targetViscosity = 0.65
    else if (texture === 'harsh' || texture === 'noisy') targetViscosity = 0.75
    this.currentViscosity = this.currentViscosity * 0.95 + targetViscosity * 0.05
  }
  
  private smoothInputs(bass: number, mid: number, treble: number, energy: number): void {
    // 🚑 NaN Hunter - Validate inputs
    if (isNaN(bass) || isNaN(mid) || isNaN(treble) || isNaN(energy)) {
      console.warn('[SWAY] NaN in INPUT! bass:', bass, 'mid:', mid, 'treble:', treble, 'energy:', energy)
      bass = isNaN(bass) ? 0 : bass
      mid = isNaN(mid) ? 0 : mid
      treble = isNaN(treble) ? 0 : treble
      energy = isNaN(energy) ? 0 : energy
    }
    
    const sf = this.currentViscosity
    this.smoothBass = this.smoothBass * sf + bass * (1 - sf)
    this.smoothMid = this.smoothMid * sf + mid * (1 - sf)
    this.smoothTreble = this.smoothTreble * sf + treble * (1 - sf)
    this.smoothEnergy = this.smoothEnergy * sf + energy * (1 - sf)
  }
  
  private calculateTargets(texture: string, subBass?: number): void {
    // 🚑 NaN Hunter - Validar smooth values
    if (isNaN(this.smoothBass) || isNaN(this.smoothMid) || isNaN(this.smoothTreble) || isNaN(this.smoothEnergy)) {
      console.warn('[SWAY] NaN in smooth values! Bass:', this.smoothBass, 'Mid:', this.smoothMid, 'Treble:', this.smoothTreble, 'Energy:', this.smoothEnergy)
      this.smoothBass = 0.1
      this.smoothMid = 0.05
      this.smoothTreble = 0.05
      this.smoothEnergy = 0.1
    }
    
    const bassSource = subBass ?? this.smoothBass
    this.targetFront = Math.max(this.FRONT_FLOOR, Math.min(0.65, bassSource * 0.5 + this.smoothEnergy * 0.3))
    const trebleInf = texture === 'warm' ? 0 : this.smoothTreble * 0.2
    this.targetBack = Math.max(this.BACK_FLOOR, this.BACK_FLOOR + this.smoothEnergy * 0.3 + trebleInf)
    const percRej = Math.max(0.4, 1 - this.smoothTreble * 1.5)
    this.targetMover = Math.max(this.MOVER_FLOOR, this.smoothMid * 0.5 * percRej)
  }
  
  private tidalFilter(current: number, target: number, silenceBoost: number): number {
    // 🚑 NaN Hunter - Defensive validation
    if (isNaN(current) || isNaN(target) || isNaN(silenceBoost)) {
      console.warn('[SWAY] NaN in tidalFilter! current:', current, 'target:', target, 'silenceBoost:', silenceBoost)
      return this.BACK_FLOOR  // Safe fallback
    }
    
    if (target > current) return current + (target - current) * this.ATTACK_FACTOR
    return current + (target - current) * this.DECAY_FACTOR * silenceBoost
  }
  
  private calculateSparkle(air: number, texture: string): number {
    // 🚑 NaN Hunter - Validate air input
    if (isNaN(air)) {
      console.warn('[SWAY] NaN in air! Defaulting to 0')
      air = 0
    }
    
    if (air < this.SPARKLE_AIR_THRESHOLD || texture === 'warm') return 0
    const lfo = Math.sin(this.frameCount * this.SPARKLE_SPEED) * 0.5 + 0.5
    const result = lfo * this.SPARKLE_INTENSITY * Math.min(1, (air - this.SPARKLE_AIR_THRESHOLD) * 5)
    
    if (isNaN(result)) {
      console.warn('[SWAY] NaN in sparkle calculation!')
      return 0
    }
    
    return result
  }
  
  private calculateBreathing(): number {
    const speed = (2 * Math.PI) / (this.BREATH_PERIOD_SECONDS * this.FRAMES_PER_SECOND)
    this.breathPhase += speed
    if (this.breathPhase > 2 * Math.PI) this.breathPhase -= 2 * Math.PI
    const result = (Math.sin(this.breathPhase) * 0.5 + 0.5) * 0.1
    
    // 🚑 NaN Hunter - Validate breathing calculation
    if (isNaN(result)) {
      console.warn('[SWAY] NaN in breathing! breathPhase:', this.breathPhase)
      this.breathPhase = 0
      return 0.05  // Mid-breath position
    }
    
    return result
  }
  
  private updateLighthouse(): { panOffset: number; tiltOffset: number } {
    this.lighthousePhase += (2 * Math.PI * this.LIGHTHOUSE_FREQUENCY) / this.FRAMES_PER_SECOND
    if (this.lighthousePhase > 2 * Math.PI) this.lighthousePhase -= 2 * Math.PI
    return { panOffset: Math.sin(this.lighthousePhase) * this.LIGHTHOUSE_AMPLITUDE, tiltOffset: Math.sin(this.lighthousePhase * 0.7) * (this.LIGHTHOUSE_AMPLITUDE * 0.4) }
  }
  
  private updateHeatAccumulator(bass: number, highMid: number): void {
    this.thermalEnergy += Math.max(bass, highMid * 0.7) * this.HEAT_CHARGE_RATE
    this.thermalEnergy *= this.HEAT_DECAY_RATE
    this.thermalEnergy = Math.min(1.0, Math.max(0, this.thermalEnergy))
    if (this.bubbleCooldown > 0) this.bubbleCooldown--
    if (this.thermalEnergy > this.BUBBLE_SPAWN_THRESHOLD && this.bubbleCooldown === 0 && this.activeBubbles.length < this.MAX_ACTIVE_BUBBLES) {
      this.spawnLightBubble()
      this.thermalEnergy *= 0.6
      this.bubbleCooldown = this.BUBBLE_COOLDOWN_FRAMES
    }
  }
  
  private spawnLightBubble(): void {
    const laneIndex = this.laneSpawnCounter % this.TOTAL_LANES
    this.laneSpawnCounter++
    const speedVar = (this.frameCount % 17) / 17
    const sizeVar = (this.frameCount % 23) / 23
    this.activeBubbles.push({
      laneIndex,
      progress: 0,
      speed: this.BUBBLE_BASE_SPEED * (0.6 + speedVar * 0.8),
      size: this.BUBBLE_SIZE_MIN + sizeVar * (this.BUBBLE_SIZE_MAX - this.BUBBLE_SIZE_MIN),
      hueOffset: 0,
      birthFrame: this.frameCount,
      isPopping: false
    })
  }
  
  private processLightBubbles(currentBalance: number): { front: number; moverL: number; moverR: number } {
    const result = { front: 0, moverL: 0, moverR: 0 }
    this.activeBubbles = this.activeBubbles.filter(bubble => {
      bubble.progress += bubble.speed
      const baseInt = 0.2 * bubble.size
      if (bubble.progress < 1.5) {
        result.front += baseInt * Math.sin((bubble.progress / 1.5) * Math.PI)
      } else if (bubble.progress < 3.0) {
        const env = Math.sin(((bubble.progress - 1.5) / 1.5) * Math.PI)
        const contrib = baseInt * env
        if (currentBalance < 0) { result.moverL += contrib * (1 + Math.abs(currentBalance) * 0.5); result.moverR += contrib * 0.3 }
        else { result.moverR += contrib * (1 + currentBalance * 0.5); result.moverL += contrib * 0.3 }
      } else if (bubble.progress < 3.0 + this.BUBBLE_POP_DURATION / 60) {
        bubble.isPopping = true
        const popInt = (1 - (bubble.progress - 3.0) * 60 / this.BUBBLE_POP_DURATION) * baseInt * this.BUBBLE_POP_INTENSITY
        if (currentBalance < 0) result.moverL += popInt; else result.moverR += popInt
      } else return false
      return true
    })
    return result
  }
  
  public apply(palette: any, metrics: any, _mods?: ElementalModifiers, _bpm?: number): any {
    // 🚑 NaN Hunter - Validate ALL inputs with safe defaults
    const safeMetrics = {
      normalizedBass: metrics.normalizedBass ?? 0,
      normalizedMid: metrics.normalizedMid ?? 0,
      normalizedTreble: metrics.normalizedTreble ?? 0,
      normalizedEnergy: metrics.normalizedEnergy ?? 0,
      texture: metrics.texture ?? 'clean',
      clarity: metrics.clarity ?? 0.5,
      subBass: metrics.subBass,
      spectralCentroid: metrics.spectralCentroid,
      treble: metrics.treble ?? metrics.normalizedTreble ?? 0,
      air: metrics.air
    }
    
    // Calculate safe air value (treble-based fallback)
    const airValue = (safeMetrics.air !== undefined && !isNaN(safeMetrics.air)) 
      ? safeMetrics.air 
      : (safeMetrics.treble * 0.5)
    
    const result = this.applyZones({
      bass: safeMetrics.normalizedBass, 
      mid: safeMetrics.normalizedMid, 
      treble: safeMetrics.normalizedTreble,
      energy: safeMetrics.normalizedEnergy, 
      isRealSilence: false, 
      isAGCTrap: false,
      texture: safeMetrics.texture, 
      clarity: safeMetrics.clarity, 
      subBass: safeMetrics.subBass,
      spectralCentroid: safeMetrics.spectralCentroid, 
      air: airValue
    })
    return {
      palette, breathPhase: result.fluidState?.breathPhase ?? 0, isStrobe: false, dimmerModulation: 0,
      zoneIntensities: {
        frontL: result.frontParIntensityL, frontR: result.frontParIntensityR,
        backL: result.backParIntensityL, backR: result.backParIntensityR,
        moverL: result.moverIntensityL, moverR: result.moverIntensityR,
        front: result.frontParIntensity, back: result.backParIntensity, mover: result.moverIntensity
      },
      debugInfo: {
        bassHit: false, midHit: false, padActive: result.moverActive, twilightPhase: this.breathPhase,
        crossFadeRatio: 0, viscosity: result.fluidState?.viscosity ?? this.currentViscosity,
        swayPhase: result.swayState?.swayPhase, swaySpeed: result.swayState?.speedFactor,
        balanceFront: result.swayState?.balanceFront, balanceBack: result.swayState?.balanceBack, balanceMover: result.swayState?.balanceMover
      }
    }
  }
  
  public reset(): void {
    this.frameCount = 0; this.swayPhase = 0; this.currentSpeedFactor = this.SWAY_BASE_SPEED
    this.frontBaseVal = this.FRONT_FLOOR; this.backBaseVal = this.BACK_FLOOR; this.moverBaseVal = this.MOVER_FLOOR
    this.targetFront = this.FRONT_FLOOR; this.targetBack = this.BACK_FLOOR; this.targetMover = this.MOVER_FLOOR
    this.smoothBass = 0.1; this.smoothMid = 0.1; this.smoothTreble = 0.05; this.smoothEnergy = 0.1
    this.breathPhase = 0; this.lighthousePhase = 0; this.thermalEnergy = 0; this.bubbleCooldown = 0
    this.activeBubbles = []; this.laneSpawnCounter = 0; this.noiseTime = 0
  }
}

export const chillStereoPhysics = new ChillStereoPhysics()
