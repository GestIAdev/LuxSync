/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CONTEXTUAL EFFECT SELECTOR - THE ARTISTIC BRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 685: CONTEXTUAL INTELLIGENCE
 * WAVE 700.1: MOOD INTEGRATION
 * WAVE 931: ENERGY CONSCIOUSNESS Z-SCORE CAPPING
 * WAVE 933: EFFECT INTENSITY MAPPING - Zone-appropriate effect selection
 * 
 * "MG Music: Sonido e Iluminación Contextual IA"
 * 
 * Este módulo es EL CEREBRO ARTÍSTICO de Selene. Decide QUÉ efecto disparar
 * basándose en el contexto musical completo:
 * 
 * - Z-Score: ¿Qué tan intenso es el momento?
 * - Section Type: ¿Es buildup, drop, breakdown?
 * - Vibe: ¿Qué restricciones tenemos?
 * - Hunt Decision: ¿El cazador dice que es momento de atacar?
 * - Energy Trend: ¿Subiendo o bajando?
 * - 🎭 Mood: ¿Estamos en CALM, BALANCED o PUNK mode?
 * - 🔋 Energy Zone: ¿Silencio, valle, ambiente, activo, pico? (WAVE 933)
 * 
 * FILOSOFÍA:
 * - NO es aleatorio - es contextual
 * - NO es repetitivo - variamos los efectos
 * - NO es invasivo - respetamos el Vibe
 * - SÍ es musical - respiramos con la canción
 * 
 * @module core/effects/ContextualEffectSelector
 * @version WAVE 685, 700.1
 */

import type { MusicalContext } from '../protocol/MusicalContext'
import type { HuntDecision } from '../intelligence/think/HuntEngine'
import type { FuzzyDecision } from '../intelligence/think/FuzzyDecisionMaker'
import { MoodController } from '../mood'
// 🔋 WAVE 931: Import EnergyZone para consciencia energética
import type { EnergyZone, EnergyContext } from '../protocol/MusicalContext'
// 🎨 WAVE 1028: THE CURATOR - Spectral Texture Awareness
import type { SpectralTexture, SpectralContext } from '../protocol/MusicalContext'
// 🚨 WAVE 1004.2: DNA Diversity System - Shadowban por repetición
import { getDNAAnalyzer } from '../intelligence/dna'

// ═══════════════════════════════════════════════════════════════════════════
// 🔪 WAVE 1010.5: TYPES PURGED
// ═══════════════════════════════════════════════════════════════════════════
// REMOVED: ContextualEffectSelection (solo usado por select() deprecated)
// REMOVED: ContextualSelectorInput (solo usado por select() deprecated)
// Este módulo ahora es PURO REPOSITORIO - no toma decisiones.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

interface EffectSelectionConfig {
  /** Cooldown mínimo entre efectos (ms) */
  minCooldownMs: number
  
  /** Cooldown extra si es el mismo efecto */
  sameEffectCooldownMs: number
  
  /** 🌊 WAVE 691: Cooldowns específicos por tipo de efecto */
  effectTypeCooldowns: Record<string, number>
  
  /** 🌊 WAVE 691: Umbral de energía mínima para bloquear efectos ambientales */
  ambientBlockEnergyThreshold: number
  
  /** Umbrales de Z-Score para cada nivel */
  zScoreThresholds: {
    normal: number      // < este = normal
    elevated: number    // >= este = elevated
    epic: number        // >= este = epic (drop territory)
    divine: number      // >= este = solar flare obligatorio
  }
  
  /** Umbral de confianza mínima del Hunt para disparar */
  minHuntConfidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚪 WAVE 812: THE TIMEKEEPER - FUENTE DE VERDAD DEL TIEMPO
// ═══════════════════════════════════════════════════════════════════════════
// Exportada para que cualquier módulo pueda consultar los cooldowns oficiales
// NOTA: El MoodController MULTIPLICA estos valores según el mood actual
//       - CALM: 3.0x (muy conservador)
//       - BALANCED: 1.5x (equilibrado)
//       - PUNK: 0.7x (agresivo)

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 WAVE 1179: DICTATOR HARD MINIMUM COOLDOWNS
// ═══════════════════════════════════════════════════════════════════════════
// Estos son cooldowns ABSOLUTOS que ni siquiera el DNA puede saltarse.
// Los efectos dictadores (mixBus='global') son de LARGO DURACIÓN y si se
// disparan 2x en 10 segundos el show se vuelve un caos sin sentido.
//
// FILOSOFÍA: Un dictador tiene el escenario. Cuando termina, necesita
// un RESPIRO MÍNIMO antes de que otro dictador pueda hablar.
// ═══════════════════════════════════════════════════════════════════════════
export const DICTATOR_HARD_MINIMUM_COOLDOWNS: Record<string, number> = {
  // DICTADORES TECHNO (mixBus='global')
  'abyssal_rise': 20000,      // 20s MÍNIMO ABSOLUTO (efecto de 4-5s + respiro)
  'gatling_raid': 15000,      // 15s MÍNIMO ABSOLUTO (efecto de 1.6s + respiro)
  'industrial_strobe': 8000,  // 8s MÍNIMO ABSOLUTO (efecto de ~0.5s pero es STROBE)
  'core_meltdown': 25000,     // 25s MÍNIMO ABSOLUTO (LA BESTIA necesita espacio)
  // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE (dictadores APEX)
  'neon_blinder': 12000,       // 12s MÍNIMO ABSOLUTO (flash wall, espacio entre impactos)
  'surgical_strike': 10000,    // 10s MÍNIMO ABSOLUTO (bisturí rápido, pero no spam)
  // DICTADORES LATINOS (mixBus='global')
  'solar_flare': 20000,       // 20s MÍNIMO ABSOLUTO
  'strobe_storm': 18000,      // 18s MÍNIMO ABSOLUTO
  'latina_meltdown': 25000,   // 25s MÍNIMO ABSOLUTO
}

export const EFFECT_COOLDOWNS: Record<string, number> = {
  // === EFECTOS HÍBRIDOS (Solomillo - mueven todo el escenario) ===
  'cumbia_moon': 25000,      // 25s base → CALM:75s, BALANCED:37s, PUNK:17s
  'tropical_pulse': 28000,   // 28s base → CALM:84s, BALANCED:42s, PUNK:19s
  'salsa_fire': 18000,       // 18s base → CALM:54s, BALANCED:27s, PUNK:12s
  'clave_rhythm': 22000,     // 22s base → CALM:66s, BALANCED:33s, PUNK:15s
  
  // === EFECTOS IMPACTO (Plato fuerte ocasional) ===
  'solar_flare': 30000,      // 30s base → CALM:90s, BALANCED:45s, PUNK:21s
  'strobe_burst': 25000,     // 25s base → Bloqueado en CALM
  'strobe_storm': 40000,     // 40s base → Bloqueado en CALM
  
  // === EFECTOS AMBIENTE (Relleno sutil) ===
  'ghost_breath': 35000,     // 35s base - fantasma raro
  'tidal_wave': 20000,       // 20s base - ola ocasional
  
  // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
  // 🔫 WAVE 930.3: ANTI-STROBE-SPAM - Aumentado de 2s a 10s
  // 🩸 WAVE 2103: THE REAL FIX - Cooldowns SLASHED for rotation
  // With BALANCED (1.5x), these become: strobe=12s, acid=12s, cyber=12s
  // That's 3 effects rotating every ~4s instead of silence.
  'industrial_strobe': 8000,   // 8s base → BALANCED:12s, PUNK:5.6s (was 10s)
  'acid_sweep': 8000,          // 8s base → BALANCED:12s, PUNK:5.6s (was 12s)
  
  // 🤖 WAVE 810: UNLOCK THE TWINS
  // 🩸 WAVE 2103: Slashed — 15s×1.5=22.5s was absurd for the bread-and-butter effect
  'cyber_dualism': 10000,      // 10s base → BALANCED:15s, PUNK:7s (was 15s)
  
  // 🔫 WAVE 930: ARSENAL PESADO
  // 🩸 WAVE 2103: Cooldowns reduced for rotation pool depth
  'gatling_raid': 8000,        // 8s base → BALANCED:12s (was 8s — kept)
  'sky_saw': 8000,             // 8s base → BALANCED:12s (was 10s)
  'abyssal_rise': 30000,       // 30s base → BALANCED:45s (was 45s — still rare)
  
  // 🌫️ WAVE 938 + 963: ATMOSPHERIC ARSENAL (cooldowns REDUCIDOS para rotation)
  // 🩸 WAVE 2103: Further reduced — these need to be part of the rotation pool
  'void_mist': 12000,          // 12s base → BALANCED:18s (was 15s)
  // 🔪 WAVE 986: static_pulse PURGED
  'digital_rain': 12000,       // 12s base → BALANCED:18s (was 18s)
  'deep_breath': 15000,        // 15s base → BALANCED:22s (was 20s)
  
  // ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
  'ambient_strobe': 14000,     // 14s base → Flashes dispersos gentle/active zone
  'sonar_ping': 25000,         // 25s base → Ping submarino silence/valley (efecto raro)
  
  // 🔪 WAVE 986: ACTIVE REINFORCEMENTS
  // 🩸 WAVE 2103: Reduced for rotation depth
  'binary_glitch': 8000,       // 8s base → BALANCED:12s (was 10s)
  'seismic_snap': 8000,        // 8s base → BALANCED:12s (was 12s)
  
  // 🔮 WAVE 988: THE FINAL ARSENAL
  'fiber_optics': 20000,       // 20s base → Traveling colors ambient (long effect, needs space)
  'core_meltdown': 30000,      // 30s base → LA BESTIA es RARA (epic moment only)
  
  // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
  'neon_blinder': 10000,        // 10s base → BALANCED:15s — flash wall, impactos espaciados
  'surgical_strike': 8000,      // 8s base → BALANCED:12s — bisturí rápido, parte de la rotación
  'ghost_chase': 18000,         // 18s base → BALANCED:27s — atmosférico, no spam
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
  // ═══════════════════════════════════════════════════════════════════════════
  'thunder_struck': 25000,     // 25s base → Stadium blinder, momentos épicos (no spam)
  'liquid_solo': 30000,        // 30s base → Spotlight del guitarrista (solos son raros)
  'amp_heat': 20000,           // 20s base → Válvulas calientes, más frecuente (ambiente)
  'arena_sweep': 15000,        // 15s base → El pan y mantequilla, frecuente pero no spam
  'feedback_storm': 35000,     // 35s base → Caos visual, muy raro (solo harshness alto)
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
  // ═══════════════════════════════════════════════════════════════════════════
  'power_chord': 20000,        // 20s base → Flash + strobe, golpes de acorde (moderado)
  'stage_wash': 25000,         // 25s base → Respiro cálido, transiciones (espaciado)
  'spotlight_pulse': 22000,    // 22s base → Pulso emotivo, builds (medio-frecuente)
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1071: THE LIVING OCEAN - CHILL LOUNGE ARSENAL
  // Cooldowns MUY largos - esto es una performance, no reactivo
  // ChillStereoPhysics tiene sus propios triggers, pero necesitan backup aquí
  // para evitar spam si el DreamEngine o algún otro sistema intenta forzarlos
  // ═══════════════════════════════════════════════════════════════════════════
  'solar_caustics': 45000,     // 45s base → Rayos de sol descendiendo lentamente
  'school_of_fish': 35000,     // 35s base → Cardumen cruzando el escenario
  'whale_song': 60000,         // 60s base → Ballenas son RARAS y majestuosas
  'abyssal_jellyfish': 90000,  // 90s base → Evento especial del abismo profundo
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 WAVE 1028: THE CURATOR - TEXTURE COMPATIBILITY METADATA
// ═══════════════════════════════════════════════════════════════════════════
// 
// EL PROBLEMA:
//   - Escenario: Solo de violín eléctrico (Alta Energía, Vibe Rock, Textura CLEAN)
//   - Error Actual: El selector ve "High Energy Rock" → FeedbackStorm (ruido visual)
//   - Resultado: El ruido visual MATA la elegancia del violín
//
// LA SOLUCIÓN: Cada efecto tiene texturas compatibles
//   - 'dirty' = Compatible con harsh/noisy (metal, distorsión, clipping)
//   - 'clean' = Compatible con clean/warm (piano, voz, jazz, violín)
//   - 'universal' = Compatible con cualquier textura
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 TEXTURE COMPATIBILITY TYPES
 * 
 * dirty: Solo dispara con harsh/noisy (texturas sucias)
 * clean: Solo dispara con clean/warm (texturas limpias)
 * universal: Dispara con cualquier textura
 */
export type TextureCompatibility = 'dirty' | 'clean' | 'universal'

/**
 * 🎨 EFFECT TEXTURE METADATA
 * 
 * Mapea cada efecto a su compatibilidad de textura.
 * Si un efecto no está en este mapa, se asume 'universal'.
 */
export const EFFECT_TEXTURE_COMPATIBILITY: Record<string, TextureCompatibility> = {
  // ═══════════════════════════════════════════════════════════════════════
  // 🔥 DIRTY/HARSH COMPATIBLE - Solo con texturas sucias
  // Efectos de caos, strobes agresivos, ruido visual
  // ═══════════════════════════════════════════════════════════════════════
  'feedback_storm': 'dirty',       // 😵 Caos visual - SOLO con distorsión/harshness
  'thunder_struck': 'dirty',       // ⚡ Stadium blinder - impacto agresivo
  'industrial_strobe': 'dirty',    // 🔨 El Martillo - techno sucio
  'strobe_storm': 'dirty',         // ⚡ Tormenta de strobes - chaos
  'gatling_raid': 'dirty',         // 🔫 Metralladora - industrial
  'core_meltdown': 'dirty',        // ☢️ LA BESTIA - extreme
  'binary_glitch': 'dirty',        // 💻 Digital glitch - solo con ruido
  'seismic_snap': 'dirty',         // 💥 Golpe mecánico - impacto
  'power_chord': 'dirty',          // ⚡ Flash + strobe - golpes de acorde

  // ═══════════════════════════════════════════════════════════════════════
  // 💎 CLEAN/LIQUID COMPATIBLE - Solo con texturas limpias
  // Efectos de elegancia, geometría, flujo
  // ═══════════════════════════════════════════════════════════════════════
  'liquid_solo': 'clean',          // 🎸 Spotlight guitarra - solos elegantes
  'arena_sweep': 'clean',          // 🌊 Barrido Wembley - geometría definida
  'amp_heat': 'clean',             // 🔥 Válvulas calientes - warmth
  'stage_wash': 'clean',           // 🌅 Respiro cálido - transiciones
  'spotlight_pulse': 'clean',      // 💡 Pulso emotivo - contemplativo
  'fiber_optics': 'clean',         // 🌈 Colores viajeros - elegante
  'deep_breath': 'clean',          // 🫁 Respiración - zen
  'cumbia_moon': 'clean',          // 🌙 Luna cumbianchera - suave
  'borealis_wave': 'clean',        // 🌌 Aurora - espacial suave
  'corazon_latino': 'clean',       // ❤️ Alma del arquitecto - emotivo

  // ═══════════════════════════════════════════════════════════════════════
  // 🌐 UNIVERSAL - Compatible con cualquier textura
  // Efectos versátiles que funcionan en cualquier contexto
  // ═══════════════════════════════════════════════════════════════════════
  'solar_flare': 'universal',      // ☀️ Explosión dorada - épico universal
  'strobe_burst': 'universal',     // 💥 Impacto puntual - versátil
  'tidal_wave': 'universal',       // 🌊 Ola oceánica - momentum
  'tropical_pulse': 'universal',   // 🌴 Pulso de conga - ritmo
  'salsa_fire': 'universal',       // 🔥 Fuego salsero - energía
  'clave_rhythm': 'universal',     // 🎶 Ritmo de clave - percusión
  'acid_sweep': 'universal',       // 🧪 Sweeps volumétricos - techno
  'sky_saw': 'universal',          // 🗡️ Cortes agresivos - tensión
  'cyber_dualism': 'universal',    // 🤖 L/R ping-pong - dinámico
  'ghost_breath': 'universal',     // 👻 Respiro oscuro - atmosférico
  'void_mist': 'universal',        // 🌫️ Neblina púrpura - ambiente
  'digital_rain': 'universal',     // 💧 Matrix flicker - ambiente
  'abyssal_rise': 'universal',     // 🌪️ Transición épica - buildup
  'ambient_strobe': 'universal',   // 📸 Camera flashes - suave
  'sonar_ping': 'universal',       // 🔊 Ping submarino - ambiente
  'neon_blinder': 'universal',     // ⚡ WAVE 2182: Flash wall masivo - funciona siempre
  'ghost_chase': 'universal',      // 👻 WAVE 2182: Ghost chase - atmósfera versátil
  'surgical_strike': 'dirty',      // 🎯 WAVE 2182: Bisturí en la oscuridad - solo con ruido
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌊 WAVE 1071: THE LIVING OCEAN - CHILL LOUNGE ARSENAL
  // Todos son CLEAN - la performance oceánica es pura elegancia
  // ═══════════════════════════════════════════════════════════════════════
  'solar_caustics': 'clean',       // ☀️ Rayos de sol descendiendo - contemplativo
  'school_of_fish': 'clean',       // 🐠 Cardumen atravesando - fluido
  'whale_song': 'clean',           // 🐋 Canto de ballena - majestuoso
  'abyssal_jellyfish': 'clean',    // 🪼 Medusas bioluminiscentes - etéreo
}

/**
 * 🎨 TEXTURE FILTER RESULT
 *
 * Resultado de aplicar el filtro de textura a un efecto.
 */
export interface TextureFilterResult {
  /** ¿El efecto pasa el filtro? */
  allowed: boolean
  /** Modificador de probabilidad (-1 a +1) */
  probabilityMod: number
  /** Razón del filtrado */
  reason: string
  /** Regla aplicada */
  rule: 'grime' | 'crystal' | 'warmth' | 'none'
}

const DEFAULT_CONFIG: EffectSelectionConfig = {
  minCooldownMs: 800,          // 0.8 segundos mínimo entre efectos
  sameEffectCooldownMs: 3000,  // 3 segundos si es el mismo efecto
  
  // 🚪 WAVE 812: Ahora usa la constante exportada
  effectTypeCooldowns: EFFECT_COOLDOWNS,
  
  // 🌊 WAVE 691: Si energy > 0.3, bloquear efectos ambientales (ghost_breath)
  ambientBlockEnergyThreshold: 0.3,
  
  zScoreThresholds: {
    normal: 1.5,
    elevated: 2.0,
    epic: 2.8,
    divine: 3.5,
  },
  minHuntConfidence: 0.6,
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MAPPING BY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎨 EFFECT PALETTE BY SECTION
 * 
 * Define qué efectos son apropiados para cada sección de la canción.
 * El selector elige de esta paleta basándose en intensidad y contexto.
 * 
 * � WAVE 692: FIESTA LATINA ARSENAL - Paleta expandida con nuevos efectos
 * - tropical_pulse: Crescendo bursts como ritmo de conga
 * - salsa_fire: Parpadeo orgánico de fuego  
 * - cumbia_moon: Respiro suave para breakdowns
 * 
 * �🌊 WAVE 691.5: PURGA - TidalWave y GhostBreath ELIMINADOS para Fiesta Latina
 * Estos efectos espaciales no funcionan con la arquitectura actual.
 */
const SECTION_EFFECT_PALETTE: Record<string, {
  primary: string      // Efecto principal para esta sección
  secondary: string    // Alternativa
  ambient: string      // Para momentos suaves dentro de la sección
  latinaOverride?: string  // Override para fiesta-latina
}> = {
  'intro': {
    primary: 'solar_flare',     
    secondary: 'tropical_pulse',  // 🌴 WAVE 692
    ambient: 'cumbia_moon',       // 🌙 WAVE 692
  },
  'verse': {
    primary: 'tropical_pulse',    // 🌴 WAVE 692: Pulsos como conga
    secondary: 'salsa_fire',      // 🔥 WAVE 692: Fuego orgánico
    ambient: 'cumbia_moon',       // 🌙 WAVE 692
  },
  'chorus': {
    primary: 'solar_flare',       // Momento épico
    secondary: 'strobe_burst',
    ambient: 'tropical_pulse',
    latinaOverride: 'tropical_pulse',  // 🌴 WAVE 692
  },
  'bridge': {
    primary: 'salsa_fire',        // 🔥 WAVE 692: Transición ardiente
    secondary: 'tropical_pulse',
    ambient: 'cumbia_moon',       // 🌙 WAVE 692
  },
  'buildup': {
    primary: 'tropical_pulse',    // 🌴 WAVE 692: Tensión creciente
    secondary: 'salsa_fire',
    ambient: 'strobe_burst',
  },
  'drop': {
    primary: 'solar_flare',       // BOOM
    secondary: 'strobe_burst',
    ambient: 'tropical_pulse',
    latinaOverride: 'strobe_burst',
  },
  'breakdown': {
    primary: 'cumbia_moon',       // 🌙 WAVE 692: Respiro suave
    secondary: 'salsa_fire',      // 🔥 WAVE 692
    ambient: 'cumbia_moon',
  },
  'outro': {
    primary: 'solar_flare',       
    secondary: 'cumbia_moon',     // 🌙 WAVE 692: Cierre suave
    ambient: 'cumbia_moon',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SELECTOR CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 CONTEXTUAL EFFECT SELECTOR
 * 
 * El cerebro artístico que decide qué efecto pintar en cada momento.
 * 
 * 🌊 WAVE 691: Ahora con cooldowns por tipo y protección anti-ghost
 * 🎭 WAVE 700.1: Integración con MoodController para cooldowns y blockList
 */
export class ContextualEffectSelector {
  private config: EffectSelectionConfig
  private consecutiveSameEffect = 0
  
  // 🌊 WAVE 691: Tracking de cooldowns por tipo de efecto
  private effectTypeLastFired: Map<string, number> = new Map()
  
  // 🎭 WAVE 700.1: Referencia al MoodController singleton
  private readonly moodController: MoodController
  
  constructor(config?: Partial<EffectSelectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.moodController = MoodController.getInstance()
  }
  
  /**
   * 🌊 WAVE 691: Registra que un efecto fue disparado
   * 🚨 WAVE 1004.2: También registra en DNAAnalyzer para Diversity Factor
   */
  public registerEffectFired(effectType: string): void {
    this.effectTypeLastFired.set(effectType, Date.now())
    
    // 🚨 WAVE 1004.2: DNA Diversity - Shadowban por repetición
    // Esto reducirá la relevancia del efecto si se usa repetidamente
    getDNAAnalyzer().recordEffectUsage(effectType)
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // � WAVE 1010: EFFECT REPOSITORY - The Librarian (demoted from decision maker)
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🔪 WAVE 1010: Get first available effect from an arsenal (for DIVINE moments)
   * 🎨 WAVE 1028: THE CURATOR - Now texture-aware
   * 
   * El General (DecisionMaker) ordena "DIVINE STRIKE" y proporciona un arsenal.
   * El Bibliotecario (este módulo) encuentra el primer efecto DISPONIBLE.
   * 
   * @param arsenal - Lista de efectos válidos para este momento (ordenados por preferencia)
   * @param vibeId - Vibe actual para verificar cooldowns
   * @param spectralContext - (WAVE 1028) Contexto espectral para filtrado por textura
   * @returns El primer efecto disponible, o null si todos están en cooldown
   */
  public getAvailableFromArsenal(
    arsenal: string[], 
    vibeId: string,
    spectralContext?: SpectralContext
  ): string | null {
    for (const effect of arsenal) {
      const availability = this.checkAvailability(effect, vibeId)
      if (!availability.available) continue
      
      // 🎨 WAVE 1028: THE CURATOR - Texture filtering
      if (spectralContext) {
        const textureResult = this.applyTextureFilter(effect, spectralContext)
        if (!textureResult.allowed) {
          console.log(`[EffectRepository 🎨] Arsenal TEXTURE BLOCKED: ${effect} (${textureResult.reason})`)
          continue
        }
      }
      
      console.log(`[EffectRepository 🔪] Arsenal selection: ${effect} AVAILABLE (from [${arsenal.join(', ')}])`)
      return effect
    }
    
    console.log(`[EffectRepository 🔪] Arsenal EXHAUSTED - all effects in cooldown or texture-blocked: [${arsenal.join(', ')}]`)
    return null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 WAVE 1028: THE CURATOR - Texture Filter System
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // 3 REGLAS DE CURADURÍA:
  //
  // 📜 REGLA DE LA SUCIEDAD (The Grime Rule):
  //    Si texture === 'harsh' o 'noisy':
  //    - 🚫 BAN: Efectos líquidos (LiquidSolo, ArenaSweep)
  //    - ✅ BOOST: Efectos de corte/strobe (ThunderStruck +30% prob)
  //
  // 💎 REGLA DEL CRISTAL (The Crystal Rule):
  //    Si clarity > 0.85 (Sonido HD):
  //    - 🚫 BAN: Efectos caóticos/random (Chaos, FeedbackStorm)
  //    - ✅ BOOST: Efectos de geometría definida (ArenaSweep, BeamAlign)
  //
  // 🔥 REGLA DE LA CALIDEZ (The Warmth Rule):
  //    Si texture === 'warm' (Bajo profundo, Jazz):
  //    - ✅ BOOST: Efectos lentos y atmosféricos (AmpHeat, DeepBreath)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 🎨 WAVE 1028: THE CURATOR - Apply Texture Filter
   * 
   * Evalúa si un efecto es apropiado para la textura espectral actual.
   * Implementa las 3 Reglas de Curaduría (Grime, Crystal, Warmth).
   * 
   * @param effectType - Efecto a evaluar
   * @param spectralContext - Contexto espectral del GodEar FFT
   * @returns TextureFilterResult con decisión y modificadores
   */
  public applyTextureFilter(
    effectType: string, 
    spectralContext: SpectralContext
  ): TextureFilterResult {
    const { texture, clarity, harshness } = spectralContext
    const compatibility = EFFECT_TEXTURE_COMPATIBILITY[effectType] || 'universal'
    
    // ═══════════════════════════════════════════════════════════════════════
    // 📜 REGLA DE LA SUCIEDAD (The Grime Rule)
    // Si texture === 'harsh' o 'noisy': BAN clean effects, BOOST dirty effects
    // ═══════════════════════════════════════════════════════════════════════
    if (texture === 'harsh' || texture === 'noisy') {
      // 🚫 BAN: Efectos líquidos/limpios NO van con texturas sucias
      if (compatibility === 'clean') {
        return {
          allowed: false,
          probabilityMod: -1.0,
          reason: `GRIME RULE: ${effectType} (clean) incompatible with ${texture} texture`,
          rule: 'grime'
        }
      }
      
      // ✅ BOOST: Efectos sucios van PERFECTO con texturas sucias
      if (compatibility === 'dirty') {
        return {
          allowed: true,
          probabilityMod: 0.30, // +30% probabilidad
          reason: `GRIME RULE: ${effectType} (dirty) BOOSTED for ${texture} texture`,
          rule: 'grime'
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 💎 REGLA DEL CRISTAL (The Crystal Rule)
    // Si clarity > 0.85: BAN chaotic effects, BOOST geometric effects
    // ═══════════════════════════════════════════════════════════════════════
    if (clarity > 0.85) {
      // 🚫 BAN: Efectos caóticos NO van con sonido HD cristalino
      if (compatibility === 'dirty') {
        return {
          allowed: false,
          probabilityMod: -1.0,
          reason: `CRYSTAL RULE: ${effectType} (chaotic) blocked by high clarity (${clarity.toFixed(2)})`,
          rule: 'crystal'
        }
      }
      
      // ✅ BOOST: Efectos de geometría definida brillan con claridad alta
      if (compatibility === 'clean') {
        return {
          allowed: true,
          probabilityMod: 0.25, // +25% probabilidad
          reason: `CRYSTAL RULE: ${effectType} (geometric) BOOSTED for high clarity (${clarity.toFixed(2)})`,
          rule: 'crystal'
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // � REGLA DE LA CALIDEZ (The Warmth Rule)
    // Si texture === 'warm': BOOST slow/atmospheric effects
    // ═══════════════════════════════════════════════════════════════════════
    if (texture === 'warm') {
      // ✅ BOOST: Efectos lentos y atmosféricos van con warmth
      if (compatibility === 'clean') {
        return {
          allowed: true,
          probabilityMod: 0.20, // +20% probabilidad
          reason: `WARMTH RULE: ${effectType} (atmospheric) BOOSTED for warm texture`,
          rule: 'warmth'
        }
      }
      
      // Efectos sucios son MENOS apropiados para warmth (pero no bloqueados)
      if (compatibility === 'dirty') {
        return {
          allowed: true,
          probabilityMod: -0.15, // -15% probabilidad (pero permitido)
          reason: `WARMTH RULE: ${effectType} (dirty) slightly penalized for warm texture`,
          rule: 'warmth'
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🌐 DEFAULT: Sin regla específica aplicada
    // ═══════════════════════════════════════════════════════════════════════
    return {
      allowed: true,
      probabilityMod: 0.0,
      reason: `NO RULE: ${effectType} allowed (compatibility=${compatibility}, texture=${texture})`,
      rule: 'none'
    }
  }

  /**
   * 🎨 WAVE 1028: Quick check if effect passes texture filter
   */
  public isTextureCompatible(effectType: string, spectralContext?: SpectralContext): boolean {
    if (!spectralContext) return true // Sin contexto = permitir
    return this.applyTextureFilter(effectType, spectralContext).allowed
  }

  /**
   * 🎨 WAVE 1028: Filter an arsenal by texture compatibility
   * 
   * Útil para pre-filtrar arsenales antes de verificar cooldowns.
   * 
   * @param arsenal - Lista de efectos
   * @param spectralContext - Contexto espectral
   * @returns Arsenal filtrado (solo efectos compatibles con la textura)
   */
  public filterArsenalByTexture(
    arsenal: string[], 
    spectralContext?: SpectralContext
  ): string[] {
    if (!spectralContext) return arsenal
    
    const filtered = arsenal.filter(effect => {
      const result = this.applyTextureFilter(effect, spectralContext)
      if (!result.allowed) {
        console.log(`[TextureFilter 🎨] ${effect} FILTERED OUT: ${result.reason}`)
      }
      return result.allowed
    })
    
    if (filtered.length < arsenal.length) {
      console.log(`[TextureFilter 🎨] Arsenal reduced: ${arsenal.length} → ${filtered.length} (texture=${spectralContext.texture}, clarity=${spectralContext.clarity.toFixed(2)})`)
    }
    
    return filtered
  }

  /**
   * 🎨 WAVE 1028: Get texture-boosted effects for current context
   * 
   * Devuelve efectos que tienen BOOST positivo para la textura actual.
   * Útil para priorizar efectos en selección.
   * 
   * @param spectralContext - Contexto espectral
   * @returns Lista de efectos con boost, ordenados por boost descendente
   */
  public getTextureBoostedEffects(spectralContext: SpectralContext): Array<{
    effect: string
    boost: number
    rule: string
  }> {
    const boosted: Array<{ effect: string; boost: number; rule: string }> = []
    
    for (const [effect, compatibility] of Object.entries(EFFECT_TEXTURE_COMPATIBILITY)) {
      const result = this.applyTextureFilter(effect, spectralContext)
      if (result.allowed && result.probabilityMod > 0) {
        boosted.push({
          effect,
          boost: result.probabilityMod,
          rule: result.rule
        })
      }
    }
    
    // Ordenar por boost descendente
    return boosted.sort((a, b) => b.boost - a.boost)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // �🚪 WAVE 812: THE GATEKEEPER - Unified Availability Check
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🚪 WAVE 812: THE GATEKEEPER - Verifica si un efecto está disponible
   * 
   * Este es el ÚNICO punto de verdad para saber si un efecto puede disparar.
   * Combina TODAS las verificaciones:
   * - MoodController blockList
   * - Cooldowns unificados (con multiplicadores de mood)
   * - MoodController forceUnlock (bypass para PUNK)
   * 
   * @param effectType - Tipo de efecto a verificar
   * @param vibeId - Vibe actual para ajustar cooldowns
   * @returns Objeto con disponibilidad y razón si está bloqueado
   */
  public checkAvailability(effectType: string, vibeId: string): { 
    available: boolean
    reason: string
    cooldownRemaining?: number  // ms hasta que esté disponible
  } {
    // 1. 🎭 MOOD FORCE UNLOCK - PUNK puede bypasear todo
    if (this.moodController.isEffectForceUnlocked(effectType)) {
      return { 
        available: true, 
        reason: 'FORCE_UNLOCK: Mood override active' 
      }
    }
    
    // 2. 🚫 MOOD BLOCKLIST - Algunos efectos bloqueados por mood
    if (this.moodController.isEffectBlocked(effectType)) {
      return { 
        available: false, 
        reason: `MOOD_BLOCKED: Effect "${effectType}" blocked by current mood` 
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 2.5. 🔒 WAVE 1179: DICTATOR HARD MINIMUM COOLDOWN
    // ═══════════════════════════════════════════════════════════════════════════
    // Este check NO puede ser bypasado por DNA COOLDOWN OVERRIDE.
    // Los efectos dictadores necesitan un mínimo absoluto de respiro.
    // ═══════════════════════════════════════════════════════════════════════════
    const hardMinimum = DICTATOR_HARD_MINIMUM_COOLDOWNS[effectType]
    if (hardMinimum) {
      const lastFired = this.effectTypeLastFired.get(effectType)
      if (lastFired) {
        const elapsed = Date.now() - lastFired
        const remaining = hardMinimum - elapsed
        
        if (remaining > 0) {
          return { 
            available: false, 
            reason: `🔒 HARD_COOLDOWN: ${effectType} needs ${Math.ceil(remaining / 1000)}s more (dictator protection)`,
            cooldownRemaining: remaining
          }
        }
      }
    }
    
    // 3. ⏱️ COOLDOWN CHECK - El reloj manda
    const lastFired = this.effectTypeLastFired.get(effectType)
    if (lastFired) {
      // Calcular cooldown efectivo
      let baseCooldown = this.config.effectTypeCooldowns[effectType] || this.config.minCooldownMs
      baseCooldown = this.applyVibeCooldownAdjustment(effectType, baseCooldown, vibeId)
      const effectiveCooldown = this.moodController.applyCooldown(baseCooldown)
      
      const elapsed = Date.now() - lastFired
      const remaining = effectiveCooldown - elapsed
      
      if (remaining > 0) {
        return { 
          available: false, 
          reason: `COOLDOWN: ${effectType} ready in ${Math.ceil(remaining / 1000)}s`,
          cooldownRemaining: remaining
        }
      }
    }
    
    // 4. ✅ AVAILABLE - Pase VIP concedido
    return { 
      available: true, 
      reason: 'AVAILABLE: Effect ready to fire' 
    }
  }
  
  /**
   * 🚪 WAVE 812: Versión simplificada para checks rápidos
   */
  public isAvailable(effectType: string, vibeId: string): boolean {
    return this.checkAvailability(effectType, vibeId).available
  }

  /**
   * 🌊 WAVE 691: Verifica si un efecto específico está en cooldown
   * 🎭 WAVE 700.1: Ahora respeta MoodController
   *    - PUNK forceUnlock = ignora cooldown
   *    - Cooldowns modificados por cooldownMultiplier
   */
  private isEffectInCooldown(effectType: string, vibe?: string): boolean {
    // 🎭 WAVE 700.1: Si el mood tiene forceUnlock para este efecto, NUNCA está en cooldown
    if (this.moodController.isEffectForceUnlocked(effectType)) {
      return false
    }
    
    const lastFired = this.effectTypeLastFired.get(effectType)
    if (!lastFired) return false
    
    // Cooldown base del config
    let baseCooldown = this.config.effectTypeCooldowns[effectType] || this.config.minCooldownMs
    
    // 🔥 WAVE 790.2: VIBE-SPECIFIC COOLDOWNS
    // Techno necesita cooldowns más agresivos que Fiesta Latina
    baseCooldown = this.applyVibeCooldownAdjustment(effectType, baseCooldown, vibe || 'unknown')
    
    // 🎭 WAVE 700.1: Aplicar multiplicador del mood
    const effectiveCooldown = this.moodController.applyCooldown(baseCooldown)
    
    return (Date.now() - lastFired) < effectiveCooldown
  }
  
  /**
   * 🔥 WAVE 790.2: VIBE-SPECIFIC COOLDOWN ADJUSTMENT
   * 
   * Ajusta el cooldown base según el vibe activo.
   * Techno necesita cooldowns más agresivos que Fiesta Latina.
   * 
   * @param effectType - Tipo de efecto
   * @param baseCooldown - Cooldown base en ms
   * @param vibe - Vibe actual ('fiesta-latina', 'techno-club', etc.)
   * @returns Cooldown ajustado en ms
   */
  private applyVibeCooldownAdjustment(effectType: string, baseCooldown: number, vibe: string): number {
    // Solo ajustar SolarFlare (otros efectos mantienen su cooldown base)
    if (effectType !== 'solar_flare') {
      return baseCooldown
    }
    
    // SolarFlare: Cooldown más agresivo en Techno
    if (vibe === 'techno-club') {
      return 12000  // 12s base para Techno → PUNK:8.4s, BALANCED:18s, CALM:36s
    } else if (vibe === 'fiesta-latina') {
      return 30000  // 30s base para Fiesta Latina → PUNK:21s, BALANCED:45s, CALM:90s
    }
    
    // Fallback: mantener baseCooldown
    return baseCooldown
  }
  
  /**
   * 🎭 WAVE 700.1: Verifica si un efecto está bloqueado por el mood actual
   * 
   * IMPORTANTE: Esto es ADICIONAL al Vibe Shield.
   * El Vibe Shield es la autoridad suprema. El Mood solo puede AÑADIR restricciones,
   * nunca puede desbloquear algo que el Vibe tiene prohibido.
   */
  private isEffectBlockedByMood(effectType: string): boolean {
    return this.moodController.isEffectBlocked(effectType)
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔪 WAVE 1010.5: THE PURGE - select() REMOVED
  // ═══════════════════════════════════════════════════════════════════════════
  // DELETED: select() - decision-making function (230 lines)
  // REASON: DecisionMaker es ahora el ÚNICO cerebro. Este módulo es REPOSITORIO.
  // MIGRATED TO: DecisionMaker.makeDecision() + getAvailableFromArsenal()
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ═══════════════════════════════════════════════════════════════════════════
  // � WAVE 1010.5: THE PURGE - classifyZScore() REMOVED
  // ═══════════════════════════════════════════════════════════════════════════
  // DELETED: classifyZScore() - Z-Score classification with energy awareness
  // REASON: Esta lógica ahora vive en DecisionMaker.determineDecisionType()
  // MIGRATED TO: DecisionMaker con zone awareness integrada
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * 🔋 WAVE 936: EFECTOS PERMITIDOS POR VIBE
   * 
   * ¡ADIÓS CUMBIA EN TECHNO! Cada vibe tiene su propio arsenal.
   * El VibeLeakShield garantiza que los efectos latinos no contaminen techno.
   */
  private static readonly EFFECTS_BY_VIBE: Record<string, string[]> = {
    // 🔪 TECHNO CLUB: El Arsenal Industrial
    'techno-club': [
      'ghost_breath',       // Respiro oscuro
      'acid_sweep',         // Sweeps volumétricos
      'cyber_dualism',      // Ping-pong L/R
      'gatling_raid',       // Machine gun
      'sky_saw',            // Cortes agresivos
      'industrial_strobe',  // El martillo
      'strobe_burst',       // Impacto puntual
      'abyssal_rise',       // Transición épica
      'tidal_wave',         // Ola industrial
      // 🌫️ WAVE 938: ATMOSPHERIC ARSENAL (low-energy zones)
      'void_mist',          // Neblina púrpura con respiración
      // 🔪 WAVE 986: static_pulse PURGED - replaced by binary_glitch + seismic_snap
      'digital_rain',       // Matrix flicker cyan/lime
      'deep_breath',        // Respiración orgánica azul/púrpura
      // ⚡ WAVE 977: LA FÁBRICA - Nuevos efectos
      'ambient_strobe',     // Flashes dispersos tipo cámara (gentle/active)
      'sonar_ping',         // Ping submarino back→front (silence/valley)
      // 🔪 WAVE 988: FIX! binary_glitch + seismic_snap AÑADIDOS (estaban en zonas pero NO en vibe!)
      'binary_glitch',      // ⚡ Digital stutter chaos (gentle/active)
      'seismic_snap',       // 💥 Mechanical impact snap (active/intense)
      // 🔮 WAVE 988: THE FINAL ARSENAL
      'fiber_optics',       // 🌈 Ambient traveling colors (silence/valley)
      'core_meltdown',      // ☢️ LA BESTIA - extreme strobe (peak only)
      // 🔥 WAVE 2182: PARS PAINT, MOVERS PIERCE
      'neon_blinder',       // ⚡ APEX flash wall (peak)
      'surgical_strike',    // 🎯 APEX mover strobe (peak)
      'ghost_chase',        // 👻 Phantom dimmer chase (valley)
    ],
    
    // 🎺 FIESTA LATINA: El Arsenal Tropical
    'fiesta-latina': [
      'ghost_breath',       // Respiro suave
      'tidal_wave',         // Ola oceánica
      'cumbia_moon',        // Luna cumbianchera
      'clave_rhythm',       // Ritmo de clave
      'tropical_pulse',     // Pulso de conga
      'salsa_fire',         // Fuego salsero
      'strobe_burst',       // Para drops latinos
      'solar_flare',        // Explosión solar
      'corazon_latino',     // El alma del arquitecto
    ],
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020: POP-ROCK LEGENDS ARSENAL - LOS 5 MAGNÍFICOS
    // ═══════════════════════════════════════════════════════════════════════════
    'pop-rock': [
      // 🌊 CORE (80% del show - bread & butter)
      'arena_sweep',        // Barrido de Wembley, vShape con inercia
      'amp_heat',           // Válvulas calientes, intros/versos
      
      // 🎸 HIGH IMPACT (momentos especiales)
      'liquid_solo',        // Spotlight del guitarrista, solos
      'thunder_struck',     // Stadium blinder, drops
      
      // 😵 CHAOS (harshness reactive)
      'feedback_storm',     // Caos visual, metal/distorsión
      
      // ═══════════════════════════════════════════════════════════════════════
      // 🎸 WAVE 1020.9: ROCK ARSENAL EXPANSION - LOS 3 NUEVOS MAGNÍFICOS
      // ═══════════════════════════════════════════════════════════════════════
      'stage_wash',         // Respiro cálido, transiciones/intros
      'spotlight_pulse',    // Pulso emotivo, builds contemplativos
      'power_chord',        // Flash + strobe, golpes de acorde/drops
      
      // 🌐 UNIVERSAL FALLBACKS (compartidos)
      'ghost_breath',       // Respiro suave (breakdowns)
      'strobe_burst',       // Impacto puntual (drops menores)
    ],
  }
  
  /**
   * 🔋 WAVE 936 + 961: EFECTOS PERMITIDOS POR ZONA + VIBE (INTERSECCIÓN)
   * 
   * Esta es la corrección arquitectónica al VibeLeakProblem:
   * Un efecto SOLO puede disparar si está en AMBAS listas:
   * - Permitido para esta ZONA energética
   * - Permitido para este VIBE musical
   * 
   * 🔪 WAVE 961: VIBE LEAK SURGERY
   * Efectos latinos REMOVIDOS de zonas compartidas (valley, ambient, gentle).
   * Solo aparecen en fiesta-latina. Techno tiene sus propios atmosféricos.
   */
  private getEffectsAllowedForZone(zone: EnergyZone, vibe?: string): string[] {
    // 🔋 Efectos permitidos por intensidad energética (base)
    // 🩸 WAVE 2103: THE REAL FIX - ZONE OVERLAP FOR ROTATION
    //
    // THE BUG: Each zone had EXACTLY 2 effects. When both were on cooldown = SILENCE.
    // With BALANCED mood (1.5x multiplier), cyber_dualism cooldown = 22.5s.
    // If both effects in a zone are cooling, the AI goes mute for 10-20 seconds.
    //
    // THE FIX: Adjacent zones SHARE effects (overlap). This creates a 4-5 effect
    // rotation pool per zone instead of 2. The AI can always find SOMETHING to fire.
    // Philosophy: Energy zones are FUZZY, not rigid boxes. A build at E=0.44 
    // (ambient) should still consider gentle-zone effects like binary_glitch.
    const EFFECTS_BY_INTENSITY: Record<EnergyZone, string[]> = {
      // SILENCE (0-15%): Respiración + eco
      silence: ['deep_breath', 'sonar_ping', 'void_mist'],
      
      // VALLEY (15-30%): Niebla + fibras + overlap from silence/ambient
      valley: ['void_mist', 'fiber_optics', 'deep_breath', 'digital_rain', 'ghost_chase'],
      
      // AMBIENT (30-45%): Lluvia digital + acid + overlap from valley/gentle
      ambient: ['digital_rain', 'acid_sweep', 'void_mist', 'ambient_strobe', 'binary_glitch'],
      
      // GENTLE (45-60%): Flashes + glitches + overlap from ambient/active
      gentle: ['ambient_strobe', 'binary_glitch', 'acid_sweep', 'cyber_dualism', 'digital_rain'],
      
      // ACTIVE (60-75%): Dualismo + snaps + overlap from gentle/intense
      active: ['cyber_dualism', 'seismic_snap', 'binary_glitch', 'sky_saw', 'acid_sweep'],
      
      // INTENSE (75-90%): Sierra + abyssal + overlap from active/peak
      intense: ['sky_saw', 'abyssal_rise', 'cyber_dualism', 'industrial_strobe', 'seismic_snap'],
      
      // PEAK (90-100%): Artillería pesada + overlap from intense + WAVE 2182 APEX
      peak: ['gatling_raid', 'core_meltdown', 'industrial_strobe', 'sky_saw', 'abyssal_rise', 'neon_blinder', 'surgical_strike'],
    }
    
    const intensityAllowed = EFFECTS_BY_INTENSITY[zone] || []
    
    // 🛡️ WAVE 936 + 961: VIBE LEAK SHIELD + LATINA ZONE OVERRIDES
    // Si no hay vibe o es desconocido, usar lista base (legacy)
    if (!vibe || !ContextualEffectSelector.EFFECTS_BY_VIBE[vibe]) {
      return intensityAllowed
    }
    
    // 🎺 WAVE 961: FIESTA LATINA - Zone Overrides
    // Los efectos latinos SÍ pueden aparecer en zonas bajas cuando vibe=fiesta-latina
    let zoneAdjusted = [...intensityAllowed]
    if (vibe === 'fiesta-latina') {
      if (zone === 'valley') {
        zoneAdjusted.push('cumbia_moon', 'clave_rhythm')
      }
      if (zone === 'ambient') {
        zoneAdjusted.push('cumbia_moon', 'tropical_pulse', 'salsa_fire')
      }
      if (zone === 'gentle') {
        zoneAdjusted.push('tropical_pulse', 'salsa_fire', 'clave_rhythm')
      }
      if (zone === 'active') {
        zoneAdjusted.push('tropical_pulse', 'salsa_fire', 'clave_rhythm')
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎸 WAVE 1020: POP-ROCK - Zone Overrides
    // Los efectos rock aparecen según intensidad energética
    // ═══════════════════════════════════════════════════════════════════════════
    if (vibe === 'pop-rock') {
      if (zone === 'valley') {
        // 🔥 Válvulas calientes - intros, versos tranquilos
        zoneAdjusted.push('amp_heat', 'ghost_breath')
      }
      if (zone === 'ambient') {
        // 🌊 Arena sweep empieza, stage_wash entra, amp_heat sigue disponible
        zoneAdjusted.push('amp_heat', 'arena_sweep', 'stage_wash')
      }
      if (zone === 'gentle') {
        // 🌊 Arena sweep domina, stage_wash de respaldo
        zoneAdjusted.push('arena_sweep', 'stage_wash')
      }
      if (zone === 'active') {
        // 🎸 Solos + spotlight pulse pueden entrar, arena sweep continúa
        zoneAdjusted.push('arena_sweep', 'liquid_solo', 'spotlight_pulse')
      }
      if (zone === 'intense') {
        // ⚡ Thunder struck + power chord disponibles, solos + pulse en peak
        zoneAdjusted.push('liquid_solo', 'thunder_struck', 'power_chord', 'spotlight_pulse')
      }
      if (zone === 'peak') {
        // 😵 Todo el arsenal pesado: blinder + power chord + caos
        zoneAdjusted.push('thunder_struck', 'power_chord', 'feedback_storm', 'strobe_burst')
      }
    }
    
    // INTERSECCIÓN: Solo efectos que están en AMBAS listas
    const vibeAllowed = ContextualEffectSelector.EFFECTS_BY_VIBE[vibe]
    const validEffects = zoneAdjusted.filter(fx => vibeAllowed.includes(fx))
    
    // Debug: si la intersección eliminó algo, loggear
    if (validEffects.length < zoneAdjusted.length) {
      const blocked = zoneAdjusted.filter(fx => !vibeAllowed.includes(fx))
      if (blocked.length > 0) {
        console.log(`[EffectSelector 🛡️] VIBE LEAK BLOCKED: ${blocked.join(', ')} (zone=${zone}, vibe=${vibe})`)
      }
    }
    
    return validEffects
  }
  
  /**
   * 🔋 WAVE 931 + 936: Verificar si un efecto es apropiado para zona + vibe
   * 
   * 🛡️ WAVE 936: Ahora también considera el VIBE para la intersección.
   * Un efecto solo es apropiado si está en la lista filtrada por zona Y vibe.
   */
  private isEffectAppropriateForZone(effectType: string, energyContext?: EnergyContext, vibe?: string): boolean {
    if (!energyContext) return true // Sin contexto = permitir todo
    
    // 🛡️ WAVE 936: Usar la lista filtrada por zona + vibe
    const allowedEffects = this.getEffectsAllowedForZone(energyContext.zone, vibe)
    
    // Si la lista está vacía, permitir cualquier cosa (zona desconocida)
    if (allowedEffects.length === 0) return true
    
    return allowedEffects.includes(effectType)
  }
  
  private calculateCooldown(lastEffectType: string | null): number {
    if (!lastEffectType) return this.config.minCooldownMs
    
    // Cooldown extra si repetimos el mismo efecto
    if (this.consecutiveSameEffect > 0) {
      return this.config.sameEffectCooldownMs * (1 + this.consecutiveSameEffect * 0.5)
    }
    
    return this.config.minCooldownMs
  }
  
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔪 WAVE 1010.5: THE PURGE - evaluateHuntFuzzy() REMOVED
  // ═══════════════════════════════════════════════════════════════════════════
  // DELETED: evaluateHuntFuzzy() - Hunt/Fuzzy decision evaluation (118 lines)
  // REASON: DecisionMaker.determineDecisionType() ahora evalúa Hunt/Fuzzy/DIVINE
  // MIGRATED TO: DecisionMaker con lógica unificada de worthiness + DNA approval
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Effect selection logic
  // 🌊 WAVE 691: Refactorizado con cooldowns por tipo y protección anti-ghost
  // 🎭 WAVE 700.1: Integración con MoodController
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔪 WAVE 814.2: HIGH IMPACT EFFECT - Vibe-Aware
   * Devuelve el efecto de máximo impacto según el vibe actual.
   * Usado en: DIVINE moments y HUNT HIGH WORTHINESS.
   * 
   * Filosofía:
   * - Techno: industrial_strobe (El Martillo) - Impacto mecánico
   * - Latino/Default: solar_flare (El Sol) - Explosión dorada
   */
  private getHighImpactEffect(vibe: string): string {
    if (vibe === 'techno-club') {
      return 'industrial_strobe' // 🔨 El Martillo Techno
    }
    return 'solar_flare' // ☀️ Default Latino/Global
  }
  
  /**
   * 🎭 WAVE 700.1: Verifica si un efecto está disponible
   * Combina check de cooldown Y check de blockList del mood
   * 🔥 WAVE 790.2: Ahora acepta vibe para cooldowns específicos por vibe
   */
  private isEffectAvailable(effectType: string, vibe?: string): boolean {
    // Primero: ¿está bloqueado por el mood?
    if (this.isEffectBlockedByMood(effectType)) {
      console.log(`[EffectSelector 🎭] ${effectType} BLOCKED by mood ${this.moodController.getCurrentMood().toUpperCase()}`)
      return false
    }
    
    // Segundo: ¿está en cooldown? (ya considera forceUnlock del mood)
    if (this.isEffectInCooldown(effectType, vibe)) {
      return false
    }
    
    return true
  }
  
  private selectEffectForContext(
    sectionType: string,
    zLevel: 'normal' | 'elevated' | 'epic' | 'divine',
    energyTrend: 'rising' | 'stable' | 'falling',
    lastEffectType: string | null,
    musicalContext?: MusicalContext,
    vibe?: string
  ): string {
    const palette = SECTION_EFFECT_PALETTE[sectionType] || SECTION_EFFECT_PALETTE['verse']
    const energy = musicalContext?.energy ?? 0.5
    const moodProfile = this.moodController.getCurrentProfile()
    
    // 🔍 WAVE 692/700.1: Debug logging con mood
    console.log(`[EffectSelector 🎯] Section=${sectionType} Z=${zLevel} Vibe=${vibe} Energy=${energy.toFixed(2)} Trend=${energyTrend} ${moodProfile.emoji}Mood=${moodProfile.name.toUpperCase()}`)
    
    // ═══════════════════════════════════════════════════════════════
    // 🎺 WAVE 692: FIESTA LATINA - ARSENAL COMPLETO
    // 🔥 WAVE 730: Resucitados ghost_breath y tidal_wave con zone overrides
    // ❤️ WAVE 750: CORAZÓN LATINO - El alma del arquitecto
    // 🎭 WAVE 700.1: Ahora usa isEffectAvailable que considera mood
    // ═══════════════════════════════════════════════════════════════
    if (vibe === 'fiesta-latina') {
      // ❤️ WAVE 750: CORAZÓN LATINO - Para coros épicos y finales emocionales
      // Triggers: DIVINE+CHORUS, ELEVATED+ENDING, EPIC+CHORUS
      
      // ❤️ DIVINE + CHORUS = El momento más épico
      if (zLevel === 'divine' && sectionType === 'chorus') {
        if (this.isEffectAvailable('corazon_latino', vibe)) {
          console.log(`[EffectSelector ❤️] LATINA DIVINE CHORUS: corazon_latino (THE ARCHITECT'S SOUL)`)
          return 'corazon_latino'
        }
      }
      
      // ❤️ ELEVATED + ENDING = Final emocional de la canción
      if (zLevel === 'elevated' && sectionType === 'ending') {
        if (this.isEffectAvailable('corazon_latino', vibe)) {
          console.log(`[EffectSelector ❤️] LATINA ELEVATED ENDING: corazon_latino (PASSION FINALE)`)
          return 'corazon_latino'
        }
      }
      
      // ❤️ EPIC + CHORUS = Coro con mucha energía
      if (zLevel === 'epic' && sectionType === 'chorus') {
        if (this.isEffectAvailable('corazon_latino', vibe)) {
          console.log(`[EffectSelector ❤️] LATINA EPIC CHORUS: corazon_latino (EPIC PASSION)`)
          return 'corazon_latino'
        }
      }
      
      // 🔥 EPIC/DIVINE: Strobe o Solar (efectos de impacto)
      if (zLevel === 'divine' || zLevel === 'epic') {
        if (this.isEffectAvailable('strobe_burst', vibe)) {
          console.log(`[EffectSelector 🔥] LATINA EPIC: strobe_burst`)
          return 'strobe_burst'
        }
        // ❤️ WAVE 750: Corazón Latino como alternativa épica al strobe (si no es chorus/ending)
        if (this.isEffectAvailable('corazon_latino', vibe) && sectionType !== 'chorus' && sectionType !== 'ending') {
          console.log(`[EffectSelector ❤️] LATINA EPIC FALLBACK: corazon_latino`)
          return 'corazon_latino'
        }
        // Fallback a tropical pulse si strobe en cooldown o bloqueado
        if (this.isEffectAvailable('tropical_pulse', vibe)) {
          console.log(`[EffectSelector 🌴] LATINA EPIC FALLBACK: tropical_pulse`)
          return 'tropical_pulse'
        }
      }
      
      // 🌊 WAVE 730: TIDAL WAVE para buildups y alta energía
      if ((sectionType === 'buildup' || energyTrend === 'rising') && zLevel === 'elevated') {
        if (this.isEffectAvailable('tidal_wave', vibe)) {
          console.log(`[EffectSelector 🌊] LATINA BUILDUP: tidal_wave`)
          return 'tidal_wave'
        }
      }
      
      // 🌴 ELEVATED: TropicalPulse o SalsaFire (efectos de relleno medio)
      if (zLevel === 'elevated') {
        if (energyTrend === 'rising' && this.isEffectAvailable('tropical_pulse', vibe)) {
          console.log(`[EffectSelector 🌴] LATINA ELEVATED RISING: tropical_pulse`)
          return 'tropical_pulse'
        }
        if (this.isEffectAvailable('salsa_fire', vibe)) {
          console.log(`[EffectSelector 🔥] LATINA ELEVATED: salsa_fire`)
          return 'salsa_fire'
        }
      }
      
      // 👻 WAVE 730: GHOST BREATH solo en intro/breakdown (respiro profundo)
      if (sectionType === 'intro' || sectionType === 'breakdown') {
        if (this.isEffectAvailable('ghost_breath', vibe)) {
          console.log(`[EffectSelector 👻] LATINA BREAKDOWN: ghost_breath (back+movers only)`)
          return 'ghost_breath'
        }
      }
      
      // 🌙 NORMAL/LOW + BREAKDOWN: CumbiaMoon (respiro suave)
      if (sectionType === 'breakdown' || energyTrend === 'falling') {
        if (this.isEffectAvailable('cumbia_moon', vibe)) {
          console.log(`[EffectSelector 🌙] LATINA BREAKDOWN: cumbia_moon`)
          return 'cumbia_moon'
        }
      }
      
      // 🎲 NORMAL: Rotación de efectos medios (evita monotonía)
      if (zLevel === 'normal') {
        // 🔥 WAVE 730: Añadido tidal_wave a la rotación
        const candidates = ['clave_rhythm', 'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'tidal_wave']
        for (const effect of candidates) {
          if (this.isEffectAvailable(effect, vibe) && effect !== lastEffectType) {
            console.log(`[EffectSelector 🎺] LATINA NORMAL: ${effect}`)
            return effect
          }
        }
      }
      
      // 😴 Si todo está en cooldown, dejar respirar
      console.log(`[EffectSelector 😴] LATINA: all effects in cooldown, breathing`)
      return 'none'
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔪 WAVE 780: TECHNO CLUB - THE BLADE
    // 🔫 WAVE 930: ARSENAL PESADO - GatlingRaid, SkySaw, AbyssalRise
    // 🔫 WAVE 930.1 FIX: GatlingRaid más accesible (EPIC drop también)
    // 🎤 WAVE 936: VOCAL FILTER - Protección contra voces que disparan artillería
    // ═══════════════════════════════════════════════════════════════
    if (vibe === 'techno-club') {
      
      // 🌪️ ABYSSAL RISE: Transición épica en breakdown→buildup
      // Solo se dispara en puntos de transición dramática
      if (sectionType === 'breakdown' && energyTrend === 'falling') {
        if (this.isEffectAvailable('abyssal_rise', vibe)) {
          console.log(`[EffectSelector 🌪️] TECHNO BREAKDOWN→RISE: abyssal_rise (8-BAR JOURNEY)`)
          return 'abyssal_rise'
        }
      }
      
      // 🔪 DIVINE/EPIC (DROP/PEAK): GatlingRaid, IndustrialStrobe, CyberDualism
      // 🔫 WAVE 930.4: DIVERSITY ENFORCEMENT - Relajar triggers para todos los efectos
      if (zLevel === 'divine' || zLevel === 'epic') {
        const currentZ = musicalContext?.zScore ?? 0
        const energyContext = musicalContext?.energyContext
        
        // 🎤 WAVE 936: VOCAL FILTER
        // Si la transición de zona es MUY reciente (<150ms), reducir intensidad del efecto
        // Esto evita que una voz de golpe dispare gatling_raid
        let isRecentTransition = false
        if (energyContext) {
          const timeSinceZoneChange = Date.now() - energyContext.lastZoneChange
          const wasLowZone = energyContext.previousZone === 'silence' || energyContext.previousZone === 'valley'
          isRecentTransition = wasLowZone && timeSinceZoneChange < 200
          
          if (isRecentTransition) {
            console.log(`[EffectSelector 🎤] VOCAL FILTER: Recent transition (${timeSinceZoneChange}ms from ${energyContext.previousZone}) - soft effect only`)
          }
        }
        
        // 🔫 GatlingRaid: EPIC+ con alta energía (Z>1.5σ) - PERO no en transiciones recientes
        if (!isRecentTransition && currentZ >= 1.5 && this.isEffectAvailable('gatling_raid', vibe)) {
          console.log(`[EffectSelector 🔫] TECHNO ${zLevel.toUpperCase()}: gatling_raid (MACHINE GUN)`)
          return 'gatling_raid'
        }
        
        // 🤖 CyberDualism: Alternativa dinámica - OK en transiciones recientes (más suave)
        if (this.isEffectAvailable('cyber_dualism', vibe)) {
          console.log(`[EffectSelector 🤖] TECHNO ${zLevel.toUpperCase()}: cyber_dualism (L/R ASSAULT)`)
          return 'cyber_dualism'
        }
        
        // ⚡ IndustrialStrobe: SOLO si otros en cooldown Y no es transición reciente
        if (!isRecentTransition && this.isEffectAvailable('industrial_strobe', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO ${zLevel.toUpperCase()}: industrial_strobe (THE HAMMER)`)
          return 'industrial_strobe'
        }
        
        // Fallback a strobe_burst (suave, ok en cualquier caso)
        if (this.isEffectAvailable('strobe_burst', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO ${zLevel.toUpperCase()} FALLBACK: strobe_burst`)
          return 'strobe_burst'
        }
      }
      
      // 🎯 WAVE 937: PROTOCOLO EDGING - BUILDUP NO DISPARA ARTILLERÍA PESADA
      // ═════════════════════════════════════════════════════════════════
      // Buildup = Tensión, NO clímax → Prohibir gatling_raid, industrial_strobe, solar_flare
      // Solo permitir: sky_saw, acid_sweep, strobe_burst (efectos de tensión)
      // Razón: Si disparamos munición pesada en el upswing, cuando llegue el drop
      //        estará en cooldown → Selene desnuda en el momento crítico
      if (sectionType === 'buildup') {
        // 🗡️ SkySaw en ANY buildup - cortes agresivos de TENSIÓN
        if (this.isEffectAvailable('sky_saw', vibe)) {
          console.log(`[EffectSelector 🗡️] BUILDUP EDGING: sky_saw (TENSION)`)
          return 'sky_saw'
        }
        // AcidSweep como alternativa
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] BUILDUP EDGING: acid_sweep (TENSION)`)
          return 'acid_sweep'
        }
        // Fallback: strobe burst (mini-strobe, no pesado)
        if (this.isEffectAvailable('strobe_burst', vibe)) {
          console.log(`[EffectSelector ⚡] BUILDUP EDGING: strobe_burst (TENSION)`)
          return 'strobe_burst'
        }
        
        // 🛡️ Si ninguno está disponible, cyber_dualism como último recurso
        console.log(`[EffectSelector 🛡️] BUILDUP EDGING: Holding fire - cyber_dualism fallback`)
        return 'cyber_dualism'
      }
      
      // 🔪 BREAKDOWN/INTRO: AcidSweep (Ambiente volumétrico)
      if (sectionType === 'breakdown' || sectionType === 'intro') {
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] TECHNO ${sectionType.toUpperCase()}: acid_sweep (VOLUMETRIC)`)
          return 'acid_sweep'
        }
      }
      
      // 🔪 ELEVATED + RISING: SkySaw/AcidSweep para tensión agresiva
      // 🔫 WAVE 930.4: SkySaw prioridad sobre AcidSweep para más movimiento
      if (zLevel === 'elevated' && energyTrend === 'rising') {
        if (this.isEffectAvailable('sky_saw', vibe)) {
          console.log(`[EffectSelector 🗡️] TECHNO ELEVATED RISING: sky_saw`)
          return 'sky_saw'
        }
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] TECHNO ELEVATED RISING: acid_sweep`)
          return 'acid_sweep'
        }
      }
      
      // ═════════════════════════════════════════════════════════════════
      // 🎚️ WAVE 998.2: GENTLE/ELEVATED ZONE (45-75%)
      // Binary Glitch, Seismic Snap, Ambient Strobe - El ritmo constante
      // ═════════════════════════════════════════════════════════════════
      // PROBLEMA ORIGINAL: Estos efectos estaban registrados pero NUNCA propuestos
      // ContextualEffectSelector solo tenía lógica para DIVINE/EPIC/BUILDUP
      // RESULTADO: binary_glitch/seismic_snap NUNCA disparaban → Usuario: "no he visto binary_glitch!!"
      // SOLUCIÓN: Añadir lógica explícita para zona GENTLE/ELEVATED (45-75% energy)
      
      if (zLevel === 'elevated' && energy > 0.45 && energy <= 0.75) {
        // Priority 1: Binary Glitch (digital stutter chaos)
        if (this.isEffectAvailable('binary_glitch', vibe)) {
          console.log(`[EffectSelector 💻] TECHNO ELEVATED: binary_glitch (DIGITAL STUTTER)`)
          return 'binary_glitch'
        }
        
        // Priority 2: Seismic Snap (mechanical impact)
        if (this.isEffectAvailable('seismic_snap', vibe)) {
          console.log(`[EffectSelector 💥] TECHNO ELEVATED: seismic_snap (MECHANICAL SNAP)`)
          return 'seismic_snap'
        }
        
        // Priority 3: Ambient Strobe (camera flashes)
        if (this.isEffectAvailable('ambient_strobe', vibe)) {
          console.log(`[EffectSelector 📸] TECHNO ELEVATED: ambient_strobe (CAMERA FLASHES)`)
          return 'ambient_strobe'
        }
        
        // Fallback: Cyber Dualism (si todo lo demás está en cooldown)
        if (this.isEffectAvailable('cyber_dualism', vibe)) {
          console.log(`[EffectSelector 🤖] TECHNO ELEVATED FALLBACK: cyber_dualism`)
          return 'cyber_dualism'
        }
      }
      
      // ═════════════════════════════════════════════════════════════════
      // 🌫️ WAVE 998.2: NORMAL ZONE (30-60%)
      // Acid Sweep, Digital Rain, Binary Glitch - Movimiento suave y glitches
      // ═════════════════════════════════════════════════════════════════
      
      if (zLevel === 'normal' && energy > 0.30 && energy <= 0.60) {
        // Priority 1: Acid Sweep (wobble bass)
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] TECHNO NORMAL: acid_sweep (ACID WOBBLE)`)
          return 'acid_sweep'
        }
        
        // Priority 2: Digital Rain (matrix flicker)
        if (this.isEffectAvailable('digital_rain', vibe)) {
          console.log(`[EffectSelector 💧] TECHNO NORMAL: digital_rain (MATRIX FLICKER)`)
          return 'digital_rain'
        }
        
        // Priority 3: Binary Glitch (fallback - también válido en NORMAL)
        if (this.isEffectAvailable('binary_glitch', vibe)) {
          console.log(`[EffectSelector 💻] TECHNO NORMAL FALLBACK: binary_glitch`)
          return 'binary_glitch'
        }
      }
      
      // 🤖 WAVE 810 + WAVE 930.4: ELEVATED: CyberDualism más accesible (no requiere verse/chorus)
      if (zLevel === 'elevated') {
        if (this.isEffectAvailable('cyber_dualism', vibe)) {
          console.log(`[EffectSelector 🤖] TECHNO ELEVATED: cyber_dualism (L/R PING-PONG)`)
          return 'cyber_dualism'
        }
      }
      
      // 🔪 ELEVATED + STABLE/FALLING: AcidSweep antes que Strobe
      // 🔫 WAVE 930.4: Reducir presencia de industrial_strobe
      if (zLevel === 'elevated') {
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] TECHNO ELEVATED: acid_sweep`)
          return 'acid_sweep'
        }
        // IndustrialStrobe como último recurso
        if (this.isEffectAvailable('industrial_strobe', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO ELEVATED: industrial_strobe`)
          return 'industrial_strobe'
        }
      }
      
      // 🔪 WAVE 961 + 963: NORMAL - ATMOSPHERIC INJECTION with ZONE PRIORITY
      // WAVE 963: Priorizar atmosféricos en zonas bajas (valley, silence)
      // Priorizar sweeps/saws en zonas medias (ambient, gentle, active)
      if (zLevel === 'normal') {
        const energyContext = musicalContext?.energyContext
        const zone = energyContext?.zone
        
        // 🌫️ ZONE PRIORITY: Si estamos en zonas bajas, atmosféricos primero
        let candidates: string[]
        if (zone === 'silence' || zone === 'valley') {
          candidates = [
            'void_mist',      // 🌫️ Neblina púrpura
            'deep_breath',    // 🫁 Respiración orgánica
            // 🔪 WAVE 986: static_pulse PURGED
            'digital_rain',   // 💚 Matrix flicker
            'acid_sweep',     // Sweeps volumétricos (fallback)
            'sky_saw',        // Cortes agresivos (fallback)
          ]
        } else {
          // Zonas medias/altas: sweeps y saws tienen prioridad
          // 🔪 WAVE 986: binary_glitch + seismic_snap AÑADIDOS
          candidates = [
            'acid_sweep',     // Sweeps volumétricos
            'sky_saw',        // Cortes agresivos
            'binary_glitch',  // ⚡ WAVE 986: Glitch digital
            'seismic_snap',   // 💥 WAVE 986: Golpe mecánico
            'digital_rain',   // 💚 Matrix flicker
            'void_mist',      // 🌫️ Neblina púrpura (fallback)
            'deep_breath',    // 🫁 Respiración orgánica (fallback)
          ]
        }
        
        for (const effect of candidates) {
          if (this.isEffectAvailable(effect, vibe) && effect !== lastEffectType) {
            console.log(`[EffectSelector 🔪] TECHNO NORMAL (zone=${zone}): ${effect}`)
            return effect
          }
        }
      }
      
      // 😴 Si todo está en cooldown, dejar respirar
      console.log(`[EffectSelector 😴] TECHNO: all effects in cooldown, breathing`)
      return 'none'
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 1: DIVINE/EPIC = Primary effect (lo más potente)
    // 🎭 WAVE 700.5.2: TODOS los returns deben pasar por isEffectAvailable
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'divine' || zLevel === 'epic') {
      // Evitar repetir el mismo efecto
      const primary = palette.primary
      if (primary === lastEffectType && this.consecutiveSameEffect >= 2) {
        if (this.isEffectAvailable(palette.secondary, vibe)) {
          return palette.secondary
        }
      }
      if (this.isEffectAvailable(primary, vibe)) {
        return primary
      }
      // 🎭 WAVE 700.5.2: Fallback también debe verificar blockList
      if (this.isEffectAvailable(palette.secondary, vibe)) {
        return palette.secondary
      }
      // Si secondary también bloqueado, usar tidal_wave como fallback seguro
      if (this.isEffectAvailable('tidal_wave', vibe)) {
        return 'tidal_wave'
      }
      return 'none'
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🌊 WAVE 691: ANTI-GHOST - Bloquear ghost_breath si hay ritmo
    // 🎭 WAVE 700.1: También considerar blockList del mood
    // 🔥 WAVE 725: Desbloquear ghost_breath para fiesta-latina con zona overrides
    // ═══════════════════════════════════════════════════════════════
    const ghostBlocked = (vibe !== 'fiesta-latina' && energy > this.config.ambientBlockEnergyThreshold) || 
                         !this.isEffectAvailable('ghost_breath', vibe)
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 2: ELEVATED + RISING = Build tension
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated' && energyTrend === 'rising') {
      // Buildup/Bridge: Ghost Breath solo si NO bloqueado
      if ((sectionType === 'buildup' || sectionType === 'bridge') && !ghostBlocked) {
        return 'ghost_breath'
      }
      // Default: Tidal Wave para momentum
      if (this.isEffectAvailable('tidal_wave', vibe)) {
        return 'tidal_wave'
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 3: ELEVATED + FALLING = Release suave
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated' && energyTrend === 'falling') {
      if (this.isEffectAvailable('tidal_wave', vibe)) {
        return 'tidal_wave'  // Ola que baja
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // REGLA 4: ELEVATED + STABLE = Mantener momentum
    // ═══════════════════════════════════════════════════════════════
    if (zLevel === 'elevated') {
      // En drop/chorus/breakdown: strobe para mantener energía
      if (sectionType === 'drop' || sectionType === 'chorus' || sectionType === 'breakdown') {
        const strobeType = 'strobe_storm'
        if (lastEffectType !== strobeType && this.isEffectAvailable(strobeType, vibe)) {
          return strobeType
        }
        return 'tidal_wave'
      }
      // Evitar ghost si está bloqueado
      if (palette.secondary === 'ghost_breath' && ghostBlocked) {
        return 'tidal_wave'
      }
      if (this.isEffectAvailable(palette.secondary, vibe)) {
        return palette.secondary
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT: Ambient effect (pero NO ghost si hay ritmo)
    // ═══════════════════════════════════════════════════════════════
    if (palette.ambient === 'ghost_breath' && ghostBlocked) {
      return 'tidal_wave'
    }
    
    if (this.isEffectAvailable(palette.ambient)) {
      return palette.ambient
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 🔪 WAVE 814: VIBE-AWARE FALLBACK - La Red de Seguridad Inteligente
    // ═══════════════════════════════════════════════════════════════
    // Si llegamos aquí, ningún efecto específico ni la paleta funcionaron.
    // Aplicamos un fallback que RESPETA LA IDENTIDAD DEL VIBE.
    
    let ultimateFallback = 'tidal_wave' // Default mundial
    
    if (vibe === 'techno-club') {
      // 🔪 EN TECHNO, EL SOL NO EXISTE
      // Si es sección de alta energía (drop/chorus/peak) → Martillo
      if (['drop', 'chorus', 'peak'].includes(sectionType)) {
        ultimateFallback = 'industrial_strobe' // El Martillo (backup)
        console.log(`[EffectSelector 🔪] TECHNO HIGH-ENERGY FALLBACK: industrial_strobe`)
      } 
      // Si es sección de baja energía (verse/intro/breakdown) → Cuchilla
      else {
        ultimateFallback = 'acid_sweep' // La Cuchilla (default)
        console.log(`[EffectSelector 🔪] TECHNO LOW-ENERGY FALLBACK: acid_sweep`)
      }
    } 
    else if (vibe === 'chill-lounge') {
      // En Chill, efecto espacial suave
      ultimateFallback = 'borealis_wave'
      console.log(`[EffectSelector 🌌] CHILL FALLBACK: borealis_wave`)
    }
    // else: otros vibes usan tidal_wave (default universal)
    
    // 🛡️ WAVE 814: ESCUDO FINAL - Si por algún motivo sacamos solar_flare en Techno, matarlo
    if (vibe === 'techno-club' && ultimateFallback === 'solar_flare') {
      ultimateFallback = 'acid_sweep'
      console.log(`[EffectSelector 🔪⚠️] TECHNO ANTI-SUN SHIELD ACTIVATED: Replaced solar_flare → acid_sweep`)
    }
    
    return ultimateFallback
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Intensity calculation
  // ─────────────────────────────────────────────────────────────────────────
  
  private calculateIntensity(
    musicalContext: MusicalContext,
    zLevel: 'normal' | 'elevated' | 'epic' | 'divine'
  ): number {
    // Base intensity por nivel de Z
    const baseIntensity: Record<typeof zLevel, number> = {
      normal: 0.4,
      elevated: 0.6,
      epic: 0.85,
      divine: 1.0,
    }
    
    let intensity = baseIntensity[zLevel]
    
    // Modular con energía del audio
    intensity = intensity * (0.7 + musicalContext.energy * 0.3)
    
    // Clamp
    return Math.min(1.0, Math.max(0.2, intensity))
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // 🔪 WAVE 1010 DEPRECATED: Decision builders
  // ─────────────────────────────────────────────────────────────────────────
  // DIVINE decisions ahora se generan en DecisionMaker.generateDivineStrikeDecision()
  // Estas funciones se mantienen para compatibilidad con select() legacy.
  // ─────────────────────────────────────────────────────────────────────────
  
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔪 WAVE 1010.5: THE PURGE - divineDecision() & noEffectDecision() REMOVED
  // ═══════════════════════════════════════════════════════════════════════════
  // DELETED: divineDecision() - DIVINE moment decision builder (15 lines)
  // DELETED: noEffectDecision() - No-effect decision builder (10 lines)
  // REASON: Ambas funciones solo eran usadas por select() (deprecated)
  // MIGRATED TO: DecisionMaker.generateDivineStrikeDecision() maneja DIVINE moments
  // ═══════════════════════════════════════════════════════════════════════════
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let selectorInstance: ContextualEffectSelector | null = null

export function getContextualEffectSelector(): ContextualEffectSelector {
  if (!selectorInstance) {
    selectorInstance = new ContextualEffectSelector()
  }
  return selectorInstance
}

export function resetContextualEffectSelector(): void {
  selectorInstance = null
}
