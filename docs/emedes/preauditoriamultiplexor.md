AUDITORÍA FORENSE CORE — MAPEO DE MULTIPLEXOR Y SERIALIZACIÓN
MISIÓN 1: La Última Milla (DMX Compilation)
Archivo: @/electron-app/src/core/aether/resolver/NodeResolver.ts

Ruta de escritura final
Función	Línea	Acción
_writeNode	942	Entry point. Recibe nodeId + channelValues (floats 0-1).
_writeNodeIK	1381	Entry point paralelo para kinemática inversa (pan/tilt espacial).
Conversión semántica → byte


Proyectos
let dmxValue = sanitizeDmxByte(Math.round(normalized * 255))
Escritura en el SharedArrayBuffer (Uint8Array)
Ruta clásica — el punto exacto donde el byte toca el metal:



Proyectos
buf[bufIdx] = safeDmxValue
Ruta 16-bit — corregir coarse tras cálculo fine:



Proyectos
const raw16 = Math.round(normalized * 65535)
// ...
buf[fineIdx] = sanitizeDmxByte(safeRaw16 & 0xFF)
buf[bufIdx] = sanitizeDmxByte((safeRaw16 >> 8) & 0xFF)
Ruta IK — escritura directa de pan/tilt resueltos:



Proyectos
buf[bufIdx] = dmxValue
Mapa arquitectónico del hot-path


NodeArbiter.arbitrate()  →  resolve()  →  _writeNode()/_writeNodeIK()
      (float 0-1)              (float 0-1)        (int 0-255)
                                    ↓
                              [INJECT MULTIPLEXOR AQUÍ]
                                    ↓
                              buf[bufIdx] = byte
Observación crítica: Ya existe un remapper de personalidad DMX (dmxPersonality en INodeChannelDef) insertado después del clamp en _writeNode. El Multiplexor de Prioridad debería anidarse en la misma zona: entre el cálculo final del byte (safeDmxValue) y la asignación al Uint8Array.

MISIÓN 2: El Agujero Negro de la Forja (JSON Serialization)
Cadena de custodia
Eslabón	Archivo	Líneas	Rol
Serializador UI	FixtureForgeEmbedded.tsx	1016-1088	buildCompleteFixture — arma el payload.
Puente IPC	libraryStore.ts	203-218	saveUserFixture — envía al backend.
Handler backend	IPCHandlers.ts	1269-1389	lux:library:save-user — escribe a disco.
Interfaz de persistencia	FixtureDefinition.ts	226-279	Define qué campos SON serializables.
Extensión Forge	types.ts	413-420	Añade nodeGraph? a la interfaz.
Qué se pierde y por qué
1. Las células Aether (forgeState.cells) NUNCA salen del frontend

En buildCompleteFixture:



Proyectos
if (shouldPersistNodeGraph && graphSnapshot) {
  builtFixture.nodeGraph = graphSnapshot
}
El graphSnapshot es un clon del forgeGraph (estado del canvas de nodos), NO del forgeState.cells. Las células Aether son un concepto UI/intermedio que se compilan a nodeGraph, pero su estado fuente no forma parte de FixtureDefinition ni de IForgeNodeGraph.

2. El nodeGraph solo se incluye si compila OK



Proyectos
if (forgeState.cells.length > 0) {
  const compileResult = compileForgeState(forgeState)
  if (compileResult.ok) {
    builtFixture.nodeGraph = compileResult.fixture.nodeGraph
  } else {
    // Blocking errors will surface to the user in 4732-E
    // Por ahora, no abortamos el save — el grafo anterior prevalece.
  }
}
Si compileResult.ok === false, el save NO se aborta (línea 1083). El fixture se guarda SIN nodeGraph (o con un nodeGraph stale del snapshot anterior).

3. La interfaz FixtureDefinition no tiene slots para arquitectura Aether/Graph



Proyectos
export interface FixtureDefinition {
  id: string;
  name: string;
  manufacturer: string;
  type: FixtureType;
  channels: FixtureChannel[];
  wheels?: { ... };
  physics?: { ... };
  capabilities?: { ... };
}
No existe aetherCells, aetherNode, ni ningún campo que aloje el estado de la forja moderna. Solo nodeGraph (en la extensión V2) y channels[] (legacy).

4. El backend no valida schema — escribe lo que llega



Proyectos
const payload = JSON.parse(JSON.stringify(fixture))
delete payload.filePath
delete payload.source
// ...
fs.writeFileSync(filePath, JSON.stringify(payload, null, 2))
No hay validación de campos obligatorios ni verificación de que nodeGraph esté presente. Si el frontend envió un objeto vacío o incompleto, se persiste tal cual.

5. Los metadatos del Grafo (aetherNodeId, aetherZone) están enterrados

Estos campos sí existen, pero viven en IOutputDmxConfig (dentro de nodeGraph.nodes[].config):



Proyectos
readonly aetherNodeId?: string
readonly aetherZone?: string
Si el nodeGraph no se persiste (por fallo de compilación o porque shouldPersistNodeGraph es false), estos metadatos se evaporan con él.

Diagnóstico forense resumido
Capa	Estado	Observación
FixtureDefinition (interfaz)	Ciego	Diseñada para el Channel Rack clásico.
buildCompleteFixture	Filtro	Solo exporta nodeGraph compilado, nunca el estado crudo de células.
compileForgeState	Single point of failure	Si falla, el save continúa sin grafo.
saveUserFixture (IPC)	Passthrough	No inspecciona qué campos faltan.
lux:library:save-user (backend)	Túnel	JSON.stringify directo, sin schema validation.
Conclusión técnica: La Forja guarda el artefacto compilado (nodeGraph) y el Channel Rack legacy (channels[]), pero pierde el estado fuente (forgeState.cells, layout de células, conexiones internas del editor Aether). La persistencia es unidireccional: de células → grafo → JSON, pero nunca se puede reconstruir el editor Aether desde el JSON guardado porque el estado intermedio se descarta en la compilación.



Feedback submitted