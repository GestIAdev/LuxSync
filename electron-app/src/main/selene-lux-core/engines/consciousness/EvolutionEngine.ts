/**
 * 🧬 EVOLUTION ENGINE
 * Sistema de aprendizaje y adaptación gradual
 * 
 * Basado en: EvolutionEngine de Auditoría 1
 * - Evalúa qué patrones funcionan mejor
 * - Evoluciona paletas y patrones exitosos
 * - Memoria de sesiones anteriores
 */

import type {
  EngineConfig,
  LightMode,
  PaletteId,
  MovementPattern,
  AudioMetrics,
} from '../../types'
import type { BeatState } from '../audio/BeatDetector'

/**
 * Fitness score de una configuración
 */
interface FitnessRecord {
  config: {
    mode: LightMode
    palette: PaletteId
    movement: MovementPattern
  }
  score: number         // 0-1
  uses: number          // Cuántas veces se ha usado
  lastUsed: number      // Timestamp
  contexts: string[]    // Contextos donde funcionó bien
}

/**
 * Contexto musical para evaluación
 */
interface MusicalContext {
  energyLevel: 'low' | 'medium' | 'high'
  bpmRange: 'slow' | 'medium' | 'fast'
  dominantFreq: 'bass' | 'mid' | 'treble'
}

/**
 * Mutación para evolución
 */
interface Mutation {
  type: 'mode' | 'palette' | 'movement'
  from: string
  to: string
  fitness: number
}

/**
 * 🧬 EvolutionEngine
 */
export class EvolutionEngine {
  private population: FitnessRecord[] = []
  private mutations: Mutation[] = []
  private generation = 0
  
  // Configuración
  private readonly populationSize: number
  private readonly mutationRate: number
  private readonly elitismRate: number
  
  // Estado actual
  private currentConfig: FitnessRecord['config']
  private currentContext: MusicalContext | null = null
  private sessionStartTime: number
  
  // Historial de energía para contexto
  private energyHistory: number[] = []
  
  constructor(config: Partial<EngineConfig> = {}) {
    this.populationSize = 20
    this.mutationRate = 0.2
    this.elitismRate = 0.1
    
    this.currentConfig = {
      mode: 'reactive',
      palette: 'fire',
      movement: 'lissajous',
    }
    
    this.sessionStartTime = Date.now()
    
    // Inicializar población base
    this.initializePopulation()
  }
  
  /**
   * Inicializar población con configuraciones predeterminadas
   */
  private initializePopulation(): void {
    const modes: LightMode[] = ['reactive', 'ambient', 'show', 'sync']
    const palettes: PaletteId[] = ['fire', 'ocean', 'forest', 'sunset', 'neon', 'cosmic']
    const movements: MovementPattern[] = ['lissajous', 'circle', 'wave', 'figure8', 'scan', 'random']
    
    // Crear combinaciones iniciales con fitness neutro
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push({
        config: {
          mode: modes[i % modes.length],
          palette: palettes[i % palettes.length],
          movement: movements[i % movements.length],
        },
        score: 0.5, // Neutral inicial
        uses: 0,
        lastUsed: 0,
        contexts: [],
      })
    }
  }
  
  /**
   * Actualizar contexto musical basado en métricas
   */
  updateContext(metrics: AudioMetrics, beatState: BeatState): void {
    this.energyHistory.push(metrics.energy)
    if (this.energyHistory.length > 60) {
      this.energyHistory.shift()
    }
    
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    
    this.currentContext = {
      energyLevel: avgEnergy < 0.33 ? 'low' : avgEnergy < 0.66 ? 'medium' : 'high',
      bpmRange: beatState.bpm < 100 ? 'slow' : beatState.bpm < 140 ? 'medium' : 'fast',
      dominantFreq: metrics.bass > metrics.mid && metrics.bass > metrics.treble 
        ? 'bass' 
        : metrics.mid > metrics.treble ? 'mid' : 'treble',
    }
  }
  
  /**
   * Evaluar fitness de configuración actual
   * Llamado periódicamente o cuando el usuario cambia manualmente
   */
  evaluate(
    wasManualChange: boolean,
    userSatisfaction: number = 0.5 // 0-1, inferido por comportamiento
  ): void {
    // Encontrar o crear record para config actual
    let record = this.population.find(
      r => r.config.mode === this.currentConfig.mode &&
           r.config.palette === this.currentConfig.palette &&
           r.config.movement === this.currentConfig.movement
    )
    
    if (!record) {
      record = {
        config: { ...this.currentConfig },
        score: 0.5,
        uses: 0,
        lastUsed: Date.now(),
        contexts: [],
      }
      this.population.push(record)
    }
    
    // Actualizar score
    // Cambio manual = el usuario no estaba satisfecho
    if (wasManualChange) {
      record.score = Math.max(0, record.score - 0.1)
    } else {
      // Usar más tiempo = satisfacción implícita
      const timeFactor = Math.min(1, (Date.now() - record.lastUsed) / 60000) // 1 min
      record.score = record.score * 0.9 + userSatisfaction * 0.1 * timeFactor
    }
    
    record.uses++
    record.lastUsed = Date.now()
    
    // Guardar contexto donde funcionó bien
    if (this.currentContext && record.score > 0.6) {
      const contextKey = `${this.currentContext.energyLevel}-${this.currentContext.bpmRange}-${this.currentContext.dominantFreq}`
      if (!record.contexts.includes(contextKey)) {
        record.contexts.push(contextKey)
      }
    }
  }
  
  /**
   * Sugerir configuración basada en contexto actual
   */
  suggest(): FitnessRecord['config'] {
    if (!this.currentContext) {
      return this.currentConfig
    }
    
    const contextKey = `${this.currentContext.energyLevel}-${this.currentContext.bpmRange}-${this.currentContext.dominantFreq}`
    
    // Buscar configuraciones que funcionaron bien en este contexto
    const suitable = this.population
      .filter(r => r.contexts.includes(contextKey) && r.score > 0.5)
      .sort((a, b) => b.score - a.score)
    
    if (suitable.length > 0) {
      // Con probabilidad de mutación, mutar la mejor
      if (Math.random() < this.mutationRate) {
        return this.mutate(suitable[0].config)
      }
      return suitable[0].config
    }
    
    // Fallback: mejor score general
    const best = [...this.population].sort((a, b) => b.score - a.score)[0]
    return best?.config ?? this.currentConfig
  }
  
  /**
   * Mutar una configuración
   */
  private mutate(config: FitnessRecord['config']): FitnessRecord['config'] {
    const mutated = { ...config }
    
    const modes: LightMode[] = ['reactive', 'ambient', 'show', 'sync']
    const palettes: PaletteId[] = ['fire', 'ocean', 'forest', 'sunset', 'neon', 'cosmic']
    const movements: MovementPattern[] = ['lissajous', 'circle', 'wave', 'figure8', 'scan', 'random', 'static']
    
    const mutationType = Math.floor(Math.random() * 3)
    
    switch (mutationType) {
      case 0:
        mutated.mode = modes[Math.floor(Math.random() * modes.length)]
        break
      case 1:
        mutated.palette = palettes[Math.floor(Math.random() * palettes.length)]
        break
      case 2:
        mutated.movement = movements[Math.floor(Math.random() * movements.length)]
        break
    }
    
    this.mutations.push({
      type: ['mode', 'palette', 'movement'][mutationType] as 'mode' | 'palette' | 'movement',
      from: String(config[['mode', 'palette', 'movement'][mutationType] as keyof typeof config]),
      to: String(mutated[['mode', 'palette', 'movement'][mutationType] as keyof typeof mutated]),
      fitness: 0, // Se evaluará después
    })
    
    return mutated
  }
  
  /**
   * Evolucionar población (llamar periódicamente)
   */
  evolve(): void {
    this.generation++
    
    // Ordenar por fitness
    this.population.sort((a, b) => b.score - a.score)
    
    // Mantener elite
    const eliteCount = Math.floor(this.population.length * this.elitismRate)
    const elite = this.population.slice(0, eliteCount)
    
    // Crear nueva generación
    const newPopulation: FitnessRecord[] = [...elite]
    
    while (newPopulation.length < this.populationSize) {
      // Selección por torneo
      const parent = this.tournamentSelect()
      
      // Mutación
      const childConfig = Math.random() < this.mutationRate
        ? this.mutate(parent.config)
        : { ...parent.config }
      
      newPopulation.push({
        config: childConfig,
        score: 0.5, // Reset para nueva variante
        uses: 0,
        lastUsed: 0,
        contexts: [],
      })
    }
    
    this.population = newPopulation.slice(0, this.populationSize)
  }
  
  /**
   * Selección por torneo
   */
  private tournamentSelect(): FitnessRecord {
    const tournamentSize = 3
    const contestants: FitnessRecord[] = []
    
    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length)
      contestants.push(this.population[idx])
    }
    
    return contestants.sort((a, b) => b.score - a.score)[0]
  }
  
  /**
   * Setters
   */
  setCurrentConfig(config: Partial<FitnessRecord['config']>): void {
    this.currentConfig = { ...this.currentConfig, ...config }
  }
  
  /**
   * Obtener estadísticas
   */
  getStats(): {
    generation: number
    populationSize: number
    bestScore: number
    avgScore: number
    mutations: number
  } {
    const scores = this.population.map(r => r.score)
    return {
      generation: this.generation,
      populationSize: this.population.length,
      bestScore: Math.max(...scores),
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      mutations: this.mutations.length,
    }
  }
  
  /**
   * Exportar estado para persistencia
   */
  exportState(): object {
    return {
      population: this.population,
      generation: this.generation,
      sessionDuration: Date.now() - this.sessionStartTime,
    }
  }
  
  /**
   * Importar estado guardado
   */
  importState(state: { population?: FitnessRecord[]; generation?: number }): void {
    if (state.population) {
      this.population = state.population
    }
    if (state.generation) {
      this.generation = state.generation
    }
  }
}
