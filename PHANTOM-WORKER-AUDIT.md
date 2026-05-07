# PHANTOM WORKER AUDIT

## WAVE 4606 — THE PHANTOM INVOCATION

Estado de la auditoria: SOLO LECTURA FORENSE

## Veredicto corto

- El Phantom Worker SI existe y SI tiene ciclo de vida funcional.
- El Phantom Worker NO es invocado por AetherUIProjector ni por VisualizerCanvas 3D.
- El Phantom Worker pertenece solo al canvas tactico 2D.
- WAVE 4592 no corto el callback de hot-frame entre Titan y el renderer.
- El worker NO escucha un evento directo tipo RENDER_FRAME desde Aether.
- El worker recibe mensajes FRAME desde TacticalCanvas, que relee transientStore en un RAF propio.
- El cable flojo no es una invocacion perdida del worker, sino un puente indirecto y fragil:
  - hot-frame de Aether parchea transientStore
  - TacticalCanvas reconstruye un FRAME nuevo desde transientStore
  - si no existe truth base, o el patch hot-frame no entra, el worker pinta negro

## Respuesta ejecutiva

### El worker esta vivo

Si Hyperion 2D esta montado y visible, el worker se crea, recibe INIT, responde READY y entra en RAF propio.

### Esta recibiendo paquetes de Aether

Si, pero no de forma directa.

No existe un camino AetherUIProjector -> postMessage(worker, ...).
El camino real es:

1. TitanOrchestrator emite hot-frame.
2. Electron main reenvia selene:hot-frame al renderer.
3. preload expone onHotFrame.
4. useSeleneTruth llama injectHotFrame(hotFrame).
5. TacticalCanvas relee getTransientTruth() en su propio RAF.
6. TacticalCanvas empaqueta un WorkerMsg FRAME.
7. TacticalCanvas hace worker.postMessage({ type: 'FRAME', ... }).

Conclusión: el cartero existe, pero no reparte directamente desde Aether al worker. Reparte pasando por transientStore y por un pump de RAF en main thread.

## VECTOR 1 — LA INVOCACION DEL WORKER

## Quién hace el postMessage al worker

El responsable real es TacticalCanvas, no AetherUIProjector y no VisualizerCanvas.

Pruebas:

- TacticalCanvas importa el worker con `hyperion-render.worker?worker` y lo instancia con `new RenderWorkerConstructor()`.
- En mount transfiere el OffscreenCanvas y envia `INIT`.
- En el data pump envia `FRAME` via `worker.postMessage(...)`.

## Qué hace AetherUIProjector

AetherUIProjector no invoca workers, no hace IPC y no emite eventos. Solo proyecta NodeGraph -> FixtureState legacy in-place.

## Qué hace VisualizerCanvas

VisualizerCanvas es el renderer 3D con React Three Fiber. No instancia el Phantom Worker. No hay `postMessage`, no hay OffscreenCanvas worker, no hay protocolo INIT/FRAME ahi.

## Impacto de WAVE 4592

No hay evidencia de que el bypass del ArbitrationDirector haya roto la invocacion del Phantom Worker.

Hallazgo clave:

- WAVE 4592 desconecta el bloque legacy de arbitraje dentro de TitanOrchestrator.
- El wiring del hot-frame permanece vivo y separado del director legacy.
- El worker 2D sigue dependiendo del canal `selene:hot-frame` mas transientStore, no del ArbitrationDirector.

Veredicto del vector 1:

- No hay una invocacion perdida del worker por culpa de WAVE 4592.
- Si la UI negra observada es el visualizador 3D, el Phantom Worker ni siquiera participa.

## VECTOR 2 — EL PUENTE DE DATOS

## Canal real que alimenta al worker

El worker escucha mensajes `FRAME` definidos en `hyperion-render.types.ts`.

No escucha un broadcast Electron directo tipo `RENDER_FRAME`.

El puente real es:

`TitanOrchestrator.onHotFrame` -> `mainWindow.webContents.send('selene:hot-frame', hotFrame)` -> `preload.onHotFrame` -> `useSeleneTruth` -> `injectHotFrame` -> `getTransientTruth()` -> TacticalCanvas `packFrameData(...)` -> worker message `{ type: 'FRAME' }`

## Donde Aether emite

En la rama Aether del frame loop, TitanOrchestrator hace:

1. adapters -> arbiter -> physics
2. `AetherUIProjector.project(fixtureStates, this._aetherGraph)`
3. `emitHotFrame()`
4. safety gate / resolve / send DMX

Eso confirma que Hyperion recibe la verdad visual antes del gate DMX.

## El worker recibe ese payload nuevo de Aether

Indirectamente, si.

Pero no consume `fixtureStates` proyectados de forma directa. Consume una reconstruccion posterior a partir de transientStore.

## El punto fragil del puente

Hay dos fragilidades reales:

### 1. Hot-frame no sirve sin full truth base

`injectHotFrame()` retorna sin hacer nada si `transientRef.current` es null.

Eso significa:

- primero debe llegar `selene:truth`
- luego los `selene:hot-frame` pueden parchear fixtures

Si por algun motivo la full truth no llego, el worker puede estar perfectamente vivo y seguir pintando negro.

### 2. El patch hot-frame depende de indice y de ID

`injectHotFrame()` hace match asi:

- toma `hotFixtures[i]`
- toma `existingFixtures[i]`
- solo parchea si `existing.id === hot.id`

Esto NO es un merge por mapa de ID. Es un merge por indice con verificacion de ID.

Si el orden entre la full truth y el hot-frame difiere, el patch dinamico se salta silenciosamente y el worker sigue leyendo estado viejo o negro.

## Diferencia entre comentario y realidad

Los comentarios de TacticalCanvas dicen `useSeleneTruth hot-frame -> worker.postMessage('FRAME')`, pero la implementacion real no reenvia hot-frames directos.

La implementacion real hace:

- hot-frame parchea transientStore
- luego un RAF del main thread genera FRAME

Esto no rompe por si solo, pero demuestra deriva arquitectonica entre el comentario y el cableado real.

## VECTOR 3 — EL ESTADO DEL WORKER

## Handshake real

El worker espera un handshake minimo y si lo recibe:

1. `INIT` con OffscreenCanvas
2. crea contexto 2D
3. arranca RAF
4. responde `READY`

Despues de eso acepta `SCAFFOLD`, `FRAME`, `SELECTION`, `MOUSE`, `OPTIONS`, `HIBERNATE`, `SHUTDOWN`.

## Guards reales

No existe un guard interno tipo `if (!data.isPlaying)` dentro del worker.

Los guards reales son otros:

- si el canvas 2D no esta visible, TacticalCanvas envia `HIBERNATE` y ademas para su data pump local
- si el worker aun no envio `READY`, TacticalCanvas no hace flush del mailbox
- si no hay `transientTruth`, el data pump empaqueta fixtures sin datos dinamicos
- si `currentFixtures.length === 0`, el data pump no manda frames utiles

## Implicacion clave

El worker no esta exigiendo playback state de Chronos para renderizar.
El bloqueo operativo real es visibilidad, readiness y disponibilidad de datos en transientStore.

## Diagnostico final

## El worker esta muerto

No.

## El worker esta desconectado de Aether

No del todo. El enlace existe, pero es indirecto.

## El worker esta oyendo el canal correcto

No oye Electron IPC ni Aether directamente. Oye mensajes `FRAME` emitidos por TacticalCanvas.

## El cartero entrega las cartas

Si, pero las entrega asi:

- Aether produce hot-frame
- Electron lo reenvia
- useSeleneTruth lo inyecta en transientStore
- TacticalCanvas reconstruye otro paquete y lo manda al worker

## Entonces, dónde esta el cable suelto

El cable flojo mas plausible no es la invocacion del worker, sino uno de estos dos puntos:

1. `injectHotFrame()` descarta datos porque todavia no existe una full truth base.
2. `injectHotFrame()` no parchea por desalineacion de orden entre `existingFixtures[i]` y `hotFixtures[i]`.

Ambos escenarios dejan al Phantom Worker vivo, listo y renderizando negro.

## Hallazgo colateral importante

Si el sintoma observado era el canvas 3D, este informe cambia el foco:

- VisualizerCanvas 3D no usa Phantom Worker.
- Un blackout del 3D no se explica por el worker 2D.

## Conclusión operativa

No encontré una “invocacion fantasma” rota por WAVE 4592.

Encontré otra cosa mas peligrosa:

- una arquitectura de doble salto
- comentarios que describen un enlace directo que ya no existe
- dependencia silenciosa de una truth base previa
- patch hot-frame fragil por indice

Resumen final:

- Worker vivo: SI
- Handshake READY: SI
- Invocacion desde TacticalCanvas: SI
- Conexion directa desde AetherUIProjector: NO
- Dependencia del ArbitrationDirector legacy: NO
- Recepcion indirecta de paquetes Aether: SI
- Punto de fallo mas probable: transientStore base nula o patch hot-frame por indice no aplicado