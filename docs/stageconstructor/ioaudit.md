AUDITORÍA DE INSPECCIÓN — FASE 3 (I/O SUBSYSTEM)
1. Esquema .luxshow (Tipos e Interfaces)
Ubicación: @/electron-app/src/core/stage/ShowFileV2.ts

La interfaz raíz es ShowFileV2 (línea 1131). Estructura del JSON:



typescript
interface ShowFileV2 {
  schemaVersion: '2.0.0' | '2.1.0' | '2.2.0' | '2.3.0' | '2.4.0'
  name: string
  description: string
  createdAt: string        // ISO
  modifiedAt: string       // ISO
  createdWith: string
 
  stage: StageDimensions   // { width, depth, height, gridSize }
  visuals: StageVisuals    // { showGrid, showBeams, showZoneLabels, showFixtureNames, backgroundColor }
  heightLayers?: HeightLayer[]  // DEPRECATED — runtime lo ignora
 
  fixtures: FixtureV2[]
  groups: FixtureGroup[]
  rigs?: RigV2[]
  scenes: SceneV2[]
 
  dmx: DMXConfigV2         // { driver, port, universes, frameRate }
  audio: AudioConfigV2     // { source, deviceId?, deviceName?, sensitivity, inputGain }
 
  defaultVibe: string
  seleneMode: 'idle' | 'reactive' | 'autonomous' | 'choreography'
}
Campos obligatorios en FixtureV2 (línea 723):

id, name, model, manufacturer, type
address, universe, channelCount, profileId
position: Position3D, rotation: Rotation3D, orientation
physics: PhysicsProfile, zone: FixtureZone, enabled
Opcionales importantes: isPlaced, placementMode, rigId, channels, capabilities, calibration, panRangeDeg, tiltRangeDeg

Factory: createEmptyShowFile(name) (línea 1219) genera un show válido con defaults (stage 12×8×6, gridSize 0.25, driver 'virtual', seleneMode 'idle').

Validación: validateShowFile(data) y validateShowFileDeep(showFile) existen y son usados por saveShow() como gate pre-escritura.

Extensión en disco: .luxshow (o .v2.luxshow legacy). Guardado en %APPDATA%/LuxSync/shows/{name}.luxshow.

Conclusión: El esquema está completo y documentado. Para exportar desde useStageStore, basta con serializar showFile (que ya es ShowFileV2). No hay campos adicionales que calcular — el store ya mantiene el objeto completo.

2. Canales IPC de Electron (File System)
Backend (proceso principal)
Dos sistemas IPC paralelos coexisten:

A) Stage IPC — @/electron-app/src/core/stage/StageIPCHandlers.ts
Registrado por setupStageIPCHandlers() en main.ts. Canales disponibles:

Canal IPC	Método preload	Descripción
lux:stage:load	lux.stage.load(filePath?)	Carga show por path o activo
lux:stage:loadActive	lux.stage.loadActive()	Carga show activo (startup)
lux:stage:save	lux.stage.save(showFile, filePath?)	Guarda show
lux:stage:saveAs	lux.stage.saveAs(showFile, name)	Guarda con nuevo nombre
lux:stage:openDialog	lux.stage.openDialog()	Diálogo nativo Abrir → carga + broadcast lux:stage:loaded
lux:stage:saveAsDialog	lux.stage.saveAsDialog(showFile, suggestedName?)	Diálogo nativo Guardar Como
lux:stage:confirmUnsaved	lux.stage.confirmUnsaved(showName)	Diálogo confirmar cambios sin guardar
lux:stage:list	lux.stage.list()	Lista shows disponibles
lux:stage:recent	lux.stage.recent()	Shows recientes
lux:stage:delete	lux.stage.delete(filePath)	Eliminar show
lux:stage:exists	lux.stage.exists(name)	Check existencia
Persistencia real: StagePersistence.ts (línea 318) — loadShow() lee JSON, valida schema, migra V1→V2 si necesario, normaliza zonas, auto-sava patches. saveShow() escribe a disco.

B) Chronos IPC — @/electron-app/electron/ipc/ChronosIPCHandlers.ts
Para proyectos .lux (Chronos Studio). No relevante para .luxshow pero ya tiene showSaveDialog/showOpenDialog con dialog.showSaveDialog y dialog.showOpenDialog de Electron.

Frontend (preload bridge)
window.lux.stage está expuesto en @/electron-app/electron/preload.ts:1535-1594 con todos los métodos listados arriba. Incluye onLoaded(callback) para suscripción al evento lux:stage:loaded (broadcast del backend al renderer tras cargar).

Conclusión: NO hay que crear IPC nuevo. Todo el plumbing para Abrir/Guardar/Guardar Como ya existe y está funcional. Solo falta cableear botones UI que llamen a window.lux.stage.openDialog() y window.lux.stage.saveAsDialog(showFile).

3. Hidratación y Extracción de Estado (Stores)
Ubicación: @/electron-app/src/stores/stageStore.ts

Hidratación (cargar show → store)
loadShowFile(path: string): Promise<boolean> (línea 421) — Llama getStageAPI().load(filePath), setea showFile, showFilePath, limpia selección, sincroniza estado derivado. Incluye file lock (WAVE 2100).
loadFromData(data: unknown): boolean (línea 622) — Para testing/import: corre autoMigrate(data), setea showFile, sincroniza.
newShow(name: string): void (línea 522) — Crea createEmptyShowFile(name), flush atómico de estado derivado, purga selección, sincroniza backend.
setupStageStoreListeners() (línea 1247) — Suscribe a lux:stage:loaded broadcast. Cuando el backend carga un show (vía openDialog), el store se hidrata automáticamente.
_syncDerivedState() (línea 376) — Extrae fixtures, groups, scenes, stage, visuals del showFile y los setea como estado derivado.
Extracción (store → ShowFile)
saveShow(): Promise<boolean> (línea 551) — Lee showFile fresco del store, valida con validateShowFileDeep, actualiza modifiedAt, llama getStageAPI().save(showFile, path).
saveShowAs(path: string): Promise<boolean> (línea 617) — Setea showFilePath y delega a saveShow().
El showFile en el store ES el objeto ShowFileV2 completo. No hay función exportShow() separada porque no hace falta — showFile ya contiene todo. Serializar con JSON.stringify(showFile, null, 2) produce un .luxshow válido.

Auto-save debounced: _setDirty() (línea 363) dispara debouncedSave() con 2s de debounce si hay showFilePath.

Conclusión: El store ya tiene hidratación y extracción completas. loadShowFile + saveShow + newShow cubren los 3 botones del I/O. El broadcast lux:stage:loaded + setupStageStoreListeners ya hidratan automáticamente cuando openDialog carga un archivo.

4. Puntos de Inyección en la Interfaz (UI)
Arquitectura actual de ErebusShell
@/electron-app/src/components/views/erebus/ErebusShell.tsx (línea 186-233) renderiza:



<div className="erebus-shell">
  <div className="erebus-canvas-mount">  // centro — 3D/2D canvas
    <StudioCanvas /> | <BlueprintCanvas />
  </div>
  <CommandStrip />    // top-center — tool/view/snap toggles
  <DockRail />        // left — fixture library panel
  <ContextInspector /> // right — fixture properties
  <StatusRibbon />    // bottom — status info
  <RadialMenu />      // radial context menu
  <CommandPalette />  // cmd+k palette
</div>
Ubicación recomendada para I/O controls
Opción A (recomendada): CommandStrip — añadir grupo I/O a la izquierda

CommandStrip (@/electron-app/src/components/views/erebus/hud/CommandStrip.tsx) es la barra flotante top-center. Actualmente tiene 3 grupos: [2D|3D] [Select|Move|Rig|Calibrate|Measure] [Snap].

Añadir un 4º grupo al inicio: [New] [Open] [Save] con separadores. Es la ubicación más natural — el operador ya mira ahí para controles principales. CSS ya existe (.erebus-cmd-group, .erebus-cmd-btn).

Opción B: Nuevo componente ProjectBar — top-left

Un satélite flotante top-left (similar a CommandStrip pero anclado a la izquierda) dedicado exclusivamente a I/O. Más limpio arquitectónicamente pero añade complejidad visual.

Recomendación: Opción A. Es minimal, reutiliza CSS existente, y mantiene todo en una sola barra.

Wiring necesario


[New]  → useStageStore.getState().newShow('Untitled Show')
[Open] → window.lux.stage.openDialog()  → broadcast lux:stage:loaded → setupStageStoreListeners hidrata el store
[Save] → useStageStore.getState().saveShow()  (si showFilePath existe)
         window.lux.stage.saveAsDialog(showFile)  (si no hay path — primer guardado)
Plan de Ataque Propuesto
PASO 1: Añadir grupo I/O a CommandStrip
Importar useStageStore en CommandStrip.tsx
Añadir 3 botones: New, Open, Save
New → newShow('Untitled Show')
Open → window.lux.stage?.openDialog()
Save → lógica: si showFilePath existe → saveShow(); si no → saveAsDialog(showFile)
PASO 2: Indicador de estado sucio (dirty)
Leer isDirty de useStageStore
Mostrar punto rojo o asterisco en el botón Save cuando isDirty === true
Opcional: deshabilitar Save cuando !isDirty
PASO 3: Confirmar cambios sin guardar
Antes de newShow() o openDialog(), si isDirty, llamar window.lux.stage?.confirmUnsaved(showName)
Si retorna 'save' → saveShow() primero
Si retorna 'cancel' → abortar
PASO 4: Guardar Como
Botón secundario (click derecho o dropdown) en Save → "Save As..."
Llama window.lux.stage?.saveAsDialog(showFile, showFile?.name)
PASO 5: Testing
Verificar que openDialog → broadcast → setupStageStoreListeners hidrata el store correctamente
Verificar que saveShow produce un .luxshow válido (pasar validateShowFileDeep)
Verificar que newShow limpia estado derivado y selección
No se necesita crear ningún IPC nuevo, ningún store nuevo, ni ningún tipo nuevo. Todo el plumbing existe — solo falta cablear 3 botones en la UI.