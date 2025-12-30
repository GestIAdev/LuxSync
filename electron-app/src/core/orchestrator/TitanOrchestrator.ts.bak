/**
 * 🌊 WAVE 243: TITAN ORCHESTRATOR
 * 
 * La clase maestra que orquesta todo TITAN 2.0.
 * Inicializa Brain, Engine, HAL, carga Config y conecta el EventRouter.
 * 
 * main.ts solo debe llamar: TitanOrchestrator.init() y .start()
 * 
 * @module TitanOrchestrator
 */

import { BrowserWindow } from 'electron'
import { EventRouter, getEventRouter } from './EventRouter'
import { setupIPCHandlers, setupVibeHandlers, setupAudioFrameHandlers } from './IPCHandlers'
import type { IPCDependencies, IPCState, IPCCallbacks } from './IPCHandlers'
import type { MusicalContext } from '../protocol/MusicalContext'

// Types for modules
import type { TrinityBrain } from '../../brain/TrinityBrain'
import type { TitanEngine } from '../../engine/TitanEngine'
import type { HardwareAbstraction } from '../../hal/HardwareAbstraction'

/**
 * Configuración del orquestador
 */
export interface TitanConfig {
  debug?: boolean
  initialVibe?: string
  titanEnabled?: boolean
}

/**
 * Estado interno del orquestador
 */
interface TitanState {
  isInitialized: boolean
  isRunning: boolean
  mainLoopInterval: NodeJS.Timeout | null
  frameCount: number
}

/**
 * 🏛️ TitanOrchestrator - El Jefe de TITAN 2.0
 * 
 * Responsabilidades:
 * - Inicializar todos los módulos (Brain, Engine, HAL)
 * - Configurar el EventRouter para conectar los módulos
 * - Registrar handlers IPC
 * - Gestionar el ciclo de vida del sistema
 * 
 * NO hace:
 * - Lógica de negocio
 * - Cálculos de audio
 * - Generación de colores
 * - Gestión de DMX directo
 */
export class TitanOrchestrator {
  private brain: TrinityBrain | null = null
  private engine: TitanEngine | null = null
  private hal: HardwareAbstraction | null = null
  private eventRouter: EventRouter
  
  private mainWindow: BrowserWindow | null = null
  private config: TitanConfig
  private state: TitanState
  
  // Estado compartido para IPC
  private ipcState: IPCState
  
  // External dependencies (injected)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private externalDeps: Record<string, any> = {}

  constructor(config: TitanConfig = {}) {
    this.config = {
      debug: false,
      initialVibe: 'pop-rock',
      titanEnabled: true,
      ...config,
    }
    
    this.state = {
      isInitialized: false,
      isRunning: false,
      mainLoopInterval: null,
      frameCount: 0,
    }
    
    this.ipcState = {
      patchedFixtures: [],
      manualOverrides: new Map(),
      blackoutActive: false,
      lastFixtureStatesForBroadcast: [],
      zoneCounters: { front: 0, back: 0, left: 0, right: 0, ground: 0 },
    }
    
    this.eventRouter = getEventRouter()
    
    console.log('[TitanOrchestrator] 🏛️ Created (WAVE 243)')
  }

  /**
   * Inyecta dependencias externas (drivers, managers, etc.)
   */
  public setExternalDependencies(deps: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    universalDMX: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    artNetDriver: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configManager: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    showManager: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getTrinity: () => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    selene?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effectsEngine?: any
  }): void {
    this.externalDeps = deps
    console.log('[TitanOrchestrator] 💉 External dependencies injected')
  }

  /**
   * Inicializa todos los módulos TITAN 2.0
   */
  public async init(): Promise<void> {
    if (this.state.isInitialized) {
      console.warn('[TitanOrchestrator] ⚠️ Already initialized')
      return
    }

    console.log('[TitanOrchestrator] 🏛️ ═══════════════════════════════════════════════════')
    console.log('[TitanOrchestrator] 🏛️   INITIALIZING TITAN 2.0')
    console.log('[TitanOrchestrator] 🏛️ ═══════════════════════════════════════════════════')

    try {
      // 1. Importar módulos dinámicamente (evita circular deps)
      const { TrinityBrain } = await import('../../brain/TrinityBrain')
      const { TitanEngine } = await import('../../engine/TitanEngine')
      const { HardwareAbstraction } = await import('../../hal/HardwareAbstraction')

      // 2. Crear instancias
      this.brain = new TrinityBrain()
      this.engine = new TitanEngine({
        debug: this.config.debug,
        initialVibe: this.config.initialVibe as 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge',
      })
      this.hal = new HardwareAbstraction({ debug: this.config.debug })

      console.log('[TitanOrchestrator] 🏛️   ✅ TrinityBrain    → REAL (WAVE 230.5)')
      console.log('[TitanOrchestrator] 🏛️   ✅ TitanEngine     → REAL (Color Constitution)')
      console.log('[TitanOrchestrator] 🏛️   ✅ HardwareAbstraction → REAL (Physics + DMX)')

      // 3. Conectar Brain al TrinityOrchestrator si está disponible
      if (this.externalDeps.getTrinity) {
        try {
          const trinity = this.externalDeps.getTrinity()
          if (trinity && this.brain.connectToOrchestrator) {
            this.brain.connectToOrchestrator(trinity)
            console.log('[TitanOrchestrator] 🔗 TrinityBrain connected to Worker Orchestrator')
          }
        } catch {
          console.log('[TitanOrchestrator] ⚠️ Trinity not ready - Brain will use simulated context')
        }
      }

      // 4. Conectar módulos al EventRouter
      this.eventRouter.connect(
        this.brain as unknown as import('./EventRouter').BrainModule,
        this.engine as unknown as import('./EventRouter').EngineModule,
        this.hal as unknown as import('./EventRouter').HALModule
      )

      // 5. Registrar IPC handlers
      this.setupIPC()

      this.state.isInitialized = true
      
      console.log('[TitanOrchestrator] 🏛️ ═══════════════════════════════════════════════════')
      console.log('[TitanOrchestrator] 🏛️   TITAN 2.0 INITIALIZED')
      console.log('[TitanOrchestrator] 🏛️   Brain → Engine → HAL → DMX')
      console.log('[TitanOrchestrator] 🏛️ ═══════════════════════════════════════════════════')

    } catch (error) {
      console.error('[TitanOrchestrator] ❌ Initialization failed:', error)
      throw error
    }
  }

  /**
   * Configura los handlers IPC
   */
  private setupIPC(): void {
    const callbacks: IPCCallbacks = {
      startMainLoop: () => this.startMainLoop(),
      stopMainLoop: () => this.stopMainLoop(),
      initSeleneLux: () => {
        // Legacy callback - TITAN 2.0 usa su propio sistema
        console.log('[TitanOrchestrator] 📦 initSeleneLux called (delegating to TITAN)')
      },
      autoAssignZone: (type: string, name: string) => {
        return this.autoAssignZone(type, name)
      },
      recalculateZoneCounters: () => {
        this.recalculateZoneCounters()
      },
      runSeleneDiagnostics: () => {
        console.log('[TitanOrchestrator] 🔬 Running diagnostics...')
      },
    }

    const deps: IPCDependencies = {
      getMainWindow: () => this.mainWindow,
      getSelene: () => this.externalDeps.selene || null,
      getEffectsEngine: () => this.externalDeps.effectsEngine || null,
      getTrinity: () => {
        try {
          return this.externalDeps.getTrinity?.() || null
        } catch {
          return null
        }
      },
      universalDMX: this.externalDeps.universalDMX,
      artNetDriver: this.externalDeps.artNetDriver,
      configManager: this.externalDeps.configManager,
      showManager: this.externalDeps.showManager,
      state: this.ipcState,
      callbacks,
    }

    setupIPCHandlers(deps)
    setupVibeHandlers(deps)
    setupAudioFrameHandlers(deps)
    
    console.log('[TitanOrchestrator] 📡 IPC handlers registered')
  }

  /**
   * Asigna zona automáticamente basándose en tipo y nombre
   */
  private autoAssignZone(type: string, name: string): 'front' | 'back' | 'left' | 'right' | 'ground' {
    const lowerName = name.toLowerCase()
    const lowerType = type.toLowerCase()
    
    if (lowerName.includes('front') || lowerName.includes('stage')) return 'front'
    if (lowerName.includes('back') || lowerName.includes('rear')) return 'back'
    if (lowerName.includes('left') || lowerName.includes('l ')) return 'left'
    if (lowerName.includes('right') || lowerName.includes('r ')) return 'right'
    if (lowerName.includes('ground') || lowerName.includes('floor')) return 'ground'
    
    // Por tipo
    if (lowerType.includes('par')) return 'front'
    if (lowerType.includes('wash')) return 'back'
    if (lowerType.includes('mover') || lowerType.includes('spot')) return 'front'
    
    return 'front' // Default
  }

  /**
   * Recalcula contadores de zona
   */
  private recalculateZoneCounters(): void {
    this.ipcState.zoneCounters = { front: 0, back: 0, left: 0, right: 0, ground: 0 }
    for (const fixture of this.ipcState.patchedFixtures) {
      const zone = fixture.zone as keyof typeof this.ipcState.zoneCounters
      if (this.ipcState.zoneCounters[zone] !== undefined) {
        this.ipcState.zoneCounters[zone]++
      }
    }
  }

  /**
   * Inicia el sistema
   */
  public start(): void {
    if (!this.state.isInitialized) {
      console.error('[TitanOrchestrator] ❌ Cannot start - not initialized')
      return
    }

    if (this.state.isRunning) {
      console.warn('[TitanOrchestrator] ⚠️ Already running')
      return
    }

    console.log('[TitanOrchestrator] ▶️ Starting TITAN 2.0...')
    
    this.eventRouter.start()
    this.startMainLoop()
    this.state.isRunning = true
    
    console.log('[TitanOrchestrator] ✅ TITAN 2.0 is now running')
  }

  /**
   * Detiene el sistema
   */
  public stop(): void {
    if (!this.state.isRunning) {
      return
    }

    console.log('[TitanOrchestrator] ⏹️ Stopping TITAN 2.0...')
    
    this.stopMainLoop()
    this.eventRouter.stop()
    this.state.isRunning = false
    
    console.log('[TitanOrchestrator] ⏹️ TITAN 2.0 stopped')
  }

  /**
   * Inicia el main loop (30fps)
   */
  private startMainLoop(): void {
    if (this.state.mainLoopInterval) {
      return // Ya está corriendo
    }

    const FPS = 30
    const frameTime = 1000 / FPS

    this.state.mainLoopInterval = setInterval(() => {
      this.state.frameCount++
      
      if (!this.brain || !this.engine || !this.hal) {
        return
      }

      try {
        // 1. Obtener contexto musical del brain
        const context = this.brain.getCurrentContext()
        
        // 2. Construir métricas de audio simuladas (en producción vendría del worker)
        const audioMetrics = {
          bass: 0.5 + Math.sin(this.state.frameCount * 0.1) * 0.3,
          mid: 0.4 + Math.sin(this.state.frameCount * 0.15) * 0.2,
          high: 0.3 + Math.sin(this.state.frameCount * 0.2) * 0.2,
          energy: 0.6 + Math.sin(this.state.frameCount * 0.05) * 0.3,
          beatPhase: (this.state.frameCount % 30) / 30,
          isBeat: this.state.frameCount % 30 === 0,
        }

        // 3. Procesar en el engine (método es update, no process)
        const intent = this.engine.update(context as MusicalContext, audioMetrics)

        // 4. Renderizar en HAL usando renderSimple (no necesita fixtures ni audio completo)
        this.hal.renderSimple(intent)

        // 5. Log throttled (cada segundo)
        if (this.state.frameCount % 30 === 0 && this.config.debug) {
          console.log(`[TitanOrchestrator] 🔄 Frame ${this.state.frameCount}`)
        }
        
        // 6. Broadcast estado a UI si hay ventana
        if (this.mainWindow && this.state.frameCount % 2 === 0) {
          this.broadcastState()
        }

      } catch (error) {
        console.error('[TitanOrchestrator] ❌ Main loop error:', error)
      }
    }, frameTime)

    console.log(`[TitanOrchestrator] 🔄 Main loop started @ ${FPS}fps`)
  }

  /**
   * Detiene el main loop
   */
  private stopMainLoop(): void {
    if (this.state.mainLoopInterval) {
      clearInterval(this.state.mainLoopInterval)
      this.state.mainLoopInterval = null
      console.log(`[TitanOrchestrator] ⏹️ Main loop stopped after ${this.state.frameCount} frames`)
    }
  }

  /**
   * Broadcast estado a la UI
   */
  private broadcastState(): void {
    if (!this.mainWindow?.webContents) return

    // Construir estado para broadcast
    const state = {
      isRunning: this.state.isRunning,
      frameCount: this.state.frameCount,
      brain: this.brain ? 'connected' : 'disconnected',
      engine: this.engine ? 'connected' : 'disconnected',
      hal: this.hal ? 'connected' : 'disconnected',
    }

    this.mainWindow.webContents.send('titan:state', state)
  }

  /**
   * Establece la ventana principal
   */
  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
    console.log('[TitanOrchestrator] 🪟 Main window set')
  }

  /**
   * Cambia el vibe activo
   */
  public setVibe(vibeId: string): void {
    if (this.engine?.setVibe) {
      this.engine.setVibe(vibeId as 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge')
      console.log(`[TitanOrchestrator] 🎭 Vibe changed to: ${vibeId}`)
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  public getStats(): {
    isInitialized: boolean
    isRunning: boolean
    frameCount: number
    modules: { brain: boolean; engine: boolean; hal: boolean }
    router: ReturnType<EventRouter['getStats']>
  } {
    return {
      isInitialized: this.state.isInitialized,
      isRunning: this.state.isRunning,
      frameCount: this.state.frameCount,
      modules: {
        brain: this.brain !== null,
        engine: this.engine !== null,
        hal: this.hal !== null,
      },
      router: this.eventRouter.getStats(),
    }
  }

  /**
   * Destruye el orquestador y limpia recursos
   */
  public destroy(): void {
    console.log('[TitanOrchestrator] 🗑️ Destroying...')
    
    this.stop()
    this.eventRouter.destroy()
    
    this.brain = null
    this.engine = null
    this.hal = null
    this.mainWindow = null
    
    this.state.isInitialized = false
    
    console.log('[TitanOrchestrator] 🗑️ Destroyed')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════

let titanInstance: TitanOrchestrator | null = null

/**
 * Obtiene o crea la instancia singleton del orquestador
 */
export function getTitanOrchestrator(config?: TitanConfig): TitanOrchestrator {
  if (!titanInstance) {
    titanInstance = new TitanOrchestrator(config)
  }
  return titanInstance
}

/**
 * Resetea la instancia singleton
 */
export function resetTitanOrchestrator(): void {
  if (titanInstance) {
    titanInstance.destroy()
    titanInstance = null
  }
}
