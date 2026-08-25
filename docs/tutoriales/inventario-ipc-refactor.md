# INVENTARIO IPC: Fire-and-Forget + Silk Throttle — WAVE 7593

> **Fase 1: Inventario completo.** No se ejecuta código todavía.
> Este documento lista todos los `ipcRenderer.invoke` de inputs manuales,
> los clasifica por fuente (teclado/UI/MIDI/bridge), y marca cuáles
> necesitan throttle de 25ms.

---

## TABLA MAESTRA DE CANALES IPC MANUALES

### CATEGORÍA A: Live Triggers — Fire-and-Forget + Throttle 25ms

Estos canales son disparados por inputs manuales en vivo (teclado, UI, MIDI).
Cada uno crea una Promesa pendiente que puede causar el "Tsunami Effect".
**Todos deben convertirse a `ipcRenderer.send` + `ipcMain.on`.**

| # | Canal IPC | Puente Preload | Fuente(s) | Throttle | Notas |
|---|---|---|---|---|---|
| A1 | `lux:aether:setBlackout` | `aether.setBlackout(active)` | Teclado (KeyActionDispatcher `arb-blackout`, `lux-blackout`, `sel-blackout` PANIC), UI (BlackoutButton), MIDI (`arb-blackout`) | Sí 25ms | Toggle booleano. El `.then()` hace `setBlackout(result)` en Zustand → re-render. |
| A2 | `lux:forceStrike` | `forceStrike(config)` | Teclado (`fx-*`), MIDI (`fx-*`), UI (ArsenalDock) | Sí 25ms | Dispara efecto. No usa `.then()` en teclado pero sí en MIDI. |
| A3 | `lux:setVibe` | `setVibe(vibeId)` | Teclado (`vibe-*`), MIDI (`vibe-*`), UI (TransportBar, scenePlayer) | Sí 25ms | Cambio de vibe. No usa `.then()` pero es `invoke` (crea promesa). |
| A4 | `lux:cancel-all-effects` | `cancelAllEffects()` | Teclado (`arb-kill-effects`), MIDI (`arb-kill-effects`) | Sí 25ms | Kill all. Fire-and-forget natural. |
| A5 | `lux:aether:setGrandMaster` | `aether.setGrandMaster(value)` | Teclado (`arb-grand-master`), UI (CommandDeck slider), MIDI (`arb-grand-master` CC fader) | Sí 25ms | **CRÍTICO**: MIDI CC fader dispara 300+ eventos/seg. Ya tiene throttle de log (500ms) pero NO de IPC. |
| A6 | `lux:aether:setSelInhibit` | `aether.setSelInhibit(ids, active)` | Teclado (`sel-blackout` SELECTION KILL), UI (TheProgrammer) | Sí 25ms | Toggle inhibit per-fixture. |
| A7 | `lux:aether:fireTungstenNuke` | `aether.fireTungstenNuke(args)` | Teclado (`tung-*`), MIDI (`tung-*`) | Sí 25ms | Nuke spin/petal/gold/all. Note On/Off + CC. |
| A8 | `lux:aether:setOutputEnabled` | `aether.setOutputEnabled(enabled)` | UI (CommandDeck ARM/LIVE toggle) | Sí 25ms | Output gate. |
| A9 | `lux:aether:setGrandMasterSpeed` | `aether.setGrandMasterSpeed(value)` | UI (CommandDeck slider) | Sí 25ms | Speed multiplier. |

### CATEGORÍA B: Kinetics Bridge — Fire-and-Forget SIN Throttle (ya tiene debounce interno)

Estos canales son llamados por `KineticsBridge.ts` que **ya tiene su propio debounce**
(`CLASSIC_DEBOUNCE_MS = 16ms`, `_flushPattern`, `_scheduleSpatialFlush`).
Convertir a `send` para eliminar la promesa, pero **NO aplicar throttle adicional**
(el bridge ya controla la frecuencia).

| # | Canal IPC | Puente Preload | Fuente | Throttle | Notas |
|---|---|---|---|---|---|
| B1 | `lux:aether:setManualOverrides` | `aether.setManualOverrides(payloads)` | KineticsBridge `_flushClassic` (44Hz, debounce 16ms) | No (ya debounced) | Pan/Tilt radar. **Alta frecuencia.** |
| B2 | `lux:aether:setManualPattern` | `aether.setManualPattern(args)` | KineticsBridge `_flushPattern` (debounce) | No (ya debounced) | Pattern change. |
| B3 | `lux:aether:updateKineticScalars` | `aether.updateKineticScalars(args)` | KineticsBridge `_flushPattern` (scalars-only path) | No (ya debounced) | Speed/amplitude/fan sin reiniciar fase. |
| B4 | `lux:aether:applySpatialTarget` | `aether.applySpatialTarget(args)` | KineticsBridge `_scheduleSpatialFlush` | **MANTENER invoke** | ⚠️ **CRÍTICO**: El backend retorna `result.subTargets` que el KineticsBridge escribe en `useMovementStore.setSpatialSubTargets()`. Convertir a `send` rompería el visual del radar spatial IK. |
| B5 | `lux:aether:releaseSpatialTarget` | `aether.releaseSpatialTarget(args)` | KineticsBridge, UI (CalibrationView) | No | Release spatial. No lee respuesta. |
| B6 | `lux:aether:setGlobalKineticChaos` | `aether.setGlobalKineticChaos(args)` | KineticsBridge (slider ~60Hz) | No (slider ya controla) | Chaos amount/seed. |
| B7 | `lux:aether:setKineticFanOffsets` | `aether.setKineticFanOffsets(offsets)` | KineticsBridge, TheProgrammer | No | **WAVE 4718: IPC es no-op en backend.** Tráfico fantasma. Candidato a eliminar. |
| B8 | `lux:aether:setInhibitLimit` | `aether.setInhibitLimit(ids, limit)` | UI (IntensitySection slider) | No (slider nativo) | Per-fixture grand master limit. |
| B9 | `lux:aether:clearInhibitLimit` | `aether.clearInhibitLimit(ids)` | UI (IntensitySection release) | No | Clear limit. |
| B10 | `lux:aether:clearAllManualOverrides` | `aether.clearAllManualOverrides()` | UI (TheProgrammer releaseAll) | No | Clear all L2. |
| B11 | `lux:aether:clearManualOverrides` | `aether.clearManualOverrides(ids)` | UI (TheProgrammer) | No | Clear per-node. |
| B12 | `lux:aether:clearAllMotorKineticOverrides` | `aether.clearAllMotorKineticOverrides()` | UI (KineticsCathedral) | No | Clear motor kinetic. |
| B13 | `lux:aether:clearMotorKineticOverrides` | `aether.clearMotorKineticOverrides(ids)` | UI (KineticsCathedral) | No | Clear per-node motor. |
| B14 | `lux:aether:invalidateIKProfile` | `aether.invalidateIKProfile(args)` | UI (CalibrationDock) | No | Invalidate IK cache. |

### CATEGORÍA C: Query/Get — MANTENER invoke (necesitan respuesta)

Estos canales **deben seguir siendo `invoke`** porque el renderer necesita
el valor de retorno. No son fire-and-forget.

| # | Canal IPC | Puente Preload | Fuente | Notas |
|---|---|---|---|---|
| C1 | `lux:aether:getControlState` | `aether.getControlState()` | UI (CommandDeck init, polling) | Retorna grandMaster, blackout, outputEnabled. |
| C2 | `lux:aether:getL2State` | `aether.getL2State(nodeIds)` | UI (TheProgrammer init) | Retorna overrides L2. |
| C3 | `lux:aether:getManualKineticState` | `aether.getManualKineticState()` | UI (TheProgrammer init) | Retorna pattern/speed/amplitude/fan. |
| C4 | `lux:aether:getKineticNodeStates` | `aether.getKineticNodeStates(ids)` | KineticsBridge hydration | Retorna states per-node. |
| C5 | `lux:arbiter:status` | `arbiter.status()` | UI (CommandDeck init) | Retorna status completo. |
| C6 | `lux:arbiter:getGrandMasterSpeed` | `arbiter.getGrandMasterSpeed()` | UI (CommandDeck init) | Retorna speed. |
| C7 | `lux:arbiter:getOutputEnabled` | `arbiter.getOutputEnabled()` | UI (CommandDeck) | Retorna output state. |
| C8 | `lux:arbiter:hasManual` | `arbiter.hasManual(id, ch?)` | UI (query) | Retorna boolean. |
| C9 | `lux:arbiter:getFixturesState` | `arbiter.getFixturesState(ids)` | UI (query) | Retorna estados. |
| C10 | `lux:arbiter:isCalibrating` | `arbiter.isCalibrating(id)` | UI (Calibration) | Retorna boolean. |

### CATEGORÍA D: Setup/Config — MANTENER invoke (low frequency, necesitan respuesta)

Estos son llamados una sola vez en setup o a baja frecuencia. No causan tsunami.

| # | Canal IPC | Puente Preload | Fuente | Notas |
|---|---|---|---|---|
| D1 | `lux:arbiter:setManual` | `arbiter.setManual(args)` | UI (manual override setup) | Setup. |
| D2 | `lux:arbiter:clearManual` | `arbiter.clearManual(args)` | UI (clear manual) | Setup. |
| D3 | `lux:arbiter:clearAllManual` | `arbiter.clearAllManual()` | UI | Setup. |
| D4 | `lux:arbiter:toggleBlackout` | `arbiter.toggleBlackout()` | UI (legacy) | **Deprecated** — usar `lux:aether:setBlackout`. |
| D5 | `lux:arbiter:toggleOutput` | `arbiter.toggleOutput(label)` | UI | Toggle ARM/LIVE. |
| D6 | `lux:arbiter:setOutputEnabled` | `arbiter.setOutputEnabled(en, label)` | UI | Output gate. |
| D7 | `lux:arbiter:enterCalibrationMode` | `arbiter.enterCalibrationMode(id)` | UI (Calibration) | Setup. |
| D8 | `lux:arbiter:exitCalibrationMode` | `arbiter.exitCalibrationMode(id)` | UI (Calibration) | Setup. |
| D9 | `lux:arbiter:setMovementParameter` | `arbiter.setMovementParameter(p, v)` | UI | Movement param. |
| D10 | `lux:arbiter:setMovementPattern` | `arbiter.setMovementPattern(p)` | UI | Movement pattern. |
| D11 | `lux:arbiter:clearMovementOverrides` | `arbiter.clearMovementOverrides()` | UI | Clear movement. |
| D12 | `lux:arbiter:setManualFixturePattern` | `arbiter.setManualFixturePattern(args)` | UI | Manual pattern. |
| D13 | `lux:arbiter:setFixtures` | `arbiter.setFixtures(fixtures, bounds)` | UI (stage sync) | Setup. |
| D14 | `lux:arbiter:applySpatialTarget` | `arbiter.applySpatialTarget(args)` | UI (legacy arbiter path) | Spatial. |
| D15 | `lux:arbiter:releaseSpatialTarget` | `arbiter.releaseSpatialTarget(args)` | UI (legacy arbiter path) | Release. |
| D16 | `lux:aether:setFixtures` | `aether.setFixtures(fixtures, bounds)` | UI (stage sync) | Setup. |
| D17 | `lux:set-blackout` | `setBlackout(active)` | UI (legacy) | **Deprecated** — usar `lux:aether:setBlackout`. |

---

## MAPEO DE CALLERS POR ARCHIVO

### Teclado — `src/keyforge/KeyActionDispatcher.ts`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 198 | `aether.setBlackout` | `sel-blackout` PANIC | A1 |
| 208 | `aether.setSelInhibit` | `sel-blackout` SELECTION KILL | A6 |
| 292-294 | `aether.setSelInhibit` | `sel-mute` toggle | A6 |
| 647 | `aether.setBlackout` | `lux-blackout` | A1 |
| 688 | `forceStrike` | `fx-*` | A2 |
| 696 | `setVibe` | `vibe-*` | A3 |
| 705 | `aether.fireTungstenNuke` | `tung-spin` (CC) | A7 |
| 712 | `aether.fireTungstenNuke` | `tung-*` release | A7 |
| 714 | `aether.fireTungstenNuke` | `tung-*` press | A7 |
| 728 | `aether.setBlackout` | `arb-blackout` | A1 |
| 736 | `aether.setGrandMaster` | `arb-grand-master` | A5 |
| 739 | `cancelAllEffects` | `arb-kill-effects` | A4 |

### UI — `src/components/commandDeck/BlackoutButton.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 26 | `aether.setBlackout` | Click blackout button | A1 |

### UI — `src/components/commandDeck/CommandDeck.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 68 | `aether.getControlState` | Init polling | C1 (mantener invoke) |
| 105 | `aether.setGrandMaster` | Slider GM | A5 |
| 116 | `aether.setGrandMasterSpeed` | Slider GMSpeed | A9 |
| 152 | `aether.setOutputEnabled` | Safety disarm | A8 |
| 171 | `aether.setOutputEnabled` | ARM/LIVE toggle | A8 |

### UI — `src/components/hyperion/controls/TheProgrammer.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 145 | `aether.getL2State` | Init hydration | C2 (mantener invoke) |
| 157 | `aether.getManualKineticState` | Init hydration | C3 (mantener invoke) |
| 199 | `aether.clearInhibitLimit` | Release | B9 |
| 209 | `aether.clearInhibitLimit` | Release all | B9 |
| 210 | `aether.setManualPattern` | Release pattern | B2 |
| 216 | `aether.setKineticFanOffsets` | Reset fan | B7 (no-op fantasma) |

### UI — `src/components/hyperion/controls/IntensitySection.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 98 | `aether.setInhibitLimit` | Slider limit | B8 |
| 103 | `aether.setInhibitLimit` | Preset limit | B8 |
| 108 | `aether.clearInhibitLimit` | Release limit | B9 |
| 113 | `aether.clearInhibitLimit` | Release | B9 |
| 366 | `aether.clearInhibitLimit` | Mini release | B9 |
| 377 | `aether.setInhibitLimit` | Slider limit | B8 |

### UI — `src/components/hyperion/kinetics/KineticsCathedral.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 170 | `aether.clearAllMotorKineticOverrides` | Clear motor | B12 |
| 178 | `aether.clearMotorKineticOverrides` | Clear per-node | B13 |
| 182 | `aether.clearManualOverrides` | Clear L2 | B11 |

### Bridge — `src/bridges/KineticsBridge.ts`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 241 | `aether.setGlobalKineticChaos` | Chaos slider | B6 |
| 344 | `aether.getKineticNodeStates` | Hydration | C4 (mantener invoke) |
| 524 | `aether.setManualOverrides` | _flushClassic (44Hz) | B1 |
| 598 | `aether.updateKineticScalars` | _flushPattern scalars | B3 |
| 634 | `aether.setManualPattern` | _flushPattern full | B2 |
| 720 | `aether.applySpatialTarget` | _scheduleSpatialFlush | B4 |

### MIDI — `src/hooks/useMidiLearn.ts`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 260 | `forceStrike` | `fx-*` Note On | A2 |
| 269 | `setVibe` | `vibe-*` Note On | A3 |
| 277 | `aether.fireTungstenNuke` | `tung-spin` CC | A7 |
| 296 | `aether.fireTungstenNuke` | `tung-*` Note On | A7 |
| 299 | `aether.fireTungstenNuke` | `tung-*` Note Off | A7 |
| 324 | `aether.setBlackout` | `arb-blackout` | A1 |
| 336 | `aether.setGrandMaster` | `arb-grand-master` CC | A5 |
| 349 | `cancelAllEffects` | `arb-kill-effects` | A4 |
| 414 | `aether.setSelInhibit` | (if mapped) | A6 |

### UI — `src/components/views/CalibrationView/index.tsx`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 400 | `aether.releaseSpatialTarget` | Release | B5 |
| 474 | `aether.applySpatialTarget` | Apply | B4 (via arbiter legacy) |

### UI — `src/components/views/erebus/calibration/useCalibrationSession.ts`

| Línea | Canal | Acción | Categoría |
|---|---|---|---|
| 107 | `arbiter.enterCalibrationMode` | Enter cal | D7 (mantener invoke) |
| 135 | `arbiter.exitCalibrationMode` | Exit cal | D8 (mantener invoke) |
| 146 | `arbiter.isCalibrating` | Query | C9 (mantener invoke) |
| 156 | `arbiter.exitCalibrationMode` | Exit cal | D8 (mantener invoke) |

---

## RESUMEN DE TRABAJO (Fase 2)

### Paso 1: Crear `throttleFn` utility
- **Archivo:** `src/utils/throttleIpc.ts`
- **Spec:** Leading edge execute, drop excess within 25ms window.
- **Export:** `throttleFn(fn, limitMs = 25)`

### Paso 2: Refactor Preload (Categoría A + B)
- **Archivo:** `electron/preload.ts`
- **Cambio:** `ipcRenderer.invoke` → `ipcRenderer.send` para canales A1-A9 + B1-B14.
- **Eliminar:** `return` en funciones que usaban el valor de retorno.
- **Mantener invoke:** Categoría C (queries) + Categoría D (setup).

### Paso 3: Refactor Main Handlers (Categoría A + B)
- **Archivos:**
  - `src/core/aether/AetherIPCHandlers.ts` — `ipcMain.handle` → `ipcMain.on` para A1-A9 + B1-B14.
  - `src/core/orchestrator/IPCHandlers.ts` — handlers de `lux:forceStrike`, `lux:setVibe`, `lux:cancel-all-effects`.
  - `src/core/orchestrator/ArbiterIPCHandlers.ts` (si existe) — handlers de `lux:arbiter:*`.
- **Eliminar:** `return { success: true, ... }` en los handlers convertidos a `on`.
- **Mantener handle:** Categoría C + D.

### Paso 4: Armor Dispatcher (Categoría A — throttle 25ms)
- **Archivos:**
  - `src/keyforge/KeyActionDispatcher.ts` — envolver calls con `throttleFn`.
  - `src/components/commandDeck/BlackoutButton.tsx` — throttle click.
  - `src/components/commandDeck/CommandDeck.tsx` — throttle slider GM.
  - `src/hooks/useMidiLearn.ts` — throttle `fx-*`, `arb-*`, `tung-*`.
- **NO throttle:** KineticsBridge (Categoría B — ya debounced).

### Paso 5: Loop Closure
- Eliminar `.then()` callbacks que hacían `setBlackout(result)`.
- La UI debe reflejar el cambio via:
  1. **Optimistic update local** (Zustand `setBlackout(targetState)` antes del send).
  2. **selene:truth broadcast** (~7Hz) confirma el estado autoritativo.

### Paso 6: Eliminar tráfico fantasma
- `lux:aether:setKineticFanOffsets` (B7) — no-op en backend. Candidato a eliminar del preload + callers.

---

## CONTADORES

| Categoría | Cantidad | Acción |
|---|---|---|
| A (Live Triggers) | 9 canales | `send` + `on` + throttle 25ms |
| B (Kinetics Bridge) | 13 canales | `send` + `on` (sin throttle) |
| B-EXCEPT (IK Spatial) | 1 canal (B4) | **Mantener `invoke`** — lee `result.subTargets` |
| C (Query/Get) | 10 canales | **Mantener `invoke` + `handle`** |
| D (Setup/Config) | 17 canales | **Mantener `invoke` + `handle`** |
| **Total a refactorizar** | **22 canales** | A + B (sin B4) |
| **Total a mantener** | **28 canales** | C + D + B4 |
| **Total inventariado** | **50 canales** | |

---

## ⚠️ ADVERTENCIA CRÍTICA: Canales que NO se pueden convertir a `send`

### B4 — `lux:aether:applySpatialTarget` — MANTENER `invoke`

**Razón:** El backend retorna `{ success: true, subTargets: serialized }` (línea 1071 de `AetherIPCHandlers.ts`).
El `KineticsBridge._flushSpatial()` (línea 720-740) lee `result?.subTargets` y los escribe en
`useMovementStore.getState().setSpatialSubTargets(subTargets)` para el visual del radar IK.

**Si se convierte a `send`:** El frontend pierde los subTargets → el radar spatial no muestra
la geometría de fan (converge/line/circle) → el operador no ve dónde apuntan los fixtures.
**Esto rompería el modo spatial que costó días integrar con InverseKinematicsEngine.**

### B2 — `lux:aether:setManualPattern` — CUIDADO con el catch

**Razón:** El `KineticsBridge._flushPattern()` (línea 634-648) hace `await` y en el `catch`
invalida `_lastPatternSent` y `_lastFixtureKeysSent` para forzar un reintento completo.
Si se convierte a `send`, no hay `catch` — pero esto es **acceptable** porque:
1. `send` es fire-and-forget — si el backend falla, no hay notificación.
2. El próximo flush con el mismo patrón usaría `updateKineticScalars` (scalars-only) en lugar
   de `setManualPattern` completo, lo cual es correcto — el motor ya tiene el patrón cargado.
3. Si el patrón cambió, el próximo flush enviará `setManualPattern` completo de nuevo.

**Conclusión:** B2 se puede convertir a `send` sin romper el movimiento, pero hay que
eliminar el `try/catch` y la invalidación de caché en el catch.

### B1 — `lux:aether:setManualOverrides` — SEGURO para `send`

**Razón:** El `KineticsBridge._flushClassic()` (línea 524) hace `await` pero NO lee la respuesta.
Solo tiene `try/catch` para logging. Convertir a `send` es seguro — el backend escribe
directamente en L2 del NodeArbiter sin necesidad de confirmación.

### B3 — `lux:aether:updateKineticScalars` — SEGURO para `send`

**Razón:** El `KineticsBridge._flushPattern()` (línea 598) hace `await` pero NO lee la respuesta.
Solo `try/catch` para logging. Seguro para `send`.
