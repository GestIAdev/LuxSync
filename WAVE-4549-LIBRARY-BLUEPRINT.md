# WAVE 4549 — UNIVERSAL ASSET LIBRARY & INGENIO ECOSYSTEM

## Blueprint Arquitectónico: Sistema Unificado de Librerías y Motor de Ingenios

**Estado:** DISEÑO ARQUITECTÓNICO  
**Prerequisito:** WAVE 4548 (Forge Kernel N1-N4 + Canvas N5 en curso)  
**Scope:** Modelo de datos de Ingenios + Universal Asset Browser UI

---

## MISIÓN 1: ESTRUCTURA DE DATOS DE LOS INGENIOS

---

### 1.1 ¿Qué es un INGENIO?

Un Ingenio es un **sub-grafo de nodos reutilizable** que encapsula lógica compleja
(LFO chains, smooth pipelines, audio-reactive patterns) como una unidad atómica
que puede instanciarse en múltiples fixtures sin duplicar su lógica interna.

**Analogía:** Un Ingenio es a un ForgeNodeGraph lo que una función es a un programa.
Tiene entradas genéricas, salidas genéricas, y una implementación interna encapsulada.

### 1.2 El archivo `.luxingenio`

Un Ingenio se persiste como un archivo JSON con extensión `.luxingenio` en el
directorio `userData/ingenios/`. La estructura interna del archivo es un
`IIngenioDefinition`.

#### Directorio en disco

```
userData/
├── fixtures/                    ← Existente (WAVE 1113)
│   ├── ADJ_Vizi_Beam.json
│   └── Chauvet_Intimidator.json
│
├── ingenios/                    ← ★ NUEVO
│   ├── system/                  ← Ingenios de fábrica (read-only)
│   │   ├── audio-pulse-gate.luxingenio
│   │   ├── smooth-dimmer.luxingenio
│   │   └── bpm-strobe-sync.luxingenio
│   │
│   └── user/                    ← Ingenios del usuario (writable)
│       ├── my-custom-chase.luxingenio
│       └── reactive-color-blend.luxingenio
```

### 1.3 Interfaces TypeScript

#### IIngenioDefinition — La entidad independiente

```typescript
// src/core/forge/ingenio/types.ts

/** ID único del Ingenio (UUID o slug legible) */
type IngenioId = string

/** Versión semántica del schema del Ingenio */
type IngenioSchemaVersion = '1.0.0'

/**
 * Puerto expuesto del Ingenio — punto de contacto con el fixture contenedor.
 *
 * Un ExposedPort NO es un canal DMX concreto. Es un "slot" genérico
 * que el usuario mapea al canal real cuando instancia el Ingenio
 * dentro del nodeGraph de un fixture.
 *
 * Ejemplo: Un Ingenio "Audio Pulse Gate" expone:
 *   - IN: "signal" (normalized) — la señal que va a filtrar
 *   - IN: "threshold" (normalized) — umbral configurable
 *   - OUT: "gated_signal" (normalized) — señal filtrada
 *
 * Cuando se instancia en un fixture con Dimmer y Bass:
 *   - signal → mapea al output del nodo input_dmx(dimmer)
 *   - threshold → mapea al output del nodo input_audio_band(bass)
 *   - gated_signal → mapea al input del nodo output_dmx(dimmer)
 */
interface IExposedPort {
  /** ID único del puerto expuesto (e.g. "signal", "threshold", "output") */
  readonly id: string
  /** Dirección: ¿es un input o output del Ingenio? */
  readonly direction: 'in' | 'out'
  /** Tipo de dato que acepta/emite */
  readonly dataType: ForgeDataType
  /** Etiqueta legible para la UI */
  readonly label: string
  /** Descripción para tooltip/help */
  readonly description?: string
  /** Valor por defecto cuando el puerto no está conectado */
  readonly defaultValue: number
}

/**
 * IIngenioDefinition — Definición completa de un Ingenio independiente.
 *
 * CONTRATO: Un Ingenio es auto-contenido. Su subGraph no referencia
 * ningún canal DMX concreto ni fixture específico. Toda la I/O
 * se realiza a través de los ExposedPorts.
 */
interface IIngenioDefinition {
  /** Versión del schema */
  readonly version: IngenioSchemaVersion

  /** ID único global del Ingenio */
  readonly id: IngenioId

  /** Nombre legible ("Audio Pulse Gate", "Smooth Dimmer Ramp") */
  readonly name: string

  /** Autor del Ingenio */
  readonly author: string

  /** Descripción corta para la librería */
  readonly description: string

  /** Tags para búsqueda y filtrado ("audio", "strobe", "chase", "smooth") */
  readonly tags: readonly string[]

  /** Categoría funcional para agrupación en el browser */
  readonly category: IngenioCategory

  /** Puertos expuestos — los puntos de conexión del Ingenio con el mundo exterior */
  readonly exposedPorts: readonly IExposedPort[]

  /** Sub-grafo interno — la lógica encapsulada del Ingenio.
   *  Este grafo usa nodos "proxy_input" y "proxy_output" que se corresponden
   *  1:1 con los ExposedPorts. */
  readonly subGraph: IForgeNodeGraph

  /** Mapeo ExposedPort.id → nodo interno del subGraph */
  readonly portMapping: IIngenioPortMapping

  /** Metadata del Ingenio */
  readonly meta: IIngenioMeta

  /** Icono del Ingenio (emoji o nombre de icono Lucide) */
  readonly icon?: string

  /** Color de acento para la UI (hex) */
  readonly accentColor?: string
}

type IngenioCategory =
  | 'modulation'    // LFOs, waves, oscillators
  | 'dynamics'      // Smooth, envelope, compressor
  | 'audio'         // Audio-reactive patterns
  | 'sequencer'     // Chase, step sequencer
  | 'logic'         // Complex gating, switching
  | 'utility'       // Math, merge, split
  | 'effect'        // Strobe patterns, flicker

interface IIngenioPortMapping {
  /** Mapeo: exposedPort.id (direction: 'in') → nodo proxy_input interno */
  readonly inputs: ReadonlyArray<{
    readonly exposedPortId: string
    readonly internalNodeId: ForgeNodeId
    readonly internalPortId: ForgePortId
  }>
  /** Mapeo: exposedPort.id (direction: 'out') → nodo proxy_output interno */
  readonly outputs: ReadonlyArray<{
    readonly exposedPortId: string
    readonly internalNodeId: ForgeNodeId
    readonly internalPortId: ForgePortId
  }>
}

interface IIngenioMeta {
  /** Fecha de creación (ISO 8601) */
  readonly createdAt: string
  /** Fecha de última modificación */
  readonly updatedAt: string
  /** WAVE que generó este Ingenio */
  readonly generatorWave: string
  /** Número de nodos internos (para info en el browser) */
  readonly internalNodeCount: number
  /** Número de edges internos */
  readonly internalEdgeCount: number
}
```

### 1.4 Ejemplo de archivo `.luxingenio`

```json
{
  "version": "1.0.0",
  "id": "ingenio-audio-pulse-gate-001",
  "name": "Audio Pulse Gate",
  "author": "LuxSync Factory",
  "description": "Gates a signal through only when audio energy exceeds a threshold. Includes smoothing on the gate to avoid harsh on/off transitions.",
  "tags": ["audio", "gate", "reactive", "smooth"],
  "category": "audio",
  "icon": "🎵",
  "accentColor": "#00f3ff",

  "exposedPorts": [
    {
      "id": "signal",
      "direction": "in",
      "dataType": "normalized",
      "label": "Signal",
      "description": "The signal to gate (0-1)",
      "defaultValue": 0
    },
    {
      "id": "audio_energy",
      "direction": "in",
      "dataType": "normalized",
      "label": "Audio Energy",
      "description": "Audio energy source for gating decision",
      "defaultValue": 0
    },
    {
      "id": "threshold",
      "direction": "in",
      "dataType": "normalized",
      "label": "Threshold",
      "description": "Energy threshold for gate opening",
      "defaultValue": 0.3
    },
    {
      "id": "gated_output",
      "direction": "out",
      "dataType": "normalized",
      "label": "Gated Output",
      "description": "Signal passed through the gate",
      "defaultValue": 0
    }
  ],

  "subGraph": {
    "version": "1.0.0",
    "nodes": [
      { "id": "proxy_signal",      "type": "input_constant", "category": "input", "...": "..." },
      { "id": "proxy_audio",       "type": "input_constant", "category": "input", "...": "..." },
      { "id": "proxy_threshold",   "type": "input_constant", "category": "input", "...": "..." },
      { "id": "threshold_node",    "type": "logic_threshold","category": "logic", "...": "..." },
      { "id": "gate_node",         "type": "logic_gate",     "category": "logic", "...": "..." },
      { "id": "smooth_node",       "type": "proc_smooth",    "category": "process","...": "..." },
      { "id": "proxy_gated_out",   "type": "input_constant", "category": "input", "...": "..." }
    ],
    "edges": ["...internal wiring..."],
    "meta": { "createdAt": "2026-05-04", "generatorWave": "WAVE-4549", "autoMigrated": false, "dmxFootprint": 0 }
  },

  "portMapping": {
    "inputs": [
      { "exposedPortId": "signal",       "internalNodeId": "proxy_signal",    "internalPortId": "value" },
      { "exposedPortId": "audio_energy", "internalNodeId": "proxy_audio",     "internalPortId": "value" },
      { "exposedPortId": "threshold",    "internalNodeId": "proxy_threshold", "internalPortId": "value" }
    ],
    "outputs": [
      { "exposedPortId": "gated_output", "internalNodeId": "proxy_gated_out", "internalPortId": "value" }
    ]
  },

  "meta": {
    "createdAt": "2026-05-04T12:00:00Z",
    "updatedAt": "2026-05-04T12:00:00Z",
    "generatorWave": "WAVE-4549",
    "internalNodeCount": 7,
    "internalEdgeCount": 6
  }
}
```

### 1.5 Instancia dentro del NodeGraph del Fixture

Cuando un usuario arrastra un Ingenio al canvas de un fixture, **NO se copia
el sub-grafo interno**. Se crea un nodo `compound_ingenio` que contiene una
**referencia** al Ingenio original.

#### ICompoundIngenioConfig (actualización del tipo existente)

La interfaz `ICompoundIngenioConfig` ya existe en `src/core/forge/types.ts`.
Se extiende para soportar el patrón de referencia:

```typescript
/**
 * Configuración de un nodo compound_ingenio dentro del nodeGraph de un fixture.
 *
 * MODELO DE REFERENCIA:
 * - ingenioRef: ID del Ingenio en la librería (si es una instancia de librería)
 * - subGraph: sub-grafo inline (si es un ingenio incrustado / legacy)
 *
 * REGLA: Si ingenioRef existe, el evaluador carga el subGraph del Ingenio
 * desde la librería en compile-time (ForgeGraphCompiler). El subGraph inline
 * actúa como cache/fallback para exportación offline.
 *
 * CONTRATO DE INDEPENDENCIA: Los ExposedPorts del Ingenio se conectan
 * a los puertos del compound_ingenio node, que a su vez se conectan
 * al resto del nodeGraph del fixture mediante edges normales.
 */
interface ICompoundIngenioConfig {
  readonly nodeType: 'compound_ingenio'
  
  /** Nombre legible del Ingenio */
  readonly ingenioName: string

  /** ★ NUEVO: Referencia al Ingenio en la librería (null si es inline/legacy) */
  readonly ingenioRef: IngenioId | null

  /** ★ NUEVO: Versión del Ingenio referenciado al momento de instanciación */
  readonly ingenioVersion?: string

  /** Sub-grafo completo (inline cache para exportación o Ingenios legacy) */
  readonly subGraph: IForgeNodeGraph

  /** Mapeo de puertos expuestos → nodos internos */
  readonly portMapping: {
    readonly inputs: ReadonlyArray<{
      readonly exposedPortId: ForgePortId
      readonly internalNodeId: ForgeNodeId
      readonly internalPortId: ForgePortId
    }>
    readonly outputs: ReadonlyArray<{
      readonly exposedPortId: ForgePortId
      readonly internalNodeId: ForgeNodeId
      readonly internalPortId: ForgePortId
    }>
  }
}
```

#### Flujo de instanciación

```
1. User drags "Audio Pulse Gate" from Ingenio palette → canvas
2. ForgeCanvasLayout creates compound_ingenio node:
   - ingenioRef = "ingenio-audio-pulse-gate-001"
   - subGraph = deepClone(ingenioDefinition.subGraph)  ← inline cache
   - portMapping = ingenioDefinition.portMapping
   - inputs/outputs = derived from exposedPorts
3. Node appears on canvas with exposed ports as handles
4. User connects:
   - input_dmx(dimmer).out → compound_ingenio.signal
   - input_audio_band(bass).out → compound_ingenio.audio_energy
   - compound_ingenio.gated_output → output_dmx(dimmer).value
5. On save: compound_ingenio serialized with ingenioRef + subGraph cache
6. On compile (ForgeGraphCompiler):
   - Detects compound_ingenio
   - Flattens subGraph into main program (INGENIO inlining)
   - Wires exposed ports to parent graph edges
```

#### Ventajas del modelo de referencia

| Aspecto | Beneficio |
|---------|-----------|
| **No duplicación** | Solo se guarda `ingenioRef` + cache inline |
| **Actualización** | Si el Ingenio se actualiza, los fixtures se pueden recompilar con la nueva versión |
| **Exportación offline** | El `subGraph` inline permite exportar el fixture como JSON autónomo |
| **Versionado** | `ingenioVersion` detecta si el Ingenio referenciado ha cambiado |

### 1.6 ForgeGraphCompiler: Inlining de Ingenios

El `ForgeGraphCompiler` (ya creado en N4a) tiene un placeholder para compound nodes.
El proceso de inlining funciona así:

```
ForgeGraphCompiler.compile(graph, deviceId)
    │
    ├── For each node in topological order:
    │     If node.type === 'compound_ingenio':
    │       1. Resolve subGraph (from ingenioRef or inline cache)
    │       2. Prefix all internal node IDs: "ingenio_{instanceId}_{nodeId}"
    │       3. Map exposed port edges to internal proxy nodes
    │       4. Append internal nodes to the flat program
    │       5. Append internal edges to edgeWiring
    │       6. Skip the compound node itself (it's now flattened)
    │
    └── Result: flat CompiledForgeGraph with Ingenio logic inlined
```

---

## MISIÓN 2: THE UNIVERSAL ASSET BROWSER

---

### 2.1 Problema Actual

El proyecto tiene **3 interfaces de librería separadas** que hacen lo mismo:

| Ubicación | Componente | Limitaciones |
|-----------|-----------|--------------|
| ForgeView | `LibraryTab.tsx` | Lista plana, search básico, no tags, no folders |
| StageConstructor | `FixtureLibrarySidebar` | Lista plana, API distinta (`getFixtureLibrary`), duplica lógica |
| (Futuro) | Ingenios | No existe aún |

**Problemas:**
- Código duplicado para listar fixtures
- No escala a +2000 items
- No soporta Ingenios
- No hay navegación por carpetas/fabricante
- No hay sistema de tags

### 2.2 Solución: `<UniversalAssetBrowser>`

Un componente React **reutilizable** que reemplaza todas las interfaces de librería.
Soporta múltiples tipos de asset (fixtures, ingenios, futuros).

### 2.3 Modelo de Datos Unificado

```typescript
// src/stores/assetLibraryStore.ts

/** Tipos de asset que el browser puede mostrar */
type AssetType = 'fixture' | 'ingenio'

/** Fuente del asset */
type AssetSource = 'system' | 'user'

/**
 * Representación unificada de un asset en la librería.
 * Abstrae las diferencias entre FixtureDefinition e IIngenioDefinition.
 */
interface LibraryAsset {
  /** ID único del asset */
  readonly id: string
  /** Tipo de asset */
  readonly type: AssetType
  /** Fuente (system = read-only, user = writable) */
  readonly source: AssetSource
  /** Nombre legible */
  readonly name: string
  /** Fabricante (fixtures) o Autor (ingenios) */
  readonly creator: string
  /** Subtipo para display (e.g. "moving-head", "modulation") */
  readonly subtype: string
  /** Tags para filtrado */
  readonly tags: readonly string[]
  /** Resumen corto para la card (e.g. "12ch • RGB • P/T" o "3 in • 1 out") */
  readonly summary: string
  /** Icono (emoji o lucide icon name) */
  readonly icon: string
  /** Color de acento */
  readonly accentColor: string
  /** Ruta en disco (para operaciones IPC) */
  readonly filePath?: string
  /** Número de canales (fixtures) o nodos internos (ingenios) */
  readonly itemCount: number
  /** Fecha de última modificación */
  readonly updatedAt: number
  /** Referencia al objeto original completo */
  readonly _raw: FixtureDefinition | IIngenioDefinition
}
```

#### Adaptadores: De tipos concretos a LibraryAsset

```typescript
function fixtureToAsset(fixture: LibraryFixture): LibraryAsset {
  return {
    id: fixture.id,
    type: 'fixture',
    source: fixture.source,
    name: fixture.name,
    creator: fixture.manufacturer || 'Unknown',
    subtype: fixture.type || 'generic',
    tags: deriveFixtureTags(fixture),
    summary: getChannelSummary(fixture),
    icon: getFixtureTypeEmoji(fixture.type),
    accentColor: getFixtureTypeColor(fixture.type),
    filePath: fixture.filePath,
    itemCount: fixture.channels?.length ?? 0,
    updatedAt: Date.now(),
    _raw: fixture,
  }
}

function ingenioToAsset(ingenio: IIngenioDefinition, source: AssetSource): LibraryAsset {
  return {
    id: ingenio.id,
    type: 'ingenio',
    source,
    name: ingenio.name,
    creator: ingenio.author,
    subtype: ingenio.category,
    tags: [...ingenio.tags],
    summary: `${ingenio.exposedPorts.filter(p => p.direction === 'in').length} in • ${ingenio.exposedPorts.filter(p => p.direction === 'out').length} out`,
    icon: ingenio.icon || '📦',
    accentColor: ingenio.accentColor || '#bf5af2',
    itemCount: ingenio.meta.internalNodeCount,
    updatedAt: new Date(ingenio.meta.updatedAt).getTime(),
    _raw: ingenio,
  }
}
```

#### Tag derivation automática para fixtures

```typescript
function deriveFixtureTags(fixture: LibraryFixture): string[] {
  const tags: string[] = []

  // Tipo
  if (fixture.type) tags.push(fixture.type)

  // Capacidades
  const ch = fixture.channels || []
  if (ch.some(c => c.type === 'pan' || c.type === 'tilt')) tags.push('moving')
  if (ch.some(c => ['red','green','blue'].includes(c.type))) tags.push('rgb')
  if (ch.some(c => ['cyan','magenta','yellow'].includes(c.type))) tags.push('cmy')
  if (ch.some(c => c.type === 'color_wheel')) tags.push('wheel')
  if (ch.some(c => c.type === 'gobo')) tags.push('gobo')
  if (ch.some(c => c.type === 'prism')) tags.push('prism')
  if (ch.some(c => c.type === 'zoom')) tags.push('zoom')
  if (ch.some(c => c.type === 'strobe')) tags.push('strobe')
  if (ch.some(c => c.is16bit)) tags.push('16bit')

  // Rango de canales
  if (ch.length <= 4) tags.push('compact')
  if (ch.length >= 16) tags.push('extended')

  return tags
}
```

### 2.4 Store Unificado: `useAssetLibraryStore`

```typescript
// src/stores/assetLibraryStore.ts

interface AssetLibraryState {
  // ── Data ──────────────────────────────────────────────
  fixtures: LibraryAsset[]       // Fixtures (system + user)
  ingenios: LibraryAsset[]       // Ingenios (system + user)
  isLoading: boolean
  lastError: string | null

  // ── View State ────────────────────────────────────────
  /** Filtro activo por tipo de asset */
  assetTypeFilter: AssetType | 'all'
  /** Filtro activo por fuente */
  sourceFilter: AssetSource | 'all'
  /** Query de búsqueda */
  searchQuery: string
  /** Tags activos (AND filter) */
  activeTags: Set<string>
  /** Nodo del árbol expandido (fabricante/categoría) */
  expandedTreeNodes: Set<string>
  /** Modo de vista */
  viewMode: 'grid' | 'list' | 'tree'
  /** Orden */
  sortBy: 'name' | 'creator' | 'updated' | 'type'
  sortDirection: 'asc' | 'desc'

  // ── Actions ───────────────────────────────────────────
  /** Carga todos los assets desde disco (fixtures + ingenios) */
  loadAll: () => Promise<void>
  /** Recarga solo fixtures */
  reloadFixtures: () => Promise<void>
  /** Recarga solo ingenios */
  reloadIngenios: () => Promise<void>

  /** Guarda un ingenio al disco (user library) */
  saveIngenio: (ingenio: IIngenioDefinition) => Promise<{ success: boolean; error?: string }>
  /** Elimina un ingenio del usuario */
  deleteIngenio: (id: IngenioId) => Promise<{ success: boolean; error?: string }>

  /** View state mutations */
  setAssetTypeFilter: (filter: AssetType | 'all') => void
  setSourceFilter: (filter: AssetSource | 'all') => void
  setSearchQuery: (query: string) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  setViewMode: (mode: 'grid' | 'list' | 'tree') => void
  setSortBy: (sort: 'name' | 'creator' | 'updated' | 'type') => void
  toggleSortDirection: () => void
  toggleTreeNode: (nodeId: string) => void

  // ── Computed ──────────────────────────────────────────
  /** Assets filtrados y ordenados para el view actual */
  getFilteredAssets: () => LibraryAsset[]
  /** Todos los tags disponibles con sus conteos */
  getAvailableTags: () => Map<string, number>
  /** Árbol de navegación (Fabricante → Modelos) */
  getTreeStructure: () => TreeNode[]
}
```

### 2.5 IPC Bridge para Ingenios

```typescript
// Extensión de la interfaz window.lux (vite-env.d.ts)

interface Window {
  lux: {
    // ... existing ...

    /** WAVE 4549: Ingenio Library API */
    ingenio: {
      /** List all ingenios (system + user) */
      listAll: () => Promise<{
        success: boolean
        systemIngenios: IIngenioDefinition[]
        userIngenios: IIngenioDefinition[]
        paths: { system: string; user: string }
        error?: string
      }>

      /** Save an ingenio to user library */
      saveUser: (ingenio: IIngenioDefinition) => Promise<{
        success: boolean
        filePath?: string
        error?: string
      }>

      /** Delete an ingenio from user library */
      deleteUser: (ingenioId: string) => Promise<{
        success: boolean
        error?: string
      }>

      /** Load a single ingenio by ID (for compile-time resolution) */
      getById: (ingenioId: string) => Promise<{
        success: boolean
        ingenio?: IIngenioDefinition
        error?: string
      }>
    }
  }
}
```

### 2.6 Jerarquía de Componentes del Universal Asset Browser

```
<UniversalAssetBrowser>                   ← Container principal reutilizable
│
├── <AssetBrowserToolbar>                  ← Barra superior
│     ├── <SearchInput />                  ← Búsqueda fuzzy
│     ├── <AssetTypeToggle />              ← [ALL] [FIXTURES] [INGENIOS]
│     ├── <SourceFilter />                 ← [ALL] [SYSTEM] [USER]
│     ├── <ViewModeSwitch />               ← [Grid] [List] [Tree]
│     ├── <SortDropdown />                 ← Name / Creator / Updated
│     └── <NewAssetButton />               ← "+ New Fixture" / "+ New Ingenio"
│
├── <TagBar>                               ← Chips de tags activos + disponibles
│     ├── <TagChip tag="moving" active />
│     ├── <TagChip tag="rgb" />
│     ├── <TagChip tag="audio" />
│     └── ...
│
├── {viewMode === 'tree' && (
│     <AssetTreeView>                      ← Vista jerárquica por fabricante/categoría
│       ├── <TreeBranch label="ADJ">
│       │     ├── <AssetCard asset={viziBeam} />
│       │     └── <AssetCard asset={megaTriPar} />
│       ├── <TreeBranch label="Chauvet">
│       │     └── <AssetCard asset={intimidator} />
│       └── <TreeBranch label="Ingenios: Audio">
│             ├── <AssetCard asset={audioPulseGate} />
│             └── <AssetCard asset={bpmStrobeSync} />
│     </AssetTreeView>
│   )}
│
├── {viewMode === 'grid' && (
│     <AssetGridView>                      ← Vista de tarjetas (3-4 columnas)
│       ├── <AssetCard asset={...} variant="grid" />
│       └── ...
│     </AssetGridView>
│   )}
│
├── {viewMode === 'list' && (
│     <AssetListView>                      ← Vista compacta (una fila por asset)
│       ├── <AssetRow asset={...} />
│       └── ...
│     </AssetListView>
│   )}
│
└── <AssetBrowserFooter>                   ← Barra inferior
      ├── <span>{filteredCount} / {totalCount} assets</span>
      └── <AssetActions />                 ← Clone, Delete, Edit, Export
```

### 2.7 Firmas de Componentes

#### UniversalAssetBrowser — Container principal

```typescript
/**
 * Componente reutilizable para navegar cualquier librería de assets.
 * Se usa en ForgeView (tab Library), StageConstructor (sidebar),
 * y cualquier lugar futuro que necesite seleccionar assets.
 *
 * MODO DE USO:
 * - En ForgeView: assetTypes={['fixture']} + onSelectFixture
 * - En StageConstructor sidebar: assetTypes={['fixture']} + onDragFixture
 * - En ForgeCanvas palette: assetTypes={['ingenio']} + onDragIngenio
 * - En modo browse-all: assetTypes={['fixture', 'ingenio']}
 */
interface UniversalAssetBrowserProps {
  /** Tipos de asset a mostrar (filtra la vista) */
  assetTypes: AssetType[]

  /** Modo de vista inicial */
  defaultViewMode?: 'grid' | 'list' | 'tree'

  /** Callback al seleccionar un asset (click) */
  onSelect?: (asset: LibraryAsset) => void

  /** Callback al iniciar drag de un asset (para D&D al stage/canvas) */
  onDragStart?: (event: React.DragEvent, asset: LibraryAsset) => void

  /** Callback para crear nuevo (redirige a Forge o Ingenio editor) */
  onCreateNew?: (type: AssetType) => void

  /** ID del asset seleccionado actualmente (highlighting) */
  selectedAssetId?: string | null

  /** Modo compacto (sin toolbar, para sidebars) */
  compact?: boolean

  /** Read-only mode (no delete/edit actions) */
  readOnly?: boolean

  /** Altura máxima (para embeberse en sidebars con scroll) */
  maxHeight?: string
}
```

#### AssetCard — La tarjeta de cada asset

```typescript
/**
 * Tarjeta visual de un asset (fixture o ingenio).
 * Adapta su contenido según el tipo de asset.
 */
interface AssetCardProps {
  asset: LibraryAsset
  variant: 'grid' | 'list' | 'compact'
  isSelected?: boolean
  onClick?: () => void
  onDragStart?: (event: React.DragEvent) => void
  onEdit?: () => void
  onClone?: () => void
  onDelete?: () => void
}
```

#### AssetTreeView — Vista jerárquica

```typescript
/**
 * Vista de árbol. Agrupa assets por:
 * - Fixtures: Manufacturer → Models
 * - Ingenios: Category → Ingenios
 */
interface TreeNode {
  /** ID del nodo del árbol (para expand/collapse) */
  id: string
  /** Label visible */
  label: string
  /** Tipo de nodo */
  type: 'root' | 'branch' | 'leaf'
  /** Assets hijos (solo en branches) */
  children: TreeNode[]
  /** Asset (solo en leaves) */
  asset?: LibraryAsset
  /** Conteo de items debajo */
  count: number
  /** Icono */
  icon?: string
}

/**
 * Construye el árbol de navegación desde los assets filtrados.
 */
function buildAssetTree(assets: LibraryAsset[]): TreeNode[] {
  const roots: TreeNode[] = []

  // 1. Agrupar fixtures por manufacturer
  const fixturesByManufacturer = new Map<string, LibraryAsset[]>()
  const ingeniosByCategory = new Map<string, LibraryAsset[]>()

  for (const asset of assets) {
    if (asset.type === 'fixture') {
      const key = asset.creator || 'Unknown'
      if (!fixturesByManufacturer.has(key)) fixturesByManufacturer.set(key, [])
      fixturesByManufacturer.get(key)!.push(asset)
    } else if (asset.type === 'ingenio') {
      const key = asset.subtype || 'utility'
      if (!ingeniosByCategory.has(key)) ingeniosByCategory.set(key, [])
      ingeniosByCategory.get(key)!.push(asset)
    }
  }

  // 2. Build fixture branches
  if (fixturesByManufacturer.size > 0) {
    const fixtureRoot: TreeNode = {
      id: 'root-fixtures',
      label: 'Fixtures',
      type: 'root',
      count: 0,
      icon: '💡',
      children: [],
    }

    for (const [manufacturer, fixtures] of fixturesByManufacturer) {
      fixtureRoot.children.push({
        id: `branch-${manufacturer}`,
        label: manufacturer,
        type: 'branch',
        count: fixtures.length,
        children: fixtures.map(f => ({
          id: f.id,
          label: f.name,
          type: 'leaf' as const,
          asset: f,
          count: 0,
          children: [],
        })),
      })
      fixtureRoot.count += fixtures.length
    }

    // Sort branches alphabetically
    fixtureRoot.children.sort((a, b) => a.label.localeCompare(b.label))
    roots.push(fixtureRoot)
  }

  // 3. Build ingenio branches (same pattern, by category)
  if (ingeniosByCategory.size > 0) {
    const ingenioRoot: TreeNode = {
      id: 'root-ingenios',
      label: 'Ingenios',
      type: 'root',
      count: 0,
      icon: '📦',
      children: [],
    }

    for (const [category, ingenios] of ingeniosByCategory) {
      ingenioRoot.children.push({
        id: `branch-ingenio-${category}`,
        label: category.charAt(0).toUpperCase() + category.slice(1),
        type: 'branch',
        count: ingenios.length,
        children: ingenios.map(i => ({
          id: i.id,
          label: i.name,
          type: 'leaf' as const,
          asset: i,
          count: 0,
          children: [],
        })),
      })
      ingenioRoot.count += ingenios.length
    }

    ingenioRoot.children.sort((a, b) => a.label.localeCompare(b.label))
    roots.push(ingenioRoot)
  }

  return roots
}
```

### 2.8 Integración con componentes existentes

#### ForgeView: Reemplaza LibraryTab

```typescript
// En FixtureForgeEmbedded.tsx, tab 'library':
{activeTab === 'library' && (
  <UniversalAssetBrowser
    assetTypes={['fixture']}
    defaultViewMode="tree"
    onSelect={(asset) => {
      handleSelectFromLibrary(asset._raw as FixtureDefinition)
    }}
    onCreateNew={() => handleNewFromScratch()}
    selectedAssetId={originalFixtureId}
  />
)}
```

#### StageConstructor: Reemplaza FixtureLibrarySidebar

```typescript
// En StageConstructorView.tsx, sidebar izquierda:
<UniversalAssetBrowser
  assetTypes={['fixture']}
  defaultViewMode="tree"
  compact
  maxHeight="calc(100vh - 200px)"
  onSelect={(asset) => handleAddFixtureToStage(asset)}
  onDragStart={(e, asset) => {
    e.dataTransfer.setData('fixtureId', asset.id)
    setDraggedFixtureType(asset.subtype)
  }}
/>
```

#### ForgeCanvas NodePalette: Ingenios como nodos arrastrables

```typescript
// En NodePalette.tsx, sección "INGENIOS":
<PaletteCategory category="compound" label="INGENIOS">
  <UniversalAssetBrowser
    assetTypes={['ingenio']}
    defaultViewMode="list"
    compact
    readOnly
    onDragStart={(e, asset) => {
      e.dataTransfer.setData('application/forgenode', 'compound_ingenio')
      e.dataTransfer.setData('ingenioId', asset.id)
    }}
  />
</PaletteCategory>
```

### 2.9 Diseño Visual del Asset Browser

#### Estética

Sigue la estética "Cyberpunk Industrial" establecida:

- **Fondo:** `rgba(10, 10, 15, 0.95)` con glass-morphism
- **Cards:** Bordes finos con color de categoría, hover glow
- **Tree:** Indentación con líneas verticales tenues
- **Tags:** Chips redondeados con colores por categoría
- **Search:** Input con icono de lupa, borde cyan en focus

#### AssetCard (variante grid)

```
┌─────────────────────────────┐
│ [💡]  Vizi Beam 5RX         │
│  ────────────────────────── │
│  ADJ                        │
│  12ch • RGB • P/T • Gobo    │
│                              │
│  ┌───┐ ┌────┐ ┌──────┐     │
│  │mov│ │rgb │ │16bit │     │  ← tag chips
│  └───┘ └────┘ └──────┘     │
│                              │
│  🔒 System    Modified: 2d  │
└─────────────────────────────┘
```

#### AssetCard (variante list)

```
┌──────────────────────────────────────────────────────────────────┐
│ [💡] Vizi Beam 5RX │ ADJ │ 12ch • RGB • P/T │ moving rgb │ 🔒  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.10 Búsqueda Fuzzy

La búsqueda opera sobre múltiples campos simultáneamente:

```typescript
function matchesSearch(asset: LibraryAsset, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    asset.name.toLowerCase().includes(q) ||
    asset.creator.toLowerCase().includes(q) ||
    asset.subtype.toLowerCase().includes(q) ||
    asset.tags.some(t => t.toLowerCase().includes(q)) ||
    asset.summary.toLowerCase().includes(q)
  )
}
```

Para +2000 items, la búsqueda se deberá **debounce** a 200ms y los resultados
se virtualizan con `react-window` o similar si el rendimiento lo requiere.

---

## 3. ESTRUCTURA DE ARCHIVOS PROPUESTA

```
src/core/forge/
├── ingenio/                           ← ★ NUEVO directorio
│   ├── types.ts                       ← IIngenioDefinition, IExposedPort, etc.
│   ├── IngenioFactory.ts              ← Factories para crear Ingenios vacíos
│   └── IngenioInliner.ts              ← Lógica de flatten/inline para el compiler
│
src/stores/
├── libraryStore.ts                    ← Existente (fixtures only — puede deprecarse)
├── forgeGraphStore.ts                 ← Existente (WAVE 4548.8b)
└── assetLibraryStore.ts               ← ★ NUEVO (unifica fixtures + ingenios)

src/components/shared/
└── AssetBrowser/                      ← ★ NUEVO directorio (reutilizable)
    ├── UniversalAssetBrowser.tsx       ← Container principal
    ├── UniversalAssetBrowser.css
    ├── AssetBrowserToolbar.tsx         ← Search + filters + view mode
    ├── AssetCard.tsx                   ← Card de asset (grid/list/compact)
    ├── AssetCard.css
    ├── AssetTreeView.tsx              ← Vista jerárquica
    ├── AssetGridView.tsx              ← Vista de tarjetas
    ├── AssetListView.tsx              ← Vista compacta
    ├── TagBar.tsx                     ← Chips de tags
    ├── AssetActions.tsx               ← Clone, Delete, Edit, Export
    └── assetAdapters.ts               ← fixtureToAsset(), ingenioToAsset()
```

---

## 4. PLAN DE MIGRACIÓN

### Fase 1: Ingenio Types + Factory (no-UI)
- Crear `src/core/forge/ingenio/types.ts` con las interfaces
- Actualizar `ICompoundIngenioConfig` para soportar `ingenioRef`
- Crear `IngenioFactory.ts` para generar Ingenios vacíos
- Crear factory Ingenios de sistema básicos (smooth-dimmer, bpm-strobe)

### Fase 2: Asset Library Store
- Crear `assetLibraryStore.ts` con la interfaz unificada
- Implementar adaptadores `fixtureToAsset()` / `ingenioToAsset()`
- Tag derivation automática para fixtures existentes

### Fase 3: IPC Bridge para Ingenios
- Implementar handlers IPC en main process (listAll, saveUser, deleteUser, getById)
- Extender `vite-env.d.ts` con `window.lux.ingenio`

### Fase 4: Universal Asset Browser UI
- Implementar `UniversalAssetBrowser` y sub-componentes
- Reemplazar `LibraryTab` en ForgeView
- Reemplazar `FixtureLibrarySidebar` en StageConstructor

### Fase 5: Ingenio Editor UI
- Integrar IngenioEditor en ForgeView (posiblemente un nuevo tab o modal)
- Permitir crear/editar Ingenios visualmente en el canvas de nodos
- Export/Import de `.luxingenio` files

---

## 5. RESUMEN DE DECISIONES ARQUITECTÓNICAS

| # | Decisión | Razón |
|---|----------|-------|
| D1 | Ingenios como archivos `.luxingenio` independientes | Reutilizabilidad entre fixtures y exportabilidad |
| D2 | Referencia por `ingenioRef` + cache inline `subGraph` | No duplica lógica + permite exportación offline |
| D3 | ExposedPorts genéricos (no DMX) | Desacople total del hardware — el usuario mapea al instanciar |
| D4 | Store unificado `assetLibraryStore` | Single source of truth para UI, elimina código duplicado |
| D5 | `LibraryAsset` como DTO unificado | Permite renderizar fixtures e ingenios con el mismo componente |
| D6 | Tags derivados automáticamente para fixtures | No requiere migración manual — los tags se calculan al vuelo |
| D7 | Tree view agrupado por Manufacturer/Category | Escala a +2000 items sin scroll infinito inmanejable |
| D8 | `UniversalAssetBrowser` en `src/components/shared/` | Reutilizable en ForgeView, StageConstructor, y futuros contexts |
| D9 | IngenioInliner separado del compiler | Responsabilidad única — el compiler llama al inliner cuando encuentra compound nodes |
| D10 | IPC separado `window.lux.ingenio` | No contamina el IPC de fixtures existente — backward compatible |

---

*Fin del Blueprint WAVE 4549 — UNIVERSAL ASSET LIBRARY & INGENIO ECOSYSTEM*  
*Documento de diseño. No contiene código de producción.*
