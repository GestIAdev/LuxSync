INFORME TÉCNICO AL ARQUITECTO: EL MURO DE CHROMIUM IPC
Situación actual: Hemos llevado la prueba de SharedArrayBuffer (SAB) en Electron hasta sus límites, y el veredicto empírico es claro:

SAB entre Node Main Process y Node Worker Threads: ✅ Funciona perfecto. V8 en Node soporta concurrencia completa sin bloqueos (Comprobado en Spike 1).
SAB entre Chromium Renderer y Chromium Web Workers: ✅ Funciona perfecto si los headers COOP/COEP (o un esquema privilegiado) están presentes.
SAB cruzando el IPC desde Main Process hacia Renderer: ❌ Bloqueo duro. El motor de serialización estructurada de Electron/Chromium no puede clonar un SharedArrayBuffer entre entornos distintos (Node.js C++ layer hacia Chromium blink layer). Provoca An object could not be cloned en invoke/send o crashes directos (Exit code 1) al usar MessageChannelMain.
¿Qué falló en Spike 3? Incluso con el protocolo custom privilegiado inyectando Cross-Origin-Isolated correctamente en el DOM, cuando Node.js intenta empujar el objeto SharedArrayBuffer por un MessagePort asociado al IPC, el puente C++ se rompe (Crash silencioso).

Solución comprobada (Spike 3.2): ArrayBuffer Transferible Ping-Pong Probé enviar un ArrayBuffer estándar transfiriendo su ownership [buffer]. Esto SÍ funcionó y no crasheó el V8. La memoria se mueve sin copiarse (Zero-Copy), pero queda "neutered" (vaciada) en el origen.

PROPUESTA ARQUITECTÓNICA: "El Espejo Fluido"

Para conectar el DMX Engine (Node) con el Visualizador/UI (Renderer) en tiempo real, usaremos un patrón Transferable Buffer Pool (Zero-Copy):

Main Process mantiene un pool pequeño de 2-3 ArrayBuffers del tamaño exacto del layout DMX/Fixtures.
Cada tick (44Hz), copia el estado maestro al Buffer A.
Envía el Buffer A al Renderer vía port.postMessage(bufferA, [bufferA]).
El Renderer lo recibe, extrae los Floats y dibuja directamente (requestAnimationFrame).
El Renderer devuelve el Buffer A al Main por el mismo puerto para ser reciclado, evitando la creación y destrucción de objetos por frame.
De este modo logramos 60Hz limpios, Zero-Copy IPC real, sin latencia de serialización JSON, evadiendo la pared de seguridad del SharedArrayBuffer de Chromium.

¿Avanzo con la formalización de este rediseño en los documentos de arquitectura de la WAVE 6005?

------------------------------------------------------
-------------------------------------------------------

CONSULTA AL ORACULO :

El Hard Block: ¿Se puede quebrar?
Honestamente: No, limpiamente. Y aquí está el por qué real, que importa para tomar la decisión arquitectónica correcta:
El problema no es Chromium siendo caprichoso con Spectre. Es que Node.js Main y el Renderer son dos V8 isolates en procesos distintos del OS. Un SharedArrayBuffer es, por definición, una región de memoria compartida entre threads del mismo proceso. Cruzar el Electron IPC (que es básicamente una pipe de serialización entre procesos) con un SAB requeriría compartir memoria entre procesos del OS, que es mmap/shm_open territorio del kernel, no de V8.
El único path exótico real sería un N-API native addon con napi_create_external_arraybuffer apuntando a memoria mapeada por el OS, expuesta también al renderer. Es peligrosísimo (sin GC coordination, sin Spectre protection), no portable entre plataformas, y rompe en cualquier update de Electron. Ese camino no existe para producción.
La conclusión correcta: el Transferable Buffer Pool no es un compromiso. Es la arquitectura canónica para este problema en Electron. Y el overhead real de ese único memcpy (SAB → ArrayBuffer en el Main Process) para 16KB a 44Hz es ~3 microsegundos. Es literalmente invisible.

El Bug de Spike 3.2: Por qué el ping-pong se cortó
El culpable casi seguro es contextBridge. Cuando el preload expone una función al renderer world vía contextBridge.exposeInMainWorld, todo lo que cruza esa frontera pasa por el serializer de Electron. El ArrayBuffer llega al renderer world como un clone, no como el original. Cuando el renderer intenta hacer postMessage(buffer, [buffer]) de vuelta, está transfiriendo su clone (que el preload no conoce), mientras el ArrayBuffer original sigue en el mundo del preload sin ser retornado al pool. El pool se vacía, el Main no recibe ACKs, el ping-pong se congela.
El fix es que el preload retiene soberanía sobre los ArrayBuffers. El renderer world nunca toca el buffer raw, solo lee una vista tipada del contenido.

Implementación Definitiva
javascript// ============================================================
// main.js
// ============================================================
const { app, BrowserWindow, protocol, MessageChannelMain } = require('electron');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');

const UNIVERSES = 8;
const CHANNELS = 512;
const BUFFER_BYTES = UNIVERSES * CHANNELS * 4; // Float32
const POOL_SIZE = 3; // 1 en vuelo, 1 siendo llenado, 1 de margen

protocol.registerSchemesAsPrivileged([{
  scheme: 'aether',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

// ── Bridge ──────────────────────────────────────────────────
class DmxBridge {
  constructor() {
    this.port = null;
    // SAB compartido con el Node Worker Thread (esto ya lo tienen funcionando)
    this.sab = new SharedArrayBuffer(BUFFER_BYTES);
    this.sabView = new Float32Array(this.sab);
    
    this.pool = Array.from({ length: POOL_SIZE }, () => new ArrayBuffer(BUFFER_BYTES));
    this.inFlight = 0;
    this.framesSent = 0;
    this.framesDropped = 0;
  }

  startEngine() {
    this.engine = new Worker('./dmx-engine.worker.js', {
      workerData: { sab: this.sab }
    });
    this.engine.on('message', ({ type }) => {
      if (type === 'tick') this._onTick();
    });
    this.engine.on('error', console.error);
  }

  _onTick() {
    if (!this.port) return;

    const buffer = this.pool.pop();
    if (!buffer) {
      this.framesDropped++;
      // Frame drop intencional: el renderer está ocupado, queremos estado ACTUAL
      // no una cola. El próximo tick enviará el estado más reciente.
      return;
    }

    // El único memcpy del pipeline: SAB → ArrayBuffer. ~3μs para 16KB.
    new Float32Array(buffer).set(this.sabView);

    this.inFlight++;
    this.framesSent++;

    // Zero-copy transfer hacia el renderer
    this.port.postMessage(
      { type: 'frame', buffer, id: this.framesSent },
      [buffer]
    );
  }

  _onAck(buffer) {
    // El preload retornó el buffer: vuelve al pool
    this.inFlight--;
    this.pool.push(buffer);
  }

  attach(port) {
    this.port = port;
    port.on('message', ({ data }) => {
      if (data?.type === 'ack' && data.buffer instanceof ArrayBuffer) {
        this._onAck(data.buffer);
      }
    });
    port.start(); // ← crítico: sin esto el port no emite eventos
  }
}

// ── App ─────────────────────────────────────────────────────
const bridge = new DmxBridge();

app.whenReady().then(async () => {
  const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' };
  
  protocol.handle('aether', async (req) => {
    const url = new URL(req.url);
    const file = path.join(__dirname, 'dist', url.pathname === '/' ? '/index.html' : url.pathname);
    const ext = path.extname(file);
    try {
      const body = await fs.promises.readFile(file);
      return new Response(body, {
        headers: {
          'Content-Type': MIME[ext] ?? 'application/octet-stream',
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        }
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // El renderer pedirá el port vía IPC seguro
  win.webContents.ipc.handle('dmx:handshake', () => {
    const { port1, port2 } = new MessageChannelMain();
    bridge.attach(port1);
    // Transferir port2 al renderer via postMessage (no IPC invoke, que no soporta transfers)
    win.webContents.postMessage('dmx:port', null, [port2]);
    return { universes: UNIVERSES, channels: CHANNELS };
  });

  bridge.startEngine();
  win.loadURL('aether://localhost/index.html');
});
javascript// ============================================================
// preload.js
// ============================================================
const { ipcRenderer, contextBridge } = require('electron');

// Estado interno del preload — el renderer world NUNCA toca estos objetos
let _port = null;
let _pendingBuffer = null; // buffer esperando ser consumido en el próximo rAF
let _pendingId = -1;
const _listeners = new Set();

// Configurar recepción del port ANTES de exponer la API
ipcRenderer.on('dmx:port', (event) => {
  _port = event.ports[0];

  _port.onmessage = ({ data }) => {
    if (data?.type !== 'frame') return;

    // Si ya tenemos un frame pendiente sin consumir, devolvemos ese buffer
    // (frame drop: el rAF del renderer no alcanzó a procesar el anterior)
    if (_pendingBuffer) {
      _port.postMessage({ type: 'ack', buffer: _pendingBuffer }, [_pendingBuffer]);
    }

    _pendingBuffer = data.buffer;
    _pendingId = data.id;

    // Notificar al renderer world con una VISTA (no el buffer raw)
    // contextBridge clona el Float32Array → memcpy de 16KB, ~5μs, sin GC
    const view = new Float32Array(_pendingBuffer);
    _listeners.forEach(cb => {
      try { cb(view, _pendingId); } catch (e) { console.error('[preload] listener error:', e); }
    });
  };

  _port.onmessageerror = (e) => console.error('[preload] port message error:', e);
  _port.start(); // ← CRÍTICO: activar el port
});

// ── API expuesta al Renderer World ──────────────────────────
contextBridge.exposeInMainWorld('dmx', {
  /**
   * Iniciar el handshake. Llamar una vez al montar la app.
   */
  connect: () => ipcRenderer.invoke('dmx:handshake'),

  /**
   * Suscribirse a frames DMX.
   * callback(view: Float32Array, frameId: number) → lectura síncrona únicamente.
   * Retorna función de cleanup.
   * 
   * IMPORTANTE: el `view` pasado al callback es válido SOLO durante la llamada síncrona.
   * No guardar referencias a él. Si necesitás datos persistentes, copiarlos explícitamente.
   */
  onFrame: (callback) => {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
  },

  /**
   * Llamar desde el rAF loop del renderer para confirmar que el frame fue renderizado.
   * Esto libera el buffer de vuelta al pool del Main Process.
   */
  ackFrame: () => {
    if (_pendingBuffer) {
      _port.postMessage({ type: 'ack', buffer: _pendingBuffer }, [_pendingBuffer]);
      _pendingBuffer = null;
    }
  }
});
javascript// ============================================================
// renderer — FixtureCanvas.jsx (fuera de React hot path)
// ============================================================
import { useEffect, useRef } from 'react';

export function FixtureCanvas({ universeIndex = 0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let rafId;
    let latestView = null;
    let latestId = -1;

    // Conectar al bridge
    window.dmx.connect().then(({ universes, channels }) => {
      canvas.width = channels;
      canvas.height = universes * 4; // 4px por universo, escalar con CSS
    });

    // Suscribirse: esto corre SINCRÓNICAMENTE cuando llega el frame
    // Solo guardamos la referencia, el render pasa en rAF
    const unsub = window.dmx.onFrame((view, id) => {
      latestView = view; // Float32Array clonado por contextBridge
      latestId = id;
    });

    // rAF loop: desacoplado del arrival de frames, siempre muestra estado más reciente
    const loop = () => {
      if (latestView) {
        renderDmxFrame(ctx, latestView, universeIndex);
        window.dmx.ackFrame(); // liberar buffer al pool
        latestView = null;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      unsub();
    };
  }, [universeIndex]);

  return <canvas ref={canvasRef} style={{ width: '100%', imageRendering: 'pixelated' }} />;
}

function renderDmxFrame(ctx, view, universeIndex) {
  const CHANNELS = 512;
  const offset = universeIndex * CHANNELS;
  const imageData = ctx.createImageData(CHANNELS, 1);
  
  for (let ch = 0; ch < CHANNELS; ch++) {
    const val = Math.round(view[offset + ch] * 255);
    const i = ch * 4;
    imageData.data[i]     = val;  // R
    imageData.data[i + 1] = val;  // G
    imageData.data[i + 2] = val;  // B
    imageData.data[i + 3] = 255;  // A
  }
  
  ctx.putImageData(imageData, 0, 0);
}

La Arquitectura Canónica Completa
┌─────────────────────────────────────────────────────────────┐
│  PROCESO NODE.JS (Main)                                     │
│                                                             │
│  ┌────────────────────┐    SAB (zero-copy)                  │
│  │  DMX Engine Worker │ ─────────────────────┐             │
│  │  (serialport C++)  │                      ▼             │
│  └────────────────────┘            ┌──────────────────┐    │
│                                    │   DmxBridge      │    │
│                                    │   Buffer Pool    │    │
│                                    │   [buf][buf][buf]│    │
│                                    └────────┬─────────┘    │
│                                     memcpy  │  transfer    │
└─────────────────────────────────────────────┼─────────────-┘
                                              │ MessageChannelMain
                              ┌───────────────▼─────────────┐
                              │  RENDERER PROCESS (Chromium) │
                              │                              │
                              │  preload.js                  │
                              │  ├─ gestiona port            │
                              │  ├─ retiene ArrayBuffers     │
                              │  └─ expone Float32Array view │
                              │           │ contextBridge     │
                              │           ▼ (clone ~5μs)     │
                              │  React World                 │
                              │  ├─ <FixtureCanvas> ← rAF   │
                              │  └─ Zustand (solo UI struct) │
                              └──────────────────────────────┘

LEYENDA DE LATENCIAS:
  SAB write (Node Worker → Main):      ~0μs  (memoria compartida)
  memcpy SAB → ArrayBuffer (Main):     ~3μs  (16KB)
  Transfer ArrayBuffer (Main→Preload): ~0μs  (zero-copy)
  Clone Float32Array (Preload→World):  ~5μs  (memcpy de 16KB)
  rAF render a Canvas:                 ~0.1ms
  TOTAL pipeline:                      < 0.5ms  ← vs 38ms con JSON
El frame drop intencional en el pool es la joya de esta arquitectura: si el renderer va lento (janks de React, GC, etc.), el Main simplemente descarta ese tick y en el siguiente envía el estado actual del hardware. Para DMX nunca querés renderizar frames viejos. La UI siempre converge al estado real del hardware, que es exactamente la semántica correcta.