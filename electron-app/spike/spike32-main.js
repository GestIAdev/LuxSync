const { app, BrowserWindow, MessageChannelMain } = require('electron');
const path = require('path');

let win;
let tick = 0;

// Renderizamos desde un archivo simple (sin COOP/COEP porque ArrayBuffer no lo necesita)
const HTML = `<!DOCTYPE html>
<html>
<body>
  <h2>Transferable ArrayBuffer Ping-Pong</h2>
  <div id="log"></div>
  <script>
    window.electronAPI.onInit((port) => {
      document.getElementById('log').innerHTML += '<br/>Renderer: Puerto recibido';
      port.onmessage = (e) => {
        const buffer = e.data;
        const view = new Int32Array(buffer);
        document.getElementById('log').innerHTML = '<br/>Renderer: buffer tick=' + view[0];
        
        // Devolvemos el buffer (Transferible)
        port.postMessage(buffer, [buffer]);
      };
    });
  </script>
</body>
</html>`;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 600, height: 400,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'spike32-preload.js')
    }
  });

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));

  win.webContents.on('did-finish-load', () => {
    console.log('Main: did-finish-load');
    
    const { port1, port2 } = new MessageChannelMain();
    
    // Transferir port2
    win.webContents.postMessage('pingpong-init', null, [port2]);
    
    // Nuestro buffer transferible (ArrayBuffer, no SharedArrayBuffer)
    let myBuffer = new ArrayBuffer(1024);
    
    // Función para enviar
    function sendBuffer() {
      if (!myBuffer) return; // Esperamos que vuelva
      tick++;
      const view = new Int32Array(myBuffer);
      view[0] = tick;
      
      const bufferToSend = myBuffer;
      myBuffer = null; // Neutered
      
      console.log('Main: Enviando tick', tick);
      port1.postMessage(bufferToSend, [bufferToSend]); // TRANSFER
    }

    port1.on('message', (e) => {
      // Recibido de vuelta
      myBuffer = e.data;
    });
    port1.start();

    setInterval(sendBuffer, 100);
  });
});

app.on('window-all-closed', () => app.quit());
