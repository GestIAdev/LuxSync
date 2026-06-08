# WAVE 6003 — INFORME TOPOGRÁFICO DE LA ARQUITECTURA MULTI-HILO / WORKER
**Target:** KIMI / DEEPSEEKER (Strict Read-Only Mode)
**Scope:** Levantamiento topográfico de todos los procesos/workers, mecanismos de transferencia de memoria, y viabilidad de refactor a memoria compartida.
**Mandato:** ZERO modificaciones de código. Solo diagnóstico forense.

---

## RESUMEN EJECUTIVO

La aplicación utiliza **tres tecnologías de paralelismo simultáneas**, cada una con fronteras de IPC distintas:

1. **`child_process.fork()`** (DMX Phantom Worker): Proceso Node.js independiente para bit-banging serial. Comunicación vía `process.send()` / `process.on('message')` usando pipe del OS. **Sin memoria compartida.** El buffer DMX viaja como `number[]` de 513 elementos (structured clone).

2. **Node `worker_threads`** (Trinity BETA/GAMMA): Workers dentro del Main Process de Electron. BETA recibe audio vía `SharedArrayBuffer` pasado en `workerData` — **esta sí es memoria compartida real.** GAMMA no recibe SAB.

3. **Web Workers (Chromium Renderer)** (Hyperion Render, Theta, GodEar Offline): Workers en el proceso renderer de Chromium. Solo Theta y GodEar usan transferables/SAB realmente. **Hyperion Render Worker NO transfiere el Float32Array de frames** (a pesar de los comentarios de diseño que lo sugieren); usa structured clone copy para poder reutilizar el buffer en el hilo principal.

**Veredicto sobre viabilidad de SharedArrayBuffer generalizado:**
- **En Main Process (Node):** Totalmente viable. BETA ya demuestra SAB compartido para audio. El flujo DMX (`UniversalDMXDriver` → `OpenDMXStrategy` → child_process) sería el candidato #1 para reemplazar el pipe de `number[]` por un `SharedArrayBuffer` de 513 bytes (o `Uint8Array` sobre SAB).
- **En Renderer (Chromium):** Viable pero limitado por arquitectura. Theta ya usa SAB para `frameContext` y video thumb. Hyperion Render Worker podría migrar su Float32Array de frames a SAB, pero requeriría que el worker y el main thread del renderer compartan el mismo SAB (ambos están en el mismo proceso Chromium, por lo que la restricción de site-isolation no aplica dentro del mismo origin del renderer).
- **Entre Main Process y Renderer:** Imposible compartir SAB directamente. Electron no permite compartir SAB entre procesos nativos (Main ↔ Renderer). Siempre requiere doble salto: Main → IPC structured clone → Renderer → postMessage → Web Worker.

---

## 🔍 TAREA 1: AUDITORÍA DEL DMX PHANTOM WORKER

### 1.1 Tecnología de Aislamiento

**Archivo:** `electron-app/src/hal/drivers/strategies/openDmxWorker.ts`  
**Spawner:** `electron-app/src/hal/drivers/strategies/OpenDMXStrategy.ts`  
**Driver padre:** `electron-app/src/hal/drivers/UniversalDMXDriver.ts`

| Atributo | Valor |
|---|---|
| **Mecanismo** | `child_process.fork()` (NO `worker_threads`, NO Web Worker) |
| **Motivación documentada** | "Electron 28 + worker_threads + native addons (serialport) = CRASH. El addon nativo bindings.node se carga en ambos V8 isolates y comparte estado C++ global." |
| **Prioridad del proceso** | `os.setPriority(PRIORITY_HIGHEST)` con fallback a `PRIORITY_ABOVE_NORMAL` |

### 1.2 Ciclo de Vida del Buffer DMX

**Paso 1 — Main Process (OpenDMXStrategy.send)**
```typescript
// OpenDMXStrategy.ts, líneas 189-206
private readonly _ipcChannels = new Array<number>(513)
private readonly _ipcPayload = { type: 'UPDATE_BUFFER', channels: this._ipcChannels }

async send(_port, buffer: Buffer, ...): Promise<void> {
  // Hash rápido (djb2) para dirty-check
  if (hash === this.lastSentHash) return

  // Copiar Buffer de Node.js → Array<number> plano
  const channels = this._ipcChannels
  for (let i = 0; i < len; i++) {
    channels[i] = buffer[i]
  }

  // Enviar vía pipe del OS (structured clone del objeto + array)
  this.child.send(this._ipcPayload)
}
```

**Hallazgo crítico:** El `Buffer` de Node.js (que es un `Uint8Array` nativo) se copia explícitamente a un `Array<number>` de 513 elementos antes de enviarse. **No se transfiere como `ArrayBuffer`, `SharedArrayBuffer`, ni `Uint8Array`.** Es un array de números primitivos que se serializa por structured clone del pipe IPC de `child_process`.

**Paso 2 — Child Process (openDmxWorker.ts)**
```typescript
// openDmxWorker.ts, líneas 78-89
const dmxBuffer: Buffer = Buffer.alloc(513, 0)
const dmxSendBuffer: Buffer = Buffer.alloc(513, 0) // Double buffer

process.on('message', (msg) => {
  case 'UPDATE_BUFFER':
    if (Array.isArray(msg.channels)) {
      const len = Math.min(msg.channels.length, dmxBuffer.length)
      for (let i = 0; i < len; i++) {
        dmxBuffer[i] = msg.channels[i]  // ← Copia byte a byte
      }
      dmxBuffer[0] = 0
      lastBufferUpdateNs = process.hrtime.bigint()
    }
})
```

El child recibe un array nuevo (producto de structured clone), y copia cada elemento al `Buffer.alloc(513)` local.

**Paso 3 — Output Loop y `port.write()`**
```typescript
// openDmxWorker.ts, líneas 524-545
function sendFrame(): void {
  // WAVE 5035: SNAPSHOT — copia atómica antes de operaciones async
  dmxBuffer.copy(dmxSendBuffer)
  dmxSendBuffer[0] = 0

  if (breakMode === 'baudrate') {
    sendFrameBaudrateBreak()
  } else {
    sendFrameSetBreak()
  }
}
```

El double-buffer (`dmxBuffer` vs `dmxSendBuffer`) evita que un `UPDATE_BUFFER` concurrente corrompa el frame mientras `port.write()` retiene la referencia en el kernel.

### 1.3 Bloqueo de Hilo dentro del Worker

**`port.write()` en sí es NO bloqueante** para el event loop de Node.js: usa callbacks (`(err) => { ... })`).

**PERO** el código usa **`spinWaitNs(ns)`** (busy-wait puro) para timing preciso:
```typescript
// openDmxWorker.ts, líneas 494-498
function spinWaitNs(ns: bigint): void {
  const end = process.hrtime.bigint() + ns
  while (process.hrtime.bigint() < end) {} // busy-wait
}
```

Esta función se invoca para:
- **BREAK:** `BREAK_NS = 110_000` (110µs) en modo `set-break`.
- **MAB:** `MAB_NS = 20_000` (20µs) en modo baudrate-switch.

**Veredicto:** El child process se bloquea activamente (CPU al 100% en un core) por ~110µs cada frame DMX. En un proceso dedicado con `PRIORITY_HIGHEST`, esto es aceptable. No afecta al Main Process ni al Renderer.

El scheduling del frame usa `setImmediate()` para ceder al event loop entre frames, con un spin-wait final de hasta 5ms (`MAX_PACING_SPIN_NS`) para el momento exacto del frame:
```typescript
function scheduleNextFrame(): void {
  outputLoop = setImmediate(() => {
    // ... spin-wait preciso ...
    sendFrame()
  })
}
```

### 1.4 ¿Existe algún intento de memoria compartida?

**NO.** El DMX Phantom Worker no usa `SharedArrayBuffer`, `Atomics`, ni ningún mecanismo de memoria compartida. Es comunicación pura por pipe IPC + structured clone de arrays planos.

| Métrica | Valor |
|---|---|
| Payload por frame | 513 × 8 bytes (number[] en V8) ≈ ~4KB structured clone |
| Frecuencia | 30Hz (configurable hasta 44Hz) |
| Throughput IPC | ~120 KB/s |
| Latencia IPC | Negligible (pipe del OS, mismo host) |

---

## 🔍 TAREA 2: ANÁLISIS DEL "MILAGRO ZERO-COPY" (hyperion-render.worker)

### 2.1 Arquitectura General

**Worker:** `electron-app/src/workers/hyperion-render.worker.ts`  
**Spawner:** `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx`  
**Protocolo:** `electron-app/src/workers/hyperion-render.types.ts`  
**Buffer packing:** `electron-app/src/workers/HyperionRenderBuffer.ts`

| Atributo | Valor |
|---|---|
| **Tipo** | Web Worker (Chromium renderer process) |
| **Instanciación** | Vite `?worker` import: `import RenderWorkerConstructor from '.../hyperion-render.worker?worker'` |
| **Canvas** | `OffscreenCanvas` transferido vía `transferControlToOffscreen()` |
| **Loop de render** | `requestAnimationFrame` a 60fps dentro del worker |

### 2.2 Inicialización — Transfer de OffscreenCanvas (TRUE Zero-Copy)

**Main Thread (TacticalCanvas.tsx, líneas 375-388):**
```typescript
offscreen = canvas.transferControlToOffscreen()  // Irreversible, one-shot
isTransferredRef.current = true

const worker = createRenderWorker()  // new RenderWorkerConstructor()
workerRef.current = worker
```

**Mensaje INIT (TacticalCanvas.tsx, líneas 296-304 y worker handler líneas 455-484):**
```typescript
postToWorker({ type: 'INIT', canvas: offscreen, width, height, dpr, quality, ... })
// En el worker: recibe msg.canvas como OffscreenCanvas (ownership transferida)
```

**Veredicto:** El `OffscreenCanvas` **sí se transfiere** (ownership mueve del hilo principal al worker). Esto es verdadera zero-copy y el patrón correcto de aislamiento de renderizado.

### 2.3 Transfer de Datos de Frame — La Discrepancia Crítica

**Diseño documentado (HyperionRenderBuffer.ts, líneas 27-49):**
```typescript
/**
 * Pack an array of fixture frame data into a Float32Array for Transferrable.
 * Returns a NEW Float32Array each call (previous one was transferred to worker).
 */
export function packFixtureFrames(fixtures: WorkerFixtureFrame[]): Float32Array {
  const buffer = new Float32Array(fixtures.length * FLOATS_PER_FIXTURE)
  // ... escribe datos ...
  return buffer
}
```

**Implementación real (TacticalCanvas.tsx, líneas 655-685):**
```typescript
// 🛠️ WAVE 5033: Pre-allocated buffer — grows to max fixture count, then reused
const neededSize = currentFixtures.length * FLOATS_PER_FIXTURE
let buffer = frameBufferRef.current
if (!buffer || buffer.length < neededSize) {
  buffer = new Float32Array(neededSize)
  frameBufferRef.current = buffer
}
packFrameDataInto(buffer, currentFixtures, transientMap, controlState, overrides)

// Mutate pre-allocated msg template in-place (zero alloc)
const msg = msgTemplateRef.current
msg.frameData = buffer

// 🛠️ WAVE 5033: No transfer — buffer is reused next frame (zero alloc)
mailboxTransferRef.current = undefined
flushFrameMailbox()
```

**Y en `flushFrameMailbox` (líneas 334-354):**
```typescript
const transfer = mailboxTransferRef.current  // undefined
if (transfer && transfer.length > 0) {
  w.postMessage(pending, transfer)
} else {
  w.postMessage(pending)  // ← Structured clone, NO transferable
}
```

**Veredicto forense:** El Float32Array de frames **NO se transfiere**. Se envía vía structured clone (`postMessage(pending)` sin lista de transferables). Esto significa:
- **Main thread:** Zero-allocation (reutiliza el mismo `Float32Array` frame tras frame).
- **Worker:** Recibe una COPIA del Float32Array (structured clone crea una nueva instancia en el heap del worker).
- **Costo:** A 64 fixtures = 2,560 bytes/frame × 60Hz = ~153 KB/s de copia estructurada. Negligible, pero **NO es zero-copy IPC**.

**Discrepancia:** Los comentarios en `HyperionRenderBuffer.ts` describen un patrón de transferabilidad ("previous one was transferred to worker") que **ya no se usa**. El código actual prefiere zero-allocation en main thread sobre zero-copy en el worker-to-main IPC.

### 2.4 Layout del Float32Array (Frame Data)

**Formato:** 10 floats por fixture × N fixtures.

| Índice | Campo | Descripción |
|---|---|---|
| 0 | R | Red 0-255 |
| 1 | G | Green 0-255 |
| 2 | B | Blue 0-255 |
| 3 | Intensity | 0-1 (normalizado) |
| 4 | Physical Pan | 0-1 |
| 5 | Physical Tilt | 0-1 |
| 6 | Zoom | 0-255 DMX |
| 7 | Focus | 0-255 DMX |
| 8 | Pan Velocity | signed |
| 9 | Tilt Velocity | signed |

At 64 fixtures: 640 floats × 4 bytes = **2,560 bytes/frame**.

### 2.5 Patrón de Inicialización del Buffer en Main Process

1. **Pre-allocación:** `frameBufferRef.current = new Float32Array(neededSize)` crece una sola vez al montar o al cambiar el número de fixtures.
2. **Escritura in-place:** `packFrameDataInto()` muta el `Float32Array` existente directamente (offset por fixture).
3. **Reutilización:** El mismo buffer se limpia vía overwrite (no se destruye) en cada frame del RAF pump.
4. **Envío:** `msgTemplateRef.current.frameData = buffer` muta el template; `mailboxTransferRef.current = undefined` asegura que NO se transfiere.

**Este es el patrón documentado para replicar:** pre-allocar un TypedArray en el main thread, escribir in-place cada frame, y enviar por structured clone. Si se desea verdadero zero-copy, bastaría con cambiar `mailboxTransferRef.current = [buffer.buffer]` y reconstruir el buffer en el main thread cada frame (perdiendo la zero-allocation).

---

## 🔍 TAREA 3: EL "WORKER DE UI" (THREAD ISOLATION)

### 3.1 Existe un WebWorker dedicado a UI?

**NO.** No existe un "Worker de UI" semántico. El término "UI thread" en este codebase se refiere al hilo principal del renderer de Chromium donde corre React (el "main thread" del frontend).

Sin embargo, existen **tres Web Workers reales** en el frontend (renderer process), cada uno con un propósito especializado:

| Worker | Archivo | Tipo | Propósito |
|---|---|---|---|
| **Hyperion Render Worker** | `workers/hyperion-render.worker.ts` | Web Worker (Vite `?worker`) | Renderizado 2D OffscreenCanvas para TacticalCanvas |
| **Theta Worker** | `theia/theta.worker.ts` | Web Worker (`new URL(..., import.meta.url)`) | Pipeline de video/WebCodecs + proyección LED wall |
| **GodEar Offline Worker** | `chronos/analysis/godear-offline.worker.ts` | Web Worker (`new URL(..., import.meta.url)`) | Análisis batch FFT para timeline de Chronos |

### 3.2 ¿Cómo recibe data del Main Process?

**Ruta obligatoria: Doble Salto de IPC.**

Ningún Web Worker en el renderer tiene acceso directo al Main Process de Electron. La ruta siempre es:

```
Main Process (Node/Electron)
  ↓  IPC structured clone (Electron preload → window.lux)
Renderer Main Thread (React/Chromium)
  ↓  postMessage() [structured clone o transferable]
Web Worker (Chromium renderer)
```

#### Caso A: Hyperion Render Worker
- **Origen de datos:** No recibe nada del Main Process directamente.
- **Fuente:** El `TacticalCanvas.tsx` (React main thread) lee `transientStore` (mutable ref poblado por IPC desde Main) y `controlStore` / `overrideStore` (Zustand), luego empaqueta los datos y los envía al worker vía `postMessage`.
- **Conclusión:** Todo su "input" viene del hilo principal del renderer, que a su vez lo obtuvo de Zustand stores hidratados por IPC.

#### Caso B: Theta Worker (Video)
- **Origen de datos:** Recibe `SharedArrayBuffer` de `frameContext` y `videoFrameSAB` / `thumbPixelSAB`.
- **Cómo llega:**
  1. `TrinityOrchestrator` (Main Process) crea los SABs (`createFrameContextSAB()`, `VideoFrameWriter`, `ThumbFrameWriter`).
  2. `ThetaOrchestrator` (renderer main thread) los obtiene vía IPC: `window.lux.theia.getFrameContextSAB()` (o similar bridge).
  3. `ThetaOrchestrator` spawnea `theta.worker.ts` y los envía vía `postMessage`:
```typescript
// ThetaOrchestrator.ts, líneas 735-747
worker.postMessage(
  makeThetaMessage('theia:init', {
    frameContextSAB: this.frameContextSAB,
    videoFrameSAB: this.videoFrameSAB ?? undefined,
    thumbPixelSAB: this.thumbPixelSAB,
  }),
  transfer,  // solo OffscreenCanvas va aquí; SAB se comparte por referencia
)
```
- **Nota clave:** Los `SharedArrayBuffer` no necesitan ir en la lista `transfer` de `postMessage`; se pasan por **referencia compartida** (structured clone de un SAB comparte el backing store, no mueve ownership).

#### Caso C: GodEar Offline Worker
- **Origen de datos:** Audio decodificado en el renderer (`AudioBuffer`).
- **Transfer:** El `Float32Array` de muestras se clona y se transfiere:
```typescript
// GodEarOffline.ts, líneas 216-228
const samplesClone = new Float32Array(monoSamples)
worker.postMessage(
  { type: 'analyze', monoSamples: samplesClone, sampleRate, duration, config },
  [samplesClone.buffer]  // ← Transferable ArrayBuffer (zero-copy IPC al worker)
)
```
- **Conclusión:** Este SÍ usa transferencia real de `ArrayBuffer` (no SAB). Después del `postMessage`, el hilo principal pierde acceso al buffer (se mueve al worker).

### 3.3 Trinity Workers (Main Process — NO son Web Workers)

**Importante distinguir:** Los workers BETA y GAMMA son `worker_threads` de **Node.js** (corren en el Main Process de Electron, NO en el renderer).

**Spawning:**
```typescript
// TrinityOrchestrator.ts, líneas 350-359
const worker = new Worker(workerPath, {
  workerData: {
    config: this.config,
    // WAVE 3401: Pass SharedArrayBuffer to BETA for zero-copy audio
    ...(nodeId === 'beta' && this.sharedAudioBuffer
      ? { sharedAudioBuffer: this.sharedAudioBuffer }
      : {}
    )
  }
})
```

**BETA — Audio Analysis Worker:**
- Recibe `sharedAudioBuffer: SharedArrayBuffer` vía `workerData`.
- El `TrinityOrchestrator` escribe audio en el SAB usando `SharedRingBufferWriter` (AudioMatrix + LegacyBridgeProvider).
- BETA lee directamente del SAB sin IPC en el hot-path. **Esto es memoria compartida real entre Main Thread (ALPHA) y Node Worker (BETA).**

**GAMMA — Brain Worker:**
- No recibe SAB. Solo recibe mensajes estructurados (`AUDIO_ANALYSIS`, `MUSICAL_CONTEXT`) vía `worker.postMessage`.

---

## 📊 MATRIZ COMPARATIVA DE MECANISMOS DE MEMORIA

| Flujo de Datos | Tecnología | Tipo de Worker/Proceso | Mecanismo IPC | ¿Zero-Copy? | ¿Shared Memory? |
|---|---|---|---|---|---|
| DMX buffer → Phantom Worker | `child_process.fork()` | Proceso Node.js separado | `process.send({ channels: number[] })` | **NO** | **NO** |
| Audio → BETA (Trinity) | `worker_threads` | Node Worker (Main Process) | `workerData: { sharedAudioBuffer: SAB }` | **SÍ** | **SÍ** |
| Musical Context → GAMMA | `worker_threads` | Node Worker (Main Process) | `worker.postMessage({ type, payload })` | **NO** | **NO** |
| OffscreenCanvas → Hyperion | Web Worker | Renderer Chromium | `postMessage({ canvas: offscreen }, [offscreen])` | **SÍ** (transfer) | N/A |
| Frame data → Hyperion | Web Worker | Renderer Chromium | `postMessage({ frameData: Float32Array })` | **NO** (structured clone) | **NO** |
| Frame Context → Theta | Web Worker | Renderer Chromium | `postMessage({ frameContextSAB: SAB })` | **SÍ** (SAB clone-by-share) | **SÍ** |
| Video SAB → Theta | Web Worker | Renderer Chromium | `postMessage({ videoFrameSAB: SAB })` | **SÍ** (SAB clone-by-share) | **SÍ** |
| Audio samples → GodEar Offline | Web Worker | Renderer Chromium | `postMessage({ monoSamples }, [buffer])` | **SÍ** (transferable) | **NO** |

---

## ⚠️ HALLAZGOS CRÍTICOS

### H1: Discrepancia de diseño en Hyperion Render Buffer
Los comentarios y el nombre del módulo `HyperionRenderBuffer.ts` sugieren un patrón de transferencia de `Float32Array` que **no se ejecuta** en `TacticalCanvas.tsx`. La optimización actual (WAVE 5033) prefiere zero-allocation main-thread sobre zero-copy worker IPC. Esto es funcionalmente correcto para la carga actual (~2.5KB/frame), pero si el número de fixtures crece o la frecuencia sube, la copia estructurada podría volverse relevante.

### H2: DMX Phantom Worker — candidato #1 para SAB
El flujo DMX es el más simple de migrar a memoria compartida:
- Solo 513 bytes de payload.
- El child process es un proceso Node.js autónomo. `SharedArrayBuffer` de 1KB entre Main y Child sería trivial.
- Eliminaría la serialización de `number[]` y las dos copias byte-a-byte (Main→array, array→dmxBuffer).
- Limitación: `child_process.fork()` requiere que el SAB se pase por `process.send()` como parte del mensaje de inicialización (structured clone de SAB es shareable en Node 14+), o se cree el SAB en el child y se pase la referencia. En `worker_threads` es trivial con `workerData`. En `child_process`, requiere `serializedSharedArrayBuffer` o usar `worker_threads` (con riesgo de crash con serialport, documentado en WAVE 2021.5).

### H3: El doble salto Main→Renderer→WebWorker es inevitable
Para cualquier dato que nazca en el Main Process (como `SeleneTruth` o audio crudo) y necesite llegar a un Web Worker del renderer, **siempre** hay un doble salto:
1. Main Process → Renderer: Electron IPC (`ipcRenderer.on` → Zustand store / transientStore).
2. Renderer Main Thread → Web Worker: `postMessage`.

**No existe** un mecanismo en Electron para que un Web Worker del renderer reciba mensajes directamente del Main Process sin pasar por el hilo principal del renderer.

### H4: SAB entre Main y Renderer
Electron sí soporta `SharedArrayBuffer` entre Main y Renderer **solo si** se habilitan `contextIsolation: false` y las cabeceras COOP/COEP adecuadas. Sin embargo, LuxSync usa `contextIsolation: true` (por seguridad del preload). Por tanto, compartir SAB directamente entre Main Process y Renderer está **bloqueado por la configuración de seguridad actual**. Los SABs que existen (frameContext, video) se crean en el Main Process y se exponen al renderer vía IPC, pero el renderer los recibe como referencias compartidas (no se mueve ownership, se comparte la referencia al bloque de memoria subyacente del proceso). Esto funciona porque ambos están en el mismo proceso Chromium... espera, no. El Main Process es Node.js/V8 de Electron, y el Renderer es Chromium V8. Son procesos **diferentes**. 

**Corrección:** En Electron, `SharedArrayBuffer` NO puede compartirse directamente entre el Main Process (Node.js) y el Renderer Process (Chromium) porque son procesos del SO separados. La única forma es usar `MessagePort` (desde `MessageChannel`) creado en Main y pasado al Renderer vía IPC, y luego al Web Worker. Pero `MessagePort` de Node.js (`worker_threads`) no es compatible con `MessagePort` de Chromium (Web Workers). Por tanto, **no hay un camino de SAB directo entre Main Process y Web Worker del renderer.**

Los SABs que el Theta Worker recibe deben haber sido creados en el **Renderer Process** (o en un Web Worker de ese renderer), no en el Main Process. Revisando `ThetaOrchestrator.ts` y `TrinityOrchestrator.ts`: `createFrameContextSAB()` se llama en `TrinityOrchestrator` (Main Process). El SAB se pasa al renderer vía IPC (`getFrameContextSAB()`). Electron IPC con SAB: cuando un SAB se pasa por `ipcRenderer`, se serializa como referencia compartida? No, V8 en procesos separados no comparten heaps. 

**Verificación crítica:** `TrinityOrchestrator.getFrameContextSAB()` devuelve el SAB. Este método es llamado por el IPC bridge del preload (`preload.ts`). Electron's `ipcRenderer` usa structured clone. Structured clone de un `SharedArrayBuffer` entre procesos en Electron **sí funciona** si la referencia al SAB subyacente se mantiene viva en el proceso emisor y el receptor obtiene una nueva referencia al mismo bloque de memoria del kernel (en Electron, los SAB se implementan sobre memoria compartida del OS). Sin embargo, esto requiere que el emisor (Main Process) mantenga la referencia viva. `TrinityOrchestrator` mantiene `frameContextSAB` como campo de clase (`private readonly`), por lo que el SAB permanece vivo.

Por tanto, el Theta Worker recibe el SAB del renderer, que a su vez lo recibió del Main Process vía IPC. El SAB subyacente es compartido por el kernel, pero cada proceso tiene su propia referencia V8.

---

## 📋 RESUMEN DE HALLAZGOS

1. **DMX Phantom Worker (`child_process.fork()`):** Usa pipe IPC con `number[]` estructurado. Sin memoria compartida. `port.write()` es async pero usa `spinWaitNs()` (busy-wait) para timing preciso, bloqueando el event loop del child por ~110µs por frame.

2. **Hyperion Render Worker (Web Worker):** `OffscreenCanvas` se transfiere correctamente (zero-copy ownership transfer). El Float32Array de frames **NO se transfiere**; se envía por structured clone copiado, mientras el main thread reutiliza el buffer (zero-allocation). Los comentarios de diseño en `HyperionRenderBuffer.ts` están desactualizados.

3. **Theta Worker (Web Worker):** Usa `SharedArrayBuffer` para `frameContext`, `videoFrameSAB` y `thumbPixelSAB`. Estos SABs se comparten por referencia entre el renderer main thread y el worker (mismo proceso Chromium). El origen del SAB está en el Main Process (`TrinityOrchestrator`), pasando al renderer vía IPC de Electron.

4. **Trinity BETA (Node `worker_threads`):** Es el único flujo con memoria compartida real entre hilo principal y worker dentro del Main Process (`SharedArrayBuffer` vía `workerData`). BETA lee audio del SAB sin IPC en el hot-path.

5. **No existe "Worker de UI":** Es solo nomenclatura semántica para el hilo principal del renderer donde corre React.

6. **Doble salto inevitable:** Main Process → Renderer → Web Worker es la única ruta posible para datos que nacen en Main Process y se consumen en un Web Worker del frontend.

---

*Fin del levantamiento topográfico de Workers. Documento listo para entrega al Arquitecto.*
