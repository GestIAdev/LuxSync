WAVE 7173 — Diagnósticos y Plan de Acción
Diagnóstico 1: GlassCanvas NO patchea fixtures a 44Hz (ROOT CAUSE)
Hallazgo crítico
El GlassCanvas lee IDs de fixtures del store equivocado.



@electron-app/src/components/GlassCanvas.tsx:41
const fixtures = useTruthStore.getState().truth?.hardware?.fixtures
Pero useSeleneTruth strippea los fixtures antes de escribir al truthStore:



@electron-app/src/hooks/useSeleneTruth.ts:145-152
const metadataTruth: typeof data = {
  ...data,
  hardware: {
    ...data.hardware,
    fixtures: [],   // transientStore owns live fixture physics
    dmxOutput: [],
  },
}
setTruth(metadataTruth)
Resultado: fixtures.length === 0 → el bloque de patcheo de fixtures se skipea completamente. Solo el audio (bass/mid/high/energy) se patchea a 44Hz.

Agravante: Hot Frame IPC suprimido


@electron-app/electron/main.ts:671-673
const glassActive = glassPoolManager.getMetrics().framesSent > 0
if (!glassActive) {
  mainWindow.webContents.send('selene:hot-frame', hotFrame)
}
Cuando el Glass Bridge está activo, el hot frame IPC (selene:hot-frame) no se envía. Esto es correcto por diseño — el Glass Bridge debería llevar los datos. Pero como el GlassCanvas no puede patchear fixtures, ninguna fuente de 44Hz llega a los fixtures del transientStore.

Cadena causal del 11Hz
Glass Bridge activo → main.ts suprime selene:hot-frame IPC
GlassCanvas.onFrame() se ejecuta a 44Hz → lee truthStore.fixtures → obtiene [] → skipea patch de fixtures
injectHotFrame() no se llama (IPC suprimido)
injectTransientTruth() se llama a 11Hz (TRUTH_BROADCAST_DIVIDER=4) → única fuente de datos de fixtures
El 3D lee getTransientFixture() a 60fps desde useFrame() → datos stale de hace ~90ms
Acción propuesta
Reemplazar la fuente de IDs en GlassCanvas: leer de getTransientTruth() o useStageStore.getState().fixtures en vez de truthStore.



typescript
// ANTES (roto):
const fixtures = useTruthStore.getState().truth?.hardware?.fixtures
 
// DESPUÉS (correcto):
const transient = getTransientTruth()
const fixtures = transient?.hardware?.fixtures
Esto usa el transientStore que SÍ tiene los fixtures completos (inyectados por injectTransientTruth() a 11Hz, con IDs estables). Los valores dinámicos (pan/tilt/dimmer/color) se sobrescriben a 44Hz desde el Glass Bridge.

Impacto: 1 archivo, ~3 líneas cambiadas. Restaura el pipeline de 44Hz para fixtures.

Diagnóstico 2: BroadcastManager y TitanOrchestrator son código muerto con divisores obsoletos
Hallazgo
BroadcastManager.ts está definido pero nunca se instancia en ningún lugar del códigobase:



@electron-app/src/core/orchestrator/tick/BroadcastManager.ts:46-48
export class BroadcastManager {
  static readonly HOT_FRAME_DIVIDER = 2       // 44Hz → 22Hz
  static readonly TRUTH_BROADCAST_DIVIDER = 6  // ~7Hz
TitanOrchestrator.ts tiene sus propios divisores que tampoco se usan:



@electron-app/src/core/orchestrator/TitanOrchestrator.ts:567
private static readonly TRUTH_BROADCAST_DIVIDER = 6
Búsqueda confirmó cero referencias a TitanOrchestrator.TRUTH_BROADCAST_DIVIDER o new BroadcastManager.

TickEngine es la única autoridad real:



@electron-app/src/core/orchestrator/tick/TickEngine.ts:36-37
private static readonly TRUTH_BROADCAST_DIVIDER = 4  // 11Hz
private static readonly HOT_FRAME_DIVIDER = 1        // 44Hz
Los comentarios stale en TickEngine líneas 920-927 dicen "22Hz" y "~7Hz" pero los divisores reales producen 44Hz y 11Hz.

Acción propuesta
Eliminar BroadcastManager.ts — es código muerto de un refactor incompleto (WAVE 4961)
Eliminar TRUTH_BROADCAST_DIVIDER y HOT_FRAME_DIVIDER de TitanOrchestrator — dead code
Corregir comentarios stale en TickEngine.ts:920-927 para reflejar 44Hz/11Hz reales
Impacto: Limpieza, 0 cambios funcionales. Previene confusión futura.

Diagnóstico 3: BeatTracker causa re-renders de React a 60fps
Hallazgo


@electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx:124-139
const BeatTracker: React.FC<{ onBeatIntensity: (intensity: number) => void }> = ({ onBeatIntensity }) => {
  const onBeat = useAudioStore(state => state.onBeat)
  const beatIntensityRef = useRef(0)
 
  useFrame((_, delta) => {
    if (onBeat) {
      beatIntensityRef.current = 1.0
    } else {
      beatIntensityRef.current *= Math.exp(-8 * delta)
    }
    onBeatIntensity(beatIntensityRef.current)  // ← setBeatIntensity → Scene re-render
  })
 
  return null
}
onBeatIntensity es setBeatIntensity (React useState setter del componente Scene). El useFrame corre a 60fps y el valor cambia cada frame por el decaimiento exponencial. Esto causa re-renders de React del componente Scene a 60fps, lo que incluye reconciliation de todos los children (fixtures, floor, truss, bloom).

Esto no es la causa del 11Hz de datos (el render loop WebGL corre a 60fps independientemente), pero añade overhead innecesario de React reconciliation que puede causar frame drops.

Acción propuesta
Mover beatIntensity a un ref compartido en vez de useState:



typescript
// En Scene:
const beatIntensityRef = useRef(0)
 
// BeatTracker muta el ref directamente:
useFrame((_, delta) => {
  if (onBeat) beatIntensityRef.current = 1.0
  else beatIntensityRef.current *= Math.exp(-8 * delta)
})
 
// Pasar beatIntensityRef a children que lo lean en su propio useFrame
Los componentes que consumen beatIntensity (NeonFloor, NeonBloom) ya tienen useFrame propio y pueden leer el ref sin causar re-renders.

Impacto: 1 archivo, ~20 líneas refactorizadas. Elimina ~60 re-renders/sec de React.

Diagnóstico 4: GlassCanvas usa Array.find() O(N²) en hot path
Hallazgo


@electron-app/src/components/GlassCanvas.tsx:51
let tFix: any = transientFixtures.find((f: any) => f.id === id)
Por cada fixture en el frame (44Hz), hace un Array.find() lineal. Con N fixtures: O(N²) por frame.

transientStore.injectHotFrame() ya tiene la solución correcta con un Map pre-asignado:



@electron-app/src/stores/transientStore.ts:170-174
const existingById = _hotFrameExistingById
existingById.clear()
for (const f of existingFixtures) {
  if (f?.id) existingById.set(f.id, f)
}
Acción propuesta
Usar getTransientFixture(id) que ya usa el fixtureIndex Map internamente:



typescript
// ANTES:
let tFix: any = transientFixtures.find((f: any) => f.id === id)
 
// DESPUÉS:
import { getTransientFixture } from '../stores/transientStore'
let tFix: any = getTransientFixture(id)
Nota: Este fix es moot si no se aplica también el Diagnóstico 1 (el bloque se skipea completamente cuando truthStore.fixtures === []). Ambos fixes deben aplicarse juntos.

Impacto: 1 archivo, 2 líneas. O(N²) → O(N) con N=12-100+.

Resumen de Plan de Acción
#	Diagnóstico	Severidad	Archivos	Líneas	Prioridad
1	GlassCanvas lee truthStore (vacío) en vez de transientStore	CRÍTICA	GlassCanvas.tsx	~3	P0
4	GlassCanvas usa Array.find() en vez de Map	Baja	GlassCanvas.tsx	~2	P2 (con P0)
3	BeatTracker causa 60fps React re-renders	Media	VisualizerCanvas.tsx	~20	P1
2	BroadcastManager + TitanOrchestrator dividers dead code	Baja	3 archivos	eliminar	P3
Orden recomendado: P0 (Diagnóstico 1 + 4 juntos) → P1 (Diagnóstico 3) → P2 (Diagnóstico 2 cleanup)

El Diagnóstico 1 es la causa raíz del 11Hz. Los demás son optimizaciones y limpieza. Sin el fix del P0, el Glass Bridge envía datos a 44Hz pero nadie los consume para fixtures.