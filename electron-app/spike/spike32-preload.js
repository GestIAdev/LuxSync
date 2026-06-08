const { contextBridge, ipcRenderer } = require('electron');

const api = {
  onInit: (callback) => {
    ipcRenderer.on('pingpong-init', (event) => {
      const port = event.ports[0];
      // En vez de escuchar nosotros, pasamos el puerto crudo al renderer
      // ¡El renderer (HTML) no puede usar objetos de Electron directamente, pero
      // podemos exponer un proxy o reemitir!
      
      // Emitiremos en el main world via window.postMessage para mantener zero-copy
      port.onmessage = (e) => {
        window.postMessage({ type: 'pingpong-data', buffer: e.data }, '*', [e.data]);
      };
      
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'pingpong-return') {
          port.postMessage(e.data.buffer, [e.data.buffer]);
        }
      });

      // Notificamos que está listo
      callback({
        onmessage: (cb) => {
          window.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'pingpong-data') cb({ data: e.data.buffer });
          });
        },
        postMessage: (buf, transfer) => {
          window.postMessage({ type: 'pingpong-return', buffer: buf }, '*', transfer);
        }
      });
    });
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
