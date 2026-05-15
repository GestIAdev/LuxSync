# WAVE 4750 — THE SMART GATE (L0 vs L2 Merge Audit)

**Status:** DIAGNÓSTICO COMPLETADO — Pendiente autorización para fixes  
**Auditor:** Opus (Agente Ejecutor)  
**Fecha:** 2026-05-14  
**Scope:** NodeArbiter.ts, NodeResolver.ts, LiquidEngineBase.ts, LiquidAetherAdapter.ts, TitanOrchestrator.ts

---

## 0. EXECUTIVE SUMMARY

Se han identificado **tres fallos arquitectónicos** en el pipeline L0→L2→DMX:

| # | Fallo | Impacto | Severidad |
|---|-------|---------|-----------|
| 1 | **Opaque Mask fixture-wide** (WAVE 4775) bloquea TODOS los canales estéticos de L0 cuando L2 toca UN SOLO canal | Al tocar dimmer manual, se pierden colores/posiciones de L0 → blackout parcial | **CRÍTICO** |
| 2 | **Manual Intensity Lock fixture-wide** (WAVE 4711) replica dimmer a TODOS los nodos del fixture | El fixture entero se congela en intensidad, nodos no-L2 quedan sin color | **CRÍTICO** |
| 3 | **Strobe trigger global sin contexto de zona** (`calculateStrobe`) + shutter sin estado por defecto explícito | Strobe dispara en pasajes "base" por picos de agudos; obturador puede quedar cerrado si default=0 | **ALTO** |

---

## 1. AUDITORÍA DEL "SPLIT-BRAIN" RESIDUAL (The Override Logic)

### 1.1 Pipeline de Arbitraje Actual

```
NodeArbiter.arbitrate() — Orden de aplicación:

  1. Reset _result.clear()
  2. Precompute _manualDimmerFixtureIds      ← fixtures con dimmer L2
  3. Precompute _opaqueFixtureIds           ← fixtures con CUALQUIER override L2/LP
  4. L0: _systemBus.getAll() → _applyIntent(..., 'system')
       └─ OPAQUE MASK filtra canales estéticos si fixture está en _opaqueFixtureIds
  5. L1: _seleneBus → _applyIntent(..., 'selene')
       └─ OPAQUE MASK filtra canales estéticos si fixture opaco
       └─ MOVER SHIELD bloquea color en movers con rueda física
  6. LP: _playbackIntents → _applyIntent(..., 'playback')
  7. L2: _manualOverrides → escritura DIRECTA en _result (NO por _applyIntent)
       └─ Escribe TODOS los canales del override tal cual
       └─ _manualChannelLocks registra canales para Hard Lock
       └─ _manualDimmerLocks registra dimmer para Intensity Lock
  8. L3: _effectIntents → _applyIntent(..., 'effect')
  9. L3+: _hephaestusIntents → _applyIntent(..., 'hephaestus')
 10. MANUAL HARD LOCK: reaplica _manualChannelLocks sobre L3/L3+
 11. MANUAL INTENSITY LOCK: replica dimmer/brightness a TODOS los nodos del fixture
 12. Grand Master × STRICT_PRIORITY_CHANNELS
 13. Inhibit Limits (cap por nodo)
 14. L2-MOTOR: _motorKineticOverrides (pan/tilt finales del engine cinético)
```

### 1.2 El Culpable: OPAQUE_MASK es Fixture-Wide, No Channel-Granular

**Ubicación:** `@/src/core/aether/NodeArbiter.ts:596-618`

```typescript
// WAVE 4775: OPAQUE MASK por canal.
// L0/L1 no pueden escribir canales estéticos en fixtures opacos.
if (fixtureIsOpaque && OPAQUE_BLOCKED_CHANNELS_L0_L1.has(channel)) {
  continue  // ← SKIP: L0 no escribe este canal
}
```

**OPAQUE_BLOCKED_CHANNELS_L0_L1:**
```typescript
['r','g','b','red','green','blue','white','amber',
 'gobo','gobo_rotation','prisma','prisma_rotation',
 'zoom','focus','frost']
```

**CÓMO SE DETECTA OPACIDAD:**
```typescript
// lines 337-346
this._opaqueFixtureIds.clear()
for (const [nodeId] of this._manualOverrides) {
  const sep = nodeId.lastIndexOf(':')
  if (sep > 0) this._opaqueFixtureIds.add(nodeId.slice(0, sep))  // ← FIXTURE ID
}
```

**Problema:** Si el usuario toca **solo el dimmer** de `fixture-123:impact`, el fixture entero `fixture-123` se vuelve opaco. L0 ya NO puede escribir `red`, `green`, `blue` en `fixture-123:color`. Como L2 no proporcionó valores de color, el nodo `:color` queda sin datos de color → NodeResolver usa defaults (0,0,0) → **blackout de color mientras el dimmer está manual**.

### 1.3 El Culpable: L2 Escribe Todos los Canales del Override

**Ubicación:** `@/src/core/aether/NodeArbiter.ts:412-431`

```typescript
for (const key in channels) {
  const incoming = channels[key]
  if (!isFiniteChannelValue(incoming)) continue
  // ...
  record[key] = incoming  // ← DIRECT WRITE, sin merge
}
```

**Problema:** L2 escribe los canales que recibe del store, pero no hace merge con lo que ya estaba en `_result` de L0. Si el override solo tiene `{dimmer: 0.5}`, solo se escribe `dimmer`. Los canales de color que L0 había puesto en `_result` previamente (antes de que Opaque Mask los bloqueara) — espera, en realidad L0 nunca llega a escribirlos porque Opaque Mask los bloquea ANTES.

**Corrección de mi análisis:** El orden es:
1. L0 intenta escribir color → Opaque Mask lo bloquea → color NO está en `_result`
2. L2 escribe dimmer → dimmer SÍ está en `_result`
3. `_result` para `:color` queda vacío o con solo dimmer/brightness del Intensity Lock
4. NodeResolver ve canales de color sin valores arbitrados → usa `defaultValue` del fixture

Si `defaultValue` de red/green/blue es 0 → **fixture emite luz blanca (o del color del dimmer) con color negro = negro puro**.

### 1.4 El Culpable: MANUAL INTENSITY LOCK Fixture-Wide

**Ubicación:** `@/src/core/aether/NodeArbiter.ts:468-503`

```typescript
// WAVE 4711 HOTFIX SHOWTIME:
// Lock de intensidad por FIXTURE completo
for (const [candidateNodeId, candidateRecord] of this._result) {
  if (!candidateNodeId.startsWith(fixturePrefix)) continue
  candidateRecord['dimmer'] = lockValue
  candidateRecord['brightness'] = lockValue
}
// Crear/forzar también el nodo :color aunque no exista
const colorNodeId = `${fixtureId}:color`
let colorRecord = this._result.get(colorNodeId)
if (!colorRecord) { colorRecord = this._acquireRecord(); this._result.set(colorNodeId, colorRecord) }
colorRecord['dimmer'] = lockValue
colorRecord['brightness'] = lockValue
```

**Problema:** Al tocar dimmer en UN nodo (ej: `:impact`), se fuerza dimmer/brightness en TODOS los nodos del fixture (`:color`, `:beam`, `:atmosphere`, etc.). Esto anula la intensidad gestionada por L0 en nodos que el usuario nunca tocó.

---

## 2. REGLAS DE MEZCLA (Merge Engine HTP/LTP)

### 2.1 Canales STRICT_PRIORITY (HTP/LTP híbrido)

**Conjunto:** `{dimmer, brightness, strobe, shutter}`

**Reglas:**

| Contexto | Regla | Implementación |
|----------|-------|----------------|
| **Dentro de L0** (múltiples fuentes en el mismo bus) | HTP: `max(valor_actual, valor_entrante)` | `@NodeArbiter.ts:647-654` |
| **Entre capas** (L0→L1→LP→L2→L3) | LTP estricto por prioridad de capa. La última capa en escribir gana. | `@NodeArbiter.ts:625-659` |
| **Post-L3** | MANUAL HARD LOCK re-aplica L2 para defenderse de L3 | `@NodeArbiter.ts:448-461` |

**Anomalía detectada:** L3 (effects) tiene autoridad destructiva con `dimmer=0`:
```typescript
// Línea 636-639
if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
  record[channel] = 0
  continue
}
```
Esto permite que un effect apague un fixture incluso si L2 tiene dimmer manual. Pero el Manual Hard Lock (paso 11) re-aplica L2 DESPUÉS de L3, así que en la práctica L2 gana. El código de L3 con dimmer=0 es un no-op porque Hard Lock lo sobreescribe.

### 2.2 Canales LTP (pan, tilt, r, g, b, color_wheel, etc.)

**Regla:** LTP puro. La última capa en escribir gana. `_result[channel] = incoming` directamente.

**Problema:** Cuando L2 toca un canal (ej: `pan`), L0 pierde la posición. Pero para canales que L2 NO toca (ej: `red`, `green`, `blue`), el valor depende de:
1. Si L0 pudo escribirlo (NO si Opaque Mask lo bloqueó)
2. Si está en `_result` del frame anterior (NO, se hace clear cada frame)
3. Default del fixture

**No existe RELEASE TIME.** Cuando el usuario libera un override manual (`clearManualOverride`), el canal desaparece de L2 y del `_result`. En el siguiente frame, L0 puede escribirlo de nuevo. Pero como el arbitraje es stateless-frame-a-frame, no hay interpolación suave. El cambio es instantáneo (0-frame), lo que causa el "chasquido" mecánico en movers.

### 2.3 Tabla de Autoridad por Canal

| Canal | L0 puede escribir | L1 puede escribir | L2 gana | L3 gana | Notas |
|-------|-------------------|-------------------|---------|---------|-------|
| `dimmer` | Sí (HTP) | Sí | Sí* | Casi* | Hard Lock defiende L2 post-L3 |
| `brightness` | Sí (HTP) | Sí | Sí* | Casi* | Intensity Lock replica a todo fixture |
| `strobe` | Sí (HTP) | Sí | Sí | Sí | L3 puede pisar |
| `shutter` | Sí (HTP) | Sí | Sí | Sí | L3 puede pisar |
| `pan` | Sí (LTP) | Sí | Sí | Sí | Opaque Mask NO bloquea cinética |
| `tilt` | Sí (LTP) | Sí | Sí | Sí | Opaque Mask NO bloquea cinética |
| `r/g/b` | Sí (LTP) | Sí | Sí | Sí | **Opaque Mask bloquea si fixture opaco** |
| `red/green/blue` | Sí (LTP) | Sí | Sí | Sí | **Opaque Mask bloquea si fixture opaco** |
| `gobo` | Sí (LTP) | Sí | Sí | Sí | **Opaque Mask bloquea si fixture opaco** |
| `color_wheel` | Sí (LTP) | Sí | Sí | Sí | **Opaque Mask bloquea si fixture opaco** |

**Conclusión:** La única protección real que tiene el usuario contra L0 es el Opaque Mask, pero este es un **martillo demasiado grande**: un toque de dimmer en `:impact` mata toda la generación de color de L0 para ese fixture.

---

## 3. AUDITORÍA DE LIQUIDENGINEBASE Y STROBE LEAKAGE

### 3.1 Cómo se decide `strobeActive`

**Ubicación:** `@/src/hal/physics/LiquidEngineBase.ts:764-792`

```typescript
private calculateStrobe(treble: number, ultraAir: number, noiseMode: boolean):
  { active: boolean; intensity: number } {

  // 1. Apagar strobe si duró más de p.strobeDuration
  if (this._strobeActive && now - this.strobeStartTime > p.strobeDuration) {
    this._strobeActive = false
  }

  // 2. Umbral ajustado por noiseMode
  const effectiveThreshold = noiseMode ? p.strobeThreshold * p.strobeNoiseDiscount : p.strobeThreshold

  // 3. Condiciones de activación
  const isPureTreblePeak = treble > effectiveThreshold
  const isUltraAirCombo   = ultraAir > 0.70 && treble > 0.60

  // 4. Trigger
  if ((isPureTreblePeak || isUltraAirCombo) && !this._strobeActive) {
    this._strobeActive = true
    this.strobeStartTime = now
  }

  return { active: this._strobeActive, intensity: this._strobeActive ? 1.0 : 0 }
}
```

**Problema:** `calculateStrobe` es **global y agnóstico a zonas**. Solo mira `treble` y `ultraAir`. No distingue entre:
- Un pico de agudos en zona **flash/nuke** (donde SÍ queremos strobe)
- Un pico de agudos en zona **floor/ambient/base** (donde NO queremos strobe)

Un hi-hat o crash en un pasaje "base" puede disparar strobe si `treble > strobeThreshold`.

### 3.2 Cómo se inyecta el Strobe en el Bus

**Ubicación:** `@/src/core/aether/adapters/LiquidAetherAdapter.ts:245-266`

```typescript
private _routeStrobeNodes(result: LiquidStereoResult, bus: IIntentBus): void {
  const impactNodes = this._nodeGraph.getView(NodeFamily.IMPACT)
  impactNodes.forEach((node) => {
    const hasShutter = node.channels.some((ch) => ch.type === 'shutter')
    if (!hasShutter) return

    this._strobeValues['shutter']    = 1.0               // abre obturador
    this._strobeValues['strobeRate'] = result.strobeIntensity
    this._strobeScratch.nodeId       = node.nodeId
    bus.push(this._strobeScratch as INodeIntent)
  })
}
```

**Observaciones críticas:**

1. **No se llama en `ingest()` del snippet mostrado** (líneas 181-230). El método existe pero no está visible en el punto de entrada. Podría estar en una subclase o en otra rama de ejecución.

2. **Cuándo se abre/cierra el obturador:**
   - Strobe activo: `_routeStrobeNodes` escribe `shutter = 1.0` (abierto) + `strobeRate = intensity`
   - Strobe inactivo: **nadie toca shutter**. El canal queda sin valor en el arbitrated result.
   - NodeResolver cae a `chDef.defaultValue` para shutter.

3. **Valor por defecto de shutter:** Si el fixture define `defaultValue: 0` para shutter → obturador **cerrado** en pasajes tranquilos. Si define `defaultValue: 255` → obturador **abierto**.

**La observación del usuario:** "Los obturadores deben estar abiertos por defecto, pero el strobe channel debe ser estrictamente cero en pasajes tranquilos."

- **Strobe channel:** En pasajes tranquilos, `strobeActive = false` → `_routeStrobeNodes` no se llama → `strobeRate` no se escribe → NodeResolver usa `defaultValue`. Si `defaultValue = 0`, strobe está en 0. ✅
- **Shutter channel:** Si `defaultValue = 0`, obturador cerrado en pasajes tranquilos. ❌ El usuario quiere que esté abierto.

**Diagnóstico:** El problema no es que "L0 inyecte strobe en pasajes tranquilos" (eso solo pasa si treble pasa el umbral, que es un bug de sensibilidad), sino que **el obturador puede estar cerrado por defecto** cuando no hay strobe activo.

### 3.3 Zonas Canónicas y Comportamiento Esperado

| Zona | Intensidad L0 | Strobe Esperado | Strobe Real |
|------|---------------|-----------------|-------------|
| **Floor** | `floorIntensity` — subBass+lowMid | OFF (luz base sólida) | Puede ON si treble peak |
| **Ambient** | `ambientIntensity` — slow EMA, cubic-crushed | OFF (luz base suave) | Puede ON si treble peak |
| **Air** | `airIntensity` — soft treble/highMid | OFF (luz base etérea) | Puede ON si treble peak |
| **Front L/R** | kick/snare — percutores | OFF (a menos que efecto explícito) | Puede ON si treble peak |
| **Mover L/R** | treble/vocal — melodía | OFF | Puede ON si treble peak |
| **Flash/Nuke** | No existe como zona canónica en L0 | ON | — |

**Conclusión:** `calculateStrobe` debería considerar si el motor está en modo "base" (bajo `morphFactor`, en zonas floor/ambient) vs "percusión" (alto `morphFactor`, kick/snare). Actualmente no hay esta distinción.

---

## 4. HALLAZGOS CRÍTICOS POR ARCHIVO

### 4.1 NodeArbiter.ts — El Árbitro de Hierro (demasiado hierro)

| Línea | Hallazgo |
|-------|----------|
| `63-70` | `OPAQUE_BLOCKED_CHANNELS_L0_L1` bloquea 15+ tipos de canal. Sin mecanismo de excepción por canal tocado. |
| `337-346` | `_opaqueFixtureIds` se computa por FIXTURE, no por nodo. Un toque en `:impact` bloquea L0 en `:color`. |
| `393-433` | L2 escribe canales manual directamente, sin saber qué canales de L0 están siendo bloqueados. |
| `468-503` | Intensity Lock replica dimmer a TODOS los nodos del fixture. No respeta si el nodo tiene su propio dimmer L0. |
| `625-659` | STRICT_PRIORITY_CHANNELS usa LTP estricto entre capas. HTP solo dentro de L0. Correcto conceptualmente, pero combinado con Opaque Mask produce blackouts. |

### 4.2 NodeResolver.ts — El Escritor DMX

| Línea | Hallazgo |
|-------|----------|
| `703-709` | Smart Gate: `nodeBlocked = !gateOpen && !isManualNode && node.family !== KINETIC`. Esto bloquea IMPACT/COLOR/BEAM/ATMO cuando output deshabilitado. OK para seguridad. |
| `719-789` | Forge bypass: si hay compiled graph, delega COMPLETAMENTE al Forge evaluator. El grafo Forge decide su propia mezcla. |
| `837-914` | Legacy write: para cada canal, `buf[bufIdx] = dmxValue`. Si `nodeBlocked`, hace `continue` sin escribir. Los canales no escritos quedan con el valor del frame anterior (Uint8Array no se limpia entre frames). **ESTO ES UN BUG SUBTIL.** |

**BUG SUBTIL EN NODERESOLVER:** `_universeBuffers` son `Uint8Array(512)` que NO se limpian entre frames (línea 235). Si un canal deja de ser escrito (porque Opaque Mask lo bloqueó y L2 no lo tocó), el buffer conserva el valor del frame anterior. Esto significa que si L0 tenía rojo=255 en frame N, y en frame N+1 Opaque Mask bloquea L0 y L2 no toca color, el rojo SIGUE en 255 en el buffer DMX. Pero el frame N+2, si L0 sigue bloqueado, sigue en 255...

Espera, déjame revisar. `_writeNode` itera sobre `node.channels` y escribe cada uno. Si un canal no está en el arbitrated result, `_writeNode` cae a `_getDefaultNormalizedValue()` (línea 854), que devuelve el default del fixture. Así que no es un bug de persistencia — es un bug de "caída a default".

Pero para canales que NodeResolver no conoce (ej: si el nodo no declara un canal `strobe` en su `channels[]`), entonces no se itera y el buffer conserva valor anterior. Esto es edge case.

### 4.3 LiquidEngineBase.ts — El Motor L0

| Línea | Hallazgo |
|-------|----------|
| `572` | `calculateStrobe(bands.treble, bands.ultraAir, noiseMode)` — sin contexto de zona. |
| `764-792` | Strobe trigger: treble peak OR ultraAir combo. Sin distinción floor/ambient/flash. |
| `176-178` | Strobe state: `_strobeActive`, `strobeStartTime`. Strobe dura `p.strobeDuration` ms. |

### 4.4 LiquidAetherAdapter.ts — El Adaptador L0→Aether

| Línea | Hallazgo |
|-------|----------|
| `181-230` | `ingest()` solo publica `dimmer`/`brightness` en IMPACT y COLOR. **No se ve llamada a `_routeStrobeNodes` en el snippet mostrado.** |
| `245-266` | `_routeStrobeNodes()` existe y escribe `shutter=1.0` + `strobeRate`. Si no se llama desde `ingest()`, ¿quién lo llama? |

**Pregunta abierta:** ¿Dónde se invoca `_routeStrobeNodes`? No está en el `ingest()` mostrado. Podría estar en una subclase (LiquidEngine41/71) o en un punto de conexión no auditado.

### 4.5 TitanOrchestrator.ts — El Loop de Frame

| Línea | Hallazgo |
|-------|----------|
| `1967` | `aetherSafety.setManualNodeIds(aetherArbiter.getManualOverrideNodeIds())` — los nodos manuales se marcan para bypass del Smart Gate. |
| `1997` | `aetherResolver.resolve(arbitrated)` — toma el mapa arbitrado y escribe DMX. |
| `2017-2032` | Egress: si `blackoutActive`, aplica soft blackout (solo canales de intensidad a 0, pan/tilt conservados). OK. |

---

## 5. ANÁLISIS DE IMPACTO (The Hachazo Detallado)

### Escenario: Usuario toca dimmer de un PAR en pasaje "base"

**Frame N (antes del toque):**
- L0 escribe `brightness=0.3` en `:color` del PAR
- L0 escribe `dimmer=0.3` en `:impact` del PAR
- NodeResolver escribe DMX. PAR emite luz suave ambiental.

**Frame N+1 (usuario toca dimmer a 0.8 en `:impact`):**
- `_manualOverrides` recibe `{dimmer: 0.8}` para `fixture-123:impact`
- `_opaqueFixtureIds` añade `fixture-123`
- L0 intenta escribir `brightness=0.3` en `:color` → **OPAQUE MASK BLOQUEA**
- L0 intenta escribir `r=0.5, g=0.3, b=0.2` en `:color` → **OPAQUE MASK BLOQUEA**
- L2 escribe `dimmer=0.8` en `:impact` ✅
- MANUAL INTENSITY LOCK escribe `dimmer=0.8, brightness=0.8` en `:color` ✅
- NodeResolver para `:color`: tiene `brightness=0.8` pero **NO tiene r, g, b**
- NodeResolver cae a default: `r=defaultValue(0), g=0, b=0` → **color negro**
- Resultado: PAR brilla a 80% intensidad pero **SIN COLOR** (negro puro = apagado visual)

**Esto explica el "blackout" parcial reportado por el usuario.**

---

## 6. RECOMENDACIONES ARQUITECTÓNICAS

### Fix 1: OPAQUE MASK Per-Node (no Per-Fixture)

**Cambio:** En lugar de marcar todo el fixture como opaco, marcar solo los nodos que tienen override activo.

```typescript
// ACTUAL (bug):
this._opaqueFixtureIds.add(fixtureId)  // bloquea TODOS los nodos del fixture

// PROPUESTO:
this._opaqueNodeIds.add(nodeId)  // solo bloquea el nodo específico
```

**Impacto:** Tocar dimmer en `:impact` ya no bloquea color de L0 en `:color`. Cada nodo se protege individualmente.

### Fix 2: OPAQUE MASK Per-Channel-Touched (Smart Gate)

**Cambio:** En lugar de bloquear TODOS los canales estéticos, bloquear solo los canales que L2 realmente tocó.

```typescript
// ACTUAL (bug):
OPAQUE_BLOCKED_CHANNELS_L0_L1 = [r,g,b,red,green,blue,white,amber,gobo,prisma,zoom,focus,frost]
// Un toque de dimmer bloquea TODO esto.

// PROPUESTO: registrar qué canales específicos L2 tocó por nodo
this._opaqueNodeChannels = Map<NodeId, Set<string>>
// Si L2 solo tocó 'dimmer', solo bloquear 'dimmer' de L0 en ese nodo.
// L0 puede seguir escribiendo r,g,b en :color sin interferencia.
```

### Fix 3: Release Time (Fade Interpolado) en L2→L0

**Cambio:** Al liberar un override manual, no hacer clear inmediato. En su lugar:

```typescript
// PROPUESTO:
interface ManualOverrideState {
  values: Record<string, number>
  releaseStartedAt: number  // timestamp
  releaseDurationMs: number  // ej: 500ms
  lastValues: Record<string, number>  // valores al momento del release
}
```

En `arbitrate()`, si un override está en "release", interpolar entre `lastValues` y lo que L0 quiere escribir. Fade suave en ~500ms para evitar chasquidos mecánicos.

### Fix 4: Strobe Gated por Zona / Contexto

**Cambio:** `calculateStrobe` debería recibir contexto de zona:

```typescript
// PROPUESTO:
interface StrobeContext {
  zoneType: 'floor' | 'ambient' | 'air' | 'front' | 'mover' | 'flash'
  morphFactor: number
  isBreakdown: boolean
}

// En floor/ambient/air: strobe FORZOSAMENTE OFF
// En front/mover: strobe permitido si treble peak
// En flash (nueva zona explícita): strobe ON por comando
```

**Alternativa menor:** Añadir `strobeEnabled: boolean` al perfil de cada zona en `ILiquidProfile`, con default `false` para floor/ambient/air.

### Fix 5: Shutter Default = Open

**Cambio:** En `NodeExtractionPipeline` o en la definición de fixtures, asegurar que `defaultValue` para `shutter` sea 255 (abierto) en vez de 0 (cerrado).

```typescript
// En _mapChannels o _mapForgeNodes:
if (ch.type === 'shutter') {
  defaultValue: ch.defaultValue ?? 255  // abierto por defecto
}
```

---

## 7. MAPA DE CÓDIGO AFECTADO

| Archivo | Líneas | Fix Requerido |
|---------|--------|---------------|
| `src/core/aether/NodeArbiter.ts` | `337-346` | Opaque Mask: fixture-wide → node-wide |
| `src/core/aether/NodeArbiter.ts` | `596-618` | Opaque Mask: lista fija → canales tocados por L2 |
| `src/core/aether/NodeArbiter.ts` | `468-503` | Intensity Lock: fixture-wide → nodo que tocó L2 |
| `src/core/aether/NodeArbiter.ts` | `210-247` | Añadir release time en `clearManualOverride` |
| `src/hal/physics/LiquidEngineBase.ts` | `764-792` | Strobe: añadir contexto de zona |
| `src/core/aether/ingestion/NodeExtractionPipeline.ts` | `1110-1130` | Shutter default = 255 (open) |
| `src/core/aether/resolver/NodeResolver.ts` | `837-914` | Verificar que caída a default no deje canales "colgados" |

---

## 8. CONCLUSIÓN

El "split-brain" no es un problema de IDs de nodo (eso se resolvió en WAVE 4735.7/4735.11). Es un problema de **arquitectura de mezcla**: el Opaque Mask actúa como un muro de cemento entre L0 y L2 en lugar de una compuerta inteligente.

**La regla de oro que debería regir:**
> "L2 tiene autoridad SOBRE los canales que toca. L0 sigue gobernando los canales que L2 NO tocó."

Actualmente la regla es:
> "Si L2 toca CUALQUIER canal del fixture, L0 es expulsado de TODOS los canales estéticos del fixture."

Esto produce el "hachazo": un toque de dimmer mata todo el color.

**Próximo paso recomendado:** Autorizar Fix 1 + Fix 2 (Opaque Mask per-node + per-channel) como hotfix crítico. Los Fixes 3-5 son mejoras arquitectónicas para la siguiente iteración.
