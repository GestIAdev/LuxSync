# RADIOGRAFÍA DEL GRAFO — Auditoría AST v2 (Post-Sutura)

> **Fecha:** 2026-06-24 (rev 2)
> **Scope:** `NodeGraphTab`, `NodeCanvas.tsx`, `NodePalette.tsx`, `forgeGraphStore.ts`, `types.ts`, `forgePalette.ts`, `forgeNodeTypeMap.ts`, `configPanelRegistry.ts`
> **Estado:** Post-sutura de tipados (WAVE AST SUTURE). Interfaces declaradas, factories purificadas, paleta expandida.

---

## 0. Cambios Aplicados (AST SUTURE)

### Interfaces declaradas en `types.ts`:
- `IInputBeatConfig` — `mode: 'pulse' | 'gate'`, `pulseDurationMs?`
- `IInputBpmConfig` — `outputMode: 'raw' | 'normalized'`, `rangeBpm?`
- `IInputEnergyConfig` — `source: 'rms' | 'peak'`, `smoothingMs?`
- `IInputTimeConfig` — `mode: 'seconds' | 'frames' | 'ramp'`
- `IProcInvertConfig` — sin campos extra
- `ILogicAndConfig` — sin campos extra
- `ILogicOrConfig` — sin campos extra

### Unión `IForgeNodeConfig` expandida: 7 nuevos miembros inyectados.

### Factories purificadas en `forgePalette.ts`:
| Factory | Antes | Ahora |
|---|---|---|
| `createInputBeatNode` | `input_constant, value: 0` | `input_beat, mode: 'pulse', pulseDurationMs: 50` |
| `createInputEnergyNode` | `input_constant, value: 0` | `input_energy, source: 'rms', smoothingMs: 100` |
| `createProcInvertNode` | `empty` | `proc_invert` |
| `createLogicGateNode` | `empty` | `logic_gate, threshold: 0.5` |

### Nuevas factories + entradas en `FORGE_PALETTE`:
`input_bpm`, `input_time`, `proc_delay`, `proc_merge`, `proc_curve`, `logic_and`, `logic_or`

### Cobertura actual paleta -> ForgeNodeType:
**23/23 tipos** tienen entrada en paleta (100%). `compound_ingenio` viaja por UAB, no por `FORGE_PALETTE`.

---

## 1. La Interfaz de Props

`NodeGraphTab` es **zero-props** (`React.FC` sin props en `FixtureForgeEmbedded.tsx:288`). Todo via Zustand.

`NodeCanvas` recibe: **`readOnly?: boolean`** (default `false`).

`NodePalette` no recibe props. Lee `useAssetLibraryStore` para pestana INGENIOS.

`ForgeCanvasLayout` recibe 3 slots `ReactNode`: `palette`, `canvas`, `inspector`.

---

## 2. El Catálogo de Disparos (Dispatches)

Cero dispatches al `forgeReducer`. Todo va al **`useForgeGraphStore`** (Zustand):

| Evento UI | Store Action | Ubicacion |
|---|---|---|
| Drag stop de nodo | `moveNode(id, x, y)` | `NodeCanvas.tsx:151` |
| Conectar cable | `addEdge(IForgeEdge)` | `NodeCanvas.tsx:178` |
| Drop desde NodePalette | `addNode(IForgeNode)` | `NodeCanvas.tsx:292` |
| Delete nodos (Del/Backspace) | `removeNode(id)` por cada nodo | `NodeCanvas.tsx:190` |
| Delete edges | `removeEdge(edgeId)` por cada edge | `NodeCanvas.tsx:199` |
| Selección cambia | `setSelection(ids)` + `inspectNode(firstId)` | `NodeCanvas.tsx:208-211` |
| Ctrl+A (select all) | `setSelection(allIds)` + `inspectNode(firstId)` | `NodeCanvas.tsx:228-229` |
| Clear canvas | `clearGraph()` | `FixtureForgeEmbedded.tsx:295` |
| Cambiar config (Inspector) | `updateNodeConfig(id, config)` — debounced 300ms | `NodeInspector.tsx:150` |
| Cambiar label (Inspector) | `updateNodeLabel(id, label)` — onBlur | `NodeInspector.tsx:130` |
| Duplicar nodo (Inspector) | `addNode(duplicate)` + `inspectNode(newId)` | `NodeInspector.tsx:179` |
| Borrar nodo (Inspector) | `removeNode(id)` + `inspectNode(null)` | `NodeInspector.tsx:185` |

---

## 3. El Motor de Renderizado

**`@xyflow/react`** (React Flow v12).

- Converters: `forgeNodeToXY` / `forgeEdgeToXY` (`NodeCanvas.tsx:62-80`)
- Custom nodes: 5 componentes visuales por categoria (`ForgeInputNode`, `ForgeProcessNode`, `ForgeLogicNode`, `ForgeOutputNode`, `ForgeCompoundNode`) registrados en `FORGE_NODE_TYPE_MAP`
- **23/23 ForgeNodeTypes** mapeados en `forgeNodeTypeMap.ts` (100% cobertura)
- Edges: `type: 'smoothstep'`
- Snap-to-grid: `[16, 16]`
- Zoom: `0.2` – `2`
- MiniMap + Controls + Background (dots)
- Selection: `SelectionMode.Partial`, `Shift` para lazo, `Ctrl/Meta` para multi-seleccion

---

## 4. El Grado de Control

**Dual-state con store como fuente de verdad:**

- **Source of Truth:** `useForgeGraphStore.graph: IForgeNodeGraph` (Zustand)
- **Estado local XYFlow:** `rfNodes`/`rfEdges` (`useState`) — derivado del store via `useEffect` (lineas 122-128)
- **Durante drag:** XYFlow muta solo `rfNodes` localmente (`applyNodeChanges`). Persiste al store **solo en `onNodeDragStop`** (linea 151)
- **Drop de paleta:** `addNode` al store + `setRfNodes` inmediato (linea 294)
- **Conexiones:** `addEdge_` al store + `setRfEdges` local (lineas 178-181)
- **Inspector config:** Double-buffer local (`configDraft`) + debounce 300ms -> `updateNodeConfig` al store (lineas 135-151)
- **moveNode** NO marca `isDirty` (cosmetico). El resto de mutaciones si.

**No hay batch-save diferido.** Cada interaccion persiste individualmente. Guardado a disco ocurre en `buildCompleteFixture()` -> lee `forgeGraph` del store.

---

## 5. Mapa de Cobertura Inspector (Post-Sutura)

### `CONFIG_PANEL_MAP` en `configPanelRegistry.ts`:

| ForgeNodeType | Panel dedicado | Estado |
|---|---|---|
| `input_dmx` | `InputDmxConfigPanel` | OK |
| `input_audio_band` | `InputAudioBandConfigPanel` | OK |
| `input_constant` | `InputConstantConfigPanel` | OK |
| `input_beat` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` |
| `input_bpm` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` |
| `input_energy` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` |
| `input_time` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` |
| `proc_lfo` | `LfoConfigPanel` | OK |
| `proc_smooth` | `SmoothConfigPanel` | OK |
| `proc_math` | `MathConfigPanel` | OK |
| `proc_map_range` | `MapRangeConfigPanel` | OK |
| `proc_clamp` | `ProcClampConfigPanel` | OK |
| `proc_delay` | `ProcDelayConfigPanel` | OK |
| `proc_merge` | `ProcMergeConfigPanel` | OK |
| `proc_curve` | `ProcCurveConfigPanel` | OK |
| `proc_invert` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` (sin config, aceptable) |
| `logic_gate` | `LogicGateConfigPanel` | OK |
| `logic_threshold` | `LogicThresholdConfigPanel` | OK |
| `logic_counter` | `LogicCounterConfigPanel` | OK |
| `logic_switch` | `LogicSwitchConfigPanel` | OK |
| `logic_and` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` (sin config, aceptable) |
| `logic_or` | **FALTANTE** | Cae a `GenericConfigFallbackPanel` (sin config, aceptable) |
| `output_dmx` | `OutputDmxConfigPanel` | OK |
| `compound_ingenio` | `CompoundIngenioConfigPanel` | OK |

**Veredicto:** 4 paneles faltantes criticos (`input_beat`, `input_bpm`, `input_energy`, `input_time`). 3 paneles faltantes triviales (`proc_invert`, `logic_and`, `logic_or` — sin campos configurables, fallback es suficiente).

---

## 6. ERRORES DE CABLEADO Detectados

### BUG-1: `addEdge` sin validacion de tipo de dato (CRITICO)

`forgeGraphStore.ts:233-248` — `addEdge` solo valida duplicados por ID. **No valida:**
- **Type mismatch:** Conectar un puerto `boolean` a uno `normalized` es aceptado silenciosamente
- **Port existence:** No verifica que `sourcePort`/`targetPort` existan en los nodos
- **Direction:** No verifica que source sea `out` y target sea `in`
- **Single-input rule:** No impide multiples edges hacia el mismo puerto de entrada (un input deberia tener 1 conexion maxima)

`ForgeValidationErrorCode` define `TYPE_MISMATCH`, `PORT_ALREADY_CONNECTED`, `INVALID_EDGE_SOURCE`, `INVALID_EDGE_TARGET` — **pero ninguna se usa en runtime**. Son tipos fantasma.

### BUG-2: `buildConfigPreview` sin casos para 7 tipos nuevos

`forgeNodeTypeMap.ts:95-167` — La funcion `buildConfigPreview` no tiene `case` para:
- `input_beat` -> preview vacio (deberia mostrar `mode: pulse`)
- `input_bpm` -> preview vacio (deberia mostrar `outputMode: normalized`)
- `input_energy` -> preview vacio (deberia mostrar `source: rms`)
- `input_time` -> preview vacio (deberia mostrar `mode: seconds`)
- `proc_invert` -> preview vacio (deberia mostrar `1.0 - input`)
- `logic_and` -> preview vacio (deberia mostrar `A ^ B`)
- `logic_or` -> preview vacio (deberia mostrar `A v B`)

**Impacto visual:** Los nodos nuevos se renderizan sin texto de preview en el canvas. Funcionalidad correcta, pero UX degradada.

### BUG-3: `onConnect` no previene multi-conexion a mismo input port

`NodeCanvas.tsx:157-184` — `onConnect` crea el edge sin verificar si el `targetPort` ya tiene una conexion entrante. XYFlow permite visualmente multiples cables al mismo handle. El evaluador asume 1 input = 1 edge.

### BUG-4: `moveNode` no marca `isDirty`

`forgeGraphStore.ts:194` — Comentario dice "es cosmetico", pero si el usuario mueve nodos y cierra sin guardar, las posiciones se pierden. Esto es **intencional** segun diseno, pero puede confundir al usuario que espera que el canvas "sucio" se persista.

### BUG-5: `handleDuplicate` usa contador local `_dupCounter` reiniciado en cada render

`NodeInspector.tsx:167` — `let _dupCounter = 0` se declara dentro del cuerpo del componente. Se reinicia a 0 en cada render. Si se duplica dos veces rapido, el ID generado podria colisionar si `Date.now()` retorna el mismo valor. Deberia ser `useRef` o modulo-level como `_nodeCounter` en NodeCanvas.

---

## 7. CARENCIAS ACTUALES y MARGENES DE MEJORA

### 7.1 — Sin sistema de Presets

**No existe ningun mecanismo de presets** para configuraciones de nodos. El usuario debe configurar cada nodo desde cero cada vez.

**Propuesta:**
- `NodePreset` interface: `{ name, nodeType, config, icon }`
- Presets embebidos (built-in): "LFO slow sine", "LFO beat-synced", "Smooth fast attack", "Smooth gentle", "Math multiply x2"
- Presets de usuario: persistidos en `localStorage` o en el asset library
- UI: boton "Presets" en el `NodeInspector` que abre un dropdown con presets filtrados por `nodeType`
- Aplicacion: `updateNodeConfig(nodeId, preset.config)`

### 7.2 — Sin validacion de grafo en runtime

`ForgeValidationErrorCode` y `ForgeValidationError` estan declarados en `types.ts:426-442` pero **nunca se instancian ni se muestran**. No hay:
- Deteccion de ciclos al conectar
- Validacion de que todo `output_dmx` tenga al menos 1 input conectado
- Deteccion de nodos huerfanos (sin conexiones)
- Colision de `dmxOffset` entre outputs

**Propuesta:** Funcion `validateGraph(graph: IForgeNodeGraph): ForgeValidationError[]` ejecutada on-demand (boton "Validate" en la action bar) o en tiempo de compilacion (`compileForgeState`).

### 7.3 — Sin auto-layout / organizador de grafo

No hay `auto-layout` ni `arrange` button. Con grafos complejos (20+ nodos), el usuario debe organizar manualmente.

**Propuesta:** Integrar `dagre` o `elkjs` para auto-layout topologico. Boton "Arrange" en la action bar del NodeGraphTab.

### 7.4 — Sin copy/paste de nodos

`NodeInspector` tiene "Duplicate" pero no hay copy/paste entre fixtures ni pegado desde clipboard. Tampoco hay Ctrl+C/Ctrl+V en el canvas.

**Propuesta:** Hook global `onKeyDown` en `NodeCanvasInner` para Ctrl+C/Ctrl+V. Serializar seleccion a JSON en clipboard. Al pegar, deserializar y `addNode` con nuevos IDs.

### 7.5 — Sin undo/redo

El store Zustand no tiene historial. No hay `undo` ni `redo`. Borrar un nodo por accidente es destructivo sin recuperacion.

**Propuesta:** `temporal` middleware de Zustand, o middleware custom que guarde snapshots del `graph` en un stack de tamano limitado (50 pasos). Botones Undo/Redo en la action bar.

### 7.6 — Sin edge labels ni annotations

Los edges no tienen labels, peso ni anotaciones. En grafos complejos es dificil distinguir que cable lleva que senal.

**Propuesta:** Edge data con `label` opcional derivado del `dataType` del puerto source. Renderizar badge en el midpoint del edge.

### 7.7 — Sin grouping / framing

No hay manera de agrupar nodos visualmente en "frames" o "zones" (cajas con titulo alrededor de un cluster de nodos). React Flow soporta esto nativamente via `ParentNode` / `extent: 'parent'`.

**Propuesta:** Nodo tipo `group` que contiene otros nodos. Util para organizar secciones logicas ("Color", "Movement", "Audio-reactive").

### 7.8 — Sin export/import de subgrafos ad-hoc

El "Pack as Ingenio" existe pero empaqueta como asset reusable. No hay manera de seleccionar nodos y exportarlos como JSON para pegar en otro fixture sin pasar por la libreria de Ingenios.

**Propuesta:** "Export selection as JSON" y "Import from JSON" en la action bar.

### 7.9 — `buildConfigPreview` incompleto

7 tipos nuevos sin preview. Correccion rapida: anadir cases en `forgeNodeTypeMap.ts:95-167`.

### 7.10 — Sin indicador de `isDirty` en la UI

El store tiene `isDirty: boolean` pero no se refleja visualmente en el NodeGraphTab. El usuario no sabe si hay cambios sin guardar en el grafo.

**Propuesta:** Badge o dot indicador en el boton de tab "NODE GRAPH" cuando `isDirty === true`.

### 7.11 — Sin node search / filter

Con 23 tipos de nodos en la paleta, no hay barra de busqueda ni filtro por texto. El usuario debe expandir categorias y escrollear.

**Propuesta:** Input de busqueda en `NodePalette` que filtre `ALL_PALETTE_ENTRIES` por `label` o `type`.

---

## 8. Resumen Ejecutivo (v2)

| Metrica | Antes (v1) | Ahora (v2) |
|---|---|---|
| Interfaces en `IForgeNodeConfig` | 18/25 | **25/25 (100%)** |
| Factories con config correcta | 16/23 | **23/23 (100%)** |
| Entradas en `FORGE_PALETTE` | 16/23 | **23/23 (100%)** |
| Tipos en `FORGE_NODE_TYPE_MAP` | 23/23 | 23/23 (sin cambios) |
| Paneles inspector dedicados | 17/23 | **17/23** (4 criticos faltantes) |
| `buildConfigPreview` coverage | 16/23 | **16/23** (7 sin preview) |
| Validacion de edges en runtime | No | **No** (tipos fantasma) |
| Presets | No | No |
| Undo/Redo | No | No |
| Auto-layout | No | No |

**Brechas cerradas por AST SUTURE:** 7 interfaces + 4 factories purificadas + 7 entradas de paleta.

**Brechas restantes (priorizadas):**
1. **CRITICO:** Validacion de edges (type mismatch, multi-input, port existence) — BUG-1
2. **ALTO:** 4 paneles inspector faltantes para nodos Audio (`input_beat`, `input_bpm`, `input_energy`, `input_time`)
3. **MEDIO:** `buildConfigPreview` incompleto (7 cases faltantes) — BUG-2
4. **MEDIO:** Sistema de presets
5. **MEDIO:** Undo/redo
6. **BAJO:** `handleDuplicate` counter bug — BUG-5
7. **BAJO:** Indicador `isDirty` en UI
8. **BAJO:** Auto-layout, node search, edge labels, grouping, copy/paste
