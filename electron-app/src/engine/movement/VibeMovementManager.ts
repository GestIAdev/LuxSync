/**
 * WAVE 1155: THE CHOREOGRAPHER REBORN
 * 
 * FILOSOFIA: "HARMONIC MOTION"
 * El movimiento NO compite con efectos (Flash/Color).
 * El movimiento TRANSPORTA la luz. Es la danza, no el bailarin.
 * 
 * LA DOCENA DORADA: 12 patrones matematicamente puros.
 * 3 por genero + 1 extra para Techno (4 total).
 * Sin fallbacks raros. Sin patrones fantasma. Sin legacy.
 * 
 * ARQUITECTURA:
 *   TitanEngine -> VibeMovementManager -> { x: -1 to +1, y: -1 to +1 }
 * 
 * @layer ENGINE/MOVEMENT
 * @version WAVE 1155 - The Golden Dozen
 * @author PunkOpus
 */

// TYPES

/** Resultado de generacion de movimiento */
export interface MovementIntent {
  /** Posicion X normalizada (-1 a +1) */
  x: number
  /** Posicion Y normalizada (-1 a +1) */
  y: number
  /** Patron activo */
  pattern: string
  /** Velocidad normalizada (0-1) */
  speed: number
  /** Amplitud del movimiento (0-1) */
  amplitude: number
  /** Tipo de desfase de fase para HAL */
  phaseType?: 'linear' | 'polar'
  /** Debug: frecuencia usada */
  _frequency?: number
  /** Debug: phrase actual */
  _phrase?: number
}

/** Contexto de audio para generacion de movimiento */
export interface AudioContext {
  /** Energia general (0-1) */
  energy: number
  /** Nivel de bass (0-1) */
  bass: number
  /** Nivel de mids (0-1) */
  mids: number
  /** Nivel de highs (0-1) */
  highs: number
  /** BPM detectado */
  bpm: number
  /** Fase del beat (0-1) */
  beatPhase: number
  /** Contador de beats desde inicio */
  beatCount?: number
}

/** Configuracion de vibe */
interface VibeConfig {
  /** Escala de amplitud final (1.0 = full range) */
  amplitudeScale: number
  /** Frecuencia base en Hz */
  baseFrequency: number
  /** Patrones disponibles para este vibe (SOLO de la Docena Dorada) */
  patterns: GoldenPattern[]
  /** Volver a home en silencio */
  homeOnSilence: boolean
}

// THE GOLDEN DOZEN - Los unicos 12 patrones que existen

type GoldenPattern = 
  // TECHNO (4 patterns - Industrial/Sharp)
  | 'scan_x'      // Barrido horizontal puro (policia/searchlight)
  | 'square'      // Movimiento cuadrado, esquinas duras
  | 'diamond'     // Rombo agresivo (abs + abs)
  | 'botstep'     // Posiciones cuantizadas roboticas
  // LATINO (3 patterns - Fluid/Hips)
  | 'figure8'     // El infinito - caderas de cumbia
  | 'wave_y'      // Ola: X lento, Y rapido
  | 'ballyhoo'    // Espiral compleja, cierra cada 4 compases
  // POP-ROCK (3 patterns - Stadium/Symmetry)
  | 'circle_big'  // El rey de los estadios
  | 'cancan'      // X fijo, Y arriba/abajo sincronizado
  | 'dual_sweep'  // Barrido en U majestuoso
  // CHILL (3 patterns - Organic/Ambient)
  | 'drift'       // Movimiento browniano lento
  | 'sway'        // Pendulo suave (solo X)
  | 'breath'      // Solo Tilt sutil (la luz respira)

// VIBE CONFIGURATIONS

const VIBE_CONFIG: Record<string, VibeConfig> = {
  // TECHNO: Geometria dura, cortes precisos
  'techno-club': {
    amplitudeScale: 1.0,
    baseFrequency: 0.25,
    patterns: ['scan_x', 'square', 'diamond', 'botstep'],
    homeOnSilence: false,
  },
  
  // LATINO: Curvas, fluidez, caderas
  'fiesta-latina': {
    amplitudeScale: 0.85,
    baseFrequency: 0.15,
    patterns: ['figure8', 'wave_y', 'ballyhoo'],
    homeOnSilence: false,
  },
  
  // POP-ROCK: Simetria, majestuosidad, estadio
  'pop-rock': {
    amplitudeScale: 0.80,
    baseFrequency: 0.20,
    patterns: ['circle_big', 'cancan', 'dual_sweep'],
    homeOnSilence: true,
  },
  
  // CHILL: Organico, invisible, respiracion
  'chill-lounge': {
    amplitudeScale: 0.50,
    baseFrequency: 0.10,
    patterns: ['drift', 'sway', 'breath'],
    homeOnSilence: true,
  },
  
  // IDLE: Minimo
  'idle': {
    amplitudeScale: 0.1,
    baseFrequency: 0.05,
    patterns: ['breath'],
    homeOnSilence: true,
  },
}

// PATTERN PERIODS - Cuantos beats por ciclo completo

const PATTERN_PERIOD: Record<GoldenPattern, number> = {
  // TECHNO
  scan_x: 2,
  square: 4,
  diamond: 2,
  botstep: 1,
  
  // LATINO  
  figure8: 4,
  wave_y: 2,
  ballyhoo: 16,
  
  // POP-ROCK
  circle_big: 4,
  cancan: 2,
  dual_sweep: 4,
  
  // CHILL
  drift: 8,
  sway: 4,
  breath: 4,
}

// THE GOLDEN DOZEN - Implementaciones Matematicas Puras

type PatternFunction = (
  phase: number,
  audio: AudioContext,
  index?: number,
  total?: number
) => { x: number; y: number }

const PATTERNS: Record<GoldenPattern, PatternFunction> = {
  
  // TECHNO PATTERNS - Industrial / Sharp / Geometria Dura
  
  // SCAN_X: Barrido horizontal puro (Coche Fantastico / policia)
  scan_x: (phase, audio, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 0.5
    return {
      x: Math.sin(phase + fixtureOffset),
      y: 0,
    }
  },
  
  // SQUARE: Movimiento cuadrado, esquinas duras
  square: (phase, audio) => {
    const normalizedPhase = (phase / (Math.PI * 2)) * 4
    const quadrant = Math.floor(normalizedPhase) % 4
    const corners = [
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 },
    ]
    return corners[quadrant]
  },
  
  // DIAMOND: Rombo agresivo
  diamond: (phase, audio) => {
    const rawX = Math.sin(phase)
    const rawY = Math.cos(phase)
    const scale = Math.SQRT2
    return {
      x: rawX * scale * 0.7,
      y: rawY * scale * 0.7,
    }
  },
  
  // BOTSTEP: Posiciones cuantizadas roboticas
  botstep: (phase, audio) => {
    const step = Math.floor((phase / (Math.PI * 2)) * 8)
    const phi = 1.618033988749
    const x = Math.sin(step * phi * Math.PI) * 0.9
    const y = Math.cos(step * phi * phi * Math.PI) * 0.6
    return { x, y }
  },
  
  // LATINO PATTERNS - Fluid / Hips / Curvas Sensuales
  
  // FIGURE8: El clasico infinito (Lissajous 1:2)
  figure8: (phase, audio) => {
    return {
      x: Math.sin(phase),
      y: Math.sin(phase * 2) * 0.6,
    }
  },
  
  // WAVE_Y: La ola (X lento, Y rapido)
  wave_y: (phase, audio) => {
    return {
      x: Math.sin(phase * 0.5) * 0.8,
      y: Math.sin(phase * 2) * 0.7,
    }
  },
  
  // BALLYHOO: Caos controlado (cierra cada 16 beats)
  ballyhoo: (phase, audio, index = 0, total = 1) => {
    const x = Math.sin(phase) * 0.5 + 
              Math.sin(phase * 3) * 0.3 + 
              Math.sin(phase * 5) * 0.15
    const y = Math.cos(phase) * 0.4 + 
              Math.cos(phase * 3) * 0.25 + 
              Math.cos(phase * 5) * 0.1
    const fixtureOffset = (index / Math.max(total, 1)) * 0.3
    return {
      x: x * (0.85 + fixtureOffset * 0.3),
      y: y * (0.85 + fixtureOffset * 0.3),
    }
  },
  
  // POP-ROCK PATTERNS - Stadium / Symmetry / Majestuosidad
  
  // CIRCLE_BIG: El rey de los estadios
  circle_big: (phase, audio, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 2
    return {
      x: Math.sin(phase + fixtureOffset),
      y: Math.cos(phase + fixtureOffset) * 0.75,
    }
  },
  
  // CANCAN: Piernas de bailarina (X fijo, Y arriba/abajo)
  cancan: (phase, audio, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI
    return {
      x: Math.sin(phase * 0.25) * 0.15,
      y: Math.sin(phase + fixtureOffset),
    }
  },
  
  // DUAL_SWEEP: Barrido en U majestuoso
  dual_sweep: (phase, audio) => {
    const x = Math.sin(phase)
    const y = (x * x) - 0.3
    return { x, y }
  },
  
  // CHILL PATTERNS - Organic / Ambient / Respiracion
  
  // DRIFT: Movimiento browniano lento
  drift: (phase, audio) => {
    const phi = 1.618033988749
    const sqrt2 = Math.SQRT2
    const sqrt3 = Math.sqrt(3)
    const x = Math.sin(phase * phi) * 0.4 + 
              Math.sin(phase * sqrt2) * 0.25 + 
              Math.sin(phase * sqrt3) * 0.15
    const y = Math.cos(phase * phi * 0.7) * 0.35 + 
              Math.cos(phase * sqrt2 * 0.8) * 0.2 + 
              Math.cos(phase * sqrt3 * 0.9) * 0.12
    return { x, y }
  },
  
  // SWAY: Pendulo muy suave (solo X)
  sway: (phase, audio) => {
    return {
      x: Math.sin(phase) * 0.6,
      y: 0,
    }
  },
  
  // BREATH: La luz respira (solo Y sutil)
  breath: (phase, audio) => {
    return {
      x: 0,
      y: Math.sin(phase) * 0.35,
    }
  },
}

// VIBE MOVEMENT MANAGER - THE CHOREOGRAPHER

export class VibeMovementManager {
  private time: number = 0
  private lastUpdate: number = Date.now()
  private frameCount: number = 0
  private barCount: number = 0
  private lastBeatCount: number = 0
  
  // Manual override system (WAVE 999 compatible)
  private manualSpeedOverride: number | null = null
  private manualAmplitudeOverride: number | null = null
  private manualPatternOverride: string | null = null
  
  // WAVE 1155.1: SMOOTH TRANSITION SYSTEM
  // Cuando el patron cambia, hacemos LERP de 2 segundos
  private lastPattern: string | null = null
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 }
  private transitionStartTime: number = 0
  private isTransitioning: boolean = false
  private readonly TRANSITION_DURATION_MS = 2000  // 2 segundos
  
  // MANUAL OVERRIDE API
  
  setManualSpeed(speed: number | null): void {
    this.manualSpeedOverride = speed
    console.log(speed !== null 
      ? `[CHOREO] Manual SPEED: ${speed}%`
      : `[CHOREO] Speed -> AI control`)
  }
  
  setManualAmplitude(amplitude: number | null): void {
    this.manualAmplitudeOverride = amplitude
    console.log(amplitude !== null 
      ? `[CHOREO] Manual AMPLITUDE: ${amplitude}%`
      : `[CHOREO] Amplitude -> AI control`)
  }
  
  setManualPattern(pattern: string | null): void {
    this.manualPatternOverride = pattern
    console.log(pattern !== null 
      ? `[CHOREO] Manual PATTERN: ${pattern}`
      : `[CHOREO] Pattern -> AI control`)
  }
  
  getManualOverrides() {
    return {
      speed: this.manualSpeedOverride,
      amplitude: this.manualAmplitudeOverride,
      pattern: this.manualPatternOverride,
    }
  }
  
  clearManualOverrides(): void {
    this.manualSpeedOverride = null
    this.manualAmplitudeOverride = null
    this.manualPatternOverride = null
    console.log(`[CHOREO] All overrides cleared`)
  }
  
  // GENERATE INTENT - El corazon del coreografo
  
  generateIntent(
    vibeId: string, 
    audio: AudioContext,
    fixtureIndex: number = 0,
    totalFixtures: number = 1
  ): MovementIntent {
    // Actualizar tiempo interno
    const now = Date.now()
    const deltaTime = (now - this.lastUpdate) / 1000
    this.lastUpdate = now
    this.time += deltaTime
    this.frameCount++
    
    // Obtener configuracion del vibe
    const config = VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle']
    
    // Actualizar barCount desde beatCount
    const beatCount = audio.beatCount ?? 0
    const beatPhase = audio.beatPhase ?? 0
    
    if (beatCount !== this.lastBeatCount) {
      if (beatCount % 4 === 0) this.barCount++
      this.lastBeatCount = beatCount
    }
    
    // Seleccionar patron
    const patternName = this.selectPattern(config, audio)
    
    // 🥶 WAVE 1165: GHOST PROTOCOL - FREEZE instead of HOME on silence
    // When energy is very low, MAINTAIN last position instead of going to center
    // This prevents the "whip to home" movement when audio stops
    if (audio.energy < 0.03 && config.homeOnSilence) {
      return this.createFreezeIntent(patternName)
    }
    
    // PHASE CALCULATION - Beat-Locked (WAVE 1153 compatible)
    const patternPeriod = PATTERN_PERIOD[patternName as GoldenPattern] || 4
    const safeBPM = this.getSafeBPM(audio.bpm)
    
    let phase: number
    const hasBeatData = beatCount > 0 || beatPhase > 0.01
    
    if (hasBeatData) {
      // Pacemaker conectado - fase sincronizada con beats
      const absoluteBeats = beatCount + beatPhase
      const patternPhase = (absoluteBeats % patternPeriod) / patternPeriod
      phase = patternPhase * Math.PI * 2
    } else {
      // Fallback - fase basada en tiempo
      const beatsPerSecond = safeBPM / 60
      const elapsedBeats = this.time * beatsPerSecond
      const patternPhase = (elapsedBeats % patternPeriod) / patternPeriod
      phase = patternPhase * Math.PI * 2
    }
    
    // PATTERN EXECUTION
    const patternFn = PATTERNS[patternName as GoldenPattern]
    if (!patternFn) {
      console.warn(`[CHOREO] Unknown pattern: ${patternName}, using breath`)
      return this.createHomeIntent('breath')
    }
    
    const rawPosition = patternFn(phase, audio, fixtureIndex, totalFixtures)
    
    // THE GEARBOX - Dynamic Amplitude Scaling
    const effectiveAmplitude = this.calculateEffectiveAmplitude(
      config.amplitudeScale,
      safeBPM,
      patternPeriod,
      audio.energy
    )
    
    // Aplicar amplitud
    const position = {
      x: Math.max(-1, Math.min(1, rawPosition.x * effectiveAmplitude)),
      y: Math.max(-1, Math.min(1, rawPosition.y * effectiveAmplitude)),
    }
    
    // WAVE 1155.1: SMOOTH TRANSITION SYSTEM
    // Detectar cambio de patron e iniciar transicion LERP de 2 segundos
    if (this.lastPattern !== null && this.lastPattern !== patternName) {
      // Patron cambio! Iniciar transicion
      this.isTransitioning = true
      this.transitionStartTime = now
      console.log(`[CHOREO] Pattern transition: ${this.lastPattern} -> ${patternName} (2s LERP)`)
    }
    
    // Si estamos en transicion, hacer LERP entre lastPosition y position
    let finalPosition = position
    if (this.isTransitioning) {
      const elapsed = now - this.transitionStartTime
      const t = Math.min(1.0, elapsed / this.TRANSITION_DURATION_MS)
      
      // Curva de ease-out (suave al final): t^2 * (3 - 2t)
      const smoothT = t * t * (3 - 2 * t)
      
      finalPosition = {
        x: this.lastPosition.x + (position.x - this.lastPosition.x) * smoothT,
        y: this.lastPosition.y + (position.y - this.lastPosition.y) * smoothT,
      }
      
      // Terminar transicion despues de 2 segundos
      if (t >= 1.0) {
        this.isTransitioning = false
        console.log(`[CHOREO] Transition complete -> ${patternName}`)
      }
    }
    
    // Guardar estado para proxima transicion
    this.lastPattern = patternName
    this.lastPosition = finalPosition
    
    // Frecuencia efectiva (con override manual)
    const effectiveFrequency = this.manualSpeedOverride !== null
      ? 0.01 + (this.manualSpeedOverride / 100) * 0.49
      : config.baseFrequency
    
    // Debug log cada ~1 segundo
    if (this.frameCount % 60 === 0) {
      const panDeg = Math.round(finalPosition.x * 270)
      const tiltDeg = Math.round(finalPosition.y * 135)
      const manualTag = this.hasAnyOverride() ? ' [MANUAL]' : ''
      const transitionTag = this.isTransitioning ? ' [LERP]' : ''
      console.log(`[CHOREO] ${vibeId} | ${patternName}${manualTag}${transitionTag} | Bar:${this.barCount} | Pan:${panDeg} Tilt:${tiltDeg}`)
    }
    
    // Determinar phaseType
    const phaseType: 'linear' | 'polar' = 
      (patternName === 'scan_x' || patternName === 'cancan') ? 'linear' : 'polar'
    
    return {
      x: finalPosition.x,
      y: finalPosition.y,
      pattern: patternName,
      speed: effectiveFrequency,
      amplitude: effectiveAmplitude,
      phaseType,
      _frequency: effectiveFrequency,
      _phrase: Math.floor(this.barCount / 8),
    }
  }
  
  // PATTERN SELECTION
  
  private selectPattern(config: VibeConfig, audio: AudioContext): string {
    // Manual override tiene prioridad absoluta
    if (this.manualPatternOverride !== null) {
      if (PATTERNS[this.manualPatternOverride as GoldenPattern]) {
        return this.manualPatternOverride
      }
      console.warn(`[CHOREO] Invalid manual pattern: ${this.manualPatternOverride}`)
    }
    
    const patterns = config.patterns
    if (patterns.length === 0) return 'breath'
    
    // Rotacion por phrase (cada 8 compases)
    const phrase = Math.floor(this.barCount / 8)
    const patternIndex = phrase % patterns.length
    
    return patterns[patternIndex]
  }
  
  // GEARBOX - Hardware speed limiting
  
  private calculateEffectiveAmplitude(
    baseAmplitude: number,
    bpm: number,
    patternPeriod: number,
    energy: number
  ): number {
    // Manual override
    if (this.manualAmplitudeOverride !== null) {
      return 0.05 + (this.manualAmplitudeOverride / 100) * 0.95
    }
    
    // Hardware limit: ~250 DMX/s para EL-1140 y similares
    const HARDWARE_MAX_SPEED = 250
    const secondsPerBeat = 60 / bpm
    
    // Presupuesto de movimiento en un ciclo del patron
    const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
    
    // Energia boost (+20% con energy = 1.0)
    const energyBoost = 1.0 + energy * 0.2
    const requestedAmplitude = baseAmplitude * energyBoost
    
    // Distancia solicitada (255 DMX = full range)
    const requestedTravel = 255 * requestedAmplitude
    
    // Factor de reduccion si excede el presupuesto
    const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
    
    return Math.min(1.0, requestedAmplitude * gearboxFactor)
  }
  
  // UTILITIES
  
  private getSafeBPM(bpm: number): number {
    if (!bpm || !isFinite(bpm) || bpm <= 0) return 120
    return Math.max(60, Math.min(200, bpm))
  }
  
  private hasAnyOverride(): boolean {
    return this.manualSpeedOverride !== null ||
           this.manualAmplitudeOverride !== null ||
           this.manualPatternOverride !== null
  }
  
  private createHomeIntent(pattern: string): MovementIntent {
    return {
      x: 0,
      y: 0,
      pattern: 'home',
      speed: 0,
      amplitude: 0,
      _frequency: 0,
      _phrase: Math.floor(this.barCount / 8),
    }
  }
  
  /**
   * 🥶 WAVE 1165: GHOST PROTOCOL - Create FREEZE intent
   * Returns LAST KNOWN POSITION instead of going home
   * This prevents the "whip to center" movement when audio stops
   */
  private createFreezeIntent(pattern: string): MovementIntent {
    return {
      x: this.lastPosition.x,  // Stay where you are
      y: this.lastPosition.y,  // Stay where you are
      pattern: 'freeze',       // Special pattern name for debugging
      speed: 0,
      amplitude: 0,
      _frequency: 0,
      _phrase: Math.floor(this.barCount / 8),
    }
  }
  
  // PUBLIC GETTERS
  
  getVibeConfig(vibeId: string): VibeConfig {
    return VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle']
  }
  
  getAvailablePatterns(): string[] {
    return Object.keys(PATTERNS)
  }
  
  resetTime(): void {
    this.time = 0
    this.lastUpdate = Date.now()
    this.barCount = 0
    this.lastBeatCount = 0
    // WAVE 1155.1: Reset transition state
    this.lastPattern = null
    this.lastPosition = { x: 0, y: 0 }
    this.isTransitioning = false
  }
  
  getTime(): number {
    return this.time
  }
  
  getBarCount(): number {
    return this.barCount
  }
}

// SINGLETON EXPORT

export const vibeMovementManager = new VibeMovementManager()
export default vibeMovementManager
