# WAVE 4525.1 - CHRONOS TRACE (Legacy Current State)

## 1) Alcance y método

Este documento es una auditoría de estado actual (source-of-truth) del flujo Chronos -> sistema runtime en LuxSync.

Restricciones aplicadas:
- Solo investigación y documentación.
- Cero implementación Aether.
- Cero cambios funcionales en código.

Método:
- Trazado por callsites reales y hot-path de frame.
- Verificación de IPC frontend/main.
- Contraste entre contratos legacy declarados y cableado efectivo en runtime.

## 2) Resumen ejecutivo

Conclusión principal:
- Existen dos modelos de integración Chronos en el código:
1. Modelo Bridge Overrides (ChronosContext -> ChronosOverrides -> TitanEngine.setChronosInput).
2. Modelo Playback/Stage Commands (TimelineEngine + ChronosIPCBridge + IPCHandlers + Arbiter).

Estado actual verificado:
- El modelo 2 está activo en runtime.
- El modelo 1 está presente como contrato y tests, pero sin callsites productivos.

Evidencia clave de desacople del modelo 1:
- Definición de ingreso existe en [electron-app/src/engine/TitanEngine.ts](electron-app/src/engine/TitanEngine.ts#L345).
- Búsqueda de callsites en producción no encontró invocadores fuera de tests: [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L181), [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L259), [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L334), [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L365), [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L371), [electron-app/src/__tests__/verifyBridge.test.ts](electron-app/src/__tests__/verifyBridge.test.ts#L377).

## 3) Flujo activo A: Playback .lux -> TimelineEngine -> Arbiter -> Orchestrator

### 3.1 Frontend playback API

- El frontend de reproducción usa window.lux.playback en preload:
  - [electron-app/electron/preload.ts](electron-app/electron/preload.ts#L1286)
  - load: [electron-app/electron/preload.ts](electron-app/electron/preload.ts#L1292)
  - tick: [electron-app/electron/preload.ts](electron-app/electron/preload.ts#L1299)
  - stop: [electron-app/electron/preload.ts](electron-app/electron/preload.ts#L1306)

- Hook remoto que gobierna el reloj y manda ticks:
  - [electron-app/src/hooks/useScenePlayer.ts](electron-app/src/hooks/useScenePlayer.ts#L19)
  - [electron-app/src/hooks/useScenePlayer.ts](electron-app/src/hooks/useScenePlayer.ts#L134)
  - [electron-app/src/hooks/useScenePlayer.ts](electron-app/src/hooks/useScenePlayer.ts#L225)

### 3.2 Main process Playback IPC

- Handlers dedicados Playback:
  - [electron-app/electron/ipc/PlaybackIPCHandlers.ts](electron-app/electron/ipc/PlaybackIPCHandlers.ts#L63)
  - [electron-app/electron/ipc/PlaybackIPCHandlers.ts](electron-app/electron/ipc/PlaybackIPCHandlers.ts#L75)
  - [electron-app/electron/ipc/PlaybackIPCHandlers.ts](electron-app/electron/ipc/PlaybackIPCHandlers.ts#L81)

- Cableado en arranque:
  - [electron-app/electron/main.ts](electron-app/electron/main.ts#L453)

### 3.3 TimelineEngine como inyector real al Arbiter

- Tick runtime y escritura de overlay en Arbiter:
  - [electron-app/src/core/engine/TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L376)

- Semántica de overlay transparente:
  - Solo fixtures tocados por clips FX entran al frame de playback.
  - Stop limpia playback frame:
    - [electron-app/src/core/engine/TimelineEngine.ts](electron-app/src/core/engine/TimelineEngine.ts#L410)

- Estructura Arbiter para playback:
  - setPlaybackFrame: [electron-app/src/core/arbiter/ArbitrationDirector.ts](electron-app/src/core/arbiter/ArbitrationDirector.ts#L719)
  - stopPlayback: [electron-app/src/core/arbiter/ArbitrationDirector.ts](electron-app/src/core/arbiter/ArbitrationDirector.ts#L731)
  - isPlaybackActive: [electron-app/src/core/arbiter/ArbitrationDirector.ts](electron-app/src/core/arbiter/ArbitrationDirector.ts#L738)
  - fixtures protegidos playback: [electron-app/src/core/arbiter/ArbitrationDirector.ts](electron-app/src/core/arbiter/ArbitrationDirector.ts#L742)

### 3.4 Consumo en hot-path TitanOrchestrator

- El loop usa protección Chronos desde Arbiter en post-arbitraje / post-HAL:
  - lectura de fixtures protegidos: [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1138)
  - telemetría overlay playback activo: [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1237)

## 4) Flujo activo B: Stage Commands Chronos -> IPCHandlers

### 4.1 Emisión de comandos desde Chronos timeline

- Contrato de comando:
  - [electron-app/src/chronos/core/ChronosInjector.ts](electron-app/src/chronos/core/ChronosInjector.ts#L44)
- Tipos de command en dispatcher:
  - [electron-app/src/chronos/core/ChronosStageDispatcher.ts](electron-app/src/chronos/core/ChronosStageDispatcher.ts#L51)
- Emisiones observables:
  - vibe-change: [electron-app/src/chronos/core/ChronosStageDispatcher.ts](electron-app/src/chronos/core/ChronosStageDispatcher.ts#L191)
  - fx-trigger: [electron-app/src/chronos/core/ChronosStageDispatcher.ts](electron-app/src/chronos/core/ChronosStageDispatcher.ts#L214)
  - fx-stop: [electron-app/src/chronos/core/ChronosStageDispatcher.ts](electron-app/src/chronos/core/ChronosStageDispatcher.ts#L253)

### 4.2 Bridge a IPC backend

- Suscripción del bridge al injector:
  - [electron-app/src/chronos/bridge/ChronosIPCBridge.ts](electron-app/src/chronos/bridge/ChronosIPCBridge.ts#L294)

- Comandos IPC usados por bridge:
  - chronos:setVibe: [electron-app/src/chronos/bridge/ChronosIPCBridge.ts](electron-app/src/chronos/bridge/ChronosIPCBridge.ts#L76)
  - chronos:triggerFX: [electron-app/src/chronos/bridge/ChronosIPCBridge.ts](electron-app/src/chronos/bridge/ChronosIPCBridge.ts#L176)

### 4.3 IPCHandlers que materializan la inyección

- setVibe: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L236)
- triggerFX: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L268)
- triggerHeph: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L312)
- stopFX: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L393)
- load-heatmap: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L413)
- sync-playhead: [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L427)

- Hand-off a TitanOrchestrator para playhead/heatmap:
  - [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1970)
  - [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1980)

## 5) Flujo Bridge Overrides (legacy declarado, no cableado activo)

### 5.1 Contrato y semántica

- ChronosContext (output del motor Chronos):
  - [electron-app/src/chronos/core/types.ts](electron-app/src/chronos/core/types.ts#L800)

- Generación de context en ChronosEngine:
  - [electron-app/src/chronos/core/ChronosEngine.ts](electron-app/src/chronos/core/ChronosEngine.ts#L1071)
  - overrideMode: [electron-app/src/chronos/core/ChronosEngine.ts](electron-app/src/chronos/core/ChronosEngine.ts#L1085)
  - activeEffects: [electron-app/src/chronos/core/ChronosEngine.ts](electron-app/src/chronos/core/ChronosEngine.ts#L1121)
  - automationValues: [electron-app/src/chronos/core/ChronosEngine.ts](electron-app/src/chronos/core/ChronosEngine.ts#L1122)

- Transformación a ChronosOverrides:
  - interfaz: [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L54)
  - inject(context): [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L268)
  - applyToMusicalContext: [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L310)

### 5.2 Whisper vs Full (exacto en código)

- Detección modo whisper:
  - [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L321)

- Whisper:
  - blend de energía (comentado como 70/30 Chronos/live) en applyToMusicalContext.
  - evidencia: [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L325)

- Full:
  - fuerza completa del valor de intensidad Chronos (sin blend) en la misma rama.
  - evidencia: [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L329)

- Forced vibe tags sobre contexto musical:
  - [electron-app/src/chronos/bridge/ChronosInjector.ts](electron-app/src/chronos/bridge/ChronosInjector.ts#L340)

### 5.3 Punto de inyección previsto en Titan

- Entrada de overrides:
  - [electron-app/src/engine/TitanEngine.ts](electron-app/src/engine/TitanEngine.ts#L345)
- Aplicación de overrides al contexto musical del frame:
  - [electron-app/src/engine/TitanEngine.ts](electron-app/src/engine/TitanEngine.ts#L532)

### 5.4 Estado operacional real

- No se encontró callsite productivo de setChronosInput fuera de tests.
- Resultado: el pipeline de overrides existe, pero hoy no gobierna el frame loop productivo.

## 6) _forceProgress y scrubbing temporal

Cadena completa (funcional si hay overrides entrantes):
- TitanEngine.setChronosInput llama forceEffectProgress:
  - [electron-app/src/engine/TitanEngine.ts](electron-app/src/engine/TitanEngine.ts#L354)
- EffectManager.forceEffectProgress:
  - [electron-app/src/core/effects/EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L601)
- BaseEffect._forceProgress:
  - [electron-app/src/core/effects/BaseEffect.ts](electron-app/src/core/effects/BaseEffect.ts#L211)
- limpieza clearForcedProgress:
  - [electron-app/src/core/effects/EffectManager.ts](electron-app/src/core/effects/EffectManager.ts#L625)
  - [electron-app/src/core/effects/BaseEffect.ts](electron-app/src/core/effects/BaseEffect.ts#L233)

Diagnóstico:
- La mecánica de scrubbing existe y está bien encadenada.
- Pero depende de que alguien alimente setChronosInput en runtime.
- Con el cableado actual, su activación real queda acotada al flujo bridge de tests/no productivo.

## 7) Diamond Data (Hephaestus) hasta DMX

### 7.1 Entrada Diamond por Chronos IPC

- triggerFX recibe hephCurves serializadas y deserializa:
  - [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L268)
  - [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L275)

- Runtime singleton Hephaestus:
  - [electron-app/src/core/orchestrator/IPCHandlers.ts](electron-app/src/core/orchestrator/IPCHandlers.ts#L14)

### 7.2 Ejecución runtime de curvas

- playFromClip inline Diamond:
  - [electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts](electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts#L369)
- evaluador de curvas:
  - [electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts](electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts#L379)
- tick runtime:
  - [electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts](electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts#L468)
- escalado DMX:
  - [electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts](electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts#L545)

### 7.3 Integración final en Orchestrator

- El Orchestrator realiza merge post-HAL de salidas Hephaestus (pipeline oficial actual para Heph), manteniendo protección de fixtures en playback Chronos.
- Evidencia de bloque de integración y contexto de merge:
  - [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1237)
  - [electron-app/src/core/orchestrator/TitanOrchestrator.ts](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1268)

## 8) Incompatibilidades con bus atómico Aether (diagnóstico)

Sin diseñar integración nueva, incompatibilidades estructurales detectadas:

1. Granularidad de mensaje
- Chronos legacy emite comandos de alto nivel (vibe-change, fx-trigger, fx-stop) y overlays de fixture frame.
- Aether consume intents atómicos por nodo/familia.
- Brecha: semántica de evento macro vs intent atómico por canal/parámetro.

2. Doble paradigma de inyección coexistente
- Pipeline A: TimelineEngine -> Arbiter playback frame.
- Pipeline B: Bridge Overrides -> TitanEngine.setChronosInput (dormante).
- Brecha: una migración limpia a bus atómico exige una sola superficie de entrada autoritativa.

3. Temporalidad desacoplada
- Playback tick llega por IPC desde frontend (rAF + reloj audio/silent): [electron-app/src/hooks/useScenePlayer.ts](electron-app/src/hooks/useScenePlayer.ts#L225).
- Aether vive en loop del Orchestrator.
- Brecha: sincronización inter-loop y ownership temporal del frame.

4. Mezcla post-HAL para Hephaestus
- Hay integración post-HAL para Heph en loop legacy.
- Aether define su propia secuencia de arbitraje/resolución/buffer.
- Brecha: dos puntos de verdad para composición final si coexisten sin frontera explícita.

5. Estado implícito en Arbiter playback
- Chronos playback protege fixtures por estado interno de Arbiter.
- Aether usa bus e intents por capa.
- Brecha: protección por estado global implícito vs contratos de ownership explícito por intent.

## 9) Mapa final de verdad (estado actual)

Ruta efectivamente activa hoy:
- Frontend Chronos playback/commands -> IPC -> TimelineEngine y/o IPCHandlers -> Arbiter/Titan/Heph -> TitanOrchestrator frame loop.

Ruta legacy declarada pero no activa por callsite:
- ChronosEngine.generateContext -> bridge ChronosInjector.inject -> TitanEngine.setChronosInput.

## 10) Veredicto de auditoría

- El sistema sí tiene una interfaz de salida Chronos funcional y en producción, pero centrada en:
  - Stage Commands por IPC.
  - Playback frame overlay vía TimelineEngine/Arbiter.
  - Diamond Data por HephaestusRuntime.

- La interfaz de overrides whisper/full existe en código y define claramente su comportamiento, pero no aparece conectada al hot-path productivo actual por ausencia de invocación runtime de setChronosInput.

- Para cualquier evolución futura (incluida Aether), primero hay que decidir qué superficie legacy es la fuente única de verdad, porque hoy conviven dos contratos con distinto grado de activación.
