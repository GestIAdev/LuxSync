El Diagnóstico Real (no es GC, es el archivo node_bindings.cc)
El dato que lo cambia todo está en el stack trace que probablemente estás ignorando:
[23332:0608/193022.341:ERROR:node_bindings.cc(159)] Fatal error in V8:
HandleScope::HandleScope Entering the V8 API without proper locking in place
node_bindings.cc no es V8 puro. Es el archivo de Electron que implementa la integración entre el event loop de Node.js y el de Chromium. Ese crash no es un hilo de Node peleando con el GC de otro hilo de Node. Es serialport intentando hacer una llamada V8 en un momento en que Chromium tiene tomado el lock del Isolate compartido.
La anatomía exacta:
Electron Main Process
│
├── Node.js (via node_bindings.cc)    ← el "puente"
│   └── worker_thread (serialport)
│       └── port.open() → libuv I/O thread pool
│           └── callback C++ → intenta crear HandleScope  ← CRASH AQUÍ
│
└── Chromium
    └── Renderer IPC / Blink / Skia   ← tiene el V8 lock en este milisegundo
serialport (incluso versiones recientes) usa el loop de libuv para manejar I/O asíncrona del puerto serie. Cuando ese callback del thread pool de libuv re-entra a V8, necesita que el Isolate esté libre. En un spike test con Chromium quieto, lo está. En producción, Chromium está constantemente compitiendo por ese mismo lock: rendering, IPC, compositing con Skia.

Por qué los Spikes son Estructuralmente Ciegos a Este Bug
Aquí está la razón por la cual los tests te mintieron, y es importante entenderla para que no vuelva a pasar:
Los spikes se ejecutaron casi con seguridad con la ventana de Electron en estado mínimo o antes de que el renderer estuviera completamente hidratado. Chromium en idle prácticamente no compite por el V8 lock. El callback de libuv de port.open() siempre encontró el Isolate libre.
Para reproducir el crash en un spike necesitarías agregar esta carga sintética:
javascript// Spike con carga realista de Chromium
win.webContents.executeJavaScript(`
  // Forzar actividad continua de Chromium durante el connect
  setInterval(() => {
    document.body.style.opacity = Math.random();
    fetch('/noop'); // fuerza IPC
  }, 1);
`);

// Ahora conectar el puerto
setTimeout(() => serialportWorker.postMessage({ cmd: 'connect' }), 500);
Con eso, el spike hubiera crasheado igual que producción.

La Solución Correcta (y por qué el "ping-pong para hardware" es exacta)
Tu intuición es perfecta. La regla que emerge de esto es:

Todo native I/O con callbacks C++ vive en el Main Process de Electron, sin excepción.

El worker thread de Node puede hacer computación pura (protocolo DMX, cálculo de timing, llenado del SAB), pero el serialport tiene que vivir donde node_bindings.cc lo espera: en el Main Process, en el mismo contexto donde Electron coordina la integración.
ANTES (crashea):
Worker Thread ──(serialport nativo)──→ libuv pool → callback → V8 LOCK CONFLICT

DESPUÉS (correcto):
Worker Thread ──(SAB write)──→ Main Process ──(serialport)──→ OS
                              ↑ aquí, node_bindings.cc está satisfecho
La implementación es directa porque ya tienen el SAB funcionando:
javascript// dmx-engine.worker.js  — SIN tocar serialport, computación pura
const { workerData, parentPort } = require('worker_threads');
const sabView = new Float32Array(workerData.sab);

let frameCount = 0;

function tick() {
  // Calcular el frame DMX y escribirlo al SAB
  computeDmxFrame(sabView, frameCount++);
  
  // Señalizar al Main que hay un frame listo
  // Mensaje ultraliviano: solo el número de frame
  parentPort.postMessage({ type: 'tick', frame: frameCount });
}

setInterval(tick, 1000 / 44); // 44Hz
javascript// main.js — serialport vive aquí, punto
const { SerialPort } = require('serialport');
const { Worker } = require('worker_threads');

const sab = new SharedArrayBuffer(512 * 4 * 8);
const sabView = new Float32Array(sab);

// serialport en Main Process: node_bindings.cc está en casa
let dmxPort = null;

function connectHardware(path) {
  dmxPort = new SerialPort({ 
    path, 
    baudRate: 250000,
    dataBits: 8,
    stopBits: 2,
    parity: 'none',
  });
  
  dmxPort.on('open', () => console.log('[Hydra] Puerto DMX abierto'));
  dmxPort.on('error', (err) => console.error('[Hydra] Error puerto:', err));
}

// Worker de computación pura
const engine = new Worker('./dmx-engine.worker.js', { workerData: { sab } });

engine.on('message', ({ type }) => {
  if (type !== 'tick' || !dmxPort?.isOpen) return;
  
  // Leer SAB y enviar al hardware — todo en Main Process
  const dmxPacket = buildDmxPacket(sabView); // tu función existente
  dmxPort.write(dmxPacket); // async, non-blocking, en el contexto correcto
});

El Veredicto sobre el Blueprint Anterior
El blueprint de memoria compartida para el Node Worker → Main era y sigue siendo correcto. Esa parte funciona. El error estuvo en asumir que serialport podía vivir en el worker thread dentro del contexto de Electron, porque los spikes no tenían la presión de Chromium activo para exponer el conflicto de lock.
La arquitectura final queda así:
┌─────────────────────────────────────────────────────┐
│  Node Worker Thread                                 │
│  ● Computación DMX pura                             │
│  ● Escribe SAB @ 44Hz                               │
│  ● postMessage({ type: 'tick' })  [~0 bytes]        │
└───────────────────┬─────────────────────────────────┘
                    │ SAB + tick signal
┌───────────────────▼─────────────────────────────────┐
│  Main Process  (node_bindings.cc happy aquí)        │
│  ● Lee SAB                                          │
│  ● serialport.write() → hardware      ✅            │
│  ● Transfiere Float32Array → Renderer               │
└───────────────────┬─────────────────────────────────┘
                    │ Transferable ArrayBuffer
┌───────────────────▼─────────────────────────────────┐
│  Renderer Process                                   │
│  ● Canvas / WebGL directo desde typed array         │
│  ● React solo para UI estructural                   │
└─────────────────────────────────────────────────────┘
El Watchdog y el Hydra Multi-Universe quedan intactos. Solo cambia dónde vive el serialport: del worker thread al Main Process.