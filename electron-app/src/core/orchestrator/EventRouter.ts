/**
 * 🌊 WAVE 240: EVENT ROUTER
 * 
 * Centraliza el flujo de eventos internos (no IPC).
 * Configura las tuberías: Brain → Engine → HAL
 * 
 * @module EventRouter
 */

import { EventEmitter } from 'events'
import type { MusicalContext } from '../protocol/MusicalContext'
import type { LightingIntent } from '../protocol/LightingIntent'

/**
 * Eventos que el EventRouter puede manejar
 */
export interface EventRouterEvents {
  // Brain → Engine
  'context-update': (context: MusicalContext) => void
  'audio-analysis': (analysis: AudioAnalysis) => void
  
  // Engine → HAL
  'lighting-intent': (intent: LightingIntent) => void
  
  // HAL → DMX
  'dmx-output': (packet: DMXPacket) => void
  
  // System events
  'system-start': () => void
  'system-stop': () => void
  'error': (error: Error, source: string) => void
}

export interface AudioAnalysis {
  bass: number
  mid: number
  high: number
  energy: number
  beatPhase?: number
  isBeat?: boolean
}

export interface DMXPacket {
  universe: number
  channels: Uint8Array
}

/**
 * Interfaces para los módulos que se conectarán
 */
export interface BrainModule extends EventEmitter {
  getCurrentContext(): MusicalContext
  connectToOrchestrator?(orchestrator: EventEmitter): void
}

export interface EngineModule extends EventEmitter {
  process(context: MusicalContext, audioMetrics?: AudioAnalysis): LightingIntent
  setVibe?(vibeId: string): void
}

export interface HALModule extends EventEmitter {
  render(intent: LightingIntent): DMXPacket[]
  sendDMX?(packet: DMXPacket): void
}

/**
 * 🔄 EventRouter - La Centralita de TITAN 2.0
 * 
 * Conecta los módulos principales y enruta eventos entre ellos:
 * - Brain (TrinityBrain) produce MusicalContext
 * - Engine (TitanEngine) produce LightingIntent
 * - HAL (HardwareAbstraction) produce DMX Output
 */
export class EventRouter extends EventEmitter {
  private brain: BrainModule | null = null
  private engine: EngineModule | null = null
  private hal: HALModule | null = null
  
  private isRunning = false
  private frameCount = 0
  private lastLogTime = 0
  
  constructor() {
    super()
    console.log('[EventRouter] 🔄 Initialized (WAVE 240)')
  }

  /**
   * Conecta los tres módulos principales
   */
  public connect(brain: BrainModule, engine: EngineModule, hal: HALModule): void {
    this.brain = brain
    this.engine = engine
    this.hal = hal
    
    console.log('[EventRouter] 🔗 Connecting modules...')
    
    // ═══════════════════════════════════════════════════════════════════════
    // BRAIN → ENGINE: MusicalContext
    // ═══════════════════════════════════════════════════════════════════════
    
    brain.on('context-update', (context: MusicalContext) => {
      if (!this.isRunning) return
      
      this.frameCount++
      
      try {
        // Procesar en el engine
        const intent = engine.process(context)
        
        // Emitir para el siguiente paso
        this.emit('lighting-intent', intent)
        
        // Log throttled (cada 30 frames)
        if (this.frameCount % 30 === 0) {
          const now = Date.now()
          if (now - this.lastLogTime > 1000) {
            console.log(`[EventRouter] 🔄 Frame ${this.frameCount}: context → intent`)
            this.lastLogTime = now
          }
        }
      } catch (err) {
        this.emit('error', err as Error, 'brain→engine')
      }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // ENGINE → HAL: LightingIntent
    // ═══════════════════════════════════════════════════════════════════════
    
    this.on('lighting-intent', (intent: LightingIntent) => {
      if (!this.isRunning) return
      
      try {
        // Renderizar en HAL
        const dmxPackets = hal.render(intent)
        
        // Enviar cada paquete DMX
        for (const packet of dmxPackets) {
          this.emit('dmx-output', packet)
          hal.sendDMX?.(packet)
        }
      } catch (err) {
        this.emit('error', err as Error, 'engine→hal')
      }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // HAL → DMX (Final output)
    // ═══════════════════════════════════════════════════════════════════════
    
    this.on('dmx-output', (packet: DMXPacket) => {
      // El HAL ya envía directamente, esto es para observadores externos
      // (visualizadores, logging, etc.)
    })

    console.log('[EventRouter] ✅ All modules connected')
    console.log('[EventRouter]    Brain  → [context-update] → Engine')
    console.log('[EventRouter]    Engine → [lighting-intent] → HAL')
    console.log('[EventRouter]    HAL    → [dmx-output] → Hardware')
  }

  /**
   * Inicia el routing de eventos
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('[EventRouter] ⚠️ Already running')
      return
    }
    
    this.isRunning = true
    this.frameCount = 0
    this.lastLogTime = Date.now()
    
    console.log('[EventRouter] ▶️ Started')
    this.emit('system-start')
  }

  /**
   * Detiene el routing de eventos
   */
  public stop(): void {
    if (!this.isRunning) {
      return
    }
    
    this.isRunning = false
    console.log(`[EventRouter] ⏹️ Stopped after ${this.frameCount} frames`)
    this.emit('system-stop')
  }

  /**
   * Inyecta un contexto manualmente (para tests o modo manual)
   */
  public injectContext(context: MusicalContext): void {
    if (!this.engine) {
      console.warn('[EventRouter] ⚠️ No engine connected')
      return
    }
    
    const intent = this.engine.process(context)
    this.emit('lighting-intent', intent)
  }

  /**
   * Inyecta audio analysis directamente al brain
   */
  public injectAudio(analysis: AudioAnalysis): void {
    this.emit('audio-analysis', analysis)
  }

  /**
   * Obtiene estadísticas del router
   */
  public getStats(): { 
    isRunning: boolean
    frameCount: number
    hasBrain: boolean
    hasEngine: boolean
    hasHAL: boolean
  } {
    return {
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      hasBrain: this.brain !== null,
      hasEngine: this.engine !== null,
      hasHAL: this.hal !== null,
    }
  }

  /**
   * Destruye el router y limpia listeners
   */
  public destroy(): void {
    this.stop()
    this.removeAllListeners()
    this.brain = null
    this.engine = null
    this.hal = null
    console.log('[EventRouter] 🗑️ Destroyed')
  }
}

/**
 * Singleton instance para uso global
 */
let eventRouterInstance: EventRouter | null = null

export function getEventRouter(): EventRouter {
  if (!eventRouterInstance) {
    eventRouterInstance = new EventRouter()
  }
  return eventRouterInstance
}

export function resetEventRouter(): void {
  if (eventRouterInstance) {
    eventRouterInstance.destroy()
    eventRouterInstance = null
  }
}
