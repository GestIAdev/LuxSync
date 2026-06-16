REPORTE FORENSE: FUGA DE ESTADO EN STAGE CONSTRUCTOR 2D
1. La Falsa Hoja en Blanco (NEW SHOW)
El newShow SÍ ejecuta la limpieza, pero es inmediatamente deshecho por un broadcast asíncrono del backend.

@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\stageStore.ts:466-482



typescript
newShow: (name) => {
  const show = createEmptyShowFile(name)
  set({
    showFile: show,
    showFilePath: null,   // ← clave: path = null
    isDirty: true,
    fixtures: [],         // ← explícitamente vacío
    groups: [],
    scenes: [],
    stage: null,
    visuals: null,
  })
  get()._syncDerivedState()
}
El store se purga correctamente. El problema NO está en newShow. El problema es que selene:truth (el broadcast del backend a ~11 Hz) sigue llegando con fixtures del show anterior, y useSeleneTruth los inyecta de vuelta.

2. Hidratación Zombie (onMount / Persistencia)
No hay persistencia Zustand (persist middleware) en stageStore. La fuente de la hidratación zombie es el canal IPC selene:truth.

@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hooks\useSeleneTruth.ts:133-141



typescript
// 🛡️ WAVE 6018: Sincronización de Censo (Defensa contra shows fantasma)
const stageStoreState = useStageStore.getState()
const stageFixtures = stageStoreState.fixtures || []
const truthFixtures = data.hardware?.fixtures || []
 
// Si la cantidad de focos no coincide, forzamos re-hidratación inmediata
if (stageFixtures.length !== truthFixtures.length) {
  stageStoreState.syncFixturesFromTruth(truthFixtures)
}
Diagnóstico: Esta "defensa" es el agresor. Cuando el usuario crea un show nuevo:

newShow() → fixtures: [], showFilePath: null
El backend (titanOrchestrator) aún tiene los fixtures del show anterior en patchedFixtures (o fixtures de test cargados en arranque)
Llega selene:truth con data.hardware.fixtures.length > 0
stageFixtures.length (0) !== truthFixtures.length (N) → dispara syncFixturesFromTruth
stageStore.ts:759-772 sobreescribe showFile.fixtures con los datos del backend:


typescript
syncFixturesFromTruth: (truthFixtures) => {
  const { showFile } = get()
  if (showFile) {            // ← pasa porque newShow acaba de crear showFile
    showFile.fixtures = truthFixtures.map(f => ({ ...f, ... }))
    set({ fixtures: [...showFile.fixtures] })
    get()._syncDerivedState()
  }
}
Los fixtures fantasma son los que el backend nunca limpió. Además, selectionStore conserva los selectedIds del show anterior (nunca se limpian en newShow), lo que explica por qué "las asignaciones de zona fallan": el constructor intenta operar sobre IDs seleccionados que ya no existen (o que reaparecieron fantasmas con zonas inconsistentes).

3. Fix Recomendado (El Exorcismo)
Tres cortes quirúrgicos:

A) Blindar useSeleneTruth.ts — no hidratar desde backend cuando el show es nuevo (sin path)
El frontend es la fuente de verdad para shows sin guardar. Solo sincronizar si hay un show cargado desde disco.

@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hooks\useSeleneTruth.ts:138-141



typescript
// 🔥 WAVE-V4 FIX: El backend NO es fuente de verdad para shows nuevos sin guardar.
// Si showFilePath === null, el usuario está editando un show fresco; ignorar census del backend.
if (stageStoreState.showFilePath && stageFixtures.length !== truthFixtures.length) {
  stageStoreState.syncFixturesFromTruth(truthFixtures)
}
B) Purgar selectionStore en newShow — evitar IDs zombies
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\stores\stageStore.ts:466-482



typescript
import { useSelectionStore } from './selectionStore'
 
newShow: (name) => {
  const show = createEmptyShowFile(name)
  set({
    showFile: show,
    showFilePath: null,
    isDirty: true,
    isLoading: false,
    lastError: null,
    fixtures: [],
    groups: [],
    scenes: [],
    stage: null,
    visuals: null,
  })
  get()._syncDerivedState()
  // 🔥 WAVE-V4 FIX: Limpiar selección para que no queden IDs zombies del show anterior
  useSelectionStore.getState().deselectAll()
}
C) (Opcional pero recomendado) Delay en StageConstructorView para estabilizar
@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\StageConstructorView.tsx:636-645



typescript
const StageConstructorView: React.FC = () => {
  const showFile = useStageStore(state => state.showFile)
  const newShow = useStageStore(state => state.newShow)
  
  useEffect(() => {
    if (!showFile) {
      // 🔥 WAVE-V4 FIX: Dar tiempo a que selene:truth se estabilice antes de crear
      const timer = setTimeout(() => {
        // Re-verificar: si entre tanto llegó un show por IPC, no pisarlo
        if (!useStageStore.getState().showFile) {
          newShow('Untitled Stage')
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [showFile, newShow])
Resumen ejecutivo: El newShow limpia el estado, pero useSeleneTruth (línea 139) lo deshace al recibir fixtures del backend. La "defensa contra shows fantasma" (WAVE 6018) es precisamente el origen del fantasma cuando el show es nuevo. El fix A es suficiente para cerrar el bug; B y C son blindaje adicional.