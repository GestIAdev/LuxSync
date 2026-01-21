/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 CONTEXTUAL EFFECT SELECTOR - THE ARTISTIC BRAIN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * WAVE 685: CONTEXTUAL INTELLIGENCE
 * WAVE 700.1: MOOD INTEGRATION
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

import type { MusicalContext } from './types'
import type { HuntDecision } from '../intelligence/think/HuntEngine'
import type { FuzzyDecision } from '../intelligence/think/FuzzyDecisionMaker'
import { MoodController } from '../mood'
// 🔋 WAVE 931: Import EnergyZone para consciencia energética
import type { EnergyZone, EnergyContext } from '../protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resultado de la selección contextual
 */
export interface ContextualEffectSelection {
  /** Efecto seleccionado (null = no disparar nada) */
  effectType: string | null
  
  /** Intensidad calculada */
  intensity: number
  
  /** Razón de la selección (para logging) */
  reason: string
  
  /** Confianza en la decisión (0-1) */
  confidence: number
  
  /** ¿Es una decisión de override/bypass? */
  isOverride: boolean
  
  /** Contexto musical inyectado */
  musicalContext: MusicalContext
}

/**
 * Input completo para el selector
 */
export interface ContextualSelectorInput {
  /** Contexto musical en tiempo real */
  musicalContext: MusicalContext
  
  /** Decisión del HuntEngine (opcional) */
  huntDecision?: HuntDecision
  
  /** Decisión del FuzzyDecisionMaker (opcional) */
  fuzzyDecision?: FuzzyDecision
  
  /** Tipo de sección actual */
  sectionType: 'intro' | 'verse' | 'chorus' | 'bridge' | 'buildup' | 'drop' | 'breakdown' | 'outro'
  
  /** Tendencia de energía */
  energyTrend: 'rising' | 'stable' | 'falling'
  
  /** Timestamp del último efecto disparado (cooldown) */
  lastEffectTimestamp: number
  
  /** Último efecto disparado (anti-repetición) */
  lastEffectType: string | null
}

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
  'industrial_strobe': 10000,  // 10s base → Strobe es IMPACTO, no spam
  'acid_sweep': 12000,         // 12s base → Dar espacio para sweeps (was 15s)
  
  // 🤖 WAVE 810: UNLOCK THE TWINS
  'cyber_dualism': 15000,      // 15s base (was 20s) → Más gemelos
  
  // 🔫 WAVE 930: ARSENAL PESADO
  'gatling_raid': 8000,        // 8s base → Machine gun controlado
  'sky_saw': 10000,            // 10s base → Aggressive cuts espaciados
  'abyssal_rise': 45000,       // 45s base → Epic transition - muy raro
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
   */
  public registerEffectFired(effectType: string): void {
    this.effectTypeLastFired.set(effectType, Date.now())
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🚪 WAVE 812: THE GATEKEEPER - Unified Availability Check
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
  
  /**
   * 🎯 SELECT EFFECT
   * 
   * Método principal: dado el contexto completo, decide qué efecto disparar.
   * 
   * @returns Selección de efecto (puede ser null si no hay que disparar nada)
   */
  public select(input: ContextualSelectorInput): ContextualEffectSelection {
    const { musicalContext, sectionType, lastEffectTimestamp, lastEffectType } = input
    const now = Date.now()
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 1: COOLDOWN CHECK
    // ═══════════════════════════════════════════════════════════════
    
    const timeSinceLastEffect = now - lastEffectTimestamp
    const cooldown = this.calculateCooldown(lastEffectType)
    
    if (timeSinceLastEffect < cooldown) {
      return this.noEffectDecision(musicalContext, `Cooldown (${cooldown - timeSinceLastEffect}ms remaining)`)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 2: Z-SCORE CLASSIFICATION (🔋 WAVE 931: CON CONSCIENCIA ENERGÉTICA)
    // ═══════════════════════════════════════════════════════════════
    
    // 🔋 Obtener contexto energético si está disponible
    const energyContext = musicalContext.energyContext
    const zLevel = this.classifyZScore(musicalContext.zScore, energyContext)
    
    // 🌩️ DIVINE MOMENT: Z > 3.5 = SOLAR FLARE OBLIGATORIO
    // 🔋 WAVE 931: Pero solo si el zLevel NO fue capeado por consciencia energética
    if (zLevel === 'divine') {
      return this.divineDecision(musicalContext)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 3: HUNT/FUZZY DECISION CHECK
    // ═══════════════════════════════════════════════════════════════
    
    const shouldStrike = this.evaluateHuntFuzzy(input)
    
    // ═══════════════════════════════════════════════════════════════
    // 🌀 WAVE 900.4: CEREBRO UNIFICADO
    // ───────────────────────────────────────────────────────────────
    // El camino HUNT HIGH WORTHINESS fue ELIMINADO de aquí.
    // 
    // ANTES (WAVE 814.2): Dos cerebros competían por disparar:
    //   - DecisionMaker → INTENT
    //   - ContextualEffectSelector → HUNT HIGH WORTHINESS
    //   RESULTADO: Doble disparo, esquizofrenia
    //
    // AHORA (WAVE 900): Un solo cerebro decide:
    //   DecisionMaker → DreamEngineIntegrator → VisualConscienceEngine
    //   ContextualEffectSelector es SOLO FALLBACK cuando DecisionMaker calla
    //
    // El flujo Hunt ahora pasa por SeleneTitanConscious:
    //   Hunt → Dream → Conscience → Gatekeeper → Execute
    // ═══════════════════════════════════════════════════════════════
    
    if (!shouldStrike.should) {
      return this.noEffectDecision(musicalContext, shouldStrike.reason)
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 4: CONTEXT-BASED EFFECT SELECTION
    // 🌊 WAVE 691: Ahora con vibe y musicalContext para anti-ghost
    // ═══════════════════════════════════════════════════════════════
    
    const effectType = this.selectEffectForContext(
      sectionType, 
      zLevel, 
      input.energyTrend,
      lastEffectType,
      musicalContext,
      musicalContext.vibeId
    )
    
    // 🔥 WAVE 691.5: Si el selector devuelve 'none', no disparar nada
    if (effectType === 'none') {
      return this.noEffectDecision(musicalContext, 'LATINA breathing - strobe in cooldown')
    }
    
    // 🔥 WAVE 810.5: NO registrar aquí - esperar a que EffectManager confirme el disparo
    // El cooldown se registrará solo si el efecto REALMENTE se dispara (no bloqueado por Shield/Traffic)
    // this.registerEffectFired(effectType)  // ❌ REMOVED
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 5: INTENSITY CALCULATION
    // ═══════════════════════════════════════════════════════════════
    
    const intensity = this.calculateIntensity(musicalContext, zLevel)
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 6: BUILD DECISION
    // ═══════════════════════════════════════════════════════════════
    
    // Anti-repetición tracking
    if (effectType === lastEffectType) {
      this.consecutiveSameEffect++
    } else {
      this.consecutiveSameEffect = 0
    }
    
    return {
      effectType,
      intensity,
      reason: `${zLevel.toUpperCase()} moment in ${sectionType} | Z=${musicalContext.zScore.toFixed(2)}σ`,
      confidence: shouldStrike.confidence,
      isOverride: false,
      musicalContext,
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Classification helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔋 WAVE 931: Clasificación Z-Score con CONSCIENCIA ENERGÉTICA
   * 
   * ANTES: Solo miraba Z-Score (relativo) → "Grito en biblioteca"
   * AHORA: Considera también energía absoluta → "Contexto inteligente"
   * 
   * MATRIZ DE CAPPING:
   * ┌────────────┬─────────────────────────────────────────┐
   * │ EnergyZone │ Máximo Z-Level Permitido                │
   * ├────────────┼─────────────────────────────────────────┤
   * │ silence    │ normal (sin importar Z real)            │
   * │ valley     │ elevated (aunque Z=4.0)                 │
   * │ ambient    │ epic (bloquea divine)                   │
   * │ gentle+    │ Sin restricción                         │
   * └────────────┴─────────────────────────────────────────┘
   */
  private classifyZScore(
    z: number, 
    energyContext?: EnergyContext
  ): 'normal' | 'elevated' | 'epic' | 'divine' {
    const { zScoreThresholds: t } = this.config
    
    // Clasificación base sin restricciones
    let baseLevel: 'normal' | 'elevated' | 'epic' | 'divine' = 'normal'
    if (z >= t.divine) baseLevel = 'divine'
    else if (z >= t.epic) baseLevel = 'epic'
    else if (z >= t.elevated) baseLevel = 'elevated'
    
    // 🔋 WAVE 931: Si no hay contexto energético, usar clasificación legacy
    if (!energyContext) {
      return baseLevel
    }
    
    // 🛡️ CONSCIENCIA ENERGÉTICA: Cap basado en zona de energía absoluta
    const zone = energyContext.zone
    
    // SILENCE (E < 0.10): Máximo NORMAL - No dispares machinegun en un funeral
    if (zone === 'silence') {
      if (baseLevel !== 'normal') {
        console.log(`[EffectSelector 🔋] ENERGY CAP: Z=${z.toFixed(2)}σ→${baseLevel} CAPPED to NORMAL (zone=SILENCE)`)
      }
      return 'normal'
    }
    
    // VALLEY (E 0.10-0.20): Máximo ELEVATED - Preparando para el drop
    if (zone === 'valley') {
      if (baseLevel === 'divine' || baseLevel === 'epic') {
        console.log(`[EffectSelector 🔋] ENERGY CAP: Z=${z.toFixed(2)}σ→${baseLevel} CAPPED to ELEVATED (zone=VALLEY)`)
        return 'elevated'
      }
      return baseLevel
    }
    
    // AMBIENT (E 0.20-0.35): Máximo EPIC - Bloquea solar flares en ambiente suave
    if (zone === 'ambient') {
      if (baseLevel === 'divine') {
        console.log(`[EffectSelector 🔋] ENERGY CAP: Z=${z.toFixed(2)}σ→DIVINE CAPPED to EPIC (zone=AMBIENT)`)
        return 'epic'
      }
      return baseLevel
    }
    
    // GENTLE+ (E > 0.35): Sin restricciones - Selene tiene libertad total
    return baseLevel
  }
  
  /**
   * 🔋 WAVE 931: Helper para obtener efectos permitidos por zona energética
   * 
   * Esto permite que Selene elija efectos SUAVES cuando está en zona baja,
   * en lugar de simplemente NO disparar nada.
   */
  private getEffectsAllowedForZone(zone: EnergyZone): string[] {
    const EFFECTS_BY_INTENSITY: Record<EnergyZone, string[]> = {
      // SILENCE: Solo efectos fantasmales, cambios de color
      silence: ['ghost_breath', 'cumbia_moon'],
      
      // VALLEY: Pre-drop preparación, efectos suaves
      valley: ['ghost_breath', 'tidal_wave', 'cumbia_moon', 'clave_rhythm'],
      
      // AMBIENT: Sweeps y ondas permitidos
      ambient: ['acid_sweep', 'tidal_wave', 'cumbia_moon', 'tropical_pulse', 'salsa_fire'],
      
      // GENTLE: Añadir dualismo y bursts
      gentle: ['acid_sweep', 'cyber_dualism', 'strobe_burst', 'tropical_pulse', 'salsa_fire', 'clave_rhythm'],
      
      // ACTIVE: Arsenal casi completo
      active: ['cyber_dualism', 'gatling_raid', 'sky_saw', 'industrial_strobe', 'acid_sweep', 'strobe_burst'],
      
      // INTENSE: Todo menos el nuclear
      intense: ['gatling_raid', 'industrial_strobe', 'sky_saw', 'solar_flare', 'cyber_dualism', 'acid_sweep'],
      
      // PEAK: Libertad total - DROP territory
      peak: ['gatling_raid', 'industrial_strobe', 'solar_flare', 'sky_saw', 'cyber_dualism', 'abyssal_rise'],
    }
    
    return EFFECTS_BY_INTENSITY[zone] || []
  }
  
  /**
   * 🔋 WAVE 931: Verificar si un efecto es apropiado para la zona energética
   */
  private isEffectAppropriateForZone(effectType: string, energyContext?: EnergyContext): boolean {
    if (!energyContext) return true // Sin contexto = permitir todo
    
    const allowedEffects = this.getEffectsAllowedForZone(energyContext.zone)
    
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
  
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Hunt/Fuzzy evaluation
  // ─────────────────────────────────────────────────────────────────────────
  
  private evaluateHuntFuzzy(input: ContextualSelectorInput): { 
    should: boolean
    reason: string
    confidence: number 
  } {
    const { huntDecision, fuzzyDecision, musicalContext } = input
    
    // Si el Hunt tiene worthiness alta con confianza alta, go
    // 🔥 WAVE 811: UNIFIED BRAIN - Usa worthiness en vez de shouldStrike
    const WORTHINESS_THRESHOLD = 0.65
    if (huntDecision && huntDecision.worthiness >= WORTHINESS_THRESHOLD && huntDecision.confidence >= this.config.minHuntConfidence) {
      return {
        should: true,
        reason: `Hunt WORTHY (worthiness=${huntDecision.worthiness.toFixed(2)} confidence=${huntDecision.confidence.toFixed(2)})`,
        confidence: huntDecision.confidence,
      }
    }
    
    // Si el Fuzzy dice strike/force_strike, go
    if (fuzzyDecision) {
      if (fuzzyDecision.action === 'force_strike') {
        return {
          should: true,
          reason: `Fuzzy FORCE_STRIKE: ${fuzzyDecision.reasoning}`,
          confidence: fuzzyDecision.confidence,
        }
      }
      if (fuzzyDecision.action === 'strike' && fuzzyDecision.confidence >= 0.7) {
        return {
          should: true,
          reason: `Fuzzy STRIKE: ${fuzzyDecision.reasoning}`,
          confidence: fuzzyDecision.confidence,
        }
      }
    }
    
    // Si Z-Score es epic (>2.8) aunque Hunt/Fuzzy no lo digan, dispararemos algo suave
    if (musicalContext.zScore >= this.config.zScoreThresholds.epic) {
      return {
        should: true,
        reason: `Epic Z-Score bypass (Z=${musicalContext.zScore.toFixed(2)}σ)`,
        confidence: 0.75,
      }
    }
    
    // No disparar
    return {
      should: false,
      reason: `No trigger conditions met (Z=${musicalContext.zScore.toFixed(2)}σ)`,
      confidence: 0,
    }
  }
  
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
        
        // 🔫 GatlingRaid: EPIC+ con alta energía (Z>1.5σ) - no requiere drop exacto
        if (currentZ >= 1.5 && this.isEffectAvailable('gatling_raid', vibe)) {
          console.log(`[EffectSelector 🔫] TECHNO ${zLevel.toUpperCase()}: gatling_raid (MACHINE GUN)`)
          return 'gatling_raid'
        }
        
        // 🤖 CyberDualism: Alternativa dinámica en EPIC
        if (this.isEffectAvailable('cyber_dualism', vibe)) {
          console.log(`[EffectSelector 🤖] TECHNO ${zLevel.toUpperCase()}: cyber_dualism (L/R ASSAULT)`)
          return 'cyber_dualism'
        }
        
        // ⚡ IndustrialStrobe: SOLO si otros en cooldown
        if (this.isEffectAvailable('industrial_strobe', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO ${zLevel.toUpperCase()}: industrial_strobe (THE HAMMER)`)
          return 'industrial_strobe'
        }
        
        // Fallback a strobe_burst
        if (this.isEffectAvailable('strobe_burst', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO ${zLevel.toUpperCase()} FALLBACK: strobe_burst`)
          return 'strobe_burst'
        }
      }
      
      // 🔪 BUILDUP: AcidSweep + SkySaw (Tensión agresiva)
      // 🔫 WAVE 930.4: SkySaw más accesible - no requiere rising específico
      if (sectionType === 'buildup') {
        // 🗡️ SkySaw en ANY buildup - cortes agresivos
        if (this.isEffectAvailable('sky_saw', vibe)) {
          console.log(`[EffectSelector 🗡️] TECHNO BUILDUP: sky_saw (AGGRESSIVE CUTS)`)
          return 'sky_saw'
        }
        // AcidSweep como alternativa
        if (this.isEffectAvailable('acid_sweep', vibe)) {
          console.log(`[EffectSelector 🧪] TECHNO BUILDUP: acid_sweep`)
          return 'acid_sweep'
        }
        // Fallback: strobe burst
        if (this.isEffectAvailable('strobe_burst', vibe)) {
          console.log(`[EffectSelector ⚡] TECHNO BUILDUP PEAK: strobe_burst`)
          return 'strobe_burst'
        }
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
      
      // 🔪 NORMAL: Rotación de efectos medios (evita monotonía)
      if (zLevel === 'normal') {
        const candidates = ['acid_sweep', 'sky_saw']
        for (const effect of candidates) {
          if (this.isEffectAvailable(effect, vibe) && effect !== lastEffectType) {
            console.log(`[EffectSelector 🔪] TECHNO NORMAL: ${effect}`)
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
  // PRIVATE: Decision builders
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * 🔪 WAVE 814.2: DIVINE DECISION - Vibe-Aware Impact
   * Ahora usa getHighImpactEffect() para respetar la identidad del vibe
   */
  private divineDecision(musicalContext: MusicalContext): ContextualEffectSelection {
    const impactEffect = this.getHighImpactEffect(musicalContext.vibeId)
    return {
      effectType: impactEffect, // ✅ Dinámico: industrial_strobe (Techno) o solar_flare (Latino)
      intensity: 1.0,
      reason: `🌩️ DIVINE MOMENT! [${musicalContext.vibeId}] effect=${impactEffect} Z=${musicalContext.zScore.toFixed(2)}σ - IMPACT MANDATORY`,
      confidence: 0.99,
      isOverride: true,
      musicalContext,
    }
  }
  
  private noEffectDecision(musicalContext: MusicalContext, reason: string): ContextualEffectSelection {
    return {
      effectType: null,
      intensity: 0,
      reason,
      confidence: 0,
      isOverride: false,
      musicalContext,
    }
  }
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
