# WAVE 6002 — INFORME TOPOGRÁFICO DEL CONSUMO REACTIVO EN REACT
**Target:** KIMI / DEEPSEEKER (Strict Read-Only Mode)
**Scope:** Mapeo exhaustivo de suscripciones Zustand/Store → React y aislamiento de canales de datos de alta frecuencia.
**Mandato:** ZERO modificaciones de código. Solo diagnóstico forense.

---

## RESUMEN EJECUTIVO

El sistema presenta una **fractura arquitectónica clara** entre dos mundos:

1. **El Mundo Mutable (TransientStore):** Recibe ~22Hz de `selene:hot-frame` y ~7.3Hz de `selene:truth` vía IPC, pero **nunca dispara un re-render de React**. Los componentes 3D (`VisualizerCanvas`) y el Data Pump del `TacticalCanvas` leen directamente de referencias mutables (`useRef` / `getTransientTruth`) dentro de sus propios loops RAF/`useFrame`.

2. **El Mundo Reactivo (truthStore + Zustand):** Recibe `selene:truth` throttled (cada 6 mensajes IPC). `setTruth` reemplaza el objeto raíz `truth` completo, invalidando todas las referencias anidadas. Cualquier componente que suscriba a un objeto compuesto dentro de `truth` —incluso con `useShallow`— **se re-renderiza** porque los objetos internos (ej. `hardware.fixtures[]`) son siempre nuevos (generados por `.map()` en el backend).

**Hallazgo crítico:** `useHardware()`, `useAudio()` y `useBeat()` son los vectores principales de re-render. Son usados por **6+ componentes visibles simultáneamente**, incluyendo `TheProgrammer`, `KineticsCathedral`, `SystemsCheck`, `DataCards`, `MiniVisualizer` y el hook `useFixtureData` (padre del `TacticalCanvas`). En modo Chronos, esto genera una tormenta de ~7.3Hz de re-renders en cascada.

---

## 🔍 TAREA 1: AUDITORÍA DE STORES

### 1.1 truthStore.ts — Zustand (El Sistema Reactivo)

**Ubicación:** `src/stores/truthStore.ts`

| Campo | Tipo | Descripción |
|---|---|---|
| `truth` | `SeleneTruth` | Objeto raíz universal. Contiene `system`, `sensory`, `consciousness`, `context`, `intent`, `hardware`. |
| `framesReceived` | `number` | Contador de mensajes recibidos. |
| `lastUpdate` | `number` | `Date.now()` del último mensaje. |
| `isConnected` | `boolean` | Flag de conexión IPC. |

**Mecanismo de inyección (líneas 69–82):**
```typescript
setTruth: (data) => {
  set((state) => ({
    truth: data,               // ← REEMPLAZO TOTAL DEL OBJETO RAÍZ
    framesReceived: state.framesReceived + 1,
    lastUpdate: Date.now(),
    isConnected: true,
  }))
}
```

**Veredicto:** El payload IPC llega como Structured Clone (objeto completamente nuevo). `setTruth` reemplaza `truth` sin diff/delta. Esto invalida **todas** las referencias anidadas. Un `useShallow(selectHardware)` solo puede comparar shallowmente el objeto `hardware` devuelto, pero como `hardware` es un objeto *nuevo* creado por el backend en cada `.map()`, sus propiedades internas (como `fixtures[]`) también son nuevas. `useShallow` detecta el cambio y fuerza re-render.

**Selectores y hooks expuestos:**

| Hook/Selector | Devuelve | Usa `useShallow` | Riesgo de Re-render |
|---|---|---|---|
| `useHardware()` | `truth.hardware` | **Sí** | **ALTO** |
| `useAudio()` | `truth.sensory.audio` | **Sí** | **ALTO** |
| `useBeat()` | `truth.sensory.beat` | **Sí** | **ALTO** |
| `useCognitive()` | `truth.consciousness` | **Sí** | **ALTO** |
| `useSection()` | `truth.context.section` | **Sí** | **ALTO** |
| `useBPM()` | `truth.context.bpm` (primitivo) | No | Bajo |
| `useSyncopation()` | `truth.context.syncopation` (primitivo) | No | Bajo |
| `useBeatPhase()` | `truth.context.beatPhase` (primitivo) | No | Bajo |
| `selectStableEmotion` | `truth.consciousness.stableEmotion` (string) | No | Bajo |
| `selectFPS` | `truth.system.actualFPS` (number) | No | Bajo |
| `selectMode` | `truth.system.mode` (string) | No | Bajo |
| `selectSystem` | `truth.system` (objeto) | No | **ALTO** |
| `selectContext` | `truth.context` (objeto) | No | **ALTO** |

### 1.2 transientStore.ts — Mutable Ref (El Bypass)

**Ubicación:** `src/stores/transientStore.ts`

**Estructura:**
```typescript
const transientRef: {
  current: SeleneTruth | null
  frameCount: number
  lastUpdateTime: number
} = { current: null, frameCount: 0, lastUpdateTime: 0 }
```

**Inyección de `selene:truth` (líneas 81–133):**
- `injectTransientTruth(truth)`: Reemplaza `transientRef.current = truth` **completamente**.
- Reconstruye un `fixtureIndex: Map<string, any>` para lookups O(1).
- Aplica blackout mirror mutando `fixture.dimmer/intensity/color` en lugar si `useEffectsStore` indica blackout.

**Inyección de `selene:hot-frame` (líneas 151–281):**
- `injectHotFrame(hotFrame)`: Realiza un **deep-merge parcial in-place** sobre los fixtures existentes en `transientRef.current`.
- Patchea solo campos dinámicos: `dimmer`, `intensity`, `pan`, `tilt`, `zoom`, `focus`, `physicalPan`, `physicalTilt`, `panVelocity`, `tiltVelocity`, `active`, `white`, `amber`, `color.{r,g,b}`.
- **Nunca** toca campos estructurales (`id`, `name`, `type`, `zone`, `profileId`).
- Patchea también `sensory.beat` y `sensory.audio` en el objeto existente.

**Veredicto:** Zero React. Zero Zustand. Zero re-render. Los componentes 3D leen de aquí.

---

## 🔍 TAREA 2: MAPEO DE SUSCRIPCIONES REACTIVAS (RE-RENDERS)

### 2.1 Componentes Principales — Análisis de Suscripción

#### 🚨 CommandDeck (`src/components/commandDeck/CommandDeck.tsx`)

| Hook | Selector | Tipo | Frecuencia de Re-render |
|---|---|---|---|
| `useEffectsStore(selectBlackout)` | primitivo boolean | Event-driven | Bajo |
| `useEffectsStore(state => state.setBlackout)` | action | N/A | N/A |
| `useControlStore(selectAIEnabled)` | primitivo boolean | Event-driven | Bajo |
| `useControlStore(state => state.toggleAI)` | action | N/A | N/A |
| `useControlStore(selectSystemArmed)` | primitivo boolean | Event-driven | Bajo |
| `useControlStore(state => state.setSystemArmed)` | action | N/A | N/A |
| `useControlStore(selectOutputEnabled)` | primitivo boolean | Event-driven | Bajo |
| `useControlStore(state => state.setOutputEnabled)` | action | N/A | N/A |
| `useSystemPower()` | custom hook | Event-driven | Bajo |
| **Local State Polling** | `setInterval(fetchStatus, 250)` | **4Hz fijo** | **🚨 ALTO** |

**Crimen:** No usa suscripciones globales de Zustand, pero tiene un **`setInterval` de 250ms** que hace `fetchStatus` vía IPC (`lux:aether:getControlState`), luego actualiza 3 estados locales (`arbiterStatus`, `outputEnabled`, `blackout`). Esto fuerza un **re-render completo de CommandDeck + todos sus hijos (GrandMasterSlider, GrandMasterSpeedSlider, etc.) cada 250ms** (~4Hz).

---

#### 🚨 TheProgrammer (`src/components/hyperion/controls/TheProgrammer.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| `useSelectedArray()` | `selectionStore.selectedIds` | Event-driven (selección) |
| `useSelectionStore(state => state.deselectAll)` | action | N/A |
| **`useHardware()`** | `truthStore.hardware` (obj, `useShallow`) | **🚨 ALTO** |
| `useProgrammerStore(...)` | múltiples acciones/estados | Event-driven |
| `useMovementStore(...)` | acciones locales | Event-driven |

**Crimen:** Suscrito a **`useHardware()`** (`truthStore.hardware`). El `hardware` contiene `fixtures[]` que es un array nuevo en cada `setTruth`. Causa re-render de todo el panel derecho de controles (sliders de dimmer, color, strobe, gobo, prism, etc.) a la frecuencia de truthStore.

---

#### 🚨 KineticsCathedral (`src/components/hyperion/kinetics/KineticsCathedral.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| `useSelectionStore(useShallow(s => Array.from(s.selectedIds)))` | Set→Array | Event-driven |
| **`useHardware()`** | `truthStore.hardware` (obj, `useShallow`) | **🚨 ALTO** |
| `useMovementStore(useShallow(...))` | UI local | Event-driven |
| `useKineticHydrationStore(s => s.aggregate)` | hydration | Event-driven |

**Crimen:** Suscrito a **`useHardware()`** para calcular `hasMovingHeads` (`hardware?.fixtures ?? []`). Re-render completo del sidebar cinético a la frecuencia de truthStore.

---

#### 🚨 SystemsCheck (`src/components/views/DashboardView/components/SystemsCheck.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| **`useHardware()`** | `truthStore.hardware` | **🚨 ALTO** |
| **`useAudio()`** | `truthStore.sensory.audio` | **🚨 ALTO** |
| `useSetupStore(useShallow(...))` | config | Event-driven |
| `useAudioStore(state => state.inputGain)` | primitivo | Event-driven |

**Crimen:** Suscrito simultáneamente a **`useHardware()`** y **`useAudio()`**. Incluye `MiniVisualizer` interno que recalcula 5 barras de altura en cada re-render. Es un componente grande con múltiples secciones de acordeón.

---

#### 🚨 DataCards (`src/components/views/DashboardView/components/DataCards.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| **`useHardware()`** | `truthStore.hardware` | **🚨 ALTO** |
| **`useBeat()`** | `truthStore.sensory.beat` | **🚨 ALTO** |
| **`useAudio()`** | `truthStore.sensory.audio` | **🚨 ALTO** |
| `useLicenseStore(...)` | license | Event-driven |

**Crimen:** El componente más castigado. Suscríbese a **tres** hooks de truthStore que devuelven objetos compuestos. Recalcula `fixtureCount`, `fixturesActive`, `bpm`, `energy`, `level` y pasa 6 `DataCard` children en cada re-render.

---

#### 🚨 TacticalCanvas (`src/components/hyperion/views/tactical/TacticalCanvas.tsx`)

**Suscripciones Reactivas (líneas 253–259):**

| Hook | Selector | Riesgo |
|---|---|---|
| `useSelectionStore(state => state.selectedIds)` | Set | Event-driven |
| `useSelectionStore(... select/toggle/deselectAll)` | actions | N/A |
| `useStageStore(selectStageDimensions)` | `stage` (obj) | Event-driven |
| **`useFixtureData()`** | hook compuesto | **🚨 ALTO** |

**Crimen secundario (Data Pump):** El componente mismo NO se re-renderiza por el pump de datos (líneas 624–697). El pump corre en RAF a 60Hz pero lee **imperativamente** de `transientStore`, `controlStore` y `overrideStore` vía `.getState()`. Sin embargo, `useFixtureData()` SÍ es reactivo y recalcula `TacticalFixture[]` completo cada vez que `useHardware()` dispara un re-render.

---

#### ✅ VisualizerCanvas (`src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| `useAudioStore(...)` | audio metrics | Bajo |
| `useSelectionStore(selectVisualizerActions)` | actions | N/A |
| `useStageStore(selectStageDimensions)` | stage | Event-driven |
| **`useFixture3DData()`** | hook compuesto | **MEDIO** (estructural) |

**Veredicto:** `useFixture3DData` **NO** suscribe a `useHardware()`. Solo reacciona a `stageStore.fixtures`, `selectionStore.selectedIds` y `overrideStore.overrides` (cambios estructurales o de interacción). Los valores dinámicos (color, pan, tilt, dimmer) se leen directamente de `transientStore.getTransientFixture()` dentro de `useFrame()` de R3F. **Este es el modelo correcto de aislamiento.**

---

#### ⚠️ HyperionView (`src/components/hyperion/views/HyperionView.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| `useAudioStore(useShallow(selectHyperionAudio))` | audio obj | Medio (throttled) |
| `useTruthStore(selectStableEmotion)` | string | Bajo |
| `useStageStore(state => state.fixtures)` | Array | Event-driven (estructural) |
| `useSelectionStore(state => state.selectedIds)` | Set | Event-driven |
| `useControlStore(state => state.liquidLayout)` | string | Event-driven |
| `useControlStore(state => state.sidebarMode)` | string | Event-driven |

**Veredicto:** A pesar de ser el contenedor principal, sus suscripciones son razonables: primitivas o cambios estructurales raros. El toolbar con el corazón latiendo (`onBeat`) viene de `audioStore`, no truthStore directamente.

---

#### ✅ StageSidebar (`src/components/hyperion/controls/sidebar/StageSidebar.tsx`)

| Hook | Selector | Riesgo |
|---|---|---|
| `useSelectionStore(state => state.selectedIds)` | Set | Event-driven |
| `useSceneStore(selectSceneCount)` | number | Event-driven |

**Veredicto:** Suscripciones limpias. No suscribe a truthStore.

---

### 2.2 Hooks de Consumo Intermedio

#### 🚨 useFixtureData (`src/components/hyperion/views/tactical/useFixtureData.ts`)

| Dependencia | Fuente | Re-render Trigger |
|---|---|---|
| **`useHardware()`** | truthStore | **~7.3Hz (Chronos)** |
| `useStageStore(state => state.fixtures)` | stageStore | Estructural |
| `useStageStore(state => state.stage)` | stageStore | Estructural |
| `useControlStore(useShallow(selectCinemaControl))` | controlStore | Event-driven |
| `useOverrideStore(selectOverrides)` | overrideStore | Event-driven |

**Impacto:** Este hook transforma `stageStore.fixtures + truthStore.hardware` en `TacticalFixture[]`. Cada re-render recalcula `runtimeStateMap` (Map nuevo) y un `useMemo` masivo con 11 dependencias. Es el **puente reactivo** que conecta la tormenta de truthStore con TacticalCanvas.

#### ✅ useFixture3DData (`src/components/hyperion/views/visualizer/useFixture3DData.ts`)

| Dependencia | Fuente | Re-render Trigger |
|---|---|---|
| `useStageStore(state => state.fixtures)` | stageStore | Estructural |
| `useSelectionStore(state => state.selectedIds)` | selectionStore | Event-driven |
| `useOverrideStore(state => state.overrides)` | overrideStore | Event-driven |
| `getTransientFixture(id)` | transientStore | **Nunca** (imperativo) |

**Impacto:** El hook solo recalcula cuando la estructura del escenario cambia. Los datos dinámicos se leen vía `getTransientFixture()` — un snapshot no reactivo. **Modelo correcto.**

---

## 🔍 TAREA 3: AISLAMIENTO DEL TACTICALCANVAS 2D / VISUALIZERCANVAS 3D

### 3.1 TacticalCanvas 2D — Estado del Aislamiento

**Arquitectura:**
- **Render loop:** Vive en un **Web Worker** (`hyperion-render.worker.ts`) con su propio RAF a 60fps.
- **Canvas ownership:** Transferido vía `transferControlToOffscreen()` (irreversible).
- **Data pump:** El componente React principal corre un RAF loop a 60Hz (líneas 624–697) que lee datos de stores de forma **imperativa** (`getState()`) y envía `Float32Array` al worker vía `postMessage`.

**Lectura de datos en el pump (líneas 637–665):**
```typescript
const transientTruth = getTransientTruth()          // ← transientStore (mutable ref)
const controlState = useControlStore.getState()       // ← Zustand imperativo (NO reactivo)
const overrides = useOverrideStore.getState().overrides // ← Zustand imperativo (NO reactivo)
```

**Veredicto:** El data pump del `TacticalCanvas` está **correctamente aislado** del ciclo de render de React. No causa re-renders de React a 60Hz.

**PERO:** El componente `TacticalCanvas` **sí se re-renderiza** a ~7.3Hz (Chronos) porque suscribe a `useFixtureData()`, que a su vez suscribe a `useHardware()`. Cada re-render del componente React **no redibuja el canvas** (eso lo hace el worker), pero sí recalcula `zoneCounts`, `rulerTicks`, y re-ejecuta los `useEffect` de `SCAFFOLD` y `SELECTION` (líneas 573–599), enviando mensajes al worker. Esto genera microtasks en el hilo principal.

### 3.2 VisualizerCanvas 3D — Estado del Aislamiento

**Arquitectura:**
- **Render loop:** React Three Fiber (`@react-three/fiber`) con `useFrame()` a 60fps.
- **No worker:** Corre en el hilo principal del renderer, pero R3F tiene su propio loop de renderizado independiente de React reconciler.

**Lectura de datos dinámicos:**
En `HyperionMovingHead3D.tsx` y `HyperionPar3D.tsx`, dentro de `useFrame()`:
```typescript
const fixture = getTransientFixture(props.fixtureId)
if (fixture) {
  targetColor.setRGB(fixture.color.r / 255, ...)
  targetIntensity = fixture.dimmer / 255
  // ... etc
}
```

**Veredicto:** Los componentes 3D leen sus valores dinámicos **directamente de la referencia mutable** dentro de `useFrame()`, sin pasar por React props o Zustand. El único momento en que React re-renderiza el árbol 3D es cuando `useFixture3DData()` recalcula (cambio estructural: nuevo fixture, selección, override).

**Esto es el patrón ideal.**

---

## ⚠️ VEREDICTO FORENSE: CULPABLES DE LOS 38ms DE MICROTASKS

### Causa Raíz: Tormenta de Re-renders Concurrente (~7.3Hz)

Cuando `truthStore.setTruth(data)` se ejecuta (especialmente en modo Chronos donde truth llega a 44Hz y el throttle de 6 frames lo reduce a ~7.3Hz), el siguiente corte transversal de componentes se re-renderiza **simultáneamente**:

| Componente | Suscripción Culpable | Costo Estimado |
|---|---|---|
| **DataCards** | `useHardware()` + `useAudio()` + `useBeat()` | Alto (6 cards + cálculos) |
| **SystemsCheck** | `useHardware()` + `useAudio()` | Alto (accordion + MiniVisualizer) |
| **TheProgrammer** | `useHardware()` | Alto (sidebar densa de controles) |
| **KineticsCathedral** | `useHardware()` | Medio-Alto (sidebar + radar) |
| **TacticalCanvas** (hook) | `useFixtureData()` → `useHardware()` | Medio-Alto (recálculo de fixtures 2D) |
| **CommandDeck** | `setInterval(250ms)` | Medio (4Hz polling) |
| **HyperionView** | `useAudioStore(useShallow(...))` | Bajo-Medio |

**Colisión crítica:** `CommandDeck` re-renderiza a **4Hz** por su `setInterval`. `truthStore` re-renderiza a **~7.3Hz** en modo Chronos. Cuando ambos coinciden en el mismo frame (~1 vez cada ~300ms), se produce una **tormenta de microtasks** donde React reconciler debe procesar simultáneamente:
- Re-render de CommandDeck + GrandMasterSlider
- Re-render de SystemsCheck + MiniVisualizer
- Re-render de DataCards (6 tarjetas)
- Re-render de TheProgrammer
- Re-render de KineticsCathedral
- Re-render de TacticalCanvas (incluyendo re-cálculo de `useFixtureData`)

Esto satura la cola de microtasks del hilo principal, congelando el DMX tick a 44Hz.

### ¿Por qué `useShallow` NO salva a estos componentes?

`useShallow` hace una comparación shallow de las propiedades del objeto seleccionado. Cuando `selectHardware` devuelve `truth.hardware`, `useShallow` compara:
```
prevHardware.fixtures === nextHardware.fixtures
prevHardware.fixturesActive === nextHardware.fixturesActive
...
```
Como el backend genera `fixtures: fixtureStates.map(...)` (nuevo array + nuevos objetos en cada tick), la comparación `fixtures === fixtures` siempre devuelve `false`. Por tanto, `useShallow` devuelve el nuevo objeto, y Zustand dispara re-render.

**Conclusión:** `useShallow` funciona correctamente, pero el backend **destruye la estabilidad referencial** en el origen (Main Process). No es un problema de frontend; es un problema de frontera IPC.

---

## 📋 RESUMEN DE HALLAZGOS

1. **`truthStore.setTruth` reemplaza el objeto raíz completo.** No hay mecanismo de diff/delta. Cada suscripción a un objeto anidado dentro de `truth` está condenada a re-renderizar.

2. **`useHardware()` es el vector de ataque más dañino.** Seis componentes visibles lo consumen. Todos ellos re-renderizan a la frecuencia de truthStore.

3. **`useFixtureData` (para 2D) es reactivo; `useFixture3DData` (para 3D) no lo es.** El canvas 2D sufre re-renders indirectos por su hook. El canvas 3D está perfectamente aislado.

4. **El Data Pump de TacticalCanvas está correctamente aislado** (lectura imperativa en RAF), pero los `useEffect` secundarios (`SCAFFOLD`, `SELECTION`) sí se ejecutan en cada re-render de React.

5. **CommandDeck tiene un `setInterval(250ms)`** que es una fuente independiente de 4Hz re-renders, ajena a Zustand pero igualmente destructiva cuando colisiona con truthStore.

6. **El aislamiento del VisualizerCanvas 3D es el patrón a replicar:** suscribir solo a estructura (stageStore), leer física desde transientStore dentro de `useFrame()` / RAF.

---

*Fin del levantamiento topográfico React. Documento listo para entrega al Arquitecto.*
