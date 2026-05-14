# AETHER MULTICELL MATRIX AUDIT — LuxSync V1.0-MC

**Auditor:** PunkOpus (Ingeniero Jefe, Sistemas Distribuidos & Latencia)  
**Fecha:** 2026-05-14  
**Alcance:** Pipeline end-to-end multicell desde `FixtureForgeEmbedded.tsx` (creación de perfiles) hasta `TheProgrammer.tsx` / `CellRouter.tsx` (UI de programación). Incluye la arquitectura de agrupación "Hive Mind" (WAVE 4730/4731), el compilador/descompilador híbrido (WAVE 4732), y el impacto del multicell en los claims de zero-alloc del core Aether.  
**Supersedes:** Parcialmente `AETHER-MATRIX-NODE-AUDIT.md` — todos los hallazgos de la auditoría original siguen vigentes salvo donde se indique lo contrario.  

**Archivos auditados:**
- `src/components/hyperion/forge/FixtureForgeEmbedded.tsx` (estado UI legacy)
- `src/core/forge/compileForgeState.ts` (compilador — WAVE 4732-E)
- `src/core/forge/decompileFromFixture.ts` (descompilador — WAVE 4732-F)
- `src/core/aether/ingestion/NodeExtractionPipeline.ts` (multicell path)
- `src/core/aether/NodeGraph.ts` (registro de nodos multicell)
- `src/core/aether/resolver/NodeResolver.ts` (hot path DMX — impacto multicell)
- `src/core/aether/resolver/AetherUIProjector.ts` (bridge UI legacy)
- `src/core/aether/resolver/AetherSafetyMiddleware.ts` (DarkSpin + ignition)
- `src/hooks/useCapabilityCells.ts` (extracción CellDescriptor)
- `src/hooks/useAggregatedCapabilityCells.ts` (duplicado del anterior)
- `src/components/hyperion/controls/TheProgrammer.tsx` (root del Programmer)
- `src/components/hyperion/controls/CellRouter.tsx` (routing de acordeones)
- `src/components/hyperion/controls/cellRouting.ts` (registry + gating)
- `src/components/hyperion/controls/cellLabels.ts` (resolución de labels)
- `src/components/hyperion/controls/ExtrasSection.tsx` (phantom channel resolver)
- `src/stores/programmerStore.ts` (cellOverrides + Hive Mind persistence)
- `WAVE-4732-FORGE-HYBRID-FINAL.md` (blueprint de referencia)

---

## Índice

1. [El Pipeline Multicell End-to-End](#1-el-pipeline-multicell-end-to-end)
2. [Zero-Alloc Audit — El Impacto del Multicell](#2-zero-alloc-audit--el-impacto-del-multicell)
3. [Data Flow Integrity — Roundtrip, Labels, Propagación](#3-data-flow-integrity--roundtrip-labels-propagación)
4. [Deficiencias Estructurales Críticas](#4-deficiencias-estructurales-críticas)
5. [Final Acquisition Score](#5-final-acquisition-score)

---

## 1. El Pipeline Multicell End-to-End

### 1.1 Diagrama de flujo completo

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  FORGE VIEW (React)                                                                      │
│  ┌──────────────┐  ┌─────────────────┐                                                   │
│  │ Tab DMX      │  │ Tab Aether      │                                                   │
│  │ Layout       │──│ Modules         │                                                   │
│  │ (channels[]) │  │ (cells[])       │                                                   │
│  └──────┬───────┘  └────────┬────────┘                                                   │
│         │                   │                                                            │
│         └─────────┬─────────┘                                                            │
│                   ▼                                                                      │
│         IForgeBuilderState  ←── reducer único, single source of truth                  │
│                   │                                                                      │
│                   ▼                                                                      │
│         compileForgeState(state)  ←── Fase A validación → Fase B ignition →              │
│                   │                  Fase C nodeGraph → Fase D ensamblaje            │
│                   ▼                                                                      │
│         FixtureDefinition  (JSON en disco)                                               │
│         ├─ channels[]     ←─ legacy, ignitionDeps con targetChannelIndex                 │
│         └─ nodeGraph      ←─ nuevo, output_dmx nodes con aetherNodeId                   │
│                   │                                                                      │
│                   ▼  (load / patch time)                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐           │
│  │  NODE EXTRACTION PIPELINE                                                  │           │
│  │  ├─ _buildNodesFromForgeGraph(fixture.nodeGraph)                           │           │
│  │  │   ├─ Agrupa output_dmx por aetherNodeId (fallback: _inferAetherSuffix) │           │
│  │  │   ├─ _mapForgeNodes(): IOutputDmxConfig[] → INodeChannelDef[]           │           │
│  │  │   └─ _buildForgeGroupNode() → ICapabilityNode (1 por grupo)             │           │
│  │  └─ _buildAllNodes() (fallback legacy sin nodeGraph)                       │           │
│  └──────────────────────────────────────────────────────────────────────────┘           │
│                   │                                                                      │
│                   ▼                                                                      │
│         NodeGraph.registerDevice(deviceId, nodes[])                                      │
│         ├─ Dense arrays por familia (_color[], _impact[], …)                             │
│         ├─ O(1) indices (slot, zone, role, device, defs)                                 │
│         └─ _rebuildViews() completo en cada register/unregister                          │
│                   │                                                                      │
│                   ▼  (44 Hz frame time)                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐           │
│  │  NODE RESOLVER                                                             │           │
│  │  ├─ resolve(arbitrated: ArbitratedNodeMap)                                 │           │
│  │  │   ├─ Zero-fill buffers                                                  │           │
│  │  │   ├─ _writeNode() por cada nodo                                         │           │
│  │  │   │   ├─ Forge bypass? → ForgeNodeEvaluator.evaluate()                  │           │
│  │  │   │   ├─ COLOR? → _translateColor() → object literal allocation        │           │
│  │  │   │   ├─ KINETIC? → clampKinetic + airbag + IK split-brain              │           │
│  │  │   │   └─ IMPACT/BEAM/ATMOSPHERE → direct write                         │           │
│  │  │   ├─ _applyDarkSpinCrossNodeSweep()                                     │           │
│  │  │   ├─ _applyIgnitionInjections()                                         │           │
│  │  │   └─ Ensamblar IDMXPacket[] (Uint8Array → number[] copy)              │           │
│  │  └─ AetherUIProjector.project() (UI legacy bridge)                       │           │
│  └──────────────────────────────────────────────────────────────────────────┘           │
│                   │                                                                      │
│                   ▼  (React render cycle)                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐           │
│  │  HYPERION VIEW (Frontend)                                                  │           │
│  │  ├─ useCapabilityCells(selectedIds)                                        │           │
│  │  │   └─ Devuelve DeviceCells[] (1 entry por fixture)                      │           │
│  │  ├─ useAggregatedCapabilityCells(selectedIds)                              │           │
│  │  │   └─ Agrupa por `${family}:${role}:${label}` → AggregatedCellGroup[]   │           │
│  │  ├─ CellRouter.tsx                                                         │           │
│  │  │   ├─ SECTION_REGISTRY[family] → RoutedCell                              │           │
│  │  │   └─ ExtrasAggregator → ATMOSPHERE + orphan phantoms                    │           │
│  │  └─ TheProgrammer.tsx                                                      │           │
│  │      ├─ Acordeones por AggregatedCellGroup                                 │           │
│  │      ├─ peerCellKeys dispatch (Hive Mind setter)                           ││
│  │      └─ releaseProgrammer / releaseKinetics (domain divorce)                ││
│  └──────────────────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Veredicto de cada etapa

| Etapa | Estado | Veredicto |
|---|---|---|
| **Forge UI** | WAVE 4732-A en progreso | Arquitectura de estado dual (DMX + Aether) es correcta. Reducer con invariantes declarativos. |
| **Compilador** | Implementado (`compileForgeState.ts`) | Puro, sincrónico, sin side-effects. Emite `nodeGraph` con `aetherNodeId`. |
| **Descompilador** | Implementado (`decompileFromFixture.ts`) | Ruta A (fiel) + Ruta B (heurística). `inferred` flag para banner de migración. |
| **Pipeline multicell** | Backend listo desde WAVE 4722 | `_buildNodesFromForgeGraph` agrupa correctamente por `aetherNodeId`. |
| **NodeGraph** | Sin cambios | Dense arrays absorben multicell sin modificación. `_rebuildViews()` sigue siendo O(N_total). |
| **NodeResolver** | Sin cambios para multicell | **Problema:** zero-alloc claims se rompen proporcionalmente al número de nodos COLOR. |
| **UI Projector** | Sin cambios | **Problema:** max-blend ciego de todos los nodos COLOR en `fixture.r/g/b`. No distingue pétalos de wash. |
| **Frontend Hive Mind** | WAVE 4731 implementado | `useAggregatedCapabilityCells` funciona correctamente. Duplicación de código detectada. |
| **Cell Router** | WAVE 4734 Batch 1 listo | `SECTION_REGISTRY` con gating es elegante. `ExtrasAggregator` desconectado hasta Batch 2. |

---

## 2. Zero-Alloc Audit — El Impacto del Multicell

La auditoría original (`AETHER-MATRIX-NODE-AUDIT.md:5.1`) ya documentaba que los claims de zero-alloc del `NodeResolver` eran **parcialmente falsos**. Con la arquitectura multicell, esos claims pasan de "parcialmente falsos" a **proporcionalmente destructivos**.

### 2.1 El factor de multiplicación multicell

Un fixture PAR legacy produce **2 nodos**: 1 COLOR + 1 IMPACT.  
Un fixture Tungsten (WAVE 4732 ejemplo canónico) produce **8 nodos**: 4 COLOR (3 pétalos + wash) + 2 IMPACT (golden + stain) + 1 BEAM + 1 KINETIC.

| Fixture | Nodos COLOR | Nodos IMPACT | Total nodos | Factor vs PAR |
|---|---|---|---|---|
| PAR RGBW | 1 | 1 | 2 | 1× |
| Moving head completo | 1 | 1 | 4 | 2× |
| Tungsten (Forja híbrida) | 4 | 2 | 8 | **4×** |
| Barra LED 12 píxeles | 12 | 0 | 12 | **6×** |

**Esto significa que cualquier alloc por nodo en el hot path se multiplica por 4× en el rig más común del usuario.**

### 2.2 `_translateColor` — El alloc que nadie arregló

```typescript
// NodeResolver.ts:1167-1175 (branch rgb — el más común)
case 'rgb':
default:
  return {
    ...original,           // ← spread = shallow copy (new object)
    [CH_RED]:   safeR,
    [CH_GREEN]: safeG,
    [CH_BLUE]:  safeB,
    [CH_R]:     safeR,
    [CH_G]:     safeG,
    [CH_B]:     safeB,
  }
```

La auditoría original ya lo marcó como **claim falso**. Ahora con multicell:

- **Legacy (1 nodo COLOR por fixture):** 50 fixtures × 1 nodo = 50 allocs/frame × 44Hz = **2.200 objetos/segundo**.
- **Multicell Tungsten (4 nodos COLOR por fixture):** 50 fixtures × 4 nodos = 200 allocs/frame × 44Hz = **8.800 objetos/segundo**.
- **Barra LED 12 píxeles:** 50 barras × 12 nodos = 600 allocs/frame × 44Hz = **26.400 objetos/segundo**.

El comentario del método dice: *"Esto es zero-alloc: reutilizamos _translatedChannelValues que es un objeto pre-allocated a nivel de función"*. **Esto es técnicamente falso.** El `_translatedChannelValues` no existe en el código actual; el método retorna un **nuevo objeto literal** en CADA branch del switch.

**Fix requerido:** Pre-allocar un `Record<string, number>` mutable a nivel de instancia (`this._translatedScratch`), escribir las propiedades calculadas, y retornar una referencia congelada o mutable según el contrato. El caller (`_writeNode`) debe copiar los valores que necesita, no el objeto entero.

### 2.3 `_aetherWheelToLegacy` — Alloc oculto en wheel/hybrid

```typescript
// NodeResolver.ts:1310-1319
private _aetherWheelToLegacy(wheel: ColorWheelDefinition): HalColorWheelDefinition {
  return {
    colors: wheel.slots.map(slot => ({          // ← new array + N objects
      dmx:  slot.dmxValue,
      name: slot.name,
      rgb:  { r: slot.previewRgb.r, g: slot.previewRgb.g, b: slot.previewRgb.b },  // ← N objects
    })),
    allowsContinuousSpin: false,
    minChangeTimeMs:      wheel.minTransitionMs,
  }
}
```

Este método se llama en CADA frame para cada nodo COLOR con `mixingType='wheel'` o `'hybrid'`. Con multicell, si 3 pétalos del Tungsten tienen wheel mecánica (ej. rueda de colores por pétalo), son 3× más allocs.

El comentario dice: *"El ColorTranslator tiene su propio LRU cache que absorbe la repetición"*. Pero el LRU cache solo absorbe la **traducción**, no la **conversión de formato**. `_aetherWheelToLegacy` se ejecuta ANTES de llegar al cache.

**Fix requerido:** Cachear la conversión por `ColorWheelDefinition` referencia o por hash de slots. La definición de rueda rara vez cambia en runtime.

### 2.4 `resolve()` — La copia Uint8Array → number[] sigue viva

```typescript
// NodeResolver.ts:455-459
const channels = packet.channels
for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
  channels[i] = buf[i]
}
```

La auditoría original ya lo marcó: 512 asignaciones por universo por frame. El multicell no aumenta el número de universos (un fixture sigue en un universo), así que este costo es **constante** respecto al multicell. Pero sigue siendo ~180K asignaciones/segundo con 8 universos.

**Fix requerido:** Cambiar `IDMXPacket.channels` a `Uint8Array` para permitir zero-copy desde `buf`. Rompería compatibilidad con código legacy que espera `number[]`, pero sería un refactor interno limpio.

### 2.5 `_applyDarkSpinCrossNodeSweep` — Complejidad multiplicada por nodos

```typescript
// Pseudo-código del sweep (NodeResolver.ts:732-791 simplificado)
for (const [nodeId, _] of transitNodes) {
  const deviceId = extractDeviceId(nodeId)
  const allDeviceNodes = this._graph.getDeviceNodes(deviceId)  // ← O(deviceNodes) cada vez
  const impactNodes = allDeviceNodes.filter(n => n.family === IMPACT)
  for (const impact of impactNodes) {
    // apaga dimmer/shutter de TODOS los IMPACT del device
  }
}
```

**El multicell rompe la semántica de DarkSpin.**

En un PAR legacy: 1 nodo COLOR + 1 nodo IMPACT. Si el COLOR entra en transit, DarkSpin apaga el único IMPACT. Correcto.

En un Tungsten multicell: 4 nodos COLOR (3 pétalos + wash) + 2 nodos IMPACT (golden + stain). Si el pétalo-1 entra en transit de rueda mecánica, DarkSpin:
1. Obtiene `deviceId` del nodo COLOR en transit.
2. Llama `getDeviceNodes(deviceId)` → devuelve **todos** los nodos del device (8 nodos).
3. Filtra por IMPACT → obtiene golden **Y** stain.
4. **Apaga AMBOS dimmers** (golden y stain).

**Esto es semánticamente incorrecto.** El cambio de color de un pétalo no debería apagar el dimmer master del fixture completo. El operador verá que toda la luz del Tungsten se apaga cada vez que un pétalo cambia de color wheel.

**Complejidad:** Con N fixtures multicell, cada uno con P pétalos y M nodos IMPACT, el sweep en el peor caso es **O(N × P × M)**. Para 50 Tungstens (4 pétalos, 2 IMPACT cada uno): 50 × 4 × 2 = **400 iteraciones por frame** solo para DarkSpin. Antes del multicell (1 pétalo, 1 IMPACT): 50 × 1 × 1 = 50 iteraciones. **8× más.**

### 2.6 Frontend — `useAggregatedCapabilityCells` alloc audit

```typescript
// hooks/useAggregatedCapabilityCells.ts:23-78
export function useAggregatedCapabilityCells(selectedIds: readonly string[]): AggregatedCellGroup[] {
  const deviceCells = useCapabilityCells(selectedIds)
  return useMemo(() => {
    // ...new Map(), Object.freeze([...g.cellKeys]), Object.freeze([...g.nodeIds])
  }, [deviceCells])
}
```

**Análisis de allocations por cambio de selección (no por frame):**
- `new Map<string, GroupEntry>()` → 1 alloc
- `entry = { family, role, label, cellKeys: [], nodeIds: [], deviceIds: new Set() }` → 1 alloc por grupo único
- `Object.freeze([...g.cellKeys])` → 1 array alloc + 1 freeze por grupo
- `Object.freeze([...g.nodeIds])` → 1 array alloc + 1 freeze por grupo

Para una selección de 50 Tungstens (~8 grupos por fixture, pero muchos comparten firma entre fixtures):
- Si todos son Tungstens idénticos: ~8 grupos × 4 allocs = **32 allocs** por cambio de selección.
- Si son 50 fixtures distintos sin superposición: ~50×8 = **400 grupos** × 4 allocs = **1.600 allocs**.

Este costo es **aceptable** porque ocurre en cambio de selección (evento de usuario), no en frame time. Pero la duplicación de esta función en `useCapabilityCells.ts:386-444` (idéntica en semántica, distinta en implementación) es **deuda de mantenimiento**.

### 2.7 `CellRouter` — Re-render completo en toggle

```typescript
// CellRouter.tsx:133-161
export const CellRouter: React.FC<CellRouterProps> = ({ groups }) => {
  const [activeSection, setActiveSection] = useState<string>('')
  const toggleSection = useCallback((key: string) => {
    setActiveSection(prev => (prev === key ? '' : key))
  }, [])

  return (
    <>
      {groups.map(group => (
        <RoutedCell
          key={group.groupKey}
          group={group}
          meta={meta}
          isExpanded={activeSection === group.groupKey}
          onToggle={() => toggleSection(group.groupKey)}
        />
      ))}
      <ExtrasAggregator groups={groups} />
    </>
  )
}
```

**Problema:** `activeSection` es un string en el componente padre. Cuando el operador abre un acordeón:
1. `setActiveSection('color:petal:Pétalo 1')` se ejecuta.
2. `CellRouter` re-renderiza.
3. **Todos** los `<RoutedCell>` re-renderizan (aunque la mayoría reciban `isExpanded=false`).
4. `<ExtrasAggregator>` recibe `groups` completo y también re-renderiza.

Con 50 Tungstens seleccionados, esto son ~40-50 `<RoutedCell>` + 1 `<ExtrasAggregator>` que re-renderizan en CADA toggle. React puede optimizar con `React.memo` en `RoutedCell`, pero no hay evidence de que esté aplicado.

**Fix requerido:**
- `RoutedCell` debe estar envuelto en `React.memo`.
- `ExtrasAggregator` debería recibir solo `atmosphereGroups` + `orphans`, no `groups` completo.
- Considerar `useRef` o un store externo para el estado de acordeón si la lista es grande.

### 2.8 Resumen de zero-alloc en el mundo multicell

| Claim | Estado real (original) | Impacto multicell | Gravedad |
|---|---|---|---|
| `_translateColor` zero-alloc | ❌ Falso. Nuevo objeto literal cada frame. | **4× más objetos** por fixture Tungsten. | **ALTA** |
| `_aetherWheelToLegacy` "absorbido por LRU" | ❌ Falso. Conversión ocurre antes del cache. | **3× más conversiones** si múltiples pétalos usan wheel. | MEDIA |
| `resolve()` buffer copy | ❌ Falso. 512 asignaciones/universo/frame. | Constante (no empeora). | MEDIA |
| DarkSweep sweep | ⚠️ O(transit × deviceNodes). | **8× más iteraciones** + **apaga IMPACT equivocados**. | **CRÍTICA** |
| Frontend aggregation | ✅ Aceptable. Memoizado por selección. | Más grupos → más allocs en cambio de selección. | BAJA |
| CellRouter re-render | ❌ No optimizado. Re-render completo en toggle. | Más acordeones → peor. | MEDIA |

---

## 3. Data Flow Integrity — Roundtrip, Labels, Propagación

### 3.1 Roundtrip `compile → decompile → compile`

El blueprint (§8.2) declara:

```
decompileFromFixture(compileForgeState(state).fixture).state ≡ state
```

**Veredicto: Teóricamente cierto. Prácticamente frágil.**

**Fragilidades identificadas:**

1. **`uiPosition` se pierde** — documentado en el blueprint como "metadata UX no se compila". El roundtrip pierde datos.
2. **`customLabel` viaja por `profileMeta`** — un campo no declarado en el schema JSON del fixture:
   ```typescript
   // NodeExtractionPipeline.ts:577-580
   nodes.push(
     group.customLabel
       ? ({ ...node, profileMeta: { ...node.profileMeta, customLabel: group.customLabel } })
       : node,
   )
   ```
   Esto inyecta `customLabel` en un `Record<string, unknown>` que el JSON serializer puede o no persistir dependiendo de `JSON.stringify` behavior con campos undefined. Si `profileMeta` no está en el schema del `FixtureDefinition`, el campo puede **silenciosamente desaparecer** en el roundtrip JSON → disco → JSON.
3. **Heurística de `role` en descompilador** — `suffixToRole` usa hardcoded mapping. Si el operador crea un `cellId` inesperado (`'fx-1'`), el descompilador asigna `'primary'`. Al recompilar, el `nodeGraph` sigue emitiendo el `cellId` original, pero el `role` cambiado puede afectar gating en UI.

### 3.2 Label Propagation — De la Forja al Header del Acordeón

El flujo completo de un label personalizado (ej: "Pétalo Izquierdo"):

```
IForgeCellBuilder.label
    ↓ compileForgeState
IOutputDmxConfig.aetherNodeId + IForgeNode.label
    ↓ JSON en disco
FixtureDefinition.nodeGraph.nodes[].config.aetherNodeId + nodes[].label
    ↓ NodeExtractionPipeline._buildNodesFromForgeGraph
Map<string, ForgeGroup> customLabel
    ↓ inyección en ICapabilityNode.profileMeta.customLabel
    ↓ NodeGraph.registerDevice
NodeGraph dense arrays
    ↓ useCapabilityCells (hot path de React)
node.profileMeta?.['customLabel']   ← INDEX ACCESS TYPE-UNSAFE
    ↓ suffixToLabel
CellDescriptor.label
    ↓ useAggregatedCapabilityCells
AggregatedCellGroup.label
    ↓ buildSectionHeaderText (WAVE 4737)
{ title, sublabel, isCustom }
    ↓ CellRouter / TheProgrammer
Header del acordeón: "COLOR: PÉTALO IZQUIERDO" o "PÉTALO IZQUIERDO" (purista)
```

**Problema crítico en `node.profileMeta?.['customLabel']`:**

```typescript
// hooks/useCapabilityCells.ts:197
const _customLabel = node.profileMeta?.['customLabel']
```

Esto es **index access con string literal** sobre un `Record<string, unknown>`. No hay type safety. Si el campo se renombra en el pipeline, el frontend no detecta el error en compile-time. El campo no está declarado en `ICapabilityNode` ni en `INodeData`.

**Fix requerido:** Declarar `customLabel?: string` como campo opcional tipado en `ICapabilityNode` o `INodeData`.

### 3.3 `suffixToLabel` — Lookup por string en hot path de UI

```typescript
// hooks/useCapabilityCells.ts:153-162
function suffixToLabel(suffix: string, family: NodeFamily): string {
  if (['color','impact','kinetic','beam','atmosphere'].includes(suffix)) {
    return FAMILY_DEFAULT_LABEL[family]
  }
  const wellKnown = WELL_KNOWN_LABELS[suffix.toLowerCase()]  // ← O(N) string search en Set implícito
  if (wellKnown !== undefined) return wellKnown
  return suffix.replace(/-(\d+)$/, ' $1').replace(/\b\w/g, c => c.toUpperCase())
}
```

`WELL_KNOWN_LABELS` es un objeto plano (hash map O(1)), así que el lookup es eficiente. Pero `includes(suffix)` en un array de 5 strings es O(5) — aceptable pero mejorable con un `Set`.

El problema real es que esta función se ejecuta en **useCapabilityCells**, que se re-ejecuta cuando cambia `selectedIds`, `stageFixtures`, o `libraryStore.lastLoadTime`. No es frame-critical, pero con 400+ nodos la suma de `replace` regex + `toLowerCase()` + `toUpperCase()` puede ser perceptible en selección masiva.

### 3.4 `GENERIC_AUTO_LABELS` — Hardcoded coupling entre frontend y backend

```typescript
// cellLabels.ts:150-158
const GENERIC_AUTO_LABELS = new Set([
  'Intensidad', 'Color', 'Cinética', 'Haz', 'Extras',
])
```

Este `Set` decide si un label es "genérico de familia" (mostrar `FAMILIA: LABEL`) o "semántico personalizado" (mostrar solo `LABEL`). Pero los valores deben coincidir **exactamente** con `FAMILY_DEFAULT_LABEL` en `useCapabilityCells.ts:145-151`. Si un desarrollador cambia uno y olvida el otro, el header del acordeón cambia de formato silenciosamente.

**Fix requerido:** Exportar `FAMILY_DEFAULT_LABEL` como fuente única de verdad y generar `GENERIC_AUTO_LABELS` a partir de él en build-time o module init.

---

## 4. Deficiencias Estructurales Críticas

### 4.1 DarkSpin Sweep — Apagón indiscriminado en multicell (SEVERIDAD: CRÍTICA)

**Problema:** `_applyDarkSpinCrossNodeSweep` no tiene concepto de "nodo COLOR asociado a nodo IMPACT". Opera a nivel de `deviceId`.

**Impacto:** En un Tungsten, si un pétalo cambia de color wheel, **todos** los dimmers del fixture (golden Y stain) se apagan. El operador ve un blackout completo cuando solo debería ver un pétalo oscurecido durante el transit.

**Fix requerido:** Añadir una relación explícita `colorNodeId → impactNodeId` en `ICapabilityNode` (ej. `masterImpactNodeId?: NodeId`). DarkSpin debe usar esta relación en lugar de escanear todos los IMPACT del device. Esto requiere que el compilador de la Forja declare cuál nodo IMPACT es el "master" de cada nodo COLOR (o grupo de nodos COLOR).

**Alternativa rápida:** Si un fixture tiene múltiples nodos IMPACT, DarkSpin debería SOLO afectar al nodo IMPACT que comparte canales de ignition con el nodo COLOR en transit. Pero esto requiere analizar `ignitionDeps` en runtime, lo cual es complejo.

### 4.2 AetherUIProjector — Max-blend ciego (SEVERIDAD: ALTA)

```typescript
// AetherUIProjector.ts:138-141 (branch no-atmospheric)
fixture.r = Math.max(fixture.r, projectedR)
fixture.g = Math.max(fixture.g, projectedG)
fixture.b = Math.max(fixture.b, projectedB)
```

En un fixture multicell con 4 nodos COLOR, el projector max-blendea TODOS los pétalos + wash en un único `fixture.r/g/b`. El resultado es correcto para la preview visual (lo que se ve en el stage), pero el operador no puede distinguir:
- ¿Qué pétalo está emitiendo el rojo?
- ¿Por qué el wash no reacciona al slider de "Pétalo 1"?

**Esto no es un bug del projector** (su trabajo es proyectar, no desagregar). Es una **deficiencia de la UI legacy** que asume 1 fixture = 1 color. La arquitectura multicell del frontend (Hive Mind) resuelve esto en `TheProgrammer.tsx`, pero cualquier otra pantalla que lea `fixture.r/g/b` (preview 3D, visualizador de stage, DMX monitor) seguirá viendo un color plano mezclado.

**Fix requerido:** Documentar que `FixtureState.r/g/b` es un "color consolidado" en fixtures multicell. Para debugging, exponer los valores por nodo COLOR en una estructura paralela (`fixture.cellColors?: Record<CellId, {r,g,b}>`).

### 4.3 Duplicación de `useAggregatedCapabilityCells` (SEVERIDAD: MEDIA)

Existen **dos implementaciones** de la misma función en dos archivos distintos:

1. `src/hooks/useAggregatedCapabilityCells.ts` (standalone, 78 líneas)
2. `src/hooks/useCapabilityCells.ts:386-444` (inline, 59 líneas)

Ambas tienen la misma firma y semántica. `TheProgrammer.tsx` importa desde `useAggregatedCapabilityCells.ts`. La versión inline en `useCapabilityCells.ts` parece ser código residual de desarrollo.

**Fix requerido:** Eliminar la versión inline de `useCapabilityCells.ts` y mantener solo `useAggregatedCapabilityCells.ts`.

### 4.4 `renderKineticIfContinuous` — workaround sobre workaround (SEVERIDAD: MEDIA)

```typescript
// cellRouting.ts (WAVE 4737 añadido por el usuario)
const renderKineticIfContinuous: CellGatePredicate = (group, override) => {
  if (group.cellKeys.length === 0) return false
  if (group.role === 'rotor' || group.role === 'percussion') return true
  // ...
}
```

El pipeline original asignaba `role='rotor'` a nodos de rotación continua. WAVE 4737 descubrió que el `NodeExtractionPipeline` asigna `'percussion'` a rotación continua (`isContinuous = !hasPanTilt && hasRotation`). En vez de corregir el pipeline para que use `'rotor'` consistentemente, se añadió un OR en el gating del frontend.

**Fix requerido:** Unificar el rol en el pipeline. `'rotor'` debe ser el nombre canónico. `'percussion'` debe mapearse a `'rotor'` en `suffixToRole` o en el pipeline mismo. El frontend no debería saber de esta dualidad.

### 4.5 `ExtrasAggregator` recibe `groups` completo (SEVERIDAD: BAJA-MEDIA)

```typescript
// CellRouter.tsx:157-158
<ExtrasAggregator groups={groups} />
```

`ExtrasAggregator` filtra internamente `groups` para encontrar `NodeFamily.ATMOSPHERE` y luego mergea con `orphanPhantoms`. Esto significa que en cada render recorre TODO el array de grupos.

Con 50 Tungstens (40 grupos) esto es 40 iteraciones × 60Hz de React = 2.400 iteraciones/segundo. No es crítico, pero es **waste estructural**.

**Fix requerido:** `partitionGroupsForRouting` (ya implementado en `cellRouting.ts`) debería ejecutarse en `CellRouter` y pasar `atmosphereGroups` + `orphanPhantoms` directamente a `ExtrasAggregator`.

### 4.6 `targetDmxOffset` vs `targetChannelIndex` — nomenclatura inconsistente (SEVERIDAD: BAJA)

En el compilador (`compileForgeState.ts`):
```typescript
ignitionDeps: ch.ignitionDeps.map(d => ({
  targetChannelIndex: d.targetChannelIndex,
  // ...
}))
```

En el pipeline (`NodeExtractionPipeline.ts:606`):
```typescript
...(dep.targetChannelIndex !== undefined && { targetDmxOffset: dep.targetChannelIndex })
```

El compilador emite `targetChannelIndex`. El pipeline lo renombra a `targetDmxOffset`. El `NodeResolver._precomputeIgnitionMap` consume `targetDmxOffset`. El `FixtureDefinition` usa `targetChannelIndex`.

Esto es una **renombración silenciosa** en el pipeline. Funciona, pero dificulta el debugging (grep por `targetChannelIndex` no encuentra el consumo en el resolver).

**Fix requerido:** Usar `targetChannelIndex` consistentemente en todo el stack. El offset DMX es siempre el índice del canal dentro del fixture (0-based).

### 4.7 `fixtureOverrides` en `programmerStore` — clave por cellKey (SEVERIDAD: BAJA)

El store usa `Map<CellKey, CellOverride>` donde `CellKey = '${deviceId}:${aetherSuffix}'`. Esto es correcto para multicell. Sin embargo, `releaseProgrammer()` limpia overrides "no cinéticos" basándose en el payload.family. Si un fixture tiene múltiples nodos IMPACT (golden + stain) y el operador hace release, ambos se limpian juntos. No hay granularidad de release por cell.

**Esto no es un bug** — es una decisión de diseño. Pero el operador no puede releasear "solo el golden dimmer" sin releasear "el stain dimmer".

---

## 5. Final Acquisition Score

### 5.1 Fortalezas verificables del multicell

1. **Compilador/Descompilador puro:** `compileForgeState` y `decompileFromFixture` son funciones puras, sincrónicas, testeables. El roundtrip `compile ∘ decompile` es idempotente (salvo metadata UX).
2. **NodeExtractionPipeline multicell:** `_buildNodesFromForgeGraph` agrupa correctamente por `aetherNodeId` y maneja fallback por `channelType`. La ruta de extracción es robusta.
3. **Hive Mind aggregation:** `useAggregatedCapabilityCells` produce grupos estables con `Object.freeze`. La firma `${family}:${role}:${label}` permite multi-edit pro limpio.
4. **Cell Router declarativo:** `SECTION_REGISTRY` con `SectionMeta` + gating predicates es un patrón elegante que elimina switch statements dispersos.
5. **Label propagation funciona:** A pesar del type-unsafety de `profileMeta`, el label custom de la Forja llega al header del acordeón en Hyperion.
6. **Domain divorce en programmerStore:** `releaseProgrammer` vs `releaseKinetics` permite limpiar dominios separadamente sin afectar overrides de movimiento.
7. **Aduana de tipos:** `CELL_TYPE_ADMITTANCE` es exhaustiva sobre los 30 `ChannelType`. Triple validación (drag-over, drop, reducer) garantiza integridad.

### 5.2 Debilidades críticas

1. **`_translateColor` alloc multiplicado por 4×.** El claim zero-alloc es falso y el multicell lo empeora proporcionalmente.
2. **DarkSpin sweep roto en multicell.** Apaga todos los IMPACT del device cuando cualquier nodo COLOR entra en transit. No distingue pétalos.
3. **AetherUIProjector max-blend ciego.** Los pétalos adicionales son invisibles para la UI legacy; cualquier preview fuera de Hyperion muestra un color plano mezclado.
4. **Duplicación de `useAggregatedCapabilityCells`.** Dos implementaciones idénticas en archivos distintos.
5. **`profileMeta?.['customLabel']` type-unsafe.** Index access a metadata bag sin type checking.
6. **`GENERIC_AUTO_LABELS` hardcoded.** Acoplamiento silenciente con `FAMILY_DEFAULT_LABEL` del hook.
7. **CellRouter re-render completo.** Sin `React.memo` en `RoutedCell`, cada toggle re-renderiza todos los acordeones.
8. **`renderKineticIfContinuous` como parche.** Frontend compensa una inconsistencia de nomenclatura del pipeline (`rotor` vs `percussion`).

### 5.3 Puntaje técnico final

**Puntaje técnico: 7.0/10** (down from 7.8/10 de la auditoría original)

| Subsistema | Puntaje | Notas |
|---|---|---|
| Forge Hybrid Compiler / Decompiler | 8.0/10 | Puro, idempotente, bien estructurado. Penaliza por allocations en fase de emisión del nodeGraph y pérdida de `uiPosition`. |
| NodeExtractionPipeline (multicell path) | 8.5/10 | Agrupación correcta por `aetherNodeId`. Penaliza por inyección type-unsafe de `customLabel` en `profileMeta`. |
| NodeGraph (dense arrays + índices) | 9.0/10 | Sin cambios. Absorbe nodos multicell sin modificación. `_rebuildViews()` sigue siendo O(N_total). |
| NodeResolver (hot path DMX) | 5.5/10 | Zero-alloc claim completamente roto por `_translateColor`. DarkSpin sweep broken en multicell. `_aetherWheelToLegacy` alloc no cacheado. |
| AetherUIProjector (legacy bridge) | 6.0/10 | Max-blend ciego de múltiples nodos COLOR. Los pétalos son invisibles individualmente. |
| AetherSafetyMiddleware (DarkSpin) | 5.5/10 | Velocity clamp y airbag intactos. DarkSpin cross-node sweep es incorrecto semánticamente en multicell y 8× más costoso. |
| Frontend Hive Mind (aggregation) | 7.5/10 | Arquitectura de agregación sólida. Penaliza por duplicación de código, `GENERIC_AUTO_LABELS` hardcoded, y CellRouter sin memo. |
| Cell Routing & Labels (WAVE 4734) | 7.5/10 | `SECTION_REGISTRY` declarativo es elegante. Gating predicates limpios. Penaliza por `renderKineticIfContinuous` parche y re-render completo. |

### 5.4 Prioridades de fix para V1.0

**Bloqueantes (antes de release multicell):**
1. **Corregir DarkSpin sweep** para que solo apague el IMPACT asociado al nodo COLOR en transit, no todos los IMPACT del device.

**Alto impacto:**
2. **Hacer `_translateColor` realmente zero-alloc** — pre-allocar objeto mutable scratch y escribir propiedades, nunca retornar object literal nuevo.
3. **Cachear `_aetherWheelToLegacy`** por referencia de `ColorWheelDefinition`.
4. **Deduplicar `useAggregatedCapabilityCells`** — eliminar la versión inline de `useCapabilityCells.ts`.

**Media prioridad:**
5. **Añadir `React.memo` a `RoutedCell`** y pasar `atmosphereGroups` a `ExtrasAggregator` en lugar de `groups` completo.
6. **Tipar `customLabel`** como campo opcional en `ICapabilityNode` o `INodeData` en lugar de metadata bag.
7. **Generar `GENERIC_AUTO_LABELS`** desde `FAMILY_DEFAULT_LABEL` en lugar de hardcodear.
8. **Unificar `rotor` vs `percussion`** en el pipeline (`NodeExtractionPipeline` o `suffixToRole`).

**Baja prioridad:**
9. **Cambiar `IDMXPacket.channels`** a `Uint8Array` para eliminar copia en `resolve()`.
10. **Batch updates en `SpatialRegistrar`** — evitar N ciclos unregister/register en drag-and-drop masivo.

---

## 6. Nota final

La arquitectura multicell de LuxSync es **audaz y funcionalmente correcta**. La Forja Híbrida permite construir perfiles complejos (Tungsten: 3 pétalos + wash + beam + 2 impact + kinetic) sin escribir JSON. El Hive Mind permite controlar 50 fixtures con un solo slider de "Pétalo 1". El pipeline de extracción consume `aetherNodeId` sin bugs.

Pero el **NodeResolver.hot path no fue auditado para multicell**. Los claims de zero-alloc que ya eran sospechosos en un mundo mono-nodo se convierten en **alloc storms** cuando un fixture se descompone en 8 nodos. DarkSpin, una innovación brillante en el mundo legacy, se rompe silenciosamente en multicell apagando más dimmers de los necesarios.

El frontend (`CellRouter`, `cellLabels`, `useOrphanPhantomChannels`) está bien diseñado pero arrastra deuda de duplicación y hardcoded values. La propagación de labels funciona "por los pelos" gracias a un `profileMeta` type-unsafe.

**Recomendación estratégica:** Antes de declarar WAVE 4732 "done", los fixes #1 (DarkSpin) y #2 (`_translateColor` zero-alloc) deben estar implementados y probados con un rig de 50 Tungstens. El resto puede esperar a una V1.1.

---

*Fin del informe. El corazón del sistema sigue sano. La abstracción multicell es real. Pero los defectos de implementación del core Aether se han multiplicado proporcionalmente a la granularidad de los nodos.*
