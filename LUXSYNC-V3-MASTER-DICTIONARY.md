# Diccionario Maestro de LuxSync V3

**Autor:** LuxSync Engine Audit  
**Generado:** 2026-05-24  
**Scope:** `electron-app/src/core/`  
**Versión:** V3 (WAVE 4856+)  

> Este documento es la **Biblia canónica** para la autoría de efectos V3. Todos los campos, tipos, zonas y umbrales aquí documentados provienen directamente de las fuentes de verdad del motor (TypeScript), no de suposiciones.

---

## 1. Tipos de Efecto

### 1.1 EffectCategory (Clasificación Física)

Fuente de verdad: `src/core/effects/types.ts:40-45`

| Valor | Semántica | Merge Strategy |
|-------|-----------|----------------|
| `physical` | Dimmer / strobe / shutter | HTP (Highest Takes Precedence) |
| `color` | Cromático (HSL, white, amber) | Color blending |
| `movement` | Pan / tilt / posición | Position merge |
| `optics` | Zoom, focus, iris, gobo, prism | Beam shaping |
| `composite` | Multi-parámetro (toca 2+ categorías) | Full merge |

### 1.2 EffectType (Identidad de Efecto)

Fuente de verdad: `src/core/arsenal/lfxTypes.ts:232` y `src/core/hephaestus/types.ts:403`

- **Tipo canónico en el motor:** `string` (libre, no es enum cerrado).
- **Valor base para clips que entran en pipeline L3+ del NodeArbiter:** `heph_custom`
- **Otros valores existentes en builtins:** cada .lfx declara su propio nombre (ej: `solar_flare`, `core_meltdown`, `digital_rain`, etc.).
- **Regla:** Si `effectType === 'heph_custom'` y tiene `cognitiveDNA`, el clip es elegible para Selene IA (`isSeleneEligible`).

### 1.3 Efectos Conocidos en Builtins (Arsenal)

Fuente: `src/core/arsenal/builtins/` (50 clips auditados).

| Vibe | Efectos |
|------|---------|
| **Techno** (24) | `acid_sweep`, `ambient_strobe`, `arena_sweep`, `binary_glitch`, `cascade_strike`, `core_meltdown`, `cyber_dualism`, `feedback_storm`, `gatling_raid`, `ghost_chase`, `industrial_strobe`, `lateral_frag`, `machine_gun`, `neon_blinder`, `red_surge`, `seismic_snap`, `sky_saw`, `solar_flare`, `surgical_strike`, `thunder_struck`, `void_collapse`, `void_mist`, `ghost_breath`, `strobe_burst` |
| **Latin** (12) | `amazon_mist`, `clave_rhythm`, `corazon_latino`, `cumbia_moon`, `ghost_breath`, `glitch_guaguanco`, `latina_meltdown`, `liquid_solo`, `machete_spark`, `oro_solido`, `salsa_fire`, `strobe_storm` |
| **Pop-Rock** (6) | `amp_heat`, `arena_sweep`, `feedback_storm`, `liquid_solo`, `power_chord`, `spotlight_pulse`, `stage_wash` |
| **Chillout** (8) | `abyssal_rise`, `deep_breath`, `digital_rain`, `fiber_optics`, `ghost_breath`, `solar_caustics`, `sonar_ping`, `static_pulse` |

---

## 2. Zonas Canónicas de Iluminación

### 2.1 CanonicalZone (9 valores)

Fuente de verdad: `src/core/stage/ShowFileV2.ts:282-291`

| Zona | Significado | Ejemplo de fixtures |
|------|-------------|---------------------|
| `front` | PARs frontales (audience-facing wash) | Front wash, audience lights |
| `back` | PARs traseros (counter/backlight) | Backlight, counter wash |
| `floor` | PARs de suelo (uplight) | Uplights, floor cans |
| `movers-left` | Cabezas móviles lado izquierdo | Left moving heads |
| `movers-right` | Cabezas móviles lado derecho | Right moving heads |
| `center` | Strobes / Blinders centrales | Center blinders, center strobes |
| `air` | Láseres / Aerials / Atmósfera | Lasers, hazers, atmospherics |
| `ambient` | House lights / ambiente | House lights, ambient fixtures |
| `unassigned` | Sin asignar | Fixtures sin zona definida |

### 2.2 EffectZone (Canon + Helpers + Stereo)

Fuente de verdad: `src/core/effects/types.ts:64-74`

Además de `CanonicalZone`, el motor acepta estos helpers dinámicos:

| Helper | Expansión (COMPOSITE_ZONES) |
|--------|-----------------------------|
| `all` | Todas las fixtures |
| `all-pars` | `front` + `back` + `floor` |
| `all-movers` | `movers-left` + `movers-right` |
| `all-left` | Fixtures con `position.x < 0` |
| `all-right` | Fixtures con `position.x >= 0` |

**Stereo sub-zones** (combinan canonical + lateral):

| Zona | Resolución |
|------|------------|
| `frontL` / `frontR` | `front` + `left`/`right` |
| `backL` / `backR` | `back` + `left`/`right` |
| `floorL` / `floorR` | `floor` + `left`/`right` |

### 2.3 Legacy (Normalización)

Fuente: `src/core/stage/ShowFileV2.ts:371-423`

Legacy strings como `FRONT_PARS`, `MOVING_LEFT`, `stage-left`, `truss-1`, etc. se normalizan automáticamente a `CanonicalZone` mediante `normalizeZone()`. Los .lfx V3 DEBEN usar valores canónicos directamente.

### 2.4 ZoneTarget (V3 Track Routing)

Fuente: `src/core/hephaestus/types.ts:437`

```typescript
type ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'
```

Cada `HephTrack` en V3 declara `zones: readonly ZoneTarget[]` — la intersección AND con `fixtureSelector` (si existe) produce la lista final de fixture IDs.

---

## 3. Métricas de ADN (CognitiveDNA)

Fuente de verdad: `src/core/arsenal/lfxTypes.ts:147-164`

### 3.1 FrozenGenome (El Cubo Unitario A-C-O)

| Campo | Rango | Significado |
|-------|-------|-------------|
| `aggression` | `0..1` | Qué tan violento/brutal es el efecto |
| `chaos` | `0..1` | Qué tan impredecible/aleatorio es |
| `organicity` | `0..1` | Qué tan orgánico vs mecánico se siente |

### 3.2 TextureAffinity

Fuente: `src/core/arsenal/lfxTypes.ts:34`

| Valor | Significado |
|-------|-------------|
| `clean` | Textura limpia, definida, precisa |
| `dirty` | Textura sucia, glitch, ruidosa |
| `universal` | Compatible con cualquier textura |

### 3.3 CognitiveDNA — Campos Principales

| Campo | Tipo | Significado |
|-------|------|-------------|
| `genome` | `FrozenGenome` | aggression, chaos, organicity |
| `textureAffinity` | `TextureAffinity` | clean / dirty / universal |
| `compatibleVibes` | `string[]` | IDs de vibe con los que el efecto es compatible |
| `validSections` | `string[]` | Tipos de sección musical donde puede dispararse |
| `energyZone` | `EnergyZoneRange` | `{ min: EnergyZone, max: EnergyZone }` — Rango válido en The Ladder |
| `aggressionRange` | `Range` | `{ min: number, max: number }` — Rango de agresión aceptable |
| `spatialBehavior` | `SpatialBehavior` | Relación con IK (ver 3.4) |
| `ikCompatibility` | `IKCompatibility` | (opcional) Parámetros de IK |
| `executionDomain` | `ExecutionDomain` | vector / pixel / hybrid (ver 3.5) |
| `pixelHints` | `PixelExecutionHints` | (opcional) Solo si executionDomain es pixel/hybrid |

### 3.4 SpatialBehavior

Fuente: `src/core/arsenal/lfxTypes.ts:48-52`

| Valor | Significado |
|-------|-------------|
| `static` | No toca pan/tilt. Solo dimmer/color/optics. |
| `relative_offset` | Emite `pan_offset`/`tilt_offset` ∈ [-1,+1]. Se SUMA a la base IK. |
| `absolute` | Secuestra pan/tilt absolutos. Si hay IK target activo, SeleneHephBridge silencia pan/tilt del clip. |
| `spatial` | Reservado futuro: trayectoria 3D (x,y,z) resuelta por IK por fixture. |

### 3.5 IKCompatibility

| Campo | Tipo | Significado |
|-------|------|-------------|
| `respectsTarget` | `boolean` | true = respeta target IK; false = lo ignora |
| `orbitAmplitude` | `number (0..1)` | Amplitud de órbita relativa al target (solo `relative_offset`) |
| `fallbackOnNoTarget` | `'static' | 'absolute' | 'silence'` | Comportamiento cuando NO hay target IK activo |

**Valores por defecto:** `respectsTarget: true`, `orbitAmplitude: 1.0`, `fallbackOnNoTarget: 'static'`

### 3.6 ExecutionDomain (WAVE 4812)

| Valor | Significado |
|-------|-------------|
| `vector` | (default) Curvas Bézier evaluadas por `HephaestusRuntime`. |
| `pixel` | Render bitmap a `Uint8ClampedArray` muestreado por `PixelMapAetherAdapter`. |
| `hybrid` | Emite ambos: curvas Bézier para `hybridChannels` + canvas para el resto. |

### 3.7 SimulationMeta (Metadata de Simulación)

Fuente: `src/core/arsenal/lfxTypes.ts:167-185`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `beautyWeights.base` | `number` | Peso base de belleza |
| `beautyWeights.energyMultiplier` | `number` | Multiplicador de energía sobre belleza |
| `beautyWeights.vibeBonus` | `number` | Bonus de compatibilidad de vibe |
| `gpuCost` | `number` | Costo estimado de GPU (0-1) |
| `fatigueImpact` | `number` | Impacto de fatiga visual (0-1) |
| `minDurationMs` | `number` | Duración mínima en ms |
| `cooldownMs` | `number` | Cooldown obligatorio tras disparo |
| `isStrobe` | `boolean` | ¿Contiene estroboscopia? |
| `isDivineCandidate` | `boolean` | ¿Puede ser elegido como efecto "divino"? |
| `isHeavyCandidate` | `boolean` | ¿Es candidato a efecto "pesado"? |
| `zScoreGuards.requireRising` | `boolean` | ¿Requiere energía ascendente? |
| `zScoreGuards.minimumZ` | `number \| null` | Z-Score mínimo para disparar |
| `zScoreGuards.minimumEnergy` | `number \| null` | Energía mínima absoluta |

**Valores por defecto:** `base: 0.50`, `energyMultiplier: 1.00`, `vibeBonus: 0.00`, `gpuCost: 0.30`, `fatigueImpact: 0.06`, `minDurationMs: 1000`, `cooldownMs: 7000`, `isStrobe: false`, `isDivineCandidate: false`, `isHeavyCandidate: false`, `requireRising: false`, `minimumZ: null`, `minimumEnergy: null`.

### 3.8 SafetyDeclaration

| Campo | Tipo | Significado |
|-------|------|-------------|
| `maxStrobeFreqHz` | `number` | Frecuencia máxima declarada (Hz). 0 si no es estroboscópico. |
| `containsRapidFlash` | `boolean` | true si contiene flash >3Hz en algún segmento |
| `communityTrusted` | `boolean` | true solo para efectos firmados/builtin |

---

## 4. Zonas Energéticas — The Ladder (WAVE 996)

Fuente de verdad: `src/core/intelligence/EnergyConsciousnessEngine.ts:98-120`

### 4.1 Las 7 Zonas

| Zona | Rango de Energía | Ancho | Efectos Ejemplo |
|------|------------------|-------|-----------------|
| **SILENCE** | 0.00 – 0.15 | 15% | `DeepBreath`, `SonarPing` |
| **VALLEY** | 0.15 – 0.30 | 15% | `VoidMist`, `FiberOptics` |
| **AMBIENT** | 0.30 – 0.45 | 15% | `DigitalRain`, `AcidSweep` |
| **GENTLE** | 0.45 – 0.60 | 15% | `AmbientStrobe`, `BinaryGlitch` |
| **ACTIVE** | 0.60 – 0.75 | 15% | `CyberDualism`, `SeismicSnap` |
| **INTENSE** | 0.75 – 0.90 | 15% | `SkySaw`, `AbyssalRise` |
| **PEAK** | 0.90 – 1.00 | 10% | `Gatling`, `CoreMeltdown`, `Indus` |

### 4.2 Umbrales (Thresholds)

Fuente: `EnergyConsciousnessEngine.ts:DEFAULT_CONFIG.zoneThresholds`

```typescript
zoneThresholds: {
  silence: 0.15,   // E < 0.15 = SILENCE
  valley: 0.30,    // E < 0.30 = VALLEY
  ambient: 0.45,   // E < 0.45 = AMBIENT
  gentle: 0.60,    // E < 0.60 = GENTLE
  active: 0.75,    // E < 0.75 = ACTIVE
  intense: 0.90,  // E < 0.90 = INTENSE
                   // E >= 0.90 = PEAK
}
```

### 4.3 EnergyContext (Output del Motor)

Fuente: `src/core/protocol/MusicalContext.ts:166-193`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `absolute` | `number (0-1)` | Energía instantánea sin suavizado |
| `smoothed` | `number (0-1)` | Energía suavizada para zonas bajas |
| `percentile` | `number (0-100)` | Percentil histórico |
| `zone` | `EnergyZone` | Zona actual del termómetro |
| `previousZone` | `EnergyZone` | Zona anterior (para transiciones) |
| `sustainedLow` | `boolean` | ¿E<0.4 por >5s? |
| `sustainedHigh` | `boolean` | ¿E>0.7 por >3s? |
| `trend` | `number (-1..1)` | Velocidad de cambio (+=subiendo) |
| `lastZoneChange` | `number` | Timestamp de último cambio |
| `isFlashbang` | `boolean` | Salto instantáneo baja→alta (WAVE 960) |

### 4.4 Diseño Asimétrico (Edge Cases)

- **Bajada lenta:** `smoothingFactorDown: 0.92` (~500ms para estabilizar en silencio)
- **Subida rápida:** `smoothingFactorUp: 0.3` (~50ms para detectar spike)
- **Peak Hold:** 80ms de preservación de transitorios (WAVE 979)
- **Flashbang Protocol:** Detecta `silence/valley/ambient` → `intense/peak` y dispara solo efectos cortos hasta confirmar sostenimiento (WAVE 960)

---

## 5. Parámetros de Curva (HephParamId)

Fuente de verdad: `src/core/hephaestus/types.ts:178-200`

### 5.1 Lista Canónica

| paramId | Tipo de Valor | Rango | Mapeo a DMX / Output |
|---------|---------------|-------|----------------------|
| `intensity` | `number` | `0-1` | `dimmerOverride` |
| `color` | `HSL` | `h:0-360, s:0-100, l:0-100` | `colorOverride` |
| `white` | `number` | `0-1` | `whiteOverride` |
| `amber` | `number` | `0-1` | `amberOverride` |
| `speed` | `number` | `0-1` | Parámetro interno del efecto |
| `pan` | `number` | `0-1` | `movement.pan` → 16-bit DMX (coarse+fine) |
| `tilt` | `number` | `0-1` | `movement.tilt` → 16-bit DMX (coarse+fine) |
| `zoom` | `number` | `0-1` → `0-255` | Canal zoom DMX |
| `focus` | `number` | `0-1` → `0-255` | Canal focus DMX |
| `iris` | `number` | `0-1` → `0-255` | Canal iris DMX |
| `gobo1` | `number` | `0-1` → `0-255` | Gobo wheel 1 |
| `gobo2` | `number` | `0-1` → `0-255` | Gobo wheel 2 |
| `prism` | `number` | `0-1` → `0-255` | Prism rotation |
| `strobe` | `number` | `0-1` (0=off, 1=18Hz) | `strobeRate` |
| `strobeRate` | `number` | `0-1` | Alias V3 de `strobe` (WAVE 4848) |
| `globalComp` | `number` | `0-1` | `globalComposition` (opacidad sobre física) |
| `width` | `number` | `0-1` | Beam/chase width interno |
| `direction` | `number` | `0-1` | Sweep direction (0=L→R, 1=R→L) |

### 5.2 Audio Binding (WAVE 2030.14)

Cada `HephKeyframe` puede tener `audioBinding`:

| Campo | Opciones | Significado |
|-------|----------|-------------|
| `source` | `energy` / `bass` / `mids` / `highs` / `none` | Canal de audio que modula el valor |
| `inputRange` | `[number, number]` | Rango de entrada del analizador |
| `outputRange` | `[number, number]` | Rango de salida para el parámetro |
| `smoothing` | `number (0-1)` | 0 = instantáneo, 1 = muy lento |

### 5.3 HephCurve (Estructura de Curva)

```typescript
interface HephCurve {
  paramId: HephParamId
  valueType: 'number' | 'color'
  range: [number, number]        // Rango válido para valores numéricos
  defaultValue: number | HSL     // Valor por defecto
  keyframes: HephKeyframe[]      // Ordenados por timeMs ascendente
  mode: HephCurveMode            // 'absolute' | 'relative' | 'additive'
}
```

### 5.4 BlendMode (Fusión Multi-Track V3)

Fuente: `src/core/hephaestus/types.ts:447`

| Modo | Significado | Default para |
|------|-------------|--------------|
| `max` | HTP: gana el valor más alto | `intensity` |
| `replace` | LTP: el track de mayor prioridad gana | `color`, `pan`, `tilt` |
| `add` | Aditivo: suma clampeada a `range.max` | — |
| `multiply` | Multiplicativo: producto de valores | — |

---

## 6. MixBus (Rutas de Mezcla)

Fuente: `src/core/hephaestus/types.ts:375-386`

| Valor | Track FX | Uso |
|-------|----------|-----|
| `global` | FX1 | Takeover total (strobes, blinders, meltdowns) |
| `htp` | FX2 | High-priority transitional (sweeps, chases) |
| `ambient` | FX3 | Atmósferas de fondo (mists, rain, breath) |
| `accent` | FX4 | Acentos cortos (sparks, hits, punchy) |

---

## 7. Phase Distribution (WAVE 2400)

Fuente: `src/core/hephaestus/types.ts:82-147`

| Campo | Tipo | Significado |
|-------|------|-------------|
| `spread` | `number (0-1)` | Fracción de `durationMs` entre primer y último fixture |
| `symmetry` | `PhaseSymmetryMode` | `linear` / `mirror` / `center-out` |
| `wings` | `number (1-N)` | Cantidad de sub-grupos con fase independiente |
| `direction` | `PhaseDirection` | `1` = forward, `-1` = reverse |

---

## 8. Vibe Compatibility (vibeCompat)

Fuente de verdad: camp `vibeCompat: string[]` en cada `.lfx`.

Valores canónicos observados en builtins:

| Familia | Valores típicos |
|---------|-----------------|
| **Techno** | `techno`, `industrial`, `minimal`, `acid`, `cyberpunk`, `dark`, `dubstep`, `metal` |
| **Latin** | `latin`, `salsa`, `cumbia`, `tropical`, `romantic` |
| **Rock** | `rock`, `pop-rock`, `blues`, `rock-anthem` |
| **Chill** | `chill-lounge`, `chill`, `ambient` |

---

## 9. DecisionSource (Origen de Disparo)

Fuente: `src/core/effects/types.ts:310`

Valores válidos para `EffectTriggerConfig.source`:

- `hunt_strike` — Legacy alias
- `hunt` — HuntEngine AI
- `dream` — EffectDreamSimulator
- `evolution` — Evolución autónoma
- `bias-correction` — Corrección de sesgo
- `memory` — Memoria histórica
- `beauty` — Decisión estética
- `consonance` — Consonancia armónica
- `prediction` — Predicción anticipada
- `manual` — UI button / operador humano
- `physics` — Motor físico
- `vibe` — VibeManager
- `chronos` — Timeline (bypass vibe restrictions)

---

## 10. Section Types (Secciones Musicales)

Fuente: `src/core/protocol/MusicalContext.ts:66-75`

```typescript
type SectionType = 
  | 'intro'
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'breakdown'
  | 'buildup'
  | 'drop'
  | 'outro'
  | 'unknown'
```

---

## 11. Macro-Generos

Fuente: `src/core/protocol/MusicalContext.ts:80-86`

```typescript
type MacroGenre = 
  | 'ELECTRONIC'
  | 'LATIN'
  | 'ROCK'
  | 'POP'
  | 'CHILL'
  | 'UNKNOWN'
```

---

## 12. Mood / Emotional States

Fuente: `src/core/protocol/MusicalContext.ts:91-99`

```typescript
type Mood = 
  | 'euphoric'
  | 'melancholic'
  | 'aggressive'
  | 'dreamy'
  | 'neutral'
  | 'mysterious'
  | 'triumphant'
```

---

## Referencias Cruzadas

| Concepto | Archivo Fuente | Líneas |
|----------|---------------|--------|
| EffectCategory, EffectZone | `src/core/effects/types.ts` | 40-75 |
| HephParamId | `src/core/hephaestus/types.ts` | 178-200 |
| CognitiveDNA, SimulationMeta | `src/core/arsenal/lfxTypes.ts` | 147-185 |
| EnergyZone, EnergyContext | `src/core/protocol/MusicalContext.ts` | 145-193 |
| CanonicalZone, normalizeZone | `src/core/stage/ShowFileV2.ts` | 282-423 |
| ZoneMapper, COMPOSITE_ZONES | `src/core/zones/ZoneMapper.ts` | 62-117 |
| The Ladder thresholds | `src/core/intelligence/EnergyConsciousnessEngine.ts` | 98-120 |
| BlendMode, HephTrack | `src/core/hephaestus/types.ts` | 447-499 |
| MixBus | `src/core/hephaestus/types.ts` | 375-386 |
| ExecutionDomain | `src/core/arsenal/lfxTypes.ts` | 115-141 |

---

*Fin del Diccionario Maestro. Toda discrepancia entre este documento y el runtime debe resolverse a favor del runtime.*
