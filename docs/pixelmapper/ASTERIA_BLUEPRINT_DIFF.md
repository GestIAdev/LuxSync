# 🜨 ASTERIA — BLUEPRINT DEVIATION AUDIT

> **WAVE 8180 — Gap Analysis.** Comparación exhaustiva entre el diseño teórico
> (`ASTERIA_PIXELMAP_BLUEPRINT.md`, Opus) y la implementación real en
> `electron-app/src/components/views/HephaestusView/asteria/` a fecha del
> commit `38fe2c16` (post-WAVE 8174).
>
> Método: lectura directa del blueprint (§5–§10) + auditoría de los 37
> archivos de producción de `asteria/` + verificación de consumidores
> (grep de setters/handlers). Documento de solo lectura — ninguna línea
> de producción modificada.

---

## 1. Implementado y fiel al Blueprint

### 1.1 Núcleo matemático y compilador (§5, §8)

| Pieza del blueprint | Estado | Referencia |
|---|---|---|
| Gesture Stack no destructivo (Photoshop del rig) | ✅ 7 kinds completos | `model/AsteriaProject.ts` — `base`/`wave`/`chrono`/`glyph`/`slice`/`manual`/`noise` |
| `fieldEngine` — pila → `FieldSnapshot` con ops replace/add/multiply | ✅ dispatch exhaustivo | `model/fieldEngine.ts:518-563` |
| Vía Λ (`spreadDeg:1`, overrides `absolute`, `offsetMs` clamp, ids `ast_*`) | ✅ + reglas duras §8.1 | `compiler/AsteriaCompiler.ts` |
| Λ-Ride (`lutSource.kind === 'ride'`) | ✅ compilador soporta | `compiler/AsteriaCompiler.ts` |
| Vía B cohortes (`quantizeGainCohorts`, `rotateCurveCyclic`, `dimmerScale`, `COHORT_ZONE_SPILL` honesto) | ✅ | `compiler/cohortQuantizer.ts`, `curveRotate.ts` |
| MCC / MCC-Cell (track por nodo×param, `cell=nodeId`) | ✅ | `compiler/AsteriaCompiler.ts`, `mccCapability.ts` |
| Árbol de decisión `auto` (§4.3) | ✅ | `compiler/AsteriaCompiler.ts` |
| Validador estructural + warnings de reporte | ✅ | `compiler/AsteriaCompiler.ts` |
| Bytes reales por `JSON.stringify` de tracks | ✅ en reporte | `compiler/AsteriaCompiler.ts` |
| Persistencia `clip.asteria` embebida (D-4) + línea serialize Δ5a | ✅ | `core/hephaestus/types.ts` |
| Rig Drift: fingerprint + banner + remap/discard/read-only | ✅ verbatim §10 | `model/rigDrift.ts`, `rigFingerprint.ts`, `useAsteriaRigDrift.ts` |
| Protocolo Poke §9.2 (heartbeat, fade-out, Esc, kill-switch, watchdog 500ms) | ✅ | `preview/useAsteriaTouch.ts` |
| `CalibrationBus` — único writer L3++ del renderer | ✅ | `preview/CalibrationBus.ts` |
| Node Atlas Δ4: `lux:aether:getNodeAtlas` one-shot + `topology_changed` debounced | ✅ | `canvas/useNodeAtlas.ts`, `AetherIPCHandlers.ts` |
| Undo/Redo por snapshots de referencia | ✅ + coalescing de sliders | `store/useAsteriaStore.ts` |
| Dogma Zero-Alloc: ningún cálculo espacial en `NodeArbiter`/`TickEngine` | ✅ respetado | todo el trabajo sucio se hornea en el `.lfx` |

### 1.2 UI fiel al layout §6.1–§6.2

- **Sutura de 4ª pestaña** — los 3 puntos de §6.1 aplicados: unión de tabs,
  botón `🜨 ASTERIA` con acento `#7b5cff`, host Tier 3 (`index.tsx:708,758`).
- **Canvas2D + RAF único** (§6.4, no R3F) — capas puras `ctx` en orden:
  Grid → CrystalBox → Gesture → Node → Feedback → HoverTag.
- **Grid métrico** — voxel 0.25 m + mayores 1 m adaptativos + ejes X=0/Z=0
  resaltados (`GridLayer.ts`), proyección XZ con Y ignorada (D-3).
- **Toolbox + hotkeys** — 8 slots, selección por clic/marquee/lazo/radio
  con `Shift` aditivo, `Esc` cancela, Ctrl+Z/Y undo/redo.
- **Gesture Stack panel** — capas con icono por kind, nodos dominados,
  click-to-select (ghosting), ✕ eliminar, reset.
- **Scrub temporal** — drawer de transporte con playhead a 44 Hz por ref.

---

## 2. Desviaciones positivas / evolución

Mejoras que NO están en el blueprint original pero aportan valor real:

| Evolución | WAVE | Valor |
|---|---|---|
| **CrystalBoxLayer** — sombreado fuera del mundo + perímetro CAD + reglas Top/Left con ticks métricos | 8170 | El blueprint solo pedía grid + ejes; el operador ahora *ve* dónde termina el mundo físico |
| **Iconografía Hyperion** — glifos diamante/hélice/láser/doble-anillo en vez de puntos + color por familia | 8170–8172 | Identidad industrial coherente con `TacticalCanvas2D`; legibilidad de tipo de aparato |
| **Screen-space scaling** — radio clamp [7,22]px, tipografía semidinámica [12,24]px | 8171–8172 | Los glifos jamás colapsan al hacer zoom-out |
| **Parent-aware fan matcher** — `/fan\|tungsten/i` sobre `FixtureV2` padre + fallback por `deviceId` + etiqueta de aparato (no de celda) | 8174 | Resuelve fixtures compuestos reales ("Fan Tungsten" con celdas "Wash Color") |
| **AsteriaTransportDrawer** — ▶⏸⏹ + scrubber + playhead 44 Hz por DOM-ref | 8150-F2 | El blueprint pedía una tira de scrub; se entregó transporte completo colapsable |
| **PolygonTool + LineTool** — polígono por vértices + banda con ancho | 8150-F4 | Herramientas de selección extra no previstas |
| **Gesture ghosting** — halo por kind del gesto seleccionado | 8150 | Preview no destructivo de la capa activa |
| **RadialTool dedicada** — radio en metros en vivo | 8020 | El blueprint lo pedía como `Ctrl+drag` dentro de Select; se promovió a tool propia |
| **GlyphTool bbox-fit** — el bounding box de la selección libre escala la fuente; máscara = selección exacta | 8160 | Más flexible que el rectángulo rígido del blueprint |
| **Coalescing de `updateGesture`** — burst de slider = 1 paso de undo | 8150-F3 | Undo limpio en drags continuos |

---

## 3. Discrepancias arquitectónicas (Missing / Deviated)

### 3.1 🔴 CRÍTICO — El GESTURE INSPECTOR no existe

El blueprint §6.2 reserva el rail para `GESTURE STACK` + `INSPECTOR`
(parámetros editables del gesto seleccionado) + `ESTRATEGIA`. El rail real
(`AsteriaView.tsx:220-372`) contiene:

```
NODE ATLAS → SELECCIÓN → GESTURE STACK → TARGET → [CELL SURGEON] → [GLYPH] → COMPILE
```

Los bloques **TARGET** y **COMPILE** ocupan el espacio del Inspector.
`updateGesture(id, patch)` y `moveGesture(id, idx)` existen en el store
con coalescing y undo integrados — pero un grep de consumidores confirma
**cero llamadas desde UI** (solo tests y comentarios). La superficie de
edición paramétrica no destructiva está construida y muerta.

Consecuencia por herramienta — **ningún gesto es reeditable**, contradiciendo
el contrato §7 ("todas son reeditables desde el inspector para siempre"):

| Gesto | Parámetros atrapados (sin UI) |
|---|---|
| `base` | `op`, `delayMs`, `gain` |
| `wave` | `speed`, `falloffM`, `dirDeg`, `shape`, `duty` |
| `chrono` | `radiusM` (fijo 0.8), post-proceso §T3: **escala temporal, invertir, suavizar, cuantizar a beat** |
| `glyph` | **`text` — hardcoded `'LUX'`** (`GlyphTool.ts:36`, y su propio JSDoc `:24` dice "se edita desde el inspector"), `rotDeg` fijo 0, `threshold`, `antialias` fijo `true`, `svgPath` |
| `slice` | `axis`, `buckets`, `spanMs`, `symmetry`, `shuffleSeed` |
| `noise` | `seed`, `scaleM`, `amountMs`, `octaves` |
| `manual` | `entries` (solo via CellSurgeon) |

### 3.2 🔴 Herramientas ausentes — 3 de las 8 del blueprint

| Tool | Blueprint | Estado |
|---|---|---|
| **T4 WAVEFRONT `〰`** | Emisor punto/línea/anillo, velocidad m/s, isócronas dibujadas, modo Huygens, falloffM | ❌ Sin tool. `WaveGesture` + `applyWave` existen y funcionan — **inalcanzable desde UI** |
| **T6 SLICER `⋮`** | Eje x/z/radius/angle/dmx/zone, buckets, spanMs, symmetry, shuffleSeed (hash PhaseConfigPro) | ❌ Sin tool. `SliceGesture` + `applySlice` completos — inalcanzable |
| **T8 NOISE `~`** | Seed, scaleM, amountMs, 1-3 octavas, hint de organicity | ❌ Sin tool. `NoiseGesture` + `applyNoise` completos — inalcanzable |

El toolbox tiene 8 botones pero 3 slots los ocupan los extras
`polygon`/`line`/`radial`. El resultado neto: **la herramienta insignia
T3 (ChronoBrush) existe, pero T4/T6/T8 son gestos huérfanos** — el motor
los evalúa, nadie puede crearlos.

### 3.3 Herramientas presentes con capacidades podadas

| Tool | Falta vs blueprint |
|---|---|
| `SelectTool` | `Alt` sustractivo · chips de filtro `COLOR/IMPACT/KINETIC/BEAM/ATMOSPHERE` × zona · **Select by Similarity** (`Ctrl+Shift+A`, `tools/similarity.ts` no existe) |
| `LassoTool` | Modo corredor `Alt` (polilínea con ancho en metros) |
| `ChronoBrushTool` | Post-proceso no destructivo del inspector (escala/invertir/suavizar/cuantizar a beat) — el modo `captureRealTime`/`arcLength` (Alt) sí existe |
| `GlyphTool` | Input de texto (fijo `'LUX'`), handles de transform en canvas (`rotDeg` siempre 0), `threshold`/`antialias` UI, path SVG |
| `CellSurgeonTool` | ✅ Completo — dblclick surgery, copy pattern, MCC-Z fallback honesto |

### 3.4 Capas y servicios de canvas ausentes (§6.3)

| Archivo del blueprint | Estado | Impacto |
|---|---|---|
| `layers/ZoneLayer.ts` (tintes por `CanonicalZone`) | ❌ | Sin visualización de zonas — el operador no ve la segmentación que usa el compilador Vía B |
| `layers/FieldLayer.ts` (heatmap delay + **isócronas**) | ❌ | Sin isócronas: el frente de onda de un `wave` es invisible antes de compilar. Toggle `🔥 HEAT` ausente |
| `layers/GestureOverlay.ts` (handles vivos del gesto) | ❌ | El gesto seleccionado solo hace *ghost* de sus nodos — no es manipulable sobre el canvas |
| `useSpatialIndex.ts` (grid hash 0.5 m) | ❌ | `selection.ts` hace scans lineales O(N) por pick/marquee — aceptable a ~500 nodos, desviación documentada |
| Carril **UNPLACED** (§10) | ❌ | Nodos sin `position` se omiten en silencio — pérdida de datos invisible para el operador |
| Fallback `ATLAS_UNAVAILABLE` → `stageStore` (§9.1) | ❌ | IPC fallido → error + canvas vacío. Blueprint pedía degradación a centros de fixture |
| Tooltip completo (nodeId/familia/zona/cota Y) | ⚠️ | El hover tag muestra solo la etiqueta — sin familia, zona ni cota Y (§6.4) |
| `Y` como tamaño de glifo | ❌ | Radio uniforme — la altura no se comunica visualmente |

### 3.5 Gesture Stack deformado

- **Sin reorder UI** — `moveGesture` implementado en store, sin botones/⌄⌃
  en el panel. La pila es FIFO de creación.
- **Sin columna `op`** — `replace`/`add`/`multiply` no es editable ni visible.
- **Sin 🔒 lock** — la columna de bloqueo de §5.1 no existe.

### 3.6 Estrategia de compilación inalcanzable

- `project.strategy` admite `auto`/`lambda`/`cohort`/`mcc`, pero el store
  **no tiene setter** — solo cambia cargando un documento ajeno. La UI
  muestra `report.strategy` como readout pasivo (COMPILE).
- **Λ-Ride es inalcanzable**: `lutSource: {kind:'ride', trackId}` se
  soporta en el compilador pero no hay UI para elegir el track fuente.
- `cohortBudget` idem — fijo en 16 (`ASTERIA_DEFAULT_COHORT_BUDGET`).

### 3.7 AUDITION ausente

Blueprint §6.2/§7-extras: al arrastrar el scrub, el clip compilado se envía
por el Protocolo Poke a los **focos reales**. Actual: `preview.seek()` solo
alimenta el `FeedbackLayer` visual — el scrub es espacial, no físico.

---

## 4. HUD y Presupuestos (§6.2, §8.4, §10)

**Veredicto: el bloque BUDGET está deformado — datos correctos, HUD ausente.**

| Blueprint §8.4 | Implementación real |
|---|---|
| `compiler/budget.ts` dedicado | ❌ El módulo no existe — el byte count vive inline en el compilador |
| Barra % vs 256 KB siempre visible | ❌ Solo texto `BYTES ~xx.x KB` en la sección COMPILE del rail |
| Umbrales verde <40% / ámbar 40-70% / rojo >70% | ❌ Sin codificación de color por presupuesto |
| Estimado post-ZIP + top-K de pistas | ❌ |
| Sugerencias accionables (bajar K, subir cuantización, decimar kf, MCC-Cell→MCC-Z) | ❌ |
| `BUDGET_EXCEEDED` bloquea compilación (§10) | ❌ **El modo de fallo no está implementado** — un clip de 300 KB compila sin aviso |

**Bottom strip §6.2** (`SCRUB + AUDITION + BUDGET`): reemplazado por el
drawer overlay (decisión 8150-F1 Ruta A). Scrub ✅, transporte ✅ (extra),
AUDITION ❌, barra BUDGET ❌.

**Indicadores HUD del lienzo** (`[zoom 1:40] [grid 0.25] [🔥 heat] [👁 live]`):
ausentes como readouts; las reglas del CrystalBox suplen zoom/grid
parcialmente. `HEAT` y `LIVE` no tienen toggle — `FeedbackLayer` está
always-on (equivale a LIVE permanente).

**Modos de fallo §10** — estado real:

| Modo | Estado |
|---|---|
| `ATLAS_UNAVAILABLE` | ⚠️ Error visible, **sin fallback** a centros de fixture |
| `RIG_DRIFT` | ✅ Banner + remap/discard/read-only |
| `BUDGET_EXCEEDED` | ❌ No implementado |
| `COHORT_ZONE_SPILL` | ✅ Warning honesto con nodos afectados |
| `CELL_MODE_UNAVAILABLE` | ✅ Banda MCC-Z + tooltip en CellSurgeon |
| `GLYPH_UNREADABLE` | 🔶 Degradado a `GLYPH_SUBOPTIMAL_RES` warning naranja — decisión deliberada 8160 |
| `LAMBDA_FROZEN_DRIFT` | ➖ Eliminado en 8160 (rama inalcanzable tras routing MCC de glyph) |

---

## 5. Resumen ejecutivo

```
NÚCLEO (modelo + fieldEngine + compilador):  ██████████  ~95% fiel
CANVAS (grid, atlas, poke, drift):           ████████░░  ~80% — faltan capas
HERRAMIENTAS (8 del blueprint):              █████░░░░░  ~50% — 3 ausentes
INSPECTOR / EDICIÓN PARAMÉTRICA:             ░░░░░░░░░░    0% — NO EXISTE
HUD / BUDGET / AUDITION:                     ███░░░░░░░  ~30% — deformado
```

**La asimetría es el hallazgo**: el motor es más capaz que la interfaz.
Cuatro kinds de gesto (`wave`, `slice`, `noise`, `manual` fuera del
surgeon) y una estrategia completa (`Λ-Ride`) están implementados,
testeados y **inalcanzables** porque el Inspector —el componente que el
blueprint diseñó para gobernarlos— nunca se construyó.

## 6. Prioridades sugeridas (orden de impacto)

1. **Gesture Inspector** — desbloquea reedición de los 7 kinds, estrategia,
   Λ-Ride, `cohortBudget`, y el post-proceso de Chrono. Es la WAVE madre.
2. **WavefrontTool + FieldLayer** (isócronas) — la herramienta insignia §T4.
3. **`budget.ts` + barra BUDGET + `BUDGET_EXCEEDED`** — seguridad del `.lfx`.
4. **SlicerTool + NoiseTool** — los gestos ya compilan, solo falta el lápiz.
5. **UNPLACED rail + fallback stageStore** — visibilidad de nodos huérfanos.
6. **AUDITION** — scrub físico via Poke.
7. **Select extras** — Alt sustractivo, chips zona×familia, similarity.

---

*Auditoría WAVE 8180 — solo lectura. Verificable por grep de los símbolos
citados sobre el commit `38fe2c16`.*
