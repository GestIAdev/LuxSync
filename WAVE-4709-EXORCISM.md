# ⚡ WAVE 4709 — THE EXORCISM (Orphan Diffing + Silent Radar Reset)

> El fantasma de sustitución exorcizado. Radares con amnesia restaurada.

---

## 👻 TARGET 1 — Fantasma de Sustitución (Orphan Diffing)

### Falla estructural
Cuando la selección pasa de `[A, B]` a `[C]`, el frontend re-emite `setManualPattern({ fixtureIds: [C] })`. El IPC handler en `AetherIPCHandlers.ts:437-442` (antes de este parche) limpiaba **solo `_manualOverrides`** (ancla L2) para A y B:

```ts
// ANTES — solo limpiaba el ancla, no el motor:
arbiter.clearManualOverride(prevNodeId)
```

Pero NO limpiaba `_motorKineticOverrides` (el Dual-Map de salida del engine). Como `NodeArbiter.arbitrate()` aplica `_motorKineticOverrides` en su bloque final (`NodeArbiter.ts:476-490`) y sobreescribe `pan`/`tilt` con el último valor del Map, A y B quedaban **congelados en la coordenada exacta** que el motor les calculó en su último tick antes del despido.

Además, si NO había patrón activo (solo radar drag), `prevKineticState.active === false` y la limpieza ni siquiera entraba — los `pan`/`tilt` del L2 manual también quedaban huérfanos.

### Destroy — Triple defensa

**1. Nuevo IPC selectivo** (`AetherIPCHandlers.ts` + `preload.ts` + `vite-env.d.ts`):
```ts
ipcMain.handle('lux:aether:clearMotorKineticOverrides', (_evt, nodeIds: string[]) => {
  for (const nodeId of nodeIds) arbiter.clearMotorKineticOverride(nodeId)
})
```
Espejo del existente `clearManualOverrides`, pero apuntando al Dual-Map del motor.

**2. Refuerzo en el handler `setManualPattern`** (`AetherIPCHandlers.ts:463-476`):
```ts
if (prevKineticState.active) {
  const newNodeSet = new Set(nodeIds)
  for (const prevNodeId of prevKineticState.nodeIds) {
    if (!newNodeSet.has(prevNodeId)) {
      arbiter.clearManualOverride(prevNodeId)
      arbiter.clearMotorKineticOverride(prevNodeId)  // ← LÍNEA AÑADIDA
    }
  }
}
```

**3. Orphan Diffing en el bridge** (`KineticsBridge.ts`):
- Nuevo campo privado `_prevSelectedIds: Set<string>` que persiste entre disparos.
- En `unsubSelection`:
  ```ts
  const orphans: string[] = []
  for (const prevId of this._prevSelectedIds) {
    if (!currentSelectedIds.has(prevId)) orphans.push(prevId)
  }
  if (orphans.length > 0) {
    const orphanNodeIds = orphans.map(id => `${id}:kinetic`)
    void window.lux?.aether?.clearManualOverrides?.(orphanNodeIds)
    void window.lux?.aether?.clearMotorKineticOverrides?.(orphanNodeIds)
  }
  this._prevSelectedIds = new Set(currentSelectedIds)
  ```

La limpieza del bridge se ejecuta **inmediatamente** (sin debounce), antes incluso de que el `setManualPattern` re-emitido tenga oportunidad de hacer su propio diff. Así el operador ve a A y B liberados al motor IA en el mismo frame en que C entra al programmer.

---

## 🎯 TARGET 2 — Amnesia Visual del Radar (Silent UI Reset)

### Falla estructural
`handleUnlockKinetics` liberaba el hardware (L2 + motor + inhibit) pero dejaba `movementStore.pan/tilt/fanValue/chaosAmount` con los últimos valores que el operador había arrastrado. Resultado: los radares XY (Individual y Formación) seguían mostrando la cruz donde la dejó el operador, aunque el hardware ya estuviera bajo control IA.

**La trampa**: si llamabas directamente `setPanTilt(270, 135)` desde el handler, la suscripción 2 del bridge (`unsubClassic`) se disparaba y reescribía `pan=0.5, tilt=0.5` en `_manualOverrides` → un nuevo lock manual L2 que volvía a bloquear al motor IA (L0). Auto-saboteo del Unlock.

### Destroy — Semáforo de supresión

**1. Nuevo método público `KineticsBridge.resetRadarSilent()`**:
```ts
private _suppressClassicFlushCount: number = 0

resetRadarSilent(): void {
  // Cancela cualquier flush clásico pendiente del último gesto del operador.
  if (this._classicFlushTimeout !== null) {
    clearTimeout(this._classicFlushTimeout)
    this._classicFlushTimeout = null
  }
  // Bumpear semáforo por 3 (cubre disparos derivados de cada slice del selector).
  this._suppressClassicFlushCount += 3
  const ms = useMovementStore.getState()
  ms.setPanTilt(270, 135)
  ms.setFanValue(0)
  ms.setChaosAmount(0)
}
```

**2. Guard en la suscripción clásica** (`KineticsBridge.ts` `unsubClassic`):
```ts
if (this._suppressClassicFlushCount > 0) {
  this._suppressClassicFlushCount--
} else {
  this._scheduleClassicFlush(pan, tilt, fanValue)
}
```

**3. Llamada desde el unlock** (`KineticsCathedral.tsx`):
```ts
// 7) WAVE 4709 T2 — RESET RADAR UI silencioso
KineticsBridge.resetRadarSilent()
```

Resultado: las cruces de los radares vuelven al centro (270°/135°), el slider Fan y el Chaos a cero, y **ni un solo IPC L2 sale del bridge**. El motor IA toma el relevo en el siguiente frame, sin pelearse con un lock manual fantasma.

---

## 📁 Archivos modificados

| Archivo | Targets | Cambio |
|---------|---------|--------|
| `electron-app/src/core/aether/AetherIPCHandlers.ts` | T1 | Nuevo IPC `clearMotorKineticOverrides` + refuerzo del cleanup motor en `setManualPattern` |
| `electron-app/electron/preload.ts` | T1 | Expone `clearMotorKineticOverrides` |
| `electron-app/src/vite-env.d.ts` | T1 | Tipo de `clearMotorKineticOverrides` |
| `electron-app/src/bridges/KineticsBridge.ts` | T1, T2 | `_prevSelectedIds` + orphan diffing; `_suppressClassicFlushCount` + `resetRadarSilent()` |
| `electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx` | T2 | Import `KineticsBridge`; reemplaza `setFanValue/setChaosAmount` directos por `resetRadarSilent()` |

Cero cambios en la matemática del engine, el arbiter, o la API pública de los stores. Todo aditivo y reversible.

---

## ⚙️ Notas operativas

- **Idempotencia**: el bridge diff se basa en `_prevSelectedIds` (inicializado vacío). El primer disparo después de `start()` no genera orphans falsos.
- **Stop limpio**: `KineticsBridge.stop()` resetea `_prevSelectedIds` y `_suppressClassicFlushCount` a defaults.
- **Worst-case del semáforo**: en el peor escenario el contador queda con valor residual si una de las 3 escrituras no produce cambio detectable por la equalityFn. El próximo flush legítimo del operador será silenciado una sola vez — gesto inicial del radar requiere 16 ms extra para "activarse". Coste aceptable; alternativa sería un timeout absoluto, pero el modelo de tokens es determinista y zero-alloc.
