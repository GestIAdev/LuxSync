# 🔬 WAVE 4635 — DOWNSTREAM FORENSICS: THE STATIC CEILING (REV 2)

**Objetivo:** Rastrear el flujo pan/tilt desde el NodeArbiter hasta el buffer DMX para identificar qué componente fuerza el valor 0.5 (DMX 128).

**Metodología:** Análisis estático (read-only) de NodeArbiter, PhysicsPostProcessor, NodeResolver, IntentBus, KineticAdapter y ProgrammerAetherBridge.

**Fecha:** 2026-05-08

---

## ⚡ VEREDICTO EJECUTIVO

El pipeline L0 es correcto: **KineticAdapter emite pan/tilt válidos (0-1)**. El NodeArbiter los recibe. La fuga ocurre entre el ArbitratedNodeMap y el NodeResolver, **enmascarada por una telaraña de defaults** que convierte CUALQUIER fallo upstream en exactamente 0.5 (DMX 128).

**Causa raíz más probable:** Los valores pan/tilt del VMM llegan como `NaN` (o nunca llegan al entry), y dos capas consecutivas de fallback a 0.5 ocultan el problema.

---

## 🔍 VECTOR 1 — EL SECUESTRO L2 (NodeArbiter)

**Archivo:** `src/core/aether/NodeArbiter.ts` (líneas 52-351)

### Hallazgo: L2 NO es el culpable primario, pero puede secuestrar por targetX

**Estructura:**
- `_manualOverrides` (línea 63) es un `Map<NodeId, Record<string, number>>` persistente.
- `setManualOverride()` (línea 116) inyecta sin transformación.
- En `arbitrate()` (línea 203-215), L2 se aplica con escritura directa `record[key] = channels[key]` después de L0/L1/L3/LP.

**Inicialización L2:**
- `programmerStore.createEmptyOverrides()` (línea 158-181) inicializa **todo a `null`** (`pan: null`, `tilt: null`, `targetX: null`, ...).
- `ProgrammerAetherBridge.extractKinetic()` (línea 70-83) solo emite keys con valor no-null.
- Si no hay overrides activos, el bridge envía `clearNodeIds` → `arbiter.clearManualOverride(nodeId)`.

**Veredicto:** No hay auto-inyección de 0.5 al arrancar. **L2 es inocente a menos que haya un override manual persistente** (ej. usuario usó XYPad y no liberó).

### ⚠️ PERO — El Secuestro Espacial (targetX en L2)

Si la UI alguna vez envió un override spatial (`targetX/Y/Z`) vía `SpatialTargetPad` o `setSpatialPosition()`, L2 contendrá `targetX=2.0` (ejemplo). Esto activa:
- `PhysicsPostProcessor` línea 319: `entry['targetX'] !== undefined` → **entra a rama 3D, ignora pan/tilt de L0**.
- `NodeResolver` línea 420: `hasSpatialTarget = true` → **entra a `_writeNodeIK`, ignora pan/tilt de L0**.

**Veredicto Vector 1:** Si hay un override spatial fantasma en L2, es **CULPABLE DIRECTO**. Si no hay override L2, L2 es inocente.

---

## 🔍 VECTOR 2 — EL ESTRANGULADOR (PhysicsPostProcessor)

**Archivo:** `src/core/aether/resolver/PhysicsPostProcessor.ts` (líneas 235-661)

### Hallazgo: COMPLICE — Fallback agresivo a 0.5 que enmascara fallos upstream

**La Trampa del `?? 0.5`:**
```typescript
// PhysicsPostProcessor.ts:388-390
this._panTarget  = entry['pan']  ?? 0.5
this._tiltTarget = entry['tilt'] ?? 0.5
```

Si `entry['pan']` o `entry['tilt']` son `undefined` (no presentes en el ArbitratedNodeMap), el PhysicsPostProcessor **inmediatamente fija el target a 0.5** y luego escribe `entry['pan'] = state[SLOT_PAN_POS]` (que también es 0.5 en inicialización).

**La Trampa del NaN:**
```typescript
// PhysicsPostProcessor.ts:392-394
if (!isFinite(this._panTarget))  this._panTarget  = state[SLOT_PAN_POS]
if (!isFinite(this._tiltTarget)) this._tiltTarget = state[SLOT_TILT_POS]
```

Si el valor llega como `NaN` (ej. VMM output corrupto), el PhysicsPostProcessor **usa el estado anterior**. El estado inicial es:
```typescript
// PhysicsPostProcessor.ts:440-443 (registerNode)
state[SLOT_PAN_POS]  = 0.5
state[SLOT_TILT_POS] = 0.5
```

**Resultado:** Cualquier `NaN` upstream se convierte silenciosamente en **0.5**.

**La Trampa del Teleport:**
```typescript
// PhysicsPostProcessor.ts:646-647
const panT  = isFinite(entry['pan']  ?? NaN) ? (entry['pan']  ?? 0.5) : state[SLOT_PAN_POS]
const tiltT = isFinite(entry['tilt'] ?? NaN) ? (entry['tilt'] ?? 0.5) : state[SLOT_TILT_POS]
```

En modo teleport (`deltaMs > 200ms`), si `entry['pan']` es `undefined`, se fuerza a **0.5**.

### Veredicto Vector 2

El PhysicsPostProcessor es **CÓMPLICE NECESARIO**. No es el origen del fallo, pero su telaraña de defaults (`?? 0.5` + estado inicial 0.5) convierte cualquier fallo upstream (undefined, NaN, o missing keys) en exactamente el síntoma observado: **DMX 128 / 0.5**.

---

## 🔍 VECTOR 3 — EL DROP DEL RESOLVER (NodeResolver)

**Archivo:** `src/core/aether/resolver/NodeResolver.ts` (líneas 147-999)

### Hallazgo: COMPLICE — DefaultValue/255 es la bala de plata que mata el síntoma

**La Trampa del Default:**
```typescript
// NodeResolver.ts:461-463
const rawNormalized: number = translatedValues[chDef.type] !== undefined
  ? translatedValues[chDef.type]
  : this._getDefaultNormalizedValue(node, chDef)

// NodeResolver.ts:628-644
_getDefaultNormalizedValue(node, chDef) {
  return chDef.defaultValue / 255
}
```

Si `channelValues['pan']` es `undefined` (no está en el ArbitratedNodeMap), el NodeResolver usa `chDef.defaultValue / 255`. Para la inmensa mayoría de fixtures de moving head, `defaultValue` es **128** (home/center). **128/255 = 0.50196**.

**Esto explica EXACTAMENTE** por qué las luces apuntan al techo: el valor default del fixture es el centro del rango (128), que para fixtures ceiling-mounted con tilt invertido se visualiza como "al techo".

**Rama IK (Gatekeeper):**
```typescript
// NodeResolver.ts:419-424
const hasSpatialTarget = channelValues[CH_TARGET_X] !== undefined
if (!kineticNode.isContinuous && hasSpatialTarget) {
  this._writeNodeIK(kineticNode, channelValues, baseAddr, buf, calibration, writeToDmx)
  return
}
```

El gatekeeper es correcto: `targetX = undefined` no activa la rama IK. Pero si `targetX` es un número (por override L2 spatial), la rama IK se activa y pan/tilt de L0 se ignoran.

### Veredicto Vector 3

El NodeResolver es funcionalmente correcto en su rama clásica, pero tiene un **fallback letal a defaultValue/255** que convierte cualquier "missing key" en exactamente 0.5. Si el VMM no llega, el fixture se queda en home.

---

## 🎯 HIPÓTESIS DEFINITIVA

### Causa Raíz Probable: "NaN Silencioso del VMM"

El pipeline es correcto en papel. La combinación de tres capas de fallback a 0.5 oculta que **los valores pan/tilt del VMM nunca llegan válidos al PhysicsPostProcessor**.

**Cadena de fallo hipotética:**

1. **VMM `calculateEffectiveAmplitude`** (`VibeMovementManager.ts:924-965`):
   ```typescript
   const requestedTravel = 255 * requestedAmplitude
   const gearboxFactor = Math.min(1.0, maxTravelPerCycle / requestedTravel)
   ```
   Si `requestedAmplitude = 0`, `requestedTravel = 0`, y `maxTravelPerCycle / 0 = Infinity`. `Math.min(1.0, Infinity) = 1.0`. OK.
   
   PERO: si `audio.energy` es `NaN` (raro, pero posible si el audio worker envía un valor corrupto), `energyBoost = NaN`, `requestedAmplitude = NaN`, `requestedTravel = NaN`, `gearboxFactor = NaN`, y el return es `Math.min(1.0, Math.max(0.10, NaN))` = **NaN**.

2. **VMM `generateIntent`** (`VibeMovementManager.ts:626-898`):
   ```typescript
   const finalAmplitude = effectiveAmplitude * clampedEnvelope  // NaN * number = NaN
   const position = {
     x: Math.max(-1, Math.min(1, rawPosition.x * finalAmplitude)),  // NaN
     y: Math.max(-1, Math.min(1, (rawPosition.y * finalAmplitude) + tiltOffset)),  // NaN
   }
   ```
   Retorna `{ x: NaN, y: NaN, ... }`.

3. **KineticAdapter** (`KineticAdapter.ts:203-204`):
   ```typescript
   this._valuesDict['pan']  = BaseSystem.clamp01((intent.x + 1) * 0.5)  // NaN
   this._valuesDict['tilt'] = BaseSystem.clamp01((intent.y + 1) * 0.5)  // NaN
   ```
   `clamp01(NaN)` = `NaN` (porque `NaN < 0` es false, `NaN > 1` es false, retorna `NaN`).

4. **IntentBus + NodeArbiter** propagan `NaN` correctamente hasta el ArbitratedNodeMap.

5. **PhysicsPostProcessor** (`PhysicsPostProcessor.ts:388-394`):
   ```typescript
   this._panTarget  = entry['pan']  ?? 0.5   // NaN (no es undefined, así que no usa ??)
   if (!isFinite(this._panTarget)) this._panTarget = state[SLOT_PAN_POS]  // 0.5
   ```
   Convierte NaN → 0.5.

6. **NodeResolver** recibe 0.5, lo escribe en DMX. Las luces apuntan al techo.

### Alternativa: L2 Spatial Override Fantasma

Si el usuario alguna vez usó `SpatialTargetPad` y el override `targetX/Y/Z` persistió en L2, el gatekeeper del NodeResolver entra a IK. El IK resuelve pan/tilt para la posición 3D del override. Si la posición es (0, 2, 0), el resultado puede ser ~128/128 (0.5), especialmente para fixtures no posicionados (`isPlaced = false`).

### Alternativa: IntentBus Overflow

Si `_aetherBus.push()` retorna `false` (overflow, `_writeHead >= capacity`), el intent se descarta. El nodo no aparece en el ArbitratedNodeMap. El NodeResolver usa defaults → 0.5. Pero `DEFAULT_CAPACITY = 4096`, y un show típico tiene <100 nodos kinetic. Muy improbable.

---

## 🔧 RECOMENDACIÓN: Telemetría Forense de 3 Puntos

Para confirmar el culpable exacto, añadir (temporalmente) logs en el hot path:

**Punto A — KineticAdapter Salida (`KineticAdapter.ts:209`):**
```typescript
if (node.nodeId === 'TRACE_FIXTURE_ID') {
  console.log(`[WAVE-4635-A] node=${node.nodeId} pan=${this._valuesDict['pan']} tilt=${this._valuesDict['tilt']} isFinite=${isFinite(this._valuesDict['pan'])}`)
}
```

**Punto B — NodeArbiter Entrada (`NodeArbiter.ts:179`):**
```typescript
if (all[i].nodeId === 'TRACE_FIXTURE_ID:kinetic') {
  console.log(`[WAVE-4635-B] L0 intent node=${all[i].nodeId} pan=${all[i].values['pan']} tilt=${all[i].values['tilt']}`)
}
```

**Punto C — PhysicsPostProcessor Decisión (`PhysicsPostProcessor.ts:308`):**
```typescript
if (node.nodeId === 'TRACE_FIXTURE_ID:kinetic') {
  console.log(`[WAVE-4635-C] entry pan=${entry['pan']} tilt=${entry['tilt']} targetX=${entry['targetX']} hasTargetX=${entry['targetX'] !== undefined}`)
}
```

**Interpretación:**
- Si **A** muestra `pan=NaN` → **Culpable: VMM/AudioContext** (NaN silencioso).
- Si **A** es válido pero **B** no lo recibe → **Culpable: IntentBus/NodeArbiter._applyIntent**.
- Si **B** es válido pero **C** muestra `pan=undefined` o `pan=0.5` → **Culpable: PhysicsPostProcessor** (undefined pollution o NaN).
- Si **C** muestra `targetX=2.0` (número) → **Culpable: L2 Spatial Override fantasma** (Secuestro espacial).

---

## 📝 RESUMEN DE CULPABILIDAD

| Componente | Rol en el crimen | Veredicto |
|---|---|---|
| **KineticAdapter (L0)** | Emite pan/tilt correctamente. Inocente. | ✅ INOCENTE |
| **IntentBus** | Propaga intents sin mutación. Inocente. | ✅ INOCENTE |
| **NodeArbiter (L2)** | Puede secuestrar por targetX, pero no inyecta 0.5 auto. | ⚠️ CÓMPLICE (solo si hay override) |
| **PhysicsPostProcessor** | `?? 0.5` + estado inicial 0.5 enmascaran NaN/undefined. | 🔴 CÓMPLICE PRINCIPAL |
| **NodeResolver** | DefaultValue/255 = 0.5 mata cualquier missing key. | 🔴 CÓMPLICE PRINCIPAL |
| **VMM (AudioContext)** | Posible origen de NaN si energy/bpm es corrupto. | ❓ PROBABLE CULPABLE RAÍZ |
| **L2 Spatial Override** | Si persiste, secuestra todo a IK. | ❓ CULPABLE ALTERNATIVO |

