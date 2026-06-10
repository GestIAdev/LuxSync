REPORTE FORENSE V8 CRASH — WAVE 6010-AUDIT
1. Glass Bridge — Transfer Lists (VERIFICADO LIMPIO)
BufferPoolManager.ts:66



typescript
this.port.postMessage({ type: 'glass-state', buffer })
Estado: ✅ SIN lista de transferencia. Segundo argumento eliminado correctamente.
glassPreload.ts:24



typescript
_port.postMessage({ type: 'ack', buffer: _pending })
Estado: ✅ SIN lista de transferencia.
glassPreload.ts:74



typescript
_port.postMessage({ type: 'ack', buffer: _pending })
Estado: ✅ SIN lista de transferencia.
Diagnóstico: El fix del Glass Bridge está aplicado correctamente. El crash NO viene del ping-pong de ArrayBuffers.

2. Phantom Worker — Interacción SAB → serialport (ANÁLISIS)
dmxPhantomWorker.ts:74-78



typescript
function outputLoop(): void {
    const frame = reader.readCoherent(lastFrameId)
    if (frame) {
      lastFrameId = frame.frameId
      port.write(Buffer.from(frame.data.subarray(0, 512)))
    }
    setImmediate(outputLoop)
}
Análisis de seguridad del buffer:

reader.readCoherent() devuelve frame.data = this.scratch (un Uint8Array preasignado en el constructor del reader).
frame.data.subarray(0, 512) crea una vista sobre el scratch.
Buffer.from(vista) clona los bytes en un nuevo Buffer de Node.js (no es zero-copy desde un SAB).
Conclusión: El buffer que llega a port.write() es un Buffer de Node.js ordinario, no una vista directa del SAB. Desde el punto de vista del paso de memoria, esto es seguro.
3. Sospechoso Principal — OpenDMXStrategy.ts (HALLAZGO CRÍTICO)
Línea 30:



typescript
import { Worker } from 'worker_threads'
Línea 64:



typescript
this.worker = new Worker(workerPath, {
    workerData: { sab, portPath },
})
El archivo tiene un comentario de advertencia en las líneas 12-16 que dice exactamente:

"Electron 28 + worker_threads + native addons (serialport) = CRASH. El addon nativo bindings.node se carga en ambos V8 isolates (main + worker) dentro del MISMO PROCESO... Fatal error: HandleScope::HandleScope (node_bindings.cc:159)."

PERO el código ignora su propia advertencia. A pesar de que el header del archivo dice child_process.fork, la implementación actual usa new Worker() (worker_threads).

CAUSA RAÍZ CONFIRMADA
Capa	Estado
Glass Bridge transfer lists	✅ Eliminadas correctamente
SAB → Buffer cloning en worker	✅ Seguro (Buffer.from clona)
Arquitectura del worker	❌ CRÍTICO: worker_threads en vez de child_process.fork()
El crash Fatal error in V8: HandleScope::HandleScope ocurre porque:

OpenDMXStrategy.connect() lanza dmxPhantomWorker.ts como Worker de worker_threads.
El worker carga serialport, que es un addon nativo de C++ (bindings.node).
El addon nativo se inicializa en un segundo V8 isolate dentro del mismo proceso de Electron.
El V8 isolate principal (main process) y el isolate del worker comparten el estado C++ global del addon.
Cuando el main process hace GC y recorre weak refs del addon mientras el worker ejecuta callbacks nativos (ej. port.write() o eventos on('open')) → colisión de HandleScope → node_bindings.cc:159.
En otras palabras: El código lleva la solución escrita en los comentarios (child_process.fork) pero la implementación fue cambiada a worker_threads, reproduciendo exactamente el crash que el propio archivo documenta.

NOTA TÉCNICA ADICIONAL
El Buffer.from(frame.data.subarray(0, 512)) en el worker, aunque clona, tiene un problema secundario: el DmxUniverseReader usa un scratch de 25.600 bytes (MAX_UNIVERSES * 512). El subarray(0, 512) toma solo los primeros 512 bytes (universo 0), pero el DmxUniverseWriter.commitFrame() en TickEngine escribe todos los universos en el SAB. El worker solo envía el universo 0 al puerto serial. Esto explicaría por qué, incluso sin crash, solo el universo 0 tendría datos. Pero el problema inmediato y bloqueante es el crash de V8, no la truncatura de universos.