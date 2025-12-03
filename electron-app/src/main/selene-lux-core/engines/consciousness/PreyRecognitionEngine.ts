/**
 * 🧠 PREY RECOGNITION ENGINE
 * "Recuerda cada caza - aprende de victorias y derrotas"
 *
 * WAVE 5: THE HUNT - Capa de Cognición
 * 
 * CAPACIDADES:
 * - Persiste hunts en memoria local (sin Redis)
 * - Identifica patterns de éxito (qué presas son más fáciles)
 * - Recomienda mejores momentos según histórico
 * - Crea perfiles de "presas" con estadísticas
 * 
 * FILOSOFÍA FELINA:
 * Un gato experimentado sabe qué presas son fáciles.
 * Recuerda dónde encontró comida antes.
 * Aprende de cada caza fallida.
 */

import type { ElementType, EmotionalTone } from '../../types'

// ============================================
// 🎯 INTERFACES
// ============================================

/**
 * Registro completo de una cacería
 */
export interface HuntRecord {
  huntId: string
  targetPattern: string           // "MI-fire"
  
  // Condiciones pre-strike
  preStrikeBeauty: number
  preStrikeTrend: 'rising' | 'falling' | 'stable'
  preStrikeConsonance: number
  clusterHealth: number
  emotionalTone: EmotionalTone
  
  // Resultado
  postStrikeBeauty: number
  improvement: number             // postStrike - preStrike
  success: boolean                // improvement >= 0
  
  // Contexto
  stalkingCycles: number         // Cuántos ciclos observamos
  strikeScore: number            // Score cuando atacamos
  timestamp: number
  sessionId: string              // Para agrupar por sesión
}

/**
 * Perfil de una "presa" (patrón musical)
 */
export interface PreyProfile {
  patternKey: string              // "MI-fire"
  note: string
  element: ElementType
  
  // Estadísticas
  totalHunts: number
  successfulHunts: number
  successRate: number             // 0-1
  
  // Mejoras
  avgImprovement: number
  bestImprovement: number
  worstImprovement: number
  
  // Condiciones óptimas (promedio de hunts exitosos)
  optimalConditions: {
    avgBeautyWhenSuccess: number
    avgConsonanceWhenSuccess: number
    avgClusterHealthWhenSuccess: number
    avgStalkingCycles: number
  }
  
  // Dificultad inferida
  difficulty: 'easy' | 'medium' | 'hard'
  
  // Timing
  lastHuntTimestamp: number
  firstHuntTimestamp: number
}

/**
 * Recomendación basada en historial
 */
export interface HuntRecommendation {
  patternKey: string
  confidence: number              // 0-1
  reasoning: string
  expectedImprovement: number
  optimalConditions: PreyProfile['optimalConditions']
}

/**
 * Configuración del motor de reconocimiento
 */
export interface PreyRecognitionConfig {
  maxHuntsStored: number          // Máximo de hunts en memoria
  maxProfilesStored: number       // Máximo de perfiles
  successThreshold: number        // Improvement mínimo para "éxito"
  sessionId: string               // ID de sesión actual
}

// ============================================
// 🧠 PREY RECOGNITION ENGINE
// ============================================

export class PreyRecognitionEngine {
  // === Configuración ===
  private config: PreyRecognitionConfig = {
    maxHuntsStored: 500,
    maxProfilesStored: 50,
    successThreshold: 0.0,        // Cualquier mejora es éxito
    sessionId: `session_${Date.now()}`
  }
  
  // === Almacenamiento en memoria ===
  private huntRecords: HuntRecord[] = []
  private preyProfiles: Map<string, PreyProfile> = new Map()
  
  // === Estadísticas globales ===
  private totalHuntsEver = 0
  private totalSuccessEver = 0
  
  constructor(config?: Partial<PreyRecognitionConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
    console.log('🧠 [PREY-RECOGNITION] Engine initialized')
  }
  
  // ============================================
  // 💾 REGISTRAR CACERÍA
  // ============================================
  
  /**
   * Registrar una nueva cacería
   */
  recordHunt(hunt: Omit<HuntRecord, 'huntId' | 'success' | 'sessionId'>): HuntRecord {
    // Generar ID único
    const huntId = `hunt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Determinar éxito
    const success = hunt.improvement >= this.config.successThreshold
    
    const fullRecord: HuntRecord = {
      ...hunt,
      huntId,
      success,
      sessionId: this.config.sessionId
    }
    
    // Guardar en historial
    this.huntRecords.push(fullRecord)
    
    // Mantener límite de almacenamiento
    if (this.huntRecords.length > this.config.maxHuntsStored) {
      this.huntRecords.shift()
    }
    
    // Actualizar perfil de la presa
    this.updatePreyProfile(fullRecord)
    
    // Actualizar estadísticas globales
    this.totalHuntsEver++
    if (success) this.totalSuccessEver++
    
    console.log(`🧠 [PREY-RECOGNITION] Hunt recorded: ${fullRecord.targetPattern} (${success ? 'SUCCESS' : 'FAIL'})`)
    
    return fullRecord
  }
  
  // ============================================
  // 📊 ACTUALIZAR PERFIL DE PRESA
  // ============================================
  
  /**
   * Actualizar o crear perfil de presa
   */
  private updatePreyProfile(hunt: HuntRecord): void {
    const existing = this.preyProfiles.get(hunt.targetPattern)
    
    if (existing) {
      // Actualizar perfil existente
      const newTotal = existing.totalHunts + 1
      const newSuccess = existing.successfulHunts + (hunt.success ? 1 : 0)
      
      // Calcular nuevos promedios
      const newAvgImprovement = 
        (existing.avgImprovement * existing.totalHunts + hunt.improvement) / newTotal
      
      // Actualizar condiciones óptimas solo si fue exitoso
      let optimalConditions = existing.optimalConditions
      if (hunt.success) {
        const successCount = newSuccess
        const prev = existing.optimalConditions
        
        optimalConditions = {
          avgBeautyWhenSuccess: 
            (prev.avgBeautyWhenSuccess * (successCount - 1) + hunt.preStrikeBeauty) / successCount,
          avgConsonanceWhenSuccess:
            (prev.avgConsonanceWhenSuccess * (successCount - 1) + hunt.preStrikeConsonance) / successCount,
          avgClusterHealthWhenSuccess:
            (prev.avgClusterHealthWhenSuccess * (successCount - 1) + hunt.clusterHealth) / successCount,
          avgStalkingCycles:
            (prev.avgStalkingCycles * (successCount - 1) + hunt.stalkingCycles) / successCount
        }
      }
      
      this.preyProfiles.set(hunt.targetPattern, {
        ...existing,
        totalHunts: newTotal,
        successfulHunts: newSuccess,
        successRate: newSuccess / newTotal,
        avgImprovement: newAvgImprovement,
        bestImprovement: Math.max(existing.bestImprovement, hunt.improvement),
        worstImprovement: Math.min(existing.worstImprovement, hunt.improvement),
        optimalConditions,
        difficulty: this.calculateDifficulty(newSuccess / newTotal),
        lastHuntTimestamp: hunt.timestamp
      })
      
    } else {
      // Crear nuevo perfil
      const [note, element] = hunt.targetPattern.split('-')
      
      const newProfile: PreyProfile = {
        patternKey: hunt.targetPattern,
        note,
        element: element as ElementType,
        totalHunts: 1,
        successfulHunts: hunt.success ? 1 : 0,
        successRate: hunt.success ? 1 : 0,
        avgImprovement: hunt.improvement,
        bestImprovement: hunt.improvement,
        worstImprovement: hunt.improvement,
        optimalConditions: hunt.success ? {
          avgBeautyWhenSuccess: hunt.preStrikeBeauty,
          avgConsonanceWhenSuccess: hunt.preStrikeConsonance,
          avgClusterHealthWhenSuccess: hunt.clusterHealth,
          avgStalkingCycles: hunt.stalkingCycles
        } : {
          avgBeautyWhenSuccess: 0,
          avgConsonanceWhenSuccess: 0,
          avgClusterHealthWhenSuccess: 0,
          avgStalkingCycles: 0
        },
        difficulty: 'medium',  // Por defecto hasta tener más datos
        lastHuntTimestamp: hunt.timestamp,
        firstHuntTimestamp: hunt.timestamp
      }
      
      this.preyProfiles.set(hunt.targetPattern, newProfile)
      
      // Mantener límite de perfiles
      if (this.preyProfiles.size > this.config.maxProfilesStored) {
        // Eliminar el perfil más antiguo
        const oldest = Array.from(this.preyProfiles.entries())
          .sort((a, b) => a[1].lastHuntTimestamp - b[1].lastHuntTimestamp)[0]
        if (oldest) {
          this.preyProfiles.delete(oldest[0])
        }
      }
    }
  }
  
  /**
   * Calcular dificultad basada en success rate
   */
  private calculateDifficulty(successRate: number): 'easy' | 'medium' | 'hard' {
    if (successRate >= 0.7) return 'easy'
    if (successRate >= 0.4) return 'medium'
    return 'hard'
  }
  
  // ============================================
  // 🔍 CONSULTAR PERFILES
  // ============================================
  
  /**
   * Obtener perfil de una presa específica
   */
  getPreyProfile(patternKey: string): PreyProfile | null {
    return this.preyProfiles.get(patternKey) ?? null
  }
  
  /**
   * Obtener todos los perfiles
   */
  getAllProfiles(): PreyProfile[] {
    return Array.from(this.preyProfiles.values())
  }
  
  /**
   * Obtener perfiles ordenados por success rate
   */
  getEasiestPrey(limit: number = 5): PreyProfile[] {
    return this.getAllProfiles()
      .filter(p => p.totalHunts >= 3)  // Al menos 3 intentos
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit)
  }
  
  /**
   * Obtener perfiles con mejor mejora promedio
   */
  getMostRewardingPrey(limit: number = 5): PreyProfile[] {
    return this.getAllProfiles()
      .filter(p => p.totalHunts >= 3)
      .sort((a, b) => b.avgImprovement - a.avgImprovement)
      .slice(0, limit)
  }
  
  // ============================================
  // 💡 RECOMENDACIONES
  // ============================================
  
  /**
   * Obtener recomendación para un patrón específico
   */
  getRecommendation(patternKey: string): HuntRecommendation | null {
    const profile = this.preyProfiles.get(patternKey)
    
    if (!profile || profile.totalHunts < 2) {
      return null  // No hay suficientes datos
    }
    
    const confidence = Math.min(profile.totalHunts / 10, 1) * profile.successRate
    
    let reasoning: string
    if (profile.difficulty === 'easy') {
      reasoning = `High success pattern (${(profile.successRate * 100).toFixed(0)}% success rate)`
    } else if (profile.difficulty === 'hard') {
      reasoning = `Challenging pattern - consider waiting for optimal conditions`
    } else {
      reasoning = `Moderate difficulty - observe ${profile.optimalConditions.avgStalkingCycles.toFixed(0)} cycles recommended`
    }
    
    return {
      patternKey,
      confidence,
      reasoning,
      expectedImprovement: profile.avgImprovement,
      optimalConditions: profile.optimalConditions
    }
  }
  
  /**
   * Obtener recomendaciones para múltiples patrones
   */
  getRecommendations(patternKeys: string[]): HuntRecommendation[] {
    return patternKeys
      .map(key => this.getRecommendation(key))
      .filter((r): r is HuntRecommendation => r !== null)
      .sort((a, b) => b.confidence - a.confidence)
  }
  
  /**
   * ¿Deberíamos evitar este patrón?
   */
  shouldAvoidPattern(patternKey: string): { avoid: boolean; reason: string } {
    const profile = this.preyProfiles.get(patternKey)
    
    if (!profile) {
      return { avoid: false, reason: 'No history - worth trying' }
    }
    
    if (profile.totalHunts < 3) {
      return { avoid: false, reason: 'Insufficient data - need more attempts' }
    }
    
    if (profile.successRate < 0.2 && profile.avgImprovement < -0.1) {
      return { 
        avoid: true, 
        reason: `Poor results: ${(profile.successRate * 100).toFixed(0)}% success, avg improvement ${profile.avgImprovement.toFixed(3)}`
      }
    }
    
    return { avoid: false, reason: 'Acceptable pattern' }
  }
  
  // ============================================
  // 📊 ESTADÍSTICAS GLOBALES
  // ============================================
  
  /**
   * Obtener estadísticas globales
   */
  getGlobalStats(): {
    totalHunts: number
    totalSuccess: number
    globalSuccessRate: number
    profileCount: number
    avgImprovementGlobal: number
    bestPattern: string | null
    worstPattern: string | null
    sessionHunts: number
  } {
    const profiles = this.getAllProfiles()
    
    // Mejor y peor patrón
    const sortedBySuccess = [...profiles].sort((a, b) => b.successRate - a.successRate)
    const bestPattern = sortedBySuccess[0]?.patternKey ?? null
    const worstPattern = sortedBySuccess[sortedBySuccess.length - 1]?.patternKey ?? null
    
    // Mejora promedio global
    const avgImprovementGlobal = this.huntRecords.length > 0
      ? this.huntRecords.reduce((sum, h) => sum + h.improvement, 0) / this.huntRecords.length
      : 0
    
    // Hunts de esta sesión
    const sessionHunts = this.huntRecords.filter(h => h.sessionId === this.config.sessionId).length
    
    return {
      totalHunts: this.totalHuntsEver,
      totalSuccess: this.totalSuccessEver,
      globalSuccessRate: this.totalHuntsEver > 0 ? this.totalSuccessEver / this.totalHuntsEver : 0,
      profileCount: profiles.length,
      avgImprovementGlobal,
      bestPattern,
      worstPattern,
      sessionHunts
    }
  }
  
  /**
   * Obtener historial de hunts recientes
   */
  getRecentHunts(limit: number = 20): HuntRecord[] {
    return this.huntRecords.slice(-limit)
  }
  
  /**
   * Obtener hunts de la sesión actual
   */
  getSessionHunts(): HuntRecord[] {
    return this.huntRecords.filter(h => h.sessionId === this.config.sessionId)
  }
  
  // ============================================
  // 💾 PERSISTENCIA (EXPORT/IMPORT)
  // ============================================
  
  /**
   * Exportar datos para persistencia externa
   */
  exportData(): {
    hunts: HuntRecord[]
    profiles: [string, PreyProfile][]
    stats: { totalHunts: number; totalSuccess: number }
  } {
    return {
      hunts: this.huntRecords,
      profiles: Array.from(this.preyProfiles.entries()),
      stats: {
        totalHunts: this.totalHuntsEver,
        totalSuccess: this.totalSuccessEver
      }
    }
  }
  
  /**
   * Importar datos de persistencia externa
   */
  importData(data: ReturnType<PreyRecognitionEngine['exportData']>): void {
    this.huntRecords = data.hunts
    this.preyProfiles = new Map(data.profiles)
    this.totalHuntsEver = data.stats.totalHunts
    this.totalSuccessEver = data.stats.totalSuccess
    
    console.log(`🧠 [PREY-RECOGNITION] Imported ${data.hunts.length} hunts, ${data.profiles.length} profiles`)
  }
  
  // ============================================
  // 🔧 UTILIDADES
  // ============================================
  
  /** Iniciar nueva sesión */
  startNewSession(): void {
    this.config.sessionId = `session_${Date.now()}`
    console.log(`🧠 [PREY-RECOGNITION] New session: ${this.config.sessionId}`)
  }
  
  /** Reset del motor */
  reset(): void {
    this.huntRecords = []
    this.preyProfiles.clear()
    this.totalHuntsEver = 0
    this.totalSuccessEver = 0
    this.startNewSession()
    console.log('🧠 [PREY-RECOGNITION] Engine reset')
  }
  
  /** Limpiar hunts antiguos (mantener solo recientes) */
  pruneOldHunts(keepDays: number = 7): number {
    const cutoff = Date.now() - (keepDays * 24 * 60 * 60 * 1000)
    const before = this.huntRecords.length
    this.huntRecords = this.huntRecords.filter(h => h.timestamp > cutoff)
    const pruned = before - this.huntRecords.length
    
    if (pruned > 0) {
      console.log(`🧠 [PREY-RECOGNITION] Pruned ${pruned} old hunts`)
    }
    
    return pruned
  }
}
