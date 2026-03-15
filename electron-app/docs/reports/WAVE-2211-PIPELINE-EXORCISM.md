# 🔬 WAVE 2211 — THE PIPELINE EXORCISM

**Fecha:** 2026-03-14  
**Estado:** ✅ 5/5 CIRUGÍAS COMPLETADAS — 127/127 TESTS PASS  
**Archivos modificados:**
- `src/core/orchestrator/TitanOrchestrator.ts` (Cirugías #1, #2, #4)
- `src/hal/HardwareAbstraction.ts` (Cirugías #3, #5)

---

## 🎯 PROBLEMA

Las matemáticas del VMM (VibeMovementManager) estaban probadamente correctas (127/127 tests). Sin embargo, el movimiento visual seguía siendo:
- **Tosco y con tirones** (stuttering/jitter)
- **Chill-lounge haciendo patrones erráticos** a velocidad de rock
- **Movimientos robóticos** en vez de fluidos

**Conclusión del diagnóstico:** Los 5 bugs estaban DOWNSTREAM del VMM — en el pipeline que transporta las coordenadas perfectas desde el motor hasta el DMX y la UI.

---

## 🩸 BUGS ENCONTRADOS + CIRUGÍAS APLICADAS

### CIRUGÍA #1: THE ASYNC STAMPEDE (CRÍTICA)

**Bug:** `processFrame()` es `async` (contiene `await engine.update()` → `await selene.process()`), pero se dispara con `setInterval(16)` que NO espera la resolución del Promise. Si un frame tarda >16ms, múltiples `processFrame()` se ejecutan en paralelo, corrompiendo:
- `HAL.measurePhysicsDeltaTime()` → dt se vuelve ~0ms para el frame intruso
- `FixturePhysicsDriver` positions → dos frames escribiendo simultáneamente
- `MasterArbiter` state → dos `arbitrate()` con intents diferentes

No existía ningún guard (`isProcessing`, `frameLock`, etc.).

**Fix:** Añadido `isProcessingFrame` boolean guard con `try/finally`:
```
if (this.isProcessingFrame) return  // Skip — previous frame still running
this.isProcessingFrame = true
try { ... } finally { this.isProcessingFrame = false }
```

### CIRUGÍA #2: THE IPC FLOOD (ALTA)

**Bug:** `this.onBroadcast(truth)` se llamaba en CADA frame (~60fps). El objeto SeleneTruth completo (~3-5KB con FFT array + fixtures + sensory) se serializaba via Electron IPC 60×/segundo. El frontend canvas solo renderiza a 30fps, pero React procesaba 60 state updates/sec → GC pressure + render thrashing.

**Fix:** Throttle a 30fps: `if (this.onBroadcast && this.frameCount % 2 === 0)`. El DMX real sigue a 60fps — solo la visualización UI se throttlea.

### CIRUGÍA #3: THE FAKE BEATPHASE (MEDIA-ALTA)

**Bug:** HAL calculaba su propio `beatPhase` con BPM hardcodeado:
```
const beatDuration = 0.5  // ← HARDCODED 120 BPM
const beatPhase = (time % 0.5) / 0.5  // ← FAKE: 2 pulsos/sec siempre
```
Este fake beatPhase alimentaba `applyDynamicOptics()`, que para pop-rock disparaba focus punch en `beatPhase < 0.15`. Para chill-lounge, aunque el efecto es solo zoom breathing, la lógica corría al ritmo de un metrónomo falso de 120 BPM.

**Fix 2 partes:**
1. Añadido `beatPhase?: number` y `bpm?: number` a `AudioMetrics` interface
2. Orchestrator inyecta el beatPhase REAL del PLL/Worker en `halAudioMetrics`
3. HAL usa `audio.beatPhase ?? 0` en vez del cálculo hardcodeado

Eliminados DOS puntos de fake beatPhase: `renderFromTarget()` y `render()` legacy.

### CIRUGÍA #4: THE TRUTH OBJECT BLOAT (MEDIA)

**Bug:** Cada frame creaba `new Array(256).fill(0)` para el campo FFT del SeleneTruth. A 30fps (post-throttle): 256 floats × 30fps = 7,680 allocations/sec de basura.

**Fix:** Buffer pre-allocado `Object.freeze(new Array(256).fill(0))` como propiedad de clase. Reutilizado en cada broadcast — zero GC del FFT.

### CIRUGÍA #5: THE PHYSICS PROFILE RE-INJECTION (BAJA-MEDIA)

**Bug:** En `renderFromTarget()`, CADA frame, para CADA fixture moving:
```
const profile = this.getFixtureProfileCached(fixture)
const driverProfile = this.translateToDriverPhysicsProfile(rawPhysics)
this.movementPhysics.updatePhysicsProfile(fixtureId, driverProfile)
```
`translateToDriverPhysicsProfile()` crea un nuevo objeto `DriverPhysicsProfile` cada vez. Con 8 movers: 480 objetos/segundo para inyectar un profile que NUNCA cambia.

**Fix:** `Set<string> injectedPhysicsProfiles` cache. Solo inyecta en el primer encuentro de cada fixture. Cache se invalida en `setVibe()` (cambio de vibe puede cambiar cómo interactúan los rev limits con las capabilities del fixture). Aplicado en ambos paths: `renderFromTarget()` y `render()`.

---

## 📊 IMPACTO ESTIMADO

| Métrica | Antes | Después |
|---|---|---|
| processFrame() concurrentes | 0-3 simultáneos | 1 máximo (guard) |
| IPC broadcasts/sec | ~60 | ~30 (throttle 50%) |
| Truth serializations/sec | ~60 × 3-5KB = ~240KB/s | ~30 × 3-5KB = ~120KB/s |
| FFT array allocations/sec | ~60 × 256 = 15,360 | 0 (pre-allocated) |
| Profile translations/sec | ~60 × N_movers | Solo en primer frame + vibe change |
| HAL beatPhase accuracy | Fake 120 BPM siempre | Real PLL/Worker phase |

---

## 🧪 VERIFICACIÓN

```
Test Files  2 passed (2)
Tests       127 passed (127)
Duration    1.10s
```

---

## 🔮 PIPELINE POST-EXORCISM

```
VMM output (-1..+1) — PERFECTO (127 tests)
  │
  ├─ TitanEngine (*0.5 + 0.5 → 0..1) — sin cambios
  ├─ MasterArbiter (*255 → 0..255) — sin cambios
  │
  ├─ TitanOrchestrator.processFrame() 
  │     🔒 ASYNC STAMPEDE GUARD (Cirugía #1)
  │     🚿 IPC THROTTLE 30fps (Cirugía #2)
  │     🗑️ PRE-ALLOC FFT BUFFER (Cirugía #4)
  │     🎵 REAL BEAT PHASE injection (Cirugía #3)
  │
  ├─ HAL.renderFromTarget()
  │     🎵 REAL beatPhase for optics (Cirugía #3)
  │     🗑️ PROFILE CACHE (Cirugía #5)
  │
  └─ Frontend: 30fps canvas (ya estaba bien)
```
