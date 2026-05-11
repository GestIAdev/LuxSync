# AETHER-SAFETY-BLUEPRINT.md

## WAVE 4555 — LA ADUANA AETHER: Safety Enforcement & Egress Pipeline

**Diseño:** 2026-05-05  
**Estado:** BLUEPRINT — Pendiente de implementación  
**Dependencias:** HAL-SAFETY-MAP.md, AETHER-WIRING-MAP.md, KINEMATIC-DUALITY-MAP.md  
**Objetivo:** Diseñar e implementar `AetherSafetyMiddleware` — una capa obligatoria entre `NodeResolver.resolve()` y `HAL.sendUniverseRaw()` que replica y supera todas las protecciones del pipeline Legacy.

---

## 0. EL PROBLEMA

Hoy, el pipeline Aether Nativo entrega el `Uint8Array(512)` directamente al hardware:

```
aetherResolver.resolve(arbitrated)
  ↓
for (universe of registeredUniverses)
  hal.sendUniverseRaw(universe, rawBuf)   ← SIN ADUANA, SIN PHYSICS GATE
```

El pipeline Legacy tiene **7 capas de seguridad** entre el motor y el hardware (FixturePhysicsDriver, DarkSpinFilter, HardwareSafetyLayer, HarmonicQuantizer, Aduana outputEnabled, Virtual Gate, Strobe Hz Cap). **El pipeline Aether solo integra 3** (HarmonicQuantizer, ColorTranslator, bounds clamp). Las 4 restantes representan un **riesgo crítico** para hardware real.

### Protecciones ya integradas en Aether (NO duplicar):

| Protección | Ubicación Aether | Estado |
|---|---|---|
| HarmonicQuantizer (BPM gate) | `NodeResolver._translateColor()` | ✅ OK |
| ColorTranslator (CIE76 match) | `NodeResolver._translateColor()` | ✅ OK |
| PhysicsPostProcessor (inercia) | Post-Arbiter, pre-Resolver | ✅ OK |
| Buffer bounds [0,512] | `NodeResolver._writeNode()` | ✅ OK |
| Value clamp [0,255] | `NodeResolver._writeNode()` | ✅ OK |
| TransferCurve (perceptual) | `NodeResolver._writeNode()` | ✅ OK |
| Calibration (invert, offset, limits) | `NodeResolver._applyCalibration()` | ✅ OK |
| IK tiltLimits | `NodeResolver._getOrBuildIKProfile()` | ✅ OK |
| IK PAN_SAFETY_MARGIN = 5 | `InverseKinematicsEngine.solve()` | ✅ OK |

### Protecciones AUSENTES que este blueprint cubre:

| # | Protección | Prioridad | Riesgo sin ella |
|---|---|---|---|
| S1 | **Kinetic Velocity Limiter** (REV_LIMIT + SAFETY_CAP) | **P0** | Correas rotas, motores quemados |
| S2 | **Pan/Tilt Airbag** (margen DMX en egress) | **P0** | Golpe en topes mecánicos |
| S3 | **DarkSpin Filter** (transit blackout) | **P1** | Público ve cristal intermedio |
| S4 | **HardwareSafetyLayer** (debounce pasivo) | **P1** | Rueda mecánica forzada |
| S5 | **Aduana Output Gate** (outputEnabled + isVirtual) | **P2** | Fixtures sin control del operador |
| S6 | **Strobe Hz Cap** | **P2** | Strobe mecánico a frecuencia destructiva |
| S7 | **Interface Throttling** (refresh rate per driver) | **P2** | Flickering en cables genéricos |

---

## 1. ARQUITECTURA: EL MODELO DE TRES FASES

### 1.1 Principio Fundamental

La Aduana Aether **NO es un middleware entre NodeResolver y HAL**. Es una **extensión del NodeResolver** organizada en tres fases que se ejecutan dentro del flujo existente. Esto preserva el contrato zero-alloc del hot path y evita crear una nueva clase monolítica.

### 1.2 Las Tres Fases

```
TitanOrchestrator.processFrame()
  │
  ├── [FASE 0] PRE-RESOLVE GATE  ─────────────────────────────────────────
  │   Ubicación: TitanOrchestrator, ANTES de aetherResolver.resolve()
  │   Responsabilidad:
  │     • Aduana Output Gate (outputEnabled + isVirtual)
  │     • GrandMaster zerificación (si GM=0 → skip resolve completo)
  │
  ├── [FASE 1] INTRA-RESOLVE SAFETY  ─────────────────────────────────────
  │   Ubicación: DENTRO de NodeResolver._writeNode() / _writeNodeIK()
  │   Responsabilidad:
  │     • Kinetic Velocity Limiter (S1)
  │     • Pan/Tilt Airbag (S2)
  │     • DarkSpin Filter integración (S3)
  │     • HardwareSafetyLayer debounce (S4)
  │     • Strobe Hz Cap (S6)
  │
  └── [FASE 2] POST-RESOLVE EGRESS  ──────────────────────────────────────
      Ubicación: TitanOrchestrator, DESPUÉS de resolve(), ANTES de sendUniverseRaw()
      Responsabilidad:
        • Interface Throttling (S7)
        • NaN/Infinity final sweep del buffer
        • Telemetría de seguridad
```

### 1.3 Diagrama de Pipeline Completo (Post-WAVE 4555)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BLOQUE AETHER — TitanOrchestrator.processFrame()                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. _aetherBus.clear()                                                      │
│  2. Adapters L0/L0+/L3/LP/L3+ → bus/arbiter                               │
│  3. aetherArbiter.arbitrate() → ArbitratedNodeMap                          │
│  4. physicsPostProcessor.process(arbitrated) ← inercia ya integrada        │
│                                                                             │
│  ┌──── FASE 0: PRE-RESOLVE GATE ────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  if (!outputEnabled && !hasManualOverrides)                           │  │
│  │    → aetherAduana.zerifyNonManual(arbitrated, manualNodeIds)         │  │
│  │                                                                       │  │
│  │  if (hasVirtualDevices)                                              │  │
│  │    → aetherAduana.markVirtualSkip(arbitrated, virtualDeviceIds)      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  5. aetherResolver.resolve(arbitrated)                                     │
│     ┌──── FASE 1: INTRA-RESOLVE SAFETY (dentro de _writeNode) ──────────┐ │
│     │                                                                     │ │
│     │  Para cada nodo:                                                   │ │
│     │    [Forge bypass check — si hay grafo compilado, delega]           │ │
│     │                                                                     │ │
│     │    [KINETIC + IK path]                                              │ │
│     │      → _writeNodeIK()                                               │ │
│     │        → IKEngine.solve() → pan/tilt DMX                            │ │
│     │        → ★ S1: kineticVelocityClamp(nodeId, pan, tilt, deltaMs)    │ │
│     │        → ★ S2: panTiltAirbag(pan, tilt, safetyMargin)             │ │
│     │        → write to buf                                               │ │
│     │                                                                     │ │
│     │    [COLOR + wheel/hybrid path]                                      │ │
│     │      → _translateColor()                                            │ │
│     │        → ColorTranslator + HarmonicQuantizer (ya integrados)       │ │
│     │        → ★ S4: hardwareSafetyDebounce(nodeId, wheelDmx)            │ │
│     │        → ★ S3: darkSpinGate(nodeId, wheelDmx, dimmerNorm)          │ │
│     │        → write to buf                                               │ │
│     │                                                                     │ │
│     │    [Canal strobe detectado]                                         │ │
│     │      → ★ S6: strobeHzCap(strobeNorm, maxStrobeHz)                  │ │
│     │                                                                     │ │
│     │    [Classic channel loop]                                           │ │
│     │      → TransferCurve → Calibration → Clamp [0,255]                 │ │
│     │                                                                     │ │
│     └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──── FASE 2: POST-RESOLVE EGRESS ─────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  for (universe of registeredUniverses):                               │  │
│  │    rawBuf = aetherResolver.getUniverseBuffer(universe)                │  │
│  │    ★ S7: if (throttler.shouldSkipFrame(universe)) continue            │  │
│  │    ★ NaN sweep: sanitizeBuffer(rawBuf)                                │  │
│  │    hal.sendUniverseRaw(universe, rawBuf)                              │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PRIORIDAD P0: PROTECCIÓN CINEMÁTICA

### 2.1 S1 — Kinetic Velocity Limiter

**Problema:** El `PhysicsPostProcessor` aplica inercia en espacio normalizado/métrico, pero el valor final DMX 0-255 que sale de `IKEngine.solve()` o del Classic path NO tiene límite de velocidad per-frame. Un cambio de target grande (ej: Selene cambia de sección musical) puede producir un delta DMX de 180° en 1 frame (~23ms), arrancando correas.

**Solución:** Insertar un velocity clamp **post-IK, pre-buffer-write** dentro de `_writeNodeIK()` y en el Classic path para canales `pan`/`tilt`.

#### 2.1.1 Estado Pre-Allocated

```typescript
// En NodeResolver — patch-time allocation
private readonly _lastKineticDMX = new Map<NodeId, Float32Array>()
// Float32Array(4): [lastPan, lastTilt, lastTimestamp, initialized]
// Slot 0: último pan DMX (0-255)
// Slot 1: último tilt DMX (0-255)
// Slot 2: timestamp del último frame (ms, performance.now())
// Slot 3: flag initialized (0 o 1)
```

**Registro en patch-time:** Cuando `registerUniverse()` o el primer `_writeNodeIK()` detecta un nodo KINETIC nuevo, pre-aloca un `Float32Array(4)`.

#### 2.1.2 Constantes de Seguridad

```typescript
// ── Equivalentes al FixturePhysicsDriver Legacy ──
const KINETIC_SAFETY_CAP_VEL  = 400   // DMX units/s — máximo absoluto (Techno)
const KINETIC_SAFETY_CAP_ACC  = 900   // DMX units/s² — máximo absoluto
const KINETIC_DEFAULT_REV_PAN  = 300  // DMX/s — conservador para producción
const KINETIC_DEFAULT_REV_TILT = 200  // DMX/s — tilt siempre más conservador

// Per-vibe REV_LIMIT lookup (futuro: inyectar via setResolveContext)
const VIBE_REV_LIMITS: Record<string, { pan: number, tilt: number }> = {
  techno:  { pan: 400, tilt: 400 },
  latino:  { pan: 380, tilt: 280 },
  rock:    { pan: 300, tilt: 200 },
  chill:   { pan:  12, tilt:   8 },
  idle:    { pan: 120, tilt:  80 },
}
```

#### 2.1.3 Algoritmo — `_clampKineticVelocity()`

```typescript
/**
 * Clamp de velocidad cinemática post-IK.
 * Muta `panDMX` y `tiltDMX` in-place si el delta excede REV_LIMIT.
 *
 * @param nodeId — Para state lookup
 * @param panDMX — Valor pan DMX 0-255 (del IKEngine o Classic path)
 * @param tiltDMX — Valor tilt DMX 0-255
 * @param nowMs — Timestamp del frame (performance.now()-based)
 * @param vibeId — Para REV_LIMIT lookup per-vibe
 * @returns { pan: number, tilt: number } — Valores clampeados
 */
private _clampKineticVelocity(
  nodeId: NodeId,
  panDMX: number,
  tiltDMX: number,
  nowMs: number,
  vibeId: string,
): { pan: number, tilt: number } {

  let state = this._lastKineticDMX.get(nodeId)
  if (!state) {
    state = new Float32Array(4)
    state[0] = panDMX   // lastPan
    state[1] = tiltDMX  // lastTilt
    state[2] = nowMs     // lastTimestamp
    state[3] = 1         // initialized
    this._lastKineticDMX.set(nodeId, state)
    return { pan: panDMX, tilt: tiltDMX }  // primer frame: pass-through
  }

  const lastPan  = state[0]
  const lastTilt = state[1]
  const lastTime = state[2]

  const dtMs = nowMs - lastTime
  if (dtMs <= 0 || dtMs > 200) {
    // TELEPORT: frame jump > 200ms o clock regression → snap directo
    state[0] = panDMX
    state[1] = tiltDMX
    state[2] = nowMs
    return { pan: panDMX, tilt: tiltDMX }
  }

  const dtSec = dtMs * 0.001

  // REV_LIMIT lookup
  const limits = VIBE_REV_LIMITS[vibeId] ??
    { pan: KINETIC_DEFAULT_REV_PAN, tilt: KINETIC_DEFAULT_REV_TILT }

  // SAFETY_CAP clamp (nunca exceder el hardcoded absoluto)
  const maxPanPerFrame  = Math.min(limits.pan,  KINETIC_SAFETY_CAP_VEL) * dtSec
  const maxTiltPerFrame = Math.min(limits.tilt, KINETIC_SAFETY_CAP_VEL) * dtSec

  // Clamp delta
  let deltaPan  = panDMX - lastPan
  let deltaTilt = tiltDMX - lastTilt

  if (Math.abs(deltaPan)  > maxPanPerFrame)
    deltaPan  = Math.sign(deltaPan)  * maxPanPerFrame
  if (Math.abs(deltaTilt) > maxTiltPerFrame)
    deltaTilt = Math.sign(deltaTilt) * maxTiltPerFrame

  const clampedPan  = lastPan  + deltaPan
  const clampedTilt = lastTilt + deltaTilt

  // Actualizar estado
  state[0] = clampedPan
  state[1] = clampedTilt
  state[2] = nowMs

  return {
    pan:  Math.max(0, Math.min(255, Math.round(clampedPan))),
    tilt: Math.max(0, Math.min(255, Math.round(clampedTilt))),
  }
}
```

#### 2.1.4 Punto de Inserción — `_writeNodeIK()`

```typescript
// NodeResolver._writeNodeIK() — DESPUÉS de solve(), ANTES de buf[bufIdx] = dmxValue

const ikResult = solve(profile, { x: tx, y: ty, z: tz }, currentPanDMX)

// ★ WAVE 4555: Kinetic Velocity Limiter
const clamped = this._clampKineticVelocity(
  node.nodeId,
  ikResult.pan,
  ikResult.tilt,
  this._resolveNowMs,    // ← NUEVO: inyectado via setResolveContext()
  this._resolveVibeId,   // ← NUEVO: inyectado via setResolveContext()
)

// Escribir los valores CLAMPEADOS al buffer
for (let ci = 0; ci < node.channels.length; ci++) {
  const chDef = node.channels[ci]
  if (chDef.type === 'pan')  buf[baseAddr + chDef.dmxOffset] = clamped.pan
  if (chDef.type === 'tilt') buf[baseAddr + chDef.dmxOffset] = clamped.tilt
  // ... 16-bit fine bytes
}
```

#### 2.1.5 Punto de Inserción — Classic path (pan/tilt normalizados)

```typescript
// NodeResolver._writeNode() — bucle de canales, DESPUÉS de _applyCalibration()

if (PAN_CHANNELS.has(chDef.type) || TILT_CHANNELS.has(chDef.type)) {
  // ★ WAVE 4555: Velocity clamp para Classic path
  // Simulamos un clamp por eje individual
  const isPan = PAN_CHANNELS.has(chDef.type)
  const clamped = this._clampKineticVelocitySingleAxis(
    node.nodeId, isPan, dmxValue, this._resolveNowMs, this._resolveVibeId,
  )
  dmxValue = clamped
}
```

**Nota:** `_clampKineticVelocitySingleAxis()` es una versión simplificada que solo trackea un eje. Se integra sin romper el contrato del bucle clásico.

#### 2.1.6 Contexto Necesario — Ampliación de `setResolveContext()`

```typescript
// Firma actual:
setResolveContext(bpm: number, bpmConfidence: number): void

// Firma ampliada (WAVE 4555):
setResolveContext(
  bpm: number,
  bpmConfidence: number,
  nowMs?: number,        // ← performance.now() del frame
  vibeId?: string,       // ← vibe activo para REV_LIMIT lookup
  outputEnabled?: boolean, // ← para Fase 0 (Aduana pre-resolve)
): void
```

El orchestrator ya tiene todos estos valores disponibles en el momento de la llamada (línea 1775-1778 de TitanOrchestrator.ts).

### 2.2 S2 — Pan/Tilt Airbag

**Problema:** El `IKEngine.solve()` aplica `PAN_SAFETY_MARGIN = 5` DMX units internamente, pero esto solo protege el path IK. El Classic path y el Forge bypass no tienen margen.

**Solución:** Aplicar airbag como post-procesamiento en `_writeNodeIK()` y en el Classic path. El margen es configurable por nodo (futuro: perfil físico del fixture).

#### 2.2.1 Constantes

```typescript
// Margen de seguridad por defecto (~2% del rango = 5 DMX units)
const PAN_AIRBAG_MARGIN  = 5
const TILT_AIRBAG_MARGIN = 5

// Margen dinámico: si el nodo tiene ikLimits, usar esos.
// Si no, usar el hardcoded.
```

#### 2.2.2 Algoritmo

```typescript
/**
 * Aplica margen de seguridad mecánico a pan/tilt DMX.
 * Idéntico al FixturePhysicsDriver.applySafetyLimits() legacy.
 */
private _applyAirbag(panDMX: number, tiltDMX: number, node: IKineticNodeData): { pan: number, tilt: number } {
  const panMargin  = node.ikLimits?.safetyMarginPan  ?? PAN_AIRBAG_MARGIN
  const tiltMargin = node.ikLimits?.safetyMarginTilt ?? TILT_AIRBAG_MARGIN

  return {
    pan:  Math.max(panMargin, Math.min(255 - panMargin, panDMX)),
    tilt: Math.max(tiltMargin, Math.min(255 - tiltMargin, tiltDMX)),
  }
}
```

#### 2.2.3 Punto de Inserción

En `_writeNodeIK()`, **después** del velocity clamp, **antes** de escribir al buffer:

```typescript
const clamped = this._clampKineticVelocity(...)
const safe    = this._applyAirbag(clamped.pan, clamped.tilt, node)
buf[panIdx]  = safe.pan
buf[tiltIdx] = safe.tilt
```

En el Classic path (dentro del bucle de canales), aplicar solo si el canal es `pan` o `tilt` coarse:

```typescript
if (chDef.type === PAN_COARSE)
  dmxValue = Math.max(PAN_AIRBAG_MARGIN, Math.min(255 - PAN_AIRBAG_MARGIN, dmxValue))
if (chDef.type === TILT_COARSE)
  dmxValue = Math.max(TILT_AIRBAG_MARGIN, Math.min(255 - TILT_AIRBAG_MARGIN, dmxValue))
```

#### 2.2.4 Protección del Forge Bypass

**Problema crítico:** El `ForgeNodeEvaluator` bypassa TODO el flujo de `_writeNode()`, incluyendo estas protecciones. Si un grafo Forge conecta un LFO directamente a `pan`, el airbag no aplica.

**Solución a dos niveles:**

1. **Nivel inmediato (WAVE 4555):** Después del Forge evaluate, recorrer los canales de output del grafo compilado que sean `pan`/`tilt` y aplicar airbag sobre el buffer:

```typescript
// En _writeNode(), DESPUÉS del ForgeNodeEvaluator.evaluate():
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, ctx, buf, baseAddr)

  // ★ WAVE 4555: Post-Forge Airbag
  this._applyForgeKineticSafety(compiled, buf, baseAddr, node)

  this._activeUniverses.add(device.universe)
  return
}
```

```typescript
private _applyForgeKineticSafety(
  compiled: CompiledForgeGraph,
  buf: Uint8Array,
  baseAddr: number,
  node: AnyNodeData,
): void {
  if (node.family !== NodeFamily.KINETIC) return

  for (const output of compiled.outputMap) {
    const idx = baseAddr + output.dmxOffset
    if (idx < 0 || idx >= 512) continue

    if (output.channelName === 'pan') {
      buf[idx] = Math.max(PAN_AIRBAG_MARGIN, Math.min(255 - PAN_AIRBAG_MARGIN, buf[idx]))
    }
    if (output.channelName === 'tilt') {
      buf[idx] = Math.max(TILT_AIRBAG_MARGIN, Math.min(255 - TILT_AIRBAG_MARGIN, buf[idx]))
    }
  }
}
```

2. **Nivel futuro (WAVE 4560+):** Integrar un opcode `safety_clamp` en el evaluador Forge que el compilador inserte automáticamente para outputs pan/tilt. Esto es zero-alloc nativo.

---

## 3. PRIORIDAD P1: REFINAMIENTO ÓPTICO

### 3.1 S3 — Aether DarkSpin Filter

**Problema:** Cuando el `NodeResolver._translateColor()` cambia el valor `color_wheel` para un nodo con `mixingType='wheel'`, la rueda física necesita ~500ms para rotar. Durante ese tiempo, el público ve el cristal intermedio.

**Solución:** Integrar el `DarkSpinFilter` singleton existente (`getDarkSpinFilter()`) directamente en `_translateColor()`, caso `'wheel'`/`'hybrid'`.

#### 3.1.1 Estado Necesario

El `DarkSpinFilter` ya mantiene estado per-fixture via `Map<string, DarkSpinState>`. El key es `fixtureId` (string). En Aether, usamos `deviceId` como equivalente.

**Problema de timestamp:** El `DarkSpinFilter` usa `Date.now()` internamente. Esto viola la Cláusula Woodstock del PhysicsPostProcessor (solo `performance.now()`). Sin embargo, DarkSpin no hace cálculos de física — solo temporizadores de ~500ms. La resolución de `Date.now()` (~1ms) es suficiente para este caso. **No refactorizar DarkSpin por ahora.**

#### 3.1.2 Punto de Inserción — `_translateColor()`, caso `'wheel'`/`'hybrid'`

```typescript
case 'wheel':
case 'hybrid': {
  // ... código existente hasta wheelDmxNorm ...
  // ... HarmonicQuantizer gate ...

  // ★ WAVE 4555: DarkSpin Filter — transit blackout
  // DESPUÉS del HarmonicQuantizer (que decide SI el cambio ocurre),
  // ANTES de retornar el mapa traducido.
  //
  // Si wheelDmxNorm cambió respecto al último valor estable,
  // DarkSpin inyecta dimmer=0 durante transitDurationMs.
  const wheelDmxForDarkSpin = Math.round(wheelDmxNorm * 255)
  const darkSpinResult = getDarkSpinFilter().filter(
    String(nodeId),           // fixtureId key
    wheelDmxForDarkSpin,      // color DMX aprobado por el Quantizer
    this._buildDarkSpinProfile(aetherWheel),  // perfil mínimo
    original['dimmer'] ?? 1,  // dimmer solicitado (normalizado 0-1, pero DarkSpin espera 0-255)
  )

  if (darkSpinResult.inTransit) {
    // BLACKOUT: inyectar dimmer=0 en el mapa retornado
    return {
      ...original,
      [CH_COLOR_WHEEL]: wheelDmxNorm,
      [CH_R]: rNorm, [CH_G]: gNorm, [CH_B]: bNorm,
      dimmer: 0,   // ★ OVERRIDE: blackout durante tránsito mecánico
    }
  }

  // Sin tránsito: retornar normalmente
  return {
    ...original,
    [CH_COLOR_WHEEL]: wheelDmxNorm,
    [CH_R]: rNorm, [CH_G]: gNorm, [CH_B]: bNorm,
  }
}
```

#### 3.1.3 Helper — `_buildDarkSpinProfile()`

El `DarkSpinFilter.filter()` espera un `FixtureProfile` del HAL. Construimos un perfil mínimo desde los datos del nodo Aether:

```typescript
// Cache singleton — evita crear el objeto cada frame
private readonly _darkSpinProfileCache = new Map<number, FixtureProfile>()

private _buildDarkSpinProfile(wheel: ColorWheelDefinition): FixtureProfile {
  const minTime = wheel.minTransitionMs
  let cached = this._darkSpinProfileCache.get(minTime)
  if (cached) return cached

  // Perfil mínimo — solo los campos que DarkSpin lee
  cached = {
    colorEngine: {
      colorWheel: {
        minChangeTimeMs: minTime,
        colors: [],  // DarkSpin no lee colors
        allowsContinuousSpin: false,
      },
      mixing: 'wheel',
    },
  } as unknown as FixtureProfile

  this._darkSpinProfileCache.set(minTime, cached)
  return cached
}
```

**Zero-alloc en steady state:** El perfil se cachea por `minTransitionMs`. Los fixtures con el mismo tiempo de transición comparten el mismo objeto.

#### 3.1.4 Integración con Dimmer del Nodo

**Sutileza:** El `dimmer: 0` inyectado por DarkSpin afecta al canal dimmer del nodo COLOR. Pero el nodo IMPACT del mismo device tiene su propio canal dimmer. ¿Se pisan?

**Respuesta:** No. En Aether, cada nodo es independiente. El nodo COLOR tiene canales `{r, g, b, color_wheel, dimmer, brightness}`. El nodo IMPACT tiene `{dimmer, shutter, strobe}`. DarkSpin inyecta `dimmer=0` en el mapa de canales del nodo **COLOR**, que el NodeResolver escribe en el offset DMX del dimmer de ese nodo. Si el fixture tiene un solo canal dimmer compartido, ambos nodos escriben al mismo offset DMX — y el NodeResolver procesa el ArbitratedNodeMap en orden de nodo, donde el último en escribir gana.

**Mitigación:** Para fixtures con dimmer compartido (un solo canal DMX para intensidad), DarkSpin debe inyectar el blackout a nivel del **buffer DMX** post-resolve, no a nivel del mapa de canales. Esto se delega a la Fase 2 como fallback.

**Decisión de diseño:** Usamos el approach actual (inyección en translatedValues) como primera línea. El fallback post-resolve se implementa solo si se detectan fixtures con dimmer compartido en testing real.

### 3.2 S4 — HardwareSafetyLayer (Debounce Pasivo)

**Problema:** Si el HarmonicQuantizer falla (bpmConfidence bajo, edge case), no hay segunda capa de protección para la rueda mecánica.

**Solución:** Llamar `getHardwareSafetyLayer().filter()` en `_translateColor()` **antes** del DarkSpinFilter, como red de seguridad.

#### 3.2.1 Punto de Inserción

```typescript
case 'wheel':
case 'hybrid': {
  // ... ColorTranslator.translate() → wheelDmxRaw ...
  // ... HarmonicQuantizer gate → wheelDmxNorm (0-1) ...

  // ★ WAVE 4555: HardwareSafetyLayer — debounce pasivo (red de seguridad)
  const hwSafetyResult = getHardwareSafetyLayer().filter(
    String(nodeId),
    Math.round(wheelDmxNorm * 255),
    this._buildDarkSpinProfile(aetherWheel),  // reutiliza el mismo perfil
    255,  // currentDimmer (API compat, no usado en WAVE 2711)
  )
  if (hwSafetyResult.wasBlocked) {
    // Retener el último valor permitido
    wheelDmxNorm = hwSafetyResult.finalColorDmx / 255
  }

  // ★ WAVE 4555: DarkSpin — transit blackout (DESPUÉS del debounce)
  // ... código DarkSpin de §3.1.2 ...
}
```

**Orden de evaluación:**
1. **HarmonicQuantizer** (ya integrado) — gating musical
2. **HardwareSafetyLayer** (nuevo) — debounce temporal como red de seguridad
3. **DarkSpinFilter** (nuevo) — blackout visual durante tránsito

### 3.3 Harmonic Gate — Sincronía con LiquidEngine

**Estado:** Ya integrado en `NodeResolver._translateColor()` (líneas 676-700). El `HarmonicQuantizer` recibe BPM y confidence via `setResolveContext()` y gatea cambios de rueda al tempo musical.

**Acción WAVE 4555:** Ninguna adicional. El Quantizer ya cubre este requisito. Verificar que el `setResolveContext()` sigue siendo llamado correctamente post-ampliación de firma (§2.1.6).

---

## 4. PRIORIDAD P2: LA ADUANA (OUTPUT GATE)

### 4.1 S5 — Master Switch (outputEnabled + isVirtual)

#### 4.1.1 El Problema

El pipeline Legacy tiene la Aduana en `HAL.sendToDriver()` (línea 1806 de HardwareAbstraction.ts):
- Si `!outputEnabled` → canales no-manual se zerifica
- Si `fixture.isVirtual` → fixture no genera DMX

El pipeline Aether **bypassa completamente** esta Aduana porque usa `sendUniverseRaw()` que no pasa por `sendToDriver()`.

#### 4.1.2 Solución — Fase 0 Pre-Resolve

La Aduana Aether se implementa como una función pura que muta el `ArbitratedNodeMap` **antes** de `resolve()`. Esto es más eficiente que post-procesar el buffer DMX porque opera sobre valores normalizados (menor número de operaciones).

```typescript
// Nuevo archivo: src/core/aether/resolver/AetherAduana.ts

/**
 * WAVE 4555: AetherAduana — Output gate para el pipeline Aether.
 *
 * Replica la semántica de la Aduana Legacy (HAL.sendToDriver):
 * - outputEnabled=false → canales no-manual → safe values
 * - isVirtual=true → skip DMX output
 *
 * POSICIÓN: Pre-resolve. Muta ArbitratedNodeMap in-place.
 * Zero-alloc: no crea objetos, solo muta Records existentes.
 */

import type { NodeId, DeviceId } from '../types'
import type { ArbitratedNodeMap } from '../intent-bus'
import type { INodeGraph } from '../node-graph'

// Canales que se zerifica cuando output está deshabilitado
// Los canales de posición se centran (0.5) en vez de a 0
const SAFE_CENTER_CHANNELS = new Set<string>(['pan', 'tilt', 'targetX', 'targetY', 'targetZ'])

export class AetherAduana {

  private _outputEnabled = true
  private readonly _manualNodeIds = new Set<NodeId>()
  private readonly _virtualDeviceIds = new Set<DeviceId>()

  setOutputEnabled(enabled: boolean): void {
    this._outputEnabled = enabled
  }

  setManualNodeIds(nodeIds: ReadonlySet<NodeId>): void {
    this._manualNodeIds.clear()
    for (const id of nodeIds) this._manualNodeIds.add(id)
  }

  registerVirtualDevice(deviceId: DeviceId): void {
    this._virtualDeviceIds.add(deviceId)
  }

  unregisterVirtualDevice(deviceId: DeviceId): void {
    this._virtualDeviceIds.delete(deviceId)
  }

  /**
   * Aplica la Aduana al ArbitratedNodeMap in-place.
   * Llamar ANTES de aetherResolver.resolve().
   *
   * @returns Set de universos a skipear en el egress (virtual devices)
   */
  apply(
    arbitrated: ArbitratedNodeMap,
    nodeGraph: INodeGraph,
  ): ReadonlySet<DeviceId> {

    // Si output está habilitado y no hay virtuales, no-op rápido
    if (this._outputEnabled && this._virtualDeviceIds.size === 0) {
      return this._virtualDeviceIds
    }

    const result = arbitrated as Map<NodeId, Record<string, number>>

    for (const [nodeId, channels] of result) {
      const nodeData = nodeGraph.getNodeData(nodeId)
      if (!nodeData) continue

      // ── Virtual Gate ──
      // Si el device es virtual, no zerificamos el mapa (UI necesita los valores),
      // pero marcamos el device para que el egress skip el sendUniverseRaw.
      // Esto se maneja en la Fase 2 por universo.

      // ── Output Gate ──
      if (!this._outputEnabled) {
        // Los nodos con manual override (L2) pasan sin tocar
        if (this._manualNodeIds.has(nodeId)) continue

        // Todos los demás → safe values
        for (const key of Object.keys(channels)) {
          if (SAFE_CENTER_CHANNELS.has(key)) {
            channels[key] = key === 'targetX' ? 0 : key === 'targetY' ? 1.5 : key === 'targetZ' ? 2.0 : 0.5
          } else {
            channels[key] = 0  // dimmer, strobe, r, g, b, etc → 0
          }
        }
      }
    }

    return this._virtualDeviceIds
  }
}
```

#### 4.1.3 Integración en TitanOrchestrator

```typescript
// En TitanOrchestrator — miembros nuevos:
private readonly _aetherAduana = new AetherAduana()

// En _ensureAetherMatrixInitialized() o registerAetherDevice():
// Si el device es virtual, registrar en la Aduana
if (definition.isVirtual) {
  this._aetherAduana.registerVirtualDevice(definition.deviceId)
}

// En processFrame(), bloque Aether, ANTES de resolve():

// ★ WAVE 4555: Sincronizar estado de output desde Legacy Arbiter
this._aetherAduana.setOutputEnabled(masterArbiter.isOutputEnabled())

// ★ WAVE 4555: Sincronizar nodos con manual override
// Los nodeIds con L2 override son inmunes a la Aduana
const manualNodes = aetherArbiter.getManualOverrideNodeIds()
this._aetherAduana.setManualNodeIds(manualNodes)

// ★ WAVE 4555: Aplicar Aduana pre-resolve
const virtualDevices = this._aetherAduana.apply(arbitrated, this._aetherGraph)

// ... aetherResolver.resolve(arbitrated) ...

// En el egress loop:
for (const universe of aetherResolver.registeredUniverses) {
  const rawBuf = aetherResolver.getUniverseBuffer(universe)
  if (!rawBuf) continue

  // ★ WAVE 4555: Skip universos que SOLO tienen devices virtuales
  // (Si el universo tiene al menos un device real, se envía)
  if (this._isUniverseFullyVirtual(universe, virtualDevices)) continue

  this.hal.sendUniverseRaw(universe, rawBuf)
}
```

#### 4.1.4 API Necesaria en NodeArbiter

```typescript
// Añadir al NodeArbiter:
getManualOverrideNodeIds(): ReadonlySet<NodeId> {
  // Retorna las keys de _manualOverrides como Set (ya son NodeIds)
  // Para zero-alloc: mantener un Set<NodeId> sincronizado con _manualOverrides
  return this._manualOverrideKeys  // ← nuevo miembro pre-allocated
}
```

### 4.2 S7 — Interface Throttling

**Problema:** Chips DMX genéricos ($50-200) solo procesan 20-30Hz. A 44Hz sus buffers se saturan → movimientos erráticos, flickering.

**Solución:** Fase 2 — throttler per-universe en el egress loop.

#### 4.2.1 Diseño

```typescript
// Nuevo: AetherEgressThrottler (inline en TitanOrchestrator o clase separada)

class AetherEgressThrottler {
  // Map<universe, lastSendTimestamp>
  private readonly _lastSend = new Map<number, number>()
  // Map<universe, minIntervalMs>
  private readonly _minInterval = new Map<number, number>()

  /**
   * Configura el intervalo mínimo entre envíos para un universo.
   * @param universe — Universo DMX
   * @param minIntervalMs — Intervalo mínimo (ej: 33ms para 30Hz, 22ms para 44Hz)
   */
  setUniverseThrottle(universe: number, minIntervalMs: number): void {
    this._minInterval.set(universe, minIntervalMs)
  }

  /**
   * ¿Debe este universo skippear este frame?
   * @returns true si no ha pasado suficiente tiempo desde el último envío
   */
  shouldSkip(universe: number, nowMs: number): boolean {
    const minInterval = this._minInterval.get(universe)
    if (!minInterval) return false  // sin throttle → enviar siempre

    const last = this._lastSend.get(universe) ?? 0
    if ((nowMs - last) < minInterval) return true

    this._lastSend.set(universe, nowMs)
    return false
  }
}
```

#### 4.2.2 Configuración por Interface

La configuración del throttle se inyecta en patch-time basándose en el tipo de driver detectado:

```typescript
// En registerAetherDevice() o al conectar el driver:
const driverType = this.hal.getDriverType()  // 'enttec-pro' | 'open-dmx' | 'artnet'

switch (driverType) {
  case 'open-dmx':
    throttler.setUniverseThrottle(definition.universe, 33)  // 30Hz max
    break
  case 'enttec-pro':
    // Enttec Pro gestiona timing interno — sin throttle
    break
  case 'artnet':
    // ArtNet es UDP — sin throttle en el sender (el receptor decide)
    break
}
```

#### 4.2.3 Integración en Egress Loop

```typescript
// Post-resolve, en el loop de envío:
for (const universe of aetherResolver.registeredUniverses) {
  // ★ WAVE 4555: Throttle per-universe
  if (this._egressThrottler.shouldSkip(universe, now)) continue

  const rawBuf = aetherResolver.getUniverseBuffer(universe)
  if (!rawBuf) continue
  if (this._isUniverseFullyVirtual(universe, virtualDevices)) continue

  this.hal.sendUniverseRaw(universe, rawBuf)
}
```

### 4.3 S6 — Strobe Hz Cap

**Problema:** Un nodo IMPACT con canal `strobe` puede recibir un valor normalizado alto que, traducido a frecuencia DMX, excede la capacidad mecánica del fixture (ej: Beam 2R max 12Hz).

**Solución:** En `_writeNode()`, canal tipo `strobe`, aplicar un cap basado en `node.constraints.maxStrobeHz` (si disponible en `IDeviceDefinition`).

#### 4.3.1 Punto de Inserción

```typescript
// En el bucle de canales de _writeNode():
if (chDef.type === 'strobe' || chDef.type === 'shutter') {
  // ★ WAVE 4555: Strobe Hz Cap
  const maxHz = (node as any).maxStrobeHz
  if (maxHz && maxHz > 0) {
    // El valor DMX de strobe es proporcional a la frecuencia.
    // Convention: DMX 255 = maxHz del fixture.
    // Si el constraint dice maxHz=12 pero el nodo recibe DMX para 20Hz,
    // clampear al valor DMX que corresponde a 12Hz.
    // En la práctica, el constraint.maxValue ya debería limitar esto,
    // pero este es un safety cap explícito.
    const maxStrobeDmx = Math.round((maxHz / 25) * 255)  // 25Hz = frecuencia referencia
    if (dmxValue > maxStrobeDmx) dmxValue = maxStrobeDmx
  }
}
```

**Nota:** Si `maxStrobeHz` no está disponible en el modelo de datos actual (`ICapabilityNode`), se añade como campo optional en `IImpactNodeData` durante la implementación:

```typescript
// En capability-node.ts:
export interface IImpactNodeData extends ICapabilityNode {
  // ... campos existentes ...
  readonly maxStrobeHz?: number  // ★ WAVE 4555: Cap de frecuencia strobe mecánico
}
```

---

## 5. PROTECCIÓN DEL FORGE BYPASS

### 5.1 El Riesgo

El `ForgeNodeEvaluator` bypassa **TODO** el flujo de `_writeNode()`. Esto significa que S1 (velocity clamp), S2 (airbag), S3 (DarkSpin), S4 (debounce), y S6 (strobe cap) **no aplican** a fixtures con grafo Forge compilado.

### 5.2 Estrategia de Mitigación (Dos Niveles)

**Nivel 1 — Post-Forge Safety Sweep (WAVE 4555, inmediato):**

Después de `ForgeNodeEvaluator.evaluate()`, ejecutar un sweep de seguridad sobre los offsets DMX del device:

```typescript
// En _writeNode(), después del Forge evaluate:
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, ctx, buf, baseAddr)

  // ★ WAVE 4555: Post-Forge Safety Sweep
  this._postForgeSafetySweep(node, compiled, buf, baseAddr)

  this._activeUniverses.add(device.universe)
  return
}
```

```typescript
private _postForgeSafetySweep(
  node: AnyNodeData,
  compiled: CompiledForgeGraph,
  buf: Uint8Array,
  baseAddr: number,
): void {
  // S2: Pan/Tilt Airbag
  if (node.family === NodeFamily.KINETIC) {
    for (const output of compiled.outputMap) {
      const idx = baseAddr + output.dmxOffset
      if (idx < 0 || idx >= 512) continue

      if (output.channelName === 'pan') {
        buf[idx] = Math.max(PAN_AIRBAG_MARGIN, Math.min(255 - PAN_AIRBAG_MARGIN, buf[idx]))
      }
      if (output.channelName === 'tilt') {
        buf[idx] = Math.max(TILT_AIRBAG_MARGIN, Math.min(255 - TILT_AIRBAG_MARGIN, buf[idx]))
      }
    }
  }

  // S1: Velocity clamp (requiere tracking post-Forge)
  if (node.family === NodeFamily.KINETIC) {
    for (const output of compiled.outputMap) {
      const idx = baseAddr + output.dmxOffset
      if (idx < 0 || idx >= 512) continue

      if (output.channelName === 'pan' || output.channelName === 'tilt') {
        // Reutilizar _clampKineticVelocitySingleAxis con el valor DMX actual del buffer
        const isPan = output.channelName === 'pan'
        buf[idx] = this._clampKineticVelocitySingleAxis(
          node.nodeId, isPan, buf[idx], this._resolveNowMs, this._resolveVibeId,
        )
      }
    }
  }

  // Safety: NaN/Infinity sweep sobre los offsets del device
  for (const output of compiled.outputMap) {
    const idx = baseAddr + output.dmxOffset
    if (idx < 0 || idx >= 512) continue
    const v = buf[idx]
    if (v !== v || v < 0 || v > 255) buf[idx] = 0  // NaN check: NaN !== NaN
  }
}
```

**Nivel 2 — Compiler-Injected Safety Opcodes (Futuro, WAVE 4560+):**

El `ForgeGraphCompiler` inserta automáticamente nodos de seguridad en el programa compilado:
- `clamp` opcode después de outputs `pan`/`tilt` con `min=margin, max=255-margin`
- `velocity_limit` opcode (nuevo) con `maxDelta=REV_LIMIT * dt`
- `darkspin_gate` opcode (nuevo) para outputs `color_wheel` + `dimmer`

Esto mueve la seguridad **dentro** del evaluador, eliminando el overhead del sweep post-Forge.

---

## 6. FASE 2: POST-RESOLVE EGRESS

### 6.1 NaN/Infinity Buffer Sanitizer

```typescript
// En el egress loop, DESPUÉS de resolve(), ANTES de sendUniverseRaw():

private _sanitizeBuffer(buf: Uint8Array): void {
  // Fast path: TypedArray no puede contener NaN en la representación de bytes.
  // Uint8Array.fill() siempre produce 0-255 integers.
  // Sin embargo, un bug en el Forge evaluator o un race condition
  // podría escribir un valor fuera de rango vía Float64 → Uint8 truncation.
  //
  // El V8 engine trunca automáticamente Float→Uint8 (modulo 256),
  // así que NaN se convierte en 0 y Infinity se convierte en 0.
  // Este sanitizer es un no-op en la práctica pero documenta la intención.
  //
  // Si se detecta un valor > 255 o NaN en testing, activar el sweep:
  // for (let i = 0; i < buf.length; i++) {
  //   const v = buf[i]
  //   if (v > 255) buf[i] = 255
  //   // NaN no es posible en Uint8Array
  // }
}
```

**Decisión:** El sanitizer se deja como **stub documentado**. `Uint8Array` no puede contener NaN ni valores fuera de 0-255 por especificación de TypedArrays. El riesgo real está en el espacio Float64 del wireBuffer del Forge, que ya tiene `clamp(0, 255)` en el opcode `output_dmx` (opcode 23, línea 408 de `ForgeNodeEvaluator.ts`).

### 6.2 Telemetría de Seguridad

```typescript
// Throttled a ~1Hz (cada 44 frames):
if (this.frameCount % 44 === 0 && this._aetherHasDevices) {
  const darkSpinMetrics = getDarkSpinFilter().getMetrics()
  const hwSafetyMetrics = getHardwareSafetyLayer().getMetrics()
  const velocityClamps  = this._aetherResolver?.getVelocityClampCount() ?? 0

  if (darkSpinMetrics.fixturesInTransit > 0 || hwSafetyMetrics.totalBlockedChanges > 0 || velocityClamps > 0) {
    console.log(
      `[AetherAduana 🛂] DarkSpin: ${darkSpinMetrics.fixturesInTransit} in-transit | ` +
      `HWSafety: ${hwSafetyMetrics.totalBlockedChanges} blocked | ` +
      `VelClamp: ${velocityClamps} this second`
    )
  }
}
```

---

## 7. CHECKLIST DE IMPLEMENTACIÓN

### Archivos a CREAR:

| # | Archivo | Propósito |
|---|---|---|
| 1 | `src/core/aether/resolver/AetherAduana.ts` | Clase Aduana — output gate + virtual filter |

### Archivos a MODIFICAR:

| # | Archivo | Cambios |
|---|---|---|
| 2 | `NodeResolver.ts` | + `_lastKineticDMX` Map, + `_clampKineticVelocity()`, + `_applyAirbag()`, + `_postForgeSafetySweep()`, + `_buildDarkSpinProfile()`, + `_resolveNowMs/_resolveVibeId` state, + ampliar `setResolveContext()`, + integrar DarkSpin en `_translateColor()`, + integrar HWSafetyLayer en `_translateColor()`, + strobe Hz cap en bucle de canales |
| 3 | `TitanOrchestrator.ts` | + `_aetherAduana` instancia, + `_egressThrottler` instancia, + sincronizar outputEnabled/manualNodeIds antes de resolve, + virtual skip en egress, + throttle en egress, + telemetría |
| 4 | `NodeArbiter.ts` | + `getManualOverrideNodeIds()` API, + `_manualOverrideKeys` Set sincronizado |
| 5 | `capability-node.ts` | + `maxStrobeHz?: number` en `IImpactNodeData` |
| 6 | `resolver/index.ts` | + export `AetherAduana` |

### Archivos que NO se tocan:

- `DarkSpinFilter.ts` — Se reutiliza como singleton, sin modificaciones
- `HardwareSafetyLayer.ts` — Se reutiliza como singleton, sin modificaciones
- `HarmonicQuantizer.ts` — Ya integrado, sin cambios
- `ColorTranslator.ts` — Ya integrado, sin cambios
- `PhysicsPostProcessor.ts` — Ya funcional, no duplicar inercia
- `InverseKinematicsEngine.ts` — Ya tiene PAN_SAFETY_MARGIN, no duplicar
- `ForgeNodeEvaluator.ts` — Post-Forge sweep se hace FUERA del evaluador
- `HardwareAbstraction.ts` — `sendUniverseRaw()` permanece zero-copy

---

## 8. ORDEN DE EJECUCIÓN (IMPLEMENTATION ROADMAP)

```
FASE A — P0 Mecánica (Antes de conectar hardware)
  ├── A1: Ampliar setResolveContext() con nowMs, vibeId, outputEnabled
  ├── A2: Implementar _lastKineticDMX + _clampKineticVelocity() en NodeResolver
  ├── A3: Integrar velocity clamp en _writeNodeIK() y Classic path
  ├── A4: Implementar _applyAirbag() en NodeResolver
  ├── A5: Integrar airbag en _writeNodeIK() y Classic path
  ├── A6: Implementar _postForgeSafetySweep() para Forge bypass
  └── A7: Test: verificar que un delta de 180° se clampea a REV_LIMIT

FASE B — P1 Óptica (Antes de test con ruedas mecánicas)
  ├── B1: Integrar HardwareSafetyLayer.filter() en _translateColor()
  ├── B2: Implementar _buildDarkSpinProfile() + cache
  ├── B3: Integrar DarkSpinFilter.filter() en _translateColor()
  └── B4: Test: verificar blackout durante cambio de rueda

FASE C — P2 Aduana (Antes de LIVE con público)
  ├── C1: Crear AetherAduana.ts
  ├── C2: Añadir getManualOverrideNodeIds() a NodeArbiter
  ├── C3: Integrar AetherAduana en TitanOrchestrator pre-resolve
  ├── C4: Implementar AetherEgressThrottler
  ├── C5: Integrar throttle + virtual skip en egress loop
  ├── C6: Añadir maxStrobeHz a IImpactNodeData + strobe cap
  └── C7: Añadir telemetría de seguridad
```

---

## 9. ZERO-ALLOC COMPLIANCE

| Componente | Allocations en hot path | Justificación |
|---|---|---|
| `_clampKineticVelocity()` | 0 (Float32Array pre-allocated) | State per-node en patch-time |
| `_applyAirbag()` | 0 (inline math) | Solo Math.max/min |
| `_postForgeSafetySweep()` | 0 (iteración de array existente) | `compiled.outputMap` es readonly |
| `_buildDarkSpinProfile()` | 0 (cache hit en steady state) | Cache por minTransitionMs |
| DarkSpin `dimmer: 0` override | 1 object literal (spread) | Solo en frames con cambio de rueda (~1/500ms). Aceptable. |
| `AetherAduana.apply()` | 0 (muta in-place) | Solo Object.keys() — stack-allocated en V8 |
| `AetherEgressThrottler` | 0 (Map reads/writes) | Pre-allocated Maps |

**Único punto de alloc residual:** El spread `{ ...original, dimmer: 0 }` en DarkSpin. Se ejecuta ~1 vez cada 500ms-2s (solo en frames con cambio de rueda). El impacto GC es negligible. Si se quiere eliminar, se puede mutar `original` directamente (es mutable en runtime aunque el tipo diga Readonly<>), pero esto viola el contrato semántico.

---

## 10. TABLA DE EQUIVALENCIA LEGACY ↔ AETHER

| Protección Legacy | Archivo Legacy | Equivalente Aether (WAVE 4555) | Ubicación |
|---|---|---|---|
| `SAFETY_CAP (900/400)` | `FixturePhysicsDriver.ts:199` | `_clampKineticVelocity()` con `KINETIC_SAFETY_CAP_VEL=400` | `NodeResolver._writeNodeIK()` |
| `REV_LIMIT per-vibe` | `FixturePhysicsDriver.ts:720` | `VIBE_REV_LIMITS` lookup en `_clampKineticVelocity()` | `NodeResolver._writeNodeIK()` |
| `PAN_SAFETY_MARGIN = 5` | `FixturePhysicsDriver.ts:212` | `_applyAirbag()` con `PAN_AIRBAG_MARGIN=5` | `NodeResolver._writeNodeIK()` |
| `DarkSpinFilter` | `DarkSpinFilter.ts:94` | `getDarkSpinFilter().filter()` en `_translateColor()` | `NodeResolver._translateColor()` |
| `HardwareSafetyLayer` | `HardwareSafetyLayer.ts:113` | `getHardwareSafetyLayer().filter()` en `_translateColor()` | `NodeResolver._translateColor()` |
| `HarmonicQuantizer` | `HarmonicQuantizer.ts:97` | Ya integrado (WAVE 4522.4) | `NodeResolver._translateColor()` |
| `outputEnabled gate` | `HAL.sendToDriver():1806` | `AetherAduana.apply()` pre-resolve | `TitanOrchestrator` |
| `isVirtual filter` | `HAL.sendToDriver()` | `AetherAduana.registerVirtualDevice()` + egress skip | `TitanOrchestrator` |
| `Paranoia Protocol 30Hz` | `UniversalDMXDriver.ts:136` | `AetherEgressThrottler.shouldSkip()` | `TitanOrchestrator` |
| `maxStrobeHz` | `FixtureProfiles.ts:176` | Strobe Hz cap en bucle de canales | `NodeResolver._writeNode()` |

---

## 11. DIAGRAMA DE FLUJO POST-WAVE 4555

```
VMM.generateIntent()
  ↓
KineticAdapter.process() → IntentBus {targetX, targetY, targetZ}
  ↓
NodeArbiter.arbitrate() → ArbitratedNodeMap
  ↓
PhysicsPostProcessor.process() → inercia 3D/1D (muta in-place)
  ↓
★ AetherAduana.apply() → output gate + virtual mark (muta in-place)
  ↓
NodeResolver.resolve(arbitrated)
  │
  ├── [Forge bypass] → ForgeNodeEvaluator.evaluate()
  │                     → ★ _postForgeSafetySweep() (airbag + velocity + NaN)
  │
  ├── [IK path] → IKEngine.solve() → pan/tilt DMX
  │               → ★ _clampKineticVelocity() (REV_LIMIT + SAFETY_CAP)
  │               → ★ _applyAirbag() (margin 5 DMX)
  │               → write to buf
  │
  ├── [COLOR wheel] → ColorTranslator + HarmonicQuantizer
  │                   → ★ HardwareSafetyLayer (debounce)
  │                   → ★ DarkSpinFilter (transit blackout → dimmer=0)
  │                   → write to buf
  │
  └── [Classic path] → TransferCurve → Calibration
                       → ★ Pan/Tilt airbag margin
                       → ★ Strobe Hz cap
                       → Clamp [0,255] → write to buf
  ↓
★ AetherEgressThrottler.shouldSkip(universe)
  ↓ (si no skip)
★ Virtual universe skip
  ↓ (si no virtual)
hal.sendUniverseRaw(universe, rawBuf)
  ↓
DMX Driver → Hardware
```

---

## 12. CRITERIO DE ACEPTACIÓN: "TOUR READY"

| # | Criterio | Test |
|---|---|---|
| 1 | Un moving head en Chill no puede mover más de 12 DMX/s | Medir delta pan entre frames consecutivos |
| 2 | Un moving head en Techno no puede mover más de 400 DMX/s | Medir delta pan en burst |
| 3 | Pan nunca baja de 5 ni sube de 250 en IK path | Assert en buffer post-resolve |
| 4 | Pan nunca baja de 5 ni sube de 250 en Forge path | Assert en buffer post-Forge sweep |
| 5 | Cambio de rueda produce dimmer=0 durante ≥ minTransitionMs | Log DarkSpin + medir buffer |
| 6 | outputEnabled=false → todos los canales no-manual = safe value | Assert en ArbitratedNodeMap post-Aduana |
| 7 | isVirtual=true → sendUniverseRaw NUNCA se llama para ese universo | Mock HAL + assert |
| 8 | OpenDMX cable → refresh rate ≤ 30Hz | Contar llamadas a sendUniverseRaw por segundo |
| 9 | Cambio de rueda bloqueado si timeSinceLastChange < minChangeTimeMs × 1.2 | HWSafetyLayer log |
| 10 | Frame jump > 200ms → TELEPORT (velocity=0, no clamp) | Simular dt=500ms, verificar snap |

---

*Fin del Blueprint — WAVE 4555: LA ADUANA AETHER*
*LuxSync Tour Ready. Zero Ghosts. Zero Broken Belts.*
