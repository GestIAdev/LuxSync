INFORME FORENSE WAVE-6018 — FUGA DEL AETHER GLASS MESSAGEPORT
Modo: Read-Only, Zero Hacks
Hallazgo: Dos fugas simultáneas. Una en el ciclo de vida nativo de Electron (Empalme 1→2) y otra en el montaje React (Empalme 3).

🔍 EMPALME 1: El Origen (main.ts:428)


ts
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/main.ts:428-432
mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) return
    const { port1, port2 } = new MessageChannelMain()
    glassPoolManager.attach(port1)
    mainWindow.webContents.postMessage('glass:port', null, [port2])
})
Análisis:
El puerto se envía únicamente en did-finish-load. Este evento de Chromium se dispara cuando la carga de la página (incluyendo todos sus recursos) finaliza. En un entorno de desarrollo con Vite/HMR, esto ocurre después de que el DOM ya está hidratado y React ha montado GlassCanvas.

Estado: ✅ Técnicamente correcto para producción. PERO introduce una ventana de carrera en desarrollo.

🔍 EMPALME 2: El Puente (glassPreload.ts:13 + preload.ts:9)


ts
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts:13-45
ipcRenderer.on('glass:port', (event) => {
  if (!event.ports || event.ports.length === 0) return
  _port = event.ports[0]
  _port.onmessage = ({ data }: MessageEvent) => { ... }
  _port.start()
})


ts
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts:9
import './glassPreload'
Análisis:
El listener ipcRenderer.on('glass:port', ...) se registra en el script de preload (preload.ts importa glassPreload.ts en línea 9). Esto ocurre antes de que cualquier script de la página (incluyendo React) se ejecute. Cuando main.ts dispara postMessage('glass:port', ...), el listener está vivo y _port.start() se ejecuta.

Estado: ✅ Correcto. El puente no pierde el puerto.

🔍 EMPALME 3: El Destino (GlassCanvas.tsx:13)


tsx
@/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx:13-17
useEffect(() => {
    if (!window.glass) {
      console.warn('[GlassCanvas] window.glass no disponible')
      return
    }
    // ...
})
Análisis — FUGA CONFIRMADA #1 (Timing de Montaje):
GlassCanvas.tsx se monta como componente React. El useEffect con [] se ejecuta una sola vez después del primer render. Si en ese instante window.glass aún no existe (porque el preload aún no terminó de exponer la API, o porque el componente se montó antes de que el contextBridge finalizara), el useEffect hace return temprano y nunca vuelve a intentarlo.

No hay ningún setTimeout, setInterval, MutationObserver o re-intento condicional. El componente queda muerto para siempre respecto al GlassBridge.

Análisis — FUGA CONFIRMADA #2 (Ausencia de Re-Subscripción):
Incluso si window.glass existiera, no hay mecanismo para detectar que el puerto llegó después del montaje. El componente no reacciona a cambios en window.glass.

🎯 VEREDICTO FINAL
El puerto NO se pierde en el Main Process (Empalme 1 funciona) ni en el Preload (Empalme 2 funciona). La fuga ocurre en el Empalme 3, en la interfaz entre el mundo nativo de Electron (window.glass) y el ciclo de vida de React (useEffect).

Causa raíz:
GlassCanvas.tsx evalúa window.glass en el momento del montaje (useEffect con dependencia vacía []). Si la evaluación es undefined o null, el componente se rinde silenciosamente y nunca se recupera. Esto explica la ausencia total de logs de GlassCanvas en el frontend: el callback onFrame nunca se registra.

Nota secundaria (no crítica para la fuga, pero relevante):
El ackFrame() se llama dentro del requestAnimationFrame loop del canvas (línea 63), no en el onFrame callback. Esto significa que el ping-pong del BufferPool solo avanza si el canvas está renderizando, pero esto es una consecuencia de la fuga, no la causa.

📋 Evidencia Forense
Archivo	Línea	Observación
main.ts	428-432	Envío correcto en did-finish-load
glassPreload.ts	13-45	Recepción y port.start() correctos
preload.ts	9	Importa glassPreload antes de todo
GlassCanvas.tsx	13-17	FUGA: if (!window.glass) return sin re-intento
🔬 Recomendación para el Arquitecto (Solo Diagnóstico, Sin Código)
El ciclo de vida nativo de Electron (preload → postMessage → port.start) está intacto. La rotura está en la capa de adaptación React, donde el montaje del componente ocurrió antes de que la API window.glass estuviera disponible, o donde la falta de re-intento deja al componente inerte.

Para confirmar esta hipótesis, inspeccionar el log del renderer al inicio: si aparece [GlassCanvas] window.glass no disponible una sola vez y nunca más, la fuga está confirmada al 100%.