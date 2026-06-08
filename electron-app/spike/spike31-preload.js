const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload: cargado');

const api = {
  onInit: (callback) => {
    ipcRenderer.on('glass-init', (event) => {
      console.log('Preload: glass-init recibido, ports:', event.ports.length);
      const port = event.ports[0];
      
      // Iniciar escucha en el puerto
      port.onmessage = (e) => {
        console.log('Preload: mensaje en puerto recibido');
        if (e.data && e.data.sab instanceof SharedArrayBuffer) {
          callback(e.data.sab);
        } else {
          console.error('Preload: No es SAB', e.data);
        }
      };
      
      // En WebWorkers puros se necesita port.start(), lo agregamos por las dudas
      port.start();
    });
  }
};

contextBridge.exposeInMainWorld('electronAPI', api);
