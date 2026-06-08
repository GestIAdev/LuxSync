import { contextBridge, ipcRenderer } from 'electron'

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 6005 v2: GLASS BRIDGE (Espejo Fluido)
// ═══════════════════════════════════════════════════════════════════════════

// Estado soberano: El Renderer World NUNCA toca el ArrayBuffer crudo.
let _port: MessagePort | null = null
let _pending: ArrayBuffer | null = null
const _listeners = new Set<(view: Float32Array) => void>()

// 1. Escuchar la llegada del MessagePort desde el Main Process
ipcRenderer.on('glass:port', (event) => {
  if (!event.ports || event.ports.length === 0) return

  _port = event.ports[0]

  _port.onmessage = ({ data }: MessageEvent) => {
    if (data?.type !== 'glass-state') return

    // Si ya teníamos un buffer sin consumir (Renderer ocupado/lento), 
    // lo devolvemos inmediatamente (Frame Drop Intencional frontend).
    if (_pending && _port) {
      _port.postMessage({ type: 'ack', buffer: _pending }, [_pending])
    }

    _pending = data.buffer

    // 2. Crear una vista sobre el buffer RAW y notificar a React/Canvas
    // La copia de contextBridge de un Float32Array tarda ~5µs.
    const view = new Float32Array(_pending!)
    _listeners.forEach((listener) => {
      try {
        listener(view)
      } catch (err) {
        console.error('[GlassBridge] Listener error:', err)
      }
    })
  }

  _port.onmessageerror = (err) => console.error('[GlassBridge] port error:', err)
  
  // CRÍTICO: Iniciar escucha explícita
  _port.start()
})

// 3. Exponer la API en window.glass
contextBridge.exposeInMainWorld('glass', {
  /** 
   * Iniciar Handshake. Debe ser llamado 1 vez al montar la app. 
   */
  connect: (): Promise<{ maxFixtures: number, floatsPerFix: number }> => {
    return ipcRenderer.invoke('glass:handshake')
  },

  /** 
   * Suscribirse a cada frame entrante.
   * ADVERTENCIA: El "view" es válido SOLO durante la invocación síncrona.
   */
  onFrame: (callback: (view: Float32Array) => void): (() => void) => {
    _listeners.add(callback)
    return () => {
      _listeners.delete(callback)
    }
  },

  /**
   * Confirma la consumición del frame y devuelve el ArrayBuffer al Main.
   * Debe llamarse desde el requestAnimationFrame.
   */
  ackFrame: (): void => {
    if (_pending && _port) {
      // Transferencia de propiedad (ownership) de vuelta al Main Process.
      _port.postMessage({ type: 'ack', buffer: _pending }, [_pending])
      _pending = null
    }
  }
})
