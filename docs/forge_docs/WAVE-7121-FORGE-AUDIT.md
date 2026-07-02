# WAVE-7121 — FORGE MODULE ARCHITECTURE AUDIT

> **Auditor:** Chief Architect & Technical Auditor  
> **Scope:** `src/components/views/forgeview/` + `src/core/forge/` + `src/stores/forgeGraphStore.ts`  
> **Status:** Read-only audit. No code modifications.  
> **Date:** 2025-01-25  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Directory Structure & Module Map](#2-directory-structure--module-map)
3. [Global State Management Architecture](#3-global-state-management-architecture)
4. [Channel Rack Analysis](#4-channel-rack-analysis)
5. [Aether Cells — Logical Division & NodeId/Role Assignment](#5-aether-cells--logical-division--nodeidrole-assignment)
6. [NodeGraph — IgnitionDeps, Contamination & Compiler Pipeline](#6-nodegraph--ignitiondeps-contamination--compiler-pipeline)
7. [WheelSmith — Color & Gobo Wheel Management](#7-wheelsmith--color--gobo-wheel-management)
8. [Cross-Cell Contamination Diagnosis](#8-cross-cell-contamination-diagnosis)
9. [Structural Weaknesses & Risk Register](#9-structural-weaknesses--risk-register)
10. [Data Flow Diagrams](#10-data-flow-diagrams)

---

## 1. Executive Summary

The Forge module is a fixture profile editor that bridges the gap between raw DMX channel arrays and a semantic Aether node graph. It allows operators to define fixture personalities (channels, ignition dependencies, physics, color wheels) and compiles them into `FixtureDefinitionV2` JSON profiles consumed by the runtime Aether engine.

**Architecture pattern:** Reducer-based builder state (`forgeReducer`) for structural data + separate Zustand store (`forgeGraphStore`) for the visual node canvas. The two are synchronized at save-time via `compileForgeState()` and `buildCompleteFixture()`.

**Key strengths:**
- Exhaustive discriminated union actions in the reducer — all state mutations are traceable
- Triple-validated cell type admittance (drag-over → drop → reducer authority)
- Pure compile pipeline with explicit validation phases (A–D)
- Zero-alloc runtime evaluator (`ForgeNodeEvaluator`) using TypedArrays

**Key weaknesses:**
- Dual source of truth between `forgeState.channels` and `forgeGraphStore.graph` — sync is one-directional and lossy
- IgnitionDeps resolution is ambiguous when multiple channels share the same `channelType`
- No cross-cell isolation enforcement at the node graph level — strobe in one cell can bleed into intensity of another
- WheelSmith operates entirely outside the Aether cell model — color wheel slots are orphaned from cell ownership
- `dmxOffset` inconsistency: `compileForgeState` uses `ch.index` (1-based) while `NodeGraphBuilder` uses `ch.index - 1` (0-based)

---

## 2. Directory Structure & Module Map

### 2.1 View Layer (`src/components/views/forgeview/`)

```
forgeview/
├── index.tsx                         — Top-level ForgeView wrapper (lazy loads FixtureForgeEmbedded)
├── FixtureForgeEmbedded.tsx          — Main orchestrator: tabs, state, save/export pipeline (1001 lines)
├── ForgeView.css                     — Global styles
├── WheelSmithEmbedded.tsx            — Color wheel slot editor with live DMX probing (947 lines)
├── WheelSmithEmbedded.css            — WheelSmith styles
├── canvas/
│   ├── NodeCanvas.tsx                — @xyflow/react canvas wrapper (373 lines)
│   ├── NodePalette.tsx               — Draggable node palette for canvas
│   ├── ForgeCanvasLayout.tsx         — Layout shell (palette | canvas | inspector)
│   ├── ForgeModeSwitcher.tsx         — Simple/Advanced mode toggle with lock banner
│   ├── PackIngenioModal.tsx          — Modal for packaging selected nodes as reusable Ingenio
│   └── forgePalette.ts               — Palette entry definitions (node factory functions)
├── inspector/
│   ├── NodeInspector.tsx             — Right-side inspector panel with debounce (262 lines)
│   ├── configPanelRegistry.ts        — Registry mapping node types to config panels
│   └── panels/                       — Individual config panel components per node type
├── nodes/
│   ├── forgeNodeTypeMap.ts           — Maps Forge node types to XYFlow custom node components
│   ├── nodeColors.ts                 — Color constants per node category
│   └── nodeIcons.ts                  — Icon mapping per node type
├── tabs/
│   ├── ForgeGeneralTab.tsx           — General fixture metadata (name, type, manufacturer, capabilities preview)
│   ├── ForgeChannelRackTab.tsx       — DMX channel rack with drag-drop function palette (311 lines)
│   ├── ForgeAetherCellsTab.tsx       — Aether cell grid with DnD channel assignment (536 lines)
│   ├── nodegraph/
│   │   ├── NodeGraphTab.tsx          — Node graph "Cockpit" with arsenal presets (192 lines)
│   │   ├── NodeGraphTab.css
│   │   └── palette/
│   │       └── nodeGraphPresets.ts   — CUYO_ARSENAL preset definitions
│   └── [DMX Layout tab — referenced but not found as separate file]
└── ForgeView.css
```

### 2.2 Core Layer (`src/core/forge/`)

```
forge/
├── forgeBuilderState.ts              — IForgeBuilderState interface + forgeReducer (878 lines)
├── compileForgeState.ts              — Pure compile pipeline: validate → resolve deps → node graph → fixture (493 lines)
├── types.ts                          — Forge NodeGraph type system: nodes, edges, ports, configs (485 lines)
├── NodeGraphBuilder.ts               — Bidirectional migrator: channels[] ↔ IForgeNodeGraph (440 lines)
├── cellTypeAdmittance.ts             — Canonical ChannelType → NodeFamily[] admittance table (141 lines)
├── compiler/
│   ├── ForgeGraphCompiler.ts         — Patch-time compilation: topological sort + wire/state allocation (728 lines)
│   └── types.ts                      — CompiledForgeGraph, CompiledInstruction, CompiledOutput types
└── evaluator/
    ├── ForgeNodeEvaluator.ts         — Zero-alloc hot-path evaluator (165 lines)
    └── opcodes.ts                    — Opcode dispatch table for all node types (22KB)
```

### 2.3 Store Layer

```
stores/
├── forgeGraphStore.ts                — Zustand store for node canvas state (332 lines)
├── stageStore.ts                     — Stage fixtures (used by WheelSmith for live DMX)
└── libraryStore.ts                   — Fixture library persistence (save/load user fixtures)
```

---

## 3. Global State Management Architecture

### 3.1 State Topology

The Forge module uses **three independent state systems** that are synchronized at specific lifecycle points:

#### 3.1.1 Forge Builder State (Reducer)

**Location:** `FixtureForgeEmbedded.tsx:307`  
**Pattern:** `useReducer(forgeReducer, undefined, makeInitialForgeState)`  
**Shape:** `IForgeBuilderState`

```typescript
interface IForgeBuilderState {
  meta:           { manufacturer, name, type, mode?, channelCount }
  channels:       readonly FixtureChannel[]
  cells:          readonly IForgeCellBuilder[]
  dmxGovernors:   readonly IDMXGovernor[]
  capabilities:   Record<string, any>
  physics:        IForgePhysics | null
  wheels:         IForgeWheels | null
  dirty:          boolean
}
```

**Action taxonomy (discriminated union):**
- `CHANNEL_*` — replace, clear, resize, set_count, set_default, set_16bit, set_continuous_rotation
- `IGNITION_*` — add, update, remove
- `CELL_*` — create, delete, rename_label, set_role, set_zone, attach_channel, detach_channel, move_channel
- `GOVERNOR_*` — set_all, add, update, remove, set_for_channel
- `WHEELS_*` — set_colors, set_engine, set_min_change
- `PHYSICS_*` — set, patch
- `SYNC_*` — rack_to_cells, cells_to_rack
- `LIFECYCLE` — hydrate_from_fixture, mark_clean, reset

**Key property:** The reducer is **pure** — all mutations return new state objects. Side-channel warnings are emitted via a module-level `emitWarning` callback that does not affect state.

#### 3.1.2 Forge Graph Store (Zustand)

**Location:** `forgeGraphStore.ts`  
**Pattern:** `create<ForgeGraphState>()`  
**Shape:**

```typescript
interface ForgeGraphState {
  graph:           IForgeNodeGraph | null    // Source of truth for canvas
  fixtureId:       string | null
  isAutoMigrated:  boolean
  selectedNodeIds: Set<ForgeNodeId>
  inspectedNodeId: ForgeNodeId | null
  isDirty:         boolean
  // Actions: loadGraph, unloadGraph, addNode, removeNode, moveNode,
  //          updateNodeConfig, updateNodeLabel, addEdge, removeEdge,
  //          setSelection, inspectNode, markClean, clearGraph
}
```

**Key property:** The store holds the **visual graph** being edited in the NodeGraph tab. It is **completely separate** from `forgeState.channels` and `forgeState.cells`. Synchronization only happens at save-time.

#### 3.1.3 External Stores

- **`useStageStore`** — Provides `fixtures[]` used by WheelSmith for live DMX testing and `reconcileFixturesWithProfile()` for post-save reconciliation.
- **`useLibraryStore`** — Provides `saveUserFixture()`, `loadFromDisk()`, `isSystemFixture()` for persistence.
- **`useNavigationStore`** — Provides `targetFixtureId` for cross-view navigation.

### 3.2 Synchronization Points

| Trigger | Direction | Mechanism |
|---------|-----------|-----------|
| Load fixture | External → Both | `HYDRATE_FROM_FIXTURE` dispatch + `loadGraph()` call |
| Channel type change | Rack → Cells | `SYNC_RACK_TO_CELLS` dispatch (auto-detach if incompatible) |
| Save | Both → Fixture JSON | `buildCompleteFixture()` merges forgeState + forgeGraph |
| Tab switch | None | No sync — each tab reads its own slice of state |

### 3.3 Critical Gap: Dual Source of Truth

The `forgeState.channels` array and the `forgeGraphStore.graph`'s `output_dmx` nodes **both describe the same physical DMX channels**, but they are independently editable:

- **Channel Rack** modifies `forgeState.channels` via `CHANNEL_REPLACE`
- **Node Graph** modifies `forgeGraphStore.graph` nodes via `updateNodeConfig`
- At save time, `syncGraphOutputsWithChannels()` (line 146 of `FixtureForgeEmbedded.tsx`) attempts to reconcile by overwriting graph output node configs from channel data — but this is **one-directional** (channels → graph), meaning manual edits in the Node Graph to channel properties (type, default, ignitionDeps) are silently overwritten.

---

## 4. Channel Rack Analysis

### 4.1 Component Architecture

**File:** `tabs/ForgeChannelRackTab.tsx` (311 lines)  
**Props:** `channels`, `dispatch`, `fixtureType`, `forgeGraph`, `dmxGovernors`

**Layout:** Three-column grid:
- **Left:** Function Foundry (categorized drag palette with collapsible categories)
- **Center:** Channel Rack (one row per DMX channel slot)
- **Right:** 3D Fixture Preview (lazy-loaded `FixturePreview3D`)

### 4.2 Function Palette

**Defined in:** `FixtureForgeEmbedded.tsx:217-262` as `FUNCTION_PALETTE`

| Category | Channel Types |
|----------|--------------|
| INTENSITY | `dimmer`, `shutter`, `strobe` |
| COLOR | `red`, `green`, `blue`, `white`, `amber`, `uv`, `color_wheel` |
| POSITION | `pan`, `pan_fine`, `tilt`, `tilt_fine` |
| BEAM | `gobo`, `prism`, `focus`, `zoom` |
| CONTROL | `speed`, `macro`, `control` |
| INGENIOS | `rotation`, `custom`, `frost`, `gobo_rotation`, `prism_rotation`, `cyan`, `magenta`, `yellow` |

**Missing from palette:** `iris` (defined in ChannelType and admittance table, but not in palette — operators cannot drag-assign it).

### 4.3 Channel Slot Behavior

Each channel row supports:
- **Drag-drop assignment:** Drop a function chip → `CHANNEL_REPLACE` + `SYNC_RACK_TO_CELLS`
- **Inline name editing:** For `custom`, `macro`, `rotation`, `speed`, `control` types (editable input)
- **Default value:** Numeric input clamped 0–255 via `Math.max(0, Math.min(255, ...))`
- **Governor toggle:** Inline drawer with force-byte input; creates `IDMXGovernor` with `when: { intentType: 'fallback', min: 0.85 }` → `then: { forceByte: N }`
- **Clear button:** Dispatches `CHANNEL_CLEAR` (resets to `{ type: 'unknown', name: '', defaultValue: 0, is16bit: false, ignitionDeps: [] }`)

### 4.4 16-Bit Support

- **Detection:** `is16bit: channelType.includes('fine')` — only `pan_fine` and `tilt_fine` get auto-flagged
- **DMX footprint:** In `NodeGraphBuilder.fromChannels()`, 16-bit channels occupy 2 slots: `offset` and `offset + 1`
- **No explicit 16-bit toggle UI:** The Channel Rack does not expose a checkbox to mark arbitrary channels as 16-bit. Only the `_fine` naming convention triggers it.

### 4.5 Smart Default Values

**Function:** `getSmartDefaultValue(channelType)` (imported from `FixtureForgeEmbedded`)  
Called on drop to set intelligent defaults per channel type (e.g., dimmer → 0, shutter → 255, pan/tilt → 127).

### 4.6 Governor Integration

Governors are **per-channel** and stored in `forgeState.dmxGovernors[]`. The inline drawer UI creates a single-rule governor:
```typescript
{
  channelIndex: idx,
  description: `${channel.type.toUpperCase()} safety limit`,
  rules: [{
    when: { intentType: 'fallback', min: 0.85 },
    then: { forceByte: safeByte }
  }]
}
```

**Weakness:** Only one rule per governor via UI. The `IDMXGovernor` type supports multiple rules, but the UI doesn't expose multi-rule editing. The `GOVERNOR_SET_FOR_CHANNEL` action replaces the entire governor (or removes it with `null`).

### 4.7 Simple Mode Lock

When the forge graph is not "simple compatible" (determined by `isSimpleCompatible(forgeGraph)` from `ForgeModeSwitcher`), a `SimpleModeLockBanner` overlay appears on the Channel Rack, directing the user to the Node Graph tab. This prevents channel rack editing when advanced node graph features are in use.

---

## 5. Aether Cells — Logical Division & NodeId/Role Assignment

### 5.1 Cell Builder Type

**File:** `forgeBuilderState.ts`

```typescript
interface IForgeCellBuilder {
  cellId:          string         // Unique identifier (generated on creation)
  family:          NodeFamily     // IMPACT | COLOR | KINETIC | BEAM | ATMOSPHERE
  label:           string         // Operator-editable display name
  role:            NodeRole       // Inferred from family on hydration
  channelIndices:  number[]       // 0-based indices into forgeState.channels
  aetherZone:      string | undefined  // Canonical zone: ambient|air|floor|flash|front|back|movement|dimmer|unassigned
  uiPosition:      { x: number; y: number }
}
```

### 5.2 NodeFamily Enum

**File:** `src/core/aether/types.ts`

| Family | Semantic Meaning | Color |
|--------|-----------------|-------|
| `IMPACT` | Intensity, strobe, shutter, macro | `#f59e0b` (amber) |
| `COLOR` | RGB/CMY/UV color mixing, color wheel | `#ef4444` (red) |
| `KINETIC` | Pan, tilt, rotation, speed | `#22d3ee` (cyan) |
| `BEAM` | Gobo, prism, focus, zoom, frost, iris | `#a855f7` (purple) |
| `ATMOSPHERE` | Control, macro, custom, phantom channels | `#6b7280` (gray) |

### 5.3 Cell Type Admittance

**File:** `cellTypeAdmittance.ts` (141 lines)  
**Pattern:** Immutable lookup table `CELL_TYPE_ADMITTANCE: Readonly<Record<ChannelType, readonly NodeFamily[]>>`

**Triple validation:**
1. **Drag-over** (`ForgeAetherCellsTab.tsx:457`): `canAdmit(activeDrag.channelType, cell.family)` → visual feedback (green border / red border + shake)
2. **Drop** (`ForgeAetherCellsTab.tsx:332`): `canAdmit(drag.channelType, cell.family)` → blocks dispatch if `!ok`
3. **Reducer** (`forgeBuilderState.ts:443`): `canAdmit(channel.type, targetCell.family)` → final authority, no-op if rejected

**Admittance rules (canonical):**
- **Strict families:** `red/green/blue/uv/cyan/magenta/yellow` → COLOR only; `pan/pan_fine/tilt/tilt_fine/rotation/speed` → KINETIC only; `gobo/gobo_rotation/prism/prism_rotation/focus/zoom/frost/iris` → BEAM only
- **Universal channels:** `dimmer/strobe/shutter` → IMPACT, COLOR, BEAM, ATMOSPHERE (WAVE 4732.4 hotfix — needed for wash fixtures with integrated dimmer+strobe)
- **Semi-universal:** `white/amber` → COLOR, IMPACT, BEAM, ATMOSPHERE
- **Cross-family:** `color_wheel` → COLOR, BEAM (mechanical wheel in both washes and spots)
- **Wildcard:** `custom` → all families (with visible warning)
- **Blocked:** `unknown` → no family (empty array)

### 5.4 Cell Creation & DnD Assignment

**Creation:** `CELL_CREATE` action with a `NodeFamily` → generates a cell with `cellId: crypto.randomUUID()`, default label, and auto-inferred role.

**Channel assignment:** DnD via `@dnd-kit/core` with `MouseSensor` (6px activation distance). Channel chips are draggable from the "UNASSIGNED" panel or between cells. Drop triggers:
- From unassigned → `CELL_ATTACH_CHANNEL`
- From another cell → `CELL_MOVE_CHANNEL`

**Invariant enforcement:** A channel index can belong to **at most one cell**. Both `CELL_ATTACH_CHANNEL` and `CELL_MOVE_CHANNEL` enforce this by filtering the channel from all other cells before adding to the target.

### 5.5 Aether Zones

Cells can be assigned a canonical zone via a `<select>` dropdown:
- `ambient`, `air`, `floor`, `flash`, `front`, `back`, `movement`, `dimmer`, `unassigned`

Zones are **semantic labels** persisted in the cell builder and propagated to output DMX nodes as `aetherZone` in the compiled node graph. They do not affect admittance or runtime behavior directly — they are metadata for the Aether ingestion pipeline.

### 5.6 Cell Hydration from Fixture

**File:** `forgeBuilderState.ts:819-835` (`hydrateAetherCells`)

When loading a fixture:
1. If `fixture.aetherCells` (array of `IAetherCellSnapshot`) exists → map directly to `IForgeCellBuilder[]`
2. Otherwise → `hydrateCells(fixture)` heuristic (infers cells from channel types using `primaryFamilyOf()`)

**Snapshot shape:**
```typescript
interface IAetherCellSnapshot {
  id: string
  label: string
  family: string
  channelIndices: number[]
  zone?: string
  layout?: { x: number; y: number }
}
```

### 5.7 Role Assignment

Roles are **inferred from family** during hydration (`inferRoleFromFamily(snap.family)`) and not editable via a dedicated UI in the current Aether Cells tab. The `CELL_SET_ROLE` action exists in the reducer but is not wired to any UI control.

---

## 6. NodeGraph — IgnitionDeps, Contamination & Compiler Pipeline

### 6.1 Node Graph Type System

**File:** `types.ts` (485 lines)  
**Schema version:** `'1.0.0'`

**Node categories:**
- `input` — `input_dmx`, `input_audio_band`, `input_beat`, `input_bpm`, `input_energy`, `input_constant`, `input_time`
- `process` — `proc_lfo`, `proc_smooth`, `proc_map_range`, `proc_math`, `proc_clamp`, `proc_delay`, `proc_merge`, `proc_invert`, `proc_curve`
- `logic` — `logic_threshold`, `logic_gate`, `logic_switch`, `logic_and`, `logic_or`, `logic_counter`
- `output` — `output_dmx`
- `compound` — `compound_ingenio` (reusable sub-graph, inlined at compile time)

**Node structure:**
```typescript
interface IForgeNode {
  id:          ForgeNodeId
  type:        ForgeNodeType
  category:    'input' | 'process' | 'logic' | 'output' | 'compound'
  inputs:      IForgePort[]
  outputs:     IForgePort[]
  config:      IForgeNodeConfig    // Discriminated union by nodeType
  uiPosition:  { x: number; y: number }
  label:       string
  profileMeta?: { customLabel?: string }
}
```

**Output DMX node config (critical for runtime):**
```typescript
interface IOutputDmxConfig {
  nodeType:           'output_dmx'
  channelType:        ChannelType
  dmxOffset:          number          // 0-based or 1-based (INCONSISTENT — see §6.5)
  channelName?:       string
  cellLabel?:         string
  defaultDmxValue:    number
  is16bit?:           boolean
  continuousRotation?: boolean
  aetherNodeId?:      string          // ID of owning Aether cell
  aetherZone?:        string
  ignitionDeps?:      readonly IgnitionDependency[]
}
```

### 6.2 NodeGraphBuilder — Bidirectional Migrator

**File:** `NodeGraphBuilder.ts` (440 lines)

**Direction 1: `fromChannels(channels[]) → IForgeNodeGraph`**
- Creates a passthrough graph: `input_dmx` → `output_dmx` per channel
- Node IDs: `in-{type}-{index}` and `out-{type}-{index}`
- Edge IDs: `edge-{NNN}` (zero-padded)
- DMX footprint: `max(dmxOffset) + 1` where `dmxOffset = channel.index - 1` (0-based)
- Preserves `ignitionDeps` from legacy channel to output node config

**Direction 2: `toChannels(graph) → FixtureChannel[]`**
- Filters `output_dmx` nodes, maps to `FixtureChannel`
- `channel.index = cfg.dmxOffset + 1` (converts back to 1-based)
- Sorts by `index` ascending
- Roundtrips `ignitionDeps`, `continuousRotation`, `customName`

**Validation (`validate(graph) → ForgeValidationError[]`):**
- V1: Edge source port must exist on source node
- V2: Edge target port must exist on target node
- V3: Input port accepts max 1 incoming edge (recommends `proc_merge` for multiple)
- V6: Graph must have ≥1 `output_dmx` node
- V7: No two `output_dmx` nodes share the same `dmxOffset`
- Orphan check: Unconnected nodes (warning, not error)

### 6.3 Compile Forge State Pipeline

**File:** `compileForgeState.ts` (493 lines)

**Entry point:** `compileForgeState(state: IForgeBuilderState): CompileResult`

**Phase A — Validation (`validateState`):**
- V1: Duplicate cell IDs → error
- V2: Empty cells (no channel indices) → error
- V3: Channel index out of bounds → error
- V4: Channel type incompatible with owning cell family → error (uses `canAdmit()`)
- V5: IgnitionDeps with unresolved `channelType` only → warning (MISSING_DEP or AMBIGUOUS_DEP)

**Phase B — Ignition Deps Resolution (`resolveChannelDeps`):**
- For each channel with `ignitionDeps`:
  - If `dep.targetChannelIndex` is defined → keep as-is
  - If only `dep.channelType` → search for matching channels (excluding self)
  - If exactly 1 match → auto-resolve `targetChannelIndex`
  - If 0 or >1 matches → leave unresolved (warning already emitted in Phase A)

**Phase C — Node Graph Compilation (`compileNodeGraph`):**
- Builds `channelToCell` map (channel index → owning `IForgeCellBuilder`)
- For each non-`unknown` channel (sorted by DMX index):
  - Creates `input_dmx` node with `channelKey: ch.type`
  - Creates `output_dmx` node with `aetherNodeId`, `aetherZone`, `cellLabel` from owning cell
  - Creates direct edge `input.value → output.value`
- Calculates `dmxFootprint` from max channel index (+1 for 16-bit)

**Phase D — Final Assembly:**
- Calls `deriveCapabilitiesUnified(resolvedChannels, wheels, physics)`
- Assembles `FixtureDefinitionV2` with `channels`, `nodeGraph`, `capabilities`

### 6.4 Build Complete Fixture (Trinity Contract)

**File:** `compileForgeState.ts:432`  
**Function:** `buildCompleteFixture(state: IForgeBuilderState): FixtureDefinition`

This is the **save-time entry point** called from `FixtureForgeEmbedded.tsx:566`. It:
1. Resolves ignition deps on all channels
2. Attempts `compileForgeState()` — on failure, logs error and degrades (no nodeGraph)
3. Merges compiled nodeGraph into the built fixture
4. Also calls `syncGraphOutputsWithChannels()` to overwrite graph output configs from channel rack state

**Additionally in `FixtureForgeEmbedded.tsx:526-543`:**
- If `forgeState.cells.length > 0`, runs `compileForgeState()` again
- If successful, **overwrites** `builtFixture.nodeGraph` with the compiled result
- Also **overwrites** `builtFixture.channels` with deps-resolved channels via `resolveChannelDeps()`

**Critical observation:** The node graph is compiled twice — once in `buildCompleteFixture()` and once in the `FixtureForgeEmbedded` callback. The second compilation's result wins. This is redundant but not harmful (both produce the same output for the same state).

### 6.5 DMX Offset Inconsistency

**`NodeGraphBuilder.ts:120`:** `dmxOffset: channel.index - 1` (0-based)  
**`compileForgeState.ts:258`:** `dmxOffset: ch.index` (1-based, raw channel index)

This means:
- Graphs generated by `NodeGraphBuilder.fromChannels()` use 0-based offsets
- Graphs generated by `compileForgeState.compileNodeGraph()` use 1-based offsets
- At runtime, the evaluator writes to `dmxBuffer[baseAddr + cfg.dmxOffset]` — so a 1-based offset would write to the wrong DMX address

**Impact:** Fixtures saved through the Aether Cells path will have node graphs with 1-based `dmxOffset`, causing a +1 DMX address shift at runtime. The `syncGraphOutputsWithChannels()` function in `FixtureForgeEmbedded.tsx:146` has a fallback resolver that tries both `offset` and `offset - 1`, but this only applies to the visual graph sync, not the compiled graph.

### 6.6 Patch-Time Compiler (Runtime)

**File:** `compiler/ForgeGraphCompiler.ts` (728 lines)

Compiles `IForgeNodeGraph` → `CompiledForgeGraph` (flat, TypedArray-based):
1. **Topological sort** (Kahn's algorithm) → `executionOrder[]`
2. **Wire allocation** → `Float64Array` (port → index mapping)
3. **State allocation** → `Float64Array` (stateful nodes like LFO, delay, smooth)
4. **Program build** → `CompiledInstruction[]` (opcode + offsets)
5. **Edge wiring** → `Uint32Array` of `[src, dst]` pairs
6. **Input/Output map** extraction

**Compound Ingenio inlining:** `_inlineCompoundNodes()` replaces compound nodes with their sub-graph nodes/edges at patch time (WAVE 4552). Flat graphs pass through with zero overhead.

### 6.7 Runtime Evaluator

**File:** `evaluator/ForgeNodeEvaluator.ts` (165 lines)

**Zero-alloc evaluation per frame:**
1. **Inject inputs** — Aether `ArbitratedNodeMap` values → `wireBuffer` via `inputMap`
2. **Execute program** — Linear scan of `CompiledInstruction[]`, dispatch via `OPCODE_TABLE`
3. **Propagate edges** — After each instruction, copy wire values per `wireBuffer`
4. **Flush outputs** — `output_dmx` nodes write `normalized → 8-bit/16-bit` to `dmxBuffer`

**Photon Tracer:** Every 20 frames, logs a sample for debugging (can be disabled).

---

## 7. WheelSmith — Color & Gobo Wheel Management

### 7.1 Component Architecture

**File:** `WheelSmithEmbedded.tsx` (947 lines)  
**Pattern:** Self-contained component with props-based interface (no direct forgeReducer integration beyond color array callbacks)

**Props:**
```typescript
interface WheelSmithEmbeddedProps {
  colors:               WheelColor[]
  onColorsChange:       (colors: WheelColor[]) => void
  hasColorWheelChannel: boolean
  onNavigateToRack:     () => void
  onTestDmx?:           (value: number) => void
  fixtureId?:           string | null
  channelIndex?:        number          // 0-based index of color_wheel channel
  minChangeTimeMs?:     number
  onMinChangeTimeMsChange?: (ms: number) => void
}
```

### 7.2 Integration with Forge State

WheelSmith is mounted in `FixtureForgeEmbedded.tsx:843-853`:
```tsx
<WheelSmithEmbedded
  colors={(wheels?.colors ?? []) as WheelColor[]}
  onColorsChange={(newColors) => forgeDispatch({ type: 'WHEELS_SET_COLORS', colors: newColors })}
  hasColorWheelChannel={channels.some(ch => ch.type === 'color_wheel')}
  onNavigateToRack={() => setActiveTab('channels')}
  fixtureId={originalFixtureId}
  channelIndex={channels.findIndex(ch => ch.type === 'color_wheel')}
  minChangeTimeMs={wheels?.minChangeTimeMs ?? 500}
  onMinChangeTimeMsChange={(ms) => forgeDispatch({ type: 'WHEELS_SET_MIN_CHANGE', ms })}
/>
```

**Data flow:**
- Colors are stored in `forgeState.wheels.colors` (via `WHEELS_SET_COLORS`)
- `minChangeTimeMs` is stored in `forgeState.wheels.minChangeTimeMs` (via `WHEELS_SET_MIN_CHANGE`)
- `colorEngine` is stored in `forgeState.wheels.colorEngine` (via `WHEELS_SET_ENGINE` — not exposed in WheelSmith UI, only in General tab)

### 7.3 Wheel Color Slot Model

```typescript
interface WheelColor {
  dmx:        number              // DMX value (0-255) that selects this color
  name:       string              // Display name
  rgb:        { r, g, b }         // RGB representation
  hasTexture?: boolean            // Gobo texture flag
  _key?:      string              // Stable identity (crypto.randomUUID or fallback)
}
```

**Stable keys (WAVE 2072):** Every slot gets a `_key` via `crypto.randomUUID()` (or fallback `ws-{timestamp}-{counter}`). Keys are immutable after creation and used for React reconciliation and deep-copy updates.

### 7.4 Validation Engine (WAVE 2093.3)

**`wheelValidation` useMemo** detects three issue types:
- **Duplicate DMX:** Two slots with the same `dmx` value
- **Spin overlap:** Slot DMX value in continuous spin range (190–255)
- **Non-monotonic:** Slot N DMX ≤ slot N-1 DMX (physical wheels expect ascending)

Warned slots are highlighted with per-card visual feedback.

### 7.5 Live DMX Testing

**3-tier DMX injection:**
1. **Has engine + has fixture:** Direct IPC via `lux.sendDmxChannel(universe, address, value)` with 40ms throttle (25Hz max)
2. **Has engine + orphan profile:** User selects a stage fixture as test target
3. **No engine / no fixture:** "Mold test" mode — DMX address input only, no hardware output

**Ignition Hydrator (WAVE 4719):** `buildHydratedTestFrame()` constructs a complete DMX frame:
1. Base frame: all channels to their `defaultValue`
2. Override: `color_wheel` → test value, `dimmer` → 255, `shutter` → 255 (or `strobe` → 0)
3. Apply `ignitionDeps` for each overridden channel
4. Send frame channel-by-channel via `lux.sendDmxChannel()`

**Kill Switch:** Restores all channels to their `defaultValue` via direct IPC.

### 7.6 Gobo Wheel Support

**Current state:** The `GoboIcon` is imported from `LuxIcons` and a `hasTexture` flag exists on `WheelColor`, but there is **no dedicated gobo wheel editor**. The WheelSmith component is color-wheel-only. Gobo management is limited to:
- The `gobo` and `gobo_rotation` channel types in the Channel Rack
- The `BEAM` cell family admittance for gobo channels
- No gobo slot editor (DMX-to-gobo-image mapping) exists in the Forge

### 7.7 WheelSmith Weaknesses

- **No gobo wheel editor:** Only color wheels are supported. Gobo wheels require a separate slot editor with image/texture references.
- **No color engine selection in WheelSmith:** `colorEngine` (rgb/cmy/rgbw/rgbaw) is set in the General tab, not in WheelSmith where colors are actually defined.
- **`queueMicrotask` side-effect:** `ensureKeys()` triggers `onColorsChange(colors)` via `queueMicrotask` during render if keys are missing — this is a side-effect during render that can cause React warnings and potential infinite loops if the parent doesn't memoize properly.
- **DMX address calculation:** `absoluteAddress = effectiveBaseAddress + (channelIndex || 0)` — but `channelIndex` is 0-based while `effectiveBaseAddress` is the fixture's DMX start address. This appears correct for 0-based channel indexing.

---

## 8. Cross-Cell Contamination Diagnosis

### 8.1 The Core Problem

**Scenario:** A compound fixture (e.g., a beam+wash hybrid) has two Aether cells:
- Cell A (IMPACT): contains `dimmer` and `strobe`
- Cell B (COLOR): contains `red`, `green`, `blue`

**Expected behavior:** Strobe in Cell A should not affect the color intensity in Cell B.

**Actual behavior at runtime:** The Aether engine's `NodeResolver` processes intents per `channelKey`. Since `strobe` and `dimmer` are both in the IMPACT family, and the Aether IntentBus dispatches by `channelKey` (not by cell), a strobe intent can indirectly affect the dimmer channel which in turn affects overall fixture output — including the color channels in Cell B if they don't have their own dimmer.

### 8.2 Node Graph Level

**Current state:** The compiled node graph creates simple passthrough edges (`input_dmx.value → output_dmx.value`) for every channel. There are **no cross-cell edges** and **no cell boundary enforcement** in the graph structure. Each channel is an independent input→output pair.

**Missing:** There is no mechanism in the node graph to express:
- Cell-internal dependencies (e.g., strobe gates dimmer within the same cell)
- Cell-external isolation (e.g., strobe in Cell A cannot affect dimmer in Cell B)
- Cell-level intent routing (e.g., "intensity intent goes to Cell A's dimmer, not Cell B's red")

### 8.3 IgnitionDeps as Partial Isolation

`ignitionDeps` provide a **precondition mechanism**: a channel can declare that it requires another channel to be at a specific value before it can emit. For example:
```typescript
// dimmer channel requires shutter to be open (255) before it can emit
dimmer.ignitionDeps = [{ channelType: 'shutter', requiredValue: 255, mode: 'hold' }]
```

**Limitations:**
- `ignitionDeps` are **per-channel**, not per-cell. They don't express cell-level boundaries.
- Resolution by `channelType` is **ambiguous** when multiple channels of the same type exist across cells (e.g., two `dimmer` channels in different cells).
- The `resolveDep()` function in `compileForgeState.ts:186` auto-resolves only when exactly 1 match exists. With multiple matches, the dep remains unresolved and the operator must manually set `targetChannelIndex`.
- There is no UI in the Aether Cells tab for managing `ignitionDeps` — they are only editable in the DMX Layout tab (which was not found as a separate file in this audit).

### 8.4 Governor-Level Contamination

DMX Governors provide **last-mile clamping** per channel:
```typescript
{
  channelIndex: idx,
  rules: [{
    when: { intentType: 'fallback', min: 0.85 },
    then: { forceByte: 255 }
  }]
}
```

**Contamination risk:** Governors are applied per-channel at the DMX output stage, **after** the Aether engine has resolved intents. If the Aether engine sends a high strobe intent that bleeds into the dimmer channel's normalized value, the governor on the dimmer channel may clamp it to 255 — but this is a **per-channel guard**, not a **cross-cell guard**.

### 8.5 Runtime Intent Bus Level

At runtime, the Aether engine's `NodeResolver` receives an `ArbitratedNodeMap` (channel key → normalized value) and writes to the forge graph's input nodes. The graph evaluator then processes nodes in topological order and writes to the DMX buffer.

**The contamination path:**
1. Selene (the AI) emits an intent: `{ type: 'strobe', intensity: 0.9 }`
2. The Aether IntentBus maps `strobe` → all channels with `channelType: 'strobe'`
3. If the fixture has a single `strobe` channel in Cell A, only Cell A is affected ✓
4. But if Selene also emits `{ type: 'intensity', intensity: 0.9 }` simultaneously, and the fixture has a `dimmer` in Cell A, the dimmer receives the intent — which is correct
5. **The problem arises when compound fixtures share channels across logical units.** For example, a fixture with a single `dimmer` channel that controls both beam and wash output — putting it in Cell A (IMPACT) means Cell B (COLOR) has no independent intensity control.

### 8.6 Summary of Contamination Vectors

| Vector | Mechanism | Status |
|--------|-----------|--------|
| Shared dimmer across cells | Single `dimmer` channel in one cell affects all cells | **No isolation** — by design (DMX hardware limitation) |
| Strobe affecting intensity | Strobe intent bleeds into dimmer via Aether engine | **Partially mitigated** by ignitionDeps (shutter must be open) |
| Color wheel in wrong cell | `color_wheel` admittance allows both COLOR and BEAM | **By design** — operator's responsibility |
| Multiple channels same type | ignitionDeps resolution ambiguity | **Warning only** — operator must resolve manually |
| Node graph cross-wiring | No cell boundary in graph topology | **Architectural gap** — no enforcement exists |

---

## 9. Structural Weaknesses & Risk Register

### 9.1 Critical

| ID | Weakness | Impact | Location |
|----|----------|--------|----------|
| **W-1** | **DMX offset inconsistency** (0-based vs 1-based) between `NodeGraphBuilder` and `compileForgeState` | Runtime DMX address off-by-one for fixtures saved through Aether Cells path | `NodeGraphBuilder.ts:120` vs `compileForgeState.ts:258` |
| **W-2** | **Dual source of truth** — `forgeState.channels` and `forgeGraphStore.graph` both describe channels, sync is one-directional | Node Graph edits to channel properties silently overwritten at save | `FixtureForgeEmbedded.tsx:146-207, 526-531` |
| **W-3** | **Double compilation** — `compileForgeState()` called both in `buildCompleteFixture()` and again in `FixtureForgeEmbedded` | Redundant work; potential for divergence if state changes between calls | `compileForgeState.ts:432` + `FixtureForgeEmbedded.tsx:528` |

### 9.2 High

| ID | Weakness | Impact | Location |
|----|----------|--------|----------|
| **W-4** | **No cross-cell isolation** in node graph topology | Strobe/intensity contamination between cells; no programmatic boundary | `compileForgeState.ts:307-361` |
| **W-5** | **IgnitionDeps resolution ambiguity** when multiple channels share `channelType` | Unresolved deps → channels may not emit at runtime | `compileForgeState.ts:186-197` |
| **W-6** | **`queueMicrotask` side-effect during render** in WheelSmith `ensureKeys()` | React render-phase side-effect; potential infinite update loop | `WheelSmithEmbedded.tsx:194-196` |
| **W-7** | **`iris` channel type missing from FUNCTION_PALETTE** | Operators cannot assign iris via drag-drop | `FixtureForgeEmbedded.tsx:217-262` |
| **W-8** | **No gobo wheel editor** — only color wheels supported in WheelSmith | Gobo fixtures cannot define slot-to-image mappings | `WheelSmithEmbedded.tsx` |

### 9.3 Medium

| ID | Weakness | Impact | Location |
|----|----------|--------|----------|
| **W-9** | **`CELL_SET_ROLE` action exists but no UI** | Roles are inferred but not operator-editable | `forgeBuilderState.ts:140` |
| **W-10** | **Governor UI limited to single rule** | Multi-condition governors not editable via UI | `ForgeChannelRackTab.tsx:248-262` |
| **W-11** | **`cloneGraph()` in forgeGraphStore is shallow** — spreads graph but shares `nodes[]` and `edges[]` array references | Potential mutation if any code pushes to arrays instead of replacing | `forgeGraphStore.ts:107-110` |
| **W-12** | **No validation for DMX footprint overflow** (>512 channels) | Could crash runtime evaluator or DMX output | `compileForgeState.ts:346-358` |
| **W-13** | **`colorEngine` not editable in WheelSmith** | Operator must switch to General tab to change engine type | `WheelSmithEmbedded.tsx` vs `ForgeGeneralTab.tsx` |

### 9.4 Low

| ID | Weakness | Impact | Location |
|----|----------|--------|----------|
| **W-14** | **`moveNode` does not set `isDirty`** | Position-only changes not flagged as unsaved | `forgeGraphStore.ts:194` (intentional — cosmetic) |
| **W-15** | **Orphan node check is warning-only** | Disconnected nodes persist in graph without error | `NodeGraphBuilder.ts:428` |
| **W-16** | **No undo/redo** in forgeReducer or forgeGraphStore | Operator mistakes are irreversible (except via re-hydration) | System-wide |

---

## 10. Data Flow Diagrams

### 10.1 Load Fixture Flow

```
User selects fixture from Library tab
  │
  ▼
handleSelectFromLibrary(fixture)
  │
  ├──► forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture })
  │      └──► forgeReducer reconstructs IForgeBuilderState:
  │            ├── meta (name, manufacturer, type, channelCount)
  │            ├── channels (hydrateChannels — maps FixtureChannel[])
  │            ├── cells (hydrateAetherCells — from aetherCells[] or heuristic)
  │            ├── dmxGovernors (from fixture.dmxGovernors)
  │            ├── physics (hydratePhysics)
  │            └── wheels (hydrateWheels)
  │
  └──► hydrateForgeGraph(fixture)
         └──► loadGraph(NodeGraphBuilder.fromChannels(channels), fixtureId, true)
                └──► forgeGraphStore.graph = IForgeNodeGraph (passthrough)
```

### 10.2 Save Fixture Flow

```
User clicks Save
  │
  ▼
handleSave()
  │
  ├──► Pre-check: compileForgeState(forgeState)
  │      └──► If errors → block save, show error badge
  │
  ├──► buildCompleteFixture(forgeState)
  │      ├──► resolveChannelDeps() on all channels
  │      ├──► compileForgeState() → nodeGraph (if cells exist)
  │      └──► syncGraphOutputsWithChannels() — overwrite graph outputs from channels
  │
  ├──► FixtureForgeEmbedded.tsx:526 — second compileForgeState() call
  │      └──► Overwrites builtFixture.nodeGraph + channels with resolved versions
  │
  ├──► saveUserFixture(completeFixture) — IPC to Electron main
  │
  └──► reconcileFixturesWithProfile() — update stage fixtures
```

### 10.3 Channel Rack → Aether Cells Sync

```
User drops "strobe" function on CH3 in Channel Rack
  │
  ▼
dispatch({ type: 'CHANNEL_REPLACE', idx: 2, channel: { type: 'strobe', ... } })
  │
  ▼
dispatch({ type: 'SYNC_RACK_TO_CELLS', channelIdx: 2 })
  │
  ▼
forgeReducer SYNC_RACK_TO_CELLS:
  ├── For each cell containing channelIdx 2:
  │    └── canAdmit('strobe', cell.family)
  │         ├── ok → keep
  │         └── !ok → detach + emitWarning
  └── Return updated state
```

### 10.4 Node Graph Compile → Runtime

```
FixtureDefinition saved to disk
  │
  ▼
At show load time:
  │
  ├──► ForgeGraphCompiler.compile(fixture.nodeGraph)
  │      └──► CompiledForgeGraph (TypedArrays, executionOrder, opcodes)
  │
  ▼
At 44Hz runtime:
  │
  ├──► ForgeNodeEvaluator.evaluate(compiled, values, ctx, dmxBuffer, baseAddr)
  │      ├── Step 1: Inject Aether values → wireBuffer
  │      ├── Step 2: Execute opcode program (linear scan)
  │      ├── Step 3: Propagate edges (copy wire values)
  │      └── Step 4: Flush output_dmx → dmxBuffer (normalized → 8-bit)
  │
  ▼
DMX buffer sent to interface
```

---

## Appendix A — Key Type References

### FixtureChannel (FixtureDefinition.ts:180)

```typescript
interface FixtureChannel {
  index:               number      // 1-based DMX channel number
  name:                string
  type:                ChannelType // 30 defined types + 'unknown'
  defaultValue:        number      // 0-255
  is16bit?:            boolean
  continuousRotation?: boolean
  customName?:         string
  ignitionDeps?:       IgnitionDependency[]
}
```

### IgnitionDependency (FixtureDefinition.ts:160)

```typescript
interface IgnitionDependency {
  channelType:         ChannelType
  requiredValue:       number
  targetChannelIndex?: number      // 0-based DMX index (highest priority)
  mode?:               'hold' | 'release'
}
```

### IDMXGovernor (FixtureDefinition.ts:256)

```typescript
interface IDMXGovernor {
  channelIndex: number              // 0-based offset
  description?: string
  rules: [{
    when: { intentType?: string; min?: number; max?: number }
    then: { forceByte: number }
  }]
}
```

### IForgeWheels (FixtureDefinition.ts:286)

```typescript
interface IForgeWheels {
  colors:          WheelColor[]
  colorEngine:     ColorEngineType    // 'rgb' | 'cmy' | 'rgbw' | 'rgbaw' | ...
  minChangeTimeMs?: number
}
```

---

## Appendix B — Channel Type Inventory

| ChannelType | Category | Primary Family | 16-bit? | In Palette? |
|-------------|----------|---------------|---------|-------------|
| `dimmer` | INTENSITY | IMPACT | No | ✓ |
| `strobe` | INTENSITY | IMPACT | No | ✓ |
| `shutter` | INTENSITY | IMPACT | No | ✓ |
| `red` | COLOR | COLOR | No | ✓ |
| `green` | COLOR | COLOR | No | ✓ |
| `blue` | COLOR | COLOR | No | ✓ |
| `white` | COLOR | COLOR | No | ✓ |
| `amber` | COLOR | COLOR | No | ✓ |
| `uv` | COLOR | COLOR | No | ✓ |
| `cyan` | COLOR | COLOR | No | ✓ (INGENIOS) |
| `magenta` | COLOR | COLOR | No | ✓ (INGENIOS) |
| `yellow` | COLOR | COLOR | No | ✓ (INGENIOS) |
| `color_wheel` | COLOR | COLOR | No | ✓ |
| `pan` | POSITION | KINETIC | No | ✓ |
| `pan_fine` | POSITION | KINETIC | **Yes** | ✓ |
| `tilt` | POSITION | KINETIC | No | ✓ |
| `tilt_fine` | POSITION | KINETIC | **Yes** | ✓ |
| `rotation` | POSITION | KINETIC | No | ✓ (INGENIOS) |
| `speed` | POSITION | KINETIC | No | ✓ |
| `gobo` | BEAM | BEAM | No | ✓ |
| `gobo_rotation` | BEAM | BEAM | No | ✓ (INGENIOS) |
| `prism` | BEAM | BEAM | No | ✓ |
| `prism_rotation` | BEAM | BEAM | No | ✓ (INGENIOS) |
| `focus` | BEAM | BEAM | No | ✓ |
| `zoom` | BEAM | BEAM | No | ✓ |
| `frost` | BEAM | BEAM | No | ✓ (INGENIOS) |
| `iris` | BEAM | BEAM | No | **✗ MISSING** |
| `macro` | CONTROL | ATMOSPHERE | No | ✓ |
| `control` | CONTROL | ATMOSPHERE | No | ✓ |
| `custom` | CONTROL | ATMOSPHERE | No | ✓ (INGENIOS) |
| `unknown` | — | — | No | N/A |

---

*End of WAVE-7121 Forge Module Architecture Audit*
