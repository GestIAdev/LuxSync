# HAL Safety Map V2 — WAVE 4666: THE FINAL CUSTOMS

**Auditoría realizada:** 2026-05-08  
**Scope:** Pipeline Aether Nativo completo — desde NodeArbiter hasta `HAL.sendUniverseRaw()`.  
**Hardware objetivo:** Movers mecánicos (motores paso a paso), PARs con rueda de color, Fan Tungsten.  
**Auditor:** Kimi (Forense profunda sobre `TitanOrchestrator.ts`, `NodeResolver.ts`, `AetherSafetyMiddleware.ts`, `PhysicsPostProcessor.ts`).

---

## RESUMEN EJECUTIVO

| # | Capa de Seguridad | Estado | Riesgo | Ubicación en Código |
|---|---|---|---|---|
| 1 | **SAFETY_CAP (Max Vel/Acc)** | ✅ ACTIVO | BAJO | `PhysicsPostProcessor.ts` + `AetherSafetyMiddleware.ts` |
| 2 | **REV_LIMIT per-vibe** | ✅ ACTIVO | BAJO | `AetherSafetyMiddleware.ts:VIBE_REV_LIMITS` |
| 3 | **Inercia Cinemática (Classic/Snap)** | ✅ ACTIVO | BAJO | `PhysicsPostProcessor.ts` |
| 4 | **PAN/TILT AIRBAG (margin 5 DMX)** | ✅ ACTIVO | BAJO | `AetherSafetyMiddleware.ts:applyAirbag()` |
| 5 | **Tilt Limits de Calibración** | ✅ ACTIVO | BAJO | `NodeResolver.ts:_applyCalibration()` |
| 6 | **Pan Offset / Tilt Offset** | ✅ ACTIVO | BAJO | `NodeResolver.ts:_applyCalibration()` |
| 7 | **DarkSpin Filter (rueda de color)** | ✅ ACTIVO* | MEDIO | `NodeResolver.ts` + `AetherSafetyMiddleware.ts` |
| 8 | **HarmonicQuantizer (BPM gate)** | ✅ ACTIVO | BAJO | `NodeResolver.ts` ruta hybrid |
| 9 | **Aduana Output Gate** | ✅ ACTIVO | BAJO | `AetherSafetyMiddleware.ts:applyOutputGate()` |
| 10 | **Virtual Fixture Gate** | ✅ ACTIVO | BAJO | `AetherSafetyMiddleware.ts:shouldSendUniverse()` |
| 11 | **Interface Throttle** | ✅ ACTIVO | BAJO | `AetherSafetyMiddleware.ts:shouldSendUniverse()` |
| 12 | **Hard Blackout Egress** | ✅ ACTIVO | BAJO | `TitanOrchestrator.ts:getHardBlackoutUniverseBuffer()` |
| 13 | **FORGE Safety Bypass** | ❌ **CRÍTICO** | **CRÍTICO** | `NodeResolver.ts:_writeNodeForge()` |
| 14 | **HardwareSafetyLayer (debounce latch)** | ❌ **NO INTEGRADO** | **ALTO** | Solo en HAL Legacy |
| 15 | **DarkSpin en ruta wheel-only** | ❌ **AUSENTE** | MEDIO | `NodeResolver.ts` ruta `wheel` |
| 16 | **Pan Limits de Calibración** | ⚠️ **PARCIAL** | BAJO | Solo tilt limits en `_applyCalibration()` |
| 17 | **Strobe Hz Limit** | ❌ **NO INTEGRADO** | MEDIO | Solo en HAL Legacy `FixtureProfile.maxStrobeHz` |
| 18 | **Jitter Filter (motores)** | ✅ ACTIVO | BAJO | `PhysicsPostProcessor.ts:JITTER_THRESHOLD` |

**Veredicto:** El pipeline Aether tiene **~80% de las salvaguardas activas**. Los agujeros críticos son el **FORGE bypass** y la **falta del HardwareSafetyLayer legacy**. Antes de conectar hardware real con Fan Tungsten, se debe cerrar el gap FORGE y considerar un middleware de debounce per-fixture.

---

## 🔬 FORENSE POR VECTOR

---

### 🛡️ VECTOR 1: PROTECCION CINEMATICA MECANICA

**Pregunta:** ¿Se limitan los deltas de Pan/Tilt por frame antes de volcar al universo DMX?

#### 1A — Physics Post-Processor (Inercia entre Arbiter y Resolver)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/PhysicsPostProcessor.ts`  
**Pipeline position:** `NodeArbiter → [PhysicsPostProcessor] → NodeResolver`

```ts
TitanOrchestrator.ts:1895
  this._physicsPostProcessor.process(
    arbitrated,
    this._aetherGraph,
    this._aetherCtx.deltaMs,
  )
```

**Constantes de seguridad:**
- `SAFETY_MAX_VELOCITY_NORM = 5.0` (unidades normalizadas/s)
- `SAFETY_MAX_ACCELERATION_NORM = 20.0` (unidades normalizadas/s²)
- `TELEPORT_THRESHOLD_MS = 200` (salto directo si el frame se congela)
- `JITTER_THRESHOLD = 0.0005` (ignora micro-fluctuaciones < 0.05% del rango)

**Modos:**
- **CLASSIC:** rampa suave con aceleracion/deceleracion trapezoidal. Respeta SAFETY_MAX_VELOCITY_NORM y SAFETY_MAX_ACCELERATION_NORM.
- **SNAP:** convergencia fraccional. Limitado por `maxVel × dt` (REV_LIMIT implicito).

**Cobertura:**
- Ruta clasica (pan/tilt DMX): ✅ — el PhysicsPostProcessor muta los valores en el ArbitratedNodeMap antes de que NodeResolver los vea.
- Ruta espacial 3D (targetX/Y/Z): ✅ — inercia metrica con `SAFETY_MAX_3D_VEL_BASE_MS = 5.0 m/s` escalada por diagonal del escenario.
- Ruta Forge: ❌ — el Forge evaluator bypassa COMPLETAMENTE el PhysicsPostProcessor (ver VECTOR 1D).

#### 1B — Aether Safety Middleware (Velocity Clamp + REV_LIMIT per-vibe)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/egress/AetherSafetyMiddleware.ts`  
**Pipeline position:** Llamado desde `NodeResolver` durante el write DMX.

```ts
AetherSafetyMiddleware.ts:23-37
const KINETIC_SAFETY_CAP_VEL = 400   // DMX units/s max absolute
const KINETIC_DEFAULT_REV_PAN  = 300
const KINETIC_DEFAULT_REV_TILT = 200

const VIBE_REV_LIMITS: Record<string, { pan: number; tilt: number }> = {
  'techno-club':   { pan: 400, tilt: 400 },
  'fiesta-latina': { pan: 380, tilt: 280 },
  'pop-rock':      { pan: 300, tilt: 200 },
  'chill-lounge':  { pan:  12, tilt:   8 },
  'idle':          { pan: 120, tilt:  80 },
}
```

**Metodos activos:**
- `clampKineticVelocity(nodeId, panDMX, tiltDMX)` — clamp por eje con `Math.min(REV_LIMIT, SAFETY_CAP) × dtSec`.
- `clampKineticSingleAxis(nodeId, isPan, dmxValue)` — version uniaxial para ruta clasica.
- Registro automatico: `TitanOrchestrator.ts:486` pre-aloca estado cinetico por nodo.

**Cobertura:**
- Ruta clasica pan/tilt: ✅ — `NodeResolver.ts:589-598` llama `clampKineticSingleAxis` + `applyAirbag`.
- Ruta IK: ✅ — `NodeResolver.ts:685` llama `clampKineticVelocity` + `applyAirbag`.
- Ruta Forge: ⚠️ PARCIAL — solo `applyAirbag`, NO velocity clamp (ver VECTOR 1D).

#### 1C — Airbag (Margen Mecanico 5 DMX)

**Estado:** ✅ ACTIVO  
**Constantes:** `PAN_AIRBAG_MARGIN = 5`, `TILT_AIRBAG_MARGIN = 5`

```ts
AetherSafetyMiddleware.ts:236-241
applyAirbag(dmxValue: number, isPan: boolean): number {
  const margin = isPan ? PAN_AIRBAG_MARGIN : TILT_AIRBAG_MARGIN
  if (dmxValue < margin) { this._airbagHits++; return margin }
  if (dmxValue > 255 - margin) { this._airbagHits++; return 255 - margin }
  return dmxValue
}
```

**Cobertura:**
- Ruta clasica: ✅ (pan + tilt coarse)
- Ruta IK: ✅ (post-clamp)
- Ruta Forge: ✅ (post-evaluacion, lineas 487-499)

#### 1D — GAP CRITICO: FORGE BYPASS SAFETY

**Estado:** ❌ **CRITICO — ABIERTO**  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:472-499`

```ts
NodeResolver.ts:472-499
// === WAVE 4548.6: FORGE EVALUATOR BYPASS ===
const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, this._forgeFrameContext, buf, baseAddr)

  // ★ WAVE 4557: Post-Forge Safety Sweep — airbag + velocity clamp
  // The Forge evaluator bypasses ALL safety logic. Apply critical
  // protections on the buffer AFTER evaluation for kinetic outputs.
  if (this._safetyMiddleware && node.family === NodeFamily.KINETIC) {
    for (let oi = 0; oi < compiled.outputs.length; oi++) {
      const idx = baseAddr + compiled.outputs[oi].dmxOffset
      buf[idx] = this._safetyMiddleware.applyAirbag(buf[idx], oi === 0)
      // ❌ NO hay clampKineticSingleAxis aqui. El Forge puede saltar de 0 a 255 en 1 frame.
    }
  }
  return  // BYPASS: no ejecutar flujo legacy
}
```

**Analisis:**
El ForgeNodeEvaluator escribe directamente en el buffer DMX sin pasar por:
- PhysicsPostProcessor (inercia)
- TransferCurve
- Calibration (panOffset, tiltOffset, tiltLimits)
- Velocity clamp per-frame

Solo se aplica `applyAirbag` post-Forge. **Esto significa que un grafo Forge malicioso puede demandar saltos instantaneos de 0→255 en pan/tilt y el hardware lo recibira en el siguiente frame.**

**Riesgo:** Si un fixture usa `nodeGraph` (Forge), los motores no estan protegidos contra demandas de velocidad infinita.

**Recomendacion:** Inyectar `PhysicsPostProcessor` en la ruta Forge, o al minimo aplicar `clampKineticSingleAxis` post-Forge en los outputs pan/tilt.

---

### 🛡️ VECTOR 2: PROTECCION OPTICA (Wheels & Transit)

#### 2A — DarkSpin en Ruta Hybrid (Color Wheel)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:968-986`

```ts
NodeResolver.ts:968-986
// ★ WAVE 4557: DarkSpin — transit blackout via AetherSafetyMiddleware
if (this._safetyMiddleware && aetherWheel.minTransitionMs > 0) {
  const wheelDmxForDarkSpin = Math.round(wheelDmxNorm * 255)
  const inBlackout = this._safetyMiddleware.checkDarkSpin(
    nodeId, wheelDmxForDarkSpin, aetherWheel.minTransitionMs,
  )
  if (inBlackout) {
    return {
      ...original,
      [CH_COLOR_WHEEL]: wheelDmxNorm,
      [CH_R]: rNorm, [CH_G]: gNorm, [CH_B]: bNorm,
      [DIMMER_CHANNEL]: 0,  // ★ BLACKOUT: hide mechanical crystal transit
    }
  }
}
```

**Implementacion:**
- `AetherSafetyMiddleware.ts:255-291` — `checkDarkSpin()` con `_darkSpinState` Map per-node.
- Fail-safe: si el transito se atasca (> 2× transitDuration), force reset.
- Safety margin: `1.1` (10% extra sobre `minTransitionMs`).

**Orden correcto:** HarmonicQuantizer primero (decide SI cambia) → DarkSpin despues (enmascara el transito). ✅

#### 2B — DarkSpin en Ruta Wheel-Only

**Estado:** ❌ **AUSENTE**  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts`

El `switch (mixingMode)` tiene casos `wheel`, `rgb`, `hybrid`. Solo el caso `hybrid` tiene DarkSpin. Si un fixture tiene solo rueda de color (mixing=`wheel`), **NO hay blackout durante el transito mecanico**.

```ts
// En la ruta 'wheel', el codigo emite colorWheelDmx directamente
// SIN pasar por checkDarkSpin().
```

**Riesgo:** Fixtures con rueda de color pura (sin RGB) mostraran transiciones visibles y parpadeos.

#### 2C — DarkSpin en BeamSystem (Gobo/Prisma)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/systems/BeamSystem.ts`

Los gobos y prismas tienen hold timer (2000ms/1500ms) en `node.darkSpinState`. Esto protege contra cambios rapidos en el flujo de intents L3/L2, pero es **independiente del egreso DMX**.

#### 2D — GAP: DarkSpin en Forge

**Estado:** ❌ **NO APLICADO**  
Si un device usa Forge evaluator, NO hay DarkSpin post-evaluacion. Un grafo Forge que cambie la rueda de color rapidamente no generara blackout de transito.

---

### 🛡️ VECTOR 3: CUANTIZACION Y DEBOUNCE

#### 3A — HarmonicQuantizer (BPM Gate)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:942-966`

```ts
const qResult = getHarmonicQuantizer().quantize(
  nodeId, this._rgbScratch, _currentBpm, _currentBpmConfidence,
  aetherWheel.minTransitionMs,
)
if (!qResult.colorAllowed) {
  // Retener ultimo color permitido
  const qState = getHarmonicQuantizer().getFixtureState(nodeId)
  if (qState?.lastAllowedColor) { ... }
}
```

**Cobertura:** Solo ruta `hybrid`. Si `bpmConfidence < 0.3`, fallback a `colorAllowed: true` (permite el cambio y deja que DarkSpin se encargue).

#### 3B — Jitter Filter (Motores)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/PhysicsPostProcessor.ts:62`

`JITTER_THRESHOLD = 0.0005` (0.05% del rango normalizado). Deltas menores se ignoran, evitando micro-tremores electricos en motores.

#### 3C — HardwareSafetyLayer Legacy (Debounce Latch)

**Estado:** ❌ **NO INTEGRADO EN PIPELINE AETHER**  
**Archivo:** `src/hal/translation/HardwareSafetyLayer.ts`

El HAL legacy (`HardwareAbstraction.ts`, `FixtureMapper.ts`) usa `getHardwareSafetyLayer()` con:
- Debounce per-fixture con latch
- Cooldown timer
- Caos detection (demasiados cambios rapidos)
- Safety margin configurable

**PERO:** El pipeline Aether NO llama a `HardwareSafetyLayer`. Nunca. El AetherSafetyMiddleware tiene DarkSpin pero NO tiene el sistema de latch/cooldown/caos del HardwareSafetyLayer.

**Riesgo:** Si Selene o un efecto manda cambios de color a 60fps, el HarmonicQuantizer bloquea algunos, pero entre quantizer + DarkSpin, no hay una red de seguridad de "latch" que force un cooldown minimo absoluto. DarkSpin solo enmascara con dimmer=0, pero la rueda sigue recibiendo comandos de cambio.

**Recomendacion:** Integrar `HardwareSafetyLayer.filter()` como paso final antes de `sendUniverseRaw`, o replicar el latch en `AetherSafetyMiddleware`.

#### 3D — Interface Throttle

**Estado:** ✅ ACTIVO  
**Archivo:** `AetherSafetyMiddleware.ts:301-314`

`shouldSendUniverse()` throttlea universes con interfaces lentas (`open-dmx` = 33ms / ~30Hz). Evita saturar el bus DMX.

---

### 🛡️ VECTOR 4: ESTADO DEL AIRBAG Y LIMITES

#### 4A — Tilt Limits (Calibracion Legacy)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:1064-1095`

```ts
NodeResolver.ts:1087-1094
if (channelType === TILT_COARSE) {
  if (calibration.tiltLimitMin !== undefined && v < calibration.tiltLimitMin) {
    v = calibration.tiltLimitMin
  }
  if (calibration.tiltLimitMax !== undefined && v > calibration.tiltLimitMax) {
    v = calibration.tiltLimitMax
  }
}
```

**Cobertura:** Ruta clasica (pan/tilt DMX directo). Ruta IK usa `tiltLimits` en `buildProfile()` (l.792-796). Ruta Forge: ❌ no aplica.

#### 4B — Pan Limits (Calibracion Legacy)

**Estado:** ⚠️ **PARCIAL — FALTANTE**  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:1064-1095`

El metodo `_applyCalibration()` aplica `tiltLimitMin`/`tiltLimitMax` pero **NO aplica `panLimitMin`/`panLimitMax`**. Solo existe panOffset (suma) e invertPan.

```ts
NodeResolver.ts:1069-1076
// ── Pan ──────────────────────────────────────────────────────────────
if (PAN_CHANNELS.has(channelType)) {
  let v = dmxValue
  if (calibration.invertPan) v = 255 - v
  if (channelType === PAN_COARSE && calibration.panOffset) {
    v = v + calibration.panOffset
  }
  return v
  // ❌ NO hay clamp de panLimitMin / panLimitMax aqui
}
```

**Riesgo:** Si un fixture tiene limites mecanicos en pan (ej: -270° a +270° con dead zone), la calibracion legacy no los respeta en la ruta clasica. La ruta IK si los respeta via `panRangeDeg` en `buildProfile()`.

#### 4C — Pan Offset / Tilt Offset

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:1073-1084`

```ts
if (channelType === PAN_COARSE && calibration.panOffset) {
  v = v + calibration.panOffset
}
// ...
if (channelType === TILT_COARSE && calibration.tiltOffset) {
  v = v + calibration.tiltOffset
}
```

Aplicados en ruta clasica. Ruta IK integra offsets en `buildProfile()`.

#### 4D — Inversion de Ejes (Pan/Tilt)

**Estado:** ✅ ACTIVO  
**Archivo:** `src/core/aether/resolver/NodeResolver.ts:1072-1083`

```ts
if (calibration.invertPan) v = 255 - v
// ...
if (calibration.invertTilt) v = 255 - v
```

Tambien aplicado en ruta IK via `ikCalibration`/`calibration` fallback. Ruta Forge: ❌ no aplica.

---

## AGUJEROS CRITICOS Y RECOMENDACIONES

### 🔴 P0 — FORGE BYPASS TOTAL (Riesgo: MOTORES ROTOS)

**Problema:** El `ForgeNodeEvaluator` bypassa TODAS las capas de seguridad: inercia, velocity clamp, calibration, DarkSpin, limits.

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:472-499`

**Solucion propuesta:**
```ts
// Post-Forge: aplicar velocity clamp + airbag en outputs kinetic
if (this._safetyMiddleware && node.family === NodeFamily.KINETIC) {
  for (let oi = 0; oi < compiled.outputs.length; oi++) {
    const out = compiled.outputs[oi]
    const idx = baseAddr + out.dmxOffset
    let dmx = buf[idx]
    if (out.channelName === 'pan' || out.channelType === 'pan') {
      dmx = this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, true, dmx)
      dmx = this._safetyMiddleware.applyAirbag(dmx, true)
    } else if (out.channelName === 'tilt' || out.channelType === 'tilt') {
      dmx = this._safetyMiddleware.clampKineticSingleAxis(node.nodeId, false, dmx)
      dmx = this._safetyMiddleware.applyAirbag(dmx, false)
    }
    buf[idx] = dmx
  }
}
```

### 🔴 P1 — HARDWARE SAFETY LAYER FALTANTE (Riesgo: DEGRADO MECANICO)

**Problema:** El pipeline Aether no tiene debounce latch per-fixture. Un bug en Selene o en un grafo Forge puede saturar la rueda de color con comandos a 60fps.

**Archivo:** `src/core/aether/egress/AetherSafetyMiddleware.ts`

**Solucion propuesta:**
Integrar `getHardwareSafetyLayer().filter()` como paso final en `NodeResolver._writeNode()` antes de escribir al buffer, o replicar el sistema de latch/cooldown/caos en `AetherSafetyMiddleware`.

### 🟡 P2 — DARKSPIN EN RUTA WHEEL-ONLY (Riesgo: PARPADEOS)

**Problema:** Fixtures con solo rueda de color (mixing=`wheel`) no tienen DarkSpin.

**Archivo:** `src/core/aether/resolver/NodeResolver.ts`

**Solucion:** Copiar el bloque `checkDarkSpin` del caso `hybrid` al caso `wheel`.

### 🟡 P3 — PAN LIMITS FALTANTES (Riesgo: COLISION MECANICA)

**Problema:** `_applyCalibration()` no aplica `panLimitMin`/`panLimitMax`.

**Archivo:** `src/core/aether/resolver/NodeResolver.ts:1069-1076`

**Solucion:** Anadir clamps simetricos al bloque pan:
```ts
if (channelType === PAN_COARSE) {
  if (calibration.panLimitMin !== undefined && v < calibration.panLimitMin) v = calibration.panLimitMin
  if (calibration.panLimitMax !== undefined && v > calibration.panLimitMax) v = calibration.panLimitMax
}
```

### 🟡 P4 — STROBE HZ LIMIT FALTANTE (Riesgo: LAMPARA HMI DANADA)

**Problema:** No hay limitacion de frecuencia de strobe en pipeline Aether.

**Archivo:** Ninguno en Aether.

**Solucion:** Anadir `maxStrobeHz` a `IImpactNodeData` y clampear `strobeRate` en `NodeResolver` o en `ImpactSystem`.

---

## DIAGRAMA DE PIPELINE CON DEFENSAS

```
NodeArbiter.arbitrate()
       │
       ▼
[PhysicsPostProcessor] ←—— SAFETY_CAP (vel/acc), JITTER, INERCIA
       │                    TELEPORT (200ms), SAFETY_MAX_3D_VEL
       ▼
NodeResolver.resolve()
       │
       ├──► Ruta Classic (pan/tilt DMX)
       │      ├──► _applyCalibration() ←—— tiltLimits, panOffset, tiltOffset, invert
       │      ├──► clampKineticSingleAxis() ←—— REV_LIMIT + SAFETY_CAP per-frame
       │      └──► applyAirbag() ←—— margin 5 DMX
       │
       ├──► Ruta IK (targetX/Y/Z)
       │      ├──► solve() + buildProfile() ←—— tiltLimits, panRangeDeg
       │      ├──► clampKineticVelocity() ←—— REV_LIMIT + SAFETY_CAP per-frame
       │      └──► applyAirbag() ←—— margin 5 DMX
       │
       ├──► Ruta Hybrid (color wheel)
       │      ├──► HarmonicQuantizer ←—— BPM gate musical
       │      ├──► checkDarkSpin() ←—— blackout transitorio
       │      └──► [DIMMER=0 durante transito mecanico]
       │
       ├──► Ruta Wheel-Only ❌ ←—— SIN DarkSpin
       │
       └──► Ruta Forge (nodeGraph)
              ├──► ForgeNodeEvaluator ←—— BYPASS TOTAL DE SEGURIDAD 🔴
              └──► applyAirbag() solo ←—— SIN velocity clamp, SIN calibration
       │
       ▼
AetherSafetyMiddleware
       ├──► applyOutputGate() ←—— outputEnabled=false → no write DMX
       ├──► shouldSendUniverse() ←—— virtual skip + throttle
       └──► consumeTelemetry() ←—— velocityClamps, airbagHits, darkSpinActive
       │
       ▼
TitanOrchestrator
       ├──► getHardBlackoutUniverseBuffer() ←—— blackout global = todo 0
       └──► HAL.sendUniverseRaw()
```

---

*Fin del informe WAVE 4666. Proxima accion recomendada: cerrar el gap FORGE (P0) antes de test con hardware Fan Tungsten.*
