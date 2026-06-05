# WAVE 4994 — HEPHAESTUS V3 LFX TRACK LEAK

> **Auditoría forense. ZERO código generado.**
> **Fecha:** 2026-06-03  |  **Auditor:** Cascade (Forensic Mode)

---

## 0. RESUMEN EJECUTIVO

En `corazon_latino.lfx` la pista `heat-movers-color` (dorado, zones `["all-movers"]`) y la pista `front-glow-color` (rojo, zones `["front"]`) apuntan a conjuntos de fixtures que **se solapan** cuando un mover tiene `f.zone = 'front'`. El runtime emite dos `HephFixtureOutput` independientes; el adapter los traduce a dos `INodeIntent` con `mergeStrategy='LTP'`; el NodeArbiter aplica el segundo (rojo) sobre el primero (dorado). Resultado: los movers en front terminan rojos.

**Segundo hallazgo**: `writeOutput()` tiene un fallback destructor (`out.rgb = rgb // undefined`) que destruye la referencia pre-allocada del slot cuando se escribe un parámetro non-color. Si ese slot se reutiliza luego para color, la copia silenciosamente falla.

---

## 1. ESTRUCTURA REAL DEL CLIP V3

```json
@/electron-app/src/core/arsenal/builtins/latin/corazon_latino.lfx:174-200
  {
    "id": "heat-movers-color",
    "paramId": "color",
    "zones": ["all-movers"],
    "blendMode": "replace",
    "curve": {
      "defaultValue": { "h": 40, "s": 70, "l": 50 }   // ← DORADO
    }
  },
  ...
  {
    "id": "front-glow-color",
    "paramId": "color",
    "zones": ["front"],
    "blendMode": "replace",
    "curve": {
      "defaultValue": { "h": 352, "s": 84, "l": 46 }  // ← ROJO
    }
  }
```

---

## 2. EL EVALUADOR DE PISTAS (HephaestusRuntime.ts)

### 2.1 Bucle principal — Orden determinista

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:681-734
    for (let ti = 0; ti < active.tracks.length; ti++) {
      const track = active.tracks[ti]
      const paramName = track.paramId
      const evaluator = track.evaluator

      if (track.fixturePhases !== null && track.fixturePhases.length > 0) {
        for (let pi = 0; pi < track.fixturePhases.length; pi++) {
          const fp = track.fixturePhases[pi]
          ...
          this._emitTrackSample(track, fp.fixtureId, fixtureTimeMs,
            evaluator, paramName, intensity, isCustomThisClip, clipId)
        }
        continue
      }

      const fixtureIds = track.fixtureIds
      if (fixtureIds.length === 0) continue
      for (let fi = 0; fi < fixtureIds.length; fi++) {
        this._emitTrackSample(track, fixtureIds[fi], baseClipTimeMs,
          evaluator, paramName, intensity, isCustomThisClip, clipId)
      }
    }
```

**Hallazgo**: `front-glow-color` (track 9) se evalúa **después** de `heat-movers-color` (track 3). Para fixtures en la intersección de zonas, el rojo llega en segundo lugar.

### 2.2 Emisión de muestra — Objeto RGB

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:754-762
    if (track.valueType === 'color') {
      const hsl = evaluator.getColorValue(paramName, timeMs)
      const modulatedL = (hsl.l / 100) * intensity
      const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
      this._normRgbBuf.r = rgb.r / 255
      this._normRgbBuf.g = rgb.g / 255
      this._normRgbBuf.b = rgb.b / 255
      this.writeOutput(fixtureId, 'all', paramName, 0, rgb, undefined, 0,
        this._normRgbBuf, isCustomThisClip, clipId)
    }
```

- `hslToRgb` (HephUtils.ts) devuelve un **nuevo objeto** `{r,g,b}` en cada llamada. No hay leak de referencia aquí.
- `this._normRgbBuf` es un scratch compartido, pero `writeOutput` lo copia inmediatamente (WAVE 4830).

### 2.3 `writeOutput` — El fallback destructor

```typescript
@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:859-872
    if (rgb && out.rgb) {
      out.rgb.r = rgb.r
      out.rgb.g = rgb.g
      out.rgb.b = rgb.b
    } else {
      out.rgb = rgb  // ← undefined path destruye la ref pre-allocada
    }
    if (normalizedRgb && out.normalizedRgb) {
      out.normalizedRgb.r = normalizedRgb.r
      out.normalizedRgb.g = normalizedRgb.g
      out.normalizedRgb.b = normalizedRgb.b
    } else {
      out.normalizedRgb = normalizedRgb  // ← mismo defecto
    }
```

**Hallazgo crítico**: Cuando `writeOutput` recibe un parámetro **non-color** (ej. `intensity`), `rgb` es `undefined`. El `else` ejecuta `out.rgb = undefined`, destruyendo el objeto pre-allocado `{r:0,g:0,b:0}` del slot.

En el siguiente frame, si ese mismo slot se reutiliza para un output de color:
```typescript
if (rgb && out.rgb) { ... }   // out.rgb es undefined → NO entra
```
El color **no se copia**. El `HephaestusAetherAdapter` recibe `output.normalizedRgb === undefined` y omite el color (`if (nr) { ... }` falla). El fixture se queda **sin color** en ese frame.

Este bug estructural existe, pero **no explica directamente** el "rojo invade dorado" (ambos tracks son color y ambos pasan por el `if`).

---

## 3. EL MACHEO ZONAL (ZoneMapper.ts)

### 3.1 Resolución de `all-movers`

```typescript
@/electron-app/src/core/zones/ZoneMapper.ts:68-72
const COMPOSITE_ZONES: Readonly<Record<string, readonly CanonicalZone[]>> = {
  'all-pars':   ['front', 'back', 'floor'],
  'all-movers': ['movers-left', 'movers-right'],
}
```

```typescript
@/electron-app/src/core/zones/ZoneMapper.ts:89-93
  'all-movers': f =>
    f.type === 'moving-head' ||
    f.type === 'scanner' ||
    f.type === 'spot' ||
    f.capabilities?.hasMovementChannels === true,
```

Un fixture entra en `all-movers` si:
1. Su `normalizeZone(f.zone)` es `movers-left`/`movers-right`, **O**
2. Su `type` o `capabilities` indican que es mover (WAVE 4951 dynamic fallback).

### 3.2 Resolución de `front`

```typescript
@/electron-app/src/core/zones/ZoneMapper.ts:370-376
      // Direct canonical match
      for (const f of enabledFixtures) {
        if (!poolIds.has(f.id) && normalizeZone(f.zone) === t) {
          poolIds.add(f.id); pool.push(f)
        }
      }
```

Un fixture entra en `front` si su `f.zone` normalizado es exactamente `'front'`.

### 3.3 Intersección zonal

Si un rig tiene un moving-head cuyo campo `zone = 'front'` (por patch del show file), entonces:
- `resolveZoneTags(['all-movers'], fixtures)` → **lo incluye** (dynamic resolver).
- `resolveZoneTags(['front'], fixtures)` → **lo incluye** (direct canonical match).

**No hay exclusividad**: un fixture puede pertenecer a múltiples zonas canónicas/compuestas a la vez.

---

## 4. CADENA DE FALLA COMPLETA

**Rig hipotético**: Moving-head con `f.zone = 'front'` y `f.type = 'moving-head'`.

| # | Módulo | Acción | Resultado en el fixture |
|---|--------|--------|------------------------|
| 1 | `_buildResolvedTracks` | Track 3 resuelve `all-movers` | Fixture en `fixtureIds` del track dorado |
| 2 | `_buildResolvedTracks` | Track 9 resuelve `front` | Fixture en `fixtureIds` del track rojo |
| 3 | `tickActive` track 3 | `_emitTrackSample` dorado | `HephFixtureOutput` con `normalizedRgb` dorado |
| 4 | `tickActive` track 9 | `_emitTrackSample` rojo | `HephFixtureOutput` con `normalizedRgb` rojo |
| 5 | `HephaestusAetherAdapter.ingest()` | Ambos outputs → `INodeIntent` | Intent 1 (dorado) + Intent 2 (rojo), mismo `nodeId :color` |
| 6 | `NodeArbiter._applyIntent` | Aplica intent 1 | Canales `r/g/b` = dorado |
| 7 | `NodeArbiter._applyIntent` | Aplica intent 2 (LTP) | Canales `r/g/b` = rojo |
| 8 | Hardware | Color final | **Rojo** |

**Conclusión**: La causa raíz es un **overlap zonal no gestionado** combinado con LTP. El fixture pertenece a dos zonas disjuntas y recibe dos tracks de color con el mismo `paramId`. La ausencia de blending real per-fixture hace que "último track gana".

---

## 5. HALLAZGOS Y RECOMENDACIONES FORENSES

### Hallazgos críticos

1. **[DESIGN]** `all-movers` + `front` no son mutuamente excluyentes. Un mover en `front` recibe ambos tracks. El runtime no tiene awareness de "esta fixture ya fue coloreada por otro track en este frame".
2. **[DESIGN]** LTP (`mergeStrategy='replace'`) en el NodeArbiter hace que el track evaluado más tarde (track 9, rojo) sobreescriba al anterior (track 3, dorado). El orden de tracks en el `.lfx` dictama el color final en la intersección.
3. **[BUG]** `writeOutput` destruye las referencias pre-allocadas `out.rgb` / `out.normalizedRgb` cuando escribe parámetros non-color. Si el slot se reutiliza para color en un frame posterior, el color se pierde silenciosamente.
4. **[NOT A LEAK]** No existe sobreescritura de referencias de objetos entre tracks de color en el evaluador actual (WAVE 4830 copia valores). El "leak" que el usuario sospecha ya fue parcheado.

### Recomendaciones (Solo constatación, no ejecución)

- **R1:** Introducir exclusividad zonal en `_buildResolvedTracks` o `tickActive`: si un fixture ya recibió un color de un track previo en el mismo frame, no sobreescribirlo a menos que el blendMode lo indique explícitamente.
- **R2:** En clips V3, permitir que un track declare `excludeZones` (ej. `all-movers` excluyendo `front`) para evitar solapamientos indeseados.
- **R3:** Parchear `writeOutput` para nunca asignar `undefined` a `out.rgb` ni `out.normalizedRgb`; en su lugar, saltar el bloque si no hay color, preservando los objetos pre-allocados.
- **R4:** Considerar ordenar los tracks de un `.lfx` por prioridad zonal en lugar de orden de array, o documentar que el orden de tracks es semántico para LTP.

---

## 6. ANEXO: MAPA DE DATOS LFX V3 → HARDWARE

```
corazon_latino.lfx
  └─> LfxFileLoader._parseAndValidateV3() → HephAutomationClipV3
        └─> HephaestusRuntime._buildResolvedTracks()
              ├─> resolveZonesToFixtures(track.zones)  ← UNION / AND
              └─> ResolvedTrack[] (fixtureIds per track)
                    └─> tick(currentTimeMs)
                          └─> tickActive()  ← itera tracks en orden
                                ├─> _emitTrackSample(track 3) → dorado
                                ├─> ...
                                └─> _emitTrackSample(track 9) → rojo
                                      └─> writeOutput()  ← buffer slot
                                            └─> getOutputSlice()
                                                  └─> HephaestusAetherAdapter.ingest()
                                                        ├─> _acquireIntent(nodeId)
                                                        ├─> _populateValues(values, 'color', output)
                                                        │       └─> values['r'] = output.normalizedRgb.r
                                                        └─> setHephaestusIntents(intents)
                                                              └─> NodeArbiter.arbitrate()
                                                                    └─> _applyIntent(layer='hephaestus', mergeStrategy='LTP')
                                                                          └─> LTP: último track (rojo) gana
                                                                                └─> NodeResolver._translateColor() → DMX
```

---

*Fin del informe forense WAVE 4994.*
