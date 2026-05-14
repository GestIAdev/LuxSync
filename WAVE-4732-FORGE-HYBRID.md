# ⚡ WAVE 4732 — FORGE HYBRID ENGINE (Blueprint)

> **Estado:** Blueprint arquitectónico. No incluye implementación de UI.
> **Audiencia:** Equipo de Forge + Aether ingestion.
> **Precondición:** WAVE 4730 (Hive Mind / domain divorce) en main.

---

## 🎯 Objetivo

Convertir `FixtureForgeEmbedded.tsx` de un **mapeador plano de canales DMX** en una
**Forja Híbrida** capaz de producir perfiles multi-celulares complejos (Tungsten:
3 petals + wash + beam + impact + kinetic) sin que el operador escriba JSON ni
edite `nodeGraph` a mano.

La Forja se reorganiza en dos pestañas:

| Tab | Mundo | Responsabilidad |
|---|---|---|
| **DMX Layout** | Físico | Tabla de canales con type + default + ignitionDeps (`targetChannelIndex`) |
| **Aether Modules** | Lógico | Composición de células (nodes Aether) que agrupan canales físicos |

Ambas pestañas operan sobre el **mismo estado en memoria** (`IForgeCellBuilder`).
Al `Save`, un **compilador puro** traduce ese estado al `FixtureDefinition` final
(canales + `nodeGraph` + `ignitionDeps` por índice).

---

## 📐 Estado real del código (anclajes)

Antes de diseñar nada nuevo, lo que **ya existe** y debemos respetar:

### Contratos clave

`@/electron-app/src/types/FixtureDefinition.ts:156-174` (`IgnitionDependency`):

```ts
export interface IgnitionDependency {
  /** WAVE 4722: Índice DMX 0-based — precedencia ABSOLUTA sobre channelType */
  targetChannelIndex?: number
  channelType: ChannelType        // fallback semántico
  requiredValue: number           // 0-255
  mode?: 'hold' | 'release'
}
```

`@/electron-app/src/core/forge/types.ts:231-271` (`IOutputDmxConfig`):

```ts
interface IOutputDmxConfig {
  readonly nodeType: 'output_dmx'
  readonly channelType: ChannelType
  readonly dmxOffset: number
  readonly channelName?: string
  readonly defaultDmxValue: number
  readonly is16bit?: boolean
  readonly continuousRotation?: boolean
  readonly ignitionDeps?: readonly { channelType, requiredValue, targetChannelIndex?, mode? }[]
  /** ⭐ CLAVE DEL HÍBRIDO: nodos con el mismo aetherNodeId se agrupan en UN ICapabilityNode */
  readonly aetherNodeId?: string
  readonly aetherZone?: string
}
```

`@/electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:583-602`
(`_mapForgeNodes`): ya consume `targetChannelIndex → targetDmxOffset` y respeta
`aetherNodeId` para agrupación. **Backend está listo.** La UI es la única deuda.

### Deudas pendientes a tapar en esta wave

1. **UI ignitionDeps por type** (`FixtureForgeEmbedded.tsx:1342-1550`): el `<select>`
   dedupea `availableTargetTypes` y guarda solo `channelType`. Colisiona con
   fixtures de 2 dimmers (Tungsten: Golden + Stain). Fix descrito en §1.
2. **Roundtrip de `NodeGraphBuilder.makeOutputDmxNode`**
   (`@/electron-app/src/core/forge/NodeGraphBuilder.ts:124-129`): solo copia
   `channelType + requiredValue` desde el legacy. Pierde `targetChannelIndex`,
   `mode`, `aetherNodeId`, `aetherZone`. Fix descrito en §3.
3. **Inexistencia del Builder visual de células**: hoy no hay forma de
   declarar `aetherNodeId` desde la UI. Es lo que la Tab "Aether Modules" cubre.

---

## 🧱 1. TAB: DMX LAYOUT (El Mundo Físico)

### Modelo conceptual

Tabla idéntica a la actual (`channel-rack` en `FixtureForgeEmbedded.tsx:1330-1473`):
una fila por canal DMX con columnas: `#`, `Function`, `MIN`, `Default`,
`IgnitionDeps`, `Clear`.

**No se rediseña el grid.** Solo se reemplaza el panel expandido de Ignition Deps.

### Fix de Ignition Deps — selector por CANAL ABSOLUTO

#### Estado actual (defectuoso)

```tsx
// FixtureForgeEmbedded.tsx:1342-1346
const availableTargetTypes = fixture.channels
  .filter(ch => ch.type !== 'unknown' && ch.type !== channel.type)
  .map(ch => ch.type)
  .filter((t, i, arr) => arr.indexOf(t) === i)   // ← dedupe que rompe el Tungsten
```

→ El `<select>` muestra `[dimmer, shutter, color]` aunque haya 2 dimmers físicos.
→ El JSON guarda `channelType: 'dimmer'` → el resolver no sabe a cuál apuntar.

#### Diseño objetivo

El selector pasa a iterar **canales absolutos** (no tipos dedupeados):

**Opciones del `<select>`** (preview de UI, no implementación):

```
[CH1] Pan                       (type: pan)
[CH2] Golden Dimmer             (type: dimmer)
[CH7] Stain Dimmer              (type: dimmer)
[CH8] Shutter                   (type: shutter)
[CH9] Strobe                    (type: strobe)
...
```

**Reglas de filtrado:**
- Excluir el canal actual (no auto-dependencia).
- Excluir canales con `type === 'unknown'`.
- Mostrar `[CH${index+1}] ${name || type}` como label visible.
- `<option value>` = índice 0-based del canal (string serializable).

**Mutación al elegir:**

```ts
onSelect(targetIdx: number, depIdx: number) {
  const targetCh = fixture.channels[targetIdx]
  updateIgnitionDep(channelIdx, depIdx, {
    targetChannelIndex: targetIdx,           // ⭐ NUEVA fuente de verdad
    channelType: targetCh.type,              // fallback semántico (compat)
  })
}
```

**Render del dep existente:**

```
⚡  [CH7] Stain Dimmer  →  [255] DMX  [mode: hold ▾]  [✕]
```

El display siempre prioriza `targetChannelIndex` resolviéndolo contra
`fixture.channels[idx]`. Si el índice apunta a un slot vacío/borrado, se muestra
un badge `(missing)` en rojo — UX equivalente al actual `(missing)` para tipos.

**Nuevo control `mode` en la fila** (drop-down):
- `hold` (default): inyectar siempre.
- `release`: inyectar solo cuando el canal fuente > 0.

Hoy el tipo lo soporta (`IgnitionDependency.mode`) pero la UI no lo expone.

### Migración silenciosa de fixtures viejos

Al cargar un fixture con `ignitionDeps` que solo tienen `channelType`:
- **No se rompe nada**: el resolver de Aether ya hace fallback a `channelType`
  cuando `targetChannelIndex` es undefined.
- En el siguiente `Save` desde Forja, la UI resuelve **el primer canal de ese
  type** y lo persiste como `targetChannelIndex`, dejando `channelType` como
  redundancia documental.
- Para fixtures con **múltiples canales del mismo type** (Tungsten), el operador
  ve el badge `(ambiguous)` junto al dep y debe re-seleccionar explícitamente.

---

## 🧬 2. TAB: AETHER MODULES (El Mundo Lógico)

### Modelo conceptual

Una **célula Aether** (= `ICapabilityNode` en runtime) agrupa N canales DMX que
comparten una identidad funcional. Ejemplos del Tungsten:

| Célula (cellId) | Familia | Canales DMX agrupados |
|---|---|---|
| `petal-1` | COLOR | Petal1R, Petal1G, Petal1B |
| `petal-2` | COLOR | Petal2R, Petal2G, Petal2B |
| `petal-3` | COLOR | Petal3R, Petal3G, Petal3B |
| `wash` | COLOR | WashR, WashG, WashB, WashW |
| `beam` | BEAM | BeamFocus, BeamZoom |
| `impact` | IMPACT | Dimmer, Shutter, Strobe |
| `kinetic` | KINETIC | Pan, Tilt, PanFine, TiltFine |

Cada canal DMX **pertenece a exactamente una célula** (o a ninguna → célula
implícita por type para perfiles legacy planos).

### Estado en memoria

```ts
// Extensión del state hoy almacenado por FixtureForgeEmbedded
interface IForgeCellBuilder {
  /** ID estable de la célula. Estable cross-save. */
  readonly cellId: string                      // ej: 'petal-1', 'wash', 'beam'
  /** Familia Aether — determina por qué setter Programmer se rige. */
  readonly family: NodeFamily                  // COLOR | IMPACT | KINETIC | BEAM | ATMOSPHERE
  /** Etiqueta humana — alimenta CellDescriptor.label en runtime. */
  readonly label: string                       // 'Pétalo 1', 'Wash', 'Rayo'
  /** Rol semántico — alimenta CellDescriptor.role (afecta neon UI). */
  readonly role: NodeRole                      // 'primary'|'petal'|'wash'|'beam'|'rotor'|'ambient'
  /** Índices DMX (0-based) de los canales que componen esta célula. */
  readonly channelIndices: readonly number[]
  /** Zona Aether opcional (override por célula). */
  readonly aetherZone?: string                 // ej: 'flash', 'ambient'
  /** Posición visual en el lienzo de la tab — solo UX, no se compila. */
  readonly uiPosition?: { x: number; y: number }
}
```

**Identidad estable**: `cellId` se genera al crear y nunca cambia. Garantiza que
los `CellKey` runtime (`${deviceId}:${cellId}`) sean estables aunque el operador
edite el orden visual.

### Flujo UX

#### Layout de la tab

```
┌────────────────────────────────────────────────────────────────────────┐
│ AETHER MODULES                                       [+ New Cell  ▼]   │
├────────────────────────────────────────────────────────────────────────┤
│  ┌─ UNASSIGNED CHANNELS ───────────┐  ┌─ CELLS ────────────────────┐   │
│  │ [CH1] Pan          (pan)        │  │ ┌── petal-1  COLOR ──────┐ │   │
│  │ [CH2] Golden Dim   (dimmer)     │  │ │ • CH4 Petal1R           │ │   │
│  │ ...                              │  │ │ • CH5 Petal1G           │ │   │
│  │                                  │  │ │ • CH6 Petal1B           │ │   │
│  │ (drag a channel into a cell →)   │  │ │ [role: petal▾] [zone: flash▾] │   │
│  │                                  │  │ └─────────────────────────┘ │   │
│  │                                  │  │ ┌── wash    COLOR ──────┐ │   │
│  │                                  │  │ │ ... drop zone ...       │ │   │
│  │                                  │  │ └─────────────────────────┘ │   │
│  └──────────────────────────────────┘  └────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Interacciones

1. **Crear célula**: botón `[+ New Cell ▼]` despliega submenu con las 5 familias
   (`COLOR / IMPACT / KINETIC / BEAM / ATMOSPHERE`). Al elegir, se inserta un
   panel vacío en la columna derecha con `cellId` autogenerado
   (`${family.toLowerCase()}-${incremento}` ej. `color-1`, renombrable).

2. **Asignar canales** — dos rutas que **coexisten**:
   - **Drag & drop**: arrastrar un chip de canal desde la columna izquierda al
     panel de la célula. El canal pasa a `cell.channelIndices` y desaparece de
     "Unassigned".
   - **Selector múltiple**: dentro del panel de la célula, botón `[+ Channel]`
     abre un menú con los canales libres (igual al selector de DMX Layout). Útil
     para teclado.

3. **Reasignar canal**: arrastrar el chip dentro del panel hacia otra célula
   o hacia la zona "Unassigned" (= sin célula).

4. **Editar metadata** dentro del panel: `label` (input), `role` (select),
   `aetherZone` (select con valores del show + `<custom>`).

5. **Borrar célula**: botón `[✕]` en el header del panel → los canales vuelven a
   "Unassigned" automáticamente. Si la célula tenía un `cellId` previamente
   guardado, se confirma con modal porque rompe overrides persistidos
   (`cellOverrides.get(cellKey)` en el runtime store).

#### Validaciones en vivo

- Una célula **no puede mezclar canales de families incompatibles**. La UI
  pinta un warning si, ej., se arrastra un `pan` (kinetic) a una célula `COLOR`.
  No es bloqueante (el operador puede tener razón en un fixture raro) pero
  visible.
- Canales con `type === 'unknown'` no son arrastrables.
- Una célula sin canales = warning amarillo "empty cell will be skipped at save".

#### Vista plana de fallback

Para perfiles simples (LED PAR), la Tab Aether Modules muestra un toggle
**"Auto-generate from DMX types"** que aplica la heurística legacy
(`NodeExtractionPipeline._buildAllNodes`): agrupa por type semántico → 1 célula
COLOR (RGB), 1 IMPACT (dimmer), etc. El operador puede partir de ahí y editar.

---

## ⚙️ 3. EL COMPILADOR DEL GRAPH (Store / Exporter)

### Estado en memoria — interfaces completas

```ts
import type { ChannelType, FixtureChannel } from '@/types/FixtureDefinition'
import type { NodeFamily, NodeRole } from '@/core/aether/types'

/**
 * Estado COMPLETO del builder durante la edición. Vive en el useState/useReducer
 * de FixtureForgeEmbedded. Es la única fuente de verdad de ambas tabs.
 */
export interface IForgeBuilderState {
  /** Metadatos del fixture (manufacturer, name, type, mode, channelCount...). */
  readonly meta: IForgeFixtureMeta
  /**
   * Canales DMX en orden de offset. Driver de la Tab DMX Layout.
   * Mantiene `index` consistente con `dmxOffset` 0-based.
   */
  readonly channels: readonly FixtureChannel[]
  /**
   * Catálogo de células declaradas por el operador en la Tab Aether Modules.
   * Si está vacío en `Save`, el compilador cae al modo "auto" (heurística por type).
   */
  readonly cells: readonly IForgeCellBuilder[]
  /**
   * Capabilities sueltas (dimmerMin, wheels…) — sin cambios respecto al estado actual.
   */
  readonly capabilities: Record<string, unknown>
}

export interface IForgeFixtureMeta {
  readonly manufacturer: string
  readonly name: string
  readonly type: FixtureType
  readonly mode?: string
  readonly channelCount: number
}

export interface IForgeCellBuilder {
  readonly cellId: string
  readonly family: NodeFamily
  readonly label: string
  readonly role: NodeRole
  readonly channelIndices: readonly number[]
  readonly aetherZone?: string
  readonly uiPosition?: { x: number; y: number }
}
```

### Reducers / mutadores (firma — no implementación)

```ts
// Tab DMX Layout
type DmxAction =
  | { type: 'CHANNEL_SET_TYPE';      idx: number; channelType: ChannelType }
  | { type: 'CHANNEL_SET_NAME';      idx: number; name: string }
  | { type: 'CHANNEL_SET_DEFAULT';   idx: number; value: number }
  | { type: 'IGNITION_ADD';          idx: number; dep: IgnitionDependency }
  | { type: 'IGNITION_UPDATE';       idx: number; depIdx: number; patch: Partial<IgnitionDependency> }
  | { type: 'IGNITION_REMOVE';       idx: number; depIdx: number }

// Tab Aether Modules
type CellAction =
  | { type: 'CELL_CREATE';       family: NodeFamily; cellId?: string }
  | { type: 'CELL_RENAME';       cellId: string; label: string }
  | { type: 'CELL_SET_ROLE';     cellId: string; role: NodeRole }
  | { type: 'CELL_SET_ZONE';     cellId: string; zone?: string }
  | { type: 'CELL_DELETE';       cellId: string }
  | { type: 'CELL_ATTACH_CHANNEL';   cellId: string; channelIdx: number }
  | { type: 'CELL_DETACH_CHANNEL';   cellId: string; channelIdx: number }
  | { type: 'CELL_MOVE_CHANNEL';     fromCellId: string; toCellId: string; channelIdx: number }
```

**Invariantes que el reducer garantiza:**
- `CELL_ATTACH_CHANNEL` quita automáticamente el `channelIdx` de cualquier otra
  célula (un canal pertenece a UNA célula a lo sumo).
- `CELL_DELETE` libera todos sus canales.
- Borrar un canal del array `channels` también lo desasocia de su célula.

### Compilador: `compileForgeState(state): FixtureDefinition`

Función **pura, sincrónica, sin side-effects**. Vive en
`@/electron-app/src/core/forge/compileForgeState.ts` (nuevo). Tiene 3 fases:

#### Fase 1 — Validación

- Cada `cell.channelIndices` apunta a un canal existente con `type !== 'unknown'`.
- No hay canales compartidos entre células.
- `cells.length === 0` → modo legacy (compatible).
- Devuelve `Result<FixtureDefinition, ForgeValidationError[]>` para que la UI
  muestre los errores sin grabar.

#### Fase 2 — Resolución de IgnitionDeps

Para cada `channel.ignitionDeps[]`:
- Si `dep.targetChannelIndex` es válido → mantener tal cual.
- Si no, pero `dep.channelType` resuelve a **un único canal**, completar
  `targetChannelIndex` con ese índice (auto-upgrade silencioso).
- Si `channelType` resuelve a múltiples canales → conservar tal cual pero marcar
  warning. El backend usará el primer match (comportamiento actual).

#### Fase 3 — Generación del `nodeGraph`

El compilador genera un `IForgeGraph` cuyos nodos son los `output_dmx` ya
existentes, **con `aetherNodeId` poblado**:

```ts
// Pseudocódigo del kernel del compilador
function compileNodeGraph(state: IForgeBuilderState): IForgeGraph {
  const nodes: IForgeNode[] = []

  // 1. Para cada canal: crear output_dmx
  for (const ch of state.channels) {
    if (ch.type === 'unknown') continue
    const owningCell = state.cells.find(c => c.channelIndices.includes(ch.index))

    const config: IOutputDmxConfig = {
      nodeType:        'output_dmx',
      channelType:     ch.type,
      dmxOffset:       ch.index,
      channelName:     ch.name,
      defaultDmxValue: ch.defaultValue,
      is16bit:         ch.is16bit || undefined,
      continuousRotation: ch.continuousRotation || undefined,
      // ⭐ ATAJO MULTI-CELL: si hay cell, todos sus canales comparten aetherNodeId
      aetherNodeId:    owningCell?.cellId,
      aetherZone:      owningCell?.aetherZone,
      ignitionDeps:    ch.ignitionDeps?.map(resolveDep),  // fase 2
    }
    nodes.push(makeOutputDmxNode(ch, config))
  }

  // 2. Sin cells declaradas → comportamiento legacy (auto group por type en pipeline)
  // 3. (Futuro: nodos compute/lfo si la Forja se amplía)

  return { nodes, edges: [], metadata: { ... } }
}
```

El runtime ya hace el resto:
`NodeExtractionPipeline._buildNodesFromForgeGraph` (existente) detecta los
`aetherNodeId` repetidos y produce **un `ICapabilityNode` por célula** con
sus `channelDefs[]` ya unidos — exactamente lo que `useCapabilityCells` /
`useAggregatedCapabilityCells` necesita para emitir la UI correcta.

### Bugs del roundtrip Forge → Channel → Forge

Hoy `@/electron-app/src/core/forge/NodeGraphBuilder.ts:124-129` solo copia
`channelType + requiredValue` desde el legacy `FixtureChannel`. Esto destruye:
- `targetChannelIndex` (rompe el fix de la Tab 1).
- `mode` (rompe el control nuevo).
- No existe ruta para `aetherNodeId` / `aetherZone` viniendo del legacy porque el
  legacy `FixtureChannel` no los tiene.

**Decisión de diseño:** el `nodeGraph` se vuelve **fuente de verdad maestra**
para multi-cell y deps por índice. El compilador SOLO va Forge State →
`FixtureDefinition`, **nunca regenera el State desde el legacy plano**. Al abrir
un fixture viejo:
- Si trae `nodeGraph` → se hidrata el `IForgeBuilderState.cells` extrayendo
  `aetherNodeId` agrupados.
- Si NO trae `nodeGraph` → la Tab Aether Modules abre vacía con el banner
  "Auto-generate from DMX types" disponible (no se construye automáticamente
  para no falsear el origen).

Esto evita el bug del roundtrip: nunca se ejecuta el roundtrip legacy → graph
en perfiles nuevos. El path destructivo de `makeOutputDmxNode` solo aplica al
modo de compatibilidad importación.

### JSON resultante (forma final)

```jsonc
{
  "id": "tungsten-pro-fan-19ch",
  "manufacturer": "Acme",
  "name": "Tungsten Pro Fan",
  "type": "fan",
  "channels": [
    { "index": 0, "type": "pan",    "name": "Pan",     "defaultValue": 128 },
    { "index": 1, "type": "tilt",   "name": "Tilt",    "defaultValue": 128 },
    { "index": 2, "type": "dimmer", "name": "Golden Dimmer", "defaultValue": 0,
      "ignitionDeps": [
        { "targetChannelIndex": 8, "channelType": "shutter", "requiredValue": 255, "mode": "hold" }
      ]
    },
    { "index": 3, "type": "red",    "name": "Petal1R", "defaultValue": 0 },
    // …
    { "index": 7, "type": "dimmer", "name": "Stain Dimmer", "defaultValue": 0,
      "ignitionDeps": [
        { "targetChannelIndex": 8, "channelType": "shutter", "requiredValue": 255, "mode": "hold" }
      ]
    }
  ],
  "nodeGraph": {
    "nodes": [
      { "id": "out-pan-0",  "type": "output_dmx",
        "config": { "channelType":"pan",  "dmxOffset":0, "aetherNodeId":"kinetic", "aetherZone":"movement" } },
      { "id": "out-tilt-1", "type": "output_dmx",
        "config": { "channelType":"tilt", "dmxOffset":1, "aetherNodeId":"kinetic", "aetherZone":"movement" } },
      { "id": "out-dimmer-2", "type": "output_dmx",
        "config": { "channelType":"dimmer", "dmxOffset":2, "aetherNodeId":"impact-golden",
                    "ignitionDeps":[{ "targetChannelIndex":8, "channelType":"shutter", "requiredValue":255 }] } },
      { "id": "out-red-3", "type": "output_dmx",
        "config": { "channelType":"red",   "dmxOffset":3, "aetherNodeId":"petal-1", "aetherZone":"flash" } },
      // … petal-1 (R,G,B), petal-2, petal-3, wash, beam …
      { "id": "out-dimmer-7", "type": "output_dmx",
        "config": { "channelType":"dimmer", "dmxOffset":7, "aetherNodeId":"impact-stain",
                    "ignitionDeps":[{ "targetChannelIndex":8, "channelType":"shutter", "requiredValue":255 }] } }
    ],
    "edges": [],
    "metadata": { "compiledBy": "ForgeHybrid@4732", "fixtureId": "tungsten-pro-fan-19ch" }
  }
}
```

Resultado en runtime: `NodeExtractionPipeline.extract()` produce
`IDeviceDefinition.nodes` con (entre otros) los nodos `tungsten-01:petal-1`,
`tungsten-01:petal-2`, `tungsten-01:wash`, `tungsten-01:impact-golden`,
`tungsten-01:impact-stain`, `tungsten-01:kinetic`. La célula Hive Mind
(`useAggregatedCapabilityCells`) los agrupa por `family+role+label` y la UI
renderiza un acordeón por célula con los sliders correctos.

---

## 🗺️ Roadmap de implementación (fases sugeridas)

| Fase | Alcance | Riesgo | Dependencias |
|---|---|---|---|
| **4732-A** | Migrar state interno a `IForgeBuilderState` (sin cambios UI) | Bajo | — |
| **4732-B** | Fix UI ignitionDeps por canal absoluto + control `mode` | Bajo | 4732-A |
| **4732-C** | Tab Aether Modules MVP (crear/borrar células, attach por selector) | Medio | 4732-A |
| **4732-D** | Drag & drop de canales a células | Medio | 4732-C |
| **4732-E** | Compilador `compileForgeState` + reemplazar el save actual | Alto | 4732-B + 4732-C |
| **4732-F** | Hidratación reversa: open fixture con `nodeGraph` → poblar cells | Medio | 4732-E |
| **4732-G** | Tests de propiedad: Forge State ↔ FixtureDefinition idempotencia | Bajo | 4732-E |

Cada fase es **mergeable independientemente** y deja la Forja en un estado
funcional. 4732-A es prerequisito de todo lo demás porque cambia la fuente de
verdad del componente.

---

## 🔒 Riesgos y contramedidas

| Riesgo | Mitigación |
|---|---|
| Fixtures viejos en `userFixtures` se rompen al re-abrir en la Forja híbrida. | El compilador es **aditivo**: si el fixture viejo no tiene `nodeGraph`, la Tab Aether Modules abre vacía y el `Save` preserva el formato legacy salvo que el operador toque algo. |
| El operador deja una célula vacía y rompe la extracción. | Validación dura en fase 1 del compilador: célula sin canales → bloquea el save con error UX claro (no warning). |
| Cambiar `cellId` desde la UI invalida `cellOverrides` persistidos en runtime. | `cellId` NO es renombrable por el operador (solo `label`). Se autogenera y permanece. El display label es libre. |
| Roundtrip ignitionDeps legacy pierde `targetChannelIndex`. | Documentado: NO se hace roundtrip a legacy. El `nodeGraph` es la fuente maestra desde la primera Save. |
| `aetherNodeId` colisiona entre cells si el operador renombra mal. | `cellId` se valida unique-per-fixture en el reducer (`CELL_CREATE` y `CELL_RENAME` rechazan duplicados). |

---

## ✅ Definición de "hecho" para WAVE 4732

1. La Tab DMX Layout permite seleccionar **canal absoluto** como target de
   `ignitionDeps`, y el JSON guarda `targetChannelIndex`.
2. La Tab Aether Modules permite construir el nodeGraph del Tungsten sin tocar
   JSON (3 petals + wash + beam + 2 impact + kinetic).
3. Al guardar y recargar, los canales aparecen en la misma célula, los
   `aetherNodeId` se preservan y `NodeExtractionPipeline` produce los nodos
   esperados.
4. `useAggregatedCapabilityCells` (WAVE 4730) consume el nodeGraph emitido por
   la Forja híbrida y produce los grupos por familia/role esperados sin tocar
   código de runtime.
5. `tsc --noEmit`: 0 errores. Sin warnings de tipo en el compilador.

---

*Blueprint redactado en WAVE 4732. Sucesor de WAVE-4723-CAMALEON-BLUEPRINT.md.
La implementación se trackea en sub-waves 4732-A..G.*
