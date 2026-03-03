/**
 * 🏛️ WAVE 227: TRINITY BRAIN (REAL RECEPTOR)
 * 
 * CAPA CEREBRO - Análisis Musical
 * 
 * El Cerebro RECIBE contexto musical del Worker (mind.ts) via TrinityOrchestrator.
 * NO decide colores. NO conoce DMX. Solo describe QUÉ SUENA.
 * 
 * PHASE 3: The Lobotomy - Brain es ahora un RECEPTOR puro.
 * El Worker analiza, el Brain almacena, el Engine decide.
 * 
 * @layer CEREBRO
 * @version TITAN 2.0 (REAL)
 */

import { EventEmitter } from 'events'
import {
  type MusicalContext,
  createDefaultMusicalContext,
} from '../core/protocol'

// Importar TrinityOrchestrator para conexión con Workers
import { TrinityOrchestrator } from '../workers/TrinityOrchestrator'
import type { AudioAnalysis } from '../workers/WorkerProtocol'

/**
 * Eventos que emite TrinityBrain
 */
export interface TrinityBrainEvents {
  'context-update': (context: MusicalContext) => void
  'audio-levels': (levels: { bass: number; mid: number; treble: number; energy: number }) => void
  'ready': () => void
  'error': (error: Error) => void
}

/**
 * 🧠 TRINITY BRAIN
 * 
 * Receptor del análisis musical. Conecta con TrinityOrchestrator
 * para recibir datos del Worker mind.ts y convertirlos a MusicalContext.
 * 
 * WAVE 227: Ya no es un stub - es un receptor REAL.
 */
export class TrinityBrain extends EventEmitter {
  private lastContext: MusicalContext
  private orchestrator: TrinityOrchestrator | null = null
  private isConnected: boolean = false
  private lastAudioAnalysis: AudioAnalysis | null = null
  private frameCount: number = 0
  
  // 🧠 WAVE 260: SHORT-TERM MEMORY
  // El cerebro recuerda el último contexto VÁLIDO por 5 segundos.
  // Esto evita el "flicker" cuando hay micro-silencios o drops de energía.
  private lastValidContext: MusicalContext | null = null
  private lastValidTimestamp: number = 0
  private static readonly MEMORY_DURATION_MS = 5000 // 5 segundos de memoria
  
  constructor() {
    super()
    this.lastContext = createDefaultMusicalContext()
    // WAVE 2098: Boot silence
  }

  /**
   * Conecta con TrinityOrchestrator para recibir datos del Worker.
   * Debe llamarse después de que el orquestador esté listo.
   */
  public connectToOrchestrator(orchestrator: TrinityOrchestrator): void {
    if (this.orchestrator) {
      console.warn('[Brain] 🧠 Already connected to orchestrator')
      return
    }

    this.orchestrator = orchestrator
    
    // 🧠 WAVE 230: THE LOBOTOMY - Recibir contexto PURO del Worker
    // El Worker (mind.ts) ahora emite MusicalContext directamente.
    // Esta es la fuente PRIMARIA de contexto para TITAN 2.0.
    orchestrator.on('context-update', (context: MusicalContext) => {
      this.handleContextUpdate(context)
    })
    
    // Escuchar análisis de audio del Worker (BETA)
    // Mantener para legacy y para calcular niveles de audio
    orchestrator.on('audio-analysis', (analysis: AudioAnalysis) => {
      this.handleAudioAnalysis(analysis)
    })

    // Escuchar cuando el orquestador está listo
    orchestrator.on('ready', () => {
      this.isConnected = true
      this.emit('ready')
    })

    // Escuchar errores del Worker
    orchestrator.on('worker-error', (nodeId, error) => {
      console.error(`[Brain] 🧠 Worker ${nodeId} error:`, error)
      this.emit('error', new Error(`Worker ${nodeId}: ${error}`))
    })

    // WAVE 2098: Boot silence
  }

  /**
   * Inicia el orquestador si tenemos uno conectado
   */
  public async start(): Promise<void> {
    if (!this.orchestrator) {
      // Crear orquestador interno si no hay uno externo
      this.orchestrator = new TrinityOrchestrator()
      this.connectToOrchestrator(this.orchestrator)
    }

    try {
      await this.orchestrator.start()
    } catch (error) {
      console.error('[Brain] 🧠 Failed to start orchestrator:', error)
      throw error
    }
  }

  /**
   * 🧠 WAVE 230: THE LOBOTOMY
   * 
   * Recibe MusicalContext PURO del Worker (mind.ts).
   * Esta es la fuente PRIMARIA de contexto para TITAN 2.0.
   * 
   * El Worker ahora hace el trabajo pesado de análisis y construcción.
   * TrinityBrain solo almacena y propaga el contexto.
   * 
   * 🧠 WAVE 260: SHORT-TERM MEMORY
   * Si el contexto tiene Key válida, lo guardamos como referencia.
   * Esto evita que micro-silencios borren la información musical.
   */
  private handleContextUpdate(context: MusicalContext): void {
    this.lastContext = context
    this.isConnected = true
    
    // 🧠 WAVE 260: Guardar en memoria si el contexto es VÁLIDO
    // Un contexto es válido si tiene Key detectada o género conocido
    const hasValidKey = context.key !== null
    const hasValidGenre = context.genre.macro !== 'UNKNOWN'
    
    if (hasValidKey || hasValidGenre) {
      this.lastValidContext = context
      this.lastValidTimestamp = Date.now()
    }
    
    // Emitir evento de actualización para que TitanEngine pueda escuchar
    this.emit('context-update', context)
    
    // Log cada ~60 contextos (aproximadamente 1 segundo @ 60fps)
    this.frameCount++
    // 🧹 WAVE 671.5: Silenced LOBOTOMY spam (kept for future debug if needed)
    // if (this.frameCount % 60 === 0) {
    //   const memoryAge = this.lastValidContext 
    //     ? ((Date.now() - this.lastValidTimestamp) / 1000).toFixed(1) 
    //     : 'N/A'
    //   console.log(
    //     `[Brain] 🧠 LOBOTOMY Context: ${context.genre.macro}/${context.genre.subGenre || 'unknown'} @ ${context.bpm}bpm | ` +
    //     `Section: ${context.section.type} | Energy: ${(context.energy * 100).toFixed(0)}% | Mood: ${context.mood} | ` +
    //     `Memory: ${memoryAge}s ago`
    //   )
    // }
  }

  /**
   * Procesa análisis de audio del Worker y construye MusicalContext.
   *
   * WAVE 227: Esta es LA CONVERSIÓN CLAVE.
   * El Worker envía AudioAnalysis, nosotros lo convertimos a MusicalContext.
   * 
   * WAVE 230: Este método ahora es LEGACY/FALLBACK.
   * Si recibimos MUSICAL_CONTEXT del Worker (vía handleContextUpdate),
   * ese es el contexto primario. Este método solo se usa como backup
   * y para emitir audio-levels.
   */
  private handleAudioAnalysis(analysis: AudioAnalysis): void {
    this.frameCount++
    this.lastAudioAnalysis = analysis

    // Construir MusicalContext desde AudioAnalysis del Worker
    const context: MusicalContext = {
      // Harmonic - desde analysis
      key: analysis.key ? this.parseKey(analysis.key) : null,
      mode: this.parseMode(analysis.key),
      
      // Rhythmic - directo del Worker
      bpm: analysis.bpm,
      beatPhase: analysis.beatPhase,
      syncopation: analysis.syncopation,
      
      // Structural - construir desde analysis
      section: {
        type: this.inferSectionType(analysis),
        current: this.inferSectionType(analysis),
        confidence: analysis.bpmConfidence,
        duration: this.frameCount * 33, // ~33ms por frame @ 30fps
        isTransition: analysis.beatStrength > 0.8 && analysis.onBeat,
      },
      
      // Emotional - mapear energía y mood
      energy: analysis.energy,
      mood: this.mapMood(analysis.mood, analysis.energy),
      
      // Classification - inferir macro género
      genre: {
        macro: this.inferMacroGenre(analysis),
        subGenre: this.inferSubGenre(analysis),
        confidence: analysis.bpmConfidence,
      },
      
      // Meta
      confidence: analysis.bpmConfidence,
      timestamp: analysis.timestamp,
    }

    this.lastContext = context

    // Emitir evento de actualización para que TitanEngine pueda escuchar
    this.emit('context-update', context)
    
    // Emitir niveles de audio para visualización
    // 🎸 WAVE 1011.1: Extended con métricas FFT para Physics Engines
    // 🔥 WAVE 1162: rawBassEnergy para BeatDetector bypass
    this.emit('audio-levels', {
      bass: analysis.bass,
      mid: analysis.mid,
      treble: analysis.treble,
      energy: analysis.energy,
      // 🎸 WAVE 1011.1: Bandas extendidas
      subBass: analysis.subBass,
      lowMid: analysis.lowMid,
      highMid: analysis.highMid,
      // 🎸 WAVE 1011.1: Métricas espectrales
      harshness: analysis.harshness,
      spectralFlatness: analysis.spectralFlatness,
      spectralCentroid: analysis.spectralCentroid,
      // 🎸 WAVE 1011.1: Transientes
      kickDetected: analysis.kickDetected,
      snareDetected: analysis.snareDetected,
      hihatDetected: analysis.hihatDetected,
      // 🔥 WAVE 1162: THE BYPASS - RAW BASS FOR PACEMAKER
      rawBassEnergy: analysis.rawBassEnergy,
    })

    // Log cada ~30 frames (1 segundo)
    if (this.frameCount % 30 === 0) {
      console.log(
        `[Brain] 🧠 REAL Context: ${context.genre.macro}/${context.genre.subGenre} @ ${context.bpm}bpm | ` +
        `Energy: ${(context.energy * 100).toFixed(0)}% | Mood: ${context.mood}`
      )
    }
  }

  /**
   * Obtiene el contexto musical actual.
   * 
   * WAVE 227: Ahora devuelve datos REALES del Worker.
   * Si no hay datos, devuelve contexto de silencio/idle.
   * 
   * 🧠 WAVE 260: SHORT-TERM MEMORY
   * Usa getLastContext() que implementa la memoria a corto plazo.
   * Esto evita que micro-silencios borren la información musical.
   */
  public getCurrentContext(): MusicalContext {
    // Si no estamos conectados o no hay datos recientes, devolver idle
    if (!this.isConnected || !this.lastAudioAnalysis) {
      // Pero primero, ¿tenemos memoria reciente?
      if (this.lastValidContext) {
        const age = Date.now() - this.lastValidTimestamp
        if (age < TrinityBrain.MEMORY_DURATION_MS) {
          return this.lastValidContext
        }
      }
      return this.createIdleContext()
    }
    
    // Usar getLastContext() que incluye la lógica de memoria
    return this.getLastContext()
  }

  /**
   * Crea un contexto de "silencio/idle" cuando no hay audio.
   */
  private createIdleContext(): MusicalContext {
    return {
      key: null,
      mode: 'unknown',
      bpm: 0,
      beatPhase: 0,
      syncopation: 0,
      section: {
        type: 'unknown',
        current: 'unknown',
        confidence: 0,
        duration: 0,
        isTransition: false,
      },
      energy: 0,
      mood: 'neutral',
      genre: {
        macro: 'UNKNOWN',
        subGenre: null,
        confidence: 0,
      },
      confidence: 0,
      timestamp: Date.now(),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER PARSERS - Convertir formatos del Worker a MusicalContext
  // ═══════════════════════════════════════════════════════════════════════════

  private parseKey(keyString: string | undefined): 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B' | null {
    if (!keyString) return null
    // Formato esperado: "C minor", "A major", etc.
    const match = keyString.match(/^([A-G]#?)/)
    if (match) {
      return match[1] as 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'
    }
    return null
  }

  private parseMode(keyString: string | undefined): 'major' | 'minor' | 'unknown' {
    if (!keyString) return 'unknown'
    if (keyString.toLowerCase().includes('minor')) return 'minor'
    if (keyString.toLowerCase().includes('major')) return 'major'
    return 'unknown'
  }

  private inferSectionType(analysis: AudioAnalysis): 'intro' | 'verse' | 'chorus' | 'bridge' | 'breakdown' | 'buildup' | 'drop' | 'outro' | 'unknown' {
    // Inferir sección basándose en energía y características rítmicas
    const { energy, bass, beatStrength, syncopation } = analysis
    
    if (energy > 0.85 && bass > 0.7 && beatStrength > 0.8) {
      return 'drop'
    }
    if (energy > 0.7 && beatStrength > 0.6) {
      return 'chorus'
    }
    if (energy < 0.3 && bass < 0.3) {
      return 'breakdown'
    }
    if (energy > 0.5 && energy < 0.7 && syncopation > 0.5) {
      return 'buildup'
    }
    if (energy < 0.5) {
      return 'verse'
    }
    
    return 'unknown'
  }

  private mapMood(
    workerMood: 'dark' | 'bright' | 'neutral' | undefined,
    energy: number
  ): 'euphoric' | 'melancholic' | 'aggressive' | 'dreamy' | 'neutral' | 'mysterious' | 'triumphant' {
    if (!workerMood) return 'neutral'
    
    if (workerMood === 'bright') {
      return energy > 0.7 ? 'euphoric' : 'triumphant'
    }
    if (workerMood === 'dark') {
      return energy > 0.7 ? 'aggressive' : 'melancholic'
    }
    
    return energy > 0.6 ? 'neutral' : 'dreamy'
  }

  private inferMacroGenre(analysis: AudioAnalysis): 'ELECTRONIC' | 'LATIN' | 'ROCK' | 'POP' | 'CHILL' | 'UNKNOWN' {
    // Heurística basada en características del audio
    const { bpm, syncopation, bass, treble } = analysis
    
    // Electrónica: 120-150 BPM, bajo fuerte, agudos brillantes
    if (bpm >= 120 && bpm <= 150 && bass > 0.6) {
      return 'ELECTRONIC'
    }
    
    // Latino: 90-130 BPM, alta sincopación
    if (bpm >= 90 && bpm <= 130 && syncopation > 0.5) {
      return 'LATIN'
    }
    
    // Rock: 100-140 BPM, medios fuertes
    if (bpm >= 100 && bpm <= 140 && analysis.mid > 0.6) {
      return 'ROCK'
    }
    
    // Chill: BPM bajo, energía baja
    if (bpm < 100 && analysis.energy < 0.5) {
      return 'CHILL'
    }
    
    // Pop: Rango general
    if (bpm >= 100 && bpm <= 130) {
      return 'POP'
    }
    
    return 'UNKNOWN'
  }

  private inferSubGenre(analysis: AudioAnalysis): string | null {
    const macro = this.inferMacroGenre(analysis)
    const { bpm, syncopation, bass } = analysis
    
    switch (macro) {
      case 'ELECTRONIC':
        if (bpm >= 140) return 'techno'
        if (bpm >= 128 && bass > 0.7) return 'house'
        if (syncopation > 0.6) return 'drum-n-bass'
        return 'electronic'
        
      case 'LATIN':
        if (syncopation > 0.7) return 'salsa'
        if (bpm >= 100 && bpm <= 115) return 'cumbia'
        if (bpm >= 115) return 'reggaeton'
        return 'latin'
        
      case 'ROCK':
        if (bass > 0.7) return 'metal'
        if (analysis.mid > 0.7) return 'alternative'
        return 'rock'
        
      case 'CHILL':
        return 'ambient'
        
      default:
        return null
    }
  }

  /**
   * 🧠 WAVE 260: SHORT-TERM MEMORY
   * 
   * Obtener el contexto actual con memoria a corto plazo.
   * Si el contexto actual es "vacío" (UNKNOWN, sin Key), pero tenemos
   * un contexto válido de hace menos de 5 segundos, devolvemos ese.
   * 
   * Esto evita el "flicker" en la UI cuando hay micro-silencios.
   */
  public getLastContext(): MusicalContext {
    const current = this.lastContext
    
    // Si el contexto actual tiene información válida, devolverlo
    const currentHasValidKey = current.key !== null
    const currentHasValidGenre = current.genre.macro !== 'UNKNOWN'
    
    if (currentHasValidKey || currentHasValidGenre) {
      return current
    }
    
    // El contexto actual está vacío... ¿tenemos memoria?
    if (this.lastValidContext) {
      const age = Date.now() - this.lastValidTimestamp
      
      // Si la memoria tiene menos de 5 segundos, usarla
      if (age < TrinityBrain.MEMORY_DURATION_MS) {
        // Log cuando usamos memoria (pero no spammear)
        if (this.frameCount % 120 === 0) {
          console.log(
            `[Brain] 🧠 Using SHORT-TERM MEMORY (${(age / 1000).toFixed(1)}s old): ` +
            `Key=${this.lastValidContext.key ?? 'null'} ${this.lastValidContext.mode} | ` +
            `Genre=${this.lastValidContext.genre.macro}`
          )
        }
        return this.lastValidContext
      }
    }
    
    // No hay memoria válida, devolver el contexto vacío
    return current
  }

  /**
   * Verificar si estamos recibiendo datos reales.
   */
  public isReceivingRealData(): boolean {
    return this.isConnected && this.lastAudioAnalysis !== null
  }

  /**
   * Obtener estadísticas del Brain.
   */
  public getStats(): { framesProcessed: number; isConnected: boolean; lastBPM: number } {
    return {
      framesProcessed: this.frameCount,
      isConnected: this.isConnected,
      lastBPM: this.lastContext.bpm,
    }
  }

  /**
   * Destruir recursos
   */
  public async destroy(): Promise<void> {
    if (this.orchestrator) {
      await this.orchestrator.stop()
      this.orchestrator = null
    }
    this.isConnected = false
    this.removeAllListeners()
    console.log('[Brain] 🧠 TrinityBrain destroyed')
  }
}
