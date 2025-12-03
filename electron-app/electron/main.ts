/**
 * 🚀 LUXSYNC ELECTRON - MAIN PROCESS
 * El corazón de la nave espacial
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

// Variable global para la ventana principal
let mainWindow: BrowserWindow | null = null

// Detectar si estamos en desarrollo
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0f',
      symbolColor: '#7C4DFF',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false, // No mostrar hasta que esté listo
  })

  // Mostrar cuando esté listo (evita flash blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (isDev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  // Cargar la app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Limpiar referencia cuando se cierra
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Cuando Electron está listo
app.whenReady().then(() => {
  createWindow()

  // macOS: recrear ventana si se hace clic en el dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Cerrar app cuando todas las ventanas se cierran (excepto macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ============================================
// IPC HANDLERS - Comunicación con el Renderer
// ============================================

// Ejemplo: Obtener versión de la app
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

// Placeholder para DMX
ipcMain.handle('dmx:getStatus', () => {
  return { connected: false, interface: 'none' }
})

// Placeholder para Audio
ipcMain.handle('audio:getDevices', async () => {
  return []
})

console.log('🚀 LuxSync Electron Main Process Started')
