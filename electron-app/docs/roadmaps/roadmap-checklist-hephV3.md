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
- [ ] `_extractPhaseConfig` aún acepte `PhaseConfig | PhaseConfigPro` como V2 shim — limpiar en Lote 3

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
- [ ] Eliminar `temporalActions.snapshot()` (no-op) de `index.tsx`
- [ ] Eliminar todas las llamadas a `temporalActions.snapshot()` en LabTab, ForgeTab, index.tsx
- [ ] `tsc --noEmit` limpio

### P2-B: Unificar default cognitiveDNA
- [ ] Crear `DEFAULT_COGNITIVE_DNA` único en `DnaRail.tsx` (o archivo shared)
- [ ] Importar desde ahí en `useHephaestusEditorStore.ts` y `NewClipModal.tsx`
- [ ] Eliminar `as unknown as CognitiveDNA` casts en el store
- [ ] `tsc --noEmit` limpio

### P2-C: Buffers globales QuantumSpectrometer → useRef
- [ ] Mover `_nodePositions`, `_sampleX/Y`, `_nodePositionsCount` a `useRef` por instancia
- [ ] `tsc --noEmit` limpio

### P2-D: Anti-patrón Immer en setClip
- [ ] Reemplazar `Object.assign(draft, updater(draft))` con mutación directa del draft
- [ ] `tsc --noEmit` limpio

---

## LOTE 3 — Kernel único de evaluación (P0-B)

### P0-B: Extraer HephEvaluationKernel
- [ ] Crear `HephEvaluationKernel.ts` — función pura que evalúa un clip a instante t
- [ ] Que consuma `HephSharedMath` (blendNumeric, blendRgb) para fusión
- [ ] `useHephPreview` consume el kernel (simulando merge del Arbiter)
- [ ] `HephaestusRuntime` consume el kernel (emitiendo tracks al Arbiter)
- [ ] WYSIWYG garantizado: mismo código, mismo output
- [ ] `tsc --noEmit` limpio

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
- [ ] Skip RAF render si `!isPlaying && !dirty`
- [ ] Idle animations a 10-15 Hz, no 44 Hz
- [ ] Reemplazar `getBoundingClientRect` por frame con `ResizeObserver`
- [ ] Cachear `createRadialGradient` (no recrear por frame)
- [ ] `tsc --noEmit` limpio

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
