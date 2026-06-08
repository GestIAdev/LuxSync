"use strict";
// WAVE-6005-SPIKE-2: Preload — recibe MessagePort del Main vía ipcRenderer.on.
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    onGlassBridgeInit(callback) {
        const handler = (event) => {
            console.log('[PRELOAD] glass-bridge-port recibido, ports:', event.ports.length);
            const [port] = event.ports;
            if (!port) {
                console.error('[PRELOAD] no port received');
                return;
            }
            port.onmessage = (e) => {
                console.log('[PRELOAD] SAB recibido del port:', e.data);
                if (e.data instanceof SharedArrayBuffer) {
                    callback(e.data);
                }
            };
        };
        electron_1.ipcRenderer.on('glass-bridge-port', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('glass-bridge-port', handler);
        };
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
