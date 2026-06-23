# Blueprint: Contrato de Datos Maestro de la Trinidad

**Versión:** 1.0 — WAVE FORGE CONVERGENCE  
**Baseline:** `forge_trinidad_pipeline_audit.md`  
**Scope:** `FixtureDefinition.ts`, `compileForgeState.ts`, `forgeBuilderState.ts`  
**Restricción:** Cero JSX, cero CSS. Solo lógica de estado y transformación de objetos puros.

---

## Dogmas de Arquitectura (Inmutables)

| # | Dogma | Impacto |
|---|-------|---------|
| 1 | `aetherCells` se persiste como `IAetherCellSnapshot[]` en la raíz del JSON | Rehidratación visual 1:1 sin heurística |
| 2 | `dmxGovernors` vive en la raíz de `FixtureDefinition`. Auto-purga en `CHANNEL_CLEAR` | Coherencia canal↔gobernador garantizada |
| 3 | `SYNC_CELLS_TO_RACK` se despacha automáticamente tras `CELL_ATTACH_CHANNEL` | El rack crece dinámicamente |
| 4 | `capabilities` es estrictamente derivado por `deriveCapabilitiesUnified()` al exportar | Cero mutación manual de capabilities |

---

## 1. `src/types/FixtureDefinition.ts` — Interfaz Definitiva

### 1.1 Shape de `FixtureDefinition` (raíz del JSON)

```typescript
export interface FixtureDefinition {
  // ── Identidad ─────────────────────────────────────────────────────────
  id: string
  name: string
  manufacturer: string
  type: FixtureType

  // ── Canales físicos ───────────────────────────────────────────────────
  channels: FixtureChannel[]

  // ── Rueda de color (THE WHEELSMITH) ───────────────────────────────────
  // CAMBIO: absorbe colorEngine y minChangeTimeMs que antes vivían dispersos
  // en capabilities.colorEngine y capabilities.colorWheel.minChangeTimeMs.
  // Un solo objeto = una sola fuente de verdad para la rueda.
  wheels?: {
    colors: WheelColor[]
    colorEngine: ColorEngineType        // ← NUEVO aquí (antes en capabilities)
    minChangeTimeMs?: number            // ← NUEVO aquí (antes en capabilities.colorWheel)
    allowsContinuousSpin?: boolean
    spinStartDmx?: number
  }

  // ── Física del motor ──────────────────────────────────────────────────
  // Sin cambios estructurales respecto a la versión actual.
  physics?: {
    motorType: 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro'
    maxAcceleration: number
    maxVelocity?: number
    safetyCap: number | boolean
    orientation?: InstallationOrientation
    invertPan?: boolean
    invertTilt?: boolean
    swapPanTilt?: boolean
    homePosition?: { pan: number; tilt: number }
    tiltLimits?: { min: number; max: number }
  }

  // ── Gobernadores DMX (última milla) ───────────────────────────────────
  // Ya existe en el tipo actual. Lo documentamos explícitamente como
  // propiedad de primer nivel con auto-purga garantizada por el reducer.
  dmxGovernors?: IDMXGovernor[]

  // ── Snapshot de células Aether ────────────────────────────────────────
  // NUEVO: persiste el layout visual de las células para rehidratación
  // exacta del editor sin depender de heurísticas desde nodeGraph.
  aetherCells?: IAetherCellSnapshot[]

  // ── Capabilities (DERIVADO — nunca se edita manualmente) ──────────────
  // Este bloque se genera al exportar vía deriveCapabilitiesUnified().
  // En JSON se guarda para consumo por el runtime (hidratación rápida).
  // DOGMA 4: capabilities es output, no input.
  capabilities?: {
    hasPan?: boolean
    hasTilt?: boolean
    hasColorMixing?: boolean
    hasColorWheel?: boolean
    hasGobo?: boolean
    hasPrism?: boolean
    hasStrobe?: boolean
    hasDimmer?: boolean
    hasRotation?: boolean
    hasCustomChannels?: boolean
    hasMacro?: boolean
    // ELIMINADOS de aquí (migran a wheels):
    //   colorEngine  → wheels.colorEngine
    //   colorWheel   → wheels (el propio objeto)
    //   dimmerMin, strobePersonality → se mantienen si existen
    dimmerMin?: number
    strobePersonality?: {
      strobeOpenValue: number
      strobeRangeMin: number
      strobeRangeMax: number
    }
  }
}
```

### 1.2 `IAetherCellSnapshot` (promovido a `FixtureDefinition.ts`)

```typescript
/**
 * Snapshot crudo de una célula Aether tal como se persiste en el JSON
 * bajo la clave raíz `aetherCells`.
 *
 * Permite rehidratación exacta del editor visual — incluida la posición
 * en el lienzo (uiPosition) — sin heurística.
 *
 * INVARIANTE: family se serializa como string (e.g. 'COLOR', 'IMPACT')
 * y se parsea con parseNodeFamily() al rehidratar.
 */
export interface IAetherCellSnapshot {
  readonly cellId:         string
  readonly family:         string      // NodeFamily serializado
  readonly label:          string
  readonly role:           string      // NodeRole serializado
  readonly channelIndices: readonly number[]
  readonly aetherZone?:    string
  readonly uiPosition?:    { readonly x: number; readonly y: number }
}
```

> **Nota de migración:** `IAetherCellSnapshot` ya existe en `forgeBuilderState.ts`.
> Se mueve a `FixtureDefinition.ts` y se re-exporta desde `forgeBuilderState.ts`
> para no romper imports existentes.

### 1.3 `FixtureDefinitionV2` (sin cambios)

```typescript
// core/forge/types.ts — ya extiende FixtureDefinition con nodeGraph
export interface FixtureDefinitionV2 extends FixtureDefinition {
  nodeGraph?: IForgeNodeGraph
}
```

El `nodeGraph` sigue siendo opcional. Si `aetherCells` existe, las células se
rehidratan desde ahí (Route A). Si solo existe `nodeGraph`, se reconstruyen por
heurística (Route B legacy). `nodeGraph` sigue siendo la fuente de verdad para
el runtime Aether.

### 1.4 Compatibilidad de hidratación (resumen de rutas)

| JSON contiene | Ruta | Cells | Layout visual |
|---------------|------|-------|---------------|
| `aetherCells` + `nodeGraph` | A | Desde `aetherCells` (1:1) | Exacto |
| Solo `nodeGraph` | B (legacy) | Reconstrucción heurística | Aproximado |
| Ni uno ni otro | Vacío | `[]` | N/A |

### 1.5 Migración de `wheels`

El campo `wheels` absorbe datos que antes estaban dispersos:

| Dato | Ubicación ANTES | Ubicación DESPUÉS |
|------|-----------------|-------------------|
| `colors` | `fixture.wheels.colors` | `fixture.wheels.colors` (sin cambio) |
| `colorEngine` | `fixture.capabilities.colorEngine` | `fixture.wheels.colorEngine` |
| `minChangeTimeMs` | `fixture.capabilities.colorWheel.minChangeTimeMs` | `fixture.wheels.minChangeTimeMs` |
| `allowsContinuousSpin` | `fixture.capabilities.colorWheel.allowsContinuousSpin` | `fixture.wheels.allowsContinuousSpin` |

La hidratación (`hydrateWheels`) debe leer ambas ubicaciones para
retrocompatibilidad con JSONs pre-blueprint.

---

## 2. `src/core/forge/compileForgeState.ts` — `buildCompleteFixture`

### 2.1 Nueva firma pública

```typescript
/**
 * Función pura. Transforma IForgeBuilderState → FixtureDefinition lista para disco.
 *
 * GARANTÍAS:
 *   - Nunca lanza. Si compileToNodeGraph falla, retorna fixture sin nodeGraph
 *     (el bloque anti-pánico loguea y degrada).
 *   - capabilities se genera vía deriveCapabilitiesUnified() — DOGMA 4.
 *   - aetherCells snapshot siempre se incluye si cells.length > 0 — DOGMA 1.
 *   - dmxGovernors se copia directamente del state — DOGMA 2.
 *
 * NOTA: Esta función REEMPLAZA el useCallback buildCompleteFixture actual
 * de FixtureForgeEmbedded.tsx. El componente pasará a llamar esta función pura.
 */
export function buildCompleteFixture(state: IForgeBuilderState): FixtureDefinition
```

### 2.2 Pseudocódigo del cuerpo

```typescript
export function buildCompleteFixture(state: IForgeBuilderState): FixtureDefinition {
  // ── 1. Resolver IgnitionDeps ─────────────────────────────────────────
  const resolvedChannels: FixtureChannel[] = state.channels
    .filter(ch => ch.type !== 'unknown')
    .map(ch => resolveChannelDeps(ch, state.channels))

  // ── 2. Compilar NodeGraph (con anti-pánico) ──────────────────────────
  let nodeGraph: IForgeNodeGraph | undefined
  let compileWarnings: readonly ForgeValidationIssue[] = []

  if (state.cells.length > 0) {
    try {
      const result = compileForgeState(state)
      // compileForgeState valida + genera nodeGraph
      if (result.ok) {
        nodeGraph = result.fixture.nodeGraph
        compileWarnings = result.warnings
      } else {
        // Errores bloqueantes → loguear pero NO abortar.
        // El JSON se guarda sin nodeGraph (degradación segura).
        console.error('[buildCompleteFixture] Compile errors (degraded):', result.errors)
      }
    } catch (err) {
      // PANIC: el compilador lanzó una excepción no prevista.
      // Guardar el fixture SIN nodeGraph para no perder datos del usuario.
      console.error('[buildCompleteFixture] PANIC — compileForgeState threw:', err)
    }
  }

  if (compileWarnings.length > 0) {
    console.warn('[buildCompleteFixture] Compile warnings:', compileWarnings)
  }

  // ── 3. Snapshot de células Aether (DOGMA 1) ──────────────────────────
  const aetherCells: IAetherCellSnapshot[] | undefined =
    state.cells.length > 0
      ? state.cells.map(cell => ({
          cellId:         cell.cellId,
          family:         String(cell.family),
          label:          cell.label,
          role:           cell.role as string,
          channelIndices: [...cell.channelIndices],
          ...(cell.aetherZone  !== undefined && { aetherZone: cell.aetherZone }),
          ...(cell.uiPosition  !== undefined && { uiPosition: { ...cell.uiPosition } }),
        }))
      : undefined

  // ── 4. Construir wheels unificado ────────────────────────────────────
  const stateWheels = state.wheels
  const wheelColors = stateWheels?.colors ?? []
  const wheels = wheelColors.length > 0
    ? {
        colors:               wheelColors as WheelColor[],
        colorEngine:          stateWheels?.colorEngine ?? 'rgb' as ColorEngineType,
        minChangeTimeMs:      stateWheels?.minChangeTimeMs,
        allowsContinuousSpin: false,
      }
    : undefined

  // ── 5. Construir physics ─────────────────────────────────────────────
  const statePhysics = state.physics
  const physics = statePhysics
    ? {
        motorType:       statePhysics.motorType as any,
        maxAcceleration: statePhysics.maxAcceleration,
        maxVelocity:     statePhysics.maxVelocity,
        safetyCap:       statePhysics.safetyCap,
        orientation:     statePhysics.orientation as any,
        invertPan:       false,
        invertTilt:      false,
        swapPanTilt:     statePhysics.swapPanTilt,
        homePosition:    { ...statePhysics.homePosition },
        tiltLimits:      { ...statePhysics.tiltLimits },
      }
    : undefined

  // ── 6. Derivar capabilities (DOGMA 4) ────────────────────────────────
  const derived = deriveCapabilities(resolvedChannels)
  const capabilities = {
    hasPan:             derived.hasPanTilt,
    hasTilt:            derived.hasPanTilt,
    hasColorMixing:     derived.hasColorMixing,
    hasColorWheel:      derived.hasColorWheel,
    hasGobo:            derived.hasGobos,
    hasPrism:           derived.hasPrism,
    hasStrobe:          derived.hasShutter,
    hasDimmer:          derived.hasDimmer,
    hasRotation:        derived.hasRotation,
    hasCustomChannels:  derived.hasCustomChannels,
    hasMacro:           derived.hasMacro,
  }

  // ── 7. dmxGovernors directo desde state (DOGMA 2) ────────────────────
  const dmxGovernors = state.dmxGovernors.length > 0
    ? [...state.dmxGovernors]
    : undefined

  // ── 8. Ensamblaje final ──────────────────────────────────────────────
  const fixture: FixtureDefinition & { nodeGraph?: IForgeNodeGraph } = {
    id:           buildFixtureId(state.meta.manufacturer, state.meta.name),
    name:         state.meta.name,
    manufacturer: state.meta.manufacturer,
    type:         state.meta.type,
    channels:     resolvedChannels,
    ...(wheels         !== undefined && { wheels }),
    ...(physics        !== undefined && { physics }),
    ...(dmxGovernors   !== undefined && { dmxGovernors }),
    ...(aetherCells    !== undefined && { aetherCells }),
    capabilities,
  }

  if (nodeGraph) {
    fixture.nodeGraph = nodeGraph
  }

  return fixture
}
```

### 2.3 Cambios respecto al `buildCompleteFixture` actual

| Aspecto | ANTES (FixtureForgeEmbedded.tsx) | DESPUÉS (compileForgeState.ts) |
|---------|----------------------------------|-------------------------------|
| Ubicación | Closure `useCallback` con deps `[forgeState, forgeGraph]` | Función pura exportada, sin hooks |
| `aetherCells` | No se incluía | Se incluye como snapshot (DOGMA 1) |
| `dmxGovernors` | No se incluía | Se incluye directamente (DOGMA 2) |
| `capabilities` | Spread de `baseFixture.capabilities` + override manual | Derivado puro vía `deriveCapabilities` (DOGMA 4) |
| `wheels.colorEngine` | En `capabilities.colorEngine` | En `wheels.colorEngine` |
| `wheels.minChangeTimeMs` | En `capabilities.colorWheel.minChangeTimeMs` | En `wheels.minChangeTimeMs` |
| `forgeGraph` (live canvas) | Se mezclaba con compiled graph | Eliminado. Solo el compiled nodeGraph se persiste |
| `baseFixture` spread | `...baseFixture` propagaba campos fantasma | Eliminado. Solo campos explícitos |
| Anti-pánico | `try/catch` solo para `compileForgeState` | `try/catch` envolviendo todo el paso 2, con degradación segura |

### 2.4 Impacto en `FixtureForgeEmbedded.tsx`

El componente reemplazará su closure `buildCompleteFixture` por una llamada a la
función pura importada:

```typescript
// En FixtureForgeEmbedded.tsx
import { buildCompleteFixture } from '../../../core/forge/compileForgeState'

// En handleSave:
const completeFixture = deepClone(buildCompleteFixture(forgeState))
```

El `forgeGraph` del canvas visual (store de ReactFlow) ya **no participará** en el
JSON de guardado. El `nodeGraph` que se persiste es siempre el compilado desde
las células. El grafo visual del canvas se reconcilia en el otro sentido: al
cargar un fixture, el canvas rehidrata desde `nodeGraph`.

### 2.5 `compileForgeState` existente — sin cambios de firma

`compileForgeState()` sigue existiendo como función interna para validación +
compilación a `FixtureDefinitionV2`. `buildCompleteFixture()` la consume.

---

## 3. `src/core/forge/forgeBuilderState.ts` — Actualizaciones del Reducer

### 3.1 Nueva acción: `GOVERNOR_SET_FOR_CHANNEL`

Upsert atómico: si ya existe un gobernador para ese `channelIndex`, lo reemplaza;
si no existe, lo crea.

```typescript
// Añadir al tipo GovernorAction:
export type GovernorAction =
  | { type: 'GOVERNOR_SET_ALL'; governors: readonly IDMXGovernor[] }
  | { type: 'GOVERNOR_ADD';     governor: IDMXGovernor }
  | { type: 'GOVERNOR_UPDATE';  channelIndex: number; governor: IDMXGovernor }
  | { type: 'GOVERNOR_REMOVE';  channelIndex: number }
  | { type: 'GOVERNOR_SET_FOR_CHANNEL'; channelIndex: number; governor: IDMXGovernor }  // ← NUEVO
```

Implementación en el reducer:

```typescript
case 'GOVERNOR_SET_FOR_CHANNEL': {
  const { channelIndex, governor } = action
  const existing = state.dmxGovernors.findIndex(g => g.channelIndex === channelIndex)
  const nextGovs = existing === -1
    ? [...state.dmxGovernors, governor]
    : state.dmxGovernors.map((g, i) => i === existing ? governor : g)
  return { ...state, dmxGovernors: nextGovs, dirty: true }
}
```

### 3.2 Auto-purga de gobernadores en `CHANNEL_CLEAR`

Cuando un canal se limpia (reset a `unknown`), cualquier gobernador que apunte a
ese `channelIndex` debe morir con él. Esto mantiene el invariante de DOGMA 2.

```typescript
// Reemplazar el case 'CHANNEL_CLEAR' actual:
case 'CHANNEL_CLEAR': {
  const cleared = patchChannel(state.channels, action.idx, {
    type: 'unknown', name: '', defaultValue: 0, is16bit: false, ignitionDeps: [],
  })
  // DOGMA 2: Auto-purga del gobernador asociado a este offset DMX.
  const prunedGovs = state.dmxGovernors.filter(g => g.channelIndex !== action.idx)
  return {
    ...state,
    channels:     cleared,
    dmxGovernors: prunedGovs,
    dirty:        true,
  }
}
```

### 3.3 Auto-purga en `META_SET_CHANNEL_COUNT` (shrink)

Cuando el usuario reduce el conteo de canales, los gobernadores que apuntan
a índices eliminados deben purgarse. También las células que referencian
índices ahora fuera de rango.

```typescript
case 'META_SET_CHANNEL_COUNT': {
  const count = Math.max(1, action.channelCount)
  // Purgar gobernadores fuera de rango
  const prunedGovs = state.dmxGovernors.filter(g => g.channelIndex < count)
  // Purgar channelIndices fuera de rango en las células
  const prunedCells = state.cells.map(c => {
    const valid = c.channelIndices.filter(i => i < count)
    return valid.length !== c.channelIndices.length ? { ...c, channelIndices: valid } : c
  })
  return {
    ...state,
    meta:         { ...state.meta, channelCount: count },
    channels:     resizeChannels(state.channels, count),
    dmxGovernors: prunedGovs,
    cells:        prunedCells,
    dirty:        true,
  }
}
```

### 3.4 `SYNC_CELLS_TO_RACK` — auto-despacho (DOGMA 3)

La acción ya está implementada en el reducer (`forgeBuilderState.ts:611-625`).
El cambio es que **debe despacharse automáticamente** desde `CELL_ATTACH_CHANNEL`
cuando el canal requerido excede el rango de `state.channels`.

**Opción elegida: inline en `CELL_ATTACH_CHANNEL`** (evita doble-dispatch asíncrono):

```typescript
case 'CELL_ATTACH_CHANNEL': {
  const { cellId, channelIdx } = action

  // ── DOGMA 3: expandir channels si channelIdx excede el rango actual ──
  let channels = state.channels
  let meta     = state.meta
  if (channelIdx >= channels.length) {
    const needed = channelIdx + 1
    channels = resizeChannels(channels, needed)
    meta     = { ...meta, channelCount: needed }
  }

  const targetCell = state.cells.find(c => c.cellId === cellId)
  if (!targetCell) return state
  const channel = channels[channelIdx]
  if (!channel) return state

  // Aduana de tipos — AUTORIDAD FINAL (triple validation §6.3)
  const admission = canAdmit(channel.type, targetCell.family)
  if (admission.ok === false) {
    emitWarning({ cellId, channelIdx, reason: admission.reason })
    return state
  }

  // Invariant (§3): channelIdx pertenece como máximo a UNA célula.
  const cells = state.cells.map(c => {
    if (c.cellId === cellId) {
      if (c.channelIndices.includes(channelIdx)) return c
      return { ...c, channelIndices: [...c.channelIndices, channelIdx] }
    }
    if (c.channelIndices.includes(channelIdx)) {
      return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
    }
    return c
  })
  return { ...state, channels, meta, cells, dirty: true }
}
```

Lo mismo aplica a `CELL_MOVE_CHANNEL`:

```typescript
case 'CELL_MOVE_CHANNEL': {
  const { fromCellId, toCellId, channelIdx } = action

  // DOGMA 3: expandir si channelIdx excede
  let channels = state.channels
  let meta     = state.meta
  if (channelIdx >= channels.length) {
    const needed = channelIdx + 1
    channels = resizeChannels(channels, needed)
    meta     = { ...meta, channelCount: needed }
  }

  const destCell = state.cells.find(c => c.cellId === toCellId)
  if (!destCell) return state
  const channel = channels[channelIdx]
  if (!channel) return state

  const admission = canAdmit(channel.type, destCell.family)
  if (admission.ok === false) {
    emitWarning({ cellId: toCellId, channelIdx, reason: admission.reason })
    return state
  }

  const cells = state.cells.map(c => {
    if (c.cellId === fromCellId) {
      return { ...c, channelIndices: c.channelIndices.filter(i => i !== channelIdx) }
    }
    if (c.cellId === toCellId) {
      if (c.channelIndices.includes(channelIdx)) return c
      return { ...c, channelIndices: [...c.channelIndices, channelIdx] }
    }
    return c
  })
  return { ...state, channels, meta, cells, dirty: true }
}
```

### 3.5 Actualización de `hydrateWheels` (retrocompatibilidad)

```typescript
function hydrateWheels(fixture: FixtureDefinition): IForgeWheels | null {
  // Route A: wheels unificado (post-blueprint)
  const raw = fixture as unknown as Record<string, unknown>
  const wheelsObj = raw.wheels as {
    colors?: WheelColor[]
    colorEngine?: ColorEngineType
    minChangeTimeMs?: number
  } | undefined

  // Route B: legacy (pre-blueprint) — disperso en wheels.colors + capabilities
  const colors =
    wheelsObj?.colors ??
    fixture.capabilities?.colorWheel?.colors ??
    []
  if (colors.length === 0) return null

  return {
    colors,
    colorEngine:
      wheelsObj?.colorEngine ??
      (fixture.capabilities?.colorEngine ?? 'rgb') as ColorEngineType,
    minChangeTimeMs:
      wheelsObj?.minChangeTimeMs ??
      fixture.capabilities?.colorWheel?.minChangeTimeMs ??
      500,
  }
}
```

### 3.6 Resumen de acciones modificadas

| Acción | Cambio |
|--------|--------|
| `GOVERNOR_SET_FOR_CHANNEL` | **Nueva**. Upsert atómico por channelIndex. |
| `CHANNEL_CLEAR` | Añade auto-purga de `dmxGovernors` para `action.idx`. |
| `META_SET_CHANNEL_COUNT` | Añade purga de gobernadores y células fuera de rango al shrink. |
| `CELL_ATTACH_CHANNEL` | Inline de DOGMA 3: expand `channels` si `channelIdx >= channels.length`. |
| `CELL_MOVE_CHANNEL` | Inline de DOGMA 3: idem. |
| `SYNC_CELLS_TO_RACK` | Se mantiene como está pero se vuelve **redundante** tras el inline. Puede quedarse como acción explícita para edge cases. |

---

## 4. Diagrama de Flujo: Save Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  FixtureForgeEmbedded.handleSave()                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Pre-check: compileForgeState(forgeState)           │  │
│  │    → Si errors bloqueantes → abortar + mostrar badge  │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. const fixture = buildCompleteFixture(forgeState)   │  │
│  │    (función pura en compileForgeState.ts)              │  │
│  │                                                       │  │
│  │    ├─ resolvedChannels (ignitionDeps resueltas)       │  │
│  │    ├─ nodeGraph (try/catch → undefined si falla)      │  │
│  │    ├─ aetherCells snapshot (DOGMA 1)                  │  │
│  │    ├─ wheels unificado (colorEngine + minChange)      │  │
│  │    ├─ physics                                         │  │
│  │    ├─ dmxGovernors (DOGMA 2)                          │  │
│  │    └─ capabilities (derivado, DOGMA 4)                │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       ▼                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. deepClone(fixture)                                 │  │
│  │ 4. await saveUserFixture(clonedFixture)               │  │
│  │ 5. reconcileFixturesWithProfile(...)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Diagrama de Flujo: Hydrate Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  forgeReducer → case 'HYDRATE_FROM_FIXTURE'                 │
│                                                              │
│  fixture.aetherCells?                                        │
│    ├─ SÍ → Route A: map snapshots → IForgeCellBuilder[]     │
│    │        (uiPosition preservada, family parseada)         │
│    └─ NO → fixture.nodeGraph?                                │
│              ├─ SÍ → Route B: hydrateCells (heurística)      │
│              └─ NO → cells = []                              │
│                                                              │
│  fixture.wheels?.colorEngine?                                │
│    ├─ SÍ → Route A: leer de wheels (post-blueprint)         │
│    └─ NO → Route B: leer de capabilities (legacy)            │
│                                                              │
│  fixture.dmxGovernors? → copiar directo al state             │
│  fixture.physics?      → hydratePhysics()                    │
│  fixture.capabilities? → copiar como Record<string, unknown> │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Invariantes del Sistema (Post-Blueprint)

1. **Canal↔Gobernador:** `∀ g ∈ state.dmxGovernors: g.channelIndex < state.channels.length ∧ state.channels[g.channelIndex].type ≠ 'unknown'`
2. **Canal↔Célula:** `∀ cell ∈ state.cells, ∀ idx ∈ cell.channelIndices: idx < state.channels.length`
3. **Capacidades = f(canales):** `fixture.capabilities ≡ deriveCapabilitiesUnified(fixture.channels, fixture.wheels, fixture.physics)` al momento del export.
4. **Roundtrip:** `hydrate(buildCompleteFixture(state)).channels ≡ state.channels` (modulo ignitionDeps auto-resueltas).
5. **aetherCells roundtrip:** `hydrate(buildCompleteFixture(state)).cells ≡ state.cells` (modulo parsing de family string→enum).

---

## 7. Archivos Afectados (Checklist de Implementación)

| Archivo | Cambio | Prioridad |
|---------|--------|-----------|
| `src/types/FixtureDefinition.ts` | Añadir `aetherCells?`, unificar `wheels`, mover `IAetherCellSnapshot` aquí | P0 |
| `src/core/forge/compileForgeState.ts` | Añadir `buildCompleteFixture()` pura | P0 |
| `src/core/forge/forgeBuilderState.ts` | `GOVERNOR_SET_FOR_CHANNEL`, auto-purga en `CHANNEL_CLEAR` y `META_SET_CHANNEL_COUNT`, inline DOGMA 3, actualizar `hydrateWheels` | P0 |
| `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` | Reemplazar closure `buildCompleteFixture` por import de la función pura. Eliminar `forgeGraph` del pipeline de save. | P1 |
| `src/core/orchestrator/hydration/FixtureHydrationEngine.ts` | Leer `wheels.colorEngine` con fallback a `capabilities.colorEngine` | P1 |
| `src/core/aether/ingestion/NodeExtractionPipeline.ts` | Sin cambios (ya lee `fixtureDef.dmxGovernors`) | — |
| `src/core/aether/resolver/NodeResolver.ts` | Sin cambios (ya evalúa `device.dmxGovernors`) | — |

---

*Fin del Blueprint. Contrato listo para implementación.*
