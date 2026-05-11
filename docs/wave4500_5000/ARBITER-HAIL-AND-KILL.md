# ARBITER UI DIAGNOSIS — PLAN DE PURGA A NODEARBITER

Checklist operativa para migrar todo lo crítico al NodeArbiter y eliminar el legado sin romper show.

## 1) Corte de dependencias Legacy en Frontend [WAVE 4651 OK]

- [x] Migrar Kinetics pattern/speed/amplitude para que NO use `window.lux.arbiter.setManualFixturePattern`. -> usa `window.lux.aether.setManualPattern` (KineticsBridge.ts)
- [x] Reemplazar hidratación de Kinetics (`getFixturesState`) por endpoint Aether equivalente. (WAVE 4701: `getL2State` + `getManualKineticState`, sin arbiter legacy)
- [x] Eliminar cualquier lectura/escritura de `window.lux.arbiter.*` en Kinetics para la ruta de pattern. Ruta Aether activa.
- [x] Validar que Unlock en Kinetics limpie estado local UI + L2 remoto en un solo flujo coherente. -> handleUnlockKinetics: releaseAll + aether.setManualPattern(null) + setActivePattern(none)

Archivos clave:
- `src/bridges/KineticsBridge.ts`
- `src/components/hyperion/kinetics/KineticsCathedral.tsx`
- `src/components/hyperion/kinetics/KinRadarViewport.tsx`

## 2) Sustitución de Stubs Legacy en Aether IPC [WAVE 4700 OK - motor nativo L2]

- [x] `lux:aether:setManualPattern`: ruta IPC es Aether. Motor cinematico en **AetherKineticEngine** (WAVE 4700). masterArbiter eliminado del flujo.
- [x] `lux:aether:applySpatialTarget`: ruta IPC es Aether. IK resolver temporalmente en masterArbiter hasta WAVE futura.
- [x] `lux:aether:releaseSpatialTarget`: ruta IPC es Aether. Release en masterArbiter hasta WAVE futura.
- [x] Quitar llamadas a `masterArbiter.setPattern()`, `masterArbiter.clearPattern()`, `masterArbiter.getCurrentPosition()` en IPC de kinetics. (**WAVE 4700** — eliminadas en AetherIPCHandlers)
- [x] `masterArbiter` importado en AetherIPCHandlers aún (necesario para blackout/grandmaster/spatial). No eliminar hasta WAVE futura de IK nativo.
- [x] `AetherKineticEngine`: motor nativo con acumulador de fase, 9 patrones, fan offset determinista, Speed/Amplitude escalares profesionales. Tick a 44Hz en TitanOrchestrator.
- [x] `lux:aether:updateKineticScalars`: nuevo canal para actualizar speed/amplitude/fan sin reiniciar fase (para sliders en tiempo real).
- [x] `lux:aether:setKineticFanOffsets`: canal legacy mantenido como no-op para compatibilidad con KineticsBridge WAVE 4717.2. El fan se integra nativamente en tick().

Archivos clave:
- `src/core/aether/AetherIPCHandlers.ts`
- `src/core/aether/AetherKineticEngine.ts` **(nuevo WAVE 4700)**
- `src/core/orchestrator/TitanOrchestrator.ts`

## 3) Estado y Feedback UI (hidratación completa) [WAVE 4653 OK - Truth Mirror]

- [x] Diseñar contrato de estado L2 desde NodeArbiter para hidratar UI completa (impact/color/kinetic/beam/extras).  
  → `NodeArbiter.getManualOverridesForNodes(nodeIds)`
- [x] Implementar endpoint de lectura de estado en Aether IPC.  
  → `lux:aether:getL2State`
- [x] Conectar TheProgrammer + Kinetics a ese estado unificado.  
  → `TheProgrammer` hidrata `programmerStore` + `movementStore` desde snapshot L2.
- [x] Eliminar defaults engañosos al re-seleccionar fixtures (color/beam/pattern).  
  → `hydrateFromL2` usa estado real del L2 al cambiar selección.

Archivos clave:
- `src/stores/movementStore.ts`
- `src/stores/programmerStore.ts`
- `src/components/hyperion/controls/TheProgrammer.tsx`
- `src/components/hyperion/kinetics/KineticsCathedral.tsx`

## 4) Robustez del puente L2 (no perder cambios) [WAVE 4653 OK - Promise Glue]

- [x] Mover `consumeDirty()` a confirmación de éxito IPC (o cola con retry).  
  → `ProgrammerAetherBridge` limpia dirty solo en `Promise.all(...).then(...)`.
- [x] Añadir reintento/backoff para fallos IPC temporales.  
  → si IPC falla, dirty flags persisten y el tick 44Hz reintenta automáticamente.
- [x] Garantizar orden de flush por familia para evitar condiciones de carrera.  
  → limpieza selectiva por snapshot (`consumeDirtyFamilies`) evita borrar cambios nuevos.
- [x] Añadir métricas/log de dropped updates.  
  → `ProgrammerAetherBridge` emite `console.warn` detallado con fixtures/set/clear/families en reintentos IPC.

Archivos clave:
- `src/bridges/ProgrammerAetherBridge.ts`

## 5) Migración de controles críticos de sistema [WAVE 4652 OK - Blackout + GrandMaster]

- [x] Definir API equivalente en Aether para output gate (arm/live), blackout y grand master.  
  → `window.lux.aether.setBlackout / setGrandMaster / setGrandMasterSpeed` — commit `c49f4fa1`
- [x] Migrar CommandDeck al nuevo API.  
  → `handleGrandMasterChange` + `handleGrandMasterSpeedChange` → `aether.*`
- [x] Migrar BlackoutButton/KeyboardProvider al nuevo API.  
  → `BlackoutButton`, `KeyboardProvider` → `aether.setBlackout()`
- [x] Migrar hooks MIDI (`arb-*`) al nuevo namespace y acciones.  
  → `useMidiLearn` arb-blackout + arb-grand-master → `aether.*`
- [x] Migrar BlackoutOverlay (si usa arbiter directamente — pendiente de auditoría).  
  → `BlackoutOverlay` y blackout MIDI (`useMidiLearn`) usan `window.lux.aether.setBlackout`.
- [x] Migrar output gate (arm/live/GO) — pendiente WAVE futura.  
  → `CommandDeck` opera por `window.lux.aether.setOutputEnabled`; sin rutas legacy de output en UI activa.

Archivos clave:
- `src/components/commandDeck/CommandDeck.tsx`
- `src/components/commandDeck/BlackoutButton.tsx`
- `src/components/layout/BlackoutOverlay.tsx`
- `src/providers/KeyboardProvider.tsx`
- `src/hooks/useMidiLearn.ts`
- `src/midi/MidiActionRegistry.ts`

## 6) Sync de fixtures y playback al grafo Aether

- [ ] Mover `setFixtures` de TitanSyncBridge a endpoint Aether/NodeGraph.
- [ ] Migrar Playback fixture sync para no tocar `masterArbiter.setFixtures`.
- [ ] Confirmar que Zone mapping y routing funcionen con fixture source único.
- [ ] Mantener compatibilidad con `isPlaced`, orientación y metadatos de IK.

Archivos clave:
- `src/core/sync/TitanSyncBridge.tsx`
- `electron/ipc/PlaybackIPCHandlers.ts`
- `src/core/orchestrator/TitanOrchestrator.ts`

## 7) Boot y exposición IPC/preload

- [ ] Dejar de registrar handlers legacy en arranque.
- [ ] Remover API `window.lux.arbiter` del preload cuando no queden consumidores.
- [ ] Limpiar tipos en `vite-env.d.ts` para el nuevo surface Aether-only.
- [ ] Eliminar handlers duplicados en `core/orchestrator/ArbiterHandlers.ts` si no se usan.

Archivos clave:
- `electron/main.ts`
- `electron/preload.ts`
- `src/vite-env.d.ts`
- `src/core/arbiter/ArbiterIPCHandlers.ts`
- `src/core/orchestrator/ArbiterHandlers.ts`

## 8) HAL / Runtime dependencias que hoy leen masterArbiter

- [ ] Definir fuente única de `outputEnabled` y `blackout` para HAL sin depender de `masterArbiter`.
- [ ] Revisar `renderFromTarget` para asegurar que el target venga del pipeline unificado.
- [ ] Migrar consultas runtime de fixtures por zona que aún pasan por `masterArbiter`.

Archivos clave:
- `src/hal/HardwareAbstraction.ts`
- `src/core/engine/TimelineEngine.ts`
- `src/core/hephaestus/runtime/HephaestusRuntime.ts`
- `src/core/zones/ZoneMapper.ts`

## 9) Limpieza final (exterminio)

- [ ] Buscar y eliminar todas las referencias residuales a `window.lux.arbiter`.
- [ ] Buscar y eliminar todas las referencias residuales a `masterArbiter` fuera de capa de compat temporal.
- [ ] Borrar código legacy comentado que mantenga ambigüedad de arquitectura.
- [ ] Eliminar documentación obsoleta que hable de doble arbitraje activo.

## 10) Criterios de salida (Definition of Done)

- [ ] `TS_EXIT=0` en compilación node y renderer.
- [ ] 0 resultados para `window.lux.arbiter` en `src/` (excepto shim temporal explícito si se decide).
- [ ] 0 rutas de runtime que hagan write a `masterArbiter` para control manual/UI.
- [ ] Unlock limpia UI y backend en el mismo frame lógico (sin reaparición fantasma).
- [ ] Kinetics + TheProgrammer controlan hardware y se rehidratan coherentemente tras selección/cambio de vista.
- [ ] Smoke test show: sin regresiones en GO/Blackout/GrandMaster/Playback.

## 11) Orden recomendado de ejecución

- [ ] Fase A: Kinetics + Aether stubs (bloqueadores directos de control manual).
- [ ] Fase B: estado/hidratación + robustez de dirty flags.
- [ ] Fase C: CommandDeck/Blackout/MIDI.
- [ ] Fase D: setFixtures/sync/playback.
- [ ] Fase E: boot/preload/tipos + purga total.

