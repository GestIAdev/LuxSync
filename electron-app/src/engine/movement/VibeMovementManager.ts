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
 *   1. amplitudeScale split into panScale/tiltScale (WAVE 4645) for asymmetric hardware ranges
 *      techno=(0.40,0.70), latina=(0.35,0.65), rock=(0.45,0.65)
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
  /** Escala de amplitud Pan (1.0 = full range de 540°) */
  panScale: number
  /** Escala de amplitud Tilt (1.0 = full range de 270°) */
  tiltScale: number
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
  | 'darkspin'    // Giro orbital oscuro con respiración de radio
  | 'laser_grid'      // 🌊 WAVE 6030.7: Escáner láser — snap entre 6 nodos de cuadrícula
  | 'industrial_pendulum' // 🌊 WAVE 6030.7: Péndulo pesado con amortiguamiento exponencial
  // LATINO (5 patterns - Fluid/Hips/Soul)
  | 'figure8'     // El infinito - caderas de cumbia
  | 'wave_y'      // Ola: X lento, Y rapido
  | 'ballyhoo'    // Espiral compleja, cierra cada 4 compases
  | 'cadera_libre'    // 🌊 WAVE 4703: Cadera libre — Lissajous 3:2 con deriva orgánica
  | 'espiral_conga'   // 🌊 WAVE 4703: Espiral conga — hélice tridimensional con elevación
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

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4741: PatternConfig — DESACOPLAMIENTO TOTAL de velocidad y duración
// ─────────────────────────────────────────────────────────────────────────
// Reemplaza PATTERN_PERIOD (un único número que controlaba DOS cosas
// incompatibles: velocidad del foco y duración en escena).
//
//  cycleBeats       → beats para un ciclo completo (phasePerBeat = 2π/cycleBeats)
//  phraseDuration   → beats en escena antes de ser elegible para cambio
//                     Invariante: phraseDuration = N × cycleBeats
//  safeHarborPhase  → radianes donde el fixture está en posición segura
//  safeHarborWindow → tolerancia angular ±(rad) alrededor del harbor
//  hardDeadlineExtra→ beats extra de gracia si el harbor no aparece
//  transitionBeats  → duración del LERP en beats (ASALTO 2)
// ═══════════════════════════════════════════════════════════════════════════
interface PatternConfig {
  /** Beats para un ciclo completo — controla la VELOCIDAD del foco */
  cycleBeats: number
  /** Beats en escena antes de ser elegible para cambio — controla la DURACIÓN */
  phraseDuration: number
  /** Fase (rad) donde el fixture está en posición central/segura para transicionar */
  safeHarborPhase: number
  /** Tolerancia angular ±(rad) alrededor del harbor */
  safeHarborWindow: number
  /** Beats extra de gracia si el harbor no llega antes del deadline */
  hardDeadlineExtra: number
  /** Duración del LERP en beats — reservado para ASALTO 2 */
  transitionBeats: number
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4741: SchedulerState global — rastrea tempo y patrón del choreographer
// Blueprint §2: mantener global (compartido por todos los fixtures).
// Per-fixture ("chaos/stagger") queda para una wave futura.
// ═══════════════════════════════════════════════════════════════════════════
interface SchedulerState {
  /** Índice en config.patterns[] del patrón activo */
  patternIndex: number
  /** Acumulador de fase monotónico — reemplaza phaseAccumulator */
  phase: number
  /** Beats transcurridos desde que empezó la frase actual */
  sceneBeatsElapsed: number
}

const TILT_CEILING = 0.15
// WAVE 4932.5: Límite inferior para ceiling. Sin este límite, intent.y muy negativo
// genera DMX > 212 que en fixtures con tiltRange=270° envía el haz al horizonte trasero.
// WAVE 4933.3: Reducido de 0.67 a 0.50 — máx 67° de inclinación desde vertical.
// A 0.67 (90°) el cono aparece a nivel de techo desde vista oblicua (efecto PACMAN residual).
// A 0.50 (67°) el cono base queda a ~1.25m del suelo: claramente apuntando al escenario.
const TILT_FLOOR_LIMIT = 0.50
// WAVE 4933.3: Offset de tilt para ceiling — centra el patrón en el centro del rango seguro
// [-TILT_FLOOR_LIMIT, -TILT_CEILING] = [-0.50, -0.15]. Centro = -0.325.
// Con tiltOffset=-0.325 y tiltScale=0.60: raw+offset ∈ [-0.925, +0.275].
// Upper clamp (-0.15) recorta +0.275→-0.15 (~14% del ciclo — breve toque vertical).
// Lower clamp (-0.50) recorta -0.925→-0.50 (~17% del ciclo — breve toque extremo).
// 69% del ciclo activo oscilando entre -0.50 y -0.15: haz siempre en semiesfera inferior.
const TILT_OFFSET_CEILING = -0.325

// 🧬 FASE 1B: exportado para que VibeGraftRegistry pueda injertar vibes custom.
// El tipo Readonly es sólo a nivel TS; el cast a Record<string, number> en el
// graft registry es seguro porque el backup/restore garantiza la reversibilidad.
export const TILT_OFFSET_BY_VIBE: Readonly<Record<string, number>> = {
  'techno-club': -0.35,
  'fiesta-latina': -0.15, // Subido de -0.35. Levanta la cabeza para hacer círculos amplios.
  'pop-rock': -0.30,
  'chill-lounge': -0.25,
  'idle': -0.10,
} as const

// VIBE CONFIGURATIONS

// 🧬 FASE 1B: exportado para que VibeGraftRegistry pueda injertar vibes custom.
export const VIBE_CONFIG: Record<string, VibeConfig> = {
  // TECHNO: Geometría dura, cortes precisos — CATEDRAL industrial
  //  WAVE 4730 TRÍADA: panScale 0.72→0.92, tiltScale 0.68→0.85, freq 0.22→0.10
  //   Barrido enorme (92% del pan = ~497°), frecuencia sostenible para hardware real.
  'techno-club': {
    panScale: 0.92,
    tiltScale: 0.60,
    baseFrequency: 0.15,
    patterns: ['scan_x', 'square', 'diamond', 'botstep', 'darkspin', 'laser_grid', 'industrial_pendulum'],
    homeOnSilence: false,
  },
  
  // LATINO: Curvas, fluidez, caderas — CATEDRAL sensual
  //  WAVE 4730 TRÍADA: panScale 0.95→0.95, tiltScale 0.80→0.88, freq 0.17→0.12
  //   Full stage pan, tilt abierto (88% = ~238°), frecuencia oceánica.
  'fiesta-latina': {
    panScale: 0.95,
    tiltScale: 0.85,  // Subido de 0.60. ¡Ahora usarán toda la pista!
    baseFrequency: 0.12,
    patterns: ['figure8', 'wave_y', 'ballyhoo', 'cadera_libre', 'espiral_conga'],
    homeOnSilence: false,
  },
  
  // POP-ROCK: Simetría, majestuosidad, estadio — CATEDRAL épica
  // 🏛️ WAVE 4730 TRÍADA: panScale 0.75→0.90, tiltScale 0.65→0.82, freq 0.20→0.08
  //   Arcos enormes de estadio (90% pan = ~486°), frecuencia lenta y solemne.
  'pop-rock': {
    panScale: 0.90,
    tiltScale: 0.59,
    baseFrequency: 0.14,
    patterns: ['circle_big', 'cancan', 'dual_sweep'],
    homeOnSilence: true,
  },
  
  // CHILL: Oceánico, deriva continental — CATEDRAL submarina
  //  WAVE 4730 TRÍADA: panScale 0.70→0.85, tiltScale 0.70→0.80, freq 0.04→0.03
  //   La medusa ahora abarca más océano, pero más lentamente que nunca.
  'chill-lounge': {
    panScale: 0.85,
    tiltScale: 0.58,
    baseFrequency: 0.02,
    patterns: ['drift', 'sway', 'breath'],
    homeOnSilence: false,
  },
  
  // IDLE: Mínimo — respiración imperceptible
  //  WAVE 4730 TRÍADA: sin cambio significativo (ya era correcto)
  'idle': {
    panScale: 0.15,
    tiltScale: 0.20,
    baseFrequency: 0.04,
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

// 🏛️ WAVE 4730 TRÍADA: Períodos duplicados para acomodar la amplitud masiva.
// Con panScale ~0.90 y hardware real (~180°/s pan), el foco necesita ≥4s
// para recorrer el arco completo. Períodos largos = majestuosidad = cero estrés.
const PATTERN_PERIOD: Record<GoldenPattern, number> = {
  // TECHNO — geometría industrial, DELIBERADA y ENORME
  scan_x: 16,       // 🏛️ 8→16. 4 compases: barrido de pared a pared con gravitas
  square: 32,       // 🏛️ 16→32. 8 compases: 1 esquina cada 2 compases, monumental
  diamond: 16,      // 🏛️ 8→16. 4 compases: rombo amplio con tiempo de llegada
  botstep: 16,      // 🏛️ 8→16. 4 compases: posiciones con peso, no nervio
  darkspin: 24,     // 🏛️ 12→24. 6 compases: órbita oscura lenta y densa
  laser_grid: 16,   // 🌊 WAVE 6030.7: 4 compases: snap rápido, hold en nodo
  industrial_pendulum: 32, // 🌊 WAVE 6030.7: 8 compases: amortiguamiento completo

  // LATINO — fluido, sensual, cadera — arcos épicos
  figure8: 32,      // 🏛️ 16→32. 8 compases: el infinito respira profundo
  wave_y: 16,       // 🏛️ 8→16. 4 compases: ola con masa, no espuma
  ballyhoo: 32,     // 🏛️ 16→32. 8 compases: espiral épica con cadencia
  cadera_libre: 32, //  20→32. 8 compases: Lissajous 3:2 necesita espacio
  espiral_conga: 48,//  24→48. 12 compases: hélice monumental
  
  // POP-ROCK — estadio, simetría, majestuosidad — arcos de catedral
  circle_big: 32,   // 🏛️ 16→32. 8 compases: el rey recorre TODO el escenario
  cancan: 16,       // 🏛️ 8→16. 4 compases: subida/bajada con gravitas
  dual_sweep: 32,   // 🏛️ 16→32. 8 compases: barrido en U cinematográfico
  
  // CHILL — oceánico, periodos geológicos — WAVE 4750: escalados a catedral submarina
  drift: 512,       // 128 compases: la deriva continental profunda.
  sway: 256,        // 64 compases: la corriente del abismo.
  breath: 192,      // 48 compases: la luz respira en cámara lenta.
  
  // THE FOUR NOBLES — sin cambio significativo
  slow_pan: 48,         // 🏛️ 32→48. 12 compases: faro lento del fondo
  tilt_nod: 24,         // 🏛️ 16→24. 6 compases: cabeceo meditativo
  figure_of_4: 24,      // 🏛️ 16→24. 6 compases: figure8 contenido
  chase_position: 24,   // 🏛️ 16→24. 6 compases: posiciones con solemnidad
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 4741: PATTERN_CONFIG — Reemplaza PATTERN_PERIOD
// ─────────────────────────────────────────────────────────────────────────
// Cada entrada desacopla cycleBeats (velocidad) de phraseDuration (escena).
// Regla musical: phraseDuration = N × cycleBeats (múltiplo entero siempre).
// safeHarborWindow = π/4 (±45°) estándar — tolerancia generosa sin ruido.
// hardDeadlineExtra = cycleBeats (1 ciclo extra de gracia anti-bloqueo).
// PATTERN_PERIOD permanece como fallback para código legacy hasta ASALTO 2.
// ═══════════════════════════════════════════════════════════════════════════
// 🧬 FASE 1B: exportado para que VibeGraftRegistry pueda injertar vibes custom.
// PATTERN_CONFIG es GLOBAL (no por vibe): el graft registry hace backup/restore.
export const PATTERN_CONFIG: Record<GoldenPattern, PatternConfig> = {
  // ── TECHNO — geometría industrial, majestuosa (CALIBRACIÓN DE FÁBRICA) ───
  // cycleBeats duplicados → mitad de velocidad física con GM=1.0x
  // phraseDuration extendido → 4-8 compases para que el show respire
  scan_x:    { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,        safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  square:    { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,        safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  diamond:   { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,        safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  botstep:   { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: Math.PI,  safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  darkspin:         { cycleBeats: 24, phraseDuration: 96,  safeHarborPhase: 0,       safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 24, transitionBeats: 4   },
  laser_grid:        { cycleBeats: 12, phraseDuration: 48,  safeHarborPhase: 0,       safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 12, transitionBeats: 2   },
  industrial_pendulum:{ cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,       safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3   },
  // ── LATINO — fluido, sensual, cadencia relajada (CALIBRACIÓN DE FÁBRICA) ──
  // cycleBeats 12-20 → 1 revolución en 6-10 compases a 100 BPM = meditativo
  figure8:      { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,     safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  wave_y:       { cycleBeats: 12, phraseDuration: 48, safeHarborPhase: 0,     safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 12, transitionBeats: 2   },
  ballyhoo:     { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,     safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3   },
  cadera_libre: { cycleBeats: 20, phraseDuration: 64, safeHarborPhase: 0,     safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 20, transitionBeats: 3   },
  espiral_conga:{ cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,     safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3   },
  // ── POP-ROCK — estadio, simetría majestuosa (CALIBRACIÓN DE FÁBRICA) ──────
  // cycleBeats 8-16 → 1 revolución en 4-8 compases = monumentalidad
  circle_big:  { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,      safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  cancan:      { cycleBeats: 8,  phraseDuration: 32, safeHarborPhase: Math.PI,safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8,  transitionBeats: 1   },
  dual_sweep:  { cycleBeats: 16, phraseDuration: 64, safeHarborPhase: 0,      safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  // ── CHILL — WAVE 4750: ABISMO OCEÁNICO — velocidad de catedral submarina ──────
  // cycleBeats 256-512 → 1 ciclo en 128-256 compases a 120 BPM = 64-128 minutos.
  // Con anti-jitter 8-bit (dithering) el movimiento es terciopelo puro.
  drift:  { cycleBeats: 512, phraseDuration: 1024, safeHarborPhase: 0,         safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 128, transitionBeats: 8   },
  sway:   { cycleBeats: 256, phraseDuration: 512,  safeHarborPhase: 0,         safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 64,  transitionBeats: 8   },
  breath: { cycleBeats: 192, phraseDuration: 384,  safeHarborPhase: 0,         safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 48,  transitionBeats: 6   },
  // ── THE FOUR NOBLES — universales relajados (CALIBRACIÓN DE FÁBRICA) ──────
  slow_pan:      { cycleBeats: 32, phraseDuration: 64, safeHarborPhase: 0,    safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 3   },
  tilt_nod:      { cycleBeats: 16, phraseDuration: 32, safeHarborPhase: 0,    safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  figure_of_4:   { cycleBeats: 16, phraseDuration: 32, safeHarborPhase: 0,    safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 16, transitionBeats: 2   },
  chase_position:{ cycleBeats: 8,  phraseDuration: 16, safeHarborPhase: 0,    safeHarborWindow: Math.PI / 4, hardDeadlineExtra: 8,  transitionBeats: 1   },
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

// 🧬 FASE 1B: exportado para que VibeGraftRegistry pueda injertar vibes custom.
export const STEREO_CONFIG: Record<string, StereoConfig> = {
  'techno-club':    { offset: Math.PI,     type: 'mirror' },   // L/R espejos (puertas abren/cierran)
  'fiesta-latina':  { offset: Math.PI / 4, type: 'snake' },    // 45° cadena de caderas
  'pop-rock':       { offset: Math.PI / 3, type: 'snake' },    // 60° wall ondulante
  'chill-lounge':   { offset: Math.PI / 2, type: 'snake' },    // 90° ola de mar lenta
  'idle':           { offset: 0,           type: 'sync' },     // Sin movimiento
}

// THE GOLDEN DOZEN - Implementaciones Matematicas Puras

// ─────────────────────────────────────────────────────────────────────────────
// K0-BATCH-1: Pre-allocated static pattern lookup tables (zero-alloc @ 44Hz)
// These arrays are constant — allocated once at module load, never recreated.
// ─────────────────────────────────────────────────────────────────────────────
const _SQUARE_CORNERS = [
  { x:  1, y:  1 },
  { x:  1, y: -1 },
  { x: -1, y: -1 },
  { x: -1, y:  1 },
]

const _DIAMOND_VERTICES = [
  { x:  0, y:  1 },  // Top
  { x:  1, y:  0 },  // Right
  { x:  0, y: -1 },  // Bottom
  { x: -1, y:  0 },  // Left
]

const _LASER_GRID_NODES = [
  { x:  0.90, y:  0.60 },  // arriba-der
  { x:  0.00, y:  0.80 },  // arriba-centro
  { x: -0.90, y:  0.60 },  // arriba-izq
  { x: -0.90, y: -0.60 },  // abajo-izq
  { x:  0.00, y: -0.80 },  // abajo-centro
  { x:  0.90, y: -0.60 },  // abajo-der
]

const _CHASE_POSITIONS = [
  { x: -0.7, y:  0   },  // Izquierda
  { x:  0,   y:  0.7 },  // Arriba
  { x:  0.7, y:  0   },  // Derecha
  { x:  0,   y: -0.7 },  // Abajo
]

type PatternFunction = (
  phase: number,
  audio: AudioContext,
  outPos: { x: number; y: number },
  index?: number,
  total?: number
) => void

const PATTERNS: Record<GoldenPattern, PatternFunction> = {
  
  // TECHNO PATTERNS - Industrial / Sharp / Geometria Dura
  
  // SCAN_X: Barrido horizontal con ondulación vertical (Lissajous 1:2 suave)
  // 🔧 WAVE 2221 MENDOZA: Añadido Y sinusoidal. Sin offset hardcodeado.
  // 🌊 WAVE 4703 M3: Añadido detuning armónico sutil (3er parcial a 3%) para
  //   romper la periodicidad perfecta sin perder la identidad del barrido.
  scan_x: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 0.5
    // Detuning orgánico: 3er armónico al 3% — apenas perceptible pero elimina la rigidez
    const detuneX = Math.sin((phase + fixtureOffset) * 3) * 0.03
    outPos.x = Math.sin(phase + fixtureOffset) + detuneX
    outPos.y = Math.sin((phase + fixtureOffset) * 2) * 0.75
  },
  
  // SQUARE: Movimiento cuadrado con interpolación lineal entre esquinas
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
  // 🌊 WAVE 4703 M3: Las esquinas tienen un micro-wobble senoidal (±2%) que
  //   hace que el fixture no llegue exactamente al vértice, sino que lo roce
  //   con un leve desvío — como un robot con personalidad.
  square: (phase, audio, outPos) => {
    const normalizedPhase = (phase / (Math.PI * 2)) * 4
    const currentCorner = Math.floor(normalizedPhase) % 4
    const nextCorner = (currentCorner + 1) % 4
    const t = normalizedPhase - Math.floor(normalizedPhase)
    
    const from = _SQUARE_CORNERS[currentCorner]
    const to = _SQUARE_CORNERS[nextCorner]
    // Micro-wobble: desvío senoidal de baja frecuencia en cada arista
    const wobble = Math.sin(phase * 7.3) * 0.02
    outPos.x = from.x + (to.x - from.x) * t + wobble
    outPos.y = from.y + (to.y - from.y) * t + wobble * 0.5
  },
  
  // DIAMOND: Rombo con interpolación lineal entre vértices cardinales
  // � WAVE 2213 FÉNIX: el diamante anterior era un círculo (sin/cos).
  //   FIX: Mismo método que square — 4 vértices cardinales con interpolación
  //   lineal a velocidad constante. Vértices: Top(0,1)→Right(1,0)→Bot(0,-1)→Left(-1,0).
  //   Es square rotado 45°: las aristas son diagonales, no horizontales.
  diamond: (phase, audio, outPos) => {
    const normalizedPhase = (phase / (Math.PI * 2)) * 4
    const currentVertex = Math.floor(normalizedPhase) % 4
    const nextVertex = (currentVertex + 1) % 4
    const t = normalizedPhase - Math.floor(normalizedPhase)

    const from = _DIAMOND_VERTICES[currentVertex]
    const to = _DIAMOND_VERTICES[nextVertex]
    outPos.x = from.x + (to.x - from.x) * t
    outPos.y = from.y + (to.y - from.y) * t
  },
  
  // BOTSTEP (TECHNO): 4 cuadrantes golden-ratio — robo con peso, no latigazo
  // �️ WAVE 6030.2: 8 pasos → 4 cuadrantes. cycleBeats 8→16 (ver PATTERN_CONFIG).
  // Ease-in-out cúbico (derivada máx 1.5×) reemplaza SmoothStep (derivada máx 1.5×
  // pero comprimido en 1/8 de ciclo vs 1/4 aquí). A 130 BPM, cycleBeats=16:
  //   tiempo por paso = 16/4 × (60/130) = ~1.85 s → vel. pico ≈ 280 DMX/s < 400 cap.
  // Amplitud 0.55: saltos visibles sin teleport. El PhysicsDriver aporta el "peso".
  botstep: (phase, audio, outPos) => {
    const phi = 1.618033988749
    const totalSteps = 4
    const normalizedPhase = (phase / (Math.PI * 2)) * totalSteps
    const currentStep = Math.floor(normalizedPhase) % totalSteps
    const nextStep = (currentStep + 1) % totalSteps

    // Ease-in-out cúbico: derivada máx = 1.5× en t=0.5, igual que smoothstep,
    // pero al tener 4 pasos (no 8) la ventana temporal es el doble → vel. pico mitad.
    let t = normalizedPhase - Math.floor(normalizedPhase)
    t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const fromX = Math.sin(currentStep * phi * Math.PI) * 0.55
    const fromY = Math.cos(currentStep * phi * phi * Math.PI) * 0.55
    const toX   = Math.sin(nextStep * phi * Math.PI) * 0.55
    const toY   = Math.cos(nextStep * phi * phi * Math.PI) * 0.55

    outPos.x = fromX + (toX - fromX) * t
    outPos.y = fromY + (toY - fromY) * t
  },

  // LASER_GRID: Escáner láser — snap entre 6 nodos de cuadrícula invisible
  // 🌊 WAVE 6030.7: El fixture recorre 6 puntos distribuidos en una elipse a 120°.
  // Easing ultra-rápido: ease-in cubic (t³) comprime el 90% del recorrido en el
  // primer 46% del intervalo → llegada instantánea + hold en el nodo.
  // Micro-dither ±1.5% sobre el nodo activo simula el "nervio" de un láser real.
  laser_grid: (phase, audio, outPos, index = 0, total = 1) => {
    const totalNodes = 6
    const normalizedPhase = (phase / (Math.PI * 2)) * totalNodes
    const currentNode = Math.floor(normalizedPhase) % totalNodes
    const nextNode = (currentNode + 1) % totalNodes

    // Ease-in cúbico: pico de velocidad al inicio, hold largo en el nodo
    let t = normalizedPhase - Math.floor(normalizedPhase)
    t = t * t * t  // t³ — llega rápido, espera

    const from = _LASER_GRID_NODES[currentNode]
    const to   = _LASER_GRID_NODES[nextNode]
    // Micro-dither: el láser "tiembla" sobre el nodo (no durante el viaje)
    const holdFraction = 1 - t  // mayor cuando está llegando al nodo
    const dither = (Math.sin(phase * 47.3 + index) * 0.015) * holdFraction
    outPos.x = from.x + (to.x - from.x) * t + dither
    outPos.y = from.y + (to.y - from.y) * t + dither * 0.6
  },

  // INDUSTRIAL_PENDULUM: Péndulo pesado con amortiguamiento exponencial
  // 🌊 WAVE 6030.7: Oscilación muy ancha en X (amplitud 0.95) con amortiguamiento
  // e^(-φ/π) que parte desde amplitud máxima y se extingue hacia el centro.
  // Al llegar al centro se reinicia automáticamente (fase mod 2π).
  // Y tiene una modulación muy leve (0.15) de baja frecuencia que aporta
  // "masa" visual — como si el péndulo tuviera peso físico real.
  industrial_pendulum: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * (Math.PI * 0.5)  // offset entre fixtures
    const localPhase = (phase + fixtureOffset) % (Math.PI * 2)
    // Amortiguamiento: empieza en amplitud máxima, decae a ~14% al final del ciclo
    const decay = Math.exp(-localPhase / Math.PI)
    // Pan: oscilación ancha amortiguada (como un péndulo de Foucault pesado)
    outPos.x = Math.sin(localPhase * 2) * decay * 0.95
    // Tilt: modulación de baja frecuencia — el peso del péndulo tira hacia abajo
    outPos.y = -Math.abs(Math.sin(localPhase)) * 0.35 * decay + Math.cos(localPhase * 0.5) * 0.12
  },

  // DARKSPIN: órbita elíptica con pulso de radio y contra-rotación vertical.
  // Diseñado para conservar identidad "oscura" sin entrar en jitter ni picos.
  darkspin: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * (Math.PI / 2)
    const radiusPulse = 0.70 + 0.20 * Math.sin(phase * 0.5)
    outPos.x = Math.sin(phase + fixtureOffset) * radiusPulse
    outPos.y = Math.cos((phase + fixtureOffset) * 1.5) * 0.62
  },
  
  // LATINO PATTERNS - Fluid / Hips / Curvas Sensuales
  
  // FIGURE8: Lemniscata de Bernoulli — caderas de cumbia reales
  // 🌊 WAVE 6030.5: Reemplaza Lissajous 1:2 por lemniscata paramétrica.
  // x = sin(t) / (1+sin²(t))  →  pan barre ±1 con cintura pinched
  // y = sin(t)·cos(t) / (1+sin²(t)) * 1.4  →  tilt con cruce suave en centro
  // A diferencia del Lissajous, la tangente en el cruce es HORIZONTAL:
  // el fixture pasa por el centro rozando, no clavando una aguja vertical.
  figure8: (phase, audio, outPos) => {
    const sinT = Math.sin(phase)
    const cosT = Math.cos(phase)
    const denom = 1 + sinT * sinT
    outPos.x = cosT / denom
    outPos.y = (sinT * cosT / denom) * 1.6
  },
  
  // WAVE_Y: Auténtico barrido en forma de "U" (cruzando la pista elegantemente)
  wave_y: (phase, audio, outPos) => {
    outPos.x = Math.sin(phase) * 0.85
    outPos.y = Math.sin(phase * 2) * 0.70 // Doble frecuencia en Y crea la curva
  },
  
  // BALLYHOO: Trefoil knot — nudo trifolio con asimetría visual propia
  // 🌊 WAVE 6030.1: Reemplaza el Lissajous genérico por un nudo trifolio proyectado.
  // El nudo trifolio tiene 3 lóbulos: el fixture traza un lóbulo grande (arriba)
  // y dos lóbulos pequeños (abajo-izq, abajo-der), creando una figura ASIMÉTRICA
  // inconfundible que no se parece ni al circle ni al figure8.
  // x = sin(t) · (0.8 + 0.2·cos(3t))  →  pan con "rebote" cada 3er armónico
  // y = sin(2t)·0.5 + cos(t)·0.25    →  tilt asimétrico: lóbulo superior dominante
  ballyhoo: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * (Math.PI * 0.4)
    const t = phase + fixtureOffset
    outPos.x = Math.sin(t) * (0.8 + 0.2 * Math.cos(t * 3))
    outPos.y = Math.sin(t * 2) * 0.50 + Math.cos(t) * 0.28
  },

  // ─────────────────────────────────────────────────────────────────────
  // 🌊 WAVE 4703: NUEVOS PATRONES LATINOS — La Expansión del Alma
  // ─────────────────────────────────────────────────────────────────────

  // CADERA_LIBRE: Swing asimétrico — la cadera que empuja más a la derecha
  // 🌊 WAVE 6030.3: Reemplaza el coseno simétrico por un "swing" latino real.
  // Swing: sin(t) + 0.38·sin(t)·|sin(t)|  →  onda sesgada, más tiempo en +x que en -x.
  //   (|sin| convierte la sinusoide en una onda tipo "diente de ballena" suavizado)
  // Drift: 0.40 rad (23°) — perceptible, el 8 se tuerce visiblemente de ciclo a ciclo.
  // Tilt: término cuadrático sin²(t)·0.30 eleva la posición media → el foco
  //   apunta levemente hacia arriba en los picos y cae en los valles (contoneo vertical).
  cadera_libre: (phase, audio, outPos, index = 0, total = 1) => {
    const drift = Math.sin(phase * 0.25) * 0.40
    const swing = Math.sin(phase) + 0.38 * Math.sin(phase) * Math.abs(Math.sin(phase))
    outPos.x = swing * 0.82
    outPos.y = Math.cos(phase * 2 + drift) * 0.62 + Math.pow(Math.sin(phase), 2) * 0.28
  },

  // ESPIRAL_CONGA: Espiral logarítmica respirante + acento de bombo
  // 🌊 WAVE 6030.4: Espiral que CRECE y DECRECE monótonamente dentro de cada vuelta,
  // como una concha de nautilus que se abre y cierra.
  // Radio: 0.40 + 0.55·|sin(phase·0.5)|  →  crece de 0.40 a 0.95 y vuelve (suave, sin sierra).
  // Acento de conga: Math.max(0, sin(2·localPhase))·0.35  →  pulsa 2 veces por vuelta,
  //   SOLO en la semiciclo positiva (rectificado) = golpe de bombo, no ruido simétrico.
  // El offset π/3 entre fixtures crea una ola escalonada en el ensemble.
  espiral_conga: (phase, audio, outPos, index = 0, total = 1) => {
    const fixturePhase = phase + (index / Math.max(total, 1)) * (Math.PI / 3)
    // Espiral respirante: radio 0.40→0.95→0.40 por vuelta (sin sierra, solo seno abs)
    const r = 0.40 + 0.55 * Math.abs(Math.sin(phase * 0.5))
    // Acento rectificado: golpe de conga 2 veces por ciclo, asimétrico (solo cresta positiva)
    const congaAccent = Math.max(0, Math.sin(fixturePhase * 2)) * 0.35
    outPos.x = Math.cos(fixturePhase) * r
    outPos.y = Math.sin(fixturePhase) * 0.55 + congaAccent
  },
  
  // POP-ROCK PATTERNS - Stadium / Symmetry / Majestuosidad
  
  // CIRCLE_BIG: El rey de los estadios
  circle_big: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI * 2
    outPos.x = Math.sin(phase + fixtureOffset)
    outPos.y = Math.cos(phase + fixtureOffset) * 0.75
  },
  
  // CANCAN: Piernas de bailarina (X fijo, Y arriba/abajo)
  cancan: (phase, audio, outPos, index = 0, total = 1) => {
    const fixtureOffset = (index / Math.max(total, 1)) * Math.PI
    outPos.x = Math.sin(phase * 0.25) * 0.15
    outPos.y = Math.sin(phase + fixtureOffset)
  },
  
  // DUAL_SWEEP: Barrido en U majestuoso
  dual_sweep: (phase, audio, outPos) => {
    const x = Math.sin(phase)
    outPos.x = x
    outPos.y = (x * x) - 0.3
  },
  
  // CHILL PATTERNS - Organic / Ambient / Respiracion
  
  // DRIFT: Movimiento browniano lento
  drift: (phase, audio, outPos) => {
    const phi = 1.618033988749
    const sqrt2 = Math.SQRT2
    const sqrt3 = Math.sqrt(3)
    outPos.x = Math.sin(phase * phi) * 0.4 + 
               Math.sin(phase * sqrt2) * 0.25 + 
               Math.sin(phase * sqrt3) * 0.15
    outPos.y = Math.cos(phase * phi * 0.7) * 0.35 + 
               Math.cos(phase * sqrt2 * 0.8) * 0.2 + 
               Math.cos(phase * sqrt3 * 0.9) * 0.12
  },
  
  // SWAY: Pendulo muy suave (solo X)
  sway: (phase, audio, outPos) => {
    outPos.x = Math.sin(phase) * 0.6
    outPos.y = 0
  },
  
  // BREATH: La luz respira (solo Y sutil)
  breath: (phase, audio, outPos) => {
    outPos.x = 0
    outPos.y = Math.sin(phase) * 0.35
  },

  // ═══════════════════════════════════════════════════
  // 🎭 WAVE 2086.5: THE FOUR NOBLES
  // ═══════════════════════════════════════════════════

  // SLOW_PAN: El faro del fondo — barrido horizontal puro, 32 beats
  slow_pan: (phase, _audio, outPos) => {
    // Sin(phase) puro: el moving head barre 180° en 8 compases
    // Sin componente Y — movimiento hipnótico lateral
    outPos.x = Math.sin(phase)
    outPos.y = 0
  },

  // TILT_NOD: Cabeceo meditativo — solo vertical, 16 beats
  tilt_nod: (phase, _audio, outPos) => {
    // Amplitud 0.6 para no ser agresivo — es un asentimiento, no un headbang
    outPos.x = 0
    outPos.y = Math.sin(phase) * 0.6
  },

  // FIGURE_OF_4: Figure8 contenido — mismo espíritu, menos territorio
  figure_of_4: (phase, _audio, outPos) => {
    // x = sin(phase) * 0.5: la mitad del recorrido horizontal
    // y = sin(2*phase) * 0.3: doble frecuencia vertical, amplitud contenida
    // El resultado es un 8 compacto que ocupa el centro del escenario
    outPos.x = Math.sin(phase) * 0.5
    outPos.y = Math.sin(2 * phase) * 0.3
  },

  // CHASE_POSITION: 4 posiciones cardinales con interpolación lineal
  // 🔧 WAVE 2088.7: THE PHYSICS UNCHAINING — Target lineal puro.
  chase_position: (phase, _audio, outPos) => {
    const totalSteps = 4
    const normalizedPhase = (phase / (2 * Math.PI)) * totalSteps
    const currentStep = Math.floor(normalizedPhase) % totalSteps
    const nextStep = (currentStep + 1) % totalSteps
    const t = normalizedPhase - Math.floor(normalizedPhase)
    
    const from = _CHASE_POSITIONS[currentStep]
    const to = _CHASE_POSITIONS[nextStep]
    outPos.x = from.x + (to.x - from.x) * t
    outPos.y = from.y + (to.y - from.y) * t
  },
}

// VIBE MOVEMENT MANAGER - THE CHOREOGRAPHER

export class VibeMovementManager {
  private time: number = 0
  private lastUpdate: number = Date.now()
  private frameCount: number = 0
  // 🛠️ WAVE 5032: mutable caches for object pooling in pattern generation
  private _tempRawPos = { x: 0, y: 0 }
  private _tempFromRawPos = { x: 0, y: 0 }
  private _tempPos = { x: 0, y: 0 }
  private _tempFromPos = { x: 0, y: 0 }
  private _tempFinalPos = { x: 0, y: 0 }
  private _tempIntent: MovementIntent = { x: 0, y: 0, pattern: '', speed: 0, amplitude: 0 }
  // ─────────────────────────────────────────────────────────────────────
  // Reemplaza phaseAccumulator+barCount+lastBeatCount como fuente de verdad.
  // schedulerState.phase avanza a (2π/cycleBeats)*beatsThisFrame (velocidad pura).
  // schedulerState.sceneBeatsElapsed avanza el mismo ΔBeats independientemente.
  // Cuando sceneBeatsElapsed >= phraseDuration + hardDeadlineExtra el
  // scheduler rota al siguiente patrón (implementación completa en ASALTO 2;
  // aquí ya se acumula correctamente la información temporal).
  // ═══════════════════════════════════════════════════════════════════════
  private schedulerState: SchedulerState = {
    patternIndex: 0,
    phase: 0,
    sceneBeatsElapsed: 0,
  }
  // Último vibeId procesado — detecta cambios de vibe para resetear el scheduler
  private lastVibeId: string | null = null

  private smoothedBPM: number = 120
  private readonly BPM_SMOOTH_FACTOR = 0.05  // Very slow BPM tracking (20 frames to converge)
  
  // 🎚️ WAVE 2472: GRANDMASTER SPEED — multiplicador global de la IA
  // Escala el flujo de fase del motor generativo (0.1 = cámara lenta, 2.0 = doble velocidad)
  // NO afecta patrones manuales (Layer 2 del Arbiter) — solo Layer 0 (CHOREO)
  // 🏛️ WAVE 4730 TRÍADA: 0.6 → 0.8. Con períodos duplicados, 0.6 sería
  //   demasiado lento. A 0.8× con nuevos períodos:
  //   circle_big (32b) @ 120 BPM: 1 ciclo cada 20 s (majestuoso)
  //   scan_x (16b) @ 130 BPM:     1 ciclo cada 9 s  (catedral industrial)
  //   drift (256b) @ 100 BPM:     1 ciclo cada ~192 s (glacial)
  private globalSpeedMultiplier: number = 1.0

  // 🌪️ WAVE 4708 T3: CAOS UNIFICADO — amplitud y semilla globales del slider
  // ChaosOrderSlider, leídos por el KineticAdapter (L0) para calcular un
  // desfase determinista por nodo. Permite que el caos afecte a la IA igual
  // que ya afecta al patrón manual L2 (vía _flushClassic).
  globalChaosAmount: number = 0
  globalChaosSeed: number = 0
  
  // Manual override system (WAVE 999 compatible)
  private manualSpeedOverride: number | null = null
  private manualAmplitudeOverride: number | null = null
  private manualPatternOverride: string | null = null

  /**
   * L2 ACTIVE FLAG — silences VMM (L0) without clearing manual overrides.
   * When true, generateIntent returns a no-op intent so the L2 kinetic engine
   * has absolute supremacy. Unlike setManualPattern(null), this does NOT
   * reset manualPatternOverride/Speed/Amplitude, preventing ProgrammerAetherBridge
   * from detecting "overrides cleared" and reactively firing clearManualOverrides
   * on the arbiter (which would wipe the L2 anchor pan_base/tilt_base).
   */
  private _l2Active = false
  
  // WAVE 1155.1: SMOOTH TRANSITION SYSTEM
  // Cuando el patron cambia, hacemos LERP de 2 segundos
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 }
  // ═══════════════════════════════════════════════════════════════════════
  // WAVE 4741 ASALTO 2: KINETIC CROSSFADE — Interpolación beat-sincronizada
  // Reemplaza TRANSITION_DURATION_MS + transitionStartTime + isTransitioning.
  // fromPattern continúa avanzando su fase durante el crossfade (movimiento vivo).
  // totalBeats proviene de patternCfg.transitionBeats del patrón SALIENTE.
  // ═══════════════════════════════════════════════════════════════════════
  private kineticTransition: {
    active: boolean
    fromPattern: GoldenPattern
    fromPhaseSnapshot: number  // schedulerState.phase en el momento del disparo
    progressBeats: number      // beats acumulados desde el inicio del crossfade
    totalBeats: number         // duración del crossfade = patternCfg.transitionBeats
  } = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 }
  
  // 🎚️ WAVE 2472: GRANDMASTER SPEED API
  
  setGlobalSpeedMultiplier(mult: number): void {
    this.globalSpeedMultiplier = Math.max(0.1, Math.min(2.0, mult))
    console.log(`[CHOREO] 🎚️ GrandMaster Speed: ×${this.globalSpeedMultiplier.toFixed(2)}`)
  }
  
  getGlobalSpeedMultiplier(): number {
    return this.globalSpeedMultiplier
  }

  // 🌪️ WAVE 4708 T3: CAOS UNIFICADO API
  /**
   * Establece la amplitud (0-1) y semilla (uint16) del caos global.
   * Llamado desde AetherIPCHandlers cuando el operador mueve ChaosOrderSlider.
   * El KineticAdapter lo aplica por nodo como desfase de fase determinista.
   */
  setGlobalChaos(amount: number, seed: number): void {
    this.globalChaosAmount = amount < 0 ? 0 : amount > 1 ? 1 : amount
    this.globalChaosSeed = (seed | 0) & 0xFFFF
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
    'darkspin': 'darkspin',
    'tornado': 'darkspin',
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
      this.schedulerState.sceneBeatsElapsed = 0 // Reiniciamos el reloj de la frase
      // Forzamos al motor a arrancar la onda desde una fase = 0
      this.schedulerState.phase = 0
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

  // ─── WAVE 4717.2: L2 PHASE OFFSETS (Fan Distribute) ──────────────────────
  // Record pre-allocado, mutado in-place en el hot-path — cero alloc @ 44Hz.
  // Key: nodeId (`${fixtureId}:kinetic`). Value: phase offset en radianes.
  // El KineticAdapter lee este record en process() antes de llamar a generateIntent().
  // El bridge (renderer-side) lo actualiza vía IPC cada vez que cambia fanValue.
  readonly _l2PhaseOverrides: Record<string, number> = {}

  /**
   * Actualiza los offsets de fase L2 para el fan distribute.
   * Limpia keys obsoletas e inserta las nuevas — sin crear el objeto Record.
   * @param offsets map de nodeId → phase offset (rad)
   */
  setKineticFanOffsets(offsets: Record<string, number>): void {
    // Limpiar keys que ya no están en el nuevo batch
    for (const key in this._l2PhaseOverrides) {
      if (!(key in offsets)) {
        delete this._l2PhaseOverrides[key]
      }
    }
    // Escribir valores nuevos in-place
    for (const key in offsets) {
      this._l2PhaseOverrides[key] = offsets[key]
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  clearManualOverrides(): void {
    this.manualSpeedOverride = null
    this.manualAmplitudeOverride = null
    this.manualPatternOverride = null
    this._l2Active = false
    // Limpiar también los L2 phase offsets
    for (const key in this._l2PhaseOverrides) {
      delete this._l2PhaseOverrides[key]
    }
    console.log(`[CHOREO] All overrides cleared`)
  }

  setL2Active(active: boolean): void {
    this._l2Active = active
    console.log(`[CHOREO] L2 engine ${active ? 'ACTIVATED — VMM silenced' : 'DEACTIVATED — VMM resumes'}`)
  }

  isL2Active(): boolean {
    return this._l2Active
  }

  // GENERATE INTENT - El corazon del coreografo
  
  generateIntent(
    vibeId: string, 
    audio: AudioContext,
    fixtureIndex: number = 0,
    totalFixtures: number = 1,
    /** 🏎️ WAVE 2074.3: Per-fixture max speed (DMX/s). Defaults to 250 if not provided. */
    fixtureMaxSpeed: number = 250,
    /** 🎭 WAVE 4645: Phase offset (rad) for left/right asymmetry */
    phaseOffset: number = 0,
    /** WAVE 4931: Mount orientation for audience-facing bias */
    mountOrientation?: string
  ): MovementIntent {
    // L2 ACTIVE: VMM silenced — L2 kinetic engine has absolute supremacy.
    // Return no-op intent. Unlike manualPatternOverride=null, this does NOT
    // clear overrides, preventing the bridge from reactively clearing L2 anchors.
    if (this._l2Active) {
      const intent = this._tempIntent
      intent.x = 0.5
      intent.y = 0.5
      intent.pattern = 'breath'
      intent.speed = 0
      intent.amplitude = 0
      intent._frequency = 0
      intent._phrase = 0
      return intent
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.1: FRAME-ONCE GUARD
    // TitanEngine now calls generateIntent() TWICE per frame (L + R stereo).
    // Internal state (time, frameCount, barCount, pattern selection) must
    // only update ONCE per frame. We use lastFrameTimestamp to detect
    // same-frame calls: if Date.now() === lastUpdate, skip state updates.
    // ═══════════════════════════════════════════════════════════════════════
    const now = Date.now()
    // 🌊 WAVE 4703 M1 JITTER FIX: threshold 2ms→1ms.
    // Date.now() has 1ms resolution. At 60fps, dt≈16ms so two consecutive real
    // frames are ≥16ms apart. <1ms reliably means same-frame second call (R fixture).
    // <2ms was causing some real frames (dt=1ms on high-res clocks) to be skipped.
    const isSameFrame = (now - this.lastUpdate) < 1  // <1ms = same render frame
    
    // 🔥 WAVE 2088.10: Capture dt BEFORE updating lastUpdate
    let frameDeltaTime = 0.016  // default 60fps
    
    if (!isSameFrame) {
      // First call this frame: update all internal state
      frameDeltaTime = Math.min((now - this.lastUpdate) / 1000, 0.1)  // Cap at 100ms
      this.lastUpdate = now
      this.time += frameDeltaTime
      this.frameCount++
    }
    // Second call (R fixture): reuse same time/frameCount from first call

    // Obtener configuracion del vibe
    const config = VIBE_CONFIG[vibeId] || VIBE_CONFIG['idle']

    const beatCount = audio.beatCount ?? 0
    const beatPhase = audio.beatPhase ?? 0

    // ═══════════════════════════════════════════════════════════════════
    // WAVE 4741: TICK DESACOPLADO — Paso A + B (Blueprint §5)
    //
    // Paso A: BPM suavizado + beatsThisFrame
    // Paso B: Avance de fase a ritmo de cycleBeats (velocidad pura)
    //         + avance de sceneBeatsElapsed independiente (duración escena)
    // Paso C (Paso D del Blueprint): Safe-harbor check y scheduler
    //         → implementación completa en ASALTO 2 (se conecta aquí)
    //
    // El viejo PATTERN_PERIOD se conserva como fallback para el Gearbox
    // hasta que ASALTO 2 lo reemplace con patternConfig.cycleBeats.
    // ═══════════════════════════════════════════════════════════════════
    const safeBPM = this.getSafeBPM(audio.bpm)

    // Reset scheduler si cambió el vibe (nuevo set de patrones)
    if (!isSameFrame && this.lastVibeId !== null && this.lastVibeId !== vibeId) {
      this.schedulerState.patternIndex = 0
      this.schedulerState.phase = 0
      this.schedulerState.sceneBeatsElapsed = 0
      this.kineticTransition = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 }
      console.log(`[CHOREO4741] Vibe changed ${this.lastVibeId} → ${vibeId}: scheduler + crossfade reset`)
    }
    if (!isSameFrame) {
      this.lastVibeId = vibeId
    }

    // Smooth BPM con filtro paso-bajo pesado (solo en la primera llamada del frame)
    if (!isSameFrame) {
      this.smoothedBPM += (safeBPM - this.smoothedBPM) * this.BPM_SMOOTH_FACTOR
    }

    // ── Lookup patrón ACTUAL (previo a la posible rotación de este frame) ────────────
    // Se consulta ANTES del bloque de fase para que el safe-harbor sepa desde
    // qué patrón se está saliendo y pueda disparar el crossfade cinético.
    const currentPatternName = this.selectPattern(config, audio)
    const currentPatternCfg = PATTERN_CONFIG[currentPatternName as GoldenPattern]
    const currentCycleBeats = currentPatternCfg
      ? currentPatternCfg.cycleBeats
      : (PATTERN_PERIOD[currentPatternName as GoldenPattern] || 8)

    if (!isSameFrame) {
      const beatsPerSecond = this.smoothedBPM / 60
      const beatsThisFrame = beatsPerSecond * frameDeltaTime
      const chillSedationFactor = vibeId === 'chill-lounge' ? 0.80 : 1.0
      const manualSpeedFactor = this.manualSpeedOverride !== null
        ? Math.pow(2, (this.manualSpeedOverride - 50) / 50)
        : 1.0
      const effectiveBeats = beatsThisFrame * this.globalSpeedMultiplier * manualSpeedFactor * chillSedationFactor

      // ── PASO A: avanzar fase a ritmo de cycleBeats (velocidad pura) ──────────────
      const phasePerBeat = (2 * Math.PI) / currentCycleBeats
      this.schedulerState.phase += effectiveBeats * phasePerBeat

      // ── PASO B: avanzar contador de escena (independiente de cycleBeats) ─────────
      // sceneBeatsElapsed mide el tiempo en escena del patrón actual.
      // Es TOTALMENTE independiente de la velocidad del ciclo.
      this.schedulerState.sceneBeatsElapsed += effectiveBeats

      // ── PASO C: SAFE-HARBOR — Rotación de patrón beat-sincronizada ───────────────
      // Espera a que sceneBeatsElapsed supere phraseDuration Y la fase esté
      // próxima a safeHarborPhase (fixture cerca del centro) para rotar.
      // Si se excede hardDeadline, fuerza la rotación igualmente.
      if (currentPatternCfg && this.manualPatternOverride === null && config.patterns.length > 1) {
        if (this.schedulerState.sceneBeatsElapsed >= currentPatternCfg.phraseDuration) {
          const TWO_PI = 2 * Math.PI
          const normalizedPhase = ((this.schedulerState.phase % TWO_PI) + TWO_PI) % TWO_PI
          const distFromHarbor = Math.abs(normalizedPhase - currentPatternCfg.safeHarborPhase)
          const inHarbor = distFromHarbor < currentPatternCfg.safeHarborWindow
          const hardDeadline = this.schedulerState.sceneBeatsElapsed >=
            currentPatternCfg.phraseDuration + currentPatternCfg.hardDeadlineExtra
          if (inHarbor || hardDeadline) {
            const oldIndex = this.schedulerState.patternIndex
            this.schedulerState.patternIndex = (oldIndex + 1) % config.patterns.length
            this.schedulerState.sceneBeatsElapsed = 0
            // ── Disparar crossfade cinético ────────────────────────────────────────
            this.kineticTransition = {
              active: true,
              fromPattern: currentPatternName as GoldenPattern,
              fromPhaseSnapshot: this.schedulerState.phase,
              progressBeats: 0,
              totalBeats: currentPatternCfg.transitionBeats,
            }
            const newPattern = config.patterns[this.schedulerState.patternIndex]
            console.log(
              `[SCHED] 🌊 ${currentPatternName} → ${newPattern}` +
              ` | harbor:${inHarbor} deadline:${hardDeadline}` +
              ` | phase:${Math.round(normalizedPhase * 180 / Math.PI)}°`
            )
          }
        }
      }

      // ── Avanzar crossfade en curso ────────────────────────────────────────────────
      if (this.kineticTransition.active) {
        this.kineticTransition.progressBeats += effectiveBeats
        if (this.kineticTransition.progressBeats >= this.kineticTransition.totalBeats) {
          this.kineticTransition.active = false
          const finishedPattern = config.patterns[this.schedulerState.patternIndex]
          console.log(`[SCHED] ✅ Crossfade complete → ${finishedPattern}`)
        }
      }
    }

    // ── patternName post-rotación: refleja el índice actualizado en este frame ───────
    const patternName = this.selectPattern(config, audio)
    const patternCfg = PATTERN_CONFIG[patternName as GoldenPattern]
    const patternPeriod = patternCfg ? patternCfg.cycleBeats : (PATTERN_PERIOD[patternName as GoldenPattern] || 8)

    // 🥶 WAVE 1165: GHOST PROTOCOL — FREEZE instead of HOME on silence
    // When energy is very low, MAINTAIN last position instead of going to center
    if (audio.energy < 0.03 && config.homeOnSilence) {
      return this.createFreezeIntent(patternName)
    }

    // 🐍 WAVE 6020.11: SNAKE AS PHASE OFFSET (not 2D rotation)
    // The old 2D rotation of the position vector distorted non-circular patterns
    // (figure8, ballyhoo) and pushed y outside the safe tilt range, causing
    // clamp artifacts (jumping/freezing). Applying the snake offset as a phase
    // shift BEFORE the pattern function preserves the pattern shape and keeps
    // the output naturally within the safe range.
    const stereoConfig = STEREO_CONFIG[vibeId] || STEREO_CONFIG['idle']
    const snakePhaseOffset = stereoConfig.type === 'snake' && totalFixtures > 1
      ? fixtureIndex * stereoConfig.offset
      : 0

    const phase = this.schedulerState.phase + phaseOffset + snakePhaseOffset

    // PATTERN EXECUTION
    const patternFn = PATTERNS[patternName as GoldenPattern]
    if (!patternFn) {
      console.warn(`[CHOREO] Unknown pattern: ${patternName}, using breath`)
      return this.createHomeIntent('breath')
    }
    
    patternFn(phase, audio, this._tempRawPos, fixtureIndex, totalFixtures)
    const rawPosition = this._tempRawPos
    
    // THE GEARBOX - Dynamic Amplitude Scaling
    // 🔥 WAVE 2088.10: Use smoothedBPM for stable gearbox calculations
    const effectivePanAmplitude = this.calculateEffectiveAmplitude(
      config.panScale,
      this.smoothedBPM,
      patternPeriod,
      audio.energy,
      fixtureMaxSpeed
    )
    const effectiveTiltAmplitude = this.calculateEffectiveAmplitude(
      config.tiltScale,
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
    
    const finalPanAmplitude = effectivePanAmplitude * clampedEnvelope
    const finalTiltAmplitude = effectiveTiltAmplitude * clampedEnvelope
    
    // Aplicar amplitud (con phrase envelope de WAVE 2086.3)
    // WAVE 2224: DANCEFLOOR GRAVITY — techno-club apunta a la pista (adelante/abajo)
    // 🔧 WAVE 2233: -0.35 → -0.20. Con tiltScale 0.70, -0.20 points toward dancefloor.
    // WAVE 4932.2: Para ceiling/truss, el NodeResolver invierte el eje tilt en DMX
    // via (255 - dmxValue). Esta inversión afecta TODA la señal incluyendo el tiltOffset.
    // Por tanto ceiling necesita el MISMO offset negativo que floor: el offset negativo
    // centra la onda hacia el público (y<0), y tras la inversión del resolver eso se
    // convierte en DMX alto = físicamente apunta al suelo (audiencia). Correcto.
    // El clamp para ceiling es Math.min(y, -TILT_CEILING): asegura que el lado positivo
    // nunca llega al resolver (lo que tras la inversión sería apuntar al techo).
    //
    // WAVE 6019.4 FIX — CEILING MOUNT FALLBACK:
    // node.ikOrientation puede llegar undefined si NodeExtractionPipeline no
    // hidrató el campo (regresión Aether Glass). Normalizamos a lowercase y
    // tratamos undefined como floor (el caller debe garantizar ikOrientation).
    // Sin esta normalización, 'CEILING' != 'ceiling' y el VMM aplica offset
    // de floor que el NodeResolver luego invierte → haz al techo.
    const effectiveMount = (mountOrientation ?? 'floor').toLowerCase().trim()
    const isCeilingMount = effectiveMount === 'ceiling'
      || effectiveMount === 'truss-front'
      || effectiveMount === 'truss-back'
    const tiltOffset = isCeilingMount
      ? TILT_OFFSET_CEILING
      : effectiveMount === 'totem'
        ? -0.45
        : (TILT_OFFSET_BY_VIBE[vibeId] ?? 0)
    const position = this._tempPos
    position.x = Math.max(-1, Math.min(1, rawPosition.x * finalPanAmplitude))
    position.y = Math.max(-1, Math.min(1, (rawPosition.y * finalTiltAmplitude) + tiltOffset))
    if (isCeilingMount) {
      // WAVE 4932.5: clamp bilateral. Limitar tanto cresta (upper) como valle (lower)
      // dentro de la semiesfera inferior segura.
      if (position.y > -TILT_CEILING) position.y = -TILT_CEILING
      else if (position.y < -TILT_FLOOR_LIMIT) position.y = -TILT_FLOOR_LIMIT
    } else {
      position.y = Math.min(position.y, TILT_CEILING)
    }
    // WAVE 6020.9 SURVIVAL LOG: Confirm VMM ceiling decision and clamped output
    // 🩸 WAVE 6040: Silenciado — logs de supervivencia ya no necesarios en producción
    // if (Math.random() < 0.001) {
    //   console.log(`[WAVE-6020.9-SURVIVAL] VMM: mount=${effectiveMount} isCeiling=${isCeilingMount} tiltOffset=${tiltOffset.toFixed(3)} rawY=${rawPosition.y.toFixed(3)} outY=${position.y.toFixed(3)}`)
    // }
    
    // WAVE 4741 ASALTO 2: KINETIC CROSSFADE
    // Guard defensivo: si el fromPattern ya no existe en este vibe (edge case de cambio
    // de vibe rápido), matar el crossfade antes de calcular nada.
    if (this.kineticTransition.active) {
      const fromInVibe = config.patterns.includes(this.kineticTransition.fromPattern)
      if (!fromInVibe) {
        console.warn(
          `[SCHED] ⚠️ Crossfade killed — fromPattern '${this.kineticTransition.fromPattern}'` +
          ` not in ${vibeId} playlist. Race condition on vibe change?`
        )
        this.kineticTransition.active = false
      }
    }

    // Si hay un crossfade activo, calcula la posición del patrón SALIENTE en tiempo
    // real (continúa avanzando su fase) y hace un LERP hasta la del ENTRANTE.
    let finalPosition = position
    let crossfadeSmoothT = 0  // 0 = 100% saliente, 1 = 100% entrante
    if (this.kineticTransition.active) {
      const fromCfg = PATTERN_CONFIG[this.kineticTransition.fromPattern]
        ?? PATTERN_CONFIG['breath' as GoldenPattern]
      const fromPhasePerBeat = (2 * Math.PI) / fromCfg.cycleBeats
      // Fase del patrón saliente: snapshot + beats acumulados × velocidad de su ciclo
      const fromPhase = this.kineticTransition.fromPhaseSnapshot +
        this.kineticTransition.progressBeats * fromPhasePerBeat + phaseOffset + snakePhaseOffset
      const fromPatternFn = PATTERNS[this.kineticTransition.fromPattern]
      if (fromPatternFn) {
        // Usar object pooling para crossfade
        fromPatternFn(fromPhase, audio, this._tempFromRawPos, fixtureIndex, totalFixtures)
        const fromRaw = this._tempFromRawPos
        const fromPosition = this._tempFromPos
        fromPosition.x = Math.max(-1, Math.min(1, fromRaw.x * finalPanAmplitude))
        fromPosition.y = Math.max(-1, Math.min(1, (fromRaw.y * finalTiltAmplitude) + tiltOffset))
        if (isCeilingMount) {
          if (fromPosition.y > -TILT_CEILING) fromPosition.y = -TILT_CEILING
          else if (fromPosition.y < -TILT_FLOOR_LIMIT) fromPosition.y = -TILT_FLOOR_LIMIT
        } else {
          fromPosition.y = Math.min(fromPosition.y, TILT_CEILING)
        }
        // Smoothstep ease-in-out: t² × (3 − 2t)
        const t = Math.min(1.0, this.kineticTransition.progressBeats / this.kineticTransition.totalBeats)
        crossfadeSmoothT = t * t * (3 - 2 * t)
        finalPosition = this._tempFinalPos
        finalPosition.x = fromPosition.x + (position.x - fromPosition.x) * crossfadeSmoothT
        finalPosition.y = fromPosition.y + (position.y - fromPosition.y) * crossfadeSmoothT
        if (isCeilingMount) {
          if (finalPosition.y > -TILT_CEILING) finalPosition.y = -TILT_CEILING
          else if (finalPosition.y < -TILT_FLOOR_LIMIT) finalPosition.y = -TILT_FLOOR_LIMIT
        } else {
          finalPosition.y = Math.min(finalPosition.y, TILT_CEILING)
        }
      }
    }

    // 🎭 WAVE 2086.1: Save lastPosition ONE per frame (para GHOST PROTOCOL)
    if (!isSameFrame) {
      this.lastPosition.x = finalPosition.x
      this.lastPosition.y = finalPosition.y
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎭 WAVE 2086.1: STEREO PHASE OFFSET — The Resurrection
    //
    // WAVE 6020.11: SNAKE is now applied as a PHASE OFFSET before the pattern
    // function (see snakePhaseOffset above), NOT as a 2D rotation of the
    // position vector. This preserves the pattern shape and keeps the output
    // within the safe tilt range without clamping artifacts.
    //
    // MIRROR (techno): Handled by lrPhaseOffset in KineticAdapter (π for right side)
    // SNAKE (latino/pop/chill): Handled by snakePhaseOffset above (phase shift)
    // SYNC (idle): Sin cambio
    // ═══════════════════════════════════════════════════════════════════════
    const stereoPosition = this._tempFinalPos
    stereoPosition.x = finalPosition.x
    stereoPosition.y = finalPosition.y
    
    // Clampar al rango válido (stereoPosition = finalPosition, ya clamped arriba)
    stereoPosition.x = Math.max(-1, Math.min(1, stereoPosition.x))
    stereoPosition.y = Math.max(-1, Math.min(1, stereoPosition.y))
    
    // Frecuencia efectiva (con override manual)
    const effectiveFrequency = this.manualSpeedOverride !== null
      ? 0.01 + (this.manualSpeedOverride / 100) * 0.49
      : config.baseFrequency
    
    // Debug log cada ~1 segundo — solo en la primera llamada real del frame.
    // Aether puede pedir múltiples intents en el mismo frame (uno por nodo),
    // así que `fixtureIndex === 0` no basta para evitar spam.
    if (!isSameFrame && this.frameCount % 60 === 0 && fixtureIndex === 0) {
      const panDeg = Math.round(stereoPosition.x * 270)
      const tiltDeg = Math.round(stereoPosition.y * 135)
      const manualTag = this.hasAnyOverride() ? ' [MANUAL]' : ''
      const xfadeTag = this.kineticTransition.active
        ? ` [XF→${config.patterns[this.schedulerState.patternIndex] ?? '?'}]`
        : ''
      const stereoTag = stereoConfig.type !== 'sync' ? ` [${stereoConfig.type.toUpperCase()} ×${totalFixtures}]` : ''
      const phaseDeg = Math.round((this.schedulerState.phase % (2 * Math.PI)) * 180 / Math.PI)
      const sceneB = Math.round(this.schedulerState.sceneBeatsElapsed)
      console.log(
        `[CHOREO] ${vibeId} | #${this.schedulerState.patternIndex}:${patternName}${manualTag}${xfadeTag}${stereoTag}` +
        ` | scene:${sceneB}b | Pan:${panDeg} Tilt:${tiltDeg} | sBPM:${Math.round(this.smoothedBPM)} phase:${phaseDeg}°`
      )
    }
    
    // Determinar phaseType
    // 🔧 WAVE 2086.1: phaseType is now informational only (stereo already applied)
    // We keep it for downstream compatibility but HAL no longer uses it for phase offset
    const phaseType: 'linear' | 'polar' = 
      (patternName === 'scan_x' || patternName === 'cancan') ? 'linear' : 'polar'
    
    // UI SYNC: reportar el patrón que DOMINA visualmente.
    // Durante crossfade, el saliente domina hasta que smoothT >= 0.5.
    // Fuera de crossfade, siempre es patternName.
    const reportedPattern = this.kineticTransition.active && crossfadeSmoothT < 0.5
      ? this.kineticTransition.fromPattern
      : patternName

    const intent = this._tempIntent
    intent.x = stereoPosition.x
    intent.y = stereoPosition.y
    intent.pattern = reportedPattern
    intent.speed = effectiveFrequency
    intent.amplitude = effectivePanAmplitude
    intent.phaseType = phaseType
    intent._frequency = effectiveFrequency
    intent._phrase = this.schedulerState.patternIndex
    return intent
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
    
    // WAVE 4741 ASALTO 2: índice directo desde el scheduler (rotado por safe-harbor)
    const safeIndex = this.schedulerState.patternIndex % patterns.length
    return patterns[safeIndex]
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
    const intent = this._tempIntent
    intent.x = 0
    intent.y = 0
    intent.pattern = 'home'
    intent.speed = 0
    intent.amplitude = 0
    intent._frequency = 0
    intent._phrase = this.schedulerState.patternIndex
    return intent
  }

  /**
   * 🥶 WAVE 1165: GHOST PROTOCOL - Create FREEZE intent
   * Returns LAST KNOWN POSITION instead of going home
   * This prevents the "whip to center" movement when audio stops
   */
  private createFreezeIntent(pattern: string): MovementIntent {
    const intent = this._tempIntent
    intent.x = this.lastPosition.x
    intent.y = this.lastPosition.y
    intent.pattern = 'freeze'
    intent.speed = 0
    intent.amplitude = 0
    intent._frequency = 0
    intent._phrase = this.schedulerState.patternIndex
    return intent
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
    // WAVE 4741: reset completo — scheduler + crossfade
    this.schedulerState = { patternIndex: 0, phase: 0, sceneBeatsElapsed: 0 }
    this.lastVibeId = null
    this.kineticTransition = { active: false, fromPattern: 'breath', fromPhaseSnapshot: 0, progressBeats: 0, totalBeats: 0 }
    this.lastPosition = { x: 0, y: 0 }
    this.smoothedBPM = 120
  }
  
  getTime(): number {
    return this.time
  }
  
  getBarCount(): number {
    // WAVE 4741: aprox desde sceneBeatsElapsed (mantiene compatibilidad de tests)
    return Math.floor(this.schedulerState.sceneBeatsElapsed / 4)
  }

  // WAVE 5025: Expone el nombre del patrón activo sin generar ningún intent.
  // Si hay override manual, devuelve ese; si no, el índice actual del scheduler.
  // Devuelve null si el VMM todavía no tiene vibeId cargado.
  getCurrentPatternName(): string | null {
    if (this.manualPatternOverride !== null) return this.manualPatternOverride
    if (this.lastVibeId === null) return null
    const config = VIBE_CONFIG[this.lastVibeId] || VIBE_CONFIG['idle']
    const patterns = config.patterns
    if (!patterns || patterns.length === 0) return null
    const safeIndex = this.schedulerState.patternIndex % patterns.length
    return patterns[safeIndex] ?? null
  }
}

// SINGLETON EXPORT

export const vibeMovementManager = new VibeMovementManager()
export default vibeMovementManager
