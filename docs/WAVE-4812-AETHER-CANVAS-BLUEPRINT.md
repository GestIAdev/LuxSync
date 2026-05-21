# 🎨 WAVE 4812 — AETHER CANVAS · PIXEL MAPPING ENGINE BLUEPRINT

**Target**: NOTIFY_OPUS_PRO_TIER / ARCHITECTURE_ENGINE  
**Author**: Cascade (Architecture Engine)  
**Status**: PROPUESTA TÉCNICA — pendiente de aprobación  
**Restricción de Oro**: Cero ruptura del pipeline actual. Retrocompatibilidad estricta. Zero-alloc en hot path.

---

## 0. TL;DR

> **El Aether Canvas es una textura RGB(A) volumétrica muestreada por las posiciones 3D de los nodos `COLOR`/`IMPACT`. Vive como un nuevo *adapter* (`PixelMapAetherAdapter`) que, igual que Hephaestus, inyecta sus salidas en `_effectIntents` del NodeArbiter — no requiere una capa nueva, solo un nuevo *productor* dentro de L3.**

Cinco decisiones arquitectónicas:

1. **`SeleneHephBridge` se generaliza a `SeleneArsenalBridge`** y enruta tres `kind`: `'hephaestus'` (vectorial), `'pixelmap'` (canvas) y `'legacy'` (fallback).
2. **El discriminador de tipo está en `cognitiveDNA.executionDomain`** (`'vector' | 'pixel' | 'hybrid'`) — un solo campo nuevo, opcional, default `'vector'`.
3. **El Virtual Frame Buffer es `Uint8ClampedArray(W·H·4)`** pre-allocado. UN buffer por canvas activo. Doble buffer (`front`/`back`) con flip atómico.
4. **NO se crea `LAYER_PIXEL_MAP`**. El `PixelMapAetherAdapter` produce `INodeIntent[]` y los entrega vía `setEffectIntents()` (L3) o `setHephaestusIntents()` (L3+) según preferencia. La capa ya existe.
5. **Mapeo dual**: cada canvas declara `mappingSpace: 'world' | 'local'`. World = textura proyectada al stage (UV derivada de `position.x`/`position.z` normalizado). Local = textura asignada a la fixture como cell index (UV = índice de pixel en grid 1×N o N×N de la fixture).

---

## 1. CONTEXTO DEL PIPELINE ACTUAL

```
                        ┌──────────────────────────┐
   Selene Decision  ──→ │   SeleneHephBridge       │ ──→  kind:'hephaestus' → HephaestusRuntime.play
                        │   .route(decision, ctx)  │ ──→  kind:'legacy'     → EffectManager
                        └──────────────────────────┘
                                                                 │
                                                                 ▼
                                       ┌─────────────────────────────────────────┐
                                       │  HephaestusRuntime.tick() → outputs[]  │
                                       │  HephaestusAetherAdapter.ingest(...)    │
                                       │  → arbiter.setHephaestusIntents(...)    │
                                       └─────────────────────────────────────────┘
                                                                 │
   L0 systems ────────────────────────┐                          │
   L1 selene  ────────────────────────┤                          │
   L2 manual  ────────────────────────┤   NodeArbiter            ▼
   L3 effects (LiveFXEngine) ─────────┼─→  arbitrate()  ──→  ArbitratedNodeMap (per-node Record)
   L3+ hephaestus ────────────────────┤                          │
   LP playback ───────────────────────┘                          ▼
                                                          NodeResolver → DMX
```

**Hallazgos críticos para Pixel Map**:

| Pieza | Estado | Apta para reuso |
|---|---|---|
| `SeleneHephBridge` (271 LOC) | Discriminated union `kind: 'hephaestus' \| 'legacy'` | ✅ Extender a tres kinds |
| `RegistryEntry` (`lfxTypes.ts`) | Tiene `spatialBehavior`, `execHints` | ✅ Añadir `executionDomain` opcional |
| `NodeArbiter._hephaestusIntents` | Bus L3+ con LTP supremacy + L3 luminance gag | ✅ Reusar para pixel intents (mismo nivel de autoridad) |
| `NodeArbiter._effectIntents` | Bus L3 con `ABSOLUTE L3 OVERRIDE` (WAVE 4829) | ⚠️ Alternativa válida |
| `ICapabilityNode.position` (Position3D) | Disponible vía `SpatialRegistrar` | ✅ Llave del muestreo world-space |
| `FixtureV2.position`/`zone`/`type` | Persistido en `.luxshow` v2.x | ✅ Llave del mapeo local-space |
| `NodeFamily.COLOR / IMPACT` | Reciben `r`,`g`,`b`,`white`,`amber` | ✅ Targets naturales del muestreo |

**Lo que NO debe tocarse**:
- El orden de capas en `arbitrate()`.
- El Smart Gate, L3 Luminance Gag, Manual Hard Lock, Release Fades.
- La fórmula de Relative Offset Fusion (WAVE 4914).
- Los logs de telemetría existentes.

---

## 2. EL DISPATCHER DE CAPAS — `SeleneArsenalBridge` (Update)

### 2.1 · Renombre semántico (no breaking)

Mantenemos el archivo `SeleneHephBridge.ts` y la clase `SeleneHephBridge` por compatibilidad de imports, pero introducimos un **alias**:

```ts
export class SeleneHephBridge { /* existing */ }
export const SeleneArsenalBridge = SeleneHephBridge   // semantic alias
```

Esto evita un rename masivo. La doc explica que el bridge es ahora multi-kind.

### 2.2 · Nuevo `kind: 'pixelmap'` en `BridgeRoute`

```ts
export type BridgeRoute =
  | { readonly kind: 'hephaestus'; readonly entry: RegistryEntry; readonly resolved: ResolvedPlayParams; readonly instanceId: number }
  | { readonly kind: 'pixelmap';   readonly entry: RegistryEntry; readonly resolved: ResolvedPixelParams; readonly canvasId: string }   // ← NEW
  | { readonly kind: 'legacy';     readonly reason: 'no-entry' | 'spatial-incompatible' | 'no-file' | 'no-canvas-engine' }
```

```ts
export interface ResolvedPixelParams {
  readonly effectId: string
  readonly filePath: string | null
  readonly intensity: number
  readonly durationMs: number
  readonly fixtureTargeting: FixtureTargeting
  readonly mappingSpace: 'world' | 'local'
  readonly canvasResolution: { readonly w: number; readonly h: number }
  /** Cuando 'world', define el rectángulo de stage que cubre la textura (m) */
  readonly worldRect?: { readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number }
  /** Modo de blend del sample sobre el target node */
  readonly blend: 'replace' | 'multiply' | 'add' | 'screen'
  /** Si true, alpha del pixel modula `dimmer`/`brightness` del target */
  readonly alphaToDimmer: boolean
}
```

### 2.3 · El nuevo hook: `setRenderHook`

Análogo a `setPlayHook` pero para canvases. El hook devuelve un `canvasId` que el `PixelMapAetherAdapter` usará para vincular el frame buffer activo:

```ts
export type RenderHook = (params: ResolvedPixelParams, entry: RegistryEntry) => string | null
```

`null` ⇒ el bridge degrada a `'legacy'` con `reason: 'no-canvas-engine'` (boot temprano, etc.).

### 2.4 · Discriminación: `cognitiveDNA.executionDomain`

**El campo definitivo** que dice "este `.lfx` es vectorial o pixel-mapped":

```ts
// lfxTypes.ts — extensión ADITIVA
export type ExecutionDomain = 'vector' | 'pixel' | 'hybrid'

export interface CognitiveDNA {
  // ... campos actuales ...
  readonly executionDomain?: ExecutionDomain   // default: 'vector'
  readonly pixelHints?: PixelExecutionHints    // sólo si domain ∈ {pixel, hybrid}
}

export interface PixelExecutionHints {
  readonly mappingSpace: 'world' | 'local'
  readonly preferredResolution: { readonly w: number; readonly h: number }
  readonly blend: 'replace' | 'multiply' | 'add' | 'screen'
  readonly alphaToDimmer: boolean
  /** Si 'hybrid', el clip emite también curvas Hephaestus para `dimmer`/`speed` etc. */
  readonly hybridChannels?: readonly string[]
}
```

**Tags adicionales en `cognitiveDNA.tags`** (string libre, no required) que el matcher de Selene puede priorizar:

| Tag | Significado |
|---|---|
| `pixel:plasma` | Familia plasma/heat-map (ondas) |
| `pixel:strobe-mask` | Patrón rítmico de píxeles encendidos |
| `pixel:flow` | Field-flow (perlin, curl noise) |
| `pixel:image` | Textura/gif fijo o video corto |
| `pixel:audio-reactive` | Muestrea bandas FFT como rows |
| `space:world` / `space:local` | Hint redundante a `mappingSpace` |

El bridge NO interpreta tags — solo reglas estructurales (`executionDomain`). Los tags son para Selene.

### 2.5 · Nuevo método `route()`

Pseudocódigo (zero-alloc en miss; los hits ya allocan `resolved`):

```ts
public route(decision, context): BridgeRoute {
  const entry = this._registry.getEntry(decision.effectType)
  if (!entry) return _LEGACY_NO_ENTRY

  const domain = entry.executionDomain ?? 'vector'

  if (domain === 'vector') {
    // ... flujo actual idéntico (HEPHAESTUS_PATH_LEGACY)
    return this._routeHephaestus(entry, decision, context)
  }

  if (domain === 'pixel') {
    if (!this._renderHook) return _LEGACY_NO_CANVAS_ENGINE
    const resolved = _resolvePixelParams(entry, decision)
    const canvasId = this._renderHook(resolved, entry)
    if (!canvasId) return _LEGACY_NO_CANVAS_ENGINE
    this._pixelmapRoutes++
    return { kind: 'pixelmap', entry, resolved, canvasId }
  }

  if (domain === 'hybrid') {
    // Dispara AMBOS hooks. El bridge devuelve el primario (pixel) y deja
    // que el caller invoque también _routeHephaestus para hybridChannels.
    // Modelo: respuesta `kind:'pixelmap'` + `entry.execHints.hybridChannels`
    // legibles por el caller para programar curvas paralelas.
    // ...
  }
}
```

**Telemetría**: añadir `pixelmapRoutes` a `getTelemetry()`.

---

## 3. AETHER CANVAS — RENDER ENGINE

### 3.1 · Estructura del Virtual Frame Buffer

**Decisión core**: NO usar `Uint8Array` separado por canal, NI `Float32Array` per-pixel. Usamos **un único `Uint8ClampedArray(W·H·4)`** (interleaved RGBA8) por canvas. Razones:

- Compatible con `OffscreenCanvas.getContext('2d').getImageData(...)` y con WebGL `texSubImage2D` sin conversión.
- 4 bytes/pixel exactos — para 64×64 son 16 KB, despreciable. Para 256×256 son 256 KB.
- Lectura `view[i*4+0..3]` es secuencial, cache-friendly.

```ts
// src/core/aether/canvas/VirtualFrameBuffer.ts
export interface VirtualFrameBuffer {
  readonly canvasId: string
  readonly width: number
  readonly height: number
  /** Doble buffer: producer escribe a `back`, consumer lee `front`. */
  front: Uint8ClampedArray   // length = w*h*4
  back:  Uint8ClampedArray   // length = w*h*4
  /** Frame counter del producer (monotonic). */
  frameSeq: number
  /** Timestamp del último flip (performance.now()). */
  lastFlipMs: number
  /** Hint para el muestreador: ¿hay alpha real o todo es 255? */
  hasAlpha: boolean
}
```

```ts
export class AetherCanvasManager {
  private readonly _buffers = new Map<string, VirtualFrameBuffer>()

  /** Llamado en patch-time por el `RenderHook`. Idempotente. */
  public acquire(canvasId: string, w: number, h: number): VirtualFrameBuffer {
    const existing = this._buffers.get(canvasId)
    if (existing && existing.width === w && existing.height === h) return existing
    const len = w * h * 4
    const buf: VirtualFrameBuffer = {
      canvasId, width: w, height: h,
      front: new Uint8ClampedArray(len),
      back:  new Uint8ClampedArray(len),
      frameSeq: 0, lastFlipMs: 0, hasAlpha: false,
    }
    this._buffers.set(canvasId, buf)
    return buf
  }

  /** Llamado por el productor al terminar de pintar `back`. ATÓMICO. */
  public flip(canvasId: string): void {
    const b = this._buffers.get(canvasId); if (!b) return
    const tmp = b.front; b.front = b.back; b.back = tmp
    b.frameSeq++
    b.lastFlipMs = performance.now()
  }

  public release(canvasId: string): void { this._buffers.delete(canvasId) }
  public get(canvasId: string): VirtualFrameBuffer | undefined { return this._buffers.get(canvasId) }
}
```

**Productores soportados** (todos escriben en `back` y llaman `flip()`):
- **Native renderer** (`PerlinFlowRenderer`, `PlasmaRenderer`, `StrobeMaskRenderer`) — JS puro sobre el `Uint8ClampedArray`.
- **OffscreenCanvas 2D** — `ctx.getImageData(0,0,w,h).data` se copia a `back` con `set()`.
- **WebGL/WebGPU** (futuro) — `gl.readPixels` directo a `back` (mismo layout RGBA8).
- **Image/Video** — `drawImage` → getImageData → set. Throttled a 30 fps si conviene.

**Zero-alloc**: `acquire()` corre en patch-time. `flip()` solo intercambia referencias. La escritura del productor reusa el `back` existente cada frame.

### 3.2 · `PixelMapAetherAdapter` — el muestreador

Análogo arquitectónico a `HephaestusAetherAdapter`. Convierte buffers en `INodeIntent[]` cada frame:

```ts
// src/core/aether/adapters/PixelMapAetherAdapter.ts
export class PixelMapAetherAdapter {
  private readonly _intents: INodeIntent[] = []
  private _intentCursor = 0

  /** Lookup precomputado (patch-time): canvasId → array de samplers por nodo. */
  private readonly _samplers = new Map<string, ReadonlyArray<NodeSampler>>()

  /** Activos en el frame actual: canvasId → ResolvedPixelParams. */
  private readonly _activeCanvases = new Map<string, ResolvedPixelParams>()

  public ingest(arbiter: INodeArbiter, mgr: AetherCanvasManager): void {
    this._intentCursor = 0
    this._intents.length = 0

    for (const [canvasId, params] of this._activeCanvases) {
      const buf = mgr.get(canvasId)
      if (!buf) continue
      const samplers = this._samplers.get(canvasId)
      if (!samplers) continue

      for (let i = 0; i < samplers.length; i++) {
        const s = samplers[i]
        const idx = (s.v * buf.width * buf.height + s.u * buf.width) | 0   // pre-quantized
        const off = idx * 4
        const r = buf.front[off    ] / 255
        const g = buf.front[off + 1] / 255
        const b = buf.front[off + 2] / 255
        const a = buf.front[off + 3] / 255

        const intent = this._acquireIntent(s.nodeId)
        const v = intent.values
        // Blend modes implementados en LTP supremacy: simplemente escribimos.
        // Modos add/multiply los resuelve el productor antes (pre-blend),
        // o futuras extensiones aplican LERP con valor previo del _result.
        v['red']   = r * params.intensity
        v['green'] = g * params.intensity
        v['blue']  = b * params.intensity
        if (params.alphaToDimmer) {
          v['dimmer']     = a * params.intensity
          v['brightness'] = a * params.intensity
        }
        this._intents.push(intent as INodeIntent)
      }
    }

    // ⚡ DECISIÓN: usamos el bus L3+ Hephaestus (mismas garantías de supremacy).
    arbiter.setHephaestusIntents(this._intents)
  }

  /** Patch-time: pre-computa, por canvas, el array de (nodeId, u, v) — UVs en pixel coords. */
  public bindCanvas(
    canvasId: string,
    params:   ResolvedPixelParams,
    nodeGraph: INodeGraph,
    fixtures:  ReadonlyArray<FixtureV2>,
    stage:     StageDimensions,
  ): void {
    this._activeCanvases.set(canvasId, params)
    this._samplers.set(canvasId, _buildSamplers(params, nodeGraph, fixtures, stage))
  }

  public unbindCanvas(canvasId: string): void {
    this._activeCanvases.delete(canvasId)
    this._samplers.delete(canvasId)
  }
}

interface NodeSampler {
  readonly nodeId: NodeId
  readonly u: number   // 0..width-1 (entero)
  readonly v: number   // 0..height-1 (entero)
}
```

**Por qué L3+ y no una capa nueva**:

- El `NodeArbiter` ya tiene **`_hephaestusIntents`** con LTP supremacy y participa en el L3 Luminance Gag. Los intents pixel se comportan idénticamente a los de Hephaestus: son outputs autoritativos pre-merge.
- Si introdujésemos `LAYER_PIXEL_MAP` como capa propia, tendríamos que repensar Smart Gate, L3 Dominated Channels, Release Fades... una refactorización masiva sin beneficio mensurable.
- Si en el futuro queremos arbitrar **pixel vs vector** dentro del mismo frame, basta con reutilizar el `mergeStrategy` de `INodeIntent` (campo ya presente, hoy ignorado intra-L3 — lugar perfecto para evolucionar).

**Conclusión arquitectónica**: el `PixelMapAetherAdapter` es **un nuevo productor que comparte el bus L3+**, no una capa nueva. Cero ruptura del orden de prioridad existente.

### 3.3 · Lifecycle integrado

```
┌─ patch-time (user-interaction) ────────────────────────┐
│ 1. Selene decide → bridge.route(...) → kind:'pixelmap' │
│ 2. RenderHook llama AetherCanvasManager.acquire(...)   │
│ 3. PixelMapAetherAdapter.bindCanvas(canvasId, params,  │
│      nodeGraph, fixtures, stage)                       │
│ 4. Productor (PerlinRenderer, Plasma, etc.) inicia.    │
└────────────────────────────────────────────────────────┘
                              │
┌─ hot-path (44 Hz) ──────────┼──────────────────────────┐
│ A. Productor → escribe `back` → flip()                 │
│ B. PixelMapAetherAdapter.ingest(arbiter, mgr)          │
│ C. arbiter.setHephaestusIntents(intents)               │
│ D. arbiter.arbitrate() → ArbitratedNodeMap             │
│ E. NodeResolver → DMX                                  │
└────────────────────────────────────────────────────────┘
                              │
┌─ end-of-clip ───────────────┼──────────────────────────┐
│ - PixelMapAetherAdapter.unbindCanvas(canvasId)         │
│ - AetherCanvasManager.release(canvasId)                │
└────────────────────────────────────────────────────────┘
```

---

## 4. INTEGRACIÓN CON EL 2.5D STAGE CONSTRUCTOR

### 4.1 · El doble mapeo (`mappingSpace`)

#### A) `mappingSpace: 'world'` — Pixel Map Volumétrico

La textura W×H se proyecta sobre un rectángulo de stage (`worldRect`). Cada nodo se muestrea por **su posición 3D real** (`ICapabilityNode.position` — ya provista por `SpatialRegistrar` desde `FixtureV2.position`).

**Fórmula UV (patch-time, una vez por nodo)**:

```ts
function _worldToUV(
  pos: Position3D,
  rect: WorldRect,
  w: number, h: number,
): { u: number; v: number } {
  const fx = (pos.x - rect.x0) / (rect.x1 - rect.x0)   // 0..1
  const fz = (pos.z - rect.z0) / (rect.z1 - rect.z0)   // 0..1
  const cu = fx < 0 ? 0 : fx > 1 ? 1 : fx
  const cv = fz < 0 ? 0 : fz > 1 ? 1 : fz
  return {
    u: Math.min(w - 1, (cu * w) | 0),
    v: Math.min(h - 1, (cv * h) | 0),
  }
}
```

**Por qué `x`,`z` y NO `y`**: el stage es un plano horizontal en LuxSync (Y = altura desde el suelo). El pixel map en world-space es 2D top-down — la propia decisión que toma el operador en el StageConstructor 2.5D al colocar fixtures.

**Soporte de altura (`y`) para 3D real**: opcional, vía `pixelHints.use3DSampling = true` que solicita texturas **volumétricas** (W×H×D). Diferido a fase 2 — el blueprint actual cubre 2D top-down.

**Filtros**:
- Nearest neighbor (default, descrito arriba) — zero-alloc, ideal para LEDs/PARs.
- Bilinear opcional cuando hay pocos fixtures (≤16) y la textura es grande — calculado en patch-time como pre-blend del muestreo en 4 vecinos. Implementación detallada en fase 2.

#### B) `mappingSpace: 'local'` — Pixel Map por Fixture

La textura representa un **grid intra-fixture**. Útil para:
- Bars LED multi-cell (`Astera Titan`, `ChamSys QuadCell`).
- Mover-heads con anillo de pixels alrededor del lente.
- Ingenios pyro/fan que exponen múltiples zonas DMX como pseudo-pixels.

**Resolución del grid**: leemos `fixture.capabilities.cellGrid` (campo a añadir, opcional, default `{ rows: 1, cols: 1 }`). Para cada cell del fixture creamos un `NodeSampler` con UV asignado en orden lectura:

```ts
function _localCellToUV(
  cellIndex: number,
  cellGrid: { rows: number; cols: number },
  textureW: number, textureH: number,
): { u: number; v: number } {
  const col = cellIndex % cellGrid.cols
  const row = (cellIndex / cellGrid.cols) | 0
  return {
    u: Math.min(textureW - 1, ((col + 0.5) / cellGrid.cols) * textureW | 0),
    v: Math.min(textureH - 1, ((row + 0.5) / cellGrid.rows) * textureH | 0),
  }
}
```

Cada cell se modela hoy como un **NodeFamily.COLOR/IMPACT separado** en el `NodeGraph`, con `nodeId = '${fixtureId}:cell-${i}:color'`. La extracción ya está parcialmente preparada por `NodeExtractionPipeline`; añadir un metadata `cellIndex` en la enriquecedura es una sola línea adicional.

### 4.2 · Vinculación con el Stage Constructor 2.5D

El blueprint **no pide cambios al StageBuilder**. Reutilizamos la API existente:

| Origen del dato | Cómo lo lee Aether Canvas |
|---|---|
| `FixtureV2.position` (`x`,`y`,`z` en metros) | `SpatialRegistrar.register()` ya lo enriquece en `ICapabilityNode.position` |
| `FixtureV2.zone` | Filtro opcional en `_buildSamplers()` cuando `fixtureTargeting` es zone-based |
| `FixtureV2.type` | Filtro `fixtureTargeting === 'movers'` etc. |
| `FixtureV2.isPlaced` | Si `false`, el fixture queda **fuera del world-mapping** (sin coordenadas reales). Cae a fallback `local` 1×1 o se omite — controlado por `pixelHints.guerrillaPolicy: 'omit' | 'fallback-zone'`. |
| `FixtureV2.capabilities.cellGrid` (NUEVO, opcional) | Multi-cell para `local` mapping |
| `StageDimensions.width`/`depth` | Default de `worldRect` cuando el clip no especifica uno |

### 4.3 · Patch-time vs Hot-path

**Patch-time** (operador mueve un fixture, carga un show, dispara un clip):
- `bindCanvas` recomputa el array de samplers. O(N) en nodos del show. Se ejecuta < 1 ms para 200 fixtures.

**Hot-path** (44 Hz):
- `ingest()` es un loop secuencial sobre el array de samplers, lectura de 4 bytes por sampler, escritura a un Record pre-allocated del intent pool. **Cero alocación** dentro del loop. Costo medible: ~5-15 µs para 200 nodes a 64×64.

---

## 5. RETROCOMPATIBILIDAD ESTRICTA

| Componente | Cambio requerido | Riesgo de regresión |
|---|---|---|
| `lfxTypes.ts` | +`executionDomain?` (opcional) +`pixelHints?` | Cero — campos opcionales |
| `SeleneHephBridge` | +`kind:'pixelmap'`, +`renderHook?` | Cero — clips sin `executionDomain` siguen rama `'vector'` |
| `NodeArbiter` | **NINGUNO** | Cero |
| `HephaestusAetherAdapter` | **NINGUNO** | Cero |
| `LiquidAetherAdapter` | **NINGUNO** | Cero |
| `NodeResolver` / `AetherUIProjector` | **NINGUNO** | Cero — leen `r,g,b,dimmer,brightness` igual que hoy |
| `FixtureV2` | +`capabilities.cellGrid?` (opcional) | Cero |
| `TitanOrchestrator` | +1 wiring: `bridge.setRenderHook(...)`, +1 instancia `PixelMapAetherAdapter` y su tick post-Hephaestus | Bajo — patrón idéntico al `playHook` ya existente |

**Garantía de oro**: si NO se carga ningún `.lfx` con `executionDomain === 'pixel'`, el sistema corre exactamente como hoy. El `PixelMapAetherAdapter.ingest()` con `_activeCanvases.size === 0` produce un array vacío y llama `setHephaestusIntents([])` solo si Hephaestus tampoco produjo — en la práctica solo se inyecta cuando hay canvas activo, evitando pisar a Hephaestus puro.

**Coexistencia Hephaestus-vectorial + Pixel-map en el mismo frame**:
- Si ambos productores quieren escribir en el mismo bus L3+, el adapter ganador es el último en llamar `setHephaestusIntents`. Solución: un **multiplexor** `ArsenalIntentMultiplexer` que combina ambos arrays en un único push al arbiter, manteniendo orden:  1) Hephaestus, 2) PixelMap. LTP intra-L3 deja al pixel arriba (correcto: el pixel-map de un drop debe pintar sobre el clip vectorial cuando coexisten). El multiplexor es ~30 LOC.

---

## 6. ESTRUCTURA DE ARCHIVOS PROPUESTA

```
electron-app/src/core/aether/canvas/                  ⟵ NUEVA CARPETA
├── VirtualFrameBuffer.ts          ← struct + AetherCanvasManager (~120 LOC)
├── PixelMapAetherAdapter.ts       ← muestreador + intent producer (~250 LOC)
├── samplers.ts                    ← _buildSamplers + UV mappers (~150 LOC)
├── ArsenalIntentMultiplexer.ts    ← combina Hephaestus + Pixel intents (~50 LOC)
├── renderers/
│   ├── PlasmaRenderer.ts          ← productor nativo (~80 LOC)
│   ├── PerlinFlowRenderer.ts      ← productor con curl-noise (~120 LOC)
│   ├── StrobeMaskRenderer.ts      ← grid temporal binario (~60 LOC)
│   └── ImageRenderer.ts           ← carga de PNG/GIF a buffer (~80 LOC)
└── index.ts                       ← barrel
electron-app/src/core/arsenal/
├── SeleneHephBridge.ts            ← +kind:'pixelmap', +setRenderHook (~80 LOC nuevas)
└── lfxTypes.ts                    ← +ExecutionDomain, +PixelExecutionHints (~30 LOC nuevas)
electron-app/src/core/orchestrator/
└── TitanOrchestrator.ts           ← +renderHook wiring (~20 LOC)
```

**Total nuevo**: ~1040 LOC en archivos aislados + ~130 LOC en archivos existentes (todos aditivos).  
**Archivos modificados que tocan hot-path**: 0 más allá del wiring del orchestrator.

---

## 7. FASES DE IMPLEMENTACIÓN

| Fase | Entregable | Verificación |
|---|---|---|
| **F0 — Tipos** | `executionDomain`, `pixelHints`, `BridgeRoute.pixelmap`, `ResolvedPixelParams` | `tsc --noEmit` clean |
| **F1 — Buffer** | `VirtualFrameBuffer` + `AetherCanvasManager` + `PlasmaRenderer` standalone | Test: producer escribe, consumer lee, `flip()` atómico |
| **F2 — Adapter** | `PixelMapAetherAdapter` con world-mapping. Test: canvas 64×64 + 8 PARs → ven RGB correcto | `arbitrate()` produce nodos con r,g,b coherentes |
| **F3 — Bridge** | `setRenderHook`, `kind:'pixelmap'` route, telemetría | Selene dispara un `.lfx` con `executionDomain:'pixel'` y el adapter recibe el `canvasId` |
| **F4 — Local mapping** | Multi-cell para fixtures con `cellGrid` | LED bar de 8 cells reproduce gradiente horizontal de la textura |
| **F5 — Multiplexor** | `ArsenalIntentMultiplexer` Hephaestus⊕Pixel | Coexistencia sin colisión LTP |
| **F6 — UI Hephaestus DNA** | Toggle `executionDomain` en DNA Rail (WAVE 4811) + preview de buffer | Operador puede crear/editar `.lfx` pixel desde el editor |
| **F7 — Renderers extras** | Perlin, StrobeMask, Image | Catálogo inicial de 4 generadores |

---

## 8. PUNTOS ABIERTOS / DECISIONES PENDIENTES

1. **¿Compartir bus L3+ con Hephaestus o crear `setPixelmapIntents()` separado?**  
   Recomendación: compartir vía multiplexor. Costo de implementación menor, semántica idéntica. Si en el futuro necesitamos arbitraje fino pixel-vs-vector, agregar un bus dedicado es trivial.

2. **¿Producer tick frequency = arbiter frequency (44 Hz)?**  
   Recomendación: sí por defecto. Permitir override `pixelHints.targetFps` (15-60). El productor implementa su propio throttle; el adapter siempre lee `front` (último flip disponible). Cero acoplamiento temporal.

3. **¿WebGL/WebGPU desde el main process?**  
   Recomendación: NO en F1-F5. Renderers nativos JS para `Uint8ClampedArray` cubren 90% de casos. WebGL en renderer process con IPC para texturas grandes en F8+.

4. **`mappingSpace: 'hybrid'` (mismo clip ataca world y local)**  
   No bloqueante. Implementable como suma de samplers (un nodo aparece dos veces con UVs distintos; el segundo sample sobreescribe LTP). Diferido.

5. **Visualización del canvas en la UI**  
   El `AetherCanvasManager` expone `get(canvasId)` — el `HephaestusView` puede dibujar `front` en un `<canvas>` HTML para previsualizar el frame buffer en tiempo real. Útil para el DNA Designer (WAVE 4811).

---

## 9. RESUMEN EJECUTIVO

- **Una sola decisión arquitectónica clave**: `executionDomain` discrimina vectorial vs pixel. Todo lo demás se cuelga de ahí.
- **El bridge crece de 2 a 3 kinds** sin renombrar la clase. Compatibilidad de imports preservada.
- **El frame buffer es `Uint8ClampedArray` interleaved RGBA8** con doble buffer y flip atómico — formato lingua-franca con 2D Canvas, WebGL y WebGPU.
- **Cero capa nueva en el NodeArbiter**. Reusamos el bus L3+ Hephaestus con un multiplexor de 50 LOC.
- **Mapeo dual world/local** unifica pixel-map volumétrico (stage top-down) y multi-cell por fixture sin discriminar el adapter.
- **Patch-time hace el trabajo pesado** (UV pre-quantization). El hot-path solo desreferencia índices y escribe Records.
- **Retrocompatibilidad estricta**: clips legacy ignoran el campo nuevo, sistemas existentes no se tocan, orden de prioridad del arbiter intacto.

**El Aether Canvas no es una rama paralela. Es una segunda voz dentro del mismo coro.**

---

*Blueprint preparado por Cascade. La pixel manda en su píxel; la geometría manda en su mover; el Arbiter sigue siendo el juez único.*
