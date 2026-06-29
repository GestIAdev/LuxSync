CHRONOS V3 AUDIT — REVISED: THE TRUTH IS HEPHAESTUS
Corrección de perspectiva
Mi auditoría anterior trató V2 como "dormant but valid". El usuario corrige: V2 es obsoleto. La única verdad es V3 — el schema de Hephaestus (HephAutomationClipV3, schemaVersion: '3.0', $schema: 'luxsync.lfx/3.0'). Esto cambia completamente el análisis.

1. ARQUITECTURA V3 — LA VERDAD
Pipeline V3 completo (lo que ya funciona):


Hephaestus Editor (ForgeTab/LabTab)
  → serializeHephClip() → HephAutomationClipV3
  → HephFileIO.saveClip() → .lfx file ($schema: 'luxsync.lfx/3.0')
  → HephaestusClipIndex.upsert() → valida tracks[], zones[], keyframes[]
  → LfxFileLoader.loadFile() → DynamicEffectRegistry.registerEffectV3()
  → Selene IA → SeleneHephBridge.route() → HephaestusRuntime.play()
  → CurveEvaluator → ResolvedTrack[] → fixtureIds (via ZoneMapper)
  → DMX output → NodeArbiter L3 (effect layer, domina L0/L1)
Tipos V3 canónicos (limpios, no tocar):
HephAutomationClipV3 (@/core/hephaestus/types.ts:433-476) — el schema único. tracks: HephTrack[], schemaVersion: '3.0', spatialZones, cognitiveDNA?, safetyDeclaration?.
HephTrack (@/core/hephaestus/types.ts:353-417) — multicelular: una curva + un conjunto de zonas. blendMode, phaseConfig, selector.
LFXFileV3 (@/core/arsenal/lfxTypes.ts:379-383) — wrapper de archivo: $schema: 'luxsync.lfx/3.0', clip: HephAutomationClipV3, checksum: string.
RegistryEntry (@/core/arsenal/lfxTypes.ts:278-324) — snapshot inmutable para Selene IA. dna, simMeta, safetyDecl, executionDomain.
HephAutomationClip = HephAutomationClipV3 (alias canónico WAVE 7003).
Lo que V3 ya hace bien:
HephaestusRuntime evalúa HephTrack[] → ResolvedTrack[] con CurveEvaluator por track, zones resueltas via ZoneMapper.resolveZoneTags().
SeleneHephBridge enruta decisiones de Selene IA: HIT → HephaestusRuntime.play(), MISS → legacy fallback.
DynamicEffectRegistry indexa por vibe, divine, heavy. Hot-registration al guardar desde Hephaestus.
HephaestusClipIndex valida V3 estrictamente: rechaza cualquier cosa sin tracks[] válidas.
NodeArbiter L3 — HephaestusAetherAdapter inyecta output del runtime como L3 (effect layer), domina L0/L1.
2. LO QUE HAY QUE DEMOLER — INVENTARIO COMPLETO
🔴 NIVEL 1 — Chronos core types (V1/V2 muertos)
Archivo	Qué hay	Acción
@/chronos/core/types.ts:1-1075	ChronosProject (V1), TimelineTrack, TrackType, ClipType, EffectTriggerData, IntensityCurveData, ZoneOverrideData, ColorOverrideData, VibeChangeData, createDefaultProject, createDefaultTrack	Demoler. El runtime model debe ser ChronosProjectV2 o un nuevo ChronosProjectV3 que use HephAutomationClipV3 nativamente.
@/chronos/core/types.ts:1076-1273	ChronosProjectV2, TimelineTrackV2, createTrackV2, createDefaultProjectV2	Base para reconstrucción. targetZone: CanonicalZone | 'global' es correcto. Pero los TimelineClip con ClipType y ClipData son V1 — hay que reemplazarlos con clips que referencien HephAutomationClipV3.
@/chronos/core/ChronosProject.ts	LuxProject, luxToChronos(), chronosToLux()	Reconstruir. El formato .lux debe contener HephAutomationClipV3 directamente (ya lo hace via FXClip.hephClip). Pero luxToChronos() produce V1 ChronosProject — debe producir V2/V3.
@/chronos/core/TimelineClip.ts	VibeClip, FXClip, inferMixBusFromCurves(), MIXBUS_CLIP_COLORS, MIX_BUS_TYPE	Demoler MixBus. FXClip.hephClip (V3) es la verdad. mixBus se elimina. zones viene de hephClip.spatialZones / hephClip.tracks[].zones.
@/chronos/core/ProjectTypes.ts	Barrel re-exports	Actualizar después de limpiar los anteriores.
@/chronos/core/migration.ts	migrateProjectV1toV2()	Temporal — se necesita mientras existan .lux V1 en disco, pero es código puente, no permanente.
🔴 NIVEL 1 — EffectRegistry (45 efectos hardcoded legacy)
Archivo	Qué hay	Acción
@/chronos/core/EffectRegistry.ts (965 líneas)	45+ efectos hardcoded con mixBus, EnergyZone, EffectMeta, inferMixBus(), getEffectTrackId()	Demoler completo. Estos efectos son legacy pre-Hephaestus. El arsenal real es el DynamicEffectRegistry alimentado por .lfx V3.
@/chronos/core/FXMapper.ts	Mapea FXType → BaseEffect ID, usa EffectRegistry	Demoler. En V3, el effectType del HephAutomationClipV3 es el ID directo. No hay mapeo.
@/chronos/__tests__/EffectRegistry.test.ts	Tests del registry legacy	Demoler con el registry.
@/chronos/__tests__/DiamondData.test.ts	Tests que validan MixBus inference	Demoler.
🔴 NIVEL 1 — ChronosStore (Zustand, V1)
Archivo	Qué hay	Acción
@/chronos/store/chronosStore.ts (1468 líneas)	Store Zustand que usa ChronosProject (V1), createDefaultProject, createDefaultTrack, ClipType, ClipData	Reconstruir sobre ChronosProjectV2 + clips V3. Todas las acciones (addTrack, addClip, etc.) operan sobre V1.
@/chronos/core/ChronosStore.ts (1146 líneas)	Store clase con auto-save, usa LuxProject	Actualizar — el formato .lux ya contiene HephAutomationClipV3 via FXClip.hephClip, pero la conversión luxToChronos() produce V1.
🟡 NIVEL 2 — ChronosEngine (dual V1/V2)
Archivo	Qué hay	Acción
@/chronos/core/ChronosEngine.ts (1528 líneas)	Pipeline V1 (generateContext) + pipeline V2 (generateContextV2). ClipBoundaryIndex (V1) + ClipBoundaryIndexV2.	Demoler V1 path. Quitar ChronosProject V1, ClipBoundaryIndex, generateContext(). Quedar solo con V2. El V2 path ya usa track.targetZone para routing — correcto.
🟡 NIVEL 2 — TimelineEngine (backend, usa LuxProject plano)
Archivo	Qué hay	Acción
@/core/engine/TimelineEngine.ts (662 líneas)	Carga LuxProject directo, itera clips planos, usa clip.mixBus para blendMode, clip.zones para routing, EFFECT_FACTORIES para instanciar efectos hardcoded	Reconstruir. En V3, los efectos son HephAutomationClipV3 — se ejecutan via HephaestusRuntime, no via EFFECT_FACTORIES. mixBus se elimina. El blend mode viene de HephTrack.blendMode.
🟡 NIVEL 2 — UI Chronos (Arsenal, Clips, Inspector)
Archivo	Qué hay	Acción
@/chronos/ui/arsenal/ArsenalDock.tsx	Importa EffectRegistry, muestra efectos hardcoded	Reconstruir — debe mostrar clips del HephaestusClipIndex / DynamicEffectRegistry.
@/chronos/ui/arsenal/ArsenalPanel.tsx	Igual	Reconstruir.
@/chronos/ui/arsenal/CustomFXDock.tsx	Dock para FX custom	Actualizar.
@/chronos/ui/inspector/ContextualDataSheet.tsx	Inspector de clips, usa mixBus	Demoler MixBus.
@/chronos/ui/timeline/ClipRenderer.tsx	Renderiza clips, usa mixBus para colores	Demoler MixBus — usar spatialZones para colorear.
@/chronos/core/ChronosRecorder.ts	Grabación, usa ClipType, EffectTriggerData	Reconstruir.
🟡 NIVEL 2 — Arsenal lfxTypes (V2.1 wrapper legacy)
Archivo	Qué hay	Acción
@/core/arsenal/lfxTypes.ts:205-267	LfxClipV2 — wrapper V2.1 con curves: Record<> (deprecated), tracks? opcional	Demoler. Solo mantener LFXFileV3. DynamicEffectRegistry.registerEffect() (V2.1 path) se elimina.
@/core/arsenal/DynamicEffectRegistry.ts	registerEffect() (V2) + registerEffectV3() (V3)	Demoler registerEffect(), quedar solo con registerEffectV3().
@/core/arsenal/LfxFileLoader.ts	Dual path: V2.1 + V3	Demoler V2.1 path. Solo _parseAndValidateV3().
🟢 NIVEL 3 — mixBus en Hephaestus V3
Archivo	Qué hay	Acción
@/core/hephaestus/types.ts:451	mixBus: 'global' | 'htp' | 'ambient' | 'accent' — campo required en HephAutomationClipV3	Eliminar. El blend semantics viene de HephTrack.blendMode ('max' | 'replace' | 'add' | 'multiply'). mixBus es redundante y heredado de V2.
@/core/hephaestus/types.ts:595	serializeHephClip() copia mixBus	Eliminar la línea.
@/core/arsenal/LfxFileLoader.ts:469	_parseAndValidateV3 asigna mixBus default 'htp'	Eliminar.
3. PLAN DE DEMOLICIÓN — FASES
FASE 0: Asegurar el terreno (sin breaking changes)
Auditar tests existentes — identificar qué tests validan V3 vs V1/V2.
Snapshot del estado actual — tsc --noEmit baseline, registrar errores preexistentes.
Marcar con @deprecated todos los tipos V1/V2 en types.ts y lfxTypes.ts con comentarios // DEMOLITION TARGET.
FASE 1: Eliminar mixBus de V3 (sangría limpia)
Quitar mixBus de HephAutomationClipV3 → hacerlo optional primero, luego removed.
Actualizar serializeHephClip() — no copiar mixBus.
Actualizar LfxFileLoader._parseAndValidateV3() — no requerir/assignar mixBus.
Actualizar FXClip — eliminar mixBus, inferMixBusFromCurves(), MIXBUS_CLIP_COLORS.
Actualizar TimelineEngine.ts:479 — usar HephTrack.blendMode en lugar de mixBus para determinar blendMode.
Test: cargar .lfx V3 sin mixBus, verificar playback.
FASE 2: Demoler EffectRegistry legacy (45 efectos hardcoded)
Eliminar @/chronos/core/EffectRegistry.ts completo.
Eliminar @/chronos/core/FXMapper.ts completo.
Actualizar imports en ArsenalDock.tsx, ArsenalPanel.tsx, TimelineClip.ts, ContextualDataSheet.tsx, ClipRenderer.tsx — usar HephaestusClipIndex / DynamicEffectRegistry.
Eliminar EFFECT_FACTORIES del TimelineEngine.ts — los efectos V3 se ejecutan via HephaestusRuntime.
Test: ArsenalDock muestra clips V3 del índice, no efectos hardcoded.
FASE 3: Demoler V2.1 del Arsenal
Eliminar LfxClipV2 de lfxTypes.ts.
Eliminar DynamicEffectRegistry.registerEffect() (V2 path), quedar solo con registerEffectV3().
Eliminar _buildEntry() (V2 builder), quedar solo con _buildEntryFromV3().
Eliminar V2.1 path de LfxFileLoader.loadFile().
Test: solo .lfx V3 se carga. .lfx V2.1 se rechaza con error claro.
FASE 4: Reconstruir Chronos runtime model sobre V2/V3
El store Zustand (chronosStore.ts) migra a ChronosProjectV2:
createProject() → createDefaultProjectV2().
addTrack() → createTrackV2().
Clips usan HephAutomationClipV3 como payload, no EffectTriggerData.
luxToChronos() produce ChronosProjectV2, no V1.
ChronosEngine elimina V1 path (generateContext, ClipBoundaryIndex). Solo V2.
TimelineClip.ts — FXClip se simplifica: hephClip es la verdad, mixBus eliminado, zones viene de hephClip.spatialZones.
Test: crear proyecto, añadir track por zona, arrastrar clip V3, reproducir.
FASE 5: Reconstruir TimelineEngine backend
TimelineEngine carga LuxProject pero itera clips usando hephClip (V3) para ejecución.
Eliminar EFFECT_FACTORIES y toda la lógica de instanciación de efectos hardcoded.
El playback de efectos V3 se delega a HephaestusRuntime (ya existe en main process).
blendMode viene de HephTrack.blendMode, no de mixBus.
Zone routing viene de HephTrack.zones / hephClip.spatialZones, resuelto via ZoneMapper.
Test: cargar .lux con clips V3, playback correcto via HephaestusRuntime.
FASE 6: Limpiar UI
ArsenalDock/ArsenalPanel — muestran clips de HephaestusClipIndex.getAllMetadata().
ClipRenderer — colorea por spatialZones, no por mixBus.
ContextualDataSheet — inspector muestra tracks V3, no EffectTriggerData.
ChronosRecorder — graba referencias a .lfx clips, no EffectTriggerData.
Test: UI completa funcional con clips V3.
FASE 7: Demoler tipos V1 muertos
Eliminar ChronosProject (V1), TimelineTrack (V1), TrackType, ClipType, ClipData y todos los *Data types de types.ts.
Eliminar createDefaultProject, createDefaultTrack y factories V1.
Eliminar migration.ts (o mantenerlo como script standalone para conversión de proyectos antiguos).
Test: tsc --noEmit limpio, sin referencias a tipos V1.
4. DEPENDENCIAS CRÍTICAS
HephTrack.blendMode ya existe en V3 ('max' | 'replace' | 'add' | 'multiply'). Reemplaza mixBus completamente.
HephTrack.zones ya existe. Reemplaza FXClip.zones y FXClip.mixBus para routing.
HephaestusRuntime ya evalúa V3 tracks. No necesita cambios.
SeleneHephBridge ya enruta V3. No necesita cambios.
DynamicEffectRegistry.registerEffectV3() ya funciona. Solo hay que eliminar registerEffect() (V2).
5. RIESGOS
.lux files existentes con FXClip.mixBus — necesitan migración. mixBus se puede inferir a blendMode (global→replace, htp→max, ambient→max, accent→replace).
EffectRegistry importado por 22 archivos fuera de Chronos (Selene, DreamSimulator, DecisionMaker, MidiActionRegistry). Esos imports hay que actualizarlos al DynamicEffectRegistry.
TimelineEngine es el playback backend crítico. Cualquier cambio aquí puede romper el show en vivo. Probar con .lux reales.
