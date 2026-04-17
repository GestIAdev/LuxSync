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
import type { DMXSendStrategy } from './strategies/DMXSendStrategy'
import { EnttecProStrategy } from './strategies/EnttecProStrategy'
import { OpenDMXStrategy } from './strategies/OpenDMXStrategy'

// Tipo para SerialPort (se carga dinámicamente)
type SerialPortModule = typeof import('serialport')
export type SerialPortInstance = InstanceType<SerialPortModule['SerialPort']>

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
  /** Estrategia de envío por defecto ('enttec-pro' | 'open-dmx'). Default: 'enttec-pro' */
  defaultStrategy: 'enttec-pro' | 'open-dmx'
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
  private isTransmitting: boolean = false

  // 🔒 WAVE 2240: THE HYDRA MUTEX — Semáforos de operación de hardware
  // Solo una operación de connect/disconnect puede ejecutarse al mismo tiempo.
  // Previene Race Conditions donde dos autoConnect() superpuestos bloquean el COM.
  private isConnecting: boolean = false
  private isDisconnecting: boolean = false

  // 🏛️ WAVE 3000: Strategy Pattern — estrategia de envío por universo
  private strategies: Map<number, DMXSendStrategy> = new Map()
  private defaultStrategy: DMXSendStrategy

  // 🔎 FORENSIC TRACE (CP4): serial write counters (per universe)
  private traceWriteCountByUniverse: Map<number, number> = new Map()

  // 🔬 WAVE 3020: SEMAPHORE TRAP — mide tiempo entre llamadas a sendAll()
  private _lastSendAllTime: number = 0

  // 🫀 CARDIOGRAMA: callback para escalar warning spikes al capa superior (Orchestrator)
  public onWarning: ((msg: string) => void) | null = null

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
      defaultStrategy: config.defaultStrategy ?? 'open-dmx',
    }

    // 🏛️ WAVE 3000: Instanciar estrategia por defecto
    this.defaultStrategy = this.config.defaultStrategy === 'open-dmx'
      ? new OpenDMXStrategy()
      : new EnttecProStrategy()

    // Inicializar Universo 0 por defecto (para compatibilidad con código legacy)
    this.initBuffer(0)
    // WAVE 2098: Boot silence
  }

  /**
   * Inicializa un buffer DMX para un universo específico
   */
  private initBuffer(universe: number): void {
    if (!this.universeBuffers.has(universe)) {
      const buf = Buffer.alloc(DMX_CHANNELS + 1, 0)
      buf[0] = DMX_START_CODE
      this.universeBuffers.set(universe, buf)
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
    const devices: DMXDevice[] = []

    try {
      // Importar serialport dinámicamente
      const serialportModule = await import('serialport')
      
      // FIX PARA ELECTRON: Buscar la clase SerialPort sin importar cómo se exportó
      const SP = serialportModule.SerialPort || (serialportModule as any).default?.SerialPort || serialportModule;
      this.SerialPort = SP as unknown as SerialPortModule['SerialPort']
      
      const ports = await SP.list()
      
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
   * 🎯 WAVE 2020.2c: Escanea y conecta TODOS los dispositivos disponibles
   * Asigna universos incrementalmente (0, 1, 2...)
   */
  async autoConnect(): Promise<boolean> {
    // 🔒 WAVE 2240: HYDRA MUTEX — rechazar si ya hay una operación en curso
    if (this.isConnecting) {
      this.log('⚠️ [Mutex] autoConnect() rejected — connection already in progress')
      return false
    }
    if (this.isDisconnecting) {
      this.log('⚠️ [Mutex] autoConnect() rejected — disconnect in progress, wait for it to finish')
      return false
    }
    if (this.isScanning) {
      this.log('⚠️ Already scanning...')
      return false
    }
    
    this.isConnecting = true
    this.isScanning = true
    this.emit('connecting')
    this.log('🔍 Hydra: Scanning for ALL compatible devices...')

    try {
      const devices = await this.listDevices()
      
      if (devices.length === 0) {
        this.log('⚠️ No serial devices found')
        this.emit('no-devices')
        return false
      }

      // Filtrar dispositivos que ya están conectados
      const connectedPaths = Array.from(this.connectedDevices.values()).map(d => d.path)
      const newDevices = devices.filter(d => !connectedPaths.includes(d.path))

      if (newDevices.length === 0 && this.ports.size > 0) {
        this.log('✅ All available devices already connected')
        return true
      }

      // Buscar el siguiente universo libre
      let nextUniverse = 0
      while (this.ports.has(nextUniverse)) {
        nextUniverse++
      }

      // Intentar conectar cada dispositivo nuevo
      for (const device of newDevices) {
        this.log(`🔌 Hydra: Found ${device.friendlyName} (${device.confidence}%), assigning Universe ${nextUniverse}...`)
        const success = await this.connect(device.path, nextUniverse)
        if (success) {
          nextUniverse++
        }
      }

      if (this.ports.size > 0 || this.connectedDevices.size > 0) {
        this.log(`✅ 🐙 Hydra Active: ${this.connectedDevices.size} universe(s) online`)
        this.emit('hydra-ready', { universes: this.connectedDevices.size })
        return true
      }
      
      this.log('❌ Could not connect to any device')
      return false

    } finally {
      // 🔓 WAVE 2240: Liberar mutex SIEMPRE, tanto si triunfa como si falla
      this.isConnecting = false
      this.isScanning = false
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONEXIÓN MULTI-CABEZA
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 🔌 WAVE 2020.2c: Conecta un dispositivo a un Universo específico
   *
   * WAVE 2021.4: ARQUITECTURA DE AISLAMIENTO V8
   *
   *   Flujo reestructurado para que serialport SOLO se cargue en el main
   *   process cuando es estrictamente necesario (driver-managed strategies
   *   como EnttecPro). Para selfManaged strategies (OpenDMX Phantom Worker),
   *   serialport se carga ÚNICAMENTE en el worker thread.
   *
   *   ¿Por qué? El addon nativo serialport (.node) registra callbacks V8
   *   en el isolate donde se importa. Si se importa en main Y en worker,
   *   el GC del main puede tocar handles nativos mientras el worker ejecuta
   *   port.write/port.set → Fatal error: HandleScope::HandleScope.
   *
   *   Solución: solo una copia del addon nativo por conexión, en un solo
   *   isolate. Self-managed → solo en worker. Driver-managed → solo en main.
   */
  async connect(portPath: string, universe: number = 0): Promise<boolean> {
    // 🔒 WAVE 2240: HYDRA MUTEX — si ya hay un connect() en curso (desde autoConnect),
    // NO rechazamos aquí porque autoConnect() setea isConnecting y luego llama a connect().
    // El guard de isDisconnecting SÍ aplica: no conectar mientras se destruye el worker.
    if (this.isDisconnecting) {
      this.log(`⚠️ [Mutex] connect() rejected — disconnect in progress for Universe ${universe}`)
      return false
    }

    if (this.ports.has(universe) || this.connectedDevices.has(universe)) {
      this.log(`⚠️ Universe ${universe} already occupied, skipping ${portPath}`)
      return false
    }

    // Si llega aquí directamente (no desde autoConnect), gestionar su propio mutex
    const ownsMutex = !this.isConnecting
    if (ownsMutex) {
      if (this.isConnecting) {
        this.log(`⚠️ [Mutex] connect() rejected — another connection already in progress`)
        return false
      }
      this.isConnecting = true
      this.emit('connecting')
    }

    this.log(`🔌 [Univ ${universe}] Connecting to ${portPath}...`)

    try {
      // ─── PASO 1: Detectar estrategia SIN importar serialport ─────────
      // detectStrategy() solo necesita el friendlyName para decidir.
      // Construimos un deviceInfo ligero con los datos que ya tenemos.
      // Si listDevices() ya fue llamado previamente (autoConnect, scanDevices),
      // this.SerialPort estará cacheado y podemos usarlo. Si no,
      // hacemos detección basada SOLO en el path (todos los cables tontos
      // caen en OpenDMXStrategy que es lo más común).
      let deviceInfo: DMXDevice

      if (this.SerialPort) {
        // SerialPort ya cargado de un listDevices() anterior → podemos listar
        const availableDevices = await this.listDevices()
        deviceInfo = availableDevices.find(d => d.path === portPath) || {
          path: portPath,
          deviceType: 'generic' as const,
          friendlyName: portPath,
          confidence: 50,
        }
      } else {
        // SerialPort NO cargado → crear deviceInfo mínimo SIN importar el addon.
        // Esto evita que el addon nativo se registre en el V8 isolate del main.
        deviceInfo = {
          path: portPath,
          deviceType: 'generic' as const,
          friendlyName: portPath,
          confidence: 50,
        }
      }

      this.connectedDevices.set(universe, deviceInfo)

      // 🏛️ WAVE 3000 + 2021.1: Auto-detect strategy ANTES de crear el puerto.
      // Las estrategias self-managed (OpenDMX Phantom Worker) abren su propia
      // conexión serial en un worker_threads aislado.
      if (!this.strategies.has(universe)) {
        const detectedStrategy = this.detectStrategy(deviceInfo)
        this.strategies.set(universe, detectedStrategy)
        this.log(`🏛️ [Univ ${universe}] Auto-detected strategy: ${detectedStrategy.name}`)
      }

      const strategy = this.strategies.get(universe)!

      // ─── BIFURCACIÓN: Self-managed vs Driver-managed ─────────────────
      if (strategy.selfManaged && strategy.connect) {
        // 👻 WAVE 2021.1+4: La estrategia maneja su propio puerto serial.
        // El driver NO importa serialport aquí → el addon nativo SOLO existe
        // en el V8 isolate del worker thread. Cero contención de HandleScope.
        this.initBuffer(universe)

        const success = await strategy.connect(portPath, universe, (msg) => this.log(msg))
        if (!success) {
          this.connectedDevices.delete(universe)
          this.strategies.delete(universe)
          throw new Error('Strategy self-connect failed')
        }

        this.log(`✅ [Univ ${universe}] Connected via ${strategy.name} to ${deviceInfo.friendlyName}`)

        // Activar el output loop para flush periódico del buffer al child process.
        // Sin esto, sendAll() solo se ejecuta desde el HAL musical render loop,
        // y los canales seteados via dmx:sendDirect/dmx:sendChannel nunca llegan al worker.
        this.startOutputLoop()

      } else {
        // 🔧 Driver-managed: cargar serialport AQUÍ y crear SerialPort
        if (!this.SerialPort) {
          const serialportModule = await import('serialport')
          this.SerialPort = serialportModule.SerialPort as unknown as SerialPortModule['SerialPort']
        }

        const port = new this.SerialPort({
          path: portPath,
          baudRate: 250000,
          dataBits: 8,
          stopBits: 2,
          parity: 'none',
          autoOpen: false,
        }) as unknown as SerialPortInstance

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000)
          port.open((err: Error | null) => {
            clearTimeout(timeout)
            err ? reject(err) : resolve()
          })
        })

        this.ports.set(universe, port)
        this.initBuffer(universe)

        // 🛡️ Eventos de error individuales por universo
        port.on('error', (err: Error) => this.handlePortError(universe, err))
        port.on('close', () => this.handlePortClose(universe))

        this.log(`✅ [Univ ${universe}] Connected to ${deviceInfo.friendlyName}`)
      }

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
    } finally {
      // 🔓 WAVE 2240: Liberar mutex solo si esta llamada lo adquirió (llamada directa)
      if (ownsMutex) {
        this.isConnecting = false
      }
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
    const strategy = this.strategies.get(universe)

    // 👻 WAVE 2021.1: Si la estrategia es self-managed, destruirla primero
    if (strategy?.selfManaged && strategy.destroy) {
      try {
        await strategy.destroy((msg) => this.log(msg))
      } catch (err) {
        this.log(`⚠️ [Univ ${universe}] Strategy destroy error: ${err}`)
      }
    }
    
    // Cerrar puerto driver-managed (si existe)
    if (port) {
      try {
        if (port.isOpen) {
          await new Promise<void>(r => port.close(() => r()))
        }
      } catch (err) {
        this.log(`⚠️ [Univ ${universe}] Error closing port: ${err}`)
      }
      this.ports.delete(universe)
    }

    this.connectedDevices.delete(universe)
    this.strategies.delete(universe)
    this.emit('disconnected', { universe, device })
    
    this.log(`🔌 [Univ ${universe}] Disconnected`)
    
    // Si no quedan universos conectados, intentar reconectar
    if (this.ports.size === 0 && this.connectedDevices.size === 0 && this.config.autoReconnect) {
      this.log('⚠️ All universes disconnected, scheduling reconnect...')
      this.scheduleReconnect()
    }
  }

  /**
   * 🔌 Desconecta TODOS los universos
   */
  async disconnect(): Promise<void> {
    // 🔒 WAVE 2240: HYDRA MUTEX — evitar desconexiones paralelas y
    // forzar que cualquier connect en curso no inicie tras nosotros
    if (this.isDisconnecting) {
      this.log('⚠️ [Mutex] disconnect() already in progress, skipping duplicate call')
      return
    }

    this.isDisconnecting = true
    // Si había una conexión en proceso, la marcamos como abortada
    this.isConnecting = false

    this.log('🔌 Disconnecting all universes...')
    
    this.stopOutputLoop()
    this.stopWatchdog()
    this.clearReconnectTimer()

    // WAVE 3025: flushPending eliminado — no hay auto-flush reactivo

    // 👻 WAVE 2021.1: Destruir strategies self-managed primero
    for (const [universe, strategy] of this.strategies) {
      if (strategy.selfManaged && strategy.destroy) {
        try {
          await strategy.destroy((msg) => this.log(msg))
        } catch (err) {
          this.log(`⚠️ [Univ ${universe}] Strategy destroy error: ${err}`)
        }
      }
    }

    // Cerrar todos los puertos driver-managed
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
    this.strategies.clear()
    
    this.log('🔌 All universes disconnected')
    this.emit('all-disconnected')

    // 🔓 WAVE 2240: Liberar mutex — el hardware quedó libre
    this.isDisconnecting = false
    this.isConnecting = false
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
   * 🎚️ Establece el valor de un canal DMX (1-512) en un universo.
   * Flush inmediato al child process si hay strategies selfManaged conectadas.
   */
  setChannel(channel: number, value: number, universe: number = 0): void {
    if (channel < 1 || channel > DMX_CHANNELS) return
    
    const buf = this.universeBuffers.get(universe)
    if (buf) {
      const clamped = Math.max(0, Math.min(255, Math.round(value)))
      if (buf[channel] === clamped) return  // No cambio real — skip
      buf[channel] = clamped
      // WAVE 3025: NO auto-flush — el HAL llama sendAll() externamente
    }
  }

  /**
   * 🎚️ Establece múltiples canales desde un offset en un universo.
   * Solo escribe en buffer — el flush lo hace el caller via sendAll().
   */
  setChannels(startChannel: number, values: number[], universe: number = 0): void {
    const buf = this.universeBuffers.get(universe)
    if (!buf) return
    
    for (let i = 0; i < values.length; i++) {
      const channel = startChannel + i
      if (channel <= DMX_CHANNELS) {
        const clamped = Math.max(0, Math.min(255, Math.round(values[i])))
        buf[channel] = clamped
      }
    }
    // WAVE 3025: NO auto-flush — el HAL llama sendAll() externamente
  }

  /**
   * 🎚️ Establece todo el buffer DMX de un universo de una vez.
   * Solo escribe en buffer — el flush lo hace el caller via sendAll().
   */
  setUniverse(values: Buffer | Uint8Array | number[] | Record<number, number>, universe: number = 0): void {
    this.initBuffer(universe)
    const buf = this.universeBuffers.get(universe)!

    // Si es un Array o Buffer normal
    if (Array.isArray(values) || values instanceof Uint8Array || Buffer.isBuffer(values)) {
      const len = Math.min(values.length, DMX_CHANNELS)
      for (let i = 0; i < len; i++) {
        // buf[0] es START CODE, los canales empiezan en buf[1]
        buf[i + 1] = (values as any)[i]
      }
      // WAVE 3025: NO auto-flush
      return
    }

    // Si el IPC lo mutó a un objeto diccionario { "0": 255, "1": 128 }
    for (const [ch, val] of Object.entries(values)) {
      const channel = parseInt(ch, 10)
      if (!Number.isFinite(channel)) continue

      // Convertimos a base 1 (si el array venía en base 0, le sumamos 1)
      const dmxChan = channel < DMX_CHANNELS ? channel + 1 : channel
      if (dmxChan >= 1 && dmxChan <= DMX_CHANNELS) {
        const v = typeof val === 'number' ? val : parseInt(String(val), 10)
        if (!Number.isFinite(v)) continue
        buf[dmxChan] = Math.max(0, Math.min(255, Math.round(v)))
      }
    }
    // WAVE 3025: NO auto-flush
  }

  /**
   * 🔄 Inicia el loop de salida DMX (legacy — solo para driver-managed strategies)
   * Para selfManaged (OpenDMX): no-op. El flush lo hace el HAL via sendAll() externo.
   */
  private startOutputLoop(): void {
    // selfManaged strategies no necesitan un output loop en el Main.
    // El child process tiene su propio loop continuo.
    // WAVE 3025: Los cambios se escriben en buffer y el HAL llama sendAll() al final.
    // Solo mantener el loop para driver-managed (EnttecPro) si existiera.
    const hasDriverManaged = this.ports.size > 0
    if (!hasDriverManaged) {
      this.log(`🔄 Output flush: reactive mode (selfManaged strategies)`)
      return
    }

    if (this.outputLoop) return
    const intervalMs = 1000 / this.config.refreshRate
    this.outputLoop = setInterval(() => {
      this.sendDMXFrame()
    }, intervalMs)
    this.log(`🔄 Output loop started at ${this.config.refreshRate}Hz (driver-managed)`)
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
    // � WAVE 3020: DOUBLE-SEND + SEMAPHORE TRAP
    const _now = performance.now()
    const _gap = _now - this._lastSendAllTime
    if (this._lastSendAllTime > 0 && _gap < 2) {
      console.error(`[DOUBLE-SEND TRAP] 🚨 Dos sendAll() en ${_gap.toFixed(2)}ms! Fuego cruzado detectado.`)
    }
    this._lastSendAllTime = _now

    // 🚦 SEMÁFORO: Si el hardware no terminó el frame anterior, DROP silencioso.
    if (this.isTransmitting) {
      console.error(`[SEMAPHORE TRAP] 🚨 Colisión! Frame dropeado — driver ocupado (isTransmitting=true) gap=${_gap.toFixed(1)}ms`)
      return false
    }

    // Verificar que hay ALGO conectado (driver-managed ports O self-managed strategies)
    const hasDriverPorts = this.ports.size > 0
    const hasSelfManaged = Array.from(this.strategies.values()).some(s => s.selfManaged)
    if (!hasDriverPorts && !hasSelfManaged) return false

    this.isTransmitting = true
    const promises: Promise<void>[] = []

    // ─── Driver-managed universes (EnttecPro): enviar con port ──────────
    for (const [universe, port] of this.ports) {
      const buffer = this.universeBuffers.get(universe)
      if (port.isOpen && buffer) {
        const strategy = this.strategies.get(universe) ?? this.defaultStrategy
        promises.push(strategy.send(port, buffer, universe, (msg) => this.log(msg)))
      }
    }

    // ─── Self-managed universes (Phantom Worker): enviar sin port ───────
    for (const [universe, strategy] of this.strategies) {
      if (!strategy.selfManaged) continue  // ya procesado arriba
      const buffer = this.universeBuffers.get(universe)
      if (buffer) {
        promises.push(strategy.send(null, buffer, universe, (msg) => this.log(msg)))
      }
    }

    await Promise.all(promises)
    this.isTransmitting = false // 🚦 Cable libre, listos para el siguiente frame
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
  // 🏛️ WAVE 3000: STRATEGY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Configura la estrategia de envío para un universo específico.
   * Útil cuando tienes un Enttec Pro en universo 0 y un Open DMX en universo 1.
   */
  async setStrategy(universe: number, type: 'enttec-pro' | 'open-dmx'): Promise<void> {
    // Destruir strategy anterior si era self-managed
    const previous = this.strategies.get(universe)
    if (previous?.selfManaged && previous.destroy) {
      await previous.destroy((msg) => this.log(msg))
    }

    const strategy = type === 'open-dmx' ? new OpenDMXStrategy() : new EnttecProStrategy()
    this.strategies.set(universe, strategy)
    this.log(`🏛️ [Univ ${universe}] Strategy set: ${strategy.name}`)
  }

  /**
   * Auto-detecta la estrategia correcta basándose en el tipo de dispositivo.
   * 
   * REGLA: Solo las interfaces con microcontrolador embebido que ENTIENDEN
   * el protocolo Enttec (Label 6) van a EnttecProStrategy.
   * 
   * La IMC UD 7S es un chip FTDI PURO (cable tonto). NO tiene micro.
   * Usa OpenDMXStrategy con Phantom Worker (worker_threads) para aislar
   * el bit-banging del Event Loop principal.
   */
  private detectStrategy(device: DMXDevice): DMXSendStrategy {
    // Interfaces con microcontrolador embebido que hablan protocolo Enttec:
    // - Enttec DMX USB Pro (PIC18F2550)
    // - DMXking ultraDMX Pro (STM32)
    const nameLC = device.friendlyName.toLowerCase()
    const isEnttecProtocol =
      (nameLC.includes('enttec') && nameLC.includes('pro')) ||
      nameLC.includes('dmxking')

    if (isEnttecProtocol) {
      return new EnttecProStrategy()
    }

    // Todo lo demás: FTDI puro (IMC UD 7S), CH340, Prolific, CP210x, genérico
    // → cable tonto, BREAK manual delegado al Phantom Worker para no bloquear
    //   el Event Loop con setTimeout + port.set (WAVE 2021.1)
    return new OpenDMXStrategy()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECONEXIÓN AUTOMÁTICA (WAVE 2020.2c HYDRA)
  // ─────────────────────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    
    this.log(`⏰ Reconnecting in ${this.config.reconnectDelay}ms...`)
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.autoConnect()
      } catch (err) {
        this.log(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }, this.config.reconnectDelay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private log(message: string): void {
    if (message.includes('CARDIOGRAMA') && this.onWarning) {
      this.onWarning(message)
    }
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

  // Getters públicos — incluyen tanto driver-managed (ports) como self-managed (strategies)
  get isConnected(): boolean {
    return this.connectedDevices.size > 0
  }

  get connectedUniverses(): number {
    return this.connectedDevices.size
  }

  get devices(): Map<number, DMXDevice> {
    return this.connectedDevices
  }

  get error(): string | null {
    return this.lastError
  }

  /** Nombre del primer dispositivo conectado (universe 0). Compat. con IPCHandlers. */
  get currentDevice(): string | null {
    const dev = this.connectedDevices.get(0)
    return dev ? dev.friendlyName : null
  }

  /**
   * Nombre de la estrategia activa para el universo 0.
   * 'worker' si es Phantom Worker (selfManaged), 'pro' si es EnttecPro, 'open-dmx' para el resto.
   */
  get activeStrategyProtocol(): 'WORKER' | 'PRO' | 'OPEN-DMX' | null {
    if (!this.isConnected) return null
    const strategy = this.strategies.get(0) ?? this.defaultStrategy
    if (strategy.selfManaged) return 'WORKER'
    if (strategy.name.includes('Enttec Pro')) return 'PRO'
    return 'OPEN-DMX'
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
   * 🧹 WAVE 3080: PURGA DE SHOW — limpiar buffers en todos los workers self-managed.
   * Llamado en lux:stage:sync (cambio de show) para evitar que focos no parcheados
   * en el nuevo show reciban valores residuales del show anterior.
   * Solo afecta a estrategias que implementan resetBuffer() (OpenDMXStrategy).
   */
  resetAllWorkerBuffers(): void {
    for (const strategy of this.strategies.values()) {
      strategy.resetBuffer?.(msg => this.log(msg))
    }
    // También limpiar el buffer principal self-managed si existe
    if (this.defaultStrategy?.resetBuffer) {
      this.defaultStrategy.resetBuffer(msg => this.log(msg))
    }
    this.log('🧹 WAVE 3080: worker buffers purgados (cambio de show)')
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
