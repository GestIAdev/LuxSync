/**
 * WAVE 1155: THE CHOREOGRAPHER REBORN
 * WAVE 2086.1: STEREO RESURRECTION — Phase offset (mirror/snake) lives HERE now
 * WAVE 2086.2: THE MAJESTIC REFORM — Professional period scaling (no more epilepsy)
 * 
 * 🔥 WAVE 2213 FÉNIX: OPERACIÓN FÉNIX — RESTAURACIÓN DEL MOTOR DORADO
 *   Base code restored from commit 8123c08 (WAVE 2088.9-2088.12).
 *   The monotonic phase accumulator with smoothedBPM is the heart of this engine.
 *   WAVES 2206-2210 castrated the system trying to fix stutter caused by IPC/renderer
 *   throttling (fixed in WAVE 2211). This is the TRUE engine, restored and enhanced.
 * 
 *   GEOMETRY FIXES applied on top of restoration:
 *   1. amplitudeScale calibrated: techno=0.40, latina=0.35, rock=0.45 (540° Pan safe)
 *   2. diamond rewritten: was sin/cos (circle), now linear interpolation between
 *      cardinal vertices (0,1)→(1,0)→(0,-1)→(-1,0) — true rhombus
 *   3. ballyhoo fixtureOffset purified: was scaling amplitude per fixture (asymmetric)
 *   4. wave_y redesigned: was W-bounce (Lissajous 0.5:2), now latin pendulum U-arc
 * 
 *   FPD FIXES applied on restoration:
 *   - Anti-Stuck (V16.4) REMOVED: false positives with valid DMX 0/255 targets
 *   - Anti-Jitter upgraded: dynamic threshold (3% of maxVelocity) instead of hardcoded 5
 *   - REV_LIMIT capped by hardware effectiveMaxVel (budget movers can't exceed their limits)
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
 * @version WAVE 2213 FÉNIX — Operación Fénix: Motor Dorado Restaurado
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
    amplitudeScale: 0.70,  // 🔧 WAVE 2233 CHOREOGRAPHER'S CUT: 0.55 → 0.70. ~350° Pan en 540° movers. 7 capas de seguridad + Gearbox protegen.
    baseFrequency: 0.25,
    patterns: ['scan_x', 'square', 'diamond', 'botstep'],
    homeOnSilence: false,
  },
  
  // LATINO: Curvas, fluidez, caderas
  'fiesta-latina': {
    amplitudeScale: 0.65,  // 🔥 WAVE 2472 SANGRE LATINA: 0.35 → 0.65. Las caderas no mienten.
    baseFrequency: 0.15,
    patterns: ['figure8', 'wave_y', 'ballyhoo'],
    homeOnSilence: false,
  },
  
  // POP-ROCK: Simetria, majestuosidad, estadio
  'pop-rock': {
    amplitudeScale: 0.45,  // 🔧 WAVE 2213 FÉNIX: 0.80 → 0.45. Barridos medios de estadio, servo-safe.
    baseFrequency: 0.20,
    patterns: ['circle_big', 'cancan', 'dual_sweep'],
    homeOnSilence: true,
  },
  
  // CHILL: Oceánico, casi estático, deriva de medusa
  // 🌊 WAVE 2470 MODO DERIVA: amplitudeScale 0.50→0.12. Recorrido mínimo.
  // Los patrones existen, pero apenas son perceptibles. Es poesía en movimiento.
  'chill-lounge': {
    amplitudeScale: 0.12,
    baseFrequency: 0.04,
    patterns: ['drift', 'sway', 'breath'],
    homeOnSilence: false,  // Flotar eternamente. Nunca volver a casa.
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
  scan_x: 8,        // 🔧 WAVE 2221: 16→8. 2 compases: barrido rápido, no letárgico
  square: 16,       // 4 compases: 1 esquina por compás, 4 esquinas = 1 ciclo
  diamond: 8,       // 2 compases: rombo contenido pero fluido
  botstep: 8,       // 2 compases: posiciones robóticas con gravitas
  
  // LATINO — fluido, sensual, cadera
  figure8: 16,      // 4 compases: el infinito tiene tiempo para respirar
  wave_y: 8,        // 2 compases: ola con peso, no espuma nerviosa
  ballyhoo: 16,     // 4 compases: espiral épica pero con cadencia latina (WAVE 2088.11: era 32, demasiado lento)
  
  // POP-ROCK — estadio, simetría, majestuosidad
  circle_big: 16,   // 4 compases: el rey necesita su corte completa
  cancan: 8,        // 2 compases: subida/bajada con drama
  dual_sweep: 16,   // 4 compases: barrido en U con peso cinematográfico
  
  // CHILL — oceánico, casi estático, tiempo geológico profundo
  // 🌊 WAVE 2470 MODO DERIVA: períodos x8. Una medusa no tiene prisa.
  drift: 256,       // 64 compases: deriva continental. Un ciclo = ~2 minutos a 120BPM.
  sway: 128,        // 32 compases: la corriente profunda. Apenas perceptible.
  breath: 96,       // 24 compases: la luz respira. Una inspiración = 96 beats.
  
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
  
  // SCAN_X: Barrido horizontal con ondulación vertical (Lissajous 1:2 suave)
  // 🔧 WAVE 2221 MENDOZA: Añadido Y sinusoidal. Sin offset hardcodeado.
  // La orientación floor/ceiling la gestiona el PhysicsDriver con su preset.
  // Centro en y=0.0 — el FPD aplica tiltOffset según instalación.
  scan_x: (phase, audio, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 0.5
    return {
      x: Math.sin(phase + fixtureOffset),
      y: Math.sin((phase + fixtureOffset) * 2) * 0.45, // WAVE 2224: 0.3→0.45, oscilación vertical más dramática
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
  
  // DIAMOND: Rombo con interpolación lineal entre vértices cardinales
  // � WAVE 2213 FÉNIX: el diamante anterior era un círculo (sin/cos).
  //   FIX: Mismo método que square — 4 vértices cardinales con interpolación
  //   lineal a velocidad constante. Vértices: Top(0,1)→Right(1,0)→Bot(0,-1)→Left(-1,0).
  //   Es square rotado 45°: las aristas son diagonales, no horizontales.
  diamond: (phase, audio) => {
    const vertices = [
      { x:  0, y:  1 },  // Top
      { x:  1, y:  0 },  // Right
      { x:  0, y: -1 },  // Bottom
      { x: -1, y:  0 },  // Left
    ]
    const normalizedPhase = (phase / (Math.PI * 2)) * 4
    const currentVertex = Math.floor(normalizedPhase) % 4
    const nextVertex = (currentVertex + 1) % 4
    const t = normalizedPhase - Math.floor(normalizedPhase)

    const from = vertices[currentVertex]
    const to = vertices[nextVertex]
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
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
    const fromY = Math.cos(currentStep * phi * phi * Math.PI) * 0.9  // 🔧 WAVE 2221: 0.6→0.9. Tilt agresivo para saltos verticales obvios
    const toX = Math.sin(nextStep * phi * Math.PI) * 0.9
    const toY = Math.cos(nextStep * phi * phi * Math.PI) * 0.9  // 🔧 WAVE 2221: 0.6→0.9
    
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
  
  // WAVE_Y: Péndulo latino — ola suave en U cadenciosa
  // 🔥 WAVE 2213 FÉNIX: sin(phase*0.5)/sin(phase*2) generaba W nerviosa.
  //   FIX: Péndulo real. X = balanceo lateral. Y = arco de gravedad (siempre ≤ 0).
  wave_y: (phase, audio) => {
    return {
      x: Math.sin(phase) * 0.8,
      y: -(Math.abs(Math.cos(phase * 0.5)) * 0.6),
    }
  },
  
  // BALLYHOO: Caos controlado (cierra cada 16 beats)
  // 🔥 WAVE 2213 FÉNIX: Eliminado fixtureOffset de amplitud — cada foco dibujaba
  //   la figura a un tamaño distinto. El offset de posición vive en el dominio
  //   del tiempo (phase/snake), no en la amplitud.
  // 🔥 WAVE 2213: ×1.8 — la multiplicación sin/cos atenúa severamente la amplitud
  //   final. El Gearbox y las escalas globales acotan el resultado de forma segura.
  ballyhoo: (phase, audio, index = 0, total = 1) => {
    const x = Math.sin(phase) * 0.5 + 
              Math.sin(phase * 3) * 0.3 + 
              Math.sin(phase * 5) * 0.15
    const y = Math.cos(phase) * 0.4 + 
              Math.cos(phase * 3) * 0.25 + 
              Math.cos(phase * 5) * 0.1
    return { x: x * 1.8, y: y * 1.8 }
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
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 2088.10: MONOTONIC PHASE ACCUMULATOR
  //
  // THE ROOT CAUSE (2088.9 forensics):
  //   Before: phase = (absoluteBeats % patternPeriod) / patternPeriod * 2π
  //   Problem 1: patternPeriod varied with energy → phase JUMPED discontinuously
  //   Problem 2: BPM fluctuated 70→184 frame-to-frame → chaotic phase velocity
  //   Problem 3: beatCount modulo changing period = INSTANT position teleport
  //
  // THE FIX: Accumulate phase delta frame-by-frame using smoothed BPM.
  //   phaseAccumulator += (smoothedBPM / 60) * dt / patternPeriod * 2π
  //   Phase ONLY moves forward (or very slowly backward), NEVER teleports.
  //   patternPeriod is FIXED per pattern (no energy modulation on period).
  //   Energy modulates AMPLITUDE only (which is continuous, not discontinuous).
  // ═══════════════════════════════════════════════════════════════════════
  private phaseAccumulator: number = 0
  private smoothedBPM: number = 120
  private readonly BPM_SMOOTH_FACTOR = 0.05  // Very slow BPM tracking (20 frames to converge)
  
  // 🎚️ WAVE 2472: GRANDMASTER SPEED — multiplicador global de la IA
  // Escala el flujo de fase del motor generativo (0.1 = cámara lenta, 2.0 = doble velocidad)
  // NO afecta patrones manuales (Layer 2 del Arbiter) — solo Layer 0 (CHOREO)
  private globalSpeedMultiplier: number = 1.0
  
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
  
  // 🎚️ WAVE 2472: GRANDMASTER SPEED API
  
  setGlobalSpeedMultiplier(mult: number): void {
    this.globalSpeedMultiplier = Math.max(0.1, Math.min(2.0, mult))
    console.log(`[CHOREO] 🎚️ GrandMaster Speed: ×${this.globalSpeedMultiplier.toFixed(2)}`)
  }
  
  getGlobalSpeedMultiplier(): number {
    return this.globalSpeedMultiplier
  }
  
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
    
    // 🔥 WAVE 2088.10: Capture dt BEFORE updating lastUpdate
    let frameDeltaTime = 0.016  // default 60fps
    
    if (!isSameFrame) {
      // First call this frame: update all internal state
      frameDeltaTime = Math.min((now - this.lastUpdate) / 1000, 0.1)  // Cap at 100ms
      this.lastUpdate = now
      this.time += frameDeltaTime
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
    // 🔥 WAVE 2088.10: MONOTONIC PHASE ACCUMULATOR
    //
    // KILLED: ENERGY-TO-PERIOD modulation.
    // WHY: Changing patternPeriod frame-by-frame caused DISCONTINUOUS phase
    //      jumps. (absoluteBeats % changingPeriod) teleports the pattern.
    //      Energy should modulate AMPLITUDE (continuous), not PERIOD (discontinuous).
    //
    // KILLED: Direct beatCount-to-phase mapping.
    // WHY: BPM fluctuating 70→184 made absoluteBeats advance erratically.
    //      Modulo of erratic value = chaotic phase = convulsive movement.
    //
    // NEW: Smooth BPM → delta phase per frame → accumulate monotonically.
    //      Phase advances like a FLYWHEEL — steady, never teleporting.
    //      patternPeriod is FIXED per pattern (no energy modulation).
    // ═══════════════════════════════════════════════════════════════════
    const patternPeriod = basePatternPeriod  // FIXED — no energy modulation
    
    // Smooth BPM with heavy low-pass filter (only on first call per frame)
    if (!isSameFrame) {
      this.smoothedBPM += (safeBPM - this.smoothedBPM) * this.BPM_SMOOTH_FACTOR
    }
    
    // Accumulate phase delta using smoothed BPM and frame dt
    // 🎚️ WAVE 2472: globalSpeedMultiplier scales the AI's time flow
    if (!isSameFrame) {
      const beatsPerSecond = this.smoothedBPM / 60
      const phasePerBeat = (2 * Math.PI) / patternPeriod  // radians per beat
      const phaseDelta = beatsPerSecond * frameDeltaTime * phasePerBeat * this.globalSpeedMultiplier
      this.phaseAccumulator += phaseDelta
    }
    
    const phase = this.phaseAccumulator
    
    // PATTERN EXECUTION
    const patternFn = PATTERNS[patternName as GoldenPattern]
    if (!patternFn) {
      console.warn(`[CHOREO] Unknown pattern: ${patternName}, using breath`)
      return this.createHomeIntent('breath')
    }
    
    const rawPosition = patternFn(phase, audio, fixtureIndex, totalFixtures)
    
    // THE GEARBOX - Dynamic Amplitude Scaling
    // 🔥 WAVE 2088.10: Use smoothedBPM for stable gearbox calculations
    const effectiveAmplitude = this.calculateEffectiveAmplitude(
      config.amplitudeScale,
      this.smoothedBPM,
      patternPeriod,
      audio.energy,
      fixtureMaxSpeed
    )
    
    // ═══════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.3 + 2088.8: PHRASE ENVELOPE — The Breathing Amplifier
    //
    // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
    // ANTES: Rango 0.60-1.00. En los primeros compases, la amplitud era 60%
    // → los patrones perdían su forma (un square al 60% = un blob centrado).
    // AHORA: Rango 0.85-1.00. La frase RESPIRA pero los patrones mantienen
    // su identidad geométrica en TODO momento.
    //
    //   Beat 0-7   (compás 1-2):  0.85 → 0.90  — arranque contenido
    //   Beat 8-19  (compás 3-5):  0.90 → 1.00  — expansión progresiva
    //   Beat 20-23 (compás 6):    1.00          — CLÍMAX: apertura máxima
    //   Beat 24-31 (compás 7-8):  1.00 → 0.85  — relajación elegante
    // ═══════════════════════════════════════════════════════════════════
    const phraseBeats = 32
    const phraseProgress = (beatCount % phraseBeats) / phraseBeats  // 0.0 → 1.0
    
    // Coseno desplazado: arranca en 0.85, pico en 1.0 a ~62% de la frase
    const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
    // Clamp final: el envelope escala entre 0.85 y 1.0
    const clampedEnvelope = Math.max(0.85, Math.min(1.0, phraseEnvelope))
    
    const finalAmplitude = effectiveAmplitude * clampedEnvelope
    
    // Aplicar amplitud (con phrase envelope de WAVE 2086.3)
    // WAVE 2224: DANCEFLOOR GRAVITY — techno-club apunta a la pista (adelante/abajo)
    // 🔧 WAVE 2233: -0.35 → -0.20. Con amplitudeScale 0.70, -0.35 empujaba tilt contra límite inferior.
    const tiltOffset = vibeId === 'techno-club' ? -0.20 : 0
    const position = {
      x: Math.max(-1, Math.min(1, rawPosition.x * finalAmplitude)),
      y: Math.max(-1, Math.min(1, (rawPosition.y * finalAmplitude) + tiltOffset)),
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
      const phaseDeg = Math.round((this.phaseAccumulator % (2 * Math.PI)) * 180 / Math.PI)
      console.log(`[CHOREO] ${vibeId} | ${patternName}${manualTag}${transitionTag}${stereoTag} | Bar:${this.barCount} | Pan:${panDeg} Tilt:${tiltDeg} | sBPM:${Math.round(this.smoothedBPM)} phase:${phaseDeg}°`)
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
    
    // 🔧 WAVE 2192: GEARBOX LIBERATION — Floor 0.85 → 0.10
    // WAVE 2088.7 puso floor en 0.85 para "intentar recorrido completo",
    // pero eso ANULA cualquier amplitudeScale < 0.85 del preset.
    // Techno con amplitudeScale=0.40 se forzaba a 0.85 = movimiento gigante.
    // Floor 0.10 permite que los presets controlen la amplitud real.
    const GEARBOX_MIN_AMPLITUDE = 0.10
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
    this.phaseAccumulator = 0
    this.smoothedBPM = 120
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
