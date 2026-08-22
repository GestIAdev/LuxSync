Mientras el subagent explora los paths de render, yo investigo el motor de BPM en paralelo:

Encontré el cálculo clave del BPM en línea 622: `this.lastBpm = tau > 0 ? (60.0 * this.odfRate) / tau : 0`. Hay guard `tau > 0`. Veamos el `parabolicRefine` para ver si puede devolver NaN:

Continuando la auditoría del motor de BPM. Veamos el RhythmTracker (Kalman + clamp) y el TickEngine:

Excelente — el Kalman tiene clamp `[40, 300]` en línea 448-449. Ahora veamos el TickEngine (donde el BPM se convierte en fase/ticks):

Ahora veamos cómo `context.bpm` y `context.beatPhase` llegan al render worker. Busquemos el BeatDetector/PLL:

Tengo el reporte del subagent. Ahora investigo el BPM "clavado en 64" y los límites del BeatDetector:

Ahora veamos cómo `context.bpm` y `context.beatPhase` fluyen al Aether engine y luego al glassView que pinta FixtureLayer:

Ahora veamos cómo los intents del Aether se convierten en glassView (Float32Array) que TacticalCanvas envía al worker:

Ahora veamos cómo se llena el glassView con los valores de pan/tilt/zoom — busquemos el commitFrame o el punto donde los intents se resuelven a valores físicos:

Ahora tengo el cuadro completo. Veamos el `TacticalCanvas.packGlassFrameInto` que lee del glassView:

Ahora tengo todo el cuadro. Veamos si hay algún guard en el FixtureLayer.drawBeam actual (después de nuestros patches previos):

Ahora tengo todo el panorama. Verifico el `mapRange` para ver si tiene guards:

---

# REPORT: OPERACIÓN "POISON PILL" — Caza de NaNs

## Veredicto Ejecutivo

**El motor de detección de BPM (TempoOracle + Kalman + BeatDetector) está bien protegido contra NaN/Infinity.** Todos los cálculos críticos tienen guards explícitos. Sin embargo, **el motor gráfico (FixtureLayer, AudioReactorRing, OrbitTrailCanvas, RigMonitorCanvas) está expuesto a NaNs** que pueden entrar por dos vectores: (1) valores corruptos en el glassView Float32Array, y (2) telemetría NaN desde el bus de datos. El BPM "clavado en 64" es un problema de DSP (octava errónea), no de corrupción numérica.

---

## 1. Auditoría del Motor de BPM — Protección contra NaN/Infinity

### TempoOracle — Guards explícitos ✅

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts" lines="544-546" />

**NSDF division guardiada (línea 546):**
```typescript
nsdf[t] = m > 1e-12 ? (2.0 * r) / m : 0.0
```
Un solo NaN entrando al ring envenenaría 512 frames de ACF. El guard `m > 1e-12` previene `0/0 = NaN` y `x/0 = Infinity`.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts" lines="660-671" />

**Parabolic refine guard (línea 667):**
```typescript
if (!(denom < -1e-9) || y0 < ym || y0 < yp) return t
```
Si `denom = 0` (división por cero), retorna `t` sin interpolar. Si `denom` es NaN, `!(NaN < -1e-9)` = `!false` = `true`, también retorna `t`.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/bpm/TempoOracle.ts" lines="622-622" />

**BPM calculation guard (línea 622):**
```typescript
this.lastBpm = tau > 0 ? (60.0 * this.odfRate) / tau : 0
```
Si `tau = 0` o `tau = NaN`, `tau > 0` es `false`, retorna `0`. Si `odfRate` es NaN (imposible tras calibración), el BPM sería NaN — pero `odfRate` se setea en `applyOdfRate` desde `1000 / (calibDtSum / calibFrames)` donde `calibDtSum > 0` (solo se acumulan `dt > 0` filtrados en línea 470).

### Kalman 1D — Clamp de cordura ✅

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/senses/tracking/RhythmTracker.ts" lines="419-451" />

**Guard de entrada (línea 420):**
```typescript
if (!(measurement > 0) || confidence < KALMAN_MIN_CONFIDENCE) {
  return this.kalmanInitialized ? this.kalmanBpm : 0
}
```
`!(NaN > 0)` = `!false` = `true` → rechaza NaN. `!(Infinity > 0)` = `false` → acepta Infinity, pero el clamp posterior lo atrapa.

**Clamp de salida (líneas 448-449):**
```typescript
if (this.kalmanBpm < 40) this.kalmanBpm = 40
else if (this.kalmanBpm > 300) this.kalmanBpm = 300
```
Cualquier valor fuera de [40, 300] se clampea. NaN no es `< 40` ni `> 300` (ambas comparaciones son `false`), así que NaN pasaría el clamp — pero el guard de entrada ya lo rechazó.

### BeatDetector PLL — División por BPM ✅ (con edge case)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts" lines="494-495" />

```typescript
const beatDuration = 60000 / this.pllSmoothedBpm
```

**Si `pllSmoothedBpm = 0`:** `beatDuration = Infinity`. Luego:
- `halfBeat = Infinity / 2 = Infinity`
- `error % Infinity = error` (cualquier finito mod Infinity = finito)
- `wrappedError > Infinity` = `false` → entra al soft correction con `pCorrection = error * GAIN` (finito)
- **No produce NaN**, pero el PLL queda en estado degenerado

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/engine/audio/BeatDetector.ts" lines="610-620" />

**Phase advance con BPM=0 (línea 620):**
```typescript
this.pllCurrentPhase = 1.0 - (timeToNextBeat / beatDuration)
```
`finite / Infinity = 0` → `phase = 1.0 - 0 = 1.0` → `1.0 % 1.0 = 0`. **No NaN, phase se clava en 0.**

**Clamp del PLL (línea 576):**
```typescript
this.pllSmoothedBpm = Math.max(this.minBpm, Math.min(this.maxBpm, this.pllSmoothedBpm))
```
`minBpm = 60`, `maxBpm = 200`. Pero `Math.max(60, Math.min(200, NaN))` = `Math.max(60, NaN)` = `NaN`. **El clamp NO atrapa NaN.** Si `pllSmoothedBpm` llega a ser NaN, el clamp falla.

### TickEngine — Hysteresis + EMA ✅ (con edge case del `?? 0`)

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts" lines="395-396" />

```typescript
const workerBpm = this.audioPipeline.lastAudioData.workerBpm ?? 0
```

**⚠️ Edge case:** `NaN ?? 0` = `NaN` (nullish coalescing solo atrapa `null`/`undefined`, no `NaN`). Si el worker envía `workerBpm = NaN` via IPC, `workerBpm` será `NaN`. Sin embargo, el guard `workerBpm > 0 && workerConfidence > 0.5` (línea 420) rechaza NaN (`NaN > 0` = `false`), así que cae al freewheel path.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts" lines="660-665" />

**EMA smoothing (líneas 660-665):**
```typescript
if (this._smoothedBpm <= 0) {
  this._smoothedBpm = context.bpm
} else if (context.bpm > 0) {
  this._smoothedBpm = (TickEngine.BPM_EMA_ALPHA * context.bpm) + (1 - TickEngine.BPM_EMA_ALPHA) * this._smoothedBpm
}
context.bpm = this._smoothedBpm
```
Si `context.bpm = NaN`: `NaN > 0` = `false`, `_smoothedBpm` no se actualiza. **NaN se descarta.** ✅

---

## 2. BPM "Clavado en 64" — Diagnóstico DSP

El BPM 64 no es corrupción numérica — es un **error de detección de octava**. A 21.5 Hz ODF rate:
- 128 BPM → lag = 21.5 × 60 / 128 = **10.08 frames**
- 64 BPM → lag = 21.5 × 60 / 64 = **20.16 frames**

El TempoOracle busca en el rango [BPM_MIN=60, BPM_MAX=200], que corresponde a lags [6.45, 21.5]. El lag 20.16 (64 BPM) está dentro del rango. Si el ODF tiene un pico periódico en lag ~20 (que puede ocurrir por un patrón de bajo lento o por el doble de un kick a 128 BPM), el Oracle reportará 64 BPM.

**El sistema tiene 3 capas de defensa contra esto:**

1. **Harmonic ladder** (TempoOracle línea 563-567): El lag 10 (128 BPM) debería puntuar mejor que el lag 20 (64 BPM) porque su armónico 2× cae en lag 20, que también correlaciona. Pero en señales con poco contenido armónico, el lag 20 puede ganar.

2. **MPM shortest-peak rule** (línea 589): Prefiere el lag más corto que supere el 70% del máximo. Lag 10 < lag 20, así que si ambos superan el umbral, gana el 10. Pero si el lag 10 no supera el umbral (señal débil en ese periodo), gana el 20.

3. **TickEngine hysteresis shield** (líneas 467-511): Requiere 180 frames @ conf>0.9 para aceptar un cambio de ÷2. **Pero si el sistema arranca en 64 BPM (no hay `stableBpm` previo), el shield no tiene referencia para rechazar.**

**Conclusión:** El BPM 64 es un lock inicial erróneo, no un NaN. El sistema no puede corregirlo sin un `stableBpm` previo correcto. El WAVE 7544 dual-detector correction (líneas 445-461) intenta resolver esto comparando oracle raw vs kalman, pero requiere que ambos detectores acuerden — si ambos se equivocan en la misma octava, no hay corrección.

---

## 3. Motor Gráfico — Exposición a NaN/Infinity

### Vector de Infección: glassView → TacticalCanvas → Worker → FixtureLayer

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts" lines="1618-1637" />

El glassView se llena con `fs.r ?? 0`, `fs.pan ?? 0`, etc. El `?? 0` atrapa `null`/`undefined` pero **NO atrapa `NaN`**. Si el Aether engine produce `fs.physicalPan = NaN`, se escribe `NaN` en el Float32Array.

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx" lines="130-142" />

`packGlassFrameInto` hace `glassView[gOff + GF_PHYS_PAN] / 255`. Si el valor es `NaN`, `NaN / 255 = NaN`. El NaN se transfiere al worker via `postMessage` (Float32Array soporta NaN).

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/layers/FixtureLayer.ts" lines="79-82" />

**`mapRange` tiene clamp interno:**
```typescript
const mapRange = (v, inMin, inMax, outMin, outMax) => {
  const t = clamp((v - inMin) / (inMax - inMin), 0, 1)
  return lerp(outMin, outMax, t)
}
```
Pero `clamp(NaN, 0, 1)` = `Math.max(0, Math.min(1, NaN))` = `Math.max(0, NaN)` = **`NaN`**. **El clamp NO atrapa NaN.** El NaN fluye a través de `mapRange` sin ser atrapado.

### FixtureLayer.drawBeam — Sin guards ✅/⚠️

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/layers/FixtureLayer.ts" lines="212-234" />

Si `physicalPan = NaN`:
- `panAngle = mapRange(NaN, 0, 1, ...)` = `NaN`
- `Math.sin(NaN)` = `NaN` → `dirX = NaN`
- `ctx.lineTo(x + NaN * throwLength * t, ...)` → **silent no-op** (Chromium no dibuja, no crashea)

Si `zoom = NaN`:
- `coneAngleDeg = mapRange(NaN, 0, 255, ...)` = `NaN`
- `halfCone = deg2rad(NaN / 2)` = `NaN`
- `Math.tan(NaN) * throwLength` = `NaN` → `baseHalf = NaN`
- `ctx.lineTo(endXt - perpX * NaN, ...)` → **silent no-op**

**Conclusión FixtureLayer:** NaN produce **silencio visual** (no dibuja), no crash. Pero el path se invalida y los fixtures afectados desaparecen del canvas. No genera OOM.

### AudioReactorRing — CRÍTICO: createRadialGradient con NaN crashea

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/views/DashboardView/components/AudioReactorRing.tsx" lines="85-124" />

**`ctx.createRadialGradient(NaN, NaN, 0, NaN, NaN, 100)` lanza `TypeError` en Chromium.** Si `centerX` o `centerY` son NaN, el render loop crashea. Esto NO está relacionado con BPM — depende de `Math.min(W, H)` donde W/H vienen del canvas dimensions. Si el canvas tiene dimensiones válidas, no hay NaN. **Riesgo bajo.**

### OrbitTrailCanvas y RigMonitorCanvas — Telemetría NaN

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/vibeLab/scope/OrbitTrailCanvas.tsx" lines="85-87" />

Si `pan` o `tilt` del telemetryBus son NaN, `px`/`py` son NaN, y `createRadialGradient(NaN, NaN, 0, NaN, NaN, 8)` **crashea el render loop**. La telemetría viene del Aether engine — si un fixture tiene `physicalPan = NaN`, se propaga.

### WaveformLayer — Guard insuficiente

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/timeline/WaveformLayer.tsx" lines="479-482" />

```typescript
if (!ctx || bpm <= 0) return
const msPerBeat = 60000 / bpm
```
`bpm <= 0` es `false` cuando `bpm = NaN` (NaN no es ≤ 0). **El guard NO atrapa NaN.** `60000 / NaN = NaN` → todos los cálculos downstream son NaN → `ctx.lineTo(NaN, ...)` → silent no-op. No crashea, pero no dibuja.

### beatGridModel — Guards correctos ✅

<ref_snippet file="/c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/ui/timeline/beatGridModel.ts" lines="197-200" />

```typescript
const safeBpm = bpm > 0 ? bpm : 120
const msPerBeat = 60000 / safeBpm
if (!Number.isFinite(msPerBeat) || msPerBeat <= 0) return out
```
**`Number.isFinite()` atrapa NaN e Infinity.** Este es el único archivo con guards correctos.

---

## 4. Tabla Resumen de Exposición

| Componente | Vector de NaN | Operación | Comportamiento con NaN | Severidad |
|------------|---------------|-----------|----------------------|-----------|
| **FixtureLayer.drawBeam** | glassView → worker | Math.sin/cos/tan, lineTo | Silent no-op (no dibuja) | 🟡 MEDIO |
| **AudioReactorRing** | canvas dims | createRadialGradient | **TypeError crash** | 🔴 ALTO |
| **OrbitTrailCanvas** | telemetryBus pan/tilt | createRadialGradient | **TypeError crash** | 🔴 ALTO |
| **RigMonitorCanvas** | telemetryBus intensity | createRadialGradient | **TypeError crash** | 🔴 ALTO |
| **PhaseCanvas** | durationMs | Math.cos/sin, arc | Silent no-op | 🟡 MEDIO |
| **QuantumSpectrometer** | w/h dims | createRadialGradient | **TypeError crash** (si dims=NaN) | 🟡 MEDIO |
| **WaveformLayer** | bpm | 60000/bpm → lineTo | Silent no-op (guard insuficiente) | 🟢 BAJO |
| **beatGridModel** | bpm | 60000/bpm | **Guard correcto** (isFinite) | ✅ SEGURO |
| **TempoOracle** | needle, timestamps | NSDF, parabola | **Guards correctos** | ✅ SEGURO |
| **Kalman** | oracle bpm | update, clamp | **Guards correctos** | ✅ SEGURO |
| **BeatDetector PLL** | bpm | 60000/bpm | No NaN, pero BPM=0 → phase=0 | ✅ SEGURO |
| **TickEngine** | workerBpm via IPC | EMA, hysteresis | NaN descartado por `> 0` guards | ✅ SEGURO |

---

## 5. Conclusión

### Motor de BPM: NO es la fuente del OOM

El TempoOracle, Kalman y BeatDetector están **bien protegidos** contra NaN/Infinity. El pipeline completo de detección de tempo tiene guards explícitos en cada división:
- NSDF: `m > 1e-12 ? r/m : 0`
- Parábola: `!(denom < -1e-9) ? ... : t`
- BPM: `tau > 0 ? 60*rate/tau : 0`
- Kalman: `!(measurement > 0) ? ... : update` + clamp [40, 300]
- TickEngine: `workerBpm > 0 && conf > 0.5` + EMA con `context.bpm > 0`

El BPM "clavado en 64" es un **error de detección de octava** (DSP), no corrupción numérica. El lag 20 a 21.5 Hz ODF corresponde a 64 BPM, y si el ODF tiene periodicidad ahí, el Oracle lo reporta correctamente dentro de su rango [60, 200].

### Motor gráfico: Expuesto pero no causa OOM

**3 componentes pueden crashear con TypeError** si reciben NaN en `createRadialGradient` (AudioReactorRing, OrbitTrailCanvas, RigMonitorCanvas). Pero estos NaNs no provienen del BPM — provienen de telemetría o dimensiones de canvas.

**FixtureLayer.drawBeam** recibe NaN sin guards, pero `ctx.lineTo(NaN, ...)` es silent no-op en Chromium — no crashea, no genera C++ objects, no causa OOM. Los fixtures afectados simplemente no se dibujan.

**El OOM de CppHeap NO es causado por NaNs del BPM.** El OOM fue causado por la FixtureLayer gradient storm (288,000 CanvasGradient C++ objects/segundo) que ya parcheamos en la operación anterior. Los NaNs son un bug de robustez separado que merece fix, pero no es el culpable del OOM.

### Recomendaciones (sin modificar código aún)

1. **Alta prioridad:** Añadir `Number.isFinite()` guards antes de los 3 `createRadialGradient` que pueden crashear (AudioReactorRing, OrbitTrailCanvas, RigMonitorCanvas)
2. **Media prioridad:** Añadir `Number.isFinite()` guard en `packGlassFrameInto` para sanitizar NaN antes de enviar al worker
3. **Media prioridad:** Fix `mapRange` para retornar `outMin` si `v` es NaN (en lugar de propagar NaN)
4. **Baja prioridad:** Fix `WaveformLayer` guard de `bpm <= 0` → `!Number.isFinite(bpm) || bpm <= 0`
5. **Baja prioridad:** El BPM 64 es un problema de DSP que requiere ajuste del MPM threshold o calibración del ODF rate, no guards de NaN