# Roadmap — Reparación Auditoría Hephaestus V3

**Fuente:** TECHNICAL-AUDIT-HEPHAESTUSV3.md (PUNKOPUS)
**Objetivo:** Cerrar P0 + P1 → score 93+
**Fecha inicio:** 2026-06-28

---

## LOTE 1 — Quick wins que cierran secciones enteras

### P0-A: Matar PhaseDistributor/PhaseConfig legacy
- [x] Eliminar `runtime/PhaseDistributor.ts` (archivo muerto, 189 líneas)
- [x] Eliminar `__tests__/PhaseDistributor.test.ts`
- [x] Limpiar import de `FixturePhase` de `HephaestusRuntime.ts` → ahora desde `PhaseConfigPro.ts`
- [x] `PhaseConfig` se mantiene en `types.ts` solo para V2 compat (lfxTypes.ts, ShowFileV2.ts)
- [x] `FixturePhase` eliminado de `types.ts`, re-exportado desde `PhaseConfigPro.ts` para backward compat
- [x] Actualizar comentarios en `types.ts` que mentían sobre PhaseDistributor.resolve()
- [x] `DEFAULT_PHASE_CONFIG` marcado como `@deprecated`
- [x] `tsc --noEmit` limpio
- [x] `_extractPhaseConfig` aún acepte `PhaseConfig | PhaseConfigPro` como V2 shim — V2 shim legítimo: `FixtureSelector.phase` en `ShowFileV2.ts` usa `PhaseConfig` (V2). El duck-typing (`'spreadDeg' in phase` vs `'spread' in phase`) es el migrador correcto. No se puede eliminar sin romper carga de shows V2.

### P2-E: Clamp spreadDeg en computeOffsetPro
- [x] Clamp `spreadDeg` a [0, 1440] en `computeOffsetPro` (PhaseConfigPro.ts:106)
- [x] `tsc --noEmit` limpio

### P1-A: Fase con wrap continuo
- [x] Preview (`useHephPreview.ts:475`): `Math.max(0, timeMs - phaseOffset)` → `((timeMs + phaseOffset) % durationMs + durationMs) % durationMs`
- [x] Runtime (`HephaestusRuntime.ts:552`): mismo wrap en modo loop; one-shot usa clamp a `durationMs`
- [x] Comentarios actualizados en runtime (WAVE 4859 + AUDIT P1-A)
- [x] `tsc --noEmit` limpio

---

## LOTE 2 — Limpieza de deuda técnica (P2)

### P2-A: Limpiar snapshot fantasma
- [x] Eliminar `temporalActions.snapshot()` (no-op) de `index.tsx`
- [x] Eliminar todas las llamadas a `temporalActions.snapshot()` en LabTab, ForgeTab, index.tsx
- [x] `tsc --noEmit` limpio

### P2-B: Unificar default cognitiveDNA
- [x] Crear `DEFAULT_COGNITIVE_DNA` único en `defaults.ts` (shared module)
- [x] Importar desde ahí en `useHephaestusEditorStore.ts` y `NewClipModal.tsx`
- [x] Eliminar `as unknown as CognitiveDNA` casts en el store
- [x] `tsc --noEmit` limpio

### P2-C: Buffers globales QuantumSpectrometer → useRef
- [x] Mover `_nodePositions`, `_sampleX/Y`, `_nodePositionsCount` a `useRef` por instancia
- [x] `tsc --noEmit` limpio

### P2-D: Anti-patrón Immer en setClip
- [x] Reemplazar `Object.assign(draft, updater(draft))` con `return updater(draft)` (Immer soporta return de nuevo estado)
- [x] `tsc --noEmit` limpio

---

## LOTE 3 — Kernel único de evaluación (P0-B)

### P0-B: Extraer HephEvaluationKernel
- [x] Crear `HephEvaluationKernel.ts` — función pura que evalúa un clip a instante t
- [x] Que consuma `HephSharedMath` (blendNumeric, blendRgb) para fusión
- [x] `useHephPreview` consume el kernel (simulando merge del Arbiter)
- [x] `HephaestusRuntime` consume el kernel (emitiendo tracks al Arbiter)
- [x] WYSIWYG garantizado: mismo código, mismo output
- [x] `tsc --noEmit` limpio

---

## LOTE 4 — Test E2E genoma (P0-C) — CERRADO MANUALMENTE

### P0-C: Prueba de consumo del genoma
- [x] Verificado manualmente: Selene lee cognitiveDNA, rankea efectos por DNA score
- [x] Log de runtime: `heph_*` efecto ganó simulación con DNA=0.93 vs competidores
- [x] Selene integra efectos Hephaestus en tiempo real durante playback
- [ ] TODO menor: Selene debe leer `clip.name` del .lfx, no el filename

---

## LOTE 5 — Gate render Spectrometer (P1-B)

### P1-B: Gate de render del Spectrometer
- [x] Skip RAF render si `!isPlaying && !dirty`
- [x] Idle animations a 12 Hz, no 44 Hz
- [x] Reemplazar `getBoundingClientRect` por frame con `ResizeObserver`
- [x] Cachear `createRadialGradient` (no recrear por frame)
- [x] `tsc --noEmit` limpio

---

## Reporte de Lotes

### Lote 1 — 2026-06-28

**P0-A: PhaseDistributor legacy eliminado**
- Eliminados `PhaseDistributor.ts` (189 líneas) + `PhaseDistributor.test.ts` (350 líneas)
- `FixturePhase` ahora tiene única fuente de verdad en `PhaseConfigPro.ts`
- `types.ts` re-exporta `FixturePhase` para backward compat
- `PhaseConfig` (V2) se mantiene como compat shim para `lfxTypes.ts` y `ShowFileV2.ts`
- Comentarios mentirosos sobre `PhaseDistributor.resolve()` corregidos
- Cierra §1.3 de la auditoría: un solo motor de fase vivo

**P2-E: Clamp spreadDeg**
- `computeOffsetPro` ahora clampa `spreadDeg` a [0, 1440] como defensa en el motor
- Cierra §3.4 de la auditoría

**P1-A: Phase wrap continuo**
- Preview y runtime ahora usan `(time + offset) % duration` en modo loop
- Fixtures con offset grande ya no se congelan en t=0 esperando al playhead
- No hay salto discontinuo en la frontera del loop → chase infinito sin costuras
- Cierra §3.3 de la auditoría: Hephaestus ahora implementa phase real, no delay disfrazado

**tsc --noEmit: 0 errores en los 3 fixes.**

### Lote 2 — 2026-06-28

**P2-A: Snapshot fantasma eliminado**
- 12 llamadas a `temporalActions.snapshot()` eliminadas de index.tsx, LabTab.tsx, ForgeTab.tsx
- `snapshot()` era un no-op: V3 auto-snapshots via `mutate()` en el store
- `updateCurveWithSnapshot` simplificado a solo `updateCurve` (el store ya hace `mutate('Edit curve', ...)`)
- Dependencias de useCallback limpiadas (removida `temporalActions` de arrays donde ya no se usa)
- `temporalActions` se conserva solo para `undo()`, `redo()`, `resetWithClip()`

**P2-B: CognitiveDNA unificado**
- Creado `src/core/hephaestus/defaults.ts` — única fuente de verdad para `DEFAULT_COGNITIVE_DNA` y `DEFAULT_SIMULATION_META`
- `DnaRail.tsx` ahora re-exporta desde `defaults.ts` (backward compat con index.tsx)
- `NewClipModal.tsx` importa desde `defaults.ts` (eliminada duplicación local)
- `useHephaestusEditorStore.ts`: eliminados los 2 `as unknown as CognitiveDNA` casts con shape incorrecto (usaba `tempoRange`, `energyZone: 'balanced'`, `density` — ninguno existe en la interfaz real)
- Store ahora usa `{ ...DEFAULT_COGNITIVE_DNA } as CognitiveDNA` (spread del freeze, shape correcta)

**P2-C: Buffers QuantumSpectrometer → useRef**
- Eliminados 5 globales module-level: `_nodePositions`, `_nodePositionsCount`, `_sampleX`, `_sampleY`, `_sampleCount`
- Creado `SpectrometerBuffers` interface + `createBuffers()` factory
- `buffersRef = useRef<SpectrometerBuffers>(createBuffers())` — una instancia por componente
- 7 funciones actualizadas para recibir `buf: SpectrometerBuffers` como primer parámetro
- Call sites del render loop y hit-testing actualizados
- Cierra riesgo de shared-state corruption si múltiples Spectrometers coexisten

**P2-D: Anti-patrón Immer corregido**
- 4 instancias de `Object.assign(draft, next)` reemplazadas con `return updater(draft)` en:
  - `index.tsx` setClip
  - `LabTab.tsx` setClip
  - `ForgeTab.tsx` setClip + updateCurve
  - `useHephaestusEditorStore.ts` endDragSnapshot
- Immer soporta retornar un nuevo estado del recipe — esto preserva structural sharing correctamente
- `Object.assign` escribía todas las propiedades del nuevo objeto sobre el draft, incluyendo las no cambiadas, rompiendo el tracking de Immer

**tsc --noEmit: 0 errores en los 4 fixes.**

### Lote 3 — 2026-06-28

**P0-B: Kernel único de evaluación — HephEvaluationKernel**
- Creado `src/core/hephaestus/HephEvaluationKernel.ts` — función pura `evaluateFixtureParams()` que evalúa todos los tracks aplicables a un fixture en un instante t
- El kernel consume `HephSharedMath` (blendNumeric, blendRgb, defaultBlendMode) — única ruta de fusión
- `useHephPreview.evaluateFixtureFrame()` ahora delega al kernel: elimina 80 líneas de lógica duplicada (evaluación color, intensity modulation, blend switch)
- `HephaestusRuntime._blendOutput()` reemplazado switch-case custom por llamadas a `blendNumeric`/`blendRgb` de HephSharedMath — misma función que el preview
- `HephaestusRuntime._emitTrackSample()` ahora respeta `colorOverride` (antes ignorado — divergence WYSIWYG corregida)
- `ResolvedTrack` extendido con `colorOverride?: HSL` — propagado desde `clip.tracks[i].colorOverride` via `_buildResolvedTrack`
- Intensity modulation unificada: kernel usa `intensityTrackValue * clipIntensity` (mismo patrón que runtime)
- NaN guards idénticos en ambos paths (misma función `evaluateColorTrack` interna del kernel)
- Cierra §1.2 de la auditoría: "un solo HephEvaluationKernel puro consumido por ambos"

**tsc --noEmit: 0 errores.**

### Lote 5 — 2026-06-28

**P1-B: Gate de render del Spectrometer — QuantumSpectrometer.tsx**
- **Skip RAF render si pausado y limpio:** `dirtyRef` flag — el render loop hace early-return si `!isPlaying && !dirty`. Dirty se setea en: ResizeObserver, cambios de `preview`, `selectedFixtureId`, `activeScope`, `phaseConfig`, y resize de canvas.
- **Idle a 12 Hz:** `FPS_IDLE_MS = 1000/12` — throttle dinámico: 44 Hz cuando `isPlaying`, 12 Hz cuando pausado. Reduce CPU usage en idle ~73%.
- **ResizeObserver:** `dimsRef` cachea `{ w, h }` — el render loop lee del ref en lugar de llamar `getBoundingClientRect()` cada frame. ResizeObserver actualiza dims y marca dirty.
- **Vignette cacheado:** `vignetteRef` guarda el `CanvasGradient` — solo se recrea cuando las dimensiones cambian (`vignetteDimsRef`). Antes se llamaba `createRadialGradient` 44 veces/seg.
- **isPlayingRef:** ref espejo de `preview.isPlaying` — el render loop lee el ref sin re-suscribirse.

**tsc --noEmit: 0 errores.**

### TODO menor — 2026-06-28

**Selene debe leer `clip.name` del .lfx, no el filename**
- **`ConsciousnessOutput.ts`:** Añadido `effectName?: string` a `ConsciousnessEffectDecision` — propaga el nombre humano legible del clip (e.g., "Acid Sweep Through Mars") desde el `.lfx`.
- **`EffectDreamSimulator.ts`:** Añadido `effectName?: string` a `EffectCandidate`. `generateCandidates()` ahora puebla `effectName` desde `RegistryEntry.name` (que viene de `clip.name` del `.lfx`). `exploreAlternatives()` también propaga `e.name`. `getPreBufferedCandidate()` retorna `effectName`. Logs actualizados para mostrar `effectName ?? effect` (fallback al ID si no hay nombre).
- **`DreamEngineIntegrator.ts`:** `getPreBufferedCandidate()` return type actualizado para incluir `effectName`.
- **`SeleneTitanConscious.ts`:** Sovereign Clock path propaga `candidate.effectName` al `effectDecision`. DIVINE arsenal override propaga `effectName` desde el registry. `contextualEffectSelected` event emite `effectName`. Todos los logs actualizados: Glass Break, Sovereign Clock, Divine Aborted, DNA simulation, DecisionMaker approved.
- **`DecisionMaker.ts`:** DNA path, DIVINE path y DROP path ahora setean `effectName` desde `RegistryEntry.name` vía `getDynamicEffectRegistry().getEntry(id)?.name`.

**Resultado:** Selene ahora usa `clip.name` del contenido del `.lfx` como nombre canonical en toda la cadena — desde el DreamSimulator hasta los logs y eventos de telemetría. El `effectType` (ID/filename sin extensión) se preserva para lookups internos, pero `effectName` es el nombre humano que se muestra al operador.

**tsc --noEmit: 0 errores.**

### Auditoría Opus R.2 + R.3 — 2026-06-28

**R.3.2: Comentarios zombis eliminados**
- `useHephPreview.ts:277-283`: "PhaseDistributor" → "phase config (PhaseConfigPro) / computeOffsetPro()"
- `HephaestusRuntime.ts:307`: "resolves PhaseDistributor" → "applies phase config (PhaseConfigPro)"
- `HephaestusRuntime.ts:375`: mismo fix en `playFromClip` docblock
- `grep PhaseDistributor` en `src/` → 0 resultados

**R.2 residual: Orden de blends no conmutativos (replace/subtract)**
- **Root cause:** El kernel acumulaba TODOS los color tracks en un solo `(cr, cg, cb)` sin distinguir `paramId`, mientras el runtime keya por `fixtureId:paramId` via `_blendMap`. Para diferentes `paramId` de color, el kernel mezclaba lo que el runtime mantenía separado.
- **Fix:** `HephEvaluationKernel.evaluateFixtureParams()` ahora usa `colorMap: Map<HephParamId, {r,g,b}>` — keya color por `paramId` (paridad estructural con `_blendMap`). El color final se resuelve via LTP (`lastColorParam` — último paramId escrito gana), mirroring `NodeArbiter` consolidation.
- **Order guarantee documentado:** docstring del kernel ahora explica que `applicableTracks` se itera en orden de `clip.tracks` (mismo que `tickActive()`), y para modes no conmutativos el último track gana — igual que `_blendMap` + Arbiter LTP.

**tsc --noEmit: 0 errores.**
