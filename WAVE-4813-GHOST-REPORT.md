# 👻 WAVE 4813 — THE V2 GHOSTS: Reporte Forense

## Hallazgo 1: El Fantasma del 128

### 🔴 CULPABLE PRINCIPAL: `NodeExtractionPipeline.ts` — Hardcodeo en `currentPosition.rotation`

**Línea exacta (ruta V2):**
```
@/electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:712-713
  currentPosition: isContinuous
    ? { pan: 0, tilt: 0, rotation: 0.5 }
    : { pan: 0.5, tilt: 0.5 },
```

**Línea exacta (ruta Legacy):**
```
@/electron-app/src/core/aether/ingestion/NodeExtractionPipeline.ts:972-974
  currentPosition: isContinuous
    ? { pan: 0, tilt: 0, rotation: 0.5 }
    : { pan: 0.5, tilt: 0.5 },
```

**Problema:** `_resolveDefaultValue` (línea 1137) y `_mapForgeNodes` (línea 607) **SÍ** respetan el `defaultValue` del JSON en la definición del canal. Pero el nodo KINETIC se construye con `currentPosition.rotation = 0.5` **hardcodeado**, ignorando por completo ese default. El JSON defaultValue muere en el canal, nunca llega al nodo.

### 🔴 CULPABLE SECUNDARIO: `KineticSystem.ts` — Sobrescritura frame a frame

**Línea exacta:**
```
@/electron-app/src/core/aether/systems/KineticSystem.ts:275
  const currentRotation = node.currentPosition.rotation ?? 0.5
```

**Línea exacta (idle pattern = home):**
```
@/electron-app/src/core/aether/systems/KineticSystem.ts:167-174
  let pan  = HOME_PAN   // = 0.5
  let tilt = HOME_TILT  // = 0.5
  switch (pattern) {
    case 0: // idle
      pan  = HOME_PAN
      tilt = HOME_TILT
```

**Problema:** El KineticSystem emite un intent L0 de `rotation` **cada frame**, incluso en patrón idle. Como `HOME_PAN = 0.5`, el fan recibe `rotation = 0.5` (= 128 DMX = stop) constantemente. El NodeArbiter (WAVE 4752) deja pasar este L0 porque no hay override L2 activo en `rotation`. El resultado: el JSON defaultValue=0 es pisado antes de que el resolver lo vea.

### 📋 DIAGNÓSTICO COMPLETO — Pipeline del 128

```
JSON fixture → FXTParser: defaultValue=0 (preservado)
    ↓
NodeExtractionPipeline._resolveDefaultValue(ch, kinetic)
  → typeof ch.defaultValue === 'number' → RETORNA 0 ✅
    ↓
INodeChannelDef.defaultValue = 0  ✅ (correcto en el canal)
    ↓
_buildNodesFromForgeGraph (o _buildKineticNode legacy)
  → currentPosition.rotation = 0.5  ❌ (hardcodeo que ignora el 0)
    ↓
KineticSystem.process() cada 22ms
  → pattern=idle → pan=HOME_PAN=0.5
  → isContinuous=true → rotation=limitedPan=0.5
  → bus.push({ rotation: 0.5 })  ❌ (pisa el 0 del JSON)
    ↓
NodeArbiter.arbitrate()
  → L0 pasa (no hay L2 en rotation) → _result[nodeId].rotation = 0.5
    ↓
NodeResolver._writeNode()
  → Escribe 0.5×255 = 128 en el buffer DMX del canal rotation
```

**Conclusión:** `_resolveDefaultValue` está bien. El defaultValue=0 **sí** existe en el canal. Pero `currentPosition` del nodo hardcodea 0.5, y KineticSystem lo propaga a DMX frame a frame.

### 🛠️ FIX RECOMENDADO

**Paso 1:** Inicializar `currentPosition.rotation` desde el primer canal `rotation` del nodo (V2 + Legacy):

```ts
// En _buildNodesFromForgeGraph y _buildKineticNode:
const rotationCh = channels.find(c => c.type === 'rotation')
const rotationHome = rotationCh
  ? rotationCh.defaultValue / 255   // normalizar 0-255 → 0-1
  : 0.5

// Para isContinuous:
currentPosition: { pan: 0, tilt: 0, rotation: rotationHome }
```

**Paso 2 (opcional):** En `KineticSystem`, cuando `pattern === 0` (idle) y `movementSpeed === 0`, NO emitir intent para `rotation`. Dejar que el resolver use el `defaultValue` del canal.

---

## Hallazgo 2: La Desconexión del Líquido (Ambient ≠ Sub-Grave)

### 🔴 CULPABLE PRINCIPAL: `LiquidEngineBase.ts` — Cubic Crush + Noise Gate matan subBass puro

**Línea exacta:**
```
@/electron-app/src/hal/physics/LiquidEngineBase.ts:607
  const ambientIntensity = _ambientCrushed < 0.15 ? 0.0 : _ambientCrushed
```

**Contexto (WAVE 4812 M2):** El `_ambientEMA` ahora se alimenta de `bands.subBass` puro (antes `bass×0.4 + mid×0.6`). Pero la curva `pow(x, 3.5)` y el noise-gate 0.15 fueron calibrados para el rango MIXTO, que alcanzaba valores más altos.

**La matemática del desastre:**

| subBass raw | `_ambientEMA` | `pow(EMA, 3.5)` | noise-gate 0.15 | `ambientIntensity` |
|-------------|-------------|-----------------|-----------------|-------------------|
| 0.20 | 0.20 | 0.0036 | < 0.15 | **0** |
| 0.40 | 0.40 | 0.040 | < 0.15 | **0** |
| 0.55 | 0.55 | 0.087 | < 0.15 | **0** |
| 0.65 | 0.65 | 0.181 | > 0.15 | **0.181** |
| 0.80 | 0.80 | 0.458 | > 0.15 | **0.458** |

**subBass en GodEarFFT normalizado raramente supera 0.5** (la banda subBass tiene mucha menos energía relativa que mid/treble en la normalización peak). El resultado: `ambientIntensity` pasa **casi todo el tiempo en 0**, incluso con reguetón pesado. El sub-grave nunca cruza el umbral de 0.15 después del cubic crush.

### 🟡 CULPABLE SECUNDARIO: `LiquidAetherAdapter.ts` — Early-exit a 0.005

**Línea exacta:**
```
@/electron-app/src/core/aether/adapters/LiquidAetherAdapter.ts:205
  if (zoneIntensity <= 0.005) return
```

**Problema:** Cuando `ambientIntensity` logra ser no-cero (ej: 0.018, que ocurre con subBass ~0.58), el `LiquidAetherAdapter` hace early-exit si `zoneIntensity <= 0.005`. En la práctica esto no es el bloqueador principal (el noise gate ya mata todo antes), pero refuerza la sordera.

### 🟢 NodeArbiter: INOCENTE

**Veredicto:** NodeArbiter (WAVE 4752) **NO** está bloqueando L0 para ambient.
- Smart Gate solo bloquea canales que L2/LP tocaron explícitamente.
- Sin manual override en `:impact` o `:color` de la zona ambient, L0 fluye libremente.
- `_manualDimmerFixtureIds` no aplica si el operador no tocó dimmer en esos fixtures.

### 📋 DIAGNÓSTICO COMPLETO — Pipeline del Ambient

```
GodEarFFT → bands.subBass = 0.25 (típico en reguetón)
    ↓
LiquidEngineBase._ambientEMA
  → _ambMix = 0.25 → EMA = 0.25  ✅
    ↓
_ambientRaw = 0.25
    ↓
pow(0.25, 3.5) = 0.0076
    ↓
noise-gate 0.15: 0.0076 < 0.15 → ambientIntensity = 0.0  ❌❌❌
    ↓
LiquidAetherAdapter.ingest()
  → selectZoneFromResult('ambient') → 0.0
  → if (zoneIntensity <= 0.005) return  → early-exit, no intent emitido
    ↓
NodeArbiter: no recibe intent L0 para nodos ambient
  → Resolver: no hay valor → cae a defaultValue del canal
  → Fixture: luz apagada o en default estático
```

### 🛠️ FIX RECOMENDADO

**Opción A (mínima):** Bajar el noise-gate de 0.15 a **0.02** para subBass-puro:

```ts
@/electron-app/src/hal/physics/LiquidEngineBase.ts:607
// WAVE 4813: noise-gate adaptativo según fuente de señal.
// Para subBass puro (valores típicos 0.1-0.4), el umbral debe ser más bajo.
const AMBIENT_NOISE_GATE = 0.02
const ambientIntensity = _ambientCrushed < AMBIENT_NOISE_GATE ? 0.0 : _ambientCrushed
```

Con noise-gate 0.02:
- subBass=0.20 → pow=0.0036 → **0** (aún apagado)
- subBass=0.35 → pow=0.022 → **0.022** ✅ (enciende)
- subBass=0.55 → pow=0.087 → **0.087** ✅ (brilla)

**Opción B (recomendada):** Reducir el exponente de `pow(x, 3.5)` a `pow(x, 2.0)` para ambient cuando la fuente es subBass:

```ts
const _ambientCrushed = Math.pow(_ambientRaw, 2.0)  // 0.5 → 0.25 (vs 0.088 antes)
const AMBIENT_NOISE_GATE = 0.03
const ambientIntensity = _ambientCrushed < AMBIENT_NOISE_GATE ? 0.0 : _ambientCrushed
```

Con exponente 2.0 + gate 0.03:
- subBass=0.25 → pow=0.062 → **0.062** ✅
- subBass=0.40 → pow=0.16 → **0.16** ✅
- subBass=0.60 → pow=0.36 → **0.36** ✅ (buen brillo)

**Opción C (arquitectural):** Separar el ambient processing en un perfil-parametrizado:
- `ambientCrushExponent`: 3.5 para mix bass+mid, 1.5 para subBass
- `ambientNoiseGate`: 0.15 para mix, 0.02 para subBass

---

## Resumen Ejecutivo

| Problema | Archivo culpable | Línea | Causa raíz |
|----------|-----------------|-------|-----------|
| Fan arranca en 128 | `NodeExtractionPipeline.ts` | 712, 713, 972, 974 | `currentPosition.rotation = 0.5` hardcodeado ignora JSON default |
| Fan sigue en 128 | `KineticSystem.ts` | 167-174, 275, 299 | Idle pattern escribe `rotation=0.5` (HOME_PAN) cada frame |
| Washer no late | `LiquidEngineBase.ts` | 603-607 | `pow(x, 3.5)` + noise-gate 0.15 matan señales de subBass puro (típicas 0.2-0.4) |
| NodeArbiter bloquea L0 | **INOCENTE** | — | Smart Gate (WAVE 4752) no bloquea sin override L2 activo |

---
*Reporte generado por Opus — WAVE 4813*
*WAVE 4812 fixes: aplicados pero anulados por hardcodeos upstream*
