🚨 DIAGNÓSTICO ARQUITECTÓNICO — WAVE 4735.7
Multicell vs Legacy: ID Mismatch + Footprint Corruption
INVESTIGACIÓN 1: NodeExtractionPipeline — ¿Por qué el backend ignora nodeGraph?
Hallazgo CRÍTICO
El pipeline SÍ tiene bifurcación Forge-aware (_buildNodesFromForgeGraph vs _buildAllNodes), pero nunca la toma para fixtures reales.

Flujo real de datos (con fuentes de línea):

Paso	Archivo	Líneas	Qué hace
1	FixtureForgeEmbedded.tsx:985	builtFixture.nodeGraph = compileResult.fixture.nodeGraph	La Forja guarda nodeGraph en el perfil
2	libraryStore.ts:109	nodeGraph: hasIncomingNodeGraph ? hydrateNodeGraphFromJson(...) : ...	El store lo conserva al cargar
3	main.ts:277	setRuntimeFixtureLibrary(mergedLibrary)	El backend recibe el perfil con nodeGraph
4	TitanOrchestrator.ts:2875	const runtimeDefinition = resolveRuntimeFixtureDefinition([...])	Resuelve el perfil desde la librería en memoria
5	TitanOrchestrator.ts:2906	_normalizeFixtureDefinitionForAether(definition, fixture, profileId)	Aquí se pierde el nodeGraph
6	TitanOrchestrator.ts:2947	return { ...definition, channels: finalChannels, physics, capabilities, wheels }	El objeto retornado NO incluye nodeGraph
7	NodeExtractionPipeline.ts:384	const fixtureGraph = (fixtureDef as ...).nodeGraph	fixtureGraph es undefined
8	NodeExtractionPipeline.ts:387	fixtureGraph ? _buildNodesFromForgeGraph(...) : _buildAllNodes(...)	Siempre toma _buildAllNodes (heurística legacy)
Confirmación textual
Proyectos
return {
  ...definition,
  id: profileId ?? definition.id ?? fixture.id,
  name: definition.name ?? fixture.name ?? profileId ?? fixture.id ?? 'Unknown Fixture',
  manufacturer: definition.manufacturer ?? fixture.manufacturer ?? 'Unknown',
  type: this._normalizeFixtureType(definition.type ?? fixture.type),
  channels: finalChannels,
  physics: definition.physics ?? fixture.physics,
  capabilities: definition.capabilities ?? fixture.capabilities,
  wheels: definition.wheels ?? fixture.wheels,
}
nodeGraph no está en la lista de campos propagados. Aunque ...definition lo esparza, el tipo retornado es FixtureDefinition (que no declara nodeGraph), y el consumidor (extract) hace un cast a FixtureDefinition & { nodeGraph?: ... }. El campo puede desaparecer por el tipo o por una clonación interna.

Además, _syncFixturesToAether pasa fixture.forgeGraph a registerAetherDevice (línea 2843), pero ese forgeGraph nunca llega al pipeline:

Proyectos
const deviceDef = pipeline.extract(definition, fixtureV2)
definition viene de _resolveFixtureDefinitionForAether → sin nodeGraph.

Consecuencia del Síntoma 1
Un Tungsten con nodeGraph que declara:

fixture-123:golden-master
fixture-123:petal-l
fixture-123:wash-color
Es reducido por _buildAllNodes (heurística) a:

fixture-123:color
fixture-123:impact
fixture-123:kinetic
El frontend envía overrides a fixture-123:wash-color → no existe en el backend → los overrides se pierden en el vacío.

INVESTIGACIÓN 2: Corrupción de Footprint — Índices duplicados y hardware mezclado
Hallazgo CRÍTICO
La Forja serializa dmxOffset como 0-based (diseño correcto de Forge/Aether):

Proyectos
private _mapForgeNodes(configs: readonly IOutputDmxConfig[]): INodeChannelDef[] {
  return configs.map(cfg => ({
    ...
    dmxOffset: cfg.dmxOffset,  // ← usa DIRECTAMENTE, 0-based
Pero _normalizeFixtureDefinitionForAether traduce los canales con _normalizeFixtureChannelIndex, que asume 1-based:

Proyectos
private _normalizeFixtureChannelIndex(rawIndex: unknown, fallback: number): number {
  if (typeof rawIndex === 'number' && Number.isFinite(rawIndex)) {
    return rawIndex > 0 ? Math.trunc(rawIndex) : fallback
Reproducción matemática del duplicado
Fixture de 6 canales guardado por la Forja (0-based):

channels[0].index = 0   (dmxOffset 0)
channels[1].index = 1   (dmxOffset 1)
channels[2].index = 2
...
Después de _normalizeFixtureChannelIndex (fallback = idx+1):

channels[0].index = 0 → 0 > 0 ? NO → fallback = 1
channels[1].index = 1 → 1 > 0 ? SÍ → 1
channels[2].index = 2 → 2
Resultado: [1, 1, 2, 3, 4, 5, 6] → índice 1 aparece DOS veces.

Consecuencia del Síntoma 2
TitanOrchestrator detecta duplicados y ejecuta:

Proyectos
const finalChannels = hasDuplicateIndices
  ? channels.map((ch, i) => ({ ...ch, index: i + 1 }))
  : channels
Reasigna posicionalmente 1, 2, 3, 4, 5, 6, 7. Los canales que DEBÍAN estar en offsets 0..5 ahora están en 1..6. El footprint DMX del fixture se desplaza +1 completo.

Consecuencia del Síntoma 3
Cuando L0 (Selene/Liquid) envía señal, el NodeResolver escribe los valores DMX usando los dmxOffset de los nodos. Si los nodos fueron construidos con offsets reasignados (1..6 en lugar de 0..5):

El canal red del pétalo 1 va al offset 1 en lugar del 0
El canal dimmer del pétalo 1 va al offset 2 en lugar del 1
Los canales de pétalos diferentes colisionan o se desplazan
En el hardware, esto se ve como "canales mezclados aleatoriamente" porque las señales L0 están llegando a los offsets DMX equivocados.

VEREDICTO: CAUSAS RAÍZ
Síntoma	Causa raíz	Línea culpable
ID Mismatch	_normalizeFixtureDefinitionForAether descarta nodeGraph; el pipeline nunca entra en _buildNodesFromForgeGraph	TitanOrchestrator.ts:2947
Índices duplicados	_normalizeFixtureChannelIndex considera 0 inválido; canales 0-based del nodeGraph colisionan con canales 1-based	TitanOrchestrator.ts:3002
Hardware mezclado	Consecuencia de ambas: heurística wrong-node + offsets desplazados + posible eliminación por _sanitizeOverlappingChannels	cascada
📋 PROPUESTA DE ARQUITECTURA (esperando aprobación)
Objetivo
V1 (Classic, sin nodeGraph): Funciona exactamente como hoy (heurística 1-based intacta).
V2 (Aether/Forja, CON nodeGraph): Bypasse completamente la heurística y la normalización de canales. Usa _buildNodesFromForgeGraph con offsets 0-based tal cual.
Cambio 1: Propagar nodeGraph al pipeline
En TitanOrchestrator._normalizeFixtureDefinitionForAether:

typescript
// AÑADIR:
nodeGraph: (definition as any).nodeGraph ?? (fixture as any).nodeGraph ?? (fixture as any).forgeGraph,
En TitanOrchestrator._syncFixturesToAether:

typescript
// Asegurar que definition lleve el nodeGraph antes de llamar extract
if ((fixture as any).forgeGraph && !(definition as any).nodeGraph) {
  (definition as any).nodeGraph = (fixture as any).forgeGraph
}
Cambio 2: Bypass de normalización para V2
En _normalizeFixtureDefinitionForAether, detectar V2 y saltar la normalización de canales:

typescript
const hasNodeGraph = !!(definition as any).nodeGraph || !!(fixture as any).forgeGraph
 
if (hasNodeGraph) {
  // V2: los canales vienen del nodeGraph, ya son correctos (0-based).
  // NO normalizar índices, NO sanitizar.
  return {
    ...definition,
    id: ...,
    channels: definition.channels, // tal cual, confiamos en el nodeGraph
    nodeGraph: (definition as any).nodeGraph,
  }
}
Cambio 3: Bypass de _sanitizeOverlappingChannels para V2
En NodeExtractionPipeline.extract():

typescript
const hasForgeGraph = fixtureGraph && fixtureGraph.nodes.length > 0
const nodes = hasForgeGraph
  ? this._buildNodesFromForgeGraph(...)   // NO sanitizar — los offsets son únicos por diseño
  : this._sanitizeOverlappingChannels(
      resolvedDeviceId,
      this._buildAllNodes(...),
    )
O, si se prefiere mantener sanitización, hacerla aware de 16-bit: dos canales en el mismo offset pero del mismo nodo (coarse+fin) deben preservarse, no competir.

Cambio 4: _buildNodesFromForgeGraph usa offsets 0-based directamente
Ya lo hace (_mapForgeNodes usa cfg.dmxOffset sin -1). Solo hay que asegurar que los dmxOffset en el JSON sean realmente relativos al fixture (no absolutos del universo).

RIESGOS Y MITIGACIÓN
Riesgo	Mitigación
Break V1 (Classic)	El bypass solo activa cuando nodeGraph está presente. V1 sin nodeGraph sigue la ruta legacy exacta.
Show files antiguos con fixtures V2	Al cargar show file, el fixture recibe forgeGraph del show; la ruta V2 lo maneja. Si no tiene forgeGraph, fallback a V1.
16-bit coarse/fine colisionan en sanitize	Para V2, desactivar sanitize. Los offsets del nodeGraph ya fueron validados en Forge.
TitanOrchestrator ya es complejo	El cambio es una bifurcación if (hasNodeGraph) al inicio de _normalizeFixtureDefinitionForAether. No toca la lógica legacy.
PRÓXIMO PASO
Esperando tu aprobación para implementar los 4 cambios propuestos. Puedo hacerlo en una sola pasada o en micro-PRs separados si prefieres. ¿Procedo?