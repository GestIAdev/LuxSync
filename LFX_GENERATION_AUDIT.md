# ⚒️ LFX GENERATION AUDIT — Compilador Programático de `.lfx` (HephAutomationClipV3)

**Ticket:** Auditoría forense de generación de efectos — preparación Pixel Mapper Inverso
**Modo:** Solo lectura. Cero modificaciones de producción.
**Branch:** `v4` (post `0c880ed3`)

---

## TL;DR para el compilador

| Pregunta | Respuesta |
|---|---|
| Delay absoluto a un fixture | `"<fixtureId>": { "mode": "absolute", "offsetMs": 450 }` en `track.phaseOverrides` |
| ¿`absolute` o `delta`? | **`absolute`** — pisa el algoritmo. `delta` suma sobre el offset algorítmico |
| ¿Keys = NodeId? | **NO — `fixtureId` (`FixtureV2.id`)**. No existe granularidad por celda/nodo |
| Curva mínima "máscara al 100%" | 1 keyframe `{timeMs:0, value:1, interpolation:'hold'}` — sostenido por clamp de rango |
| ¿Límite de `phaseOverrides`? | **Ninguno** — ni GatekeeperLinter ni LfxFileLoader auditan su tamaño |
| Checksum | `sha256(JSON.stringify(clip))` — obligatorio para builtin/marketplace, opcional en `user` |

---

## 1. PHASE OVERRIDES — Sintaxis exacta

**Tipos:** `src/core/hephaestus/phase/PhaseOverride.ts:24-51`

```ts
export interface PhaseOverride {
  mode: 'delta' | 'absolute'   // 'absolute' ignora el algoritmo; 'delta' suma
  offsetMs: number             // ms; en absolute = desplazamiento desde t=0
  pinned?: boolean             // inmune a cambios de spread/shuffle/wings
}
export type PhaseOverrideMap = Record<string, PhaseOverride>
```

Vive en el track: `HephTrack.phaseOverrides?: PhaseOverrideMap` (`hephaestus/types.ts:487`).

### 1.1 Ejemplo real en producción (`builtins/custom/heph_1782609140553_bto9fn.lfx`)

```json
"phaseOverrides": {
  "fixture-1778098900942": { "mode": "absolute", "offsetMs": 0 },
  "fixture-1778098937109": { "mode": "absolute", "offsetMs": 777.7777777777778 },
  "fixture-1778098981365": { "mode": "absolute", "offsetMs": 1555.5555555555557 }
}
```

### 1.2 Semántica de resolución (`resolveWithOverrides`, PhaseOverride.ts:67-100)

```ts
if (ov.mode === 'absolute')
  phaseOffsetMs = clamp(ov.offsetMs, 0, durationMs)
else // 'delta'
  phaseOffsetMs = clamp(fp.phaseOffsetMs + ov.offsetMs, 0, durationMs)
```

**Tres consecuencias que el compilador debe respetar:**

1. **La llave es `fixtureId`, no `NodeId`.** Los `fixtureIds` vienen de `resolveZoneTags(track.zones, orchFixtures)` → `getFixturesForZoneMapping()` → `f.id` (`HephaestusRuntime.ts:947-969`). Para fixtures multicelula el offset aplica **al aparato entero** — no existe `phaseOverrides` por celda (`HephTrack.cell` existe pero está `RESERVADO v3.0 — Runtime no lo consume`, types.ts:457-459). Si el Pixel Mapper necesita desfase por celda, esta capa no lo da.
2. **Clamp `[0, durationMs]`** — un `offsetMs` > duration se trunca al ciclo. Para +450ms, `durationMs` debe ser ≥ 450.
3. **Es fase cíclica, no "delayed start".** El runtime aplica wrap: `localElapsedMs = (clipTime + phaseOffset) % durationMs` (doc en types.ts:476). Un fixture con `offsetMs:450` no "enciende 450ms tarde" — lee la curva **adelantada** 450ms dentro del ciclo. Para un gate-on-forever el compilador debe usar valores de curva, no fase.
4. **Actividad condicional del mapa:** `resolveWithOverrides` solo corre si `phaseConfig && (spreadDeg>0 || hasOverrides)` (HephaestusRuntime.ts:1021-1023) — hay que declarar `track.phaseConfig` presente (puede ser `spreadDeg:0` si solo hay overrides absolutos; los overrides con `hasOverrides=true` lo activan igual).

### 1.3 `PhaseConfigPro` (algoritmo base, `PhaseConfigPro.ts:15-53`)

```json
"phaseConfig": {
  "spreadDeg": 360,      // GRADOS de ciclo — 360 = último arranca 1 ciclo tarde; [0,1440]
  "symmetry": "linear",  // 'linear' | 'mirror' | 'center-out'
  "wings": 1,            // frecuencia espacial de la onda
  "blocks": 1,           // fixtures por bloque con misma fase
  "shuffle": 0,          // 0=determinista … 1=caos hash(seed)
  "shuffleSeed": 1,
  "direction": 1         // 1 | -1
}
```

⚠️ No confundir con el legacy `PhaseConfig` (types.ts:110, `@deprecated`) que usa `spread` ∈ [0,1]. El campo de track consume **Pro** (`spreadDeg` en grados).

---

## 2. CURVAS — `HephTrack` / `HephCurve` mínimos

**Tipos:** `src/core/hephaestus/types.ts` — `HephTrack`:424, `HephCurve`:328, `HephKeyframe`:268.

```ts
HephInterpolation = 'hold' | 'linear' | 'bezier'   // L62 — 'hold' existe ✓
HephCurveMode     = 'absolute' | 'relative' | 'additive'
ZoneTarget        = CanonicalZone | 'all' | 'all-pars' | 'all-movers'
```

### 2.1 Máscara estática mínima válida (foco al 100% sostenido)

```json
{
  "id": "mask-beam-01",
  "paramId": "intensity",
  "zones": ["all"],
  "blendMode": "replace",
  "curve": {
    "paramId": "intensity",
    "valueType": "number",
    "range": [0, 1],
    "defaultValue": 0,
    "mode": "absolute",
    "keyframes": [
      { "timeMs": 0, "value": 1, "interpolation": "hold" }
    ]
  }
}
```

- Un solo keyframe es válido (invariante: "Mínimo 1 keyframe (valor constante)", types.ts:323). Fuera de rango temporal → clamp al primer/último valor → sostenido infinito.
- `interpolation` del último keyframe se ignora — `'hold'` es correcto y explícito.
- `paramId: 'intensity'` → dimmerOverride [0..1]. Para máscara DMX-cruda usar los params semánticos (`zoom`, `focus`, `strobe`…) — todos mapean 0-1 → 0-255.
- `paramId: 'color'` usa `valueType:'color'`, `value:{h,s,l}` (H 0-360, S/L 0-100) — ver `arena_sweep.lfx` para el patrón.

### 2.2 `HephTrack` completo — campos

```ts
interface HephTrack {
  id: string                          // UUID v4 o slug determinista (migrator usa uuid)
  paramId: HephParamId                // 24 ids — ver types.ts:178-204
  zones: readonly ZoneTarget[]        // ⚠️ NUNCA vacío — G5 rechaza
  curve: HephCurve
  dimmerScale?: number                // [0..1], solo 'intensity'
  colorOverride?: HSL                 // si paramId==='color', suplanta la curva
  blendMode?: BlendMode               // 'max'|'replace'|'add'|'multiply'
  cell?: string                       // RESERVADO — runtime no lo consume
  selector?: FixtureSelector          // AND-intersección fina sobre zones
  phaseConfig?: PhaseConfigPro        // shorthand canónico per-track
  phaseOverrides?: PhaseOverrideMap   // ← el mecanismo del compilador
}
```

**Precedencia de fase** (HephaestusRuntime.ts:973-978): `track.phaseConfig` gana; `selector.phase`/`selector.phaseSpread` son fallback legacy.

---

## 3. VALIDACIÓN — dos capas, ninguna toca `phaseOverrides`

### 3.1 `GatekeeperLinter` (`src/core/arsenal/GatekeeperLinter.ts`)

Opera sobre `LfxClipInstance` — el **átomo cognitivo** (archetype, ACO triad, energyZones, maxStrobeFreqHz, compatibleVibes). Reglas: `ARCHETYPE_BIAS_VIOLATION`, `AMBIENT_AGGRESSION_OVERFLOW` (>0.35 crítico), `STROBE_FREQ_DANGEROUS` (>25Hz), `STROBE_FREQ_UNDECLARED`, `ZONE_INCOHERENT`, `EMPTY_ENERGY_ZONES`, `EMPTY_VIBE_LIST`.

**→ Cero reglas sobre `phaseOverrides`, tamaño de tracks, o complejidad de curvas.** Un mapa de 2000 entradas pasa el linter sin un solo warning.

### 3.2 `LfxFileLoader._parseAndValidateV3` (`src/core/arsenal/LfxFileLoader.ts:281-465`) — los gates duros

| Gate | Regla | Consecuencia |
|---|---|---|
| Struct | `id`, `name`, `author`, `category`, `effectType` strings · `tags` array · **`vibeCompat` array NO vacío** · `durationMs` finito > 0 | reject (null) |
| **G5** | `tracks` ≥1 · cada track objeto con **`zones` no vacío** + **`curve.keyframes` no vacío** | reject |
| DNA* | si `cognitiveDNA` presente: `genome.{aggression,chaos,organicity}` ∈ [0,1] · `compatibleVibes` no vacío · `textureAffinity` válida | reject |
| USER | `genome.aggression ≤ 1.0` · `maxStrobeFreqHz ≤ 25` | reject |
| **G6** | `safetyDecl.maxStrobeFreqHz>0` ⇒ requiere track `strobe`/`intensity` · `maxStrobeFreqHz===0` + track `strobe` ⇒ reject | reject |
| **G2** | `checksum` — ver §3.3 | reject si mismatch |

**`phaseOverrides` nunca se inspecciona.** Tampoco hay límite de `keyframes[]` ni de `tracks[]`. **Respuesta al ticket: un `PhaseOverrideMap` masivo (2000 nodos) es válido ante el validador** — con dos notas prácticas:

- `resolveWithOverrides` corre O(N log N) por activación (sort de FixturePhase[]) — 2000 entradas es trivial.
- Solo las claves correspondientes a `fixtureIds` resueltos por `zones` del track reciben override; claves huérfanas son peso muerto silencioso (no hay warning de "override no resuelto").

### 3.3 Checksum (`LfxFileLoader.ts:409-429`, `computeClipChecksum` ~L540)

```
canonical = JSON.stringify(clip)          // el objeto clip TAL CUAL parseado
hash      = sha256(canonical).hex
declared  = wrapper.checksum (admite prefijo 'sha256:')
```

- `builtin`/`marketplace`: checksum **obligatorio** (vacío → reject).
- `user`: vacío permitido (warning). **Mismatch = reject duro siempre.**
- El compilador debe: construir `clip` → `JSON.stringify(clip)` → sha256 → escribir `"checksum": "sha256:<hex>"`. Determinista mientras el objeto sea el mismo.

### 3.4 Wrapper del archivo

```json
{
  "$schema": "luxsync.lfx/3.0",
  "clip": { /* HephAutomationClipV3 */ },
  "checksum": "sha256:<hex64>"
}
```

(`LFXFileV3`, `lfxTypes.ts:356-360`)

---

## 4. CLIP MÍNIMO COMPLETO — esqueleto para el compilador

```json
{
  "$schema": "luxsync.lfx/3.0",
  "clip": {
    "id": "pxmap_sweep_01",
    "name": "PixelMap Sweep 01",
    "author": "PixelMapper",
    "category": "composite",
    "tags": ["pixelmap", "generated"],
    "vibeCompat": ["universal"],
    "durationMs": 4000,
    "effectType": "heph_custom",
    "spatialZones": ["all"],
    "mixBus": "global",
    "priority": 70,
    "staticParams": {},
    "schemaVersion": "3.0",
    "tracks": [
      {
        "id": "trk-intensity-01",
        "paramId": "intensity",
        "zones": ["all"],
        "blendMode": "replace",
        "phaseConfig": {
          "spreadDeg": 0, "symmetry": "linear", "wings": 1,
          "blocks": 1, "shuffle": 0, "shuffleSeed": 1, "direction": 1
        },
        "phaseOverrides": {
          "fixture-1778098900942": { "mode": "absolute", "offsetMs": 0 },
          "fixture-1778098937109": { "mode": "absolute", "offsetMs": 450 }
        },
        "curve": {
          "paramId": "intensity", "valueType": "number",
          "range": [0, 1], "defaultValue": 0, "mode": "absolute",
          "keyframes": [{ "timeMs": 0, "value": 1, "interpolation": "hold" }]
        }
      }
    ]
  },
  "checksum": "sha256:<sha256(JSON.stringify(clip))>"
}
```

Sin `cognitiveDNA` el clip **carga pero Selene no lo auto-selecciona** (queda manual/MIDI/timeline — probablemente lo correcto para un mapper). Si se quiere pool autónomo: `cognitiveDNA` completo (`genome`, `textureAffinity`, `compatibleVibes` no vacío, `validSections`, `energyZone`, `aggressionRange`, `pressureRange`, `spatialBehavior` — `lfxTypes.ts:161-189`) + `safetyDeclaration` coherente con G6.

---

## 5. GOTCHAS PARA EL COMPILADOR

1. **`phaseOverrides` es por FIXTURE, no por NodeId/celda.** En un Tungsten multicelula, un delay va al aparato entero. Granularidad celular real = `executionDomain:'pixel'` + `pixelHints.mappingSpace` (`lfxTypes.ts:129-155`) o `track.cell` (reservado, no implementado).
2. **Wrap cíclico:** el offset desplaza la lectura de la curva dentro del ciclo (`(t+off) % duration`), no retrasa el inicio del clip. Para "enciende a los 450ms y queda", modela la máscara en la **curva** (keyframes con valor), no en `phaseOverrides`.
3. **Clamp duro `[0, durationMs]`** en ambos modos (L86/94) — offsets negativos o >duration se pierden silenciosamente.
4. **`vibeCompat` no puede ser `[]`** — gate estructural. Usar `["universal"]` o el vibe real.
5. **`zones` no puede ser `[]`** por track (G5) — usar `["all"]` como catch-all (el resolver lo expande a todos los fixtures, HephaestusRuntime.ts:956-957).
6. **Orden de keyframes:** invariante contractual = `timeMs` ascendente; el compilador debe emitirlos ordenados.
7. **Stepped params:** `gobo1`/`gobo2` son selectores discretos (`STEPPED_PARAM_SLOTS`, types.ts:217) — para ellos el compilador debería emitir `curveMode:'stepped'` + `quantizeSteps`.
8. **`colorOverride`** (track-level, types.ts:447): si `paramId==='color'` y está presente, **suplanta la curva entera** — atajo útil para máscaras de color estáticas sin keyframes complejos… pero G5 sigue exigiendo `curve.keyframes` no vacío, así que la curva stub sigue siendo obligatoria.
9. **HephaestusClipIndex.upsert** hace hard-error en checksum mismatch incluso en carga indexada — el checksum debe ser correcto desde el primer byte escrito.

---

## 6. ARCHIVOS CLAVE

| Capa | Archivo | Líneas |
|---|---|---|
| PhaseOverride | `src/core/hephaestus/phase/PhaseOverride.ts` | PhaseOverride:24 · Map:51 · resolve:67 · clamp:86-94 · bake:109 |
| PhaseConfigPro | `src/core/hephaestus/phase/PhaseConfigPro.ts` | interface:15 · defaults:55 · computeOffsetPro:98 |
| Track/Curve/Clip | `src/core/hephaestus/types.ts` | Interpolation:62 · Keyframe:268 · Curve:328 · Track:424 · ClipV3:504 |
| Resolución fase | `src/core/hephaestus/runtime/HephaestusRuntime.ts` | zones→fixtureIds:947-969 · overrides gate:1021-1023 |
| Linter | `src/core/arsenal/GatekeeperLinter.ts` | reglas:386-394 · validateClip:408 |
| Loader/gates | `src/core/arsenal/LfxFileLoader.ts` | struct:301-325 · G5:327-346 · DNA:351-370 · G6:381-395 · G2:409-429 · USER policy:58-64 |
| Wrapper V3 | `src/core/arsenal/lfxTypes.ts` | LFXFileV3:356 · CognitiveDNA:161 · PixelHints:135 |
| Ejemplo real | `src/core/arsenal/builtins/custom/heph_1782609140553_bto9fn.lfx` | phaseOverrides production |
| Ejemplo limpio | `src/core/arsenal/builtins/latin/arena_sweep.lfx` | clip V3 completo con checksum |

---

*Generado por auditoría forense — solo lectura. Sin modificaciones de código de producción.*
