# ═══════════════════════════════════════════════════════════════════════════
# WAVE 4706 — THE KINETIC TRIAD: AUDITORÍA Y TELEMETRÍA
# ═══════════════════════════════════════════════════════════════════════════

> **Fecha:** 2026-05-12  
> **Auditor:** Cascade (Sonnet thinking mode)  
> **Mandato:** Inyectar telemetría + diagnosticar las tres fugas de la tríada. **Ningún fix a la UI aún.**

---

## ✅ MISIÓN 1 — TELEMETRÍA INYECTADA

**Archivo:** `electron-app/src/core/aether/AetherKineticEngine.ts`

Se añadió un contador de frames (`_heartbeatCounter`) y un heartbeat al final de `tick()` que emite 1 log por segundo (cada 44 ticks @ 44 Hz):

```typescript
// WAVE 4706 TELEMETRÍA — heartbeat rate-limited (1 log/seg @ 44Hz)
this._heartbeatCounter++
if (this._heartbeatCounter >= 44) {
  this._heartbeatCounter = 0
  const firstNodeId = cfg.nodeIds[0]
  const sampleRec = firstNodeId ? this._overridePool.get(firstNodeId) : null
  console.log(
    `[KineticEngine L2] Nodos activos: ${total}` +
    ` | Pattern: ${cfg.pattern}` +
    ` | Speed: ${cfg.speed.toFixed(3)}` +
    ` | Amplitude: ${cfg.amplitude.toFixed(3)}` +
    ` | Fan: ${cfg.fan.toFixed(3)}` +
    ` | Output muestra[${firstNodeId}]: ` +
    (sampleRec
      ? `{pan: ${sampleRec['pan_base'].toFixed(3)}, tilt: ${sampleRec['tilt_base'].toFixed(3)}}`
      : 'null')
  )
}
```

**Qué nos dirá:**
- Si el motor vive → aparece el log cada segundo. Si NO aparece → motor inactivo (`_config === null`).
- Si los scalares llegan → los valores de Speed/Amplitude/Fan se actualizan en vivo al mover faders.
- Si la salida es real → `pan_base`/`tilt_base` oscilan frame a frame.

**Ausencia del log = motor muerto.** Eso aísla instantáneamente "faders muertos por slider sin motor activo" de "slider que no dispara IPC".

---

## 🔴 MISIÓN 2 — EL SECUESTRO AL SELECCIONAR

### Culpable identificado: `KineticsBridge.ts:222-240`

```typescript
// Suscripción 5: selección de fixtures (WAVE L2-SUPREMACY)
const unsubSelection = useSelectionStore.subscribe(
  (s) => s.selectedIds,
  (_selectedIds) => {
    this._lastFixtureKeysSent = null
    const { activePattern, patternSpeed, patternAmplitude, fanValue, pan, tilt } =
      useMovementStore.getState()
    this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude, fanValue)
    this._scheduleClassicFlush(pan, tilt, fanValue)   // ← ASESINO
  },
  ...
)
```

### Cadena de ejecución que congela el foco

1. Operador pincha un foco → `useSelectionStore.selectedIds` cambia.
2. La suscripción 5 del bridge dispara `_scheduleClassicFlush(pan, tilt, fanValue)` con los valores **actuales del `movementStore`**.
3. Si el operador no ha tocado el radar en esta sesión, `movementStore` retorna los **defaults**:

**Archivo:** `movementStore.ts:152-155`

```typescript
const DEFAULTS: MovementState = {
  pan: 270,      // ← 270/540 = 0.5  → CENTRO PAN
  tilt: 135,     // ← 135/270 = 0.5  → CENTRO TILT
  fanValue: 0,
  ...
}
```

4. `_flushClassic(270, 135, 0)` normaliza → `panNorm=0.5, tiltNorm=0.5` → IPC `setManualOverrides`:

**Archivo:** `KineticsBridge.ts:324-352`

```typescript
const panNorm  = Math.max(0, Math.min(1, pan  / 540))   // 0.5
const tiltNorm = Math.max(0, Math.min(1, tilt / 270))   // 0.5
// ...
const payloads = fixtureIds.map((id, i) => ({
  nodeId: `${id}:kinetic`,
  channels: { [panChannel]: 0.5, [tiltChannel]: 0.5 },
}))
await window.lux?.aether?.setManualOverrides(payloads)
```

5. El backend escribe `{pan: 0.5, tilt: 0.5}` en L2 para el nodeId recién seleccionado → **el foco SNAP a centro (pan 270°, tilt 135° = HOME).**

### El operador percibe "el foco se congela al ser seleccionado"

**No es un falso intent — es un intent falso pero real**: el bridge INYECTA la posición default del store como si fuera un comando explícito del operador. Seleccionar está escribiendo.

### Línea culpable exacta

**`electron-app/src/bridges/KineticsBridge.ts:230`** → `this._scheduleClassicFlush(pan, tilt, fanValue)` dentro del handler de cambio de selección.

### Por qué existe esta línea (contexto histórico)

El comentario `// WAVE L2-SUPREMACY` en las líneas 217-221 dice:

> "Cuando el operador cambia la selección sin tocar los campos cinéticos, el motor nativo quedaba apuntando a los fixtures anteriores (scope stale). Fix: invalidar la caché de fixtureKey y re-enviar el estado actual."

**El arreglo de scope stale se extendió incorrectamente al flujo clásico.** Re-emitir el patrón (línea 229) es válido porque el patrón es intencional. Re-emitir el radar (línea 230) **inventa una intención del operador que nunca existió**.

---

## 🔴 MISIÓN 3 — EL UNLOCK DESINCRONIZADO DE LA CATEDRAL

### Comparación uno-a-uno

| Paso | TheProgrammer `handleUnlockAll` (`TheProgrammer.tsx:261-283`) | KineticsCathedral `handleUnlockKinetics` (`KineticsCathedral.tsx:122-144`) |
|------|--------------------------------------------------------------|---------------------------------------------------------------------------|
| 1 | `releaseAll()` del programmerStore | `releaseAll()` del programmerStore |
| 2 | ✅ `clearInhibitLimit(nodeIds)` sobre `:impact` | ❌ **FALTA** |
| 3 | `setManualPattern({ pattern: null, ... })` | `setManualPattern({ pattern: null, ... })` |
| 4 | `setKineticFanOffsets({})` | `setKineticFanOffsets({})` |
| 5 | `setActivePattern('none')` | `setActivePattern('none')` |
| 6 | `setManualOverrideForFixtures(selectedIds, false)` | `setManualOverrideForFixtures(selectedIds, false)` |
| 7 | `setLockedFixtures(new Set())` | `setLockedFixtures(new Set())` |

### Discrepancia #1 — El gate del renderizado (la raíz del "unlock desincronizado")

**`KineticsCathedral.tsx:207-215`**:

```typescript
{hasKineticOverride && (
  <div className="kinetics-cathedral__mode-bar">
    <button ... onClick={handleUnlockKinetics}>🔓 UNLOCK</button>
  </div>
)}
```

**`KineticsCathedral.tsx:114-120`**:

```typescript
const fixtureOverrides = useProgrammerStore(s => s.fixtureOverrides)
const hasKineticOverride = useMemo(() => {
  return selectedIds.some(id => {
    const ov = fixtureOverrides.get(id)
    return ov?.pan !== null || ov?.tilt !== null   // ← SOLO mira pan/tilt clásico
  })
}, [selectedIds, fixtureOverrides])
```

**Problema:** `hasKineticOverride` SOLO es `true` si hay overrides de **pan/tilt clásicos** en `programmerStore.fixtureOverrides`. Pero cuando el operador activa un **patrón manual** (`bounce`, `circle`, etc.), el motor L2 escribe `pan_base`/`tilt_base` en el **Dual-Map del Motor** (`_motorKineticOverrides` del `NodeArbiter`, vía `setMotorKineticOverride`) — **NO en `programmerStore.fixtureOverrides`.**

Resultado:
- Operador activa `bounce` sin tocar radar → motor corre, fixtures se mueven, pero `hasKineticOverride === false` → **el botón UNLOCK NO se renderiza**.
- El operador no tiene forma de detener el patrón desde la Catedral.

**En contraste**, `TheProgrammer` renderiza el botón `🔓 UNLOCK ALL` INCONDICIONALMENTE (`TheProgrammer.tsx:361-367`):

```tsx
<button className="unlock-all-btn" onClick={handleUnlockAll} title="...">
  🔓 UNLOCK ALL
</button>
```

Siempre visible mientras haya selección. De ahí que "TheProgrammer hace un unlock real que funciona" — no es que tenga más lógica, es que **está siempre accesible**.

### Discrepancia #2 — El Inhibit Limit huérfano

`handleUnlockKinetics` de la Catedral NO llama a `window.lux.aether.clearInhibitLimit(nodeIds)`. Si el operador había aplicado un límite de intensidad (a través del programador `handleLimitChange`), el Unlock de la Catedral lo deja activo. El fixture sigue con dimmer cap.

### Discrepancia #3 — Llamada condicional a APIs de limpieza

**`KineticsCathedral.tsx:127-136`**:

```typescript
if (selectedIds.length > 0) {
  void window.lux?.aether?.setManualPattern({ fixtureIds: selectedIds, pattern: null, ... })
  void window.lux?.aether?.setKineticFanOffsets({})
}
```

Si en el momento exacto del clic `selectedIds` está vacío (UI desincronizada, carrera de selección), las llamadas de limpieza backend se saltan. `TheProgrammer` tiene el mismo `if (selectedIds.length === 0) return` al inicio del handler (línea 262), pero no es discrepante funcionalmente — ambos fallan con selección vacía.

### Línea culpable exacta

**`electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx:207`** → `{hasKineticOverride && (...)}` condiciona el botón UNLOCK sobre una variable que NO refleja el estado real del motor L2 (Dual-Map). El botón desaparece justo cuando más se necesita.

**Archivo secundario:** `KineticsCathedral.tsx:115-120` — `hasKineticOverride` debería consultar también el estado del motor kinético (p.ej. `window.lux.aether.getManualKineticState()` ya retornado en hidratación, o un flag local al activar patrón).

---

## 🔴 MISIÓN 4 — EL CEMENTERIO DE FADERS

### Rastreo de los tres sliders

#### SPEED fader

**`KineticsCathedral.tsx:95-99`**

```typescript
const handleSpeedChange = useCallback((speed: number) => {
  setPatternSpeed(speed)                                      // movementStore
  useProgrammerStore.getState().setKineticSpeed(speed)        // programmerStore
}, [setPatternSpeed])
```

**Ambos stores se actualizan.** El bridge escucha.

**`KineticsBridge.ts:134-161`** suscribe a `patternSpeed`:

```typescript
const unsubPattern = useMovementStore.subscribe(
  (s) => ({ activePattern, patternSpeed, patternAmplitude, fanValue }),
  ({ activePattern, patternSpeed, patternAmplitude, fanValue }) => {
    if (getSelectedIds().length > 0) {
      useProgrammerStore.getState().setKineticSpeed(patternSpeed)
    }
    this._schedulePatternFlush(activePattern, patternSpeed, patternAmplitude, fanValue)
    // ...
  },
)
```

→ `_flushPattern` (`KineticsBridge.ts:371-430`):

```typescript
const enginePattern = toEnginePattern(activePattern)   // 'none' → 'hold'
// ...
const samePatternAndFixtures =
  !isStop && enginePattern === this._lastPatternSent && ...
if (samePatternAndFixtures) {
  await window.lux?.aether?.updateKineticScalars({ speed, amplitude, fan })
  return
}
```

**Punto de fallo:** Si `activePattern === 'none'`, entonces `enginePattern === 'hold'` → `isStop === true` → NO se toma la ruta rápida. Va a la ruta completa:

```typescript
await window.lux?.aether?.setManualPattern({
  fixtureIds, pattern: 'hold', speed, amplitude, fan,
})
```

Y en backend (`AetherIPCHandlers.ts:332-340`):

```typescript
if (pattern === null || pattern === 'static' || pattern === 'hold') {
  aetherKineticEngine.stop(arbiter)
  vibeMovementManager.setManualPattern(null)
  ...
  return { success: true }
}
```

→ **El motor se detiene. Los valores de speed/amplitude/fan se descartan silenciosamente.**

Si en cambio `activePattern` es un patrón real (`bounce`, `circle`, etc.), `enginePattern` se mantiene y la ruta rápida sí funciona:

**`AetherIPCHandlers.ts:393-407`** (ruta `updateKineticScalars`):

```typescript
ipcMain.handle('lux:aether:updateKineticScalars', (_event, { speed, amplitude, fan }) => {
  aetherKineticEngine.updateScalars(
    (speed ?? 50) / 100,
    (amplitude ?? 50) / 100,
    (fan ?? 0) / 100,
  )
})
```

→ **`AetherKineticEngine.updateScalars` (`AetherKineticEngine.ts:293-298`)**:

```typescript
updateScalars(speed: number, amplitude: number, fan: number): void {
  if (!this._config) return   // ← NO-OP SILENCIOSO si motor inactivo
  this._config.speed     = clamp01(speed)
  this._config.amplitude = clamp01(amplitude)
  this._config.fan       = clampSigned(fan)
}
```

**Aquí es donde mueren los faders cuando no hay patrón activo:** `_config === null` porque nadie ha llamado `setManualKinetics`. El slider se arrastra, dispara el IPC, pero el motor rechaza el update en silencio.

#### AMPLITUDE fader

**`KineticsCathedral.tsx:102-104`**

```typescript
const handleAmplitudeChange = useCallback((amplitude: number) => {
  setPatternAmplitude(amplitude)
}, [setPatternAmplitude])
```

Solo actualiza `movementStore`. El resto del flujo es idéntico a SPEED.

**Nota:** A diferencia de SPEED, no se llama a `setKineticSpeed` equivalente. Pero dado que el bridge suscribe a `patternAmplitude`, esto es no-issue: el bridge dispara el flush de patrón con el nuevo valor.

#### FAN / CHAOS slider

**`ChaosOrderSlider`** (usado en `KineticsCathedral.tsx:243-248`):

```tsx
<ChaosOrderSlider
  value={chaosAmount}
  onChange={setChaosAmount}     // ← movementStore.setChaosAmount
  seed={chaosSeed}
  onReseed={reseed}
/>
```

**Ambigüedad grave:** El directivo menciona "Fan/OrderChaos". En la Cathedral **NO existe un slider Fan**. Solo hay:
- `ChaosOrderSlider` → `movementStore.chaosAmount` (0-1).
- El `fanValue` (-100..100) de `movementStore` viaja integrado en los flushes clásicos (`_flushClassic`) y de patrón (`_flushPattern`), pero **ningún control en `KineticsCathedral.tsx` lo modifica**.

Búsqueda exhaustiva: `setFanValue` sólo aparece en gestos de radar (`KinRadarViewport`) y posiblemente en MIDI. La Cathedral **no tiene** fader Fan.

**El ChaosOrderSlider (que el operador percibe como "Fan/Caos") escribe `chaosAmount` en movementStore.** El bridge lo consume en `_flushClassic` (línea 336) como spread caótico adicional, y dispara re-flush desde la suscripción clásica (`KineticsBridge.ts:169-181`):

```typescript
const unsubClassic = useMovementStore.subscribe(
  (s) => ({ pan, tilt, fanValue, chaosAmount, chaosSeed }),
  ({ pan, tilt, fanValue }) => {
    this._scheduleClassicFlush(pan, tilt, fanValue)   // ← NO pasa chaosAmount/Seed
  },
  ...
)
```

**Punto de fallo del Chaos:** `_flushClassic` lee `chaosAmount` fresh del store (línea 328) — funciona. PERO el efecto solo se observa en el radar clásico (`_flushClassic`), **no afecta al motor L2 de patrones**. Si el operador activa un patrón (`bounce`) y mueve el slider Chaos, el motor no lo consume porque `AetherKineticEngine.setManualKinetics` recibe `fan` pero no `chaos`. El slider se mueve, el store actualiza, el bridge re-emite radar, pero el patrón sigue sin dispersión caótica.

### Resumen por fader

| Fader | Escribe al store | Bridge escucha | IPC dispara | Motor consume | Efecto visual |
|-------|------------------|----------------|-------------|----------------|---------------|
| **SPEED** | ✅ movementStore + programmerStore | ✅ `unsubPattern` | ✅ `updateKineticScalars` o `setManualPattern` | ⚠️ Solo si `_config !== null` | ❌ Muerto sin patrón activo |
| **AMPLITUDE** | ✅ movementStore | ✅ `unsubPattern` | ✅ idem | ⚠️ idem | ❌ idem |
| **CHAOS/ORDER** | ✅ movementStore | ✅ `unsubClassic` | ✅ `setManualOverrides` (radar) | ❌ Motor L2 no recibe chaos | ⚠️ Solo afecta radar, no patrón |
| **FAN (fanValue)** | ⚠️ solo vía gestos radar / no hay UI en Catedral | ✅ `unsubClassic` + `unsubPattern` | ✅ | ✅ (vía `setManualKinetics.fan`) | ⚠️ Invisible al operador |

### Líneas culpables

1. **Faders muertos sin patrón activo:** `electron-app/src/core/aether/AetherKineticEngine.ts:294` → `if (!this._config) return`. El no-op silencioso es el asesino.
2. **Chaos no llega al motor:** `electron-app/src/bridges/KineticsBridge.ts:169-181` → la suscripción a `chaosAmount`/`chaosSeed` dispara solo `_scheduleClassicFlush`. Nunca llama a nada que entre al `AetherKineticEngine`.
3. **Fan sin UI en Catedral:** `electron-app/src/components/hyperion/kinetics/KineticsCathedral.tsx` — no existe `HorizontalFader` para `fanValue` dentro de la Cathedral. El canal `fan` existe en todo el pipeline, pero la UI no lo expone. El operador cree que "Fan no funciona" porque no hay fader que lo controle.

---

## 📋 TABLA MAESTRA DE CAUSAS RAÍZ

| # | Síntoma | Archivo:Línea | Causa exacta |
|---|---------|---------------|--------------|
| S1 | **Seleccionar congela el foco** | `KineticsBridge.ts:230` | `_scheduleClassicFlush(pan, tilt, ...)` inyecta los defaults (270°/135°) del movementStore como IPC explícito, sobreescribiendo la posición del fixture recién seleccionado. |
| S2 | **Unlock Catedral no aparece con patrón manual** | `KineticsCathedral.tsx:115-120, 207` | `hasKineticOverride` consulta `programmerStore.fixtureOverrides` pero los patrones manuales viven en el Dual-Map del motor (`_motorKineticOverrides`). El botón se oculta aunque el motor esté corriendo. |
| S3 | **Unlock Catedral no limpia Inhibit Limit** | `KineticsCathedral.tsx:122-144` | Falta la llamada a `window.lux.aether.clearInhibitLimit(nodeIds)` que sí está en `TheProgrammer.tsx:268`. |
| S4 | **Faders Speed/Amplitude no hacen nada sin patrón** | `AetherKineticEngine.ts:294` | `updateScalars` hace `if (!this._config) return` silenciosamente. Cuando `activePattern === 'none'`, el motor está detenido y los scalars se descartan. |
| S5 | **Faders Speed/Amplitude efecto invisible con patrón activo** | N/A (sintoma combinado) | Probable interacción con S1: el radar default sobreescribe la posición y el operador no ve oscilación aunque el motor la esté calculando. La telemetría del heartbeat confirmará/descartará esto. |
| S6 | **Chaos slider no afecta patrones** | `KineticsBridge.ts:169-181` | La suscripción a `chaosAmount` solo llama a `_scheduleClassicFlush` (radar). Nunca propaga caos al `AetherKineticEngine`. |
| S7 | **Fan sin control en Catedral** | `KineticsCathedral.tsx` (ausencia) | No existe `HorizontalFader` para `fanValue` en la Cathedral. El pipeline backend soporta `fan`, pero la UI no lo expone como control explícito. |

---

## 🎯 SECUENCIA DE VERIFICACIÓN PROPUESTA (con telemetría viva)

1. **Arrancar app** → observar ausencia de `[KineticEngine L2]` en consola. Confirma motor inactivo al inicio.
2. **Seleccionar fixture sin tocar nada** → observar si aparece log. **Si aparece**, el bridge está activando motor en selección (agravante a S1). **Si no aparece**, confirma que el síntoma de congelación viene del radar default (S1) y no del motor.
3. **Activar patrón `bounce`** → debería aparecer heartbeat cada segundo. Confirma activación del motor.
4. **Mover slider Speed** → los `Speed:` del log deben cambiar en vivo. Si NO cambian → IPC roto. Si SÍ cambian → slider funciona, pero efecto visual oculto por S1/S5.
5. **Mover slider Chaos con patrón activo** → los valores del log NO deberían cambiar (porque Chaos no entra al motor). Confirma S6.
6. **Cambiar a `activePattern === 'none'`** → el heartbeat debe desaparecer. Mover Speed → no-op silencioso. Confirma S4.

---

*Telemetría inyectada. Siete causas raíz localizadas con archivo:línea exacta. La tríada está trazada. Ningún fix aplicado a la UI según directiva.*
