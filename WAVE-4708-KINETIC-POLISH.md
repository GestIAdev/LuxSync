# ⚡ WAVE 4708 — KINETIC POLISH (Search & Destroy)

> Tres demonios neutralizados en un único pase atómico. Cero suposiciones.

---

## 🎯 TARGET 1 — Falso Unlock (Zombie Movers)

### Falla estructural
**`KineticsCathedral.tsx:114-120` y `:207`** — el botón UNLOCK estaba condicionado a `hasKineticOverride`, que SOLO consultaba `programmerStore.fixtureOverrides.pan/tilt`. Pero los patrones manuales viven en el **Dual-Map del motor** (`NodeArbiter._motorKineticOverrides`), no en `fixtureOverrides`. Resultado: el motor corría, el botón se ocultaba, y `releaseAll()` (que vacía `fixtureOverrides`) no tocaba al motor — los movers quedaban congelados.

Además faltaban: `clearInhibitLimit()`, `clearAllMotorKineticOverrides()` (safety net global), y reset de `fanValue`/`chaosAmount`.

### Destroy (`KineticsCathedral.tsx`)
- Eliminado el gate `hasKineticOverride` y el `useMemo` asociado.
- Botón UNLOCK ahora se renderiza incondicional cuando hay moving heads en selección (paridad con `TheProgrammer.tsx:361`).
- `handleUnlockKinetics` reescrito con la **misma secuencia 7-pasos** que `TheProgrammer.handleUnlockAll`:
  1. `releaseAll()` (Ancla L2)
  2. `clearInhibitLimit(impactNodeIds)`
  3. `setManualPattern({ pattern: null })` (motor + VMM)
  4. `setKineticFanOffsets({})`
  5. `clearAllMotorKineticOverrides()` ← safety net
  6. `setActivePattern/Speed/Amplitude/FanValue/ChaosAmount` reset UI
  7. `setManualOverrideForFixtures(false)` + `setLockedFixtures(new Set())`

---

## 🎯 TARGET 2 — Amnesia del Radar (Anchor Hydration)

### Falla estructural
**`KineticsBridge.ts:_flushPattern`** (líneas 415-430 originales) — el handler de activación de patrón enviaba `setManualPattern` SIN adjuntar la posición del radar. El motor (`AetherKineticEngine.tick`) leía el ancla con `arbiter.getManualOverride(nodeId).pan_base`, pero esa entrada solo existía si `_flushClassic` había corrido **antes**. Con debounce 16 ms vs 30 ms y selección recién hecha, había una ventana donde:

- `setManualPattern` activaba el motor (`_config !== null`)
- el primer `tick()` ejecutaba antes que `_flushClassic` escribiera `pan_base`/`tilt_base`
- → `anchorPan = anchorTilt = 0.5` (fallback "centro 127")

Confirmado en `AetherKineticEngine.ts:390-391`:
```ts
const anchorPan  = (l2 && Number.isFinite(l2['pan_base']))  ? l2['pan_base']  : 0.5
const anchorTilt = (l2 && Number.isFinite(l2['tilt_base'])) ? l2['tilt_base'] : 0.5
```

### Destroy
**Inyección atómica del ancla en el mismo IPC del patrón** — sin tocar la matemática del engine ni introducir nuevas razas:

- **`KineticsBridge.ts`** (`_flushPattern`): lee `movementStore.pan/tilt`, normaliza a `[0,1]`, los adjunta como `anchorPan`/`anchorTilt` en el payload.
- **`AetherIPCHandlers.ts`** (`setManualPattern`): si el payload trae ancla, escribe `pan_base`/`tilt_base` en `arbiter._manualOverrides` con merge no-destructivo, **antes** de `aetherKineticEngine.setManualKinetics(...)`. Garantiza que el primer `tick()` lea el ancla correcta.
- **Tipos**: `preload.ts` + `vite-env.d.ts` extendidos con `anchorPan?` / `anchorTilt?`.

---

## 🎯 TARGET 3 — Caos Segregado (L0 vs L2)

### Falla estructural
**`KineticsBridge.ts:169-181` (suscripción Classic)** — al cambiar `chaosAmount`/`chaosSeed`, el bridge solo disparaba `_scheduleClassicFlush` (L2 manual). El motor IA (`KineticAdapter.process`, L0) **nunca recibía** el caos. Su único phase-offset era `lrPhaseOffset + l2PhaseOffset` (`KineticAdapter.ts:184`).

**`AetherIPCHandlers.ts`** tampoco exponía un canal IPC para propagar `chaosAmount` al backend de la IA. El slider `ChaosOrderSlider` quedaba huérfano del lado L0.

### Destroy
**Estado global en `VibeMovementManager` + IPC dedicado + lectura en `KineticAdapter`:**

- **`VibeMovementManager.ts`**: nuevos campos públicos `globalChaosAmount` y `globalChaosSeed` + setter `setGlobalChaos(amount, seed)`.
- **`AetherIPCHandlers.ts`**: handler `lux:aether:setGlobalKineticChaos` que llama a `vibeMovementManager.setGlobalChaos(...)`.
- **`KineticsBridge.ts`** (suscripción Classic): cada cambio de `chaosAmount`/`chaosSeed` dispara `setGlobalKineticChaos({ amount, seed })` además del flush clásico.
- **`KineticAdapter.ts`**: nueva función `fnv1aChaosPhase(nodeId, seed)` (espejo del hash determinista del bridge — same FNV-1a primes), aplicada como tercer término de `phaseOffset`:
  ```ts
  const chaosPhase = chaosAmount > 0
    ? fnv1aChaosPhase(node.nodeId, vmm.globalChaosSeed) * chaosAmount
    : 0
  const phaseOffset = lrPhaseOffset + l2PhaseOffset + chaosPhase
  ```
- **`preload.ts` + `vite-env.d.ts`**: contrato tipado de `setGlobalKineticChaos`.

**Resultado:** el mismo amount+seed generan offsets coherentes en L0 (IA) y L2 (`_flushClassic`). El operador percibe el caos como un atributo unificado del show.

---

## 📁 Archivos modificados

| Archivo | Targets | Cambio |
|---------|---------|--------|
| `electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx` | T1 | Unlock 7-pasos paritario; botón siempre visible |
| `electron-app/src/core/aether/AetherIPCHandlers.ts` | T2, T3 | Anchor hydration + handler `setGlobalKineticChaos` |
| `electron-app/src/bridges/KineticsBridge.ts` | T2, T3 | Envía `anchorPan/Tilt` + propaga caos global a L0 |
| `electron-app/electron/preload.ts` | T2, T3 | Expone `anchorPan/Tilt` y `setGlobalKineticChaos` |
| `electron-app/src/vite-env.d.ts` | T1, T2, T3 | Tipos: `clearAllMotorKineticOverrides`, `anchorPan/Tilt`, `setGlobalKineticChaos` |
| `electron-app/src/engine/movement/VibeMovementManager.ts` | T3 | `globalChaosAmount/Seed` + `setGlobalChaos()` |
| `electron-app/src/core/aether/adapters/KineticAdapter.ts` | T3 | `fnv1aChaosPhase()` + integración en `phaseOffset` |

Cero cambios en la matemática del `AetherKineticEngine` ni en el `NodeArbiter`. Las soluciones son aditivas y reversibles.
