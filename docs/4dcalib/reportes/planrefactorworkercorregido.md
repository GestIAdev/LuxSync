He revisado el plan línea por línea contra el código real. **No doy luz verde.** Hay cuatro bloqueantes, uno de ellos es exactamente el OOM de Oilpan que temes, y la matemática de memoria de la Opción B es aritméticamente imposible.

---

## BLOQUEANTE 1 — La Opción B no cabe. 16 + 9 = 25 > 24

Este es el fallo de bulto. El plan elige stride 24 y en la misma página escribe:

```ts
view[off + 16] = fs.rAmbient   // …
view[off + 24] = fs.bStrobe    // ← índice 24 con stride 24
```

Con `FLOATS_PER_FIX = 24` los índices válidos son **0..23**. `view[off + 24]` es, por definición, `view[off_siguiente + 0]` — es decir, **el canal R del fixture i+1**. El resultado no sería un crash: sería corrupción silenciosa cruzada, donde el rojo de cada fixture es el azul-strobe del anterior. Es el peor tipo de bug: invisible en `tsc`, invisible en tests unitarios, visible solo como "colores raros" en el escenario.

9 floats nuevos sobre un bloque de 16 exigen stride ≥ 25. La Opción B está muerta por aritmética, no por criterio.

## BLOQUEANTE 2 — Falta el reset por frame. Los nuevos canales se quedarían clavados a 255

El projector acumula, no asigna:

```ts
fixture.r = Math.min(255, fixture.r + projectedR)   // aditivo
```

Eso solo funciona porque `TickEngine` **cero-ea los campos cada frame** antes de proyectar, en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\orchestrator\tick\TickEngine.ts:991-996`:

```ts
state.dimmer = 0
state.r = 0; state.g = 0; state.b = 0
```

El plan añade 9 campos nuevos a `FixtureState` y **nunca los mete en ese bloque de reset**. Consecuencia inmediata: `rAmbient` se acumula frame tras frame, `Math.min(255, …)` lo satura en ~3 frames y **se queda a 255 para siempre**. Todas las sub-zonas atmosféricas en blanco permanente, sin decaer nunca. Los `?? 0` del volcado no salvan nada — el valor sí existe, está podrido.

Este reset es obligatorio y el plan no lo contempla en ninguna de sus 6 fases.

## BLOQUEANTE 3 — Hay un TERCER consumidor del layout que el plan no audita

El plan lista dos sitios que hardcodean el stride 16. Hay tres. El que falta es `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\EcoTacticalStage.tsx:96-98`:

```ts
const GLASS_HEADER_FLOATS = 10
const GLASS_FLOATS_PER_FIX = 16          // ← copia literal, no importada
const GF_R = 0, GF_G = 1, GF_B = 2, GF_DIMMER = 5
```

`EcoTacticalStage` se suscribe a `window.glass.onFrame` por su cuenta (línea 218) y pinta DOM directamente. Si cambias el stride sin tocarlo, el modo Eco lee el offset equivocado y muestra basura — colores de otro fixture, dimmer leyendo un pan. Y como el modo Eco es precisamente el fallback para máquinas flojas, el bug aparecería solo en el hardware del cliente que menos tolerancia tiene.

Los tres puntos reales, verificados por grep exhaustivo sobre `**/*.{ts,tsx}`:
- `TickEngine.ts:1754` → `const off = 10 + fi * 16`
- `TacticalCanvas.tsx:141` → `const GLASS_FLOATS_PER_FIX = 16`
- `EcoTacticalStage.tsx:97` → `const GLASS_FLOATS_PER_FIX = 16`

Ninguno importa de `layout.ts`. Tres copias literales del mismo número mágico.

## BLOQUEANTE 4 — La Fase 5 resucita el OOM de Oilpan (WAVE 7568)

Esto es lo que me preocupa de verdad. Mira el caché de sprites en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\layers\FixtureLayer.ts:151-159`:

```ts
if (glowSpriteCache.size >= SPRITE_CACHE_LIMIT) {   // 64
  for (const sprite of glowSpriteCache.values()) sprite.close()
  glowSpriteCache.clear()                            // ← BORRADO TOTAL, no LRU
}
```

No es una política LRU. Es **un vaciado completo al desbordar**. Hoy sobrevive porque hay *un* color por fixture y la cuantización a paso 8 colapsa los fades.

Multiplica los colores por 3 e introduce RaveX (3 sub-zonas animándose independientemente, con dientes de sierra a 44Hz y `decayBase` de 0.10-0.42, o sea colores distintos **cada frame**). Con >64 claves únicas por frame el caché se vacía **en cada frame**, y entonces cada `drawImage` vuelve a exigir `new OffscreenCanvas` + `createRadialGradient` + 5 `addColorStop`. Eso es literalmente la aritmética del crash que documenta la cabecera del archivo:

> 200 fixtures × 5 gradientes × 60fps = 60.000 CanvasGradient + ~240.000 addColorStop C++ objects/segundo. El GC de Oilpan no puede seguir el ritmo → CppHeap se llena → OOM.

La Fase 5 del plan dice "despachar por `fixture.type` a las nuevas primitivas usando los RGB de sub-zona" y no menciona el caché ni una vez. Tal cual está escrita, es un cañón apuntado al CppHeap.

---

## Corrección a la matemática de alineamiento: el argumento SIMD/AVX2 es ficción

Aquí discrepo del razonamiento, no solo del número. Dos motivos:

**1. Con un header de 10 floats, NINGÚN bloque está alineado, con cualquier stride.** El header ocupa 40 bytes. El fixture 0 empieza en el byte 40. Con stride 24 (96B) el fixture 1 empieza en 136, el 2 en 232… ninguno cae en frontera de 32 ni de 64 bytes. La Opción B presume "alineamiento óptimo para AVX2" y es falso de raíz: el desplazamiento de 40 bytes del header destruye cualquier alineamiento aguas abajo. Si el alineamiento importara, lo primero sería **padear el header a 16 floats (64 bytes)**, no tocar el stride.

**2. No hay SIMD en este bucle.** El pack/unpack es aritmética de índices escalar en JS con bounds-check. V8 no auto-vectoriza `destBuffer[wOff + 3] = …`. El único beneficio real de un stride potencia de dos es que el JIT emite `i << 5` en vez de `imul` — una ganancia literalmente inmedible frente a los 22,7 ms de presupuesto.

**Conclusión:** el stride se elige por **holgura de payload y claridad**, no por microarquitectura. Y por holgura, 24 ya has visto que no llega.

## Hallazgo colateral: 4 floats del bridge están muertos por un bug de nombres

El plan marca los offsets 12/13 (`panVel`/`tiltVel`) como "✅ leído" y útiles. No lo son. `TickEngine` escribe:

```ts
view[off + 3]  = fs.w ?? 0          // FixtureState declara `white`,  no `w`
view[off + 4]  = fs.a ?? 0          // FixtureState declara `amber`,  no `a`
view[off + 12] = fs.panVel ?? 0     // FixtureState declara `panVelocity`
view[off + 13] = fs.tiltVel ?? 0    // FixtureState declara `tiltVelocity`
```

Contrasta con `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\mapping\FixtureMapper.ts:137-153`. Los cuatro campos **no existen** con ese nombre, así que los offsets 3, 4, 12 y 13 transmiten cero desde el primer día. Las estelas de movimiento (`panVelocity`/`tiltVelocity`) del worker están alimentadas con ceros permanentes.

Son 4 floats de inmueble gratis. **Pero no los arregles dentro de esta cirugía**: arreglar el nombre haría que las velocidades empezaran a fluir de golpe y cambiaría el render (estelas que nunca se han visto). Es un ticket aparte.

## Veredicto sobre GC en Fases 2-3: limpio, con tres advertencias

Respondiendo directo a tu pregunta: **el nuevo puente no introduce asignación dinámica por frame.** `packGlassFrameInto` escribe en un destino preasignado y seguirá haciéndolo con 9 campos más. El `unpackBuffer` del worker es un singleton mutado in-place. Los pools de `smoothedFixturesPool`/`hitTestFixturesPool` (WAVE 7713) solo crecen en tamaño de slot, no en número de objetos.

Tres cosas que sí vigilaría:

1. **Prohibir `cellColors?: Array<{r,g,b}>`.** El plan lo ofrece como alternativa en su tabla 1.3. Sería 3 objetos × N fixtures × 44Hz de basura en el projector, exactamente el patrón que WAVE 7713 exterminó. **Solo escalares planos.**
2. **Fuga de buffer ya existente** en `@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\hyperion\views\tactical\TacticalCanvas.tsx:600-610`: si ambos slots del pool están ocupados cuando llega un `BUFFER_RETURN`, el buffer devuelto se descarta en silencio (el `for` no encuentra hueco). No es nuevo y está acotado, pero cada descarte pasará de 8 KB a ~15 KB al subir el stride del worker. Tolerable; conviene saberlo.
3. **`new Float32Array(buffer)` por frame** en `BufferPoolManager.pushFrame:62` y `glassPreload.ts:31` — dos objetos-vista por frame a 44Hz. Preexistente, trivial, y **no escala con el stride**. Sin acción.

## Dos riesgos de despliegue que el plan no ve

**`glass:handshake` está muerto.** La API expone `connect(): Promise<{maxFixtures, floatsPerFix}>` (`@C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\electron\glassPreload.ts:55-57`) pero **no existe ningún `ipcMain.handle('glass:handshake')`** en todo el repo. `window.glass.connect()` rechaza con "No handler registered". La primitiva de negociación de layout existe en la superficie y está sin implementar — justo la que necesitamos para blindar esta cirugía.

**Skew con `dist-electron-backend/`.** Hay copias compiladas del bridge (`dist-electron-backend/electron/glassPreload.js`, `.../hyperion-render.worker.js`) con el layout viejo. Un backend stale de 16 floats contra un renderer fresco de 32 = desincronización total del puntero. Rebuild obligatorio del backend en el mismo commit.

**Y un detalle de capacidad:** `FIX_DATA_FLOATS = MAX_FIXTURES * FLOATS_PER_FIX` **no incluye el header de 10 floats**. La capacidad real es 2047 fixtures, no 2048, y el `fi < 2047` hardcodeado del TickEngine funciona por casualidad. Con stride 32 seguiría funcionando por casualidad. Hazlo explícito.

---

## Plan corregido

### Fase 0 — Constantes (REESCRITA)

En `core/aether/glass/layout.ts`, sustituir los números mágicos por un layout declarado y auto-consistente:

```ts
export const GLASS_HEADER_FLOATS = 16        // era 10 implícito → padear a 64B
export const MAX_CELLS_PER_FIX   = 4         // ambient, air, strobe, +1 (floor)
export const FLOATS_PER_FIX      = 32        // Opción C
export const CELL_COLOR_BASE     = 16        // celda c → BASE + c*3
export const FIX_DATA_FLOATS     = GLASS_HEADER_FLOATS + MAX_FIXTURES * FLOATS_PER_FIX
export const MAX_GLASS_FIXTURES  = MAX_FIXTURES   // ya no hay off-by-one
```

Stride 32 no por AVX2 — por payload (25 no cabe en 24) y por holgura: 16..27 son 4 celdas × 3 canales, 28..31 reserva. Cuando quieras Floor o MoverL/MoverR desagregados, es un `MAX_CELLS_PER_FIX++`, no otra cirugía de punteros. Coste: 256 KB de espejo y ~11 MB/s de IPC. Irrelevante frente a 22,7 ms.

Indexar por celda (`CELL_COLOR_BASE + cell*3`) en lugar de 9 campos nominales `rAmbient/gAmbient/…` también elimina la posibilidad de repetir el bug de nombres `fs.w`/`fs.panVel`: el offset se calcula, no se teclea.

### Fase 1 — Interfaces
Igual que el plan, **pero escalares planos**. Nada de arrays de objetos.

### Fase 1.5 — RESET (NUEVA, obligatoria)
`TickEngine.ts:991-996`: añadir los campos de sub-zona al bloque de cero-eo por frame. Sin esto, todo lo demás pinta blanco permanente.

### Fase 2 — Inyección
Igual, más: `fi * 16` → `fi * FLOATS_PER_FIX` importado, `10` → `GLASS_HEADER_FLOATS`, y `fi < 2047` → `fi < MAX_GLASS_FIXTURES`.

### Fase 3 — Extracción
Igual, más: **`FLOATS_PER_FIXTURE` del worker de 10 → 20**, no 19. 10 útiles + 9 nuevos = 19, pero stride par evita que el JIT haga aritmética impar y deja un hueco. Y eliminar el literal 16 de `TacticalCanvas.tsx:141` importando de `layout.ts`.

### Fase 3.5 — TERCER CONSUMIDOR (NUEVA)
`EcoTacticalStage.tsx:96-98`: importar las constantes de `layout.ts` y borrar las tres copias literales.

### Fase 4 — Projector
Igual. Correcta la decisión de mantener `fixture.r/g/b` acumulado: no es solo compat legacy, es que ese array **sí alimenta DMX** en el fallback sin dispositivos Aether (`TickEngine.ts:1314` → `hal.flushToDriver(fixtureStates)`). Romperlo apagaría luces reales.

### Fase 5 — Render (REESCRITA)
Antes de tocar una sola primitiva geométrica:
1. `SPRITE_CACHE_LIMIT` 64 → **192** y sustituir el vaciado total por **eviction LRU** (`Map` ya conserva orden de inserción: `cache.delete(cache.keys().next().value)`). Vaciar todo al desbordar es lo que convierte un caché en un generador de basura.
2. `COLOR_QUANT_STEP` 8 → **16** (16 niveles/canal). Triplicar los colores exige cuantizar más grueso; a profundidad de 8 bits en una vista táctica es indistinguible.
3. **La geometría nueva NO lleva gradientes.** Hélices, diamantes y barras se dibujan como paths planos con `fillStyle` sólido — `beginPath`/`lineTo`/`fill` no asigna nada en el CppHeap. Reserva los sprites con gradiente exclusivamente para el glow radial, que ya está cacheado y resuelto. Si más adelante quieres hélices con degradado, pre-renderízalas en **blanco** cacheadas por `(tipo, rotación cuantizada)` y tíñelas con `globalCompositeOperation`, para que el caché no dependa del color.
4. Registrar cualquier caché nuevo en `disposeFixtureLayerSprites()` (FixtureLayer.ts:221), que ya está engancho al `SHUTDOWN` del worker.

### Fase 6 — Verificación (AMPLIADA)
- Implementar `ipcMain.handle('glass:handshake')` devolviendo `{maxFixtures, floatsPerFix, headerFloats, maxCells}` y **assertar en boot** en los tres consumidores. Es la vacuna definitiva contra el skew de punteros y hoy está a medio construir.
- Rebuild de `dist-electron-backend/` en el mismo commit.
- Prueba de silencio: 5 s sin audio → las 3 sub-zonas deben leer 0. Es el test que cazaría el Bloqueante 2.
- Prueba RaveX + Oilpan: cargar el perfil RaveX (3 sub-zonas mutando cada frame), 200 fixtures, 10 minutos, vigilando `glowSpriteCache.size` y el heap del renderer. Es el test que cazaría el Bloqueante 4.

---

**Veredicto: NO GO sobre el plan tal cual.** El diagnóstico forense (secciones 1-3: dónde se funden los colores, quién lee qué offset, dónde hookear) es sólido y lo firmo. El plan de ejecución tiene un error aritmético fatal en el stride, omite el reset por frame sin el cual nada decae, ignora un tercer consumidor, y su fase de render apunta directo al OOM que ya te costó una wave entera arreglar.

Con las cuatro correcciones de arriba, la cirugía es segura y ni se acerca al presupuesto de 22,7 ms — el coste real está en microsegundos, no en milisegundos. El riesgo nunca fue el rendimiento: era la corrupción silenciosa de punteros y el caché de sprites.

Dime si quieres que ejecute el plan corregido, o si prefieres que empiece solo por las Fases 0-1.5 (constantes + interfaces + reset), que son reversibles y no cambian ni un píxel, para que valides el terreno antes de tocar el projector.