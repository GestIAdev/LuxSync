/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🥁 CLAVE RHYTHM - LA CLAVE QUE MANDA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 700.6: NUEVO EFECTO FIESTA LATINA
 * 
 * CONCEPTO:
 * Basado en el patrón rítmico de clave 3-2 de la salsa/son cubano.
 * Tres golpes seguidos + pausa + dos golpes.
 * Cada golpe es un "hit" de color que también mueve los movers.
 * 
 * TIMING PATTERN:
 * 3-2 Clave: X..X...X....X..X.......
 *            │  │   │    │  │
 *            1  2   3    4  5
 *            └──3──┘    └2┘
 * 
 * COMPORTAMIENTO:
 * - 5 hits totales siguiendo el patrón de clave
 * - Cada hit: color vibrante + movimiento snap de movers
 * - Colores rotan: rojo → naranja → amarillo → verde → magenta
 * - Movers hacen snaps pequeños en cada hit (±30° pan)
 * - Intensidad varía: fuerte-medio-fuerte / medio-fuerte
 * 
 * PHYSICS:
 * - BPM-synced (el patrón completo dura 2 compases)
 * - Cada hit dura ~150ms (attack) + ~200ms (decay)
 * - Movers snapean en cada hit con aceleración latina (ease-out cúbico)
 * 
 * PERFECT FOR:
 * - Momentos de energía media-alta
 * - Cuando la percusión latina está marcada
 * - Agregar dinamismo sin ser spam
 * 
 * @module core/effects/library/ClaveRhythm
 * @version WAVE 700.6
 */

import { BaseEffect } from '../BaseEffect'
import {
  EffectTriggerConfig,
  EffectFrameOutput,
  EffectCategory,
  EffectZone,  // 🎨 WAVE 740: Para typing de zones
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface ClaveRhythmConfig {
  /** Timing del patrón 3-2 en beats (relativo al BPM) */
  clavePattern: number[]  // [0, 2, 3.5, 6, 7] = posición de cada hit en beats
  
  /** Duración del pre-ducking antes de cada hit (ms) - WAVE 805 */
  preDuckingMs: number
  
  /** Duración de attack de cada hit (ms) */
  hitAttackMs: number
  
  /** Duración de decay de cada hit (ms) */
  hitDecayMs: number
  
  /** Colores de cada hit (HSL) */
  hitColors: Array<{ h: number; s: number; l: number }>
  
  /** Intensidades de cada hit (0-1) */
  hitIntensities: number[]
  
  /** Amplitud del movimiento de pan en cada hit (grados) */
  panSnapAmplitude: number
  
  /** Amplitud del movimiento de tilt en cada hit (grados) */
  tiltSnapAmplitude: number
}

const DEFAULT_CONFIG: ClaveRhythmConfig = {
  // Patrón 3-2 clave (en beats de 1/8)
  clavePattern: [0, 2, 3.5, 6, 7],  // Hits en beats 0, 2, 3.5, 6, 7
  
  preDuckingMs: 50,  // 🌪️ WAVE 805: 50ms silencio antes de cada hit para visibility
  hitAttackMs: 120,
  hitDecayMs: 180,
  
  // Progresión de colores cálidos latinos
  hitColors: [
    { h: 0, s: 95, l: 55 },    // Rojo intenso
    { h: 25, s: 90, l: 60 },   // Naranja cálido
    { h: 45, s: 95, l: 65 },   // Amarillo dorado
    { h: 145, s: 85, l: 50 },  // Verde esmeralda
    { h: 320, s: 90, l: 60 },  // Magenta vibrante
  ],
  
  // 🔥 WAVE 770: INTENSIDADES A TOPE - El clave tiene que DESLUMBRAR
  // Patrón: FUERTE-medio-FUERTE / medio-FUERTE
  hitIntensities: [1.0, 0.85, 0.90, 0.85, 1.0],
  
  panSnapAmplitude: 35,   // ±35° de movimiento
  tiltSnapAmplitude: 20,  // ±20° de movimiento
}

// ═══════════════════════════════════════════════════════════════════════════
// CLAVE RHYTHM CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class ClaveRhythm extends BaseEffect {
  readonly effectType = 'clave_rhythm'
  readonly name = 'Clave Rhythm'
  readonly category: EffectCategory = 'physical'
  readonly priority = 72
  readonly mixBus = 'global' as const  // 🌪️ WAVE 805: Global para pre-ducking - STROBO LATINO
  
  private config: ClaveRhythmConfig
  private currentHit = 0
  private hitPhase: 'preDucking' | 'attack' | 'decay' | 'wait' = 'wait'  // 🌪️ WAVE 805: Pre-ducking añadido
  private phaseTimer = 0
  private currentColor: { h: number; s: number; l: number }
  private currentIntensity = 0
  private totalDurationMs = 0
  private hitTimingsMs: number[] = []
  private nextHitTimeMs = 0
  
  // 🥁 WAVE 700.7: Movement state - The Hips are back!
  private currentPanOffset = 0     // -1.0 to 1.0
  private currentTiltOffset = 0    // -1.0 to 1.0
  private targetPanOffset = 0
  private targetTiltOffset = 0
  private movementProgress = 0     // 0 to 1 for smooth interpolation
  
  constructor(config?: Partial<ClaveRhythmConfig>) {
    super('clave_rhythm')
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.currentColor = this.config.hitColors[0]
  }
  
  trigger(config: EffectTriggerConfig): void {
    super.trigger(config)
    
    this.currentHit = 0
    this.hitPhase = 'wait'
    this.phaseTimer = 0
    this.currentIntensity = 0
    
    // 🥁 WAVE 700.7: Reset movement state
    this.currentPanOffset = 0
    this.currentTiltOffset = 0
    this.targetPanOffset = 0
    this.targetTiltOffset = 0
    this.movementProgress = 1  // Start stable
    
    // Calcular timings basados en BPM
    this.calculateHitTimings()
    this.nextHitTimeMs = this.hitTimingsMs[0]
    
    console.log(`[ClaveRhythm 🥁] TRIGGERED! Pattern=3-2 Duration=${this.totalDurationMs}ms BPM=${this.musicalContext?.bpm || 'unknown'}`)
  }
  
  private calculateHitTimings(): void {
    const bpm = this.musicalContext?.bpm || 120
    const beatDurationMs = 60000 / bpm
    const eighthNoteDurationMs = beatDurationMs / 2
    
    this.hitTimingsMs = this.config.clavePattern.map(beat => beat * eighthNoteDurationMs)
    
    // Duración total: último hit + decay
    const lastHitTime = this.hitTimingsMs[this.hitTimingsMs.length - 1]
    this.totalDurationMs = lastHitTime + this.config.hitAttackMs + this.config.hitDecayMs + 200
  }
  
  update(deltaMs: number): void {
    if (this.phase === 'idle' || this.phase === 'finished') return
    
    this.elapsedMs += deltaMs
    this.phaseTimer += deltaMs
    
    // Check si es momento del siguiente hit
    if (this.hitPhase === 'wait' && this.elapsedMs >= this.nextHitTimeMs) {
      this.startHit()
    }
    
    // Actualizar fase actual
    switch (this.hitPhase) {
      case 'preDucking':
        // 🌪️ WAVE 805: Silencio pre-ducking para crear contraste
        this.currentIntensity = 0
        
        if (this.phaseTimer >= this.config.preDuckingMs) {
          // Pasar a attack después del silencio
          this.hitPhase = 'attack'
          this.phaseTimer = 0
        }
        break
        
      case 'attack':
        this.updateAttack()
        break
      case 'decay':
        this.updateDecay()
        break
      case 'wait':
        this.currentIntensity = 0
        break
    }
    
    // 🥁 WAVE 700.7: Update movement interpolation
    this.updateMovement(deltaMs)
    
    // Check si terminamos
    if (this.elapsedMs >= this.totalDurationMs) {
      this.phase = 'finished'
      console.log(`[ClaveRhythm 🥁] Completed (${this.config.clavePattern.length} hits, ${this.elapsedMs}ms)`)
    }
  }
  
  // 🥁 WAVE 700.7: Smooth movement interpolation
  private updateMovement(deltaMs: number): void {
    if (this.movementProgress >= 1) return
    
    // Velocidad de snap: llega al target en ~80ms (latina snappy)
    const snapSpeed = deltaMs / 80
    this.movementProgress = Math.min(1, this.movementProgress + snapSpeed)
    
    // Ease-out cúbico para el snap (rápido al inicio, suave al final)
    const eased = 1 - Math.pow(1 - this.movementProgress, 3)
    
    // Interpolar hacia el target
    this.currentPanOffset = this.currentPanOffset + (this.targetPanOffset - this.currentPanOffset) * eased
    this.currentTiltOffset = this.currentTiltOffset + (this.targetTiltOffset - this.currentTiltOffset) * eased
  }
  
  private startHit(): void {
    // 🌪️ WAVE 805: Empezar con pre-ducking para crear silencio
    this.hitPhase = 'preDucking'
    this.phaseTimer = 0
    
    // Color del hit actual
    const colorIndex = this.currentHit % this.config.hitColors.length
    this.currentColor = this.config.hitColors[colorIndex]
    
    // 🥁 WAVE 700.7: Calculate movement snap for this hit
    // El patrón 3-2 genera movimientos alternados como caderas latinas
    // Hits 0,1,2 (grupo 3): Alternan izquierda-derecha-centro
    // Hits 3,4 (grupo 2): Alternan derecha-izquierda
    const panAmplitude = this.config.panSnapAmplitude / 180  // Convert degrees to -1..1 range
    const tiltAmplitude = this.config.tiltSnapAmplitude / 90
    
    // Patrón de movimiento según hit (simulando cadera latina)
    const movementPatterns = [
      { pan: -panAmplitude, tilt: tiltAmplitude * 0.5 },   // Hit 0: Izquierda-arriba
      { pan: panAmplitude, tilt: -tiltAmplitude * 0.3 },   // Hit 1: Derecha-abajo
      { pan: 0, tilt: tiltAmplitude * 0.8 },               // Hit 2: Centro-arriba (climax grupo 3)
      { pan: panAmplitude * 0.7, tilt: 0 },                // Hit 3: Derecha-centro
      { pan: -panAmplitude * 0.5, tilt: tiltAmplitude },   // Hit 4: Izquierda-arriba (climax final)
    ]
    
    const pattern = movementPatterns[this.currentHit % movementPatterns.length]
    this.targetPanOffset = pattern.pan
    this.targetTiltOffset = pattern.tilt
    this.movementProgress = 0  // Start interpolation
  }
  
  private updateAttack(): void {
    const progress = Math.min(1, this.phaseTimer / this.config.hitAttackMs)
    
    // Ataque con punch (ease-out cúbico)
    const eased = 1 - Math.pow(1 - progress, 3)
    
    const hitIntensity = this.config.hitIntensities[this.currentHit] || 0.8
    this.currentIntensity = eased * hitIntensity * this.triggerIntensity
    
    if (progress >= 1) {
      this.hitPhase = 'decay'
      this.phaseTimer = 0
    }
  }
  
  private updateDecay(): void {
    const progress = Math.min(1, this.phaseTimer / this.config.hitDecayMs)
    
    // Decay suave (ease-in cuadrático)
    const eased = Math.pow(progress, 2)
    
    const hitIntensity = this.config.hitIntensities[this.currentHit] || 0.8
    this.currentIntensity = (1 - eased) * hitIntensity * this.triggerIntensity
    
    if (progress >= 1) {
      this.currentHit++
      
      // Preparar siguiente hit
      if (this.currentHit < this.config.clavePattern.length) {
        this.nextHitTimeMs = this.hitTimingsMs[this.currentHit]
        this.hitPhase = 'wait'
      } else {
        // Ya no hay más hits, esperar a que termine
        this.hitPhase = 'wait'
      }
      
      this.phaseTimer = 0
    }
  }
  
  getOutput(): EffectFrameOutput | null {
    if (this.phase === 'idle' || this.phase === 'finished') return null
    
    // 🌪️ WAVE 805: Durante pre-ducking, silenciar física completamente
    const isPreDucking = this.hitPhase === 'preDucking'
    
    if (isPreDucking) {
      // 🌪️ WAVE 805.3: Durante pre-ducking, apagar SOLO movers (no PARs)
      // PARs siguen con física reactiva, movers se silencian para contraste
      return {
        effectId: this.id,
        category: this.category,
        phase: this.phase,
        progress: this.elapsedMs / this.totalDurationMs,
        zones: ['movers'],
        intensity: 0,
        dimmerOverride: undefined,
        colorOverride: undefined,
        globalOverride: false,  // NO apagar física global
        zoneOverrides: {
          'movers': {
            color: { h: 0, s: 0, l: 0 },
            dimmer: 0,  // Movers apagados durante silencio
            movement: {
              pan: this.targetPanOffset,  // Pre-posicionar para el snap
              tilt: this.targetTiltOffset,
              isAbsolute: true,
              speed: 1.0,
            },
          }
        },
      }
    }
    
    // 🥁 WAVE 755: ClaveRhythm - EXCLUSIVO PARA MOVERS
    // Solo movers con movimiento ABSOLUTO (snap seco)
    // Flash Dorado: amber + white en cada hit
    
    // 🥁 WAVE 755: FLASH DORADO (latón de trompeta)
    // 🔥 WAVE 770: Subido white a 1.0 - ¡DESLUMBRA!
    const isInHit = this.hitPhase === 'attack' && this.currentIntensity > 0.7
    const goldenFlash = isInHit ? {
      white: 1.0,   // 🔥 WAVE 770: Flash blanco A TOPE
      amber: 1.0,   // Dorado a tope (como latón de trompeta)
    } : {}
    
    // 🥁 WAVE 755: Color BRILLANTE que fade a negro rápido
    const hitColor = {
      h: this.currentColor.h,
      s: this.currentColor.s,
      l: Math.min(75, this.currentColor.l + (this.currentIntensity * 15))
    }
    
    // 🥁 WAVE 755: SOLO MOVERS - No tocar front/back (WAVE 740: Si no está en keys, no se toca)
    // 🎚️ WAVE 780: blendMode 'max' - El clave SUMA energía, no la resta
    const zoneOverrides: EffectFrameOutput['zoneOverrides'] = {
      'movers': {
        color: hitColor,
        dimmer: this.currentIntensity,
        ...goldenFlash,  // 🥁 WAVE 755: Flash dorado en cada golpe
        blendMode: 'max',  // 🎚️ WAVE 780: HTP - El ritmo suma, nunca resta
        movement: {
          pan: this.currentPanOffset,
          tilt: this.currentTiltOffset,
          isAbsolute: true,   // 🥁 WAVE 750: ABSOLUTO - snap SECO
          speed: 1.0,         // Velocidad MÁXIMA
        },
      }
    }
    
    return {
      effectId: this.id,
      category: this.category,
      phase: this.phase,
      progress: this.elapsedMs / this.totalDurationMs,
      // 🔥 WAVE 740: zones derivado de zoneOverrides
      zones: Object.keys(zoneOverrides) as EffectZone[],
      intensity: this.currentIntensity,
      
      // 🔥 WAVE 740: Legacy fallback ELIMINADO
      dimmerOverride: undefined,
      colorOverride: undefined,
      
      globalOverride: false,  // 🌪️ WAVE 805: Durante flash, NO silenciar física (deja que se sume)
      
      // 🥁 WAVE 755: Movement override - ABSOLUTO para snaps secos
      movement: {
        pan: this.currentPanOffset,
        tilt: this.currentTiltOffset,
        isAbsolute: true,   // 🥁 WAVE 750: ABSOLUTO - el mover VA A ESTA POSICIÓN, no suavemente
        speed: 1.0,         // Velocidad máxima
      },
      
      // 🎨 WAVE 740: ZONE OVERRIDES - ÚNICA FUENTE DE VERDAD
      zoneOverrides,
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createClaveRhythm(config?: Partial<ClaveRhythmConfig>): ClaveRhythm {
  return new ClaveRhythm(config)
}
