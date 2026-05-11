# KINETIC UNFREEZE AUDIT — WAVE 4718

**Auditor:** Sonnet (Forensic Code Analysis)
**Fecha:** 2026-05-11
**Alcance:** Flujo L2 de Cinética — KineticsBridge, KineticCathedral, VibeMovementManager, NodeArbiter, ProgrammerAetherBridge
**Mandato:** MODO SÓLO LECTURA. Sin alterar código.

**Archivos auditados:**
- `src/bridges/KineticsBridge.ts` (477 líneas)
- `src/bridges/ProgrammerAetherBridge.ts` (346 líneas)
- `src/components/hyperion/kinetics/KineticsCathedral.tsx` (284 líneas)
- `src/components/hyperion/kinetics/KinRadarViewport.tsx` (337 líneas)
- `src/components/hyperion/controls/TheProgrammer.tsx` (390 líneas)
- `src/core/aether/NodeArbiter.ts` (603 líneas)
- `src/core/aether/AetherIPCHandlers.ts` (547 líneas)
- `src/core/aether/adapters/KineticAdapter.ts` (233 líneas)
- `src/engine/movement/VibeMovementManager.ts` (1165 líneas)
- `src/stores/programmerStore.ts` (681 líneas)
- `src/stores/movementStore.ts` (228 líneas)

---

## VECTOR 1: LOS "GUARDS" DEL KINETICS BRIDGE (El Congelamiento)

### 1.1 Hallazgo Forense: Auto-bloqueo del Radar contra el Patrón

**Síntoma:** Al asignar posición desde el Radar XY, los focos se congelan y anulan el motor de patrones.

**Causa raíz:** `_flushClassic()` en `KineticsBridge.ts` está diseñado para escribir `pan_base`/`tilt_base` cuando hay un patrón activo (permitiendo que el patrón oscile alrededor del punto del radar). PERO un guard `hasProgrammerKineticManual()` aborta el flush completo si detecta overrides L2 de `pan`/`tilt` en `programmerStore`. El problema es que **el propio Radar es la fuente de esos overrides L2**.

```typescript
// KineticsBridge.ts:278-320
private async _flushClassic(pan: number, tilt: number, fanValue: number): Promise<void> {
  const fixtureIds = getSelectedIds()
  if (fixtureIds.length === 0) return
  if (hasProgrammerKineticManual(fixtureIds)) return   // ← ████████ EARLY RETURN ████████
  // ... nunca llega a escribir pan_base/tilt_base
```

**Cómo el Radar crea el override que lo bloquea:**

```typescript
// KinRadarViewport.tsx:185-208
const handlePanTiltChange = useCallback((newPan: number, newTilt: number) => {
  setPanTilt(sp, st)                                    // 1. UI state
  if (movingHeadIds.length > 1) {
    useProgrammerStore.getState().setPositionPerFixture(positions)  // ← L2 OVERRIDE
  } else {
    useProgrammerStore.getState().setPosition(sp, st)   // ← L2 OVERRIDE
  }
}, ...)
```

El Radar siempre escribe `pan`/`tilt` absolutos en `programmerStore` (familia KINETIC, L2). Luego, cuando `KineticsBridge` suscribe a `movementStore` y detecta el cambio, intenta correr `_flushClassic()`. El guard detecta que `programmerStore.fixtureOverrides` tiene `pan`/`tilt` para los fixtures seleccionados, y hace early return.

### 1.2 Hallazgo Forense: `pan_base`/`tilt_base` nunca llegan al NodeArbiter

La arquitectura pretendía que `_flushClassic` escriba canales diferenciados según el estado del patrón:

```typescript
// KineticsBridge.ts:291-295
const { activePattern, chaosAmount, chaosSeed } = useMovementStore.getState()
const hasPattern  = isActivePattern(activePattern)
const panChannel  = hasPattern ? 'pan_base'  : 'pan'
const tiltChannel = hasPattern ? 'tilt_base' : 'tilt'
```

Cuando **no hay patrón**: escribe `pan`/`tilt` (absolutos) → el NodeArbiter aplica LTP y el fixture se queda quieto.

Cuando **hay patrón**: debería escribir `pan_base`/`tilt_base`. El NodeArbiter tiene una SUMA MATEMÁTICA especial para estos canales:

```typescript
// NodeArbiter.ts:322-329
if (key === 'pan_base') {
  const l0 = isFiniteChannelValue(record['pan']) ? record['pan'] : 0.5
  const v  = incoming + (l0 - 0.5)
  record['pan'] = v < 0 ? 0 : v > 1 ? 1 : v
} else if (key === 'tilt_base') {
  const l0 = isFiniteChannelValue(record['tilt']) ? record['tilt'] : 0.5
  const v  = incoming + (l0 - 0.5)
  record['tilt'] = v < 0 ? 0 : v > 1 ? 1 : v
}
```

**Esto es elegantísimo:** `pan_base` no sobreescribe `pan`. Suma la desviación del LFO de L0 sobre la base del radar. El patrón oscila alrededor del punto exacto del operador.

**PERO:** `pan_base`/`tilt_base` NUNCA llegan al NodeArbiter porque `_flushClassic` aborta ANTES de construir el payload. El guard mata el canal antes de que la suma ocurra.

### 1.3 Hallazgo Forense: `_flushPattern` también está bloqueado

```typescript
// KineticsBridge.ts:334-358
private async _flushPattern(activePattern, patternSpeed, patternAmplitude): Promise<void> {
  const fixtureIds = getSelectedIds()
  if (fixtureIds.length === 0) return
  if (hasProgrammerL2Manual(fixtureIds)) return   // ← ████████ EARLY RETURN ████████
  // ... nunca envía el patrón al masterArbiter ni al VMM
```

`hasProgrammerL2Manual` y `hasProgrammerKineticManual` son **FUNCIONES IDÉNTICAS** (líneas 51-67 y 94-110). Ambas verifican `ov.pan !== null || ov.tilt !== null || ov.speed !== null || ...`.

**Impacto combinado:**
1. Operador mueve el radar → `programmerStore` guarda `pan`/`tilt` L2
2. Operador activa un patrón → `_flushPattern()` aborta (L2 detectado)
3. El patrón NO se registra en `masterArbiter` ni en `vibeMovementManager`
4. PERO: si el patrón YA estaba activo antes de mover el radar, el VMM sigue generando intents L0
5. El NodeArbiter aplica L2 `pan`/`tilt` del radar con LTP sobre L0 del patrón
6. **Resultado: fixtures congelados en la posición del radar, patrón invisible**

### 1.4 Veredicto Vector 1

El congelamiento es un **ciclo de auto-bloqueo arquitectónico**. El Radar es a la vez la fuente de entrada y la fuente de bloqueo. El diseño de `pan_base`/`tilt_base` es matemáticamente correcto en el NodeArbiter, pero el KineticsBridge nunca llega a inyectar esos canales porque se protege contra sí mismo.

---

## VECTOR 2: LA PARADOJA DEL UNLOCK (Inconsistencia de Estado)

### 2.1 Hallazgo Forense: Dos botones "Unlock" que hacen cosas radicalmente diferentes

| Botón | Ubicación | Acciones |
|---|---|---|
| **🔓 UNLOCK** | KineticsCathedral.tsx:233 | 1. `programmerStore.releaseAll()`  2. `window.lux.aether.setManualPattern({pattern:null})`  3. `movementStore.setActivePattern('none')` |
| **🔓 UNLOCK ALL** | TheProgrammer.tsx:317-323 | 1. `programmerStore.releaseAll()`  2. `window.lux.aether.clearInhibitLimit(nodeIds)` |

**Discrepancia crítica:**
- El Unlock de la **Cathedral** limpia el patrón activo del VMM y del masterArbiter
- El Unlock de **TheProgrammer** NO limpia el patrón → el patrón sigue corriendo en VMM/masterArbiter

Esto significa que un operador que presiona "Unlock All" en el Programmer espera que los fixtures vuelvan al control AI (incluyendo el patrón), pero el patrón del VMM sigue seteado. Si el VMM tenía `manualPatternOverride='circle_big'`, ese patrón sigue generando intents L0 aunque el operador pensó que hizo unlock completo.

### 2.2 Hallazgo Forense: Unlock del Cathedral NO limpia `manualOverrideFixtureIds`

```typescript
// KineticsCathedral.tsx:150-166
const handleUnlockKinetics = useCallback(() => {
  useProgrammerStore.getState().releaseAll()
  if (selectedIds.length > 0) {
    void window.lux?.aether?.setManualPattern({ fixtureIds: selectedIds, pattern: null, speed: 50, amplitude: 50 })
  }
  useMovementStore.getState().setActivePattern('none')
}, [selectedIds])
```

**Falta:** `setManualOverrideForFixtures(movingHeadIds, false)` — nunca limpia `manualOverrideFixtureIds`.

Consecuencia en `KineticsBridge.ts` (Suscripción 3 y 4, líneas 195-227):

```typescript
// Spatial flush guard
if (ids.length > 0 && ids.every(id => manualOverrideFixtureIds.has(id))) return
```

Si un fixture fue marcado con `manualOverrideFixtureIds` (por ejemplo, al usar el spatial target pad, aunque esté en cuarentena), y luego se hace Unlock desde la Cathedral, el fixture sigue en `manualOverrideFixtureIds`. Si en el futuro se rehabilita spatial mode, ese fixture estaría bloqueado para spatial flush aunque no tenga overrides reales.

### 2.3 Hallazgo Forense: Unlock del Cathedral NO limpia `lockedFixtureIds`

```typescript
// KineticsBridge.ts:442-451
if (result?.results) {
  const locked = new Set<string>()
  for (const [id, res] of Object.entries(result.results)) {
    const r = res as { locked?: boolean; success?: boolean }
    if (r.locked === true || r.success === false) locked.add(id)
  }
  useMovementStore.getState().setLockedFixtures(locked)
```

Una vez que un fixture entra en `lockedFixtureIds` (motor superior activo), **nunca sale** a menos que el backend envíe `locked:false` en una respuesta posterior. El Unlock del Cathedral no toca este Set. En la UI, esto se traduce en que los faders SPEED/AMP aparecen `disabled={anyLocked}` permanentemente.

### 2.4 Hallazgo Forense: `releaseAll()` crea "empty override zombies"

```typescript
// programmerStore.ts:636-662
releaseAll: () => {
  set(state => {
    const next = new Map<string, ProgrammerOverrides>()
    for (const id of state.activeFixtureIds) {
      next.set(id, createEmptyOverrides())   // ← NO VACÍO: tiene entries vacías
    }
    // ...
  })
}
```

`releaseAll()` no vacía el Map completamente. Crea entries vacíos para cada `activeFixtureId`. Esto significa que `fixtureOverrides.has(id)` sigue retornando `true` para fixtures en la selección activa, aunque todos sus valores sean `null`.

Impacto en `hasProgrammerKineticManual()`:
```typescript
// KineticsBridge.ts:51-67
function hasProgrammerKineticManual(fixtureIds: string[]): boolean {
  const overrides = useProgrammerStore.getState().fixtureOverrides
  for (const id of fixtureIds) {
    const ov = overrides.get(id)
    if (!ov) continue          // ← si ov es undefined, salta (OK)
    const hasKinetic = ov.pan !== null || ...
    // si ov existe pero todo es null, hasKinetic=false (OK)
```

Afortunadamente, `hasProgrammerKineticManual` itera sobre los valores y verifica `!== null`, así que los zombies vacíos no disparan el guard. PERO `fixtureOverrides.get(id)` retorna un objeto, no `undefined`. Esto tiene implicaciones de memoria (el Map crece monótonamente con fixtures tocados durante el show).

### 2.5 Veredicto Vector 2

El Unlock del Cathedral **SÍ purifica el backend** (limpia L2 del NodeArbiter vía `releaseAll` + bridge flush, y limpia patrón VMM vía IPC). No es un "booleano tonto". PERO:

1. **Hay dos semánticas de Unlock** (Programmer vs Cathedral) que no están alineadas
2. **`manualOverrideFixtureIds` queda zombificado** después del Unlock
3. **`lockedFixtureIds` queda zombificado** después del Unlock
4. **`releaseAll()` no vacía el Map** — crea entries vacíos que persisten

---

## VECTOR 3: EL FAN/CAOS (Determinismo de Fase)

### 3.1 Hallazgo Forense: El fader de Fan SÍ llega al backend

Flujo completo verificado:

```typescript
// 1. UI: KineticsCathedral.tsx → ChaosOrderSlider o Radar gesture → movementStore.setFanValue()

// 2. Bridge: KineticsBridge.ts suscripción Classic (líneas 179-193)
const unsubClassic = useMovementStore.subscribe(
  (s) => ({ pan: s.pan, tilt: s.tilt, fanValue: s.fanValue, ... }),
  ({ pan, tilt, fanValue }) => {
    this._scheduleClassicFlush(pan, tilt, fanValue)
    this._scheduleFanPhaseFlush(fanValue)   // ← WAVE 4717.2
  },
)

// 3. _flushFanPhase: KineticsBridge.ts:391-412
private async _flushFanPhase(fanValue: number): Promise<void> {
  const fixtureIds = getSelectedIds()
  const n = fixtureIds.length
  const fanSpread = fanValue / 100
  const TWO_PI = 2 * Math.PI

  const offsets: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0   // ← 0..1 uniforme por ORDEN DE SELECCIÓN
    offsets[`${fixtureIds[i]}:kinetic`] = fanSpread * t * TWO_PI
  }

  await window.lux?.aether?.setKineticFanOffsets(offsets)  // ← IPC al VMM
}
```

**Sí, el fader llega al VMM.** La ruta es:
`movementStore.fanValue` → `KineticsBridge._scheduleFanPhaseFlush` → `_flushFanPhase` → IPC `lux:aether:setKineticFanOffsets` → `AetherIPCHandlers` → `vibeMovementManager.setKineticFanOffsets(offsets)`.

### 3.2 Hallazgo Forense: La matemática de fan existe y es correcta

El bridge calcula un `phaseOffset` por fixture basado en el **orden de selección del usuario** (no en `stereoIndex` físico):

```typescript
// KineticsBridge.ts:400-404
const offsets: Record<string, number> = {}
for (let i = 0; i < n; i++) {
  const t = n > 1 ? i / (n - 1) : 0
  offsets[`${fixtureIds[i]}:kinetic`] = fanSpread * t * TWO_PI
}
```

- `fanValue = 0` → `fanSpread = 0` → todos los offsets son `0` → fase unificada (Borg mode)
- `fanValue = 100` → `fanSpread = 1` → último fixture tiene offset `2π` → un ciclo completo de spread

Este `Record<nodeId, phaseOffset>` se almacena en el VMM:

```typescript
// VibeMovementManager.ts:695-706
readonly _l2PhaseOverrides: Record<string, number> = {}

setKineticFanOffsets(offsets: Record<string, number>): void {
  for (const key in this._l2PhaseOverrides) {
    if (!(key in offsets)) delete this._l2PhaseOverrides[key]
  }
  for (const key in offsets) {
    this._l2PhaseOverrides[key] = offsets[key]
  }
}
```

### 3.3 Hallazgo Forense: El VMM suma el phaseOffset en el hot-path

```typescript
// KineticAdapter.ts:183-194
const lrPhaseOffset = (node.physicalPosition?.x ?? 0) > 0 ? Math.PI : 0
const l2PhaseOffset = this._vmm._l2PhaseOverrides[node.nodeId] ?? 0
const phaseOffset   = lrPhaseOffset + l2PhaseOffset

const intent = this._vmm.generateIntent(
  vibeId, va, node.stereoIndex, node.stereoTotal, node.maxPanSpeed, phaseOffset,
)
```

```typescript
// VibeMovementManager.ts:828
const phase = this.phaseAccumulator + phaseOffset

// VibeMovementManager.ts:837
const rawPosition = patternFn(phase, audio, fixtureIndex, totalFixtures)
```

**Esto funciona.** El `phaseOffset` se suma al `phaseAccumulator` global antes de evaluar la función del patrón. Cada fixture recibe una fase ligeramente diferente, desfasando el patrón.

### 3.4 Verificación de la pregunta: ¿Itera sobre selectionOrder?

**Respuesta:** NO, el VMM no itera sobre `selectionOrder`. El VMM no conoce `selectionOrder`. La matemática del fan distribute vive en el **bridge** (`KineticsBridge._flushFanPhase`), no en el VMM. El VMM solo consume un `phaseOffset` diferente por `nodeId`. Esta separación de responsabilidades es correcta: el bridge conoce la selección del usuario; el VMM solo conoce fase y geometría.

### 3.5 Hallazgo Forense: `clearManualOverrides()` del VMM LIMPIA phase offsets, pero...

```typescript
// VibeMovementManager.ts:709-718
clearManualOverrides(): void {
  this.manualSpeedOverride = null
  this.manualAmplitudeOverride = null
  this.manualPatternOverride = null
  for (const key in this._l2PhaseOverrides) {
    delete this._l2PhaseOverrides[key]
  }
  console.log(`[CHOREO] All overrides cleared`)
}
```

**PERO:** `clearManualOverrides()` del VMM solo se llama desde dos lugares:
1. Dentro del propio VMM (no encontré llamadas externas en la auditoría)
2. Potencialmente desde `AetherIPCHandlers.ts` cuando `setManualPattern(null)` → `vibeMovementManager.setKineticFanOffsets({})` (línea 334)

El Unlock de **TheProgrammer** (`releaseAll()`) NO llama `setManualPattern(null)`, por lo tanto NO limpia `_l2PhaseOverrides`. Si un operador hace Unlock desde el Programmer, los phase offsets del fan siguen activos en el VMM aunque el UI diga que no hay fan.

---

## SÍNTESIS: LOS PUNTOS DE RUPTURA

### Punto de Ruptura #1: Guard recursivo en `_flushClassic` (KineticsBridge.ts:285)

```typescript
if (hasProgrammerKineticManual(fixtureIds)) return
```

Este guard aborta `_flushClassic` cuando `programmerStore` tiene overrides de `pan`/`tilt`. Como el Radar es la fuente de esos overrides, el sistema se auto-bloquea. **Nunca se escriben `pan_base`/`tilt_base`**. La suma matemática del NodeArbiter (líneas 322-329) nunca se ejecuta.

**Fix propuesto (análisis, no código):** `_flushClassic` debería ignorar `hasProgrammerKineticManual` cuando va a escribir `pan_base`/`tilt_base`, porque `pan_base`/`tilt_base` no compiten con `pan`/`tilt` del programmer — los SUMAN. O alternativamente, el Radar debería escribir `pan_base`/`tilt_base` directamente en `programmerStore` cuando hay patrón activo, en vez de `pan`/`tilt`.

### Punto de Ruptura #2: Guard simétrico en `_flushPattern` (KineticsBridge.ts:343)

```typescript
if (hasProgrammerL2Manual(fixtureIds)) return
```

`hasProgrammerL2Manual` es idéntica a `hasProgrammerKineticManual`. Cuando el operador mueve el radar, `_flushPattern` también se bloquea, impidiendo que el patrón se registre en `masterArbiter` y `vibeMovementManager`. El patrón manual NO se activa.

**Fix propuesto:** `_flushPattern` no debería bloquearse por overrides de posición. El patrón y la posición base son ortogonales. El operador debería poder tener un patrón activo Y una posición base del radar simultáneamente.

### Punto de Ruptura #3: Divergencia de Unlock (Programmer vs Cathedral)

| Acción | Cathedral | Programmer |
|---|---|---|
| Limpia L2 NodeArbiter | SÍ (`releaseAll`) | SÍ (`releaseAll`) |
| Limpia patrón VMM | SÍ (`setManualPattern(null)`) | NO |
| Limpia `_l2PhaseOffsets` | SÍ (implícito vía `setManualPattern(null)`) | NO |
| Limpia `manualOverrideFixtureIds` | NO | N/A |
| Limpia `lockedFixtureIds` | NO | N/A |
| Resetea UI pattern | SÍ (`setActivePattern('none')`) | N/A |

El operador no puede predecir qué hará "Unlock" dependiendo de dónde lo pulse.

### Punto de Ruptura #4: `releaseAll()` no vacía el Map

```typescript
const next = new Map<string, ProgrammerOverrides>()
for (const id of state.activeFixtureIds) {
  next.set(id, createEmptyOverrides())   // ← ZOMBIE ENTRY
}
```

El Map `fixtureOverrides` crece monótonamente. Un show de 8 horas con selección frecuente puede acumular miles de entries vacíos. No causa bugs funcionales (los guards verifican `!== null`), pero es deuda técnica de memoria.

---

## CONCLUSIONES

1. **El congelamiento es real y arquitectónico.** No es un bug simple de typo — es un diseño donde el mecanismo de protección (guard L2) se dispara contra la propia fuente de control (radar).

2. **La suma matemática `pan_base`/`tilt_base` del NodeArbiter es correcta y elegante.** El problema no está en el merge de capas. Está en que el KineticsBridge nunca llega a inyectar esos canales.

3. **El Fan/Caos funciona correctamente.** El fader llega al VMM, los phase offsets se calculan por orden de selección, y se suman al phaseAccumulator. No falta matemática.

4. **El Unlock purifica el backend SÍ, pero de forma inconsistente.** La Cathedral limpia todo; el Programmer limpia solo L2. Además, quedan Sets zombificados (`manualOverrideFixtureIds`, `lockedFixtureIds`) que afectan guards futuros.

5. **Dos funciones idénticas (`hasProgrammerKineticManual` y `hasProgrammerL2Manual`)** sugieren que alguien intentó separar las semánticas pero no completó el refactor. La duplicación es un olor a código que indica confusión de responsabilidades.

---

*Fin del informe forense. Modo solo lectura respetado. Ningún archivo fue modificado.*
