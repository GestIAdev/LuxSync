# AUDITORÍA GLOBAL DE TRAZABILIDAD "VIBE" — PLANO DE INSTALACIÓN ELÉCTRICA

**Fecha:** 2026-09-12
**Alcance:** Solo lectura. Sin modificaciones de código.
**Método:** 6 subagentes en paralelo cubriendo tipos base, orquestación core, motor físico, motor cromático, subsistemas periféricos, y barrido global de literales.
**Objetivo:** Mapa arquitectónico absoluto de dónde y cómo se consume el estado de la vibra, para evaluar la inyección de una nueva vibra `rave` o `xrave`.

---

## 0. RESUMEN EJECUTIVO

**Hallazgo crítico:** No existe una única fuente de verdad para `VibeId`. Hay **5 uniones de tipo independientes** que enumeran las vibes canónicas, **7 mapas `Record`** que las asocian a perfiles/movimiento/color, y **decenas de `if/else` con `includes()` y `===`** que ramifican comportamiento por nombre. Una nueva vibra debe tocar **mínimo 20 archivos** para funcionar correctamente.

**Mecanismo dominante:** `Record<string, T>` lookup con fallback silencioso a `idle` o `techno`. No hay `switch/case` exhaustivo sobre vibes (solo 1 switch sobre `profile.qualityTier`). No hay `import()` dinámico. Todo es lookup estático en tiempo de ejecución.

**Ruta de inyección:** Existen dos caminos:
1. **Canónica:** añadir `'rave'` a todas las uniones, mapas, y perfiles (20+ archivos).
2. **Graft:** usar `VibeGraftRegistry.graft()` con key `custom:rave` — inyecta en runtime los 7 mapas sin tocar tipos (pero requiere un `FusedVibeBundle` completo).

---

## 1. TIPOS BASE — Las 5 uniones independientes

### 1.1 `types/VibeProfile.ts:18` — Unión canónica principal

```ts
export type VibeId = 'idle' | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';
```

- **Mecanismo:** TypeScript string-literal union.
- **Riesgo `rave`:** Error de compilación. `VibeProfile.id`, `VibeDebugInfo.activeVibe` rechazan `'rave'`.
- **Severidad:** CRÍTICA — es el tipo que más archivos importan.

### 1.2 `core/protocol/SeleneProtocol.ts:47-57` — Unión del protocolo de broadcast

```ts
export type VibeId =
  | 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge' | 'idle' | 'custom'
```

- **Mecanismo:** Unión independiente (incluye `'custom'` que la 1.1 no tiene).
- **Riesgo `rave`:** El `VibeState` broadcast no puede transportar `'rave'` sin casting.
- **Severidad:** ALTA.

### 1.3 `chronos/core/TimelineClip.ts:28-31` — Unión del timeline + validador runtime

```ts
export type VibeType = 'fiesta-latina' | 'techno-club' | 'chill-lounge' | 'pop-rock' | 'idle'
export const VALID_VIBE_TYPES: ReadonlySet<string> = new Set([...])
export function toVibeType(value: string | undefined): VibeType {
  if (value && VALID_VIBE_TYPES.has(value)) return value as VibeType
  return 'idle'  // ← 'rave' se degrada a 'idle' silenciosamente
}
```

- **Mecanismo:** Unión + `Set` validador + función coercitiva.
- **Riesgo `rave`:** `toVibeType('rave')` → `'idle'`. Clips de timeline con vibe `rave` se cargan como `idle` (gris).
- **Severidad:** ALTA.

### 1.4 `core/orchestrator/TitanOrchestrator.ts:34` — Unión local duplicada

```ts
type VibeId = 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge' | 'idle'
```

- **Mecanismo:** Unión local (no importa la de `VibeProfile.ts`).
- **Riesgo `rave`:** `TitanOrchestrator.setVibe('rave')` es error de compilación.
- **Severidad:** MEDIA — duplicación innecesaria.

### 1.5 `core/orchestrator/lifecycle/VibeLifecycleManager.ts:17` — Otra unión local duplicada

```ts
type VibeId = 'fiesta-latina' | 'techno-club' | 'pop-rock' | 'chill-lounge' | 'idle'
```

- **Mecanismo:** Unión local idéntica a la 1.4.
- **Riesgo `rave`:** Error de compilación.
- **Severidad:** MEDIA.

### 1.6 `types/CustomVibe.ts:67-92` — BaseDNA (donantes de ADN para custom vibes)

```ts
export type BaseDNA = Extract<VibeId, 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge'>
export const BASE_DNA_IDS: readonly BaseDNA[] = ['techno-club', 'fiesta-latina', 'pop-rock', 'chill-lounge']
```

- **Mecanismo:** `Extract` de la unión 1.1 + array readonly + type guard.
- **Riesgo `rave`:** Custom vibes no pueden derivar de `'rave'` a menos que se añada a `BASE_DNA_IDS` y a `VibeId`.
- **Severidad:** ALTA — bloquea el VibeLab.

---

## 2. REGISTROS RUNTIME — Los 7 mapas `Record`

### 2.1 `engine/vibe/profiles/index.ts:39-45` — VIBE_REGISTRY (choke point crítico)

```ts
export const VIBE_REGISTRY: Record<VibeId, VibeProfile> = {
  'fiesta-latina': VIBE_FIESTA_LATINA, 'techno-club': VIBE_TECHNO_CLUB,
  'chill-lounge': VIBE_CHILL_LOUNGE, 'pop-rock': VIBE_POP_ROCK, 'idle': VIBE_IDLE,
}
```

- **Mecanismo:** `Record<VibeId, VibeProfile>` — map cerrado tipado.
- **Riesgo `rave`:** `getVibePreset('rave')` → `undefined`. `setActiveVibe('rave')` rechazado con 404.
- **Severidad:** CRÍTICA — es la puerta de entrada.

### 2.2 `engine/vibe/profiles/index.ts:53-93` — VIBE_ALIAS_MAP

```ts
export const VIBE_ALIAS_MAP: Record<string, VibeId> = {
  'techno': 'techno-club', 'chillout': 'chill-lounge', 'rock': 'pop-rock',
  'ambient': 'chill-lounge', 'electronic': 'techno-club', 'latin': 'fiesta-latina',
  'acid': 'techno-club', 'minimal': 'techno-club', 'industrial': 'techno-club',
  'dubstep': 'techno-club', 'cyberpunk': 'techno-club', ...
}
```

- **Mecanismo:** Mapa de alias → VibeId canónico.
- **Riesgo `rave`:** `normalizeVibeId('rave')` → `null` (no está en el mapa). Si se añade `'rave'` como alias de `'techno-club'`, pierde identidad propia.
- **Severidad:** ALTA — aquí se deciden los aliases.

### 2.3 `hal/physics/profiles/index.ts:25-47` — PROFILE_REGISTRY (motor líquido)

```ts
export const PROFILE_REGISTRY: Record<string, ILiquidProfile> = {
  'techno-club': TECHNO_PROFILE, 'fiesta-latina': LATINO_PROFILE,
  'pop-rock': POPROCK_PROFILE, 'chill-lounge': CHILL_PROFILE,
  'techno': TECHNO_PROFILE, 'latino': LATINO_PROFILE, 'reggaeton': LATINO_PROFILE,
  'salsa': LATINO_PROFILE, 'cumbia': LATINO_PROFILE, 'dembow': LATINO_PROFILE,
  'rock': POPROCK_PROFILE, 'pop': POPROCK_PROFILE, 'indie': POPROCK_PROFILE,
  'metal': POPROCK_PROFILE, 'chill': CHILL_PROFILE, 'lounge': CHILL_PROFILE,
  'ambient': CHILL_PROFILE, 'jazz': CHILL_PROFILE,
}
export const DEFAULT_LIQUID_PROFILE: ILiquidProfile = TECHNO_PROFILE
```

- **Mecanismo:** `Record<string, ILiquidProfile>` con fallback a `TECHNO_PROFILE`.
- **Riesgo `rave`:** `PROFILE_REGISTRY['rave']` → `undefined` → `SeleneLux` carga `TECHNO_PROFILE` silenciosamente. Física líquida = techno.
- **Severidad:** CRÍTICA — la física del sonido sería techno, no rave.

### 2.4 `engine/color/colorConstitutions.ts:505-522` — COLOR_CONSTITUTIONS

```ts
export const COLOR_CONSTITUTIONS: Record<VibeId, GenerationOptions> = {
  'idle': IDLE_CONSTITUTION, 'techno-club': TECHNO_CONSTITUTION,
  'fiesta-latina': LATINO_CONSTITUTION, 'pop-rock': ROCK_CONSTITUTION,
  'chill-lounge': CHILL_CONSTITUTION,
}
export function getColorConstitution(vibeId: VibeId | string): GenerationOptions {
  return COLOR_CONSTITUTIONS[vibeId as VibeId] ?? IDLE_CONSTITUTION
}
```

- **Mecanismo:** `Record` lookup con fallback a `IDLE_CONSTITUTION`.
- **Riesgo `rave`:** `getColorConstitution('rave')` → `IDLE_CONSTITUTION` (colores neutros sin identidad). Sin `forbiddenHueRanges`, sin `neonProtocol`, sin `thermalGravity`, sin sidereal clock.
- **Severidad:** CRÍTICA — la identidad visual se pierde.

### 2.5 `engine/movement/VibeMovementManager.ts:192-257` — VIBE_CONFIG + TILT_OFFSET + STEREO_CONFIG

```ts
export const TILT_OFFSET_BY_VIBE: Readonly<Record<string, number>> = {
  'techno-club': -0.35, 'fiesta-latina': -0.15, 'pop-rock': -0.30, 'chill-lounge': -0.25, 'idle': -0.10,
}
export const VIBE_CONFIG: Record<string, VibeConfig> = { ... }  // 5 entries
export const STEREO_CONFIG: Record<string, StereoConfig> = { ... }  // 5 entries
```

- **Mecanismo:** 3 mapas `Record` con fallback a `idle` (VIBE_CONFIG, STEREO_CONFIG) o `0` (TILT).
- **Riesgo `rave`:** Movers usan config `idle` (congelado/breathing), stereo `sync` (sin espejo), tilt `0` (apuntando al techo).
- **Severidad:** ALTA — los movers no bailarían como rave.

### 2.6 `engine/movement/VibeMovementPresets.ts:83-239` — MOVEMENT_PRESETS

```ts
export const MOVEMENT_PRESETS: Record<string, MovementPreset> = { ... }  // 5 entries
export function getMovementPreset(vibeId: string): MovementPreset {
  const preset = MOVEMENT_PRESETS[vibeId]
  if (!preset) { console.warn(...); return MOVEMENT_PRESETS['idle'] }
}
```

- **Mecanismo:** `Record` lookup con warning + fallback a `idle`.
- **Riesgo `rave`:** Warning en consola + física de movimiento `idle`.
- **Severidad:** ALTA.

### 2.7 `core/aether/adapters/KineticAdapter.ts:84-101` — VIBE_ID_MAP (segundo mapa independiente)

```ts
const VIBE_ID_MAP: Readonly<Record<string, string>> = {
  'techno-club': 'techno-club', 'techno': 'techno-club', 'electro': 'techno-club',
  'fiesta-latina': 'fiesta-latina', 'latino': 'fiesta-latina', 'salsa': 'fiesta-latina',
  'reggaeton': 'fiesta-latina', 'pop-rock': 'pop-rock', 'rock': 'pop-rock', 'pop': 'pop-rock',
  'chill-lounge': 'chill-lounge', 'chill': 'chill-lounge', 'lounge': 'chill-lounge',
  'ambient': 'chill-lounge', 'jazz': 'chill-lounge', 'idle': 'idle',
}
const FALLBACK_VIBE_ID = 'techno-club'  // ← fallback DISTINTO al VMM (que usa 'idle')
```

- **Mecanismo:** Mapa independiente con fallback a `techno-club` (no `idle`).
- **Riesgo `rave`:** `VIBE_ID_MAP['rave']` → `undefined` → `FALLBACK_VIBE_ID = 'techno-club'`. Los movers bailan como techno.
- **Severidad:** ALTA — **discrepancia de fallback**: KineticAdapter → techno, VMM → idle. Inconsistencia.

---

## 3. ORQUESTACIÓN CORE — Cómo se inyecta y propaga la vibra

### Cadena de llamada completa (vibe change)

```
TitanOrchestrator.setVibe(vibeId)                    [TitanOrchestrator.ts:881]
  → VibeLifecycleManager.setVibe(vibeId)             [VibeLifecycleManager.ts:51]
    → TitanEngine.setVibe(vibeId)                    [TitanEngine.ts:1401]
      → VibeManager.setActiveVibe(vibeId)            [VibeManager.ts:123]
        → normalizeVibeId(vibeId)                     [profiles/index.ts:98]
          → VIBE_REGISTRY lookup + VIBE_ALIAS_MAP
        ← VibeProfile | null
      ← boolean (ok/fail)
    → TitanEngine.setActiveProfile(normalizedVibeId) [TitanEngine.ts:1495]
      → SeleneLux.setActiveProfile(vibeKey)          [SeleneLux.ts:551]
        → PROFILE_REGISTRY[vibeKey] ?? DEFAULT_LIQUID_PROFILE
        → liquidEngine41.setProfile(profile)
        → liquidEngine71.setProfile(profile)
    → TitanEngine.emit('vibe-changed', vibeId)
```

### `engine/TitanEngine.ts` — Branches por `vibeProfile.id`

| Línea | Mecanismo | Código | Riesgo `rave` |
|---|---|---|---|
| 620 | `if` estricto | `if (vibeProfile.id === 'idle') { return idleIntent }` | `rave` no coincide → procesamiento normal (correcto) |
| 780 | Map lookup | `let constitution = getColorConstitution(vibeProfile.id)` | `rave` → `IDLE_CONSTITUTION` (colores neutros) |
| 811-814 | `includes()` if/else | `const isChillVibe = vibeProfile.id.toLowerCase().includes('chill') \|\| ... 'lounge' \|\| 'ambient' \|\| 'jazz'` | `rave` no es chill → sin oceanic modulation |
| 975-980 | `===` if/else | `if (nervousOutput.physicsApplied === 'latino' \|\| 'techno' \|\| 'rock' \|\| 'chill' \|\| 'liquid-stereo')` | `rave` no coincide → zonas L/R legacy mono |
| 959 | Map lookup | `getOpticsConfig(vibeProfile.id)` | `rave` → warning 404 + preset `idle` |
| 1064 | Map lookup | `generateStereoMovement(this.vibeManager.getActiveVibe().id, ...)` | `rave` → `VIBE_CONFIG['idle']` |
| 1401-1409 | Boolean guard | `if (!ok) { console.warn('REJECTED 404'); return }` | `rave` rechazado, no se emite `vibe-changed` |

### `core/orchestrator/tick/TickEngine.ts:1920` — Cast de tipo inline

```ts
vibe: {
  active: currentVibe as 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge' | 'idle' | 'custom',
  transitioning: false
}
```

- **Mecanismo:** Cast inline (mentira de tipo).
- **Riesgo `rave`:** El cast no falla en runtime pero el truth broadcast lleva un valor que los consumidores asumen que está en la unión.
- **Severidad:** BAJA.

---

## 4. MOTOR FÍSICO — `LiquidEngineBase` / `LiquidEngine71` / `LiquidEngine41`

### `LiquidEngineBase.ts` — Branches por `profile.id`

| Línea | Mecanismo | Código | Riesgo `rave` |
|---|---|---|---|
| 646 | Boolean guard | `if (this.isAbsoluteChillProfile()) { return glacierPayload }` | `rave` no es chill → procesa audio normalmente |
| 1958 | `===` estricto | `const isTechnoProfile = this.profile.id === 'techno-industrial'` | `rave` → `isTechnoProfile = false` → `vocalPenalty` activo, `dmzFactor=0.30`, `backLeftGain=1.75` (valores latino/rock) |
| 2257-2260 | `includes()` | `return id.includes('chill') \|\| id.includes('ambient')` | `rave` no contiene chill/ambient → no se clasifica como ambient |

**Consecuencia crítica:** Si `rave` es sonicamente cercano a techno (EDM, sub-bass continuo, sintes), recibirá la `vocalPenalty` de latino (0.75) en Back L, el `dmzFactor` de 0.30 (menos DMZ de bombo), y `backLeftGain` 1.75 (más ganancia que techno 1.45). **La física del canal melódico será incorrecta.**

### `LiquidEngine71.ts:59-61, 105-108` — Routing espacial 7.1

```ts
const LATINO_PROFILE_ID = 'latino-fiesta'
const CHILL_PROFILE_ID  = 'chill-oceanic'
const isLatino = profileId === LATINO_PROFILE_ID
const isChill  = profileId === CHILL_PROFILE_ID
// ...
const outMoverL = isLatino ? moverRight : moverLeft  // swap de movers
const outMoverR = isLatino ? moverLeft  : moverRight
```

- **Riesgo `rave`:** Ni latino ni chill → routing default (techno). Mover L = `envTreble`, Mover R = `envVocal`. Si rave necesita un routing distinto, no lo obtiene.

### `LiquidEngine41.ts:54-57, 92` — Estrategia 4.1

```ts
const isStrict = this.profile.layout41Strategy === 'strict-split'
// ...
if (this.profile.id === 'techno-industrial') { ... }  // telemetría
```

- **Riesgo `rave`:** Si el perfil `rave` no declara `layout41Strategy: 'strict-split'`, usa `default` (smoothed `max`). Si rave es como techno (metronómico), necesita `strict-split` explícito.

### `SeleneLux.ts` — Dispatcher con `includes()` y `physicsApplied`

| Línea | Mecanismo | Código | Riesgo `rave` |
|---|---|---|---|
| 562 | Default | `private _activeProfileId: string = 'techno-industrial'` | Estado inicial hardcodeado a techno |
| 585 | Normalización | `const vibeNormalized = vibeContext.activeVibe.toLowerCase()` | `rave` → `'rave'` |
| 610-626 | `includes()` if/else | `if (vibeNormalized.includes('techno') \|\| 'electro') { TechnoStereoPhysics } else if (includes('latin') \|\| 'fiesta' \|\| 'reggae') { latinoPhysics }` | `rave` no coincide → **sin efecto de paleta per-género** |
| 677-683 | `includes()` if | `if (vibeNormalized.includes('chill') \|\| 'lounge' \|\| 'ambient' \|\| 'jazz') { chillAmbientEngine }` | `rave` no es chill → sin ChillAmbientEngine |
| 725-730 | `includes()` ternary | `const isChill = ...; const liquidEngine = (layout === '7.1' \|\| isChill) ? liquidEngine71 : liquidEngine41` | `rave` en 7.1 usa `liquidEngine71` (correcto) |
| 944 | Asignación | `physicsApplied = 'latino'` | Solo si coincide con aliases latino |
| 1211-1218 | `includes()` if | `const isTechno = vibeContext.activeVibe.toLowerCase().includes('techno'); const frontCeiling = isTechno ? 0.80 : 0.95` | `rave` → `frontCeiling = 0.95` (más permisivo que techno) |
| 1310-1330 | `includes()` if | `const isChillVibeDimmer = ...; const isChillVibeStrobe = ...` | `rave` no es chill → strobe y dimmer sin protección chill |

---

## 5. MOTOR CROMÁTICO — `SeleneColorEngine` + `colorConstitutions`

### `SeleneColorEngine.ts` — Data-driven, sin branches por nombre

El motor cromático **no tiene `switch` ni `if` sobre nombres de vibe**. Consume `GenerationOptions` (la constitución) y aplica:
- `forbiddenHueRanges` / `allowedHueRanges`
- `hueRemapping`
- `thermalGravityStrength` / `atmosphericTemp`
- `neonProtocol` (dangerZone, minSaturation, fallbackToWhite)
- `tropicalAmbientBias` / `tropicalMirror` / `suppressTropicalBias`
- `siderealClock` (per-slot allowed Hue/L)
- `mudGuard`
- `saltChromaticKeys` / `luxurySignatures`
- `oceanicModulation`
- `maxHueShiftPerSecond`
- `forceStrategy` / `accentBehavior`

**El motor es data-driven.** El riesgo no está en `SeleneColorEngine` sino en que `COLOR_CONSTITUTIONS['rave']` no existe → fallback a `IDLE_CONSTITUTION`.

### Constituciones existentes (resumen)

| Vibe | Hue prohibido | Estrategia | Neon | Sidereal | Tropical |
|---|---|---|---|---|---|
| `techno-club` | `[5,80]` | remapping a 170/130 | ✅ dangerZone | ✅ | ❌ |
| `fiesta-latina` | `[45,90],[155,185],[255,285]` | fibonacci 137.5° | ❌ | ❌ | ✅ mirror |
| `pop-rock` | `[80,160],[260,300]` | complementary | ❌ | ❌ | ❌ |
| `chill-lounge` | `[340,360],[0,150]` | analogous | ❌ | ❌ | ❌ |
| `idle` | ninguno | quaternary | ❌ | ❌ | ❌ |

### `ColorProcessors.ts` / `ColorAdapter.ts`

Sin branches por vibe. Son downstream de la constitución. Sin riesgo directo.

---

## 6. SUBSISTEMAS PERIFÉRICOS

### 6.1 VMM (`VibeMovementManager.ts`)

Ya cubierto en §2.5. Tres mapas con fallback a `idle`. **Discrepancia de fallback con KineticAdapter** (VMM → idle, Kinetic → techno).

### 6.2 KineticAdapter (`KineticAdapter.ts`)

Ya cubierto en §2.7. Mapa independiente con fallback a `techno-club`.

### 6.3 V3 DNA / .lfx parsers

| Archivo | Línea | Mecanismo | Riesgo `rave` |
|---|---|---|---|
| `core/arsenal/lfxTypes.ts:165` | `compatibleVibes: readonly string[]` | Array de strings sin restricción | `rave` aceptado en .lfx |
| `core/arsenal/LfxFileLoader.ts:317,363` | `if (!Array.isArray(...) \|\| length === 0)` | Solo valida no-vacío | `rave` pasa |
| `core/arsenal/DynamicEffectRegistry.ts:379-385` | `VIBE_ALIAS_MAP[rawVibe] ?? rawVibe` | Alias normalization | `rave` sin alias → indexado bajo literal `'rave'`, sin match canónico |
| `core/arsenal/LfxClipInstance.ts:76` | `COMPATIBLE_VIBES = ['techno-dark', 'latino-organic', 'pop-rock', 'chill-lounge']` | Array congelado | `rave` no listado → clips no se asocian |

### 6.4 Chronos / Timeline

| Archivo | Línea | Mecanismo | Riesgo `rave` |
|---|---|---|---|
| `TimelineClip.ts:76` | `toVibeType()` | Coerción a `idle` | `rave` → `idle` |
| `TimelineClip.ts:228-235` | `VIBE_COLORS` | Record de colores | `rave` → gris idle `#6b7280` |
| `LuxFileV3.ts:379-385` | `vibeId: string` | Sin validación | `rave` persiste en .lux pero se degrada al cargar |
| `ChronosStageDispatcher.ts:177-223` | `emit({ type: 'vibe-change', effectId: vibe.vibeType })` | Emite raw string | `rave` se emite pero VibeManager lo rechaza |
| `ChronosRecorder.ts:361` | `recordVibe(vibeType: string)` | Sin validación | `rave` se graba pero falla al reproducir |

### 6.5 Otros consumidores dispersos

| Archivo | Línea | Mecanismo | Riesgo `rave` |
|---|---|---|---|
| `core/effects/ContextualEffectSelector.ts:716-720` | `EFFECTS_BY_VIBE` Record | Map lookup | `rave` → sin efectos contextuales |
| `core/effects/EffectManager.ts:1303,1325,1339` | `if (vibeId === 'chill-lounge') / 'idle' / 'fiesta-latina')` | if/else estricto | `rave` → sin branch específico |
| `core/intelligence/think/PredictionEngine.ts:921-925` | `VIBE_THRESHOLD_PROFILES` Record | Map lookup | `rave` → sin perfil de predicción |
| `core/intelligence/SeleneTitanConscious.ts:1693` | `pattern.vibeId === 'chill-lounge'` | `===` estricto | `rave` no es chill |
| `core/aether/systems/KineticSystem.ts:157` | `normalizedVibe.includes('chill') \|\| 'ambient' \|\| 'lounge'` | `includes()` | `rave` no es chill |
| `core/aether/egress/AetherSafetyMiddleware.ts:34-38` | `VIBE_REV_LIMITS` Record | Map lookup | `rave` → sin rev limits |
| `core/intelligence/dream/EffectDreamSimulator.ts:60-65` | `vibeMatches()` con `VIBE_ALIAS_MAP` | Alias lookup | `rave` sin alias → sin match |
| `workers/TrinityBridge.ts:973-1000` | `VIBE_PROFILES` Record | Map lookup | `rave` → sin perfil de sección |
| `engine/musical/analysis/VibeSectionProfiles.ts:170-382` | `VIBE_SECTION_PROFILES` Record | Map lookup + aliases | `rave` → sin detección de secciones |
| `engine/musical/mapping/MusicToLightMapper.ts:161,176` | `'chill': 60, 'chill': 'static'` | Map lookup por mood | No afecta directamente (es por mood, no por vibe) |
| `components/views/HephaestusView/dna/DnaRail.tsx:101-106` | `VIBE_UI` array | Array hardcodeado | `rave` no aparece en el selector UI |
| `hooks/useSeleneVibe.ts:47-80` | `VIBE_PRESETS` Record | Map lookup | `rave` → sin label/icon en UI |
| `stores/vibeStore.ts:24` | `VibeId = string` | Tipo widened | Acepta `rave` sin error (pero backend lo rechaza) |
| `stores/transientStore.ts:93` | `truth?.consciousness?.vibe?.active` | String suelto | Acepta `rave` pero downstream falla |
| `electron/SeleneValidator.ts:29,110,194,209` | Validación de vibes | Lista hardcodeada | `rave` no validado |

---

## 7. MATRIZ DE RIESGO — Qué se rompe exactamente con `rave`

| Capa | Archivo | Qué se rompe | Severidad |
|---|---|---|---|
| **Tipo** | `types/VibeProfile.ts:18` | Error de compilación en `VibeId` | CRÍTICA |
| **Tipo** | `SeleneProtocol.ts:47` | `VibeState` no transporta `rave` | ALTA |
| **Tipo** | `TimelineClip.ts:28` | `toVibeType('rave')` → `idle` | ALTA |
| **Tipo** | `TitanOrchestrator.ts:34` | `setVibe('rave')` error de tipo | MEDIA |
| **Tipo** | `VibeLifecycleManager.ts:17` | Error de tipo | MEDIA |
| **Tipo** | `CustomVibe.ts:67` | `BaseDNA` no incluye `rave` | ALTA |
| **Registro** | `engine/vibe/profiles/index.ts:39` | `VIBE_REGISTRY` rechaza `rave` | CRÍTICA |
| **Registro** | `engine/vibe/profiles/index.ts:53` | `VIBE_ALIAS_MAP` sin alias para `rave` | ALTA |
| **Registro** | `hal/physics/profiles/index.ts:25` | `PROFILE_REGISTRY` → fallback techno | CRÍTICA |
| **Color** | `colorConstitutions.ts:505` | `COLOR_CONSTITUTIONS` → fallback idle | CRÍTICA |
| **Movimiento** | `VibeMovementManager.ts:192-257` | 3 mapas → fallback idle | ALTA |
| **Movimiento** | `VibeMovementPresets.ts:83` | `MOVEMENT_PRESETS` → fallback idle | ALTA |
| **Kinético** | `KineticAdapter.ts:84` | `VIBE_ID_MAP` → fallback techno | ALTA |
| **Física** | `LiquidEngineBase.ts:1958` | `isTechnoProfile = false` → vocalPenalty/dmz/gain de latino | ALTA |
| **Física** | `LiquidEngine71.ts:107` | `isLatino = false` → routing default (techno) | MEDIA |
| **Física** | `LiquidEngine41.ts:54` | Sin `strict-split` → routing `default` | MEDIA |
| **Física** | `SeleneLux.ts:610` | `includes()` no match → sin paleta per-género | MEDIA |
| **Física** | `SeleneLux.ts:1211` | `isTechno = false` → frontCeiling 0.95 | BAJA |
| **Efectos** | `ContextualEffectSelector.ts:716` | `EFFECTS_BY_VIBE` → sin efectos | MEDIA |
| **Efectos** | `EffectManager.ts:1303` | Sin branch para `rave` | BAJA |
| **IA** | `PredictionEngine.ts:921` | Sin perfil de predicción | BAJA |
| **IA** | `EffectDreamSimulator.ts:60` | `vibeMatches` sin alias → sin match | BAJA |
| **Sección** | `VibeSectionProfiles.ts:170` | Sin detección de secciones | MEDIA |
| **Worker** | `TrinityBridge.ts:973` | Sin perfil de sección en worker | BAJA |
| **Timeline** | `TimelineClip.ts:76` | `toVibeType` → `idle` | ALTA |
| **Timeline** | `TimelineClip.ts:228` | `VIBE_COLORS` → gris | MEDIA |
| **DNA** | `LfxClipInstance.ts:76` | `COMPATIBLE_VIBES` no incluye `rave` | BAJA |
| **UI** | `useSeleneVibe.ts:47` | `VIBE_PRESETS` → sin label/icon | MEDIA |
| **UI** | `DnaRail.tsx:101` | `VIBE_UI` → no aparece en selector | BAJA |
| **Store** | `vibeStore.ts:24` | `VibeId = string` → acepta pero backend rechaza | MEDIA |
| **Validator** | `SeleneValidator.ts` | Lista hardcodeada sin `rave` | BAJA |

---

## 8. CONTEO GLOBAL DE LITERALES

| Literal | Matches | Archivos |
|---|---|---|
| `'techno-club'` | 232 | 64 |
| `'techno-industrial'` | 9 | 8 |
| `'latino'` | 24 | 8 |
| `'chill'` | 36 | 18 |
| `'poprock'` | 2 | 1 |
| `VibeType` | 16 | 4 |
| `profile.id ===` | 8 | 4 |
| `vibe === / currentVibe / activeVibe` | 91 | 25 |
| `isTechno / isLatino / isChill` | 17 | 3 |
| `switch.*vibe / switch.*profile` | 1 | 1 (sobre `qualityTier`, no vibe) |

---

## 9. RUTA DE INYECCIÓN — Los dos caminos posibles

### Camino A: Canónica (20+ archivos)

Añadir `'rave'` como vibe canónica requiere editar:

1. `types/VibeProfile.ts:18` — añadir `'rave'` a `VibeId`
2. `core/protocol/SeleneProtocol.ts:47` — añadir `'rave'` a `VibeId`
3. `chronos/core/TimelineClip.ts:28,69` — añadir a `VibeType` + `VALID_VIBE_TYPES`
4. `core/orchestrator/TitanOrchestrator.ts:34` — añadir a unión local
5. `core/orchestrator/lifecycle/VibeLifecycleManager.ts:17` — añadir a unión local
6. `types/CustomVibe.ts:78-83` — añadir a `BASE_DNA_IDS` (si quieres que sea donante de ADN)
7. `engine/vibe/profiles/index.ts:39,53` — añadir a `VIBE_REGISTRY` + `VIBE_ALIAS_MAP`
8. `engine/vibe/profiles/RaveProfile.ts` (NUEVO) — crear `VibeProfile` objeto
9. `hal/physics/profiles/rave.ts` (NUEVO) — crear `ILiquidProfile` con `id: 'rave-xxx'`
10. `hal/physics/profiles/index.ts:25` — añadir `'rave': RAVE_PROFILE` al registro
11. `engine/color/colorConstitutions.ts:505` — añadir `RAVE_CONSTITUTION` + entrada en `COLOR_CONSTITUTIONS`
12. `engine/movement/VibeMovementManager.ts:192,203,375` — añadir a 3 mapas
13. `engine/movement/VibeMovementPresets.ts:83` — añadir preset
14. `core/aether/adapters/KineticAdapter.ts:84` — añadir a `VIBE_ID_MAP`
15. `core/effects/ContextualEffectSelector.ts:716` — añadir a `EFFECTS_BY_VIBE`
16. `engine/musical/analysis/VibeSectionProfiles.ts:170` — añadir perfil de sección
17. `core/intelligence/think/PredictionEngine.ts:921` — añadir perfil de predicción
18. `workers/TrinityBridge.ts:973` — añadir perfil de sección en worker
19. `chronos/core/TimelineClip.ts:228` — añadir color a `VIBE_COLORS`
20. `hooks/useSeleneVibe.ts:47` — añadir a `VIBE_PRESETS`
21. `components/views/HephaestusView/dna/DnaRail.tsx:101` — añadir a `VIBE_UI`
22. `core/arsenal/LfxClipInstance.ts:76` — añadir a `COMPATIBLE_VIBES`
23. `LiquidEngineBase.ts:1958` — decidir si `rave` necesita `isTechnoProfile` (probablemente sí)
24. `LiquidEngine71.ts:107` — decidir si `rave` necesita routing especial
25. `SeleneLux.ts:610` — decidir si `rave` necesita paleta per-género

### Camino B: Graft (runtime, sin tocar tipos)

Usar `VibeGraftRegistry.graft()` con key `custom:rave`:

```ts
graft({
  key: 'custom:rave',
  vibeProfile: RAVE_VIBE_PROFILE,
  liquidProfile: RAVE_LIQUID_PROFILE,
  colorConstitution: RAVE_CONSTITUTION,
  vibeConfig: RAVE_VIBE_CONFIG,
  stereoConfig: RAVE_STEREO_CONFIG,
  movementPreset: RAVE_MOVEMENT_PRESET,
  tiltOffset: -0.35,
})
```

Esto inyecta en runtime:
- `VIBE_REGISTRY['custom:rave']` (via graft)
- `COLOR_CONSTITUTIONS['custom:rave']` (via graft)
- `VIBE_CONFIG['custom:rave']` (via graft)
- `STEREO_CONFIG['custom:rave']` (via graft)
- `MOVEMENT_PRESETS['custom:rave']` (via graft)
- `TILT_OFFSET_BY_VIBE['custom:rave']` (via graft)

**Limitaciones del graft:**
- No resuelve los `if/else` con `includes()` en `SeleneLux.ts:610` (rave no matchea `'techno'` ni `'latin'`).
- No resuelve `LiquidEngineBase.ts:1958` (`isTechnoProfile` sigue false).
- No resuelve `LiquidEngine71.ts:107` (routing default).
- No resuelve `TimelineClip.ts:76` (`toVibeType` lo degrada a `idle`).
- No resuelve `KineticAdapter.ts:84` (`VIBE_ID_MAP` no tiene `custom:rave`).
- No resuelve los tipos TypeScript (necesita casting).

**Conclusión:** El graft es útil para prototipar pero insuficiente para una vibra completa. El camino canónico es necesario para cobertura total.

---

## 10. RECOMENDACIONES ARQUITECTÓNICAS

1. **Fuente única de verdad:** Centralizar `VibeId` en un solo archivo y derivar todas las uniones, mapas, y validadores de él. Eliminar las 4 uniones duplicadas.
2. **Reemplazar `includes()` por lookup explícito:** Los `includes('techno')`, `includes('chill')` son frágiles. Usar un mapa `VIBE_FAMILY: Record<VibeId, 'techno' | 'latino' | 'rock' | 'chill' | 'rave'>` que clasifique cada vibe en una familia.
3. **Unificar fallbacks:** KineticAdapter → `techno`, VMM → `idle`. Deberían coincidir. Idealmente, lanzar error en vez de fallback silencioso.
4. **Registrar, no hardcodear:** Los `if (vibeId === 'chill-lounge')` en `EffectManager` deberían ser un mapa `Record<VibeId, EffectRules>`.
5. **El motor cromático ya es data-driven** — es el modelo a seguir. Las constituciones son objetos de datos, no código con branches.
6. **Considerar `rave` como familia de `techno`:** Si rave es sonicamente cercano a techno (EDM, sub-bass, sintes), la ruta más eficiente es: `VIBE_ALIAS_MAP['rave'] = 'techno-club'` + constitución propia + perfil líquido propio. Esto reutiliza toda la infraestructura techno y solo cambia color + física.

---

*Fin del documento. Auditoría de solo lectura. Sin modificaciones de código.*
