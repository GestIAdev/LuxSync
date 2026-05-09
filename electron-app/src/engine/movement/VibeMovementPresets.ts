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
  // 🎛️ TECHNO: Velocidad máxima, Aceleración agresiva, Beam cerrado
  // "Los demonios de neón en el bunker noruego"
  // 🔧 WAVE 350.5: maxAcceleration 1500 → 2000 (safety bump para botStabs)
  // 🔧 WAVE 2088.4: CALIBRACIÓN REAL — basada en hardware real (Sharpy ~257°/s = 121 DMX/s)
  // 🌊 WAVE 4703 M3: revLimits reducidos sutilmente para más peso visual.
  //    Pan 400→340, Tilt 400→320. Patrones más deliberados, menos frenéticos.
  // ───────────────────────────────────────────────────────────────
  'techno-club': {
    physics: {
      maxAcceleration: 2000,    // 🔧 Arranques agresivos pero seguros (era 1500)
      maxVelocity: 600,         // Muy rápido
      friction: 0.08,           // 🔥 WAVE 2213: Bajísima — industrial robótico sin escalonado
      arrivalThreshold: 0.1,    // 🔧 WAVE 2233: Esquinas clavadas en botstep/diamond
      physicsMode: 'snap',      // 🔧 WAVE 2192: RESURRECCIÓN DE ESQUINAS
      snapFactor: 1.0,          // Target instantáneo, la inercia la manda el revLimit + hardware
      revLimitPanPerSec: 340,   // 🌊 WAVE 4703 M3: 400→340. ~719°/s — geometría con peso, no epilepsia
      revLimitTiltPerSec: 320,  // 🌊 WAVE 4703 M3: 400→320. ~339°/s — tilt deliberado, con gravitas
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
  // 🌊 WAVE 4703 M2: Más amplitud y velocidad. Alma latina sin límites.
  //    revLimitPan 380→520, revLimitTilt 280→420. Bien por debajo del CAP de 900.
  //    snapFactor 0.85→0.90: más fidelidad de seguimiento para cadera_libre/espiral_conga.
  // ───────────────────────────────────────────────────────────────
  'fiesta-latina': {
    physics: {
      maxAcceleration: 1400,    // 🌊 WAVE 4703 M2: 1200→1400. Arranques más vivos.
      maxVelocity: 560,         // 🌊 WAVE 4703 M2: 500→560. Más rango de velocidad.
      friction: 0.07,           // 🌊 WAVE 4703 M2: 0.08→0.07. Piel de serpiente aún más fluida.
      arrivalThreshold: 2.0,    // Permite overshoot elegante (sin cambio)
      physicsMode: 'snap',      // Caderas no esperan (sin cambio)
      snapFactor: 0.90,         // 🌊 WAVE 4703 M2: 0.85→0.90. Cadera libre necesita fidelidad alta.
      revLimitPanPerSec: 520,   // 🌊 WAVE 4703 M2: 380→520. ~1101°/s — dentro del CAP de 900 DMX/s
      revLimitTiltPerSec: 420,  // 🌊 WAVE 4703 M2: 280→420. ~445°/s — tilt de espiral conga
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
      maxAcceleration: 1100,    // 🔧 Subido: Golpes reactivos duros
      maxVelocity: 450,         // 🔧 Subido: Rápido en golpes
      friction: 0.20,           // 🔥 WAVE 2213: Peso con punch (era 0.30 snap)
      arrivalThreshold: 1.0,    // Precisión normal
      physicsMode: 'classic',   // 🔥 WAVE 2213: Exorcismo del snap — arcos con gravitas
      // ═══════════════════════════════════════════════════════════════════
      // 🔧 WAVE 2088.8: THE SHAPE RESURRECTION
      // Rock usa circle_big, cancan, dual_sweep. Con snap=0.30 + revLimit=95
      // un circle_big de 16 beats se convertía en un temblor amorfo.
      // Los movers de estadio necesitan dibujar ARCOS visibles.
      //
      // snap=0.65 → el mover persigue con PESO (más lento que techno)
      // revLimit=300 → 5 DMX/frame → arcos grandes con gravitas
      // ═══════════════════════════════════════════════════════════════════
      snapFactor: 0.65,         // 🔧 WAVE 2088.8: Golpes con peso visible — más lento que techno
      revLimitPanPerSec: 300,   // 🔧 WAVE 2088.8: ~636°/s — arcos dramáticos de estadio
      revLimitTiltPerSec: 200,  // 🔧 WAVE 2088.8: ~212°/s — tilt con gravitas
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
      maxAcceleration: 4,       // 🌊 WAVE 2470 MODO DERIVA: arranque de 8→4. Inercia de continente deriva.
      maxVelocity: 8,           // 🌊 WAVE 2470 MODO DERIVA: 50→8. Velocidad de medusa.
      friction: 0.97,           // 🌊 WAVE 2470 MODO DERIVA: 0.80→0.97. Agua espesa, casi gelatina.
      arrivalThreshold: 8.0,    // 🌊 WAVE 2470 MODO DERIVA: 3.0→8.0. No importa llegar, importa flotar.
      physicsMode: 'classic',   // Inercia oceánica, siempre classic.
      snapFactor: 0.0,          // No aplica en classic mode.
      revLimitPanPerSec: 12,    // 🌊 WAVE 2470 MODO DERIVA: 80→12. ~25°/s. Panorámica de amanecer.
      revLimitTiltPerSec: 8,    // 🌊 WAVE 2470 MODO DERIVA: 55→8. ~17°/s. Tilt de anémona.
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
