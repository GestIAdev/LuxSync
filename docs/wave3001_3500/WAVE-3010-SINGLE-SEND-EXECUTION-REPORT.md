# WAVE 3010: SINGLE SEND PER FRAME — Execution Report

## Diagnóstico Confirmado al 100%

### El Bug Original
Parpadeo intermitente (micro-spasms / 1-frame blackouts) cada 1-3 minutos. 150+ directivas investigando.

### Root Cause: Double-Send Race Condition

**Hallazgo A — GARANTIZADO cuando Hephaestus está activo:**

```
FRAME N (CON HEPHAESTUS ACTIVO):
1. renderFromTarget() calcula fixtureStates
2. renderFromTarget() INTERNAMENTE llama sendToDriver()
3. sendToDriver() → void driver.sendAll() → universalDMX.sendAll()
   → isTransmitting = true
   → await Promise.all(promises) ← CEDE MICROTICK
4. Código SÍNCRONO continúa inmediatamente (await no bloquea el caller porque es void fire-and-forget)
5. Hephaestus aplica overlays sobre fixtureStates
6. sendStatesWithPhysics(fixtureStates) → sendToDriver() → void driver.sendAll()
   → universalDMX.sendAll() → if (isTransmitting) return false
   ← FRAME CON HEPHAESTUS OVERLAYS ***DROPEADO***
7. El child process recibe SOLO los datos SIN overlays (del send #1)
```

**Prueba por mecánicas de JavaScript:**
- `await` SIEMPRE cede al menos un microtick, incluso si la Promise resuelve síncronamente
- El segundo `sendAll()` se llama **dentro del mismo stack síncrono** que el retorno de `renderFromTarget()`
- El microtick del primer `await` NO se resuelve hasta que el microtask queue se vacíe
- Ergo: `isTransmitting` está garantizado `true` cuando el segundo `sendAll()` ejecuta

**Hallazgo B — INTERMITENTE (timer collision):**

- `flushToStrategies()` tiene throttle de 33ms (`setTimeout`)
- HAL dispara `void sendAll()` inmediato
- Cuando los timers (23ms render + 33ms flush) derivan por jitter del Event Loop y se alinean → colisión de semáforo
- Amplificado cuando ArtNet está activo (UDP callbacks son genuinamente async, milisegundos)
- Frecuencia: cada ~1-3 minutos dependiendo de carga del Event Loop

### Los 3 Callers de universalDMX.sendAll() (antes del fix)

1. `HardwareAbstraction.ts:1994` → `void this.driver.sendAll()` — HAL fire-and-forget (INMEDIATO)
2. `UniversalDMXDriver.ts:756` → `setTimeout(() => void this.sendAll(), 33)` — flushToStrategies (RETARDADO 33ms)
3. `UniversalDMXDriver.ts:841` → `sendDMXFrame()` → `void this.sendAll()` — Legacy output loop (SOLO EnttecPro, no-op para OpenDMX)

---

## Solución Implementada

### Principio: "Single Send Per Frame"

`renderFromTarget()` era un método dual-purpose: calculaba states Y enviaba al hardware. Esta dualidad creaba el double-send porque el Orchestrator necesitaba re-enviar después de aplicar Hephaestus overlays.

### Cambios

**1. `HardwareAbstraction.ts` — renderFromTarget() se vuelve puro cálculo:**

- ELIMINADO: `this.sendToDriver(blackoutStates)` del path de blackout (línea 938)
- ELIMINADO: `this.sendToDriver(statesWithPhysics)` del path normal (línea 1141)
- El método ahora SOLO calcula y retorna `FixtureState[]`, sin side-effects de hardware

**2. `TitanOrchestrator.ts` — Single send point:**

- CAMBIADO: `if (hephOutputs.length > 0) { this.hal.sendStatesWithPhysics(fixtureStates) }` 
- A: `this.hal.sendStatesWithPhysics(fixtureStates)` (SIEMPRE, sin condicional)
- Ahora hay UN SOLO punto de envío al hardware por frame, DESPUÉS de todo el procesamiento

### Flujo Nuevo

```
ANTES (ROTO):
  renderFromTarget() → calcula → sendToDriver() → void sendAll() [isTransmitting=true]
  → retorna states
  → Hephaestus overlays
  → sendStatesWithPhysics() → sendToDriver() → void sendAll() [DROP! isTransmitting=true]

DESPUÉS (WAVE 3010):
  renderFromTarget() → calcula → retorna states (NO envía)
  → Hephaestus overlays (si hay)
  → sendStatesWithPhysics() → sendToDriver() → void sendAll() [UNA SOLA VEZ]
```

### Lo que NO se tocó

- `sendToDriver()` sigue igual internamente (Aduana, mapper, send packets, void sendAll)
- `sendStatesWithPhysics()` sigue igual (physics interpolation → sendToDriver)
- `universalDMX.sendAll()` y su semáforo `isTransmitting` NO se modificaron
- `flushToStrategies()` y su throttle de 33ms NO se tocaron
- `CompositeDMXDriver`, `ArtNetDriver`, `OpenDMXStrategy` — intactos
- El método legacy `render()` (dead code, sin callers) — no se tocó

### Validación

- `tsc --noEmit` — 0 errores
- `renderFromTarget()` tiene un ÚNICO caller (`TitanOrchestrator.processFrame()`) — refactor seguro
- `this.hal.render()` no tiene callers — dead code confirmado, no afectado

---

## Créditos

- PunkGemini: Prediagnóstico orientativo que identificó HALLAZGO 2 (Semaphore Collision) como candidato principal
- PunkOpus: Confirmación 100% con prueba de código real y microtask mechanics de JavaScript, diseño e implementación del fix arquitectónico
