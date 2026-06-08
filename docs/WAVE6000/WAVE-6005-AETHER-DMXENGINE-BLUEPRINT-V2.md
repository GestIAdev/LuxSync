# WAVE 6005 v2 — BLUEPRINT ARQUITECTÓNICO: "PUENTE DE CRISTAL HÍBRIDO"
### AETHER DMX ENGINE — Modelo de Doble Vía: SAB Hardware + Espejo Fluido UI

**Autor:** Ingeniero Arquitecto Principal
**Estado:** Documento de Diseño v2 (reemplaza la estrategia de transporte UI de v1)
**Fundamento empírico:** Spikes WAVE-6005 (SPIKE-1 a SPIKE-3.2)
**Objetivo:** Hot-path zero-copy real en hardware, transporte UI zero-allocation estable, y aislamiento total del hilo principal bajo carga máxima.

---

## 0. POR QUÉ EXISTE LA v2 (el hallazgo que cambia el diseño)

El Blueprint v1 (§2.3) asumía que `MessageChannelMain` + cross-origin isolation permitiría transferir un `SharedArrayBuffer` (SAB) desde el Main Process hacia el Renderer. **Los Spikes demostraron empíricamente que esto es FALSO.**

### 0.1 Resultados de los Spikes

| Spike | Qué probó | Resultado |
|---|---|---|
| **SPIKE-1** | SAB entre Main Process y Node `worker_thread` (vía `workerData`) | ✅ **FUNCIONA.** Lock-free, cero serialización. `serialport` carga sin crash en el worker. |
| **SPIKE-2** | SAB Main→Renderer vía `webContents.send()` e `ipcRenderer.invoke()` | ❌ `Failed to serialize arguments` / `An object could not be cloned`. |
| **SPIKE-3** | SAB Main→Renderer vía protocolo privilegiado `aether://` (COOP/COEP) + `MessageChannelMain` | ❌ `crossOriginIsolated === true` confirmado, pero el binding C++ **crashea** (`Exit code 1`) al empujar el SAB por el `MessagePort`. |
| **SPIKE-3.2** | `ArrayBuffer` transferible (ownership transfer `[buffer]`) por `MessageChannelMain` | ✅ **FUNCIONA.** No crashea V8. Zero-copy real (el buffer queda *neutered* en el origen). |

### 0.2 La causa raíz (veredicto del oráculo)

> El Main Process (Node) y el Renderer (Chromium) son **dos V8 isolates en procesos distintos del OS**. Un `SharedArrayBuffer` es, por definición, memoria compartida entre threads del **mismo** proceso. Cruzar el IPC de Electron con un SAB requeriría compartir memoria entre procesos del OS (territorio `mmap`/`shm_open` del kernel), lo cual V8 **no** coordina a través de la pipe de serialización del IPC.

El único path técnico sería un addon nativo N-API con `napi_create_external_arraybuffer` sobre memoria mapeada por el OS — peligroso (sin coordinación de GC, sin protección Spectre), no portable, y frágil ante updates de Electron. **No es viable para producción.**

### 0.3 La decisión: Bifurcación de Vías

```
                          ┌─────────────────────────────────┐
                          │     TitanOrchestrator (44Hz)     │
                          └───────────────┬─────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  │                                                 │
        VÍA HARDWARE (SAB intacto)                  VÍA UI ("Espejo Fluido")
        Pilar 1 de v1, SIN CAMBIOS                  ArrayBuffer Transferible Ping-Pong
                  │                                                 │
                  ▼                                                 ▼
        DMX Phantom Worker                              Renderer (Canvas/UI)
        (Node worker_thread)                            (Zero-Allocation, bypass React)
        DMX_UNIVERSE_SAB                                FIXTURE_STATE via BufferPool
```

- **Vía Hardware:** se mantiene el `DMX_UNIVERSE_SAB` compartido entre el Main Process y el DMX Phantom Worker (`worker_thread` Node). Cero serialización, lock-free, seqlock. **Idéntico a v1 §1-§2.4.**
- **Vía UI:** se reemplaza el SAB del Renderer por un modelo de **`ArrayBuffer` transferibles** en patrón ping-pong con un pool pre-asignado. Zero-allocation, zero-copy, con frame-drop intencional.

> El overhead de la única `memcpy` (SAB → ArrayBuffer en el Main) para ~128KB de `FIXTURE_STATE` a 44Hz es de microsegundos. Es **invisible** comparado con los 38ms de bloqueo que provocaba el structured clone JSON.

---

## 1. VÍA HARDWARE — SAB INTACTO (sin cambios respecto a v1)

Esta vía **no se toca**. Se conservan íntegramente del Blueprint v1:

- §1.2 Constantes de layout del `DMX_UNIVERSE_SAB` (50 × 512 = 25.600 bytes + header).
- §1.3 Patrón **seqlock** lock-free (single-writer / multi-reader).
- §1.4 `DmxUniverseWriter` (Main) / `DmxUniverseReader` (DMX Worker).
- §2.4 Mitigación de `serialport` en `worker_thread` (**confirmada por SPIKE-1: no crashea**).

```
┌─ MAIN PROCESS (Node) ──────────────────────────────────────┐
│  TitanOrchestrator.tick(44Hz)                               │
│     └─> DmxUniverseWriter.commitFrame()  ─┐                 │
│                                            │ SAB (zero-copy) │
│  ┌─ DMX PHANTOM WORKER (worker_thread) ────▼──────────────┐  │
│  │   DmxUniverseReader.readCoherent()                      │  │
│  │   serialport.write() (bit-banging, spinWait aislado)    │  │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Garantía:** El SAB de hardware nunca cruza el IPC Main↔Renderer, por lo que el bug de los Spikes 2/3 **jamás lo afecta.** Vive enteramente dentro del proceso Node.

---

## 2. VÍA UI — "EL ESPEJO FLUIDO" (Transferable Buffer Pool)

### 2.1 Principio rector

El Renderer no comparte memoria con el Main. En su lugar, el Main **presta** un `ArrayBuffer` por frame (transfiriendo ownership), el Renderer lo lee y lo **devuelve** (transfiriendo ownership de vuelta). La memoria física nunca se copia al cruzar el puerto (zero-copy), y nunca se asignan/destruyen buffers por frame (zero-allocation).

```
   MAIN PROCESS                                RENDERER PROCESS
   ┌──────────────────────┐                    ┌──────────────────────┐
   │  BufferPoolManager    │   transfer →       │  preload (soberano)  │
   │  pool: [A][B][C]      │ ─────[buffer]────> │  retiene ArrayBuffers │
   │                       │                    │  expone Float32 view  │
   │  _onTick():           │                    │           │           │
   │   buf = pool.pop()    │                    │           ▼           │
   │   view.set(sabView)   │   <─ transfer ─    │  FixtureCanvas (rAF)  │
   │   port.postMessage(   │ <────[buffer]────  │  ackFrame() devuelve  │
   │     buf, [buf])       │                    │  el buffer al pool    │
   └──────────────────────┘                    └──────────────────────┘
```

### 2.2 Constantes de Layout (Vía UI)

```typescript
// src/core/aether/glass/glassUILayout.ts
export const MAX_FIXTURES    = 2048
export const FLOATS_PER_FIX  = 16                          // 64 bytes/fixture
export const FIX_STATE_FLOATS = MAX_FIXTURES * FLOATS_PER_FIX   // 32 768 floats
export const FIX_STATE_BYTES = FIX_STATE_FLOATS * 4        // 131 072 bytes (~128 KB)

export const POOL_SIZE = 3   // 1 en vuelo, 1 llenándose, 1 de margen

// Layout por fixture (offset en floats) — idéntico a FixField de v1
export const enum FixField {
  R = 0, G, B, W, A,
  DIMMER,
  PAN, TILT,
  PHYS_PAN, PHYS_TILT,
  ZOOM, FOCUS,
  PAN_VEL, TILT_VEL,
  STROBE,
  FLAGS,
}
```

> **Nota:** la fuente de verdad sigue siendo el `FIXTURE_STATE_SAB` interno del Main (escrito por el `NodeArbiter`). El Espejo Fluido solo **transporta** una copia coherente de ese estado al Renderer. El `memcpy` SAB→ArrayBuffer es el único costo añadido.

### 2.3 `BufferPoolManager` (Main Process)

```typescript
// src/core/aether/glass/BufferPoolManager.ts
import type { MessagePortMain } from 'electron'
import { FIX_STATE_BYTES, FIX_STATE_FLOATS, POOL_SIZE } from './glassUILayout'

/**
 * Gestiona un pool de ArrayBuffers transferibles para la Vía UI.
 * Patrón ping-pong: el Main presta buffers, el Renderer los devuelve.
 *
 * INVARIANTE: un ArrayBuffer está SIEMPRE en exactamente uno de:
 *   - el pool (libre, en posesión del Main)
 *   - en vuelo (transferido al Renderer, neutered en el Main)
 */
export class BufferPoolManager {
  private readonly pool: ArrayBuffer[]
  private port: MessagePortMain | null = null

  // Telemetría
  private framesSent = 0
  private framesDropped = 0
  private inFlight = 0

  constructor() {
    // Pre-asignación única al boot. Cero allocations en el hot-path.
    this.pool = Array.from({ length: POOL_SIZE }, () => new ArrayBuffer(FIX_STATE_BYTES))
  }

  /** Conecta el puerto durable del Glass Bridge y arranca la escucha de ACKs. */
  attach(port: MessagePortMain): void {
    this.port = port
    port.on('message', (e: { data: { type: string; buffer?: ArrayBuffer } }) => {
      if (e.data?.type === 'ack' && e.data.buffer instanceof ArrayBuffer) {
        this.recycle(e.data.buffer)
      }
    })
    port.start()   // CRÍTICO: sin start() el puerto no emite eventos
  }

  /**
   * Llamado en cada tick (44Hz) por el TitanOrchestrator.
   * Copia el estado maestro (SAB interno) a un buffer libre y lo transfiere.
   *
   * @param sabView Float32Array sobre el FIXTURE_STATE_SAB interno del Main.
   */
  pushFrame(sabView: Float32Array): void {
    if (!this.port) return

    const buffer = this.pool.pop()
    if (!buffer) {
      // FRAME DROP INTENCIONAL: el Renderer aún no devolvió buffers.
      // No encolamos: en el próximo tick enviaremos el estado MÁS RECIENTE.
      this.framesDropped++
      return
    }

    // El único memcpy del pipeline (~µs para 128KB). SAB → ArrayBuffer.
    new Float32Array(buffer).set(sabView)

    this.inFlight++
    this.framesSent++

    // Zero-copy: transferimos ownership. `buffer` queda neutered en el Main.
    this.port.postMessage({ type: 'glass-state', buffer }, [buffer])
  }

  /** El Renderer devolvió el buffer: vuelve al pool para reutilizarse. */
  private recycle(buffer: ArrayBuffer): void {
    this.inFlight--
    this.pool.push(buffer)
  }

  getMetrics() {
    return {
      framesSent: this.framesSent,
      framesDropped: this.framesDropped,
      inFlight: this.inFlight,
      poolFree: this.pool.length,
    }
  }
}
```

### 2.4 Ciclo de vida del Ping-Pong (paso a paso)

```
TICK 44Hz (Main)                         RENDERER (rAF ~60Hz)
─────────────────                        ────────────────────
1. buf = pool.pop()        ── 5 si pool vacío → DROP (skip frame)
2. Float32(buf).set(sab)
3. port.postMessage(           ──[transfer]──>  4. preload recibe buf
     {buf}, [buf])                                  retiene soberanía
   buf NEUTERED en Main                             expone Float32 view a React
                                                 5. FixtureCanvas lee view en rAF
                                                    (NO React state, NO re-render)
                                                 6. ackFrame():
6. recycle(buf)            <──[transfer]──        port.postMessage(
   buf vuelve al pool                                {type:'ack', buf}, [buf])
                                                    buf NEUTERED en Renderer
```

**Regla de soberanía (fix del bug de SPIKE-3.2):** el `preload` es el **único** dueño del `ArrayBuffer` raw en el lado Renderer. El mundo React **nunca** toca el buffer crudo — solo recibe una `Float32Array` *view* sobre él durante la llamada síncrona. Así, cuando el Renderer hace `ackFrame()`, devuelve el **buffer original** (no un clon), y el pool nunca se vacía por fuga de referencias.

### 2.5 Preload — soberanía del buffer

```typescript
// preload (Vía UI)
import { contextBridge, ipcRenderer } from 'electron'

let _port: MessagePortMain | null = null
let _pending: ArrayBuffer | null = null     // buffer esperando consumo en rAF
const _listeners = new Set<(view: Float32Array) => void>()

// El port llega vía webContents.postMessage (transfer de MessagePort)
ipcRenderer.on('glass:port', (event) => {
  _port = event.ports[0]

  _port.onmessage = ({ data }) => {
    if (data?.type !== 'glass-state') return

    // Si ya había un frame sin consumir, lo devolvemos (frame drop en el Renderer)
    if (_pending) {
      _port!.postMessage({ type: 'ack', buffer: _pending }, [_pending])
    }
    _pending = data.buffer

    // Notificar al mundo React con una VIEW (no el buffer raw)
    const view = new Float32Array(_pending)
    _listeners.forEach((cb) => {
      try { cb(view) } catch (err) { console.error('[glass] listener error:', err) }
    })
  }
  _port.start()   // CRÍTICO
})

contextBridge.exposeInMainWorld('glass', {
  /** Handshake: pedir el puerto al Main. Llamar una vez al montar la app. */
  connect: () => ipcRenderer.invoke('glass:handshake'),

  /**
   * Suscribirse a frames. callback(view) es válido SOLO durante la llamada
   * síncrona — NO guardar referencias al view. Devuelve cleanup.
   */
  onFrame: (cb: (view: Float32Array) => void) => {
    _listeners.add(cb)
    return () => { _listeners.delete(cb) }
  },

  /** Llamar desde el rAF tras renderizar. Devuelve el buffer al pool del Main. */
  ackFrame: () => {
    if (_pending && _port) {
      _port.postMessage({ type: 'ack', buffer: _pending }, [_pending])
      _pending = null
    }
  },
})
```

### 2.6 Handshake en el Main

```typescript
// MAIN — al crear la ventana
import { MessageChannelMain } from 'electron'

const pool = new BufferPoolManager()

win.webContents.ipc.handle('glass:handshake', () => {
  const { port1, port2 } = new MessageChannelMain()
  pool.attach(port1)
  // El port viaja por postMessage (invoke NO soporta transfers de puertos)
  win.webContents.postMessage('glass:port', null, [port2])
  return { maxFixtures: MAX_FIXTURES, floatsPerFix: FLOATS_PER_FIX }
})

// En el tick 44Hz:
pool.pushFrame(this.glass.fixtureSabView)
```

---

## 3. RENDERER — `FixtureCanvas` SIN RE-RENDERS

El visualizador lee el buffer transferible en su propio `requestAnimationFrame`, completamente desacoplado del ciclo de render de React. React solo se usa para montar el `<canvas>` una vez.

```tsx
// src/renderer/glass/FixtureCanvas.tsx
import { useEffect, useRef } from 'react'

export function FixtureCanvas({ universeIndex = 0 }: { universeIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let rafId = 0

    // Estado mutable local — NUNCA entra a React state (cero re-renders)
    let latestView: Float32Array | null = null

    void window.glass.connect().then(({ maxFixtures }) => {
      canvas.width = 512
      canvas.height = Math.ceil(maxFixtures / 512) * 4
    })

    // onFrame corre SÍNCRONO al llegar el frame: solo guardamos la referencia.
    const unsub = window.glass.onFrame((view) => {
      latestView = view
    })

    // rAF loop: desacoplado del arrival; siempre pinta el estado más reciente.
    const loop = () => {
      if (latestView) {
        renderFixtureFrame(ctx, latestView, universeIndex)
        window.glass.ackFrame()   // libera el buffer al pool del Main
        latestView = null
      }
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      unsub()
    }
  }, [universeIndex])

  return <canvas ref={canvasRef} style={{ width: '100%', imageRendering: 'pixelated' }} />
}

function renderFixtureFrame(
  ctx: CanvasRenderingContext2D,
  view: Float32Array,
  universeIndex: number,
): void {
  // Lectura imperativa directa del buffer transferible — sin VDOM, sin allocations
  // (implementación específica del visualizador)
}
```

**Por qué no hay re-renders:** `latestView` es una variable local del `useEffect`, no estado de React. El `<canvas>` se monta una sola vez. Todo el dato a 44Hz fluye por el rAF imperativo, exactamente la Regla de Oro #2 del Pilar 3 de v1.

---

## 4. FRAME DROP INTENCIONAL (la joya del diseño)

Si el Renderer va lento (jank de React, GC, pestaña en background), no devuelve buffers a tiempo y el pool se vacía. En ese caso, `pushFrame()` **descarta** el envío de ese tick:

```typescript
const buffer = this.pool.pop()
if (!buffer) {
  this.framesDropped++
  return   // skip — no encolamos frames viejos
}
```

**Semántica correcta para DMX/visualización:** nunca queremos mostrar frames viejos. La UI siempre debe **converger al estado real del hardware**. Descartar es preferible a encolar: una cola introduciría lag creciente y mostraría estados obsoletos. El siguiente tick que encuentre un buffer libre enviará el estado **más reciente**.

> Importante: el frame drop es **exclusivo de la Vía UI**. La Vía Hardware (SAB → DMX Worker) **nunca** dropea — el hardware recibe todos los frames vía seqlock lock-free.

---

## 5. PRESUPUESTO DE LATENCIA (Vía UI)

| Etapa | Costo | Notas |
|---|---|---|
| SAB write (NodeArbiter → FIXTURE_STATE_SAB) | ~0 µs | memoria, ya existe |
| `memcpy` SAB → ArrayBuffer (Main) | ~3-5 µs | 128 KB, único costo añadido |
| Transfer ArrayBuffer (Main → preload) | ~0 µs | zero-copy (ownership) |
| Exposición Float32 view (preload → React world) | ~0 µs | la view apunta al mismo buffer |
| rAF render a Canvas | ~0.1 ms | trabajo de pintado real |
| **TOTAL pipeline** | **< 0.5 ms** | vs **38 ms** con structured clone JSON |

---

## 6. ROADMAP DE IMPLEMENTACIÓN (actualizado)

> Estrategia **Strangler Fig**, idéntica filosofía que v1: cada fase deja el sistema funcional.

### FASE 1 — Cimientos (✅ validada por Spikes)
1. `glassUILayout.ts` con constantes y `FixField`.
2. **SPIKE-1 confirmado:** `worker_thread` + `serialport` + SAB no crashea → Vía Hardware desbloqueada.
3. **SPIKE-3.2 confirmado:** ArrayBuffer transferible por `MessageChannelMain` funciona → Vía UI desbloqueada.

### FASE 2 — Vía Hardware (SAB intacto)
4. Implementar `DmxUniverseWriter/Reader` (seqlock) — idéntico a v1 §1.4.
5. Migrar DMX de `child_process.fork()` a `worker_thread` con `DMX_UNIVERSE_SAB` vía `workerData`.
6. Unit-test de tearing concurrente con Vitest (SAB nativo en Node).

### FASE 3 — Vía UI (Espejo Fluido)
7. Implementar `BufferPoolManager` (Main) con pool de 3 buffers + telemetría.
8. Implementar el preload soberano (`window.glass`) y el handshake `MessageChannelMain`.
9. Implementar `FixtureCanvas` con rAF imperativo + `ackFrame()`.
10. Apagar `selene:hot-frame` IPC tras validar paridad visual.

### FASE 4 — Delta Truth + Selectores Atómicos
11. Conservar íntegro el Pilar 2 (Delta Truth) y Pilar 3 (selectores atómicos) de v1 §3-§4 para el estado **estructural** de baja frecuencia. No cambia.

### FASE 5 — Limpieza y blindaje
12. Eliminar legacy (`emitHotFrame`, structured clone de fixtures).
13. Telemetría: exponer `framesSent`, `framesDropped`, `inFlight`, `poolFree` del `BufferPoolManager`.
14. Documentar el contrato del ping-pong en el README del módulo `glass`.

---

## 7. RESUMEN DE GARANTÍAS (v2)

| Vía | Mecanismo | Garantía |
|---|---|---|
| **Hardware** | `SharedArrayBuffer` + seqlock (`Atomics`), DMX en `worker_thread` | Cero serialización; escritor nunca bloquea; 50 universos @ 44Hz; nunca dropea |
| **UI (Espejo Fluido)** | `ArrayBuffer` transferible + buffer pool ping-pong | Zero-copy, zero-allocation; latencia < 0.5ms; frame-drop intencional evita lag |
| **Estado estructural** | Delta Truth + structural sharing (v1 §3) | Ramas no modificadas conservan referencia → `useShallow` calla |
| **React** | Selectores atómicos + lectura buffer-en-rAF (v1 §4) | Cero re-renders por datos a 44Hz |

**Riesgo residual eliminado:** el bug del SAB cross-process ya no aplica — la Vía UI no usa SAB.
**Riesgo residual #1:** si el Renderer dropea demasiados frames bajo carga extrema → ajustar `POOL_SIZE` (3 → 4) y medir con telemetría.

---

## 8. APÉNDICE — DIFERENCIAS CLAVE v1 → v2

| Aspecto | v1 ("Puente de Cristal") | v2 ("Puente Híbrido") |
|---|---|---|
| SAB Main ↔ DMX Worker | ✅ SAB vía `workerData` | ✅ **Sin cambios** |
| SAB Main → Renderer | ❌ `MessageChannelMain` (asumido viable) | ⛔ **Eliminado** (crashea V8) |
| Transporte de estado UI | SAB compartido + `Atomics` en rAF | **ArrayBuffer transferible ping-pong** |
| Allocations por frame (UI) | 0 (SAB persistente) | 0 (buffer pool reciclado) |
| Copias por frame (UI) | 0 (lectura directa del SAB) | 1 memcpy (~5µs, SAB → buffer) |
| Manejo de backpressure | N/A (lectura no destructiva) | **Frame drop intencional** |
| Requisito cross-origin isolation | Obligatorio | **No requerido** para la Vía UI |

---

*Fin del Blueprint v2 "Puente de Cristal Híbrido". La Vía Hardware se ejecuta según v1; la Vía UI según este documento.*
