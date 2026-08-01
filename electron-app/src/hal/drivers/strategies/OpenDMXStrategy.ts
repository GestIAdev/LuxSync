/**
 * WAVE 6019.1: OPEN DMX STRATEGY — Main Process Micro-Blocking
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (Main Process + SAB):
 *
 *   WAVE 6019.1: SerialPort vive en el Main Process. Lee del SAB
 *   directamente via DmxUniverseReader. El BREAK/MAB se ejecuta
 *   con micro-bloqueo (spinWaitNs) en el hilo principal.
 *
 *   Flujo de datos:
 *   TickEngine ──(SAB write @44Hz)──→ OpenDMXStrategy ──(SAB read @33Hz)──→ SerialPort
 *
 *   ¿Por qué Main Process y no worker_thread?
 *   serialport usa uv_poll_t internamente, que no es seguro en worker_threads
 *   de Electron. El callback de uv_poll_t llama a node::MakeCallback, que
 *   puede fallar con "HandleScope" bajo carga real. En Main Process,
 *   node_bindings.cc de Electron maneja correctamente el locking V8+Chromium.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */

import { SerialPort } from 'serialport'
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers'
import { CHANNELS_PER_UNI } from '../../../core/aether/glass/layout'
import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'
import { getDmxSab } from '../../../core/aether/glass/GlassMemory'

const DMX_OUTPUT_HZ = 33
const BREAK_BAUD = 76923
const DMX_BAUD = 250000
const BREAK_HOLD_NS = 160_000n
const MAB_NS = 20_000n

const spinWaitNs = (nanoseconds: bigint) => {
  const start = process.hrtime.bigint()
  while (process.hrtime.bigint() - start < nanoseconds) {}
}

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX Main Process (WAVE 6019.1)'
  readonly selfManaged = true

  private port: SerialPort | null = null
  private reader: DmxUniverseReader | null = null
  private loopTimer: ReturnType<typeof setInterval> | null = null
  private lastFrameId = -1
  private universe = 0
  private dmxBuffer = Buffer.alloc(513, 0)
  private isSending = false
  private isRunning = false
  private _destroyed = false
  private _portPath: string | null = null
  private _reconnectAttempts = 0
  private _reconnecting = false
  private _portOpening = false
  private lastSniffLog = 0
  private _sendWatchdog: ReturnType<typeof setInterval> | null = null
  private _sendStartedAt = 0

  private sniff(log: (msg: string) => void, msg: string): void {
    const now = Date.now()
    if (now - this.lastSniffLog >= 1000) {
      log(`[SNIFFER] ${msg}`)
      this.lastSniffLog = now
    }
  }

  resetBuffer(log: (msg: string) => void): void {
    this.lastFrameId = -1
    log('[OpenDMX] resetBuffer: lastFrameId reseteado — forzando re-lectura del SAB')
  }

  async connect(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean> {
    if (this.port || this.loopTimer) {
      log('[OpenDMX] Conexion previa detectada — destruyendo...')
      await this.destroy(log)
    }

    this._destroyed = false
    this._portPath = portPath
    this._reconnectAttempts = 0

    const sab = getDmxSab()
    this.reader = new DmxUniverseReader(sab)
    this.universe = universe
    this.lastFrameId = -1

    log(`[OpenDMX] Abriendo ${portPath} (universo ${universe}, ${DMX_OUTPUT_HZ}Hz)`)

    const portOk = this._openPort(portPath, log)

    // 🛡️ WAVE 8010: WATCHDOG — si isSending queda en true > 300ms, forzar reset.
    // Esto cubre el caso donde un callback de port.update/port.write nunca firea.
    this._sendWatchdog = setInterval(() => {
      if (this._destroyed) return
      if (this.isSending && this._sendStartedAt > 0) {
        const stuckMs = Date.now() - this._sendStartedAt
        if (stuckMs > 300) {
          log(`[OpenDMX] 🔥 WATCHDOG: isSending stuck for ${stuckMs}ms — force resetting`)
          this.isSending = false
          if (this.port?.isOpen) {
            setTimeout(() => this.runTick(log), 25)
          } else {
            this._attemptReconnect(log)
          }
        }
      }
      // If port is closed but NOT destroyed, force reconnect
      if (!this.port?.isOpen && !this.isSending && !this._reconnecting && !this._portOpening) {
        this._attemptReconnect(log)
      }
    }, 100)

    if (portOk && this.port?.isOpen) {
      this.startOutputLoop(log)
      log(`[OpenDMX] Puerto abierto — loop activo @${DMX_OUTPUT_HZ}Hz`)
    } else if (portOk) {
      log(`[OpenDMX] Puerto en apertura — loop iniciará cuando el puerto esté listo`)
    } else {
      log(`[OpenDMX] ⚠️ Puerto NO abierto — loop en modo reconexión automática`)
    }
    return true
  }

  private _openPort(portPath: string, log: (msg: string) => void): boolean {
    try {
      this.port = new SerialPort({ path: portPath, baudRate: DMX_BAUD, dataBits: 8, stopBits: 2, parity: 'none', autoOpen: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`[OpenDMX] ERROR al crear SerialPort: ${msg}`)
      return false
    }

    this.port.on('error', (err: Error) => {
      log(`[OpenDMX] ⚠️ Port error event: ${err.message}`)
      this.isSending = false
      if (!this._destroyed) setTimeout(() => this.runTick(log), 50)
    })

    this.port.on('close', () => {
      log(`[OpenDMX] ⚠️ Port closed unexpectedly — will auto-reconnect...`)
      this.isSending = false
      if (!this._destroyed) {
        setTimeout(() => this._attemptReconnect(log), 200)
      }
    })

    // Explicit open with callback — ensures we know when the port is ready
    this._portOpening = true
    this.port.open((openErr: Error | null) => {
      this._portOpening = false
      if (openErr) {
        log(`[OpenDMX] ⚠️ Port open failed: ${openErr.message} — will retry via watchdog`)
        return
      }
      log(`[OpenDMX] ✅ Port opened successfully: ${portPath}`)
      // Kick the loop now that the port is ready
      if (!this._destroyed) this.startOutputLoop(log)
    })

    return true
  }

  private _attemptReconnect(log: (msg: string) => void): void {
    if (this._destroyed) return
    if (this._portOpening) return
    if (this.port?.isOpen) {
      // Port is already open — if loop isn't running, restart it
      if (!this.isSending) {
        log(`[OpenDMX] 🔄 Port already open — restarting output loop`)
        this.startOutputLoop(log)
      }
      return
    }
    if (!this._portPath) return
    if (this._reconnecting) return

    this._reconnecting = true
    this._reconnectAttempts++
    const delay = Math.min(2000, 200 + this._reconnectAttempts * 200)
    log(`[OpenDMX] 🔄 Reconnect attempt ${this._reconnectAttempts} in ${delay}ms...`)

    setTimeout(() => {
      this._reconnecting = false
      if (this._destroyed) return
      if (this.port?.isOpen) {
        log(`[OpenDMX] ✅ Port recovered on attempt ${this._reconnectAttempts} — loop reactivado`)
        this._reconnectAttempts = 0
        this.isSending = false
        this.startOutputLoop(log)
        return
      }

      if (this.port) {
        try { this.port.close() } catch {}
        this.port = null
      }

      const ok = this._openPort(this._portPath!, log)
      if (ok) {
        log(`[OpenDMX] ✅ Port recovering on attempt ${this._reconnectAttempts} — waiting for open callback`)
        this._reconnectAttempts = 0
        this.isSending = false
      } else {
        log(`[OpenDMX] ❌ Reconnect attempt ${this._reconnectAttempts} failed — will retry...`)
      }
    }, delay)
  }

  private startOutputLoop(log: (msg: string) => void): void {
    this.isSending = false
    this.isRunning = true
    this.loopTimer = null

    const tick = () => this.runTick(log)
    setTimeout(tick, 0)
  }

  private runTick(log: (msg: string) => void): void {
    if (this._destroyed) return
    if (!this.port?.isOpen) return  // Port closed — watchdog & close handler manage reconnect
    if (!this.reader) { setTimeout(() => this.runTick(log), 25); return }
    if (this.isSending) { setTimeout(() => this.runTick(log), 5); return }

    // sniff('runTick: Reading SAB')
    const frame = this.reader.readCoherent(this.lastFrameId)
    if (frame) {
      this.lastFrameId = frame.frameId
      const offset = this.universe * CHANNELS_PER_UNI
      const uniData = frame.data.subarray(offset, offset + CHANNELS_PER_UNI)
      
      this.dmxBuffer[0] = 0x00
      for (let i = 0; i < CHANNELS_PER_UNI; i++) {
        this.dmxBuffer[i + 1] = uniData[i]
      }
      // sniff(`runTick: SAB Fresh Frame ${frame.frameId} processed.`)
    } else {
      // sniff('runTick: SAB No new frame, reusing old buffer.')
    }

    this.isSending = true
    this._sendStartedAt = Date.now()
    this.sendFrame(log)
  }

  private sendFrame(log: (msg: string) => void): void {
    const port = this.port
    if (!port?.isOpen) {
      this.isSending = false
      this._attemptReconnect(log)
      return
    }

    const scheduleNext = () => {
      this.isSending = false
      if (!this._destroyed) setTimeout(() => this.runTick(log), 25)
    }

    // PASO 1: Bajar baud para generar BREAK
    try {
      port.update({ baudRate: BREAK_BAUD }, (err) => {
        if (err) {
          log(`[OpenDMX] ERROR BREAK update: ${err.message}`)
          scheduleNext()
          return
        }
        if (this._destroyed) { this.isSending = false; return }

        // PASO 2: Emitir 0x00 → BREAK
        try {
          port.write(Buffer.from([0x00]), (writeErr1) => {
            if (writeErr1) {
              log(`[OpenDMX] ERROR BREAK write: ${writeErr1.message}`)
              scheduleNext()
              return
            }

            spinWaitNs(BREAK_HOLD_NS)

            // PASO 3: Volver a 250000 baud
            try {
              port.update({ baudRate: DMX_BAUD }, (err2) => {
                if (err2) {
                  log(`[OpenDMX] ERROR MAB update: ${err2.message}`)
                  scheduleNext()
                  return
                }
                if (this._destroyed) { this.isSending = false; return }

                spinWaitNs(MAB_NS)

                // PASO 4: Emitir los 513 bytes del universo DMX
                try {
                  port.write(this.dmxBuffer, (writeErr) => {
                    if (writeErr) log(`[OpenDMX] ERROR payload: ${writeErr.message}`)
                    scheduleNext()
                  })
                } catch (syncErr) {
                  log(`[OpenDMX] SYNC THROW payload write: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`)
                  scheduleNext()
                }
              })
            } catch (syncErr) {
              log(`[OpenDMX] SYNC THROW MAB update: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`)
              scheduleNext()
            }
          })
        } catch (syncErr) {
          log(`[OpenDMX] SYNC THROW BREAK write: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`)
          scheduleNext()
        }
      })
    } catch (syncErr) {
      log(`[OpenDMX] SYNC THROW BREAK update: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`)
      scheduleNext()
    }
  }

  async send(
    _port: SerialPortInstance | null,
    _buffer: Buffer,
    _universe: number,
    _log: (msg: string) => void,
  ): Promise<void> {
    // No-op: el loop interno lee directamente del SAB.
    // TickEngine ya escribió en el SAB via DmxUniverseWriter.commitFrame().
  }

  isAlive(): boolean {
    return !this._destroyed && this.port?.isOpen === true
  }

  async destroy(log: (msg: string) => void): Promise<void> {
    this._destroyed = true
    this.isRunning = false
    this.isSending = false

    if (this._sendWatchdog) {
      clearInterval(this._sendWatchdog)
      this._sendWatchdog = null
    }

    if (this.port) {
      try {
        this.port.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`[OpenDMX] ERROR al cerrar puerto: ${msg}`)
      }
      this.port = null
    }

    this.reader = null
    this.lastFrameId = -1
    log('[OpenDMX] Estrategia destruida')
  }
}
