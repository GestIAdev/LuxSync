# AUDITORÍA FORENSE "AMNESIA" — Kinetics Cathedral UI

> **Bug:** Al alternar pestañas Controls/Kinetics, los valores de
> Speed/Amp/Rotation se pierden. Al pulsar Unlock, los sliders se
> reinician a 0.
>
> **Síntomas confirmados:**
> 1. Cambiar entre Controls y Kinetics → valores modificados se pierden.
> 2. Pulsar Unlock → Speed, Amp se reinician a 0.

---

## 1. DIAGNÓSTICO RAÍZ — Tres bugs convergentes

### 1.1 Bug A — TheProgrammer hidrata movementStore al activarse (AMNESIA DE TAB)

**Pregunta del Arquitecto:** ¿Dónde se almacena el valor actual de los
controles? ¿Usan estado local?

**Respuesta:** Los valores viven en dos stores globales Zustand:

| Store | Campo | Default | Propósito |
|-------|-------|---------|-----------|
| `movementStore` | `patternSpeed` | 50 | Intent del operador |
| `movementStore` | `patternAmplitude` | 50 | Intent del operador |
| `kineticHydrationStore` | `aggregate.speed` | `null` | Espejo read-only del L2 motor |
| `kineticHydrationStore` | `aggregate.amplitude` | `null` | Espejo read-only del L2 motor |

La UI (`KineticsCathedral`) **lee** de `kineticHydrationStore.aggregate`
(líneas 76-79) y **escribe** a `movementStore` (líneas 109-118). El
`KineticsBridge` sincroniza ambos: cuando el operador escribe en
`movementStore`, el bridge aplica `applyOperatorIntent` al
`kineticHydrationStore`.

**El bug NO es estado local.** El estado está elevado correctamente a
stores globales. El problema es que **TheProgrammer sobrescribe el
movementStore cada vez que la pestaña Controls se activa.**

#### La cadena del Bug A

`TheProgrammer.tsx:109-184`:

```typescript
useEffect(() => {
  // ...
  if (!isActive) return          // ← gate: solo hidrata cuando Controls está activa
  // ...
  hydrateMovementFromL2({        // ← SOBREESCRIBE movementStore
    pan: ...,
    tilt: ...,
    speed: kinetic?.speed,       // ← valor del backend L2 (no el del operador)
    pattern,
    amplitude: kineticState?.active ? kineticState.amplitude : 0.5,  // ← 0.5 = 50%
    fan: ...,
  })
}, [selectedIds.join(','), isActive, ...])  // ← isActive está en las deps
```

**Línea 184:** `isActive` está en el dependency array del `useEffect`.

**Flujo del bug:**

1. Operador está en KINETICS, pone Speed=80
   - `movementStore.patternSpeed = 80`
   - Bridge → `hydrationStore.aggregate.speed = 80`
   - UI muestra 80 ✓

2. Operador cambia a CONTROLS
   - `StageSidebar` pone `activeTab = 'controls'`
   - `TheProgrammer` recibe `isActive = true`
   - El `useEffect` se re-dispara por el cambio de `isActive`
   - `hydrateMovementFromL2({ speed: kinetic?.speed })` sobrescribe
     `movementStore.patternSpeed` con el valor del backend L2

3. Si el backend no tiene override cinético activo:
   - `kinetic?.speed = null` → `hydrateFromL2` pone `patternSpeed = 50`
     (default, línea 252 de movementStore)
   - Si el backend tiene speed=0 (patrón purgado): `patternSpeed = 0`

4. El bridge subscription se dispara con el nuevo valor (50 o 0)
   - `applyOperatorIntent({ speed: 50 })` → `hydrationStore.aggregate.speed = 50`

5. Operador vuelve a KINETICS
   - `KineticsCathedral` lee `hydrationStore.aggregate.speed` → muestra 50 o 0
   - **El 80 del operador se perdió**

**Causa raíz:** `isActive` en el dependency array del `useEffect` de
TheProgrammer causa re-hidratación del movementStore cada vez que la
pestaña Controls se activa, sobrescribiendo el intent del operador con
valores stale del backend.

#### Por qué el guard `if (!isActive) return` no ayuda

El guard en línea 128 previene la hidratación cuando Controls NO está
activa. Pero cuando Controls SE ACTIVA (cambio de pestaña), el efecto
se re-dispara y el guard pasa — la hidratación ocurre. El guard está
diseñado para evitar IPC innecesarios, no para proteger el estado del
operador.

### 1.2 Bug B — Unlock purga el backend y re-hidrata desde el vacío (RESET A 0)

**Pregunta del Arquitecto:** ¿Está el Unlock disparando una función de
inicialización reset()/clear() por un efecto secundario?

**Respuesta: Sí.** El botón Unlock ejecuta una secuencia que purga el
backend y luego re-hidrata desde el backend purgado, que devuelve 0.

`KineticsCathedral.tsx:145-188`:

```typescript
const handleUnlockKinetics = useCallback(() => {
  // 1) Backend: kineticHandoff purga el motor
  void window.lux?.aether?.kineticHandoff?.({ fixtureIds: selectedIds })

  // 2) UI: resetear a defaults
  ms.setActivePattern('none')
  ms.setPatternSpeed(50)         // ← movementStore = 50
  ms.setPatternAmplitude(50)     // ← movementStore = 50

  // 3) Bridge: reset + re-hidratar
  KineticsBridge.resetRadarSilent()  // ← AQUÍ ESTÁ EL BUG
}, [selectedIds])
```

`KineticsBridge.ts:393-412`:

```typescript
resetRadarSilent(): void {
  // ...
  useKineticHydrationStore.getState().reset()           // ← limpia a EMPTY (null)
  void this._hydrateFromBackend(getSelectedIds())       // ← fetch desde backend purgado
}
```

**La carrera destructiva:**

1. `kineticHandoff` IPC purga el motor (async, sin await)
2. `setPatternSpeed(50)` → bridge subscription → `applyOperatorIntent({speed:50})`
   → `hydrationStore.aggregate.speed = 50` ✓
3. `resetRadarSilent()` llama `reset()` → `hydrationStore.aggregate.speed = null`
4. `_hydrateFromBackend()` hace IPC al backend purgado → devuelve `speed: 0`
5. `setNodeStates` → `hydrationStore.aggregate.speed = 0`
6. UI muestra 0

**El paso 2 pone el hydration store en 50, pero el paso 3 lo destruye
y el paso 4 lo reemplaza con 0 del backend purgado.**

**Causa raíz:** `resetRadarSilent()` llama `reset()` +
`_hydrateFromBackend()` después de que el backend ya fue purgado. El
backend purgado devuelve 0, que sobrescribe el 50 que el
movementStore acaba de establecer.

### 1.3 Bug C — Two-Way Binding asimétrico (UI lee L2, escribe intent)

**Pregunta del Arquitecto:** ¿La UI está leyendo la verdad del motor?

**Respuesta: Sí, pero la "verdad" es equivocada después de un purge.**

La arquitectura es:

```
Operador drag → movementStore (intent)
                  ↓
                KineticsBridge subscription
                  ↓
                applyOperatorIntent → hydrationStore (espejo)
                  ↓
                UI lee hydrationStore.aggregate

Selección cambia → KineticsBridge._hydrateFromBackend
                  ↓
                getKineticNodeStates IPC → hydrationStore (verdad L2)
                  ↓
                UI lee hydrationStore.aggregate
```

La UI **siempre** lee de `hydrationStore.aggregate`. Cuando el
operador escribe, el bridge proyecta el intent al hydrationStore
optimistamente. Cuando la selección cambia, el bridge re-hidrata desde
el backend.

**El problema:** Después de un Unlock, el backend está purgado. La
re-hidratación devuelve 0, no el valor neutral (50). El hydrationStore
muestra 0, que es la "verdad" del motor purgado, pero no es lo que el
operador espera ver (50 = neutral).

**Adicionalmente:** `TheProgrammer.hydrateMovementFromL2` sobrescribe
`movementStore.patternSpeed` con el valor del backend, destruyendo el
intent del operador. Esto rompe el two-way binding: la UI escribe a
`movementStore`, pero `TheProgrammer` sobrescribe `movementStore` desde
el backend sin saber que el operador ya había establecido un valor.

---

## 2. FLUJO COMPLETO DEL BUG (diagrama)

### Tab Switch Amnesia

```
Operador en KINETICS: Speed=80
  ↓
movementStore.patternSpeed = 80
KineticsBridge → hydrationStore.aggregate.speed = 80
UI muestra 80 ✓
  ↓
Operador cambia a CONTROLS
  ↓
StageSidebar: activeTab = 'controls'
TheProgrammer: isActive = true
  ↓
useEffect se re-dispara (isActive cambió)
  ↓
hydrateMovementFromL2({ speed: kinetic?.speed })
  ↓
¿Backend tiene override cinético?
  NO → movementStore.patternSpeed = 50 (default)
  SÍ → movementStore.patternSpeed = backend.speed * 100
  ↓
KineticsBridge subscription → hydrationStore.aggregate.speed = 50 (o 0)
  ↓
Operador vuelve a KINETICS
  ↓
UI lee hydrationStore.aggregate.speed = 50 (o 0)
  ↓
✗ AMNESIA: el 80 se perdió
```

### Unlock Reset to 0

```
Operador pulsa UNLOCK
  ↓
kineticHandoff IPC (async, purga motor)
  ↓
movementStore.patternSpeed = 50
movementStore.patternAmplitude = 50
  ↓
Bridge subscription → hydrationStore.aggregate.speed = 50 ✓
  ↓
resetRadarSilent()
  ↓
hydrationStore.reset() → aggregate.speed = null
  ↓
_hydrateFromBackend() → IPC al motor purgado
  ↓
Motor purgado devuelve speed: 0
  ↓
hydrationStore.aggregate.speed = 0
  ↓
UI muestra 0 ✗
```

---

## 3. FIXES PROPUESTOS

### Fix A: Remover `isActive` del useEffect de TheProgrammer

**Archivo:** `TheProgrammer.tsx:184`

Cambiar:
```typescript
}, [selectedIds.join(','), isActive, syncSelection, pruneManualOverride, hydrateFromL2, hydrateMovementFromL2])
```

Por:
```typescript
}, [selectedIds.join(','), syncSelection, pruneManualOverride, hydrateFromL2, hydrateMovementFromL2])
```

**Justificación:** El guard `if (!isActive) return` en línea 128 ya
previene IPC innútiles cuando Controls no está activa. Remover
`isActive` del dependency array evita que el efecto se re-dispare al
cambiar pestañas, protegiendo el estado del operador.

**Impacto:** La hidratación del programmer (color/beam/extras) seguirá
ocurriendo en cambios de selección. La única pérdida es que si el
operador cambia de pestaña SIN cambiar la selección, el programmer no
se re-hidratará — pero esto es aceptable porque el KineticsBridge ya
mantiene el estado L2 sincronizado.

### Fix B: No hidratar movementStore desde TheProgrammer

**Archivo:** `TheProgrammer.tsx:165-176`

Remover o comentar la llamada `hydrateMovementFromL2({...})` en el
effect del TheProgrammer. La hidratación cinética es responsabilidad
del `KineticsBridge._hydrateFromBackend`, no del TheProgrammer.

**Justificación:** TheProgrammer debe hidratar su propio dominio
(impact/color/beam/extras), no el dominio cinético. El dominio
cinético ya tiene su propio bridge con hidratación dedicada.

### Fix C: Reemplazar reset() + _hydrateFromBackend() con applyOperatorIntent

**Archivo:** `KineticsBridge.ts:410-411`

Cambiar:
```typescript
useKineticHydrationStore.getState().reset()
void this._hydrateFromBackend(getSelectedIds())
```

Por:
```typescript
// After unlock, set hydration to neutral state without fetching
// from the purged backend (which would return 0).
useKineticHydrationStore.getState().applyOperatorIntent(
  getSelectedIds(),
  {
    pattern: 'none',
    speed: 50,
    amplitude: 50,
    fan: 0,
    panAnchor: 270,
    tiltAnchor: 135,
  }
)
```

**Justificación:** Después de un Unlock, el backend está purgado.
Re-hidratar desde él devuelve 0. En su lugar, proyectar el estado
neutral (50/50, pan=270, tilt=135) directamente al hydrationStore,
coincidiendo con los valores que `handleUnlockKinetics` ya estableció
en el movementStore.

---

## 4. VEREDICTO FORENSE

| Pregunta del Arquitecto | Respuesta |
|--------------------------|-----------|
| ¿Estado local (useState) en los controles? | **No.** El estado está en stores globales (movementStore + kineticHydrationStore). El bug no es falta de elevación |
| ¿Unlock fuerza re-render que destruye el DOM? | **No.** El DOM se preserva (display:none). El bug es que resetRadarSilent() purga el hydrationStore y re-hidrata desde el backend purgado, que devuelve 0 |
| ¿Unlock dispara reset()/clear() por efecto secundario? | **SÍ.** `resetRadarSilent()` llama `hydrationStore.reset()` + `_hydrateFromBackend()` después de purgar el motor |
| ¿La UI se hidrata con la verdad del motor al montarse? | **Sí, pero la "verdad" es 0 después de un purge.** El motor purgado devuelve speed=0, no el neutral 50 |
| **CAUSA RAÍZ (Tab Switch)** | `TheProgrammer.useEffect` tiene `isActive` en sus deps, causando `hydrateFromL2` que sobrescribe `movementStore.patternSpeed` con valores stale del backend cada vez que Controls se activa |
| **CAUSA RAÍZ (Unlock)** | `resetRadarSilent()` llama `reset()` + `_hydrateFromBackend()` después de que `kineticHandoff` ya purgó el motor. El backend purgado devuelve 0, sobrescribiendo el 50 neutral |

**La UI no sufre de falta de elevación de estado — sufre de dos
inyecciones laterales que sobrescriben el estado elevado:**

1. **TheProgrammer** inyecta valores del backend L2 al movementStore
   cuando la pestaña Controls se activa (Bug A).
2. **resetRadarSilent** inyecta valores del backend purgado al
   hydrationStore después de un Unlock (Bug B).

Ambas inyecciones destruyen el intent del operador. La UI es un espejo
correcto del hydrationStore — pero el hydrationStore está siendo
envenenado por dos code paths que no respetan la propiedad del estado.

---

## 5. REFERENCIAS DE CÓDIGO

- `StageSidebar.tsx:49` — `activeTab` es `useState` local (no persistente)
- `StageSidebar.tsx:104-111` — Tabs usan `display: none/flex` (componentes se mantienen montados)
- `StageSidebar.tsx:105` — `<TheProgrammer isActive={activeTab === 'controls'} />`
- `TheProgrammer.tsx:109-184` — useEffect con `isActive` en deps
- `TheProgrammer.tsx:128` — Guard `if (!isActive) return`
- `TheProgrammer.tsx:165-176` — `hydrateMovementFromL2` sobrescribe movementStore
- `TheProgrammer.tsx:184` — Dependency array incluye `isActive`
- `KineticsCathedral.tsx:76-79` — UI lee de `hydrationStore.aggregate`
- `KineticsCathedral.tsx:109-118` — UI escribe a `movementStore`
- `KineticsCathedral.tsx:145-188` — `handleUnlockKinetics`
- `KineticsCathedral.tsx:172` — `ms.setPatternSpeed(50)`
- `KineticsCathedral.tsx:176` — `ms.setPatternAmplitude(50)`
- `KineticsCathedral.tsx:180` — `KineticsBridge.resetRadarSilent()`
- `KineticsBridge.ts:151-201` — Subscription 1: pattern + speed + amplitude
- `KineticsBridge.ts:167-172` — `applyOperatorIntent` (optimistic hydration)
- `KineticsBridge.ts:303-319` — Subscription 5: selection change → `_hydrateFromBackend`
- `KineticsBridge.ts:337-381` — `_hydrateFromBackend` — IPC fetch + setNodeStates
- `KineticsBridge.ts:393-412` — `resetRadarSilent` — reset + re-hidratar
- `KineticsBridge.ts:410` — `hydrationStore.reset()` — clears to EMPTY
- `KineticsBridge.ts:411` — `_hydrateFromBackend` — fetch desde backend purgado
- `kineticHydrationStore.ts:128-137` — `EMPTY_AGGREGATE` (all null)
- `kineticHydrationStore.ts:240-243` — `reset()` — sets to EMPTY_AGGREGATE
- `movementStore.ts:158-178` — `DEFAULTS` (patternSpeed: 50, patternAmplitude: 50)
- `movementStore.ts:248-291` — `hydrateFromL2` — sobrescribe desde backend
- `movementStore.ts:252` — `patternSpeed: speed !== null ? speed * 100 : 50`
- `HorizontalFader.tsx:44-45` — `isMixed = value === null; numericValue = value ?? 50`
- `HorizontalFader.tsx:103` — `fillPct = isMixed ? 0 : numericValue` (null → 0% fill)

---

*Forense: GLM-5.2 High. Operación Amnesia — el estado estaba elevado, pero dos inyecciones laterales lo envenenaban.*
