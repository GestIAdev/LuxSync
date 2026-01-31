/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ EFFECT MANAGER - THE ORCHESTRA CONDUCTOR
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 600: EFFECT ARSENAL
 * WAVE 680: THE ARSENAL & THE SHIELD
 * 
 * El EffectManager es el orquestador central de todos los efectos.
 * Mantiene la lista de efectos activos, los actualiza cada frame,
 * y combina sus outputs para el MasterArbiter.
 * 
 * 🛡️ WAVE 680: THE SHIELD - Sistema de permisos por Vibe
 * Antes de disparar cualquier efecto, consulta las restricciones del Vibe activo.
 * Si el efecto está prohibido, se bloquea. Si está degradado, se ajusta.
 * 
 * RESPONSABILIDADES:
 * 1. Registry de tipos de efectos disponibles
 * 2. Instanciar y disparar efectos bajo demanda
 * 3. 🛡️ Validar permisos de Vibe antes de disparar (THE SHIELD)
 * 4. Actualizar efectos activos cada frame
 * 5. Combinar outputs (HTP para dimmer, LTP para color)
 * 6. Limpiar efectos terminados
 * 
 * SINGLETON: Solo hay un EffectManager global
 * 
 * @module core/effects/EffectManager
 * @version WAVE 680
 */

import { EventEmitter } from 'events'
import {
  ILightEffect,
  EffectTriggerConfig,
  EffectFrameOutput,
  CombinedEffectOutput,
  EffectManagerState,
  EffectCategory,
  MusicalContext,
  EffectZone,  // 🌴 WAVE 700.8: Zone filtering
} from './types'

// Import effect library
import { SolarFlare } from './library/fiestalatina/SolarFlare'
import { StrobeStorm } from './library/fiestalatina/StrobeStorm'
import { StrobeBurst } from './library/fiestalatina/StrobeBurst'
import { TidalWave } from './library/fiestalatina/TidalWave'
import { GhostBreath } from './library/fiestalatina/GhostBreath'
// 🎺 WAVE 692: FIESTA LATINA ARSENAL
import { TropicalPulse } from './library/fiestalatina/TropicalPulse'
import { SalsaFire } from './library/fiestalatina/SalsaFire'
// 🥁 WAVE 700.6: NEW LATINA EFFECT
import { ClaveRhythm } from './library/fiestalatina/ClaveRhythm'
import { CumbiaMoon } from './library/fiestalatina/CumbiaMoon'
// ❤️ WAVE 750: THE ARCHITECT'S SOUL
import { CorazonLatino } from './library/fiestalatina/CorazonLatino'

// ═══════════════════════════════════════════════════════════════════════════
// 🆕 WAVE 1010.5: THE LOST FOUR - 4 Efectos Huérfanos Conectados
// ═══════════════════════════════════════════════════════════════════════════
import { AmazonMist } from './library/fiestalatina/AmazonMist'
import { MacheteSpark } from './library/fiestalatina/MacheteSpark'
import { GlitchGuaguanco } from './library/fiestalatina/GlitchGuaguanco'
import { LatinaMeltdown } from './library/fiestalatina/LatinaMeltdown'

// 🔪 WAVE 780: TECHNO CLUB - THE BLADE
import { IndustrialStrobe } from './library/techno/IndustrialStrobe'
import { AcidSweep } from './library/techno/AcidSweep'

// 🤖 WAVE 810: UNLOCK THE TWINS
import { CyberDualism } from './library/techno/CyberDualism'

// � WAVE 930: ARSENAL PESADO
import { GatlingRaid } from './library/techno/GatlingRaid'
import { SkySaw } from './library/techno/SkySaw'
import { AbyssalRise } from './library/techno/AbyssalRise'

// 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
import { VoidMist } from './library/techno/VoidMist'
// 🔪 WAVE 986: StaticPulse PURGED - replaced by BinaryGlitch + SeismicSnap
import { DigitalRain } from './library/techno/DigitalRain'
import { DeepBreath } from './library/techno/DeepBreath'

// ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
import { AmbientStrobe } from './library/techno/AmbientStrobe'
import { SonarPing } from './library/techno/SonarPing'

// 🔪 WAVE 986: ACTIVE REINFORCEMENTS - Nuevas armas rápidas
import { BinaryGlitch } from './library/techno/BinaryGlitch'
import { SeismicSnap } from './library/techno/SeismicSnap'

// � WAVE 988: THE FINAL ARSENAL
import { FiberOptics } from './library/techno/FiberOptics'
import { CoreMeltdown } from './library/techno/CoreMeltdown'

// ═══════════════════════════════════════════════════════════════════════════
// 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
// ═══════════════════════════════════════════════════════════════════════════
import { ThunderStruck } from './library/poprock/ThunderStruck'
import { LiquidSolo } from './library/poprock/LiquidSolo'
import { AmpHeat } from './library/poprock/AmpHeat'
import { ArenaSweep } from './library/poprock/ArenaSweep'
import { FeedbackStorm } from './library/poprock/FeedbackStorm'

// ═══════════════════════════════════════════════════════════════════════════
// 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
// ═══════════════════════════════════════════════════════════════════════════
import { PowerChord } from './library/poprock/PowerChord'
import { StageWash } from './library/poprock/StageWash'
import { SpotlightPulse } from './library/poprock/SpotlightPulse'

// ═══════════════════════════════════════════════════════════════════════════
// 🌊 WAVE 1070: THE LIVING OCEAN - CHILL LOUNGE ARSENAL
// ═══════════════════════════════════════════════════════════════════════════
import { SolarCaustics } from './library/chillLounge/SolarCaustics'
import { SchoolOfFish } from './library/chillLounge/SchoolOfFish'
import { AbyssalJellyfish } from './library/chillLounge/AbyssalJellyfish'

// 💚🛡️ WAVE 680: Import VibeManager for THE SHIELD
import { VibeManager } from '../../engine/vibe/VibeManager'
import type { VibeProfile, VibeId } from '../../types/VibeProfile'

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ WAVE 1070: CHILL LOUNGE SHIELD - ALLOW/BLOCK LISTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Efectos PERMITIDOS en Chill Lounge
 * Solo estos efectos pueden dispararse cuando vibeId === 'chill-lounge'
 */
const CHILL_LOUNGE_ALLOWED_EFFECTS = [
  // WAVE 1070: Oceanic Effects
  'solar_caustics',
  'school_of_fish',
  'abyssal_jellyfish',
  
  // Legacy allowed (atmospheric, non-dynamic)
  'deep_breath',
  'stage_wash',
]

/**
 * Efectos BLOQUEADOS EXPLÍCITAMENTE en Chill Lounge
 * Estos NUNCA deben dispararse, aunque alguien intente forzarlo
 */
const CHILL_LOUNGE_BLOCKED_EFFECTS = [
  // Strobes - NEVER
  'industrial_strobe',
  'strobe_storm',
  'strobe_burst',
  'ambient_strobe',
  
  // Aggressive dynamics - NEVER
  'gatling_raid',
  'core_meltdown',
  'thunder_struck',
  'feedback_storm',
  
  // Fast sweeps - NEVER
  'acid_sweep',
  'sky_saw',
  'arena_sweep',
]

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ THE SHIELD - VIBE EFFECT RULES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado de validación de THE SHIELD
 */
interface ShieldValidation {
  /** ¿Está permitido el efecto? */
  allowed: boolean
  
  /** ¿Está degradado? (ej: strobe → pulsos simples) */
  degraded: boolean
  
  /** Mensaje para logging */
  message: string
  
  /** Restricciones específicas a aplicar */
  constraints?: {
    maxStrobeRate?: number
    maxIntensity?: number
  }
}

/**
 * 🛡️ EFFECT TYPE → VIBE RULES
 * 
 * Define qué efectos son bloqueados/degradados en cada Vibe.
 * Las reglas se consultan en runtime contra el VibeProfile activo.
 */
const EFFECT_VIBE_RULES: Record<string, {
  /** ¿Requiere strobe? (para validar contra maxStrobeRate) */
  requiresStrobe?: boolean
  /** ¿Es efecto dinámico? (bloqueado en chill-lounge) */
  isDynamic?: boolean
  /** ¿Requiere permiso específico? */
  requiresEffectType?: string
}> = {
  'solar_flare': { isDynamic: true },
  'strobe_storm': { requiresStrobe: true, isDynamic: true },
  'strobe_burst': { isDynamic: true }, // 🔥 WAVE 691: Rhythmic strobe for Latina
  'tidal_wave': { isDynamic: true },
  'ghost_breath': { isDynamic: true },
  // 🎺 WAVE 692: FIESTA LATINA ARSENAL
  'tropical_pulse': { isDynamic: true },   // 🌴 Crescendo bursts
  'salsa_fire': { isDynamic: true },       // 🔥 Fire flicker
  'cumbia_moon': { isDynamic: false },     // 🌙 Ambient - allowed even in chill
  // 🥁 WAVE 700.6: NEW LATINA EFFECT
  'clave_rhythm': { isDynamic: true },     // 🥁 3-2 Clave pattern with movement
  // ❤️ WAVE 750: THE ARCHITECT'S SOUL
  'corazon_latino': { isDynamic: true },   // ❤️ Heartbeat passion effect
  // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
  'industrial_strobe': { requiresStrobe: true, isDynamic: true },  // ⚡ Industrial hammer
  'acid_sweep': { isDynamic: true },       // 🧪 Volumetric blade of light
  // 🤖 WAVE 810: UNLOCK THE TWINS
  'cyber_dualism': { isDynamic: true },    // 🤖 Ping-pong L/R spatial targeting
  // 🔫 WAVE 930: ARSENAL PESADO
  'gatling_raid': { isDynamic: true },     // 🔫 Machine gun PARs
  'sky_saw': { isDynamic: true },          // 🗡️ Aggressive mover cuts
  'abyssal_rise': { isDynamic: true },     // 🌪️ Epic 8-bar transition
  // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL
  'void_mist': { isDynamic: false },       // 🌫️ Ambient - allowed in chill
  // 🔪 WAVE 986: static_pulse PURGED
  'digital_rain': { isDynamic: true },     // 💧 Matrix effect - subtle dynamic
  'deep_breath': { isDynamic: false },     // 🫁 Ambient - allowed in chill
  // ⚡ WAVE 977: LA FÁBRICA
  'ambient_strobe': { isDynamic: true },   // 📸 Camera flashes - needs energy
  'sonar_ping': { isDynamic: false },      // 🔵 Submarine ping - allowed in chill (for silences)
  // 🔪 WAVE 986: ACTIVE REINFORCEMENTS
  'binary_glitch': { isDynamic: true },    // ⚡ Digital stutter - tartamudeo código
  'seismic_snap': { isDynamic: true },     // 💥 Physical light snap - golpe de obturador
  // 🔮 WAVE 988: THE FINAL ARSENAL
  'fiber_optics': { isDynamic: false },    // 🌈 Ambient traveling colors - allowed in chill
  'core_meltdown': { requiresStrobe: true, isDynamic: true },  // ☢️ LA BESTIA - extreme strobe
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
  // ═══════════════════════════════════════════════════════════════════════════
  'thunder_struck': { isDynamic: true },     // ⚡ Stadium blinder - drops de estadio
  'liquid_solo': { isDynamic: true },        // 🎸 Guitarist spotlight - solos emotivos
  'amp_heat': { isDynamic: false },          // 🔥 Ambient válvulas - intros/versos (allowed in chill)
  'arena_sweep': { isDynamic: true },        // 🌊 Wembley sweep - bread & butter
  'feedback_storm': { requiresStrobe: true, isDynamic: true },  // 😵 Caos visual - harshness reactive
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
  // ═══════════════════════════════════════════════════════════════════════════
  'power_chord': { isDynamic: true },        // ⚡ Power chord flash - golpe del acorde
  'stage_wash': { isDynamic: false },        // 🌊 Warm wash - respiro cálido (allowed in chill)
  'spotlight_pulse': { isDynamic: true },    // 💡 Breathing spotlight - pulso emotivo
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1070: THE LIVING OCEAN - CHILL LOUNGE OCEANIC EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  'solar_caustics': { isDynamic: false },     // ☀️ Sun rays underwater - shallow zone atmosphere
  'school_of_fish': { isDynamic: false },     // 🐠 Fish school crossing - open ocean fauna
  'abyssal_jellyfish': { isDynamic: false },  // 🪼 Bioluminescent pulse - deep abyss creature
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT FACTORY TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factory function para crear efectos
 */
type EffectFactory = () => ILightEffect

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 WAVE 996: ZONE MUTEX - THE LADDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔒 EFFECT → ZONE MAP (THE LADDER - Equidistant 15% zones)
 * 
 * WAVE 996: Mapeo oficial de efectos a zonas energéticas.
 * Usado por el MUTEX para bloquear múltiples efectos en la misma zona.
 * 
 * Zones:
 * - silence  (0.00 - 0.15): Vacío profundo
 * - valley   (0.15 - 0.30): Niebla atmosférica
 * - ambient  (0.30 - 0.45): Movimiento suave
 * - gentle   (0.45 - 0.60): Entrada a energía
 * - active   (0.60 - 0.75): Ritmo establecido
 * - intense  (0.75 - 0.90): Pre-clímax
 * - peak     (0.90 - 1.00): Territorio de drops
 */
type EnergyZoneLadder = 'silence' | 'valley' | 'ambient' | 'gentle' | 'active' | 'intense' | 'peak'

const EFFECT_ZONE_MAP: Record<string, EnergyZoneLadder> = {
  // 🌑 SILENCE (0-15%): Respiración profunda y ecos minimalistas
  'deep_breath': 'silence',
  'sonar_ping': 'silence',
  
  // 🌫️ VALLEY (15-30%): Niebla y fibras - texturas atmosféricas pasivas
  'void_mist': 'valley',
  'fiber_optics': 'valley',
  
  // 🌧️ AMBIENT (30-45%): Lluvia digital y barridos ácidos - movimiento suave
  'digital_rain': 'ambient',
  'acid_sweep': 'ambient',
  
  // ⚡ GENTLE (45-60%): Primeros flashes y glitches - entrada a energía
  'ambient_strobe': 'gentle',
  'binary_glitch': 'gentle',
  
  // 👯 ACTIVE (60-75%): Dualismo cibernético y snaps sísmicos - ritmo establecido
  'cyber_dualism': 'active',
  'seismic_snap': 'active',
  
  // ☢️ INTENSE (75-90%): Sierra celestial y ascenso abismal - pre-clímax
  'sky_saw': 'intense',
  'abyssal_rise': 'intense',
  
  // 💣 PEAK (90-100%): Artillería pesada - territorio de drops
  'gatling_raid': 'peak',
  'core_meltdown': 'peak',
  'industrial_strobe': 'peak',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020: POP-ROCK LEGENDS - Zone Mapping
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 AMP_HEAT (valley): Válvulas calientes - intros/versos íntimos
  'amp_heat': 'valley',
  
  // 🌊 ARENA_SWEEP (ambient→active): El pan y mantequilla - 80% del show
  'arena_sweep': 'ambient',
  
  // 🎸 LIQUID_SOLO (active→intense): Spotlight del guitarrista - solos emotivos
  'liquid_solo': 'active',
  
  // ⚡ THUNDER_STRUCK (intense→peak): Stadium blinder - drops de estribillo
  'thunder_struck': 'intense',
  
  // 😵 FEEDBACK_STORM (peak): Caos visual - harshness reactive
  'feedback_storm': 'peak',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - Zone Mapping
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 STAGE_WASH (valley→ambient): Respiro cálido - transiciones/intros
  'stage_wash': 'ambient',
  
  // 💡 SPOTLIGHT_PULSE (active): Pulso emotivo - builds contemplativos
  'spotlight_pulse': 'active',
  
  // ⚡ POWER_CHORD (intense): Golpe del acorde - downbeats/drops
  'power_chord': 'intense',
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1070: THE LIVING OCEAN - Zone Mapping
  // ═══════════════════════════════════════════════════════════════════════════
  // ☀️ SOLAR_CAUSTICS (silence→valley): Rayos de sol en aguas someras
  'solar_caustics': 'silence',
  
  // 🐠 SCHOOL_OF_FISH (ambient): Cardumen cruzando el océano abierto
  'school_of_fish': 'ambient',
  
  // 🪼 ABYSSAL_JELLYFISH (valley): Medusas bioluminiscentes en el abismo
  'abyssal_jellyfish': 'valley',
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MANAGER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class EffectManager extends EventEmitter {
  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Registry de factories de efectos */
  private effectFactories: Map<string, EffectFactory> = new Map()
  
  /** Efectos actualmente activos */
  private activeEffects: Map<string, ILightEffect> = new Map()
  
  /** Stats */
  private stats = {
    totalTriggered: 0,
    lastTriggered: null as string | null,
    lastTriggerTime: 0,
  }
  
  /** Frame timing */
  private lastUpdateTime = Date.now()
  
  // ─────────────────────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────────────────────
  
  constructor() {
    super()
    this.registerBuiltinEffects()
    console.log('[EffectManager 🎛️] Initialized with built-in effects')
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🧨 TRIGGER - Dispara un efecto
   * 
   * 🛡️ WAVE 680: THE SHIELD integrado
   * 🚦 WAVE 700.7: TRAFFIC CONTROL integrado
   * 
   * Antes de disparar:
   * 1. Valida permisos del Vibe activo (THE SHIELD)
   * 2. Verifica si hay efectos críticos activos (TRAFFIC LIGHT)
   * 3. Evita duplicados del mismo tipo
   * 
   * @param config Configuración del disparo
   * @returns ID de la instancia del efecto, o null si bloqueado/falla
   */
  trigger(config: EffectTriggerConfig): string | null {
    const factory = this.effectFactories.get(config.effectType)
    
    if (!factory) {
      console.warn(`[EffectManager ⚠️] Unknown effect type: ${config.effectType}`)
      return null
    }
    
    // 🚦 WAVE 700.7: TRAFFIC CONTROL - Check if busy with critical effect
    const trafficResult = this.checkTraffic(config.effectType)
    if (!trafficResult.allowed) {
      console.log(`[EffectManager 🚦] ${config.effectType} BLOCKED: ${trafficResult.reason}`)
      this.emit('effectBlocked', {
        effectType: config.effectType,
        vibeId: config.musicalContext?.vibeId || 'unknown',
        reason: trafficResult.reason,
      })
      return null
    }
    
    // 🛡️ THE SHIELD - Validar permisos del Vibe
    const vibeId = config.musicalContext?.vibeId || this.getCurrentVibeId()
    const shieldResult = this.validateWithShield(config.effectType, vibeId)
    
    if (!shieldResult.allowed) {
      console.log(`[EffectManager ⛔] ${config.effectType} BLOCKED in ${vibeId}. ${shieldResult.message}`)
      this.emit('effectBlocked', {
        effectType: config.effectType,
        vibeId,
        reason: shieldResult.message,
      })
      return null
    }
    
    // Crear nueva instancia
    const effect = factory()
    
    // 🛡️ Si está degradado, aplicar constraints
    if (shieldResult.degraded && shieldResult.constraints) {
      this.applyShieldConstraints(effect, shieldResult.constraints)
      console.log(`[EffectManager ⚠️] ${config.effectType} DEGRADED in ${vibeId}. ${shieldResult.message}`)
    }
    
    // Disparar
    effect.trigger(config)
    
    // Registrar como activo
    this.activeEffects.set(effect.id, effect)
    
    // Stats
    this.stats.totalTriggered++
    this.stats.lastTriggered = config.effectType
    this.stats.lastTriggerTime = Date.now()
    
    // Emit event
    this.emit('effectTriggered', {
      effectId: effect.id,
      effectType: config.effectType,
      intensity: config.intensity,
      source: config.source,
      vibeId,
      degraded: shieldResult.degraded,
    })
    
    // 🛡️ WAVE 811: Log ÚNICO de ejecución - LA VOZ DEL EJECUTOR
    // Incluye: efecto, vibe, source, degraded, intensidad, z-score
    const shieldStatus = shieldResult.degraded ? '⚠️DEGRADED' : ''
    const zInfo = config.musicalContext?.zScore 
      ? `Z:${config.musicalContext.zScore.toFixed(1)}` 
      : ''
    const sourceTag = config.source ? `[${config.source}]` : ''
    console.log(`[EffectManager 🔥] ${config.effectType} FIRED ${sourceTag} in ${vibeId} ${shieldStatus} | I:${config.intensity.toFixed(2)} ${zInfo}`)
    
    return effect.id
  }
  
  /**
   * 🔄 UPDATE - Actualiza todos los efectos activos
   * 
   * Llamar cada frame desde TitanEngine o el main loop.
   */
  update(): void {
    const now = Date.now()
    const deltaMs = now - this.lastUpdateTime
    this.lastUpdateTime = now
    
    // Update each active effect
    const toRemove: string[] = []
    
    for (const [id, effect] of this.activeEffects) {
      effect.update(deltaMs)
      
      if (effect.isFinished()) {
        toRemove.push(id)
      }
    }
    
    // Remove finished effects
    for (const id of toRemove) {
      this.activeEffects.delete(id)
      this.emit('effectFinished', { effectId: id })
    }
  }
  
  /**
   * 📤 GET COMBINED OUTPUT - Output combinado de todos los efectos activos
   * 
   * Combina usando:
   * - HTP (Highest Takes Precedence) para dimmer
   * - Mayor prioridad para color
   * - 🧨 WAVE 630: globalOverride bypasea zonas
   * - 🥁 WAVE 700.7: Mayor prioridad para movement
   * - 🎨 WAVE 725: zoneOverrides para pinceles finos
   */
  getCombinedOutput(): CombinedEffectOutput {
    if (this.activeEffects.size === 0) {
      return {
        hasActiveEffects: false,
        intensity: 0,
        contributingEffects: [],
      }
    }
    
    let maxDimmer = 0
    let maxWhite = 0
    let maxAmber = 0  // 🧨 WAVE 630
    let maxStrobeRate = 0
    let maxIntensity = 0
    let globalOverride = false  // 🧨 WAVE 630
    let highestPriorityColor: { h: number; s: number; l: number } | undefined
    let highestPriority = -1  // Para color (legacy)
    // 🚂 WAVE 800: Mix Bus del efecto dominante
    let dominantMixBus: 'htp' | 'global' = 'htp'
    // 🔗 WAVE 991: Prioridad separada para mixBus (THE MISSING LINK)
    let mixBusPriority = -1
    // 🥁 WAVE 700.7: Movement tracking
    let highestPriorityMovement: { pan?: number; tilt?: number; isAbsolute?: boolean; speed?: number } | undefined
    let movementPriority = -1
    // 🌴 WAVE 700.8: Zone tracking
    const allZones = new Set<EffectZone>()
    const contributing: string[] = []
    
    // 🎨 WAVE 725: Zone overrides acumulados de todos los efectos
    // Estructura: { [zoneId]: { color?, dimmer?, white?, amber?, movement?, priority } }
    const combinedZoneOverrides: CombinedEffectOutput['zoneOverrides'] = {}
    
    for (const [id, effect] of this.activeEffects) {
      const output = effect.getOutput()
      if (!output) continue
      
      contributing.push(id)
      
      // HTP for dimmer
      if (output.dimmerOverride !== undefined && output.dimmerOverride > maxDimmer) {
        maxDimmer = output.dimmerOverride
      }
      
      // HTP for white
      if (output.whiteOverride !== undefined && output.whiteOverride > maxWhite) {
        maxWhite = output.whiteOverride
      }
      
      // 🧨 WAVE 630: HTP for amber
      if (output.amberOverride !== undefined && output.amberOverride > maxAmber) {
        maxAmber = output.amberOverride
      }
      
      // Max strobe rate
      if (output.strobeRate !== undefined && output.strobeRate > maxStrobeRate) {
        maxStrobeRate = output.strobeRate
      }
      
      // Max intensity
      if (output.intensity > maxIntensity) {
        maxIntensity = output.intensity
      }
      
      // 🧨 WAVE 630: Global override - cualquier efecto con globalOverride activa el bypass
      if (output.globalOverride) {
        globalOverride = true
      }
      
      // Highest priority takes color (legacy fallback)
      if (output.colorOverride && effect.priority > highestPriority) {
        highestPriority = effect.priority
        highestPriorityColor = output.colorOverride
      }
      
      // � WAVE 991: THE MISSING LINK - El efecto de mayor prioridad determina el mixBus
      // CRÍTICO: Usar variable SEPARADA (mixBusPriority) para no depender de colorOverride
      // REGLA: Si hay empate de prioridad Y uno es 'global', el 'global' SIEMPRE gana
      if (effect.priority > mixBusPriority || 
          (effect.priority === mixBusPriority && effect.mixBus === 'global')) {
        mixBusPriority = effect.priority
        dominantMixBus = effect.mixBus
      }
      
      // 🥁 WAVE 700.7: Highest priority takes movement
      if (output.movement && effect.priority > movementPriority) {
        movementPriority = effect.priority
        highestPriorityMovement = output.movement
      }
      
      // 🌴 WAVE 700.8: Collect zones
      if (output.zones && output.zones.length > 0) {
        output.zones.forEach(z => allZones.add(z))
      }
      
      // 🎨 WAVE 725: ZONE OVERRIDES - "PINCELES FINOS"
      // Procesar zoneOverrides del efecto y mezclarlos con HTP/LTP
      if (output.zoneOverrides) {
        // Tipar explícitamente para evitar errores de TypeScript
        type ZoneOverrideData = {
          color?: { h: number; s: number; l: number }
          dimmer?: number
          white?: number
          amber?: number
          movement?: { pan?: number; tilt?: number; isAbsolute?: boolean; speed?: number }
        }
        
        const zoneEntries = Object.entries(output.zoneOverrides) as [string, ZoneOverrideData][]
        
        for (const [zoneId, zoneData] of zoneEntries) {
          if (!combinedZoneOverrides[zoneId]) {
            // Primera vez que vemos esta zona - inicializar
            combinedZoneOverrides[zoneId] = {
              priority: effect.priority,
            }
          }
          
          const existing = combinedZoneOverrides[zoneId]
          const existingPriority = existing.priority ?? -1
          
          // HTP para dimmer (el más alto gana)
          if (zoneData.dimmer !== undefined) {
            if (existing.dimmer === undefined || zoneData.dimmer > existing.dimmer) {
              existing.dimmer = zoneData.dimmer
            }
          }
          
          // HTP para white (el más alto gana)
          if (zoneData.white !== undefined) {
            if (existing.white === undefined || zoneData.white > existing.white) {
              existing.white = zoneData.white
            }
          }
          
          // HTP para amber (el más alto gana)
          if (zoneData.amber !== undefined) {
            if (existing.amber === undefined || zoneData.amber > existing.amber) {
              existing.amber = zoneData.amber
            }
          }
          
          // LTP para color (mayor prioridad gana)
          if (zoneData.color && effect.priority >= existingPriority) {
            existing.color = zoneData.color
            existing.priority = effect.priority
          }
          
          // LTP para movement (mayor prioridad gana)
          if (zoneData.movement && effect.priority >= existingPriority) {
            existing.movement = zoneData.movement
          }
          
          // Agregar zona al set
          allZones.add(zoneId as EffectZone)
        }
      }
    }
    
    // 🎨 WAVE 725: Determinar si hay zone overrides activos
    const hasZoneOverrides = Object.keys(combinedZoneOverrides).length > 0
    
    return {
      hasActiveEffects: true,
      mixBus: dominantMixBus,  // 🚂 WAVE 800: Railway Switch
      dimmerOverride: maxDimmer > 0 ? maxDimmer : undefined,
      whiteOverride: maxWhite > 0 ? maxWhite : undefined,
      amberOverride: maxAmber > 0 ? maxAmber : undefined,  // 🧨 WAVE 630
      colorOverride: highestPriorityColor,  // Legacy fallback
      strobeRate: maxStrobeRate > 0 ? maxStrobeRate : undefined,
      intensity: maxIntensity,
      contributingEffects: contributing,
      globalOverride: globalOverride,  // 🧨 WAVE 630
      zones: allZones.size > 0 ? Array.from(allZones) : undefined,  // 🌴 WAVE 700.8
      movementOverride: highestPriorityMovement,  // 🥁 WAVE 700.7
      zoneOverrides: hasZoneOverrides ? combinedZoneOverrides : undefined,  // 🎨 WAVE 725
    }
  }
  
  /**
   * 📊 GET STATE - Estado actual del manager
   */
  getState(): EffectManagerState {
    return {
      activeCount: this.activeEffects.size,
      activeEffects: Array.from(this.activeEffects.keys()),
      lastTriggered: this.stats.lastTriggered,
      lastTriggerTime: this.stats.lastTriggerTime,
      totalTriggered: this.stats.totalTriggered,
    }
  }
  
  /**
   * ⛔ ABORT ALL - Aborta todos los efectos activos
   */
  abortAll(): void {
    for (const effect of this.activeEffects.values()) {
      effect.abort()
    }
    this.activeEffects.clear()
    console.log('[EffectManager ⛔] All effects aborted')
  }
  
  /**
   * ⛔ ABORT - Aborta un efecto específico
   */
  abort(effectId: string): boolean {
    const effect = this.activeEffects.get(effectId)
    if (effect) {
      effect.abort()
      this.activeEffects.delete(effectId)
      return true
    }
    return false
  }
  
  /**
   * 📋 LIST AVAILABLE - Lista tipos de efectos disponibles
   */
  getAvailableEffects(): string[] {
    return Array.from(this.effectFactories.keys())
  }
  
  /**
   * 🔌 REGISTER EFFECT - Registra un nuevo tipo de efecto
   */
  registerEffect(effectType: string, factory: EffectFactory): void {
    this.effectFactories.set(effectType, factory)
    console.log(`[EffectManager 🔌] Registered effect: ${effectType}`)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Built-in effects registration
  // ─────────────────────────────────────────────────────────────────────────
  
  private registerBuiltinEffects(): void {
    // ☀️ Solar Flare - WAVE 600
    this.effectFactories.set('solar_flare', () => new SolarFlare())
    
    // ⚡ Strobe Storm - WAVE 680 (harsh, for rock/techno)
    this.effectFactories.set('strobe_storm', () => new StrobeStorm())
    
    // 🔥 Strobe Burst - WAVE 691 (rhythmic, for latina/festive)
    this.effectFactories.set('strobe_burst', () => new StrobeBurst())
    
    // 🌊 Tidal Wave - WAVE 680
    this.effectFactories.set('tidal_wave', () => new TidalWave())
    
    // 👻 Ghost Breath - WAVE 680
    this.effectFactories.set('ghost_breath', () => new GhostBreath())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎺 WAVE 692: FIESTA LATINA ARSENAL
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🌴 Tropical Pulse - Crescendo bursts like conga rhythm
    this.effectFactories.set('tropical_pulse', () => new TropicalPulse())
    
    // 🔥 Salsa Fire - Organic fire flicker effect  
    this.effectFactories.set('salsa_fire', () => new SalsaFire())
    
    // 🌙 Cumbia Moon - Soft breathing glow for breakdowns
    this.effectFactories.set('cumbia_moon', () => new CumbiaMoon())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🥁 WAVE 700.6: NEW LATINA EFFECT
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🥁 Clave Rhythm - 3-2 pattern with color + movement
    this.effectFactories.set('clave_rhythm', () => new ClaveRhythm())
    
    // ═══════════════════════════════════════════════════════════════════════
    // ❤️ WAVE 750: THE ARCHITECT'S SOUL
    // ═══════════════════════════════════════════════════════════════════════
    
    // ❤️ Corazón Latino - Heartbeat passion effect for epic moments
    this.effectFactories.set('corazon_latino', () => new CorazonLatino())
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🆕 WAVE 1010.5: THE LOST FOUR - Los 4 Huérfanos Conectados
    // ═══════════════════════════════════════════════════════════════════════════
    // Estos efectos existían en DreamSimulator pero NO estaban registrados aquí.
    // Por eso ganaban simulaciones pero nunca disparaban. THE PURGE los encontró.
    
    // 🌿 Amazon Mist - Neblina amazónica para zonas silence/valley
    this.effectFactories.set('amazon_mist', () => new AmazonMist())
    
    // ⚔️ Machete Spark - Chispa de machete para active zone
    this.effectFactories.set('machete_spark', () => new MacheteSpark())
    
    // 🪘 Glitch Guaguanco - Digital glitch con ritmo cubano para active zone
    this.effectFactories.set('glitch_guaguanco', () => new GlitchGuaguanco())
    
    // 💥 Latina Meltdown - LA BESTIA LATINA para peak zone
    this.effectFactories.set('latina_meltdown', () => new LatinaMeltdown())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
    // 🤖 WAVE 810: UNLOCK THE TWINS
    // 🔫 WAVE 930: ARSENAL PESADO
    // ═══════════════════════════════════════════════════════════════════════
    
    // ⚡ Industrial Strobe - The hammer that strikes steel
    this.effectFactories.set('industrial_strobe', () => new IndustrialStrobe())
    
    // 🧪 Acid Sweep - Volumetric blade of light
    this.effectFactories.set('acid_sweep', () => new AcidSweep())
    
    // 🤖 Cyber Dualism - The ping-pong twins (L/R spatial targeting)
    this.effectFactories.set('cyber_dualism', () => new CyberDualism())
    
    // 🔫 Gatling Raid - Machine gun PAR barrage
    this.effectFactories.set('gatling_raid', () => new GatlingRaid())
    
    // 🗡️ Sky Saw - Aggressive mover cuts
    this.effectFactories.set('sky_saw', () => new SkySaw())
    
    // 🌪️ Abyssal Rise - Epic 8-bar transition
    this.effectFactories.set('abyssal_rise', () => new AbyssalRise())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🌫️ Void Mist - Purple fog with breathing
    this.effectFactories.set('void_mist', () => new VoidMist())
    
    // 🔪 WAVE 986: static_pulse PURGED - replaced by binary_glitch + seismic_snap
    
    // 💧 Digital Rain - Matrix flicker (cyan/lime)
    this.effectFactories.set('digital_rain', () => new DigitalRain())
    
    // 🫁 Deep Breath - Organic 4-bar breathing (blue/purple)
    this.effectFactories.set('deep_breath', () => new DeepBreath())
    
    // ═══════════════════════════════════════════════════════════════════════
    // ⚡ WAVE 977: LA FÁBRICA - Nuevos Efectos
    // ═══════════════════════════════════════════════════════════════════════
    
    // 📸 Ambient Strobe - Flashes dispersos tipo cámara de estadio (gentle/active zone)
    this.effectFactories.set('ambient_strobe', () => new AmbientStrobe())
    
    // 🔵 Sonar Ping - Ping submarino back→front (silence/valley zone)
    this.effectFactories.set('sonar_ping', () => new SonarPing())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔪 WAVE 986: ACTIVE REINFORCEMENTS - Nuevas armas rápidas
    // ═══════════════════════════════════════════════════════════════════════
    
    // ⚡ Binary Glitch - Tartamudeo de código morse corrupto (active zone)
    this.effectFactories.set('binary_glitch', () => new BinaryGlitch())
    
    // 💥 Seismic Snap - Golpe físico de luz tipo obturador (active/intense zone)
    this.effectFactories.set('seismic_snap', () => new SeismicSnap())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔮 WAVE 988: THE FINAL ARSENAL
    // ═══════════════════════════════════════════════════════════════════════
    
    // 🌈 Fiber Optics - Traveling ambient colors (silence/valley/ambient)
    this.effectFactories.set('fiber_optics', () => new FiberOptics())
    
    // ☢️ Core Meltdown - LA BESTIA extreme strobe (intense/peak)
    this.effectFactories.set('core_meltdown', () => new CoreMeltdown())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════
    
    // ⚡ Thunder Struck - Stadium blinder para drops de estribillo
    this.effectFactories.set('thunder_struck', () => new ThunderStruck())
    
    // 🎸 Liquid Solo - Spotlight del guitarrista, MoverR rápido, MoverL estable
    this.effectFactories.set('liquid_solo', () => new LiquidSolo())
    
    // 🔥 Amp Heat - Válvulas calientes respirando, intros/versos íntimos
    this.effectFactories.set('amp_heat', () => new AmpHeat())
    
    // 🌊 Arena Sweep - El barrido de Wembley, vShape con inercia
    this.effectFactories.set('arena_sweep', () => new ArenaSweep())
    
    // 😵 Feedback Storm - Caos visual, strobe random escalado por harshness
    this.effectFactories.set('feedback_storm', () => new FeedbackStorm())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════
    
    // ⚡ Power Chord - Flash + strobe rítmico, golpe del acorde
    this.effectFactories.set('power_chord', () => new PowerChord())
    
    // 🌊 Stage Wash - Respiro cálido amber, transiciones suaves
    this.effectFactories.set('stage_wash', () => new StageWash())
    
    // 💡 Spotlight Pulse - Breathing spotlight, pulso emotivo
    this.effectFactories.set('spotlight_pulse', () => new SpotlightPulse())
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌊 WAVE 1070: THE LIVING OCEAN - CHILL LOUNGE OCEANIC EFFECTS
    // ═══════════════════════════════════════════════════════════════════════
    
    // ☀️ Solar Caustics - Rayos de sol danzando en aguas someras
    this.effectFactories.set('solar_caustics', () => new SolarCaustics())
    
    // 🐠 School of Fish - Cardumen cruzando el océano abierto
    this.effectFactories.set('school_of_fish', () => new SchoolOfFish())
    
    // 🪼 Abyssal Jellyfish - Medusas bioluminiscentes del abismo
    this.effectFactories.set('abyssal_jellyfish', () => new AbyssalJellyfish())
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // � WAVE 700.7: TRAFFIC CONTROL - The Traffic Light
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🚦 CRITICAL EFFECT TYPES
   * Efectos que bloquean el tráfico mientras están activos.
   * Ningún otro efecto puede dispararse mientras hay uno crítico.
   * 
   * 🔥 WAVE 930.1 FIX: AbyssalRise REMOVIDO de CRITICAL
   * Razón: Es un efecto largo (~16s) que bloqueaba todo el sistema.
   * AbyssalRise usa mixBus='global' que ya garantiza control total del output,
   * no necesita además bloquear el traffic de otros efectos.
   */
  private static readonly CRITICAL_EFFECTS = new Set([
    'solar_flare',    // Takeover total - nada más puede competir
    'strobe_storm',   // Strobe intenso - no mezclar
    'blackout',       // Blackout manual
    // 'abyssal_rise' - REMOVIDO WAVE 930.1: mixBus='global' es suficiente
  ])
  
  /**
   * 🚦 AMBIENT EFFECT TYPES
   * Efectos que son bloqueados por efectos críticos Y no pueden duplicarse.
   */
  private static readonly AMBIENT_EFFECTS = new Set([
    'tropical_pulse',
    'clave_rhythm',
    'cumbia_moon',
    'salsa_fire',
    'ghost_breath',
    'tidal_wave',
    'strobe_burst',
  ])
  
  /**
   * 🚦 IS BUSY - Check if a critical effect is hogging the stage
   * 
   * @returns true if a critical effect is currently active
   */
  isBusy(): boolean {
    for (const effect of this.activeEffects.values()) {
      if (EffectManager.CRITICAL_EFFECTS.has(effect.effectType)) {
        return true
      }
    }
    return false
  }
  
  /**
   * 🚦 CHECK TRAFFIC - Full traffic control validation
   * 
   * Rules:
   * 0. 🔒 WAVE 998: GLOBAL LOCK - If DICTATOR (mixBus='global') is active → BLOCK ALL (except emergency)
   * 1. If a CRITICAL effect is active → block AMBIENT effects
   * 2. If same effectType is already active → block (no duplicates)
   * 3. 🔒 WAVE 996: ZONE MUTEX - If another effect from same zone is active → block
   * 4. 🌫️ WAVE 998: ATMOSPHERIC EXCLUSIVITY - Only one atmospheric at a time
   * 5. Otherwise → allow
   * 
   * @param effectType Effect type to check
   * @returns { allowed: boolean, reason: string }
   */
  private checkTraffic(effectType: string): { allowed: boolean; reason: string } {
    // 🔒 WAVE 998: Rule 0 - GLOBAL LOCK (THE RESPECT PROTOCOL)
    // Si hay un DICTADOR (mixBus='global') activo, NADIE le interrumpe
    const activeDictator = Array.from(this.activeEffects.values())
      .find(e => (e as any).mixBus === 'global')
    
    if (activeDictator) {
      // Excepción: Si el candidato es PEAK/EMERGENCY (techno-extreme)
      const isEmergency = ['solar_flare', 'strobe_storm'].includes(effectType)
      const dictatorIsPeak = ['solar_flare', 'strobe_storm'].includes(activeDictator.effectType)
      
      if (!isEmergency || dictatorIsPeak) {
        console.log(`🔒 [GLOBAL_LOCK] ${effectType} BLOQUEADO: ${activeDictator.effectType} tiene la palabra.`)
        return {
          allowed: false,
          reason: `🔒 GLOBAL_LOCK: ${activeDictator.effectType} (dictator) is speaking`,
        }
      }
    }
    
    // Rule 1: Critical effects block ambient
    if (this.isBusy() && EffectManager.AMBIENT_EFFECTS.has(effectType)) {
      const criticalEffect = Array.from(this.activeEffects.values())
        .find(e => EffectManager.CRITICAL_EFFECTS.has(e.effectType))
      return {
        allowed: false,
        reason: `Blocked by critical effect: ${criticalEffect?.effectType || 'unknown'}`,
      }
    }
    
    // Rule 2: No duplicates
    const isDuplicate = Array.from(this.activeEffects.values())
      .some(e => e.effectType === effectType)
    if (isDuplicate) {
      return {
        allowed: false,
        reason: `Duplicate blocked: ${effectType} already active`,
      }
    }
    
    // 🌫️ WAVE 998: Rule 3 - ATMOSPHERIC EXCLUSIVITY
    // Solo un efecto atmosférico a la vez
    const ATMOSPHERIC_EFFECTS = ['void_mist', 'deep_breath', 'sonar_ping', 'fiber_optics', 'digital_rain']
    const isAtmospheric = ATMOSPHERIC_EFFECTS.includes(effectType)
    
    if (isAtmospheric) {
      const atmosphericRunning = Array.from(this.activeEffects.values())
        .find(e => ATMOSPHERIC_EFFECTS.includes(e.effectType))
      
      if (atmosphericRunning) {
        console.log(`🌫️ [ATMOSPHERIC_LOCK] ${effectType} BLOQUEADO: ${atmosphericRunning.effectType} ya está en el aire.`)
        return {
          allowed: false,
          reason: `🌫️ ATMOSPHERIC_LOCK: ${atmosphericRunning.effectType} already running`,
        }
      }
    }
    
    // 🔒 WAVE 996: Rule 4 - ZONE MUTEX
    // Solo un efecto por zona energética a la vez
    const incomingZone = EFFECT_ZONE_MAP[effectType]
    if (incomingZone) {
      const zoneConflict = Array.from(this.activeEffects.values())
        .find(e => EFFECT_ZONE_MAP[e.effectType] === incomingZone)
      
      if (zoneConflict) {
        return {
          allowed: false,
          reason: `🔒 MUTEX: Zone ${incomingZone} occupied by ${zoneConflict.effectType}`,
        }
      }
    }
    
    // All clear
    return { allowed: true, reason: 'OK' }
  }
  
  /**
   * 🚦 GET ACTIVE EFFECT TYPES
   * Returns list of currently active effect type names.
   */
  getActiveEffectTypes(): string[] {
    return Array.from(this.activeEffects.values()).map(e => e.effectType)
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // �🛡️ THE SHIELD - Vibe Permission System (WAVE 680)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🛡️ GET CURRENT VIBE ID
   * 
   * Obtiene el Vibe activo del VibeManager singleton.
   */
  private getCurrentVibeId(): string {
    try {
      return VibeManager.getInstance().getActiveVibe().id
    } catch {
      return 'idle'  // Fallback si VibeManager no está inicializado
    }
  }
  
  /**
   * 🛡️ VALIDATE WITH SHIELD
   * 
   * Valida si un efecto está permitido en el Vibe actual.
   * 
   * REGLAS:
   * - chill-lounge: BLOQUEO TOTAL de efectos dinámicos
   * - fiesta-latina: strobe PROHIBIDO (degradado a pulsos)
   * - techno-club: SIN RESTRICCIONES
   * - pop-rock: strobe con límite de 10Hz
   * - idle: BLOQUEO TOTAL (no hay show)
   */
  private validateWithShield(effectType: string, vibeId: string): ShieldValidation {
    const rules = EFFECT_VIBE_RULES[effectType]
    
    // Si no hay reglas para este efecto, permitir
    if (!rules) {
      return { allowed: true, degraded: false, message: 'No rules defined' }
    }
    
    // Obtener restricciones del Vibe
    let vibeEffects: { allowed: string[]; maxStrobeRate: number; maxIntensity: number }
    
    try {
      const vibe = VibeManager.getInstance().getActiveVibe()
      vibeEffects = {
        allowed: vibe.effects.allowed,
        maxStrobeRate: vibe.effects.maxStrobeRate,
        maxIntensity: vibe.effects.maxIntensity,
      }
    } catch {
      // Fallback restrictivo si VibeManager falla
      vibeEffects = { allowed: [], maxStrobeRate: 0, maxIntensity: 0 }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 1: chill-lounge = CHILL SHIELD (whitelist + blacklist)
    // 🌊 WAVE 1070: THE LIVING OCEAN
    // ═══════════════════════════════════════════════════════════════
    if (vibeId === 'chill-lounge') {
      // PRIORITY 1: Block explicitly forbidden effects
      if (CHILL_LOUNGE_BLOCKED_EFFECTS.includes(effectType)) {
        return {
          allowed: false,
          degraded: false,
          message: `🛡️ CHILL SHIELD: "${effectType}" está BLOQUEADO en Chill Lounge (lista negra)`,
        }
      }
      
      // PRIORITY 2: Allow whitelisted effects
      if (CHILL_LOUNGE_ALLOWED_EFFECTS.includes(effectType)) {
        return {
          allowed: true,
          degraded: false,
          message: `🌊 LIVING OCEAN: "${effectType}" permitido en Chill Lounge`,
        }
      }
      
      // PRIORITY 3: Block anything dynamic not in whitelist
      if (rules.isDynamic) {
        return {
          allowed: false,
          degraded: false,
          message: `🛡️ CHILL SHIELD: Efecto dinámico "${effectType}" bloqueado (no está en whitelist)`,
        }
      }
      
      // Non-dynamic effects not in whitelist: block for safety
      return {
        allowed: false,
        degraded: false,
        message: `🛡️ CHILL SHIELD: "${effectType}" no está en whitelist de Chill Lounge`,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 1.5: idle = BLOQUEO TOTAL de dinámicos
    // ═══════════════════════════════════════════════════════════════
    if (vibeId === 'idle' && rules.isDynamic) {
      return {
        allowed: false,
        degraded: false,
        message: `Dynamic effects blocked in ${vibeId}`,
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 2: Strobe check - si maxStrobeRate = 0, degradar o bloquear
    // ═══════════════════════════════════════════════════════════════
    if (rules.requiresStrobe) {
      if (vibeEffects.maxStrobeRate === 0) {
        // fiesta-latina: degradar a pulsos simples (no strobe real)
        if (vibeId === 'fiesta-latina') {
          return {
            allowed: true,
            degraded: true,
            message: `Strobe degraded to pulses (no real strobe in ${vibeId})`,
            constraints: {
              maxStrobeRate: 0,
              maxIntensity: vibeEffects.maxIntensity,
            },
          }
        }
        // Otros vibes con maxStrobeRate=0: bloquear
        return {
          allowed: false,
          degraded: false,
          message: `Strobe effects blocked (maxStrobeRate=0)`,
        }
      }
      
      // Strobe permitido pero con límite de frecuencia
      return {
        allowed: true,
        degraded: vibeEffects.maxStrobeRate < 8,  // Degradado si <8Hz
        message: `Strobe allowed (max ${vibeEffects.maxStrobeRate}Hz)`,
        constraints: {
          maxStrobeRate: vibeEffects.maxStrobeRate,
          maxIntensity: vibeEffects.maxIntensity,
        },
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 3: Efectos dinámicos con maxIntensity < 0.5 = degradados
    // ═══════════════════════════════════════════════════════════════
    if (rules.isDynamic && vibeEffects.maxIntensity < 0.5) {
      return {
        allowed: true,
        degraded: true,
        message: `Effect intensity capped at ${vibeEffects.maxIntensity}`,
        constraints: {
          maxIntensity: vibeEffects.maxIntensity,
        },
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT: Permitido sin restricciones
    // ═══════════════════════════════════════════════════════════════
    return {
      allowed: true,
      degraded: false,
      message: 'No restrictions',
    }
  }
  
  /**
   * 🛡️ APPLY SHIELD CONSTRAINTS
   * 
   * Aplica constraints del Shield a un efecto antes de dispararlo.
   */
  private applyShieldConstraints(
    effect: ILightEffect, 
    constraints: { maxStrobeRate?: number; maxIntensity?: number }
  ): void {
    // Si el efecto tiene método setVibeConstraints, usarlo
    if ('setVibeConstraints' in effect && typeof (effect as any).setVibeConstraints === 'function') {
      const degraded = constraints.maxStrobeRate === 0
      ;(effect as any).setVibeConstraints(constraints.maxStrobeRate ?? 15, degraded)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let effectManagerInstance: EffectManager | null = null

/**
 * Obtiene el singleton del EffectManager
 */
export function getEffectManager(): EffectManager {
  if (!effectManagerInstance) {
    effectManagerInstance = new EffectManager()
  }
  return effectManagerInstance
}

/**
 * Reset del singleton (para tests)
 */
export function resetEffectManager(): void {
  if (effectManagerInstance) {
    effectManagerInstance.abortAll()
  }
  effectManagerInstance = null
}
