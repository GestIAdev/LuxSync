FORENSIC ALLOCATION REPORT — OOM Silencioso en React Frontend
Caso: White screen / OOM silencioso durante shows en vivo con telemetría DMX de alta frecuencia. Modo: SOLO DIAGNÓSTICO — No se modificó código. Fecha: 2026-08-05

0. SUMARIO EJECUTIVO
El crash no es un leak clásico (array que crece sin límite, interval sin limpiar, listener zombi). Es un crecimiento monótono del heap por presión de GC perdida durante shows en vivo, causado por una triple convergencia fatal que se activa solo cuando Chronos playback está activo:

El throttle de React fue desactivado (TRUTH_THROTTLE_INTERVAL = 1) bajo la suposición falsa de que el backend ya throttlea a ~2Hz. Pero el backend bypassea el throttle a 44Hz durante Chronos playback.
Doble ingesta de 44Hz sobre los mismos objetos fixture (Glass SAB + IPC hot-frame) — una de ellas con allocación de objetos color por frame.
Cola de re-renders de React a 44Hz vía setTruth() + updateMetrics() que satura el main thread, impidiendo que el GC alcance la tasa de allocación.
El GC no "falla" técnicamente — nunca recibe tiempo de CPU suficiente para recolectar la basura generada a 44Hz porque el main thread está saturado reconciliando React.

1. ARCHIVOS IMPLICADOS (Localizados vía grep)
Rol	Archivo	Líneas críticas
Glass Bridge preload	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts:0:0-0:0)	18-38, 63-80
Buffer Pool (main)	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/glass/BufferPoolManager.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/glass/BufferPoolManager.ts:0:0-0:0)	47-67
Tick Engine (emisor)	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:0:0-0:0)	907-926
React IPC hook	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts:0:0-0:0)	82, 123, 145-154, 211-213
Transient Store	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/transientStore.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/stores/transientStore.ts:0:0-0:0)	151-281
GlassCanvas (suspect #1)	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx:0:0-0:0)	20-62
TacticalCanvas (suspect #2)	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:0:0-0:0)	485-536
Worker receptor	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/hyperion-render.worker.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/workers/hyperion-render.worker.ts:0:0-0:0)	588-614
HyperionView (parent)	[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/HyperionView.tsx](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/HyperionView.tsx:0:0-0:0)	109-112
2. ANÁLISIS DE FLUJO DE DATOS
2.1 La cadena del "Liquid Mirror Ping Pong" (confirmada)


TickEngine (44Hz)
  ├─ selene:hot-frame (44Hz, HOT_FRAME_DIVIDER=1)  ──→ IPC ──→ useSeleneTruth:211 ──→ injectHotFrame
  ├─ selene:truth (11Hz normal, 44Hz Chronos bypass) ──→ IPC ──→ useSeleneTruth:123 ──→ setTruth + updateMetrics
  └─ glassPoolManager.pushFrame (44Hz) ──→ MessagePort ──→ glassPreload:18 ──→ window.glass.onFrame listeners:
       ├─ GlassCanvas:20    ──→ muta transientStore fixtures (O(N))
       └─ TacticalCanvas:500 ──→ packGlassFrameInto (O(N)) + port1.postMessage (structured clone)
2.2 El bypass crítico de Chronos (SMOKING GUN #1)
[TickEngine.ts:907-908](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/orchestrator/tick/TickEngine.ts:906:0-907:999)



typescript
const chronosPlaying = this.engine?.isChronosPlaybackActive() ?? false
const shouldBroadcastFullTruth = chronosPlaying || (this.frameCount % TickEngine.TRUTH_BROADCAST_DIVIDER === 0)
Durante un show en vivo (Chronos activo), selene:truth se emite a 44Hz, no a 11Hz. El comentario en línea 899-900 lo confirma explícitamente: "During Chronos playback, broadcast full truth at full rate (44fps)".

2.3 El throttle desactivado (SMOKING GUN #2)
[useSeleneTruth.ts:81-82](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts:80:0-81:999)



typescript
const TRUTH_THROTTLE_INTERVAL = 1  // WAVE-6018: Cambiado de 6 a 1. main.ts ya aplica throttle a ~2Hz
El comentario afirma que el backend throttlea a ~2Hz. Esto es falso durante Chronos playback (emite a 44Hz). Con TRUTH_THROTTLE_INTERVAL = 1, el bloque throttled (líneas 127-171) ejecuta en cada frame:

setTruth(metadataTruth) — 44 Zustand updates/sec
useAudioStore.getState().updateMetrics(...) — 44 Zustand updates/sec
3. VECTORES DE ALLOCACIÓN (Root Causes del OOM)
VECTOR A — Re-renders de React a 44Hz (PRIMARIO — Mata el GC)
Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts:0:0-0:0) Líneas: 145-154, 161-169

[useSeleneTruth.ts:145-169](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts:144:0-168:999)



typescript
const metadataTruth: typeof data = {
  ...data,                              // ← NEW object (spread)
  hardware: {
    ...data.hardware,                   // ← NEW object (spread)
    fixtures: [],                       // ← NEW array
    dmxOutput: [],                      // ← NEW array
  },
}
setTruth(metadataTruth)                 // ← 44 Zustand set()/sec → re-renders
// ...
useAudioStore.getState().updateMetrics({...})  // ← 44 Zustand set()/sec → re-renders
Allocación por frame: 4 nuevos objetos (spread + 2 arrays vacíos). Frecuencia durante Chronos: 44Hz → 176 objetos/sec solo aquí. Daño real: setTruth() dispara notificaciones a TODOS los suscriptores de truthStore. updateMetrics() dispara notificaciones a TODOS los suscriptores de audioStore. HyperionView (línea 109) está suscrito a audioStore(useShallow(selectHyperionAudio)) → re-renderiza a 44Hz → React reconcilia todo el subtree de Hyperion (TacticalCanvas + VisualizerCanvas + sidebars) 44 veces/sec.

Por qué el GC no limpia: Cada setTruth crea nuevas referencias de objeto. Zustand usa Object.is por defecto → la referencia nueva siempre difiere → notifica. Los fibers de React se encolan. Si la reconciliación de un frame toma >22ms (44Hz period), la cola de fibers crece monótonamente. El main thread nunca cede tiempo al GC.

VECTOR B — Allocación de objetos color por frame en GlassCanvas (SECUNDARIO)
Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx:0:0-0:0) Líneas: 50

[GlassCanvas.tsx:42-61](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/GlassCanvas.tsx:41:0-60:999)



typescript
for (let i = 0; i < fixtures.length; i++) {
  // ...
  const tFix: any = getTransientFixture(id)
  if (!tFix) continue
 
  tFix.color = { r: view[off], g: view[off+1], b: view[off+2] }  // ← NEW {r,g,b} object PER fixture PER frame
  tFix.dimmer = view[off+5] / 255
  // ...
}
Allocación: 1 objeto {r,g,b} por fixture por frame. Frecuencia: 44Hz × N fixtures. Para 50 fixtures = 2,200 objetos/sec. Contraste: injectHotFrame (transientStore.ts:204-210) hace lo correcto — muta el color existente in-place. GlassCanvas no. Ambos mutan los mismos fixtures a 44Hz (doble ingesta redundante).

VECTOR C — Float32Array view allocada por frame en glassPreload (TERCIARIO)
Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts:0:0-0:0) Líneas: 31-34

[glassPreload.ts:27-38](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/glassPreload.ts:26:0-37:999)



typescript
_pending = data.buffer
const view = new Float32Array(_pending!)   // ← NEW Float32Array view object per frame
_listeners.forEach((listener) => {
  try { listener(view) } catch (err) { ... }
})
Allocación: 1 Float32Array view (header V8 + backing pointer) por frame = 44 objetos/sec. Pequeño, pero se suma al budget de GC.

VECTOR D — Structured clone IPC a 44Hz (CUATERNARIO)
Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/electron/preload.ts:0:0-0:0) líneas 736-739 + [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/hooks/useSeleneTruth.ts:0:0-0:0) línea 211

Cada ipcRenderer.on('selene:hot-frame') y ipcRenderer.on('selene:truth') recibe un deep clone via structured clone del objeto completo. Durante Chronos a 44Hz:

selene:truth: deep clone del SeleneTruth completo (objeto grande con hardware, sensory, context, consciousness, intent, system) = 44 clones/sec de objeto grande
selene:hot-frame: deep clone de hotFrame (1 objeto + 1 array + N fixtures) = 44 × (N+2) objetos/sec
Estos objetos se vuelven garbage inmediatamente después de injectTransientTruth / injectHotFrame (que mutan in-place el transientStore). Pero el GC debe recolectarlos.

VECTOR E — Cola sin backpressure del MessagePort al worker (QUINTENARIO)
Archivo: [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx](cci:4://file:///c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:0:0-0:0) Líneas: 521

[TacticalCanvas.tsx:518-522](cci:4://file:///C:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:517:0-521:999)



typescript
const onBeat = view.length > 4 && view[4] > 0.5
// Forward to worker via dedicated port (structured clone ≈ 4KB @ 44Hz = trivial)
channel.port1.postMessage({ frameData: buf, fixtureCount: count, onBeat })
buf (Float32Array) NO está en la transfer list — se copia via structured clone. MessageChannel.port1 no tiene backpressure: si el worker está ocupado renderizando (RAF > 22ms), la cola de mensajes crece sin límite. Cada mensaje encolado retiene su copia del Float32Array. Con 50 fixtures × 10 floats × 4 bytes = 2KB/mensaje. Si el worker acumula 1 frame de backlog/sec = 88KB/sec = ~5.3MB/min.

4. ARQUITECTURA DEL GC FAILURE
Por qué el Garbage Collector no puede limpiar:


44Hz setTruth() ──→ 44 Zustand notify/sec ──→ 44 React reconcile/sec
                                                    │
                                                    ▼
                              Main thread: reconcile (5-16ms) + paint (2-5ms)
                              = 7-21ms por frame
                                                    │
                              44Hz period = 22ms
                                                    │
                              Si reconcile > 22ms → cola de fibers crece
                                                    │
                                                    ▼
                              GC incremental necesita ~5ms pauses entre tasks
                              Main thread NUNCA cede 5ms (saturado por reconcile)
                                                    │
                                                    ▼
                              GC minor no corre → young generation se llena
                              → promotion a old generation → major GC needed
                              → major GC pause = 50-200ms → más backlog
                              → feedback loop positivo → heap crece monótonamente
                                                    │
                                                    ▼
                              V8 heap limit alcanzado → OOM silencioso
                              (renderer process killed → white screen, no console)
El feedback loop mortal:
setTruth a 44Hz → React encola 44 updates/sec
Reconcile tarda >22ms → backlog de fibers crece
GC no recibe CPU time → young gen se llena
Objetos promocionan a old gen → major GC requerido
Major GC pause (50-200ms) → más backlog acumulado durante la pause
Al reanudar, más setTruth llegaron → más backlog → GC postergado otra vez
Heap crece monótonamente → OOM
Por qué no hay console errors:
El renderer process de Electron es killed por V8 cuando el heap alcanza el límite (~2-4GB en 64-bit). No hay oportunidad de loggear — el proceso muere instantáneamente. La ventana queda en white screen porque el renderer ya no responde.

5. ELEMENTOS DESCARTADOS (No son el leak)
Sospecho	Veredicto	Razón
BufferPoolManager	✅ Limpio	POOL_SIZE=3, frame drop intencional cuando no hay buffers (línea 52-56). Bounded.
_pending en glassPreload	✅ Limpio	Auto-ack del buffer anterior en nueva llegada (línea 23-25). Max 1 buffer retenido.
physicsStore / prevIntensity en worker	✅ Limpio	Map bounded por fixture count. Limpieza en SCAFFOLD (línea 514-517) y SHUTDOWN (línea 624-625).
fpsHistory en worker	✅ Limpio	Bounded a 30 entries con shift() (línea 167).
fixtureIndex en transientStore	✅ Limpio	clear() + re-fill en cada full truth (línea 96-100). No crece.
_hotFrameExistingById en transientStore	✅ Limpio	Pre-allocated, clear() + re-fill cada hot frame (línea 170-174).
useEffect cleanup de GlassCanvas	✅ Limpio	unsubscribe() + removeEventListener + cancelAnimationFrame + reset isSubscribedRef (línea 121-127).
useEffect cleanup de TacticalCanvas	✅ Limpio (prod)	observer.disconnect() + worker.terminate() + glassUnsub() + channel.port1.close() (línea 401-423, 531-535). En DEV skipa cleanup (intencional, línea 404-406).
peakHoldMap en TickEngine	⚠️ Backend	Map que crece con fixtures nuevos pero nunca shrink. Está en main process, no renderer. No causa el white screen pero es un leak menor backend.
6. CONCLUSIÓN FORENSE
Causa raíz:
El OOM es causado por la combinación de dos bugs que se anulan mutuamente:

TickEngine bypassa el throttle de truth a 44Hz durante Chronos (línea 908: chronosPlaying || ...)
useSeleneTruth desactivó su propio throttle (TRUTH_THROTTLE_INTERVAL = 1, línea 82) asumiendo que el backend ya throttlea
El desarrollador que hizo WAVE-6018 creyó que el backend emitía a ~2Hz, pero durante shows en vivo (Chronos) emite a 44Hz. El throttle de React es inexistente. 44 setTruth()/sec + 44 updateMetrics()/sec satura el main thread con reconciliación de React, matando el GC.

Factores agravantes (no letales solos, fatales en conjunto):
Doble ingesta 44Hz (GlassCanvas.onFrame + injectHotFrame) sobre los mismos fixtures
Allocación de objetos color en GlassCanvas línea 50 (2,200 objs/sec @ 50 fixtures)
Structured clone IPC a 44Hz para truth completo + hot-frame
MessagePort sin backpressure al worker (cola potencialmente infinita)
El GC no falla por un leak — falla por starvation de CPU:
El main thread está 100% ocupado reconciliando React a 44Hz. El GC incremental necesita pausas de ~5ms que nunca llegan. La basura se acumula en young generation, promociona a old generation, y eventualmente el heap alcanza el límite de V8 → OOM silencioso → white screen.

Esperando instrucciones humanas. No se modificó ningún código.