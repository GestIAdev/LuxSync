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
- **Fix:** ✅ **APLICADO** — Pre-allocado `frameBufferRef` que crece hasta `maxFixtureCount` y mutado con `packFrameDataInto()`. El `new Float32Array` ya NO se ejecuta cada frame.

#### A2. `currentFixtures.map(f => f.id)` — array de strings
- **Línea:** ~652
- **Código:** `const fixtureIds = currentFixtures.map(f => f.id)`
- **Impacto:** Nuevo array de `N` strings cada frame.
- **Fix:** ✅ **APLICADO** — `packFrameDataInto()` recibe `currentFixtures[]` directamente; `.map()` eliminado. Se accede a `.id` dentro del `for` loop.

#### A3. Objeto literal `msg: WorkerInboundMessage = { type: 'FRAME', ... }`
- **Línea:** ~666
- **Impacto:** Nuevo objeto literal ~60 fps.
- **Fix:** ✅ **APLICADO** — Pre-allocado `msgTemplateRef: WorkerMsgFrame` mutado in-place (`msg.frameNumber = ...`) antes de `postMessage`. El objeto literal ya NO se crea cada frame.

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
- **Fix:** ✅ **APLICADO** — Exportado `ENABLE_THETA_ORCHESTRATOR` desde `ThetaOrchestrator.ts`, agregado guard temprano en `TrinityProvider.tsx` useEffect. La instancia y el OffscreenCanvas ya NO se crean cuando Theta está desactivado.

#### C2. `_theiaVideoRenderer.tick()` en hot path a 44 Hz
- **Archivo:** `src/core/orchestrator/tick/TickEngine.ts` (líneas 992-994)
- **Código:**
  ```ts
  if (this._theiaVideoRenderer !== null) {
    this._theiaVideoRenderer.tick()
  }
  ```
- **Estado actual:** `_theiaVideoRenderer` es `null` (nadie llama `attachTheiaRenderer()`). El `if` es false, pero se evalúa cada frame.
- **Fix:** ✅ **APLICADO** — Eliminado getter `_theiaVideoRenderer` de `TickEngine.ts` y removido el bloque `if (this._theiaVideoRenderer !== null) { tick() }` del hot path a 44Hz.

#### C3. TheiaBridgeManager / TitanOrchestrator conservan código muerto de Theia
- **Archivo:** `src/core/orchestrator/theia/TheiaBridgeManager.ts` + `TitanOrchestrator.ts`
- **Estado:** `attachTheiaRenderer` crea `new TheiaVideoRenderer(...)`. Nadie lo llama desde fuera.
- **Fix:** ✅ **APLICADO** — Eliminados métodos `attachTheiaRenderer` / `detachTheiaRenderer` de `TitanOrchestrator.ts`, campo `_theiaVideoRenderer`, getter del `InternalContext`, e import del módulo.

---

## 3. PLAN DE ACCIÓN — PASO A PASO

### Fase 2A: TacticalCanvas Zero-Alloc (CRÍTICO)

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2A.1 | Pre-allocar `_frameBufferRef: Float32Array` en `TacticalCanvas` y mutarlo | `TacticalCanvas.tsx` | ✅ **HECHO** |
| 2A.2 | Reescribir `packFrameData` → `packFrameDataInto(buffer, fixtures, ...)` | `TacticalCanvas.tsx` | ✅ **HECHO** |
| 2A.3 | Eliminar `fixtureIds.map()` — pasar `currentFixtures[]` directo | `TacticalCanvas.tsx` | ✅ **HECHO** |
| 2A.4 | Pre-allocar `_msgTemplateRef` y mutar campos in-place antes de `postMessage` | `TacticalCanvas.tsx` | ✅ **HECHO** |
| 2A.5 | Verificar que `postMessage` sin transfer sigue funcionando | `TacticalCanvas.tsx` + worker | ✅ **HECHO** |

### Fase 2B: Hyperion 3D Sweep

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2B.1 | Verificar que `HyperionMovingHead3D` no tenga más literales en `useFrame` | `HyperionMovingHead3D.tsx` | ✅ **HECHO** (Fix #14 previo) |
| 2B.2 | Auditar `HyperionPar3D.tsx` y `HyperionTruss.tsx` por literales/new en render/useFrame | `HyperionPar3D.tsx`, `HyperionTruss.tsx` | ✅ **HECHO** — sin fugas per-frame (todo en `useMemo`) |
| 2B.3 | Revisar `VisualizerCanvas.tsx` — `.map()` en JSX es React-standard | `VisualizerCanvas.tsx` | ✅ **HECHO** — `.map()` en render, no en `useFrame`; aceptable |

### Fase 2C: Theia / Theta Exorcismo

| Paso | Tarea | Archivo(s) | Riesgo |
|------|-------|-----------|--------|
| 2C.1 | Agregar guard temprano en `TrinityProvider.tsx` para NO crear `ThetaOrchestrator` ni `OffscreenCanvas` | `TrinityProvider.tsx` | ✅ **HECHO** |
| 2C.2 | Verificar que no haya listeners IPC/EventEmitters de Theia activos en `main.ts` / `index.ts` | `main.ts`, `index.ts` | ✅ **HECHO** — Limpio, sin referencias |
| 2C.3 | Eliminar `_theiaVideoRenderer.tick()` del hot path + exorcizar campo e import | `TickEngine.ts`, `TitanOrchestrator.ts` | ✅ **HECHO** |

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
| #15 | `TacticalCanvas.tsx` | Zero-alloc pump loop: pre-alloc `frameBufferRef` + `msgTemplateRef`, `packFrameDataInto()` | ✅ Committed |
| #16 | `TrinityProvider.tsx` + `ThetaOrchestrator.ts` | Guard `ENABLE_THETA_ORCHESTRATOR` → no phantom `ThetaOrchestrator` / `OffscreenCanvas` | ✅ Committed |
| #17 | `TickEngine.ts` + `TitanOrchestrator.ts` | Exorcise `_theiaVideoRenderer` dead code from hot path (44Hz) + remove import/field/methods | ✅ Committed |

---

## 5. RESUMEN DE ACCIONES COMPLETADAS

- **Fase 2A (TacticalCanvas):** Eliminadas 3 alocaciones per-frame (`new Float32Array`, `.map()`, objeto literal `msg`). Buffer pre-allocado y msg template mutado in-place.
- **Fase 2B (Hyperion 3D):** Auditados `HyperionMovingHead3D`, `HyperionPar3D`, `HyperionTruss`, `NeonFloor`, `VisualizerCanvas`. Sin fugas per-frame adicionales (todo en `useMemo` o pre-allocado).
- **Fase 2C (Theia/Theta Exorcismo):**
  - C1: TrinityProvider ya NO instancia `ThetaOrchestrator` ni `OffscreenCanvas` cuando está killswitcheado.
  - C2: `main.ts` / `index.ts` limpios — sin referencias a Theia/Theta.
  - C3: `_theiaVideoRenderer` eliminado del hot path a 44Hz en `TickEngine.ts` + campo/métodos/import purgados de `TitanOrchestrator.ts`.

## 6. PRÓXIMOS PASOS SUGERIDOS

1. **Testing de stress:** Ejecutar `npx tsc --noEmit` (✅ pasado) y realizar prueba de 5 minutos con Chrome DevTools → Memory → Allocation instrumentation on timeline. Verificar que no haya picos de `Float32Array`, `Object`, ni `Array` coincidiendo con frames.
2. **Auditar `AetherUIProjector.ts`:** Revisar si `.some()` closures en el hot path de proyección a UI generan allocations implícitas.
3. **Auditar stores:** Verificar que `transientStore.ts` y `useControlStore.getState()` no creen nuevos objetos/arrays en cada lectura desde `useFrame`.

---

*Documento generado automáticamente por Kimi durante WAVE 5033.*
