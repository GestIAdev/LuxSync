/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 EFFECT REGISTRY - WAVE 2040.21: THE CORE PRESET REVAMP
 * 
 * Registro centralizado de TODOS los efectos reales de LuxSync.
 * Generado dinámicamente desde EffectManager.
 * 
 * ARQUITECTURA:
 * - EffectCategory: Agrupa efectos por género/familia
 * - EffectMeta: Metadata de cada efecto (nombre, icon, color, zone, mixBus, tags)
 * - getEffectRegistry(): Función que retorna el catálogo completo
 * 
 * WAVE 2040.21: Every single effect now carries explicit mixBus + tags.
 * No more inference needed for Core Effects — the truth is in the data.
 * The inferMixBus() function remains for legacy/unknown effects.
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Estos son los 45+ efectos REALES que existen en el sistema.
 * No hay mocks, no hay demos, no hay aleatorios.
 * 
 * @module chronos/core/EffectRegistry
 * @version WAVE 2040.21
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type EnergyZone = 
  | 'silence'   // 0.00 - 0.15
  | 'valley'    // 0.15 - 0.30
  | 'ambient'   // 0.30 - 0.45
  | 'gentle'    // 0.45 - 0.60
  | 'active'    // 0.60 - 0.75
  | 'intense'   // 0.75 - 0.90
  | 'peak'      // 0.90 - 1.00

export type EffectCategoryId = 
  | 'fiesta-latina'
  | 'techno'
  | 'pop-rock'
  | 'chill-lounge'
  | 'universal'

/**
 * � WAVE 2012: MixBus classification for intelligent track routing
 * 
 * - 'global': Full takeover effects (strobes, blinders, meltdowns) → FX1
 * - 'htp': High-priority transitional effects (sweeps, chases) → FX2
 * - 'ambient': Atmospheric/background effects (mists, rains, breaths) → FX3
 * - 'accent': Short accent effects (sparks, hits) → FX4
 */
export type MixBus = 'global' | 'htp' | 'ambient' | 'accent'

/**
 * 🏷️ Effect tags for additional classification
 */
export type EffectTag = 
  | 'strobe'
  | 'sweep' 
  | 'atmospheric'
  | 'rhythmic'
  | 'transitional'
  | 'accent'
  | 'movement'
  | 'color'
  | 'intensity'

/**
 * �🎨 Metadata de un efecto
 */
export interface EffectMeta {
  /** ID interno del efecto (ej: 'solar_flare') */
  id: string
  
  /** Nombre para mostrar (ej: 'Solar Flare') */
  displayName: string
  
  /** Icono emoji */
  icon: string
  
  /** Color representativo (hex) */
  color: string
  
  /** Zona energética donde opera */
  zone: EnergyZone
  
  /** ¿Usa strobe? */
  hasStrobe: boolean
  
  /** ¿Es dinámico? (responde a energía) */
  isDynamic: boolean
  
  /** Descripción corta */
  description: string
  
  /** Duración sugerida en ms */
  suggestedDuration: number
  
  /** 🎹 WAVE 2012: MixBus for track routing */
  mixBus?: MixBus
  
  /** 🏷️ WAVE 2012: Tags for classification */
  tags?: EffectTag[]
}

/**
 * 🎭 Categoría de efectos
 */
export interface EffectCategory {
  id: EffectCategoryId
  name: string
  icon: string
  color: string
  effects: EffectMeta[]
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎺 FIESTA LATINA - Los ritmos calientes
// ═══════════════════════════════════════════════════════════════════════════

const FIESTA_LATINA_EFFECTS: EffectMeta[] = [
  {
    id: 'solar_flare',
    displayName: 'Solar Flare',
    icon: '☀️',
    color: '#FF6B00',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'Explosión solar para drops épicos',
    suggestedDuration: 3000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'tropical_pulse',
    displayName: 'Tropical Pulse',
    icon: '🌴',
    color: '#00FF88',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Crescendo bursts como ritmo de conga',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['rhythmic', 'intensity'],
  },
  {
    id: 'salsa_fire',
    displayName: 'Salsa Fire',
    icon: '🔥',
    color: '#FF4444',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Flickeo orgánico de fuego',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['rhythmic', 'color'],
  },
  {
    id: 'cumbia_moon',
    displayName: 'Cumbia Moon',
    icon: '🌙',
    color: '#9B59B6',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Respiración suave para breakdowns',
    suggestedDuration: 6000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'clave_rhythm',
    displayName: 'Clave Rhythm',
    icon: '🥁',
    color: '#E67E22',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Patrón 3-2 con color y movimiento',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['rhythmic', 'movement'],
  },
  {
    id: 'corazon_latino',
    displayName: 'Corazón Latino',
    icon: '❤️',
    color: '#E91E63',
    zone: 'intense',
    hasStrobe: false,
    isDynamic: true,
    description: 'Latido de pasión para momentos épicos',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['rhythmic', 'intensity'],
  },
  {
    id: 'amazon_mist',
    displayName: 'Amazon Mist',
    icon: '🌿',
    color: '#1ABC9C',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Neblina amazónica atmosférica',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'machete_spark',
    displayName: 'Machete Spark',
    icon: '⚔️',
    color: '#F39C12',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Chispa de machete en la active zone',
    suggestedDuration: 2000,
    mixBus: 'accent',
    tags: ['accent', 'intensity'],
  },
  {
    id: 'glitch_guaguanco',
    displayName: 'Glitch Guaguancó',
    icon: '🪘',
    color: '#8E44AD',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Glitch digital con ritmo cubano',
    suggestedDuration: 3000,
    mixBus: 'accent',
    tags: ['accent', 'rhythmic'],
  },
  {
    id: 'latina_meltdown',
    displayName: 'Latina Meltdown',
    icon: '💥',
    color: '#C0392B',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'LA BESTIA LATINA para peak zone',
    suggestedDuration: 4000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'strobe_burst',
    displayName: 'Strobe Burst',
    icon: '⚡',
    color: '#FFFF00',
    zone: 'intense',
    hasStrobe: true,
    isDynamic: true,
    description: 'Strobe rítmico para fiesta',
    suggestedDuration: 2000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// 🤖 TECHNO - La maquinaria industrial
// ═══════════════════════════════════════════════════════════════════════════

const TECHNO_EFFECTS: EffectMeta[] = [
  {
    id: 'strobe_storm',
    displayName: 'Strobe Storm',
    icon: '⚡',
    color: '#FFFFFF',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'Tormenta de strobe para rock/techno',
    suggestedDuration: 2000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'industrial_strobe',
    displayName: 'Industrial Strobe',
    icon: '🔨',
    color: '#FF0000',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'El martillo que golpea el acero',
    suggestedDuration: 2000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'acid_sweep',
    displayName: 'Acid Sweep',
    icon: '🧪',
    color: '#00FF00',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: true,
    description: 'Hoja volumétrica de luz',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['sweep', 'movement'],
  },
  {
    id: 'cyber_dualism',
    displayName: 'Cyber Dualism',
    icon: '🤖',
    color: '#00BFFF',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Los gemelos ping-pong L/R',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['movement', 'rhythmic'],
  },
  {
    id: 'gatling_raid',
    displayName: 'Gatling Raid',
    icon: '🔫',
    color: '#FF4500',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'Ráfaga de metralleta PAR',
    suggestedDuration: 2000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'sky_saw',
    displayName: 'Sky Saw',
    icon: '🗡️',
    color: '#FF69B4',
    zone: 'intense',
    hasStrobe: false,
    isDynamic: true,
    description: 'Cortes agresivos de movers',
    suggestedDuration: 3000,
    mixBus: 'htp',
    tags: ['movement', 'sweep'],
  },
  {
    id: 'abyssal_rise',
    displayName: 'Abyssal Rise',
    icon: '🌪️',
    color: '#4B0082',
    zone: 'intense',
    hasStrobe: false,
    isDynamic: true,
    description: 'Transición épica de 8 barras',
    suggestedDuration: 16000,
    mixBus: 'htp',
    tags: ['transitional', 'intensity'],
  },
  {
    id: 'void_mist',
    displayName: 'Void Mist',
    icon: '🌫️',
    color: '#9B59B6',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Niebla púrpura con respiración',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'digital_rain',
    displayName: 'Digital Rain',
    icon: '💧',
    color: '#00FFFF',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Flickeo Matrix cyan/lime',
    suggestedDuration: 6000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'deep_breath',
    displayName: 'Deep Breath',
    icon: '🫁',
    color: '#6A5ACD',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Respiración orgánica de 4 barras',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'intensity'],
  },
  {
    id: 'ambient_strobe',
    displayName: 'Ambient Strobe',
    icon: '📸',
    color: '#EEEEEE',
    zone: 'gentle',
    hasStrobe: true,
    isDynamic: false,
    description: 'Flashes tipo cámara de estadio',
    suggestedDuration: 4000,
    mixBus: 'global',
    tags: ['strobe', 'accent'],
  },
  {
    id: 'sonar_ping',
    displayName: 'Sonar Ping',
    icon: '🔵',
    color: '#1E90FF',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Ping submarino back→front',
    suggestedDuration: 3000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'movement'],
  },
  {
    id: 'binary_glitch',
    displayName: 'Binary Glitch',
    icon: '⚡',
    color: '#7FFF00',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Tartamudeo de código morse corrupto',
    suggestedDuration: 2000,
    mixBus: 'accent',
    tags: ['accent', 'rhythmic'],
  },
  {
    id: 'seismic_snap',
    displayName: 'Seismic Snap',
    icon: '💥',
    color: '#FF6347',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Golpe físico de luz tipo obturador',
    suggestedDuration: 1000,
    mixBus: 'accent',
    tags: ['accent', 'intensity'],
  },
  {
    id: 'fiber_optics',
    displayName: 'Fiber Optics',
    icon: '🌈',
    color: '#FF00FF',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Colores viajeros ambient',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'core_meltdown',
    displayName: 'Core Meltdown',
    icon: '☢️',
    color: '#FF0000',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'LA BESTIA - extreme strobe',
    suggestedDuration: 3000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// 🎸 POP-ROCK - Los 8 Magníficos
// ═══════════════════════════════════════════════════════════════════════════

const POP_ROCK_EFFECTS: EffectMeta[] = [
  {
    id: 'thunder_struck',
    displayName: 'Thunder Struck',
    icon: '⚡',
    color: '#FFD700',
    zone: 'intense',
    hasStrobe: false,
    isDynamic: true,
    description: 'Stadium blinder para drops',
    suggestedDuration: 2000,
    mixBus: 'htp',
    tags: ['intensity', 'accent'],
  },
  {
    id: 'liquid_solo',
    displayName: 'Liquid Solo',
    icon: '🎸',
    color: '#9370DB',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Spotlight del guitarrista',
    suggestedDuration: 6000,
    mixBus: 'htp',
    tags: ['movement', 'intensity'],
  },
  {
    id: 'amp_heat',
    displayName: 'Amp Heat',
    icon: '🔥',
    color: '#FF8C00',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Válvulas calientes respirando',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'arena_sweep',
    displayName: 'Arena Sweep',
    icon: '🌊',
    color: '#4169E1',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: true,
    description: 'El barrido de Wembley',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['sweep', 'movement'],
  },
  {
    id: 'feedback_storm',
    displayName: 'Feedback Storm',
    icon: '😵',
    color: '#DC143C',
    zone: 'peak',
    hasStrobe: true,
    isDynamic: true,
    description: 'Caos visual harshness reactive',
    suggestedDuration: 3000,
    mixBus: 'global',
    tags: ['strobe', 'intensity'],
  },
  {
    id: 'power_chord',
    displayName: 'Power Chord',
    icon: '⚡',
    color: '#FF4500',
    zone: 'intense',
    hasStrobe: true,
    isDynamic: true,
    description: 'Flash + strobe del acorde',
    suggestedDuration: 1000,
    mixBus: 'global',
    tags: ['strobe', 'accent'],
  },
  {
    id: 'stage_wash',
    displayName: 'Stage Wash',
    icon: '🌊',
    color: '#FFA500',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Respiro cálido amber',
    suggestedDuration: 6000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'spotlight_pulse',
    displayName: 'Spotlight Pulse',
    icon: '💡',
    color: '#FFE4B5',
    zone: 'active',
    hasStrobe: false,
    isDynamic: true,
    description: 'Breathing spotlight emotivo',
    suggestedDuration: 4000,
    mixBus: 'htp',
    tags: ['intensity', 'rhythmic'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 CHILL LOUNGE - The Living Ocean
// ═══════════════════════════════════════════════════════════════════════════

const CHILL_LOUNGE_EFFECTS: EffectMeta[] = [
  {
    id: 'tidal_wave',
    displayName: 'Tidal Wave',
    icon: '🌊',
    color: '#20B2AA',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Ola oceánica suave',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'movement'],
  },
  {
    id: 'ghost_breath',
    displayName: 'Ghost Breath',
    icon: '👻',
    color: '#F8F8FF',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Respiración fantasmal',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'intensity'],
  },
  {
    id: 'solar_caustics',
    displayName: 'Solar Caustics',
    icon: '☀️',
    color: '#87CEEB',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Rayos de sol en aguas someras',
    suggestedDuration: 10000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'school_of_fish',
    displayName: 'School of Fish',
    icon: '🐠',
    color: '#40E0D0',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Cardumen cruzando el océano',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'movement'],
  },
  {
    id: 'whale_song',
    displayName: 'Whale Song',
    icon: '🐋',
    color: '#4682B4',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Canto de ballena zona crepuscular',
    suggestedDuration: 12000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'intensity'],
  },
  {
    id: 'abyssal_jellyfish',
    displayName: 'Abyssal Jellyfish',
    icon: '🪼',
    color: '#DA70D6',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Medusas bioluminiscentes',
    suggestedDuration: 10000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'surface_shimmer',
    displayName: 'Surface Shimmer',
    icon: '✨',
    color: '#F0F8FF',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Brillos de superficie',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
  {
    id: 'plankton_drift',
    displayName: 'Plankton Drift',
    icon: '🦠',
    color: '#98FB98',
    zone: 'silence',
    hasStrobe: false,
    isDynamic: false,
    description: 'Partículas a la deriva',
    suggestedDuration: 10000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'movement'],
  },
  {
    id: 'deep_current_pulse',
    displayName: 'Deep Current Pulse',
    icon: '🌀',
    color: '#483D8B',
    zone: 'ambient',
    hasStrobe: false,
    isDynamic: false,
    description: 'Corrientes de agua profunda',
    suggestedDuration: 8000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'movement'],
  },
  {
    id: 'bioluminescent_spore',
    displayName: 'Bioluminescent Spore',
    icon: '✨',
    color: '#00CED1',
    zone: 'valley',
    hasStrobe: false,
    isDynamic: false,
    description: 'Esporas abisales',
    suggestedDuration: 10000,
    mixBus: 'ambient',
    tags: ['atmospheric', 'color'],
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// 📚 THE COMPLETE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const EFFECT_CATEGORIES: EffectCategory[] = [
  {
    id: 'fiesta-latina',
    name: 'Fiesta Latina',
    icon: '🎺',
    color: '#FF4500',       // WAVE 2040.7: Neon Orange-Red — caliente
    effects: FIESTA_LATINA_EFFECTS,
  },
  {
    id: 'techno',
    name: 'Techno Club',
    icon: '🤖',
    color: '#FF00FF',       // WAVE 2040.7: Neon Magenta — the club pulsates
    effects: TECHNO_EFFECTS,
  },
  {
    id: 'pop-rock',
    name: 'Pop-Rock Legends',
    icon: '🎸',
    color: '#FFE500',       // WAVE 2040.7: Neon Electric Yellow — stadium lights
    effects: POP_ROCK_EFFECTS,
  },
  {
    id: 'chill-lounge',
    name: 'Chill Lounge',
    icon: '🌊',
    color: '#00FFCC',       // WAVE 2040.7: Neon Aquamarine — bioluminescent
    effects: CHILL_LOUNGE_EFFECTS,
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 📚 Get all effect categories with their effects
 */
export function getEffectCategories(): EffectCategory[] {
  return EFFECT_CATEGORIES
}

/**
 * 🎯 Get a specific effect by ID
 */
export function getEffectById(id: string): EffectMeta | undefined {
  for (const category of EFFECT_CATEGORIES) {
    const effect = category.effects.find(e => e.id === id)
    if (effect) return effect
  }
  return undefined
}

/**
 * 📊 Get all effects as flat array
 */
export function getAllEffects(): EffectMeta[] {
  return EFFECT_CATEGORIES.flatMap(cat => cat.effects)
}

/**
 * 🔍 Get effects by energy zone
 */
export function getEffectsByZone(zone: EnergyZone): EffectMeta[] {
  return getAllEffects().filter(e => e.zone === zone)
}

/**
 * ⚡ Get effects that use strobe
 */
export function getStrobeEffects(): EffectMeta[] {
  return getAllEffects().filter(e => e.hasStrobe)
}

/**
 * 📊 Get effect count by category
 */
export function getEffectCounts(): Record<EffectCategoryId, number> {
  return {
    'fiesta-latina': FIESTA_LATINA_EFFECTS.length,
    'techno': TECHNO_EFFECTS.length,
    'pop-rock': POP_ROCK_EFFECTS.length,
    'chill-lounge': CHILL_LOUNGE_EFFECTS.length,
    'universal': 0,
  }
}

/**
 * 📊 Get total effect count
 */
export function getTotalEffectCount(): number {
  return getAllEffects().length
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎹 WAVE 2012: MIXBUS INFERENCE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎹 Infer MixBus from effect properties
 * 
 * This uses intelligent heuristics based on:
 * - hasStrobe → GLOBAL (full takeover)
 * - zone === 'peak' or 'intense' → GLOBAL
 * - zone === 'silence' or 'ambient' → AMBIENT
 * - displayName contains sweep/chase/scan → HTP
 * - Everything else → ACCENT
 * 
 * @param effect Effect metadata
 * @returns Inferred MixBus
 */
export function inferMixBus(effect: EffectMeta): MixBus {
  // If explicitly set, use it
  if (effect.mixBus) {
    return effect.mixBus
  }
  
  const nameLower = effect.displayName.toLowerCase()
  const idLower = effect.id.toLowerCase()
  
  // 🔴 GLOBAL (FX1): Full takeover effects - strobes, blinders, meltdowns
  if (effect.hasStrobe) {
    return 'global'
  }
  if (effect.zone === 'peak') {
    return 'global'
  }
  if (nameLower.includes('meltdown') || nameLower.includes('blinder') || 
      nameLower.includes('storm') || nameLower.includes('explosion')) {
    return 'global'
  }
  
  // 🟢 AMBIENT (FX3): Atmospheric/background effects
  if (effect.zone === 'silence' || effect.zone === 'valley') {
    return 'ambient'
  }
  if (nameLower.includes('mist') || nameLower.includes('rain') ||
      nameLower.includes('breath') || nameLower.includes('void') ||
      nameLower.includes('ambient') || nameLower.includes('moon') ||
      nameLower.includes('aurora') || nameLower.includes('fog')) {
    return 'ambient'
  }
  
  // 🟡 HTP (FX2): Transitional/movement effects - sweeps, chases, scans
  if (nameLower.includes('sweep') || nameLower.includes('chase') ||
      nameLower.includes('scan') || nameLower.includes('wave') ||
      nameLower.includes('pulse') || nameLower.includes('rhythm') ||
      idLower.includes('acid') || idLower.includes('gatling')) {
    return 'htp'
  }
  
  // 🔵 ACCENT (FX4): Short accent effects
  if (effect.suggestedDuration <= 2000) {
    return 'accent'
  }
  if (nameLower.includes('spark') || nameLower.includes('flash') ||
      nameLower.includes('hit') || nameLower.includes('stab')) {
    return 'accent'
  }
  
  // Default to HTP for active zone effects
  if (effect.zone === 'active' || effect.zone === 'intense') {
    return 'htp'
  }
  
  // Fallback
  return 'htp'
}

/**
 * 🎹 Get track ID for an effect based on MixBus
 * 
 * @param effect Effect metadata
 * @returns Track ID ('fx1' | 'fx2' | 'fx3' | 'fx4')
 */
export function getEffectTrackId(effect: EffectMeta): 'fx1' | 'fx2' | 'fx3' | 'fx4' {
  const mixBus = inferMixBus(effect)
  
  switch (mixBus) {
    case 'global':  return 'fx1'  // Full takeover
    case 'htp':     return 'fx2'  // High priority transitional
    case 'ambient': return 'fx3'  // Atmospheric background
    case 'accent':  return 'fx4'  // Short accents
    default:        return 'fx2'  // Fallback
  }
}
