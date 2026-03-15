/**
 * WAVE 1155: THE CHOREOGRAPHER REBORN
 * WAVE 2086.1: STEREO RESURRECTION — Phase offset (mirror/snake) lives HERE now
 * WAVE 2086.2: THE MAJESTIC REFORM — Professional period scaling (no more epilepsy)
 * WAVE 2208: THE GREAT DECOUPLING — BPM PERMANENTLY REMOVED FROM PHASE ACCUMULATOR
 *   The phase accumulator is now a pure time-domain oscillator.
 *   phaseDelta = dt * baseFrequency * (2π / patternPeriodSeconds)
 *   No BPM. No beat tracker. No godearFFT. No smoothedBPM. No phaseBPM.
 *   Pattern rotation is purely chronological (every 30 real seconds).
 *   Chill-lounge bypasses the pattern engine entirely (hardcoded micro-drift).
 *   Reason: Every attempt to couple BPM to phase (WAVE 2206, 2207) caused
 *   mechanical stuttering from kick-to-kick BPM fluctuations. The original
 *   WAVE 2088.10 monotonic accumulator was genius, but feeding it variable BPM
 *   destroyed the monotonicity. Time is the only constant. Time is the phase.
 * 
 * WAVE 2209: THE AMPLITUDE EXORCISM + VELOCITY COMPENSATION
 *   SURGERY 1: ALL reactive audio modulation of amplitude KILLED.
 *     energyBoost (±20% per-frame from audio.energy) → REMOVED.
 *     Phrase Envelope (beatCount-driven 0.85-1.0 oscillation) → FROZEN to 1.0.
 *     Gearbox still computes hardware budget but returns FIXED amplitude per vibe.
 *     Result: pattern radius is CONSTANT. Zero deformation. Zero tirones.
 *   SURGERY 2: Phase velocity compensated for lost BPM.
 *     WAVE 2208 made techno cycle in 64s (absurdly slow).
 *     Added VIBE_PHASE_MULTIPLIER: techno=8, latino=6, pop-rock=5.
 *     Techno scan_x now cycles in ~8 seconds (professional show speed).
 *   SURGERY 3: Chill bypass truly glacial.
 *     Frequencies reduced 700×. Amplitude reduced to ±0.8% / ±0.5%.
 *     Period: ~20,000 seconds (5+ hours). Genuinely imperceptible.
 * 
 * WAVE 2210: THE PHYSICS EXORCISM + ABSOLUTE CLOCK
 *   SURGERY 1: Chill bypass switches from this.time (dt accumulator) to
 *     Date.now()/1000 (absolute wall clock). Eliminates integrator drift
 *     and post-pause position jumps. Amplitude increased to ±35% / ±20%
 *     for a visible but genuinely glacial cloud-of-light effect.
 *     Period X: ~15,534s (~4.3h). Period Y: ~29,600s (~8.2h).
 *   SURGERY 2: Phase accumulator becomes absolute clock.
 *     phaseAccumulator = (Date.now()/1000) × baseFreq × (2π/period) × multiplier
 *     Eliminates rAF jitter accumulation (±2-5ms/frame → 108s/10min drift).
 *     Pause/resume no longer causes phase jumps.
 *     Stereo L/R fixtures get same phase → fixtureIndex handles differentiation.
 *   SURGERY 3: Techno physicsMode 'snap' → 'classic' (VibeMovementPresets.ts).
 *     snap mode = correct for DISCRETE targets (jump to fixed position).
 *     snap mode = WRONG for CONTINUOUS trajectories (sin, figure8, scan).
 *     With smooth phase targets, snapFactor=0.85 makes the driver reach each
 *     micro-target in <1ms and hard-brake → staircase/robotic effect.
 *     Classic mode with friction=0.08 gives inertia that follows continuous
 *     curves smoothly while retaining techno's aggressive personality.
 * 
 * WAVE 2212: THE SNAP EXORCISM + GEOMETRIC FIX + MULTIPLIER BOOST
 *   SURGERY 1: fiesta-latina and pop-rock physicsMode 'snap' → 'classic'.
 *     snap + continuous sinusoidal targets = staircase effect (micro-target
 *     snapping every frame fragments the geometry into visible steps).
 *     fiesta-latina: classic, friction=0.15, arrivalThreshold=1.5, maxAccel=1500
 *     pop-rock: classic, friction=0.20, arrivalThreshold=1.5, maxAccel=1500
 *     All active vibes are now physicsMode: 'classic'. snap is fully exorcised.
 *   SURGERY 2: Snake stereo offset moved from post-patternFn to pre-patternFn.
 *     BUG: rotating position vector {x,y} with atan2/cos/sin moves point to a
 *     CIRCLE, not the next point on figure8. Geometry deformed on all 2D patterns.
 *     FIX: patternPhase += fixtureIndex * stereoConfig.offset BEFORE patternFn().
 *     Any f(phase + offset) gives a valid point on the same trajectory as f(phase).
 *     Removed internal fixtureOffset from scan_x, circle_big, cancan (double-count).
 *   SURGERY 3: VIBE_PHASE_MULTIPLIER boosted.
 *     techno-club: 8 → 12 (~5.3s per scan — rave energy)
 *     fiesta-latina: 6 → 12 (~9s per figure8 — hips move faster)
 *     pop-rock: 5 → 8 (~10s per circle — stadium at full power)
 * 
 * WAVE 2213: HARDWARE CALIBRATION — MULTIPLIER DOWNTUNE + ANTI-STUCK EXORCISM
 *   Field report: multiplier x12 caused mechanical overload on physical hardware.
 *   CALIBRATION: VIBE_PHASE_MULTIPLIER adjusted to validated field values.
 *     techno-club: 12 → 10 (~6.4s per scan cycle — rave energy, sustainable)
 *     fiesta-latina: 12 → 8  (~13s per figure8 — hips alive, no optical collapse)
 *     pop-rock: 8 → 6        (~13s per circle — stadium groove, servo-safe)
 *   EXORCISM: Anti-Stuck Mechanism (FIX V16.4) REMOVED from FixturePhysicsDriver.
 *     Root cause: WAVE 2209+ patterns use DMX 0/255 as valid targets.
 *     Anti-Stuck fired when pos≥254 OR pos≤1 with absDistance>20 — exact match
 *     for normal pattern endpoints and manual XY Pad→AI handoff transitions.
 *     Result: erratic jumps and log spam post-handoff. Mechanism is now dead.
 *     physicsMode:'classic' + anti-overshoot + jitterThreshold are sufficient.
 *   SURGERY 3: amplitudeScale calibrated to physical hardware (540° Pan / 270° Tilt).
 *     amplitudeScale=1.0 maps to full 540° sweep — mechanical overload / "peonza" effect.
 *     techno-club:   1.0  → 0.40 (fast, contained — rave grid)
 *     fiesta-latina: 0.85 → 0.35 (elegant curves — no optical collapse)
 *     pop-rock:      0.80 → 0.45 (stadium sweep — servo-safe arc)
 *     chill-lounge:  0.50 → 0.50 (unchanged — glacial drift needs full range)
 *   SURGERY 4: diamond pattern rewritten — was a circle (sin/cos), now correct geometry.
 *     BUG: sin(phase), cos(phase) traces a circumference, not a rhombus.
 *     FIX: Linear interpolation between 4 cardinal vertices (same method as square).
 *     Vertices: Top(0,1) → Right(1,0) → Bottom(0,-1) → Left(-1,0).
 *     Equivalent to square rotated 45°. Sharp zig-zag target trajectory.
 *   SURGERY 5: ballyhoo fixtureOffset purified from amplitude domain.
 *     BUG: fixtureOffset=(index/total)*0.3 → each fixture drew figure at different scale.
 *     FIX: return { x, y } pure — stereo offset already lives in patternPhase domain.
 *   SURGERY 6: wave_y redesigned — was a W-bounce (Lissajous 0.5:2), now a latin pendulum.
 *     BUG: sin(phase*0.5)/sin(phase*2) generated an erratic W-shape, not a curve.
 *     FIX: x=sin(phase)*0.8 (lateral sweep) + y=-abs(cos(phase*0.5))*0.6 (gravity arc).
 *     Result: a swinging U — rope-under-gravity pendulum, one arc per full sweep.
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
 * @version WAVE 2213 — Hardware Calibration + Full Geometry Audit
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
    amplitudeScale: 0.40,  // 🔧 WAVE 2213: 1.0 → 0.40. En 540° Pan, 1.0 = peonza completa. 0.40 = barrido contenido profesional.
    baseFrequency: 0.25,
    patterns: ['scan_x', 'square', 'diamond', 'botstep'],
    homeOnSilence: false,
  },
  
  // LATINO: Curvas, fluidez, caderas
  'fiesta-latina': {
    amplitudeScale: 0.35,  // 🔧 WAVE 2213: 0.85 → 0.35. Curvas elegantes sin colapso óptico en hardware real.
    baseFrequency: 0.15,
    patterns: ['figure8', 'wave_y', 'ballyhoo'],
    homeOnSilence: false,
  },
  
  // POP-ROCK: Simetria, majestuosidad, estadio
  'pop-rock': {
    amplitudeScale: 0.45,  // 🔧 WAVE 2213: 0.80 → 0.45. Barridos medios de estadio, sin sobrepasar el rango útil del servo.
    baseFrequency: 0.20,
    patterns: ['circle_big', 'cancan', 'dual_sweep'],
    homeOnSilence: true,
  },
  
  // CHILL: Organico, invisible, respiracion
  // 🔧 WAVE 2206: Chill = GLACIAR. baseFrequency 0.10 → 0.03
  //   Con el fix de baseFrequency conectado al accumulator:
  //   0.03 / 0.20 = 0.15 → la fase avanza al 15% de Rock.
  //   Un drift de 32 beats ahora toma ~213 beats = ~1.8 minutos.
  //   VIRTUALMENTE SEMI-ESTÁTICO.
  'chill-lounge': {
    amplitudeScale: 0.50,  // Mantenido: drift glacial necesita escala completa en su rango.
    baseFrequency: 0.03,
    patterns: ['drift', 'sway', 'breath'],
    homeOnSilence: true,
  },
  
  // IDLE: Minimo
  // 🔧 WAVE 2206: Idle aún más lento que Chill
  'idle': {
    amplitudeScale: 0.1,
    baseFrequency: 0.02,
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
  ballyhoo: 16,     // 4 compases: espiral épica pero con cadencia latina (WAVE 2088.11: era 32, demasiado lento)
  
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

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 2209: VIBE PHASE MULTIPLIER — Velocity Compensation
//
// WAVE 2208 removed BPM from the phase formula, leaving ONLY baseFrequency
// to drive angular velocity. Result: techno scan_x cycles in 64 seconds
// (baseFrequency 0.25 × 2π / 16 beats = 0.098 rad/s → 64s per 2π).
// That's geologically slow for a techno show.
//
// Before WAVE 2208, BPM (~128) was part of the formula:
//   old phaseDelta = (BPM/60) × dt × (2π/period) × freqScale
//   At 128 BPM: 2.133 beats/s × freqScale(1.25 for techno) = ~2.67× faster
//
// Instead of re-introducing BPM (which caused all the jitter), we apply a
// FIXED per-vibe multiplier to compensate. These are CONSTANTS — no audio
// dependency, no frame-to-frame variation, no jitter.
//
// Target cycle times (professional show reference):
//   Techno scan_x (period=16): ~8 seconds per full sweep → multiplier = 64/8 = 8
//   Latino figure8 (period=16): ~18 seconds per full 8 → multiplier = 107/18 ≈ 6
//   Pop-rock circle (period=16): ~16 seconds per full circle → multiplier = 80/16 = 5
//   Idle breath (period=16): ~160 seconds (2.7 min) → multiplier = 5
//   Chill: BYPASSED — uses hardcoded drift, multiplier irrelevant
// ═══════════════════════════════════════════════════════════════════════════

const VIBE_PHASE_MULTIPLIER: Record<string, number> = {
  'techno-club':    10,   // � WAVE 2213: 12→10. 64s / 10 = ~6.4s per scan cycle — validado en hardware físico
  'fiesta-latina':   8,   // � WAVE 2213: 12→8.  107s / 8  = ~13s per figure8  — caderas vivas sin colapso óptico
  'pop-rock':        6,   // � WAVE 2213: 8→6.   80s / 6   = ~13s per circle   — estadio con groove real
  'chill-lounge':    1,   // BYPASSED — chill uses hardcoded drift, this is unused
  'idle':            5,   // 800s / 5 = ~160s per breath — glacial but visible
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
    // 🔥 WAVE 2212: fixtureOffset eliminado — el stereo offset vive en
    // patternPhase (dominio tiempo, inyectado por el snake block pre-patternFn).
    // Doble offset = cancelación destructiva de la geometría.
    return {
      x: Math.sin(phase),
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
  
  // DIAMOND: Rombo con interpolación lineal entre vértices cardinales
  // � WAVE 2213: REWRITE GEOMÉTRICO — el diamante anterior era un círculo.
  //   BUG: sin(phase), cos(phase) traza una circunferencia, no un rombo.
  //   FIX: Mismo método que square — 4 vértices cardinales con interpolación
  //   lineal a velocidad constante. Vértices: Top(0,1)→Right(1,0)→Bot(0,-1)→Left(-1,0).
  //   El carácter "agresivo de rombo" lo da el PhysicsDriver al clavar cada vértice.
  //   Es square rotado 45°: las aristas ahora son diagonales, no horizontales.
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
  
  // WAVE_Y: Péndulo latino — ola suave en U cadenciosa
  // 🔥 WAVE 2213: REDISEÑO COMPLETO — eliminado el 'muelle nervioso'.
  //   BUG: sin(phase*0.5) / sin(phase*2) generaba una 'W' asimétrica y nerviosa.
  //   X a media velocidad y Y al doble creaba un Lissajous 0.5:2 — demasiado agitado
  //   para música latina. No fluye, rebota.
  //   FIX: Péndulo real. X describe un balanceo lateral completo (sin puro).
  //   Y describe el arco de gravedad: siempre negativo (-abs(cos)), la U de una
  //   cuerda que cuelga — máximo en los extremos, mínimo en el centro.
  //   La relación X:Y es 1:0.5 — cadenciosa, un solo arco por barrido completo.
  wave_y: (phase, audio) => {
    return {
      x: Math.sin(phase) * 0.8,
      y: -(Math.abs(Math.cos(phase * 0.5)) * 0.6),
    }
  },
  
  // BALLYHOO: Caos controlado (cierra cada 16 beats)
  // 🔥 WAVE 2213: PURIFICACIÓN — eliminado fixtureOffset de amplitud.
  //   BUG: fixtureOffset = (index / total) * 0.3 hacía que cada foco dibujara
  //   la figura a un tamaño distinto. Foco 0 = 85% de amplitud, foco 3 = 100%.
  //   El offset de posición ya vive en el dominio del tiempo (patternPhase),
  //   no en la amplitud. La figura debe ser idéntica para todos los fixtures.
  ballyhoo: (phase, audio, index = 0, total = 1) => {
    const x = Math.sin(phase) * 0.5 + 
              Math.sin(phase * 3) * 0.3 + 
              Math.sin(phase * 5) * 0.15
    const y = Math.cos(phase) * 0.4 + 
              Math.cos(phase * 3) * 0.25 + 
              Math.cos(phase * 5) * 0.1
    return { x, y }
  },
  
  // POP-ROCK PATTERNS - Stadium / Symmetry / Majestuosidad
  
  // CIRCLE_BIG: El rey de los estadios
  circle_big: (phase, audio, index = 0, total = 1) => {
    // 🔥 WAVE 2212: fixtureOffset eliminado — el stereo offset vive en
    // patternPhase (dominio tiempo, inyectado por el snake block pre-patternFn).
    // Con el offset en fase, cada fixture traza el mismo círculo perfecto
    // pero desplazado en el tiempo → ola visual elegante en el estadio.
    return {
      x: Math.sin(phase),
      y: Math.cos(phase) * 0.75,
    }
  },
  
  // CANCAN: Piernas de bailarina (X fijo, Y arriba/abajo)
  cancan: (phase, audio, index = 0, total = 1) => {
    // 🔥 WAVE 2212: fixtureOffset eliminado — el stereo offset vive en
    // patternPhase (dominio tiempo, inyectado por el snake block pre-patternFn).
    // El X lento (0.25 sub-harmónico) crea el balanceo lateral orgánico.
    return {
      x: Math.sin(phase * 0.25) * 0.15,
      y: Math.sin(phase),
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
  // 🔥 WAVE 2208+2209: PURE TIME-DOMAIN PHASE ACCUMULATOR
  //
  // HISTORY (why we're here):
  //   WAVE 2088.10: Invented monotonic phase accumulator — GENIUS.
  //     But it used smoothedBPM to compute phaseDelta.
  //   WAVE 2206: Connected baseFrequency to phaseDelta — CORRECT.
  //     But BPM still drove the phase → kick-to-kick jitter.
  //   WAVE 2207: Added two-stage BPM flywheel — INSUFFICIENT.
  //   WAVE 2208: KILLED BPM permanently. Phase = dt × baseFrequency × 2π/period.
  //     But cycle times were geologically slow (64s for techno).
  //   WAVE 2209: Added VIBE_PHASE_MULTIPLIER to compensate velocity.
  //     Phase = dt × baseFrequency × 2π/period × VIBE_PHASE_MULTIPLIER
  //     All inputs are CONSTANTS. Zero audio dependency. Zero jitter.
  //
  // THE FIX: KILL BPM FROM PHASE. PERMANENTLY.
  //   phaseDelta = dt * baseFrequency * (2π / period) * VIBE_PHASE_MULTIPLIER
  //   The only variables are:
  //     dt — real wall-clock time delta (capped at 100ms)
  //     baseFrequency — per-vibe constant (0.25 techno, 0.03 chill)
  //     patternPeriod — per-pattern constant
  //     VIBE_PHASE_MULTIPLIER — per-vibe constant (8 techno, 6 latino...)
  //   Result: phase advances like a crystal oscillator. Zero jitter.
  //   A circle will be a mathematically perfect circle.
  //   A square will hit its corners with clockwork precision.
  // ═══════════════════════════════════════════════════════════════════════
  private phaseAccumulator: number = 0
  
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
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2210: CHILL-LOUNGE BYPASS — ABSOLUTE CLOCK + VISIBLE DRIFT
    //
    // WAVE 2209 bypass usaba this.time (acumulador de dt) como argumento
    // de sin(). Aunque no sumaba a lastPosition, this.time es un integrador
    // de dt que puede desviarse por jitter de rAF, pausa/reanudación,
    // o pérdida de foco de ventana. Al reanudar tras pausa larga, this.time
    // acumula el tiempo de pausa → el argumento del sin() da un salto
    // discreto → la posición "salta" instantáneamente.
    //
    // SOLUCIÓN: Usar Date.now() / 1000 como reloj absoluto.
    //   - Nunca acumula. Siempre es f(tiempo_real).
    //   - Reanudar tras pausa no genera salto (el sin() simplemente
    //     retoma donde estaría según el reloj real).
    //   - Jitter de rAF es irrelevante (la posición NO depende de dt).
    //
    // AMPLITUD VISIBLE (diagnóstico WAVE 2210):
    //   WAVE 2209: amplitude ×0.008 → ±4.3° en 540° — completamente invisible.
    //   Objetivo real del chill-lounge: derive SUAVE y PERCEPTIBLE (como nubes).
    //   Nueva amplitud: ×0.35 → ±94.5° en 540° visible pero glacial.
    //   Nueva amplitud tilt: ×0.20 → ±27° en 270° — movimiento etéreo.
    //
    // PERÍODOS con reloj absoluto:
    //   X: sin(t × 0.00025 × φ) → período ≈ 2π/(0.00025 × 1.618) ≈ 15,534s (~4.3h)
    //   Y: sin(t × 0.00015 × √2) → período ≈ 2π/(0.00015 × 1.414) ≈ 29,600s (~8.2h)
    //   A 4 horas de fiesta: se mueve ~82° total de pan. Nube de luz lenta.
    // ═══════════════════════════════════════════════════════════════════
    if (vibeId === 'chill-lounge') {
      const phi = 1.618033988749
      const sqrt2 = Math.SQRT2
      const tAbsolute = Date.now() / 1000  // reloj absoluto — sin acumulación, sin jitter
      const driftX = Math.sin(tAbsolute * 0.00025 * phi) * 0.35
      const driftY = Math.sin(tAbsolute * 0.00015 * sqrt2) * 0.20
      
      return {
        x: driftX,
        y: driftY,
        pattern: 'drift',
        speed: config.baseFrequency,
        amplitude: config.amplitudeScale,
        phaseType: 'polar' as const,
        _frequency: config.baseFrequency,
        _phrase: Math.floor(this.time / 30),
      }
    }
    
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
    
    // PHASE CALCULATION — Pure time-domain (WAVE 2208: THE GREAT DECOUPLING)
    const basePatternPeriod = PATTERN_PERIOD[patternName as GoldenPattern] || 4
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2209: PURE TIME-DOMAIN PHASE ACCUMULATOR + VELOCITY COMPENSATION
    //
    // WAVE 2208 killed BPM from the formula → crystal oscillator precision.
    // But baseFrequency alone was too slow (64s per techno cycle).
    // WAVE 2209 adds a FIXED per-vibe multiplier (VIBE_PHASE_MULTIPLIER)
    // to compensate for the lost BPM-driven velocity.
    //
    // The multiplier is a CONSTANT per vibe — zero audio dependency,
    // zero frame-to-frame variation, zero jitter. Just a faster clock.
    //
    // FORMULA:
    //   angularVelocity = baseFrequency × (2π / period) × VIBE_PHASE_MULTIPLIER
    //
    // RESULTING CYCLE TIMES:
    //   Techno scan_x: 0.25 × 2π/16 × 8 = 0.785 rad/s → 8.0s per cycle
    //   Latino figure8: 0.15 × 2π/16 × 6 = 0.353 rad/s → 17.8s per cycle
    //   Pop-rock circle: 0.20 × 2π/16 × 5 = 0.393 rad/s → 16.0s per cycle
    //   Idle breath: 0.02 × 2π/16 × 5 = 0.039 rad/s → 160s per cycle
    // ═══════════════════════════════════════════════════════════════════
    const patternPeriod = basePatternPeriod  // FIXED — no energy modulation
    const phaseMultiplier = VIBE_PHASE_MULTIPLIER[vibeId] ?? 5
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2210: ABSOLUTE CLOCK PHASE — JITTER IMMUNITY
    //
    // WAVE 2209 usaba acumulador dt: `this.phaseAccumulator += dt × ω`
    // Problema: rAF tiene ±2-5ms de jitter por frame. Con 60fps durante
    // 10 minutos: ~36,000 frames × ±3ms = ±108s de desviación posible.
    // El patrón sinusoidal acumula error → se desfasa del reloj real.
    //
    // Problema adicional: pausa/reanudación → dt puede ser 2-5 segundos
    // en el primer frame tras reanudar → phase jump discreto → tirón.
    //
    // SOLUCIÓN: phase = f(Date.now()) — nunca acumulado, siempre correcto.
    //   angularVelocity = baseFrequency × (2π/period) × phaseMultiplier
    //   phaseAccumulator = (Date.now() / 1000) × angularVelocity
    //
    // Propiedades matemáticas:
    //   - Jitter de rAF → irrelevante (phase no depende de dt)
    //   - Pausa/reanudación → sin salto (el reloj continuó durante la pausa)
    //   - Dos fixtures (L/R) con mismo vibeId → MISMO phase → MISMO destino
    //     (la diferenciación stereo viene de fixtureIndex, no de phase drift)
    //   - Determinismo en tests: vi.spyOn(Date, 'now') propaga directamente
    //
    // NOTA: isSameFrame sigue protegiendo this.time y this.frameCount,
    //   pero la phase ya no necesita esa guardia — es puro cálculo.
    // ═══════════════════════════════════════════════════════════════════
    const angularVelocity = config.baseFrequency * (2 * Math.PI) / patternPeriod * phaseMultiplier
    this.phaseAccumulator = (Date.now() / 1000) * angularVelocity
    
    const phase = this.phaseAccumulator

    // ═══════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2212: STEREO SNAKE PHASE OFFSET — THE GEOMETRIC FIX
    //
    // ANTES (BUG): El snake offset se aplicaba POST-patternFn rotando el
    // vector posición {x,y} con Math.atan2/cos/sin en el plano XY.
    // Problema: rotar un punto de figure8 {x:0.5, y:0.8} alrededor del
    // origen lo lleva a un punto en un CÍRCULO — no al siguiente punto
    // del figure8. La geometría quedaba deformada en todos los patrones 2D.
    //
    // AHORA: El offset se suma a la FASE (dominio tiempo) ANTES de evaluar
    // el patrón. Si fixture A está en phase=t, fixture B está en phase=t+offset.
    // Esto garantiza que ambos fixtures tracen la MISMA geometría pero
    // desplazados temporalmente — como bailarines en la misma coreografía.
    //
    // Propiedad matemática: para cualquier función f(phase),
    //   f(phase + offset) es siempre un punto válido en la trayectoria de f
    //   mientras que rotar {x,y} solo es correcto para círculos perfectos.
    // ═══════════════════════════════════════════════════════════════════════
    const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle']
    let patternPhase = phase
    if (stereoConfig.type === 'snake' && totalFixtures > 1) {
      patternPhase += fixtureIndex * stereoConfig.offset
    }

    // PATTERN EXECUTION
    const patternFn = PATTERNS[patternName as GoldenPattern]
    if (!patternFn) {
      console.warn(`[CHOREO] Unknown pattern: ${patternName}, using breath`)
      return this.createHomeIntent('breath')
    }

    const rawPosition = patternFn(patternPhase, audio, fixtureIndex, totalFixtures)
    
    // THE GEARBOX - Dynamic Amplitude Scaling
    // 🔥 WAVE 2208: Gearbox uses a FIXED reference BPM (120) since phase is time-domain now.
    // The Gearbox calculates hardware speed budget based on BPM × period × amplitude.
    // With BPM decoupled from phase, we use 120 as the canonical reference tempo.
    // This gives consistent amplitude scaling regardless of actual audio tempo.
    const GEARBOX_REFERENCE_BPM = 120
    const effectiveAmplitude = this.calculateEffectiveAmplitude(
      config.amplitudeScale,
      GEARBOX_REFERENCE_BPM,
      patternPeriod,
      audio.energy,
      fixtureMaxSpeed
    )
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2209: PHRASE ENVELOPE FROZEN — CONSTANT AMPLITUDE
    //
    // WAVE 2086.3 introduced a 32-beat breathing cycle (0.85 → 1.0).
    // This was driven by beatCount from the audio context.
    // Problem: beatCount from godearFFT can be erratic → envelope jumps →
    //   amplitude changes mid-pattern → geometry deformation.
    // Combined with energyBoost (now killed), the amplitude had TWO
    // sources of beat-reactive variation. Both are now DEAD.
    //
    // The phrase envelope is FROZEN at 1.0. The amplitude path is now:
    //   VIBE_CONFIG.amplitudeScale → Gearbox hardware limit → × 1.0
    //   = pure, constant, sacred geometry.
    //
    // If in the future we want "breathing" amplitude, it MUST use
    // this.time (wall-clock), NOT beatCount. And it must have period
    // >> 30 seconds to avoid visible pulsation. For now: 1.0. STATIC.
    // ═══════════════════════════════════════════════════════════════════
    const clampedEnvelope = 1.0  // FROZEN — no reactive modulation
    
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
    // SNAKE (latino/pop/chill): Phase offset ya aplicado PRE-patternFn (WAVE 2212)
    // SYNC (idle): Sin cambio
    // ═══════════════════════════════════════════════════════════════════════
    // stereoConfig ya declarado arriba (WAVE 2212 — usado para patternPhase)
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
    }
    // � WAVE 2212: SNAKE eliminado de post-patternFn.
    // El offset de snake ahora vive en patternPhase (dominio tiempo).
    // Ver bloque "STEREO SNAKE PHASE OFFSET" arriba.
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
      console.log(`[CHOREO] ${vibeId} | ${patternName}${manualTag}${transitionTag}${stereoTag} | Bar:${this.barCount} | Pan:${panDeg} Tilt:${tiltDeg} | phase:${phaseDeg}° | freq:${config.baseFrequency}`)
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
    
    // ═══════════════════════════════════════════════════════════════════
    //  WAVE 2208: PURELY CHRONOLOGICAL PATTERN ROTATION
    //
    // KILLED: barCount / beatCount dependency for pattern rotation.
    // WHY: barCount depends on beatCount from audio → if beat tracker
    //   stalls, barCount freezes → pattern gets STUCK on one shape.
    //   If beat tracker jitters, barCount can jump → frenetic switching.
    //   Both failure modes observed in field (WAVE 2206, 2207).
    //
    // NEW: this.time is accumulated from frameDeltaTime (wall-clock).
    //   Pattern rotates every 30 real seconds. Period. No exceptions.
    //   30 seconds × 4 techno patterns = 2 minute cycle. Professional.
    //   30 seconds × 3 chill patterns = 90 second cycle. Meditative.
    //   The show operator always knows EXACTLY when patterns change.
    //   Beat tracker can die, jitter, or hallucinate — doesn't matter.
    // ═══════════════════════════════════════════════════════════════════
    const phrase = Math.floor(this.time / 30)  // Rotate every 30 real seconds
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
    
    // ═══════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2209: ENERGY BOOST KILLED — STATIC AMPLITUDE
    //
    // BEFORE: energyBoost = 1.0 + energy * 0.2
    //   → amplitude fluctuated ±20% with every audio frame
    //   → each kick increased the pattern RADIUS instantaneously
    //   → circle becomes egg, square becomes trapezoid
    //   → FixturePhysicsDriver had to chase the expanding target = TIRÓN
    //
    // NOW: requestedAmplitude = baseAmplitude (FIXED per vibe, from VIBE_CONFIG)
    //   Techno: 1.0, Latino: 0.85, Pop-rock: 0.80, Chill: 0.50, Idle: 0.10
    //   The amplitude is a CONSTANT. The geometry is SACRED.
    //   Audio energy no longer touches the pattern scale. Period.
    // ═══════════════════════════════════════════════════════════════════
    const requestedAmplitude = baseAmplitude
    
    // Distancia solicitada (255 DMX = full range)
    const requestedTravel = 255 * requestedAmplitude
    
    // Factor de reduccion si excede el presupuesto
    const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
    
    // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Hard floor 0.85
    // El Gearbox NUNCA debe aplastar la amplitud por debajo del 85%.
    // Los movers deben INTENTAR el recorrido completo; el PhysicsDriver
    // ya se encarga de limitar la velocidad real del hardware.
    //
    // 🔥 WAVE 2209: With phrase envelope FROZEN at 1.0 and energyBoost KILLED,
    // the amplitude chain is now: VIBE_CONFIG.amplitudeScale → Gearbox → × 1.0
    // Effective minimum = GEARBOX_MIN (0.85) × 1.0 = 0.85 of vibe's amplitudeScale.
    // 🔧 WAVE 2213: amplitudeScale calibrated to field values (techno=0.40, latina=0.35, rock=0.45).
    // For techno (amplitudeScale=0.40): minimum output = 0.34 of full DMX range. Servo-safe.
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
    this.phaseAccumulator = 0
    // WAVE 2208: No BPM state to reset — phase is pure time-domain now
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
