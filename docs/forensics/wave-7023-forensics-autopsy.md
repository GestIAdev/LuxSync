



Ahora déjame revisar el panel de telemetría en HephRadar para la Q3:
Ahora también déjame verificar la definición de [PreviewFixtureState](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:35:0-63:1) para confirmar que no hay `phaseOffset` o `val` o `z`:

Ahora déjame verificar LabTab para ver cómo consume la vista previa:

Ahora déjame también revisar la función [drawReadouts](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/HephRadar.tsx:193:0-265:1) para entender qué muestra actualmente:

Ahora tengo toda la información. Déjame escribir el informe en Markdown.

# WAVE 7023: FORENSIC AUTOPSY — Motor de Preview [useHephPreview.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:0:0-0:0)

**Fecha:** 2026-06-26
**Sujeto:** [useHephPreview.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:0:0-0:0) + cadena de importación → [HephRadar.tsx](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/HephRadar.tsx:0:0-0:0)
**Prohibición:** Solo lectura e informe. Cero refactor.

---

## 1. El Origen de la Matriz (`fixtures`)

### ¿Cómo intenta resolver los focos reales?

La función `resolveFixtures()` (`useHephPreview.ts:326-452`) es el único constructor del array `fixtures`. Tiene 3 caminos de ejecución:

1. **CASE 1 — `zones.includes('all')`** (línea 331): Retorna un único foco desde [evaluateClipFrame()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1). No hay expansión a matriz real.
2. **CASE 2 — `zones.length === 0`** (línea 337): Mismo retorno — un único foco solitario.
3. **CASE 3 — Zones específicas** (línea 342+): Aquí sí intenta resolver focos reales. Mapea `stageFixturesRef.current` a objetos `ZoneMappable` y llama a `resolveZoneTags()` del `ZoneMapper`. Luego filtra `currentStageFixtures` por los IDs resueltos para construir `targetPool`.

### ¿Está importando `useStageStore` o `fixtureIndex` del núcleo de Aether?

**No directamente.** [useHephPreview](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:271:0-554:1) no importa `useStageStore`. Recibe `stageFixtures: FixtureV2[]` como **parámetro del hook** (línea 272). Es `LabTab.tsx:60` quien importa `useStageStore` y le pasa el array:

```typescript
// LabTab.tsx:59-63
const stageFixtures = useStageStore(selectFixtures)
const preview = useHephPreview(clip, stageFixtures)
```

Dentro del hook, `stageFixtures` se guarda en `stageFixturesRef` (línea 291) y se actualiza vía `useEffect` (líneas 295-297). No hay importación de `fixtureIndex` ni del núcleo de Aether.

### Fragmento exacto del array `fallback` (el foco solitario en pantalla)

```typescript
// useHephPreview.ts:330-339
// ── CASE 1: 'all' selected → Single fixture at center ──
if (zones.includes('all')) {
  const f = evaluateClipFrame(c, ev, timeMs)
  return [f]
}

// ── CASE 2: No zones selected → Fallback ──
if (zones.length === 0) {
  const f = evaluateClipFrame(c, ev, timeMs)
  return [f]
}
```

Y el objeto que retorna [evaluateClipFrame](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1) (líneas 256-265):

```typescript
// useHephPreview.ts:256-265
return {
  zone: 'all' as const,
  fixtureId: 'preview-all',
  label: 'ALL',
  radarX: 0.5,
  radarY: 0.5,
  dimmer, r, g, b,
  pan, panFine, tilt, tiltFine,
  white, amber, strobe, zoom, focus,
}
```

**Diagnóstico:** Si el clip tiene `spatialZones: ['all']` o `spatialZones: []`, el radar renderiza **obligatoriamente 1 foco** en `(0.5, 0.5)` normalizado → centro del canvas. No hay expansión a matriz real. El síntoma de "1 único foco en (0,0)" se explica porque `radarX=0.5, radarY=0.5` es el centro, y `pan=128, tilt=128` (defaults en línea 166-167) posicionan el dot en `(128/255)*w, (128/255)*h` ≈ centro cuando el canvas está en modo target-position.

---

## 2. El Blackout del Estrobo

### ¿Qué propiedad exacta de [PreviewFixtureState](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:35:0-63:1) muta cuando `isStrobe === true`?

**Nada.** [evaluateClipFrame()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1) (líneas 159-266) **no lee `clip.simulationMeta?.isStrobe` en absoluto**. No existe ninguna referencia a `simulationMeta`, `isStrobe`, o `strobe` como flag booleano de simulación dentro de la función.

Lo único que evalúa el strobe es el track con `paramId === 'strobe'` (líneas 244-246):

```typescript
// useHephPreview.ts:244-246
case 'strobe':
  strobe = scaleToDMX('strobe', raw)
  break
```

Esto asigna `strobe` como un valor DMX 0-255 al campo `PreviewFixtureState.strobe`. Es un valor continuo, no un gate booleano.

### ¿Por qué el canvas no parpadea?

El gate de parpadeo vive exclusivamente en `HephRadar.tsx:108-110`:

```typescript
// HephRadar.tsx:108-110
const strobeGate = fixture.strobe > 0
  ? (Math.sin(frameCount * (fixture.strobe / 255) * 0.3) > 0 ? 1 : 0.1)
  : 1
```

Este gate **sí funciona matemáticamente** — cuando `fixture.strobe > 0`, el `Math.sin()` oscila y produce alpha 1 ↔ 0.1. Sin embargo, hay dos posibles causas de blackout:

1. **`fixture.strobe` es siempre 0:** Si el clip no tiene un track con `paramId: 'strobe'` con keyframes no triviales, `scaleToDMX('strobe', raw)` retorna 0. El gate evalúa `strobe > 0` → false → `strobeGate = 1` (sin parpadeo). El estrobo no parpadea porque **no hay curva de estrobo evaluándose**.

2. **`clip.simulationMeta?.isStrobe` es ignorado:** El flag `isStrobe` del `simulationMeta` del clip **nunca se lee** en [evaluateClipFrame()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1). Aunque el operador active "strobe simulation" en el DnaRail, el motor de preview no lo consume. El estrobo solo responde a la curva `strobe` del track, no al flag de simulación.

**Veredicto:** No es que el color se evalúe a negro ni que `dim` sea 0 constante. Es que **el flag `isStrobe` de `simulationMeta` está desconectado del pipeline de evaluación**. El estrobo solo parpadea si hay una curva de `strobe` con valores > 0, independientemente de `simulationMeta`.

---

## 3. El Secuestro de la Telemetría

### Variables exactas que consume el panel flotante

El panel está en `HephRadar.tsx:500-533`. Consume estas variables del estado local:

```typescript
// HephRadar.tsx:501-506
const sel = preview.fixtures.find(f => f.fixtureId === selectedFixtureId) ?? preview.fixtures[0]
const phaseOffset = sel.fixtureId !== preview.fixtures[0]?.fixtureId
  ? `${((sel.pan / 255) * 360).toFixed(0)}º`
  : '0º'
```

Variables consumidas por campo:

| Campo JSX | Variable exacta | Origen |
|-----------|-----------------|--------|
| **ID (header)** | `sel.fixtureId.toUpperCase()` | `PreviewFixtureState.fixtureId` |
| **ID (label)** | `sel.label` | `PreviewFixtureState.label` |
| **DIM** | `sel.dimmer` | `PreviewFixtureState.dimmer` |
| **X** | `(sel.radarX * 100).toFixed(1)` | `PreviewFixtureState.radarX` |
| **Y** | `(sel.radarY * 100).toFixed(1)` | `PreviewFixtureState.radarY` |
| **PAN** | `sel.pan` | `PreviewFixtureState.pan` |
| **TILT** | `sel.tilt` | `PreviewFixtureState.tilt` |
| **PHASE** | `phaseOffset` (derivado de `sel.pan / 255 * 360`) | **Cálculo sintético — NO es el phaseOffset real** |

**Hallazgo crítico — PHASE es un fraude:** El campo `PHASE` del panel **no es el ángulo de desfase real aplicado por el `PhaseDistributor`**. Es un cálculo ad-hoc que convierte `pan` a grados. El `phaseOffsetMs` real se calcula en `resolveFixtures()` (línea 420) y se usa para desplazar el `timeMs` de evaluación (`offsetTime = Math.max(0, timeMs - phaseOffset)`), pero **nunca se almacena en [PreviewFixtureState](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:35:0-63:1)**. La interfaz no tiene campo `phaseOffset`. El panel miente.

**Para extirpar el `div` y mandarlo a [LabTab.tsx](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/tabs/LabTab.tsx:0:0-0:0):** Se necesita elevar `selectedFixtureId` y `preview.fixtures` al nivel de [LabTab](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/tabs/LabTab.tsx:52:0-190:1) (o pasarlos via props/callbacks). Actualmente `selectedFixtureId` es `useState` local dentro de [HephRadar](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/HephRadar.tsx:322:0-535:1) (línea 337) y no se expone hacia afuera.

---

## 4. Escaneo de las Ondas Prometidas

### ¿Existe algún buffer histórico para el osciloscopio?

**No. El sistema es 100% amnésico.**

- [useHephPreview.ts](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:0:0-0:0): No existe ningún array histórico, buffer circular, ni estructura pre-calculada para almacenar valores de fotogramas anteriores. El hook evalúa **exclusivamente** el `timeMs` actual (línea 423: [evaluateClipFrame(c, ev, offsetTime)](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1)). Cada frame se calcula from scratch y se descarta el anterior.

- [HephRadar.tsx](cci:7://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/HephRadar.tsx:0:0-0:0): El único estado persistente entre frames es `frameCounterRef` (un entero incremental) y `selectedFixtureIdRef` (string). No hay buffer de waveform, no hay `historyArray`, no hay `Float32Array` de samples.

- [HephPreviewState](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:65:0-76:1) (líneas 66-77): Solo contiene `playheadMs`, `progress`, `isPlaying`, `fixtures[]`, `frameCount`. No hay campo histórico.

- [PreviewFixtureState](cci:2://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:35:0-63:1) (líneas 36-64): Snapshot instantáneo. No hay referencia a estados previos.

**Veredicto:** Para implementar el osciloscopio superior (forma de onda de los últimos N fotogramas), se debe crear un buffer circular nuevo (`Float32Array(N)` o `number[]` con cap) desde cero. No existe infraestructura previa. El motor de preview es stateless entre frames por diseño — evalúa el milisegundo `t` y olvida todo lo anterior.

---

## Resumen de Hallazgos

| # | Pregunta | Veredicto |
|---|----------|-----------|
| 1 | Origen de la matriz | `resolveFixtures()` retorna 1 foco solitario si `zones` es `['all']` o `[]`. La matriz real solo se expande si hay zones específicas Y `stageFixtures` cargados. |
| 2 | Blackout del estrobo | `simulationMeta.isStrobe` **nunca se lee** en [evaluateClipFrame()](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/useHephPreview.ts:158:0-265:1). El strobo solo responde a la curva `strobe` del track. El flag de simulación está desconectado. |
| 3 | Secuestro de telemetría | Panel consume `sel.fixtureId`, `sel.label`, `sel.dimmer`, `sel.radarX/Y`, `sel.pan`, `sel.tilt`. `PHASE` es un cálculo falso (pan→grados), no el offset real. `selectedFixtureId` es local en [HephRadar](cci:1://file:///c:/Users/Raulacate/Desktop/Proyectos%20programacion/LuxSync/electron-app/src/components/views/HephaestusView/HephRadar.tsx:322:0-535:1), no expuesto. |
| 4 | Ondas prometidas | **Sistema 100% amnésico.** Cero buffers históricos. Se debe crear infraestructura desde cero para el osciloscopio. |