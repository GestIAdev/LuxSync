FASE 1 Completada — Núcleo Inmutable .lux V3
El schema V3 ya existe como constitución, testeado y compilando. 22/22 tests verdes, tsc limpio.

Archivos creados ([c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/chronos/core/:0:0-0:0))
@/electron-app/src/chronos/core/LuxFileV3.ts — El schema núcleo. LuxFileV3 (disco) + ChronosProjectV3 (runtime). Sub-tipos: meta, audio portable, análisis FFT embebido, vibeBase (whisper), tracks, clips unificados (vibe+fx), markers, safety.
@/electron-app/src/chronos/core/LuxFileV3.schema.ts — Type guards. Hard-gate en $schema, rechaza cualquier cosa que no sea luxsync.lux/3.0. Exige FX clips con hephClip.schemaVersion === '3.0'.
@/electron-app/src/chronos/core/LuxFileV3.factories.ts — Constructores deterministas (sin Math.random) + puentes toChronosProjectV3 / toLuxFileV3.
@/electron-app/src/chronos/core/LuxFileV3.serializer.ts — Serialize/deserialize con checksum SHA-256 canónico (key-sorted = idempotente), universal browser+Node.
@/electron-app/src/chronos/__tests__/LuxFileV3.test.ts — 22 tests.
Decisiones de diseño clave
Matrimonio con .lfx V3 — los FXClips embeben HephAutomationClipV3 completo (Diamond Data self-contained). hephFilePath es solo referencia, NO se carga en runtime. La validación rechaza clips no-V3.
BPM (opción FFT + override) — detectedBpm se guarda en el .lux (audio + analysis). El runtime usa rBPM live del Worker → fallback a detectedBpm → fallback final 120. manualBpmOverride (efímero) gana. runtimeBpm NO se serializa.
Checksum tamper-proof — el test confirma que alterar el BPM en el JSON guardado dispara checksumValid: false.
Sin legacy — $schema mal → rechazo inmediato. Cero tolerancia V2.
Mejora de runtime que improvisé
ChronosProjectV3 separa limpiamente el contenido de disco del estado efímero (playheadMs, viewportStartMs, pixelsPerSecond, runtimeBpm, manualBpmOverride, selectedClipIds). Los puentes toLuxFileV3/toChronosProjectV3 garantizan que el estado de edición nunca contamine el archivo. Esto elimina la duplicación LuxProject vs ChronosProjectV2 del modelo viejo: un solo objeto, dos vistas.

Nota
El error de lint en tsconfig.json (--ignoreDeprecations) es preexistente y ajeno a estos archivos — no lo toqué.

La constitución está firmada. ¿Procedemos con la FASE 2 (demolición V2) o prefieres revisar primero el schema?