# HYPERION 60 BLUEPRINT — THE 4TH WORKER

> **Operación**: Hyperion Rendering Pipeline a 44Hz/60Hz  
> **Estado**: DRAFT — Pendiente aprobación de Dirección  
> **Autor**: PunkOpus  
> **Wave**: 2510  
> **Fecha**: 2026-04-12

---

## 0. RESUMEN EJECUTIVO

**Problema**: El TacticalCanvas renderiza a 60fps (RAF) pero el backend TitanOrchestrator emite `selene:truth` a solo ~13Hz (25fps tick, broadcast cada 2 frames). Efectos sub-frame como `IndustrialStrobe` (flashes de 40ms = 25Hz toggle) caen entre fotogramas del IPC. El canvas interpola con SMOOTHING_FACTOR=0.10 — suaviza pan/tilt, pero **destruye los flancos rápidos** (strobes, gobo snaps, color bumps).

**Diagnóstico**: La "Muerte Sub-Frame" no es un bug del canvas. El canvas YA corre a 60fps. El cuello de botella es el **pipeline de datos Backend→Frontend**:

```
TitanOrchestrator (25fps) → broadcast cada 2 frames (13Hz) → IPC pipe → transientStore
```

Un strobe a 25Hz necesita al menos 50Hz de refresco de datos para ser representable (Nyquist). A 13Hz de IPC, frecuencias >6.5Hz son **irrepresentables**.

**Solución propuesta**: No es solo "mover el canvas a un worker". Es una refactorización de tres capas:

1. **Subir el tick rate del broadcast** a 44Hz (1:1 con DMX Enttec nativo)
2. **Implementar un RenderWorker** con OffscreenCanvas para desacoplar el dibujo del main thread
3. **SharedArrayBuffer** como autopista de datos zero-copy entre el IPC listener y el RenderWorker

---

## 1. ARQUITECTURA ACTUAL

```
┌──────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js)                                          │
│                                                                  │
│  TitanOrchestrator ──setInterval(40ms)──► processFrame()        │
│       │                                    25fps                │
│       │ ┌──────────────┐                                        │
│       ├─┤ Brain        ├──► MusicalContext                      │
│       │ └──────────────┘                                        │
│       │ ┌──────────────┐                                        │
│       ├─┤ Engine       ├──► LightingIntent                     │
│       │ └──────────────┘                                        │
│       │ ┌──────────────┐                                        │
│       ├─┤ HAL          ├──► FixtureStates[]   ──► DMX Worker   │
│       │ └──────────────┘         │                (30Hz)        │
│       │                          │                              │
│       └──► onBroadcast(truth) ───┘                              │
│                │                                                │
│                │ mainWindow.webContents.send('selene:truth')    │
│                │ [THROTTLED: frameCount % 2 === 0 → ~13Hz]     │
│                ▼                                                │
├─────────── IPC PIPE ─────────────────────────────────────────────┤
│                                                                  │
│ RENDERER PROCESS (Chromium)                                     │
│                                                                  │
│  useSeleneTruth() ──── ipcRenderer.on('selene:truth') ──────►  │
│       │                                                         │
│       ├─► injectTransientTruth(data)  [EVERY frame ≈ 13Hz]     │
│       │       │                                                 │
│       │       ▼                                                 │
│       │   transientStore (mutable ref — zero React)             │
│       │       │                                                 │
│       │       ├──► TacticalCanvas RAF @ 60fps (lee transient)   │
│       │       └──► VisualizerCanvas useFrame @ 60fps            │
│       │                                                         │
│       ├─► setTruth(data) [Throttled ~5fps] → truthStore Zustand │
│       └─► audioStore.updateMetrics() [Throttled ~5fps]          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Workers Existentes (3)

| # | Worker | Tipo | Propósito | Comunicación |
|---|--------|------|-----------|--------------|
| 1 | **openDmxWorker** | `child_process.fork()` | DMX512 bit-banging USB serial | `process.send()` / arrays planos |
| 2 | **PhantomWorker** | `BrowserWindow({ show: false })` | Audio file decoding (FFT offline) | `ipcMain` / ArrayBuffer transfer |
| 3 | **GodEarWorker** | `child_process.fork()` | Audio FFT analysis (real-time) | `process.send()` / metrics objects |

**Ningún worker existente usa SharedArrayBuffer.**

### Framerate Chain Actual

| Componente | Frecuencia | Método | Limitante |
|-----------|-----------|--------|-----------|
| TitanOrchestrator tick | 25 fps | `setInterval(40ms)` | Budget processing |
| TitanOrchestrator broadcast | ~13 Hz | `frameCount % 2` throttle | IPC bandwidth |
| IPC `selene:truth` | ~13 Hz | Electron IPC pipe | Serialización JSON |
| transientStore inject | ~13 Hz | Mutable ref write | Limitado por IPC |
| TacticalCanvas RAF | 60 fps | `requestAnimationFrame` | Monitor VSync |
| VisualizerCanvas R3F | 60 fps | `useFrame()` Three.js | GPU budget |
| DMX output | 30 Hz | `process.hrtime` spin-wait | USB-serial chip |

**El gap crítico**: TacticalCanvas PIDE datos a 60fps pero RECIBE datos solo a 13Hz. Los 47 frames intermedios leen el mismo `transientRef.current`. La interpolación (SMOOTHING_FACTOR=0.10) suaviza la transición pero introduce ~150ms de latencia visual y destruye flancos rápidos.

---

## 2. ARQUITECTURA PROPUESTA

```
┌──────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Node.js)                                          │
│                                                                  │
│  TitanOrchestrator ──setInterval(23ms)──► processFrame()        │
│       │                                    44fps (Enttec native)│
│       │                                                         │
│       ├──► HAL.update() ──► DMX Worker (44Hz 1:1)              │
│       │                                                         │
│       └──► onBroadcast(truth) [EVERY frame — sin throttle]     │
│                │                                                │
│                │ mainWindow.webContents.send('selene:truth')    │
│                │ [44Hz — eliminado frameCount % 2]              │
│                ▼                                                │
├─────────── IPC PIPE ─────────────────────────────────────────────┤
│                                                                  │
│ RENDERER PROCESS (Chromium - Main Thread)                       │
│                                                                  │
│  useSeleneTruth() ──── ipcRenderer.on('selene:truth') ──────►  │
│       │                                                         │
│       ├─► WRITES to SharedArrayBuffer ◄────────────────────┐    │
│       │   (zero-copy fixture data: RGBA+pan+tilt+zoom)     │    │
│       │                                                    │    │
│       ├─► injectTransientTruth(data) [para VisualizerCanvas]   │
│       │                                                    │    │
│       ├─► setTruth(data) [Throttled ~5fps → truthStore]    │    │
│       └─► audioStore.updateMetrics() [Throttled ~5fps]     │    │
│                                                            │    │
│       Mouse events ──► postMessage({ type: 'INTERACTION',  │    │
│                          mouseX, mouseY, action })         │    │
│                            │                               │    │
├────────────────────────────┼───────────────────────────────│────┤
│                            │                               │    │
│ RENDER WORKER (Web Worker) — "The 4th Worker"              │    │
│                            ▼                               │    │
│  ┌──────────────────────────────────────────────────────┐  │    │
│  │ OffscreenCanvas + CanvasRenderingContext2D           │  │    │
│  │                                                      │  │    │
│  │ RAF @ 60fps (o setInterval/MessageChannel)          │  │    │
│  │   │                                                  │  │    │
│  │   ├─ READ SharedArrayBuffer ◄───────────────────────│──┘    │
│  │   │   (atomic read — zero copy, zero postMessage)   │       │
│  │   │                                                  │       │
│  │   ├─ Physics Interpolation (SMOOTHING en worker)    │       │
│  │   │                                                  │       │
│  │   ├─ renderGridLayer()                              │       │
│  │   ├─ renderZoneLayer()                              │       │
│  │   ├─ renderFixtureLayer()                           │       │
│  │   ├─ renderSelectionLayer()                         │       │
│  │   └─ renderHUDLayer()                               │       │
│  │                                                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  VisualizerCanvas (R3F) — se queda en main thread               │
│    └─ Sigue leyendo transientStore (ya funciona a 60fps)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. ANÁLISIS DE VIABILIDAD POR ÁREA

### 3.1 DESACOPLE DE REACT — OffscreenCanvas

**Viabilidad: ✅ ALTA**

El TacticalCanvas actual ya está diseñado con el patrón correcto para migrar:

- **Canvas propio**: `useRef<HTMLCanvasElement>()` — no compartido con React DOM
- **Render loop imperativo**: RAF que lee de refs/stores sin dependencias React
- **Layers puras**: Las 5 funciones de render (`renderGridLayer`, `renderZoneLayer`, `renderFixtureLayer`, `renderSelectionLayer`, `renderHUDLayer`) son **todas puras** — solo reciben `CanvasRenderingContext2D` + datos + opciones, no acceden a DOM ni React
- **Physics interpolation**: Mapa mutable local (`physicsStoreRef`) — portable sin cambios

**Método de transferencia**:
```typescript
// Main thread: en el montaje del componente TacticalCanvas
const canvas = canvasRef.current
const offscreen = canvas.transferControlToOffscreen()

// Transfer ownership al worker (irreversible — el main thread ya no puede dibujar)
worker.postMessage({ type: 'INIT', canvas: offscreen }, [offscreen])
```

**API Electron 28 (Chromium 120)**: `HTMLCanvasElement.transferControlToOffscreen()` — ✅ soportado.

**Restricción crítica**: Una vez transferido, el main thread **no puede recuperar** el canvas. Si el worker crashea, hay que destruir el `<canvas>` DOM y crear uno nuevo.

### 3.2 AUTOPISTA DE DATOS — SharedArrayBuffer

**Viabilidad: ⚠️ MEDIA — Requiere config de Electron**

#### El Problema de Cross-Origin Isolation

`SharedArrayBuffer` requiere que la página esté en modo "cross-origin isolated":
- Header `Cross-Origin-Opener-Policy: same-origin`
- Header `Cross-Origin-Embedder-Policy: require-corp`

En Electron 28 con `contextIsolation: true`, el renderer es un contexto Chromium estándar. **Sin configuración adicional, `SharedArrayBuffer` NO está disponible en el renderer.**

#### Solución para Electron

```typescript
// electron/main.ts — Inyectar headers COOP/COEP
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp'],
    },
  })
})
```

**Alternativa sin COOP/COEP**: Electron expone `app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer')` que habilita SAB sin headers. Menos correcto, pero funcional.

**Riesgo**: LuxSync carga recursos locales (`file://` o `http://localhost:5173` en dev). COEP con `require-corp` puede romper carga de assets (fuentes, imágenes) si no llevan header `Cross-Origin-Resource-Policy`. Necesita testing.

#### Layout del SharedArrayBuffer

Para 64 fixtures (máximo razonable), el buffer plano sería:

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (64 bytes)                                               │
│ [0]  frameNumber     (Uint32)     — monotonic frame counter    │
│ [4]  timestamp       (Float64)    — performance.now()          │
│ [12] fixtureCount    (Uint16)     — N fixtures activos         │
│ [14] onBeat          (Uint8)      — 0/1 flag                   │
│ [15] beatIntensity   (Uint8)      — 0-255                      │
│ [16] bpm             (Float32)    — current BPM                │
│ [20-63] reserved                                               │
├─────────────────────────────────────────────────────────────────┤
│ FIXTURE ARRAY (32 bytes × 64 fixtures = 2048 bytes)            │
│                                                                 │
│ Per fixture (32 bytes):                                         │
│  [+0]  r              (Uint8)     — Red   0-255               │
│  [+1]  g              (Uint8)     — Green 0-255               │
│  [+2]  b              (Uint8)     — Blue  0-255               │
│  [+3]  dimmer         (Uint8)     — Intensity 0-255           │
│  [+4]  physicalPan    (Float32)   — 0.0-1.0 (interpolated)    │
│  [+8]  physicalTilt   (Float32)   — 0.0-1.0 (interpolated)    │
│  [+12] zoom           (Uint8)     — 0-255                     │
│  [+13] focus          (Uint8)     — 0-255                     │
│  [+14] online         (Uint8)     — 0/1                       │
│  [+15] active         (Uint8)     — 0/1                       │
│  [+16] posX           (Float32)   — Normalized position X     │
│  [+20] posY           (Float32)   — Normalized position Y     │
│  [+24] zoneIndex      (Uint8)     — Index en ZONE_LAYOUT_2D   │
│  [+25] fixtureType    (Uint8)     — Enum: PAR/MOVING/STROBE   │
│  [+26-31] reserved                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ SELECTION BITFIELD (8 bytes = 64 bits para 64 fixtures)        │
│                                                                 │
│ Bit N = 1 si fixture N está seleccionado                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ TOTAL: 64 + 2048 + 8 = 2120 bytes                              │
│ (Aligned to 4096 for page alignment)                            │
└─────────────────────────────────────────────────────────────────┘
```

**~2KB por frame. A 44Hz = 88KB/s.** Trivial.

Sin embargo: `Atomics.store()` / `Atomics.load()` requieren `Int32Array` o `BigInt64Array` — el acceso a `Float32` no puede ser atómico. Soluciones:

1. **Double-buffer**: Dos regiones, un flag indica cuál es la activa. El writer escribe en la inactiva, luego flippea el flag atómicamente.
2. **Frame counter**: El worker compara `frameNumber` antes y después de leer. Si cambió, re-lee (optimistic concurrency).
3. **Relaxed (pragmático)**: A 44Hz de escritura y 60fps de lectura, la probabilidad de tearing parcial en un fixture individual es ~0.3%. Para rendering visual, es imperceptible. No necesitamos atomicidad perfecta — no es un sistema financiero.

**Recomendación**: Opción 3 (relaxed) para Phase 1. Si se detectan artefactos visuales, upgrade a double-buffer en Phase 2.

#### Alternativa: postMessage con Transferrable

Si SharedArrayBuffer resulta problemático por COOP/COEP:

```typescript
// Main thread: cada frame IPC
const buffer = new ArrayBuffer(2120)
const view = new DataView(buffer)
// ... llenar datos ...
worker.postMessage({ type: 'FRAME', buffer }, [buffer]) // Transfer, no copy
```

**Overhead**: ~0.1ms por frame (buffer allocation + transfer). A 44Hz = 4.4ms/s total. Aceptable.
**Ventaja**: No requiere COOP/COEP. Sin riesgo de romper carga de assets.
**Desventaja**: El main thread necesita alocar un buffer nuevo cada frame (el anterior fue transferido al worker).

**Recomendación**: Empezar con `postMessage + Transferrable` (más simple, sin config Electron). Migrar a SAB si el profiling muestra que la alocación es un problema.

### 3.3 SINCRONIZACIÓN DE RELOJES — Interpolación

**Viabilidad: ✅ ALTA**

El worker renderiza a 60fps pero recibe datos a 44Hz. Los ~16 frames intermedios (por segundo) necesitan interpolación.

**Estrategia — Exponential Smoothing (ya existente)**:

La interpolación actual del TacticalCanvas usa exactamente este patrón:
```typescript
state.pan += (target.physicalPan - state.pan) * SMOOTHING_FACTOR
```

Este código se moverá al worker sin cambios funcionales. El `physicsStoreRef` (Map mutable) se recrea dentro del worker.

**Mejora para strobes**: El SMOOTHING_FACTOR actual de 0.10 es demasiado lento para strobes.
Solución: **Adaptive smoothing** basado en velocidad de cambio:

```typescript
// Si el delta es grande (strobe: 0→255 en un frame), usar snap inmediato
const delta = Math.abs(target.dimmer - state.dimmer)
const factor = delta > SNAP_THRESHOLD ? 1.0 : SMOOTHING_FACTOR
state.dimmer += (target.dimmer - state.dimmer) * factor
```

Con `SNAP_THRESHOLD = 0.5` (50% de rango), un strobe on/off se renderizará instantáneamente en lugar de "fadearse" por la interpolación.

**Clock sync**: El worker usa `performance.now()` (disponible en workers) para calcular deltaTime. No necesita sincronizar con el reloj del main thread — ambos comparten la misma fuente de tiempo monotónico del proceso.

### 3.4 BLOQUEOS Y RIESGOS

#### RIESGO 1: VisualizerCanvas (R3F) NO puede ir a worker

**Severidad: ℹ️ INFORMATIVO — No bloquea**

React Three Fiber (`<Canvas>`) gestiona su propio WebGL context con scene graph, materials, y post-processing (NeonBloom). `@react-three/offscreen` existe pero:
- Es experimental
- No soporta OrbitControls, post-processing, ni drei helpers
- Rompería HyperionMovingHead3D (SLERP quaternions vía useFrame)

**Decisión**: VisualizerCanvas se queda en main thread. Ya funciona a 60fps leyendo de transientStore. El beneficio de mover el TacticalCanvas a worker es **liberar presión del main thread** para que R3F mantenga sus 60fps sin competir con Canvas2D.

#### RIESGO 2: Hit Testing (mouse interaction)

**Severidad: ⚠️ MEDIO — Requiere bifurcación de flujo**

Actualmente, `hitTestFixtures()` y `hitTestLasso()` se ejecutan en el RAF loop del main thread, junto con los event handlers de mouse (`handleMouseMove`, `handleMouseDown`).

Si el render loop migra al worker:
- Los eventos de mouse (`mousemove`, `mousedown`) siguen en main thread (DOM)
- El hit testing necesita las posiciones de fixtures (que ahora están en el worker)

**Solución — Hit testing en worker**:
```
Main Thread                      Worker
───────────                      ──────
mouseMove(x, y)  ──postMessage──►  hitTestFixtures(x, y, fixtures)
                 ◄──postMessage──  { hitId: 'fixture-3', distance: 2.1 }
toggleSelection('fixture-3')
```

**Latencia**: postMessage round-trip = ~0.5ms. A 60fps mouse, el hover highlight tendría 1-2 frames de lag. Imperceptible para el usuario.

**Alternativa zero-latency**: Mantener hit testing en main thread, leyendo posiciones del SharedArrayBuffer. El main thread calcula hit test, envía `selectedIds` al worker via SAB bitfield. Sin round-trip.

#### RIESGO 3: ResizeObserver y DPR

**Severidad: ⚠️ BAJO — Patrón conocido**

`ResizeObserver` es DOM API — debe quedarse en main thread. Cuando el canvas cambia de tamaño:
```typescript
// Main thread
resizeObserver.observe(canvasContainer)
// On resize:
worker.postMessage({ type: 'RESIZE', width, height, dpr: window.devicePixelRatio })
```

El worker recibe las nuevas dimensiones y ajusta su estado interno. El OffscreenCanvas se redimensiona desde el worker con `canvas.width = width * dpr; canvas.height = height * dpr`.

#### RIESGO 4: FixtureTooltip (React overlay)

**Severidad: ⚠️ BAJO — Ya desacoplado**

El `FixtureTooltip` es un componente React que se posiciona sobre el canvas con CSS `position: absolute`. No dibuja en el canvas. Se queda en main thread y se alimenta del resultado de hit testing.

#### RIESGO 5: Datos string en SharedArrayBuffer

**Severidad: ⚠️ MEDIO — Requiere diseño**

`FixtureState` contiene strings (`id`, `name`, `type`, `zone`). SharedArrayBuffer solo almacena tipos numéricos. 

**Solución**: El main thread envía la "tabla de fixtures" (estructura, nombres, IDs, zonas) una sola vez via `postMessage` cuando cambia la configuración del show. El SAB solo actualiza los campos numéricos que cambian cada frame (color, dimmer, pan, tilt, zoom).

```
postMessage (raro, ~0.1Hz):  { type: 'FIXTURE_TABLE', fixtures: [{id, name, type, zone, posX, posY}] }
SharedArrayBuffer (44Hz):     Solo campos numéricos por fixture (32 bytes × N)
```

#### RIESGO 6: Electron IPC bandwidth a 44Hz

**Severidad: ⚠️ MEDIO — Requiere medición**

Actualmente el broadcast envia un SeleneTruth completo (~10-50KB JSON) a 13Hz. A 44Hz:
- Worst case: 50KB × 44 = 2.2MB/s de JSON serialización
- Best case: 10KB × 44 = 440KB/s

`mainWindow.webContents.send()` hace structured clone (no JSON stringify). El overhead está en la travesía del Chromium IPC pipe, no en la serialización.

**Mitigación — Binary Truth Protocol**:

En lugar de enviar el SeleneTruth completo (con strings, objetos anidados, metadata que no cambia cada frame), crear un canal IPC separado solo para datos "calientes":

```typescript
// Canal rápido: solo los datos que cambian cada frame
mainWindow.webContents.send('selene:hot-frame', {
  frameNumber: number,      // 4 bytes
  onBeat: boolean,          // 1 byte
  fixtures: Float32Array,   // 32 bytes × N fixtures (flat binary)
})

// Canal lento: metadata estructural (cada 6 frames, como ahora)
mainWindow.webContents.send('selene:truth', fullSeleneTruth)
```

El canal `selene:hot-frame` llevaría los datos mínimos necesarios para rendering (~2KB) a 44Hz. El canal `selene:truth` llevaría el paquete completo a ~7Hz para alimentar el truthStore Zustand y los paneles UI.

---

## 4. LISTA DE ARCHIVOS AFECTADOS

### Archivos a MODIFICAR

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| [electron/main.ts](../../electron-app/electron/main.ts) | Añadir COOP/COEP headers (si SAB). Añadir canal `selene:hot-frame`. | BAJO — Aditivo |
| [src/core/orchestrator/TitanOrchestrator.ts](../../electron-app/src/core/orchestrator/TitanOrchestrator.ts) | Tick rate 25fps→44fps. Eliminar throttle de broadcast. Separar hot-frame de truth completo. | MEDIO — Cambia timing core |
| [src/hooks/useSeleneTruth.ts](../../electron-app/src/hooks/useSeleneTruth.ts) | Añadir listener `selene:hot-frame`. Escribir en SAB (o preparar Transferrable buffer). | MEDIO — Nuevo flujo de datos |
| [src/stores/transientStore.ts](../../electron-app/src/stores/transientStore.ts) | Mantener para VisualizerCanvas. Posible dual-write (transient + SAB). | BAJO — Aditivo |
| [src/components/hyperion/views/tactical/TacticalCanvas.tsx](../../electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx) | Reemplazar RAF loop interno por transferControlToOffscreen. Mouse events → postMessage. ResizeObserver → postMessage. | ALTO — Reescritura del core |
| [src/components/hyperion/views/HyperionView.tsx](../../electron-app/src/components/hyperion/views/HyperionView.tsx) | Gestión ciclo de vida del RenderWorker (init, crash recovery). | MEDIO |
| [electron/preload.ts](../../electron-app/electron/preload.ts) | Exponer `onHotFrame` callback en `window.lux`. | BAJO — Aditivo |

### Archivos NUEVOS a crear

| Archivo | Propósito |
|---------|-----------|
| `src/workers/hyperion-render.worker.ts` | **THE 4TH WORKER** — RAF loop, physics interpolation, render layers, hit testing |
| `src/workers/HyperionSharedBuffer.ts` | Utilidad para layout/read/write del SharedArrayBuffer (o Transferrable packing) |
| `src/workers/hyperion-render.types.ts` | Tipos compartidos entre main thread y worker (mensajes, layout SAB) |

### Archivos que NO se tocan

| Archivo | Razón |
|---------|-------|
| `src/components/hyperion/views/tactical/layers/*` | Las funciones de render son puras. Se importarán en el worker sin cambios. |
| `src/components/hyperion/views/tactical/HitTestEngine.ts` | Funciones puras. Se importarán en el worker sin cambios. |
| `src/hooks/useFixtureRender.ts` (`calculateFixtureRenderValues`) | Pura. Se importa en el worker sin cambios. |
| `src/components/hyperion/views/visualizer/*` | VisualizerCanvas se queda en main thread. Sin cambios. |
| `src/stores/audioStore.ts` | Sin cambios — main thread sigue alimentándolo a 5fps. |
| `src/stores/truthStore.ts` | Sin cambios — sigue con throttle a 5fps. |
| `src/hal/drivers/strategies/openDmxWorker.ts` | DMX Worker independiente. Sin cambios conceptuales, pero su refreshRate subirá a 44Hz. |

---

## 5. IDENTIFICACIÓN DE RIESGOS Y CUELLOS DE BOTELLA

### Riesgo Crítico

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| R1 | **CPU budget en laptop 16GB a 44Hz tick** — El TitanOrchestrator actual procesa Brain+Engine+HAL en ~15ms (25fps budget=40ms). A 44fps el budget baja a 23ms. Si un frame tarda >23ms, se acumulan (STAMPEDE GUARD rechaza frames pero pierde fidelidad). | MEDIA | ALTO | Medir p99 del `processFrame()` antes de cambiar el tick. Si p99 > 20ms, mantener 25fps tick pero subir SOLO el broadcast (pre-interpolar en main process). |
| R2 | **IPC saturation a 44Hz** — El pipe IPC de Electron tiene overhead fijo por mensaje. Multiplicar ×3 la frecuencia puede causar backpressure. | BAJA | MEDIO | Canal `selene:hot-frame` binario (~2KB) en vez de JSON completo. Medir latencia IPC antes/después. |
| R3 | **COOP/COEP rompe assets** — Habilitar Cross-Origin Isolation puede romper carga de fonts/images si no llevan el header correcto. | MEDIA | MEDIO | Testing exhaustivo con COOP/COEP habilitado. Alternativa: `postMessage + Transferrable` que no requiere isolation. |
| R4 | **Worker crash = canvas negro** — Si el RenderWorker crashea, el `<canvas>` cuyo ownership fue transferido no puede recuperarse. | BAJA | ALTO | Supervisor pattern: detectar crash, destruir el `<canvas>` DOM, crear uno nuevo, re-transferir. |
| R5 | **Refactor TacticalCanvas = regresión en interacción** — Lasso selection, fixture tooltip, y keyboard shortcuts dependen del RAF loop actual. | MEDIA | MEDIO | Tests manuales exhaustivos de toda la interacción post-migración. Mantener fallback a main-thread rendering durante desarrollo. |

### Cuellos de Botella Identificados

1. **Serialización IPC**: El bottleneck #1 del pipeline actual. `webContents.send()` hace structured clone del objeto completo. A 44Hz con un SeleneTruth de 50KB, serían ~220 structured clones/s. Se resuelve con el canal binario `hot-frame`.

2. **processFrame() budget**: El p99 del frame actual es el limiter. Si Brain o Engine tienen spikes >23ms, el tick a 44Hz no es viable sin optimización interna.

3. **GC pressure**: A 44Hz, crear un buffer Transferrable nuevo cada frame = 44 ArrayBuffer allocations/s en main thread. Son pequeños (2KB) pero se acumulan. Solución: pool de buffers reciclados.

---

## 6. PROPUESTA DE EJECUCIÓN — FASES

### PHASE 0: MEDICIÓN (Pre-requisito)

**Duración estimada: 1 sesión**

**Sin tocar código de producción.** Instrumentar y medir:

1. **p99 de processFrame()**: Añadir `performance.now()` alrededor del frame completo. Log p50/p95/p99 cada 10s.
2. **IPC latency**: Medir tiempo entre `webContents.send()` y `injectTransientTruth()` en renderer.
3. **Main thread frame budget**: Con DevTools Performance, grabar 10s de TacticalCanvas activo. ¿Cuánto tiempo libre queda después del RAF render?
4. **Verificar SAB disponibilidad**: `console.log(typeof SharedArrayBuffer)` en renderer con y sin COOP/COEP.

**Gate**: Si p99 > 20ms, PHASE 1 mantiene 25fps tick y solo sube broadcast frequency (con interpolación en el backend). Si p99 < 15ms, se puede subir el tick a 44Hz.

### PHASE 1: RenderWorker con postMessage (MVP)

**Duración estimada: 2-3 sesiones**

Implementar el worker usando `postMessage + Transferrable` (sin SharedArrayBuffer). Es el path más seguro — no requiere COOP/COEP.

1. Crear `hyperion-render.worker.ts` con el RAF loop, physics interpolation, y las 5 render layers.
2. Modificar `TacticalCanvas.tsx`:
   - En mount: `transferControlToOffscreen()` → enviar al worker
   - Mouse events: capturar en main thread, forward via `postMessage`
   - ResizeObserver: forward via `postMessage`
3. El IPC listener (`useSeleneTruth`) empaqueta los fixture data en un `ArrayBuffer` Transferrable y lo envía al worker cada frame IPC.
4. Hit testing se ejecuta en el worker: devuelve resultados via `postMessage`.
5. **Fallback flag**: Variable de entorno `LUXSYNC_RENDER_WORKER=false` para desactivar el worker y volver al RAF inline (para debug/regresión).

**Validación**: TacticalCanvas renderiza correctamente con selección, hover, lasso, tooltip, y beat pulse.

### PHASE 2: Subir Broadcast Rate a 44Hz

**Duración estimada: 1-2 sesiones**

1. Crear canal IPC `selene:hot-frame` en preload + main.
2. TitanOrchestrator: Separar broadcast en dos canales:
   - `selene:hot-frame` → cada frame (44Hz): solo fixture data binario
   - `selene:truth` → cada 6 frames (~7Hz): objeto completo para UI
3. Ajustar `openDmxWorker` refreshRate a 44Hz (solo para interfaces Enttec Pro — el Tornado se queda en 30Hz).
4. Medir: ¿la laptop mantiene 44Hz tick sin spikes?

**Validación**: IndustrialStrobe visible en TacticalCanvas sin aliasing temporal. Medir latencia end-to-end.

### PHASE 3: Adaptive Smoothing (Kill Dead Zones)

**Duración estimada: 1 sesión**

1. En el worker: implementar `SNAP_THRESHOLD` para detectar cambios bruscos (strobe on/off) y bypasear interpolación.
2. Fine-tune: `SMOOTHING_FACTOR` adaptivo basado en velocidad de cambio por canal.
3. Implementar "peak hold visual" en el worker para que un strobe flash sea visible al menos 2-3 frames gráficos aunque el dato DMX ya haya cambiado.

**Validación**: Strobes se ven como flashes definidos, no como parpadeos fantasma.

### PHASE 4: SharedArrayBuffer (Optimización)

**Duración estimada: 1-2 sesiones. OPCIONAL.**

Solo si PHASE 1 muestra que `postMessage + Transferrable` tiene overhead medible en el profiler:

1. Habilitar COOP/COEP en Electron.
2. Crear SharedArrayBuffer con el layout definido en §3.2.
3. Main thread escribe en SAB, worker lee directo.
4. Eliminar `postMessage` para fixture data — solo usarlo para eventos raros (resize, fixture table change).
5. Testing exhaustivo de asset loading con COOP/COEP.

**Gate para esta fase**: Solo ejecutar si el profiling de PHASE 1 muestra >2ms/frame gastados en postMessage serialización.

### PHASE 5: Crash Recovery y Polish

**Duración estimada: 1 sesión**

1. Supervisor pattern: detectar worker crash, recrear canvas y re-transferir.
2. Metrics overlay: FPS del worker vs FPS del main thread.
3. Quality toggle: LQ mode = worker a 30fps (ahorro de batería), HQ mode = 60fps.
4. Keyboard shortcut para toggle worker on/off (debug).
5. Documentar en README técnico.

---

## 7. DECISIONES ARQUITECTÓNICAS CLAVE

### ¿Por qué NO usar `worker_threads` (Node.js)?

LuxSync ya descubrió la respuesta: Electron 28 + worker_threads + native addons = crash (HandleScope). El openDmxWorker ya migró a `child_process.fork()` por esta razón. El RenderWorker es un **Web Worker** del renderer (Chromium), no un Node thread — es un contexto completamente diferente y seguro.

### ¿Por qué postMessage antes de SharedArrayBuffer?

1. **Cero config de Electron** — No requiere tocar headers COOP/COEP
2. **Debugging más simple** — Los mensajes son inspeccionables en DevTools
3. **Transferrable** elimina el copy — el overhead es solo la travesía del message port
4. **Upgrade path claro** — Si el profiling lo justifica, se migra a SAB sin cambiar la arquitectura

### ¿Por qué NO mover VisualizerCanvas a worker?

1. React Three Fiber requiere React reconciliation
2. OrbitControls necesita acceso a DOM events
3. Post-processing (NeonBloom) requiere WebGL context del hilo principal
4. Ya funciona a 60fps gracias al transientStore pattern
5. Mover TacticalCanvas LIBERA presión del main thread para R3F

### ¿Por qué 44Hz y no 60Hz para el tick del backend?

1. 44Hz es el rate nativo del Enttec Open DMX (la interfaz que usamos)
2. 60Hz excede el presupuesto de frame del TitanOrchestrator (~15ms processing × 60 = 900ms/s = 90% CPU solo en el engine)
3. A 44Hz, el budget es 23ms — quedan ~8ms libres para IPC overhead y GC
4. El canvas interpola de 44Hz data a 60fps visual sin artifacts (ratio 1:1.36 — suave)
5. Las interfaces USB baratas (Tornado, clones) no aguantan más de 33Hz de todos modos

### ¿Qué pasa con los effectos IndustrialStrobe a 44Hz?

Un strobe a 25Hz necesita alternar estado cada 20ms. A 44Hz de data (23ms/frame), el strobe se captura en frames alternos: encendido-apagado-encendido. A 13Hz actual, se captura en la misma posición de fase cada vez (aliasing catastrófico). **44Hz resuelve strobes ≤22Hz** (Nyquist). Para strobes más rápidos, el "peak hold visual" de PHASE 3 asegura que al menos 2-3 frames gráficos muestren el flash.

---

## 8. DIAGRAMA DE FLUJO FINAL

```
                    ┌─────────────────────────────┐
                    │     TitanOrchestrator        │
                    │     setInterval(23ms)        │
                    │         44fps tick           │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────┴──────────────────┐
                    │                              │
              selene:hot-frame (44Hz)      selene:truth (~7Hz)
              ~2KB binary fixture data      Full SeleneTruth object
                    │                              │
                    ▼                              ▼
          ┌─────────────────┐           ┌──────────────────┐
          │ useSeleneTruth  │           │  useSeleneTruth   │
          │ hot-frame       │           │  truth path       │
          │ listener        │           │                   │
          └────────┬────────┘           │  setTruth()       │
                   │                    │  audioStore()     │
                   │                    └──────────────────┘
                   │
          ┌────────┴──────────────────────────────────┐
          │                                            │
          ▼                                            ▼
  ┌───────────────────┐                    ┌─────────────────────┐
  │ postMessage/SAB   │                    │ injectTransientTruth│
  │ → RenderWorker    │                    │ → transientStore    │
  │                   │                    │                     │
  │ OffscreenCanvas   │                    │ R3F useFrame()      │
  │ 60fps RAF         │                    │ 60fps               │
  │                   │                    │                     │
  │ TacticalCanvas    │                    │ VisualizerCanvas    │
  │ (2D layers)       │                    │ (3D WebGL)          │
  └───────────────────┘                    └─────────────────────┘
```

---

## 9. CRITERIOS DE ACEPTACIÓN

La refactorización se considerará exitosa cuando:

1. **TacticalCanvas renderiza a ≥55fps sostenidos** con 32+ fixtures activos
2. **IndustrialStrobe a 20Hz es visible** como flashes discretos (no glow fantasma)
3. **Latencia click-to-highlight ≤ 50ms** (hit testing round-trip)
4. **Main thread frame budget ≥ 8ms libre** con ambos canvas activos (medido en Performance tab)
5. **Zero regresión** en: lasso selection, fixture drag, tooltip, zoom/pan, beat pulse
6. **CPU total ≤ 70%** en laptop 16GB con show activo (TitanOrchestrator + RenderWorker + R3F)
7. **Crash recovery**: Si el worker muere, el canvas se recrea en <500ms sin perder el estado de la sesión

---

## 10. NOTA FINAL

Radwulf, esto no es un parche. Es una evolución quirúrgica del pipeline de renderizado. El TacticalCanvas actual **ya está bien diseñado** — sus layers son puras, su transientStore pattern es elegante, su física es real. Lo único que falta es quitarle el cuello de botella del IPC y darle su propio hilo para correr libre.

El plan es conservador a propósito: empezamos con postMessage (cero riesgo) y solo subimos a SharedArrayBuffer si el profiling lo justifica. No over-engineeramos. No asumimos que necesitamos SAB sin datos.

La Muerte Sub-Frame se mata en PHASE 2 (44Hz broadcast) + PHASE 3 (adaptive smoothing). El worker (PHASE 1) es el prerequisito para que el main thread no se ahogue cuando le metemos 3× más datos.

Esperamos la señal para ejecutar.

— PunkOpus
