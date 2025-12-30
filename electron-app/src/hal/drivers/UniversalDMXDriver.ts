/**
 * 🌪️ UniversalDMXDriver.ts - WAVE 11: Driver DMX Universal
 * 
 * Driver profesional para CUALQUIER interfaz DMX USB:
 * - FTDI (Enttec Open DMX, Tornado, etc.)
 * - CH340/CH341 (Interfaces chinas baratas)
 * - Prolific PL2303 (Cables USB-Serial genéricos)
 * - Silicon Labs CP210x
 * - Cualquier otro adaptador serial
 * 
 * ─────────────────────────────────────────────────────────────────────────────
 * CARACTERÍSTICAS WAVE 11:
 * - Autodetección AGRESIVA de cualquier chip serial
 * - Watchdog USB con eventos disconnect/reconnect
 * - Reconexión automática cada 2s
 * - Emite eventos IPC para UI (dmx:status)
 * - Mode promiscuo: intenta conectar a cualquier puerto serie
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { EventEmitter } from 'events'

// Tipo para SerialPort (se carga dinámicamente)
type SerialPortModule = typeof import('serialport')
type SerialPortInstance = InstanceType<SerialPortModule['SerialPort']>

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface DMXDevice {
  path: string           // ej: "COM3" o "/dev/ttyUSB0"
  manufacturer?: string
  serialNumber?: string
  vendorId?: string      
  productId?: string     
  deviceType: 'ftdi' | 'imc-ud7s' | 'ch340' | 'prolific' | 'cp210x' | 'generic' | 'unknown'
  friendlyName: string
  confidence: number     // 0-100% probabilidad de ser DMX
}

export interface UniversalDMXConfig {
  refreshRate: number    // Hz (default: 44)
  autoReconnect: boolean
  reconnectDelay: number // ms (default: 2000)
  watchdogInterval: number // ms (default: 1000)
  debug: boolean
  promiscuousMode: boolean // Intentar cualquier puerto serial
}

export type DMXState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES - LISTA AMPLIADA DE CHIPS
// ─────────────────────────────────────────────────────────────────────────────

// VID/PID conocidos para TODO tipo de interfaces seriales
const KNOWN_CHIPS: Record<string, { vid: string; pids: string[]; name: string; confidence: number }> = {
  // FTDI - Interfaces DMX profesionales
  FTDI: { vid: '0403', pids: ['6001', '6010', '6011', '6014', '6015'], name: 'FTDI', confidence: 95 },
  
  // IMC UD 7S - Interface DMX clásica (FTDI-based)
  IMC_UD7S: { vid: '0403', pids: ['6001'], name: 'IMC UD 7S', confidence: 98 },
  
  // CH340/CH341 - Interfaces chinas baratas (MUY COMUNES)
  CH340: { vid: '1a86', pids: ['7523', '5523', '7522'], name: 'CH340/CH341', confidence: 80 },
  
  // Prolific PL2303 - Cables USB-Serial genéricos
  PROLIFIC: { vid: '067b', pids: ['2303', '23a3', '23b3', '23c3', '23d3'], name: 'Prolific PL2303', confidence: 70 },
  
  // Silicon Labs CP210x - Interfaces profesionales
  CP210X: { vid: '10c4', pids: ['ea60', 'ea61', 'ea70', 'ea71'], name: 'Silicon Labs CP210x', confidence: 85 },
  
  // QinHeng CH9102 - Nueva generación china
  CH9102: { vid: '1a86', pids: ['55d4'], name: 'QinHeng CH9102', confidence: 75 },
}

// DMX timing
const DMX_CHANNELS = 512
const DMX_START_CODE = 0x00

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export class UniversalDMXDriver extends EventEmitter {
  private config: UniversalDMXConfig
  private state: DMXState = 'disconnected'
  private port: SerialPortInstance | null = null
  private dmxBuffer: Buffer
  private outputLoop: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private watchdogTimer: NodeJS.Timeout | null = null
  private currentDevice: DMXDevice | null = null
  private SerialPort: SerialPortModule['SerialPort'] | null = null
  private lastError: string | null = null
  private lastPath: string | null = null // Para reconexión
  private consecutiveErrors: number = 0

  constructor(config: Partial<UniversalDMXConfig> = {}) {
    super()
    
    this.config = {
      refreshRate: config.refreshRate ?? 44,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 2000,
      watchdogInterval: config.watchdogInterval ?? 1000,
      debug: config.debug ?? true, // Debug ON por defecto
      promiscuousMode: config.promiscuousMode ?? true, // Intentar todo
    }

    // Inicializar buffer DMX (513 bytes: start code + 512 canales)
    this.dmxBuffer = Buffer.alloc(DMX_CHANNELS + 1, 0)
    this.dmxBuffer[0] = DMX_START_CODE
    
    this.log('🌪️ UniversalDMXDriver initialized (WAVE 11)')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETECCIÓN DE DISPOSITIVOS (AGRESIVA)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔍 Lista TODOS los dispositivos seriales disponibles
   * En modo promiscuo, incluye cualquier puerto serie
   */
  async listDevices(): Promise<DMXDevice[]> {
    const devices: DMXDevice[] = []

    try {
      // Importar serialport dinámicamente
      const serialportModule = await import('serialport')
      this.SerialPort = serialportModule.SerialPort as unknown as SerialPortModule['SerialPort']
      
      const ports = await serialportModule.SerialPort.list()
      
      this.log(`🔍 Scanning ${ports.length} serial ports...`)
      
      for (const port of ports) {
        const vid = port.vendorId?.toLowerCase() || ''
        const pid = port.productId?.toLowerCase() || ''
        
        let deviceType: DMXDevice['deviceType'] = 'unknown'
        let friendlyName = port.path
        let confidence = 0
        
        // Buscar en chips conocidos
        for (const [chipName, chip] of Object.entries(KNOWN_CHIPS)) {
          if (vid === chip.vid && chip.pids.includes(pid)) {
            // Identificación específica
            if (chipName === 'IMC_UD7S') {
              deviceType = 'imc-ud7s'
              friendlyName = `IMC UD 7S (${port.path})`
              confidence = chip.confidence
            } else {
              deviceType = chipName.toLowerCase().includes('ftdi') ? 'ftdi' :
                          chipName.toLowerCase().includes('ch3') || chipName.toLowerCase().includes('ch9') ? 'ch340' :
                          chipName.toLowerCase().includes('prolific') ? 'prolific' :
                          chipName.toLowerCase().includes('cp210') ? 'cp210x' : 'generic'
              friendlyName = `${chip.name} (${port.path})`
              confidence = chip.confidence
            }
            break
          }
        }
        
        // En modo promiscuo, incluir TODOS los puertos serie
        if (this.config.promiscuousMode || deviceType !== 'unknown') {
          // Si no se identificó, marcar como genérico con baja confianza
          if (deviceType === 'unknown') {
            deviceType = 'generic'
            friendlyName = `Serial Port (${port.path})`
            confidence = 30 // Baja pero intentable
          }
          
          // Boost de confianza si el nombre sugiere DMX
          const mfr = (port.manufacturer || '').toLowerCase()
          const sn = (port.serialNumber || '').toLowerCase()
          
          // Detectar IMC UD 7S por manufacturer/serial
          if (mfr.includes('imc') || sn.includes('ud7s') || 
              (deviceType === 'ftdi' && mfr.includes('ftdi'))) {
            deviceType = 'imc-ud7s'
            friendlyName = `IMC UD 7S (${port.path})`
            confidence = 98
          } else if (mfr.includes('dmx') || mfr.includes('enttec') || mfr.includes('tornado')) {
            confidence = Math.min(100, confidence + 20)
            friendlyName = `DMX Interface (${port.path})`
          }
          
          devices.push({
            path: port.path,
            manufacturer: port.manufacturer,
            serialNumber: port.serialNumber,
            vendorId: port.vendorId,
            productId: port.productId,
            deviceType,
            friendlyName,
            confidence,
          })
          
          this.log(`  📟 ${port.path}: ${deviceType} (${confidence}% confidence)`)
        }
      }
      
      // Ordenar por confianza (mayor primero)
      devices.sort((a, b) => b.confidence - a.confidence)
      
      this.log(`🔍 Found ${devices.length} potential DMX devices`)
      
    } catch (err) {
      console.error('[UniversalDMX] ❌ Error listing devices:', err)
      this.lastError = `Failed to list devices: ${err}`
    }

    return devices
  }

  /**
   * 🎯 Autodetecta y conecta al mejor dispositivo DMX
   */
  async autoConnect(): Promise<boolean> {
    this.log('🔍 Auto-detecting DMX device...')
    
    const devices = await this.listDevices()
    
    if (devices.length === 0) {
      this.log('⚠️ No serial devices found')
      this.setState('disconnected')
      this.emit('no-devices')
      return false
    }

    // Intentar conectar al de mayor confianza
    for (const device of devices) {
      this.log(`🔌 Trying ${device.friendlyName} (${device.confidence}% confidence)...`)
      
      const success = await this.connect(device.path)
      if (success) {
        return true
      }
    }

    this.log('❌ Could not connect to any device')
    return false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONEXIÓN
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔌 Conecta a un dispositivo DMX específico
   */
  async connect(portPath: string): Promise<boolean> {
    if (this.state === 'connected') {
      this.log('⚠️ Already connected, disconnecting first...')
      await this.disconnect()
    }

    this.setState('connecting')
    this.lastPath = portPath
    this.log(`🔌 Connecting to ${portPath}...`)

    try {
      // Importar serialport si no está cargado
      if (!this.SerialPort) {
        const serialportModule = await import('serialport')
        this.SerialPort = serialportModule.SerialPort as unknown as SerialPortModule['SerialPort']
      }

      // 🎯 Detectar tipo de dispositivo para configuración específica
      const availableDevices = await this.listDevices()
      const targetDevice = availableDevices.find(d => d.path === portPath)
      const isIMC_UD7S = targetDevice?.deviceType === 'imc-ud7s'

      // 🔌 IMC UD 7S: Configuración específica
      // - Baud rate: 250000 (estándar DMX)
      // - 8 data bits, no parity, 2 stop bits (8N2)
      // - Flow control: none (importante para UD 7S)
      this.port = new this.SerialPort({
        path: portPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
        autoOpen: false,
      }) as unknown as SerialPortInstance
      
      if (isIMC_UD7S) {
        this.log('🎯 IMC UD 7S detected - using optimized configuration')
      }

      // Promesa para esperar apertura
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)
        
        this.port!.open((err) => {
          clearTimeout(timeout)
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })

      // Usar el dispositivo ya detectado o fallback
      this.currentDevice = targetDevice || {
        path: portPath,
        deviceType: 'generic',
        friendlyName: portPath,
        confidence: 50,
      }

      // 🛡️ WAVE 11: Manejar errores y desconexiones con watchdog
      this.port.on('error', (err) => {
        console.error('[UniversalDMX] ❌ Port error:', err)
        this.consecutiveErrors++
        this.lastError = `Port error: ${err.message}`
        this.handleDisconnect('error')
      })

      this.port.on('close', () => {
        this.log('🔌 Port closed unexpectedly')
        this.handleDisconnect('closed')
      })

      this.consecutiveErrors = 0
      this.setState('connected')
      this.log(`✅ Connected to ${portPath} (${this.currentDevice.friendlyName})`)

      // Iniciar loop de salida DMX
      this.startOutputLoop()
      
      // Iniciar watchdog
      this.startWatchdog()

      this.emit('connected', this.currentDevice)
      return true

    } catch (err) {
      console.error('[UniversalDMX] ❌ Connection failed:', err)
      this.lastError = `Connection failed: ${err}`
      this.setState('error')
      
      if (this.config.autoReconnect) {
        this.scheduleReconnect()
      }
      
      return false
    }
  }

  /**
   * 🔌 Desconecta del dispositivo
   */
  async disconnect(): Promise<void> {
    this.log('🔌 Disconnecting...')
    
    this.stopOutputLoop()
    this.stopWatchdog()
    this.clearReconnectTimer()

    if (this.port && this.port.isOpen) {
      await new Promise<void>((resolve) => {
        this.port!.close(() => resolve())
      })
    }

    this.port = null
    this.currentDevice = null
    this.setState('disconnected')
    
    this.emit('disconnected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🛡️ WAVE 11: WATCHDOG USB
  // ─────────────────────────────────────────────────────────────────────────

  private startWatchdog(): void {
    if (this.watchdogTimer) return
    
    this.watchdogTimer = setInterval(() => {
      // Verificar que el puerto sigue abierto
      if (!this.port || !this.port.isOpen) {
        this.log('🐕 Watchdog: Port not open!')
        this.handleDisconnect('watchdog')
      }
    }, this.config.watchdogInterval)
    
    this.log('🐕 Watchdog started')
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private handleDisconnect(reason: string): void {
    this.log(`⚠️ Disconnect detected: ${reason}`)
    
    this.stopOutputLoop()
    this.stopWatchdog()
    this.port = null
    
    this.setState('disconnected')
    this.emit('disconnected', { reason, lastDevice: this.currentDevice })
    
    if (this.config.autoReconnect) {
      this.setState('reconnecting')
      this.emit('reconnecting', { lastPath: this.lastPath })
      this.scheduleReconnect()
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SALIDA DMX
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🎚️ Establece el valor de un canal DMX (1-512)
   */
  setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > DMX_CHANNELS) return
    this.dmxBuffer[channel] = Math.max(0, Math.min(255, Math.round(value)))
  }

  /**
   * 🎚️ Establece múltiples canales desde un offset
   */
  setChannels(startChannel: number, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      const channel = startChannel + i
      if (channel <= DMX_CHANNELS) {
        this.setChannel(channel, values[i])
      }
    }
  }

  /**
   * 🎚️ Establece todo el buffer DMX de una vez
   */
  setUniverse(values: Buffer | Uint8Array | number[]): void {
    const len = Math.min(values.length, DMX_CHANNELS)
    for (let i = 0; i < len; i++) {
      this.dmxBuffer[i + 1] = values[i]
    }
  }

  /**
   * 🔄 Inicia el loop de salida DMX
   */
  private startOutputLoop(): void {
    if (this.outputLoop) return

    const intervalMs = 1000 / this.config.refreshRate

    this.outputLoop = setInterval(() => {
      this.sendDMXFrame()
    }, intervalMs)

    this.log(`🔄 Output loop started at ${this.config.refreshRate}Hz`)
  }

  /**
   * ⏹️ Detiene el loop de salida
   */
  private stopOutputLoop(): void {
    if (this.outputLoop) {
      clearInterval(this.outputLoop)
      this.outputLoop = null
      this.log('⏹️ Output loop stopped')
    }
  }

  /**
   * 📤 Envía un frame DMX al dispositivo
   */
  private sendDMXFrame(): void {
    if (!this.port || !this.port.isOpen) return

    try {
      this.port.write(this.dmxBuffer, (err) => {
        if (err) {
          this.consecutiveErrors++
          if (this.consecutiveErrors > 10) {
            this.log('❌ Too many write errors, disconnecting...')
            this.handleDisconnect('write-errors')
          }
        } else {
          this.consecutiveErrors = 0
        }
      })
    } catch (err) {
      console.error('[UniversalDMX] ❌ Frame send error:', err)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECONEXIÓN AUTOMÁTICA
  // ─────────────────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    
    this.log(`⏰ Reconnecting in ${this.config.reconnectDelay}ms...`)
    
    this.reconnectTimer = setTimeout(async () => {
      if (this.lastPath) {
        this.log('🔄 Attempting reconnect to last device...')
        const success = await this.connect(this.lastPath)
        
        if (!success) {
          // Intentar autodetectar otro dispositivo
          this.log('🔍 Last device unavailable, scanning for alternatives...')
          await this.autoConnect()
        }
      } else {
        await this.autoConnect()
      }
    }, this.config.reconnectDelay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ESTADO Y UTILIDADES
  // ─────────────────────────────────────────────────────────────────────────

  private setState(state: DMXState): void {
    if (this.state !== state) {
      const oldState = this.state
      this.state = state
      this.log(`📊 State: ${oldState} → ${state}`)
      this.emit('state', state, oldState)
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[UniversalDMX] ${message}`)
    }
  }

  // Getters públicos
  get isConnected(): boolean {
    return this.state === 'connected'
  }

  get currentState(): DMXState {
    return this.state
  }

  get device(): DMXDevice | null {
    return this.currentDevice
  }

  get error(): string | null {
    return this.lastError
  }

  get buffer(): Buffer {
    return this.dmxBuffer
  }

  /**
   * 📊 Obtiene estadísticas del driver
   */
  getStats(): {
    state: DMXState
    device: DMXDevice | null
    refreshRate: number
    channelsActive: number
    lastError: string | null
    consecutiveErrors: number
  } {
    let activeChannels = 0
    for (let i = 1; i <= DMX_CHANNELS; i++) {
      if (this.dmxBuffer[i] > 0) activeChannels++
    }

    return {
      state: this.state,
      device: this.currentDevice,
      refreshRate: this.config.refreshRate,
      channelsActive: activeChannels,
      lastError: this.lastError,
      consecutiveErrors: this.consecutiveErrors,
    }
  }

  /**
   * 🧹 Blackout: todos los canales a 0
   */
  blackout(): void {
    for (let i = 1; i <= DMX_CHANNELS; i++) {
      this.dmxBuffer[i] = 0
    }
    this.log('🌑 Blackout')
  }

  /**
   * ☀️ Full on: todos los canales a 255
   */
  fullOn(): void {
    for (let i = 1; i <= DMX_CHANNELS; i++) {
      this.dmxBuffer[i] = 255
    }
    this.log('☀️ Full on')
  }

  /**
   * 🔦 WAVE 11: Highlight - Enciende solo un fixture específico
   * @param startChannel Canal inicial del fixture
   * @param channelCount Número de canales del fixture
   * @param isMovingHead Si es cabeza móvil, hacer movimiento de prueba
   */
  highlightFixture(startChannel: number, channelCount: number, isMovingHead: boolean = false): void {
    // Primero blackout
    this.blackout()
    
    // Encender dimmer del fixture (primer canal suele ser dimmer)
    this.setChannel(startChannel, 255)
    
    // Si tiene RGB, ponerlo en blanco
    if (channelCount >= 4) {
      this.setChannel(startChannel + 1, 255) // R
      this.setChannel(startChannel + 2, 255) // G
      this.setChannel(startChannel + 3, 255) // B
    }
    
    // Si es moving head, mover lentamente
    if (isMovingHead && channelCount >= 6) {
      // Pan al 50% (centro)
      this.setChannel(startChannel + 4, 128)
      // Tilt al 50% (centro)
      this.setChannel(startChannel + 5, 128)
    }
    
    this.log(`🔦 Highlighting fixture at DMX ${startChannel} (${channelCount}ch, moving: ${isMovingHead})`)
  }
}

// Exportar instancia singleton
export const universalDMX = new UniversalDMXDriver({ debug: true })

// También exportar con el nombre antiguo para compatibilidad
export const tornadoDriver = universalDMX
export { UniversalDMXDriver as TornadoDriver }
