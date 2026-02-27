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
  // ───────────────────────────────────────────────────────────────
  'techno-club': {
    physics: {
      maxAcceleration: 2000,    // 🔧 Arranques agresivos pero seguros (era 1500)
      maxVelocity: 600,         // Muy rápido
      friction: 0.05,           // Casi sin fricción (libre)
      arrivalThreshold: 0.5,    // Precisión alta
      physicsMode: 'snap',      // 🏎️ WAVE 2074.2: Respuesta instantánea, sin lag
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
  // ───────────────────────────────────────────────────────────────
  'fiesta-latina': {
    physics: {
      maxAcceleration: 1200,    // 🔧 Subido: Seguir caderas rápido
      maxVelocity: 350,         // 🔧 Subido: Más swing
      friction: 0.20,           // Algo de suavizado orgánico
      arrivalThreshold: 2.0,    // Permite overshoot elegante
      physicsMode: 'snap',      // 🏎️ WAVE 2074.2: Sigue trayectorias curvas sin lag
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
  // ───────────────────────────────────────────────────────────────
  'pop-rock': {
    physics: {
      maxAcceleration: 1100,    // 🔧 Subido: Golpes reactivos duros
      maxVelocity: 450,         // 🔧 Subido: Rápido en golpes
      friction: 0.30,           // Fricción para punch (no arrastrar)
      arrivalThreshold: 1.0,    // Precisión normal
      physicsMode: 'snap',      // 🏎️ WAVE 2074.2: Golpes dramáticos, no arrastre
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
