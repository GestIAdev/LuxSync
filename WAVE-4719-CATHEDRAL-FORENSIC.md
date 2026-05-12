# ═══════════════════════════════════════════════════════════════════════════
# OPERACIÓN "NO ASUNCIONES" — AUDITORÍA FORENSE CATEDRAL CINÉTICA
# WAVE 4700-4719: L2 Enrutamiento Post-migration
# ═══════════════════════════════════════════════════════════════════════════

> **Fecha:** 2026-05-11  
> **Auditor:** Cascade (Sonnet Forense)  
> **Mandato:** Solo diagnóstico. Cero código de corrección en este documento.

---

## 0. MAPA DEL PIPELINE (Referencia para las 3 auditorías)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Renderer)                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ KineticsBridge  │→│ ProgrammerBridge│→│ selectionStore.getArray │  │
│  │ - Radar XY pad  │  │ - L2 overrides  │  │ - getSelectedIds()      │  │
│  │ - PatternArsenal│  │ - dimmer/color  │  │   (Set<string>)         │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────┘  │
│           │                    │                                          │
│           ▼ IPC                ▼ IPC                                     │
│  lux:aether:setManualPattern  lux:aether:setManualOverrides              │
│  lux:aether:updateKineticScalars                                        │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  BACKEND (Main Process)                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │ AetherIPCHandlers  │→│ AetherKineticEngine  │→│ NodeArbiter      │   │
│  │ - mapToNativePat   │  │ - tick(44Hz)         │  │ - L0/L1/L2/L3/L4 │   │
│  │ - vibeMM.silence() │  │ - writes pan_base    │  │ - arbitrate()    │   │
│  └────────────────────┘  └──────────────────────┘  └──────────────────┘   │
│           │                                           ▲                   │
│           │         ┌─────────────────────────┐         │                   │
│           └────────→│ VibeMovementManager   │─────────┘                   │
│                     │ (KineticAdapter L0) │                               │
│                     │ - generateIntent()    │                               │
│                     │ - selectPattern()     │                               │
│                     └─────────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Jerarquía de capas en NodeArbiter.arbitrate():**
1. **L0** — `systemBus` (VMM/KineticAdapter → pan/tilt automáticos para TODOS los nodos)
2. **L1** — Selene IA overrides
3. **LP** — Playback (Chronos)
4. **L2** — `_manualOverrides` Map (UI/MIDI faders → pan_base/tilt_base para seleccionados)
5. **L3** — Effect intents
6. **L3+** — Hephaestus
7. **HARD LOCK** — Re-aplica `_manualChannelLocks` (excluyendo `pan_base`/`tilt_base`)
8. **HTP LOCK** — Re-aplica `_manualDimmerLocks`

**LTP rule:** `pan` y `tilt` NO son HTP → la última capa que escribe gana.

---

## AUDITORÍA 1: EL SCOPE LEAK DEL RADAR

### 1.1 Síntoma Reportado
El radar (XY pad clásico) mueve TODAS las fixtures del show, no solo las seleccionadas.

### 1.2 Traza del código — ¿Qué envía el bridge?

**Archivo:** `KineticsBridge.ts:313-356` (`_flushClassic`)

```typescript
const fixtureIds = getSelectedIds()   // ← SOLO fixtures seleccionados
if (fixtureIds.length === 0) return
// WAVE 4719: hasNonPositionKineticManual — bloquea si hay speed/targets/extras
if (hasNonPositionKineticManual(fixtureIds)) return

const payloads = fixtureIds.map((id, i) => {
  // ...
  return {
    nodeId:   `${id}:kinetic`,
    channels: { [panChannel]: panFinal, [tiltChannel]: tiltNorm },
  }
})
await window.lux?.aether?.setManualOverrides(payloads)
```

**Hallazgo 1A:** El bridge envía `setManualOverrides` EXCLUSIVAMENTE para `getSelectedIds()`. No hay `undefined` ni array global. El scope del bridge es correcto.

**Hallazgo 1B:** Si NO hay patrón activo, envía canales `pan`/`tilt` (absolutos). Si SÍ hay patrón activo, envía `pan_base`/`tilt_base` (orbit).

### 1.3 Traza del backend — ¿Qué recibe y cómo lo aplica?

**Archivo:** `AetherIPCHandlers.ts:61-83`

```typescript
for (const { nodeId, channels } of payloads) {
  arbiter.setManualOverride(nodeId, channels)
}
```

**Hallazgo 1C:** Cada payload se escribe en `_manualOverrides` con su `nodeId` individual. No hay difusión a otros nodos.

**Archivo:** `NodeArbiter.ts:294-344` (aplicación de L2)

```typescript
for (const [nodeId, channels] of this._manualOverrides) {
  // Solo aplica para los nodeIds que están en el Map
  if (key === 'pan_base')  record['pan'] = incoming
  if (key === 'tilt_base') record['tilt'] = incoming
}
```

**Hallazgo 1D:** La aplicación de L2 es por-nodeId. Los fixtures NO seleccionados no tienen entrada en `_manualOverrides`, por lo que NO reciben override del radar.

### 1.4 PERO — El flujo automático L0 sigue vivo para todos

**Archivo:** `KineticAdapter.ts:164-219`

```typescript
nodes.forEach((node, _index) => {
  const intent = this._vmm.generateIntent(vibeId, va, ...)
  this._valuesDict['pan']  = (intent.x + 1) * 0.5
  this._valuesDict['tilt'] = (intent.y + 1) * 0.5
  bus.push(this._intentScratch)
})
```

**Hallazgo 1E (CRÍTICO):** El `KineticAdapter` itera sobre TODOS los nodos KINETIC del NodeGraph. Para cada uno, llama a `vmm.generateIntent()` que produce un `pan`/`tilt` automático (patrón de la IA). Estos se inyectan como L0 en el `IntentBus`.

**Archivo:** `NodeArbiter.ts:266-272`

```typescript
// L0: System intents (IntentBus)
if (this._systemBus) {
  const all = this._systemBus.getAll()
  for (...) this._applyIntent(all[i], 'system')
}
```

**Hallazgo 1F:** L0 se aplica ANTES que L2. Para los fixtures NO seleccionados, solo L0 existe → siguen con el patrón automático de la IA. Para los SELECCIONADOS, L2 se aplica DESPUÉS y sobreescribe `pan`/`tilt`.

### 1.5 Diagnóstico del Radar Comunista

**La arquitectura es técnicamente correcta:** el radar solo afecta a los seleccionados via L2.

**PERO hay un artefacto perceptual que el operador puede interpretar como "radar comunista":**

| Fixture | Patrón automático L0 | Override radar L2 | Resultado visual |
|---------|---------------------|-------------------|------------------|
| NO seleccionada | `pan`/`tilt` dinámicos (IA) | Ninguno | Sigue bailando |
| Seleccionada | `pan`/`tilt` dinámicos (IA) | `pan`/`tilt` fijos (radar) | Se congela en posición del radar |

Cuando el operador toca el radar, las NO seleccionadas siguen en movimiento (patrón IA), mientras las seleccionadas se congelan en la posición del radar. **Desde la perspectiva del operador, "todas se mueven" porque las no-seleccionadas nunca dejan de moverse.** El radar no las controla, pero tampoco las congela.

**No hay scope leak técnico. Hay una asimetría de diseño:** el radar controla posición (L2), pero no desactiva el patrón automático (L0) de las fixtures no seleccionadas.

### 1.6 Sub-diagnóstico: Overrides zombies del radar

**Archivo:** `KineticsBridge.ts:222-240` (suscripción a cambio de selección)

```typescript
useSelectionStore.subscribe(
  (s) => s.selectedIds,
  (_selectedIds) => {
    this._lastFixtureKeysSent = null
    // Re-envía estado ACTUAL a los NUEVOS seleccionados
    this._schedulePatternFlush(...)
    this._scheduleClassicFlush(pan, tilt, fanValue)
  },
)
```

**Hallazgo 1G:** Cuando cambia la selección, el bridge re-envía el radar a los **nuevos** seleccionados, pero **NUNCA limpia los overrides L2 de los anteriores**.

**Archivo:** `AetherIPCHandlers.ts:361-377`

```typescript
const prevKineticState = aetherKineticEngine.getState()
aetherKineticEngine.setManualKinetics(nodeIds, ...)
if (prevKineticState.active) {
  for (const prevNodeId of prevKineticState.nodeIds) {
    if (!newNodeSet.has(prevNodeId)) arbiter.clearManualOverride(prevNodeId)
  }
}
```

**Hallazgo 1H:** `AetherIPCHandlers` SÍ limpia L2 de fixtures salientes para **patrones** (`setManualPattern`). Pero `_flushClassic` (radar) NO pasa por `setManualPattern` — va directo a `setManualOverrides`. Los overrides del radar quedan en `_manualOverrides` para siempre hasta que se haga un `clearManualOverride` explícito.

**Consecuencia:** Si el operador mueve el radar con fixture A seleccionada, luego cambia a fixture B, la fixture A sigue congelada en la posición del radar anterior (override zombie). El operador percibe "el radar movió algo que ya no debería moverse".

---

## AUDITORÍA 2: LA GUERRA DE PRIORIDADES (L0 vs L2)

### 2.1 Síntoma Reportado
Al activar un patrón manual (ej. `bounce` → `botstep` en L2), el backend sigue ejecutando el patrón automático de la IA (ej. `[CHOREO] fiesta-latina | figure8`).

### 2.2 Traza del patrón manual — ¿Llega al motor?

**Archivo:** `KineticsBridge.ts:371-430` (`_flushPattern`)

```typescript
const fixtureIds = getSelectedIds()
const enginePattern = toEnginePattern(activePattern)  // 'bounce' → 'botstep'
await window.lux?.aether?.setManualPattern({
  fixtureIds,
  pattern: enginePattern,  // 'botstep'
  speed, amplitude, fan
})
```

**Archivo:** `AetherIPCHandlers.ts:315-384`

```typescript
const nativePattern = mapToNativePattern(pattern)  // 'bounce' → 'botstep'
vibeMovementManager.setManualPattern(null)         // Silencia VMM
vibeMovementManager.setManualSpeed(null)
vibeMovementManager.setManualAmplitude(null)
// Limpieza de L2 para fixtures salientes
aetherKineticEngine.setManualKinetics(nodeIds, nativePattern, speedNorm, amplitudeNorm, fanNorm)
```

**Hallazgo 2A:** El patrón manual LLEGAl motor. `setManualKinetics` registra el patrón nativo y los nodeIds seleccionados.

### 2.3 Traza del hot-path — ¿El motor escribe en cada frame?

**Archivo:** `TitanOrchestrator.ts:1920-1925`

```typescript
// ⚡ WAVE 4700: Motor cinético nativo L2 — tick antes de arbitrate().
if (aetherKineticEngine.isActive()) {
  aetherKineticEngine.tick(this._aetherCtx.deltaMs / 1000, aetherArbiter)
}
```

**Archivo:** `AetherKineticEngine.ts:346-400`

```typescript
tick(dtSeconds: number, arbiter: NodeArbiter): void {
  const cfg = this._config
  if (!cfg) return   // Motor inactivo → no-op

  const patternFn = PATTERN_FNS[cfg.pattern]  // 'botstep' → function
  for (let i = 0; i < total; i++) {
    const { x, y } = patternFn(phase + fanOffset)
    const scaledX = x * amplitude
    const scaledY = y * amplitude

    // WAVE 4718: Lee anchor del radar de L2
    const l2 = arbiter.getManualOverride(nodeId)
    const anchorPan  = l2?.['pan_base'] ?? 0.5
    const anchorTilt = l2?.['tilt_base'] ?? 0.5

    const panBase  = clamp01(anchorPan  + scaledX * 0.5)
    const tiltBase = clamp01(anchorTilt + scaledY * 0.5)

    rec['pan_base'] = panBase
    rec['tilt_base'] = tiltBase
    arbiter.setManualOverride(nodeId, rec)
  }
}
```

**Hallazgo 2B:** El motor L2 ESCRIBE `pan_base`/`tilt_base` en el NodeArbiter para los fixtures seleccionados, CADA frame, con la oscilación del patrón `botstep`.

### 2.4 Traza del L0 — ¿El patrón automático sigue corriendo?

**Archivo:** `KineticAdapter.ts:164-219`

```typescript
nodes.forEach((node, _index) => {
  const intent = this._vmm.generateIntent(vibeId, va, node.stereoIndex, node.stereoTotal, ...)
  this._valuesDict['pan']  = (intent.x + 1) * 0.5
  this._valuesDict['tilt'] = (intent.y + 1) * 0.5
  bus.push(this._intentScratch)
})
```

**Hallazgo 2C:** El `KineticAdapter` sigue llamando `vmm.generateIntent()` para TODOS los nodos KINETIC en CADA frame. Esto produce L0 para TODOS los fixtures, incluyendo los seleccionados.

**Archivo:** `VibeMovementManager.ts:1022-1039` (`selectPattern`)

```typescript
private selectPattern(config: VibeConfig, audio: AudioContext): string {
  if (this.manualPatternOverride !== null) {
    return this.manualPatternOverride  // ← Solo si hay override activo
  }
  // ... rota patrones automáticos del vibe actual
  return patterns[patternIndex]
}
```

**Hallazgo 2D:** Cuando `AetherIPCHandlers` activa patrón manual, llama `vibeMovementManager.setManualPattern(null)`. Esto pone `manualPatternOverride = null`. Desde ese momento, `selectPattern` vuelve a patrón automático de IA. El VMM genera `figure8` (fiesta-latina) o el patrón del vibe actual.

**Hallazgo 2E:** El VMM fue silenciado para que NO use patrón manual, pero NO fue silenciado para que NO genere intents. Sigue generando `pan`/`tilt` automáticos para TODOS los nodos como L0.

### 2.5 La batalla en NodeArbiter — ¿Quién gana?

**Archivo:** `NodeArbiter.ts:266-344`

```typescript
// Paso 1: L0 (VMM automático) → escribe pan/tilt para TODOS
for (all system intents) _applyIntent(intent, 'system')
// ... L1, LP ...
// Paso 4: L2 (manual overrides) → escribe pan_base/tilt_base para seleccionados
for (const [nodeId, channels] of this._manualOverrides) {
  if (key === 'pan_base')  record['pan'] = incoming   // ← Sobreescribe L0
  if (key === 'tilt_base') record['tilt'] = incoming   // ← Sobreescribe L0
}
```

**Hallazgo 2F:** Técnicamente, L2 sobreescribe L0. Los fixtures seleccionados deberían ejecutar `botstep` (patrón manual L2), mientras los no seleccionados ejecutan `figure8` (patrón automático L0).

### 2.6 Diagnóstico — ¿Por qué el patrón manual es ignorado?

**Hipótesis 2A — Manual Hard Lock anula L2:**

En `NodeArbiter.ts:323-330`:

```typescript
if (!MANUAL_HARD_LOCK_EXCLUDED_CHANNELS.has(key)) {
  let lockRecord = this._manualChannelLocks.get(nodeId)
  lockRecord[key] = incoming  // Guarda pan/tilt absolutos del radar
}
```

`pan_base` y `tilt_base` están en `MANUAL_HARD_LOCK_EXCLUDED_CHANNELS`, así que NO se guardan en `_manualChannelLocks`. Pero `pan` y `tilt` (absolutos del radar) SÍ se guardan.

En `NodeArbiter.ts:356-372`:

```typescript
// WAVE 4714: MANUAL HARD LOCK
if (this._manualChannelLocks.size > 0) {
  for (const [nodeId, lockChannels] of this._manualChannelLocks) {
    for (const ch in lockChannels) {
      record[ch] = v   // ← Re-aplica pan/tilt absolutos del radar DESPUÉS de L3
    }
  }
}
```

**Este es el punto de fallo más probable.**

Si el operador:
1. Mueve el radar → `_flushClassic` envía `pan=0.7, tilt=0.5` (absolutos) → se guardan en `_manualChannelLocks`
2. Activa patrón manual `bounce` → motor L2 escribe `pan_base`/`tilt_base` en cada frame
3. En NodeArbiter:
   - L0: VMM escribe `pan`, `tilt` (automático)
   - L2: Motor escribe `pan_base`/`tilt_base` → convierte a `pan`, `tilt` (manual)
   - L3: Effects (posiblemente nada)
   - **HARD LOCK:** Re-aplica `pan=0.7, tilt=0.5` (absolutos del radar) → **SOBREESCRIBE el patrón manual**

**Resultado:** Los fixtures seleccionados se congelan en la posición del radar, en lugar de oscilar con el patrón manual. El operador ve "el patrón manual es ignorado".

**Hipótesis 2B — Canal dual (pan vs pan_base):**

Si `_flushClassic` envió `pan`/`tilt` (absolutos) cuando NO había patrón, y luego `_flushPattern` envía `pan_base`/`tilt_base` (orbit) cuando SÍ hay patrón, ambos coexisten en `_manualOverrides` para el mismo nodeId:

```
_manualOverrides["fix-01:kinetic"] = {
  pan: 0.7,        // ← del radar, absoluto
  tilt: 0.5,       // ← del radar, absoluto
  pan_base: 0.6,   // ← del motor L2, orbit
  tilt_base: 0.4    // ← del motor L2, orbit
}
```

En el loop de L2 (NodeArbiter:317-343):
1. Primero itera `pan: 0.7` → `record['pan'] = 0.7`
2. Luego itera `pan_base: 0.6` → `record['pan'] = 0.6`
3. Luego `tilt: 0.5` → `record['tilt'] = 0.5`
4. Luego `tilt_base: 0.4` → `record['tilt'] = 0.4`

En este orden, `pan_base`/`tilt_base` ganan (porque aparecen después en el Record de channels). PERO si el orden de iteración de keys en JavaScript cambia (no es garantizado), `pan` podría ganar sobre `pan_base`.

**No obstante**, el Manual Hard Lock (líneas 359-372) re-aplica `pan`/`tilt` DESPUÉS de todo, con certeza de que ganen.

**Conclusión Auditoría 2:** El patrón manual NO es ignorado por L0 vs L2 en la jerarquía del Arbiter. L2 técnicamente tiene prioridad sobre L0. El patrón manual es **anulado por el Manual Hard Lock** que re-aplica los valores absolutos del radar (`pan`/`tilt`) después de L3, sobreescribiendo los `pan`/`tilt` derivados de `pan_base`/`tilt_base`.

El L0 (VMM automático) sigue corriendo para todos los nodos, pero eso es por diseño. Para los fixtures con L2 activo, L0 se supone que es sobreescrito. El problema no es L0 vs L2 — es el **HARD LOCK vs L2**.

---

## AUDITORÍA 3: EL FAN Y LOS ESCALARES

### 3.1 Síntoma Reportado
Los sliders de Speed, Amplitude y Fan/Caos no hacen nada.

### 3.2 Traza del frontend — ¿Se envían los cambios?

**Archivo:** `KineticsBridge.ts:388-406`

```typescript
const samePatternAndFixtures =
  !isStop &&
  enginePattern === this._lastPatternSent &&
  fixtureKey === this._lastFixtureKeysSent

if (samePatternAndFixtures) {
  await window.lux?.aether?.updateKineticScalars({ speed, amplitude, fan })
  return
}
```

**Hallazgo 3A:** Si el patrón y los fixtures son los mismos que el último flush, envía `updateKineticScalars` (ruta rápida). Si cambió patrón o selección, envía `setManualPattern` completo (que incluye los nuevos valores).

### 3.3 Traza del backend — ¿Se aplican los scalares?

**Archivo:** `AetherIPCHandlers.ts:393-407`

```typescript
ipcMain.handle('lux:aether:updateKineticScalars', (_event, { speed, amplitude, fan }) => {
  aetherKineticEngine.updateScalars(
    (speed ?? 50) / 100,
    (amplitude ?? 50) / 100,
    (fan ?? 0) / 100,
  )
})
```

**Archivo:** `AetherKineticEngine.ts:293-298`

```typescript
updateScalars(speed: number, amplitude: number, fan: number): void {
  if (!this._config) return    // ← MOTOR INACTIVO → NO-OP SILENCIOSO
  this._config.speed     = clamp01(speed)
  this._config.amplitude = clamp01(amplitude)
  this._config.fan       = clampSigned(fan)
}
```

**Hallazgo 3B (CRÍTICO):** `updateScalars` es **no-op silencioso** si `this._config === null` (motor inactivo).

### 3.4 ¿Cuándo está inactivo el motor?

El motor está inactivo cuando:
1. Nunca se ha llamado `setManualKinetics` (ningún patrón manual activado)
2. Se llamó `stop()` (patrón `null`, `static` o `hold`)
3. Se llamó `stop()` indirectamente (por ejemplo, `_flushPattern` envió `activePattern: 'none'` → `enginePattern: 'hold'` → `aetherKineticEngine.stop()`)

**Archivo:** `AetherIPCHandlers.ts:332-340`

```typescript
if (pattern === null || pattern === 'static' || pattern === 'hold') {
  aetherKineticEngine.stop(arbiter)
  // ...
  return { success: true }
}
```

### 3.5 Diagnóstico — ¿Por qué los escalares no funcionan?

**Hipótesis 3A — Motor detenido por patrón 'none':**

En `KineticsBridge.ts:71-73`:

```typescript
function toEnginePattern(p: string): string {
  return (p === 'none' || p === 'static') ? 'hold' : p
}
```

Si `movementStore.activePattern === 'none'`, `_flushPattern` envía `enginePattern = 'hold'`. El handler backend llama `aetherKineticEngine.stop()` y retorna. El motor queda inactivo.

Si luego el operador cambia a `activePattern = 'bounce'`, el bridge hace `setManualPattern({ pattern: 'bounce', ... })`. El motor se activa con los valores actuales de speed/amplitude/fan.

PERO si el operador mueve los sliders DE ADENTRO del patrón 'none' (es decir, ajusta speed/amplitude sin haber activado ningún patrón), `updateKineticScalars` es no-op porque el motor está detenido.

**Hipótesis 3B — Inconsistencia de estado entre frontend y backend:**

El frontend tiene `movementStore.patternSpeed`, `movementStore.patternAmplitude`, `movementStore.fanValue`. Estos valores se envían en cada `_flushPattern`. PERO si el operador ajusta los sliders MIENTRAS el patrón está activo:

1. `_flushPattern` detecta `samePatternAndFixtures = true`
2. Envía `updateKineticScalars` con los nuevos valores
3. Backend actualiza `_config.speed`, `_config.amplitude`, `_config.fan`
4. Motor usa los nuevos valores en el siguiente `tick()`

Esto debería funcionar. A menos que...

**Hipótesis 3C — El VMM recibe los scalares manuales pero el KineticAdapter los ignora:**

El VMM tiene `manualSpeedOverride` y `manualAmplitudeOverride`. Cuando `AetherIPCHandlers` silencia el VMM:

```typescript
vibeMovementManager.setManualSpeed(null)
vibeMovementManager.setManualAmplitude(null)
```

Pone los overrides a `null`. El VMM vuelve a control automático.

PERO... los escalares del patrón manual (speed, amplitude, fan) son propiedad del **AetherKineticEngine**, no del VMM. El VMM no los recibe ni los usa cuando está silenciado. Esto es correcto.

**Hipótesis 3D — Fan enviado en rango incorrecto:**

En `KineticsBridge.ts:414-422`:

```typescript
await window.lux?.aether?.setManualPattern({
  fixtureIds,
  pattern: enginePattern,
  speed,        // ← 0-100 (UI range)
  amplitude,    // ← 0-100
  fan,          // ← -100..100
})
```

En backend (`AetherIPCHandlers.ts:344-346`):

```typescript
const speedNorm     = (speed ?? 50) / 100    // → [0, 1]
const amplitudeNorm = (amplitude ?? 50) / 100
const fanNorm       = (fan ?? 0)  / 100     // → [-1, 1]
```

En `AetherKineticEngine.setManualKinetics`:

```typescript
this._config = {
  nodeIds, pattern,
  speed:    clamp01(speed),       // ← [0, 1]
  amplitude: clamp01(amplitude),   // ← [0, 1]
  fan:      clampSigned(fan),     // ← [-1, 1]
}
```

Y en `tick()`:

```typescript
const fanRange = cfg.fan * TWO_PI   // fan ∈ [-1,1] → [-2π, 2π]
```

**Hallazgo 3C:** El fan se normaliza correctamente. `fan = -100` → `fanNorm = -1.0` → `fanRange = -2π`. `fan = 100` → `fanNorm = 1.0` → `fanRange = 2π`. La matemática es correcta.

### 3.6 Diagnóstico final de escalares

**Causa más probable:** El operador ajusta los escalares cuando NO hay patrón activo (`activePattern === 'none'` o el motor está detenido). En ese estado, `updateKineticScalars` es **no-op silencioso**. Los sliders se mueven en la UI pero no tienen efecto porque no hay motor activo para consumirlos.

**Causa secundaria posible:** Si el operador cambia speed/amplitude/fan mientras `samePatternAndFixtures` es `false` (por ejemplo, porque `_lastPatternSent` quedó invalidado por un error previo), cada cambio de scalar envía `setManualPattern` completo en lugar de `updateKineticScalars`. Pero `setManualPattern` también configura los scalares, así que debería funcionar.

**Causa terciaria:** El motor L2 usa `cfg.speed` y `cfg.amplitude` para calcular la oscilación. Si el operador tiene un override de `pan`/`tilt` absoluto del radar (del HARD LOCK), la oscilación del patrón se aplica pero el resultado se sobreescribe inmediatamente por el HARD LOCK. El scalar parece "no hacer nada" porque la salida final es estática (congelada por el radar).

---

## RESUMEN DE CAUSAS RAÍZ

### Síntoma 1: Radar Comunista
**Causa raíz:** No hay scope leak técnico. El bridge envía solo a los seleccionados. PERO:
1. Las fixtures NO seleccionadas siguen con el patrón automático L0 (nunca se les congela)
2. Los overrides del radar (`pan`/`tilt` absolutos) NO se limpian al cambiar de selección → zombies
3. El Manual Hard Lock re-aplica `pan`/`tilt` absolutos del radar DESPUÉS de todo, anulando cualquier oscilación L2

### Síntoma 2: Insubordinación L0 vs L2
**Causa raíz:** L2 NO es ignorado por L0. El patrón manual L2 sí se aplica en el NodeArbiter. PERO el **Manual Hard Lock** (WAVE 4714) re-aplica los `pan`/`tilt` absolutos del radar DESPUÉS de L3, sobreescribiendo los `pan`/`tilt` que L2 derivó de `pan_base`/`tilt_base`. El patrón manual oscila en la oscuridad, pero el HARD LOCK lo mata antes de que llegue a la salida.

### Síntoma 3: Parálisis de Escalares
**Causa raíz:** `updateKineticScalars` es no-op silencioso cuando el motor L2 está inactivo (`_config === null`). Esto ocurre si no hay patrón activo (`activePattern === 'none'`). Los sliders de la UI ajustan valores en el store pero nunca llegan a un motor activo. Cuando el motor SÍ está activo, los escalares probablemente funcionan, pero su efecto es INVISIBLE porque el HARD LOCK del Radar congela la salida final.

---

## MAPA DE FALLOS IDENTIFICADOS (Solo para referencia de futura implementación)

| # | Fallo | Ubicación exacta | Tipo |
|---|-------|-----------------|------|
| F1 | Overrides del radar no se limpian al cambiar selección | `KineticsBridge.ts:222-240` — no hay `clearManualOverrides` para salientes | Diseño |
| F2 | Manual Hard Lock re-aplica `pan`/`tilt` absolutos del radar, anulando L2 orbit | `NodeArbiter.ts:356-372` — `_manualChannelLocks` contiene `pan`/`tilt` del radar | Lógica |
| F3 | L2 orbit channels (`pan_base`/`tilt_base`) están EXCLUIDOS del HARD LOCK, por lo que NO se re-aplican | `NodeArbiter.ts:52` — `MANUAL_HARD_LOCK_EXCLUDED_CHANNELS` | Diseño (intencional pero problemático) |
| F4 | `updateKineticScalars` es no-op silencioso cuando motor inactivo | `AetherKineticEngine.ts:293-298` — `if (!this._config) return` | Diseño |
| F5 | KineticAdapter sigue generando L0 para TODOS los nodos, incluso cuando L2 está activo | `KineticAdapter.ts:164-219` — no hay gate de L2 | Diseño (intencional, LTP debería resolver) |
| F6 | `_flushClassic` bloquea por `hasNonPositionKineticManual` sin feedback al operador | `KineticsBridge.ts:318-322` — retorna silenciosamente | UX |

---

*Fin del informe forense. Ningún código de corrección fue generado. Tres síntomas trazados a 5 causas raíz identificadas. La arquitectura de prioridades L0→L2 es funcional; el Manual Hard Lock (WAVE 4714) es el asesino silencioso que anula el patrón manual.*
