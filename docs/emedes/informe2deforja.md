 INFORME DE RECONOCIMIENTO TOPOGRÁFICO v2.7
PARTE 1: AUDITORÍA DE CICATRIZ — Channel Rack
⚠️ ALERTA CRÍTICA: EL RACK NO FUE EXTIRPADO DEL ARCHIVO ORIGINAL
Situación: Se creó el archivo ForgeChannelRackTab.tsx, pero no se sustituyó la implementación original dentro de FixtureForgeEmbedded.tsx.

Evidencia: En FixtureForgeEmbedded.tsx, el switch de pestañas sigue conteniendo todo el bloque JSX nativo del Channel Rack:



Proyectos
{/* CHANNEL RACK TAB */}
{activeTab === 'channels' && (
  <div className="forge-channels-layout">
El bloque original sigue presente línea a línea desde 1351 hasta 1702. No hay <ForgeChannelRackTab ... /> en el JSX.

Consecuencia: El código del Channel Rack está duplicado lógicamente (nuevo componente vs. bloque original). Para completar la operación Strangler, falta:

Reemplazar el bloque activeTab === 'channels' por <ForgeChannelRackTab ... />.
Purgar las variables locales que dejarán de usarse en FixtureForgeEmbedded.tsx (previewPan, previewTilt, previewDimmer, previewColor, showPreview, dragOverSlot, expandedIgnitionIdx, etc.).
PARTE 2: RADIOGRAFÍA — Aether Cells / Multicell
1. Coordenadas de corte exactas
Elemento	Línea
Inicio del tab gate (comentario + JSX)	1838-1842
Fin del tab gate	1848
Bloque delegado	AetherModulesPanel invocado en 1843-1847
Definición de AetherModulesPanel	2150-2385
Subcomponente DraggableChannelChip	1897-2148
Subcomponente DroppableCellBox	1961-2140
Corte real a extraer: Aunque el tab gate es pequeño (1842-1848), la operación quirúrgica debe incluir todo el árbol de subcomponentes que lo soportan: AetherModulesPanel (2150-2385) + DraggableChannelChip (1897-2148) + DroppableCellBox (1961-2140) + utilidades DnD (FAMILY_COLORS, DragData, etc.) en 1874-1886.

2. Contrato de Props para ForgeAetherCellsTab
Implementación actual (delegación en AetherModulesPanel):


Proyectos
{activeTab === 'aether' && (
  <AetherModulesPanel
    forgeState={forgeState}
    forgeDispatch={forgeDispatch}
    channels={forgeState.channels}
  />
)}
Contrato mínimo recomendado para una vista pura:


typescript
interface ForgeAetherCellsTabProps {
  cells: IForgeCellBuilder[]
  channels: readonly FixtureChannel[]
  dispatch: React.Dispatch<ForgeAction>
}
Detalle de dependencias del JSX:
Variable / Prop	Origen	Uso
forgeState.cells	IForgeBuilderState	Iteración del grid de células, cálculo de canales asignados
forgeState.channels	IForgeBuilderState	Lista de canales (también se pasa como channels prop)
forgeDispatch	React.Dispatch<ForgeAction>	Todos los mutadores: CELL_CREATE, CELL_RENAME_LABEL, CELL_DELETE, CELL_SET_ZONE, CELL_ATTACH_CHANNEL, CELL_MOVE_CHANNEL, CELL_DETACH_CHANNEL
channels (prop)	readonly FixtureChannel[]	Render de chips, cálculo de unassigned, lookup de activeChannel
activeDrag	Local useState	Estado DnD del chip en vuelo
rejectShake, rejectMsg	Local useState	Feedback visual de rechazo de drop
sensors	dnd-kit	Configuración del sensor de mouse
3. Anidación de subcomponentes
Subcomponente	Líneas	Recomendación de extracción
AetherModulesPanel	2150-2385	Llevarlo al nuevo archivo tabs/ForgeAetherCellsTab.tsx
DraggableChannelChip	1897-2148	Llevarlo dentro del nuevo archivo (es DnD puro de la celda)
DroppableCellBox	1961-2140	Llevarlo dentro del nuevo archivo
DragData / FAMILY_COLORS	1874-1886	Llevarlos al nuevo archivo
Nota: Los tres subcomponentes son cohesivos y solo se usan en la pestaña Aether. No es necesario extraerlos a un archivo de utilidades compartido a menos que otras pestañas vayan a reutilizar el chip droppable.

4. Librerías/imports que el nuevo archivo necesitará
React: useState, useCallback
dnd-kit: DndContext, DragOverlay, useDraggable, useDroppable, MouseSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent
dnd-kit utilities: CSS
lucide-react: GripVertical, Plus, X as XIcon
Tipos: IForgeCellBuilder, ForgeAction (desde core/forge/forgeBuilderState), FixtureChannel, ChannelType (desde types/FixtureDefinition), NodeFamily (desde core/aether/types)
Lógica: canAdmit (desde core/forge/cellTypeAdmittance)
🎯 RECOMENDACIÓN TÁCTICA
Paso 1 (faltante): Extirpar el Channel Rack del padre y conectar ForgeChannelRackTab.
Paso 2: Crear tabs/ForgeAetherCellsTab.tsx con AetherModulesPanel + DraggableChannelChip + DroppableCellBox + utilidades.
Paso 3: Sustituir en FixtureForgeEmbedded.tsx las líneas 1842-1848 por <ForgeAetherCellsTab cells={forgeState.cells} channels={forgeState.channels} dispatch={forgeDispatch} />.
Paso 4: Limpiar imports huérfanos en el padre.