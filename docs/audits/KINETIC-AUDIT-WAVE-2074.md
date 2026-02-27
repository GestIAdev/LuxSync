# 🏎️ WAVE 2074 — THE KINETIC AUDIT
## Auditoría Exhaustiva del Pipeline de Movimiento — Pre-Beta Cerrada

**Fecha:** Junio 2025  
**Auditor:** PunkOpus  
**Scope:** Todo lo que se mueve entre el BPM y el motor paso a paso  
**Veredicto General:** ✅ **PIPELINE KINÉTICO CERTIFICADO — TODOS LOS HALLAZGOS CRÍTICOS Y MODERADOS RESUELTOS (WAVE 2074.2 + 2074.3)**

---

## 📐 MAPA DEL PIPELINE

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  PACEMAKER   │────▶│  VibeMovementManager │────▶│    TitanEngine    │
│  (BPM/Beat)  │     │  (The Choreographer) │     │  (calculateMove)  │
└─────────────┘     └──────────────────────┘     └────────┬──────────┘
                                                          │
                     Coordenadas Abstractas (-1 a +1)     │
                                                          ▼
┌─────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│     HAL      │◀───│   MasterArbiter      │◀────│  Layer 0: Titan   │
│ (DMX Output) │     │  (The Handshake)     │     │  centerX/Y (0-1)  │
└──────┬──────┘     └──────────────────────┘     └───────────────────┘
       │
       ▼
┌──────────────────────┐     ┌──────────────────────┐
│  FixturePhysicsDriver│────▶│   DMX Universe       │
│  (The Physics Bunker)│     │   (Art-Net / sACN)   │
└──────────────────────┘     └──────────────────────┘
       ▲
       │
┌──────────────────────┐     ┌──────────────────────┐
│ HardwareSafetyLayer  │     │ TechnoStereoPhysics  │
│ (Mechanical Guard)   │     │ (Paranoia Protocol)  │
└──────────────────────┘     └──────────────────────┘
```

---

## PILAR 1: VibeMovementManager — THE CHOREOGRAPHER

**Archivo:** `electron-app/src/engine/movement/VibeMovementManager.ts` (681 líneas)  
**Rol:** Genera intenciones abstractas de movimiento (-1 a +1) basadas en BPM, energía y patrones canónicos.

### 1.1 Independencia del Frame Rate

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Fuente de fase BPM | ✅ CORRECTO | `absoluteBeats = beatCount + beatPhase` — viene del Pacemaker, es absoluto |
| Fuente de fase fallback | ✅ CORRECTO | `this.time * beatsPerSecond` — acumula con `Date.now()` delta |
| `this.time` acumulador | 🟡 INERTE | Solo se usa en modo fallback (sin audio). En modo BPM, no participa en el cálculo de fase |
| Pattern functions | ✅ CORRECTO | Reciben `phase` (radianes), no `deltaTime`. La fase ES el tiempo (vía BPM) |
| Transiciones | ✅ CORRECTO | `TRANSITION_DURATION_MS = 2000ms`, Hermite smoothstep `t²(3-2t)`, usa `Date.now()` |

**Veredicto:** La fase es determinista respecto al BPM. No importa si el render corre a 30 o 60 FPS — el patrón estará en la misma posición para el mismo beat. ✅

### 1.2 BPM Drift

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Clamp BPM | ✅ CORRECTO | `getSafeBPM()` → 60-200 BPM, default 120 |
| BPM Source | ✅ CORRECTO | WAVE 1159: BETA primero (`context.bpm`), Pacemaker fallback |
| Beat acumulación | ✅ CORRECTO | `beatCount` viene del Pacemaker (entero incremental), no se recalcula |
| Fallback sin audio | ✅ CORRECTO | Usa `this.time` wall-clock, no drift acumulativo |

**Veredicto:** Sin riesgo de drift. El BPM viene de fuente externa (BETA/Pacemaker), VMM no lo recalcula. ✅

### 1.3 THE GEARBOX — Limitador de Amplitud por Hardware

```
HARDWARE_MAX_SPEED = 250 DMX/s (constante global)

maxTravelPerCycle = 250 * (60/bpm) * patternPeriod
energyBoost = 1.0 + energy * 0.2  (max 20%)
requestedTravel = abstractAmplitude * 256 * 2 * energyBoost
gearboxFactor = min(1.0, maxTravelPerCycle / requestedTravel)
effectiveAmplitude = abstractAmplitude * gearboxFactor
```

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| HARDWARE_MAX_SPEED | 🟡 HARDCODEADO | 250 DMX/s es un valor conservador genérico. No consulta el `physicsProfile` del fixture real |
| Energy boost cap | ✅ CORRECTO | Max 20% — contenido |
| Cálculo matemático | ✅ CORRECTO | Budget → travel → ratio → clamp. Determinista |
| ¿Se aplica POR FIXTURE? | 🔴 NO | Es global. Un fixture lento y uno rápido reciben el mismo gearboxFactor |

**Vulnerabilidad VMM-GEARBOX-01:** ✅ **RESUELTO WAVE 2074.3**  
> `generateIntent()` y `calculateEffectiveAmplitude()` ahora aceptan `fixtureMaxSpeed` como parámetro opcional (default 250). Defense in depth: la protección primaria per-fixture sigue siendo el `speedFactor` del FixturePhysicsDriver.

**Severidad:** 🟡 ~~MODERADA~~ — Resuelto.

### 1.4 Patrones Canónicos — The Golden Dozen

| Patrón | Período (beats) | Continuidad | Stress al Motor |
|--------|-----------------|-------------|-----------------|
| `sweep` | 4 | ✅ Continuo (sin) | Bajo |
| `circle` | 4 | ✅ Continuo (sin/cos) | Bajo |
| `figure8` | 8 | ✅ Continuo (sin/sin*2) | Bajo |
| `pendulum` | 2 | ✅ Continuo (sin) | Bajo |
| `zigzag` | 4 | ⚠️ Triangular | Medio — derivada discontinua en picos |
| `square` | 4 | 🔴 Discontinuo (`Math.floor`) | **ALTO** — saltos instantáneos |
| `diagonal` | 4 | ✅ Continuo (sin) | Bajo |
| `cross` | 4 | ⚠️ Triangular | Medio |
| `tilt_wave` | 4 | ✅ Continuo (sin) | Bajo |
| `pan_sweep` | 4 | ✅ Continuo (sin) | Bajo |
| `random_walk` | 8 | ✅ Lerp interpolado | Bajo |
| `ballyhoo` | 16 | ✅ Fourier sums | Bajo |

**Vulnerabilidad VMM-SQUARE-01:**  
> `square` genera saltos de ~amplitud completa (~256 DMX) instantáneamente. Esto estresa al máximo el REV_LIMIT y la física de inercia. Para Techno con `snapFactor = 1.0`, el motor recibe un delta de 256 DMX en un frame. El REV_LIMIT lo clampea a 120 DMX/frame.

**Impacto:** El patrón `square` nunca llega a la posición target antes de que cambie de nuevo. A 120 BPM con período 4, cada estado dura 500ms = ~15 frames @ 30fps. 120 DMX/frame × 15 = 1800 DMX teóricos, sobra. **No es bug, es mecánicamente factible.** Pero a BPM altos (180+), cada estado dura ~8 frames → 120 × 8 = 960 DMX. Sigue sobrando para 256 DMX de rango. ✅ Confirmado: no es problema real.

### 1.5 Velocidades Hardcodeadas de Patrones Canónicos

Los patrones NO tienen velocidad propia — la velocidad emerge de:

```
velocidad_física = amplitud × frecuencia_angular × sin(phase)

Donde:
- amplitud = VIBE_CONFIG.ampScale × gearboxFactor × energy
- frecuencia_angular = (2π × BPM) / (60 × patternPeriod)
```

| Vibe | ampScale | freqMult | BPM range | Velocidad pico teórica (DMX/s) |
|------|----------|----------|-----------|-------------------------------|
| Techno | 1.0 | 0.25 | 120-180 | ~160-240 |
| Latino | 0.85 | 0.15 | 90-130 | ~50-90 |
| Pop-Rock | 0.80 | 0.20 | 100-160 | ~80-140 |
| Chill | 0.50 | 0.10 | 60-110 | ~15-35 |

**Veredicto:** Las velocidades pico están dentro del budget del Gearbox (250 DMX/s). ✅

---

## PILAR 2: MasterArbiter — THE HANDSHAKE

**Archivo:** `electron-app/src/core/arbiter/MasterArbiter.ts` (2205 líneas)  
**Rol:** Mezcla todas las capas de control en una salida DMX final.

### 2.1 Jerarquía de Capas

```
Prioridad 4: BLACKOUT     → Dimmer = 0, override total
Prioridad 3: EFFECTS      → EffectManager / Hephaestus
Prioridad 2: MANUAL       → Faders de calibración  ← ABSOLUTA, sin merge
Prioridad 1: CONSCIOUSNESS → Brain/Selene
Prioridad 0: TITAN_AI     → TitanEngine + VMM
```

### 2.2 Conversión de Coordenadas VMM → Arbiter

```typescript
// TitanEngine.calculateMovement():
centerX = 0.5 + (vmmIntent.x * 0.5)  // VMM (-1,+1) → HAL (0,1)
centerY = 0.5 + (vmmIntent.y * 0.5)  // Full range mapping

// MasterArbiter Layer 0:
pan = intent.movement.centerX * 255   // HAL (0,1) → DMX (0,255)
tilt = intent.movement.centerY * 255
```

**Veredicto:** Cadena VMM(-1,+1) → HAL(0,1) → DMX(0,255) es lineal y correcta. Sin distorsión ni pérdida de rango. ✅

### 2.3 Pattern Offset (Mover Spread)

```typescript
// getAdjustedPosition():
liveCenterPan = titanValues.pan  // Centro VIVO, no congelado (WAVE 2070.3b)
panMovement = offset.panOffset * 128 * pattern.size
finalPan = liveCenterPan + panMovement

// calculatePatternOffset():
speed = Math.max(0.01, pattern.speed)  // Div/0 guard ✅
cycleDurationMs = 1000 / speed
phase = (elapsedMs % cycleDurationMs) / cycleDurationMs * 2π
```

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Centro vivo | ✅ CORRECTO | Usa titan values del frame actual, no congelados |
| Div/0 guard | ✅ CORRECTO | `Math.max(0.01, speed)` |
| Pattern.size | ✅ CORRECTO | Multiplica offset, no posición base |
| Mover spread | ✅ CORRECTO | `spreadFactor = 0.15`, fan centrado |

### 2.4 Manual Override — The Hard Cut

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Prioridad absoluta | ✅ CORRECTO | WAVE 440.5 — return directo sin merge |
| Ghost Handoff | 🔴 DESHABILITADO | WAVE 2070.3 EXORCISM — hard cut en release |
| Interpolación de salida | ❌ NO EXISTE | Al soltar manual, salta instantáneamente a Titan |

**Vulnerabilidad ARB-GHOST-01:** ✅ **RESUELTO WAVE 2074.3**  
> Implementado Position Release Fade: al soltar control manual, captura última posición y aplica smoothstep `t²(3-2t)` durante 500ms hacia la posición Titan. Post-process en `arbitrateFixture()` DESPUÉS de `getAdjustedPosition()`. Sin estado ghost persistente.

**Recomendación:** ~~Implementar un `TRANSITION_FRAMES = 15` (~500ms) post-release donde la posición Titan se interpola linealmente desde la última posición manual, sin mantener estado ghost.~~ ✅ RESUELTO WAVE 2074.3 — Implementado con smoothstep, superior a interpolación lineal.

---

## PILAR 3: FixturePhysicsDriver — THE PHYSICS BUNKER

**Archivo:** `electron-app/src/engine/movement/FixturePhysicsDriver.ts` (948 líneas)  
**Rol:** Traduce posiciones target a movimiento físico real con inercia, safety y NaN guards.

### 3.1 Safety Caps

```typescript
SAFETY_CAP = { maxAcceleration: 900, maxVelocity: 400 }  // WAVE 2062
PAN_SAFETY_MARGIN = 5  // DMX units — airbag vs. mechanical stops
```

### 3.2 The Bottleneck — Triple Min

```typescript
effectiveMaxAccel = Math.min(SAFETY_CAP, VibeRequest, HardwareLimit)
effectiveMaxVel  = Math.min(SAFETY_CAP, VibeRequest, HardwareLimit)
```

**Veredicto:** La jerarquía es correcta. El más restrictivo siempre gana. ✅

### 3.3 deltaTime Handling

```
┌─────────────────────────────────────────────────────────────┐
│  TELEPORT MODE (dt > 200ms)                                 │
│  → Skip physics, jump instantly, velocity = 0               │
│  → Ej: Salto de timeline en Chronos                         │
├─────────────────────────────────────────────────────────────┤
│  PHANTOM MODE (50ms < dt < 200ms)                           │
│  → Iterative chunking: divide en pasos de 16ms              │
│  → Smooth catch-up sin explosión numérica                   │
├─────────────────────────────────────────────────────────────┤
│  LIVE MODE (dt < 50ms)                                      │
│  → Single pass physics                                      │
│  → Operación normal                                         │
└─────────────────────────────────────────────────────────────┘
```

**Veredicto:** Robusto para edge cases de timing. ✅

### 3.4 NaN / Infinity Guards

| Guard | Ubicación | Estado |
|-------|-----------|--------|
| Output NaN → home position | `translate()` / `translateDMX()` | ✅ `Number.isFinite()` |
| Velocity explosion (dt→0) | `applyPhysicsEasing()` SNAP | ✅ `dt > 0.1` threshold |
| Velocity NaN → reset 0 | `applyPhysicsEasing()` SNAP | ✅ `Number.isFinite()` check |
| Anti-jitter | Post-physics | ✅ `abs(vel) < 5 → 0` |
| Anti-overshoot | CLASSIC mode | ✅ Cross-target → snap + vel=0 |
| Anti-stuck | CLASSIC mode | ✅ Near-limit + far-target → reverse |

**Veredicto:** Defensa en profundidad sólida. No hay camino para NaN/Infinity hacia DMX. ✅

---

### 🔴 3.5 HALLAZGO CRÍTICO #1: SNAP MODE ES CÓDIGO MUERTO

```
VibeMovementPresets:
  Techno  → maxAcceleration: 2000
  Latino  → maxAcceleration: 1200
  Rock    → maxAcceleration: 1100
  Chill   → maxAcceleration: 100

SAFETY_CAP.maxAcceleration = 900

getEffectivePhysicsLimits():
  effectiveMaxAccel = Math.min(900, vibeRequest, hardwareLimit)

applyPhysicsEasing():
  if (maxAccel > 1000) → SNAP MODE     ← NUNCA SE ALCANZA
  else                 → CLASSIC MODE   ← SIEMPRE
```

**Cadena causal:**
1. Techno pide `maxAcceleration: 2000`
2. `getEffectivePhysicsLimits()` lo clampea a `min(900, 2000) = 900`
3. `applyPhysicsEasing()` evalúa `if (900 > 1000)` → **FALSE**
4. Cae al modo CLASSIC (física con aceleración/frenado)
5. SNAP MODE, con todo su código de snapFactor y REV_LIMIT per-vibe, **JAMÁS SE EJECUTA**

**Consecuencias:**
- Todo el bloque `if (maxAccel > 1000)` (~60 líneas) es código muerto
- Los REV_LIMIT per-vibe (Techno: 120, Latino: 25, Rock: 15) **NUNCA SE APLICAN**
- Techno se mueve con la misma física de inercia que Chill (solo más rápido por vel=400)
- Los comentarios sobre "TECHNO: Respuesta instantánea, sin lag" son **mentira arquitectónica**

**Severidad:** 🔴 CRÍTICA (no por seguridad, sino por IDENTIDAD MUSICAL)  
El sistema promete 4 personalidades de movimiento (snap techno, curves latino, dramatic rock, glacial chill) pero entrega UNA sola: física clásica con diferentes velocidades máximas.

### 🔴 3.6 HALLAZGO CRÍTICO #2: REV_LIMIT NO NORMALIZADO POR deltaTime

*Nota: Este bug está dentro del código muerto de SNAP MODE. Si se resucita SNAP MODE (como se recomienda), este bug se activa.*

```typescript
// SNAP MODE (código muerto actual pero futuro):
let deltaPan = (targetDMX.pan - current.pan) * snapFactor
deltaPan = Math.max(-REV_LIMIT_PAN, Math.min(REV_LIMIT_PAN, deltaPan))
newPos.pan = current.pan + deltaPan
```

El `REV_LIMIT_PAN` es un valor absoluto por frame (ej: 120 para Techno). **No se multiplica por `dt`.**

| Framerate | REV_LIMIT_PAN | Velocidad física real |
|-----------|---------------|----------------------|
| 30 FPS | 120 DMX/frame | 120 × 30 = **3,600 DMX/s** |
| 60 FPS | 120 DMX/frame | 120 × 60 = **7,200 DMX/s** |
| 144 FPS | 120 DMX/frame | 120 × 144 = **17,280 DMX/s** |

La velocidad física del motor **DUPLICA** al duplicar el framerate. Esto viola frame-rate independence.

**Fix correcto (para cuando se resucite SNAP MODE):**
```
REV_LIMIT_PAN_PER_SECOND = 3600  // DMX/s (constante)
revLimitThisFrame = REV_LIMIT_PAN_PER_SECOND * dt
deltaPan = clamp(deltaPan, -revLimitThisFrame, revLimitThisFrame)
```

**Severidad:** 🔴 CRÍTICA (latente) — No afecta ahora porque SNAP MODE es código muerto. Pero es una trampa esperando a quien resucite ese branch.

### 🟡 3.7 HALLAZGO MODERADO: deltaTime=16 HARDCODEADO EN HAL

```typescript
// HardwareAbstraction.ts línea 661 y 932:
this.movementPhysics.translateDMX(fixtureId, state.pan, state.tilt, 16)
//                                                                   ^^
//                                                         HARDCODEADO
```

Ambas llamadas de producción a `translateDMX` pasan `deltaTime = 16` (equivalente a 62.5 FPS asumidos). No se mide el deltaTime real entre frames.

**Impacto actual:** Dado que SOLO se ejecuta CLASSIC MODE (SAFETY_CAP=900 < umbral 1000), y CLASSIC MODE SÍ usa `dt` para la física (`vel + accel * dt`, `pos + vel * dt`), un `dt=16ms` fijo significa:

- Si el frame real tarda 33ms (30 FPS), la física calcula la mitad del movimiento real
- Si el frame real tarda 8ms (120 FPS), la física calcula el doble

**Sin embargo:** Como el loop de TitanOrchestrator usa `setInterval` a ~30fps y Electron mantiene timing bastante estable, la desviación práctica es pequeña. No es crisis, pero no es correcto.

**Severidad:** 🟡 MODERADA — Funciona "por accidente" porque el framerate es estable.

**Fix:** Medir `Date.now()` entre llamadas y pasar el delta real.

### 3.8 Presets vs. Reality — La Tabla de la Verdad

| Vibe | Preset Accel | Preset Vel | Effective Accel | Effective Vel | Modo Resultante |
|------|-------------|------------|-----------------|---------------|-----------------|
| Techno | 2000 | 600 | **900** | **400** | CLASSIC (≤1000) |
| Latino | 1200 | 350 | **900** | **350** | CLASSIC (≤1000) |
| Rock | 1100 | 450 | **900** | **400** | CLASSIC (≤1000) |
| Chill | 100 | 50 | **100** | **50** | CLASSIC (≤1000) |
| Idle | 200 | 100 | **200** | **100** | CLASSIC (≤1000) |

**Observación:** Techno, Latino y Rock comparten `effectiveAccel = 900`. La única diferencia real entre ellos es:
- Latino: `vel = 350` (ligeramente más lento que el cap de 400)
- Rock y Techno: `vel = 400` (idénticos)

**Conclusión:** Techno y Rock se mueven EXACTAMENTE IGUAL en el motor físico. La diferencia musical que se percibe viene SOLO de los patrones del VMM (sweep/square vs. fixed positions), no de la física.

---

## PILAR 4: HAL SAFETY — THE GUARDIANS

### 4.1 HardwareSafetyLayer — Protección Mecánica

**Archivo:** `electron-app/src/hal/translation/HardwareSafetyLayer.ts` (415 líneas)  
**Rol:** Protege fixtures con partes mecánicas (rueda de color, gobos).

```
┌─────────────────────────────────────────────────┐
│  TIER 1: DEBOUNCE                                │
│  minChangeTime = profile.minChangeTime * 1.2     │
│  → No permite cambios más rápidos que el motor   │
├─────────────────────────────────────────────────┤
│  TIER 2: CHAOS DETECTION                         │
│  > 3 cambios/segundo → LATCH activado            │
├─────────────────────────────────────────────────┤
│  TIER 3: LATCH                                   │
│  2000ms de congelamiento total del color          │
├─────────────────────────────────────────────────┤
│  TIER 4: STROBE DELEGATION                       │
│  Si demasiados cambios bloqueados → strobe        │
│  (visual equivalente sin mover la rueda)          │
└─────────────────────────────────────────────────┘
```

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Debounce timing | ✅ CORRECTO | `* 1.2` safety margin sobre spec del fabricante |
| Chaos threshold | ✅ CORRECTO | 3/s es conservador para motores paso a paso |
| Latch duration | ✅ CORRECTO | 2000ms permite al motor asentarse |
| Digital bypass | ✅ CORRECTO | Fixtures LED sin partes mecánicas = pass-through |
| Strobe delegation | ✅ ELEGANTE | Efecto visual sin stress mecánico |

**Veredicto:** Sólido. Sin vulnerabilidades encontradas. ✅

### 4.2 TechnoStereoPhysics — PARANOIA PROTOCOL

**Archivo:** `electron-app/src/hal/physics/TechnoStereoPhysics.ts` (437 líneas)  
**Rol:** Traduce audio normalizado a intensidades por zona, con protección AGC.

#### 4.2.1 El Problema del AGC Rebound

```
Música:      ████████░░░░░░░░████████████
AGC Output:  ████████▓▓▓▓▓▓▓▓████████████
                     ^^^^^^^^
                     AGC infla el ruido de fondo
                     tras el silencio → FALSE TRIGGERS
```

#### 4.2.2 La Solución: PARANOIA GATE (WAVE 913)

```typescript
// Estado normal:
INTENSITY_GATE = 0.48  // Solo pasa si energía > 48%

// Después de silencio (primeros 2000ms de audio):
RECOVERY_GATE_ON = 0.80  // Gate sube a 80% — casi nada pasa
RECOVERY_DURATION = 2000  // ms

// Detección de silencio:
SILENCE_THRESHOLD = 0.02  // Energía < 2% = silencio
```

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Gate normal (0.48) | ✅ CORRECTO | Filtra ruido de fondo eficazmente |
| Recovery gate (0.80) | ✅ AGRESIVO PERO CORRECTO | Mata false triggers del AGC rebound |
| Recovery duration (2s) | ✅ CORRECTO | AGC tarda ~1-2s en estabilizarse |
| Silence threshold (0.02) | ✅ CORRECTO | Umbral bajo pero con margen |
| Transition back | ✅ CORRECTO | Instantáneo — al expirar 2s, vuelve a 0.48 |

#### 4.2.3 Arquitectura de Zonas

```
FRONT PARS  → BASS       gate=0.48  boost=1.8x
BACK PARS   → SNARE      gate=0.30  boost=5.0x (geometric mean √(mid×treble))
MOVER LEFT  → MID        gate=0.20  boost=4.0x
MOVER RIGHT → TREBLE     gate=0.14  boost=8.0x "SCHWARZENEGGER MODE"
```

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| Bass gate (0.48) | ✅ CORRECTO | Alto para evitar "heartbeat" constante |
| Treble gate (0.14) | ✅ CORRECTO | Bajo porque treble es naturalmente débil post-AGC |
| Boost factors | 🟡 TUNING | 8x para treble es agresivo — podría saturar con hi-hats fuertes |
| Geometric mean para snare | ✅ ELEGANTE | Resiste ruido cruzado, solo pasa con ambas bandas presentes |

#### 4.2.4 APOCALYPSE DETECTION

```typescript
if (harshness > 0.5 && spectralFlatness > 0.5) {
  // Override ALL zones to chaosEnergy
  // → Drop / Breakdown detection
}
```

**Veredicto:** Correcto. Flatness + harshness altos = espectro destruido (distorsión, drops). Override total es la respuesta musical correcta. ✅

#### 4.2.5 GHOST KICK Sidechain

```typescript
ducking = 1.0 - (frontParIntensity * 0.6)
// Cuando bass golpea (front pars brillan), back pars se atenúan 60%
// → Efecto "pump" de sidechain visual
```

**Veredicto:** Musicalmente correcto. 60% de ducking es audaz pero efectivo para el efecto pump. ✅

---

## 🔬 ANÁLISIS CRUZADO: DEAD CODE MAP

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DEAD CODE INVENTORY                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FixturePhysicsDriver.ts:                                           │
│                                                                      │
│  ❌ SNAP MODE branch (lines ~660-730)            ~70 lines           │
│     Causa: SAFETY_CAP=900 < threshold 1000                          │
│     Incluye: snapFactor, REV_LIMIT per-vibe,                        │
│              velocity liberation, instant response                   │
│                                                                      │
│  ❌ REV_LIMIT_PAN = 120 (Techno)                  Dead              │
│  ❌ REV_LIMIT_PAN = 25  (Latino)                  Dead              │
│  ❌ REV_LIMIT_PAN = 15  (Rock)                    Dead              │
│  ✅ REV_LIMIT_PAN = 255 (Chill/default)           Active            │
│     (pero 255 = sin límite, así que no hace nada)                   │
│                                                                      │
│  VibeMovementPresets.ts:                                             │
│                                                                      │
│  ❌ Techno maxAcceleration: 2000                  Clamped to 900    │
│  ❌ Latino maxAcceleration: 1200                  Clamped to 900    │
│  ❌ Rock maxAcceleration: 1100                    Clamped to 900    │
│  ✅ Chill maxAcceleration: 100                    Used as-is        │
│                                                                      │
│  ❌ Techno maxVelocity: 600                       Clamped to 400    │
│  ❌ Rock maxVelocity: 450                         Clamped to 400    │
│  ✅ Latino maxVelocity: 350                       Used as-is        │
│  ✅ Chill maxVelocity: 50                         Used as-is        │
│                                                                      │
│  MasterArbiter.ts:                                                   │
│                                                                      │
│  ❌ Ghost Handoff (WAVE 2070.3)                   Commented out     │
│                                                                      │
│  TOTAL DEAD CODE: ~100+ líneas                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 RESUMEN DE VULNERABILIDADES

| # | ID | Severidad | Componente | Descripción | Estado |
|---|-----|-----------|------------|-------------|--------|
| 1 | **FPD-SNAP-DEAD** | 🔴 ~~CRÍTICA~~ | FixturePhysicsDriver | SNAP MODE era código muerto (SAFETY_CAP=900 < 1000) | ✅ RESUELTO WAVE 2074.2 |
| 2 | **FPD-REVLIMIT-DT** | 🔴 ~~CRÍTICA~~ | FixturePhysicsDriver | REV_LIMIT no normalizado por deltaTime | ✅ RESUELTO WAVE 2074.2 |
| 3 | **HAL-DT-HARDCODE** | 🟡 ~~MODERADA~~ | HardwareAbstraction | `deltaTime=16` hardcodeado en llamadas a translateDMX | ✅ RESUELTO WAVE 2074.2 |
| 4 | **ARB-GHOST-HARD** | 🟡 ~~MODERADA~~ | MasterArbiter | Ghost Handoff deshabilitado → hard cut en release manual | ✅ RESUELTO WAVE 2074.3 |
| 5 | **VMM-GEARBOX-GLOBAL** | 🟡 ~~MODERADA~~ | VibeMovementManager | Gearbox usa HARDWARE_MAX_SPEED global, no per-fixture | ✅ RESUELTO WAVE 2074.3 |
| 6 | **FPD-REVLIMIT-BRANCH** | 🔴 ~~CRÍTICA~~ | FixturePhysicsDriver | REV_LIMIT y snapFactor branches usaban umbrales de maxAccel derrotados por SAFETY_CAP — todas las vibes recibían personalidad idéntica | ✅ RESUELTO WAVE 2074.3 |
| 7 | **FPD-PRESET-WASTE** | 🟢 BAJA | VibeMovementPresets | Valores de accel/vel que nunca se usan por clamp | Confusión, no bug funcional |
| 8 | **VMM-TIME-INERT** | 🟢 INFORMATIVA | VibeMovementManager | `this.time` se acumula pero no se usa en modo BPM | Memoria desperdiciada, no bug |

---

## 🔧 RECOMENDACIONES DE REFACTORIZACIÓN

### R1: RESUCITAR SNAP MODE (Prioridad: 🔴 ALTA)

**Problema:** SAFETY_CAP=900 mata el branch `if (maxAccel > 1000)`.

**Opción A — Bajar el umbral:**
```
if (maxAccel > 800) → SNAP MODE   // Techno (900) y Latino (900) entran
if (maxAccel > 200) → SNAP MODE   // Solo Chill queda en CLASSIC
```

**Opción B — Separar el criterio:**
No usar `maxAccel` como criterio de modo. Usar el nombre del vibe o un flag explícito:
```typescript
physicsMode: 'snap' | 'classic'  // En VibeMovementPresets
```

**Recomendación: Opción B.** El modo de física no debería depender de un valor numérico que puede ser clampeado por otra capa. Debe ser una decisión explícita del vibe.

### R2: NORMALIZAR REV_LIMIT POR deltaTime (Prioridad: 🔴 ALTA, tras R1)

```typescript
// Definir en DMX/segundo, no DMX/frame:
const REV_LIMIT_PAN_PER_SEC = 3600  // Techno
const REV_LIMIT_TILT_PER_SEC = 1800

// Aplicar con dt:
const revLimitPan = REV_LIMIT_PAN_PER_SEC * dt
deltaPan = clamp(deltaPan, -revLimitPan, revLimitPan)
```

### R3: MEDIR deltaTime REAL EN HAL (Prioridad: 🟡 MEDIA)

```typescript
// HardwareAbstraction — mantener lastFrameTime:
private lastFrameTime = Date.now()

// En cada render:
const now = Date.now()
const dt = Math.min(200, now - this.lastFrameTime)  // Cap para teleport
this.lastFrameTime = now
this.movementPhysics.translateDMX(fixtureId, pan, tilt, dt)
```

### R4: ~~IMPLEMENTAR RELEASE FADE~~ ✅ RESUELTO WAVE 2074.3

Implementado **Position Release Fade** en MasterArbiter: al soltar manual override, captura la última posición manual y aplica una interpolación smoothstep `t²(3-2t)` durante 500ms hacia la posición Titan. Sin estado ghost persistente. Post-process DESPUÉS de `getAdjustedPosition()`.

### R5: ~~GEARBOX PER-FIXTURE~~ ✅ RESUELTO WAVE 2074.3

`generateIntent()` y `calculateEffectiveAmplitude()` en VMM ahora aceptan `fixtureMaxSpeed` como parámetro opcional (default 250 para backward compatibility). Defense in depth — la protección primaria per-fixture sigue siendo el `speedFactor` del FixturePhysicsDriver.

### R6: LIMPIAR PRESETS (Prioridad: 🟢 BAJA)

Ajustar `VibeMovementPresets` para que los valores reflejen la realidad post-SAFETY_CAP:

```typescript
// Si SAFETY_CAP = 900/400, no pidas más de eso:
Techno:  { maxAcceleration: 900, maxVelocity: 400 }  // Era 2000/600
Latino:  { maxAcceleration: 900, maxVelocity: 350 }  // Era 1200/350
Rock:    { maxAcceleration: 900, maxVelocity: 400 }  // Era 1100/450
```

O mejor: subir SAFETY_CAP si los fixtures lo permiten, para que los presets tengan sentido.

---

## 🎯 PRIORIDADES PARA BETA CERRADA

```
ANTES DE BETA:
├── R1: Resucitar SNAP MODE (physicsMode explícito)     ← ✅ RESUELTO WAVE 2074.2
├── R2: Normalizar REV_LIMIT por dt                     ← ✅ RESUELTO WAVE 2074.2
└── R3: deltaTime real en HAL                           ← ✅ RESUELTO WAVE 2074.2

DESPUÉS DE BETA → RESUELTO EN WAVE 2074.3:
├── R4: Release Fade (manual → Titan)                   ← ✅ RESUELTO WAVE 2074.3
├── R5: Gearbox per-fixture                             ← ✅ RESUELTO WAVE 2074.3
└── R6: Limpiar presets                                 ← Housekeeping pendiente

WAVE 2074.3 — HALLAZGO ADICIONAL:
└── FPD-REVLIMIT-BRANCH: REV_LIMIT y snapFactor como    ← ✅ RESUELTO WAVE 2074.3
    datos explícitos del preset, no branches de maxAccel     (snapFactor, revLimitPanPerSec,
                                                              revLimitTiltPerSec en MovementPhysics)
```

---

## 🏁 CONCLUSIÓN

El pipeline de movimiento es **estructuralmente sólido** — la cadena de datos fluye sin pérdidas, los NaN guards son completos, los safety caps protegen el hardware, y el Paranoia Protocol es elegante.

### Estado Post-Cirugía (WAVE 2074.2 + 2074.3)

**Todos los hallazgos críticos y moderados han sido resueltos:**

| Wave | Qué se hizo | Impacto |
|------|-------------|---------|
| 2074.2 | `physicsMode: 'snap' \| 'classic'` explícito en presets | SNAP MODE resucitado — Techno responde instantáneamente |
| 2074.2 | REV_LIMIT normalizado por `dt` (DMX/s, no DMX/frame) | Frame-rate independent — 30fps y 60fps se mueven igual |
| 2074.2 | `Date.now()` delta real en HAL | Adiós al `16` hardcodeado |
| 2074.3 | `snapFactor`, `revLimitPanPerSec`, `revLimitTiltPerSec` como datos explícitos del preset | Cada vibe tiene personalidad REAL — no branches muertos por SAFETY_CAP |
| 2074.3 | Position Release Fade (smoothstep 500ms) en MasterArbiter | Transición suave manual→Titan, sin ghost persistente |
| 2074.3 | `fixtureMaxSpeed` parametrizable en VMM Gearbox | Defense in depth per-fixture |

**Test suite:** 50/50 HephaestusE2E ✅ · 491/580 global (89 fallos pre-existentes, sin regresiones)

**Quedan pendientes solo hallazgos informativos (R6 preset cleanup, VMM-TIME-INERT).**

**El motor no solo sabe bailar — ahora tiene sus zapatos puestos, y cada par es diferente.**

---

*PunkOpus — WAVE 2074/2074.2/2074.3 — The Kinetic Audit (CLOSED)*  
*"El código que no se ejecuta es peor que el código que no existe. Al menos el vacío no miente."*
