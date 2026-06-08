Buenos días! Qué delicioso problema. Vamos directo al hueso.

Pregunta 1: ¿Hay un hack para COOP/COEP en Electron?
Sí existe, y es estable en producción. El error que enfrentaron con file:// tiene sentido: webRequest no intercepta file://. La solución es registrar un protocolo privilegiado custom antes de que la app esté lista, lo que le da a Chromium un contexto HTTP-like donde los headers sí aplican.
javascript// main.js — ANTES de app.whenReady()
const { app, protocol, BrowserWindow, session } = require('electron');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'aether',
    privileges: {
      standard: true,
      secure: true,         // tratado como HTTPS → habilita SAB
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

app.whenReady().then(() => {
  // Handler del protocolo: sirve tu app con los headers mágicos
  protocol.handle('aether', async (request) => {
    const url = new URL(request.url);
    const filePath = path.join(__dirname, 'dist', url.pathname);
    
    const body = await fs.promises.readFile(filePath);
    const mime = getMimeType(filePath); // tu helper

    return new Response(body, {
      headers: {
        'Content-Type': mime,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    });
  });

  const win = new BrowserWindow({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('aether://localhost/index.html'); // ← clave
});
Una vez cargado así, window.crossOriginIsolated === true en el renderer, y el SAB cruza MessageChannelMain sin drama.
javascript// main.js — después de crear la ventana
const { MessageChannelMain } = require('electron');
const { port1, port2 } = new MessageChannelMain();

// Transferir el port al renderer (esto siempre funcionó)
win.webContents.postMessage('dmx:init', null, [port2]);

// Ahora SÍ podés enviar el SAB por el channel
const sab = new SharedArrayBuffer(512 * 4 * 8); // 8 universos × 512 floats
port1.postMessage({ sab }); // ← antes explotaba, ahora no
javascript// preload.js
const { ipcRenderer } = require('electron');

ipcRenderer.on('dmx:init', (event) => {
  const [port] = event.ports;
  port.onmessage = ({ data }) => {
    // data.sab es tu SharedArrayBuffer
    window.__dmxBuffer = new Float32Array(data.sab);
  };
});
Flag oculto alternativo (más frágil, documentado en los Chromium internals): app.commandLine.appendSwitch('enable-features', 'SharedArrayBufferUnrestrictedAccessAllowed'). Funciona en algunas versiones pero puede romperse con updates de Electron. El protocolo custom de arriba es el camino correcto para producción.

Pregunta 2: ¿Es el Float32Array el techo, o hay algo más rápido?
El Float32Array por IPC no es el techo, y aquí está el matiz que probablemente no vieron: hay una diferencia fundamental entre copiar y transferir.
El IPC normal (incluso con typed arrays) copia el buffer en serialización estructurada. Pero MessageChannelMain soporta transferibles: el ArrayBuffer subyacente se mueve, no se copia. El sender queda con el buffer neutered. Cero copia, cero GC.
javascript// Arquitectura ping-pong con buffer pool (si no podés habilitar SAB)
const POOL_SIZE = 4;
const bufferPool = Array.from({ length: POOL_SIZE }, 
  () => new ArrayBuffer(512 * 4 * 8)
);

function pushFrame(port) {
  const buffer = bufferPool.pop();
  if (!buffer) return; // renderer no devolvió buffers, skip frame
  
  const view = new Float32Array(buffer);
  dmxEngine.fillInto(view); // write directo, sin allocaciones
  
  port.postMessage({ frame: view }, [buffer]); // TRANSFER, no copy
}

// El renderer devuelve el buffer vacío para reusar
port.onmessage = ({ data }) => {
  if (data.returnBuffer) bufferPool.push(data.returnBuffer);
};
javascript// renderer side
port.onmessage = ({ data }) => {
  renderFrame(data.frame); // render directo del typed array
  
  // Devolver el buffer al pool
  port.postMessage({ returnBuffer: data.frame.buffer }, [data.frame.buffer]);
};
Comparación honesta de las arquitecturas exóticas que mencionás:
Un WebSocket local (o peor, UDP via dgram) agrega la pila de red del OS: empaquetado TCP/UDP, copia al kernel, syscall, copia de vuelta al userspace. Para 44Hz y ~16KB/frame es perfectamente funcional, pero es estrictamente peor que IPC en latencia. UDP es seductor pero en loopback la diferencia es <1ms y agregás unreliability. No vale la pena.
OffscreenCanvas no es relevante para el transporte, pero sí para el render: si tu visualización de fixtures es un canvas 2D o WebGL, dibujar desde el Float32Array/SAB directamente en un OffscreenCanvas en un Worker del renderer saca completamente a React del hot path. Eso sí mueve la aguja.

La arquitectura que yo implementaría
Dado que la solución del protocolo custom es limpia, mi recomendación es:
DMX Engine (Worker Thread)
        │  SAB write @ 44Hz (ya lo tenés)
        ▼
   Main Process
        │  SAB pass via MessageChannelMain (una vez)
        ▼
  Renderer Process
        │  window.__dmxSAB = new Float32Array(sab)
        ▼
  rAF loop (60Hz)  ←── lee directamente del SAB, NO toca React
        │
        ▼
  Canvas / WebGL renderer  (para el visualizador DMX)
  React / Zustand           (solo para UI estructural: botones, configuración)
El punto crítico es el último: no empujes el SAB a React state. React no debería saber que el DMX existe. El visualizador de fixtures debe ser un <canvas ref> que en su loop de requestAnimationFrame lee window.__dmxSAB directamente y pinta. Zustand solo se actualiza cuando el operador hace un cambio volitivo (patch de fixture, cambio de escena), no a 44Hz.
javascript// FixtureCanvas.jsx
function FixtureCanvas() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let rafId;
    
    const loop = () => {
      const dmx = window.__dmxSAB; // Float32Array del SAB
      if (dmx) renderFixtures(ctx, dmx); // sin allocaciones, sin VDOM
      rafId = requestAnimationFrame(loop);
    };
    
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);
  
  return <canvas ref={canvasRef} />;
}
Esto elimina el parpadeo de hardware porque el Event Loop del Main Process queda libre: el Worker Thread escribe el SAB de forma independiente, y el renderer lo lee en su propio ciclo. Los 38ms de microtask blockage desaparecen porque ya no hay serialización JSON ni scheduling de mensajes en el hot path.