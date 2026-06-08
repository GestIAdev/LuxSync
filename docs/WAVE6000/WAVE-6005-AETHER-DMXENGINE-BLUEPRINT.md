# WAVE 6005 — BLUEPRINT ARQUITECTÓNICO: "PUENTE DE CRISTAL"
### AETHER DMX ENGINE — Escalado a 50 universos / 25.600 canales @ 44Hz

**Autor:** Ingeniero Arquitecto Principal
**Estado:** Documento de Diseño (NO implementación)
**Fundamento forense:** WAVE-6001 (IPC), WAVE-6002 (React), WAVE-6003 (Workers)
**Objetivo:** Hot-path zero-copy real, estabilidad referencial en React, y aislamiento total del hilo principal y la UI bajo carga máxima.

---

## 0. DIAGNÓSTICO CONSOLIDADO (de dónde venimos)

| Síntoma | Causa raíz (reporte) | Pilar que lo ataca |
|---|---|---|
| Parpadeo rítmico DMX | Event loop del Main bloqueado por structured clone a 22Hz/7.3Hz | Pilar 1 |
| 38ms de microtasks | `setTruth` reemplaza objeto raíz → tormenta de re-renders (6+ componentes) | Pilar 2 + 3 |
| DMX no comparte memoria | `child_process.fork()` + pipe IPC con `number[]` | Pilar 1 |
| `useShallow` no salva | Backend genera `fixtures.map()` nuevo cada tick → referencias muertas | Pilar 2 |

**Precedente probado en el codebase (clave para el diseño):**
- `SharedRingBuffer` (WAVE 3401): SAB Main ↔ Node `worker_thread` BETA vía `workerData`. **FUNCIONA.**
- `FrameContextRing` (WAVE 4860): SAB con `Atomics` isomorfo (Node + renderer + WebWorker). **FUNCIONA dentro de cada proceso.**
- ⚠️ **ADVERTENCIA CRÍTICA del código existente** (`ThetaOrchestrator.ts:204-213`): el transporte de un SAB de Main→Renderer vía `ipcRenderer.invoke()` (structured clone) **NO es fiable** ("en algunos entornos Electron, invoke() no clona SAB correctamente") y obliga a un fallback de SAB local. **Esto determina el transporte del puente (ver §2.3).**

---

## 1. PILAR 1 — HOT-PATH ZERO-COPY (DATA STRUCTURES)

### 1.1 Filosofía: separar el "QUÉ" del "CÓMO"

Dividimos el dato en dos planos físicos de memoria:

1. **`FIXTURE_STATE_SAB`** (plano semántico, alto nivel): valores por fixture (color, dimmer, pan/tilt físicos, velocidades). Lo consumen el Renderer (visualizer 2D/3D) y la UI. Escrito por el Main a 44Hz.
2. **`DMX_UNIVERSE_SAB`** (plano de bajo nivel): los 25.600 bytes crudos de salida DMX (50 × 512). Lo consume el DMX Worker. Escrito por el Main tras la resolución del NodeArbiter.

> Ambos SAB se crean **una sola vez** en el Main Process al boot, igual que `frameContextSAB`. Nunca se recrean ni se reasignan.

### 1.2 Constantes de Layout

```typescript
// ── DMX_UNIVERSE_SAB ──────────────────────────────────────────────────────
export const MAX_UNIVERSES   = 50
export const CHANNELS_PER_UNI = 512
export const DMX_DATA_BYTES   = MAX_UNIVERSES * CHANNELS_PER_UNI   // 25 600

// Header de control (Int32-aligned). Usamos seqlock para lectura lock-free.
export const DMX_HEADER_I32   = 16                                  // 16 × 4 = 64 bytes
export const DMX_HEADER_BYTES = DMX_HEADER_I32 * 4                  // 64
export const DMX_SAB_BYTES    = DMX_HEADER_BYTES + DMX_DATA_BYTES   // 25 664  (~25 KB)

// Offsets del header (índices sobre Int32Array)
export const enum DmxHdr {
  SEQLOCK       = 0,  // Atomics: par = estable, impar = escritura en curso
  FRAME_ID      = 1,
  UNIVERSE_MASK = 2,  // bitmask de universos "dirty" este frame (50 bits → usar 2 slots)
  UNIVERSE_MASK_HI = 3,
  ACTIVE_UNIS   = 4,
  TIMESTAMP_LO  = 5,
  TIMESTAMP_HI  = 6,
  // 7..15 reservados
}

// ── FIXTURE_STATE_SAB ─────────────────────────────────────────────────────
export const MAX_FIXTURES     = 2048
export const FLOATS_PER_FIX   = 16                                  // 64 bytes/fixture
export const FIX_DATA_FLOATS  = MAX_FIXTURES * FLOATS_PER_FIX       // 32 768 floats
export const FIX_HEADER_I32   = 32                                  // 128 bytes header
export const FIX_SAB_BYTES    =
  FIX_HEADER_I32 * 4 + FIX_DATA_FLOATS * 4                          // 128 + 131 072 = 131 200 (~128 KB)

// Layout por fixture (offset en floats dentro del bloque de datos)
export const enum FixField {
  R = 0, G, B, W, A,          // 0-4  color (0-255)
  DIMMER,                     // 5    0-1
  PAN, TILT,                  // 6-7  DMX 0-255
  PHYS_PAN, PHYS_TILT,        // 8-9  0-1 normalizado (para 3D)
  ZOOM, FOCUS,                // 10-11
  PAN_VEL, TILT_VEL,          // 12-13 firmadas
  STROBE,                     // 14
  FLAGS,                      // 15   bit0=active, bit1=blackout-mirror, ...
}
```

**Presupuesto de memoria total:** `~25 KB (DMX)` + `~128 KB (Fixtures)` = **~153 KB de memoria compartida**. Irrelevante para RAM moderna, y **cero serialización JSON** en el hot-path.

### 1.3 Patrón de concurrencia: SEQLOCK (lock-free, single-writer / multi-reader)

El Main es el **único escritor**. El DMX Worker, el Renderer y los WebWorkers son **lectores**. Usamos un *seqlock* con `Atomics` para que los lectores nunca vean un frame a medio escribir (tearing) sin bloquear:

```
ESCRITOR (Main):
  seq = Atomics.add(hdr, SEQLOCK, 1)   // pasa a IMPAR → "escritura en curso"
  ... escribe datos del frame ...
  Atomics.add(hdr, SEQLOCK, 1)         // vuelve a PAR → "frame estable"

LECTOR (Worker / Renderer):
  do {
    s1 = Atomics.load(hdr, SEQLOCK)
    if (s1 & 1) continue               // escritura en curso, reintenta
    ... lee datos ...
    s2 = Atomics.load(hdr, SEQLOCK)
  } while (s1 !== s2)                   // si cambió, el frame se reescribió → reintenta
```

Ventaja sobre mutex: el escritor **jamás se bloquea** (crítico para mantener el tick de 44Hz). Los lectores reintentan solo en la ventana de ~µs de escritura.

### 1.4 Interfaces TypeScript

```typescript
/** Escritor — vive en el Main Process. */
export class DmxUniverseWriter {
  private readonly i32: Int32Array
  private readonly u8: Uint8Array
  constructor(sab: SharedArrayBuffer) {
    this.i32 = new Int32Array(sab, 0, DMX_HEADER_I32)
    this.u8  = new Uint8Array(sab, DMX_HEADER_BYTES, DMX_DATA_BYTES)
  }
  /** Vuelca un universo resuelto. dirtyMask marca qué universos cambiaron. */
  commitFrame(frameId: number, universes: Uint8Array[], dirtyMask: bigint): void {
    Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)            // → impar
    for (let u = 0; u < universes.length; u++) {
      this.u8.set(universes[u], u * CHANNELS_PER_UNI)
    }
    this.i32[DmxHdr.FRAME_ID] = frameId
    this.i32[DmxHdr.UNIVERSE_MASK]    = Number(dirtyMask & 0xffffffffn)
    this.i32[DmxHdr.UNIVERSE_MASK_HI] = Number(dirtyMask >> 32n)
    Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)            // → par
    Atomics.notify(this.i32, DmxHdr.SEQLOCK)            // despierta al worker si espera
  }
}

/** Lector — vive en el DMX Worker. */
export class DmxUniverseReader {
  private readonly i32: Int32Array
  private readonly u8: Uint8Array
  private readonly scratch = new Uint8Array(DMX_DATA_BYTES)
  constructor(sab: SharedArrayBuffer) { /* views idénticas */ }
  /** Lectura coherente vía seqlock. Devuelve null si no hay frame nuevo. */
  readCoherent(lastFrameId: number): { frameId: number; data: Uint8Array } | null {
    let s1: number, s2: number
    do {
      s1 = Atomics.load(this.i32, DmxHdr.SEQLOCK)
      if (s1 & 1) continue
      const frameId = this.i32[DmxHdr.FRAME_ID]
      if (frameId === lastFrameId) return null          // sin cambios
      this.scratch.set(this.u8)                          // snapshot atómico
      s2 = Atomics.load(this.i32, DmxHdr.SEQLOCK)
    } while (s1 !== s2)
    return { frameId: this.i32[DmxHdr.FRAME_ID], data: this.scratch }
  }
}
```

`FixtureStateWriter` / `FixtureStateReader` siguen el mismo patrón sobre `Float32Array`.

---

## 2. ARQUITECTURA MULTI-HILO (NUEVO DIAGRAMA LÓGICO)

### 2.1 Topología objetivo

```
┌──────────────────────────── MAIN PROCESS (Node/Electron) ────────────────────────────┐
│                                                                                        │
│   TitanOrchestrator (tick 44Hz)                                                        │
│        │  resuelve NodeArbiter → fixtureStates                                         │
│        ├──> FixtureStateWriter.commit()  ──┐                                           │
│        ├──> DmxUniverseWriter.commit()   ──┼── escribe en SAB (seqlock, zero-copy)     │
│        │                                   │                                           │
│        │   Trinity BETA/GAMMA (worker_threads)  ◀── SharedRingBuffer (audio, ya existe)│
│        │                                                                               │
│        └──> DeltaTruthGenerator (low-freq)  ──> MessagePort ──> Renderer (solo deltas) │
│                                                                                        │
│   ┌─ DMX WORKER (worker_thread, NUEVO — reemplaza child_process.fork) ──────────────┐  │
│   │   DmxUniverseReader.readCoherent()  ◀── DMX_UNIVERSE_SAB (mismo proceso)         │  │
│   │   serialport.write()  (bit-banging, spinWait — aislado del tick)                 │  │
│   └──────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
            │  MessageChannelMain (puente durable)         │  SAB transferido 1 vez
            ▼                                               ▼
┌──────────────────────────── RENDERER PROCESS (Chromium) ─────────────────────────────┐
│                                                                                        │
│   GlassBridge (recibe SAB + MessagePort en el boot)                                    │
│        ├──> FixtureStateReader  ──> transientStore (mutable, NO React)                  │
│        │         ▲                                                                     │
│        │         │ lectura imperativa en RAF / useFrame                                │
│        │    VisualizerCanvas 3D · TacticalCanvas pump (ya aislados)                     │
│        │                                                                               │
│        ├──> DeltaTruthReceiver ──> truthStore (Zustand, SOLO structural deltas)        │
│        │                                                                               │
│        └──> postMessage(SAB) ──> Hyperion/Theta WebWorkers (lectura directa del SAB)   │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Cambios de Worker

| Worker | Hoy | Propuesto | Justificación |
|---|---|---|---|
| **DMX** | `child_process.fork()` + pipe `number[]` | **`worker_thread`** con `DMX_UNIVERSE_SAB` vía `workerData` | Habilita zero-copy. El riesgo histórico (crash de `serialport` en worker_threads, WAVE 2021.5) se mitiga: ver §2.4. |
| **Trinity BETA** | `worker_thread` + SAB audio | Sin cambios | Ya es el modelo correcto. |
| **Hyperion Render** | Web Worker + Float32 clonado | Web Worker + lectura directa del `FIXTURE_STATE_SAB` | Elimina el clon estructural del pump. |
| **Theta** | Web Worker + SAB | Sin cambios | Ya correcto. |

### 2.3 El "Puente de Cristal": transporte Main → Renderer

**No usar `ipcRenderer.invoke()` para el SAB** (el código de Theta ya demuestra que es poco fiable). El transporte robusto es **`MessageChannelMain`** (Electron):

```typescript
// MAIN — al crear la ventana, tras 'did-finish-load'
import { MessageChannelMain } from 'electron'
const { port1, port2 } = new MessageChannelMain()
// port1 se queda en Main; port2 viaja al renderer junto con los SAB.
win.webContents.postMessage('glass:bridge-init', null, [port2])
port1.postMessage({ fixtureStateSAB, dmxMirrorSAB })   // SAB transferidos por el port
port1.start()
```

```typescript
// PRELOAD — recibe el port y lo expone al renderer
ipcRenderer.on('glass:bridge-init', (e) => {
  const [port] = e.ports
  port.onmessage = (ev) => window.dispatchEvent(
    new MessageEvent('glass:sab', { data: ev.data }))
  port.start()
})
```

`MessagePortMain.postMessage` **sí** preserva el `SharedArrayBuffer` como memoria compartida real entre procesos (a diferencia de `invoke`). El renderer lo recibe una sola vez y lo guarda; a partir de ahí, **cero IPC en el hot-path**: el Main escribe en el SAB y el renderer lee con `Atomics` en su propio RAF.

> **Requisito de entorno:** el renderer debe estar *cross-origin isolated* (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`) para que `SharedArrayBuffer` esté habilitado. El precedente de Theia confirma que SAB ya está disponible en este renderer, por lo que la cabecera ya está satisfecha o el flag `--enable-features=SharedArrayBuffer` está activo.

### 2.4 Mitigación del crash de `serialport` en `worker_threads`

El motivo original del `child_process.fork()` fue el crash del addon nativo en `worker_threads`. Plan de mitigación (validar en Fase 1 antes de comprometerse):

- **Opción A (preferida):** `worker_thread` dedicado **exclusivamente** a DMX, sin compartir el addon con el hilo main. El crash histórico venía de cargar `bindings.node` en **dos** isolates simultáneos (main + worker). Si el main **nunca** importa `serialport` y solo lo hace el worker, no hay contención de weak-references. Verificar con un spike de 30 min.
- **Opción B (fallback seguro):** mantener `child_process.fork()` pero crear el `DMX_UNIVERSE_SAB` con `new SharedArrayBuffer()` y pasarlo al child vía `child.postMessage(sab)` (Node soporta transferir SAB a child processes en v12.16+). El child lo adopta como memoria compartida real. Esto conserva el aislamiento de proceso del addon nativo **y** elimina la serialización de `number[]`.

> **Recomendación:** intentar A; si el spike crashea, caer a B (que ya cumple Pilar 1 al 100%).

---

## 3. PILAR 2 — PROTOCOLO "DELTA TRUTH" (ESTABILIDAD REFERENCIAL)

### 3.1 Reparto de responsabilidades

Tras Pilar 1, **los datos dinámicos por fixture (color/pan/tilt/dimmer) YA NO viajan por `selene:truth`** — van por el SAB. El canal `selene:truth` queda reducido a **estado estructural y semántico de baja frecuencia**: `system`, `consciousness`, `context`, `intent` (metadatos), y cambios estructurales de fixtures (alta/baja, rename, zona).

Aun así, para esos cambios, `setTruth` no debe reemplazar el objeto raíz. Introducimos el **Delta Truth**.

### 3.2 Estructura del Delta

```typescript
/** Patch plano y tipado. Cada delta toca SOLO una rama. */
export type TruthDelta =
  | { kind: 'system';        patch: Partial<SystemTruth> }
  | { kind: 'consciousness'; patch: Partial<ConsciousnessTruth> }
  | { kind: 'context';       patch: Partial<ContextTruth> }
  | { kind: 'intent';        patch: Partial<IntentTruth> }
  | { kind: 'fixture-add';   fixtures: FixtureStructural[] }
  | { kind: 'fixture-remove'; ids: string[] }
  | { kind: 'fixture-meta';  id: string; patch: Partial<FixtureStructural> }

export interface TruthDeltaBatch {
  seq: number               // monotónico; el receptor detecta huecos → pide resync
  deltas: TruthDelta[]
}
```

### 3.3 Generador en el Main (diff por rama, dirty-tracking)

```typescript
// src/core/orchestrator/tick/DeltaTruthGenerator.ts
export class DeltaTruthGenerator {
  private prev: SeleneTruth | null = null
  private seq = 0

  /** Llamado a baja frecuencia (p.ej. 7Hz). Devuelve null si nada cambió. */
  diff(next: SeleneTruth): TruthDeltaBatch | null {
    const deltas: TruthDelta[] = []
    if (!this.prev) {
      // Primer frame: full snapshot como deltas (no replace).
      deltas.push({ kind: 'system', patch: next.system })
      deltas.push({ kind: 'consciousness', patch: next.consciousness })
      // ...
    } else {
      pushIfChanged(deltas, 'system', this.prev.system, next.system)
      pushIfChanged(deltas, 'consciousness', this.prev.consciousness, next.consciousness)
      pushIfChanged(deltas, 'context', this.prev.context, next.context)
      this.diffFixtureStructure(deltas, this.prev, next)   // add/remove/meta
    }
    this.prev = next
    if (deltas.length === 0) return null
    return { seq: ++this.seq, deltas }
  }
}

/** Compara campo a campo; emite patch SOLO con las claves que cambiaron. */
function pushIfChanged<K extends TruthDelta['kind']>(
  out: TruthDelta[], kind: K, a: any, b: any,
) {
  const patch: any = {}
  let dirty = false
  for (const key in b) {
    if (a[key] !== b[key]) { patch[key] = b[key]; dirty = true }
  }
  if (dirty) out.push({ kind, patch } as TruthDelta)
}
```

El batch se envía por el `MessagePort` del Glass Bridge (o por `selene:truth` si se prefiere mantener el canal IPC, pero ahora con payload diminuto).

### 3.4 Receptor en Zustand (structural sharing — referencias intactas)

```typescript
// src/stores/truthStore.ts  (núcleo del cambio)
applyDeltas: (batch: TruthDeltaBatch) =>
  set((state) => {
    // Detección de hueco de secuencia → resync completo bajo demanda
    if (batch.seq !== state._lastSeq + 1 && state._lastSeq !== 0) {
      window.lux.requestTruthResync?.()
    }
    let truth = state.truth
    let changed = false
    for (const d of batch.deltas) {
      switch (d.kind) {
        case 'system':
          // Solo se crea un objeto NUEVO para la rama 'system'.
          // truth.consciousness, truth.context, etc. CONSERVAN su referencia.
          truth = { ...truth, system: { ...truth.system, ...d.patch } }
          changed = true
          break
        case 'consciousness':
          truth = { ...truth, consciousness: { ...truth.consciousness, ...d.patch } }
          changed = true
          break
        // ... context, intent análogos ...
        case 'fixture-add':
        case 'fixture-remove':
        case 'fixture-meta':
          truth = { ...truth, hardware: applyFixtureDelta(truth.hardware, d) }
          changed = true
          break
      }
    }
    if (!changed) return state
    return { truth, _lastSeq: batch.seq, framesReceived: state.framesReceived + 1 }
  }),
```

**Resultado clave:** si solo cambia `context.bpm`, **únicamente** `truth.context` obtiene una referencia nueva. `truth.system`, `truth.consciousness`, `truth.hardware` mantienen su identidad → `useShallow(selectHardware)` devuelve el **mismo** objeto → **cero re-render** en `DataCards`, `SystemsCheck`, `TheProgrammer`, etc.

---

## 4. PILAR 3 — SELECTORES ATÓMICOS (REGLA DE DISEÑO)

### 4.1 Las tres reglas de oro

1. **Un componente nunca suscribe a un objeto compuesto.** Suscribe a hojas primitivas (`number`, `string`, `boolean`) o a IDs.
2. **Los datos dinámicos (44Hz) NO pasan por React.** Se leen imperativamente del SAB / `transientStore` dentro de un RAF (`useFrame` de R3F o un `requestAnimationFrame` propio).
3. **`useShallow` solo se permite sobre objetos cuya identidad se preserva** vía Delta Truth (Pilar 2). Nunca sobre arrays regenerados.

### 4.2 Anti-patrón → Patrón

```typescript
// ❌ ANTES — DataCards re-renderiza a 7.3Hz
const hardware = useHardware()                 // objeto compuesto (fixtures[] nuevo)
const fixtureCount = hardware?.fixtures.length ?? 0
const energy = useAudio()?.energy ?? 0

// ✅ DESPUÉS — selectores atómicos primitivos
const fixtureCount = useTruthStore(s => s.truth.hardware.fixtureCount)  // number
const energy       = useTruthStore(s => s.truth.sensory.audio.energy)   // number
// Re-render SOLO cuando el primitivo concreto cambia de valor.
```

### 4.3 Patrón para valores de altísima frecuencia (medidores, barras)

Cuando un componente necesita mostrar un valor que cambia a 44Hz (p.ej. `MiniVisualizer`), **no** debe suscribirse a Zustand. Debe leer del SAB en su propio RAF y escribir directo al DOM/canvas:

```typescript
function useSharedMeter(read: (r: FixtureStateReader) => number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reader = getGlassBridge().fixtureReader
    let raf = 0
    const loop = () => {
      const v = read(reader)                       // lee del SAB (Atomics seqlock)
      if (ref.current) ref.current.style.height = `${v * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ref                                       // CERO re-renders de React
}
```

### 4.4 Migración por componente (de WAVE-6002)

| Componente | Hoy | Acción Pilar 3 |
|---|---|---|
| `DataCards` | `useHardware()`+`useAudio()`+`useBeat()` | → primitivos atómicos (`fixtureCount`, `energy`, `bpm`) + medidores vía SAB-RAF |
| `SystemsCheck` | `useHardware()`+`useAudio()` | → `useSharedMeter` para `MiniVisualizer`; conteos atómicos |
| `TheProgrammer` | `useHardware()` | → suscribir a `selectionStore` + leer valores del fixture seleccionado vía SAB |
| `KineticsCathedral` | `useHardware()` | → `hasMovingHeads` desde `stageStore` (estructural), no truth |
| `useFixtureData` | `useHardware()` | → estructura desde `stageStore`; dinámica desde SAB en el pump |
| `CommandDeck` | `setInterval(250ms)` | → escuchar push event-driven de `controlStore`; eliminar polling |

---

## 5. CÓDIGO CORE (snippets de referencia)

### 5.1 Instanciación de la memoria compartida (Main, al boot)

```typescript
// src/core/aether/glass/GlassMemory.ts
import { DMX_SAB_BYTES, FIX_SAB_BYTES } from './layout'

export class GlassMemory {
  readonly dmxSAB     = new SharedArrayBuffer(DMX_SAB_BYTES)
  readonly fixtureSAB = new SharedArrayBuffer(FIX_SAB_BYTES)
  readonly dmxWriter     = new DmxUniverseWriter(this.dmxSAB)
  readonly fixtureWriter = new FixtureStateWriter(this.fixtureSAB)
}

// En TitanOrchestrator (singleton, creado una vez):
this.glass = new GlassMemory()
// DMX worker_thread:
new Worker(dmxWorkerPath, { workerData: { dmxSAB: this.glass.dmxSAB } })
```

### 5.2 Hot-path del tick (Main, 44Hz) — sin JSON, sin .map()

```typescript
// TitanOrchestrator.processFrame()  — reemplaza emitHotFrame/emitFullTruth en el hot-path
const fixtureStates = this.nodeArbiter.resolve()          // ya existe
// 1) volcar estado semántico al SAB (visualizer/UI)
this.glass.fixtureWriter.commit(this.frameId, fixtureStates)
// 2) volcar DMX crudo al SAB (worker)
this.glass.dmxWriter.commitFrame(this.frameId, this.universes, this.dirtyMask)
// 3) (baja frecuencia) deltas estructurales
if (this.frameId % TRUTH_DIVIDER === 0) {
  const batch = this.deltaGen.diff(this.buildStructuralTruth())
  if (batch) this.glassPort.postMessage({ type: 'truth-delta', batch })
}
```

### 5.3 Recepción en el Renderer (boot del Glass Bridge)

```typescript
// src/renderer/glass/GlassBridge.ts
class GlassBridge {
  fixtureReader!: FixtureStateReader
  init() {
    window.addEventListener('glass:sab', (e: any) => {
      this.fixtureReader = new FixtureStateReader(e.data.fixtureStateSAB)
      // hot-path: poblar transientStore desde el SAB en RAF
      const loop = () => {
        this.fixtureReader.snapshotInto(transientRef.current)  // mutación in-place
        requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    })
    // canal de deltas estructurales → Zustand
    window.lux.onTruthDelta((batch) => useTruthStore.getState().applyDeltas(batch))
  }
}
```

### 5.4 DMX Worker (worker_thread) — consumo zero-copy

```typescript
// src/hal/drivers/strategies/dmxWorkerThread.ts
import { parentPort, workerData } from 'worker_threads'
const reader = new DmxUniverseReader(workerData.dmxSAB)
let lastFrame = -1
function outputLoop() {
  const frame = reader.readCoherent(lastFrame)
  if (frame) {
    lastFrame = frame.frameId
    // frame.data es el snapshot de 25.600 bytes; escribir solo universos dirty
    writeDirtyUniverses(frame.data)   // serialport.write + spinWait (igual que hoy)
  }
  setImmediate(outputLoop)            // pacing idéntico al openDmxWorker actual
}
```

---

## 6. ROADMAP DE IMPLEMENTACIÓN (sin romper el sistema actual)

> Estrategia: **Strangler Fig**. Cada fase deja el sistema funcional. Los SAB conviven con el IPC viejo hasta que se valida cada plano, y solo entonces se apaga el camino legacy.

### FASE 1 — Cimientos de memoria + spike de riesgo (sin tocar el hot-path)
1. Crear `src/core/aether/glass/layout.ts` (constantes y enums de §1.2).
2. Implementar y **unit-testear con Vitest** (`SharedArrayBuffer` nativo en Node) las clases `DmxUniverseWriter/Reader` y `FixtureStateWriter/Reader` con el patrón seqlock. Test de tearing concurrente.
3. **SPIKE crítico:** prototipo de `worker_thread` cargando `serialport` aislado del main. Confirmar que NO crashea (§2.4). Si crashea → adoptar Opción B (child_process + SAB). **Esta decisión bloquea la Fase 3.**
4. Establecer el `MessageChannelMain` Glass Bridge y transferir un SAB de prueba; verificar en runtime que `Atomics` ve los cambios cross-process (escribir un contador en Main, leerlo en el renderer). **Gate:** si el SAB no cruza, revisar cross-origin isolation antes de continuar.

*Estado al final: cero cambios de comportamiento; infra probada.*

### FASE 2 — Delta Truth + Selectores Atómicos (ataca los 38ms de microtasks)
5. Implementar `DeltaTruthGenerator` en Main y `applyDeltas` en `truthStore` (§3). Mantener `setTruth` legacy en paralelo tras un feature flag `USE_DELTA_TRUTH`.
6. Reducir `selene:truth` a payload estructural (quitar `fixtures[]` dinámicos del JSON — esos pasarán por SAB en Fase 3, de momento siguen por `hot-frame`).
7. Migrar los 6 componentes culpables a selectores atómicos (§4.4). Medir microtasks con el profiler antes/después.

*Estado al final: la tormenta de re-renders desaparece aun antes del SAB; la UI deja de bloquear el tick.*

### FASE 3 — Hot-path Zero-Copy del Visualizer (FIXTURE_STATE_SAB)
8. Main escribe `FixtureStateWriter.commit()` en cada tick (en paralelo a `selene:hot-frame`).
9. Renderer: `GlassBridge` puebla `transientStore` desde el SAB. Apagar `selene:hot-frame` IPC tras validar paridad visual.
10. `hyperion-render.worker` recibe el SAB por `postMessage` (una vez) y lee directo — elimina el clon de `Float32Array` del pump.

*Estado al final: el visualizer 2D/3D consume memoria compartida; el IPC de fixtures dinámicos muere.*

### FASE 4 — Hot-path Zero-Copy del DMX (DMX_UNIVERSE_SAB)
11. Según resultado del spike (paso 3): migrar el DMX a `worker_thread` (Opción A) o inyectar el SAB al `child_process` actual (Opción B).
12. Main escribe `DmxUniverseWriter.commitFrame()`; el worker consume vía `DmxUniverseReader`. Eliminar el `child.send({ channels: number[] })` y la copia byte-a-byte.
13. Escalado: subir `MAX_UNIVERSES` efectivos progresivamente (1 → 10 → 50) midiendo el peak del event loop del Main con el cardiograma existente.

*Estado al final: 50 universos @ 44Hz sin serialización en ninguna frontera caliente.*

### FASE 5 — Limpieza y blindaje
14. Eliminar código legacy (`emitHotFrame`, `setTruth` full-replace, pipe `number[]`).
15. Documentar el contrato del SAB (este blueprint → README del módulo `glass`).
16. Telemetría: exponer métricas de seqlock-retries y dirtyMask para detectar regresiones.

---

## 7. RESUMEN DE GARANTÍAS DEL DISEÑO

| Pilar | Mecanismo | Garantía |
|---|---|---|
| 1 | `SharedArrayBuffer` + seqlock (`Atomics`), DMX a `worker_thread` | Cero serialización JSON en hot-path; escritor nunca bloquea; 50 universos @ 44Hz |
| 2 | Delta Truth + structural sharing en Zustand | Ramas no modificadas conservan referencia → `useShallow` calla |
| 3 | Selectores atómicos + lectura SAB-en-RAF | React solo re-renderiza ante cambios de valores primitivos discretos |
| Puente | `MessageChannelMain` (no `invoke`) | Transferencia fiable de SAB Main↔Renderer (evita el bug conocido de Theia) |

**Riesgo residual #1:** crash de `serialport` en `worker_thread` → mitigado por spike de Fase 1 + fallback Opción B.
**Riesgo residual #2:** cross-origin isolation del renderer → ya validado por el precedente de SAB de Theia.

---

*Fin del Blueprint "Puente de Cristal". Listo para ejecución por fases.*
