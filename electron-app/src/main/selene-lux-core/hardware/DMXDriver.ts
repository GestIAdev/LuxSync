/**
 * 📡 DMX DRIVER
 * Abstracción para comunicación con hardware DMX
 * 
 * Soporta:
 * - USB DMX (FTDI, Enttec Open DMX)
 * - Art-Net (red)
 * - sACN/E1.31
 * - Virtual (para demo/testing)
 */

import type { FixtureManager, ManagedFixture } from './FixtureManager'

/**
 * Tipos de driver DMX soportados
 */
export type DMXDriverType = 'virtual' | 'usb' | 'artnet' | 'sacn'

/**
 * Configuración del driver
 */
export interface DMXDriverConfig {
  type: DMXDriverType
  
  // USB
  comPort?: string        // e.g., 'COM3' o '/dev/ttyUSB0'
  baudRate?: number       // Típicamente 250000 para DMX
  
  // Art-Net
  artnetIp?: string       // IP del nodo Art-Net
  artnetPort?: number     // Puerto (default: 6454)
  artnetUniverse?: number // Universo Art-Net
  
  // sACN
  sacnUniverse?: number
  sacnMulticast?: boolean
  
  // General
  refreshRate?: number    // Hz (default: 44)
}

/**
 * Estado de un universo DMX (512 canales)
 */
export type DMXUniverse = number[] // 512 valores 0-255

/**
 * Callback para cuando el driver envía datos
 */
export type OnDMXSendCallback = (universe: number, data: DMXUniverse) => void

/**
 * 📡 DMXDriver
 */
export class DMXDriver {
  private config: DMXDriverConfig
  private universes: Map<number, DMXUniverse> = new Map()
  private isRunning = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  
  // Callbacks
  private onSend: OnDMXSendCallback | null = null
  
  // Referencia al FixtureManager
  private fixtureManager: FixtureManager | null = null
  
  constructor(config: Partial<DMXDriverConfig> = {}) {
    this.config = {
      type: config.type || 'virtual',
      refreshRate: config.refreshRate || 44,
      ...config,
    }
    
    // Inicializar universo 1 por defecto
    this.universes.set(1, new Array(512).fill(0))
  }
  
  /**
   * Conectar el FixtureManager
   */
  setFixtureManager(manager: FixtureManager): void {
    this.fixtureManager = manager
  }
  
  /**
   * Registrar callback de envío
   */
  onSendData(callback: OnDMXSendCallback): void {
    this.onSend = callback
  }
  
  /**
   * Iniciar envío de datos DMX
   */
  async start(): Promise<boolean> {
    if (this.isRunning) return true
    
    try {
      // En un caso real, aquí inicializaríamos el hardware
      // Por ahora, solo simulamos
      if (this.config.type === 'usb') {
        console.log(`[DMX] Conectando a puerto USB: ${this.config.comPort}`)
        // TODO: Implementar conexión serial real con node-serialport
      } else if (this.config.type === 'artnet') {
        console.log(`[DMX] Conectando a Art-Net: ${this.config.artnetIp}:${this.config.artnetPort}`)
        // TODO: Implementar Art-Net con socket UDP
      } else if (this.config.type === 'sacn') {
        console.log(`[DMX] Iniciando sACN universo ${this.config.sacnUniverse}`)
        // TODO: Implementar sACN
      } else {
        console.log('[DMX] Modo virtual iniciado')
      }
      
      // Iniciar loop de envío
      const intervalMs = 1000 / this.config.refreshRate!
      this.intervalId = setInterval(() => this.sendFrame(), intervalMs)
      
      this.isRunning = true
      return true
    } catch (error) {
      console.error('[DMX] Error al iniciar:', error)
      return false
    }
  }
  
  /**
   * Detener envío de datos DMX
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    // Blackout al detener
    for (const [univNum, univData] of this.universes) {
      univData.fill(0)
      this.onSend?.(univNum, univData)
    }
    
    this.isRunning = false
    console.log('[DMX] Detenido')
  }
  
  /**
   * Enviar frame DMX
   */
  private sendFrame(): void {
    // Actualizar universos desde FixtureManager
    if (this.fixtureManager) {
      const fixtures = this.fixtureManager.getAllFixtures()
      
      for (const fixture of fixtures) {
        this.updateFixture(fixture)
      }
    }
    
    // Enviar cada universo
    for (const [univNum, univData] of this.universes) {
      this.sendUniverse(univNum, univData)
    }
  }
  
  /**
   * Actualizar valores de un fixture en el universo
   */
  private updateFixture(fixture: ManagedFixture): void {
    const universe = this.getOrCreateUniverse(fixture.universe)
    const values = this.fixtureManager?.getDMXValues(fixture.id) || []
    
    // Copiar valores al universo
    for (let i = 0; i < values.length; i++) {
      const channel = fixture.startChannel + i - 1 // DMX es 1-indexed
      if (channel >= 0 && channel < 512) {
        universe[channel] = Math.max(0, Math.min(255, values[i]))
      }
    }
  }
  
  /**
   * Obtener o crear un universo
   */
  private getOrCreateUniverse(univNum: number): DMXUniverse {
    if (!this.universes.has(univNum)) {
      this.universes.set(univNum, new Array(512).fill(0))
    }
    return this.universes.get(univNum)!
  }
  
  /**
   * Enviar un universo al hardware/callback
   */
  private sendUniverse(univNum: number, data: DMXUniverse): void {
    // Llamar callback
    this.onSend?.(univNum, data)
    
    // En implementación real, aquí enviaríamos por serial/red
    // switch (this.config.type) {
    //   case 'usb': this.sendUSB(data); break;
    //   case 'artnet': this.sendArtNet(univNum, data); break;
    //   case 'sacn': this.sendSACN(univNum, data); break;
    // }
  }
  
  /**
   * Setear un canal específico manualmente
   */
  setChannel(universe: number, channel: number, value: number): void {
    const univ = this.getOrCreateUniverse(universe)
    if (channel >= 1 && channel <= 512) {
      univ[channel - 1] = Math.max(0, Math.min(255, value))
    }
  }
  
  /**
   * Obtener valor de un canal
   */
  getChannel(universe: number, channel: number): number {
    const univ = this.universes.get(universe)
    if (!univ || channel < 1 || channel > 512) return 0
    return univ[channel - 1]
  }
  
  /**
   * Blackout - todos los canales a 0
   */
  blackout(universe?: number): void {
    if (universe !== undefined) {
      const univ = this.universes.get(universe)
      if (univ) univ.fill(0)
    } else {
      for (const univ of this.universes.values()) {
        univ.fill(0)
      }
    }
  }
  
  /**
   * Obtener estado del driver
   */
  getStatus(): {
    isRunning: boolean
    type: DMXDriverType
    universes: number[]
    refreshRate: number
  } {
    return {
      isRunning: this.isRunning,
      type: this.config.type,
      universes: Array.from(this.universes.keys()),
      refreshRate: this.config.refreshRate!,
    }
  }
  
  /**
   * Obtener copia del universo actual
   */
  getUniverseData(univNum: number): DMXUniverse | null {
    const univ = this.universes.get(univNum)
    return univ ? [...univ] : null
  }
}
