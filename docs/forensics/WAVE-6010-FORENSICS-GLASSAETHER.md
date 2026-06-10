REPORTE FORENSE — Aether V2 (WAVE 6005)
1. Silent Blackout (Smart Gate bloquea todo)
Localización del log:

src/core/aether/resolver/NodeResolver.ts:496-499
Trigger: if (!gateOpen && arbitrated.size > 0 && manualCount === 0) cada 200 frames.
Variable de control:

TitanOrchestrator._outputEnabled (src/core/orchestrator/TitanOrchestrator.ts:556).
Inicializado a false en el constructor. Comentario explícito en :674: "WAVE 4703: _outputEnabled starts false at boot".
Cadena de fallo:

Boot → _outputEnabled = false.
TickEngine.tick() (:976) inyecta ese false al AetherSafetyMiddleware:


typescript
aetherSafety.setOutputEnabled(this._outputEnabled)  // false
NodeResolver._writeNode() (:879) evalúa:


typescript
const gateOpen = !this._safetyMiddleware || this._safetyMiddleware.isOutputEnabled()
Como isOutputEnabled() devuelve false, gateOpen = false.
Todos los nodos no-KINETIC y no-manuales son bloqueados (nodeBlocked = true).
El resolver descarta sus valores → arbitrated nodes existen pero no se escriben en los buffers de universo.
Resultado: DMX todo a cero, pero sin blackout flag activo (silent blackout).
Por qué no se abre la puerta:

_outputEnabled solo cambia a true mediante:
TitanOrchestrator.setOutputEnabled(true) (:1028)
O toggleOutputEnabled() (:1043)
Esas funciones solo se invocan desde:
IPC del frontend (AetherIPCHandlers.ts:302) cuando el usuario pulsa LIVE en la UI.
O ControlStore.toggleOutput() (controlStore.ts:336).
En resumen: el sistema arranca en modo ARMED (outputEnabled=false) por diseño de seguridad (WAVE 4703). El usuario debe pulsar ARM → LIVE. Hasta entonces, el Smart Gate de NodeResolver bloquea todo el tráfico no-KINETIC, produciendo el log de SILENT-BLACKOUT?.
2. Inanición del GlassBridge (Sent: 0)
Localización de la llamada:

src/core/orchestrator/tick/TickEngine.ts:1021:


typescript
if (this.ctx.glassPool) {
  this.ctx.glassPool.pushFrame(this._glassView)
}
Problema estructural: _glassView nunca se rellena

_glassView se declara como (:42):


typescript
private _glassView = new Float32Array(FIX_DATA_FLOATS)
Nunca se copian datos de los fixtures a este array antes del pushFrame(). El Float32Array permanece todo en ceros en cada tick.
Problema de rama: _aetherHasDevices

La llamada pushFrame() vive dentro del bloque (:770):


typescript
if (this._aetherHasDevices && this.hal) { ... }
Si _aetherHasDevices es false, el bloque entero se salta, incluyendo pushFrame().
La condición _aetherHasDevices depende de si existen dispositivos Aether registrados en el grafo. Si no hay fixtures parcheados o el grafo está vacío, este flag es false.
Problema de conexión: port nulo

BufferPoolManager.pushFrame() (BufferPoolManager.ts:47) hace:


typescript
if (!this.port) return
this.port se establece en attach() (:28), que es llamado desde electron/main.ts:431 en el evento did-finish-load del BrowserWindow.
Si el renderer no ha terminado de cargar, o el MessageChannelMain no se ha entregado, port es null y pushFrame retorna silenciosamente con framesSent = 0.
3. Desconexión del Hardware DMX (0 luces físicas)
Localización de la escritura al hardware:

TickEngine.ts:1091-1094: La llamada está comentada:


typescript
// 💀 WAVE 6005 v2 Phase 5: LA PURGA
// this.hal.sendUniverseRaw(universe, egressBuf)
TickEngine.ts:1111-1112: El flush está comentado:


typescript
// 🚀 WAVE 4681: Flush — comentado por la purga
// this.hal.flushAetherEgress()
Cadena de fallo completa:

NodeResolver.resolve() y AetherResolver calculan los buffers de universo (egressBuf) correctamente.
TickEngine tiene los datos en egressBuf y en aetherResolver.getUniverseBuffer(universe).
Pero nunca llama a this.hal.sendUniverseRaw(universe, egressBuf) porque esa línea fue comentada en la Purga (Phase 5).
Sin sendUniverseRaw(), UniversalDMXDriver nunca recibe los paquetes DMX.
Sin flushAetherEgress(), UniversalDMXDriver.sendAll() nunca propaga los datos a las estrategias activas (OpenDMXStrategy).
OpenDMXStrategy.send() (OpenDMXStrategy.ts:181-207) nunca recibe el buffer, por tanto nunca envía el IPC UPDATE_BUFFER al proceso forkado.
openDmxWorker.ts (:695-708) espera el mensaje UPDATE_BUFFER para copiar canales a su dmxBuffer.
Como no llega UPDATE_BUFFER, dmxBuffer permanece en su estado inicial: 512 canales a cero.
El worker sigue enviando frames DMX a 30Hz al puerto serial, pero todos los canales valen 0.
Resultado físico: luces apagadas (0% intensidad).
Nota sobre DmxUniverseWriter:

La clase DmxUniverseWriter (DmxSabHandlers.ts:49) y su método commitFrame() no se instancian ni se llaman en ningún archivo de producción (solo en tests GlassMemory.spec.ts).
El fork real usa openDmxWorker.ts (child_process), no dmxPhantomWorker.ts (worker_threads), y recibe datos vía IPC plano, no vía SAB. El SAB de DMX (Pilar 1 del blueprint) existe en el código pero no está conectado al ciclo de 44Hz.
RESUMEN DE CAUSAS RAÍZ
Síntoma	Causa raíz	Archivo / Línea
Silent Blackout	_outputEnabled = false por defecto en boot; Smart Gate bloquea nodos no-KINETIC	TitanOrchestrator.ts:556, TickEngine.ts:976, NodeResolver.ts:496-499
GlassBridge Sent: 0	_glassView vacío (sin copia de fixture states) + posible port=null o bloque saltado por _aetherHasDevices=false	TickEngine.ts:42, :1021, BufferPoolManager.ts:48
DMX Worker starvation	sendUniverseRaw() y flushAetherEgress() comentados en la Purga; ningún dato llega al fork DMX	TickEngine.ts:1091-1094, :1111-1112
AETHER V2 COMPLETADO (fase de auditoría).