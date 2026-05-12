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
 * @layer ENGINE/MOVEMENT
 * @version WAVE 338 - Core 2 Kickoff
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
  // �️ TECHNO: Geometría dura, precisión industrial — CATEDRAL de neón
  // 🏛️ WAVE 4730 TRÍADA: Rebalanceo total con hardware real.
  //   Hardware ref: Sharpy ~257°/s = 121 DMX/s. Pro mover ~400°/s = 189 DMX/s.
  //   Con períodos duplicados (16-32 beats) y amplitud 0.92, la velocidad
  //   pico baja drásticamente. Ya no necesitamos 600 DMX/s — eso era ficción.
  // ───────────────────────────────────────────────────────────────
  'techno-club': {
    physics: {
      maxAcceleration: 850,     // 🔥 600→850. Explosivo — Speed Ch=0 lo permite
      maxVelocity: 380,         // 🔥 320→380. ~805°/s — Techno REAL agresivo
      friction: 0.06,           // 🔥 0.08→0.06. Más inercia industrial
      arrivalThreshold: 0.3,    // 🔥 0.5→0.3. Esquinas clavadas
      physicsMode: 'snap',      // Sin cambio
      snapFactor: 1.0,          // Sin cambio
      revLimitPanPerSec: 360,   // 🔥 300→360. ~763°/s — geometría aflática
      revLimitTiltPerSec: 270,  // 🔥 220→270. ~572°/s — tilt con fuerza máxima
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
  // 💃 LATINO: Fluido, Circular, Orgánico — CATEDRAL sensual
  // 🏛️ WAVE 4730 TRÍADA: Rebalanceo con hardware real.
  //   Con períodos 32-48 beats y panScale 0.95, la velocidad pico
  //   cae a ~100-140 DMX/s — dentro del rango de cualquier mover.
  // ───────────────────────────────────────────────────────────────
  'fiesta-latina': {
    physics: {
      maxAcceleration: 650,     // 🔥 500→650. Más vida en curvas
      maxVelocity: 310,         // 🔥 250→310. ~657°/s — caderas con alma autentica
      friction: 0.06,           // 🔥 0.07→0.06. Seda pura
      arrivalThreshold: 2.0,    // Sin cambio — overshoot elegante
      physicsMode: 'snap',      // Sin cambio
      snapFactor: 0.88,         // 🔥 0.85→0.88. Más fidelidad de seguimiento
      revLimitPanPerSec: 300,   // 🔥 240→300. ~636°/s — espiral conga real
      revLimitTiltPerSec: 240,  // 🔥 180→240. ~509°/s — tilt orgánico con fuerza
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
  // 🎸 ROCK: Reactivo, Wall of Light — CATEDRAL épica
  // 🏛️ WAVE 4730 TRÍADA: Rebalanceo con hardware real.
  //   Rock con classic physics + períodos 16-32 beats. Arcos enormes
  //   con gravitas de headbang. Referencia: mover mid ~200°/s = 94 DMX/s.
  // ───────────────────────────────────────────────────────────────
  'pop-rock': {
    physics: {
      maxAcceleration: 700,     // 🔥 450→700. Golpes reactivos con masa
      maxVelocity: 280,         // 🔥 220→280. ~594°/s — headbang con potencia real
      friction: 0.15,           // 🔥 0.20→0.15. Menos fricción = más inercia visual
      arrivalThreshold: 1.0,    // 🔥 1.5→1.0. Esquinas más definidas
      physicsMode: 'classic',   // Sin cambio — física con inercia
      snapFactor: 0.70,         // 🔥 0.60→0.70. Más reactividad en golpes
      revLimitPanPerSec: 260,   // 🔥 200→260. ~551°/s — arcos potentes
      revLimitTiltPerSec: 200,  // 🔥 150→200. ~424°/s — tilt con punch
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
  // 🏛️ WAVE 4730 TRÍADA: Chill con amplitudes más amplias pero misma velocidad glacial.
  //   panScale subido 0.70→0.85 en VMM, pero física sigue siendo medusa.
  'chill-lounge': {
    physics: {
      maxAcceleration: 6,       // �️ 4→6. Ligeramente más energía para el arco mayor
      maxVelocity: 12,          // �️ 8→12. ~25°/s — medusa con algo más de corriente
      friction: 0.95,           // �️ 0.97→0.95. Agua densa pero no gelatina
      arrivalThreshold: 8.0,    // Sin cambio — importa flotar
      physicsMode: 'classic',   // Sin cambio — inercia oceánica
      snapFactor: 0.0,          // Sin cambio
      revLimitPanPerSec: 15,    // �️ 12→15. ~32°/s — ligeramente más rango para la amplitud mayor
      revLimitTiltPerSec: 10,   // �️ 8→10. ~21°/s — tilt más abierto que antes
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
  // 🏛️ WAVE 4730 TRÍADA: Idle con valores proporcionalmente reducidos.
  'idle': {
    physics: {
      maxAcceleration: 120,     // 🏛️ 200→120. Arranque suave
      maxVelocity: 60,          // 🏛️ 100→60. ~127°/s — visible pero sin prisa
      friction: 0.50,           // Sin cambio
      arrivalThreshold: 1.0,    // Sin cambio
      physicsMode: 'classic',   // Sin cambio
      snapFactor: 0.0,          // Sin cambio
      revLimitPanPerSec: 60,    // 🏛️ 120→60. ~127°/s — idle visible, no agresivo
      revLimitTiltPerSec: 40,   // 🏛️ 80→40. ~85°/s — tilt suave
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
