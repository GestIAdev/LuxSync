# WAVE-6060-GLASS-PROD — Reporte Forense: Cuello de Botella UI en Producción

## Hallazgo Ejecutivo

La UI general en producción opera a **1Hz** debido a un throttle explícito en `main.ts:612` (`_lastTruthFrame % 44 !== 0`). Esto es comportamiento intencional para `selene:truth` (Zustand/truthStore).

Sin embargo, componentes de alto rendimiento que leen de `transientStore` vía `requestAnimationFrame` (AudioSpectrumTitan, 3D viewers) también se congelan a **1Hz** en producción, cuando en desarrollo fluyen a 44-60Hz. Esto indica que el **GlassBridge**, el canal de alta frecuencia diseñado para reemplazar `selene:hot-frame`, no está operativo en la build compilada.

---

## 1. El Misterio del AudioSpectrum a 1Hz

### 1.1 Dos espectrómetros, dos arquitecturas

Existen **dos** componentes de espectro de audio con fuentes de datos distintas:

#### A) `AudioSpectrumPanel` (mini spectrum / panel neural)
```tsx
// src/components/telemetry/AudioSpectrumPanel/AudioSpectrumPanel.tsx:31-32
const audio = useTruthAudio()
const beat = useTruthBeat()
```

Los hooks `useTruthAudio()` y `useTruthBeat()` leen de **Zustand / truthStore**:

```tsx
// src/hooks/useSeleneTruth.ts:277-287
export function useTruthAudio() {
  return useTruthStore(useShallow(selectSensoryAudio))
}
export function useTruthBeat() {
  return useTruthStore(useShallow(selectSensoryBeat))
}
```

**Veredicto:** 1Hz es **esperado**. Este componente depende de `selene:truth`, capado explícitamente a ~1Hz en `main.ts:612`.

#### B) `AudioSpectrumTitan` (espectrómetro grande / RAF engine)
```tsx
// src/components/views/SensoryView/AudioSpectrumTitan.tsx:165-171
const tick = (now: number) => {
  const truth = getTransientTruth()  // ← transientStore, NO Zustand
  if (!truth) { frameId = requestAnimationFrame(tick); return }
  const audio = truth.sensory.audio
  const beat = truth.sensory.beat
```

Este componente usa un **loop RAF imperativo** que lee `getTransientTruth()` cada frame (60fps).

**Veredicto:** Si va a 1Hz, el `transientStore` no está siendo alimentado a 44Hz por el GlassBridge. El pipeline GlassBridge→transientStore está roto en producción.

### 1.2 Cómo se alimentaba transientStore antes vs ahora

#### Antes (WAVE 2510 / desarrollo):
```tsx
// src/hooks/useSeleneTruth.ts:194-198
if (window.lux?.onHotFrame) {
  removeHotFrameListener = window.lux.onHotFrame((hotFrame: any) => {
    injectHotFrame(hotFrame)  // ← 44Hz directo a transientStore
  })
}
```

Pero este canal IPC fue **eliminado** en WAVE 6015:

```ts
// electron/main.ts:624-626
// 🛑 WAVE 6015 PARCHE 1: selene:hot-frame ERADICATED.
// GlassBridge (BufferPoolManager) is the sole high-frequency visual data channel.
```

#### Ahora (WAVE 6018):
El único alimentador de alta frecuencia debería ser `GlassCanvas.tsx`, que recibe `window.glass.onFrame` a 44Hz y muta `transientStore` directamente:

```tsx
// src/components/GlassCanvas.tsx:22-39
unsubscribe = window.glass.onFrame((view) => {
  const transient = getTransientTruth()
  if (!transient || !view || view.length === 0) return
  
  // Cabecera de Audio (Indices 0-4)
  if (transient.sensory?.audio) {
    transient.sensory.audio.bass = view[0]
    transient.sensory.audio.mid = view[1]
    transient.sensory.audio.high = view[2]
    transient.sensory.audio.energy = view[3]
  }
  if (transient.sensory?.beat) {
    transient.sensory.beat.onBeat = view[4] > 0.5
  }
  // ... fixture data desde offset 10
})
```

Si `AudioSpectrumTitan` lee `transientRef.current` a 60fps y sus valores de audio solo cambian cada 1s, significa que `GlassCanvas` no está mutando el transientStore (no recibe frames del GlassBridge, o falla silenciosamente).

---

## 2. La Brecha Dev vs Prod en GlassBridge

### 2.1 Arquitectura del GlassBridge

```
TickEngine (44Hz)
  └─→ BufferPoolManager.pushFrame(view)  [Main Process]
         └─→ MessagePortMain.postMessage({type:'glass-state', buffer})
                └─→ Renderer Preload (glassPreload.ts)
                       └─→ window.glass.onFrame(callback)
                              └─→ GlassCanvas.tsx muta transientStore
                                     └─→ AudioSpectrumTitan RAF lee transientStore
```

### 2.2 Evidencia del pipeline

**Main Process — creación del MessageChannel:**
```ts
// electron/main.ts:428-433
mainWindow.webContents.on('did-finish-load', () => {
  if (!mainWindow) return
  const { port1, port2 } = new MessageChannelMain()
  glassPoolManager.attach(port1)
  mainWindow.webContents.postMessage('glass:port', null, [port2])
})
```

**Preload — recepción del puerto:**
```ts
// electron/glassPreload.ts:13-48
ipcRenderer.on('glass:port', (event) => {
  if (!event.ports || event.ports.length === 0) return
  _port = event.ports[0]
  _port.onmessage = ({ data }: MessageEvent) => {
    if (data?.type !== 'glass-state') return
    // ... notifica listeners + ack
  }
  _port.start()
  window.dispatchEvent(new CustomEvent('glass:ready'))
})
```

**Renderer — suscripción:**
```tsx
// src/components/GlassCanvas.tsx:19-24
const connect = () => {
  if (!window.glass || isSubscribedRef.current) return
  unsubscribe = window.glass.onFrame((view) => { ... })
}
```

### 2.3 Hipótesis de fallo en producción

No se ha detectado un `if (isDev)` ni `app.isPackaged` que deshabilite el GlassBridge explícitamente. Sin embargo, el síntoma (1Hz en componentes RAF) apunta a una de estas causas:

| Hipótesis | Evidencia | Probabilidad |
|-----------|-----------|--------------|
| **H1: glassPreload.ts no se bundlea en preload.js** | `vite.config.ts` configura `electron/preload.ts` como entry. El import `./glassPreload` debería incluirse en el bundle. Sin embargo, NO se verificó que `dist-electron/preload.js` contenga el código de `glassPreload.ts`. | **Alta** |
| **H2: window.glass no existe en producción** | Si `glassPreload.ts` no se ejecuta (error silencioso), `window.glass` es `undefined`. `GlassCanvas` entonces escucha `glass:ready` pero el evento nunca llega (porque el preload nunca lo disparó). | **Alta** |
| **H3: MessagePort no se transfiere en file://** | `postMessage('glass:port', null, [port2])` usa `postMessage` con transferables. En Electron con `file://` origin y `contextIsolation:true`, esto debería funcionar. No hay evidencia de que falle. | Media |
| **H4: BufferPoolManager no recibe attach()** | `main.ts:431` llama `glassPoolManager.attach(port1)` y `titanOrchestrator.glassPool = glassPoolManager` (línea 538). Esto es código síncrono, no condicional. | Baja |
| **H5: GlassCanvas.tsx se desmonta o no se monta** | Está importado en `AppCommander.tsx:15,112`. Sin embargo, el componente tiene `display: 'none'` (invisible). Esto no impide su ejecución, pero podría estar siendo tree-shaked o lazy-loaded diferente en prod. | Media |

### 2.4 Dato crítico: Canal eliminado sin fallback robusto

```ts
// electron/main.ts:624-626
// 🛑 WAVE 6015 PARCHE 1: selene:hot-frame ERADICATED.
// GlassBridge (BufferPoolManager) is the sole high-frequency visual data channel.
// No more 44Hz IPC spam to the renderer.
```

El comentario asume que GlassBridge es el **único** canal necesario. Pero si GlassBridge falla en producción, no hay fallback. El `selene:hot-frame` listener sigue existiendo en el renderer (`useSeleneTruth.ts:194`), pero el main process nunca lo emite.

### 2.5 Diferencia clave Dev vs Prod

| Aspecto | Desarrollo (`localhost:5173`) | Producción (`file://dist/index.html`) |
|---------|-------------------------------|---------------------------------------|
| `selene:truth` | ~1Hz (throttle %44) | ~1Hz (throttle %44) |
| `selene:hot-frame` | **Eliminado en main.ts** | **Eliminado en main.ts** |
| `window.glass.onFrame` | ¿Funciona? (no verificado) | **NO funciona** (síntoma: 1Hz) |
| HMR / React Strict Mode | Sí | No |
| Preload path | `dist-electron/preload.js` (mismo archivo) | `dist-electron/preload.js` (mismo archivo) |

**Conclusión:** La brecha no es un throttle condicional. Es un **fallo silencioso del GlassBridge en la build compilada**, posiblemente porque `glassPreload.ts` no se incluye correctamente en el bundle de preload o porque `window.glass` no se expone en el entorno `file://`.

---

## 3. Propuesta de Refactor — El Balance Perfecto

### 3.1 Objetivo

- **truthStore (Zustand):** ~10-15Hz — suficiente para UI reactiva sin asfixiar React.
- **GlassBridge (transientStore):** 44Hz puros — espectrómetros, 3D viewers, TacticalCanvas.
- **Fallback:** Si GlassBridge no está disponible, reactivar `selene:hot-frame` para audio/fixtures críticos.

### 3.2 Paso 1: Aumentar truthStore a ~10-15Hz

```ts
// electron/main.ts:609-622 — REESCRITURA PROPUESTA
let _lastTruthFrame = 0
const TRUTH_THROTTLE_EVERY_N = 4  // 44Hz / 4 = ~11Hz

titanOrchestrator.setBroadcastCallback((truth) => {
  _lastTruthFrame++
  // 🩸 WAVE-6060: 11Hz para UI fluida sin colapsar React
  if (_lastTruthFrame % TRUTH_THROTTLE_EVERY_N !== 0) return
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      truth.hardware.dmx.outputEnabled = titanOrchestrator.isOutputEnabled()
      mainWindow.webContents.send('selene:truth', truth)
    }
  } catch (err) { /* renderer destroyed, ignore */ }
})
```

**Impacto:** `selene:truth` pasa de ~1Hz a ~11Hz. React/Zustand recibe actualizaciones más frecuentes sin saturación. Los componentes como `AudioSpectrumPanel` (que usan `useTruthAudio()`) se vuelven fluidos.

### 3.3 Paso 2: Fallback condicional — Reactivar hot-frame si GlassBridge no está

```ts
// electron/main.ts:624-640 — REESCRITURA PROPUESTA
// 🛡️ WAVE-6060: Fallback dual-channel
// GlassBridge es el camino principal. Si no hay conexión de MessagePort,
// selene:hot-frame actúa como respaldo de 44Hz para audio + fixtures.

let _lastHotFrame = 0
titanOrchestrator.setHotFrameCallback((hotFrame) => {
  _lastHotFrame++
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // Solo enviar hot-frame si el renderer NO confirmó glass:handshake
      // o si no hay port activo en el BufferPoolManager
      const glassActive = glassPoolManager.getMetrics().framesSent > 0
      if (!glassActive) {
        mainWindow.webContents.send('selene:hot-frame', hotFrame)
      }
    }
  } catch (err) { /* ignore */ }
})
```

En el renderer, el listener de `window.lux.onHotFrame` en `useSeleneTruth.ts` sigue existiendo y funcionaría como respaldo.

### 3.4 Paso 3: Verificación de GlassBridge en boot

```tsx
// src/components/GlassCanvas.tsx:76-82 — REESCRITURA PROPUESTA
if (window.glass) {
  connect()
} else {
  window.addEventListener('glass:ready', connect)
  // 🛡️ WAVE-6060: Timeout defensivo — si en 5s no hay glass, loggear y confiar en fallback
  setTimeout(() => {
    if (!isSubscribedRef.current) {
      console.warn('[GlassCanvas] ⚠️ GlassBridge no disponible tras 5s. '
        + 'Los componentes RAF dependerán de selene:hot-frame fallback.')
    }
  }, 5000)
}
```

### 3.5 Paso 4 (Investigación posterior al show): Verificar bundle de preload

```bash
# Comando para verificar que glassPreload.ts está en el bundle
grep -n "window.glass" dist-electron/preload.js
grep -n "glass:port" dist-electron/preload.js
```

Si no aparecen, el problema es que `vite-plugin-electron` no está incluyendo `glassPreload.ts` en el bundle de producción del preload.

---

## 4. Acciones Inmediatas Recomendadas (Post-Show)

1. **Reconstruir con `TRUTH_THROTTLE_EVERY_N = 4`** para recuperar ~11Hz en UI general.
2. **Reactivar `selene:hot-frame` como fallback** cuando `glassPoolManager` no haya enviado frames.
3. **Auditar `dist-electron/preload.js`** para confirmar que `glassPreload.ts` se bundlea correctamente.
4. **Añadir telemetría** al `BufferPoolManager` para reportar si el MessagePort se conecta correctamente en producción.

---

*Reporte generado: WAVE-6060-GLASS-PROD.md*
*Autor: Ingeniero Core Forense*
*Estado: Concluido — requiere implementación post-show*
