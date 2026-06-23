# Auditoría: Pipeline de Mutación y Persistencia de la Trinidad (Forge)

**Scope:** flujo de datos entre `ForgeChannelRackTab`, `ForgeAetherCellsTab`, `ForgeGeneralTab`, `forgeBuilderState.ts`, `compileForgeState.ts`, `buildCompleteFixture` y `NodeResolver.ts`.
**Objetivo:** mapa de tuberías para diseñar el contrato definitivo de persistencia. **Cero código de solución.**

---

## 1. El Ciclo de Sincronización

### 1.1 Rack → Cells (`SYNC_RACK_TO_CELLS`)

**Trigger:** `ForgeChannelRackTab.tsx:88` dispara `dispatch({ type: 'SYNC_RACK_TO_CELLS', channelIdx: slotIndex })` inmediatamente después de un `CHANNEL_REPLACE` (drag-drop de un tipo de canal sobre un slot).

**Mecánica en `forgeBuilderState.ts:585-609`:**
1. Toma el canal modificado: `const ch = state.channels[channelIdx]`.
2. Itera **todas** las células que contienen ese `channelIdx` en `cell.channelIndices`.
3. Re-chequea admittance con `canAdmit(ch.type, cell.family)`.
4. Si el nuevo tipo es incompatible, desvincula el canal de la célula y emite warning.
5. Marca `dirty: true` si hubo cambios.

**Resultado:** el Aether Cells tab se entera del cambio de tipo porque el reducer le quita canales inválidos de sus células.

### 1.2 Cells → Rack (`SYNC_CELLS_TO_RACK`)

**Trigger:** **No existe.** `SYNC_CELLS_TO_RACK` está declarado en `forgeBuilderState.ts:239-241` e implementado en `forgeBuilderState.ts:611-625`, pero **nadie lo despacha**. No aparece en `ForgeAetherCellsTab.tsx` ni en ningún otro archivo.

**Mecánica latente:** si se despachara, compararía `maxIdx` de `cell.channelIndices` contra `state.channels.length` y extendería `channels[]` con placeholders `{ index: i, name: '', type: 'unknown', defaultValue: 0, is16bit: false }`, actualizando `meta.channelCount`.

**Punto ciego confirmado:**
- `CELL_ATTACH_CHANNEL` (ForgeAetherCellsTab) requiere que `state.channels[channelIdx]` exista; si no, retorna `state` sin error visible (`forgeBuilderState.ts:453-454`).
- `CELL_MOVE_CHANNEL` tiene el mismo guard (`forgeBuilderState.ts:496`).
- Si un usuario crea una célula e intenta adjuntar un canal cuyo índice es mayor o igual que `channelCount`, la operación es silenciosamente un no-op. El Channel Rack no se expande automáticamente para acomodar la célula.

### 1.3 Resumen de reacción cruzada

| Origen | Acción disparada | Destino informado | ¿Funciona? |
|--------|------------------|-------------------|------------|
| Channel Rack modifica tipo | `CHANNEL_REPLACE` + `SYNC_RACK_TO_CELLS` | Aether Cells (detach automático) | Sí |
| Channel Rack modifica count | `META_SET_CHANNEL_COUNT` / `CHANNEL_ADD` | Aether Cells (índices quedan huérfanos) | **Parcial**: no se re-mapean células |
| Aether Cells attach/move | `CELL_ATTACH_CHANNEL` / `CELL_MOVE_CHANNEL` | Channel Rack | **No**: falta despacho de `SYNC_CELLS_TO_RACK` |
| Aether Cells delete | `CELL_DELETE` | Channel Rack | Sí visualmente, el canal queda sin dueño |
| Aether Cells cambia tipo de familia | No existe cambio de familia en UI | — | N/A |

**Conclusión:** la sincronización es **asimétrica**. Rack afecta Cells, pero Cells no puede expandir Rack.

---

## 2. El Puente hacia el Alma (Graph Node)

### 2.1 ¿Cuándo se compilan las células a `nodeGraph`?

**Código de verdad:** `compileForgeState.ts:382-426`.

**Momentos en los que se ejecuta:**
1. **Pre-save check** (`FixtureForgeEmbedded.tsx:636-645`): si `forgeState.cells.length > 0`, se llama a `compileForgeState(forgeState)` para detectar errores bloqueantes antes de guardar.
2. **Guardado final** (`buildCompleteFixture` en `FixtureForgeEmbedded.tsx:607-624`): si `state.cells.length > 0`, vuelve a compilar y asigna `builtFixture.nodeGraph = compileResult.fixture.nodeGraph`.
3. **Runtime show load**: `FixtureHydrationEngine.ts` usa `pipeline.extract(definition, fixtureV2)` para generar `IDeviceDefinition` a partir del fixture JSON; el `nodeGraph` ya está en el JSON y no se re-compila en vivo (aunque `FixtureDefinitionV2` permite regenerarlo desde `channels[]` si falta).

### 2.2 Fases del compilador

| Fase | Función | Qué hace |
|------|---------|----------|
| A | `validateState` | Errores bloqueantes: no canales, cellId duplicado, células vacías, tipo incompatible |
| B | `resolveChannelDeps` | Resuelve `ignitionDeps` con `targetChannelIndex` si solo hay un candidato |
| C | `compileNodeGraph` | Mapea cada `FixtureChannel` → `input_dmx` + `output_dmx` + edge; agrupa por `aetherNodeId` |
| D | Ensamblaje | Produce `FixtureDefinitionV2` con `channels`, `nodeGraph`, `capabilities`, etc. |

### 2.3 Detalle de `compileNodeGraph`

- Ignora canales `type === 'unknown'`.
- Crea un `output_dmx` por canal con `config.aetherNodeId` y `config.aetherZone` extraídos de la célula dueña.
- Persiste `cellLabel` en `config.cellLabel` y en `profileMeta.customLabel` para roundtrip JSON.
- El `dmxFootprint` se calcula como `max(ch.index + (is16bit ? 2 : 1))`.

**Resultado:** el `nodeGraph` es una **proyección compilada** de `channels[] + cells[]`. No es una edición directa del grafo visual; el grafo visual se reconstruye a partir de las células.

---

## 3. El Esquema de Persistencia (El JSON Real)

### 3.1 Ubicación de `buildCompleteFixture`

No está en `FixtureDefinition.ts`. La función real está en `FixtureForgeEmbedded.tsx:535-627` (closure `useCallback` con dependencias `[forgeState, forgeGraph]`).

### 3.2 Propiedades raíz exactas del objeto JSON

`buildCompleteFixture` retorna un objeto con esta estructura (en orden de construcción):

```text
builtFixture = {
  // 1. Spread de baseFixture (fixture original de librería / showfile)
  ...baseFixture,

  // 2. Identidad
  name:         state.meta.name || baseFixture.name,
  manufacturer: state.meta.manufacturer || baseFixture.manufacturer,
  type:         state.meta.type || baseFixture.type,

  // 3. Canales físicos
  channels: syncedChannels,           // state.channels mapeado

  // 4. Física
  physics: state.physics ? { ... } : baseFixture.physics,
  // Incluye: motorType, maxAcceleration, maxVelocity, safetyCap, orientation,
  //            invertPan=false, invertTilt=false, swapPanTilt, homePosition, tiltLimits

  // 5. Rueda de color
  wheels: wheelColors.length > 0 ? { colors: wheelColors } : undefined,
  // NOTA: solo escribe el array colors; NI colorEngine NI minChangeTimeMs van aquí.

  // 6. Capabilities
  capabilities: {
    ...baseFixture.capabilities,
    colorEngine,                         // del state.wheels.colorEngine
    colorWheel: wheelColors.length > 0 ? { colors, allowsContinuousSpin=false, minChangeTimeMs } : undefined,
    hasPan, hasTilt, hasColorMixing, hasColorWheel, hasGobo, hasPrism, hasStrobe, hasDimmer,
  },

  // 7. NodeGraph (condicional)
  nodeGraph: graphSnapshot | compileResult.fixture.nodeGraph,
}
```

### 3.3 Estado de integración del nuevo ecosistema

| Propiedad | Estado | Ubicación actual | Persiste en JSON | Observación |
|-----------|--------|-------------------|-------------------|-------------|
| `physics` | ✅ Integrado | `fixture.physics` | Sí | Todos los campos se escriben |
| `wheels` (colores) | ⚠️ Parcial | `fixture.wheels.colors` | Sí | Solo `colors`; no `colorEngine` ni `minChangeTimeMs` |
| `wheels.colorEngine` | ⚠️ Parcial | `fixture.capabilities.colorEngine` | Sí | Se hidrata de capabilities |
| `wheels.minChangeTimeMs` | ⚠️ Parcial | `fixture.capabilities.colorWheel.minChangeTimeMs` | Sí | Se hidrata de capabilities |
| `dmxGovernors` | ❌ **Ignorado** | `state.dmxGovernors` | **No** | No se incluye en `buildCompleteFixture`. El tipo `FixtureDefinition` lo soporta, pero el editor no lo guarda. |
| `aetherCells` (raw snapshot) | ❌ **Ignorado** | `state.cells` | **No** | `hydrateAetherCells` está preparado para leer `fixture.aetherCells`, pero `buildCompleteFixture` nunca lo escribe. Reconstrucción fallback desde `nodeGraph`. |

### 3.4 Evidencia de pérdida de datos

- `buildCompleteFixture` no hace referencia a `state.dmxGovernors` ni a `state.cells` como propiedades raíz.
- `FixtureHydrationEngine.ts:352-358` detecta con logs que `dmxGovernors` puede estar presente en `fixture` pero no en `definition`, o viceversa — lo que confirma que hay una discontinuidad entre el JSON y la definición cargada.
- `hydrateAetherCells` (Route A) solo se activa si el JSON ya tiene `aetherCells`, lo cual nunca ocurre hoy porque nadie lo escribe.

---

## 4. El Camino al Compilador DMX (`NodeResolver.ts`)

### 4.1 Carga de la luminaria en vivo

1. El showfile referencia un `fixtureId`.
2. `FixtureHydrationEngine.ts` resuelve la definición y llama a `pipeline.extract(definition, fixtureV2)`.
3. `NodeExtractionPipeline.ts` construye `IDeviceDefinition` incluyendo `dmxGovernors` si existen en `fixtureDef.dmxGovernors` (`NodeExtractionPipeline.ts:411-428`).
4. `NodeResolver` recibe el `INodeGraph` y el `IDeviceDefinition`.
5. En patch-time, `NodeResolver.registerDevice(deviceId)` lee los canales del nodo Aether (`INodeChannelDef[]`) y pre-computa `IgnitionInjection`.
6. Si el fixture tiene `nodeGraph`, `registerForgeGraph(deviceId, compiled)` se llama para compilar el grafo Forge.

### 4.2 ¿Qué lee `NodeResolver` en cada frame?

**Ruta Legacy (sin `nodeGraph`):**
- `NodeResolver._writeNode(nodeId, channelValues)` llama a `this._graph.getNodeData(nodeId)` para obtener `INodeChannelDef[]`.
- Itera `node.channels` y escribe en el buffer DMX.
- No lee `fixture.channels[]` directamente; lee la definición del nodo Aether que ya fue extraída del fixture.

**Ruta Forge (con `nodeGraph`):**
- `NodeResolver._writeNode` detecta `this._forgeGraphs.has(node.deviceId)` y delega todo a `ForgeNodeEvaluator.evaluate(compiled, channelValues, context, buf, baseAddr)`.
- El `ForgeNodeEvaluator` lee el `nodeGraph` compilado, no `channels[]`.

### 4.3 Dónde encajan `dmxGovernors`

**Ubicación:** `NodeResolver.ts:1259-1272` dentro de `_writeNode`.

**Pipeline por canal:**
1. Normalizar valor.
2. Aplicar `TransferCurve`.
3. Clamp a `constraints.maxValue`.
4. Escalar a DMX [0,255].
5. Aplicar calibración del device.
6. Aplicar inversión de ejes (kinetic).
7. Aplicar velocity clamp + airbag (kinetic).
8. Aplicar `dmxPersonality` (strobe/dimmer mecánico).
9. Escribir `safeDmxValue` en el buffer.
10. **🏛️ DMX GOVERNOR ENGINE:** leer `device.dmxGovernors`, filtrar por canal y aplicar `applyDMXGovernors(_govs, chDef.dmxOffset, chDef.type, rawNormalized, safeDmxValue)`.
11. Escribir el byte final ajustado por gobernadores.

**Origen de `device.dmxGovernors`:** viene de `IDeviceDefinition.dmxGovernors`, que se hidrata desde `fixtureDef.dmxGovernors` en `NodeExtractionPipeline.ts:411`. Si el JSON no lo guardó, el array estará vacío y los gobernadores no tendrán efecto.

---

## 5. Conclusión y Puntos de Decisión para Opus

### 5.1 Brechas críticas confirmadas

1. **Sincronización asimétrica:** `SYNC_CELLS_TO_RACK` existe pero no se despacha. Las células no pueden expandir el rack de canales.
2. **Pérdida de gobernadores:** `state.dmxGovernors` no se escribe en el JSON. El DMX Governor Engine está cableado en runtime pero no persistente en el editor.
3. **Pérdida del layout Aether:** `state.cells` (raw `aetherCells` con `uiPosition`) no se escribe en el JSON. El layout visual se reconstruye heurísticamente desde `nodeGraph`.
4. **`wheels` fragmentado:** metadata de rueda (`colorEngine`, `minChangeTimeMs`) vive en `capabilities`, no en `wheels`.

### 5.2 Preguntas que Opus debe resolver

- **¿Persistir `aetherCells` como snapshot raw o seguir reconstruyendo desde `nodeGraph`?** Snapshot da fidelidad del layout; reconstrucción reduce tamaño de JSON.
- **¿Dónde vive la verdad de `dmxGovernors`?** En `fixture.dmxGovernors` (ya está en el tipo) o en el grafo de nodos. Hoy el tipo lo soporta pero el editor no lo guarda.
- **¿`SYNC_CELLS_TO_RACK` debe ser automático o manual?** ¿En cada `CELL_ATTACH_CHANNEL` se extiende el rack, o el usuario debe añadir canales primero?
- **¿`wheels` debe absorber `colorEngine` y `minChangeTimeMs` para dejar `capabilities` como derivado?** Esto simplificaría hidratación y exportación.

### 5.3 Archivos que Opus debe tocar para el contrato definitivo

- `src/core/forge/forgeBuilderState.ts` — sincronización y acciones de células.
- `src/core/forge/compileForgeState.ts` — fase D, ensamblaje del JSON.
- `src/components/views/ForgeView/FixtureForgeEmbedded.tsx` — `buildCompleteFixture` y `handleSave`.
- `src/types/FixtureDefinition.ts` — confirmar shape final de `FixtureDefinition` y `FixtureDefinitionV2`.
- `src/core/aether/ingestion/NodeExtractionPipeline.ts` — hidratación de `dmxGovernors` al `IDeviceDefinition`.
- `src/core/aether/resolver/NodeResolver.ts` — punto de evaluación de gobernadores (ya está; no requiere cambio salvo que cambie el origen de datos).

---

*Fin del mapa de tuberías.*
