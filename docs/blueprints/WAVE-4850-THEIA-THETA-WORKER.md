# 🎬 WAVE 4850 — THEIA ENGINE · THETA PHANTOM WORKER (HOLISTIC BLUEPRINT)

**Target:** NOTIFY_OPUS_PRO_TIER / ARCHITECTURE_ENGINE
**Author:** Cascade (Architecture Engine)
**Status:** PROPUESTA TÉCNICA — pendiente de aprobación
**Pieza complementaria a:** [`WAVE-4812 — Aether Canvas`](../WAVE-4812-AETHER-CANVAS-BLUEPRINT.md), [`THEIA-ANCHOR-MAP`](./THEIA-ANCHOR-MAP.md)
**Restricción de Oro:** El frame de vídeo en HDMI y los píxeles del NodeArbiter deben ser **el mismo evento físico** dentro del mismo tick de 44 Hz. Cero ruptura del pipeline existente.

---

## 0. TL;DR

> **THETA es un Phantom Worker dedicado que consume `MusicalContext` + `AudioAnalysis` desde el bus de Trinity, ejecuta una **Asset State Machine** (no un reproductor lineal), y produce un único frame de vídeo decodificado por tick. Ese frame se bifurca en dos vidas: (1) blit nativo a `TheiaOutputWindow` (HDMI / escalador LED) y (2) downscale a un `Uint8ClampedArray` que rellena el **Front Buffer del Aether Canvas** del WAVE-4812. El reloj maestro es el `FrameContext` de TitanOrchestrator: el NodeArbiter y la pantalla siempre cuentan el mismo número.**

Cinco decisiones arquitectónicas:

1. **THETA es worker `'theta'` registrado en `TrinityOrchestrator`**, comparte el patrón de BETA/GAMMA (heartbeat, Phoenix, circuit breaker), pero su payload no es audio: es **comando de Asset** + **suscripción a `FrameContext`**.
2. **Reproducción = Máquina de Estados** (`AMBIENT → BUILDUP → DROP → DECAY → AMBIENT`), nunca un seek lineal. Selene/Brain emite **AssetIntents** (intención semántica) y THETA traduce a transiciones internas con **crossfade de 1 tick** (sin frame en negro).
3. **Doble salida desde un único decode**: el frame RGBA decodificado se escribe en un **`SharedVideoFrameBuffer` (SAB)** a resolución plena para HDMI **y** se downscale en el mismo paso a un buffer mip 64×64 que se inyecta como productor del Aether Canvas (WAVE-4812 §3.1). Cero doble decode.
4. **Lock 44 Hz por contrato**: el productor (THETA) marca cada frame con `tickId` derivado del `FrameContext`. El consumidor (TheiaOutputWindow + AetherCanvasManager.flip) **solo presenta frames con tickId ≥ tick actual**. Un strobe/blackout de NodeArbiter en el tick `T` corresponde al frame de vídeo del tick `T`, no al del `T-1`.
5. **El bus de salida hacia luces ya está resuelto en WAVE-4812**: THETA no toca el NodeArbiter. Es **un productor más** del `AetherCanvasManager`. La luz que emite un LED del wall y la luz que sale por DMX están unificadas porque ambas leen el mismo frame buffer en el mismo tick.

---

## 1. ARQUITECTURA EN UNA IMAGEN

```
┌──────────────── ELECTRON MAIN PROCESS (ALPHA) ────────────────────────────────┐
│                                                                                │
│   ┌──────────────┐   AudioAnalysis    ┌──────────────┐  MusicalContext         │
│   │   BETA       │ ─────────────────▶ │   GAMMA      │ ──────────┐             │
│   │  (senses)    │                    │   (mind)     │           │             │
│   └──────────────┘                    └──────────────┘           ▼             │
│         ▲                                              ┌─────────────────┐    │
│         │  SAB audio                                   │  TrinityBrain   │    │
│         │                                              │  (EventEmitter) │    │
│         │                                              └────────┬────────┘    │
│         │                                                       │             │
│         │             ┌─────────────────────────────────────────▼──────────┐  │
│         │             │              TitanOrchestrator                     │  │
│         │             │   FrameScheduler  44Hz  →  processFrame(tickId)    │  │
│         │             │   builds FrameContext { audio, beat, context, t }  │  │
│         │             └────┬───────────────────┬──────────────────┬────────┘  │
│         │                  │                   │                  │           │
│         │                  ▼                   ▼                  ▼           │
│         │           NodeArbiter         AetherCanvasMgr     ┌──────────┐     │
│         │           (DMX path)          (WAVE-4812)         │  THETA   │     │
│         │                                  ▲                │ Phantom  │     │
│         │                                  │                │ (theia)  │     │
│         │                                  │                └────┬─────┘     │
│         │            ┌─── Aether Front Buffer (64×64 RGBA8) ─────┘           │
│         │            │      (THETA es ahora un productor más)                │
│         │            │                                                       │
│         └────────────│─── SharedVideoFrameBuffer (SAB, full-res RGBA) ──┐    │
│                      │                                                  │    │
│                      ▼                                                  ▼    │
│              ┌───────────────┐                                ┌──────────────┐│
│              │  DMX Egress   │                                │ Theia Output ││
│              │  (LiveSync)   │                                │   Window     ││
│              └───────────────┘                                │ (HDMI/LED)   ││
│                                                               └──────────────┘│
└────────────────────────────────────────────────────────────────────────────────┘
```

**Una sola fuente de verdad temporal**: `tickId` del `FrameScheduler`. Todo lo demás se subordina.

---

## 2. EL MOTOR DE ESTADOS DE VÍDEO — ASSET STATE MACHINE

### 2.1 · Concepto: el "Asset Reactivo"

Un Asset (p.ej. `tiburon.theia`, `liquid_volcano.theia`) es **un paquete declarativo** que describe varios sub-clips reactivos y las reglas de transición entre ellos:

```ts
// src/engine/theia/AssetManifest.ts
export interface TheiaAssetManifest {
  readonly assetId: string                    // 'tiburon'
  readonly version: string                    // '1.0'
  readonly resolution: { w: number; h: number }
  readonly fps: number                        // fps nativo del vídeo (24/30/60)
  readonly clips: {
    readonly ambient:  TheiaClipRef           // siempre presente, loop infinito
    readonly buildup?: TheiaClipRef           // 1..N segundos, loopable
    readonly drop?:    TheiaClipRef           // one-shot, 1..16 beats
    readonly decay?:   TheiaClipRef           // wind-down, loopable corto
    readonly oneShots?: ReadonlyArray<TheiaClipRef> // eventos puntuales (kick, snare hit)
  }
  readonly transitions: TransitionPolicy     // ver §2.3
  readonly syncPolicy: SyncPolicy            // ver §3
  readonly pixelHints?: PixelExecutionHints  // forwardea a WAVE-4812
}

export interface TheiaClipRef {
  readonly file: string                       // ruta absoluta o relativa al asset bundle
  readonly inMs: number                       // marca de inicio dentro del fichero
  readonly outMs: number                      // marca de fin
  readonly loopable: boolean
  readonly anchorBeat?: 'downbeat' | 'any' | 'sub-8'  // punto de ataque musical
  readonly tags?: ReadonlyArray<string>       // 'energy:high', 'mood:dark'…
}
```

**Por qué no es un reproductor lineal**: Selene piensa en intenciones (*"el track va a hacer drop"*), no en time-codes. THETA expone un verbo, no un slider.

### 2.2 · Estados internos

```
                ┌────────────────────────────────────┐
                │              IDLE                  │
                │   (no asset cargado)               │
                └─────────────────┬──────────────────┘
                                  │ LOAD(assetId)
                                  ▼
                ┌────────────────────────────────────┐
                │           PRELOADING               │
                │  decoder warm-up, GOP cache build  │
                └─────────────────┬──────────────────┘
                                  │ ready
                                  ▼
       ┌──────────────────────────┴──────────────────────────┐
       │                       AMBIENT  ◄────────────────┐   │
       │    loop infinito de clips.ambient                │   │
       └──┬─────────────────┬──────────────────┬─────────┘   │
          │ PLAY('buildup') │ PLAY('drop')     │ ONESHOT(id) │
          ▼                 │                  │             │
       BUILDUP              │                  │             │
          │ (auto al final  │                  │             │
          │   o por intent) │                  │             │
          ▼                 ▼                  ▼             │
        DROP ────► DECAY ───┴──────────────────┴─────────────┘
```

**Reglas duras**:
- **AMBIENT es el único estado terminal** (siempre se vuelve a él). Garantiza que nunca hay frame en negro.
- **DROP es one-shot**: no acepta interrupciones por otro DROP hasta finalizar (configurable por `transitions.dropPolicy`).
- **ONESHOT** se compone *encima* del estado actual (overlay alpha) sin cambiar la máquina.
- Toda transición pasa por **CrossfadeUnit** (§2.4) — nunca corte duro a menos que el manifest declare `crossfadeMs: 0`.

### 2.3 · `AssetIntent` — el verbo que envía el Brain

```ts
// src/engine/theia/AssetIntent.ts
export type AssetIntent =
  | { kind: 'load';     assetId: string }
  | { kind: 'unload' }
  | { kind: 'play';     state: 'ambient' | 'buildup' | 'drop' | 'decay'; reason?: string }
  | { kind: 'oneshot';  shotId: string;  alpha?: number; durationOverrideMs?: number }
  | { kind: 'modulate'; speed?: number;  brightness?: number; saturation?: number }   // FX rail
  | { kind: 'reset' }                                              // vuelve a AMBIENT
```

**Productores de intents**:
1. **TrinityBrain (Selene)** — derivado de `MusicalContext.section.type`:
   - `intro`/`verse` → `play('ambient')`
   - `pre-chorus`/`buildup` (con `narrative.buildupScore > 0.6`) → `play('buildup')`
   - `chorus`/`drop` (sección con `isTransition` && `energy > 0.75`) → `play('drop')`
   - `outro`/`break` → `play('decay')` y luego `reset`
2. **Beat Detector** — `audio.kickDetected` con `audio.beatStrength > 0.85` puede emitir `oneshot('kick-impact')` si el manifest lo registra.
3. **Manual UI** — botones de operador en el editor de show envían intents directos.
4. **Hephaestus Curve** (futuro) — un curve `theia.intent` puede dispararlos desde la timeline (WAVE 4812 hybridChannels-friendly).

### 2.4 · `CrossfadeUnit` — el órgano que evita el corte en negro

THETA mantiene **dos pipelines de decode paralelos** (`primary` y `secondary`). Una transición funciona así:

```
t=0:        primary = AMBIENT   secondary = (vacío)
t=intent:   secondary = decode_init(BUILDUP, anchorBeat=downbeat)
            ↳ espera al próximo downbeat según FrameContext.beatPhase
t=anchor:   crossfade.start(durationTicks = 22)   // ~500ms a 44Hz
            cada tick:
              outFrame = lerp(primary.frame, secondary.frame, t/22)
            secondary se convierte en primary cuando t == 22
            primary anterior libera GOP cache.
```

**Ventajas**:
- Cero frame en negro.
- Anclaje musical por `anchorBeat`: la transición pega en `downbeat` no en wall-clock.
- Latencia mínima: el GOP del clip secundario se pre-warms en el momento de `intent`, no de `anchor`.

```ts
// src/engine/theia/CrossfadeUnit.ts
export class CrossfadeUnit {
  private _state: 'idle' | 'pending-anchor' | 'running' = 'idle'
  private _ticksRemaining = 0
  private _ticksTotal = 0
  private _curve: 'linear' | 'easeInOut' | 'cosine' = 'easeInOut'

  start(totalTicks: number, curve: 'linear' | 'easeInOut' | 'cosine'): void { /* ... */ }
  /** Llamado cada tick. Devuelve [alphaPrimary, alphaSecondary] ∈ [0,1]². */
  step(): [number, number] { /* ... */ }
  isDone(): boolean { return this._state === 'idle' }
}
```

### 2.5 · IPC: el canal `THEIA_INTENT`

Extensión de `WorkerProtocol`:

```ts
// src/workers/WorkerProtocol.ts (aditivo)
export enum MessageType {
  // ... existing
  THEIA_INTENT,           // ALPHA → THETA
  THEIA_STATE_REPORT,     // THETA → ALPHA
  THEIA_ASSET_LOADED,     // THETA → ALPHA
  THEIA_FRAME_READY,      // THETA → ALPHA (ligero, solo notifica tickId producido)
  THEIA_DECODE_ERROR,     // THETA → ALPHA
}

export interface TheiaIntentMessage {
  readonly intent: AssetIntent
  readonly issuedAtTick: number
}

export interface TheiaStateReport {
  readonly state: 'idle' | 'preloading' | 'ambient' | 'buildup' | 'drop' | 'decay'
  readonly currentAssetId: string | null
  readonly secondaryActive: boolean
  readonly crossfadeProgress: number  // 0..1
  readonly droppedFrames: number
  readonly decoderHealth: 'green' | 'yellow' | 'red'
}
```

**Política de back-pressure**: si THETA reporta `decoderHealth === 'red'` durante > 3 ticks, el orchestrator congela nuevos `play('drop')` durante 1s y emite log `[THEIA][CIRCUIT-OPEN]`.

---

## 3. DOBLE RENDERIZADO — TWIN OUTPUT PIPELINE

Un solo decode → dos consumidores. Esto es el corazón de la propuesta.

### 3.1 · El pipeline interno por frame

```
┌─ THETA worker ─ tick T ─────────────────────────────────────────────────┐
│                                                                          │
│ 1. read(FrameContext_T)  // tickId, beatPhase, energy, sectionType…      │
│ 2. assetSM.advance(intents_T)                                            │
│ 3. decoder.requestFrame(targetPts_T)                                     │
│ 4. crossfade.step()  → [αP, αS]                                          │
│ 5. blendInto(scratchFull[w·h·4], primary, secondary, αP, αS)             │
│                                                                          │
│ 6. ── BIFURCACIÓN ──                                                     │
│                                                                          │
│   (a) HDMI path                          (b) LED path                    │
│   ─────────────────                      ──────────────                   │
│   sharedFullBuf.write(scratchFull,       downscale(scratchFull → 64×64) │
│                       tickId=T)          aetherFrontBuf.write(           │
│   atomicSetFrameSeq(T)                       scratchSmall, tickId=T)     │
│                                                                          │
│ 7. postMessage({ THEIA_FRAME_READY, tickId: T })                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 · Output 1 — HDMI / LED Wall (`SharedVideoFrameBuffer`)

Un nuevo SAB, gemelo arquitectónico del `SharedRingBuffer` de audio.

```ts
// src/core/theia/SharedVideoFrameBuffer.ts
/**
 * SPSC. Producer = THETA worker. Consumer = TheiaOutputWindow renderer.
 * Layout (todo en un solo SharedArrayBuffer):
 *   [Int32Array meta] : [width, height, channels, fps,
 *                        producerTickId, consumerTickId,
 *                        producerSeq, consumerSeq,
 *                        flags, droppedFrames]
 *   [Uint8Array data] : RGBA8 interleaved, length = w*h*4 (o 2 slots para triple buffer)
 */
export const VIDEO_META_FIELDS = 10 as const
export const META_TICK_PRODUCER = 4 as const
export const META_TICK_CONSUMER = 5 as const
// …

export class SharedVideoFrameBuffer {
  static allocate(w: number, h: number, slots: 2 | 3 = 2): SharedVideoFrameBuffer { /* … */ }
  writeFrame(rgba: Uint8ClampedArray, tickId: number): void { /* Atomics.store */ }
  readLatestForTick(tickId: number): { data: Uint8ClampedArray; producedTick: number } | null
}
```

**Triple buffering opcional**: si la ventana HDMI corre a 60 Hz y el motor a 44 Hz, tres slots evitan tearing — el consumidor toma el slot más reciente con `producerTickId ≤ tickActualUI`.

**Ventana HDMI** (`TheiaOutputWindow`): proceso renderer dedicado, frameless, fullscreen en `screen.getAllDisplays()[1]`. Su `requestAnimationFrame` blittea directamente a `<canvas>` con `putImageData` o WebGL `texSubImage2D` si la GPU está disponible.

### 3.3 · Output 2 — Aether Canvas Front Buffer (WAVE-4812)

THETA actúa como un **renderer extra** en la lista de productores del WAVE-4812 §3.1. La interfaz que ya define ese blueprint:

```ts
// src/core/aether/canvas/renderers/TheiaVideoRenderer.ts (NUEVO)
export class TheiaVideoRenderer implements ICanvasProducer {
  constructor(
    private readonly _mgr: AetherCanvasManager,
    private readonly _canvasId: string,        // ej. 'theia:active'
  ) {}

  /** Llamado en hot-path por TitanOrchestrator después del decode de THETA. */
  public ingestDownscaledFrame(small: Uint8ClampedArray, tickId: number): void {
    const buf = this._mgr.get(this._canvasId)
    if (!buf) return
    buf.back.set(small)               // 64*64*4 = 16 KB, una llamada nativa
    buf.hasAlpha = false              // vídeo siempre opaco salvo overlays
    this._mgr.flip(this._canvasId)    // atomic
    // frameSeq y lastFlipMs los actualiza el manager
  }
}
```

**Por qué 64×64 y no la resolución nativa**:
- El `PixelMapAetherAdapter` de WAVE-4812 hace nearest-neighbor sampling sobre los UVs precomputados de los nodos. Para 200 fixtures a 44 Hz, 64×64 da resolución de sobra (un nodo ocupa <0.5% de la textura) y costo ~16 KB/frame de memoria.
- Para LED walls de píxeles direccionables, una segunda instancia con `mappingSpace: 'local'` y resolución mayor (256×128, p.ej.) es trivial: basta otro slot del manager.

**Coexistencia con `mappingSpace`**:
- `'world'`: el frame de vídeo se proyecta sobre el rectángulo de stage que el operador haya definido. Resultado: una rave en la que las luces pintan la sombra del tiburón sobre la pista.
- `'local'`: cada cell de un LED bar lee un píxel del vídeo. Resultado: el bar se convierte en una tira del frame original.

### 3.4 · El downscale: `BoxFilterMip`

Algoritmo: average-pool 2×2 iterativo hasta llegar a 64×64. SIMD-friendly, sin allocaciones. Implementación de referencia:

```ts
// src/core/theia/downscale.ts
/** Reduce src (W×H RGBA8) into dst (w×h RGBA8). Asume w/h | W/H. */
export function boxDownscale(
  src: Uint8ClampedArray, srcW: number, srcH: number,
  dst: Uint8ClampedArray, dstW: number, dstH: number,
): void {
  const ratioX = (srcW / dstW) | 0
  const ratioY = (srcH / dstH) | 0
  const inv = 1 / (ratioX * ratioY)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      let r = 0, g = 0, b = 0
      const sx0 = x * ratioX, sy0 = y * ratioY
      for (let dy = 0; dy < ratioY; dy++) {
        const row = (sy0 + dy) * srcW
        for (let dx = 0; dx < ratioX; dx++) {
          const off = (row + sx0 + dx) << 2
          r += src[off]; g += src[off + 1]; b += src[off + 2]
        }
      }
      const o = (y * dstW + x) << 2
      dst[o    ] = (r * inv) | 0
      dst[o + 1] = (g * inv) | 0
      dst[o + 2] = (b * inv) | 0
      dst[o + 3] = 255
    }
  }
}
```

**Coste medido aproximado** (1920×1080 → 64×64): ~1.2 ms en V8 sin SIMD. Para 1280×720 → 64×64: ~0.6 ms. Margen amplio dentro de los 23 ms del tick. **Si fuese necesario**, mover este paso a un `OffscreenCanvas` con `drawImage(video, 0, 0, 64, 64)` lo deja en <0.2 ms gracias a la GPU del compositor.

### 3.5 · Decoder backend (cuestión abierta, recomendación)

| Backend | Pros | Contras |
|---|---|---|
| **WebCodecs API** (renderer process) | GPU-accel, zero-copy a canvas, estándar W3C | No disponible en main; THETA tendría que vivir en un renderer headless |
| **ffmpeg-static + fluent-ffmpeg** | Funciona en main, control total | Spawnea proceso, IPC pesado, no GPU |
| **Native addon (`node-ffmpeg-libav`)** | GPU-accel HW (NVENC/QSV/VAAPI), in-process | Build complejo, dependencia nativa |
| **`<video>` element en hidden BrowserWindow** | Trivial, GPU-accel via Chromium | THETA pasa a ser un Worker controlador, decode en otro proceso |

**Recomendación F1-F3**: hidden `BrowserWindow` con `<video>` como decoder, controlado por THETA vía IPC. F4+: evaluar WebCodecs en ese mismo BrowserWindow para zero-copy.

Esta decisión NO afecta el blueprint: la interfaz `ITheiaDecoder.requestFrame(pts) → Promise<RGBAFrame>` aísla el backend.

---

## 4. SINCRONIZACIÓN DE RELOJ — 44 HZ LOCK

Esta es la sección no-negociable. **Si esto falla, el blueprint falla.**

### 4.1 · El contrato

> Para todo tick `T` en el `FrameScheduler`, **el frame de vídeo presentado en HDMI y el frame leído por el `PixelMapAetherAdapter` deben provenir del mismo `tickId = T`**, y deben corresponder a la misma decisión del NodeArbiter para `T` (mismo blackout, mismo strobe, misma intensidad).

### 4.2 · Inversión del flujo: THETA escucha el reloj, no lo dicta

THETA **no decide cuándo es el siguiente frame** — el `FrameScheduler` del main process sí. La cadena en cada tick:

```
TitanOrchestrator.processFrame(tick = T):
  1. brain.getCurrentContext()
  2. compute FrameContext_T = { tickId: T, audio, beat, context, time }
  3. shareFrameContext(T)             // ← escribe FrameContext en SAB de control
  4. trinityOrchestrator.notifyTick(T) // postMessage → BETA, GAMMA, THETA
  5. engine.update(FrameContext_T)
  6. arbiter.arbitrate()              // ← aquí ya conoce blackout/strobe para T
  7. egress.write(...)
  8. UIProjector.draw()               // ya con el mismo FrameContext_T
```

THETA, al recibir el ping del paso 4:
1. Lee `FrameContext_T` desde el SAB de control.
2. Calcula `targetPts = T * (1000/44) * speedFactor + assetOffset`.
3. Pide al decoder el frame de ese pts.
4. Mezcla con secondary si hay crossfade.
5. Escribe en `SharedVideoFrameBuffer` con `producerTickId = T`.
6. Escribe el downscale en `aetherCanvas.back` y `flip(canvasId)`.
7. Notifica `THEIA_FRAME_READY(T)`.

### 4.3 · El SAB de control: `FrameContextRing`

Un nuevo SAB pequeño, broadcast del main hacia todos los workers. **Contenido por slot**:

```ts
// src/core/orchestrator/FrameContextRing.ts
export interface FrameContextSlot {
  tickId: number              // monotonic
  emittedAtMs: number
  bpm: number
  beatPhase: number           // 0..1
  onBeat: 0 | 1
  energy: number
  bass: number; mid: number; treble: number
  sectionType: number         // enum: intro=0, verse=1, chorus=2, drop=3…
  flags: number               // bit 0 = blackout, bit 1 = strobe, bit 2 = blind
  reserved: number
}
```

- 16 ints por slot, 64 bytes. Ring de 64 slots → 4 KB. SAB minúsculo.
- Producer único: TitanOrchestrator (paso 3 de §4.2).
- Consumers: BETA (opcional), GAMMA (opcional), THETA (obligatorio), futuros.
- Lectura sin bloqueo: cada consumer guarda su propio `lastReadTick` y avanza; nunca espera.

**Bit `flags`**: si `blackout` está activo, THETA puede optar por seguir decodificando pero escribir **frame negro** al `SharedVideoFrameBuffer` y al downscale. Cero fuga visual de vídeo durante un blackout legal del Arbiter.

### 4.4 · Política de drift (quién manda cuando hay desincronización)

| Caso | Quién gana | Acción |
|---|---|---|
| THETA llega tarde (no terminó frame T cuando llegó tick T+1) | **Arbiter manda** | TheiaOutputWindow muestra frame T-1; PixelMapAetherAdapter lee el front anterior; `droppedFrames++`. Nunca se retrasa el motor. |
| Decoder devuelve frame con pts > targetPts (resync) | **Arbiter manda** | THETA hace `decoder.seek(targetPts)`. |
| Crossfade pendiente de `anchorBeat` y `beatPhase` no llega a 0 en N ticks (audio mudo) | **Anchor opcional** | Tras `anchorTimeoutTicks` (default 88 ≈ 2 s), arranca sin anclaje. Log warn. |
| Blackout/strobe del Arbiter | **Arbiter manda** | THETA lee `flags`. Strobe gating: presenta frame negro en ticks pares, frame normal en impares (o viceversa según fase). |

**Dogma**: el motor no se desacelera por el vídeo. El vídeo se subordina, jamás bloquea el tick.

### 4.5 · Strobe sincronizado, demostración

Un strobe del NodeArbiter a 16 Hz funciona porque el `LiveFXEngine` modula el dimmer/intensidad a esa frecuencia dentro del tick. Para que la pantalla LED parpadee **en el mismo flanco**, basta que THETA lea el bit `strobe` del `flags` y multiplique todo el frame downscaled por la fase del strobe **antes** del `flip()`. Como el adapter de WAVE-4812 lee `front` en el mismo tick T, los DMX y los píxeles del LED salen a oscuras o iluminados a la vez. El "flash" es un único evento físico distribuido.

---

## 5. INTEGRACIÓN CON WAVE-4812 (PIXEL MAPPING)

THETA es ortogonal al `SeleneArsenalBridge`. Existen dos caminos no excluyentes:

### 5.1 · Camino A — Asset-as-Effect (preferido)

El `.theia` se registra como entrada del `AssetRegistry` con `cognitiveDNA.executionDomain = 'pixel'` y `pixelHints` declarados. Selene dispara como cualquier `.lfx` y el `RenderHook` de WAVE-4812 §2.3 retorna el `canvasId` del `theia:active`.

```ts
// Inside TitanOrchestrator init
const theiaRenderer = new TheiaVideoRenderer(canvasMgr, 'theia:active')
trinityOrchestrator.onTheiaFrame((tickId, smallBuf) => {
  theiaRenderer.ingestDownscaledFrame(smallBuf, tickId)
})

bridge.setRenderHook((params, entry) => {
  if (entry.executionDomain !== 'pixel') return null
  if (entry.theiaAssetId) {
    trinityOrchestrator.sendTheiaIntent({ kind: 'load', assetId: entry.theiaAssetId })
    trinityOrchestrator.sendTheiaIntent({ kind: 'play', state: 'ambient' })
    return 'theia:active'
  }
  // … otros productores nativos del WAVE-4812
})
```

**Ventaja**: Selene no necesita saber que THETA existe. El bridge ya entrega el `canvasId`, el adapter ya sabe muestrear.

### 5.2 · Camino B — Asset-as-Show (paralelo)

Selene NO escoge el asset; el operador lo carga manualmente desde el editor (Show File guarda `theiaAssetId`). En este modo, el Brain solo emite `play(state)` derivado del `MusicalContext`. THETA está siempre cargado con UN asset hasta que se cambie de show.

Ambos caminos pueden coexistir: si hay `.lfx pixel` activo, gana el bridge (LTP); si no, gana el asset del show.

### 5.3 · Multiplexor `ArsenalIntentMultiplexer` (WAVE-4812 §5)

Sin cambios. THETA escribe en el mismo bus de productores del `AetherCanvasManager`; el adapter ya consolida todo en `setHephaestusIntents([])` de NodeArbiter. La luz que sale por DMX para el frame T y el píxel que se enciende en HDMI para el frame T son la misma decisión.

---

## 6. ESTRUCTURA DE ARCHIVOS PROPUESTA

```
electron-app/src/workers/
├── theia.ts                              ← worker entry (~200 LOC)
├── WorkerProtocol.ts                     ← +THEIA_INTENT, +THEIA_STATE_REPORT… (~40 LOC nuevas)
└── TrinityOrchestrator.ts                ← +nodeId 'theta', +path, +routing (~80 LOC nuevas)

electron-app/src/engine/theia/            ⟵ NUEVA CARPETA
├── AssetManifest.ts                      ← tipos del .theia (~80 LOC)
├── AssetIntent.ts                        ← discriminated union (~30 LOC)
├── AssetStateMachine.ts                  ← FSM + transiciones (~250 LOC)
├── CrossfadeUnit.ts                      ← lerp + anchor + curve (~120 LOC)
├── decoders/
│   ├── ITheiaDecoder.ts                  ← interfaz (~30 LOC)
│   ├── HiddenWindowDecoder.ts            ← <video> en BrowserWindow oculto (~250 LOC)
│   └── WebCodecsDecoder.ts               ← futuro (F4+)
└── BrainTheiaBridge.ts                   ← MusicalContext → AssetIntent (~180 LOC)

electron-app/src/core/theia/              ⟵ NUEVA CARPETA
├── SharedVideoFrameBuffer.ts             ← SAB triple-buffer (~180 LOC)
├── TheiaOutputWindow.ts                  ← BrowserWindow secundario (~150 LOC)
├── downscale.ts                          ← box mipmap (~80 LOC)
└── index.ts

electron-app/src/core/aether/canvas/renderers/
└── TheiaVideoRenderer.ts                 ← productor para WAVE-4812 (~80 LOC)

electron-app/src/core/orchestrator/
├── FrameContextRing.ts                   ← SAB de control (~120 LOC)
└── TitanOrchestrator.ts                  ← +shareFrameContext + wiring THETA (~60 LOC)
```

**Total nuevo**: ~1830 LOC en archivos aislados + ~180 LOC en archivos existentes (todos aditivos).
**Archivos modificados que tocan hot-path del lighting engine**: 0 (solo wiring del orchestrator).

---

## 7. RETROCOMPATIBILIDAD

| Componente | Cambio | Riesgo |
|---|---|---|
| `WorkerProtocol` | +5 enum values, +3 interfaces | Cero (aditivo) |
| `TrinityOrchestrator` | +1 worker registrado, +1 path | Bajo — patrón ya existente |
| `TitanOrchestrator` | +`FrameContextRing` write, +`TheiaVideoRenderer` wiring | Bajo — wiring opcional, gated por feature flag |
| `NodeArbiter` | **NINGUNO** | Cero |
| `LiquidEngineBase` / `LiquidAetherAdapter` | **NINGUNO** | Cero |
| `HephaestusRuntime` | **NINGUNO** | Cero |
| WAVE-4812 (no implementado aún) | THETA es un productor más del manager | Cero (es la integración natural) |

**Feature flag**: `THEIA_ENABLED` en config. Si `false`, ni siquiera se spawnea el worker. El sistema corre exactamente como hoy.

**Show files sin assets `.theia`**: invisible. THETA queda en estado `IDLE`, no consume CPU significativa, no escribe en el aether canvas.

---

## 8. FASES DE IMPLEMENTACIÓN

| Fase | Entregable | Verificación |
|---|---|---|
| **F0 — Tipos + Protocol** | `AssetManifest`, `AssetIntent`, `MessageType.THEIA_*`, `SharedVideoFrameBuffer` skeleton | `tsc --noEmit` clean |
| **F1 — FrameContextRing** | SAB broadcast main → workers, lectura desde `theia.ts` placeholder | THETA loguea `tickId` recibido sin drift > 1 tick |
| **F2 — Worker shell** | `theia.ts` registrado en TrinityOrchestrator, heartbeat, Phoenix integrado | `THEIA_STATE_REPORT` llega a main, kill→resurrect funciona |
| **F3 — Decoder + State Machine** | `HiddenWindowDecoder` + `AssetStateMachine` sin twin output (solo HDMI) | Cargar asset, transicionar AMBIENT→DROP por intent manual, ver vídeo en ventana secundaria |
| **F4 — CrossfadeUnit** | Anclaje `downbeat`, lerp suave, política de timeout | Transición sin frame negro, sincronizada al beat |
| **F5 — BrainTheiaBridge** | Auto-derivación de intents desde `MusicalContext` | Cambio de sección musical → cambio de estado de asset sin operador |
| **F6 — Twin output** | Downscale + `TheiaVideoRenderer` + integración con `AetherCanvasManager` (WAVE-4812 F1+) | Un PAR/LED muestra el color promedio del frame en el mismo tick que la pantalla |
| **F7 — Strobe/Blackout sync** | Lectura de `flags` del FrameContext, gating del frame | Strobe del Arbiter parpadea simultáneamente DMX y LED wall |
| **F8 — UI editor de Asset** | DNA Designer para `.theia`, preview del front buffer | Operador edita transiciones desde el editor |
| **F9 — WebCodecs decoder** | Backend HW-accel | Reducción de CPU > 50%, 4K @ 60 fps real |

---

## 9. TELEMETRÍA Y OBSERVABILIDAD

Eventos que THETA emite a la consola del main (gateados por `LUX_THEIA_VERBOSE`):

| Evento | Campos | Frecuencia |
|---|---|---|
| `[THEIA][BOOT]` | assetCount, decoderBackend | una vez |
| `[THEIA][LOAD]` | assetId, durationMs | por load |
| `[THEIA][STATE]` | from, to, reason, atTick | por transición |
| `[THEIA][ANCHOR-WAIT]` | targetState, ticksWaited | si > 44 ticks |
| `[THEIA][DROP-FRAME]` | tickId, decoderLagMs | por drop |
| `[THEIA][CIRCUIT-OPEN]` | reason, droppedInLastSec | umbral |
| `[THEIA][HEALTH]` | fps, decodeAvgMs, downscaleAvgMs, droppedTotal | cada 5 s |

**Métricas SLO objetivo**:
- `droppedFrames / totalFrames` < 1 % en assets ≤ 1080p30.
- Latencia `intent → primer frame nuevo en pantalla` < 100 ms (sin anchor) / < 1 beat (con anchor).
- Crossfade jitter (variación de duración) < 1 tick.

---

## 10. PUNTOS ABIERTOS

1. **Audio del propio asset** — ¿THETA reproduce audio del fichero o solo vídeo? Recomendación: **solo vídeo**. El audio del show viene del DAW/master. Si en el futuro un asset trae stem propio, abrir un nuevo SAB de audio paralelo al de BETA y mezclarlo en el master del sistema operativo (no responsabilidad de THETA).
2. **Múltiples ventanas HDMI** — para shows con varios LED walls independientes. Ampliable: el `TheiaOutputWindow` se vuelve `TheiaOutputWindowPool`, indexado por `displayId`. Cada Asset puede declarar `output: 'main' | 'all' | { displayIds: string[] }`. Diferido a F8+.
3. **Asset bundles vs ficheros sueltos** — preferible un `.theia` zip-empaquetado (manifest.json + clips + thumbnails). Mientras tanto, manifest JSON + ficheros sueltos en una carpeta. Decisión cosmética.
4. **GPU readback (downscale a 64×64)** — si se opta por `<video>` element + canvas downscale GPU, el `getImageData(0,0,64,64)` cuesta ~0.2 ms y elimina el coste CPU del `boxDownscale`. Recomendado desde F6.
5. **Hephaestus curves de Theia** — `theia.brightness`, `theia.speedScale`, `theia.intentTrigger`. Ataban el motor de vídeo a la timeline del show. Diferido a F8.
6. **Loading spinner / fallback ambient** — mientras un asset PRELOADING, THETA presenta el último frame de AMBIENT del asset anterior, o negro si no había. Configurable.

---

## 11. RESUMEN EJECUTIVO

- **THETA es un Phantom Worker** (`'theta'`) bajo el TrinityOrchestrator existente, no un sistema paralelo.
- **El reproductor es una FSM, no un seek**: AMBIENT → BUILDUP → DROP → DECAY, con CrossfadeUnit que ancla al beat.
- **Una decode → dos salidas**: SAB full-res hacia HDMI/LED wall + downscale 64×64 que rellena el front buffer del **Aether Canvas (WAVE-4812)**. El NodeArbiter no se entera; ya consume del manager.
- **El reloj maestro es `tickId` del FrameScheduler 44 Hz**. Un `FrameContextRing` (SAB minúsculo) broadcast a todos los workers garantiza que THETA, BETA y GAMMA hablen del mismo tick.
- **Un strobe o blackout del Arbiter es el mismo evento físico en DMX y en pantalla**, porque ambos productores leen el mismo bit `flags` del mismo tick.
- **Cero ruptura del pipeline existente**. THETA convive con LiquidEngineBase, Hephaestus, y WAVE-4812 sin reescribir nada del NodeArbiter.

**THEIA no es un reproductor de vídeo. Es una segunda voz dentro del coro luminoso, con la pantalla como su instrumento natural.**

---

*Blueprint preparado por Cascade. El frame manda en su pantalla; el píxel manda en su LED; el `tickId` manda en ambos.*
