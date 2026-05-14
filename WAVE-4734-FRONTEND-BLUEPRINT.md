# ⚡ WAVE 4734 — FRONTEND HYBRID ROUTER (Blueprint)

> **Estado:** Especificación de implementación. Ejecutor: Sonnet.
> **Audiencia:** UI del Programmer + bridges Aether → React.
> **Precondición:** WAVE 4730 (Hive Mind store) + WAVE 4732 (Forge Hybrid) en main.
> **Objetivo:** Que `TheProgrammer.tsx` digiera correctamente fixtures multi-celulares
> (ej. Tungsten 9-cell) sin secciones fantasma, sin canales perdidos, sin labels rotos.

---

## Índice

1. [Diagnóstico anclado al código actual](#1-diagnóstico-anclado-al-código-actual)
2. [Arquitectura objetivo — vista 30k pies](#2-arquitectura-objetivo--vista-30k-pies)
3. [🧠 The Cell Router (renderizador dinámico)](#3--the-cell-router-renderizador-dinámico)
4. [🏷️ Propagación de Labels e Identity](#4-️-propagación-de-labels-e-identity)
5. [👻 Purga de Fantasmas (gating + null safety)](#5--purga-de-fantasmas-gating--null-safety)
6. [🧩 Compound Component — `<CellAccordion>`](#6--compound-component--cellaccordion)
7. [🔀 Híbridos: cuando una célula mezcla familias](#7--híbridos-cuando-una-célula-mezcla-familias)
8. [📦 ExtrasSection v2 — el cajón ordenado](#8--extrassection-v2--el-cajón-ordenado)
9. [Reglas de UX (no regresar)](#9-reglas-de-ux-no-regresar)
10. [Roadmap](#10-roadmap)
11. [Definition of Done](#11-definition-of-done)

---

## 1. Diagnóstico anclado al código actual

### 1.1 Estado del switch en `TheProgrammer.tsx:386-401`

```tsx
switch (group.family) {
  case NodeFamily.IMPACT:  sectionEl = <IntensitySection .../>; break
  case NodeFamily.COLOR:   sectionEl = <ColorSection .../>;     break
  case NodeFamily.BEAM:    sectionEl = <BeamSection .../>;      break
  case NodeFamily.KINETIC: sectionEl = <KineticSection .../>;   break
  default: return null   // ← silencia ATMOSPHERE y cualquier futura familia
}
```

### 1.2 Bugs detectados

| # | Síntoma | Causa raíz | Ubicación |
|---|---|---|---|
| **F1** | Acordeón Kinetic vacío en fixtures sin `rotation` | El switch enruta toda KINETIC → `KineticSection`, pero éste solo controla `rotation`. Pan/tilt/speed pertenecen a KineticsCathedral. | `TheProgrammer.tsx:396` + `KineticSection.tsx:30-60` |
| **F2** | Petal1Dim del Tungsten no aparece en la UI | El `nodeGraph` agrupa `red+green+blue+dimmer` bajo `aetherNodeId="petal-1"`. El pipeline emite UNA cell COLOR. `ColorSection` solo lee `r/g/b` del payload — el `dimmer` queda en el override pero invisible. | `ColorSection.tsx:88-100` |
| **F3** | ATMOSPHERE silenciada | `default: return null` no diferencia "familia válida no soportada" de "datos rotos". | `TheProgrammer.tsx:400` |
| **F4** | `ExtrasSection` huérfana | El componente existe (`@/electron-app/src/components/hyperion/controls/ExtrasSection.tsx`, 535 LOC) pero el nuevo render no lo invoca. Lee del `stageStore`/`libraryStore` en lugar de `aggregatedGroups`. | `TheProgrammer.tsx:339-407` (no se monta) |
| **F5** | Header label puede mostrar `cellId` cuando label custom falta | `CellDescriptor.label` se rellena en `NodeExtractionPipeline`. Si el JSON viejo no trae `channelName` ni descriptor, cae a `cellId` (`petal-1` literal). | Pipeline → `IntensitySection.tsx:127` |
| **F6** | Race del `<switch>` con `cells.length === 0` | El guard `if (group.cellKeys.length === 0) return null` (línea 368) protege contra grupos vacíos pero NO contra grupos con cellKeys cuyas cells aún no tienen payload. | `TheProgrammer.tsx:368` |
| **F7** | Cada `*Section` re-implementa header + toggle + release-btn | 4× boilerplate idéntico (`section-header clickable` con `onClick={onToggle}`). DX pobre y CSS divergente. | `IntensitySection:120-143`, `ColorSection`, `BeamSection`, `KineticSection` |

### 1.3 Lo que YA funciona (no romper)

- `useAggregatedCapabilityCells` (`@/electron-app/src/hooks/useAggregatedCapabilityCells.ts`) agrupa por `${family}:${role}:${label}` correctamente. **No tocar.**
- `peerCellKeys` + dispatch a TODAS las cells del grupo en cada section atomic. **Patrón a preservar.**
- `--neon-base` CSS variable inyectada por wrapper. Limpio. **Mantener y expandir el mapa.**
- `ROLE_NEON` está duplicado entre `TheProgrammer.tsx:35-44` y `DeviceCellGroup.tsx:31-44`. **Consolidar (§6).**

---

## 2. Arquitectura objetivo — vista 30k pies

```
selectedIds[]
   │
   ▼
useAggregatedCapabilityCells(selectedIds)        ← WAVE 4730 (no se toca)
   │
   ▼ AggregatedCellGroup[]
   │
   ▼
┌────────────────────────────────────────────────────────────────────┐
│ <CellRouter groups={aggregatedGroups} />                            │
│                                                                     │
│  for each group:                                                    │
│    1. ¿está vacío de payload? (gating)         → skip               │
│    2. ¿qué section component manejarlo?        → SECTION_REGISTRY   │
│    3. ¿la section reporta canRender(group)?    → si no, skip        │
│    4. envuelve en <CellAccordion> compound (header + slot)          │
│                                                                     │
│  + un único <ExtrasAggregator /> al final que recoge las families   │
│    ATMOSPHERE + canales sueltos (custom/macro/control) en una       │
│    sola sección "Extras" colapsable.                                │
└────────────────────────────────────────────────────────────────────┘
```

**Tres patterns combinados:**

1. **Factory Registry** (`SECTION_REGISTRY`): mapa declarativo `NodeFamily → SectionContract`. Sustituye el `switch`.
2. **Compound Component** (`<CellAccordion>`): cabecera + slot reutilizables. Cada section sólo aporta el body.
3. **Capability Gating** (`canRender(payload)`): cada section declara qué shapes puede consumir; el router pregunta antes de pintar.

---

## 3. 🧠 The Cell Router (renderizador dinámico)

### 3.1 Contrato de Section

Cada section atomic implementa el siguiente shape común:

```ts
// @/electron-app/src/components/hyperion/controls/cellRouting.ts (nuevo)

import type { NodeFamily, AggregatedCellGroup, CapabilityContext, CellKey } from '@/stores/programmer-types'
import type { CellOverride } from '@/stores/programmer-types'

export interface SectionRenderProps<F extends NodeFamily> {
  ctx:           CapabilityContext<F>
  peerCellKeys?: readonly CellKey[]
  /** Inyectado por <CellAccordion>. La section ya NO maneja toggle. */
  isExpanded:    boolean
}

export interface SectionContract<F extends NodeFamily = NodeFamily> {
  /** Familia que esta section sirve. Una y solo una. */
  readonly family: F
  /**
   * Predicado que decide si la cell tiene sustancia que mostrar.
   * El router lo invoca antes de montar el componente.
   * Devuelve false → la cell entera se omite del render (ahorra DOM).
   */
  canRender(group: AggregatedCellGroup, override: CellOverride | undefined): boolean
  /** Componente body (sin header, sin toggle — eso lo da CellAccordion). */
  readonly Body: React.ComponentType<SectionRenderProps<F>>
  /** Icono visual del header. */
  readonly Icon: React.ComponentType<{ size?: number; className?: string }>
  /** Título canónico — se muestra ANTES del label (`INTENSITY: PETAL 1`). */
  readonly title: string
}
```

### 3.2 Registry declarativo

```ts
// @/electron-app/src/components/hyperion/controls/cellRouting.ts

export const SECTION_REGISTRY: Readonly<Record<NodeFamily, SectionContract>> = Object.freeze({
  [NodeFamily.IMPACT]:  IntensitySectionContract,
  [NodeFamily.COLOR]:   ColorSectionContract,
  [NodeFamily.BEAM]:    BeamSectionContract,
  [NodeFamily.KINETIC]: KineticSectionContract,
  [NodeFamily.ATMOSPHERE]: AtmosphereSectionContract,   // ← nuevo, §8
})
```

Cada section atomic exporta su contrato:

```ts
// IntensitySection.tsx (refactor)
export const IntensitySectionContract: SectionContract<NodeFamily.IMPACT> = {
  family:    NodeFamily.IMPACT,
  Body:      IntensitySectionBody,                 // sin header
  Icon:      IntensityIcon,
  title:     'INTENSITY',
  canRender: (group, ov) => {
    // Una IMPACT cell tiene sustancia si TIENE potencial dimmer/strobe/limit/shutter.
    // Como aún no podemos saberlo sin el override, lo aceptamos siempre que
    // el group tenga al menos una cellKey. El payload "vacío" es un override
    // legítimo (= permitir manual desde 0).
    return group.cellKeys.length > 0
  },
}
```

```ts
// KineticSection.tsx (refactor crítico — fix de F1)
export const KineticSectionContract: SectionContract<NodeFamily.KINETIC> = {
  family:    NodeFamily.KINETIC,
  Body:      KineticSectionBody,
  Icon:      KineticIcon,
  title:     'KINETIC',
  canRender: (group, ov) => {
    // 🛡️ GATING ANTI-FANTASMA:
    // KineticSection SOLO maneja 'rotation'. Pan/tilt/speed son del KineticsCathedral.
    // Se renderiza ÚNICAMENTE si:
    //   (a) hay override 'rotation' activo, o
    //   (b) el role es 'rotor' (heurística declarativa: cells diseñadas para rotación).
    if (ov?.payload.family === NodeFamily.KINETIC) {
      const data = ov.payload.data as { rotation?: number }
      if (data.rotation !== undefined) return true
    }
    return group.role === 'rotor'
  },
}
```

### 3.3 El Router (componente)

```tsx
// @/electron-app/src/components/hyperion/controls/CellRouter.tsx (nuevo)

export interface CellRouterProps {
  groups: readonly AggregatedCellGroup[]
  activeSection: string
  onToggleSection: (key: string) => void
}

export const CellRouter: React.FC<CellRouterProps> = ({ groups, activeSection, onToggleSection }) => {
  const overrides = useProgrammerStore(s => s.cellOverrides)

  return (
    <>
      {groups.map(group => {
        const contract = SECTION_REGISTRY[group.family]
        if (!contract) return null   // family futura no registrada

        // Tomamos el override del primer cellKey como representante (Hive Mind invariant).
        const ov = overrides.get(group.cellKeys[0])

        if (!contract.canRender(group, ov)) return null  // gating §5

        return (
          <CellAccordion
            key={group.groupKey}
            group={group}
            contract={contract}
            isExpanded={activeSection === group.groupKey}
            onToggle={() => onToggleSection(group.groupKey)}
            override={ov}
          />
        )
      })}

      {/* Cajón de ATMOSPHERE + phantoms — §8 */}
      <ExtrasAggregator groups={groups} />
    </>
  )
}
```

### 3.4 Reemplazo en `TheProgrammer.tsx`

El bloque actual `aggregatedGroups.map(...)` (líneas 367-407) se reduce a:

```tsx
<CellRouter
  groups={aggregatedGroups}
  activeSection={activeSection}
  onToggleSection={toggleSection}
/>
```

—~40 LOC menos en `TheProgrammer.tsx`.

---

## 4. 🏷️ Propagación de Labels e Identity

### 4.1 Cadena completa label JSON → header

```
fixture.nodeGraph.nodes[i].config.aetherNodeId   = "petal-1"
                       └── (Forge Tab Aether: cellId)
                       │
                       ▼
NodeExtractionPipeline._buildNodesFromForgeGraph
   → ICapabilityNode { id: "tungsten-01:petal-1", label: ??? }
                       │
                       ▼
useCapabilityCells construye CellDescriptor { label: ??? }
                       │
                       ▼
useAggregatedCapabilityCells agrupa por `${family}:${role}:${label}`
                       │
                       ▼
AggregatedCellGroup.label
                       │
                       ▼
ctx.label = group.label   (TheProgrammer.tsx:380)
                       │
                       ▼
<CellAccordion title="INTENSITY" subtitle={ctx.label} />
                       │
                       ▼
"INTENSITY: PÉTALO 1"
```

### 4.2 Reglas de resolución del `label` (en orden de precedencia)

Implementar en `NodeExtractionPipeline._buildLabelFor(node)`:

```ts
function buildLabelFor(node: ICapabilityNode, channels: INodeChannelDef[]): string {
  // 1) Prefijo común humano del channelName/customName.
  //    Ej: ["Petal1R", "Petal1G", "Petal1B"] → "Petal1" → "Pétalo 1"
  const prefix = longestCommonPrefix(channels.map(c => c.customName).filter(Boolean))
  if (prefix && prefix.length >= 3) return humanize(prefix)

  // 2) Mapeo declarativo del aetherNodeId conocido.
  const known = WELL_KNOWN_LABELS[node.id.split(':').pop() ?? '']
  if (known) return known   // 'wash' → 'Wash', 'beam' → 'Rayo', 'kinetic' → 'Posición'

  // 3) Title-case del aetherNodeId. 'petal-1' → 'Petal 1'.
  return titleCase(node.id.split(':').pop() ?? 'Cell')
}

const WELL_KNOWN_LABELS: Record<string, string> = {
  'wash':           'Wash',
  'beam':           'Rayo',
  'kinetic':        'Posición',
  'impact':         'Master',
  'impact-golden':  'Golden',
  'impact-stain':   'Stain',
}
```

### 4.3 Header del compound

```tsx
// CellAccordion header (§6) muestra:
<h4 className="cell-accordion-title">
  <Contract.Icon size={18} className="title-icon" />
  {contract.title}
  <span className="cell-accordion-sublabel" style={{ color: 'var(--neon-base)' }}>
    : {ctx.label.toUpperCase()}
  </span>
</h4>
```

Para el Tungsten produce:

```
INTENSITY: GOLDEN
INTENSITY: STAIN
COLOR:     PÉTALO 1
COLOR:     PÉTALO 2
COLOR:     PÉTALO 3
COLOR:     WASH
BEAM:      RAYO
```

Nunca `INTENSITY SECTION` ni `petal-1` literal. **F5 cerrado.**

---

## 5. 👻 Purga de Fantasmas (gating + null safety)

### 5.1 Tres líneas de defensa

| # | Capa | Mecanismo |
|---|---|---|
| **D1** | `useAggregatedCapabilityCells` | Excluye groups con `cellKeys.length === 0` (ya implementado en `useAggregatedCapabilityCells.ts:27`). |
| **D2** | `SECTION_REGISTRY` | Family no registrada → `null`. Reemplaza el `default` opaco. |
| **D3** | `contract.canRender(group, override)` | Decisión semántica por sección. **Aquí se mata el Kinetic fantasma.** |

### 5.2 Tabla de gating por familia

| Familia | `canRender` retorna `true` cuando… |
|---|---|
| **IMPACT** | siempre que haya cellKeys. (Permitir manual desde 0 es válido.) |
| **COLOR** | siempre que haya cellKeys. |
| **BEAM** | hay override activo (`gobo/prism/focus/zoom/iris`) **O** el role ∈ `{beam, decoration}`. Esto evita acordeones BEAM en fixtures que no tienen óptica. |
| **KINETIC** | hay override `rotation` activo **O** role === `rotor`. Pan/tilt/speed → KineticsCathedral. |
| **ATMOSPHERE** | hay al menos un canal phantom resoluble. **Delegado al `ExtrasAggregator` (§8); el contract de ATMOSPHERE retorna siempre `false` para que el router NO lo pinte como sección autónoma.** |

### 5.3 ¿Y los grupos con override pero sin descriptor (carrera)?

`useCapabilityCells` puede registrar un device antes de que el override exista,
o viceversa. La protección F6 se cubre en `CellAccordion`:

```tsx
const safeCtx = useMemo<CapabilityContext>(() => ({
  cellKey:   group.cellKeys[0],
  family:    group.family,
  nodeIds:   group.nodeIds,
  deviceId:  cellKeyDeviceId(group.cellKeys[0]),
  fixtureId: cellKeyDeviceId(group.cellKeys[0]),
  role:      group.role,
  label:     group.label,
  cellIndex: 0,
}), [group])
```

Sin payload, el body de la section lee `ov?.payload.data ?? {}` y muestra el
slider en estado "neutro" (sin badge MANUAL). El operador puede mover el slider
y eso CREA el override — comportamiento ya existente y correcto.

---

## 6. 🧩 Compound Component — `<CellAccordion>`

### 6.1 Diseño

Un único componente provee header (icon + title + sublabel + neon + release-btn
+ toggle chevron) y un slot para el body de la section. **Cero duplicación entre
secciones.**

```tsx
// @/electron-app/src/components/hyperion/controls/CellAccordion.tsx (nuevo)

export interface CellAccordionProps {
  group:       AggregatedCellGroup
  contract:    SectionContract
  isExpanded:  boolean
  onToggle:    () => void
  override:    CellOverride | undefined
}

export const CellAccordion: React.FC<CellAccordionProps> = ({
  group, contract, isExpanded, onToggle, override,
}) => {
  const neonColor = ROLE_NEON[group.role] ?? ROLE_NEON.unknown
  const ctx = useStableContext(group)
  const peerCellKeys = group.cellKeys.length > 1 ? group.cellKeys.slice(1) : undefined

  // Hive Mind release: dispara releaseCell sobre TODAS las cellKeys del grupo.
  const handleRelease = useCallback(() => {
    const store = useProgrammerStore.getState()
    for (const k of group.cellKeys) store.releaseCell(k)
  }, [group.cellKeys])

  const hasOverride = override !== undefined
  const Body        = contract.Body

  return (
    <section
      className={cls('cell-accordion', `family-${group.family.toLowerCase()}`, {
        expanded:  isExpanded,
        collapsed: !isExpanded,
        'has-override': hasOverride,
      })}
      style={{ '--neon-base': neonColor } as React.CSSProperties}
      data-group-key={group.groupKey}
    >
      <header className="cell-accordion-header" onClick={onToggle}>
        <span className="cell-accordion-chevron">{isExpanded ? '▼' : '▶'}</span>
        <contract.Icon size={18} className="title-icon" />
        <h4 className="cell-accordion-title">
          {contract.title}
          <span className="cell-accordion-sublabel">: {ctx.label.toUpperCase()}</span>
          {group.cellCount > 1 && (
            <span className="cell-accordion-count">×{group.cellCount}</span>
          )}
        </h4>

        {hasOverride && (
          <button
            className="release-btn"
            onClick={(e) => { e.stopPropagation(); handleRelease() }}
            title="Release manual override"
          >↺</button>
        )}
      </header>

      {isExpanded && (
        <div className="cell-accordion-body">
          <Body ctx={ctx} peerCellKeys={peerCellKeys} isExpanded={isExpanded} />
        </div>
      )}
    </section>
  )
}
```

### 6.2 Refactor de las 4 sections

Cada `*Section` se descompone en dos exports:

- `IntensitySectionBody` (sin header — solo sliders, presets, etc.) — el componente que entra en el slot.
- `IntensitySectionContract` — el contrato declarativo que el registry usa.

El export `IntensitySection` original se conserva como **alias deprecado** que
internamente envuelve `<CellAccordion>` por una wave (compatibilidad con
`DeviceCellGroup` legacy si todavía vive en disco). Se elimina en 4734-G.

### 6.3 ROLE_NEON consolidado

Un único módulo:

```ts
// @/electron-app/src/components/hyperion/controls/roleNeon.ts (nuevo)
export const ROLE_NEON: Readonly<Record<string, string>> = Object.freeze({
  master:     '#ff3366',
  primary:    '#ff3366',
  wash:       '#36d1ff',
  petal:      '#d946ef',
  beam:       '#facc15',
  rotor:      '#22c55e',
  ambient:    '#8b5cf6',
  percussion: '#22c55e',
  decoration: '#facc15',
  atmosphere: '#8b5cf6',
  pixel:      '#36d1ff',
  unknown:    '#94a3b8',
})
```

Borrar las copias de `TheProgrammer.tsx:36-44` y `DeviceCellGroup.tsx:31-44`.

---

## 7. 🔀 Híbridos: cuando una célula mezcla familias

### 7.1 Caso real (Tungsten Petal)

JSON del compilador Forge (WAVE 4732):

```jsonc
{ "id":"out-red-3",   "config":{ "channelType":"red",   "aetherNodeId":"petal-1" } },
{ "id":"out-green-4", "config":{ "channelType":"green", "aetherNodeId":"petal-1" } },
{ "id":"out-blue-5",  "config":{ "channelType":"blue",  "aetherNodeId":"petal-1" } },
{ "id":"out-dim-6",   "config":{ "channelType":"dimmer","aetherNodeId":"petal-1" } }   // ⚠️ dimmer DENTRO de cell COLOR
```

`NodeExtractionPipeline` agrupa los 4 canales en UNA `ICapabilityNode` cuya
`family` = COLOR (mayoritaria). El `dimmer` queda como canal del nodo pero
`ColorSection` no lo expone → **F2**.

### 7.2 Decisión arquitectónica: NO componente híbrido

Crear un `<HybridColorImpactSection>` rompe la pureza del registry y lleva a una
explosión combinatoria (`Color+Impact`, `Color+Beam`, `Beam+Impact`…).

**Solución preferida: Sub-rows inyectables.** Cada `*SectionBody` consulta su
override y renderiza extras según los canales presentes:

```tsx
// ColorSectionBody — extender al final del JSX existente:
{data.dimmer !== undefined && (
  <InlineImpactRow
    cellKey={ctx.cellKey}
    peerCellKeys={peerCellKeys}
    channel="dimmer"
    label="Cell Dimmer"
    value={Math.round(data.dimmer * 100)}
  />
)}
```

`InlineImpactRow` es un **mini-componente reutilizable** que dispara
`setCellImpact(cellKey, 'dimmer', percent)` (el setter ya existe en el store —
WAVE 4724). Aplica también para `strobe` y `shutter` si aparecen embebidos.

### 7.3 Reglas para sub-rows

| Familia base de la cell | Sub-rows aceptados |
|---|---|
| COLOR | `dimmer`, `strobe`, `shutter` |
| BEAM  | `dimmer` (algunos beams traen dimmer dedicado) |
| IMPACT | — (Intensity ya cubre todo el dominio) |
| KINETIC | — (rotation only; pan/tilt no son extras) |
| ATMOSPHERE | gestionado por ExtrasAggregator |

**Ventaja:** la sección sigue siendo "puramente COLOR" en intención visual; la
fila inferior es un bonus cuando el JSON lo requiere. No se fuerza a Tungstens
de 19 canales a parecer una IMPACT section.

---

## 8. 📦 ExtrasSection v2 — el cajón ordenado

### 8.1 Problema F4

`@/electron-app/src/components/hyperion/controls/ExtrasSection.tsx` (535 LOC)
existe pero está **desconectado**. Resuelve canales phantom leyendo del
`stageStore`/`libraryStore` por su cuenta — duplicando trabajo del pipeline.

### 8.2 Diseño objetivo: `<ExtrasAggregator>`

Componente que recoge **todo** lo que el router descartó por `canRender`
retornar `false`, **más** todas las cells de familia ATMOSPHERE, **más** los
canales `custom/macro/control/speed/rotation` que no entraron en ninguna cell
(orphan channels). Renderiza un único acordeón con sub-grupos.

```tsx
// @/electron-app/src/components/hyperion/controls/ExtrasAggregator.tsx (nuevo)

export interface ExtrasAggregatorProps {
  groups: readonly AggregatedCellGroup[]
}

export const ExtrasAggregator: React.FC<ExtrasAggregatorProps> = ({ groups }) => {
  // 1) Cells ATMOSPHERE explícitas.
  const atmosphereGroups = groups.filter(g => g.family === NodeFamily.ATMOSPHERE)

  // 2) Canales phantom orfanos (no asignados a cell). Reusa la lógica
  //    existente de ExtrasSection.tsx — sólo se enchufa al pipeline.
  const orphanPhantoms = useOrphanPhantomChannels()   // hook nuevo, §8.4

  if (atmosphereGroups.length === 0 && orphanPhantoms.length === 0) return null

  return (
    <CellAccordion.Generic
      title="EXTRAS"
      sublabel={`${atmosphereGroups.length + orphanPhantoms.length} channels`}
      iconColor={ROLE_NEON.atmosphere}
    >
      {atmosphereGroups.map(g => (
        <AtmosphereCellRow key={g.groupKey} group={g} />
      ))}
      {orphanPhantoms.map(p => (
        <PhantomChannelRow key={`${p.fixtureId}:${p.channelIndex}`} phantom={p} />
      ))}
    </CellAccordion.Generic>
  )
}
```

### 8.3 Sub-componentes

- **`AtmosphereCellRow`**: una fila por cell ATMOSPHERE con label + slider 0-100% que dispara `setCellAtmosphere` (setter genérico — añadir si no existe). Maneja Hive Mind via `peerCellKeys`.
- **`PhantomChannelRow`**: la fila por canal phantom orfano. Es la lógica actual de `ExtrasSection.tsx:220-470` extraída y simplificada. Dispara `window.lux.aether.setManual()` directamente como hoy (no hay store para canales orfanos).

### 8.4 Hook `useOrphanPhantomChannels`

Reusa el path de resolución existente (PATH 1/1.5/2 documentado en
`ExtrasSection.tsx:7-15`). Contrato:

```ts
export interface OrphanPhantom {
  fixtureId:        string
  fixtureName:      string
  channelIndex:     number
  label:            string
  type:             'custom' | 'macro' | 'control' | 'speed' | 'rotation'
  defaultValue:     number
  continuousRotation: boolean
}

export function useOrphanPhantomChannels(): readonly OrphanPhantom[]
```

Filtro: cualquier canal del fixture seleccionado cuyo `type` esté en
`PHANTOM_CHANNEL_TYPES` Y que NO aparezca en ninguna `cellKeys` de
`aggregatedGroups`. Los que SÍ aparecen ya los maneja su section.

### 8.5 Migración del `ExtrasSection.tsx` actual

- Extraer `PhantomChannelRow` desde `ExtrasSection.tsx:220-470` a archivo propio.
- Extraer la cascada de resolución (paths 1/1.5/2) al hook
  `useOrphanPhantomChannels`.
- El archivo `ExtrasSection.tsx` se mantiene como wrapper deprecado que delega
  en `<ExtrasAggregator>` durante 1 wave; eliminado en 4734-G.

---

## 9. Reglas de UX (no regresar)

> ⚠️ **PROHIBICIONES EXPLÍCITAS** — leídas de la directiva del operador.

| # | Regla | Razón |
|---|---|---|
| **R1** | **NO** reintroducir `PositionSection` separada en CONTROLS. | Pan/tilt viven en `KineticsCathedral`. CONTROLS es para color/intensidad/óptica + rotation cuando aplica. |
| **R2** | **NO** reintroducir `Fan Mode` ni `Spread` controls en la sidebar. | Eliminados en waves anteriores. Se controlan desde la Cathedral. |
| **R3** | El espacio liberado es exclusivo para que los **acordeones multi-célula respiren** (Tungsten = 9 acordeones). Padding/margin generoso entre cells, sub-rows con indentación clara. |
| **R4** | Solo UN acordeón abierto a la vez (modo exclusivo, ya implementado en `TheProgrammer.tsx:111-116`). Mantener. |
| **R5** | El header de cada acordeón muestra `${title.toUpperCase()}: ${label.toUpperCase()}` con icono + neon dot por role. **Nunca** solo `INTENSITY SECTION` sin sublabel. |
| **R6** | El badge `×N` aparece a la derecha del título cuando `cellCount > 1` (Hive Mind multi-fixture). |
| **R7** | El `ExtrasAggregator` va SIEMPRE al final del listado, después de toda cell estructurada. Acordeón colapsado por defecto. |

---

## 10. Roadmap

| Fase | Alcance | LOC aprox | Riesgo | Dependencias |
|---|---|---|---|---|
| **4734-A** | Crear `cellRouting.ts` + `SECTION_REGISTRY` + 4 contratos. Sin tocar JSX aún. | 200 | Bajo | — |
| **4734-B** | `<CellAccordion>` compound + `roleNeon.ts` consolidado. Refactor las 4 sections en `*Body` + `*Contract`. | 600 | Medio | A |
| **4734-C** | `<CellRouter>` reemplaza el switch en `TheProgrammer.tsx`. F1+F3 cerrados (gating canRender). | 150 | Medio | B |
| **4734-D** | `InlineImpactRow` + sub-rows en `ColorSectionBody`/`BeamSectionBody`. F2 cerrado. | 200 | Bajo | B |
| **4734-E** | `useOrphanPhantomChannels` hook + extracción de `PhantomChannelRow`. | 250 | Medio | — |
| **4734-F** | `<ExtrasAggregator>` + `AtmosphereCellRow` + integración en `<CellRouter>`. F4 cerrado. | 300 | Medio | C, E |
| **4734-G** | Deprecación: borrar `ExtrasSection.tsx` legacy y `DeviceCellGroup.tsx`. Limpiar alias. | -800 | Bajo | F |
| **4734-H** | Pipeline label resolution: implementar `_buildLabelFor` + `WELL_KNOWN_LABELS`. F5 cerrado. | 100 | Bajo | — (puede ir en paralelo) |

Cada fase es PR independiente. **Total LOC neto:** ≈ +1000 / -800 = +200 LOC
con eliminación significativa de duplicación.

---

## 11. Definition of Done

WAVE 4734 está **HECHA** cuando:

1. ✅ Tungsten 19-canal cargado en stage muestra **exactamente** los acordeones esperados:
   - `INTENSITY: GOLDEN` (dimmer + shutter + strobe)
   - `INTENSITY: STAIN` (dimmer)
   - `COLOR: PÉTALO 1` (RGB + sub-row Cell Dimmer)
   - `COLOR: PÉTALO 2` (RGB + sub-row Cell Dimmer)
   - `COLOR: PÉTALO 3` (RGB + sub-row Cell Dimmer)
   - `COLOR: WASH` (RGBW)
   - `BEAM: RAYO` (focus + zoom)
   - `EXTRAS` (1 acordeón con orfanos si los hay)
   - **Sin** acordeón Kinetic vacío (F1 cerrado).
2. ✅ Ningún canal del fixture queda invisible en la UI (auditable: contar canales del JSON vs canales accesibles desde la UI).
3. ✅ Seleccionar 10 PARs muestra UN solo acordeón `INTENSITY: MASTER ×10` + UN `COLOR: COLOR ×10` (Hive Mind preservado).
4. ✅ Header de cada acordeón muestra label semántico humano, **nunca** `petal-1` literal.
5. ✅ `ExtrasSection.tsx` legacy borrado. Toda la lógica phantom enchufada al pipeline.
6. ✅ `DeviceCellGroup.tsx` legacy borrado.
7. ✅ Single source of truth para `ROLE_NEON` (un único `roleNeon.ts`).
8. ✅ `tsc --noEmit` = 0 errores. `eslint`: sin nuevos warnings.
9. ✅ Cero regresión en flujo PAR/Moving Head clásico (smoke test manual + screenshot diff).

---

## Apéndice A — Diagrama de flujo de datos

```
┌─────────────────────────────────────────────────────────────────┐
│                        STAGE STORE                              │
│  showFile.fixtures[].profileId  →  LibraryStore[profileId]      │
│                                          │                      │
│                                          ▼                      │
│                              FixtureDefinition (con nodeGraph)  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                  NodeExtractionPipeline.extract()
                                 │
                                 ▼ ICapabilityNode[] con label semántico §4.2
                                 │
                                 ▼
                  useCapabilityCells(selectedIds)
                                 │
                                 ▼ DeviceCells[] (CellDescriptor por device)
                                 │
                                 ▼
              useAggregatedCapabilityCells(selectedIds)
                                 │
                                 ▼ AggregatedCellGroup[]
                                 │
                                 ▼
       <CellRouter groups={...} activeSection onToggleSection>
                                 │
            ┌────────────────────┼────────────────────────────┐
            │                    │                             │
            ▼                    ▼                             ▼
   for each group:    SECTION_REGISTRY[family]      <ExtrasAggregator
   contract.canRender   .Body  .Icon  .title          groups={all} />
            │           (Compound: <CellAccordion>)              │
            │                                                    ▼
            ▼                                          atmosphere groups +
   <CellAccordion>                                     useOrphanPhantomChannels
   header: title + label + neon                                │
   body: <contract.Body ctx peerCellKeys />                   ▼
            │                                          <PhantomChannelRow>
            ▼
   IntensitySectionBody | ColorSectionBody | BeamSectionBody | KineticSectionBody
            │
            ▼
   useProgrammerStore.cellOverrides → setCell{Color|Impact|Beam|Kinetic}
            │
            ▼
   ProgrammerAetherBridge → window.lux.aether.setManual @ 44Hz
```

---

## Apéndice B — Firmas TypeScript completas (para Sonnet)

```ts
// cellRouting.ts ────────────────────────────────────────────────────────────
import type { ComponentType } from 'react'
import type {
  AggregatedCellGroup, CapabilityContext, CellKey, CellOverride, NodeFamily,
} from '@/stores/programmer-types'

export interface SectionRenderProps<F extends NodeFamily> {
  ctx:           CapabilityContext<F>
  peerCellKeys?: readonly CellKey[]
  isExpanded:    boolean
}

export interface SectionContract<F extends NodeFamily = NodeFamily> {
  readonly family: F
  readonly title:  string
  readonly Icon:   ComponentType<{ size?: number; className?: string }>
  readonly Body:   ComponentType<SectionRenderProps<F>>
  canRender(group: AggregatedCellGroup, override: CellOverride | undefined): boolean
}

export const SECTION_REGISTRY: Readonly<Record<NodeFamily, SectionContract>>


// CellAccordion.tsx ─────────────────────────────────────────────────────────
export interface CellAccordionProps {
  group:      AggregatedCellGroup
  contract:   SectionContract
  isExpanded: boolean
  onToggle:   () => void
  override:   CellOverride | undefined
}
export const CellAccordion: React.FC<CellAccordionProps>

// Generic variant for ExtrasAggregator (sin contract):
export interface CellAccordionGenericProps {
  title:       string
  sublabel?:   string
  iconColor?:  string
  isExpanded?: boolean
  onToggle?:   () => void
  children:    React.ReactNode
}
CellAccordion.Generic: React.FC<CellAccordionGenericProps>


// CellRouter.tsx ────────────────────────────────────────────────────────────
export interface CellRouterProps {
  groups:          readonly AggregatedCellGroup[]
  activeSection:   string
  onToggleSection: (key: string) => void
}
export const CellRouter: React.FC<CellRouterProps>


// ExtrasAggregator.tsx ──────────────────────────────────────────────────────
export interface ExtrasAggregatorProps {
  groups: readonly AggregatedCellGroup[]
}
export const ExtrasAggregator: React.FC<ExtrasAggregatorProps>


// useOrphanPhantomChannels.ts ───────────────────────────────────────────────
export interface OrphanPhantom {
  fixtureId:          string
  fixtureName:        string
  channelIndex:       number
  label:              string
  type:               'custom' | 'macro' | 'control' | 'speed' | 'rotation'
  defaultValue:       number
  continuousRotation: boolean
}
export function useOrphanPhantomChannels(): readonly OrphanPhantom[]


// InlineImpactRow.tsx ───────────────────────────────────────────────────────
export interface InlineImpactRowProps {
  cellKey:       CellKey
  peerCellKeys?: readonly CellKey[]
  channel:       'dimmer' | 'strobe' | 'shutter'
  label:         string
  value:         number   // 0-100
}
export const InlineImpactRow: React.FC<InlineImpactRowProps>
```

---

*Master Blueprint Frontend — congelado en WAVE 4734.
Próximo paso: implementar 4734-A (`cellRouting.ts` + `SECTION_REGISTRY`).
WAVE 4730/4732 son precondiciones runtime. Backend + Forge están listos.*
