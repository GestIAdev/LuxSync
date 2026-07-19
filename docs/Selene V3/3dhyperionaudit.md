WAVE 7173 — Auditoría: Pipeline de Renderizado y Aether Glass
1. El Trasvase Aether Glass (Ping Pong)
Arquitectura
El sistema tiene dos pilares paralelos de transferencia de datos:

Pilar 1: Hardware DMX vía SAB — DMX_UNIVERSE_SAB (SharedArrayBuffer, 25KB) con seqlock atómico. Phantom Worker lee a 44Hz y escribe al SerialPort. Zero IPC.

Pilar 2: UI vía ArrayBuffer Transferible (Ping Pong) — BufferPoolManager:



@electron-app/src/core/aether/glass/BufferPoolManager.ts:1-85
Pool de 3 ArrayBuffer pre-asignados al boot (POOL_SIZE = 3, FIX_DATA_BYTES = 131072 ≈ 128KB cada uno)
Cada tick (44Hz): pushFrame(sabView) hace pool.pop() → new Float32Array(buffer).set(sabView) (memcpy ~5µs) → port.postMessage({ type: 'glass-state', buffer }) con transferencia zero-copy
El Renderer recibe el buffer en window.glass.onFrame(), lo consume, y devuelve con window.glass.ackFrame()
BufferPoolManager.recycle() devuelve el buffer al pool
Veredicto: No hay GC excesivo ni reasignación
Zero allocation en hot-path: Los 3 buffers se crean una sola vez en el constructor. pushFrame() solo hace un pop() del pool y un set() memcpy.
Backpressure mitigation: Si el Renderer no devuelve buffers (pool.pop() retorna undefined), el frame se descarta intencionalmente (framesDropped++). Esto es correcto — evita acumulación de latencia.
Riesgo potencial: Si ackFrame() no se llama a tiempo, los 3 buffers se agotan y TODOS los frames se dropean. El contrato sagrado está documentado en [c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/glass/README.md:22-33](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/aether/glass/README.md:21:0-32:999).
Punto de atención: GlassCanvas.tsx


@electron-app/src/components/GlassCanvas.tsx:80-124
El ackFrame() se llama dentro del requestAnimationFrame del GlassCanvas — NO dentro del callback onFrame. Esto significa:

onFrame callback: recibe buffer → escribe a transientStore → guarda referencia en latestView.current
rAF loop (60fps): lee latestView.current → dibuja a canvas 2D → llama ackFrame()
El buffer se retiene hasta el siguiente rAF tick. A 44Hz de envío y 60fps de rAF, el turnaround es ~16ms. Con 3 buffers en pool, esto debería ser suficiente. Pero si el rAF se bloquea (post-procesado pesado, GC pause, etc.), los 3 buffers se agotan en ~68ms y comienza el frame drop.

Escritura a transientStore desde GlassCanvas


@electron-app/src/components/GlassCanvas.tsx:39-68
El GlassCanvas es el puente entre el Glass Bridge y el transientStore. En cada onFrame:

Escribe audio (bass/mid/high/energy) a transient.sensory.audio
Itera fixtures y hace patch in-place: tFix.color, tFix.dimmer, tFix.physicalPan, tFix.physicalTilt, tFix.zoom, etc.
Problema menor: Usa transientFixtures.find() (O(N) por fixture) en vez del fixtureIndex Map que usa transientStore. Con 12 fixtures esto es trivial, pero con 100+ fixtures sería un cuello.

2. Acoplamiento de Frecuencia (El Sospechoso de los 11Hz)
Topología de datos del 3D
El canvas 3D (React Three Fiber) lee datos por dos caminos paralelos:

Camino A — React/props (estructural, ~11Hz):



useFixture3DData() → useStageStore() + useSelectionStore() + useOverrideStore()
[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts:117-220](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/useFixture3DData.ts:116:0-219:999)
Se ejecuta en useMemo — solo recálcula cuando cambian fixtures/zones/selección
NO se suscribe a truthStore para datos dinámicos (WAVE 2236 desacopló esto)
Camino B — transientStore (dinámico, 44Hz):



useFrame() → getTransientFixture(id) → lee pan/tilt/dimmer/color
[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx:203-351](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx:202:0-350:999)
[c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionPar3D.tsx:90-150](cci:4://file://c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionPar3D.tsx:89:0-149:999)
Lectura directa via getTransientFixture() — O(1) Map lookup, zero React cost
El transientStore se alimenta de 3 fuentes:
Fuente	Frecuencia	Método	Activa cuando
Full Truth IPC	~11Hz (TRUTH_BROADCAST_DIVIDER=4)	injectTransientTruth()	Siempre
Hot Frame IPC	44Hz (HOT_FRAME_DIVIDER=1)	injectHotFrame()	window.lux.onHotFrame existe
Glass Bridge	44Hz (pushFrame())	GlassCanvas.onFrame() → mutación directa	window.glass disponible


@electron-app/src/core/orchestrator/tick/TickEngine.ts:36-37


typescript
private static readonly TRUTH_BROADCAST_DIVIDER = 4  // 44/4 = 11Hz
private static readonly HOT_FRAME_DIVIDER = 1        // 44/1 = 44Hz
Veredicto: El 3D NO está suscrito a un store de 11Hz para datos dinámicos
El 3D lee pan/tilt/dimmer/color desde transientStore via getTransientFixture() dentro de useFrame(), que corre a 60fps (rAF del browser). El transientStore se actualiza a 44Hz via Hot Frame IPC y/o Glass Bridge.

PERO hay un acoplamiento secundario que SÍ opera a 11Hz:



@electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx:124-139


typescript
const BeatTracker: React.FC = () => {
  const onBeat = useAudioStore(state => state.onBeat)  // ← se actualiza a ~11Hz
  useFrame((_, delta) => {
    // ...
    onBeatIntensity(beatIntensityRef.current)  // ← setBeatIntensity → Scene re-render
  })
}
El BeatTracker usa useState para beatIntensity, que se pasa como prop a NeonBloom y NeonFloor. Esto causa que el componente Scene se re-renderice a ~11Hz (la frecuencia de useAudioStore).

Impacto: Los re-renders de React a 11Hz no bloquean useFrame() directamente, pero añaden overhead de reconciliation. Con muchos fixtures, esto puede causar frame drops en el rAF loop.

Discrepancia entre BroadcastManager y TickEngine


@electron-app/src/core/orchestrator/tick/BroadcastManager.ts:47-48


typescript
static readonly HOT_FRAME_DIVIDER = 2       // 44Hz → 22Hz
static readonly TRUTH_BROADCAST_DIVIDER = 6  // ~7Hz
vs TickEngine:



typescript
static readonly TRUTH_BROADCAST_DIVIDER = 4  // 11Hz
static readonly HOT_FRAME_DIVIDER = 1        // 44Hz
BroadcastManager tiene divisores obsoletos (22Hz/7Hz) que no coinciden con TickEngine (44Hz/11Hz). Si BroadcastManager.emitHotFrame() se usa en algún code path en lugar del inline del TickEngine, el hot frame caería a 22Hz.

3. Rendimiento del Render Loop 3D
Arquitectura del render loop
El 3D usa React Three Fiber (R3F) que gestiona su propio requestAnimationFrame:



@electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx:461-489


tsx
<Canvas
  frameloop={shouldRender ? 'always' : 'never'}
  dpr={[1, qualitySettings.maxDPR]}
  gl={{
    antialias: quality === 'HQ',
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace,
  }}
>
frameloop='always' → R3F rAF a 60fps (cuando visible)
frameloop='never' → R3F se congela cuando el tab no es visible (hibernation)
DPR máximo: 1.5 (HQ) / 1.0 (LQ)
Inyección de datos en matrices/shaders
Pan/Tilt → Quaternion rotation:



@electron-app/src/components/hyperion/views/visualizer/fixtures/HyperionMovingHead3D.tsx:287-311
Lee physicalPan / physicalTilt de transientStore (0-1 normalizado)
Exponential smoothing: smoothPan += (livePan - smoothPan) * VISUAL_SMOOTH
Mapeo a rango mecánico: panAngle = -(smoothPan - 0.5) * mechanicalPanRangeRad
Quaternion: yokeQuat.setFromAxisAngle(PAN_AXIS, panAngle) → yokeRef.quaternion.copy(yokeQuat)
Tilt con inversión para ceiling: visualTilt = isCeilingVisual ? (1 - smoothTilt) : smoothTilt
Color + Intensity → MeshBasicMaterial:



@HyperionMovingHead3D.tsx:319-336
lensMaterialRef.color.copy(liveColor) + multiplyScalar(1.0 + liveIntensity * 2.0) → HDR para Bloom
beamMaterialRef.color.copy(liveColor) + multiplyScalar(1.0 + liveIntensity * 1.5)
beamMaterialRef.opacity = liveIntensity * 0.4
Zoom → Beam cone scale:



@HyperionMovingHead3D.tsx:346-350
beamMeshRef.scale.x = BEAM_RADIUS_MIN + smoothZoom * (BEAM_RADIUS_MAX - BEAM_RADIUS_MIN)
Post-procesado (Neon Bloom)


@electron-app/src/components/hyperion/views/visualizer/postprocessing/NeonBloom.tsx:65-83


tsx
<EffectComposer multisampling={0}>
  <Bloom intensity={adjustedIntensity} luminanceThreshold={0.9} mipmapBlur levels={5} />
  <Vignette offset={0.3} darkness={0.4} />
</EffectComposer>
multisampling={0} — zero cost MSAA bypass
mipmapBlur + levels=5 — 5 passes de blur mipmapped (GPU cost moderado)
luminanceThreshold=0.9 — solo brilla lo muy brillante (fixtures encendidos con HDR)
Solo activo en HQ — en LQ, NeonBloom no se monta → cero GPU cost
Veredicto: El cuello de botella NO es el post-procesado
El EffectComposer con Bloom + Vignette es un pase GPU estándar. A 60fps con <100 fixtures, el coste GPU del bloom es ~1-2ms. No bloquea el hilo de render.

El cuello de botella es de ingestión de datos, no de render:

Si el Hot Frame IPC no está conectado (window.lux.onHotFrame no existe), el transientStore solo se actualiza a 11Hz via Full Truth. El 3D lee datos stale 5 de cada 6 frames.
Si el Glass Bridge no levanta (window.glass no disponible), se pierde la fuente de 44Hz más directa. Queda solo el Hot Frame IPC.
Los re-renders de React a 11Hz (BeatTracker → Scene → todos los children) añaden overhead de reconciliation que puede causar frame drops.
Resumen de hallazgos críticos
#	Hallazgo	Severidad	Archivo
1	BufferPoolManager es zero-alloc correcto, pero depende de ackFrame() oportuno	Bajo	BufferPoolManager.ts
2	GlassCanvas usa Array.find() en vez de fixtureIndex Map para patch transient	Bajo	GlassCanvas.tsx:51
3	BeatTracker causa re-renders de Scene a 11Hz via useState + useAudioStore	Medio	VisualizerCanvas.tsx:124-139
4	Discrepancia HOT_FRAME_DIVIDER: TickEngine=1 (44Hz) vs BroadcastManager=2 (22Hz)	Medio	BroadcastManager.ts:47
5	TRUTH_BROADCAST_DIVIDER: TickEngine=4 (11Hz) vs TitanOrchestrator=6 (7Hz) vs BroadcastManager=6 (7Hz)	Bajo	TickEngine.ts:36
6	3D lee transientStore a 60fps via getTransientFixture() — correcto, no acoplado a 11Hz	OK	HyperionMovingHead3D.tsx:216
7	Post-procesado Bloom no bloquea hilo — multisampling=0, solo HQ	OK	NeonBloom.tsx:66
8	Hibernation correcta: frameloop='never' cuando tab no visible	OK	VisualizerCanvas.tsx:464
Recomendación para diagnosticar el 11Hz real
Para confirmar si el problema es starvation de datos o re-render overhead:

Verificar Hot Frame IPC: Comprobar en runtime si window.lux?.onHotFrame existe y dispara. Si no existe, el 3D vive a 11Hz.
Verificar Glass Bridge: Comprobar BufferPoolManager.getMetrics() — si framesDropped > 0 y poolFree === 0, el pool se agota.
Profiling React: Usar React DevTools profiler para confirmar si Scene se re-renderiza a 11Hz por BeatTracker.
Eliminar discrepancy: Unificar HOT_FRAME_DIVIDER y TRUTH_BROADCAST_DIVIDER entre TickEngine, TitanOrchestrator y BroadcastManager.