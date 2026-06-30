# WAVE 7110: AETHER BRIDGE FORENSICS

> **Operación:** Stage & Scene Player — Chronos V3 & HyperionView
> **Fecha:** 2026-06-30
> **Arquitecto:** Chief Rendering & Systems Architect
> **Doctrina:** Auditoría estricta de lectura. Cero modificaciones de código.

---

## 1. EL RENDERER (`TacticalCanvas`)

### 1.1 Ubicación del Componente

`electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx` (667 líneas)

Componente `memo` que delega **todo el renderizado** a un Web Worker dedicado (`hyperion-render.worker.ts`) vía `OffscreenCanvas`. El hilo principal solo gestiona DOM events, React state y tooltip overlay.

### 1.2 ¿De dónde lee los datos de los fixtures?

**Veredicto: Lee directamente del `SharedArrayBuffer` de Aether Glass. NO lee de Zustand/React state para datos dinámicos.**

La cadena de datos es:

```
Aether Glass SAB (Main Process)
  → glassPreload.ts: MessagePort transfiere Float32Array al renderer
    → window.glass.onFrame(callback) — suscripción en TacticalCanvas.tsx
      → packGlassFrameInto(destBuffer, glassView, fixtureCount)
        → MessageChannel.port1.postMessage({ frameData, fixtureCount, onBeat })
          → Worker: glassPort.onmessage → currentFrameData = frameData
            → RAF loop @ 60fps: unpack + physics smoothing + render 5 capas
```

**Evidencia código:**

- `TacticalCanvas.tsx:477-528` — `GLASS PIPELINE` useEffect: crea `MessageChannel`, transfiere `port2` al worker, suscribe `window.glass.onFrame()`, traduce Glass 16-float → Worker 10-float vía `packGlassFrameInto()`, postea al channel.
- `TacticalCanvas.tsx:125-143` — `packGlassFrameInto()`: zero-allocation, traduce layout Glass (`FixField` enum: 16 floats/fixture) → layout Worker (`FIXTURE_FIELD`: 10 floats/fixture).
- `hyperion-render.worker.ts:588-616` — Handler `GLASS_PORT`: recibe `MessagePort`, registra `glassPort.onmessage` que actualiza `currentFrameData`, `currentFixtureCount`, `currentFrameNumber`, `currentTimestamp`, `beatVisualEnvelope`.
- `glassPreload.ts:1-81` — Bridge Electron: `ipcRenderer.on('glass:port')` recibe `MessagePort` del Main Process. `onFrame(callback)` expone suscripción a React. `ackFrame()` devuelve el `ArrayBuffer` al Main Process (frame-drop intencional si renderer está ocupado).
- `GlassMemory.ts` + `layout.ts` — Define el SAB: `FIXTURE_STATE_SAB` = 131,200 bytes (128 KB), 2048 fixtures × 16 floats/fixture, protocolo SEQLOCK (lock-free, single-writer/multi-reader).

**Lo que SÍ lee de Zustand/React state (datos estructurales, no dinámicos):**

- `useFixtureData()` — scaffold estructural (id, x, y, type, zone, gobo, prism). Enviado al worker una sola vez vía `SCAFFOLD` message cuando cambian los fixtures.
- `useSelectionStore` — IDs seleccionados/muted. Enviados vía `SELECTION` message.
- `useStageStore` — dimensiones del escenario (para rulers y grid).

**Ruta legacy (no activa para hot-frames):**

- `useSeleneTruth.ts:205-214` — `onHotFrame` listener que inyecta en `transientStore`. Esta ruta existe para compatibilidad pero el `GLASS BYPASS` (Fase 2, WAVE 6019) la reemplazó para datos de renderizado. `GlassCanvas.tsx` aún la usa para telemetry del `transientStore` (audio bands, beat), pero NO para renderizado del TacticalCanvas.

### 1.3 Cuello de botella para migración

**No hay cuello de botella.** La migración al Aether Glass SAB está **completada** (GLASS BYPASS Fase 2). El `TacticalCanvas` ya opera con latencia cero respecto al SAB:

- Zero-allocation en traducción (`frameBufferRef` pre-asignado, reusado cada frame).
- Zero React re-renders en hot-path (todo va por `MessagePort` al worker).
- El worker interpola a 60fps independientemente de la tasa DMX (25/30/44Hz).
- `HIBERNATE` message pausa el RAF del worker cuando el canvas está CSS-hidden.

**Único residual:** El handler `FRAME` (postMessage tradicional) sigue existiendo en el worker por compatibilidad, pero no es la ruta activa.

---

## 2. EL INYECTOR (Chronos → Aether Matrix)

### 2.1 Arquitectura del Puente

Existen **dos puentes** con nombres similares pero funciones distintas:

| Bridge | Archivo | Función | Activo |
|--------|---------|---------|--------|
| `ChronosInjector` | `electron-app/src/chronos/bridge/ChronosInjector.ts` | Legacy WAVE 2002. Transforma `ChronosContext` → `ChronosOverrides` para TitanEngine (vibes, modulators, effect triggers). **No toca NodeArbiter.** | Legacy |
| `ChronosAetherAdapter` | `electron-app/src/core/aether/adapters/ChronosAetherAdapter.ts` | WAVE actual. Transforma `PlaybackFrameSnapshot` → `INodeIntent[]` → `arbiter.setPlaybackIntents()`. **Este es el puente real.** | ✅ Activo |

### 2.2 Flujo de Datos: TimelineEngine → NodeArbiter

```
Frontend (React)
  → useScenePlayer.tick() → IPC: lux:playback:tick(timeMs)
    → Main Process: TimelineEngine.tick(timeMs)
      → Evalúa FX clips (HephaestusRuntime) + Vibe clips (TitanOrchestrator)
      → Construye PlaybackFrameSnapshot { targets: [], tickMs, hasActiveVibe, vibeId }

TickEngine.ts (Step 4.5, línea 1037):
  this._chronosAetherAdapter.ingest(
    this._timelineEngine,    // fuente del snapshot
    ctx.deltaMs,
    aetherArbiter,           // destino
  )

ChronosAetherAdapter.ingest():
  1. Si !timelineEngine.isPlaying → clear(arbiter) + return
  2. snapshot = timelineEngine.getLastPlaybackFrame()
  3. Si tickMs === _lastProcessedTickMs → reusa intents (no-op)
  4. _buildPlaybackIntents(snapshot):
     - Por cada ChronosFixtureTarget en snapshot.targets:
       - nodeIds = graph.getDeviceNodes(target.fixtureId)
       - Por cada nodeId, según NodeFamily:
         · IMPACT  → _emitImpactIntent (dimmer, shutter)
         · COLOR   → _emitColorIntent (r, g, b, white)
         · KINETIC → _emitKineticIntent (pan, tilt, speed)
         · BEAM    → _emitBeamIntent (zoom)
  5. arbiter.setPlaybackIntents(this._frameIntents)
```

### 2.3 Hallazgo Crítico: `targets` está vacío en FASE 5b

**El `TimelineEngine` en FASE 5b NO popula `targets` en el `PlaybackFrameSnapshot`:**

```typescript
// TimelineEngine.ts:165-171
this._lastPlaybackFrame = {
  targets: [],          // ← VACÍO
  hasActiveVibe,
  vibeId: this.currentPlaybackVibeId,
  tickMs: timeMs,
}
```

Los FX clips se delegan a `HephaestusRuntime` (que pinta directamente vía `HephaestusAetherAdapter` en L3+), y los Vibe clips hacen handoff a `TitanOrchestrator` (L0). El `ChronosAetherAdapter` recibe un snapshot con `targets: []`, por lo que `_buildPlaybackIntents` no genera ningún intent. **El LP layer del NodeArbiter está vacío en la arquitectura actual.**

### 2.4 Mapeo de Zonas Canónicas → Nodos Físicos

El `ChronosAetherAdapter` **no mapea zonas explícitamente**. El mapeo es implícito:

1. El `ChronosFixtureTarget` contiene un `fixtureId`.
2. `this._graph.getDeviceNodes(target.fixtureId)` resuelve el `fixtureId` a sus `nodeId`s en el `INodeGraph`.
3. Cada `nodeId` ya tiene su `NodeFamily` asignada en el grafo (construido por `NodeExtractionPipeline`).
4. Las zonas canónicas (`CanonicalZone` del `ZoneLayoutEngine`) están embebidas en el `WorkerFixtureScaffold` del grafo, no en el adapter.

**Conclusión:** El mapeo zonas→nodos es responsabilidad del `INodeGraph`, no del adapter. El adapter es agnóstico a zonas — solo traduce `fixtureId` → `nodeId` → `NodeFamily` → intent.

### 2.5 Capa del NodeArbiter donde se inyecta

**Capa LP (Playback)** — entre L1 (Selene IA) y L2 (Manual overrides).

```
NodeArbiter.arbitrate() — orden de aplicación:
  L0: System intents (ImpactAdapter, ColorAdapter, KineticSystem — 'liquid-adapter-*')
  L1: Selene IA overrides (_seleneBus — 'selene_ai')
  LP: Playback intents (_playbackIntents — 'chronos')     ← ChronosAetherAdapter
  L2: Manual overrides (_manualOverrides — 'manual')       ← ProgrammerAetherBridge
  L3: Effect intents (_effectIntents — 'effect')
  L3+: Hephaestus (_hephaestusIntents — 'hephaestus')
  L4: Blackout
  Post: MANUAL HARD LOCK (L2 reafirmado post-L3)
```

Constantes del adapter:
- `LP_PRIORITY = 200`
- `LP_SOURCE: IntentSource = 'chronos'`
- `LP_CONFIDENCE = 1.0`

---

## 3. EL REPRODUCTOR DE HYPERION (El Scene Player)

### 3.1 Componente de UI

`electron-app/src/components/hyperion/controls/sidebar/SceneBrowser.tsx` (520 líneas)

Componente que gestiona:
- Importación de archivos `.lux` (drag & drop + file picker)
- Lista de escenas cargadas
- Controles de transporte (PLAY / PAUSE / STOP / LOOP)
- Barra de progreso
- Link de audio manual (WAVE 2051)

### 3.2 Flujo al soltar un archivo `.lux`

```
Usuario suelta .lux en SceneBrowser
  → handleDrop(e) — filtra .lux/.json
    → processFile(file)
      1. text = await file.text()
      2. result = await deserializeProject(text)
         → deserializeLuxV3(text) [LuxFileV3.serializer.ts]
           - JSON.parse
           - validateLuxFileV3() — type guard con $schema='luxsync.lux/3.0'
           - verifyLuxChecksum() — SHA-256 canonical
      3. project = toChronosProjectV3(result.file)
         → Hidrata LuxFileV3 → ChronosProjectV3 (runtime state efímero)
      4. newScene = { id, project, audioUrl, fileName, displayName }
      5. setScenes([...prev, newScene]) + setSelectedId
      6. await loadScene(project, audioUrl)
         → useScenePlayer.loadScene():
           a. Stop playback actual
           b. Audio setup (new Audio(audioUrl) o silent mode)
           c. api = window.lux.playback
           d. api.load(project) — IPC al Main Process
              → Main: TimelineEngine.loadProject(project)
           e. window.lux.stage.syncFixtures(fixtures) — sync stageStore → backend Arbiter
           f. setStatus({ state: 'loaded', ... })
```

### 3.3 ¿Usa `LuxFileV3.serializer.ts` o código V1/V2 legacy?

**Usa el deserializador V3.** La cadena de imports es:

```
SceneBrowser.tsx:21
  → import { deserializeProject } from '../../../../chronos/core/ChronosProject'
    → ChronosProject.ts:62
      → export { deserializeLuxV3 as deserializeProject } from './LuxFileV3.serializer'
```

`LuxFileV3.serializer.ts` es V3 puro:
- `LUX_V3_SCHEMA = 'luxsync.lux/3.0'` — discriminator hard-gate
- `canonicalStringify()` — key-sorted deterministic JSON para checksum idempotente
- `sha256Hex()` — universal (Web Crypto + Node fallback)
- `deserializeLuxV3()` — parse + validate + verify checksum
- `toChronosProjectV3()` — factory que hidrata runtime state

**No hay conversores V2→V3.** La premisa del schema V3 es: `.lux nace LIMPIA en V3, sin conversores`.

### 3.4 ¿Tiene su propio `TimelineEngine` headless?

**Sí.** El `TimelineEngine` (singleton en `electron-app/src/core/engine/TimelineEngine.ts`) corre en el **Main Process de Electron**. Es instanciado como:

```typescript
// TimelineEngine.ts:307
export const timelineEngine = new TimelineEngine()
```

El hook `useScenePlayer` es un **remote control dumb** — no ejecuta física de iluminación. Solo:

- Gestiona `<audio>` element (load, play, pause, seek)
- Ejecuta `requestAnimationFrame` clock para UI sync
- Envía `lux:playback:tick(timeMs)` al backend vía IPC (modo internal)
- WAVE 7104: Soporta modo external (ChronosEngine clock → `api.setExternalTime()`)
- Envía `lux:playback:load(project)` al cargar escena
- Envía `lux:playback:stop` al detener

**Toda la física de iluminación corre en el `TimelineEngine` del Main Process**, que delega:
- FX clips → `HephaestusRuntime` (curvas Diamond Data)
- Vibe clips → `TitanOrchestrator` (vibe handoff)
- El `TickEngine` orquesta el tick completo (44Hz) y llama a `ChronosAetherAdapter.ingest()` en Step 4.5

---

## 4. PROPUESTA ARQUITECTÓNICA (La Fusión V3)

### 4.a) Asegurar que Chronos inyecte en Capa 1 (`L1`) del `NodeArbiter`

**Estado actual:** Chronos inyecta en capa LP (entre L1 y L3). `targets: []` hace que la capa LP esté vacía en práctica.

**Pasos técnicos:**

1. **`NodeArbiter.ts`** — Añadir bus dedicado para Chronos L1:
   - Nuevo campo: `private _chronosBus: IIntentBus | null = null`
   - Nuevo método: `setChronosBus(bus: IIntentBus): void`
   - En `arbitrate()`, entre L0 y L1 (o fusionado con L1), procesar `_chronosBus`:
     ```typescript
     // L1: Selene IA + Chronos L1 (misma precedencia)
     if (this._seleneBus !== null) {
       for (let i = 0; i < this._seleneBus.count; i++)
         this._applyIntent(this._seleneBus.getAt(i), 'selene')
     }
     if (this._chronosBus !== null) {
       for (let i = 0; i < this._chronosBus.count; i++)
         this._applyIntent(this._chronosBus.getAt(i), 'chronos')
     }
     ```
   - Eliminar `_playbackIntents` y `setPlaybackIntents()` (deprecados por L1 fusion).
   - `_opaquePlaybackChannels` se renombra a `_opaqueChronosChannels` o se fusiona con `_opaqueNodeChannels`.

2. **`ChronosAetherAdapter.ts`** — Cambiar destino de inyección:
   - Reemplazar `arbiter.setPlaybackIntents(this._frameIntents)` por escritura al `_chronosBus` (zero-alloc, mismo patrón que `SeleneIntentBus`).
   - Cambiar `LP_PRIORITY = 200` → alinear con L1 (prioridad ~50-100, o usar el mismo bus que Selene con `source: 'chronos'`).
   - `LP_SOURCE` ya es `'chronos'` — mantener.

3. **`TickEngine.ts`** — Actualizar llamada:
   - `this._chronosAetherAdapter.ingest()` ahora escribe al bus L1, no al LP layer.
   - Inicialización: `arbiter.setChronosBus(this._chronosAetherAdapter.getBus())`

4. **`TimelineEngine.ts`** — Poblar `targets` (FASE 5b → FASE 6):
   - Actualmente `targets: []` porque los FX clips van a HephaestusRuntime (L3+).
   - Para que L1 tenga datos reales, el `TimelineEngine` debe evaluar curvas de clips que NO son heph-custom (vibe clips con parámetros directos, automation curves) y emitir `ChronosFixtureTarget[]` con valores de dimmer/color/pan/tilt/zoom.
   - Los heph-custom clips siguen en L3+ (HephaestusAetherAdapter) — no se mueven.

5. **Smart Gate** — `_opaqueChronosChannels` (ex `_opaquePlaybackChannels`):
   - Misma semántica: registra canales tocados por Chronos L1 para bloquear L0 en esos canales exactos.
   - L2 (manual) sigue teniendo MANUAL HARD LOCK post-L3 — el operador siempre gana.

### 4.b) Asegurar que Hyperion manual inyecte en Capa 2 (`L2`)

**Estado actual: YA ESTÁ IMPLEMENTADO.** No requiere cambios.

**Flujo confirmado:**

```
UI (TheProgrammer.tsx / DeviceCellGroup)
  → programmerStore.setCellColor(cellKey, r, g, b) / setDimmer / setPan / etc.
    → dirtyCells Set marcado
      → ProgrammerAetherBridge._flush() @ 44Hz
        → extractCellPayload() → Record<string, number> por nodeId
        → window.lux.aether.setManualOverrides(payloads) — IPC
          → AetherIPCHandlers: arbiter.setManualOverride(nodeId, channels)
            → _manualOverrides Map (L2)
```

**En `arbitrate()`:**
- L2 se aplica después de LP (líneas 630-683): escritura directa al `_result` map.
- MANUAL HARD LOCK (líneas 716-732): reafirma todos los canales L2 post-L3/L3+.
- Release Fades (líneas 787-794): interpolación ease-out al liberar overrides.

**Conclusión:** Hyperion manual ya inyecta correctamente en L2 con hard lock. No hay acción requerida.

### 4.c) Que el render visual lea pasivamente del SAB

**Estado actual: YA ESTÁ IMPLEMENTADO.** No requiere cambios.

**Flujo confirmado:**

```
Main Process: NodeResolver → FixtureStateWriter → FIXTURE_STATE_SAB (SEQLOCK)
  → glassPreload.ts: MessagePort → renderer
    → window.glass.onFrame(view: Float32Array) — TacticalCanvas suscripción
      → packGlassFrameInto(destBuffer, view, count) — zero-alloc translation
        → MessageChannel.port1 → Worker: glassPort.onmessage
          → currentFrameData = frameData
            → RAF @ 60fps: unpack + physics smoothing + render 5 capas
```

**El render es 100% pasivo:**
- No escribe al SAB (solo lee).
- No afecta el pipeline DMX (lectura unidireccional).
- Interpola a 60fps independientemente de la tasa del backend (44Hz).
- `HIBERNATE` message pausa el RAF cuando el canvas está oculto.

**Conclusión:** El render visual ya lee pasivamente del SAB. No hay acción requerida.

---

## 5. DIAGRAMA ARQUITECTÓNICO — ESTADO ACTUAL vs. PROPUESTO

### Estado Actual

```
┌─────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Electron)                                         │
│                                                                 │
│  TickEngine @ 44Hz                                              │
│  ├─ Step 1-3: L0 Systems (ImpactAdapter, ColorAdapter, etc.)   │
│  ├─ Step 4: Selene L1 (SeleneIntentBus)                         │
│  ├─ Step 4.5: ChronosAetherAdapter → setPlaybackIntents (LP)   │
│  │             ⚠ targets: [] → LP vacío en FASE 5b              │
│  ├─ Step 5: HephaestusAetherAdapter → setHephaestusIntents(L3+)│
│  │                                                                 │
│  NodeArbiter.arbitrate():                                       │
│  L0 → L1 → LP(empty) → L2(manual) → L3 → L3+ → HARD LOCK     │
│                                                                 │
│  NodeResolver → FixtureStateWriter → FIXTURE_STATE_SAB          │
│                                        ↓ SEQLOCK                │
└─────────────────────────────────────────────────────────────────┘
                                    ↓ MessagePort
┌─────────────────────────────────────────────────────────────────┐
│ RENDERER (React)                                                │
│                                                                 │
│  glassPreload.ts: window.glass.onFrame(view: Float32Array)      │
│    ↓                                                             │
│  TacticalCanvas.tsx: packGlassFrameInto() → MessageChannel      │
│    ↓                                                             │
│  hyperion-render.worker.ts: glassPort.onmessage → RAF @ 60fps   │
│    ↓                                                             │
│  OffscreenCanvas: 5 capas (Grid → Zone → Fixture → Sel → HUD)  │
│                                                                 │
│  SceneBrowser.tsx → useScenePlayer → IPC: playback.load/tick    │
│    ↓                                                             │
│  programmerStore → ProgrammerAetherBridge @ 44Hz → IPC L2       │
└─────────────────────────────────────────────────────────────────┘
```

### Propuesto (Fusión V3)

```
┌─────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (Electron)                                         │
│                                                                 │
│  TickEngine @ 44Hz                                              │
│  ├─ Step 1-3: L0 Systems (ImpactAdapter, ColorAdapter, etc.)   │
│  ├─ Step 4: Selene L1 (SeleneIntentBus)                         │
│  ├─ Step 4.5: ChronosAetherAdapter → chronosBus (L1)  ← CAMBIO │
│  │             targets: ChronosFixtureTarget[]  ← FASE 6        │
│  ├─ Step 5: HephaestusAetherAdapter → setHephaestusIntents(L3+)│
│                                                                 │
│  NodeArbiter.arbitrate():                                       │
│  L0 → L1(Selene+Chronos) → L2(manual) → L3 → L3+ → HARD LOCK│
│                                                                 │
│  NodeResolver → FixtureStateWriter → FIXTURE_STATE_SAB          │
│                                        ↓ SEQLOCK                │
└─────────────────────────────────────────────────────────────────┘
                                    ↓ MessagePort (sin cambios)
┌─────────────────────────────────────────────────────────────────┐
│ RENDERER (React)                                                │
│                                                                 │
│  TacticalCanvas: window.glass.onFrame → SAB → Worker → 60fps   │
│    (sin cambios — ya pasivo)                                    │
│                                                                 │
│  SceneBrowser → useScenePlayer → IPC: playback.load/tick        │
│  programmerStore → ProgrammerAetherBridge → IPC L2 (sin cambios)│
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. RESUMEN EJECUTIVO

| Componente | Estado | Acción Requerida |
|------------|--------|------------------|
| **TacticalCanvas → SAB** | ✅ Conectado (GLASS BYPASS Fase 2) | Ninguna |
| **Chronos → NodeArbiter (LP)** | ⚠ LP layer vacío (`targets: []`) | Migrar a L1 + poblar targets (FASE 6) |
| **Hyperion manual → L2** | ✅ Funcionando (ProgrammerAetherBridge + HARD LOCK) | Ninguna |
| **Render pasivo del SAB** | ✅ 100% pasivo (zero-alloc, 60fps) | Ninguna |
| **SceneBrowser → V3 deserializer** | ✅ Usa `deserializeLuxV3` | Ninguna |
| **ScenePlayer → TimelineEngine headless** | ✅ Main Process, IPC remote | Ninguna |
| **ChronosInjector (legacy)** | Legacy, no toca NodeArbiter | Evaluar deprecación |

**Carga de trabajo estimada para Fusión V3:**
- 4.a (Chronos L1): **Media** — requiere cambios en `NodeArbiter`, `ChronosAetherAdapter`, `TickEngine`, y `TimelineEngine` (FASE 6: poblar targets).
- 4.b (Hyperion L2): **Cero** — ya implementado.
- 4.c (Render SAB): **Cero** — ya implementado.
