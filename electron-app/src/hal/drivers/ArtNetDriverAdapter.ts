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
   * Traduce el formato DMXPacket a los métodos nativos de ArtNetDriver.
   * 
   * OPTIMIZACIÓN: Acumula packets y envía en el próximo tick para batch processing
   */
  send(packet: DMXPacket): boolean {
    if (!this.isConnected) {
      console.warn('[ArtNetAdapter] ⚠️ send() called but not connected')
      return false
    }

    // DMXPacket tiene: { universe, address, channels }
    // Escribir inmediatamente al buffer interno de ArtNet
    this.artnet.setChannels(packet.address, packet.channels)
    
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
   */
  private flush(): void {
    this.sendTimer = null
    
    if (!this.isConnected) {
      console.warn('[ArtNetAdapter] ⚠️ flush() called but not connected')
      return
    }
    
    // Enviar el frame completo
    this.artnet.send()
  }

  /**
   * Envía un universo completo (512 canales).
   * ArtNet driver ya tiene setBuffer() que acepta arrays.
   */
  sendUniverse(universe: number, data: Uint8Array): boolean {
    if (!this.isConnected) {
      return false
    }

    // Convertir Uint8Array a number[]
    const buffer = Array.from(data)
    this.artnet.setBuffer(buffer)
    
    return this.artnet.send()
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
