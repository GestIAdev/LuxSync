# VMM-IK Movement Audit — LuxSync V1.0

**Auditor:** PunkOpus (Ingeniero Jefe)
**Fecha:** 2026-05-10
**Alcance:** Flujo completo de movimiento (procedural, espacial, manual) desde la UI hasta los valores DMX finales.
**Archivos auditados:**
- `src/engine/movement/VibeMovementManager.ts` (1135 líneas)
- `src/engine/movement/VibeMovementPresets.ts` (302 líneas)
- `src/engine/movement/InverseKinematicsEngine.ts` (626 líneas)
- `src/core/aether/resolver/NodeResolver.ts` (1284 líneas)
- `src/core/aether/egress/AetherSafetyMiddleware.ts` (377 líneas)
- `src/bridges/KineticsBridge.ts` (408 líneas)
- `src/stores/movementStore.ts` (228 líneas)
- `src/core/orchestrator/TitanOrchestrator.ts` (frame loop, L0/L1/L2/L3)

---

## 1. Scope & Flow Analysis

### 1.1 ¿Cómo viaja la señal?

El sistema tiene **tres fuentes de movimiento** que compiten por el mismo nodo KINETIC en el `NodeArbiter`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FUENTE 1: Procedural (VMM) — L0 (Liquid Engine + VibeMovementManager)        │
│  ├─ TitanEngine.frame() → generateIntent(vibeId, audio, fixtureIndex, ...)  │
│  ├─ KineticAdapter.ingest() → _aetherBus.push(pan/tilt normalized)           │
│  └─ Priority: L0 (base layer, lowest)                                        │
│                                                                              │
│  FUENTE 2: Manual Overrides — L2 (KineticsBridge + Programmer)              │
│  ├─ UI (OrthoRadar, XY pad) → movementStore.pan/tilt                       │
│  ├─ KineticsBridge._flushClassic() → window.lux.aether.setManualOverrides() │
│  ├─ AetherIPCHandlers → NodeArbiter L2 (manualOverrideNodeIds)              │
│  └─ Priority: L2 (overrides procedural)                                      │
│                                                                              │
│  FUENTE 3: Spatial IK — L2/L3 hybrid                                        │
│  ├─ UI (SpatialTargetPad) → movementStore.spatialTarget                    │
│  ├─ KineticsBridge._flushSpatial() → window.lux.aether.applySpatialTarget()│
│  ├─ AetherIPCHandlers → NodeResolver._writeNodeIK()                         │
│  ├─ solve(fixtureProfile, target3D, currentPan) → panDMX/tiltDMX           │
│  └─ Priority: L2 if manual, otherwise competes with L0                      │
│                                                                              │
│  ARBITRAJE: NodeArbiter.arbitrate()                                          │
│  ├─ L0: procedural base                                                      │
│  ├─ L1: Selene IA color/dimmer (NO emite pan/tilt desde WAVE 2690)         │
│  ├─ L2: Manual overrides (gana si existe)                                  │
│  ├─ L3: Effects (CorazonLatino/OroSolido — NO emiten movement WAVE 2690)   │
│  └─ Result: ArbitratedNodeMap (normalized 0-1)                            │
│                                                                              │
│  RESOLUCIÓN: NodeResolver.resolve()                                          │
│  ├─ _writeNodeIK() para nodos con targetX/Y/Z (spatial)                    │
│  ├─ _writeNodeClassic() para nodos con pan/tilt directos (procedural/manual)│
│  ├─ AetherSafetyMiddleware.clampKineticVelocity() → slew limit             │
│  ├─ AetherSafetyMiddleware.applyAirbag() → margin 5 DMX near 0/255        │
│  └─ Uint8Array buffers → HAL.sendUniverseRaw()                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Capa de Arbiter: El verdadero árbitro

El `NodeArbiter` (`src/core/aether/NodeArbiter.ts`) es una máquina de capas (L0-L4). El movimiento entra por **L0** (procedural) o **L2** (manual/IK). La capa L1 (Selene IA) **no emite intents de movimiento** desde WAVE 2690 ("movement PURGED — Selene solo pinta fotones"). Esto es una decisión arquitectónica clave: Selene dicta qué aparato brilla y de qué color, pero **el VMM decide dónde apunta**.

Problema: si un efecto LiveFX (L3) emite `zoneOverrides.movement`, eso entra por L3. Pero en la práctica, ni `CorazonLatino` ni `OroSolido` lo hacen — su `movementOverride` está en el `EffectManager` combined output, que el `SeleneAetherAdapter` **ignora** para canales kineticos. El efecto dispara `zoneOverrides` pero no incluye `movement` en sus zonas. Por lo tanto, **el movimiento procedural está desacoplado de los efectos de color**.

---

## 2. VMM: Procedural Engine

### 2.1 Filosofía matemática: La Docena Dorada

`VibeMovementManager` implementa **17 patrones** (la "Docena Dorada" + 4 nobles). Todos son funciones puras `(phase, audio, index?, total?) => {x, y}`.

**Genialidades confirmadas:**

- **Lissajous reales:** `figure8` es `sin(phase), sin(phase*2)*0.75` — una figura de Lissajous 1:2 genuina. No es un círculo disfrazado. `cadera_libre` (WAVE 4703) usa Lissajous 3:2 con deriva de fase irracional (`drift = sin(phase * 0.137) * 0.18`) que rompe la periodicidad exacta. **Esto es matemática real, no marketing.**
- **Interpolación lineal para formas poligonales:** `square` y `diamond` (WAVE 2213 Fénix) usan interpolación lineal entre vértices en vez de `sin/cos`. El diamante anterior era **literalmente un círculo** (líneas 309-312 del comentario). Fue corregido.
- **Movimiento browniano quasi-irracional:** `drift` usa φ=1.618, √2 y √3 como frecuencias incommensurables. Esto genera trayectorias que **nunca se repiten exactamente** en tiempos de show reales. No es "aleatorio" — es determinista pero aperiódico.

### 2.2 El acumulador de fase monotónico (WAVE 2088.10)

**Esta es la corrección más importante del motor de movimiento en toda la historia del proyecto.**

El motor anterior calculaba:
```typescript
// CÓDIGO MUERTO (antes de WAVE 2088.10):
phase = (absoluteBeats % patternPeriod) / patternPeriod * 2π
```

Problemas:
1. `patternPeriod` variaba con `energy` → la fase **saltaba discontinuamente** cuando cambiaba la energía.
2. BPM fluctuaba 70→184 frame-to-frame → `absoluteBeats` avanzaba erráticamente.
3. Módulo de un valor errático = fase caótica = **movimiento convulsivo**.

La solución (línea 580, `VibeMovementManager.ts`):
```typescript
private phaseAccumulator: number = 0
// ...
const phaseDelta = beatsPerSecond * frameDeltaTime * phasePerBeat * ...
this.phaseAccumulator += phaseDelta
const phase = this.phaseAccumulator + phaseOffset
```

La fase avanza como un **volante de inercia**. Nunca retrocede (salvo por el smoothing del BPM), nunca teletransporta. El `patternPeriod` es **fijo** por patrón. La energía solo modula la **amplitud**, que es continua.

**Veredicto:** Es una genialidad de ingeniería de control. El comentario en líneas 568-578 explica el forense con claridad quirúrgica.

### 2.3 El Gearbox: Limitación por hardware

`calculateEffectiveAmplitude()` (línea 1013) implementa un **presupuesto de movimiento**:

```typescript
const maxTravelPerCycle = HARDWARE_MAX_SPEED * secondsPerBeat * patternPeriod
const requestedTravel = 255 * requestedAmplitude
const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
```

Limita la amplitud para que el fixture **nunca pida más DMX de los que sus motores pueden recorrer** en un ciclo del patrón. `HARDWARE_MAX_SPEED` viene del preset del fixture (`fixtureMaxSpeed`), no es una constante global.

**Problema encontrado:** El `GEARBOX_MIN_AMPLITUDE = 0.10` (línea 1052) significa que incluso si el hardware es muy lento, siempre queda al menos 10% de amplitud. No es 0 — lo cual es correcto (evita movers congelados), pero en un show con fixtures de gama muy baja, podrían verse "temblores" forzados que no deberían estar ahí.

### 2.4 Anti-Jitter (WAVE 4703 M1)

`isSameFrame` guard (línea 714):
```typescript
const isSameFrame = (now - this.lastUpdate) < 1  // <1ms = same render frame
```

TitanEngine llama `generateIntent()` **dos veces por frame** (fixture L + fixture R). Sin este guard, el estado interno (`time`, `frameCount`, `barCount`) se corrompe en la segunda llamada. El threshold fue ajustado de 2ms→1ms porque `Date.now()` tiene resolución de 1ms, y en relojes de alta resolución un `dt=1ms` real se confundía con same-frame.

**Problema:** `Date.now()` no es monotónico. En teoría, podría retroceder (ajuste de reloj del SO). Para una V1.0 debería migrarse a `performance.now()`.

### 2.5 Fraseo musical (WAVE 2086.3)

El **phrase envelope** (líneas 840-846) modula la amplitud según la posición dentro de una frase de 32 beats (8 compases):

```typescript
const phraseEnvelope = 0.925 + 0.075 * Math.sin(Math.PI * (phraseProgress - 0.15))
```

Esto da "respiración" al movimiento: arranque contenido (85%), expansión progresiva, clímax al 100%, relajación elegante. No es un LFO aleatorio — es **estructura musical**.

### 2.6 Transiciones suaves (WAVE 1155.1)

Cuando cambia el patrón, un LERP de 2 segundos con curva ease-out (`t*t*(3-2*t)`) interpola entre la posición anterior y la nueva. Esto previene el "salto brusco" entre `scan_x` y `ballyhoo`.

**Deuda técnica:** la transición usa `Date.now()` para calcular `elapsed`, no `performance.now()`. Si el renderer se congela (lag de UI), la transición se estira en tiempo real en vez de saltar al final.

---

## 3. IK & Spatial Tracking

### 3.1 El motor IK

`InverseKinematicsEngine.ts` es un módulo **puro y determinista** — sin estado, sin side-effects, sin aleatorios. Recibe un `Target3D` (metros) y un `IKFixtureProfile`, devuelve `{pan: DMX, tilt: DMX, reachable, antiFlipApplied}`.

**Algoritmo (líneas 180-264):**
1. Vector fixture→target en coordenadas de escenario: `dx, dy, dz`
2. Rotación al frame local del fixture: montaje + rotación personalizada
3. Detección de Gimbal Lock: si `horizontalDist < 0.001m` (1mm)
4. Cálculo de ángulos: `pan = atan2(local.x, local.z)`, `tilt = atan2(-local.y, horizontalDist)`
5. Anti-flip: resuelve el camino más corto de pan evitando giros de 540°
6. Aplicación de calibración + clamp

**Limitación confirmada:** El IK **no modela colisiones** entre fixtures. Si dos movers apuntan al mismo target desde ángulos opuestos, sus cabezas podrían colisionar físicamente. No hay collision detection en el pipeline.

**Limitación confirmada:** El sistema de coordenadas usa Y como altura (suelo=0), pero no hay validación de que el target no esté bajo el suelo (`y < 0`). Un operador puede enviar un target a `y = -2` y el IK calculará un tilt imposible.

### 3.2 Spatial Fanning (WAVE 2621-2622)

Cuando se controla un **grupo** de fixtures con un target espacial, el sistema puede dispersar los sub-targets:

- `converge`: todos apuntan al mismo punto (default)
- `line`: distribución lineal perpendicular al vector centroide→target
- `circle`: distribución en circunferencia alrededor del target

La implementación de `computeLineFanOffsets` (líneas 313-358) es matemáticamente correcta: calcula la perpendicular en el plano XZ al vector centroide→target, luego distribuye offsets equidistantes.

**Problema:** `computeCircleFanOffsets` (líneas 372-391) distribuye los fixtures uniformemente en un círculo **fijo alrededor del target**. Esto no es un "fan" en el sentido tradicional de iluminación (donde los beams se cruzan), sino una dispersión geométrica. El operador debe entender que el círculo está en el plano XZ (suelo), no en el plano XY (pared).

### 3.3 Puente UI → Backend (KineticsBridge)

`KineticsBridge.ts` usa **suscripciones Zustand selectivas** — no polling, no timers. Se activa solo ante cambios reales de estado.

**Arquitectura limpia:**
- Classic flush (pan/tilt/fan): debounced 16ms (aprox 60fps)
- Spatial flush (target 3D): debounced 20ms
- Pattern flush: debounced 30ms

**Problema de arquitectura:** El KineticsBridge corre en el **renderer process**. Los cambios de UI atraviesan IPC para llegar al main process donde vive el `NodeArbiter`. En un show con 30 fixtures, un gesto rápido en el XY pad genera ~60 IPC calls/segundo. Esto es aceptable para Electron, pero no es óptimo. Una V1.0 debería considerar batching de intents en un buffer de frame.

**Problema de arquitectura:** `hasProgrammerKineticManual()` (líneas 49-71) compara los overrides del `programmerStore` con el `movementStore` para decidir si el bridge debe "ceder" ante un motor superior (Programmer). Esta lógica vive en el renderer. Si el main process tiene estado diferente (race condition en IPC), el bridge puede tomar decisiones inconsistentes.

---

## 4. Hardware Protections

### 4.1 AetherSafetyMiddleware (WAVE 4557)

La capa de seguridad se divide en 3 fases:

#### Fase 0: Output Gate
`applyOutputGate()` (línea 152): cuando `outputEnabled=false`, bloquea **todos** los canales excepto KINETIC y nodos en override manual (L2). Esto permite mover los fixtures para posicionarlos aunque la salida general esté desarmada.

**Crítico:** El gate es **family-based**, no zona-based. No distingue entre `front` y `back` — si está bloqueado, está bloqueado todo.

#### Fase 1: Kinetic Velocity Clamp
`clampKineticVelocity()` (línea 173) y `clampKineticSingleAxis()` (línea 214):

```typescript
const maxPan  = Math.min(lim ? lim.pan  : KINETIC_DEFAULT_REV_PAN,  KINETIC_SAFETY_CAP_VEL) * dtSec
const maxTilt = Math.min(lim ? lim.tilt : KINETIC_DEFAULT_REV_TILT, KINETIC_SAFETY_CAP_VEL) * dtSec
```

Per-vibe REV limits (líneas 35-41):
- Techno: pan 340, tilt 320 DMX/s
- Latino: pan 520, tilt 420 DMX/s
- Rock: pan 300, tilt 200 DMX/s
- Chill: pan 12, tilt 8 DMX/s (!)
- Idle: pan 120, tilt 80 DMX/s

**Genialidad:** `Float32Array(4)` por nodo para tracking de velocidad **zero-alloc**. Los slots son: `[lastPan, lastTilt, lastTime, initFlag]`.

**Problema:** `TELEPORT_THRESHOLD_MS = 200` (línea 29). Si el tiempo entre frames supera 200ms (lag, tab en background, etc.), el clamp **se desactiva** y permite cualquier delta. Esto es correcto para evitar bloqueo permanente tras un resume, pero significa que un tab en background por >200ms puede causar un "teletransporte" violento al volver.

#### Fase 1b: DarkSpin
`checkDarkSpin()` (línea 283): durante el tránsito de una rueda de color mecánica, fuerza `dimmer=0` (blackout).

```typescript
const elapsed = now - s.transitStartMs
if (elapsed < s.transitDurationMs) return true  // Still in blackout
```

El tránsito se detecta por **cambio de valor DMX en el canal color_wheel**. El tiempo mínimo de tránsito viene del perfil del fixture (`minTransitionMs`), multiplicado por un `safetyMargin` de 1.1x.

**Crítico:** DarkSpin opera en **COLOR nodes**, pero la aplicación del blackout ocurre en **IMPACT nodes** (donde vive el dimmer). El `NodeResolver` ejecuta un **cross-node sweep** (`_applyDarkSpinCrossNodeSweep`, línea 732) que recorre todos los dispositivos cuyo nodo COLOR está en tránsito y fuerza `dimmer=0` en el nodo IMPACT correspondiente.

**Deuda técnica:** `_darkSpinActiveDevices` (línea 220) es un `Set<DeviceId>` que suprime log spam. Se limpia cada frame. Es un hack pragmático pero el mecanismo de log suppression debería estar centralizado, no en el resolver.

#### Fase 2: Airbag
`applyAirbag()` (línea 252): evita que los valores DMX toquen los extremos 0 o 255:

```typescript
if (dmxValue < PAN_AIRBAG_MARGIN) return PAN_AIRBAG_MARGIN      // 5
if (dmxValue > 255 - PAN_AIRBAG_MARGIN) return 255 - PAN_AIRBAG_MARGIN  // 250
```

**Genialidad:** El margen de 5 DMX (~10° en pan de 540°) evita que el motor mecánico golpee los topes físicos. Es una protección real y necesaria.

### 4.2 HarmonicQuantizer (referenciado, no auditado en profundidad)

El `NodeResolver` menciona el uso de `HarmonicQuantizer` para ruedas de color mecánicas. Esto convierte un color RGB arbitrario al slot de rueda más cercano. No fue auditado en esta pasada.

---

## 5. Architectural Flaws & V1.0 Roadmap

### 5.1 Deuda técnica confirmada

#### A. `Date.now()` en hot path (crítico)
`VibeMovementManager` usa `Date.now()` para:
- `lastUpdate` (detección de mismo frame)
- `time` (acumulador de tiempo)
- `transitionStartTime` (LERP de patrón)

`Date.now()` no es monotónico. Un ajuste de reloj del SO puede retroceder el tiempo, causando `dt` negativo o transiciones que se congelan. **Migración obligatoria a `performance.now()` para V1.0.**

#### B. Frame-twice guard es frágil
```typescript
const isSameFrame = (now - this.lastUpdate) < 1
```

Si el main process se congela por >1ms entre llamadas (GC, IPC lento), la segunda llamada de un fixture que realmente debería ser el mismo frame se trata como un frame nuevo. Esto corrompe `barCount`, `frameCount`, y acumuladores.

**Fix recomendado:** Usar un contador de frame explícito pasado desde `TitanEngine` en vez de inferir el frame desde timestamps.

#### C. IK sin validación de dominio
El `solve()` del IK no valida:
- Target bajo el suelo (`y < 0`)
- Target fuera del alcance mecánico (solo marca `reachable=false`)
- Fixture sin posición definida

Un target `{x:0, y:-5, z:0}` produce un `tilt` que apunta al suelo. El sistema debería clampar `y >= 0` o al menos warnear.

#### D. KineticsBridge en renderer process
El bridge hace 4 suscripciones Zustand + 3 debounces + 3 flushes asíncronos por cambio de UI. En un show grande, esto genera:
- 1 IPC call por fixture por gesto (setManualOverrides)
- 1 IPC call por grupo para spatial (applySpatialTarget)
- Potenciales race conditions entre renderer y main state

**Fix recomendado para V1.0:** Mover el KineticsBridge al main process como un plugin del `TitanEngine`. La UI envía **comandos semánticos** ("mover fixture 3 a target X") en vez de **valores DMX**.

#### E. VibeMovementManager es un singleton
```typescript
export const vibeMovementManager = new VibeMovementManager()
```

Esto significa que **no puede haber dos vibes simultáneas**. Si el sistema necesita controlar movers de forma diferente en diferentes zonas (ej: techno en front, latino en back), el VMM no puede. Es un motor centralizado.

**Fix recomendado para V1.0:** Permitir instancias múltiples de `VibeMovementManager` por zona o por grupo de fixtures.

#### F. Falta de collision detection entre fixtures
Dos movers pueden recibir targets IK que los hagan colisionar físicamente. No hay ningún sistema que prevenga esto. En instalaciones con movers muy juntos (truss compacto), esto es un riesgo real de daño mecánico.

#### G. `VibeMovementPresets` usa strings como IDs de vibe
```typescript
export const MOVEMENT_PRESETS: Record<string, MovementPreset> = {
  'techno-club': { ... }
}
```

No hay type safety en el lookup. `getMovementPreset('techno-clud')` (typo) cae silenciosamente en `idle`. Debería ser un enum o un branded type.

#### H. El VMM no sabe cuántos fixtures hay hasta que le pasan `totalFixtures`
El `generateIntent()` recibe `fixtureIndex` y `totalFixtures` como parámetros. Esto significa que el VMM no tiene modelo interno del rig. Si un fixture se desconecta, el `totalFixtures` puede cambiar y los índices de snake/mirror se desfasan.

#### I. `currentPosition` del nodo kinetico se muta en resolve()
```typescript
node.currentPosition.pan = safePan / 255
node.currentPosition.tilt = safeTilt / 255
```

Esto es una mutación de estado en el hot path de resolución. Es necesario para el anti-flip del IK, pero viola el principio de inmutabilidad del `NodeResolver`. Si el resolve() falla parcialmente, `currentPosition` puede quedar inconsistente.

### 5.2 Cuello de botella actual

**El cuello más grande es el IPC renderer→main para manual overrides.** Cada vez que el operador arrastra el XY pad:

1. React event → `onChange` → `movementStore.setPanTilt()`
2. Zustand notify → `KineticsBridge._scheduleClassicFlush()`
3. Debounce 16ms → `_flushClassic()`
4. `window.lux.aether.setManualOverrides()` → IPC
5. `AetherIPCHandlers` → `NodeArbiter` → L2 intent
6. Frame loop → `NodeResolver.resolve()` → DMX

Esto son ~20ms de latencia mínima. Para un control en tiempo real, es aceptable pero no ideal. En V1.0, el input manual debería ir directamente al `NodeArbiter` sin pasar por IPC.

### 5.3 Cosas que están bien y no tocar

- ✅ `phaseAccumulator` monotónico: no tocar, funciona.
- ✅ `Float32Array(4)` para tracking de velocidad: zero-alloc, correcto.
- ✅ `AetherSafetyMiddleware` 3-phase architecture: limpia y extensible.
- ✅ IK puro y determinista: sin estado, sin side-effects.
- ✅ `botstep` con φ (golden ratio): distribución cuasi-aleatoria determinista.
- ✅ Anti-flip con shortest-path: evita giros de 540°.
- ✅ DarkSpin cross-node sweep: arquitectura correcta para blackout durante tránsito de rueda.
- ✅ `VIBE_CONFIG` con `panScale`/`tiltScale` separados: permite asimetría real por hardware.

---

## 6. Objective Evaluation

### 6.1 Veredicto técnico puro

**El motor de movimiento de LuxSync es técnicamente sólido, con momentos de genialidad matemática, pero tiene deuda técnica crítica que impide marcarlo como "producción-ready" para una V1.0.**

**Fortalezas reales (verificables):**
1. **El acumulador de fase monotónico** eliminó completamente el "epilepsia mecánica" que plagaba versiones anteriores. Es la corrección más importante del subsistema.
2. **Las curvas de Lissajous** (`figure8`, `cadera_libre`) son implementaciones matemáticamente correctas, no aproximaciones.
3. **El Gearbox** limita la amplitud por velocidad de hardware — un feature que muchos softwares comerciales no tienen.
4. **DarkSpin** es una protección real para ruedas mecánicas, no un "dimmer fade" genérico.
5. **El IK** es puro, determinista, y con anti-flip. No usa librerías externas pesadas.
6. **Airbag de 5 DMX** es una protección mecánica real.

**Debilidades reales (bloqueantes para V1.0):**
1. **`Date.now()` en hot path.** Bloqueante. Debe migrarse a `performance.now()`.
2. **KineticsBridge en renderer.** Cuello de botella de IPC + race conditions.
3. **Sin collision detection entre fixtures.** Riesgo mecánico en rigs densos.
4. **VMM singleton.** No permite multi-vibe por zona.
5. **IK sin validación de dominio.** Targets bajo el suelo son aceptados sin protesta.
6. **Frame-twice guard frágil.** Basado en timestamps en vez de frame counter explícito.

### 6.2 Comparación implícita (sin humo)

No vamos a compararnos con MA3, Onyx, o ChamSys porque no tenemos acceso a su código fuente. Lo que sí podemos decir es:

- LuxSync tiene **un sistema de patrones procedurales más sofisticado** que la mayoría de softwares de lighting comercial, donde el movimiento procedural suele ser "chase", "circle", y "random".
- LuxSync tiene **IK integrado** en el pipeline DMX, lo cual no es común en softwares de esta categoría (normalmente es pan/tilt directo).
- LuxSync tiene **protecciones de hardware** (DarkSpin, Airbag, REV limits) que muchos softwares comerciales ni siquiera exponen al usuario.
- LuxSync **no tiene collision detection**, algo que sí tienen algunos visualizadores 3D avanzados (Capture, WYSIWYG).

### 6.3 Nota final

El sistema de movimiento de LuxSync es el resultado de **años de iteración forense** (WAVE 2088.9, WAVE 2213 Fénix, WAVE 4703). Cada WAVE que se menciona en los comentarios representa una corrección de un bug real que ocurrió en un show. El código está lleno de cicatrices que cuentan la historia de un sistema que ha aprendido a la fuerza.

Para V1.0, las cicatrices deben convertirse en arquitectura. Los guards temporales deben convertirse en contratos de tipo. Los singletons deben convertirse en instancias configurables. Y `Date.now()` debe desaparecer del hot path para siempre.

**Puntaje técnico: 7.2/10**
- Matemáticas: 9/10
- Arquitectura: 6/10
- Seguridad hardware: 8/10
- Robustez producción: 5/10
- Deuda técnica: 6/10 (mejorable)

---

*Fin del informe. No se encontraron backdoors. No se encontraron memory leaks obvios. Se encontraron 6 bugs arquitectónicos y 1 temporal (Date.now()).*
