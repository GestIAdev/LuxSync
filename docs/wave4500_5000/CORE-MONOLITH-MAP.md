# WAVE 3503 - CORE MONOLITH MAP

Estado: Auditoria estructural
Alcance: TitanOrchestrator, TitanEngine, MasterArbiter, Senses (worker)
Condicion: Cero modificaciones de codigo

## 1) Flujo del Frame (Main Loop)

### 1.1 Tick Master

El Tick Master principal del sistema es TitanOrchestrator:

- Bucle maestro: setInterval cada 23 ms (~44 Hz) en start().
- Punto de latido: processFrame().
- Guardia de concurrencia: isProcessingFrame evita overlap de frames async.

Referencias:
- [TitanOrchestrator start](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L580)
- [setInterval 23ms](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L591)
- [processFrame](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L723)

Nota estructural: Senses tambien tiene su propio reloj interno de analisis (poll SAB cada 21 ms), pero no despacha DMX. Ese reloj alimenta datos de audio, no gobierna la salida final a HAL.

Referencias:
- [Senses INIT + poll SAB](electron-app/src/workers/senses.ts#L1370)
- [setInterval poll 21ms](electron-app/src/workers/senses.ts#L1379)

### 1.2 Entrada de audio hasta el contexto musical

Hay dos caminos de entrada que convergen en TitanOrchestrator:

Camino A - Core bands desde frontend

1. Frontend envia bandas ya resumidas (bass/mid/high/energy).
2. TitanOrchestrator las consume en processAudioFrame() y actualiza lastAudioData.

Referencias:
- [processAudioFrame](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L2056)

Camino B - Buffer crudo hacia worker Senses

1. Frontend envia Float32Array crudo.
2. TitanOrchestrator llama trinity.feedAudioBuffer(buffer).
3. TrinityOrchestrator enruta a BETA (o al AudioMatrix/SAB segun fuente activa).
4. Senses procesa buffer con processAudioBuffer() y emite AUDIO_ANALYSIS.
5. TrinityOrchestrator recibe AUDIO_ANALYSIS, emite evento audio-analysis y lo reenvia a GAMMA.
6. TrinityBrain escucha audio-analysis/context-update, construye/actualiza MusicalContext y emite audio-levels.
7. TitanOrchestrator escucha brain.on('audio-levels') y fusiona esos datos en lastAudioData.

Referencias:
- [TitanOrchestrator processAudioBuffer -> trinity.feedAudioBuffer](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L2124)
- [TrinityOrchestrator feedAudioBuffer](electron-app/src/workers/TrinityOrchestrator.ts#L629)
- [Senses processAudioBuffer](electron-app/src/workers/senses.ts#L636)
- [Senses send AUDIO_ANALYSIS](electron-app/src/workers/senses.ts#L1465)
- [TrinityOrchestrator case AUDIO_ANALYSIS](electron-app/src/workers/TrinityOrchestrator.ts#L436)
- [TrinityBrain connectToOrchestrator](electron-app/src/brain/TrinityBrain.ts#L68)
- [TrinityBrain emit audio-levels](electron-app/src/brain/TrinityBrain.ts#L227)
- [TitanOrchestrator brain.on(audio-levels)](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L384)

### 1.3 Cadena por frame: de contexto musical a HAL

Secuencia exacta del frame en processFrame():

1. TitanOrchestrator obtiene contexto desde brain.getCurrentContext().
2. TitanOrchestrator calcula/compone engineAudioMetrics (incluyendo BPM/beatPhase/syncopation y metrica worker/PLL).
3. TitanEngine.update(context, engineAudioMetrics) retorna LightingIntent.
4. TitanOrchestrator inyecta Layer 0 en MasterArbiter con setTitanIntent().
5. TitanOrchestrator toma salida de EffectManager, resuelve zonas a fixtures y arma EffectIntentMap.
6. TitanOrchestrator inyecta intents en MasterArbiter con setEffectIntents().
7. MasterArbiter.arbitrate() compone target final multicapa.
8. HAL.renderFromTarget(arbitratedTarget, fixtures, halAudioMetrics) transforma a fixtureStates.
9. TitanOrchestrator aplica overlay de Hephaestus sobre fixtureStates (si hay clips activos y tier lo permite).
10. TitanOrchestrator publica hot-frame/full-truth para UI.
11. HAL.flushToDriver(fixtureStates) envia al driver fisico (aduana DMX + flush hardware).

Referencias:
- [getCurrentContext](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L758)
- [engine.update](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1016)
- [setTitanIntent](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1029)
- [getCombinedOutput](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1044)
- [setEffectIntents](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1194)
- [arbitrate](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1203)
- [renderFromTarget](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1259)
- [Hephaestus merge block](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1319)
- [flushToDriver](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1539)

## 2) Acoplamiento de Responsabilidades (Code Smells)

### 2.1 TitanOrchestrator asume logica de dominio no solo de orquestacion

Hallazgo: TitanOrchestrator no solo coordina modulos; tambien ejecuta calculo musical, gating, mezcla de capas y logica de aplicacion de efectos.

Evidencias de responsabilidad pesada dentro del Orquestador:

- Logica ritmica y temporal:
  - Staleness por fuente, umbrales diferenciados para Omni.
  - Integracion Worker BPM + memoria freewheel + tick PLL + override de onBeat.
  - Estimacion local de syncopation.
- Logica de audio smoothing:
  - EMA de bandas/métricas en el propio orquestador.
- Logica de composicion de effects:
  - Resolucion zona->fixture.
  - Fusion HTP y construccion manual de EffectIntent por fixture.
  - Conversion HSL->RGB para capa de efectos.
- Logica de overlay post HAL:
  - Merge de Hephaestus por fixture y por zona dentro del tick principal.
- Logica de salida UI:
  - Construccion de hot frame y SeleneTruth extensivo.

Referencias:
- [BPM/freewheel/PLL en processFrame](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L839)
- [syncopation/metricas engineAudioMetrics](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L928)
- [EffectIntentMap armado en orquestador](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1049)
- [merge Hephaestus post HAL](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1319)
- [hslToRgb dentro del orquestador](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L2277)

Diagnostico de olor: el Orquestador es simultaneamente scheduler, compositor de efectos, adaptador musical y ensamblador de payload UI.

### 2.2 MasterArbiter concentra ruteo + composicion + movimiento

Hallazgo: MasterArbiter no es solo arbitraje de capas; tambien incorpora routing zonal, IK, patrones de movimiento, mezcla Chronos/Titan y protecciones de canal.

Evidencias:

- Routing zonal y fallback wildcard en getFixtureIdsByZone().
- Resolucion IK de target espacial y escritura de overrides manuales.
- Modo playback hibrido dentro de arbitrate() con reglas HTP/LTP/ADD por canal.
- Calculos de movimiento/patron y postprocesado de release fade pan/tilt.

Referencias:
- [getFixtureIdsByZone](electron-app/src/core/arbiter/MasterArbiter.ts#L402)
- [applySpatialTarget con IK](electron-app/src/core/arbiter/MasterArbiter.ts#L666)
- [arbitrate modo playback hibrido](electron-app/src/core/arbiter/MasterArbiter.ts#L1519)
- [arbitrateFixture + position release fade](electron-app/src/core/arbiter/MasterArbiter.ts#L1888)

Diagnostico de olor: el Arbiter tambien actua como motor de mezcla de reproduccion y gestor de movimiento, no solo como compositor de prioridad de capas.

### 2.3 TitanEngine mantiene frontera mas limpia, pero con injertos transversales

Hallazgo: TitanEngine conserva la intencion de motor puro (contexto musical -> LightingIntent), pero integra control de Chronos (phantom buffer/playhead), forzado de efectos, telemetria y decision de conciencia.

Referencias:
- [descripcion y frontera declarada](electron-app/src/engine/TitanEngine.ts#L6)
- [setChronosInput/setChronosHeatmap/setChronosPlayhead](electron-app/src/engine/TitanEngine.ts#L321)
- [update con phantom injection y cronos overrides](electron-app/src/engine/TitanEngine.ts#L430)

Diagnostico de olor: menor que en Orquestador/Arbiter, pero hay mezcla de motor reactivo con control de timeline y telemetria operativa.

### 2.4 Senses es otro God File funcional

Hallazgo: Senses concentra DSP, BPM, gating espectral, mood, empaquetado de AudioAnalysis y ciclo de vida de worker.

Referencias:
- [state + buffers + stats](electron-app/src/workers/senses.ts#L181)
- [processAudioBuffer gigante](electron-app/src/workers/senses.ts#L636)
- [message handler INIT/SHUTDOWN/AUDIO_BUFFER](electron-app/src/workers/senses.ts#L1364)

Diagnostico de olor: acopla analisis de audio con control de runtime de worker y politicas de telemetria.

## 3) Inyeccion de Dependencias y Estado

### 3.1 Como se comparten instancias

Patron dominante: mezcla de instanciacion local + singletons globales + event bus.

En TitanOrchestrator:

- Instanciacion directa:
  - new TrinityBrain()
  - new TitanEngine()
  - new HardwareAbstraction()
- Obtencion singleton/global:
  - getTrinity()
  - masterArbiter (import singleton)
  - getEffectManager()
  - getHephaestusRuntime()
  - universalDMX (singleton)
  - vibeMovementManager (singleton)
  - MoodController.getInstance()
- Acoplamiento por eventos:
  - brain.on(audio-levels)
  - trinity on context/audio-analysis via TrinityBrain

Referencias:
- [TitanOrchestrator imports y campos](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L13)
- [init: new Brain/Engine/HAL + getTrinity](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L348)
- [MasterArbiter singleton import](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L26)

En MasterArbiter:

- Estado interno largo de vida por Maps/Sets (fixtures, overrides, patrones, playback frame).
- Dependencia interna a CrossfadeEngine e IK solver.

Referencias:
- [MasterArbiter class state](electron-app/src/core/arbiter/MasterArbiter.ts#L120)

En Senses:

- Estado de worker modulo-global (state, trackers, analyzers, buffers).
- Entradas por message protocol y SAB.

Referencias:
- [state y setup SAB](electron-app/src/workers/senses.ts#L100)

Diagnostico de acoplamiento: coexistencia de singletons fuertes y dependencias inyectadas localmente, con ownership de estado distribuido entre modulos de larga vida.

### 3.2 Donde reside el estado pesado (riesgo de cuello de memoria/escala)

Puntos de acumulacion principal:

1. TitanOrchestrator
- lastAudioData, smoothedMetrics, peakHoldMap, pools de Hephaestus, fixture arrays.
- Construccion de payload truth/hot-frame sobre fixtureStates cada tick.

Referencias:
- [estado y pools en Orchestrator](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L177)
- [hot-frame + truth mapping de fixtures](electron-app/src/core/orchestrator/TitanOrchestrator.ts#L1500)

2. MasterArbiter
- fixtures map, layer2_manualOverrides, currentPlaybackFrame, layer3_effectIntents,
  crossfade state, caches de origen, positionReleaseFades, buffers forenses.

Referencias:
- [estado del Arbiter](electron-app/src/core/arbiter/MasterArbiter.ts#L120)
- [arbitrate loop por fixture](electron-app/src/core/arbiter/MasterArbiter.ts#L1519)

3. TitanEngine
- estado del motor por frame y, especialmente, chronosHeatmap (buffer de banda por timeline),
  chronos overrides y caches de salida cognitiva.

Referencias:
- [chronosHeatmap y playhead state](electron-app/src/engine/TitanEngine.ts#L248)

4. Senses worker
- ringBuffer 4096 + snapshotBuffer 4096 + trackers + logica de dump de shadow frames.
- analisis continuo con estado mutable de largo ciclo.

Referencias:
- [buffers y estado worker](electron-app/src/workers/senses.ts#L220)
- [shadow logger](electron-app/src/workers/senses.ts#L375)

Diagnostico de escala: el estado es mayormente lineal por fixture/overlay, pero la combinacion de:

- multiples mapas por fixture,
- composicion por capa en cada frame,
- overlays adicionales post HAL,
- broadcast de estructuras grandes,

convierte al Orquestador+Arbiter en el principal punto de presion de CPU/memoria cuando crece el numero de sub-emisores.

## 4) Mapa de Dependencias Clinico

Dependencias directas visibles en los God Files auditados:

- TitanOrchestrator depende de:
  - TrinityBrain
  - TitanEngine
  - HardwareAbstraction
  - TrinityOrchestrator (worker bridge)
  - MasterArbiter singleton
  - EffectManager singleton
  - HephaestusRuntime singleton
  - universalDMX singleton
  - vibeMovementManager singleton
  - MoodController singleton

- TitanEngine depende de:
  - VibeManager singleton
  - SeleneColorEngine/Interpolator
  - Stabilizers (Key/Energy/Mood/Strategy)
  - SeleneLux (reactividad)
  - SeleneTitanConscious
  - EffectManager singleton
  - ChronosInjector singleton

- MasterArbiter depende de:
  - CrossfadeEngine
  - ZoneMapper
  - InverseKinematicsEngine
  - MergeStrategies

- Senses depende de:
  - GodEarAnalyzer
  - IntervalBPMTracker
  - analyzers de rhythm/harmony/section
  - worker protocol (parentPort/message)
  - SharedRingBufferReader (SAB)

Lectura forense: el eje real del monolito operativo no es un solo archivo, sino la pareja TitanOrchestrator + MasterArbiter, con Senses como proveedor de señal y TitanEngine como generador de intencion.

## 5) Diagnostico de Maximo Acoplamiento

Nodos de mayor acoplamiento observados:

1. TitanOrchestrator
- Es scheduler de frame, puente audio, compositor de intents, integrador de overlays, broadcaster UI y despachador HAL.
- Es el punto de convergencia de casi todas las dependencias de larga vida.

2. MasterArbiter
- Es merge multicapa, motor de playback hibrido, ruteador zonal, y tambien gestor de movimiento/IK y transiciones.

3. Frontera Orchestrator-Arbiter-HAL
- Mucha logica de negocio cruza esta frontera por frame:
  - setTitanIntent
  - setEffectIntents
  - arbitrate
  - renderFromTarget
  - overlay Hephaestus
  - flushToDriver

Resultado clinico: el pipeline central es funcional y determinista, pero con alta densidad de responsabilidades en pocos nodos. El acoplamiento maximo esta concentrado en el camino TitanOrchestrator -> MasterArbiter -> HAL, alimentado por Senses/TrinityBrain.
