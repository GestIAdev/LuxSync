Buenos resultados iniciales. Ahora necesito profundizar en los puntos críticos. Déjame ver el `CurveEvaluator` (donde se calculan las curvas) y el `QuantumSpectrometer` (que tiene canvas + buffers):

El `CurveEvaluator` está limpio — no asigna arrays, usa zero-alloc caches. Ahora veo el `QuantumSpectrometer` que tiene canvas + buffers tipados:

Buffers pre-alocados con tamaño fijo. Ahora veo el `KinRadarViewport` y el `PhaseCanvas`:

KinRadarViewport es solo un router. Los canvas reales están en XYPad/RadarXY/SpatialTargetPad y en el PhaseCanvas de Hephaestus. Déjame buscar esos:

Encontré `PhaseCanvas.tsx`. Veámoslo, y también los componentes de canvas en kinetics:

PhaseCanvas usa canvas de tamaño fijo (WHEEL_SIZE=112px). Sin ResizeObserver, sin arrays tipados. Limpio. Ahora veo los componentes de canvas con ResizeObserver en kinetics (XYPad, RadarXY, SpatialTargetPad):

Veo el QuantumSpectrometer ResizeObserver y el TacticalCanvas:

QuantumSpectrometer está bien: ResizeObserver con guard `w > 0 && h > 0`, canvas con `w * dpr` (dimensiones reales del contenedor), buffers pre-alocados con `MAX_FIXTURES=512`. Ahora veo el `TacticalCanvas` que es el visor 2D principal:

TacticalCanvas usa OffscreenCanvas transferido a un worker. El ResizeObserver solo reenvía dimensiones al worker. Veamos qué hace el worker con esas dimensiones:

Veo el `hyperion-render.worker.ts` — el que recibe el RESIZE. Veamos qué hace con `msg.width * dpr`:

El worker usa `msg.width * dpr` para el canvas. Si `msg.width` o `msg.height` son 0 o negativos, eso podría ser un problema, pero el ResizeObserver en TacticalCanvas no filtra esos casos. Sin embargo, eso causaría un canvas de 0px, no una allocación masiva.

Ahora busco el patrón más sospechoso: arrays tipados cuyo tamaño depende de `durationMs` o cálculos de fase sin división por 1000:

Ningún array tipado se dimensiona con `durationMs` o `phase` directamente. Ahora busco bucles cuyo límite dependa de `durationMs` o sliders:

Ningún bucle itera sobre `durationMs`. Ahora busco el `HephFileIO` o cualquier sitio que pueda leer `durationMs` de un archivo sin validación:

Veo algo crítico en la línea 921: `stretchFactor = durationMs / clip.durationMs`. Si `clip.durationMs` es 0, eso da `Infinity`. Veamos qué pasa con eso:

Si `stretchFactor` es `Infinity` (por `clip.durationMs === 0`), entonces `kf.timeMs * Infinity = NaN` o `Infinity`. Eso corrompe los keyframes pero no causa allocación masiva — el array de keyframes ya existe con tamaño fijo.

Ahora busco el `ensureOutputCapacity` que se llama en play/playFromClip:

`ensureOutputCapacity` crece por 2x con un mínimo de 256. Si `estimateTotalOutputs()` retorna un número enorme (muchos fixtures × muchos tracks × muchos clips), podría allocar mucho. Pero eso es objetos JS, no arrays tipados. Y el crecimiento es amortizado 2x.

Ahora busco el `BufferPoolManager` que se mencionó en los resultados de grep — es del Aether Glass:

BufferPoolManager está bien — pool fijo de 3 ArrayBuffers, tamaño constante `FIX_DATA_BYTES`. Veo qué es `FIX_DATA_FLOATS`:

Todo fijo: `MAX_FIXTURES=2048`, `FLOATS_PER_FIX=16` → 32768 floats = 128KB por buffer, 3 buffers = 384KB total. Constante, no variable.

Ahora busco el `analysisPipeline.ts` que tenía muchos arrays tipados con tamaño variable:

Veamos de dónde viene `numInternalPoints` y `numPoints`:

`numPoints = Math.ceil(samples.length / resolutionSamples)` — esto se calcula del tamaño del audio. Si `samples.length` es enorme (audio muy largo), `numPoints` puede ser grande. Pero esto es en el pipeline de análisis offline, no en el renderer hot path.

Ahora busco el `phantomPipeline.ts` que es nuevo y podría tener algo:

Limpio. Ahora busco el `ChronosRecorder` que se modificó recientemente:

Limpio. Ahora busco el `TimelineCanvas` que se modificó recientemente:

TimelineCanvas tiene ResizeObserver con guard `newWidth === 0 || newHeight === 0`. Veo cómo se usa `dimensions` para el canvas:

TimelineCanvas no usa `<canvas>` directamente — es SVG. El ResizeObserver solo actualiza `dimensions` state para el layout del SVG.

Ahora busco algo más específico — el error "Large allocation" de Oilpan suele venir de Canvas contexts o de ImageData. Busco `getImageData`, `putImageData`, `createImageData`:

Veo `TheiaOutputView` — esto es un canvas fullscreen con `putImageData`. Veamos:

Veamos el `resizeCanvas`:

**AQUÍ HAY UN SOSPECHOSO.** `ensureImageData(w, h)` se llama con `snap.width, snap.height` que vienen del video frame. Si el video frame tiene dimensiones enormes (ej. 4K = 3840×2160), `createImageData(3840, 2160)` aloja `3840 * 2160 * 4 = 33,177,600 bytes = ~33MB` de Uint8ClampedArray. Y eso se re-alloca cada vez que cambian las dimensiones del frame.

Pero más interesante: `resizeCanvas` usa `window.innerWidth * dpr` y `window.innerHeight * dpr`. Si `dpr` es muy alto (ej. 3 en pantallas Retina), y la ventana es grande, el canvas puede ser enorme. Pero eso es el canvas visible, no un array tipado.

Ahora busco el `theta.worker.ts` que también usa `getImageData`:

**ESTO ES EL CULPABLE PRINCIPAL.** Línea 299: `ctx.getImageData(0, 0, w, h)` donde `w = state.offscreenCanvas.width` y `h = state.offscreenCanvas.height`. Veamos cómo se establece el tamaño del offscreenCanvas:

El canvas se redimensiona a `frame.displayWidth × frame.displayHeight`. Si el frame de video es 4K (3840×2160), `getImageData(0, 0, 3840, 2160)` aloja un Uint8ClampedArray de `3840 * 2160 * 4 = 33,177,600 bytes = ~33MB` **en cada tick de 44Hz**. Eso es 33MB × 44 = **~1.45 GB/segundo** de allocaciones que el GC tiene que recolectar.

Pero veamos si hay algo peor — ¿qué pasa si `frame.displayWidth` o `frame.displayHeight` son 0, negativos, o corruptos?

No hay validación de `frame.displayWidth` o `frame.displayHeight` — se confía ciegamente en que son valores razonables. Si un frame corrupto trae `displayWidth = 65535` o algo similar, `getImageData(0, 0, 65535, 65535)` intentaría alojar `65535 * 65535 * 4 = 17,179,607,044 bytes = ~16GB`. Eso es un OOM instantáneo.

Ahora busco el `AetherCanvasManager` que también se mencionó:

**AetherCanvasManager tiene validación** (L77-82): rechaza width/height < 1 o no-enteros. Pero **no tiene un límite superior**. Si alguien llama `acquire('foo', 8192, 8192)`, aloja `8192 * 8192 * 4 = 268,435,456 bytes = 256MB` × 2 (front+back) = **512MB**. Y eso es permanente (doble buffer).

Ahora busco quién llama a `acquire`:

`THUMB_W, THUMB_H` son constantes (64×64). Ese path está bien.

Ahora busco otros renderers de AetherCanvas que podrían tener dimensiones variables:

Solo TheiaVideoRenderer usa acquire, y con tamaño fijo 64×64. Los demás renderers (Plasma, Perlin, StrobeMask) probablemente usan el buffer existente sin crear nuevos.

Ahora busco algo más específico — el error "Large allocation" de Oilpan suele venir de Canvas contexts. Veo si hay algún canvas que se redimensiona sin límite:

Veo `WaveformLayer.tsx` — ese está en el Chronos timeline. Veamos:

`WaveformLayer` usa `rect.width * dpr` sin guard de 0 o límite superior. Si `rect.width` es 0 (contenedor colapsado), canvas.width = 0, lo cual es inofensivo. Pero si `rect.width` es enorme (ej. contenedor sin max-width), podría ser grande. Sin embargo, esto es un canvas 2D, no un array tipado — el canvas en sí no aloja memoria masiva hasta que se hace `getImageData`.

Ahora busco el `RigMonitorCanvas` y otros componentes de VibeLab que podrían tener dimensiones sin límite:

`size` es una prop. Veamos de dónde viene:

`size` es opcional. Veamos el default:

Default 200px. Eso está bien. Ahora busco el `EnvelopeBay` que también usa `size * dpr`:

Default 120px. Bien. Ahora busco el `AudioReactorRing` que está en DashboardView:

Default 280px. Bien. Todos los componentes de VibeLab y Dashboard tienen defaults razonables.

Ahora busco algo más específico — el error "Large allocation" de Oilpan en el renderer. Veo si hay algún `OffscreenCanvas` en el renderer que se redimensiona:

Veo `TrinityProvider.tsx` línea 634: `new OffscreenCanvas(1920, 1080)` — eso es fijo. Y `theta.worker.ts` línea 340: `new OffscreenCanvas(w, h)` donde `w, h` vienen del frame. Veamos:

Línea 337: **hay un guard** `if (w <= 0 || h <= 0) return`. Pero no hay límite superior. Si `w = 3840, h = 2160` (4K), `new OffscreenCanvas(3840, 2160)` + `getImageData(0, 0, 3840, 2160)` = ~33MB por snapshot.

Ahora veo el `TheiaEngineView` que también usa `transferControlToOffscreen`:

**Línea 709-710:** `host.width = Math.max(1, Math.floor(rect.width * dpr))` — hay un guard `Math.max(1, ...)` pero **no hay límite superior**. Si `rect.width` es enorme (ej. ventana maximizada en monitor 4K con dpr=2), `rect.width * dpr` podría ser `3840 * 2 = 7680`. Eso hace un canvas de 7680×4320 = ~132MB solo en el framebuffer del canvas.

Pero esto es el canvas visible, no un array tipado. El problema de Oilpan sería si el worker hace `getImageData` sobre ese canvas enorme.

Ahora veo el `theta.worker.ts` línea 299 de nuevo — el `getImageData` se hace sobre `state.offscreenCanvas` que se redimensiona a `frame.displayWidth × frame.displayHeight`. Si el frame de video es 4K, eso es 33MB por `getImageData` a 44Hz.

Pero hay algo peor — veamos si hay algún path donde `frame.displayWidth` o `frame.displayHeight` puedan ser NaN o Infinity:

`frame.displayWidth` y `frame.displayHeight` son propiedades de `VideoFrame` (API nativa del navegador). Siempre son enteros positivos. Pero el `getImageData` a 44Hz sobre un canvas 4K es **33MB × 44 = ~1.45GB/segundo** de allocaciones que el GC tiene que recolectar. Eso es el OOM.

Ahora veo si hay algún otro path más grave. Busco `new ImageData` o `new Uint8ClampedArray` con tamaño variable:

`TheiaThumbBuffer` usa SAB con offset fijo. `AetherCanvasManager` ya lo vimos. Ninguno es variable.

Ahora busco el `VideoFrameReader` que se usa en `TheiaOutputView`:

**Línea 217:** hay un guard `if (width <= 0 || height <= 0) return null`. Pero `width` y `height` vienen de `Atomics.load(this.meta, META_WIDTH)` — son Int32. Si el writer (theta.worker) escribe un valor enorme como `width = 65536`, `height = 65536`, entonces `bytes = 65536 * 65536 * 4 = 17,179,607,044 bytes = ~16GB`. El `subarray(0, bytes)` no aloja memoria (es una vista), pero en `TheiaOutputView` línea 145: `img.data.set(snap.view)` intentaría copiar 16GB al ImageData, lo que causaría un OOM.

Pero más relevante: `ensureImageData(w, h)` en `TheiaOutputView` línea 86: `ctx!.createImageData(w, h)` — si `w` y `h` son enormes, eso aloja `w * h * 4` bytes. Eso es el OOM instantáneo.

Veamos el tamaño del SAB para entender el límite real:

**Línea 122:** el writer valida `width > VIDEO_MAX_WIDTH || height > VIDEO_MAX_HEIGHT`. Así que el SAB está limitado a 1920×1080. El reader está seguro.

Pero el `theta.worker.ts` línea 299 hace `getImageData(0, 0, w, h)` sobre `state.offscreenCanvas` que se redimensiona a `frame.displayWidth × frame.displayHeight`. Si el frame viene de un video 4K, `displayWidth = 3840, displayHeight = 2160`. El `getImageData` aloja `3840 * 2160 * 4 = 33MB` **en cada tick de 44Hz**. Eso es **~1.45GB/segundo** de allocaciones.

Pero el `videoWriter.publish` (línea 300) publica al SAB que tiene límite 1920×1080. Veamos si el writer rechaza frames >1080p:

El writer rechaza frames >1920×1080, **pero el `getImageData` en theta.worker.ts línea 299 ya se ejecutó ANTES del publish**. El daño (allocación de 33MB) ya está hecho. El publish falla silenciosamente, pero el GC todavía tiene que recolectar los 33MB del `img.data`.

Ahora tengo el cuadro completo. Déjame compilar el reporte:

---

## REPORT: OILPAN HUNTER — Forense de Asignación Masiva

### CULPABLE PRIMARIO: `theta.worker.ts` — `getImageData` a 44Hz sobre canvas de resolución variable

**Archivo:** `src/theia/theta.worker.ts`

**Línea 299:**
```ts
const w = state.offscreenCanvas.width   // = frame.displayWidth
const h = state.offscreenCanvas.height  // = frame.displayHeight
const img = ctx.getImageData(0, 0, w, h)  // ← ALOCACIÓN MASIVA
```

**Mecanismo del OOM:**

1. **Líneas 242-243:** El canvas se redimensiona a `frame.displayWidth × frame.displayHeight` sin límite superior ni validación:
   ```ts
   state.offscreenCanvas.width = frame.displayWidth
   state.offscreenCanvas.height = frame.displayHeight
   ```

2. **Línea 299:** `ctx.getImageData(0, 0, w, h)` aloja un `Uint8ClampedArray` de `w * h * 4` bytes **en cada tick de 44Hz**.

3. **Para video 1080p (1920×1080):** `1920 * 1080 * 4 = 8,294,400 bytes = ~8MB` por tick × 44Hz = **~352MB/segundo** de allocaciones que el GC debe recolectar.

4. **Para video 4K (3840×2160):** `3840 * 2160 * 4 = 33,177,600 bytes = ~33MB` por tick × 44Hz = **~1.45GB/segundo**.

5. **El `img.data` se descarta después de `videoWriter.publish()`** (línea 300-305), que solo copia los bytes al SAB. Pero la allocación ya ocurrió — Oilpan debe recolectar el `Uint8ClampedArray` cada tick.

6. **El `videoWriter.publish()` rechaza frames >1920×1080** (SharedVideoFrameBuffer.ts L122), pero el `getImageData` ya se ejecutó — la allocación masiva ya está en el heap.

**Por qué el JS heap se ve estable en ~1MB:** El `getImageData` retorna un `ImageData` cuyo `data` es un `Uint8ClampedArray` backed por un ArrayBuffer. V8/Oilpan puede reportar esto como "external memory" (no JS heap) pero el GC todavía debe rastrearlo. El "Large allocation" warning de Oilpan se dispara antes de que el OOM ocurra.

### CULPABLE SECUNDARIO: `TheiaOutputView/index.tsx` — `createImageData` sin límite superior

**Archivo:** `src/components/views/TheiaOutputView/index.tsx`

**Línea 86:**
```ts
imageData = ctx!.createImageData(w, h)
```

**Mecanismo:**
- `ensureImageData(snap.width, snap.height)` se llama en cada frame del rAF loop (L143).
- `snap.width` y `snap.height` vienen del `VideoFrameReader.readIfChanged()` que lee del SAB.
- El SAB está limitado a 1920×1080 (SharedVideoFrameBuffer.ts L41-42), así que esto está **limitado a ~8MB por allocación**.
- **Solo se re-alloca cuando cambian las dimensiones** (L82: cache check), así que no es un hot-path continuo.
- **Nivel de riesgo: Bajo** — el SAB limita el tamaño máximo.

### CULPABLE TERCIARIO: `AetherCanvasManager.acquire()` — Sin límite superior

**Archivo:** `src/core/aether/canvas/AetherCanvasManager.ts`

**Líneas 76-95:**
```ts
public acquire(canvasId: string, width: number, height: number): VirtualFrameBuffer {
  if (!Number.isInteger(width) || width < 1) {
    throw new RangeError(...)
  }
  // ← FALTA: if (width > MAX_DIMENSION || height > MAX_DIMENSION) throw
  const len = width * height * 4
  const buf: VirtualFrameBuffer = {
    front: new Uint8ClampedArray(len),  // ← allocación
    back: new Uint8ClampedArray(len),   // ← allocación (doble buffer)
  }
}
```

**Mecanismo:**
- Valida que width/height sean enteros positivos, pero **no tiene límite superior**.
- Si alguien llama `acquire('foo', 8192, 8192)`, aloja `8192 * 8192 * 4 * 2 = 536,870,912 bytes = 512MB` (front + back).
- **Nivel de riesgo: Medio** — solo se llama en patch-time (no hot path), y actualmente solo `TheiaVideoRenderer` la usa con tamaño fijo 64×64. Pero es una bomba de relojería si un futuro renderer pasa dimensiones dinámicas.

### LO QUE ESTÁ LIMPIO

| Componente | Por qué es seguro |
|------------|-------------------|
| `CurveEvaluator` | Zero-alloc caches, O(1) amortizado, sin arrays tipados |
| `QuantumSpectrometer` | Buffers pre-alocados `MAX_FIXTURES=512`, ResizeObserver con guard `w > 0 && h > 0` |
| `PhaseCanvas` | Canvas fijo `WHEEL_SIZE=112px`, sin ResizeObserver, sin arrays tipados |
| `TacticalCanvas` | OffscreenCanvas transferido a worker, ResizeObserver solo reenvía dimensiones |
| `BufferPoolManager` | Pool fijo de 3 ArrayBuffers de 128KB cada uno |
| `KinRadarViewport` | Router puro, sin canvas directo |
| `HephaestusRuntime` | `ensureOutputCapacity` crece 2x amortizado, objetos JS no arrays tipados |
| `analysisPipeline.ts` | Arrays tipados con tamaño de audio, pero offline (no renderer hot path) |
| `SharedVideoFrameBuffer` | SAB limitado a 1920×1080, writer valida dimensiones |
| Componentes VibeLab/Dashboard | Todos tienen defaults de tamaño razonables (120-280px) |

### RECOMENDACIÓN DE FIX

**Para `theta.worker.ts` (culpable primario):**

1. **Downscale antes de getImageData:** Si `frame.displayWidth > 1920 || frame.displayHeight > 1080`, dibujar el frame a un canvas auxiliar de 1920×1080 y hacer `getImageData` sobre ese canvas auxiliar.

2. **Reutilizar ImageData:** Cacheear el `ImageData` y solo re-alocar si cambian las dimensiones (como hace `TheiaOutputView`).

3. **Validar dimensiones:** Rechazar frames con `displayWidth > 4096 || displayHeight > 4096` antes de redimensionar el canvas.

**Para `AetherCanvasManager` (defensivo):**

4. **Añadir límite superior:** `if (width > 4096 || height > 4096) throw new RangeError(...)` en `acquire()`.