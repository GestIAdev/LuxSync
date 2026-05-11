# AETHER MATRIX & NODE EVALUATOR AUDIT — LuxSync V1.0

**Auditor:** PunkOpus (Ingeniero Jefe, Sistemas Distribuidos & Latencia)
**Fecha:** 2026-05-10
**Alcance:** El "cerebro" de LuxSync — Aether Matrix (NodeGraph, NodeResolver, Spatial Registrar), Forge Node Evaluator, y arquitectura de abstracción agnóstica.
**Archivos auditados:**
- `src/core/aether/NodeGraph.ts` (645 líneas)
- `src/core/aether/node-graph.ts` (314 líneas — contratos)
- `src/core/aether/types.ts` (493 líneas)
- `src/core/aether/capability-node.ts` (452 líneas)
- `src/core/aether/intent-bus.ts` (395 líneas)
- `src/core/aether/ingestion/NodeExtractionPipeline.ts` (1052 líneas)
- `src/core/aether/ingestion/SpatialRegistrar.ts` (659 líneas)
- `src/core/aether/resolver/NodeResolver.ts` (1284 líneas)
- `src/core/aether/resolver/AetherUIProjector.ts` (194 líneas)
- `src/core/aether/adapters/zoneUtils.ts` (302 líneas)
- `src/core/aether/adapters/helpers/zone-node-router.ts` (previamente auditado)
- `src/core/forge/compiler/ForgeGraphCompiler.ts` (728 líneas)
- `src/core/forge/evaluator/ForgeNodeEvaluator.ts` (165 líneas)
- `src/core/forge/evaluator/opcodes.ts` (24 opcodes)

---

## 1. The Nexus: Aether Matrix Architecture

### 1.1 La Filosofía Agnóstica: ¿Es realmente independiente del DMX?

**Sí. Con matices técnicos importantes.**

La arquitectura Aether separa efectivamente la lógica de control de la física del protocolo mediante tres capas bien definidas:

```
L2/L1/L3/L0 Systems & Effects → IntentBus → NodeArbiter → NodeResolver → DMX HAL
     (0-1 normalizado)            (intents)    (merge)      (0-255)     (hardware)
```

**El CapabilityNode es la unidad atómica correcta.** Un fixture no es un bloque monolítico — es una carcasa que agrupa N nodos de capacidad (`COLOR`, `IMPACT`, `KINETIC`, `BEAM`, `ATMOSPHERE`). Cada nodo tiene sus propios canales, constraints, y rol semántico. Esto es genuinamente agnóstico: el `ColorSystem` emite `{r: 0.8, g: 0.3, b: 0.9}` sin saber si el hardware es RGB, RGBW, CMY, o rueda de colores mecánica.

**La separación real ocurre en dos puntos:**

1. **NodeExtractionPipeline** (`NodeExtractionPipeline.ts:264-408`): Traduce `FixtureDefinition` legacy → `IDeviceDefinition` con `ICapabilityNode` descompuestos. Los canales DMX se clasifican por familia semántica:
   ```typescript
   const COLOR_CHANNEL_TYPES = new Set([
     'red', 'green', 'blue', 'white', 'amber', 'uv',
     'cyan', 'magenta', 'yellow', 'color_wheel',
   ])
   ```
   Esto es un mapeo unidireccional y read-only. El fixture legacy permanece intacto.

2. **NodeResolver** (`NodeResolver.ts:993-1155`): `_translateColor()` convierte r/g/b abstractos a canales físicos según `mixingType` (`rgb`, `rgbw`, `cmy`, `wheel`, `hybrid`). El ColorSystem nunca ve el DMX.

**Pero la agnosticidad tiene grietas:**

- `dmxOffset` vive en `INodeChannelDef` (`capability-node.ts:80`). Es un número entero que representa la posición física en el universo DMX. El nodo **conoce** su offset relativo al device.
- `ColorWheelDefinition` (`types.ts`) define `slots[]` con `dmxValue` y `previewRgb`. El nodo COLOR sabe que existe una rueda mecánica con slots DMX discretos.
- `NodeResolver._translateColor()` para `wheel`/`hybrid` llama a `getColorTranslator().translate()` con un objeto wheel legacy. La abstracción se rompe en el último metro.

**Veredicto:** Aether es **agnóstico en la dirección efectos→lógica**, pero **consciente del hardware en la dirección lógica→DMX**. Esto es razonable — no puedes ser completamente ciego al hardware cuando necesitas saber que una rueda de colores necesita 200ms de transición mínima.

### 1.2 NodeGraph — El World del ECS Pragmático

`NodeGraph.ts` implementa un registro central con data-oriented design:

- **5 dense arrays** (`_color[]`, `_impact[]`, `_kinetic[]`, `_beam[]`, `_atmosphere[]`) — iteración O(N) cache-friendly.
- **5 índices O(1)** (`_slotIndex`, `_zoneIndex`, `_roleIndex`, `_deviceIndex`, `_deviceDefs`) — lookups sin iteración.
- **Swap-and-pop** para eliminación O(1): `store[idx] = store[last]; store.pop()`.

```typescript
// NodeGraph.ts:365-377
getView<F extends NodeFamily>(family: F): INodeView<NodeFamilyDataMap[F]> {
  switch (family) {
    case NodeFamily.COLOR:      return this._colorView as unknown as INodeView<NodeFamilyDataMap[F]>
    // ... table switch — V8 puede optimizar como jump table
  }
}
```

**La decisión de usar arrays JS en vez de TypedArrays es correcta.** Los nodos son objetos estructurales con hidden class estable. V8 puede hacer inline caching de propiedades. Un TypedArray no aplica aquí.

**Problema:** `_rebuildViews()` se llama en **cada** `registerDevice()` y `unregisterDevice()`. Re-indexa TODOS los dense arrays completos — O(N_total). En patch time esto es aceptable (show típico: 60-300 nodos, ~2-5ms). Pero en un escenario de drag-and-drop en vivo donde el operador mueve fixtures frecuentemente, el costo se acumula.

### 1.3 IntentBus — Bus de Alta Velocidad

```typescript
// intent-bus.ts:56-104
export interface INodeIntent {
  readonly nodeId: NodeId
  readonly values: Readonly<Record<string, number>>  // 0-1 normalizado
  readonly priority: number   // L0=0-99, L1=100-199, L2=200-299, L3=300-399, L4=900+
  readonly confidence: number // 0-1 blending weight
  readonly source: IntentSource
}
```

El bus opera con intents normalizados 0-1. Solo el NodeResolver escala a 0-255. Esto garantiza que todos los Systems hablen el mismo idioma.

**Layer ranges:**
- L0 (Systems base): 0-99
- L1 (Selene IA): 100-199
- L2 (Manual overrides): 200-299
- L3 (Effects): 300-399
- L4 (Blackout/Emergency): 900+

El `NodeArbiter` (previamente auditado en CHROMATIC-CORE-AUDIT.md) implementa HTP para dimmer y LTP para otros canales, con Mover Shield para proteger movers de color no deseado.

---

## 2. Spatial Mapping & The 9 Canonical Zones

### 2.1 Las 9 Zonas Canónicas — Un diseño de genio práctico

`zoneUtils.ts` define un sistema de 9 zonas canónicas que mapean intensidades del análisis espectral (`LiquidStereoResult`) a regiones físicas del escenario:

```typescript
// zoneUtils.ts:173-192
export function selectZoneFromResult(result: LiquidStereoResult, nodeZone: string): number {
  switch (normalizeZoneId(nodeZone)) {
    case 'front-left':   return result.frontLeftIntensity
    case 'front-right':  return result.frontRightIntensity
    case 'back-left':    return result.backLeftIntensity
    case 'back-right':   return result.backRightIntensity
    case 'movers-left':  return result.moverLeftIntensity
    case 'movers-right': return result.moverRightIntensity
    case 'floor':        return result.floorIntensity
    case 'ambient':      return result.ambientIntensity
    case 'air':          return result.airIntensity
    // ... zonas compuestas: front, back, left, right
  }
}
```

**Esta es una genialidad de diseño con datos:**

1. **8 zonas direccionales + 1 atmosférica** cubren todo el vocabulario espacial de un show de iluminación profesional: front/back/left/right para wash, movers-left/right para haz, floor para uplight, ambient para BG, air para hazer/laser.
2. **Zonas compuestas** (`front`, `back`, `left`, `right`) calculan promedios de sus sub-zonas. El operador puede dirigirse a "front" como un todo o a "front-left" con precisión estéreo.
3. **Stereo awareness en patch time:** `NodeExtractionPipeline._resolveStereoAwareZone()` convierte zonas mono (`front`, `back`) a sub-zonas estéreo (`front-left`, `front-right`) basándose en la coordenada X del fixture:
   ```typescript
   if ((normalized === 'front' || normalized === 'back') && typeof x === 'number') {
     if (x < -0.1) return (normalized === 'front' ? 'front-left' : 'back-left') as ZoneId
     if (x > 0.1)  return (normalized === 'front' ? 'front-right' : 'back-right') as ZoneId
   }
   ```
4. **Legacy alias normalization:** `normalizeZoneId()` maneja 30+ aliases legacy (`frontpars`, `ceiling-front`, `moving-left`, `stage-left`, etc.) mapeándolos a canónicos. Un show migrado de V1/V2 funciona sin modificaciones.

**Pero hay una trampa:** Las zonas compuestas usan promedios simples:
```typescript
case 'left':
  return (result.frontLeftIntensity + result.backLeftIntensity + result.moverLeftIntensity) / 3
```
Si una sub-zona no tiene fixtures asignados, su intensidad sigue contando en el promedio. No hay ponderación por número de fixtures reales. Una zona compuesta con 20 fixtures en `front-left` y 0 en `back-left` promedia como si ambas tuvieran peso igual. Para V1.0, las zonas compuestas deberían ser ponderadas por conteo de nodos activos.

### 2.2 SpatialRegistrar — El GPS del Escenario

`SpatialRegistrar.ts` inyecta `Position3D` real en los nodos y construye la tabla de vecinos para Selene IA:

```typescript
// SpatialRegistrar.ts:115-118
rebuildNeighborGraph(nodeGraph: INodeGraph, maxNeighbors?: number): void
```

- **O(N²) en patch time** — calcula distancia euclidiana 3D entre todos los pares de nodos de la misma familia. Para 100 nodos COLOR, son 10.000 distancias. Aceptable en patch time, imposible en frame time.
- **Vecindad para propagación espacial:** Selene usa `neighborIds` para efectos tipo "ola de luz de izquierda a derecha".
- **Petal offset para multi-emitter:** Fixtures tipo fan RGBW distribuyen pétalos en círculo de 15cm (`DEFAULT_PETAL_RADIUS_M = 0.15`) alrededor del centro.

**Limitación:** `updateDevicePosition()` hace unregister → re-register completo. No hay actualización incremental de posición. En un escenario donde el operador arrastra 20 fixtures simultáneamente, cada uno dispara un ciclo unregister/register completo con `_rebuildViews()` incluido. Esto podría causar stutter perceptible en la UI.

### 2.3 ZoneNodeRouter — Resolución de Zonas a NodeIds

Previamente auditado en CHROMATIC-CORE-AUDIT.md. Construye zonas compuestas (`all-movers` como unión de `movers`, `movers-left`, `movers-right`) y resuelve `ZoneId` → `NodeId[]` con cache. El fix de WAVE 4713 para `all-movers` confirma que la arquitectura de zonas es funcional pero requiere mantenimiento activo de las zonas compuestas.

---

## 3. NodeEvaluator: Visual Logic Runtime

### 3.1 NodeResolver — El Guardián del Hardware

`NodeResolver.ts` (1284 líneas) es el componente más complejo del core. Traduce `ArbitratedNodeMap` (0-1 normalizado) a `IDMXPacket` (0-255 bytes).

**Pipeline por frame (`resolve()` líneas 386-424):**
1. Zero-fill de todos los `Uint8Array(512)` de universos activos
2. Para cada nodo arbitrado: `_writeNode()` → traducción + calibración + write
3. DarkSpin cross-node sweep
4. Ensamblar packets desde buffers

**Zero-alloc claims verificados:**
- ✅ `_universeBuffers`: `Map<number, Uint8Array>` pre-allocado en `registerDevice()`
- ✅ `_packetPool`: pool de `MutableDMXPacket` reutilizados
- ✅ `_rgbScratch`: objeto RGB mutable reutilizado
- ✅ `_activeUniverses`: `Set` reutilizado, `clear()` sin alloc

**Zero-alloc claims FALSOS:**
- ❌ `_translateColor()` retorna un **nuevo objeto literal** en CADA branch:
  ```typescript
  // NodeResolver.ts:1022-1030
  return {
    ...original,           // spread = shallow copy
    [CH_RED]: safeR,
    [CH_GREEN]: safeG,
    [CH_BLUE]: safeB,
    [CH_R]: safeR,
    [CH_G]: safeG,
    [CH_B]: safeB,
  }
  ```
  El spread `...original` crea un nuevo objeto. Para cada nodo COLOR en cada frame (podrían ser 50+), esto genera objetos heap que V8 debe recolectar. En un show de 8 horas a 44Hz, son ~7.9 millones de objetos `Record<string, number>` creados y destruidos.

- ❌ `resolve()` copia `Uint8Array → number[]` para cada universo activo:
  ```typescript
  // NodeResolver.ts:416-418
  for (let i = 0; i < DMX_UNIVERSE_SIZE; i++) {
    channels[i] = buf[i]
  }
  ```
  El `IDMXPacket.channels` es `readonly number[]`. El buffer DMX es `Uint8Array`. Esta copia es inevitable dado el contrato `IDMXPacket`, pero son 512 iteraciones por universo por frame. Con 8 universos = 4.096 asignaciones numéricas por frame.

- ❌ `_getOrBuildSoftBlackoutMask()` itera TODOS los nodos de TODAS las familias cada vez que se llama (líneas 447-470). Si no está cacheado, es O(totalNodes). En un rig de 200 nodos, esto es 200 iteraciones.

### 3.2 Forge Node Evaluator — La Inyección de Grafos

**WAVE 4548.6** introdujo un bypass total: si un device tiene un `CompiledForgeGraph`, el `NodeResolver` delega completamente al `ForgeNodeEvaluator`.

```typescript
// NodeResolver.ts:514-583
const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, ctx, buf, baseAddr)
  // Post-Forge safety sweep (airbag + velocity clamp + DarkSpin)
  // ...
  return  // BYPASS: no ejecutar flujo legacy
}
```

**ForgeNodeEvaluator.evaluate** (`ForgeNodeEvaluator.ts:51-163`) es genuinamente zero-alloc:

```typescript
// STEP 1: Inject inputs (Aether + Audio + Context)
for (const [channelKey, wireIdx] of compiled.inputMap) {
  wire[wireIdx] = values[channelKey] ?? 0.0
}

// STEP 2: Execute program (opcode table dispatch, linear scan)
for (let pc = 0; pc < programLen; pc++) {
  const instr = program[pc]
  OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)
  // Edge propagation inmediata (sin frame-lag)
  for (let e = 0; e < edgeCount; e++) {
    const srcIdx = wiring[e * 2]
    const dstIdx = wiring[e * 2 + 1]
    wire[dstIdx] = wire[srcIdx]
  }
}

// STEP 3: Flush outputs (wireBuffer → dmxBuffer)
for (let o = 0; o < outputLen; o++) {
  const out = outputs[o]
  dmxBuffer[baseAddr + out.dmxOffset] = Math.round(wire[out.wireIndex] * 255)
}
```

**Análisis técnico del evaluador:**
- **OPCODE_TABLE dispatch:** Array indexado por opcode numérico — O(1), sin switch ni if-else chains.
- **Edge propagation inmediata:** Tras cada instrucción, los outputs se propagan a los inputs downstream. Una cadena A→B→C se resuelve en el MISMO frame, sin frame-lag.
- **24 opcodes:** noop, input_dmx, input_audio_band, input_beat, input_bpm, input_energy, input_constant, input_time, proc_lfo, proc_smooth, proc_map_range, proc_math, proc_clamp, proc_delay, proc_merge, proc_invert, proc_curve, logic_threshold, logic_gate, logic_switch, logic_and, logic_or, logic_counter, output_dmx.
- **WAVE 4552:** Compound ingenio inlining — los nodos `compound_ingenio` se aplatan en compile-time mediante `_inlineCompoundNodes()`.

**El compilador** (`ForgeGraphCompiler.ts`) realiza:
1. **Kahn's topological sort** → orden de ejecución determinista
2. **Wire allocation** → `Float64Array` para ports
3. **State allocation** → `Float64Array` para nodos stateful (LFO phase, smooth prev, delay ring buffer)
4. **Program build** → `CompiledInstruction[]` con opcode + offsets
5. **Edge wiring** → `Uint32Array` de pares `[src, dst]`

**Problema crítico del Forge bypass:**

El Forge evaluator **bypassa TODA la lógica de seguridad** del NodeResolver. No aplica `TransferCurve`, no aplica calibración, no hace clamp a constraints. La seguridad se aplica **después** como un "safety sweep":

```typescript
// NodeResolver.ts:529-547
if (sm && node.family === NodeFamily.KINETIC) {
  for (let ci = 0; ci < node.channels.length; ci++) {
    // clampKineticSingleAxis + applyAirbag
  }
}
```

Esto es arquitectónicamente correcto (separar evaluación de seguridad), pero tiene dos riesgos:
1. **Un grafo Forge malicioso puede escribir valores fuera de rango en el buffer DMX antes del safety sweep.**
2. **El safety sweep solo cubre KINETIC (velocity clamp + airbag) y COLOR (DarkSpin).** No hay verificación de que un grafo Forge no esté escribiendo en direcciones DMX de otros fixtures.

**Recomendación V1.0:** El safety sweep debería validar que los `dmxOffset` del grafo Forge están dentro del rango del device registrado.

### 3.3 AetherSafetyMiddleware — Capa de Seguridad Cinética

**WAVE 4557** añadió un middleware de 3 fases:

- **Phase 0:** `applyOutputGate()` — mutea todo el ArbitratedNodeMap cuando `outputEnabled=false`, excepto overrides manuales L2.
- **Phase 1:** `clampKineticVelocity()` + `applyAirbag()` — limita velocidad de pan/tilt a `KINETIC_SAFETY_CAP_VEL=400` DMX units/s. Airbag con márgenes `PAN_AIRBAG_MARGIN=5`, `TILT_AIRBAG_MARGIN=5`.
- **Phase 1b:** `checkDarkSpin()` — blackout transit para ruedas mecánicas. `performance.now()`-based.
- **Phase 2:** `shouldSendUniverse()` — throttling por universo (30Hz para OpenDMX, passthrough para ArtNet).

**DarkSpin es una innovación real:** Cuando una rueda de colores mecánica está en tránsito, el middleware fuerza `dimmer=0` para evitar que el cristal/blanco de transición sea visible. El `_applyDarkSpinCrossNodeSweep()` (líneas 732-791) escanea nodos COLOR en tránsito y apaga sus nodos IMPACT correspondientes. Es cross-family, cross-node, y stateful.

**Problema:** `_applyDarkSpinCrossNodeSweep()` es O(transitNodes × deviceNodesPerTransitDevice) por frame. En el peor caso (todos los fixtures con rueda mecánica cambiando simultáneamente), escanea todos los nodos IMPACT de todos los devices. En un rig de 50 fixtures con rueda, esto es ~50 × 1 = 50 iteraciones adicionales por frame. Aceptable pero no documentado como costo.

### 3.4 Inverse Kinematics Integration

El NodeResolver tiene un **split-brain gatekeeper determinista** (WAVE 4631):

```typescript
// NodeResolver.ts:589-604
const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
if (!kineticNode.isContinuous && hasSpatialTarget) {
  this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, !nodeBlocked)
  return  // RUTA ESPACIAL (IK puro)
}
// ... RUTA CLÁSICA (pan/tilt directo)
```

La decisión se toma **por frame** basándose en la presencia de `targetX` en los valores arbitrados. No hay flags persistentes. Esto es robusto: si un efecto deja de emitir `targetX`, el nodo cae automáticamente a la ruta clásica en el siguiente frame.

La ruta IK usa `solve()` del `InverseKinematicsEngine` con perfil lazy-cacheado (`_getOrBuildIKProfile`). Los perfiles se construyen una vez y se reutilizan. Los resultados IK (pan/tilt DMX) pasan por velocity clamp + airbag antes de escribir al buffer.

**Problema:** `_writeNodeIK` emite logs de telemetría en cada llamada cuando `_resolveFrameIndex % 30 === 0`. En producción, estos logs deberían estar detrás de un flag de debug.

---

## 4. Future-Proofing: Pixel Mapping & LED Integration

### 4.1 ¿Está la arquitectura preparada para pixel mapping?

**Respuesta honesta: Solo a nivel de tipos. No hay motor de pixel mapping operativo.**

**Lo que EXISTE:**

1. **NodeRole `'pixel'`** (`types.ts:116`):
   ```typescript
   export type NodeRole = 'primary' | 'percussion' | 'breath' | 'accent' | 'ambient'
     | 'decoration' | 'atmosphere' | 'pixel' | (string & {})
   ```
   El rol `pixel` está declarado pero no hay System que lo trate diferente. Un nodo con `role='pixel'` recibiría los mismos intensidades que cualquier otro nodo COLOR/IMPACT de su zona.

2. **Multi-emitter detection** (`NodeExtractionPipeline.ts:465-486`):
   ```typescript
   private _detectFanEmitterGroups(colorChs: readonly FixtureChannel[]): ChannelGroup[] {
     // Divide canales de color en bloques por pétalo para fixtures tipo fan
   }
   ```
   Un fixture tipo `fan` con canales RGBW se descompone en N nodos COLOR (uno por pétalo). Cada pétalo tiene su propio `emitterIndex`, `labelSuffix`, y offset DMX calculado. Esto es la base semántica para manejar barras LED pixeladas.

3. **Position3D en cada nodo** (`capability-node.ts:187`):
   ```typescript
   readonly position?: Position3D  // "para stereo routing y pixel mapping"
   ```
   El comentario JSDoc dice explícitamente "para stereo routing y pixel mapping". La posición 3D existe pero el motor de pixel mapping que la consumiría no está implementado.

4. **Petal offset radial** (`SpatialRegistrar.ts:160-166`):
   Los pétalos de un fan se distribuyen en círculo de 15cm alrededor del centro del fixture. Esto da posiciones discretas a los emitters individuales.

**Lo que NO EXISTE:**

- ❌ No hay un sistema de resolución espacial que convierta un video 2D/3D a valores DMX por píxel.
- ❌ No hay una abstracción de "canvas" o "textura" que los efectos puedan pintar y que luego se samplee en las posiciones de los fixtures.
- ❌ No hay concepto de "densidad espacial" o "resolución de muestreo".
- ❌ El `ColorSystem` no sabe que un nodo es parte de una matriz LED. No hay coordenadas UV, no hay near-neighbor interpolation.
- ❌ No hay pipeline de "media server" o "video input".

**Veredicto:** LuxSync tiene los **tipos y la semántica** para soportar pixel mapping, pero no el **motor**. Para V1.0, pixel mapping es un roadmap item (probablemente WAVE 4800+). La arquitectura actual no se rompería al añadirlo — necesitaría un nuevo System (PixelSystem o MediaSystem) que genere intents basados en posiciones 3D, pero el NodeGraph y el NodeResolver lo absorberían sin cambios.

### 4.2 Escalabilidad a resoluciones espaciales

El NodeGraph usa dense arrays por familia. Si añadiéramos un rig de 1.000 píxeles LED (una pantalla LED de 32×32), cada píxel sería un nodo COLOR con `role='pixel'`. El dense array de COLOR pasaría de 50 a 1.050 nodos. La iteración O(N) del `ColorSystem` seguiría siendo cache-friendly (array contiguo). Los lookups por zona/rol seguirían siendo O(1) Map.get().

**El cuello de botella sería el NodeResolver:** `_translateColor()` crea un nuevo objeto literal por cada nodo COLOR. Con 1.000 píxeles a 44Hz, son 44.000 objetos por segundo. V8 lo manejaría pero el GC pressure sería palpable.

**El otro cuello sería el IntentBus:** `MAX_INTENTS_PER_FRAME` (recomendado: 2048) se quedaría corto para 1.000 píxeles × 5 Systems potenciales. Necesitaría escalar a ~10.000 slots.

---

## 5. Critical Flaws & Performance Risks

### 5.1 Bugs arquitectónicos confirmados

#### A. `_translateColor` NO es zero-alloc (NodeResolver.ts:993-1155)
**Gravedad: MEDIA.** Cada branch retorna un objeto literal nuevo con spread `...original`. El claim de "zero-alloc" en el comentario del método es falso. En rigs con 50+ nodos COLOR, esto genera objetos heap en cada frame.
**Fix:** Pre-allocar un objeto `Record<string, number>` mutable, escribir los canales traducidos, y retornarlo. Reutilizar el mismo objeto frame a frame.

#### B. `resolve()` copia Uint8Array → number[] por universo (NodeResolver.ts:416-418)
**Gravedad: MEDIA.** 512 asignaciones por universo por frame. Con 8 universos = 4.096 asignaciones/frame × 44Hz = ~180K asignaciones/s.
**Fix:** Cambiar `IDMXPacket.channels` de `readonly number[]` a `Uint8Array` para permitir zero-copy desde el buffer del universo.

#### C. Forge bypass sin boundary check de DMX (NodeResolver.ts:514-583)
**Gravedad: ALTA.** Un grafo Forge compilado malicioso podría escribir fuera del rango del device.
**Fix:** Validar en `registerForgeGraph()` que todos los `dmxOffset` de los outputs están dentro del `channelCount` del device.

#### D. `_getOrBuildSoftBlackoutMask` sin cache persistente (NodeResolver.ts:434-474)
**Gravedad: BAJA-MEDIA.** La máscara se construye cuando no está en cache, pero el cache es por universo. Si un universo se desregistra y vuelve a registrarse, la máscara se reconstruye. Construcción O(totalNodes).
**Fix:** Reconstruir solo cuando cambia la topología del universo, no en cada miss de cache.

#### E. Telemetría de IK en hot path (NodeResolver.ts:815-819, 853-857)
**Gravedad: BAJA.** Logs de `console.log` con template strings en cada frame cuando `_resolveFrameIndex % 30 === 0`.
**Fix:** Reemplazar con un flag de debug condicional.

#### F. `_writeNode` ejecuta `_t36probe` en cada frame (NodeResolver.ts:507-511)
**Gravedad: BAJA.** Código de debugging residual que llama `getView().get(0)` en cada frame cuando `_resolveFrameIndex % 20 === 0`.
**Fix:** Eliminar o condicionar a flag de debug.

#### G. DarkSpin cross-node sweep O(transit × devices) (NodeResolver.ts:732-791)
**Gravedad: BAJA.** En el peor caso escanea todos los IMPACT nodes de todos los devices en tránsito.
**Fix:** Pre-computar un mapa `deviceId → IMPACT nodeIds[]` en patch time para evitar iterar todos los nodos del device.

### 5.2 Decisiones arquitectónicas cuestionables

#### H. SpatialRegistrar.updateDevicePosition() hace unregister/register completo
Mover un fixture en el stage dispara `_removeNode()` con swap-and-pop + `_rebuildViews()` completo. En drag-and-drop de múltiples fixtures, esto es N ciclos unregister/register. Un batch update haría una sola `_rebuildViews()` al final.

#### I. El IntentBus declara MAX_INTENTS_PER_FRAME pero no hay verificación de overflow
`intent-bus.ts:181-183` dice "Si se excede la capacidad, los intents adicionales se descartan". No encontré el código que implementa esta protección en la versión leída. Si el bus realmente descarta intents silenciosamente, es un bug grave.

#### J. `_applyTransferCurve` con switch en string
`NodeResolver.ts:1195-1212` usa `switch (curve.type)` con strings (`'exponential'`, `'logarithmic'`, `'scurve'`, `'gamma'`). El comentario del NodeGraph elogia "table switch" para enums numéricos. Aquí los tipos son strings. V8 puede optimizar string switches, pero no con la misma confianza que un enum numérico. Dado que esto corre en el hot path (cada canal de cada nodo), un enum numérico sería preferible.

#### K. `AetherUIProjector` lee del ArbitratedNodeMap pero no hay invalidación de cache
`AetherUIProjector.project()` itera fixtures legacy y lee del `ArbitratedNodeMap`. Si el fixture tiene múltiples nodos COLOR (ej. fan con 8 pétalos), solo lee arbitrated values del primer nodo COLOR encontrado. Los pétalos adicionales son invisibles para la UI legacy.

---

## 6. Final Acquisition Score

### 6.1 Fortalezas verificables

1. **NodeGraph con dense arrays + multi-índices:** Data-oriented design genuino. O(1) lookups, iteración cache-friendly, swap-and-pop eficiente.
2. **Agnosticidad efectiva:** El ColorSystem emite r/g/b abstractos sin saber del hardware. La traducción física ocurre solo en el NodeResolver.
3. **Forge Evaluator:** Opcode dispatch con propagación inmediata de edges. Kahn's topological sort en compile-time. Genuinamente zero-alloc en ejecución.
4. **9 Zonas Canónicas:** Diseño elegante que cubre el vocabulario espacial completo del lighting profesional. Legacy alias normalization muestra madurez de migración.
5. **DarkSpin + Cross-node sweep:** Innovación real. Protección mecánica de ruedas de colores con blackout transit que cruza familias (COLOR → IMPACT).
6. **Split-brain gatekeeper IK/Classic:** Decisión por frame basada en presencia de `targetX`. Sin flags persistentes. Robusto ante cambios de capa.
7. **AetherUIProjector:** Bridge limpio hacia el mundo legacy. Zero-alloc, mutación in-place.

### 6.2 Debilidades críticas

1. **`_translateColor` NO es zero-alloc.** Crea objetos literales con spread en cada frame. El claim es falso.
2. **Copia Uint8Array → number[] en `resolve()`** por cada universo activo, en cada frame.
3. **Forge bypass sin boundary check.** Un grafo malicioso puede escribir fuera del rango del device.
4. **Pixel mapping es aspiracional.** El rol `'pixel'` existe pero no hay motor.
5. **SpatialRegistrar.updateDevicePosition()** hace unregister/register completo en vez de actualización incremental.
6. **Telemetría residual en hot path** (`_t36probe`, logs IK) que ejecuta en producción.

### 6.3 Puntaje técnico final

**Puntaje técnico: 7.8/10**

| Subsistema | Puntaje | Notas |
|---|---|---|
| NodeGraph (dense arrays, índices, vistas) | 9.0/10 | Data-oriented design ejecutado con rigor. Solo penaliza rebuild completo en cada register/unregister. |
| Abstracción Agnóstica (DMX decoupling) | 8.0/10 | Efectiva en la dirección efectos→DMX. Consciente del hardware en la dirección inversa, lo cual es correcto. |
| NodeResolver (traducción + calibración) | 6.5/10 | Zero-alloc parcial. `_translateColor` miente. Copia buffer innecesaria. Pero IK integration y DarkSpin son excelentes. |
| Forge Evaluator (opcode dispatch) | 9.0/10 | Genuinamente zero-alloc. Topological sort. Edge propagation inmediata. Solo penaliza por safety sweep afterthought. |
| 9 Zonas Canónicas + Spatial Routing | 8.5/10 | Diseño elegante con legacy aliases. Penaliza por promedios no ponderados en zonas compuestas. |
| Pixel Mapping (future-proofing) | 4.0/10 | Tipos preparados, motor ausente. No es un bug, es un roadmap item no completado. |
| AetherSafetyMiddleware | 8.5/10 | Velocity clamp, airbag, DarkSpin, Smart Gate. Arquitectura de 3 fases limpia. |
| AetherUIProjector (legacy bridge) | 8.0/10 | Bridge de lectura limpio. Luminance-chrominance decoupling bien resuelto. |

### 6.4 Nota final

La Aether Matrix es **genuinamente sofisticada**. No es un wrapper superficial sobre DMX — es una re-arquitectura del dominio del lighting control en torno a capacidades semánticas, no canales físicos. El NodeGraph con dense arrays, los 9 índices O(1), y el IntentBus zero-alloc demuestran que alguien pensó en performance desde el diseño.

El **Forge Evaluator** es la joya de la corona: un motor de grafos de nodos compilado a bytecode plano (opcode table dispatch) que corre a 44Hz sin allocations. La integración con el NodeResolver como bypass total es audaz y funcionalmente correcta.

Pero el **NodeResolver.hot path tiene deuda**. `_translateColor` crea objetos en cada frame cuando debería ser zero-alloc. `resolve()` copia buffers en vez de pasarlos por referencia. Hay telemetría residual que ejecuta en producción. Son defectos pequeños pero en un motor de 44Hz, cada microsegundo cuenta.

La **preparación para pixel mapping es tipológica, no funcional**. El rol `'pixel'`, el `Position3D`, y el multi-emitter detection son la semilla correcta, pero no hay motor. Para un prospecto de adquisición, esto significa que la IP tiene "espacio de crecimiento" pero no "feature list extendida".

Para V1.0, las prioridades del core son:
1. **Hacer `_translateColor` realmente zero-alloc** (pre-allocated mutable object)
2. **Eliminar copia Uint8Array → number[]** (cambiar `IDMXPacket.channels` a `Uint8Array`)
3. **Boundary check en Forge bypass** (validar dmxOffsets en `registerForgeGraph`)
4. **Eliminar telemetría residual del hot path** (`_t36probe`, logs IK)
5. **Batch updates en SpatialRegistrar** (rebuild views solo al final de un batch de movimientos)

---

*Fin del informe. El corazón del sistema está sano. La arquitectura es elegante y la abstracción es real. Los defectos son de implementación, no de diseño.*
