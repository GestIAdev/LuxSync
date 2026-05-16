# WAVE 4832 + 4833 — FIX ARQUITECTÓNICO: BlendMode propagation L3 (HTP vs LTP) + ZoneNodeRouter type safety

## 🩸 WAVE 4833 — EL BUG RAÍZ DEFINITIVO

> Detectado en la **tercera iteración** tras observar en logs `[NodeArbiter 🔬] sample[[object Object]]`. Los WAVE 4832 fixes (blendMode propagation) eran necesarios pero NO suficientes. La cadena completa requería este otro fix downstream.

### Causa

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\helpers\zone-node-router.ts:240-252` (antes del fix)

```ts
const nodesInZone = view.byZone(zone as ZoneId)
const nodeIds = nodesInZone as unknown as readonly NodeId[]   // ☠️ MENTIRA AL TIPADO
```

`view.byZone()` retorna `readonly ICapabilityNode[]` (objetos completos), pero el cast `as unknown as readonly NodeId[]` engañaba al compilador. A runtime los elementos seguían siendo OBJETOS.

### Cadena de fallo

1. `_emitImpact` hacía `scratch.nodeId = nodeIds[i]` ← `nodeIds[i]` era un objeto, no un string.
2. `bus.push()` copiaba la referencia objeto al slot.
3. `NodeArbiter._applyIntent` hacía `_result.get(intent.nodeId)` con un objeto como clave del Map → cada referencia distinta creaba una entrada nueva, totalmente desconectada del nodeId-string que usa el resto del sistema.
4. `AetherUIProjector` y `NodeResolver` hacían `arbitrated.get('<uuid>:back:impact')` con strings → `undefined`. Las entradas existían bajo claves-objeto.

### Por qué los hard effects sí pintaban

- `LatinaMeltdown`/`CoreMeltdown` emiten `dimmerOverride` global → adapter llama `_emitImpact('all', ...)`.
- La zona `'all'` se construye en otro camino (`view.forEach(node => allNodeIds.push(node.nodeId))`) que extrae el string correctamente.
- Por eso solo los efectos con override global funcionaban — TODOS los demás (CorazonLatino, SalsaFire, TidalWave, CumbiaMoon...) eran invisibles aguas abajo, sin importar lo correctos que fuesen sus `blendMode`/`mergeStrategy`.

### Fix

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\helpers\zone-node-router.ts:240-275`

```ts
const nodesInZone = view.byZone(zone as ZoneId)
const nodeIds: NodeId[] = []
for (let n = 0; n < nodesInZone.length; n++) {
  nodeIds.push(nodesInZone[n].nodeId)   // ✅ Extraer string explícitamente
}
familyMap.set(family, Object.freeze(nodeIds))
```

Aplicado en las dos ocurrencias del constructor (mapeo canónico + absorción de zonas legacy).

### Evidencia (sondas WAVE 4832)

```
[NodeArbiter 🔬] L3 intents=22 sample[[object Object]] merge=HTP dimmer=0.43
                                       ^^^^^^^^^^^^^^
                                       el smoking gun
```

Tras WAVE 4833, `sample[fixture-uuid:back:impact]` aparecerá como string limpio y los efectos blandos pintarán como diseño manda — **con el comportamiento HTP/LTP correcto** que ya estaba implementado pero nunca se ejecutaba sobre nodos reales.

---

# WAVE 4832 — FIX ARQUITECTÓNICO: BlendMode propagation L3 (HTP vs LTP)

> **Estado:** ✅ Implementado. `tsc --noEmit`: 0 errores.
>
> **Reemplaza:** El diagnóstico de WAVE-4831-AUDIT-SOFT-EFFECTS.md (incorrecto en la causa raíz).
>
> **Fecha:** 2026-05-16

---

## 🩻 Reverificación del diagnóstico anterior (WAVE 4831)

La auditoría previa apuntaba al gate de `globalComposition < 0.01` en `SeleneAetherAdapter.ingest()` como asesino silencioso de los efectos blandos. **Eso es falso.** Verificación línea por línea:

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\EffectManager.ts:872`
```ts
globalComposition: globalComposition > 0 ? globalComposition : undefined,
```

Si ningún efecto activo declara `globalComposition`, el output emite **`undefined`**, NO `0`.

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\selene-aether-adapter.ts:236-242`
```ts
const composition = effectOutput.globalComposition ?? 1
if (
  effectOutput.globalComposition !== undefined &&
  composition < MIN_GLOBAL_COMPOSITION
) {
  return
}
```

Con `globalComposition === undefined`, el `&&` corto-circuita → el gate **NO bloquea**. Los efectos blandos pasan el gate sin problema.

---

## 🎯 Causa raíz REAL

El adapter ignora deliberadamente `override.blendMode` (línea original 330):

```ts
// blendMode/priority/metadatos viejos se ignoran: la mezcla ya la decide el Arbiter.
void override.blendMode
```

**Pero el Arbiter tampoco la recibía** — la información se perdía en el adapter. Resultado:

| Efecto | `blendMode` declarado por zona | `mergeStrategy` recibido por Arbiter |
|---|---|---|
| `oro_solido` | `'replace'` | (ignorado) → LTP por defecto ✅ correcto |
| `strobe_storm` | `'replace'` | (ignorado) → LTP por defecto ✅ correcto |
| `cumbia_moon` front/back | **`'max'`** | (ignorado) → LTP ❌ **incorrecto** |
| `corazon_latino` todas | **`'max'`** | (ignorado) → LTP ❌ **incorrecto** |
| `tidal_wave` | `'replace'` | (ignorado) → LTP ✅ correcto |

Cuando el Arbiter aplica L3 con **LTP estricto** (WAVE 4829 Absolute L3 Override):

- `L0 LiquidEngine` escribe `dimmer = 0.8` (música a tope) → L0 dominado por L3.
- `L3 CumbiaMoon` escribe `dimmer = 0.30` → **gana LTP**.
- Resultado físico: el fixture se **apaga al 30%** justo cuando el efecto blando "entra".

Lo mismo en `corazon_latino`: el dimmer del corazón (`heartIntensity * 0.8 ≈ 0.5`) sustituye al brillo musical. Visual: parece un **fade-out** o **blackout parcial**, no un tintado.

**Esto es lo que el usuario describe como "los efectos blandos no se pintan".** El efecto SÍ se aplica, pero su baja luminancia destruye el show en vez de adornarlo.

---

## 🧬 Solución arquitectónica (no parche)

El campo `blendMode` ya existía en el contrato de efectos desde WAVE 780 con semántica clara:

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\types.ts:241-246`
```ts
/**
 * 🎚️ WAVE 780: BLEND MODE
 * - 'replace': LTP - El efecto manda (ducking para efectos espaciales)
 * - 'max': HTP - El más brillante gana (energía para efectos aditivos)
 */
blendMode?: 'replace' | 'max'
```

El contrato es correcto. Lo que faltaba era **propagarlo hasta el Arbiter** y que éste lo respetara per-intent.

### Cambios implementados

#### 0. `EffectManager.getCombinedOutput` — **EL MISSING LINK**

> Detectado en una segunda iteración tras observar que el fix L3+adapter no surtía efecto en runtime: el `blendMode` se perdía **antes** de llegar al adapter.

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\EffectManager.ts:800-834`

El tipo local `ZoneOverrideData` no incluía `blendMode`, así que el cast `as [string, ZoneOverrideData][]` lo silenciaba y el ciclo de combinación nunca lo copiaba al `combinedZoneOverrides[zoneId]`. Síntoma: `output.zoneOverrides['back'].blendMode === undefined` siempre, sin importar lo que el efecto hubiese declarado.

```ts
type ZoneOverrideData = {
  // …color/dimmer/white/amber/movement…
  blendMode?: 'replace' | 'max'   // ← AÑADIDO
}

// Inicialización: heredar del primer efecto
combinedZoneOverrides[zoneId] = {
  priority: effect.priority,
  blendMode: zoneData.blendMode,
}

// Refinamiento: el efecto de mayor prioridad manda (mismo criterio que color)
if (zoneData.blendMode !== undefined && effect.priority >= existingPriority) {
  existing.blendMode = zoneData.blendMode
}
```

Sin esta corrección, las cuatro siguientes piezas estaban implementadas correctamente pero recibían siempre `mergeStrategy='LTP'` por defecto. **El fix arquitectónico solo completa cuando el dato cruza los cuatro saltos: efecto → EffectManager → adapter → IntentBus → Arbiter.**

#### 1. `INodeIntent` — Nuevo campo opcional `mergeStrategy`

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\intent-bus.ts:112-132`

```ts
/**
 * 🌊 WAVE 4832: PER-INTENT MERGE STRATEGY
 * - 'LTP' (default): el intent reemplaza y, para L3, registra dominación.
 * - 'HTP':           record[ch] = max(record[ch], v). No domina → L0 contribuye.
 * - 'ADD':           reservado, no usado en L3.
 */
mergeStrategy?: MergeStrategy
```

#### 2. `IntentBus` — Propagación a través del pool

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\IntentBus.ts:100-110`

El `IntentSlot` pre-allocated ahora incluye `skipDarkSpin` y `mergeStrategy`. `push()` los copia del intent al slot. **Bug colateral corregido:** `skipDarkSpin` (WAVE 4831) tampoco se propagaba — los scratch objects del adapter perdían su semántica al cruzar el bus.

#### 3. `SeleneAetherAdapter` — Traducción `blendMode → mergeStrategy`

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\selene-aether-adapter.ts:43-47`

```ts
function blendModeToMergeStrategy(
  blendMode: 'replace' | 'max' | undefined,
): MergeStrategy {
  return blendMode === 'max' ? 'HTP' : 'LTP'
}
```

Reglas aplicadas:

| Canal | mergeStrategy | Razón |
|---|---|---|
| `dimmer` (zoneOverride) | derivado de `override.blendMode` | El usuario declara la intención |
| `white` (zoneOverride) | derivado de `override.blendMode` | Mismo principio |
| `amber` (zoneOverride) | derivado de `override.blendMode` | Mismo principio |
| `r/g/b` color | **siempre `'LTP'`** | `max(R,G,B)` rompe la identidad cromática (rojo + plata = magenta sucio) |
| `strobe`/`shutter` | siempre `'LTP'` | Canal STRICT_PRIORITY en el Arbiter |
| Global overrides | siempre `'LTP'` | `mixBus='global'` ya implica tiranía |

#### 4. `NodeArbiter._applyIntent` — Merge HTP para L3 blandos

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts:730-741`

```ts
// WAVE 4829: Registrar dominación L3 para el Escudo Anti-Sangrado.
// 🌊 WAVE 4832: SOLO se registra dominación cuando el intent es LTP.
// Los intents HTP de efectos blandos NO dominan — coexisten con L0/L1.
if ((layer === 'effect' || layer === 'hephaestus') && !useHtpMerge) {
  let dominated = this._l3DominatedChannels.get(intent.nodeId)
  // ...
  dominated.add(channel)
}
```

`@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts:770-778`

```ts
} else if (useHtpMerge) {
  // 🌊 WAVE 4832: HTP-merge para L3 blandos (blendMode='max').
  const current = record[channel]
  if (current === undefined || incoming > current) {
    record[channel] = incoming
  }
}
```

---

## 📊 Matriz de comportamiento resultante

Asumiendo que L0 LiquidEngine quiere `dimmer = 0.8` para un fixture en `front`:

| Efecto activo | blendMode front | Antes (WAVE 4831) | Después (WAVE 4832) |
|---|---|---|---|
| `oro_solido` | `'replace'` | dimmer = 1.0 (oro intenso) ✅ | dimmer = 1.0 (igual) ✅ |
| `strobe_storm` | `'replace'` | dimmer pulsado ✅ | dimmer pulsado ✅ |
| `cumbia_moon` | **`'max'`** | dimmer = 0.30 (apagado relativo) ❌ | **dimmer = max(0.8, 0.30) = 0.8 + color plateado** ✅ |
| `corazon_latino` | **`'max'`** | dimmer = 0.5 (apagón parcial) ❌ | **dimmer = max(0.8, 0.5) = 0.8 + color rojo corazón** ✅ |
| `cumbia_moon` movers | `'replace'` | dimmer = 0.045 (intencional) ✅ | dimmer = 0.045 (sin cambios) ✅ |

**Lectura visual:**
- **Tiranos** (`replace`): siguen siendo dictadores absolutos — comportamiento idéntico a antes.
- **Blandos** (`max`): ahora tintan el color sin destruir el brillo musical. Por fin son visibles.
- **Color** (r/g/b): siempre LTP — los efectos siguen imponiendo su identidad cromática (plata lunar, rojo corazón).
- **Movers en CumbiaMoon**: el efecto declara `'replace'` para movers (los quiere apagar) → ese descanso intencional se preserva.

---

## 🔍 Verificación

```bash
cd electron-app
npx tsc --noEmit
# Exit code: 0
```

Sin errores TypeScript nuevos. Sin tocar tests.

---

## 📝 Archivos modificados

| Archivo | Cambio |
|---|---|
| `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\effects\EffectManager.ts` | **MISSING LINK**: `getCombinedOutput` ahora propaga `blendMode` per-zona en `combinedZoneOverrides` (antes se perdía silenciosamente por un type-cast incompleto) |
| `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\intent-bus.ts` | Campo `mergeStrategy?: MergeStrategy` en `INodeIntent` |
| `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\IntentBus.ts` | `IntentSlot` y `push()` propagan `mergeStrategy` y `skipDarkSpin` (bug colateral) |
| `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\selene-aether-adapter.ts` | Helper `blendModeToMergeStrategy`, scratch objects tipados con `mergeStrategy`, parámetro propagado en `_emitImpact`/`_emitWhite`/`_emitAmber`, derivación desde `override.blendMode` en `_processZoneOverrides` |
| `@c:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\NodeArbiter.ts` | `_applyIntent` respeta `intent.mergeStrategy === 'HTP'` para `layer === 'effect'`: HTP-merge sin dominación |

---

## 🧭 Nota arquitectónica

Este fix **NO** invalida la WAVE 4829 (Absolute L3 Override). La supremacía L3 sigue vigente:

- **Tirano (LTP)**: domina canal, silencia L0/L1 — comportamiento WAVE 4829 intacto.
- **Blando (HTP)**: el efecto coexiste con L0/L1 — el Arbiter aplica `max()` y NO registra dominación.

La supremacía L3 ahora es **declarativa por intent**, no un dogma universal. El usuario (vía `blendMode`) decide si su efecto es dictador o aditivo. Esto es coherente con el contrato histórico de WAVE 780 y devuelve a los efectos blandos su razón de ser.

---

*WAVE 4832 — Architectural fix. No parches. Cero workarounds.*
