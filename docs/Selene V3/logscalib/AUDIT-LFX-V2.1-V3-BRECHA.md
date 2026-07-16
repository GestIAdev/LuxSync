# AUDIT: Brecha Arquitectónica V2.1 → V3 — .lfx vs Hephaestus V3 + Selene Liquid Cognition

**Fecha:** 2026-07-15  
**WAVE:** 7160  
**Ámbito:** 49 archivos `.lfx` (builtin techno/rock/latin/chill)  
**Objetivo:** Diagnosticar la brecha entre los efectos migrados V2.1→V3 y las exigencias del motor Hephaestus V3 + Selene Liquid Cognition, y producir recomendaciones para un script mutador.

---

## 1. Sistema de Tipos (Hephaestus V3): Discrepancia `curves` vs `tracks`

### 1.1 Estado actual: V3 nativo con restos V2.1

Los 49 archivos `.lfx` ya han sido migrados a la envoltura V3 (`$schema: "luxsync.lfx/3.0"` con `clip.tracks[]`). **La estructura `curves: {}` plana ya no existe** — fue demolida en FASE 3 del LfxFileLoader. Todos los clips usan `tracks: HephTrack[]`.

### 1.2 Discrepancias estructurales residuales

| Aspecto | V3 Canónico (types.ts) | Estado en .lfx migrados | Impacto |
|---------|------------------------|-------------------------|---------|
| `clip.schemaVersion` | `'3.0'` (literal exacto requerido) | **AUSENTE** en todos los .lfx | El `HephClipIndex.upsert()` no lo valida — solo chequea `$schema` en el wrapper. El `_parseAndValidateV3` del LfxFileLoader sí lo ensambla al final (`schemaVersion: '3.0'`). **No bloquea carga pero el campo no está en disco.** |
| `clip.spatialZones` | `readonly ZoneTarget[]` — unión de zones de tracks | Presente en algunos (core_meltdown: `["all"]`, abyssal_rise: `["all-pars","all-movers"]`), **AUSENTE** en otros (void_mist no lo declara explícitamente pero sí tiene `tracks[].zones`) | El `_parseAndValidateV3` hace fallback a `[]` si falta. El `HephClipIndex` no lo recalcula. **Silencioso — pero la UI puede mostrar "sin zonas" si lee este campo directamente.** |
| `clip.mixBus` | `'global' \| 'htp' \| 'ambient' \| 'accent'` | Presente en algunos (`"global"`), **AUSENTE** en otros (_EFECTO_BASE no lo declara) | Fallback a `'htp'` en `_parseAndValidateV3`. Los efectos migrados V2.1 que tenían `legacyMixBus` en `staticParams` no lo trasladaron al campo canónico `mixBus`. |
| `clip.priority` | `number` | **AUSENTE** en muchos .lfx | Fallback a `70` en `_parseAndValidateV3`. |
| `track.curve.range` | `[number, number]` obligatorio | **AUSENTE** en _EFECTO_BASE y abyssal_rise (suscurves no declaran `range`) | `_normalizeClipCurves(clip)` en `HephClipIndex` lo inyecta si falta. **Silencioso pero corregido en runtime.** |
| `track.curve.mode` | Modo de evaluación | Presente en migrados V2.1 (`"absolute"`), **AUSENTE** en _EFECTO_BASE | No bloquea carga. El CurveEvaluator no usa `mode` — es metadata. |

### 1.3 Ruteo: `mixBus` global vs `tracks[].zones` explícito

**El problema central:** El V3 canónico exige que cada track declare explícitamente sus `zones[]` (CanonicalZone o helpers `'all'`, `'all-pars'`, `'all-movers'`). El ruteo V2.1 era implícito — un `curves: { intensity: {...} }` plano se aplicaba a todos los fixtures sin distinción espacial.

Los .lfx migrados usan `"zones": ["all"]` como **palo de ciego** — todos los tracks van a todas las zonas. Esto significa:
- No hay multicelularidad real (el objetivo principal de V3)
- Un track de `strobeRate` que debería ir solo a `all-movers` cae también sobre pars
- Un track de `color` que debería diferenciar frontales de traseros no puede

**Excepción notable:** `abyssal_rise.lfx` sí usa zones diferenciadas (`["all-pars", "ambient"]` para intensity/color, `["all-movers", "air"]` para strobeRate). Pero tiene un bug: `"ambient"` es una `EnergyZoneLabel`, no una `CanonicalZone` — el LfxFileLoader rechaza EnergyZoneId en `spatialZones` pero **no valida `tracks[].zones`** contra el diccionario canónico. El `resolveZoneTags` en el Runtime probablemente no encuentra fixtures para `"ambient"` como zona espacial, silenciando ese track.

### 1.4 Parser: dónde falla

El `HephClipIndex.upsert()` (línea 162) es la puerta de entrada real. Sus validaciones:

1. ✅ `$schema === 'luxsync.lfx/3.0'` — chequeado
2. ✅ `clip.tracks[]` no vacío — chequeado
3. ✅ Cada track tiene `curve.keyframes[]` — chequeado
4. ✅ Cada track tiene `zones[]` no vacío — chequeado
5. ❌ **NO valida que `zones[]` contenga valores canónicos válidos** — `"ambient"` (EnergyZone) pasa como si fuera una zona espacial
6. ❌ **NO valida `spatialZones` contra `tracks[].zones`** — pueden ser inconsistentes
7. ❌ **NO recalcula `spatialZones` como unión de `tracks[].zones`** — el comentario en types.ts dice "LfxFileLoader auto-recomputa" pero el ClipIndex no lo hace

El `_parseAndValidateV3` del LfxFileLoader (línea 200) hace validaciones más completas (DNA, strobe, checksum) pero **no se ejecuta en el path del ClipIndex** — el LfxFileLoader delega al ClipIndex y luego llama `registerEffectV3` con el clip ya parseado. Las validaciones del LfxFileLoader son **dead code** en el flujo actual.

---

## 2. Conciencia Líquida (Selene): Presión Acústica y timeMs Estáticos

### 2.1 Cómo Selene V3 calcula presión acústica

La presión acústica en Selene V3 se calcula en `CognitiveFluidState.ts` como un vector Ψ(t) con 8 componentes:

1. **Temperatura Θ(t):** EMA rápida de `rawEnergy` (α=0.25)
2. **Impacto I(t):** Multi-spectral fusion con Z-scores (total, low, high), crest factor, tensión espectral T, divergencia espectral D
   - Con `acousticReality`: `I = w_E·tanh(Z_total/z_ref) + w_low·tanh(Z_low) + w_high·tanh(Z_high) + w_CF·sigmoid(CF_high-4) + w_T·T + w_D·D`
   - Sin `acousticReality`: `I = w_z·tanh(zScore/z_ref) + w_cf·CF_hat + w_e·eHat`
3. **Tensión T(t):** Endurecimiento por saturación + evaporación por sequía + relajación homeostática
4. **Epicness:** `clamp01((impact - effectiveTension) / (1 - effectiveTension)) * energyFactor * phaseModifier`
   - `effectiveTension = tension * 0.50`
   - `energyFactor = clamp01((rawEnergy - 0.30) / 0.40)` — gate absoluto: E < 0.30 → epicness = 0
   - Vibe friction: techno/industrial/hardstyle/dark aplican `epicness^1.3`

### 2.2 El problema de `timeMs` estáticos

Los keyframes en los .lfx migrados tienen `timeMs` absolutos y rígidos:
- `core_meltdown.lfx`: keyframes en `0ms`, `1ms`, `4200ms` — duración fija de 4200ms
- `void_mist.lfx`: keyframes en `0ms`, `800ms`, `2200ms`, `3000ms` — duración fija de 3000ms
- `abyssal_rise.lfx`: keyframes en `0ms`, `3800ms` — duración fija de 3800ms

**El `CurveEvaluator` evalúa contra `durationMs` absoluta:** `clampTime(timeMs) = Math.max(0, Math.min(timeMs, this.durationMs))`. Los keyframes se buscan por `timeMs` absoluto dentro del array — no hay normalización.

**El `HephaestusRuntime` acepta `durationOverrideMs`** en `play()` y `playFromClip()`, pero esto solo cambia el clamp final — **no reescala los keyframes**. Si el clip dura 4200ms y se override a 2100ms, los keyframes en `timeMs > 2100` nunca se evalúan. El efecto se corta abruptamente.

### 2.3 Variables que el motor espera para duración reactiva

| Variable | Estado | Descripción |
|----------|--------|-------------|
| `durationOverrideMs` | ✅ Implementado | Pasado a `play()`/`playFromClip()`, pero solo hace clamp — no reescala |
| `timeStretchMultiplier` | ❌ **NO EXISTE** | No hay ningún mecanismo que reescale los `timeMs` de los keyframes proporcionalmente |
| `bpmRef` en `staticParams` | Presente en .lfx (`"bpmRef": 128`) | **No consumido por el runtime** — el CurveEvaluator no lo usa |
| `intensity` scaling | ✅ Implementado | `options.intensity` se pasa al `ActiveHephClip` pero solo afecta el dimmer output, no la duración |

**Conclusión:** Para que la duración sea reactiva al BPM/energía, se necesita uno de:
1. **`timeStretchMultiplier` en el CurveEvaluator:** Reescalar `timeMs` de keyframes por un factor antes de evaluar. Ej: `effectiveTime = timeMs * stretchFactor` donde `stretchFactor = clipBpmRef / currentBpm`.
2. **Normalización de keyframes a [0,1]:** Almacenar keyframes como fracción de duración y multiplicar por `durationMs` en evaluación. Esto requeriría reescribir todos los .lfx.
3. **Re-mapeo en el Runtime:** Antes de construir el `CurveEvaluator`, multiplicar cada `keyframe.timeMs` por `durationOverrideMs / clip.durationMs`. Esto es lo más práctico — no requiere reescribir .lfx.

### 2.4 Por qué los "ladrillos de 4200ms" impiden dinámica

Selene calcula `epicness`, `tension`, `impact` en tiempo real a 44Hz. Estos valores cambian frame a frame. Pero cuando dispara un efecto, el efecto reproduce su curva de 4200ms como un bloque rígido — sin importar si la energía subió, bajó, o el BPM cambió. El efecto es un **ladrillo** que ignora el contexto musical durante su reproducción.

La única interacción de Selene durante la reproducción es el `intensity` multiplier, que solo escala el dimmer. No hay forma de:
- Acelerar el efecto si el BPM sube
- Ralentizarlo si la energía baja
- Cortarlo si el drop termina antes de lo previsto
- Extenderlo si el drop se alarga

---

## 3. Validaciones Constitucionales

### 3.1 `vibeCompat` — Diccionario vs Realidad

**Reglas duras (de _EFECTO_BASE.lfx authoringMemory):**
> REGLA 5: `vibeCompat` SOLO puede contener 'techno' o 'latin'. Prohibido inventar géneros.

**Realidad en el código:** No hay validación de vocabulario de `vibeCompat` en ningún punto del pipeline. El `_parseAndValidateV3` solo chequea que sea un array no vacío. El `registerEffectV3` solo chequea `compatibleVibes.length > 0`.

**Valores encontrados en .lfx:**
- `"techno"`, `"industrial"`, `"metal"` (core_meltdown)
- `"techno"`, `"minimal"`, `"dark"` (void_mist)
- `"techno"` (abyssal_rise, _EFECTO_BASE)

El sistema `VIBE_BRIDGE` en `LfxClipInstance.ts` mapea estos a IDs internos, pero **"metal", "minimal", "dark"** no son vibes canónicos del sistema. El `vibeId` que Selene usa para decisiones (techno-club, fiesta-latina, etc.) es distinto de los `vibeCompat` en los .lfx.

**Discrepancia:** El `vibeCompat` de los .lfx usa géneros musicales libres, pero Selene usa `vibeId` estructurados (techno-club, fiesta-latina, pop-rock, chill-lounge). El matching se hace vía `VIBE_BRIDGE` en `LfxClipInstance.ts`, pero los .lfx migrados del V2.1 no pasan por `LfxClipInstance` — van directo al `DynamicEffectRegistry` vía `registerEffectV3`. El `compatibleVibes` del DNA se compara directamente con el `vibeId` de Selene.

### 3.2 `energyZone` — The Ladder

**The Ladder (MusicalContext.ts):**
```
silence  (E < 0.10)
valley   (E 0.10-0.20)
ambient  (E 0.20-0.35)
gentle   (E 0.35-0.50)
active   (E 0.50-0.70)
intense  (E 0.70-0.85)
peak     (E > 0.85)
```

**Validación:** El `EnergyZoneRange` en `CognitiveDNA` usa `EnergyZone` (el mismo type). Los .lfx migrados declaran `energyZone` correctamente:
- core_meltdown: `{ min: "intense", max: "peak" }` ✅
- void_mist: `{ min: "gentle", max: "active" }` ✅
- abyssal_rise: `{ min: "active", max: "intense" }` ✅
- _EFECTO_BASE: `{ min: "intense", max: "peak" }` ✅

**Pero:** El `EffectDreamSimulator.filterByZone()` usa su propio `aggressionLimits` map con las mismas 7 zonas, pero con rangos de agresión solapados. Un efecto con `energyZone.min = "active"` puede ser filtrado en `active` si su `aggression` está en [0.40, 0.80]. **No hay inconsistencia entre .lfx y el código**, pero la zona declarada en el DNA y la zona real de filtrado pueden no coincidir si la agresión no alinea.

### 3.3 Divine Arsenal y Fatiga

**Regla (_EFECTO_BASE authoringMemory):**
> REGLA 7: Si `isDivineCandidate=true`, ENTONCES `cooldownMs > 15000`, `fatigueImpact > 0.8` y `zScoreGuards.minimumZ >= 2.20`.

**Validación en código:** **NINGUNA.** No hay ningún check que valide estas restricciones en el `_parseAndValidateV3` ni en `registerEffectV3`.

**Estado en .lfx:**
| Efecto | isDivineCandidate | cooldownMs | fatigueImpact | minimumZ | ¿Cumple REGLA 7? |
|--------|-------------------|------------|---------------|----------|-------------------|
| core_meltdown | `true` | 6300 | 0.18 | 2 | ❌ cooldownMs < 15000, fatigue < 0.8, z < 2.20 |
| _EFECTO_BASE | `false` | 3000 | 0.20 | null | N/A |
| void_mist | `false` | 4500 | 0.06 | null | N/A |
| abyssal_rise | `false` | 6000 | 0.30 | 1 | N/A |

**core_meltdown es el único divine candidate y viola las 3 restricciones simultáneamente.** Esto significa que se dispara con demasiada frecuencia (cooldown 6.3s vs mínimo 15s), con bajo impacto de fatiga (0.18 vs mínimo 0.8), y con un Z-Score guard demasiado permisivo (2.0 vs mínimo 2.20).

### 3.4 `pressureRange` — El campo fantasma

**Estado en .lfx:** **NINGÚN archivo .lfx declara `pressureRange` en su `cognitiveDNA`.** El campo simplemente no existe en disco.

**Comportamiento del código:**
1. `registerEffectV3` (DynamicEffectRegistry.ts:110-112): Si `dna.pressureRange` falta, inyecta `{ min: 0.5, max: 1.0 }` — **todos los efectos sin pressureRange explícito son tratados como hard/high-pressure.**
2. `_buildEntryFromV3` (línea 443-446): Usa `dna.pressureRange?.min ?? 0.5` y `dna.pressureRange?.max ?? 1.0` — mismo fallback.
3. `LfxClipInstance.ts` (WAVE 7159 fix): Genera `pressureRange` basado en archetype/aggression — **pero este path solo se ejecuta para efectos creados via LfxClipInstance, no para .lfx cargados del disco.**

**Consecuencia:** Los 49 .lfx cargados del disco reciben `pressureRange = {0.5, 1.0}` — lo que significa que solo pueden dispararse cuando `rawEnergy >= 0.5`. Efectos ambientales como `void_mist` (que debería poder dispararse en energía baja 0.0-0.5) están bloqueados por el pressure veto cuando la energía está por debajo de 0.5.

**Esto explica por qué no vimos pressure vetoes en el log de calibración 7160** — Selene solo disparó efectos cuando la energía estaba por encima de 0.5, que casualmente coincide con el fallback `{0.5, 1.0}`. Los efectos ambientales en energía baja fueron filtrados antes por el DreamSimulator o por la zona de energía del DNA.

---

## 4. Estructura de Fusión (`blendMode`)

### 4.1 Dependencias del código

**Default blend mode** (`HephSharedMath.ts:27-29`):
```typescript
export function defaultBlendMode(paramId: HephParamId): BlendMode {
  return paramId === 'intensity' ? 'max' : 'replace'
}
```

- `intensity` → `'max'` (HTP — highest takes precedence)
- `color`, `pan`, `tilt`, `strobeRate`, etc → `'replace'` (LTP — last write wins)

**Uso en el Runtime** (`HephaestusRuntime.ts:976`):
```typescript
blendMode: blendMode ?? _defaultBlendModeFor(paramId)
```

Si un track no declara `blendMode`, se usa el default. Los .lfx migrados **todos declaran `blendMode: "replace"` explícitamente**, incluso para `intensity`. Esto significa que los tracks de intensity hacen LTP en lugar de HTP — el último efecto en escribir gana, aplastando al anterior.

### 4.2 Regla de interdependencia: intensity obligatorio si hay color o strobe

**De _EFECTO_BASE.lfx authoringMemory:**
> REGLA 2: `strobeRate` abre shutter, pero no levanta dimmer: sin intensity explícita, la salida visual es negro.

**Validación en código:** El `_parseAndValidateV3` tiene un check G6 (línea 300-314):
```typescript
if (safetyDecl.maxStrobeFreqHz > 0 && !hasStrobeTrack && !v3Tracks.some(t => t.paramId === 'intensity')) {
  // reject
}
```
Pero esto solo valida coherencia strobe declaration vs strobe track — **no valida que exista un track de intensity si hay tracks de color o strobeRate.**

**Estado en .lfx:**
- core_meltdown: ✅ tiene intensity + color + strobeRate
- void_mist: ✅ tiene intensity + color (sin strobeRate)
- abyssal_rise: ✅ tiene intensity + color + strobeRate (4 tracks)
- _EFECTO_BASE: ✅ tiene intensity + color

**Pero la regla no se aplica por zona:** Si un .lfx tiene `intensity` en `["all-pars"]` y `color` en `["all-movers"]`, los movers reciben color sin intensity → **negro visual**. Los .lfx migrados con `"zones": ["all"]` evitan este problema por accidente, pero un .lfx con zones diferenciadas podría violarlo silenciosamente.

### 4.3 `blendMode: "replace"` en intensity — el aplastamiento

Todos los .lfx migrados declaran `blendMode: "replace"` en TODOS los tracks, incluyendo intensity. Esto es correcto para el comportamiento "dictador absoluto" (REGLA 3 del authoringMemory), pero tiene un efecto colateral:

Cuando dos efectos se solapan temporalmente, el segundo efecto con `intensity: replace` **aplasta** al primero completamente, incluso si el primero tenía mayor intensidad. Con `blendMode: "max"` (el default V3), el mayor valor ganaría — permitiendo capas. Los .lfx migrados no permiten capas.

---

## 5. Resumen de Discrepancias Críticas

| # | Discrepancia | Severidad | Archivos afectados | Causa raíz |
|---|-------------|-----------|-------------------|------------|
| D1 | `pressureRange` ausente en todos los .lfx | 🔴 CRÍTICA | 49/49 archivos | El migrador V2.1→V3 no inyectó `pressureRange` en `cognitiveDNA`. El fallback `{0.5,1.0}` bloquea efectos ambientales en energía baja. |
| D2 | `timeMs` estáticos sin reescalado | 🔴 CRÍTICA | 49/49 archivos | El `CurveEvaluator` no soporta `timeStretchMultiplier`. `durationOverrideMs` solo hace clamp, no reescala keyframes. |
| D3 | `zones: ["all"]` como palo de ciego | 🟡 ALTA | ~44/49 archivos | El migrador no preservó el targeting espacial del V2.1 (que era implícito). Solo abyssal_rise tiene zones diferenciadas. |
| D4 | `vibeCompat` no validado contra vocabulario canónico | 🟡 ALTA | Variable | "metal", "minimal", "dark" no son vibes del sistema. El matching con `vibeId` de Selene puede fallar silenciosamente. |
| D5 | REGLA 7 (divine) no validada en código | 🟡 ALTA | core_meltdown | `isDivineCandidate=true` pero `cooldownMs=6300` (<15000), `fatigueImpact=0.18` (<0.8), `minimumZ=2` (<2.20). |
| D6 | `spatialZones` no recalculado por ClipIndex | 🟠 MEDIA | Variable | El ClipIndex no recalcula `spatialZones` como unión de `tracks[].zones`. Algunos .lfx no lo declaran. |
| D7 | `blendMode: "replace"` en intensity | 🟠 MEDIA | 49/49 archivos | Elimina capas HTP. Correcto para "dictador" pero impide mezcla de efectos solapados. |
| D8 | `zones[]` no validado contra diccionario canónico | 🟠 MEDIA | abyssal_rise | `"ambient"` es EnergyZone, no CanonicalZone. El Runtime silencia el track si no encuentra fixtures. |
| D9 | `track.curve.range` ausente en algunos | 🟢 BAJA | _EFECTO_BASE, abyssal_rise | `_normalizeClipCurves` lo inyecta en runtime. No bloquea. |
| D10 | `schemaVersion: '3.0'` ausente en disco | 🟢 BAJA | 49/49 | Ensamblado por `_parseAndValidateV3` pero no persistido. No bloquea carga. |
| D11 | Validaciones del LfxFileLoader son dead code | 🟢 BAJA | N/A | El flujo real pasa por `HephClipIndex.upsert()`, no por `_parseAndValidateV3`. |

---

## 6. Recomendaciones para el Script Mutador V2.1→V3

### 6.1 Inyección de `pressureRange` (D1 — CRÍTICA)

El mutador debe clasificar cada efecto y inyectar `pressureRange` en `cognitiveDNA`:

```typescript
function derivePressureRange(dna: CognitiveDNA, simMeta: SimulationMeta): Range {
  if (simMeta.isDivineCandidate || simMeta.isHeavyCandidate || dna.genome.aggression > 0.7) {
    return { min: 0.5, max: 1.0 }  // Hard — alta presión acústica requerida
  }
  if (dna.energyZone.max === 'ambient' || dna.energyZone.max === 'gentle') {
    return { min: 0.0, max: 0.5 }  // Ambient — baja presión
  }
  return { min: 0.0, max: 1.0 }    // Utility — permisivo
}
```

### 6.2 Reescalado de `timeMs` (D2 — CRÍTICA)

Opción A (mutador): Normalizar keyframes a fracción [0,1] de la duración:
```json
{
  "timeFraction": 0.0,
  "value": 1,
  "interpolation": "hold"
}
```
Requiere modificar `CurveEvaluator` para multiplicar `timeFraction * durationMs`.

Opción B (runtime, sin mutar .lfx): Re-mapear keyframes en `_buildResolvedTrack`:
```typescript
const stretchFactor = durationMs / clip.durationMs
for (const kf of curve.keyframes) {
  kf.timeMs = kf.timeMs * stretchFactor
}
```

**Recomendación: Opción B** — no requiere reescribir los 49 .lfx. El mutador solo necesita asegurar que `durationMs` sea razonable. El runtime puede reescalar en vuelo.

### 6.3 Diferenciación de `zones[]` (D3 — ALTA)

El mutador debe inferir zones por `paramId`:
- `intensity` + `color` → `["all-pars"]` (pars son la base de luz)
- `strobeRate` → `["all-movers"]` (movers tienen shutter físico)
- `pan`/`tilt` → `["all-movers"]` (solo movers tienen pan/tilt)

Para efectos que deben ir a todas las zonas, mantener `["all"]`.

### 6.4 Validación de `vibeCompat` (D4 — ALTA)

El mutador debe mapear géneros libres a vibes canónicos:
```typescript
const VIBE_MAP: Record<string, string> = {
  'techno': 'techno',
  'industrial': 'techno',
  'metal': 'rock',
  'minimal': 'techno',
  'dark': 'techno',
  'latin': 'latin',
  'rock': 'rock',
  'chill': 'chill',
}
```

### 6.5 Cumplimiento de REGLA 7 (D5 — ALTA)

El mutador debe corregir `core_meltdown` (y cualquier otro divine candidate):
```json
{
  "cooldownMs": 15000,
  "fatigueImpact": 0.8,
  "zScoreGuards": {
    "requireRising": true,
    "minimumZ": 2.20,
    "minimumEnergy": 0.7
  }
}
```

### 6.6 Recálculo de `spatialZones` (D6 — MEDIA)

El mutador debe calcular `spatialZones` como la unión de todos `tracks[].zones`:
```typescript
clip.spatialZones = [...new Set(clip.tracks.flatMap(t => t.zones))]
```

### 6.7 Validación de `zones[]` contra diccionario canónico (D8 — MEDIA)

El mutador debe rechazar o corregir EnergyZoneIds en `tracks[].zones`:
```typescript
const CANONICAL_ZONES = new Set(['all', 'all-pars', 'all-movers', 'front', 'back', 'left', 'right', 'air', 'upstage', 'downstage'])
const ENERGY_ZONES = new Set(['silence', 'valley', 'ambient', 'gentle', 'active', 'intense', 'peak'])

for (const track of clip.tracks) {
  for (const zone of track.zones) {
    if (ENERGY_ZONES.has(zone) && !CANONICAL_ZONES.has(zone)) {
      // Error: EnergyZone used as spatial zone — remove or map to 'all'
    }
  }
}
```

---

## 7. Esquema del Script Mutador

```
Input:  49 archivos .lfx (V3 wrapper, V2.1 contenido)
Output: 49 archivos .lfx (V3 canónico completo)

Pasos por archivo:
1. Parsear JSON
2. Validar $schema === 'luxsync.lfx/3.0'
3. Inyectar pressureRange en cognitiveDNA (D1)
4. Corregir vibeCompat via VIBE_MAP (D4)
5. Validar/corregir zones[] en tracks (D3, D8)
6. Recalcular spatialZones como unión de tracks[].zones (D6)
7. Si isDivineCandidate, validar REGLA 7 (D5)
8. Asegurar blendMode en cada track (default si falta) (D7)
9. Asegurar curve.range en cada track (default [0,1] o [0,360]) (D9)
10. Inyectar schemaVersion: '3.0' en clip (D10)
11. Recalcular checksum SHA-256
12. Escribir archivo
```

---

## 8. Conclusión

La brecha arquitectónica no es de schema (la envoltura V3 ya está aplicada) sino de **contenido semántico**. Los 49 .lfx son V3 en estructura pero V2.1 en intención:

- **Sin presión acústica** → el sistema no puede distinguir hard de ambient por presión
- **Sin reescalado temporal** → los efectos son ladrillos rígidos ignorando el contexto musical
- **Sin multicelularidad** → `zones: ["all"]` aplasta la diferenciación espacial que V3 prometió
- **Sin validación de divine** → core_meltdown dispara con demasiada frecuencia y baja fatiga

El script mutador debe abordar D1-D5 como prioridad crítica. D6-D8 son correcciones estructurales. D9-D11 son cosméticos.
