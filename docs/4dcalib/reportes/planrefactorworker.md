# AUDITORÍA DE EXPANSIÓN DEL GLASS BRIDGE — Reporte Forense (READ-ONLY)

## 1. Estructura del `FixtureState` (HAL/Aether)

### 1.1 La interfaz

La interfaz canónica vive en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\FixtureMapper.ts`, líneas 112-182. Los campos de color son **un único triplete**:

```ts
r: number         // 0-255
g: number         // 0-255
b: number         // 0-255
```

No existe `rgb_ambient`, `rgb_air`, `rgb_strobe` ni ningún array de colores por celda. Los únicos canales de color extendidos son `white?`, `amber?`, `uv?` (líneas 152-154) — también escalares únicos.

### 1.2 El punto exacto donde se colapsan las sub-zonas

El colapso NO es un promedio aritmético: es una **mezcla aditiva/max por nodo** que ocurre en `AetherUIProjector.project()` en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\resolver\AetherUIProjector.ts:167-197`:

```ts
// por cada nodo del device (COLOR, IMPACT, ATMOSPHERE, BEAM, EFFECT…)
if (isAtmosphericZone(node.zoneId)) {
  fixture.r = Math.min(255, fixture.r + projectedR)   // aditivo
  fixture.g = Math.min(255, fixture.g + projectedG)
  fixture.b = Math.min(255, fixture.b + projectedB)
} else {
  fixture.r = Math.max(fixture.r, projectedR)         // max blend
  fixture.g = Math.max(fixture.g, projectedG)
  fixture.b = Math.max(fixture.b, projectedB)
}
```

El bucle itera `nodeIds` del device (línea 125) y **acumula** todos los nodos (Ambient, Air, Strobe, Color, Impact…) en el mismo `fixture.r/g/b`. Para cuando `TickEngine` vuelca al `glassView`, el triplete ya está fundido. El worker no tiene forma de recuperar la contribución por sub-zona.

### 1.3 Archivos a modificar para exportar RGB por celda

| Archivo | Cambio |
|---|---|
| `hal/mapping/FixtureMapper.ts` | Añadir a `FixtureState` (línea ~123): `rAmbient?, gAmbient?, bAmbient?, rAir?, gAir?, bAir?, rStrobe?, gStrobe?, bStrobe?` (o un array `cellColors?: Array<{r,g,b}>`). |
| `core/aether/resolver/AetherUIProjector.ts` | Líneas 188-196: en lugar de acumular en `fixture.r/g/b`, enrutar por `node.zoneId` hacia el campo correspondiente. Mantener `fixture.r/g/b` como fallback promediado para compat legacy. |
| `core/aether/types.ts` / `capability-node.ts` | Si se quiere tipar fuerte: añadir `zoneId` canónico al nodo (ya existe `node.zoneId` leído en línea 188). |
| `hal/HardwareAbstraction.ts` | No necesita cambio — HAL lee `fixture.r/g/b` para DMX físico; los nuevos campos son solo para la UI mirror. |
| Opcional: `core/aether/NodeArbiter.ts`, `NodeResolver.ts` | Solo si se quiere que el árbitro exponga el color por sub-zona en el mapa arbitrado (hoy ya lo hace — `ch['r']`, `ch['g']`, `ch['b']` por nodo). El árbitro ya tiene la data desagregada; el colapso ocurre solo en el projector. |

**Insight clave:** el árbitro ya tiene los colores por sub-zona separados (cada nodo tiene su propio `ch['r/g/b']`). El colapso es **puramente cosmético del projector**. La data existe aguas arriba; solo hay que dejar de fundirla.

## 2. Mapa de Memoria del Glass (`layout.ts`)

### 2.1 Auditoría de los 16 floats actuales

`FLOATS_PER_FIX = 16` en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\glass\layout.ts:46-48`. El volcado real está en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:1754-1771`:

| Offset | Campo | Origen (`fs.*`) | Uso del worker |
|---|---|---|---|
| 0 | R | `fs.r` | ✅ leído |
| 1 | G | `fs.g` | ✅ leído |
| 2 | B | `fs.b` | ✅ leído |
| 3 | W (white) | `fs.w` | ❌ descartado en pack |
| 4 | A (amber) | `fs.a` | ❌ descartado en pack |
| 5 | Dimmer | `fs.dimmer` | ✅ leído (→ intensity) |
| 6 | Pan (target) | `fs.pan` | ❌ descartado |
| 7 | Tilt (target) | `fs.tilt` | ❌ descartado |
| 8 | PhysicalPan | `fs.physicalPan` | ✅ leído |
| 9 | PhysicalTilt | `fs.physicalTilt` | ✅ leído |
| 10 | Zoom | `fs.zoom` | ✅ leído |
| 11 | Focus | `fs.focus` | ✅ leído |
| 12 | PanVel | `fs.panVel` | ✅ leído |
| 13 | TiltVel | `fs.tiltVel` | ✅ leído |
| 14 | Strobe | `fs.strobe` | ❌ descartado en pack |
| 15 | Flags | `(dimmer>0?1:0) \| (blackout?2:0)` | ❌ descartado en pack |

**Hallazgo:** 6 de los 16 floats (W, A, Pan target, Tilt target, Strobe, Flags) se transmiten por el Glass pero se descartan en `packGlassFrameInto` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:158-187`). Son bytes muertos que cruzan el IPC cada 44Hz.

### 2.2 Cálculo de expansión

Para 3 sub-zonas canónicas (Ambient, Air, Strobe) × 3 canales RGB = **9 floats adicionales**.

- Opción A (conservadora): `FLOATS_PER_FIX = 16 + 9 = 25` → 100 bytes/fixture. Alineamiento a 4 bytes (Float32) OK, pero no es múltiplo de 8 — peor para SIMD/cacheline.
- Opción B (recomendada): `FLOATS_PER_FIX = 24` → 96 bytes/fixture. Múltiplo de 8, rellena los 9 nuevos + 3 reservados. Alineamiento óptimo para AVX2 (32 bytes/2 fixtures).
- Opción C (agresiva): `FLOATS_PER_FIX = 32` → 128 bytes/fixture. Múltiplo de 16, cabecera cacheline-aligned, deja 16 slots para futuras sub-zonas (Floor, MoverL, MoverR…).

**Coste de memoria (main-process SAB):**
- Actual: `2048 × 16 × 4 = 131 072 bytes` (128 KB)
- Opción B (24): `2048 × 24 × 4 = 196 608 bytes` (192 KB) — +64 KB
- Opción C (32): `2048 × 32 × 4 = 262 144 bytes` (256 KB) — +128 KB

`BufferPoolManager` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\glass\BufferPoolManager.ts:22-25`) pre-asigna `POOL_SIZE = 3` buffers → incremento pico de +192 KB (opción B) o +384 KB (opción C). Despreciado frente al presupuesto de 22.7ms.

**Coste de IPC (44Hz):**
- Actual: 128 KB/frame × 44 = **5.6 MB/s** transferidos.
- Opción B: 192 KB × 44 = **8.4 MB/s** (+2.8 MB/s).
- Opción C: 256 KB × 44 = **11.3 MB/s** (+5.6 MB/s).

`pushFrame` mide ~5µs para 128 KB (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\glass\BufferPoolManager.ts:61-62`). Escala lineal → opción B: ~7.5µs, opción C: ~10µs. Bien dentro de 22.7ms.

## 3. Inyección y Extracción de Datos

### 3.1 Volcado en `TickEngine.ts`

Punto de inyección: `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:1754-1771`. Hoy:

```ts
const off = 10 + fi * 16
view[off + 0]  = fs.r ?? 0
view[off + 1]  = fs.g ?? 0
view[off + 2]  = fs.b ?? 0
// ... 13 floats más
```

**Cambios necesarios:**
1. Reemplazar `fi * 16` por `fi * FLOATS_PER_FIX` (usar la constante, no el literal — hoy está hardcodeado).
2. Añadir tras `view[off + 15]`:
   ```ts
   view[off + 16] = fs.rAmbient ?? 0
   view[off + 17] = fs.gAmbient ?? 0
   view[off + 18] = fs.bAmbient ?? 0
   view[off + 19] = fs.rAir ?? 0
   view[off + 20] = fs.gAir ?? 0
   view[off + 21] = fs.bAir ?? 0
   view[off + 22] = fs.rStrobe ?? 0
   view[off + 23] = fs.gStrobe ?? 0
   view[off + 24] = fs.bStrobe ?? 0
   ```
3. El header de 10 floats (líneas 1772-1776) no cambia — `view[0..4]` sigue siendo bass/mid/high/energy/isBeat.

### 3.2 Desempaquetado en `hyperion-render.worker.ts`

El worker no desempaqueta el glassView directamente — recibe el buffer ya **re-empaquetado** por `packGlassFrameInto` en `TacticalCanvas.tsx` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:158-187`), que reduce 16 → 10 floats. Hay dos puntos de cambio:

**Punto A — `packGlassFrameInto` (TacticalCanvas.tsx:158-187):**
- Añadir lectura de los nuevos offsets del glassView (16-24) y escritura al buffer del worker.
- Actualizar `FLOATS_PER_FIXTURE` en `hyperion-render.types.ts:274` de 10 a 19 (10 + 9 RGB de sub-zona).
- Actualizar `FIXTURE_FIELD` (líneas 277-288) con `R_AMBIENT, G_AMBIENT, B_AMBIENT, R_AIR, G_AIR, B_AIR, R_STROBE, G_STROBE, B_STROBE`.
- Actualizar `GLASS_FLOATS_PER_FIX = 16` (TacticalCanvas.tsx:141) → nueva constante desde `layout.ts`.

**Punto B — `unpackBuffer` en el worker (hyperion-render.worker.ts:218-234):**
```ts
unpackBuffer.r = currentFrameData[offset + FIXTURE_FIELD.R]
// ... añadir 9 lecturas para los nuevos campos
```

**Punto C — `WorkerFixtureFrame` interface (hyperion-render.types.ts:28-49):**
- Añadir los 9 campos opcionales `rAmbient?, gAmbient?, bAmbient?, rAir?, gAir?, bAir?, rStrobe?, gStrobe?, bStrobe?`.

**Punto D — `TacticalFixture` en `tactical/types.ts`:**
- Mismo añadido para que `renderFixtureLayer` pueda leerlos.

**Punto E — `renderFixtureLayer` (FixtureLayer.ts:498-573):**
- Despachar por sub-zona a las nuevas funciones `drawHelix`, `drawDiamond`, `drawLaserBar` usando los RGB específicos.

### 3.3 Buffer pool ping-pong

`bufferPool` en `TacticalCanvas.tsx:244` usa `new Float32Array(needed)` con `needed = count * FLOATS_PER_FIXTURE`. Al subir `FLOATS_PER_FIXTURE` de 10 a 19, los buffers existentes se quedan cortos — el guard `if (!buf || buf.length < needed)` (línea 634) ya reasigna. No hay cambio de código necesario, solo que el primer frame tras la migración reasignará los 2 slots del pool.

## 4. Plan de Ataque Estructurado

### Fase 0 — Constantes (sin riesgo)
1. `core/aether/glass/layout.ts:47`: `FLOATS_PER_FIX = 16 → 24` (opción B).
2. `workers/hyperion-render.types.ts:274`: `FLOATS_PER_FIXTURE = 10 → 19`.
3. `workers/hyperion-render.types.ts:277-288`: añadir 9 offsets a `FIXTURE_FIELD`.
4. `components/hyperion/views/tactical/TacticalCanvas.tsx:141`: `GLASS_FLOATS_PER_FIX = 16` → importar desde `layout.ts` (eliminar el literal).

### Fase 1 — Interfaces (sin riesgo runtime)
5. `hal/mapping/FixtureMapper.ts:123`: añadir a `FixtureState` los 9 campos opcionales `rAmbient?…bStrobe?`.
6. `workers/hyperion-render.types.ts:28-49`: añadir los 9 campos a `WorkerFixtureFrame`.
7. `components/hyperion/views/tactical/types.ts`: añadir los 9 campos a `TacticalFixture`.

### Fase 2 — Inyección (TickEngine)
8. `core/orchestrator/tick/TickEngine.ts:1754`: cambiar `fi * 16` → `fi * FLOATS_PER_FIX` (importar constante).
9. `core/orchestrator/tick/TickEngine.ts:1771`: añadir 9 líneas `view[off + 16..24] = fs.rAmbient ?? 0 …`.

### Fase 3 — Extracción (pack + unpack)
10. `components/hyperion/views/tactical/TacticalCanvas.tsx:158-187`: extender `packGlassFrameInto` para leer offsets 16-24 del glassView y escribirlos en el buffer del worker.
11. `workers/hyperion-render.worker.ts:218-234`: extender el loop de unpack para los 9 nuevos campos.

### Fase 4 — Proyector Aether (la cirugía real)
12. `core/aether/resolver/AetherUIProjector.ts:188-196`: bifurcar la escritura — en lugar de acumular todo en `fixture.r/g/b`, enrutar por `isAtmosphericZone(node.zoneId)` y por `node.zoneId` específico hacia `fixture.rAmbient/gAmbient/bAmbient` (zone='ambient'), `rAir/gAir/bAir` (zone='air'), `rStrobe/gStrobe/bStrobe` (zone='strobe'). Mantener el acumulado en `fixture.r/g/b` para compatibilidad DMX.

### Fase 5 — Render (consumo)
13. `components/hyperion/views/tactical/layers/FixtureLayer.ts:498-573`: despachar por `fixture.type` a las nuevas primitivas geométricas, usando los RGB de sub-zona para hélices/diamantes/barras.

### Fase 6 — Verificación
14. `tsc --noEmit` — confirmar que ningún consumidor legacy rompe por los campos nuevos (todos son opcionales).
15. Test de regresión: el worker viejo sin los campos nuevos debe seguir renderizando (los `?? 0` cubren el caso).
16. Medir `pushFrame` con opción B — confirmar <10µs.

## 5. Compensaciones de Punteros — Resumen

| Constante | Valor actual | Valor propuesto | Archivo |
|---|---|---|---|
| `FLOATS_PER_FIX` | 16 | 24 | `core/aether/glass/layout.ts:47` |
| `FIX_DATA_FLOATS` | 32 768 | 49 152 | `core/aether/glass/layout.ts:48` (derivado) |
| `FIX_DATA_BYTES` (BufferPoolManager) | 131 072 | 196 608 | `core/aether/glass/BufferPoolManager.ts:4` (derivado) |
| `FLOATS_PER_FIXTURE` (worker) | 10 | 19 | `workers/hyperion-render.types.ts:274` |
| `GLASS_FLOATS_PER_FIX` (TacticalCanvas) | 16 (literal) | 24 (importado) | `TacticalCanvas.tsx:141` |
| `GLASS_HEADER_FLOATS` | 10 | 10 (sin cambio) | `TacticalCanvas.tsx:140` |
| Offset base volcado TickEngine | `10 + fi * 16` | `10 + fi * 24` | `TickEngine.ts:1754` |
| Nuevos offsets glassView | — | `off+16..24` | `TickEngine.ts:1771` |
| Nuevos offsets buffer worker | — | `FIXTURE_FIELD.R_AMBIENT..B_STROBE` (10-18) | `hyperion-render.types.ts:277-288` |

**Presupuesto 22.7ms:** la fase crítica es `pushFrame` (~5µs → ~7.5µs) + IPC transfer (~0.5ms para 192KB a 44Hz) + unpack loop (~0.1ms para 2048 fixtures × 19 floats). Total estimado <1ms por frame, lejos del límite.