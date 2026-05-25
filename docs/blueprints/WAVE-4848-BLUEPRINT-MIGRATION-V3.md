# WAVE 4848 — BLUEPRINT: MIGRATION V3 / THE CANONICAL ZONE & COLOR GENOME

**Status:** Design specification (no code yet).
**Predecessor:** `@docs/blueprints/WAVE-4847-LEMON-TREE-AUDIT.md`
**Target:** Migrator script `ts-to-lfx` v3 + schema `.lfx` v3.0 + HephaestusRuntime v3 ingestion path.
**Mission:** Definir el genoma JSON capaz de sostener efectos **multicelulares** (multi-zona + multi-color + multi-paramID) sin pérdida estructural respecto al código `.ts` legacy.

---

## §0. Doctrina

> Un `.lfx` v3 es **un efecto multicelular declarativo**: un único archivo que orquesta intensidad, color, movimiento, óptica y strobe **simultáneamente sobre las 9 zonas canónicas**, respetando la fixturae multicelular del Stage (un fixture puede tener celdas asignadas a zonas distintas).

Tres axiomas:

1. **Las 9 Zonas Canónicas de `@core/stage/ShowFileV2.ts:282-344` son el único lenguaje espacial admisible.** Cualquier alias del usuario (strobes, blinders, lasers, house, …) se normaliza al canon en tiempo de migración. Un `.lfx` v3 que contenga un token no canónico es **inválido por construcción**.
2. **El color es una curva de primera clase**, no metadato. Si el `.ts` define un `colorCycle`, el migrator emite una curva `valueType: 'color'` con keyframes HSL — **no** un `dominantColorH/S/L` muerto.
3. **Multicelularidad es lo normal, no la excepción.** El esquema asume que cualquier efecto puede dirigir patrones distintos a zonas distintas en la misma timeline. El caso "todos los fixtures hacen lo mismo" es un degenerado.

---

## §1. Las 9 Zonas Canónicas y el Mapa de Alias

### 1.1 Ground truth

Fuente normativa única: `@core/stage/ShowFileV2.ts:282-344`.

| # | CanonicalZone     | Semántica oficial                       |
|---|-------------------|------------------------------------------|
| 1 | `front`           | PARs frontales (audience-facing wash)   |
| 2 | `back`            | PARs traseros (counter / backlight)     |
| 3 | `floor`           | PARs de suelo (uplight)                 |
| 4 | `movers-left`     | Cabezas móviles lado izquierdo          |
| 5 | `movers-right`    | Cabezas móviles lado derecho            |
| 6 | `center`          | Strobes / Blinders centrales            |
| 7 | `air`             | Lásers / Aerials / Atmósfera            |
| 8 | `ambient`         | House lights / ambiente                 |
| 9 | `unassigned`      | Fallback explícito (fixtures sin role)  |

### 1.2 Helpers compuestos (admisibles en `.lfx`)

Resolvibles en runtime por `ZoneMapper.expandComposite()`:

| Helper      | Expande a                                     |
|-------------|-----------------------------------------------|
| `'all'`         | Todas las zonas excepto `unassigned`           |
| `'all-pars'`    | `['front', 'back', 'floor']`                  |
| `'all-movers'`  | `['movers-left', 'movers-right']`             |

### 1.3 Tabla de alias del migrator (legacy `.ts` → canónico)

El migrator es **la única capa que acepta dialectos**. Después de él, todo es canon.

| Token visto en `.ts` legacy                            | → CanonicalZone / helper |
|--------------------------------------------------------|--------------------------|
| `'front'`, `'front_pars'`, `'FRONT_PARS'`, `'frontL'`, `'frontR'` | `front` |
| `'back'`, `'back_pars'`, `'BACK_PARS'`, `'backL'`, `'backR'`      | `back` |
| `'floor'`, `'floor_pars'`, `'FLOOR_PARS'`, `'floor-front'`, `'floor-back'` | `floor` |
| `'movers-left'`, `'MOVING_LEFT'`, `'stage-left'`       | `movers-left` |
| `'movers-right'`, `'MOVING_RIGHT'`, `'stage-right'`    | `movers-right` |
| `'strobes'`, `'STROBES'`, `'center'`, `'CENTER'`, `'blinders'`, `'blind'`, `'stage-center'` | `center` |
| `'air'`, `'AIR'`, `'lasers'`, `'LASERS'`, `'aerials'`, `'atmosphere'` | `air` |
| `'ambient'`, `'AMBIENT'`, `'house'`, `'house-lights'`  | `ambient` |
| `'all'`, `'*'`, `''` (vacío)                           | `'all'` (helper) |
| `'all-movers'`, `'movers'`                             | `'all-movers'` (helper) |
| `'pars'`, `'all-pars'`                                 | `'all-pars'` (helper) |
| **Cualquier otro**                                     | `unassigned` + warning de migración logged |

> **NOTA SOBRE EL TÉRMINO "blind":** En la directiva original aparece `'blind'` como zona. No existe en el canon de 9. Mapea semánticamente a `center` (donde viven los blinders). Si en el futuro se justifica una zona dedicada `blind`, requiere extender `CANONICAL_ZONES` en `ShowFileV2.ts` PRIMERO; el migrator no inventa zonas.

### 1.4 Separación de namespaces (cierra F3b del audit)

| Namespace            | Tipo TS                          | Campo `.lfx` v3 |
|----------------------|----------------------------------|-----------------|
| Espacial (DÓNDE)     | `CanonicalZone \| helper`        | `clip.spatialZones[]` (resumen) + `track.zone` (por curva) |
| Cognitivo energético (CUÁNDO) | `EnergyZoneId`         | `clip.cognitiveDNA.energyZones[]` |
| Cognitivo musical    | `EffectCategory`, `compatibleVibes` | `clip.category`, `clip.vibeCompat` |

**Nunca se mezclan.** Validación en carga rechaza cualquier `EnergyZoneId` (`silence/valley/ambient/gentle/active/intense/peak`) presente en `clip.spatialZones`.

---

## §2. Schema `.lfx` v3.0 — Estructura Multicelular

### 2.1 Decisión de diseño: `tracks[]` como representación primaria

Alternativas evaluadas:

| Opción | Estructura | Pros | Contras |
|--------|------------|------|---------|
| A) Diccionario anidado | `curves[zone][paramId]` | Lookup O(1) por par (zona, param) | Imposible expresar "misma curva → varias zonas" sin duplicar; no permite múltiples tracks del mismo paramId en la misma zona |
| B) Array de tracks | `tracks: [{ zone, paramId, curve }]` | Multi-target (varias zonas por track), múltiples tracks del mismo paramId, fácil iteración | Lookup O(N) (mitigable con index al cargar) |
| C) Híbrido legacy + tracks | `curves` global + `zoneCurves[zone]` overrides | Compatible con código actual | Ambigüedad de precedencia entre global y zonal |

**Decisión: B (`tracks[]`) como primary, con `curves` legacy degradado a vista derivada de tracks con `zone === 'all'`.**

Razones:
- Expresa nativamente el caso multi-cell ("strobe en center, wash en ambient, bell en air, color en movers" en un único clip).
- Permite múltiples tracks del mismo `paramId` con zonas distintas (CumbiaMoon: `intensity` con `dimmerScale=1.0` en front, `0.7` en back, `0.15` en movers).
- Soporta multi-target en un solo track (ej. mismo strobeRate aplicado a `['center', 'air']`).
- Schema futuro-compatible: añadir `cell?` para sub-fixtures multicell sin breaking change.

### 2.2 Tipo TypeScript propuesto

```ts
// ═══ NUEVOS TIPOS ═══════════════════════════════════════════════════════

import type { CanonicalZone } from '../stage/ShowFileV2'

export type ZoneTarget =
  | CanonicalZone                  // 'front' | 'back' | … | 'unassigned'
  | 'all' | 'all-pars' | 'all-movers'  // helpers

export type BlendMode = 'max' | 'replace' | 'add' | 'multiply'

/**
 * Track multicelular — una curva que se aplica a un conjunto explícito de zonas.
 *
 * RECONCILIA con HephaestusRuntime:
 *   - Si `zones === ['all']` → comportamiento legacy (clip.curves global).
 *   - Si zones es subset → runtime filtra fixtures por zone antes de evaluar.
 *
 * MULTICELULARIDAD:
 *   - Múltiples tracks pueden compartir paramId si tienen zonas disjuntas
 *     (ej. 'intensity' con dimmer=1.0 en front, dimmer=0.15 en movers).
 *   - Múltiples tracks pueden compartir paramId+zone si tienen blendMode
 *     distinto (caso raro, pero soportado: ej. 'add' overlay).
 */
export interface HephTrack {
  /** ID estable del track (UUID o slug determinista). Usado para diff/undo en la Forja. */
  id: string

  /** Parámetro DMX-semántico que este track controla. */
  paramId: HephParamId  // 'intensity' | 'color' | 'pan' | 'tilt' | 'strobeRate' | 'zoom' | …

  /** Conjunto de zonas canónicas (o helpers) sobre las que aplica. NUNCA vacío. */
  zones: readonly ZoneTarget[]

  /** La curva de keyframes (mismo HephCurve actual: keyframes + interpolation + range + valueType). */
  curve: HephCurve

  /** Multiplicador de dimmer (solo si paramId='intensity'). 0..1. Default 1. */
  dimmerScale?: number

  /** Override de color (solo si paramId='color'). Si se define, suplanta el output de la curva. */
  colorOverride?: HSL

  /** Estrategia de fusión multi-track. Default 'replace' para 'color'/'pan'/'tilt', 'max' para 'intensity'. */
  blendMode?: BlendMode

  /**
   * Forward-compat: ID de celda específica dentro de un fixture multicell.
   * Si está presente, el track solo aplica a fixtures que tengan esa celda.
   * Ejemplo: 'cell:strobe' en un Fan Tungsten dirige solo a la celda strobe del fixture.
   * No requerido en v3.0; reservado para v3.1.
   */
  cell?: string

  /**
   * Selector de fixtures fino (opcional). Si presente, se intersecta AND con `zones`.
   * Permite limitar el track a, p.ej., 'movers-left' parity=odd indexRange='1-3'.
   */
  selector?: import('../stage/ShowFileV2').FixtureSelector
}

// ═══ CLIP V3.0 ═══════════════════════════════════════════════════════════

export interface HephAutomationClipV3 {
  // ── Identidad ──
  id: string
  name: string
  author: string
  category: EffectCategory
  tags: string[]
  vibeCompat: string[]

  // ── ESPACIAL CANÓNICO (cierra F3b) ──
  /**
   * Conjunto de zonas canónicas que este clip TOCA (resumen para Selene/UI).
   * Derivado automáticamente de la unión de `tracks[*].zones`.
   * Validación: subset de CANONICAL_ZONES ∪ helpers.
   * NUNCA contiene EnergyZoneId.
   */
  spatialZones: readonly ZoneTarget[]

  // ── EJECUCIÓN ──
  mixBus: 'global' | 'htp' | 'ambient' | 'accent'
  priority: number
  durationMs: number
  effectType: string  // 'heph_custom' o nombre del efecto base

  /**
   * 🆕 EL CORAZÓN MULTICELULAR.
   * Lista plana de tracks. Iteración secuencial en runtime, indexable por (zone, paramId) tras carga.
   */
  tracks: HephTrack[]

  /**
   * Parámetros estáticos (constantes durante todo el clip). Solo para escalares
   * que NO admiten curva (ej. `floorIntensity`, `peakSustainMs`, `bpmRef` debug).
   * NUNCA `dominantColorH/S/L` — eso ahora es una curva color real.
   */
  staticParams: Record<string, number | string | boolean>

  // ── COGNITIVO (separado del espacial — cierra F3c) ──
  cognitiveDNA?: import('../arsenal/lfxTypes').CognitiveDNA
  simulationMeta?: import('../arsenal/lfxTypes').SimulationMeta

  // ── COMPATIBILIDAD V2 (read-only, deprecated) ──
  /** @deprecated v2.x — ahora derivado de tracks. Conservado solo para lectura legacy. */
  readonly curves?: never  // No se serializa en v3
  /** @deprecated v2.x — usa `spatialZones`. */
  readonly zones?: never

  // ── METADATA DE FORMATO ──
  schemaVersion: '3.0'  // ← discriminador para LfxFileLoader
}
```

### 2.3 Wrapper de archivo `.lfx` v3.0

```ts
export interface LFXFileV3 {
  $schema: 'luxsync.lfx/3.0'
  version: '3.0.0'
  clip: HephAutomationClipV3
  checksum: string  // SHA-256 sobre JSON.stringify(clip) sin pretty-print
}
```

### 2.4 Reglas de validación canónica (en carga + guardado)

| Regla | Lugar | Acción si falla |
|-------|-------|-----------------|
| `track.zones.length >= 1` | Loader | Error: track sin destino |
| `track.zones[*] ∈ (CANONICAL_ZONES ∪ HELPERS)` | Loader | Reject + log con sugerencia (ej. `"strobes" → "center"`) |
| `clip.spatialZones === union(tracks[*].zones)` | Loader (recompute) | Auto-corrige y warn |
| `track.curve.valueType === 'color' ⇒ keyframes[*].value es HSL` | Loader | Error: tipo inconsistente |
| `paramId === 'color' ⇒ valueType === 'color'` | Loader | Error |
| `paramId === 'strobeRate' ⇒ range == [0, 1]` | Loader | Auto-clamp + warn |
| `EnergyZoneId NO presente en spatialZones` | Loader | Reject + redirect cognitivamente |

---

## §3. Color como Curva de Primera Clase

### 3.1 Aniquilación de `dominantColorH/S/L`

`dominantColorH/S/L` desaparece de `staticParams` en v3.0. **Sustituido al 100% por curvas `valueType: 'color'`**, ya soportadas por `HephCurve` (`@core/hephaestus/types.ts:291-296`) y por el evaluador `@HephaestusRuntime.ts:543-556`.

Si un cognitive component (Selene scoring, dream simulator) necesita "el color dominante", se computa **on-demand** como:

```
dominant = mean_circular(track.curve.keyframes.map(k => k.value))   // donde paramId='color'
```

No se duplica como metadato.

### 3.2 Schema de keyframe color

```ts
interface HephKeyframeColor {
  timeMs: number
  value: { h: number; s: number; l: number }   // h: 0-360, s: 0-100, l: 0-100
  interpolation: 'hold' | 'linear' | 'bezier'
  bezierHandles?: [number, number, number, number]
}

// La curva
{
  paramId: 'color',
  valueType: 'color',
  range: [0, 360],          // hue range (s/l no varían en eje plot)
  defaultValue: { h: 0, s: 100, l: 50 },
  keyframes: HephKeyframeColor[]
}
```

### 3.3 Algoritmo del migrator: `colorCycle[]` (`.ts`) → curva `color` (`.lfx`)

Dado un `colorCycle: HSL[]` (longitud N) y una duración total `D`, el migrator emite N+1 keyframes igualmente espaciados con interpolación `linear` (interpolación circular de hue es responsabilidad del runtime, ya implementada en `@HephaestusRuntime.ts:553-554` y vía CurveEvaluator):

```
keyframes[i].timeMs = round(i * D / N)              for i in [0..N-1]
keyframes[N].timeMs = D                              // cierre del ciclo
keyframes[i].value = colorCycle[i % N]
keyframes[i].interpolation = 'linear'
keyframes[N].interpolation = 'hold'
```

**Caso CumbiaMoon** (`colorCycle = [{h:210,s:10,l:60},{h:210,s:10,l:70},{h:210,s:10,l:55}]`, `D=5000ms`):

| timeMs | value                 | interp |
|--------|-----------------------|--------|
| 0      | `{h:210,s:10,l:60}`   | linear |
| 1667   | `{h:210,s:10,l:70}`   | linear |
| 3333   | `{h:210,s:10,l:55}`   | linear |
| 5000   | `{h:210,s:10,l:60}`   | hold   |

### 3.4 Override por zona (`moonWhite` en movers)

`CumbiaMoon.ts` aplica un `colorOverride` a la zona `all-movers` (`{h:0,s:0,l:80}` blanco lunar) ignorando el ciclo. El migrator emite **un track adicional** con la misma `paramId='color'` pero `zones=['all-movers']` y `colorOverride: {h:0,s:0,l:80}` + curva degenerada (constante). Al runtime le da igual: el blendMode `'replace'` del track de movers gana sobre el track del ciclo cuando los conjuntos de fixtures se intersectan (no se intersectan en el caso multicelular típico, así que coexisten limpios).

---

## §4. Multicelularidad — Caso Fan Tungsten

### 4.1 El problema

El **Fan Tungsten** (26+ canales) tiene celdas internas: strobe, wash, blinder, eye-candy. En el Stage, cada celda se asigna como `Fixture.zone` separado o como sub-fixture lógico. Un clip multicelular debe poder, en una sola timeline:

- Mandar **strobe burst rítmico** a la celda `strobes`/`center`.
- Mandar **wash de color** (HSL ciclo) a la celda `ambient`.
- Mandar **bell de intensidad** lenta a la celda `air` con un colorOverride pastel.

### 4.2 Cómo el schema lo soporta

Tres tracks independientes en el mismo clip:

```jsonc
{
  "tracks": [
    {
      "id": "fan-strobe",
      "paramId": "strobeRate",
      "zones": ["center"],
      "curve": { /* burst rítmico cuadrado */ }
    },
    {
      "id": "fan-wash",
      "paramId": "color",
      "zones": ["ambient"],
      "curve": { /* ciclo HSL 6s */ }
    },
    {
      "id": "fan-air-bell",
      "paramId": "intensity",
      "zones": ["air"],
      "curve": { /* bell suave */ },
      "dimmerScale": 0.6
    }
  ]
}
```

El runtime, al iterar fixtures, evalúa **solo los tracks cuya `zones` contiene la zona del fixture actual**. Cada celda recibe SU patrón sin contaminación cruzada.

### 4.3 Forward-compat: campo `cell` opcional

Si un mismo fixture multicell expone múltiples celdas a través de `Fixture.cells: [{ id: 'strobe', dmxOffset: 12 }, { id: 'wash', dmxOffset: 4 }]`, un track puede targetar la celda explícitamente:

```jsonc
{ "paramId": "strobeRate", "zones": ["center"], "cell": "strobe", "curve": { … } }
```

Este campo es **reservado en v3.0** (no consumido por runtime) hasta que el Stage exponga API de cells. El migrator NO lo emite todavía. Cero ambigüedad.

---

## §5. Strobe / Shutter — Contrato Determinista

### 5.1 Problema legacy

Los `.ts` que estrobean (CumbiaMoon en su loop intenso, IndustrialStrobe, FeedbackStorm) escriben en distintos campos: a veces `strobeRate`, a veces `shutter`, a veces `intensity` con flicker. El adaptador L0 espera **shutter abierto + strobeRate**, mientras Hephaestus L3 antes solo escribía `strobe` (silencioso en hardware — ya parchado por WAVE 4830 pero el contrato seguía siendo confuso).

### 5.2 Contrato v3.0

| Capa             | Output                                                |
|------------------|-------------------------------------------------------|
| `.lfx` (autor)   | UNA curva con `paramId: 'strobeRate'`, `range: [0,1]`. |
| HephRuntime       | Emite output `parameter: 'strobe'`, `normalizedValue: rate`. |
| HephAetherAdapter | Si `rate > 0` ⇒ `values.strobeRate=rate` Y `values.shutter=1.0`. |
| NodeArbiter       | Aplica LTP en canal; L3 GAG domina luminancia. |
| DMX driver        | Resuelve canal hardware-específico (shutter/strobe DMX). |

**Para el autor del `.lfx` solo existe `strobeRate`.** El `shutter=1.0` lo gestiona el adaptador (ya hay infraestructura: `@HephaestusAetherAdapter.ts:248-256`). v3.0 lo formaliza como invariante del schema.

### 5.3 Algoritmo del migrator: bursts/destellos `.ts` → `strobeRate` curve

El `.ts` legacy frecuentemente expresa strobe como `intensityFlicker(t) = (Math.sin(t * freqHz * 2π) > 0) ? 1 : 0`. El migrator detecta esto y emite una curva `strobeRate` con interpolación `'hold'` (square wave) en vez de una curva intensity con flicker:

```
keyframes (1/freqHz duty cycle):
  { timeMs: 0,        value: 1, interpolation: 'hold' }
  { timeMs: D/(2f),   value: 0, interpolation: 'hold' }
  { timeMs: D/f,      value: 1, interpolation: 'hold' }
  …
```

Si el efecto en `.ts` realmente quiere strobe **continuo** (ej. `strobeFreqHz: 8`), una sola curva strobeRate constante a `0.8` (o el valor normalizado de la frecuencia) basta — el firmware del fixture genera el flicker.

### 5.4 Regla de namespacing

- `paramId: 'strobeRate'` ⇒ semántica "qué tan rápido estrobea (0=sólido, 1=máximo)".
- `paramId: 'intensity'` ⇒ semántica "qué tan abierto el dimmer (0=apagado, 1=full)".
- **Nunca mezclar.** Un autor que quiera "strobe a 8Hz con dimmer en bell" emite **dos tracks**: uno strobeRate constante, uno intensity bell.

---

## §6. Otros Parámetros Multicelulares

| `paramId`     | `valueType` | `range`     | Notas |
|---------------|-------------|-------------|-------|
| `intensity`   | number      | [0, 1]      | dimmer normalizado |
| `color`       | color       | [0, 360]    | HSL keyframes; range = hue plot range |
| `strobeRate`  | number      | [0, 1]      | normalizado; adapter abre shutter |
| `pan`         | number      | [-1, 1] o [0, 1] según `mode` | `absolute` o `relative_offset` (ver `cognitiveDNA.spatialBehavior`) |
| `tilt`        | number      | igual que pan | igual |
| `zoom`        | number      | [0, 1]      | normalizado |
| `focus`       | number      | [0, 1]      | normalizado |
| `iris`        | number      | [0, 1]      | normalizado |
| `gobo1`       | number      | [0, 1]      | normalizado (slot index → fine) |
| `gobo2`       | number      | [0, 1]      | rotation |
| `prism`       | number      | [0, 1]      | normalizado |
| `white`       | number      | [0, 1]      | white channel (separado de RGB) |
| `amber`       | number      | [0, 1]      | amber channel (separado de RGB) |

Todos pueden coexistir con `zones` distintas en tracks separados.

---

## §7. Algoritmo del Migrator v3 (descripción funcional, sin código)

### 7.1 Entrada

Una clase TypeScript que extiende `BaseEffect` con:
- `getOutput(): EffectFrameOutput` → retorna `dimmer`, `color`, `zoneOverrides`, flags.
- `trigger(config)`, `update(deltaMs, ctx)`, …
- Constantes de configuración (`DEFAULT_CONFIG`, `colorCycle`, `cycleDurationMs`, …).

### 7.2 Pipeline determinista

```
1.  AST PARSE
    └─ Extraer DEFAULT_CONFIG (color cycle, durations, scaling factors).

2.  HEADLESS SIMULATION
    └─ Instanciar el efecto con config default.
    └─ Tickear deltaMs = 16.67ms (60fps) durante durationMs.
    └─ Capturar frame snapshot a cada paso: { intensity, color, pan, tilt, zoneOverrides }.
    └─ Resultado: timeline densa de samples.

3.  CURVE FITTING POR ZONA
    └─ Detectar zonas únicas presentes en zoneOverrides (ej. {'front','back','all-movers'}).
    └─ Normalizar cada token a CanonicalZone usando tabla §1.3.
    └─ Para cada (zone, paramId) único: ajustar curva.
        - Detector heurístico:
          * monotónica sin flicker → 2 keyframes (start/end) linear.
          * un pico → 3 keyframes bezier (rise/peak/fall).
          * cíclica suave → N keyframes linear (Douglas-Peucker fitting).
          * cuadrada (strobe) → keyframes hold square.
        - paramId='color': fittear sobre HSL con interpolación circular.

4.  TRACK ASSEMBLY
    └─ Por cada (zone, paramId, curve) → emitir HephTrack.
    └─ Si zoneOverrides[zone].dimmer = bell * 0.7 (relativo a base) → dimmerScale=0.7 + curva base compartida.
    └─ Si zoneOverrides[zone].color = constante → colorOverride + curva degenerada.
    └─ Detectar tracks idénticos en zonas distintas → fusionar en un track con zones=[A,B].

5.  COGNITIVE DNA EXTRACTION
    └─ Leer category, vibeCompat, energy estimates del .ts.
    └─ Poblar clip.cognitiveDNA (NO contamina spatialZones).

6.  STATIC PARAMS RESIDUALES
    └─ Solo escalares no-curvilíneos (peakSustainMs, floorIntensity, bpmRef debug).
    └─ NUNCA dominantColorH/S/L.

7.  VALIDATION
    └─ Aplicar reglas §2.4. Si falla → abort con error explicativo.

8.  EMIT
    └─ Serializar a LFXFileV3, calcular SHA-256, escribir a disco.
```

### 7.3 Idempotencia

El migrator es **determinista y idempotente**: misma entrada `.ts` → mismo `.lfx` byte-exact (orden de tracks estable: por zona canónica ASC, luego paramId ASC). Esto permite checksum-based diffing en CI.

---

## §8. Ejemplo Maestro — `cumbia_moon.lfx` reconstruido en v3.0

Versión final tras pasar el migrator v3 sobre `@core/effects/library/fiestalatina/CumbiaMoon.ts`.

```jsonc
{
  "$schema": "luxsync.lfx/3.0",
  "version": "3.0.0",
  "clip": {
    "id": "cumbia_moon",
    "schemaVersion": "3.0",
    "name": "Cumbia Moon",
    "author": "fiestalatina",
    "category": "atmospheric",
    "tags": ["atmospheric", "color", "cumbia", "moon", "lunar"],
    "vibeCompat": ["latina", "cumbia", "tropical"],

    // ── Espacial canónico (cierra F3b/F3c del audit) ─────────────────────
    "spatialZones": ["front", "back", "movers-left", "movers-right"],

    // ── Ejecución ────────────────────────────────────────────────────────
    "mixBus": "global",
    "priority": 65,
    "durationMs": 5000,
    "effectType": "heph_custom",

    // ── EL CORAZÓN MULTICELULAR — 6 tracks ───────────────────────────────
    "tracks": [
      // ┌─ Front PARs: bell completa con plata lunar animada ──────────────
      {
        "id": "moon-front-bell",
        "paramId": "intensity",
        "zones": ["front"],
        "dimmerScale": 1.0,
        "blendMode": "max",
        "curve": {
          "paramId": "intensity",
          "valueType": "number",
          "range": [0, 1],
          "defaultValue": 0,
          "keyframes": [
            { "timeMs": 0,    "value": 0.15, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2300, "value": 1.00, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2700, "value": 1.00, "interpolation": "linear" },
            { "timeMs": 5000, "value": 0.15, "interpolation": "hold" }
          ]
        }
      },
      {
        "id": "moon-front-color",
        "paramId": "color",
        "zones": ["front"],
        "blendMode": "replace",
        "curve": {
          "paramId": "color",
          "valueType": "color",
          "range": [0, 360],
          "defaultValue": { "h": 210, "s": 10, "l": 60 },
          "keyframes": [
            { "timeMs": 0,    "value": { "h": 210, "s": 10, "l": 60 }, "interpolation": "linear" },
            { "timeMs": 2500, "value": { "h": 210, "s": 10, "l": 70 }, "interpolation": "linear" },
            { "timeMs": 5000, "value": { "h": 210, "s": 10, "l": 55 }, "interpolation": "hold"   }
          ]
        }
      },

      // ┌─ Back PARs: bell atenuada + mismo color cycle (track compartido vía zones[]) ─
      {
        "id": "moon-back-bell",
        "paramId": "intensity",
        "zones": ["back"],
        "dimmerScale": 0.7,
        "blendMode": "max",
        "curve": {
          "paramId": "intensity",
          "valueType": "number",
          "range": [0, 1],
          "defaultValue": 0,
          "keyframes": [
            { "timeMs": 0,    "value": 0.15, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2300, "value": 1.00, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2700, "value": 1.00, "interpolation": "linear" },
            { "timeMs": 5000, "value": 0.15, "interpolation": "hold" }
          ]
        }
      },
      {
        "id": "moon-back-color",
        "paramId": "color",
        "zones": ["back"],
        "blendMode": "replace",
        "curve": {
          "paramId": "color",
          "valueType": "color",
          "range": [0, 360],
          "defaultValue": { "h": 210, "s": 10, "l": 60 },
          "keyframes": [
            { "timeMs": 0,    "value": { "h": 210, "s": 10, "l": 60 }, "interpolation": "linear" },
            { "timeMs": 2500, "value": { "h": 210, "s": 10, "l": 70 }, "interpolation": "linear" },
            { "timeMs": 5000, "value": { "h": 210, "s": 10, "l": 55 }, "interpolation": "hold"   }
          ]
        }
      },

      // ┌─ Movers (L+R fusionados): bell muy tenue + override blanco lunar ─────────────
      {
        "id": "moon-movers-bell",
        "paramId": "intensity",
        "zones": ["movers-left", "movers-right"],   // ← MULTI-ZONE en un track
        "dimmerScale": 0.15,
        "blendMode": "replace",
        "curve": {
          "paramId": "intensity",
          "valueType": "number",
          "range": [0, 1],
          "defaultValue": 0,
          "keyframes": [
            { "timeMs": 0,    "value": 0.15, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2500, "value": 1.00, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 5000, "value": 0.15, "interpolation": "hold" }
          ]
        }
      },
      {
        "id": "moon-movers-color",
        "paramId": "color",
        "zones": ["movers-left", "movers-right"],
        "blendMode": "replace",
        "colorOverride": { "h": 0, "s": 0, "l": 80 },     // ← moonWhite override
        "curve": {
          "paramId": "color",
          "valueType": "color",
          "range": [0, 360],
          "defaultValue": { "h": 0, "s": 0, "l": 80 },
          "keyframes": [
            { "timeMs": 0,    "value": { "h": 0, "s": 0, "l": 80 }, "interpolation": "hold" },
            { "timeMs": 5000, "value": { "h": 0, "s": 0, "l": 80 }, "interpolation": "hold" }
          ]
        }
      }
    ],

    // ── Estáticos (residuales puros, NO dominantColor) ───────────────────
    "staticParams": {
      "peakSustainMs": 400,
      "floorIntensity": 0.15,
      "bpmRef": 128,
      "overrideMoverShield": true,
      "isOneShot": false
    },

    // ── Cognitivo (separado del espacial) ────────────────────────────────
    "cognitiveDNA": {
      "energyZones": ["valley", "ambient", "gentle"],   // ← AHORA aquí, NO en spatialZones
      "compatibleVibes": ["latina", "cumbia", "tropical"],
      "spatialBehavior": "static",
      "maxStrobeFreqHz": 0,
      "acoTriad": { "aggression": 0.2, "chaos": 0.15, "organicity": 0.85 }
    }
  },
  "checksum": "<sha256-determinista-sobre-clip>"
}
```

### 8.1 Lo que se recupera respecto a v2 (audit WAVE-4847)

| Riqueza original (`.ts`)            | v2 (.lfx actual) | v3 (.lfx propuesto) |
|--------------------------------------|------------------|---------------------|
| Bell intensidad                      | ✅               | ✅                   |
| Ciclo HSL 3 keyframes                | ❌ (dominant only) | ✅ keyframes reales  |
| Front/Back/Movers separados          | ❌ → "ambient"    | ✅ tracks por zona   |
| dimmerScale 1.0 / 0.7 / 0.15         | ❌               | ✅ por track         |
| moonWhite override en movers         | ❌               | ✅ colorOverride     |
| blendMode max/replace                | ❌               | ✅                   |
| overrideMoverShield                  | ❌               | ✅ staticParams      |
| Separación espacial vs cognitivo     | ❌ colisión       | ✅ canon + DNA       |
| BPM-sync dinámico                    | ❌ (bpmRef estático) | ⚠️ bpmRef estático (mejora futura: campo `tempoSync`) |

---

## §9. Compatibilidad con HephaestusRuntime (qué cambia)

### 9.1 Cambios mínimos requeridos en runtime

| Componente                 | Cambio | Magnitud |
|----------------------------|--------|----------|
| `LfxFileLoader`            | Detectar `schemaVersion`. v2 → adapter de upgrade in-memory. v3 → carga directa. | ~80 LOC |
| `HephaestusRuntime.tick*`  | Iterar `clip.tracks` en lugar de `clip.curves`. Filtrar por `fixture.zone ∈ track.zones`. | ~120 LOC |
| `HephAetherAdapter`        | Aplicar `dimmerScale` y `colorOverride` antes de `_populateValues`. | ~30 LOC |
| `serializeHephClip` v3     | Nueva función — serializa `tracks[]` directamente. | ~40 LOC |
| Forja UI (HephaestusView)  | Mostrar tracks por zona + selector de zonas + dimmerScale slider. | ~300 LOC (sprint posterior) |

### 9.2 Adaptador v2→v3 (lectura legacy)

Para preservar los 36 builtins actuales mientras se re-migran:

```
loadV2Clip(v2): HephAutomationClipV3 {
  tracks = []
  for (paramId, curve) in v2.curves:
    tracks.push({ id: synthId(paramId), paramId, zones: ['all'], curve })
  if (v2.staticParams.dominantColorH != null):
    tracks.push(synthColorCurveFromDominant(v2.staticParams))   // P1 del audit
  spatialZones = sanitizeZones(v2.zones)   // EnergyZones → cognitiveDNA, resto → unassigned
  return { …v2, tracks, spatialZones, schemaVersion: '3.0' }
}
```

Esto da una transición no-rompedora: el sistema sirve `.lfx` v2 y v3 simultáneamente; los v2 cargados son funcionalmente equivalentes a v3 con un único track global por paramId.

### 9.3 Forja UI (Hephaestus Editor) — implicación

El editor actual presenta **un track por paramId** sin dimensión de zona. v3 requiere añadir un **selector de zonas por track** (chips multi-selección) y un slider `dimmerScale`. Las curvas en sí no cambian — el editor de keyframes existente sigue válido. **El cambio es additivo**, no rompedor.

---

## §10. Reglas de Validación CI / Pre-commit

Al introducir v3, se añaden chequeos automáticos en CI:

```
1. assertCanonicalZones(lfx):
     for track in lfx.clip.tracks:
       assert track.zones ⊆ CANONICAL_ZONES ∪ {'all', 'all-pars', 'all-movers'}
     assert lfx.clip.spatialZones === union(tracks[*].zones)
     assert no EnergyZoneId in lfx.clip.spatialZones

2. assertNoFossilColor(lfx):
     assert 'dominantColorH' not in lfx.clip.staticParams
     assert 'dominantColorS' not in lfx.clip.staticParams
     assert 'dominantColorL' not in lfx.clip.staticParams

3. assertChecksumValid(lfx):
     assert lfx.checksum === sha256(JSON.stringify(lfx.clip))

4. assertDeterministicMigration(tsFile):
     out1 = migrate(tsFile)
     out2 = migrate(tsFile)
     assert sha256(out1) === sha256(out2)   // idempotencia
```

---

## §11. Criterios de Aceptación del Blueprint

Este blueprint se considera **listo para implementación** cuando:

- [ ] Se confirma que `HephTrack` cubre los 36 builtins legacy sin pérdida estructural (validar con head-less simulation contra cada `.ts`).
- [ ] Se valida que la suma de tracks no excede el budget de 50 outputs/frame por fixture (límite del runtime actual).
- [ ] La Forja UI tiene un mock-up del selector de zonas + dimmerScale por track.
- [ ] El adapter v2→v3 in-memory pasa los tests visuales en Hyperion 2D para los 36 builtins (cero regresión).
- [ ] El sample `cumbia_moon.lfx` v3 (§8) renderiza en Hyperion 2D mostrando: bell completa en front, atenuada en back, blanco lunar tenue en movers — visualmente equivalente al `.ts` original.

---

## §12. Roadmap de implementación (alineado con WAVE-4847 §5.5)

| Sprint | Entregable                                                              | Bloquea |
|--------|--------------------------------------------------------------------------|---------|
| 1      | Schema v3.0 TS types + LfxFileLoader v3 + adapter v2→v3 + validación CI | Todo lo demás |
| 2      | Migrator v3 (algoritmo §7) + re-export de los 36 builtins                | UI, runtime tracks |
| 3      | HephRuntime tracks-aware + adapter `dimmerScale`/`colorOverride`         | Forja UI |
| 4      | Forja UI: zone selector por track, dimmerScale, colorOverride            | Producción |
| 5      | Tests visuales Hyperion 2D + golden snapshots de los 36 builtins         | Lock-in |

---

## §13. Ejemplo extra — Fan Tungsten multicelular (3 zonas, 3 tracks)

Demuestra §4 sin ambigüedad. Un solo `.lfx` mandando comportamientos distintos a 3 celdas:

```jsonc
{
  "$schema": "luxsync.lfx/3.0",
  "version": "3.0.0",
  "clip": {
    "id": "fan_tungsten_triple",
    "schemaVersion": "3.0",
    "name": "Fan Tungsten Triple",
    "author": "system",
    "category": "atmospheric",
    "tags": ["multicell", "demo"],
    "vibeCompat": [],
    "spatialZones": ["center", "ambient", "air"],
    "mixBus": "global",
    "priority": 70,
    "durationMs": 4000,
    "effectType": "heph_custom",
    "tracks": [
      {
        "id": "ft-strobe-burst",
        "paramId": "strobeRate",
        "zones": ["center"],
        "curve": {
          "paramId": "strobeRate", "valueType": "number", "range": [0, 1],
          "defaultValue": 0,
          "keyframes": [
            { "timeMs": 0,    "value": 0,   "interpolation": "hold" },
            { "timeMs": 1000, "value": 0.9, "interpolation": "hold" },
            { "timeMs": 1500, "value": 0,   "interpolation": "hold" },
            { "timeMs": 4000, "value": 0,   "interpolation": "hold" }
          ]
        }
      },
      {
        "id": "ft-ambient-wash",
        "paramId": "color",
        "zones": ["ambient"],
        "blendMode": "replace",
        "curve": {
          "paramId": "color", "valueType": "color", "range": [0, 360],
          "defaultValue": { "h": 30, "s": 80, "l": 50 },
          "keyframes": [
            { "timeMs": 0,    "value": { "h": 30,  "s": 80, "l": 50 }, "interpolation": "linear" },
            { "timeMs": 2000, "value": { "h": 200, "s": 80, "l": 50 }, "interpolation": "linear" },
            { "timeMs": 4000, "value": { "h": 30,  "s": 80, "l": 50 }, "interpolation": "hold"   }
          ]
        }
      },
      {
        "id": "ft-air-pulse",
        "paramId": "intensity",
        "zones": ["air"],
        "dimmerScale": 0.6,
        "blendMode": "max",
        "curve": {
          "paramId": "intensity", "valueType": "number", "range": [0, 1],
          "defaultValue": 0,
          "keyframes": [
            { "timeMs": 0,    "value": 0, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 2000, "value": 1, "interpolation": "bezier", "bezierHandles": [0.42, 0, 0.58, 1] },
            { "timeMs": 4000, "value": 0, "interpolation": "hold" }
          ]
        }
      }
    ],
    "staticParams": {},
    "cognitiveDNA": {
      "energyZones": ["active", "intense"],
      "compatibleVibes": [],
      "spatialBehavior": "static",
      "maxStrobeFreqHz": 12,
      "acoTriad": { "aggression": 0.7, "chaos": 0.5, "organicity": 0.3 }
    }
  },
  "checksum": "<sha256>"
}
```

Un Fan Tungsten físico con celdas asignadas a `center`, `ambient` y `air` recibe los tres patrones simultáneamente vía un solo clip. **Esa es la multicelularidad nativa que v3 desbloquea**.

---

*Blueprint redactado bajo directiva WAVE-4848 (V3) tras auditoría WAVE-4847.*
*Próximo paso: aprobación → implementación schema TS + adapter v2→v3 (Sprint 1).*
