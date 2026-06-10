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
  private lastSniffLog = 0
  private lastPayloadLog = 0

  private sniff(log: (msg: string) => void, msg: string): void {
    const now = Date.now()
    if (now - this.lastSniffLog >= 1000) {
      log(`[SNIFFER] ${msg}`)
      this.lastSniffLog = now
    }
  }

  private logPayload(log: (msg: string) => void): void {
    const now = Date.now()
    if (now - this.lastPayloadLog < 1000) return
    this.lastPayloadLog = now

    let nonZero = 0
    for (let i = 0; i < this.dmxBuffer.length; i++) {
      if (this.dmxBuffer[i] !== 0) nonZero++
    }
    const head = Array.from(this.dmxBuffer.subarray(1, 6))
      .map(v => v.toString().padStart(3, ' '))
      .join(',')
    log(`[SNIFFER] PAYLOAD DIAG: nonZero=${nonZero}/513 | ch1-5=[${head}]`)
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

    const sab = getDmxSab()
    this.reader = new DmxUniverseReader(sab)
    this.universe = universe
    this.lastFrameId = -1

    log(`[OpenDMX] Abriendo ${portPath} (universo ${universe}, ${DMX_OUTPUT_HZ}Hz)`)

    try {
      this.port = new SerialPort({ path: portPath, baudRate: DMX_BAUD, dataBits: 8, stopBits: 2, parity: 'none' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`[OpenDMX] ERROR al abrir SerialPort: ${msg}`)
      return false
    }

    this.startOutputLoop(log)
    log(`[OpenDMX] Puerto abierto — loop activo @${DMX_OUTPUT_HZ}Hz`)
    return true
  }

  private startOutputLoop(log: (msg: string) => void): void {
    this.isSending = false
    this.isRunning = true
    this.loopTimer = null

    const tick = () => this.runTick(log)
    setTimeout(tick, 0)
  }

  private runTick(log: (msg: string) => void): void {
    const sniff = (msg: string) => this.sniff(log, msg)
    sniff('runTick: START')
    if (!this.isRunning) { sniff('runTick: !isRunning'); return }
    if (!this.port?.isOpen) { sniff('runTick: !port.isOpen, retrying...'); setTimeout(() => this.runTick(log), 25); return }
    if (!this.reader) { sniff('runTick: !reader, retrying...'); setTimeout(() => this.runTick(log), 25); return }
    if (this.isSending) { sniff('runTick: isSending (waiting)'); setTimeout(() => this.runTick(log), 5); return }

    sniff('runTick: Reading SAB')
    const frame = this.reader.readCoherent(this.lastFrameId)
    if (frame) {
      this.lastFrameId = frame.frameId
      const offset = this.universe * CHANNELS_PER_UNI
      const uniData = frame.data.subarray(offset, offset + CHANNELS_PER_UNI)
      
      this.dmxBuffer[0] = 0x00
      for (let i = 0; i < CHANNELS_PER_UNI; i++) {
        this.dmxBuffer[i + 1] = uniData[i]
      }
      sniff(`runTick: SAB Fresh Frame ${frame.frameId} processed.`)
    } else {
      sniff('runTick: SAB No new frame, reusing old buffer.')
    }

    this.isSending = true
    this.logPayload(log)
    sniff('runTick: Calling sendFrame')
    this.sendFrame(log)
  }

  private sendFrame(log: (msg: string) => void): void {
    const sniff = (msg: string) => this.sniff(log, msg)
    sniff('sendFrame: START')
    const port = this.port
    if (!port?.isOpen) { sniff('sendFrame: !port.isOpen'); this.isSending = false; return }

    sniff('sendFrame: Calling port.update for BREAK_BAUD')
    port.update({ baudRate: BREAK_BAUD }, (err) => {
      if (err) {
        log(`[OpenDMX] ERROR BREAK update: ${err.message}`)
        this.isSending = false
        return
      }
      if (!this.isRunning) { sniff('sendFrame: !isRunning in BREAK callback'); this.isSending = false; return }

      sniff('sendFrame: BREAK_BAUD updated, writing 0x00')
      port.write(Buffer.from([0x00]), (writeErr1) => {
        if (writeErr1) {
          log(`[OpenDMX] ERROR BREAK write: ${writeErr1.message}`)
        }
        spinWaitNs(BREAK_HOLD_NS)

        sniff('sendFrame: Calling port.update for DMX_BAUD')
        port.update({ baudRate: DMX_BAUD }, (err) => {
        if (err) {
          log(`[OpenDMX] ERROR MAB update: ${err.message}`)
          this.isSending = false
          return
        }
        if (!this.isRunning) { sniff('sendFrame: !isRunning in MAB callback'); this.isSending = false; return }

        sniff('sendFrame: DMX_BAUD updated, spinning for MAB')
        spinWaitNs(MAB_NS)

        sniff('sendFrame: Writing DMX payload')
        port.write(this.dmxBuffer, (writeErr) => {
          if (writeErr) log(`[OpenDMX] ERROR payload: ${writeErr.message}`)

          this.isSending = false
          sniff('sendFrame: Payload written, scheduling next tick')
          if (this.isRunning) setTimeout(() => this.runTick(log), 25)
        })
      })
    })
    })
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

  async destroy(log: (msg: string) => void): Promise<void> {
    this.isRunning = false
    this.isSending = false

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
