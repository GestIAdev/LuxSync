// WAVE-6005-SPIKE-3: Preload — recibe SAB del Main vía ipcRenderer.on + postMessage.

import { contextBridge, ipcRenderer } from 'electron'

console.log('[PRELOAD] cargado — registrando handler glass-bridge')

export interface GlassBridgeAPI {
  onGlassBridgeInit: (callback: (sab: SharedArrayBuffer) => void) => () => void
}

const api: GlassBridgeAPI = {
  onGlassBridgeInit(callback: (sab: SharedArrayBuffer) => void): () => void {
    const handler = (event: Electron.IpcRendererEvent) => {
      console.log('[PRELOAD] glass-bridge recibido, ports:', event.ports?.length ?? 0)
      const [port] = event.ports
      if (!port) {
        console.error('[PRELOAD] no port received')
        return
      }
      port.onmessage = (e: MessageEvent) => {
        console.log('[PRELOAD] mensaje del port recibido, data:', typeof e.data, e.data)
        const sab = (e.data as any)?.sab
        if (sab instanceof SharedArrayBuffer) {
          console.log('[PRELOAD] SAB extraído:', sab.byteLength, 'bytes')
          callback(sab)
        } else {
          console.error('[PRELOAD] data no contiene SAB:', e.data)
        }
      }
    }
    ipcRenderer.on('glass-bridge', handler)
    return () => {
      ipcRenderer.removeListener('glass-bridge', handler)
    }
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type { GlassBridgeAPI as ElectronAPI }
