// WAVE-6005-SPIKE-2: Preload — recibe MessagePort del Main vía ipcRenderer.on.

import { contextBridge, ipcRenderer } from 'electron'

export interface GlassBridgeAPI {
  onGlassBridgeInit: (callback: (sab: SharedArrayBuffer) => void) => () => void
}

const api: GlassBridgeAPI = {
  onGlassBridgeInit(callback: (sab: SharedArrayBuffer) => void): () => void {
    const handler = (event: Electron.IpcRendererEvent) => {
      console.log('[PRELOAD] glass-bridge-port recibido, ports:', event.ports.length)
      const [port] = event.ports
      if (!port) {
        console.error('[PRELOAD] no port received')
        return
      }
      port.onmessage = (e: MessageEvent) => {
        console.log('[PRELOAD] SAB recibido del port:', e.data)
        if (e.data instanceof SharedArrayBuffer) {
          callback(e.data)
        }
      }
    }
    ipcRenderer.on('glass-bridge-port', handler)
    return () => {
      ipcRenderer.removeListener('glass-bridge-port', handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { GlassBridgeAPI as ElectronAPI }
