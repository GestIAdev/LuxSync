# LUXSYNC AETHER ARCHITECTURE MAP

WAVE 4550
Fecha de auditoria: runtime actual (codigo fuente, no blueprint).

## 1. Resumen ejecutivo

LuxSync corre hoy con arquitectura dual en el loop principal:

- Pipeline legacy operativo de punta a punta (MasterArbiter + HAL render/flush).
- Pipeline Aether operativo en frame loop, pero condicionado a registro explicito de devices Aether.
- El puente StageStore -> backend SI existe y es estable.
- El puente StageStore -> ingestion nativa Aether (NodeExtractionPipeline/SpatialRegistrar) NO aparece cableado en ruta productiva inspeccionada.

Conclusion dura: Aether esta vivo en el corazon del runtime, pero su onboarding de fixtures aun depende de rutas parciales/explicitas y no del flujo principal de patching.

---

## 2. Estado por subsistema

### Activo en runtime

1. StageStore -> TitanSyncBridge -> IPC Arbiter sync.
2. lux:arbiter:setFixtures -> MasterArbiter + TitanOrchestrator.setFixtures.
3. Titan frame loop dual (legacy + Aether en el mismo tick).
4. HAL egress doble: flushToDriver (legacy) y sendUniverseRaw (Aether).
5. ProgrammerAetherBridge 44Hz -> Aether IPC manual overrides/inhibit.
6. Adapters Aether L0/L3/LP/L3+ integrados en processFrame.
7. Telemetria UI hot-frame/full-truth via transient store.

### Bridge/compat layer

1. Aether IPC E11/E12 (manual pattern/spatial) delega a MasterArbiter legacy.
2. Hephaestus convive en modo hibrido (Aether para fixtures en NodeGraph, legacy fallback para no registrados).
3. Chronos convive en LP bridge hacia Aether mientras mantiene superficie legacy de playback.

### Definido pero no cableado claramente en ruta principal

1. connectStageStoreToSpatialRegistrar existe exportado, sin callsite productivo detectado.
2. NodeExtractionPipeline aparece como modulo y tests, sin uso productivo directo detectado en flujo Stage patch -> runtime.
3. TitanOrchestrator.setFixtures actualiza bounds Aether, pero no ingesta devices al NodeGraph desde fixtures stage.

---

## 3. Evidence map (source-backed)

### 3.1 Ingreso de fixtures (frontend -> main)

- TitanSyncBridge suscribe stageStore y envia setFixtures por IPC:
  - electron-app/src/core/sync/TitanSyncBridge.tsx:134
  - electron-app/src/core/sync/TitanSyncBridge.tsx:195
  - electron-app/src/core/sync/TitanSyncBridge.tsx:219
- Handler principal de sync en main:
  - electron-app/src/core/arbiter/ArbiterIPCHandlers.ts:932
  - electron-app/src/core/arbiter/ArbiterIPCHandlers.ts:937
  - electron-app/src/core/arbiter/ArbiterIPCHandlers.ts:942
- setFixtures del orchestrator hoy:
  - normaliza fixtures
  - actualiza stage bounds Aether
  - registra en MasterArbiter
  - registra movers en HAL
  - sin ingestion explicita a NodeGraph desde este flujo
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:2440
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:2461
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:2488

### 3.2 Runtime frame loop dual

- Scheduler y processFrame:
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:206
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:922
- Activacion bloque Aether por _aetherHasDevices:
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:323
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:1620
- Egreso Aether directo por universo:
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:1803
  - electron-app/src/hal/HardwareAbstraction.ts:1768
- Legacy flush:
  - electron-app/src/hal/HardwareAbstraction.ts:1753

### 3.3 Core Aether

- IntentBus zero-alloc y clear per frame:
  - electron-app/src/core/aether/IntentBus.ts:125
  - electron-app/src/core/aether/IntentBus.ts:318
- NodeArbiter capas/manual/inhibit:
  - electron-app/src/core/aether/NodeArbiter.ts:51
  - electron-app/src/core/aether/NodeArbiter.ts:114
  - electron-app/src/core/aether/NodeArbiter.ts:155
  - electron-app/src/core/aether/NodeArbiter.ts:302
- NodeResolver resolve + Forge bypass path:
  - electron-app/src/core/aether/resolver/NodeResolver.ts:138
  - electron-app/src/core/aether/resolver/NodeResolver.ts:234
  - electron-app/src/core/aether/resolver/NodeResolver.ts:283
  - electron-app/src/core/aether/resolver/NodeResolver.ts:343

### 3.4 Adapters y capas de decision

- Liquid ingress:
  - electron-app/src/core/aether/adapters/LiquidAetherAdapter.ts:181
- Selene L3 ingress:
  - electron-app/src/core/aether/adapters/selene-aether-adapter.ts:125
  - electron-app/src/core/aether/adapters/selene-aether-adapter.ts:186
- Chronos LP ingress:
  - electron-app/src/core/aether/adapters/ChronosAetherAdapter.ts:24
  - electron-app/src/core/aether/adapters/ChronosAetherAdapter.ts:61
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:1744
- Hephaestus L3+ ingress:
  - electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:31
  - electron-app/src/core/aether/adapters/HephaestusAetherAdapter.ts:52
  - electron-app/src/core/orchestrator/TitanOrchestrator.ts:1755

### 3.5 Programmer bridge y IPC Aether

- Bridge 44Hz dirty-flush:
  - electron-app/src/bridges/ProgrammerAetherBridge.ts:10
  - electron-app/src/bridges/ProgrammerAetherBridge.ts:127
  - electron-app/src/bridges/ProgrammerAetherBridge.ts:148
  - electron-app/src/bridges/ProgrammerAetherBridge.ts:181
- Handlers Aether registrados en startup:
  - electron-app/electron/main.ts:572
- IPC manual overrides/inhibit:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:45
  - electron-app/src/core/aether/AetherIPCHandlers.ts:124
- E11/E12 bridge a legacy:
  - electron-app/src/core/aether/AetherIPCHandlers.ts:195
  - electron-app/src/core/aether/AetherIPCHandlers.ts:240

### 3.6 Stage + UI planes

- Stage IPC enfocado en open/save dialog/persistencia, no wiring Aether explicito:
  - electron-app/src/core/stage/StageIPCHandlers.ts:154
  - electron-app/src/core/stage/StageIPCHandlers.ts:213
- StageStore hidrata fixtures del show:
  - electron-app/src/stores/stageStore.ts:355
- Hot-frame + truth a transient store:
  - electron-app/src/hooks/useSeleneTruth.ts:104
  - electron-app/src/hooks/useSeleneTruth.ts:179
- Packing para render worker:
  - electron-app/src/workers/HyperionRenderBuffer.ts:31

### 3.7 Ingestion spatial/extraction

- SpatialRegistrar existe y ofrece conector stage-store:
  - electron-app/src/core/aether/ingestion/SpatialRegistrar.ts:196
  - electron-app/src/core/aether/ingestion/SpatialRegistrar.ts:599
- NodeExtractionPipeline existe (modulo y tests), sin callsite productivo directo detectado:
  - electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:210

---

## 4. Runtime flow real (hoy)

1. Usuario modifica patch/stage.
2. StageStore cambia fixtures.
3. TitanSyncBridge detecta hash y manda lux:arbiter:setFixtures.
4. ArbiterIPCHandlers sincroniza MasterArbiter y TitanOrchestrator.setFixtures.
5. processFrame corre pipeline legacy completo.
6. Si hay devices Aether registrados, corre bloque Aether completo y envia universos raw.
7. UI recibe hot-frame/full-truth por canales separados para render y paneles.

Observacion clave:
setFixtures no construye ni registra automaticamente devices Aether desde fixtures stage.
Por tanto, la condicion _aetherHasDevices decide si el pipeline Aether realmente emite DMX o queda como no-op operacional.

---

## 5. Chokepoints de migracion

1. Chokepoint A - Fixture onboarding a Aether:
   - Falta ruta canonica Stage fixtures -> extraction/registration Aether.
   - Impacto: Aether depende de registros parciales/manuales.

2. Chokepoint B - Doble autoridad temporal:
   - Legacy y Aether pueden coexistir por frame.
   - Se requiere politica explicita por fixture/universe para evitar conflictos en fases de coexistencia.

3. Chokepoint C - E11/E12 aun legacy-backed:
   - Manual kinetic/spatial etiquetado Aether todavia ejecuta en MasterArbiter.
   - Impacto: deuda de semantica y trazabilidad de capa.

4. Chokepoint D - Observabilidad de ownership:
   - Falta bit de ownership visible por fixture (legacy vs Aether) en telemetria de operador.

---

## 6. Propuesta de cierre arquitectonico (sin hacks)

1. Introducir un AetherFixtureIngestionService en main:
   - Entrada: fixtures normalizados (los mismos de setFixtures).
   - Salida: device registration idempotente en NodeGraph + SpatialRegistrar.

2. Integrarlo en un unico punto canonico:
   - justo despues de normalizacion dentro de TitanOrchestrator.setFixtures o en ArbiterIPCHandlers antes de setFixtures.
   - Regla: un source of truth de fixture ingestion.

3. Definir ownership explicito por fixture:
   - estado: legacy_only, aether_only, hybrid_bridge.
   - Enviar ownership en hot-frame para auditoria visual.

4. Extraer E11/E12 del legacy:
   - implementar kinetic/spatial nativo en capa Aether o declarar oficialmente la permanencia de bridge.

5. Gate de salida determinista por universe:
   - tabla de ruteo universe -> owner pipeline para eliminar competencia de escritura.

---

## 7. Riesgos activos

1. Riesgo funcional: Aether pipeline activo pero sin fixtures registrados en flujos de patch normales.
2. Riesgo de regresion: cambios en stage syncing pueden impactar ambos pipelines en simultaneo.
3. Riesgo operativo: lectura de estado incompleta para operadores si ownership no esta expuesto.

---

## 8. Veredicto

La arquitectura actual ya contiene el nucleo Aether en runtime real, con performance-oriented design y bridges funcionales.
El bloqueo no es de motor, es de acoplamiento estructural en la puerta de entrada de fixtures.

El siguiente salto no requiere rehacer Titan: requiere cerrar el circuito de ingestion canonica y ownership determinista de salida.
