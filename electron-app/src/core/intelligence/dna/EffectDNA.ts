/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 EFFECT DNA - THE CONTEXTUAL GENOME
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 970: THE CONTEXTUAL DNA
 * 
 * FILOSOFÍA:
 * Selene no busca "belleza" (concepto humano subjetivo).
 * Selene busca ADECUACIÓN (concepto matemático objetivo).
 * 
 * Un IndustrialStrobe NO ES más "bello" que un VoidMist.
 * Un IndustrialStrobe ES más ADECUADO para un DROP que un VoidMist.
 * Un VoidMist ES más ADECUADO para un BREAKDOWN que un IndustrialStrobe.
 * 
 * TRES GENES FUNDAMENTALES:
 * - Aggression (A): ¿Cuánto "golpea"? (0=suave, 1=brutal)
 * - Chaos (C): ¿Es ordenado o ruidoso? (0=predecible, 1=caótico)
 * - Organicity (O): ¿Parece vivo o máquina? (0=sintético, 1=orgánico)
 * 
 * EDGE CASES RESUELTOS (WAVE 970.1):
 * - 🚨 Parkinson Digital: EMA Smoothing (α=0.20)
 * - 🚨 Middle Void: Wildcard fallback (cyber_dualism)
 * 
 * @module core/intelligence/dna/EffectDNA
 * @version WAVE 970.2 - THE CONTEXTUAL DNA (PunkOpus)
 */

import type { Mood, SectionType } from '../../protocol/MusicalContext'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ADN inmutable de un efecto - Su NATURALEZA, no su "belleza"
 */
export interface EffectDNA {
  /** Agresión: ¿Cuánto "golpea"? (0=suave, 1=brutal) */
  aggression: number
  
  /** Caos: ¿Es ordenado o ruidoso? (0=predecible, 1=caótico) */
  chaos: number
  
  /** Organicidad: ¿Parece vivo o máquina? (0=sintético, 1=orgánico) */
  organicity: number
}

/**
 * ADN objetivo derivado del contexto musical
 */
export interface TargetDNA extends EffectDNA {
  /** Confianza en el análisis del contexto (0-1) */
  confidence: number
}

/**
 * AudioMetrics mínimo requerido para derivar Target DNA
 */
export interface AudioMetricsForDNA {
  bass: number           // 0-1
  mid: number            // 0-1
  treble: number         // 0-1
  volume: number         // 0-1
  harshness?: number     // 0-1 (ratio 2-5kHz harsh synths)
  spectralFlatness?: number  // 0-1 (0=tonal, 1=ruido)
}

/**
 * MusicalContext mínimo requerido para derivar Target DNA
 */
export interface MusicalContextForDNA {
  energy: number
  syncopation?: number
  mood: Mood
  section: {
    type: SectionType
    confidence: number
  }
  rhythm?: {
    drums?: {
      kickIntensity: number
    }
    fillDetected?: boolean
    groove?: number
    confidence?: number
  }
  energyContext?: {
    trend?: number
  }
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DNA REGISTRY - LA NATURALEZA INMUTABLE DE CADA EFECTO
// ═══════════════════════════════════════════════════════════════════════════

export const EFFECT_DNA_REGISTRY: Record<string, EffectDNA> = {
  // ═══════════════════════════════════════════════════════════════
  // 🔪 TECHNO-INDUSTRIAL: Los Martillos
  // ═══════════════════════════════════════════════════════════════
  'industrial_strobe': {
    aggression: 0.95,   // 🔥 El martillo más brutal
    chaos: 0.30,        // Ordenado: flashes predecibles
    organicity: 0.05,   // 100% máquina
  },
  'acid_sweep': {
    aggression: 0.70,   // Agresivo pero más fluido
    chaos: 0.45,        // Semi-caótico (acid wobble)
    organicity: 0.25,   // Algo de "vida" en el movimiento
  },
  'cyber_dualism': {
    aggression: 0.55,   // 🎯 WAVE 970.1: Ajustado al centro (was 0.65)
    chaos: 0.50,        // Centro perfecto ✓
    organicity: 0.45,   // 🎯 WAVE 970.1: Ajustado al centro (was 0.30)
  },
  // ⭐ Cyber Dualism = WILDCARD para zonas 'active' moderadas
  'gatling_raid': {
    aggression: 0.90,   // 🔫 Ametralladora de PARs
    chaos: 0.40,        // 🔧 WAVE 977: 0.70 → 0.40 (menos caótico, más predecible)
    organicity: 0.10,   // Mecánico puro
  },
  'sky_saw': {
    aggression: 0.80,   // Sierra cortante
    chaos: 0.55,        // Moderado (movimiento agresivo pero direccional)
    organicity: 0.20,   // Mecánico con "swing"
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🌫️ TECHNO-ATMOSPHERIC: La Neblina
  // ═══════════════════════════════════════════════════════════════
  'void_mist': {
    aggression: 0.05,   // 🌫️ Cero violencia - solo flota
    chaos: 0.20,        // Ordenado pero con pequeñas variaciones
    organicity: 0.85,   // Parece humo VIVO
  },
  // 🔪 WAVE 986: static_pulse PURGED - replaced by binary_glitch + seismic_snap
  // 🔧 WAVE 1003.10: binary_glitch chaos 0.85→0.55 (era demasiado alto vs target DNA)
  'binary_glitch': {
    aggression: 0.60,   // ⚡ Golpe seco digital - tartamudeo de código
    chaos: 0.55,        // 🔧 WAVE 1003.10: 0.85→0.55 (caótico pero competitivo con target ~0.30)
    organicity: 0.00,   // 100% máquina - cero orgánico
  },
  'seismic_snap': {
    aggression: 0.70,   // 💥 Golpe físico de luz - obturador gigante
    chaos: 0.20,        // Ordenado - SNAP preciso
    organicity: 0.10,   // Casi 100% máquina
  },
  'digital_rain': {
    aggression: 0.35,   // � WAVE 977: 0.20 → 0.35 (más presencia)
    chaos: 0.65,        // Caótico (gotas aleatorias)
    organicity: 0.40,   // Semi-orgánico (agua)
  },
  'deep_breath': {
    aggression: 0.05,   // 🫁 Cero violencia
    chaos: 0.10,        // MUY ordenado (sinusoidal)
    organicity: 0.95,   // MÁXIMA organicidad - respiración
  },
  
  // ═══════════════════════════════════════════════════════════════
  // ⚡ WAVE 977: LA FÁBRICA - Nuevos Efectos Techno
  // ═══════════════════════════════════════════════════════════════
  'ambient_strobe': {
    aggression: 0.45,   // 📸 Flashes moderados tipo cámara
    chaos: 0.40,        // Disperso pero no caótico
    organicity: 0.10,   // Máquina (flashes de cámara)
  },
  'sonar_ping': {
    aggression: 0.15,   // 🔵 Pulso sutil submarino
    chaos: 0.10,        // MUY ordenado (secuencia back→front)
    organicity: 0.05,   // 100% máquina/tecnología
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🌪️ WAVE 930: ARSENAL PESADO
  // ═══════════════════════════════════════════════════════════════
  'abyssal_rise': {
    aggression: 0.80,   // 🌪️ Alto - épica transición dramática
    chaos: 0.30,        // Ordenado - progresión estructurada (8 bars)
    organicity: 0.50,   // 50/50 - Orgánico (ocean depths) + Sintético (techno)
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🔮 WAVE 988: THE FINAL ARSENAL
  // ═══════════════════════════════════════════════════════════════
  'fiber_optics': {
    aggression: 0.10,   // 🌈 Cero violencia - solo viaja
    chaos: 0.20,        // Ordenado - progresión cíclica
    organicity: 0.00,   // 100% sintético tecnológico
  },
  'core_meltdown': {
    aggression: 1.00,   // ☢️ MÁXIMA - LA BESTIA
    chaos: 1.00,        // MÁXIMO - Impredecible strobe
    organicity: 0.00,   // 100% máquina apocalíptica
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🌴 LATINO-ORGANIC: La Fiesta
  // ═══════════════════════════════════════════════════════════════
  'solar_flare': {
    aggression: 0.75,   // ☀️ Explosión pero festiva
    chaos: 0.50,        // Moderado
    organicity: 0.60,   // Fuego = orgánico
  },
  'strobe_storm': {
    aggression: 0.85,   // ⚡ Tormenta eléctrica
    chaos: 0.65,        // Bastante caótico
    organicity: 0.30,   // Eléctrico, semi-mecánico
  },
  'strobe_burst': {
    aggression: 0.70,   // 💥 Ráfagas rítmicas
    chaos: 0.40,        // Ordenado (sigue el ritmo)
    organicity: 0.35,   // Semi-mecánico
  },
  'tidal_wave': {
    aggression: 0.30,   // 🌊 Suave como ola
    chaos: 0.35,        // Fluido pero predecible
    organicity: 0.75,   // Muy orgánico (agua)
  },
  'ghost_breath': {
    aggression: 0.10,   // 👻 Susurro fantasmal
    chaos: 0.25,        // Muy suave
    organicity: 0.90,   // Máxima organicidad
  },
  'tropical_pulse': {
    aggression: 0.60,   // 🌴 Percusivo pero alegre
    chaos: 0.40,        // Rítmico = ordenado
    organicity: 0.70,   // Muy festivo/humano
  },
  'salsa_fire': {
    aggression: 0.65,   // 🔥 Fuego de salsa
    chaos: 0.45,        // Moderado
    organicity: 0.65,   // Pasional/orgánico
  },
  'cumbia_moon': {
    aggression: 0.15,   // 🌙 Suave como la luna
    chaos: 0.20,        // Muy ordenado
    organicity: 0.80,   // Romántico/orgánico
  },
  'clave_rhythm': {
    aggression: 0.50,   // 🥁 Percusivo moderado
    chaos: 0.35,        // Rítmico 3-2
    organicity: 0.70,   // Humano/orgánico
  },
  'corazon_latino': {
    aggression: 0.50,   // 💃 Pasional pero no violento
    chaos: 0.35,        // Rítmico
    organicity: 0.90,   // MÁXIMA - latido del corazón
  },

  // ═══════════════════════════════════════════════════════════════
  // 🔥 WAVE 1004.3: DNA EXTREMOS - LA BESTIA Y EL VIRUS
  // ═══════════════════════════════════════════════════════════════
  
  'latina_meltdown': {
    aggression: 0.97,   // 🔥 NUCLEAR SALSA - almost peak
    chaos: 0.30,        // Ordenado - kick sync
    organicity: 0.20,   // Mecánico - máquina de devastación
  },
  'glitch_guaguanco': {
    aggression: 0.66,   // 🦠 El virus digital
    chaos: 0.85,        // Alto caos - glitchy
    organicity: 0.30,   // Alienígena digital
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌿 WAVE 1004.4: DNA RESCATADOS - LOS EXTREMOS SILENCIOSOS
  // ═══════════════════════════════════════════════════════════════
  
  'amazon_mist': {
    aggression: 0.05,   // 🌿 La selva respira - casi silencio
    chaos: 0.25,        // Ordenado natural
    organicity: 0.80,   // Muy orgánico - naturaleza pura
  },
  'machete_spark': {
    aggression: 0.70,   // ⚔️ Cortes de acero brillante
    chaos: 0.50,        // Moderado
    organicity: 0.30,   // Metálico
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP TABLES - TRADUCCIONES SEMÁNTICAS (NO SON HARDCODE DE BELLEZA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Organicidad asociada a cada Mood
 * 
 * JUSTIFICACIÓN:
 * - "dreamy", "melancholic" = emociones humanas = orgánico
 * - "aggressive" = máquina industrial = mecánico
 */
const MOOD_ORGANICITY: Record<Mood, number> = {
  'dreamy': 0.90,      // Sueños = muy orgánico
  'melancholic': 0.80, // Tristeza = humano
  'neutral': 0.50,     // Neutral
  'mysterious': 0.60,  // Misterio = semi-orgánico
  'euphoric': 0.55,    // Euforia puede ser electrónica o humana
  'triumphant': 0.45,  // Triunfo = algo épico/mecánico
  'aggressive': 0.20,  // Agresión = máquina
}

/**
 * Organicidad asociada a cada tipo de sección
 * 
 * JUSTIFICACIÓN:
 * - "breakdown" = momento íntimo, humano = orgánico
 * - "drop" = explosión mecánica = sintético
 */
const SECTION_ORGANICITY: Record<SectionType, number> = {
  'intro': 0.70,       // Intros suelen ser más suaves
  'verse': 0.65,       // Versos = narrativa humana
  'chorus': 0.50,      // Coros pueden ser cualquier cosa
  'bridge': 0.60,      // Bridges = transición
  'breakdown': 0.85,   // Breakdowns = MÁXIMA organicidad
  'buildup': 0.40,     // Buildups = tensión mecánica
  'drop': 0.15,        // Drops = MÍNIMA organicidad (máquina)
  'outro': 0.75,       // Outros = orgánicos
  'unknown': 0.50,     // Default
}

// ═══════════════════════════════════════════════════════════════════════════
// WILDCARDS POR CATEGORÍA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Efectos "comodín" por categoría - Usados cuando hay Middle Void
 */
export const WILDCARD_EFFECTS: Record<string, string> = {
  'techno-industrial': 'cyber_dualism',   // Moderado: A=0.55, C=0.50, O=0.45
  'techno-atmospheric': 'digital_rain',   // Moderado: A=0.20, C=0.65, O=0.40
  'latino-organic': 'clave_rhythm',       // Moderado: A=0.50, C=0.35, O=0.70
}

// ═══════════════════════════════════════════════════════════════════════════
// DNA ANALYZER CLASS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧬 DNA ANALYZER
 * 
 * Deriva el Target DNA desde el contexto musical y calcula
 * la relevancia de cada efecto mediante distancia euclidiana 3D.
 * 
 * FEATURES:
 * - EMA Smoothing para prevenir Parkinson Digital (WAVE 970.1)
 * - Snap Conditions para drops/breakdowns (respuesta inmediata)
 * - Middle Void Detection con wildcard fallback
 */
export class DNAAnalyzer {
  // ═══════════════════════════════════════════════════════════════════════
  // 🧬 PERSISTENT STATE (anti-jitter)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Target DNA suavizado (EMA) para prevenir Parkinson Digital */
  private smoothedTarget: TargetDNA = { 
    aggression: 0.5, 
    chaos: 0.5, 
    organicity: 0.5, 
    confidence: 0.5 
  }
  
  /** Alpha para EMA (0.15=lento, 0.5=rápido) */
  private readonly SMOOTHING_ALPHA = 0.20  // 20% frame actual, 80% histórico
  
  /** Threshold para detectar "Middle Void" */
  private readonly MIDDLE_VOID_THRESHOLD = 0.60
  
  /** Máxima distancia posible en cubo unitario 3D = √3 ≈ 1.732 */
  private readonly MAX_DISTANCE = Math.sqrt(3)
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎲 WAVE 1004.2: DIVERSITY FACTOR - Anti-repetición
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Contador de uso por efecto en la ventana actual */
  private effectUsageCount: Map<string, number> = new Map()
  
  /** Timestamp del último reset del contador */
  private lastUsageReset: number = Date.now()
  
  /** Ventana de tiempo para el contador (10 segundos) */
  private readonly USAGE_WINDOW_MS = 10000
  
  /** Factores de diversidad: [1x, 0.7x, 0.4x, 0.1x] por uso repetido */
  private readonly DIVERSITY_FACTORS = [1.0, 0.7, 0.4, 0.1]
  
  constructor() {
    // 🔧 WAVE 1003.15: Silenciado para reducir spam de logs
    // console.log('[DNA_ANALYZER] 🧬 Initialized')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Deriva el ADN objetivo desde el contexto musical actual
   * 
   * 🚨 TRAMPA #1: Usa EMA para suavizar y evitar jitter frame-a-frame
   * 
   * @param context - Contexto musical del frame actual
   * @param audioMetrics - Métricas de audio (bass, mid, treble, harshness, etc.)
   * @returns Target DNA suavizado
   */
  deriveTargetDNA(
    context: MusicalContextForDNA,
    audioMetrics: AudioMetricsForDNA
  ): TargetDNA {
    // 1. Calcular Target "crudo" del frame actual
    const rawTarget = this.calculateRawTarget(context, audioMetrics)
    
    // 2. Aplicar EMA para suavizar (anti-Parkinson)
    this.smoothedTarget.aggression = 
      this.SMOOTHING_ALPHA * rawTarget.aggression + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.aggression
    
    this.smoothedTarget.chaos = 
      this.SMOOTHING_ALPHA * rawTarget.chaos + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.chaos
    
    this.smoothedTarget.organicity = 
      this.SMOOTHING_ALPHA * rawTarget.organicity + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.organicity
    
    this.smoothedTarget.confidence = 
      this.SMOOTHING_ALPHA * rawTarget.confidence + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.confidence
    
    // 3. EXCEPCIÓN: Drops y Breakdowns resetean inercia (snap instantáneo)
    if (context.section.type === 'drop' && context.section.confidence > 0.7) {
      // Drop detectado → SNAP a alta agresión
      this.smoothedTarget.aggression = Math.max(this.smoothedTarget.aggression, 0.80)
      this.smoothedTarget.organicity = Math.min(this.smoothedTarget.organicity, 0.25)
      console.log(`[DNA_ANALYZER] 🔴 DROP SNAP: A=${this.smoothedTarget.aggression.toFixed(2)}, O=${this.smoothedTarget.organicity.toFixed(2)}`)
    }
    if (context.section.type === 'breakdown' && context.section.confidence > 0.7) {
      // Breakdown detectado → SNAP a baja agresión, alta organicidad
      this.smoothedTarget.aggression = Math.min(this.smoothedTarget.aggression, 0.25)
      this.smoothedTarget.organicity = Math.max(this.smoothedTarget.organicity, 0.75)
      console.log(`[DNA_ANALYZER] 🌊 BREAKDOWN SNAP: A=${this.smoothedTarget.aggression.toFixed(2)}, O=${this.smoothedTarget.organicity.toFixed(2)}`)
    }
    
    return { ...this.smoothedTarget }
  }
  
  /**
   * Calcula la relevancia de un efecto dado el target
   * 
   * Usa distancia euclidiana 3D ponderada:
   * distance = √[(Ae-At)² + (Ce-Ct)² + (Oe-Ot)²]
   * relevance = (1 - (distance / √3)) * confidence * diversityFactor
   * 
   * 🎲 WAVE 1004.2: Ahora incluye DIVERSITY FACTOR para penalizar repetición
   * 
   * @param effectId - ID del efecto a evaluar
   * @param targetDNA - Target DNA actual
   * @returns Relevancia (0-1, donde 1 = match perfecto)
   */
  calculateRelevance(effectId: string, targetDNA: TargetDNA): number {
    const effectDNA = EFFECT_DNA_REGISTRY[effectId]
    if (!effectDNA) {
      console.warn(`[DNA_ANALYZER] ⚠️ Unknown effect: ${effectId}, returning neutral relevance`)
      return 0.5 // Unknown effect = neutral
    }
    
    // 🎲 WAVE 1004.2: Reset ventana si expiró
    this.maybeResetUsageWindow()
    
    // Distancia euclidiana 3D
    const dA = effectDNA.aggression - targetDNA.aggression
    const dC = effectDNA.chaos - targetDNA.chaos
    const dO = effectDNA.organicity - targetDNA.organicity
    
    const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
    
    // Relevancia base (1 = perfecto match)
    const baseRelevance = 1 - (distance / this.MAX_DISTANCE)
    
    // Ponderar por confidence
    const confidenceWeighted = baseRelevance * targetDNA.confidence + (1 - targetDNA.confidence) * 0.5
    
    // 🎲 WAVE 1004.2: Aplicar Diversity Factor
    const usageCount = this.effectUsageCount.get(effectId) || 0
    const diversityIndex = Math.min(usageCount, this.DIVERSITY_FACTORS.length - 1)
    const diversityFactor = this.DIVERSITY_FACTORS[diversityIndex]
    
    return confidenceWeighted * diversityFactor
  }
  
  /**
   * 🎲 WAVE 1004.2: Registra uso de un efecto para Diversity Factor
   * 
   * @param effectId - ID del efecto que fue seleccionado
   */
  recordEffectUsage(effectId: string): void {
    this.maybeResetUsageWindow()
    const currentCount = this.effectUsageCount.get(effectId) || 0
    this.effectUsageCount.set(effectId, currentCount + 1)

    // Log solo si ya está penalizado (evitar spam)
    if (currentCount >= 1) {
      console.log(`[DNA_ANALYZER] 📊 Diversity: ${effectId} usado ${currentCount + 1}x - Factor: ${this.DIVERSITY_FACTORS[Math.min(currentCount + 1, this.DIVERSITY_FACTORS.length - 1)]}x`)
    }
  }
  
  /**
   * 🎲 WAVE 1004.2: Reset automático de ventana de uso
   */
  private maybeResetUsageWindow(): void {
    const now = Date.now()
    if (now - this.lastUsageReset > this.USAGE_WINDOW_MS) {
      this.effectUsageCount.clear()
      this.lastUsageReset = now
    }
  }
  
  /**
   * Calcula la distancia euclidiana entre un efecto y el target
   * (Útil para logging/debugging)
   */
  calculateDistance(effectId: string, targetDNA: TargetDNA): number {
    const effectDNA = EFFECT_DNA_REGISTRY[effectId]
    if (!effectDNA) return this.MAX_DISTANCE
    
    const dA = effectDNA.aggression - targetDNA.aggression
    const dC = effectDNA.chaos - targetDNA.chaos
    const dO = effectDNA.organicity - targetDNA.organicity
    
    return Math.sqrt(dA * dA + dC * dC + dO * dO)
  }
  
  /**
   * Rankea todos los efectos por relevancia
   * 
   * 🚨 TRAMPA #2: Detecta "Middle Void" y fuerza wildcard si necesario
   * 
   * @param targetDNA - Target DNA actual
   * @param category - Categoría opcional para filtrar efectos
   * @returns Array ordenado por relevancia (mayor primero)
   */
  rankEffects(
    targetDNA: TargetDNA, 
    category?: string
  ): Array<{ effectId: string; relevance: number; distance: number }> {
    // Filtrar por categoría si se especifica
    let effectIds = Object.keys(EFFECT_DNA_REGISTRY)
    
    if (category) {
      effectIds = effectIds.filter(id => this.getEffectCategory(id) === category)
    }
    
    // Calcular relevancia de todos los efectos
    const ranked = effectIds
      .map(effectId => ({
        effectId,
        relevance: this.calculateRelevance(effectId, targetDNA),
        distance: this.calculateDistance(effectId, targetDNA)
      }))
      .sort((a, b) => b.relevance - a.relevance)
    
    // 🚨 TRAMPA #2: Middle Void detection
    const bestRelevance = ranked[0]?.relevance ?? 0
    
    if (bestRelevance < this.MIDDLE_VOID_THRESHOLD) {
      console.warn(`[DNA_ANALYZER] ⚠️ MIDDLE VOID: Best relevance=${bestRelevance.toFixed(2)} < ${this.MIDDLE_VOID_THRESHOLD}`)
      console.warn(`[DNA_ANALYZER] 🎯 Target: A=${targetDNA.aggression.toFixed(2)}, C=${targetDNA.chaos.toFixed(2)}, O=${targetDNA.organicity.toFixed(2)}`)
      
      // Determinar wildcard según categoría
      const wildcardId = category 
        ? WILDCARD_EFFECTS[category] 
        : 'cyber_dualism'  // Default global wildcard
      
      console.warn(`[DNA_ANALYZER] 🃏 Forcing WILDCARD: ${wildcardId}`)
      
      // Forzar wildcard al top si existe
      const wildcardIndex = ranked.findIndex(r => r.effectId === wildcardId)
      if (wildcardIndex > 0) {
        const wildcard = ranked.splice(wildcardIndex, 1)[0]
        ranked.unshift(wildcard)
      }
    }
    
    return ranked
  }
  
  /**
   * Obtiene el DNA de un efecto específico
   */
  getEffectDNA(effectId: string): EffectDNA | undefined {
    return EFFECT_DNA_REGISTRY[effectId]
  }
  
  /**
   * Obtiene el Target DNA actual (suavizado)
   */
  getCurrentTarget(): TargetDNA {
    return { ...this.smoothedTarget }
  }
  
  /**
   * Reset del estado interno (útil para tests)
   */
  reset(): void {
    this.smoothedTarget = { 
      aggression: 0.5, 
      chaos: 0.5, 
      organicity: 0.5, 
      confidence: 0.5 
    }
    console.log('[DNA_ANALYZER] 🔄 State reset to neutral')
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE METHODS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Calcula el Target DNA "crudo" del frame (sin suavizar)
   * PRIVADO - Solo usado internamente por deriveTargetDNA()
   */
  private calculateRawTarget(
    context: MusicalContextForDNA,
    audioMetrics: AudioMetricsForDNA
  ): TargetDNA {
    // ═══════════════════════════════════════════════════════════════
    // 🔥 AGGRESSION: Derivada de ENERGÍA + PERCUSIÓN + ESPECTRO
    // ═══════════════════════════════════════════════════════════════
    //
    // Fórmula:
    // A = (energy * 0.40) + (kickIntensity * 0.25) + (harshness * 0.20) + (bassBoost * 0.15)
    
    const energy = context.energy
    const kickIntensity = context.rhythm?.drums?.kickIntensity ?? 0
    const harshness = audioMetrics.harshness ?? 0
    
    // Bass ratio: Si bass > mid, más agresión
    const bassRatio = audioMetrics.bass / Math.max(0.1, audioMetrics.mid)
    const bassBoost = this.clamp((bassRatio - 1) * 0.5, 0, 0.5)  // Max +0.5 si bass >> mid
    
    const aggression = this.clamp(
      (energy * 0.40) +
      (kickIntensity * 0.25) +
      (harshness * 0.20) +
      (bassBoost * 0.30),
      0, 1
    )
    
    // ═══════════════════════════════════════════════════════════════
    // 🌀 CHAOS: Derivada de SYNCOPATION + SPECTRAL FLATNESS + FILLS
    // ═══════════════════════════════════════════════════════════════
    //
    // Fórmula:
    // C = (syncopation * 0.35) + (spectralFlatness * 0.30) + (fillBonus * 0.20) + (trendChaos * 0.15)
    
    const syncopation = context.syncopation ?? 0
    const spectralFlatness = audioMetrics.spectralFlatness ?? 0
    const fillBonus = context.rhythm?.fillDetected ? 0.3 : 0
    const trendChaos = Math.abs(context.energyContext?.trend ?? 0)
    
    const chaos = this.clamp(
      (syncopation * 0.35) +
      (spectralFlatness * 0.30) +
      (fillBonus) +
      (trendChaos * 0.15),
      0, 1
    )
    
    // ═══════════════════════════════════════════════════════════════
    // 🌱 ORGANICITY: Derivada de MOOD + SECTION + INVERSE HARSHNESS
    // ═══════════════════════════════════════════════════════════════
    //
    // Fórmula:
    // O = (moodOrganicity * 0.30) + (sectionOrganicity * 0.30) + ((1 - harshness) * 0.25) + (groove * 0.15)
    
    const moodOrganicity = this.getMoodOrganicity(context.mood)
    const sectionOrganicity = this.getSectionOrganicity(context.section.type)
    const groove = context.rhythm?.groove ?? 0.5
    
    const organicity = this.clamp(
      (moodOrganicity * 0.30) +
      (sectionOrganicity * 0.30) +
      ((1 - harshness) * 0.25) +
      (groove * 0.15),
      0, 1
    )
    
    // ═══════════════════════════════════════════════════════════════
    // 📊 CONFIDENCE: Basada en la confianza del análisis
    // ═══════════════════════════════════════════════════════════════
    const rhythmConfidence = context.rhythm?.confidence ?? 0.5
    const confidence = context.confidence * rhythmConfidence
    
    return { aggression, chaos, organicity, confidence }
  }
  
  /**
   * Obtiene la organicidad asociada a un Mood
   */
  private getMoodOrganicity(mood: Mood): number {
    return MOOD_ORGANICITY[mood] ?? 0.50
  }
  
  /**
   * Obtiene la organicidad asociada a un tipo de sección
   */
  private getSectionOrganicity(section: SectionType): number {
    return SECTION_ORGANICITY[section] ?? 0.50
  }
  
  /**
   * Determina la categoría de un efecto basándose en su ID
   */
  private getEffectCategory(effectId: string): string {
    // Techno-industrial
    if (['industrial_strobe', 'acid_sweep', 'cyber_dualism', 'gatling_raid', 'sky_saw'].includes(effectId)) {
      return 'techno-industrial'
    }
    // Techno-atmospheric
    // 🔪 WAVE 986: static_pulse PURGED, binary_glitch + seismic_snap ADDED
    if (['void_mist', 'digital_rain', 'deep_breath', 'binary_glitch', 'seismic_snap'].includes(effectId)) {
      return 'techno-atmospheric'
    }
    // Latino-organic
    if (['solar_flare', 'strobe_storm', 'strobe_burst', 'tidal_wave', 'ghost_breath', 
         'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'clave_rhythm', 'corazon_latino'].includes(effectId)) {
      return 'latino-organic'
    }
    return 'unknown'
  }
  
  /**
   * Clamp helper
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let dnaAnalyzerInstance: DNAAnalyzer | null = null

/**
 * Obtiene la instancia singleton del DNAAnalyzer
 */
export function getDNAAnalyzer(): DNAAnalyzer {
  if (!dnaAnalyzerInstance) {
    dnaAnalyzerInstance = new DNAAnalyzer()
  }
  return dnaAnalyzerInstance
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default DNAAnalyzer
