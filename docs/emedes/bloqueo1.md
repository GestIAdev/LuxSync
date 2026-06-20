Auditoría completada. Aquí están los 4 puntos de fractura, amarrados con número de línea exacto.

FRACTURA 1: La Carrera de Promesas (Hydration Async Window)
stageStore.ts:374-375 y StageIPCHandlers.ts:76



typescript
@stageStore.ts:374-375
set({ isLoading: true, lastError: null, fileLockWarning: null,
  fixtures: [], groups: [], scenes: [], stage: null, visuals: null })
loadShowFile purga fixtures, groups, scenes y stage a vacío antes del await stageAPI.load(filePath) (línea 432). Durante esa ventana asíncrona, cualquier componente que lea useStageStore(s => s.fixtures) recibe un array vacío. La Kinetic Catedral ve cero fixtures y entra en estado 'empty' o 'static-warning'.

Además, en setupStageStoreListeners (línea 1122), lux.stage.loadActive() dispara la carga del show al boot. El backend hidrata y emite lux:stage:loaded. Si el renderer también invoca loadShowFile, ambas rutas convergen en _syncDerivedState(), ejecutándose dos veces sobre el mismo store.

FRACTURA 2: El Silenciador del Keyforge (Default Groups Missing)
stadiumLoadout.ts:34-42 y KeyActionDispatcher.ts:175-179 y ShowFileMigrator.ts:326-387



typescript
@stadiumLoadout.ts:34-42
{ layer: 'base', key: '1', actionId: 'sel-group-1', behavior: { kind: 'tap' } },
// ... 2-9
KeyForge carga los bindings sel-group-1..9 en el boot (AppCommander.tsx:56). Cuando el operador pulsa 1, KeyActionDispatcher busca el grupo en stageStore.groups:



typescript
@KeyActionDispatcher.ts:175-179
if (groupIds.length > 0) {
  selStore.selectMultiple(groupIds, 'replace')
} else {
  console.log(`[KeyForge] sel-group-${groupMatch[1]}: group not found or empty.`)
}
El problema: los grupos por defecto del sistema (por zona, por tipo, "All Fixtures") solo se generan durante la migración V1→V2 (ShowFileMigrator.ts:326-387). Si el show es V2 nativo (creado con createEmptyShowFile o cargado directamente), showFile.groups es []. Los atajos de KeyForge existen, pero al no encontrar grupos, absorben la pulsación silenciosamente (return true) sin hacer nada.

FRACTURA 3: El Desacople del Store de la Catedral (Selection Orphan)
KinRadarViewport.tsx:56 y stageStore.ts:484 vs stageStore.ts:371



typescript
@KinRadarViewport.tsx:56
if (selectedCount === 0) return 'empty'
La Catedral evalúa selectedIds (de useSelectionStore) y stageFixtures (de useStageStore). Con cero selección, siempre devuelve 'empty'.

Crítico: loadShowFile nunca limpia la selección. Solo newShow llama a deselectAll() (stageStore.ts:484). En un boot limpio, selectedIds empieza vacío (new Set()). Al cargar un show, los fixtures existen en stageStore, pero nada los selecciona automáticamente. La Catedral renderiza:

"Select fixtures in the KIN sidebar to activate the radar"

El usuario interpreta esto como "no hay fixtures", cuando en realidad hay fixtures, pero nadie los seleccionó.

Además, KinRadarViewport.tsx:119-126 consulta hardware?.fixtures (del truthStore) para clasificar tipos. Los fixtures añadidos vía constructor (addFixture en stageStore.ts:594) nunca se sincronizan al backend, por lo que hardware?.fixtures no los conoce. El fallback a stageFixtures funciona, pero si hay discrepancia de tipo entre stores, el fixture se clasifica como estático.

FRACTURA 4: El Bloqueo del Estado Armed (Yield Gap durante Hydration)
TickEngine.ts:122 y TickEngine.ts:419 y TitanOrchestrator.ts:1036-1052



typescript
@TickEngine.ts:122
if (this._isHydrating) return
 
@TickEngine.ts:419
const intent = await this.engine.update(context, engineAudioMetrics)
El F2 Hydration Lock protege el inicio del tick, pero tick() es async. Tras pasar el guard de _isHydrating, llega a await this.engine.update(...) (línea 419). Ese await cede el event loop.

Mientras el tick está suspendido, setFixtures() puede ejecutarse (por ejemplo, desde hydrateBackendFromShow en StageIPCHandlers.ts:76 al cargar un show):



typescript
@TitanOrchestrator.ts:1036-1052
setFixtures(fixtures, stageBounds) {
  this._isHydrating = true
  try {
    this.fixtures = fixtures.map(...)
    return this.hydrationEngine.setFixtures(this.fixtures, stageBounds)
  } finally {
    this._isHydrating = false
  }
}
Dentro de hydrationEngine.setFixtures, _syncFixturesToAether hace:

unregisterDevice() de todos los dispositivos viejos
registerAetherDevice() de los nuevos
El NodeArbiter (_aetherArbiter) no se limpia explícitamente durante este swap. Cuando el tick suspendido en await reanuda, intent fue calculado contra el grafo antiguo, pero el código posterior accede al nuevo grafo con node IDs potencialmente diferentes. El Arbiter puede contener referencias stale en _manualOverrides, _l3DominatedChannels y _moverShieldNodeIds, lo que provoca que el constructor (carga de show) falle silenciosamente o tire cuando el motor está ARMED y el tick loop está activo.