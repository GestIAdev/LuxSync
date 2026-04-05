/**
 * WAVE 2021.5: OPEN DMX STRATEGY — Phantom Process Proxy (child_process.fork)
 *
 * Para interfaces SIN microcontrolador (cables tontos):
 * - Enttec Open DMX USB
 * - Clones chinos FTDI directos
 * - IMC UD 7S / Tornado (chip FTDI puro)
 * - Cualquier cable USB-Serial con chip FTDI/CH340/PL2303
 *
 * ARQUITECTURA (child_process EN VEZ DE worker_threads):
 *
 *   Electron 28 + worker_threads + native addons (serialport) = CRASH.
 *   El addon nativo bindings.node se carga en ambos V8 isolates (main + worker)
 *   dentro del MISMO PROCESO. Comparten estado C++ global. Cuando V8 GC del
 *   main recorre weak references del addon mientras el worker ejecuta callbacks
 *   nativos -> Fatal error: HandleScope::HandleScope (node_bindings.cc:159).
 *
 *   child_process.fork() crea un PROCESO Node.js separado con su propio:
 *   - V8 heap
 *   - V8 GC
 *   - libuv event loop
 *   - addon nativo address space
 *   CERO contencion entre isolates. CERO HandleScope crashes.
 *
 *   El IPC usa un pipe del OS (~15KB/s para DMX a 30Hz). Trivial.
 *
 * El UniversalDMXDriver no crea SerialPort para esta estrategia (selfManaged=true).
 */

import { fork, type ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX (Phantom Worker)'
  readonly selfManaged = true

  private child: ChildProcess | null = null
  private workerReady = false

  // Dirty tracking: solo enviar IPC cuando el buffer realmente cambió.
  // Evita saturar el pipe con mensajes identicos a 30Hz cuando la escena es estática.
  private lastSentHash: number = 0

  /**
   * Lanza el child process y le ordena conectar al puerto serial.
   * WAVE 2021.5: fork() en vez de new Worker() — V8 isolate separado por proceso.
   */
  async connect(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean> {
    try {
      const workerPath = this.resolveWorkerPath()

      log(`[Univ ${universe}] Spawning DMX Phantom Process -> ${workerPath}`)

      // fork() crea un proceso Node.js hijo con IPC channel automatico.
      // El child tiene process.send() y process.on('message') disponibles.
      // El addon nativo serialport se carga SOLO en el child — cero conflicto.
      this.child = fork(workerPath, [], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      })

      // Relay de logs del child al log del driver
      this.child.on('message', (msg: { type: string; message?: string; success?: boolean; error?: string }) => {
        switch (msg.type) {
          case 'LOG':
            if (msg.message) log(msg.message)
            break
          case 'CONNECTED':
            if (!msg.success) {
              this.workerReady = false
              log(`[Univ ${universe}] DMX Process connect failed: ${msg.error}`)
            } else {
              log(`[Univ ${universe}] DMX Process port open -- waiting for READY signal...`)
            }
            break
          case 'READY':
            this.workerReady = true
            log(`[Univ ${universe}] DMX Process READY -- output loop active`)
            break
          case 'DISCONNECTED':
            this.workerReady = false
            log(`[Univ ${universe}] DMX Process disconnected`)
            break
          case 'ERROR':
            log(`[Univ ${universe}] DMX Process error: ${msg.error}`)
            break
        }
      })

      this.child.on('error', (err: Error) => {
        log(`[Univ ${universe}] DMX child process error: ${err.message}`)
        this.workerReady = false
      })

      this.child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          log(`[Univ ${universe}] DMX child process exited with code ${code}`)
        }
        this.child = null
        this.workerReady = false
      })

      // Ordenar al child que conecte y esperar READY
      const connected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          log(`[Univ ${universe}] DMX Process READY timeout (8s)`)
          resolve(false)
        }, 8000)

        const handler = (msg: { type: string; success?: boolean }) => {
          if (msg.type === 'CONNECTED' && msg.success === false) {
            clearTimeout(timeout)
            this.child?.removeListener('message', handler)
            resolve(false)
          } else if (msg.type === 'READY') {
            clearTimeout(timeout)
            this.child?.removeListener('message', handler)
            resolve(true)
          }
        }
        this.child!.on('message', handler)

        // 🔥 WAVE 2100: Adaptive Pacing — 30Hz conservador para cables tontos (FTDI/CH340).
        // Tornado spec: 33fps max. 30Hz da margen de seguridad.
        // breakMode 'baudrate': compatible con TODO chip USB-serial (Freestyler/QLC+ method).
        this.child!.send({ type: 'CONNECT', portPath, refreshRate: 30, breakMode: 'baudrate' })
      })

      this.workerReady = connected

      if (connected) {
        log(`[Univ ${universe}] DMX Phantom Process fully operational`)
      }

      return connected

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`[Univ ${universe}] Failed to spawn DMX Process: ${msg}`)
      return false
    }
  }

  /**
   * Envia buffer al child process para actualizar su estado interno.
   * El child ya tiene su propio output loop -- solo necesita el buffer fresco.
   * NO usa el port del driver (selfManaged=true, port es null).
   *
   * DIRTY CHECK: Solo envia IPC cuando el buffer realmente cambio.
   * El child process sigue enviando el ultimo buffer conocido en su loop.
   * Si la escena es estatica, cero IPC overhead.
   */
  async send(
    _port: SerialPortInstance | null,
    buffer: Buffer,
    _universe: number,
    _log: (msg: string) => void,
  ): Promise<void> {
    if (!this.child || !this.workerReady) return

    // Hash rápido para detectar cambios: djb2 sobre los primeros 513 bytes.
    // No necesita ser criptográfico — solo detectar si algo cambió.
    const len = Math.min(buffer.length, 513)
    let hash = 5381
    for (let i = 0; i < len; i++) {
      hash = ((hash << 5) + hash + buffer[i]) | 0
    }

    if (hash === this.lastSentHash) return  // Buffer idéntico — skip IPC
    this.lastSentHash = hash

    // Enviar los canales como array plano de numeros.
    const channels = new Array(len)
    for (let i = 0; i < len; i++) {
      channels[i] = buffer[i]
    }

    this.child.send({ type: 'UPDATE_BUFFER', channels })
  }

  /**
   * Termina el child process y libera recursos.
   */
  async destroy(log: (msg: string) => void): Promise<void> {
    if (!this.child) return

    log('Terminating DMX Phantom Process...')

    // Pedir desconexion limpia primero
    this.child.send({ type: 'DISCONNECT' })

    // Dar 2s para cerrar limpiamente, luego SIGKILL forzado
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        try {
          // 🔥 WAVE 2100: ZOMBI KILL — SIGKILL force kill
          // En Windows, kill() sin señal envía SIGTERM que el spinWait ignora.
          // Con 'SIGKILL' el OS mata el proceso incondicionalmente.
          this.child?.kill('SIGKILL')
        } catch {
          // Child ya muerto
        }
        resolve()
      }, 2000)

      const handler = (msg: { type: string }) => {
        if (msg.type === 'DISCONNECTED') {
          clearTimeout(timeout)
          this.child?.removeListener('message', handler)
          try {
            this.child?.kill('SIGKILL')
          } catch {
            // ya muerto
          }
          resolve()
        }
      }
      this.child?.on('message', handler)
    })

    this.child = null
    this.workerReady = false
    this.lastSentHash = 0
    log('DMX Phantom Process terminated')
  }

  /**
   * Resuelve la ruta al script JS compilado del worker.
   *
   * Vite compila openDmxWorker.ts -> dist-electron/openDmxWorker.js
   * (igual que senses.js y mind.js -- mismo outDir).
   *
   * En ASAR, los archivos .asar son opaque y child_process.fork() NO puede
   * cargar JS desde dentro del paquete. Electron exige archivos en
   * app.asar.unpacked/ o en resourcesPath.
   *
   * Orden de busqueda:
   *   1. Dev: dist-electron/openDmxWorker.js (desde raiz del proyecto)
   *   2. Prod-unpacked: <exe dir>/resources/app.asar.unpacked/dist-electron/openDmxWorker.js
   *   3. Prod-resources: <exe dir>/resources/dist-electron/openDmxWorker.js
   *   4. __dirname fallback (si el worker esta junto a la estrategia compilada)
   */
  private resolveWorkerPath(): string {
    const candidates: string[] = []

    // -- Dev --
    const fromDirname = path.join(__dirname, 'openDmxWorker.js')
    candidates.push(fromDirname)

    // Subir hasta encontrar dist-electron en el path (Vite compila aqui)
    const distElectronFromRoot = path.resolve(__dirname, '../../../../dist-electron/openDmxWorker.js')
    candidates.push(distElectronFromRoot)

    // -- Produccion ASAR.unpacked --
    const exeDir = path.dirname(process.execPath)
    candidates.push(
      path.join(exeDir, 'resources', 'app.asar.unpacked', 'dist-electron', 'openDmxWorker.js'),
    )

    // -- Produccion: resourcesPath --
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    if (resourcesPath) {
      candidates.push(path.join(resourcesPath, 'dist-electron', 'openDmxWorker.js'))
      candidates.push(path.join(resourcesPath, 'app.asar.unpacked', 'dist-electron', 'openDmxWorker.js'))
    }

    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate
      } catch {
        continue
      }
    }

    throw new Error(
      `Cannot find openDmxWorker.js. Searched:\n${candidates.join('\n')}\n` +
      `Make sure Vite compiled the worker AND it is not packed inside ASAR.\n` +
      `In electron-builder config add: "asarUnpack": ["dist-electron/openDmxWorker.js"]`
    )
  }
}
