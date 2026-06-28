# Roadmap — Reparación Auditoría Hephaestus V3

**Fuente:** TECHNICAL-AUDIT-HEPHAESTUSV3.md (PUNKOPUS)
**Objetivo:** Cerrar P0 + P1 → score 93+
**Fecha inicio:** 2026-06-28

---

## LOTE 1 — Quick wins que cierran secciones enteras

### P0-A: Matar PhaseDistributor/PhaseConfig legacy
- [ ] Eliminar `runtime/PhaseDistributor.ts` (archivo muerto, 189 líneas)
- [ ] Limpiar import de `PhaseConfig` de `HephaestusRuntime.ts`
- [ ] Actualizar `_extractPhaseConfig` para que solo acepte `PhaseConfigPro | undefined`
- [ ] Mover `FixturePhase` a `PhaseConfigPro.ts` (ya existe ahí como export)
- [ ] Limpiar `PhaseConfig` y `DEFAULT_PHASE_CONFIG` de `types.ts` si no hay otros consumidores
- [ ] Actualizar comentarios en `types.ts` que mienten sobre PhaseDistributor.resolve()
- [ ] Eliminar o archivar `__tests__/PhaseDistributor.test.ts`
- [ ] `tsc --noEmit` limpio

### P2-E: Clamp spreadDeg en computeOffsetPro
- [ ] Clamp `spreadDeg` a [0, 1440] en `computeOffsetPro` (PhaseConfigPro.ts:98)
- [ ] `tsc --noEmit` limpio

### P1-A: Fase con wrap continuo
- [ ] Cambiar `Math.max(0, timeMs - phaseOffset)` → `(timeMs + phaseOffset) % durationMs` en `useHephPreview`
- [ ] Verificar que el runtime (`HephaestusRuntime.ts`) usa el mismo wrap
- [ ] `tsc --noEmit` limpio

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

### Lote 1 — (fecha)
_Pendiente de ejecución_
