# WAVE 4981 — FORENSIC AUDIT: MANUAL PATTERN STATE LEAK

**Date:** 2026-06-02  
**Status:** AUDIT COMPLETE — ZERO ASSUMPTIONS, ZERO CODE GENERATION  
**Scope:** Rastreo de ciclo de vida de activación/desactivación de patrones manuales en Kinetic Cathedral.

---

## 1. EL DISPARO (Frontend) — ¿Qué evento IPC se envía?

### 1.1 Activación de patrón

**File:** `src/components/hyperion/kinetics/KineticsCathedral.tsx` | **Lines:** 102–107

```typescript
const handlePatternChange = useCallback((pattern: PatternType) => {
  setActivePattern(pattern)
  useProgrammerStore.getState().setKineticSpeed(patternSpeed ?? 50)
}, [patternSpeed, setActivePattern])
```

`setActivePattern` escribe en `movementStore` (`useMovementStore`). El `KineticsBridge` suscribe ese store.

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 147–191

```typescript
const unsubPattern = useMovementStore.subscribe(
  (s) => ({
    activePattern: s.activePattern,
    patternSpeed: s.patternSpeed,
    patternAmplitude: s.patternAmplitude,
    fanValue: s.fanValue,
    chaosAmount: s.chaosAmount,
  }),
  ({ activePattern, patternSpeed, patternAmplitude, fanValue, chaosAmount }) => {
    const selectedIds = getSelectedIds()
    if (selectedIds.length === 0) return
    // ... optimistic hydration ...
    this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude, chaosAmount * 100)
    // ... también re-emitir classic flush con canales orbit vs absoluto ...
    const { pan, tilt } = useMovementStore.getState()
    this._scheduleClassicFlush(pan, tilt, fanValue)
  },
)
```

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 530–602

```typescript
private async _flushPattern(
  activePattern: string,
  patternSpeed: number,
  patternAmplitude: number,
  fanValue: number,
): Promise<void> {
  const fixtureIds = getSelectedIds()
  if (fixtureIds.length === 0) return
  const enginePattern = toEnginePattern(activePattern)  // 'none'|'static' → 'hold'

  // CLEAN BUS: si patrón y fixtures son los mismos, usa updateKineticScalars (sin reinicio de fase).
  const fixtureKey = fixtureIds.slice().sort().join(',')
  const isStop = enginePattern === 'hold'
  const samePatternAndFixtures =
    !isStop &&
    enginePattern === this._lastPatternSent &&
    fixtureKey === this._lastFixtureKeysSent

  if (samePatternAndFixtures) {
    await window.lux?.aether?.updateKineticScalars({ fixtureIds, speed, amplitude, fan })
    return
  }

  this._lastPatternSent = isStop ? null : enginePattern
  this._lastFixtureKeysSent = isStop ? null : fixtureKey

  // WAVE 4708 T2 — leer posición actual del radar para usar como anchor
  const { pan: anchorPanDeg, tilt: anchorTiltDeg } = useMovementStore.getState()
  const anchorPan  = Math.max(0, Math.min(1, anchorPanDeg  / 540))
  const anchorTilt = Math.max(0, Math.min(1, anchorTiltDeg / 270))

  await window.lux?.aether?.setManualPattern({
    fixtureIds,
    pattern: enginePattern,  // ej. 'circle', 'eight', 'hold'
    speed: patternSpeed,
    amplitude: patternAmplitude,
    fan: fanValue,
    anchorPan,
    anchorTilt,
  })
}
```

### 1.2 Desactivación de patrón — CRÍTICO

**File:** `src/components/hyperion/kinetics/KineticsCathedral.tsx` | **Lines:** 141–177

```typescript
const handleUnlockKinetics = useCallback(() => {
  // 1) NodeArbiter L2 (solo dominio KINETIC)
  useProgrammerStore.getState().releaseKinetics()
  if (selectedIds.length > 0) {
    // 2) Motor L2 + VMM legacy + KineticEngine
    void window.lux?.aether?.setManualPattern({
      fixtureIds: selectedIds,
      pattern: null,
      speed: 50,
      amplitude: 50,
    })
    // 3) VMM: limpiar phase offsets del fan residuales
    void window.lux?.aether?.setKineticFanOffsets({})
  }
  // 4) Safety net: barrer Dual-Map global del motor
  void window.lux?.aether?.clearAllMotorKineticOverrides?.()
  // ... UI reset ...
}, [selectedIds])
```

**Verdict:** Al apagar se envía **explícitamente** `pattern: null` vía IPC `lux:aether:setManualPattern`. **NO** es un simple "dejar de enviar data". Es un comando de limpieza explícito.

**PERO — hay un gap:** si el usuario **cambia de patrón directamente** (ej. de 'circle' a 'eight') sin apagar primero, el bridge envía un nuevo `setManualPattern` con el patrón nuevo. No hay comando intermedio de limpieza. Veremos las consecuencias en el motor.

---

## 2. LA RECEPCIÓN (Backend / IPCHandlers)

### 2.1 Handler IPC

**File:** `src/core/aether/AetherIPCHandlers.ts` | **Lines:** 397–549

```typescript
ipcMain.handle(
  'lux:aether:setManualPattern',
  (_event, { fixtureIds, pattern, speed, amplitude, fan, anchorPan, anchorTilt }) => {
    // ... validación ...
    const arbiter = getTitanOrchestrator().getAetherArbiter()

    // ══ RAMA DE APAGADO ══
    if (pattern === null || pattern === 'static' || pattern === 'hold') {
      const removeNodeIds = fixtureIds.map(id => `${id}:kinetic`)
      aetherKineticEngine.removeNodes(removeNodeIds, arbiter)

      // [WAVE 4937.1] EXPLICIT ARBITER CACHE PURGE ON UNLOCK
      if (pattern === null && anchorPan === undefined && anchorTilt === undefined) {
        for (const id of fixtureIds) {
          arbiter.clearManualOverride(`${id}:kinetic`)
        }
      }

      // Silenciar VMM solo si motor ya no tiene pistas
      if (!aetherKineticEngine.isActive()) {
        vibeMovementManager.setManualPattern(null)
        vibeMovementManager.setManualSpeed(null)
        vibeMovementManager.setManualAmplitude(null)
        vibeMovementManager.setKineticFanOffsets({})
      }
      return { success: true }
    }

    // ══ RAMA DE ENCENDIDO ══
    // Normalizar UI [0-100] → [0,1]
    const speedNorm     = (speed     ?? 50) / 100
    const amplitudeNorm = (amplitude ?? 50) / 100
    const fanNorm       = (fan       ?? 0)  / 100

    // Wire-up del Relative Offset Amplitude
    arbiter.setRelativeOffsetAmplitude(amplitudeNorm * 2)

    const nodeIds = fixtureIds.map(id => `${id}:kinetic`)
    const nativePattern = mapToNativePattern(pattern)

    // Silenciar VMM (coste de CPU inútil, aunque L2 supremacy ya bloquea L0)
    vibeMovementManager.setManualPattern(null)
    vibeMovementManager.setManualSpeed(null)
    vibeMovementManager.setManualAmplitude(null)
    vibeMovementManager.setKineticFanOffsets({})

    // ⚡ WAVE 4916 — IK ANCHOR PRESERVATION
    // Para cada nodo resuelve anchor con jerarquía: live > IK > payload > cache > 0.5
    // Luego escribe en _manualOverrides del arbiter
    for (const nodeId of nodeIds) {
      const manual = arbiter.getManualOverride(nodeId)
      const motor  = arbiter.getMotorKineticOverride(nodeId)
      const livePan  = manual && Number.isFinite(manual['pan'])  ? manual['pan']  : null
      const liveTilt = manual && Number.isFinite(manual['tilt']) ? manual['tilt'] : null
      const ikPan  = motor && Number.isFinite(motor['pan_base'])  ? motor['pan_base']  : null
      const ikTilt = motor && Number.isFinite(motor['tilt_base']) ? motor['tilt_base'] : null
      const cachePan  = manual && Number.isFinite(manual['pan_base'])  ? manual['pan_base']  : null
      const cacheTilt = manual && Number.isFinite(manual['tilt_base']) ? manual['tilt_base'] : null

      const resolvedAnchorPan  = livePan  ?? ikPan  ?? fallbackPan  ?? cachePan  ?? 0.5
      const resolvedAnchorTilt = liveTilt ?? ikTilt ?? fallbackTilt ?? cacheTilt ?? 0.5

      const prev = manual ?? {}
      arbiter.setManualOverride(nodeId, { ...prev, pan_base: resolvedAnchorPan, tilt_base: resolvedAnchorTilt })
    }

    // Activar motor nativo
    aetherKineticEngine.setManualKinetics(nodeIds, nativePattern, speedNorm, amplitudeNorm, fanNorm, arbiter)
    return { success: true, pattern: nativePattern }
  }
)
```

### 2.2 ¿Dónde almacena el backend los parámetros?

**File:** `src/core/aether/AetherKineticEngine.ts` | **Lines:** 306–323

```typescript
export class AetherKineticEngine {
  /** Acumulador de fase monotónico por nodeId (radianes) */
  private readonly _phaseMap = new Map<string, number>()

  /** Pool de override records pre-allocated por nodeId */
  private readonly _overridePool = new Map<string, { pan_base: number; tilt_base: number }>()

  /** Configuración activa por nodo (multitrack) */
  private readonly _nodeConfigs = new Map<string, KineticNodeConfig>()

  /** WAVE 4750 — posición del frame anterior por nodo */
  private readonly _prevPositionMap = new Map<string, Float64Array>()
```

---

## 3. EL ACUMULADOR FALLA — State Leaks Confirmados

### 3.1 STATE LEAK #1: Fase heredada al cambiar de patrón

**File:** `src/core/aether/AetherKineticEngine.ts` | **Lines:** 382–398

```typescript
for (let i = 0; i < total; i++) {
  const nodeId = nodeIds[i]
  if (!this._phaseMap.has(nodeId)) {
    this._phaseMap.set(nodeId, 0)   // ← SOLO inicializa si NO existe
  }
  if (!this._overridePool.has(nodeId)) {
    this._overridePool.set(nodeId, { pan_base: 0.5, tilt_base: 0.5 })
  }
  this._nodeConfigs.set(nodeId, {
    pattern, speed, amplitude, fan, fanIndex, fanTotal,
  })
}
```

**Verdict:** `_phaseMap.set(nodeId, 0)` solo se ejecuta cuando el nodo **no existe** en el Map. Si el usuario cambia de patrón (ej. 'circle' → 'eight') para los mismos fixtures:

1. `_nodeConfigs` se sobrescribe con el nuevo patrón ✓
2. `_phaseMap.get(nodeId)` retorna la **fase acumulada del patrón anterior** ✗
3. El nuevo patrón recibe `PATTERN_FN['eight'](oldPhase + fanOffset)` → posición completamente diferente a la esperada

**Consecuencia:** El patrón nuevo **hereda la fase del patrón anterior**. Si 'circle' estaba en fase π y se cambia a 'eight', el 'eight' arranca desde π en lugar de 0, provocando un salto brusco.

### 3.2 STATE LEAK #2: `_prevPositionMap` no limpiado en `removeNodes`

**File:** `src/core/aether/AetherKineticEngine.ts` | **Lines:** 406–414

```typescript
removeNodes(nodeIds: string[], arbiter: NodeArbiter): void {
  for (const nodeId of nodeIds) {
    if (this._nodeConfigs.delete(nodeId)) {
      arbiter.clearMotorKineticOverride(nodeId)
      this._phaseMap.delete(nodeId)
      // _overridePool y _manualOverrides: PRESERVADOS — paradigma Programmer.
    }
  }
}
```

**Verdict:** `_prevPositionMap` (WAVE 4750 Filtro Glaciar) **NO se borra**. Si:
1. Se desactiva patrón → `removeNodes` borra `_nodeConfigs` y `_phaseMap`
2. Se reactiva patrón más tarde → `_prevPositionMap` sigue teniendo la posición del frame anterior
3. El Filtro Glaciar calcula velocidad respecto a un valor potencialmente stale

**Consecuencia:** El dither anti-jitter puede activarse incorrectamente o no activarse cuando debería, basándose en una posición de hace segundos o minutos.

### 3.3 STATE LEAK #3: `vibeMovementManager` schedulerState sigue avanzando

**File:** `src/engine/movement/VibeMovementManager.ts` | **Lines:** 968–975

```typescript
// PASO A: avanzar fase a ritmo de cycleBeats
const phasePerBeat = (2 * Math.PI) / currentCycleBeats
this.schedulerState.phase += effectiveBeats * phasePerBeat

// PASO B: avanzar contador de escena
this.schedulerState.sceneBeatsElapsed += effectiveBeats
```

**Verdict:** Cuando un patrón manual está activo, el VMM (L0) se silencia (`setManualPattern(null)`) pero **el método `generateIntent()` sigue siendo llamado** en cada tick para los fixtures que NO están en modo manual. El `schedulerState` del VMM sigue acumulando fase globalmente.

Cuando se desactiva el patrón manual (vuelve a L0/Selene), el VMM retoma con `schedulerState.phase` que **nunca dejó de avanzar**. El patrón automático no retoma desde donde el operador lo dejó, sino desde una fase "adelantada" por el tiempo transcurrido en manual.

**Consecuencia:** Al desactivar el patrón manual, los fixtures que vuelven a control automático pueden saltar a una posición inesperada porque la fase del VMM siguió avanzando en background.

### 3.4 STATE LEAK #4: `_manualOverrides` preservados en removeNodes

**File:** `src/core/aether/AetherKineticEngine.ts` | **Lines:** 411

```typescript
// _overridePool y _manualOverrides: PRESERVADOS — paradigma Programmer.
```

**Verdict:** El comentario lo dice explícitamente: `_overridePool` y `_manualOverrides` se **preservan** en `removeNodes`. El `_overridePool` es el pool de objetos reutilizados (`{ pan_base, tilt_base }`). Si se reactiva el nodo, el `_overridePool.get(nodeId)` retorna el objeto del patrón anterior con valores potencialmente stale hasta que `tick()` lo sobrescribe.

Más crítico: en `AetherIPCHandlers.ts` line 428:

```typescript
if (pattern === null && anchorPan === undefined && anchorTilt === undefined) {
  for (const id of fixtureIds) {
    arbiter.clearManualOverride(`${id}:kinetic`)
  }
}
```

`clearManualOverride` SOLO se llama si `anchorPan === undefined && anchorTilt === undefined`. Pero en el flujo normal de `_flushPattern`, **siempre** se envía `anchorPan` y `anchorTilt` (líneas 580–595 del bridge). Cuando se envía `pattern: null` desde el bridge en unlock, el payload es:

```typescript
{ fixtureIds, pattern: null, speed: 50, amplitude: 50 }
// anchorPan y anchorTilt NO están definidos → undefined
```

En este caso, `anchorPan === undefined && anchorTilt === undefined` es **true**, así que `clearManualOverride` SÍ se ejecuta. Pero... ¿qué pasa si algún caller envía `pattern: null` con `anchorPan` definido? El `clearManualOverride` NO se ejecutaría y `_manualOverrides` quedaría con los anchors del patrón anterior.

### 3.5 STATE LEAK #5: `KineticsBridge._lastPatternSent` no invalida en unlock del frontend

**File:** `src/bridges/KineticsBridge.ts` | **Lines:** 543–574

```typescript
this._lastPatternSent = isStop ? null : enginePattern
this._lastFixtureKeysSent = isStop ? null : fixtureKey
```

**Verdict:** Cuando se envía `pattern: null`, `_lastPatternSent` se invalida a `null`. Esto está correcto.

**PERO:** si el operador hace UNLOCK (pattern=null) y luego inmediatamente selecciona un nuevo fixture y activa un patrón, `_lastPatternSent` es `null` así que va por la ruta completa. No hay leak aquí.

**Sin embargo:** si el operador cambia de patrón **sin desactivar primero** (ej. 'circle' → 'eight'):
1. Bridge envía `setManualPattern` con 'eight'
2. `_lastPatternSent` se actualiza a 'eight'
3. Si luego el operador ajusta speed/amplitude con el slider:
   - Bridge ve `samePatternAndFixtures = true` (porque _lastPatternSent === 'eight')
   - Usa `updateKineticScalars` (sin reiniciar fase) ✓ — esto es intencional
4. PERO si el operador ahora apaga (pattern=null) y luego reactiva 'eight':
   - `_lastPatternSent = null` (stop)
   - Luego `_lastPatternSent = 'eight'` (reactivación)
   - Va por ruta completa (setManualPattern, no updateKineticScalars)
   - `setManualKinetics` NO reinicia fase → la fase del apagado anterior persiste

---

## 4. RESUMEN DE FUGAS CONFIRMADAS

| # | Ubicación | Estado fugado | Impacto |
|---|-----------|---------------|---------|
| 1 | `AetherKineticEngine.setManualKinetics` | `_phaseMap` NO reinicia al cambiar patrón | Salto brusco: nuevo patrón hereda fase del anterior |
| 2 | `AetherKineticEngine.removeNodes` | `_prevPositionMap` NO se borra | Filtro Glaciar usa posición stale al reactivar |
| 3 | `VibeMovementManager.generateIntent` | `schedulerState.phase` sigue avanzando en background | Al volver a L0, Selene retoma en fase adelantada |
| 4 | `AetherKineticEngine.removeNodes` | `_overridePool` preservado | Primer frame post-reactivación puede usar valores stale hasta que `tick()` los sobrescribe |
| 5 | `AetherIPCHandlers.ts:428` | `clearManualOverride` condicional a `anchorPan === undefined` | Si un caller envía pattern=null con anchor definido, `_manualOverrides` queda con anchors del patrón anterior |

---

## 5. ¿POR QUÉ LOS FIXTURES RETIENEN LA POSICIÓN ANTERIOR?

**Causa raíz combinada:**

1. El usuario desactiva patrón manual → `removeNodes` borra `_nodeConfigs` y `_phaseMap` pero **preserva `_manualOverrides`** en el Arbiter.
2. `clearManualOverride` en el handler se ejecuta (porque anchorPan/anchorTilt son undefined en el payload de unlock), así que `_manualOverrides` SÍ se limpia.
3. PERO: el bridge también envía `_scheduleClassicFlush` después de cada cambio de patrón (línea 182 del bridge). Si el radar está en cierta posición, el flush clásico escribe `pan_base`/`tilt_base` en `_manualOverrides`.
4. Si el operador NO movió el radar, el flush clásico escribe la posición por defecto (270°, 135° → 0.5, 0.5) como `pan_base`/`tilt_base`.
5. Post-unlock, si el VMM (L0) retoma pero el operador no ha movido el radar, el `_flushClassic` con `hasPattern = false` (porque pattern=null) escribe `pan`/`tilt` absolutos en lugar de `pan_base`/`tilt_base`. Esto puede crear un lock L2 absoluto que congela el fixture.

**Esto explica por qué los moving heads "retienen la posición anterior" o "se congelan" tras desactivar un patrón manual.**

---

*End of WAVE 4981 Forensic Audit Report.*
