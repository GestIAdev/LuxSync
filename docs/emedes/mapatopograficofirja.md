Mapa Topográfico — FixtureForgeEmbedded.tsx (2388 líneas)
Archivo: @/components/views/ForgeView/FixtureForgeEmbedded.tsx

Mapa de Pestañas
Elemento	Línea	Nota
type ForgeTabId definición	133-134	'library' | 'general' | 'nodegraph' | 'channels' | 'wheelsmith' | 'physics' | 'export' | 'dmx-layout' | 'aether'
TAB_CONFIG array	150-162	Define icono + label por tab
activeTab state	579	useState<<ForgeTabId>('library')
handleTabClick	679-690	Dispatcher + sincronía con forgeEditMode
<nav className="forge-tabs"> render	1117-1136	Itera TAB_CONFIG; inyecta <ForgeModeSwitcher> condicionalmente
Switch de contenido (todas las tabs)	1141-1849	Bloque forge-main-content con activeTab === '...' && (...)
Despiece del Channel Rack
Sección	Líneas	Contenido
Tab gate	1352-1702	{activeTab === 'channels' && (...)}
Function Palette (left)	1355-1384	Drag source con FUNCTION_PALETTE, chips arrastrables
Channel Rack center	1387-1669	Tabla con headers: Channel / Function / MIN / Default / Clear. Incluye inputs de nombre, default value, ignition deps panel (desplegable)
Preview 3D (right)	1673-1688	<FixturePreview3D> (lazy)
Read-only overlay	1691-1700	<SimpleModeLockBanner> cuando el grafo no es compatible con simple mode
Despiece de Aether Cells
Sección	Líneas	Contenido
Tab gate	1842-1848	{activeTab === 'aether' && <AetherModulesPanel ... />}
Definición del componente	2150-2385	AetherModulesPanel — panel completo de DnD
Subcomponente DraggableChannelChip	1897-2148	Chip arrastrable (usa useDraggable de dnd-kit)
Subcomponente DroppableCellBox	1961-2140	Caja de celda droppable (usa useDroppable de dnd-kit)
Despiece del Graph Node
Sección	Líneas	Contenido
Subcomponente NodeGraphTab	490-536	Aislado para evitar contaminación de hooks de useForgeGraphStore
Tab gate	1704-1707	{activeTab === 'nodegraph' && <NodeGraphTab />}
Canvas layout	524-528	<ForgeCanvasLayout palette={<NodePalette />} canvas={<NodeCanvas />} inspector={<NodeInspector />} />
Pack modal	531-533	<PackIngenioModal> condicional
Dependencias de UI
Origen	Elementos usados
React	React, useState, useCallback, useEffect, useReducer, useRef, DragEvent, Suspense
@dnd-kit/core	DndContext, DragOverlay, useDraggable, useDroppable, MouseSensor, useSensor, useSensors
@dnd-kit/utilities	CSS
lucide-react	GripVertical, Server, Factory, Save, Download, Share2, Upload, Eye, EyeOff, Sliders, Cpu, Cog, Settings, Settings2, ChevronDown, ChevronUp, Trash2, Copy, AlertTriangle, Check, Palette, BookOpen, Lock, Zap, Plus, X (como XIcon), Sun, Aperture, ArrowLeftRight, ArrowUpDown, Star, Triangle, Crosshair, ZoomIn, Timer, RotateCw, RotateCcw, Snowflake, Droplet, Code2
LuxSync — shared/	FixturePreview3D, PhysicsTuner, UniversalAssetBrowser
LuxSync — ForgeView/	WheelSmithEmbedded, ForgeCanvasLayout (lazy), NodePalette (lazy), NodeCanvas (lazy), NodeInspector, ForgeModeSwitcher, SimpleModeLockBanner, PackIngenioModal
zustand	useShallow + stores (stageStore, libraryStore, navigationStore, forgeGraphStore)


