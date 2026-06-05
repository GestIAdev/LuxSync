# WAVE 5033 — HYPERION & THEIA GHOSTS
## Fase 2: Auditoría Frontend (UI / Renderer / Worker)

**Autor:** Kimi (Zero-Alloc SWAT Team)  
**Fecha:** 2026-06-05  
**Estado:** PLAN DE ACCIÓN ACTIVO

---

## 1. RESUMEN EJECUTIVO

Tras el exterminio de 13 fugas de memoria en el backend (DMX driver, NodeResolver, Arbiter, TickEngine, SafetyMiddleware), el foco se traslada al **frontend renderer** (Hyperion 3D / Tactical 2D) y al **pipeline Theia/Theta**.

Se han detectado **3 categorías de fugas**:

| Categoría | Severidad | Frecuencia | Archivos Afectados |
|-----------|-----------|------------|-------------------|
| **A. TacticalCanvas pump loop** | 🔴 CRÍTICA | 60 fps | `TacticalCanvas.tsx` |
| **B. Hyperion 3D per-frame literals** | 🟡 ALTA | 60 fps | `HyperionMovingHead3D.tsx` *(parcial)* |
| **C. ThetaOrchestrator fantasma** | 🟡 ALTA | Boot-time | `TrinityProvider.tsx`, `ThetaOrchestrator.ts` |

---

## 2. HALLAZGOS DETALLADOS

### 🔴 A. TACTICALCANVAS — EL BOMBARDERO DEL GC

**Archivo:** `src/components/hyperion/views/tactical/TacticalCanvas.tsx`

El `requestAnimationFrame` loop (`pump`) corre a 60 fps y acumula **tres alocaciones por frame**:

#### A1. `new Float32Array(fixtureCount * FLOATS_PER_FIXTURE)` en `packFrameData`
- **Línea:** ~137
- **Código:** `const buffer = new Float32Array(fixtureCount * FLOATS_PER_FIXTURE)`
- **Impacto:** Con 50 fixtures → 500 floats ≈ 2 KB por frame → **120 KB/s** de basura.
- **Fix:** Pre-allocar un `_frameBufferRef` que crece hasta `maxFixtureCount` y mutarlo con `packFrameDataInto()`.

#### A2. `currentFixtures.map(f => f.id)` — array de strings
- **Línea:** ~652
- **Código:** `const fixtureIds = currentFixtures.map(f => f.id)`
- **Impacto:** Nuevo array de `N` strings cada frame.
- **Fix:** Pasar `currentFixtures[]` directamente a `packFrameDataInto()` y acceder a `.id` dentro del `for` loop.

#### A3. Objeto literal `msg: WorkerInboundMessage = { type: 'FRAME', ... }`
- **Línea:** ~666
- **Impacto:** Nuevo objeto literal ~60 fps.
- **Fix:** Pre-allocar `_msgTemplateRef = { type: 'FRAME' }` y mutar campos in-place (`msg.frameNumber = ...`).

---

### 🟡 B. HYPERION 3D — USEFRAME LITERALS

**Archivo:** `src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx`

#### B1. `lastValidStateRef.current = { dimmer, pan, tilt }` — YA PARCHEADO (Fix #14)
- **Estado:** ✅ Se convirtió a objeto pre-allocado mutado in-place.

#### B2. Posibles fugas en `.some()` closures
- **Línea:** potencial en `AetherUIProjector.ts` con funciones arrow inline en `.some()`.
- **Nota:** V8 puede optimizar closures sin capturas, pero no es garantía. Pendiente de validar con profiler.

#### B3. React `.map()` en `VisualizerCanvas.tsx`
- **Línea:** ~308, ~321, ~334
- **Código:** `{movingHeads.map(fixture => <HyperionMovingHead3D ... />)}`
- **Impacto:** Array de elementos React en cada render (no en `useFrame`, pero React re-renderiza bajo ciertas condiciones).
- **Fix:** Usar `React.memo` + `useMemo` para estabilizar los arrays si aún no están.

---

### 🟡 C. THEIA / THETA — FANTASMAS Y RESIDUOS

#### C1. `ThetaOrchestrator` instanciado en `TrinityProvider.tsx` aunque está DESACTIVADO
- **Archivo:** `src/providers/TrinityProvider.tsx` (líneas 624-642)
- **Código:**
  ```ts
  if (powerState === 'ONLINE' && !thetaRef.current) {
    const theta = new ThetaOrchestrator()
    thetaRef.current = theta
    const offscreen = new OffscreenCanvas(1920, 1080)
    theta.attachOffscreenCanvas(offscreen)
    theta.start().catch(...)
  }
  ```
- **Problema:** Aunque `ENABLE_THETA_ORCHESTRATOR = false` (WAVE 4933.1) bloquea el `spawnWorker()` dentro de `start()`, la **instancia completa** de `ThetaOrchestrator` y el **OffscreenCanvas** de 1920×1080 (≈ 8 MB de memoria GPU) se crean igual.
- **Fix:** Agregar un guard `if (!ENABLE_THETA_ORCHESTRATOR) return` **antes** de la creación de la instancia, o comentar/eliminar el bloque entero.

#### C2. `_theiaVideoRenderer.tick()` en hot path a 44 Hz
- **Archivo:** `src/core/orchestrator/tick/TickEngine.ts` (líneas 992-994)
- **Código:**
  ```ts
  if (this._theiaVideoRenderer !== null) {
    this._theiaVideoRenderer.tick()
  }
  ```
- **Estado actual:** `_theiaVideoRenderer` es `null` (nadie llama `attachTheiaRenderer()`). El `if` es false, pero se evalúa cada frame.
- **Fix:** No urgente (no alloca), pero se puede eliminar el campo del hot path si Theia nunca se rehabilita.

#### C3. TheiaBridgeManager conserva código de attach
- **Archivo:** `src/core/orchestrator/theia/TheiaBridgeManager.ts`
- **Estado:** `attachTheiaRenderer` crea `new TheiaVideoRenderer(...)`. Nadie lo llama desde fuera.
- **Acción:** Documentar como "código muerto" o marcar con `@deprecated`.

---

## 3. PLAN DE ACCIÓN — PASO A PASO

### Fase 2A: TacticalCanvas Zero-Alloc (CRÍTICO)

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2A.1 | Pre-allocar `_frameBufferRef: Float32Array` en `TacticalCanvas` y mutarlo | `TacticalCanvas.tsx` | 🟢 Bajo |
| 2A.2 | Reescribir `packFrameData` → `packFrameDataInto(buffer, fixtures, ...)` | `TacticalCanvas.tsx` | 🟡 Medio (cambio de firma) |
| 2A.3 | Eliminar `fixtureIds.map()` — pasar `currentFixtures[]` directo | `TacticalCanvas.tsx` | 🟢 Bajo |
| 2A.4 | Pre-allocar `_msgTemplateRef` y mutar campos in-place antes de `postMessage` | `TacticalCanvas.tsx` | 🟢 Bajo |
| 2A.5 | Verificar que `postMessage` sin transfer sigue funcionando (o implementar pool de 2 buffers con transfer) | `TacticalCanvas.tsx` + worker | 🟡 Medio |

### Fase 2B: Hyperion 3D Sweep

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2B.1 | Verificar que `HyperionMovingHead3D` no tenga más literales en `useFrame` | `HyperionMovingHead3D.tsx` | 🟢 Bajo |
| 2B.2 | Auditar `HyperionPar3D.tsx` y `HyperionTruss.tsx` por literales/new en render/useFrame | `HyperionPar3D.tsx`, `HyperionTruss.tsx` | 🟢 Bajo |
| 2B.3 | Revisar `VisualizerCanvas.tsx` — `.map()` en JSX es React-standard pero puede estabilizarse con `useMemo` | `VisualizerCanvas.tsx` | 🟢 Bajo |

### Fase 2C: Theia / Theta Exorcismo

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2C.1 | Agregar guard temprano en `TrinityProvider.tsx` para NO crear `ThetaOrchestrator` ni `OffscreenCanvas` si `ENABLE_THETA_ORCHESTRATOR === false` | `TrinityProvider.tsx` | 🟡 Medio (evita instancia fantasma) |
| 2C.2 | Verificar que no haya listeners IPC/EventEmitters de Theia activos en `main.ts` / `index.ts` | `main.ts`, `index.ts` | 🟢 Bajo |
| 2C.3 | Opcional: eliminar `_theiaVideoRenderer.tick()` del hot path en `TickEngine.ts` si se confirma que Theia no volverá en esta versión | `TickEngine.ts` | 🟢 Bajo |

---

## 4. ESTADO DE LOS FIXES YA APLICADOS (Backend)

| Fix | Archivo | Descripción | Estado |
|-----|---------|-------------|--------|
| #1 | `EnttecProStrategy.ts` | Pre-alloc `_packetBuf` Uint8Array | ✅ Committed |
| #2 | `OpenDMXStrategy.ts` | Pre-alloc `_ipcChannels` + `_ipcPayload` | ✅ Committed |
| #3 | `NodeResolver.ts` | Pre-alloc `_packetArray` (Array.from→for) | ✅ Committed |
| #4 | `UniversalDMXDriver.ts` | Pre-alloc `_sendPromises` | ✅ Committed |
| #5 | `TickEngine.ts` | Verify hotFrame throttling | ✅ OK (ya estaba) |
| #6 | `transientStore.ts` | Pre-alloc `_hotFrameExistingById` Map | ✅ Committed |
| #7 | `HarmonicQuantizer.ts` | In-place mutation (no spread) | ✅ Committed |
| #8 | `NodeResolver.ts` | Cache wheelProfile wrapper | ✅ Committed |
| #9 | `InverseKinematicsEngine.ts` + `NodeResolver.ts` | `solveInto()` zero-alloc IK | ✅ Committed |
| #10 | `TickEngine.ts` | `OMNI_SOURCES_STALENESS` module constant | ✅ Committed |
| #11 | `AetherSafetyMiddleware.ts` + `NodeResolver.ts` | `clampKineticVelocityInto()` scratch | ✅ Committed |
| #12 | `NodeArbiter.ts` | `_manualOverrideNodeIdsScratch` | ✅ Committed |
| #13 | `NodeResolver.ts` | Pre-alloc RGBW/CMY profile objects | ✅ Committed |
| #14 | `HyperionMovingHead3D.tsx` | Pre-alloc `lastValidStateRef` scratch | ✅ Committed |

---

## 5. RECOMENDACIONES AL ARQUITECTO

1. **Prioridad inmediata:** Implementar **Fase 2A** (TacticalCanvas pump loop). El `new Float32Array` a 60 fps es la fuente más densa de basura en el frontend.
2. **ThetaOrchestrator:** No esperar. Comentar o guardar la instanciación en `TrinityProvider.tsx` para evitar que el canvas fantasma consuma memoria GPU.
3. **Testing:** Tras cada fix, ejecutar `npx tsc --noEmit` y hacer una prueba de stress de 5 minutos con el profiler de Chrome DevTools → Memory → Allocation instrumentation on timeline. Buscar picos de `Float32Array`, `Object`, y `Array` coincidiendo con los frames.

---

*Documento generado automáticamente por Kimi durante WAVE 5033.*
