# AUTOPSIA TÉCNICA — LA FORJA DE FIXTURES
## WAVE: RADIOGRAFÍA DE LA FORJA (FixtureForgeEmbedded / useForgeStore)

> **ROL:** Auditor Forense Full-Stack  
> **MISIÓN:** Mapeo estático y profundo del flujo de estado y serialización. Sin código de solución. Solo autopsia.

---

## ÍNDICE

1. [Anatomía del Estado](#1-anatomía-del-estado)
2. [El Embudo de Compilación](#2-el-embudo-de-compilación)
3. [La Fuga de Datos](#3-la-fuga-de-datos)
4. [Vía de Inyección para el Gobernador](#4-vía-de-inyección-para-el-gobernador)

---

## 1. ANATOMÍA DEL ESTADO

La Forja opera con **DOS fuentes de verdad simultáneas**, separadas por paradigma pero entrelazadas por sync.

### 1.1 Paradigma A — Channel Rack (Legacy)

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx`

```tsx
// Línea 570
const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
```

**Dónde viven los datos:**
- `fixture.channels` → array de `FixtureChannel[]` ordenado por índice DMX 0-based.
- `fixture.capabilities` → objeto plano con flags (`hasPan`, `hasDimmer`, `colorEngine`, etc.).
- `fixture.physics` → perfil mecánico (motorType, maxAcceleration, homePosition, tiltLimits).
- `fixture.wheels` → rueda de colores (opcional).

Este estado es un `useState` React puro. Se muta directamente desde los handlers drag-and-drop del Rack.

### 1.2 Paradigma B — Aether Cells / Graph Node (V2)

**Archivo:** `src/stores/forgeGraphStore.ts`

```ts
// Líneas 31-34
export interface ForgeGraphState {
  graph: IForgeNodeGraph | null     // ← SOURCE OF TRUTH del canvas
  fixtureId: string | null
  isAutoMigrated: boolean
  // ...
}
```

El canvas visual XYFlow es **DERIVADO** de este store. Nunca al revés.

**Archivo:** `src/core/forge/forgeBuilderState.ts`

```ts
// Líneas 68-77
export interface IForgeBuilderState {
  readonly meta:         IForgeFixtureMeta
  readonly channels:     readonly FixtureChannel[]   // ← Driver del Rack
  readonly cells:        readonly IForgeCellBuilder[] // ← Driver de Aether Modules
  readonly capabilities: Readonly<Record<string, unknown>>
  readonly dirty:        boolean
}
```

**Reducer híbrido** (`forgeReducer`, línea 175) que maneja ambas tabs:
- Acciones tipo `CHANNEL_*` mutan el Rack.
- Acciones tipo `CELL_*` mutan las células Aether.
- `HYDRATE_FROM_FIXTURE` (línea 408) carga ambos mundos desde un `FixtureDefinition`.

### 1.3 El Puente de Sincronización (Bidireccional y Peligroso)

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` (líneas 810-860)

```tsx
// WAVE 4742: SYNC fixture.channels → forgeState.channels when Aether Cells exist
// WAVE 4830 FIX: Removed forgeState.channels from dep array — infinite loop
const forgeChannelsRef = useRef(forgeState.channels)
forgeChannelsRef.current = forgeState.channels

useEffect(() => {
  if (forgeState.cells.length === 0) return  // ← SOLO si hay células (hybrid mode)
  // Sync completo: evita que compileForgeState use deps stale
  fixture.channels.forEach((fixtureChannel, idx) => {
    const forgeChannelCurrent = forgeChannelsRef.current[idx]
    // ...comparación estructural sameDeps + sameChannel...
    if (!sameChannel) {
      forgeDispatch({ type: 'CHANNEL_REPLACE', idx, channel: deepClone(fixtureChannel) })
    }
  })
}, [fixture.channels, forgeState.cells.length, forgeDispatch])
```

**Diagnóstico:** Este sync es unidireccional **Rack → Cells**. Si el usuario modifica el grafo visual, no hay sync inverso automático a `fixture.channels`. Esto explica por qué `buildCompleteFixture` prioriza `currentChannels` sobre `compileResult.fixture.channels` (ver sección 2).

---

## 2. EL EMBUDO DE COMPILACIÓN

### 2.1 Diagrama de Flujo — Save

```
Usuario pulsa "Guardar"
  └── handleSave() [FixtureForgeEmbedded.tsx:1090]
        ├── PRE-CHECK compileForgeState(forgeState) [si cells.length > 0]
        │     └── validateState() → ok:false bloquea save (toast rojo)
        ├── fixtureSnapshot = deepClone(fixture)
        ├── completeFixture = buildCompleteFixture(fixtureSnapshot)
        │     ├── Channels:   fixtureForBuild.channels (RACK = source of truth)
        │     ├── Physics:    physics state React
        │     ├── Wheels:     wheelColors state React
        │     ├── Capabilities: derivadas de channels
        │     └── nodeGraph:  (a) forgeGraph snapshot, o (b) compileForgeState recompila
        ├── deepClone(completeFixture)
        ├── saveUserFixture(completeFixture) [libraryStore.ts:203]
        │     └── IPC: window.lux.library.saveUser(payload)
        │           └── IPCHandlers.ts: lux:library:save-user
        │                 └── fs.writeFileSync(filePath, JSON.stringify(payload, null, 2))
        └── loadFromDisk(true)  // silent reload
```

### 2.2 La Trampa del Pre-Check

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` (líneas 1096-1105)

```tsx
if (forgeState.cells.length > 0) {
  const preCheck = compileForgeState(forgeState)
  if (!preCheck.ok) {
    const firstError = preCheck.errors[0]
    setSaveMessage(`Save failed: ${firstError.message}`)
    setTimeout(() => setSaveMessage(null), 6000)
    console.error('[Forge 4732.3] Compile pre-check failed:', preCheck.errors)
    return  // ← ABORTA EL SAVE
  }
}
```

**Errores bloqueantes posibles** (Fase A de `compileForgeState`):

| Código | Condición | Mensaje típico |
|--------|-----------|----------------|
| `NO_CHANNELS` | 0 canales usable | *"El fixture no tiene canales definidos"* |
| `DUPLICATE_CELL_ID` | cellId repetido | *"cellId 'color-1' aparece 2 veces"* |
| `EMPTY_CELL` | cell sin canales | *"La célula 'Color' está vacía"* |
| `INCOMPATIBLE_CHANNEL_FAMILY` | canAdmit() falla | *"Canal CH1 (dimmer) incompatible con familia COLOR"* |
| `MISSING_DEP` | ignitionDep sin target | warning (no bloquea) |
| `AMBIGUOUS_DEP` | múltiples candidatos | warning (no bloquea) |

### 2.3 Compilación del NodeGraph desde Células

**Archivo:** `src/core/forge/compileForgeState.ts` (líneas 305-360)

```ts
function compileNodeGraph(state: IForgeBuilderState, resolvedChannels: readonly FixtureChannel[]): IForgeNodeGraph {
  const nodes: IForgeNode[] = []
  const edges: IForgeEdge[] = []
  const channelToCell = new Map<number, IForgeCellBuilder>()

  // Mapa rápido: canal → célula propietaria
  for (const cell of state.cells) {
    for (const idx of cell.channelIndices) {
      channelToCell.set(idx, cell)
    }
  }

  let rowIndex = 0
  const sortedChannels = [...resolvedChannels].sort((a, b) => a.index - b.index)

  for (const ch of sortedChannels) {
    if (ch.type === 'unknown') continue
    const ownerCell = channelToCell.get(ch.index)
    const inNode  = makeInputDmxNode(ch, rowIndex)
    const outNode = makeOutputDmxNode(ch, rowIndex, ownerCell?.cellId, ownerCell?.aetherZone, ownerCell?.label)
    const edge    = makeEdge(inNode.id, outNode.id, edgeIndex)
    nodes.push(inNode, outNode)
    edges.push(edge)
    rowIndex++; edgeIndex++
  }
  // ... meta + dmxFootprint
}
```

**Punto de falla crítico:** Si una célula tiene `channelIndices` que apuntan a canales tipo `'unknown'`, esos canales se saltean en `compileNodeGraph` (línea 327: `if (ch.type === 'unknown') continue`). Pero la célula sigue existiendo. En `validateState` (línea 117-126), si la célula queda vacía tras el skip → error `EMPTY_CELL` bloqueante.

### 2.4 El Fantasma en el JSON (WAVE 4872)

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` (líneas 1060-1085)

```tsx
if (forgeState.cells.length > 0) {
  const compileResult = compileForgeState(forgeState)
  if (compileResult.ok) {
    // WAVE 4872 — GHOST IN THE JSON FIX:
    // NO sobrescribir builtFixture.channels desde compileResult.fixture.channels.
    // compileResult puede estar basado en forgeState que lleva 1 tick de retraso
    // respecto al React state (Channel Rack), resucitando ignitionDeps eliminadas.
    builtFixture.nodeGraph = compileResult.fixture.nodeGraph
    builtFixture.channels = (builtFixture.channels as FixtureChannel[]).map(ch =>
      resolveChannelDeps(ch, builtFixture.channels as FixtureChannel[])
    )
    // ...
  } else {
    console.error('[Forge 4732-C] Blocking compile errors:', compileResult.errors)
    // Por ahora, no abortamos el save — el grafo anterior prevalece.
  }
}
```

**Diagnóstico:** Aunque `handleSave` aborta en pre-check, `buildCompleteFixture` tiene su propio fallback: si la compilación falla, el grafo anterior prevalece. Esto puede dejar un fixture con `nodeGraph` stale que no refleja las células actuales. **El fixture se guarda con un grafo huérfano.**

---

## 3. LA FUGA DE DATOS

### 3.1 `buildCompleteFixture` — Ensamblaje línea por línea

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` (líneas 1016-1058)

```ts
const builtFixture = {
  ...fixtureForBuild,                          // ← spread base: copia TODO lo que ya tuviera
  channels: syncedChannels,                    // ← INCLUIDO: Rack channels (source of truth)
  physics: {                                   // ← INCLUIDO: physics React state
    motorType: physics.motorType as any,
    maxAcceleration: physics.maxAcceleration,
    maxVelocity: physics.maxVelocity,
    safetyCap: physics.safetyCap,
    orientation: physics.orientation,
    invertPan: false,                          // ← FROZEN a false (CW-AUDIT-4)
    invertTilt: false,                         // ← FROZEN a false
    swapPanTilt: physics.swapPanTilt,
    homePosition: { ...physics.homePosition },
    tiltLimits: { ...physics.tiltLimits },
  },
  wheels: wheelColors.length > 0                // ← INCLUIDO condicional
    ? { colors: wheelColors }
    : undefined,
  capabilities: {                              // ← INCLUIDO: merged con derivadas
    ...fixtureForBuild.capabilities,
    colorEngine,
    colorWheel: wheelColors.length > 0 ? { colors: wheelColors, allowsContinuousSpin: false, minChangeTimeMs: wheelMinChangeTimeMs } : undefined,
    hasPan: syncedChannels.some(ch => ch.type === 'pan'),
    hasTilt: syncedChannels.some(ch => ch.type === 'tilt'),
    hasColorMixing: hasRgbColorMixing,
    hasColorWheel: syncedChannels.some(ch => ch.type === 'color_wheel'),
    hasGobo: syncedChannels.some(ch => ch.type === 'gobo'),
    hasPrism: syncedChannels.some(ch => ch.type === 'prism'),
    hasStrobe: syncedChannels.some(ch => ch.type === 'strobe'),
    hasDimmer: syncedChannels.some(ch => ch.type === 'dimmer'),
  },
} as FixtureDefinition & { nodeGraph?: unknown }

if (shouldPersistNodeGraph && graphSnapshot) {
  builtFixture.nodeGraph = graphSnapshot       // ← INCLUIDO: IForgeNodeGraph
}
```

### 3.2 Inventario de Pérdidas (¿Qué NO se serializa?)

| Dato | ¿Serializado? | ¿Por qué se pierde? |
|------|---------------|---------------------|
| `calibration` | ❌ NO | Nunca se edita en la Forja; viene de ShowFile |
| `dmxGovernors` | ❌ NO | **AÚN NO EXISTE en la UI de la Forja** |
| `capabilities.dimmerMin` | ❌ NO (sobrescrito) | `buildCompleteFixture` reconstruye `capabilities` desde cero; solo preserva `...fixtureForBuild.capabilities` vía spread, pero luego sobreescribe keys individuales |
| `capabilities.strobePersonality` | ❌ NO (sobrescrito) | Mismo problema: el spread inicial se anula por las keys explícitas posteriores |
| `capabilities.hasRotation` | ❌ NO (sobrescrito) | Se reconstruye desde `syncedChannels`, pierde el valor original si venía del JSON |
| `capabilities.hasCustomChannels` | ❌ NO (sobrescrito) | Idem |
| `capabilities.hasMacro` | ❌ NO (sobrescrito) | Idem |
| Estado crudo de `cells` | ❌ NO | Solo se serializa el `nodeGraph` derivado. Las células se re-hidratan en load via `hydrateCells()` (§3.3) |
| `uiPosition` de células | ⚠️ PARCIAL | Se guarda en `nodeGraph.nodes[].uiPosition` y `nodeGraph.meta`, pero las células mismas no persisten su layout |

### 3.3 Re-hidratación (Carga desde disco)

**Archivo:** `src/core/forge/forgeBuilderState.ts` (líneas 490-527)

```ts
function hydrateCells(fixture: FixtureDefinition): readonly IForgeCellBuilder[] {
  const graph = (fixture as unknown as Record<string, unknown>).nodeGraph as NodeGraphLike | undefined
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return []

  const buckets = new Map<string, { indices: number[]; zone?: string; label?: string }>()

  for (const node of graph.nodes) {
    if (node.type !== 'output_dmx') continue
    const cfg = node.config
    if (!cfg || typeof cfg.aetherNodeId !== 'string') continue
    const id = cfg.aetherNodeId
    if (!buckets.has(id)) {
      buckets.set(id, { indices: [], zone: cfg.aetherZone, label: cfg.cellLabel })
    }
    const dmxOffset = cfg.dmxOffset
    if (typeof dmxOffset === 'number') {
      buckets.get(id)!.indices.push(dmxOffset)
    }
  }

  if (buckets.size === 0) return []

  return Array.from(buckets.entries()).map(([cellId, bucket], i) => ({
    cellId,
    family: inferFamilyFromCellId(cellId),
    label: bucket.label || formatCellLabel(cellId),
    role: inferRoleFromCellId(cellId) as NodeRole,
    channelIndices: [...bucket.indices].sort((a, b) => a - b),
    aetherZone: bucket.zone,
    uiPosition: { x: 0, y: i * 140 },  // ← layout se pierde, se reconstruye en vertical stack
  }))
}
```

**Diagnóstico:** Las células se re-hidratan **desde los nodos output_dmx del nodeGraph**, agrupados por `aetherNodeId`. Si el fixture fue guardado con el grafo anterior (ghost JSON fix, sección 2.4), las células se reconstruyen con datos stale. El layout visual (`uiPosition: { x: 0, y: i * 140 }`) se pierde completamente — se reconstruye como stack vertical.

---

## 4. VÍA DE INYECCIÓN PARA EL GOBERNADOR

### 4.1 Requisito

Inyectar `dmxGovernors?: IDMXGovernor[]` sin romper:
- **Paradigma A (Channel Rack):** El usuario solo ve el Rack clásico, no el grafo.
- **Paradigma B (Aether Cells):** El usuario ve el canvas de nodos.

### 4.2 Punto más limpio en el Estado de la UI

**Opción recomendada:** Añadir `dmxGovernors` como campo directo del `fixture` state en `FixtureForgeEmbedded.tsx`, **sin pasar por `forgeState` ni el reducer**.

**Justificación:**
1. `dmxGovernors` es **hardware-specific metadata**, no pertenece al grafo topológico ni al Rack de canales.
2. No necesita ser manipulado por acciones de células ni de canales.
3. Es un array declarativo que se edita en un panel separado (ej. "Hardware Rules").

**Implementación conceptual:**

```tsx
// En FixtureForgeEmbedded.tsx, junto a los demás useState:
const [dmxGovernors, setDmxGovernors] = useState<IDMXGovernor[]>([])
```

**Hidratación en `loadFixtureIntoEditor`:**

```tsx
// Línea 697, después de setFixture(def):
setDmxGovernors(def.dmxGovernors ?? [])
```

### 4.3 Punto más limpio en la Función de Exportación

**Archivo:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` (línea 1016)

**Fragmento del cambio:**

```ts
const builtFixture = {
  ...fixtureForBuild,
  channels: syncedChannels,
  physics: { ... },
  wheels: wheelColors.length > 0 ? { colors: wheelColors } : undefined,
  capabilities: { ... },
  // 🏛️ DMX GOVERNOR ENGINE: Inyección declarativa de última milla
  dmxGovernors: dmxGovernors.length > 0 ? dmxGovernors : undefined,
} as FixtureDefinition & { nodeGraph?: unknown }
```

**Justificación:** `buildCompleteFixture` ya hace spread de `...fixtureForBuild`, por lo que si `fixtureForBuild` traía `dmxGovernors` del JSON original, se preservaría. Pero como la UI no tiene forma de editarlo, el valor podría quedar stale. La inyección explícita asegura que el estado UI (`dmxGovernors`) sobreescriba cualquier valor residual.

### 4.4 Punto más limpio en la Hidratación del Reducer

**Archivo:** `src/core/forge/forgeBuilderState.ts` (línea 408)

Si se decide pasar `dmxGovernors` por `forgeState` (alternativa más integrada):

```ts
case 'HYDRATE_FROM_FIXTURE': {
  const { fixture } = action
  return {
    meta: { ... },
    channels: hydrateChannels(fixture),
    cells: hydrateCells(fixture),
    capabilities: (fixture.capabilities as unknown as Record<string, unknown>) ?? {},
    dmxGovernors: fixture.dmxGovernors ?? [],  // ← Inyección
    dirty: false,
  }
}
```

Y añadir acciones tipo `GOVERNOR_ADD` / `GOVERNOR_REMOVE` al `ForgeAction` union.

### 4.5 Pipeline completo con Gobernador inyectado

```
UI: Panel "Hardware Rules" → setDmxGovernors([...])
  │
  └── buildCompleteFixture()
        ├── channels: syncedChannels
        ├── physics: physicsState
        ├── capabilities: derivedCapabilities
        ├── nodeGraph: graphSnapshot | compileResult.nodeGraph
        └── dmxGovernors: dmxGovernorsState   ← NUEVO
              │
              └── saveUserFixture(completeFixture)
                    └── IPC → IPCHandlers.ts
                          └── JSON.stringify(payload) → disk
                                └── fixture.json { ..., "dmxGovernors": [...] }
```

El backend (`IPCHandlers.ts:1365`) escribe el payload completo a disco con `JSON.stringify(payload, null, 2)`. Como `FixtureDefinition` ya acepta `dmxGovernors?`, el JSON resultante incluirá el campo sin modificar el handler IPC.

---

## ANEXO: DIAGRAMA DE FLUJO COMPLETO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FIXTURE FORGE EMBEDDED                           │
│                        (FixtureForgeEmbedded.tsx)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ useState     │     │ useReducer   │     │ useForgeGraph│                │
│  │ <FixtureDef> │     │ <IForgeBuilder│    │ Store        │                │
│  │              │     │  State>      │     │ <IForgeNodeGraph>│              │
│  │ fixture      │     │ forgeState   │     │ forgeGraph   │                │
│  │   .channels  │◄────│   .channels  │     │   .nodes     │                │
│  │   .capabilities│   │   .cells     │     │   .edges     │                │
│  │   .physics   │     │   .meta      │     │              │                │
│  │   .wheels    │     │              │     │              │                │
│  │   .nodeGraph │◄────│              │◄────│ (deepClone)  │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                      │                    │                     │
│         │  SYNC (unidireccional) │                    │                     │
│         │  Rack ──► Cells        │                    │                     │
│         └────────────────────────►│                    │                     │
│                                   │                    │                     │
│         ▼                         ▼                    ▼                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              buildCompleteFixture() [línea 983]                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  1. graphSnapshot = forgeGraph (canvas) o fixture.nodeGraph     │ │   │
│  │  │  2. syncGraphOutputsWithChannels(graphSnapshot, channels)     │ │   │
│  │  │  3. builtFixture = { channels, physics, wheels, capabilities }│ │   │
│  │  │  4. IF cells.length > 0:                                      │ │   │
│  │  │       compileResult = compileForgeState(forgeState)           │ │   │
│  │  │       IF ok:   builtFixture.nodeGraph = compileResult.nodeGraph│ │   │
│  │  │       IF !ok:  console.error (grafo anterior prevalece)       │ │   │
│  │  │  5. IF shouldPersistNodeGraph: builtFixture.nodeGraph = snapshot│ │   │
│  │  │  6. RETURN builtFixture                                       │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              handleSave() [línea 1090]                               │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  1. PRE-CHECK compileForgeState(forgeState) → aborta si error │ │   │
│  │  │  2. fixtureSnapshot = deepClone(fixture)                      │ │   │
│  │  │  3. completeFixture = buildCompleteFixture(fixtureSnapshot)   │ │   │
│  │  │  4. saveUserFixture(completeFixture) → IPC → disk              │ │   │
│  │  │  5. loadFromDisk(true) → silent reload                        │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (IPCHandlers.ts)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  lux:library:save-user                                                      │
│    ├── IF !channels.length AND nodeGraph exists:                             │
│    │      channels = NodeGraphBuilder.toChannels(nodeGraph)                  │
│    ├── Find existing file by ID → overwrite OR create new                   │
│    ├── payload.savedAt = new Date().toISOString()                            │
│    ├── payload.source = 'user'                                              │
│    └── fs.writeFileSync(path, JSON.stringify(payload, null, 2))             │
│                                                                             │
│  NOTA: El backend NO filtra ni valida qué keys existen en el payload.      │
│        Todo lo que llega del frontend se escribe directamente al JSON.     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Autopsia completada. WAVE: RADIOGRAFÍA DE LA FORJA.*
