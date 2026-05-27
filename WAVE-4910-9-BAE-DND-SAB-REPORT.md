# WAVE 4910.9 - BAE Report: Theia Drag&Drop + SAB IPC

## Contexto
- Branch: `v3`
- Scope: Theia UI (frontend + electron bridge)
- Sintoma principal: Drag&Drop de video no funciona de forma operativa.
- Sintoma secundario original: errores de clonacion SAB en IPC (`An object could not be cloned`).

## Problema Base (BAE)
El fallo observado es doble y acoplado:

1. **Ruta IPC con SharedArrayBuffer no fiable en entorno empaquetado (`file://`)**
- `ipcMain.handle` + `ipcRenderer.invoke` intentando retornar SAB provocaba:
  - `Error occurred in handler for 'theia:get-frame-context': Error: An object could not be cloned`
  - `Error occurred in handler for 'theia:get-video-sab': Error: An object could not be cloned`
- Impacto:
  - ruido continuo en consola
  - fragilidad de arranque para ruta Theia

2. **Drag&Drop de video no ejecuta la ingesta de forma efectiva**
- Aunque el cursor de prohibido fue atacado y se agregaron listeners globales, la carga de video sigue sin completar de manera usable.
- Estado actual reportado por operador: "no funciona".

## Evidencia Operativa
- Error confirmado repetidamente por operador en build fria.
- Luego de los ultimos parches, desaparecen errores de clonacion backend, pero **DnD sigue roto**.
- Log relevante actual:
  - `[THETA] using local FrameContext SAB fallback (IPC bridge unavailable)`

## Soluciones Ya Probadas

### A) DnD Global y UX de drop
1. Listeners globales `dragover/drop` en Theia view.
2. Extension de formatos permitidos: `.mp4`, `.mkv`, `.webm`, `.mov`.
3. `dropEffect = 'copy'` en handlers.
4. Listener tambien sobre `document` (no solo `window`).
5. Prevencion de navegacion por drop (`will-navigate` guard para `file://`).
6. Limpieza de conflicto en Theia root quitando `onDrop={killDragDefault}` para no tragarse el drop interno.
7. Refuerzo global definitivo en `AppCommander`:
   - `dragenter/dragover/drop` en `document` y `window`
   - Ingesta global: detectar archivo soportado, navegar a tab `theia`, ejecutar `theta.start()` y `theta.loadVideo(...)`.

### B) SAB / IPC
1. `preload` con `try/catch` para `theia:get-frame-context` y `theia:get-video-sab` (no propagar excepcion).
2. `ThetaOrchestrator.start()` con fallback local `createFrameContextSAB()` si bridge no entrega SAB.
3. Intento de habilitar cross-origin isolation via COOP/COEP en `session.defaultSession.webRequest.onHeadersReceived`.
4. Corte de ruta SAB por `invoke` (mitigacion anti-clone):
   - `theia:get-frame-context` => `null`
   - `theia:get-video-sab` => `null`
- Resultado:
  - Se eliminan los errores de clonacion en backend.
  - Queda fallback local activo en Theia.

### C) UI/Modo Author (paralelo a este incidente)
1. Ocultar toggle RAW/PATCH en modo AUTHOR.
2. CSS completo de `AuthorAssetDeck` agregado.

## Estado Actual
- **Backend clone errors**: mitigados/eliminados en la ruta actual.
- **Drag&Drop funcional final**: **NO RESUELTO** (segun validacion del operador).
- **Riesgo**: hay un cuello pendiente en cadena de ingesta/render (evento -> loadVideo -> reproduccion/estado UI) que no queda cerrado con los parches aplicados.

## Hipotesis Tecnicas Pendientes (para arquitectura)
1. **Conflicto de enrutado de evento drop en capas de layout**
- algun contenedor superior puede estar anulando o desviando el flujo real de archivos.

2. **Ingesta ejecutada pero no reflejada en pipeline de render**
- `loadVideo` podria completar con estado inconsistente respecto al canvas/worker.

3. **Condicion de carrera entre cambio de tab y carga de video**
- en el bypass global se cambia a `theia` y luego se intenta cargar; el timing puede dejar objetos no listos.

4. **Acoplamiento incompleto tras retirar SAB IPC de video**
- salida/proyeccion secundaria y partes del pipeline pueden depender de supuestos antiguos.

## Recomendacion al Arquitecto (siguiente paso)
1. Instrumentar trazas deterministas por etapas de ingesta:
- `drop detected`
- `setActiveTab('theia')`
- `Theta start enter/ready`
- `loadVideo enter/success/fail`
- `video element metadata loaded`
- `worker first frame published`
- `viewport first frame painted`

2. Definir un solo "source of truth" para DnD:
- o exclusivamente global
- o exclusivamente dropzone Theia
- evitar doble camino que compita.

3. Para SAB inter-proceso, abandonar `invoke` para payload SAB y migrar a canal dedicado:
- `MessagePortMain` / `webContents.postMessage` con transferencia controlada,
- o rediseno sin SAB compartido entre procesos donde no sea imprescindible.

## Archivos Tocadas Durante la Investigacion
- `electron-app/electron/main.ts`
- `electron-app/electron/preload.ts`
- `electron-app/electron/TheiaWindowManager.ts`
- `electron-app/src/core/orchestrator/IPCHandlers.ts`
- `electron-app/src/theia/ThetaOrchestrator.ts`
- `electron-app/src/components/views/TheiaEngineView/index.tsx`
- `electron-app/src/components/views/TheiaEngineView/TheiaEngineView.css`
- `electron-app/src/AppCommander.tsx`

## Cierre
Reporte listo para transferencia a arquitectura. El incidente queda en estado:
- Clone SAB por IPC: contenido/mitigado.
- Drag&Drop Theia end-to-end: abierto, requiere diseccion de pipeline con trazas de capa fina.
