# BLUEPRINT MAESTRO — UNIFICACIÓN DE LA FORJA
## WAVE: FORGE CONVERGENCE ARCHITECTURE

> **ROL:** Chief Software Architect & State Topology Master  
> **ESTADO:** Blueprint para ejecución por infantería  
> **PILARES:** Sync Bidireccional · Persistencia Total · Gobernadores · Anti-Pánico

---

## ÍNDICE

1. [Diagnóstico del Cisma](#1-diagnóstico-del-cisma)
2. [Pilar 1 — Unificación de Fuente de Verdad](#2-pilar-1--unificación-de-fuente-de-verdad)
3. [Pilar 2 — Persistencia Total (aetherCells)](#3-pilar-2--persistencia-total-aethercells)
4. [Pilar 3 — Inyección Nativa de Gobernadores](#4-pilar-3--inyección-nativa-de-gobernadores)
5. [Pilar 4 — Guardado Anti-Pánico](#5-pilar-4--guardado-anti-pánico)
6. [Contratos de Tipado Nuevos](#6-contratos-de-tipado-nuevos)
7. [Fragmentos de Implementación](#7-fragmentos-de-implementación)
8. [Diagrama de Flujo Post-Refactor](#8-diagrama-de-flujo-post-refactor)
9. [Orden de Ejecución](#9-orden-de-ejecución)

---

## 1. DIAGNÓSTICO DEL CISMA

### El problema en una frase

El estado del editor vive en **tres** sitios desconectados:

| Store | Tipo | Qué posee | Limitación |
|-------|------|-----------|------------|
| `fixture` (useState) | React state | channels[], capabilities, physics, wheels | No sabe de células |
| `forgeState` (useReducer) | React reducer | channels[] (copia), cells[] | 1-tick lag. Sync unidireccional Rack→Cells |
| `forgeGraphStore` (Zustand) | Zustand store | IForgeNodeGraph (canvas visual) | Derivado. Se auto-migra. Desconectado de cells |

**Consecuencias directas:**
- El sync Rack→Cells usa `useEffect` con `forgeChannelsRef` para evitar loops infinitos (WAVE 4830).
- `buildCompleteFixture` recompila `nodeGraph` desde `forgeState` si hay células, pero falla silenciosamente si `forgeState` lleva 1 tick de retraso.
- `hydrateCells()` reconstruye las células desde `nodeGraph.nodes[output_dmx].config.aetherNodeId` — perdiendo layout visual y campos que no se serializan en `output_dmx`.
- Si `compileForgeState` retorna `ok:false` durante `buildCompleteFixture`, el grafo anterior prevalece con datos stale.

### Raíz del mal

El `useReducer` de `forgeState` fue diseñado como *"dos mundos, un estado"*, pero `fixture` (useState) sigue siendo tratado como la fuente de verdad para `channels[]`. Esto genera un **dual-master conflict**: dos fuentes de verdad para la misma entidad.

---

## 2. PILAR 1 — UNIFICACIÓN DE FUENTE DE VERDAD

### Decisión Arquitectónica

**El `forgeReducer` (`IForgeBuilderState`) se convierte en la ÚNICA fuente de verdad.**

El `useState<FixtureDefinition>` se degrada a un **snapshot de carga inicial** que se descarta tras `HYDRATE_FROM_FIXTURE`. Toda mutación posterior ocurre exclusivamente en `forgeState`.

### 2.1 Nuevo campo `dmxGovernors` en `IForgeBuilderState`

```ts
// forgeBuilderState.ts
export interface IForgeBuilderState {
  readonly meta:           IForgeFixtureMeta
  readonly channels:       readonly FixtureChannel[]
  readonly cells:          readonly IForgeCellBuilder[]
  readonly capabilities:   Readonly<Record<string, unknown>>
  readonly dmxGovernors:   readonly IDMXGovernor[]      // ← NUEVO
  readonly dirty:          boolean
}
```

### 2.2 Eliminación del `useState<FixtureDefinition>` como fuente activa

**Antes:**
```tsx
// FixtureForgeEmbedded.tsx (estado actual)
const [fixture, setFixture] = useState<FixtureDefinition>(FixtureFactory.createEmpty())
const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)
```

**Después:**
```tsx
// FixtureForgeEmbedded.tsx (refactor)
const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)

// fixture degradado a snapshot de lectura — nunca se muta directamente para channels
const fixtureSnapshot = useRef<FixtureDefinition>(FixtureFactory.createEmpty())
```

### 2.3 Sync Bidireccional — Reemplazado por derivación

En lugar de sincronizar `fixture.channels → forgeState.channels`, los consumers que lean `channels` lo hacen directamente del reducer:

```tsx
// Hook derivado — reemplaza lecturas de fixture.channels
const channels    = forgeState.channels
const cells       = forgeState.cells
const governors   = forgeState.dmxGovernors
```

El `useEffect` de sync (líneas 810-860 actuales) **se elimina por completo**. No hay sync porque no hay dual-master.

### 2.4 Nuevas Actions para el Reducer

```ts
// forgeBuilderState.ts — nuevas acciones

// Governors
export type GovernorAction =
  | { type: 'GOVERNOR_SET_ALL';    governors: readonly IDMXGovernor[] }
  | { type: 'GOVERNOR_ADD';        governor: IDMXGovernor }
  | { type: 'GOVERNOR_UPDATE';     channelIndex: number; governor: IDMXGovernor }
  | { type: 'GOVERNOR_REMOVE';     channelIndex: number }

// Capabilities (edit explícito — no más spread ciego)
export type CapabilityAction =
  | { type: 'CAPABILITY_SET';      key: string; value: unknown }
  | { type: 'CAPABILITY_MERGE';    patch: Record<string, unknown> }

// Physics
export type PhysicsAction =
  | { type: 'PHYSICS_SET';         physics: IForgePhysics }

// Wheels
export type WheelsAction =
  | { type: 'WHEELS_SET_COLORS';   colors: WheelColor[] }
  | { type: 'WHEELS_SET_MIN_CHANGE'; ms: number }

export type ForgeAction =
  | DmxAction
  | CellAction
  | MetaAction
  | GovernorAction       // ← NUEVO
  | CapabilityAction     // ← NUEVO
  | PhysicsAction        // ← NUEVO
  | WheelsAction         // ← NUEVO
  | LifecycleAction
```

### 2.5 Impacto en Cell → Channel (Dirección inversa)

Cuando el usuario arrastra un módulo en Aether Cells (ej. `CELL_ATTACH_CHANNEL`), el reducer YA opera sobre `state.channels` (misma referencia). No hay latencia ni sync — la mutación es atómica:

```ts
// Ya existente en forgeReducer — SIN CAMBIOS NECESARIOS
case 'CELL_ATTACH_CHANNEL': {
  const { cellId, channelIdx } = action
  // ... admittance check ...
  // Muta state.cells (no state.channels), que es correcto
  // Ambos comparten el mismo state tree — zero latency
  return { ...state, cells, dirty: true }
}
```

El Channel Rack lee de `forgeState.channels`. Las Cells leen de `forgeState.cells`. Ambos son campos del mismo objeto — **sync instantáneo por diseño**.

### 2.6 Estado extendido completo

```ts
export interface IForgeBuilderState {
  // ── Identidad ────────────────────────────────────────────────
  readonly meta:           IForgeFixtureMeta
  // ── DMX Layout (Channel Rack) ────────────────────────────────
  readonly channels:       readonly FixtureChannel[]
  // ── Aether Modules (Cells) ──────────────────────────────────
  readonly cells:          readonly IForgeCellBuilder[]
  // ── Hardware Rules ───────────────────────────────────────────
  readonly dmxGovernors:   readonly IDMXGovernor[]
  // ── Derived Capabilities ─────────────────────────────────────
  readonly capabilities:   Readonly<Record<string, unknown>>
  // ── Physics ──────────────────────────────────────────────────
  readonly physics:        IForgePhysics | null
  // ── Wheels ───────────────────────────────────────────────────
  readonly wheels:         IForgeWheels | null
  // ── Dirty Flag ───────────────────────────────────────────────
  readonly dirty:          boolean
}
```

---

## 3. PILAR 2 — PERSISTENCIA TOTAL (aetherCells)

### 3.1 Nueva propiedad raíz: `aetherCells`

El JSON del fixture tendrá una nueva propiedad raíz que contiene el snapshot crudo de `forgeState.cells` con su layout visual.

### 3.2 Contrato de tipo

```ts
// types/FixtureDefinition.ts — NUEVO tipo
export interface IAetherCellSnapshot {
  readonly cellId:          string
  readonly family:          string       // NodeFamily serializado como string
  readonly label:           string
  readonly role:            string       // NodeRole serializado como string
  readonly channelIndices:  readonly number[]
  readonly aetherZone?:     string
  readonly uiPosition?:     { readonly x: number; readonly y: number }
}

// Extensión de FixtureDefinition
export interface FixtureDefinition {
  // ... campos existentes ...
  dmxGovernors?: IDMXGovernor[]
  aetherCells?:  IAetherCellSnapshot[]   // ← NUEVO
}
```

### 3.3 Serialización en `buildCompleteFixture`

```ts
// buildCompleteFixture — fragmento de aetherCells
const cellSnapshots: IAetherCellSnapshot[] = forgeState.cells.map(cell => ({
  cellId:         cell.cellId,
  family:         String(cell.family),
  label:          cell.label,
  role:           cell.role,
  channelIndices: [...cell.channelIndices],
  ...(cell.aetherZone !== undefined && { aetherZone: cell.aetherZone }),
  ...(cell.uiPosition !== undefined && { uiPosition: { ...cell.uiPosition } }),
}))

const builtFixture = {
  // ...
  aetherCells: cellSnapshots.length > 0 ? cellSnapshots : undefined,
  // ...
}
```

### 3.4 Deserialización en `HYDRATE_FROM_FIXTURE`

**Antes:** `hydrateCells()` reconstruía las células desde `nodeGraph.nodes[output_dmx]`.  
**Después:** Lee `aetherCells` del fixture JSON si existe. Fallback a la reconstrucción legacy solo si `aetherCells` está ausente.

```ts
case 'HYDRATE_FROM_FIXTURE': {
  const { fixture } = action
  return {
    meta: {
      manufacturer: fixture.manufacturer ?? '',
      name:         fixture.name ?? '',
      type:         fixture.type ?? 'generic',
      mode:         (fixture as any).mode,
      channelCount: fixture.channels.length,
    },
    channels:     hydrateChannels(fixture),
    // 🏛️ RUTA A: aetherCells del JSON (persistencia total)
    // 🏛️ RUTA B: reconstrucción legacy desde nodeGraph (migración)
    cells:        hydrateAetherCells(fixture),
    dmxGovernors: fixture.dmxGovernors ?? [],
    capabilities: (fixture.capabilities as Record<string, unknown>) ?? {},
    physics:      hydratePhysics(fixture),
    wheels:       hydrateWheels(fixture),
    dirty:        false,
  }
}
```

```ts
function hydrateAetherCells(fixture: FixtureDefinition): readonly IForgeCellBuilder[] {
  // RUTA A: aetherCells guardadas en el JSON — restauración exacta
  const saved = (fixture as any).aetherCells as IAetherCellSnapshot[] | undefined
  if (saved && Array.isArray(saved) && saved.length > 0) {
    return saved.map((snap, i) => ({
      cellId:         snap.cellId,
      family:         parseNodeFamily(snap.family),
      label:          snap.label,
      role:           snap.role as NodeRole,
      channelIndices: [...snap.channelIndices],
      aetherZone:     snap.aetherZone,
      uiPosition:     snap.uiPosition ?? { x: 0, y: i * 140 },
    }))
  }

  // RUTA B: fallback legacy — reconstruir desde nodeGraph
  return hydrateCells(fixture)
}

function parseNodeFamily(raw: string): NodeFamily {
  const upper = raw.toUpperCase()
  if (upper in NodeFamily) return NodeFamily[upper as keyof typeof NodeFamily]
  return NodeFamily.ATMOSPHERE
}
```

---

## 4. PILAR 3 — INYECCIÓN NATIVA DE GOBERNADORES

### 4.1 Estado en el Reducer

Ya cubierto en §2.1 y §2.4. El campo `dmxGovernors` vive en `IForgeBuilderState` y tiene acciones dedicadas.

### 4.2 Reducer Cases

```ts
// forgeBuilderState.ts — nuevos cases

case 'GOVERNOR_SET_ALL':
  return { ...state, dmxGovernors: action.governors, dirty: true }

case 'GOVERNOR_ADD':
  return {
    ...state,
    dmxGovernors: [...state.dmxGovernors, action.governor],
    dirty: true,
  }

case 'GOVERNOR_UPDATE': {
  const idx = state.dmxGovernors.findIndex(g => g.channelIndex === action.channelIndex)
  if (idx === -1) return state
  return {
    ...state,
    dmxGovernors: state.dmxGovernors.map((g, i) => i === idx ? action.governor : g),
    dirty: true,
  }
}

case 'GOVERNOR_REMOVE':
  return {
    ...state,
    dmxGovernors: state.dmxGovernors.filter(g => g.channelIndex !== action.channelIndex),
    dirty: true,
  }
```

### 4.3 Serialización

En `buildCompleteFixture`, el campo se inyecta directamente desde el reducer:

```ts
dmxGovernors: forgeState.dmxGovernors.length > 0
  ? forgeState.dmxGovernors
  : undefined,
```

### 4.4 Hidratación

Ya cubierta en §3.4: `dmxGovernors: fixture.dmxGovernors ?? []`.

---

## 5. PILAR 4 — GUARDADO ANTI-PÁNICO

### 5.1 El problema

Actualmente, `handleSave()` aborta el guardado entero si `compileForgeState()` retorna `ok:false`. El usuario pierde su configuración física (channels, physics, cells, governors) porque el compilador matemático del grafo tiene errores de dependencias.

### 5.2 La solución: Save degradado

**Regla:** El JSON SIEMPRE se guarda. Si el `nodeGraph` no compila, se guarda sin él (o con el último válido). Los datos físicos son sagrados.

### 5.3 Nuevo `handleSave` — Fragmento completo

```tsx
const handleSave = useCallback(async () => {
  if (!isFormValid) return

  // ── FASE 1: Compilar el fixture desde el reducer (fuente única) ──
  const completeFixture = buildCompleteFixture(forgeState)

  // ── FASE 2: Intentar compilar el nodeGraph ────────────────────────
  let nodeGraph: IForgeNodeGraph | undefined
  let compileWarnings: string[] = []

  if (forgeState.cells.length > 0) {
    const compileResult = compileForgeState(forgeState)
    if (compileResult.ok) {
      nodeGraph = compileResult.fixture.nodeGraph
      if (compileResult.warnings.length > 0) {
        compileWarnings = compileResult.warnings.map(w => w.message)
        console.warn('[Forge] Compile warnings:', compileWarnings)
      }
    } else {
      // ⚠️ ANTI-PÁNICO: NO ABORTAMOS. Guardamos sin nodeGraph.
      console.warn('[Forge] nodeGraph compilation failed — saving WITHOUT graph:', compileResult.errors)
      compileWarnings = compileResult.errors.map(e => `[ERROR] ${e.message}`)
      // nodeGraph queda undefined — se guardará con el último válido del snapshot
      nodeGraph = forgeGraphSnapshot ?? undefined
    }
  } else if (forgeGraph) {
    // Sin células pero con grafo del canvas → guardarlo
    nodeGraph = deepClone(forgeGraph)
  }

  // ── FASE 3: Ensamblar JSON final ──────────────────────────────────
  if (nodeGraph) {
    completeFixture.nodeGraph = nodeGraph
  }

  // ── FASE 4: Guardar siempre ────────────────────────────────────────
  const result = await saveUserFixture(completeFixture)

  if (result.success) {
    forgeDispatch({ type: 'MARK_CLEAN' })
    markForgeGraphClean()

    if (compileWarnings.length > 0) {
      setSaveMessage(`Saved with ${compileWarnings.length} warning(s)`)
    } else {
      setSaveMessage('Saved successfully')
    }
    setTimeout(() => setSaveMessage(null), 3000)
  } else {
    setSaveMessage(`Save failed: ${result.error}`)
    setTimeout(() => setSaveMessage(null), 5000)
  }

  onSave(completeFixture, forgeState.physics)
}, [forgeState, isFormValid, onSave, buildCompleteFixture, forgeGraph, saveUserFixture, markForgeGraphClean])
```

### 5.4 Nuevo `buildCompleteFixture` — Función pura desde reducer

La función se simplifica dramáticamente porque el reducer es la fuente única:

```tsx
function buildCompleteFixture(state: IForgeBuilderState): FixtureDefinition {
  const channels = state.channels as FixtureChannel[]

  // Derivar capabilities desde channels (determinista)
  const derived = deriveCapabilities(channels)

  const fixture: FixtureDefinition & { nodeGraph?: unknown; aetherCells?: unknown } = {
    id:           buildFixtureId(state.meta.manufacturer, state.meta.name),
    name:         state.meta.name,
    manufacturer: state.meta.manufacturer,
    type:         state.meta.type,
    channels:     channels.map(ch => resolveChannelDeps(ch, channels)),

    physics:      state.physics ?? undefined,

    wheels:       state.wheels?.colors?.length
                    ? { colors: state.wheels.colors }
                    : undefined,

    capabilities: {
      ...state.capabilities,
      hasPan:           derived.hasPanTilt,
      hasTilt:          derived.hasPanTilt,
      hasColorMixing:   derived.hasColorMixing,
      hasColorWheel:    derived.hasColorWheel,
      hasGobo:          derived.hasGobos,
      hasPrism:         derived.hasPrism,
      hasStrobe:        derived.hasShutter,
      hasDimmer:        derived.hasDimmer,
      hasRotation:      derived.hasRotation,
      hasCustomChannels: derived.hasCustomChannels,
      hasMacro:         derived.hasMacro,
    },

    // 🏛️ DMX Governor Engine
    dmxGovernors: state.dmxGovernors.length > 0
      ? [...state.dmxGovernors]
      : undefined,

    // 🧬 Aether Cells — snapshot crudo para rehidratación exacta
    aetherCells: state.cells.length > 0
      ? state.cells.map(cell => ({
          cellId:         cell.cellId,
          family:         String(cell.family),
          label:          cell.label,
          role:           cell.role,
          channelIndices: [...cell.channelIndices],
          ...(cell.aetherZone && { aetherZone: cell.aetherZone }),
          ...(cell.uiPosition && { uiPosition: { ...cell.uiPosition } }),
        }))
      : undefined,
  }

  return fixture as FixtureDefinition
}
```

---

## 6. CONTRATOS DE TIPADO NUEVOS

### 6.1 `IForgePhysics` (nuevo, extraído)

```ts
// forgeBuilderState.ts
export interface IForgePhysics {
  readonly motorType:        string
  readonly maxAcceleration:  number
  readonly maxVelocity:      number
  readonly safetyCap:        boolean
  readonly orientation:      string
  readonly invertPan:        boolean
  readonly invertTilt:       boolean
  readonly swapPanTilt:      boolean
  readonly homePosition:     { readonly pan: number; readonly tilt: number }
  readonly tiltLimits:       { readonly min: number; readonly max: number }
}
```

### 6.2 `IForgeWheels` (nuevo, extraído)

```ts
// forgeBuilderState.ts
export interface IForgeWheels {
  readonly colors:           readonly WheelColor[]
  readonly colorEngine:      string
  readonly minChangeTimeMs:  number
}
```

### 6.3 `IAetherCellSnapshot` (nuevo, serializable)

```ts
// types/FixtureDefinition.ts
export interface IAetherCellSnapshot {
  readonly cellId:          string
  readonly family:          string
  readonly label:           string
  readonly role:            string
  readonly channelIndices:  readonly number[]
  readonly aetherZone?:     string
  readonly uiPosition?:    { readonly x: number; readonly y: number }
}
```

### 6.4 Extensión de `FixtureDefinition`

```ts
// types/FixtureDefinition.ts — campos nuevos en FixtureDefinition
export interface FixtureDefinition {
  // ... campos existentes sin cambios ...
  dmxGovernors?: IDMXGovernor[]              // ← ya existe
  aetherCells?:  IAetherCellSnapshot[]       // ← NUEVO
}
```

### 6.5 `makeInitialForgeState` actualizado

```ts
export function makeInitialForgeState(): IForgeBuilderState {
  return {
    meta: {
      manufacturer: '',
      name:         '',
      type:         'generic',
      channelCount: 8,
    },
    channels:      [],
    cells:         [],
    dmxGovernors:  [],
    capabilities:  {},
    physics:       null,
    wheels:        null,
    dirty:         false,
  }
}
```

---

## 7. FRAGMENTOS DE IMPLEMENTACIÓN

### 7.1 Eliminación del useEffect de sync (WAVE 4742/4830)

**Eliminar completamente** el bloque en `FixtureForgeEmbedded.tsx` (líneas ~810-860):

```tsx
// ═══════════════════════════════════════════════════════════════════════════
// ❌ ELIMINAR — WAVE 4742: SYNC fixture.channels → forgeState.channels
// Ya no hay dual-master. forgeState ES la fuente única.
// ═══════════════════════════════════════════════════════════════════════════
```

### 7.2 `loadFixtureIntoEditor` simplificado

```tsx
const loadFixtureIntoEditor = useCallback((def: FixtureDefinition) => {
  // Guardar snapshot para referencia (non-reactive)
  fixtureSnapshot.current = def

  // El reducer absorbe TODO el estado — single dispatch
  forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE', fixture: def })

  // Hidratar el grafo visual del canvas
  hydrateForgeGraph(def)

  // Tracking de origen
  setEditingSource(def.source ?? 'new')
  setOriginalFixtureId(def.id ?? null)
}, [hydrateForgeGraph])
```

### 7.3 `HYDRATE_FROM_FIXTURE` completo con physics + wheels + governors

```ts
case 'HYDRATE_FROM_FIXTURE': {
  const { fixture } = action
  return {
    meta: {
      manufacturer: fixture.manufacturer ?? '',
      name:         fixture.name ?? '',
      type:         fixture.type ?? 'generic',
      mode:         (fixture as any).mode,
      channelCount: fixture.channels.length,
    },
    channels:      hydrateChannels(fixture),
    cells:         hydrateAetherCells(fixture),
    dmxGovernors:  fixture.dmxGovernors ?? [],
    capabilities:  (fixture.capabilities as Record<string, unknown>) ?? {},
    physics:       fixture.physics ? {
      motorType:       fixture.physics.motorType ?? 'stepper-quality',
      maxAcceleration: fixture.physics.maxAcceleration ?? 2000,
      maxVelocity:     fixture.physics.maxVelocity ?? 500,
      safetyCap:       Boolean(fixture.physics.safetyCap ?? true),
      orientation:     fixture.physics.orientation ?? 'floor',
      invertPan:       fixture.physics.invertPan ?? false,
      invertTilt:      fixture.physics.invertTilt ?? false,
      swapPanTilt:     fixture.physics.swapPanTilt ?? false,
      homePosition:    fixture.physics.homePosition ?? { pan: 127, tilt: 127 },
      tiltLimits:      fixture.physics.tiltLimits ?? { min: 0, max: 270 },
    } : null,
    wheels:        hydrateWheels(fixture),
    dirty:         false,
  }
}
```

```ts
function hydrateWheels(fixture: FixtureDefinition): IForgeWheels | null {
  const wheelColors = fixture.wheels?.colors
    ?? fixture.capabilities?.colorWheel?.colors
    ?? []

  if (wheelColors.length === 0) return null

  return {
    colors:          wheelColors,
    colorEngine:     fixture.capabilities?.colorEngine ?? 'rgb',
    minChangeTimeMs: fixture.capabilities?.colorWheel?.minChangeTimeMs ?? 500,
  }
}
```

### 7.4 Validation en Channel Rack redirigida

```tsx
// Antes: useEffect sobre fixture.channels
// Después: useEffect sobre forgeState (fuente única)

useEffect(() => {
  const hasName = !!forgeState.meta.name?.trim()
  const hasChannels = forgeState.channels.some(ch => ch.type !== 'unknown')

  if (!hasName) {
    setValidationMessage('Model name required')
    setIsFormValid(false)
  } else if (!hasChannels) {
    setValidationMessage('At least one channel function required')
    setIsFormValid(false)
  } else {
    setValidationMessage('Ready to save')
    setIsFormValid(true)
  }
}, [forgeState.meta.name, forgeState.channels])
```

### 7.5 Channel Management redirigido

```tsx
// Antes: setFixture(prev => ...) + setTotalChannels(...)
// Después: forgeDispatch directamente

const handleTotalChannelsChange = useCallback((count: number) => {
  forgeDispatch({ type: 'META_SET_CHANNEL_COUNT', channelCount: count })
}, [forgeDispatch])

// No más useEffect para generar empty channels — el reducer lo hace en META_SET_CHANNEL_COUNT
```

### 7.6 Variables de estado eliminadas en FixtureForgeEmbedded

```tsx
// ❌ ELIMINAR — absorbidas por forgeState
// const [fixture, setFixture] = useState(...)       → forgeState.channels/meta/capabilities
// const [physics, setPhysics] = useState(...)        → forgeState.physics
// const [totalChannels, setTotalChannels] = useState(...) → forgeState.meta.channelCount
// const [colorEngine, setColorEngine] = useState(...)     → forgeState.wheels?.colorEngine
// const [wheelColors, setWheelColors] = useState(...)     → forgeState.wheels?.colors
// const [wheelMinChangeTimeMs, setWheelMinChangeTimeMs] = useState(...) → forgeState.wheels?.minChangeTimeMs

// ✅ MANTENER — no pertenecen al modelo de datos
// const [activeTab, setActiveTab] = useState(...)
// const [forgeEditMode, setForgeEditMode] = useState(...)
// const [showPreview, setShowPreview] = useState(...)
// const [previewPan, setPreviewPan] = useState(...)
// const [editingSource, setEditingSource] = useState(...)
// const [originalFixtureId, setOriginalFixtureId] = useState(...)
// const [saveMessage, setSaveMessage] = useState(...)
// const [validationMessage, setValidationMessage] = useState(...)
// const [isFormValid, setIsFormValid] = useState(...)
```

---

## 8. DIAGRAMA DE FLUJO POST-REFACTOR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FIXTURE FORGE EMBEDDED (post-refactor)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              useReducer(forgeReducer) — FUENTE ÚNICA                   │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ IForgeBuilderState                                               │ │ │
│  │  │  ├── meta:          { manufacturer, name, type, channelCount }   │ │ │
│  │  │  ├── channels:      FixtureChannel[]     ← Channel Rack          │ │ │
│  │  │  ├── cells:         IForgeCellBuilder[]   ← Aether Modules       │ │ │
│  │  │  ├── dmxGovernors:  IDMXGovernor[]        ← Hardware Rules       │ │ │
│  │  │  ├── capabilities:  Record<string, unknown>                      │ │ │
│  │  │  ├── physics:       IForgePhysics | null                         │ │ │
│  │  │  ├── wheels:        IForgeWheels | null                          │ │ │
│  │  │  └── dirty:         boolean                                      │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ACCIONES:                                                             │ │
│  │    CHANNEL_*    → muta channels[]                                      │ │
│  │    CELL_*       → muta cells[] (atómica con channels[])                │ │
│  │    GOVERNOR_*   → muta dmxGovernors[]                                  │ │
│  │    PHYSICS_SET  → muta physics                                         │ │
│  │    WHEELS_*     → muta wheels                                          │ │
│  │    HYDRATE      → carga todo desde FixtureDefinition                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│         │                                                                   │
│         │ (derivación directa — sin useEffect)                              │
│         ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Channel Rack UI   │  Aether Cells UI   │  Governor Panel UI          │ │
│  │  lee channels[]    │  lee cells[]        │  lee dmxGovernors[]         │ │
│  │  dispatch CHANNEL_*│  dispatch CELL_*    │  dispatch GOVERNOR_*        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│         ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              buildCompleteFixture(forgeState)                          │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  1. channels = resolveChannelDeps(forgeState.channels)           │ │ │
│  │  │  2. capabilities = deriveCapabilities(channels) ∪ state.caps    │ │ │
│  │  │  3. aetherCells = serialize(forgeState.cells)                    │ │ │
│  │  │  4. dmxGovernors = forgeState.dmxGovernors                       │ │ │
│  │  │  5. physics = forgeState.physics                                 │ │ │
│  │  │  6. wheels = forgeState.wheels                                   │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│         ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              handleSave() — ANTI-PÁNICO                                │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  1. completeFixture = buildCompleteFixture(forgeState)           │ │ │
│  │  │  2. TRY compileForgeState(forgeState)                            │ │ │
│  │  │       OK  → attach nodeGraph                                     │ │ │
│  │  │       FAIL → console.warn + attach last-valid snapshot           │ │ │
│  │  │  3. SIEMPRE: saveUserFixture(completeFixture) → IPC → disk       │ │ │
│  │  │  4. Status badge: "Saved" / "Saved with N warning(s)"           │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JSON RESULTANTE (disco)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    "id": "user-hybrid-...",                                                 │
│    "name": "...",                                                           │
│    "manufacturer": "...",                                                   │
│    "type": "moving-head",                                                   │
│    "channels": [ ... ],          ← Source of truth para DMX runtime         │
│    "physics": { ... },                                                      │
│    "wheels": { "colors": [...] },                                           │
│    "capabilities": { ... },      ← Derivadas + manuales (merged)            │
│    "nodeGraph": { ... },         ← Compilado (puede faltar si error)        │
│    "aetherCells": [              ← NUEVO: snapshot crudo de las células     │
│      {                                                                      │
│        "cellId": "color-1",                                                 │
│        "family": "COLOR",                                                   │
│        "label": "Color Wash",                                               │
│        "role": "primary",                                                   │
│        "channelIndices": [3, 4, 5],                                         │
│        "aetherZone": "ambient",                                             │
│        "uiPosition": { "x": 100, "y": 200 }                                │
│      }                                                                      │
│    ],                                                                       │
│    "dmxGovernors": [             ← Gobernadores de última milla             │
│      {                                                                      │
│        "channelIndex": 2,                                                   │
│        "rules": [                                                           │
│          { "when": { "intentType": "intensity", "min": 0.01 },              │
│            "then": { "clampMin": 64 } }                                     │
│        ]                                                                    │
│      }                                                                      │
│    ]                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. ORDEN DE EJECUCIÓN

### Fase 1 — Tipos y Reducer (sin romper UI)

| # | Archivo | Cambio |
|---|---------|--------|
| 1.1 | `types/FixtureDefinition.ts` | Añadir `IAetherCellSnapshot`, añadir `aetherCells?` a `FixtureDefinition` |
| 1.2 | `core/forge/forgeBuilderState.ts` | Añadir `IForgePhysics`, `IForgeWheels`. Expandir `IForgeBuilderState` con `dmxGovernors`, `physics`, `wheels`. Añadir `GovernorAction`, `CapabilityAction`, `PhysicsAction`, `WheelsAction` al union `ForgeAction`. Implementar cases. Actualizar `makeInitialForgeState`. Crear `hydrateAetherCells`, `hydratePhysics`, `hydrateWheels`. Actualizar `HYDRATE_FROM_FIXTURE` |
| 1.3 | `core/forge/compileForgeState.ts` | Sin cambios necesarios (ya funciona desde `IForgeBuilderState`) |

### Fase 2 — Refactor de FixtureForgeEmbedded

| # | Archivo | Cambio |
|---|---------|--------|
| 2.1 | `FixtureForgeEmbedded.tsx` | Eliminar `useState<FixtureDefinition>`, `useState<PhysicsProfile>`, `useState<WheelColor[]>`, `useState<ColorEngineType>`, `useState<number>(wheelMinChangeTimeMs)`, `useState<number>(totalChannels)`. Reemplazar con lecturas de `forgeState.*` |
| 2.2 | `FixtureForgeEmbedded.tsx` | Eliminar el `useEffect` de sync (WAVE 4742, líneas 810-860) |
| 2.3 | `FixtureForgeEmbedded.tsx` | Simplificar `loadFixtureIntoEditor` — un solo `forgeDispatch({ type: 'HYDRATE_FROM_FIXTURE' })` |
| 2.4 | `FixtureForgeEmbedded.tsx` | Reescribir `buildCompleteFixture` como función pura de `IForgeBuilderState` |
| 2.5 | `FixtureForgeEmbedded.tsx` | Reescribir `handleSave` con lógica anti-pánico |
| 2.6 | `FixtureForgeEmbedded.tsx` | Redirigir validation `useEffect` a `forgeState.meta` + `forgeState.channels` |
| 2.7 | `FixtureForgeEmbedded.tsx` | Redirigir todos los handlers de Channel Rack a `forgeDispatch` |

### Fase 3 — Verificación y Cleanup

| # | Archivo | Cambio |
|---|---------|--------|
| 3.1 | Todos los hijos de ForgeView | Verificar que no lean de `fixture` directamente — redirigir a props derivadas de `forgeState` |
| 3.2 | `tsc --noEmit` | Verificar 0 errores nuevos |
| 3.3 | Test manual | Crear fixture → asignar canales → crear células → guardar → recargar → verificar aetherCells + dmxGovernors en JSON |

---

### NOTAS PARA INFANTERÍA

1. **No tocar `forgeGraphStore` (Zustand).** Sigue siendo el store del canvas XYFlow — es visual-only. No es fuente de verdad para datos.
2. **No tocar `compileForgeState`.** Sigue siendo la función pura que genera `nodeGraph` desde `IForgeBuilderState`. Su contrato no cambia.
3. **No tocar `IPCHandlers.ts`.** El backend ya escribe `JSON.stringify(payload)` — acepta cualquier campo nuevo sin modificación.
4. **El `syncGraphOutputsWithChannels` puede eliminarse** en Fase 3 una vez verificado que `buildCompleteFixture` ya no depende de él (el nodeGraph se genera desde `compileForgeState`, no desde el canvas).

---

*Blueprint completado. WAVE: FORGE CONVERGENCE ARCHITECTURE.*
