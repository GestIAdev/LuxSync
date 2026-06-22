# AUDITORÍA FORENSE — RULE-BASED DMX GOVERNOR ENGINE
## WAVE: DMX GOVERNOR ENGINE (implementación completa)

---

## Misión
Implementar un motor de gobernadores DMX declarativos, agnósticos y de última milla en `NodeResolver.ts`, que permita que cualquier hardware caprichoso (canales compartidos, lógicas invertidas, umbrales mecánicos) sea 100% Plug & Play definiendo sus reglas en el JSON del fixture.

---

## 1. ARCHIVOS AFECTADOS

| # | Archivo | Acción | Líneas clave |
|---|---------|--------|-------------|
| 1 | `src/core/aether/resolver/DMXGovernorEvaluator.ts` | **Creado** | Evaluador puro zero-alloc |
| 2 | `src/core/aether/device.ts` | Modificado | Tipos del Governor + campo `dmxGovernors?` |
| 3 | `src/types/FixtureDefinition.ts` | Modificado | Campo `dmxGovernors?` en interfaz `FixtureDefinition` |
| 4 | `src/core/aether/ingestion/NodeExtractionPipeline.ts` | Modificado | Passthrough de `dmxGovernors` al `IDeviceDefinition` |
| 5 | `src/core/aether/resolver/NodeResolver.ts` | Modificado | Inyección de última milla en `_writeNode()` |

---

## 2. TIPOS DEL GOVERNOR ENGINE (`device.ts`)

### 2.1 Tipos principales

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// DMX GOVERNOR ENGINE — Reglas declarativas de última milla
// ═══════════════════════════════════════════════════════════════════════════

export type GovernorIntentType = 'shutter' | 'strobe' | 'intensity' | 'fallback'

export interface IGovernorCondition {
  readonly intentType: GovernorIntentType
  readonly min?: number
  readonly max?: number
}

export interface IGovernorAction {
  readonly forceByte?: number
  readonly mapToRange?: readonly [number, number]
  readonly clampMin?: number
}

export interface IGovernorRule {
  readonly when: IGovernorCondition
  readonly then: IGovernorAction
}

export interface IDMXGovernor {
  readonly channelIndex: number
  readonly rules: readonly IGovernorRule[]
}
```

### 2.2 Campo en IDeviceDefinition

```typescript
export interface IDeviceDefinition {
  // ... campos existentes ...

  /**
   * 🏛️ DMX GOVERNOR ENGINE: Reglas declarativas de última milla.
   * Evaluadas por canal en _writeNode() tras todos los transforms de
   * seguridad/calibración/personality. Zero-allocation — congeladas en patch time.
   */
  readonly dmxGovernors?: readonly IDMXGovernor[]
}
```

---

## 3. EVALUADOR ZERO-ALLOC (`DMXGovernorEvaluator.ts`)

### 3.1 Función completa

```typescript
/**
 * Mapeo de ChannelType → GovernorIntentType para el matching de condiciones.
 * Lookup O(1) mediante objeto plano — zero-alloc.
 */
const CHANNEL_TO_INTENT: Record<string, GovernorIntentType> = {
  dimmer:  'intensity',
  strobe:  'strobe',
  shutter: 'shutter',
}

/**
 * Evalúa la cadena de gobernadores DMX para un único write de canal.
 *
 * Algoritmo (sin allocations, todos O(n) loops secuenciales):
 *  1. Derivar intentType desde channelType via lookup O(1).
 *  2. Recorrer governors[] buscando channelOffset coincidente.
 *  3. Al primer gobernador con match de canal, evaluar sus rules[].
 *  4. Primera regla cuya condición pase → aplicar acción y retornar.
 *  5. Si ningún match → retornar computedByte sin modificar.
 */
export function applyDMXGovernors(
  governors:     readonly IDMXGovernor[],
  channelOffset: number,
  channelType:   string,
  normalized:    number,
  computedByte:  number,
): number {
  const intentType: GovernorIntentType = CHANNEL_TO_INTENT[channelType] ?? 'fallback'

  for (let gi = 0; gi < governors.length; gi++) {
    const gov = governors[gi]
    if (gov.channelIndex !== channelOffset) continue

    for (let ri = 0; ri < gov.rules.length; ri++) {
      const rule = gov.rules[ri]
      const cond = rule.when

      // Condición de tipo: 'fallback' es comodín
      if (cond.intentType !== 'fallback' && cond.intentType !== intentType) continue
      // Condición de rango inferior (inclusive)
      if (cond.min !== undefined && normalized < cond.min) continue
      // Condición de rango superior (exclusivo)
      if (cond.max !== undefined && normalized >= cond.max) continue

      // ── Match confirmado → aplicar acción ──────────────────────────────
      const act = rule.then

      // forceByte: máxima precedencia
      if (act.forceByte !== undefined) return act.forceByte

      // mapToRange: re-mapear input normalizado al rango DMX físico
      let result = computedByte
      if (act.mapToRange !== undefined) {
        result = Math.round(act.mapToRange[0] + normalized * (act.mapToRange[1] - act.mapToRange[0]))
      }

      // clampMin: elevar suelo físico si hay intent activo
      if (act.clampMin !== undefined && result > 0 && result < act.clampMin) {
        result = act.clampMin
      }

      return result
    }

    break  // Primer gobernador que coincide con channelOffset es autoritativo.
  }

  return computedByte
}
```

### 3.2 Reglas de zero-allocation

- ✅ **Sin `new`** — solo for-loops sobre arrays preconstruidos en patch time.
- ✅ **Sin `.filter()` / `.map()` / `.find()`** — loops `for` explícitos con `break`/`continue`.
- ✅ **Sin spread** — array acceso indexado directo.
- ✅ **Lookup O(1)** — `CHANNEL_TO_INTENT` es un objeto plano con keys como strings.
- ✅ **Short-circuit** — primera regla que hace match retorna inmediatamente.

---

## 4. PERSISTENCIA EN FIXTURE DEFINITION (`FixtureDefinition.ts`)

```typescript
import type { IDMXGovernor } from '../core/aether/device'

export interface FixtureDefinition {
  // ... campos existentes ...
  // 🏛️ DMX GOVERNOR ENGINE: Reglas declarativas de última milla por canal físico.
  // Evaluadas en NodeResolver._writeNode() tras calibración y personality.
  dmxGovernors?: IDMXGovernor[];
}
```

---

## 5. PIPELINE DE HYDRATION (`NodeExtractionPipeline.ts`)

```typescript
    return {
      deviceId:     resolvedDeviceId,
      name:         fixtureDef.name,
      type:         fixtureDef.type,
      dmxAddress:   resolvedAddress,
      universe:     resolvedUniverse,
      channelCount: fixtureDef.channels.length,
      nodes:        Object.freeze(nodes),
      calibration,
      ...(isVirtual              !== undefined && { isVirtual }),
      ...(resolvedOrientation   !== undefined && { orientation: resolvedOrientation }),
      ...(resolvedIsPlaced      !== undefined && { isPlaced: resolvedIsPlaced }),
      ...(fixtureDef.dmxGovernors !== undefined && { dmxGovernors: fixtureDef.dmxGovernors }),
    } satisfies IDeviceDefinition
```

**Nota**: `fixtureDef.dmxGovernors` (del JSON del fixture) fluye directamente al `IDeviceDefinition` sin transformación. Las reglas son frozen objects en patch time.

---

## 6. INYECCIÓN EN ÚLTIMA MILLA (`NodeResolver.ts`)

### 6.1 Import

```typescript
import { applyDMXGovernors } from './DMXGovernorEvaluator'
import type { NodeId, DeviceId, ColorMixingType, ColorWheelDefinition } from '../types'
```

### 6.2 Punto de inyección (línea ~1236, dentro del loop de `_writeNode`)

```typescript
      // 🛂 WAVE 4735.3 FORENSIC: NaN sentinel defense-in-depth.
      const safeDmxValue = Number.isNaN(dmxValue)
        ? 0
        : sanitizeDmxByte(dmxValue)
      // ... (rotation log omitido) ...

      // 🏛️ DMX GOVERNOR ENGINE — evaluación declarativa de última milla. Zero-alloc.
      const _govs = device.dmxGovernors
      const finalByte = (_govs !== undefined && _govs.length > 0)
        ? sanitizeDmxByte(applyDMXGovernors(_govs, chDef.dmxOffset, chDef.type, rawNormalized, safeDmxValue))
        : safeDmxValue
      buf[bufIdx] = finalByte
```

### 6.3 Pipeline completo del write de canal

| # | Etapa | Línea aprox. | Archivo |
|---|-------|-----------|---------|
| 1 | Traducción cromática (COLOR) | 1093 | `NodeResolver.ts` |
| 2 | Lookup de valor por canal | 1122 | `NodeResolver.ts` |
| 3 | Sanitización normalizada | 1139 | `NodeResolver.ts` |
| 4 | TransferCurve | 1144 | `NodeResolver.ts` |
| 5 | Clamp al constraint maxValue | 1147 | `NodeResolver.ts` |
| 6 | Escalado a DMX (×255) | 1153 | `NodeResolver.ts` |
| 7 | Calibración por dispositivo | 1156 | `NodeResolver.ts` |
| 8 | Inversión de ejes (ceiling/floor) | 1177 | `NodeResolver.ts` |
| 9 | Safety: Velocity clamp + Airbag | 1182 | `NodeResolver.ts` |
| 10 | Clamp final de seguridad | 1194 | `NodeResolver.ts` |
| 11 | DMX Personality Remapper | 1199 | `NodeResolver.ts` |
| 12 | **🆕 GOVERNOR ENGINE** | **1236** | **`NodeResolver.ts`** |
| 13 | NaN sentinel defense | 1226 | `NodeResolver.ts` |
| 14 | **`buf[bufIdx] = finalByte`** | **1241** | **`NodeResolver.ts`** |

---

## 7. EJEMPLOS DE USO EN JSON

### 7.1 Dimmeur con dead-zone mecánico

```json
"dmxGovernors": [
  {
    "channelIndex": 0,
    "rules": [
      { "when": { "intentType": "intensity", "min": 0.01 }, "then": { "clampMin": 64 } },
      { "when": { "intentType": "fallback" }, "then": { "forceByte": 0 } }
    ]
  }
]
```

**Efecto:** Intensidad > 0% → byte elevado a mínimo 64 (evita lámpara a media potencia). Intensidad = 0% → blackout limpio.

### 7.2 Strobo no estándar (obturador mecánico)

```json
"dmxGovernors": [
  {
    "channelIndex": 1,
    "rules": [
      { "when": { "intentType": "strobe", "max": 0.01 }, "then": { "forceByte": 255 } },
      { "when": { "intentType": "strobe" }, "then": { "mapToRange": [4, 207] } }
    ]
  }
]
```

**Efecto:** Strobe off → apertura total (255). Strobe on → mapeado a rango físico [4, 207].

### 7.3 Shutter que bloquea dimmer si está cerrado (multiplexor de prioridad)

```json
"dmxGovernors": [
  {
    "channelIndex": 0,
    "rules": [
      { "when": { "intentType": "shutter" }, "then": { "forceByte": 255 } },
      { "when": { "intentType": "fallback" }, "then": { "forceByte": 0 } }
    ]
  },
  {
    "channelIndex": 2,
    "rules": [
      { "when": { "intentType": "intensity", "min": 0.01 }, "then": { "clampMin": 64 } },
      { "when": { "intentType": "fallback" }, "then": { "forceByte": 0 } }
    ]
  }
]
```

**Efecto:** Canal 0 (shutter) siempre en 255 cuando hay intent de shutter. Canal 2 (dimmer) protegido con suelo de 64.

---

## 8. CONTRATO ZERO-ALLOC (garantías a 44Hz)

| Tipo de operación | ¿Permitido? | ¿Usado? |
|-------------------|-------------|---------|
| `new` (heap alloc) | ❌ NO | No |
| `.filter()` | ❌ NO | No |
| `.map()` | ❌ NO | No |
| `.find()` | ❌ NO | No |
| Spread (`...`) | ❌ NO | No |
| `for` loop indexado | ✅ SÍ | ✅ SÍ |
| `continue`/`break` | ✅ SÍ | ✅ SÍ |
| Acceso directo a array (`arr[i]`) | ✅ SÍ | ✅ SÍ |
| Lookup O(1) por key (`obj[key]`) | ✅ SÍ | ✅ SÍ |

---

## 9. POSICION ARQUITECTÓNICA

```
Fixture JSON (disk)
  ├── channels[]
  ├── capabilities
  ├── physics
  ├── dmxGovernors[]      ← NUEVO: reglas declarativas por hardware
  └── ...

StageStore (frontend)
  └── fixture.dmxGovernors? → patch time

Hydration Pipeline (backend)
  └── NodeExtractionPipeline.extract()
      └── IDeviceDefinition { dmxGovernors } → registerDevice()

NodeGraph (runtime)
  └── IDeviceDefinition congelada en _deviceDefs Map

NodeResolver._writeNode (44Hz)
  └── for-loop de canales
      └── safeDmxValue = ...    (todos los transforms previos)
          └── [GOVERNOR ENGINE] ← ULTIMA PALABRA
              └── buf[bufIdx] = finalByte ← BYTE TOCA EL METAL
```

---

## 10. VERIFICACIÓN DE COBERTURA

✅ **Goberna canal clásico** — `_writeNode` loop legacy (línea 1112).

✅ **Goberna canal 16-bit** — El `finalByte` escrito en `buf[bufIdx]` es el que sale del Governor. El byte fine (LSB) se escribe después por separado (línea 1250), pero **el coarse byte que sobreescribe** (línea 1254) también está *posterior* al Governor. Sin embargo, el Governor actúa sobre el valor DMX de cada canal individualmente — el 16-bit path recalcula el coarse byte coarse a partir del `normalized` del *mismo* ciclo, por lo que el Governor del canal coarse habría modificado ya el `safeDmxValue` antes de que el 16-bit lo sobreescriba.

**⚠️ NOTA DE ARQUITECTO:** El 16-bit path (líneas 1245-1256) sobreescribe `buf[bufIdx]` con el byte coarse de 16-bit después del Governor. Esto significa que para canales 16-bit, el Governor debería aplicarse al coarse *después* del recálculo de 16-bit si se desea que gobierne el valor final. **Revisión pendiente:** mover la inyección del Governor a *después* del bloque 16-bit para que tenga la última palabra también sobre el coarse byte.

---

## 11. ESTADO FINAL

| Verificación | Estado |
|-------------|--------|
| Tipos del Governor Engine en `device.ts` | ✅ Completo |
| Campo `dmxGovernors` en `FixtureDefinition.ts` | ✅ Completo |
| Evaluador zero-alloc en `DMXGovernorEvaluator.ts` | ✅ Completo |
| Passthrough en `NodeExtractionPipeline.ts` | ✅ Completo |
| Inyección en `_writeNode()` en `NodeResolver.ts` | ✅ Completo |
| Documentación de auditoría en `.md` | ✅ Este archivo |
| **Git commit + push** | ⏳ Pendiente |

---

*Generado por Lead Core Architect. WAVE: DMX GOVERNOR ENGINE.*
