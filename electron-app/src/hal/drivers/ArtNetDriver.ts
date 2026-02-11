/**
 * 🎨 WAVE 153: ART-NET DRIVER (UDP Native)
 * ============================================================================
 * Driver nativo para protocolo Art-Net DMX sobre UDP.
 * 
 * Características:
 * - Puerto UDP 6454 (estándar Art-Net)
 * - Broadcast (255.255.255.255) o unicast configurable
 * - Rate limiting integrado (evita saturación de red)
 * - Sequence rolling counter 1-255
 * - Soporte multi-universo
 * 
 * Protocolo Art-Net (Art-DMX Packet):
 * - ID: "Art-Net\0" (8 bytes)
 * - OpCode: 0x5000 (2 bytes, little-endian)
 * - ProtVer: 0x0e00 (2 bytes, big-endian = 14)
 * - Sequence: 1-255 (1 byte, rolling)
 * - Physical: 0 (1 byte)
 * - SubUni/Net: Universe (2 bytes)
 * - Length: 512 (2 bytes, big-endian)
 * - Data: 512 bytes DMX
 * 
 * @see https://art-net.org.uk/resources/art-net-specification/
 * ============================================================================
 */

import * as dgram from 'dgram'
import { EventEmitter } from 'events'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtNetConfig {
  /** IP destino (default: 255.255.255.255 broadcast) */
  ip: string
  /** Puerto UDP (default: 6454) */
  port: number
  /** Universo Art-Net (0-32767) */
  universe: number
  /** Rate limit en Hz (default: 40) - evita saturación UDP */
  refreshRate: number
  /** Nombre del nodo para identificación */
  nodeName: string
  /** Debug logging */
  debug: boolean
}

export type ArtNetState = 'disconnected' | 'ready' | 'sending' | 'error'

export interface ArtNetStatus {
  state: ArtNetState
  ip: string
  port: number
  universe: number
  framesSent: number
  lastSendTime: number
  packetsDropped: number
  avgLatency: number
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES ART-NET
// ─────────────────────────────────────────────────────────────────────────────

const ARTNET_PORT = 6454
const ARTNET_HEADER = Buffer.from('Art-Net\0')
const ARTNET_OPCODE_DMX = 0x5000  // OpDmx
const ARTNET_PROTOCOL_VERSION = 14
const DMX_CHANNELS = 512

// Header Art-DMX packet (18 bytes antes de data)
const ARTDMX_HEADER_SIZE = 18

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export class ArtNetDriver extends EventEmitter {
  private config: ArtNetConfig
  private socket: dgram.Socket | null = null
  private state: ArtNetState = 'disconnected'
  
  // 🌊 WAVE 2020.2b: MULTI-UNIVERSE SUPPORT
  // Mantener dmxBuffer para backward compat (universe 0)
  // Añadir universeBuffers para multi-universe
  private dmxBuffer: Buffer  // Legacy: universe 0
  private universeBuffers: Map<number, Buffer> = new Map()  // 🌊 Multi-universe
  
  private sequence: number = 1  // 1-255, 0 = disabled
  private framesSent: number = 0
  private packetsDropped: number = 0
  private lastSendTime: number = 0
  private sendLatencies: number[] = []
  private minSendInterval: number
  private lastFrameTime: number = 0

  constructor(config: Partial<ArtNetConfig> = {}) {
    super()
    
    this.config = {
      // 🎯 WAVE 153.7: Default a IP del nodo IMC Pro H1 (no broadcast!)
      ip: config.ip ?? '10.0.0.10',
      port: config.port ?? ARTNET_PORT,
      universe: config.universe ?? 0,
      refreshRate: config.refreshRate ?? 30,  // ✅ WAVE 1101: SAFETY THROTTLE (33ms)
      nodeName: config.nodeName ?? 'LuxSync',
      debug: config.debug ?? false,
    }

    // Buffer DMX (512 canales) - Legacy universe 0
    this.dmxBuffer = Buffer.alloc(DMX_CHANNELS, 0)
    
    // 🌊 WAVE 2020.2b: Initialize universe 0 in multi-universe map
    this.universeBuffers.set(0, this.dmxBuffer)
    
    // Intervalo mínimo entre envíos (rate limiting)
    this.minSendInterval = 1000 / this.config.refreshRate
    
    this.log('🎨 ArtNetDriver initialized (WAVE 153)')
    this.log(`   Target: ${this.config.ip}:${this.config.port}`)
    this.log(`   Universe: ${this.config.universe}`)
    this.log(`   Rate: ${this.config.refreshRate} Hz (${this.minSendInterval.toFixed(1)}ms interval)`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Inicializar socket UDP
   */
  async start(): Promise<boolean> {
    if (this.socket) {
      this.log('⚠️ Socket already exists, closing first')
      await this.stop()
    }

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })

      // Bind a puerto efímero PRIMERO (necesario antes de setBroadcast en Windows)
      await new Promise<void>((resolve, reject) => {
        this.socket!.bind(undefined, () => {
          this.log(`✅ Socket bound to port ${this.socket!.address().port}`)
          resolve()
        })
        this.socket!.once('error', reject)
      })
      
      // Habilitar broadcast si es IP broadcast (DESPUÉS del bind)
      if (this.config.ip === '255.255.255.255' || this.config.ip.endsWith('.255')) {
        this.socket.setBroadcast(true)
        this.log('📡 Broadcast mode enabled')
      }

      // Event handlers
      this.socket.on('error', (err) => {
        this.log(`❌ Socket error: ${err.message}`)
        this.state = 'error'
        this.emit('error', err)
      })

      this.socket.on('close', () => {
        this.log('🔌 Socket closed')
        this.state = 'disconnected'
        this.emit('disconnected')
      })

      this.state = 'ready'
      this.emit('ready')
      this.log('✅ ArtNet ready')
      
      return true
    } catch (error) {
      this.log(`❌ Failed to start: ${error}`)
      this.state = 'error'
      return false
    }
  }

  /**
   * Cerrar socket
   */
  async stop(): Promise<void> {
    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.close(() => {
          this.socket = null
          this.state = 'disconnected'
          this.log('🛑 ArtNet stopped')
          resolve()
        })
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DMX OUTPUT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🌊 WAVE 2020.2b: Get or create buffer for a universe
   */
  private getUniverseBuffer(universe: number): Buffer {
    if (!this.universeBuffers.has(universe)) {
      this.universeBuffers.set(universe, Buffer.alloc(DMX_CHANNELS, 0))
    }
    return this.universeBuffers.get(universe)!
  }

  /**
   * Setear un canal DMX (1-512)
   * 🌊 WAVE 2020.2b: Ahora soporta universe parameter (default 0 para backward compat)
   */
  setChannel(channel: number, value: number, universe: number = 0): void {
    if (channel >= 1 && channel <= 512) {
      const buffer = this.getUniverseBuffer(universe)
      buffer[channel - 1] = Math.max(0, Math.min(255, value))
    }
  }

  /**
   * Setear múltiples canales desde una dirección base
   * 🌊 WAVE 2020.2b: Ahora soporta universe parameter
   */
  setChannels(startChannel: number, values: number[], universe: number = 0): void {
    for (let i = 0; i < values.length; i++) {
      this.setChannel(startChannel + i, values[i], universe)
    }
  }

  /**
   * Copiar buffer DMX completo
   * 🌊 WAVE 2020.2b: Ahora soporta universe parameter
   */
  setBuffer(buffer: Buffer | number[], universe: number = 0): void {
    const targetBuffer = this.getUniverseBuffer(universe)
    if (Buffer.isBuffer(buffer)) {
      buffer.copy(targetBuffer, 0, 0, Math.min(512, buffer.length))
    } else {
      for (let i = 0; i < Math.min(512, buffer.length); i++) {
        targetBuffer[i] = Math.max(0, Math.min(255, buffer[i]))
      }
    }
  }

  /**
   * Enviar frame DMX actual (universe 0 - backward compat)
   * Incluye rate limiting para evitar saturación UDP
   * 🌊 WAVE 2020.2b: Para multi-universe, usar sendAll()
   */
  send(): boolean {
    return this.sendUniverse(this.config.universe)
  }

  /**
   * 🌊 WAVE 2020.2b: Enviar un universo específico
   * Rate limiting es PER-UNIVERSE para máximo throughput
   */
  sendUniverse(universe: number): boolean {
    if (!this.socket || this.state !== 'ready') {
      return false
    }

    const buffer = this.universeBuffers.get(universe)
    if (!buffer) {
      return false
    }

    // Rate limiting (global para simplificar - 30Hz total)
    const now = Date.now()
    const elapsed = now - this.lastFrameTime
    if (elapsed < this.minSendInterval) {
      // Skip this frame, too soon
      this.packetsDropped++
      return false
    }
    this.lastFrameTime = now

    // Construir paquete Art-DMX para este universo
    const packet = this.buildArtDmxPacketForUniverse(universe, buffer)
    
    // Enviar UDP
    const sendStart = performance.now()
    
    this.socket.send(packet, this.config.port, this.config.ip, (error) => {
      if (error) {
        this.log(`❌ Send error (uni ${universe}): ${error.message}`)
        this.packetsDropped++
      } else {
        const latency = performance.now() - sendStart
        this.framesSent++
        this.lastSendTime = now
        
        // Track latency (last 100 samples)
        this.sendLatencies.push(latency)
        if (this.sendLatencies.length > 100) {
          this.sendLatencies.shift()
        }
      }
    })

    // Increment sequence (1-255, wraps)
    this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1

    return true
  }

  /**
   * 🌊 WAVE 2020.2b: MULTI-UNIVERSE BATCH SEND
   * Envía TODOS los universos activos en paralelo usando Promise.all
   * Este es el método principal para 50+ universos
   */
  async sendAll(): Promise<{ success: boolean; universesSent: number; errors: number }> {
    if (!this.socket || this.state !== 'ready') {
      return { success: false, universesSent: 0, errors: 0 }
    }

    // Rate limiting global
    const now = Date.now()
    const elapsed = now - this.lastFrameTime
    if (elapsed < this.minSendInterval) {
      this.packetsDropped += this.universeBuffers.size
      return { success: false, universesSent: 0, errors: 0 }
    }
    this.lastFrameTime = now

    const promises: Promise<boolean>[] = []
    const sendStart = performance.now()

    // Crear promesas para cada universo
    for (const [universe, buffer] of this.universeBuffers) {
      const packet = this.buildArtDmxPacketForUniverse(universe, buffer)
      
      const promise = new Promise<boolean>((resolve) => {
        this.socket!.send(packet, this.config.port, this.config.ip, (error) => {
          if (error) {
            this.log(`❌ Send error (uni ${universe}): ${error.message}`)
            this.packetsDropped++
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })
      
      promises.push(promise)
    }

    // Esperar a que todos se envíen en paralelo
    const results = await Promise.all(promises)
    
    const successCount = results.filter(r => r).length
    const errorCount = results.length - successCount
    
    // Track metrics
    const latency = performance.now() - sendStart
    this.framesSent += successCount
    this.lastSendTime = now
    
    this.sendLatencies.push(latency)
    if (this.sendLatencies.length > 100) {
      this.sendLatencies.shift()
    }

    // Increment sequence
    this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1

    // Log periodically for debugging
    if (this.framesSent % 100 === 0 && this.universeBuffers.size > 1) {
      this.log(`📡 Batch sent ${successCount}/${this.universeBuffers.size} universes in ${latency.toFixed(2)}ms`)
    }

    return { 
      success: errorCount === 0, 
      universesSent: successCount, 
      errors: errorCount 
    }
  }

  /**
   * Blackout - todos los canales a 0
   * 🌊 WAVE 2020.2b: Ahora limpia TODOS los universos
   */
  blackout(): void {
    for (const buffer of this.universeBuffers.values()) {
      buffer.fill(0)
    }
    this.sendAll() // Fire and forget
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PACKET BUILDING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Construir paquete Art-DMX (OpDmx 0x5000) - Legacy para universe config
   */
  private buildArtDmxPacket(): Buffer {
    return this.buildArtDmxPacketForUniverse(this.config.universe, this.dmxBuffer)
  }

  /**
   * 🌊 WAVE 2020.2b: Construir paquete Art-DMX para cualquier universo
   * 
   * Structure:
   * [0-7]   ID: "Art-Net\0"
   * [8-9]   OpCode: 0x5000 (little-endian)
   * [10-11] ProtVer: 14 (big-endian)
   * [12]    Sequence: 1-255
   * [13]    Physical: 0
   * [14]    SubUni: Universe low byte
   * [15]    Net: Universe high byte (bits 14-8)
   * [16-17] Length: 512 (big-endian)
   * [18+]   DMX Data
   */
  private buildArtDmxPacketForUniverse(universe: number, buffer: Buffer): Buffer {
    const packet = Buffer.alloc(ARTDMX_HEADER_SIZE + DMX_CHANNELS)
    
    // Header
    ARTNET_HEADER.copy(packet, 0)
    
    // OpCode (little-endian)
    packet.writeUInt16LE(ARTNET_OPCODE_DMX, 8)
    
    // Protocol Version (big-endian)
    packet.writeUInt16BE(ARTNET_PROTOCOL_VERSION, 10)
    
    // Sequence
    packet.writeUInt8(this.sequence, 12)
    
    // Physical (input port, usually 0)
    packet.writeUInt8(0, 13)
    
    // Universe: SubUni (low byte) + Net (high byte)
    // Art-Net universe = (Net << 8) | SubUni
    const subUni = universe & 0xFF
    const net = (universe >> 8) & 0x7F  // 7 bits
    packet.writeUInt8(subUni, 14)
    packet.writeUInt8(net, 15)
    
    // Length (big-endian, always 512)
    packet.writeUInt16BE(DMX_CHANNELS, 16)
    
    // DMX Data
    buffer.copy(packet, ARTDMX_HEADER_SIZE)
    
    return packet
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🌊 WAVE 2020.2b: UNIVERSE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get number of active universes
   */
  getUniverseCount(): number {
    return this.universeBuffers.size
  }

  /**
   * Get list of active universe numbers
   */
  getActiveUniverses(): number[] {
    return Array.from(this.universeBuffers.keys())
  }

  /**
   * Clear a specific universe (remove from active set)
   */
  clearUniverse(universe: number): void {
    if (universe !== 0) { // Never remove universe 0 (legacy compat)
      this.universeBuffers.delete(universe)
    }
  }

  /**
   * Clear all universes except 0
   */
  clearAllUniverses(): void {
    const universe0 = this.universeBuffers.get(0)
    this.universeBuffers.clear()
    if (universe0) {
      this.universeBuffers.set(0, universe0)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Actualizar configuración en caliente
   */
  configure(config: Partial<ArtNetConfig>): void {
    if (config.ip !== undefined) {
      this.config.ip = config.ip
      // Actualizar broadcast si cambió IP y el socket está activo
      // Solo podemos llamar setBroadcast si el socket está bound (state === 'ready')
      if (this.socket && this.state === 'ready') {
        try {
          if (config.ip === '255.255.255.255' || config.ip.endsWith('.255')) {
            this.socket.setBroadcast(true)
          }
        } catch (err) {
          this.log(`⚠️ Could not set broadcast: ${err}`)
        }
      }
    }
    if (config.port !== undefined) {
      this.config.port = config.port
    }
    if (config.universe !== undefined) {
      this.config.universe = config.universe
    }
    if (config.refreshRate !== undefined) {
      this.config.refreshRate = config.refreshRate
      this.minSendInterval = 1000 / config.refreshRate
    }
    
    this.log(`⚙️ Config updated: ${JSON.stringify(this.config)}`)
    this.emit('configured', this.config)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────────────

  get isConnected(): boolean {
    return this.state === 'ready' && this.socket !== null
  }

  get currentConfig(): ArtNetConfig {
    return { ...this.config }
  }

  getStatus(): ArtNetStatus {
    const avgLatency = this.sendLatencies.length > 0
      ? this.sendLatencies.reduce((a, b) => a + b, 0) / this.sendLatencies.length
      : 0

    return {
      state: this.state,
      ip: this.config.ip,
      port: this.config.port,
      universe: this.config.universe,
      framesSent: this.framesSent,
      lastSendTime: this.lastSendTime,
      packetsDropped: this.packetsDropped,
      avgLatency: Math.round(avgLatency * 100) / 100,
    }
  }

  /**
   * Obtener buffer DMX actual (copia)
   */
  getBuffer(): Buffer {
    return Buffer.from(this.dmxBuffer)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[ArtNet] ${message}`)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────

/** Instancia singleton del driver Art-Net */
export const artNetDriver = new ArtNetDriver({ debug: true })

export default ArtNetDriver
