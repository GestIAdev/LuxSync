# FASE 0 — Inventario de Seguridad

## tsc Baseline
- **Commit:** `0d532188` (pre-demolition safety snapshot)
- **tsc --noEmit:** 0 errores — base limpia

## Inventario de Tests

### Tests V3 (KEEP — validan Hephaestus V3)
| Archivo | Qué valida | Estado |
|---|---|---|
| `hephaestus/__tests__/AudioBindingSerialization.test.ts` | Serialización de audio bindings en HephAutomationClipV3 | ✅ KEEP |
| `hephaestus/__tests__/CurveEvaluator.test.ts` | Evaluación de curvas Bézier | ✅ KEEP |
| `hephaestus/__tests__/HephParameterOverlay.test.ts` | Overlay de parámetros multi-track | ✅ KEEP |
| `hephaestus/__tests__/HephTranslator.test.ts` | Traducción de clips V3 | ✅ KEEP |
| `hephaestus/__tests__/HephaestusE2E.test.ts` | E2E: forgeClip → CurveEvaluator → DMX output | ✅ KEEP (usa `mixBus: 'htp'` — V3 canonical, sin cambios) |

### Tests V1/V2 (DEMOLITION TARGETS)
| Archivo | Qué valida | Acción |
|---|---|---|
| `chronos/__tests__/EffectRegistry.test.ts` | EffectRegistry legacy (45 efectos hardcoded) | 🔴 Demoler en Fase 2 |
| `chronos/__tests__/FXMapper.test.ts` | FXMapper legacy mapping | 🔴 Demoler en Fase 2 |
| `chronos/__tests__/DiamondData.test.ts` | Serialización round-trip con mixBus, MIXBUS_CLIP_COLORS | 🔴 Limpiar FXClip.mixBus redundante en Fase 1, usar hephClip.mixBus |
| `chronos/__tests__/chronosStore.test.ts` | Store Zustand V1 (createDefaultProject, EffectTriggerData) | 🔴 Reconstruir en Fase 4 |
| `chronos/__tests__/ChronosProject.test.ts` | LuxProject ↔ ChronosProject V1 conversion | 🔴 Reconstruir en Fase 4 |
| `chronos/__tests__/ProjectTypes.test.ts` | Barrel exports V1, luxToChronos V1 | 🔴 Reconstruir en Fase 4 |
| `chronos/__tests__/ChronosEngine.test.ts` | ChronosEngine V1 path (createEmptyProject) | 🔴 Demoler V1 path en Fase 4 |

### Tests NEUTRALES (no afectados por la demolición)
| Archivo | Qué valida | Estado |
|---|---|---|
| `chronos/__tests__/Protocols.test.ts` | SMPTE, Art-Net, MTC, MIDI Clock | ✅ KEEP |
| `chronos/__tests__/GodEarFFT.test.ts` | FFT analysis | ✅ KEEP |
| `chronos/__tests__/GodEarOffline.test.ts` | Offline audio analysis | ✅ KEEP |
| `chronos/__tests__/ChronosInjectorBridge.test.ts` | Injector bridge (usa ChronosContext types) | ⚠️ Revisar en Fase 4 |
| `chronos/__tests__/ChronosStageDispatcher.test.ts` | Stage dispatcher | ⚠️ Revisar en Fase 4 |

## Archivos Marcados con @deprecated DEMOLITION TARGET

### Tipos V1 (types.ts)
- `ChronosProject` (V1 interface)
- `TrackType` (V1 enum)
- `TimelineTrack` (V1 interface)
- `ClipType` (V1 enum)
- `createDefaultProject()` (V1 factory)
- `createDefaultTrack()` (V1 factory)

### Sección V2 (types.ts)
- `ChronosProjectV2` / `TimelineTrackV2` — marcadas como **BASE FOR V3 RECONSTRUCTION**

### Legacy EffectRegistry
- `EffectRegistry.ts` — archivo completo marcado
- `FXMapper.ts` — archivo completo marcado

### Arsenal V2.1
- `lfxTypes.ts` — `LfxClipV2` marcado

### Hephaestus V3 (CANONICAL — NO TOCAR)
- `types.ts:451` — `mixBus` field **CANÓNICO V3** — inter-clip blend behavior. NO es demolition target.

### Chronos Core
- `TimelineClip.ts` — `FXClip.mixBus` es duplicado redundante de `hephClip.mixBus`. Limpiar en Fase 1.
- `ChronosStore.ts` — marcado como PHASE 4 UPDATE TARGET
- `ChronosEngine.ts` — marcado como PHASE 4 DEMOLITION TARGET (V1 path)
- `migration.ts` — marcado como TEMPORARY BRIDGE
- `chronosStore.ts` — marcado como PHASE 4 RECONSTRUCTION TARGET

### Backend
- `TimelineEngine.ts` — marcado como PHASE 5 RECONSTRUCTION TARGET

## Distinción CRÍTICA: Dos conceptos llamados "mixBus"

### 1. V3 `mixBus` en `HephAutomationClipV3` — CANÓNICO, NO TOCAR
Inter-clip blend behavior cuando efectos se solapan en los mismos fixtures:
- `global` = LTP (full takeover, FX1)
- `htp` = HTP (highest takes precedence, FX2 transitional)
- `ambient` = HTP (atmospheric, FX3)
- `accent` = HTP (punchy accents, FX4)

Visible en `NewClipModal.tsx` como selector de MIX BUS con colores neón.
Usado por `TimelineEngine.ts:482-483` para determinar `blendMode: 'HTP' | 'LTP'`.

### 2. Legacy track routing en Chronos — DEMOLITION TARGET
`global/htp/ambient/accent` como etiquetas de tracks del timeline (forma antigua de separar efectos).
Presente en `EffectRegistry.ts` (`EffectMeta.mixBus`, `inferMixBus()`), `TimelineTrack` V1.
Esto se reemplaza por zonas canónicas (`front`, `back`, `movers`, etc.) en V2/V3.

## Mapa de Fases (revisado)
- **Fase 1:** Limpiar `FXClip.mixBus` redundante → usar `hephClip.mixBus` directamente. Eliminar `inferMixBusFromCurves()`, `MIXBUS_CLIP_COLORS`.
- **Fase 2:** Demoler EffectRegistry + FXMapper (45 efectos hardcoded + legacy track routing mixBus)
- **Fase 3:** Demoler V2.1 del Arsenal (LfxClipV2, registerEffect, _buildEntry)
- **Fase 4:** Reconstruir Chronos runtime sobre V2 (store, engine, clips con zonas canónicas)
- **Fase 5:** Reconstruir TimelineEngine backend (HephaestusRuntime delegation, blendMode desde hephClip.mixBus)
- **Fase 6:** Limpiar UI (ArsenalDock, ClipRenderer, ContextualDataSheet, ChronosRecorder)
- **Fase 7:** Demoler tipos V1 muertos (ChronosProject, TimelineTrack, TrackType, ClipType, etc.)
