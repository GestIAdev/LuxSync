AUDITORÍA COMPLETA — Aether Glass UI Bypass
Estado: MAPEO + PUNTOS DE CORTE IDENTIFICADOS (sin ejecución de código)
1. RESUMEN EJECUTIVO
El Aether Glass YA EXISTE y FUNCIONA a 44Hz. El problema no es la ausencia de infraestructura, sino que los renderizadores Canvas 2D/3D no la consumen. En su lugar, siguen alimentándose de un pipeline IPC → Store → React → Worker que introduce latencia, throttling y desync.

GlassBridge: Main Process → BufferPoolManager → MessagePort → glassPreload.ts → window.glass.onFrame() → GlassCanvas.tsx → transientStore
TacticalCanvas (2D): Ignora el Glass. Se alimenta de truthStore (~7Hz vía IPC selene:truth) → useFixtureData() → postMessage al Web Worker
Visualizer (3D): Ignora el Glass. Se alimenta de truthStore y stageStore vía hooks reactivos
2. ARQUITECTURA ACTUAL DEL DATA FLOW


┌─────────────────────────────────────────────────────────────────────────────┐
│                           MAIN PROCESS (Node.js)                             │
│  TickEngine.tick() @44Hz                                                     │
│  ├── _glassView (Float32Array) ──► BufferPoolManager.pushFrame() ──► Renderer│
│  │   (líneas 1189-1218 TickEngine.ts)                                        │
│  ├── onHotFrame() ──► TitanOrchestrator ──► IPC 'selene:truth' @44Hz        │
│  │   (líneas 763-808 TickEngine.ts)                                          │
│  └── onBroadcast() ──► Full SeleneTruth ──► IPC @ ~7Hz (divider=6)          │
│      (líneas 1222-1407 TickEngine.ts)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
              ┌────────────────────┐      ┌────────────────────┐
              │  GLASS BRIDGE      │      │  IPC ZUSTAND       │
              │  (MessagePort)     │      │  (selene:truth)    │
              │  44Hz, zero-copy   │      │  ~7Hz, serialized  │
              └────────┬───────────┘      └────────┬───────────┘
                       │                             │
                       ▼                             ▼
              ┌────────────────────┐      ┌────────────────────┐
              │  glassPreload.ts   │      │  useSeleneTruth.ts │
              │  window.glass      │      │  truthStore (Zustand)│
              │  .onFrame()        │      │  .setTruth() @~2Hz │
              └────────┬───────────┘      └────────┬───────────┘
                       │                             │
                       ▼                             ▼
              ┌────────────────────┐      ┌────────────────────┐
              │  GlassCanvas.tsx   │      │  useHardware()     │
              │  (hidden, debug)   │      │  useFixtureData()  │
              │  transientStore    │      │  useFixture3DData()│
              │  injectTransient() │      │  React re-renders  │
              └────────────────────┘      └────────┬───────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                    │ TacticalCanvas  │  │  Render Worker  │  │ Visualizer3D    │
                    │ (2D Tactical)   │  │ (hyperion-render│  │ (R3F / useFrame)│
                    │ useFixtureData()│  │ .worker.ts)     │  │ useFixture3DData│
                    │ packFrameData() │  │ postMessage     │  │ transientStore  │
                    │ ──► postMessage │  │ Float32Array    │  │ (no lo usa!)    │
                    └─────────────────┘  └─────────────────┘  └─────────────────┘
3. PUNTOS DE CORTE EXACTOS (dónde cortar el cable IPC/Store)
🔴 CORTE 1 — TacticalCanvas.tsx: El Data Pump al Worker
Archivo: @/components/hyperion/views/tactical/TacticalCanvas.tsx

Problema: El componente recibe fixtures desde useFixtureData() (que lee truthStore @ ~7Hz), los empaqueta en Float32Array vía packFrameDataInto(), y los envía al Web Worker vía postMessage. Esto es doble trabajo: el Glass ya tiene los datos en un Float32Array listo a 44Hz.

Líneas a cortar:

L269: const fixtures = useFixtureData() — obtiene datos reactivos de stores
L131-183: función packFrameDataInto() — empaqueta manualmente datos que ya vienen empaquetados del Glass
Todo el frameBufferRef (L243), msgTemplateRef (L245), transientMapRef (L240)
Todo el sistema de mailboxRef, flushFrameMailbox, runtimeCountersRef (frame drop tracking del worker)
El useEffect del data pump (a partir de L400 aproximadamente donde se envían frames)
Reemplazo: El Worker debe recibir los datos directamente del Glass. Opciones:

Opción A (recomendada): El Worker recibe el MessagePort del Glass al inicializarse (INIT message con port transferido). El Worker lee window.glass.onFrame equivalente interno.
Opción B: El main thread lee window.glass.onFrame y reenvía al Worker (menos ideal, añade un hop).
🔴 CORTE 2 — hyperion-render.worker.ts: Fuente de datos
Archivo: @/workers/hyperion-render.worker.ts

Problema: El worker recibe frames dinámicos vía mensajes FRAME (L113-122 de hyperion-render.types.ts). Estos mensajes contienen Float32Array generados por el main thread a partir de stores reactivos. El worker desempaqueta (L178-194) y hace smoothing (L196-213).

Líneas a modificar:

L83-86: currentFrameData, currentFrameNumber, currentTimestamp, currentFixtureCount — estado de frame que llega por mensaje
L178-194: Bloque de unpack del Float32Array
Handler de mensajes FRAME (buscar en la parte inferior del archivo, no mostrada en el snippet pero debe existir)
Reemplazo: El worker debe recibir un MessagePort transferido desde glassPreload.ts o desde el main process. El worker crearía un onmessage handler que reciba glass-state directamente, eliminando la necesidad de mensajes FRAME por completo.

🟡 CORTE 3 — useFixtureData.ts: Dependencia de truthStore para datos dinámicos
Archivo: @/components/hyperion/views/tactical/useFixtureData.ts

Problema: Este hook lee useHardware() (L107) que suscribe a truthStore vía Zustand. Los datos dinámicos (intensidad, RGB, pan/tilt) cambian a 44Hz pero React solo recibe actualizaciones throlleadas a ~7Hz. Esto causa desync visual.

Líneas a cortar:

L107: const hardware = useHardware() — para datos de alta frecuencia
L126-135: runtimeStateMap construido a partir de hardware?.fixtures
Preservar: El hook sigue siendo útil para:

stageFixtures (estructural: zona, modelo, posición 3D)
stageDimensions (ancho/depth del escenario)
Layout 2D de zona (ZONE_LAYOUT_2D)
overrides (L2 manual del programador)
Reemplazo: Los datos dinámicos deben venir del transientStore (que ya se alimenta del Glass vía GlassCanvas.tsx). El hook useFixtureData debería fusionar:

Estructura: stageStore.fixtures
Dinámica: transientStore.hardware.fixtures (actualizado a 44Hz, zero React cost)
Overrides: overrideStore
🟡 CORTE 4 — useFixture3DData.ts: Dependencia de truthStore
Archivo: @/components/hyperion/views/visualizer/useFixture3DData.ts

Problema: Este hook ya fue parcialmente "decoupled" en WAVE 2236 (comentario L125-138) para evitar re-renders. Sin embargo, el comentario dice que getTransientFixture() se lee "at build time" (one-time snapshot), lo cual es insuficiente para 44Hz. La data dinámica debe leerse en useFrame() de R3F, no en un hook de React.

Líneas a revisar:

L117-122: Suscripciones a useStageStore, useSelectionStore, useOverrideStore
L140-144: Debug code
Todo el bloque donde se construye Fixture3DData[]
Reemplazo: Separar claramente:

Estructura ( React/Zustand): posición, modelo, zona, selección → useFixture3DData sigue sirviendo
Dinámica (R3F useFrame @ 60fps): leer transientStore directamente dentro del loop de renderizado 3D, sin pasar por React
🟡 CORTE 5 — useFixtureRender.ts: Hook reactivo por fixture
Archivo: @/hooks/useFixtureRender.ts

Problema: Este hook individual por fixture (useFixtureRender(truthData, fixtureId)) suscribe a useTruthStore (L213) para leer hardwareFixtures. Es usado por componentes 3D que necesitan datos en tiempo real. Cada fixture = 1 suscripción Zustand = explosión de re-renders.

Líneas a cortar:

L203-219: Resolución de truthData vía useTruthStore
L222-230: Lecturas de useControlStore
L257-263: Visual smoothing "La Mentira Piadosa" (ya no necesaria si se lee del Glass a 44Hz nativo)
Reemplazo: Los componentes individuales deben leer del transientStore directamente, que ya contiene los datos del Glass sin causar re-renders de React.

4. COMPONENTES DEL GLASS QUE YA FUNCIONAN (NO TOCAR)
Componente	Rol	Estado
TickEngine.ts:1189-1218	Escribe _glassView con fixture states	✅ Funciona a 44Hz
BufferPoolManager.ts	Pool ping-pong de ArrayBuffers	✅ Funciona
glassPreload.ts	Expone window.glass API	✅ Funciona
GlassCanvas.tsx	Recibe Glass y alimenta transientStore	✅ Funciona (pero es hidden)
transientStore.ts	Mutable ref con datos a 44Hz	✅ Funciona
5. MAPEO DE REEMPLAZO PROPUESTO


BEFORE (IPCPATH):
TickEngine ──► onHotFrame/onBroadcast ──► IPC ──► truthStore ──► useFixtureData()
    ──► packFrameDataInto() ──► postMessage ──► Worker ──► render()
 
AFTER (GLASSPATH):
TickEngine ──► _glassView ──► BufferPoolManager ──► MessagePort ──► glassPreload
    ──► window.glass.onFrame ──► [TacticalCanvas lee y reenvía al Worker]
    ──► Worker render() lee Float32Array directo del Glass
6. ARCHIVOS INVOLUCRADOS EN LA OPERACIÓN
Archivo	Acción	Complejidad
TacticalCanvas.tsx	Eliminar data pump, reemplazar por Glass reader	Media
hyperion-render.worker.ts	Recibir MessagePort del Glass, eliminar handler FRAME	Alta
hyperion-render.types.ts	Eliminar WorkerMsgFrame o deprecar	Baja
useFixtureData.ts	Separar estructura (Zustand) de dinámica (transientStore)	Media
useFixture3DData.ts	Mover lectura dinámica a useFrame() de R3F	Media
useFixtureRender.ts	Deprecar o migrar a transientStore	Baja
GlassCanvas.tsx	Exponer/visualizar (ya funciona, puede ampliarse)	Baja
7. CONSIDERACIONES TÉCNICAS
¿Cómo pasa el MessagePort al Web Worker?
Los MessagePort son transferibles. En TacticalCanvas.tsx, al inicializar el worker (createRenderWorker()), se puede transferir el port:



typescript
const channel = new MessageChannel()
worker.postMessage({ type: 'GLASS_PORT', port: channel.port2 }, [channel.port2])
// channel.port1 se conecta a glassPreload.ts o se reenvía desde el main
Alternativamente, glassPreload.ts puede exponer un método para "suscribir" workers.

¿Qué pasa con los overrides del Programmer?
El Glass contiene los datos post-arbitraje (L1086 de TickEngine: _aetherUIProjector.project(...)). Esto significa que los overrides L2 del programador YA están aplicados en el Glass. No hay pérdida de funcionalidad.

¿Qué pasa con la selección/hit testing?
Scaffold (id, zona, posición, tipo): Sigue viniendo de stageStore → inmutable entre frames
Dinámica (color, intensidad, pan/tilt): Viene del Glass
Selección/hit test: El worker sigue manejándolo internamente con su propio estado (selectedIds, hoveredId)
8. PRÓXIMOS PASOS RECOMENDADOS
Fase 1: Modificar hyperion-render.worker.ts para aceptar un MessagePort transferido y leer frames del Glass directamente, eliminando la dependencia de mensajes FRAME.
Fase 2: Modificar TacticalCanvas.tsx para eliminar el data pump (packFrameDataInto, frameBufferRef, etc.) y transferir el MessagePort al worker durante la inicialización.
Fase 3: Actualizar useFixtureData.ts para leer datos dinámicos del transientStore en lugar de truthStore.
Fase 4: Actualizar useFixture3DData.ts para que los componentes R3F lean transientStore dentro de useFrame().
Fase 5: Relegar truthStore / IPC selene:truth a metadatos únicamente (BPM, vibe, genre, estado del sistema).
¿Ejecuto la Fase 1 (modificación del worker para recibir Glass) o prefieres que profundice en algún punto específico del mapeo?