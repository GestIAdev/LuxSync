# 🦎 WAVE 4723 — THE CAMALEÓN PROGRAMMER BLUEPRINT

> **Mandato:** Refactorizar `TheProgrammer.tsx` desde una UI estática "un fixture = una sección" hacia una UI **dinámica, multi-célula y armónica** con la arquitectura Aether Multi-Cell (`ICapabilityNode` + `nodeGraph` + `ignitionDeps`).
>
> **No es un patch.** Es una **mutación de identidad** — el programmer pasa de hablar con *fixtures* a hablar con *nodos de capacidad*. Como `KineticsCathedral` ya separa el movimiento en tracks/patrones, el Camaleón separa la programación manual en **células de capacidad**.
>
> **Estado:** DISEÑO. No se escribe código en este pase.

---

## 0. Diagnóstico — ¿por qué la UI actual está obsoleta?

### Evidencia en el código

**`TheProgrammer.tsx` actual** renderiza secciones globales fijas:
- 1 × `IntensitySection`
- 1 × `ColorSection`
- 1 × `BeamSection`
- 1 × `ExtrasSection` (phantom channels — heurística por nombre)

**`programmerStore.ts` actual** mantiene un `Map<fixtureId, ProgrammerOverrides>` donde **cada `ProgrammerOverrides` aplana los canales** de TODO el fixture:
```ts
ProgrammerOverrides {
  red, green, blue, white, amber,   // ← UN solo color por fixture
  pan, tilt, speed, ...
  gobo, prism, focus, zoom, iris,    // ← UN solo beam por fixture
  extras: Map<string, number>        // ← phantoms por nombre de canal
}
```

**`ProgrammerAetherBridge.ts`** ya rutea por familia (`COLOR`/`IMPACT`/`KINETIC`/`BEAM`/`EXTRAS`) hacia un nodeId único por familia:
```ts
const FAMILY_LABEL = { COLOR: 'color', IMPACT: 'impact', ... }
// → nodeId = `${deviceId}:color`
```

### El problema concreto del Tungsteno

Un fixture moderno como el **Tungsteno** tiene en realidad:
- 3 nodos `COLOR` independientes (pétalo 1, pétalo 2, pétalo 3)
- 1 nodo `COLOR` para el **wash/baño**
- 1 nodo `BEAM` para el **rayo** central
- 1 nodo `IMPACT` (dimmer master con `ignitionDeps`)
- 1 nodo `KINETIC` (rotación continua de pétalos)

Hoy el programmer fuerza al operador a **un solo color para el fixture entero**. Si toca el pétalo 1, machaca el pétalo 2. Esto **rompe la arquitectura Aether** (que ya soporta multi-célula via `nodeGraph.getDeviceNodes(deviceId)`) y **rompe la analogía con KineticsCathedral**, que sí permite tracks paralelos.

---

## 1. 🧬 EL MAPEO NODO-INTERFAZ (The Node Link)

### 1.1 Filosofía

> **Un fixture no es un objeto cromático.** Es un *contenedor* de N células. El programmer debe **iterar las células**, no las fixtures.

### 1.2 Fuente de verdad

El `INodeGraph` ya expone la API necesaria:

```ts
// Ya existe en core/aether/node-graph.ts
interface INodeGraph {
  getDeviceNodes(deviceId: DeviceId): readonly AnyNodeData[]
  getView<F extends NodeFamily>(family: F): INodeView<NodeFamilyDataMap[F]>
  getNode(nodeId: NodeId): AnyNodeData | undefined
}
```

Cada nodo trae:
- `nodeId` (`<deviceId>:<label>`)
- `family` (COLOR / IMPACT / KINETIC / BEAM / ATMOSPHERE)
- `role` (semantic hint: `wash`, `beam`, `petal`, `master`...)
- `channels[]` (DMX que posee en exclusiva)
- `profileMeta` (data específica: nombres custom, color del LED, posición geométrica de la célula)

### 1.3 El nuevo flujo de iteración

```
selectedFixtureIds[]
        │
        ▼
  ┌─────────────────────┐
  │  CapabilityResolver │ ← nuevo selector derivado del nodeGraph
  └─────────────────────┘
        │
        ▼
  CellGroup[] = [
    { deviceId: "tungsteno-01",
      label: "TUNGSTENO #1",
      nodes: {
        impact:   [{ nodeId: "tungsteno-01:dimmer", role: "master" }],
        color:    [
          { nodeId: "tungsteno-01:petal-1", role: "petal", index: 0 },
          { nodeId: "tungsteno-01:petal-2", role: "petal", index: 1 },
          { nodeId: "tungsteno-01:petal-3", role: "petal", index: 2 },
          { nodeId: "tungsteno-01:wash",    role: "wash",  index: 3 },
        ],
        beam:     [{ nodeId: "tungsteno-01:beam-1", role: "beam" }],
        kinetic:  [{ nodeId: "tungsteno-01:kinetic-1", role: "rotor" }],
      }
    },
    ...
  ]
```

### 1.4 Reglas de mapeo node → UI

| Familia | Componente UI | Cardinalidad |
|---|---|---|
| `IMPACT` | `IntensitySection` | 1 por nodo (master habitualmente único) |
| `COLOR`  | `ColorSection`     | **N por device** (pétalos + wash) |
| `BEAM`   | `BeamSection`      | N por device (raro pero posible: Sunstrips) |
| `KINETIC`| `KineticSection`*  | 1 por nodo cinético no-pan/tilt |
| `ATMOSPHERE` / phantoms residuales | `ExtrasSection` | 1 colectivo por device |

*Pan/Tilt clásicos viven en `KineticsCathedral`; aquí sólo aparecen rotaciones de pétalo, sparks/fans, etc.

### 1.5 Política de agrupación: **Cell-First, Device-Second**

Cuando el operador selecciona N fixtures **homogéneos** (mismo perfil), las células equivalentes se **agrupan automáticamente**:

```
Selección: [Tungsteno-01, Tungsteno-02, Tungsteno-03]
           │
           ▼
Render:    1 IntensitySection master    → controla 3× dimmer
           1 ColorSection × "petal-1"   → controla 3× petal-1
           1 ColorSection × "petal-2"   → controla 3× petal-2
           1 ColorSection × "petal-3"   → controla 3× petal-3
           1 ColorSection × "wash"      → controla 3× wash
           1 BeamSection × "beam-1"     → controla 3× beam-1
```

Cuando la selección es **heterogénea** (Tungsteno + PAR), se renderiza:
1. **Bloque común** arriba — sólo las capacidades intersección (típicamente intensity + un color genérico vía rol `wash` o `master-color`).
2. **Bloque por device** debajo — colapsable, muestra las células únicas de cada modelo.

Esto preserva la sensación de **multi-edit pro** sin perder el control granular.

---

## 2. 🎭 COMPONENTES DINÁMICOS (Atomic Sections)

### 2.1 Refactor de firmas

Hoy las secciones reciben datos planos del fixture seleccionado. La nueva firma acepta un **`CapabilityContext`** que apunta a uno o varios `nodeId`:

```ts
// Nuevo contrato base — TODAS las atomic sections lo implementan
interface CapabilityContext<F extends NodeFamily> {
  /** Identificador estable de la célula UI (no necesariamente 1 nodeId) */
  cellKey: string                    // ej: "tungsteno-01:petal-1"
  /** N nodeIds que esta UI controla simultáneamente (multi-fixture select) */
  nodeIds: readonly NodeId[]
  /** Rol semántico — usado para iconografía y agrupación visual */
  role: NodeRole                     // 'wash' | 'petal' | 'beam' | 'master' | ...
  /** Etiqueta legible para el header */
  label: string                      // "Pétalo 1", "Wash", "Rayo", "Master"
  /** Posición de la célula dentro del device (para ordenar UI) */
  cellIndex: number
  /** profileMeta filtrado a lo que la UI necesita (color tag, geometría) */
  meta: NodeFamilyDataMap[F]['profileMeta']
}
```

**Firmas refactorizadas:**

```ts
interface IntensitySectionProps {
  ctx: CapabilityContext<NodeFamily.IMPACT>
  isExpanded: boolean
  onToggle(): void
}

interface ColorSectionProps {
  ctx: CapabilityContext<NodeFamily.COLOR>
  isExpanded: boolean
  onToggle(): void
}

interface BeamSectionProps {
  ctx: CapabilityContext<NodeFamily.BEAM>
  isExpanded: boolean
  onToggle(): void
}
```

### 2.2 Datos viven en el store, no en los props

> **Anti-prop-drilling:** las secciones leen `value`, `hasOverride`, `isMixed` directamente del `programmerStore` usando el `cellKey` como índice.

```ts
const ColorSection: React.FC<ColorSectionProps> = ({ ctx, isExpanded, onToggle }) => {
  const value = useProgrammerStore(s => s.getCellColor(ctx.cellKey))   // {r,g,b}|null
  const hasOverride = useProgrammerStore(s => s.cellOverrides.has(ctx.cellKey))
  // ...
  const handleChange = useCallback((r,g,b) => {
    useProgrammerStore.getState().setCellColor(ctx.cellKey, ctx.nodeIds, r, g, b)
  }, [ctx.cellKey, ctx.nodeIds])
}
```

Esto evita re-renders en cascada y mantiene la sección **agnóstica de qué fixture controla**.

### 2.3 Agrupación visual — `<DeviceCellGroup>`

Para que el operador entienda que el `Wash` y el `Beam` viven en el mismo aparato, las secciones se agrupan en un wrapper:

```
╔═════════════════════════════════════════════╗
║  ⬢ TUNGSTENO #1 · 4ch petals + wash + beam  ║   ← header del group
╠═════════════════════════════════════════════╣
║  ▼ INTENSITY · master                       ║   ← border tag = role color
║  ▼ COLOR · petal-1   [🟣]                   ║   ← swatch del color actual
║  ▼ COLOR · petal-2   [🟢]                   ║
║  ▼ COLOR · petal-3   [🔵]                   ║
║  ▼ COLOR · wash      [🟡]                   ║
║  ▼ BEAM · beam-1                            ║
║  ▶ EXTRAS (3 phantoms)                       ║
╚═════════════════════════════════════════════╝
```

Cada `DeviceCellGroup` es **colapsable como conjunto** + colapsable individualmente por sección. Esto resuelve el problema de "20 secciones en pantalla" cuando hay 5 Tungstenos seleccionados.

### 2.4 Firma del wrapper

```ts
interface DeviceCellGroupProps {
  deviceId: DeviceId
  label: string                       // "TUNGSTENO #1"
  cells: CapabilityContext<NodeFamily>[]
  /** Cuando el grupo tiene N>1 fixtures gemelos seleccionados */
  twinCount?: number
  isExpanded: boolean
  onToggle(): void
}
```

---

## 3. ⚡ ARMONÍA CON LA CATEDRAL (Multitrack Logic)

### 3.1 El problema de las colisiones

Hoy `setColor()` itera `state.activeFixtureIds` y aplana **todos los pétalos en uno**:

```ts
// programmerStore.ts:480 (problema actual)
setColor: (r, g, b) => {
  for (const id of state.activeFixtureIds) {
    const ov = next.get(id) ?? createEmptyOverrides()
    next.set(id, { ...ov, red: r, green: g, blue: b })  // ← UN solo color
  }
}
```

Si el operador toca pétalo 2, **resetea pétalo 1** porque `red/green/blue` es un slot único por fixture.

### 3.2 Nueva estructura — el "Cell Override Map"

```ts
// programmerStore.ts (refactor)
interface CellOverride {
  /** Familia de la célula — discrimina shape del payload */
  family: NodeFamily
  /** NodeIds controlados (1 cuando single-fixture, N cuando twin selection) */
  nodeIds: readonly NodeId[]
  /** Payload normalizado 0-1 — depende de la familia */
  payload: ColorPayload | ImpactPayload | BeamPayload | KineticPayload | ExtrasPayload
  /** Timestamp del último write — para LRU cleanup opcional */
  lastWriteMs: number
}

interface ProgrammerStateV2 {
  // ✨ Nuevo — granularidad por célula, no por fixture
  cellOverrides: Map<CellKey, CellOverride>
  
  // Mantiene compatibilidad legacy hasta migrar todos los consumidores
  fixtureOverrides: Map<FixtureId, ProgrammerOverrides>  // @deprecated WAVE 4723
  
  // Dirty tracking refinado: ahora por cellKey
  dirtyCells: Set<CellKey>
  
  // Setters granulares
  setCellColor(cellKey: CellKey, nodeIds: readonly NodeId[], r: number, g: number, b: number): void
  setCellImpact(cellKey: CellKey, nodeIds: readonly NodeId[], dimmer: number): void
  setCellBeam(cellKey: CellKey, nodeIds: readonly NodeId[], channel: BeamChannel, value: number): void
  releaseCell(cellKey: CellKey): void
  releaseDevice(deviceId: DeviceId): void
  releaseAll(): void
}
```

`CellKey` = `<deviceId>:<nodeLabel>` o `<deviceId>:<nodeLabel>#<twinSiblingId>` cuando agrupa múltiples fixtures.

### 3.3 Garantía de no-colisión

```
Operador toca pétalo 1 en Tungsteno-01:
  cellOverrides.set("tungsteno-01:petal-1", { ...rgb1 })
  
Operador toca pétalo 2 en Tungsteno-01:
  cellOverrides.set("tungsteno-01:petal-2", { ...rgb2 })
  
ESTADO RESULTANTE:
  cellOverrides = {
    "tungsteno-01:petal-1" → rgb1  ← sigue intacto
    "tungsteno-01:petal-2" → rgb2
  }
  
Liberar pétalo 1:
  cellOverrides.delete("tungsteno-01:petal-1")
  → pétalo 2 NO se toca, AI vuelve a pintar pétalo 1
```

### 3.4 Bridge — `ProgrammerAetherBridge` v2

El bridge actual ya rutea por familia → nodeId. Sólo necesita evolucionar de:

```ts
// HOY (v1) — un payload por fixture, mapeado a un nodeId fijo
const nodeId = `${fixtureId}:${FAMILY_LABEL[family]}`
arbiter.setManual(nodeId, channels)
```

a:

```ts
// V2 — payload por célula, mapeado al nodeId real de la célula
for (const [cellKey, cellOv] of cellOverrides) {
  if (!dirtyCells.has(cellKey)) continue
  for (const nodeId of cellOv.nodeIds) {
    const channels = extractChannels(cellOv)
    arbiter.setManual(nodeId, channels)
  }
}
```

**Crucial:** ya no hay heurística "color → fixtureId:color". El `cellOverride` *trae* el `nodeId` correcto que la UI obtuvo del `nodeGraph`. Cero mapeo perdido.

### 3.5 Paralelismo con `KineticsCathedral`

| Concepto | KineticsCathedral | TheProgrammer Camaleón |
|---|---|---|
| Unidad de control | Track de patrón | Cell override |
| Identidad | `trackId` | `cellKey` |
| Granularidad | Por fixture/grupo | Por célula |
| Liberación | `releaseTrack(trackId)` | `releaseCell(cellKey)` |
| Persistencia | `patternStore` | `programmerStore.cellOverrides` |
| Bridge | `KineticsBridge` | `ProgrammerAetherBridge` |

---

## 4. 🌃 ESTÉTICA CYBERPUNK (The Visual Identity)

### 4.1 Principios

1. **Densidad sin mareo** — cada cell tag respira con un padding mínimo de 6px y bordes de 1px translúcidos.
2. **Color como información** — el border-color de cada sección **coincide con el rol del nodo** (no con el color del frame actual). El operador aprende a distinguir `wash` de `petal` de un vistazo.
3. **Animación como feedback, no como decoración** — micro-pulsos sólo cuando hay un evento (touch, override, release).

### 4.2 Sistema de identidad por rol

```ts
const ROLE_NEON: Record<NodeRole, RoleNeonStyle> = {
  master:  { hex: '#ff3366', label: 'MASTER',  icon: '⬢' },  // rojo coral
  wash:    { hex: '#36d1ff', label: 'WASH',    icon: '◉' },  // cyan eléctrico
  petal:   { hex: '#d946ef', label: 'PETAL',   icon: '✦' },  // magenta
  beam:    { hex: '#facc15', label: 'BEAM',    icon: '▲' },  // amber
  rotor:   { hex: '#22c55e', label: 'ROTOR',   icon: '↻' },  // verde
  ambient: { hex: '#8b5cf6', label: 'AMBIENT', icon: '◐' },  // violeta
  // fallback
  unknown: { hex: '#94a3b8', label: 'NODE',    icon: '◦' },
}
```

CSS variables propagadas vía inline style (mismo patrón que `ExtrasSection.tsx` ya usa con `--pc-*`):

```css
.cell-section {
  --role: var(--cell-role-color);
  border: 1px solid color-mix(in srgb, var(--role) 35%, transparent);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--role) 6%, transparent),
    transparent 40%);
}

.cell-section.has-override {
  border-color: var(--role);
  box-shadow: 0 0 0 1px var(--role), 0 0 24px -8px var(--role);
}

.cell-section.has-override::before {
  /* breath glow muy sutil — 4s ciclo, no debe distraer */
  content: '';
  position: absolute; inset: -1px;
  border: 1px solid var(--role);
  border-radius: inherit;
  animation: cell-breath 4s ease-in-out infinite;
  opacity: 0.4;
  pointer-events: none;
}
```

### 4.3 Indicadores de actividad por nodo

Cada section header lleva un **status pill** que dice cuántos nodos controla:

```
[⬢ WASH] [3×]   ← controla 3 fixtures gemelos
[✦ PETAL-1] [●]  ← controla 1 nodo (puntito = ok)
[✦ PETAL-1] [⌀]  ← MIXED (los 3 fixtures tienen valores distintos)
```

### 4.4 Micro-animaciones (whitelist)

| Evento | Animación | Duración |
|---|---|---|
| Touch slider | Border flash al 80% del role color | 120ms |
| Override activado | Glow pulse 1× | 600ms |
| Release | Fade-out del glow | 300ms |
| Mixed state detectado | Breathing del border al 40% role color | 4s loop |
| Twin selection (N>1) | Marcador `[3×]` con scale spring | 200ms |

**No hay** parallax, sin shimmer pasivo, sin partículas. Cada animación responde a una **causa**.

### 4.5 El header del DeviceCellGroup

Diseño inspirado en pestañas de DAW (Bitwig/Ableton):

```
┌─[ TUNGSTENO #1 ]────────────────[6 cells]──[2 active]─┐
│  ⬢ ◉ ✦ ✦ ✦ ▲   ← micro-iconos del rol de cada célula │
└──────────────────────────────────────────────────────┘
```

Los micro-iconos brillan cuando esa célula tiene override activo — **scanneo visual de 1 segundo** para auditar todo el aparato.

---

## 5. 🧨 LIMPIEZA DE EXTRAS (The Ghost Purge)

### 5.1 Diagnóstico

`ExtrasSection.tsx:65-71` define el filtro phantom como:

```ts
const PHANTOM_CHANNEL_TYPES = new Set(['custom', 'rotation', 'macro', 'speed', 'control'])
```

Hoy esto incluye **canales que YA tienen nodo asignado** (porque `rotation`/`speed` típicamente viven en `KineticNode`, no en atmosphere). Resultado: aparecen **slider duplicados** — uno en Extras, otro implícito vía Aether.

### 5.2 Nueva regla — "Si tiene nodo, no es phantom"

```ts
function isResidualPhantom(channel: INodeChannelDef, nodeGraph: INodeGraph): boolean {
  // Pasa por todos los nodos del device y verifica que NINGUNO posee este canal
  const ownerNode = nodeGraph.findNodeByChannel(channel.dmxOffset, deviceId)
  if (ownerNode) return false             // ← lo controla un nodo conocido
  return PHANTOM_CHANNEL_TYPES.has(channel.type)
}
```

Esto requiere **una nueva consulta** en `INodeGraph`:

```ts
interface INodeGraph {
  // ... existentes
  /**
   * WAVE 4723: Encuentra el nodo dueño de un canal DMX dentro de un device.
   * Retorna undefined si el canal no está asignado a ningún nodo
   * (= candidato real a phantom/extra).
   */
  findNodeByChannel(deviceId: DeviceId, dmxOffset: number): AnyNodeData | undefined
}
```

Implementación O(1) con un `Map<deviceId, Map<dmxOffset, nodeId>>` pre-construido en `registerDevice()`.

### 5.3 Política de visibilidad de ExtrasSection

```
ExtrasSection se renderiza SI Y SÓLO SI existe ≥1 canal phantom RESIDUAL
en el device (= no asignado a ningún CapabilityNode).

Caso típico: pump de fog, custom-strobe-mode, macro de reset.
```

Esto reduce drásticamente el ruido en aparatos modernos bien perfilados (que no deberían tener residuales) y mantiene la sección como red de seguridad para fixtures legacy / no-perfilados completos.

### 5.4 Migración del cache `cacheRef` actual

El cache actual en `ExtrasSection` (`Map<defId, CachedPhantomDef>`) **se elimina**. Ya no es necesario hacer IPC porque el `nodeGraph` está en RAM como single source of truth. Ganancia: -150 LOC, -1 IPC roundtrip por selección.

---

## 6. 📐 DIAGRAMA DE FLUJO DE DATOS

```
┌──────────────────────────────────────────────────────────────────┐
│                     PATCH TIME (boot/show-load)                  │
│                                                                  │
│  ShowFile.fixtures[] ──► NodeFactory ──► nodeGraph              │
│                          (genera N CapabilityNodes por fixture)  │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                       FRAME TIME (44Hz)                          │
│                                                                  │
│  ┌─selectedIds─┐                                                 │
│  │             │                                                 │
│  ▼             ▼                                                 │
│ ┌────────────────────────────┐                                  │
│ │  CapabilityResolver hook   │ ← lee nodeGraph.getDeviceNodes() │
│ │  (memo por selectedIds +   │                                  │
│ │   nodeGraph generation)    │                                  │
│ └────────────────────────────┘                                  │
│             │                                                    │
│             ▼                                                    │
│  CellGroup[] ──► <DeviceCellGroup> wrapper                      │
│                       │                                          │
│         ┌─────────────┼─────────────┐                           │
│         ▼             ▼             ▼                           │
│  IntensitySection ColorSection×N BeamSection                    │
│         │             │             │                           │
│         └─────┬───────┴─────────────┘                           │
│               ▼                                                  │
│   programmerStore.setCellXxx(cellKey, nodeIds, value)           │
│               │                                                  │
│               ▼                                                  │
│   cellOverrides.set(cellKey, ...)                               │
│   dirtyCells.add(cellKey)                                       │
│                                                                  │
│  ─ ─ ─ ─ ─ ─ ─ 22.7ms tick ─ ─ ─ ─ ─ ─ ─ ─                       │
│                                                                  │
│   ProgrammerAetherBridge.tick():                                │
│     for cellKey in dirtyCells:                                  │
│       for nodeId in cellOverride.nodeIds:                       │
│         arbiter.setManual(nodeId, payload)                      │
│     dirtyCells.clear()                                          │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                  AETHER L2 (NodeArbiter)                         │
│  Manual override layer → NodeResolver → DMX                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. 🗺️ PLAN DE MIGRACIÓN (5 PASOS, EN ORDEN)

### PASO 1 — Foundation (sin breaking changes)
- Añadir `findNodeByChannel(deviceId, dmxOffset)` a `INodeGraph` + impl con índice O(1).
- Añadir tipo `CapabilityContext<F>` y `CellGroup` en `core/aether/programmer-types.ts`.
- Crear hook `useCapabilityCells(selectedIds): CellGroup[]` con memoización por `JSON.stringify(selectedIds) + nodeGraph.generation`.

### PASO 2 — Store v2 paralelo (opt-in)
- Extender `programmerStore` con `cellOverrides`, `dirtyCells`, setters `setCellXxx`.
- Mantener intacto `fixtureOverrides` legacy. Marcar como `@deprecated WAVE 4723`.
- `releaseAll()` limpia ambos mapas.

### PASO 3 — Bridge v2
- `ProgrammerAetherBridge` lee primero `cellOverrides` (por nodeId real), luego cae al legacy `fixtureOverrides` para los nodos no cubiertos.
- Añadir telemetría `[Bridge] cells flushed: N, legacy fixtures flushed: M` para monitorear migración.

### PASO 4 — Refactor de UI
- `TheProgrammer.tsx` consume `useCapabilityCells()`.
- Renderiza `<DeviceCellGroup>` por cada `CellGroup`.
- Cada section se reescribe con la nueva firma `{ ctx, isExpanded, onToggle }`.
- Aplica el sistema `ROLE_NEON` + animaciones whitelist.

### PASO 5 — Ghost Purge & cleanup
- `ExtrasSection` filtra residuales con `findNodeByChannel`.
- Elimina cache IPC interno.
- Marca `fixtureOverrides` legacy como dead path tras 1 wave de telemetría con 0 hits.

---

## 8. 🛡️ INVARIANTES Y NO-NEGOCIABLES

1. **Un cell override jamás escribe en un nodeId que no está en `cellOverride.nodeIds`.** Cero coupling implícito.
2. **El `nodeGraph` es la única fuente de verdad** de qué células existen. La UI nunca infiere capacidades por nombre de canal.
3. **`KineticsCathedral` y `TheProgrammer` jamás compiten por el mismo nodo en el mismo frame.** Si el cathedral tiene un patrón activo, el programmer escribe el anchor (`pan_base`/`tilt_base`) sin tocar el resto — ya está garantizado por `extractKinetic()` en el bridge actual.
4. **Zero breaking changes a `KineticsCathedral`.** Esta wave toca exclusivamente la pila programmer.
5. **`releaseAll()` limpia ambos mundos** durante la fase de coexistencia.
6. **Las animaciones nunca corren en frames sin causa.** No hay pulsos pasivos, no hay shimmer ambiental.

---

## 9. ✅ ENTREGABLES DE ESTA WAVE

| # | Artefacto | Tipo |
|---|---|---|
| 1 | `core/aether/programmer-types.ts` | Tipos `CapabilityContext`, `CellGroup`, `CellKey` |
| 2 | `INodeGraph.findNodeByChannel()` | API extension + impl O(1) |
| 3 | `hooks/useCapabilityCells.ts` | Selector memoizado |
| 4 | `programmerStore` v2 | `cellOverrides`, `dirtyCells`, setters granulares |
| 5 | `ProgrammerAetherBridge` v2 | Lectura cell-first con fallback legacy |
| 6 | `<DeviceCellGroup>` wrapper | Componente nuevo |
| 7 | Refactor `IntensitySection`/`ColorSection`/`BeamSection` | Firma `{ ctx, isExpanded, onToggle }` |
| 8 | `ROLE_NEON` system + CSS variables | Sistema visual unificado |
| 9 | `ExtrasSection` purge | Filtra residuales reales vía nodeGraph |

---

## 10. 🧪 CRITERIOS DE ACEPTACIÓN

- [ ] Tocar pétalo 1 en Tungsteno-01 NO altera pétalo 2/3/wash.
- [ ] Liberar wash de Tungsteno-01 NO altera ningún pétalo.
- [ ] Selección de 3 Tungstenos → 1 grupo visual con 6 secciones, no 18.
- [ ] Selección heterogénea (Tungsteno + PAR genérico) renderiza bloque común + bloques por device.
- [ ] `ExtrasSection` desaparece completamente para fixtures con perfil moderno y sin canales residuales.
- [ ] Tras liberar todo, `cellOverrides.size === 0` y el bridge envía clears por cada nodeId previamente activo.
- [ ] FPS de la UI sin caídas durante twin-selection de 8 fixtures (medido con devtools profiler).
- [ ] `tsc --noEmit` 0 errors.

---

> **The Camaleón is not a UI. It is a mirror of the nodeGraph.**
> Cada vez que el `nodeGraph` evolucione, el programmer evoluciona con él — gratis.
