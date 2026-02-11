/**
 * 🎨 WAVE 686.10: ARTNET DRIVER ADAPTER
 * ============================================================================
 * Adapter que convierte ArtNetDriver al contrato IDMXDriver.
 * 
 * PROBLEMA RESUELTO:
 * - HAL espera IDMXDriver interface
 * - ArtNetDriver tiene su propia API (start/stop/send/setBuffer)
 * - Este adapter traduce entre ambos mundos
 * 
 * RESPONSABILIDADES:
 * - Traducir DMXPacket → ArtNetDriver.setChannels()
 * - Mapear estados: 'ready'/'sending' → 'connected'
 * - Delegar lifecycle methods (connect/close → start/stop)
 * - Exponer status con formato IDMXDriver
 * 
 * @layer HAL
 * @pattern ADAPTER
 * ============================================================================
 */

import { EventEmitter } from 'events'
import { ArtNetDriver, type ArtNetStatus } from './ArtNetDriver'
import type { IDMXDriver, DriverState, DriverStatus } from './DMXDriver.interface'
import type { DMXPacket } from '../../core/protocol'

/**
 * Adapter que envuelve ArtNetDriver y lo hace compatible con IDMXDriver
 */
export class ArtNetDriverAdapter extends EventEmitter implements IDMXDriver {
  private artnet: ArtNetDriver
  private sendTimer: NodeJS.Immediate | null = null

  constructor(artnetInstance: ArtNetDriver) {
    super()
    this.artnet = artnetInstance
    
    // Forward events del ArtNetDriver al adapter
    this.artnet.on('ready', () => this.emit('connected', 'ArtNet'))
    this.artnet.on('error', (err) => this.emit('error', err))
    this.artnet.on('disconnected', () => this.emit('disconnected', 'Socket closed'))
    
    console.log('[ArtNetAdapter] 🎨 ArtNetDriverAdapter initialized (WAVE 686.10)')
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE (IDMXDriver interface)
  // ═══════════════════════════════════════════════════════════════════════

  async connect(): Promise<boolean> {
    console.log('[ArtNetAdapter] 🔌 Connecting ArtNet driver...')
    return await this.artnet.start()
  }

  async close(): Promise<void> {
    console.log('[ArtNetAdapter] 🛑 Closing ArtNet driver...')
    await this.artnet.stop()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATA TRANSMISSION (IDMXDriver interface)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Envía un DMXPacket al driver ArtNet.
   * 🌊 WAVE 2020.2b: Ahora usa multi-universe support
   * 
   * OPTIMIZACIÓN: Acumula packets y envía en el próximo tick para batch processing
   */
  send(packet: DMXPacket): boolean {
    if (!this.isConnected) {
      console.warn('[ArtNetAdapter] ⚠️ send() called but not connected')
      return false
    }

    // DMXPacket tiene: { universe, address, channels }
    // 🌊 WAVE 2020.2b: Ahora pasamos el universe al driver
    this.artnet.setChannels(packet.address, packet.channels, packet.universe ?? 0)
    
    // Schedule flush en el próximo tick si no está ya programado
    if (!this.sendTimer) {
      this.sendTimer = setImmediate(() => {
        this.flush()
      })
    }
    
    return true
  }
  
  /**
   * Flush: envía el frame DMX acumulado
   * 🌊 WAVE 2020.2b: Ahora usa sendAll() para multi-universe
   */
  private flush(): void {
    this.sendTimer = null
    
    if (!this.isConnected) {
      console.warn('[ArtNetAdapter] ⚠️ flush() called but not connected')
      return
    }
    
    // 🌊 WAVE 2020.2b: Enviar TODOS los universos en paralelo
    this.artnet.sendAll()
  }

  /**
   * Envía un universo completo (512 canales).
   * 🌊 WAVE 2020.2b: Ahora correctamente pasa el universe
   */
  sendUniverse(universe: number, data: Uint8Array): boolean {
    if (!this.isConnected) {
      return false
    }

    // Convertir Uint8Array a number[]
    const buffer = Array.from(data)
    this.artnet.setBuffer(buffer, universe)
    
    return this.artnet.sendUniverse(universe)
  }

  /**
   * 🌊 WAVE 2020.2b: Enviar TODOS los universos activos en paralelo
   * Este es el método de alto rendimiento para 50+ universos
   */
  async sendAll(): Promise<boolean> {
    if (!this.isConnected) {
      return false
    }
    
    const result = await this.artnet.sendAll()
    return result.success
  }

  /**
   * Blackout - todos los canales a 0
   */
  blackout(): void {
    this.artnet.blackout()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATUS (IDMXDriver interface)
  // ═══════════════════════════════════════════════════════════════════════

  get isConnected(): boolean {
    const status = this.artnet.getStatus()
    // ArtNet states: 'disconnected' | 'ready' | 'sending' | 'error'
    // 'ready' y 'sending' = connected
    return status.state === 'ready' || status.state === 'sending'
  }

  get state(): DriverState {
    const artnetStatus = this.artnet.getStatus()
    
    // Mapeo de ArtNetState → DriverState
    switch (artnetStatus.state) {
      case 'ready':
      case 'sending':
        return 'connected'
      case 'disconnected':
        return 'disconnected'
      case 'error':
        return 'error'
      default:
        return 'disconnected'
    }
  }

  getStatus(): DriverStatus {
    const artnetStatus: ArtNetStatus = this.artnet.getStatus()
    
    return {
      state: this.state,
      type: 'artnet',
      deviceName: `ArtNet ${artnetStatus.ip}:${artnetStatus.port} U${artnetStatus.universe}`,
      framesSent: artnetStatus.framesSent,
      lastSendTime: artnetStatus.lastSendTime,
      errors: artnetStatus.packetsDropped,
      avgLatency: artnetStatus.avgLatency
    }
  }
}

/**
 * Factory para crear un adapter desde el singleton ArtNet
 */
export function createArtNetAdapter(artnetInstance: ArtNetDriver): ArtNetDriverAdapter {
  return new ArtNetDriverAdapter(artnetInstance)
}
