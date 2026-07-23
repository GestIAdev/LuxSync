Auditoría de Inspección — Fase 1: Select & Move
1. Sistema de Estado Global (Stores)
Selección — useSelectionStore
@/electron-app/src/stores/selectionStore.ts

Existe y está completo. El store tiene:

selectedIds: Set<string> — IDs de fixtures seleccionados
select(id, mode) — modos: replace, add, remove, toggle
selectMultiple(ids, mode) — para box/lasso
deselectAll(), deselect(id), toggleSelection(id)
setHovered(id) — hover tracking
selectRange(fromId, toId, allIds) — Shift+Click
Helpers: isSelected(id), hasSelection(), getSelectedArray()
Veredicto: No hay que crear nada. El store está listo para integrar con SymbolLayer.

Posición — useStageStore
@/electron-app/src/stores/stageStore.ts:728-733

Existe acción limpia:



ts
updateFixturePosition: (id, position: Position3D) => void
Internamente aplica clampToCrystalBox(position, stage) (snap + clamp a límites de sala) antes de persistir.

También existe placeFixture2D(fixtureId, x, z, orientation, rigId) — pipeline unificado 2D que hereda altura/orientación de rigs.

Veredicto: updateFixturePosition está listo. Sin embargo, hay un problema crítico de coordenadas: el store espera coordenadas 3D center-origin (0,0 = centro), pero DragDropController2D le pasa coordenadas SVG top-left-origin sin revertir el offset +stageWidth/2 / +stageDepth/2. Esto causará que los fixtures salten al soltarlos.

2. Ciclo de Eventos del Puntero en SVG
SymbolLayer — Sin eventos de puntero
@/electron-app/src/components/views/erebus/blueprint2d/layers/SymbolLayer.tsx

Los símbolos (<g>, <circle>, <rect>, <polygon>) no tienen ningún listener (onPointerDown, onPointerUp, onPointerEnter). Son puramente visuales. El FixtureLabel tiene pointerEvents="none" explícito.

DragDropController2D — Captura vía overlays invisibles
@/electron-app/src/components/views/erebus/blueprint2d/interaction/DragDropController2D.tsx:210-236

Renderiza círculos transparentes (r=0.2, fill="transparent", pointerEvents="all") sobre cada fixture para capturar onPointerDown. Este es el controlador activo de drag en 2D.

Problemas detectados:

Coordenadas sin offset: Los overlays usan cx={f.position.x} y cy={f.position.z} directamente (center-origin), pero el SVG está en top-left-origin. Los círculos interactivos no coinciden con los símbolos visuales de SymbolLayer (que sí tienen el offset aplicado en BlueprintCanvas).
strokeWidth={0.004} en el ring de selección — sub-pixel con non-scaling-stroke, invisible.
svgRef local: El controlador crea su propio svgRef (línea 70) en lugar de usar el svgRef del BlueprintCanvas raíz. Esto puede fallar si el SVG no es el elemento directo.
LassoSelection — Capa de captura de fondo
@/electron-app/src/components/views/erebus/blueprint2d/interaction/LassoSelection.tsx:145-154

Renderiza un <rect> transparente con pointerEvents="all" que cubre todo el escenario. Este rect podría interceptar clics antes de que lleguen a los círculos de DragDropController2D, dependiendo del z-order.

Veredicto: El sistema de eventos existe pero está desconectado de SymbolLayer y tiene un bug de coordenadas heredado del offset que introdujimos. Hay que:

Conectar onPointerDown/onPointerEnter/onPointerLeave directamente en los <g> de SymbolLayer
Aplicar el offset inverso al comunicarse con el store
Revisar el z-order de LassoSelection vs DragDropController2D
3. Conversión de Coordenadas (Screen → World Space)
Existe y está implementada en 3 lugares:
DragDropController2D (líneas 79-89):



ts
const screenToSVG = (clientX, clientY) => {
  const pt = svg.createSVGPoint()
  pt.x = clientX; pt.y = clientY
  const ctm = svg.getScreenCTM()
  const svgPt = pt.matrixTransform(ctm.inverse())
  return { x: svgPt.x, z: svgPt.y }
}
LassoSelection (líneas 50-60): Patrón idéntico.

MeasureLayer2D (líneas 102-114): Patrón idéntico.

Veredicto: La matemática getScreenCTM().inverse() está correcta y probada. Sin embargo:

Está duplicada 3 veces. Debería extraerse a un hook/utilidad compartida.
El svgRef de DragDropController2D es local y puede no resolver el SVG correcto. Debería recibir el svgRef del BlueprintCanvas como prop (como ya hace LassoSelection).
El resultado está en coordenadas SVG (top-left), pero el store espera coordenadas 3D (center-origin). Falta restar stageWidth/2 y stageDepth/2 antes de pasar a placeFixture2D / updateFixturePosition.
4. Subsistema de Snap
SnapStore — useSnapStore
@/electron-app/src/stores/snapStore.ts

Completo y global:

snapEnabled: boolean (default: true)
snapSize: SnapSize — 0.1 | 0.25 | 0.5 | 1.0 (default: 0.25)
snap(value: number) => number — redondea al múltiplo de snapSize si está activado
toggleSnap(), setSnapSize(size)
CommandStrip (HUD)
@/electron-app/src/components/views/erebus/hud/CommandStrip.tsx:84-126

Botón Snap con popover: toggle on/off + selector de tamaño de grid (0.1m, 0.25m, 0.5m, 1.0m).

Consumidores actuales:
DragDropController2D — usa snap() en handlePointerDown y handleMove
DragDropController3D — usa snap() en drag y en handleUp
RigSystem — usa snap() al colocar rigs
Veredicto: El snap está listo. Solo hay que asegurar que SymbolLayer (o el nuevo controlador de drag) consuma useSnapStore(s => s.snap) durante el arrastre.

Plan de Ataque


PASO 1: Extraer utilidad screenToSVG compartida
  - Crear hook useScreenToSVG(svgRef) o función pura
  - Eliminar duplicación en DragDropController2D, LassoSelection, MeasureLayer2D
  - DragDropController2D debe recibir svgRef de BlueprintCanvas como prop
 
PASO 2: Fix de coordenadas en DragDropController2D
  - Los overlays de captura deben usar x+stageWidth/2, z+stageDepth/2
    (igual que SymbolLayer)
  - Al soltar (handleUp), restar stageWidth/2 y stageDepth/2 antes
    de llamar placeFixture2D / updateFixturePosition
  - Migrar strokeWidth del ring de selección a 1.5px (non-scaling-stroke)
 
PASO 3: Conectar eventos en SymbolLayer
  - Añadir onPointerDown, onPointerEnter, onPointerLeave en los <g>
    de cada símbolo
  - Delegar a callbacks pasadas como props desde BlueprintCanvas
  - SymbolLayer necesita props: onFixturePointerDown, onFixtureHover, etc.
  - O alternativamente: mover los overlays invisibles de DragDropController2D
    a dentro de SymbolLayer (mejor z-order, menos capas)
 
PASO 4: Feedback visual de selección en SymbolLayer
  - Leer useSelectionStore(s => s.selectedIds) en SymbolLayer
  - Renderizar ring de selección (stroke --obs-accent) en los símbolos
    seleccionados
  - Renderizar hover state (stroke tenue) en el fixture hovered
 
PASO 5: Revisar z-order de capas de interacción
  - LassoSelection capture rect debe estar DEBAJO de los símbolos
  - DragDropController2D overlays deben estar ENCIMA de los símbolos
    (o integrados en ellos)
  - BlueprintCanvas onClick (deselectAll) no debe interferir con
    clics en fixtures (e.target === e.currentTarget check ya existe)
 
PASO 6: Probar flujo completo Select + Move
  - Click en fixture → selecciona
  - Ctrl+Click → toggle selección
  - Shift+Click → añadir a selección
  - Move mode + drag → arrastra con snap
  - Lasso en espacio vacío → selección rectangular
  - Click en vacío → deselectAll
Prioridad: El Paso 2 (fix de coordenadas) es crítico — sin él, cualquier drag mueve los fixtures a posiciones erróneas. Los pasos 3-4 son la integración visual. El paso 1 es refactor de limpieza.