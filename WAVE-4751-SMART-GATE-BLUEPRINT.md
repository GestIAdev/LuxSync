# WAVE 4751 — THE SMART GATE BLUEPRINT (Implementación)

**Status:** BLUEPRINT TÉCNICO — Listo para ejecución  
**Predecesor:** `WAVE-4750-SMART-GATE.md` (auditoría)  
**Autor:** Opus  
**Fecha:** 2026-05-14  
**Scope:** Diseño quirúrgico de la transformación fixture-wide → node/channel-wide del Merge Engine + Higiene de Strobe.

---

## 0. RESUMEN DE OBJETIVOS

| # | Objetivo | Archivo | Riesgo |
|---|----------|---------|--------|
| 1 | Opaque Mask: fixture-wide → **node-wide** | `NodeArbiter.ts` | Bajo |
| 2 | Opaque Mask: bloqueo por **canal-tocado** (Smart Gate) | `NodeArbiter.ts` | Bajo |
| 3 | Intensity Lock: fixture-wide → **node-wide** | `NodeArbiter.ts` | Medio (UX afectada) |
| 4 | **Release Time** (fade L2→L0 al liberar override) | `NodeArbiter.ts` | Medio |
| 5 | **HTP explícito** para `dimmer` cruzado L0×L2 | `NodeArbiter.ts` | Medio |
| 6 | **Strobe gated por zona** | `LiquidEngineBase.ts` + `LiquidAetherAdapter.ts` | Medio |
| 7 | **Shutter default = 255** (verificación, ya parcial) | `NodeExtractionPipeline.ts` | Bajo |

---

## 1. EL BISTURÍ DE ARBITRAJE — `NodeArbiter.ts`

### 1.1 Nueva Estructura de Estado

**Reemplazar los registros fixture-wide por registros node-wide + per-channel:**

```typescript
// ──────────────────────────────────────────────────────────────────────
// WAVE 4751 — STATE REFACTOR (zero-alloc, mutables in-place)
// ──────────────────────────────────────────────────────────────────────

// ANTES (a eliminar):
// private readonly _opaqueFixtureIds      = new Set<string>()
// private readonly _manualDimmerFixtureIds = new Set<string>()

// AHORA:
/**
 * Mapa por nodo de canales tocados activamente por L2 (Manual).
 * Cada Set contiene los nombres de canal que L2 escribió este frame.
 * Se reusa frame a frame; se limpia al inicio de arbitrate().
 */
private readonly _opaqueNodeChannels: Map<NodeId, Set<string>> = new Map()

/**
 * Mapa por nodo de canales tocados activamente por LP (Playback Timeline).
 * Misma semántica que _opaqueNodeChannels pero para LP.
 */
private readonly _opaquePlaybackChannels: Map<NodeId, Set<string>> = new Map()

/**
 * Pool de Sets reutilizables para evitar alloc en hot path.
 */
private readonly _channelSetPool: Set<string>[] = []
private _channelSetCursor = 0
```

### 1.2 Helper de Pool (zero-alloc)

```typescript
private _acquireChannelSet(): Set<string> {
  if (this._channelSetCursor < this._channelSetPool.length) {
    const s = this._channelSetPool[this._channelSetCursor++]
    s.clear()
    return s
  }
  const s = new Set<string>()
  this._channelSetPool.push(s)
  this._channelSetCursor++
  return s
}
```

### 1.3 Pre-cómputo en `arbitrate()` (nuevo bloque)

**Sustituir** el bloque actual de pre-cómputo opaco (`@NodeArbiter.ts:337-346`) por:

```typescript
// ── WAVE 4751: PRE-CÓMPUTO DE CANALES TOCADOS ──────────────────────
// Limpia los maps y los rellena con los canales específicos que L2/LP
// están tocando este frame. Esto sustituye al fixture-wide opaque mask.

this._channelSetCursor = 0
this._opaqueNodeChannels.clear()
this._opaquePlaybackChannels.clear()

// L2: registrar canales tocados por nodo
for (const [nodeId, channels] of this._manualOverrides) {
  let set = this._opaqueNodeChannels.get(nodeId)
  if (!set) {
    set = this._acquireChannelSet()
    this._opaqueNodeChannels.set(nodeId, set)
  }
  for (const key in channels) {
    if (isFiniteChannelValue(channels[key])) set.add(key)
  }
}

// LP: registrar canales tocados por nodo
for (let i = 0; i < this._playbackIntents.length; i++) {
  const intent = this._playbackIntents[i]
  let set = this._opaquePlaybackChannels.get(intent.nodeId)
  if (!set) {
    set = this._acquireChannelSet()
    this._opaquePlaybackChannels.set(intent.nodeId, set)
  }
  for (const key in intent.values) {
    if (isFiniteChannelValue(intent.values[key])) set.add(key)
  }
}
```

### 1.4 Filtro Per-Canal en `_applyIntent()` (refactor crítico)

**Sustituir** (`@NodeArbiter.ts:594-618`):

```typescript
// ANTES:
let fixtureIsOpaque = false
if ((layer === 'system' || layer === 'selene') && this._opaqueFixtureIds.size > 0) {
  const sep = intent.nodeId.lastIndexOf(':')
  if (sep > 0) fixtureIsOpaque = this._opaqueFixtureIds.has(intent.nodeId.slice(0, sep))
}
// ...
if (fixtureIsOpaque && OPAQUE_BLOCKED_CHANNELS_L0_L1.has(channel)) {
  continue
}
```

**Por** (WAVE 4751):

```typescript
// ── WAVE 4751: per-node + per-channel mask
// L0 (system) y L1 (selene) solo se bloquean en el canal específico que
// L2/LP están tocando EN EL MISMO NODO. Pan/tilt/dimmer siguen reglas
// especiales (HTP, no opaque) — ver _applyChannel().
const touchedByL2 = (layer === 'system' || layer === 'selene')
  ? this._opaqueNodeChannels.get(intent.nodeId)
  : undefined
const touchedByLP = (layer === 'system' || layer === 'selene')
  ? this._opaquePlaybackChannels.get(intent.nodeId)
  : undefined

// ...dentro del bucle for (channel in values):

const isBlockedByL2 = touchedByL2?.has(channel) === true
const isBlockedByLP = touchedByLP?.has(channel) === true
if ((isBlockedByL2 || isBlockedByLP) && !HTP_INTENSITY_CHANNELS.has(channel)) {
  continue  // L2/LP tienen autoridad LTP sobre este canal en este nodo
}
// HTP_INTENSITY_CHANNELS = { 'dimmer', 'brightness' } — siguen su propio merge
```

### 1.5 HTP Explícito Cruzado para `dimmer` y `brightness`

**Nuevo set** y nueva rama en `_applyIntent`:

```typescript
// Canales que aplican HTP (max) entre L0 y L2/L3.
// La intensidad NUNCA se "pisa" — siempre gana la más alta.
// brightness se trata igual que dimmer porque es el dimmer virtual.
const HTP_INTENSITY_CHANNELS = new Set<string>(['dimmer', 'brightness'])
```

**En `_applyIntent`**, dentro del bucle por canal:

```typescript
if (HTP_INTENSITY_CHANNELS.has(channel)) {
  // HTP cruzado: max(actual, entrante) sin importar la capa.
  // L3 effect dimmer=0 sigue siendo destructivo (excepción WAVE 4705).
  if (layer === 'effect' && channel === 'dimmer' && incoming <= 0) {
    record[channel] = 0
    continue
  }
  const current = record[channel]
  if (current === undefined || incoming > current) {
    record[channel] = incoming
  }
  continue
}
```

**Refactor del bloque L2 (`@NodeArbiter.ts:393-433`):** Ahora el dimmer manual NO se escribe directo — pasa por la misma rama HTP:

```typescript
// Dentro del bucle for L2:
for (const key in channels) {
  const incoming = channels[key]
  if (!isFiniteChannelValue(incoming)) continue

  if (HTP_INTENSITY_CHANNELS.has(key)) {
    const current = record[key]
    if (current === undefined || incoming > current) {
      record[key] = incoming
    }
    continue
  }
  // LTP normal para el resto
  if (!MANUAL_HARD_LOCK_EXCLUDED_CHANNELS.has(key)) {
    let lockRecord = this._manualChannelLocks.get(nodeId)
    if (!lockRecord) {
      lockRecord = {}
      this._manualChannelLocks.set(nodeId, lockRecord)
    }
    lockRecord[key] = incoming
  }
  record[key] = incoming
}
```

### 1.6 Intensity Lock — Node-Wide, No Fixture-Wide

**Sustituir** el bloque `@NodeArbiter.ts:468-503`:

```typescript
// ANTES — fixture-wide explosion:
for (const [candidateNodeId, candidateRecord] of this._result) {
  if (!candidateNodeId.startsWith(fixturePrefix)) continue
  candidateRecord['dimmer'] = lockValue
  candidateRecord['brightness'] = lockValue
}
const colorNodeId = `${fixtureId}:color`
let colorRecord = this._result.get(colorNodeId)
if (!colorRecord) { /* forzar creación */ }
colorRecord['dimmer'] = lockValue
colorRecord['brightness'] = lockValue
```

**Por** (WAVE 4751):

```typescript
// WAVE 4751: SOLO el nodo que el operador tocó queda lockeado.
// Los nodos hermanos (otros cells, otras familias) siguen siendo
// gobernados por L0 según las reglas HTP/LTP normales.
if (this._manualDimmerLocks.size > 0) {
  for (const [nodeId, lockValue] of this._manualDimmerLocks) {
    let record = this._result.get(nodeId)
    if (!record) {
      record = this._acquireRecord()
      this._result.set(nodeId, record)
    }
    // HTP local: el lock define un piso, no un valor absoluto.
    // Si L3 effect quiere subirlo, puede (siempre que no sea dimmer=0).
    const current = record['dimmer']
    if (current === undefined || lockValue > current) {
      record['dimmer'] = lockValue
    }
    const currentB = record['brightness']
    if (currentB === undefined || lockValue > currentB) {
      record['brightness'] = lockValue
    }
  }
}
```

**Eliminar** completamente el bloque que fuerza `:color` y el barrido por `fixturePrefix`. Si el operador toca dimmer en `:impact`, eso NO afecta dimmer/brightness de `:color` del mismo fixture.

### 1.7 EL FRENO SUAVE — Release Time

**Nuevas interfaces de estado:**

```typescript
// ── WAVE 4751: RELEASE TIME — fade L2→L0 al liberar override ──────────
interface ReleaseState {
  readonly nodeId: NodeId
  readonly channels: Readonly<Record<string, number>>  // valores en el momento del clear
  readonly startedAtMs: number
  readonly durationMs: number
}

private readonly _releaseStates = new Map<NodeId, ReleaseState>()
private readonly DEFAULT_RELEASE_MS = 500  // 500ms fade por defecto
```

**Refactor de `clearManualOverride`:**

```typescript
clearManualOverride(nodeId: NodeId, releaseMs?: number): void {
  const channels = this._manualOverrides.get(nodeId)
  if (channels) {
    // Capturar snapshot de los valores actuales
    const snapshot: Record<string, number> = {}
    for (const key in channels) {
      const v = channels[key]
      if (isFiniteChannelValue(v)) snapshot[key] = v
    }
    this._releaseStates.set(nodeId, {
      nodeId,
      channels: snapshot,
      startedAtMs: performance.now(),
      durationMs: releaseMs ?? this.DEFAULT_RELEASE_MS,
    })
  }
  this._manualOverrides.delete(nodeId)
}
```

**Aplicación del fade en `arbitrate()`** — nuevo bloque DESPUÉS de L2 y ANTES del Manual Hard Lock:

```typescript
// ── WAVE 4751: APLICAR RELEASE FADE — interpolación L2→L0 ────────────
if (this._releaseStates.size > 0) {
  const now = performance.now()
  for (const [nodeId, rel] of this._releaseStates) {
    const elapsed = now - rel.startedAtMs
    if (elapsed >= rel.durationMs) {
      // Fade completado: limpiar y dejar que L0 gobierne
      this._releaseStates.delete(nodeId)
      continue
    }
    // Curva de fade: ease-out cubic (suave al final)
    const t = elapsed / rel.durationMs
    const fadeWeight = 1 - Math.pow(t, 3)  // 1.0 al inicio, 0.0 al final

    let record = this._result.get(nodeId)
    if (!record) {
      record = this._acquireRecord()
      this._result.set(nodeId, record)
    }
    for (const key in rel.channels) {
      const releaseValue = rel.channels[key]
      const l0Value = record[key]
      if (l0Value !== undefined && Number.isFinite(l0Value)) {
        // Mezcla: blend entre el último valor manual y lo que L0 quiere
        record[key] = releaseValue * fadeWeight + l0Value * (1 - fadeWeight)
      } else {
        // L0 no escribió este canal: fade hacia 0 (o hacia el default del nodo)
        record[key] = releaseValue * fadeWeight
      }
    }
  }
}
```

**Nota:** Esta interpolación NO se aplica a canales que están en `MANUAL_HARD_LOCK_EXCLUDED_CHANNELS` (pan_base/tilt_base) — esos siguen su propia lógica de anchor.

### 1.8 API Pública Actualizada

```typescript
// INodeArbiter — añadir releaseMs opcional
interface INodeArbiter {
  // ...existing...
  clearManualOverride(nodeId: NodeId, releaseMs?: number): void
}
```

---

## 2. LA HIGIENE DE SELENE — `LiquidEngineBase.ts` + `LiquidAetherAdapter.ts`

### 2.1 Contexto de Zona para Strobe

**Problema actual:** `calculateStrobe()` mira solo `treble`/`ultraAir`, sin saber qué zona dispara. Resultado: cualquier hi-hat enciende strobe globalmente.

**Diseño:** Añadir una política de strobe por zona en el perfil.

**Nueva interfaz en `ILiquidProfile`:**

```typescript
// src/hal/physics/profiles/ILiquidProfile.ts
export interface IStrobePolicy {
  /** Zonas donde el strobe está PERMITIDO. Resto: estrictamente 0. */
  readonly allowedZones: ReadonlySet<ZoneId>
  /** Multiplicador final (0-1) aplicado al `intensity` antes del bus. */
  readonly intensityMultiplier: number
}

// Default seguro:
export const DEFAULT_STROBE_POLICY: IStrobePolicy = {
  allowedZones: new Set(['flash', 'nuke', 'front', 'mover']),
  intensityMultiplier: 1.0,
}
```

**Refactor de `LiquidAetherAdapter._routeStrobeNodes`:**

```typescript
// ──────────────────────────────────────────────────────────────────────
// WAVE 4751: Strobe SOLO en zonas explícitamente permitidas
// ──────────────────────────────────────────────────────────────────────
private _routeStrobeNodes(result: LiquidStereoResult, bus: IIntentBus): void {
  if (!result.strobeActive) return
  const policy = this._strobePolicy ?? DEFAULT_STROBE_POLICY
  const impactNodes = this._nodeGraph.getView(NodeFamily.IMPACT)
  const finalIntensity = result.strobeIntensity * policy.intensityMultiplier

  impactNodes.forEach((node) => {
    const hasShutter = node.channels.some((ch) => ch.type === 'shutter')
    if (!hasShutter) return

    // 🛡 Higiene de zona: solo strobe si la zona del nodo está permitida.
    const zone = node.zoneId ?? ''
    if (!policy.allowedZones.has(zone as ZoneId)) return

    this._strobeValues['shutter']    = 1.0
    this._strobeValues['strobeRate'] = finalIntensity
    this._strobeScratch.nodeId       = node.nodeId
    bus.push(this._strobeScratch as INodeIntent)
  })
}
```

**Inyección de la policy:**

```typescript
// LiquidAetherAdapter
private _strobePolicy: IStrobePolicy = DEFAULT_STROBE_POLICY

setStrobePolicy(policy: IStrobePolicy): void {
  this._strobePolicy = policy
}
```

**Asegurar que `_routeStrobeNodes` se invoca desde `ingest()`:**

```typescript
ingest(_frame: ProcessedFrame, result: LiquidStereoResult, bus: IIntentBus): void {
  // ... lógica existente IMPACT/COLOR ...

  // ── WAVE 4751: routing explícito de strobe (faltaba la llamada)
  if (result.strobeActive) {
    this._routeStrobeNodes(result, bus)
  }
}
```

### 2.2 Default Values Seguros — `NodeExtractionPipeline._resolveDefaultValue`

**Estado actual** (`@NodeExtractionPipeline.ts:1137-1156`):

```typescript
if (type === 'shutter' || type === 'strobe') {
  return 255
}
```

✅ Ya retorna 255 para shutter/strobe **cuando no hay `defaultValue` explícito**. Sin embargo:

**Cambio propuesto** — **strobe debería default a 0, NO 255**:

```typescript
// WAVE 4751: separar políticas de default
// - shutter: 255 (abierto, deja pasar luz)
// - strobe:    0 (sin parpadeo en silencio)
if (type === 'shutter') return 255
if (type === 'strobe')  return 0
```

**Justificación:** Shutter abierto = la luz pasa. Strobe = velocidad del parpadeo. Si strobe arranca en 255, el fixture parpadea a velocidad máxima en idle. Debe ser 0 en pasajes tranquilos. Esto cumple la regla del usuario: *"strobe channel debe ser estrictamente cero en pasajes tranquilos"*.

---

## 3. REGLAS DE MEZCLA FINALES (HTP/LTP)

### 3.1 Tabla Definitiva Post-WAVE-4751

| Canal | Regla | Notas |
|-------|-------|-------|
| `dimmer` | **HTP global** (max entre TODAS las capas) | L3 effect dimmer=0 es excepción destructiva |
| `brightness` | **HTP global** | Idéntico a dimmer (es el dimmer virtual de RGB) |
| `strobe` | **LTP estricto por capa** | L0 controla solo si zona permitida; L2/L3 pueden pisar |
| `shutter` | **LTP estricto por capa** | Default seguro 255 |
| `r/g/b`, `red/green/blue`, `white`, `amber` | **LTP por canal-tocado** | L0 escribe si L2/LP NO tocaron ESE canal en ESE nodo |
| `pan`, `tilt` | **LTP por canal-tocado** | Igual; pan_base/tilt_base manejados por motor cinético |
| `gobo`, `prisma`, `zoom`, `focus`, `frost` | **LTP por canal-tocado** | Idem |
| `color_wheel` | **LTP por canal-tocado** | Protegido por DarkSpin en NodeResolver |
| `pan_base`, `tilt_base` | L2 anchor exclusivo | Excluidos de Manual Hard Lock |

### 3.2 Eliminación de Constantes Obsoletas

```typescript
// ELIMINAR (ya no se usan):
// const OPAQUE_BLOCKED_CHANNELS_L0_L1 = new Set([...])

// MANTENER:
const STRICT_PRIORITY_CHANNELS = new Set(['strobe', 'shutter'])  // dimmer/brightness movidos a HTP
const HTP_INTENSITY_CHANNELS   = new Set(['dimmer', 'brightness'])  // NUEVO
const MOVER_SHIELD_BLOCKED_CHANNELS = ...  // INTACTO (regla L1 mover shield)
const MANUAL_HARD_LOCK_EXCLUDED_CHANNELS = ...  // INTACTO
```

---

## 4. ORQUESTACIÓN DE CAMBIOS — Orden de Ejecución

| Fase | Cambio | Archivos | Prueba |
|------|--------|----------|--------|
| 1 | Añadir `HTP_INTENSITY_CHANNELS` + lógica HTP en `_applyIntent` | `NodeArbiter.ts` | Unit test: 3 capas escribiendo dimmer → max gana |
| 2 | Reemplazar `_opaqueFixtureIds` por `_opaqueNodeChannels` + pool | `NodeArbiter.ts` | Unit test: L2 toca dimmer en `:impact` → L0 sigue escribiendo `r/g/b` en `:color` |
| 3 | Refactor Intensity Lock node-wide | `NodeArbiter.ts` | Unit test: lock solo afecta el nodo tocado |
| 4 | Implementar `ReleaseState` + fade en arbitrate | `NodeArbiter.ts` | Integration test: toggle override, medir transición 500ms |
| 5 | Strobe policy por zona | `LiquidAetherAdapter.ts`, `ILiquidProfile.ts` | Manual: tocar fixture en zona `ambient` → strobe stays 0 |
| 6 | Strobe default 0 en pipeline | `NodeExtractionPipeline.ts` | Inspección DMX buffer en idle |
| 7 | Cleanup constantes obsoletas | `NodeArbiter.ts` | tsc --noEmit |

---

## 5. FIRMAS DE FUNCIONES MODIFICADAS

### NodeArbiter.ts

```typescript
class NodeArbiter implements INodeArbiter {
  // NUEVO ESTADO
  private readonly _opaqueNodeChannels:     Map<NodeId, Set<string>>
  private readonly _opaquePlaybackChannels: Map<NodeId, Set<string>>
  private readonly _channelSetPool:         Set<string>[]
  private          _channelSetCursor:       number
  private readonly _releaseStates:          Map<NodeId, ReleaseState>
  private readonly DEFAULT_RELEASE_MS = 500

  // FIRMA MODIFICADA
  clearManualOverride(nodeId: NodeId, releaseMs?: number): void

  // FIRMA NUEVA (privadas)
  private _acquireChannelSet(): Set<string>
  private _applyReleaseFades(now: number): void
}
```

### LiquidAetherAdapter.ts

```typescript
class LiquidAetherAdapter {
  private _strobePolicy: IStrobePolicy

  setStrobePolicy(policy: IStrobePolicy): void
  // _routeStrobeNodes: firma intacta, lógica modificada
  // ingest: ahora invoca _routeStrobeNodes cuando strobeActive
}
```

### ILiquidProfile.ts

```typescript
export interface IStrobePolicy {
  readonly allowedZones:         ReadonlySet<ZoneId>
  readonly intensityMultiplier:  number
}
export const DEFAULT_STROBE_POLICY: IStrobePolicy
```

### NodeExtractionPipeline.ts

```typescript
// _resolveDefaultValue: misma firma, lógica separada shutter (255) vs strobe (0)
```

---

## 6. INVARIANTES Y GARANTÍAS

**Después de WAVE 4751:**

1. **El operador toca dimmer en `:impact`** → L0 sigue escribiendo `r/g/b` en `:color`. El fixture conserva su color generado por la música; solo la intensidad responde al fader.
2. **L0 quiere dimmer 0.3, operador pone fader a 0.8** → HTP da 0.8.
3. **L0 quiere dimmer 0.9, operador pone fader a 0.4** → HTP da 0.9 (luz no baja por debajo de lo que el sistema dictó). *(Política operativa — discutible; ver §7 abajo)*.
4. **Operador libera fader** → `clearManualOverride` arranca fade de 500ms. Luz transita suavemente al estado L0 sin chasquido.
5. **En zona `ambient` o `floor`** → strobe es 0 garantizado por policy.
6. **Fixture en idle (sin audio)** → shutter abierto (255), strobe en 0.

---

## 7. PUNTOS DE DECISIÓN PENDIENTES (Para el operador)

### 7.1 Semántica del Fader Manual de Dimmer

- **Opción A (HTP estricto):** Manual no puede bajar la intensidad — sumas tu fader al sistema.
- **Opción B (LTP estricto):** Manual gana siempre — bajar el fader apaga el fixture.
- **Opción C (Manual fader como "ceiling"):** El fader define el máximo, L0 modula por debajo.

**Por defecto sugerido:** Opción B (LTP) — comportamiento clásico de mesa. La tabla §3.1 reflejaría:
- `dimmer`: **LTP por canal-tocado** (no HTP).

> ⚠ Si el usuario prefiere HTP, mantener el diseño actual. Si prefiere LTP, reemplazar `HTP_INTENSITY_CHANNELS` por aplicación LTP normal en el bucle L2 y eliminar el bloque HTP especial.

### 7.2 Duración del Release Fade

- 500ms (default propuesto) — bueno para colores y dimmer.
- ¿Más corto para dimmer (200ms) y más largo para pan/tilt (1000ms)? — posible mejora futura.

### 7.3 Zonas Permitidas para Strobe

Default propuesto: `['flash', 'nuke', 'front', 'mover']`. Verificar que estos ZoneId existen en el sistema canónico.

---

## 8. CHECKLIST DE EJECUCIÓN

- [ ] Confirmar política de dimmer (HTP vs LTP) con operador
- [ ] Confirmar zonas permitidas de strobe contra `ZONE_REGISTRY`
- [ ] Implementar Fase 1 (HTP intensity) → tests
- [ ] Implementar Fase 2 (opaque mask granular) → tests
- [ ] Implementar Fase 3 (intensity lock node-wide) → tests
- [ ] Implementar Fase 4 (release time) → integration test
- [ ] Implementar Fase 5 (strobe policy) → audit manual
- [ ] Implementar Fase 6 (strobe default 0) → DMX inspection
- [ ] Cleanup Fase 7 → `tsc --noEmit`
- [ ] Smoke test completo: pasaje ambiental + tocar dimmer manual + soltar
- [ ] Smoke test: pasaje con kick + verificar que strobe NO dispara en `floor`/`ambient`

---

## 9. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|-----------|
| Eliminar fixture-wide opaque mask deja a L0 inyectando ruido visual | Filtro per-channel-touched es semánticamente más fino, no más laxo |
| HTP de dimmer cambia el comportamiento esperado del fader | Decisión 7.1 — si LTP es preferido, ajustar Fase 1 antes de mergear |
| Release fade introduce latencia perceptual al soltar | 500ms es estándar en consolas (Hog/MA); ajustable por nodo si hace falta |
| Strobe policy rompe shows existentes que dependían de strobe global | Default policy es permisiva en zonas dinámicas; solo bloquea zonas base |
| `_routeStrobeNodes` no se invocaba antes — añadirlo puede causar strobe inesperado | Mitigado por la policy: solo se activa en zonas explícitamente permitidas |

---

**FIN DEL BLUEPRINT — Listo para autorización de ejecución por fases.**
