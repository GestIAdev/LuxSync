# HYPERION UI AUDIT — LuxSync V1.0

**Auditor:** PunkOpus (Ingeniero Jefe, React/Zustand/IPC)
**Fecha:** 2026-05-10
**Alcance:** Capa de interfaz y visualización: HyperionView (2D/3D), Kinetics Cathedral, Programmer State L2, y puentes IPC.
**Archivos auditados:**
- `src/components/hyperion/views/HyperionView.tsx` (442 líneas)
- `src/components/hyperion/views/tactical/TacticalCanvas.tsx` (820 líneas)
- `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx` (538 líneas)
- `src/components/hyperion/views/visualizer/postprocessing/NeonBloom.tsx` (88 líneas)
- `src/components/hyperion/controls/TheProgrammer.tsx` (390 líneas)
- `src/components/hyperion/controls/sidebar/StageSidebar.tsx` (116 líneas)
- `src/components/hyperion/kinetics/KineticsCathedral.tsx` (365 líneas)
- `src/components/hyperion/kinetics/KinRadarViewport.tsx` (337 líneas)
- `src/stores/programmerStore.ts` (647 líneas)
- `src/stores/movementStore.ts` (228 líneas)
- `src/stores/selectionStore.ts` (343 líneas)
- `src/bridges/ProgrammerAetherBridge.ts` (346 líneas)
- `src/bridges/KineticsBridge.ts` (408 líneas)
- `src/hooks/useAdiabaticRadarMode.ts` (30 líneas)

---

## 1. Scope & UI Architecture

### 1.1 El Stack Hyperion

```
HyperionView (root container)
├── Toolbar (2D/3D/KIN toggle, BPM/Confidence/MOOD metrics, quality profiler)
├── Main Content (flex row)
│   ├── Viewport (CSS-switched, both canvases ALWAYS mounted)
│   │   ├── TacticalCanvas  (2D — OffscreenCanvas + Web Worker)
│   │   └── VisualizerCanvas (3D — React Three Fiber + NeonBloom)
│   └── Sidebar (CSS-switched)
│       ├── StageSidebar (CONTROLS | GROUPS | SCENES)
│       │   └── TheProgrammer (Intensity | Color | Position | Beam | Extras)
│       └── KineticsCathedral (KINETICS | FIXTURE MATRIX)
│           └── KinRadarViewport (XYPad | RadarXY | SpatialTargetPad)
```

### 1.2 Estado Zustand (relevado)

| Store | Responsabilidad | Problema conocido |
|-------|----------------|-------------------|
| `selectionStore` | `selectedIds: Set<string>` | Bien diseñado, useShallow correcto |
| `programmerStore` | Overrides L2 per fixture + dirty flags | **Override zombies, syncSelection miente** |
| `movementStore` | Pan/tilt/pattern/spatial + Cathedral UI | Acumula `spatialReachability` sin cleanup |
| `stageStore` | Fixtures, groups, scenes, stage dims | Carga show con flush explícito (WAVE 4576) |
| `controlStore` | Quality, liquid layout, sidebar mode | Persistencia localStorage sin schema version |
| `audioStore` | BPM, onBeat, confidence | Leído directamente en RAF pump de TacticalCanvas |
| `truthStore` | Hardware state (fixtures, DMX) | Hook `useHardware` con React 19 estabilidad |
| `transientStore` | Frame-hot fixture state (color, intensity) | Fuente de verdad para TacticalCanvas |
| `overrideStore` | Manual overrides del canvas visual | Solapamiento semántico con programmerStore |

### 1.3 Nota arquitectónica clave

**WAVE 2515 — Canvas Lifecycle Persistence:** Ambos canvases (2D y 3D) están SIEMPRE montados en el DOM. El inactivo se oculta con `visibility: hidden + pointerEvents: none`. Esto es **obligatorio** porque `transferControlToOffscreen()` es irreversible: si React desmonta el `<canvas>`, el contexto OffscreenCanvas en el worker muere permanentemente. Esta decisión es correcta técnicamente pero significa que:
- El worker 2D sigue vivo aunque el usuario esté en 3D (hibernado, pero el hilo existe).
- El R3F Canvas sigue en el DOM aunque el usuario esté en 2D (con `frameloop='never'` pausado).

**WAVE 432.5 / StageSidebar:** Los 3 tabs (CONTROLS, GROUPS, SCENES) se montan simultáneamente y se alternan por CSS `display`. Esto significa que `TheProgrammer` ejecuta su `useEffect` de hidratación incluso cuando el usuario está en la pestaña GROUPS.

---

## 2. Hyperion Engine & NeonBloom

### 2.1 TacticalCanvas — Arquitectura Worker (WAVE 2510)

El TacticalCanvas es el **componente mejor diseñado** de toda la capa UI:

- **OffscreenCanvas + Web Worker:** Todo el renderizado (5 capas, hit testing, lasso) corre en un worker dedicado. El hilo principal solo maneja DOM events y empaquetado de datos.
- **Zero-copy transfer:** `packFrameData()` empaqueta datos de fixture en un `Float32Array(fixtureCount * FLOATS_PER_FIXTURE)` que se transfiere al worker vía `postMessage(msg, [frameData.buffer])`.
- **Mailbox latest-only:** Si el worker está ocupado cuando llega un nuevo frame, el anterior se descarta (`framesDropped++`). Solo se mantiene el frame más reciente. Esto evita backpressure.
- **Crash recovery:** El worker tiene manejo de `ERROR` y `SHUTDOWN` messages.

**Pero hay un defecto de performance en el hilo principal:**

```typescript
// TacticalCanvas.tsx, líneas 630-639 (RAF pump)
const transientFixtures = transientTruth?.hardware?.fixtures
let transientMap: Map<string, any> | null = null
if (transientFixtures && Array.isArray(transientFixtures)) {
  transientMap = new Map()
  for (const f of transientFixtures) {
    if (f?.id) transientMap.set(f.id, f)
  }
}
```

**Se crea un `new Map()` en CADA frame de requestAnimationFrame.** En un rig de 100 fixtures a 60Hz, eso son 6.000 instanciaciones de Map por segundo. Para V1.0, este Map debería ser un objeto plano reutilizado o pre-allocado.

### 2.2 VisualizerCanvas — React Three Fiber (WAVE 2042.6)

El canvas 3D usa `@react-three/fiber` + `@react-three/drei` + `three`:

- **Conditional frameloop:** `frameloop={shouldRender ? 'always' : 'never'}` — pausa completamente cuando no es visible, document hidden, o fuera del viewport (`IntersectionObserver`).
- **Context lost handling:** `WebGLContextHandler` captura `webglcontextlost/restored`.
- **WAVE 2204 Color Space Exorcism:** `toneMapping={THREE.NoToneMapping}` + `outputColorSpace={THREE.SRGBColorSpace}` mató el tinte rojo de LQ causado por `ACESFilmicToneMapping`.
- **WAVE 4575-B:** Cámara dinámica calculada desde diagonal del escenario (`diag * 0.8`), no más hardcoded 12×8.

**Problema:** `PerformanceMonitor` usa `useFrame` para contar frames y leer `gl.info` cada segundo. `gl.info` en Three.js es un objeto que acumula datos de renderizado. Leerlo en `useFrame` es barato, pero `useFrame` se ejecuta en cada frame del loop de R3F (60Hz). El monitor en sí consume ~0.1ms/frame — negligible pero innecesario en LQ.

### 2.3 NeonBloom — Evaluación de performance

```typescript
// VisualizerCanvas.tsx, líneas 352-359
{qualitySettings.postProcessing && (
  <NeonBloom enabled={true} intensity={0.4} ... />
)}
```

**Veredicto: Correctamente aislado.**

- En modo **LQ**, `qualitySettings.postProcessing = false` → `<NeonBloom>` no se monta. `<EffectComposer>` se desmonta COMPLETAMENTE. Cero render passes, cero GPU cost.
- En modo **HQ**, se monta con `intensity=0.4`, `luminanceThreshold=0.85`, `levels=5`, `mipmapBlur`. Esto es un bloom HDR de 5 niveles de mipmap — costoso pero justificado para producción.
- El `beatIntensity` modula la intensidad en ±10% (`intensity + beatIntensity * 0.1`). Esto es una variación uniforme, no un recálculo de kernel.

**Pero hay un riesgo de re-render:** `Scene` recibe `beatIntensity` como prop desde `<BeatTracker onBeatIntensity={setBeatIntensity}>`. Cada beat (o subida de energía) causa un `setState` en `Scene`, lo que re-renderiza todo el subárbol de fixtures. En un rig grande (50+ fixtures en R3F), esto puede causar stutter en el beat.

**Fix recomendado V1.0:** Mover `beatIntensity` a un ref o a un contexto de R3F para evitar re-render de la escena completa.

### 2.4 WYSIWYG — ¿El canvas miente?

**TacticalCanvas (2D):** El canvas 2D renderiza usando `calculateFixtureRenderValues()` que lee `transientStore` (frame-hot data). Esto está **relativamente sincronizado** con el DMX real porque transientStore se actualiza desde el frame loop del backend. Pero:
- Si hay un manual override L2 activo, el canvas visual puede mostrar valores diferentes a los que el operador ve en `TheProgrammer` si `overrideStore` y `programmerStore` están desincronizados.
- El canvas NO sabe del Mover Shield — muestra colores en movers con rueda mecánica que el NodeArbiter está bloqueando.

**VisualizerCanvas (3D):** Los fixtures 3D reciben `fixture` data de `useFixture3DData()`. Esta hook lee `stageStore` (posiciones estáticas) + `truthStore` (estado DMX). Las posiciones 3D son correctas, pero los colores/intensidad dependen de la propagación de estado a través de múltiples stores. No hay garantía de que el 3D muestre exactamente los mismos valores que salen por DMX.

---

## 3. Kinetic Cathedral & The Spatial Radar

### 3.1 La Catedral Cinética — WAVE 4561/4564

`KineticsCathedral.tsx` es el sidebar de control cinemático con dos sub-pestañas:
- **KINETICS:** ModeBar (AUTO/DEGREES/3D), KinRadarViewport, Spatial Fan Controls, Speed+Amp faders, ChaosOrderSlider, PatternArsenal.
- **FIXTURE MATRIX:** Grid de fixtures con estado individual (mover/shake/strobe).

`KinRadarViewport.tsx` implementa el **"Trinity Router"** que decide qué control renderizar:

```
0 moving heads     → EmptyState
1 moving head + classic     → XYPad
N moving heads + classic    → RadarXY (con ghost points de fan)
N moving heads + spatial    → SpatialTargetPad (IK 3D)
```

El modo se resuelve con `useAdiabaticRadarMode()`:
```typescript
// useAdiabaticRadarMode.ts, líneas 20-28
if (override !== null) return override
if (selectedIds.length === 0) return 'classic'
const allHavePosition = selectedIds.every(id => {
  const sf = stageFixtures.find(f => f.id === id)
  return sf?.position != null
})
return allHavePosition ? 'spatial' : 'classic'
```

**Esto es un criterio razonable:** Si TODOS los fixtures seleccionados tienen `position` en `stageStore`, se asume modo espacial (IK). Si alguno no tiene posición, se fuerza modo clásico (grados). El override manual del operador siempre gana.

### 3.2 KineticsBridge — Zustand Subscriptions (WAVE 4661)

El puente usa **4 suscripciones Zustand selectivas** (no polling):
1. `activePattern + patternSpeed + patternAmplitude` → `setManualPattern()` IPC
2. `pan + tilt + fanValue + chaosAmount + chaosSeed` → `setManualOverrides()` L2 KINETIC
3. `spatialTarget` → `applySpatialTarget()` IPC (IK resolver)
4. `spatialFanMode + spatialFanAmplitude` → re-envío de spatial

**Debounce por familia:**
- Pattern: 30ms
- Spatial: 20ms
- Classic XY pad: 16ms

Esto está bien diseñado. Los cambios continuos del operador (ej. arrastrar el XY pad) se agrupan en un solo IPC call.

### 3.3 El puente IK-VMM — Estado inmaduro

El control espacial (modo 3D) usa `window.lux.aether.applySpatialTarget()` que llega al `InverseKinematicsEngine` en el backend. Pero hay **tres rutas de control cinemático simultáneas** que pueden colisionar:

1. **KineticsBridge classic:** Escribe `pan`/`tilt` (o `pan_base`/`tilt_base` con patrón) en `:kinetic` vía `setManualOverrides()`.
2. **KineticsBridge spatial:** Escribe `targetX`/`targetY`/`targetZ` en `:kinetic` vía `applySpatialTarget()`, que el backend traduce a pan/tilt por IK.
3. **ProgrammerAetherBridge:** También puede escribir `pan`/`tilt`/`speed` en `:kinetic` si el operador usa la sección Position de `TheProgrammer`.

**Guardias implementadas:**
```typescript
// KineticsBridge.ts, líneas 264-265, 320-321, 364
if (hasProgrammerKineticManual(fixtureIds)) return
```

Si `programmerStore` tiene un override de pan/tilt/speed para ALGÚN fixture de la selección actual, el KineticsBridge **no hace nada**. Esto es correcto para evitar que el radar pise al programmer. Pero:

```typescript
// KineticsBridge.ts, líneas 49-71
function hasProgrammerKineticManual(fixtureIds: string[]): boolean {
  const overrides = useProgrammerStore.getState().fixtureOverrides
  for (const id of fixtureIds) {
    const ov = overrides.get(id)
    // ... comprueba pan, tilt, speed, targetX/Y/Z, extras rotation/speed
  }
  const { activePattern } = useMovementStore.getState()
  if (activePattern !== 'none' && activePattern !== 'static') return true
  return false
}
```

**BUG DE CONTAMINACIÓN CRUZADA:** `hasProgrammerKineticManual` itera sobre `fixtureOverrides` usando los `fixtureIds` de la **selección actual**. Si un fixture deseleccionado dejó un override zombie en `fixtureOverrides`, NO afecta a la selección actual. PERO `fixtureOverrides` tiene un bug de fidelidad: la función busca `ov = overrides.get(id)` para cada id de la selección. Si el operador cambia de selección rápidamente, un fixture A puede tener override de velocidad que bloquea el bridge para la nueva selección B si A está en B.

**Más grave — Spatial vs Programmer conflict:**
```typescript
// KinRadarViewport.tsx, líneas 214-223
const handleTargetChange = useCallback((t: Target3D) => {
  setManualOverrideForFixtures(movingHeadIds, true)
  setSpatialTarget(t)
  useProgrammerStore.getState().setSpatialPosition(t)
}, [movingHeadIds, ...])
```

Cuando el usuario arrastra un target espacial, `KinRadarViewport`:
1. Marca los fixtures en `manualOverrideFixtureIds` (movementStore)
2. Guarda el target en `spatialTarget` (movementStore)
3. Escribe el target en `programmerStore` vía `setSpatialPosition()`

Esto genera **dos fuentes de verdad** para el mismo target espacial. Además, `setManualOverrideForFixtures(movingHeadIds, true)` se llama pero **nunca se desmarca automáticamente** cuando el usuario cambia de modo o deselecciona. El set `manualOverrideFixtureIds` crece monótonamente.

### 3.3 Spatial Radar — Recomendación de cuarentena

**VEREDICTO: Feature incompleta, aislar para V1.0.**

La funcionalidad espacial (IK 3D) tiene los siguientes problemas confirmados:

1. **`spatialReachability` y `spatialSubTargets` crecen sin límites.** `movementStore` acumula resultados IK para cada fixture que alguna vez fue controlado espacialmente. Nunca se limpian al deseleccionar o cambiar de show.
2. **`SAFE_PAN_MAX = 513` y `SAFE_TILT_MAX = 256` en `KinRadarViewport` son hardcodeados** (líneas 135-136) y no se conectan con los límites mecánicos reales del fixture del perfil. Un fixture con 630° de pan o 280° de tilt no se representa correctamente.
3. **El `hasProgrammerKineticManual` no distingue entre override L2 del programmer y patrón procedural del VMM.** Si el VMM está emitiendo un patrón `circle`, `hasProgrammerKineticManual` retorna `true` (por `activePattern !== 'none'`), bloqueando al KineticsBridge. Pero el patrón procedural NO es un override manual — es L1/L3. La guardia está sobreprotegiendo.
4. **Feedback visual de reachability es frágil.** `spatialReachability[movingHeadIds[0]]` lee solo el PRIMER fixture de la selección para mostrar el readout de pan/tilt IK. Si hay 8 movers apuntando a un target espacial con fan dispersado, el readout muestra solo el primero.
5. **No hay "undo" o "release" del target espacial.** El botón UNLOCK libera todo (pan/tilt/speed/color), pero no hay una forma granular de decir "suelta solo el target espacial, vuelve al patrón".

**Recomendación para V1.0:**
- Mantener el modo **Classic** (XYPad + RadarXY + PatternArsenal) como única ruta de control cinemático en producción.
- **Ocultar o deshabilitar el modo Spatial** (`radarModeOverride === 'spatial'`) con un feature flag. El código puede quedar en la base pero NO debe ser accesible desde la UI sin un toggle de desarrollador.
- La integración IK-VMM necesita un refactor profundo: un único punto de verdad para el estado cinemático, no tres (`movementStore`, `programmerStore`, `VMM`).

---

## 4. Programmer State & Deselection Bugs

### 4.1 Override Zombies — EL BUG ESTRELLA

**`syncSelection` MIENTE en su JSDoc:**

```typescript
// programmerStore.ts, líneas 89-91
/** Sincroniza la selección activa. Limpia overrides de fixtures deseleccionados. */
syncSelection: (fixtureIds) => {
  set({ activeFixtureIds: fixtureIds })
},
```

El comentario dice "Limpia overrides de fixtures deseleccionados". El código **solo** actualiza `activeFixtureIds`. **No limpia NADA.**

**Consecuencia:** `fixtureOverrides` es un `Map<string, ProgrammerOverrides>` que acumula entradas para **todos los fixtures que alguna vez fueron tocados**. Cuando el operador deselecciona un fixture sin hacer "UNLOCK ALL", su override permanece en el Map.

**El bridge sigue enviando zombies a 44Hz:**

```typescript
// ProgrammerAetherBridge.ts, líneas 249-252
const flushFixtureIds = new Set<string>(activeFixtureIds)
for (const fixtureId of fixtureOverrides.keys()) {
  flushFixtureIds.add(fixtureId)
}
```

El bridge itera sobre `fixtureOverrides.keys()` **en ADICIÓN** a `activeFixtureIds`. Esto significa que si el operador:
1. Selecciona fixture A
2. Cambia dimmer a 80%
3. Deselecciona fixture A (clic en canvas vacío)
4. El override de A (dimmer=0.8) sigue en `fixtureOverrides`
5. El bridge lo envía al NodeArbiter en cada tick de 44Hz

**Afortunadamente,** cuando un override tiene valores `null`, el extractor retorna `null` y el bridge manda `clearNodeIds`. Entonces el NodeArbiter recibe la liberación. **PERO:** `releaseAll()` crea objetos `createEmptyOverrides()` (todos null) pero **NO elimina la entrada del Map**:

```typescript
// programmerStore.ts, líneas 608-615
releaseAll: () => {
  set(state => {
    const next = new Map<string, ProgrammerOverrides>()
    for (const id of state.fixtureOverrides.keys()) {
      next.set(id, createEmptyOverrides())  // ¡Sigue en el Map!
    }
    // ...
  })
}
```

El Map crece monótonamente. En un show de 8 horas donde el operador toca cientos de fixtures, `fixtureOverrides` puede tener cientos de entradas zombie con valores nulos, todas siendo iteradas en cada flush a 44Hz.

### 4.2 La UI miente sobre multi-selección

```typescript
// programmerStore.ts, líneas 286-299
const firstFixture = fixtureIds[0]
const firstOv = firstFixture ? next.get(firstFixture) : null

const displayDimmer = firstOv?.dimmer !== null && firstOv?.dimmer !== undefined
  ? Math.round(firstOv.dimmer * 100)
  : 100
const displayColor = {
  r: firstOv?.red !== null ? Math.round(firstOv.red * 255) : 255,
  g: firstOv?.green !== null ? Math.round(firstOv.green * 255) : 255,
  b: firstOv?.blue !== null ? Math.round(firstOv.blue * 255) : 255,
}
```

Los valores de display (dimmer, strobe, color) se derivan **ÚNICAMENTE del primer fixture** de la selección (`fixtureIds[0]`). Si el operador selecciona 5 fixtures con dimmer values {80%, 60%, 100%, 0%, 50%}, la UI del Programmer muestra **80%** (el primero) como si fuera el valor de toda la selección.

Esto es estándar en algunas consolas (GrandMA2 muestra "?" cuando hay valores mixtos), pero aquí el Programmer **muestra el valor del primero sin advertir** que los demás son diferentes. No hay indicador de "valores mixtos".

### 4.3 `setColor` destruye white/amber silenciosamente

```typescript
// programmerStore.ts, líneas 396-418
setColor: (r, g, b) => {
  // ...
  next.set(id, {
    ...ov,
    red: nr,
    green: ng,
    blue: nb,
    white: 0,    // ← DESTRUCCIÓN SILENCIOSA
    amber: 0,    // ← DESTRUCCIÓN SILENCIOSA
  })
}
```

Cuando el operador ajusta RGB en un fixture RGBW/Amber, `setColor` fuerza `white=0` y `amber=0`. El comentario justifica: "para evitar contaminación de presets por overrides previos RGBW/Amber". Pero si el operador tenía un override de white previamente establecido, este desaparece **sin notificación visual**. La UI del color picker no indica que se acaba de matar el canal blanco.

### 4.4 Hidratación — Carreras y fidelidad

```typescript
// TheProgrammer.tsx, líneas 132-180
useEffect(() => {
  const fixtureIds = [...selectedIds]
  syncSelection(fixtureIds)
  if (fixtureIds.length === 0) {
    hydrateMovementFromL2({ pan: null, tilt: null, speed: null })
    return
  }
  let cancelled = false
  const expectedSelectionKey = fixtureIds.join(',')
  const hydrate = async () => {
    const nodeIds = fixtureIds.flatMap(id => [`${id}:impact`, ...])
    const result = await window.lux?.aether?.getL2State(nodeIds)
    if (cancelled || !result?.success) return
    const liveSelectionKey = useProgrammerStore.getState().activeFixtureIds.join(',')
    if (liveSelectionKey !== expectedSelectionKey) return  // Guard de carrera
    hydrateFromL2(fixtureIds, result.overrides)
    // ...
  }
  hydrate()
  return () => { cancelled = true }
}, [selectedIds.join(','), ...])
```

**Problemas de hidratación:**

1. **El guard de carrera compara strings de IDs ordenados.** `fixtureIds.join(',')` asume que los IDs vienen en el mismo orden. `selectedIds` es un `Set`, `[...selectedIds]` preserve el orden de inserción del Set. Si el usuario hace toggle-selection en diferente orden, la comparación falla aunque el set sea igual.
2. **`getL2State` es un IPC round-trip.** En rigs grandes (200 fixtures × 5 nodeIds = 1000 nodeIds), el payload puede ser grande. El IPC round-trip + serialización JSON puede tomar 5-20ms. Durante ese tiempo, el operador puede haber cambiado valores manualmente. Si `hydrateFromL2` llega tarde, **sobrescribe los cambios recientes del usuario**.
3. **La hidratación no distingue entre "override existe" y "override es cero".** Si el NodeArbiter tiene `dimmer=0` (blackout), `getNorm(impact, 'dimmer')` retorna `0`. `hydrateFromL2` pone `ov.dimmer = 0`. El UI muestra 0%. Si el operador hace release (null), la UI vuelve a 100% (default). Pero si vuelve a seleccionar el fixture, `getL2State` podría retornar `dimmer=0` de nuevo (si L0/L1/L3 están emitiendo 0), haciendo que la UI muestre 0% aunque el operador no haya hecho override.

### 4.5 Dirty Flags — Posible pérdida de cambios

```typescript
// ProgrammerAetherBridge.ts, líneas 328-334
Promise.all(requests)
  .then(() => {
    useProgrammerStore.getState().consumeDirtyFamilies(Array.from(dirtySnapshot))
  })
```

El bridge captura `dirtySnapshot` al inicio del flush, envía IPC, y al recibir éxito consume **exactamente esas familias**. Pero:

- Si entre el inicio del flush y la respuesta del IPC, el usuario hace un cambio NUEVO en la misma familia, ese nuevo dirty flag **es parte del snapshot** si se heredó del Set anterior... No, espera. `dirtySnapshot = new Set(dirtyFamilies)` es una copia en el momento del flush. Un cambio posterior añadiría al `dirtyFamilies` real pero NO al snapshot. Entonces `consumeDirtyFamilies` limpiaría el snapshot viejo, dejando el nuevo dirty flag intacto. Esto es correcto.

- **PERO:** Si `requests.length === 0` (líneas 322-325), se llama `consumeDirtyFamilies(Array.from(dirtySnapshot))` directamente. Esto podría limpiar flags que fueron seteados entre la creación del snapshot y el chequeo de `requests.length === 0`. Aunque es una ventana muy pequeña (sincrónica), es un riesgo teórico.

- **Más grave:** `consumeDirty()` (sin argumentos) limpia TODO. No se usa en el bridge, pero si algún otro componente lo llama, perdería cambios no enviados.

### 4.6 `releaseAll` no distingue selección

```typescript
// programmerStore.ts, líneas 608-615
releaseAll: () => {
  set(state => {
    const next = new Map<string, ProgrammerOverrides>()
    for (const id of state.fixtureOverrides.keys()) {
      next.set(id, createEmptyOverrides())
    }
    // ...
  })
}
```

`releaseAll` libera **TODOS** los overrides de **TODOS** los fixtures que alguna vez tuvieron un override. No solo los seleccionados. Si el operador tiene 5 fixtures con override manual, selecciona 1 de ellos, y presiona "UNLOCK ALL", los otros 4 también se liberan. Esto es UNLOCK GLOBAL, no UNLOCK SELECTION. El botón en `TheProgrammer` dice "UNLOCK ALL" así que es semánticamente correcto, pero no hay alternativa de "UNLOCK SELECTED".

---

## 5. Architectural Flaws & V1.0 UI Roadmap

### 5.1 Deuda técnica confirmada (bloqueantes para V1.0)

#### A. `syncSelection` miente y no limpia overrides
**Archivo:** `programmerStore.ts:89-91`
**Fix:** Implementar la limpieza prometida: eliminar del `fixtureOverrides` Map los fixtures que ya no están en `activeFixtureIds`. O, alternativamente, documentar honestamente que `fixtureOverrides` es un parking persistente y que los overrides sobreviven a la deselección.

#### B. `fixtureOverrides` Map crece monótonamente
**Archivo:** `programmerStore.ts:608-615`
**Fix:** `releaseAll()` debería eliminar entradas del Map, no solo reemplazarlas con objetos vacíos. Además, agregar un `gcZombies()` que recorra el Map y `delete` las entradas donde TODOS los valores son null.

#### C. Display values derivados solo del primer fixture
**Archivo:** `programmerStore.ts:286-299`
**Fix:** Implementar un indicador de "valores mixtos" (como `?` o un color de advertencia) cuando los fixtures seleccionados tienen overrides diferentes. Mostrar el valor del primer fixture solo cuando todos coinciden.

#### D. `setColor` destruye white/amber sin consentimiento
**Archivo:** `programmerStore.ts:406-413`
**Fix:** No forzar `white: 0, amber: 0` en `setColor`. Si el operador quiere limpiar canales auxiliares, debe hacerlo explícitamente. O, al menos, mostrar en el UI que los canales W/A fueron reseteados.

#### E. TacticalCanvas crea Map() en cada frame
**Archivo:** `TacticalCanvas.tsx:634-636`
**Fix:** Reutilizar un objeto plano `{}` como cache de transient fixtures en vez de `new Map()`.

#### F. StageSidebar monta TheProgrammer en background
**Archivo:** `StageSidebar.tsx:99-109`
**Fix:** Agregar un guard en el `useEffect` de hidratación de `TheProgrammer` para que `getL2State` solo se ejecute cuando la pestaña CONTROLS esté visible (`display !== 'none'`).

#### G. `hasProgrammerKineticManual` sobreprotege contra patrones VMM
**Archivo:** `KineticsBridge.ts:66-70`
**Fix:** Separar la guardia de "override manual" de la guardia de "patrón activo". Un patrón procedural del VMM no debería bloquear al KineticsBridge.

#### H. `manualOverrideFixtureIds` en movementStore nunca se limpia
**Archivo:** `movementStore.ts:194-201`
**Fix:** Limpiar `manualOverrideFixtureIds` al cambiar de selección o al hacer reset.

#### I. `spatialReachability` acumula sin bounds
**Archivo:** `movementStore.ts:178`
**Fix:** Implementar `clearSpatialReachability(fixtureIds)` o limpiar automáticamente en `hydrateFromBackend`.

#### J. `usePersistedState` en HyperionView sin schema version
**Archivo:** `HyperionView.tsx:55-75`
**Fix:** Agregar un campo `__version` al objeto guardado en localStorage. Si cambia el schema, invalidar y usar default.

#### K. `handleCanvasClick` en VisualizerCanvas es no-op
**Archivo:** `VisualizerCanvas.tsx:454-457`
**Fix:** Implementar deselección al hacer click en el fondo del canvas 3D (como ya funciona en 2D). Actualmente, si el operador hace click en el aire del escenario 3D, la selección no se limpia.

### 5.2 Recomendaciones para V1.0

1. **Cuarentena del modo Spatial:** Ocultar `SpatialTargetPad` detrás de un feature flag de desarrollador hasta que el IK-VMM tenga un único punto de verdad.
2. **Garbage Collection de override zombies:** Implementar limpieza automática de `fixtureOverrides` en `ProgrammerAetherBridge._flush()` o en `syncSelection()`.
3. **Indicador de valores mixtos:** El Programmer debe mostrar `?` o un color de advertencia cuando la selección tiene overrides heterogéneos.
4. **Lazy hydration:** No hidratar `TheProgrammer` cuando la pestaña está oculta.
5. **Unificar fuentes de verdad cinemáticas:** `movementStore`, `programmerStore`, y `VMM` no pueden tener tres opiniones diferentes sobre el mismo `pan`/`tilt`.

---

## 6. Objective Evaluation

### 6.1 Veredicto técnico puro

**La capa UI de LuxSync tiene componentes brillantes (TacticalCanvas worker, NeonBloom condicional) y decisiones arquitectónicas inteligentes (Zustand selective subscriptions, debounced IPC). Pero el Programmer Store es un campo minado de override zombies, display values engañosos, y una hidratación que puede sobreescribir cambios del usuario.**

**Fortalezas reales (verificables):**
1. **TacticalCanvas con Web Worker + OffscreenCanvas:** Separación correcta de concerns. Main thread libre. Zero-copy transfer.
2. **NeonBloom condicional:** En LQ se desmonta completamente. Cero costo GPU cuando no se necesita.
3. **KineticsBridge con Zustand subscriptions:** No polling. Solo reacciona a cambios reales. Debounce por familia.
4. **Canvas Lifecycle Persistence (WAVE 2515):** Solución correcta para el problema irreversible de `transferControlToOffscreen`.
5. **WAVE 2204 Color Space Exorcism:** Arregló un bug real de tinte rojo en LQ.
6. **Guardias de carrera en hidratación:** `expectedSelectionKey !== liveSelectionKey` previene hidratación de selección obsoleta.

**Debilidades reales (bloqueantes para V1.0):**
1. **`syncSelection` no limpia overrides.** El comentario miente. Override zombies persisten.
2. **`fixtureOverrides` Map crece monótonamente.** `releaseAll()` no elimina entradas.
3. **Display values del Programmer derivados solo del primer fixture.** La UI miente en multi-selección.
4. **`setColor` destruye white/amber sin avisar.** Side effect destructivo oculto.
5. **Modo Spatial inmaduro.** Triple fuente de verdad (movementStore, programmerStore, VMM), `spatialReachability` sin cleanup, `manualOverrideFixtureIds` sin GC.
6. **TheProgrammer se hidrata en background.** StageSidebar monta los 3 tabs simultáneamente.
7. **`TacticalCanvas` crea Map() cada frame.** Cuello de botella de GC en rigs grandes.
8. **`hasProgrammerKineticManual` bloquea patrones VMM.** Confunde override manual con procedural.

### 6.2 Puntaje técnico

**Puntaje técnico: 6.2/10**
- Renderizado 2D (Worker + OffscreenCanvas): 9/10
- Renderizado 3D (R3F + Bloom condicional): 7.5/10
- Programador Store / L2 State: 4/10
- Puentes IPC (ProgrammerAetherBridge + KineticsBridge): 6.5/10
- Kinetic Cathedral / Radar: 5/10 (Classic OK, Spatial incompleto)
- Integridad WYSIWYG: 5.5/10
- Deuda técnica V1.0: 5/10

### 6.3 Nota final

Hyperion es un sistema visualmente impresionante y técnicamente ambicioso. El TacticalCanvas con worker es un ejemplo de cómo hacer renderizado pesado en Electron sin bloquear la UI. El NeonBloom con bypass total en LQ demuestra que alguien pensó en performance.

Pero el **Programmer Store es el talón de Aquiles.** Los override zombies son un problema de memoria y de fidelidad operacional. Un operador profesional necesita confiar en que cuando deselecciona un fixture, su override está exactamente donde lo dejó — ni más ni menos. Actualmente, los overrides viven en un Map oscuro que nadie limpia, y la UI muestra valores del primer fixture como si representaran a toda la selección.

La Catedral Cinética es funcional en modo Classic (XYPad + patrones) pero el modo Spatial es un experimento en producción. Tiene su lugar en el roadmap, pero no en el show de un operador a las 2 AM.

Para V1.0, las prioridades son:
1. **Implementar GC de override zombies en `fixtureOverrides`** (o limpiar en `syncSelection`)
2. **Indicador de valores mixtos en multi-selección**
3. **Cuarentena del modo Spatial**
4. **Lazy hydration de TheProgrammer**
5. **Eliminar `new Map()` del RAF pump de TacticalCanvas**

---

*Fin del informe. Se encontraron 8 bugs arquitectónicos confirmados y 3 áreas de deuda técnica. El subsistema visual está sano; el subsistema de control manual necesita una cirugía antes de V1.0.*
