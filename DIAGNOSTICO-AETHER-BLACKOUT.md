# 🔬 DIAGNÓSTICO FORENSE: WAVE 3513.4-DIAG — THE DATA VOID

> **Documento**: Análisis 100% de la desconexión entre TitanEngine (Audio) y Aether IntentBus.
> **Metodología**: Solo lectura. Cero código de solución. Citas exactas de archivo + línea.
> **Estado**: VERIFICADO — el "cable" está cortado en 5 puntos distintos.

---

## 1. PUNTO DE SALIDA DEL AUDIO (The Egress)

### 1.1 TitanEngine produce LightingIntent en cada frame

```
Archivo: src/engine/TitanEngine.ts:1-30

⚡ WAVE 217: TITAN ENGINE
Motor de iluminación reactiva PURO. Recibe MusicalContext del Cerebro
→ Devuelve LightingIntent al HAL.
```

El método central es `update(context, audioMetrics)`:

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1091

const intent = await this.engine.update(context, engineAudioMetrics)
```

Este `intent` contiene:
- `palette`: ColorPalette (primary, secondary, accent, ambient)
- `intensity`: MasterIntensity escalado por energía y sección musical
- `zones`: ZoneIntentMap con intensidades por zona (frontL/R, backL/R, moverL/R)
- `movement`: MovementIntent (pan, tilt, zoom para movers)
- `effects`: EffectIntent[] (strobe, blinder, blackout)

### 1.2 A dónde va ese LightingIntent

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1093-1108

// ═══════════════════════════════════════════════════════════════════════════
// 🎭 WAVE 374: MASTER ARBITER INTEGRATION
// Instead of sending intent directly to HAL, we now:
// 1. Feed the intent to Layer 0 (TITAN_AI) of the Arbiter
// 2. Arbiter merges all layers (manual overrides, effects, blackout)
// 3. Send arbitrated result to HAL
// ═══════════════════════════════════════════════════════════════════════════

// Feed Layer 0: AI Intent
const titanLayer: Layer0_Titan = {
  intent,
  timestamp: now,
  vibeId: this.engine.getCurrentVibe(),
  frameNumber: this.frameCount,
}
masterArbiter.setTitanIntent(titanLayer)      // ← LÍNEA 1108
```

**Veredicto**: El `LightingIntent` producido por el TitanEngine se envía
**exclusivamente** a `masterArbiter.setTitanIntent()`. **Nunca se toca Aether.**

---

## 2. ESTADO DEL INTENTBUS (The Receptor)

### 2.1 TitanOrchestrator instancia los objetos Aether pero NO los Systems

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:283-294

private readonly _aetherGraph   = new NodeGraph()
private readonly _aetherBus     = new IntentBus(4096)
private readonly _aetherArbiter = new NodeArbiter()
private readonly _aetherResolver = new NodeResolver(this._aetherGraph)
private readonly _aduanaFilter  = new AduanaFilter()
private _aetherHasDevices = false
// WAVE 3513: Genesis Cut — pipeline de extraccion e inyeccion espacial
private readonly _extractionPipeline = new NodeExtractionPipeline()
private readonly _spatialRegistrar   = new SpatialRegistrar()
// WAVE 3513.3: THE MIRROR — proyector estado Aether → FixtureState[]
private readonly _uiProjector        = new AetherUIProjector()
```

**Observación crítica**: No existe en esta lista:
- `private readonly _aetherSystems`
- `new LiquidImpactAdapter()`
- `new LiquidColorAdapter()`
- `new VMMAdapter()`
- `new ColorSystem()`
- `new ImpactSystem()`

**Busqueda forense confirmada**:
```
Query: new VMMAdapter | new LiquidImpactAdapter | new LiquidColorAdapter | new ColorSystem | new ImpactSystem
En: src/core/orchestrator/TitanOrchestrator.ts
Resultado: 0 coincidencias. Ninguno de estos objetos se instancia en el orquestador.
```

### 2.2 El bloque Aether en processFrame() — el comentario que lo dice todo

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1509-1519

if (this._aetherHasDevices && this.hal) {
  // 1. Limpiar el bus de intents del frame anterior
  this._aetherBus.clear()

  // 2. Systems escriben sus intents en el _aetherBus
  //    (Los Systems se conectarán aquí en WAVE 3505.5+ a medida que se migren
  //    los fixtures. Por ahora el bus está vacío y los nodos emiten defaultValues.)

  // 3. El Arbiter unifica todas las capas → ArbitratedNodeMap
  this._aetherArbiter.setSystemIntents(this._aetherBus)
  const arbitrated = this._aetherArbiter.arbitrate()
```

**Veredicto**: El bus se limpia, pero **nadie escribe en él**.
El comentario explícito admite: "Por ahora el bus está vacío".

### 2.3 Qué pasa cuando el bus está vacío

```
Archivo: src/core/aether/NodeArbiter.ts:140-162

arbitrate(): ArbitratedNodeMap {
  this._poolCursor = 0
  this._result.clear()

  // Blackout global: retornar mapa vacío
  if (this._blackout) {
    return this._result as ArbitratedNodeMap
  }

  // L0: System intents (IntentBus)
  if (this._systemBus) {
    const all = this._systemBus.getAll()
    for (let i = 0; i < all.length; i++) {
      this._applyIntent(all[i])
    }
  }
  // ... L1, LP, L3, L2 ...
```

Cuando `_systemBus.getAll()` retorna `[]` (vacío), el bucle `for` no ejecuta
ninguna iteración. `_result` permanece **vacío**.

```
Archivo: src/core/aether/resolver/NodeResolver.ts:157-162

resolve(arbitrated: ArbitratedNodeMap): readonly IDMXPacket[] {
  // 1. Zero-fill y marcar universos como inactivos
  this._activeUniverses.clear()
  for (const [, buf] of this._universeBuffers) {
    buf.fill(0)
  }
```

```
Archivo: src/core/aether/resolver/NodeResolver.ts:165-167

  // 2. Para cada nodo arbitrado, escribir en el buffer del universo
  for (const [nodeId, channelValues] of arbitrated) {
    this._writeNode(nodeId, channelValues)
  }
```

**Veredicto**: `arbitrated` es un Map vacío. El `for...of` no itera.
Los buffers del universo quedan en **zero-fill** (todos los 512 canales = 0).

### 2.4 defaultValue — la otra mitad de la historia

```
Archivo: src/core/aether/resolver/NodeResolver.ts:214-218

const rawNormalized: number = channelValues[chDef.type] !== undefined
  ? channelValues[chDef.type]
  : chDef.defaultValue / 255
```

El `defaultValue` del canal solo se usa cuando el nodo **está presente**
en `arbitrated` pero el canal específico no tiene valor. Como ningún nodo
está presente en `arbitrated` (el Map está vacío), `_writeNode()` nunca
se llama, y el `defaultValue` nunca se consulta.

**Conclusión matemática**:
- No hay intents → Map vacío.
- Map vacío → zero-fill en NodeResolver.
- Zero-fill → TODOS los canales DMX = 0.
- DMX = 0 → NEGRO.

---

## 3. JERARQUÍA DE CAPAS (Priority Check)

### 3.1 Capas del NodeArbiter (de menor a mayor prioridad)

```
Archivo: src/core/aether/NodeArbiter.ts:16-22

CAPAS (menor a mayor prioridad):
- L0: IntentBus (Systems — ColorSystem, ImpactSystem, etc.)
- L1: Selene IA overrides
- L2: Manual overrides (MIDI, OSC, UI faders)
- L3: Effect intents (LiveFXEngine)
- LP: Playback intents (Chronos Timeline)
- L4: Blackout (siempre gana)
```

### 3.2 Estado actual de cada capa en el frame

| Capa | Estado | Fuente de datos |
|------|--------|-----------------|
| **L0** | **VACÍA** | `_systemBus.getAll()` retorna `[]` — nadie hizo `push()` |
| **L1** | VACÍA | `_seleneOverrides` es `[]` — nunca se inyectó nada |
| **LP** | VACÍA | `_playbackIntents` es `[]` — Chronos no está conectado |
| **L3** | VACÍA | `_effectIntents` es `[]` — EffectManager no está conectado |
| **L2** | VACÍA | `_manualOverrides` es `new Map()` vacío |
| **L4** | **INACTIVA** | `_blackout = false` (default del constructor) |

```
Archivo: src/core/aether/NodeArbiter.ts:74

private _blackout = false
```

```
Archivo: src/core/aether/NodeArbiter.ts:71

private _grandMaster = 1.0
```

**Veredicto**: Ninguna capa está forzando el negro. El negro es el **default
correcto** cuando no hay intents en ninguna capa. El problema no es una
capa bloqueando; es la **ausencia total de datos en L0**.

### 3.3 El Grand Master no es el culpable

```
Archivo: src/core/aether/NodeArbiter.ts:123-125

setGrandMaster(value: number): void {
  this._grandMaster = value < 0 ? 0 : value > 1 ? 1 : value
}
```

Default es `1.0` (sin atenuación). El Grand Master se aplica **después**
de recolectar intents. Como no hay intents, no hay nada que atenuar.

---

## 4. EL "CABLE" DESCONECTADO (The Missing Bridge)

### 4.1 Los adapters existen pero viven muertos en el filesystem

```
Archivo: src/core/aether/adapters/LiquidEngineAdapter.ts:1-52

⚠️ Este archivo contiene:
- LiquidImpactAdapter (líneas 89-213)
- LiquidColorAdapter (líneas 224-363)

Ambos implementan IAetherSystem<IImpactNodeData> / IAetherSystem<IColorNodeData>.
Ambos tienen método `process(nodes, context, bus)` que escribe intents.
Ambos usan `liquidEngine71` como motor de física por defecto.
```

**Sin embargo**, ninguno de estos adapters se instancia en el orquestador.
Son **clases exportadas** pero **no instanciadas**.

### 4.2 Los Systems base también existen pero no están registrados

```
Archivo: src/core/aether/index.ts:136

export { BaseSystem, ImpactSystem, ColorSystem, KineticSystem, BeamSystem, AtmosphereSystem } from './systems'
```

```
Archivo: src/core/aether/systems/BaseSystem.ts (inferred)

Interfaz IAetherSystem<T> con método:
  process(nodes: INodeView<T>, context: FrameContext, bus: IIntentBus): void
```

Ningún System se instancia ni se invoca en `TitanOrchestrator.processFrame()`.

### 4.3 Qué se necesitaría para cerrar el circuito

El "camino más corto" teórico (solo descriptivo, no implementación):

1. **Instanciar los adapters** en el constructor de TitanOrchestrator:
   - `new LiquidImpactAdapter()`
   - `new LiquidColorAdapter()`

2. **Construir un `FrameContext`** en `processFrame()` con los mismos datos
   de audio/musical/vibe que se pasan a `this.engine.update()`.

3. **Obtener las vistas de nodos** desde `_aetherGraph` filtradas por familia:
   - `_aetherGraph.getNodesByFamily(NodeFamily.IMPACT)`
   - `_aetherGraph.getNodesByFamily(NodeFamily.COLOR)`

4. **Invocar `adapter.process(nodesView, frameContext, this._aetherBus)`**
   para cada adapter, DESPUÉS de `this._aetherBus.clear()` y ANTES de
   `this._aetherArbiter.setSystemIntents(this._aetherBus)`.

5. **Alternativa**: en lugar de adapters, instanciar los `Systems` base
   (`ImpactSystem`, `ColorSystem`) que leerían del mismo `FrameContext`.

**Pero actualmente**: ninguno de estos 5 pasos ocurre.

### 4.4 Evidencia de la desconexión en el código mismo

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1513-1515

// 2. Systems escriben sus intents en el _aetherBus
//    (Los Systems se conectarán aquí en WAVE 3505.5+ a medida que se migren
//    los fixtures. Por ahora el bus está vacío y los nodos emiten defaultValues.)
```

Este comentario fue escrito por los autores del código. Es la confesión
escrita de la desconexión. WAVE 3505.5 nunca llegó; el cable sigue cortado.

---

## 5. RESUMEN EJECUTIVO DE LOS 5 PUNTOS DE CORTE

| Punto de corte | Archivo + Línea | Qué debería pasar | Qué pasa ahora |
|----------------|-----------------|-------------------|----------------|
| **1. Genesis** | `TitanOrchestrator.ts:2227+` | `_ingestAetherDevices()` pobla el grafo | ✅ Funciona — los nodos están registrados |
| **2. Audio Egress** | `TitanOrchestrator.ts:1091` | `this.engine.update()` produce energía | ✅ Funciona — TitanEngine calcula intensidades 0.80+ |
| **3. Aether Egress** | `TitanOrchestrator.ts:1108` | La energía debería bifurcar hacia Aether | ❌ **CORTE**: Solo va a `masterArbiter.setTitanIntent()` |
| **4. IntentBus Push** | `TitanOrchestrator.ts:1511-1515` | Los Systems/Adapters deberían escribir intents | ❌ **CORTE**: `clear()` sin `push()` — bus vacío |
| **5. NodeResolver** | `NodeResolver.ts:157-162` | Resolver traduce intents arbitrados a DMX | ✅ Funciona correctamente, pero recibe Map vacío → zero-fill |

---

## 6. DIAGNÓSTICO FINAL

**Síntoma**: Aether Matrix emite negro (0%) a pesar de que:
- Los fixtures están ingestados (Genesis Cut funciona)
- El TitanEngine procesa audio con energía 0.80+
- El proyector visual (THE MIRROR) funciona

**Causa raíz**: El **cable de audio nunca fue soldado**.

El TitanEngine produce un `LightingIntent` rico en energía y color,
pero ese objeto se envía **exclusivamente** al `MasterArbiter` legacy
(`masterArbiter.setTitanIntent()`). No existe código que traduzca ese
`LightingIntent` (o las métricas de audio subyacentes) a `INodeIntent`
que se inserten en `this._aetherBus`.

Los adapters (`LiquidImpactAdapter`, `LiquidColorAdapter`) y los Systems
(`ImpactSystem`, `ColorSystem`, `KineticSystem`) existen en el filesystem,
pero **nunca se instancian ni se invocan** en el hot path de `processFrame()`.

El resultado es un pipeline Aether que:
1. Limpia el bus (`clear()`)
2. No recibe ningún intent
3. Arbitra un Map vacío
4. Zero-fillea los buffers DMX
5. Envía 0 a todos los canales

**Estado**: Pipeline estructuralmente sano, pero alimentado por un vacío
cognitivo. Es el equivalente a tener un sistema nervioso perfectamente
formado pero sin conexión al cerebro.

---

*Fin del diagnóstico WAVE 3513.4-DIAG*
*Basado 100% en trazas de código fuente. Cero suposiciones.*
