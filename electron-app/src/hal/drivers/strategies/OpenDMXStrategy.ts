/**
 * WAVE 6019: OPEN DMX STRATEGY — Worker Launcher
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (worker_thread + SAB):
 *
 *   WAVE 6019: Esta clase ya NO instancia SerialPort ni DmxUniverseReader.
 *   Su único trabajo es lanzar el openDmxWorker (worker_thread) con el SAB
 *   como workerData y gestionar su ciclo de vida.
 *
 *   Flujo de datos:
 *   TickEngine ──(SAB write @44Hz)──→ openDmxWorker ──(SAB read @33Hz)──→ SerialPort
 *   El worker corre en un thread dedicado. El BREAK/MAB vive en el worker.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */

import * as path from 'path'
import { Worker } from 'worker_threads'
import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'
import { getDmxSab } from '../../../core/aether/glass/GlassMemory'

const DMX_OUTPUT_HZ = 33

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX SAB Worker (WAVE 6019)'
  readonly selfManaged = true

  private worker: Worker | null = null

  resetBuffer(log: (msg: string) => void): void {
    // Señalizar al worker que resetee su frame ID (re-lectura del SAB)
    if (this.worker) {
      this.worker.postMessage({ type: 'RESET_BUFFER' })
    } else {
      log('[OpenDMX] resetBuffer: worker no activo')
    }
  }

  async connect(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean> {
    if (this.worker) {
      log('[OpenDMX] Worker ya existe — destruyendo instancia anterior')
      await this.destroy(log)
    }

    const sab = getDmxSab()

    // Resolución de ruta del worker compilado.
    // DEV (tsx/ts-node): __dirname = .../drivers/strategies/ → ../../workers/openDmxWorker.ts
    // PROD (Vite bundle): __dirname = dist-electron/ → ./openDmxWorker.js (flat output)
    const isDev = __filename.endsWith('.ts')
    const workerPath = isDev
      ? path.join(__dirname, '../../workers/openDmxWorker.ts')
      : path.join(__dirname, 'openDmxWorker.js')

    log(`[OpenDMX] Spawning worker_thread: ${workerPath}`)
    log(`[OpenDMX] SAB: ${sab.byteLength}b | puerto: ${portPath} | universo: ${universe} | ${DMX_OUTPUT_HZ}Hz`)

    return new Promise<boolean>((resolve) => {
      const bootTimeout = setTimeout(() => {
        log(`[OpenDMX] Worker TIMEOUT (10s) — serialport no abrió ${portPath}`)
        resolve(false)
      }, 10_000)

      try {
        this.worker = new Worker(workerPath, {
          workerData: {
            sab,
            portPath,
            universe,
            hz: DMX_OUTPUT_HZ,
          },
        })
      } catch (spawnErr: unknown) {
        clearTimeout(bootTimeout)
        const msg = spawnErr instanceof Error ? spawnErr.message : String(spawnErr)
        log(`[OpenDMX] ERROR al crear Worker: ${msg}`)
        this.worker = null
        resolve(false)
        return
      }

      this.worker.on('message', (msg: { type: string; message?: string }) => {
        switch (msg.type) {
          case 'READY':
            clearTimeout(bootTimeout)
            log(`[OpenDMX] Worker READY — loop activo @${DMX_OUTPUT_HZ}Hz`)
            resolve(true)
            break

          case 'ERROR':
            clearTimeout(bootTimeout)
            log(`[OpenDMX] Worker ERROR: ${msg.message ?? '(sin mensaje)'}`)
            resolve(false)
            break

          case 'DISCONNECTED':
            log('[OpenDMX] Worker DISCONNECTED')
            break

          case 'LOG':
            log(msg.message ?? '')
            break

          case 'WARN':
            log(`[WARN] ${msg.message ?? ''}`)
            break

          case 'CONNECTED':
            log(`[OpenDMX] Puerto abierto — esperando READY...`)
            break

          default:
            break
        }
      })

      this.worker.on('error', (err: Error) => {
        clearTimeout(bootTimeout)
        log(`[OpenDMX] Worker thread ERROR: ${err.message}`)
        this.worker = null
        resolve(false)
      })

      this.worker.on('exit', (code: number) => {
        if (code !== 0) {
          log(`[OpenDMX] Worker salió con código ${code}`)
        }
        this.worker = null
      })
    })
  }

  async send(
    _port: SerialPortInstance | null,
    _buffer: Buffer,
    _universe: number,
    _log: (msg: string) => void,
  ): Promise<void> {
    // No-op: el worker lee directamente del SAB.
    // TickEngine ya escribió en el SAB via DmxUniverseWriter.commitFrame().
  }

  async destroy(log: (msg: string) => void): Promise<void> {
    if (!this.worker) return

    log('[OpenDMX] Enviando DISCONNECT al worker...')
    this.worker.postMessage({ type: 'DISCONNECT' })

    await new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        log('[OpenDMX] Worker no respondió en 3s — terminando forzosamente')
        this.worker?.terminate()
        resolve()
      }, 3000)

      this.worker!.once('exit', () => {
        clearTimeout(forceKill)
        resolve()
      })
    })

    this.worker = null
    log('[OpenDMX] Worker terminado')
  }
}
