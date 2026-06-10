# BLUEPRINT: HAL Rehabilitation Layer v2
**WAVE:** 6019  
**Referencia de auditoría:** `docs/forensics/WAVE-6018.2-EGRESS-PIPELINE-DEEP-MAP.md`  
**Fecha:** 2025-06-10  
**Rol:** Arquitecto de Sistemas Principal — Node.js / DMX Real-Time  

---

## 0. El Cambio de Paradigma

El HAL v1 era un **sistema de empuje**: el `TickEngine` empujaba datos hacia el HAL, el HAL los empujaba hacia los drivers, los drivers los empujaban hacia el hardware. Cada eslabón añadía latencia y jitter.

El HAL v2 es un **sistema de lectura reactiva**: el `TickEngine` escribe en el SAB y **termina su trabajo**. Cada driver es soberano de su propio reloj de hardware y lee el SAB a su propio ritmo. El HAL no transporta datos; **gestiona conexiones y reparte referencias de memoria**.

```
HAL v1 (Push):
  TickEngine @44Hz → HAL.sendUniverseRaw() → driver.sendAll() → IPC → worker → SerialPort
  Jitter acumulado: ~15ms

HAL v2 (Pull):
  TickEngine @44Hz → SAB.commitFrame()
                         ↑                    ↑
              openDmxWorker          ArtNetDriver
              (worker_thread)        (setInterval @40Hz)
              Lee SAB, genera        Lee SAB, envía UDP
              BREAK/MAB, escribe     multi-universo
              SerialPort @33Hz
  Jitter del DMX físico: 0 (spinWaitNs en thread dedicado)
```

---

## 1. MODULE A: openDmxWorker v2 — SAB Reader + Precision BREAK

### 1.1 Problema

La implementación actual (`OpenDMXStrategy.ts`) corre `SerialPort.write()` en el Main Process con un `setInterval` a 30Hz. El Event Loop de Node.js en Windows tiene una resolución de ~15ms. El MAB actual es `setTimeout(1ms)` que en práctica dura entre 1ms y 16ms. Esto destruye el timing DMX BREAK/MAB, causando parpadeos físicos.

El `openDmxWorker.ts` original (child_process) tenía `spinWaitNs` y `os.PRIORITY_HIGHEST` para resolver exactamente esto, pero era alimentado por IPC `number[]`, no por SAB.

### 1.2 Decisión Arquitectónica: worker_thread + SAB

**Target:** Mover `OpenDMXStrategy.ts` de `setInterval` en Main Process a un `worker_thread` dedicado.

**Mecanismo de datos:** `workerData.sab` → `DmxUniverseReader` → lectura coherente (seqlock).

**Mecanismo de sincronización:** `Atomics.waitAsync()` para despertar el thread cuando el `TickEngine` haga `commitFrame()`. Cero polling activo entre frames.

**Mecanismo de timing:** `spinWaitNs()` recuperado del `openDmxWorker.ts` original para MAB. Baudrate-switch completo para BREAK.

### 1.3 Constraint de SerialPort en Electron worker_threads

**Diagnóstico existente (WAVE 6012):** El addon `bindings.node` de `serialport` compite por el V8 Isolate lock con `Chromium (node_bindings.cc:159)`. Crash: `Fatal error: HandleScope::HandleScope`.

**Resolución arquitectónica prescrita:**

> Ejecutar `electron-rebuild` con `serialport` v12+ (N-API), que usa `napi_create_external_arraybuffer` en lugar de V8 isolate-specific handles. Los módulos N-API son context-agnostic y no están atados a un isolate específico. Esto resuelve la contención de HandleScope entre el thread del worker y el thread del renderer Chromium.

```bash
# Rebuild command para serialport con ABI de Electron
./node_modules/.bin/electron-rebuild -f -w serialport
# Verificar ABI target: debe coincidir con process.versions.modules del Electron instalado
```

**Fallback si N-API rebuild falla:** Ver §1.7 — SAB-to-IPC Proxy Pattern.

### 1.4 Protocolo de Comunicación (v1 → v2)

| Aspecto | v1 (child_process) | v2 (worker_thread) |
|---|---|---|
| Spawn | `child_process.fork('./openDmxWorker')` | `new Worker('./openDmxWorker')` |
| SAB | ❌ — No SAB | `workerData: { sab, portPath, universe, hz }` |
| Datos DMX | IPC `{ type: 'UPDATE_BUFFER', channels: number[] }` | `DmxUniverseReader.readCoherent()` desde SAB |
| Wakeup | `setInterval` polling | `Atomics.waitAsync()` sobre `DmxHdr.SEQLOCK` |
| BREAK | `spinWaitNs(110_000n)` vía baudrate-switch | Ídem, preservado exactamente |
| MAB | `spinWaitNs(20_000n)` | Ídem, preservado exactamente |
| Prioridad OS | `os.setPriority(PRIORITY_HIGHEST)` | Ídem, preservado |
| Logs | `process.send({ type: 'LOG' })` | `parentPort.postMessage({ type: 'LOG' })` |

### 1.5 Pseudocode: `openDmxWorker.ts` (v2 — worker_thread)

```typescript
// openDmxWorker.ts  (worker_thread version — WAVE 6019)
// Reemplaza: openDmxWorker.ts (child_process) + la lógica de OpenDMXStrategy.ts
import { workerData, parentPort, isMainThread } from 'worker_threads'
import { DmxUniverseReader } from '../../../core/aether/glass/DmxSabHandlers'
import { CHANNELS_PER_UNI, DmxHdr, DMX_HEADER_I32 } from '../../../core/aether/glass/layout'
import * as os from 'os'

if (isMainThread) throw new Error('[openDmxWorker v2] Debe correr como worker_thread')

// ─── Config inyectada por workerData ────────────────────────────────────────
const {
  sab,          // SharedArrayBuffer — DMX_UNIVERSE_SAB completo
  portPath,     // string — ej. 'COM3'
  universe,     // number — universo DMX a leer del SAB (0-49)
  hz,           // number — cadencia de salida (recomendado: 33)
} = workerData as {
  sab: SharedArrayBuffer
  portPath: string
  universe: number
  hz: number
}

// ─── SAB Reader + header view para Atomics ──────────────────────────────────
const reader = new DmxUniverseReader(sab)
const sabHdr  = new Int32Array(sab, 0, DMX_HEADER_I32)  // acceso directo para Atomics.waitAsync
const UNI_OFFSET = universe * CHANNELS_PER_UNI          // offset en bytes dentro de data[]

// ─── Timing ─────────────────────────────────────────────────────────────────
const BREAK_NS   = BigInt(110_000)  // 110µs → ~130µs en 76923 baud = BREAK válido
const MAB_NS     = BigInt(20_000)   // 20µs Mark After Break
const FRAME_MIN_NS = BigInt(Math.round(1e9 / hz))

function spinWaitNs(ns: bigint): void {
  const deadline = process.hrtime.bigint() + ns
  while (process.hrtime.bigint() < deadline) { /* spin */ }
}

// ─── Double buffer: evitar corrupción si sendFrame() se solapa con la lectura ─
const dmxSendBuffer = Buffer.alloc(513, 0)
dmxSendBuffer[0] = 0x00  // DMX start code

// ─── SerialPort (cargado dinámicamente para compat. Electron rebuild) ────────
let port: import('serialport').SerialPort | null = null
let isOpen = false
let lastFrameId = -1
let lastFrameStart = BigInt(0)

// ─── Boot ────────────────────────────────────────────────────────────────────
async function boot(): Promise<void> {
  os.setPriority(os.constants.priority.PRIORITY_HIGHEST)

  const { SerialPort } = await import('serialport')

  port = new SerialPort({
    path: portPath,
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
    autoOpen: false,
  })

  await new Promise<void>((resolve, reject) => {
    port!.open((err) => err ? reject(err) : resolve())
  })

  isOpen = true
  port.on('error', (err) => {
    parentPort?.postMessage({ type: 'ERROR', message: err.message })
    isOpen = false
  })
  port.on('close', () => {
    isOpen = false
    parentPort?.postMessage({ type: 'DISCONNECTED' })
  })

  parentPort?.postMessage({ type: 'READY' })
  outputLoop()
}

// ─── Output Loop (event-driven via Atomics.waitAsync) ────────────────────────
async function outputLoop(): Promise<void> {
  while (isOpen) {
    // 1. Leer SAB coherentemente — retorna null si no hay frame nuevo
    const frame = reader.readCoherent(lastFrameId)

    if (frame) {
      lastFrameId = frame.frameId

      // 2. Snapshot del universo objetivo en double buffer (zero-tearing)
      //    frame.data es el blob completo de 25,600 bytes (50 universos × 512)
      //    El universo N vive en [N*512 ... (N+1)*512)
      const uniSlice = frame.data.subarray(UNI_OFFSET, UNI_OFFSET + CHANNELS_PER_UNI)
      dmxSendBuffer[0] = 0x00
      Buffer.from(uniSlice).copy(dmxSendBuffer, 1, 0, 512)

      // 3. Pacing: no exceder la cadencia objetivo
      const now = process.hrtime.bigint()
      const sinceLastFrame = now - lastFrameStart
      if (sinceLastFrame < FRAME_MIN_NS) {
        spinWaitNs(FRAME_MIN_NS - sinceLastFrame)
      }
      lastFrameStart = process.hrtime.bigint()

      // 4. Enviar frame con BREAK + MAB precisos
      await sendFrameBaudrateBreak()

    } else {
      // 5. Sin frame nuevo — dormir hasta que TickEngine notifique via Atomics
      //    commitFrame() llama Atomics.notify(sabHdr, DmxHdr.SEQLOCK) al final
      const currentSeq = Atomics.load(sabHdr, DmxHdr.SEQLOCK)
      const result = Atomics.waitAsync(sabHdr, DmxHdr.SEQLOCK, currentSeq, 30 /* ms timeout */)
      if (result.async) {
        await result.value  // suspende el async context; reanuda al notify
      }
      // Loop — volver a intentar readCoherent
    }
  }
}

// ─── Baudrate-Switch BREAK (preservado del openDmxWorker.ts original) ────────
function sendFrameBaudrateBreak(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!port || !isOpen) return resolve()
    const portAny = port as any

    // PASO 1: Bajar baud a 76923 → un 0x00 dura ~130µs en la línea = BREAK DMX válido
    portAny.update({ baudRate: 76923 }, (err1: Error | null) => {
      if (err1 || !isOpen) return resolve()

      // PASO 2: Emitir 0x00 para generar la señal LOW = BREAK
      port!.write(Buffer.from([0x00]), (err2) => {
        if (err2 || !isOpen) return resolve()

        // PASO 3: Esperar que el UART vacíe el byte antes de cambiar baud
        port!.drain((err3) => {
          if (err3 || !isOpen) return resolve()

          // PASO 4: Volver a 250 kbaud (velocidad estándar DMX)
          portAny.update({ baudRate: 250000 }, (err4: Error | null) => {
            if (err4 || !isOpen) return resolve()

            // PASO 5: MAB (Mark After Break) — spin-wait preciso, NO setTimeout
            spinWaitNs(MAB_NS)

            // PASO 6: Emitir el frame DMX completo (513 bytes)
            port!.write(dmxSendBuffer, (errW) => {
              if (errW) parentPort?.postMessage({ type: 'WARN', message: errW.message })
              port!.drain(() => resolve())
            })
          })
        })
      })
    })
  })
}

// ─── Mensajes del Main Thread (control lifecycle) ────────────────────────────
parentPort?.on('message', (msg: { type: string }) => {
  if (msg.type === 'DISCONNECT') {
    isOpen = false
    port?.close()
  }
})

boot().catch((err: Error) => {
  parentPort?.postMessage({ type: 'ERROR', message: err.message })
  process.exit(1)
})
```

**Notas críticas del pseudocode:**
- `Atomics.waitAsync()` es **non-blocking** — no congela el event loop del worker. El thread puede seguir procesando mensajes `parentPort`.
- `DmxHdr.SEQLOCK` es el punto de notificación: `commitFrame()` ya llama `Atomics.notify(i32, DmxHdr.SEQLOCK)` en la línea 55 de `DmxSabHandlers.ts`. No requiere cambios en el writer.
- El acceso al universo correcto del blob SAB: `frame.data.subarray(universe * 512, (universe + 1) * 512)`. El blob tiene `MAX_UNIVERSES × CHANNELS_PER_UNI = 50 × 512 = 25,600` bytes con los universos en posición fija.

### 1.6 Pseudocode: `OpenDMXStrategy.ts` (launcher modificado)

```typescript
// OpenDMXStrategy.ts — WAVE 6019
// Reemplaza el setInterval + SerialPort del Main Process
// por un worker_thread que recibe el SAB directamente.

import { Worker } from 'worker_threads'
import * as path from 'path'
import { getDmxSab } from '../../../core/aether/glass/GlassMemory'
import type { DMXSendStrategy } from './DMXSendStrategy'
import type { SerialPortInstance } from '../UniversalDMXDriver'

const DMX_OUTPUT_HZ = 33  // Cadencia del worker

export class OpenDMXStrategy implements DMXSendStrategy {
  readonly name = 'Open DMX SAB Worker (v2)'
  readonly selfManaged = true

  private worker: Worker | null = null

  resetBuffer(_log: (msg: string) => void): void {
    // No-op: el worker lee del SAB — cero buffer residual propio
  }

  async connect(portPath: string, universe: number, log: (msg: string) => void): Promise<boolean> {
    const sab = getDmxSab()
    const workerPath = path.join(__dirname, 'openDmxWorker.js')  // compilado

    this.worker = new Worker(workerPath, {
      workerData: { sab, portPath, universe, hz: DMX_OUTPUT_HZ },
    })

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        log(`[OpenDMX v2] Worker timeout (8s) — serialport no abrió`)
        resolve(false)
      }, 8000)

      this.worker!.on('message', (msg: { type: string; message?: string }) => {
        if (msg.type === 'READY') {
          clearTimeout(timeout)
          log(`[OpenDMX v2] Worker READY @${DMX_OUTPUT_HZ}Hz — leyendo SAB universo ${universe}`)
          resolve(true)
        }
        if (msg.type === 'ERROR' || msg.type === 'DISCONNECTED') {
          clearTimeout(timeout)
          log(`[OpenDMX v2] Worker ${msg.type}: ${msg.message ?? ''}`)
          resolve(false)
        }
        if (msg.type === 'LOG' || msg.type === 'WARN') {
          log(msg.message ?? '')
        }
      })

      this.worker!.on('error', (err) => {
        clearTimeout(timeout)
        log(`[OpenDMX v2] Worker error: ${err.message}`)
        resolve(false)
      })
    })
  }

  async send(
    _port: SerialPortInstance | null,
    _buffer: Buffer,
    _universe: number,
    _log: (msg: string) => void,
  ): Promise<void> {
    // No-op: el worker lee del SAB directamente.
  }

  async destroy(log: (msg: string) => void): Promise<void> {
    if (!this.worker) return
    log('[OpenDMX v2] Shutting down worker...')
    this.worker.postMessage({ type: 'DISCONNECT' })
    await new Promise<void>((resolve) => {
      this.worker!.once('exit', () => resolve())
      setTimeout(resolve, 2000)  // force-resolve si el worker no responde
    })
    this.worker = null
    log('[OpenDMX v2] Worker terminated')
  }
}
```

**Cambios en `OpenDMXStrategy.ts` respecto a la versión actual:**
- **Eliminar:** `import { SerialPort } from 'serialport'` — el port ya no vive aquí
- **Eliminar:** `import { DmxUniverseReader }` — el reader ya no vive aquí
- **Eliminar:** `startOutputLoop()`, `stopOutputLoop()`, todo el bloque `setInterval`
- **Eliminar:** el bloque `portAny.update()` (baudrate-switch) — vive en el worker
- **Reemplazar:** por `new Worker(workerPath, { workerData: { sab, ... } })`

### 1.7 Fallback: SAB-to-IPC Proxy (si electron-rebuild falla)

Si el rebuild de serialport no resuelve el N-API conflict, el child_process original puede seguir corriendo con una latencia reducida mediante un proxy:

```typescript
// SABProxy.ts — Corre en Main Process, alimenta al child_process
// Solo se usa si worker_thread + serialport crash persiste

class SabIpcProxy {
  private lastFrameId = -1
  private reader: DmxUniverseReader
  private child: ChildProcess

  constructor(sab: SharedArrayBuffer, child: ChildProcess, universe: number) {
    this.reader = new DmxUniverseReader(sab)
    this.child = child
    this.run(universe)
  }

  private run(universe: number): void {
    const frame = this.reader.readCoherent(this.lastFrameId)
    if (frame) {
      this.lastFrameId = frame.frameId
      const offset = universe * 512
      // Enviar solo el universo objetivo como Buffer binario (NO number[])
      const channels = Array.from(frame.data.subarray(offset, offset + 512))
      this.child.send({ type: 'UPDATE_BUFFER', channels })
    }
    setImmediate(() => this.run(universe))
  }
}
```

**Tradeoff del proxy:** Reintroduce ~1ms de latencia IPC pero mantiene el BREAK/MAB preciso en el child_process con `spinWaitNs`. El jitter del Event Loop de Windows afecta la entrega de `UPDATE_BUFFER`, no el timing eléctrico del BREAK.

---

## 2. MODULE B: ArtNetDriver SAB Follower

### 2.1 Problema

`ArtNetDriver` mantiene sus propios buffers internos (`Map<number, Buffer>`). Los datos llegan vía `setBuffer()` / `setChannel()` llamados desde el HAL legacy. En la arquitectura Aether Glass, nadie llama estos métodos: el `TickEngine` solo escribe en el SAB. Resultado: `sendAll()` nunca se llama con datos frescos del `NodeResolver`.

### 2.2 Decisión Arquitectónica: `attachSab()` + loop interno

`ArtNetDriver` gana un método `attachSab()` que instala un `setInterval` a 40Hz. En cada tick el driver:
1. Lee el SAB con `readCoherent()`
2. Extrae los universos activos usando el `dirtyMask` del header
3. Actualiza sus buffers internos con los datos del SAB
4. Llama `sendAll()` internamente

**No se crea ningún archivo nuevo.** Todo son adiciones a `ArtNetDriver.ts`.

### 2.3 Fórmula de Extracción por Universo desde el SAB

```
// El SAB blob plano tiene los universos en posición fija:
// universo 0: data[0    ... 511]
// universo 1: data[512  ... 1023]
// universo N: data[N*512 ... N*512+511]

// Para extraer el universo N:
const uniData = frame.data.subarray(
  universeNumber * CHANNELS_PER_UNI,            // = N * 512
  (universeNumber + 1) * CHANNELS_PER_UNI       // = (N+1) * 512
)
```

**Detección de universos activos via dirtyMask:**

```typescript
// El header del SAB expone qué universos cambiaron en este frame
// UNIVERSE_MASK = bits 0-31, UNIVERSE_MASK_HI = bits 32-63
const sabHdr = new Int32Array(sab, 0, DMX_HEADER_I32)
const maskLo = BigInt(sabHdr[DmxHdr.UNIVERSE_MASK])
const maskHi = BigInt(sabHdr[DmxHdr.UNIVERSE_MASK_HI])
const dirtyMask64 = (maskHi << BigInt(32)) | maskLo

// Universo N está activo si: (dirtyMask64 >> BigInt(N)) & 1n === 1n
```

### 2.4 Pseudocode: Adiciones a `ArtNetDriver.ts`

```typescript
// ArtNetDriver.ts — WAVE 6019: SAB Follower additions
import { DmxUniverseReader } from '../../core/aether/glass/DmxSabHandlers'
import { DmxHdr, DMX_HEADER_I32, CHANNELS_PER_UNI } from '../../core/aether/glass/layout'

// ─── Nuevas propiedades privadas (añadir al cuerpo de la clase) ──────────────
private _sabReader: DmxUniverseReader | null = null
private _sabFollowTimer: ReturnType<typeof setInterval> | null = null
private _sabLastFrameId = -1
private _sabHdr: Int32Array | null = null   // vista del header para dirtyMask

// ─── Nuevo método público ─────────────────────────────────────────────────────
/**
 * WAVE 6019: Conectar al DMX_UNIVERSE_SAB como fuente de datos.
 * El driver leera el SAB a followHz Hz, extrayendo todos los universos
 * activos (segun dirtyMask) y enviando paquetes UDP para cada uno.
 *
 * @param sab       SharedArrayBuffer del TickEngine (getDmxSab())
 * @param universes Lista explícita de universos a seguir (ej. [0, 1, 2])
 * @param followHz  Cadencia de lectura (default: 40)
 */
attachSab(sab: SharedArrayBuffer, universes: number[], followHz: number = 40): void {
  if (this._sabFollowTimer) this.detachSab()

  this._sabReader = new DmxUniverseReader(sab)
  this._sabHdr    = new Int32Array(sab, 0, DMX_HEADER_I32)

  const intervalMs = Math.round(1000 / followHz)

  this._sabFollowTimer = setInterval(() => {
    if (!this._sabReader || !this.socket || this.state !== 'ready') return

    const frame = this._sabReader.readCoherent(this._sabLastFrameId)
    if (!frame) return  // Sin frame nuevo desde el último tick

    this._sabLastFrameId = frame.frameId

    // Extraer dirtyMask del header SAB para saltar universos sin cambios
    const maskLo   = BigInt(this._sabHdr![DmxHdr.UNIVERSE_MASK])
    const maskHi   = BigInt(this._sabHdr![DmxHdr.UNIVERSE_MASK_HI])
    const dirty64  = (maskHi << BigInt(32)) | maskLo

    for (const universeNum of universes) {
      // Optimización: solo enviar si este universo cambió en este frame
      if (((dirty64 >> BigInt(universeNum)) & BigInt(1)) === BigInt(0)) continue

      const offset  = universeNum * CHANNELS_PER_UNI
      const uniData = frame.data.subarray(offset, offset + CHANNELS_PER_UNI)

      // Actualizar buffer interno del driver y enviar
      this.setBuffer(Buffer.from(uniData), universeNum)
    }

    // sendAll() aplica su propio rate limiting interno (minSendInterval)
    void this.sendAll()

  }, intervalMs)

  this.log(`[ArtNet 🛰️] SAB follower attached: universes=[${universes}] @${followHz}Hz`)
}

// ─── Nuevo método público ─────────────────────────────────────────────────────
detachSab(): void {
  if (this._sabFollowTimer) {
    clearInterval(this._sabFollowTimer)
    this._sabFollowTimer = null
  }
  this._sabReader    = null
  this._sabHdr       = null
  this._sabLastFrameId = -1
  this.log('[ArtNet 🛰️] SAB follower detached')
}
```

### 2.5 Wiring en `ArtNetDriverAdapter.ts`

```typescript
// ArtNetDriverAdapter.ts — WAVE 6019: pasar SAB en connect()
// connect() ya existe; agregar llamada a attachSab() al final

import { getDmxSab } from '../../core/aether/glass/GlassMemory'

// En connect() de ArtNetDriverAdapter, después de this.driver.start():
const sab = getDmxSab()
this.driver.attachSab(sab, config.universes ?? [0], config.followHz ?? 40)

// En disconnect() de ArtNetDriverAdapter:
this.driver.detachSab()
```

**Cambios en `ArtNetDriver.ts` respecto a la versión actual:**
- **Agregar:** `attachSab()`, `detachSab()`, `_sabReader`, `_sabFollowTimer`, `_sabLastFrameId`, `_sabHdr`
- **Sin eliminar:** `setBuffer()`, `sendAll()`, `universeBuffers` — siguen siendo el mecanismo interno
- **Sin eliminar:** `setChannel()`, `setChannels()` — pueden usarse en modo manual (sin SAB)
- La llamada `stop()` debe llamar `detachSab()` antes de cerrar el socket

---

## 3. MODULE C: HAL Poda (Connection Manager)

### 3.1 Métodos a Eliminar de `HardwareAbstraction.ts`

| Método | Líneas actuales | Razón de eliminación |
|---|---|---|
| `sendUniverseRaw(universe, data)` | 1772–1792 | El TickEngine ya no llama este método para Aether. Código muerto. |
| `flushAetherEgress()` | 1801–1804 | El ArtNetDriver y el openDmxWorker tienen su propio loop. Nadie debe triggerear el flush externo. |
| `setAetherOutputGateState(enabled, blackout)` | 1810–1813 | El estado de compuerta ya vive en `AetherSafetyMiddleware` directamente. El HAL no debe duplicar este estado. |

### 3.2 Nuevo Rol del HAL: `ConnectionManager`

```typescript
// HardwareAbstraction.ts — WAVE 6019: API de gestión de conexiones
// El HAL ya no tiene "driver" como pipeline de datos.
// Tiene "connections" que son handles a workers/drivers activos.

export class HardwareAbstraction {
  // ── Connections activas ─────────────────────────────────────────────────
  private _usbWorker: Worker | null = null
  private _usbStrategy: OpenDMXStrategy | null = null  // gestiona el worker lifecycle
  private _artNetDriver: ArtNetDriver | null = null

  // ── USB Output ──────────────────────────────────────────────────────────
  async startUsbOutput(portPath: string, universe: number = 0): Promise<void> {
    await this.stopUsbOutput()
    this._usbStrategy = new OpenDMXStrategy()
    const ok = await this._usbStrategy.connect(portPath, universe, this._log.bind(this))
    if (!ok) throw new Error(`[HAL] USB worker failed to open ${portPath}`)
  }

  async stopUsbOutput(): Promise<void> {
    if (!this._usbStrategy) return
    await this._usbStrategy.destroy(this._log.bind(this))
    this._usbStrategy = null
  }

  // ── ArtNet Output ───────────────────────────────────────────────────────
  async startArtNetOutput(
    config: Partial<ArtNetConfig>,
    universes: number[] = [0],
    followHz = 40
  ): Promise<void> {
    await this.stopArtNetOutput()
    this._artNetDriver = new ArtNetDriver(config)
    const started = await this._artNetDriver.start()
    if (!started) throw new Error('[HAL] ArtNet driver failed to start')
    this._artNetDriver.attachSab(getDmxSab(), universes, followHz)
  }

  async stopArtNetOutput(): Promise<void> {
    if (!this._artNetDriver) return
    this._artNetDriver.detachSab()
    await this._artNetDriver.stop()
    this._artNetDriver = null
  }

  // ── Port Scanning (sin cambios) ─────────────────────────────────────────
  async scanPorts(): Promise<PortInfo[]> { /* ... sin cambios ... */ }

  // ── Teardown ────────────────────────────────────────────────────────────
  async dispose(): Promise<void> {
    await Promise.all([
      this.stopUsbOutput(),
      this.stopArtNetOutput(),
    ])
  }
}
```

**Campos que PERMANECEN en `HardwareAbstraction.ts`:**
- Todos los métodos de `PhysicsEngine`, `ZoneRouter`, `FixtureMapper` para el pipeline legacy no-Aether
- `_lastUniverseBuffers` (si se mantiene compatibilidad parcial con el driver legacy)
- `scanPorts()`, `autoConnect()` — siguen siendo necesarios para detectar puertos COM

### 3.3 Simplificación del `TickEngine.ts`

**Líneas que se eliminan del bloque de egress Aether:**

```typescript
// ELIMINAR estas llamadas — TickEngine ya no habla con el HAL en la ruta Aether:

// this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)  ← ELIMINAR
// this.hal.sendUniverseRaw(universe, egressBuf)                     ← YA NO EXISTE
// this.hal.flushAetherEgress()                                       ← ELIMINAR

// El bloque de egress Aether queda reducido a:
if (uniList.length > 0) {
  this.dmxWriter.commitFrame(this.frameCount, uniList, dirtyMask)
}
// FIN del trabajo del TickEngine. Drivers leen del SAB a su propio ritmo.
```

**Estado del `TickEngine` tras la poda:**
- `AetherSafetyMiddleware` permanece intacto — sigue operando en PRE/INTRA/POST-resolve
- `dmxWriter.commitFrame()` sigue siendo la única instrucción de salida
- El import `HardwareAbstraction` puede eliminarse del `TickEngine` si no quedan otras dependencias

---

## 4. Matriz Quirúrgica de Archivos

### Archivos que se ELIMINAN

| Archivo | Motivo |
|---|---|
| `src/hal/drivers/strategies/dmxPhantomWorker.ts` | Supersedido completamente por `openDmxWorker.ts` v2 (worker_thread + SAB). Sin BREAK, nunca instanciado — no aporta nada. |

### Archivos que se REESCRIBEN (new owner, same filename)

| Archivo | Cambio principal |
|---|---|
| `src/hal/drivers/strategies/openDmxWorker.ts` | `child_process` → `worker_thread`. IPC `number[]` → `workerData.sab` + `DmxUniverseReader`. BREAK/MAB/spinWaitNs preservados. |

### Archivos que se MODIFICAN (adiciones quirúrgicas)

| Archivo | Qué se agrega / elimina |
|---|---|
| `src/hal/drivers/strategies/OpenDMXStrategy.ts` | **Eliminar:** SerialPort, setInterval, outputLoop, baudrate-switch. **Agregar:** `new Worker(workerPath, { workerData: { sab } })` + lifecycle handlers. |
| `src/hal/drivers/ArtNetDriver.ts` | **Agregar:** `attachSab()`, `detachSab()`, props SAB. `stop()` llama `detachSab()`. |
| `src/hal/drivers/ArtNetDriverAdapter.ts` | **Agregar:** llamada a `attachSab(getDmxSab(), ...)` en `connect()` y `detachSab()` en `disconnect()`. |
| `src/hal/HardwareAbstraction.ts` | **Eliminar:** `sendUniverseRaw()`, `flushAetherEgress()`, `setAetherOutputGateState()`. **Agregar:** `startUsbOutput()`, `stopUsbOutput()`, `startArtNetOutput()`, `stopArtNetOutput()`. |
| `src/core/orchestrator/tick/TickEngine.ts` | **Eliminar:** `this.hal.setAetherOutputGateState(...)`. Confirmar que `sendUniverseRaw` y `flushAetherEgress` ya no se referencian. |
| `src/hal/drivers/UniversalDMXDriver.ts` | **Eliminar/deprecar:** `UPDATE_BUFFER` IPC dispatch en `sendAll()` — ya no es el canal de datos primario para Aether. La gestión del `universeBuffers` interno puede permanecer para compatibilidad con el path legacy. |

### Archivos que NO CAMBIAN

| Archivo | Motivo |
|---|---|
| `src/core/aether/glass/DmxSabHandlers.ts` | La API de `commitFrame()` / `readCoherent()` es estable. `Atomics.notify()` en `commitFrame()` ya está en línea 55. |
| `src/core/aether/glass/GlassMemory.ts` | `getDmxSab()` singleton permanece sin cambios. |
| `src/core/aether/glass/layout.ts` | Las constantes `CHANNELS_PER_UNI`, `DmxHdr`, `DMX_HEADER_I32` son la interfaz canónica. |
| `src/core/aether/egress/AetherSafetyMiddleware.ts` | No toca el pipeline de datos. Opera sobre `ArbitratedNodeMap` pre-SAB. |

---

## 5. Patrón de Lectura SAB — Referencia Rápida

Ambos drivers (USB y ArtNet) usan el mismo patrón:

```typescript
// Inicialización (una vez)
const reader = new DmxUniverseReader(getDmxSab())
let lastFrameId = -1
const sabHdr = new Int32Array(getDmxSab(), 0, DMX_HEADER_I32)

// En cada iteración del loop
const frame = reader.readCoherent(lastFrameId)
if (!frame) return  // Sin frame nuevo — saltar este tick

lastFrameId = frame.frameId

// Extraer universo específico (N = 0..49)
const N = targetUniverse
const uniData: Uint8Array = frame.data.subarray(N * 512, (N + 1) * 512)

// Leer dirtyMask para saber qué universos tienen datos nuevos
const dirty = (BigInt(sabHdr[DmxHdr.UNIVERSE_MASK_HI]) << BigInt(32))
            | BigInt(sabHdr[DmxHdr.UNIVERSE_MASK])
const universeNChanged = ((dirty >> BigInt(N)) & BigInt(1)) === BigInt(1)
```

**Protocolo seqlock (garantía de coherencia):**
- Si `SEQLOCK` es **impar** → escritura en curso, `readCoherent()` hará re-intento automático
- Si `SEQLOCK` es **par** y no cambió entre pre/post lectura → frame coherente
- `Atomics.waitAsync(sabHdr, DmxHdr.SEQLOCK, currentSeq, 30)` → despertar reactivo cuando `commitFrame()` notifique

---

## 6. Riesgo Residual Documentado

| Riesgo | Probabilidad | Impacto | Nota |
|---|---|---|---|
| serialport N-API no resuelve en Electron actual | Media | Alto | Usar fallback SAB-to-IPC Proxy (§1.7) mientras se resuelve |
| `Atomics.waitAsync` requiere `worker_threads` context | Bajo | Medio | Confirmado: `waitAsync` está disponible en worker_threads desde Node.js 16.0 |
| ArtNet multi-universo con dirtyMask: false negatives si los cambios son más rápidos que el setInterval (40Hz) | Bajo | Bajo | El SAB siempre tiene el frame más reciente; a lo peor se pierde 1 frame/25ms |
| `spinWaitNs()` bloquea el worker_thread V8 event loop durante ~130µs | Bajo | Bajo | Correcto y aceptable — es el propósito del thread dedicado. Solo afecta procesado de `parentPort` messages |
| Electron `contextIsolation` puede variar entre versiones | Bajo | Bajo | `getDmxSab()` y `getDmxSab()` son singleton del Main Process — no cruzan renderer |

---

*BLUEPRINT WAVE-6019 — Fin del documento. Adiciones pendientes: validación de tipos TypeScript para las nuevas firmas de `HardwareAbstraction`.*
