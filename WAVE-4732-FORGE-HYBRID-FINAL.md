# ⚡ WAVE 4732 — FORGE HYBRID ENGINE
## Master Blueprint V2 (FINAL)

> **Estado:** Especificación congelada. Única fuente de verdad para WAVE 4732.
> **Supersede:** `WAVE-4732-FORGE-HYBRID.md` (V1) — DEPRECADO al mergear este.
> **Precondición runtime:** WAVE 4730 (Hive Mind + domain divorce) en main.
> **Implementación:** ejecutar las fases 4732-A…G en orden. Cada fase es PR independiente.

---

## Índice

1. [Objetivo y alcance](#1-objetivo-y-alcance)
2. [Anclajes al código real](#2-anclajes-al-código-real)
3. [Estado en memoria — `IForgeBuilderState`](#3-estado-en-memoria--iforgebuilderstate)
4. [TAB 1 · DMX Layout (Mundo físico)](#4-tab-1--dmx-layout-mundo-físico)
5. [TAB 2 · Aether Modules (Mundo lógico)](#5-tab-2--aether-modules-mundo-lógico)
6. [🛡️ Aduana de tipos — Drag & Drop Validation](#6-️-aduana-de-tipos--drag--drop-validation)
7. [⚙️ Compilador — `compileForgeState`](#7-️-compilador--compileforgestate)
8. [🧬 Descompilador — `decompileFromFixture`](#8--descompilador--decompilefromfixture)
9. [Roundtrip & migración legacy](#9-roundtrip--migración-legacy)
10. [Roadmap de implementación](#10-roadmap-de-implementación)
11. [Riesgos y mitigaciones](#11-riesgos-y-mitigaciones)
12. [Definition of Done](#12-definition-of-done)

---

## 1. Objetivo y alcance

Convertir `FixtureForgeEmbedded.tsx` de un **mapeador plano de canales DMX**
en una **Forja Híbrida** capaz de producir y editar perfiles multi-celulares
complejos (Tungsten: 3 petals + wash + beam + 2 impact + kinetic) **sin que el
operador escriba JSON ni edite `nodeGraph` a mano**.

La Forja se reorganiza en dos pestañas que comparten un único estado:

| Tab | Mundo | Responsabilidad |
|---|---|---|
| **DMX Layout** | Físico | Tabla de canales con `type` + `default` + `ignitionDeps` por **`targetChannelIndex`** |
| **Aether Modules** | Lógico | Composición visual de **células** (= `ICapabilityNode`) que agrupan canales físicos |

**Alcance:** UI + compilador + descompilador + validadores. Runtime y bridges
**no se tocan** (ya están listos desde WAVE 4722/4730).

---

## 2. Anclajes al código real

### 2.1 Contratos que YA EXISTEN (no inventamos nada)

`@/electron-app/src/types/FixtureDefinition.ts:5-42` — **`ChannelType`** (30 valores):

```
INTENSITY: dimmer, strobe, shutter
COLOR:     red, green, blue, white, amber, uv, cyan, magenta, yellow, color_wheel
POSITION:  pan, pan_fine, tilt, tilt_fine
BEAM:      gobo, gobo_rotation, prism, prism_rotation, focus, zoom, frost
CONTROL:   speed, macro, control
INGENIOS:  rotation, custom
FALLBACK:  unknown
```

`@/electron-app/src/types/FixtureDefinition.ts:156-174` — **`IgnitionDependency`**:

```ts
export interface IgnitionDependency {
  /** WAVE 4722: índice DMX 0-based — PRECEDENCIA ABSOLUTA sobre channelType */
  targetChannelIndex?: number
  channelType: ChannelType        // fallback semántico
  requiredValue: number           // 0-255
  mode?: 'hold' | 'release'
}
```

`@/electron-app/src/core/forge/types.ts:231-271` — **`IOutputDmxConfig`** ya tiene
los campos `aetherNodeId`, `aetherZone`, `ignitionDeps[].targetChannelIndex`.
**Es el mecanismo nativo de agrupación multi-cell.**

`@/electron-app/src/core/aether/types.ts:74-85` — **`NodeFamily`**:

```ts
enum NodeFamily { COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE }
```

> ⚠️ La directiva original menciona `COLOR_MIXING`. **No existe ese símbolo**.
> El nombre canónico en código es `NodeFamily.COLOR`. Este blueprint usa
> `COLOR` para mantener fidelidad de tipo.

`@/electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:583-602` —
`_mapForgeNodes` ya consume `targetChannelIndex → targetDmxOffset` y respeta
`aetherNodeId` agrupando por él. **Backend listo. La deuda es 100% de UI.**

### 2.2 Bugs en código actual a tapar en esta wave

| # | Síntoma | Ubicación | Acción |
|---|---|---|---|
| B1 | Selector ignitionDeps dedupea por `type` → colisión Golden Dimmer vs Stain Dimmer. | `FixtureForgeEmbedded.tsx:1342-1346` y `:1529-1550` | §4 — selector por canal absoluto |
| B2 | Roundtrip `NodeGraphBuilder.makeOutputDmxNode` pierde `targetChannelIndex`/`mode`/`aetherNodeId`/`aetherZone`. | `@/electron-app/src/core/forge/NodeGraphBuilder.ts:124-129` | §9 — eliminar roundtrip legacy → graph |
| B3 | No existe UI para declarar `aetherNodeId` → imposible crear Tungsten sin editar JSON. | — | §5 — Tab Aether Modules |
| B4 | Sin descompilador: al re-abrir un fixture híbrido se perdería la estructura visual. | — | §8 — `decompileFromFixture` |

---

## 3. Estado en memoria — `IForgeBuilderState`

Única fuente de verdad mientras la Forja está abierta. Dos pestañas, **un solo
state**. Reducer único.

```ts
import type { ChannelType, FixtureChannel, FixtureType } from '@/types/FixtureDefinition'
import type { NodeFamily, NodeRole } from '@/core/aether/types'

export interface IForgeBuilderState {
  readonly meta:         IForgeFixtureMeta
  readonly channels:     readonly FixtureChannel[]      // driver de Tab DMX Layout
  readonly cells:        readonly IForgeCellBuilder[]   // driver de Tab Aether Modules
  readonly capabilities: Readonly<Record<string, unknown>>
  /** Sufijo "•" en el título si el state difiere del último Save. */
  readonly dirty:        boolean
}

export interface IForgeFixtureMeta {
  readonly manufacturer: string
  readonly name:         string
  readonly type:         FixtureType
  readonly mode?:        string
  readonly channelCount: number
}

export interface IForgeCellBuilder {
  /** ID estable. Autogenerado. **No renombrable** (preserva cellOverrides runtime). */
  readonly cellId:          string
  /** Familia Aether — determina aduana de tipos y por qué setter del Programmer se rige. */
  readonly family:          NodeFamily
  /** Etiqueta humana — alimenta `CellDescriptor.label`. Editable. */
  readonly label:           string
  /** Rol semántico — alimenta `CellDescriptor.role` (afecta neon UI). */
  readonly role:            NodeRole
  /** Índices DMX 0-based de los canales que componen la célula. Orden = orden visual. */
  readonly channelIndices:  readonly number[]
  /** Override de zona Aether opcional. */
  readonly aetherZone?:     string
  /** Posición en el lienzo — solo UX, no se compila al JSON. */
  readonly uiPosition?:     { readonly x: number; readonly y: number }
}
```

### Reducer — acciones

```ts
// Tab DMX Layout
type DmxAction =
  | { type: 'CHANNEL_SET_TYPE';       idx: number; channelType: ChannelType }
  | { type: 'CHANNEL_SET_NAME';       idx: number; name: string }
  | { type: 'CHANNEL_SET_DEFAULT';    idx: number; value: number }
  | { type: 'CHANNEL_SET_16BIT';      idx: number; is16bit: boolean }
  | { type: 'CHANNEL_CLEAR';          idx: number }
  | { type: 'IGNITION_ADD';           idx: number; dep: IgnitionDependency }
  | { type: 'IGNITION_UPDATE';        idx: number; depIdx: number; patch: Partial<IgnitionDependency> }
  | { type: 'IGNITION_REMOVE';        idx: number; depIdx: number }

// Tab Aether Modules
type CellAction =
  | { type: 'CELL_CREATE';            family: NodeFamily; cellId?: string }
  | { type: 'CELL_RENAME_LABEL';      cellId: string; label: string }
  | { type: 'CELL_SET_ROLE';          cellId: string; role: NodeRole }
  | { type: 'CELL_SET_ZONE';          cellId: string; zone?: string }
  | { type: 'CELL_DELETE';            cellId: string }
  | { type: 'CELL_ATTACH_CHANNEL';    cellId: string; channelIdx: number }
  | { type: 'CELL_DETACH_CHANNEL';    cellId: string; channelIdx: number }
  | { type: 'CELL_MOVE_CHANNEL';      fromCellId: string; toCellId: string; channelIdx: number }

// Lifecycle
type LifecycleAction =
  | { type: 'HYDRATE_FROM_FIXTURE';   fixture: FixtureDefinition }   // ← decompiler
  | { type: 'RESET' }
```

### Invariantes garantizados por el reducer

1. Un `channelIdx` está en `channelIndices` de **a lo sumo una** célula.
   `CELL_ATTACH_CHANNEL` quita el índice de cualquier otra célula antes de añadirlo.
2. `CELL_DELETE` libera todos sus canales (vuelven a "Unassigned").
3. `CELL_ATTACH_CHANNEL` aplica la **Aduana de Tipos (§6)**: si la familia
   rechaza el `channel.type`, la acción se **no-op** y el reducer publica un
   `ForgeWarning` consumible por el toast UI.
4. `cellId` es único por fixture; `CELL_CREATE` autogenera el siguiente disponible.
5. `CELL_RENAME_LABEL` jamás toca `cellId`.

---

## 4. TAB 1 · DMX Layout (Mundo físico)

### 4.1 Tabla de canales

Idéntica al `channel-rack` actual de `FixtureForgeEmbedded.tsx:1330-1473`. Columnas:
`#`, `Function`, `MIN`, `Default`, `IgnitionDeps`, `Clear`. **No se rediseña el grid.**

### 4.2 Fix de Ignition Deps — selector por canal absoluto (B1)

#### Estado actual defectuoso

```tsx
// FixtureForgeEmbedded.tsx:1342-1346 — produce lista DEDUPEADA por type
const availableTargetTypes = fixture.channels
  .filter(ch => ch.type !== 'unknown' && ch.type !== channel.type)
  .map(ch => ch.type)
  .filter((t, i, arr) => arr.indexOf(t) === i)  // ← rompe el Tungsten
```

#### Diseño objetivo

El selector itera **canales absolutos**:

```
[CH1]  Pan                       (pan)
[CH2]  Golden Dimmer             (dimmer)         ← antes invisible (dedupeado)
[CH7]  Stain Dimmer              (dimmer)         ← antes invisible (dedupeado)
[CH8]  Shutter                   (shutter)
[CH9]  Strobe                    (strobe)
```

**Reglas de filtrado:**
- Excluir el canal actual (sin auto-dependencia).
- Excluir canales con `type === 'unknown'`.
- Label visible: `[CH${idx+1}] ${name || type}`.
- `<option value>` = `String(idx)` (índice DMX 0-based).

**Mutación al elegir:**

```ts
function onSelectDepTarget(channelIdx: number, depIdx: number, targetIdx: number) {
  const target = state.channels[targetIdx]
  dispatch({
    type: 'IGNITION_UPDATE',
    idx: channelIdx,
    depIdx,
    patch: {
      targetChannelIndex: targetIdx,    // ⭐ fuente de verdad
      channelType:        target.type,  // fallback documental (compat con resolver legacy)
    },
  })
}
```

**Render del dep existente** (fila dentro del panel expandido):

```
⚡  [CH7] Stain Dimmer  →  [255] DMX  [mode: hold ▾]  [✕]
```

- El display siempre prioriza `targetChannelIndex`. Resuelve a
  `state.channels[idx]`. Si el slot es `unknown` o el índice apunta fuera de
  rango → badge `(missing)` rojo.
- Si solo trae `channelType` (fixture viejo) y resuelve a 1 canal → badge
  `(auto)` azul. Si resuelve a N → badge `(ambiguous)` ámbar; el operador debe
  re-elegir explícitamente antes de Save.

### 4.3 Nuevo control: `mode`

Drop-down inline en cada fila de dep:
- `hold` (default): inyectar SIEMPRE mientras este perfil esté activo.
- `release`: inyectar SOLO cuando el canal fuente (este canal, no el target) > 0.

El tipo ya lo soporta (`IgnitionDependency.mode`). Hoy la UI no lo expone.

---

## 5. TAB 2 · Aether Modules (Mundo lógico)

### 5.1 Modelo conceptual

Una **célula Aether** = un `ICapabilityNode` runtime = N canales DMX que
comparten identidad funcional. Ejemplo Tungsten:

| `cellId` | `family` | `label` | `role` | Canales DMX |
|---|---|---|---|---|
| `petal-1` | COLOR | Pétalo 1 | petal | Petal1R, Petal1G, Petal1B |
| `petal-2` | COLOR | Pétalo 2 | petal | Petal2R, Petal2G, Petal2B |
| `petal-3` | COLOR | Pétalo 3 | petal | Petal3R, Petal3G, Petal3B |
| `wash` | COLOR | Wash | wash | WashR, WashG, WashB, WashW |
| `beam` | BEAM | Rayo | beam | BeamFocus, BeamZoom |
| `impact-golden` | IMPACT | Golden | primary | Golden Dimmer, Shutter, Strobe |
| `impact-stain` | IMPACT | Stain | primary | Stain Dimmer |
| `kinetic` | KINETIC | Posición | primary | Pan, Tilt, PanFine, TiltFine |

### 5.2 Layout UX

```
┌────────────────────────────────────────────────────────────────────────────┐
│ AETHER MODULES                              [+ New Cell ▾] [⚙ Auto-detect]│
├────────────────────────────────────────────────────────────────────────────┤
│ ┌── UNASSIGNED CHANNELS ──────────┐  ┌── CELLS ─────────────────────────┐ │
│ │ ▤ [CH1] Pan          (pan)      │  │ ┌── petal-1 · COLOR · petal ──┐ │ │
│ │ ▤ [CH9] Strobe       (strobe)   │  │ │ • [CH4] Petal1R              │ │ │
│ │ ▤ [CH19] CustomFan   (custom)   │  │ │ • [CH5] Petal1G              │ │ │
│ │                                  │  │ │ • [CH6] Petal1B              │ │ │
│ │ — drag a chip into a cell —     │  │ │ [label: 'Pétalo 1']          │ │ │
│ │                                  │  │ │ [role: petal ▾]              │ │ │
│ │                                  │  │ │ [zone: flash ▾] [+ Channel] │ │ │
│ │                                  │  │ │                          [✕] │ │ │
│ │                                  │  │ └──────────────────────────────┘ │ │
│ │                                  │  │ ┌── wash · COLOR · wash ──────┐ │ │
│ │                                  │  │ │ … drop zone …                │ │ │
│ │                                  │  │ └──────────────────────────────┘ │ │
│ └──────────────────────────────────┘  └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Interacciones

| Acción | Resultado | Reducer |
|---|---|---|
| Click `[+ New Cell ▾]` → elegir familia | Panel vacío con `cellId` autogenerado (`color-1`, `impact-1`…) | `CELL_CREATE` |
| Drag chip canal → panel célula | Canal pasa a `channelIndices`; **aduana §6 valida**. Si rechaza → drop bloqueado + shake animation. | `CELL_ATTACH_CHANNEL` |
| Drag chip canal entre células | Move atómico (detach origen, attach destino, valida aduana destino). | `CELL_MOVE_CHANNEL` |
| Drag chip de célula → zona "Unassigned" | Detach. | `CELL_DETACH_CHANNEL` |
| Click `[+ Channel]` en célula | Menú con canales libres compatibles con la familia (filtro por aduana). | `CELL_ATTACH_CHANNEL` |
| Editar campo `label` | Mutación inmediata. | `CELL_RENAME_LABEL` |
| Cambiar `role` / `zone` | Mutación inmediata. | `CELL_SET_ROLE` / `CELL_SET_ZONE` |
| Click `[✕]` en cabecera | Confirma modal si la célula tiene canales; libera canales a "Unassigned". | `CELL_DELETE` |
| Click `[⚙ Auto-detect]` | Si `cells.length === 0`, ejecuta heurística por type (descompilador §8 modo legacy). | `HYDRATE_FROM_FIXTURE` (sintético) |

### 5.4 Validaciones visuales en vivo

- Célula sin canales → header amarillo con tooltip "empty cell will be skipped at save".
- Canal `unknown` → no arrastrable, opacidad 40%.
- Drop bloqueado por aduana → flash rojo 200ms + toast inferior:
  `"Canal type 'pan' incompatible con familia COLOR"`.
- Duplicación de `cellId` (caso patológico) → fila roja con `(duplicate)`.

---

## 6. 🛡️ Aduana de tipos — Drag & Drop Validation

### 6.1 Matriz canónica `ChannelType → NodeFamily[]`

Tabla **exhaustiva** sobre los 30 `ChannelType` reales. Cada entrada lista las
familias en las que el canal es aceptado como compatible:

| `ChannelType` | Familias aceptadas | Observaciones |
|---|---|---|
| `dimmer` | **IMPACT** | Estricto |
| `strobe` | **IMPACT** | Estricto |
| `shutter` | **IMPACT** | Estricto |
| `red` | **COLOR** | Estricto |
| `green` | **COLOR** | Estricto |
| `blue` | **COLOR** | Estricto |
| `white` | **COLOR** | Estricto |
| `amber` | **COLOR** | Estricto |
| `uv` | **COLOR** | Estricto |
| `cyan` | **COLOR** | Estricto |
| `magenta` | **COLOR** | Estricto |
| `yellow` | **COLOR** | Estricto |
| `color_wheel` | **COLOR**, BEAM | BEAM por compatibilidad con rueda mecánica óptica |
| `pan` | **KINETIC** | Estricto |
| `pan_fine` | **KINETIC** | Estricto |
| `tilt` | **KINETIC** | Estricto |
| `tilt_fine` | **KINETIC** | Estricto |
| `rotation` | **KINETIC** | Estricto |
| `speed` | **KINETIC** | Estricto |
| `gobo` | **BEAM** | Estricto |
| `gobo_rotation` | **BEAM** | Estricto |
| `prism` | **BEAM** | Estricto |
| `prism_rotation` | **BEAM** | Estricto |
| `focus` | **BEAM** | Estricto |
| `zoom` | **BEAM** | Estricto |
| `frost` | **BEAM** | Estricto |
| `macro` | **ATMOSPHERE**, IMPACT | Macros suelen disparar shutter strobe pero también efectos atm |
| `control` | **ATMOSPHERE** | Canal de control genérico (lamp on/off, reset, etc.) |
| `custom` | **ATMOSPHERE**, IMPACT, BEAM, COLOR, KINETIC | Comodín — el operador elige; warning visible |
| `unknown` | — | Bloqueado en cualquier célula |

> **Regla maestra:** la directiva original define IMPACT/COLOR/KINETIC en modo
> **estricto** (subset cerrado). BEAM agrupa los canales ópticos puros más
> `color_wheel` (rueda mecánica). ATMOSPHERE absorbe `control`, `macro` y
> phantoms. `custom` es comodín explícito.

### 6.2 Implementación de la aduana

Tabla declarativa exportada desde un módulo nuevo
`@/electron-app/src/core/forge/cellTypeAdmittance.ts`:

```ts
import type { ChannelType } from '@/types/FixtureDefinition'
import { NodeFamily } from '@/core/aether/types'

/** Map declarativo. Frozen para que la aduana sea inmutable. */
export const CELL_TYPE_ADMITTANCE: Readonly<Record<ChannelType, readonly NodeFamily[]>> = Object.freeze({
  dimmer:         [NodeFamily.IMPACT],
  strobe:         [NodeFamily.IMPACT],
  shutter:        [NodeFamily.IMPACT],
  red:            [NodeFamily.COLOR],
  green:          [NodeFamily.COLOR],
  blue:           [NodeFamily.COLOR],
  white:          [NodeFamily.COLOR],
  amber:          [NodeFamily.COLOR],
  uv:             [NodeFamily.COLOR],
  cyan:           [NodeFamily.COLOR],
  magenta:        [NodeFamily.COLOR],
  yellow:         [NodeFamily.COLOR],
  color_wheel:    [NodeFamily.COLOR, NodeFamily.BEAM],
  pan:            [NodeFamily.KINETIC],
  pan_fine:       [NodeFamily.KINETIC],
  tilt:           [NodeFamily.KINETIC],
  tilt_fine:      [NodeFamily.KINETIC],
  rotation:       [NodeFamily.KINETIC],
  speed:          [NodeFamily.KINETIC],
  gobo:           [NodeFamily.BEAM],
  gobo_rotation:  [NodeFamily.BEAM],
  prism:          [NodeFamily.BEAM],
  prism_rotation: [NodeFamily.BEAM],
  focus:          [NodeFamily.BEAM],
  zoom:           [NodeFamily.BEAM],
  frost:          [NodeFamily.BEAM],
  macro:          [NodeFamily.ATMOSPHERE, NodeFamily.IMPACT],
  control:        [NodeFamily.ATMOSPHERE],
  custom:         [NodeFamily.ATMOSPHERE, NodeFamily.IMPACT, NodeFamily.BEAM, NodeFamily.COLOR, NodeFamily.KINETIC],
  unknown:        [],
})

export type AdmittanceResult =
  | { ok: true }
  | { ok: false; reason: string }

export function canAdmit(channelType: ChannelType, family: NodeFamily): AdmittanceResult {
  const allowed = CELL_TYPE_ADMITTANCE[channelType]
  if (allowed.length === 0) {
    return { ok: false, reason: `Canal '${channelType}' no puede asociarse a ninguna familia` }
  }
  if (!allowed.includes(family)) {
    return {
      ok: false,
      reason: `Canal '${channelType}' incompatible con familia ${family}. Permitidas: ${allowed.join(', ')}`,
    }
  }
  return { ok: true }
}
```

### 6.3 Flujo de un drop bloqueado

1. `onDragOver(e, cell)` calcula `canAdmit(dragChannel.type, cell.family)`.
   - Si `ok: false` → cursor `not-allowed`, panel destino pinta borde rojo,
     `e.preventDefault()` no se llama (el drop no se completará).
2. Si el operador suelta igualmente (drag desde fuente externa), `onDrop` valida
   por segunda vez (defensive). En fail, dispara toast con `result.reason` y
   shake-animation 200ms del panel.
3. El reducer `CELL_ATTACH_CHANNEL` valida una **tercera vez** (autoridad final)
   y rechaza con no-op. Esto garantiza que aunque la UI tenga un bug, el state
   nunca quede en estado ilegal.

> **Triple validación intencional:** UX rápida (drag-over) + defensive (drop) +
> autoridad (reducer). El compilador (§7) confía en el invariante.

---

## 7. ⚙️ Compilador — `compileForgeState`

Función **pura, sincrónica, sin side-effects**. Único punto que transforma el
estado de la Forja en `FixtureDefinition` listo para `userFixtures.json`.

**Ubicación:** `@/electron-app/src/core/forge/compileForgeState.ts` (nuevo).

```ts
export type ForgeValidationLevel = 'error' | 'warning'

export interface ForgeValidationIssue {
  level: ForgeValidationLevel
  code:  ForgeValidationCode      // enum exhaustivo
  message: string
  /** Anclas para que la UI haga jump-to-row/cell. */
  channelIdx?: number
  cellId?:     string
  depIdx?:     number
}

export type ForgeValidationCode =
  | 'EMPTY_CELL'
  | 'CHANNEL_UNKNOWN_TYPE'
  | 'IGNITION_AMBIGUOUS_TYPE'
  | 'IGNITION_MISSING_TARGET'
  | 'DUPLICATE_CELL_ID'
  | 'INCOMPATIBLE_CHANNEL_FAMILY'   // defensa: debería ser imposible si la aduana funciona
  | 'NO_CHANNELS'

export type CompileResult =
  | { ok: true;  fixture: FixtureDefinition; warnings: ForgeValidationIssue[] }
  | { ok: false; errors:  ForgeValidationIssue[]; warnings: ForgeValidationIssue[] }

export function compileForgeState(state: IForgeBuilderState): CompileResult
```

### 7.1 Fases (en orden)

**Fase A — Validación estática**
- `state.channels.filter(c => c.type !== 'unknown').length === 0` → error `NO_CHANNELS`.
- Para cada célula: `channelIndices.length === 0` → error `EMPTY_CELL` (no se
  acepta `Save` con células vacías; el operador debe borrarlas o llenarlas).
- Para cada célula × canal: si `!canAdmit(channel.type, cell.family).ok` →
  error `INCOMPATIBLE_CHANNEL_FAMILY` (defensa contra reducer bypass).
- Detección de `cellId` duplicado → error `DUPLICATE_CELL_ID`.

**Fase B — Resolución de IgnitionDeps**

Para cada `channel.ignitionDeps[]`:

```ts
function resolveDep(dep: IgnitionDependency, channels: FixtureChannel[], issues: ForgeValidationIssue[]):
    IgnitionDependency {
  // 1) Si ya trae index, validar que el slot existe y no es unknown.
  if (dep.targetChannelIndex !== undefined) {
    const target = channels[dep.targetChannelIndex]
    if (!target || target.type === 'unknown') {
      issues.push({ level: 'error', code: 'IGNITION_MISSING_TARGET', ... })
    }
    return dep
  }
  // 2) Solo trae channelType: intentar auto-upgrade.
  const matches = channels.filter(c => c.type === dep.channelType)
  if (matches.length === 1) {
    return { ...dep, targetChannelIndex: matches[0].index }   // upgrade silencioso
  }
  if (matches.length > 1) {
    issues.push({ level: 'warning', code: 'IGNITION_AMBIGUOUS_TYPE', ... })
    return dep   // se respeta tal cual; el resolver runtime usa el primer match
  }
  issues.push({ level: 'error', code: 'IGNITION_MISSING_TARGET', ... })
  return dep
}
```

**Fase C — Emisión del `nodeGraph`**

```ts
function compileNodeGraph(state: IForgeBuilderState): IForgeGraph {
  const nodes: IForgeNode[] = []

  for (const ch of state.channels) {
    if (ch.type === 'unknown') continue
    const owning = state.cells.find(c => c.channelIndices.includes(ch.index))

    const config: IOutputDmxConfig = {
      nodeType:           'output_dmx',
      channelType:        ch.type,
      dmxOffset:          ch.index,
      channelName:        ch.name,
      defaultDmxValue:    ch.defaultValue,
      is16bit:            ch.is16bit || undefined,
      continuousRotation: ch.continuousRotation || undefined,
      // ⭐ Atajo multi-cell: todos los output_dmx de la misma célula
      //    comparten aetherNodeId → el pipeline los agrupa en UN ICapabilityNode.
      aetherNodeId:       owning?.cellId,
      aetherZone:         owning?.aetherZone,
      ignitionDeps:       ch.ignitionDeps?.map(resolveDep),
    }
    nodes.push(makeOutputDmxNode(ch, config))
  }

  return {
    nodes,
    edges: [],
    metadata: {
      compiledBy: 'ForgeHybrid@4732',
      fixtureId:  buildFixtureId(state.meta),
      compiledAt: Date.now(),
      cellsCount: state.cells.length,
    },
  }
}
```

**Fase D — Ensamblaje final**

```ts
const fixture: FixtureDefinition = {
  id:           buildFixtureId(state.meta),
  manufacturer: state.meta.manufacturer,
  name:         state.meta.name,
  type:         state.meta.type,
  mode:         state.meta.mode,
  channels:     state.channels.map(stripUnknown),  // ignitionDeps ya resueltas
  nodeGraph:    compileNodeGraph(state),
  capabilities: state.capabilities,
  // ... derived capabilities recomputadas
}
```

### 7.2 Garantías

- **Pureza:** no toca disco, no toca store, no llama IPC.
- **Idempotencia:** `compile(decompile(compile(s))) === compile(s)` (probado en §10 / 4732-G).
- **Sin pérdida silenciosa:** todo dato dropeado emite un `warning` con código y ancla UI.

---

## 8. 🧬 Descompilador — `decompileFromFixture`

**Ubicación:** `@/electron-app/src/core/forge/decompileFromFixture.ts` (nuevo).

**Función:** dado un `FixtureDefinition` arbitrario (legacy plano o híbrido WAVE 4732),
reconstruir un `IForgeBuilderState` listo para renderizar en las dos pestañas.

```ts
export interface DecompileResult {
  state:    IForgeBuilderState
  /** Notas para mostrar al operador tras abrir el fixture. */
  notes:    ForgeValidationIssue[]
  /** True si se aplicó la heurística por type (no había nodeGraph). */
  inferred: boolean
}

export function decompileFromFixture(fixture: FixtureDefinition): DecompileResult
```

### 8.1 Algoritmo

```
fixture
  │
  ├─ ¿tiene fixture.nodeGraph con nodos output_dmx?
  │     ├─ SÍ → ruta A (parsing fiel)
  │     └─ NO → ruta B (heurística por type, marca inferred=true)
  │
  └─ devuelve { state, notes, inferred }
```

#### Ruta A — Parsing fiel desde `nodeGraph`

1. **Reconstrucción de channels:**
   - Para cada `node` con `node.type === 'output_dmx'`:
     - Reconstruir `FixtureChannel`: `{ index: cfg.dmxOffset, type: cfg.channelType,
       name: cfg.channelName, defaultValue: cfg.defaultDmxValue, is16bit, ignitionDeps }`.
   - Ordenar por `dmxOffset` ascendente.
   - Rellenar huecos con `{ index: i, type: 'unknown', defaultValue: 0 }` para que
     el `channelCount` físico coincida.

2. **Reconstrucción de cells** (clave del decompiler):
   - Indexar `nodes` por `cfg.aetherNodeId` (saltando los que no tengan).
   - Para cada bucket `cellId → nodes[]`:
     - `family`: deducir desde la familia mayoritaria de los `channelType` del bucket
       usando la aduana inversa (`familyOf(channelType)`). Si hay mezcla
       (caso `color_wheel` o `custom`), elegir la familia válida más frecuente;
       empate → preferencia `COLOR > IMPACT > KINETIC > BEAM > ATMOSPHERE`.
     - `label`: si todos los nodos del bucket comparten un prefijo común en
       `channelName`, usarlo; si no, `${cellId}` formateado (`petal-1` → `Pétalo 1`).
     - `role`: heurística por nombre — `cellId.startsWith('petal')` → `'petal'`,
       `'wash'` → `'wash'`, `'beam'` → `'beam'`, default `'primary'`.
     - `aetherZone`: leer del primer nodo del bucket (deben coincidir; mismatch → warning).
     - `channelIndices`: `cfg.dmxOffset[]` ordenados por offset.
   - Los nodos sin `aetherNodeId` quedan en "Unassigned" (no se inventan células).

3. **Reconstrucción de ignitionDeps:**
   - Los deps ya vienen en cada `output_dmx.config.ignitionDeps`. Se copian
     verbatim al `FixtureChannel.ignitionDeps`. **No se hace upgrade automático
     aquí** — eso es responsabilidad del compilador en la próxima Save.

#### Ruta B — Heurística por type (legacy plano)

Cuando `fixture.nodeGraph` está vacío/ausente:

- `state.channels = fixture.channels.slice()` tal cual.
- `state.cells = []` por defecto (la Tab Aether abre vacía).
- El descompilador **NO crea células automáticamente**. Esto es decisión de
  diseño: no falseamos la intención del autor del perfil viejo.
- En el estado retornado se incluye `inferred: true` para que la UI muestre el
  banner: `"Este fixture es legacy. Pulsa [⚙ Auto-detect] para generar células
  automáticamente desde los tipos de canal."`.

#### Botón `[⚙ Auto-detect]` (modo opcional)

Cuando el operador lo pulsa, se aplica la heurística declarativa:

```ts
function autoDetectCells(channels: FixtureChannel[]): IForgeCellBuilder[] {
  const buckets = new Map<NodeFamily, number[]>()  // family → channelIndices
  for (const ch of channels) {
    if (ch.type === 'unknown') continue
    const family = primaryFamilyOf(ch.type)   // primera entrada de CELL_TYPE_ADMITTANCE
    if (!family) continue
    if (!buckets.has(family)) buckets.set(family, [])
    buckets.get(family)!.push(ch.index)
  }
  return Array.from(buckets, ([family, indices], i) => ({
    cellId:         `${family.toLowerCase()}-${i + 1}`,
    family,
    label:          defaultLabelFor(family),       // "Color", "Intensidad", "Posición"…
    role:           'primary',
    channelIndices: indices,
    uiPosition:     { x: 0, y: i * 120 },
  }))
}
```

Este modo es **explícito y reversible**: el operador lo dispara, ve el resultado,
puede editarlo, y al `Save` se persiste el `nodeGraph` con células reales.

### 8.2 Idempotencia (contrato)

Para todo `state: IForgeBuilderState` válido:

```
decompileFromFixture(compileForgeState(state).fixture).state ≡ state
```

(excepto `uiPosition` que es metadata UX). Esto se cubre con tests de
propiedad en la fase 4732-G.

---

## 9. Roundtrip & migración legacy

### 9.1 Política del roundtrip

**El `nodeGraph` es la fuente de verdad maestra.** Implicaciones:

1. **Al abrir** un fixture: `decompileFromFixture` se ejecuta UNA vez al cargar.
2. **Al editar**: todo cambio vive en `IForgeBuilderState`. La UI nunca lee
   `fixture.nodeGraph` después del hidrato inicial.
3. **Al guardar**: `compileForgeState` regenera el `nodeGraph` completo. El
   `FixtureChannel.ignitionDeps` legacy también se reescribe (con índices
   resueltos) para compatibilidad con código que aún lo lee.

### 9.2 Fix de Bug B2 (`NodeGraphBuilder.makeOutputDmxNode:124-129`)

El roundtrip legacy → graph en `NodeGraphBuilder` se mantiene **solo** como
fallback de migración (cuando un fixture viejo se carga desde disco sin
pasar por la Forja). Para que ese path también respete los nuevos campos:

```ts
// Antes:
...(channel.ignitionDeps && channel.ignitionDeps.length > 0 && {
  ignitionDeps: channel.ignitionDeps.map(d => ({
    channelType:   d.channelType,
    requiredValue: d.requiredValue,
  })),
}),

// Después (4732-A):
...(channel.ignitionDeps && channel.ignitionDeps.length > 0 && {
  ignitionDeps: channel.ignitionDeps.map(d => ({
    channelType:        d.channelType,
    requiredValue:      d.requiredValue,
    targetChannelIndex: d.targetChannelIndex,
    mode:               d.mode,
  })),
}),
```

Cambio de 2 LOC. Sin él, el roundtrip silencioso pierde la información del Fix B1.

### 9.3 Fixtures `userFixtures.json` existentes

- **No se rompen.** El decompilador (ruta B) los abre y muestra la Tab Aether
  vacía con banner de migración.
- Mientras el operador no toque la Tab Aether y no haga Save, el fixture en
  disco se queda exactamente como estaba.
- Al primer Save tras tocar la Tab DMX (ignition deps o canales), se regenera
  el `nodeGraph` desde el state. Si la Tab Aether sigue vacía y el operador no
  ejecutó Auto-detect → el `nodeGraph` se emite sin `aetherNodeId` en ningún
  nodo (= comportamiento legacy: `_buildAllNodes` agrupa por type heurísticamente
  en runtime). Esto es **idéntico al comportamiento actual** — sin regresión.

---

## 10. Roadmap de implementación

| Fase | Alcance | LOC aprox | Riesgo | Dependencias |
|---|---|---|---|---|
| **4732-A** | Migrar `FixtureForgeEmbedded` state a `IForgeBuilderState` + reducer (sin cambios visuales). Fix de B2. | 400 | Bajo | — |
| **4732-B** | Tab DMX: selector ignitionDeps por canal absoluto + control `mode`. | 200 | Bajo | A |
| **4732-C** | Tab Aether Modules MVP: crear/borrar células, attach por `[+ Channel]` selector. Aduana §6 activa. | 600 | Medio | A |
| **4732-D** | Drag & drop chips canales ↔ células con triple validación. | 250 | Medio | C |
| **4732-E** | `compileForgeState` + reemplazo del save handler actual. Errores bloqueantes en UI. | 350 | Alto | A,B,C |
| **4732-F** | `decompileFromFixture` (ruta A y B) + botón Auto-detect + banner migración. | 300 | Medio | E |
| **4732-G** | Property tests Vitest: `decompile ∘ compile ≡ id`, aduana exhaustiva, ignition resolución. | 250 | Bajo | F |

Cada fase deja la Forja **funcional y mergeable** independientemente.

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Fixtures viejos se rompen al re-abrir. | Media | Decompilador ruta B + banner. Sin Save: cero cambios en disco. |
| Operador deja célula vacía y rompe el `nodeGraph`. | Alta | Fase A del compilador: `EMPTY_CELL` es **error bloqueante** del Save. |
| Cambio de `cellId` invalida `cellOverrides` runtime. | Media | `cellId` autogenerado y **no renombrable** desde UI. Solo `label` editable. |
| Roundtrip legacy pierde `targetChannelIndex`. | **Resuelto en 4732-A** | Fix B2 de 2 LOC en `NodeGraphBuilder`. |
| Aduana muy permisiva → operador asocia mal. | Baja | `custom` único comodín. IMPACT/COLOR/KINETIC estrictos. Warning visible en custom. |
| Aduana muy estricta → caso real bloqueado. | Baja | `custom` siempre acepta; `macro` también admite IMPACT. Tabla revisable sin tocar UI. |
| `nodeGraph` colisiona con runtime extractor (`primaryFamilyOf` distinto). | Baja | Tests de propiedad 4732-G verifican que el compilador produce graphs que el `NodeExtractionPipeline` consume sin warning. |
| Selector ignitionDeps por canal absoluto rompe atajos de teclado existentes. | Baja | Mantener arrow-keys + Enter en el `<select>`. UX no regresa. |

---

## 12. Definition of Done

WAVE 4732 se considera **HECHA** cuando se cumplen los 7 criterios:

1. ✅ **Tab DMX Layout** permite seleccionar canal absoluto como target de
   `ignitionDeps` y el JSON guarda `targetChannelIndex`.
2. ✅ **Tab Aether Modules** permite construir el nodeGraph del Tungsten sin
   tocar JSON (3 petals + wash + beam + 2 impact + kinetic) usando drag & drop
   o selector por teclado.
3. ✅ **Aduana de tipos** bloquea drops ilegales con feedback visual inmediato
   (cursor + borde rojo + toast).
4. ✅ **`compileForgeState`** produce `FixtureDefinition` válido. Save bloquea
   con error claro en caso de células vacías o deps irresolubles.
5. ✅ **`decompileFromFixture`** abre fixtures híbridos preservando células y
   abre fixtures legacy con banner + Auto-detect.
6. ✅ **`useAggregatedCapabilityCells` (WAVE 4730)** consume el `nodeGraph`
   emitido por la Forja híbrida y produce los grupos por familia/role esperados,
   sin tocar runtime ni bridges.
7. ✅ **`tsc --noEmit`** = 0 errores. **Vitest** property tests verdes
   (`decompile ∘ compile ≡ id`, aduana exhaustiva).

---

## Apéndice A — Helpers compartidos

```ts
// @/electron-app/src/core/forge/cellTypeAdmittance.ts
export function primaryFamilyOf(channelType: ChannelType): NodeFamily | null {
  const list = CELL_TYPE_ADMITTANCE[channelType]
  return list.length > 0 ? list[0] : null
}

export function familyAcceptsAny(family: NodeFamily, types: readonly ChannelType[]): boolean {
  return types.some(t => CELL_TYPE_ADMITTANCE[t].includes(family))
}

export function compatibleChannelsForFamily(
  channels: readonly FixtureChannel[],
  family: NodeFamily,
): readonly FixtureChannel[] {
  return channels.filter(c => CELL_TYPE_ADMITTANCE[c.type].includes(family))
}
```

Estos helpers se reutilizan en:
- **UI**: filtrar el menú `[+ Channel]` por familia de la célula.
- **Compilador**: defensa de `INCOMPATIBLE_CHANNEL_FAMILY`.
- **Descompilador**: deducir `family` mayoritaria desde un bucket de nodos.

---

## Apéndice B — Esquema JSON del fixture híbrido (Tungsten)

```jsonc
{
  "id": "tungsten-pro-fan-19ch",
  "manufacturer": "Acme",
  "name": "Tungsten Pro Fan",
  "type": "fan",
  "channels": [
    { "index": 0,  "type": "pan",    "name": "Pan",           "defaultValue": 128 },
    { "index": 1,  "type": "tilt",   "name": "Tilt",          "defaultValue": 128 },
    { "index": 2,  "type": "dimmer", "name": "Golden Dimmer", "defaultValue": 0,
      "ignitionDeps": [{ "targetChannelIndex": 8, "channelType": "shutter", "requiredValue": 255, "mode": "hold" }] },
    { "index": 3,  "type": "red",    "name": "Petal1R",       "defaultValue": 0 },
    { "index": 4,  "type": "green",  "name": "Petal1G",       "defaultValue": 0 },
    { "index": 5,  "type": "blue",   "name": "Petal1B",       "defaultValue": 0 },
    { "index": 6,  "type": "dimmer", "name": "Petal1Dim",     "defaultValue": 0 },
    { "index": 7,  "type": "dimmer", "name": "Stain Dimmer",  "defaultValue": 0,
      "ignitionDeps": [{ "targetChannelIndex": 8, "channelType": "shutter", "requiredValue": 255, "mode": "hold" }] },
    { "index": 8,  "type": "shutter","name": "Shutter",       "defaultValue": 255 }
    /* … */
  ],
  "nodeGraph": {
    "nodes": [
      { "id": "out-pan-0", "type": "output_dmx",
        "config": { "channelType":"pan","dmxOffset":0,"defaultDmxValue":128,
                    "aetherNodeId":"kinetic","aetherZone":"movement" } },
      { "id": "out-tilt-1", "type": "output_dmx",
        "config": { "channelType":"tilt","dmxOffset":1,"defaultDmxValue":128,
                    "aetherNodeId":"kinetic","aetherZone":"movement" } },
      { "id": "out-dimmer-2", "type": "output_dmx",
        "config": { "channelType":"dimmer","dmxOffset":2,"defaultDmxValue":0,
                    "aetherNodeId":"impact-golden",
                    "ignitionDeps":[{"targetChannelIndex":8,"channelType":"shutter","requiredValue":255,"mode":"hold"}] } },
      { "id": "out-red-3",   "type": "output_dmx",
        "config": { "channelType":"red","dmxOffset":3,"defaultDmxValue":0,
                    "aetherNodeId":"petal-1","aetherZone":"flash" } },
      { "id": "out-green-4", "type": "output_dmx",
        "config": { "channelType":"green","dmxOffset":4,"defaultDmxValue":0,
                    "aetherNodeId":"petal-1","aetherZone":"flash" } },
      { "id": "out-blue-5",  "type": "output_dmx",
        "config": { "channelType":"blue","dmxOffset":5,"defaultDmxValue":0,
                    "aetherNodeId":"petal-1","aetherZone":"flash" } },
      { "id": "out-dimmer-7","type": "output_dmx",
        "config": { "channelType":"dimmer","dmxOffset":7,"defaultDmxValue":0,
                    "aetherNodeId":"impact-stain",
                    "ignitionDeps":[{"targetChannelIndex":8,"channelType":"shutter","requiredValue":255,"mode":"hold"}] } },
      { "id": "out-shutter-8","type":"output_dmx",
        "config": { "channelType":"shutter","dmxOffset":8,"defaultDmxValue":255,
                    "aetherNodeId":"impact-golden" } }
    ],
    "edges": [],
    "metadata": { "compiledBy": "ForgeHybrid@4732", "fixtureId": "tungsten-pro-fan-19ch", "cellsCount": 8 }
  }
}
```

Runtime tras `NodeExtractionPipeline.extract()`:

```
tungsten-01:kinetic         → KINETIC node {pan, tilt}
tungsten-01:impact-golden   → IMPACT node {dimmer_2, shutter_8} con ignitionDeps
tungsten-01:impact-stain    → IMPACT node {dimmer_7}            con ignitionDeps
tungsten-01:petal-1         → COLOR node {red, green, blue}
tungsten-01:petal-2         → COLOR node {...}
tungsten-01:petal-3         → COLOR node {...}
tungsten-01:wash            → COLOR node {...}
tungsten-01:beam            → BEAM  node {...}
```

`useAggregatedCapabilityCells` (WAVE 4730) emite los grupos correspondientes
sin requerir más trabajo de cliente.

---

*Master Blueprint V2 — congelado en WAVE 4732.
Supersede WAVE-4732-FORGE-HYBRID.md. Próximo paso: implementación de la fase 4732-A.*
