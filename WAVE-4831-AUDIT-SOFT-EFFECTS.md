# WAVE 4831 — AUDITORÍA: EFECTOS BLANDOS NO SE PINTAN (CumbiaMoon, CorazonLatino, TidalWave)

> **Mandato:** Solo lectura y reporte. Cero modificaciones de código.
>
> **Objetivo:** Determinar por qué efectos "soft" / ambient / transición como `cumbia_moon`, `corazon_latino` y `tidal_wave` no renderizan (no se "pintan"), mientras que efectos "tiranos" / hard como `strobe_storm` sí lo hacen.
>
> **Fecha:** 2026-05-16

---

## 🔍 Hallazgo Principal: El Gate de `globalComposition` mata a los efectos blandos

**NO es el árbitro.** El árbitro funciona correctamente — L3 domina L0/L1. El problema está **dos pasos antes**, en `SeleneAetherAdapter.ingest()`.

---

## 🧭 Ruta de la señal: Frame Loop

```
TitanOrchestrator.processFrame()
  ↓
1. effectManager.getCombinedOutput()  ← AGREGA outputs de efectos activos
  ↓
2. SeleneAetherAdapter.ingest(combinedOutput, bus)  ← EMITE intents al IIntentBus
  ↓
3. NodeArbiter.arbitrate(bus, manualOverrides, hephaestus)  ← RESUELVE L4>L3>L2>L1>L0
  ↓
4. NodeResolver.resolve(arbitratedMap)  ← TRADUCE a canales DMX
  ↓
5. HAL.sendUniverseRaw()  ← ENVÍA a hardware
```

El problema está en el **PASO 2**.

---

## 🔬 Análisis de `EffectManager.getCombinedOutput()`

```typescript
// @src/core/effects/EffectManager.ts:700-869
let globalComposition = 0
// ...
for (const [id, effect] of this.activeEffects) {
  let output = effect.getOutput()
  if (!output) continue
  // ...
  if (output.globalComposition !== undefined && output.globalComposition > globalComposition) {
    globalComposition = output.globalComposition
  }
}
return {
  // ...
  globalComposition,  // ← 0 si NINGÚN efecto define globalComposition
}
```

**Problema:** Los efectos blandos (`CumbiaMoon`, `CorazonLatino`, `TidalWave`) y también **algunos tiranos** (`OroSolido`) **NO definen `globalComposition`** en su `getOutput()`. El valor acumulado queda en `0`.

### Efectos que NO definen `globalComposition`:

| Efecto | Tipo | `priority` | `mixBus` | ¿Pinta? |
|---|---|---|---|---|
| `cumbia_moon` | Ambient | 65 | `global` | ❌ NO |
| `corazon_latino` | Soft/Transition | 85 | `htp` | ❌ NO |
| `tidal_wave` | Ambient | 70 | `global` | ❌ NO |
| `oro_solido` | Tirano (hard) | 98 | `global` | ❌ NO |
| `ghost_breath` | Ambient | — | — | ❌ NO |

### Efectos que SÍ definen `globalComposition`:

| Efecto | `globalComposition` | ¿Pinta? |
|---|---|---|
| `strobe_storm` | `1.0` | ✅ SÍ |
| `solar_flare` | `1.0` | ✅ SÍ |

---

## 💀 El Gate Asesino: `SeleneAetherAdapter.ingest()`

```typescript
// @src/core/aether/adapters/selene-aether-adapter.ts:236-242
const composition = effectOutput.globalComposition ?? 1
if (
  effectOutput.globalComposition !== undefined &&
  composition < MIN_GLOBAL_COMPOSITION  // MIN_GLOBAL_COMPOSITION = 0.01
) {
  return  // ← 💀 MUERTE SILENCIOSA. Zero intents emitted.
}
```

**Lógica del gate:**

| `globalComposition` | `composition` | `composition < 0.01` | Resultado |
|---|---|---|---|
| `undefined` | `1` (fallback `?? 1`) | `false` | ✅ Pasa |
| `1.0` | `1.0` | `false` | ✅ Pasa |
| `0` | `0` | **`true`** | ❌ **MUERE** |

Cuando `globalComposition = 0` (porque ningún efecto activo lo define), el adapter hace **early return** y **nunca emite un solo intent** al `IIntentBus`. Los efectos son silenciados antes de que el `ZoneNodeRouter` siquiera los vea.

> **Nota:** Si hay UN solo efecto con `globalComposition: 1.0` (ej. `strobe_storm`) en el pool, el combined output tiene `globalComposition = 1.0`, y TODOS los efectos pasan el gate — incluyendo los blandos. Esto explica por qué a veces "funcionan intermitentemente": cuando un tirano con `globalComposition` está activo, los blandos se ven arrastrados.

---

## 🛡️ ¿Por qué NO es el árbitro?

En `NodeArbiter._applyIntent()`:

- **`STRICT_PRIORITY_CHANNELS`** (`dimmer`, `strobe`, `shutter`, `brightness`): LTP estricto entre capas. L3 gana sobre L0/L1. Entre intents L3, el último en escribir gana.
- **Canales de color** (`r`, `g`, `b`, `white`, `amber`): LTP puro. L3 sobreescribe a L0/L1.

El **Absolute L3 Override** (WAVE 4829) bloquea L0/L1 en canales que L3 ya tocó:

```typescript
// @src/core/aether/NodeArbiter.ts:510-789
if (this._l3DominatedChannels?.has(channel)) continue  // L0/L1 silenciados
```

El árbitro está **correcto**. Si los intents blandos llegaran, dominarían L0/L1 sin problema.

---

## 🔀 LTP vs HTP en la combinación de efectos

En `EffectManager.getCombinedOutput()`:

| Canal | Regla | Nota |
|---|---|---|
| `dimmer` | HTP (máximo) | Entre efectos en la **misma zona** |
| `white` | HTP (máximo) | Entre efectos en la **misma zona** |
| `amber` | HTP (máximo) | Entre efectos en la **misma zona** |
| `color` | LTP por prioridad | Mayor `priority` gana en la **misma zona** |
| `movement` | LTP por prioridad | Mayor `priority` gana |

Esto significa que si un tirano (`priority=98, dimmer=1.0`) y un blando (`priority=65, dimmer=0.2`) comparten zona `front`, el tirano gana el dimmer (HTP) y el color (LTP por prioridad). **Pero esto solo ocurre si ambos pasan el gate de `globalComposition`.**

---

## 📋 Autopsia de efectos blandos

### CumbiaMoon

```typescript
// @src/core/effects/library/fiestalatina/CumbiaMoon.ts
readonly priority = 65
override readonly mixBus = 'global' as const
// getOutput() devuelve:
//   zoneOverrides: { 'front': { color, dimmer, blendMode: 'max' }, ... }
//   overrideMoverShield: true
// ❌ NO define globalComposition
```

### CorazonLatino

```typescript
// @src/core/effects/library/fiestalatina/CorazonLatino.ts
readonly priority = 85
readonly mixBus = 'htp' as const
// getOutput() devuelve:
//   zoneOverrides: { 'back': { color, dimmer, blendMode: 'max' }, ... }
//   overrideMoverShield: true
// ❌ NO define globalComposition
```

### TidalWave

```typescript
// @src/core/effects/library/fiestalatina/TidalWave.ts
readonly priority = 70
override readonly mixBus = 'global' as const
// getOutput() devuelve:
//   zoneOverrides: { 'movers-left': { color, dimmer, blendMode: 'replace' }, ... }
//   overrideMoverShield: true
// ❌ NO define globalComposition
```

### StrobeStorm (referencia — SÍ funciona)

```typescript
// @src/core/effects/library/fiestalatina/StrobeStorm.ts:327
globalComposition: 1.0,  // ✅ SÍ define globalComposition
```

---

## 🧟 Código muerto relevante

`IntentComposer` (`src/core/orchestrator/IntentComposer.ts`) se instancia en `TitanOrchestrator`:

```typescript
// @src/core/orchestrator/TitanOrchestrator.ts:364
private intentComposer = new IntentComposer()
```

**Nunca se usa** en el frame loop actual. Fue reemplazado por `SeleneAetherAdapter.ingest()` en WAVE 4592→4703, pero quedó como zombi en memoria.

---

## 📊 Resumen Ejecutivo

| Pregunta | Respuesta |
|---|---|
| ¿Faltan zonas ambient? | **No.** `ZoneNodeRouter` tiene `ambient`, `air`, `front`, `back`, `all-movers`, etc. |
| ¿Están en "zona flash"? | **No.** Las zonas están bien definidas y el router las resuelve correctamente. |
| ¿Es el árbitro? | **No.** L3 tiene supremacía correcta sobre L0/L1. |
| ¿LTP vs HTP en L3? | Dimmes es LTP estricto entre capas (L3 gana). Color es LTP puro (L3 gana). |
| **¿Por qué no se pintan?** | **`globalComposition = 0`** cuando ningún efecto lo define → `SeleneAetherAdapter` retorna early. |
| ¿Por qué StrobeStorm sí? | Define `globalComposition: 1.0`. |
| ¿OroSolido también falla? | **Sí.** No define `globalComposition` → también es silenciado por el gate. |
| ¿Por qué funcionan a veces? | Si un efecto con `globalComposition=1.0` está activo, el combined output hereda `1.0` y todos pasan. |

---

## 📝 Recomendaciones arquitectónicas (solo orientativas)

### Opción A — Fix mínimo por efecto

Cada efecto que falta debe definir `globalComposition: 1.0` en su `getOutput()`:

```typescript
return {
  // ... zoneOverrides, etc.
  globalComposition: 1.0,  // ← Añadir
}
```

**Pros:** Zero riesgo. Cada efecto declara explícitamente su intención de componerse.
**Cons:** Tedioso. Hay ~15 efectos que necesitarían este cambio.

### Opción B — Fix robusto en el adapter

Cambiar el gate en `SeleneAetherAdapter.ingest()` para que un `globalComposition = 0` NO bloquee cuando hay `zoneOverrides` activos:

```typescript
const composition = effectOutput.globalComposition ?? 1
const hasZoneOverrides = effectOutput.zoneOverrides && Object.keys(effectOutput.zoneOverrides).length > 0
if (composition < MIN_GLOBAL_COMPOSITION && !hasZoneOverrides) {
  return
}
```

**Pros:** Un solo cambio. No toca los efectos.
**Cons:** Cambia la semántica del gate. Podría permitir efectos "vacíos" que antes se filtraban.

### Opción C — Fix en EffectManager

En `EffectManager.getCombinedOutput()`, usar `globalComposition = 1` como default en vez de `0`, o tomar el máximo incluyendo `undefined` como `1`:

```typescript
let globalComposition = 1  // ← Default 1 en vez de 0
```

**Pros:** Un solo cambio. El `?? 1` en el adapter ya asume esto implícitamente.
**Cons:** Rompe el contrato de "efecto vacío = no compone". Podría causar side effects en efectos legacy.

### Opción D — Fix híbrido (recomendado)

1. **Efectos nuevos:** Siempre definir `globalComposition` en su output (buena práctica).
2. **Adapter:** Añadir fallback seguro: si `hasActiveEffects && globalComposition === 0`, setear a `1` (porque la presencia de un efecto activo implica intención de componer).
3. **BaseEffect:** Añadir `globalComposition = 1` como default en la clase base para que todos los efectos hereden el valor correcto.

---

*Reporte generado por Auditor WAVE 4831. Solo lectura. Cero modificaciones.*
