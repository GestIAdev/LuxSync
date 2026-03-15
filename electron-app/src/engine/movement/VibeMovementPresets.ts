/**
 * 🎛️ WAVE 338: VIBE MOVEMENT PRESETS
 * 
 * Define física de movimiento + óptica por vibe.
 * El FixturePhysicsDriver lee estos presets y ajusta su comportamiento.
 * 
 * FILOSOFÍA:
 * - Cada vibe tiene su "personalidad física"
 * - Techno = Rápido, seco, preciso
 * - Latino = Fluido, orgánico, bailarín
 * - Rock = Reactivo, dramático, wall of light
 * - Chill = Glacial, nebuloso, meditativo
 * 
 * 🔥 WAVE 2212: SNAP EXORCISM
 * fiesta-latina y pop-rock migrados de snap → classic.
 * Motivo: snap + targets continuos sinusoidales = staircase effect.
 * Classic + friction calibrada = curvas fluidas sin fragmentación.
 * Todos los vibes activos son ahora physicsMode: 'classic'.
 * 
 * @layer ENGINE/MOVEMENT
 * @version WAVE 2212 — The Snap Exorcism
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface MovementPhysics {
  maxAcceleration: number   // DMX units/s² (100-2000)
  maxVelocity: number       // DMX units/s (50-800)
  friction: number          // 0.0-1.0 (slew rate limit)
  arrivalThreshold: number  // DMX units (0.5-5.0)
  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ WAVE 2074.2: EXPLICIT PHYSICS MODE — THE PERSONALITY RESURRECTION
  //
  // 'snap'    → Respuesta directa con REV_LIMIT. Para vibes con movimiento
  //             activo (Techno, Latino, Rock). El mover PERSIGUE el target.
  // 'classic' → Física con inercia, aceleración y frenado. Para vibes
  //             lentos (Chill, Idle). El mover NAVEGA hacia el target.
  //
  // ANTES: El modo dependía de maxAccel > 1000, pero SAFETY_CAP (900)
  //        lo clampeaba → SNAP MODE era código muerto. NUNCA MÁS.
  // ═══════════════════════════════════════════════════════════════════════
  physicsMode: 'snap' | 'classic'
  // ═══════════════════════════════════════════════════════════════════════
  // 🏎️ WAVE 2074.3: EXPLICIT PERSONALITY DATA — THE FINAL EXORCISM
  //
  // snapFactor, REV_LIMIT solían ser branches de maxAccel (>1400, >1100...).
  // Pero SAFETY_CAP clampea maxAccel a 900 → TODOS los vibes caían al
  // mismo branch. Techno = Latino = Rock = misma personalidad. MUERTA.
  //
  // AHORA: Cada preset DECLARA su personalidad explícitamente.
  // SAFETY_CAP sigue protegiendo velocidad/aceleración brutas,
  // pero ya NO destruye la diferenciación entre vibes.
  // ═══════════════════════════════════════════════════════════════════════
  /** Factor de snap (0-1). 1.0 = instantáneo, <1 = smoothing. Solo aplica en mode 'snap'. */
  snapFactor: number
  /** Límite de velocidad pan en DMX/segundo. Protección de correas. */
  revLimitPanPerSec: number
  /** Límite de velocidad tilt en DMX/segundo. Protección de correas. */
  revLimitTiltPerSec: number
}

export interface OpticsConfig {
  zoomDefault: number       // 0-255 (0=Beam, 255=Wash)
  zoomRange: { min: number; max: number }
  focusDefault: number      // 0-255 (0=Sharp, 255=Soft)
  focusRange: { min: number; max: number }
  irisDefault?: number      // 0-255 (si existe)
}

export interface MovementBehavior {
  homeOnSilence: boolean    // ¿Volver a home en silencio?
  syncToBeat: boolean       // ¿Sincronizar con beat?
  allowRandomPos: boolean   // ¿Permitir posiciones random?
  smoothFactor: number      // 0.0-1.0 (extra smoothing)
}

export interface MovementPreset {
  physics: MovementPhysics
  optics: OpticsConfig
  behavior: MovementBehavior
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS POR VIBE
// ═══════════════════════════════════════════════════════════════════════════

export const MOVEMENT_PRESETS: Record<string, MovementPreset> = {
  
  // ───────────────────────────────────────────────────────────────
  // 🎛️ TECHNO: Velocidad máxima, Aceleración agresiva, Beam cerrado
  // "Los demonios de neón en el bunker noruego"
  // 🔧 WAVE 350.5: maxAcceleration 1500 → 2000 (safety bump para botStabs)
  // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — basada en hardware real (Sharpy ~257°/s = 121 DMX/s)
  //    ANTES: revLimitPan=3600 (7624°/s = 25× un Sharpy real), snapFactor=1.0 (sin damping)
  //    Log probaba velocidades de 7624°/s reales. Epilepsia pura.
  //    AHORA: REV_LIMIT calibrado a mover pro real. snapFactor<1.0 para damping.
  //    Referencia: Clay Paky Sharpy Pan=540°/2.1s=257°/s, Robe Robin=300°/s
  // ───────────────────────────────────────────────────────────────
  'techno-club': {
    physics: {
      maxAcceleration: 2000,    // 🔧 Arranques agresivos pero seguros (era 1500)
      maxVelocity: 600,         // Muy rápido
      // ═══════════════════════════════════════════════════════════════════
      // 🔧 WAVE 2210: PHYSICS EXORCISM — SNAP → CLASSIC
      //
      // PROBLEMA (diagnosticado WAVE 2210):
      //   snapFactor=0.85 significa: cada frame, el mover avanza 85% del
      //   delta pendiente. Con un target sinusoidal CONTINUO (phase pura,
      //   sin jitter), el mover alcanza cada micro-target en <1ms y
      //   "frena en seco" al siguiente frame → efecto escalera/robótico.
      //
      //   RAÍZ: snap mode es correcto para targets DISCRETOS (posiciones
      //   fijas que hay que alcanzar). Es incorrecto para trayectorias
      //   CONTINUAS (sin(), figure8, scan) que generan targets nuevos
      //   cada frame. Snap los persigue uno a uno → staircase.
      //
      // SOLUCIÓN: physicsMode 'classic' con inercia/fricción baja.
      //   Classic mode usa aceleración real → el mover construye velocidad
      //   y la mantiene a lo largo de la trayectoria. El resultado es
      //   FLUIDO sobre curvas continuas.
      //
      //   friction=0.08 → casi sin fricción (personalidad techno agresiva)
      //   arrivalThreshold=1.5 → no frena prematuramente en micro-deltas
      //   maxAcceleration=2000 → arranques brutales (techno)
      //   maxVelocity=600 → velocidad techo alta
      //
      //   Con estos valores, techno SIGUE siendo rápido y seco.
      //   La inercia del classic mode actúa como un low-pass hardware
      //   que suaviza la curva sin quitar personalidad.
      // ═══════════════════════════════════════════════════════════════════
      friction: 0.08,           // � WAVE 2210: Casi sin fricción → techno sigue siendo seco
      arrivalThreshold: 1.5,    // 🔥 WAVE 2210: No frena en micro-deltas (era 0.5 snap)
      physicsMode: 'classic',   // 🔥 WAVE 2210: Classic para trayectorias continuas sin staircase
      snapFactor: 0.0,          // 🔥 WAVE 2210: No aplica en classic mode (ignorado)
      revLimitPanPerSec: 400,   // Mantenido: ~848°/s — rápido pero acotado
      revLimitTiltPerSec: 280,  // Mantenido: ~297°/s — tilt siempre más lento
    },
    optics: {
      zoomDefault: 30,          // Beam cerrado (láser)
      zoomRange: { min: 0, max: 80 },
      focusDefault: 20,         // Foco nítido (corte limpio)
      focusRange: { min: 0, max: 50 },
    },
    behavior: {
      homeOnSilence: false,     // Mantener posición en breakdown
      syncToBeat: true,         // Sincronizar con kick
      allowRandomPos: false,    // Patrones predecibles
      smoothFactor: 0.1,        // Movimiento seco
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 💃 LATINO: Fluido, Circular, Orgánico
  // "La cumbia tiene swing, los movers también"
  // 🔧 WAVE 340.5: Aceleración alta para seguir caderas
  // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — figure8 suave necesita seguir curva sin lag
  //    Referencia: 750 DMX/s era ~1588°/s. Un figure8 a 120bpm con período 8 beats
  //    necesita ~50 DMX/s pico. Le damos 85 DMX/s (~180°/s) para headroom.
  // ───────────────────────────────────────────────────────────────
  'fiesta-latina': {
    physics: {
      maxAcceleration: 1500,    // � WAVE 2212: Subido para curvas fluidas a alta velocidad
      maxVelocity: 350,         // Mantenido: swing orgánico
      friction: 0.15,           // 🔥 WAVE 2212: Bajado para que las curvas fluyan sin lag
      arrivalThreshold: 1.5,    // 🔥 WAVE 2212: Balance entre seguimiento y suavidad
      physicsMode: 'classic',   // 🔥 WAVE 2212: SNAP EXORCISM — classic para sinusoidales continuas
      // ═══════════════════════════════════════════════════════════════════
      // � WAVE 2212: SNAP EXORCISM — EL FIN DEL STAIRCASE
      // Snap mode fue diseñado para targets DISCRETOS (posiciones fijas).
      // El VMM genera targets CONTINUOS (sinusoidales). Snap + continuo =
      // staircase effect: cada frame snapea a un micro-target diferente →
      // la geometría se fragmenta en escalones visibles.
      //
      // Classic mode: el physics driver integra la trayectoria de forma
      // natural con inercia, fricción y aceleración continua.
      // friction=0.15 → suavizado orgánico sin lag excesivo
      // ═══════════════════════════════════════════════════════════════════
      snapFactor: 0.0,          // � WAVE 2212: Ignorado en classic mode
      revLimitPanPerSec: 250,   // Mantenido: ~530°/s — headroom para figure8 a alta energía
      revLimitTiltPerSec: 180,  // Mantenido: ~191°/s — tilt curvo suave
    },
    optics: {
      zoomDefault: 150,         // Zoom medio (spot suave)
      zoomRange: { min: 80, max: 200 },
      focusDefault: 100,        // Foco medio
      focusRange: { min: 50, max: 180 },
    },
    behavior: {
      homeOnSilence: false,     // Continuar bailando
      syncToBeat: true,         // Sincronizar con clave
      allowRandomPos: true,     // Movimientos orgánicos
      smoothFactor: 0.5,        // Movimiento suave
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 🎸 ROCK: Reactivo, Posiciones fijas, Wall of Light
  // "El muro de luz que golpea con la guitarra"
  // 🔧 WAVE 340.5: Aceleración alta para punch
  // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — golpes dramáticos pero creíbles
  //    Rock necesita movimientos con peso, como un headbang — no teleporting.
  //    Referencia: mover de gama media (~200°/s pan = 94 DMX/s)
  // ───────────────────────────────────────────────────────────────
  'pop-rock': {
    physics: {
      maxAcceleration: 1500,    // � WAVE 2212: Subido para arcos dramáticos con potencia
      maxVelocity: 450,         // Mantenido: rápido en golpes
      friction: 0.20,           // 🔥 WAVE 2212: Bajado para que los arcos tengan peso sin staircase
      arrivalThreshold: 1.5,    // 🔥 WAVE 2212: Balance dramático con fluidez
      physicsMode: 'classic',   // 🔥 WAVE 2212: SNAP EXORCISM — classic para sinusoidales continuas
      // ═══════════════════════════════════════════════════════════════════
      // � WAVE 2212: SNAP EXORCISM — EL FIN DEL STAIRCASE
      // Snap mode era correcto para targets discretos, pero circle_big,
      // cancan y dual_sweep son sinusoidales continuas. Snap + continuo =
      // staircase effect visible → los arcos de estadio se fragmentan.
      //
      // Classic mode con friction=0.20: los arcos tienen peso dramático
      // sin los escalones del snap. El mover persigue la trayectoria con
      // inercia natural — como un spotlight de estadio real.
      // ═══════════════════════════════════════════════════════════════════
      snapFactor: 0.0,          // � WAVE 2212: Ignorado en classic mode
      revLimitPanPerSec: 300,   // Mantenido: ~636°/s — arcos dramáticos de estadio
      revLimitTiltPerSec: 200,  // Mantenido: ~212°/s — tilt con gravitas
    },
    optics: {
      zoomDefault: 220,         // Zoom abierto (wash)
      zoomRange: { min: 150, max: 255 },
      focusDefault: 180,        // Foco suave (difuso)
      focusRange: { min: 100, max: 255 },
    },
    behavior: {
      homeOnSilence: true,      // Volver a home en breakdown
      syncToBeat: false,        // Reaccionar a energía, no beat
      allowRandomPos: false,    // Posiciones de stage fijas
      smoothFactor: 0.2,        // Algo de suavizado
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 🍸 CHILL: Glacial, Nebulosa, Meditativo
  // "Flotando en el sunset con cocktail en mano"
  // ───────────────────────────────────────────────────────────────
  'chill-lounge': {
    physics: {
      maxAcceleration: 100,     // Ultra lento
      maxVelocity: 50,          // Velocidad glacial
      friction: 0.80,           // Máxima fricción (slew rate limit)
      arrivalThreshold: 3.0,    // Permite mucho overshoot
      physicsMode: 'classic',   // 🏎️ WAVE 2074.2: Inercia glacial, navega suavemente
      snapFactor: 0.0,          // 🏎️ WAVE 2074.3: No aplica en classic mode (ignorado)
      revLimitPanPerSec: 80,    // 🔧 WAVE 2088.8: ~170°/s — Chill pero con movimiento VISIBLE
                                //    Antes=30 → drift/sway eran imperceptibles
      revLimitTiltPerSec: 55,   // 🔧 WAVE 2088.8: ~58°/s — tilt orgánico visible
    },
    optics: {
      zoomDefault: 255,         // Zoom máximo (wash total)
      zoomRange: { min: 200, max: 255 },
      focusDefault: 255,        // Desenfocado (nebulosa)
      focusRange: { min: 200, max: 255 },
    },
    behavior: {
      homeOnSilence: false,     // Flotar eternamente
      syncToBeat: false,        // Movimiento libre
      allowRandomPos: true,     // Deriva orgánica
      smoothFactor: 0.9,        // Ultra suave
    },
  },
  
  // ───────────────────────────────────────────────────────────────
  // 💤 IDLE: Estático, Neutral
  // "Esperando que el DJ arranque"
  // ───────────────────────────────────────────────────────────────
  'idle': {
    physics: {
      maxAcceleration: 200,
      maxVelocity: 100,
      friction: 0.50,
      arrivalThreshold: 1.0,
      physicsMode: 'classic',   // 🏎️ WAVE 2074.2: Idle = sin prisa, física suave
      snapFactor: 0.0,          // 🏎️ WAVE 2074.3: No aplica en classic mode (ignorado)
      revLimitPanPerSec: 120,    // 🔧 WAVE 2088.8: ~254°/s — idle visible, no congelado
      revLimitTiltPerSec: 80,    // 🔧 WAVE 2088.8: ~85°/s — tilt suave en idle
    },
    optics: {
      zoomDefault: 127,         // Zoom neutro
      zoomRange: { min: 0, max: 255 },
      focusDefault: 127,        // Foco neutro
      focusRange: { min: 0, max: 255 },
    },
    behavior: {
      homeOnSilence: true,
      syncToBeat: false,
      allowRandomPos: false,
      smoothFactor: 0.3,
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obtener preset de movimiento por vibe ID
 */
export function getMovementPreset(vibeId: string): MovementPreset {
  const preset = MOVEMENT_PRESETS[vibeId]
  
  // 🚨 WAVE 2040.3: EL CHIVATO - Detect fallback to idle
  if (!preset) {
    console.warn(
      `[VibeMovementPresets] ⚠️ ERROR 404: Preset for vibeId="${vibeId}" NOT FOUND!\n` +
      `   ├─ Available presets: ${Object.keys(MOVEMENT_PRESETS).join(', ')}\n` +
      `   └─ Falling back to 'idle' preset (MOVERS WILL FREEZE)`
    )
    return MOVEMENT_PRESETS['idle']
  }
  
  return preset
}

/**
 * Obtener solo la física por vibe ID
 */
export function getMovementPhysics(vibeId: string): MovementPhysics {
  return getMovementPreset(vibeId).physics
}

/**
 * Obtener solo la óptica por vibe ID
 */
export function getOpticsConfig(vibeId: string): OpticsConfig {
  return getMovementPreset(vibeId).optics
}

/**
 * Obtener solo el comportamiento por vibe ID
 */
export function getMovementBehavior(vibeId: string): MovementBehavior {
  return getMovementPreset(vibeId).behavior
}

/**
 * Lista de vibes disponibles con presets
 */
export function getAvailableVibeIds(): string[] {
  return Object.keys(MOVEMENT_PRESETS)
}
