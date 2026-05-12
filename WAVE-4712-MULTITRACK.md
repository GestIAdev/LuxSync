# ⚡ WAVE 4712 — THE MULTITRACK ENGINE

> El motor cinético deja de ser monolítico. Cada fixture corre su propia pista.
> La UI espeja el estado L2 sin emitir un solo IPC. El estado mixto se renderiza
> como **"——"** en sliders y como cursor centrado en el radar — todo derivado.

---

## 🎛️ FASE 1 — Motor Multipista (`AetherKineticEngine`)

### Falla estructural previa
`AetherKineticEngine` tenía un único `_config: KineticConfig | null`. Asignar un patrón a una nueva selección **reemplazaba** la configuración global y borraba el contexto de los focos que ya estaban bailando. Toda la matemática del fan distribute se calculaba desde un único `nodeIds: string[]` global, por lo que añadir/quitar fixtures saltaba la fase del resto.

### Destroy

**Nuevo modelo de datos** (`AetherKineticEngine.ts`):
```ts
private readonly _nodeConfigs = new Map<string, KineticNodeConfig>()

interface KineticNodeConfig {
  pattern: NativeKineticPattern
  speed: number      // [0,1]
  amplitude: number  // [0,1]
  fan: number        // [-1,1]
  fanIndex: number   // posición dentro del grupo al asignar
  fanTotal: number   // tamaño del grupo
}
```

**API multitrack**:
- **`setManualKinetics(nodeIds, pattern, speed, amplitude, fan, arbiter)`** — UPSERT. Solo modifica las pistas de los nodeIds dados. Las demás del Map siguen ticando sin alteración.
- **`removeNodes(nodeIds, arbiter)`** — elimina pistas específicas y libera su `_motorKineticOverride`. NO toca `_manualOverride` (ancla L2 preservada, paradigma Programmer WAVE 4710).
- **`stop(arbiter?)`** — purge total. Solo lo invoca Unlock.
- **`updateScalars(nodeIds, speed, amplitude, fan)`** — actualiza scalars de pistas existentes sin reiniciar fase. Recalcula `fanIndex/fanTotal` del grupo entrante.
- **`getNodeState(nodeId, arbiter): KineticNodeStateSnapshot`** — snapshot serializable per-node con anchor pan/tilt del arbiter. Base del IPC de hidratación.
- **`hasNode(nodeId): boolean`** — ahora O(1) por `Map.has`. Usado por `KineticAdapter` para silenciar L0.

**Hot path `tick()`**: iteración directa sobre el `Map.entries()` — cada nodo lee su propia `cfg` (pattern, speed, amplitude, fan, fanIndex). La dispersión de fan deja de depender de la lista global de la selección y se vuelve **estable frente a cambios de selección ajenos**.

---

## 🧰 IPC Layer

| Canal | Cambio |
|-------|--------|
| `lux:aether:setManualPattern` | `pattern: null|hold|static` ahora llama `removeNodes(fixtureIds)` (no `stop()`). Otras pistas siguen activas. |
| `lux:aether:updateKineticScalars` | Acepta `fixtureIds?: string[]`. Sin ello aplica a todas las pistas activas (compat). |
| **`lux:aether:getKineticNodeStates`** (nuevo) | Retorna `KineticNodeStateSnapshot[]` para los fixtureIds dados — combinación de `_nodeConfigs` y `arbiter.getManualOverride` (anchor pan/tilt). |

Preload + `vite-env.d.ts` extendidos con los nuevos contratos tipados.

---

## 💧 FASE 2 — Hidratación Silenciosa & Estado Mixto

### Arquitectura de dos stores

El usuario eligió **stores paralelos** + **bridge no se suscribe al hydration store**. Resultado:

```
┌─────────────────────────────────────────────────────────────────────┐
│ movementStore          ◄────── operador (drag, click)                │
│   (operator intent)                                                  │
│      │                                                               │
│      ▼  subscribe                                                    │
│ KineticsBridge ─────────► IPC (setManualPattern / scalars / classic) │
│      │                                                               │
│      │  (optimistic write, no subscribe)                             │
│      ▼                                                               │
│ kineticHydrationStore ◄── getKineticNodeStates IPC (selection diff)  │
│   (L2 mirror + aggregate)                                            │
│      │                                                               │
│      ▼  read                                                         │
│ UI components (Cathedral, Radar, PatternArsenal, faders, chaos)      │
└─────────────────────────────────────────────────────────────────────┘
```

**Reglas**:
- `movementStore` ya **no es la fuente de display**. Solo es el "canal" del intent del operador hacia el bridge.
- `kineticHydrationStore` **es la verdad visual**. El bridge lo llena tras cada `getKineticNodeStates` y optimísticamente tras cada gesto.
- El bridge **escribe pero no se suscribe** al hydration store → **cero ruido IPC** en la hidratación.

### `useKineticHydrationStore`

Archivo nuevo (`stores/kineticHydrationStore.ts`). Contiene:

```ts
interface KineticHydrationState {
  nodes: Map<fixtureId, NodeKineticSnapshot>
  aggregate: KineticAggregate   // null en campos divergentes ⇒ "mixed"
}

interface KineticAggregate {
  pattern: PatternType | null
  speed: number | null
  amplitude: number | null
  fan: number | null
  panAnchor: number | null
  tiltAnchor: number | null
  anyActive: boolean
  count: number
}
```

`computeAggregate(nodes, selectedIds)` recorre los snapshots de la selección y, para cada campo, colapsa a un valor único o lo deja en `null` si detecta divergencia (con tolerancia ε=1e-3 para floats — evita falsos "mixed" por ruido IPC).

Acciones:
- `setNodeStates(states, selectedIds)` — bridge tras fetch.
- `applyOperatorIntent(selectedIds, partial)` — optimistic durante un gesto.
- `recomputeAggregate(selectedIds)` — para selección sin fetch (fallback).
- `reset()` — Unlock.

### Bridge: tres flujos

**1. Selección cambia** (`unsubSelection`):
```ts
void this._hydrateFromBackend(ids)
```
No emite IPC. Solo fetch + hidratación. **El show de los demás focos no se altera**.

**2. Operador toca slider/botón** (`unsubPattern` + `unsubClassic`):
```ts
// Optimistic UI:
useKineticHydrationStore.getState().applyOperatorIntent(selectedIds, { ... })
// IPC dispatch:
this._schedulePatternFlush(...) | this._scheduleClassicFlush(...)
```
El intent del operador se refleja inmediato en la UI (sin esperar IPC ack) y se dispatcha al motor por separado.

**3. Unlock** (`resetRadarSilent`):
```ts
useKineticHydrationStore.getState().reset()
void this._hydrateFromBackend(getSelectedIds())
```

---

## 🎨 UI — Mixed Rendering

Cada componente recibe ahora `null` como valor legítimo:

| Componente | Display "mixed" |
|------------|-----------------|
| `HorizontalFader` (SPEED, AMP) | Track sin fill, sin thumb, readout `——` |
| `ChaosOrderSlider` | Polo derecho cambia a `——`, thumb visible al centro (default visual) |
| `PatternArsenal` | Ningún botón iluminado |
| `KinRadarViewport` | Cursor al centro (270°/135° fallback de `pan/tilt` aggregate) |

`KineticsCathedral` ahora lee `aggregate` del hydration store en lugar de `movementStore` para los campos de display. Las acciones (`setActivePattern`, `setPatternSpeed`, etc.) siguen escribiendo a `movementStore` — el bridge se encarga de dispatch + optimistic hydration.

---

## 📁 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `electron-app/src/core/aether/AetherKineticEngine.ts` | Refactor multitrack: `_nodeConfigs` Map, `removeNodes`, `getNodeState`, tick per-node |
| `electron-app/src/core/aether/AetherIPCHandlers.ts` | `setManualPattern` usa `removeNodes`; `updateKineticScalars` con `fixtureIds`; nuevo `getKineticNodeStates` |
| `electron-app/electron/preload.ts` | Expone `getKineticNodeStates` y `updateKineticScalars` con `fixtureIds` |
| `electron-app/src/vite-env.d.ts` | Tipos de los nuevos IPC + snapshots per-node |
| **`electron-app/src/stores/kineticHydrationStore.ts`** | **NUEVO** — store paralelo, aggregate con `null=mixed` |
| `electron-app/src/bridges/KineticsBridge.ts` | Hidratación on-selection, optimistic on-gesture, fixtureIds en `updateKineticScalars` |
| `electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx` | Lee aggregate del hydration store |
| `electron-app/src/components/hyperion/kinetics/HorizontalFader.tsx` | `value: number | null` |
| `electron-app/src/components/hyperion/kinetics/ChaosOrderSlider.tsx` | `value: number | null` |
| `electron-app/src/components/hyperion/kinetics/PatternArsenal.tsx` | `activePattern: PatternType | null` |
| `electron-app/src/components/hyperion/kinetics/KinRadarViewport.tsx` | Anchor pan/tilt desde aggregate |

`npx tsc --noEmit` pasa **sin errores**.

---

## ⚙️ Comportamiento esperado

> Foco A hace "Bounce" rápido en Tijuana. Foco B hace "Hold" en Cancún.

- Seleccionar **A** → hydration fetch → aggregate uniforme → fader Speed marca 90, PatternArsenal ilumina BOUNCE, radar muestra anchor Tijuana.
- Seleccionar **B** → hydration fetch → aggregate uniforme → fader Speed marca 0, PatternArsenal sin patrón, radar muestra anchor Cancún.
- Seleccionar **A y B** → hydration fetch → aggregate detecta divergencia en `pattern`, `speed` y `anchor` → fader marca `——`, PatternArsenal sin botón, radar centra el cursor.
- Mientras tanto **A sigue bailando** y **B sigue quieto** — la selección no emitió ni un IPC, solo hidrató la UI.

El paradigma del Programmer queda completo: el operador "ve" lo que hay, no lo "pisa" al mirar.
