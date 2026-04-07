/**
 * WAVE 2491 — THE ACTIVATION UX
 * Preload mínimo para la ventana de activación de licencia.
 *
 * Expone SOLO 4 métodos sobre contextBridge:
 *   - getData()     → obtiene hwid + error info
 *   - copyHwid()    → copia HWID al clipboard
 *   - loadLicense() → abre file dialog, valida, instala
 *   - restart()     → reinicia la app
 *   - quit()        → cierra la app
 *
 * ZERO acceso a luxsync, lux, electron, luxDebug.
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('activation', {
  getData: () => ipcRenderer.invoke('activation:getData'),
  copyHwid: () => ipcRenderer.invoke('activation:copyHwid'),
  loadLicense: () => ipcRenderer.invoke('activation:loadLicense'),
  restart: () => ipcRenderer.send('activation:restart'),
  quit: () => ipcRenderer.send('activation:quit'),
})
