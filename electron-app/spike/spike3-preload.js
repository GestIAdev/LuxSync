"use strict";
// WAVE-6005-SPIKE-3: Preload — recibe SAB del Main vía ipcRenderer.on + postMessage.
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
console.log('[PRELOAD] cargado — registrando handler glass-bridge');
const api = {
    onGlassBridgeInit(callback) {
        const handler = (event) => {
            console.log('[PRELOAD] glass-bridge recibido, ports:', event.ports?.length ?? 0);
            const [port] = event.ports;
            if (!port) {
                console.error('[PRELOAD] no port received');
                return;
            }
            port.onmessage = (e) => {
                console.log('[PRELOAD] mensaje del port recibido, data:', typeof e.data, e.data);
                const sab = e.data?.sab;
                if (sab instanceof SharedArrayBuffer) {
                    console.log('[PRELOAD] SAB extraído:', sab.byteLength, 'bytes');
                    callback(sab);
                }
                else {
                    console.error('[PRELOAD] data no contiene SAB:', e.data);
                }
            };
        };
        electron_1.ipcRenderer.on('glass-bridge', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('glass-bridge', handler);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
