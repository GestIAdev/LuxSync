const { app, protocol, BrowserWindow, MessageChannelMain, ipcMain } = require('electron');
const path = require('path');

// 1. Registro privilegiado (ANTES de app.whenReady)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'aether',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let win;
let sab;
let view;
let tick = 0;

// El HTML a servir
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>SPIKE 3.1 — Pure Oracle</title>
<style>
body { background: #0a0a0f; color: #fff; font-family: monospace; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-size: 24px; }
.fps { color: #0f0; }
</style>
</head>
<body>
  <div>crossOriginIsolated: <span id="coi" style="color:yellow"></span></div>
  <div>Tick: <span id="tick"></span></div>
  <div>SAB[1]: <span id="dimmer"></span></div>
  <div class="fps">FPS: <span id="fps"></span></div>

  <script>
    document.getElementById('coi').textContent = window.crossOriginIsolated;
    if(window.crossOriginIsolated) document.getElementById('coi').style.color = '#0f0';

    let dmxView = null;
    let rafCount = 0;
    let lastTime = performance.now();
    let lastFrames = 0;

    function render(now) {
      rafCount++;
      if (dmxView) {
        document.getElementById('tick').textContent = Atomics.load(dmxView, 0);
        document.getElementById('dimmer').textContent = Atomics.load(dmxView, 1);
      }
      if (now - lastTime >= 1000) {
        document.getElementById('fps').textContent = Math.round((rafCount - lastFrames) / ((now - lastTime)/1000));
        lastTime = now;
        lastFrames = rafCount;
      }
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // Conectar el puente expuesto por preload
    window.electronAPI.onInit(function(buffer) {
      console.log('Renderer recibió SAB!', buffer.byteLength);
      dmxView = new Int32Array(buffer);
    });
  </script>
</body>
</html>`;

app.whenReady().then(() => {
  // 2. Manejar protocolo para inyectar COOP/COEP
  protocol.handle('aether', () => {
    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    });
  });

  // 3. Crear ventana
  win = new BrowserWindow({
    width: 600, height: 400,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'spike31-preload.js')
    }
  });

  win.webContents.openDevTools({ mode: 'detach' });

  // 4. Cargar URL aether
  win.loadURL('aether://localhost/index.html');

  win.webContents.on('did-finish-load', () => {
    console.log('Main: did-finish-load');
    
    // Crear SAB
    sab = new SharedArrayBuffer(1024 * 1024); // 1 MB
    view = new Int32Array(sab);

    // Crear canal IPC zero-copy
    const { port1, port2 } = new MessageChannelMain();
    
    // Enviar port2 al preload
    win.webContents.postMessage('glass-init', null, [port2]);
    
    // Enviar SAB por port1
    port1.postMessage({ sab });

    // Iniciar loop de escritura
    setInterval(() => {
      tick++;
      Atomics.store(view, 0, tick);
      Atomics.store(view, 1, (tick * 7) % 256);
      if(tick % 100 === 0) console.log('Main Tick:', tick);
    }, 22);
  });
});

app.on('window-all-closed', () => app.quit());
