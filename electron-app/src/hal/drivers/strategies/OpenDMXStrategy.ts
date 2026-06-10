/**
 * WAVE 6012: OPEN DMX STRATEGY — SerialPort nativo en Main Process
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (Main Process Direct I/O):
 *
 *   WAVE 6012 ORACLE DIAG: serialport NO puede vivir en worker_threads dentro
 *   de Electron. El addon nativo bindings.node compite por el V8 Isolate lock
 *   con Chromium (node_bindings.cc:159). La solucion es reubicar SerialPort
 *   en el Main Process, donde node_bindings.cc coordina correctamente los
 *   event loops de Node.js y Chromium.
 *
 *   Flujo de datos:
 *   TickEngine ──(SAB write @44Hz)──→ DmxUniverseReader ──→ SerialPort.write()
 *   Todo en el Main Process. Cero worker_threads. Cero child_process.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */

import { SerialPort } from 'serialport'
import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers'
import { getDmxSab } from '../../../core/aether/glass/GlassMemory'

const DMX_OUTPUT_HZ = 30
const DMX_OUTPUT_MS = Math.round(1000 / DMX_OUTPUT_HZ)

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX (Main Process Direct)'
  readonly selfManaged = true

  private port: SerialPort | null = null
  private reader: DmxUniverseReader | null = null
  private lastFrameId = -1
  private outputTimer: ReturnType<typeof setInterval> | null = null
  private _probeTick = 0
  private _probeLog: ((msg: string) => void) | null = null

  resetBuffer(_log: (msg: string) => void): void {
    // No-op: el outputLoop lee del SAB, no hay buffer residual que purgar
  }

  async connect(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean> {
    try {
      const sab = getDmxSab()
      this.reader = new DmxUniverseReader(sab)

      log(`[Univ ${universe}] Opening DMX port directly in Main Process: ${portPath}`)

      this.port = new SerialPort({
        path: portPath,
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
      })

      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          log(`[Univ ${universe}] DMX port open timeout (8s)`)
          resolve(false)
        }, 8000)

        this.port!.on('open', () => {
          clearTimeout(timeout)
          log(`[Univ ${universe}] DMX port OPEN — starting output loop @ ${DMX_OUTPUT_HZ}Hz`)
          this.startOutputLoop(log, universe)
          resolve(true)
        })

        this.port!.on('error', (err: Error) => {
          clearTimeout(timeout)
          log(`[Univ ${universe}] DMX port error: ${err.message}`)
          resolve(false)
        })
      })

      if (connected) {
        log(`[Univ ${universe}] DMX Main Process Direct fully operational`)
        // WAVE 6018 TELEMETRY: listener persistente de errores post-conexión
        this.port!.on('error', (err: Error) => {
          log(`[Univ ${universe}] DMX port RUNTIME error: ${err.message}`)
        })
      }

      return connected

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`[Univ ${universe}] Failed to open DMX port: ${msg}`)
      return false
    }
  }

  async send(
    _port: SerialPortInstance | null,
    _buffer: Buffer,
    _universe: number,
    _log: (msg: string) => void,
  ): Promise<void> {
    // No-op: outputLoop lee directamente del SAB via DmxUniverseReader.
    // TickEngine escribe en el SAB con DmxUniverseWriter.commitFrame() cada tick.
  }

  async destroy(log: (msg: string) => void): Promise<void> {
    this.stopOutputLoop()

    if (!this.port) return

    log('Closing DMX port...')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log('DMX port close timeout — forcing cleanup')
        resolve()
      }, 2000)

      this.port!.close((err) => {
        clearTimeout(timeout)
        if (err) log(`DMX port close error: ${err.message}`)
        resolve()
      })
    })

    this.port = null
    this.reader = null
    this.lastFrameId = -1
    log('DMX port closed')
  }

  private startOutputLoop(log: (msg: string) => void, universe: number): void {
    if (this.outputTimer) return
    this._probeLog = log

    this.outputTimer = setInterval(() => {
      if (!this.reader || !this.port?.isOpen) return

      const frame = this.reader.readCoherent(this.lastFrameId)
      if (frame) {
        this.lastFrameId = frame.frameId
        const dmxData = frame.data.subarray(0, 512)
        const dmxPacket = Buffer.alloc(513)
        dmxPacket[0] = 0x00 // DMX Start Code
        Buffer.from(new Uint8Array(dmxData)).copy(dmxPacket, 1)

        // ── WAVE 6018 TELEMETRY SAMPLER ──
        this._probeTick++
        const doSample = this._probeTick % 60 === 0  // ~2 segundos @30Hz
        if (doSample) {
          let maxVal = 0
          let maxIdx = -1
          for (let i = 0; i < 512; i++) {
            if (dmxData[i] > maxVal) {
              maxVal = dmxData[i]
              maxIdx = i
            }
          }
          log(
            `[OpenDMX 🩺] frameId=${frame.frameId} maxVal=${maxVal}@ch${maxIdx + 1} ` +
            `ch1-6=[${dmxPacket[1]},${dmxPacket[2]},${dmxPacket[3]},${dmxPacket[4]},${dmxPacket[5]},${dmxPacket[6]}] ` +
            `ch${maxIdx + 1}=${maxIdx >= 0 ? dmxPacket[maxIdx + 1] : 'N/A'}`
          )
        }

        // ── Bit-banging BREAK manual para DMX512 (WAVE 2021.1) ──
        // MODO 'baudrate' (chips genéricos, CH340, IMC UD 7S, QLC+ compatible)
        const portAny = this.port as any;

        const sendDirect = (data: Uint8Array) => {
          const dmx513 = Buffer.alloc(513);
          Buffer.from(data).copy(dmx513, 1);
          this.port?.write(dmx513, (errWrite: Error | null | undefined) => {
            if (errWrite && this._probeLog) {
              this._probeLog(`[OpenDMX 🚨] Serial write error: ${errWrite.message}`);
            }
          });
          if (this.port?.drain) {
            this.port.drain();
          }
        };

        if (typeof portAny.update !== 'function') {
          // Fallback final si update no existe
          sendDirect(dmxData);
          return;
        }

        // PASO 1: Bajar baud para generar BREAK
        portAny.update({ baudRate: 76923 }, (err: Error | null) => {
          if (err || !this.port?.isOpen) return;

          // PASO 2: Emitir 0x00 → genera señal LOW ~130µs = BREAK DMX512
          this.port.write(Buffer.from([0x00]), (err2: Error | null | undefined) => {
            if (err2 || !this.port?.isOpen) return;

            // Drain: esperar que el UART vacíe el byte antes de cambiar baud
            this.port.drain((err3: Error | null) => {
              if (err3 || !this.port?.isOpen) return;

              // PASO 3: Volver a 250000 baud para el frame DMX
              portAny.update({ baudRate: 250000 }, (err4: Error | null) => {
                if (err4 || !this.port?.isOpen) return;

                // PASO 4: MAB (Mark After Break) - esperamos un momento (~1ms) o bloqueamos el thread un poquito, pero como no podemos bloquear, usamos setTimeout
                setTimeout(() => {
                  sendDirect(dmxData);
                }, 1);
              });
            });
          });
        });
      }
    }, DMX_OUTPUT_MS)

    log(`[Univ ${universe}] Output loop started @ ${DMX_OUTPUT_HZ}Hz (${DMX_OUTPUT_MS}ms interval)`)
  }

  private stopOutputLoop(): void {
    if (this.outputTimer) {
      clearInterval(this.outputTimer)
      this.outputTimer = null
    }
  }
}
