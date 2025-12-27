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
  private dmxBuffer: Buffer
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
      ip: config.ip ?? '255.255.255.255',  // Broadcast por defecto
      port: config.port ?? ARTNET_PORT,
      universe: config.universe ?? 0,
      refreshRate: config.refreshRate ?? 40,  // 40Hz = 25ms
      nodeName: config.nodeName ?? 'LuxSync',
      debug: config.debug ?? false,
    }

    // Buffer DMX (512 canales)
    this.dmxBuffer = Buffer.alloc(DMX_CHANNELS, 0)
    
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
      
      // Habilitar broadcast si es IP broadcast
      if (this.config.ip === '255.255.255.255' || this.config.ip.endsWith('.255')) {
        this.socket.setBroadcast(true)
        this.log('📡 Broadcast mode enabled')
      }

      // Bind a puerto efímero (no necesitamos recibir)
      await new Promise<void>((resolve, reject) => {
        this.socket!.bind(undefined, () => {
          this.log(`✅ Socket bound to port ${this.socket!.address().port}`)
          resolve()
        })
        this.socket!.once('error', reject)
      })

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
   * Setear un canal DMX (1-512)
   */
  setChannel(channel: number, value: number): void {
    if (channel >= 1 && channel <= 512) {
      this.dmxBuffer[channel - 1] = Math.max(0, Math.min(255, value))
    }
  }

  /**
   * Setear múltiples canales desde una dirección base
   */
  setChannels(startChannel: number, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      this.setChannel(startChannel + i, values[i])
    }
  }

  /**
   * Copiar buffer DMX completo
   */
  setBuffer(buffer: Buffer | number[]): void {
    if (Buffer.isBuffer(buffer)) {
      buffer.copy(this.dmxBuffer, 0, 0, Math.min(512, buffer.length))
    } else {
      for (let i = 0; i < Math.min(512, buffer.length); i++) {
        this.dmxBuffer[i] = Math.max(0, Math.min(255, buffer[i]))
      }
    }
  }

  /**
   * Enviar frame DMX actual
   * Incluye rate limiting para evitar saturación UDP
   */
  send(): boolean {
    if (!this.socket || this.state !== 'ready') {
      return false
    }

    // Rate limiting
    const now = Date.now()
    const elapsed = now - this.lastFrameTime
    if (elapsed < this.minSendInterval) {
      // Skip this frame, too soon
      this.packetsDropped++
      return false
    }
    this.lastFrameTime = now

    // Construir paquete Art-DMX
    const packet = this.buildArtDmxPacket()
    
    // Enviar UDP
    const sendStart = performance.now()
    
    this.socket.send(packet, this.config.port, this.config.ip, (error) => {
      if (error) {
        this.log(`❌ Send error: ${error.message}`)
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
   * Blackout - todos los canales a 0
   */
  blackout(): void {
    this.dmxBuffer.fill(0)
    this.send()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PACKET BUILDING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Construir paquete Art-DMX (OpDmx 0x5000)
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
  private buildArtDmxPacket(): Buffer {
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
    // Para universe 0-255, Net=0, SubUni=universe
    const subUni = this.config.universe & 0xFF
    const net = (this.config.universe >> 8) & 0x7F  // 7 bits
    packet.writeUInt8(subUni, 14)
    packet.writeUInt8(net, 15)
    
    // Length (big-endian, always 512)
    packet.writeUInt16BE(DMX_CHANNELS, 16)
    
    // DMX Data
    this.dmxBuffer.copy(packet, ARTDMX_HEADER_SIZE)
    
    return packet
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
