# WAVE 7100 — FASE 3: Adaptación de Consumers a V3

> **Fecha:** 2025-06-29
> **Wave:** 7100 FASE 3
> **Autor:** Cascade + Raulacate
> **Estado:** COMPLETADA
> **Tests:** 215/215 verdes (10/10 chronos test files)
> **tsc --noEmit:** 0 errores

---

## Premisa

FASE 2 demolió todo el código V2 y dejó un shim de re-export en `ChronosProject.ts`.
FASE 3 adapta todos los consumers (core, hooks, UI, engine, tests) al schema V3
canónico definido en `LuxFileV3.ts`.

---

## Inventario de Cambios

### 1. `ChronosEngine.ts` — Migración completa a V3

**Imports:**
- Tipos compartidos (`TimeMs`, `NormalizedValue`, `PlaybackState`, `ChronosContext`, etc.) desde `./types`
- Tipos V3 (`ChronosProjectV3`, `LuxTrackV3`, `LuxClipV3`) desde `./LuxFileV3`
- Eliminadas todas las referencias a `ChronosProjectV2` y `TimelineTrackV2`

**Schema fixes:**
- `project.playback.loop` / `loopRegion` / `latencyCompensationMs` → eliminados (V3 no tiene `playback`)
- `project.meta.bpm` → `project.runtimeBpm ?? project.audio?.detectedBpm ?? 120`
- `project.globalAutomation` → eliminado (V3 no tiene globalAutomation; `evaluateGlobalAutomationV2` retorna mapa vacío)
- `project.playback.overrideMode` → hardcodeado a `'whisper'` (V3 no tiene overrideMode en playback)
- `ClipIndexEntryV2.clip` cambiado de `TimelineClip` a `LuxClipV3`
- `cachedActiveClips` y `activeClips` cambiados a `LuxClipV3[]`
- Casts `clip as unknown as FXClip` / `clip as unknown as TimelineClip` donde se necesita compatibilidad con `TimelineClip`
- Fix de export duplicado `getChronosEngine` (línea 1192 duplicada)

### 2. `ChronosStore.ts` — V1 Store + V2 Store

**ChronosStore (V1):**
- Migrado a `ChronosProjectV3` con bridging flat clips ↔ tracks
- Helpers `_getFlatClips()` y `_setFlatClips()` para compat con API plana
- Save/Load migrados a async con `serializeLuxV3` / `deserializeLuxV3`
- Audio: `.path` → `.relativePath`, `.bpm` → `.detectedBpm`
- Meta: `.modified` → `.modifiedAt`

**ChronosStoreV2:**
- `moveClipToTrack`: `movedClip` tipado como `LuxClipV3` (no `TimelineClip`)
- Eliminado `trackId` del clip movido (V3: membresía por contención en `track.clips[]`)

### 3. `useChronosProject.ts`
- `LuxProject` → `ChronosProjectV3` (import, state, return type, event handler)

### 4. `ChronosLayout.tsx`
- `LuxProject` → `ChronosProjectV3` (import + event handler)
- `data.project.timeline.clips` → `data.project.tracks.flatMap(t => t.clips)`
- `data.project.audio?.path` → `data.project.audio?.relativePath`
- `data.project.audio.bpm` → `data.project.audio.detectedBpm`

### 5. `TimelineCanvas.tsx`
- `TimelineTrackV2` → `LuxTrackV3` (import + `storeTrackToCanvasTrack`)

### 6. `TrackLabelsOverlay.tsx`
- `TimelineTrackV2` → `LuxTrackV3` (import + todas las referencias)

### 7. `TimelineEngine.ts`
- `LuxProject` → `ChronosProjectV3`
- `project.timeline.clips` → `project.tracks.flatMap(t => t.clips)` con cast `as unknown as TimelineClip[]`

### 8. `useScenePlayer.ts`
- `LuxProject` → `ChronosProjectV3` (import, `ScenePlayerStatus`, `projectRef`, `loadScene`)
- `project.timeline.clips.length` → `project.tracks.flatMap(t => t.clips).length`

### 9. `SceneBrowser.tsx`
- `LuxProject` → `ChronosProjectV3`
- `deserializeProject` ahora async → `await deserializeProject(text)` → `result.file`
- `toChronosProjectV3(result.file)` para convertir `LuxFileV3` → `ChronosProjectV3`
- `project.audio?.path` → `project.audio?.relativePath`
- `project.audio.name` → `project.audio.fileName`
- `project.timeline.clips` → `project.tracks.flatMap(t => t.clips)`
- `resolveProjectName(project: LuxProject...)` → `resolveProjectName(project: ChronosProjectV3...)`

### 10. `DiamondData.test.ts` — Migración a V3

**Imports:**
- `createEmptyProject` → `createEmptyChronosProjectV3`
- Añadido `toLuxFileV3` y `createTrackV3`
- Añadido `LuxClipV3` type import

**Schema:**
- Clips en `track.clips[]` en vez de `project.timeline.clips`
- `serializeProject(project)` → `await serializeProject(toLuxFileV3(project))` (async + conversión)
- `deserializeProject(json)` → `await deserializeProject(json)` → `result.file`
- Acceso a clips: `result.file!.tracks.flatMap(t => t.clips)`
- `createHephFXClip`: removido parámetro `mixBus` (FASE 1 lo eliminó del signature)
- `clip.mixBus` → `clip.hephClip?.mixBus` (canónico en V3)
- STEP 5: hephClip con 0 tracks ahora espera validación fallida (V3 rechaza empty automation)

**Tests async:**
- STEP 2-5 marcados como `async ()` por uso de `await`

---

## Principios V3 Aplicados

1. **No `playback` en `ChronosProjectV3`** — loop, loopRegion, latencyCompensation son estado efímero del engine, no del proyecto
2. **No `globalAutomation`** — V3 no tiene automation global; las automation lanes viven en los hephClips
3. **No `meta.bpm`** — BPM viene de `runtimeBpm` (worker) o `audio.detectedBpm` (fallback)
4. **`mixBus` en `hephClip`** — FASE 1 lo removió de `FXClip`; el source canónico es `hephClip.mixBus`
5. **Clips en tracks** — No hay `timeline.clips` plano; clips viven en `tracks[].clips[]`
6. **Async serialize/deserialize** — `serializeLuxV3` / `deserializeLuxV3` son async (SHA-256 checksum)
7. **`LuxFileV3` ≠ `ChronosProjectV3`** — `toLuxFileV3(project)` strip runtime state antes de serializar

---

## Verificación

```
npx tsc --noEmit → exit 0 (0 errores)
npx vitest run src/chronos → 10/10 files, 215/215 tests PASSED
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `chronos/core/ChronosEngine.ts` | Imports V3, schema fixes, clip index types |
| `chronos/core/ChronosStore.ts` | V1 bridge clips↔tracks, async save/load, V2 moveClipToTrack |
| `chronos/hooks/useChronosProject.ts` | LuxProject → ChronosProjectV3 |
| `chronos/ui/ChronosLayout.tsx` | LuxProject → ChronosProjectV3, property access V3 |
| `chronos/ui/timeline/TimelineCanvas.tsx` | TimelineTrackV2 → LuxTrackV3 |
| `chronos/ui/timeline/TrackLabelsOverlay.tsx` | TimelineTrackV2 → LuxTrackV3 |
| `core/engine/TimelineEngine.ts` | LuxProject → ChronosProjectV3, tracks.flatMap |
| `hooks/useScenePlayer.ts` | LuxProject → ChronosProjectV3, tracks.flatMap |
| `components/hyperion/controls/sidebar/SceneBrowser.tsx` | Async deserialize, toChronosProjectV3, V3 properties |
| `chronos/__tests__/DiamondData.test.ts` | V3 schema, async, createHephFXClip signature, mixBus en hephClip |

---

## Cierre

FASE 3 completa. Todos los consumers migrados al schema V3 canónico.
No queda código V2 referenciado. `tsc` limpio. Tests verdes.

**Próximo:** FASE 4 (si aplica) — features nuevas sobre el núcleo V3.
