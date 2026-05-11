# HAL-SAFETY-MAP.md

## Auditoría de Salvaguardas de Hardware — WAVE 4554

**Scope:** Mapeo completo de capas de seguridad mecánica, óptica, eléctrica y de interfaz. Determinar qué defiende al hardware físico y qué bypassa el pipeline Aether.  
**Auditoría realizada:** 2026-05-05  
**Objetivo:** Planificar la integración obligatoria de salvaguardas en el Egress de Aether antes del test con Fan Tungsten.

---

## 1. RESUMEN EJECUTIVO

El sistema Legacy HAL tiene **7 capas de seguridad activas** que protegen hardware físico (motores paso a paso, ruedas de color mecánicas, interfaces USB genéricas). El pipeline Aether Nativo **integra parcialmente 3 de ellas** y **bypassa completamente 4**. Esto representa un **riesgo crítico** antes de conectar hardware real.

| Capa de Seguridad | Legacy HAL | Aether Nativo | Riesgo |
|---|---|---|---|
| **1. SAFETY_CAP (Max Accel/Vel)** | ✅ `FixturePhysicsDriver` (900/400) | ❌ No aplica | **ALTO** |
| **2. REV_LIMIT per-vibe** | ✅ `FixturePhysicsDriver` (pan/tilt/s) | ❌ No aplica | **ALTO** |
| **3. PAN AIRBAG (margin 5)** | ✅ `applySafetyLimits` | ⚠️ IK tiltLimits only | **MEDIO** |
| **4. Dark-Spin (transit blackout)** | ✅ `DarkSpinFilter` | ❌ No integrado | **CRÍTICO** |
| **5. Harmonic Quantizer** | ✅ `HarmonicQuantizer` | ✅ `NodeResolver` (BPM gate) | ✅ OK |
| **6. Hardware Safety Layer** | ✅ `HardwareSafetyLayer` (debounce) | ❌ No integrado | **MEDIO** |
| **7. ColorTranslator (CIE76)** | ✅ `ColorTranslator` | ✅ `NodeResolver` (wheel match) | ✅ OK |
| **8. Aduana Output Gate** | ✅ `masterArbiter.isOutputEnabled()` | ❌ No integrado | **CRÍTICO** |
| **9. Strobe Hz Limit** | ✅ `FixtureProfile.maxStrobeHz` | ❌ No integrado | **MEDIO** |
| **10. Virtual Fixture Gate** | ✅ `states.filter(!isVirtual)` | ❌ No integrado | **MEDIO** |

**Hallazgo #1 (CRÍTICO):** El `DarkSpinFilter` (blackout de dimmer durante tránsito de rueda mecánica) **NO está integrado en Aether**. Si un fixture Beam 2R en pipeline Aether recibe un cambio de color, el público verá el cristal intermedio durante ~500ms.

**Hallazgo #2 (ALTO):** `FixturePhysicsDriver.SAFETY_CAP` (maxAcceleration=900, maxVelocity=400) **NO aplica en Aether**. El `NodeResolver` traduce IK directamente a DMX sin pasar por el motor de física. Un cálculo espacial podría exigir un giro de 180° en 1 frame.

**Hallazgo #3 (CRÍTICO):** La **Aduana** (`outputEnabled=false` → ceros en no-manual) **no existe en Aether**. Fixtures Aether seguirán enviando DMX aunque el operador esté en modo ARMED.

---

## 2. EJE 1: SALVAGUARDAS MECÁNICAS (VMM-IK & TRANSLATION)

### 2.1 FixturePhysicsDriver — El Motor Dorado

```
Archivo: src/engine/movement/FixturePhysicsDriver.ts
Líneas críticas: 199-202, 212, 367, 567-575, 704-788, 822-846
```

#### 2.1.1 Jerarquía de 3 Niveles de Límite

```
EffectiveLimit = Math.min(
  SAFETY_CAP (hardcoded),        // Nivel 1: Nunca se viola
  VibeRequest (preset),           // Nivel 2: Lo que pide el género musical
  HardwareLimit (fixtureProfile)  // Nivel 3: Lo que aguanta el motor real
)
```

**Valores hardcoded (SAFETY_CAP):**
```typescript
// src/engine/movement/FixturePhysicsDriver.ts:199-202
private readonly SAFETY_CAP = {
  maxAcceleration: 900,   // DMX units/s² — NUNCA exceder
  maxVelocity: 400,       // DMX units/s — NUNCA exceder
}
```

**PAN AIRBAG (margen de seguridad mecánica):**
```typescript
// src/engine/movement/FixturePhysicsDriver.ts:212
private readonly PAN_SAFETY_MARGIN = 5  // ~2% del rango — frena antes del tope físico

// Aplicación (línea 573):
pan: Math.max(this.PAN_SAFETY_MARGIN, Math.min(255 - this.PAN_SAFETY_MARGIN, targetDMX.pan))
tilt: Math.max(limits.tiltMin, Math.min(limits.tiltMax, targetDMX.tilt))
```

#### 2.1.2 REV_LIMITER per-Vibe (Seguro de Vida para Correas)

Cada vibe musical declara límites de velocidad explícitos:

| Vibe | `revLimitPanPerSec` | `revLimitTiltPerSec` | `physicsMode` |
|---|---|---|---|
| Techno | 400 DMX/s (~848°/s) | 400 DMX/s | snap |
| Latino | 380 DMX/s (~805°/s) | 280 DMX/s (~594°/s) | snap |
| Rock | 300 DMX/s (~636°/s) | 200 DMX/s (~424°/s) | classic |
| Chill | 12 DMX/s (~25°/s) | 8 DMX/s (~17°/s) | classic |
| Idle | 120 DMX/s (~254°/s) | 80 DMX/s (~170°/s) | classic |

**Aplicación en código (líneas 720-737):**
```typescript
const REV_LIMIT_PAN_PER_SEC = this.currentRevLimitPanPerSec
const REV_LIMIT_TILT_PER_SEC = this.currentRevLimitTiltPerSec

// Aplicar speedFactor del fixture (hardware lento reduce su límite)
const cappedRevPan  = Math.min(REV_LIMIT_PAN_PER_SEC, effectiveLimits.maxVelocity)
const cappedRevTilt = Math.min(REV_LIMIT_TILT_PER_SEC, effectiveLimits.maxVelocity)
const limitPanPerSec  = cappedRevPan * speedFactorPan
const limitTiltPerSec = cappedRevTilt * speedFactorTilt

// Convertir a límite por frame usando dt real
const maxPanThisFrame  = limitPanPerSec * dt
const maxTiltThisFrame = limitTiltPerSec * dt

// Clamp delta
const clampedDeltaPan  = Math.max(-maxPanThisFrame,  Math.min(maxPanThisFrame,  deltaPan))
const clampedDeltaTilt = Math.max(-maxTiltThisFrame, Math.min(maxTiltThisFrame, deltaTilt))
```

**Ejemplo:** Un mover chino (`speedFactor=0.5`) en Techno no puede exceder 200 DMX/s aunque el vibe pida 400.

#### 2.1.3 Modo SNAP vs CLASSIC

- **SNAP**: El fixture persigue el target directamente, limitado solo por REV_LIMIT por frame. Usado en Techno/Latino para respuesta inmediata.
- **CLASSIC**: Física con aceleración, velocidad, fricción y distancia de frenado. Usado en Chill/Idle/Rock.

**Protección anti-singularidad (línea 825):**
```typescript
const safeDistance = Math.max(0.5, absDistance)  // Nunca dividir por cero
acceleration = -(vel * vel) / (2 * safeDistance) * direction
```

**NaN Guard (líneas 476-480, 779-783):**
```typescript
const safeVelPan = dt > 0.1 ? deltaPan / dt : 0
newVel.pan = Number.isFinite(safeVelPan) ? safeVelPan : 0
if (!Number.isFinite(safeVelPan) || !Number.isFinite(safeVelTilt)) {
  console.warn(`[PhysicsDriver] Velocity explosion detected! ...`)
}
```

#### 2.1.4 Manual Override Fast-Track (WAVE 2785)

Cuando el operador controla posición manualmente, el vibe Chill con `maxVelocity=8` no bloquea la respuesta:
```typescript
// Línea 386: MANUAL_REV_LIMIT = 400 DMX/s (igual que Techno)
const maxThisFrame = MANUAL_REV_LIMIT * dt
deltaPan  = Math.max(-maxThisFrame, Math.min(maxThisFrame, deltaPan))
```

#### 2.1.5 Teleport Mode (Anti-Math-Explosion)

Si `deltaTime > 200ms` (salto de timeline, lag), se salta física completamente:
```typescript
// Línea 434-447
if (deltaTime > 200) {
  smoothedDMX = targetDMX
  this.currentPositions.set(fixtureId, targetDMX)
  this.velocities.set(fixtureId, { pan: 0, tilt: 0 })
  // Log: "TELEPORT | dt=120000ms → instant jump (skip physics)"
}
```

### 2.2 NodeResolver — IK & Límites en Aether

```
Archivo: src/core/aether/resolver/NodeResolver.ts
Líneas críticas: 516-550 (IK profile), 396 (bufIdx bound check), 407-423 (clamp)
```

**Lo que Aether SÍ hace:**

1. **Bounds check de buffer**: `if (bufIdx < 0 || bufIdx >= DMX_UNIVERSE_SIZE) continue` (línea 396)
2. **Clamp a constraint max**: `if (normalized > maxNorm) normalized = maxNorm` (línea 407-410)
3. **Clamp final [0,255]**: `if (dmxValue < 0) dmxValue = 0; if (dmxValue > 255) dmxValue = 255` (líneas 421-423)
4. **IK tiltLimits**: Extrae `lim?.tiltLimits` o fallback a `calibration.tiltLimitMin/Max` (líneas 526-530)
5. **IK panRangeDeg / tiltRangeDeg**: Pasados a `buildProfile()` (líneas 543-544)

**Lo que Aether NO hace:**

1. **NO aplica FixturePhysicsDriver**: No hay `translate()` ni `applyPhysicsEasing()`. Los valores IK van directo a DMX.
2. **NO aplica SAFETY_CAP (900/400)**: Un delta de 180° en 1 frame escribe directo al buffer.
3. **NO aplica REV_LIMITER per-vibe**: No hay concepto de "vibe" en el NodeResolver.
4. **NO aplica PAN AIRBAG (margin 5)**: Los límites IK son configurables pero no hardcoded.
5. **NO aplica NaN Guard del PhysicsDriver**: Aunque el `ForgeNodeEvaluator` tiene clamp en opcodes.
6. **NO aplica Teleport Mode**: Si el frame loop laggea, el evaluador Forge sigue operando con `dt` real.

**Riesgo concreto:** Si `ForgeNodeEvaluator` tiene un nodo `math_sin` con frecuencia alta conectado a `pan`, y no hay nodo `clamp` en el grafo, el valor puede oscilar -1..+1 y el NodeResolver lo escalará a 0-255 sin protección de aceleración. Un motor paso a paso real podría intentar seguir una onda senoidal de 10Hz, destruyendo correas.

---

## 3. EJE 2: SALVAGUARDAS ÓPTICAS Y SINCRONÍA MUSICAL

### 3.1 DarkSpinFilter — La Ley Física del Blackout

```
Archivo: src/hal/translation/DarkSpinFilter.ts
Líneas críticas: 71-220
```

**Problema que resuelve:** Durante el tránsito de una rueda de colores física (~500ms), el cristal intermedio entre dos slots es visible. Bajo ninguna circunstancia el público debe verlo.

**Algoritmo:**
```typescript
filter(fixtureId, currentColorDmx, profile, requestedDimmer) {
  // CHECK 1: ¿Estamos en tránsito activo?
  if (state.inTransit) {
    const elapsed = now - state.transitStartTime
    const remaining = state.transitDurationMs - elapsed

    // FAIL-SAFE (WAVE 2691): Si tránsito > 2×duración, forzar reset
    if (elapsed >= state.transitDurationMs * 2) {
      state.inTransit = false  // Forzar liberación
    } else if (remaining > 0) {
      return { dimmer: 0, inTransit: true }  // BLACKOUT
    }
  }

  // CHECK 2: ¿Nuevo cambio de color detectado?
  if (currentColorDmx !== state.lastStableColorDmx) {
    const transitDuration = Math.round(minChangeTimeMs * safetyMargin)  // 500ms × 1.1 = 550ms
    state.inTransit = true
    state.transitStartTime = now
    return { dimmer: 0, inTransit: true }  // BLACKOUT inmediato
  }

  return { dimmer: requestedDimmer }  // Pass-through
}
```

**Dependencia:** Requiere que el caller le pase `currentColorDmx` ya aprobado (post-`HardwareSafetyLayer` y post-`HarmonicQuantizer`).

**Estado en Aether:** **NO INTEGRADO**. El `NodeResolver._translateColor()` (línea 577) pasa por `ColorTranslator` y `HarmonicQuantizer`, pero **nunca llama a `getDarkSpinFilter().filter()`**. Esto significa que un fixture con `mixingType='wheel'` en pipeline Aether **mostrará cristales intermedios** al público.

### 3.2 HarmonicQuantizer — El Péndulo Armónico

```
Archivo: src/hal/translation/HarmonicQuantizer.ts
Líneas críticas: 97-278
```

**Problema que resuelve:** Selene piensa a 60fps, pero las ruedas mecánicas necesitan 500ms+. En vez de bloquear por fuerza bruta (congela el show), cuantiza los cambios a subdivisiones musicales.

**Algoritmo:**
```typescript
quantize(fixtureId, newColor, bpm, bpmConfidence, minChangeTimeMs) {
  if (bpmConfidence < 0.3) return { colorAllowed: true }  // Fallback a debounce

  const beatPeriodMs = 60000 / bpm
  // Encontrar multiplicador más rápido cuyo período ≥ minChangeTimeMs
  for (const mult of [1, 2, 4, 8, 16]) {
    if (beatPeriodMs * mult >= minChangeTimeMs) {
      return { colorAllowed: elapsed >= beatPeriodMs * mult }
    }
  }
}
```

**Ejemplo:** BPM=128, `minChangeTimeMs=500` (Beam 2R)
- Beat = 468.75ms → < 500ms ✗
- 2 beats = 937.50ms → ≥ 500ms ✓ ← Elegido

**Estado en Aether:** **INTEGRADO** (líneas 676-698 de `NodeResolver.ts`). El `NodeResolver` inyecta BPM y confidence vía `setResolveContext()` y llama `getHarmonicQuantizer().quantize()` antes de escribir el canal `color_wheel`.

### 3.3 HardwareSafetyLayer — Debounce Pasivo

```
Archivo: src/hal/translation/HardwareSafetyLayer.ts
Líneas críticas: 91-257
```

**Problema que resuelve:** Protege el motor de la rueda de color de cambios más rápidos que su capacidad mecánica.

**Algoritmo actual (WAVE 2711):** Solo debounce pasivo. Sin chaos latch, sin strobe delegation.
```typescript
filter(fixtureId, requestedColorDmx, profile) {
  if (!isMechanicalFixture(profile)) return passThrough

  const minChangeTime = profile.colorEngine.colorWheel.minChangeTimeMs * safetyMargin  // 500ms × 1.2 = 600ms
  const timeSinceLastChange = now - state.lastColorChangeTime

  if (timeSinceLastChange < minChangeTime) {
    return { finalColorDmx: state.lastColorDmx, wasBlocked: true }  // RETENER
  }

  return { finalColorDmx: requestedColorDmx }  // PERMITIR
}
```

**Estado en Aether:** **NO INTEGRADO**. El `NodeResolver` tiene `HarmonicQuantizer` (gating musical) pero **no tiene `HardwareSafetyLayer`** (debounce temporal como red de seguridad). Si el Quantizer falla (bug, bpmConfidence bajo, edge case), no hay segunda capa de protección.

### 3.4 ColorTranslator — Traducción Cromática

```
Archivo: src/hal/translation/ColorTranslator.ts
Líneas críticas: 244-557
```

**Problema que resuelve:** Traduce intenciones artísticas (RGB) a realidades físicas (DMX de rueda mecánica).

**Pipeline de matching (WAVE 3456 — Mechanical Hue Matcher):**
1. Convertir target + slots a HSL
2. Si target saturación > 0.15: penalizar slots neutros (distancia = 180°)
3. Diferencia de hue circular (0-180°)
4. `poorMatch = hueDiff > 45°`
5. Half-color positioning entre slots adyacentes

**Cache:** LRU de 512 entradas con clave cuantizada en L*a*b* (paso=4).

**Estado en Aether:** **INTEGRADO** (líneas 611, 633, 668 de `NodeResolver.ts`). El `_translateColor()` llama `getColorTranslator().translate()` para `rgbw`, `cmy`, y `wheel`.

---

## 4. EJE 3: SALVAGUARDAS ELÉCTRICAS Y DE INTERFAZ

### 4.1 Paranoia Protocol — Refresh Rate Throttling

```
Archivo: src/hal/drivers/UniversalDMXDriver.ts
Líneas críticas: 136-137
```

```typescript
// WAVE 1101: PARANOIA PROTOCOL
this.config = {
  refreshRate: config.refreshRate ?? 30,  // 44→30 para proteger movers baratos
}
```

**Justificación:** Chips chinos ($50-200) típicamente procesan solo 20-30Hz. A 44Hz sus buffers se saturan → movimientos erráticos.

**Throttling por strategy:**
- **OpenDMX (cables tontos)**: `refreshRate: 30` hardcoded en `connect()` (línea 150 de `OpenDMXStrategy.ts`)
- **Enttec Pro (interfaces inteligentes)**: Sin throttling explícito — el microcontrolador gestiona timing interno
- **ArtNet/sACN**: Sin throttling — UDP es fire-and-forget

### 4.2 OpenDMXStrategy — Phantom Process Proxy

```
Archivo: src/hal/drivers/strategies/OpenDMXStrategy.ts
Líneas críticas: 36-203
```

**Arquitectura de seguridad:**
```
Main Process (Electron)
  └── fork() → Child Process (Node.js separado)
        └── Carga serialport addon nativo
        └── Tiene su propio V8 heap + GC + event loop
        └── NO comparte address space con main
        └── Loop de output DMX independiente (30Hz)
```

**Razón:** `worker_threads` + native addon (`serialport`) + shared C++ global state = crash fatal `HandleScope::HandleScope`.

**Optimizaciones de seguridad:**
- **Dirty check hash** (líneas 185-194): djb2 sobre 513 bytes. Si el buffer no cambió, no se envía IPC.
- **RESET_BUFFER** (WAVE 3080, línea 52): Purga a cero en cambio de show.
- **SIGKILL forzado** (línea 223): Si el child no responde a `DISCONNECT` en 2s, se mata incondicionalmente.

### 4.3 EnttecProStrategy — Timeout de Drain

```
Archivo: src/hal/drivers/strategies/EnttecProStrategy.ts
Líneas críticas: 26, 61-80
```

```typescript
const DRAIN_TIMEOUT_MS = 100  // Si USB muere mid-transmit, no bloqueamos

port.drain(() => { clearTimeout(safety); resolve() })
setTimeout(() => { log('drain timeout'); resolve() }, DRAIN_TIMEOUT_MS)
```

**Riesgo mitigado:** Si el cable USB se desconecta durante `port.write()`, `drain()` nunca resuelve → deadlock del frame loop.

### 4.4 FixtureProfile — Límites Eléctricos y Térmicos

```
Archivo: src/hal/translation/FixtureProfiles.ts
Líneas críticas: 112-122, 176-181
```

```typescript
export interface FixtureProfile {
  // ...
  safety: {
    blackoutOnColorChange: boolean    // Requiere DarkSpin
    maxContinuousOnTime: number       // Segundos (0=sin límite)
    isDischarge: boolean              // Lámpara de descarga — requiere cooldown
    cooldownTime: number             // Segundos de enfriamiento tras apagado
  }
}

export const BEAM_2R_PROFILE: FixtureProfile = {
  // ...
  safety: {
    blackoutOnColorChange: true,
    maxContinuousOnTime: 0,   // Sin límite real
    isDischarge: true,
    cooldownTime: 300,        // 5 minutos mínimo
  }
}
```

**Estado en Aether:** **NO INTEGRADO**. El `NodeResolver` no lee `FixtureProfile`. No hay protección contra:
- Strobe mecánico a frecuencias > `maxStrobeHz` (12Hz para Beam 2R)
- Re-encendido de lámpara de descarga durante `cooldownTime`
- Sobrecalentamiento por `maxContinuousOnTime`

---

## 5. EJE 4: EL PUNTO DE INSERCIÓN AETHER

### 5.1 ¿Qué está integrado en Aether hoy?

**En `NodeResolver._writeNode()` (líneas 388-424):**
1. ✅ **Bounds check**: `bufIdx >= 0 && bufIdx < 512`
2. ✅ **TransferCurve**: Aplica curva de transferencia configurada
3. ✅ **Constraint max**: `if (normalized > maxNorm) normalized = maxNorm`
4. ✅ **Calibration**: `invertPan`, `tiltOffset`, `panOffset`
5. ✅ **Clamp final**: `[0, 255]`
6. ✅ **ColorTranslator**: Para nodos COLOR con `mixingType` wheel/rgbw/cmy
7. ✅ **HarmonicQuantizer**: Gate musical para cambios de rueda

**En `NodeResolver._translateColor()` (líneas 577-714):**
1. ✅ Scratch RGB reutilizado (zero-alloc)
2. ✅ Conversión `aetherWheel → legacyWheel`
3. ✅ Quantizer con fallback a `lastAllowedColor`

### 5.2 ¿Qué está BYPASSEADO en Aether?

| Bypass | Riesgo | Detalle |
|---|---|---|
| **DarkSpinFilter** | **CRÍTICO** | Público ve cristal intermedio en cambios de rueda |
| **FixturePhysicsDriver** | **ALTO** | Sin SAFETY_CAP, sin REV_LIMIT, sin inercia. Motor puede romperse |
| **HardwareSafetyLayer** | **MEDIO** | Sin debounce pasivo como red de seguridad del Quantizer |
| **Aduana Output Gate** | **CRÍTICO** | `outputEnabled=false` no apaga fixtures Aether |
| **Virtual Fixture Gate** | **MEDIO** | Fixtures virtuales registrados en Aether emiten DMX real |
| **Strobe Hz Cap** | **MEDIO** | Strobe mecánico ilimitado en frecuencia |
| **Discharge Cooldown** | **BAJO** | Re-encendido de lámpara de descarga sin protección |

### 5.3 Diseño Teórico: AetherSafetyMiddleware

Propuesta de dónde inyectar las salvaguardas faltantes sin destruir la arquitectura zero-alloc de Aether:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPUESTA: AetherSafetyMiddleware                                           │
│  Inyectado en NodeResolver.resolve() ANTES del loop de universes             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NodeResolver.resolve(arbitrated)                                            │
│    │                                                                        │
│    ├── [NUEVO] Virtual Gate:                                                 │
│    │   Si device.isVirtual → skip _writeNode()                              │
│    │                                                                        │
│    ├── [NUEVO] Aduana Gate (outputEnabled):                                 │
│    │   Si !masterArbiter.isOutputEnabled()                                  │
│    │     → Si el nodo NO tiene source MANUAL → dmxValue = safeValue         │
│    │     → Si el nodo SÍ tiene source MANUAL → pass-through                 │
│    │                                                                        │
│    ├── [EXISTE] _writeNode() / ForgeNodeEvaluator                            │
│    │   │                                                                    │
│    │   ├── [NUEVO] KINETIC Inertia Clamp:                                  │
│    │   │   Si delta pan/tilt > maxVelocityThisFrame:                        │
│    │   │     → clamp a maxVelocity (similar a REV_LIMIT)                     │
│    │   │   NOTA: Requiere tracking de lastPosition por nodo en NodeResolver  │
│    │   │                                                                        │
│    │   ├── [EXISTE] ColorTranslator + HarmonicQuantizer                      │
│    │   │                                                                        │
│    │   ├── [NUEVO] DarkSpinFilter Integration:                               │
│    │   │   Si mixingType='wheel' y color_wheel cambió:                        │
│    │   │     → Inyectar dimmer=0 en translatedValues                        │
│    │   │     → Mantener estado inTransit por fixtureId                     │
│    │   │                                                                        │
│    │   ├── [NUEVO] Strobe Hz Cap:                                            │
│    │   │   Si shutter.type='mechanical' y strobeHz > maxStrobeHz:           │
│    │   │     → clamp a maxStrobeHz                                            │
│    │   │                                                                        │
│    │   ├── [EXISTE] Calibration + Clamp [0,255]                              │
│    │                                                                        │
│    └── [NUEVO] Post-Resolve: Universe Power Budget (MAX CAP)                 │
│        Si suma de canales activos > threshold → scale down proporcionalmente   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.3.1 Inyección DarkSpin en NodeResolver (mínima invasión)

```typescript
// En NodeResolver._translateColor(), caso 'wheel':
const wheelDmxNorm = /* resultado actual del translator + quantizer */

// [NUEVO] DarkSpin gate
const darkSpin = getDarkSpinFilter().filter(
  deviceId,                    // fixture identifier
  wheelDmxNorm * 255,          // current color DMX (0-255)
  buildProfileFromNodeData(node),  // fixture profile con minChangeTimeMs
  translatedValues['dimmer'] ?? 1   // requested dimmer (0-1)
)

if (darkSpin.inTransit) {
  // Sobrescribir dimmer en translatedValues con 0
  translatedValues = { ...translatedValues, dimmer: 0 }
}
```

**Problema:** `translatedValues` es `Readonly<Record<string, number>>` en la firma. Requiere crear una copia mutable o cambiar la firma. Impacto en zero-alloc: la copia solo ocurre cuando hay cambio de rueda (~1 vez cada 500ms-2s), no en steady state.

#### 5.3.2 Inyección REV_LIMIT en NodeResolver (KINETIC nodes)

```typescript
// En NodeResolver._writeNode(), canal tipo 'pan' o 'tilt':
const lastPos = this._lastKineticPositions.get(node.nodeId)
if (lastPos) {
  const delta = Math.abs(normalized - lastPos.pan)
  const maxDeltaPerFrame = MAX_VELOCITY_DMX_PER_SEC * (deltaMs / 1000) / 255
  if (delta > maxDeltaPerFrame) {
    normalized = lastPos.pan + Math.sign(normalized - lastPos.pan) * maxDeltaPerFrame
  }
}
```

**Problema:** Requiere almacenar estado por nodo KINETIC en el NodeResolver (añade Map). También requiere conocer `deltaMs` del frame loop (actualmente no llega al resolver como parámetro).

#### 5.3.3 Inyección Aduana (outputEnabled) en NodeResolver

La forma más limpia es hacer que `NodeArbiter.arbitrate()` retorne mapa vacío o ceros cuando `blackout=true`. El problema es `outputEnabled=false` (ARMED, no LIVE), donde los canales MANUAL deben pasar.

**Opción A (Aether-aware):** Inyectar `outputEnabled` y `_controlSources` en el `ForgeFrameContext` para que el evaluador Forge los respete.
**Opción B (NodeResolver gate):** Añadir un `AetherAduana` que filtre el `ArbitratedNodeMap` antes de `resolve()`.

```typescript
// Opción B — más simple, menos zero-alloc impact
interface AetherAduanaConfig {
  outputEnabled: boolean
  manualNodeIds: Set<string>  // nodeIds con source=L2
}

public applyAduana(arbitrated: ArbitratedNodeMap, config: AetherAduanaConfig): void {
  if (config.outputEnabled) return
  for (const [nodeId, channels] of arbitrated) {
    if (!config.manualNodeIds.has(nodeId)) {
      // Zero-fill todos los canales excepto los que tienen source MANUAL
      for (const key of Object.keys(channels)) {
        if (key !== 'dimmer' && key !== 'shutter') channels[key] = 0
      }
      // Para dimmer/shutter: si no son manual → 0
      // Para pan/tilt: si no son manual → center (0.5)
    }
  }
}
```

---

## 6. MAPA DE ARCHIVOS DE SEGURIDAD

```
src/engine/movement/
├── FixturePhysicsDriver.ts          ← SAFETY_CAP, REV_LIMIT, PAN AIRBAG, NaN Guard, Teleport
│   ├── VibeMovementPresets.ts       ← Presets per-vibe (snapFactor, revLimit, physicsMode)
│   └── __tests__/FixturePhysicsDriver.test.ts

src/hal/translation/
├── HardwareSafetyLayer.ts           ← Debounce pasivo para ruedas mecánicas (WAVE 2711)
├── ColorTranslator.ts               ← CIE76 ΔE* wheel matching, RGBW/CMY (WAVE 2096.1)
├── DarkSpinFilter.ts                ← Blackout durante tránsito de rueda (WAVE 2690)
├── HarmonicQuantizer.ts             ← Gating musical de cambios de color (WAVE 2672)
└── FixtureProfiles.ts               ← Perfiles físicos: maxStrobeHz, cooldown, blackoutOnColorChange

src/hal/drivers/
├── UniversalDMXDriver.ts            ← Paranoia Protocol 30Hz, multi-universe, Hydra mutex
│   ├── strategies/
│   │   ├── OpenDMXStrategy.ts       ← Phantom Process fork(), dirty hash, RESET_BUFFER, SIGKILL
│   │   ├── EnttecProStrategy.ts     ← Drain timeout 100ms, Label 6 / 0xA9 protocol
│   │   └── DMXSendStrategy.ts       ← Interface contract
│   └── ArtNetDriver.ts              ← UDP broadcast

src/core/aether/resolver/
└── NodeResolver.ts                  ← Bounds check, TransferCurve, Clamp [0,255],
                                       Calibration, ColorTranslator, HarmonicQuantizer,
                                       IK tiltLimits/panRangeDeg
                                       NO: DarkSpin, PhysicsDriver, SafetyLayer, Aduana, Virtual

src/core/aether/
├── NodeArbiter.ts                   ← L4 Blackout (retorna mapa vacío)
└── AetherIPCHandlers.ts             ← L2 Manual overrides, L2.5 Inhibit limits
```

---

## 7. RECOMENDACIONES PARA INTEGRACIÓN (SIN CÓDIGO)

### Prioridad P0 (Antes de conectar cualquier hardware real):

1. **Integrar DarkSpinFilter en NodeResolver._translateColor()**
   - Modificar el caso `'wheel'` para que, tras obtener `wheelDmxNorm`, evalúe `getDarkSpinFilter().filter()`
   - Si `inTransit=true`, sobrescribir `dimmer=0` en el mapa de canales resultante
   - Requiere pasar `deviceId` al método `_translateColor()`

2. **Integrar Aduana Output Gate**
   - Añadir `outputEnabled: boolean` y `manualNodeIds: Set<string>` al `ForgeFrameContext`
   - En `ForgeNodeEvaluator.evaluate()`: si `!outputEnabled` y el nodo no es manual → salida segura
   - Alternativa: gate en `NodeResolver.resolve()` post-arbitrated, pre-write

3. **Virtual Fixture Gate**
   - En `_writeNode()`: si `device.isVirtual === true` → `return` (no escribir al buffer)
   - O en `TitanOrchestrator` antes de `sendUniverseRaw`: filtrar universos de virtuales

### Prioridad P1 (Antes de test con movers):

4. **KINETIC Velocity Clamp**
   - Añadir `Map<NodeId, {pan:number, tilt:number, timestamp:number}>` en NodeResolver
   - En `_writeNode()` para canales pan/tilt: clamp delta por frame a `MAX_DMX_PER_SEC * dt`
   - Valor conservador inicial: 400 DMX/s (equivalente a REV_LIMIT Techno)

5. **Integrar HardwareSafetyLayer como red de seguridad**
   - Llamar `getHardwareSafetyLayer().filter()` en `_translateColor()` después del Quantizer
   - Fallback pasivo si el Quantizer falla (bpmConfidence bajo, edge case)

### Prioridad P2 (Robustez general):

6. **Strobe Hz Cap**
   - Leer `FixtureProfile.shutter.maxStrobeHz` si está disponible en `IDeviceDefinition`
   - En `_writeNode()`, canal tipo `strobe`: si frecuencia calculada > maxStrobeHz → clamp

7. **Discharge Cooldown**
   - Estado por fixture en NodeResolver: `lastOffTime`, `cooldownMs`
   - Si `isDischarge=true` y dimmer pasó de >0.1 a 0 → guardar timestamp
   - Si dimmer vuelve a >0.1 antes de `cooldownMs` → mantener 0

---

## 8. CHECKLIST PRE-HARDWARE

| # | Item | Legacy | Aether | Acción |
|---|------|--------|--------|--------|
| 1 | DarkSpinFilter (transit blackout) | ✅ | ❌ | **P0: Integrar** |
| 2 | Aduana outputEnabled gate | ✅ | ❌ | **P0: Integrar** |
| 3 | Virtual fixture filter | ✅ | ❌ | **P0: Integrar** |
| 4 | KINETIC velocity clamp (REV_LIMIT) | ✅ | ❌ | **P1: Implementar** |
| 5 | HardwareSafetyLayer (debounce) | ✅ | ❌ | **P1: Integrar** |
| 6 | HarmonicQuantizer (BPM gate) | ✅ | ✅ | ✅ OK |
| 7 | ColorTranslator (CIE76 matching) | ✅ | ✅ | ✅ OK |
| 8 | PAN AIRBAG (margin 5) | ✅ | ⚠️ partial | P2: Calibración IK |
| 9 | Strobe Hz cap | ✅ | ❌ | **P2: Implementar** |
| 10 | Discharge cooldown | ✅ | ❌ | **P2: Implementar** |
| 11 | NaN/Infinity guards | ✅ | ⚠️ partial | P2: Verificar opcodes |
| 12 | Buffer bounds check (0-512) | ✅ | ✅ | ✅ OK |
| 13 | Clamp final [0,255] | ✅ | ✅ | ✅ OK |
| 14 | DMX refresh rate 30Hz | ✅ | ✅ | ✅ OK (driver-level) |

---

*Fin del Diagnóstico de Salvaguardas de Hardware — WAVE 4554*
