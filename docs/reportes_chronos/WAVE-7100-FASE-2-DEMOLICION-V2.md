# WAVE 7100 — FASE 2: Demolición Controlada V2

> **Fecha:** 2025-01-XX  
> **Wave:** 7100 FASE 2  
> **Autor:** Cascade + Raulacate  
> **Estado:** COMPLETADA  
> **Tests:** 37/37 verdes (22 LuxFileV3 + 14 ProjectTypes V3 + 1 ChronosProject demolished)

---

## Premisa

`.lux` nace LIMPIA en V3. No existe V2 previa. No hay conversores ni adaptadores legacy.  
El núcleo V3 fue establecido en FASE 1 (schema, factories, serializer, type guards).  
FASE 2 demuele todo el código V2 que ya no tiene razón de existir.

---

## Inventario de Demolición

### 1. `ChronosProject.ts` — DEMOLIDO (563 → 72 líneas)

**Eliminado:**
- `interface LuxProject` — formato V2 en disco
- `interface ProjectMeta` — metadata V2 (version, author, created, modified, durationMs, name)
- `interface ProjectAudio` — audio V2 (name, path, bpm, offsetMs, durationMs, checksum)
- `interface ProjectTimeline` — timeline V2 (clips, playheadMs, viewportStartMs, pixelsPerSecond)
- `interface ProjectLibrary` — librería V2 (customEffects, presets)
- `interface HephEffectSummary` — resumen de efectos Hephaestus
- `const PROJECT_VERSION = '2.0'` — versión V2
- `const PROJECT_EXTENSION = '.lux'` — constante V2
- `const PROJECT_MIME` — MIME V2
- `function createEmptyProject()` — factory V2
- `function createProjectFromState()` — factory V2 desde estado
- `function serializeProject()` — serializador V2 síncrono
- `function deserializeProject()` — deserializador V2 síncrono
- `function validateProject()` — validador V2
- `function luxToChronosV2()` — conversor LuxProject → ChronosProjectV2
- `function chronosV2ToLux()` — conversor ChronosProjectV2 → LuxProject
- `function normalizeZoneToV2()` — normalizador de zonas V2
- `function extractHephEffects()` — extractor de efectos Hephaestus
- `function resolveAuthor()` — resolver de autor del sistema

**Resultado:** Archivo reducido a un shim de re-export de V3. Los consumers que importan de `./ChronosProject` reciben tipos V3 con aliases compatibles (`createEmptyProject` → `createEmptyLuxFileV3`, `serializeProject` → `serializeLuxV3`, etc.).

### 2. `types.ts` — DEMOLIDO parcialmente (795 → 572 líneas)

**Eliminado:**
- `interface ChronosProjectMeta` — metadata del proyecto V2 (name, description, audioPath, durationMs, bpm, timeSignature, key, createdAt, modifiedAt, audioHash)
- `interface ChronosProjectV2` — proyecto runtime V2 (version, id, meta, playback, analysis, tracks, globalAutomation, markers)
- `interface TimelineTrackV2` — track explícita V2 (id, targetZone, visualLabel, color, clips, automation, enabled, solo, locked, order, height)
- `type TrackUpdateV2` — partial update V2
- `const TRACK_V2_ZONE_COLORS` — colores por zona V2
- `function generateTrackV2Label()` — generador de labels V2
- `function createTrackV2()` — factory de track V2
- `function createDefaultProjectV2()` — factory de proyecto V2 vacío
- `import type { CanonicalZone }` — import V2 (ya no necesario)
- `import type { TimelineClip as ConcreteTimelineClip }` — import V2

**Conservado (tipos shared, no V2-specific):**
- Primitives: `TimeMs`, `NormalizedValue`, `ChronosId`, `HexColor`
- `PlaybackConfig`, `SnapResolution`, `ChronosOverrideMode`
- Automation: `AutomationTarget`, `AutomationLane`, `AutomationPoint`, `InterpolationType`, `BezierHandle`, `Keyframe`
- `MarkerType`, `ChronosMarker`
- Analysis: `AnalysisData`, `WaveformData`, `HeatmapData`, `BeatGridData`, `DetectedSection`, `SectionType`
- Engine: `PlaybackState`, `ChronosEngineState`
- Context: `ChronosContext`, `ChronosVibeOverride`, `ChronosZoneOverride`, `ChronosColorOverride`, `ChronosActiveEffect`
- `generateChronosId()` — función utility

### 3. `ProjectTypes.ts` — REESCRIBIDO (127 → 167 líneas)

**Eliminado:**
- Todos los exports V2: `LuxProject`, `ProjectMeta`, `ProjectAudio`, `ProjectTimeline`, `ProjectLibrary`, `HephEffectSummary`
- `PROJECT_VERSION`, `PROJECT_EXTENSION`, `PROJECT_MIME`
- `createProjectFromState`, `luxToChronosV2`, `chronosV2ToLux`
- `ChronosProjectV2`, `ChronosProjectMeta`, `TimelineTrackV2`
- `createDefaultProjectV2`, `createTrackV2`, `generateTrackV2Label`

**Nuevo barrel V3:**
- Types: `LuxFileV3`, `ChronosProjectV3`, `LuxMetaV3`, `LuxAudioV3`, `LuxTrackV3`, `LuxClipV3`, `LuxClipType`, `LuxMixBus`, `LuxTargetZone`, `LuxMarkerV3`, `LuxMarkerType`, `LuxSafetyV3`, `LuxAnalysisV3`, `LuxSectionV3`, `LuxTransientV3`, `LuxTransientType`, `VibeBaseV3`, `LuxTrackUpdateV3`
- Constants: `LUX_V3_SCHEMA`, `LUX_V3_EXTENSION`, `LUX_V3_MIME`, `LUX_DEFAULT_BPM`
- Factories: `generateLuxId`, `createEmptyLuxFileV3`, `createEmptyChronosProjectV3`, `toChronosProjectV3`, `toLuxFileV3`, `createLuxMetaV3`, `createTrackV3`, `createVibeClipV3`, `createFXClipV3`, `createMarkerV3`, `createVibeBaseV3`, `generateTrackLabelV3`
- Serializer: `serializeLuxV3`, `deserializeLuxV3`, `computeLuxChecksum`, `verifyLuxChecksum`, `canonicalStringify`
- Validation: `validateLuxFileV3`, `isLuxFileV3`, `LuxValidationResult`
- Shared types from `types.ts` (primitives, automation, analysis, context, engine)
- Clip types from `TimelineClip.ts` (legacy clip layer, still used by consumers)
- Compat shims: `createEmptyProject`, `serializeProject`, `deserializeProject`, `validateProject` (re-exported from demolished `ChronosProject.ts` with V3 implementations)

### 4. `ChronosStore.ts` — DEMOLIDO parcialmente

**Eliminado:**
- `function detectProjectVersion()` — detector de versión V2/V1
- Path V2: `if (version === '2.0.0') { this.project = raw as ChronosProjectV2 }`
- Path V1/lux: `if (version === 'lux') { luxToChronosV2(deserializeProject(json)) }`
- Import `luxToChronosV2` from `./ChronosProject`
- Imports V2 de `./types`: `ChronosProjectV2`, `TimelineTrackV2`, `TrackUpdateV2`, `createDefaultProjectV2`, `createTrackV2`

**Nuevo:**
- Imports V3 de `./LuxFileV3` y `./LuxFileV3.factories`: `ChronosProjectV3` (alias `ChronosProjectV2`), `LuxTrackV3` (alias `TimelineTrackV2`), `LuxTrackUpdateV3` (alias `TrackUpdateV2`), `createEmptyChronosProjectV3` (alias `createDefaultProjectV2`), `createTrackV3` (alias `createTrackV2`)
- Path V3: `$schema === 'luxsync.lux/3.0'` hard-gate → `toChronosProjectV3(file)`
- `PROJECT_EXTENSION` → `LUX_V3_EXTENSION`

**Errores TS esperados (~35):** El cuerpo de `ChronosStore` (V1) y `ChronosStoreV2` usa campos V2 que no existen en V3 (`project.timeline`, `project.audio.path`, `project.meta.modified`, `serializeProject` síncrono vs async). Estos se reparan en FASE 3.

### 5. Tests — Actualizados

**`ProjectTypes.test.ts`** — Reescrito completo (268 → 164 líneas):
- Eliminados: 12 tests V2 (luxToChronosV2, chronosV2ToLux, roundtrip V2, PROJECT_VERSION='2.0')
- Nuevos: 14 tests V3 (barrel exports, constants, factory output, runtime bridge, ID generation, demolition verification)

**`ChronosProject.test.ts`** — Neutralizado (286 → 24 líneas):
- 18 tests V2 eliminados
- 1 test placeholder que documenta la demolición

**`LuxFileV3.test.ts`** — Sin cambios (22 tests, FASE 1)

---

## Errores TS Post-Demolición (Esperados)

Los siguientes archivos tienen errores de tipo que serán resueltos en **FASE 3 (Adaptar Consumers)**:

| Archivo | Errores | Causa |
|---------|---------|-------|
| `ChronosStore.ts` | ~35 | V1 store body usa `project.timeline`, `serializeProject` síncrono; V2 store body usa `project.meta.audioPath`, `project.meta.bpm` que no existen en V3 |
| `ChronosEngine.ts` | ~5 | Usa `ChronosProjectV2` type |
| `useChronosProject.ts` | ~4 | Usa `ChronosProjectV2` type |
| `SceneBrowser.tsx` | ~4 | Usa `LuxProject`, `serializeProject` |
| `useScenePlayer.ts` | ~4 | Usa `LuxProject` |
| `TimelineEngine.ts` | ~3 | Usa `LuxProject` |
| `ChronosLayout.tsx` | ~2 | Usa tipos V2 |
| `ZoneMapper.ts` | ~1 | Usa `PROJECT_VERSION` |

**Total estimado:** ~58 errores TS, todos esperados. FASE 3 los resuelve adaptando los consumers al schema V3.

---

## Verificación

```
npx vitest run src/chronos/__tests__/LuxFileV3.test.ts src/chronos/__tests__/ProjectTypes.test.ts src/chronos/__tests__/ChronosProject.test.ts

Test Files  3 passed (3)
     Tests  37 passed (37)
```

---

## Mapa de Migración V2 → V3

| V2 (Demolido) | V3 (Reemplazo) | Ubicación |
|---------------|----------------|-----------|
| `LuxProject` | `LuxFileV3` | `LuxFileV3.ts` |
| `ChronosProjectV2` | `ChronosProjectV3` | `LuxFileV3.ts` |
| `ChronosProjectMeta` | `LuxMetaV3` | `LuxFileV3.ts` |
| `TimelineTrackV2` | `LuxTrackV3` | `LuxFileV3.ts` |
| `TrackUpdateV2` | `LuxTrackUpdateV3` | `LuxFileV3.ts` |
| `ProjectAudio` | `LuxAudioV3` | `LuxFileV3.ts` |
| `ProjectTimeline` | *(eliminado — tracks viven en LuxFileV3.tracks)* | — |
| `ProjectLibrary` | *(eliminado — efectos viven embebidos en clips)* | — |
| `HephEffectSummary` | *(eliminado — HephAutomationClipV3 embebido en LuxClipV3)* | — |
| `PROJECT_VERSION = '2.0'` | `LUX_V3_SCHEMA = 'luxsync.lux/3.0'` | `LuxFileV3.ts` |
| `createEmptyProject()` | `createEmptyLuxFileV3()` | `LuxFileV3.factories.ts` |
| `createProjectFromState()` | *(eliminado — usar toLuxFileV3(project))*) | — |
| `serializeProject()` (sync) | `serializeLuxV3()` (async, +checksum) | `LuxFileV3.serializer.ts` |
| `deserializeProject()` (sync) | `deserializeLuxV3()` (async, +validate+checksum) | `LuxFileV3.serializer.ts` |
| `validateProject()` | `validateLuxFileV3()` | `LuxFileV3.schema.ts` |
| `luxToChronosV2()` | `toChronosProjectV3()` | `LuxFileV3.factories.ts` |
| `chronosV2ToLux()` | `toLuxFileV3()` | `LuxFileV3.factories.ts` |
| `createDefaultProjectV2()` | `createEmptyChronosProjectV3()` | `LuxFileV3.factories.ts` |
| `createTrackV2()` | `createTrackV3()` | `LuxFileV3.factories.ts` |
| `generateTrackV2Label()` | `generateTrackLabelV3()` | `LuxFileV3.factories.ts` |
| `detectProjectVersion()` | *(eliminado — $schema hard-gate en validator)* | — |

---

## Próximos Pasos

- **FASE 3:** Adaptar consumers (ChronosStore, ChronosEngine, ChronosLayout, IPC, Recorder, TimelineEngine, SceneBrowser, useScenePlayer) al schema V3. Resolver los ~58 errores TS esperados.
- **FASE 4:** Audio portable + análisis embebido FFT.
- **FASE 5:** VibeBase whisper.
- **FASE 6:** Record Mode V3.
