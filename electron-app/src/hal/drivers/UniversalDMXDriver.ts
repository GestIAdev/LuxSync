/**
 * 🌪️ UniversalDMXDriver.ts - WAVE 2020.2c: USB MULTI-HEAD HYDRA
 * 
 * Driver profesional para CUALQUIER interfaz DMX USB:
 * - FTDI (Enttec Open DMX, Tornado, etc.)
 * - CH340/CH341 (Interfaces chinas baratas)
 * - Prolific PL2303 (Cables USB-Serial genéricos)
 * - Silicon Labs CP210x
 * - Cualquier otro adaptador serial
 * 
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔥 WAVE 2020.2c: MULTI-UNIVERSE USB HYDRA
 * - Soporta MÚLTIPLES dongles conectados simultáneamente
 * - Asignación automática: Dongle 1 → Univ 0, Dongle 2 → Univ 1...
 * - Salida paralela con sendAll() (WAVE 2020.2b compliant)
 * - Autodetección AGRESIVA de cualquier chip serial
 * - Watchdog USB con eventos disconnect/reconnect por universo
 * - Reconexión automática inteligente
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
// DRIVER HIDRA (MULTI-HEAD)
// ─────────────────────────────────────────────────────────────────────────────

export class UniversalDMXDriver extends EventEmitter {
  private config: UniversalDMXConfig
  
  // 🔥 WAVE 2020.2c: MULTI-UNIVERSE MAPS (en lugar de variables singulares)
  private ports: Map<number, SerialPortInstance> = new Map()
  private universeBuffers: Map<number, Buffer> = new Map()
  private connectedDevices: Map<number, DMXDevice> = new Map()
  
  private outputLoop: NodeJS.Timeout | null = null
  private watchdogTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private SerialPort: SerialPortModule['SerialPort'] | null = null
  private lastError: string | null = null
  private isScanning: boolean = false

  constructor(config: Partial<UniversalDMXConfig> = {}) {
    super()
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ WAVE 1101: PARANOIA PROTOCOL - DMX THROTTLING
    // 
    // El refresh rate baja de 44Hz a 30Hz para proteger movers baratos.
    // Los chips chinos ($50-200) típicamente solo procesan 20-30Hz.
    // A 44Hz sus buffers se saturan → movimientos erráticos.
    // 
    // 30Hz = 33.3ms por frame = SEGURO para todo el hardware
    // ═══════════════════════════════════════════════════════════════════════
    this.config = {
      refreshRate: config.refreshRate ?? 30, // WAVE 1101: 44→30 (Paranoia Protocol)
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 2000,
      watchdogInterval: config.watchdogInterval ?? 1000,
      debug: config.debug ?? true, // Debug ON por defecto
      promiscuousMode: config.promiscuousMode ?? true, // Intentar todo
    }

    // Inicializar Universo 0 por defecto (para compatibilidad con código legacy)
    this.initBuffer(0)
    
    this.log('🌪️ UniversalDMXDriver (WAVE 2020.2c: Multi-Head Hydra) initialized')
  }

  /**
   * Inicializa un buffer DMX para un universo específico
   */
  private initBuffer(universe: number): void {
    if (!this.universeBuffers.has(universe)) {
      const buf = Buffer.alloc(DMX_CHANNELS + 1, 0)
      buf[0] = DMX_START_CODE
      this.universeBuffers.set(universe, buf)
      this.log(`📦 Buffer initialized for Universe ${universe}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETECCIÓN DE DISPOSITIVOS (AGRESIVA)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔍 Lista TODOS los dispositivos seriales disponibles
   * En modo promiscuo, incluye cualquier puerto serie
   */
  async listDevices(): Promise<DMXDevice[]> {
    console.log('[UniversalDMX] 📋 listDevices() CALLED')
    const devices: DMXDevice[] = []

    try {
      // Importar serialport dinámicamente
      console.log('[UniversalDMX] 📦 Importing serialport module...')
      const serialportModule = await import('serialport')
      this.SerialPort = serialportModule.SerialPort as unknown as SerialPortModule['SerialPort']
      
      console.log('[UniversalDMX] 📡 Calling SerialPort.list()...')
      const ports = await serialportModule.SerialPort.list()
      
      console.log(`[UniversalDMX] 🔍 Found ${ports.length} serial ports`)
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
      
      console.log(`[UniversalDMX] ✅ Detected ${devices.length} potential DMX devices:`)
      devices.forEach(d => console.log(`  - ${d.friendlyName} (${d.confidence}% confidence)`))
      
      this.log(`🔍 Found ${devices.length} potential DMX devices`)
      
    } catch (err) {
      console.error('[UniversalDMX] ❌ Error listing devices:', err)
      console.error('[UniversalDMX] ❌ Stack:', (err as Error).stack)
      this.lastError = `Failed to list devices: ${err}`
    }

    console.log('[UniversalDMX] 📋 listDevices() RETURNING:', devices.length, 'devices')
    return devices
  }

  /**
   * 🎯 WAVE 2020.2c: Escanea y conecta TODOS los dispositivos disponibles
   * Asigna universos incrementalmente (0, 1, 2...)
   */
  async autoConnect(): Promise<boolean> {
    console.log('[UniversalDMX] 🚀 autoConnect() CALLED')
    console.log('[UniversalDMX] 📊 Current state: isScanning=', this.isScanning, 'ports=', this.ports.size)
    
    if (this.isScanning) {
      this.log('⚠️ Already scanning...')
      return false
    }
    
    this.isScanning = true
    this.log('🔍 Hydra: Scanning for ALL compatible devices...')
    console.log('[UniversalDMX] 🔍 Starting device scan...')
    
    const devices = await this.listDevices()
    
    if (devices.length === 0) {
      this.log('⚠️ No serial devices found')
      this.emit('no-devices')
      this.isScanning = false
      return false
    }

    // Filtrar dispositivos que ya están conectados
    const connectedPaths = Array.from(this.connectedDevices.values()).map(d => d.path)
    const newDevices = devices.filter(d => !connectedPaths.includes(d.path))

    if (newDevices.length === 0 && this.ports.size > 0) {
      this.log('✅ All available devices already connected')
      this.isScanning = false
      return true
    }

    // Buscar el siguiente universo libre
    let nextUniverse = 0
    while (this.ports.has(nextUniverse)) {
      nextUniverse++
    }

    let connectedCount = 0

    // Intentar conectar cada dispositivo nuevo
    for (const device of newDevices) {
      this.log(`🔌 Hydra: Found ${device.friendlyName} (${device.confidence}%), assigning Universe ${nextUniverse}...`)
      
      const success = await this.connect(device.path, nextUniverse)
      if (success) {
        connectedCount++
        nextUniverse++
      }
    }

    this.isScanning = false
    
    if (this.ports.size > 0) {
      this.log(`✅ 🐙 Hydra Active: ${this.ports.size} universe(s) online`)
      this.emit('hydra-ready', { universes: this.ports.size })
      return true
    }
    
    this.log('❌ Could not connect to any device')
    return false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONEXIÓN MULTI-CABEZA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔌 WAVE 2020.2c: Conecta un dispositivo a un Universo específico
   */
  async connect(portPath: string, universe: number = 0): Promise<boolean> {
    if (this.ports.has(universe)) {
      this.log(`⚠️ Universe ${universe} already occupied, skipping ${portPath}`)
      return false
    }

    this.log(`🔌 [Univ ${universe}] Connecting to ${portPath}...`)

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

      // Configuración estándar DMX (250000 baud, 8N2)
      const port = new this.SerialPort({
        path: portPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
        autoOpen: false,
      }) as unknown as SerialPortInstance
      
      if (isIMC_UD7S) {
        this.log(`🎯 [Univ ${universe}] IMC UD 7S detected - optimized config`)
      }

      // Promesa para esperar apertura con timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000)
        
        port.open((err: Error | null) => {
          clearTimeout(timeout)
          err ? reject(err) : resolve()
        })
      })

      // Registrar conexión en el Map
      this.ports.set(universe, port)
      this.initBuffer(universe)
      
      // Guardar info del dispositivo
      const deviceInfo: DMXDevice = targetDevice || {
        path: portPath,
        deviceType: 'generic',
        friendlyName: portPath,
        confidence: 50,
      }
      this.connectedDevices.set(universe, deviceInfo)

      // 🛡️ Eventos de error individuales por universo
      port.on('error', (err: Error) => this.handlePortError(universe, err))
      port.on('close', () => this.handlePortClose(universe))

      this.log(`✅ [Univ ${universe}] Connected to ${deviceInfo.friendlyName}`)
      
      // Asegurar que el loop de salida corre
      this.startOutputLoop()
      
      // Asegurar watchdog activo
      this.startWatchdog()
      
      this.emit('connected', { universe, device: deviceInfo })
      
      return true

    } catch (err) {
      this.log(`❌ [Univ ${universe}] Connection failed to ${portPath}: ${err}`)
      this.lastError = `[Univ ${universe}] ${err}`
      
      if (this.config.autoReconnect) {
        this.scheduleReconnect()
      }
      
      return false
    }
  }

  /**
   * Maneja errores de puerto para un universo específico
   */
  private handlePortError(universe: number, err: Error): void {
    this.log(`❌ [Univ ${universe}] Port error: ${err.message}`)
    this.disconnectUniverse(universe)
  }

  /**
   * Maneja cierre de puerto para un universo específico
   */
  private handlePortClose(universe: number): void {
    this.log(`⚠️ [Univ ${universe}] Port closed`)
    this.disconnectUniverse(universe)
  }

  /**
   * Desconecta un universo específico
   */
  async disconnectUniverse(universe: number): Promise<void> {
    const port = this.ports.get(universe)
    const device = this.connectedDevices.get(universe)
    
    if (port) {
      try {
        if (port.isOpen) {
          await new Promise<void>(r => port.close(() => r()))
        }
      } catch (err) {
        this.log(`⚠️ [Univ ${universe}] Error closing port: ${err}`)
      }
      
      this.ports.delete(universe)
      this.connectedDevices.delete(universe)
      this.emit('disconnected', { universe, device })
      
      this.log(`🔌 [Univ ${universe}] Disconnected`)
      
      // Si no quedan puertos conectados, intentar reconectar
      if (this.ports.size === 0 && this.config.autoReconnect) {
        this.log('⚠️ All universes disconnected, scheduling reconnect...')
        this.scheduleReconnect()
      }
    }
  }

  /**
   * 🔌 Desconecta TODOS los universos
   */
  async disconnect(): Promise<void> {
    this.log('🔌 Disconnecting all universes...')
    
    this.stopOutputLoop()
    this.stopWatchdog()
    this.clearReconnectTimer()

    // Cerrar todos los puertos
    const closePromises: Promise<void>[] = []
    
    for (const [universe, port] of this.ports) {
      if (port && port.isOpen) {
        const promise = new Promise<void>((resolve) => {
          port.close(() => resolve())
        })
        closePromises.push(promise)
      }
    }
    
    await Promise.all(closePromises)
    
    this.ports.clear()
    this.connectedDevices.clear()
    
    this.log('🔌 All universes disconnected')
    this.emit('all-disconnected')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 🛡️ WAVE 2020.2c: WATCHDOG USB (Multi-Universe)
  // ─────────────────────────────────────────────────────────────────────────

  private startWatchdog(): void {
    if (this.watchdogTimer) return
    
    this.watchdogTimer = setInterval(() => {
      // Verificar que todos los puertos siguen abiertos
      for (const [universe, port] of this.ports) {
        if (!port || !port.isOpen) {
          this.log(`🐕 Watchdog: Universe ${universe} port not open!`)
          this.disconnectUniverse(universe)
        }
      }
    }, this.config.watchdogInterval)
    
    this.log('🐕 Watchdog started (multi-universe mode)')
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
      this.log('🐕 Watchdog stopped')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SALIDA DMX PARALELA (WAVE 2020.2c HYDRA)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🎚️ Establece el valor de un canal DMX (1-512) en un universo
   */
  setChannel(channel: number, value: number, universe: number = 0): void {
    if (channel < 1 || channel > DMX_CHANNELS) return
    
    const buf = this.universeBuffers.get(universe)
    if (buf) {
      buf[channel] = Math.max(0, Math.min(255, Math.round(value)))
    }
  }

  /**
   * 🎚️ Establece múltiples canales desde un offset en un universo
   */
  setChannels(startChannel: number, values: number[], universe: number = 0): void {
    const buf = this.universeBuffers.get(universe)
    if (!buf) return
    
    for (let i = 0; i < values.length; i++) {
      const channel = startChannel + i
      if (channel <= DMX_CHANNELS) {
        buf[channel] = Math.max(0, Math.min(255, Math.round(values[i])))
      }
    }
  }

  /**
   * 🎚️ Establece todo el buffer DMX de un universo de una vez
   */
  setUniverse(values: Buffer | Uint8Array | number[], universe: number = 0): void {
    this.initBuffer(universe)
    const buf = this.universeBuffers.get(universe)!
    const len = Math.min(values.length, DMX_CHANNELS)
    
    for (let i = 0; i < len; i++) {
      buf[i + 1] = values[i]
    }
  }

  /**
   * 🔄 Inicia el loop de salida DMX (opcional - sendAll desde HAL es mejor)
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
   * 📤 WAVE 2020.2c: El método mágico que el HAL necesita
   * Envía TODOS los universos en paralelo sin bloquear
   * 
   * Compatible con IDMXDriver (WAVE 2020.2b)
   */
  async sendAll(): Promise<boolean> {
    if (this.ports.size === 0) return false

    const promises: Promise<void>[] = []

    for (const [universe, port] of this.ports) {
      const buffer = this.universeBuffers.get(universe)
      if (port.isOpen && buffer) {
        // Envolver write en promesa para paralelizar
        const p = new Promise<void>((resolve) => {
          port.write(buffer, (err: Error | null | undefined) => {
            if (err) {
              this.log(`❌ [Univ ${universe}] Write error: ${err.message}`)
            }
            resolve() // Resolvemos siempre para no bloquear Promise.all
          })
        })
        promises.push(p)
      }
    }

    await Promise.all(promises)
    return true
  }

  /**
   * 📤 Envía un frame DMX a TODOS los dispositivos (loop interno)
   * Compatibility method - sendAll() es preferido
   */
  private sendDMXFrame(): void {
    // Simplemente llamar sendAll (fire and forget)
    void this.sendAll()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECONEXIÓN AUTOMÁTICA (WAVE 2020.2c HYDRA)
  // ─────────────────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    
    this.log(`⏰ Reconnecting in ${this.config.reconnectDelay}ms...`)
    
    this.reconnectTimer = setTimeout(async () => {
      // Intentar reconectar todos los dispositivos disponibles
      this.log('� Attempting hydra reconnect...')
      await this.autoConnect()
    }, this.config.reconnectDelay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[UniversalDMX] ${message}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WAVE 2020.2c: GETTERS Y MÉTODOS PÚBLICOS (HYDRA)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔍 Alias for listDevices() - used by IPC handlers
   */
  async scanDevices(): Promise<DMXDevice[]> {
    return this.listDevices()
  }

  /**
   * 📤 Alias for setUniverse() - used by IPC handlers
   */
  sendFrame(frame: number[], universe: number = 0): void {
    this.setUniverse(frame, universe)
  }

  // Getters públicos
  get isConnected(): boolean {
    return this.ports.size > 0
  }

  get connectedUniverses(): number {
    return this.ports.size
  }

  get devices(): Map<number, DMXDevice> {
    return this.connectedDevices
  }

  get error(): string | null {
    return this.lastError
  }

  /**
   * Get buffer for a specific universe
   */
  getBuffer(universe: number = 0): Buffer | undefined {
    return this.universeBuffers.get(universe)
  }

  /**
   * 📊 Obtiene estadísticas del driver (Multi-Universe)
   */
  getStats(): {
    universes: number
    devices: Array<{ universe: number; device: DMXDevice }>
    refreshRate: number
    totalChannelsActive: number
    lastError: string | null
  } {
    let totalActive = 0
    
    // Contar canales activos en todos los universos
    for (const [universe, buffer] of this.universeBuffers) {
      if (this.ports.has(universe)) {
        for (let i = 1; i <= DMX_CHANNELS; i++) {
          if (buffer[i] > 0) totalActive++
        }
      }
    }

    const deviceList = Array.from(this.connectedDevices.entries()).map(([universe, device]) => ({
      universe,
      device,
    }))

    return {
      universes: this.ports.size,
      devices: deviceList,
      refreshRate: this.config.refreshRate,
      totalChannelsActive: totalActive,
      lastError: this.lastError,
    }
  }

  /**
   * 🧹 Blackout: todos los canales a 0 en TODOS los universos
   */
  blackout(): void {
    for (const [universe, buffer] of this.universeBuffers) {
      for (let i = 1; i <= DMX_CHANNELS; i++) {
        buffer[i] = 0
      }
    }
    this.log(`🌑 Blackout (${this.universeBuffers.size} universes)`)
  }

  /**
   * ☀️ Full on: todos los canales a 255 en TODOS los universos
   */
  fullOn(): void {
    for (const [universe, buffer] of this.universeBuffers) {
      for (let i = 1; i <= DMX_CHANNELS; i++) {
        buffer[i] = 255
      }
    }
    this.log(`☀️ Full on (${this.universeBuffers.size} universes)`)
  }

  /**
   * 🔦 WAVE 2020.2c: Highlight - Enciende solo un fixture específico
   */
  highlightFixture(
    startChannel: number, 
    channelCount: number, 
    universe: number = 0,
    isMovingHead: boolean = false
  ): void {
    // Primero blackout
    this.blackout()
    
    // Encender dimmer del fixture (primer canal suele ser dimmer)
    this.setChannel(startChannel, 255, universe)
    
    // Si tiene RGB, ponerlo en blanco
    if (channelCount >= 4) {
      this.setChannel(startChannel + 1, 255, universe) // R
      this.setChannel(startChannel + 2, 255, universe) // G
      this.setChannel(startChannel + 3, 255, universe) // B
    }
    
    // Si es moving head, mover lentamente
    if (isMovingHead && channelCount >= 6) {
      // Pan al 50% (centro)
      this.setChannel(startChannel + 4, 128, universe)
      // Tilt al 50% (centro)
      this.setChannel(startChannel + 5, 128, universe)
    }
    
    this.log(`🔦 Highlighting fixture at Univ ${universe} / DMX ${startChannel} (${channelCount}ch)`)
  }
}

// Exportar instancia singleton
export const universalDMX = new UniversalDMXDriver({ debug: true })

// También exportar con el nombre antiguo para compatibilidad
export const tornadoDriver = universalDMX
export { UniversalDMXDriver as TornadoDriver }
