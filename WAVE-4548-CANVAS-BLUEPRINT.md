# WAVE 4548.8a — THE CANVAS BLUEPRINT

## Diseño Arquitectónico: Interfaz de Usuario para el Forge NodeGraph

**Estado:** DISEÑO ARQUITECTÓNICO  
**Fase:** N5 — UI del Canvas de Nodos  
**Prerequisito:** N1-N4 completos (types, builder, compiler, evaluator)  
**Componente destino:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx`

---

## 1. DEPENDENCIA EXTERNA: @xyflow/react

El proyecto **no tiene** actualmente ninguna librería de node-graph visual.
Se selecciona **@xyflow/react v12** (el sucesor de react-flow) por:

- API basada en hooks + controlled state (compatible con Zustand)
- Soporte nativo de custom nodes, custom edges, handles tipados
- Minimap, Controls, Background grid integrados
- Zero-dependency en Three.js (no conflicto con @react-three ya existente)
- Licencia MIT (no impacta distribución de LuxSync)

```
npm install @xyflow/react
```

**Impacto:** ~180KB gzip. Solo se carga en la ruta `/forge` (ya lazy-loaded).

---

## 2. GESTIÓN DEL ESTADO

### 2.1 Principio Fundamental: Dual State, Single Source of Truth

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  VISUAL STATE (Canvas)   │       │  DATA STATE (Forge)      │
│  ─────────────────────── │       │  ─────────────────────── │
│  XYFlow nodes[]          │  ←→   │  IForgeNodeGraph         │
│  XYFlow edges[]          │  sync  │  (source of truth)       │
│  viewport (pan/zoom)     │       │                          │
│  selection set           │       │  IForgeNodeConfig[]      │
│  drag state              │       │  (node parameters)       │
└──────────────────────────┘       └──────────────────────────┘
         ▲                                    ▲
         │ useReactFlow()                     │ useForgeGraphStore()
         │ (local, ephemeral)                 │ (Zustand, persistent)
         ▼                                    ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│  NodeCanvas.tsx           │       │  NodeInspector.tsx        │
│  (renders the graph)      │       │  (edits node config)     │
└──────────────────────────┘       └──────────────────────────┘
```

### 2.2 Store Design: `useForgeGraphStore` (Zustand)

Un store Zustand dedicado al estado del grafo Forge, **separado** del `libraryStore` y del estado visual del canvas.

```typescript
// stores/forgeGraphStore.ts

interface ForgeGraphState {
  // ── Source of Truth ──────────────────────────────────────
  /** El grafo completo del fixture en edición */
  graph: IForgeNodeGraph | null

  /** ID del fixture que posee este grafo */
  fixtureId: string | null

  /** ¿El grafo fue auto-migrado desde channels[] legacy? */
  isAutoMigrated: boolean

  // ── Selection ───────────────────────────────────────────
  /** IDs de los nodos seleccionados en el canvas */
  selectedNodeIds: Set<ForgeNodeId>

  /** ID del nodo cuyo inspector está abierto (null = ninguno) */
  inspectedNodeId: ForgeNodeId | null

  // ── Undo/Redo ───────────────────────────────────────────
  /** Stack de estados anteriores para undo */
  undoStack: IForgeNodeGraph[]

  /** Stack de estados para redo */
  redoStack: IForgeNodeGraph[]

  // ── Dirty Flag ──────────────────────────────────────────
  /** true si el grafo ha sido modificado desde el último save */
  isDirty: boolean

  // ── Actions ─────────────────────────────────────────────
  /** Carga un grafo completo (al abrir un fixture) */
  loadGraph: (graph: IForgeNodeGraph, fixtureId: string, autoMigrated: boolean) => void

  /** Añade un nodo al grafo (desde la Palette, drag-drop) */
  addNode: (node: IForgeNode) => void

  /** Elimina un nodo y sus edges conectados */
  removeNode: (nodeId: ForgeNodeId) => void

  /** Mueve un nodo en el canvas (solo actualiza uiPosition) */
  moveNode: (nodeId: ForgeNodeId, x: number, y: number) => void

  /** Actualiza la config interna de un nodo (desde el Inspector) */
  updateNodeConfig: (nodeId: ForgeNodeId, config: Partial<IForgeNodeConfig>) => void

  /** Actualiza el label de un nodo */
  updateNodeLabel: (nodeId: ForgeNodeId, label: string) => void

  /** Añade una conexión entre dos puertos */
  addEdge: (edge: IForgeEdge) => void

  /** Elimina una conexión */
  removeEdge: (edgeId: ForgeEdgeId) => void

  /** Selección de nodos */
  setSelection: (nodeIds: ForgeNodeId[]) => void

  /** Abre el inspector para un nodo */
  inspectNode: (nodeId: ForgeNodeId | null) => void

  /** Undo/Redo */
  undo: () => void
  redo: () => void

  /** Resetea el dirty flag (al guardar) */
  markClean: () => void
}
```

### 2.3 Sincronización Canvas ↔ Store

La sincronización entre XYFlow y el store Zustand se basa en **dos adaptadores** dentro del componente `NodeCanvas`:

#### Canvas → Store (onNodesChange, onEdgesChange)

```typescript
// Dentro de NodeCanvas.tsx
const onNodesChange = useCallback((changes: NodeChange[]) => {
  // 1. Aplicar cambios visuales al XYFlow local state
  setRfNodes(prev => applyNodeChanges(changes, prev))

  // 2. Si es un cambio de POSICIÓN, propagar al store solo en onDragStop
  //    (NO en cada frame del drag — evita rerenders del Inspector)
}, [])

const onNodeDragStop = useCallback((_event: React.MouseEvent, node: XYNode) => {
  // Solo aquí se escribe la posición final al store
  moveNode(node.id, node.position.x, node.position.y)
}, [moveNode])
```

#### Store → Canvas (hydration on load)

```typescript
// Dentro de NodeCanvas.tsx
const hydrateCanvasFromGraph = useCallback((graph: IForgeNodeGraph) => {
  const rfNodes: XYNode[] = graph.nodes.map(forgeNodeToXYNode)
  const rfEdges: XYEdge[] = graph.edges.map(forgeEdgeToXYEdge)
  setRfNodes(rfNodes)
  setRfEdges(rfEdges)
}, [])
```

### 2.4 Inspector sin Re-render del Canvas

**Problema:** Si cada keystroke en el Inspector actualiza `IForgeNodeGraph`, XYFlow re-renderiza todos los nodos.

**Solución: Doble Buffer + Debounce**

```
Inspector keystroke
    │
    ▼
┌─────────────────────┐
│ localConfigDraft     │  ← useState local del Inspector
│ (mutable, no Zustand)│
└─────────────────────┘
    │ onBlur / debounce 300ms
    ▼
┌─────────────────────┐
│ store.updateNodeConfig│  ← Escribe al store (triggera sync)
└─────────────────────┘
    │
    ▼
  IForgeNodeGraph actualizado (solo el nodo cambiado)
```

El `NodeInspector` lee del store con un **selector granular**:

```typescript
const nodeConfig = useForgeGraphStore(
  useShallow(state => {
    if (!state.inspectedNodeId || !state.graph) return null
    return state.graph.nodes.find(n => n.id === state.inspectedNodeId)?.config ?? null
  })
)
```

Esto garantiza que **solo el Inspector** re-renderiza cuando cambia la config del nodo inspeccionado, y **no** el canvas completo.

---

## 3. JERARQUÍA DE COMPONENTES

### 3.1 Árbol Completo

```
ForgeView (index.tsx)
└── FixtureForgeEmbedded.tsx           ← Container principal
    ├── <ForgeHeader />                ← Nombre fixture, Save, Export, Modo Dual toggle
    ├── <ForgeTabs />                  ← LIBRARY | GENERAL | NODE GRAPH | CHANNEL RACK | ...
    │
    ├── {activeTab === 'library'  && <LibraryTab />}
    ├── {activeTab === 'general'  && <GeneralPanel />}      ← Existente (refactored)
    │
    ├── {activeTab === 'nodegraph' && (                     ← ★ NUEVO TAB
    │     <ForgeCanvasLayout>
    │       ├── <NodePalette />                              ← Sidebar izquierda
    │       │     ├── <PaletteCategory category="input" />
    │       │     ├── <PaletteCategory category="process" />
    │       │     ├── <PaletteCategory category="logic" />
    │       │     ├── <PaletteCategory category="output" />
    │       │     └── <PaletteCategory category="compound" />
    │       │
    │       ├── <NodeCanvas />                               ← Centro: @xyflow/react
    │       │     ├── <ReactFlow>
    │       │     │     ├── nodeTypes={FORGE_NODE_TYPE_MAP}
    │       │     │     │     ├── ForgeInputNode
    │       │     │     │     ├── ForgeProcessNode
    │       │     │     │     ├── ForgeLogicNode
    │       │     │     │     ├── ForgeOutputNode
    │       │     │     │     └── ForgeCompoundNode
    │       │     │     ├── edgeTypes={FORGE_EDGE_TYPE_MAP}
    │       │     │     │     └── ForgeDataEdge
    │       │     │     ├── <MiniMap />
    │       │     │     ├── <Controls />
    │       │     │     └── <Background variant="dots" />
    │       │     └── </ReactFlow>
    │       │
    │       └── <NodeInspector />                            ← Sidebar derecha
    │             ├── <InspectorHeader />
    │             ├── {nodeType → dynamic config panel}
    │             │     ├── <LfoConfigPanel />
    │             │     ├── <SmoothConfigPanel />
    │             │     ├── <MathConfigPanel />
    │             │     ├── <MapRangeConfigPanel />
    │             │     ├── <ThresholdConfigPanel />
    │             │     ├── <OutputDmxConfigPanel />
    │             │     ├── <InputDmxConfigPanel />
    │             │     └── ... (un panel por IForgeNodeConfig)
    │             └── <InspectorPortList />
    │     </ForgeCanvasLayout>
    │   )}
    │
    ├── {activeTab === 'channels' && <ChannelRackPanel />}   ← Existente (refactored)
    ├── {activeTab === 'wheelsmith' && <WheelSmithPanel />}
    ├── {activeTab === 'physics'  && <PhysicsPanel />}
    └── {activeTab === 'export'   && <ExportPanel />}
```

### 3.2 Componentes Principales — Firmas

#### ForgeCanvasLayout

```typescript
/**
 * Layout de 3 columnas para el tab NODE GRAPH.
 * Palette (240px) | Canvas (flex) | Inspector (300px, colapsable)
 */
interface ForgeCanvasLayoutProps {
  children: React.ReactNode  // Palette + Canvas + Inspector
}
```

#### NodePalette

```typescript
/**
 * Sidebar izquierda con nodos arrastrables agrupados por categoría.
 * Cada nodo se arrastra al canvas con drag-and-drop nativo de @xyflow.
 */
interface NodePaletteProps {
  /** Categorías expandidas (accordion) */
  expandedCategories: Set<ForgeNodeCategory>
  onToggleCategory: (cat: ForgeNodeCategory) => void
  /** Filtro de búsqueda */
  searchQuery: string
  onSearchChange: (query: string) => void
  /** Callback al iniciar drag de un tipo de nodo */
  onDragStart: (event: React.DragEvent, nodeType: ForgeNodeType) => void
}
```

#### NodeCanvas

```typescript
/**
 * Wrapper de @xyflow/react ReactFlow.
 * Gestiona el estado visual local (nodos, edges, viewport)
 * y sincroniza con useForgeGraphStore en eventos discretos.
 */
interface NodeCanvasProps {
  /** Modo read-only (Simple Mode lock) */
  readOnly?: boolean
}
```

#### NodeInspector

```typescript
/**
 * Panel de propiedades del nodo seleccionado.
 * Renderiza un ConfigPanel dinámico según nodeType.
 * Utiliza draft local + debounce para evitar re-render del canvas.
 */
interface NodeInspectorProps {
  /** Si collapsed, muestra solo un icono de expand */
  collapsed: boolean
  onToggleCollapse: () => void
}
```

---

## 4. MODO DUAL: SIMPLE vs ADVANCED

### 4.1 Definición

| Aspecto | Simple Mode | Advanced Mode |
|---------|-------------|---------------|
| **Vista principal** | Channel Rack (array lineal) | Node Graph (canvas visual) |
| **Modelo de datos** | Edita `channels[]` directamente | Edita `IForgeNodeGraph` directamente |
| **Sincronización** | `channels[]` ← NodeGraphBuilder.toChannels(graph) | `graph` ← fuente de verdad |
| **Capacidad** | Solo passthrough (input→output) | Cualquier topología |
| **Target user** | Operador que define un fixture básico | Diseñador que crea lógica reactiva |

### 4.2 Toggle en el Header

```
┌────────────────────────────────────────────────────────────────────┐
│  🔨 FIXTURE FORGE    [Model Name]          ┃ SIMPLE ◉ ○ ADVANCED ┃│
│                                             ┃     [mode toggle]   ┃│
└────────────────────────────────────────────────────────────────────┘
```

El toggle es un `<ForgeModeSwitcher>` integrado en el `<ForgeHeader>`.

### 4.3 Lógica de Transición

```typescript
type ForgeEditMode = 'simple' | 'advanced'

/**
 * Determina si un grafo se puede representar en Simple Mode.
 *
 * REGLA: Simple Mode es válido SI Y SOLO SI el grafo es
 * estrictamente "passthrough" — cada output_dmx tiene exactamente
 * un input_dmx conectado directamente, sin nodos intermedios.
 *
 * @returns true si el grafo es simple-compatible
 */
function isSimpleCompatible(graph: IForgeNodeGraph): boolean {
  // 1. Solo nodos input_dmx y output_dmx
  const hasComplexNodes = graph.nodes.some(n =>
    n.category === 'process' ||
    n.category === 'logic' ||
    n.category === 'compound'
  )
  if (hasComplexNodes) return false

  // 2. Todas las audio/beat/bpm/energy/time inputs → no simple
  const hasNonDmxInputs = graph.nodes.some(n =>
    n.type !== 'input_dmx' &&
    n.type !== 'input_constant' &&
    n.type !== 'output_dmx'
  )
  if (hasNonDmxInputs) return false

  // 3. Cada edge es input_dmx.out → output_dmx.in (1:1)
  for (const edge of graph.edges) {
    const src = graph.nodes.find(n => n.id === edge.sourceNode)
    const dst = graph.nodes.find(n => n.id === edge.targetNode)
    if (!src || !dst) return false
    if (src.type !== 'input_dmx' || dst.type !== 'output_dmx') return false
  }

  return true
}
```

### 4.4 Flujo de Transición: Simple → Advanced

```
User clicks "ADVANCED"
    │
    ├── graph ya es complex? → Abrir Advanced directamente
    │
    └── graph es passthrough (auto-migrated)?
         └── Abrir Advanced con el grafo actual
              (el usuario puede empezar a añadir nodos process/logic)
```

### 4.5 Flujo de Transición: Advanced → Simple

```
User clicks "SIMPLE"
    │
    ├── isSimpleCompatible(graph)?
    │     YES → Switch a Simple Mode (Channel Rack)
    │            channels[] se regenera vía NodeGraphBuilder.toChannels(graph)
    │
    └── NO → Mostrar warning modal:
              "⚠️ COMPLEX GRAPH DETECTED
               This graph contains process/logic nodes that cannot
               be represented in Simple Mode. Switching would
               discard all non-passthrough nodes.

               [Cancel] [Switch Anyway (destructive)]"

              Si "Switch Anyway":
                1. Extraer solo los output_dmx nodes
                2. Regenerar passthrough graph via NodeGraphBuilder.fromChannels()
                3. Marcar como dirty
```

### 4.6 Legacy Fixture → Simple Mode (apertura)

```
User opens legacy fixture (no nodeGraph)
    │
    ├── normalizeFixture() ya hydrated nodeGraph via NodeGraphBuilder
    │   (WAVE 4548.3 interceptor in libraryStore)
    │
    └── isAutoMigrated = true
         → Abrir en Simple Mode por defecto
         → Toggle a Advanced disponible
         → Banner: "Auto-migrated from channels[]. Switch to Advanced for full control."
```

### 4.7 Bloqueo de Simple Mode (Read-Only Lock)

Si el grafo contiene nodos complejos y el usuario intenta usar Simple Mode:

```typescript
/**
 * Decide si Simple Mode es editable o read-only.
 */
function getSimpleModeStatus(graph: IForgeNodeGraph): 'editable' | 'readonly' | 'unavailable' {
  if (!graph) return 'editable'             // No graph → editable (new fixture)
  if (isSimpleCompatible(graph)) return 'editable'
  
  // Graph has complex nodes → Simple Mode shows a degraded view
  // The channel rack is shown as read-only (derived from output_dmx nodes)
  return 'readonly'
}
```

En modo `readonly`, el Channel Rack se renderiza con:
- Todos los inputs deshabilitados (grayed out)
- Banner superior: `"🔒 Read-only: This fixture uses a complex node graph. Edit in Advanced Mode."`
- Botón prominente: `"→ Switch to Advanced"`

---

## 5. DISEÑO VISUAL DE NODOS CUSTOM

### 5.1 Estética: "Cyberpunk Industrial"

El diseño visual sigue la estética establecida del proyecto ("THE GLOW"):

- **Fondo base:** `#0a0a0f` (near-black con hint azulado)
- **Bordes de nodo:** Finos, 1px, con el color de la categoría
- **Glow:** Box-shadow con el color categoría a 20% opacity
- **Tipografía:** `'JetBrains Mono', monospace` para valores; `system-ui` para labels
- **Superficies:** Glass-morphism sutil — `background: rgba(15, 15, 25, 0.85)` con `backdrop-filter: blur(8px)`

### 5.2 Paleta de Colores por Categoría

| Categoría | Color Principal | Glow Color | Hex |
|-----------|----------------|------------|-----|
| **INPUT** | Cyan eléctrico | Cyan 20% | `#00f3ff` |
| **PROCESS** | Verde neón | Green 20% | `#39ff14` |
| **LOGIC** | Amarillo ámbar | Amber 20% | `#ffb800` |
| **OUTPUT** | Rojo industrial | Red 20% | `#ff2d55` |
| **COMPOUND** | Violeta profundo | Purple 20% | `#bf5af2` |

### 5.3 Anatomía de un ForgeNode Custom

```
┌─── CATEGORY BAR (4px, color sólido categoría) ──────────────┐
│                                                               │
│  [icon]  LFO Oscillator                    ⚙ [config icon]  │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  ● amplitude ─────────────────────── output ●                │
│  ● modulation                                                 │
│                                                               │
│  ┌─────────────────────────────────────────────┐             │
│  │  ∿ sine  │ 2.0 Hz │ BPM sync: OFF         │             │
│  └─────────────────────────────────────────────┘             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Elementos:
1. **Category Bar** — Barra superior de 4px del color de la categoría
2. **Header** — Icono + Nombre del nodo + Botón de config (abre Inspector)
3. **Port Handles** — Izquierda (inputs), Derecha (outputs)
4. **Config Preview** — Mini-resumen inline de los parámetros principales
5. **Border** — 1px del color categoría a 40% opacity
6. **Glow** — `box-shadow: 0 0 12px 0 rgba(color, 0.15)` cuando seleccionado

### 5.4 Handles (Puertos) Tipados por Color

Los handles de conexión usan colores basados en `ForgeDataType`:

| DataType | Color Handle | Shape |
|----------|-------------|-------|
| `normalized` | `#ffffff` (blanco) | Círculo relleno |
| `dmx` | `#ff6b35` (naranja) | Círculo relleno |
| `boolean` | `#ffb800` (ámbar) | Diamante ◆ |
| `frequency` | `#00f3ff` (cyan) | Círculo relleno |
| `angle` | `#bf5af2` (violeta) | Círculo relleno |
| `unbounded` | `#71717a` (gris) | Círculo outline ○ |

### 5.5 Edges (Conexiones)

- **Color**: Gradiente del color del handle source → handle target
- **Estilo**: `smoothstep` (curva suave, no bezier agresiva)
- **Animación**: Cuando hay señal fluyendo, animación de "pulso" (CSS animation con dash-offset)
- **Grosor**: 2px normal, 3px cuando hover, 1.5px cuando unselected

### 5.6 Custom Node Component Factory

```typescript
// components/views/ForgeView/nodes/ForgeNodeFactory.tsx

/**
 * Registra los custom node types para @xyflow/react.
 * Cada categoría tiene un componente base con variantes por tipo.
 */
const FORGE_NODE_TYPE_MAP: NodeTypes = {
  // Cada ForgeNodeType se mapea a un componente visual
  input_dmx:         ForgeInputNode,
  input_audio_band:  ForgeInputNode,
  input_beat:        ForgeInputNode,
  input_bpm:         ForgeInputNode,
  input_energy:      ForgeInputNode,
  input_constant:    ForgeInputNode,
  input_time:        ForgeInputNode,

  proc_lfo:          ForgeProcessNode,
  proc_smooth:       ForgeProcessNode,
  proc_map_range:    ForgeProcessNode,
  proc_math:         ForgeProcessNode,
  proc_clamp:        ForgeProcessNode,
  proc_delay:        ForgeProcessNode,
  proc_merge:        ForgeProcessNode,
  proc_invert:       ForgeProcessNode,
  proc_curve:        ForgeProcessNode,

  logic_threshold:   ForgeLogicNode,
  logic_gate:        ForgeLogicNode,
  logic_switch:      ForgeLogicNode,
  logic_and:         ForgeLogicNode,
  logic_or:          ForgeLogicNode,
  logic_counter:     ForgeLogicNode,

  output_dmx:        ForgeOutputNode,

  compound_ingenio:  ForgeCompoundNode,
}
```

### 5.7 Firma de un Custom Node

```typescript
// components/views/ForgeView/nodes/ForgeProcessNode.tsx

import { Handle, Position, type NodeProps } from '@xyflow/react'

interface ForgeProcessNodeData {
  forgeNode: IForgeNode        // Referencia al nodo del grafo
  categoryColor: string         // Color de la categoría
  isSelected: boolean           // ¿Está seleccionado?
  configPreview: string         // Mini-resumen de la config (texto corto)
}

const ForgeProcessNode: React.FC<NodeProps<ForgeProcessNodeData>> = ({ data }) => {
  const { forgeNode, categoryColor, isSelected, configPreview } = data

  return (
    <div
      className={`forge-node forge-node--process ${isSelected ? 'selected' : ''}`}
      style={{
        '--node-color': categoryColor,
        '--node-glow': `${categoryColor}33`,
      } as React.CSSProperties}
    >
      {/* Category bar */}
      <div className="forge-node__category-bar" />

      {/* Header */}
      <div className="forge-node__header">
        <span className="forge-node__icon">{getNodeIcon(forgeNode.type)}</span>
        <span className="forge-node__label">{forgeNode.label || forgeNode.type}</span>
      </div>

      {/* Input handles */}
      {forgeNode.inputs.map((port, i) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          style={{
            top: `${40 + i * 24}px`,
            background: getDataTypeColor(port.dataType),
          }}
        />
      ))}

      {/* Output handles */}
      {forgeNode.outputs.map((port, i) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          style={{
            top: `${40 + i * 24}px`,
            background: getDataTypeColor(port.dataType),
          }}
        />
      ))}

      {/* Config preview */}
      {configPreview && (
        <div className="forge-node__config-preview">{configPreview}</div>
      )}
    </div>
  )
}
```

---

## 6. CONVERSIÓN IForgeNode ↔ XYFlow Node

### 6.1 Forge → XYFlow (para renderizado)

```typescript
function forgeNodeToXYNode(node: IForgeNode): XYNode<ForgeNodeData> {
  return {
    id: node.id,
    type: node.type,                              // Mapea a FORGE_NODE_TYPE_MAP
    position: { x: node.uiPosition.x, y: node.uiPosition.y },
    data: {
      forgeNode: node,
      categoryColor: getCategoryColor(node.category),
      isSelected: false,                           // Se actualiza por el canvas
      configPreview: buildConfigPreview(node),
    },
    dragHandle: '.forge-node__header',             // Solo el header es draggable
  }
}
```

### 6.2 Forge → XYFlow Edge

```typescript
function forgeEdgeToXYEdge(edge: IForgeEdge): XYEdge {
  return {
    id: edge.id,
    source: edge.sourceNode,
    sourceHandle: edge.sourcePort,
    target: edge.targetNode,
    targetHandle: edge.targetPort,
    type: 'forgeDataEdge',
    animated: true,                                 // Pulso de señal
  }
}
```

---

## 7. NODE PALETTE — Catálogo Arrastrable

### 7.1 Estructura de Datos

```typescript
interface PaletteEntry {
  type: ForgeNodeType
  label: string
  icon: string
  category: ForgeNodeCategory
  description: string
  /** Función factory que crea un IForgeNode con defaults */
  createNode: (id: ForgeNodeId, position: { x: number; y: number }) => IForgeNode
}

const FORGE_PALETTE: Record<ForgeNodeCategory, PaletteEntry[]> = {
  input: [
    { type: 'input_dmx',         label: 'DMX Input',    icon: '📡', category: 'input',
      description: 'Receives value from Aether intent bus', createNode: ... },
    { type: 'input_audio_band',  label: 'Audio Band',   icon: '🎵', category: 'input',
      description: 'Receives frequency band energy (0-1)', createNode: ... },
    { type: 'input_beat',        label: 'Beat Pulse',   icon: '💓', category: 'input',
      description: 'Emits 1.0 on each detected beat', createNode: ... },
    { type: 'input_bpm',         label: 'BPM',          icon: '⏱️', category: 'input',
      description: 'Current BPM as normalized value', createNode: ... },
    { type: 'input_energy',      label: 'Energy',       icon: '⚡', category: 'input',
      description: 'Global RMS energy (0-1)', createNode: ... },
    { type: 'input_constant',    label: 'Constant',     icon: '🔢', category: 'input',
      description: 'Emits a fixed configurable value', createNode: ... },
    { type: 'input_time',        label: 'Time Ramp',    icon: '⏲️', category: 'input',
      description: 'Time-based 0-1 ramp (per minute)', createNode: ... },
  ],
  process: [
    { type: 'proc_lfo',          label: 'LFO',          icon: '∿', category: 'process',
      description: 'Oscillator (sine, triangle, saw, square)', createNode: ... },
    { type: 'proc_smooth',       label: 'Smooth',       icon: '〰️', category: 'process',
      description: 'Exponential smoothing (attack/release)', createNode: ... },
    { type: 'proc_map_range',    label: 'Map Range',    icon: '↔️', category: 'process',
      description: 'Linear remap [a,b] → [c,d]', createNode: ... },
    { type: 'proc_math',         label: 'Math',         icon: '➕', category: 'process',
      description: 'Arithmetic (add, multiply, subtract, divide)', createNode: ... },
    { type: 'proc_clamp',        label: 'Clamp',        icon: '📏', category: 'process',
      description: 'Clamp value to [min, max]', createNode: ... },
    { type: 'proc_delay',        label: 'Delay',        icon: '⏳', category: 'process',
      description: 'Temporal delay in frames (ring buffer)', createNode: ... },
    { type: 'proc_merge',        label: 'Merge',        icon: '🔀', category: 'process',
      description: 'Combine N inputs (max, min, avg, sum)', createNode: ... },
    { type: 'proc_invert',       label: 'Invert',       icon: '🔃', category: 'process',
      description: '1.0 minus input', createNode: ... },
    { type: 'proc_curve',        label: 'Curve',        icon: '📈', category: 'process',
      description: 'Transfer curve (expo, log, S-curve, gamma)', createNode: ... },
  ],
  logic: [
    { type: 'logic_threshold',   label: 'Threshold',    icon: '📊', category: 'logic',
      description: 'On/off based on threshold with hysteresis', createNode: ... },
    { type: 'logic_gate',        label: 'Gate',         icon: '🚧', category: 'logic',
      description: 'Pass signal only when gate > 0.5', createNode: ... },
    { type: 'logic_switch',      label: 'Switch',       icon: '🔀', category: 'logic',
      description: 'Select A or B based on selector', createNode: ... },
    { type: 'logic_and',         label: 'AND',          icon: '∧', category: 'logic',
      description: 'Both inputs > 0.5 → 1.0', createNode: ... },
    { type: 'logic_or',          label: 'OR',           icon: '∨', category: 'logic',
      description: 'Either input > 0.5 → 1.0', createNode: ... },
    { type: 'logic_counter',     label: 'Counter',      icon: '🔢', category: 'logic',
      description: 'Counts pulses, resets at N (modulo)', createNode: ... },
  ],
  output: [
    { type: 'output_dmx',        label: 'DMX Output',   icon: '💡', category: 'output',
      description: 'Physical DMX channel output', createNode: ... },
  ],
  compound: [
    { type: 'compound_ingenio',  label: 'INGENIO',      icon: '📦', category: 'compound',
      description: 'Packaged sub-graph (future)', createNode: ... },
  ],
}
```

### 7.2 Drag-and-Drop Protocol

La paleta usa el protocolo de `onDragStart` / `onDrop` de @xyflow:

```typescript
// En NodePalette
const onDragStart = (event: React.DragEvent, nodeType: ForgeNodeType) => {
  event.dataTransfer.setData('application/forgenode', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

// En NodeCanvas
const onDrop = useCallback((event: React.DragEvent) => {
  event.preventDefault()
  const nodeType = event.dataTransfer.getData('application/forgenode') as ForgeNodeType
  if (!nodeType) return

  const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
  const entry = findPaletteEntry(nodeType)
  if (!entry) return

  const newNode = entry.createNode(generateNodeId(), position)
  addNode(newNode)  // store action
}, [addNode, screenToFlowPosition])
```

---

## 8. NODE INSPECTOR — Panel de Propiedades Dinámico

### 8.1 Estructura

```
┌─────────────────────────────────┐
│  ▾ LFO OSCILLATOR              │  ← Header con tipo y label editable
│  ──────────────────────────────│
│  Label: [My LFO________]       │
│                                 │
│  ── PARAMETERS ──────────────  │
│  Waveform:  [▾ sine      ]     │
│  Frequency: [2.00] Hz           │
│  BPM Sync:  [  ] OFF            │
│  Divisor:   [4.0]               │
│  Phase:     [0.00]              │
│                                 │
│  ── PORTS ───────────────────  │
│  IN:  amplitude (normalized)   │
│  IN:  modulation (normalized)  │
│  OUT: output (normalized)      │
│                                 │
│  ── ACTIONS ─────────────────  │
│  [Duplicate] [Delete]           │
└─────────────────────────────────┘
```

### 8.2 Config Panel Registry

```typescript
/**
 * Mapeo de ForgeNodeType → componente de configuración.
 * Cada panel recibe la config actual y un callback para actualizarla.
 */
type ConfigPanelProps<T extends IForgeNodeConfig> = {
  config: T
  onChange: (partial: Partial<T>) => void
}

const CONFIG_PANEL_MAP: Record<ForgeNodeType, React.ComponentType<ConfigPanelProps<any>>> = {
  input_dmx:         InputDmxConfigPanel,
  input_audio_band:  InputAudioBandConfigPanel,
  input_constant:    InputConstantConfigPanel,
  proc_lfo:          LfoConfigPanel,
  proc_smooth:       SmoothConfigPanel,
  proc_map_range:    MapRangeConfigPanel,
  proc_math:         MathConfigPanel,
  proc_clamp:        ClampConfigPanel,
  proc_delay:        DelayConfigPanel,
  proc_merge:        MergeConfigPanel,
  proc_curve:        CurveConfigPanel,
  logic_threshold:   ThresholdConfigPanel,
  logic_switch:      SwitchConfigPanel,
  logic_counter:     CounterConfigPanel,
  output_dmx:        OutputDmxConfigPanel,
  // passthrough nodes — no config panel needed:
  input_beat:        null,
  input_bpm:         null,
  input_energy:      null,
  input_time:        null,
  proc_invert:       null,
  logic_gate:        null,
  logic_and:         null,
  logic_or:          null,
  compound_ingenio:  null,  // future
}
```

---

## 9. KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| `Delete` / `Backspace` | Eliminar nodos/edges seleccionados |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo |
| `Ctrl+A` | Select all nodes |
| `Ctrl+D` | Duplicate selected nodes |
| `Ctrl+C` / `Ctrl+V` | Copy/Paste nodes (con offset +20px) |
| `Space` (hold) | Pan mode (hand cursor) |
| `F` | Fit view (zoom to fit all nodes) |
| `Escape` | Deselect all / close Inspector |

---

## 10. FLUJO DE DATOS COMPLETO (LIFECYCLE)

### 10.1 Abrir un Fixture

```
1. User selects fixture from Library
2. libraryStore.normalizeFixture() hydrates nodeGraph (WAVE 4548.3)
3. FixtureForgeEmbedded recibe fixture con nodeGraph
4. forgeGraphStore.loadGraph(fixture.nodeGraph, fixture.id, isAutoMigrated)
5. Si Simple Mode: mostrar Channel Rack (channels[] derivados)
6. Si Advanced Mode: NodeCanvas hydrata XYFlow nodes/edges desde el store
```

### 10.2 Editar en Advanced Mode

```
1. User drags "LFO" from Palette → drops on canvas
2. NodeCanvas.onDrop() → forgeGraphStore.addNode(newLfoNode)
3. Store pushes current state to undoStack, updates graph
4. Canvas re-hydrates: new XYFlow node appears
5. User connects LFO.output → OutputDMX.input (drag handle)
6. NodeCanvas.onConnect() → forgeGraphStore.addEdge(newEdge)
7. User clicks LFO node → forgeGraphStore.inspectNode(lfoId)
8. NodeInspector renders LfoConfigPanel with current config
9. User changes waveform → local draft updates → debounce → store.updateNodeConfig()
```

### 10.3 Guardar

```
1. User clicks "Save"
2. FixtureForgeEmbedded.handleSave():
   a. graph = forgeGraphStore.graph
   b. channels = NodeGraphBuilder.toChannels(graph)  // sync channels[]
   c. fixture = { ...fixture, channels, nodeGraph: graph }
   d. saveUserFixture(fixture)
   e. forgeGraphStore.markClean()
```

---

## 11. VALIDACIÓN EN TIEMPO REAL

### 11.1 Indicadores Visuales en el Canvas

| Condición | Indicador Visual |
|-----------|-----------------|
| Edge type mismatch (e.g., boolean → frequency) | Edge rojo punteado + tooltip warning |
| Orphan node (sin edges) | Borde del nodo pulsante en naranja |
| Cycle detected | Nodos del ciclo con borde rojo + banner |
| Missing required port connection | Handle del puerto pulsante |
| DMX offset collision (dos outputs al mismo canal) | Ambos nodos output con badge ⚠️ |

### 11.2 Validation Pipeline

```typescript
// Se ejecuta en cada cambio del store (debounced 500ms)
const validationErrors = useMemo(() => {
  if (!graph) return []
  return NodeGraphBuilder.validate(graph)
}, [graph])
```

Los errores se muestran:
1. **En el canvas** — indicadores visuales en los nodos/edges afectados
2. **En el header** — badge con contador: `⚠ 2 issues`
3. **En el inspector** — sección de errores del nodo seleccionado

---

## 12. ESTRUCTURA DE ARCHIVOS PROPUESTA

```
src/components/views/ForgeView/
├── index.tsx                          ← Existente (ForgeView wrapper)
├── FixtureForgeEmbedded.tsx           ← Existente (refactored, adds NODE GRAPH tab)
├── FixtureForgeEmbedded.css           ← Existente
├── LibraryTab.tsx                     ← Existente
├── WheelSmithEmbedded.tsx             ← Existente
│
├── canvas/                            ← ★ NUEVO directorio
│   ├── ForgeCanvasLayout.tsx          ← Layout 3 columnas
│   ├── NodeCanvas.tsx                 ← @xyflow/react wrapper
│   ├── NodeCanvas.css                 ← Estilos del canvas (grid, theme)
│   ├── NodePalette.tsx                ← Sidebar izquierda draggable
│   ├── NodePalette.css
│   ├── NodeInspector.tsx              ← Sidebar derecha (propiedades)
│   ├── NodeInspector.css
│   ├── ForgeModeSwitcher.tsx          ← Toggle Simple/Advanced
│   └── ForgeValidationOverlay.tsx     ← Overlay de errores en canvas
│
├── nodes/                             ← ★ NUEVO directorio
│   ├── ForgeNodeBase.tsx              ← Componente base compartido
│   ├── ForgeNodeBase.css              ← Estilos cyberpunk del nodo
│   ├── ForgeInputNode.tsx             ← Custom node: categoría input
│   ├── ForgeProcessNode.tsx           ← Custom node: categoría process
│   ├── ForgeLogicNode.tsx             ← Custom node: categoría logic
│   ├── ForgeOutputNode.tsx            ← Custom node: categoría output
│   ├── ForgeCompoundNode.tsx          ← Custom node: categoría compound
│   ├── ForgeDataEdge.tsx              ← Custom edge: gradiente + pulse
│   ├── nodeIcons.ts                   ← Mapeo ForgeNodeType → icon SVG
│   └── nodeColors.ts                  ← Mapeo categoría/dataType → color
│
├── inspector/                         ← ★ NUEVO directorio
│   ├── InspectorHeader.tsx
│   ├── InspectorPortList.tsx
│   ├── panels/
│   │   ├── LfoConfigPanel.tsx
│   │   ├── SmoothConfigPanel.tsx
│   │   ├── MapRangeConfigPanel.tsx
│   │   ├── MathConfigPanel.tsx
│   │   ├── ClampConfigPanel.tsx
│   │   ├── DelayConfigPanel.tsx
│   │   ├── MergeConfigPanel.tsx
│   │   ├── CurveConfigPanel.tsx
│   │   ├── ThresholdConfigPanel.tsx
│   │   ├── SwitchConfigPanel.tsx
│   │   ├── CounterConfigPanel.tsx
│   │   ├── InputDmxConfigPanel.tsx
│   │   ├── InputAudioBandConfigPanel.tsx
│   │   ├── InputConstantConfigPanel.tsx
│   │   └── OutputDmxConfigPanel.tsx
│   └── configPanelRegistry.ts         ← CONFIG_PANEL_MAP
│
└── palette/                           ← ★ NUEVO directorio
    ├── forgePalette.ts                ← FORGE_PALETTE data + createNode factories
    └── PaletteCategory.tsx            ← Accordion category component

src/stores/
└── forgeGraphStore.ts                 ← ★ NUEVO store Zustand
```

---

## 13. RESUMEN DE DECISIONES ARQUITECTÓNICAS

| # | Decisión | Razón |
|---|----------|-------|
| D1 | @xyflow/react v12 como librería de canvas | API hooks, custom nodes, MIT, mantenimiento activo |
| D2 | Store Zustand separado (`forgeGraphStore`) | Aísla el estado del grafo del estado de la librería y del canvas |
| D3 | IForgeNodeGraph como source of truth (no XYFlow state) | El grafo Forge es persistible, serializable, y compilable |
| D4 | Draft local + debounce en Inspector | Evita re-renders del canvas en cada keystroke |
| D5 | Modo Dual con `isSimpleCompatible()` gate | Compatibilidad hacia atrás sin limitar a usuarios avanzados |
| D6 | Custom Nodes por categoría (no por tipo) | Reduce la cantidad de componentes (5 vs 27) con variantes internas |
| D7 | Edge type-checking visual (no blocking) | Warning visual pero permite conexión (el evaluador es resiliente) |
| D8 | Undo/Redo en el store (snapshot stack) | Simple y correcto; el grafo completo es pequeño (< 100 nodos típico) |
| D9 | Drag-and-drop desde Palette via dataTransfer | Nativo del browser, funciona con @xyflow sin librería extra |
| D10 | `uiPosition` en IForgeNode (ya existente) | El campo ya existe en el tipo — reutilizar directamente |

---

*Fin del Blueprint WAVE 4548.8a — THE CANVAS BLUEPRINT*
*Documento de diseño. No contiene código de producción.*
