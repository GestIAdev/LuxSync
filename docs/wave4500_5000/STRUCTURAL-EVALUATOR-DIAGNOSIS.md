# STRUCTURAL-EVALUATOR-DIAGNOSIS.md
## WAVE 4602 — THE STRUCTURAL FORENSICS
### Autopsia del agujero negro Arbiter → Resolver

**Fecha:** 2026-05-07  
**Rama:** v3  
**Clasificación:** LECTURA FORENSE — sin ejecución de código

---

## RESUMEN EJECUTIVO

La hipótesis del "agujero negro" está **CONFIRMADA**. El valor fotónico correcto producido por el `LiquidAetherAdapter` (TRACER-1: Dimmer ~13) llega íntegro al `NodeArbiter` (TRACER-2), pero **nunca pasa por el `ForgeNodeEvaluator` (TRACER-3)** y llega como **0 al DMX** (TRACER-4).

Hay **dos fallos estructurales independientes** que se combinan para producir el agujero negro. No hay uno solo, hay dos.

---

## VECTOR 1: EL ESLABÓN PERDIDO — La ruta exacta de la señal

### Pipeline completo (44 Hz)

```
LiquidAetherAdapter.ingest()     ← [TRACER-1] inyecta { dimmer: 0.05 } al IntentBus
        ↓
NodeArbiter.arbitrate()          ← [TRACER-2] produce { dimmer: 13 } (normalizado ~0.05)
        ↓
NodeResolver.resolve()           ← [TRACER-4] emite 0 al buffer DMX
```

### La caída a 0: `_writeNode()` en NodeResolver.ts (líneas ~474-530)

El flujo legacy de `_writeNode` busca el valor del canal con:

```typescript
const rawNormalized: number = translatedValues[chDef.type] !== undefined
  ? translatedValues[chDef.type]
  : this._getDefaultNormalizedValue(node, chDef)
```

`chDef.type` para el canal dimmer es la string `"dimmer"`.  
`translatedValues` es el `channelValues` del `ArbitratedNodeMap`, que **sí contiene** `{ dimmer: ~0.05 }`.

**Entonces la señal debería pasarse. ¿Por qué es 0?**

### La respuesta: `IMPACT_TRANSFER_CURVE` con `noiseGate: 0.02`

En `NodeExtractionPipeline.ts`, todos los nodos IMPACT tienen como constraint:

```typescript
const IMPACT_TRANSFER_CURVE: TransferCurve = {
  type:      'exponential',
  exponent:  2.5,
  noiseGate: 0.02,
}
```

Y en `NodeResolver._applyTransferCurve()`:

```typescript
if (curve.noiseGate && value < curve.noiseGate) return 0
```

Luego: `Math.pow(value, 2.5)`.

El valor que viene del LiquidEngine en los frames problemáticos es frecuentemente **muy bajo** (ej. `13/255 ≈ 0.051`). Pasada la curva exponencial con `exponent: 2.5`:

```
0.051 ^ 2.5 ≈ 0.000586 → round(0.000586 × 255) = 0
```

O si cae por debajo del `noiseGate: 0.02` (ej. cuando el Liquid emite 3..4/255 ≈ 0.012-0.016):

```
0.012 < 0.02 → _applyTransferCurve() retorna 0 → DMX = 0
```

**Esta es la línea exacta donde el valor 13 se convierte en 0** (o en valores mínimos que `Math.round()` colapsa a 0):

```
NodeResolver.ts, _applyTransferCurve(), línea ~871:
  if (curve.noiseGate && value < curve.noiseGate) return 0
```

Seguida de:
```
NodeResolver.ts, línea ~874:
  case 'exponential':
    return Math.pow(value, curve.exponent ?? 2.5)
```

### Pero el TRACER-2 muestra valores más altos (ej. 42, 60, 52...)

Correcto. El TRACER-2 mostraba valores altos **en ciertos frames** pero el TRACER-4 era 0. Esto ocurre porque el TRACER-4 lee el byte DMX del **primer nodo del frame actual** que puede corresponder a un nodo diferente al fixture 0, y porque los frames en los que TRACER-2 es alto no coinciden siempre con los frames en los que TRACER-4 se ejecuta (ambos tienen `% PHOTON_TRACER_EVERY_FRAMES === 0` pero con contadores de frame **independientes**).

Además, el TRACER-2 reporta el primer nodo en el `ArbitratedNodeMap`, mientras que el TRACER-4 busca el primer nodo en orden `IMPACT → COLOR → KINETIC → BEAM → ATMOSPHERE` en el NodeGraph. **Si no son el mismo fixture, los valores trazados no son comparables**.

---

## VECTOR 2: EL MISTERIO DEL TRACER-3 — El Evaluador ignorado

### Dónde está el TRACER-3

El `console.log` del TRACER-3 está en:
```
electron-app/src/core/forge/evaluator/ForgeNodeEvaluator.ts, línea 161
```

Se ejecuta **solo si `baseAddr === 0`** y solo dentro de `ForgeNodeEvaluator.evaluate()`.

### Por qué no se ejecuta: la puerta de entrada nunca se abre

En `NodeResolver._writeNode()` (línea ~396):

```typescript
const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(compiled, channelValues, ...)
  ...
  return  // BYPASS: no ejecutar flujo legacy
}
```

Para que el TRACER-3 aparezca, el `DeviceId` del fixture debe tener un `CompiledForgeGraph` registrado en `_forgeGraphs`.

### La causa raíz: `_syncFixturesToAether` nunca pasa `forgeGraph`

En `TitanOrchestrator.ts`, línea 2624:

```typescript
this.registerAetherDevice(deviceDef)
//  ↑ SIN forgeGraph — segundo argumento ausente
```

`registerAetherDevice(definition, forgeGraph?)` tiene el `forgeGraph` como opcional. La rama de compilación Forge:

```typescript
if (forgeGraph && forgeGraph.nodes.length > 0) {
  const compiled = ForgeGraphCompiler.compile(forgeGraph, definition.deviceId)
  resolver.registerForgeGraph(definition.deviceId, compiled)
}
```

**Nunca se ejecuta** porque `forgeGraph` siempre es `undefined` en el contexto de `_syncFixturesToAether`. Los fixtures del show file cargado (`6testNUEVO.v2.luxshow`) **no tienen `nodeGraph`** en su `FixtureDefinition` (son perfiles legacy sin grafo Forge).

**Conclusión:** El TRACER-3 no apareció porque el `ForgeNodeEvaluator` **es completamente ignorado** para todos los fixtures cargados. 100% de los frames van al flujo legacy. El Forge es una capacidad disponible pero que requiere que el show file o la librería de perfiles incluya un `IForgeNodeGraph` asociado al fixture.

---

## VECTOR 3: LA SOLUCIÓN ARQUITECTÓNICA

### El problema raíz en términos de diseño

Hay una **asimetría semántica** entre lo que el `LiquidEngine` produce y lo que el `NodeResolver` espera:

1. **LiquidEngine** trabaja con valores de **intensidad bruta** reactivos al audio: puede oscilar en rangos bajos (3..20/255) durante transiciones o partes instrumentales suaves.

2. **NodeResolver** aplica `IMPACT_TRANSFER_CURVE` (exponencial γ=2.5, noiseGate=0.02) sobre esos valores, asumiendo que los valores bajos son "ruido" y no señal intencionada.

El resultado: el motor líquido no tiene control sobre la curva de transferencia que destruye su señal.

### Rutas correctas (no soluciones rápidas)

#### RUTA A — Ajuste de `IMPACT_TRANSFER_CURVE` (mínimo impacto)

Reducir el `noiseGate` y el `exponent` de la curva IMPACT en `NodeExtractionPipeline.ts`:

```typescript
const IMPACT_TRANSFER_CURVE: TransferCurve = {
  type:      'exponential',
  exponent:  1.5,   // era 2.5 — menos agresivo
  noiseGate: 0.005, // era 0.02 — umbral más bajo
}
```

Pro: mínimo cambio, no toca la arquitectura.  
Con: todos los nodos IMPACT del sistema comparten esta curva. Cambiarla afecta la respuesta táctil del sistema.

#### RUTA B — `TransferCurve` por fuente (architectónicamente correcta)

El `LiquidAetherAdapter` opera como fuente L0 (base). Sus intents deben fluir **sin curva de transferencia** hacia el DMX — la curva ya la aplicó el LiquidEngine internamente (AGC, morphFactor, etc.).

La solución correcta: el `INodeIntent` de L0 debería poder **marcar sus valores como ya procesados** (`alreadyCurved: true`), y el `NodeResolver` respetaría ese flag saltándose `_applyTransferCurve()` para esos valores.

O bien, el IMPACT node podría tener **dos curvas diferentes** por capa: una para el input L0 (lineal) y otra para los inputs L1+ (exponencial). Esto requiere que el `ArbitratedNodeMap` incluya metadata de origen.

#### RUTA C — Canal dedicado sin curva (más limpia si el scope lo permite)

Que el `LiquidAetherAdapter` emita un canal `dimmer_raw` en lugar de `dimmer`. El `NodeResolver` trataría `dimmer_raw` como linear, sin pasar por `_applyTransferCurve`. El canal `dimmer` se reserva para L2+ (manual/effects). El `NodeExtractionPipeline` genera ambos canales en el `IImpactNodeData`.

#### RUTA D — Ajuste de escala en el `LiquidAetherAdapter` (ruta emergencia)

El LiquidAetherAdapter podría compensar la curva exponencial aplicando la **inversa** antes de emitir al bus:

```typescript
// Inversa de pow(x, 2.5): x^(1/2.5) = x^0.4
const corrected = Math.pow(zoneIntensity * falloff, 0.4)
this._impactValues['dimmer'] = clamp01(corrected)
```

Esto es un hack matemático — la curva del Resolver deshace exactamente lo que el Adapter aplicó. Pero es una forma de mantener la arquitectura intacta con coste mínimo.

---

## MAPA DE ARCHIVOS IMPLICADOS

| Archivo | Rol | Línea crítica |
|---|---|---|
| `adapters/LiquidAetherAdapter.ts` | Genera intent L0 `{ dimmer: X }` | L241-251 |
| `NodeArbiter.ts` | Produce ArbitratedNodeMap con dimmer correcto | L200-280 |
| `ingestion/NodeExtractionPipeline.ts` | Define `IMPACT_TRANSFER_CURVE` con gamma=2.5 y noiseGate=0.02 | L130-137 |
| `resolver/NodeResolver.ts` | `_applyTransferCurve()` colapsa valores bajos a 0 | ~871 |
| `resolver/NodeResolver.ts` | `_writeNode()` — Forge bypass precede al flujo legacy | ~396 |
| `forge/evaluator/ForgeNodeEvaluator.ts` | TRACER-3 — solo accesible con fixture que tenga Forge graph | L161 |
| `orchestrator/TitanOrchestrator.ts` | `_syncFixturesToAether` nunca pasa `forgeGraph` | L2624 |

---

## DIAGNÓSTICO FINAL

```
FALLO 1 (señal destruida):
  LiquidEngine emite dimmer ≈ 0.05
  → NodeResolver._applyTransferCurve(0.05, EXPONENTIAL γ=2.5)
  → 0.05^2.5 ≈ 0.000586
  → Math.round(0.000586 × 255) = 0
  → DMX = 0 ✗

FALLO 2 (diagnóstico ciego):
  _syncFixturesToAether() → registerAetherDevice(deviceDef)
  // forgeGraph = undefined → _forgeGraphs.get(id) = undefined
  // ForgeNodeEvaluator nunca se llama
  // TRACER-3 nunca aparece — el Forge es invisible en producción
```

**No hay bugs de enrutamiento.** La señal llega correctamente al Arbiter. El Resolver la recibe correctamente. La mata la curva exponencial diseñada para fixtures de iluminación teatral donde los valores bajos realmente son ruido. Para el motor líquido reactivo al audio, esos valores bajos son **señal válida**.

---

*Autopsia completada — WAVE 4602 — PunkOpus*
