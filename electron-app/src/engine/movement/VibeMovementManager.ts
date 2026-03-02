/**
 * WAVE 1155: THE CHOREOGRAPHER REBORN
 * WAVE 2086.1: STEREO RESURRECTION — Phase offset (mirror/snake) lives HERE now
 * WAVE 2086.2: THE MAJESTIC REFORM — Professional period scaling (no more epilepsy)
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
 *   TitanEngine -> VibeMovementManager.generateIntent(vibeId, audio, fixtureIndex, total)
 *   Cada fixture recibe su propia posición con phase offset (snake/mirror) aplicado.
 *   El Arbiter recibe posiciones L/R ya diferenciadas via mechanicsL/R.
 * 
 * @layer ENGINE/MOVEMENT
 * @version WAVE 2086.2 - The Majestic Reform
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

// THE GOLDEN DOZEN + THE FOUR NOBLES
// WAVE 2086.5: Vocabulario extendido — 4 nuevos patrones profesionales

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
  // ═══════════════════════════════════════════════════════════════════════
  // 🎭 WAVE 2086.5: THE FOUR NOBLES — Vocabulario expandido profesional
  // ═══════════════════════════════════════════════════════════════════════
  | 'slow_pan'        // Barrido horizontal lineal ultraLento (32 beats)
  | 'tilt_nod'        // Inclinación vertical suave (cabeceo "sí")
  | 'figure_of_4'     // Figure8 contenido (amplitude 0.5 fija, centro)
  | 'chase_position'  // Snap cuantizado cada 4 beats (hold between)

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
// ═══════════════════════════════════════════════════════════════════════════
// 🎭 WAVE 2086.2: THE MAJESTIC REFORM
// ANTES: Periodos de 1-4 beats → 1-2 Hz de oscilación → epilepsia mecánica
// AHORA: Periodos profesionales de 8-32 beats → movimientos de estadio
//
// Referencia shows profesionales:
//   Barrido lento (scan):   1 ciclo / 4-8 compases  = 16-32 beats
//   Circle/Figure8:         1 ciclo / 4 compases     = 16 beats
//   Snap a posición:        1 posición / 2 compases  = 8 beats
//   Ballyhoo/Drift épico:   1 ciclo / 8 compases     = 32 beats
// ═══════════════════════════════════════════════════════════════════════════

const PATTERN_PERIOD: Record<GoldenPattern, number> = {
  // TECHNO — geometría industrial, pero DELIBERADA
  scan_x: 16,       // 4 compases: barrido majestuoso, no epiléptico
  square: 16,       // 4 compases: 1 esquina por compás, 4 esquinas = 1 ciclo
  diamond: 8,       // 2 compases: rombo contenido pero fluido
  botstep: 8,       // 2 compases: posiciones robóticas con gravitas
  
  // LATINO — fluido, sensual, cadera
  figure8: 16,      // 4 compases: el infinito tiene tiempo para respirar
  wave_y: 8,        // 2 compases: ola con peso, no espuma nerviosa
  ballyhoo: 32,     // 8 compases: espiral épica, cierra cada 8 barras
  
  // POP-ROCK — estadio, simetría, majestuosidad
  circle_big: 16,   // 4 compases: el rey necesita su corte completa
  cancan: 8,        // 2 compases: subida/bajada con drama
  dual_sweep: 16,   // 4 compases: barrido en U con peso cinematográfico
  
  // CHILL — orgánico, invisible, respiración
  drift: 32,        // 8 compases: browniano con tiempo geológico
  sway: 16,         // 4 compases: péndulo meditativo
  breath: 16,       // 4 compases: la luz inhala... exhala...
  
  // 🎭 WAVE 2086.5: THE FOUR NOBLES
  slow_pan: 32,         // 8 compases: el faro del fondo del escenario
  tilt_nod: 16,         // 4 compases: cabeceo meditativo
  figure_of_4: 16,      // 4 compases: figure8 contenido en el centro
  chase_position: 16,   // 4 compases: 4 posiciones × 4 beats = 16 beats
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 WAVE 2086.1: STEREO CONFIG — Phase offset por vibe
// Trasladado desde HAL.PHASE_CONFIGS (que estaba muerta en renderFromTarget)
// Ahora vive AQUÍ, donde realmente se genera el movimiento per-fixture.
//
// TIPOS:
//   'mirror'  → Fixture impar invierte X (puertas del infierno techno)
//   'snake'   → Cada fixture añade offset a la fase (ola mexicana)
//   'sync'    → Todos iguales (idle, sin desfase)
// ═══════════════════════════════════════════════════════════════════════════

interface StereoConfig {
  /** Offset en radianes entre fixtures consecutivos */
  offset: number
  /** Tipo de desfase estéreo */
  type: 'sync' | 'snake' | 'mirror'
}

const STEREO_CONFIG: Record<string, StereoConfig> = {
  'techno-club':    { offset: Math.PI,     type: 'mirror' },   // L/R espejos (puertas abren/cierran)
  'fiesta-latina':  { offset: Math.PI / 4, type: 'snake' },    // 45° cadena de caderas
  'pop-rock':       { offset: Math.PI / 3, type: 'snake' },    // 60° wall ondulante
  'chill-lounge':   { offset: Math.PI / 2, type: 'snake' },    // 90° ola de mar lenta
  'idle':           { offset: 0,           type: 'sync' },     // Sin movimiento
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
  
  // SQUARE: Movimiento cuadrado con interpolación lineal entre esquinas
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
  // El VMM genera un target que avanza a velocidad CONSTANTE entre esquinas.
  // El FixturePhysicsDriver ya es un filtro paso-bajo que añadirá la inercia
  // y la aceleración mecánica. NO pre-suavizamos el target.
  square: (phase, audio) => {
    const corners = [
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 },
    ]
    const normalizedPhase = (phase / (Math.PI * 2)) * 4
    const currentCorner = Math.floor(normalizedPhase) % 4
    const nextCorner = (currentCorner + 1) % 4
    const t = normalizedPhase - Math.floor(normalizedPhase)
    
    const from = corners[currentCorner]
    const to = corners[nextCorner]
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    }
  },
  
  // DIAMOND: Rombo agresivo
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Diamond toca [-1,1]
  // ANTES: rawX * SQRT2 * 0.7 = max ~0.9899 (nunca llegaba a 1.0)
  // AHORA: Normalización exacta. El diamante rota a 45° y sus vértices
  // tocan exactamente ±1 en cada eje cardinal.
  diamond: (phase, audio) => {
    const rawX = Math.sin(phase)
    const rawY = Math.cos(phase)
    // Rotación 45°: los picos de sin/cos (±1) se mapean a los ejes
    // La envolvente de |sin| + |cos| tiene máximo SQRT2, así que
    // dividimos por SQRT2 para normalizar, pero queremos que los VÉRTICES
    // del diamante (donde un eje = 0 y el otro = ±1) toquen ±1.
    // En un diamante perfecto: x = sin(phase), y = cos(phase) rotados 45°
    // Vértices en phase = 0, π/2, π, 3π/2 → ya tocan ±1 en un eje.
    return {
      x: rawX,
      y: rawY,
    }
  },
  
  // BOTSTEP: Posiciones cuantizadas robóticas con interpolación lineal
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
  // 8 posiciones golden-ratio con transición a velocidad constante.
  // El carácter "robótico" lo dará el PhysicsDriver al frenar en cada posición.
  botstep: (phase, audio) => {
    const phi = 1.618033988749
    const totalSteps = 8
    const normalizedPhase = (phase / (Math.PI * 2)) * totalSteps
    const currentStep = Math.floor(normalizedPhase) % totalSteps
    const nextStep = (currentStep + 1) % totalSteps
    const t = normalizedPhase - Math.floor(normalizedPhase)
    
    const fromX = Math.sin(currentStep * phi * Math.PI) * 0.9
    const fromY = Math.cos(currentStep * phi * phi * Math.PI) * 0.6
    const toX = Math.sin(nextStep * phi * Math.PI) * 0.9
    const toY = Math.cos(nextStep * phi * phi * Math.PI) * 0.6
    
    return {
      x: fromX + (toX - fromX) * t,
      y: fromY + (toY - fromY) * t,
    }
  },
  
  // LATINO PATTERNS - Fluid / Hips / Curvas Sensuales
  
  // FIGURE8: El clasico infinito (Lissajous 1:2)
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Y-axis 0.6 → 0.75
  // X ya toca ±1. Y sube a 0.75 para que el 8 sea más pronunciado
  // sin perder la proporción Lissajous (ratio 1:0.75 sigue siendo elegante).
  figure8: (phase, audio) => {
    return {
      x: Math.sin(phase),
      y: Math.sin(phase * 2) * 0.75,
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

  // ═══════════════════════════════════════════════════
  // 🎭 WAVE 2086.5: THE FOUR NOBLES
  // ═══════════════════════════════════════════════════

  // SLOW_PAN: El faro del fondo — barrido horizontal puro, 32 beats
  slow_pan: (phase, _audio) => {
    // Sin(phase) puro: el moving head barre 180° en 8 compases
    // Sin componente Y — movimiento hipnótico lateral
    return {
      x: Math.sin(phase),
      y: 0,
    }
  },

  // TILT_NOD: Cabeceo meditativo — solo vertical, 16 beats
  tilt_nod: (phase, _audio) => {
    // Amplitud 0.6 para no ser agresivo — es un asentimiento, no un headbang
    return {
      x: 0,
      y: Math.sin(phase) * 0.6,
    }
  },

  // FIGURE_OF_4: Figure8 contenido — mismo espíritu, menos territorio
  figure_of_4: (phase, _audio) => {
    // x = sin(phase) * 0.5: la mitad del recorrido horizontal
    // y = sin(2*phase) * 0.3: doble frecuencia vertical, amplitud contenida
    // El resultado es un 8 compacto que ocupa el centro del escenario
    return {
      x: Math.sin(phase) * 0.5,
      y: Math.sin(2 * phase) * 0.3,
    }
  },

  // CHASE_POSITION: 4 posiciones cardinales con interpolación lineal
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
  chase_position: (phase, _audio) => {
    const positions: Array<{ x: number; y: number }> = [
      { x: -0.7, y: 0 },     // Izquierda
      { x: 0, y: 0.7 },      // Arriba
      { x: 0.7, y: 0 },      // Derecha
      { x: 0, y: -0.7 },     // Abajo
    ]
    const totalSteps = 4
    const normalizedPhase = (phase / (2 * Math.PI)) * totalSteps
    const currentStep = Math.floor(normalizedPhase) % totalSteps
    const nextStep = (currentStep + 1) % totalSteps
    const t = normalizedPhase - Math.floor(normalizedPhase)
    
    const from = positions[currentStep]
    const to = positions[nextStep]
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
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
  
  // UI Pattern → GoldenPattern Translation Map
  // Babel Fish: traduce nombres legibles de UI a los nombres internos del backend
  private static readonly UI_TO_GOLDEN_PATTERN: Record<string, GoldenPattern> = {
    // Mappings directos
    'circle': 'circle_big',
    'eight': 'figure8',
    'sweep': 'scan_x',
    'spiral': 'ballyhoo',
    'wave': 'wave_y',
    'bounce': 'botstep',
    'random': 'drift',
    // Aliases adicionales por si acaso
    'figure8': 'figure8',
    'circle_big': 'circle_big',
    'scan_x': 'scan_x',
    // Hold/Static → devolvemos null para que Selene tome control
  }

  setManualPattern(pattern: string | null): void {
    if (pattern === null || pattern === 'static') {
      // Liberar a Selene
      this.manualPatternOverride = null
      console.log(`[CHOREO] Pattern → AI control (Selene)`)
      return
    }

    // Traducir UI pattern → GoldenPattern
    const goldenPattern = VibeMovementManager.UI_TO_GOLDEN_PATTERN[pattern]
    
    if (goldenPattern) {
      this.manualPatternOverride = goldenPattern
      console.log(`[CHOREO] Manual PATTERN: ${pattern} → ${goldenPattern}`)
    } else {
      // Pattern no reconocido - intentar usar directo (por si ya es GoldenPattern)
      if (PATTERNS[pattern as GoldenPattern]) {
        this.manualPatternOverride = pattern
        console.log(`[CHOREO] Manual PATTERN: ${pattern} (direct)`)
      } else {
        console.warn(`[CHOREO] Unknown pattern: ${pattern}, falling back to circle_big`)
        this.manualPatternOverride = 'circle_big'
      }
    }
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
    totalFixtures: number = 1,
    /** 🏎️ WAVE 2074.3: Per-fixture max speed (DMX/s). Defaults to 250 if not provided. */
    fixtureMaxSpeed: number = 250
  ): MovementIntent {
    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.1: FRAME-ONCE GUARD
    // TitanEngine now calls generateIntent() TWICE per frame (L + R stereo).
    // Internal state (time, frameCount, barCount, pattern selection) must
    // only update ONCE per frame. We use lastFrameTimestamp to detect
    // same-frame calls: if Date.now() === lastUpdate, skip state updates.
    // ═══════════════════════════════════════════════════════════════════════
    const now = Date.now()
    const isSameFrame = (now - this.lastUpdate) < 2  // <2ms = same render frame
    
    if (!isSameFrame) {
      // First call this frame: update all internal state
      const deltaTime = (now - this.lastUpdate) / 1000
      this.lastUpdate = now
      this.time += deltaTime
      this.frameCount++
    }
    // Second call (R fixture): reuse same time/frameCount/barCount
    
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
    const basePatternPeriod = PATTERN_PERIOD[patternName as GoldenPattern] || 4
    const safeBPM = this.getSafeBPM(audio.bpm)
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.4: ENERGY-TO-PERIOD — The Conductor's Tempo
    //
    // La energía NO solo afecta amplitud — también afecta VELOCIDAD.
    // Un DJ bajando la energía = los movers se vuelven contemplativos.
    // Un drop = los movers aceleran al doble.
    //
    // energy < 0.3 → periodo × 2.0 (mitad de velocidad: meditativo)
    // energy 0.3-0.8 → periodo × 1.0 (velocidad nominal)
    // energy > 0.8 → periodo × 0.5 (doble velocidad: frenesí)
    // ═══════════════════════════════════════════════════════════════════
    const energy = audio.energy
    let periodMultiplier = 1.0
    if (energy < 0.3) {
      // Lerp suave de 2.0 (energy=0) a 1.0 (energy=0.3)
      periodMultiplier = 2.0 - (energy / 0.3)
    } else if (energy > 0.8) {
      // Lerp suave de 1.0 (energy=0.8) a 0.5 (energy=1.0)
      periodMultiplier = 1.0 - ((energy - 0.8) / 0.2) * 0.5
    }
    const patternPeriod = basePatternPeriod * periodMultiplier
    
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
      audio.energy,
      fixtureMaxSpeed
    )
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.3: PHRASE ENVELOPE — The Breathing Amplifier
    //
    // Sin esto, cada compás tiene la misma amplitud = monotonía mecánica.
    // Con el envelope, la frase de 32 beats (8 compases) RESPIRA:
    //
    //   Beat 0-7   (compás 1-2):  0.60 → 0.75  — arranque contenido
    //   Beat 8-19  (compás 3-5):  0.75 → 1.00  — expansión progresiva
    //   Beat 20-23 (compás 6):    1.00          — CLÍMAX: apertura máxima
    //   Beat 24-31 (compás 7-8):  1.00 → 0.60  — relajación elegante
    //
    // Curva suave basada en coseno — sin discontinuidades.
    // ═══════════════════════════════════════════════════════════════════
    const phraseBeats = 32
    const phraseProgress = (beatCount % phraseBeats) / phraseBeats  // 0.0 → 1.0
    
    // Coseno desplazado: arranca en 0.6, pico en 1.0 a ~62% de la frase, relaja a 0.6
    // f(t) = 0.8 + 0.2 * sin(π * (t - 0.15)) → pico natural en t≈0.65
    const phraseEnvelope = 0.8 + 0.2 * Math.sin(Math.PI * (phraseProgress - 0.15))
    // Clamp final: el envelope escala entre 0.6 y 1.0
    const clampedEnvelope = Math.max(0.6, Math.min(1.0, phraseEnvelope))
    
    const finalAmplitude = effectiveAmplitude * clampedEnvelope
    
    // Aplicar amplitud (con phrase envelope de WAVE 2086.3)
    const position = {
      x: Math.max(-1, Math.min(1, rawPosition.x * finalAmplitude)),
      y: Math.max(-1, Math.min(1, rawPosition.y * finalAmplitude)),
    }
    
    // WAVE 1155.1: SMOOTH TRANSITION SYSTEM
    // Detectar cambio de patron e iniciar transicion LERP de 2 segundos
    if (!isSameFrame && this.lastPattern !== null && this.lastPattern !== patternName) {
      // Patron cambio! Iniciar transicion (only on first call per frame)
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
    
    // 🎭 WAVE 2086.1: Save state ONLY on first call per frame
    // This prevents the R fixture's stereo position from contaminating
    // the L fixture's LERP origin on the next frame.
    if (!isSameFrame) {
      this.lastPattern = patternName
      this.lastPosition = finalPosition  // Pre-stereo position (shared base)
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.1: STEREO PHASE OFFSET — The Resurrection
    //
    // ANTES: applyPhaseOffset() vivía en HAL pero SOLO era llamada por
    // renderFromIntent() (flujo muerto). renderFromTarget() (flujo activo)
    // la ignoraba. Resultado: todos los movers eran clones (Borg mode).
    //
    // AHORA: La lógica de mirror/snake vive AQUÍ, donde se genera el
    // movimiento. Cada fixture recibe su posición diferenciada ANTES de
    // que llegue al Arbiter. Así el Arbiter ya ve L/R distinto.
    //
    // MIRROR (techno): Fixture impar invierte X → puertas del infierno
    // SNAKE (latino/pop/chill): Cada fixture añade offset a la fase base
    //   → ola mexicana, cadena de caderas
    // SYNC (idle): Sin cambio
    // ═══════════════════════════════════════════════════════════════════════
    const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle']
    let stereoPosition = { ...finalPosition }
    
    if (stereoConfig.type === 'mirror' && totalFixtures > 1) {
      // 🪞 MIRROR: Fixtures impares (derecha) invierten PAN (eje X)
      // Fixture 0 (L): x se mantiene → puerta izquierda
      // Fixture 1 (R): x se invierte → puerta derecha
      // Efecto: las puertas se abren y cierran en espejo horizontal
      // TILT (eje Y) es compartido: ambos apuntan al mismo nivel vertical
      const mirrorSign = fixtureIndex % 2 === 0 ? 1 : -1
      stereoPosition.x = finalPosition.x * mirrorSign
      // Y no se toca: stereoPosition.y = finalPosition.y (ya copiado)
      
    } else if (stereoConfig.type === 'snake' && totalFixtures > 1) {
      // 🐍 SNAKE: Cada fixture aplica un desfase angular a la posición
      // La posición base (finalPosition) es un punto en una trayectoria
      // circular/elíptica. Rotamos ese punto alrededor del centro (0,0)
      // por el offset del fixture → efecto ola/cadena.
      const phaseOffset = fixtureIndex * stereoConfig.offset
      
      // Magnitud del movimiento (distancia al centro en espacio -1..+1)
      const mag = Math.sqrt(finalPosition.x * finalPosition.x + finalPosition.y * finalPosition.y)
      
      if (mag > 0.01) {
        // Ángulo actual del vector posición
        const currentAngle = Math.atan2(finalPosition.y, finalPosition.x)
        // Rotar por el phase offset del fixture
        const newAngle = currentAngle + phaseOffset
        
        stereoPosition.x = Math.cos(newAngle) * mag
        stereoPosition.y = Math.sin(newAngle) * mag
      }
      // Si mag ≈ 0 (posición en centro), no hay nada que rotar
    }
    // 'sync' → stereoPosition = finalPosition (sin cambio)
    
    // Clampar al rango válido
    stereoPosition.x = Math.max(-1, Math.min(1, stereoPosition.x))
    stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y))
    
    // Frecuencia efectiva (con override manual)
    const effectiveFrequency = this.manualSpeedOverride !== null
      ? 0.01 + (this.manualSpeedOverride / 100) * 0.49
      : config.baseFrequency
    
    // Debug log cada ~1 segundo
    if (this.frameCount % 60 === 0) {
      const panDeg = Math.round(stereoPosition.x * 270)
      const tiltDeg = Math.round(stereoPosition.y * 135)
      const manualTag = this.hasAnyOverride() ? ' [MANUAL]' : ''
      const transitionTag = this.isTransitioning ? ' [LERP]' : ''
      const stereoTag = stereoConfig.type !== 'sync' ? ` [${stereoConfig.type.toUpperCase()} F${fixtureIndex}/${totalFixtures}]` : ''
      console.log(`[CHOREO] ${vibeId} | ${patternName}${manualTag}${transitionTag}${stereoTag} | Bar:${this.barCount} | Pan:${panDeg} Tilt:${tiltDeg}`)
    }
    
    // Determinar phaseType
    // 🔧 WAVE 2086.1: phaseType is now informational only (stereo already applied)
    // We keep it for downstream compatibility but HAL no longer uses it for phase offset
    const phaseType: 'linear' | 'polar' = 
      (patternName === 'scan_x' || patternName === 'cancan') ? 'linear' : 'polar'
    
    return {
      x: stereoPosition.x,
      y: stereoPosition.y,
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
    energy: number,
    /** 🏎️ WAVE 2074.3: Per-fixture max speed (DMX/s). No more global constant. */
    fixtureMaxSpeed: number = 250
  ): number {
    // Manual override
    if (this.manualAmplitudeOverride !== null) {
      return 0.05 + (this.manualAmplitudeOverride / 100) * 0.95
    }
    
    // 🏎️ WAVE 2074.3: Per-fixture hardware limit
    // ANTES: HARDWARE_MAX_SPEED = 250 (global para todos los fixtures)
    // AHORA: Cada fixture pasa su propio maxSpeed desde su physicsProfile.
    // Si un fixture tiene maxVelocity: 100, el Gearbox reduce la amplitud
    // para que el patrón no pida más de lo que sus motores pueden dar.
    const HARDWARE_MAX_SPEED = fixtureMaxSpeed
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
    
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Hard floor 0.85
    // El Gearbox NUNCA debe aplastar la amplitud por debajo del 85%.
    // Los movers deben INTENTAR el recorrido completo; el PhysicsDriver
    // ya se encarga de limitar la velocidad real del hardware.
    const GEARBOX_MIN_AMPLITUDE = 0.85
    const gearboxResult = requestedAmplitude * gearboxFactor
    return Math.min(1.0, Math.max(GEARBOX_MIN_AMPLITUDE, gearboxResult))
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
